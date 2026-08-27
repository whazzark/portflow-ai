# Phase 1 Data Model: Update a Warehouse Door

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This slice **persists no new entity and requires no migration**. It updates at most three columns of
one `warehouse_doors` row created by #212/#213, and reads one `warehouses` row with its footprint.

## Persisted entities

### `warehouse_doors` (written — one row per update)

| Column | Written by this feature | Rule |
|---|---|---|
| `name` | Only when submitted | Trimmed before validating and storing (FR-009); `name = TRIM(name)` and `LENGTH(name) > 0` CHECKs; unique per warehouse without letter case through `warehouse_doors_warehouse_name_unique` on `(warehouse_id, LOWER(name))` (FR-010, FR-011, FR-011a) |
| `latitude` / `longitude` | Only when submitted, always as a pair | `latitude BETWEEN -90 AND 90`, `longitude BETWEEN -180 AND 180` CHECKs (FR-012); additionally within or on the containing footprint read under lock (FR-013, FR-013a) |
| `updated_at` | Yes — always, on every successful update | Set explicitly: a query-builder `update()` bypasses Lucid's timestamp hooks (research R5). This is FR-014's last-updated record |
| `id` | **No** | Stable identity (FR-003, FR-014) |
| `warehouse_id` | **No** | Containment is permanent (`CONTEXT.md`); the payload has no member that names a warehouse (FR-003, FR-027) |
| `status` | **No** | Lifecycle belongs to #215/#216 (FR-003) |
| `created_at` | **No** | Preserved across the update (FR-014) |
| `archived_at`, `archived_by_user_id`, `archive_comment`, `archived_with_warehouse`, `reactivated_at`, `reactivated_by_user_id`, `reactivation_comment` | **No** | The lifecycle context is never modified by an update (FR-014) |

The row is reached through a **guarded update** — `WHERE id = ? AND status = 'AVAILABLE'` — so an
archived door is refused by the write itself rather than by a read that a concurrent archival could
invalidate.

### `warehouses` (read only, under lock)

Read inside the write transaction as
`.where('id', door.warehouseId).where('status', 'AVAILABLE').forUpdate()` with `footprintPoints`
preloaded in `position` order (research R2). Two facts are consumed:

- **`status`** — the eligibility precondition (FR-016). A row that does not come back is either
  missing (404) or archived (409); the repository distinguishes the two with a follow-up read, as
  `create` already does.
- **`footprintPoints`** — the ring a submitted position must fall within or on (FR-013, FR-013a),
  evaluated by `containsPoint`. Not read at all when no position was submitted (research R3).

Nothing in `warehouses` is written.

**Lock order**: warehouse, then door — the order `LucidWarehouseDoorRepository.create` (#213) and
#210's archival cascade already take. The door's `warehouse_id` is learned by an unlocked pre-read
before the transaction opens, which is safe because containment is permanent (research R2).

## Domain rules applied on update

Evaluated in this order, so a rejection never reaches persistence and never leaves a door renamed
without being moved, or moved without being renamed:

| # | Rule | Enforced by | Failure |
|---|---|---|---|
| 1 | Authenticated, active, administrator role | `WarehouseDoorPolicy.update` via Bouncer | 401 / 403 |
| 2 | At least one of `name`, `latitude`, `longitude`; a submitted `name` is a non-blank string of 1–255; coordinates are numbers in range and submitted **together** | `updateWarehouseDoorValidator` (Vine) | 422 `E_VALIDATION_ERROR` |
| 3 | Trimmed name is non-empty and at most 255 characters | `UpdateWarehouseDoorUseCase` | 422 `E_WAREHOUSE_DOOR_NAME_INVALID` |
| 4 | Coordinates are finite and in range | `UpdateWarehouseDoorUseCase` via `isLegalSiteReference{Latitude,Longitude}` | 422 `E_WAREHOUSE_DOOR_COORDINATES_INVALID` |
| 5 | The door exists (a malformed id resolves here, never to a server error) | Repository, `isUuid` guard plus the pre-read | 404 `E_WAREHOUSE_DOOR_NOT_FOUND` |
| 6 | The containing warehouse exists | Repository, inside the transaction | 404 `E_WAREHOUSE_NOT_FOUND` |
| 7 | The containing warehouse is `AVAILABLE` | Repository, under lock | 409 `E_WAREHOUSE_ARCHIVED` |
| 8 | A submitted position lies within or on the locked footprint | Use-case predicate, evaluated by the repository inside the transaction | 422 `E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT` |
| 9 | The door is `AVAILABLE` | The guarded `WHERE status = 'AVAILABLE'`, resolved after the write | 409 `E_WAREHOUSE_DOOR_ARCHIVED` |
| 10 | The resulting trimmed name is unused by **another** door of that warehouse, case-insensitively, across both lifecycle states | The unique index, surfaced through `isUniqueViolation` | 409 `E_WAREHOUSE_DOOR_NAME_CONFLICT` |

Rule 4 is a defence in depth: over HTTP the validator rejects an out-of-range coordinate first, so
`E_WAREHOUSE_DOOR_COORDINATES_INVALID` is only observable from a direct use-case call. `CreateWarehouseDoorUseCase`
and `UpdateWarehouseUseCase` keep the same belt-and-braces pair.

Rule 10 needs **no self-exclusion clause**: a unique index constrains a row against other rows, so a
door resubmitting its own name — or a different casing of it — satisfies the index and succeeds
(research R4). That same index is what resolves two concurrent claims of one name to exactly one
winner (FR-019).

**Not applied**: no proximity rule between doors — a door may be moved onto another door's position,
each keeping its own identity (spec edge case). No usage check — a door assigned to a product lot,
planned into a shift, or targeted by an in-progress rotation is still updatable (FR-021), unlike
warehouse archival which is blocked by usage. No containment check on a name-only update (research
R3).

## Repository contract (API)

```text
UpdateWarehouseDoorCommand = {
  id: string
  name?: string
  latitude?: number
  longitude?: number
  /** Present only when a position was submitted. Decides whether it lies inside the containing
    * footprint. The caller keeps the geometry; the repository calls it inside the write
    * transaction, against the ring it read under lock. Same shape as CreateWarehouseDoorCommand. */
  contains?: (points: WarehouseFootprintPoint[]) => boolean
}

UpdateWarehouseDoorResult =
  | { kind: 'UPDATED'; door: WarehouseDoor }
  | { kind: 'DOOR_NOT_FOUND' }
  | { kind: 'DOOR_ARCHIVED' }
  | { kind: 'WAREHOUSE_NOT_FOUND' }
  | { kind: 'WAREHOUSE_ARCHIVED' }
  | { kind: 'OUTSIDE_FOOTPRINT' }
  | { kind: 'DUPLICATE_NAME' }
```

Every arm except `UPDATED` is a **repository outcome rather than a pre-check**: the guarded read and
the guarded write can each lose a race against an archival or a concurrent rename, and the
transaction is the only place that sees it.

## Transformer

`WarehouseDoorTransformer` gains `updatedAt` beside the `createdAt` #213 added. The 200 response is
where an administrator observes FR-014's last-updated record. Additive for the two existing
consumers — `warehouse_doors.available` and #213's 201 — and deliberately **not** mirrored onto the
doors embedded by `WarehouseTransformer`, because no consultation surface renders it.

## In-memory entities (web)

### `WarehouseDoorEditSession`

Owned by `useWarehouseDoorEditSession`, modelled on `useCheckpointEditSession` (research R8).

| Member | Meaning |
|---|---|
| `warehouseId` | The warehouse the session belongs to; it never outlives that selection |
| `doorId` | The door being corrected; the session is discarded when the selection changes identity |
| `editable` | Snapshotted once: the door is `AVAILABLE` **and** its warehouse is `AVAILABLE` |
| `originName` | What the door was called when the session started — not its live, refetchable name |
| `origin` | Where the door stood when the session started — what "Restore original position" restores |

`editable`, `originName`, and `origin` are decided once, when the session opens, and never
re-derived from live query data: a background refetch of another administrator's concurrent change
must not silently end an in-progress edit, masquerade as this administrator's unsaved work, or become
what cancelling restores.

The **draft** position lives beside the session and is what the map marker and the coordinate fields
are both bound to. The door under edit is filtered out of the map's ordinary marker layer while the
session is open, so a stale stored marker and the live draft never both claim to be the same door
(research R7).

## Relationships unchanged by this feature

A successful update touches no other table. `shift_warehouse_doors`,
`warehouse_door_product_lot_assignments`, and every rotation referencing the door hold its **stable
identity**, so a rename or a reposition is reflected wherever the door is displayed without any
operational record changing (FR-021). Report snapshots and other closed historical records keep the
name and position captured when they were produced (FR-022) — they store values, not references.
