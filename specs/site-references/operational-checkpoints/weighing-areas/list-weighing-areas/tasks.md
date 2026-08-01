# Tasks: List Weighing Areas

**Input**: Design documents from `specs/site-references/operational-checkpoints/weighing-areas/list-weighing-areas/`

**Scope**: Extend the existing administrator `/checkpoints` map with collection-backed Weighing Area consultation. Keep `GET /api/v1/weighing-areas` as the sole complete read contract; do not add a page route, persistence migration, or mutation behavior.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the existing API and Checkpoint test seams for the feature without introducing new infrastructure.

- [X] T001 [P] Add representative available, archived, boundary-coordinate, mixed-case, and missing-actor Weighing Area fixtures in `apps/api/database/factories/weighing_area_factory.ts` and `apps/web/src/features/weighing-areas/__tests__/support/fixtures.ts`
- [X] T002 [P] Record the retained collection-only API and shared-route scope in `specs/site-references/operational-checkpoints/weighing-areas/list-weighing-areas/contracts/weighing-areas.openapi.yaml` and `specs/site-references/operational-checkpoints/weighing-areas/list-weighing-areas/contracts/checkpoint-ui-state.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared resource seams required before the user-story increments can be integrated.

- [X] T003 [P] Define the Weighing Area DTO and collection query types against the existing Tuyau `weighingAreas.index` contract in `apps/web/src/features/weighing-areas/types.ts` and `apps/web/src/features/weighing-areas/queries/weighing-area-queries.ts`
- [X] T004 [P] Extend the shared Checkpoint resource union and status/layer visibility types for default-visible Weighing Areas in `apps/web/src/features/checkpoints/types.ts`
- [X] T005 [P] Add the resource-owned DTO-to-Checkpoint adapter and read-only detail component seams in `apps/web/src/features/weighing-areas/weighing-area-checkpoint-adapter.ts` and `apps/web/src/features/weighing-areas/ui/weighing-area-details.tsx`

**Checkpoint**: Shared types and resource seams exist; user-story implementation can proceed after the protected collection contract is available.

---

## Phase 3: User Story 1 - Consult Weighing Areas by Status (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator can see every available and archived Weighing Area exactly once, in deterministic name order, while unauthorized users receive no collection data.

**Independent Test**: With available and archived records, call the complete collection as an organization administrator and operations administrator, verify status coverage, mixed-case ordering, identifying fields, and coordinates, then verify unauthenticated and non-administrator denial.

### Tests for User Story 1

> Write these tests first and confirm they fail before implementation.

- [X] T006 [P] [US1] Add integration coverage for unauthenticated, observer/operations-lead, organization-administrator, and operations-administrator access to `GET /api/v1/weighing-areas` in `apps/api/tests/integration/weighing_areas.spec.ts`
- [X] T007 [P] [US1] Add integration assertions for available and archived inclusion, empty success, complete detail fields, boundary coordinates, missing lifecycle actors, and deterministic `LOWER(name)`, `name`, `id` ordering in `apps/api/tests/integration/weighing_areas.spec.ts`
- [X] T008 [P] [US1] Add unit coverage for repository ordering and collection delegation in `apps/api/tests/unit/weighing_areas/weighing_area_use_cases.spec.ts`
- [X] T009 [P] [US1] Add integration coverage proving `GET /api/v1/weighing-areas/:id` is no longer a supported consultation contract in `apps/api/tests/integration/weighing_areas.spec.ts`

### Implementation for User Story 1

- [X] T010 [US1] Make the complete Weighing Area repository query deterministic with `LOWER(name) ASC`, `name ASC`, and `id ASC` while preserving all records in `apps/api/app/weighing_areas/shared/repositories/lucid_weighing_area_repository.ts`
- [X] T011 [US1] Remove the redundant show dependency, action, and import while retaining list authorization and serialization in `apps/api/app/controllers/weighing_areas_controller.ts`
- [X] T012 [US1] Remove the `/:id` show route from the Weighing Area route group in `apps/api/start/routes.ts`
- [X] T013 [US1] Delete the unused dedicated show use case in `apps/api/app/weighing_areas/show/get_weighing_area_use_case.ts` and regenerate the Adonis/Tuyau route registry under `apps/api/.adonisjs/client/registry/` and `apps/api/.adonisjs/server/routes.d.ts`
- [X] T014 [US1] Update the complete collection OpenAPI contract to document the retained endpoint, authorization responses, empty data response, and deterministic ordering in `specs/site-references/operational-checkpoints/weighing-areas/list-weighing-areas/contracts/weighing-areas.openapi.yaml`

**Checkpoint**: The API independently satisfies the collection, authorization, status, ordering, empty, and no-show-route requirements.

---

## Phase 4: User Story 2 - Inspect Weighing Area Details (Priority: P2)

**Goal**: An authorized administrator can select an available or archived Weighing Area on the shared map and inspect the exact name, current status, latitude, and longitude from the loaded collection.

**Independent Test**: Load the shared Checkpoint route with both resource kinds, select one available and one archived Weighing Area, and verify typed URL selection, marker/legend presentation, collection-backed details, boundary coordinates, and stale/status-excluded selection cleanup without a second request.

### Tests for User Story 2

> Write these tests first and confirm they fail before implementation.

- [X] T015 [P] [US2] Add Weighing Area query, DTO-adapter, and fixture coverage for available/archived records and exact coordinates in `apps/web/src/features/weighing-areas/__tests__/weighing-area-checkpoint-adapter.test.ts` and `apps/web/src/features/weighing-areas/__tests__/support/fixtures.ts`
- [X] T016 [P] [US2] Extend shared Checkpoint list and marker tests for combined Dock/Weighing Area markers, default layer visibility, distinct symbols, accessible name/status labels, and a two-kind legend in `apps/web/src/features/checkpoints/__tests__/list/list.test.tsx`, `apps/web/src/features/checkpoints/__tests__/map/checkpoint-marker.test.tsx`, and `apps/web/src/features/checkpoints/__tests__/map/markers.test.tsx`
- [X] T017 [P] [US2] Extend typed selection and detail tests for `checkpoint=weighing-area:<id>`, available and archived detail fields, exact collection-backed coordinates, and no extra detail request in `apps/web/src/features/checkpoints/__tests__/checkpoint-selection.test.ts`, `apps/web/src/features/checkpoints/__tests__/details/details.test.tsx`, and `apps/web/src/features/checkpoints/__tests__/support/test-helpers.ts`
- [X] T018 [P] [US2] Add web route/query MSW coverage for the complete Weighing Area collection and combined Dock/Weighing Area responses in `apps/web/src/features/weighing-areas/__tests__/support/handlers.ts` and `apps/web/src/features/checkpoints/__tests__/support/test-helpers.ts`

### Implementation for User Story 2

- [X] T019 [US2] Implement the typed TanStack Query for the complete Weighing Area collection using the generated Tuyau client in `apps/web/src/features/weighing-areas/queries/weighing-area-queries.ts`
- [X] T020 [US2] Implement the Weighing Area DTO-to-Checkpoint adapter and read-only details renderer with explicit Available/Archived status and latitude/longitude values in `apps/web/src/features/weighing-areas/weighing-area-checkpoint-adapter.ts`, `apps/web/src/features/weighing-areas/types.ts`, and `apps/web/src/features/weighing-areas/ui/weighing-area-details.tsx`
- [X] T021 [US2] Extend typed selection parsing, discriminated selected-resource resolution, and shared sheet rendering for Weighing Areas in `apps/web/src/features/checkpoints/checkpoint-selection.ts`, `apps/web/src/features/checkpoints/ui/checkpoint-sheet.tsx`, and `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`
- [X] T022 [US2] Combine Dock and Weighing Area presentation collections, preserve shared search/status URL semantics, and render both resource kinds by default in `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`, `apps/web/src/features/checkpoints/types.ts`, `apps/web/src/features/checkpoints/map/checkpoint-marker.tsx`, and `apps/web/src/features/checkpoints/ui/checkpoint-map-panel.tsx`

**Checkpoint**: Both resource kinds are consultable together; selecting a Weighing Area opens the exact current collection record and stale or status-excluded selections are cleared without substitution.

---

## Phase 5: User Story 3 - Recover from Empty and Error States (Priority: P3)

**Goal**: Administrators receive explicit Weighing Area-specific empty feedback and can retry a failed Weighing Area collection without losing usable Dock markers or map interactions.

**Independent Test**: Exercise no areas, no areas for the selected status, a collection failure, a successful retry, a status change between refreshes, and a basemap failure; verify each specified message, recovery path, no duplicate marker, and continued Dock/map usability.

### Tests for User Story 3

> Write these tests first and confirm they fail before implementation.

- [X] T023 [P] [US3] Extend feedback tests for collection-level empty, status-specific empty, source-specific failure, retry action, and preservation of Dock markers in `apps/web/src/features/checkpoints/__tests__/feedback/feedback.test.tsx`
- [X] T024 [P] [US3] Extend list/detail tests for refreshed status, no duplicate admission, stale-selection clearing, and status-excluded selection cleanup in `apps/web/src/features/checkpoints/__tests__/list/list.test.tsx`, `apps/web/src/features/checkpoints/__tests__/details/details.test.tsx`, and `apps/web/src/features/checkpoints/__tests__/support/test-helpers.ts`
- [X] T025 [P] [US3] Add MSW handlers and deterministic response sequences for empty, failure, retry-success, status-change, and basemap-degraded scenarios in `apps/web/src/features/checkpoints/__tests__/support/test-helpers.ts` and `apps/web/src/features/weighing-areas/__tests__/support/handlers.ts`

### Implementation for User Story 3

- [X] T026 [US3] Load Weighing Areas through an independent query state while retaining loaded Dock consultation during Weighing Area pending/error states in `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`
- [X] T027 [US3] Add Weighing Area-specific collection and selected-status empty feedback without masking an otherwise usable aggregate map in `apps/web/src/features/checkpoints/ui/checkpoint-map-panel.tsx` and `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`
- [X] T028 [US3] Add source-specific retry behavior that invalidates/refetches only the Weighing Area query and replaces stale error/empty feedback with current records in `apps/web/src/features/weighing-areas/queries/weighing-area-queries.ts` and `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`
- [X] T029 [US3] Resolve selections only from the current status-admitted collections, clear invalid selections without substitution, and preserve marker/detail usability when the basemap fails in `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`, `apps/web/src/features/checkpoints/checkpoint-selection.ts`, and `apps/web/src/features/checkpoints/map/checkpoint-map.tsx`

**Checkpoint**: Empty, authorization, stale-selection, collection-failure, retry, refresh, and degraded-basemap states are explicit, recoverable, and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete slice and leave the repository in a reviewable state.

- [X] T030 [P] Update affected Checkpoint navigation and authenticated-layout tests to confirm administrator visibility remains ergonomic while API authorization remains authoritative in `apps/web/src/components/layout/__tests__/authenticated-layout/checkpoints-navigation.test.tsx` and `apps/web/src/components/layout/app-sidebar.tsx`
- [X] T031 Run the feature quickstart's API and web suites and resolve formatting/type/test failures in `specs/site-references/operational-checkpoints/weighing-areas/list-weighing-areas/quickstart.md`, `apps/api/`, and `apps/web/`
- [X] T032 Run repository delivery gates `pnpm check`, `pnpm typecheck`, and `pnpm test`, then manually execute the affected desktop and narrow-mobile Checkpoints flow from `specs/site-references/operational-checkpoints/weighing-areas/list-weighing-areas/quickstart.md`

### Follow-up filter and menu behavior

- [X] T033 [P] Add unit and route-state coverage for `kinds=dock`, `kinds=weighing-area`, omitted/default kinds, invalid values, and kind/status composition in `apps/web/src/features/checkpoints/__tests__/checkpoint-search.test.ts` and `apps/web/src/routes/_authenticated/checkpoints.tsx`
- [X] T034 [P] Add UI coverage for persistent Dock/Weighing Area checkboxes, at-least-one-layer enforcement, open-menu checkbox interaction, Escape/outside close, and accessible trigger labels in `apps/web/src/features/checkpoints/__tests__/ui/checkpoint-map-controls.test.tsx`
- [X] T035 [US2] Implement URL-backed resource-kind visibility and presentation filtering across the shared Checkpoints map in `apps/web/src/features/checkpoints/types.ts`, `apps/web/src/features/checkpoints/checkpoint-search.ts`, `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`, and `apps/web/src/routes/_authenticated/checkpoints.tsx`
- [X] T036 [US3] Implement the multi-select filter menu and remove the duplicate trigger toggle while preserving status filtering, selection cleanup, and type-specific empty/error feedback in `apps/web/src/features/checkpoints/ui/checkpoint-map-controls.tsx` and `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`
- [X] T037 Update the feature contract and assumptions for URL-persisted resource-kind filtering in `specs/site-references/operational-checkpoints/weighing-areas/list-weighing-areas/spec.md` and `specs/site-references/operational-checkpoints/weighing-areas/list-weighing-areas/contracts/checkpoint-ui-state.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; fixture and contract preparation can run in parallel.
- **Foundational (Phase 2)**: Depends on Setup; shared web types and resource seams block story integration.
- **User Story 1 (Phase 3)**: Depends on Foundational; delivers the protected, ordered API collection and is the MVP.
- **User Story 2 (Phase 4)**: Depends on User Story 1's retained collection contract and generated Tuyau registry; it adds the shared Checkpoint consultation surface.
- **User Story 3 (Phase 5)**: Depends on User Story 2's combined query/presentation model; it adds source-specific exceptional-state behavior.
- **Polish (Phase 6)**: Depends on all delivered stories.

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 only; independently testable at the API boundary.
- **US2 (P2)**: Depends on US1 for `weighingAreas.index`, but remains independently testable through MSW and the shared Checkpoint route.
- **US3 (P3)**: Depends on US2's combined resource presentation; independently testable with deterministic MSW failure and refresh sequences.

### Parallel Opportunities

- T001–T002 can run in parallel.
- T003–T005 can run in parallel.
- T006–T009 can run in parallel before US1 implementation.
- T015–T018 can run in parallel before US2 implementation.
- T023–T025 can run in parallel before US3 implementation.
- Different files within each story's test and implementation groups can be assigned separately, but shared `checkpoints-page.tsx` changes should be sequenced to avoid conflicts.

## Parallel Example: User Story 2

```text
Task T015: Build Weighing Area adapter/query fixture tests
Task T016: Extend combined marker and legend tests
Task T017: Extend typed selection and detail tests
Task T018: Add MSW collection handlers
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational phases.
2. Implement and verify the protected, deterministically ordered complete collection.
3. Stop at the US1 checkpoint and validate both administrator roles, denial, empty data, archived inclusion, and the removed show route.

### Incremental Delivery

1. Add US2 to make available and archived Weighing Areas visible and detail-consultable in `/checkpoints`.
2. Add US3 for explicit empty, failure, retry, refresh, stale-selection, and degraded-basemap behavior.
3. Run the full delivery gates and affected browser flow.

### Notes

- Every task uses the required checklist format and includes an explicit repository file path.
- `[P]` marks work that can proceed in parallel without depending on incomplete work in the same files.
- Tests must be written and observed failing before the corresponding implementation tasks.
- No task introduces a Weighing Area detail endpoint, Checkpoint persistence entity, migration, or mutation control.
