# Phase 0 Research: Reset an Active User Password

**Feature**: `GH-17` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

The Technical Context in [plan.md](./plan.md) carries no `NEEDS CLARIFICATION`: the stack, the
storage, the test seams, and the two behavioural questions were all settled before planning — the
stack by the existing monorepo, the behaviour by the spec's resolved clarifications CLR-001 and
CLR-002. What follows is therefore the design research the plan depends on: where the slice belongs,
how the state is persisted, how the write stays atomic, and how the refusals are shaped.

## R1 — Where the slice lives

**Decision**: `apps/api/app/users/password_reset/`, exposed as `POST /api/v1/users/:id/password-reset`
(Tuyau name `users.password_reset`), authorized by a new `resetPassword` method on the existing
`UserPolicy`, served by a new `resetPassword` action on `UsersController`.

**Rationale**: The existing split is by *whose* credentials are acted on, not by subject matter.
`app/auth/` holds login, logout, and the renewal — everything the session owner does to their own
access. `app/users/` holds what an administrator does to somebody else's, and already owns
`UserPolicy`, `UserRepository`, and `UserTransformer`. A reset is unambiguously the second kind. The
route also has to hang off `/users/:id` for the target to be addressable, and `/api/v1/users`
currently declares only `index`, so adding `POST /:id/password-reset` introduces none of the
ordering hazards the warehouse and dock routes carry (`/archive` before `/:id/archive`).

**Alternatives considered**:

- `app/auth/password_reset/`, next to `password_renewal/`. Rejected: it would put an administrative
  command behind the module that exists for the session owner's own credentials, and would have
  `UsersController` and an auth controller both writing the same rows.
- A dedicated `PasswordResetController`. Rejected: the repository, the policy, and the transformer
  are all the users slice's, and every other action on a resource in this codebase lives on that
  resource's controller.

## R2 — How the reset is persisted

**Decision**: add `password_reset_at` (nullable timestamp) and `password_reset_by_user_id` (nullable
FK to `users`) to the `users` table. The reset writes those two **and** sets
`password_renewal_required_at`. A completed renewal keeps clearing only
`password_renewal_required_at`, so the reset survives as a historical event.

**Rationale**: `1785500000000_add_user_password_renewal.ts` deliberately shipped
`password_renewal_required_at` with no actor column, stating that "the actor belongs to whichever
action records it — Reset an Active User Password (`#17`) or Reactivate a User with Fresh
Credentials (`#32`)". Giving each producing action its own dated, attributed event is what that note
asks for, and it is the shape every other lifecycle event on this table already has
(`invited_at`/`invited_by_user_id`, `deactivated_at`/`deactivated_by_user_id`, …). It keeps the
requirement itself a single enforcement state with exactly one writer per transition, which is what
makes FR-011 and FR-012 trivially true: a second reset overwrites the event columns and leaves one
requirement standing. It also lets `#32` land later by writing `reactivated_at`/`reactivated_by` plus
the same requirement, with no change to this slice.

**Alternatives considered**:

- **Add only `password_reset_by_user_id` and read the date off `password_renewal_required_at`.**
  Rejected: it makes the reset event vanish the moment the user renews, so the access record could
  never answer "who reset this user, and when" after the fact, and FR-003's record would be as
  short-lived as the requirement. It also breaks down as soon as `#32` exists — the same date column
  would be claimed by two different actors.
- **A separate `user_password_resets` history table.** Rejected: no requirement in the spec reads
  more than the most recent reset, `#4`'s access record is built from columns on `users`, and a
  table would be the second source of truth constitution VI forbids. If a full administrative audit
  trail is ever wanted, `Transversal Discharge Activity Log` (`#101`) is where it belongs.
- **Reuse `deactivated_*`/`reactivated_*` columns.** Rejected outright: a reset changes no access
  status, and overloading those columns would corrupt the access history `#4` presents.

## R3 — Presenting the requirement and the reset

**Decision**: the DTO carries two independent things — a `passwordRenewalRequired` boolean (derived
from `password_renewal_required_at !== null`) and a `passwordResetAt` / `passwordResetBy` pair
presented as one more entry in the access history. Both are gated on the transformer's existing
`includeAccessHistory` option.

**Rationale**: FR-019 asks the record to present the outstanding requirement with its date and
responsible administrator. Deriving that pair from a single origin column would misattribute the
requirement the moment `#32` can also record it — a user reset in March, renewed, then reactivated in
June would be shown as "owing a renewal since March, by the March administrator". Keeping the state
and the event separate is accurate in every combination, and the existing `UserAccessHistory`
component already renders exactly this shape: it filters on a date being present and orders
chronologically, so the reset drops in as a sixth event with no structural change.

Gating both on `includeAccessHistory` follows the rule `#4` established and the reasoning
`user_transformer.ts` already carries for `password_renewal_required_at`: the fact that an
administrator acted on a user is the same class of information as the identity of a responsible
administrator, and an operations admin may not consult it. FR-020's "let an organization admin tell,
without opening a user" is satisfied without widening the audience.

**Alternatives considered**:

- Serialize `password_renewal_required_at` itself. Rejected: the existing transformer comment
  refuses it deliberately — the raw timestamp says *when an administrator acted*, and the session
  representation needs one bit to choose a route. That reasoning still holds; the administrative
  projection gets the date through the reset event instead, where it is correctly attributed.
- Expose the outstanding flag to operations admins. Rejected: it discloses administrative activity
  to a viewer `#4` restricts, for no requirement.

## R4 — Making the write atomic and the concurrency unambiguous

**Decision**: one repository method, `requirePasswordRenewal`, running inside `User.transaction`: a
`SELECT … FOR UPDATE` to classify the target, a guarded
`UPDATE … WHERE id = ? AND access_status = 'ACTIVE'`, then a delete of every
`remember_me_tokens` row for that user. It returns a discriminated result
(`RESET` | `NOT_FOUND` | `NOT_ACTIVE`) that the use case turns into exceptions.

**Rationale**: This is `renewPassword`'s shape, one row over, and for the same two reasons its own
comment gives. The guard, not a lock, is the concurrency control — a single-row conditional `UPDATE`
is atomic on both PostgreSQL and SQLite — and the transaction exists because recording the
requirement and revoking the connections must not be separable: a revocation that failed after the
update committed would leave a user owing a renewal whose old remembered connections still restore
access, which is the partial state FR-013 forbids. The `forUpdate()` read before the update is the
truck-lifecycle pattern (`suspendAvailable`), and it is what lets a zero-row update be classified as
"unknown user" versus "status changed underneath us" rather than collapsing both into one refusal;
knex emits no `FOR UPDATE` on SQLite, so the re-read on the zero-row branch is required there too.

Revocation deletes **every** token for the user, with no exception — unlike `renewPassword`, which
spares the connection the renewal was performed from. The administrator is not the target, so there
is no connection to spare, and sparing one would be the hole the reset exists to close.

Deleting through the query builder rather than the `RememberMeToken` model follows the existing note
in `lucid_user_repository.ts`: the guard's token provider writes those rows in a shape the model's
date columns refuse to hydrate.

**Alternatives considered**:

- Revoke through `User.rememberMeTokens.delete()` per token. Rejected: N statements where one
  `DELETE … WHERE tokenable_id = ?` does, and it would leave the revocation outside the transaction
  unless threaded through by hand.
- Skip the `forUpdate()` read and report every zero-row update identically. Rejected: FR-006 wants a
  refusal naming the current access status, and FR-014 wants the refusals distinguishable.

## R5 — Refusal shapes

**Decision**:

| Refusal | Status | Code | Owner |
|---|---|---|---|
| Not authenticated | `401` | `E_UNAUTHORIZED_ACCESS` | existing auth middleware |
| Requester owes their own renewal | `403` | `E_PASSWORD_RENEWAL_REQUIRED` | existing renewal middleware |
| Requester is not an organization admin | `403` | `E_AUTHORIZATION_FAILURE` | `UserPolicy.resetPassword` |
| Target does not exist | `404` | `E_USER_NOT_FOUND` | use case |
| Target is not active | `409` | `E_USER_NOT_ACTIVE` | use case |
| Target is the requester | `422` | `E_USER_PASSWORD_RESET_SELF` | use case |

**Rationale**: The `409`/`422` split is the one `password_renewal_exceptions.ts` already documents —
`409` for a lifecycle conflict, `422` for a refusal about the submitted value rather than the state
of the world — and a self-reset is a refusal about which target was named. `403` rather than `401`
for the confined requester is inherited from the existing middleware, and matters for the same
reason it states: the web's `isUnauthorizedError` matches only `401`, and a `401` would sign the
requester out of the session they need.

`/users/:id/password-reset` needs no request body, so no validator is added. Every VineJS validator
in this codebase exists to shape a payload; there is nothing here to shape, and an empty schema would
be ceremony.

**On FR-008's cross-organization clause**: ADR 0003 keeps the MVP single-site without tenant
isolation — "repositories should not accept site, tenant, or operating organization scope arguments"
— and there is no organization column on `users`. The clause is therefore vacuous today and reduces
to the unknown-identifier case, answered by `404`. Distinguishing `404` from `409` discloses nothing
to this requester: an organization admin may already consult every user and every access status
through `#4`.

## R6 — The workbench

**Decision**: extend `features/users`. A new `use-user-mutations.ts` wraps
`tuyauQuery.users.passwordReset` and invalidates `userQueries.list()` on success; a new
`reset-password-confirmation.tsx` built on the existing `AlertDialog` primitive names the user and
states the consequence; `user-access-record.tsx` gains the action and the outstanding-renewal
indicator; `user-access-history.tsx` gains the reset event; `user-table.tsx` gains the collection
indicator. A new `helpers/user-permissions.ts` holds the visibility rule — organization admin,
active target, not oneself — mirroring the API's.

**Rationale**: This is the shape every write action in this codebase already has: a mutations hook
owning invalidation, a confirmation component owning the copy, and a feature-local permission helper
driving visibility while the API stays authoritative (ADR 0008, constitution V). Invalidating the
single existing collection query is all FR-018 needs, because `#4` deliberately built the access
record as a view over the retrieved collection with no per-user read seam — refreshing the collection
refreshes the open record for free.

The lifecycle components under `components/lifecycle/` are deliberately **not** reused: their
`LifecycleAction` union, copy tables, and comment field are the site-reference archive/reactivate
vocabulary, and a password reset is neither an archival nor a state a user returns from. A dedicated
confirmation is smaller than widening a shared abstraction for one caller.

The action reads `Reset password` — the action alone, matching the convention `lifecycle-copy.ts`
states: the pane it sits in already names the user.

**Alternatives considered**:

- Add a `passwordReset` member to `LifecycleAction` and reuse `ResourceLifecycleDialog`. Rejected:
  it would drag comment capture, past participles, and blocker vocabulary into a feature that has
  none of them, and would couple user administration to the site-reference lifecycle wording.
- A per-user read after the mutation. Rejected: `#4` has no such seam and FR-006a of that spec
  forbids introducing one.

## R7 — Migration mechanics

**Decision**: `1785800000000_add_user_password_reset.ts`, `static disableTransactions = true`, with a
dialect branch in `down()` toggling `PRAGMA foreign_keys` around the SQLite rebuild — the treatment
`1785500000000_add_user_password_renewal.ts` and `1785400000000_add_truck_return_to_service.ts`
already document.

**Rationale**: This becomes the newest migration in the repository, so its `down()` runs while the
whole schema is still standing — exactly the exposure the `#117` migration's comment describes. It is
in fact more exposed: `password_reset_by_user_id` carries a real foreign key to `users`, so both the
column's own constraint and knex's table-rebuild `DROP TABLE users` are refused with enforcement on.

**Corrected during implementation**: `up()` needs the dialect branch too, not only `down()`. On
SQLite, knex implements *any* added column carrying a `REFERENCES` clause by rebuilding the whole
table, so the added column is as exposed as the dropped one. `#117`'s migration gets away with a
plain `up()` only because its single column carries no foreign key;
`1785400000000_add_truck_return_to_service.ts` is the precedent that actually matches this one, and
it branches in both directions. The delivered migration follows it.

`apps/api/database/schema.ts` is generated from the migrated schema and must be regenerated after the
migration runs, not hand-edited.
