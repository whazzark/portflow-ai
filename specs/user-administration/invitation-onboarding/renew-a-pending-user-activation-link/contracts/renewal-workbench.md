# Workbench contract: Activation link renewal

**Feature**: `apps/web/src/features/users` · **Route**: `/_authenticated/users` (no new search
parameter)

## Who sees what

| Viewer | Target | Renewal action | Link validity | Renewal in history |
|---|---|---|---|---|
| Organization admin | pending user | offered on the record footer and the row menu | shown | shown |
| Organization admin | active, deactivated, or cancelled user | absent | absent | shown if ever renewed |
| Operations admin | never sees pending users | absent | absent (key withheld) | absent (key withheld) |

`canRenewActivationLink(viewer, user)` is `viewer.role === 'ORGANIZATION_ADMIN' && user.accessStatus === 'PENDING'`.
It mirrors the API rule and does not replace it (FR-013). An action that does not apply is
**absent**, not disabled.

## Entry points

- **Record footer**: a `Renew activation link` button, among the access actions and before any
  destructive one.
- **Row menu**: a `Renew activation link` item after `Edit`, before the destructive items, under the
  same rule and opening the same dialog (FR-018).

Per the project's button-label rule, the label carries the action and its object — the link — not
the record's resource name.

## The renewal — a confirmation, then the page's outcome

`RenewActivationLinkDialog({ user, onClose })` is mounted only while open; on success it hands the
link to `usePresentActivationLink()` and closes.

### Step 1 — Confirmation (`AlertDialog`)

- **Title**: `Renew activation link`
- **Description**: names the user, and states that any activation link already handed out to them
  will stop working, and that a new one will be shown once (FR-019).
- **Actions**: `Cancel` closes and issues nothing. `Renew` submits; while in flight it reads
  `Renewing…` and is disabled (FR-020), and `Cancel` and Escape are disabled too — once submitted,
  the server may already have retired the previous link.
- **On refusal**: the dialog stays open, the collection is refreshed, and a toast titled
  `Unable to renew <name>'s activation link` carries the reason:

| `error.code` | `meta.accessStatus` | Toast description |
|---|---|---|
| `E_USER_NOT_PENDING` | `ACTIVE` | `<name>` has already activated their access. Reset their password if their credential needs replacing. |
| `E_USER_NOT_PENDING` | `DEACTIVATED` | `<name>`'s access was deactivated. Reactivate it instead. |
| `E_USER_NOT_PENDING` | `CANCELLED` | `<name>`'s invitation was cancelled. Restore it instead. |
| `E_USER_NOT_FOUND` | — | `<name>` no longer exists. Refresh to see the current users. |
| `E_AUTHORIZATION_FAILURE` | — | You are not allowed to renew an activation link. |
| `NETWORK_ERROR`, `UNKNOWN_ERROR` | — | the parsed message, which already says to try again (retryable) |

  An unmapped code falls back to the API's message (FR-017). If the refusal removed the user from
  the pending view, the open record closes and takes the dialog with it. The toast outlives both,
  as `UserAccessDialog` documents.

### Step 2 — Outcome (`ActivationLinkDialog`, `origin="renewal"`)

- It is shown as soon as the mutation resolves, by `IssuedActivationLinkProvider` at the page level
  — not inside the record or row the renewal started from, which a browser Back or a refresh can
  remove while the outcome is on screen.
- It is the same dialog as the invitation outcome: the link in clear text, a copy action, *This
  link is shown once*, and the new expiry (FR-006).
- **Renewal description**: `A new activation link for <name>. The previous link no longer works. Hand them this one so they can choose their password.`
- Nothing dismisses it but `Done` (no Escape, no outside click).
- `Done` closes the dialog and the administrator stays where they were: the open record, or the
  collection on the pending view (FR-021).
- The link lives only in the page's state until `Done`. There is no second read, no URL parameter,
  and no cache entry holding it — the mutation runs with `gcTime: 0` (FR-007).

## Validity presentation (FR-022)

Derived by `activationLinkState(user, Date.now())` — see [data-model.md](../data-model.md#web-derived-state).

| State | Record field **Activation link** | Pending-view column **Activation link** |
|---|---|---|
| `valid` | `Valid until <formatDateTime>` (neutral) | blank |
| `expired` | `Expired <formatDateTime>` (warning) | `Expired` (warning) |
| `missing` | `Not issued` (warning) | `Not issued` (warning) |
| `undefined` | field absent | blank |

- The `activationLink` column is visible in the **pending** view only. The `password` column is
  hidden in that view, because a pending user never owes a password renewal.
- After a renewal, the refreshed collection clears the row's mark and the record shows the new
  expiry, with no manual reload.

## History presentation (FR-009)

`UserAccessHistory` gains an `Activation link renewed` entry — the date, then `by <name>` when the
actor is known — sorted chronologically with the other events. Only the most recent renewal exists
to show.

## Mutation

`useUserMutations().renewActivationLink` wraps `tuyauQuery.users.activationLinkRenewal.mutationOptions`,
refreshing `userQueries.list()` on success and on error (as `deactivate` does) without awaiting it,
so the link is presented as soon as the server answers, and with `gcTime: 0`.

## Test seams (MSW, real router)

`apps/web/src/features/users/__tests__/activation-link-renewal/`:

| File | Proves |
|---|---|
| `permissions.test.tsx` | offered on pending users to organization admins, from both entry points; absent otherwise |
| `confirmation.test.tsx` | names the user and the consequence; `Cancel` sends nothing; duplicate submission prevented |
| `success.test.tsx` | outcome shows the link once with the new expiry; `Done` returns to the record or the row; history and validity update without a reload |
| `refusals.test.tsx` | each code and status above produces its sentence; the dialog stays open; the collection is refreshed |
| `validity.test.tsx` | record field and pending-view column for valid, expired, and missing links; no column outside the pending view |

`apps/web/src/features/users/helpers/activation-link.test.ts` unit-tests `activationLinkState` at
the expiry boundary.
