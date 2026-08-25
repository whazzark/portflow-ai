# HTTP Contract: Suspend a Truck From Service

**Feature**: `GH-252` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

All routes sit behind the existing authenticated `/api/v1` group. The web client consumes them
through Tuyau's generated types; the generated definitions are refreshed by the existing generator,
never hand-edited (ADR 0005).

## New endpoint

### `POST /api/v1/trucks/:id/suspend`

Route name `trucks.suspend`. Registered beside `trucks.archive` and `trucks.reactivate`.

There is deliberately **no** `POST /api/v1/trucks/suspend` bulk counterpart (spec FR-026).

**Authorization**: `TruckPolicy#suspend` — active `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN`.

**Request body** — validated by `suspendTruckValidator`, reusing the shared `lifecycleComment()`
rule that archive and reactivate already use:

```jsonc
{ "comment": "Gearbox failure, in the workshop" }   // optional; null, absent, or blank ⇒ no comment
```

**`200 OK`** — the suspended truck, serialized by `TruckTransformer`:

```jsonc
{
  "data": {
    "id": "…", "registration": "AA-101-PF", "vehicleModel": "Volvo FMX",
    "capacityTonnes": 32.5, "transportCompanyId": "…",
    "status": "SUSPENDED",
    "suspendedAt": "2026-08-25T09:14:00.000Z",
    "suspendedByUserId": "…",
    "suspensionComment": "Gearbox failure, in the workshop",
    "suspendedBy": { "id": "…", "firstName": "…", "lastName": "…" },
    "archivedAt": null, "archivedByUserId": null, "archiveComment": null, "archivedBy": null,
    "reactivatedAt": null, "reactivatedByUserId": null, "reactivationComment": null, "reactivatedBy": null,
    "createdAt": "…", "updatedAt": "2026-08-25T09:14:00.000Z"
  }
}
```

**Failures**

| Status | Code | Condition | Spec |
|---|---|---|---|
| `401` | — | unauthenticated or access not active | FR-003 |
| `403` | — | any active role other than the two administrators | FR-003 |
| `404` | `E_TRUCK_NOT_FOUND` | unknown truck | FR-004 |
| `409` | `E_TRUCK_ALREADY_SUSPENDED` | truck is already suspended | FR-005 |
| `409` | `E_TRUCK_ARCHIVED_CANNOT_SUSPEND` | truck is archived; reactivate it first | FR-006 |
| `422` | `E_VALIDATION_ERROR` | comment longer than 1,000 characters | FR-010 |

A truck reserved by a planned or active discharge produces **no failure** — it suspends normally
(FR-017). This is the one place the suspend contract deliberately diverges from archive.

## Changed responses on existing endpoints

Introducing a third state changes what four delivered endpoints can return. These are corrections,
not new features (research D3).

### `POST /api/v1/trucks/:id/archive`

| Status | Code | Condition |
|---|---|---|
| `409` | `E_TRUCK_SUSPENDED` | **new** — the truck is suspended; return it to service before archiving |

Without this the request currently **succeeds**, archiving a suspended truck.

### `POST /api/v1/trucks/:id/reactivate`

| Status | Code | Condition |
|---|---|---|
| `409` | `E_TRUCK_SUSPENDED` | **new** — the truck is suspended, not archived |

Without this the request currently **succeeds**, silently making a suspended truck available.

### `POST /api/v1/trucks/archive` and `POST /api/v1/trucks/reactivate`

`blockedTrucks[].reason` gains `"SUSPENDED"`. A suspended truck in either selection is now reported
per-truck with its own reason instead of being misreported as `ALREADY_ARCHIVED` /
`ALREADY_AVAILABLE` — and instead of tripping the transaction's row-count assertion and returning
`500`.

### `PATCH /api/v1/trucks/:id`

| Status | Code | Condition |
|---|---|---|
| `409` | `E_TRUCK_SUSPENDED` | **new** — replaces the misleading `E_TRUCK_ARCHIVED` for a suspended truck |

### `GET /api/v1/trucks` and `GET /api/v1/trucks/available`

No shape change beyond the three new context fields and `"SUSPENDED"` joining the `status` union.
Behaviour worth asserting rather than assuming:

- `/trucks/available` **excludes** suspended trucks — by construction, since it filters
  `status = 'AVAILABLE'` (FR-013, FR-020).
- `/trucks` includes them, for administrators only, exactly as it does archived trucks (FR-015).

## Web contract surface

| Item | Change |
|---|---|
| `TruckLifecycle` | `'available' \| 'suspended' \| 'archived'` |
| Route search `truckStatus` | `z.enum(['available', 'suspended', 'archived']).catch('available')` |
| `useTruckMutations` | gains `suspend`, invalidating both truck queries on success |
| `BulkTruckLifecycleBlocker` | inherits the new `SUSPENDED` reason from the API types |
