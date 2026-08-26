# Phase 0 Research: Browse and Filter the User List

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-08-26

No `NEEDS CLARIFICATION` marker remained in the specification. The research below records the
design decisions the plan rests on, each taken against the existing code and the repository's
conventions.

## D1 — Where the role-scoped visibility is decided

**Decision**: `UserPolicy.list` answers *may this viewer consult users at all* (active viewer whose
role is `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN`). `ListUsersUseCase` answers *which users this
viewer may see* — every user for an organization admin, active users only for an operations admin —
by receiving the authenticated viewer and calling `UserRepository.list()` or
`UserRepository.listActive()`.

**Rationale**: `apps/api/AGENTS.md` gives policies authorization and use cases business decisions.
The operations admin's restriction is not a permission on the endpoint but a rule about the
consultable set, which is exactly a use-case decision. It also keeps the scope server-decided and
untamperable.

**Alternatives considered**:

- *A status query parameter the client sets*: rejected — it turns a security boundary into a client
  preference, and the API would have to re-derive the allowed values anyway.
- *A second endpoint (`/users/active`) for operations admins*: rejected — one collection, two seams,
  and the web workbench would have to know which one its role may call. The site-reference
  `available` endpoints exist to serve a different operational need, not to encode a permission.

## D2 — No per-user consultation seam

**Decision**: The feature exposes `GET /api/v1/users` only. The access record shown in the workbench
is rendered from the collection already retrieved; no `GET /users/:id` is added.

**Rationale**: Explicit product decision recorded in the specification (FR-006a). The collection is
bounded (≤ 200 users) and already carries every field the record displays, so a second seam would
add an authorization surface and a second staleness path for nothing. The customer sheet already
implements this pattern — it resolves the record from the list and renders an explicit "no longer
available in the list" state otherwise.

**Consequence**: `GET /api/v1/users` must return the complete access record per user, not a summary.
Refreshing the collection is what refreshes an open record.

## D3 — A dedicated transformer variant, not an extended default

**Decision**: Add a `toAdministration()` variant to `UserTransformer`. Leave `toObject()` and
`toSummary()` untouched.

**Rationale**: `toObject()` is the session contract — it is what `GET /auth/me` and
`POST /auth/login` return, and the web `SessionUser` type is derived from it. Adding the lifecycle
actor objects there would change an unrelated public contract. `toSummary()` is what every site
reference embeds for its lifecycle actors and must stay minimal.

## D4 — Lifecycle history is organization-admin material

**Decision**: The access record's lifecycle events and their responsible administrators are exposed
to organization admins only. An operations admin receives identity, role, and access status for the
active users they may consult, with no lifecycle block.

**Rationale**: A lifecycle actor is itself a user. Returning "deactivated by Claire Martin" to an
operations admin would expose the identity of a user outside the set they are allowed to consult,
and would let them infer the existence of non-active users — which the specification's edge cases
forbid for counts and filters. `ResourceLifecycleSummary` already documents this case: its `actor`
field is optional precisely because "restricted collections withhold it entirely".

**Specification impact**: recorded as FR-006b, added to `spec.md` during planning. This is a
behavioral refinement of FR-006 and needs the spec reviewer's confirmation.

## D5 — Model relations and repository operations

**Decision**: Declare five self-referential `belongsTo` relations on `User` — `invitedBy`,
`activatedBy`, `cancelledBy`, `deactivatedBy`, `reactivatedBy` — and add `list()` and `listActive()`
to `UserRepository` / `LucidUserRepository`, preloading those relations only for the organization
admin's read.

**Rationale**: Identical to `Customer.archivedBy` / `reactivatedBy` and their transformer usage, so
the read contract and the preload cost stay recognizable. Preloading is skipped for the operations
admin's read since D4 withholds the block.

**No migration**: every column already exists (`users.invited_at`, `invited_by_user_id`, and the
activation, cancellation, deactivation, and reactivation pairs) — GH-2 persisted them.

## D6 — Web module shaped like the customers workbench

**Decision**: `apps/web/src/features/users/` mirrors the customers feature: a thin route file
validating search params, `queries/user-queries.ts` over `tuyauQuery.users.index`, a page owning
access-status tabs with counts, `InputSearch`, a role filter, a sortable table, and a sheet holding
the read-only record.

**Rationale**: `apps/web/AGENTS.md` and ADR-0008 make the feature module own screen behavior with a
thin route; the customers screen is the closest delivered equivalent and its interaction contract
(status tabs, counts, URL-held state, client-side search) is what SC-004 assumes users already know.

**Role-dependent tabs**: the tab set is derived from the viewer's role — four access statuses for an
organization admin, none for an operations admin, whose collection is the active set and is
presented without status tabs. An operations admin must not see empty "Pending" or "Deactivated"
tabs, which would disclose the shape of the collection they may not read.

## D7 — User access history is its own component

**Decision**: Build `UserAccessHistory` inside `features/users/ui/`, reusing `ResourceDetailField`,
`formatDateTime`, `formatFullName`, and `Separator`. Do not extend
`components/lifecycle/lifecycle-copy.ts`.

**Rationale**: That module is explicitly the single source of wording for *site references*, and its
`LifecycleAction` union — archive, reactivate, suspend, return to service — is a different
vocabulary from user access (`CONTEXT.md`: invitation, activation, cancellation, deactivation,
reactivation, where reactivation means restoring sign-in access with a new password). The user
record also has no lifecycle comments and reads oldest-first (D8). Parameterizing the shared
component with a copy map, an ordering flag, and a comment-less mode would cost more than the
formatting it shares.

**Alternative considered**: widening `LifecycleAction` with the user access actions — rejected as
above; the shared component keeps serving site references unchanged.

## D8 — Chronological order for the access record

**Decision**: The access record lists events oldest first (invited → activated → deactivated →
reactivated).

**Rationale**: FR-006 / US4 present the record as how the current status was reached; read as a
story it runs forward. Site references order newest first because their pane reports the transition
the record currently sits in, which is a different question.

## D9 — Navigation

**Decision**: Give the existing `Administration → Users` sidebar item the `/users` href.

**Rationale**: `app-sidebar.tsx` already renders that group behind `isAdministrator(user)` —
`OPERATIONS_ADMIN` or `ORGANIZATION_ADMIN` — which is exactly FR-015's audience. The item is
currently href-less; this feature makes it navigable rather than introducing a new entry.

## D10 — Verification seams

**Decision**: Japa unit tests for the use case's scoping decision, Japa integration tests for the
endpoint (unauthenticated, each role, response shape, withheld lifecycle block), and Vitest feature
tests rendering the real router with MSW for the workbench journeys.

**Rationale**: `apps/api/AGENTS.md` requires unauthenticated, unauthorized, success, and
endpoint-specific failures per protected endpoint; `apps/web/AGENTS.md` makes feature tests the
primary TDD seam and forbids mocking the Tuyau client. `apps/web/e2e` does not exist in the
repository today, so no end-to-end journey is added by this slice.
