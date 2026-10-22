# Data Model: Product Lots Grouped by Customer

No stored data changes. This feature adds web view models derived from two existing reads:
the discharge detail (`DischargeDetailDto`) and the start check (`StartCheckDto`).

## Customer group (existing, unchanged)

From `groupLotsByCustomer(detail.productLots)`:

| Field | Meaning |
|-------|---------|
| `customer` | id, name, status |
| `lots` | the customer's lots, in detail order |
| `subtotal` | sum of the lots' expected quantities (tonnes, 3 decimals) |

Invariant: the sum of subtotals equals `detail.expectedTonnage` (SC-004).

## Lot door problems (new, derived)

`lotDoorProblems(detail, problems)` — `problems` is the start check's list, or `null` when not
readable (loading, failed, observer, discharge not planned).

| Field | Type | Rule |
|-------|------|------|
| `noDoor` | `Set<lotId>` | planned discharge only: lots with no assignment whose `effectiveTo` is `null` |
| `heldDoors` | `Map<lotId, Map<doorId, vesselName>>` | from `WAREHOUSE_DOOR_HELD` problems with `context.type === 'PRODUCT_LOT'`; vessel falls back to « another active discharge »; empty when `problems` is `null` |
| `heldKnown` | `boolean` | `problems !== null`; when false, held indicators and count are omitted |

Derived summary:

| Field | Rule |
|-------|------|
| `lotCount`, `customerCount`, `expectedTonnage` | from the detail |
| `lotsWithoutDoor` | `noDoor.size` (shown when > 0) |
| `heldDoorCount` | number of held (lot, door) pairs (shown when > 0 and `heldKnown`) |

Not-planned discharges (active, closed): `noDoor` and `heldDoors` are empty.

## Assign doors dialog additions (derived)

| Item | Source |
|------|--------|
| Lot label with quantity | `lotLabel(lot)` + `formatTonnes(lot.expectedQuantityTonnes)` |
| « Also on N discharges » | `door.otherDischargeAssignments.length` (planning options) |
| Held by active discharge, on an assigned door | `heldDoors.get(lot.id)?.get(doorId)` plus « Active » |
| Shift lock « Used by N shifts » | `heldDoorRowState(...).shifts` (existing) |
