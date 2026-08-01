# Data Model: List Warehouse Doors

## Warehouse Door

A site reference representing one exact unloading point permanently contained by one warehouse in
the application's current single-site scope.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key; stable and application-assigned |
| `warehouseId` | UUID | Required foreign key to `warehouses.id`; immutable after creation; parent deletion restricted |
| `name` | string | Required; 1–255 characters after trimming; stored without surrounding whitespace; display casing preserved |
| `latitude` | double | Required; `-90 <= latitude <= 90` |
| `longitude` | double | Required; `-180 <= longitude <= 180` |
| `status` | enum | Required; `AVAILABLE` or `ARCHIVED`; defaults to `AVAILABLE` |
| `createdAt` | datetime | Required; set when the door is first persisted |
| `updatedAt` | datetime | Required; updated when a future mutation changes the door |

Indexes and constraints:

- Primary key on `id`.
- Foreign key from `warehouse_id` to `warehouses.id` with `ON DELETE RESTRICT`.
- Unconditional unique expression index on `(warehouse_id, LOWER(name))`; available and archived
  doors share the same namespace, while another warehouse may reuse the name.
- Check that `name = TRIM(name)` and `LENGTH(name) > 0` so every persisted display name satisfies
  the clarified normalization invariant.
- Check latitude and longitude ranges independently.
- Index on `(warehouse_id, status)` for warehouse lifecycle projections and later selector-safe
  queries.

Lifecycle interpretation:

```text
AVAILABLE -- archive (#215) --> ARCHIVED
ARCHIVED -- reactivate (#216) --> AVAILABLE
```

- Issue #212 reads status and never performs either transition.
- Archiving does not release the warehouse-scoped name.
- An available door is usable for future operations only while its containing warehouse is also
  available.
- An archived door remains readable as a historical reference.
- Archive/reactivation timestamps, actors, and comments are not persisted by this slice; issues
  #215 and #216 own their observable transition contracts and any required provenance columns.

## Warehouse Relationship

```text
Warehouse 1 ───── contains ───── 0..* Warehouse Door
Warehouse Door 1 ─ belongs to ── exactly 1 Warehouse
```

- A door's `warehouseId` never changes. Moving its GPS point within the same warehouse is a future
  update; moving the door to another warehouse is not a valid transition.
- The door point is within or on the boundary of the ordered footprint owned by its warehouse.
- An archived warehouse has no available doors; its doors remain historical references.
- These point-in-polygon and parent/child lifecycle rules span records. This read-only slice seeds
  and reads valid data; create, update, archive, and reactivation use cases enforce the rules when
  they introduce the relevant writes.
- `ON DELETE RESTRICT` protects stable door identity even though permanent warehouse and door
  deletion are outside the product lifecycle.

## Site Scope

The current product model has one operating organization and one implicit site. Warehouses and
warehouse doors therefore carry no site or organization foreign key in this slice. Every returned
door and its parent warehouse belong to that single operational scope. A future multi-site feature
must introduce scope consistently across all site references rather than adding a door-only tenant
key.

## Collection Projections

The warehouse repository preloads every contained door ordered by case-folded name, display name,
and door identity. The warehouse transformer emits the existing warehouse fields plus:

```text
WarehouseCollectionItem
├── id
├── name
├── status
├── footprint
└── doors[]
    ├── id
    ├── name
    ├── status
    ├── latitude
    └── longitude
```

Structural containment is authoritative, so an embedded door does not repeat `warehouseId`. The web
adapter derives directly from the selected warehouse:

- the doors belonging to the selected warehouse;
- Available and Archived counts for that warehouse from one response snapshot;
- the effective lifecycle view (`doorStatus` from the URL, otherwise the selected warehouse's
  lifecycle state);
- the admitted marker and list collection;
- the selected door only when its stable identity belongs to the selected warehouse and remains in
  the active lifecycle view.

No door query, detail request, client join, or duplicated warehouse name/status/footprint is required.

The warehouse-door repository also returns the selector-safe available collection. It joins the
containing warehouse at the query boundary, requires both statuses to be `AVAILABLE`, orders by
warehouse identity then case-folded name, display name, and door identity, and emits:

```text
AvailableWarehouseDoorCollectionItem
├── id
├── warehouseId
├── name
├── status = AVAILABLE
├── latitude
└── longitude
```

This collection is prepared for future discharge selectors but is not consumed by the warehouse
consultation UI in Issue #212.
