# Contract: Warehouse Door Planning UI State

This contract covers the planning actions on the discharge detail. The detail page's layout,
sections, and read states stay as GH-58's
[`ui-state.md`](../../consult-a-prepared-discharge-in-the-web-workbench/contracts/ui-state.md)
defines them. GH-53's correction actions stay as its
[`ui-state.md`](../../prepare-a-discharge-with-product-lots-and-shifts/contracts/ui-state.md)
defines them. This contract only adds to them.

"Preparer" below means an active operations lead, operations admin, or organization admin
(`canPrepareDischarges`). "Observer" means an active observer.

## Routes and URL state

- No route and no search parameter are added.
- The planning dialog is not reflected in the address, following GH-53's decision for correction
  sheets. A detail address always opens the detail alone.
- A `Shift {period}` link on a locked door opens `?tab=shifts&shiftId={id}`, pushed like the other
  section links. Leaving the Product lots section unmounts the doors dialog, discarding its unsaved
  choices, and the shift panel opens on the shift's details: a dialog and a sheet are never stacked.

## Where the actions appear

| Location | Action (accessible name) | Opens | Shown when |
|---|---|---|---|
| Each lot's `⋮` menu | `Assign doors` | `Warehouse doors` dialog for that lot | Preparer, discharge `PLANNED` |
| A locked door of the `Warehouse doors` dialog | `Shift {period}` link, one per shift | That shift's panel | A planned shift uses the door |
| The shift edit panel's `Warehouse doors`, when no lot holds a door | `Go to product lots` | Product lots section | Preparer, discharge `PLANNED` |

A lot's row carries one action affordance, its `⋮` menu, holding `Edit`, `Assign doors`, and
`Remove`. The doors cell is data alone: a button per row for a section most lots have not reached
yet was noise, and "what is left to plan" is a question about the discharge, not about one row.

`Assign doors` is the only item naming its object. The menu's trigger is already `Actions for
{customer} · {product}`, so `Edit` and `Remove` need no object; this one opens a different thing.

- Observers, and every viewer of an active or closed discharge, see none of these actions. Their
  read-only detail is unchanged.
- A shift's doors and weighing areas are planned from its own edit panel (GH-63/GH-64), not from
  this slice. The `Shift checkpoints` sheet this contract first described was dropped: the shift
  panel already chooses both, and the rule it was built for — a shift may only select a door a lot
  of the discharge holds — moved into that panel instead.

## Read-state additions

| Situation | Shown in the shift group |
|---|---|
| Never any selection of this kind | `None selected` (unchanged) |
| Only ended selections, discharge not closed | Ended selections, then `None currently selected` |
| Current selections | Unchanged |

A lot's door notices are unchanged: `No warehouse door assigned` and
`No warehouse door currently assigned`. A door **still assigned** shows no period: the cell already
means "assigned now", so its start would be a timestamp without a fact. An assignment that is over —
ended, or belonging to a closed discharge — keeps its `Ended · {period}`.

## Options loading

The dialog reads `dischargeQueries.planningOptions(dischargeId)`, with `staleTime: 0`, when it
opens. Only `Available` waits for it: the lot's own doors come from the detail, and show at once.

| Options state | `Available` |
|---|---|
| Pending | A skeleton (`role="status"`, `Loading the warehouse doors`); `Save` is disabled |
| Failed | `Unable to load the warehouse doors`, with `Retry`; `Save` is disabled |
| Loaded, nothing else to take | `No other warehouse door is available` |

## `Warehouse doors` dialog (lot)

A transfer between two columns, so taking a door never pushes the others down. A wide dialog on a
pointer (`max-w-4xl`, `min(85dvh, 44rem)` high), the whole screen below `md`. The header and footer
stay; each column scrolls on its own.

- **Header**: title `Warehouse doors`, description `{customer} · {product}`, and `Close`.
- **`Available ({n})`** (a region): an `InputSearch` (`Search doors`) matching warehouse or door
  name, then the doors by warehouse, each warehouse a list named by it, each door with `Add`. No
  match: `No door matches “{query}”`. Only this column is searched.
- **`Assigned to this lot ({n})`** (a region): the doors the lot will hold once saved, each named
  `{warehouse} › {door}`, with `Remove`. None: `No door assigned yet`.
- **On a phone**, the columns are two tabs, `Available ({n})` and `Assigned ({n})`, over the same
  footer.
- **The model**: one form value, the chosen door ids, in the order they were chosen. `Assigned` lists
  it as is — the doors held, then each one added at the end — so adding never moves a listed door.
  `Available` lists every other known door back in its warehouse, by warehouse then door name. A
  held door removed goes back there, with `Will be removed`, and `Add` keeps it. Each column shows
  exactly what the save leaves, and the save sends its difference as `{assign, withdraw}`.
- **Focus**: a moved door leaves its column, so the focus goes to the next door of that column, or
  the one above, or else the search (`Available`) or the column heading (`Assigned`).
- There is no `Select all`: "every door of the site receives this one lot" is not a real intent,
  and with the move rule it would strip every other lot at once.

**A door's row.** One compact status at most; a free door is its name alone.

| Column | Condition | Status | Action |
|---|---|---|---|
| Assigned | Held | — | `Remove` |
| Assigned | Held, a planned shift uses it | a lock, then a `Shift {period}` link per shift; `Remove it from the shift first` read with the row | none |
| Assigned | Added, free | a `New` badge | `Remove` |
| Assigned | Added, held by another lot | `Moves from {customer} · {product}`, in the warning tone | `Remove` |
| Assigned | Refused by the API | its message, in the destructive tone | `Remove` |
| Assigned | Held, no longer offered | an `Archived` badge | `Remove` |
| Available | Free | — | `Add` |
| Available | Held by another lot | `Held by {customer} · {product}` | `Add` |
| Available | Held, removed | `Will be removed` | `Add` |
| Available | Held, removed, and a planned shift uses it (refreshed detail, or a `selectedByPlannedShift` refusal) | the shift links, and `Remove it from the shift first` in the destructive tone | `Add`; a save is refused before any request |
| Either | Held by other discharges | a `⚠` marker with their count, its tooltip listing `{vessel} · {Planned or Active}`; one `Also assigned to {vessel} ({Planned or Active}, expected {date})` sentence per discharge read with the action | unchanged |

A door added that the options stop offering stays in `Assigned` with an `Archived` badge, and once
removed it is gone. `Add` and `Remove` show the action alone; each is described by the door's name
and its statuses, one element per fact. Dates in these rows are to the minute.

- **Footer**: a summary of the changes, then `Cancel` and `Save` (pending label from
  `WRITE_PENDING_LABELS`). The summary reads `Adds {doors} · Removes {doors}`, and on its own line,
  in the warning tone, `{doors} moves from {customer} · {product}` per source lot. A save with no
  change closes the dialog without a request, as does `Cancel`.

## Outcomes

| Outcome | Behavior |
|---|---|
| `200` | The dialog closes, the detail cache is replaced with the response, and the list is invalidated. Toast: `Warehouse doors updated`, described by `Taken from {customer} · {product}` when doors moved, one line per source lot |
| `422` | The dialog stays open with its choices kept, and an alert at the top of the body takes the focus: `Some warehouse doors can no longer be removed` for a `withdraw` refusal, `Some warehouse doors can no longer be selected` for an `assign` one, plus any refusal naming no door. Each issue's index is resolved through the submitted change set to its door, whose row carries the API's message alone. For `selectedByPlannedShift`, the detail is refetched instead, and the door's row turns into its locked, let-go-of state, naming the shifts |
| `409 E_DISCHARGE_NOT_PLANNED`, or `404 E_DISCHARGE_NOT_FOUND` | The dialog closes, the detail is refetched, and the toast is GH-53's `STARTED_REFUSAL_MESSAGE` |
| `404 E_PRODUCT_LOT_NOT_FOUND` | The dialog closes, the detail is refetched, and the toast is GH-53's `LOT_GONE_MESSAGE` |
| `404 E_SHIFT_NOT_FOUND`, or `409 E_SHIFT_NOT_PLANNED` | The dialog closes, the detail is refetched, and the toast is `This shift can no longer be planned` |
| `409 E_DISCHARGE_PLANNING_CONFLICT` | The dialog closes, the detail is refetched, and the toast is `This discharge changed meanwhile. Check its doors and try again.` |
| Other failure | The dialog stays open with its choices kept, and the toast shows the API message |

`STALE_DETAIL_CODES` gains `E_SHIFT_NOT_FOUND`, `E_SHIFT_NOT_PLANNED`, and
`E_DISCHARGE_PLANNING_CONFLICT`.

Closing the dialog with unsaved choices discards them without confirmation, as the sheets do.

## Accessibility

- The dialog is named by its title. Each column is a region named by its heading (`h3`), or by the
  same heading hidden visually under a phone's tabs; each warehouse's doors are a list named by it.
- `Add` and `Remove` are described by the door's name and each of its statuses. A locked door has no
  action; `Remove it from the shift first` is read with its row, and its shift links stay reachable.
- A moved door hands the focus on as above; the column heading is focusable for that alone.
- The footer summary is the dialog's one live region (`polite`, atomic), so each move is announced
  once.
- A refused save moves the focus to the alert at the top of the dialog; each refused door keeps its
  reason on its row.
- The contention marker is a focusable button labelled `Also assigned to {vessels}`; the same facts
  reach assistive technology through the action's description.
- On a phone, actions and links keep a 44px target.

## Shift edit panel — `Warehouse doors`

A shift may only select a door a lot of its discharge currently holds (FR-011), so the panel's door
checklist is built from the detail, not from the site's doors.

- Offered: the lots' current doors whose door and warehouse are available, lot by lot, then by
  warehouse and door. Each row is `Select {warehouse} › {door}`, described by its lot,
  `{customer} · {product}`.
- A door the shift selects that no lot holds any more stays listed and checked, described by
  `No lot holds this door`, and may only be unchecked, as an archived one may.
- Locked note: `Archived doors and doors no lot holds cannot be newly selected`.
- No lot holds a door: `No door is assigned to a product lot`, with `Go to product lots`, which
  closes the panel and opens the Product lots section.
- A `422 assignedWarehouseDoor` shows on its row, as every refusal of this panel does.
