---
description: "Tasks for the active discharge overview (#328)"
---

# Tasks: Active Discharge Overview

**Input**: Design documents from `specs/discharge-execution/active-discharge-record/active-discharge-overview/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/active-record-ui.md](./contracts/active-record-ui.md),
[quickstart.md](./quickstart.md)

**Tests**: Required. The constitution (IV) and `AGENTS.md` mandate TDD for observable behavior:
each test task is written first and must fail before its implementation task.

**Organization**: One phase per user story, in spec priority order. Paths below are relative to the
repository root; `WEB` = `apps/web/src/features/discharges`.

**Reuse rule (research D2)**: Tasks marked **(reuse)** first check `master` for the piece delivered
by #323 / #324 / #327. If it has merged, extend it instead of creating the file; if not, create it
at the stated path to the stated contract so the sibling branch adopts it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 from spec.md

---

## Phase 1: Setup

**Purpose**: Start from current `master` and know which shared pieces exist.

- [ ] T001 Rebase `feat/328-active-discharge-overview` on `origin/master` (the worktree's base sync), run `pnpm install`, and record in `specs/discharge-execution/active-discharge-record/active-discharge-overview/research.md` (under D2, "Implementation status") which of #323 (dock occupancy read), #324 (header Period/IMO, `dischargePeriod`, dock timeline), and #327 (week calendar) have merged
- [ ] T002 Run `pnpm --filter @portflow/web test` once to confirm a green baseline before any change

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Test fixtures and the shared period helper every story reads.

- [ ] T003 [P] Add an `activeDischargeDetail()` fixture to `apps/web/src/features/discharges/__tests__/support/fixtures.ts` modelled on the design's MV Ocean Cedar: status `ACTIVE`, `startedAt` 14/09/2026 06:00, IMO `9300002`, vessel comment, 5 lots over 5 customers (2 with a door in effect, 3 without), a 10-truck pool with 1 released, and 14 shifts in planned order (5 `COMPLETED` with `actualStartAt`, shift 6 `ACTIVE` with 2 trucks / 2 doors / 1 weighing area and responsible Claire Martin, 8 `PLANNED`, next one Sophie Dubois with 6 trucks); reuse `buildDischargeDetail`, `buildShift`, `buildLot`, `buildPoolEntry`, `buildDoorPeriod`
- [ ] T004 [P] Write failing unit tests for `dischargePeriod` in `apps/web/src/features/discharges/__tests__/discharge-detail-view.test.ts`: ACTIVE and CLOSED start at `startedAt`, PLANNED at `expectedStartAt`, `to` is the latest `plannedEndAt` and `null` without shifts **(reuse: skip if #324 shipped it with these cases)**
- [ ] T005 Implement `dischargePeriod(discharge)` and a `formatDischargePeriod` (`dd/mm/yyyy, hh:mm → dd/mm/yyyy, hh:mm` via `helpers/dates`) in `apps/web/src/features/discharges/discharge-detail-view.ts` until T004 passes **(reuse)**

**Checkpoint**: Fixture and period helper ready; stories can start.

---

## Phase 3: User Story 2 — Key facts in the header on every tab (Priority: P1)

**Goal**: The active header reads Dock · Period · IMO · Expected tonnage on every tab, without Edit
or Start; the vessel comment moves to Overview; no facts card on an active Overview.

**Independent Test**: Open the active fixture on each tab and assert the header facts, the absence
of actions, and the comment only on Overview (contract: Header, Overview item 1).

Delivered before US1 because US1's card sits in the Overview this phase reshapes.

### Tests (write first, must fail)

- [ ] T006 [P] [US2] Write `apps/web/src/features/discharges/__tests__/detail/active-header.test.tsx`: for each tab of the active fixture, the `h1` is the vessel, the badge reads `Active`, the facts list has `Dock`, `Period` (`14/09/2026, 06:00 → 18/09/2026, 22:00`), `IMO`, `Expected tonnage`; no `Edit` / `Start` button for an operations lead; `Vessel comment` shown on Overview only and absent when the comment is null; the Overview has no region named « Overview » repeating IMO / dock / tonnage
- [ ] T007 [P] [US2] Update `apps/web/src/features/discharges/__tests__/detail/identity.test.tsx` to the new header facts (Period and IMO in the header instead of Expected start / Started) for active and closed discharges, keeping its planned-discharge expectations aligned with #324 if merged

### Implementation

- [ ] T008 [US2] Change the facts line of `apps/web/src/features/discharges/ui/detail/discharge-detail-header.tsx` to `Dock` · `Period` (from `formatDischargePeriod`) · `IMO` (« Not specified » when null) · `Expected tonnage` **(reuse)**
- [ ] T009 [P] [US2] Create `apps/web/src/features/discharges/ui/detail/vessel-comment.tsx`: a labelled « Vessel comment » block rendering nothing when the comment is null **(reuse)**
- [ ] T010 [US2] In `apps/web/src/features/discharges/ui/detail/discharge-detail-tabs.tsx`, render the Overview per status: for `ACTIVE`, `VesselComment` then placeholders for the US1/US3/US4 cards, and no `DischargeIdentityCard`; keep planned/closed rendering untouched unless #324/#329 already changed it
- [ ] T011 [US2] Confirm `apps/web/src/features/discharges/ui/detail/discharge-detail-page.tsx` passes no header actions for an `ACTIVE` discharge (Edit and Start stay planned-only); make T006 and T007 pass

**Checkpoint**: US2 green; the active record shares the planned header.

---

## Phase 4: User Story 1 — Current shift card (Priority: P1) 🎯 MVP

**Goal**: The Overview leads with « Current shift »: position, period, duration, responsible,
trucks, doors, weighing areas, next shift; plus the between-shifts state.

**Independent Test**: Open the active fixture's Overview and assert the card against the contract;
swap the fixture to no ACTIVE shift and assert the between-shifts state.

### Tests (write first, must fail)

- [ ] T012 [P] [US1] Create `apps/web/src/features/discharges/__tests__/active-discharge-view.test.ts` with failing unit tests for `activeShiftSummary`: `ACTIVE` state with `position` 6 of 14, in-effect resources from `shiftResources`, `next` = first PLANNED after the active one with its counts, `next: null` when the active shift is last; `BETWEEN` state with `last` = last COMPLETED (end = `actualEndAt ?? plannedEndAt`) and `next` or `null`; `BETWEEN` with neither when no shift exists
- [ ] T013 [P] [US1] Create `apps/web/src/features/discharges/__tests__/detail/active-overview.test.tsx` with failing feature tests for the card: region « Current shift » is the first card after the vessel comment; it shows `Active`, `Shift 6 of 14 · <period> · 8 h`, `Responsible Claire Martin`, `Trucks (2)` with both registrations, `Warehouse doors (2)`, `Weighing areas (1)`, and `Next: Wed 16 Sept 06:00–14:00 · Sophie Dubois · 6 trucks, 1 door, 1 weighing area`; « No further shift planned » when the active shift is last; « No shift is active » with `Last:` and `Next:` in the between-shifts fixture; Add shift offered there to an operations lead and not to an observer; an archived door and an ineligible responsible carry the record's existing markings; « Open in Shifts » navigates to `?tab=shifts` with that shift's panel open

### Implementation

- [ ] T014 [US1] Implement `activeShiftSummary(discharge)` in `apps/web/src/features/discharges/active-discharge-view.ts` per data-model.md « ActiveShiftSummary », reusing `shiftResources`, `formatShiftPeriod`, `formatShiftDuration` from `discharge-detail-view.ts`, until T012 passes
- [ ] T015 [US1] Create `apps/web/src/features/discharges/ui/detail/active-shift-card.tsx` (« Current shift » region, `ShiftStatusBadge`, `ReferenceLabel` for archived resources, the existing ineligible-responsible marking from `shift-readiness.tsx`, an « Open in Shifts » `DischargeTabLink` carrying `shiftId` (the route search parameter the Shifts tab already opens panels with), and the between-shifts state with the existing `AddShiftSheet` action gated by `canAddShifts`); wrap long resource lists so the card never scrolls sideways at 375 px
- [ ] T016 [US1] Mount `ActiveShiftCard` first in the active Overview in `apps/web/src/features/discharges/ui/detail/discharge-detail-tabs.tsx`; make T013 pass

**Checkpoint**: MVP — the active record says who is working and with what.

---

## Phase 5: User Story 3 — Dock timeline with Now (Priority: P2)

**Goal**: After the card, the dock timeline shows this discharge's completed, in-progress, and
planned shifts, breaks, the other discharges on the dock, and a Now line.

**Independent Test**: With the active fixture and a mocked occupancy response holding one other
discharge, assert the timeline region, its legend, facts, lanes, the in-progress block's
accessible name, the overrun case, and the Now label.

### Tests (write first, must fail)

- [ ] T017 [P] [US3] Write failing unit tests in `apps/web/src/features/discharges/__tests__/dock-timeline.test.ts` for the ACTIVE states of the timeline model: window = whole days from `startedAt` to max(latest planned end, now); COMPLETED blocks from `actualStartAt` to `actualEndAt ?? plannedEndAt`; ACTIVE block to `max(plannedEndAt, now)` with `overrun` true only past its planned end; PLANNED blocks at planned periods; inter-shift breaks between consecutive blocks; other discharges as OCCUPANCY lanes excluding the current discharge; `now` null outside the window **(reuse: extend #324's tests if merged)**
- [ ] T018 [P] [US3] Add failing feature tests to `apps/web/src/features/discharges/__tests__/detail/active-overview.test.tsx`: region « Dock timeline · <dock> » follows the Current shift card and precedes Progress; legend Completed / In progress / Planned; facts `Started 14/09/2026, 06:00 · planned until 18/09/2026, 22:00`, `Shifts 5 of 14 completed`; this discharge's lane first, the other discharge's lane after it; the active block's accessible name includes « In progress »; a `Now dd/mm hh:mm` marker (fake timers); the timeline is absent from Product lots, Truck pool, and Shifts; an occupancy request failure leaves the timeline with this discharge's lane only and does not break the Overview

### Implementation

- [ ] T019 [US3] Add the dock occupancy read if absent, exactly per #323's contract `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/widen-the-creation-wizard-with-a-shift-preview/contracts/dock-occupancy.openapi.yaml` (route `discharges.dock_occupancy` declared before `/:id`, `DischargePolicy.list`, Japa functional tests for 200/401/403/422 and the PLANNED/ACTIVE-only, ordered result) under `apps/api/app/discharges/dock_occupancy/` and `apps/api/start/routes.ts`, then regenerate the Tuyau registry **(reuse: skip entirely if #323 merged)**
- [ ] T020 [US3] Add `dockOccupancy(dockId)` to `apps/web/src/features/discharges/queries/discharge-queries.ts` (`staleTime: 0`, like the others) **(reuse)**
- [ ] T021 [US3] Implement the timeline model in `apps/web/src/features/discharges/dock-timeline.ts` per data-model.md « DockTimeline », including the ACTIVE / COMPLETED states, overrun, and `now`, until T017 passes **(reuse: extend #324's model)**
- [ ] T022 [US3] Create or extend `apps/web/src/features/discharges/ui/detail/dock-timeline.tsx` to render the model with the « Marine sobre » status tokens, a status word or pattern on each block so colour is never the only signal, `HH–HH` block labels, a labelled Now line, and horizontal scrolling inside the timeline only (not the page) at phone width **(reuse)**
- [ ] T023 [US3] Mount the timeline after `ActiveShiftCard` in the active Overview in `apps/web/src/features/discharges/ui/detail/discharge-detail-tabs.tsx`, reading the current time once per render; make T018 pass

**Checkpoint**: US1–US3 green; the Active Shift is placed in time.

---

## Phase 6: User Story 4 — Progress card, read-only tabs, calendar highlight (Priority: P3)

**Goal**: The Overview ends with Progress; other tabs stay read-only except Add shift; the
calendar highlights the Active Shift.

**Independent Test**: Assert the Progress rows on the active fixture, the absence of correction
actions per tab and role, Add shift for preparers only, and the calendar's active block.

### Tests (write first, must fail)

- [ ] T024 [P] [US4] Add failing unit tests for `dischargeProgress` to `apps/web/src/features/discharges/__tests__/active-discharge-view.test.ts`: shift counts (14 · 5 completed · 1 active · 8 planned) and planned end; lots (5 · 5 customers · expected tonnage), lots with a door in effect with distinct door names in first-seen order, lots without; trucks held (`releasedAt === null`) and released with registration and time
- [ ] T025 [P] [US4] Add failing feature tests to `apps/web/src/features/discharges/__tests__/detail/active-overview.test.tsx` for region « Progress »: last card of the Overview; subtitle « Read-only while active, except adding shifts »; rows `14 shifts · 5 completed · 1 active · 8 planned` + « Ends Fri 18 Sept at 22:00 as planned », `5 lots · 5 customers · 16,790.500 t` + « 2 with a warehouse door (Porte Douane, Porte Nord) · 3 without », `9 trucks held` + « 1 released on 14/09/2026, 12:00 (CC-303-PF) »; each row's link opens its tab; no Progress and no Current shift card on planned and closed discharges (FR-016)
- [ ] T026 [P] [US4] Create `apps/web/src/features/discharges/__tests__/detail/active-read-only.test.tsx`: on the active fixture, Product lots and Truck pool offer no correction action to any `ACTIVE_ROLES` user; Shifts offers `Add shift` to operations lead / admin / organization admin and not to an observer, and no Edit on any shift panel; the ACTIVE shift block in the calendar carries the `Active` badge and a Now line is drawn (pins existing behavior, research D7/D8)

### Implementation

- [ ] T027 [US4] Implement `dischargeProgress(discharge)` in `apps/web/src/features/discharges/active-discharge-view.ts` per data-model.md « DischargeProgress », reusing `isInEffect` and `formatTonnes`, until T024 passes
- [ ] T028 [US4] Create `apps/web/src/features/discharges/ui/detail/discharge-progress-card.tsx` with the three rows and `DischargeTabLink` links, and mount it last in the active Overview in `apps/web/src/features/discharges/ui/detail/discharge-detail-tabs.tsx`; make T025 pass
- [ ] T029 [US4] Make T026 pass; if a correction action leaks on an active tab, gate it on `canCorrect` in the owning card under `apps/web/src/features/discharges/ui/detail/`; if #327's calendar has merged, assert its active highlight instead of the current one

**Checkpoint**: All four stories green.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T030 Remove `apps/web/src/features/discharges/ui/detail/discharge-identity-card.tsx` and its imports if no status renders it any more (check #324/#329 on `master`); otherwise leave it for planned/closed
- [ ] T031 [P] Check the loading skeleton in `apps/web/src/features/discharges/ui/detail/discharge-detail-pending.tsx` still matches the header facts line (four facts)
- [ ] T032 Run `pnpm check`, `pnpm typecheck`, `pnpm test`; fix every failure
- [ ] T033 Run the browser flow in [quickstart.md](./quickstart.md) (operations lead and observer, 375 px width, planned and closed records unaffected) and note the result in the PR
- [ ] T034 Open a Draft PR for #328, then obtain a fresh read-only Claude Code review of the final diff and resolve every confirmed finding before marking it ready
- [ ] T035 Leave a hand-over note in the shared notes folder for #324 / #327 / #329 listing the shared files this branch created or changed

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T005)** → stories.
- **US2 (T006–T011)** first: it reshapes the Overview the other cards mount into.
- **US1 (T012–T016)** after US2 — the MVP.
- **US3 (T017–T023)** after US1 (mount order in `discharge-detail-tabs.tsx`); T019 is independent
  of the web tasks and can run alongside T017/T018.
- **US4 (T024–T029)** after US1; independent of US3 except for the shared Overview file.
- **Polish (T030–T035)** last.
- `discharge-detail-tabs.tsx` is touched by T010, T016, T023, T028: run those in order.

## Parallel Opportunities

- T003 ∥ T004.
- US2 tests T006 ∥ T007; T009 ∥ T008.
- US1 tests T012 ∥ T013.
- US3 tests T017 ∥ T018 ∥ T019 (API).
- US4 tests T024 ∥ T025 ∥ T026.

```text
# Example: US4 tests together
T024 active-discharge-view.test.ts (dischargeProgress)
T025 detail/active-overview.test.tsx (Progress region)
T026 detail/active-read-only.test.tsx
```

## Implementation Strategy

1. **MVP**: Setup → Foundational → US2 → US1. The active record shares the header and says who is
   working now; demoable on its own.
2. **Increment**: US3 (timeline), then US4 (progress, read-only pins).
3. Each checkpoint keeps `pnpm test` green; commit per story with
   `feat(discharges): <Description> (#328)` and no attribution trailers.
