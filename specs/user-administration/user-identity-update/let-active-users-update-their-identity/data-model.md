# Phase 1 Data Model: Let Active Users Manage Their Own Profile

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-11

No new table, no migration, no new model. The feature writes the same columns GH-24 writes, through
the same repository operation, and reads one more: the password hash it verifies. Decisions are in
[research.md](./research.md).

## Existing: `users` — the columns this feature writes

| Column | Type | Rule applied by this feature |
|---|---|---|
| `first_name` | `string` not null | Trimmed, non-blank, 1–255 characters (FR-006) |
| `last_name` | `string` not null | Trimmed, non-blank, 1–255 characters (FR-006) |
| `email` | `string` not null | Trimmed, well-formed, ≤ 255 characters, and unique under `users_email_unique` on `LOWER(email)` (FR-006). A change requires the current password (FR-007, D4) |
| `updated_at` | `timestamp` | Written by hand with the update, as `applyIdentity` already does |

Written only on the signed-in user's own row. It is found by the session's user id and never by a
request parameter (FR-003).

## Existing: `users` — the columns this feature reads and never writes

| Column | Read for |
|---|---|
| `access_status` | The locked row must still be `ACTIVE` (D5) |
| `password` | Verifying the current password before the transaction (D4). Compared with the locked row's under the lock, so that a verification against a hash that has since changed does not count |
| `password_renewal_required_at` | By `passwordRenewalCompleted()`, which refuses the request while it is set (FR-004) |

Nothing else on `users` is read or written. `role`, every `…_at` / `…_by_user_id` lifecycle pair,
`password`, and `password_renewal_required_at` are untouched (FR-011). No `remember_me_tokens` row is
deleted, so sessions and remembered connections survive, including after an address change (D8).

## The password change (US6, added 2026-09-14)

Same table, one more column written, and one table emptied of some rows.

| Column / table | Written | Rule |
|---|---|---|
| `users.password` | Yes | The new password, hashed with scrypt **before** the transaction. Never stored, returned, or logged in the clear (FR-021, FR-024) |
| `users.updated_at` | Yes | By hand, as every guarded write here does |
| `remember_me_tokens` | Rows deleted | Every row of that user except the connection the request presented; `null` deletes them all, the safe direction (FR-025) |

Read and never written: `users.password` as the hash to verify against, `users.access_status`, and
`users.password_renewal_required_at` — the last two re-checked under the lock, so a deactivation or
an administrator's reset landing mid-request cannot be written over (FR-027).

Untouched by a password change: the identity columns, `role`, every lifecycle pair, and
`password_renewal_required_at` itself (FR-026). A refused change writes nothing and revokes nothing.

`ChangeOwnPasswordInput`: the session's `user`, `currentPassword`, `password`,
`keptRememberedConnectionId` (read from the request cookie by the controller), and `changedAt`.

## Relations

None added. The `User` model is unchanged.

## State transitions

None. An identity has no states. The user's `access_status` is a precondition here, not a transition.

## The request, as the domain sees it

`UpdateOwnProfileInput`:

| Field | Source | Notes |
|---|---|---|
| `user` | `auth.getUserOrFail()` | The session's user, as the guard loaded it for this request. Its `password` is what D4 verifies against, before any lock |
| `firstName`, `lastName`, `email` | Body, via `updateOwnProfileValidator` | Normalized by `assertValidUserIdentity`, as in GH-24 |
| `currentPassword` | Body, optional | Never trimmed, stored, logged, or returned (FR-010) |
| `changedAt` | `DateTime.now()` in the controller | As GH-24 |

## Read projection

`UserTransformer` is unchanged. The response is its default `toObject()` variant, the session
contract `GET /api/v1/auth/me` already returns (D7). `toAdministration()` and `toSummary()` are not
used by this seam. Every place that embeds the user through `toSummary()` resolves the current name
on its next read, which is why an organization admin who renames themselves is named with the new
identity on their recorded lifecycle events.

## Validation summary

The table is in evaluation order.

| # | Rule | Where | Outcome |
|---|---|---|---|
| 1 | A session exists and its user is active | `middleware.auth()` | `401` |
| 2 | No password renewal is owed | `passwordRenewalCompleted()` | `403 E_PASSWORD_RENEWAL_REQUIRED` |
| 3 | The viewer is an active user, of any role | `UserPolicy.updateOwnProfile` | `403` (unreachable after 1) |
| 4 | Well-formed body, types, lengths | `updateOwnProfileValidator`, spreading `userIdentityFields` | `422 E_VALIDATION_ERROR`, field named |
| 5 | Trimmed, non-blank names | `assertValidUserIdentity` | `422 E_USER_IDENTITY_INVALID` |
| 6 | If the address moves, a current password is present | `UpdateOwnProfileUseCase`, before the transaction | `422 E_CURRENT_PASSWORD_REQUIRED` |
| 7 | If the address moves, the current password verifies | `UpdateOwnProfileUseCase`, before the transaction | `422 E_CURRENT_PASSWORD_INCORRECT` |
| 8 | The locked row exists and is `ACTIVE` | `UpdateOwnProfileUseCase`, under the lock | `401 E_UNAUTHORIZED_ACCESS` |
| 9 | The address still does not move without a verified password, and the verified hash is still the stored one | `UpdateOwnProfileUseCase`, under the lock | `422 E_CURRENT_PASSWORD_REQUIRED` |
| 10 | Something differs from the stored identity | `isSameUserIdentity`, under the lock | `200`, nothing written |
| 11 | The address is free, compared by case and whitespace | `applyIdentity`: pre-check, then the `users_email_unique` violation | `409 E_USER_EMAIL_CONFLICT` |
