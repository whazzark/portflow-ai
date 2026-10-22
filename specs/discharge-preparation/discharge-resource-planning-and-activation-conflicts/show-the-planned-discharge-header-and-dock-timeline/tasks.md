# Tasks: Show the Planned Discharge Header and Dock Timeline

**Input**: Design documents from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/show-the-planned-discharge-header-and-dock-timeline/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/discharge-detail-dock-occupations.md](./contracts/discharge-detail-dock-occupations.md), [quickstart.md](./quickstart.md)

**Tests**: Required. The constitution (IV) and AGENTS.md mandate TDD: every test task is written
first and must fail before its implementation task starts.

**Organization**: One phase per user story, in spec priority order (US1, US2 P1; US3, US4 P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task serves (US1–US4)

## Path Conventions

- API: `apps/api/app/discharges/...`, tests in `apps/api/tests/integration/discharges/...`
- Web: `apps/web/src/features/discharges/...`, tests in `apps/web/src/features/discharges/__tests__/...`
- Abbreviations below: `API_SHARED` = `apps/api/app/discharges/shared`;
  `WEB_D` = `apps/web/src/features/discharges`

---

## Phase 1: Setup

**Purpose**: Confirm a green baseline before changing anything.

- [ ] T001 Run `pnpm --filter @portflow/web test src/features/discharges` and `pnpm --filter @portflow/api test --files tests/integration/discharges/consultation/show.spec.ts` from the repo root and record that both pass on the unmodified branch (no file change)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `dockOccupations` field on the detail DTO and the web test support every story
relies on. US3 and US4 consume the field; US1–US4 feature tests need the fixtures and default
handlers.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### API: `dockOccupations` on the detail (contract)

- [ ] T002 Write failing integration tests in `apps/api/tests/integration/discharges/consultation/show.spec.ts` covering every scenario listed in `contracts/discharge-detail-dock-occupations.md` ("Integration test scenarios"): planned discharge on a dock with one ACTIVE and one PLANNED other discharge → both listed, ACTIVE first, with `expectedStartAt`, `startedAt`, `plannedStartAt` (min shift planned start), `plannedEndAt` (max shift planned end); other discharge without shifts → planned fields `null`; CLOSED discharge on same dock and discharge on another dock → absent; reading an ACTIVE or CLOSED discharge → `dockOccupations: []`. Use existing discharge/shift/dock factories as the other `show.spec.ts` tests do
- [ ] T003 Add the `DockOccupation` type (fields per `data-model.md`) and `dockOccupations: DockOccupation[]` to `DischargeDetailRead` in `API_SHARED/discharge_detail_read.ts`; update the `findDetail` doc comment in `API_SHARED/repositories/discharge_repository.ts` to describe occupations beside holdings
- [ ] T004 Implement `protected findDockOccupations(dockId, dischargeId)` in `API_SHARED/repositories/lucid_discharge_repository.ts`: one query on `discharges` left-joined to `shifts`, `where dock_id = ?`, `status in ('PLANNED','ACTIVE')`, `id <> ?`, grouped by discharge, selecting `min(shifts.planned_start_at)` / `max(shifts.planned_end_at)`, ordered ACTIVE first, then `coalesce(min planned start, expected_start_at)`, then `id`; call it from `findDetail` only when `discharge.status === 'PLANNED'` (else `[]`), mirroring how `findOtherHoldings` is wired
- [ ] T005 Emit `dockOccupations` (instants as ISO strings, like the other detail instants) in `API_SHARED/discharge_detail_transformer.ts`; make every other producer of `DischargeDetailRead` (grep `otherHoldings:` under `apps/api/app/discharges`) provide `dockOccupations` the same way so typecheck passes; T002 now passes
- [ ] T006 Regenerate the Tuyau/route registry if the repo requires it (see memory note "API test runner quirks": registry regen) and confirm `DischargeDetailDto['dockOccupations']` is typed in `apps/web` via `pnpm typecheck`

### Web: test support

- [ ] T007 Add `dockOccupations: []` to every detail built in `WEB_D/__tests__/support/fixtures.ts` (`buildDischargeDetail` and the `DISCHARGE_DETAILS` entries) and add a `buildDockOccupation(overrides)` fixture helper
- [ ] T008 In `WEB_D/__tests__/support/test-helpers.ts`, make `mockDischargeDetail` register a default `GET /discharges/:id/start-check` handler answering `{ data: { shiftId: <first planned shift id or null>, problems: [] } }`, overridable by a new `startProblems` option (and kept compatible with `mockDischargeStart`); run the discharge feature tests to confirm still green

**Checkpoint**: Detail DTO carries `dockOccupations`; web tests run with default start-check and occupations.

---

## Phase 3: User Story 1 — Key facts in the header (Priority: P1) 🎯 MVP

**Goal**: Planned record header shows vessel, Planned badge, Dock · Planned period · IMO · Expected
tonnage on every tab; vessel comment on Overview only; Edit/Start for preparers; no Overview identity
card for planned discharges.

**Independent Test**: Open a planned discharge with shifts, lots, and a comment; switch through all
four tabs; facts identical, comment only on Overview, no duplicate card (spec US1).

### Tests for User Story 1 ⚠️ write first, must fail

- [ ] T009 [P] [US1] Unit tests for `plannedPeriod(detail)` in `WEB_D/__tests__/discharge-detail-view.test.ts`: earliest start / latest end across unordered shifts, overlapping shifts, `null` without shifts
- [ ] T010 [P] [US1] Feature tests in `WEB_D/__tests__/detail/planned-header.test.tsx` covering US1 acceptance scenarios 1–8: facts line order and values on each tab (`renderDischargeTab` for every `DISCHARGE_DETAIL_TABS`), planned period vs "no shift planned" with expected start, comment shown on Overview only and absent when empty, archived dock marker, Edit/Start for a preparer and absent for `ACTIVE_OBSERVER`, no "Overview"/"Details" card heading on the Overview tab

### Implementation for User Story 1

- [ ] T011 [US1] Add `plannedPeriod(detail)` and a `formatPlannedPeriod` helper (reusing `formatDateTime`/`formatShiftPeriod` conventions) in `WEB_D/discharge-detail-view.ts`; T009 passes
- [ ] T012 [US1] In `WEB_D/ui/detail/discharge-detail-header.tsx`, for `status === 'PLANNED'` render the facts `dl` as Dock · Planned period · IMO · Expected tonnage (planned period from T011, "No shift planned · expected <date>" without shifts), and accept a `comment` slot rendered under the facts when provided; leave the ACTIVE/CLOSED facts line exactly as today
- [ ] T013 [US1] In `WEB_D/ui/detail/discharge-detail-page.tsx` pass the vessel comment slot to the header only when `tab === 'overview'`, the discharge is PLANNED, and the comment is non-empty
- [ ] T014 [US1] In `WEB_D/ui/detail/discharge-detail-tabs.tsx` stop rendering `DischargeIdentityCard` on the Overview tab when the discharge is PLANNED (keep it for ACTIVE/CLOSED, FR-024)
- [ ] T015 [US1] Update the planned-discharge expectations in `WEB_D/__tests__/detail/identity.test.tsx` and any other existing test that asserted the planned Overview card (grep for `Vessel comment` / `'Overview'` card headings under `WEB_D/__tests__`) to the new layout, without weakening active/closed assertions; T010 and the full discharge suite pass

**Checkpoint**: US1 independently shippable.

---

## Phase 4: User Story 2 — Know what blocks the start (Priority: P1)

**Goal**: Banner "n problems block the start" with Review opening the Start dialog; amber dot per tab
with a problem; accessible names; refreshed after changes; hidden for non-starters and on failure.

**Independent Test**: Planned discharge with lot and shift problems but none in the truck pool →
banner count, dots on Product lots and Shifts only, Review opens the same list; fixing all problems
removes banner and dots (spec US2).

### Tests for User Story 2 ⚠️ write first, must fail

- [ ] T016 [P] [US2] Unit tests for `problemTabs(sections)` in `WEB_D/__tests__/discharge-detail-sections.test.ts`: DOCK_HELD/DOCK_ARCHIVED → `overview`; LOT_WITHOUT_WAREHOUSE_DOOR and CUSTOMER_ARCHIVED (lot context) → `product-lots`; TRUCK_HELD → `truck-pool`; SHIFT_WITHOUT_TRUCK and responsible problems → `shifts`; several problems in one tab → one entry; none → empty set
- [ ] T017 [P] [US2] Feature tests in `WEB_D/__tests__/detail/start-blockers.test.tsx` covering US2 scenarios 1–8 with `startProblems` from T008: plural and singular banner copy; Review opens the Start dialog listing the same problems (reuse assertions style of `__tests__/start/start-problems.test.tsx`); no banner/dots with zero problems; dot mapping per tab; tab accessible name includes "contains a problem"; after a mutation that returns a fixed detail (e.g. assign a lot door via the existing planning mock) the start-check is refetched and the dot/count update without reload; start-check 500 → no banner/dots and Start still opens the dialog; `ACTIVE_OBSERVER` → no start-check request issued, no banner/dots

### Implementation for User Story 2

- [ ] T018 [US2] Add `problemTabs(sections)` to `WEB_D/discharge-detail-sections.ts` per `data-model.md`; T016 passes
- [ ] T019 [US2] Make `WEB_D/ui/start/start-discharge-action.tsx` controlled (`open`, `onOpenChange` props) while keeping its Start button and dialog mount; update its single caller
- [ ] T020 [US2] Update `WEB_D/queries/discharge-queries.ts` `startCheck` comment to cover the banner subscriber, and in `WEB_D/mutations/use-discharge-mutations.ts` invalidate `dischargeQueries.startCheck(id).queryKey` in `applyDetail` and in `refreshAfterStaleRefusal` / the other detail invalidations
- [ ] T021 [US2] Create `WEB_D/ui/detail/start-blockers-banner.tsx`: an `Alert` with warning tone (V2 `warning` token, icon + text), copy "n problems block the start" / "1 problem blocks the start", and a `Review` button calling `onReview`
- [ ] T022 [US2] In `WEB_D/ui/detail/discharge-detail-page.tsx`: `useQuery({ ...dischargeQueries.startCheck(id), enabled: discharge.status === 'PLANNED' && canPrepare })`; compute `problemTabs(startProblemSections(problems, discharge))`; lift the Start dialog `open` state (T019); render the banner between header and tabs when problems > 0 and the query succeeded; pass the problem tab set to `DischargeDetailTabs`
- [ ] T023 [US2] In `WEB_D/ui/detail/discharge-detail-tabs.tsx` accept `problemTabs`, render an amber dot (`aria-hidden`, `bg-warning`) on each affected trigger and append a visually hidden ", contains a problem" to its accessible name; counts unchanged (FR-012); T017 passes

**Checkpoint**: US1 + US2 shippable.

---

## Phase 5: User Story 3 — Dock timeline (Priority: P2)

**Goal**: Overview opens on a read-only dock timeline: other discharges' occupations (linking to their
records), Now, Expected start, shifts, gaps, overlaps in words, dock-free state; not on other tabs.

**Independent Test**: Dock held by an active discharge plus a planned competitor overlapping; then a
free dock with no shift (spec US3).

### Tests for User Story 3 ⚠️ write first, must fail

- [ ] T024 [P] [US3] Unit tests for `dockTimeline(detail, now)` in `WEB_D/__tests__/dock-timeline.test.ts` covering every rule in `data-model.md` "DockTimeline": span padding (10 %, ≥ 2 h) and the no-shift ± 12 h span; Now inside → position, outside → BEFORE/AFTER; shifts ordered; gaps only between non-touching shifts with durations; overlapping shifts → no gap; active occupation open-ended when `plannedEndAt` ≤ `startedAt` or null; planned without shifts → `pointOnly`; clipping flags; `overlapsPlannedPeriod`; occupations outside the span dropped; `dockFree`
- [ ] T025 [P] [US3] Feature tests in `WEB_D/__tests__/detail/dock-timeline.test.tsx` covering US3 scenarios 1–10 using `buildDockOccupation` and Vitest fake timers (`shouldAdvanceTime`): timeline is the first Overview content titled with the dock name; each occupation shows vessel, status, period and links to `/discharges/<id>`; open-ended "continues"; Now marker / before-after note; Expected start marker; shifts and "gap of <duration>"; overlap stated in text; "dock is free" state; no-shift state; timeline absent on Product lots, Truck pool, Shifts tabs; the hidden events list is reachable by role `list`

### Implementation for User Story 3

- [ ] T026 [US3] Implement pure `dockTimeline(detail, now)` in `WEB_D/dock-timeline.ts` per `data-model.md`; T024 passes
- [ ] T027 [US3] Create `WEB_D/ui/detail/dock-timeline-card.tsx`: `DetailSection` titled "Dock <name>", horizontally scrollable strip (min width on phones) with an occupations lane and a shifts lane positioned by percentage, Now and Expected start markers with labels, gap labels with duration, overlap and "continues" text badges, occupations as `Link` to the other discharge (keeping list search like `ProblemLink` does), plus a visually hidden `ol` of the same events; tokens only (`warning` for overlaps, `primary`/`indicator` for this discharge)
- [ ] T028 [US3] In `WEB_D/ui/detail/discharge-detail-tabs.tsx` render `DockTimelineCard` first in the Overview tab for PLANNED discharges (with `now` from `Date.now()` at render); T025 passes

**Checkpoint**: US3 shippable on top of the foundation.

---

## Phase 6: User Story 4 — Preparation card with Dock row (Priority: P2)

**Goal**: Below the timeline, Preparation card rows Dock, Product lots, Truck pool, Shifts, each
linking to where it is managed; Dock row states name or gap in words; no start verdict.

**Independent Test**: Lots missing doors, no truck, held dock → each row's fact/gap and links (spec US4).

### Tests for User Story 4 ⚠️ write first, must fail

- [ ] T029 [P] [US4] Unit tests for the `dock` entry of `preparationSummary` in `WEB_D/__tests__/discharge-detail-sections.test.ts`: archived dock → ARCHIVED; ACTIVE occupation → HELD with its vessel; otherwise no gap
- [ ] T030 [P] [US4] Extend `WEB_D/__tests__/detail/preparation-summary.test.tsx` for US4 scenarios 1–5: row order Dock, Product lots, Truck pool, Shifts; Dock row text for free / held ("Held by <vessel>") / archived with warning icon and words; Dock row moves focus to the timeline; other rows open their tabs; card is below the timeline; no "can start" verdict text

### Implementation for User Story 4

- [ ] T031 [US4] Add the `dock` entry to `preparationSummary` in `WEB_D/discharge-detail-sections.ts` per `data-model.md`; T029 passes
- [ ] T032 [US4] Add the Dock row first in `WEB_D/ui/detail/discharge-preparation-card.tsx` (fact = dock name, gap = "Dock archived" / "Held by <vessel> (active)"); its link targets the timeline card (give `DockTimelineCard` an `id` and `tabIndex={-1}`, focus it on activation) instead of a tab
- [ ] T033 [US4] Ensure the Overview order in `WEB_D/ui/detail/discharge-detail-tabs.tsx` is timeline then Preparation card for PLANNED; T030 passes

**Checkpoint**: All four stories complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T034 [P] Check the planned record at 375 px and desktop in light and dark mode (header wraps without truncation, timeline scrolls in its card, dots/banner use tokens), and fix layout issues in the touched components
- [ ] T035 [P] Confirm active and closed discharge records are unchanged (FR-024) by running `WEB_D/__tests__/detail/access.test.tsx`, `identity.test.tsx`, `tabs.test.tsx` and the `start/*` tests
- [ ] T036 Run `pnpm check`, `pnpm typecheck`, `pnpm test` at the repo root and fix every failure
- [ ] T037 Walk through `quickstart.md` "Manual journey" against the local stack and note any deviation in the PR description
- [ ] T038 Obtain a fresh read-only Claude Code review of the final diff (`/code-review` in a new session or a read-only review subagent) and resolve or justify every confirmed finding
- [ ] T039 Open a Draft PR from `feat/324-planned-discharge-header-dock-timeline` to `master` linking #324 and this spec; mark it ready only after T036–T038

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories → **Polish (Phase 7)**
- T002 → T003 → T004 → T005 → T006 (API, sequential: same files / types)
- T007, T008 depend on T006 (typed DTO); T007 → T008 (helpers use fixtures)

### User Story Dependencies

- **US1 (P1)**: after Phase 2; independent of other stories
- **US2 (P1)**: after Phase 2; shares `discharge-detail-page.tsx` and `discharge-detail-tabs.tsx` with US1 → run after US1 to avoid conflicts
- **US3 (P2)**: after Phase 2; touches `discharge-detail-tabs.tsx` → after US2
- **US4 (P2)**: needs `DockTimelineCard` from US3 for its Dock link target (T032) → after US3

### Within Each User Story

- Tests first, failing → pure helpers → components → wiring → updated existing tests green

### Parallel Opportunities

- T009 ∥ T010; T016 ∥ T017; T024 ∥ T025; T029 ∥ T030 (different test files)
- T034 ∥ T035
- US1 helper work (T011) can proceed while US2 unit tests (T016) are written, since they touch different files

---

## Parallel Example: User Story 3

```text
T024 Unit tests for dockTimeline in WEB_D/__tests__/dock-timeline.test.ts
T025 Feature tests in WEB_D/__tests__/detail/dock-timeline.test.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 → Phase 2 (API field + test support)
2. Phase 3 (US1): header facts, comment, identity card removed
3. Stop and validate US1 independently

### Incremental Delivery

1. US1 → US2 (banner + dots, the main operational value) → US3 (timeline) → US4 (Dock row)
2. Each checkpoint keeps the full discharge suite green
3. One PR for the issue (AGENTS.md: one issue, one branch, one PR); commits per phase

---

## Notes

- `[P]` tasks touch different files with no dependency on incomplete tasks
- Commit after each phase using Conventional Commits, e.g. `feat(discharges): ...`, without attribution trailers
- Do not change the Edit discharge sheet or the Start dialog's content (FR-022)
