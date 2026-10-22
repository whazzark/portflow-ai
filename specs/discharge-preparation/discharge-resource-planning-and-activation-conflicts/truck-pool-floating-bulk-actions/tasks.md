---

description: "Task list for the truck pool floating bulk actions (#326)"
---

# Tasks: Truck pool floating bulk actions

**Input**: Design documents from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/truck-pool-floating-bulk-actions/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-state.md](./contracts/ui-state.md), [quickstart.md](./quickstart.md)

**Tests**: Included. The constitution (IV) requires RED → GREEN → REFACTOR: every test task is
written and seen failing before the implementation task that follows it.

**Organization**: One phase per user story; each story is independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 floating bar, US2 summary/hint/popover, US3 V2 dialog and sheet
- Paths are relative to the repository root. `WEB` = `apps/web/src`;
  `DIS` = `apps/web/src/features/discharges`.

Shared test seams (existing, reuse): `renderDischargeTab`, `mockTruckPlanning`,
`allowFormJourneyTime` in `DIS/__tests__/support/test-helpers.ts`; `buildDischargeDetail`,
`buildPoolEntry`, `buildShift`, `buildTruckCandidate`, `listedDischarge` in
`DIS/__tests__/support/fixtures.ts`. The UI names and copy to assert are in
[contracts/ui-state.md](./contracts/ui-state.md).

---

## Phase 1: Setup

**Purpose**: Confirm a green baseline before changing anything.

- [ ] T001 Run `pnpm --filter @portflow/web test -- src/features/discharges` and `pnpm typecheck` from the repository root and confirm both pass on the untouched branch (record any pre-existing failure in the PR description instead of fixing it here)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared presentational bar US1 needs. US2 and US3 do not depend on it.

- [ ] T002 Create `apps/web/src/components/lifecycle/floating-selection-bar.tsx` exporting `FloatingSelectionBar({ label, countLabel, onClear, children, className? })`: a `div role="toolbar" aria-label={label}` wrapper with `sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 flex justify-center pointer-events-none`, and an inner `pointer-events-auto` pill styled like the existing toolbar in `apps/web/src/components/lifecycle/bulk-resource-lifecycle-actions.tsx` (rounded-xl, `bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10`, tokens only) containing the `countLabel` span (`tabular-nums whitespace-nowrap font-medium`), a ghost `Button size="sm"` « Clear » with an `XIcon aria-hidden`, then `children` (the actions). It renders nothing itself when hidden: callers mount it only when the selection is non-empty (research R3). Add a doc comment explaining why it is separate from `BulkResourceLifecycleActions` (research R1). Do not modify `bulk-resource-lifecycle-actions.tsx`.

**Checkpoint**: The bar exists; nothing uses it yet.

---

## Phase 3: User Story 1 - Withdraw selected trucks from a floating action bar (Priority: P1) 🎯 MVP

**Goal**: Replace the header `Withdraw (n)` button with the floating bar « n trucks selected · Clear · Withdraw ».

**Independent Test**: On a planned discharge, check trucks, see the bar, Clear it, then select two and withdraw them through the bar (quickstart steps 3–5).

### Tests for User Story 1 (write first, see them fail)

- [ ] T003 [US1] In `apps/web/src/features/discharges/__tests__/detail/withdraw-trucks.test.tsx`, rewrite `withdraws the selected trucks together, then clears the selection` to go through the bar: check two rows, assert `getByRole('toolbar', { name: 'Selected trucks' })` reads « 2 trucks selected » and does not contain either registration, click its « Withdraw », confirm the `alertdialog` « Withdraw 2 trucks? », and after success assert the toolbar is gone and no row checkbox is checked. Assert the region no longer has a button named /^Withdraw \(\d+\)$/.
- [ ] T004 [US1] In the same file, add tests: (a) checking one truck shows « 1 truck selected » and no toolbar exists before any check; (b) « Clear » unchecks every row and « Select all trucks », removes the toolbar, and moves focus to « Select all trucks »; (c) unchecking the last selected row removes the toolbar; (d) cancelling the confirmation keeps the toolbar with the same count; (e) withdrawing one selected truck through its row « Withdraw <registration> » button leaves the other selected truck in the bar (« 1 truck selected »).
- [ ] T005 [P] [US1] In `apps/web/src/features/discharges/__tests__/detail/truck-planning-stale-state.test.tsx`, update `counts only trucks still held once the pool refreshes without one of them` to assert the count through the toolbar (« n trucks selected ») and that the toolbar disappears when the refresh removes every selected truck.
- [ ] T006 [P] [US1] In `apps/web/src/features/discharges/__tests__/detail/truck-pool.test.tsx`, add: the « Select all trucks » checkbox is named so (renamed from « Select all held trucks »); a non-preparer and an active discharge show no checkbox, no `Withdraw <registration>` button and no toolbar; switching to another section tab and back shows no toolbar (selection cleared, research R4).

### Implementation for User Story 1

- [ ] T007 [US1] In `apps/web/src/features/discharges/ui/detail/discharge-truck-pool-card.tsx`: remove the `Withdraw (n)` button from `DetailSection` actions (keep « Add trucks »); rename the header checkbox's `aria-label` to « Select all trucks » and give it a ref; when `canCorrect && selectedIds.length > 0`, render `<FloatingSelectionBar label="Selected trucks" countLabel={…} onClear={…}>` after the table with a destructive `Button size="sm"` « Withdraw » calling `setWithdrawing(selectedIds)`; `countLabel` is « 1 truck selected » / « n trucks selected »; `onClear` calls `selection.clear()` then focuses the select-all checkbox; while the bar is shown add bottom padding (e.g. `pb-20`) to the section content so the last row can scroll clear of the bar. Keep the existing `retainOnly` effect.
- [ ] T008 [US1] Run `pnpm --filter @portflow/web test -- src/features/discharges/__tests__/detail` until T003–T006 pass; adjust any other existing test that referenced « Select all held trucks » or `Withdraw (n)`.

**Checkpoint**: US1 is shippable alone — the MVP.

---

## Phase 4: User Story 2 - Read the pool's state and competition at a glance (Priority: P2)

**Goal**: Summary line, « Also held by » hint, popover on the warning icon, Suspended marker, Shifts column.

**Independent Test**: Quickstart steps 1–2 on a pool with a suspended and a contested truck.

### Tests for User Story 2 (write first, see them fail)

- [ ] T009 [P] [US2] In `apps/web/src/features/discharges/__tests__/truck-pool-selection.test.ts`, add unit tests for `poolSummary(detail)` (held only; released and CLOSED excluded; `suspendedCount`; `contested`; `contestedByActive`) and `shiftCountByTruck(detail)` (counts PLANNED shifts whose current trucks include the truck; ended memberships `effectiveTo !== null` not counted; absent truck → 0).
- [ ] T010 [P] [US2] In `apps/web/src/features/discharges/__tests__/detail/truck-pool.test.tsx`, add: summary « 3 trucks reserved · 1 suspended » and « 1 truck reserved » (no suspended part), absent on an empty pool; hint « Also held by planned discharges: the first to start keeps the truck » when a held truck has a PLANNED holding, « Also held by other discharges: a truck can serve only one active discharge » when one holding is ACTIVE, absent when none; clicking the button « Also held by MV X · Planned, MV Y · Planned » opens a `dialog` named « Also held by » listing both and the settling sentence, Escape closes it and focus returns to the button; Shifts column header and per-row counts (held row used by 2 planned shifts shows « 2 », unused held row « 0 », released row « — »); the existing suspended-marker test still passes.

### Implementation for User Story 2

- [ ] T011 [US2] In `apps/web/src/features/discharges/truck-pool-selection.ts`, add `poolSummary(detail)` and `shiftCountByTruck(detail)` per [data-model.md](./data-model.md), reusing `heldPoolEntries` and `currentTruckIds`; make T009 pass.
- [ ] T012 [US2] In `apps/web/src/features/discharges/ui/detail/truck-holdings.tsx`, replace the `Tooltip` with `Popover`/`PopoverTrigger`/`PopoverContent` from `apps/web/src/components/ui/popover.tsx`: the trigger keeps its current `aria-label` and warning styling; the content has a title « Also held by » (used as the popover's accessible name), the « vessel · Status » list, and the settling sentence. Keep the `holdings.length === 0 → null` guard.
- [ ] T013 [US2] In `apps/web/src/features/discharges/ui/detail/discharge-truck-pool-card.tsx`, above the table (pool not empty): render the summary line from `poolSummary` (« 1 truck reserved » / « n trucks reserved », then « · n suspended » when > 0) and, when `contested`, the hint with a `TriangleAlertIcon` (`text-warning`, `aria-hidden`) and the copy chosen by `contestedByActive` (contract). Add a « Shifts » column after « Transport company » showing `shiftCountByTruck` for held rows and « — » for released rows. Run the T010 tests until green.

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Withdraw and reserve with the V2 dialog and sheet (Priority: P3)

**Goal**: V2 copy in the withdraw confirmation; Add trucks sheet grouped by company with inline holdings.

**Independent Test**: Quickstart steps 5–6.

### Tests for User Story 3 (write first, see them fail)

- [ ] T014 [P] [US3] In `apps/web/src/features/discharges/__tests__/detail/withdraw-trucks.test.tsx`, update `withdraws one truck after naming the planned shifts it leaves` to expect « AA-100-AA leaves the pool of MV Atlantic Dawn. » and « It is also removed from the 1 shift that uses it: »; add a several-truck case expecting « AA-100-AA, BB-200-BB leave the pool of MV Atlantic Dawn. » and « They are also removed from the 1 shift that uses them: »; add a case with no affected shift expecting no `list`. Keep the refusal tests unchanged and passing.
- [ ] T015 [P] [US3] In `apps/web/src/features/discharges/__tests__/truck-pool-selection.test.ts`, add unit tests for `candidateGroups(candidates, selectedIds)`: groups by `transportCompany.id`, sorted by company name then registration, with `total` and `selected`.
- [ ] T016 [P] [US3] In `apps/web/src/features/discharges/__tests__/detail/reserve-trucks.test.tsx`, add: candidates of two companies render under group headers named after each company with « 2 » then « 1 of 2 » after checking one; « 3 trucks not in the pool » stays when a search narrows the list; a group with no matching candidate is hidden by the search; a candidate with holdings shows « Held by MV X, MV Y · Planned » as text; the existing reserve, refusal, retry, and double-submit tests still pass.

### Implementation for User Story 3

- [ ] T017 [US3] In `apps/web/src/features/discharges/ui/detail/withdraw-trucks-dialog.tsx`, change the description to « <registrations> leaves|leave the pool of <discharge.vesselName>. » and the shift lead-in to « It is also removed from the n shift(s) that use(s) it: » / « They are also removed from the n shift(s) that use(s) them: » (singular/plural on both counts), keeping the chronological list and all refusal handling; make T014 pass.
- [ ] T018 [US3] In `apps/web/src/features/discharges/truck-pool-selection.ts`, add `candidateGroups(candidates, selectedIds)` per [data-model.md](./data-model.md); make T015 pass.
- [ ] T019 [US3] In `apps/web/src/features/discharges/ui/detail/truck-holdings.tsx`, add an exported `TruckHoldingsText({ holdings })` rendering « Held by <vessels> · <Status> » with vessels joined by « , » and one segment per status (joined by « ; »), prefixed with the warning icon (`aria-hidden`), `text-muted-foreground text-xs`.
- [ ] T020 [US3] In `apps/web/src/features/discharges/ui/detail/add-trucks-sheet.tsx`, render the visible candidates through `candidateGroups`: a « n trucks not in the pool » line (all loaded candidates) above the list, one block per company with a header showing the company name and `total` or « selected of total », candidate rows keeping their checkbox and label, and `TruckHoldingsText` replacing the `TruckHoldings` icon. Keep search, « Select all », remembered refused candidates (placed in their company's group), refusal alert, retry, and footer unchanged; make T016 pass.

**Checkpoint**: All three stories work independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T021 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the repository root and fix every failure.
- [ ] T022 Walk [quickstart.md](./quickstart.md) steps 1–8 in the browser (both themes, 375 px width) and fix any layout issue: bar inside the content column, last row reachable, no horizontal page scroll, popover and bar operable by keyboard.
- [ ] T023 Obtain a fresh read-only Claude Code review of the final diff (`/code-review` in a new session or a read-only subagent), resolve or justify every confirmed finding, and update the shared session note `issue-326.md` if the `FloatingSelectionBar` API changed from the plan.

---

## Dependencies & Execution Order

- **Setup (T001)** → everything.
- **Foundational (T002)** → US1 only.
- **US1 (T003–T008)**: depends on T002. MVP.
- **US2 (T009–T013)**: depends on T001 only. Touches `discharge-truck-pool-card.tsx` (T013) after US1's T007 if both are done in one branch — do T013 after T007 to avoid editing the same file twice in parallel.
- **US3 (T014–T020)**: depends on T001 only. T019 edits `truck-holdings.tsx` after US2's T012 — run T019 after T012.
- **Polish (T021–T023)**: after the stories delivered.

Within a story: tests → helpers → components. Same-file tasks are sequential: T003/T004/T014 (`withdraw-trucks.test.tsx`), T006/T010 (`truck-pool.test.tsx`), T009/T015 (`truck-pool-selection.test.ts`), T011/T018 (`truck-pool-selection.ts`).

## Parallel Example

```text
# After T002, write the US1 tests that touch different files together:
T005 truck-planning-stale-state.test.tsx
T006 truck-pool.test.tsx
# US2 and US3 test-writing in parallel (different files):
T009 truck-pool-selection.test.ts   T016 reserve-trucks.test.tsx
```

## Implementation Strategy

1. T001–T008: ship-ready MVP (the issue's core problem). Commit.
2. T009–T013: summary, hint, popover, Shifts column. Commit.
3. T014–T020: V2 dialog copy and grouped Add trucks sheet. Commit.
4. T021–T023: full verification, browser walk, fresh review; open the Draft PR once US1 is green.
