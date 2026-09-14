# Contract: The reactivation action in the user workbench

**Feature**: [spec.md](../spec.md) · **Route**: `/users` (existing) · **Module**:
`apps/web/src/features/users`

A fourth access action beside deactivation, invitation cancellation, and removal. It adds no route,
no URL parameter, and no new read. It lives in the access record and the row menu the workbench
already renders from `users.index`.

## Where it appears

A button labelled **`Reactivate`** in the access record's footer, and an item labelled
**`Reactivate`** in the user's row menu. It is the action alone, because both sit next to the user's
name. Both come from the same `userAccessActions(viewer, user)` answer, so they never disagree
(FR-019).

It is offered when, and only when:

| Condition | Why |
|---|---|
| the viewer's role is `ORGANIZATION_ADMIN` | the only role entitled to reactivate (FR-001) |
| the user's `accessStatus` is `DEACTIVATED` | the only eligible status (FR-003) |

In practice this means the **Deactivated** view. Pending, cancelled, and active users never offer it
(FR-019). An operations admin never meets it: their payload holds active users only. Its button
variant is `default`, not `destructive`, because it restores access and removes nothing. In the row
menu it is the last item, where the access actions sit.

The API stays authoritative in every case. Hiding the action is a courtesy to the administrator,
not the enforcement (FR-018).

## The confirmation

The shared `UserAccessDialog`, opened with `action: 'reactivate'`:

- **Title**: `Reactivate user?`
- **Description**: names the user and states both halves of the consequence (FR-020): they can sign
  in again with the password they held before, and must choose a new password before using the
  application.
- **No comment field.** A User Access Status Change records a date and an actor.
- **`Cancel`**, and a confirm action reading `Reactivate`, or `Reactivating…` while in flight. It is
  disabled while in flight, which prevents a duplicate submission (FR-021).

Cancelling records nothing (FR-020). A refusal keeps the dialog open to read the reason in place,
unless the refreshed collection has already moved the user out of the view (see below). A success
closes it.

## Outcomes

Every toast is built from `helpers/resource-copy` through the `reactivate` keys of
`helpers/user-access-copy.ts`.

| Result | What the administrator sees |
|---|---|
| success | The dialog closes. Toast: `User “Thomas Bernard” reactivated`. |
| `E_USER_ALREADY_ACTIVE` | Refusal toast: this user is already active; someone else may have reactivated them. |
| `E_USER_PENDING_INVITATION` | Refusal toast: this user never activated their access; renew their activation link instead. |
| `E_USER_CANCELLED_INVITATION` | Refusal toast: this user's invitation was withdrawn before activation; restore it instead. |
| `E_USER_NOT_FOUND` | Refusal toast: this user no longer exists. |
| `401` | The session ended; handled by the application's existing unauthorized path. |
| network / unknown | Retryable failure toast from `parseApiError`'s network sentence. Nothing changed. |

Each refusal reads distinctly from a transient failure and from an authorization refusal (FR-017).

## After a success

One invalidation of `userQueries.list()`, and the workbench does the rest from the collection it
re-reads (FR-022):

1. the user leaves the **Deactivated** view and appears in **Active**;
2. both tab counts follow;
3. the open record closes, because the workbench already drops a `userId` naming no visible user
   from the URL. This is the established rule, not a new one;
4. in the **Active** view, the user's **Password** column reads `Renewal required`, so the
   outstanding renewal is visible without opening them;
5. reopened, their access history shows `Deactivated` and then `Reactivated`, each with its date and
   administrator, and the record's Password line reads `Renewal required`.

No manual reload and no navigation.

## After a refusal

The collection is invalidated too (research D10). The commonest refusal, `E_USER_ALREADY_ACTIVE`,
means the user has already moved to **Active**. The refreshed view drops them, the record or row
menu unmounts with its dialog, and the reason arrives as a toast, which outlives both. The same
behaviour and reasoning apply to a deactivation someone else got to first.

## Not in this contract

No bulk selection, no comment, no credential or link handed to the administrator, and no change to
the URL schema of `/users`.
