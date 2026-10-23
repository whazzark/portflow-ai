# UI State Contract: Creation Wizard and Shift Preview

This contract covers `/discharges/new`. Everything not listed here (step navigation, validation,
refusals, success) keeps the GH-53 contract in
`../prepare-a-discharge-with-product-lots-and-shifts/contracts/ui-state.md`.

## Page layout (every step)

- **Width**: the header, stepper, step card, and footer row span the shell's content width. There
  is no centered `max-w` column.
- **Stepper**: a `nav` labelled « Discharge preparation steps ».
  - Each step shows its number (or a check when completed) and its name.
  - Below `md`, names are visually hidden but announced.
  - No « Step X of 3 » text appears at any width.
- **Footer**: a `section` labelled « Discharge summary », sticky to the bottom of the page.
  - It reads « n lots · tonnage · n shifts · period », or « No planned period yet » when there is no
    period.
  - Its actions are Cancel, Back (not on step 1), and « Next: <step> » or Create discharge.
  - The page scrolls under the footer, and the last row of any step can be scrolled clear of it.

## Planned shifts step

The step shows these parts, in order:

1. **Shift preview**: a `section` with the heading « Shift preview ».
2. **Planned shifts card**: its description reads exactly « The periods the discharge will be
   worked, each with its responsible. »
3. The form error, when there is one.

No footnote appears under the preview or under the card.

### Shift preview states

| State | Summary line | Dock row | This discharge row |
|-------|--------------|----------|--------------------|
| Loading occupancy | `<dock> · expected start <date, time>` | Skeleton | Drawn |
| Occupied before the expected start | `<dock> · free from <date, time> · expected start <date, time>` | One block per occupancy (« <vessel> » and « until <day, time> »), plus « Dock free » gaps | Drawn |
| No occupancy in the period | `<dock> · expected start <date, time>` | « Dock free » across the row | Drawn |
| Occupancy failed | `<dock> · expected start <date, time>` | Inline alert « Dock occupancy is unavailable. » with a Retry button | Drawn |

- **Legend**: Other discharge (solid block), Planned shift (dashed outline), and Expected start
  (dashed line).
- **Header row**: one label per day, for example « Tue 22 ». There are 7 days or more.
- **This discharge row**:
  - **Label**: the vessel name, or « This discharge » when it is blank.
  - **Sub-label**: « n shifts · h h » once a valid period exists. Otherwise it repeats « This
    discharge » under a vessel name, or is omitted.
  - **Blocks**: one per valid period, showing its number. Its accessible name is « Shift n, <start>
    → <end> ».
  - **Breaks**: visible gaps between consecutive blocks.
  - **Unscheduled shifts**: each shift without a valid period reads « Shift n · no period yet », and
    no block is drawn for it.
- **Expected start marker**: a dashed vertical line across both rows, labelled « Expected start
  HH:mm ». Its accessible name includes the date.
- **Live updates**: editing a shift's start or end, adding a shift, or removing one updates the
  preview without a request. Opening the step again after changing the dock, from step 1, requests
  that dock's occupancy.
- **Narrow screens**: the track keeps a minimum width per day and scrolls horizontally inside the
  preview box. The page itself never scrolls sideways.
- **No gating**: the preview never disables Next or Create discharge and never adds a field error.
