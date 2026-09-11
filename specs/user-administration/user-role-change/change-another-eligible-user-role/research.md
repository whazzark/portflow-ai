# Phase 0 — Outline & Research: Change Another Eligible User Role

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-10

The spec carries no open `[NEEDS CLARIFICATION]` marker: FR-016 (no role change history) and FR-017
(pending and cancelled eligible, activation link untouched) were resolved before planning. What
follows is therefore design research only — where each decision lands in the existing architecture,
and what was rejected.

Every decision below was taken against the code as it stands, not against the pre-migration backlog:
`apps/api/app/users/` currently holds a list use case, a policy, a repository pair, and a
transformer, and nothing that writes a user apart from `renewPassword`.

**Revised 2026-09-11**: GH-24 (#293) landed an `Edit` panel under the same `mode=edit` first, so the
role joined that panel instead of opening its own. D9 is replaced; its first decision keeps its
reasoning below.

---

## D1 — The command is `PATCH /api/v1/users/:id/role`

**Decision**: one endpoint, `PATCH /api/v1/users/:id/role`, body `{ "role": "<USER_ROLE>" }`,
returning the updated user in the administration projection.

**Rationale**: the repository has two established shapes for a write. A field update is
`PATCH /:id` (`trucks.update`, `docks.update`, `customers.update`); a parameterless state transition
is `POST /:id/<action>` (`trucks.suspend`, `trucks.returnToService`, `trucks.archive`). A role change
is the first: the client supplies the destination value, and submitting the role a user already holds
must succeed unchanged (FR-006), which is exactly a `PATCH`'s idempotence.

The `/role` sub-path, rather than a `role` field on `PATCH /users/:id`, is what keeps this slice from
colliding with GH-24 (Update Another User Identity). That slice will own `PATCH /users/:id` for first
name, last name, and email, and its eligibility rules are not these: identity is editable where a
role may not be, and a pending user's email touches the activation link where a role does not. Two
authorization decisions on one endpoint would have to be untangled later; two endpoints never tangle.

**Alternatives considered**:

- `POST /api/v1/users/:id/change-role`, mirroring `trucks.suspend`. Rejected: suspension carries no
  destination value and is not idempotent — a second suspend is refused, where a second identical
  role change must succeed. The truck idiom answers a different question.
- `PATCH /api/v1/users/:id` with an optional `role`. Rejected for the GH-24 collision above.
- `PUT /api/v1/users/:id/role`. Rejected: no `PUT` exists anywhere in `start/routes.ts`, and the
  resource being replaced is a scalar, not a document.

---

## D2 — The policy answers "may this viewer change roles at all", nothing about the target

**Decision**: add `UserPolicy.changeRole(user)` returning
`user.accessStatus === 'ACTIVE' && user.role === 'ORGANIZATION_ADMIN'`. Whether the *target* user is
eligible is decided further in, by the repository's conditional write (D4).

**Rationale**: this is the split `UserPolicy.list` already documents in its own comment — the policy
owns "may this viewer act", the use case and repository own "on what". It also keeps `changeRole`
deliberately narrower than `list`: an operations admin may consult active users (FR-002 of GH-4) and
may not change any role (FR-007 here). Two rules, two methods, no shared helper that would have to
grow a parameter the day they diverge further.

**Rationale for the `accessStatus === 'ACTIVE'` clause**: it is redundant today, since GH-3 refuses a
session to every non-active user, and it is kept anyway — `list` carries the same belt-and-braces
clause, and FR-007 names the non-active session explicitly as a case that must be denied.

**Alternatives considered**:

- Reusing `list` as the authorization for the write. Rejected: it would hand an operations admin the
  ability to promote themselves to organization admin, the exact defect US3 exists to prevent.
- A single `administerUsers` ability covering every future write slice. Rejected as premature: GH-24
  and the deactivation slices have different actor rules, and Bouncer policies are cheap.

---

## D3 — Non-disclosure is structural, not a message-shaping exercise

**Decision**: authorize before reading the target. The refusal taxonomy is:

| Situation | Outcome |
|---|---|
| No session, or non-active session | 401 from the auth middleware |
| Session whose role is not organization admin | 403 from `UserPolicy.changeRole`, target never read |
| Role value outside the four | 422 from the VineJS enum |
| No user with that id | 404 `E_USER_NOT_FOUND` |
| Target is deactivated | 409 `E_USER_DEACTIVATED_CANNOT_CHANGE_ROLE` |

**Rationale**: FR-009 says a refusal must not disclose the existence or access status of a user the
caller may not consult. The only viewer who ever reaches a target lookup is an organization admin,
who may consult every user in every status — so the 404/409 distinction leaks nothing. Every other
viewer is stopped by the policy before a single row is read, and receives the same 403 whether the id
names a pending user, a deactivated user, or nobody at all. Non-disclosure is a property of the
ordering, which a test can pin, rather than of carefully vague messages, which drift.

**Rationale for 409 over 422 on the deactivated case**: it is a state conflict, not a malformed
request, and `TruckArchivedCannotSuspendException` — the same shape of refusal, naming the action
that would unblock it — is already a 409.

**Alternatives considered**:

- Returning 404 for a deactivated user to reveal less. Rejected: the caller is entitled to know, and
  FR-003 requires the refusal to state that the user must be reactivated first.
- Validating the role against a runtime lookup rather than the `USER_ROLES` tuple. Rejected: the
  tuple is already the model's source of truth and gives the validator its literal union for free.

---

## D4 — The conditional `UPDATE` is the concurrency control

**Decision**: `UserRepository.changeRole(command): Promise<ChangeUserRoleResult>` with
`kind: 'CHANGED' | 'NOT_FOUND' | 'DEACTIVATED'`. The Lucid implementation issues a single guarded
statement — `where('id', …).whereNot('accessStatus', 'DEACTIVATED').update({ role, updatedAt })` —
and, on zero affected rows, re-reads the row to say which of `NOT_FOUND` and `DEACTIVATED` applies.

**Rationale**: this is `renewPassword`'s shape, and its comment already argues the point — a
single-row conditional `UPDATE` is atomic on both PostgreSQL and SQLite, so the `WHERE` clause *is*
the guard. A read-then-write would let a deactivation land between the eligibility check and the
write, producing exactly the "refused against the state that was displayed" defect US2 scenario 4
forbids.

No transaction wraps it. `renewPassword` needs one because recording the password and revoking the
remembered connections must not be separable, and `suspendAvailable` needs one because it reads a
related row inside the write. Here there is one statement and no second row; the re-read on the
zero-row path is diagnostic only, and a target that changed again before it runs is reported as its
newest state, which is the honest answer either way.

**The idempotent case falls out for free**: submitting the role a user already holds still matches
the guard, so PostgreSQL reports one affected row and the outcome is `CHANGED` — success, unchanged
row, no failure (FR-006). Because FR-016 keeps no history, there is nothing that would spuriously
record a change that did not happen.

**`updatedAt` is written by hand**, as every other guarded write in this codebase does: the query
builder's `.update()` bypasses the model's `autoUpdate` hook.

**Alternatives considered**:

- `SELECT … FOR UPDATE` then update, like `suspendAvailable`. Rejected: that pattern buys the ability
  to read a *related* row consistently, which this write does not do. `renewPassword`'s comment
  already draws the line.
- Returning the affected-row count to the use case and letting it re-read. Rejected: AGENTS.md puts
  conditional writes and their typed outcomes in the repository, and HTTP-aware exception selection
  in the use case.

---

## D5 — No migration, no new column, no new table

**Decision**: `users` is untouched. The slice changes one existing column's value.

**Rationale**: FR-016 resolved the traceability question to "untraced". That single answer is what
removes a migration, a model change, a transformer change, a new section on the access record, and
the tests for all four. It is worth recording plainly that this is a deliberate trade, not an
oversight: after this ships, nothing in the system can answer "who made this person an organization
admin, and when". Should that become a requirement, it is a separate slice, and it will only ever be
able to answer the question for changes made after it ships.

**Alternatives considered**: recording `role_changed_at` / `role_changed_by_user_id`, or a
`user_role_changes` table. Both were live options at spec time and were declined there.

---

## D6 — The write touches `role` and `updated_at`, and provably nothing else

**Decision**: the `update()` payload is exactly `{ role, updatedAt }`, and a unit test asserts the
full row before and after.

**Rationale**: FR-005 lists what must not move — access status, lifecycle dates and actors, identity,
email, credentials, password renewal requirement — and FR-017 adds the pending user's invitation.
The last one is free here in a way that will not stay free: there are no activation link columns yet
(`1783663779445_create_users_table.ts` has none), so this slice cannot touch a link even by accident.
When the invitation slice adds them, it inherits the obligation to reissue on a role change, which is
recorded in the spec's traceability rather than in code that does not exist.

---

## D7 — The response carries the updated user in the administration projection

**Decision**: return `UserTransformer.transform(user, { includeAccessHistory: true })` under
`toAdministration`, the same variant `users.index` returns for an organization admin. The repository
re-reads the row with the five lifecycle-actor preloads before returning it.

**Rationale**: the caller of this endpoint is always an organization admin (D2), which is exactly the
viewer `includeAccessHistory: true` is for, so the row comes back in the shape the workbench already
knows how to render — no second DTO, no second mapper on the web side. Every other write in the
codebase returns its transformed row, and matching that keeps the Tuyau registry uniform.

**Alternatives considered**:

- `204 No Content`, letting the web invalidate and refetch. Rejected: it would make the endpoint's
  own tests assert on a follow-up read rather than on the write's result, and it breaks the house
  pattern for no gain — the web invalidates anyway (D9).
- Returning the bare `{ id, role }`. Rejected: a partial DTO in the registry that resembles the full
  one is a trap for the next consumer.

---

## D8 — FR-010 and FR-011 need verification, not code

**Decision**: build nothing for "the new role takes effect immediately". Cover it with tests.

**Rationale**: Bouncer resolves the policy against the user loaded from the database on every
request, so the moment the row changes, every subsequent request is judged by the new role — on every
browser at once, with no session revocation, which is precisely FR-010. FR-011 is already satisfied
too: `UserTransformer.toObject()` serializes `role`, and that is what `auth.me` returns. On the web,
`SessionProvider` holds `auth.me` in a React Query with `retry: false` and no `staleTime`, so it is
stale immediately and refetches on mount and on window focus; the sidebar and route guards follow.

This is worth stating explicitly because it looks like missing work. US4's four scenarios are real
acceptance criteria and get real tests — an integration test that changes a role and then exercises
the target's session against an endpoint their old role allowed, and a web test that re-renders after
`auth.me` reports the new role. What they must not produce is a session-invalidation mechanism the
architecture does not need.

**Alternatives considered**: revoking the target's sessions or remembered connections on a role
change. Rejected: FR-010 forbids signing them out, and there is no security argument for it once
authorization is re-evaluated per request.

---

## D9 — The web action is an `edit` mode on the existing `/users` route

> **Replaced 2026-09-11 — folded into GH-24's `Edit` panel.** #293 delivered the identity correction
> under `mode=edit` before this slice merged, and `apps/web/AGENTS.md` gives the mode `view | edit |
> create` only, so a second panel would have needed a mode value outside the convention. The role is
> now a `SelectField` of that panel (`EditUserForm`), and the record keeps no `Change role` action.
> Saving sends each seam only what changed — the identity to `PATCH /users/:id`, the role to
> `PATCH /users/:id/role`, sequentially, so a role refused after the identity landed is retried alone.
> On a deactivated user the role is shown read-only with the reason, inside the panel. The toasts are
> the panel's `update` ones. The URL-state, gating, and invalidation reasoning below still holds.
>
> *Alternatives considered at the revision*: a dedicated mode value (`mode=role`) — rejected by the
> product owner in favour of a single `Edit` per record, at the cost of up to two requests per save.

**Decision (as first taken)**: the role change is a panel inside the user sheet the workbench already opens, driven by
a `mode` search parameter alongside the existing `userId`. `mode=edit` opens the form; anything else,
or an ineligible target, or a viewer who is not an organization admin, opens the read-only record.

**Rationale**: `apps/web/AGENTS.md` is explicit — anything a user can be halfway through lives in the
URL, the open record is `<resource>Id`, and the mode is `mode` on a route carrying one resource. It
also states the gating rule this needs: gating a mode in the component keeps the interface honest, so
a hand-typed `?mode=edit` opens nothing it should not, while the API stays authoritative. The panel
is left through the header's "Back to details", as every other edit panel is.

The form is `useAppForm` with a `SelectField` over the four roles — the same conventions file calls a
`Select` the right control "for a secondary facet such as a role" — plus `form.FormError`,
`form.SubmitButton`, and `applyValidationError` / `parseApiError` on the failure path, exactly as
`customer-form.tsx` does. Toast copy is built from the shared `refusalTitle` / `confirmationMessage`
helpers: the feature brings the noun and the verb, never its own phrasing.

**Invalidation**: `useUserMutations` invalidates `userQueries.list()` on success, which is what makes
the new role appear in the table, the record, and the role filter's counts (FR-014). It also
invalidates `auth.me`, so that an administrator who changed *their own* role sees their navigation
follow. That self case is GH-29's to refuse; until it lands, leaving the session cache stale would be
a second defect on top of the first, and the invalidation is one line.

**Alternatives considered**:

- A confirmation dialog like the lifecycle actions. Rejected: those transitions take no value; this
  one needs a control to pick a destination role, which is a form.
- Holding the open form in `useState`. Rejected outright by the routing convention.
- A separate `/users/:id/role` route. Rejected: the record is a sheet over the collection, and GH-4
  deliberately introduced no per-user consultation seam.

---

## D10 — Verification seams

| Requirement | Seam |
|---|---|
| FR-001, FR-002, FR-003, FR-005, FR-006, FR-016 | `apps/api/tests/unit/users/role_change/change_role.spec.ts` — eligibility per access status, idempotent resubmit, full-row comparison, concurrent changes |
| FR-004, FR-007, FR-008, FR-009 | `apps/api/tests/integration/users/role_change/change_role.spec.ts` — unauthenticated, each unauthorized role, non-active session, invalid role, unknown id, deactivated target, success payload |
| FR-010, FR-011 | integration: change a role, then exercise the target's own session and `auth.me` |
| FR-012, FR-013, FR-014, FR-015 | `apps/web/src/features/users/__tests__/role-change/` — change (including which seam each save reaches), permissions, refusals, recovery |

No end-to-end journey is added: `apps/web/e2e` does not exist in this repository.

**Test data**: `UserFactory` already has `active`, `invited`, `deactivated`, and `cancelled` states,
so every eligibility case is one `apply()` away. No factory change is needed.
