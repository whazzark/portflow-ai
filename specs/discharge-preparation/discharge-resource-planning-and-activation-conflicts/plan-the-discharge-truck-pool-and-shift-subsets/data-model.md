# Phase 1 Data Model: Plan the Discharge Truck Pool and Shift Subsets

This slice writes into tables GH-236 delivered. It adds no table, no column, no index, and no seed.
- Wire shapes: [`contracts/truck-pool.openapi.yaml`](./contracts/truck-pool.openapi.yaml).
- Screen behavior: [`contracts/ui-state.md`](./contracts/ui-state.md).
- Decisions: [`research.md`](./research.md).

## Persisted entities written

### Discharge Truck Assignment (`discharge_truck_assignments`, `#models/discharge_truck_assignment`)

| Column | Written by | Rule |
|---|---|---|
| `id` | reservation (insert) | Server-generated; kept when a released row is reactivated |
| `discharge_id` | reservation | The locked, `PLANNED` discharge; never changed |
| `truck_id` | reservation | A truck locked `FOR SHARE` whose `status` is `AVAILABLE` |
| `registration_snapshot` | reservation, reactivation | The truck's `registration` read under the lock |
| `transport_company_id` | reservation, reactivation | The truck's current `transport_company_id` |
| `transport_company_name_snapshot` | reservation, reactivation | That company's `name`, read in the same locked statement |
| `reserved_at` | reservation, reactivation | The command's instant |
| `released_at` | reactivation | Set to `null` when a released row of the same discharge is reserved again; never set by this slice |
| `created_at`, `updated_at` | model hooks | — |

**States this slice distinguishes**:

| State | Condition | Counts as held |
|---|---|---|
| Held | `released_at IS NULL` on a `PLANNED` or `ACTIVE` discharge | yes |
| Released | `released_at IS NOT NULL` (seed or runtime release) | no |
| Withdrawn | Row deleted by this slice | — (no longer exists) |

**Transitions** on a `PLANNED` discharge:

```text
(none) ──reserve──▶ Held
Released ──reserve──▶ Held          (same row, snapshots and reserved_at captured again)
Held ──reserve──▶ Held              (no change)
Held ──withdraw──▶ (deleted)        (also deletes its current selections in PLANNED shifts)
Released ──withdraw──▶ Released     (ignored)
(none) ──withdraw──▶ (none)         (ignored)
```

`unique (discharge_id, truck_id)` guarantees one row per truck per discharge. Several discharges may
each have a held row for the same truck (spec Clarifications, first answer). Only the start
confirmation (GH-56) enforces that at most one of them is active.

### Shift Truck Selection (`shift_trucks`, `#models/shift_truck`)

| Column | Written by | Rule |
|---|---|---|
| `id` | selection (insert) | Server-generated |
| `shift_id` | selection | A `PLANNED` shift of the locked, `PLANNED` discharge |
| `truck_id` | selection | Held by the discharge; `AVAILABLE` when newly added |
| `effective_from` | selection | The command's instant |
| `effective_to` | — | Always `null` for rows written by this slice |

A row with `effective_to IS NULL` is a **current selection**. A row with `effective_to` set is an
ended period from seeds or later runtime slices. This slice never reads it as selected, never
deletes it, and never changes it.

Deselecting a truck, or withdrawing it from the pool, **deletes** its current selection rows in
`PLANNED` shifts (research.md Decision 5).

**Invariant after every accepted write** (FR-025): every current selection of a `PLANNED` shift
references a truck held by the shift's discharge.

### Discharge (`discharges`)

Only `updated_at` changes, bumped by every accepted write of this slice.

## Rows read under lock

| Table | Lock | Used by | Condition checked after locking | Refusal |
|---|---|---|---|---|
| `discharges` | `FOR UPDATE` | all writes | Exists; `status = 'PLANNED'` | 404 `E_DISCHARGE_NOT_FOUND`; 409 `E_DISCHARGE_NOT_PLANNED` |
| `shifts` | none beyond the discharge lock | selection, withdrawal | Selection: belongs to the discharge and `status = 'PLANNED'` | 404 `E_SHIFT_NOT_FOUND`; 409 `E_SHIFT_NOT_PLANNED` |
| `discharge_truck_assignments` | none beyond the discharge lock | all writes | The discharge's held and released rows | — |
| `shift_trucks` | none beyond the discharge lock | selection, withdrawal | Current selections of the discharge's `PLANNED` shifts | — |
| `trucks` joined to `transport_companies` | `FOR SHARE` on `trucks`, ordered by id | reservation (all requested), selection (added only) | Exists; `status = 'AVAILABLE'` | 422 `truckIds.N`, rule `availableTruck` or `selectableTruck` |

Locks are always taken in the order discharges, then trucks (research.md Decision 4).

**Hardened outside the slice**: `UpdateTruckUseCase`, when the transport company changes, locks the
truck `FOR UPDATE` and checks planned or active usage through the same transaction client. The
refusal is unchanged: `409 E_TRUCK_TRANSPORT_COMPANY_LOCKED`.

## Command models (use case inputs)

```text
ReserveTrucksInput
  dischargeId: string
  truckIds: string[]            1..500, distinct UUIDs

WithdrawTrucksInput
  dischargeId: string
  truckIds: string[]            1..500, distinct UUIDs

SelectShiftTrucksInput
  dischargeId: string
  shiftId: string
  truckIds: string[]            0..500, distinct UUIDs; the full desired selection
```

## Pure rules (`app/discharges/shared/truck_pool_rules.ts`)

Each function takes plain values read under lock and returns issues or a write plan. None of them
touches the database.

```text
planReservation(requested, pool, trucks, now)
  requested: string[]                               in request order
  pool: { truckId, releasedAt }[]                   this discharge's rows
  trucks: Map<id, { status, registration, transportCompanyId, transportCompanyName }>
  → { issues: Issue[] }                              availableTruck at truckIds.N for unknown, ARCHIVED, SUSPENDED
  | { inserts: AssignmentSnapshot[], reactivations: AssignmentSnapshot[] }   already-held trucks omitted

planWithdrawal(requested, pool, currentSelections)
  pool: { id, truckId, releasedAt }[]
  currentSelections: { id, shiftId, truckId }[]     current rows of PLANNED shifts only
  → { assignmentIds: string[], selectionIds: string[] }   trucks not held are ignored

planShiftSelection(requested, heldTruckIds, currentSelection, trucks, now)
  heldTruckIds: Set<id>
  currentSelection: { id, truckId }[]               current rows of this shift
  trucks: Map<id, { status }>                       added trucks, read under lock
  → { issues: Issue[] }                              heldTruck, then selectableTruck, at truckIds.N
  | { deleteIds: string[], inserts: { truckId, effectiveFrom }[] }
```

Issue precedence for one truck in a selection: `heldTruck` first. A suspended truck already in
`currentSelection` is kept without an issue. A suspended truck being added gets `selectableTruck`.

## Read models

### Truck candidate (`discharges.truck_pool.candidates`)

| Field | Source |
|---|---|
| `id` | `trucks.id` |
| `registration` | `trucks.registration` (current) |
| `transportCompany.id`, `.name` | `transport_companies` (current) |
| `otherHoldings[]` | See below |

Candidates are trucks with `status = 'AVAILABLE'` that have no held row for this discharge. They are
ordered by `LOWER(registration)`, then `id`.

### Other holding (on candidates and on detail pool entries)

| Field | Source |
|---|---|
| `dischargeId` | `discharges.id` |
| `vesselName` | `discharges.vessel_name` |
| `status` | `discharges.status`, `PLANNED` or `ACTIVE` |

The holdings are rows of `discharge_truck_assignments` with `released_at IS NULL`, joined to a
discharge in `PLANNED` or `ACTIVE`, other than the discharge being read. They are ordered `ACTIVE`
first, then by `vessel_name`, then by id. One query serves all trucks at once.

### Discharge detail addition

`DischargeRepository.findDetail` returns
`DischargeDetailRead { discharge: Discharge, otherHoldings: Map<truckId, OtherHolding[]> }`.
`DischargeDetailTransformer` adds `otherHoldings` to each `truckPool` entry. It is an empty array
when the entry is released or the discharge is closed. Every other field of the GH-58 shape is
unchanged.

## Web adapters (`apps/web/src/features/discharges`)

| Module | Kind | Responsibility |
|---|---|---|
| `truck-pool-selection.ts` | pure | Held trucks from a detail; the planned shifts currently selecting given trucks, labelled by period; the trucks offered for a shift (held and not suspended, plus suspended already selected) |
| `truck-pool-refusals.ts` | pure | Maps `E_VALIDATION_ERROR` details at `truckIds.N` to `{ truckId, message }` using the submitted identities; unmatched details become a summary message |
| `queries/discharge-queries.ts` | query factory | Adds `truckCandidates(dischargeId)` on `discharges.truckPool.candidates`, `staleTime: 0` |
| `mutations/use-discharge-mutations.ts` | hook | Adds `reserveTrucks`, `withdrawTrucks`, and `selectShiftTrucks`; extends `STALE_DETAIL_CODES` |
