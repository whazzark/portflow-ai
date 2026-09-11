# Phase 1 Data Model: Update Another User Identity

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-10

No new table, no migration: three existing columns and `updated_at` are written. Decisions and
rejected alternatives are in [research.md](./research.md).

**Revised 2026-09-11**: the `user_identity_changes` table first designed here for the identity history
(D3) is deferred with the history itself. It was built, then removed before merge; if the history
returns, it returns as its own slice with its own migration, and research.md D3 keeps its design.

## Existing: `users` — the columns this feature writes

| Column | Type | Rule applied by this feature |
|---|---|---|
| `first_name` | `string` not null | Trimmed, non-blank, 1–255 characters (FR-008) |
| `last_name` | `string` not null | Trimmed, non-blank, 1–255 characters (FR-008) |
| `email` | `string` not null | Trimmed, well-formed, ≤ 255 characters (FR-009); unique across the organization under `users_email_unique` on `LOWER(email)` (FR-010); not writable while the user is `PENDING` (D7) |
| `updated_at` | `timestamp` | Written by hand with the correction, as every guarded write in this codebase does |

Nothing else on `users` is written. `role`, `access_status`, every `…_at` / `…_by_user_id` lifecycle
pair, `password`, and `password_renewal_required_at` are untouched (FR-011), and the model's
`rememberMeTokens` rows are not deleted, so sessions and remembered connections survive. A pending
user's `user_activation_tokens` row (GH-7) is never read or written by this feature.

**No migration on `users`.** The unique index the conflict rule needs was created by
`1783663779445_create_users_table.ts`.

## Relations

None added. The `User` model is unchanged.

## State transitions

None. An identity has no states; a correction replaces values. The user's `access_status` is read to
decide whether the address may move (D7) and is never written.

## Read projection

`UserTransformer` is unchanged. `PATCH /api/v1/users/:id` answers with the existing
`toAdministration()` projection — the same shape `GET /api/v1/users` gives an organization admin, the
only viewer who can reach this endpoint. `toObject()` and `toSummary()` are untouched: the first is the
session contract behind `/auth/me` and `/auth/login`, the second is what every site reference embeds
for its lifecycle actors.

## Validation summary

| Rule | Where | Outcome |
|---|---|---|
| Well-formed body, field types, lengths | `updateUserIdentityValidator` (VineJS) | 422, field named |
| Trim, non-blank names | `normalize_user_identity` domain helper | `E_USER_IDENTITY_INVALID` (422) |
| Target exists | Locked read in the use case, then repository outcome `NOT_FOUND` | `E_USER_NOT_FOUND` (404) |
| Target is not the requester | `UpdateUserIdentityUseCase` | `E_USER_IDENTITY_SELF_UPDATE` (403) |
| A pending target's address does not move (case-insensitive) | `UpdateUserIdentityUseCase`, before any write | `E_USER_PENDING_EMAIL_LOCKED` (409) |
| Email free, case- and whitespace-insensitively | Pre-check, then `users_email_unique` violation | `E_USER_EMAIL_CONFLICT` (409) |
| Viewer is an active organization admin | `UserPolicy.updateIdentity` | 403 |
