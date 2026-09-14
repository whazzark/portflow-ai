# Research — Protect Self-Role Changes and the Final Organization Admin

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Every decision below starts from what GH-28 delivered: `PATCH /api/v1/users/:id/role`, authorized by
`UserPolicy.changeRole`, handled by `ChangeUserRoleUseCase`, and applied by
`LucidUserRepository.changeRole` as one guarded `UPDATE … WHERE access_status <> 'DEACTIVATED'`.
The web offers the role in GH-24's `Edit` panel and sends it through `saveUser` in
`users-page.tsx`. Nothing in the spec is left as NEEDS CLARIFICATION; the unknowns below were
technical ones.

## D1 — The self check lives in the use case, before any read

**Decision**: `ChangeUserRoleUseCase.handle` gains `requestedByUserId` and refuses, before the
repository is reached, any request whose `userId` names the requester, whatever `role` it carries.
The comparison lower-cases both identifiers, exactly as `DeactivateUserUseCase` does. The refusal is
`SelfRoleChangeException` — `409 E_USER_SELF_ROLE_CHANGE`.

**Rationale**:

- The decision needs nothing from the database: the requester is the session's user, and naming
  oneself is visible in the request. A guard that runs before the transaction opens costs no lock.
- `changeUserRoleValidator` admits only UUIDs, and a UUID has exactly two spellings of each hex
  digit. Lower-casing is therefore a complete canonicalization, and it closes the bypass
  `DeactivateUserUseCase` documents: PostgreSQL matches `0193A2B4-…` against the stored lower-case
  row, so a case-sensitive `===` would let an administrator demote themselves (FR-002).
- 409 rather than 403, for the reason `SelfDeactivationException` records: the administrator *may*
  change roles, and what is refused is this target. A 403 would land in the bucket the interface
  reads as "you may not be here" (FR-003).
- The role submitted is irrelevant. Refusing the target outright is what the spec decided, and it
  keeps GH-28's unchanged-success rule (FR-006 there) from ever applying to the requester.

**Alternatives considered**:

- *In `UserPolicy.changeRole`*. Rejected: every Bouncer denial surfaces as one
  `E_AUTHORIZATION_FAILURE`, so the reason could never be told, and the policy would have to take the
  target as a parameter it does not take today.
- *After the locked read, comparing the stored `target.id`*, as `UpdateUserIdentityUseCase` does.
  Correct, but it opens a transaction and takes the whole lock scope of D3 for a request that is
  decidable from its own input. That use case reads the target anyway; this one would read it only to
  refuse it.
- *403, as `SelfIdentityUpdateException`*. Rejected: that refusal points to another seam — the
  self-service path — whereas no seam exists for a user's own role. The refusal is about this target,
  not about which door to use.

## D2 — The final admin rule is a typed outcome of the repository write

**Decision**: `ChangeUserRoleResult` gains `{ kind: 'LAST_ACTIVE_ORGANIZATION_ADMIN' }`. The Lucid
repository returns it when the locked read of D3 shows the target is an active organization admin,
the submitted role is not organization admin, and no other active organization admin was locked.
The use case maps it to `LastActiveOrganizationAdminException` — `409
E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN`.

**Rationale**:

- The rule is a cross-row integrity condition, and it can only be decided where the rows are locked.
  The repository already reports conditions of that shape as observations — `EMAIL_TAKEN` for
  `users_email_unique`, `REFERENCED` for a `RESTRICT` foreign key — and leaves choosing the refusal to
  the use case. This outcome follows the same split: the repository says what the write saw, the use
  case says what the caller is told.
- The lock scope and its order are persistence mechanics GH-21 has to reproduce exactly on
  `deactivateActive` (D7). Keeping them inside one class, behind one private helper, is what makes
  "exactly" enforceable. Spread between a use case and a repository read, a second caller could lock
  the same rows in another order and reintroduce the deadlock D3 avoids.

**Alternatives considered**:

- *A use-case-owned transaction*, as `UpdateUserIdentityUseCase` does: the repository exposes a
  locked read, the use case counts and decides, the repository writes. Viable, and closer to the
  letter of constitution principle V. Rejected for the reason above. The business decision is a
  single comparison, whereas the lock discipline is the hard part, and it is the part both slices
  must share.
- *A database trigger or constraint*. "At least one row matching a predicate" is not expressible as a
  constraint. A trigger would hide a business rule in a migration, and would need a second
  implementation for SQLite, where the suites run.

## D3 — One locking read of the target and every active organization admin, in id order

**Decision**: `changeRole` runs in a transaction and opens it with one statement:

```sql
SELECT * FROM users
WHERE id = :target
   OR (role = 'ORGANIZATION_ADMIN' AND access_status = 'ACTIVE')
ORDER BY id
FOR NO KEY UPDATE
```

It decides on the rows it returns (no row for `:target` → `NOT_FOUND`; target `DEACTIVATED` →
`DEACTIVATED`; target is the only active organization admin and is being demoted →
`LAST_ACTIVE_ORGANIZATION_ADMIN`). Otherwise it writes the role with GH-28's guarded `UPDATE`, keeping
its `WHERE access_status <> 'DEACTIVATED'` clause, and reloads the user with the access history
preloaded, as today. The statement is taken on every role change, not only on demotions.

**Rationale**:

- *It serializes exactly the changes that can collide.* Two demotions of two different admins update
  two different rows. With no lock in common, each would see the other still an admin and both would
  pass: a write skew. The two decisions are only serialized if each locks every row the other one
  counts, and the set of active organization admins is exactly that set.
- *It re-reads what it waited for.* Under PostgreSQL's READ COMMITTED, a locking read that waited for
  a row re-evaluates its `WHERE` against the committed version (EvalPlanQual). A row that stopped being
  an active organization admin while the statement waited — demoted by the winner of a race, or
  deactivated by GH-20 — is dropped from the result. That is FR-005: the decision is taken against the
  organization as it stands when the change is applied.
- *It cannot deadlock with itself.* Rows are locked after the sort, and `id` never changes, so every
  role change acquires its locks in the same order. Locking the target first and the admins second
  would deadlock two administrators demoting each other: T1 holds B and wants A, while T2 holds A and
  wants B.
- *Always, rather than only on a demotion.* Knowing whether the target is an active admin requires
  reading it, and reading it under a lock before locking the admins is the two-step order just
  rejected. The cost is a handful of extra row locks held for one short transaction on a table of at
  most a few hundred users (plan, Scale).
- *SQLite* compiles the locking clause to nothing, as it already does for every `forUpdate()` in this
  repository, and serializes writers anyway. The suites run there, so they prove the serialized
  outcome, and the lock itself is proven on PostgreSQL by hand (D9).

**Alternatives considered**:

- *One conditional `UPDATE … AND EXISTS (SELECT 1 FROM users WHERE … other active admin)`*. Rejected:
  the subquery reads a snapshot. Two mutual demotions touch different rows, neither waits, and both
  succeed. This is the write skew above, in one statement.
- *`SERIALIZABLE` isolation for this transaction*. PostgreSQL would detect the skew and abort one side
  with `40001`, which then needs a retry loop, or a mapping from a serialization failure to a business
  refusal. There is no precedent in this codebase, SQLite ignores it, and the row locks give the same
  guarantee without a retry.
- *`pg_advisory_xact_lock` on a constant key*. It would serialize every admin-population change, but
  only the writers that remember to take it. A row lock is taken implicitly by any `UPDATE` of those
  rows. A deactivation that knows nothing of this rule — GH-20's, today — still waits for it, and its
  effect is still seen by the re-evaluation above. It is also PostgreSQL-only SQL, which would need a
  dialect branch for SQLite.

## D4 — `FOR NO KEY UPDATE`, reached through `knexQuery`

**Decision**: The locking clause is `FOR NO KEY UPDATE`, not `FOR UPDATE`. Lucid's query builder
exposes only `forUpdate()` and `forShare()`, so the statement sets it on the public `knexQuery` of
the Lucid builder (`query.knexQuery.forNoKeyUpdate()`) before awaiting it. knex 3 compiles it to
`FOR NO KEY UPDATE` on PostgreSQL and to nothing on SQLite.

**Rationale**: every insert of a row that references a user takes `FOR KEY SHARE` on that user's row,
through PostgreSQL's foreign-key check. This includes an invitation (`invited_by_user_id`) and any
record an admin creates. `FOR UPDATE` conflicts with `FOR KEY SHARE`. Locking every admin row with
it would make an admin's ordinary work wait on a role change, and would open a real deadlock with any
transaction referencing two users. `FOR NO KEY UPDATE` conflicts with every writer that matters here:
another role change (same lock), an `UPDATE` of non-key columns such as deactivation or identity (they
take `FOR NO KEY UPDATE` implicitly), and `forUpdate()` readers. It leaves foreign-key checks alone.

**Alternatives considered**: `forUpdate()`, which is the only single-row lock this repository uses
today. Acceptable on one row and harmless for correctness here too, but rejected for the conflict with
`FOR KEY SHARE` described above, because this statement locks every admin rather than one row.

## D5 — A promotion committed while waiting is not seen: the rule errs towards refusing

**Decision**: Accepted as a documented limit, not engineered away.

**Detail**: a locking read re-checks only the rows its snapshot found. Suppose C becomes an
organization admin in a transaction that commits while this statement waits. C was not an admin in
the snapshot, so C is not counted. A demotion that would have left C as the remaining admin can
therefore be refused, although a moment later it would be allowed. The window is a collision of a
promotion with a demotion of the last other admin. The error is in the safe direction, and a retry
succeeds. The refusal message states the rule and never a count (FR-007), so it stays truthful.
Closing it would take a second read after the locks are held, with rules about which of the rows it
finds are also locked. That machinery is not worth it at this scale.

## D6 — Refusal codes, messages, and precedence

| Order | Condition | Status | Code | Message |
|---|---|---|---|---|
| 1 | No session, or session user not active | 401 | — | unchanged (GH-28) |
| 2 | Session role is not organization admin | 403 | — | unchanged (GH-28) |
| 3 | `:id` not a UUID, `role` missing or unknown | 422 | `E_VALIDATION_ERROR` | unchanged (GH-28) |
| 4 | `:id` names the requester | 409 | `E_USER_SELF_ROLE_CHANGE` | `Your own role can only be changed by another organization admin` |
| 5 | No such user | 404 | `E_USER_NOT_FOUND` | unchanged (GH-28) |
| 6 | Target deactivated | 409 | `E_USER_DEACTIVATED_CANNOT_CHANGE_ROLE` | unchanged (GH-28) |
| 7 | Target is the last active organization admin, and the submitted role is not organization admin | 409 | `E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN` | `The organization must keep at least one active organization admin` |

**Rationale**: authorization stays first, so FR-011 needs no new code. A viewer who may not change
roles gets GH-28's 403 whatever id they name, including their own. Validation stays before the use
case, so a self-request with a malformed role is a 422, which is harmless. The self check precedes
every read (D1). A deactivated target can never be an active admin, so rows 6 and 7 cannot both
apply. The final admin message names the rule, and neither the remaining admins nor what to do next,
for the reason the spec's assumptions give.

## D7 — The seam GH-21 will reuse

**Decision**: the locking read of D3 is a private helper of `LucidUserRepository`, named for what it
locks — `lockTargetAndActiveOrganizationAdmins(trx, id)`. It returns the target (or `null`) and
the other active organization admins it locked. `LastActiveOrganizationAdminException` is filed in
`app/users/shared/user_exceptions.ts` next to the other shared refusals, with a message about the
rule rather than about role changes. `CONTEXT.md` records the rule under **User Role Change**.

**Rationale**: GH-21 must refuse the deactivation of the last active organization admin, and to be
judged one after the other with a role change, it must take the same locks in the same order. Only
then does a demotion racing a deactivation resolve to one success. Giving it one helper to call and
one exception to throw is the whole preparation this slice owes it. No speculative GH-21 code is
written here (constitution I).

## D8 — The workbench needs one invalidation, not a new control

**The fact that drives it**: the final admin refusal only reaches a requester who is no longer an
active organization admin when the change is applied. Had they still been one, they would have
counted as another active admin — the self rule guarantees they are not the target — and the target
would not have been the last. So every time the workbench receives this refusal, the viewer's own
session is stale: they were demoted or deactivated by the other side of the collision. This
corrected the spec during planning (spec, Revisions).

**Decision**:

- `use-user-mutations.ts` invalidates `auth.me` in `changeRole`'s `onError` as well as in its
  `onSuccess`. Its comment stops calling the case unreachable and states the fact above.
- `edit-user-form.tsx` is unchanged. GH-28's refusal path already puts the API's words in a toast,
  which outlives the panel (FR-012), and in a form-level message for the rare viewer who stays.
- `components/layout/authenticated-layout.tsx` stops rendering a blank page when the session is
  lost mid-visit. When `useSession()` reports `unauthenticated`, it runs the sequence `useLogout`
  already uses — `resetSession(queryClient)`, then `router.invalidate()` — once, so that
  `_authenticated`'s guard re-reads the session, meets the 401, and redirects to `/login`. *Added
  while generating tasks*: the first version of this decision assumed the guards already did this.
  They do not. A refetch that answers 401 leaves the previous user in the cache, `ensureQueryData`
  keeps returning it, and the layout renders `null`.
- No other file changes. `saveUser`'s sequential identity-then-role order already keeps an identity
  that landed before a refused role (FR-013). `UserSheet` already falls back to the record when
  `canEdit` turns false. `mayEditUserIdentity` already withholds `Edit` from the viewer's own record
  (FR-010). The collection refresh GH-28 already runs on a refusal shows the target as they stand.

**Rationale**: without the invalidation, the refused viewer keeps an organization admin session in
the client. The panel stays open on a form they may no longer submit, the status tabs of an admin
stay on screen, and their next save is answered 403 with no explanation. With it:

| Viewer after the collision | `auth.me` refetch | What follows, through existing code |
|---|---|---|
| Demoted | new role | `canEdit` false → `UserSheet` shows the record; `consultsEveryStatus` false → active users only; navigation follows the role (GH-28 FR-011) |
| Deactivated | 401 | `SessionProvider` reports unauthenticated → `AuthenticatedLayout` resets the session and invalidates the router → `_authenticated` redirects to `/login` (the layout change above) |

The layout change is not specific to role changes. Any user deactivated while signed in (GH-20)
currently sees a blank page on their next session refetch, and will be sent to sign-in instead.
That is the behavior GH-3 describes for a non-active user. It is included here because FR-012 cannot
be met without it, and it is one effect in one component.

The self refusal cannot be produced from the workbench, so it needs no handling of its own. It would
take the generic path if it ever were.

**Alternatives considered**:

- *Resetting the role field to `ORGANIZATION_ADMIN` on this refusal*. That is the only role the
  refusal can leave the target holding, so it would show the current role in the panel. Dropped once
  the fact above was established: the panel is never still there to show it. The record and the
  collection show the target's role instead.
- *Invalidating `auth.me` on this code only*. Equivalent today, but a refusal of either kind is cheap
  to follow with one session read, and a code-specific branch is a place for the next refusal to be
  forgotten.
- *Disabling the demotion options when the target is the only other active admin*. Rejected: that
  state cannot exist for a viewer who is an admin themselves, since there are then at least two. The
  collision the rule guards against cannot be anticipated by any client.

## D9 — Verification seams

| Concern | Seam | How |
|---|---|---|
| Self refusal, every role, upper-cased id (FR-001–FR-003) | Japa unit + integration | Use case with `requestedByUserId`; `PATCH` own id in lower and upper case with each of the four roles; the row is compared in full before and after. |
| Self refusal unreachable by non-admins (FR-011) | Japa integration | Operations admin, operations lead, and observer naming themselves → the same 403 as for any id. |
| Final admin rule, sequential (FR-004, FR-005, FR-007, FR-008) | Japa unit | Global transaction. Every active organization admin left by other files is hidden first, by setting its role to operations admin inside the rolled-back transaction. Then: demoting the only active admin is refused; a deactivated or demoted second admin no longer counts; a pending or cancelled admin can always be demoted; promotion and the no-op are never refused; three admins can lose two. |
| Final admin rule, concurrent (FR-006, SC-002) | Japa integration, own group | **No global transaction.** Under one, both requests share a single transaction and no lock can contend on PostgreSQL. Setup hides the bystander admins by role and its cleanup restores them. 50 rounds of two fresh admins demoting each other with `Promise.all`: exactly one `200`, the other a `409 E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN` or a `403` (the loser's authorization ran after the winner committed), and exactly one active admin left. |
| The PostgreSQL lock itself | By hand | The two role-change suites run against a scratch PostgreSQL database, and a `psql` session holds an admin's row while a request waits on it ([quickstart.md](./quickstart.md)). The pattern follows GH-9 and GH-14. |
| No write, no record on refusal (FR-009) | Japa unit | GH-28's `untouchedFields` comparison, extended to the requester and to the second admin. |
| Workbench (FR-010, FR-012, FR-013) | Vitest + MSW | Final admin refusal with `auth.me` then reporting the viewer as an operations admin: the toast carries the API's message, the panel gives way to the record showing the target as an organization admin, with no `Edit` action and no status tabs. With `auth.me` then answering 401: the location becomes `/login`. The layout's own test proves the same redirect for a 401 met on any authenticated page. Identity landed, then role refused: the corrected name is shown. Own record with a hand-typed `mode=edit`: no role control. |

**Why 50 rounds under SQLite too**: the rounds are cheap there, and they guard against a regression
that would make a serialized run order-dependent. The number is the one SC-002 names. It is only
meaningful for the lock on PostgreSQL, which is why that run is in the quickstart.

## D10 — No migration, no ADR, one glossary line

No column, index, or table changes: the rule reads `role` and `access_status`, which the locking read
already filters on, over a table of at most a few hundred rows. No ADR: D3 and D4 are local to one
repository and are recorded here and in its doc comments, which is where the codebase keeps its other
locking decisions. `CONTEXT.md` gains one sentence under **User Role Change**, stating the two rules
as domain vocabulary (constitution VI).
