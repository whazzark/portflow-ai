# HTTP Contract: Reset an Active User Password

**Feature**: `GH-17` | **Date**: 2026-09-10 | **Spec**: [../spec.md](../spec.md)

One endpoint is added. No existing endpoint changes shape, but the `users.index` payload gains three
keys — see [../data-model.md](../data-model.md#toadministration--the-user-collection).

## `POST /api/v1/users/:id/password-reset`

**Tuyau name**: `users.password_reset` → `tuyauQuery.users.passwordReset` on the web client.

Requires an active user to choose a new password: records the renewal requirement `#117` enforces,
records who reset and when, and revokes every remembered connection the target holds.

### Request

| | |
|---|---|
| Path parameter | `id` — the target user's identifier |
| Body | none |
| Middleware | `auth` → `passwordRenewalCompleted` (the route is declared inside the existing group, so both apply) |
| Authorization | `UserPolicy.resetPassword` — requester must be `ACTIVE` and `ORGANIZATION_ADMIN` |

No VineJS validator is added: there is no payload to shape, and an empty schema would be ceremony.
The route is declared in the group that already carries `passwordRenewalCompleted`, so a requester
who owes their own renewal is refused before the controller runs (FR-005, US2-8).

### `200 OK`

The updated target user, serialized through `UserTransformer`'s administration variant with the
access history included — the requester is an organization admin, which is the only role that
reaches this endpoint.

```json
{
  "data": {
    "id": "…",
    "firstName": "…",
    "lastName": "…",
    "email": "…",
    "role": "OPERATIONS_LEAD",
    "accessStatus": "ACTIVE",
    "invitedAt": "…", "invitedBy": { "id": "…", "firstName": "…", "lastName": "…" },
    "activatedAt": "…", "activatedBy": null,
    "cancelledAt": null, "cancelledBy": null,
    "deactivatedAt": null, "deactivatedBy": null,
    "reactivatedAt": null, "reactivatedBy": null,
    "passwordResetAt": "2026-09-10T09:41:00.000+02:00",
    "passwordResetBy": { "id": "…", "firstName": "…", "lastName": "…" },
    "passwordRenewalRequired": true
  }
}
```

The response MUST NOT carry `password`, `passwordRenewalRequiredAt`, any token, or any credential
(FR-010, FR-010a, SC-009). `password` is already `serializeAs: null` on the model and the transformer
picks an explicit key list, so this holds by construction — and is asserted anyway.

### Refusals

Every refusal writes nothing: no requirement, no reset event, no revoked connection (FR-013).

| Status | Code | When |
|---|---|---|
| `401` | `E_UNAUTHORIZED_ACCESS` | no authenticated session |
| `403` | `E_PASSWORD_RENEWAL_REQUIRED` | the requester owes their own renewal — existing middleware |
| `403` | `E_AUTHORIZATION_FAILURE` | requester is an operations admin, operations lead, or observer |
| `404` | `E_USER_NOT_FOUND` | `:id` names no user |
| `409` | `E_USER_NOT_ACTIVE` | target is `PENDING`, `DEACTIVATED`, or `CANCELLED` |
| `422` | `E_USER_PASSWORD_RESET_SELF` | target is the requester |

All follow the shared error envelope from ADR 0005 and `HttpExceptionHandler`:

```json
{ "error": { "code": "E_USER_NOT_ACTIVE", "message": "Only an active user's password can be reset" } }
```

The `409` / `422` split is the one `password_renewal_exceptions.ts` already documents: `409` for a
lifecycle conflict, `422` for a refusal about the submitted target rather than the state of the
world. `403` rather than `401` for the confined requester is inherited from the existing middleware,
and matters for the reason it states — the web's `isUnauthorizedError` matches only `401`.

### Idempotency and concurrency

- Resetting a user who already owes a renewal succeeds and refreshes the event to the newer date and
  administrator; the user still owes exactly one renewal (FR-011).
- Two concurrent resets both succeed and leave one requirement with one consistent recorded origin;
  the guarded `UPDATE … WHERE access_status = 'ACTIVE'` inside a transaction is what makes that
  atomic (FR-012).
- A reset racing a renewal resolves to one of two unambiguous states — the renewal cleared the
  requirement, or the reset recorded a new one — never to a reported success that wrote nothing
  (US4-5).

## `GET /api/v1/users` — payload extension

Unchanged status, authorization, and shape. The administration projection gains `passwordResetAt`,
`passwordResetBy`, and `passwordRenewalRequired`, all withheld from viewers who may not consult the
access history, exactly as the five existing lifecycle pairs are. An operations admin's payload keeps
the identity block alone; the keys are **absent**, not null.

This is what lets FR-018 and FR-020 be satisfied by invalidating one query: `#4` built the access
record as a view over the retrieved collection, with no per-user read seam, and this feature
introduces none.

## Route declaration

```ts
router
  .group(() => {
    router.get('/', [controllers.Users, 'index']).as('index')
    router.post('/:id/password-reset', [controllers.Users, 'resetPassword']).as('password_reset')
  })
  .prefix('/users')
  .as('users')
```

No ordering hazard: unlike `/warehouses` and `/docks`, this group declares no literal sibling that a
`:id` pattern could swallow.
