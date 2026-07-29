---
description: "Portflow task list grouped by independently deliverable user story"
---

# Tasks: Administer Docks and Weighing Areas From the Web Workbench

**Input**: `spec.md`, `plan.md`, `data-model.md`, `contracts/`, `research.md`, and `quickstart.md` in this feature directory
**Prerequisites**: Approved spec and plan

## Phase 1: Setup

- [ ] T001 [DOC] Confirm the active feature directory and approved GH-41 contracts in `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/spec.md`
- [ ] T002 [P] [SETUP] Add the reversible operational-checkpoint version migration in `apps/api/database/migrations/*_add_operational_checkpoint_versions.ts`
- [ ] T003 [P] [SETUP] Extend generated database schema types with positive `version` fields in `apps/api/database/schema.ts`
- [ ] T004 [P] [SETUP] Add version and lifecycle actor relations to the Dock model in `apps/api/app/models/dock.ts`
- [ ] T005 [P] [SETUP] Add version and lifecycle actor relations to the Weighing Area model in `apps/api/app/models/weighing_area.ts`
- [ ] T006 [P] [SETUP] Update Dock and Weighing Area factories with version defaults and lifecycle metadata fixtures in `apps/api/database/factories/dock_factory.ts` and `apps/api/database/factories/weighing_area_factory.ts`

## Phase 2: Foundational

- [ ] T007 [FOUNDATION] [RED] Add repository tests proving version `1` migration defaults, one-step increments, stale zero-row writes, rollback compatibility, and preserved coordinate/name constraints in `apps/api/tests/unit/docks/dock_concurrency.spec.ts` and `apps/api/tests/unit/weighing_areas/weighing_area_concurrency.spec.ts`
- [ ] T008 [FOUNDATION] [GREEN] Implement portable conditional version increments and typed stale/not-found/state outcomes in `apps/api/app/docks/shared/repositories/dock_repository.ts` and `apps/api/app/weighing_areas/shared/repositories/weighing_area_repository.ts`
- [ ] T009 [FOUNDATION] [GREEN] Implement Lucid conditional writes, lifecycle metadata persistence, actor preloads, and deterministic grouped-row locking in `apps/api/app/docks/shared/repositories/lucid_dock_repository.ts` and `apps/api/app/weighing_areas/shared/repositories/lucid_weighing_area_repository.ts`
- [ ] T010 [P] [FOUNDATION] [RED] Add shared validation tests for distinct versioned items, UUIDs, positive versions, optional trimmed comments, and request-level rejection in `apps/api/tests/unit/site_references/versioned_lifecycle_validation.spec.ts`
- [ ] T011 [P] [FOUNDATION] [GREEN] Add genuinely resource-neutral versioned lifecycle validation and blocker result helpers in `apps/api/app/site_references/shared/`
- [ ] T012 [P] [FOUNDATION] [RED] Add policy tests proving active-user consultation and admin-only mutations for both named resources in `apps/api/tests/unit/docks/dock_policy.spec.ts` and `apps/api/tests/unit/weighing_areas/weighing_area_policy.spec.ts`
- [ ] T013 [FOUNDATION] [GREEN] Expand named Dock and Weighing Area policies and list/show authorization paths in `apps/api/app/docks/shared/dock_policy.ts`, `apps/api/app/weighing_areas/shared/weighing_area_policy.ts`, and existing list/show use cases

## Phase 3: User Story 1 - Administer Docks and Weighing Areas From the Web Workbench (Priority: P1)

**Goal**: Active users can consult both reference types in one searchable, map-backed workbench; Organization Admins and Operations Admins can create, edit, archive, reactivate, and group lifecycle actions while the API preserves validation, authorization, usage, and optimistic-concurrency invariants.

**Independent test**: Run the focused API Japa suites and the router-level MSW feature suite from `quickstart.md`; verify the authenticated `/checkpoints` journey and every acceptance scenario, including observer read-only access, mixed grouped outcomes, stale reload, and map/list fallback.

### API Dock slice

- [ ] T014 [P] [US1] [RED] Add Dock use-case tests for normalized name/GPS validation, same-type uniqueness, cross-type same-name allowance, versioned update, archive usage blocking, reactivation identity/history, actor/time/comment metadata, and stale outcomes in `apps/api/tests/unit/docks/dock_use_cases.spec.ts` and `apps/api/tests/unit/docks/dock_concurrency.spec.ts`
- [ ] T015 [P] [US1] [RED] Add Dock grouped lifecycle tests for eligible, `NOT_FOUND`, `STALE_VERSION`, `IN_USE`, and wrong-state items, request ordering, partial success, unchanged blockers, and malformed requests in `apps/api/tests/unit/docks/dock_bulk_lifecycle.spec.ts`
- [ ] T016 [US1] [GREEN] Extend Dock commands, exceptions, validators, and use cases with `expectedVersion`, trimmed comments, stale mapping, and individual lifecycle behavior in `apps/api/app/docks/create/`, `apps/api/app/docks/update/`, `apps/api/app/docks/archive/`, `apps/api/app/docks/reactivate/`, and `apps/api/app/docks/shared/`
- [ ] T017 [US1] [GREEN] Add named Dock grouped archive and reactivate use cases with usage-checker integration and ordered partial-result mapping in `apps/api/app/docks/archive/` and `apps/api/app/docks/reactivate/`
- [ ] T018 [US1] [GREEN] Extend the Dock transformer with version and nullable lifecycle actor summaries while preserving named DTO fields in `apps/api/app/docks/shared/dock_transformer.ts`
- [ ] T019 [US1] [RED] Add Dock HTTP integration coverage for active-user reads, admin/observer authorization, DTO shape, static grouped route ordering, validation, duplicate/wrong-state/in-use/stale errors, and mixed grouped results in `apps/api/tests/integration/docks.spec.ts`
- [ ] T020 [US1] [GREEN] Add Dock grouped controller actions and register versioned individual/grouped request contracts in `apps/api/app/controllers/docks_controller.ts` and `apps/api/start/routes.ts`

### API Weighing Area slice

- [ ] T021 [P] [US1] [RED] Add Weighing Area use-case tests for normalized name/GPS validation, same-type uniqueness, cross-type same-name allowance, versioned update, archive usage blocking, reactivation identity/history, actor/time/comment metadata, and stale outcomes in `apps/api/tests/unit/weighing_areas/weighing_area_use_cases.spec.ts` and `apps/api/tests/unit/weighing_areas/weighing_area_concurrency.spec.ts`
- [ ] T022 [P] [US1] [RED] Add Weighing Area grouped lifecycle tests for eligible, `NOT_FOUND`, `STALE_VERSION`, `IN_USE`, and wrong-state items, request ordering, partial success, unchanged blockers, and malformed requests in `apps/api/tests/unit/weighing_areas/weighing_area_bulk_lifecycle.spec.ts`
- [ ] T023 [US1] [GREEN] Extend Weighing Area commands, exceptions, validators, and use cases with `expectedVersion`, trimmed comments, stale mapping, and individual lifecycle behavior in `apps/api/app/weighing_areas/create/`, `apps/api/app/weighing_areas/update/`, `apps/api/app/weighing_areas/archive/`, `apps/api/app/weighing_areas/reactivate/`, and `apps/api/app/weighing_areas/shared/`
- [ ] T024 [US1] [GREEN] Add named Weighing Area grouped archive and reactivate use cases with usage-checker integration and ordered partial-result mapping in `apps/api/app/weighing_areas/archive/` and `apps/api/app/weighing_areas/reactivate/`
- [ ] T025 [US1] [GREEN] Extend the Weighing Area transformer with version and nullable lifecycle actor summaries while preserving named DTO fields in `apps/api/app/weighing_areas/shared/weighing_area_transformer.ts`
- [ ] T026 [US1] [RED] Add Weighing Area HTTP integration coverage for active-user reads, admin/observer authorization, DTO shape, static grouped route ordering, validation, duplicate/wrong-state/in-use/stale errors, and mixed grouped results in `apps/api/tests/integration/weighing_areas.spec.ts`
- [ ] T027 [US1] [GREEN] Add Weighing Area grouped controller actions and register versioned individual/grouped request contracts in `apps/api/app/controllers/weighing_areas_controller.ts` and `apps/api/start/routes.ts`

### Workbench consultation shell

- [ ] T028 [P] [US1] [RED] Add router tests for URL-restored visible types, independent Dock/Weighing Area searches and statuses, case-insensitive substring filtering, detail modes, and sidebar navigation in `apps/web/src/features/checkpoints/__tests__/list/`, `apps/web/src/features/checkpoints/__tests__/details/`, and `apps/web/src/routes/_authenticated/checkpoints.test.tsx`
- [ ] T029 [P] [US1] [GREEN] Add named Dock and Weighing Area query adapters, discriminated workbench view models, URL Zod search state, and route list preloading in `apps/web/src/features/checkpoints/types.ts`, `apps/web/src/features/checkpoints/queries/`, `apps/web/src/features/checkpoints/helpers/`, and `apps/web/src/routes/_authenticated/checkpoints.tsx`
- [ ] T030 [P] [US1] [GREEN] Add the authenticated checkpoints route shell and link the existing sidebar item to `/checkpoints` in `apps/web/src/routes/_authenticated/checkpoints.tsx` and `apps/web/src/components/layout/app-sidebar.tsx`
- [ ] T031 [P] [US1] [GREEN] Add the owned MapCN component with MapLibre dependency, theme-aware CARTO styles, attribution, hydration-safe client mounting, distinct Dock/Weighing Area markers, and map-unavailable fallback; record and pin the runtime dependency changes in `apps/web/src/components/ui/map.tsx`, `apps/web/package.json`, and `pnpm-lock.yaml`
- [ ] T032 [US1] [GREEN] Build the synchronized map, filters, accessible marker list, loading/error/empty states, and marker-backed detail sheet in `apps/web/src/features/checkpoints/ui/`

### Workbench administration and lifecycle UX

- [ ] T033 [P] [US1] [RED] Add web tests for observer read-only affordances, GPS validation, create/edit version submission, individual lifecycle confirmation, cache invalidation, and stale reload behavior in `apps/web/src/features/checkpoints/__tests__/details/`, `apps/web/src/features/checkpoints/__tests__/lifecycle/`, and `apps/web/src/features/checkpoints/__tests__/permissions/`
- [ ] T034 [P] [US1] [RED] Add web tests for visible-scope selection, grouped archive/reactivate submission, mixed changed/blocked feedback, stable blocker reasons, stale selection refresh, and no automatic retry in `apps/web/src/features/checkpoints/__tests__/bulk/`
- [ ] T035 [US1] [GREEN] Implement shared resource-aware forms, create/edit sheets, server validation mapping, and individual mutation adapters using `useAppForm` and named Tuyau clients in `apps/web/src/features/checkpoints/ui/`, `apps/web/src/features/checkpoints/mutations/`, and `apps/web/src/features/checkpoints/helpers/`
- [ ] T036 [US1] [GREEN] Implement permission-aware individual lifecycle dialogs and mutations with version echoing, affected-resource cache invalidation, recoverable failures, and explicit stale reload action in `apps/web/src/features/checkpoints/ui/`, `apps/web/src/features/checkpoints/mutations/`, and `apps/web/src/features/checkpoints/queries/`
- [ ] T037 [US1] [GREEN] Implement type/status/search-scoped selection, keyboard-reachable grouped lifecycle toolbar, confirmation, ordered payloads, and announced per-resource partial-result feedback in `apps/web/src/features/checkpoints/ui/`, `apps/web/src/features/checkpoints/mutations/`, and `apps/web/src/features/checkpoints/types.ts`
- [ ] T038 [US1] [RED] Add responsive and accessibility regression tests for icon names, text status/reasons, keyboard flow, focus/dialog behavior, and accessible map fallback at viewport widths `375`, `768`, `1024`, and `1440` px; at each width assert `document.documentElement.scrollWidth <= window.innerWidth` and that the map/list, filters, detail sheet or dialog, and selection toolbar remain visible and keyboard reachable without horizontal page scrolling in `apps/web/src/features/checkpoints/__tests__/accessibility/` and `apps/web/src/features/checkpoints/__tests__/responsive/`
- [ ] T039 [US1] [REFACTOR] Align the checkpoints feature with Channel Marker tokens, IBM Plex typography, existing shadcn primitives, named cache keys, and the API/UI boundary rules in `apps/web/src/features/checkpoints/`

## Final Phase: Polish and cross-cutting concerns

- [ ] T040 [P] [VERIFY] Add migration and disposable PostgreSQL verification notes/results for migrate, rollback, re-migrate, existing version `1`, and successful version `2` writes in `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/quickstart.md`
- [ ] T041 [P] [VERIFY] Run focused Dock and Weighing Area API suites and the checkpoints MSW router suite using the commands in `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/quickstart.md`
- [ ] T042 [P] [VERIFY] Run the configured authenticated checkpoints Playwright journey, or record that no such seam is configured, in `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/quickstart.md`
- [ ] T043 [VERIFY] Run `pnpm check` from the repository root and resolve formatting/lint/type generation failures in affected files
- [ ] T044 [VERIFY] Run `pnpm typecheck` from the repository root and resolve API Tuyau, route, and web type failures in affected files
- [ ] T045 [VERIFY] Run `pnpm test` from the repository root and resolve regressions in affected test suites
- [ ] T046 [VERIFY] Run `$speckit-analyze` against this feature directory and resolve actionable cross-artifact inconsistencies
- [ ] T047 [VERIFY] Run `$speckit-converge` against this feature directory and append or complete any remaining implementation tasks in `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/tasks.md`

## Dependencies and execution order

1. Phase 1 setup tasks T002-T006 can run in parallel after T001; migration/schema/model/factory changes must be complete before repository tests and implementation.
2. Phase 2 is blocking. T007-T013 establish versioning, shared validation mechanics, and consultation authorization before either named API slice.
3. Within User Story 1, the Dock API slice (T014-T020) and Weighing Area API slice (T021-T027) can proceed in parallel after Phase 2; each slice's RED tasks precede its GREEN tasks.
4. The consultation shell T028-T032 depends on named read DTOs/routes and can proceed alongside the API mutation work once those contracts exist.
5. Administration UX tests T033-T034 depend on the consultation shell and named mutation contracts; implementation T035-T037 follows the corresponding RED tests. T038 follows the completed responsive UI composition.
6. T039 is a refactor after the feature behavior is green. Final verification starts only after T039 and all story tests pass.

### Parallel execution examples

- **API foundation**: T002-T006 in parallel; then T007, T010, and T012 in parallel before T008-T009 and T011-T013.
- **Named API slices**: Dock work T014-T020 and Weighing Area work T021-T027 are independent after shared foundation and can be assigned to separate workers.
- **Web shell**: T028-T031 can proceed in parallel after the read contracts; T032 integrates their outputs.
- **Web administration**: T033 and T034 can be written in parallel; T035 and T036 can proceed in parallel once their contracts are stable, followed by T037-T039.
- **Verification**: T040-T042 are independent validation activities; T043-T047 remain ordered where later checks consume earlier fixes.

## Implementation strategy

Deliver the MVP as the active-user consultation slice plus one complete named API mutation path: versioned Dock API and `/checkpoints` consultation (T014-T020 and T028-T032). Incrementally add the Weighing Area API, shared workbench administration, grouped partial-success behavior, and responsive/accessibility polish. Preserve TDD checkpoints, keep Dock and Weighing Area contracts distinct, and do not introduce a generic Checkpoint entity or discharge persistence.

## Format validation

All executable tasks use the required checklist form: unchecked checkbox, sequential `T###` ID, optional `[P]`, required `[US1]` only in the user-story phase, a phase label, and an exact repository or feature-artifact path.
