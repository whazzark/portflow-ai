# Contract: Truck Pool Planning UI State

This contract only adds to two existing contracts: GH-58's `ui-state.md` for the discharge detail,
and GH-53's `ui-state.md` for its corrections. Terms:
- **Preparer**: a user for whom `canPrepareDischarges(user)` is true.
- **Observer**: anyone else with access to the detail.
- **Can plan trucks**: a preparer on a discharge whose status is `PLANNED`. This is the existing
  `canCorrect`.

## Route and URL state

| Parameter | Route | Values | Default | Invalid value |
|---|---|---|---|---|
| `tab` | `/discharges/$dischargeId` | `overview`, `product-lots`, `truck-pool`, `shifts` | `overview`, never written to the URL | Treated as `overview`; no not-found |
| `shiftId` | `/discharges/$dischargeId` | the id of one of the discharge's shifts, open in the shift panel | none: the panel is closed | Treated as absent, so no panel opens; no not-found |

- Choosing a section pushes a history entry, as the list's status tabs do.
- Choosing a shift on the calendar opens its panel, or changes the open one, and closing the panel
  drops `shiftId`. Both replace the history entry rather than pushing one, and keep the scroll
  position.
- Choosing a section, by its tab or by a cross-section link, drops `shiftId`.
- The detail keeps the list's `status` and `search`. The list route drops `tab` and `shiftId` from
  every address it receives, so the back link, the breadcrumb, and the next discharge opened from
  the list never carry them.
- Changing section reads nothing again: the detail comes from the cache.
- Sheets and dialogs are still not reflected in the URL, as GH-53 decided for corrections. An
  inactive section is not mounted, so leaving it discards its open sheet and its selection.

## Page layout

This replaces the stacked cards of GH-58's `Page layout`.

1. **Header**, on every section:
   - `Back to discharges`.
   - `h1` with the vessel name, and the status badge beside it in the same parent.
   - A facts line (`dl`, terms visually hidden): dock (with its archived or suspended marker),
     expected start, expected tonnage.
   - An actions place, empty in this slice (GH-56 adds the start action).
2. **Section tabs**: a `TabsList` named `Discharge sections`, `line` variant. Triggers, in order:
   `Overview`, `Product lots ({n})`, `Truck pool ({held})`, `Shifts ({n})`. A closed discharge's
   trigger reads `Truck pool` with no count. On a narrow screen the list scrolls sideways, and the
   active trigger is scrolled into view when the page opens.
3. **Section panel**, one at a time:

| Tab | Panel |
|---|---|
| `overview` | `Overview` card (unchanged), then the `Preparation` card on a planned discharge |
| `product-lots` | `Product lots` card |
| `truck-pool` | `Truck pool` card |
| `shifts` | `Shifts` card |

The pending state mirrors this: header blocks, a tab bar block, one panel block.

## Overview: `Preparation` card

Shown on a `PLANNED` discharge to every viewer; absent on `ACTIVE` and `CLOSED`. A region named
`Preparation` with one list row per section. Each row has a link named after the section that opens
it, the fact, and, when there is one, the gap as a warning icon (`aria-hidden`) followed by its text.

| Row | Fact | Gap |
|---|---|---|
| `Product lots` | `{n} product lots`, `1 product lot`, or `No product lots` | `{k} with no warehouse door currently assigned` |
| `Truck pool` | `{n} trucks reserved` or `1 truck reserved` | `No trucks reserved`, in place of the fact |
| `Shifts` | `{n} shifts`, `1 shift`, or `No shifts planned` | `{k} planned shifts without a truck selected` (`1 planned shift…`) |

A lot counts when it has no warehouse door assignment in effect. A shift counts when it is `PLANNED`
and has no truck row without an end; a suspended truck still selected counts as selected. The card
never says whether the discharge can start.

## Cross-section links

| Where | Condition | Content |
|---|---|---|
| `Shifts` card, above the shifts | can plan trucks, no held truck, at least one `PLANNED` shift | `No truck is reserved for this discharge yet.` and the link `Go to truck pool` |
| Shift panel's truck choice, `No trucks reserved` empty state | always | Outline link `Go to truck pool`; it returns to the details, then opens the section, which closes the panel |

Both links keep the list's `status` and `search`.

## Truck pool card (Truck pool tab)

### Rows

The existing columns and order are unchanged: held rows first, then released rows muted.

| Row state | Viewer | Additions |
|---|---|---|
| Held, `otherHoldings` not empty | everyone | A warning icon button after the registration, named `Also held by {holdings}`, where each holding reads `{vesselName} · {Planned\|Active}`, joined by `, `. Its tooltip lists `Also held by`, one holding per line, and `Only one active discharge can hold a truck, so starting a discharge settles it.` The holdings are not written in the row |
| Held | can plan trucks | A leading checkbox named `Select {registration}`, and a trailing ghost icon button (trash icon) named `Withdraw {registration}` |
| Released | everyone | No checkbox, no action, no badge |

When at least one held row exists and the viewer can plan trucks, the table header has a select-all
checkbox named `Select all held trucks`. It is `mixed` when only some rows are selected.

### Card actions (can plan trucks)

| Location | Action | Condition | Opens |
|---|---|---|---|
| Card header | `Add trucks` | always | `Add trucks` sheet |
| Card header | `Withdraw ({n})` | at least one held row selected | `Withdraw trucks` confirmation, for the selected trucks |
| Each held row | `Withdraw` | always | `Withdraw trucks` confirmation, for that truck |
| Empty state `No trucks reserved` | `Add trucks` | always | `Add trucks` sheet |

The selection clears after a successful withdrawal. It also drops any truck that is no longer held
after the detail refreshes.

## `Add trucks` sheet (`Sheet`, `size="lg"`)

- Title: `Add trucks`
- Description: `Reserve trucks for {vesselName}. A truck held by another discharge can still be
  reserved; the conflict is settled when a discharge starts.`
- Body, top to bottom:
  1. An `InputSearch` labelled `Search trucks`. It matches registration or transport company name,
     with the same normalization as the trucks list search.
  2. `Select all` checkbox, over the rows currently shown by the search.
  3. The candidates list. Each row has a checkbox named `Select {registration}`, the registration,
     followed, when `otherHoldings` is not empty, by the same `Also held` icon and tooltip as the
     pool, and the transport company.
  4. The selection count: `{n} selected`.
- Footer: `Cancel` and `Reserve` (`Reserving…`). `Reserve` is disabled while nothing is selected.

| Candidates state | Body |
|---|---|
| Loading | Skeleton rows; `Reserve` disabled |
| Error | Inline `Alert` `Unable to load trucks` with `Retry`; `Reserve` disabled |
| Empty (no candidate at all) | `Empty` `No trucks to add`, description `Every available truck is already in this pool.` |
| No search match | `No trucks match “{search}”`; the selection is kept |
| Ready | The list |

A search never clears the selection. Selected trucks hidden by the search stay selected and count.

| Outcome | Behavior |
|---|---|
| Success | Sheet closes; detail cache replaced; candidates and list invalidated; toast `{n} trucks reserved` (`Truck reserved` for one) |
| `422` | Sheet stays open. Each refused truck shows its reason inline, under its row, from the API message, and a destructive `Alert` above the list says `Some trucks can no longer be reserved`. Candidates are refetched; the selection is kept, including refused trucks, so the user can uncheck them |
| `409 E_DISCHARGE_NOT_PLANNED`, `404 E_DISCHARGE_NOT_FOUND` | Sheet closes; detail refetched; toast `This discharge has started and can no longer be corrected` |
| Other failure | Sheet stays open; toast `Unable to reserve trucks` with the API message; selection kept |

## `Withdraw trucks` confirmation (`AlertDialog`, destructive)

- Title: `Withdraw truck?` for one truck, `Withdraw {n} trucks?` for several.
- Description:
  - Always: `{registrations, joined by ", "} will be removed from this discharge's pool.`
  - When some planned shifts currently select them, also `They will also be removed from these
    shifts:`, followed by a list of `{shift name}` for each such shift, in chronological order.
    The list comes from the cached detail.
- Buttons: `Cancel` and `Withdraw` (`Withdrawing…`, disabled while pending).

| Outcome | Behavior |
|---|---|
| Success | Dialog closes; detail cache replaced; candidates and list invalidated; toast `{n} trucks withdrawn` (`Truck withdrawn` for one) |
| `409 E_DISCHARGE_NOT_PLANNED`, `404 E_DISCHARGE_NOT_FOUND` | Dialog closes; detail refetched; toast as for the sheets |
| Other failure | Dialog stays open; toast `Unable to withdraw trucks` with the API message |

A truck already withdrawn by someone else is not an error. The response simply no longer lists it.

## Shifts card (Shifts tab)

A region named `Shifts`. With no shift, it shows `Empty` `No shifts planned`, description
`No shift has been prepared for this discharge yet.`, and nothing else.

### Shift names

Wherever a shift is named, it reads as its planned period in the browser's zone, to the minute:
`Sun 4 Oct 06:00 – 14:00`, or `Sun 4 Oct 22:00 – Mon 5 Oct 06:00` when it ends on another day. This
covers the calendar, the shift panel, its truck choice's description, and the
`Withdraw trucks` confirmation.

### Calendar

A list named `Shift calendar`, one button per shift, in planned order.

- **From `md`:** columns of 24 hours, each opening at the hour the discharge is expected to start
  (`expectedStartAt`, to the hour), sharing the card's width at 176px each at least, 28px per hour. When a shift is planned before the
  expected start, the calendar opens at that shift's hour instead, so no shift is hidden. It scrolls
  sideways when wider than the card, with the hour gutter kept in view. The drawing is
  `aria-hidden` and shows:
  - above each column, the day and time the column opens, then `Day {n}`;
  - hour marks every two hours, shared by every column;
  - the breaks between shifts, hatched;
  - the expected start as a dashed line when the calendar does not open on it exactly, beneath the
    shifts so it never crosses one's text;
  - on an `ACTIVE` discharge, the current time as a line, above the shifts.

  Each shift is a block placed at its planned period. A shift worked past midnight stays one block
  when it stays within its 24-hour column. A shift crossing a column's edge is cut there: its button
  sits on the first piece, and the rest is drawn only.
- **Below `md`:** no calendar. The same buttons stack as a vertical list, each also showing its
  start day.
- **Each button:**
  - accessible name `Shift {shift name}`, `aria-pressed` on the open shift;
  - its card, in six lines by importance:
    1. start and end times, then the planned duration (`· 8 h`, `· 7 h 30 min`);
    2. the shift status badge and, for a `PLANNED` shift with no truck without an end, a warning icon
       and the visible text `No truck`; such a card also takes the warning border;
    3. a person icon and the responsible's name, truncated;
    4. a truck icon and the count of distinct trucks;
    5. a door icon and the first warehouse door's name, truncated, then `+{n}` for the others, or
       `None`;
    6. a scale icon and the first weighing area's name, the same way.

    The resources are those without an end, or, for a `COMPLETED` shift, those it used, each once.
  - From `md`, a card shows only the lines its height holds, in that order and the times always:
    about one per hour, all six from six hours. The stacked list below `md` shows every line.
  - the drawn lines are `aria-hidden`; the accessible description always reads in full:
    `{status}, {duration}, {first} {last}, {n} trucks, Warehouse doors: {warehouse} › {door} and …,
    Weighing areas: {area} and …` (singular for one; `No warehouse door`, `No weighing area` for
    none), followed by `, No truck selected` when the warning applies.
- When the page opens, the open shift's button is scrolled into view; with no panel open, the
  first `ACTIVE` shift's, else the first `PLANNED` one's, else the last shift's.

### Shift panel (`Sheet`, `size="lg"`)

Open while `shiftId` names one of the discharge's shifts; nothing sits below the calendar.

- Unmodal, as the warehouses map's panel: no overlay, and a click outside dismisses nothing, so the
  calendar stays usable and choosing another shift there changes the panel. It closes with its
  close button or `Escape`. It is on the right from `md`, at the bottom of the screen below it.
- It is a dialog named `Shift {shift name}`.
- Header: the title `Shift {shift name}`; below it, the shift status badge and, for a `PLANNED`
  shift with no truck without an end, a warning icon and the text `No truck selected`.
- Body, as detail fields: `Planned start` and `Planned end` (to the minute), `Duration`
  (`8 h`, `7 h 30 min`, `45 min`), `Responsible`, and `Trucks` (`{n} trucks` or `1 truck` without an
  end; `{n} trucks used` for a `COMPLETED` shift, counting the distinct trucks it used). Then the
  Trucks, Warehouse doors, and Weighing areas groups, unchanged: in-effect then ended periods,
  `None selected`, and the status markers.
- Footer, when the viewer can plan trucks and the shift is `PLANNED`: `Edit`. It turns the panel
  to the shift's truck choice.

## Shift panel: truck choice

Not in the URL, as corrections are not (GH-53): choosing another shift, closing the panel, or a
reload returns to the details.

- Header, sticky: `Back to details`, which leaves the choice without saving; the title
  `Shift trucks` (the dialog's name meanwhile); the description
  `Choose the trucks shift {shift name} will use, from this discharge's pool.`
- Body:
  1. `Select all` checkbox, over the offered rows that can be checked.
  2. One row per offered truck, ordered like the pool. It has a checkbox named
     `Select {registration}` and the registration with its status marker.
     - **Offered**: every held truck that is not suspended, plus every suspended truck currently
       selected for this shift.
     - **Suspended truck**: its row is checked, and it can be unchecked but not checked again. Its
       checkbox is disabled once unchecked, with the visible note
       `Suspended trucks cannot be newly selected`, tied by `aria-describedby`.
  3. The selection count: `{n} selected`.
- Initial selection: the shift's current trucks, meaning its rows without an end.
- Footer: `Save` (`Saving…`), disabled when the selection equals the initial one. There is no
  `Cancel`: an edit panel is left through `Back to details`.

| Pool state | Body |
|---|---|
| No held truck | `Empty` `No trucks reserved`, description `Add trucks to this discharge's pool first.`, link `Go to truck pool`; `Save` disabled |
| Held trucks | The list |

| Outcome | Behavior |
|---|---|
| Success | Back to the details; detail cache replaced; list invalidated; toast `Shift trucks updated` |
| `422` | The choice stays. Each refused truck shows its reason under its row, and a destructive `Alert` says `Some trucks can no longer be selected`. The detail is refetched. A refused truck that is no longer held is shown at the end of the list, checked, with its reason, so the user can uncheck it |
| `409 E_DISCHARGE_NOT_PLANNED`, `404 E_DISCHARGE_NOT_FOUND` | Back to the details; detail refetched; toast `This discharge has started and can no longer be corrected` |
| `404 E_SHIFT_NOT_FOUND`, `409 E_SHIFT_NOT_PLANNED` | Back to the details; detail refetched; toast `This shift is no longer planned` |
| Other failure | The choice stays; toast `Unable to update shift trucks` with the API message; selection kept |

Leaving the choice with an unsaved selection discards it without confirmation, as the application's
sheets do.

## Observers and non-planned discharges

- No checkbox, `Add trucks`, `Withdraw`, or `Edit` renders.
- The `Also held` icon and its tooltip remain on held rows of planned and active discharges.
- A closed discharge holds nothing, so it shows no icon.

## Accessibility

- Checkbox rows are real `Checkbox` controls with the accessible names given above. The
  select-all checkboxes expose `aria-checked="mixed"`.
- Refusal reasons under a row are linked to that row's checkbox with `aria-describedby`.
- After a `422`, focus moves to the summary `Alert`.
- The confirmation's shift list is a real list (`ul`), so its length is announced.
- The shift calendar is a list of toggle buttons (`aria-pressed` on the shift open in the panel);
  its drawing is `aria-hidden`, so a gap is never shown by position or colour alone.
- The shift panel is an unmodal dialog: focus is not trapped, and the calendar stays reachable.
- The section tabs are Base UI tabs (`tablist`, `tab`, `tabpanel`); arrow keys move focus without
  opening a section. Each card keeps its region name inside its panel.
- A preparation gap is written out beside its icon, never shown by colour alone.

## Out of this contract

- Door and checkpoint planning (GH-54).
- Picking trucks for the shifts of an active discharge, and releasing trucks at runtime (GH-76 and
  GH-78).
- Starting the discharge and resolving the `Also held` conflicts (GH-56).
