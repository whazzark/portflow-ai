# Data Model — Protect Self-Role Changes and the Final Organization Admin

**Feature**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

**No schema change.** No migration, no new column, no new table. The rules read two columns of
`users` that GH-28 already reads, and write only the one it already writes.

## Columns involved

| Column | Read | Written | Role in this feature |
|---|---|---|---|
| `users.id` | ✓ | — | Names the target; compared, lower-cased, with the requester's id (self rule); orders the lock acquisition (research D3). |
| `users.role` | ✓ | ✓ (GH-28, unchanged) | Defines who counts as an organization admin; the column a role change writes. |
| `users.access_status` | ✓ | — | Defines who counts as *active*; still refuses a deactivated target (GH-28). |
| `users.updated_at` | — | ✓ (GH-28, unchanged) | Bookkeeping, written by hand by the query-builder `UPDATE`. |

Nothing else about any user is read or written. A refusal writes nothing, on the target or on anyone
else (FR-009), and no row records a refusal or a change (GH-28 FR-016).

## The invariant

> **At every commit, the organization has at least one user with `role = 'ORGANIZATION_ADMIN'` and
> `access_status = 'ACTIVE'`.**

- An **active organization admin** is a row matching both conditions. Pending, cancelled, and
  deactivated organization admins do not count: they hold no session and administer nobody.
- This slice guarantees the invariant against **role changes**, including role changes applied at the
  same moment and role changes applied after a deactivation. GH-21 guarantees it against
  **deactivations**. Once both are in, no mix of the two can break it.
- **Nothing else can reduce the count.** Invitation creates pending users. Acceptance activates a
  user, which adds an admin if the invited role was organization admin. Cancellation and removal
  apply to users who were never activated. Identity update and password reset do not change role or
  status. Reactivation (GH-32) adds an admin.

## Decision table — role change on a target `T` requested by `R`

Evaluated in this order. `R` has already been authorized as an active organization admin when the
request was received (GH-28's `UserPolicy.changeRole`, unchanged).

| # | Condition | Decided where | Outcome |
|---|---|---|---|
| 1 | `lower(T.id) = lower(R.id)` | use case, before any read | refused — self role change |
| 2 | no row with id `T` | repository, under lock | refused — not found (GH-28) |
| 3 | `T.access_status = 'DEACTIVATED'` | repository, under lock | refused — deactivated (GH-28) |
| 4 | `T` is an active organization admin, the submitted role ≠ `ORGANIZATION_ADMIN`, and no **other** active organization admin was locked | repository, under lock | refused — last active organization admin |
| 5 | otherwise | repository, under lock | role written, user returned (GH-28) |

Consequences the tests pin down:

- Assigning `ORGANIZATION_ADMIN` is never refused by row 4 — neither a promotion nor the no-op on a
  user who already holds it.
- A pending or cancelled organization admin never triggers row 4, because they are not active.
- An active user who is not an organization admin never triggers row 4.
- A self request is refused by row 1 even when it submits the role already held. GH-28's
  unchanged-success rule is reached only for other users.

## The locked scope

The repository's single locking read (research D3, D4):

| Aspect | Value |
|---|---|
| Rows | the target, plus every row that is an active organization admin |
| Order | `ORDER BY id` — the same for every caller, so no two role changes can deadlock |
| Strength | `FOR NO KEY UPDATE` on PostgreSQL; nothing on SQLite, which serializes writers |
| Held | until the role change's transaction commits or rolls back |
| Re-evaluation | PostgreSQL re-checks the `WHERE` of any row it waited for, so a row that stopped being an active admin in the meantime is not counted |

**Known limit** (research D5): a user promoted to organization admin in a transaction that commits
while this read is waiting is not counted, so a demotion can be refused in a window where, a moment
later, it would be allowed. It errs towards refusing, and a retry succeeds.

## Typed outcomes

### `ChangeUserRoleInput` (use case) — extended

```ts
type ChangeUserRoleInput = {
  userId: string
  role: UserRole
  /** The organization admin asking — the session's user. Never the target (row 1). */
  requestedByUserId: string
}
```

### `ChangeUserRoleCommand` (repository) — unchanged

`{ userId, role }`. The repository does not need the requester: row 1 is decided before it is
called, and row 4 counts admins other than the *target*.

### `ChangeUserRoleResult` (repository) — one kind added

```ts
type ChangeUserRoleResult =
  | { kind: 'CHANGED'; user: User }
  | { kind: 'NOT_FOUND' }
  | { kind: 'DEACTIVATED' }
  | { kind: 'LAST_ACTIVE_ORGANIZATION_ADMIN' }   // NEW — row 4
```

As with the other kinds, this reports what the locked write observed, not what the caller is told.

### Exceptions — two added to `app/users/shared/user_exceptions.ts`

| Class | Status | Code | Message |
|---|---|---|---|
| `SelfRoleChangeException` | 409 | `E_USER_SELF_ROLE_CHANGE` | Your own role can only be changed by another organization admin |
| `LastActiveOrganizationAdminException` | 409 | `E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN` | The organization must keep at least one active organization admin |

The second is worded about the rule, not about role changes, so GH-21 can throw it from deactivation
unchanged (research D7).

## Web types

No DTO changes. `UserDto` and `SessionUser` are untouched; the two new codes arrive through the
existing `{ error: { code, message } }` envelope that `parseApiError` already reads.
