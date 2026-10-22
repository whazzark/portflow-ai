# Tasks: Closed Discharge Record Without Door History

**Input**: Design documents from `specs/interface-v2/discharges/closed-discharge-record-without-door-history/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/ui-state.md](./contracts/ui-state.md),
[quickstart.md](./quickstart.md)

**Tests**: Required. The constitution (IV) and AGENTS.md mandate TDD: each test task is written
first and must fail before its implementation task.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified on
its own. All paths are relative to the repository root; `web/` below abbreviates
`apps/web/src/features/discharges/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Confirm a green baseline before changing behavior.

- [ ] T001 Run `pnpm --filter web exec vitest run src/features/discharges` and `pnpm typecheck` from the repository root and confirm both pass on the branch before any change

---

## Phase 2: Foundational

**Purpose**: The closed record's period, used by the header (US1). No other shared prerequisite: US2 and US3 do not depend on it.

- [ ] T002 Write failing unit tests for `closedRecordPeriod(detail, closedAt?)` in `apps/web/src/features/discharges/__tests__/closed-discharge-record.test.ts`: start is `startedAt`; without it, the earliest `shifts[].actualStartAt`; without either, `null`; end is the given `closedAt` or `null` when omitted (data-model.md, ClosedRecordPeriod; research R2)
- [ ] T003 Create `apps/web/src/features/discharges/closed-discharge-record.ts` exporting `closedRecordPeriod` so T002 passes; doc-comment that the closure time arrives with #98 and is never inferred

**Checkpoint**: `closedRecordPeriod` is green; user story work can start.

---

## Phase 3: User Story 1 - Read a closed discharge at a glance (Priority: P1) 🎯 MVP

**Goal**: Closed header with Dock · Period · IMO · Expected tonnage and no actions; vessel comment on Overview only; Overview made of a frozen dock timeline then a Summary card.

**Independent Test**: Open a closed discharge with shifts, lots and trucks; the header and Overview alone answer dock, period, IMO, expected tonnage, vessel comment, the shift layout, and the shift, lot and truck counts (contracts/ui-state.md, Header and Overview).

### Tests for User Story 1 (write first, must fail)

- [ ] T004 [P] [US1] Add failing unit tests for `closedDockTimeline(detail)` to `apps/web/src/features/discharges/__tests__/closed-discharge-record.test.ts`: returns `null` without shifts; axis from local midnight before the earliest block start to local midnight after the latest block end; one day tick per local day with offsets in [0, 1]; blocks ordered by start, placed from `actualStartAt ?? plannedStartAt` to `plannedEndAt`, labelled with `formatShiftPeriod`; `startedMarker` at the period start's offset, `null` when the start is not recorded or off-axis
- [ ] T005 [P] [US1] Add failing unit tests for `closedDischargeSummary(detail)` to `apps/web/src/features/discharges/__tests__/closed-discharge-record.test.ts`: shift count; lot count; distinct customer count; expected total equal to the existing exact tonnage sum; distinct doors across all lots ordered by name; distinct `truckId` count; `allReleasedAt` = latest `releasedAt` when every pool entry has one, else `null`; zero counts on an empty discharge
- [ ] T006 [US1] Create failing feature tests in `apps/web/src/features/discharges/__tests__/detail/closed-record.test.tsx` using `buildDischargeDetail(listedDischarge('MV Loire Star', 'CLOSED'), …)` from `__tests__/support/fixtures.ts`, following the render helpers of `__tests__/detail/tabs.test.tsx`: (a) on every tab the header shows the vessel heading, the `Closed` badge, and the terms `Dock`, `Period`, `IMO`, `Expected tonnage` in that order, without `Expected start` or `Started`; (b) Period reads `<start> → Not recorded`, and `Not recorded → Not recorded` without `startedAt` or shift actual start; (c) no `Edit` or `Start discharge` button even for a preparer; (d) the vessel comment shows on Overview and not on Product lots, and nothing renders when the comment is empty; (e) Overview has the region `Dock timeline · <dock name>` then the region `Summary`, and no region named `Overview` or `Preparation`; (f) the timeline has a list `Shifts on the timeline` with one item per shift, a `Started` marker, and no `Now` or `Expected start` text; (g) the Summary shows `Closed discharges are read-only` and rows `Shifts`, `Product lots`, `Truck pool` with their counts, `Unloaded through …` and `All released on …` lines, and each row link opens its tab; (h) with no shift, no timeline region and `0 shifts`

### Implementation for User Story 1

- [ ] T007 [US1] Implement `closedDockTimeline` in `apps/web/src/features/discharges/closed-discharge-record.ts` so T004 passes, reusing `formatShiftPeriod` from `discharge-detail-view.ts`
- [ ] T008 [US1] Implement `closedDischargeSummary` in `apps/web/src/features/discharges/closed-discharge-record.ts` so T005 passes, reusing `sumTonnes` from `discharge-detail-view.ts` (as the product lots footer does)
- [ ] T009 [US1] Give `DischargeDetailHeader` in `apps/web/src/features/discharges/ui/detail/discharge-detail-header.tsx` a closed branch: facts `Dock`, `Period` (from `closedRecordPeriod`, each missing side `Not recorded`, joined by ` → `), `IMO`, `Expected tonnage`; no `Expected start`/`Started`; plus an optional `vesselComment` slot rendered under the facts when given. Planned and active facts stay as they are (FR-016)
- [ ] T010 [US1] In `apps/web/src/features/discharges/ui/detail/discharge-detail-page.tsx`, pass the vessel comment to the header only when the discharge is closed, the open tab is `overview`, and the comment is non-empty
- [ ] T011 [P] [US1] Create `apps/web/src/features/discharges/ui/detail/closed-dock-timeline.tsx`: a section labelled `Dock timeline · <dock name>` drawing day ticks and shift blocks with percentage offsets from `closedDockTimeline`, a `Started` marker, no timer and no Now; mirror the blocks in a visually hidden list `Shifts on the timeline`; scroll horizontally inside its own box at 375 px rather than widening the page
- [ ] T012 [P] [US1] Create `apps/web/src/features/discharges/ui/detail/closed-discharge-summary.tsx`: a `DetailSection` titled `Summary` with the note `Closed discharges are read-only` and three rows (`Shifts`, `Product lots`, `Truck pool`) from `closedDischargeSummary`, pluralised (`1 shift`/`2 shifts`), tonnage via `formatTonnes`, doors joined `A, B and C`, release via `formatDateTime`; each row a link built with `tabSearch` from `discharge-detail-sections.ts`
- [ ] T013 [US1] In `apps/web/src/features/discharges/ui/detail/discharge-detail-tabs.tsx`, render `ClosedDockTimeline` (when it has shifts) then `ClosedDischargeSummary` in the Overview tab of a closed discharge instead of `DischargeIdentityCard`; planned and active Overview unchanged; T006 passes
- [ ] T014 [US1] Adjust any existing closed-discharge assertion in `apps/web/src/features/discharges/__tests__/detail/identity.test.tsx` and `apps/web/src/features/discharges/__tests__/detail/tabs.test.tsx` that expected the identity card or the old header facts on a closed record, keeping their planned/active cases untouched

**Checkpoint**: US1 delivers the closed header and Overview on its own.

---

## Phase 4: User Story 2 - See the doors a product lot used, without door history (Priority: P1)

**Goal**: Each lot of a closed discharge shows its doors as chips, each once; no History control or Door history dialog is reachable.

**Independent Test**: Open the Product lots tab of a closed discharge whose lots had several successive assignments; each lot lists its doors once and no `History` control or `Door history` dialog exists (contracts/ui-state.md, Product lots tab).

### Tests for User Story 2 (write first, must fail)

- [ ] T015 [P] [US2] In `apps/web/src/features/discharges/__tests__/discharge-detail-view.test.ts`, change the closed `lotDoorCell` case to expect `shown` = `['a', 'b']`, `history` empty, and no `'history'` label; keep the planned/active `ended` cases
- [ ] T016 [P] [US2] In `apps/web/src/features/discharges/__tests__/detail/product-lots.test.tsx`, replace the test "shows a closed discharge's door left without an end as ended, not as held" with failing tests: a closed lot assigned A, then B, then A shows chips A and B once each; no button named `History` or `/ended/` and no dialog named `Door history` or `Ended assignments` on the tab; the `+N` button on a closed lot opens `Warehouse doors` listing doors without `Since`/`Ended`; no `Add product lots`, customer `Edit`, or row actions. Keep the active `Ended assignments` test (FR-016)

### Implementation for User Story 2

- [ ] T017 [US2] In `apps/web/src/features/discharges/discharge-detail-view.ts`, make `lotDoorCell` return `history: []` for a closed discharge and remove the `historyLabel` `'history'` variant (only `'ended'` remains); update its doc comment; T015 passes
- [ ] T018 [US2] In `apps/web/src/features/discharges/ui/detail/lot-door-chips.tsx`, drop the `label` prop and the `Door history`/`History` branch of `HistoryPopover`, so it only renders `N ended` / `Ended assignments`; T016 passes

**Checkpoint**: US2 removes the closed door history while planned/active keep `N ended`.

---

## Phase 5: User Story 3 - Consult the truck pool and shifts as a read-only record (Priority: P2)

**Goal**: Pin the existing read-only behavior of the closed Truck pool and Shifts tabs (research R7).

**Independent Test**: As a preparer, open each tab of a closed discharge; no edit, start, add, withdraw, release, reassign, or row action is available (contracts/ui-state.md, Truck pool and Shifts tabs).

### Tests for User Story 3

- [ ] T019 [P] [US3] Add to `apps/web/src/features/discharges/__tests__/detail/closed-record.test.tsx` regression tests as a preparer (`ACTIVE_OPERATIONS_LEAD` or the fixture used by `truck-pool.test.tsx`): the `Truck pool` tab label has no count; the table lists reserved and released times with no checkbox, bulk action bar, `Add trucks`, withdraw or release button; the Shifts tab offers no `Add shift`, opening a shift shows its panel without `Edit`. These are expected to pass without production change; if one fails, fix the gating in `apps/web/src/features/discharges/discharge-permissions.ts` or the card concerned

**Checkpoint**: US3 is pinned by tests.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T020 Run `pnpm check` (fix with `pnpm check:fix`), `pnpm typecheck`, and `pnpm test` from the repository root; all must pass
- [ ] T021 Run the browser walkthrough in `specs/interface-v2/discharges/closed-discharge-record-without-door-history/quickstart.md` (MV Loire Star, plus one planned and one active discharge, and at 375 px), comparing against the canvas `discharges-retenue-closed-*` screens; fix any visual or accessibility gap in the files touched above
- [ ] T022 Obtain a fresh read-only review of the final diff (`/code-review` in a new session or a read-only review subagent), resolve or justify every confirmed finding, then mark the tasks above `[X]`

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001)** → **Foundational (T002–T003)** → **US1**.
- **US2** and **US3** depend only on Setup; they can start in parallel with Foundational and US1.
- **Polish** after every story to be shipped.

### Within each story

- Tests first and red: T004–T006 before T007–T013; T015–T016 before T017–T018.
- T007/T008 before T011/T012 (components consume the view models); T009 before T010;
  T011 and T012 before T013; T013 before T014.
- T017 before T018.

### Parallel opportunities

- T004 and T005 (same new test file, separate `describe` blocks: write them together or in sequence; marked [P] against T006).
- T011 and T012 (separate new component files).
- T015 and T016 (different test files).
- US2 (T015–T018) and US3 (T019) in parallel with US1, since they touch different files — except
  `closed-record.test.tsx`, shared by T006 and T019: write T019 after T006.

### Parallel example: User Story 1

```text
Together: T004 + T005 (unit tests), then T006 (feature tests)
Then:     T007, T008
Together: T011 (closed-dock-timeline.tsx) + T012 (closed-discharge-summary.tsx), alongside T009 → T010
Then:     T013, T014
```

## Implementation Strategy

### MVP first

1. T001–T003, then US1 (T004–T014): the closed record reads as the V2 design at a glance.
2. US2 (T015–T018): the issue's core removal of door history; small and independent, so it can ship
   with the MVP in the same PR.
3. US3 (T019): regression guard.
4. Polish (T020–T022), then open the Draft PR.

### Notes

- Planned and active records must not change (FR-016): every edit is behind `status === 'CLOSED'`.
- Expect rebase overlap with #324, #325 and #328 on `discharge-detail-header.tsx`,
  `discharge-detail-tabs.tsx`, `lot-door-chips.tsx` and `discharge-detail-view.ts` (plan,
  Complexity Tracking).
- Commit after each green step with Conventional Commits, e.g.
  `feat(discharges): Show the closed record's period in its header`.
