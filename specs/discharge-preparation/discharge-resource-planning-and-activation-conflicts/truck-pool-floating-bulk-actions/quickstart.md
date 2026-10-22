# Quickstart: Truck pool floating bulk actions

## Automated validation

```bash
pnpm --filter @portflow/web test -- src/features/discharges
pnpm check
pnpm typecheck
pnpm test
```

Expected: the feature tests in `apps/web/src/features/discharges/__tests__/detail/`
(`truck-pool`, `withdraw-trucks`, `reserve-trucks`, `truck-planning-stale-state`) and the helper
unit tests in `truck-pool-selection.test.ts` pass, asserting the [UI contract](./contracts/ui-state.md).

## Manual browser check

Prerequisites: API and web running with the seed (`pnpm dev`), signed in as a preparer. Use a
planned discharge whose pool holds enough trucks to scroll, including one suspended truck and one
truck also reserved by another planned discharge.

1. Open the discharge, Truck pool tab. Read the summary « n trucks reserved · 1 suspended » and the
   « Also held by » hint.
2. Click the warning icon on the contested row: the popover lists the other discharges. Escape
   closes it with focus back on the icon. Repeat with the keyboard only.
3. Scroll to the bottom and check the last truck: the bar « 1 truck selected » appears at the bottom
   of the content, not over the sidebar, and the last row stays reachable above it.
4. Check two more trucks: « 3 trucks selected ». Clear: the bar disappears.
5. Select two trucks used by planned shifts, choose Withdraw: the dialog names them, the vessel, and
   the shifts. Cancel keeps the selection; Withdraw removes them and hides the bar.
6. Open Add trucks: candidates are grouped by company with counts, contested candidates say
   « Held by … » inline; select in two companies and reserve.
7. Repeat steps 1–4 in the other theme and at phone width (375 px): no horizontal page scroll, the
   bar's actions remain reachable.
8. Sign in as a non-preparer (or open an active discharge): no checkboxes, no row withdraw, no bar.
