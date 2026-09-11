# Contract: the invitation on `/users`

**Feature**: [spec.md](../spec.md) · **Route**: `apps/web/src/routes/_authenticated/users.tsx` ·
**Module**: `apps/web/src/features/users`

The invitation is two steps inside the workbench GH-4 delivered, not a route of its own. Both steps
live in the URL, per `apps/web/AGENTS.md`.

## Search parameters

| Parameter | Values | Meaning |
|---|---|---|
| `mode` | `create` \| absent | The invitation panel is open |
| `invitedUserId` | user id \| absent | An invitation has just succeeded, for that user |
| `status`, `search`, `role`, `sort`, `order`, `userId` | unchanged (GH-4) | The collection's own state |

`transform` rules:

- `mode=create` clears `userId`, so a creation and an open record can never contradict each other.
- A viewer who may not invite opens no panel, whatever the URL says: the page gates `mode` on the
  viewer's role, since the route's `transform` has no viewer to read. The API stays authoritative
  regardless.

## States

| URL | What is shown |
|---|---|
| `mode` absent | The collection. An organization admin sees the invitation entry point above it, and in the empty state of a status view that no search is narrowing. |
| `mode=create` | The invitation form: first name, last name, email, role. |
| `mode=create&invitedUserId=<id>`, link in memory | The outcome, in a modal dialog that replaces the form: the activation link in clear text, a copy action, its expiry date, and the statement that it will not be shown again. Dismissed only by an explicit acknowledgement (FR-005a). |
| `mode=create&invitedUserId=<id>`, after a reload | The link is gone by construction (D11): the same dialog carries an explicit "no longer available" state naming the pending user and pointing to the activation link renewal. |
| `invitedUserId=<id>` alone | The collection on the pending view, with that user's row highlighted and their access record **not** opened (FR-020). |

## Journey

1. An organization admin opens the invitation entry point → `mode=create`.
2. They submit an identity, an email, and a role.
   - `422` → field-level messages through `applyValidationError`; the entered values are kept
     (FR-021).
   - `409` → a refusal naming the existing access status and the action that applies, built from
     `meta.accessStatus`; the entered values are kept.
   - Network or server failure → a retryable failure toast; the form stays as typed and resubmitting
     is safe, since at most one pending user can exist per email (FR-019).
   - `201` → the URL becomes `mode=create&invitedUserId=<new id>`, the form sheet closes, and the
     outcome dialog opens in its place.
3. Acknowledging the outcome navigates to `status=pending&invitedUserId=<id>`, with `mode` cleared:
   the pending view, the new user visible and highlighted, its record unopened.
4. The user collection is invalidated on success, so the new pending user and the updated counts
   appear without a reload and without a new sign-in (FR-020).

## Rules

- The activation link is held only in the mutation result. It is never written to the query cache,
  `localStorage`, the URL, or a toast (FR-006).
- The copy action sits on the link itself — an icon button inside the link's own frame — and copies
  it as returned. Its success is confirmed, and a failed copy leaves the link visible and selectable
  rather than silently swallowing it.
- The acknowledgement is the only way out of the outcome: a click outside, `Escape`, and a
  navigation inside user administration do not dismiss it (FR-005a).
- The invitation entry point is presented to organization admins only (FR-011); an operations admin
  sees the collection exactly as GH-4 delivered it.
- The form is a `Sheet` at `size="lg"`, like every other creation in the application. The outcome is
  an `AlertDialog`, the surface this application already uses for a decision that must be
  acknowledged — a sheet is what one consults and leaves, which is the one thing a once-only link
  cannot survive. The entry point is a creation button naming the noun, consistent with the other
  directories.
- Toasts are built from `helpers/resource-copy`; the invitation brings its noun, not its own
  phrasing.
- Highlighting is decoration derived from `invitedUserId`; it changes no filter, no count, and no
  selection, and switching status view or clearing filters leaves it without side effect.

## Out of this contract

Accepting the invitation, `/activate/<secret>` and everything behind it (GH-8), renewing a link
(GH-9), cancelling, restoring, or removing an invitation (GH-12, GH-13, GH-14), and sending the link
by email (standalone slice).
