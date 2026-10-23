# Contract: `/transport-resources` address state

Validated by the route's Zod search schema; every field falls back (`.catch`) to its default so a
malformed or stale link opens the default view. Follows `apps/web/AGENTS.md` (Routing and URL
state): the open record is `<resource>Id`, its mode `<resource>Mode` (`view | edit | create`), a
`create` mode clears its own id in the `transform`, and renamed parameters stay readable and are
rewritten in the `transform`.

| Parameter | Values | Default | Meaning |
|---|---|---|---|
| `status` | array of `available`, `suspended`, `archived` (non-empty, de-duplicated) | `['available','suspended']` | Pressed status pills. |
| `search` | string | `''` | Search term. |
| `transportCompanyId` | company id | — | Company filter (unchanged name). |
| `sort` | `registration`, `vehicleModel`, `capacity`, `status` | `registration` | Sort column. |
| `order` | `asc`, `desc` | `asc` | Sort direction. |
| `truckId` | truck id | — | Truck whose detail or inline edit is open. |
| `truckMode` | `view`, `edit`, `create` | `view` | `edit` = inline edit row; `create` = inline creation row (administrators). |
| `truckCompanyId` | company id | — | Fixed company of a truck created from a company's Add truck (kept only with `truckMode=create`). |
| `companyDetailsId` | company id | — | Company whose detail or inline edit is open (unchanged name). |
| `companyDetailsMode` | `view`, `edit`, `create` | `view` | `edit` = inline company form; `create` = inline company creation row (administrators). |

Parameters equal to their default are left out of the address (`stripSearchParams` route
middleware), so the default view is plain `/transport-resources` and a shared link carries only
what differs.

## Legacy parameters (read, rewritten, never written)

| Legacy | Rewritten to |
|---|---|
| `truckStatus=available\|suspended\|archived` | `status=[that status]` when no `status` is given |
| `truckSearch` | `search` when no `search` is given |
| `companyStatus=archived` | `status=['archived']` when neither `status` nor `truckStatus` is given |
| `companySearch` | `search` when neither `search` nor `truckSearch` is given |

## Invariants (route transform)

- `truckMode=create` ⇒ `truckId` cleared; `companyDetailsMode=create` ⇒ `companyDetailsId` cleared.
- One form at a time: `truckMode=create|edit` ⇒ `companyDetailsMode` reset to `view`;
  otherwise `companyDetailsMode=create|edit` ⇒ `truckMode` reset to `view`.
- One detail at a time: `truckId` set ⇒ `companyDetailsId` cleared.
- `truckCompanyId` is kept only with `truckMode=create`.
- Non-administrators: any `create`/`edit` mode is reset to `view` by the page (as today).
- `truckId` or `companyDetailsId` not found once data loads ⇒ cleared with `replace`.

## Legacy redirect `/transport-companies`

| Old | New |
|---|---|
| `status=available` | `status=['available','suspended']` (default) |
| `status=archived` | `status=['archived']` |
| `search` | `search` |
| `transportCompanyId` | `transportCompanyId` |
