# Tasks: List Warehouse Doors

**Input**: Design documents from `specs/site-references/storage-facilities/warehouse-doors/list-warehouse-doors/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/warehouse-doors.openapi.yaml`, `contracts/warehouse-door-ui-state.md`, `quickstart.md`

**Tests**: API and web tests are required by the Portflow constitution and implementation plan.
Within each story, write the observable tests first, confirm RED, implement the minimum behavior,
confirm GREEN, and refactor without weakening coverage.

**Organization**: Tasks are grouped by user story so each increment remains independently testable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the warehouse-door feature namespace without changing product behavior.

- [X] T001 Add the `#warehouse_doors/*` API import alias for the new vertical slice in `apps/api/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Prepare shared test data and high-seam harnesses used by every story before behavior is implemented.

**⚠️ CRITICAL**: Complete this phase before starting any user story.

- [X] T002 [P] Create reusable warehouse-door API fixture constants for valid contained coordinates and lifecycle states in `apps/api/tests/fixtures/warehouse_doors.ts`
- [X] T003 [P] Extend warehouse DTO fixtures plus success, empty, error, and response-sequence MSW handlers with embedded door variants in `apps/web/src/features/warehouses/__tests__/support/fixtures.ts` and `apps/web/src/features/warehouses/__tests__/support/handlers.ts`
- [X] T004 [P] Create the real-router warehouse-door consultation harness and MapLibre-only mock seam in `apps/web/src/features/warehouse-doors/__tests__/support/test-helpers.tsx` and `apps/web/src/features/warehouse-doors/__tests__/support/mock-warehouse-map.tsx`

**Checkpoint**: Shared fixtures and test seams are ready; story tests can now drive implementation.

---

## Phase 3: User Story 1 - Browse a Warehouse's Doors (Priority: P1) 🎯 MVP

**Goal**: Every active user can select a warehouse, consult only its embedded doors through
Available and Archived views, see accurate counts and the contextual default, while the API
also exposes a selector-safe available-only door collection for future discharges.

**Independent Test**: Sign in as each active role, load warehouses containing mixed-lifecycle doors,
verify embedded containment and lifecycle browsing, and prove the available-only contract excludes
archived doors and every door whose containing warehouse is archived.

### Tests for User Story 1

> Write these tasks first and confirm they fail for the expected missing behavior.

- [X] T005 [P] [US1] Add failing repository-backed tests for immutable containment, coordinate/name constraints, cross-lifecycle warehouse-scoped uniqueness, deterministic available ordering, all-active-role policy behavior, and filtering on both door and warehouse availability in `apps/api/tests/unit/warehouse_doors/consultation/available.spec.ts`
- [X] T006 [P] [US1] Extend failing warehouse HTTP tests for nested door fields/order/mixed/empty collections and add failing available-only HTTP tests for exact DTO fields, selector safety, every active role, and unauthenticated/non-active denial in `apps/api/tests/integration/warehouses/consultation/list.spec.ts` and `apps/api/tests/integration/warehouse_doors/consultation/available.spec.ts`
- [X] T007 [P] [US1] Add failing real-router tests for selected-warehouse embedded-door scoping, Available/Archived counts, contextual lifecycle defaults, URL restoration, warehouse switching without another request, and the accessible door list in `apps/web/src/features/warehouse-doors/__tests__/consultation.test.tsx`

### Implementation for User Story 1

- [X] T008 [US1] Create the `warehouse_doors` migration with UUID identity, restricted warehouse foreign key, trimmed/non-empty and case-insensitive scoped-name constraints, coordinate checks, lifecycle status, timestamps, and indexes in `apps/api/database/migrations/1784900000000_create_warehouse_doors_table.ts`
- [X] T009 [US1] Implement the Lucid `WarehouseDoor` model, UUID assignment, lifecycle typing, and permanent `Warehouse`/door relations in `apps/api/app/models/warehouse_door.ts` and `apps/api/app/models/warehouse.ts`
- [X] T010 [US1] Add factory and idempotent post-warehouse seed data covering available, archived, empty-parent, same-name-different-parent, selector-safe, and co-located valid footprint cases in `apps/api/database/factories/warehouse_door_factory.ts` and `apps/api/database/seeders/07_warehouse_door_seeder.ts`
- [X] T011 [US1] Implement the abstract/Lucid warehouse-door repository and available use case with child-and-parent status filtering and deterministic ordering in `apps/api/app/warehouse_doors/shared/repositories/warehouse_door_repository.ts`, `apps/api/app/warehouse_doors/shared/repositories/lucid_warehouse_door_repository.ts`, and `apps/api/app/warehouse_doors/available/list_available_warehouse_doors_use_case.ts`
- [X] T012 [US1] Implement active-user available authorization, the six-field selector transformer, and the thin available controller action in `apps/api/app/warehouse_doors/shared/warehouse_door_policy.ts`, `apps/api/app/warehouse_doors/shared/warehouse_door_transformer.ts`, and `apps/api/app/controllers/warehouse_doors_controller.ts`
- [X] T013 [US1] Preload ordered doors with every warehouse and extend the warehouse transformer with five-field nested door projections in `apps/api/app/warehouses/shared/repositories/lucid_warehouse_repository.ts` and `apps/api/app/warehouses/shared/warehouse_transformer.ts`
- [X] T014 [US1] Bind the door repository, expose authenticated `GET /api/v1/warehouse-doors/available` before parameterized routes, and run migration/API generators to refresh `apps/api/providers/repositories_provider.ts`, `apps/api/start/routes.ts`, `apps/api/database/schema.ts`, and `apps/api/.adonisjs/`
- [X] T015 [US1] Derive warehouse-door types from the expanded warehouse DTO and add pure embedded-door lifecycle projection, contextual-default, count, and validity adapters in `apps/web/src/features/warehouse-doors/types.ts` and `apps/web/src/features/warehouse-doors/warehouse-door-presentation.ts`
- [X] T016 [P] [US1] Extend validated `/warehouses` search state with optional `doorStatus` and `doorId`, including warehouse-switch reset and back/forward restoration rules, in `apps/web/src/routes/_authenticated/warehouses.tsx`
- [X] T017 [P] [US1] Add opt-in overlay suppression to the shared sheet and implement the non-modal responsive warehouse-door lifecycle/count/list panel in `apps/web/src/components/ui/sheet.tsx` and `apps/web/src/features/warehouse-doors/ui/warehouse-doors-panel.tsx`
- [X] T018 [US1] Compose the selected warehouse's embedded doors into the lifecycle panel without introducing a door query or consuming the available-only endpoint in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`
- [X] T019 [US1] Run the US1 API and real-router tests and refactor the nested consultation and selector-safe flows to GREEN in `apps/api/tests/unit/warehouse_doors/consultation/available.spec.ts`, `apps/api/tests/integration/warehouses/consultation/list.spec.ts`, `apps/api/tests/integration/warehouse_doors/consultation/available.spec.ts`, and `apps/web/src/features/warehouse-doors/__tests__/consultation.test.tsx`

**Checkpoint**: User Story 1 is a viable read-only MVP: active users browse correctly scoped door
lifecycle collections from one warehouse snapshot, and future discharge selectors have an
independently verifiable available-only contract.

---

## Phase 4: User Story 2 - Locate and Select a Warehouse Door (Priority: P1)

**Goal**: Users can locate every admitted door on its warehouse footprint, identify it through
pointer or keyboard interaction, and synchronize its selection between the list and map.

**Independent Test**: Select a warehouse with mixed and co-located doors, activate each marker and
list entry by pointer and keyboard, and verify the exact list entry and map marker are emphasized
while the selected footprint remains framed.

### Tests for User Story 2

> Write these tasks first and confirm they fail for the expected missing behavior.

- [X] T020 [P] [US2] Add failing pure and component tests for overview suppression, selected-warehouse and lifecycle overlay scoping, compact markers without persistent labels, selection-only emphasis, deterministic near-coordinate offsets, accessible marker names/tooltips, lifecycle structure, and legend semantics in `apps/web/src/features/warehouse-doors/__tests__/marker-offset.test.ts` and `apps/web/src/features/warehouse-doors/__tests__/markers.test.tsx`
- [X] T021 [P] [US2] Add failing real-router tests for pointer/keyboard selection, list-marker synchronization, URL restoration, invalid selection cleanup, and map interaction while the panel is open in `apps/web/src/features/warehouse-doors/__tests__/consultation.test.tsx`

### Implementation for User Story 2

- [X] T022 [P] [US2] Extract the deterministic checkpoint collision algorithm into a generic resource-marker helper and preserve checkpoint behavior in `apps/web/src/components/resource-map/resource-marker-offset.ts`, `apps/web/src/features/checkpoints/map/checkpoint-marker-offset.ts`, and `apps/web/src/features/checkpoints/map/checkpoint-marker.tsx`
- [X] T023 [P] [US2] Remove the unnecessary door-detail view and keep the lifecycle list visible while exposing the selected list entry state in `apps/web/src/features/warehouse-doors/ui/warehouse-doors-panel.tsx`
- [X] T024 [US2] Implement compact available/archived door marker buttons without persistent labels, focus/hover tooltips, collision offsets, selection-only emphasis, quiet non-selected styling, and the non-color lifecycle legend in `apps/web/src/features/warehouse-doors/map/warehouse-door-marker.tsx` and `apps/web/src/features/warehouse-doors/map/warehouse-door-legend.tsx`
- [X] T025 [US2] Extend map composition to suppress every door marker and door legend in the warehouse overview, then overlay only the selected warehouse's admitted embedded doors while retaining complete footprint framing and degraded-basemap behavior in `apps/web/src/features/warehouses/map/warehouse-map.tsx`
- [X] T026 [US2] Integrate list-to-marker highlighting, marker/list selection, `doorId` URL updates, lifecycle-filter invalidation, and warehouse-switch overlay replacement without opening a door detail view in `apps/web/src/features/warehouse-doors/ui/warehouse-doors-panel.tsx` and `apps/web/src/features/warehouses/ui/warehouses-page.tsx`
- [X] T027 [US2] Run the US2 marker, selection, route, and checkpoint-regression tests and refactor the spatial consultation flow to GREEN in `apps/web/src/features/warehouse-doors/__tests__/marker-offset.test.ts`, `apps/web/src/features/warehouse-doors/__tests__/markers.test.tsx`, `apps/web/src/features/warehouse-doors/__tests__/consultation.test.tsx`, and `apps/web/src/features/checkpoints/`

**Checkpoint**: User Story 2 independently proves exact spatial identity, accessible activation, and
selection synchronization without breaking the containing warehouse or checkpoint marker behavior.

---

## Phase 5: User Story 3 - Understand Empty and Failure States (Priority: P2)

**Goal**: Users can distinguish warehouse-snapshot pending/error states, lifecycle-specific door
emptiness, and basemap failure, retry the authoritative snapshot, and receive refreshed embedded
doors without a partial-source ambiguity.

**Independent Test**: Exercise a successful empty lifecycle, a pending and failed warehouse snapshot
followed by a successful retry, a refreshed stale selection, and a basemap failure; verify each has
distinct feedback and no failure is represented as an empty door collection.

### Tests for User Story 3

> Write these tasks first and confirm they fail for the expected missing behavior.

- [X] T028 [P] [US3] Add failing API tests for nested warehouse/door failure propagation, available-only failure propagation, and authoritative state on new requests in `apps/api/tests/integration/warehouses/consultation/list.spec.ts`, `apps/api/tests/unit/warehouse_doors/consultation/available.spec.ts`, and `apps/api/tests/integration/warehouse_doors/consultation/available.spec.ts`
- [X] T029 [P] [US3] Add failing real-router/MSW tests for warehouse-snapshot pending-versus-empty feedback, lifecycle-specific emptiness, shared failure/retry, refreshed values, stale selection, and basemap failure in `apps/web/src/features/warehouse-doors/__tests__/feedback.test.tsx` and `apps/web/src/features/warehouses/__tests__/support/handlers.ts`

### Implementation for User Story 3

- [X] T030 [US3] Implement lifecycle-specific successful empty messages without introducing an independent door loading state in `apps/web/src/features/warehouse-doors/ui/warehouse-doors-panel.tsx`
- [X] T031 [US3] Reuse the existing warehouse pending/error/retry boundary for the expanded snapshot and ensure failed snapshots never render partial doors as empty in `apps/web/src/routes/_authenticated/warehouses.tsx` and `apps/web/src/features/warehouses/ui/warehouses-page.tsx`
- [X] T032 [US3] Reconcile refreshed embedded door name/location/status by stable identity and clear only wrong-warehouse or lifecycle-excluded selections after successful snapshot resolution in `apps/web/src/features/warehouse-doors/warehouse-door-presentation.ts` and `apps/web/src/features/warehouses/ui/warehouses-page.tsx`
- [X] T033 [US3] Run the US3 API and real-router feedback tests and refactor loading, empty, failure, retry, refresh, and map-degradation behavior to GREEN in `apps/api/tests/integration/warehouses/consultation/list.spec.ts`, `apps/api/tests/unit/warehouse_doors/consultation/available.spec.ts`, `apps/api/tests/integration/warehouse_doors/consultation/available.spec.ts`, and `apps/web/src/features/warehouse-doors/__tests__/feedback.test.tsx`

**Checkpoint**: All three user stories are independently observable and the complete consultation
slice satisfies success, empty, failure, authorization, spatial, lifecycle, selector-safety, and
refresh behavior.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Protect existing behavior, complete delivery verification, and prepare the plan output for review.

- [X] T034 Add cross-cutting regression assertions for every active role, absence of mutation/standalone-door controls, no web consumption of the available-only endpoint, existing warehouse behavior, and unchanged checkpoint collision behavior in `apps/api/tests/integration/warehouses/consultation/list.spec.ts`, `apps/api/tests/integration/warehouse_doors/consultation/available.spec.ts`, `apps/web/src/features/warehouse-doors/__tests__/consultation.test.tsx`, and `apps/web/src/features/warehouses/__tests__/consultation.test.tsx`
- [X] T035 Run and resolve all focused API/web scenarios documented in `specs/site-references/storage-facilities/warehouse-doors/list-warehouse-doors/quickstart.md`
- [X] T036 Run `pnpm check`, `pnpm typecheck`, and `pnpm test`, then resolve every feature regression across the implementation paths listed in `specs/site-references/storage-facilities/warehouse-doors/list-warehouse-doors/plan.md`
- [ ] T037 Complete the desktop and narrow-mobile affected browser journeys, including one-snapshot loading, the door-free warehouse overview, progressive selected-warehouse overlay, compact marker density, selection emphasis, non-modal map interaction, overlapping doors, URL restoration, failures, and degraded basemap behavior, from `specs/site-references/storage-facilities/warehouse-doors/list-warehouse-doors/quickstart.md`
- [ ] T038 Obtain a fresh read-only Codex review of the final diff and resolve or explicitly justify every confirmed finding against `specs/site-references/storage-facilities/warehouse-doors/list-warehouse-doors/spec.md` and `specs/site-references/storage-facilities/warehouse-doors/list-warehouse-doors/plan.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; starts immediately.
- **Foundational (Phase 2)**: Depends on T001 and blocks every story test.
- **User Story 1 (Phase 3)**: Depends on Foundation and provides persistence, the nested warehouse
  snapshot, available-only contract, and lifecycle panel used by later stories.
- **User Story 2 (Phase 4)**: Depends on US1 and adds spatial markers and exact details.
- **User Story 3 (Phase 5)**: Depends on US1's embedded projection/panel, but may proceed in parallel
  with US2 except for final Warehouses page integration.
- **Polish (Phase 6)**: Depends on all selected stories.

### User Story Dependency Graph

```text
Setup → Foundation → US1 (Browse + available contract)
                         ├──→ US2 (Locate and Inspect) ──┐
                         └──→ US3 (Empty and Failure) ───├
                                                              └──→ Polish
```

### Within Each User Story

- Write the story's tests and confirm the expected RED state before implementation.
- For US1, migration/model precede repository and preloads; repository/use case precede controller
  and route; generated contracts precede typed web consumption.
- For US2, pure collision/detail work may proceed separately before map and page integration.
- For US3, API failure tests and web feedback tests may proceed separately before retry integration.
- Complete and validate the story checkpoint before relying on it from another phase.

### Parallel Opportunities

- T002, T003, and T004 can run in parallel after T001.
- T005, T006, and T007 can be written in parallel before US1 implementation.
- T016 and T017 can run in parallel after T015 establishes the door types and presentation contract.
- T020 and T021 can be written in parallel; after RED, T022 and T023 can run in parallel.
- T028 and T029 can be written in parallel after US1.
- After US1 is GREEN, US2 and US3 can proceed in parallel in separate paths except for their final
  `warehouses-page.tsx` integrations, which must be serialized.

## Parallel Example: User Story 1

```text
Task T005: Available repository/policy tests under apps/api/tests/unit/warehouse_doors/
Task T006: Nested warehouse and available HTTP tests under apps/api/tests/integration/
Task T007: Real-router lifecycle tests under apps/web/src/features/warehouse-doors/
```

## Parallel Example: User Story 2

```text
Task T020: Marker and collision tests under apps/web/src/features/warehouse-doors/__tests__/
Task T021: Exact list-marker selection and URL-state tests in apps/web/src/features/warehouse-doors/__tests__/

After RED:
Task T022: Shared marker-offset extraction under apps/web/src/components/resource-map/
Task T023: Selected list-entry state under apps/web/src/features/warehouse-doors/ui/
```

## Parallel Example: User Story 3

```text
Task T028: API snapshot/available failure tests under apps/api/tests/
Task T029: Web snapshot feedback/retry tests under apps/web/src/features/warehouse-doors/__tests__/
```

## Implementation Strategy

### MVP First: User Story 1

1. Complete Setup and Foundation.
2. Write T005–T007 and confirm RED.
3. Implement T008–T018 in dependency order.
4. Complete T019 and validate US1 independently.
5. Stop for review if embedded lifecycle browsing plus selector-safe API preparation is sufficient.

### Incremental Delivery

1. Deliver US1 as the one-snapshot collection/list MVP plus available-only API contract.
2. Add US2 for exact spatial marker and detail consultation; validate independently.
3. Add US3 for empty, error, retry, refresh, and degraded-map behavior; validate independently.
4. Complete Phase 6 verification and fresh review before the PR is ready.

## Notes

- `[P]` tasks touch different files and may run concurrently only after their stated prerequisites.
- `[US1]`, `[US2]`, and `[US3]` map directly to the specification's three user stories.
- Generated files are refreshed through the migration/Tuyau/TanStack generators rather than edited
  manually.
- The warehouse consultation UI must not call `/warehouse-doors/available`; future discharge selectors
  must use it instead of deriving eligible doors from the complete nested snapshot.
- Point-in-polygon and archived-parent mutation enforcement remain owned by issues #213–#216; this
  slice seeds and reads valid persisted rows while the available query still filters both statuses.
- Commit after each task or focused logical group using Conventional Commits.
