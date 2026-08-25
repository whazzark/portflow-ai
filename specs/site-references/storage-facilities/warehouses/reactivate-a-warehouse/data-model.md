# Data Model: Reactivate a Warehouse

**Feature**: `GH-211` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

Phase 1 output. **No migration is required** — every column below already exists (research
**D13**). This document records which of them this slice reads, which it writes, and the invariants
that must hold across the pair of writes.

---

## Entities

### Warehouse (`warehouses`)

| Column | Type | Role in this slice |
|---|---|---|
| `id` | uuid, PK | Selector; never modified |
| `name` | text, unique on `LOWER(name)` | Preserved (FR-013); shown in confirmations and blocker labels |
| `status` | `'AVAILABLE' \| 'ARCHIVED'` | **Written** `ARCHIVED → AVAILABLE`; also the eligibility predicate |
| `archived_at` | timestamp, null | **Preserved** — reactivation never clears it (FR-015) |
| `archived_by_user_id` | uuid, null | **Preserved** |
| `archive_comment` | text, null | **Preserved** |
| `reactivated_at` | timestamp, null | **Written** — submission time, shared across the whole submission |
| `reactivated_by_user_id` | uuid, null | **Written** — the acting administrator |
| `reactivation_comment` | text, null | **Written** — trimmed, or `null` when absent/blank |
| `created_at` | timestamp | Preserved (FR-013) |
| `updated_at` | timestamp | **Written** — set to the same value as `reactivated_at` |

Footprint points live in `warehouse_footprint_points` and are **never touched** by this slice. The
transformer still requires at least three of them to serialize a warehouse, so the reload after the
write must preload them.

### Warehouse Door (`warehouse_doors`)

| Column | Type | Role in this slice |
|---|---|---|
| `id` | uuid, PK | Never modified |
| `warehouse_id` | uuid, FK | Selector for the restore set; never modified (FR-014) |
| `name` | text | Preserved (FR-014) |
| `latitude` / `longitude` | numeric | Preserved (FR-014) |
| `status` | `'AVAILABLE' \| 'ARCHIVED'` | **Written** `ARCHIVED → AVAILABLE`, for the restore set only |
| `archived_with_warehouse` | boolean, `NOT NULL DEFAULT false` | **Read** as part of the restore predicate; **written** to `false` on every restored door (FR-009) |
| `archived_at` | timestamp, null | **Preserved** (FR-015) |
| `archived_by_user_id` | uuid, null | **Preserved** |
| `archive_comment` | text, null | **Preserved** |
| `reactivated_at` | timestamp, null | **Written** — identical to the warehouse's |
| `reactivated_by_user_id` | uuid, null | **Written** — identical to the warehouse's |
| `reactivation_comment` | text, null | **Written** — identical to the warehouse's |
| `updated_at` | timestamp | **Written** — same value |

`archived_with_warehouse` is normalized to a real boolean on read by
`@column({ consume: (value) => Boolean(value) })`, because SQLite (the Japa test database, ADR 0002)
returns `1`/`0`. Any predicate written in application code must therefore compare against `true`,
not a truthy integer.

### Records not touched

`warehouse_door_product_lot_assignments`, shift door memberships, rotations, and discharges are
**read-only for this slice and are not read either** — reactivation has no usage check (research
**D3**). FR-017 requires only that they remain attached, which is satisfied by never writing them.

---

## The restore predicate

The single most important expression in this slice:

```
warehouse_id IN (:eligibleWarehouseIds)
  AND status = 'ARCHIVED'
  AND archived_with_warehouse = true
```

- `status = 'ARCHIVED'` makes the update idempotent under a concurrent restore.
- `archived_with_warehouse = true` is what separates FR-007 (restore) from FR-008 (leave alone).

Both conjuncts are required. Dropping the second resurrects independently archived doors; dropping
the first lets a re-run rewrite the reactivation context of a door already restored.

---

## Write sequence (one transaction)

```
BEGIN
  SELECT … FROM warehouses WHERE id IN (:ids) ORDER BY id FOR UPDATE   -- fixed lock order (D3)
  → compute blockers via findBulkBlockers(ids, byId, 'ARCHIVED')       -- no usedIds (D6)
  → eligibleIds = ids − blocked

  UPDATE warehouses
     SET status='AVAILABLE', reactivated_at=…, reactivated_by_user_id=…,
         reactivation_comment=…, updated_at=…
   WHERE id IN (:eligibleIds) AND status='ARCHIVED'
  → affectedWarehouses MUST equal eligibleIds.length, else throw (D4)

  UPDATE warehouse_doors
     SET status='AVAILABLE', archived_with_warehouse=false, reactivated_at=…,
         reactivated_by_user_id=…, reactivation_comment=…, updated_at=…
   WHERE warehouse_id IN (:eligibleIds) AND status='ARCHIVED' AND archived_with_warehouse=true
  → affectedDoors is RETURNED, not asserted (D4)

  SELECT … reload with footprintPoints + doors preloaded
COMMIT
```

Warehouses are locked before doors are written, matching `applyArchival`, so a concurrent archive
and reactivate over the same warehouse queue instead of deadlocking.

---

## Invariants

| # | Invariant | Enforced by | Spec |
|---|---|---|---|
| I1 | A warehouse is never available while a door archived with it stays archived | Both updates in one transaction | FR-021 |
| I2 | A door is never available while its warehouse is archived | Door update keyed on `eligibleIds`, which are warehouses that just became available | FR-021 |
| I3 | Exactly one reactivation is recorded per warehouse under concurrency | `FOR UPDATE` lock + `status='ARCHIVED'` predicate + affected-row guard | FR-020 |
| I4 | A warehouse and every door restored with it share one timestamp, actor, comment | One command object feeds both updates | FR-007, FR-032 |
| I5 | Independently archived doors are never modified | `archived_with_warehouse = true` conjunct | FR-008 |
| I6 | Archive context survives reactivation on both tables | No `archived_*` column appears in either `SET` clause | FR-015 |
| I7 | A restored door cannot be resurrected by a later warehouse reactivation | `archived_with_warehouse = false` in the door `SET` clause | FR-009 |
| I8 | A refused reactivation changes nothing | Blockers computed before any write; transaction rolls back on throw | FR-022 |

---

## Lifecycle state machine

**Warehouse** — two states, both transitions now delivered:

```
AVAILABLE ──archive (#210, blocked if any door in use)──▶ ARCHIVED
ARCHIVED  ──reactivate (#211, no usage blocker)─────────▶ AVAILABLE
```

Repeatable without limit. Each direction overwrites its own context columns and preserves the
other's, so a warehouse cycled several times shows the most recent archival and the most recent
reactivation side by side — not a history log (spec Assumptions).

**Warehouse door** — same two states, but reachable four ways, which is what `archived_with_warehouse`
disambiguates:

```
AVAILABLE ──its warehouse is archived (#210 cascade)──▶ ARCHIVED, archived_with_warehouse = true
AVAILABLE ──archived on its own (#215)───────────────▶ ARCHIVED, archived_with_warehouse = false
ARCHIVED (marker true)  ──its warehouse is reactivated (#211)──▶ AVAILABLE, marker cleared to false
ARCHIVED (marker false) ──reactivated on its own (#216)───────▶ AVAILABLE
```

This slice owns exactly the third arrow. The second and fourth belong to `#215`/`#216` and are out
of scope; the first is delivered. The marker being cleared on the third arrow is what keeps the
first two distinguishable on the *next* cycle.

---

## Blocker vocabulary

| Reason | When | Reachable here? |
|---|---|---|
| `NOT_FOUND` | Identifier resolves to no warehouse | Yes |
| `ALREADY_AVAILABLE` | Warehouse is already available | Yes |
| `ALREADY_ARCHIVED` | Warehouse is already archived | No — archival only |
| `IN_USE` | A door is held by a Planned or Active Discharge | No — archival only (research **D3**) |

All four live in one union on `BulkWarehouseLifecycleBlocker`; this slice narrows to the first two
by calling `findBulkBlockers` with `expectedStatus: 'ARCHIVED'` and no `usedIds`. The union is not
split per direction, so the shared web `BulkLifecycleBlocker` type and its reason labels stay
unchanged.

---

## Validation rules

| Rule | Value | Source |
|---|---|---|
| Comment maximum length | 1,000 characters | `lifecycleComment()`, shared across every site reference |
| Comment normalization | Trim; empty or whitespace-only → `null` | FR-011, `input.comment?.trim() \|\| null` |
| Selection non-empty | Rejected before evaluation | `lifecycleIds()`, FR-035 |
| Selection duplicate-free | Whole request rejected | `lifecycleIds()`, FR-035 |
| Selection identifiers well-formed | Whole request rejected | `lifecycleIds()`, FR-035 |

Reused verbatim from `#210` — the validators differ only in name.
