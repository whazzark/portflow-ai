# Quickstart: Validate the Closed Discharge Record

## Prerequisites

- Dependencies installed: `pnpm install` at the repository root.
- For the browser check: a running API with the discharge preparation fixtures seeded (they
  include the closed discharge **MV Loire Star**) and the web dev server (`pnpm dev`).

## Automated checks

```bash
pnpm --filter web exec vitest run src/features/discharges
pnpm check
pnpm typecheck
pnpm test
```

Expected:

- Unit tests for the closed-record view functions (period, timeline, summary, `lotDoorCell` without
  history) pass.
- Feature tests under `src/features/discharges/__tests__/detail/` covering the closed header,
  Overview, Product lots, Truck pool and Shifts pass, as do the existing planned/active tests
  (FR-016 unchanged behavior).

## Browser walkthrough

Sign in as an operations lead and open **Discharges → Closed → MV Loire Star**.

1. **Header** on each tab: `MV Loire Star`, `Closed`, then Dock · Period · IMO · Expected tonnage;
   no Edit or Start. Period end reads `Not recorded` (closure time arrives with #98).
2. **Overview**: vessel comment under the header; the dock timeline with the discharge's shifts,
   a Started marker, no Now line; the Summary with shifts, lots/customers/tonnage and doors used,
   trucks and their release; each Summary row opens its tab.
3. **Product lots**: door chips only; no `History` link anywhere; `+N` still lists doors.
4. **Truck pool**: no count on the tab, no selection or actions.
5. **Shifts**: shifts open read-only; no Add shift, no drawing, no Edit.
6. Open a planned and an active discharge: their header and lot `N ended` link are unchanged.
7. Repeat steps 1–3 at a 375 px width: header facts wrap, the timeline stays within the page.

The design reference is the canvas page **Discharges**, `discharges-retenue-closed-*` screens.
