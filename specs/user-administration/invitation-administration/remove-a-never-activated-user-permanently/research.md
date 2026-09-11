# Phase 0 — Outline & Research: Remove a Never-Activated User Permanently

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-11

The spec carries no open `[NEEDS CLARIFICATION]` marker: the removal is untraced (FR-012) and
confirmed with a single dialog (FR-017), both resolved on 2026-09-11. What follows is design
research only — where each decision lands in the existing architecture, and what was rejected.

Every decision below was taken against the code as it stands. `apps/api/app/users/` holds list,
invite, deactivate, identity, role change, and password reset slices; nothing in the application
deletes a row of `users`, and `start/routes.ts` declares no `DELETE` route at all. Invitation
cancellation (GH-12), restoration (GH-13), renewal (GH-9), and acceptance (GH-8) are not delivered,
but the `CANCELLED` status, its columns, and the `cancelled` factory state exist since GH-2.

---

## D1 — The command is `DELETE /api/v1/users/:id`

**Decision**: one endpoint, `DELETE /api/v1/users/:id`, route name `users.destroy`, no body,
answering `204 No Content`.

**Rationale**: the repository has two write shapes — `PATCH` for a field update and
`POST /:id/<action>` for a state transition (`deactivate`, `password-reset`, `trucks.suspend`). A
removal is neither: the resource stops existing, which is exactly what `DELETE` on the resource URL
says. It is the first `DELETE` route in the API, and that is the point — every earlier write kept
its row, and a reader of `start/routes.ts` should see at a glance that this one does not.
`destroy` is AdonisJS's resourceful name for the action, so the Tuyau registry exposes it as
`tuyauQuery.users.destroy` without a custom alias.

**Rationale for `204`**: every other user write returns the row in the administration projection so
the workbench can render it (GH-28 D7). There is no row to return here, and inventing one — the
removed user echoed back — would contradict FR-012, which keeps no copy of the removed identity. The
workbench already invalidates the collection after a write (D8), so it loses nothing.
`LogoutController` already answers `204` through the same Tuyau client, so the client handles an
empty body.

**Alternatives considered**:

- `POST /api/v1/users/:id/remove`, mirroring `deactivate`. Rejected: it dresses a deletion as a
  state transition, and there is no `REMOVED` state to transition into (FR-012).
- `DELETE` answering `200` with `{ data: { id } }`. Rejected: the id is what the caller sent; the
  body would carry nothing the caller does not already hold.

---

## D2 — The policy answers "may this viewer remove users at all", nothing about the target

**Decision**: add `UserPolicy.remove(user)` returning
`user.accessStatus === 'ACTIVE' && user.role === 'ORGANIZATION_ADMIN'`.

**Rationale**: the split every other `UserPolicy` method documents — the policy owns "may this
viewer act", the use case and repository own "on what". Kept as its own method rather than reusing
`deactivate`: the two rules happen to agree today and each is one line, and a shared ability would
have to grow a parameter the day they diverge. The `accessStatus === 'ACTIVE'` clause is redundant
with GH-3 and kept anyway, because FR-013 names the non-active session as a case that must be denied.

---

## D3 — Non-disclosure is structural; the refusals name what to do instead

**Decision**: authorize before validating or reading the target. The refusal taxonomy:

| Situation | Outcome |
|---|---|
| No session, or non-active session | 401 from the auth middleware |
| Session whose role is not organization admin | 403 from `UserPolicy.remove`, target never read |
| `:id` not a UUID | 422 `E_VALIDATION_ERROR` |
| No user with that id — including one already removed | 404 `E_USER_NOT_FOUND` |
| Target is active — including the requester themselves | 409 `E_USER_ACTIVE_CANNOT_BE_REMOVED` |
| Target is deactivated | 409 `E_USER_DEACTIVATED_CANNOT_BE_REMOVED` |
| Target is named by a restricting operational record | 409 `E_USER_REFERENCED_CANNOT_BE_REMOVED` |

**Rationale**: FR-015 requires the same denial whatever the identifier names. Only an organization
admin ever reaches a target lookup, and they may consult every user in every status, so the
404/409 distinctions leak nothing; every other viewer is stopped by the policy before a row is read.
This is the ordering `UsersController.deactivate` and `changeRole` already pin with tests.

**The self case needs no guard of its own**: the requester is active by construction (D2), so their
own id is refused as an active user. Unlike deactivation, which needs `SelfDeactivationException`
because an active target is otherwise eligible, removal's eligibility rule already excludes every
possible requester. A test pins it rather than code.

**An already-removed user is a 404**, not an idempotent success. FR-012 keeps no removed state, so
the system cannot tell "removed a moment ago" from "never existed" — and FR-004 requires the latter
to be refused. The workbench words the 404 as "This user no longer exists", which is true in both
cases from where the administrator stands.

**Messages name the way forward** (FR-002, FR-003): the active refusal names deactivation, the
deactivated one says users who once held access are kept. The workbench maps each code to its own
second-person sentence (D8), as `user-access-copy.ts` already does for deactivation.

**Alternatives considered**:

- One `E_USER_NOT_REMOVABLE` for both active and deactivated. Rejected: FR-002 and FR-003 require
  two different reasons, and only the first has an action to point to.
- `422` for an ineligible status. Rejected: the request is well-formed and the conflict is with the
  target's state — the same reasoning `UserDeactivatedCannotChangeRoleException` records.

---

## D4 — A single guarded `DELETE` is the eligibility rule and the concurrency control

**Decision**: `UserRepository.removeNeverActivated(command): Promise<RemoveUserResult>`. The Lucid
implementation issues one statement —
`User.query().where('id', …).whereIn('accessStatus', ['PENDING', 'CANCELLED']).delete()` — and, on
zero affected rows, re-reads the row only to say which of `NOT_FOUND` and `NOT_REMOVABLE` (with the
status observed) applies.

**Rationale**: the shape `changeRole` and `deactivateActive` already use. A single-row conditional
statement is atomic on PostgreSQL and SQLite, so the `WHERE` clause *is* the guard: a user who became
active between the workbench listing them and the confirmation matches zero rows and is refused
against their current state (FR-005, US2 scenario 4). A read-then-delete would open exactly the
window that scenario forbids.

**How the races of the spec's edge cases resolve**, all on the target row's lock:

- two removals — the loser matches zero rows, re-reads nothing, and answers 404;
- a removal against a role change or an identity correction — whichever commits second sees the
  other's result: the removal still deletes a user whose role or name changed; the other write
  finds no row and answers its own 404 (`changeRole`'s `NOT_FOUND`, `findByIdForUpdate`'s `null`);
- a removal against a pending↔cancelled transition (GH-12, GH-13, once delivered) — both statuses
  match the guard, so the removal succeeds either way, as the spec requires;
- a removal against an acceptance (GH-8, once delivered) — acceptance moves the row to `ACTIVE`, so
  whichever lands first wins cleanly: the removal is refused as active, or the acceptance finds no
  user behind its link.

**One statement, in a transaction of its own**: the only other rows it touches are removed by the
schema's own `ON DELETE CASCADE` inside that statement (D5), so the transaction is not there for
atomicity. It is there for D6's refusal — *found during implementation, on PostgreSQL*: a failed
statement aborts whatever transaction it ran in. In production the wrapper holds nothing else, but
the suites run each test inside Lucid's global transaction, where `User.transaction()` nests as a
savepoint, so the refused delete rolls back alone instead of aborting the test's transaction; the
suites pass on PostgreSQL as well as on SQLite. The method takes no client and never joins a
caller's own transaction. The zero-row re-read is diagnostic, exactly as in `changeRole`.

**What the tests prove about races, and what they cannot**: the suites run on in-memory SQLite with
a single connection inside a global transaction, so two "concurrent" removals execute one after the
other. The tests therefore pin the *outcome* of each ordering — a second removal is a 404, a user
activated before the delete runs is refused — not the interleaving. The interleaving guarantee rests
on PostgreSQL's row lock: a `DELETE` blocked behind a concurrent write re-evaluates its `WHERE`
against the committed row before deleting, so it cannot remove a user that has just become active.

**Alternatives considered**:

- `SELECT … FOR UPDATE`, then delete. Rejected: it buys consistent reads of a *related* row, and this
  write reads none.
- A soft delete (`removed_at`) or a `REMOVED` status. Rejected by FR-012 and by `CONTEXT.md`, whose
  Pending User Removal is permanent and introduces no state — the same choice Planned Shift Removal
  records.

---

## D5 — What the one statement removes, and why nothing else moves

**Decision**: rely on the foreign keys the schema already declares. Every reference to `users.id`
falls in one of three groups:

| Reference | `ON DELETE` | What a removal does |
|---|---|---|
| `user_activation_tokens.user_id` | `CASCADE` | Deletes the user's activation link digest in the same statement — FR-007 |
| `remember_me_tokens.tokenable_id` | `CASCADE` | Nothing in practice: a never-activated user never signed in, so holds none |
| `shifts.responsible_user_id` | `RESTRICT` | Refuses the statement — surfaced as `REFERENCED` (D6) |
| `users.{invited,activated,cancelled,deactivated,reactivated,password_reset}_by_user_id`, and every site reference's `archived_by`, `reactivated_by`, `suspended_by`, `returned_to_service_by` | `SET NULL` | Unreachable: only an active user can act, so a never-activated user is never named as an actor |

**Rationale for the cascade on activation links**: `1785700000000_create_user_activation_tokens_table.ts`
chose a separate table precisely so "the invitation lifecycle slices [have] one row to replace or
delete". The link is stored as a digest looked up by `hash`; once the row is gone, a presented secret
matches nothing, which is how an unknown link already behaves — so FR-007's "exactly like a link
that never existed" holds for GH-8 without GH-8 doing anything special. SQLite enforces the cascade
too: `config/database.ts` turns `foreign_keys` on for every connection, which is what makes the
test suite (ADR 0014) a faithful witness.

**Rationale for leaving `SET NULL` unguarded**: those columns record who performed a lifecycle action
or an archival, and every such action is authorized for active users only. A never-activated user
therefore cannot appear in them, and FR-010 (no other user's lifecycle events altered) holds by that
invariant rather than by a check. Should a future slice let a non-active user act, it inherits this
note; a guard written today would be dead code with a test that has to forge an impossible row.

**No migration, no new column, no new table.** FR-012 resolved the trace question to "untraced",
which removes the only schema change this slice could have needed.

---

## D6 — A restricting reference is refused, not worked around

**Decision**: the Lucid implementation catches a foreign-key violation raised by the `DELETE` and
returns `{ kind: 'REFERENCED' }`, which the use case maps to
`E_USER_REFERENCED_CANNOT_BE_REMOVED`. A new helper `app/shared/database/is_foreign_key_violation.ts`
recognizes PostgreSQL `23503` and SQLite `SQLITE_CONSTRAINT_FOREIGNKEY`, next to — and in the shape
of — `is_unique_violation.ts`. *Found during implementation*: SQLite enforces `ON DELETE RESTRICT`
through an internal trigger and reports it as `SQLITE_CONSTRAINT_TRIGGER` with the message "FOREIGN
KEY constraint failed", so the helper also accepts that code, but only with that message, since a
user-defined `RAISE` shares the code.

**Rationale**: FR-011. `shifts.responsible_user_id` is the only `RESTRICT` reference today, and no
delivered write path assigns a shift responsible, so the refusal is unreachable through the product.
It is reachable through data, though (`ShiftFactory` takes any `responsibleUserId`), and an uncaught
violation would surface as a 500 — a failure presented as an infrastructure error rather than the
business refusal FR-011 asks for. Catching the database's own verdict, rather than pre-checking the
`shifts` table, means a future `RESTRICT` reference is covered the day its migration lands.

**Alternatives considered**: a `NOT EXISTS (SELECT 1 FROM shifts …)` clause in the guard. Rejected:
it duplicates what the schema already enforces and has to be edited for every new restricting table.

---

## D7 — The use case owns the refusals; its input carries no actor

**Decision**: `app/users/removal/remove_user_use_case.ts` with `RemoveUserInput = { id: string }`.
It calls the repository and maps `NOT_FOUND`, `NOT_REMOVABLE` (by the observed status), and
`REFERENCED` to the three exceptions of `app/users/removal/removal_exceptions.ts`; `REMOVED` returns
nothing.

**Rationale**: ADR 0013 — outcomes acquire business meaning in the use case. No actor is passed down
because FR-012 records none; a `removedByUserId` threaded through for nothing would suggest a trace
that does not exist. The validator (`remove_user_validator.ts`, `params.id` as a UUID) and the
exceptions live in the slice, as `password_reset` and `invite` keep theirs; `E_USER_NOT_FOUND` is
reused from `users/shared`.

---

## D8 — The web action is a second access action on the existing record and row menu

**Decision**: `UserAccessAction` grows from `'deactivate'` to `'deactivate' | 'remove'`.
`userAccessActions(viewer, user)` offers `remove` to an organization admin on a `PENDING` or
`CANCELLED` user other than themselves, and `deactivate` on an `ACTIVE` one, as today — so the two
are never offered together. `UserAccessDialog` picks its mutation by action. `useUserMutations`
gains `remove`, over `tuyauQuery.users.destroy`, refreshing the collection on success **and** on
error, like `deactivate`.

**Rationale**: `user-access-copy.ts` says it outright — "Keyed by action because the record gains
[a second action] next; a second action adds a key here, not a second dialog." The record footer
(`UserAccessActions`) and the row menu (`UserRowActions`) both ask `userAccessActions` and mount
`UserAccessDialog`, so the action appears in both places, gated by one rule, with one confirmation
(FR-016). It sits last in the row menu, as the destructive item always does.

**Copy**: labels `Remove` / `Removing…`, title `Remove user?`, success `User “Name” removed`, failure
`Unable to remove user “Name”`, all from the existing `resource-copy` shapes. The confirmation's
sentence is per action now (`describeUserAccessEffect` currently ignores its action): for a removal
it names the user and says the removal is permanent, takes the activation link with it, and frees the
email for a new invitation (FR-017). Each new refusal code gets its second-person reason; the 404
reuses "This user no longer exists."

**What closes the record** (FR-018): nothing new. `UsersPage` already derives the open record from
the refreshed collection and closes it once its user is no longer visible; a removed user is visible
nowhere. A refusal because the user became active does the same — they leave the pending view — and
the reason arrives as a toast, which is the behaviour `UserAccessDialog`'s comment already documents
for deactivation (FR-020).

**Alternatives considered**:

- A typed confirmation. Rejected in the spec's clarifications (FR-017).
- A separate `RemoveUserDialog` like `ResetPasswordDialog`. Rejected: the password reset stands apart
  because it changes a credential rather than access; a removal is an access action and shares every
  sentence shape of `user-access-copy.ts`.

---

## D9 — Verification seams

| Requirement | Seam |
|---|---|
| FR-001, FR-005, FR-006, FR-007, FR-009, FR-010, FR-011, FR-012 | `apps/api/tests/unit/users/removal/remove.spec.ts` — eligibility per access status, the activation token gone, no other row changed, the restricting shift, concurrent removals |
| FR-002, FR-003, FR-004, FR-008, FR-013, FR-015 | `apps/api/tests/integration/users/removal/remove.spec.ts` — unauthenticated, each unauthorized role, non-active session, identical 403 for four kinds of id, malformed id, unknown id, each refusal, self-removal, `204`, then a re-invitation of the same email with different casing |
| FR-016, FR-017, FR-018 | `apps/web/src/features/users/__tests__/removal/journey.test.tsx`, `row-menu.test.tsx` |
| FR-014 | `…/__tests__/removal/permissions.test.tsx` |
| FR-019, FR-020 | `…/__tests__/removal/refusals.test.tsx`, `recovery.test.tsx` |
| FR-021 | review: the diff adds no other command |

No end-to-end journey: `apps/web/e2e` does not exist in this repository.

**Test data**: `UserFactory` already has `invited`, `cancelled`, `active`, and `deactivated` states,
and `UserActivationTokenFactory` and `ShiftFactory` exist. No factory change is needed.
