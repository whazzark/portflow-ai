# HTTP Contract: Force a Password Change After Login

**Feature**: `GH-117` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

The web client consumes these routes through Tuyau's generated types; the generated definitions are
refreshed by the existing generator, never hand-edited (ADR 0005).

## Route tree

`start/routes.ts` splits its single authenticated group in two (research [D3](../research.md)).
Route **names are unchanged** by the split, so `auth.me`, `auth.login`, and `auth.logout` — and the
`Route.Response<'auth.me'>` type `session-context.tsx` depends on — keep working.

```text
POST /api/v1/auth/login                    (unauthenticated)

/api/v1/auth        middleware.auth()
  GET  /me                                 auth.me
  POST /logout                             auth.logout
  POST /password-renewal                   auth.password_renewal      ← new

/api/v1             middleware.auth(), middleware.passwordRenewalCompleted()
  …customers, transport-companies, trucks, docks, weighing-areas,
    warehouse-doors, warehouses — all unchanged, all now confined
```

The three routes above the second group are the whole of FR-006's exemption list. Everything else is
confined by placement rather than by an allowlist, and a test enumerates the router to prove it
(research [D4](../research.md)).

## New endpoint

### `POST /api/v1/auth/password-renewal`

Route name `auth.password_renewal`. Handled by `PasswordRenewalController#store`.

**Authorization**: none beyond an authenticated session. The user renews their own password; there is
no policy and no role check. A session that owes no renewal is refused by the use case, not by a
policy (research [D7](../research.md)).

**Request body** — validated by `passwordRenewalValidator`:

```jsonc
{
  "password": "correct-horse-battery-staple",
  "passwordConfirmation": "correct-horse-battery-staple"
}
```

| Field | Rule |
|---|---|
| `password` | string, 12–128 characters, **not trimmed** (research [D10](../research.md)), must match `passwordConfirmation` |
| `passwordConfirmation` | string, must equal `password` |

**`200 OK`** — the signed-in user, serialized by `UserTransformer#toObject()`, now reporting
`passwordRenewalRequired: false`. Same shape as `auth.me`, so the web can seed the session cache from
the response.

```jsonc
{
  "data": {
    "id": "…", "firstName": "Claire", "lastName": "Martin",
    "email": "claire.martin@portflow.ai",
    "role": "OBSERVER", "accessStatus": "ACTIVE",
    "passwordRenewalRequired": false,
    "invitedAt": null, "activatedAt": "…", "cancelledAt": null,
    "deactivatedAt": null, "reactivatedAt": null,
    "invitedByUserId": null, "activatedByUserId": null, "cancelledByUserId": null,
    "deactivatedByUserId": null, "reactivatedByUserId": null
  }
}
```

`password` is never serialized — the generated `UserSchema` marks it `serializeAs: null`.

**Side effects**

- the user's password is replaced with a fresh scrypt hash;
- `password_renewal_required_at` becomes `NULL`;
- every remembered connection of this user **except** the one presented by this request is deleted
  (FR-015, research [D8](../research.md));
- the current session is untouched and stays valid (FR-014).

**Failures**

| Status | Code | Condition | Spec |
|---|---|---|---|
| `401` | `E_UNAUTHORIZED_ACCESS` | unauthenticated, expired session, or access no longer active | FR-020, US4-4 |
| `409` | `E_PASSWORD_RENEWAL_NOT_REQUIRED` | the session owes no renewal, or a concurrent renewal already cleared it | FR-016, FR-024 |
| `422` | `E_VALIDATION_ERROR` | too short, too long, missing, or confirmation mismatch | FR-010 |
| `422` | `E_PASSWORD_RENEWAL_UNCHANGED` | the new password equals the one being replaced | FR-011 |

A `422` mismatch is reported by VineJS against `passwordConfirmation`, so it reaches the field through
the existing `applyValidationError` path. `E_PASSWORD_RENEWAL_UNCHANGED` is an `Exception` subclass and
therefore carries no `details[]`; the form maps that code onto the password field explicitly
(research [D9](../research.md)).

## Changed responses

### `GET /api/v1/auth/me` and `POST /api/v1/auth/login`

Both gain `passwordRenewalRequired: boolean` in `data`. No field is removed or renamed.

`auth.login` reports `true` for a user who owes a renewal — the login itself still succeeds with `200`
and opens a session (FR-002, research [D5](../research.md)).

Both routes stay reachable from a confined session (FR-006, FR-008); `auth.me` is what the web reads
to decide whether to present the renewal step.

### Every other `/api/v1` route

A new refusal, applied before the controller runs:

| Status | Code | Condition | Spec |
|---|---|---|---|
| `403` | `E_PASSWORD_RENEWAL_REQUIRED` | the signed-in user owes a password renewal | FR-006, FR-007 |

`403` rather than `401`, because the session is valid and must not be terminated (FR-005). The web's
`isUnauthorizedError` only matches `401`, so this code does not push the user to `/login`
(research [D13](../research.md)).

The refusal precedes every lookup, so a confined request to `/api/v1/trucks/:id` returns `403` for an
existing and a non-existent truck alike — FR-006's "no business data is disclosed", including the
existence of a record.

## Unchanged

- `POST /api/v1/auth/login` — validator, use case, and the indistinguishable invalid-credentials
  outcome for every non-active access status are untouched (research [D5](../research.md)).
- `POST /api/v1/auth/logout` — unchanged, and deliberately reachable while confined (FR-019, US2-4).
- `GET /health` — outside `/api/v1`, unauthenticated, unaffected.
- The 30-day remembered-connection window and its absolute-expiry check in `AuthMiddleware`.
