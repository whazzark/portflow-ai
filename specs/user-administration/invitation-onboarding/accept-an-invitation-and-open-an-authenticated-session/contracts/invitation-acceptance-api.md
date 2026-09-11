# Contract: Invitation acceptance API

**Feature**: [spec.md](../spec.md) · **Controller**: `InvitationAcceptanceController` · **Research**:
[D1](../research.md#d1--two-public-post-endpoints-under-apiv1auth-with-the-secret-in-the-body),
[D4](../research.md#d4--one-uniform-refusal-404-e_activation_link_unusable),
[D7](../research.md#d7--a-session-is-open-means-exactly-what-authmiddleware-accepts),
[D9](../research.md#d9--the-session-opens-after-commit-and-a-failure-to-open-it-has-its-own-answer)

This feature adds two public endpoints. Both are declared outside the `auth()` middleware group, next
to `auth.login`. Neither takes the secret from the URL.

---

## `POST /api/v1/auth/invitation-acceptance/preview`

**Route name**: `auth.invitation_acceptance.preview` · **Tuyau**:
`auth.invitation_acceptance.preview`

It answers whose access a link activates, and changes nothing (FR-001, FR-002). It does not consult
the session: a signed-in browser gets the same answer, which the screen shows next to the signed-in
user (US4-1).

### Request

```http
POST /api/v1/auth/invitation-acceptance/preview
Content-Type: application/json

{ "token": "8b2f…" }
```

### Response `200`

```json
{
  "data": {
    "firstName": "Claire",
    "lastName": "Martin",
    "email": "claire.martin@portflow.test"
  }
}
```

The fields are exactly these three, from `UserTransformer.toActivationPreview()`. The response has
no `id`, no role, no access status, no dates, and no token.

### Refusals

| Case | Status | Body |
|---|---|---|
| Never issued, malformed, expired, used, replaced, or user not `PENDING` | `404` | `{ "error": { "code": "E_ACTIVATION_LINK_UNUSABLE", "message": "This activation link cannot be used" } }`, identical in every case |
| `token` missing, empty, or not a string | `422` | `E_VALIDATION_ERROR`, with `details` on `token`. Only a broken client can send this: the web always sends the route's token, and the bodyparser turns an empty string into `null`. |

---

## `POST /api/v1/auth/invitation-acceptance`

**Route name**: `auth.invitation_acceptance.store` · **Tuyau**: `auth.invitation_acceptance.store`

It accepts the invitation and opens a temporary session for the activated user (FR-003, FR-006,
FR-008).

### Request

```http
POST /api/v1/auth/invitation-acceptance
Content-Type: application/json
Cookie: <whatever the browser holds>

{
  "token": "8b2f…",
  "password": "correct-horse-battery-staple",
  "passwordConfirmation": "correct-horse-battery-staple"
}
```

`rememberMe` is not accepted: acceptance never opens a remembered connection (clarification 2). The
password is not trimmed by the validator, but see the note on surrounding spaces under Refusals.

### Decision order

Each step either refuses or passes to the next.

1. **Validation.** The password rule is shared with password renewal (D8). Failure is `422`.
2. **Open session.** If `resolveOpenSessionUser(ctx)` returns a user, refuse with `409`. The link is
   not read (D7).
3. **Early usability check.** If the link is unusable, refuse with `404`. The password is not hashed.
4. **Hash and write.** Hash the password, then run the guarded transaction (D5). An `UNUSABLE`
   outcome, which covers a lost race and an expiry between steps 3 and 4, refuses with `404`.
5. **Open the session.** Call `auth.use('web').login(user)` without remembering; the session id is
   regenerated. If this throws, refuse with `500`.

### Response `200`

```json
{
  "data": {
    "id": "00000000-0000-4000-8000-000000000042",
    "firstName": "Claire",
    "lastName": "Martin",
    "email": "claire.martin@portflow.test",
    "role": "OPERATIONS_LEAD",
    "accessStatus": "ACTIVE",
    "invitedAt": "2026-09-10T14:31:00.000+02:00",
    "activatedAt": "2026-09-11T09:12:00.000+02:00",
    "cancelledAt": null,
    "deactivatedAt": null,
    "reactivatedAt": null,
    "invitedByUserId": "…",
    "activatedByUserId": "00000000-0000-4000-8000-000000000042",
    "cancelledByUserId": null,
    "deactivatedByUserId": null,
    "reactivatedByUserId": null,
    "passwordRenewalRequired": false
  }
}
```

The body is exactly `UserTransformer.toObject()`, the projection `auth.login` and `auth.me` return.
The response sets the session cookie (`adonis-session`), and never `remember_web`. The response has
no `password` and no token.

### Refusals

| Case | Status | Code | State afterwards |
|---|---|---|---|
| Password empty, under 12 characters, or over 128 characters | `422` | `E_VALIDATION_ERROR`, `details` on `password` | Unchanged; the link is still usable |
| Confirmation does not match | `422` | `E_VALIDATION_ERROR`, `details` on `passwordConfirmation` | Unchanged; the link is still usable |
| `token` missing, empty, or not a string | `422` | `E_VALIDATION_ERROR`, `details` on `token` | Unchanged |
| The browser holds a session `AuthMiddleware` would accept, including one confined to a password renewal | `409` | `E_INVITATION_ACCEPTANCE_SESSION_OPEN` | Unchanged; the link is still usable; the open session is untouched |
| The link is unusable, for any reason, including the loser of a race | `404` | `E_ACTIVATION_LINK_UNUSABLE`, identical to the preview's | Unchanged |
| Activated, but the session could not be opened | `500` | `E_INVITATION_ACCEPTED_SESSION_NOT_OPENED` | User `ACTIVE` with the chosen password; the link is consumed |
| Any other failure | `500` | from the framework | Rolled back; the link is still usable (FR-017) |

**Surrounding spaces.** The validator never trims the password, but the bodyparser's default
`trimWhitespaces` trims every JSON string before any validator runs, here as at login and at password
renewal. A padded password is therefore recorded without its padding, and logs in with or without
it. Every entry point trims the same way, so nobody is locked out. This is FR-005 as amended by the
clarification of 2026-09-11.

A browser holding a stale session, such as a deactivated user's cookie or an expired remembered
connection, is **not** an open session. It is treated as signed out and replaced by the new session
on success, because that is how `auth.me` already treats it (D7).

---

## Invariants both endpoints guarantee

- The token appears in no URL, no response body, no exception message, no `meta`, and no report
  (FR-020, SC-006).
- The unusable refusal is byte-identical across every reason and both endpoints (FR-012).
- No request of this contract changes a user who is not `PENDING`, or a link that is not consumed by
  a successful acceptance.
