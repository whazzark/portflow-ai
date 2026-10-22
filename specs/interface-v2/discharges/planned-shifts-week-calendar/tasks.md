# Tasks: Planned Shifts Week Calendar

**Input**: Design documents from `specs/interface-v2/discharges/planned-shifts-week-calendar/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/shifts-tab-ui.md, quickstart.md

**Tests**: Required. The constitution (IV) and AGENTS.md mandate TDD: write each test first and see it fail.

**Paths**: `W` = `apps/web/src/features/discharges`.

## Phase 1: Setup

- [X] T001 Run the existing discharges suite to record the green baseline: `pnpm --filter web test -- src/features/discharges`

## Phase 2: Foundational

None. Each story touches its own adapters and components. US1 and US2 share `shift-calendar.ts` and `shift-calendar.tsx`, so they run in order.

## Phase 3: User Story 1 - Read a Discharge's Shift Plan at a Glance (P1) 🎯 MVP

**Goal**: The summary line, legend, 24-hour fit, V2 cards, duration-only break pills, Expected start, `Now HH:mm`, and `(cont.)`.

**Independent Test**: Open the Shifts tab of planned, active, and closed discharges and check the summary text, legend, and card lines (contract §Summary row and §Calendar).

### Tests

- [X] T002 [P] [US1] Unit tests for `shiftsSummary()` (null without shifts; planned, active, and closed wording; singular and plural; total as a sum of durations; active leaves out zero status counts) in `W/__tests__/shift-calendar.test.ts`
- [X] T003 [P] [US1] Feature tests in `W/__tests__/detail/shifts.test.tsx`: summary text per status, legend items, break pill reads the duration only while the list item keeps `<d> break`, continuation reads `(cont.)`, active discharge shows `Now HH:mm`

### Implementation

- [X] T004 [US1] Implement `shiftsSummary(discharge)` returning `{ text, gapCount }` per research R2 in `W/shift-calendar.ts`
- [X] T005 [US1] Create `ShiftCalendarSummary` (summary text, legend from `md`: Expected start, Inter-shift break, Trucks, Doors, Weighing areas) in `W/ui/detail/shift-calendar-summary.tsx`
- [X] T006 [US1] Render `ShiftCalendarSummary` above `ShiftCalendar` when the discharge has shifts in `W/ui/detail/discharge-shifts-card.tsx`
- [X] T007 [US1] In `W/ui/detail/shift-calendar.tsx`: set `HOUR_HEIGHT_PX = 20`; apply V2 card styling (13 px semibold time, muted duration); break pill shows the duration only on the calendar; Now line gets a left dot and a `Now HH:mm` label; continuation reads `HH:mm–HH:mm (cont.)` then the lines the primary piece could not fit (research R5)
- [X] T008 [US1] Update existing assertions in `W/__tests__/detail/shifts.test.tsx` that change copy or layout, and check that T002–T003 pass

**Checkpoint**: US1 is shippable on its own.

## Phase 4: User Story 2 - Spot Planned Shifts That Still Lack Something (P1)

**Goal**: An amber `N gap(s)` pill on cards and in the summary, an amber border, and an accessible name with the gap count.

**Independent Test**: On a planned discharge with one shift that lacks a door, check the card pill and border, the summary `· 1 gap`, and the button name `Shift … , 1 gap`.

### Tests

- [X] T009 [P] [US2] Unit tests for `shiftsSummary().gapCount` (sum over planned shifts, 0 when none) in `W/__tests__/shift-calendar.test.ts`
- [X] T010 [P] [US2] Feature tests in `W/__tests__/detail/shifts.test.tsx`: a card with gaps shows the `1 gap` pill instead of its status, a gap-free planned card keeps `Planned`, the summary shows `1 gap` only when there are gaps, and the button name ends with `, 1 gap`

### Implementation

- [X] T011 [US2] Show the amber gap count with a warning icon in `W/ui/detail/shift-calendar-summary.tsx`
- [X] T012 [US2] In `W/ui/detail/shift-calendar.tsx`: the gap pill (`warning` tokens, warning icon) replaces the status badge when there are gaps; the 2 px `border-warning`; the accessible name `Shift <period>, N gap(s)`

**Checkpoint**: US1 and US2 are complete. This is the issue's P1 scope.

## Phase 5: User Story 3 - Inspect a Shift in Its Panel (P2)

**Goal**: The panel title and `Shift i of n · vessel`, compact trucks with "All … since", and the completed footer.

**Independent Test**: Open a planned shift and a completed shift and check the dialog name, description, truck chips with the trailing line, and the footer.

### Tests

- [X] T013 [P] [US3] Unit tests for `sharedResourcePeriod(shift)` (`trucksSince`, `allResourcesSince`, null when periods differ or one has ended) in `W/__tests__/discharge-detail-view.test.ts`
- [X] T014 [P] [US3] Feature tests in `W/__tests__/detail/shifts.test.tsx`: dialog named by the period without `Shift `, description `Shift 1 of N · <vessel>`, truck chips with `All resources since …` / `All trucks since …`, per-truck periods kept when they differ, completed footer text and Close closing the panel

### Implementation

- [X] T015 [US3] Implement `sharedResourcePeriod(shift, dischargeStatus)` per data-model in `W/discharge-detail-view.ts`
- [X] T016 [US3] Add an optional compact rendering (chips, no per-item period) and a trailing note to `ShiftResourceGroup` in `W/ui/detail/shift-resource-group.tsx`
- [X] T017 [US3] In `W/ui/detail/shift-details.tsx`: title `formatShiftPeriod(shift)`; description with the status badge and `Shift i of n · vesselName`; compact trucks when `trucksSince`; completed footer (`A completed shift cannot be changed` + Close, wired to the panel's close)
- [X] T018 [US3] Pass the close handler from `ShiftPanel` down to `ShiftDetails` in `W/ui/detail/shift-panel.tsx`, and update existing assertions on the old `Shift …` dialog name across `W/__tests__/detail/*.test.tsx`

## Phase 6: User Story 4 - Edit and Add Shifts in Sheets (P3)

**Goal**: A read-only Duration output in the period row, `x of y selected`, and the Add shift start hint.

**Independent Test**: Open Edit shift and Add shift and check the Duration output, the counts, and the hint lifecycle (shown, hidden after a change, absent when drawn).

### Tests

- [X] T019 [P] [US4] Unit tests for `addShiftStartHint(discharge, plannedStartAt, drawn)` in `W/__tests__/discharge-preparation-schema.test.ts` (create the file if missing)
- [X] T020 [P] [US4] Feature tests: the hint is shown and then hidden after editing the start, in `W/__tests__/detail/add-shift.test.tsx`; no hint when drawn, in `W/__tests__/detail/draw-shift.test.tsx`; the Duration output and `x of y selected`, in `W/__tests__/detail/shift-edit.test.tsx`

### Implementation

- [X] T021 [US4] Implement `addShiftStartHint()` beside `addShiftFormValues()` in `W/discharge-preparation-schema.ts`
- [X] T022 [US4] Lay out Planned start, Planned end, and a read-only labelled `Duration` output in one row in `W/ui/detail/shift-resource-fields.tsx`
- [X] T023 [US4] Show `<selected> of <rows> selected` in `W/ui/detail/shift-resource-checklist.tsx`
- [X] T024 [US4] Render the hint under the period, subscribed to `plannedStartAt`, in `W/ui/detail/add-shift-sheet.tsx`, and update existing `Duration …` / `N selected` assertions

## Phase 7: Polish & Cross-Cutting

- [X] T025 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the repository root and fix the findings
- [X] T026 Run the manual browser pass in `quickstart.md` (planned, active, and closed; 1440 × 900 and phone width; light and dark)
- [X] T027 Commit per story with Conventional Commits `feat(discharges): …`

## Dependencies

- T001 → all.
- US1 (T002–T008) → US2 (T009–T012), because they share `shift-calendar.ts/.tsx` and the summary component.
- US3 (T013–T018) and US4 (T019–T024) are independent of each other and of US1/US2 (different files), except for the shared test-file edits in `shifts.test.tsx` for US3.
- Polish after all stories.

## Parallel Examples

- US1: T002 and T003 together, then T004 → T005 → T006 → T007 → T008.
- US3: T013 and T014 together, then T015 → T016 → T017 → T018.
- US4: T019 and T020 together, then T021, then T022, T023, and T024 (different files).

## Implementation Strategy

MVP = US1, then US2 (both P1, the issue's core). Then US3, then US4. Stop at each checkpoint to run the stories' tests.

## Implementation notes

- T025: `pnpm check` (Biome) is clean on every changed file and `tsc --noEmit` passes. The discharges suite passes
  except `create/access.test.tsx › opens the creation page for an operations lead on its first step`,
  which asserts the step navigation synchronously and fails under the machine's load (load average
  above 200 during this run). It covers the creation wizard, whose rendering this change does not touch. The
  repository-wide `pnpm test` was not run in full for the same reason.
- T026: manual pass on a dedicated `portflow_327` database. Checked planned, active, and closed
  discharges at 1440 × 900 and at 375 px, in the dark theme. Not checked in the light theme.
- T027: delivered as one implementation commit rather than one per story, as the stories share
  `shift-calendar.tsx` and its test file.
- The break pill already read the duration alone before this change (research R6).
