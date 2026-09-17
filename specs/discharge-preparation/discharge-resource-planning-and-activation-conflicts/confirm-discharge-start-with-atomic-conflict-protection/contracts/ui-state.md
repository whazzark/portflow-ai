# UI State Contract: Discharge Start Confirmation

Screen behavior of the start action in `apps/web`. Wire shapes are in
[`discharge-start.openapi.yaml`](./discharge-start.openapi.yaml), and rules in
[`../data-model.md`](../data-model.md). Decisions are in research.md Decision 8.

## Header action

| Viewer | Discharge status | Header shows |
|---|---|---|
| Preparer (`canPrepareDischarges`) | `PLANNED` | `Start` button in `DischargeDetailHeader`'s `actions` slot |
| Observer | any | No start action |
| Anyone | `ACTIVE` or `CLOSED` | No start action; `Started <date, time> by <first last>`, or `Started <date, time>` when the actor is unknown |

The button label carries the action only (`Start`). The preparation card keeps its "no verdict"
rule: it never mentions starting.

## `StartDischargeDialog`

Mounted only while open, like `LotWarehouseDoorsDialog`. Size `xl`: full screen below `md`.

### Content

- **Title**: `Start <vessel name>`
- **Description**: the discharge and its first shift become active now, and the shift's actual start
  is recorded as this moment.
- **Review**, from the cached detail and `startCheck.shiftId`:
  - Vessel and dock.
  - Each customer with its product lots. Each lot lists its current warehouse doors as
    `<door> · <warehouse>`, or `No warehouse door`.
  - `<n> trucks held`.
  - **Shift to start**: its period, its responsible, and its current trucks
    (registrations, with a suspended marker), doors, and weighing areas. Without a planned shift:
    `No planned shift`.
- **Problems**, shown instead of the review's place at the top, hidden when the list is empty:
  - A destructive `Alert` titled `This discharge cannot start yet`, with `<n> problems to fix` (or
    `1 problem to fix`).
  - One bordered section per kind of element, in the detail's section order, empty ones left out:
    `Dock`, `Product lots`, `Truck pool`, `Shifts`. Each has an `h3` title and an `Open` link
    (accessible name `Open <title>`) to the section of the same name (`Dock` opens Overview).
  - Inside a section, one item per lot (headed `<customer> · <product>`) or per shift (headed by a
    `Shift <period>` link opening that shift), and one line per problem. A conflict line ends with
    the holding discharge's vessel name, linked to its detail.
  - While problems are listed, the description reads `Fix these problems where they are planned,
    then start again.`, and the review is folded in a closed `Preparation to start` disclosure.
- **Footer**:
  - `Cancel`, which closes the dialog and changes nothing.
  - `Start discharge`, whose pending label is `Starting…`.

### States

| State | Review | Problems | `Start discharge` |
|---|---|---|---|
| Check loading | Shown | Skeleton line | Disabled |
| Check failed (network or 5xx) | Shown | `Unable to check this discharge.` with `Retry` | Disabled until a check succeeds |
| Check ready, no problem | Shown | Hidden | Enabled |
| Check ready, problems | Folded | Listed | Disabled (FR-005) |
| Start pending | Shown | Unchanged | Disabled, `Starting…`; `Cancel` disabled |
| Refused (`E_DISCHARGE_START_REFUSED`) | Refreshed with the detail, folded | Replaced by `meta.problems`, alert focused | Disabled until the dialog opens again without problems |
| Failure unrelated to the preparation | Shown | Unchanged | Enabled; an inline `Unable to start this discharge. Try again.` above the footer |

### Outcomes

| Answer | Effect |
|---|---|
| `200` | Write the returned detail into `dischargeQueries.detail(id)`; invalidate the list; close the dialog; `toast.success('Discharge started', { description: '<vessel> · shift <period>' })` |
| `409 E_DISCHARGE_START_REFUSED` | `setQueryData(startCheck(id), { data: { dischargeId, shiftId: meta.shiftId, problems: meta.problems } })`; invalidate the detail; keep the dialog open |
| `409 E_DISCHARGE_NOT_PLANNED` | `toast.error('This discharge has already started')`; close; invalidate the detail (add to `STALE_DETAIL_CODES` handling, which already lists the code) |
| `404 E_DISCHARGE_NOT_FOUND` | Existing stale pattern: toast and close; invalidate the detail, which routes to not found |
| `409 E_DISCHARGE_PLANNING_CONFLICT` | `toast.error(PLANNING_CONFLICT_MESSAGE)`; keep the dialog open; refetch the check and the detail |
| `403` | `toast.error('You are not allowed to start discharges')`; close |
| Network or other error | Inline failure; the dialog stays open |

The check's `409 E_DISCHARGE_NOT_PLANNED` and `404` close the dialog with the same toasts as the
command's.

## Problem sections (`startProblemSections`)

Labels are resolved from the cached detail. A lot or shift the detail does not know gives an item
without a heading, with the fallback in brackets. Lots follow the detail's order, shifts their
planned start. `<period>` is the shift's period as the Shifts section labels it (`formatShiftPeriod`).
`[holder]` is the holding discharge's vessel name, linked to its detail on the section in brackets.

| Code | Section → item | Line |
|---|---|---|
| `DOCK_ARCHIVED` | Dock | `<dock> is archived` |
| `DOCK_HELD` | Dock | `<dock> serves [holder]` (Overview) |
| `NO_PRODUCT_LOT` | Product lots | `No product lot` |
| `LOT_WITHOUT_WAREHOUSE_DOOR` | Product lots → lot | `No warehouse door assigned` [`A product lot has no warehouse door assigned`] |
| `CUSTOMER_ARCHIVED` | Product lots → lot | `Customer <name> is archived` |
| `WAREHOUSE_DOOR_ARCHIVED` | Product lots → lot, or Shifts → shift for a shift context | `Door <door> · <warehouse> is archived` |
| `WAREHOUSE_DOOR_HELD` | Product lots → lot | `Door <door> · <warehouse> held by [holder]` (Product lots) |
| `TRUCK_HELD` | Truck pool, one item per holder | `Truck <registration> held by [holder]`, or `<n> trucks held by [holder]` with the registrations below (Truck pool) |
| `NO_PLANNED_SHIFT` | Shifts | `No planned shift` |
| `SHIFT_WITHOUT_TRUCK` | Shifts → shift | `No usable truck` [`A shift has no usable truck`] |
| `SHIFT_WITHOUT_WAREHOUSE_DOOR` | Shifts → shift | `No usable warehouse door` |
| `SHIFT_WITHOUT_WEIGHING_AREA` | Shifts → shift | `No usable weighing area` |
| `WEIGHING_AREA_ARCHIVED` | Shifts → shift | `Weighing area <name> is archived` |
| `TRUCK_ARCHIVED` | Shifts → shift | `Truck <registration> is archived` |
| `RESPONSIBLE_INELIGIBLE` | Shifts → shift | `<first last> can no longer be responsible` |

Following any link closes the dialog.

## After a successful start

- The header shows the status `Active` and `Started … by …`.
- The Shifts section shows the started shift as `Active` with `Started <time> by <name>`. Other
  shifts are unchanged.
- The preparation card, the `Start` button, and every planning action (lots, doors, pool, shift
  corrections) disappear, through the existing `canCorrect` gating on `status === 'PLANNED'`.
- In any other planned discharge, the truck and door indications naming this discharge show it as
  active on their next read.

## Accessibility

- The dialog's initial focus is `Cancel`, so a stray Enter never starts a discharge.
- A refusal moves focus to the problems alert (`tabIndex={-1}`), as the planning dialogs do.
- Problem sections are regions named by their heading. Each section's link is named
  `Open <section title>`; shift and holder links are named by their text.
