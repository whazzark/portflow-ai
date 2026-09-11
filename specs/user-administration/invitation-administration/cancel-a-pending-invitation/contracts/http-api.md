# HTTP Contract: Cancel a Pending Invitation

**Feature**: `GH-12` | **Route name**: `users.cancel_invitation` | **Tuyau**:
`tuyauQuery.users.cancelInvitation`

```http
POST /api/v1/users/:id/cancel-invitation
Content-Type: application/json
Cookie: <session>

{ "comment": "Hired elsewhere before starting." }
```

Registered in `apps/api/start/routes.ts` inside the authenticated `/users` group, beside
`/:id/deactivate` and `/:id/password-reset`.

## Request

| Part | Field | Rule |
|---|---|---|
| path | `id` | required, UUID (`vine.string().uuid()`, nested under `params`, as `deactivateUserValidator` records) |
| body | `comment` | optional; `string \| null`; trimmed; at most 1,000 characters (`lifecycleComment()`) |

The body may be omitted entirely. After trimming, a blank comment is stored as `null` (FR-003a).

## Processing order

1. **Authenticate**: the existing auth middleware. No session gives `401`, and a user whose own
   access is not active holds none (GH-3).
2. **Authorize**: `UserPolicy.cancelInvitation`, which requires an active organization admin.
   Any other role gives `403`, **before** the id is validated or the target read, so the refusal
   discloses nothing about the target (FR-009).
3. **Validate**: the path id and the comment. A failure gives `422`.
4. **Decide and write**: `CancelUserInvitationUseCase` normalizes the comment and calls
   `UserRepository.cancelPendingInvitation`, which is one transaction: a guarded status update, then
   the token deletion. See [data-model.md](../data-model.md#repository-contract).
5. **Respond**: the cancelled user in the `toAdministration` projection, with the access history.

## Success — `200`

```json
{
  "data": {
    "id": "0193a2b4-…",
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane.doe@example.com",
    "role": "OPERATIONS_LEAD",
    "accessStatus": "CANCELLED",
    "invitedAt": "2026-09-08T09:12:00.000+00:00",
    "invitedBy": { "id": "…", "firstName": "Alex", "lastName": "Martin" },
    "activatedAt": null,
    "activatedBy": null,
    "cancelledAt": "2026-09-11T14:03:27.000+00:00",
    "cancelledBy": { "id": "…", "firstName": "Sam", "lastName": "Leroy" },
    "cancellationComment": "Hired elsewhere before starting.",
    "deactivatedAt": null,
    "deactivatedBy": null,
    "reactivatedAt": null,
    "reactivatedBy": null,
    "passwordResetAt": null,
    "passwordResetBy": null,
    "passwordRenewalRequired": false
  }
}
```

Guarantees on a `200`:
- `accessStatus` is `CANCELLED`, and `cancelledBy` is the requester.
- `invitedAt` and `invitedBy` are unchanged, and so are identity and role.
- The user holds no `user_activation_tokens` row.
- The body carries no activation link and no credential of any kind.

## Refusals

Every refusal leaves the target, its event columns, and its activation token exactly as they were.

| Status | Code | When | Web sentence (see the workbench contract) |
|---|---|---|---|
| `401` | `E_UNAUTHORIZED_ACCESS` | no session, including a requester whose own access is not active: such a user holds no session at all (GH-3) | — (redirect to sign-in) |
| `403` | `E_AUTHORIZATION_FAILURE` | requester is an operations admin, operations lead, or observer; the body is identical whatever the target id | — (the action is never offered) |
| `422` | `E_VALIDATION_ERROR` | `id` is not a UUID, or `comment` exceeds 1,000 characters after trimming | field-level message |
| `404` | `E_USER_NOT_FOUND` | no user has that id | This user no longer exists. |
| `409` | `E_USER_ALREADY_ACTIVATED` | target is `ACTIVE` (including the requester themselves) | This user has already activated their access. Deactivate them instead. |
| `409` | `E_USER_ALREADY_DEACTIVATED` | target is `DEACTIVATED` | This user activated their access and has since been deactivated. There is no invitation left to cancel. |
| `409` | `E_USER_CANCELLED_INVITATION` | target is already `CANCELLED`, including by a concurrent request that won | This invitation has already been cancelled by someone else. |

`E_USER_ALREADY_ACTIVATED` is the only new code: `UserAlreadyActivatedException` in
`app/users/shared/user_exceptions.ts`, `409`, message
`User has already activated their access; deactivate them instead`. The other codes and their
exceptions already exist and keep their messages.

## Concurrency

- Two concurrent cancellations of one pending user: exactly one `200`; the other gets
  `409 E_USER_CANCELLED_INVITATION`. The stored event, comment included, is the winner's.
- A cancellation after another change, where the workbench listed the user as pending but the row
  has since moved on: a refusal naming the row's current status, per the table above.

## Obligations on later slices

These are not implemented here, because the endpoints do not exist yet. They are recorded so that
GH-8 and GH-9 inherit them (research D5):

- **GH-8 (acceptance)**: presenting the secret of a cancelled invitation must give the same public
  response as an unknown secret. The digest no longer exists, so this falls out of the lookup. The
  acceptance write must guard on `users.access_status = 'PENDING'` in the transaction that consumes
  the token.
- **GH-9 (renewal)**: the renewal must guard on the same `users` row still being `PENDING`, with a
  conditional `UPDATE` or a `FOR UPDATE` read, in the transaction that writes the new token. A
  token-only write would not wait for a concurrent cancellation, and could leave a live link on a
  cancelled user.
- **GH-13 (restoration)**: `PENDING → CANCELLED` stores the latest cancellation's date, actor, and
  comment. Whether restoration keeps or clears them is GH-13's decision. A later cancellation
  overwrites all three.
