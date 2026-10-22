# Tasks: Product Lots Grouped by Customer

**Input**: Design documents from `specs/interface-v2/discharges/product-lots-grouped-by-customer/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/product-lots-tab.ui.md](./contracts/product-lots-tab.ui.md),
[quickstart.md](./quickstart.md)

**Tests**: Required. The constitution (IV) and AGENTS.md require TDD for observable behavior: each
story writes its failing tests first, then the minimal implementation.

**Organization**: One phase per user story, in spec priority order. Web only (`apps/web`); no API
change.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: the user story the task serves (US1–US4)

## Path Conventions

`W` = `apps/web/src/features/discharges` (written out in full in each task).

---

## Phase 1: Setup

**Purpose**: Confirm the baseline before changing behavior.

- [X] T001 Run the existing discharge web suites from `apps/web` (`pnpm --filter @portflow/web exec vitest run src/features/discharges`) and record that they pass on the branch before any change; note any pre-existing failure in this file instead of fixing it
  - Note (2026-10-22): under a machine load average near 290 (sibling sessions) the suite times out at the repository's 3 s async timeout (99 failures, all timeouts). Runs use a local, git-excluded `vitest.slow.config.ts` that only raises timeouts; targeted files pass with it.
  - Note: `applyDetail` refreshes the start check only for a discharge still planned, so a successful start does not refetch a check that now answers `E_DISCHARGE_NOT_PLANNED`. A default `start-check` MSW handler (identical to #324's) answers suites that do not care.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The door-problem derivation and its freshness, used by US1, US2 and US4.

- [X] T002 [P] Write failing unit tests for `lotDoorProblems(detail, problems)` and `productLotsSummary(detail, doorProblems)` in `apps/web/src/features/discharges/__tests__/discharge-detail-view.test.ts`, per data-model.md: planned lot without any current assignment (`effectiveTo === null`) is in `noDoor` even when it has ended assignments; lot with a current door is not; active and closed discharges give empty results; `WAREHOUSE_DOOR_HELD` problems with `context.type === 'PRODUCT_LOT'` fill `heldDoors` (lot → door → `holder.vesselName`, falling back to `another active discharge`); `problems === null` gives `heldKnown: false` and an empty `heldDoors`; summary counts lots, distinct customers, `lotsWithoutDoor`, and held (lot, door) pairs. Use builders from `apps/web/src/features/discharges/__tests__/support/fixtures.ts` (`buildStartProblem`)
- [X] T003 Implement `lotDoorProblems` and `productLotsSummary` (exported, pure, documented like the neighbouring helpers) in `apps/web/src/features/discharges/discharge-detail-view.ts` until T002 passes; reuse the existing current-assignment logic used by `lotDoorCell` rather than re-deriving it
- [X] T004 Make `applyDetail` in `apps/web/src/features/discharges/mutations/use-discharge-mutations.ts` also invalidate `dischargeQueries.startCheck(response.data.id)` (plan D4; #324 makes the same change — keep a single call when rebasing)

**Checkpoint**: derivation green; every successful lot/door/customer change refreshes the start check.

---

## Phase 3: User Story 1 - See Every Lot's Door Problem at a Glance (Priority: P1) 🎯 MVP

**Goal**: Planned discharges show « No door » and « Held by <vessel> » per lot, plus a summary with
problem counts, consistent with the start check.

**Independent Test**: Planned discharge with one lot without door, one lot whose door is held by an
active discharge, one clean lot → amber « No door », « Held by MV … » on the held chip only, summary
`3 lots · N customers · X t`, `1 lot without a door`, `1 door held by another discharge`.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T005 [US1] Add failing feature tests in `apps/web/src/features/discharges/__tests__/detail/product-lots.test.tsx` (render through the router with the MSW helpers of `__tests__/support/test-helpers.ts`, start-check handler returning `WAREHOUSE_DOOR_HELD` with a holder): (a) administrator sees « No door » on the lot without a current door and no dash; (b) only the held door's chip shows « Held by <vessel> », other doors of the same lot do not (US1-AS2, AS3); (c) the summary reads lots · customers · total, then `N lots without a door` and `N doors held by another discharge` (singular/plural), and shows no problem counts on a clean discharge (AS4, AS5); (d) after assigning a door through the existing dialog, the « No door » indicator and its count disappear without reload, and the start check was requested again (AS7, FR-010); (e) when the start check fails (500) the lots, totals and « No door » still render and no « Held by » nor held count appears (FR-011); (f) an observer sees « No door » but no « Held by », no held count, and no start-check request is made (spec Assumptions, plan D2)

### Implementation for User Story 1

- [X] T006 [US1] In `apps/web/src/features/discharges/ui/detail/discharge-product-lots-card.tsx`, subscribe with `useQuery({ ...dischargeQueries.startCheck(discharge.id), enabled: canCorrect })`, compute `lotDoorProblems(discharge, check.data?.data.problems ?? null)` (null while loading, on error, or disabled) and `productLotsSummary`, and render the summary line above the table (`N lots · N customers · total`, then the non-zero problem counts in `text-warning`, joined by ` · `), per contracts/product-lots-tab.ui.md
- [X] T007 [US1] In `apps/web/src/features/discharges/ui/detail/lot-door-chips.tsx`, accept the lot's problems (`noDoor: boolean`, `heldBy: ReadonlyMap<doorId, vesselName>`): on a planned discharge, a lot in `noDoor` renders the text « No door » in `text-warning` instead of the dash/`No warehouse door currently assigned` notice; a held door's chip uses the warning tone and is followed by « Held by <vessel> » in text (not color alone); keep the `+N` overflow, the archived marker and the history popover untouched (#329 owns history). Pass the problems from the card (T006)
- [X] T008 [US1] Run T002 and T005 suites green, then refactor the card/chips for readability without changing behavior

**Checkpoint**: US1 delivers the MVP — problems are visible on the tab.

---

## Phase 4: User Story 2 - Fix a Door Problem in One Step (Priority: P1)

**Goal**: An inline Assign doors action on problem lots, and a V2 Assign doors dialog that explains
each door's situation.

**Independent Test**: Click Assign doors beside « No door », add a door, Save → indicator gone; open
the held lot's dialog → the held door names its active holder and says it blocks the start.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T009 [P] [US2] Add failing feature tests in `apps/web/src/features/discharges/__tests__/detail/product-lots.test.tsx`: a button named `Assign doors for <customer> · <product>` sits beside « No door » and beside « Held by … » for an administrator and opens the dialog for that lot (US2-AS1); no such button for an observer, nor on active/closed discharges (AS2); lots without a problem have no inline button
- [X] T010 [P] [US2] Add failing feature tests in `apps/web/src/features/discharges/__tests__/planning/lot-doors.test.tsx`: dialog description reads `<customer> · <product> · <quantity>` (AS3); an available door with other planned discharges shows the visible text `Also on N discharges` (AS4); an assigned door held by an active discharge shows `Held by <vessel> (Active). It blocks this discharge's start until <vessel> releases it.` (AS5); a door kept by planned shifts reads `Used by N shift(s). Remove it from them before removing it from the lot.` with its shift links and no Remove (AS6); the footer reads `No change yet` before any change and the change summary after one (AS7); the rule note `A door serves one lot of a discharge at a time. Several planned discharges may share it: the one that starts first uses it.` is shown (AS8). Update existing assertions on the old wording (`Remove it from the shift first`) rather than keeping both

### Implementation for User Story 2

- [X] T011 [US2] In `apps/web/src/features/discharges/ui/detail/discharge-product-lots-card.tsx`, render the inline « Assign doors » button (`variant="outline"`, small size, accessible name `Assign doors for <lotLabel>`) beside the indicator, only when `canCorrect` and the lot has a door problem, calling `setPlanningDoors(lot)`; pass the lot's held map to `LotWarehouseDoorsDialog` as a new `heldBy` prop
- [X] T012 [P] [US2] In `apps/web/src/features/discharges/ui/planning/lot-warehouse-doors-dialog.tsx`, append the formatted expected quantity to the `DialogDescription`, thread `heldBy` to `AssignedDoorsColumn`, and render the muted one-lot rule note under the columns (desktop and phone tabs)
- [X] T013 [P] [US2] In `apps/web/src/features/discharges/ui/planning/assigned-doors-column.tsx`, add a `warning` note for a door in `heldBy` with the D7 sentence (vessel and « Active »); in `apps/web/src/features/discharges/ui/planning/door-transfer-row.tsx`, replace `REMOVE_FROM_SHIFT_FIRST` with a function of the shift count producing `Used by N shift(s). Remove it from them before removing it from the lot.` and update its users in `assigned-doors-column.tsx` and `available-doors-column.tsx`
- [X] T014 [P] [US2] In `apps/web/src/features/discharges/ui/planning/door-holdings.tsx`, show the visible text `Also on N discharge(s)` next to the warning icon (tooltip and hidden hints kept)
- [X] T015 [P] [US2] In `apps/web/src/features/discharges/ui/planning/lot-door-change-summary.tsx`, render `No change yet` (muted) when there is no add, remove or move, inside the same live region
- [X] T016 [US2] Run T009, T010 and the existing `__tests__/planning/lot-doors-refusals.test.tsx` and `__tests__/planning/stale-state.test.tsx` green; refactor

**Checkpoint**: problems are visible and fixable in one click.

---

## Phase 5: User Story 3 - Read a Discharge's Lots Customer by Customer (Priority: P2)

**Goal**: The V2 grouped table for every status, with the right actions per role and status and the
active read-only note.

**Independent Test**: Three customers, one with two lots → three customer rows with count and
subtotal, subtotals add up to Expected total; active discharge shows the read-only note and no
actions.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [ ] T017 [US3] Add failing feature tests in `apps/web/src/features/discharges/__tests__/detail/product-lots.test.tsx`: customer rowgroups named by the customer with `N lot(s)` and subtotal, lot rows with product, description and quantity, Expected total equal to the sum of subtotals (US3-AS1–AS4, SC-004); administrator on planned sees customer `Edit <customer>`, lot menu (Edit, Assign doors, Remove) and Add product lots (AS5); observer, and administrator on active/closed, see none of them (AS6); active discharge shows `Read-only while the discharge is active` and no amber indicator (AS7, FR-012); empty state with Add product lots for a preparer (AS8). Keep tests that already cover these and only add the missing assertions

### Implementation for User Story 3

- [ ] T018 [US3] In `apps/web/src/features/discharges/ui/detail/discharge-product-lots-card.tsx`, add the `Read-only while the discharge is active` note beside the summary for `discharge.status === 'ACTIVE'`, and restyle the table to the V2 *Retenue* `planned-product-lots` artboard (customer row, lot rows with description beneath the product, footer) using existing tokens only; long names and descriptions wrap without pushing quantity and doors out of view
- [ ] T019 [US3] Run T017 and the existing `__tests__/detail/remove-product-lot.test.tsx` green; refactor

---

## Phase 6: User Story 4 - Edit, Correct, and Add Lots in Sheets (Priority: P2)

**Goal**: The lot edit sheet shows the lot's doors and hands off to Assign doors; the customer-lots
and add-lots sheets match the V2 copy.

**Independent Test**: Edit a lot with a held door → doors shown read-only with « Held by … », Assign
doors opens the dialog, no door field in the form.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [ ] T020 [P] [US4] Add failing feature tests in `apps/web/src/features/discharges/__tests__/detail/correct-product-lot.test.tsx`: the Edit product lot sheet shows a « Warehouse doors » group with the lot's chips and their indicators, the note `Doors are changed from Assign doors, not from this form.`, and an « Assign doors » button that closes the sheet and opens the lot's Assign doors dialog (US4-AS1, AS2); saving the form still sends only customer, product, quantity and description
- [ ] T021 [P] [US4] Add failing assertions in `apps/web/src/features/discharges/__tests__/detail/correct-customer-product-lots.test.tsx` and `apps/web/src/features/discharges/__tests__/detail/add-product-lots.test.tsx` for the running footer `N lot(s) · total` that follows edits, the `—` total while no quantity is entered (add), and the customer's current subtotal shown with the customer (customer correction) (AS3, AS4); if the current UI already satisfies an assertion, keep it as a regression test

### Implementation for User Story 4

- [ ] T022 [US4] In `apps/web/src/features/discharges/ui/detail/product-lot-sheet.tsx`, add the read-only « Warehouse doors » group (reusing `LotDoorChips` with the lot's problems), the note, and an « Assign doors » button calling a new `onAssignDoors(lot)` prop; in `apps/web/src/features/discharges/ui/detail/discharge-product-lots-card.tsx`, pass `onAssignDoors` that clears `editing` and sets `planningDoors`, and pass the lot's problems
- [ ] T023 [P] [US4] Adjust only the copy that differs from the V2 artboards in `apps/web/src/features/discharges/ui/detail/customer-product-lots-sheet.tsx`, `apps/web/src/features/discharges/ui/detail/add-product-lots-sheet.tsx` and `apps/web/src/features/discharges/ui/preparation/product-lot-group-fields.tsx` until T021 passes; no validation or submission change (FR-028)
- [ ] T024 [US4] Run T020, T021 green; refactor

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T025 Run `pnpm check`, `pnpm typecheck` and `pnpm test` at the repository root; fix every failure caused by this change
- [ ] T026 Walk through quickstart.md manually (administrator, observer, active discharge) at desktop and 375 px width in the browser; check no horizontal page scroll, dialog tabs on phone, amber tone readable in light and dark mode (SC-006, FR-029)
- [ ] T027 Obtain a fresh read-only Claude Code review of the final diff (`/code-review` in a new session or a read-only subagent), resolve or justify every confirmed finding, and mark the tasks above `[X]`

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T004)** → stories.
- **US1 (T005–T008)** depends on T003. It is the MVP.
- **US2 (T009–T016)** depends on US1's card changes (T006–T007) for the inline action and `heldBy`;
  dialog tasks T012–T015 are independent of each other.
- **US3 (T017–T019)** depends only on Foundational; it touches the card after US1/US2 to avoid
  conflicting edits of `discharge-product-lots-card.tsx`.
- **US4 (T020–T024)** depends on T007 (chips with problems) and T011 (dialog hand-off state).
- **Polish (T025–T027)** after all stories.

### Within each story

Tests first and failing → implementation → green → refactor.

## Parallel Opportunities

- T002 with T004 (different files).
- US2: T009 with T010; then T012, T013, T014, T015 together (four different files).
- US4: T020 with T021; T023 with T022 (different files).

```text
# US2 dialog implementation, in parallel:
T012 lot-warehouse-doors-dialog.tsx
T013 assigned-doors-column.tsx + door-transfer-row.tsx
T014 door-holdings.tsx
T015 lot-door-change-summary.tsx
```

## Implementation Strategy

1. **MVP**: Setup + Foundational + US1 → problems visible on the tab; stop and validate.
2. **+US2**: one-click fix and explanatory dialog (completes the issue's core outcome).
3. **+US3**: V2 layout and active note.
4. **+US4**: sheets.
5. Polish, review, Draft PR → ready.

## Notes

- No API change: if a test seems to need one, stop and revisit the plan.
- `LotDoorChips`' history popover stays as is for #329.
- Commit after each phase with Conventional Commits (`feat(discharges): …`), no attribution trailers.
