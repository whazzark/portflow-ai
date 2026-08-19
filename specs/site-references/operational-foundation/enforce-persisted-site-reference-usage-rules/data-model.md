# Data Model: Persisted Site-Reference Usage

## Design Boundary

This feature adds no new business entity or business-state table. It derives a read-only
**Current Site-Reference Usage** projection from the Discharge preparation records delivered by
issue #236. Existing historical rows remain authoritative and unchanged.

## Current Site-Reference Usage Projection

| Field | Meaning | Validation |
| --- | --- | --- |
| Reference kind | `CUSTOMER`, `DOCK`, `WEIGHING_AREA`, `WAREHOUSE_DOOR`, or `TRUCK` | Must be one of the exhaustive supported kinds |
| Requested identifiers | Read-only collection of site-reference UUIDs | May be empty, repeated, or contain unknown IDs; normalized to distinct values before persistence access |
| Current Discharge states | Planned or Active | Closed never qualifies as current usage |
| Used identifiers | Distinct subset of requested identifiers | Contains only IDs with at least one qualifying non-released relationship; stable lexical iteration order |
| Transaction context | Optional existing query client | When supplied, every usage read executes within that caller's transaction |

The projection is not persisted. It is reconstructed from the authoritative relationships below
for every assessment.

## Existing Persisted Entities and Usage Rules

### Discharge

Relevant fields:

- `id`: stable UUID.
- `status`: `PLANNED`, `ACTIVE`, or `CLOSED`.
- `dock_id`: current Dock reference.

Relationships:

- Has many Product Lots.
- Has many Shifts.
- Has many Warehouse Door-to-Product-Lot assignments.
- Has many Discharge Truck reservations.

Usage rule:

- Only `PLANNED` and `ACTIVE` Discharges contribute to current usage.
- A matching `dock_id` establishes Dock usage directly.
- Transition to `CLOSED` changes every retained relationship of that Discharge from current usage to
  history without deleting it.

### Product Lot

Relevant fields:

- `id`: stable UUID.
- `discharge_id`: owning Discharge.
- `customer_id`: referenced Customer.

Usage rule:

- The Customer is current when the owning Discharge is Planned or Active.
- There is no Product Lot release field; Discharge closure is the release boundary.

### Shift Weighing Area Membership

Relevant fields:

- `shift_id`: Shift whose `discharge_id` reaches the owning Discharge.
- `weighing_area_id`: referenced Weighing Area.
- `effective_from`: historical start.
- `effective_to`: absent while current; populated after membership ends.

Usage rule:

- The Weighing Area is current when `effective_to` is absent and the owning Discharge is Planned or
  Active.
- Shift lifecycle status does not release the membership by itself.

### Warehouse Door-to-Product-Lot Assignment

Relevant fields:

- `discharge_id`: owning Discharge.
- `warehouse_door_id`: referenced Warehouse Door.
- `product_lot_id`: assigned Product Lot.
- `effective_from`: historical start.
- `effective_to`: absent while current; populated after assignment ends.

Usage rule:

- The Warehouse Door is current when `effective_to` is absent and the owning Discharge is Planned
  or Active.
- Shift Warehouse Door membership is not the usage source for this feature.

### Discharge Truck Reservation

Relevant fields:

- `discharge_id`: owning Discharge.
- `truck_id`: referenced Truck.
- `registration_snapshot`: registration captured at reservation.
- `transport_company_id` and `transport_company_name_snapshot`: provider context captured at
  reservation.
- `reserved_at`: reservation occurrence.
- `released_at`: absent while current; populated after release.

Usage rule:

- The Truck is current when `released_at` is absent and the owning Discharge is Planned or Active.
- Completing a Shift does not release a Discharge-level Truck reservation.
- Release or Discharge closure stops current usage without changing captured snapshots.

## Relationship Matrix

| Reference kind | Join path from Discharge | Additional current predicate |
| --- | --- | --- |
| Customer | `discharges.id -> product_lots.discharge_id -> customer_id` | None |
| Dock | `discharges.dock_id` | None |
| Weighing Area | `discharges.id -> shifts.discharge_id -> shift_weighing_areas.shift_id` | `effective_to` absent |
| Warehouse Door | `discharges.id -> warehouse_door_product_lot_assignments.discharge_id` | `effective_to` absent |
| Truck | `discharges.id -> discharge_truck_assignments.discharge_id` | `released_at` absent |

Every path also requires `discharges.status` to be Planned or Active.

## State and Release Transitions

```text
Discharge: PLANNED ──> ACTIVE ──> CLOSED
             │           │           └── retained relationships are historical
             └───────────┴── qualifying current relationships may report usage

Membership/assignment: effective_to absent ──> effective_to recorded
                              current                    historical

Truck reservation: released_at absent ──> released_at recorded
                           current                 historical
```

A later current relationship for the same reference makes it used again; historical relationships
remain readable but do not cancel or override that current relationship.

## Validation and Determinism Rules

- Empty input returns an empty Set without a persisted read.
- Duplicate requested IDs are evaluated once.
- Unknown IDs are omitted.
- Multiple qualifying joins for one ID produce one result.
- Input order does not influence the result.
- Returned Set iteration order is lexical by identifier for deterministic consumers and tests.
- Assessment is read-only and preserves every entity, relationship, snapshot, and lifecycle field.

## Additive Index Design

The feature adds no columns and changes no generated model schema. One portable migration adds:

- `discharges(dock_id, status)` for Dock usage filtering.
- `product_lots(customer_id, discharge_id)` for Customer-first filtering and the parent join.

Existing indexes remain in place:

- `shift_weighing_areas(weighing_area_id, effective_to)`.
- `warehouse_door_product_lot_assignments(warehouse_door_id, effective_to)`.
- `discharge_truck_assignments(truck_id, released_at)`.

The migration rollback removes only the two new indexes and never changes business rows.
