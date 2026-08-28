# Phase 1 Data Model: Archive a Warehouse Door

> **Amended by [#216](../reactivate-a-warehouse-door/data-model.md).**
> `warehouse_doors.archived_with_warehouse` is dropped: the cascade takes every door of the
> warehouse and its reactivation gives every one of them back, so the containing warehouse's status
> *is* the provenance. Rows below that write or read the column no longer apply; the rest stands.

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) |
**Contracts**: [API](./contracts/warehouse-doors-archive.openapi.yaml) · [UI state](./contracts/warehouse-door-archive-ui-state.md)

**No migration.** `warehouse_doors` was created by #212 and already carries every column this slice
writes — `archived_with_warehouse` included at the time, though #216 has since dropped it. This slice is the
first writer of that column with the value `false` from a user action.

---

## Warehouse Door

The unloading door being retired. One row of `warehouse_doors`.

| Field | Type | Written by this feature | Notes |
|---|---|---|---|
| `id` | uuid, PK | No | Stable identity; every referencing record keeps pointing at it (FR-016) |
| `warehouse_id` | uuid, FK → `warehouses.id` | No | Permanent containment (`CONTEXT.md`); never reassigned (FR-014) |
| `name` | text, `TRIM`/length CHECKs, unique on `(warehouse_id, LOWER(name))` | No | Stays reserved while archived (FR-019) |
| `latitude` / `longitude` | numeric, range CHECKs | No | Preserved unchanged (FR-014) |
| `status` | `'AVAILABLE' \| 'ARCHIVED'` | **Yes** — `AVAILABLE` → `ARCHIVED` | The only state transition in this slice |
| `archived_at` | timestamp, null | **Yes** — submission time | Shared by every door in one submission (FR-034) |
| `archived_by_user_id` | uuid, null, FK → `users.id` | **Yes** — the authenticated administrator | |
| `archive_comment` | text, null | **Yes** — trimmed, or `null` (FR-012) | Max 1,000 characters (FR-013) |
| ~~`archived_with_warehouse`~~ | ~~boolean~~ | ~~Yes — always `false` (research R4)~~ | **Dropped by #216** |
| `reactivated_at` / `reactivated_by_user_id` / `reactivation_comment` | null-able | No | Prior reactivation context is preserved, never cleared (FR-014) |
| `created_at` | timestamp | No | Preserved (FR-014) |
| `updated_at` | timestamp | **Yes** — set to `archived_at` | A query-builder update bypasses Lucid's timestamp hooks, so it is written explicitly, as every sibling lifecycle write does |

### State transitions

| From | Event | To | Recorded |
|---|---|---|---|
| `AVAILABLE`, warehouse `AVAILABLE`, not in use | Archive (this slice) | `ARCHIVED` | time, actor, comment |
| **any status** | Its warehouse is archived (#210, amended by #216) | `ARCHIVED` | the warehouse's time, actor, comment — replacing any already recorded |
| `ARCHIVED` | Archive attempted again | *(refused)* | nothing — existing context untouched (FR-004) |
| `ARCHIVED`, warehouse archived | Its warehouse is reactivated (#211, amended by #216) | `AVAILABLE` | the warehouse's reactivation context |
| `ARCHIVED`, warehouse available | Reactivated on its own (#216) | `AVAILABLE` | its own reactivation context |

`AVAILABLE` and `ARCHIVED` remain the only door states.

### Invariants this slice must preserve

- ~~**I1** — A door archived on its own is never restored by a warehouse reactivation. Enforced by
  `archived_with_warehouse = false` (research R4), read by #211's `applyReactivation` predicate.~~
  **Superseded by #216**: a door archived on its own sits under an available warehouse, which has no
  reactivation to be restored by; once its warehouse is archived it comes back with it like any
  other.
- **I2** — A door is archived **exactly once**: the guarded `WHERE status = 'AVAILABLE'` update
  combined with the warehouse-then-door lock order makes a concurrent cascade and a direct archival
  serialize, with the loser reporting `ALREADY_ARCHIVED` and overwriting nothing (FR-024, SC-007).
- **I3** — No door is left half-archived: status and the four context columns are written by one
  statement inside one transaction (FR-025).
- **I4** — The name stays reserved: the `(warehouse_id, LOWER(name))` unique index is status-agnostic,
  so nothing has to be done to keep FR-019 true — but a regression test asserts it.
- **I5** — Nothing referencing the door changes: no write in this slice touches
  `warehouse_door_product_lot_assignments`, `shift_warehouse_doors`, rotations, or discharges
  (FR-016, FR-020).
- **I6** — The containing warehouse is untouched, including when its last available door is archived
  (FR-015).

---

## Warehouse (read-only participant)

Read under lock to decide eligibility, never written.

| Field | Use |
|---|---|
| `id` | Lock target; the join key of the pre-read (research R3) |
| `status` | Must be `AVAILABLE` for a door of it to be archivable (FR-005) |

No footprint is read: containment is not re-evaluated by an archival, which moves nothing.

---

## Warehouse Door Usage (derived, not stored here)

The set of door ids currently in use, obtained inside the transaction from the shared checker:

```text
SiteReferenceUsageChecker.findUsedByPlannedOrActiveDischarge({
  referenceType: 'WAREHOUSE_DOOR',
  referenceIds: <submitted door ids>,
  client: <transaction>,
})
```

A door is in use exactly when it holds a **current product lot assignment belonging to a Planned or
Active Discharge** (`#240` FR-006). Closed discharges, ended assignments, past rotations, and shift
membership without a current assignment are not usage (FR-008). This slice adds no second definition
(FR-007).

> **Known limit, inherited not introduced.** The `FOR UPDATE` on the doors serializes this against a
> concurrent archival but not against a discharge being planned: usage lives in
> `warehouse_door_product_lot_assignments`, and a row lock on the door does not block an `INSERT`
> there. Closing that race needs the assignment writer to take the door lock first. No such writer
> exists yet — only seeders — so this remains an obligation on whoever adds one, exactly as
> `LucidWarehouseRepository.findWarehousesWithDoorsInUse` already records.

---

## Repository outcomes

The repository returns discriminated results; the use cases translate them (research R2, R6).

### Single archival

```text
ArchiveWarehouseDoorCommand  = { id, archivedAt, archivedByUserId, archiveComment }
ArchiveWarehouseDoorResult   =
  | { kind: 'ARCHIVED'; door: WarehouseDoor }
  | { kind: 'DOOR_NOT_FOUND' }
  | { kind: 'ALREADY_ARCHIVED' }
  | { kind: 'IN_USE' }
  | { kind: 'WAREHOUSE_NOT_FOUND' }
  | { kind: 'WAREHOUSE_ARCHIVED' }
```

| Result | Exception | HTTP |
|---|---|---|
| `ARCHIVED` | — | 200 |
| `DOOR_NOT_FOUND` | `WarehouseDoorNotFoundException` | 404 `E_WAREHOUSE_DOOR_NOT_FOUND` |
| `ALREADY_ARCHIVED` | `WarehouseDoorAlreadyArchivedException` **(new)** | 409 `E_WAREHOUSE_DOOR_ALREADY_ARCHIVED` |
| `IN_USE` | `WarehouseDoorInUseException` **(new)** | 409 `E_WAREHOUSE_DOOR_IN_USE` |
| `WAREHOUSE_NOT_FOUND` | `WarehouseNotFoundException` | 404 `E_WAREHOUSE_NOT_FOUND` |
| `WAREHOUSE_ARCHIVED` | `ArchivedWarehouseReadOnlyException` | 409 `E_WAREHOUSE_ARCHIVED` |

### Bulk archival

```text
ArchiveWarehouseDoorsCommand = { ids, archivedAt, archivedByUserId, archiveComment }
BulkWarehouseDoorLifecycleResult = {
  updatedDoors:  WarehouseDoor[]              // in submission order
  blockedDoors:  { id, name?, reason }[]      // one reason each
}
reason = 'NOT_FOUND' | 'ALREADY_ARCHIVED' | 'IN_USE'
```

`name` is absent only for `NOT_FOUND`, where no row exists to name — the shape
`BulkWarehouseLifecycleBlocker` and `BulkDockLifecycleBlocker` already have, so the shared bulk bar
renders it with no adapter beyond counting (research R9).

A door whose containing warehouse is archived is, by construction, already archived, and is reported
as `ALREADY_ARCHIVED`; the bulk path therefore needs no fourth reason (research R6).

Invalid submissions — empty `ids`, duplicates, malformed uuids — never reach the repository: the
shared `lifecycleIds()` validator rejects them with a 422 before any row is read (FR-037).

---

## Blocker helper

`warehouse_door_lifecycle_blockers.ts` follows `warehouse_lifecycle_blockers.ts` and
`dock_lifecycle_blockers.ts`:

```text
findBulkBlockers(ids, doorsById, expectedStatus, usedIds) → BulkWarehouseDoorLifecycleBlocker[]
```

`expectedStatus` and the unreachable `ALREADY_AVAILABLE` reason are carried so #216's reactivation
reuses the helper instead of writing a second one — the reason the two delivered copies give.

---

## Web-side types

| Type | Source |
|---|---|
| `WarehouseDoorDto` | Already the door embedded in `warehouses.index` — it exposes `archivedAt` and `archiveComment`, so the Doors panel already renders the archive context (#210). Since #216 it carries no provenance member; the panel reads that off the warehouse's status |
| `BulkWarehouseDoorLifecycleResult` | `Route.Response<'warehouse_doors.archive_many'>['data']`, mirroring `BulkWarehouseLifecycleResult` |
| `WarehouseDoorSelection` | Page state: `Set<string>` of checked door ids, scoped to the selected warehouse's available doors (contract [UI state](./contracts/warehouse-door-archive-ui-state.md)) |

No new persisted entity, no new column, no new index.
