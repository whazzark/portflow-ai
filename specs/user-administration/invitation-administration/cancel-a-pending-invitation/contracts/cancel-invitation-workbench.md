# Workbench Contract: Cancel a Pending Invitation

**Feature**: `GH-12` | **Route**: `/users` (unchanged) | **Module**: `apps/web/src/features/users`

This slice adds no URL parameter and no route. The confirmation is transient: it opens from a
button, and a reload closes it without recording anything, like every other user access
confirmation. Everything the administrator can be halfway through is already in the URL (`status`,
`userId`, `mode`).

## Where the action is offered

`userAccessActions(viewer, user)` returns `'cancel-invitation'` exactly when:

- `viewer.role === 'ORGANIZATION_ADMIN'`, and
- `user.accessStatus === 'PENDING'`.

That single answer drives both entry points, so they cannot disagree (FR-012):

| Entry point | Element | Position |
|---|---|---|
| Record footer (`UserAccessActions`) | button `Cancel invitation`, `destructive` variant | right side, with the other access actions |
| Row menu (`UserRowActions`) | menu item `Cancel invitation`, `destructive` variant | last, after View / Edit |

The action is absent, not disabled, for every other viewer or status (FR-010, US2-3, US2-4). An
operations admin never sees a pending user at all.

## The confirmation

An `AlertDialog`, mounted only while open, as `UserAccessDialog` already is.

| Part | Content |
|---|---|
| Title | `Cancel invitation?` |
| Description | `“<First Last>” will no longer be able to activate their access. The activation link they were given stops working immediately.` |
| Field | `Comment (optional)`, a `Textarea` with `maxLength={1000}` and the shared lifecycle comment description |
| Dismiss | `Keep invitation` (the `AlertDialogCancel`) |
| Confirm | `Cancel invitation`; shows `Cancelling…` and is disabled while the request is pending |

No two buttons start with "Cancel" (FR-011a). Dismissing, with `Keep invitation`, Escape, or the
overlay, records nothing and discards the typed comment (US4-2).

The deactivation confirmation keeps its current title, description, `Cancel` dismiss, and no
comment field. Only the per-action tables grow.

## Request

`cancelInvitation.mutateAsync({ params: { id }, body: { comment: comment || null } })`, sent through
`useUserMutations().cancelInvitation`. The mutation invalidates the users collection on success
**and** on error, like `deactivate`.

## Outcomes

| Outcome | Dialog | Feedback | Workbench |
|---|---|---|---|
| `200` | closes | success toast `Invitation for “<name>” cancelled` | stays on the current view. The refreshed collection drops the user from Pending and adds them to Cancelled, both counts update, and the open record closes because its user left the visible view (FR-013). No navigation. |
| `409` / `404` refusal | stays open* | error toast `Unable to cancel invitation for “<name>”`, with the per-code sentence from [http-api.md](./http-api.md#refusals) as its description | the collection refreshes to the server's state |
| `422` | stays open, comment kept | same error title; the field-level message as description | unchanged |
| network / `5xx` | stays open, comment kept, confirm re-enabled | same error title; the API or network message | unchanged, and retry is possible (US5-3/4) |

\* When the refusal means the user already left the pending view, for example because another
administrator cancelled them first, the refreshed collection retires the open record, and the
footer's dialog unmounts with it. The toast outlives both. This is the documented `UserAccessDialog`
behavior. A row menu's dialog stays open either way.

## Access history

`UserAccessHistory` keeps its oldest-first list. The **Cancelled** entry gains one line, the comment
as written, shown only when `cancellationComment` is a non-empty string:

```text
Cancelled
11 Sep 2026, 14:03
by Sam Leroy
“Hired elsewhere before starting.”
```

The history is already absent for viewers without access history, and the comment key is too.

## View-specific columns

Only the fourth column of the collection varies by view. It holds the password renewal indicator
where a password can exist, and what the administrator needs instead where it cannot:

| View | Fourth column | Content |
|---|---|---|
| Active | `Password` | renewal indicator (unchanged) |
| Pending | `Invited` | invitation date (`formatDateTime`), then `by <inviting admin>` beneath it; the date alone without a recorded admin (FR-014b) |
| Deactivated | `Password` | renewal indicator (unchanged) |
| Cancelled | `Comment` | `cancellationComment` on one line, the full text as `title`; blank when there is none (FR-014a) |

The mapping is `COLUMNS_BY_VIEW` in `ui/user-table.tsx`, with stable column arrays per view. No
link expiry is derived from the invitation date, because a renewed link (GH-9) outlives the
invitation.

## Copy home

All wording lives in `helpers/user-access-copy.ts`, keyed by `UserAccessAction`, with the sentence
shapes of `helpers/resource-copy`. The refusal table becomes `Record<UserAccessAction,
Record<code, sentence>>`, because one code can mean different things for deactivation and
cancellation (research D11). An unmapped code still falls back to the API's message.

## Test seams

Feature tests, rendered through the real router with MSW handlers for
`POST /api/v1/users/:id/cancel-invitation`, under
`apps/web/src/features/users/__tests__/cancel-invitation/`:

| File | Proves |
|---|---|
| `permissions.test.tsx` | offered to an organization admin on a pending user, in the footer and the row menu; absent on active, deactivated, and cancelled users; absent for an operations admin |
| `confirmation.test.tsx` | title, description naming the user, `Comment (optional)` field, `Keep invitation` / `Cancel invitation` labels; dismissing sends nothing; the confirm button is disabled while pending |
| `journey.test.tsx` | success toast, record closed, pending view kept, both counts updated, user listed in Cancelled, and the history showing the cancellation with its actor and comment; the request body carries the typed comment, or `null` when the field is empty (trimming is the API's job) |
| `refusals.test.tsx` | each `409`/`404` sentence; the collection refreshed after a refusal; the `422` field message with the comment kept |
| `recovery.test.tsx` | a network failure keeps the dialog and comment, and a retry succeeds |
| `row-menu.test.tsx` | the same confirmation and outcome from the row menu, and its dialog kept open on a refusal |

Deactivation's existing tests must pass unchanged. They pin the deactivation copy the per-action
tables must preserve.
