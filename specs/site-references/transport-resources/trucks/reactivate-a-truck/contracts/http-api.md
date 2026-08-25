# HTTP Contract: Reactivate a Truck

Under the existing `/api/v1` authenticated route group, using the session cookie guard. The named
Tuyau routes are `trucks.reactivate` and `trucks.reactivate_many`, added alongside the existing
`trucks.index`, `trucks.available`
(`specs/site-references/transport-resources/trucks/list-trucks/contracts/http-api.md`),
`trucks.store` (`../create-a-truck/contracts/http-api.md`), `trucks.update`
(`../update-a-truck/contracts/http-api.md`), and `trucks.archive` / `trucks.archive_many`
(`../archive-a-truck/contracts/http-api.md`). Both responses reuse the Truck representation
documented there, unchanged. The route shapes mirror the existing `customers.reactivate`
(`POST /api/v1/customers/:id/reactivate`) and `customers.reactivate_many`
(`POST /api/v1/customers/reactivate`) routes.

## POST `/api/v1/trucks/:id/reactivate`

Returns one archived truck to service.

- Only active `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN` users may call this endpoint.
- `:id` is the truck's UUID.

### Request body

```json
{
  "comment": "Back from the gearbox overhaul on 2026-08-24."
}
```

| Field | Type | Required | Rules |
|---|---|---:|---|
| `comment` | string \| null | No | Trimmed; max 1000 characters; omit, send `null`, or send a whitespace-only value to reactivate without a comment |

An empty body (`{}`) is valid and reactivates the truck without a comment.

`reactivatedAt` and `reactivatedByUserId` are never accepted from the client: the server records its
own time and the authenticated caller.

### Success: `200 OK`

```json
{
  "data": {
    "id": "1a2664cb-d2c8-4cd4-b214-0cc5f9b25bd3",
    "registration": "AB-123-CD",
    "vehicleModel": "Volvo FMX",
    "capacityTonnes": 32.5,
    "transportCompanyId": "7f6c138c-8b9f-4e1b-b1a0-fc520cfb7351",
    "status": "AVAILABLE",
    "archivedAt": "2026-08-10T09:00:00.000Z",
    "archivedByUserId": "3f0f6f5a-1c2e-4f9a-9a3b-2b4a5c6d7e8f",
    "archivedBy": { "id": "3f0f6f5a-…", "firstName": "…", "lastName": "…" },
    "archiveComment": "Gearbox failure.",
    "reactivatedAt": "2026-08-24T09:00:00.000Z",
    "reactivatedByUserId": "9c8b7a65-4321-4dcb-8fed-0a1b2c3d4e5f",
    "reactivatedBy": { "id": "9c8b7a65-…", "firstName": "…", "lastName": "…" },
    "reactivationComment": "Back from the gearbox overhaul on 2026-08-24.",
    "createdAt": "2026-07-22T09:00:00.000Z",
    "updatedAt": "2026-08-24T09:00:00.000Z"
  }
}
```

- `registration`, `vehicleModel`, `capacityTonnes`, and `transportCompanyId` are returned unchanged.
- The `archivedAt` / `archivedByUserId` / `archiveComment` of the archival being reversed are
  returned **unchanged** — reactivating does not erase the archive history it reverses.
- Any previously recorded reactivation context is replaced by this one.
- `reactivatedBy` is populated, matching the read contract; it is never `null` while
  `reactivatedByUserId` is set.
- The reactivated truck is immediately included in `trucks.available` and its count, and continues
  to appear in `trucks.index` with `status: "AVAILABLE"`.

## POST `/api/v1/trucks/reactivate`

Returns several selected trucks to service in one action, reporting partial success.

- Only active `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN` users may call this endpoint.
- Path note: this route has one path segment, so it never collides with `/:id/reactivate`.

### Request body

```json
{
  "ids": [
    "1a2664cb-d2c8-4cd4-b214-0cc5f9b25bd3",
    "6b1d0f92-77a1-4f0e-9b3c-0d5a1e2f3a4b"
  ],
  "comment": "Winter fleet back in service."
}
```

| Field | Type | Required | Rules |
|---|---|---:|---|
| `ids` | string[] (UUID) | Yes | At least one entry; lower-cased; no duplicates |
| `comment` | string \| null | No | Trimmed; max 1000 characters; applied identically to every truck reactivated by this request |

### Success: `200 OK`

Returned whenever the request itself is valid and authorized — including when every submitted truck
turns out to be ineligible, in which case `updatedTrucks` is empty and every truck is reported in
`blockedTrucks`.

```json
{
  "data": {
    "updatedTrucks": [
      { "id": "1a2664cb-…", "registration": "AB-123-CD", "status": "AVAILABLE", "reactivatedAt": "2026-08-24T09:00:00.000Z", "…": "…" }
    ],
    "blockedTrucks": [
      { "id": "6b1d0f92-…", "registration": "EF-456-GH", "reason": "TRANSPORT_COMPANY_ARCHIVED" }
    ]
  }
}
```

- `updatedTrucks` contains the full Truck representation for each reactivated truck, in the order
  the ids were submitted.
- Every truck in `updatedTrucks` carries an **identical** `reactivatedAt`, `reactivatedByUserId`,
  and `reactivationComment`.
- `blockedTrucks[].reason` is one of `NOT_FOUND`, `ALREADY_AVAILABLE`, or
  `TRANSPORT_COMPANY_ARCHIVED`.
- `blockedTrucks[].registration` is omitted for a `NOT_FOUND` entry, because no record exists to
  read it from; clients fall back to the submitted `id`.
- Blocked trucks are left completely unchanged — no lifecycle state, timestamp, actor, or comment is
  written for them, and their archive context is untouched.
- The blocker type is shared with `trucks.archive_many`, so its generated TypeScript union also
  lists `IN_USE` and `ALREADY_ARCHIVED`. This endpoint never returns those two, exactly as
  `customers.reactivate_many` never returns its archive-only reasons.

### Bulk-specific failures

| Situation | Status | Response behavior |
|---|---:|---|
| `ids` missing, empty, containing a non-UUID, or containing the same id twice | `422` | VineJS validation error envelope; nothing reactivated |
| `comment` exceeds 1000 characters | `422` | VineJS validation error envelope; nothing reactivated |
| Every submitted truck is ineligible | `200` | `updatedTrucks` empty; each truck reported in `blockedTrucks` with its own reason |
| Failure while committing the eligible subset | `5xx` | The transaction rolls back; **no** truck in the submission is reactivated; safe to retry the same selection |

An ineligible truck never turns the whole request into an error: authorization and payload validity
are all-or-nothing, per-truck eligibility is not.

## Authorization and failures

| Situation | Status | Response behavior |
|---|---:|---|
| Missing or expired session | `401` | `E_UNAUTHORIZED_ACCESS`; no lifecycle change; no truck data disclosed |
| User access is no longer active | `401` | Session rejected by authentication middleware; no lifecycle change |
| Active role other than `ORGANIZATION_ADMIN` / `OPERATIONS_ADMIN` (e.g. `OPERATIONS_LEAD`, `OBSERVER`) | `403` | Reactivation denied; no lifecycle change; response discloses no truck data |
| `:id` does not reference an existing truck | `404` | `E_TRUCK_NOT_FOUND`; no other truck modified |
| `comment` exceeds 1000 characters, or is not a string or `null` | `422` | VineJS validation error envelope; no lifecycle change |
| Truck is already `AVAILABLE`, including a request that races a concurrent reactivation | `409` | `E_TRUCK_ALREADY_AVAILABLE`; existing lifecycle context left unchanged |
| Truck's current transport company is `ARCHIVED` | `409` | `E_TRUCK_TRANSPORT_COMPANY_ARCHIVED`; truck stays `ARCHIVED`; the message states that the company must be reactivated, or the truck reassigned to an available company, first |
| Unexpected persistence/service failure | `5xx` | Standard API error envelope; no partial reactivation recorded; safe to retry |

The already-available (`E_TRUCK_ALREADY_AVAILABLE`) and archived-provider
(`E_TRUCK_TRANSPORT_COMPANY_ARCHIVED`) conflicts share the `409` status but carry distinct codes, so
a client can present distinct, actionable guidance without parsing message text. The provider
conflict is `409` rather than the `422` that creation and update return for an unavailable company
(`E_TRUCK_TRANSPORT_COMPANY_INVALID`), because here the blocking company is stored state reached
through the addressed truck, not a field the caller submitted.

The table above applies to both endpoints. On the bulk endpoint, `401`, `403`, and payload-`422`
outcomes reject the entire request without reactivating anything; the `404` and `409` rows describe
conditions that appear as per-truck `blockedTrucks` entries rather than as request-level errors.

## Concurrency and retry semantics

There is no idempotency key. Every reactivation runs inside one transaction that locks the truck row
and its transport-company row `FOR UPDATE` and performs a status-guarded update
(`WHERE id … AND status = 'ARCHIVED'`), so:

- Two near-simultaneous reactivation requests for the same truck produce exactly one `200` and one
  `409 E_TRUCK_ALREADY_AVAILABLE`. Exactly one reactivation time, actor, and comment is recorded,
  and the losing request never overwrites the winner's context.
- A request retried after a transient failure reactivates the truck exactly once; a retry that
  arrives after the original in fact succeeded returns `409 E_TRUCK_ALREADY_AVAILABLE` rather than
  recording a second reactivation.
- Every `4xx` refusal performs no write, so the truck row — including its archive context — is
  unchanged.
- A reactivation racing an archival of the same transport company resolves in exactly one direction:
  whichever transaction takes the company lock first commits, and the other observes the committed
  state. Either the reactivation is refused with `E_TRUCK_TRANSPORT_COMPANY_ARCHIVED`, or the company
  archival is refused because the company now provides an available truck. No interleaving produces
  an available truck under an archived company.
- Two overlapping bulk submissions reactivate each shared truck exactly once; the losing submission
  reports it under `blockedTrucks` as `ALREADY_AVAILABLE` and never overwrites the winner's context.
- A bulk submission that fails while committing reactivates nothing at all, so retrying the
  identical selection is safe and cannot produce a half-reactivated batch.

## Eligibility timing

The transport company's lifecycle state is assessed when the request is handled, not when the truck
was fetched for display or added to a selection. A truck whose company was archived after the
administrator opened or selected it is refused with `E_TRUCK_TRANSPORT_COMPANY_ARCHIVED` (single) or
reported as `TRANSPORT_COMPANY_ARCHIVED` (bulk); a truck whose company was reactivated in the same
interval is reactivated successfully. No caching or reservation of the eligibility decision occurs
between requests, and selecting a truck in the interface reserves nothing.

Current discharge usage is **not** consulted. An archived truck cannot be reserved by a planned or
active discharge, since archival refuses exactly that, so there is no usage question on the way back.

## Operational scope

These contracts reactivate trucks only. They do not archive, update, create, permanently delete, or
import trucks, and they never modify a transport company; archival is owned by `#225`, update by
`#224`, and transport-company lifecycle by `#220` / `#221`. No `GET /api/v1/trucks/:id` route is
added — trucks are read back through `trucks.index` and `trucks.available`, matching the read
contract established by List Trucks (`#222`).
