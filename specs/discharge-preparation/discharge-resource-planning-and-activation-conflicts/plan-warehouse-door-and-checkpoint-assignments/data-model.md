# Phase 1 Data Model: Plan Warehouse Door and Checkpoint Assignments

This slice writes rows into tables GH-236 delivered and adds three partial unique indexes. It adds
no table, no column, and no seed. Wire shapes are in
[`contracts/discharge-resource-planning.openapi.yaml`](./contracts/discharge-resource-planning.openapi.yaml),
and screen behavior in [`contracts/ui-state.md`](./contracts/ui-state.md).

## Vocabulary

- **Current row**: an assignment or selection whose `effective_to` is null. The detail calls it
  "in effect" while the discharge is not closed (`isInEffect`).
- **Start a row**: insert it with `effective_from = instant` and `effective_to = null`.
- **End a row**: set its `effective_to = instant`. Rows are never deleted or reopened. Selecting a
  resource again starts a new row.
- **Instant**: the one recorded time of a command (research.md Decision 7).

## Persisted entities written

### Warehouse Door Assignment (`warehouse_door_product_lot_assignments`, `#models/warehouse_door_product_lot_assignment`)

| Column | Written by | Rule |
|---|---|---|
| `id` | start | Server-generated |
| `discharge_id` | start | The locked planned discharge; equals the lot's discharge |
| `warehouse_door_id` | start | A door `AVAILABLE` in an `AVAILABLE` warehouse, both locked `FOR SHARE` |
| `product_lot_id` | start | A lot of the discharge |
| `effective_from` | start | The instant |
| `effective_to` | end | The instant; strictly after `effective_from` (existing check) |
| `created_at`, `updated_at` | model hooks | `updated_at` changes when the row is ended |

Invariants:
- **A1**: Within a discharge, a door has at most one current assignment. Enforced under the
  discharge lock and backed by the new partial unique index
  `warehouse_door_product_lot_assignments_current_door_unique (discharge_id, warehouse_door_id) WHERE effective_to IS NULL`.
- **A2**: A door may be current in several discharges at once (spec Clarifications, Q3). No
  site-wide constraint is added. GH-56 decides at start.
- **A3**: A lot's current assignment is never ended while a planned shift of the discharge has a
  current selection of that door (FR-012).
- **A4**: A lot that has any assignment row, current or ended, cannot be removed. This is GH-53's
  unchanged rule, which this slice now makes reachable through the product.

### Shift Door Selection (`shift_warehouse_doors`, `#models/shift_warehouse_door`)

| Column | Written by | Rule |
|---|---|---|
| `id` | start | Server-generated |
| `shift_id` | start | A `PLANNED` shift of the locked planned discharge |
| `warehouse_door_id` | start | A door with a current assignment to a lot of the same discharge |
| `effective_from`, `effective_to` | start, end | As above |

Invariants:
- **S1**: A shift has at most one current selection per door. Backed by
  `shift_warehouse_doors_current_unique (shift_id, warehouse_door_id) WHERE effective_to IS NULL`.
- **S2**: Every current door selection of a planned shift in a planned discharge has a current
  assignment of that door in the discharge. This follows from A3 and the start rule. It also means
  the door is in use, and therefore cannot be archived (research.md Decision 6).

### Shift Weighing Area Selection (`shift_weighing_areas`, `#models/shift_weighing_area`)

| Column | Written by | Rule |
|---|---|---|
| `id` | start | Server-generated |
| `shift_id` | start | A `PLANNED` shift of the locked planned discharge |
| `weighing_area_id` | start | An `AVAILABLE` weighing area, locked `FOR SHARE` |
| `effective_from`, `effective_to` | start, end | As above |

Invariants:
- **W1**: A shift has at most one current selection per weighing area. Backed by
  `shift_weighing_areas_current_unique (shift_id, weighing_area_id) WHERE effective_to IS NULL`.
- **W2**: A weighing area may be current on shifts of several discharges.

A planned shift may have no current door or weighing area selection. The minimum of one of each is
checked when a shift starts (GH-56, GH-65).

## Entities read

| Entity | Read for | Lock |
|---|---|---|
| Discharge (`discharges`) | Existence and `PLANNED` status | `FOR UPDATE` (`lockPlannedDischarge`) |
| Product Lot (`product_lots`) | The lot belongs to the discharge; labels of lots holding a door | none, under the discharge lock |
| Shift (`shifts`) | The shift belongs to the discharge and is `PLANNED`; planned shifts selecting a door | none, under the discharge lock |
| Warehouse (`warehouses`) | Warehouses of newly assigned doors are `AVAILABLE` | `FOR SHARE`, ordered by id |
| Warehouse Door (`warehouse_doors`) | Newly assigned doors exist and are `AVAILABLE` | `FOR SHARE`, ordered by id |
| Weighing Area (`weighing_areas`) | Newly added areas exist and are `AVAILABLE` | `FOR SHARE`, ordered by id |

The lock order across the discharge slice is discharge, docks, customers, users, warehouses,
warehouse doors, then weighing areas.

## Change sets

### Lot warehouse doors — `{ assign: uuid[], withdraw: uuid[] }`

Validation, before any read:
- Each list has at most 200 lower-cased UUIDs, with no duplicates (`distinct`).
- No identity may appear in both lists (`notInBothLists`, reported on `withdraw.N`).

Evaluation, under the locks, with all issues collected before anything is written:

| Case for identity `d` | Outcome |
|---|---|
| `assign` and `d` is current on this lot | Nothing |
| `assign` and `d` is not `AVAILABLE`, or its warehouse is not | Issue `assign.N` / `availableWarehouseDoor` |
| `assign` and `d` is current on another lot of the discharge | End that row; start a row on this lot (a move) |
| `assign` otherwise | Start a row on this lot |
| `withdraw` and `d` is not current on this lot | Nothing |
| `withdraw` and a `PLANNED` shift of the discharge has a current selection of `d` | Issue `withdraw.N` / `selectedByPlannedShift` |
| `withdraw` otherwise | End the row |

Writes run in this order: ends first, then starts, so A1's index holds after each statement.

### Shift checkpoints — `{ warehouseDoors: { add, remove }, weighingAreas: { add, remove } }`

Validation is the same for each pair: at most 200 UUIDs per list, distinct, and no identity in both
lists of a pair.

| Case | Outcome |
|---|---|
| `warehouseDoors.add` with a door already current on the shift | Nothing |
| `warehouseDoors.add` with a door not current on any lot of the discharge | Issue `warehouseDoors.add.N` / `assignedWarehouseDoor` |
| `warehouseDoors.add` otherwise | Start a door selection |
| `weighingAreas.add` with an area already current on the shift | Nothing |
| `weighingAreas.add` with an area that is not `AVAILABLE` | Issue `weighingAreas.add.N` / `availableWeighingArea` |
| `weighingAreas.add` otherwise | Start an area selection |
| `…remove` with a resource not current on the shift | Nothing |
| `…remove` otherwise | End the selection |

Both kinds are written in one transaction, ends before starts.

## State rules

| Discharge | Shift | Lot command | Shift command |
|---|---|---|---|
| `PLANNED` | `PLANNED` | Allowed | Allowed |
| `PLANNED` | `ACTIVE` or `COMPLETED` | Allowed | `409 E_SHIFT_NOT_PLANNED` (not reachable through the product) |
| `ACTIVE` or `CLOSED` | any | `409 E_DISCHARGE_NOT_PLANNED` | `409 E_DISCHARGE_NOT_PLANNED` |

Checks run in this order, as in GH-53: the discharge exists, the discharge is planned, the lot or
shift belongs to it, the shift is planned, then the chosen resources. An unknown lot or shift in a
non-planned discharge is therefore a `409`, not a `404`.

## Recorded instant

```text
instant = now() truncated to the second
latest  = the latest effective_from or effective_to in scope
          (lot command: every door assignment row of the discharge;
           shift command: every door and weighing area selection row of the shift)
if latest >= instant: instant = latest + 1 second
```

The instant is computed once, before any write. Every start and end of the command uses it. Seconds
are used because SQLite stores date-times without milliseconds (research.md Decision 7).

## Planning options (read model)

| Field | Source | Rule |
|---|---|---|
| `warehouseDoors[].id`, `name` | `warehouse_doors` | `status = 'AVAILABLE'` |
| `warehouseDoors[].warehouse` | `warehouses` | `{ id, name }` with `status = 'AVAILABLE'` |
| `warehouseDoors[].otherDischargeAssignments[]` | `warehouse_door_product_lot_assignments` joined to `discharges` | Current rows of discharges with status `PLANNED` or `ACTIVE`, other than the requested one; `{ discharge: { id, vesselName, status, expectedStartAt } }`, one entry per discharge, ordered by expected start then id |
| `weighingAreas[]` | `weighing_areas` | `{ id, name }` with `status = 'AVAILABLE'`, ordered by lower-cased name then id |

Doors are ordered by lower-cased warehouse name, lower-cased door name, and id.

## Migration

`1786200000000_add_current_planning_unique_indexes.ts` creates the three partial unique indexes
named above in `up` and drops them in `down`. They are raw `CREATE UNIQUE INDEX … WHERE effective_to
IS NULL` statements, valid on PostgreSQL and SQLite. A unique violation on any of them during a
planning command maps to `409 E_DISCHARGE_PLANNING_CONFLICT`.

## Web derivations (`discharge-planning-view.ts`)

| Function | Input | Output |
|---|---|---|
| `currentDoorIds(lot)` | a detail lot | ids of its current assignments |
| `lotHoldingDoor(detail, doorId)` | detail | the lot with a current assignment of the door, or `null` |
| `plannedShiftsSelectingDoor(detail, doorId)` | detail | planned shifts with a current selection of the door |
| `lotDoorChangeSet(lot, chosenIds)` | a lot and the checked ids | `{ assign, withdraw }` |
| `shiftDoorOptions(detail)` | detail | doors current on a lot of the discharge, each with its warehouse and lot |
| `shiftCheckpointChangeSet(shift, chosen)` | a shift and the checked ids | `{ warehouseDoors, weighingAreas }` change set |
| `movedDoors(response, lotId, assignedIds)` | the response detail | for each assigned door, the lot whose ended row has `effectiveTo` equal to the new row's `effectiveFrom` |
| `shiftSelectionNotice(periods, status)` | a shift's selections of one kind | `NONE_SELECTED`, `NONE_CURRENTLY_SELECTED`, or `null`, mirroring `lotDoorNotice` |
