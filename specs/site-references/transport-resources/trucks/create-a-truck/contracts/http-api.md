# HTTP Contract: Create a Truck

Under the existing `/api/v1` authenticated route group, using the session cookie guard. The named
Tuyau route is `trucks.store`, added alongside the existing `trucks.index` and `trucks.available`
(`specs/site-references/transport-resources/trucks/list-trucks/contracts/http-api.md`). The
response reuses the Truck representation documented there unchanged.

## POST `/api/v1/trucks`

Creates one new available truck.

- Only active `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN` users may call this endpoint.

### Request body

```json
{
  "registration": "AB-123-CD",
  "vehicleModel": "Volvo FMX",
  "capacityTonnes": 32.5,
  "transportCompanyId": "7f6c138c-8b9f-4e1b-b1a0-fc520cfb7351"
}
```

| Field | Type | Required | Rules |
|---|---|---:|---|
| `registration` | string | Yes | Trimmed; non-blank; max 255 characters |
| `vehicleModel` | string \| null | No | Trimmed when present; non-blank if not null; max 255 characters; omit or send `null` for no vehicle model |
| `capacityTonnes` | number | Yes | Positive; at most 3 fractional digits |
| `transportCompanyId` | string (UUID) | Yes | Must reference an existing transport company currently `AVAILABLE` |

### Success: `201 Created`

```json
{
  "data": {
    "id": "1a2664cb-d2c8-4cd4-b214-0cc5f9b25bd3",
    "registration": "AB-123-CD",
    "vehicleModel": "Volvo FMX",
    "capacityTonnes": 32.5,
    "transportCompanyId": "7f6c138c-8b9f-4e1b-b1a0-fc520cfb7351",
    "status": "AVAILABLE",
    "archivedAt": null,
    "archivedByUserId": null,
    "archivedBy": null,
    "archiveComment": null,
    "reactivatedAt": null,
    "reactivatedByUserId": null,
    "reactivatedBy": null,
    "reactivationComment": null,
    "createdAt": "2026-08-22T09:00:00.000Z",
    "updatedAt": "2026-08-22T09:00:00.000Z"
  }
}
```

The created truck is immediately included in both `trucks.index` (administrators) and
`trucks.available` (every active role) responses.

## Authorization and failures

| Situation | Status | Response behavior |
|---|---:|---|
| Missing or expired session | `401` | `E_UNAUTHORIZED_ACCESS`; no truck created |
| User access is no longer active | `401` | Session rejected by authentication middleware; no truck created |
| Active role other than `ORGANIZATION_ADMIN` / `OPERATIONS_ADMIN` (e.g. `OPERATIONS_LEAD`, `OBSERVER`) | `403` | Creation denied; no truck created; response discloses no existing registration |
| Missing or blank `registration`, `capacityTonnes`, or `transportCompanyId`; blank `vehicleModel`; any field exceeding its max length or precision | `422` | VineJS validation error envelope; no truck created |
| `capacityTonnes` is zero, negative, or not a valid number | `422` | VineJS validation error envelope; no truck created |
| `transportCompanyId` does not reference an existing transport company, or references one that is `ARCHIVED` | `422` | `E_TRUCK_TRANSPORT_COMPANY_INVALID`; no truck created |
| `registration` duplicates an existing available or archived truck (case-insensitive, whitespace-trimmed), including two near-simultaneous submissions of the same value | `409` | `E_TRUCK_REGISTRATION_CONFLICT`; no truck created |
| Unexpected persistence/service failure | `5xx` | Standard API error envelope; no partial truck created; safe to retry |

There is no idempotency key: a retried request with the same registration after a transient
failure succeeds once and only once, because every duplicate attempt lands on the same
`trucks_registration_unique` conflict.

## Operational scope

This contract creates a truck only. It does not update, archive, reactivate, permanently delete,
import, or bulk-create trucks; those remain owned by issues `#224`–`#226`. It does not provide a
`GET /api/v1/trucks/:id` route — the created truck is read back through `trucks.index` or
`trucks.available`, matching the read contract established by List Trucks (`#222`).
