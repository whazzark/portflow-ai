---
description: "Task list for the wider creation wizard with a shift preview (#323)"
---

# Tasks: Wider Creation Wizard With a Shift Preview

**Input**: Design documents in
`specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/widen-the-creation-wizard-with-a-shift-preview/`.
These are [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), and [quickstart.md](./quickstart.md).

**Tests**: Tests are required. The constitution (IV) mandates RED → GREEN → REFACTOR for observable
behavior. Write each test task first, see it fail for the expected reason, then implement.

**Organization**: Tasks are grouped by user story (US1 shift preview P1, US2 full-width wizard P2,
US3 many shifts P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: The task can run in parallel because it touches different files and has no incomplete
  dependency.
- **[Story]**: The user story the task serves.

## Runner notes

- **API tests** run from `apps/api` with `PORT=3399 node --import tsx ace.js test
  --files="consultation/*"`.
  - Bound red runs with a timeout: a spec importing a missing module hangs.
  - A fresh worktree needs `apps/api/.env`: copy `.env.example` and generate `APP_KEY`.
- **Web tests**: run a subset from `apps/web` with `pnpm exec vitest run <paths>`.
- **Tuyau registry**: a new route reaches the client registry under `apps/api/.adonisjs/client/`
  only after a short `node --import tsx ace.js serve` boot. Commit the regenerated files.

---

## Phase 1: Setup

**Purpose**: Confirm the workspace is ready. There are no new dependencies.

- [X] T001 Verify the baseline passes before any change. *(The first baseline run was cut short by
  machine load from parallel sessions; the final T027 run on the branch stands in for it.)*
  - Run `pnpm check`, `pnpm typecheck`, and `pnpm test` at the repository root.
  - Ensure `apps/api/.env` exists, created from `apps/api/.env.example` with a generated `APP_KEY`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The dock occupancy read (API and web query). US1 depends on it, and every create
feature test needs a default handler for it once the preview mounts.

**⚠️ CRITICAL**: US1 cannot start until this phase is complete. US2 can proceed in parallel with
this phase.

### Tests (write first, must fail)

- [X] T002 [P] Write the API integration spec in
  `apps/api/tests/integration/discharges/consultation/dock_occupancy.spec.ts`. Use the existing
  `consultation/list.spec.ts` for fixtures and sign-in helpers. It must cover
  `GET /api/v1/discharges/dock-occupancy`:
  - **Auth**:
    - 401 `E_UNAUTHORIZED_ACCESS` when signed out;
    - 403 `E_AUTHORIZATION_FAILURE` for a non-ACTIVE user;
    - 200 for an operations lead, an operations admin, an organization admin, and an observer.
  - **Validation**: 422 `E_VALIDATION_ERROR` when `dockId` is missing or not a uuid.
  - **Unknown dock**: an unknown uuid answers `{ data: [] }`.
  - **Inclusion**:
    - a PLANNED and an ACTIVE discharge on the dock are included;
    - a CLOSED discharge on the dock and a discharge on another dock are excluded;
    - a discharge without shifts is omitted.
  - **Span**: `startAt` is the minimum `planned_start_at` and `endAt` the maximum `planned_end_at`
    over every shift, including COMPLETED and ACTIVE shifts.
  - **Shape**: items are ordered by `startAt`, then discharge id. Each item has exactly
    `discharge { id, vesselName, status }`, `startAt`, and `endAt`, as in
    `contracts/dock-occupancy.openapi.yaml`.
- [X] T003 [P] Write an API unit spec in
  `apps/api/tests/unit/discharges/consultation/dock_occupancy.spec.ts`.
  - `ListDockOccupancyUseCase` delegates to a stubbed `DischargeRepository.listDockOccupancy` with
    the given dock id.
  - `DockOccupancyTransformer` serializes `startAt` and `endAt` as ISO strings and keeps only the
    contract fields.

### Implementation

- [X] T004 Add `abstract listDockOccupancy(dockId: string): Promise<DockOccupancyRead[]>` to
  `apps/api/app/discharges/shared/repositories/discharge_repository.ts`.
  - Export the `DockOccupancyRead` type: `{ discharge: { id, vesselName, status: 'PLANNED' |
    'ACTIVE' }, startAt: DateTime, endAt: DateTime }`.
  - Give it a doc comment that states the rules of data-model.md « Dock occupancy ».
- [X] T005 Implement `listDockOccupancy` in
  `apps/api/app/discharges/shared/repositories/lucid_discharge_repository.ts`.
  - Use one aggregate query: `discharges` joined to `shifts`, with
    `where dock_id = ? and status in ('PLANNED','ACTIVE')`, grouped by discharge, selecting
    `min(planned_start_at)` and `max(planned_end_at)`.
  - Keep only groups where both are non-null.
  - Order by start, then id.
  - Map the rows to `DockOccupancyRead`, converting instants to Luxon `DateTime`. The SQL must work
    on both SQLite (tests) and PostgreSQL.
- [X] T006 [P] Create `apps/api/app/discharges/dock_occupancy/dock_occupancy_validator.ts`, a VineJS
  validator for the query string: `dockId` is a required uuid.
- [X] T007 [P] Create `apps/api/app/discharges/shared/dock_occupancy_transformer.ts`, a
  `BaseTransformer` producing the contract shape: discharge `{ id, vesselName, status }`, plus
  `startAt` and `endAt` as ISO strings.
- [X] T008 Create `apps/api/app/discharges/dock_occupancy/list_dock_occupancy_use_case.ts`, an
  `@inject()` use case whose `handle({ dockId })` returns
  `dischargeRepository.listDockOccupancy(dockId)`. It depends on T004.
- [X] T009 Add a `dockOccupancy({ bouncer, request, serialize })` action to
  `apps/api/app/controllers/discharges_controller.ts`.
  - Authorize with `DischargePolicy` `list`.
  - Validate the query string with the T006 validator.
  - Call the T008 use case and serialize through the T007 transformer.
- [X] T010 Register `router.get('/dock-occupancy', [controllers.Discharges, 'dockOccupancy'])
  .as('dock_occupancy')` in `apps/api/start/routes.ts`, inside the `/discharges` group and before
  `router.get('/:id', …)`. Add a short comment saying why it is declared first.
  - Regenerate the Tuyau registry under `apps/api/.adonisjs/` with a short `node --import tsx
    ace.js serve` boot.
  - Run T002 and T003 to green.
- [X] T011 Add `dockOccupancy: (dockId: string) =>
  tuyauQuery.discharges.dockOccupancy.queryOptions({ query: { dockId } }, { staleTime: 0 })` to
  `apps/web/src/features/discharges/queries/discharge-queries.ts`.
  - Add a comment explaining the refetch on every opening, as for `planningOptions`.
  - Export the item type, derived from the registry like the other DTOs, from
    `apps/web/src/features/discharges/types.ts`.
- [X] T012 Add occupancy fixtures and a handler to the web test support.
  - **Fixtures**: an active and a planned occupancy on the fixture dock, in
    `apps/web/src/features/discharges/__tests__/support/fixtures.ts`.
  - **Handler**: `mockDockOccupancy({ occupancy, fail, onRequest })`, an MSW handler for
    `GET ${API_BASE_URL}/api/v1/discharges/dock-occupancy`, in
    `apps/web/src/features/discharges/__tests__/support/test-helpers.ts`.
  - **Defaults**: `mockPreparationOptions` registers it by default with an empty occupancy, so the
    existing `__tests__/create/*` suites keep passing once the preview mounts.

**Checkpoint**: The occupancy read is served, typed in the web client, and mockable.

---

## Phase 3: User Story 1 - Plan Shifts Knowing When the Dock Is Free (Priority: P1) 🎯 MVP

**Goal**: The Planned shifts step opens on a « Shift preview » with:
- the dock's occupancy by other discharges, « free from », and the Expected start marker;
- numbered shift blocks with visible breaks;
- « no period yet » placeholders;
- the row totals.

It updates live as shifts change.

**Independent Test**: Use an occupancy ending on day D at 14:00 and an expected start on D+2 at
06:00, then enter two shifts. The preview shows the occupancy, « free from », the marker, and both
blocks with a gap, and follows edits (spec US1).

### Tests for User Story 1 (write first, must fail)

- [X] T013 [P] [US1] Write pure unit tests for the layout in
  `apps/web/src/features/discharges/__tests__/shift-preview.test.ts`. Pin `TZ` as
  `shift-calendar.test.ts` does. They cover the data-model.md « Shift preview » rules:
  - **Period**:
    - the first day is the day before `freeFrom`, or the earlier of the expected start and the first
      shift;
    - the last day follows the last end, and an end at midnight stays on the previous day;
    - the period pads forward to 7 days;
    - the period grows past 7 days for long discharges;
    - the day labels read like « Tue 22 ».
  - **Occupancy**:
    - `freeFrom` is the latest end among occupancies starting before the expected start, including
      one that straddles it;
    - `freeFrom` is `null` when there is none;
    - occupancies are clipped at both edges (`clippedStart`, `clippedEnd`), and an occupancy outside
      the period is dropped;
    - `freeGaps` cover the uncovered parts of the dock row.
  - **Shifts**:
    - blocks are numbered by form position and placed by percentage;
    - a shift is invalid when a field is empty or its end is at or before its start, and goes to
      `unscheduled` instead;
    - breaks appear between sorted blocks, and overlapping shifts produce no break;
    - `summary` counts and sums hours over valid periods only, and is `null` without one.
  - **Clock change**: on a DST day, column boundaries stay on midnight.
  - **Loading**: an occupancy of `null` (loading or error) still yields days, the expected start,
    and shifts.
- [X] T014 [P] [US1] Write feature tests in
  `apps/web/src/features/discharges/__tests__/create/shift-preview.test.tsx`. Use
  `mockDischarges`, `mockPreparationOptions`, `mockDockOccupancy`, `openCreationFromList`,
  `fillVesselStep`, `continueTo`, and `fillLotsStep`. They cover:
  - **Order**: on reaching Planned shifts, a region named « Shift preview » comes before the
    « Planned shifts » heading.
  - **Summary line**: it reads `<dock> · free from <…> · expected start <…>`.
  - **Dock row**: it lists the other vessel with « until … ».
  - **Marker**: the Expected start marker's accessible name includes the date.
  - **Unscheduled shift**: « Shift 1 · no period yet » shows before any period is entered.
  - **Live updates**:
    - entering shift periods adds blocks named « Shift 1, … → … » and « Shift 2, … »;
    - the row reads « 2 shifts · <h> h »;
    - removing a shift removes its block;
    - none of these updates sends another occupancy request.
  - **Dock change**: going Back, choosing another dock, and returning requests occupancy for the new
    `dockId` (assert with `onRequest`).
  - **Empty occupancy**: the row reads « Dock free » and the summary has no « free from ».
  - **Failure**: with `fail`, the preview shows « Dock occupancy is unavailable. », still shows the
    marker and the shift blocks, and Retry then shows the occupancy.
  - **No gating**: the preview never disables « Create discharge » when the form is valid, and
    creation still sends the same body as before.

### Implementation for User Story 1

- [X] T015 [US1] Implement the pure layout `shiftPreview({ expectedStartAt, shifts, occupancy })` in
  `apps/web/src/features/discharges/shift-preview.ts`.
  - It returns `days`, `freeFrom`, `occupancies`, `freeGaps`, `expectedStart`, `shifts`, `breaks`,
    `unscheduled`, and `summary`, per data-model.md and research.md Decisions 4–5.
  - Reuse `fromDateTimeLocalValue` from `@/helpers/dates`, and `formatShiftDay`, `formatDateTime`,
    or `formatShiftDuration` from `discharge-detail-view.ts` where they fit.
  - Count days on the calendar, as `shiftCalendar` does.
  - Run T013 to green.
- [X] T016 [US1] Create the `ShiftPreview` component in
  `apps/web/src/features/discharges/ui/create/shift-preview.tsx`. It takes the form values (dock
  name, vessel name, expected start, shifts) and the occupancy query result and renders
  `contracts/ui-state.md` « Shift preview states ». Structure:
  - **Section**: a `section` labelled by an h3 « Shift preview ».
  - **Header**: the summary line, and the legend (solid « Other discharge », dashed « Planned
    shift », dashed line « Expected start »).
  - **Day row**: one label per day.
  - **Dock row**: the dock label, occupancy blocks (« <vessel> » and « until <day, time> »), and
    « Dock free » gaps. While loading it is a `Skeleton`; on error it is an inline `Alert` with
    « Dock occupancy is unavailable. » and a Retry `Button`.
  - **Discharge row**: the vessel name or « This discharge », the « n shifts · h h » sub-label,
    numbered dashed blocks with their accessible names, and « Shift n · no period yet » items.
  - **Marker**: an absolutely positioned dashed Expected start marker labelled « Expected start
    HH:mm », with the full date in its accessible name.
  - **Styling and accessibility**:
    - use V2 palette tokens only;
    - decorative day lines are `aria-hidden`;
    - the track has `min-w` per day inside `overflow-x-auto`.
- [X] T017 [US1] Mount the preview in
  `apps/web/src/features/discharges/ui/create/create-discharge-form.tsx`.
  - In the `step === 'shifts'` branch, render `ShiftPreview` before the Planned shifts
    `SectionCard`, in a fragment or wrapper that keeps both in normal flow.
  - Feed it with `form.Subscribe` on `values.dockId`, `vesselName`, `expectedStartAt`, and `shifts`,
    and with `useQuery(dischargeQueries.dockOccupancy(dockId))`.
  - Resolve the dock name from the `docks` options already passed to the form.
  - Pass the query's `refetch` as Retry.
  - Do not touch validation, `isStepComplete`, or the footer.
  - Run T014 to green.

**Checkpoint**: US1 is fully functional and testable on its own, even with the old narrow layout.

---

## Phase 4: User Story 2 - Work Through the Wizard on the Full Content Width (Priority: P2)

**Goal**: The three steps span the content width. The stepper shows numbers and names only. The
sticky footer keeps the totals and actions. The Planned shifts description has no trailing
sentence, and there is no footnote.

**Independent Test**: Walk the three steps. There is no centered max-width column and no « Step X
of 3 ». The footer shows the totals with Cancel, Back, and Next or Create (spec US2).

### Tests for User Story 2 (write first, must fail)

- [X] T018 [P] [US2] Add stepper and description assertions to
  `apps/web/src/features/discharges/__tests__/create/steps.test.tsx`, updating any existing
  assertion on the « Step X of 3 » text:
  - On each step, the « Discharge preparation steps » navigation contains no text matching
    `/Step \d of \d/`.
  - The current step keeps `aria-current="step"`.
  - The Planned shifts card description is exactly « The periods the discharge will be worked, each
    with its responsible. ».
  - No text « A new shift starts when the last one ends » remains on the page.
- [X] T019 [P] [US2] Add footer assertions to
  `apps/web/src/features/discharges/__tests__/create/layout.test.tsx`. The « Discharge summary »
  region shows lots · tonnage · shifts · period and offers Cancel, Back from step 2, and « Next:
  … » or « Create discharge ». Keep the existing behavior assertions unchanged (SC-005).

### Implementation for User Story 2

- [X] T020 [P] [US2] Remove the `md:hidden` « Step {n} of {total} · {label} » paragraph from
  `apps/web/src/features/discharges/ui/create/step-indicator.tsx`.
  - Keep the numbers, completed marks, `aria-current`, the visually hidden names below `md`, and the
    navigation rules.
  - Simplify the outer wrapper if it no longer needs a column.
- [X] T021 [US2] Widen the form in
  `apps/web/src/features/discharges/ui/create/create-discharge-form.tsx`.
  - Drop `mx-auto` and `max-w-5xl` from the body container and from the footer's inner row, keeping
    their padding.
  - Shorten the Planned shifts `SectionCard` description to « The periods the discharge will be
    worked, each with its responsible. ».
  - Update the footer comment if it mentions the column.
  - Run T018 and T019 to green.
- [X] T022 [P] [US2] Drop `mx-auto` and `max-w-5xl` from the skeleton container in
  `apps/web/src/features/discharges/ui/create/create-discharge-pending.tsx`, so the pending state
  matches the full width.

**Checkpoint**: US1 and US2 both work. The wizard matches the V2 layout.

---

## Phase 5: User Story 3 - Plan Many Shifts Without Losing the Preview (Priority: P3)

**Goal**: With many shifts, the page scrolls under the sticky footer. The preview stays first and
is not pinned. Every shift is still drawn and distinguishable.

**Independent Test**: Enter eight shifts and check scrolling, preview position, and footer
clearance (spec US3, and quickstart step 5).

### Tests for User Story 3 (write first, must fail where behavior is new)

- [X] T023 [P] [US3] Add a many-shifts case to
  `apps/web/src/features/discharges/__tests__/create/shift-preview.test.tsx`:
  - **Setup**: eight consecutive 8 h shifts with 8 h breaks.
  - **Blocks**: the preview draws eight blocks named « Shift 1, … » to « Shift 8, … ».
  - **Breaks**: a break is rendered between each consecutive pair.
  - **Order**: the « Shift preview » region is still the first element of the step, before
    « Planned shifts ».
  - **Not pinned**: the preview's section has no `sticky` or `fixed` positioning class.
- [X] T024 [P] [US3] Add a unit case to
  `apps/web/src/features/discharges/__tests__/shift-preview.test.ts` with eight shifts spanning more
  than 7 days. The period covers the last end, every block has a non-zero width, and the blocks are
  ordered.

### Implementation for User Story 3

- [X] T025 [US3] Adjust `apps/web/src/features/discharges/ui/create/shift-preview.tsx` and
  `create-discharge-form.tsx` only if T023 or T024 fail.
  - Keep block numbers readable at small widths (a minimum block width, with the number visible).
  - Ensure the bottom padding of the form body clears the sticky footer.
  - Do not pin the preview.

**Checkpoint**: All three stories work independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T026 [P] Update the shared note in the session notes folder if the endpoint shape changed
  during implementation, so #324 reuses it as built. If nothing changed, skip this task.
- [X] T027 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` at the repository root, and fix every
  failure.
- [X] T028 Walk `quickstart.md` « Browser walk » steps 1–9 against a seeded local stack.
  - Use `pnpm --filter @portflow/api db:fresh`, then the API and web dev servers.
  - Check light and dark themes and phone width.
  - Record any deviation in the PR.
- [X] T029 Open a Draft PR referencing #323. Obtain a fresh read-only Claude Code review of the
  final diff (`/code-review` in a new session or a read-only subagent), and resolve or justify every
  confirmed finding before marking the PR ready.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: depends on Setup and blocks US1.
  - T004 → T005 and T008.
  - T006, T007, and T008 → T009 → T010 → T011.
  - T011 → T012.
- **US1 (Phase 3)**: depends on Phase 2 (T011 and T012).
- **US2 (Phase 4)**: depends only on Setup. It can run alongside Phase 2 and US1.
  - T021 and T017 both edit `create-discharge-form.tsx`, so sequence them (T017 then T021, or the
    reverse) rather than running them in parallel.
- **US3 (Phase 5)**: depends on US1 (and on US2 for the final layout).
- **Polish (Phase 6)**: depends on every story.

### Within each story

Write the tests and confirm they fail, then implement, then make the tests pass. Pure modules come
before components, and components before mounting.

### Parallel opportunities

- T002 ∥ T003 (separate spec files).
- T006 ∥ T007 (separate new files), after T004.
- T013 ∥ T014 (separate test files).
- T018 ∥ T019 ∥ T020 ∥ T022 (separate files).
- T023 ∥ T024.
- US2 (T018–T022, except T021 when it would race T017) alongside Phase 2.

## Parallel Example: User Story 1

```text
T013 [US1] Unit tests for shift-preview.ts
T014 [US1] Feature tests for the preview in __tests__/create/shift-preview.test.tsx
# then, sequentially
T015 → T016 → T017
```

## Implementation Strategy

### MVP first (User Story 1)

1. Phase 1, then Phase 2 (the occupancy read is served and mockable).
2. Phase 3 (US1). Validate the preview with quickstart steps 2–4 and 7.
3. Stop and review. The preview delivers the issue's new capability on its own.

### Incremental delivery

1. Add US2 for the full-width layout, the stepper, and the description. Validate with quickstart
   steps 1, 6, and 8.
2. Add US3 to harden the many-shifts case. Validate with quickstart step 5.
3. Finish with Polish (T026–T029).

All stories ship in one PR, as one independently deliverable issue (constitution II).
