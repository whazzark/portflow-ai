# UI Contract: Closed Discharge Record

Observable states of `/discharges/$dischargeId` when the discharge's `status` is `CLOSED`. Tests
assert these through roles and accessible names. No HTTP contract changes (see research R1).

## Header (every tab)

| Element | Contract |
|---|---|
| Heading level 1 | Vessel name |
| Status badge | `Closed` |
| Facts (`dl`) | Terms in order: `Dock`, `Period`, `IMO`, `Expected tonnage` |
| Period value | `<start> → <end>`; a missing side reads `Not recorded` |
| Actions | None: no `Edit`, no `Start discharge` button |
| `Expected start`, `Started` terms | Absent |
| Vessel comment | Shown under the facts only while the Overview tab is selected and the comment is non-empty |

## Overview tab

Order of content: dock timeline region, then Summary region. No region named `Overview` (the former
identity card) and no `Preparation` region.

| Element | Contract |
|---|---|
| Region `Dock timeline · <dock name>` | One labelled day tick per local day on the axis; one block per shift; a `Started` marker when the start is recorded; no `Now` text or marker; no `Expected start` |
| List `Shifts on the timeline` | One item per shift, named by its usual period label |
| Region `Summary` | Note `Closed discharges are read-only`; three rows `Shifts`, `Product lots`, `Truck pool`, each a link opening its tab |
| Shifts row | `N shift(s)` |
| Product lots row | `N lot(s) · N customer(s) · <tonnes>`; then `Unloaded through A, B and C` when doors exist |
| Truck pool row | `N truck(s)`; then `All released on <date time>` when every truck was released |
| No shifts | No timeline region; Shifts row reads `0 shifts` |

## Product lots tab

| Element | Contract |
|---|---|
| Lot row `Warehouse doors` list | One chip per distinct door used; archived marking kept; `+N` button opens `Warehouse doors` dialog listing doors without periods |
| History | No button or link named `History` or `N ended`; no dialog named `Door history` or `Ended assignments` |
| Lot without door | `No warehouse door assigned` (screen-reader text), as today |
| Actions | No `Add product lots`, no customer `Edit`, no row actions column |

## Truck pool tab

| Element | Contract |
|---|---|
| Tab label | `Truck pool` without a count |
| Table | Reservation and release columns; no checkboxes, no bulk action bar, no add/withdraw/release buttons |

## Shifts tab

| Element | Contract |
|---|---|
| Calendar | Shifts can be opened in their panel for reading |
| Actions | No `Add shift`, no drawing on the calendar, no `Edit` in the shift panel |

## Planned and active records

Unchanged by this feature, including their `N ended` link on lots (FR-016).
