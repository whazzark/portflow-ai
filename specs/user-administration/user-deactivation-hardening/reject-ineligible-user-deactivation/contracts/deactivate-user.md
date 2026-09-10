# Contract: `POST /api/v1/users/:id/deactivate`

**Feature**: [spec.md](../spec.md) · **Route name**: `users.deactivate` · **Controller**:
`UsersController.deactivate`

The only seam this feature adds to the API. It is the whole write: one user, one transition, no body.

## Request

```http
POST /api/v1/users/00000000-0000-4000-8000-000000000002/deactivate
Cookie: <session>
```

No request body. The acting administrator and the timestamp are taken from the session and the
server clock; neither is accepted from the client.

`:id` is validated as a UUID before anything is read (FR-008). AdonisJS 7 has no route matchers, so
this is a VineJS validator run against the route parameters in the controller, not a route-level
constraint.

## Authorization

Applied by `UserPolicy.deactivate` (may deactivate at all), then by `DeactivateUserUseCase` (may
deactivate *this* user).

| Viewer | Outcome |
|---|---|
| Unauthenticated | `401` — `E_UNAUTHORIZED_ACCESS` |
| `accessStatus` ≠ `ACTIVE` | `401` — no session exists (GH-3), refused by `auth_middleware` |
| `OPERATIONS_ADMIN`, `OPERATIONS_LEAD`, `OBSERVER` | `403` — `E_AUTHORIZATION_FAILURE` |
| `ORGANIZATION_ADMIN` | evaluated against the target below |

A `403` discloses nothing about the target: it is returned before the user is read, so an
unauthorized caller cannot use this endpoint to probe which identifiers exist (FR-002).

## Response `200`

The deactivated user in the `toAdministration()` projection with the access history included — the
same shape `GET /api/v1/users` serves an organization admin.

```json
{
  "data": {
    "id": "00000000-0000-4000-8000-000000000002",
    "firstName": "Thomas",
    "lastName": "Bernard",
    "email": "thomas.bernard@portflow.ai",
    "role": "OPERATIONS_ADMIN",
    "accessStatus": "DEACTIVATED",
    "invitedAt": "2026-01-12T09:00:00.000+01:00",
    "invitedBy": { "id": "…", "firstName": "Claire", "lastName": "Martin" },
    "activatedAt": "2026-01-12T14:31:00.000+01:00",
    "activatedBy": null,
    "cancelledAt": null,
    "cancelledBy": null,
    "deactivatedAt": "2026-09-10T11:04:22.000+02:00",
    "deactivatedBy": { "id": "…", "firstName": "Claire", "lastName": "Martin" },
    "reactivatedAt": null,
    "reactivatedBy": null
  }
}
```

`deactivatedAt` and `deactivatedBy` are the two fields this call writes. Every other field is the
value the user already carried.

## Errors

| Status | `error.code` | When |
|---|---|---|
| `401` | `E_UNAUTHORIZED_ACCESS` | No session, an expired one, or a viewer whose access is no longer active. |
| `403` | `E_AUTHORIZATION_FAILURE` | Authenticated and active, but not an organization admin. |
| `404` | `E_USER_NOT_FOUND` | The identifier is well-formed and matches no user. |
| `409` | `E_USER_SELF_DEACTIVATION` | The target is the acting administrator's own access (FR-009). |
| `409` | `E_USER_PENDING_INVITATION` | The target has never activated their access; cancel the invitation instead. |
| `409` | `E_USER_CANCELLED_INVITATION` | The target's invitation was withdrawn before activation. |
| `409` | `E_USER_ALREADY_DEACTIVATED` | The target is already deactivated. |
| `422` | `E_VALIDATION_ERROR` | `:id` is not a UUID; no user is read (FR-008). |

Every refusal follows the existing envelope — `{ "error": { "code": …, "message": … } }`, with
`details` on the validation error — and leaves every user completely unchanged (FR-019).

## Guarantees

- **Exactly once under concurrency.** The write is `… WHERE id = :id AND access_status = 'ACTIVE'`.
  Two simultaneous deactivations of the same user affect one row and zero rows; the loser resolves
  as `409 E_USER_ALREADY_DEACTIVATED` and the recorded date and actor are the winner's (FR-018).
- **All or nothing.** The status change and the revocation of the target's remembered connections
  commit together (FR-019).
- **No credential outlives the refusal path.** A refused call deletes no token and changes no row.
- **The sign-in cut is immediate.** After `200`, the target's next authenticated request is refused
  by `auth_middleware`, and a login attempt is refused as invalid credentials with no reason
  disclosed (FR-013) — both behaviours already delivered by GH-3, exercised here rather than added.

## Client contract

`@portflow/api/registry` regenerates on the API's dev/build codegen, so the route surfaces as
`tuyauQuery.users.deactivate` and its response type flows into
`apps/web/src/features/users/types.ts`. The response is a single user in the same shape as one entry
of `users.index`; the web must not widen it.
