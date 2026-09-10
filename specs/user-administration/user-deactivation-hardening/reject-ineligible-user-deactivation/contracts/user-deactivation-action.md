# Contract: The deactivation action in the user workbench

**Feature**: [spec.md](../spec.md) · **Route**: `/users` (existing) · **Module**:
`apps/web/src/features/users`

The workbench's first write. It adds no route, no URL parameter, and no new read: the action lives
in the access record already opened from the collection `users.index` returns.

## Where it appears

In the access record's footer, as a single destructive button labelled **`Deactivate`** — the action
alone, because the panel it sits in already names the user.

It is rendered when, and only when, all three hold:

| Condition | Why |
|---|---|
| the viewer's role is `ORGANIZATION_ADMIN` | the only role entitled to deactivate (FR-015) |
| the record's `accessStatus` is `ACTIVE` | the only eligible status (FR-003) |
| the record is not the viewer's own | an administrator does not retire their own access (FR-009, D10) |

An operations admin never meets it: their payload carries active users only and no lifecycle block
at all. The API stays authoritative in every case — hiding the button is honesty, not enforcement
(FR-014).

## The confirmation

An `AlertDialog`, opened by the button, with:

- **Title** — `Deactivate user?`
- **Description** — names the user and states what the transition means: they can no longer sign in,
  and everything they already did stays visible and attributed to them.
- **No comment field.** A `User Access Status Change` records a date and an actor; the `users` table
  has no column for a comment and this action captures none.
- **Cancel** and a confirm action reading `Deactivate`, or `Deactivating…` while in flight.

A refusal keeps the dialog open so the administrator can read the reason in place; a success closes
it.

## Outcomes

| Result | What the administrator sees |
|---|---|
| success | The dialog closes. A success toast names the user: `User “Thomas Bernard” deactivated`. |
| `E_USER_SELF_DEACTIVATION` | Refusal toast: another organization admin must do it. |
| `E_USER_PENDING_INVITATION` | Refusal toast pointing at invitation cancellation as the right action. |
| `E_USER_CANCELLED_INVITATION` | Refusal toast: the invitation was already withdrawn. |
| `E_USER_ALREADY_DEACTIVATED` | Refusal toast: someone else got there first. |
| `E_USER_NOT_FOUND` | Refusal toast: the user no longer exists. |
| `401` | The session ended; handled by the application's existing unauthorized path. |
| network / unknown | Retryable failure toast from `parseApiError`'s network sentence. |

Every toast is built from `helpers/resource-copy` — `refusalTitle` for a refusal,
`confirmationMessage` for a success — so a refused deactivation reads like every other refused write
in the product. The users feature brings the noun `user` and the participle `deactivated`; it does
not bring its own sentence shapes.

## After a success

One invalidation of `userQueries.list()`, and the workbench does the rest from the collection it
re-reads:

1. the user leaves the `Active` view and appears in `Deactivated`;
2. both tab counts follow;
3. the open record closes, because the workbench already drops a `userId` naming no visible user
   from the URL — the established rule, not a new one (FR-016, D9);
4. the access record, reopened from the `Deactivated` view, now shows `Deactivated at` and
   `Deactivated by` in its history.

No manual reload, and no page navigation.

## After a refusal

The collection is invalidated too. A refusal usually means the record's authoritative state moved on
since the view loaded, so the administrator reads the reason against a refreshed workbench rather
than the stale one that produced the attempt.

## Not in this contract

No bulk selection, no per-row action menu, no reactivation control, and no change to the URL schema
of `/users`. Reactivation is GH-32 and will add a second key to the same copy module and a second
button to the same footer.
