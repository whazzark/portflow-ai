# Contract: `GET /api/v1/users`

**Feature**: [spec.md](../spec.md) · **Route name**: `users.index` · **Controller**:
`UsersController.index`

The only seam this feature adds. It is the complete read: the workbench renders its filters, its
counts, and its access record from this one response (FR-006a). No `GET /users/:id` exists.

## Request

```http
GET /api/v1/users
Cookie: <session>
```

No query parameter. Filtering, searching, sorting, and record selection happen in the client over
the returned collection; the server-side scope is decided from the viewer, never from input.

## Authorization

Applied by `UserPolicy.list` (may consult) then `ListUsersUseCase` (what is consultable).

| Viewer | Outcome |
|---|---|
| Unauthenticated | `401` — `E_UNAUTHORIZED_ACCESS` |
| `accessStatus` ≠ `ACTIVE` | `401` — no session exists (GH-3) |
| `OPERATIONS_LEAD`, `OBSERVER` | `403` — `E_AUTHORIZATION_FAILURE` |
| `OPERATIONS_ADMIN` | `200` — active users, identity block only |
| `ORGANIZATION_ADMIN` | `200` — every user, identity + lifecycle block |

## Response `200` — organization admin

```json
{
  "data": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "firstName": "Claire",
      "lastName": "Martin",
      "email": "claire.martin@portflow.test",
      "role": "ORGANIZATION_ADMIN",
      "accessStatus": "ACTIVE",
      "invitedAt": "2026-01-12T09:00:00.000+01:00",
      "invitedBy": { "id": "…", "firstName": "Yann", "lastName": "Le Goff" },
      "activatedAt": "2026-01-12T14:31:00.000+01:00",
      "activatedBy": null,
      "cancelledAt": null,
      "cancelledBy": null,
      "deactivatedAt": null,
      "deactivatedBy": null,
      "reactivatedAt": null,
      "reactivatedBy": null
    }
  ]
}
```

- `invitedBy`, `activatedBy`, `cancelledBy`, `deactivatedBy`, `reactivatedBy` are
  `UserTransformer.toSummary()` projections (`id`, `firstName`, `lastName`) or `null` when the event
  carries no responsible administrator.
- A `*At` of `null` means the event never happened; the workbench renders no row for it (US4.3).

## Response `200` — operations admin

```json
{
  "data": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "firstName": "Claire",
      "lastName": "Martin",
      "email": "claire.martin@portflow.test",
      "role": "ORGANIZATION_ADMIN",
      "accessStatus": "ACTIVE"
    }
  ]
}
```

Every entry has `accessStatus: "ACTIVE"`. No lifecycle field is present at all — not `null`, absent
— because a responsible administrator is a user this viewer may not consult (FR-006b).

## Never in the response

`password`, remember-me and session tokens, activation links, and any user outside the viewer's
permitted set — including as the actor of someone else's lifecycle event.

## Errors

| Status | `error.code` | When |
|---|---|---|
| `401` | `E_UNAUTHORIZED_ACCESS` | No session, or an expired one. |
| `403` | `E_AUTHORIZATION_FAILURE` | Authenticated, role may not consult users. |

Both follow the existing envelope: `{ "error": { "code": …, "message": … } }`.

## Client contract

`@portflow/api/registry` regenerates on the API's dev/build codegen, so the route surfaces as
`tuyauQuery.users.index` and the response type flows into
`apps/web/src/features/users/types.ts`. The web layer must not widen it: the two payload shapes above
are what the workbench renders, and the absence of a lifecycle block is a legitimate state, not a
loading one.
