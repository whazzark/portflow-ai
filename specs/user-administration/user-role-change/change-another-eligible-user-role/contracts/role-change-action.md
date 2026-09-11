# Contract — the role change action in the user workbench

**Feature**: [../spec.md](../spec.md) · **Route**: `/users` · **Introduced by**: GH-28

The workbench gains one action. It does not gain a route, a screen, or a second read.

## URL state

`/users` already carries `status`, `search`, `role`, `sort`, `order`, and `userId`. One parameter is
added, per the convention in `apps/web/AGENTS.md` — the route carries a single resource, so the mode
is named `mode`:

| Parameter | Values | Meaning |
|---|---|---|
| `mode` | `view` \| `edit` | `edit` opens the role change form inside the open record. Absent or `view` shows the read-only access record. |

`mode` is meaningless without `userId` and is cleared with it. The state is in the URL because an
administrator halfway through a role change must survive a reload and be able to share the link —
the same rule that governs `truckMode=create` and `checkpointId`.

**Gating**: `mode=edit` is honoured only when the viewer is an organization admin *and* the open user
is eligible. A hand-typed `?mode=edit` on a deactivated user, or by an operations admin, opens the
read-only record instead. This keeps the interface honest; the API remains authoritative (FR-008).

## Entry point

On the access record of an eligible user, shown to an organization admin only: a **`Change role`**
action in the panel header. The label carries the action alone — not the resource.

The action is absent for every other viewer (FR-008) and for a deactivated user, where the record
instead states why the role cannot be changed and that the user must be reactivated first. FR-013
requires the reason to be discoverable rather than the action silently missing.

## The form

A panel inside the same `Sheet`, built from the shared detail chrome and left through its header's
"Back to details":

| Element | Rule |
|---|---|
| Role control | `form.AppField` + `SelectField` over the four roles, labelled from `USER_ROLE_LABELS`. Defaults to the role the user holds today, so the current value is always visible (FR-012). |
| Submit | `form.SubmitButton` with `WRITE_PENDING_LABELS.update`. Label: `Change role`. |
| Errors | `form.FormError` for the form's own refusals; `applyValidationError` then `parseApiError` on the API's, as `customer-form.tsx` does. |
| Toasts | Built from the shared helpers — `refusalTitle` with the verb `change the role of` over `namedRecord('user', …)`, and `confirmationMessage` naming the user and the new role. The feature brings its noun and its verb, never its own phrasing. |

Submitting the role already held is accepted and reported as a success (FR-006); the form does not
treat an unchanged selection as an error.

## After a successful change

`useUserMutations().changeRole` invalidates:

- `userQueries.list()` — the table, the record, the role filter and its counts all show the new role
  without a reload and without a new sign-in (FR-014);
- `auth.me` — so an administrator who changed their own role sees their own navigation follow. That
  case is GH-29's to refuse outright; until it lands, a stale session cache would compound it.

The panel returns to the read-only record, which now shows the new role.

## Failure

A failure is reported distinctly from a refusal and from a success, leaves the displayed role
unchanged, and leaves the administrator on the form to retry or correct their choice (FR-015). A
business refusal — a target deactivated in the meantime — surfaces the API's message.

## What the workbench does not gain

No per-user request: the record is still resolved from the collection GH-4 retrieves, and the
mutation's response feeds the same cache. No bulk role change. No new navigation entry.
