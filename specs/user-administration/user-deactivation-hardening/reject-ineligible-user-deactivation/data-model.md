# Phase 1 Data Model: Reject Ineligible User Deactivation

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-10

**No migration.** Every column this feature writes was delivered by GH-2 and is already read by
`GET /api/v1/users`. This document fixes the one state transition, what it writes, what it must
leave alone, and the typed outcomes the layers exchange.

## The transition

```text
                    deactivate (this feature)
        ACTIVE ─────────────────────────────────▶ DEACTIVATED
          ▲                                            │
          │            reactivate (GH-32, not here)    │
          └────────────────────────────────────────────┘

  PENDING ──── refused: PENDING_INVITATION
CANCELLED ──── refused: CANCELLED_INVITATION
DEACTIVATED ── refused: ALREADY_DEACTIVATED
```

`ACTIVE → DEACTIVATED` is the only transition this slice performs, and the only one it may perform.
The reverse arrow belongs to GH-32; `PENDING → CANCELLED` and the removal of a pending user are
already delivered elsewhere and are not reachable from this command.

## `users` — what one deactivation writes

| Column | Before | After | Note |
|---|---|---|---|
| `access_status` | `ACTIVE` | `DEACTIVATED` | The guard of the conditional write, not just its payload (D3). |
| `deactivated_at` | any | the request's timestamp | Overwrites a value left by an earlier deactivate/reactivate cycle. |
| `deactivated_by_user_id` | any | the acting admin's id | The `User Access Status Change` actor. Never null on this path: the command has no unattributed route. |
| `updated_at` | — | the request's timestamp | Written by hand: the query builder's `.update()` bypasses the model's `autoUpdate` hook, as every other guarded write in this codebase does. |

**Untouched, and asserted so**: `id`, `first_name`, `last_name`, `email`, `password`, `role`,
`invited_at`, `invited_by_user_id`, `activated_at`, `activated_by_user_id`, `cancelled_at`,
`cancelled_by_user_id`, `reactivated_at`, `reactivated_by_user_id`, `created_at`, and
`password_renewal_required_at` (FR-011, FR-012).

`reactivated_at` is deliberately **not** cleared. It is the record of an event that did happen, and
the workbench's access history renders every recorded event in order; erasing it would rewrite
history to make the current status look tidier.

## `remember_me_tokens` — what one deactivation deletes

Every row whose `tokenable_id` is the deactivated user, inside the same transaction, reached only on
a successful deactivation (D4). Nothing else in the table is touched, and a refused deactivation
deletes nothing.

The deleted rows are the only durable credential a deactivated user could still present. The session
itself lives in the client's cookie — `config/session.ts` uses the cookie store — so there is no
server-side session row to delete; `auth_middleware.ts` re-reads the user on every request and
refuses a non-`ACTIVE` one, which is what ends a live session.

## Typed outcomes between the layers

```text
DeactivateUserResult =
  | { kind: 'DEACTIVATED'; user: User }
  | { kind: 'NOT_FOUND' }
  | { kind: 'NOT_ACTIVE'; accessStatus: 'PENDING' | 'CANCELLED' | 'DEACTIVATED' }
```

The repository reports what it observed and never selects an exception (`apps/api/AGENTS.md`).
`DeactivateUserUseCase` maps the outcome:

| Outcome | Use case result |
|---|---|
| `DEACTIVATED` | returns the updated `User` |
| `NOT_FOUND` | `UserNotFoundException` |
| `NOT_ACTIVE` + `PENDING` | `UserPendingInvitationException` |
| `NOT_ACTIVE` + `CANCELLED` | `UserCancelledInvitationException` |
| `NOT_ACTIVE` + `DEACTIVATED` | `UserAlreadyDeactivatedException` |

The `SELF` rule is decided before the repository is called at all — it needs no read of the target
beyond its identifier — and raises `SelfDeactivationException`.

## Contracts across the seam

API ADR-0013 fixes the suffixes, and keeps the two types separate even though their fields currently
coincide — the application and repository interfaces evolve independently.

```text
// Use case input
DeactivateUserInput = {
  id: string                    // the target, already validated as a UUID by the controller
  deactivatedByUserId: string   // the authenticated organization admin
  deactivatedAt: DateTime       // taken once, in the controller, like every sibling lifecycle write
}

// Repository command
DeactivateUserCommand = {
  id: string
  deactivatedByUserId: string
  deactivatedAt: DateTime
}
```

## Read projection

Unchanged. The endpoint returns the deactivated user through the existing
`UserTransformer.toAdministration()` variant with `includeAccessHistory: true`, which is the shape
`GET /api/v1/users` already serves to an organization admin — identity block plus every `*At` and
its resolved `*By` summary. `deactivatedBy` therefore arrives as an `{ id, firstName, lastName }`
projection of the acting administrator, which requires the relation to be loaded on the returned
row.

`password`, `password_renewal_required_at`, remembered-connection data, and session tokens are not
in that projection and must not be added to it.

## Entity vocabulary

The spec's key entities map onto existing structures; this feature introduces no new persisted
entity.

| Spec entity | Where it lives |
|---|---|
| User | `users` row / `User` model |
| User Access Status Change | the `deactivated_at` + `deactivated_by_user_id` pair on that row |
| Deactivation Blocker | the exception's `error.code` on the wire (D2) |
| Organization Admin | `role = 'ORGANIZATION_ADMIN'` with `access_status = 'ACTIVE'` |
