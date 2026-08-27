# Phase 0 Research: Update a Warehouse Door

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

No `NEEDS CLARIFICATION` marker survived `/speckit-specify`, so this phase resolves design
questions rather than product ones. Each decision below is consumed by `data-model.md`, the
contracts, or `quickstart.md`.

---

## R1 — Verb, route, and payload shape

**Decision**: `PATCH /api/v1/warehouse-doors/:id` with a flat, partial body
`{ name?, latitude?, longitude? }`. At least one member must be present; `latitude` and `longitude`
are required *together* through Vine's `requiredIfExists`, so a position is always submitted whole.
Verified against the pinned `@vinejs/vine@4.4.0`, which implements `requiredIfExists(fields)` on
top of the `requiredWhen` rule the sibling validators already use.

**Rationale**: `PATCH /:id` with a partial body is the established update shape on this API —
`warehouses.update` and `docks.update` both use it, and `EditCheckpointPanel` already speaks it. The
members stay **flat** because `POST /api/v1/warehouse-doors` already takes `latitude` and `longitude`
flat: the same two fields of the same resource should not change shape between create and update.
`requiredIfExists` on each coordinate is what makes "the position is replaced as a whole" (spec
Assumption) a *structural* rule rather than a use-case check — a body carrying only `latitude` is a
422 before any business code runs.

**Alternatives considered**:

- **A nested `position: { latitude, longitude }` object**, mirroring `warehouses.update`'s
  `footprint: { points }`. Rejected: the warehouse nests because a footprint is a *collection* whose
  partial submission would be meaningless. A door's position is two scalars the create contract
  already sends flat, and nesting them would make the two door endpoints disagree.
- **`PUT` with a complete representation.** Rejected: it would force the client to resend the name on
  a pure reposition and vice-versa, and FR-004 explicitly wants "name alone, position alone, or both".
- **Copying `updateDockValidator` verbatim.** Rejected: that validator marks each coordinate
  `.optional().requiredWhen(hasOwn)` without tying the pair together, so a dock accepts a latitude
  with no longitude. That is a dock quirk this slice should not inherit, given the spec's explicit
  "replaced as a whole".

---

## R2 — Lock order inside the write transaction

**Decision**: the containing **warehouse is locked first** (`forUpdate`, filtered on
`status = 'AVAILABLE'`, with `footprintPoints` preloaded in `position` order), and only then is the
door row updated under its own `status = 'AVAILABLE'` guard. The door's `warehouse_id` is learned by
an **unlocked pre-read** before the transaction opens.

**Rationale**: every existing writer that touches both tables takes the warehouse first —
`LucidWarehouseDoorRepository.create` (#213) locks the warehouse then inserts the door, and #210's
archival cascade locks the warehouse then updates its doors. Taking the door first here would
introduce the *opposite* order and with it a genuine deadlock against the cascade. The unlocked
pre-read is safe precisely because of the domain rule this slice cannot change: a door belongs
**permanently** to one warehouse (`CONTEXT.md`), so the `warehouse_id` it yields can never go stale.

Locking the warehouse also gives the transaction the two facts it needs from the same snapshot the
door write lands in: the warehouse's eligibility (FR-016) and the footprint containment must be
evaluated against (FR-013a). This is the same argument #213's `research.md` made for creation, and
the same `contains` predicate shape is reused.

**Alternatives considered**:

- **Skip the warehouse lock on a name-only update.** Rejected: it splits the repository into two
  transaction shapes to save one row lock on an operation performed a handful of times a week, and
  the eligibility rule (FR-016) needs the warehouse read regardless.
- **Lock the door row and read the warehouse unlocked.** Rejected: reverses the established lock
  order (deadlock against the cascade) *and* leaves containment evaluated against a footprint #209
  could replace concurrently.

---

## R3 — Which containment check runs, and when

**Decision**: the `contains` predicate is passed to the repository **only when the submission carries
a position**. A name-only update runs no containment check.

**Rationale**: a stored door is already inside its warehouse's footprint, and #209 refuses any
reshape that would leave a door outside it (`WarehouseDoorsOutsideFootprintException`). So for a
name-only update there is no reachable state where the stored position violates FR-013 — running the
check would either be a no-op or, worse, refuse a legitimate rename because of a violation this
slice did not cause and cannot fix.

**Alternative considered**: always check containment, using the stored position when none is
submitted. Rejected for the reason above: it would convert a data-integrity problem owned by #209
into a rename failure the administrator has no way to resolve.

---

## R4 — Resubmitting the door's own name needs no special case

**Decision**: FR-011 (own current name accepted) and the case-only correction edge case are satisfied
by the `warehouse_doors_warehouse_name_unique` index on `(warehouse_id, LOWER(name))` with **no
pre-read and no self-exclusion clause**.

**Rationale**: a unique index constrains a row against *other* rows. An `UPDATE` that sets a row's
name to what it already holds — or to a different casing of it — leaves exactly one row with that
`LOWER(name)` in that warehouse, so the index is satisfied and the write succeeds. The same index
remains the arbiter for the concurrent-rename race (FR-019): two transactions claiming one name in
one warehouse resolve to one success and one `23505`, which `isUniqueViolation` maps to
`DUPLICATE_NAME`. This is the mechanism #213 already relies on, inherited unchanged.

**Alternative considered**: a pre-read `WHERE LOWER(name) = ? AND id <> ?` before the write.
Rejected: it needs the self-exclusion clause this decision avoids, and it cannot settle the race —
the index would still have to.

---

## R5 — Recording the last-updated time

**Decision**: the repository sets `updated_at` explicitly, as
`DateTime.now().toSQL({ includeOffset: false })`, in the same `update()` call as the business values.
`WarehouseDoorTransformer` gains `updatedAt`.

**Rationale**: Lucid's automatic timestamps run on model hooks, which a query-builder `update()`
bypasses — so an implicit `updated_at` would simply never move, and FR-014 would silently fail. The
serialization mirrors `LucidWarehouseRepository.updateAvailable`, the nearest writer, rather than
`LucidDockRepository`'s `toISO()`; both work, and matching the warehouse repository keeps the two
writers of this feature area identical. Exposing `updatedAt` on the transformer is what makes FR-014
observable in the contract instead of only in the database: it is additive, and the two existing
consumers (`warehouse_doors.available` and the 201 from #213) ignore the extra member, exactly as
#213's additive `createdAt` was ignored by `warehouse_doors.available`.

**Verification obligation**: because the two engines differ (PostgreSQL in development, SQLite in
tests per ADR-0002), the integration test asserts that `updatedAt` **advanced** rather than asserting
a literal format.

---

## R6 — Error vocabulary

**Decision**: add exactly two exceptions to `warehouse_door_exceptions.ts` and reuse everything else.

| Condition | Exception | Status / code |
|---|---|---|
| Door does not exist, or its id is malformed | `WarehouseDoorNotFoundException` **(new)** | 404 `E_WAREHOUSE_DOOR_NOT_FOUND` |
| Door is archived | `ArchivedWarehouseDoorReadOnlyException` **(new)** | 409 `E_WAREHOUSE_DOOR_ARCHIVED` |
| Containing warehouse is archived | `ArchivedWarehouseReadOnlyException` (existing) | 409 `E_WAREHOUSE_ARCHIVED` |
| Containing warehouse vanished | `WarehouseNotFoundException` (existing) | 404 `E_WAREHOUSE_NOT_FOUND` |
| Trimmed name empty or over 255 | `InvalidWarehouseDoorNameException` (existing) | 422 `E_WAREHOUSE_DOOR_NAME_INVALID` |
| Coordinate non-finite or out of range | `InvalidWarehouseDoorCoordinatesException` (existing) | 422 `E_WAREHOUSE_DOOR_COORDINATES_INVALID` |
| Resulting position outside the footprint | `WarehouseDoorOutsideFootprintException` (existing) | 422 `E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT` |
| Name taken in that warehouse | `DuplicateWarehouseDoorNameException` (existing) | 409 `E_WAREHOUSE_DOOR_NAME_CONFLICT` |

**Rationale**: the two new codes follow the naming and status the site references already share —
`E_DOCK_NOT_FOUND` / `E_DOCK_ARCHIVED`, `E_WAREHOUSE_NOT_FOUND` / `E_WAREHOUSE_ARCHIVED`. The
archived-door message carries the "reactivate it first" guidance (#216), matching
`ArchivedWarehouseReadOnlyException`'s wording, because FR-015 requires the administrator to be told
what to do next. Keeping the warehouse's own failures under the *warehouse's* codes is the rule
#213's `warehouse_door_exceptions.ts` header already states: the failing fact is the warehouse's.

**Alternative considered**: one `E_WAREHOUSE_DOOR_READ_ONLY` covering both an archived door and an
archived warehouse. Rejected: FR-023 requires the two to be distinguishable, and the remedies differ
(reactivate the door vs. reactivate the warehouse).

---

## R7 — How the door is moved on the map

**Decision**: reuse the existing `WarehouseDoorPlacementLayer` with **`armed: false`** for the update
session, so the draft marker is repositioned by **dragging** it or by editing the coordinate fields,
and a map click places nothing. The layer gains a `label` so the marker reads as the door's own name
rather than "New door". `WarehouseMap`'s `suppressesSelection` widens from
`doorPlacement?.armed` to `doorPlacement !== undefined`, so an unarmed edit session still stops
warehouse polygons and other door markers being selected (FR-005a).

**Rationale**: `PendingPlacementMarker` is already draggable and already syncs with
`useCoordinateFields`, so both paths FR-006 requires exist without new components. Arming
click-to-place is what `CheckpointsPage` does for *its* edit sessions, and this slice deliberately
diverges: the spec's Assumptions rejected click-to-move for a door because the door being dragged is
an existing marker among other existing markers, where a stray click reads as "select that door", not
as "move this one". Dragging says which marker is moving; a click does not.

**Consequence accepted**: the divergence means the two pages behave differently for the same gesture.
It is recorded here rather than hidden, it is confined to one boolean, and reversing it later is a
one-line change that breaks no contract.

**Also decided**: the door under edit is **filtered out of the ordinary marker layer** while the
session is open, so a stale stored marker and the live draft never both claim to be the same door.
That is `CheckpointsPage`'s `mapCheckpoints` rule applied unchanged, and the filtering is scoped to
the map only — the Doors panel keeps listing the door and its counts stay accurate.

---

## R8 — Where the edit session state lives

**Decision**: a new `useWarehouseDoorEditSession` hook under `features/warehouse-doors/`, modelled on
`useCheckpointEditSession`: `editable`, `originName`, and `origin` are snapshotted once when the
session opens and never re-derived from live query data; the session is discarded whenever the
selection it belongs to changes identity or goes away.

**Rationale**: those three rules were hardened after #199 and re-applied by
`useWarehouseEditSession` — a background refetch of another administrator's concurrent change must
not end an in-progress edit, masquerade as this administrator's unsaved work, or become what
"restore original position" restores. A door needs the same guarantees plus one more: its
`editable` snapshot depends on **two** entities, the door's own status and its containing
warehouse's.

**Alternative considered**: generalize the three near-identical hooks (checkpoint, warehouse, door)
into one parameterized session hook. Rejected **for this slice**: they differ in what they snapshot
(a point; a name and a ring; a name, a point, and a two-entity editability rule), and unifying them
would rewrite two already-delivered features inside a slice whose scope is "update a door". Recorded
as a candidate refactor once the fourth caller appears.

---

## R9 — URL state

**Decision**: widen the existing `edit` search param from `z.literal('warehouse')` to
`z.enum(['warehouse', 'door'])`. `edit=door` is honoured only when the user is an administrator,
`create` is absent, `warehouseId` names an available warehouse in the collection, and `doorId` names
an **available** door of that warehouse. Any other combination renders ordinary consultation.

**Rationale**: this is exactly how #213 widened `create` from `z.literal('warehouse')` to
`z.enum(['warehouse','door'])`, and it inherits the property that made that work: one param holding
one value means the two update modes can never both be armed, and the existing
`create === undefined` guard already keeps an update from coexisting with a creation. The mode is
deep-linkable, and an inert combination degrades to consultation rather than to an error.

**Also decided**: `edit=door` is dropped — `replace: true`, like #213's `create=door` — as soon as
`doorId` or `warehouseId` goes away or the selection turns out to be one that cannot be edited.
Left behind, it would arm the update for whichever door is selected next, including one arrived at
from a shared URL.

---

## R10 — Where the update action is offered

**Decision**: each door row in `WarehouseDoorsPanel` gains the shared per-row action menu,
`ResourceRowActions` (`components/lifecycle/resource-row-actions.tsx`), rendered as a **sibling** of
the row button and gated on `canManageWarehouses`. For this slice the menu carries exactly one
item — `Edit` — and `actions` is `[]`, because #214 delivers no lifecycle transition.

**Rationale**: the component and the layout both already exist. `truck-list.tsx` is the structural
precedent line for line: an `<li className="flex items-center gap-1">` holding the row `<button>`
and `<TruckRowActions>` beside it, the whole menu gated on the administration permission. Customers
and transport companies use the same seam. Adopting it here means the Doors panel learns nothing new.

Three properties make it the right container rather than a bare button:

1. **It anticipates #215 and #216 without pre-building them.** Archiving and reactivating a door
   arrive as entries in `actions` plus a `WarehouseDoorLifecycleDialog` in `renderDialog`. No
   restructuring of the list, no new affordance, and — decisively — no *move* of `Edit`, which a
   bare button would have suffered two slices later.
2. **It resolves the label collision** R10 previously had to solve with proximity. The trigger is
   labelled `Actions for <door name>`, so the item inside carries the bare `Edit` the repository's
   convention calls for, with no ambiguity against the warehouse's own `Edit` in the sheet footer.
3. **It already implements "absent, not disabled".** `ResourceRowActions` returns `null` when it has
   nothing to offer, so for #214 an archived door — `editable: false`, `actions: []` — renders no
   menu at all rather than a menu with a dead item or an empty popup. Once #216 lands, that same row
   yields `['reactivate']` and the menu appears on its own.

**Also decided**: the action no longer depends on the door being selected first, matching trucks and
customers. `onEdit` navigates to `{ warehouseId, doorId, edit: 'door' }` in one step, so selecting
the door and opening its session collapse into a single gesture.

**Consequence accepted**: `renderDialog` becomes **optional** on `ResourceRowActions`. It is
required today and all three existing consumers pass it, but a resource whose lifecycle slices are
not delivered yet has no dialog to render, and passing a callback that can never fire would state
the opposite. The change is additive, guarded at the one call site, and filled in by #215.

**Alternatives considered**:

- **A bare `Edit` button beside the selected row.** This plan's original answer, withdrawn on
  direction: it would be replaced by a menu two slices later, and the intermediate state would teach
  administrators a gesture that then moves.
- **The menu only on the selected row.** Rejected: inconsistent with every other directory in the
  application, and it makes the action's presence depend on a selection the action can perform
  itself.
- **A second action in the Doors panel header, beside "Create door".** Rejected: detached from the
  door it acts on, it would need "Edit door" to be understandable, colliding with the repository's
  bare-action-label convention — and it has nowhere to put `Archive` later.
- **A door detail view with its own footer.** Rejected outright: #212 FR-004a forbids introducing a
  standalone warehouse-door destination or detail view, and #214 does not lift that.

---

## R11 — What the interface does after a successful update

**Decision**: clear `edit`, keep `warehouseId` and `doorId` on the updated door, keep the current
`doorStatus`, leave `search` untouched, and show a "Door updated" toast.

**Rationale**: unlike #209, a door rename cannot hide anything. `warehouseMatchesSearch` matches
**warehouses**, so no door name takes part in the filter that dims the collection, and there is
nothing for a rename to fall out of. The lifecycle view needs no forcing either: the update is
offered only on an available door and cannot change a door's status, so the Available view the
administrator was already in still contains it. The selection is kept so the corrected door stays the
one highlighted on the map and in the list.

---

## R12 — No migration, no new geometry, no new dependency

**Decision**: this slice adds no migration, no schema change, no geometry module, and no runtime
dependency.

**Rationale**: `warehouse_doors` was created by #212 with everything this update needs — the
`(warehouse_id, LOWER(name))` unique index (R4), the `name = TRIM(name)` and `LENGTH(name) > 0`
CHECKs, the latitude/longitude range CHECKs, and `updated_at`. `containsPoint`
(`#warehouses/shared/footprint_geometry`) and `isInsideFootprint`
(`features/warehouses/geometry/footprint-validation`) already exist and are unit-tested; both are
consumed unchanged. `useCoordinateFields`, `CoordinateField`, and `PendingPlacementMarker` are the
resource-agnostic primitives #198 built and #213 reused; this slice is a third caller and modifies
none of them.

**Client-side containment stays feedback only**: `isInsideFootprint` spares the administrator a
round-trip, and the API re-decides against the footprint it read under lock (R2). That duplication
is the one #208's research already justified; it is inherited, not re-argued, and no third copy is
introduced.
