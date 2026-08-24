# HTTP Contract: Archive a Truck

Under the existing `/api/v1` authenticated route group, using the session cookie guard. The named
Tuyau routes are `trucks.archive` and `trucks.archive_many`, added alongside the existing
`trucks.index`, `trucks.available`
(`specs/site-references/transport-resources/trucks/list-trucks/contracts/http-api.md`), and
`trucks.store` (`../create-a-truck/contracts/http-api.md`). Both responses reuse the Truck
representation documented there, unchanged. The route shapes mirror the existing
`customers.archive` (`POST /api/v1/customers/:id/archive`) and `customers.archive_many`
(`POST /api/v1/customers/archive`) routes.

## POST `/api/v1/trucks/:id/archive`

Archives one available truck.

- Only active `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN` users may call this endpoint.
- `:id` is the truck's UUID.

### Request body

```json
{
  "comment": "Returned to the leasing company on 2026-08-24."
}
```

| Field | Type | Required | Rules |
|---|---|---:|---|
| `comment` | string \| null | No | Trimmed; max 1000 characters; omit, send `null`, or send a whitespace-only value to archive without a comment |

An empty body (`{}`) is valid and archives the truck without a comment.

`archivedAt` and `archivedByUserId` are never accepted from the client: the server records its own
time and the authenticated caller.

### Success: `200 OK`

```json
{
  "data": {
    "id": "1a2664cb-d2c8-4cd4-b214-0cc5f9b25bd3",
    "registration": "AB-123-CD",
    "vehicleModel": "Volvo FMX",
    "capacityTonnes": 32.5,
    "transportCompanyId": "7f6c138c-8b9f-4e1b-b1a0-fc520cfb7351",
    "status": "ARCHIVED",
    "archivedAt": "2026-08-24T09:00:00.000Z",
    "archivedByUserId": "3f0f6f5a-1c2e-4f9a-9a3b-2b4a5c6d7e8f",
    "archivedBy": { "id": "3f0f6f5a-1c2e-4f9a-9a3b-2b4a5c6d7e8f", "firstName": "…", "lastName": "…" },
    "archiveComment": "Returned to the leasing company on 2026-08-24.",
    "reactivatedAt": null,
    "reactivatedByUserId": null,
    "reactivatedBy": null,
    "reactivationComment": null,
    "createdAt": "2026-08-22T09:00:00.000Z",
    "updatedAt": "2026-08-24T09:00:00.000Z"
  }
}
```

- `registration`, `vehicleModel`, `capacityTonnes`, and `transportCompanyId` are returned unchanged.
- Any previously recorded `reactivatedAt` / `reactivatedByUserId` / `reactivationComment` is
  returned unchanged — archiving does not erase earlier lifecycle history.
- `archivedBy` is populated, matching the read contract; it is never `null` while `archivedByUserId`
  is set.
- The archived truck is immediately excluded from `trucks.available` and its count, and immediately
  included in `trucks.index` with `status: "ARCHIVED"`.

## POST `/api/v1/trucks/archive`

Archives several selected trucks in one action, reporting partial success.

- Only active `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN` users may call this endpoint.
- Path note: this route has one path segment, so it never collides with `/:id/archive`.

### Request body

```json
{
  "ids": [
    "1a2664cb-d2c8-4cd4-b214-0cc5f9b25bd3",
    "6b1d0f92-77a1-4f0e-9b3c-0d5a1e2f3a4b"
  ],
  "comment": "End of the 2026 lease batch."
}
```

| Field | Type | Required | Rules |
|---|---|---:|---|
| `ids` | string[] (UUID) | Yes | At least one entry; lower-cased; no duplicates |
| `comment` | string \| null | No | Trimmed; max 1000 characters; applied identically to every truck archived by this request |

### Success: `200 OK`

Returned whenever the request itself is valid and authorized — including when every submitted truck
turns out to be ineligible, in which case `updatedTrucks` is empty and every truck is reported in
`blockedTrucks`.

```json
{
  "data": {
    "updatedTrucks": [
      { "id": "1a2664cb-…", "registration": "AB-123-CD", "status": "ARCHIVED", "archivedAt": "2026-08-24T09:00:00.000Z", "…": "…" }
    ],
    "blockedTrucks": [
      { "id": "6b1d0f92-…", "registration": "EF-456-GH", "reason": "IN_USE" }
    ]
  }
}
```

- `updatedTrucks` contains the full Truck representation for each archived truck, in the order the
  ids were submitted.
- Every truck in `updatedTrucks` carries an **identical** `archivedAt`, `archivedByUserId`, and
  `archiveComment`.
- `blockedTrucks[].reason` is one of `NOT_FOUND`, `ALREADY_ARCHIVED`, or `IN_USE`.
- `blockedTrucks[].registration` is omitted for a `NOT_FOUND` entry, because no record exists to
  read it from; clients fall back to the submitted `id`.
- Blocked trucks are left completely unchanged — no lifecycle state, timestamp, actor, or comment is
  written for them.

### Bulk-specific failures

| Situation | Status | Response behavior |
|---|---:|---|
| `ids` missing, empty, containing a non-UUID, or containing the same id twice | `422` | VineJS validation error envelope; nothing archived |
| `comment` exceeds 1000 characters | `422` | VineJS validation error envelope; nothing archived |
| Every submitted truck is ineligible | `200` | `updatedTrucks` empty; each truck reported in `blockedTrucks` with its own reason |
| Failure while committing the eligible subset | `5xx` | The transaction rolls back; **no** truck in the submission is archived; safe to retry the same selection |

An ineligible truck never turns the whole request into an error: authorization and payload validity
are all-or-nothing, per-truck eligibility is not.

## Authorization and failures

| Situation | Status | Response behavior |
|---|---:|---|
| Missing or expired session | `401` | `E_UNAUTHORIZED_ACCESS`; no lifecycle change; no truck data disclosed |
| User access is no longer active | `401` | Session rejected by authentication middleware; no lifecycle change |
| Active role other than `ORGANIZATION_ADMIN` / `OPERATIONS_ADMIN` (e.g. `OPERATIONS_LEAD`, `OBSERVER`) | `403` | Archival denied; no lifecycle change; response discloses no truck data |
| `:id` does not reference an existing truck | `404` | `E_TRUCK_NOT_FOUND`; no other truck modified |
| `comment` exceeds 1000 characters, or is not a string or `null` | `422` | VineJS validation error envelope; no lifecycle change |
| Truck is already `ARCHIVED`, including a request that races a concurrent archival | `409` | `E_TRUCK_ALREADY_ARCHIVED`; existing archive time, actor, and comment left unchanged |
| Truck is reserved by a planned or active discharge through an unreleased assignment | `409` | `E_TRUCK_IN_USE` ("Truck is used by a planned or active discharge"); truck stays `AVAILABLE` |
| Unexpected persistence/service failure | `5xx` | Standard API error envelope; no partial archival recorded; safe to retry |

The already-archived (`E_TRUCK_ALREADY_ARCHIVED`) and in-use (`E_TRUCK_IN_USE`) conflicts share the
`409` status but carry distinct codes, so a client can present distinct, actionable guidance without
parsing message text.

The table above applies to both endpoints. On the bulk endpoint, `401`, `403`, and payload-`422`
outcomes reject the entire request without archiving anything; the `404` and `409` rows describe
conditions that appear as per-truck `blockedTrucks` entries rather than as request-level errors.

## Concurrency and retry semantics

There is no idempotency key. Every archival is performed as a status-guarded update
(`WHERE id … AND status = 'AVAILABLE'`), on the bulk endpoint inside one transaction whose rows are
locked `FOR UPDATE`, so:

- Two near-simultaneous archival requests for the same truck produce exactly one `200` and one
  `409 E_TRUCK_ALREADY_ARCHIVED`. Exactly one archive time, actor, and comment is recorded, and the
  losing request never overwrites the winner's context.
- A request retried after a transient failure archives the truck exactly once; a retry that arrives
  after the original in fact succeeded returns `409 E_TRUCK_ALREADY_ARCHIVED` rather than recording
  a second archival.
- Every `4xx` refusal performs no write, so the truck row is unchanged.
- Two overlapping bulk submissions archive each shared truck exactly once; the losing submission
  reports it under `blockedTrucks` as `ALREADY_ARCHIVED` and never overwrites the winner's context.
- A bulk submission that fails while committing archives nothing at all, so retrying the identical
  selection is safe and cannot produce a half-archived batch.

## Eligibility timing

Usage is assessed when the request is handled, not when the truck was fetched for display or added
to a selection. A truck that became reserved after the administrator opened or selected it is
refused with `E_TRUCK_IN_USE` (single) or reported as `IN_USE` (bulk); a truck whose blocking
discharge closed, or whose assignment was released, in the same interval is archived successfully.
No caching or reservation of the eligibility decision occurs between requests, and selecting a truck
in the interface reserves nothing.

## Operational scope

These contracts archive trucks only. They do not reactivate, update, create, permanently delete, or
import trucks; reactivation is owned by `#226` and update by `#224`. No `GET /api/v1/trucks/:id`
route is added — archived trucks are read back through `trucks.index`, matching the read contract
established by List Trucks (`#222`).
