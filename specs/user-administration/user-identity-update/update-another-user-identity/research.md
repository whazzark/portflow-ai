# Phase 0 Research: Update Another User Identity

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-10

No `NEEDS CLARIFICATION` marker remains in the specification: the three that did were answered on
2026-09-10 and written into FR-003, FR-013, and FR-015. The research below records the design
decisions this plan rests on, each taken against the code as it exists and the conventions in
`apps/api/AGENTS.md`, `apps/web/AGENTS.md`, and the ADRs.

## D1 — Where authorization, self-exclusion, and validation live

**Decision**: `UserPolicy.updateIdentity(viewer)` answers *may this viewer correct identities at
all* — active, `ORGANIZATION_ADMIN`. `UpdateUserIdentityUseCase` answers *may this correction be
applied to this target* — not yourself, target exists, email free, pending link re-issued.
`updateUserIdentityValidator` answers *is this input well-formed*. The repository owns the lock, the
transaction, and the conditional write.

**Rationale**: `apps/api/AGENTS.md` and ADR-0013 give policies authorization, use cases business
decisions and transaction coordination, repositories persistence mechanics. Self-exclusion is not a
permission on the endpoint — an organization admin *is* allowed to use it — it is a rule about the
target, which is a use-case decision, exactly as `ListUsersUseCase` owns *which* users a viewer may
read while `UserPolicy.list` owns *whether* they may read any.

**Alternatives considered**:

- *Self-exclusion in the policy*, via a `before` hook on the resource: rejected — Bouncer would have
  to receive the target user, which means loading it before authorizing, inverting the order every
  other controller in the codebase uses.
- *Self-exclusion in the controller*: rejected — it is a business rule, and the controller owns HTTP
  adaptation only.

## D2 — One `PATCH /api/v1/users/:id` seam, no per-user read

**Decision**: The feature adds exactly one endpoint, `PATCH /api/v1/users/:id`, named `users.update`,
inside the existing authenticated `/api/v1` group. It returns the corrected user in the same
`toAdministration()` projection the collection uses. No `GET /users/:id` is added.

**Rationale**: GH-4's FR-006a forbids a per-user consultation seam, and the workbench resolves the
open record from the retrieved collection. `PATCH` with a full identity body matches
`customers.update`, `docks.update`, and `trucks.update`; the resource is the user, and the
correction is an ordinary update, not a lifecycle transition deserving a `POST /:id/<verb>` like
archive or suspend.

**Consequence**: the response body is the authority the web uses to update its cache, and the
mutation additionally invalidates `userQueries.list()` so counts and every other presentation of that
user follow (FR-018).

## D3 — Identity history is a dedicated table, not columns on `users`

**Decision**: Add a `user_identity_changes` table holding one immutable row per accepted correction:
the target user, the responsible administrator, the change time, and the full identity before and
after — `previous_first_name`, `previous_last_name`, `previous_email`, `new_first_name`,
`new_last_name`, `new_email`.

**Rationale**: FR-013 requires a *cumulative* history: an earlier correction stays readable after a
later one. The `…_at` / `…_by_user_id` column pairs already on `users` record lifecycle events that
happen at most once each; identity corrections have no such bound. Full before/after snapshots rather
than a diff of changed fields keep the projection trivial and let the record answer "what was this
person called on that date" without replaying the chain.

**Alternatives considered**:

- *`identity_updated_at` / `identity_updated_by_user_id` columns on `users`*: rejected — this is the
  shape the clarification explicitly turned down; it cannot answer FR-013's cumulative requirement.
- *A generic user activity log*: rejected as premature. The Discharge Activity Log is a designed
  artifact with its own ADRs (0009–0012) and category vocabulary; inventing a user-wide equivalent
  here would be a second durable decision smuggled into a P2 slice. When a user activity log is
  specified, this table is a clean input to it.
- *JSONB payloads (ADR-0012's shape)*: rejected — that ADR governs activity-log payloads whose shape
  varies by event kind. Six known string columns do not vary.

## D4 — The history rides the collection, under the existing access-history gate

**Decision**: `UserTransformer.toAdministration()` gains an `identityChanges` key, emitted through the
same `this.when(includeAccessHistory, …)` gate the lifecycle events already use, so it reaches
organization admins only (FR-014). `LucidUserRepository.list()` preloads the changes with their
`changedBy` actor; `listActive()` does not.

**Rationale**: One gate, one rule, already tested. A former identity and a responsible administrator
are both user information an operations admin may not consult, which is the same argument GH-4
recorded for the lifecycle events. Because there is no per-user seam (D2), the collection is the only
place the record can get this from.

**Risk accepted**: the collection payload grows with correction history. The GH-4 assumption of ≤ 200
users bounds it, corrections are rare, and the rows are small. If it ever stops being true, the fix is
a per-user seam, which is a spec change, not a silent one.

## D5 — Atomicity and concurrency: one transaction, one locked row

**Decision**: the write is one transaction, opened by the use case, holding a locked read of the
target, the identity `UPDATE`, the history `INSERT`, and — for a pending user reaching another
mailbox — the activation link. Email conflicts are caught from the unique-index violation with
`isUniqueViolation`.

**As delivered** (a refinement of the shape sketched here, recorded because it differs): the
repository exposes two operations rather than one. `findByIdForUpdate(id, client)` is the locked
read, and `applyIdentity(command)` is the conditional write — both taking the caller's transaction.
ADR-0013 gives the use case the transactions that span several collaborators, and this one spans the
repository and the `ActivationLinkIssuer` (D7), so a repository-owned transaction could not have
contained the issuer's failure. A single `updateIdentity` owning its own transaction would have had
to take the issuer as a callback, which is the boundary inversion ADR-0013 exists to prevent.

**Rationale**: This is the pattern the truck lifecycle writes already use (`archiveAvailable`,
`returnToService`): the lock is what makes "read the before-values, then write" safe, and it is the
only way the recorded `previous_*` can be guaranteed to be what was actually replaced. It satisfies
the edge case forbidding a mixed identity under concurrent corrections, and FR-011's atomicity — the
identity and its history entry commit together or not at all.

**Alternatives considered**:

- *A guarded conditional `UPDATE` with no lock*, as `renewPassword` uses: rejected — that write needs
  no before-values; this one records them, and a compare-and-swap on three columns would be a
  hand-rolled optimistic lock where a row lock already exists.
- *A client-supplied version or `If-Match`*: rejected — nothing else in the codebase carries one, and
  the spec asks that the outcome reflect current state, not that a stale form be rejected outright.

## D6 — Email comparison and normalization

**Decision**: The database keeps its authority: `users_email_unique` on `LOWER(email)` already exists
from the initial migration, and a violation of it is what produces the conflict outcome. A new domain
helper `#users/shared/normalize_user_identity` trims all three fields and asserts the name rules,
mirroring `normalize_site_reference`. Storage preserves the entered casing; only the comparison is
case-insensitive.

**Rationale**: `apps/api/AGENTS.md` puts normalization in use cases or domain helpers, not validators.
Relying on the index rather than a `findByEmail` pre-check alone closes the race between the check and
the write; the pre-check is still worth running to produce the friendly outcome on the common path,
with the index as the backstop.

**Consequence**: FR-010's "differs only by letter case or surrounding whitespace" is satisfied by
trimming before comparison and by the existing `LOWER()` index — no new index, no new column.

## D7 — The pending user's activation link, while GH-7 is undelivered

**Decision**: Introduce an `ActivationLinkIssuer` port under `#users/shared`, called by the use case
inside the correction's transaction whenever the target is `PENDING` **and** the email address
actually changes. Bind it, for now, to an implementation that reports the capability as unavailable,
which the use case turns into `E_USER_ACTIVATION_LINK_UNAVAILABLE` (409) and the whole correction
rolls back. GH-7 replaces the binding with the real issuer, and neither the use case nor the endpoint
changes.

**Rationale**: This *is* FR-015 as written — "a failure to issue the new link MUST fail the whole
correction rather than leave the user with no usable link". No activation link mechanism exists in the
repository today (no table, no token, no mailer), so no outstanding link can point at a stale address:
the invariant holds by construction, and the one branch that cannot be honoured fails closed with an
explicit, testable outcome instead of silently corrupting an invitation. Correcting a pending user's
*name*, and correcting any other user's email, are unaffected and fully delivered.

**Alternatives considered**:

- *Build a minimal activation-link mechanism here*: rejected — it is GH-7's outcome, and Principle II
  forbids a second deliverable inside this spec. It would also be the second implementation to delete
  when GH-7 lands.
- *Silently allow the correction and leave the invitation as it was*: rejected — it is the behaviour
  the clarification explicitly turned down, and it produces exactly the stale-mailbox state FR-015
  exists to prevent.
- *Refuse every correction of a pending user*: rejected — over-broad. FR-003 makes pending users
  correctable, and a misspelled name on a pending user is precisely the case administrators hit.

**Confirmed at the plan review gate on 2026-09-10**: this is the one place where the delivered
behaviour is narrower than a naive reading of the spec — a pending user's email cannot be corrected
until GH-7 ships. The product owner confirmed the fail-closed design and chose not to make GH-7 a
blocker of #24: this slice ships without it, and GH-7 later replaces the port's binding alone.

## D8 — Refusal vocabulary

**Decision**: One exceptions module, `#users/shared/user_exceptions`, in the shape the truck slice
uses:

| Exception | Status | Code |
|---|---|---|
| `UserNotFoundException` | 404 | `E_USER_NOT_FOUND` |
| `SelfIdentityUpdateException` | 403 | `E_USER_IDENTITY_SELF_UPDATE` |
| `DuplicateUserEmailException` | 409 | `E_USER_EMAIL_CONFLICT` |
| `ActivationLinkUnavailableException` | 409 | `E_USER_ACTIVATION_LINK_UNAVAILABLE` |
| `InvalidUserIdentityException` | 422 | `E_USER_IDENTITY_INVALID` |

**Rationale**: 403 rather than 409 for the self case: the administrator seam is not the one for that
target, which is an authorization-shaped statement, and the message points at the self-service path.
409 for the email conflict matches `E_TRUCK_REGISTRATION_CONFLICT`. Named domain exceptions keep the
Tuyau contract stable (`apps/api/AGENTS.md`).

## D9 — Cross-organization refusal is satisfied by construction

**Decision**: No organization filter is added. FR-007 is met because ADR-0003 establishes a single
site and a single operating organization with no tenant isolation: every user in `users` belongs to
the administrator's organization, so "a user of another organization" and "a user that does not
exist" are the same 404 today.

**Rationale**: Adding a filter would mean inventing an organization column the model does not have.
Recording the reasoning here is what keeps FR-007 honest rather than silently unimplemented.

## D10 — An unchanged submission records nothing

**Decision**: Inside the locked read, compare the normalized submission with the stored identity; if
all three parts are equal, commit no `UPDATE` and no history row, and return the user unchanged with a
success outcome. The comparison is exact — re-casing a stored value is a correction the record should
show — while the *mailbox* comparison that decides whether an activation link must be replaced is
case-insensitive, matching the `LOWER(email)` index. `normalize_user_identity` exposes both.

**Rationale**: FR-013 requires it explicitly, and it also keeps the pending-user branch (D7) from
refusing a form that was opened and submitted untouched: no email change, no link to re-issue.

## D11 — Web: the correction is a mode on the existing users route

**Decision**: `/users` gains `mode: 'view' | 'edit'` in its Zod search schema, defaulting to `view`,
cleared in the route `transform` when no `userId` is open. `UserSheet` renders `UserAccessRecord` in
view mode and a new `EditUserIdentityPanel` in edit mode, left through the header's "Back to details".
The entry point is offered only when the viewer is an organization admin and the open user is not
themselves.

**Rationale**: `apps/web/AGENTS.md` requires anything a user can be halfway through to live in the
URL, names the parameter `mode` for a route carrying one resource, and requires the edit panel's
"Back to details" affordance. Component-level gating keeps the interface honest while the API stays
authoritative (FR-006).

**Alternatives considered**:

- *A separate dialog over the table row*: rejected — the record panel is where the user is already
  open, and the convention builds edit as a mode of the panel, as `edit-truck-panel.tsx` does.
- *`useState` for the mode*: rejected by the routing convention.

## D12 — Test seams and TDD order

**Decision**: RED → GREEN → REFACTOR in this order — repository outcomes (Japa unit, SQLite per
ADR-0014), use-case decisions (Japa unit with a fake issuer), endpoint authorization matrix and
response shape (Japa integration), then the workbench journeys (Vitest + Testing Library + MSW,
through the real router).

**Rationale**: It is the order the dependencies run in, and it matches how the users domain is already
tested (`tests/unit/users/consultation`, `tests/integration/users/consultation`). New directories
become `tests/{unit,integration}/users/identity/` and `apps/web/src/features/users/__tests__/identity/`,
keeping tests organized by domain slice rather than one directory per use case.

**Note**: no `apps/web/e2e` directory exists in the repository, so this slice adds no end-to-end
journey; the browser check is the manual pass in [quickstart.md](./quickstart.md).
