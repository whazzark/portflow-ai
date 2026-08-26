# Phase 1 Data Model: Create a Warehouse Door

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This slice **persists no new entity and requires no migration**. It writes one row into the
`warehouse_doors` table created by #212 and reads one `warehouses` row with its footprint.

## Persisted entities

### `warehouse_doors` (written — one row per creation)

| Column | Set by this feature | Rule |
|---|---|---|
| `id` | Yes — `randomUUID()` in the model's `@beforeCreate` hook | Stable identity, self-assigned primary key |
| `warehouse_id` | Yes — from the submitted `warehouseId` | FK to `warehouses` with `ON DELETE RESTRICT`; the containment relationship is permanent (FR-008) |
| `name` | Yes — trimmed submitted name | `name = TRIM(name)` and `LENGTH(name) > 0` CHECKs; unique per warehouse without letter case through `warehouse_doors_warehouse_name_unique` on `(warehouse_id, LOWER(name))` (FR-010, FR-011, FR-012) |
| `latitude` / `longitude` | Yes — the pending placement's final position | `latitude BETWEEN -90 AND 90`, `longitude BETWEEN -180 AND 180` CHECKs (FR-013); additionally within or on the containing footprint (FR-014) |
| `status` | Yes — always `'AVAILABLE'` | Column default; never taken from the payload (FR-015) |
| `created_at` / `updated_at` | Yes — by Lucid | `created_at` is the recorded creation time (FR-016) |
| `archived_at`, `archived_by_user_id`, `archive_comment` | No — left `NULL` | Written by #215 |
| `archived_with_warehouse` | No — left at its default | Written by #210's cascade |
| `reactivated_at`, `reactivated_by_user_id`, `reactivation_comment` | No — left `NULL` | Written by #216 |

### `warehouses` (read only, under lock)

Read inside the write transaction as
`.where('id', warehouseId).where('status', 'AVAILABLE').forUpdate()` with `footprintPoints`
preloaded in `position` order (research R5). Two facts are consumed:

- **`status`** — the eligibility precondition (FR-007). A row that does not come back is either
  missing (404) or archived (409); the repository distinguishes the two with a follow-up read.
- **`footprintPoints`** — the ordered ring the submitted point must fall within or on (FR-014),
  evaluated by `containsPoint`.

Nothing in `warehouses` is written.

## Domain rules applied on creation

Evaluated in this order, so a rejection never reaches persistence and never leaves a partial door:

| # | Rule | Enforced by | Failure |
|---|---|---|---|
| 1 | Authenticated, active, administrator role | `WarehouseDoorPolicy.create` via Bouncer | 401 / 403 |
| 2 | `warehouseId` is a UUID; `name` is a non-blank string of 1–255; `latitude`/`longitude` are numbers in range | `createWarehouseDoorValidator` (Vine) | 422 `E_VALIDATION_ERROR` |
| 3 | Trimmed name is non-empty and at most 255 characters | `CreateWarehouseDoorUseCase` | 422 `E_WAREHOUSE_DOOR_NAME_INVALID` |
| 4 | Coordinates are finite and in range | `CreateWarehouseDoorUseCase` via `isLegalSiteReference{Latitude,Longitude}` | 422 `E_WAREHOUSE_DOOR_COORDINATES_INVALID` |
| 5 | The warehouse exists | Repository, inside the transaction | 404 `E_WAREHOUSE_NOT_FOUND` |
| 6 | The warehouse is `AVAILABLE` | Repository, under lock | 409 `E_WAREHOUSE_ARCHIVED` |
| 7 | The point lies within or on the locked footprint | Use-case predicate, evaluated by the repository inside the transaction | 422 `E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT` |
| 8 | The trimmed name is unused in that warehouse, case-insensitively, across both lifecycle states | The unique index, surfaced through `isUniqueViolation` | 409 `E_WAREHOUSE_DOOR_NAME_CONFLICT` |

Rule 4 is a defence in depth: over HTTP the validator rejects an out-of-range coordinate first, so
`E_WAREHOUSE_DOOR_COORDINATES_INVALID` is only observable from a direct use-case call. `CreateWarehouseUseCase`
keeps the same belt-and-braces pair.

**Not applied**: no proximity rule between doors — two doors may share a position, each keeping its
own identity (spec edge case). No rule about the number of doors in a warehouse.

## In-memory entities (web)

### Pending door placement

| Field | Type | Notes |
|---|---|---|
| `pendingDoorPoint` | `LatLng \| null` | The unsaved position. `null` until the first map click or the first complete coordinate pair |
| `name` | `string` | TanStack Form field; preserved across every rejection (FR-018) |

Both are discarded whenever door creation mode ends — cancel, dismissal, navigation, or a change of
selected warehouse (FR-021). The pending point never becomes a `WarehouseDoorDto` client-side: the
created door always comes back from the API.

### Client containment feedback

`isInsideFootprint(selected.footprint.points, pendingDoorPoint)` gates the submit button and drives
an inline message. Feedback only — rule 7 above remains the enforcement point.

## Transport shape

Request `{ warehouseId, name, latitude, longitude }`; response `{ data: WarehouseDoor }` where
`WarehouseDoor` is `WarehouseDoorTransformer`'s output — `id`, `warehouseId`, `name`, `status`,
`latitude`, `longitude`, plus `createdAt` added by this slice (research R6). Full schemas in
[`contracts/warehouse-doors-create.openapi.yaml`](./contracts/warehouse-doors-create.openapi.yaml).

The flat body mirrors the flat columns; unlike #208's `footprint.points`, there is no nested
structure to be symmetric with, and the embedded read shape under `warehouses.index` already presents
`latitude`/`longitude` flat on each door.

## Relationships untouched by this slice

- **Warehouse → doors**: unchanged in both directions. Doors keep arriving embedded under
  `warehouses.index`; the new endpoint adds a write, not a second read path.
- **Door → product lot assignments, shift memberships, rotations**: untouched. A newly created door
  has none, and assigning one stays outside this feature (FR-024).
- **Door lifecycle columns**: untouched. Archival (#215), reactivation (#216), and the
  warehouse-driven cascade (#210, #211) own every one of them.
