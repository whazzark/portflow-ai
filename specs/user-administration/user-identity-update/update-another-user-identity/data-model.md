# Phase 1 Data Model: Update Another User Identity

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-10

One new table, three existing columns written, one new relation on the `User` model. Decisions and
rejected alternatives are in [research.md](./research.md).

## Existing: `users` — the three columns this feature writes

| Column | Type | Rule applied by this feature |
|---|---|---|
| `first_name` | `string` not null | Trimmed, non-blank, 1–255 characters (FR-008) |
| `last_name` | `string` not null | Trimmed, non-blank, 1–255 characters (FR-008) |
| `email` | `string` not null | Trimmed, well-formed, ≤ 255 characters (FR-009); unique across the organization under `users_email_unique` on `LOWER(email)` (FR-010) |
| `updated_at` | `timestamp` | Written by hand with the correction, as every guarded write in this codebase does |

Nothing else on `users` is written. `role`, `access_status`, every `…_at` / `…_by_user_id` lifecycle
pair, `password`, and `password_renewal_required_at` are untouched (FR-011), and the model's
`rememberMeTokens` rows are not deleted, so sessions and remembered connections survive.

**No migration on `users`.** The unique index the conflict rule needs was created by
`1783663779445_create_users_table.ts`.

## New: `user_identity_changes`

One immutable row per accepted correction (FR-013).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` primary key | Assigned by the model's `@beforeCreate`, as `User` does |
| `user_id` | `uuid` not null → `users.id`, `ON DELETE CASCADE` | The corrected user. Cascade because a pending user removed permanently (GH-12) takes their history with them |
| `changed_by_user_id` | `uuid` nullable → `users.id`, `ON DELETE SET NULL` | The responsible administrator. Nullable for the same reason every lifecycle actor column is: the actor may later be removed, and the event must survive them (FR-013, and the edge case on a deactivated or renamed administrator) |
| `changed_at` | `timestamp` not null | The correction time. What orders the history |
| `previous_first_name` | `string` not null | Identity as it stood before |
| `previous_last_name` | `string` not null | |
| `previous_email` | `string` not null | |
| `new_first_name` | `string` not null | Identity as it stands after |
| `new_last_name` | `string` not null | |
| `new_email` | `string` not null | |
| `created_at`, `updated_at` | `timestamp` | Repository convention; `updated_at` never moves — the row is immutable |

**Index**: `(user_id, changed_at)` — the only access path is "this user's corrections, in order".

**Invariants**

- A row exists only for a correction that changed at least one of the three parts (D10).
- `changed_by_user_id` is the authenticated administrator, never the corrected user: this feature
  refuses self-correction (FR-004), so a row here always describes an administrative act.
- Rows are never updated or deleted by this feature. They leave only with their user.

## Relations

```text
User ──< UserIdentityChange >── User
     user_id              changed_by_user_id
```

`User` gains `@hasMany(() => UserIdentityChange, { foreignKey: 'userId' })` as `identityChanges`.
`UserIdentityChange` gains `@belongsTo(() => User, { foreignKey: 'changedByUserId' })` as `changedBy`,
the same self-referential shape the five lifecycle actor relations already use.

## State transitions

None. An identity has no states; a correction replaces values. The user's `access_status` is read to
decide whether the activation-link branch applies (D7) and is never written.

## Read projection

`UserTransformer.toAdministration()` gains one key, gated exactly like the lifecycle events:

```text
identityChanges: when(includeAccessHistory, [
  {
    changedAt,
    changedBy: { id, firstName, lastName } | null,
    previous: { firstName, lastName, email },
    next:     { firstName, lastName, email },
  },
  …  // oldest first, matching the access history already rendered
])
```

Absent — not `null`, not `[]` — for a viewer who may not consult the access history (FR-014), which is
what `this.when()` already produces. An organization admin consulting a user never corrected receives
an empty array, so the workbench distinguishes "no correction" from "not allowed to know" without a
second flag (FR-013's "no unrecorded event presented as empty" is about presentation, handled in the
web layer).

`toObject()` and `toSummary()` are untouched: the first is the session contract behind `/auth/me` and
`/auth/login`, the second is what every site reference embeds for its lifecycle actors.

## Validation summary

| Rule | Where | Outcome |
|---|---|---|
| Well-formed body, field types, lengths | `updateUserIdentityValidator` (VineJS) | 422, field named |
| Trim, non-blank names | `normalize_user_identity` domain helper | `E_USER_IDENTITY_INVALID` (422) |
| Target exists | Repository outcome `NOT_FOUND` | `E_USER_NOT_FOUND` (404) |
| Target is not the requester | `UpdateUserIdentityUseCase` | `E_USER_IDENTITY_SELF_UPDATE` (403) |
| Email free, case- and whitespace-insensitively | Pre-check, then `users_email_unique` violation | `E_USER_EMAIL_CONFLICT` (409) |
| Pending target whose email changes gets a fresh link | `ActivationLinkIssuer` inside the transaction | `E_USER_ACTIVATION_LINK_UNAVAILABLE` (409) until GH-7 |
| Viewer is an active organization admin | `UserPolicy.updateIdentity` | 403 |
