# Workbench contract: Restore a cancelled invitation

**Surface**: `apps/web/src/features/users` · **Endpoint**: [http-api.md](./http-api.md)

## Offer rule

`canRestoreInvitation(viewer, user)` in `helpers/user-permissions.ts`:

```ts
viewer.role === 'ORGANIZATION_ADMIN' && user.accessStatus === 'CANCELLED'
```

No self rule: a viewer is active, so never cancelled. It mirrors the API rule and is not a security
boundary (FR-014). Absent rather than disabled when it does not apply.

| Viewer | Target | Record footer | Row menu |
|---|---|---|---|
| organization admin | cancelled | **Restore invitation** | **Restore invitation** |
| organization admin | pending, active, deactivated | — | — |
| operations admin, lead, observer | any | — | — (cancelled users are not listed to them) |

## Entry points

- **Record footer** (`ui/user-access-actions.tsx`): an outline button **Restore invitation**, beside
  **Renew activation link**, before the status actions. `ui/user-access-record.tsx` asks
  `canRestoreInvitation` and passes `mayRestoreInvitation`, as it does `mayRenewActivationLink`.
- **Row menu** (`ui/user-row-actions.tsx`): the item **Restore invitation** after **Edit** and before
  **Remove**, which stays last because it is destructive. On a cancelled row the menu reads View,
  Edit, Restore invitation, Remove.

Both mount the same `RestoreInvitationDialog`, only while open (FR-015).

## Confirmation — `ui/restore-invitation-dialog.tsx`

| Element | Content |
|---|---|
| Title | **Restore invitation?** |
| Description | {First Last}'s invitation will be pending again. A new activation link, valid for 7 days, will be shown once for you to pass on. Any link they were given before stays unusable. |
| Field | the lifecycle comment field: `LIFECYCLE_COMMENT_LABEL`, `LIFECYCLE_COMMENT_DESCRIPTION`, `maxLength={1000}`, frozen while in flight |
| Dismiss | **Cancel** — disabled while in flight |
| Confirm | **Restore invitation**, then **Restoring…** while in flight, disabled |

- Dismissing (Cancel, Escape, outside click) before submission unmounts the dialog, which discards
  the comment and sends nothing (US4-4).
- Once submitted, nothing dismisses it until the server answers (US4-5): the answer may carry the
  only working link.
- The request sends `{ comment: comment || null }`; trimming is the API's job.

## Outcomes

| Outcome | What the administrator sees | What happens to the workbench |
|---|---|---|
| `200` | the confirmation closes and the page presents **Activation link** with origin `restoration`: {First Last}'s invitation is pending again. Any link they were given before still does not work. Hand them this one so they can choose their password. Then the once-only alert, the link, the copy button, and **Done** | the collection refreshes (not awaited); the user leaves the cancelled view, their record closes or their row disappears, the outcome stays open (US4-8); after **Done**, still on the cancelled view, user listed in the pending view, both counts updated (US4-9, FR-018) |
| `409 E_USER_NOT_CANCELLED` | toast "Unable to restore {name}'s invitation" with the sentence for `meta.accessStatus` (research D13) | the dialog stays open with the comment; the collection refreshes; if the user left the cancelled view, the dialog unmounts with the record or row, and the toast remains |
| `404 E_USER_NOT_FOUND` | same toast title, "{name} no longer exists. Refresh to see the current users." | as above |
| `403 E_AUTHORIZATION_FAILURE` | same toast title, "You are not allowed to restore an invitation." | dialog stays open |
| `422` on `comment` | same toast title, the field-level message | dialog stays open, comment kept to shorten (US4-7) |
| network failure / `500` | same toast title, the client's retryable message | dialog stays open, comment kept; confirming again retries (US5-3, US5-4) |

There is no success toast: the once-only outcome names the user and is the confirmation.

## The once-only outcome

- `ui/issued-activation-link.tsx`: the held value gains `origin: 'renewal' | 'restoration'`;
  `RenewActivationLinkDialog` passes `'renewal'`, `RestoreInvitationDialog` passes `'restoration'`.
  The provider renders `ActivationLinkDialog` with the held origin.
- `ui/activation-link-dialog.tsx`: `origin` accepts `'restoration'`, which changes the description
  sentence only. Shown once, copyable, dismissed only by **Done** — unchanged (FR-008).
- The link is never written to the URL, the query cache (`gcTime: 0` on the mutation), or storage
  (FR-009).

## Mutation — `mutations/use-user-mutations.ts`

```ts
const restoreInvitation = useMutation(
  tuyauQuery.users.restoreInvitation.mutationOptions({
    gcTime: 0,
    onSuccess: () => void refreshUsers(),
    onError: () => void refreshUsers(),
  }),
)
```

Not awaited, so the link is presented as soon as the server answers, and refreshed on error too, so
a refusal is read against a workbench that already agrees with the server — the renewal's reasoning.

## Access history — `ui/user-access-history.tsx`

A new event `{ key: 'invitation-restored', label: 'Invitation restored', at: invitationRestoredAt,
by: invitationRestoredBy, comment: invitationRestorationComment }`, sorted oldest first with the
others. A restored user's record therefore reads: Invited → Cancelled (with its comment) →
Invitation restored (with its comment), and the **Activation link** field says it is valid until the
new expiry (FR-019, clarification 2).

## Unchanged

- `userAccessActions`, `UserAccessDialog`, `user-access-copy.ts`: the restoration is not a
  `UserAccessAction` (research D11).
- `ui/user-table.tsx`: the pending view's `Invited` column still reads the original invitation
  (clarification 3); the `Activation link` column reads the new expiry and shows no mark.
- The two existing pointers, "Restore it instead" in `renew-activation-link-dialog.tsx` and
  `user-invitation-copy.ts`: same wording, now actionable (US4-10).

## Test seams — `__tests__/invitation-restoration/`

| File | Covers |
|---|---|
| `helpers.ts` | `mockRestorationSucceeds / Pending / Refused / Unreachable`, `openCancelledRecordFor`, `openCancelledRowMenu`, in the shape of the renewal's helpers |
| `permissions.test.tsx` | offered to an organization admin on a cancelled user only, in both places; absent for pending, active, deactivated users and for operations admins (US2-4, US2-5) |
| `confirmation.test.tsx` | title, named user, 7-day sentence, comment field, labels; dismiss sends nothing; in-flight locks both buttons and the field (US4-3–US4-5) |
| `journey.test.tsx` | restore from the record with a comment: the request body, the outcome with origin sentence and link, outcome still open after the record closes, **Done** leaves the cancelled view without the user and the pending count up by one (US4-1, US4-8, US4-9) |
| `row-menu.test.tsx` | the item's position and the same outcome from the row menu (US4-2) |
| `refusals.test.tsx` | each `meta.accessStatus` sentence, `404`, `403`, `422` with the comment kept (US3, US4-7, FR-022) |
| `recovery.test.tsx` | network failure then retry: one presented link, comment kept (US5-3, US5-4) |
| `history.test.tsx` | a restored user's history orders Invited, Cancelled with comment, Invitation restored with comment (FR-019) |
