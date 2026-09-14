# Data Model: Preserve the Last Active Organization Admin

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

**No schema change and no migration.** The slice reads two columns that GH-2 already delivered
(`users.access_status` and `users.role`) under a lock. It writes nothing that GH-20 does not
already write.

## Invariant

> At every commit, at least one row of `users` has `access_status = 'ACTIVE'` and
> `role = 'ORGANIZATION_ADMIN'`, as far as deactivation is concerned.

Deactivation preserves it inductively. Every committed deactivation has an actor who is an active
organization admin at the moment of the commit and is not the target (D1), so that actor is still
one right after it. A role change can still break the invariant until GH-29 guards it (spec
Dependencies).

## Who counts as an active organization admin

| `access_status` | `role` | Password renewal requirement | Counts |
|---|---|---|---|
| `ACTIVE` | `ORGANIZATION_ADMIN` | none or set | **yes** |
| `ACTIVE` | `OPERATIONS_ADMIN`, `OPERATIONS_LEAD`, `OBSERVER` | any | no |
| `PENDING`, `CANCELLED`, `DEACTIVATED` | any | any | no |

## The guarded write, extended

`LucidUserRepository.deactivateActive` keeps its single transaction and gains one step in front of
it:

1. **Lock** `users` rows `WHERE id IN (:actor, :target) ORDER BY id FOR NO KEY UPDATE`. One row when the
   target does not exist, and never the same id twice, because `SELF` is refused by the use case
   before this point.
2. **Decide on the actor**, from the row step 1 returned:
   - missing, not `ACTIVE`, or not `ORGANIZATION_ADMIN` → return `ACTOR_NOT_ENTITLED` and write
     nothing;
   - otherwise continue.
3. **Existing GH-20 behavior, unchanged**: `UPDATE … WHERE id = :target AND access_status = 'ACTIVE'`,
   the classification of a zero-row result into `NOT_FOUND` / `NOT_ACTIVE`, the deletion of the
   target's `remember_me_tokens`, and the reload with the access history.

### Result union

```ts
export type DeactivateUserResult =
  | { kind: 'DEACTIVATED'; user: User }
  | { kind: 'NOT_FOUND' }
  | { kind: 'NOT_ACTIVE'; accessStatus: UserAccessStatus }
  | { kind: 'ACTOR_NOT_ENTITLED' } // NEW — carries nothing: nothing about the target may leak (D3)
```

### Decision table

The actor's state is read under the lock. The target's state is the state at the same moment.

| Actor at the write | Target at the write | Result | Use case outcome |
|---|---|---|---|
| active organization admin | `ACTIVE` | `DEACTIVATED` | `200` |
| active organization admin | `PENDING` / `CANCELLED` / `DEACTIVATED` | `NOT_ACTIVE` | `409` with GH-20's reason |
| active organization admin | missing | `NOT_FOUND` | `404` |
| deactivated, demoted, or missing | anything, including missing | `ACTOR_NOT_ENTITLED` | `403 E_AUTHORIZATION_FAILURE` |

Rows 1 to 3 are GH-20's behavior (FR-007). Row 4 is the only addition.

## State transition

This is unchanged from GH-20: `ACTIVE → DEACTIVATED` on the target, writing `deactivated_at`,
`deactivated_by_user_id`, and `updated_at`, and deleting the target's `remember_me_tokens`. A
`ACTOR_NOT_ENTITLED` result writes no column and deletes no token, on either row (FR-003). The
locks are released at commit or rollback.

## Locks this slice takes, and what waits on them

| Concurrent writer on the same row | Waits? | Effect |
|---|---|---|
| Another deactivation sharing the actor or target | yes | Serialized in id order. The second one reads the first one's result (D2). |
| Role change (`changeRole`, single-row `UPDATE`) | yes | Committed first → seen by step 2. Queued behind → applies after commit. The guard on it is GH-29's. |
| Identity update (`findByIdForUpdate`) | yes | Brief, no cycle: it locks a single user row. |
| Password reset, invitation cancellation, or activation link renewal writing a `…_by_user_id` that points at a locked user | no | The foreign-key check takes `FOR KEY SHARE`, which `FOR NO KEY UPDATE` does not block. With `FOR UPDATE` it would deadlock against a reset of the actor (research D2). |
| Login inserting a `remember_me_tokens` row for either user | no | Same foreign-key check, same compatibility. |
| Plain reads, including the session middleware | no | Row locks do not block reads. |
