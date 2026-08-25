# API Contract: Reactivate a Warehouse

**Feature**: `GH-211` | **Spec**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

Two endpoints, transposed from the delivered archival pair in the same slice. Both live under the
authenticated `/api/v1` group and are typed end-to-end through Tuyau, so the web client's
`tuyauQuery.warehouses.reactivate` / `.reactivateMany` handles appear once the routes are named.

---

## Route registration

```ts
// apps/api/start/routes.ts, inside the existing /warehouses group
router.post('/reactivate', [controllers.Warehouses, 'reactivateMany']).as('reactivate_many')
router.post('/:id/reactivate', [controllers.Warehouses, 'reactivate']).as('reactivate')
```

**Declaration order matters.** `/reactivate` must be declared before `/:id/reactivate`, or
`/warehouses/reactivate` resolves with `:id = 'reactivate'`. The archival routes already carry this
constraint and a comment recording it; the dock and weighing-area groups order their reactivate
routes the same way.

---

## `POST /api/v1/warehouses/:id/reactivate`

Reactivate one archived warehouse and restore the doors archived with it.

### Request

```jsonc
{
  "comment": "Zone C reopened after works"   // optional, nullable, max 1000 chars, trimmed
}
```

An absent body, `{}`, `{"comment": null}`, and `{"comment": "   "}` are all equivalent to "no
comment" (FR-011).

### Response `200`

```jsonc
{
  "warehouse": {
    "id": "…", "name": "Warehouse C", "status": "AVAILABLE",
    "archivedAt": "2026-08-01T09:00:00.000Z",        // preserved (FR-015)
    "archivedByUserId": "…", "archiveComment": "Works",
    "reactivatedAt": "2026-08-25T14:12:00.000Z",     // written
    "reactivatedByUserId": "…", "reactivationComment": "Zone C reopened after works",
    "createdAt": "…", "updatedAt": "2026-08-25T14:12:00.000Z",
    "footprint": { "points": [ { "latitude": 0, "longitude": 0 }, … ] },
    "doors": [
      {
        "id": "…", "name": "C1", "status": "AVAILABLE",
        "latitude": 0, "longitude": 0,
        "archivedAt": "2026-08-01T09:00:00.000Z",     // preserved
        "archivedByUserId": "…", "archiveComment": "Works",
        "archivedWithWarehouse": false,               // cleared on restore (FR-009)
        "reactivatedAt": "2026-08-25T14:12:00.000Z",
        "reactivatedByUserId": "…", "reactivationComment": "Zone C reopened after works"
      }
    ]
  },
  "reactivatedDoorCount": 1
}
```

`reactivatedDoorCount` reports what the restore **actually** did at submission time, which need not
equal the advisory count the confirmation showed (research **D5**). This mirrors the
`archivedDoorCount` the archive endpoint already returns, and is the reason both warehouse lifecycle
endpoints wrap the resource in an envelope while the sibling site references return the bare
resource.

Every warehouse in the response carries its full `doors` array, restored and untouched doors alike,
so one client-side invalidation refreshes the whole subtree.

### Errors

| Status | Code | Condition | Spec |
|---|---|---|---|
| `401` | — | Unauthenticated | FR-002 |
| `403` | — | Active user without warehouse administration rights; non-active user | FR-002 |
| `404` | `E_WAREHOUSE_NOT_FOUND` | Identifier resolves to no warehouse | FR-005 |
| `409` | `E_WAREHOUSE_ALREADY_AVAILABLE` | Warehouse is already available | FR-004 |
| `422` | — | Comment exceeds 1,000 characters | FR-012 |

`E_WAREHOUSE_ALREADY_AVAILABLE` is a **new** exception on
`apps/api/app/warehouses/shared/warehouse_exceptions.ts`, beside the delivered
`E_WAREHOUSE_ALREADY_ARCHIVED`. Every other code already exists.

`E_WAREHOUSE_IN_USE` is **not reachable** on this path (research **D3**).

---

## `POST /api/v1/warehouses/reactivate`

Reactivate a selection of archived warehouses in one action, with partial success.

### Request

```jsonc
{
  "ids": ["uuid-a", "uuid-b", "uuid-c"],   // required, ≥1, duplicate-free, uuid-formatted
  "comment": "Zone C reopened"             // optional, applies to the whole submission
}
```

`ids` is validated by the shared `lifecycleIds()` rule: `minLength(1)`, each entry a UUID
lower-cased on the way in, and a `distinctUuids` rule that rejects the **whole request** when the
same identifier appears twice — case-insensitively. This is deliberately distinct from a well-formed
identifier that resolves to nothing, which is reported per warehouse as `NOT_FOUND` (FR-035).

### Response `200`

```jsonc
{
  "updatedWarehouses": [ /* full warehouse objects, in submission order */ ],
  "blockedWarehouses": [
    { "id": "uuid-b", "name": "Warehouse B", "reason": "ALREADY_AVAILABLE" },
    { "id": "uuid-c", "reason": "NOT_FOUND" }
  ]
}
```

- `updatedWarehouses` preserves the order of `ids` (via `orderByIds`), so the client never has to
  re-sort to match what the administrator selected.
- A blocked entry carries `name` only when the warehouse was found — `NOT_FOUND` has no name to
  report, and the client falls back to the raw id.
- Exactly one `reason` per blocked warehouse (FR-031). Only `NOT_FOUND` and `ALREADY_AVAILABLE`
  occur on this endpoint.
- Both arrays empty is impossible: a valid submission has at least one id, and every id lands in
  exactly one array.

### Errors

| Status | Code | Condition | Spec |
|---|---|---|---|
| `401` | — | Unauthenticated | FR-002 |
| `403` | — | Not an administrator | FR-028 |
| `422` | — | `ids` empty, duplicated, or containing a malformed identifier; comment too long | FR-035, FR-012 |

A `422` means **nothing changed** — the validator runs before the use case (FR-035, FR-022).

---

## Authorization

Both endpoints call `bouncer.with(WarehousePolicy).authorize('reactivate')`.

```ts
// apps/api/app/warehouses/shared/warehouse_policy.ts
reactivate(user: User): AuthorizerResponse {
  return user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'
}
```

| Actor | Single | Bulk |
|---|---|---|
| Unauthenticated | `401` | `401` |
| Non-active user | `403` | `403` |
| `ORGANIZATION_ADMIN` | ✅ | ✅ |
| `OPERATIONS_ADMIN` | ✅ | ✅ |
| Every other active role | `403` | `403` |

Identical to the `archive` ability by construction (research **D7**), and enforced server-side
regardless of what the interface offers or hides (FR-024).

---

## Repository contract

```ts
// apps/api/app/warehouses/shared/repositories/warehouse_repository.ts

export type ReactivateWarehouseCommand = {
  id: string
  reactivatedAt: DateTime
  reactivatedByUserId: string
  reactivationComment: string | null
}

export type ReactivateWarehousesCommand = {
  ids: string[]
  reactivatedAt: DateTime
  reactivatedByUserId: string
  reactivationComment: string | null
}

export type ReactivateWarehouseResult =
  | { kind: 'REACTIVATED'; warehouse: Warehouse; reactivatedDoorCount: number }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ALREADY_AVAILABLE' }

abstract reactivateArchived(command: ReactivateWarehouseCommand): Promise<ReactivateWarehouseResult>
abstract reactivateArchivedMany(command: ReactivateWarehousesCommand): Promise<BulkWarehouseLifecycleResult>
```

`BulkWarehouseLifecycleResult` is reused unchanged — it is already direction-agnostic
(`{ updatedWarehouses, blockedWarehouses }`).

`ReactivateWarehouseResult` has **no `IN_USE` arm**, unlike `ArchiveWarehouseResult`. The archival
type carries one because its conditional write can lose a race the use case's pre-check passed; the
restore has no usage condition to lose a race on.

---

## Use case contract

```ts
// reactivate/reactivate_warehouse_use_case.ts
handle(input: { id, reactivatedByUserId, reactivatedAt, comment? })
  → { warehouse, reactivatedDoorCount }
  ↳ throws WarehouseNotFoundException | WarehouseAlreadyAvailableException

// reactivate/reactivate_warehouses_use_case.ts
handle(input: { ids, reactivatedByUserId, reactivatedAt, comment? })
  → BulkWarehouseLifecycleResult      // no throw; partial success is the contract
```

Comment normalization (`input.comment?.trim() || null`) happens in the use case, not the
repository — matching `ArchiveWarehouseUseCase` exactly, so the trim rule has one home per
direction and both directions agree.

The bulk use case is a pass-through with normalization, exactly as `ArchiveWarehousesUseCase` is. It
throws nothing: every per-warehouse refusal is data in the response, not an exception.
