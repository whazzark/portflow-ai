# Contract: `PATCH /api/v1/me/profile`

**Feature**: [spec.md](../spec.md) · **Route name**: `me.profile.update` · **Date**: 2026-09-11

Updates the signed-in user's own identity. It is the only write this feature adds.

## Placement

Declared in `apps/api/start/routes.ts` inside the authenticated `/api/v1` group, **inside** the
`.use(middleware.passwordRenewalCompleted())` group next to the business routes, not in the `/auth`
group (research.md D1):

```text
router.patch('/me/profile', [controllers.OwnProfile, 'update']).as('me.profile.update')
```

`OwnProfileController.update` authorizes `UserPolicy.updateOwnProfile` first, then validates the
body with `updateOwnProfileValidator`, then calls `UpdateOwnProfileUseCase`.

## Request

`Content-Type: application/json`

```jsonc
{
  "firstName": "Camille",
  "lastName": "Renard",
  "email": "camille.renard@example.com",
  "currentPassword": "••••••••••••" // required only when the address changes
}
```

| Field | Rule |
|---|---|
| `firstName` | required string, trimmed, non-blank, 1–255, from the shared `userIdentityFields` |
| `lastName` | required string, trimmed, non-blank, 1–255, from the shared `userIdentityFields` |
| `email` | required string, trimmed, well-formed, ≤ 255, from the shared `userIdentityFields` |
| `currentPassword` | optional string, **not** trimmed. Required by the use case when `email` differs from the stored address, compared trimmed and case-insensitively. Ignored otherwise, but still never stored or echoed |

All three identity keys are required, for the reason `updateUserIdentityValidator` records: an
omitted key must fail validation rather than silently keep or clear a stored value. There is **no
user identifier** anywhere in the request, so the target is always the session's user (FR-003).

## Success — `200 OK`

The updated user in the session projection, the same shape as `GET /api/v1/auth/me` (research.md D7):

```jsonc
{
  "data": {
    "id": "…",
    "firstName": "Camille",
    "lastName": "Renard",
    "email": "camille.renard@example.com",
    "role": "OBSERVER",
    "accessStatus": "ACTIVE",
    "invitedAt": "…", "activatedAt": "…", "cancelledAt": null,
    "deactivatedAt": null, "reactivatedAt": null,
    "invitedByUserId": "…", "activatedByUserId": "…", "cancelledByUserId": null,
    "deactivatedByUserId": null, "reactivatedByUserId": null,
    "passwordRenewalRequired": false
  }
}
```

A submission identical to the stored identity also returns `200` with the user unchanged. Nothing is
written, and no password is asked for.

The session cookie and any remembered connection are neither rotated nor revoked, including after an
address change (research.md D8).

## Failures

| Status | Code | When |
|---|---|---|
| `401` | `E_UNAUTHORIZED_ACCESS` | No session, or a session whose user is not `ACTIVE` (`middleware.auth()`). Also the locked row is gone or no longer `ACTIVE` (D5) |
| `403` | `E_PASSWORD_RENEWAL_REQUIRED` | The user still owes a password renewal (`passwordRenewalCompleted()`, FR-004) |
| `403` | `E_AUTHORIZATION_FAILURE` | `UserPolicy.updateOwnProfile` denies. Unreachable today behind `middleware.auth()`, but kept as the explicit rule |
| `409` | `E_USER_EMAIL_CONFLICT` | The address is held by another user, compared by case and whitespace, whatever that user's access status. Reported **only after** the current password has been verified (FR-009) |
| `422` | `E_VALIDATION_ERROR` | Malformed body, a blank or over-long name, or a malformed address. `details[]` names the field |
| `422` | `E_USER_IDENTITY_INVALID` | A value that passes VineJS but fails `assertValidUserIdentity` |
| `422` | `E_CURRENT_PASSWORD_REQUIRED` | The address changes and `currentPassword` is absent or empty. Also, under the lock, the address moves without a verified password, or the stored hash changed since verification (D4). Message: "Enter your current password to change your email address." |
| `422` | `E_CURRENT_PASSWORD_INCORRECT` | The address changes and `currentPassword` does not verify. Message: "The current password is incorrect." |

Every refusal changes nothing. An accepted update applies all three parts or none (FR-011).

`E_CURRENT_PASSWORD_*` are `422`, never `401`: a `401` would sign the user out of the session the
form is running in (D4).

## Authorization matrix

| Viewer | Submission | Outcome |
|---|---|---|
| Active organization admin, operations admin, operations lead, or observer | Names only, valid | `200` |
| Same | Address changed, correct `currentPassword` | `200`; next sign-in works with the new address, fails with the former one |
| Same | Address changed, `currentPassword` missing | `422 E_CURRENT_PASSWORD_REQUIRED`, nothing changed |
| Same | Address changed, `currentPassword` wrong | `422 E_CURRENT_PASSWORD_INCORRECT`, nothing changed, even if the address is taken |
| Same | Address re-cased only, no password | `200`, applied as typed |
| Same | Address taken, correct `currentPassword` | `409 E_USER_EMAIL_CONFLICT`, neither user changed |
| Active user owing a password renewal | Anything | `403 E_PASSWORD_RENEWAL_REQUIRED` |
| Non-active user | Anything | `401` |
| Unauthenticated | Anything | `401` |

## Contract stability

- `users.update` (GH-24), its body, its `E_USER_IDENTITY_SELF_UPDATE` refusal, and every
  `UserTransformer` variant are unchanged.
- The only shared-code change is `updateUserIdentityValidator` spreading the extracted
  `userIdentityFields`, which leaves its accepted shape identical.
- The Tuyau registry under `apps/api/.adonisjs/client/` regenerates from the route and the
  controller, and `apps/web` picks the route up as `tuyauQuery.me.profile.update` (ADR-0005).
