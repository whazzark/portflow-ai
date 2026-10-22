# Quickstart: Validate the V2 Shifts Tab

## Automated

From the repository root:

```bash
pnpm --filter web test -- src/features/discharges
pnpm check
pnpm typecheck
pnpm test
```

Expected: the new unit tests (`shiftsSummary`, shared resource period, add-shift hint) and the
extended feature tests (`detail/shifts`, `detail/add-shift`, `detail/shift-edit`, `detail/draw-shift`)
pass. Existing assertions change only for wording and layout listed in
[contracts/shifts-tab-ui.md](contracts/shifts-tab-ui.md).

## Manual browser pass

Prerequisites: the API and database running with seeds, as for any web development
(`pnpm dev` from the repository root).

1. Sign in as an operations administrator. Open a seeded **planned** discharge, then its Shifts tab,
   at 1440 × 900.
   - The summary reads count, total planned, and range, plus an amber gap count if a shift lacks something.
   - The legend is shown. 00:00 to 24:00 is visible without vertical scrolling.
   - Breaks are hatched with a duration pill. Expected start is a dashed line.
   - A card with gaps has an amber border and an amber `N gap(s)` pill.
2. Choose a shift. The panel title is its period, with `Shift i of n · <vessel>` under it. Trucks show
   as chips, followed by `All resources since …` or `All trucks since …` when shared. Choose Edit and
   check the Duration output and `x of y selected`. Then use Back to details.
3. Choose Add shift. The hint `Starts when the last shift ends, on …` is shown. Change the start and
   the hint disappears. Close the sheet, draw a period on the calendar, and check the sheet opens with
   it and without the hint.
4. Open a seeded **active** discharge. Check the status counts in the summary, the `Now HH:mm` line,
   status badges on cards, and `(cont.)` on a night shift's continuation. A completed shift's panel
   shows `A completed shift cannot be changed` and Close.
5. Open a seeded **closed** discharge. Check the summary and that no Add shift action is offered.
6. Repeat 1 at phone width: a stacked list with day labels and break items, no legend.
7. Switch to the dark theme and repeat 1 and 4. Check the contrast of the amber, hatching, and labels.
