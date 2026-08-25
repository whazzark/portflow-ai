# Phase 1 Data Model: Update a Warehouse

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

No migration is introduced. Every table this slice touches exists from #207 (`warehouses`,
`warehouse_footprint_points`) and from the warehouse-door migration (`warehouse_doors`). This
document records what an update may change, what it must leave alone, and the rules that decide
between the two.

## Persisted entities

### `warehouses`

| Column | Update behavior |
|---|---|
| `id` | **Immutable.** Identifies the row being corrected; never rewritten (FR-017). |
| `name` | **Mutable.** Trimmed, 1–255, unique case-insensitively across every warehouse (FR-007 to FR-011a). |
| `status` | **Immutable here.** Only `AVAILABLE` rows may be updated; archival and reactivation are #210 and #211 (FR-003, FR-018). |
| `archived_at`, `archived_by_user_id`, `archive_comment` | **Immutable.** Lifecycle context is never touched by an update (FR-017). |
| `reactivated_at`, `reactivated_by_user_id`, `reactivation_comment` | **Immutable.** As above. |
| `created_at` | **Immutable.** Preserved across every update (FR-017). |
| `updated_at` | **Always written**, including when the submitted values are identical to the stored ones (FR-017, US1 scenario 10). |

The `LOWER(name)` unique index remains the authoritative uniqueness enforcement point; a violation
surfaces as `DUPLICATE_NAME` through `isUniqueViolation`, exactly as on creation.

### `warehouse_footprint_points`

| Column | Update behavior |
|---|---|
| `warehouse_id` | Unchanged — the replacement rows belong to the same warehouse. |
| `position` | **Reassigned from the submitted order**, `0…n-1`, so the stored ring reproduces the resulting outline exactly (FR-015). |
| `latitude`, `longitude` | **Replaced.** Range is enforced by the validator, the use case, and the table's CHECK constraints. |

The footprint is replaced as a whole: every existing row for the warehouse is deleted and the
submitted sequence is inserted, inside the same transaction as the row update (research R3). There is
no per-point identity, no per-point history, and no partial replacement — a failed update leaves the
previous footprint entirely intact (FR-020).

### `warehouse_doors`

**Read-only in this slice, and a constraint on it.** No door row is created, moved, archived, or
deleted (FR-016a). Every door of the warehouse — `AVAILABLE` and `ARCHIVED` alike — must lie within
or on the boundary of the resulting footprint, or the update is refused (FR-016, research R6). This
is the rule `CONTEXT.md` already records for **Warehouse Door GPS Location**; the update enforces it
rather than introducing it.

## Domain rules applied on update

| # | Rule | Enforced in | Failure |
|---|---|---|---|
| 1 | At least one of `name` or `footprint` is present | `updateWarehouseValidator` | 422 validation |
| 2 | `name` non-blank after trimming, ≤ 255 | validator + use case | 422 `E_WAREHOUSE_NAME_INVALID` |
| 3 | Name trimmed before comparing and storing | use case (`normalizeSiteReferenceName`) | — |
| 4 | Name unique case-insensitively across all warehouses, whatever their status | `LOWER(name)` unique index → repository | 409 `E_WAREHOUSE_NAME_CONFLICT` |
| 5 | Resubmitting the warehouse's own name is not a duplicate | the unique index excludes the row being updated | — |
| 6 | 3 ≤ points ≤ `MAX_FOOTPRINT_POINTS`, coordinates numeric and in range | validator + use case | 422 `E_WAREHOUSE_INVALID_FOOTPRINT` |
| 7 | Outline simple, no duplicate consecutive points, encloses an area | `assertSimpleFootprint` (reused unchanged) | 422 `E_WAREHOUSE_INVALID_FOOTPRINT` |
| 8 | Every door contained by the resulting outline | `containsPoint` in the use case | 409 `E_WAREHOUSE_DOORS_OUTSIDE_FOOTPRINT` |
| 9 | The warehouse exists | repository read + guarded write | 404 `E_WAREHOUSE_NOT_FOUND` |
| 10 | The warehouse is `AVAILABLE` | repository read + `status = 'AVAILABLE'` write guard | 409 `E_WAREHOUSE_ARCHIVED` |
| 11 | Caller is an active organization or operations administrator | `WarehousePolicy.update` | 401 / 403 |

Rules 6 to 8 are settled before any transaction opens, so a refused outline never touches
persistence (FR-020). Rules 9 and 10 are decided twice on purpose — once on the read that the
containment check needs anyway, once on the write guard that closes the concurrent-archive window
(research R4).

### Containment

`containsPoint(points, point)` returns true when the point lies strictly inside the ring **or**
exactly on one of its edges or vertices. The boundary case is tested explicitly, before the
even-odd ray cast, because ray casting is undefined on the boundary and the domain makes "on the
boundary" a contained position (research R5).

## In-memory entities (web)

### Warehouse edit session

The unsaved state of "an administrator is part-way through correcting this warehouse". Owned by
`use-warehouse-edit-session.ts`.

| Field | Meaning |
|---|---|
| `warehouseId` | The warehouse the session belongs to; the session is discarded when the selection changes identity or disappears. |
| `editable` | Whether the warehouse was `AVAILABLE` **when the session opened** — snapshotted once, never re-derived from live query data. |
| `originName`, `originPoints` | The stored name and footprint at session start. What cancellation restores, and what "modified" is measured against — not the live, refetchable values. |
| `draftName`, `draftPoints` | The values being edited. `draftPoints` supports move-at-index, insert-at-index, and remove-at-index. |

A session never exists for a warehouse that is not selected, and never survives a change of
selection. A background refetch carrying another administrator's concurrent change must not end an
in-progress edit, masquerade as this administrator's unsaved work, or become what cancellation
restores — the three rules `useCheckpointEditSession` hardened after #199 (research R11).

### Draft footprint

An ordered `LatLng[]`, mirrored by the coordinate rows in the panel. It is not a footprint until the
submission succeeds; the interface never lets it fall below three points (FR-006b), and every
gesture — map or keyboard — produces a complete, renderable outline rather than an intermediate
invalid state.

## Transport shape

Request (`PATCH /api/v1/warehouses/:id`), both members optional, at least one required:

```json
{ "name": "North Shed", "footprint": { "points": [ { "latitude": 49.4938, "longitude": 0.1077 } ] } }
```

Response (200): the warehouse DTO `index` and `store` already return — `id`, `name`, `status`,
`footprint.points` in stored order, and `doors`. The transformer is reused unchanged, so the doors
returned after a successful update are the same doors, at the same positions, now inside the
corrected outline.

## Relationships untouched by this slice

- **Warehouse → doors**: preserved, count and positions identical before and after (FR-022, FR-016a).
- **Warehouse → discharges, rotations, shifts**: preserved; those records reference the warehouse by
  its stable identity, so a correction reaches them without any of them changing (FR-022).
- **Report snapshots and closed records**: never rewritten; they keep the name and footprint captured
  when they were produced (FR-023).
