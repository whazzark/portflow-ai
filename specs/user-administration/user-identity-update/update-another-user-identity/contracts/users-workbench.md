# Contract: the `/users` workbench, correcting an identity

**Feature**: [spec.md](../spec.md) · **Date**: 2026-09-10

Extends the read-only workbench GH-4 delivered. Nothing about the collection, its status views,
counts, search, role filter, or sorting changes.

**Revised 2026-09-11**: the entry points follow the customer directory (row menu and record footer),
`mode` gains `create` from GH-7's invitation panel, the identity history block is deferred, and a
pending user's address refusal is explained in the form (research.md D3, D7, D11).

## URL

`apps/web/src/routes/_authenticated/users.tsx` carries, besides GH-4's parameters and GH-7's
`invitedUserId`:

| Parameter | Values | Default | Notes |
|---|---|---|---|
| `search`, `status`, `role`, `sort`, `order`, `userId` | unchanged | unchanged | GH-4 |
| `mode` | `create \| edit \| view` | absent | The route carries one resource, so the parameter is `mode`, per `apps/web/AGENTS.md` — the same shape as `/customers`. `create` is GH-7's invitation panel |

`transform` settles contradictions so no consumer has to decide which parameter wins: `create` clears
`userId`, and `edit` or `view` without a `userId` is dropped. `?mode=edit` typed by hand opens nothing
for a viewer who is not an organization admin, and nothing on the viewer's own record — the interface
stays honest while the API stays authoritative (FR-006).

Every state survives a reload and is shareable, which is the point of the convention.

## Entry points

Both ask one rule, `mayEditUserIdentity(viewer, user)` in `features/users/helpers/user-identity.ts`: the
viewer is an organization admin and the user is not the viewer. The row and the record can therefore
never disagree, as `userAccessActions` already guarantees for the access actions. Labels carry the
action alone.

| Where | Entry point |
|---|---|
| Row actions menu | `View`, then **`Edit`**, then the access actions (`Deactivate`). `Edit` opens the correction directly: `?userId=…&mode=edit` |
| Record footer | **`Edit`** on the left, the access actions on the right. A record offering no action renders no footer at all |

`UserAccessRecord` owns the footer; `UserAccessActions` renders only its buttons and the confirmation
they open — the shape `CustomerDetails` / `CustomerLifecycleActions` already has.

## The panel

`UserSheet` — the existing `Sheet` at `size="lg"` — renders:

| `mode` | Content |
|---|---|
| `view` | `UserAccessRecord`, as today, with the footer above |
| `edit` | `EditUserIdentityPanel`, left through its header's **Back to details** |

**Form** — `useAppForm` with the registered field components, `applyApiError`, `FormError`, and
`SubmitButton`:

| Field | Pre-filled with | Client rule |
|---|---|---|
| First name | `user.firstName` | required, non-blank |
| Last name | `user.lastName` | required, non-blank |
| Email | `user.email` | required, well-formed |

Client rules exist to spare a round trip; the API's refusals are the authority, and
`applyApiError` maps them back onto the field at fault (FR-012), keeping the administrator's input
(FR-019).

**Outcomes**

| API result | Panel |
|---|---|
| `200` | Toast from `helpers/resource-copy`, `userQueries.list()` invalidated, back to `mode=view` on the same user |
| `422` | Field-level errors; input preserved |
| `409 E_USER_EMAIL_CONFLICT` | Error on the email field: the address is already used |
| `409 E_USER_PENDING_EMAIL_LOCKED` | `FormError` carrying the API's explanation — the user has not activated their access yet, so their address cannot change until they have — plus the usual failure toast. Not on the email field: nothing typed is at fault. Input preserved |
| `403 E_USER_IDENTITY_SELF_UPDATE` | `FormError` pointing at the self-service path; not reachable through the offered entry points |
| Network or `5xx` | `FormError` with a retry; the collection still shows the previous identity (FR-017, US5) |

## The identity history

Deferred on 2026-09-11 with the history itself (research.md D3, D4). The record shows the access
history GH-4 delivered and nothing more.

## Cache and consistency

`features/users/mutations/use-user-mutations.ts` — in the shape of `use-truck-mutations.ts` — wraps
`tuyauQuery.users.update.mutationOptions` and invalidates `userQueries.list()` on success. The open
record is resolved from the collection (GH-4's FR-006a), so one invalidation refreshes the row, the
counts, the record, and the avatar initials at once (FR-018).

A user who leaves the visible view as a result of the correction closes the record, exactly as GH-4
already specifies for a user who leaves the view for any other reason.
