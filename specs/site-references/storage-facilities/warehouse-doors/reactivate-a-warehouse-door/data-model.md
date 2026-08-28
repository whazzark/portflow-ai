# Phase 1 Data Model: Reactivate a Warehouse Door

**Feature**: `GH-216` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

No entity is created and no column is added — one is **dropped**: `archived_with_warehouse`, which
this slice's clarification makes redundant (spec Clarifications, research R5). Beyond that, the
slice writes four columns of one existing table and reads one other, plus the containing warehouse's
status, to decide whether it may.

## Persisted entity: `warehouse_doors`

Created by #212, extended with lifecycle columns by #210. Every column below already exists
(`apps/api/database/schema.ts:377`); this slice adds none and removes one.

| Column | Role in this feature | Written? |
|---|---|---|
| `id` | Addressed by the endpoint's path parameter | No |
| `warehouse_id` | Names the warehouse to lock first (research R4) | No |
| `name` | Preserved (FR-012); its uniqueness is unaffected (spec Assumptions) | No |
| `latitude`, `longitude` | Preserved (FR-012); containment is not re-validated (research R6) | No |
| `status` | `'ARCHIVED'` → `'AVAILABLE'` | **Yes** |
| ~~`archived_with_warehouse`~~ | **Dropped by this slice**: the containing warehouse's status states the origin (research R5) | Removed |
| `archived_at`, `archived_by_user_id`, `archive_comment` | Preserved so the history stays consultable (FR-013) | No |
| `reactivated_at` | The transition's time | **Yes** |
| `reactivated_by_user_id` | The responsible administrator | **Yes** |
| `reactivation_comment` | Trimmed, or `null` (FR-010) | **Yes** |
| `created_at` | Preserved (FR-012) | No |
| `updated_at` | Advanced to `reactivated_at`, as #210's cascade does (research R5) | **Yes** |

### Eligibility, as a predicate

A door is reactivatable when **both** hold:

```
door.status      = 'ARCHIVED'
warehouse.status = 'AVAILABLE'
```

The first is enforced by the guarded `UPDATE`'s `WHERE`, the second by the `FOR UPDATE` read that
precedes it. Neither is evaluated off an unlocked read.

Together they *are* "archived on its own": archiving a warehouse takes every door it holds and
reactivating it gives every one of them back, so an archived warehouse holds no door but doors
archived with it, and an available one holds no archived door but doors retired on their own. No
third conjunct on the door itself is needed, or possible — the column that carried one is dropped.

### State transitions

```
   warehouse AVAILABLE          #215 archive (on its own)
   ─────────────────────  AVAILABLE ─────────────────────► ARCHIVED
                              ▲                                │
                              └────────────────────────────────┘
                                      this slice (#216)

   warehouse ARCHIVED           #210 archive (cascade, every door)
   ─────────────────────  AVAILABLE ─────────────────────► ARCHIVED
                              ▲                                │
                              └────────────────────────────────┘
                              #211 reactivate (cascade, every door)
```

One archived state, reached and left two ways — and which way is in force is read off the containing
warehouse, not off the door. This slice owns exactly the upper right-hand arrow:
`ARCHIVED ∧ warehouse AVAILABLE → AVAILABLE`. The lower pair is #210's and #211's and is not touched
here beyond the widening their own specs now record.

A door may traverse the cycle any number of times (FR-015); each direction stores its own context
and the most recent write of that direction wins. No history table is introduced.

## Transport types (apps/api)

### `ReactivateWarehouseDoorCommand`

```ts
type ReactivateWarehouseDoorCommand = {
  id: string
  reactivatedAt: DateTime
  reactivatedByUserId: string
  /** Already trimmed by the use case; `null` for absent, empty, and whitespace-only. */
  reactivationComment: string | null
}
```

Shaped after `ReactivateWarehouseCommand`. The actor and the time are supplied by the controller
from the authenticated session and `DateTime.now()`, never from the request body.

### `ReactivateWarehouseDoorResult`

```ts
type ReactivateWarehouseDoorResult =
  | { kind: 'REACTIVATED'; door: WarehouseDoor }
  | { kind: 'DOOR_NOT_FOUND' }
  | { kind: 'ALREADY_AVAILABLE' }
  | { kind: 'WAREHOUSE_ARCHIVED' }
  | { kind: 'WAREHOUSE_NOT_FOUND' }
```

Every arm but `REACTIVATED` is a repository *outcome* rather than a pre-check: the guarded warehouse
read and the guarded door write can each lose a race, and the transaction is the only place that
sees it. The four refusals map one-to-one onto exceptions in the use case (research R3) — the
repository raises none of them itself.

### Result → exception mapping (owned by the use case)

| Result kind | Exception | Code | Status |
|---|---|---|---|
| `DOOR_NOT_FOUND` | `WarehouseDoorNotFoundException` | `E_WAREHOUSE_DOOR_NOT_FOUND` | 404 |
| `ALREADY_AVAILABLE` | `WarehouseDoorAlreadyAvailableException` | `E_WAREHOUSE_DOOR_ALREADY_AVAILABLE` | 409 |
| `WAREHOUSE_ARCHIVED` | `WarehouseDoorArchivedWithWarehouseException` | `E_WAREHOUSE_DOOR_ARCHIVED_WITH_WAREHOUSE` | 409 |
| `WAREHOUSE_NOT_FOUND` | `WarehouseNotFoundException` *(reused)* | `E_WAREHOUSE_NOT_FOUND` | 404 |

`WarehouseNotFoundException` comes from `#warehouses/shared/warehouse_exceptions`, following the rule
stated at the head of `warehouse_door_exceptions.ts`: when the failing fact is the warehouse's, the
warehouse's code names it. `WAREHOUSE_ARCHIVED` is the one deliberate exception to that rule (FR-007):
`E_WAREHOUSE_ARCHIVED` carries "Reactivate the warehouse first", which would send the administrator
back here for a second submission they do not need to make.

## Read model (apps/web)

`WarehouseDoorDto`, as embedded under `GET /api/v1/warehouses` by `WarehouseTransformer`, **already
carries every member this slice needs** — `status`, `archivedAt`, `archivedByUserId`,
`archiveComment`, `reactivatedAt`, `reactivatedByUserId`, `reactivationComment`.
`WarehouseTransformer` loses one member with this slice — `archivedWithWarehouse`, whose column is
dropped — and the containing warehouse's own `status`, already embedded, takes over stating the
provenance.

The `200` from the new endpoint serializes through `WarehouseDoorTransformer`, which #215 extended
with the archive members and this slice extends with `reactivatedAt`, `reactivatedByUserId`, and
`reactivationComment`. The web client still discards the body and refetches the warehouse collection
(research R12), so the addition serves no *web* reader — it serves the endpoint's own contract: the
`200` is where an administrator, or any other API client, observes what the write recorded, and a
body stating `status: 'AVAILABLE'` and nothing else would omit exactly that. The archive members
stay beside them rather than being nulled, so one body carries the whole lifecycle of a door that
came back.

## Derived view state (apps/web)

| Derivation | Input | Output |
|---|---|---|
| `warehouseDoorLifecycleActions(door, warehouseStatus)` | door status, warehouse status | `['reactivate']` or `[]` (research R9) |
| Row lifecycle line | `door.status`, `archivedAt`, `reactivatedAt` | archive line on archived rows, reactivation line on available rows (research R10) |
| Tab counts | `countWarehouseDoors(warehouse)` *(exists)* | recomputed from the refetched collection; no local mutation |

No new persisted client state, no new URL search parameter, and no new map mode: a confirmation
dialog is neither.
