# Phase 0 Research: Update a Warehouse

**Feature**: [spec.md](./spec.md) | **Issue**: [#209](https://github.com/whazzark/portflow-ai/issues/209)

## Starting position found in the codebase

- **The API has a warehouse write path, but only one.** `WarehousesController` exposes `index` and
  `store`; `WarehouseRepository` declares `create` and `list`; `WarehousePolicy` declares `create`
  and `list`. There is no `update`, no `PATCH` route, and no warehouse update use case.
- **The schema is complete.** `warehouses` and `warehouse_footprint_points` exist from #207, with
  `(warehouse_id, position)` as the footprint primary key, latitude/longitude CHECK constraints, and
  the `LOWER(name)` unique index. `warehouse_doors` exists with `ON DELETE RESTRICT` toward its
  warehouse. **No migration is required.**
- **The geometry rule is already pure and already shared-ready.** `assertSimpleFootprint` in
  `apps/api/app/warehouses/shared/footprint_geometry.ts` checks duplicate consecutive points,
  self-intersection, and the flat-ring residue — and its own docblock says the update slice reuses it
  without going through HTTP. Its web mirror is `features/warehouses/geometry/footprint-validation.ts`.
- **The closest precedent for an update slice is #199 (Update a Dock), and it is a good one.**
  `UpdateDockUseCase` normalizes, delegates to `DockRepository.updateAvailable`, and maps four result
  kinds (`NOT_FOUND`, `ARCHIVED`, `DUPLICATE_NAME`, `UPDATED`) to four exceptions. On the web,
  `useCheckpointEditSession` owns "an administrator is part-way through correcting this resource"
  with three hardened rules, and `EditCheckpointPanel` is the sheet that consumes it.
- **The drawing surface exists but only draws.** `PendingPolygonPlacement` arms map clicks through
  `useResourceMapPlacement`, appends a vertex per click, renders the outline plus one draggable
  marker per vertex, and turns the first vertex into a "Finish the outline" control. It has no
  insertion, no removal, and no un-armed mode.
- **The warehouse DTO already carries the doors.** `WarehouseTransformer` serializes `doors` with
  their coordinates, so the client can evaluate door containment locally without a second request.
- **The typed client registry is committed.** `apps/api/.adonisjs/client/registry/index.ts` lists
  `warehouses.index` and `warehouses.store`; a new route means a regenerated, reviewed diff there.

## Decisions

### R1 — `PATCH /api/v1/warehouses/:id`, with the footprint replaced whole

**Decision**: One route, `PATCH`, taking `{ name?, footprint?: { points: [...] } }` where at least one
of the two must be present. `footprint` carries the **complete** resulting ordered sequence; there is
no per-point patch operation. Success returns 200 with the same warehouse DTO `index` and `store`
return.

**Rationale**: `PATCH /:id` with an optional-but-at-least-one payload is exactly what
`updateDockValidator` already expresses (`requiredWhen` + `requiredIfMissing`), so #209 reads like
#199 to any reviewer. Replacing the footprint whole is the spec's own assumption: the outline has no
per-point identity and no per-point history, and `position` is part of the primary key, so a partial
point patch would need an addressing scheme the domain does not have. The request mirrors the read
contract's `footprint.points` shape, as #208 R1 decided for creation.

**Alternatives considered**: `PUT` with a full representation — rejected, it forces the client to
resend the name when only the outline moved and vice versa, and diverges from the dock precedent.
Sub-resource routes (`PATCH /:id/footprint`) — rejected, it would make FR-004's all-or-nothing rule
depend on the client issuing two requests.

### R2 — Structural validation in Vine, business rules in the use case

**Decision**: `updateWarehouseValidator` owns shape only — optional `name` (non-blank, 1–255),
optional `footprint.points` (3–`MAX_FOOTPRINT_POINTS`, each with in-range numeric coordinates), and
"at least one of the two". `UpdateWarehouseUseCase` owns name normalization, the geometry assertion,
the door-containment decision, and the mapping of repository result kinds to exceptions.

**Rationale**: This is #208 R2 applied unchanged, and it is what keeps FR-027 true — a rule enforced
in the validator alone would be bypassable by any future non-HTTP caller. It also keeps the 422
bodies field-addressed for the coordinate and name cases, which FR-024 requires.

**Alternatives considered**: Putting the minimum-three rule only in Vine — rejected, the use case
must hold it for the same reason creation does.

### R3 — Footprint replacement is delete-all + insert-all in one transaction

**Decision**: `LucidWarehouseRepository.updateAvailable` opens one transaction, updates the row
guarded by `where('id', id).where('status', 'AVAILABLE')`, and — when a footprint was submitted —
deletes every `warehouse_footprint_points` row for that warehouse and re-inserts the submitted
sequence with `position` taken from the submitted order. `updatedAt` is always bumped.

**Rationale**: `(warehouse_id, position)` is the primary key, so an in-place diff would have to
renumber positions around insertions and deletions — a reordering dance whose only benefit would be
touching fewer rows in a table holding a handful of them. Delete-and-reinsert inside the transaction
is the simplest thing that satisfies FR-015 (the previous footprint leaves nothing behind) and FR-020
(no partially replaced footprint), and it makes the stored ring reproduce the submitted order by
construction, exactly as creation does.

**Alternatives considered**: Diffing by index — rejected as above. Two transactions (row, then
points) — rejected, it is precisely the partial state FR-020 forbids.

### R4 — Existence, lifecycle, and containment are decided on a read, then re-guarded on the write

**Decision**: The use case first asks the repository for the warehouse **with its doors**. Absent →
`WarehouseNotFoundException`. Archived → `ArchivedWarehouseReadOnlyException`. Doors that the new
outline would exclude → `WarehouseDoorsOutsideFootprintException`. Only then does it call
`updateAvailable`, whose `status = 'AVAILABLE'` guard still returns `NOT_FOUND` / `ARCHIVED` and is
mapped to the same exceptions.

**Rationale**: The containment decision needs the doors, so a read is unavoidable; deciding
existence and lifecycle from that same read costs nothing and gives FR-024 its distinct outcomes
before any write is attempted. The guarded write is kept because it is the only thing that closes the
window in the spec's own edge case — a warehouse archived by another administrator after the panel
was opened must be refused on submission, not silently updated.

**Alternatives considered**: Doing everything in the repository — rejected, it would move a business
decision (containment) into persistence mechanics, against Principle V. Relying on the read alone —
rejected, it loses the concurrent-archive edge case.

### R5 — Containment is a new pure function beside the existing geometry rules

**Decision**: Add `containsPoint(points, point)` to `footprint_geometry.ts`: a ray-cast even-odd test
preceded by an explicit on-boundary test, so a point lying exactly on an edge or on a vertex counts
as contained. Mirror it in the web guard as `isInsideFootprint`.

**Rationale**: Even-odd ray casting is undefined on the boundary, and the spec makes the boundary an
explicit accepted case ("a door sits exactly on the reshaped outline … the update is accepted"),
matching the door contract from roadmap #44 ("within **or on** the boundary"). Testing the boundary
first turns an undefined case into a specified one. The function joins the module that already holds
the planar-geometry assumption for this site, and stays free of warehouse vocabulary.

**Alternatives considered**: A spatial extension in PostgreSQL — rejected, it would introduce PostGIS
for one predicate over a handful of vertices. Winding-number — rejected, same result here at more
cost, and it still needs the boundary special case.

### R6 — Containment is evaluated against every door, whatever its status

**Decision**: The check runs over the warehouse's full `doors` relation, available and archived alike.

**Rationale**: The spec settles this, and the reason holds in the data: an archived door keeps its
recorded position and stays consultable inside its warehouse's footprint (#44 FR-007), so letting an
archived door fall outside would break the same invariant the check exists to protect.

### R7 — The web geometry guard is duplicated again, deliberately

**Decision**: `containsPoint` is implemented twice — authoritatively in `apps/api`, and as pre-submit
feedback in `apps/web` — each with its own unit tests, exactly as #208 R6 did for
`assertSimpleFootprint`.

**Rationale**: The workspace still has no shared package, and this slice adds one more ~25-line pure
function rather than the first cross-workspace package. The client copy is what lets the panel name
the offending doors before a round-trip and keep submit disabled; the API stays the enforcement point.

**Alternatives considered**: Introducing `packages/geometry` now — deferred, not rejected. With this
slice the duplicated surface reaches two functions; the warehouse-door slices (#44) will need the
same containment predicate, and that is the point at which a shared package becomes an
evidence-backed decision rather than speculation. Recorded in the plan's Complexity Tracking.

### R8 — A sibling map layer, not a `mode` prop on the drawing layer

**Decision**: Add `components/resource-map/resource-map-polygon-editing.tsx` exporting
`EditablePolygonPlacement`, beside the existing `resource-map-polygon-placement.tsx`. Extract the
shared outline rendering into a small `PolygonOutline` used by both. Neither knows what a warehouse is.

**Rationale**: The two layers share their looks and almost nothing else. Drawing arms the map,
appends on click, and closes a ring; editing never arms the map, inserts on a designated edge, and
removes any vertex. A `mode: 'draw' | 'edit'` prop would gate nearly every branch inside one
component and produce a props union where half the callbacks are meaningless in each mode —
`onComplete`/`completed` mean nothing while editing, `onInsertPoint`/`onRemovePoint` mean nothing
while drawing. Splitting keeps each component's contract honest; extracting the outline keeps them
visually identical, which is the part that actually must not drift.

**Alternatives considered**: The `mode` prop — rejected as above. Full duplication with no shared
outline — rejected, the two outlines would drift apart in style at the first design change.

### R9 — Insertion is a click on a per-edge midpoint handle

**Decision**: `EditablePolygonPlacement` renders one small hollow handle at the midpoint of each
edge. Clicking it inserts a real vertex there, at `index + 1` in the boundary order; the administrator
then drags that vertex where they want it. The handle attaches its click listener natively and stops
propagation, the way `FinishOutlineButton` already does.

**Rationale**: FR-006a requires the gesture itself to designate the receiving edge, and a midpoint
handle is the convention every map and vector editor already teaches. Click-then-drag is two gestures
rather than one, but it is deterministic, keyboard-reachable, and directly testable — a drag-to-insert
handle would have to hand its drag over to a different marker mid-gesture, which MapLibre markers make
awkward for no behavioral gain. The native-listener technique is copied because MapLibre appends
marker elements to the canvas container and its own listener runs before React's delegated handler.

**Alternatives considered**: Insert on the nearest edge from any map click — rejected by the spec
(FR-006a) and by the reasoning recorded in its Assumptions. Drag-to-insert — deferred as a later
refinement over the same underlying `onInsertPoint(index, point)` contract.

### R10 — Removal is per-vertex, blocked at three, and offered on both paths

**Decision**: Each vertex marker is a real `<button>`; focusing or hovering it reveals a remove
control, and `Delete` / `Backspace` removes the focused vertex. The control is disabled with an
explanation when the outline holds exactly three points. The coordinate panel carries the same
per-point remove, plus "insert after this point" pre-filled with the split edge's midpoint. Creation's
"Remove last point" button has no equivalent here.

**Rationale**: FR-006b and FR-006d. The three-point block is what keeps the interface from letting an
administrator reach a state only a server refusal could get them out of, and pre-filling an inserted
point with the edge midpoint means the pointer-free path never passes through an invalid outline —
the same property the map path has for free.

### R11 — An update session, mirroring the checkpoint one without generalizing it

**Decision**: New `features/warehouses/use-warehouse-edit-session.ts`, carrying the three rules
`useCheckpointEditSession` hardened after #199: the session is discarded when the selection it belongs
to changes or disappears; `editable` and the original footprint are snapshotted once at session start
and never re-derived from live query data; nothing lets a caller re-arm a session for a mismatched
selection. It is **not** a generalization of the checkpoint hook.

**Rationale**: The rules transfer; the state does not. A checkpoint session drafts one `LatLng`; a
warehouse session drafts a `LatLng[]` with insert-at-index and remove-at-index operations. Unifying
them would produce a hook generic over "a point or a sequence of points" whose only two callers each
use half of it. Copying the discipline and citing where it comes from is the cheaper, clearer move —
and the checkpoint hook lives under `features/checkpoints/`, so reuse would mean a cross-feature
import that the codebase's vertical-slice convention does not make.

**Alternatives considered**: Promoting the checkpoint hook into `components/resource-map/` and making
it generic — rejected for now; if a third editable-geometry resource appears, that is the moment.

### R12 — While editing, the edited polygon is owned by the editing layer

**Decision**: The warehouse being corrected is excluded from `WarehousePolygons` while its session is
open; `EditablePolygonPlacement` renders it instead. Its **doors stay rendered**. Selection clicks on
other polygons are disabled, and `FitWarehouseBounds` is suppressed for the duration.

**Rationale**: Two polygons drawn over each other — the stored one and the draft — would make it
impossible to see what is being changed. The doors are the opposite case: they are the constraint the
administrator is shaping around, so hiding them would make FR-016's refusal feel arbitrary.
Suppressing the auto-fit is what the map already does while creation is armed, and for the same
reason: refitting on every vertex move would fight the administrator's own panning.

### R13 — Success keeps the warehouse visible and selected

**Decision**: On success, invalidate the warehouse list query, leave the update mode by dropping the
`edit` search param, keep the warehouse selected, and clear the name search if the renamed warehouse
would otherwise fall out of the current view.

**Rationale**: FR-021 requires the saved result to be authoritative everywhere without a reload, and
the page already drops `warehouseId` when the selected warehouse is not in the visible set — so a
rename out of an active search filter would silently deselect the warehouse the administrator just
corrected. Clearing the search is the same deliberate reveal #208 R9 made after creation. The status
filter needs no such treatment: an update cannot change a warehouse's status.

### R14 — Test seams

**Decision**:

| Seam | Location | Covers |
|---|---|---|
| Use case unit | `apps/api/tests/unit/warehouses/update/update.spec.ts` | normalization, geometry refusal, containment refusal, result-kind → exception mapping, partial payloads |
| Geometry unit | `apps/api/tests/unit/warehouses/update/footprint_containment.spec.ts` | inside, outside, on-edge, on-vertex, concave outline |
| HTTP integration | `apps/api/tests/integration/warehouses/update/update.spec.ts` | 200/401/403/404/409/422 per FR-024, atomicity, footprint round-trip, unchanged-resubmission |
| Web session | `apps/web/src/features/warehouses/__tests__/update/session.test.tsx` | arming, pre-fill, mode exclusivity, cancel restores, session discarded on selection change |
| Web reshape | `.../__tests__/update/reshape.test.tsx` | drag, insert on a designated edge, remove any vertex, three-point block, click away is inert |
| Web validation | `.../__tests__/update/validation.test.tsx` | name errors, duplicate, geometry, doors outside, preserved input on refusal |
| Web permissions | `.../__tests__/update/permissions.test.tsx` | action hidden without permission, archived read-only, inert `edit` param |
| Web geometry unit | `.../__tests__/footprint-containment.test.ts` | mirror of the API geometry unit |
| Shared layer | `apps/web/src/components/resource-map/__tests__/resource-map-polygon-editing.test.tsx` | handles rendered per edge, insert index, remove index, no map arming |

**Rationale**: Every requirement lands on exactly one seam, and none of this behavior exists yet, so
RED → GREEN applies throughout (Principle IV).

## No open questions

The spec carries no `[NEEDS CLARIFICATION]` markers. The two interaction questions raised at review —
where an inserted point goes, and which points may be removed — were settled into FR-006a and FR-006b
before planning, and this document only records how they are built.
