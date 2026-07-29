---
description: "Actionable task list for the operational checkpoints workbench"
---

# Tasks: Administer Docks and Weighing Areas From the Web Workbench

**Input**: `spec.md`, `plan.md`, `contracts/api.md`, `contracts/ui.md`, `data-model.md`, and `quickstart.md`
**Prerequisites**: Approved spec and plan

## Phase 1: Setup

- [ ] T001 [P] [SETUP] [DOC] Confirm the active feature directory and existing Dock/Weighing Area vertical-slice seams in `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/` and `apps/api/app/{docks,weighing_areas}/`
- [ ] T002 [P] [SETUP] [GREEN] Install and register the owned MapCN component and `maplibre-gl` dependency in `apps/web/src/components/ui/map.tsx` and the repository-root `pnpm-lock.yaml`
- [ ] T003 [P] [SETUP] [DOC] Record the feature's API/UI contract vocabulary and blocker precedence in `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/contracts/`

## Phase 2: Foundational

- [ ] T004 [FOUNDATION] [RED] Add migration/schema/factory expectations for positive resource versions in `apps/api/tests/unit/docks/dock_concurrency.spec.ts` and `apps/api/tests/unit/weighing_areas/weighing_area_concurrency.spec.ts`
- [ ] T005 [FOUNDATION] [GREEN] Add the reversible version column migration, schema metadata, model fields, and factory defaults in `apps/api/database/migrations/*_add_operational_checkpoint_versions.ts`, `apps/api/database/schema.ts`, `apps/api/app/models/dock.ts`, `apps/api/app/models/weighing_area.ts`, `apps/api/database/factories/dock_factory.ts`, and `apps/api/database/factories/weighing_area_factory.ts`
- [ ] T006 [FOUNDATION] [P] [RED] Add shared validation/result tests for distinct versioned lifecycle items and blocker reason precedence in `apps/api/tests/unit/docks/dock_bulk_lifecycle.spec.ts` and `apps/api/tests/unit/weighing_areas/weighing_area_bulk_lifecycle.spec.ts`
- [ ] T007 [FOUNDATION] [GREEN] Implement only genuinely shared versioned lifecycle validation and result helpers in `apps/api/app/site_references/shared/`
- [ ] T008 [FOUNDATION] [P] [RED] Add protected consultation and mutation authorization tests for both named resources in `apps/api/tests/integration/docks.spec.ts` and `apps/api/tests/integration/weighing_areas.spec.ts`
- [ ] T009 [FOUNDATION] [GREEN] Expand Dock and Weighing Area policies, list/show DTO relations, and route/controller authorization in `apps/api/app/docks/`, `apps/api/app/weighing_areas/`, `apps/api/app/controllers/docks_controller.ts`, `apps/api/app/controllers/weighing_areas_controller.ts`, and `apps/api/start/routes.ts`

## Phase 3: User Story 1 - Administer Docks and Weighing Areas From the Web Workbench (Priority: P1)

**Goal**: Let active users consult both named reference types and let authorized administrators safely create, edit, archive, reactivate, and group lifecycle actions through `/checkpoints`.

**Independent test**: Run the focused API suites from `quickstart.md` and `pnpm --filter @portflow/web exec vitest run src/features/checkpoints/__tests__ --pool=threads --maxWorkers=1`; verify the authenticated `/checkpoints` journey and the acceptance scenarios.

### API resource validation, versioned mutation, and lifecycle

- [ ] T010 [P] [US1] [RED] Add Dock and Weighing Area create/update validation tests for required normalized names, GPS ranges, same-type case-insensitive conflicts, cross-type same-name success, archived edit refusal, and no-change failures in `apps/api/tests/unit/docks/dock_use_cases.spec.ts`, `apps/api/tests/unit/weighing_areas/weighing_area_use_cases.spec.ts`, `apps/api/tests/integration/docks.spec.ts`, and `apps/api/tests/integration/weighing_areas.spec.ts`
- [ ] T011 [P] [US1] [RED] Add individual archive/reactivate tests for actor/time/comment metadata, usage blocking, wrong lifecycle state, identity preservation, and stale `409` outcomes in `apps/api/tests/unit/docks/dock_concurrency.spec.ts` and `apps/api/tests/unit/weighing_areas/weighing_area_concurrency.spec.ts`
- [ ] T012 [US1] [GREEN] Extend named Dock and Weighing Area validators, commands, repositories, use cases, exceptions, and transformers for expected versions, positive version increments, conditional writes, GPS/name rules, and lifecycle metadata in `apps/api/app/docks/{create,update,archive,reactivate,shared}/` and `apps/api/app/weighing_areas/{create,update,archive,reactivate,shared}/`
- [ ] T013 [US1] [GREEN] Add actor relations and safe actor summaries to named resource models, repository preloads, and DTO transformers in `apps/api/app/models/dock.ts`, `apps/api/app/models/weighing_area.ts`, `apps/api/app/docks/`, and `apps/api/app/weighing_areas/`
- [ ] T014 [US1] [RED] Add grouped archive/reactivate tests covering malformed request rejection before writes, distinct ordered items, mixed eligible/blocked results, `NOT_FOUND`, `STALE_VERSION`, `IN_USE`, `ALREADY_ARCHIVED`, `ALREADY_AVAILABLE`, and one version increment per changed item in `apps/api/tests/unit/docks/dock_bulk_lifecycle.spec.ts` and `apps/api/tests/unit/weighing_areas/weighing_area_bulk_lifecycle.spec.ts`
- [ ] T015 [US1] [GREEN] Implement transactional grouped archive/reactivate commands with deterministic locking, blocker classification, partial success, request-order result arrays, usage-checker integration, and version-safe writes in `apps/api/app/docks/archive/`, `apps/api/app/docks/reactivate/`, `apps/api/app/weighing_areas/archive/`, and `apps/api/app/weighing_areas/reactivate/`
- [ ] T016 [US1] [RED] Add HTTP contract tests for named list/show access, versioned individual mutations, static grouped routes, typed stale/name-conflict errors, and DTO envelopes in `apps/api/tests/integration/docks.spec.ts` and `apps/api/tests/integration/weighing_areas.spec.ts`
- [ ] T017 [US1] [GREEN] Wire grouped controller actions, Vine request schemas, route ordering, authenticated actor/server-time capture, and named API response/error contracts in `apps/api/app/controllers/docks_controller.ts`, `apps/api/app/controllers/weighing_areas_controller.ts`, and `apps/api/start/routes.ts`
- [ ] T018 [US1] [REFACTOR] Align Dock and Weighing Area repositories/use cases with the planned deep boundaries and preserve `SiteReferenceUsageChecker` plus the temporary no-discharge binding in `apps/api/app/docks/`, `apps/api/app/weighing_areas/`, and `apps/api/app/site_references/`

### Web workbench consultation and administration

- [ ] T019 [P] [US1] [RED] Add router-level tests for `/checkpoints` URL-backed visible types, independent search/status/sort state, case-insensitive substring filtering, selection reset, and list-backed detail state in `apps/web/src/features/checkpoints/__tests__/route-state.test.ts`
- [ ] T020 [P] [US1] [RED] Add router-level tests for observer/admin affordances, form validation, mutation payload versions, stale reload behavior, grouped mixed outcomes, affected-query invalidation, and recoverable network errors in `apps/web/src/features/checkpoints/__tests__/mutations.test.ts` and `apps/web/src/features/checkpoints/__tests__/permissions.test.ts`
- [ ] T021 [P] [US1] [RED] Add accessibility/responsive feature tests for labelled filters, synchronized text list, keyboard selection/dialog behavior, status text, and no page-level horizontal overflow in `apps/web/src/features/checkpoints/__tests__/accessibility.test.tsx`
- [ ] T022 [US1] [GREEN] Link the Checkpoints sidebar item and create the authenticated route shell with SSR-safe URL state and query composition in `apps/web/src/components/layout/app-sidebar.tsx` and `apps/web/src/routes/_authenticated/checkpoints.tsx`
- [ ] T023 [US1] [GREEN] Implement distinct named Dock/Weighing Area query adapters, URL schemas, filtering/sorting, typed mutation payloads, cache invalidation, stale reload handling, and grouped outcome mapping in `apps/web/src/features/checkpoints/types.ts`, `apps/web/src/features/checkpoints/queries/`, `apps/web/src/features/checkpoints/mutations/`, and `apps/web/src/features/checkpoints/helpers/`
- [ ] T024 [US1] [GREEN] Implement the shared resource-aware create/view/edit sheet, GPS/name validation, permission-derived controls, individual lifecycle confirmations, and recoverable pending/error states in `apps/web/src/features/checkpoints/ui/`
- [ ] T025 [US1] [GREEN] Implement selection-scoped grouped lifecycle toolbar, confirmation flow, request-order partial-result feedback, blocked-row retention, and stale explicit reload action in `apps/web/src/features/checkpoints/ui/` and `apps/web/src/features/checkpoints/mutations/`
- [ ] T026 [US1] [GREEN] Implement the MapCN MapLibre canvas with distinct Dock/Weighing Area icons, visible legend/labels, CARTO attribution, theme-aware styles, client-only mounting, map failure fallback, and synchronized accessible list in `apps/web/src/components/ui/map.tsx` and `apps/web/src/features/checkpoints/ui/`
- [ ] T027 [US1] [REFACTOR] Verify the workbench uses Channel Marker tokens, shadcn/Lucide primitives, stable focus/dialog behavior, narrow-to-desktop containment, and named resource boundaries without a generic Checkpoint client in `apps/web/src/features/checkpoints/` and `apps/web/src/routes/_authenticated/checkpoints.tsx`

## Final Phase: Polish and Cross-Cutting Verification

- [ ] T028 [P] [US1] [DOC] Update the feature quickstart with the actual focused commands, migration rollback evidence, browser/map caveats, and deferred GH-53 usage-binding constraint in `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/quickstart.md`
- [ ] T029 [VERIFY] [GREEN] Run the focused API unit/integration and web feature suites listed in `quickstart.md`, including migration validation against the configured disposable database
- [ ] T030 [VERIFY] [GREEN] Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the repository root and resolve only feature-scoped failures in the affected paths
- [ ] T031 [VERIFY] [GREEN] If an authenticated Playwright checkpoints journey is configured, run it at 375, 768, 1024, and 1440 px, including MapCN attribution, marker distinction, WebGL/tile fallback, keyboard access, and no horizontal overflow; otherwise record that the checkpoints-specific journey is absent and use the API integration and router-level web feature suites as the automated acceptance seams
- [ ] T032 [VERIFY] [DOC] Run `$speckit-analyze` and `$speckit-converge` for the active feature directory and record any resulting follow-up tasks before delivery

## Dependencies and execution order

- Phase 1 precedes Phase 2; T005 and T007 establish persistence/validation foundations before versioned mutation work.
- T008–T009 establish the API consultation/authorization baseline before API and web acceptance work.
- Within US1, tests T010–T011 precede T012–T013; grouped RED tests T014 precede T015; HTTP RED tests T016 precede T017.
- Web RED tasks T019–T021 may run in parallel with API tasks T010–T016 because they touch separate test seams; web implementation T022–T026 depends on the named API contracts and route types.
- T027 follows the web implementation; T028–T032 are final verification and documentation tasks.

## Parallel execution examples

- **API foundation**: T004, T006, and T008 can run in parallel after setup; T005 and T007 then implement their respective red seams.
- **Named resource API**: T010 and T011 can run in parallel across Dock and Weighing Area tests; T014 can proceed in parallel once shared request vocabulary is agreed.
- **Web test preparation**: T019, T020, and T021 can run in parallel with API test work.
- **Web implementation**: T023 query/mutation adapters and T026 map primitives can proceed in parallel after T022; T024 and T025 can proceed in parallel once the adapters exist.

## Implementation strategy

Deliver the MVP as the authenticated consultation workbench plus safe individual administration (T010–T013, T019, T022–T024). Add grouped lifecycle partial success (T014–T018 and T020, T025), then complete MapCN/accessibility polish and full verification. Every business behavior follows RED → GREEN → REFACTOR, with the API remaining authoritative for authorization and state.
