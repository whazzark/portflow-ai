# Contract: `/transport-resources` address state

Validated by the route's Zod search schema; every field falls back (`.catch`) to its default so a
malformed or stale link opens the default view.

| Parameter | Values | Default | Meaning |
|---|---|---|---|
| `status` | array of `available`, `suspended`, `archived` (non-empty, de-duplicated) | `['available','suspended']` | Pressed status pills. |
| `search` | string | `''` | Search term. |
| `transportCompanyId` | company id | — | Company filter. |
| `sort` | `registration`, `vehicleModel`, `capacity`, `status` | `registration` | Sort column. |
| `order` | `asc`, `desc` | `asc` | Sort direction. |
| `truckId` | truck id | — | Truck whose detail or inline edit is open. |
| `truckMode` | `view`, `edit` | `view` | `edit` = inline edit row (administrators, available trucks only). |
| `companyDetailsId` | company id | — | Company whose detail or inline edit is open. |
| `companyDetailsMode` | `view`, `edit` | `view` | `edit` = inline company form (administrators). |
| `create` | `truck`, `company` | — | Inline creation row (administrators). |
| `createTruckCompanyId` | company id | — | Fixed company for a truck created from Add truck. |

## Invariants (route transform)

- `create` set ⇒ `truckId`, `companyDetailsId` cleared (one form at a time).
- `truckId` set ⇒ `companyDetailsId` cleared, and vice versa (one detail at a time).
- `createTruckCompanyId` is kept only with `create=truck`.
- Non-administrators: `create`, `truckMode=edit`, `companyDetailsMode=edit` are reset (as today).
- `truckId` or `companyDetailsId` not found once data loads ⇒ cleared with `replace`.

## Legacy redirect `/transport-companies`

| Old | New |
|---|---|
| `status=available` | `status=['available','suspended']` (default) |
| `status=archived` | `status=['archived']` |
| `search` | `search` |
| `transportCompanyId` | `transportCompanyId` |
