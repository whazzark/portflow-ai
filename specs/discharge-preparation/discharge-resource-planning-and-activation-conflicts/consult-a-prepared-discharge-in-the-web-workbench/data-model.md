# Phase 1 Data Model: Consult a Prepared Discharge in the Web Workbench

This slice changes no table, column, index, migration, factory, or seed. It reads every entity
below without writing to it, and all of them were delivered by GH-236 or by the site-reference
slices. This document describes the **read model** the slice builds from them. The authoritative
field list is [`contracts/discharge-detail.openapi.yaml`](./contracts/discharge-detail.openapi.yaml).

## Persisted entities consumed

### Discharge (`discharges`, `#models/discharge`)

| Field | Type | Use in this slice |
|---|---|---|
| `id` | uuid, PK | Address of the detail; lookup key |
| `status` | `PLANNED` \| `ACTIVE` \| `CLOSED` | Status badge (FR-005) |
| `vesselName` | string, non-empty | Page heading |
| `vesselImo` | string, nullable | Identity field; `Not specified` when null (FR-017) |
| `vesselComment` | text, nullable | Identity field; `Not specified` when null. The list withholds it; the detail shows it |
| `dockId` | uuid → `docks.id` | Resolved to the dock's name and status |
| `expectedStartAt` | timestamp, not null | Identity field |
| `createdAt` / `updatedAt` | timestamp | **Not exposed**: no requirement reads them |

Relations used: `dock`, `productLots`, `truckAssignments`, `shifts`. `doorAssignments` is reached
through each product lot rather than from the discharge, because FR-008 shows each assignment on
the lot it serves.

### Product Lot (`product_lots`, `#models/product_lot`)

| Field | Use |
|---|---|
| `id` | Identity; last tie-breaker in the lot order |
| `customerId` → `customers` | Resolved to the customer's `companyName` and `status` |
| `productName` | Shown; second key in the lot order |
| `expectedQuantityTonnes` | `Decimal` in the model; serialized as a fixed-3 string (research, Decision 5) |
| `description` | Shown; `Not specified` when null |

Relation used: `doorAssignments`, with each assignment's `warehouseDoor.warehouse`.

### Warehouse Door Assignment (`warehouse_door_product_lot_assignments`)

| Field | Use |
|---|---|
| `id` | Identity; tie-breaker |
| `warehouseDoorId` → `warehouse_doors` | Resolved to the door's `name` and `status`, and its warehouse's `name` and `status` |
| `productLotId` | Attaches the assignment to its lot |
| `effectiveFrom` | Start of the period; order key |
| `effectiveTo` | End of the period; **null means in effect** (research, Decision 4) |

### Discharge Truck Assignment (`discharge_truck_assignments`)

| Field | Use |
|---|---|
| `id` | Identity; tie-breaker |
| `truckId` → `trucks` | Resolved to the truck's current `status`, for the archived or suspended marker. Its current `registration` is used only as the fallback in Decision 3 |
| `registrationSnapshot` | **The registration shown**, in the pool and in the shifts (FR-011, FR-013); order key |
| `transportCompanyId` | Nullable (`ON DELETE SET NULL`). When present, resolved to the company's current `status` for the archived marker |
| `transportCompanyNameSnapshot` | **The company name shown** (FR-011) |
| `reservedAt` | Shown |
| `releasedAt` | **Null means held**; otherwise shown as released at this time (FR-012) |

### Shift (`shifts`, `#models/shift`)

| Field | Use |
|---|---|
| `id` | Identity; tie-breaker |
| `sequence` | **Not exposed**: `CONTEXT.md` identifies a shift to users by its planned period |
| `status` | `PLANNED` \| `ACTIVE` \| `COMPLETED` (FR-009) |
| `plannedStartAt` / `plannedEndAt` | The shift's identifying period; `plannedStartAt` is the order key |
| `responsibleUserId` → `users` | Resolved to `firstName` and `lastName` only |

Relations used: `responsible`, `truckMemberships`, `warehouseDoorMemberships` (with
`warehouseDoor.warehouse`), and `weighingAreaMemberships` (with `weighingArea`).

### Shift memberships (`shift_trucks`, `shift_warehouse_doors`, `shift_weighing_areas`)

Each has an `id`, a `shiftId`, the FK to its resource, `effectiveFrom`, and a nullable
`effectiveTo`, with the same meaning as a warehouse door assignment. Each is ordered by
`effectiveFrom`, then `id`.

### Site references and users read

| Entity | Fields read | Note |
|---|---|---|
| Dock | `id`, `name`, `status` | `AVAILABLE` \| `ARCHIVED` |
| Customer | `id`, `companyName`, `status` | The customer code is not shown; the lot is identified by customer and product name |
| Warehouse | `id`, `name`, `status` | |
| Warehouse Door | `id`, `name`, `status`, `warehouseId` | Always shown with its warehouse |
| Weighing Area | `id`, `name`, `status` | |
| Truck | `id`, `status`, `registration` | `AVAILABLE` \| `SUSPENDED` \| `ARCHIVED`; `registration` only as a fallback |
| Transport Company | `id`, `status` | The name shown is the pool's snapshot, never the current name |
| User | `id`, `firstName`, `lastName` | No email, role, or access status (spec, Assumptions) |

Archived references are read like any other (FR-015). The repository applies no status filter
anywhere in the graph.

## Projected read model

The transformer emits one `DischargeDetail`, which the web DTO type mirrors.

```text
DischargeDetail
├── id, status, vesselName, vesselImo, vesselComment, expectedStartAt
├── expectedTonnage  : string (fixed 3 decimals, decimal sum of the lots)
├── dock             : ReferenceLabel
├── productLots[]    : ordered by customer name, product name, id
│   ├── id, productName, description, expectedQuantityTonnes (fixed-3 string)
│   ├── customer     : ReferenceLabel
│   └── doorAssignments[] : ordered by effectiveFrom, id
│       └── id, effectiveFrom, effectiveTo, warehouseDoor: ReferenceLabel, warehouse: ReferenceLabel
├── truckPool[]      : ordered by captured registration, id
│   └── id, truckId, registration (captured), truckStatus, reservedAt, releasedAt,
│       transportCompany: { id | null, name (captured), status | null }
└── shifts[]         : ordered by plannedStartAt, id
    ├── id, status, plannedStartAt, plannedEndAt
    ├── responsible  : { id, firstName, lastName }
    ├── trucks[]         : id, truckId, registration (captured), truckStatus, effectiveFrom, effectiveTo
    ├── warehouseDoors[] : id, effectiveFrom, effectiveTo, warehouseDoor: ReferenceLabel, warehouse: ReferenceLabel
    └── weighingAreas[]  : id, effectiveFrom, effectiveTo, weighingArea: ReferenceLabel

ReferenceLabel = { id, name, status }   // status is the reference's current lifecycle status
```

Derived in the browser, never sent:

| Derived value | From | Requirement |
|---|---|---|
| In effect or ended | `effectiveTo === null` | FR-014 |
| Held or released | `releasedAt === null` | FR-012 |
| "No door currently assigned" | Planned or active discharge, lot with assignments, none in effect | FR-008 |
| "No door assigned" | Lot with no assignment at all | FR-008 |
| "None selected" per shift resource type | That type's array is empty | FR-010 |
| Section empty states | `productLots`, `shifts`, or `truckPool` is empty | FR-018 |
| Tonnage display | `formatTonnes(fixed-3 string)`: grouping, three decimals, `t` | FR-007 |
| Archived or suspended marker | A `ReferenceLabel.status` or `truckStatus` other than `AVAILABLE` | FR-015 |

## Invariants this slice relies on

- A discharge always has a dock and an expected start (`NOT NULL`, GH-236), so neither needs a
  placeholder.
- A product lot is unique per discharge, customer, and lower-cased product name, so the lot order
  is total even before its `id` tie-breaker.
- `expected_quantity_tonnes` is strictly positive with three decimals (`NUMERIC(12,3)`), so the
  fixed-3 serialization loses nothing.
- A shift's planned start precedes its planned end, and `sequence` is unique per discharge, so
  the order by planned start agrees with the order the shifts were prepared in.
- A pool entry's `released_at` is never earlier than its `reserved_at`, and a truck appears at
  most once per discharge pool (`UNIQUE (discharge_id, truck_id)`). So "resolve a shift truck's
  registration from the pool" yields at most one value.
- Nothing ties a shift truck membership to a pool entry at the database level, hence the fallback
  in research Decision 3.
- `transport_company_id` may be null, but `transport_company_name_snapshot` never is, so a pool
  entry always has a company name to show.

## State transitions

None. The slice writes nothing and observes no transition. A discharge whose status, lots, shifts,
or assignments change elsewhere appears in its new state on the next fetch (FR-024). The detail
query uses `staleTime: 0`, as the list does, so every visit refetches.
