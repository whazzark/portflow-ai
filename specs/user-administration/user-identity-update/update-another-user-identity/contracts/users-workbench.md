# Contract: the `/users` workbench, correcting an identity

**Feature**: [spec.md](../spec.md) · **Date**: 2026-09-10

Extends the read-only workbench GH-4 delivered. Nothing about the collection, its status views,
counts, search, role filter, or sorting changes.

## URL

`apps/web/src/routes/_authenticated/users.tsx` keeps its schema and gains one parameter:

| Parameter | Values | Default | Notes |
|---|---|---|---|
| `search`, `status`, `role`, `sort`, `order`, `userId` | unchanged | unchanged | GH-4 |
| `mode` | `view \| edit` | `view` | The route carries one resource, so the parameter is `mode`, per `apps/web/AGENTS.md` |

`transform` clears `mode` back to `view` when no `userId` is open, so the two can never contradict
each other and no consumer has to decide which wins. `?mode=edit` typed by hand opens nothing for a
viewer who is not an organization admin, and nothing on the viewer's own record — the interface stays
honest while the API stays authoritative (FR-006).

Both states survive a reload and are shareable, which is the point of the convention.

## The panel

`UserSheet` — the existing `Sheet` at `size="lg"` — renders:

| `mode` | Content |
|---|---|
| `view` | `UserAccessRecord`, as today, plus an identity-correction entry point and the identity history |
| `edit` | `EditUserIdentityPanel`, left through its header's **Back to details** |

**Entry point**: an `Edit` action in the record header, offered only when the viewer is an
organization admin and the open user is not the viewer. Its label carries the action alone.

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
| `200` | Toast from `helpers/resource-copy`, cache updated from the response, `userQueries.list()` invalidated, back to `mode=view` on the same user |
| `422` | Field-level errors; input preserved |
| `409 E_USER_EMAIL_CONFLICT` | Error on the email field: the address is already used |
| `409 E_USER_ACTIVATION_LINK_UNAVAILABLE` | `FormError`: the address of a user who has not activated cannot be changed yet; the rest of the correction was not applied |
| `403 E_USER_IDENTITY_SELF_UPDATE` | `FormError` pointing at the self-service path; not reachable through the offered entry point |
| Network or `5xx` | `FormError` with a retry; the collection still shows the previous identity (FR-017, US5) |

## The identity history

`UserAccessRecord` gains an identity-correction block below the existing access history, rendered from
`user.identityChanges`:

- Each entry: the date, the responsible administrator's full name, and what changed — only the parts
  that actually differ between `previous` and `next` are named.
- Oldest first, matching `UserAccessHistory`.
- An empty array renders nothing at all — no empty section, no "never corrected" line (FR-013's rule
  that an unrecorded event is not presented as an empty value).
- The key is absent entirely for an operations admin, so the block does not exist for them (FR-014).
- An entry whose `changedBy` is `null` still renders with its date and its change.

## Cache and consistency

`features/users/mutations/use-user-mutations.ts` — new, in the shape of
`use-truck-mutations.ts` — wraps `tuyauQuery.users.update.mutationOptions` and invalidates
`userQueries.list()` on success. The open record is resolved from the collection (GH-4's FR-006a), so
one invalidation refreshes the row, the counts, the record, and the avatar initials at once (FR-018).

A user who leaves the visible view as a result of the correction closes the record, exactly as GH-4
already specifies for a user who leaves the view for any other reason.
