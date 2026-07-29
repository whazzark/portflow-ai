---
description: "Portflow task list grouped by independently deliverable user story"
---

# Tasks: Administer Docks and Weighing Areas From the Web Workbench

**Input**: `spec.md`, `plan.md`, `data-model.md`, `contracts/`, and `quickstart.md` in this feature directory
**Prerequisites**: Approved spec and plan

## Task format

`- [ ] T001 [P?] [US1] [RED|GREEN|REFACTOR|DOC] Concrete action in an exact path`

## Phase 1: Setup

- [ ] T001 [P] [SETUP] [DOC] Confirm the active feature metadata and branch workflow in `.specify/feature.json` and repository Git configuration
- [ ] T002 [P] [SETUP] [GREEN] Install the MapCN registry component and lock `maplibre-gl` in `apps/web/src/components/ui/map.tsx` and `apps/web/package.json`
- [ ] T003 [P] [SETUP] [DOC] Record the feature verification commands and deferred GH-53 usage-binding constraint in `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/quickstart.md`

## Phase 2: Foundational

- [ ] T004 [FOUNDATION] [GREEN] Add the reversible positive `version` columns, defaults, and rollback to `apps/api/database/migrations/*_add_operational_checkpoint_versions.ts`
- [ ] T005 [P] [FOUNDATION] [GREEN] Update generated database types and schema metadata for versioned docks and weighing areas in `apps/api/database/schema.ts`
- [ ] T006 [P] [FOUNDATION] [GREEN] Extend Dock and Weighing Area models, factories, and actor relations with version and lifecycle fields in `apps/api/app/models/dock.ts`, `apps/api/app/models/weighing_area.ts`, `apps/api/database/factories/dock_factory.ts`, and `apps/api/database/factories/weighing_area_factory.ts`
- [ ] T007 [P] [FOUNDATION] [GREEN] Add shared validation and typed blocker/result mechanics for distinct versioned lifecycle items in `apps/api/app/site_references/shared/`
- [ ] T008 [FOUNDATION] [DOC] Document deterministic grouped classification, conditional writes, and version-increment invariants in `apps/api/app/site_references/shared/`

## Phase 3: User Story 1 - Administer Docks and Weighing Areas From the Web Workbench (Priority: P1)

**Goal**: Active users can consult both named reference types in one accessible workbench, while permitted administrators can create, edit, and individually or collectively archive/reactivate them with validation, authorization, usage blocking, and optimistic concurrency.

**Independent test**: Run the focused API unit/integration suites from `quickstart.md` and `pnpm --filter @portflow/web exec vitest run src/features/checkpoints/__tests__ --pool=threads --maxWorkers=1`; verify the authenticated `/checkpoints` journey and the migration rollback/re-run.

### API RED: persistence, use cases, and authorization

- [ ] T009 [P] [US1] [RED] Add migration and model tests proving existing rows start at version 1 and successful mutations increment once in `apps/api/tests/unit/docks/dock_concurrency.spec.ts` and `apps/api/tests/unit/weighing_areas/weighing_area_concurrency.spec.ts`
- [ ] T010 [P] [US1] [RED] Add Dock conditional update/archive/reactivate tests covering stale, wrong-state, not-found, comment normalization, actor, timestamp, and no-change outcomes in `apps/api/tests/unit/docks/dock_concurrency.spec.ts`
- [ ] T011 [P] [US1] [RED] Add Weighing Area conditional update/archive/reactivate tests covering stale, wrong-state, not-found, comment normalization, actor, timestamp, and no-change outcomes in `apps/api/tests/unit/weighing_areas/weighing_area_concurrency.spec.ts`
- [ ] T012 [P] [US1] [RED] Add mixed grouped Dock lifecycle tests for eligible, `NOT_FOUND`, `STALE_VERSION`, `IN_USE`, and `ALREADY_*` items with request-order preservation in `apps/api/tests/unit/docks/dock_bulk_lifecycle.spec.ts`
- [ ] T013 [P] [US1] [RED] Add mixed grouped Weighing Area lifecycle tests for eligible, `NOT_FOUND`, `STALE_VERSION`, `IN_USE`, and `ALREADY_*` items with request-order preservation in `apps/api/tests/unit/weighing_areas/weighing_area_bulk_lifecycle.spec.ts`
- [ ] T014 [P] [US1] [RED] Add protected HTTP tests for active-user consultation, admin-only mutations, validation, conflicts, stale `409` codes, grouped `200` partial results, and grouped `422` atomic rejection in `apps/api/tests/integration/docks.spec.ts` and `apps/api/tests/integration/weighing_areas.spec.ts`

### API GREEN: named Dock and Weighing Area slices

- [ ] T015 [US1] [GREEN] Extend Dock and Weighing Area repositories and types with conditional individual writes and version-aware result unions in `apps/api/app/docks/` and `apps/api/app/weighing_areas/`
- [ ] T016 [US1] [GREEN] Implement transactional deterministic-lock grouped archive/reactivate repository operations with partial results in `apps/api/app/docks/` and `apps/api/app/weighing_areas/`
- [ ] T017 [US1] [GREEN] Require positive expected versions, editable-field constraints, GPS/name validation, and lifecycle comment normalization in `apps/api/app/docks/` and `apps/api/app/weighing_areas/`
- [ ] T018 [US1] [GREEN] Add named stale-version, lifecycle, conflict, and grouped-result use cases while preserving `SiteReferenceUsageChecker` in `apps/api/app/docks/` and `apps/api/app/weighing_areas/`
- [ ] T019 [US1] [GREEN] Expand list/view policies to active users and retain admin-only mutation policies in `apps/api/app/docks/` and `apps/api/app/weighing_areas/`
- [ ] T020 [US1] [GREEN] Preload lifecycle actors and expose versioned resource summaries in `apps/api/app/docks/` and `apps/api/app/weighing_areas/`
- [ ] T021 [US1] [GREEN] Add static grouped archive/reactivate controller actions, request validation, DTOs, and named routes before `/:id` routes in `apps/api/app/controllers/docks_controller.ts`, `apps/api/app/controllers/weighing_areas_controller.ts`, and `apps/api/start/routes.ts`

### Web RED: route state, workbench, and mutation behavior

- [ ] T022 [P] [US1] [RED] Add router-level tests for independent type/status/search/sort URL state, list-backed details, and safe invalid detail normalization in `apps/web/src/features/checkpoints/__tests__/route-state.test.tsx`
- [ ] T023 [P] [US1] [RED] Add feature tests for observer/admin affordances, named queries, forms, GPS validation, and mutation cache invalidation in `apps/web/src/features/checkpoints/__tests__/workbench.test.tsx`
- [ ] T024 [P] [US1] [RED] Add feature tests for selection-scoped grouped actions, mixed changed/blocked feedback, stale reload prompts, and no automatic retry in `apps/web/src/features/checkpoints/__tests__/lifecycle-actions.test.tsx`
- [ ] T025 [P] [US1] [RED] Add accessibility/responsive tests for synchronized marker lists, labelled controls, focusable dialogs, overflow containment, and map-unavailable fallback in `apps/web/src/features/checkpoints/__tests__/accessibility.test.tsx`
- [ ] T026 [P] [US1] [RED] Add MSW handlers for distinct Dock and Weighing Area contracts without mocking Tuyau in `apps/web/src/features/checkpoints/__tests__/msw/handlers.ts`

### Web GREEN and REFACTOR: checkpoints workbench

- [ ] T027 [US1] [GREEN] Link the enabled Checkpoints navigation item to `/checkpoints` in `apps/web/src/components/layout/app-sidebar.tsx`
- [ ] T028 [US1] [GREEN] Implement URL-backed authenticated route parsing, list preloading, and safe detail state in `apps/web/src/routes/_authenticated/checkpoints.tsx`
- [ ] T029 [US1] [GREEN] Implement distinct Dock and Weighing Area query keys, Tuyau builders, DTO adapters, permissions, filtering, sorting, and selection state in `apps/web/src/features/checkpoints/queries/`, `apps/web/src/features/checkpoints/types.ts`, and `apps/web/src/features/checkpoints/helpers/`
- [ ] T030 [US1] [GREEN] Implement the shared resource-aware create/edit form with explicit coordinate strings and server validation feedback in `apps/web/src/features/checkpoints/ui/` and `apps/web/src/features/checkpoints/mutations/`
- [ ] T031 [US1] [GREEN] Implement individual lifecycle dialogs, versioned mutations, stale reload behavior, and affected-resource query invalidation in `apps/web/src/features/checkpoints/mutations/` and `apps/web/src/features/checkpoints/ui/`
- [ ] T032 [US1] [GREEN] Implement visible-type/status/search/sort filters, synchronized accessible list, marker selection, detail sheet, selection toolbar, and grouped partial-result feedback in `apps/web/src/features/checkpoints/ui/`
- [ ] T033 [US1] [GREEN] Implement the client-only MapCN canvas with distinct icons, theme-aware CARTO styles, attribution, loading/error states, and list fallback in `apps/web/src/components/ui/map.tsx` and `apps/web/src/features/checkpoints/ui/`
- [ ] T034 [US1] [REFACTOR] Align checkpoints components with Channel Marker tokens, shadcn primitives, Lucide semantics, keyboard focus order, and narrow viewport layout in `apps/web/src/features/checkpoints/ui/`

### User Story 1 documentation

- [ ] T035 [US1] [DOC] Update feature-local acceptance notes and manual/browser validation details after implementation in `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/quickstart.md`

## Final verification

- [ ] T036 [VERIFY] [GREEN] Run the focused Dock and Weighing Area API suites and migration validation from `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/quickstart.md`
- [ ] T037 [VERIFY] [GREEN] Run the checkpoints Vitest feature suite from `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/quickstart.md`
- [ ] T038 [VERIFY] [GREEN] Run `pnpm check` from the repository root
- [ ] T039 [VERIFY] [GREEN] Run `pnpm typecheck` from the repository root
- [ ] T040 [VERIFY] [GREEN] Run `pnpm test` from the repository root
- [ ] T041 [VERIFY] [GREEN] Run the configured authenticated browser journey and verify MapCN/WebGL, CARTO attribution, and responsive behavior when available
- [ ] T042 [VERIFY] [DOC] Run `$speckit-analyze` and `$speckit-converge` for this feature directory and resolve any actionable findings

## Dependencies and execution order

- Phase 1 precedes Phase 2. T004 must precede API implementation; T002 must precede MapCN work.
- Phase 2 precedes User Story 1. API RED tasks T009–T014 can run in parallel; API GREEN tasks T015–T021 follow the relevant failing tests and share the foundational migration/types.
- Web RED tasks T022–T026 can run in parallel after the API contracts are fixed; T027–T034 follow those tests and may proceed in parallel by route, data/mutations, and UI files, with T033 dependent on T002.
- T036–T042 run only after T009–T035 are green. Run T038–T040 together where CI capacity permits; T042 is last.

### Parallel execution examples

```text
Group A (API RED): T009, T010, T011, T012, T013, T014
Group B (API slices): T015, T017, T019, T020 (after their tests; avoid same-file edits)
Group C (web RED): T022, T023, T024, T025, T026
Group D (web slices): T027, T028, T029, T030, T031, T032, T033 (split by exact files)
```

## Implementation strategy

Deliver the API consultation and individual administration path first, including the reversible version migration and protected HTTP contracts. Add grouped lifecycle partial success next. Then deliver the `/checkpoints` route with URL-backed list/detail state, followed by forms and lifecycle mutations, and finally MapCN/accessibility polish. The MVP is User Story 1's active-user consultation plus administrator create/edit/individual lifecycle behavior; grouped lifecycle and map enhancements complete the full P1 acceptance scope before verification.
