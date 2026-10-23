# Data Model: List Discharges by Status

No table, column, migration, or seed changes. This slice reads existing data in a new shape.

## Discharge list entry (read model)

| Field | Source | Present for | Notes |
|-------|--------|-------------|-------|
| `id`, `status`, `vesselName`, `vesselImo`, `expectedStartAt` | `discharges` | all | unchanged |
| `dock { id, name }` | `docks` | all | unchanged |
| `productLots[] { id, customerId, customerName, productName }` | `product_lots`, `customers` | all | unchanged; feeds search and the customer cell |
| `shiftCount` | count of `shifts` | all | unchanged; the `n` of "Shift k / n" |
| `startedAt` | `discharges.started_at` | all (null while planned, or if unrecorded) | new |
| `expectedTonnage` | Σ `product_lots.expected_quantity_tonnes` | all | new; fixed-3 string, `"0.000"` with no lot |
| `activeShift` | `shifts` where `status = ACTIVE` | active discharges, else `null` | new; at most one per discharge |
| `nextShift` | `shifts` where `status = PLANNED`, lowest `sequence` | active discharges, else `null` | new |
| `startProblemCount` | `DischargeStartEvaluator` | planned discharges, else `null` | new; `0` means Ready |

## Shift summary

| Field | Source |
|-------|--------|
| `id` | `shifts.id` |
| `sequence` | `shifts.sequence` (1-based position in planned-start order, contiguous) |
| `plannedStartAt`, `plannedEndAt` | `shifts` |
| `responsible { id, firstName, lastName }` | `users` via `shifts.responsible_user_id`, whatever the user's current access |

## Rules

- `activeShift` and `nextShift` are both `null` for planned and closed discharges.
- An active discharge between shifts has `activeShift: null`; `nextShift` is `null` when no planned
  shift remains.
- `startProblemCount` is the number of problems `evaluateDischargeStart` reports at read time, the
  same evaluation as `GET /discharges/:id/start-check`.
- No closure time is exposed (Clarification Q1).
