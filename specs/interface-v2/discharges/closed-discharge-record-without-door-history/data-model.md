# Data Model: Closed Discharge Record Without Door History

No persisted data changes. The feature reads the existing discharge detail (`DischargeDetailDto`)
and derives view models in pure functions under `apps/web/src/features/discharges/`.

## Source fields used (existing, unchanged)

| Detail field | Used for |
|---|---|
| `status` | Selects the closed presentation (`'CLOSED'`) |
| `vesselName`, `vesselImo`, `vesselComment` | Header, vessel comment on Overview |
| `dock` (`name`, `status`) | Header Dock, timeline title |
| `expectedTonnage` | Header |
| `startedAt` | Period start, timeline Started marker |
| `shifts[].plannedStartAt`, `plannedEndAt`, `actualStartAt` | Timeline blocks and axis; Shifts count |
| `productLots[]` (`customer.id`, `expectedQuantityTonnes`, `doorAssignments[].warehouseDoor`) | Lots summary, door chips |
| `truckPool[]` (`truckId`, `releasedAt`) | Trucks summary |

## Derived view models

### ClosedRecordPeriod

| Field | Rule |
|---|---|
| `startAt: string \| null` | `startedAt`, else earliest `shifts[].actualStartAt`, else `null` |
| `endAt: string \| null` | Closure time when the detail provides one (not yet: #98), else `null` |

Rendered `start → end`, each `null` side as **Not recorded**.

### ClosedDockTimeline

| Field | Rule |
|---|---|
| `axisStart`, `axisEnd: Date` | Local midnight before the earliest block start; local midnight after the latest block end |
| `days: { date: Date, offset: number }[]` | One per local day on the axis; `offset` in [0, 1] |
| `blocks: { shiftId, startAt, endAt, offset, width, label }[]` | Per shift ordered by start: `startAt = actualStartAt ?? plannedStartAt`, `endAt = plannedEndAt`; `label` is the shift's usual name (`formatShiftPeriod`) |
| `startedMarker: number \| null` | Offset of the Period start, `null` when not recorded or off-axis |

A discharge without shifts yields `null` (no timeline is drawn; the Summary still shows `0 shifts`).

### ClosedDischargeSummary

| Field | Rule |
|---|---|
| `shifts` | `shifts.length` |
| `lots` | `productLots.length` |
| `customers` | Distinct `productLots[].customer.id` |
| `expectedTotal` | Existing exact tonnage sum of the lots' expected quantities |
| `doors` | Distinct door references across all lots' assignments, ordered by name |
| `trucks` | Distinct `truckPool[].truckId` |
| `allReleasedAt: string \| null` | Latest `releasedAt` when every pool entry has one, else `null` |

### LotDoorCell (changed)

For a closed discharge: `doors` = each door once (unchanged), `history` = `[]` (was every period).
The `historyLabel` variant `'history'` is removed; planned/active keep `'ended'`.
