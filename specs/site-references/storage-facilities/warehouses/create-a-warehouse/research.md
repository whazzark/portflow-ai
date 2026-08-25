# Phase 0 Research: Create a Warehouse

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Issue**: [#208](https://github.com/whazzark/portflow-ai/issues/208)

## Starting position found in the codebase

Unlike #203 (Create a Weighing Area), where the backend already existed, **no warehouse write path
exists today**. `WarehousesController` exposes only `index`, `WarehouseRepository` declares only
`list()`, and `WarehousePolicy` declares only `list()`. The web feature
(`apps/web/src/features/warehouses/`) is consultation-only: no mutation hook, no form, no map
control cluster, and no `create` search param.

What *does* already exist and is reused unchanged:

| Asset | Location | Why it matters |
|---|---|---|
| `warehouses` + `warehouse_footprint_points` tables | `apps/api/database/migrations/1784800000000_create_warehouses_tables.ts` | Ordered `position` PK, `latitude`/`longitude` CHECK constraints, and a `LOWER(name)` unique index — **no migration is needed for this slice** |
| `WarehouseTransformer` | `apps/api/app/warehouses/shared/warehouse_transformer.ts` | Already emits `{ id, name, status, footprint.points[], doors[] }` and already throws on a footprint of fewer than 3 points |
| Site-reference name/coordinate helpers | `apps/api/app/site_references/shared/normalize_site_reference.ts` | `assertValidSiteReferenceName`, `assertLegalSiteReference{Latitude,Longitude}` — the same normalization docks and weighing areas use |
| `isUniqueViolation` | `apps/api/app/shared/database/is_unique_violation.ts` | The duplicate-name detection path used by `LucidWeighingAreaRepository.create` |
| `useResourceMapPlacement` | `apps/web/src/components/resource-map/resource-map-placement.tsx` | Arms the map, captures clicks, and suppresses the map's normal click behaviour — exactly FR-002/FR-002a |
| `CoordinateField` | `apps/web/src/components/resource-map/resource-placement-fields.tsx` | The presentational lat/lng input with parse errors, built resource-agnostic by #198 |
| `ResourceMapCreateControl` | `apps/web/src/components/resource-map/resource-map-create-control.tsx` | Renders a single icon button for one action, a dropdown for several |
| `isAdministrator` | `apps/web/src/features/auth/policies/permissions.ts` | The client-side gate the checkpoints page already uses |

## Decisions

### R1 — Request shape mirrors the read contract

**Decision**: `POST /api/v1/warehouses` accepts `{ name, footprint: { points: [{ latitude, longitude }] } }`.

**Rationale**: The GET response already nests points under `footprint.points`. Keeping the write
body symmetric means the web feature reuses one `WarehousePoint` type in both directions, and the
OpenAPI schemas for `WarehouseFootprint`/`GeographicPoint` are shared between the two operations
rather than forked.

**Alternatives considered**: A flat top-level `points` array (asymmetric with GET, and would make
`footprint` a read-only invention of the transformer). A GeoJSON `Polygon` body (rejected: ADR-0006
deliberately stores the footprint relationally without PostGIS, and GeoJSON's repeated closing
vertex would have to be stripped on write and re-added on read — an encoding concern leaking into
the contract).

### R2 — Structural validation in Vine, geometric validation in the use case

**Decision**: `createWarehouseValidator` enforces structure — name `nonBlank`/1–255, `footprint.points`
an array of at least 3 entries, each with `latitude` in [-90, 90] and `longitude` in [-180, 180].
`CreateWarehouseUseCase` then enforces the geometric rules through a new pure module
`app/warehouses/shared/footprint_geometry.ts`: no duplicate consecutive points (including
last↔first) and no self-intersecting outline.

**Rationale**: This is the same split weighing areas use — Vine owns shape and range, the use case
owns normalization and domain assertions via pure helpers. Keeping self-intersection in a pure,
dependency-free module makes it unit-testable without an HTTP request or a database, per
constitution principle IV.

**Algorithm**: pairwise segment-intersection over the closed ring, O(n²). For the footprint sizes
this domain produces (a handful to a few dozen vertices) this is trivially fast and needs no spatial
index. Adjacent segments sharing an endpoint are excluded from the test; any other touching or
crossing pair is a rejection.

**Guard**: the validator also caps `points` at 500 entries. This is an abuse guard on payload size,
not a product limit — the spec's "no upper bound relevant to the initial delivery" holds at every
realistic footprint size.

**Alternatives considered**: Enforcing geometry inside Vine with a custom rule (rejected: mixes
transport validation with a domain invariant and makes the rule unreachable from a future
`UpdateWarehouseUseCase`, which #209 will need). Trusting the client's guard (rejected: the API is
the authorization and business-state source of truth).

### R3 — One transaction, then reload for the transformer

**Decision**: `LucidWarehouseRepository.create` opens a transaction, inserts the `warehouses` row and
its `warehouse_footprint_points` rows with `position` assigned from the submitted order, commits,
and returns the warehouse **reloaded with `footprintPoints` and `doors` preloaded**. A unique
violation on `LOWER(name)` is caught and returned as `{ kind: 'DUPLICATE_NAME' }`.

**Rationale**: `WarehouseTransformer.toObject()` reads `this.resource.footprintPoints` and
`this.resource.doors` and throws when the footprint has fewer than 3 points — a freshly created model
instance has neither relation loaded, so serializing it without a reload would throw on the success
path. The transaction is what makes FR-018 ("no partial warehouse, no orphaned footprint") true.

**Alternatives considered**: Returning the in-memory model and hydrating relations by hand (rejected:
duplicates the repository's ordering rules in the use case). Two separate non-transactional inserts
(rejected outright by FR-018).

### R4 — Reuse the click primitive; add a resource-agnostic pending-polygon layer

**Decision**: `useResourceMapPlacement` is consumed **unmodified** — its `onPlace` appends a vertex
instead of replacing a point. A new `apps/web/src/components/resource-map/resource-map-polygon-placement.tsx`
renders the in-progress outline (a GeoJSON fill + line) and one draggable marker per vertex, with a
`LatLng[]` public surface carrying no warehouse vocabulary.

**Rationale**: The placement hook already reports raw clicks and suppresses other click behaviour;
nothing about it is single-point. Putting the polygon layer beside it, rather than inside
`features/warehouses/`, follows the precedent set by #198 and #203: Update a Warehouse (#209) needs
the identical drawing surface, so the second consumer is already known rather than speculative.

**Alternatives considered**: A MapLibre drawing plugin such as `mapbox-gl-draw` (rejected: a new
runtime dependency and its own interaction vocabulary, to replace roughly 80 lines built from
primitives the repository already owns). Forking the placement hook into a polygon variant
(rejected: the hook needs no change at all).

### R5 — The mode lives in the URL, like every other map mode

**Decision**: The warehouses route gains `create: z.literal('warehouse').optional()`. Activating the
mode navigates to `?create=warehouse` and clears `warehouseId`/`doorId`/`doorStatus`; leaving it
clears `create`. Pending vertices are component state, discarded whenever `create` becomes absent.

**Rationale**: `/checkpoints` already encodes its creation flow in a `create` search param, and the
warehouses page already drives selection, filter, and door state through the URL. Mode exclusivity
(FR-002b) then falls out of the navigation itself: the mode and an open detail sheet cannot coexist
because activating one clears the other's params. Since the warehouse map has no other mode today,
this is the only exclusivity rule to enforce.

**Alternatives considered**: Local `useState` for the mode (rejected: breaks the page's established
URL-as-state contract, loses the deep-link and back-button behaviour the checkpoints tests rely on).

### R6 — The web geometry guard is deliberately duplicated

**Decision**: A pure `features/warehouses/geometry/footprint-validation.ts` re-implements the
minimum-vertex, duplicate-point, and self-intersection checks for immediate pre-submit feedback. The
API stays authoritative and is never bypassed.

**Rationale**: The workspace has no shared package (`workspaces: ["apps/*"]`), so sharing this
~40-line pure function would mean introducing the repository's first shared package for one helper.
The duplication is bounded, has no persistence or transport concerns, and both copies are covered by
their own unit tests. Should #209 and the warehouse-door slices need it a third and fourth time, a
shared package becomes worth its cost — that is a later, separate decision.

**Alternatives considered**: Client-side guard only (rejected: the server must enforce the
invariant). Server-only validation with no client guard (rejected: the administrator would have to
round-trip to discover a crossing outline, and FR-017 requires the drawing to survive rejection
anyway).

### R7 — The vertex list reuses `CoordinateField`, not `useCoordinateFields`

**Decision**: The creation panel renders one `CoordinateField` pair per pending vertex and owns its
own parse/sync logic for the list. `useCoordinateFields` — which models exactly one `LatLng | null`
— is left untouched.

**Rationale**: That hook's contract is a single pending point, including "clear both fields when the
pending placement disappears". Generalizing it to an indexed collection would change its semantics
for its two existing callers (dock and weighing-area create/edit) for no benefit to them. The
presentational `CoordinateField` is the part that is genuinely reusable, and it already takes an
`idPrefix` precisely so several instances can coexist on one page.

**Alternatives considered**: Widening `useCoordinateFields` to accept an array (rejected: churns two
working flows). No keyboard fallback at all (rejected: the spec requires the pointer-free path).

### R8 — The warehouse map gains its first control cluster

**Decision**: `WarehouseMap` gains a `MapControls` cluster (`showZoom`) hosting
`ResourceMapCreateControl`, and `WarehousesPage` passes the same action to
`ResourceMapWorkspace`'s `mapUnavailableActions`.

**Rationale**: The warehouse map currently renders no `MapControls` at all, so the control cluster
is new here. `mapUnavailableActions` exists because a deployment with no configured basemap never
renders the map — and with it, never renders the cluster; the checkpoints page already solves this
the same way, and creation must not become unreachable in that environment.

### R9 — Success is a refetch plus a deliberate reveal

**Decision**: On 201, invalidate the warehouse list query, then navigate to
`{ create: undefined, warehouseId: <new id>, status: 'available', search: '' }`.

**Rationale**: FR-016 requires the new warehouse to be visible and selected even when the previous
lifecycle view or search would hide it. Resetting `status` to `available` and clearing `search` is
the minimal change that guarantees it, and mirrors how the checkpoints page widens its kind filter
after a successful creation.

### R10 — Test seams

**Decision**:

- API unit (`tests/unit/warehouses/creation/create.spec.ts`): `WarehousePolicy.create` per role, use
  case normalization and geometry rejection against a swapped repository, duplicate-name mapping to
  the exception.
- API unit (`tests/unit/warehouses/creation/footprint_geometry.spec.ts`): the pure geometry module —
  triangles, concave shapes, bow-ties, duplicate consecutive points, closing-edge crossings.
- API integration (`tests/integration/warehouses/creation/create.spec.ts`): 201 body and persisted
  point order, 409 on a duplicate name differing by case and whitespace and on an archived
  warehouse's name, 422 on fewer than 3 points and on a crossing outline, 401 unauthenticated, 403
  for a non-administrator, and no row left behind on any rejection.
- Web (`features/warehouses/__tests__/create/`): `drawing.test.tsx` (arming, vertex add/drag/undo,
  clicks not selecting existing warehouses), `create.test.tsx` (success, selection reveal, filter
  reset), `validation.test.tsx` (blank name, <3 points, conflict, crossing outline, preservation
  after rejection), `permissions.test.tsx` (control hidden, direct `?create=warehouse` inert).
- Web unit: `features/warehouses/__tests__/footprint-validation.test.ts` and
  `components/resource-map/__tests__/resource-map-polygon-placement.test.tsx`.

**Rationale**: Mirrors the split the dock and weighing-area create slices established, and gives
`/speckit-tasks` concrete RED targets for every functional requirement.

### R11 — Arming the canvas does not silence the polygon layer

**Decision**: `WarehousePolygons` takes a `disabled` prop that turns off `interactive` on its
`MapGeoJSON` layer, disables its focusable markers, and suppresses its tooltip for the whole
duration of the creation mode.

**Rationale**: found while driving the real map rather than the test double. `useResourceMapPlacement`
registers a handler on the map canvas, but `MapGeoJSON` registers its own **layer-scoped** handler,
and MapLibre dispatches both. Arming the map alone would therefore have added a boundary point *and*
opened the clicked warehouse's details — precisely what FR-002a forbids. The page-level test double
could not surface this, so `warehouse-polygon.test.tsx` pins it at the component level instead.

### R12 — Finishing the outline, and folding the coordinates away

**Decision** (product review after manual testing): clicking the first boundary point closes the
ring and disarms the map; the raw coordinate fields move behind a disclosure collapsed by default.

**Rationale**: with every click appending a point, a stray click on a finished polygon silently
reshaped it — often into a self-crossing outline whose error message arrived long after the mistake.
Closing on the first vertex is the convention of map drawing tools and needs no extra control.
Finishing deliberately does **not** gate submission: a footprint of three valid points is valid
whether or not it was finished, so making it a precondition would add a step without adding safety.
A latitude/longitude pair per vertex crowded the panel from four points onward while being the
fallback path, not the expected one — folding it away keeps the pointer-free route without giving it
the panel.

**Alternatives considered**: inserting a click on the nearest edge instead of appending (fixes the
self-crossing symptom but makes the drawn order unpredictable, and the drawn order is exactly what
FR-013 preserves); an explicit "Finish outline" button in the panel (one more control for what a
vertex click already conveys); removing the coordinate fields entirely (drops the only pointer-free
path, breaking FR-004 and the accessibility edge case).

## No open questions

Every `NEEDS CLARIFICATION` candidate raised while filling Technical Context was resolved above from
the existing codebase, `CONTEXT.md`, ADR-0006, or the spec's Assumptions section. None remain.
