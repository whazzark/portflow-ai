# HTTP contract: Renew a pending user's activation link

**Route name**: `users.activation_link_renewal` · **Tuyau**: `tuyauQuery.users.activationLinkRenewal`

```http
POST /api/v1/users/:id/activation-link-renewal
Cookie: <session>
```

There is no request body. `:id` is the pending user's id. The actor is the authenticated session.

## Success — `200 OK`

```json
{
  "data": {
    "user": {
      "id": "7c0f…",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane.doe@example.com",
      "role": "OPERATIONS_LEAD",
      "accessStatus": "PENDING",
      "invitedAt": "2026-09-02T08:14:00.000+00:00",
      "invitedBy": { "id": "…", "firstName": "Ada", "lastName": "Admin" },
      "activatedAt": null,
      "activatedBy": null,
      "cancelledAt": null,
      "cancelledBy": null,
      "deactivatedAt": null,
      "deactivatedBy": null,
      "reactivatedAt": null,
      "reactivatedBy": null,
      "passwordResetAt": null,
      "passwordResetBy": null,
      "passwordRenewalRequired": false,
      "activationLinkRenewedAt": "2026-09-11T09:30:00.000+00:00",
      "activationLinkRenewedBy": { "id": "…", "firstName": "Ben", "lastName": "Admin" },
      "activationLinkExpiresAt": "2026-09-18T09:30:00.000+00:00"
    },
    "activationLink": {
      "url": "https://portflow.example/activate/3q2-…",
      "expiresAt": "2026-09-18T09:30:00.000+00:00"
    }
  }
}
```

- `user` is the `toAdministration` projection with the access history, identical to a row of
  `GET /api/v1/users` for an organization admin.
- `activationLink` has the same shape as in `POST /api/v1/users`. **This response is the only place
  the secret ever appears** (FR-006, FR-007). It is not logged, and no endpoint returns it again.
- `user.activationLinkExpiresAt` equals `activationLink.expiresAt`: it is the new link's expiry,
  7 days after the renewal (FR-004).
- `invitedAt` / `invitedBy` are unchanged by the renewal (FR-008).

## Refusals

Checked in this order: authentication, authorization, validation, target.

| Status | `error.code` | When | Side effects |
|---|---|---|---|
| `401` | existing | no session | none |
| `403` | `E_PASSWORD_RENEWAL_REQUIRED` | the requester owes their own password renewal (existing middleware) | none |
| `403` | `E_AUTHORIZATION_FAILURE` | the requester is not an active organization admin | none |
| `422` | `E_VALIDATION_ERROR` | `:id` is not a UUID | none |
| `404` | `E_USER_NOT_FOUND` | no user holds `:id` | none |
| `409` | `E_USER_NOT_PENDING` | the target is `ACTIVE`, `DEACTIVATED`, or `CANCELLED` — including the requester themselves | none |
| `500` | — | transient failure | none: the transaction rolled back |

The `409` body names the status the target actually holds, so the caller can point to the action
that applies instead (FR-011):

```json
{
  "error": {
    "code": "E_USER_NOT_PENDING",
    "message": "Only a pending user's activation link can be renewed",
    "meta": { "accessStatus": "CANCELLED" }
  }
}
```

**No side effects on any refusal** (FR-014): no token is inserted or deleted, the previous link
still works exactly as before, and `activation_link_renewed_*` is unchanged.

## Related read — `GET /api/v1/users` (extended)

Every row gains three keys for a viewer allowed to consult the access history, and none for any
other viewer:

| Key | Type |
|---|---|
| `activationLinkRenewedAt` | ISO timestamp or `null` |
| `activationLinkRenewedBy` | `{ id, firstName, lastName }` or `null` |
| `activationLinkExpiresAt` | ISO timestamp for a pending user holding a link; `null` otherwise |

No row, in any projection, carries a link, a secret, or a digest.
