# Data Model: List Warehouses

## Warehouse

A site reference representing one storage destination in the application's current single-site
scope.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key; stable and application-assigned |
| `name` | string | Required; trimmed on future writes; case-insensitively unique |
| `status` | enum | Required; `AVAILABLE` or `ARCHIVED`; defaults to `AVAILABLE` |
| `archivedAt` | datetime, nullable | Set by a future successful archive action |
| `archivedByUserId` | UUID, nullable | References users; `SET NULL` if the actor is removed |
| `archiveComment` | text, nullable | Preserved for future lifecycle consultation/admin slices |
| `reactivatedAt` | datetime, nullable | Set by a future successful reactivation action |
| `reactivatedByUserId` | UUID, nullable | References users; `SET NULL` if the actor is removed |
| `reactivationComment` | text, nullable | Preserved for future lifecycle consultation/admin slices |
| `createdAt` | datetime | Required |
| `updatedAt` | datetime | Required |

Indexes:

- Unique index on `LOWER(name)`.
- Index on `status` for lifecycle collection access.

Lifecycle consistency:

- `AVAILABLE` is usable by future operational workflows.
- `ARCHIVED` is historical and read-only.
- This feature reads lifecycle state and does not perform transitions.
- Future transition use cases own atomic updates and metadata consistency.

## Warehouse Footprint

A required ordered polygon value belonging to exactly one warehouse. It is represented by the
warehouse's complete ordered set of `WarehouseFootprintPoint` rows; it has no separate identity,
center, address, or GPS point.

Validation invariant for persisted data:

- A footprint contains at least three distinct boundary points.
- Point order traces the polygon boundary; the first point is not duplicated at the end in storage.
- The final edge is implicitly the last point back to the first point.
- Every latitude is within `[-90, 90]` and longitude within `[-180, 180]`.
- All points are returned; listing never simplifies or truncates the boundary.
- Polygon-shape validation belongs to create/update contracts, not this read-only slice.

Display framing is a derived value:

1. Find minimum and maximum longitude across all points.
2. Find minimum and maximum latitude across all points.
3. Add presentation padding to those bounds.
4. Convert the ordered points to a GeoJSON polygon for the MapLibre layer and close the polygon
   from the final point back to the first point.

## WarehouseFootprintPoint

| Field | Type | Rules |
|---|---|---|
| `warehouseId` | UUID | Foreign key to `warehouses.id`; cascade on warehouse removal |
| `position` | non-negative integer | Boundary order; unique within the warehouse |
| `latitude` | double | Required; database check `-90 <= latitude <= 90` |
| `longitude` | double | Required; database check `-180 <= longitude <= 180` |

Primary key: (`warehouseId`, `position`).

Relationship: `Warehouse 1 — 3..* WarehouseFootprintPoint`.

Although site references are not permanently deleted by business behavior, cascade cleanup keeps
development rollback/factory teardown referentially safe.

## Collection projection

The repository returns warehouses ordered case-insensitively by name and points ordered by
`position`, assembled as:

```text
WarehouseCollectionItem
├── id
├── name
├── status
└── footprint
    └── points[]
        ├── latitude
        └── longitude
```

Available and archived counts are derived from this projection, so they always describe the same
successfully retrieved snapshot as the rendered records.
