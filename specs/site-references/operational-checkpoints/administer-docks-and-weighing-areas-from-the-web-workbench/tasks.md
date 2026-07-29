---
description: "Portflow task list grouped by independently deliverable user story"
---

# Tasks: Administer Docks and Weighing Areas From the Web Workbench

**Input**: `spec.md`, `plan.md`, `data-model.md`, `contracts/`, and `quickstart.md` in this feature directory
**Prerequisites**: Approved spec and plan

## Task format

`- [ ] T001 [P?] [US1] [RED|GREEN|REFACTOR|DOC] Concrete action in an exact path`

## Phase 1: Setup

- [ ] T001 [P] [SETUP] [DOC] Confirm the active feature directory and approved contracts in `.specify/feature.json` and `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/`
- [ ] T002 [P] [SETUP] [GREEN] Install or generate the owned MapCN component and `maplibre-gl` dependency in `apps/web/src/components/ui/map.tsx`, `apps/web/package.json`, and `pnpm-lock.yaml`
- [ ] T003 [P] [SETUP] [DOC] Record the existing Dock and Weighing Area vertical-slice seams and preserve temporary `SiteReferenceUsageChecker` binding in `apps/api/app/docks/`, `apps/api/app/weighing_areas/`, and `apps/api/app/providers/`

## Phase 2: Foundational

- [ ] T004 [P] [RED] Add migration and repository failing tests for version `1` defaults, one-step increments, stale zero-row writes, rollback, and preserved constraints in `apps/api/tests/unit/docks/`, `apps/api/tests/unit/weighing_areas/`, and `apps/api/tests/integration/`
- [ ] T005 [GREEN] Add reversible `version` columns and generated schema/model/factory support in `apps/api/database/migrations/*_add_operational_checkpoint_versions.ts`, `apps/api/database/schema.ts`, `apps/api/app/models/dock.ts`, `apps/api/app/models/weighing_area.ts`, `apps/api/database/factories/dock_factory.ts`, and `apps/api/database/factories/weighing_area_factory.ts`
- [ ] T006 [P] [RED] Add failing shared validation/result tests for distinct UUID plus positive-version lifecycle items and stable blocker reasons in `apps/api/tests/unit/site_references/`
- [ ] T007 [GREEN] Implement only genuinely shared versioned lifecycle validation/result helpers in `apps/api/app/site_references/shared/`
- [ ] T008 [P] [RED] Add failing policy and transformer tests for active-user reads, admin-only mutations, version fields, and nullable actor summaries in `apps/api/tests/unit/docks/` and `apps/api/tests/unit/weighing_areas/`
- [ ] T009 [GREEN] Extend named Dock and Weighing Area policies, relations, list DTOs, and mutation DTOs in `apps/api/app/docks/`, `apps/api/app/weighing_areas/`, `apps/api/app/models/dock.ts`, and `apps/api/app/models/weighing_area.ts`

## Phase 3: User Story 1 - Administer Docks and Weighing Areas From the Web Workbench (Priority: P1)

**Goal**: Active users can consult both named reference types in `/checkpoints`; Organization Admins and Operations Admins can safely create, edit, individually transition, and selection-scope transition them with validation, usage blocking, and optimistic concurrency.

**Independent test**: Run the focused API suites and Vitest feature suite from `quickstart.md`; verify an authenticated observer consultation journey and an administrator mutation journey through the configured browser seam, or record that no Playwright seam exists.

### Persistence and Dock API slice

- [ ] T010 [P] [US1] [RED] Add failing Dock repository tests for conditional update/archive/reactivate, archived read-only updates, name conflicts, usage blocking, and typed stale outcomes in `apps/api/tests/unit/docks/`
- [ ] T011 [US1] [GREEN] Implement version-aware Dock update and lifecycle commands/results in `apps/api/app/docks/update/`, `apps/api/app/docks/archive/`, `apps/api/app/docks/reactivate/`, and `apps/api/app/docks/shared/`
- [ ] T012 [P] [US1] [RED] Add failing Dock use-case tests for trimming, GPS/name validation, comments, actor/time capture, authorization outcomes, stale errors, and unchanged failure state in `apps/api/tests/unit/docks/`
- [ ] T013 [US1] [GREEN] Extend Dock validators, use cases, exceptions, and repository implementations for expected-version mutations in `apps/api/app/docks/` and `apps/api/app/site_references/shared/`
- [ ] T014 [P] [US1] [RED] Add failing Dock HTTP tests for active-user reads, protected mutations, DTO shape, route ordering, validation, duplicate/wrong-state/in-use/stale errors, and successful versioned writes in `apps/api/tests/integration/docks.spec.ts`
- [ ] T015 [US1] [GREEN] Extend Dock controller actions, routes, policies, and named Tuyau contracts for versioned individual endpoints in `apps/api/app/controllers/docks_controller.ts`, `apps/api/start/routes.ts`, and `apps/api/app/docks/`

### Weighing Area API slice

- [ ] T016 [P] [US1] [RED] Add failing Weighing Area repository tests for conditional update/archive/reactivate, archived read-only updates, name conflicts, usage blocking, and typed stale outcomes in `apps/api/tests/unit/weighing_areas/`
- [ ] T017 [US1] [GREEN] Implement version-aware Weighing Area update and lifecycle commands/results in `apps/api/app/weighing_areas/update/`, `apps/api/app/weighing_areas/archive/`, `apps/api/app/weighing_areas/reactivate/`, and `apps/api/app/weighing_areas/shared/`
- [ ] T018 [P] [US1] [RED] Add failing Weighing Area use-case tests for trimming, GPS/name validation, comments, actor/time capture, authorization outcomes, stale errors, and unchanged failure state in `apps/api/tests/unit/weighing_areas/`
- [ ] T019 [US1] [GREEN] Extend Weighing Area validators, use cases, exceptions, and repository implementations for expected-version mutations in `apps/api/app/weighing_areas/`
- [ ] T020 [P] [US1] [RED] Add failing Weighing Area HTTP tests for active-user reads, protected mutations, DTO shape, route ordering, validation, duplicate/wrong-state/in-use/stale errors, and successful versioned writes in `apps/api/tests/integration/weighing_areas.spec.ts`
- [ ] T021 [US1] [GREEN] Extend Weighing Area controller actions, routes, policies, and named Tuyau contracts for versioned individual endpoints in `apps/api/app/controllers/weighing_areas_controller.ts`, `apps/api/start/routes.ts`, and `apps/api/app/weighing_areas/`

### Grouped lifecycle API

- [ ] T022 [P] [US1] [RED] Add failing Dock grouped repository/use-case tests for deterministic locking, validation-before-write, partial success, usage blockers, stale/wrong-state/not-found reasons, and request-order preservation in `apps/api/tests/unit/docks/`
- [ ] T023 [US1] [GREEN] Implement transactional Dock archive-many/reactivate-many commands, typed results, validators, use cases, and repository locking in `apps/api/app/docks/archive/`, `apps/api/app/docks/reactivate/`, and `apps/api/app/docks/shared/`
- [ ] T024 [P] [US1] [RED] Add failing Weighing Area grouped repository/use-case tests for deterministic locking, validation-before-write, partial success, usage blockers, stale/wrong-state/not-found reasons, and request-order preservation in `apps/api/tests/unit/weighing_areas/`
- [ ] T025 [US1] [GREEN] Implement transactional Weighing Area archive-many/reactivate-many commands, typed results, validators, use cases, and repository locking in `apps/api/app/weighing_areas/archive/`, `apps/api/app/weighing_areas/reactivate/`, and `apps/api/app/weighing_areas/shared/`
- [ ] T026 [P] [US1] [RED] Add failing grouped HTTP tests for both resources covering empty/duplicate/malformed input, mixed results, ordering, unchanged blockers, and admin authorization in `apps/api/tests/integration/docks.spec.ts` and `apps/api/tests/integration/weighing_areas.spec.ts`
- [ ] T027 [US1] [GREEN] Add static grouped controller actions and register `/archive` and `/reactivate` before `/:id` with explicit named response DTOs in `apps/api/app/controllers/docks_controller.ts`, `apps/api/app/controllers/weighing_areas_controller.ts`, and `apps/api/start/routes.ts`

### Consultation workbench shell

- [ ] T028 [P] [US1] [RED] Add failing router/query tests for URL-restored independent type, status, and name-search state, case-insensitive substring filtering, list preloading, and affected-resource cache keys in `apps/web/src/features/checkpoints/__tests__/` and `apps/web/src/routes/_authenticated/checkpoints.tsx`
- [ ] T029 [US1] [GREEN] Implement the SSR-safe `/checkpoints` route, Zod search schema, named Dock/Weighing Area queries, discriminated view model, and independent filter adapters in `apps/web/src/routes/_authenticated/checkpoints.tsx`, `apps/web/src/features/checkpoints/queries/`, `apps/web/src/features/checkpoints/helpers/`, and `apps/web/src/features/checkpoints/types.ts`
- [ ] T030 [P] [US1] [RED] Add failing feature tests for accessible synchronized list/detail states, distinct markers, map-unavailable fallback, observer read-only affordances, loading/error/empty states, and keyboard flow in `apps/web/src/features/checkpoints/__tests__/`
- [ ] T031 [US1] [GREEN] Build the map/list workbench, client-only MapCN boundary, accessible marker list, detail sheet, filters, and recoverable state feedback in `apps/web/src/features/checkpoints/ui/` and `apps/web/src/components/ui/map.tsx`
- [ ] T032 [P] [US1] [GREEN] Link the existing Checkpoints sidebar item to `/checkpoints` in `apps/web/src/components/layout/app-sidebar.tsx`

### Administration UX and mutation feedback

- [ ] T033 [P] [US1] [RED] Add failing form tests for GPS boundaries, blank/name errors, create version `1`, available-only edit, server validation, preserved input, and resource-aware edit version submission in `apps/web/src/features/checkpoints/__tests__/`
- [ ] T034 [US1] [GREEN] Implement shared resource-aware create/edit forms, field adapters, validation mapping, and admin-only controls using existing form primitives in `apps/web/src/features/checkpoints/ui/` and `apps/web/src/features/checkpoints/mutations/`
- [ ] T035 [P] [US1] [RED] Add failing mutation tests for individual archive/reactivate confirmation, optional trimmed comments, stale reload behavior, no automatic retry, and named cache invalidation in `apps/web/src/features/checkpoints/__tests__/`
- [ ] T036 [US1] [GREEN] Implement named individual mutation hooks, lifecycle dialogs, stale reload action, and affected-resource invalidation in `apps/web/src/features/checkpoints/mutations/` and `apps/web/src/features/checkpoints/ui/`
- [ ] T037 [P] [US1] [RED] Add failing selection tests for independent per-kind selections, scope clearing, simultaneous labelled toolbars, resource-specific grouped requests, pending disablement, and mixed result announcements in `apps/web/src/features/checkpoints/__tests__/`
- [ ] T038 [US1] [GREEN] Implement selection state, grouped archive/reactivate mutations, confirmation flows, partial-result rendering, changed/blocked selection reconciliation, and stale retry lockout in `apps/web/src/features/checkpoints/ui/`, `apps/web/src/features/checkpoints/mutations/`, and `apps/web/src/features/checkpoints/helpers/`
- [ ] T039 [P] [US1] [RED] Add failing responsive/accessibility tests for no page-level horizontal overflow and operable map, list, filters, dialogs, and both toolbars at 375, 768, 1024, and 1440 pixels in `apps/web/src/features/checkpoints/__tests__/`
- [ ] T040 [US1] [REFACTOR] Align responsive layout, focus behavior, labels, announcements, status text, and theme tokens with the UI contract in `apps/web/src/features/checkpoints/ui/`

## Final Phase: Polish and cross-cutting verification

- [ ] T041 [P] [REFACTOR] Remove duplicated mechanics while retaining named Dock/Weighing Area boundaries and verify no generic Checkpoint entity or endpoint was introduced in `apps/api/app/` and `apps/web/src/features/checkpoints/`
- [ ] T042 [P] [VERIFY] Run focused API suites, migration rollback/re-run, and the web feature suite from `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/quickstart.md`
- [ ] T043 [P] [VERIFY] Run `pnpm check` from the repository root
- [ ] T044 [P] [VERIFY] Run `pnpm typecheck` from the repository root
- [ ] T045 [P] [VERIFY] Run `pnpm test` from the repository root
- [ ] T046 [VERIFY] Run the configured authenticated checkpoints browser journey, or document its absence and retain API/router seams in `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/quickstart.md`
- [ ] T047 [VERIFY] Run `$speckit-analyze` and `$speckit-converge` against this feature directory and append any remaining work to this file before delivery

## Dependencies and execution order

- Phase 1 precedes Phase 2. T004–T009 establish the version, shared validation, policy, relation, and DTO foundations.
- T010–T015 and T016–T021 are independent named API slices after the foundation and may proceed in parallel; T022–T027 depend on their respective individual lifecycle seams.
- T028–T032 form the consultation shell and may proceed in parallel with both API slices once the named contracts are stable.
- T033–T040 depend on the consultation shell and the corresponding individual/grouped API contracts; Dock and Weighing Area UI adapters may proceed in parallel when they touch separate files.
- T041–T047 follow implementation and are the delivery gates.

## Parallel execution examples

- Foundation: T004, T006, and T008 can run in parallel; T005, T007, and T009 follow their tests.
- API: Dock work T010/T012/T014 and Weighing Area work T016/T018/T020 can run in parallel, followed by their GREEN tasks.
- Web: T028/T030/T032 and API test work can run in parallel; T033/T035/T037/T039 are independent RED seams when their touched test files are partitioned.
- Verification: T043, T044, and T045 can run in parallel after focused tests and implementation settle.

## Implementation strategy

Deliver the smallest useful increment as the consultation shell backed by active-user named list endpoints, then complete Dock and Weighing Area API administration in parallel. Add grouped lifecycle semantics before enabling selection toolbars. Finish with stale-state handling, partial-result feedback, responsive/accessibility hardening, and repository-wide verification. Each behavior follows RED → GREEN → REFACTOR, and no task introduces durable discharge usage persistence owned by GH-53.

## Completion criteria

- Total tasks: 47 (T001–T047).
- User Story 1 tasks: 34 (T010–T040, plus T041–T047 cross-cutting verification excluded from story count; direct story tasks are T010–T040 = 31).
- Parallel opportunities: 19 explicitly marked `[P]`, grouped by foundation, named API slices, web seams, and verification.
- Independent test criteria: authenticated observer consultation; administrator individual and grouped administration; API refusal for non-admins; validation, uniqueness, usage blocking, optimistic concurrency, partial outcomes, URL-backed filtering, accessibility, and responsive containment.
- Suggested MVP: T028–T032 plus active-user read policy/DTO work (T008–T009), delivering consultation before mutation controls.
- Format validation: every task starts with `- [ ]`, has a sequential `T###` ID, uses phase/story labels as required, and names an exact file or directory path.
