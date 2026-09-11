# Phase 1 — Data Model: Remove a Never-Activated User Permanently

**Feature**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

No migration. The slice deletes rows; it adds, alters, and drops no column, table, or index.

## Eligibility

Read from `users.access_status` at the moment the statement runs (FR-005), never from what the
workbench displayed.

| `access_status` | Removable | Outcome |
|---|---|---|
| `PENDING` | yes | `REMOVED` |
| `CANCELLED` | yes | `REMOVED` |
| `ACTIVE` | no | `NOT_REMOVABLE` → 409 `E_USER_ACTIVE_CANNOT_BE_REMOVED` |
| `DEACTIVATED` | no | `NOT_REMOVABLE` → 409 `E_USER_DEACTIVATED_CANNOT_BE_REMOVED` |
| no row | — | `NOT_FOUND` → 404 `E_USER_NOT_FOUND` |

A removable user named by a `RESTRICT` reference is refused whatever its status: `REFERENCED` → 409
`E_USER_REFERENCED_CANNOT_BE_REMOVED` (FR-011).

## What one removal deletes

| Row | How | Requirement |
|---|---|---|
| `users` — the target | the guarded `DELETE` | FR-001, FR-006 |
| `user_activation_tokens` — the target's link digest, if any | `ON DELETE CASCADE`, same statement | FR-007 |
| `remember_me_tokens` — the target's, if any | `ON DELETE CASCADE`, same statement; none exist for a user who never signed in | — |

Nothing else is written. In particular:

- `users_email_unique` (`LOWER(email)`) no longer holds the removed email, so a later invitation of
  it — any casing, any padding the invitation normalizes away — is a new user (FR-008);
- no `SET NULL` reference fires, because a never-activated user is never recorded as the actor of a
  lifecycle event or an archival ([research.md](./research.md) D5), which is what keeps FR-010 true;
- no trace row, column, or log entry records the removal (FR-012).

## Repository operation

Declared on `UserRepository`, implemented by `LucidUserRepository`, following ADR 0013's naming.

```ts
export type RemoveUserCommand = {
  id: string
}

export type RemoveUserResult =
  | { kind: 'REMOVED' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'NOT_REMOVABLE'; accessStatus: UserAccessStatus }
  | { kind: 'REFERENCED' }

abstract removeNeverActivated(command: RemoveUserCommand): Promise<RemoveUserResult>
```

| Outcome | Produced when |
|---|---|
| `REMOVED` | the guarded `DELETE` affected one row |
| `NOT_FOUND` | zero rows, and the re-read finds no user |
| `NOT_REMOVABLE` | zero rows, and the re-read finds the user in `ACTIVE` or `DEACTIVATED` — the status observed is carried so the use case can pick the reason |
| `REFERENCED` | the `DELETE` raised a foreign-key violation |

`REMOVED` carries no user: there is nothing left to project, and FR-012 keeps no copy.

`NOT_REMOVABLE` is typed with the full `UserAccessStatus` because the re-read returns whatever the
row holds, but it cannot carry `PENDING` or `CANCELLED`: no transition leads back to either from
`ACTIVE` or `DEACTIVATED`. The use case maps `DEACTIVATED` to the deactivated refusal and every other
status to the active one, so the unreachable branch still answers with a refusal rather than a 500.

## State transitions

None. Removal is not a transition of `User Access Status`: the user ceases to exist, and no
`REMOVED` status is introduced (`CONTEXT.md`, Pending User Removal).

```text
PENDING ──┐
          ├── removal ──▶ (no user)
CANCELLED ┘

ACTIVE, DEACTIVATED ── removal ──▶ refused, unchanged
```
