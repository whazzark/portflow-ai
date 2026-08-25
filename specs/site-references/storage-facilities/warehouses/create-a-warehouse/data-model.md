# Phase 1 Data Model: Create a Warehouse

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

**No migration is required.** Both tables and every constraint this feature depends on were created
by #207's migration `1784800000000_create_warehouses_tables.ts`. This slice adds a write path over
the existing schema.

## Persisted entities

### `warehouses`

| Column | Type | Set on creation | Notes |
|---|---|---|---|
| `id` | uuid, PK | Yes — `randomUUID()` via the model's `@beforeCreate` hook | Stable identity (FR-013) |
| `name` | string, not null | Yes — trimmed submitted name | Unique **case-insensitively** through `warehouses_name_unique ON warehouses (LOWER(name))`, spanning both lifecycle statuses (FR-009) |
| `status` | enum `AVAILABLE` \| `ARCHIVED`, default `AVAILABLE` | Yes — forced to `AVAILABLE`, never client-supplied (FR-014) | |
| `created_at` / `updated_at` | timestamp, not null | Yes — Lucid auto-timestamps | Creation time (FR-015) |
| `archived_at`, `archived_by_user_id`, `archive_comment` | nullable | No — remain null | Owned by #210 |
| `reactivated_at`, `reactivated_by_user_id`, `reactivation_comment` | nullable | No — remain null | Owned by #211 |

### `warehouse_footprint_points`

| Column | Type | Set on creation | Notes |
|---|---|---|---|
| `warehouse_id` | uuid, FK → `warehouses.id`, `ON DELETE CASCADE` | Yes | Composite PK with `position` |
| `position` | integer unsigned, not null | Yes — `0..n-1` in submitted order | The ordering the read path restores with `orderBy('position', 'asc')`; what makes FR-013 observable |
| `latitude` | double, not null | Yes | DB CHECK `latitude >= -90 AND latitude <= 90` |
| `longitude` | double, not null | Yes | DB CHECK `longitude >= -180 AND longitude <= 180` |

The composite primary key `(warehouse_id, position)` makes a duplicated position impossible, and the
cascade makes the footprint strictly owned by its warehouse — there is no orphan state to clean up
after a rolled-back creation (FR-018).

## Domain rules applied on creation

| Rule | Where enforced | Requirement | Failure |
|---|---|---|---|
| Name is present after trimming, ≤ 255 chars | `createWarehouseValidator`, then `assertValidSiteReferenceName` | FR-007, FR-008 | 422 `E_VALIDATION_ERROR` |
| Name is unique among warehouses, case-insensitively, across statuses | `warehouses_name_unique` index; violation mapped by the repository | FR-009 | 409 `E_WAREHOUSE_NAME_CONFLICT` |
| Name uniqueness ignores docks, weighing areas, and doors | Index is scoped to the `warehouses` table only | FR-010 | — (creation succeeds) |
| At least 3 boundary points | `createWarehouseValidator` (`minLength(3)`) | FR-005 | 422 `E_VALIDATION_ERROR` |
| Each coordinate finite and in range | Validator, then `assertLegalSiteReference{Latitude,Longitude}`, then DB CHECK | FR-011 | 422 `E_VALIDATION_ERROR` |
| No duplicate consecutive points (including last↔first) | `footprint_geometry.ts` via the use case | FR-012 | 422 `E_WAREHOUSE_INVALID_FOOTPRINT` |
| Outline does not cross itself | `footprint_geometry.ts` via the use case | FR-012 | 422 `E_WAREHOUSE_INVALID_FOOTPRINT` |
| Status is `AVAILABLE`, never client-chosen | Use case sets it; no status field in the validator | FR-014 | — |
| Point order is preserved exactly | Repository assigns `position` from array index | FR-013 | — |
| All-or-nothing persistence | Single transaction around both inserts | FR-018 | — |
| Footprints may overlap other warehouses | Deliberately unenforced | Spec Assumptions | — |

## In-memory entities (web)

### Pending footprint

A `LatLng[]` held by `WarehousesPage` while `?create=warehouse` is active. Not a warehouse, never
persisted, and discarded whenever the mode is left (FR-019).

| Operation | Trigger | Result |
|---|---|---|
| Append vertex | Map click while armed | `[...points, point]` |
| Move vertex | Vertex marker drag, or an edited coordinate field | Replaces the entry at that index |
| Remove last vertex | "Remove last point" action | `points.slice(0, -1)` |
| Discard | Leaving the mode, or a successful creation | `[]` |

**Submittable** when `points.length >= 3`, every coordinate parses and is in range, no consecutive
duplicates exist, and the outline does not cross itself — the same predicate the API re-checks.

## Transport shape

Request and response both nest the boundary under `footprint.points`, matching the existing read
contract. The response is the standard warehouse resource, with `doors: []` for a newly created
warehouse. See [contracts/warehouses-create.openapi.yaml](./contracts/warehouses-create.openapi.yaml).

## Relationships untouched by this slice

- **Warehouse → Warehouse Doors**: a warehouse is created with no doors. Door creation, and the rule
  that a door's location falls within or on its warehouse's footprint, belong to roadmap #44.
- **Warehouse → Discharges / Rotations**: no operational link is created here.
- **Warehouse → archive/reactivate audit columns**: written only by #210 and #211.
