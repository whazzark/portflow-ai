# Contract: `POST /api/v1/users/:id/reactivate`

**Feature**: [spec.md](../spec.md) · **Route name**: `users.reactivate` · **Controller**:
`UsersController.reactivate`

The only endpoint this feature adds. It is the whole write: one user, one transition, no body. It
also changes what counts as an open session, for the reactivated user only. See
[Effect on existing sessions](#effect-on-existing-sessions).

## Request

```http
POST /api/v1/users/00000000-0000-4000-8000-000000000002/reactivate
Cookie: <session>
```

No request body. The acting administrator and the timestamp come from the session and the server
clock. Neither is accepted from the client.

`:id` is validated as a UUID after authorization and before anything is read (FR-008). AdonisJS 7 has
no route matchers, so this is a VineJS validator run against the route parameters.

## Authorization

Applied by `UserPolicy.reactivate` (may reactivate at all), then by `ReactivateUserUseCase` (may
reactivate *this* user). The route is declared under `passwordRenewalCompleted()` like every other
`/users` route.

| Viewer | Outcome |
|---|---|
| Unauthenticated, or a session that no longer counts | `401`, `E_UNAUTHORIZED_ACCESS` |
| `accessStatus` ≠ `ACTIVE` | `401`: refused by `auth_middleware`, no session counts (GH-3) |
| Any role, session confined to its own renewal | `403`, `E_PASSWORD_RENEWAL_REQUIRED` (`#117`) |
| `OPERATIONS_ADMIN`, `OPERATIONS_LEAD`, `OBSERVER` | `403`, `E_AUTHORIZATION_FAILURE` |
| `ORGANIZATION_ADMIN` | evaluated against the target below |

Every `401` and `403` is returned before the target is read, so it is identical for a known, an
unknown, and a malformed identifier (FR-002).

## Response `200`

The reactivated user in the `toAdministration()` projection with the access history, the same shape
`GET /api/v1/users` serves an organization admin.

```json
{
  "data": {
    "id": "00000000-0000-4000-8000-000000000002",
    "firstName": "Thomas",
    "lastName": "Bernard",
    "email": "thomas.bernard@portflow.ai",
    "role": "OPERATIONS_ADMIN",
    "accessStatus": "ACTIVE",
    "invitedAt": "2026-01-12T09:00:00.000+01:00",
    "invitedBy": { "id": "…", "firstName": "Claire", "lastName": "Martin" },
    "activatedAt": "2026-01-12T14:31:00.000+01:00",
    "activatedBy": null,
    "cancelledAt": null,
    "cancelledBy": null,
    "cancellationComment": null,
    "deactivatedAt": "2026-09-10T11:04:22.000+02:00",
    "deactivatedBy": { "id": "…", "firstName": "Claire", "lastName": "Martin" },
    "reactivatedAt": "2026-09-11T09:12:05.000+02:00",
    "reactivatedBy": { "id": "…", "firstName": "Claire", "lastName": "Martin" },
    "passwordResetAt": null,
    "passwordResetBy": null,
    "activationLinkRenewedAt": null,
    "activationLinkRenewedBy": null,
    "activationLinkExpiresAt": null,
    "passwordRenewalRequired": true
  }
}
```

This call writes `accessStatus`, `reactivatedAt`, `reactivatedBy`, and `passwordRenewalRequired`.
Every other field is the value the user already carried, including the deactivation it reverses.
No password, link, or token appears anywhere in the response (FR-012, FR-013).

## Errors

| Status | `error.code` | When |
|---|---|---|
| `401` | `E_UNAUTHORIZED_ACCESS` | No session, one that no longer counts, or a viewer whose access is not active. |
| `403` | `E_PASSWORD_RENEWAL_REQUIRED` | The viewer's own session is confined to its renewal step. |
| `403` | `E_AUTHORIZATION_FAILURE` | Authenticated and active, but not an organization admin. |
| `404` | `E_USER_NOT_FOUND` | The identifier is well-formed and matches no user. |
| `409` | `E_USER_ALREADY_ACTIVE` | The target is active: someone else reactivated them first, or the administrator named themselves. |
| `409` | `E_USER_PENDING_INVITATION` | The target never activated their access; the message points to activation link renewal. |
| `409` | `E_USER_CANCELLED_INVITATION` | The target's invitation was withdrawn before activation; the message points to invitation restoration. |
| `422` | `E_VALIDATION_ERROR` | `:id` is not a UUID; no user is read. |

Every refusal uses the existing envelope, `{ "error": { "code": …, "message": … } }`, with `details`
on a validation error. A refusal leaves every user, every remembered connection, and every session
unchanged (FR-015).

## Guarantees

- **Exactly once under concurrency.** The write is guarded
  `… WHERE id = :id AND access_status = 'DEACTIVATED'`. Two simultaneous reactivations affect one
  row and zero rows. The loser answers `409 E_USER_ALREADY_ACTIVE`, and the recorded date and actor
  are the winner's (FR-016).
- **All or nothing.** The status, the reactivation event, the renewal requirement, and the revocation
  of the target's remembered connections commit together (FR-009, FR-015).
- **Nothing is handed over.** The target's password is untouched and no credential is produced. They
  sign in with the password they held before the deactivation (CLR-001).

## Effect on existing sessions

After a `200`, **no session opened before this reactivation counts for the reactivated user**, on any
browser (FR-014, research D5):

| Request carrying… | Outcome |
|---|---|
| a session opened before the deactivation, on any route including `GET /auth/me` | `401 E_UNAUTHORIZED_ACCESS`; the session is forgotten, so the next request is plainly unauthenticated |
| a remembered connection from before the reactivation | nothing to restore: every one was deleted |
| a session opened by `POST /auth/login` after the reactivation, with the pre-deactivation password | accepted, and confined by `#117`: `GET /auth/me` answers with `passwordRenewalRequired: true`; other protected routes answer `403 E_PASSWORD_RENEWAL_REQUIRED` until the renewal completes |
| a remembered connection established by such a login | restores normally |

Every other user's sessions and remembered connections are unaffected. Users never reactivated see
no change at all: a session with no marker matches a user with no reactivation.

## Client contract

`@portflow/api/registry` regenerates on the API's dev/build codegen, so the route surfaces as
`tuyauQuery.users.reactivate` and its response type flows into
`apps/web/src/features/users/types.ts`. The response is one user in the same shape as one entry of
`users.index`; the web must not widen it.
