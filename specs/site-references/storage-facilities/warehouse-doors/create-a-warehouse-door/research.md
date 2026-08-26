# Phase 0 Research: Create a Warehouse Door

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Issue**: [#213](https://github.com/whazzark/portflow-ai/issues/213)

## Starting position found in the codebase

**No warehouse-door write path exists today.** `WarehouseDoorsController` exposes only `available`,
`WarehouseDoorRepository` declares only `listAvailable()`, and `WarehouseDoorPolicy` declares only
`listAvailable()`. On the web, `features/warehouse-doors/` is consultation-only: a panel, a marker,
a legend, and a presentation module — no mutation hook, no form, no map mode.

What *does* already exist and is reused unchanged:

| Asset | Location | Why it matters |
|---|---|---|
| `warehouse_doors` table | `apps/api/database/migrations/1784900000000_create_warehouse_doors_table.ts` | `(warehouse_id, LOWER(name))` unique index, `name = TRIM(name)` and `LENGTH(name) > 0` CHECKs, latitude/longitude range CHECKs, `RESTRICT` FK to `warehouses` — **no migration is needed for this slice** |
| `containsPoint` | `apps/api/app/warehouses/shared/footprint_geometry.ts` | Authoritative "within or on the boundary" test, boundary-first by design, already unit-tested by #209 |
| `isInsideFootprint` | `apps/web/src/features/warehouses/geometry/footprint-validation.ts` | The browser mirror of the same rule, already unit-tested (`footprint-containment.test.ts`) |
| Site-reference name helpers | `apps/api/app/site_references/shared/normalize_site_reference.ts` | `normalizeSiteReferenceName`, `MAX_SITE_REFERENCE_NAME_LENGTH`, `isLegalSiteReference{Latitude,Longitude}` — the same normalization every other site reference uses |
| `isUniqueViolation` | `apps/api/app/shared/database/is_unique_violation.ts` | The duplicate-name detection path `LucidWarehouseRepository.create` already uses |
| `ArchivedWarehouseReadOnlyException`, `WarehouseNotFoundException` | `apps/api/app/warehouses/shared/warehouse_exceptions.ts` | The two eligibility failures already have codes (R3) |
| `useResourceMapPlacement` + `PendingPlacementMarker` | `apps/web/src/components/resource-map/resource-map-placement.tsx` | Arms the canvas, suppresses its normal click behaviour, and renders the draggable pending mark — exactly FR-003, FR-004, FR-022, FR-023 |
| `useCoordinateFields` + `CoordinateField` | `apps/web/src/components/resource-map/resource-placement-fields.tsx` | The synced, string-backed lat/lng pair with parse and range errors — exactly FR-004 and FR-013's accessible path |
| `CheckpointPlacementLayer` | `apps/web/src/features/checkpoints/map/checkpoint-map.tsx` | The composition pattern the warehouse map's door layer copies one-for-one (R7) |
| `isAdministrator` | `apps/web/src/features/auth/policies/permissions.ts` | The client-side gate `WarehousesPage` already applies as `canManageWarehouses` |

## Decisions

### R1 — A flat `POST /api/v1/warehouse-doors`, with the warehouse named in the body

**Decision**: `POST /api/v1/warehouse-doors` accepting `{ warehouseId, name, latitude, longitude }`,
registered as `warehouse_doors.store` in the existing `/warehouse-doors` route group.

**Rationale**: Every site reference in `start/routes.ts` is a flat group with `POST /` as `store`,
and `/warehouse-doors` already exists as a group with `available` in it. A flat route keeps the
Tuyau surface uniform (`tuyauQuery.warehouseDoors.store`, beside the existing
`tuyauQuery.warehouseDoors.available`) and keeps every warehouse-door operation reachable from one
place as #214–#216 add theirs.

**Alternatives considered**: `POST /api/v1/warehouses/:warehouseId/doors`, which expresses
containment in the path and would turn "warehouse not found" into a routing-level 404. Rejected
because it would be the repository's only nested resource, would split warehouse-door operations
across two route groups, and buys nothing the body cannot carry: the warehouse is validated as a
precondition either way, and FR-008 is satisfied by the **client** always sending the warehouse whose
action was activated, not by the URL shape.

### R2 — Structural validation in Vine, eligibility and containment in the use case

**Decision**: `createWarehouseDoorValidator` enforces structure — `warehouseId` a UUID, `name`
`nonBlank`/1–255, `latitude` in [-90, 90], `longitude` in [-180, 180].
`CreateWarehouseDoorUseCase` then trims the name, re-checks length, and owns the containment
decision, which it hands to the repository as a predicate (R5).

**Rationale**: This is the split every other creation slice uses — Vine owns shape and range, the
use case owns normalization and domain assertions. Keeping containment out of Vine is what lets it be
evaluated against the footprint read *inside* the transaction rather than against a pre-flight read.

**Note**: the range check appears twice on purpose — Vine rejects an out-of-range coordinate at the
edge, and the use case re-asserts it through `isLegalSiteReferenceLatitude`/`Longitude` so a caller
reaching the use case directly (a future import, a seeder) cannot bypass the rule. `CreateWarehouseUseCase`
already does exactly this.

### R3 — Eligibility failures reuse the warehouse's own error codes

**Decision**: a missing warehouse raises `WarehouseNotFoundException` (404, `E_WAREHOUSE_NOT_FOUND`)
and an archived one raises `ArchivedWarehouseReadOnlyException` (409, `E_WAREHOUSE_ARCHIVED`), both
imported from `#warehouses/shared/warehouse_exceptions`. Only the genuinely door-specific
failures get new codes, in a new `warehouse_door_exceptions.ts`.

**Rationale**: The failing fact in both eligibility cases is about the *warehouse*, not the door —
the warehouse is missing, or the warehouse is archived and read-only. `E_WAREHOUSE_ARCHIVED` already
means exactly "this warehouse is read-only, reactivate it first", which is precisely what the
administrator must do. Minting `E_WAREHOUSE_DOOR_WAREHOUSE_ARCHIVED` beside it would give one
condition two codes and force the web client to map both.

**Alternatives considered**: a door-namespaced code per failure (rejected: duplicates an existing
fact, and constitution principle VI forbids a second hand-maintained home for one decision); a
generic 422 for both (rejected: loses the "reactivate the warehouse first" guidance the existing
message already carries).

**New codes** (`apps/api/app/warehouse_doors/shared/warehouse_door_exceptions.ts`):

| Exception | Status | Code |
|---|---|---|
| `DuplicateWarehouseDoorNameException` | 409 | `E_WAREHOUSE_DOOR_NAME_CONFLICT` |
| `InvalidWarehouseDoorNameException` | 422 | `E_WAREHOUSE_DOOR_NAME_INVALID` |
| `WarehouseDoorOutsideFootprintException` | 422 | `E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT` |
| `InvalidWarehouseDoorCoordinatesException` | 422 | `E_WAREHOUSE_DOOR_COORDINATES_INVALID` |

### R4 — Outside-footprint is 422, not 409

**Decision**: a point outside the containing warehouse's footprint is a 422
`E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT`.

**Rationale**: The offending value is in the submitted payload and the administrator fixes it by
moving the marker — the definition of an unprocessable entity. #209's
`E_WAREHOUSE_DOORS_OUTSIDE_FOOTPRINT` is a 409 for the mirror-image situation, where the submitted
*outline* conflicts with *stored* doors the submitter did not send; there the conflict is with server
state, here it is with the payload.

**Alternatives considered**: 409 for symmetry with #209 (rejected: it would tell the client the
conflict is with something it did not submit, when in fact the single submitted point is the thing
to correct).

### R5 — The warehouse is read under lock inside the write transaction

**Decision**: `LucidWarehouseDoorRepository.create` opens a transaction, selects the warehouse
`.where('status', 'AVAILABLE').forUpdate()` with `footprintPoints` preloaded, evaluates the caller's
containment predicate against those points, and only then inserts the door. The command carries
`contains: (points) => boolean`, mirroring the `excludedDoors` callback
`UpdateWarehouseCommand` already uses.

**Rationale**: `updateAvailable` established this exact shape and its reasoning: the guarded read
holds the warehouse row for the rest of the transaction, so the eligibility and containment rules are
checked against the same snapshot the insert lands in. Without the lock, a warehouse archived (#210)
or re-outlined (#209) between a pre-flight read and the insert would leave an available door under an
archived warehouse, or a door outside its own footprint — breaking the invariant #209 exists to
protect, from the other direction.

**Result arms**: `CREATED` | `WAREHOUSE_NOT_FOUND` | `WAREHOUSE_ARCHIVED` | `OUTSIDE_FOOTPRINT` |
`DUPLICATE_NAME`. `DUPLICATE_NAME` comes from `isUniqueViolation` on the
`(warehouse_id, LOWER(name))` index rather than from a pre-read, so two near-simultaneous submissions
of the same name resolve to exactly one door (FR-020) without a second round-trip. A non-UUID
`warehouseId` short-circuits to `WAREHOUSE_NOT_FOUND` through `isUuid`, the same guard
`findWithDoors` uses, so a mistyped identifier is a 404 rather than a Postgres `22P02` 500.

### R6 — The create response exposes `createdAt`; the embedded read shape is untouched

**Decision**: `WarehouseDoorTransformer` gains `createdAt`. The door objects the
`WarehouseTransformer` embeds under `warehouses.index` are **not** changed.

**Rationale**: FR-016 requires the creation time to be recorded and US1 scenario 5 requires it to be
observable on the door that was just created; the transformer that serializes the 201 response is the
honest place for it. The change is additive and the only other consumer,
`warehouse_doors.available`, ignores unknown-to-it fields. Leaving the embedded shape alone is what
keeps every #212 consultation test passing unchanged in substance, and keeps the warehouse collection
from growing a field no consultation surface renders.

**Alternatives considered**: a second create-only transformer (rejected: two DTOs for one entity, for
one field); adding `createdAt` to the embedded doors too (rejected: it widens the read contract of a
collection that already carries 200 warehouses' worth of doors, for a field nothing displays).

### R7 — Reuse the point primitives; add a local layer to the warehouse map

**Decision**: `warehouse-map.tsx` gains a `doorPlacement?: WarehouseMapDoorPlacement` prop and a
local `WarehouseDoorPlacementLayer` that calls `useResourceMapPlacement({ armed, onPlace })` and
renders `PendingPlacementMarker` with a door icon and a "New door" label. Nothing is added to
`components/resource-map/`.

**Rationale**: `CheckpointPlacementLayer` in `checkpoint-map.tsx` is the identical composition, and it
lives in the feature rather than in the shared folder — because what is shared is the *hook and the
marker*, while the icon, the label, and which prop arms them are the feature's business. Copying that
placement decision keeps the shared surface at two consumers rather than growing a third abstraction
over them.

**Coexistence**: the polygon layer (`placement`) and the door layer (`doorPlacement`) both hook map
clicks, so the page must never arm both. That is guaranteed upstream by the mode being a single
`create` value (R8), and asserted in the UI-state contract.

### R8 — The mode lives in the URL as `create=door`, scoped by `warehouseId`

**Decision**: the route's `create` param becomes `z.enum(['warehouse', 'door'])`. Door creation is
active when `create === 'door'`, the user is an administrator, and `warehouseId` names a warehouse
that is present and `AVAILABLE`. Any other combination renders ordinary consultation.

**Rationale**: #208's R5 already put the warehouse creation mode in the URL, and mode exclusivity
falls out of a single param holding a single value. Requiring `warehouseId` is what makes the mode
*scoped to the selected warehouse* rather than to the page — which is FR-002 and FR-008 expressed as
navigation rather than as a guard. A deep link to `create=door` without a selectable available
warehouse is inert for the same reason `create=warehouse` is inert without the permission.

**Alternatives considered**: local component state (rejected: not deep-linkable, and #208 already
rejected it); a separate `createDoor` param (rejected: two params would let both modes be true at
once, which R7 says the map cannot render).

### R9 — The map keeps fitting while door placement is armed

**Decision**: `WarehouseMap`'s `isArmed` — which suppresses `FitWarehouseBounds` and disables polygon
selection — is computed from the polygon `placement` and `editing` props only. Door placement
disables polygon selection but does **not** suppress the fit.

**Rationale**: `isArmed` suppresses the fit because a drawing or edited ring changes the bounds under
the administrator on every vertex. Door placement changes no polygon: the bounds are the selected
warehouse's stored footprint, fixed for the whole session, and the pending point is not part of them.
Keeping the fit is what makes a deep link to `create=door&warehouseId=…` frame the warehouse the
administrator is about to place a door in, instead of dropping them on the world view.

### R10 — The entry point is the Doors panel header, not the map's create control

**Decision**: "Create door" is a button in `WarehouseDoorsPanel`'s header, rendered only for an
administrator and only when the selected warehouse is `AVAILABLE`. The map's
`ResourceMapCreateControl` keeps its single "Create warehouse" action.

**Rationale**: FR-002 requires the action to be offered within the selected warehouse's context, and
FR-007 requires it to be absent for an archived warehouse. The Doors panel is the only surface that
is *already* scoped to one warehouse, and its header was built with an empty trailing slot. Putting
the action in the map's control cluster would make it page-scoped and force it to answer "which
warehouse?" — the question the panel's existence already answers. This also mirrors how the sheet's
footer offers "Edit" only for an available warehouse.

**Absent, not disabled** — the same choice the sheet footer already makes for archived warehouses (#211) and the truck
details make for archived trucks.

### R11 — Success is a refetch plus a deliberate reveal

**Decision**: the create mutation invalidates `warehouseQueries.list()` on success. The page then
navigates to `{ create: undefined, doorStatus: 'available', doorId: <new id> }`, keeping
`warehouseId`, and toasts "Door created".

**Rationale**: The warehouse collection embeds every door, so one invalidation is the whole refresh
(the same reasoning `useWarehouseMutations` already records). The explicit navigation is FR-017:
without it, an administrator who had the Archived door view open would submit successfully and see
nothing, because the new door is Available. `status` and `search` are deliberately *not* reset —
unlike #208, the containing warehouse is already selected and visible, and `search` only annotates
matches rather than pruning the collection.

### R12 — Test seams

**Decision**:

| Layer | File | Covers |
|---|---|---|
| API unit | `tests/unit/warehouse_doors/creation/create.spec.ts` | Name trimming and length, coordinate range, containment refusal, each repository result arm mapped to its exception, Available status and creation time on success |
| API unit | `tests/unit/warehouse_doors/warehouse_door_policy.spec.ts` | `create` allows both admin roles and refuses every other role and access status |
| API integration | `tests/integration/warehouse_doors/creation/create.spec.ts` | 201 body and persisted row; 401, 403, 404, 409 archived, 409 duplicate (including cross-case and archived-door name), 422 blank/too long/out-of-range/outside-footprint; a name reused across warehouses succeeding |
| Web | `features/warehouse-doors/__tests__/create/placement.test.tsx` | Arming, click-to-place, marker move, coordinate sync, cancel discarding the pending point, map clicks not selecting warehouses or doors |
| Web | `features/warehouse-doors/__tests__/create/create.test.tsx` | Successful creation, the reveal in the Available view, the toast, refetch |
| Web | `features/warehouse-doors/__tests__/create/validation.test.tsx` | Blank name, duplicate name (409), outside footprint (client guard and 422), out-of-range coordinate, name and pending point preserved after each rejection, generic failure toast |
| Web | `features/warehouse-doors/__tests__/create/permissions.test.tsx` | Action absent for non-administrators, absent for an archived warehouse, `create=door` inert without permission or without a valid selected warehouse |

**Rationale**: This mirrors the file split #208 used for warehouse creation, so the two creation
slices stay legible side by side. The web tests drive the existing `mock-warehouse-map` seam, which
gains a door-placement affordance the same way it already exposes the polygon one.

## No open questions

Every `[NEEDS CLARIFICATION]` slot was resolved during specification: the eligibility rule, the
warehouse-scoped name uniqueness, the required in-footprint placement, the automatic Available
status, and the one-door-per-submission boundary are all recorded in the spec's Assumptions and
re-derived above from #209, #210, and #212 rather than invented here.
