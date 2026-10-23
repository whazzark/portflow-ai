# Data Model: Full-Screen Warehouses Map

No persisted entity, API contract, or business rule changes. `Warehouse`, `Warehouse Footprint`,
and `Warehouse Door` keep the definitions in `CONTEXT.md` and the sibling `warehouses/` and
`warehouse-doors/` specs. This feature adds **client-side view models** derived from the
`warehouses.index` response (`WarehouseWithDoorsDto`).

## StatusSelection (toolbar filter)

| Field | Type | Notes |
|---|---|---|
| `available` | boolean | `Available` pill pressed |
| `archived` | boolean | `Archived` pill pressed |

- Derived from and written to the existing `status` search param:
  `available` ⇄ `{available: true, archived: false}`, `archived` ⇄ `{false, true}`,
  `all` ⇄ `{true, true}`.
- Invariant: at least one is `true`; toggling off the last pressed pill is a no-op.
- Counts per pill come from the existing `countResources`.

## SearchResults

`searchWarehousesAndDoors(warehouses, status, text) → SearchResults`

| Field | Type | Notes |
|---|---|---|
| `warehouses` | `WarehouseResult[]` | `{ id, name, status, doorSummary }`, name order |
| `doors` | `DoorResult[]` | `{ id, name, status, warehouseId, warehouseName }`, name order |
| `isEmpty` | boolean | both lists empty and `text` non-blank |

- Matching: `normalizeResourceSearch(name).includes(normalizeResourceSearch(text))`.
- Scope: a warehouse is searched when its status is selected; a door when both its own status and
  its warehouse's status are selected.
- `doorSummary`: `<n> door(s)` plus ` · <k> archived` when `k > 0`; `No doors` when none.
- Blank text → no results popup (map emphasis unchanged).

## WarehouseCardModel

| Field | Source |
|---|---|
| `name`, `status` | DTO |
| `boundaryPointCount` | `footprint.points.length` |
| `centre` | `footprintCentre(footprint.points)` → `{ latitude, longitude }`, shown to 4 decimals |
| `doors` | DTO `doors`, filtered by `doorStatus` (Available or Archived) with counts |
| `updatedAt`, `createdAt` | DTO, `dd/MM/yyyy, HH:mm` in the user's locale as elsewhere |
| `archivedAt` | DTO, archived card only |

## EditHistory (outline editing)

| Field | Type | Notes |
|---|---|---|
| `origin` | `WarehousePoint[]` | points when editing started (shown dashed) |
| `draft` | `WarehousePoint[]` | current points |
| `past` | `WarehousePoint[][]` | stack of previous drafts, bounded (50) |

Transitions: `move(i, p)`, `insert(i, p)`, `remove(i)` push the current draft onto `past`;
`undo()` pops it (no-op when empty); `restore()` resets `draft` to `origin` and pushes once;
`save`/`cancel` discard the history.

Derived: `movedCount` = number of origin points whose coordinates differ from the draft point at
the same index or that were removed, plus inserted points (shown as `<n> boundary points · <m>
moved`, the suffix omitted when `m = 0`).

## Active map mode

Unchanged source of truth — the existing exclusive URL params:

| URL | Mode | Banner text |
|---|---|---|
| `create=warehouse` | draw | `Drawing a new warehouse · click the first point to close the outline` |
| `create=door&warehouseId` | door placement | `Placing a new door · click inside <warehouse>` |
| `edit=warehouse&warehouseId` | outline editing | `Drag a point to reshape <warehouse> · click a midpoint to add one` |
| `edit=door&warehouseId&doorId` | door move | `Drag the pin to move <door> · it must stay inside <warehouse>` |

At most one mode is active; any mode hides the toolbar, search results, and no-match panel.
