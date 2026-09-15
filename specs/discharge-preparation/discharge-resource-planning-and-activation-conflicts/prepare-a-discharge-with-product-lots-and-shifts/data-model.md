# Phase 1 Data Model: Prepare a Planned Discharge With Its Product Lots and Shifts

This slice writes into tables GH-236 delivered. It adds no table, no column, no index, and no seed.
Wire shapes are in [`contracts/discharge-preparation.openapi.yaml`](./contracts/discharge-preparation.openapi.yaml),
and screen behavior in [`contracts/ui-state.md`](./contracts/ui-state.md).

## Persisted entities written

### Discharge (`discharges`, `#models/discharge`)

| Column | Written by | Rule |
|---|---|---|
| `id` | creation | UUID supplied by the client, used as the idempotency identity (research.md Decision 2) |
| `status` | creation | Always `PLANNED`; never changed by this slice |
| `vessel_name` | creation, identity correction | Trimmed, 1 to 255 characters |
| `vessel_imo` | creation, identity correction | `null` or exactly seven digits, trimmed; an empty string becomes `null` |
| `vessel_comment` | creation, identity correction | `null` or trimmed text up to 2,000 characters; an empty string becomes `null` |
| `dock_id` | creation, identity correction | An `AVAILABLE` dock when newly chosen; kept as is when unchanged |
| `expected_start_at` | creation, identity correction | ISO 8601 instant with an offset; past and future accepted |
| `created_at`, `updated_at` | model hooks | `updated_at` also changes when a lot of the discharge changes |

### Product Lot (`product_lots`, `#models/product_lot`)

| Column | Written by | Rule |
|---|---|---|
| `id` | creation, lot addition | Server-generated |
| `discharge_id` | creation, lot addition | Never changed |
| `customer_id` | creation, lot addition, lot correction | An `AVAILABLE` customer when newly chosen; kept as is when unchanged |
| `product_name` | same | Trimmed, 1 to 255 characters |
| `expected_quantity_tonnes` | same | Decimal string `^\d{1,9}(\.\d{1,3})?$`, strictly positive, stored `NUMERIC(12,3)` |
| `description` | same | `null` or trimmed text up to 2,000 characters; an empty string becomes `null` |

The existing unique index `product_lots_identity_unique (discharge_id, customer_id, LOWER(product_name))`
backs the uniqueness rule. The rules module compares on trimmed, lower-cased names before the
index is ever reached.

A lot is deleted, not flagged, when removed. Removal is refused while any row of
`warehouse_door_product_lot_assignments` references it, whether that assignment is ended or not.
The foreign key is `RESTRICT`, so a violation is the backstop.

### Shift (`shifts`, `#models/shift`), creation only

| Column | Rule |
|---|---|
| `id` | Server-generated |
| `discharge_id` | The created discharge |
| `sequence` | 1 to N in ascending `planned_start_at` (research.md Decision 7) |
| `status` | Always `PLANNED` |
| `planned_start_at`, `planned_end_at` | ISO 8601 instants with offsets; end strictly after start; no overlap with another shift of the discharge; contiguous shifts accepted |
| `responsible_user_id` | A user with `access_status = 'ACTIVE'` and role in `SHIFT_RESPONSIBLE_ROLES` |

No row is written to `shift_trucks`, `shift_warehouse_doors`, `shift_weighing_areas`,
`discharge_truck_assignments`, or `warehouse_door_product_lot_assignments`.

## Site references and users read under lock

| Table | Lock | Condition checked after locking | Refusal |
|---|---|---|---|
| `discharges` (corrections) | `FOR UPDATE` | Exists; `status = 'PLANNED'` | 404 `E_DISCHARGE_NOT_FOUND`; 409 `E_DISCHARGE_NOT_PLANNED` |
| `product_lots` (lot correction and removal) | none beyond the discharge lock | Belongs to the locked discharge | 404 `E_PRODUCT_LOT_NOT_FOUND` |
| `docks` | `FOR SHARE`, by id | Exists; `status = 'AVAILABLE'` | 422 on `dockId`, rule `availableDock` |
| `customers` | `FOR SHARE`, by id | Exists; `status = 'AVAILABLE'` | 422 on `productLots.N.customerId` (or `customerId`), rule `availableCustomer` |
| `users` | `FOR SHARE`, by id | Exists; `access_status = 'ACTIVE'`; role in `SHIFT_RESPONSIBLE_ROLES` | 422 on `shifts.N.responsibleUserId`, rule `eligibleShiftResponsible` |

Locks are always taken in the order discharges, docks, customers, users (research.md Decision 5).

## Command models (use case inputs)

```text
CreatePlannedDischargeInput
  id: string (uuid)
  vesselName: string
  vesselImo: string | null
  vesselComment: string | null
  dockId: string
  expectedStartAt: DateTime
  productLots: ProductLotInput[]        1..100
  shifts: PlannedShiftInput[]           1..100

ProductLotInput
  customerId: string
  productName: string
  expectedQuantityTonnes: Decimal
  description: string | null

PlannedShiftInput
  plannedStartAt: DateTime
  plannedEndAt: DateTime
  responsibleUserId: string

CorrectDischargeIdentityInput
  dischargeId, vesselName, vesselImo, vesselComment, dockId, expectedStartAt

AddProductLotInput         = { dischargeId } & ProductLotInput
CorrectProductLotInput     = { dischargeId, productLotId } & ProductLotInput
RemoveProductLotInput      = { dischargeId, productLotId }
```

The array bounds are sanity limits on the request, well above the spec's expected volume of
20 lots and 40 shifts. They are not business rules.

## Preparation rules (pure module)

`app/discharges/shared/discharge_preparation_rules.ts` takes plain values, touches no database,
and returns a list of `{ field, rule, message }` issues:

| Rule id | Applies to | Issue path |
|---|---|---|
| `productLotIdentityUnique` | every pair of lots with the same `customerId` and equal `productName` after trim and lower-case | `productLots.N.productName` for each lot of the pair; `productName` for a single lot clashing with an existing one |
| `shiftPeriodOrder` | `plannedEndAt <= plannedStartAt` | `shifts.N.plannedEndAt` |
| `shiftOverlap` | two shifts where `a.start < b.end && b.start < a.end` | `shifts.N.plannedStartAt` for each shift of the pair |

It also exports `orderShifts(shifts)`, which returns the shifts sorted by planned start with their
sequence, ties broken by input position. A tie can only occur when the shifts overlap, and the
overlap rule refuses that case.

## Read model returned

Every discharge write returns the existing `DischargeDetailTransformer` shape of `discharges.show`,
unchanged. The expected tonnage it sums is therefore always consistent with the lots just written.
The replayed creation of research.md Decision 2 returns the same shape with status `200`.

`users.eligible_shift_responsibles` returns `{ data: [{ id, firstName, lastName }] }` through
`UserTransformer`'s summary variant, ordered by last name, first name, and id.

## Web form models

```text
CreateDischargeFormValues          (all strings: inputs are text)
  vesselName, vesselImo, vesselComment, dockId,
  expectedStartAt                  'YYYY-MM-DDTHH:mm' (datetime-local, browser zone)
  productLots: ProductLotFormValues[]
  shifts: PlannedShiftFormValues[]

ProductLotFormValues   { customerId, productName, expectedQuantityTonnes, description }
PlannedShiftFormValues { plannedStartAt, plannedEndAt, responsibleUserId }
DischargeIdentityFormValues = the identity subset of CreateDischargeFormValues
```

Conversions at submit:
- Strings are trimmed, and empty optional strings become `null`.
- Local date-times become ISO strings with the browser's offset (`helpers/dates.ts`).
- Quantities are sent as the trimmed string.

Conversions when a correction sheet opens:
- ISO strings become local date-time values.
- `null` becomes `''`.

Only the lot correction sheet may show an option that is no longer offered: the lot's current
customer, kept by the same approach as the trucks page's `editableCompanies`. The identity sheet
likewise keeps the current dock among its options.

## State transitions

This slice creates a discharge in `PLANNED` with shifts in `PLANNED`, and never changes a status.
Every correction requires `PLANNED` at the moment the discharge row is locked:

```text
(none) ──create──▶ PLANNED ──(GH-56 / GH-65 activation)──▶ ACTIVE ──(GH-98)──▶ CLOSED
                     │
                     └─ identity correction, lot add / correct / remove  (PLANNED only)
```

## Invariants this slice guarantees

- A discharge created by this slice has at least one lot and at least one planned shift.
- While it remains planned, it keeps at least one lot.
- No two lots of one discharge share a customer and a product name, compared without regard to
  case or surrounding spaces.
- The planned shifts of a created discharge do not overlap, and their sequence follows planned
  start.
- Every dock, customer, and responsible newly written by this slice was available, or eligible, at
  the moment the transaction held its lock.
- A lot with door assignment history is never deleted.
- A creation identity maps to at most one discharge.

## Invariants later slices must preserve

- GH-54 and GH-56 lock the discharge row `FOR UPDATE` before writing assignments or activating.
- GH-63 and GH-64 renumber `sequence` when adding or replanning shifts.
- GH-66 imports `isEligibleShiftResponsible` rather than redefining eligibility.
