# Phase 1 Data Model: Reset an Active User Password

**Feature**: `GH-17` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

One table changes. No table is created, and no row is ever deleted from `users` by this feature.

## `users` — two new columns

| Column | Type | Null | Default | Written by | Cleared by |
|---|---|---|---|---|---|
| `password_reset_at` | `timestamp` | yes | `NULL` | this feature | never |
| `password_reset_by_user_id` | FK → `users.id` | yes | `NULL` | this feature | never |

Existing rows get `NULL`, which is correct: no reset has ever been recorded.

`password_reset_by_user_id` is declared exactly like the five existing actor columns on this table —
a nullable `uuid` referencing `users.id` with `ON DELETE SET NULL` — so a reset survives the departure of the administrator who
performed it — the spec's edge case on a departed responsible administrator, and the behaviour
`UserAccessHistory` already renders for an unattributed event.

### Relationship to the column `#117` shipped

`password_renewal_required_at` is unchanged, keeps its meaning — *the requirement stands since this
moment* — and keeps its single clearing path, a completed renewal. This feature is one of its two
writers; `Reactivate a User with Fresh Credentials` (`#32`) will be the other.

The two new columns are this action's own **event**; `password_renewal_required_at` is the shared
**state**. A reset writes all three. A renewal clears only the state, so the event survives it.

```text
password_reset_at / _by_user_id   the reset happened, then, by them          — never cleared
password_renewal_required_at      the user still owes a renewal, since then  — cleared by renewal
```

### State transitions

| Before | Action | After |
|---|---|---|
| `ACTIVE`, requirement `NULL` | reset | requirement set, reset event recorded, every remembered connection deleted |
| `ACTIVE`, requirement already set | reset | requirement refreshed, reset event overwritten with the newer date and administrator, connections deleted again (FR-011) |
| `ACTIVE`, requirement set | renewal (`#117`) | requirement `NULL`, reset event untouched |
| `PENDING` / `DEACTIVATED` / `CANCELLED` | reset | refused, nothing written (FR-006) |
| any, target is the requester | reset | refused, nothing written (FR-007) |

Access status, role, identity, email, and every other lifecycle column are untouched by every branch
(FR-004).

## `remember_me_tokens` — rows deleted, schema unchanged

A successful reset deletes **every** row where `tokenable_id` is the target user, inside the same
transaction as the update (FR-004a). No row belonging to any other user is touched, and a refused or
failed reset deletes nothing (FR-013).

This differs from `renewPassword`, which spares the connection the renewal came from. Here the actor
is not the target, so there is no connection to spare.

## Model and factory

- `User` gains a `passwordResetBy` `belongsTo` relation on `password_reset_by_user_id`, beside the
  five self-referential lifecycle relations it already declares.
- `UserSchema` in `apps/api/database/schema.ts` gains the two columns. That file is generated —
  `pnpm --filter @portflow/api db:migrate` regenerates it; it is never hand-edited.
- `UserFactory` gains a `passwordReset` state: the `passwordRenewalRequired` state plus
  `passwordResetAt` and `passwordResetByUserId`. Following the existing note in that file, states
  repeat their assignments rather than composing, because the seeder applies exactly one state name.

## API projection

`UserTransformer` has three variants. The changes are confined to two of them.

### `toObject()` — the session representation

Unchanged. It keeps exposing only the derived `passwordRenewalRequired` boolean, and keeps refusing
to serialize `passwordRenewalRequiredAt`, for the reason already recorded there: the interface needs
one bit to choose a route, and the raw timestamp would say when an administrator acted. The two new
columns are **not** added here — the renewal screen has no use for them.

### `toAdministration()` — the user collection

Gains three keys, all gated on the existing `includeAccessHistory` option, so they are absent from an
operations admin's payload rather than null:

| Key | Source | Purpose |
|---|---|---|
| `passwordRenewalRequired` | `password_renewal_required_at !== null` | FR-019, FR-020 — the outstanding state, in the record and in the collection |
| `passwordResetAt` | `password_reset_at` | FR-003 — the dated event in the access history |
| `passwordResetBy` | `password_reset_by_user_id`, resolved to a summary | FR-003 — the responsible administrator |

Gating all three follows the rule `#4` established: the fact that an administrator acted on a user is
the same class of information as the identity of a responsible administrator, and an operations admin
may consult neither.

`password_reset_by_user_id` is preloaded by `UserRepository.list()` alongside the five actors it
already preloads, and stays unpreloaded in `listActive()`, which serves the viewers that receive no
actors at all.

### `toSummary()`

Unchanged — it is what a responsible administrator is rendered as, and it carries identity only.

## Web view model

`UserDto` is inferred from the `users.index` response, so the three new keys arrive with no manual
type. They are optional in the operations-admin case exactly as the existing lifecycle keys are, and
the web reads them uncast so that dropping one in the API projection breaks the build rather than
silently emptying the record.

The access history gains a sixth event, `{ key: 'password-reset', label: 'Password reset', at:
user.passwordResetAt, by: user.passwordResetBy }`, ordered chronologically with the others by the
existing sort. The outstanding requirement is presented separately from the history, because it is a
state rather than an event and its origin may be a reactivation once `#32` ships.

## Key entities → storage

| Spec entity | Where it lives |
|---|---|
| User | `users` row |
| Password Reset | `password_reset_at` + `password_reset_by_user_id` |
| Password Renewal Requirement | `password_renewal_required_at` (owned by `#117`) |
| Organization Admin | `users.role = 'ORGANIZATION_ADMIN'` |
| Remembered Connection | `remember_me_tokens` row |
| Operating Organization | implicit — ADR 0003 keeps the MVP single-organization, with no scope column |
