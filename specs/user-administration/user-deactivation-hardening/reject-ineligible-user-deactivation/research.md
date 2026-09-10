# Phase 0 Research: Reject Ineligible User Deactivation

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-10

No `NEEDS CLARIFICATION` marker remained in the specification: FR-009 was resolved before planning —
an organization admin may not deactivate their own access. The research below records the design
decisions the plan rests on, each taken against the existing code and the repository's conventions.

## D1 — Where each refusal is decided

**Decision**: `UserPolicy.deactivate` answers *may this viewer deactivate users at all* — an active
viewer whose role is `ORGANIZATION_ADMIN`, and nothing more. `DeactivateUserUseCase` answers *may
this viewer deactivate **this** user*: it owns the `SELF` rule and the four access-status rules, and
throws a named domain exception for each.

**Rationale**: `apps/api/AGENTS.md` gives policies authorization and use cases business decisions,
and `UserPolicy.list` already documents this exact split in its own comment — "Whether the viewer may
consult the organization's users at all. Which users they may then see is a separate decision, owned
by `ListUsersUseCase`." The spec's requirement is decisive on its own: FR-017 demands that
`PENDING_INVITATION`, `CANCELLED_INVITATION`, `ALREADY_DEACTIVATED`, `NOT_FOUND`, and `SELF` be
distinguishable in the outcome. Bouncer denials all surface as one `E_AUTHORIZATION_FAILURE`, so a
rule expressed in the policy is a rule the administrator cannot be told about.

**Alternatives considered**:

- *A `deactivate(viewer, target)` policy carrying every rule*: rejected — it collapses five
  distinguishable business outcomes into a single 403 with no reason, and it would make an
  already-deactivated user look like a permission problem.
- *Putting the `SELF` rule in the controller*: rejected — it is a business rule about who a
  deactivation may target, not HTTP adaptation, and it would escape the unit-test seam where every
  other eligibility rule is proved.

## D2 — The HTTP shape of each outcome

**Decision**: One named exception per refusal in a new `app/users/shared/user_exceptions.ts`:

| Exception | Status | Code |
|---|---|---|
| `UserNotFoundException` | 404 | `E_USER_NOT_FOUND` |
| `UserPendingInvitationException` | 409 | `E_USER_PENDING_INVITATION` |
| `UserCancelledInvitationException` | 409 | `E_USER_CANCELLED_INVITATION` |
| `UserAlreadyDeactivatedException` | 409 | `E_USER_ALREADY_DEACTIVATED` |
| `SelfDeactivationException` | 409 | `E_USER_SELF_DEACTIVATION` |

**Rationale**: This is the shape every delivered lifecycle slice already uses — compare
`dock_exceptions.ts`, where "not found" is a 404 and every eligibility refusal is a 409 carrying its
own code. `HttpExceptionHandler` already renders any `Exception` into the `{ error: { code, message } }`
envelope and already lists 404 and 409 among the statuses it does not report, so no handler change is
needed.

`SELF` is a 409 and not a 403 deliberately. The acting administrator *is* entitled to deactivate
users; what is refused is this particular target. A 403 would land in the same bucket the web already
treats as "you may not be here", and would make the one refusal an administrator is most likely to
trigger by accident read as a permissions failure.

**Alternatives considered**:

- *A single `E_USER_NOT_DEACTIVATABLE` with a `reason` in `meta`*: rejected — the handler does
  support a `meta` passthrough, but every sibling slice discriminates on `error.code`, and the web's
  `parseApiError` is built around that. One shape for the whole codebase beats a second convention
  here.
- *422 for the status refusals*: rejected — the request is well-formed; the conflict is with the
  stored state. 409 is what the rest of the codebase reserves for exactly that.

## D3 — The guarded write is the concurrency control

**Decision**: `UserRepository.deactivateActive()` performs a single conditional update —
`UPDATE users SET access_status = 'DEACTIVATED', deactivated_at = ?, deactivated_by_user_id = ?,
updated_at = ? WHERE id = ? AND access_status = 'ACTIVE'` — and returns a typed
`DeactivateUserResult`: `{ kind: 'DEACTIVATED', user }`, `{ kind: 'NOT_FOUND' }`, or
`{ kind: 'NOT_ACTIVE', accessStatus }`. The use case maps `NOT_ACTIVE` onto the right exception by
reading the status back.

**Rationale**: A single-row conditional `UPDATE` is atomic on both PostgreSQL and SQLite, so two
racing deactivations of the same user produce exactly one affected row; the loser matches zero and
resolves as `ALREADY_DEACTIVATED` (FR-018). This is the mechanism `LucidUserRepository.renewPassword`
already uses and documents at length, for the same reason, on the same table. It also means the
pre-flight read the use case performs is a courtesy for the error message, never the decision: the
`WHERE` clause is what actually settles the race, so the check-then-act window is closed.

API ADR-0013 settles the shape: repositories "own the transaction, locking, and conditional write
needed to make one such operation atomic under concurrency", conditional mutations "return explicit
typed outcomes when their failure has multiple meanings", and repositories must not raise business
exceptions. It names `NOT_ACTIVE` among its example outcomes, and fixes the naming this slice uses —
`DeactivateUserInput` for the use case, `DeactivateUserCommand` for the repository,
`DeactivateUserResult` for the outcome, kept as separate types even where their fields coincide.

**Alternatives considered**:

- *`SELECT … FOR UPDATE` then update*: rejected — `renewPassword`'s own comment draws the line: the
  truck lifecycle writes take a row lock because they must read a *related* row inside the same
  transaction. There is no second row to read here.
- *Trusting the use case's pre-flight read*: rejected — it leaves a check-then-act window that
  FR-018 explicitly forbids.

## D4 — Remembered connections are revoked in the same transaction

**Decision**: The guarded update and `DELETE FROM remember_me_tokens WHERE tokenable_id = :id` run
inside one `User.transaction`, and the delete is reached only on a successful deactivation.

**Rationale**: FR-013 requires that no remembered connection outlive the deactivation. The session
store is the **cookie** store (`config/session.ts`), so there is no server-side session registry to
purge; `auth_middleware.ts` already re-reads the user on every request and refuses anyone whose
`accessStatus` is not `ACTIVE`, which is what actually cuts a live session. That check alone would
technically satisfy FR-013 — but leaving the tokens in place would keep a credential valid for its
full 30 days against any future code path that trusts a token before re-reading the user.

`renewPassword` already made this call, in the same repository, with the same reasoning: the
transaction "is there because recording the password and revoking the other remembered connections
are two statements that must not be separable". Deactivation is the same shape, minus the exception
for the current request's own connection — a deactivated user keeps nothing.

**Alternatives considered**:

- *Rely on `auth_middleware` alone*: rejected — correct today, fragile tomorrow, and it leaves live
  credentials in the database for a user who has been told they have no access.
- *Revoke in the use case, after the repository call*: rejected — two separable statements, so a
  failure between them leaves the partial change FR-019 forbids.

## D5 — A malformed identifier is rejected before the database is touched

**Decision**: `deactivate_user_validator.ts` declares `vine.create({ id: vine.string().uuid() })`,
and the controller runs it against the route parameters:
`await request.validateUsing(deactivateUserValidator, { data: params })`. A malformed identifier is
therefore a 422 `E_VALIDATION_ERROR`, distinct from the 404 a well-formed unknown identifier gets.

**Rationale**: `users.id` is a real `uuid` column. Handing PostgreSQL a non-UUID string in a `WHERE`
clause raises `22P02 invalid input syntax for type uuid`, which the handler turns into a 500 — a
failure that never appears in the SQLite-backed test suites and only bites in production. FR-008
requires the request be "rejected before any user is evaluated or changed", and validation at the
controller is exactly that. `request.validateUsing` accepts a `data` option in AdonisJS 7, and
`vine.string().uuid()` is already the rule the bulk lifecycle validators use for identifiers.

Note that AdonisJS 7 has no `router.matchers`, so the route-level `.where('id', matchers.uuid())`
used in AdonisJS 6 codebases is not available here.

**Alternatives considered**:

- *Normalize in the use case and answer `NOT_FOUND`*: rejected — it collapses FR-007 and FR-008 into
  one outcome and reports a malformed client request as a business refusal, hiding a caller bug.
- *Leave it unvalidated, as the sibling site-reference slices do*: rejected — those slices carry the
  same latent 500, and this spec names the requirement explicitly. Retrofitting the others is out of
  scope for this issue.

## D6 — What the endpoint returns

**Decision**: `200` with the deactivated user in the existing `toAdministration()` projection,
`includeAccessHistory: true`.

**Rationale**: The only actor who can reach this endpoint is an organization admin, and that is
precisely the viewer for whom `GET /api/v1/users` already includes the lifecycle block. Returning the
same shape means the response is a drop-in for the entry the workbench already holds, and the newly
written `deactivatedAt` / `deactivatedBy` arrive resolved. It matches the single-record lifecycle
endpoints on the site references, which all return the transformed record.

**Alternatives considered**:

- *`204 No Content`*: rejected — the web would have to refetch to learn the recorded date and actor,
  and the response would carry no evidence of what was written.
- *A new bespoke projection*: rejected — a second shape for the same entity, for no new information.

## D7 — The web mutation and what it invalidates

**Decision**: A new `features/users/mutations/use-user-mutations.ts` exposes
`deactivate` from `tuyauQuery.users.deactivate.mutationOptions()` and, on success **and** on
failure, invalidates `userQueries.list()` exactly.

**Rationale**: This is the shape `use-dock-mutations.ts` established. Invalidating on the failure
path too is the point `ResourceLifecycleDialog` already makes in its own comment: a refusal usually
means the record's authoritative state has moved on since the view loaded, so the collection must be
refreshed before the administrator reads the reason. The workbench derives its views, counts, and
open record from that one query (`usersPage` filters the retrieved collection client-side), so a
single invalidation moves the user between tabs, updates both counts, and re-resolves the open
record — no manual reload, satisfying FR-016.

**Alternatives considered**:

- *Optimistic update of the cached entry*: rejected — the server owns `deactivatedAt` and
  `deactivatedBy`, and the refusal paths are common enough here that a rollback path would be the
  usual case rather than the exception.
- *`queryClient.setQueryData` from the response*: rejected — a viable refinement, but it duplicates
  the collection's ordering rules in the client for a ≤ 200-row query that refetches in one round
  trip.

## D8 — The action does not reuse the site-reference lifecycle components

**Decision**: The confirmation is a small `features/users/ui/user-access-actions.tsx` built directly
on `AlertDialog`, `Button`, `toast`, and `parseApiError`, with its wording in a new
`features/users/helpers/user-access-copy.ts` keyed by action and built from `helpers/resource-copy`'s
`refusalTitle` / `confirmationMessage` / `namedRecord`. It does **not** go through
`components/lifecycle`.

**Rationale**: `lifecycle-copy.ts` opens by declaring itself "the single source of lifecycle wording
for every **site reference**", and every sentence in it derives from `CONTEXT.md`'s definition of an
archived site reference — "no longer available for new operations". A user is not a site reference,
and `CONTEXT.md` is explicit that "user archiving" is the wrong term for a deactivation. Reusing that
module would put the wrong promise in the dialog. It also hard-codes a comment textarea, and a user
deactivation records no comment (the `users` table has no column for one, and `User Access Status
Change` is defined as a dated change with an actor and nothing else).

`apps/web/AGENTS.md` requires that toasts come from `resource-copy` / `lifecycle-copy` — "a feature
brings its noun, never its own phrasing". That rule is honoured: the two sentence shapes still come
from `resource-copy`, which is where `lifecycle-copy` gets them too. What the users feature adds is
its own vocabulary, not its own phrasing.

Keying the copy by action rather than hard-coding one string is deliberate and cheap: GH-32 adds
reactivation to this same record, and it should add a key, not a second dialog. Only `deactivate` is
implemented here.

**Alternatives considered**:

- *Add `deactivate` to `LifecycleAction` and make the comment optional*: rejected — it widens a
  module scoped to site references, makes the comment field conditional for every existing caller,
  and imports an effect sentence that is wrong for users.
- *Extract a resource-neutral confirm-dialog shell from `ResourceLifecycleDialog` first*: rejected
  **for now** — the right refactor once a second non-site-reference lifecycle action exists, which is
  GH-32. Doing it here would be a speculative generalization touching every site reference in a slice
  that is meant to be one vertical write.

## D9 — What the open record does after a success

**Decision**: Nothing new. The success invalidates the collection, the user leaves the `active` view,
and the workbench's existing rule — the `useEffect` in `users-page.tsx` that drops a `userId` naming
no visible user from the URL — closes the sheet. A toast names the user and what happened; the
`Deactivated` tab's count has already incremented.

**Rationale**: FR-016 explicitly defers to "the workbench's established rule for a user leaving the
visible view", and that rule exists, is documented in the code, and is already tested. The
alternative would be a new navigation behaviour invented by this slice.

**Alternatives considered**:

- *Switch the status tab to `deactivated` and keep the record open*: rejected — it invents a
  navigation rule the workbench does not have, and it moves the administrator away from the view they
  were working in, which is the wrong default when deactivating several users in a row.

## D10 — Who sees the action

**Decision**: The footer renders the `Deactivate` button only when the viewer's role is
`ORGANIZATION_ADMIN`, the record's `accessStatus` is `ACTIVE`, and the record is not the viewer's own
(`user.id !== viewer.id`). The viewer comes from the existing `useAuthenticatedUser()`.

**Rationale**: FR-015 requires the action be offered only to an entitled actor and never on the
actor's own record; FR-002 and FR-009 keep the API authoritative regardless. An operations admin
never sees it — they consult active users only and their payload carries no lifecycle block at all.
Hiding it on the viewer's own record is the interface being honest about a rule the API enforces;
`apps/web/AGENTS.md` states the same principle for gated modes.

**Alternatives considered**:

- *Render it disabled on the viewer's own record*: rejected — a disabled control with no explanation
  reads as a bug. The rule is "another administrator does this for you", which is better expressed by
  the control's absence than by a dead button.

## D11 — The seeded dataset's limits for manual verification

**Decision**: The refusal paths are proved by the Japa and Vitest suites; the quickstart drives the
`PENDING`, `CANCELLED`, and `ALREADY_DEACTIVATED` refusals through the API against rows created for
the purpose, and resets with `pnpm --filter api db:fresh`. The shared seeder is not extended.

**Rationale**: `database/fixtures/users.ts` seeds five users, all `ACTIVE` or
`passwordRenewalRequired`, and exactly one `ORGANIZATION_ADMIN` (Claire Martin) — the account
developers sign in with. There is no pending, cancelled, or deactivated fixture, which is a state the
delivered workbench already lives with: its `Pending`, `Cancelled`, and `Deactivated` tabs render
empty against the seed today. Changing a shared seeder for one slice's manual convenience is a change
to a file every other feature depends on.

Two consequences the quickstart states plainly: a user deactivated through the workbench cannot be
restored until GH-32 ships, and self-deactivation is refused for Claire — which is also the easiest
refusal to demonstrate by hand.

**Alternatives considered**:

- *Add a pending and a deactivated fixture user*: rejected here — defensible on its own merits, but
  it belongs to a fixture-coverage change, not to this write.

## D12 — Verification seams

**Decision**:

| Spec | Seam |
|---|---|
| US1.1, US1.5, US1.6, FR-010–FR-012 | `tests/unit/users/deactivation/deactivate.spec.ts` — the transition writes status, date, and actor, and touches nothing else. |
| FR-018, FR-019, D3, D4 | `tests/unit/users/deactivation/guarded_write.spec.ts` — the real `LucidUserRepository` against the database (ADR-0014): the conditional update matches zero rows on a non-active target, the remembered connections of the deactivated user are gone and nobody else's are, and a refusal deletes none. |
| US2.1–US2.4, FR-004–FR-007, FR-009 | Same unit spec — one case per refusal, asserting the target is unchanged. |
| US1.3, US1.4, FR-013 | `tests/integration/users/deactivation/deactivate.spec.ts` — a login attempt after deactivation, and a request carrying the deactivated user's session. |
| US3.1–US3.2, FR-002 | Same integration spec — the unauthenticated, non-active, and three-role matrix. |
| US2.5, FR-008 | Same integration spec — a malformed `:id` returns 422 with no user read. |
| FR-018 | Integration spec — two deactivations of the same user in sequence; the second is `ALREADY_DEACTIVATED` with the first's date and actor intact. |
| US1.2, US3.3, FR-015, FR-016 | `apps/web/src/features/users/__tests__/deactivate/` — journey and permissions, rendering through the real router with MSW. |
| FR-017, FR-019 | Same web tests — one case per refusal code and one for a network failure, asserting the dialog's reported reason and that the collection is refreshed. |

**Rationale**: `apps/api/AGENTS.md` splits domain behaviour into unit tests and HTTP concerns into
integration tests, and requires unauthenticated, unauthorized, main success, and endpoint-specific
failures for every protected endpoint. `apps/web/AGENTS.md` makes feature tests the primary TDD seam
and requires MSW rather than a mocked Tuyau client. No `apps/web/e2e` directory exists, so the
browser journeys stay manual and live in [quickstart.md](./quickstart.md).
