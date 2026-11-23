---
description: "Task list for List Discharges by Status (#322)"
---

# Tasks: List Discharges by Status

**Input**: Design documents from `specs/discharge-preparation/discharges/list-discharges-by-status/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/discharges-index.md](contracts/discharges-index.md),
[quickstart.md](quickstart.md)

**Tests**: Included. The constitution (IV) and AGENTS.md require TDD for business behavior: write
each test task first and see it fail before its implementation task.

**Organization**: Grouped by user story (spec priorities: US1 P1, US2 P1, US3 P2, US4 P2, US5 P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task serves (US1–US5)

## Conventions for every task

- API tests: `cd apps/api && PORT=3399 node --import tsx ace.js test --files="consultation/*"`
  (`--files` matches trailing path segments; a spec importing a missing module hangs, so bound red
  runs). A fresh worktree needs `apps/api/.env` copied from `.env.example` with an `APP_KEY`.
- Web tests: `cd apps/web && pnpm exec vitest run <paths>` (the `pnpm --filter … test -- <path>`
  form ignores the path). Feature tests render through the real router with MSW; never mock the
  Tuyau client.
- After changing the API response, boot `node --import tsx ace.js serve` briefly so the Tuyau
  registry the web types read (`Route.Response<'discharges.index'>`) picks up the new fields.
- UI uses the « Marine sobre » tokens only (`success`, `warning`, `indicator`, `muted-foreground`);
  no hard-coded colors. Button labels carry the action only (`Clear search`).
- Keep GH-61 behavior (tabs, totals, search matching, ordering, URL state, empty/loading/failure)
  green throughout; existing tests in `apps/web/src/features/discharges/__tests__/list/` and
  `apps/api/tests/integration/discharges/consultation/list.spec.ts` must keep passing unless a task
  says to rewrite an assertion.

---

## Phase 1: Setup

**Purpose**: Share the tonnage formatter before a second screen uses it.

- [X] T001 Move `formatTonnes` from `apps/web/src/features/discharges/discharge-detail-view.ts` to a
  new `apps/web/src/helpers/tonnes.ts` (keep its doc comment, drop the "belongs in helpers/" note),
  re-export nothing from the old module, update every import (`rg "formatTonnes" apps/web/src`), and
  move its unit tests from `apps/web/src/features/discharges/__tests__/discharge-detail-view.test.ts`
  into a new `apps/web/src/helpers/tonnes.test.ts`. Run the discharges web tests: green.

---

## Phase 2: Foundational (blocks every story)

**Purpose**: The shared wire fields (`startedAt`, `expectedTonnage`) and a status-driven table
skeleton every tab's columns plug into.

- [X] T002 [P] RED — In `apps/api/tests/integration/discharges/consultation/list.spec.ts` add a test
  that every discharge carries `startedAt` (ISO string or `null`; `null` for a planned discharge)
  and `expectedTonnage` as a fixed-3 string equal to the sum of its lots' `expectedQuantityTonnes`
  (e.g. lots of `1000.250` and `2000.500` → `"3000.750"`), and `"0.000"` for a discharge with no lot.
  Use `ProductLotFactory.merge({ expectedQuantityTonnes: … })`.
- [X] T003 GREEN — In `apps/api/app/discharges/shared/discharge_transformer.ts` add `startedAt` to
  the picked fields and `expectedTonnage` summed with `Decimal` and serialized with `toFixed(3)`,
  mirroring `discharge_detail_transformer.ts` (a local `toTonnes` helper is fine); update the
  class doc comment to say the row now also carries what each status shows. Make sure
  `lucid_discharge_repository.ts#list()` still preloads lots (it does) — no query change here.
  Boot `ace serve` once to refresh the Tuyau registry.
- [X] T004 [P] Extend `DISCHARGES` fixtures in
  `apps/web/src/features/discharges/__tests__/support/fixtures.ts` with the new fields on every
  entry (`startedAt`, `expectedTonnage`, and, typed but `null` for now, `activeShift`, `nextShift`,
  `startProblemCount` once T011/T018 add them — add those three keys in their own story tasks if the
  type does not have them yet). Keep existing fixture identities so other tests are unaffected.
- [X] T005 RED — Rewrite the shared-row assertions in
  `apps/web/src/features/discharges/__tests__/list/row-content.test.tsx`: in every tab the vessel
  cell shows the vessel name with the IMO beneath it (and `Not specified` muted when absent), there
  is no IMO column header, and no `Product lots` or `Shifts` column header exists. Keep the
  "status not repeated on rows" assertion.
- [X] T006 GREEN — Restructure `apps/web/src/features/discharges/ui/discharge-list.tsx` so the
  header cells and row cells come from a per-status column definition
  (`Record<DischargeStatusFilter, Column[]>` where a column has `header`, `className?`,
  `cell(discharge)`), with the shared Vessel (name + IMO beneath, still the row's `Link`) and Dock
  columns first and a trailing decorative Open column (a `ChevronRightIcon`, `aria-hidden`, header
  visually hidden as "Open"). Remove the IMO, Product lots, and Shifts columns. Empty-state
  `colSpan` follows the column count. Row click and link behavior are unchanged (GH-58). Until the
  story tasks land, each status shows Vessel, Dock, Customers (existing join), Open. T005 green.

**Checkpoint**: API carries the shared fields; the table renders per-status columns.

---

## Phase 3: User Story 1 — Read an Active Discharge's Live Situation (P1) 🎯 MVP

**Goal**: Active rows show Started, Active shift ("Shift k / n", period, responsible, or no shift in
progress with the next one), and Expected tonnage.

**Independent test**: Seed active discharges with an active shift and one between shifts; the
Active tab shows the right shift cell for each (spec US1).

- [X] T007 [P] [US1] RED — Create `apps/api/tests/unit/discharges/consultation/discharge_list_shifts.spec.ts`
  for a pure `pickListShifts(shifts)` that takes a discharge's shifts
  (`{ id, sequence, status, plannedStartAt, plannedEndAt, responsible }[]`) and returns
  `{ activeShift, nextShift }`: the one `ACTIVE` shift (or `null`); the `PLANNED` shift with the
  lowest `sequence` (or `null`); completed shifts ignored; order of input irrelevant.
- [X] T008 [US1] GREEN — Implement `pickListShifts` in
  `apps/api/app/discharges/list/discharge_list_shifts.ts` with the `ShiftSummary` type from
  [data-model.md](data-model.md) (`responsible: { id, firstName, lastName }`). T007 green.
- [X] T009 [P] [US1] RED — In `apps/api/tests/integration/discharges/consultation/list.spec.ts` add:
  an active discharge with completed shift 1, active shift 2 (responsible A), planned shift 3
  (responsible B) → `activeShift.sequence === 2`, `activeShift.responsible` is A's names,
  `nextShift.sequence === 3`; an active discharge between shifts (1 completed, 2 planned) →
  `activeShift: null`, `nextShift.sequence === 2`; an active discharge with only completed shifts →
  both `null`; planned and closed discharges → both `null`; an active shift whose responsible was
  deactivated afterwards still returns that responsible's names. Use `ShiftFactory` and
  `UserFactory`.
- [X] T010 [US1] GREEN — In `apps/api/app/discharges/shared/repositories/lucid_discharge_repository.ts#list()`
  preload `shifts` constrained to `status IN ('ACTIVE','PLANNED')` and to discharges whose status is
  `ACTIVE` (e.g. `whereIn('discharge_id', (sub) => sub.from('discharges').select('id').where('status','ACTIVE'))`),
  ordered by `sequence`, with `.preload('responsible')`; keep `withCount('shifts')`. Update the
  abstract `list()` doc comment in `discharge_repository.ts` accordingly.
- [X] T011 [US1] GREEN — In `apps/api/app/discharges/shared/discharge_transformer.ts` add
  `activeShift` and `nextShift` from `pickListShifts(this.resource.shifts ?? [])` for `ACTIVE`
  discharges and `null` otherwise; serialize `plannedStartAt`/`plannedEndAt` as ISO strings like the
  other instants. T009 green; refresh the Tuyau registry; add the two keys to web fixtures (T004).
- [X] T012 [P] [US1] RED — Create `apps/web/src/features/discharges/__tests__/list/active-columns.test.tsx`:
  the Active tab headers are exactly Vessel, Dock, Started, Active shift, Expected tonnage,
  Customers (+ hidden Open); Started shows `formatDateTime(startedAt)` or a muted `Not specified`
  when `null`; the shift cell reads `Shift 2 / 3`, the planned period, and `Firstname Lastname`;
  between shifts it reads `No shift in progress` and `Next: Shift 3 / 3 …` with its responsible;
  with neither it reads `No shift in progress` only; Expected tonnage reads e.g. `8,419.750 t`; no
  `Expected start` header.
- [X] T013 [US1] GREEN — Create `apps/web/src/features/discharges/ui/list/discharge-shift-cell.tsx`
  rendering the active/next shift per the contract (period via `formatShiftPeriod` or the existing
  shift time helpers in `discharge-detail-view.ts`; responsible as `firstName lastName`; the
  next-shift line muted), and wire the Active column set in `discharge-list.tsx` (Started,
  Active shift, Expected tonnage via `formatTonnes`, Customers). T012 green.

**Checkpoint**: US1 is demonstrable on its own.

---

## Phase 4: User Story 2 — See Whether a Planned Discharge Is Ready to Start (P1)

**Goal**: Planned rows show Expected start, a Ready / n problems badge matching the start check, and
"n lots · tonnage".

**Independent test**: Planned discharges with zero, one, and several start problems show Ready,
`1 problem`, `n problems`, matching `GET /discharges/:id/start-check` (spec US2).

- [X] T014 [US2] REFACTOR (tests already green) — Extract the read-and-evaluate body of
  `apps/api/app/discharges/start/check_discharge_start_use_case.ts` into an `@inject()`
  `DischargeStartEvaluator` in `apps/api/app/discharges/start/discharge_start_evaluator.ts` with
  `evaluate(discharge: StartDischarge, client: QueryClientContract)` returning
  `DischargeStartEvaluation` (`readStartPlan` → `startReferenceIds` → `readReferences(…, 'READ')` →
  `findActiveHolders` → `evaluateDischargeStart(buildStartState(…))`). The use case keeps its
  not-found / not-planned guards and calls the evaluator. Run `--files="start/*"`: all green.
- [X] T015 [P] [US2] RED — In `apps/api/tests/integration/discharges/consultation/list.spec.ts` add:
  a planned discharge prepared to be startable → `startProblemCount: 0`; one with no product lot and
  no shift → the count of problems the start check reports (≥ 2); active and closed discharges →
  `null`; a parity test that, for each planned discharge in a mixed dataset, `startProblemCount`
  equals `body.data.problems.length` of `GET /api/v1/discharges/:id/start-check`. Reuse the scenario
  builders in `apps/api/tests/integration/discharges/start/start_scenario.ts` for a startable plan.
- [X] T016 [US2] GREEN — In `apps/api/app/discharges/list/list_discharges_use_case.ts` inject
  `DischargeStartEvaluator`; after `dischargeRepository.list()`, evaluate each `PLANNED` discharge
  sequentially on `db.connection()` (no transaction, no lock) and return
  `Array<{ discharge: Discharge; startProblemCount: number | null }>`; document why it reads without
  locks (decides nothing, like the start check).
- [X] T017 [US2] GREEN — Adapt `DischargeTransformer` (`apps/api/app/discharges/shared/discharge_transformer.ts`)
  to take the list entry (`{ discharge, startProblemCount }`) and emit `startProblemCount`; update
  `apps/api/app/controllers/discharges_controller.ts#index` (assign the awaited result to a local
  before transforming). Keep every existing field. T015 green; refresh the Tuyau registry; add the
  key to web fixtures (T004) with `0` and `3` on planned entries, `null` elsewhere.
- [X] T018 [P] [US2] RED — Create `apps/web/src/features/discharges/__tests__/list/planned-columns.test.tsx`:
  the Planned tab headers are exactly Vessel, Dock, Expected start, Preparation, Lots · tonnage,
  Customers (+ hidden Open); `startProblemCount: 0` → a `Ready` badge; `1` → `1 problem`; `3` →
  `3 problems`; the two badges differ in icon/text, not only color (assert the accessible text);
  Lots · tonnage reads `8 lots · 22,843.000 t`, `1 lot · …` singular, `0 lots` with no tonnage.
- [X] T019 [US2] GREEN — Create `apps/web/src/features/discharges/ui/list/preparation-badge.tsx`
  (shadcn `Badge`; Ready = `success` tone + check icon, problems = `warning` tone + alert icon; icons
  `aria-hidden`) and wire the Planned column set in `discharge-list.tsx` (Expected start,
  Preparation, Lots · tonnage, Customers). T018 green.

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 — Read a Closed Discharge's Dates and Tonnage (P2)

**Goal**: Closed rows show Started, a muted Closed placeholder, and Expected tonnage.

**Independent test**: Closed discharges show their start, the placeholder under Closed, and their
expected tonnage (spec US3, Clarification Q1).

- [X] T020 [P] [US3] RED — Create `apps/web/src/features/discharges/__tests__/list/closed-columns.test.tsx`:
  the Closed tab headers are exactly Vessel, Dock, Started, Closed, Expected tonnage, Customers
  (+ hidden Open); Started shows the start or `Not specified`; every Closed cell shows the muted em
  dash placeholder (with an accessible label such as "Closure time not recorded"); Expected tonnage
  formatted.
- [X] T021 [US3] GREEN — Wire the Closed column set in
  `apps/web/src/features/discharges/ui/discharge-list.tsx`. No API change (research R5). T020 green.

---

## Phase 6: User Story 4 — Recognise a Discharge's Customers and Open It (P2)

**Goal**: Customers shortened to two names plus « +N » with every name reachable; the whole row
opens the discharge.

**Independent test**: Discharges with 0, 1, 2, and 5 distinct customers render correctly in every
tab; clicks anywhere on a row and keyboard activation open the discharge (spec US4).

- [X] T022 [P] [US4] RED — Create `apps/web/src/features/discharges/__tests__/list/customers.test.tsx`:
  1 and 2 distinct customers → all names, no `+`; 5 customers (with two lots of the same customer)
  → the first two alphabetically then `+3`; hovering/focusing `+3` shows a tooltip listing all five;
  the cell's accessible name lists all five; no lot → muted `—`. Run it on each tab.
- [X] T023 [US4] GREEN — Create `apps/web/src/features/discharges/ui/list/discharge-customers.tsx`
  (distinct names sorted with `localeCompare`, first two shown, `+N` as a focusable `TooltipTrigger`
  from `apps/web/src/components/ui/tooltip.tsx` listing every name, truncation with the full value
  in `title`/accessible name) and use it as the Customers cell of all three column sets in
  `discharge-list.tsx`, replacing `customerNames().join(', ')`. Clicking `+N` must not open the row
  (stop propagation like the link). T022 green.
- [X] T024 [P] [US4] Extend `apps/web/src/features/discharges/__tests__/list/row-selection.test.tsx`
  to click the Dock, the Customers, and the Open chevron cells of a row in each tab and assert the
  discharge opens with the list's `status` and `search` carried; keep the keyboard-link test. Fix
  `discharge-list.tsx` only if a case fails.

---

## Phase 7: User Story 5 — Search Without a Counter and Recover From No Match (P3)

**Goal**: No result counter; the no-match state names the term and offers Clear search; tab counts
stay status totals.

**Independent test**: Search `zzz`, see the no-match state with Clear search, clear it, see the
collection restored and the address cleaned (spec US5, Clarification Q2).

- [X] T025 [P] [US5] RED — Extend `apps/web/src/features/discharges/__tests__/list/search.test.tsx`:
  while a search narrows the list, each tab still shows its status total and nothing near the
  search field reports a result count; with `zzz` the no-match state shows `No matching
  discharges`, a description quoting `zzz` and naming vessel name, IMO, dock, customer, and product,
  and a `Clear search` button; clicking it empties the search input, removes `search` from the URL,
  and lists the selected status's full collection; a genuinely empty status still shows its own
  empty state and creation action (for preparers) and no Clear search.
- [X] T026 [US5] GREEN — Create `apps/web/src/features/discharges/ui/list/discharges-no-match.tsx`
  (`Empty` with the term, the searchable fields, and a `Clear search` outline `Button` with an X
  icon), have `DischargeList` render it instead of the current no-match copy, and pass an
  `onClearSearch` from `apps/web/src/features/discharges/ui/discharges-page.tsx` that calls
  `updateSearch('')` so the route drops the empty parameter (check the route's search schema in
  `apps/web/src/routes/_authenticated/discharges.tsx` strips it; adjust there if not). T025 green.

---

## Phase 8: Polish & Verification

- [X] T027 Remove the now-unused `customerNames` helper and any dead imports from
  `apps/web/src/features/discharges/ui/discharge-list.tsx`; check the row stays one line high at
  desktop width and the table scrolls horizontally inside its box at phone width (no page-level
  horizontal scroll).
- [X] T028 [P] Measure the list endpoint against seeded data (`pnpm --filter @portflow/api db:fresh`,
  then time `GET /api/v1/discharges` as a signed-in user); if the planned-discharge evaluation
  pushes it near SC-006's 2 s, batch the evaluator's reads per research R2 and note the deviation in
  the PR.
- [X] T029 Run the full checks from the repository root: `pnpm check`, `pnpm typecheck`,
  `pnpm test`; fix any failure.
- [X] T030 Run the [quickstart](quickstart.md) browser validation on seeded data (Active, Planned
  with start-dialog parity, Closed, « +N », row opening and Back, no-match Clear search, light and
  dark themes).
- [X] T031 Obtain a fresh read-only Claude Code review of the final diff (new session `/code-review`
  or read-only subagent) and resolve or justify every confirmed finding before marking the PR
  ready.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T006)** → user stories.
- **US1 (T007–T013)** and **US2 (T014–T019)** both depend only on Foundational; they touch the same
  API transformer and `discharge-list.tsx`, so run them one after the other (US1 first, MVP).
- **US3 (T020–T021)** depends on Foundational only (uses `startedAt`/`expectedTonnage`).
- **US4 (T022–T024)** depends on Foundational only; its cell is used by all three column sets, so
  land it after any column-set task in progress.
- **US5 (T025–T026)** depends on Foundational only (independent of columns).
- **Polish (T027–T031)** after all stories.

Within each story: RED test → GREEN implementation → refactor, with the Tuyau registry refreshed
after every API response change.

## Parallel Opportunities

- T002 (API test) ∥ T004/T005 (web fixtures and tests).
- US1: T007 ∥ T009 ∥ T012 (three different test files).
- US2: T015 ∥ T018 once T014 is done.
- US3 T020, US4 T022, US5 T025 are separate test files and can be written in parallel.
- T028 ∥ T029.

### Example (US1)

```text
In parallel: T007 unit spec · T009 integration spec · T012 web feature test
Then: T008 → T010 → T011 (API) and T013 (web)
```

## Implementation Strategy

1. **MVP**: Setup + Foundational + US1 — the Active tab, the screen's default, shows the live
   situation. Demo and commit.
2. **Next**: US2 (preparation badge) — the second P1.
3. **Then**: US3 and US4 (closed columns, customers « +N »), then US5 (no-match Clear search).
4. Commit after each story with a Conventional Commit such as
   `feat(discharges): Show the active shift on active discharge rows`; open the Draft PR once US1
   is reviewable; finish with Polish.
