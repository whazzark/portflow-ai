# Data Model: Update a Truck

No migration accompanies this slice. Every table, column, index, and constraint below was created by
List Trucks (`#222`) and the discharge-preparation work; this document states which of them the
update path reads, writes, and must leave alone.

## Truck (write target)

The complete field list is owned by
[List Trucks](../list-trucks/data-model.md#truck). Only the mutability of each field changes here.

| Field | Mutable by this slice | Rules applied on update |
|---|---|---|
| `id` | No | Identifies the row; never rewritten (FR-016) |
| `registration` | **Yes** | Trimmed; non-blank; max 255; display casing preserved; must stay unique under `LOWER(registration)` across every lifecycle state (FR-005, FR-008, FR-009) |
| `vehicleModel` | **Yes** | Trimmed when present; non-blank if not null; max 255; explicit `null` clears it (FR-006) |
| `capacityTonnes` | **Yes** | Positive; at most 3 fractional digits; within `NUMERIC(12,3)` (FR-007) |
| `transportCompanyId` | **Yes, conditionally** | Must reference an existing `AVAILABLE` company when it changes (FR-011); may not change while the truck is committed to a planned or active discharge (FR-012) |
| `status` | No | Must be `AVAILABLE` for the write to apply; never written (FR-014, FR-016) |
| `archivedAt`, `archivedByUserId`, `archiveComment` | No | Preserved exactly (FR-016) |
| `reactivatedAt`, `reactivatedByUserId`, `reactivationComment` | No | Preserved exactly (FR-016) |
| `createdAt` | No | Preserved exactly |
| `updatedAt` | Server-managed | Advanced on every applied write, including a no-op resubmission (FR-010, Decision 7) |

### Constraints this slice relies on

- `trucks_registration_unique`, the unique functional index on `LOWER(registration)`, is the sole
  mechanism guaranteeing FR-009 and FR-024 under concurrency. The repository translates its violation
  into `DUPLICATE_REGISTRATION` rather than pre-checking.
- The `capacity_tonnes > 0` check constraint backstops FR-007; the validator rejects the same values
  earlier with a field-level message.
- The `archived_at` check constraint is untouched because `status` is never written.
- `transportCompanyId` references `transport_companies.id` with deletion restricted, so a reassigned
  company always resolves.

### Invariants preserved

- An `AVAILABLE` truck must be provided by an `AVAILABLE` transport company. The update preserves
  this by validating the submitted company whenever the assignment changes, and by never writing a
  truck that is not `AVAILABLE`.
- `CONTEXT.md` states a truck's transport company cannot change while the truck is used by a planned
  or active discharge. This slice is the first to enforce that rule.
- Registration, vehicle model, and capacity remain editable regardless of discharge commitment, per
  the `CONTEXT.md` definition of Truck Registration as an editable identifier.

## Discharge Truck Assignment (read-only input)

Read only to answer "is this truck committed to a planned or active discharge?", and never written.

| Field | Role in this slice |
|---|---|
| `truck_id` | Joins the assignment to the truck being updated |
| `discharge_id` | Joins to `discharges` to read the discharge status |
| `released_at` | A non-null value means the reservation has ended and no longer blocks a provider change |
| `registration_snapshot` | Captured at reservation time; untouched by an update, which is what makes FR-019 automatic |
| `transport_company_id`, `transport_company_name_snapshot` | Captured at reservation time; untouched by a reassignment |

A truck is **committed** when a row exists with `released_at IS NULL` whose discharge has
`status IN ('PLANNED', 'ACTIVE')`. Assignments on `CLOSED` discharges never block a reassignment.

Because the assignment stores snapshots rather than resolving the truck's live registration and
company, FR-019 and FR-020 hold without any additional write or guard.

## Transport Company (read-only input)

Read by identifier only when the assignment changes, to confirm `status === 'AVAILABLE'`. Never
written: FR-026 forbids this slice from touching company records, and reassigning a truck away from a
company does not archive or otherwise alter it.

## Repository contract

`TruckRepository` gains two abstract methods alongside the delivered `list`, `listAvailable`, and
`create`:

```text
findById(id: string): Promise<Truck | null>

updateAvailable(command: UpdateTruckCommand): Promise<TruckWriteResult>
```

```text
UpdateTruckCommand = {
  id: string
  registration: string
  vehicleModel: string | null
  capacityTonnes: Decimal.Value
  transportCompanyId: string
}
```

`TruckWriteResult` extends the delivered union with the update outcomes:

```text
| { kind: 'CREATED'; truck: Truck }            # existing, create path
| { kind: 'UPDATED'; truck: Truck }            # new
| { kind: 'DUPLICATE_REGISTRATION' }           # existing, now reachable from both paths
| { kind: 'NOT_FOUND' }                        # new
| { kind: 'ARCHIVED' }                         # new
```

`updateAvailable` writes with `WHERE id = ? AND status = 'AVAILABLE'`. Zero affected rows triggers a
single re-read that distinguishes `NOT_FOUND` from `ARCHIVED`; a row that is `AVAILABLE` on re-read
was reactivated concurrently and is reported as `NOT_FOUND`, matching the delivered transport-company
repository's reasoning. The returned truck preloads `archivedBy` and `reactivatedBy` so the
transformer emits the same representation the consultation endpoints do.

## Decision order in the use case

The order is observable, because it determines which refusal an administrator sees when several
conditions fail at once.

1. Normalize and assert `registration` and `vehicleModel` → `422 E_SITE_REFERENCE_NAME_INVALID`
2. `findById` → `404 E_TRUCK_NOT_FOUND`
3. `status === 'ARCHIVED'` → `409 E_TRUCK_ARCHIVED`
4. If `transportCompanyId` changed:
   a. usage checker reports the truck committed → `409 E_TRUCK_TRANSPORT_COMPANY_LOCKED`
   b. company missing or `ARCHIVED` → `422 E_TRUCK_TRANSPORT_COMPANY_INVALID`
5. `updateAvailable` → `409 E_TRUCK_REGISTRATION_CONFLICT`, or a late `404`/`409` from the
   conditional write, or the updated truck

Steps 2 and 3 precede step 4 so that an archived truck reports its read-only state rather than a
provider rule that could never apply to it. Step 4a precedes 4b so that a committed truck reports the
commitment even when the submitted company is also unsuitable — the commitment is the condition the
administrator cannot fix by choosing a different company.

## State transitions

None. An update is not a lifecycle transition: `status` is unchanged, and no archive or reactivation
actor, time, or comment is captured. Archive (`#225`) and reactivate (`#226`) remain the only
transitions on this resource.
