# Contract: `POST /api/v1/users`

**Feature**: [spec.md](../spec.md) · **Route name**: `users.store` · **Controller**:
`UsersController.store`

The only write seam this feature adds. It creates the pending user and returns the confidential
activation link — the one and only time that link is readable (FR-005, FR-006).

## Request

```http
POST /api/v1/users
Content-Type: application/json
Cookie: <session>

{
  "firstName": "Claire",
  "lastName": "Martin",
  "email": "claire.martin@portflow.test",
  "role": "OPERATIONS_LEAD"
}
```

All four fields are required. Surrounding spaces are trimmed by the use case before anything is
decided (FR-016); the email is matched case-insensitively against existing users (FR-013). No
password, no access status, and no lifecycle field is accepted from the client: the created user is
always `PENDING`, and the invitation event is always attributed to the authenticated administrator.

## Authorization

Applied by `UserPolicy.invite`.

| Viewer | Outcome |
|---|---|
| Unauthenticated | `401` — `E_UNAUTHORIZED_ACCESS` |
| `accessStatus` ≠ `ACTIVE` | `401` — no session exists (GH-3) |
| `OPERATIONS_ADMIN`, `OPERATIONS_LEAD`, `OBSERVER` | `403` — `E_AUTHORIZATION_FAILURE` |
| `ORGANIZATION_ADMIN` | `201` |

An organization admin may invite any of the four roles, including another organization admin
(FR-017).

## Response `201`

```json
{
  "data": {
    "user": {
      "id": "00000000-0000-4000-8000-000000000042",
      "firstName": "Claire",
      "lastName": "Martin",
      "email": "claire.martin@portflow.test",
      "role": "OPERATIONS_LEAD",
      "accessStatus": "PENDING",
      "invitedAt": "2026-09-10T14:31:00.000+02:00",
      "invitedBy": { "id": "…", "firstName": "Yann", "lastName": "Le Goff" },
      "activatedAt": null,
      "activatedBy": null,
      "cancelledAt": null,
      "cancelledBy": null,
      "deactivatedAt": null,
      "deactivatedBy": null,
      "reactivatedAt": null,
      "reactivatedBy": null
    },
    "activationLink": {
      "url": "https://app.portflow.test/activate/8b2f…",
      "expiresAt": "2026-09-17T14:31:00.000+02:00"
    }
  }
}
```

- `user` is the `UserTransformer.toAdministration()` projection with the lifecycle block, identical
  to what `GET /api/v1/users` returns to an organization admin (D9), so the workbench renders the new
  row from this response without a second shape.
- `activationLink.url` is `<WEB_ORIGIN>/activate/<secret>` (D3). The secret is 32 random bytes,
  base64url-encoded; only its SHA-256 digest is stored (D2).
- `activationLink.expiresAt` is `invitedAt + 7 days` (FR-008).
- The response is the **only** place the secret ever appears. It is absent from
  `GET /api/v1/users`, from the access record, from application logs, and from every other seam
  (FR-006). Obtaining a new one requires the activation link renewal (GH-9).

## Errors

| Status | `error.code` | When |
|---|---|---|
| `401` | `E_UNAUTHORIZED_ACCESS` | No session, or an expired one. |
| `403` | `E_AUTHORIZATION_FAILURE` | Authenticated, role may not invite. |
| `409` | `E_USER_EMAIL_CONFLICT` | The email already belongs to a user, in any access status. |
| `422` | `E_VALIDATION_ERROR` | Missing, blank, malformed, or over-long field; unknown role. |

The conflict carries the existing user's access status, which is what tells the administrator which
action applies (FR-014):

```json
{
  "error": {
    "code": "E_USER_EMAIL_CONFLICT",
    "message": "Email is already in use",
    "meta": { "accessStatus": "CANCELLED" }
  }
}
```

| `meta.accessStatus` | What the workbench points to |
|---|---|
| `PENDING` | renew the activation link (GH-9) |
| `CANCELLED` | restore the invitation (GH-13) |
| `DEACTIVATED` | reactivate the user |
| `ACTIVE` | nothing to do — the person already holds access |

The conflict never exposes the existing user's identity beyond the email that was submitted, and
never its credentials or activation link.

Validation failures follow the existing envelope, with `error.details` carrying the field-level
messages `applyValidationError` maps onto the form.

## Guarantees

- **No partial write** (FR-018): the user row and its activation token row are written in one
  transaction; a refused or failed invitation leaves neither, and records no lifecycle event.
- **At most one pending user per email** (FR-019): two concurrent invitations of the same email
  resolve to one `201` and one `409`, decided by the `users_email_unique` index, not by timing.
- **One live link per user** (FR-004): enforced by the unique index on
  `user_activation_tokens.user_id`.
- **The created user cannot sign in**: `password` stays `NULL` and `accessStatus` is `PENDING`, which
  `LoginUserUseCase` already refuses with the same outcome as invalid credentials.

## Client contract

`@portflow/api/registry` regenerates on the API's dev/build codegen, so the route surfaces as
`tuyauQuery.users.store` and the response type flows into `apps/web/src/features/users/types.ts`
next to the existing `UserDto`. The web must not persist `activationLink` anywhere — not in the query
cache, not in storage — since a stored copy would be a second read of a once-only secret (D11).
