# Research: List Weighing Areas

## Existing API versus new implementation

**Decision**: Retain `GET /api/v1/weighing-areas` as the sole Weighing Area read endpoint and remove
`GET /api/v1/weighing-areas/:id`, its controller dependency/action, dedicated show use case and
tests, and generated Tuyau registry entry. Reuse the remaining controller, list use case, Lucid
repository, Bouncer policy, transformer, model, and migration inside the Checkpoint map architecture
delivered by merged commit `829b19d1`.

**Rationale**: The complete collection already returns every field required by markers and details,
including stable identity, coordinates, lifecycle status, timestamps, and comments. Resolving both
resource kinds from their loaded collections gives the shared Checkpoint sheet one consistent model,
avoids transient disagreement between map and detail, and removes an unused parallel read contract.
The existing table already enforces required coordinates and the two lifecycle statuses.

**Alternatives considered**:

- Retain the show endpoint for detail freshness: rejected because the collection is the authoritative
  consultation snapshot and Docks already establishes collection-backed detail semantics.
- Rebuild the complete API slice as part of this issue: rejected because persistence and read use
  cases are already implemented and tested.
- Build a standalone weighing-area page: rejected because `/checkpoints`, its map, status/search
  controls, typed selection, feedback boundary, and shared detail sheet now own consultation for
  both operational-checkpoint resources.

## Collection and detail resolution

**Decision**: Keep the existing Dock route preload intact and load the complete weighing-area
collection through an independent TanStack Query state inside the `/checkpoints` page. Resolve a
typed `weighing-area:<id>` selection directly from the currently loaded, status-admitted Weighing
Area collection.

**Rationale**: Resource collections remain independent authoritative queries even though their
presentation is aggregated. Isolating the new source prevents a Weighing Area outage from breaking
the already-delivered Dock consultation while still exposing explicit pending/error/retry feedback.
Collection-backed detail exactly matches Docks, opens without another request, and guarantees that
map marker and sheet reflect the same snapshot.

**Alternatives considered**:

- Fetch detail separately: rejected because all detail fields are already in the collection and a
  second contract would diverge from the merged Dock implementation.
- Preserve an unavailable sheet for a stale selection: rejected in favor of the existing Checkpoint
  rule that clears missing, malformed, unavailable, or status-excluded selections without replacing
  them with another resource.

## Navigable UI state and route

**Decision**: Keep the merged `/checkpoints` route and its validated `status=all|available|archived`,
`search`, and typed `checkpoint=<kind>:<id>` parameters. Use the already-reserved
`checkpoint=weighing-area:<id>` representation and existing administrator navigation.

**Rationale**: Operational Checkpoint is the durable interface category for Docks and Weighing
Areas, and the Docks delivery has already established its sole consultation route. Reusing it keeps
back/forward, refresh, search, status, map, and selection semantics coherent while named resource
APIs remain separate. A direct unauthorized request is still denied by either collection policy.

**Alternatives considered**:

- Add `/checkpoints/weighing-areas`: rejected because it duplicates the merged Checkpoint hub and
  fractures a map intended to show both operational-checkpoint kinds.
- Keep status and selection only in component state: rejected because both have restore/share value
  and ADR 0008 assigns such state to the URL.
- Treat frontend visibility as authorization: rejected because UI policy is ergonomic only; the API
  must remain the enforcement boundary.

## Status presentation and empty states

**Decision**: Reuse the full-area Checkpoint map, All/Available/Archived status menu, normalized name
search, distinct scale markers, shared legend, and typed read-only sheet. Combine Dock and Weighing
Area presentation entries after the Weighing Area query succeeds while retaining Dock entries during
its pending/error states. Add weighing-area-specific empty feedback so an empty source or status
subset is not masked by existing Dock markers. Update the layer-visibility contract so both
now-delivered resource kinds are visible by default.

**Rationale**: The map is now the approved Checkpoint experience and already encodes lifecycle
status through marker appearance, accessible labels, legend, and an exclusive status filter. The
resource-specific empty message preserves the Weighing Area contract inside an aggregate view.

**Alternatives considered**:

- Add a status-tab table: rejected because it would create a second, inconsistent consultation
  surface beside the merged map.
- Add a resource-kind filter in this slice: deferred because both kinds can be rendered together
  with distinct markers and the issue does not require another filter dimension.

## Deterministic ordering

**Decision**: Make the repository order the complete collection by `LOWER(name) ASC`, then
`name ASC`, then `id ASC`; the client preserves that order within each status.

**Rationale**: Database-owned ordering gives every consumer the same result. Case folding handles
mixed-case labels predictably, while the original name and stable ID are deterministic tie-breakers.
The current case-insensitive unique index prevents case-only duplicates through supported writes,
but the complete ordering also behaves deterministically if legacy/imported data bypasses that
invariant.

**Alternatives considered**:

- Sort independently in the browser: rejected because it duplicates a business-facing read rule
  and allows API consumers to observe a different order.
- Keep `ORDER BY name` only: rejected because collation and tie behavior are not explicit enough for
  the edge-case contract.

## Authorization compatibility

**Decision**: Keep the complete collection policy restricted to `ORGANIZATION_ADMIN` and
`OPERATIONS_ADMIN`. Remove the redundant active-user show endpoint together with its route and
generated contract.

**Rationale**: FR-001 through FR-003 protect the complete collection, and no current web consumer
needs an independent show route. Operational selectors retain the separate available-only endpoint.
API tests will prove complete-collection denial for unauthenticated and non-administrator users and
successful collection-backed consultation for both administrator roles.

**Alternatives considered**:

- Keep the show endpoint for possible future consumers: rejected because speculative parallel read
  contracts create maintenance and authorization drift; a future independently delivered behavior
  can introduce the contract it actually needs.

## Failure and refresh semantics

**Decision**: Keep the existing Dock route error boundary unchanged. Represent Weighing Area
collection pending and failure as source-specific overlays with an in-place query retry so Dock
markers remain usable. Keep MapLibre basemap failure non-blocking. In-panel weighing-area detail
has no independent request or failure state: a valid current selection resolves from the collection, while a
missing or status-excluded selection is cleared using the existing Checkpoint behavior.

**Rationale**: This follows existing TanStack Start behavior, keeps the user on the Checkpoints map,
and makes failure recovery testable through MSW without inventing client-side business
state.

**Alternatives considered**:

- Browser reload as the only recovery: rejected because it unnecessarily leaves application state
  and is weaker than the specified same-consultation retry.
- Toast-only collection failures: rejected because a transient message does not explain why the
  Weighing Area source is absent or provide a durable retry action.

## Testing approach

**Decision**: Drive API observable behavior with Japa integration tests and the smallest useful
repository/use-case coverage for ordering. Extend the existing Checkpoint router/provider tests,
map adapter tests, selection/detail tests, feedback tests, and MSW support rather than introducing a
parallel weighing-area page suite. Validate the responsive combined-map journey manually because no
Playwright suite is currently configured.

**Rationale**: This follows the constitution's RED → GREEN → REFACTOR rule and the frontend
testing ADR's feature-level seam. MSW covers deterministic collection/network failures while
the API tests prove authorization and serialization at the authoritative boundary.

**Alternatives considered**:

- Isolated component tests: rejected because they duplicate behavior while coupling tests to UI
  decomposition.
- Add Playwright infrastructure in this feature: rejected because that is a separate repository-wide
  testing deliverable, not a prerequisite for this consultation slice.
