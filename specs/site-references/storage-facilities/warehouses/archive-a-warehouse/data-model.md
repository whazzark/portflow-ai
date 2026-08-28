# Phase 1 Data Model: Archive a Warehouse

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

## Persisted entities

### `warehouses` — no schema change

Already carries every column this feature writes (migration `1784800000000_create_warehouses_tables`).

| Column | Type | Written by this feature |
|---|---|---|
| `id` | uuid PK | never |
| `name` | string | never (FR-016) |
| `status` | enum `AVAILABLE` \| `ARCHIVED` | `AVAILABLE` → `ARCHIVED` |
| `archived_at` | timestamp null | set to the submission time |
| `archived_by_user_id` | uuid null → `users` `SET NULL` | set to the acting administrator |
| `archive_comment` | text null | set to the trimmed comment, or `null` |
| `reactivated_at` / `reactivated_by_user_id` / `reactivation_comment` | | never — preserved (FR-016) |
| `created_at` | timestamp | never (FR-016) |
| `updated_at` | timestamp | set to the same submission time |

Related, untouched: `warehouse_footprint_points` (composite PK `warehouse_id, position`,
`ON DELETE CASCADE`). FR-016 requires the footprint to survive archival intact; since nothing writes
to it, the guarantee is structural and only needs a test.

**Existing index worth noting**: `warehouses_name_unique ON warehouses (LOWER(name))` is
status-independent, which is why FR-022 (archival does not release the name) needs no work.

### `warehouse_doors` — one new column

> **Amended by [#216](../../warehouse-doors/reactivate-a-warehouse-door/data-model.md).** The
> cascade now takes **every** door of the warehouse, replacing the archive context of one already
> archived on its own, and the column this slice added is dropped: with #211 restoring every door
> too, the containing warehouse's status *is* the provenance. The original design is kept below,
> marked, rather than rewritten.

| Column | Type | Written by this feature |
|---|---|---|
| `id` | uuid PK | never |
| `warehouse_id` | uuid → `warehouses` `ON DELETE RESTRICT` | never (FR-017) |
| `name`, `latitude`, `longitude` | | never (FR-017) |
| `status` | enum `AVAILABLE` \| `ARCHIVED` | → `ARCHIVED` for **every** door, **cascade only** (amended by #216) |
| `archived_at` | timestamp null | set to the warehouse's archive time (FR-011) |
| `archived_by_user_id` | uuid null | set to the same administrator (FR-011) |
| `archive_comment` | text null | set to the same comment (FR-011) |
| ~~**`archived_with_warehouse`**~~ | ~~boolean NOT NULL DEFAULT false~~ | ~~NEW — `true` for cascaded doors (FR-013)~~ — **dropped by #216** |
| `reactivated_*` | | never — preserved (FR-017) |
| `created_at` | timestamp | never |
| `updated_at` | timestamp | set to the same submission time |

**Migration**: `<ts>_add_archived_with_warehouse_to_warehouse_doors.ts`, adding the boolean with
`NOT NULL DEFAULT false`. Existing rows — including the seeded archived doors — correctly default to
`false`: they were not archived by a warehouse cascade.

After running it, regenerate `apps/api/database/schema.ts` via `node ace migration:run` (the file
carries a "DO NOT EDIT manually" banner).

**Invariant this column established** (FR-013) — and which, since #216, holds of the warehouse's
status alone, in **both** directions, which is why the column is gone:

```
the containing warehouse's status = 'ARCHIVED'  ⇔  every one of its doors has
                                                   status = 'ARCHIVED'
                                                ∧  archived_at, archived_by_user_id,
                                                   archive_comment equal the warehouse's
```

### Read-only inputs

| Table | Role |
|---|---|
| `discharges` | `status IN ('PLANNED','ACTIVE')` gates usage |
| `warehouse_door_product_lot_assignments` | a row with `effective_to IS NULL` makes its door in use (`#240` FR-006) |

Both are read through the existing `SiteReferenceUsageChecker` with `referenceType: 'WAREHOUSE_DOOR'`
(research **D1**). Neither is written (FR-018).

---

## State transitions

### Warehouse

```
AVAILABLE ──archive──▶ ARCHIVED        (this feature)
ARCHIVED  ──reactivate──▶ AVAILABLE    (#211, out of scope)
```

Guarded by, in order:

1. **Exists** in the operating site — else `NOT_FOUND` (FR-003).
2. **`status = 'AVAILABLE'`** — else `ALREADY_ARCHIVED` (FR-004).
3. **No door of this warehouse is currently in use** — else `IN_USE` (FR-005, FR-006).

A warehouse with **no doors**, or whose doors are **all already archived**, passes rule 3 vacuously
(FR-009).

### Warehouse door (cascade only)

```
AVAILABLE ──(warehouse archived)──▶ ARCHIVED, under the warehouse's context
ARCHIVED  ──(warehouse archived)──▶ ARCHIVED, context replaced by the warehouse's
                                              (amended by #216; was: untouched, FR-012)
```

There is no independent door transition in this slice (research **D11**).

---

## Domain types (API)

```text
app/warehouses/shared/warehouse_lifecycle_blockers.ts
  WarehouseLifecycleRecord      = { id, name, status }
  BulkWarehouseLifecycleBlocker = { id, name?, reason }
  reason ∈ 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE'
  findBulkBlockers(ids, byId, expectedStatus, usedWarehouseIds)
```

Mirrors `weighing_area_lifecycle_blockers.ts`, including the `expectedStatus` parameter and the
`ALREADY_AVAILABLE` member — neither is reachable from this feature, both exist so `#211` reuses the
helper instead of writing a second one (research **D11**).

`usedWarehouseIds` is the **warehouse**-level projection of the door-level usage set (research
**D1**): the checker returns door ids, and the repository maps each back through the door rows it has
already locked.

```text
app/warehouses/shared/repositories/warehouse_repository.ts
  ArchiveWarehouseCommand  = { id,  archivedAt, archivedByUserId, archiveComment }
  ArchiveWarehousesCommand = { ids, archivedAt, archivedByUserId, archiveComment }

  ArchiveWarehouseResult =
    | { kind: 'ARCHIVED'; warehouse: Warehouse; archivedDoorCount: number }
    | { kind: 'NOT_FOUND' }
    | { kind: 'ALREADY_ARCHIVED' }
    | { kind: 'IN_USE' }

  BulkWarehouseLifecycleResult = {
    updatedWarehouses:  Warehouse[]              // each with `doors` preloaded, post-cascade
    blockedWarehouses:  BulkWarehouseLifecycleBlocker[]
  }
```

`archivedDoorCount` on the single result lets the controller report what actually happened rather
than echoing the client's advisory count (research **D9**).

`IN_USE` appears as a repository outcome on the **single** path too — not only as a use-case
exception — because the conditional write can lose a race after the use case's pre-check. The use
case maps every outcome onto its named exception.

### Exceptions

`app/warehouses/shared/warehouse_exceptions.ts`, following `weighing_area_exceptions.ts`:

| Exception | Status | Code |
|---|---|---|
| `WarehouseNotFoundException` | 404 | `E_WAREHOUSE_NOT_FOUND` |
| `WarehouseAlreadyArchivedException` | 409 | `E_WAREHOUSE_ALREADY_ARCHIVED` |
| `WarehouseInUseException` | 409 | `E_WAREHOUSE_IN_USE` |

`E_WAREHOUSE_IN_USE`'s message names the cause — a door of this warehouse is used by a planned or
active discharge — rather than introducing a distinct `DOOR_IN_USE` code (research **D4**).

---

## Validation

Reuses `app/shared/validators/lifecycle_validator.ts` unchanged:

| Validator | Shape |
|---|---|
| `archiveWarehouseValidator` | `{ comment: lifecycleComment() }` |
| `archiveWarehousesValidator` | `{ ids: lifecycleIds(), comment: lifecycleComment() }` |

`lifecycleComment()` is `vine.string().trim().maxLength(1000).nullable().optional()` — FR-014 (trim)
and FR-015 (1,000 chars) for free. `lifecycleIds()` is a min-length-1 array of lowercased UUIDs with
the `distinctUuids` rule — FR-040's three rejections (empty, duplicated, malformed) for free, all
before any row is touched.

A comment that is whitespace-only survives `trim()` as `''`; the use case's `comment?.trim() || null`
maps it to `null` (FR-014), exactly as the weighing-area use cases do.

---

## Web view model

```text
features/warehouses/types.ts
  WarehouseDto            // widened by D8: + archive/reactivation context
  WarehouseDoorDto        // widened by D8: + archive context, + archivedWithWarehouse
  BulkWarehouseLifecycleResult
  WarehouseSelection = Set<string>   // page state, not persisted

features/warehouses/warehouse-lifecycle-adapter.ts
  toBulkLifecycleOutcome(result) -> { updatedCount, blocked }
```

`WarehouseDto` is derived from `Route.Response<'warehouses.index'>`, so the API-side widening
propagates automatically once the Tuyau contract regenerates. The hand-written MSW fixtures do not
(research **D8**).

`WarehouseSelection` holds only ids the administrator may archive: available warehouses, while
`selecting` is active and the user is an administrator. It is scoped to the lifecycle status filter
it was built under (FR-043), survives a search term narrowing the visible set (FR-043), and drops ids
that vanish from the collection entirely — the same three rules the Checkpoints page already
implements for `checkedIds`.
