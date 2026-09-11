# Phase 0 Research: Update Another User Identity

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-10

No `NEEDS CLARIFICATION` marker remains in the specification: the three that did were answered on
2026-09-10 and written into FR-003, FR-013, and FR-015. The research below records the design
decisions this plan rests on, each taken against the code as it exists and the conventions in
`apps/api/AGENTS.md`, `apps/web/AGENTS.md`, and the ADRs.

**Revised 2026-09-11**: the product owner deferred the identity history and chose a plain refusal for
a pending user's email address. D3 and D4 are superseded, D7 is replaced, and D5, D8, D10, D11, and
D12 are updated to match; each superseded decision keeps its reasoning so it can be picked up again.

## D1 — Where authorization, self-exclusion, and validation live

**Decision**: `UserPolicy.updateIdentity(viewer)` answers *may this viewer correct identities at
all* — active, `ORGANIZATION_ADMIN`. `UpdateUserIdentityUseCase` answers *may this correction be
applied to this target* — not yourself, target exists, email free, a pending user's mailbox
unchanged.
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

> **Superseded 2026-09-11 — deferred.** The product owner decided the history is not needed for now.
> The table, its model and factory, and the `identityChanges` projection were built, then removed
> before merge; a correction records nothing beyond the corrected columns and `updated_at`. The
> reasoning below stands if the history returns — as its own slice, with its own migration.

**Decision (as first taken)**: Add a `user_identity_changes` table holding one immutable row per accepted correction:
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

> **Superseded 2026-09-11 — deferred with D3.** `toAdministration()` carries no `identityChanges` key,
> and `GET /api/v1/users` is unchanged by this slice.

**Decision (as first taken)**: `UserTransformer.toAdministration()` gains an `identityChanges` key, emitted through the
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
target and the identity `UPDATE`. Email conflicts are caught from the unique-index violation with
`isUniqueViolation`.

**As delivered** (a refinement of the shape sketched here, recorded because it differs): the
repository exposes two operations rather than one. `findByIdForUpdate(id, client)` is the locked
read, and `applyIdentity(command)` is the conditional write — both taking the caller's transaction.
The use case takes its decisions — self-target, unchanged submission, a pending user's mailbox —
against the locked row, so the transaction has to span those decisions and the write, which
ADR-0013 gives to the use case. A single repository-owned `updateIdentity` would have had to take the
decisions as a callback, the boundary inversion ADR-0013 exists to prevent.

**Rationale**: This is the pattern the truck lifecycle writes already use (`archiveAvailable`,
`returnToService`): the lock is what makes "read the stored values, decide, then write" safe. It
satisfies the edge case forbidding a mixed identity under concurrent corrections, and FR-011's
atomicity — either every submitted part is applied, or none is.

**Alternatives considered**:

- *A guarded conditional `UPDATE` with no lock*, as `renewPassword` uses: rejected — that write takes
  no decision from the stored values; this one does, and a compare-and-swap on three columns would
  be a hand-rolled optimistic lock where a row lock already exists.
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

## D7 — A pending user's email address is refused, with an explanation

> **Replaced 2026-09-11.** The first decision introduced an `ActivationLinkIssuer` port, called inside
> the correction's transaction for a pending user whose address changes and bound to an
> implementation reporting the capability unavailable until GH-7 shipped — answering
> `E_USER_ACTIVATION_LINK_UNAVAILABLE`. GH-7 has since shipped (#292) with its own
> `ActivationLinkIssuer` for invitations, and the product owner chose not to reissue links from a
> correction at all. The port, its binding, and that code are gone.

**Decision**: When the target is `PENDING` and the submitted address differs from the stored one —
compared case-insensitively, as the `LOWER(email)` index does — `UpdateUserIdentityUseCase` raises
`PendingUserEmailChangeException`: `409 E_USER_PENDING_EMAIL_LOCKED`, "This user has not activated
their access yet, so their email address cannot be changed. It can be corrected once they have
activated their access." It is decided against the locked row, before any write, so nothing changes.
A pending user's first and last name stay correctable and their outstanding activation link is left
alone; re-casing the same address is not a mailbox change and goes through.

**Rationale**: The invitation's link was handed out under the address on record. Moving that address
while the link stays usable is the stale-mailbox state FR-015 first set out to prevent; replacing the
link would mean a second single-read secret carried in the correction's response and shown to the
administrator once — GH-7's machinery, which the product owner judged not worth a correction. A plain
refusal that says *why* and *when* it becomes possible is the smallest honest answer, and it needs no
port: the decision is one condition in the use case.

**Alternatives considered**:

- *Reissue the link and return it once in the response*, on top of GH-7's `ActivationLinkIssuer`:
  rejected for now by the product owner; it remains a possible follow-up, and would add a response
  field and a one-time dialog to this slice.
- *Silently allow the correction and leave the invitation as it was*: rejected — the link would stay
  usable under an address the organization no longer recognizes as that user's.
- *Refuse every correction of a pending user*: rejected — over-broad. FR-003 makes pending users
  correctable, and a misspelled name on a pending user is precisely the case administrators hit.
- *Disable the email field for a pending user*: not chosen — the product owner asked for an explained
  refusal, and the API has to refuse regardless (FR-006).

## D8 — Refusal vocabulary

**Decision**: One exceptions module, `#users/shared/user_exceptions`, in the shape the truck slice
uses:

| Exception | Status | Code |
|---|---|---|
| `UserNotFoundException` | 404 | `E_USER_NOT_FOUND` |
| `SelfIdentityUpdateException` | 403 | `E_USER_IDENTITY_SELF_UPDATE` |
| `DuplicateUserEmailException` | 409 | `E_USER_EMAIL_CONFLICT` |
| `PendingUserEmailChangeException` | 409 | `E_USER_PENDING_EMAIL_LOCKED` |
| `InvalidUserIdentityException` | 422 | `E_USER_IDENTITY_INVALID` |

**Rationale**: 403 rather than 409 for the self case: the administrator seam is not the one for that
target, which is an authorization-shaped statement, and the message points at the self-service path.
409 for the email conflict matches `E_TRUCK_REGISTRATION_CONFLICT`, and 409 for the pending mailbox
because it is the target's state, not the input, that refuses it (D7). Named domain exceptions keep
the Tuyau contract stable (`apps/api/AGENTS.md`).

*Revised 2026-09-11*: `PendingUserEmailChangeException` replaces `ActivationLinkUnavailableException`
(`E_USER_ACTIVATION_LINK_UNAVAILABLE`), which named a temporary unavailability that is no longer the
reason.

## D9 — Cross-organization refusal is satisfied by construction

**Decision**: No organization filter is added. FR-007 is met because ADR-0003 establishes a single
site and a single operating organization with no tenant isolation: every user in `users` belongs to
the administrator's organization, so "a user of another organization" and "a user that does not
exist" are the same 404 today.

**Rationale**: Adding a filter would mean inventing an organization column the model does not have.
Recording the reasoning here is what keeps FR-007 honest rather than silently unimplemented.

## D10 — An unchanged submission writes nothing

**Decision**: Inside the locked read, compare the normalized submission with the stored identity; if
all three parts are equal, commit no `UPDATE`, and return the user unchanged with a success outcome.
The comparison is exact — re-casing a stored value is a correction like any other — while the
*mailbox* comparison that decides whether a pending user's address would move (D7) is
case-insensitive, matching the `LOWER(email)` index. `normalize_user_identity` exposes both.

**Rationale**: It keeps `updated_at` truthful, and it keeps the pending-user refusal (D7) from
refusing a form that was opened and submitted untouched: no mailbox change, nothing to refuse.

## D11 — Web: the correction is a mode on the existing users route

**Decision**: `/users` carries `mode: 'create' | 'edit' | 'view'`, optional, in its Zod search
schema — the shape `/customers` has. The route `transform` settles contradictions: `create` (GH-7's
invitation panel) clears `userId`, and `edit` or `view` without a `userId` is dropped. `UserSheet`
renders `UserAccessRecord` in view mode and a new `EditUserIdentityPanel` in edit mode, left through
the header's "Back to details".

**Entry points** (revised 2026-09-11 to follow the customer directory): an `Edit` item in the row
actions menu — View, Edit, then the access actions — that opens the correction directly
(`?userId=…&mode=edit`), and an `Edit` button on the left of the record footer, with the access actions
on the right. Both ask one rule, `mayEditUserIdentity(viewer, user)` in
`features/users/helpers/user-identity.ts` — an organization admin, never on their own record — the way
`userAccessActions` keeps the row and the record agreeing on deactivation. `UserAccessRecord` owns the
footer and renders none when no action is available; `UserAccessActions` renders only its buttons and
confirmation, as `CustomerLifecycleActions` does inside `CustomerDetails`.

**Rationale**: `apps/web/AGENTS.md` requires anything a user can be halfway through to live in the
URL, names the parameter `mode` for a route carrying one resource, and requires the edit panel's
"Back to details" affordance. Matching the customer directory gives the two workbenches one grammar.
Component-level gating keeps the interface honest while the API stays authoritative (FR-006).

**Alternatives considered**:

- *A separate dialog over the table row*: rejected — the record panel is where the user is already
  open, and the convention builds edit as a mode of the panel, as `edit-truck-panel.tsx` does.
- *An `Edit` button in the record header*: the first delivery; replaced on 2026-09-11 by the footer
  and row-menu placement above, which is where every site-reference directory puts it.
- *`useState` for the mode*: rejected by the routing convention.

## D12 — Test seams and TDD order

**Decision**: RED → GREEN → REFACTOR in this order — repository outcomes (Japa unit, SQLite per
ADR-0014), use-case decisions (Japa unit with a stubbed repository), endpoint authorization matrix and
response shape (Japa integration), then the workbench journeys (Vitest + Testing Library + MSW,
through the real router).

**Rationale**: It is the order the dependencies run in, and it matches how the users domain is already
tested (`tests/unit/users/consultation`, `tests/integration/users/consultation`). New directories
become `tests/{unit,integration}/users/identity/` and `apps/web/src/features/users/__tests__/identity/`,
keeping tests organized by domain slice rather than one directory per use case.

**Note**: no `apps/web/e2e` directory exists in the repository, so this slice adds no end-to-end
journey; the browser check is the manual pass in [quickstart.md](./quickstart.md).
