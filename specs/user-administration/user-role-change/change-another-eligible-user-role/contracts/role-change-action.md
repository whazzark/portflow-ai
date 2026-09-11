# Contract — the role change action in the user workbench

**Feature**: [../spec.md](../spec.md) · **Route**: `/users` · **Introduced by**: GH-28

> **Revised 2026-09-11.** This contract first described a role panel of its own, opened by a
> `Change role` action on the record under `mode=edit`. GH-24 (#293) delivered an `Edit` panel under
> that same mode first, so the role joined it rather than competing for the mode (spec
> Clarifications, Session 2026-09-11; [research.md](../research.md) D9). What follows is the
> delivered contract.

The workbench gains no route, no screen, no second read, and no action of its own: the role becomes
one more field of the `Edit` panel GH-24 opens on the user record.

## URL state

`/users` carries `mode` as GH-24 defines it — `create | edit | view`, per `apps/web/AGENTS.md`.
This slice adds no parameter and no value: `edit` opens the panel that now carries the role.

`mode` is meaningless without `userId` and is dropped with it; `create` clears `userId`. The state is
in the URL because an administrator halfway through an edit must survive a reload and be able to
share the link.

**Gating**: `mode=edit` is honoured only when the viewer may edit the open user —
`mayEditUserIdentity`: an organization admin, on someone other than themselves. A hand-typed
`?mode=edit` by an operations admin opens the read-only record instead. This keeps the interface
honest; the API remains authoritative (FR-008).

## Entry point

GH-24's: `Edit` in the row actions menu, and `Edit` on the left of the record footer. The record
shows the role as a plain value, with no action beside it.

## The form

The `Edit user` panel (`EditUserPanel` / `EditUserForm`), left through its header's "Back to details":

| Element | Rule |
|---|---|
| Role control | `form.AppField` + `SelectField` over the four roles (`USER_ROLE_OPTIONS`, labelled from `USER_ROLE_LABELS`), after the first name, last name, and email. Defaults to the role the user holds today, so the current value is always visible (FR-012). |
| Deactivated user | No control: the role is shown as it stands, with "A deactivated user's role cannot be changed. Reactivate the user first." The identity stays correctable (FR-003, FR-013). |
| Submit | `form.SubmitButton` with `WRITE_PENDING_LABELS.update`. Label: `Save changes`. |
| Errors | `applyValidationError` first, then `parseApiError`: `E_USER_EMAIL_CONFLICT` on the email field, every other refusal as a form-level message plus a toast. |
| Toasts | `resourceSuccessMessage('update', 'user', …)` and `resourceFailureTitle('update', 'user', …)`, naming the user as they stand. |

## Saving

The identity and the role are two seams, and each receives only what changed (`saveUser` in
`users-page.tsx`):

| Changed | Requests, in order |
|---|---|
| The role only | `PATCH /api/v1/users/:id/role` |
| The identity only, or nothing | `PATCH /api/v1/users/:id` |
| Both | `PATCH /api/v1/users/:id`, then `PATCH /api/v1/users/:id/role` |

Sequential, not parallel: if the role is refused after the identity landed, the refreshed collection
already carries the correction, so a retry sends the role alone. Leaving the role as it is sends no
role change; the API would still accept one as an unchanged success (FR-006).

## After a successful save

`useUserMutations().changeRole` invalidates:

- `userQueries.list()` — the table, the record, the role filter and its counts all show the new role
  without a reload and without a new sign-in (FR-014);
- `auth.me` — belt-and-braces: the panel is never offered on the viewer's own record, and GH-29 will
  refuse that case in the API.

The panel returns to the read-only record, which now shows the new role.

## Failure

A failure is reported distinctly from a refusal and from a success, leaves the displayed role
unchanged, and leaves the administrator on the form to retry or correct their choice (FR-015). A
business refusal — a target deactivated in the meantime — surfaces the API's message in the form.

## What the workbench does not gain

No per-user request: the record is still resolved from the collection GH-4 retrieves, and the
mutations' responses feed the same cache. No bulk role change. No new navigation entry. No
`Change role` action on the record.
