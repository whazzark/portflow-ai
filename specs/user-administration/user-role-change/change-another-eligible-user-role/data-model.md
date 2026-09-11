# Phase 1 — Data Model: Change Another Eligible User Role

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

No migration. No new table, no new column, no new index. The slice writes one existing column and
reads two.

---

## The `users` row, as this feature sees it

`apps/api/database/migrations/1783663779445_create_users_table.ts` is unchanged. Of its columns:

| Column | Role in this feature |
|---|---|
| `id` | Names the target. Read. |
| `role` | **The one column written.** One of `ORGANIZATION_ADMIN`, `OPERATIONS_ADMIN`, `OPERATIONS_LEAD`, `OBSERVER`. |
| `access_status` | Read as the eligibility guard. `PENDING`, `ACTIVE`, `CANCELLED` pass; `DEACTIVATED` refuses. Never written. |
| `updated_at` | Written by hand, because the query builder's `.update()` bypasses the model's `autoUpdate` hook. |
| `first_name`, `last_name`, `email`, `password` | Never read, never written (FR-005). |
| `invited_*`, `activated_*`, `cancelled_*`, `deactivated_*`, `reactivated_*` | Preloaded on the response re-read only, so the returned row carries the same access history `users.index` returns. Never written. |
| `password_renewal_required_at` | Never touched (FR-005, FR-010). |

There are no activation-link columns to invalidate (FR-017); the invitation slice that introduces
them inherits the obligation to reissue on a role change.

## Eligibility, as a table

`USER_ACCESS_STATUSES` × the role change command:

| Access status | Eligible | Outcome |
|---|---|---|
| `PENDING` | yes | Role changes; the user stays pending, and their invitation is untouched. |
| `ACTIVE` | yes | Role changes; the new role governs their next request, on every browser (FR-010). |
| `CANCELLED` | yes | Role changes; the user stays cancelled. |
| `DEACTIVATED` | no | `E_USER_DEACTIVATED_CANNOT_CHANGE_ROLE` (409). Reactivate first. |

The destination role is unconstrained: any of the four is reachable from any of the four, including
the one already held (FR-006). No pair of roles is refused by this feature — the refusals that depend
on *which* role is being left, and by whom, are GH-29's.

## State transitions

A role change is not a state transition of `access_status`, and it introduces none of its own. The
only transition it can be said to perform is `role: A → B`, with no intermediate state, no
precondition on `A`, and no record of `A` once `B` is written (FR-016).

## Repository contract

Added to `apps/api/app/users/shared/repositories/user_repository.ts`:

```text
ChangeUserRoleCommand = { userId: string, role: UserRole }

ChangeUserRoleResult =
  | { kind: 'CHANGED', user: User }     // reloaded with lifecycle actors preloaded
  | { kind: 'NOT_FOUND' }
  | { kind: 'DEACTIVATED' }

changeRole(command: ChangeUserRoleCommand): Promise<ChangeUserRoleResult>
```

The Lucid implementation guards the write rather than checking before it — see
[research.md](./research.md) D4. `CHANGED` is returned when the guarded statement affects one row,
which includes the case where the submitted role is the one already held.

The typed outcome is deliberately free of HTTP: the use case maps `NOT_FOUND` and `DEACTIVATED` onto
named exceptions, as `SuspendTruckUseCase` does for its three kinds.

## Exceptions

New, in `apps/api/app/users/shared/user_exceptions.ts`:

| Exception | Status | Code | Message |
|---|---|---|---|
| `UserNotFoundException` | 404 | `E_USER_NOT_FOUND` | `User not found` |
| `UserDeactivatedCannotChangeRoleException` | 409 | `E_USER_DEACTIVATED_CANNOT_CHANGE_ROLE` | `Deactivated users cannot have their role changed; reactivate the user first` |

The second follows `TruckArchivedCannotSuspendException` in both shape and message: a refusal names
the action that would unblock it, which is what FR-003 asks for.

## Projection

Unchanged. The response reuses `UserTransformer.toAdministration` with `includeAccessHistory: true` —
the projection GH-4 already defined for an organization admin, which is the only viewer that reaches
this endpoint. No new transformer variant, no change to `toObject()` and therefore none to the
`auth.me` and `auth.login` session contract.

## Web types

Unchanged in kind: `UserDto` is still `Route.Response<'users.index'>['data'][number]`. The mutation's
response is the same administration projection, so the workbench needs no second shape.
