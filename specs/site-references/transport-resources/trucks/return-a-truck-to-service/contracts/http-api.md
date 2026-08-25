# HTTP Contract: Return a Truck to Service

**Feature**: `GH-253` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

All routes sit behind the existing authenticated `/api/v1` group. The web client consumes them
through Tuyau's generated types; the generated definitions are refreshed by the existing generator,
never hand-edited (ADR 0005).

## New endpoint

### `POST /api/v1/trucks/:id/return-to-service`

Route name `trucks.return_to_service`. Registered beside `trucks.suspend` in the trucks group.

There is deliberately **no** `POST /api/v1/trucks/return-to-service` bulk counterpart (spec FR-025,
research [D6](../research.md)).

**Authorization**: `TruckPolicy#returnToService` — active `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN`.

**Request body** — validated by `returnTruckToServiceValidator`, reusing the shared
`lifecycleComment()` rule that archive, reactivate, and suspend already use:

```jsonc
{ "comment": "Gearbox replaced, roadworthy" }   // optional; null, absent, or blank ⇒ no comment
```

**`200 OK`** — the returned truck, serialized by `TruckTransformer`. Note that the suspension context
is still present: that is FR-013, not a leftover.

```jsonc
{
  "data": {
    "id": "…", "registration": "DD-404-PF", "vehicleModel": "MAN TGS",
    "capacityTonnes": 31.5, "transportCompanyId": "…",
    "status": "AVAILABLE",
    "returnedToServiceAt": "2026-08-25T09:14:00.000Z",
    "returnedToServiceByUserId": "…",
    "returnToServiceComment": "Gearbox replaced, roadworthy",
    "returnedToServiceBy": { "id": "…", "firstName": "…", "lastName": "…" },
    "suspendedAt": "2026-08-20T07:02:00.000Z",
    "suspendedByUserId": "…",
    "suspensionComment": "Gearbox failure, awaiting workshop slot",
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
| `409` | `E_TRUCK_ALREADY_AVAILABLE` | truck is already available | FR-005 |
| `409` | `E_TRUCK_ARCHIVED_CANNOT_RETURN` | **new code** — truck is archived; reactivate it instead | FR-006 |
| `409` | `E_TRUCK_TRANSPORT_COMPANY_ARCHIVED` | truck's transport company is archived; reactivate the company first | FR-007 |
| `422` | `E_VALIDATION_ERROR` | comment longer than 1,000 characters | FR-011 |

A truck still holding a discharge assignment, a shift assignment, or an in-progress rotation produces
**no failure** — the return restores eligibility and leaves those rows untouched (FR-017, FR-018).

## Changed response on an existing endpoint

### `POST /api/v1/trucks/:id/reactivate`

No status, code, or shape change. **One message changes**, on `E_TRUCK_TRANSPORT_COMPANY_ARCHIVED`:

| | Message |
|---|---|
| before | `Truck transport company is archived; reactivate the company or reassign the truck before returning it to service` |
| after | names reactivating the transport company as the only unblocking action |

The delivered wording offers a reassignment that is impossible for an archived truck and for a
suspended one alike — `updateAvailable` is guarded by `WHERE status = 'AVAILABLE'` — and its
"before returning it to service" clause is incoherent when read on the return path itself. Research
[D4](../research.md) records the reasoning; the plan's Constitution Check flags it for the review
gate. One web test asserts the old string and is updated with it.

## Unchanged, and worth asserting rather than assuming

### `GET /api/v1/trucks/available`

A returned truck reappears here **by construction** — `listAvailable` filters `status = 'AVAILABLE'`
— with no code of its own (FR-014, FR-017). Assert it.

### `GET /api/v1/trucks/suspended`

A returned truck disappears from here, for every active role (FR-015). Assert it.

### `GET /api/v1/trucks`

Administrators only. Gains the three new context fields on every truck. The consultation suite asserts
an exact property list and is extended with them.

### `POST /api/v1/trucks/archive`, `POST /api/v1/trucks/reactivate`

Unchanged. `blockedTrucks[].reason` already carries `SUSPENDED` from `#252`, and this slice adds no
status value — no bulk path changes.

### `POST /api/v1/trucks/:id/archive`, `POST /api/v1/trucks/:id/suspend`, `PATCH /api/v1/trucks/:id`

Unchanged in rules. A truck that has just been returned to service is an ordinary available truck and
is accepted by all three (US3-7) — behaviour asserted here rather than assumed, because it is the
observable proof that the return leaves no residue.

## Serialization

| Variant | Consumed by | New fields |
|---|---|---|
| `toObject` | `GET /trucks` (administrators), `GET /trucks/available`, every write response | `returnedToServiceAt`, `returnedToServiceByUserId`, `returnToServiceComment`, `returnedToServiceBy` |
| `toOperationalView` | `GET /trucks/suspended` | `returnedToServiceAt`, `returnToServiceComment` — no actor, mirroring `suspendedBy` |

Research [D9](../research.md) records the consequence a reviewer should see: because
`/trucks/available` serializes with `toObject`, a returned truck discloses `suspendedBy` to every
active role, which the suspended collection deliberately withholds. That follows the delivered rule
for `archivedBy` and `reactivatedBy`, and this slice is the first path that makes it reachable.

## Web contract surface

| Item | Change |
|---|---|
| `TruckLifecycleAction` | gains `'return-to-service'` |
| `TRUCK_LIFECYCLE_COPY` | gains its entry, **and a failure-label field** — the toast interpolates the action name (`Unable to ${action} truck …`), which reads as "Unable to return-to-service truck" without one |
| `truckLifecycleActions('SUSPENDED')` | `[]` → `['return-to-service']` |
| `useTruckMutations` | gains `returnToService`, invalidating all three truck queries on success |
| Route search `truckStatus` | unchanged — already three-valued |
| Bulk types | unchanged — no bulk return |
