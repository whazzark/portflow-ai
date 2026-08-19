# Data Model: Discharge Preparation and Resource Reservations

## Discharge

Represents one unloading operation and its preparation state.

| Field | Type/shape | Rules |
| --- | --- | --- |
| `id` | UUID | Stable identity; managed seed scenarios use fixed IDs. |
| `status` | `PLANNED \| ACTIVE \| CLOSED` | Current lifecycle state. |
| `vesselName` | non-empty text | Required vessel description. |
| `vesselImo` | nullable text | Optional vessel identifier. |
| `vesselComment` | nullable text | Optional descriptive context. |
| `dockId` | UUID | Required current Dock; belongs to the Discharge, not a Shift. |
| `expectedStartAt` | timestamp | Required preparation expectation and stable temporal context. |
| `createdAt`, `updatedAt` | timestamps | Standard persistence timestamps. |

Relationships:

- belongs to one Dock;
- has one or more Product Lots;
- has one or more Discharge Truck Assignments;
- has one or more Shifts;
- has one or more Warehouse Door-to-Product-Lot assignments through Product Lots.

Closed-state lifecycle actor/comment facts are deferred to the later Discharge closure slice; this
feature only establishes the durable state needed to represent and seed Closed preparation graphs.

## Product Lot

Represents a traceable quantity of one product for one Customer within a Discharge.

| Field | Type/shape | Rules |
| --- | --- | --- |
| `id` | UUID | Stable identity. |
| `dischargeId` | UUID | Required parent Discharge; restrict deletion. |
| `customerId` | UUID | Required Customer; restrict deletion. |
| `productName` | non-empty text | Part of the logical identity within a Discharge. |
| `expectedQuantityTonnes` | positive decimal | Required expected quantity; precision must be portable across PostgreSQL and SQLite. |
| `description` | nullable text | Product Lot descriptive information. |
| `createdAt`, `updatedAt` | timestamps | Standard persistence timestamps. |

Constraint: one logical Product Lot per `(dischargeId, customerId, normalized productName)`.

## Discharge Truck Assignment

Represents a Discharge-level reservation and its historical snapshot.

| Field | Type/shape | Rules |
| --- | --- | --- |
| `id` | UUID | Stable identity. |
| `dischargeId` | UUID | Required parent Discharge; restrict deletion. |
| `truckId` | UUID | Required Truck reference; preserve history rather than cascading deletion. |
| `registrationSnapshot` | non-empty text | Truck registration captured at reservation time. |
| `transportCompanyId` | nullable UUID | Current provider identity when resolvable. |
| `transportCompanyNameSnapshot` | non-empty text | Provider name captured at reservation time. |
| `reservedAt` | timestamp | Reservation occurrence. |
| `releasedAt` | nullable timestamp | Set when the reservation no longer blocks new Planned/Active use. |
| `createdAt`, `updatedAt` | timestamps | Standard persistence timestamps. |

Constraint: a Truck has at most one unreleased assignment among Planned and Active Discharges.
Closed assignments remain historical and do not participate in current reservation conflicts.

## Shift

Represents a planned or operational work period belonging to a Discharge.

| Field | Type/shape | Rules |
| --- | --- | --- |
| `id` | UUID | Stable identity. |
| `dischargeId` | UUID | Required parent Discharge; restrict deletion. |
| `sequence` | positive integer | Unique order within the Discharge. |
| `status` | `PLANNED \| ACTIVE \| COMPLETED` | State consistent with the parent scenario. |
| `plannedStartAt`, `plannedEndAt` | timestamps | Required half-open planned range; start precedes end. |
| `responsibleUserId` | UUID | Required eligible User. |
| `createdAt`, `updatedAt` | timestamps | Standard persistence timestamps. |

Constraints: sequences are unique per Discharge, planned ranges do not overlap within a Discharge,
and each non-Closed scenario has at most one Active Shift. Cross-row overlap and reservation checks
are validated atomically because they are not portable as a single SQLite/PostgreSQL constraint.

## Warehouse Door-to-Product-Lot Assignment

Represents the Discharge-specific destination assignment for a Product Lot.

| Field | Type/shape | Rules |
| --- | --- | --- |
| `id` | UUID | Stable identity. |
| `dischargeId` | UUID | Required parent Discharge. |
| `warehouseDoorId` | UUID | Required Door reference; Door remains contained by its Warehouse. |
| `productLotId` | UUID | Required Product Lot belonging to the same Discharge. |
| `effectiveFrom`, `effectiveTo` | timestamps | Effective interval/history; `effectiveTo` is nullable for current assignment. |
| `createdAt`, `updatedAt` | timestamps | Standard persistence timestamps. |

Constraints: the Product Lot and assignment Discharge must agree; effective assignments cannot
conflict for the same Door where the domain permits only one active destination.

## Shift resource memberships

Each resource kind has an explicit, foreign-keyed membership table rather than a polymorphic table.
All three tables have the same shape:

| Field | Type/shape | Rules |
| --- | --- | --- |
| `id` | UUID | Stable identity. |
| `shiftId` | UUID | Required parent Shift. |
| resource ID | UUID | One of `truckId`, `warehouseDoorId`, or `weighingAreaId`; required in its own table. |
| `effectiveFrom`, `effectiveTo` | timestamps | Preserve current and prior membership. |
| `createdAt`, `updatedAt` | timestamps | Standard persistence timestamps. |

Constraints:

- no implicit inheritance between Shifts;
- a membership resource must belong to the same Discharge context through its Shift;
- an Active Shift has at least one effective Truck, Warehouse Door, and Weighing Area;
- a resource used by an in-progress operational record cannot be silently removed in later slices.

## State and reservation relationships

```text
Customer ──< ProductLot >── Discharge ──> Dock
                              │  │  │
                              │  │  └──< Shift ──> User (responsible)
                              │  │             ├──< ShiftTruck ──> Truck
                              │  │             ├──< ShiftWarehouseDoor ──> WarehouseDoor ──> Warehouse
                              │  │             └──< ShiftWeighingArea ──> WeighingArea
                              │  └──< DischargeTruckAssignment ──> Truck ──> TransportCompany
                              └──< WarehouseDoorProductLotAssignment ──> WarehouseDoor
```

Historical snapshots are authoritative for past Discharge context. Current site-reference values
remain authoritative only for present-day eligibility and future reservations.
