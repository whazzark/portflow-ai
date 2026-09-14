# Phase 1 Data Model: Reactivate a User with Fresh Credentials

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-11

**No migration.** Every column this feature writes already exists. `reactivated_at` and
`reactivated_by_user_id` were delivered by GH-2 with the users table and are already projected by
`GET /api/v1/users`. `password_renewal_required_at` was delivered by `#117`. This document fixes the
one state transition, what it writes and deletes, the one new session key, and the typed outcomes
the layers exchange.

## The transition

```text
                  deactivate (#20, delivered)
        ACTIVE ─────────────────────────────────▶ DEACTIVATED
          ▲                                            │
          │          reactivate (this feature)         │
          └────────────────────────────────────────────┘
             + password renewal requirement recorded
             + remembered connections revoked
             + earlier sessions stop counting

    PENDING ──── refused: PENDING_INVITATION   (renew the activation link instead)
  CANCELLED ──── refused: CANCELLED_INVITATION (restore the invitation instead)
     ACTIVE ──── refused: ALREADY_ACTIVE
```

`DEACTIVATED → ACTIVE` is the only transition this slice performs. It is the only route out of
`DEACTIVATED` in the product.

## `users`: what one reactivation writes

All in one guarded `UPDATE … WHERE id = :id AND access_status = 'DEACTIVATED'` (research D3, D4).

| Column | Before | After | Note |
|---|---|---|---|
| `access_status` | `DEACTIVATED` | `ACTIVE` | The guard of the write, not only its payload. |
| `reactivated_at` | any | the request's timestamp | The User Access Status Change date. Also the session marker's reference value (D5), which is why nothing else may write it. |
| `reactivated_by_user_id` | any | the acting admin's id | Never null on this path: the command has no unattributed route. |
| `password_renewal_required_at` | any | the request's timestamp | The requirement `#117` enforces. Set whether or not a reset had already set it: one state, never a queue (FR-010). |
| `updated_at` | — | the request's timestamp | Written by hand: the query builder's `.update()` bypasses the model's `autoUpdate` hook, as in every guarded write here. |

**Untouched, and asserted so**: `id`, `first_name`, `last_name`, `email`, `password`, `role`,
`invited_at`, `invited_by_user_id`, `activated_at`, `activated_by_user_id`, `cancelled_at`,
`cancelled_by_user_id`, `cancellation_comment`, `deactivated_at`, `deactivated_by_user_id`,
`password_reset_at`, `password_reset_by_user_id`, `activation_link_renewed_at`,
`activation_link_renewed_by_user_id`, `created_at` (FR-011, FR-012).

`deactivated_at` / `deactivated_by_user_id` are deliberately **not** cleared, for the reason the
deactivation's data model gave for keeping `reactivated_*`: they record an event that happened. The
access history lists every recorded event in order, so after a reactivation it shows the deactivation
and then the reactivation.

A second cycle overwrites each event's pair with the latest occurrence. This is the foundation's rule
("keep the latest useful dates and actors on the user"), and it is also why the history can place
the latest deactivation after the latest reactivation.

## `remember_me_tokens`: what one reactivation deletes

Every row whose `tokenable_id` is the reactivated user, inside the same transaction, reached only on
a successful reactivation (D4). Normally there are none left, because `deactivateActive` already
deleted them and a deactivated user can't create one. The delete guarantees it whatever the history,
and D5's handling of restoration depends on it. Nobody else's rows are touched. A refusal deletes
nothing.

## The session: one new key

The session lives in the client's encrypted cookie (API ADR-0001). It gains one key.

| Key | Value | Written | Read |
|---|---|---|---|
| `user_reactivated_at` | the user's `reactivated_at` as epoch milliseconds when the session was opened, or `null` if they had never been reactivated | at login, at invitation acceptance, and when a session is restored from a remembered connection | on every authenticated request, by `authenticateOpenSession` |

**Rule** (research D5): a session whose stored value differs from the user's current
`reactivated_at` is not an open session. It is forgotten (`auth_web` and this key) and the request
is refused `401 E_UNAUTHORIZED_ACCESS`. A missing key reads as `null`.

| Session | User's `reactivated_at` | Outcome |
|---|---|---|
| no key (every session opened before this feature) | `null` (never reactivated) | accepted, unchanged behaviour |
| no key | set | **refused**: the session predates the reactivation |
| `null` | set | **refused**: opened before the user's first reactivation |
| `R1` | `R2 ≠ R1` | **refused**: opened in an earlier active period |
| `R` | `R` | accepted |

The key sits beside the existing `remembered_connection_expires_at`, and like it, it is part of what
makes a session count. Neither is business data, and neither is ever serialized.

## Typed outcomes between the layers

```text
ReactivateUserResult =
  | { kind: 'REACTIVATED'; user: User }
  | { kind: 'NOT_FOUND' }
  | { kind: 'NOT_DEACTIVATED'; accessStatus: 'PENDING' | 'ACTIVE' | 'CANCELLED' }
```

The repository reports what it observed and never selects an exception (API ADR-0013).
`ReactivateUserUseCase` maps it:

| Outcome | Use case result |
|---|---|
| `REACTIVATED` | returns the updated `User`, access history preloaded |
| `NOT_FOUND` | `UserNotFoundException` |
| `NOT_DEACTIVATED` + `PENDING` | `UserPendingInvitationException`, message naming activation link renewal |
| `NOT_DEACTIVATED` + `CANCELLED` | `UserCancelledInvitationException`, message naming invitation restoration |
| `NOT_DEACTIVATED` + `ACTIVE` | `UserAlreadyActiveException` |

## Contracts across the seam

```text
// Use case input
ReactivateUserInput = {
  id: string                    // the target, already validated as a UUID by the controller
  reactivatedByUserId: string   // the authenticated organization admin
  reactivatedAt: DateTime       // taken once, in the controller, like every sibling lifecycle write
}

// Repository command: separate type, same fields today (ADR-0013)
ReactivateUserCommand = {
  id: string
  reactivatedByUserId: string
  reactivatedAt: DateTime
}
```

## Read projection

Unchanged. The response is `UserTransformer.toAdministration()` with `includeAccessHistory: true`,
the shape `GET /api/v1/users` serves an organization admin. After a reactivation it carries
`accessStatus: 'ACTIVE'`, `reactivatedAt`, `reactivatedBy` as a resolved actor summary (the relation
is already in `preloadAccessHistory`), the untouched `deactivatedAt` / `deactivatedBy`, and
`passwordRenewalRequired: true`.

`password`, `password_renewal_required_at`, remembered-connection data, and the session marker are
not in any projection and must not be added (FR-013).

## Entity vocabulary

This feature introduces no new persisted entity and no new domain term.

| Spec entity | Where it lives |
|---|---|
| User | `users` row / `User` model |
| User Reactivation | the command behind `POST /api/v1/users/:id/reactivate` |
| User Access Status Change | the `reactivated_at` + `reactivated_by_user_id` pair |
| Password Renewal Requirement | `password_renewal_required_at IS NOT NULL` |
| Reactivation Blocker | the exception's `error.code` on the wire |
| Remembered Connection | `remember_me_tokens` rows |
| Organization Admin | `role = 'ORGANIZATION_ADMIN'` with `access_status = 'ACTIVE'` |
