# Data Model: Cancel a Pending Invitation

**Feature**: `GH-12` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

This slice adds one column and writes to one existing table and deletes from another. No new table,
no new index. The reasoning behind each choice is in [research.md](./research.md) (D4, D6, D9).

## `users` — one new column

| Column | Type | Null | Written by | Meaning |
|---|---|---|---|---|
| `cancellation_comment` | `text` | yes | this slice | The administrator's optional comment on the latest cancellation, trimmed; `null` when none was entered |

The cancellation event itself already has its columns, shipped by GH-2 in
`1783663779445_create_users_table.ts` and read by the transformer and the web access history
today:

| Column | Written by this slice as |
|---|---|
| `access_status` | `'PENDING'` → `'CANCELLED'` |
| `cancelled_at` | the cancellation instant |
| `cancelled_by_user_id` | the cancelling organization admin (`ON DELETE SET NULL`, like every actor column) |
| `cancellation_comment` | the normalized comment, or `null` |
| `updated_at` | the cancellation instant (the query builder bypasses the model's auto-update hook) |

Nothing else on the row changes (FR-002). Identity, email, role, `password` (still `null`),
`invited_at`, `invited_by_user_id`, and every other event column stay as they were.

**Migration**: `apps/api/database/migrations/<timestamp>_add_user_cancellation_comment.ts`.
- `up()` is a plain `alterTable` adding the nullable `text` column. It carries no foreign key, so
  SQLite adds it in place.
- `down()` drops the column with the PostgreSQL/SQLite branch and `disableTransactions` of
  `1785500000000_add_user_password_renewal.ts`, because dropping a column on SQLite rebuilds `users`.
- Running it regenerates `apps/api/database/schema.ts`, adding `cancellationComment: string | null`
  to `UserSchema`.

**Factory**: `UserFactory` writes `cancellationComment: null` wherever it already nulls the
cancellation pair: the defaults, and the `active`, `passwordRenewalRequired`, and `passwordReset`
states. The `cancelled` state keeps `null` and can be merged with a comment and a
`cancelledByUserId` per test. A pending user with a live link is `UserFactory.apply('invited')` plus
a `UserActivationTokenFactory` row for it.

## `user_activation_tokens` — row deleted

| Operation | Condition | Effect |
|---|---|---|
| `DELETE WHERE user_id = ?` | inside the cancellation transaction, only after the guarded `UPDATE` matched one row | The pending user's single live activation link ceases to exist. Any presented secret now matches no row. |

The table is unchanged. Its `user_id` unique index guarantees there is at most one row to delete. A
pending user created before GH-7, by the seeder or a factory, may hold none, and the delete is then
a no-op. That is not an error: FR-004 is about no usable link *remaining*.

## State transition

```text
            invitation (GH-7)
                  │
                  ▼
   ┌──────────── PENDING ────────────┐
   │ cancellation (this slice)       │ acceptance (GH-8)
   ▼                                 ▼
CANCELLED                          ACTIVE ── deactivation (GH-20) ──► DEACTIVATED
   │
   ├─ restoration (GH-13) ──► PENDING, with a new activation link
   └─ removal (GH-14) ──► row deleted
```

This slice owns exactly one edge: `PENDING → CANCELLED`. Every other source status is refused and
changes nothing:

| Source status | Outcome | Row | Token |
|---|---|---|---|
| `PENDING` | cancelled | status, event, comment written | deleted |
| `ACTIVE` | `409 E_USER_ALREADY_ACTIVATED` | untouched | n/a (none exists) |
| `DEACTIVATED` | `409 E_USER_ALREADY_DEACTIVATED` | untouched | n/a |
| `CANCELLED` | `409 E_USER_CANCELLED_INVITATION` | untouched, including the first cancellation's date, actor, and comment | n/a |
| no such row | `404 E_USER_NOT_FOUND` | — | — |

## Invariants

1. **A cancelled user holds no activation token.** The status flip and the token deletion commit
   together or not at all (FR-005).
2. **A pending user holds at most one activation token**, and a cancellation that failed leaves it
   in place (US5-3). This holds because nothing is written until the guarded `UPDATE` succeeds, and
   the transaction rolls back on any later failure.
3. **One cancellation per withdrawal.** The guard `access_status = 'PENDING'` lets exactly one of
   two racing cancellations match. The loser sees `CANCELLED` and the winner's event is kept
   (FR-015).
4. **No token can be issued to a cancelled user.** This slice holds it for its own writes (D4).
   GH-8 and GH-9 must hold it for theirs by guarding on the `users` row (D5).
5. **A cancelled user cannot sign in.** `LoginUseCase` already refuses every non-active status with
   the invalid-credentials outcome (GH-3), and a cancelled user has no password anyway (FR-017).

## Repository contract

Added to `UserRepository` (`apps/api/app/users/shared/repositories/user_repository.ts`):

```text
CancelPendingInvitationCommand = {
  id: string
  cancelledByUserId: string
  cancelledAt: DateTime
  comment: string | null          // already normalized by the use case
}

CancelPendingInvitationResult =
  | { kind: 'CANCELLED'; user: User }                 // reloaded with every access-history actor
  | { kind: 'NOT_FOUND' }
  | { kind: 'NOT_PENDING'; accessStatus: UserAccessStatus }

abstract cancelPendingInvitation(command): Promise<CancelPendingInvitationResult>
```

The use case maps `NOT_FOUND` and each `NOT_PENDING` status to the exceptions in
[contracts/http-api.md](./contracts/http-api.md#refusals). The repository never chooses an
HTTP-aware exception (`apps/api/AGENTS.md`).

## Projection — `toAdministration`

One key added, gated like the rest of the access record:

| Key | Type | Present when | Value |
|---|---|---|---|
| `cancellationComment` | `string \| null` | `includeAccessHistory` (organization admins) | the stored comment |

`cancelledAt` and `cancelledBy` are already projected. For an operations admin the key is absent,
not `null`, and that viewer never receives a cancelled user in the first place (`listActive`). The
session projection `toObject()` is unchanged.

On the web, `UserDto` is inferred from the `users.index` route, so `cancellationComment` becomes
available with no hand-written type. `UserAccessHistory` shows it under the **Cancelled** event.
