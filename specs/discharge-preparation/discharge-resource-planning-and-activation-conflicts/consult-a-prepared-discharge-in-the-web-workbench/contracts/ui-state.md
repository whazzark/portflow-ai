# Contract: Discharge Detail UI State

This is the user-facing contract of the discharge detail page. It covers what the address
carries, what each state renders, how the list reaches the page, and what the page deliberately
does not offer. The list's own contract is GH-61's `contracts/ui-state.md`; this document changes
only the list's rows and its route structure.

## Routes

| Route file | Path | Breadcrumb | Owns |
|---|---|---|---|
| `routes/_authenticated/discharges.tsx` | `/discharges` (layout) | `Discharges` | The `status` and `search` schema, unchanged from GH-61; renders `<Outlet />` |
| `routes/_authenticated/discharges.index.tsx` | `/discharges` | none | The list: loader, pending, error, and page, moved from the former single file |
| `routes/_authenticated/discharges.$dischargeId.tsx` | `/discharges/$dischargeId` | The vessel name, or `Discharge` until one is read | The detail: loader, pending, error, not-found, and page |

The header reads `Discharges` on the list and `Discharges › <vessel name>` on the detail. The
`Discharges` crumb on the detail is a link that keeps the current search (research.md Decision 8).

## URL state

| Part | Values | Default | Invalid input |
|---|---|---|---|
| `$dischargeId` path segment | the discharge id | none | Any id with no discharge, malformed or unknown, shows the not-found state (FR-022) |
| `status` (inherited) | `planned` \| `active` \| `closed` | `active` | Falls back to `active`, as on the list |
| `search` (inherited) | any string | `''` | Falls back to `''` |

The detail has no search parameter of its own. `status` and `search` are the list's state, carried
so that the way back restores it (FR-021). They never filter or hide the open discharge (FR-020):
`/discharges/<closed id>?status=active&search=zzz` still opens that discharge.

## Reaching the page from the list

- In each row, the vessel name is a link to `/discharges/$dischargeId` that carries the current
  `status` and `search`. Its accessible name is `View discharge <vessel name>`.
- The whole row is also clickable, with `cursor-pointer` and the hover highlight, following
  `customer-table.tsx`.
- Opening the detail is a normal navigation, not a replace, so the browser's Back button returns
  to the list.

This reverses GH-61's inert rows (FR-003). The rest of GH-61's list contract is unchanged:
columns, tabs, counts, search, ordering, and feedback states.

## Rendered states

| State | Condition | What the user sees |
|---|---|---|
| Loading | Detail loader in flight | Route-level pending component shaped like the page's sections, never an empty detail (FR-023) |
| Populated | The discharge is returned | The page described below |
| Not found | API answers 404 | Not-found copy naming a discharge, with a `Back to discharges` link carrying the inherited list state. No retry action (FR-022) |
| Error | Any other retrieval failure | `ResourceCollectionError` with a retry that removes the cached detail query and invalidates the router (FR-023) |

## Page layout

A full page, not a `Sheet` (FR-004; research.md Decision 9). From top to bottom:

1. **Back link and heading**: a `Back to discharges` link carrying the inherited list state,
   then the vessel name as the visible page heading, with a discharge status badge (`Planned`,
   `Active`, `Closed`) beside it.
2. **Identity card**: vessel IMO, vessel comment, dock, expected start, and expected tonnage, as
   `ResourceDetailField`s. An absent IMO or comment shows the italic `Not specified`. An archived
   dock carries the `ResourceStatusBadge`.
3. **Product lots card**: each lot shows its customer, which carries an archived marker when
   archived, its product name, its expected quantity, and its description (`Not specified` when
   absent). Under each lot are its door assignments, each showing `warehouse › door` and its
   period.
   - In-effect assignments come first, followed by ended ones with their end date, visually muted.
   - A lot with no assignment reads `No warehouse door assigned`.
   - On a planned or active discharge, a lot whose assignments have all ended also reads
     `No warehouse door currently assigned`.
   - If the discharge has no lot, the card shows an `Empty` state instead.
4. **Shifts card**: shifts in planned-start order. Each shows its planned period, a shift status
   badge (`Planned`, `Active`, `Completed`), and its responsible's full name. Each shift then lists
   three groups: Trucks (by captured registration), Warehouse doors (`warehouse › door`), and
   Weighing areas.
   - Each entry shows its period, in-effect entries first and ended ones muted.
   - A group with no entry reads `None selected`.
   - If the discharge has no shift, the card shows an `Empty` state instead.
5. **Truck pool card**: one row per pool entry, with the captured registration, the captured
   transport company, and the reservation time.
   - Held trucks come first, then released trucks, each with `Released <time>` and muted.
   - A currently suspended or archived truck, or an archived transport company, carries the
     `ResourceStatusBadge`.
   - If the pool is empty, the card shows an `Empty` state instead.

A period is in effect only while it has no end **and** the discharge is Planned or Active (research.md
Decision 4). On a Closed discharge, a period or pool reservation left without an end reads as ended,
with `end not recorded` or `Release not recorded`, never as current.

Tonnages use `formatTonnes`: grouping separators, exactly three decimals, and a `t` suffix. Dates
and times use the shared `formatDateTime`. An ended period reads `<from> – <to>`; an in-effect
period reads `Since <from>`.

## Accessibility

- The page heading is a real `h1`, and each card has a heading that names its section.
- Status badges and in-effect/ended markers are text, never color alone.
- The row link and the back link are reachable by keyboard, and the row-click handler is a pointer
  convenience only.

## Out of this contract

This contract covers no action of any kind: no edit, activate, close, assign, release, reassign,
or delete, and no create button (FR-025, FR-026). It also leaves out tabs, the activity log,
rotations, tonnage progress, report downloads, export, print, and maps. Later slices add their own
panels and actions to this page.
