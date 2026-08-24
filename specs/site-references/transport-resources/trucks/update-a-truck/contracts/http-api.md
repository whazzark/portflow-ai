# HTTP Contract: Update a Truck

Under the existing `/api/v1` authenticated route group, using the session cookie guard. The named
Tuyau route is `trucks.update`, added alongside the existing `trucks.index`, `trucks.available`
(`../../list-trucks/contracts/http-api.md`), and `trucks.store`
(`../../create-a-truck/contracts/http-api.md`). The response reuses the Truck representation
documented there unchanged.

## PATCH `/api/v1/trucks/:id`

Updates the mutable information and provider assignment of one available truck.

- Only active `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN` users may call this endpoint.
- `:id` is the truck's UUID.

### Request body

```json
{
  "registration": "AB-456-EF",
  "vehicleModel": "Volvo FH16",
  "capacityTonnes": 38.5,
  "transportCompanyId": "7f6c138c-8b9f-4e1b-b1a0-fc520cfb7351"
}
```

| Field | Type | Required | Rules |
|---|---|---:|---|
| `registration` | string | Yes | Trimmed; non-blank; max 255 characters |
| `vehicleModel` | string \| null | Yes (may be `null`) | Trimmed when present; non-blank if not null; max 255 characters; send `null` to clear it. Unlike `trucks.store`, the key may not be omitted — an omission is a `422`, so clearing is always explicit. A whitespace-only value is indistinguishable from `null` over HTTP: the JSON body parser trims and converts empty strings to `null` before validation runs, so both requests clear the model rather than being refused |
| `capacityTonnes` | number | Yes | Positive; at most 3 fractional digits; within `NUMERIC(12, 3)` |
| `transportCompanyId` | string (UUID) | Yes | Resubmit the truck's current company to keep it. When it differs from the stored value, the truck must not be committed to a planned or active discharge, and the company must exist and be currently `AVAILABLE` |

There is no partial form: all four keys are required on every request. Resubmitting the truck's
current values is a valid request that succeeds and refreshes `updatedAt`.

### Success: `200 OK`

```json
{
  "data": {
    "id": "1a2664cb-d2c8-4cd4-b214-0cc5f9b25bd3",
    "registration": "AB-456-EF",
    "vehicleModel": "Volvo FH16",
    "capacityTonnes": 38.5,
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
    "updatedAt": "2026-08-24T14:12:33.000Z"
  }
}
```

`id`, `status`, `createdAt`, and every archive and reactivation field are echoed unchanged; only the
four submitted fields and `updatedAt` may differ from the previous representation. A truck that had
been archived and reactivated keeps its retained `archivedAt`, `archiveComment`, and reactivation
context across the update.

The updated truck is immediately reflected in both `trucks.index` (administrators) and
`trucks.available` (every active role).

## Authorization and failures

| Situation | Status | Response behavior |
|---|---:|---|
| Missing or expired session | `401` | `E_UNAUTHORIZED_ACCESS`; no truck modified |
| User access is no longer active | `401` | Session rejected by authentication middleware; no truck modified |
| Active role other than `ORGANIZATION_ADMIN` / `OPERATIONS_ADMIN` (e.g. `OPERATIONS_LEAD`, `OBSERVER`) | `403` | `E_AUTHORIZATION_FAILURE`; no truck modified; response discloses no truck data |
| Missing `registration`, `vehicleModel`, `capacityTonnes`, or `transportCompanyId`; blank `registration`; any field exceeding its max length or precision; `capacityTonnes` zero, negative, or not a number; `transportCompanyId` not a UUID | `422` | VineJS validation error envelope; no truck modified |
| A normalized `registration` still invalid at the domain boundary | `422` | `E_SITE_REFERENCE_NAME_INVALID`; no truck modified |
| `:id` does not reference an existing truck | `404` | `E_TRUCK_NOT_FOUND`; no other truck data disclosed |
| The truck is `ARCHIVED` | `409` | `E_TRUCK_ARCHIVED`; message states reactivation is required first; no truck modified |
| `transportCompanyId` differs from the stored value while the truck has an unreleased assignment on a `PLANNED` or `ACTIVE` discharge | `409` | `E_TRUCK_TRANSPORT_COMPANY_LOCKED`; no truck modified, including the other three fields |
| `transportCompanyId` differs from the stored value and does not reference an existing `AVAILABLE` company | `422` | `E_TRUCK_TRANSPORT_COMPANY_INVALID`; no truck modified |
| `registration` duplicates another available or archived truck (case-insensitive, whitespace-trimmed), including two near-simultaneous submissions | `409` | `E_TRUCK_REGISTRATION_CONFLICT`; no truck modified |
| The truck is archived or removed between validation and the write | `409` / `404` | The conditional write matches no row and the outcome is re-derived; no truck modified |
| Unexpected persistence/service failure | `5xx` | Standard API error envelope; no partial write; safe to retry |

When several conditions fail at once the response reports the first one in the order documented in
[data-model.md](../data-model.md#decision-order-in-the-use-case). A refusal is always total: the
endpoint never applies some submitted fields and rejects others.

There is no idempotency key and none is needed: the request carries the complete target state, so a
retry after a transient failure converges on the same row. A retried request whose registration
already landed succeeds again as a no-op rather than conflicting with itself, because the unique
index does not compare a row against itself.

## Records this endpoint must not touch

- `discharge_truck_assignments` rows, including their `registration_snapshot` and
  `transport_company_name_snapshot` values, which continue to show what was captured at reservation
  time.
- `transport_companies` rows, in either direction of a reassignment.
- Any rotation, weighing, or report snapshot: lowering `capacityTonnes` does not re-evaluate past
  capacity exceedances or breaches.

## Operational scope

This contract updates a truck only. It does not create, archive, reactivate, permanently delete,
import, or bulk-update trucks; those remain owned by issues `#225` and `#226` or stay out of scope.
It does not assign a truck to a discharge or release an assignment.
