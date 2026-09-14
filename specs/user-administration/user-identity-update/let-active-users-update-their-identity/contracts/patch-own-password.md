# Contract: `PATCH /api/v1/me/password`

**Feature**: [spec.md](../spec.md) · **Route name**: `me.password.update` · **Date**: 2026-09-14

Replaces the signed-in user's own password. Added with the profile (US6); see [research.md](../research.md) D15.

## Placement

Beside `me.profile.update`, inside the authenticated `/api/v1` group and **inside** the
`.use(middleware.passwordRenewalCompleted())` group:

```text
router.patch('/me/password', [controllers.OwnProfile, 'changePassword']).as('me.password.update')
```

A user who owes a renewal is refused here and clears it through `POST /api/v1/auth/password-renewal`,
which asks for no current password because an administrator's requirement stands in its place.

## Request

`Content-Type: application/json`

```jsonc
{
  "currentPassword": "••••••••••••",
  "password": "••••••••••••••••",
  "passwordConfirmation": "••••••••••••••••"
}
```

| Field | Rule |
|---|---|
| `currentPassword` | required string, at least 1 character, **not** trimmed. Verified against the stored hash |
| `password` | required, from the shared `newPasswordFields`: 12–128 characters, `confirmed` against `passwordConfirmation`, not trimmed |
| `passwordConfirmation` | required string, must equal `password` |

No user identifier: the target is the session's user (FR-021).

## Success — `200 OK`

The user in the session projection, exactly as `me.profile.update` answers, so the client refreshes
its session from it. No credential is echoed — neither hash nor submitted password.

Effects:

- the password is replaced (FR-021);
- every remembered connection of that user is revoked **except** the one the request presented
  (FR-025);
- the session in use stays open, and identity, role, access status, lifecycle events, and the
  renewal requirement are untouched (FR-026).

## Failures

| Status | Code | When |
|---|---|---|
| `401` | `E_UNAUTHORIZED_ACCESS` | No session, or a session whose user is not `ACTIVE` (`middleware.auth()`); also the locked row gone or no longer active |
| `403` | `E_PASSWORD_RENEWAL_REQUIRED` | A renewal is owed — by the gate, and re-checked under the lock (FR-027) |
| `422` | `E_VALIDATION_ERROR` | Missing fields, a password shorter than 12 or longer than 128, or a confirmation that differs. `details[]` names the field, `passwordConfirmation` for a mismatch (FR-024) |
| `422` | `E_CURRENT_PASSWORD_INCORRECT` | `currentPassword` does not verify — also when the stored password moved between the verification and the write (FR-022) |
| `422` | `E_PASSWORD_UNCHANGED` | The new password is the one already in use (FR-023) |

Every refusal writes nothing and revokes nothing.

`E_CURRENT_PASSWORD_INCORRECT` is shared with `me.profile.update`, which asks for the same proof
before moving the sign-in address. `E_PASSWORD_UNCHANGED` is distinct from the renewal's
`E_PASSWORD_RENEWAL_UNCHANGED`: that one names a renewal an administrator required.

## Order of decisions

1. `middleware.auth()`, then `passwordRenewalCompleted()`.
2. `UserPolicy.updateOwnProfile` — active, any role.
3. `changeOwnPasswordValidator`.
4. The current password is verified, and the new one compared with it — both before the transaction,
   because scrypt must never run under a row lock.
5. Under the lock: still active, owing no renewal, and still holding the hash that was verified.
6. The write and the revocation, in that one transaction.

## Contract stability

`auth.password_renewal` is unchanged, and keeps asking for no current password. The controller it
shares its cookie reading with now calls `presentedRememberedConnectionId`, extracted verbatim.
`apps/web` picks the route up as `tuyauQuery.me.password.update` (ADR-0005).
