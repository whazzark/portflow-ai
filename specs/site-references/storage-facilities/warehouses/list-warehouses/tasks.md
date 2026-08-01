# Tasks: List Warehouses

**Input**: Design documents from `specs/site-references/storage-facilities/warehouses/list-warehouses/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/warehouses.openapi.yaml`, `quickstart.md`

**Tests**: API and web tests are required by the project constitution and implementation plan. Follow RED → GREEN → REFACTOR.

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] Add warehouse feature path aliases and route typing integration in generated API/client route configuration
- [X] T002 [P] Add warehouse API and web test fixtures and MSW handler scaffolding in `apps/api/tests/fixtures/warehouses.ts`, `apps/web/src/features/warehouses/__tests__/support/fixtures.ts`, and `apps/web/src/test/msw/handlers.ts`
- [X] T003 Add the authenticated `/warehouses` route shell and sidebar navigation entry in `apps/web/src/routes/_authenticated/warehouses.tsx` and `apps/web/src/components/layout/app-sidebar.tsx`

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T004 [P] Create the `warehouses` and `warehouse_footprint_points` migrations with lifecycle, ordered-point, coordinate-range, uniqueness, and foreign-key constraints in `apps/api/database/migrations/`
- [X] T005 [P] Create Lucid `Warehouse` and `WarehouseFootprintPoint` models with the ordered footprint relationship in `apps/api/app/models/warehouse.ts` and `apps/api/app/models/warehouse_footprint_point.ts`
- [X] T006 [P] Define the warehouse repository contract and Lucid implementation for one site-scoped collection with ordered footprint points in `apps/api/app/warehouses/shared/repositories/warehouse_repository.ts` and `apps/api/app/warehouses/shared/repositories/lucid_warehouse_repository.ts`
- [X] T007 [P] Add warehouse factory data with available, archived, and irregular footprint variants in `apps/api/database/factories/warehouse_factory.ts`
- [X] T008 Implement active-user warehouse authorization policy and repository binding in `apps/api/app/warehouses/shared/warehouse_policy.ts` and `apps/api/providers/repositories_provider.ts`
- [X] T009 Add the warehouse DTO types, query adapter, URL search schema, and shared lifecycle/search presentation helpers in `apps/web/src/features/warehouses/types.ts`, `apps/web/src/features/warehouses/queries/warehouse-queries.ts`, `apps/web/src/routes/_authenticated/warehouses.tsx`, and `apps/web/src/features/warehouses/warehouse-search.ts`

## Phase 3: User Story 1 - Browse Available Warehouses (Priority: P1) 🎯 MVP

**Goal**: Active users can open the warehouse map, see available warehouses by default, search by name, use lifecycle filters, and understand counts and empty states.

**Independent Test**: With available and archived warehouses present, open Warehouses and verify the Available view, map polygons, counts, name search, URL-persisted filters, and available empty state.

### Tests for User Story 1

- [X] T010 [P] [US1] Add API unit tests for active-user authorization and collection policy in `apps/api/tests/unit/warehouses/consultation/list.spec.ts`
- [X] T011 [P] [US1] Add API integration tests for `GET /api/v1/warehouses`, response shape, ordered footprints, and unauthorized users in `apps/api/tests/integration/warehouses/consultation/list.spec.ts`
- [X] T012 [P] [US1] Add web tests for warehouse name normalization, lifecycle filtering, and search-match presentation in `apps/web/src/features/warehouses/__tests__/warehouse-search.test.ts`

### Implementation for User Story 1

- [X] T013 [P] [US1] Implement the list use case and DTO transformer for site-scoped warehouse collection data in `apps/api/app/warehouses/list/list_warehouses_use_case.ts` and `apps/api/app/warehouses/shared/warehouse_transformer.ts`
- [X] T014 [US1] Expose the protected `GET /api/v1/warehouses` endpoint and register it with the typed route contract in `apps/api/app/controllers/warehouses_controller.ts` and `apps/api/start/routes.ts`
- [X] T015 [US1] Implement client-side warehouse lifecycle filtering, name matching, count derivation, and stale-selection cleanup in `apps/web/src/features/warehouses/warehouse-search.ts` and `apps/web/src/features/warehouses/ui/warehouses-page.tsx`
- [X] T016 [US1] Implement MapLibre warehouse polygon rendering, viewport fitting, polygon selection, and selected-polygon emphasis in `apps/web/src/features/warehouses/map/warehouse-map.tsx`, `apps/web/src/features/warehouses/map/warehouse-polygon.tsx`, and `apps/web/src/features/warehouses/geometry/footprint-frame.ts`
- [X] T017 [US1] Implement warehouse map controls with name search, `All/Available/Archived` status filters, clear-search feedback, and URL synchronization in `apps/web/src/features/warehouses/ui/warehouse-map-controls.tsx` and `apps/web/src/routes/_authenticated/warehouses.tsx`
- [X] T018 [US1] Implement available and archived count badges plus lifecycle-specific empty-state messaging in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`

## Phase 4: User Story 2 - Inspect a Warehouse Footprint (Priority: P1)

**Goal**: Selecting a visible warehouse shows its identity, lifecycle, and complete GPS polygon in a coherent read-only detail view.

**Independent Test**: Select an irregular warehouse footprint and verify every boundary point is represented, the map fits the complete polygon, and the detail sheet corresponds to the selected warehouse only.

### Tests for User Story 2

- [X] T019 [P] [US2] Add unit tests for GeoJSON conversion and complete polygon bounds in `apps/web/src/features/warehouses/__tests__/footprint-frame.test.ts`
- [X] T020 [P] [US2] Add web tests for searchable/filterable controls and selected detail identity in `apps/web/src/features/warehouses/__tests__/consultation.test.tsx`

### Implementation for User Story 2

- [X] T021 [US2] Implement the read-only warehouse detail sheet with name, lifecycle status, and complete footprint metadata in `apps/web/src/features/warehouses/ui/warehouse-details.tsx`
- [X] T022 [US2] Implement URL-backed warehouse selection and map fitting to all selected polygon coordinates in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`, `apps/web/src/features/warehouses/map/warehouse-map.tsx`, and `apps/web/src/routes/_authenticated/warehouses.tsx`
- [X] T023 [US2] Add keyboard-accessible warehouse controls and selected-state styling in `apps/web/src/features/warehouses/map/warehouse-map.tsx` and `apps/web/src/features/warehouses/map/warehouse-polygon.tsx`

## Phase 5: User Story 3 - Browse Archived Warehouses (Priority: P2)

**Goal**: Active users can switch to archived warehouses, distinguish them visually, inspect their footprints, and see read-only historical information.

**Independent Test**: Switch to Archived, verify only archived polygons and the archived count are shown, inspect one footprint, and confirm no mutation action is present.

### Tests for User Story 3

- [X] T024 [P] [US3] Add web coverage for archived read-only detail treatment and complete archived footprint rendering in `apps/web/src/features/warehouses/__tests__/consultation.test.tsx`
- [ ] T025 [P] [US3] Add map presentation tests for available solid styling, archived muted/dashed styling, and selected styling in `apps/web/src/features/warehouses/__tests__/map/warehouse-polygon.test.tsx`

### Implementation for User Story 3

- [X] T026 [US3] Implement available/archived polygon style variants and the accessible lifecycle legend in `apps/web/src/features/warehouses/map/warehouse-polygon.tsx` and `apps/web/src/features/warehouses/map/warehouse-legend.tsx`
- [X] T027 [US3] Implement archived status labels and explicit read-only messaging in `apps/web/src/features/warehouses/ui/warehouse-details.tsx`
- [X] T028 [US3] Ensure status changes and refreshed lifecycle values update filtered polygons, counts, legend state, and selection validity in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`

## Phase 6: User Story 4 - Recover from Consultation Failure (Priority: P3)

**Goal**: Loading failures are distinct from empty states and recover through retry without requiring a new sign-in.

**Independent Test**: Fail `GET /api/v1/warehouses`, verify the error and retry action, restore the endpoint, retry, and verify the latest collection replaces the failure state.

### Tests for User Story 4

- [X] T029 [P] [US4] Add API failure-path tests for repository/use-case error propagation in `apps/api/tests/unit/warehouses/consultation/list.spec.ts`
- [X] T030 [P] [US4] Add web tests for loading failure, retry affordance, tooltip, and legend semantics in `apps/web/src/features/warehouses/__tests__/feedback.test.tsx`

### Implementation for User Story 4

- [X] T031 [US4] Implement warehouse pending, error, and retry feedback components in `apps/web/src/features/warehouses/ui/warehouses-pending.tsx` and `apps/web/src/features/warehouses/ui/warehouses-error.tsx`
- [X] T032 [US4] Wire TanStack Query retry/refetch behavior so successful retries replace the collection snapshot and revalidate filters, counts, polygons, and selection in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T033 [P] Add focused MSW handlers and fixtures for mixed lifecycle, empty, search mismatch, refresh, and failure sequences in `apps/web/src/features/warehouses/__tests__/support/handlers.ts`
- [X] T034 [P] Add keyboard, screen-reader, and non-color lifecycle distinction coverage in `apps/web/src/features/warehouses/__tests__/feedback.test.tsx` and `apps/web/src/features/warehouses/__tests__/consultation.test.tsx`
- [X] T035 Run the feature quickstart and affected API/web checks documented in `specs/site-references/storage-facilities/warehouses/list-warehouses/quickstart.md`
- [X] T036 Run `pnpm check`, `pnpm typecheck`, and `pnpm test`, then resolve any feature regressions before review

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) precedes Foundational (Phase 2).
- Foundational (Phase 2) blocks all user stories.
- US1 is the MVP and provides the collection, map, filters, and search foundation.
- US2 depends on the US1 map and collection presentation.
- US3 depends on the US1 map and US2 selection/detail behavior.
- US4 depends on the route/query shell from US1 but can be tested independently once the endpoint exists.
- Polish follows the desired user stories.

### Parallel Opportunities

- T004–T007 can run in parallel after setup.
- T010–T012 can be written in parallel before US1 implementation.
- T019–T020 and T024–T025 can be written in parallel with their respective story implementation prerequisites.
- T029–T030 can be written in parallel.

## Implementation Strategy

1. Complete setup and foundational persistence/authorization/contract work.
2. Deliver US1 as the MVP: collection endpoint, map polygons, search, lifecycle filters, counts, and available empty state.
3. Add US2 selection, tooltip/detail sheet, and complete polygon framing.
4. Add US3 archived styling and legend.
5. Add US4 retry behavior, then run the full quickstart and repository checks.

## Cross-page consultation refactor

- [X] T037 Extract shared resource-map controls, status/search presentation helpers, map workspace feedback, pending/error states, and detail primitives under `apps/web/src/components/resource-map/`.
- [X] T038 Align Checkpoints and Warehouses on the Available default, count-bearing status menu, context-preserving search feedback, map overlays, and selected-resource framing while preserving domain-specific filters and geometries.
- [X] T039 Add keyboard-focusable Warehouse geometry targets with shared tooltip and activation semantics.
- [X] T040 Re-run the complete web feature suite and typecheck after the shared extraction.
