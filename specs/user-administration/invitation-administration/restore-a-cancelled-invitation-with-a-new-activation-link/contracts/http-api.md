# HTTP contract: Restore a cancelled invitation

**Route name**: `users.restore_invitation` · **Tuyau**: `tuyauQuery.users.restoreInvitation`

```http
POST /api/v1/users/:id/restore-invitation
Cookie: <session>
Content-Type: application/json

{ "comment": "Her start date is confirmed after all." }
```

`:id` is the cancelled user's id. The body is optional, and so is `comment` within it: an absent
body, `{}`, `{ "comment": null }`, and `{ "comment": "   " }` all restore without a comment. The
actor is the authenticated session.

## Processing order

1. Authentication (`auth` middleware) → `401`.
2. Own password renewal owed (`passwordRenewalCompleted` middleware) → `403`.
3. Authorization, `UserPolicy.restoreInvitation`: active organization admin → otherwise `403`.
   Nothing about the target is read before this point (FR-013).
4. Validation: `params.id` is a UUID; `comment` is a string of at most 1,000 characters after
   trimming, or null, or absent → otherwise `422`.
5. The link is issued in memory (not stored).
6. The guarded write (data-model, D5) → `404`, `409`, or `200`.

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
      "cancelledAt": "2026-09-05T16:40:00.000+00:00",
      "cancelledBy": { "id": "…", "firstName": "Ben", "lastName": "Admin" },
      "cancellationComment": "Start date postponed indefinitely.",
      "invitationRestoredAt": "2026-09-11T09:30:00.000+00:00",
      "invitationRestoredBy": { "id": "…", "firstName": "Ada", "lastName": "Admin" },
      "invitationRestorationComment": "Her start date is confirmed after all.",
      "deactivatedAt": null,
      "deactivatedBy": null,
      "reactivatedAt": null,
      "reactivatedBy": null,
      "passwordResetAt": null,
      "passwordResetBy": null,
      "activationLinkRenewedAt": null,
      "activationLinkRenewedBy": null,
      "activationLinkExpiresAt": "2026-09-18T09:30:00.000+00:00",
      "passwordRenewalRequired": false
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
- `activationLink` has the shape of `POST /api/v1/users` and of the renewal. **This response is the
  only place the secret ever appears** (FR-008, FR-009). It is not logged, and no endpoint returns
  it again.
- `user.activationLinkExpiresAt` equals `activationLink.expiresAt`, 7 days after the restoration
  (FR-005).
- `cancelledAt`, `cancelledBy`, `cancellationComment`, `invitedAt`, and `invitedBy` are those the
  user held while cancelled (FR-002).

## Refusals

| Status | `error.code` | When | Side effects |
|---|---|---|---|
| `401` | existing | no session | none |
| `403` | `E_PASSWORD_RENEWAL_REQUIRED` | the requester owes their own password renewal | none |
| `403` | `E_AUTHORIZATION_FAILURE` | the requester is not an active organization admin, whatever `:id` names | none |
| `422` | `E_VALIDATION_ERROR` | `:id` is not a UUID, or `comment` exceeds 1,000 characters | none |
| `404` | `E_USER_NOT_FOUND` | no user holds `:id` | none |
| `409` | `E_USER_NOT_CANCELLED` | the target is `PENDING`, `ACTIVE`, or `DEACTIVATED` — the requester themselves included | none |
| `500` | — | transient failure | none: the transaction rolled back |

The `409` names the status the target actually holds, so the caller can point to what applies
instead (FR-011):

```json
{
  "error": {
    "code": "E_USER_NOT_CANCELLED",
    "message": "Only a cancelled invitation can be restored",
    "meta": { "accessStatus": "PENDING" }
  }
}
```

**No side effects on any refusal** (FR-010): no token is inserted or deleted, a pending target's
current link works exactly as before, and every column of the target is unchanged.

## Concurrency

- Two restorations of one cancelled user: exactly one `200`; the other is `409 E_USER_NOT_CANCELLED`
  with `accessStatus: 'PENDING'` and issues nothing. One token exists afterwards (FR-020).
- A restoration and a removal (GH-14) of one cancelled user: either `200` and then the removal
  deletes the now-pending user with its new link, or the removal first and this command answers
  `404` (FR-021).
- No `200` is ever returned for a user who was not cancelled at the moment of the write (FR-021).

## Obligations on other slices

None new. Acceptance (GH-8) already consumes only the token of a `PENDING` user under a guarded
write, which is what makes the token this command inserts the only usable one. Cancellation (GH-12)
already deletes the token, and the renewal (GH-9) already guards on `PENDING`.

## Related read — `GET /api/v1/users` (extended)

Every row gains three keys for a viewer allowed to consult the access history, and none for any other
viewer:

| Key | Type |
|---|---|
| `invitationRestoredAt` | ISO timestamp or `null` |
| `invitationRestoredBy` | `{ id, firstName, lastName }` or `null` |
| `invitationRestorationComment` | string or `null` |

No row, in any projection, carries a link, a secret, or a digest.
