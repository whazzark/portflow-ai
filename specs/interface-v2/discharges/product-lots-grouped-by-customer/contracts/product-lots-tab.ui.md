# UI Contract: Product Lots Tab (V2)

No HTTP contract changes. Reads used as-is:

- `GET /api/v1/discharges/:id` — detail (every active role).
- `GET /api/v1/discharges/:id/start-check` — `{ dischargeId, shiftId, problems[] }`, authorized by
  `DischargePolicy.start` (observers get 403). Only `LOT_WITHOUT_WAREHOUSE_DOOR` (cross-check) and
  `WAREHOUSE_DOOR_HELD` (`subject` = door, `context` = lot, `holder.vesselName`) are used here.

Writes are the existing lot, customer-lots, add-lots, removal and lot-door endpoints, unchanged.

## Observable structure (accessible names tests rely on)

| Element | Role / name | Visible to |
|---------|-------------|-----------|
| Summary | text `N lots · N customers · X t`, then `N lots without a door`, `N doors held by another discharge` when > 0 | all |
| Read-only note | text `Read-only while the discharge is active` | active discharge |
| Table | `table` « Product lots »; one `rowgroup` per customer named by the customer | all |
| Customer row | name, `N lot(s)`, subtotal; button « Edit » named `Edit <customer>` | Edit: preparer, planned |
| Lot row | product, description, quantity, door chips | all |
| No door | text « No door » (warning tone) | all, planned |
| Held door | chip with door name + text « Held by <vessel> » (warning tone) | preparer, planned |
| Inline action | button « Assign doors » named `Assign doors for <customer> · <product>` | preparer, planned, lot with a problem |
| Lot menu | button `Actions for <customer> · <product>` → Edit, Assign doors, Remove | preparer, planned |
| Footer | row header « Expected total » + tonnage | all |

## Assign doors dialog

| Element | Content |
|---------|---------|
| Title / description | « Warehouse doors » / `<customer> · <product> · <quantity>` |
| Available column | heading « Available (N) », « Grouped by warehouse », search « Search doors », groups by warehouse; row: door name, `Also on N discharges` when N > 0, `Held by <customer> · <product>` when another lot holds it, « Add » |
| Assigned column | heading « Assigned to this lot (N) »; row: `<warehouse> › <door>`, « Remove »; when held by an active discharge: `Held by <vessel> (Active). It blocks this discharge's start until <vessel> releases it.`; when locked by shifts: `Used by N shift(s). Remove it from them before removing it from the lot.` + shift links |
| Rule note | `A door serves one lot of a discharge at a time. Several planned discharges may share it: the one that starts first uses it.` |
| Footer | live summary (`No change yet` when none), « Cancel », « Save » |

## Edit product lot sheet

Adds a read-only « Warehouse doors » field: the lot's chips with their indicators, a button « Assign
doors » (opens the dialog for that lot, closing the sheet), and the note `Doors are changed from
Assign doors, not from this form.`
