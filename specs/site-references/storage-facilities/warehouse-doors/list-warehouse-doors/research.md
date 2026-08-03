# Research: List Warehouse Doors

## Embedded consultation and selector-safe read contracts

**Decision**: Extend protected `GET /api/v1/warehouses` so every warehouse embeds all its available
and archived doors. Add protected `GET /api/v1/warehouse-doors/available` for future operational
selectors; it returns only available doors whose containing warehouse is also available. Return no
complete standalone door collection, item-detail, search, status-filter, or pagination endpoint.

**Rationale**: Doors are initially consulted only inside their containing warehouse, so one bounded
response gives the UI a coherent warehouse, footprint, and door snapshot without a client join or a
second loading/error state. The dedicated available-only endpoint keeps future discharge selectors
API-safe: callers cannot accidentally offer an archived door or a door beneath an archived warehouse.
Keeping this named-resource endpoint also follows the Tuyau ADR where the resource has an independent
operational consumer.

**Alternatives considered**:

- Keep a complete `GET /warehouse-doors` collection: rejected as redundant while the consultation UI
  consumes doors only through warehouses; it would introduce a second snapshot and client join.
- Add `GET /warehouses/:id/doors`: rejected because warehouse switching would add requests and could
  produce counts from different snapshots.
- Add `GET /warehouse-doors/:id`: rejected because every detail field is already in the containing
  warehouse's embedded collection.
- Derive future discharge options from embedded doors: rejected because selector safety belongs at
  the API boundary and must account for both door and parent-warehouse lifecycle.

## Persistence and containment

**Decision**: Add `warehouse_doors` with an application-assigned UUID, immutable `warehouse_id`
foreign key using `ON DELETE RESTRICT`, trimmed name, exact latitude/longitude, current
`AVAILABLE | ARCHIVED` status, and timestamps. Keep the existing implicit single-site model and do
not add tenant keys.

**Rationale**: A door is a stable site-reference identity rather than a warehouse value row, so
permanent containment and restricted parent deletion are safer than cascade deletion. PostgreSQL
and SQLite can both enforce foreign keys, coordinate ranges, trimmed/non-empty names, and lifecycle
values. Site/organization keys would create unusable partial tenancy contrary to ADR 0003.

**Alternatives considered**:

- Cascade door deletion with a warehouse: rejected because business behavior forbids permanent
  door deletion and containment history must not disappear accidentally.
- Add PostGIS or a geometry column: rejected because listing performs no spatial query and the test
  repository must remain portable to SQLite.
- Store archive/reactivation actors and comments now: deferred to issues #215 and #216 because this
  contract exposes current state, not lifecycle provenance.

## Name and lifecycle invariants

**Decision**: Enforce an unconditional unique index on `(warehouse_id, LOWER(name))` across both
lifecycle states, a database check that stored names are non-empty and trimmed, and a maximum name
length of 255 consistent with the shared site-reference normalizer. Preserve accepted display
casing. The same normalized name remains valid in a different warehouse.

**Rationale**: This directly implements the clarification decisions, keeps archived names reserved
for reactivation, and makes the constraint observable through the real PostgreSQL/SQLite repository
test seam. Future write use cases will call the shared name normalizer before persistence.

**Alternatives considered**:

- Site-wide uniqueness: rejected because containment is the user-visible identity scope.
- Available-only or status-scoped uniqueness: rejected because it permits archival replacement and
  later reactivation conflicts.
- Exact-case comparison: rejected because visually duplicate door names would remain possible.

## Spatial invariant boundary

**Decision**: Persist latitude and longitude as range-checked numeric columns and document that each
door point is within or on its warehouse footprint. Seed and test this slice with valid points;
issues #213 and #214 will enforce point-in-polygon validation at their write boundaries.

**Rationale**: Point-in-polygon and the rule that an archived warehouse has no available doors are
cross-row business invariants. Adding triggers, PostGIS, or duplicated list-time geometry validation
for a read-only slice would expand the architecture without improving the approved consultation
journey. The API remains authoritative when later mutations are introduced.

**Alternatives considered**:

- Database triggers or PostGIS constraints: rejected for PostgreSQL/SQLite portability and because
  no current write workflow needs them.
- Reject invalid persisted rows in the transformer: rejected because it duplicates future write
  validation and turns a projection mapper into a business validator.

## Collection projections and ordering

**Decision**: Each warehouse DTO adds `doors`, ordered by case-folded name, display name, then stable
door identity, with items `{ id, name, status, latitude, longitude }`. The available-only endpoint
returns `{ id, warehouseId, name, status, latitude, longitude }`, ordered by containing warehouse
identity, case-folded name, display name, then door identity, and filters on both door and warehouse
status.

**Rationale**: Nested items do not repeat `warehouseId` because containment is explicit and stable in
the response shape. The selector-safe resource retains it so future discharge consumers can persist
and display the parent relationship without joining against the complete warehouse collection.
Deterministic ordering keeps fixtures and view projections predictable when warehouses reuse names.

**Alternatives considered**:

- Repeat `warehouseId` in each nested door: rejected as redundant with structural containment.
- Embed the full warehouse or footprint in each available-only door: rejected as repeated state with
  drift risk.
- Return lifecycle timestamps or actors: rejected because the approved detail contract requires only
  current status.
- Let database default order define the collection: rejected because it makes tests and rendering
  unstable.

## Consultation authorization

**Decision**: Keep both contracts inside existing session middleware. Continue authorizing the
warehouse snapshot through `WarehousePolicy.list`; authorize the available-only door collection
through `WarehouseDoorPolicy.listAvailable`. Both accept every user whose access status is `ACTIVE`,
independent of role.

**Rationale**: This matches warehouse consultation, includes observers, and keeps authorization at
the API boundary. Authentication middleware re-reads the user so an old session cannot expose data
after access is deactivated.

**Alternatives considered**:

- Administrator-only consultation: rejected because the spec explicitly grants all active roles
  read-only access.
- Web-only gating: rejected because direct API requests would bypass it.

## Single-snapshot web composition

**Decision**: Keep `/warehouses` as the only route and its existing TanStack warehouse query as the
only consultation source. The expanded payload is cached once; the selected warehouse's embedded
doors are filtered inside `features/warehouse-doors`. Warehouse loading/error/retry owns the whole
snapshot, while lifecycle-specific empty feedback remains inside the door panel.

**Rationale**: This directly matches the only initial display context, removes client joining and
source synchronization, and keeps warehouse/footprint/door state atomic. A dedicated feature still
owns door presentation logic, while the Warehouses screen performs explicit composition under the
web vertical-slice ADR.

**Alternatives considered**:

- Fetch a complete door collection after selection: rejected because it adds a request, join, and
  independent failure state without an independent consultation destination.
- Fetch once per selected warehouse: rejected because it adds latency and multiple snapshots at a
  scale where the complete collection is bounded.
- Put door logic directly under `features/warehouses`: rejected because warehouse doors are a
  separate business resource with roadmapped mutations.

## URL state and contextual lifecycle default

**Decision**: Extend the existing warehouse route search with optional `doorStatus` and `doorId`.
When status is absent, derive Available for an available warehouse and Archived for an archived
warehouse. Selecting another warehouse clears both door values; a lifecycle change clears only a
door selection excluded by the new scope. After a successful collection refresh, missing,
wrong-warehouse, or filtered-out selections are cleared without substituting another door.

**Rationale**: URL state restores sharing, refresh, and back/forward navigation while preserving the
clarified contextual default. Waiting for a successful warehouse snapshot before invalidation avoids
clearing a selection merely because route data is pending or temporarily unavailable.

**Alternatives considered**:

- Component-local door state: rejected because reload and navigation lose context.
- Reuse the warehouse `status` query value: rejected because warehouse and door lifecycle scopes
  are independent.
- Always default Available or All: rejected by the clarified behavior for archived warehouses.

## Non-modal map, accessible markers, and selection

**Decision**: Render the selected warehouse context in a non-modal, overlay-free responsive sheet
instance with outside pointer dismissal disabled. Keep the unselected overview free of door markers.
After warehouse selection frames its footprint, progressively reveal only that warehouse's admitted
doors as compact MapLibre markers without persistent text labels. Reveal marker identity on hover,
focus, or selection, give strong visual emphasis only to the selected marker, and keep non-selected
markers quiet. Show warehouse context, lifecycle tabs/counts, an accessible door list, and the
selected door state in the same panel. Extract the deterministic checkpoint collision-offset algorithm into
a shared resource-map helper for co-located door markers.

**Rationale**: The current modal warehouse sheet traps focus and blocks marker activation behind it.
An opt-in non-modal panel keeps the map operable without changing other sheet consumers. The list
provides the primary dense-navigation, keyboard, and degraded-map path and independently exposes
doors whose exact or nearby coordinates require visual marker offsets. Progressive disclosure,
compact unlabeled markers, and selection-only emphasis avoid overloading the warehouse overview or
the selected footprint. Status labels, marker structure, and an archive badge keep lifecycle
distinctions independent of color.

**Alternatives considered**:

- Open a second or nested modal: rejected because it blocks map interaction and fragments the
  containing-warehouse context.
- Open a second door detail view: rejected because the list and selected marker already provide the
  required identity and spatial context without adding a second navigation state.
- Add only overlapping markers: rejected because exact coordinate collisions remain difficult for
  keyboard and assistive-technology users without an ordered list.
- Show every site's door in the warehouse overview: rejected because it obscures warehouse
  footprints and makes the map visually dense before the user chooses a working context.
- Keep every marker label permanently visible: rejected because labels collide inside compact
  footprints; tooltip, focus, selection, and the panel list provide identity on demand.
- Cluster selected-warehouse doors: rejected because a cluster hides the exact unloading positions
  users are consulting; stable collision offsets preserve individual spatial meaning.

## Verification strategy

**Decision**: Drive API behavior with Japa tests against the real Lucid/SQLite repository. Drive web
behavior through the real TanStack route and providers with MSW intercepting HTTP; mock only the map
canvas where jsdom cannot supply MapLibre. Unit-test only pure filtering/default-state and shared
marker-offset logic. Complete a manual desktop/mobile browser journey because no Playwright suite is
configured.

**Rationale**: These are the repository's documented high-value TDD seams. They prove persistence
constraints, authorization, nested and selector-safe contracts, typed request behavior, URL
restoration, warehouse-snapshot failure/retry, panel/map interaction, and accessibility without
coupling tests to internal hooks or mocking Tuyau.

**Alternatives considered**:

- Repository fakes: rejected by API ADR 0014 because SQLite exercises the real query and constraints.
- Mock Tuyau or `fetch`: rejected by the web testing ADR because MSW tests the real transport adapter.
- Add Playwright infrastructure in this slice: rejected as a separate tooling outcome.
