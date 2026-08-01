# Research: List Warehouses

## Collection boundary

**Decision**: Expose one protected `GET /api/v1/warehouses` collection returning available and
archived warehouses, each with its complete footprint, ordered by name.

**Rationale**: The UI needs both lifecycle counts and must let users switch views without a second
load. One response gives the list, counts, selection details, and footprint from one consistent
snapshot for the expected maximum of 200 warehouses. It matches the existing collection endpoint
and Tuyau conventions.

**Alternatives considered**:

- Separate available, archived, and show endpoints: adds round trips and can produce mismatched
  counts or stale details without providing value at this scale.
- Server-side lifecycle filters or pagination: unnecessary below 200 records and explicitly outside
  the approved scope.

## Site scope and consultation authorization

**Decision**: Protect the route with the existing session middleware and a warehouse policy whose
list ability accepts every active user role. Treat the current application's single organization and
single site as the repository scope; do not add organization/site persistence in this slice.

**Rationale**: The auth middleware re-reads the user and rejects any session whose current access
status is not `ACTIVE`. The product model currently has no organization or site entity, and the spec
explicitly assumes one operating organization with one site. Therefore no cross-site record can
exist in this delivery, while adding a speculative tenancy model would exceed Issue #207.

**Alternatives considered**:

- Reuse administrative list policies from docks/customers: conflicts with the requirement that all
  active roles can consult warehouses.
- Add `organizations`, `sites`, memberships, and `site_id`: broadens the delivery into tenancy and
  cannot be justified by the current one-site model. A future multi-site feature must introduce that
  scope explicitly and then update the repository query.

## Footprint persistence

**Decision**: Store warehouses in `warehouses` and each polygon's ordered boundary in
`warehouse_footprint_points`, keyed by `(warehouse_id, position)`, with latitude/longitude range
checks. Load warehouses and points without an N+1 query and assemble one ordered footprint per
warehouse in the repository.

**Rationale**: Ordering is a business property of a polygon. Relational point rows preserve every
coordinate, work identically with PostgreSQL and the in-memory SQLite repository seam, and avoid
opaque JSON mapping. The approved spec assumes all persisted footprints are valid; future create or
update workflows will validate the minimum distinct points and polygon shape in their own contract
and transaction.

**Alternatives considered**:

- PostGIS polygon: offers spatial operators but adds an extension, test-environment divergence, and
  operational complexity when listing and framing need no spatial query.
- JSON/JSONB coordinates on `warehouses`: fewer rows, but weaker portable constraints and no current
  project precedent for typed JSON model columns.
- A stored center: directly conflicts with the domain rule that display position is derived from the
  polygon.

## Lifecycle representation

**Decision**: Give warehouses a case-insensitively unique name, an `AVAILABLE | ARCHIVED` status,
standard archive/reactivation metadata, UUID identity, and timestamps. Return only identity, name,
status, and footprint from the list contract.

**Rationale**: Status and stable identity are required now. Persisting lifecycle metadata follows
the existing site-reference shape and lets archived fixtures represent a coherent historical state,
while withholding unused metadata keeps this consultation contract minimal. Future management
slices can extend their own response needs without changing the current read journey.

**Alternatives considered**:

- Status alone in persistence: would require a follow-up schema rewrite for the already-roadmapped
  archive/reactivate behaviors and would not preserve lifecycle provenance.
- Return lifecycle comments and actors now: not required to consult warehouse identity, status, or
  footprint and would expand the UI contract without approved behavior.

## Footprint presentation and framing

**Decision**: Render warehouse footprints as MapLibre polygon layers on the existing checkpoints map.
Convert the ordered GPS boundary points to GeoJSON, compute bounds from all returned points, and fit
the map to the selected polygon. Keep the bounds calculation in a pure tested adapter.

**Rationale**: This reuses the existing map shell, controls, theme handling, and viewport behavior
while displaying every boundary segment and framing the entire polygon from its own data. It needs
no new mapping package and remains deterministic through the existing map test seam.

The polygon presentation also reuses the checkpoints interaction convention: hover/focus exposes a
tooltip with the warehouse name and lifecycle status, while click selects the warehouse and opens
the read-only detail sheet.

Available polygons use a solid, high-emphasis treatment. Archived polygons use a muted treatment
with a dashed outline. A persistent map legend explains both treatments so lifecycle state remains
understandable independently of color.

**Alternatives considered**:

- Standalone SVG: would duplicate the map experience and diverge from the checkpoints consultation
  convention already established in the product.
- Canvas: harder to make accessible and less straightforward to test by observable map behavior.
- Use the first point or a stored center for positioning: can crop irregular footprints and violates
  the domain model.

## Web state and interaction

**Decision**: Add `/warehouses` with validated URL state for `status=all|available|archived`, optional
`search`, and optional selected warehouse id. Default to available. Derive the filtered polygon
collection and counts from the query response; clear selection when the user changes status or when
a refresh moves/removes the selected record. Open a read-only detail sheet containing name, status,
and footprint.

**Rationale**: URL state makes lifecycle and selection restorable while matching existing route and
sheet patterns. Deriving counts prevents duplicated server fields from drifting. Closing an invalid
selection enforces lifecycle separation after both user navigation and refreshed server state.

**Alternatives considered**:

- Component-local selection and tab state: loses state on refresh/navigation and makes stale
  selection rules harder to enforce.
- Separate detail request: increases failure states and can make details inconsistent with the
  collection snapshot.
- Add server-side search/sort/mutation controls: outside the approved slice. Client-side name search
  is included because it is an established part of the checkpoints consultation pattern.

## Loading, failure, empty, and retry behavior

**Decision**: Use the route loader with TanStack Query, a warehouse-specific skeleton, a route error
component with `reset`-driven retry, and distinct available/archived empty states inside persistent
tabs. A successful retry replaces the collection snapshot and re-derives lists, counts, and valid
selection.

**Rationale**: It follows the current customer feature's proven SSR/query pattern, clearly separates
failure from empty data, and keeps the other lifecycle tab reachable when one set is empty.

**Alternatives considered**:

- Render an empty list on request failure: misleading and violates FR-011.
- Force page reload or sign-in for retry: unnecessary because route reset can re-run the protected
  query with the current session.

## Verification strategy

**Decision**: Drive API behavior with a failing integration contract test and repository-backed use
case test, then drive the web behavior with real-router feature tests using MSW. Unit-test only the
pure footprint framing adapter. Verify the full journey manually in a browser because this checkout
does not currently contain a configured Playwright suite.

**Rationale**: These are the repository's documented high-value seams and satisfy RED → GREEN →
REFACTOR without coupling tests to component or query-hook internals.

**Alternatives considered**:

- Mock the Tuyau client or use fetch stubs: bypasses the actual transport adapter and conflicts with
  the web testing ADR.
- Add a new browser-test platform in this feature: unrelated tooling scope; browser automation can
  be added through its own selected issue.
