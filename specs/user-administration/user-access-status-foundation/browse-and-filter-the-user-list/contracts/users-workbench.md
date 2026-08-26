# Contract: `/users` workbench

**Feature**: [spec.md](../spec.md) · **Route**:
`apps/web/src/routes/_authenticated/users.tsx` · **Module**: `apps/web/src/features/users/`

The workbench's observable contract: what the URL carries, what the screen exposes, and what each
role sees. It renders entirely from `GET /api/v1/users` ([get-users.md](./get-users.md)).

## URL search parameters

Validated with Zod and `.catch(...)` defaults, following `/customers`. Every filter lives in the URL
so a filtered view is shareable and survives a reload.

| Parameter | Values | Default | Meaning |
|---|---|---|---|
| `search` | string | `''` | Fragment matched against first name, last name, email. |
| `status` | `active` \| `pending` \| `deactivated` \| `cancelled` | `active` | Selected access status view. Ignored for an operations admin, whose collection is the active set. |
| `role` | `ORGANIZATION_ADMIN` \| `OPERATIONS_ADMIN` \| `OPERATIONS_LEAD` \| `OBSERVER` \| `all` | `all` | Role filter, combined with `status` and `search`. |
| `sort` | `name` \| `role` | `name` | Sort column of the visible table. |
| `order` | `asc` \| `desc` | `asc` | Sort direction. |
| `userId` | uuid | — | The open access record; dropped when it names no visible user. |

## Screen contract

- **Entry point**: the sidebar's `Administration → Users` item, rendered behind
  `isAdministrator(user)` and now carrying `href: '/users'` (FR-015).
- **Access status views** (organization admin): one tab per access status, each labelled with its
  count, `active` selected on arrival. Accessible name of the tablist: `User access status`.
- **Operations admin**: no status tabs. The active collection is presented directly, with its count,
  and nothing discloses the existence of another access status (FR-009).
- **Search**: `InputSearch`, case-insensitive, fragment match, applied to the visible view without a
  new request.
- **Role filter**: combinable with the search and the selected view; `all` clears it.
- **Table**: one row per visible user — name, email, role — sortable on name and role, with an
  accessible name naming the view (for example `Active users`). No access status column: the
  selected view already carries it, and repeating it on every row says nothing new.
- **Access record**: opening a row opens a sheet resolved from the retrieved collection. Identity,
  role, access status, then — organization admin only — the recorded lifecycle events oldest first,
  each with its date and responsible administrator where one was recorded. No write action is
  offered anywhere on the screen (FR-016).
- **Empty states**: a specific empty state per access status view, distinct from a no-match state
  when filters exclude every user, which offers a way to clear the filters (FR-013).
- **Failure**: `errorComponent` distinguishes a loading failure from an empty collection and offers a
  retry that refetches the collection (FR-014).
- **Refresh**: the open record follows the refreshed collection and closes when its user leaves the
  visible view.

## Roles that never reach the screen

`OPERATIONS_LEAD` and `OBSERVER` see no sidebar entry, and navigating to `/users` directly yields no
user information: the API refuses with `403`, which the route surfaces through its error component.
The client never encodes the rule itself — it renders what the API returned.
