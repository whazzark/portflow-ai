---
description: "Task list for Browse the Discharges List in the Web Workbench (GH-61)"
---

# Tasks: Browse the Discharges List in the Web Workbench

**Input**: Design documents from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/browse-the-discharges-list-in-the-web-workbench/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: REQUIRED, not optional. Constitution IV mandates RED → GREEN → REFACTOR for business
behavior, and both `apps/api/AGENTS.md` and `apps/web/AGENTS.md` name the test seams each layer
must have. Every test task below must be written and must FAIL before its implementation task.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `[US1]`–`[US4]`, mapping to the user stories in `spec.md`

## Path Conventions

PNPM/Turbo monorepo: `apps/api/` (AdonisJS) and `apps/web/` (TanStack Start). All paths below are
repository-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Give the `discharges` domain the same import ergonomics as every other API domain
before six new files are added under it. See `research.md` Decision 8.

- [X] T001 Add `"#discharges/*": "./app/discharges/*.js"` to the `imports` map in `apps/api/package.json`, keeping the map alphabetically ordered between `#customers/*` and `#docks/*`
- [X] T002 Replace the two relative `../app/discharges/...` and `../../discharges/...` imports with the new alias in `apps/api/providers/repositories_provider.ts` and `apps/api/app/site_references/shared/persisted_site_reference_usage_checker.ts`, then confirm `pnpm --filter @portflow/api typecheck` passes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The single read contract `GET /api/v1/discharges` and the typed web query over it.
Every user story reads through this; none can be built or tested without it.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for the read contract ⚠️

> Write these FIRST and confirm they FAIL.

- [X] T003 [P] Unit test for `DischargePolicy.list` — allows all four roles when `accessStatus` is `ACTIVE`, denies `PENDING`, `CANCELLED`, and `DEACTIVATED` — in `apps/api/tests/unit/discharges/consultation/policy.spec.ts`
- [X] T004 [P] Unit test for the repository read — returns every status in one collection, ordered by `expectedStartAt` ascending with `id` ascending as the tie-breaker, preloads `dock` and `productLots.customer`, and exposes a shift count without loading shift rows — in `apps/api/tests/unit/discharges/consultation/list.spec.ts`
- [X] T005 [P] Integration test for `GET /api/v1/discharges` — 401 unauthenticated, 403 for a non-active user, 200 for each of the four active roles with an identical payload, and a response shape carrying `dock.name`, `productLots[].customerName`, `productLots[].productName`, and an integer `shiftCount` while omitting `vesselComment`, `expectedQuantityTonnes`, `createdAt`, and `updatedAt` — in `apps/api/tests/integration/discharges/consultation/list.spec.ts`

### API implementation

- [X] T006 [P] Define the `DischargeRepository` abstraction with a `list()` returning discharges with their dock, product lots, customers, and shift count, in `apps/api/app/discharges/shared/repositories/discharge_repository.ts`
- [X] T007 Implement `LucidDischargeRepository.list()` with `preload('dock')`, `preload('productLots', (q) => q.preload('customer'))`, `withCount('shifts')`, and `.orderBy('expected_start_at', 'asc').orderBy('id', 'asc')`, in `apps/api/app/discharges/shared/repositories/lucid_discharge_repository.ts` (depends on T006)
- [X] T008 [P] Implement `DischargePolicy` with a single `list(user)` returning `user.accessStatus === 'ACTIVE'` and no role check, in `apps/api/app/discharges/shared/discharge_policy.ts`
- [X] T009 [P] Implement `DischargeTransformer` emitting exactly the `DischargeListItem` fields from `contracts/discharges.openapi.yaml`, reading the shift count off `$extras` as a `Number`, in `apps/api/app/discharges/shared/discharge_transformer.ts`
- [X] T010 Implement `ListDischargesUseCase` delegating to the injected repository, in `apps/api/app/discharges/list/list_discharges_use_case.ts` (depends on T006)
- [X] T011 Implement `DischargesController.index` authorizing with `DischargePolicy` then serializing `DischargeTransformer.transform(discharges)`, assigning the awaited collection to a local first per `apps/api/AGENTS.md`, in `apps/api/app/controllers/discharges_controller.ts` (depends on T008, T009, T010)
- [X] T012 Bind `DischargeRepository` to `LucidDischargeRepository` in `apps/api/providers/repositories_provider.ts` (depends on T007)
- [X] T013 Register the `/discharges` group with `router.get('/', [controllers.Discharges, 'index']).as('index')` inside the authenticated group in `apps/api/start/routes.ts` (depends on T011)
- [X] T014 Boot the API so Tuyau regenerates `apps/api/.adonisjs/server/controllers.ts` and the client registry, and confirm `discharges.index` appears in the generated registry (depends on T013)

### Web read path

- [X] T015 [P] Declare the `DischargeDto` type mirroring the contract's `DischargeListItem` in `apps/web/src/features/discharges/types.ts`
- [X] T016 Add `dischargeQueries.all()` wrapping `tuyauQuery.discharges.index.queryOptions({ staleTime: 0 })` in `apps/web/src/features/discharges/queries/discharge-queries.ts` (depends on T014)

**Checkpoint**: The endpoint answers, is authorized, and the web can type-safely query it.

---

## Phase 3: User Story 1 - Browse the Site's Discharges by Status (Priority: P1) 🎯 MVP

**Goal**: A discharges workbench reachable from the sidebar that lists the site's discharges in
three status tabs, opening on Active, with each tab's count and each row's identifying information.

**Independent Test**: Sign in as each of the four active roles against the seeded database, open
`Operations → Discharges`, and confirm Active is selected with `MV Ocean Cedar` listed, that all
three tabs show counts summing to 27, and that each row carries vessel, status, dock, expected
start, customers, lot count, and shift count.

### Tests for User Story 1 ⚠️

- [X] T017 [P] [US1] Build the fixture set — planned, active, and closed discharges, one with a null `vesselImo`, one with zero product lots and zero shifts, two sharing a vessel name — in `apps/web/src/features/discharges/__tests__/support/fixtures.ts`
- [X] T018 [P] [US1] Build the `mockDischarges` MSW helper covering `/api/v1/auth/me` and `/api/v1/discharges`, in `apps/web/src/features/discharges/__tests__/support/test-helpers.ts`
- [X] T019 [US1] Feature test: Active is the default tab, all three tabs render their counts, and switching tabs lists only that status — in `apps/web/src/features/discharges/__tests__/list/status-tabs.test.tsx` (depends on T017, T018)
- [X] T020 [P] [US1] Feature test: a row shows vessel name, IMO, status, dock name, formatted expected start, distinct customers, lot count, and shift count; a null IMO renders a muted italic `Not specified`; zero lots and zero shifts render `0` — in `apps/web/src/features/discharges/__tests__/list/row-content.test.tsx` (depends on T017, T018)
- [X] T021 [P] [US1] Feature test: rows are inert — clicking one opens no dialog, changes no address, and no row exposes a button, link, or checkbox role — in `apps/web/src/features/discharges/__tests__/list/inert-rows.test.tsx` (depends on T017, T018)
- [X] T022 [P] [US1] Feature test: each of the four active roles sees the same collection and all three tabs — in `apps/web/src/features/discharges/__tests__/access/authorization.test.tsx` (depends on T017, T018)
- [X] T023 [P] [US1] Feature test: the sidebar's Operations group offers a Discharges entry that navigates to `/discharges` for every active role — in `apps/web/src/components/layout/__tests__/authenticated-layout/discharges-navigation.test.tsx`

### Implementation for User Story 1

- [X] T024 [US1] Implement pure `groupByStatus` and `countByStatus` helpers that partition the collection and compute counts before any search is applied, in `apps/web/src/features/discharges/discharge-collections.ts`
- [X] T025 [US1] Create the `/discharges` route with `staticData: { breadcrumb: 'Discharges' }`, a loader calling `ensureSessionUser` then `queryClient.ensureQueryData(dischargeQueries.all())`, and a search schema holding `status` only for now, in `apps/web/src/routes/_authenticated/discharges.tsx` (depends on T016)
- [X] T026 [US1] Implement `DischargesPage` rendering the `sr-only` heading, the `Tabs` with a count on each `TabsTrigger`, and status changes navigating the route, in `apps/web/src/features/discharges/ui/discharges-page.tsx` (depends on T024, T025)
- [X] T027 [US1] Implement `DischargeList` rendering the table rows with no `onSelect`, no hover affordance, and no row actions, using `formatDateTime` from `apps/web/src/helpers/dates.ts`, in `apps/web/src/features/discharges/ui/discharge-list.tsx` (depends on T026)
- [X] T028 [US1] Give the existing `{ label: 'Discharges', icon: ShipIcon }` entry its `href: '/discharges'` in `apps/web/src/components/layout/app-sidebar.tsx`

**Checkpoint**: The MVP is live — the site's discharges are visible and correctly separated for the first time.

---

## Phase 4: User Story 2 - Find and Situate a Discharge (Priority: P2)

**Goal**: Narrow the collection by vessel, IMO, dock, customer, or product, with each tab in a
predictable order.

**Independent Test**: With all three tabs populated, search each of the five fields in turn and
confirm only matching discharges of the selected status remain, that the counts do not move, and
that Planned and Active read soonest-first while Closed reads most-recent-first.

### Tests for User Story 2 ⚠️

- [X] T029 [P] [US2] Unit test the pure matcher — matches vessel name, IMO, dock name, customer name, and product name; ignores letter case and surrounding whitespace; treats a whitespace-only query as no search; returns a discharge matching through several lots exactly once — in `apps/web/src/features/discharges/__tests__/discharge-search.test.ts`
- [X] T030 [P] [US2] Unit test the ordering helper — Planned and Active ascending by expected start, Closed descending, `id` breaking ties in every collection — in `apps/web/src/features/discharges/__tests__/discharge-collections.test.ts`
- [X] T031 [P] [US2] Feature test: searching narrows the listed rows while every tab's count stays at its status total, and switching tabs keeps the search applied — in `apps/web/src/features/discharges/__tests__/list/search.test.tsx` (depends on T017, T018)
- [X] T032 [P] [US2] Feature test: two discharges sharing a vessel name are distinguished by dock, expected start, and customers — in `apps/web/src/features/discharges/__tests__/list/ordering.test.tsx` (depends on T017, T018)

### Implementation for User Story 2

- [X] T033 [P] [US2] Implement the pure `matchesSearch` helper over the five fields with trimming, lower-casing, and per-discharge de-duplication, in `apps/web/src/features/discharges/discharge-search.ts`
- [X] T034 [US2] Add the per-status ordering to `apps/web/src/features/discharges/discharge-collections.ts`, reversing the API's ascending order for Closed only (depends on T024)
- [X] T035 [US2] Wire an `InputSearch` into `DischargesPage` with a placeholder naming what it matches, applying the matcher to the rows and never to the counts, in `apps/web/src/features/discharges/ui/discharges-page.tsx` (depends on T033, T034)

**Checkpoint**: The collection is navigable as the site's history grows.

---

## Phase 5: User Story 3 - Share and Restore a Consultation State (Priority: P3)

**Goal**: The selected status and the typed search survive a reload and travel in a shared link.

**Independent Test**: Select a tab, type a search, copy the address, reload it and open it in a
separate session, and confirm both are restored; then open `?status=nope` and confirm the Active
tab appears with no error page.

### Tests for User Story 3 ⚠️

- [X] T036 [P] [US3] Feature test: status and search both appear in the address, a reload restores both, and an unknown `status` value falls back to the Active tab without an error boundary — in `apps/web/src/features/discharges/__tests__/url/state.test.tsx` (depends on T017, T018)

### Implementation for User Story 3

- [X] T037 [US3] Extend the route search schema to `status: z.enum(['planned','active','closed']).catch('active')` and `search: z.string().catch('')`, with no `dischargeId` and no `mode` per FR-024, in `apps/web/src/routes/_authenticated/discharges.tsx` (depends on T025)
- [X] T038 [US3] Navigate with `replace: true` while typing so a search does not fill the history stack, and preserve `search` when the status changes, in `apps/web/src/features/discharges/ui/discharges-page.tsx` (depends on T035, T037)

**Checkpoint**: A colleague can be sent the exact collection under discussion.

---

## Phase 6: User Story 4 - Recover From Empty and Failed Consultation (Priority: P3)

**Goal**: Empty, no-match, loading, and failure each read as themselves.

**Independent Test**: Open a status with no discharge, search for something that matches nothing,
load with the query pending, and load against a failing endpoint — then retry and confirm the
collection returns.

### Tests for User Story 4 ⚠️

- [X] T039 [P] [US4] Feature test: an empty status renders copy naming that status with no create action, while a search matching nothing renders no-match copy that does not claim the status is empty — in `apps/web/src/features/discharges/__tests__/feedback/states.test.tsx` (depends on T017, T018)
- [X] T040 [P] [US4] Feature test: a failed retrieval renders the error state with a retry action, and retrying after the endpoint recovers displays the collection — in `apps/web/src/features/discharges/__tests__/feedback/retry.test.tsx` (depends on T017, T018)

### Implementation for User Story 4

- [X] T041 [P] [US4] Implement the route-level pending component in `apps/web/src/features/discharges/ui/discharges-pending.tsx`
- [X] T042 [P] [US4] Implement the route-level error component with a retry action in `apps/web/src/features/discharges/ui/discharges-error.tsx`
- [X] T043 [US4] Render distinct `Empty` and no-match states in `apps/web/src/features/discharges/ui/discharge-list.tsx`, offering no create action in either (depends on T027)
- [X] T044 [US4] Register `pendingComponent` and `errorComponent` on the route in `apps/web/src/routes/_authenticated/discharges.tsx` (depends on T037, T041, T042)

**Checkpoint**: All four stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T045 ⚠️ **Blocked on human confirmation** — align FR-006 in `spec.md` with `research.md` Decision 3. If the reviewer confirms `shiftCount` counts every shift, change "its number of planned shifts" to "its number of shifts". If the literal `PLANNED`-status reading was intended instead, rename the field to `plannedShiftCount` and revise T007, T009, `contracts/discharges.openapi.yaml`, and `data-model.md` accordingly. Do not guess: this changes the transport contract.
- [ ] T046 [P] Run the `quickstart.md` API and browser validation passes end to end against a freshly seeded database — **not run**: the compose Postgres on port 5433 is not up, and the test suites use SQLite, so no seeded database was available in this session
- [X] T047 Run the repository gates — Biome clean on all 38 changed files; `tsc --noEmit` clean for both apps; API unit 427/427 and integration 582/582; web discharges + layout 57/57. The **full** web suite is not green on this machine: 5-9 `transport-companies` tests time out at ~3s depending on load. A controlled A/B on `contact.test.tsx` — same file, back to back, with and without the new sidebar `href` — passed 4/4 in **both** arms, so this slice is not the cause; they are load- and parallelism-dependent flakes in that suite. Re-run `pnpm test` on an idle machine before the PR
- [ ] T048 Fresh read-only review of the final diff per Constitution VII, with confirmed findings resolved or explicitly justified

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **blocks every user story**
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on US1 — extends `discharges-page.tsx` and `discharge-collections.ts`
- **US3 (Phase 5)**: Depends on US1 for the route file; independent of US2 except that T038 edits the page after T035
- **US4 (Phase 6)**: Depends on US1 for `discharge-list.tsx`; independent of US2 and US3
- **Polish (Phase 7)**: Depends on all delivered stories

### Note on story independence

US2, US3, and US4 each extend files US1 creates, so they are independently *testable* but not
independently *startable* — this is one vertical slice in one PR, not four parallel workstreams.
US2, US3, and US4 can be built in any order once US1 lands, and each can be validated on its own.

### Within Each Story

- Tests written and failing before implementation
- Repository and policy before use case; use case before controller; controller before route
- Pure helpers before the components that consume them

### Parallel Opportunities

- T003, T004, T005 — the three API test files, written together
- T006, T008, T009 — repository abstraction, policy, and transformer touch different files
- T015 with any API implementation task — different app
- T017, T018 then T020, T021, T022, T023 — separate web test files
- T029, T030, T031, T032 — separate test files
- T041, T042 — separate components

---

## Parallel Example: Foundational Phase

```bash
# The three API test files, written together before any implementation:
Task: "Unit test DischargePolicy.list in apps/api/tests/unit/discharges/consultation/policy.spec.ts"
Task: "Unit test the repository read in apps/api/tests/unit/discharges/consultation/list.spec.ts"
Task: "Integration test GET /api/v1/discharges in apps/api/tests/integration/discharges/consultation/list.spec.ts"

# Then three implementation files with no interdependency:
Task: "DischargeRepository abstraction in apps/api/app/discharges/shared/repositories/discharge_repository.ts"
Task: "DischargePolicy in apps/api/app/discharges/shared/discharge_policy.ts"
Task: "DischargeTransformer in apps/api/app/discharges/shared/discharge_transformer.ts"
```

---

## Implementation Strategy

### MVP First (Setup + Foundational + US1)

1. Phase 1 — the import alias
2. Phase 2 — the endpoint and the typed query
3. Phase 3 — the workbench, its tabs, its counts, its rows, its navigation entry
4. **STOP and VALIDATE**: the site's discharges are visible for the first time, correctly separated,
   for every role. That alone unblocks GH-58, which is what the roadmap needs from this slice.

### Incremental Delivery

1. MVP as above → demo
2. US2 → the collection stays usable as history accumulates
3. US3 → consultation states become shareable
4. US4 → empty, no-match, and failure stop looking alike
5. Phase 7 → confirm FR-006, run the gates, review

---

## Notes

- `[P]` marks different files with no incomplete dependency
- Verify each test fails before writing its implementation
- Commit per task or per logical group, with Conventional Commits on the feature branch
- T045 is the one task that must not be executed without a human answer
