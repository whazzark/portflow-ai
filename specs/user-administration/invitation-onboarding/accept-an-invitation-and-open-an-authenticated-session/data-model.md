# Phase 1 Data Model: Accept an Invitation and Open an Authenticated Session

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**:
[research.md](./research.md)

**No schema change.** GH-2 already delivered every `users` column this slice writes, and GH-7
delivered `user_activation_tokens`. This slice only reads and consumes the token and moves a user
from `PENDING` to `ACTIVE`. There is no migration and no new model.

## Entities touched

### `users` (existing)

The only transition this slice performs is `PENDING` to `ACTIVE`, written by one guarded `UPDATE`
(D5).

| Column | Before acceptance | After acceptance | Rule |
|---|---|---|---|
| `access_status` | `PENDING` | `ACTIVE` | The guard is `WHERE access_status = 'PENDING'`, and exactly one row must match. |
| `password` | `null` | scrypt hash of the chosen password | Hashed before the transaction. The validator does not trim it, but the bodyparser trims every JSON string first, as it does at login (see the note under Validation). |
| `activated_at` | `null` | `acceptedAt`, the server clock at the use case | The activation event (FR-006). |
| `activated_by_user_id` | `null` | the user's own `id` | Self-attributed (D6). |
| `updated_at` | — | `acceptedAt` | Written by hand; the query builder bypasses the autoUpdate hook. |
| `password_renewal_required_at` | `null` | `null` | Not written (FR-007). |
| `first_name`, `last_name`, `email`, `role` | — | unchanged | Not written (FR-007). |
| `invited_at`, `invited_by_user_id` | set by GH-7 | unchanged | Not written (FR-007). |
| other lifecycle columns | `null` | unchanged | Not written. |

### `user_activation_tokens` (existing, GH-7)

| Column | Use in this slice |
|---|---|
| `hash` | Looked up by `digestActivationSecret(token)`: SHA-256, hex (D3). The unique index serves the lookup. |
| `expires_at` | Compared with `now` on preview, and with `acceptedAt` inside the guarded `DELETE` (FR-011). |
| `user_id` | Joins to the pending user. |

**Lifecycle**: a successful acceptance deletes the row. Issuance created it (GH-7), and renewal
(GH-9) replaces it. A refused or failed acceptance leaves it untouched (FR-017).

### `remember_me_tokens` (existing)

This slice neither reads nor writes it. A pending user never held a session, so there is nothing to
revoke. The acceptance opens a temporary session only (clarification 2), so no row is created.

## Usability of a link (D3)

A presented `token` is **usable** when all three hold:

1. a `user_activation_tokens` row has `hash = sha256_hex(token)`;
2. that row's `expires_at` is later than the moment of evaluation;
3. that row's user has `access_status = 'PENDING'`.

Anything else is **unusable**, and every unusable case yields the same refusal, whatever the reason
and on both endpoints (D4).

## State transitions

```text
                 accept (usable link, no open session, valid password)
   PENDING ─────────────────────────────────────────────────────────────▶ ACTIVE
      │            one transaction: DELETE token (guarded) + UPDATE user (guarded)
      │
      ├── preview .................................. no change (FR-002)
      ├── accept refused (session open)  ........... no change, link still usable (FR-014)
      ├── accept refused (password invalid) ........ no change, link still usable (FR-017)
      ├── accept refused (unusable) ................ no change (FR-012)
      └── accept failed (transient) ................ rolled back, link still usable (FR-017)
```

Two acceptances racing through one link: both reach the guarded `DELETE`, and exactly one deletes
the row. The other matches zero rows, rolls back, and is refused as unusable (FR-018).

## Repository operations (`UserRepository`)

| Operation | Returns | Notes |
|---|---|---|
| `findPendingByActivationTokenHash(hash: string, now: DateTime)` | `User \| null` | A plain read, used by the preview and as the acceptance's early refusal. No lock. |
| `acceptInvitation({ tokenHash, hashedPassword, acceptedAt })` | `{ kind: 'ACCEPTED'; user: User } \| { kind: 'UNUSABLE' }` | One transaction. The guarded `DELETE` is the concurrency control. Either zero-row outcome rolls back as `UNUSABLE`. The returned user is re-read with `preloadAccessHistory`, for a consistent instance. |

These are typed outcomes, not exceptions, following `apps/api/AGENTS.md`. The use case maps
`UNUSABLE` to `ActivationLinkUnusableException`.

## Use-case inputs

```ts
type PreviewInvitationInput = { token: string; now: DateTime }

type AcceptInvitationInput = {
  token: string
  password: string
  /** From `resolveOpenSessionUser(ctx)` (D7): non-null refuses before anything else. */
  signedInUserId: string | null
  acceptedAt: DateTime
}
```

## Projections

| Projection | Fields | Used by |
|---|---|---|
| `UserTransformer.toActivationPreview()` (new) | `firstName`, `lastName`, `email` | `auth.invitation_acceptance.preview`. No `id`, role, status, or dates: the link holder needs to recognize the access, nothing more (clarification 4). |
| `UserTransformer.toObject()` (existing, unchanged) | the session representation | `auth.invitation_acceptance.store`, exactly as `auth.login` and `auth.me` return it, so the web's session cache contract does not change (D9). |

## Validation (API)

| Field | Rule | Source |
|---|---|---|
| `token` | `vine.string()`, with nothing more | D4: shape rules would make malformed links distinguishable. |
| `password` | 12 to 128 characters, no validator trim, `confirmed({ as: 'passwordConfirmation' })` | `app/auth/shared/new_password_rule.ts`, shared with password renewal (D8). |
| `passwordConfirmation` | `vine.string()` | Same shared rule. |

The preview validator carries `token` only.

**What reaches the validator.** The bodyparser runs first, with its defaults:

- `trimWhitespaces` trims every JSON string, so a padded password is recorded without its padding.
  Login and password renewal trim the same way, so nobody is locked out. This is the behavior FR-005
  was amended to (clarification of 2026-09-11).
- `convertEmptyStringsToNull` turns an empty `token` into `null`, which the validator refuses as
  missing, with a `422`. Only a broken client sends one.

## Exceptions (new, `app/auth/invitation_acceptance/invitation_acceptance_exceptions.ts`)

| Class | Status | Code | Message | Reported |
|---|---|---|---|---|
| `ActivationLinkUnusableException` | 404 | `E_ACTIVATION_LINK_UNUSABLE` | This activation link cannot be used | No (404 is ignored) |
| `InvitationAcceptanceSessionOpenException` | 409 | `E_INVITATION_ACCEPTANCE_SESSION_OPEN` | Log out before activating this access | No (409 is ignored) |
| `InvitationAcceptedSessionNotOpenedException` | 500 | `E_INVITATION_ACCEPTED_SESSION_NOT_OPENED` | Your access is active. Log in with your new password | Yes |

None of them carries `meta`, and none of their messages includes the token.
