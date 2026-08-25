# Tasks: Create a Warehouse

**Input**: Design documents from `specs/site-references/storage-facilities/warehouses/create-a-warehouse/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Observable business behavior follows RED → GREEN → REFACTOR (Constitution Principle IV).
Test tasks must be run and observed failing before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story so each story remains independently testable.
Per `plan.md`, this is a **full-stack** slice: `apps/api` has no warehouse write path today
(`WarehousesController` exposes only `index`, `WarehouseRepository` only `list()`, `WarehousePolicy`
only `list()`). **No migration is needed** — #207 already created `warehouses` and
`warehouse_footprint_points` with the ordered `position` primary key, the coordinate CHECK
constraints, and the `LOWER(name)` unique index.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an
  incomplete task in the same phase.
- **[Story]**: Maps a task to its user story from `spec.md`.

---

## Phase 1: Setup

**Purpose**: Extend the warehouses route's URL contract to carry the new creation mode.

- [X] T001 Add `create: z.literal('warehouse').optional().catch(undefined)` to `warehouseSearchSchema` in `apps/web/src/routes/_authenticated/warehouses.tsx` (`contracts/warehouse-creation-ui-state.md` §"URL contract")

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the pure geometry rules, the resource-agnostic polygon-drawing primitive, the
error vocabulary, the typed mutation, and the map test double — everything more than one user story
depends on, and everything that must not be forked later by #209.

**⚠️ CRITICAL**: No user story implementation starts until this phase is complete.

- [X] T002 [P] Write failing unit tests for the API footprint geometry rules in `apps/api/tests/unit/warehouses/creation/footprint_geometry.spec.ts`: accepts a triangle, a concave polygon, and a many-vertex outline; rejects a bow-tie (crossing non-adjacent segments), a crossing produced by the implied closing edge, duplicate consecutive points, and a last point equal to the first; treats adjacent segments sharing an endpoint as non-crossing (`research.md` R2)
- [X] T003 Implement the pure module `apps/api/app/warehouses/shared/footprint_geometry.ts` exporting `assertSimpleFootprint(points)` — pairwise O(n²) segment-intersection over the closed ring plus the duplicate-consecutive check, with no Lucid, HTTP, or container dependency so `UpdateWarehouseUseCase` (#209) can reuse it — depends on T002
- [X] T004 [P] Write failing unit tests for the web-side guard in `apps/web/src/features/warehouses/__tests__/footprint-validation.test.ts`, covering the same cases as T002 plus the minimum-vertex rule (`research.md` R6)
- [X] T005 Implement the pure guard `apps/web/src/features/warehouses/geometry/footprint-validation.ts` exporting `isSubmittableFootprint(points)` and a discriminated reason (`TOO_FEW_POINTS` | `DUPLICATE_POINT` | `SELF_INTERSECTING`), importing nothing outside `features/warehouses/types` — depends on T004
- [X] T006 [P] Write failing tests for the drawing primitive in `apps/web/src/components/resource-map/__tests__/resource-map-polygon-placement.test.tsx`: while armed a map click reports an appended point and other click behavior is suppressed, each point renders a draggable marker whose drag reports `(index, point)`, the outline renders as a line from two points and as a closed fill from three, and nothing renders while disarmed
- [X] T007 Implement `apps/web/src/components/resource-map/resource-map-polygon-placement.tsx` consuming `useResourceMapPlacement` **unmodified** (its `onPlace` appends a vertex), with the public surface `{ armed, points: LatLng[], onAddPoint, onMovePoint(index, point) }` and no import from `features/` (T045 later adds `onComplete`/`completed`) — see `plan.md`'s "Reuse contract" — depends on T006
- [X] T008 [P] Add `DuplicateWarehouseNameException` (409, `E_WAREHOUSE_NAME_CONFLICT`) and `InvalidWarehouseFootprintException` (422, `E_WAREHOUSE_INVALID_FOOTPRINT`) in `apps/api/app/warehouses/shared/warehouse_exceptions.ts`, following `apps/api/app/weighing_areas/shared/weighing_area_exceptions.ts` (`contracts/warehouses-create.openapi.yaml`)
- [X] T009 [P] Implement the warehouse create mutation with list-query invalidation in `apps/web/src/features/warehouses/mutations/use-warehouse-mutations.ts`, mirroring `apps/web/src/features/weighing-areas/mutations/use-weighing-area-mutations.ts`
- [X] T010 [P] Extend `apps/web/src/features/warehouses/__tests__/support/handlers.ts` with a `createWarehouseHandler` (201, 409 `E_WAREHOUSE_NAME_CONFLICT`, 422 `E_WAREHOUSE_INVALID_FOOTPRINT`, and network-failure variants) and add a created-warehouse fixture to `support/fixtures.ts`
- [X] T011 [P] Add a shared warehouse map test double at `apps/web/src/features/warehouses/__tests__/support/mock-warehouse-map.tsx` exposing kind-agnostic affordances — "Simulate map click to add footprint point", "Simulate dragging footprint point N", and the existing warehouse-selection buttons — so the drawing tests can drive the map without MapLibre, following `apps/web/src/features/checkpoints/__tests__/support/mock-checkpoint-map.tsx`

**Checkpoint**: Both geometry guards exist and are independently tested, the polygon primitive is
tested and carries no warehouse vocabulary, the error codes and typed mutation exist, and the web
tests can drive a map. User story implementation can now begin.

---

## Phase 3: User Story 1 - Draw and Create a Warehouse with Its Footprint (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator activates the creation mode on the warehouse map, draws the
footprint by clicking boundary points, names it, and confirms — the warehouse is created as
Available with exactly the drawn polygon and appears immediately, selected.

**Independent Test**: Activate the creation mode, click at least three points on the map, submit a
unique name, and verify the new warehouse appears on the map as a polygon matching the drawn
boundary with Available status (`spec.md` US1).

### Tests for User Story 1 (write and observe RED first)

- [X] T012 [P] [US1] Add a failing API integration test for the happy path in `apps/api/tests/integration/warehouses/creation/create.spec.ts`: an authenticated administrator POSTs a name and a three-point footprint, receives 201 with `status: 'AVAILABLE'`, `doors: []`, and `footprint.points` in the **submitted order**, and the persisted `warehouse_footprint_points` rows carry `position` 0..n-1 in that same order (`quickstart.md` scenario 9, FR-013/FR-014/FR-015)
- [X] T013 [P] [US1] Add failing API unit tests for `CreateWarehouseUseCase` in `apps/api/tests/unit/warehouses/creation/create.spec.ts` against a repository swapped through `app.container.swap` (as `tests/unit/warehouses/consultation/list.spec.ts` does): the name reaches the repository trimmed, status is never taken from input, and the submitted point order is passed through untouched (FR-008, FR-013, FR-014)
- [X] T014 [P] [US1] Add a failing web drawing test in `apps/web/src/features/warehouses/__tests__/create/drawing.test.tsx`: activating the mode adds `create=warehouse` to the URL and arms the map; successive clicks append vertices and update the outline; dragging a vertex moves it; "Remove last point" drops the newest; editing a vertex's coordinate field moves it on the map and vice versa; a click landing on an existing warehouse's polygon adds a vertex instead of opening that warehouse's details (`quickstart.md` scenarios 2, 4, 5, 6; FR-002, FR-002a, FR-003, FR-004)
- [X] T015 [P] [US1] Add a failing web creation test in `apps/web/src/features/warehouses/__tests__/create/create.test.tsx`: activating the mode while a warehouse's details are open closes them and clears `warehouseId`; a valid draw plus a unique name submits, clears `create`, selects the new warehouse, and reveals it even when the archived view and a non-matching search were active; cancelling discards every vertex and restores normal selection (`quickstart.md` scenarios 3, 9, 10, 17; FR-002b, FR-016, FR-019)

### Implementation for User Story 1

- [X] T016 [P] [US1] Add `create(user)` to `apps/api/app/warehouses/shared/warehouse_policy.ts`, returning true for `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, mirroring `DockPolicy.create`
- [X] T017 [P] [US1] Add `createWarehouseValidator` in `apps/api/app/warehouses/shared/warehouse_validator.ts`: `name` via `nonBlank()` 1–255, `footprint.points` an array of 3–500 objects with `latitude` in [-90, 90] and `longitude` in [-180, 180], following `apps/api/app/weighing_areas/shared/weighing_area_validator.ts` (`contracts/warehouses-create.openapi.yaml`, `research.md` R2)
- [X] T018 [US1] Add `CreateWarehouseCommand`, `CreateWarehouseResult` (`{ kind: 'CREATED'; warehouse } | { kind: 'DUPLICATE_NAME' }`), and the abstract `create` method to `apps/api/app/warehouses/shared/repositories/warehouse_repository.ts`, following the weighing-area repository's command/result shape
- [X] T019 [US1] Implement `create` in `apps/api/app/warehouses/shared/repositories/lucid_warehouse_repository.ts`: one transaction inserting the `warehouses` row plus its footprint points with `position` taken from the array index, catching a `LOWER(name)` unique violation via `#shared/database/is_unique_violation` into `{ kind: 'DUPLICATE_NAME' }`, and returning the warehouse **reloaded with `footprintPoints` (ordered by `position`) and `doors` preloaded** so `WarehouseTransformer` can serialize it — depends on T018 (`research.md` R3, `data-model.md`)
- [X] T020 [US1] Implement `apps/api/app/warehouses/create/create_warehouse_use_case.ts`: `assertValidSiteReferenceName`, `assertLegalSiteReference{Latitude,Longitude}` per point, `assertSimpleFootprint`, then `repository.create`, mapping `DUPLICATE_NAME` to `DuplicateWarehouseNameException` — depends on T003, T008, T019
- [X] T021 [US1] Add `store` to `apps/api/app/controllers/warehouses_controller.ts` (`bouncer.with(WarehousePolicy).authorize('create')` → `request.validateUsing(createWarehouseValidator)` → use case → `response.status(201)` → `serialize(WarehouseTransformer.transform(warehouse))`) and register `router.post('/', [controllers.Warehouses, 'store']).as('store')` in the `/warehouses` group of `apps/api/start/routes.ts` — depends on T016, T017, T020
- [X] T022 [P] [US1] Implement `apps/web/src/features/warehouses/ui/create-warehouse-panel.tsx`: a sheet titled "Create warehouse" with a required name field, one `CoordinateField` pair per pending vertex (reusing the presentational component with a per-index `idPrefix`, **without** touching `useCoordinateFields` — `research.md` R7), a "Remove last point" action, guidance while fewer than three vertices exist, and a submit button disabled until the footprint is submittable (`contracts/warehouse-creation-ui-state.md` §"Creation panel")
- [X] T023 [US1] Add a `MapControls` cluster (`showZoom`) hosting `ResourceMapCreateControl` to `apps/web/src/features/warehouses/map/warehouse-map.tsx` — the first control cluster on this map — and render the pending outline through `resource-map-polygon-placement.tsx`, accepting `createActions` and a `placement` prop the way `checkpoint-map.tsx` does — depends on T007 (`research.md` R8)
- [X] T024 [US1] Wire the mode in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`: derive `isCreating` from the `create` param and `isAdministrator(user)`, own the `LatLng[]` pending state and its append/move/remove-last operations, clear `warehouseId`/`doorId`/`doorStatus` on activation, discard vertices whenever the mode leaves, and on success invalidate the list then navigate to `{ create: undefined, warehouseId: <new id>, status: 'available', search: '' }` — depends on T009, T022, T023 (`research.md` R5, R9; FR-002b, FR-016, FR-019)
- [X] T025 [US1] Pass the create action to `ResourceMapWorkspace`'s `mapUnavailableActions` in `apps/web/src/features/warehouses/ui/warehouses-page.tsx` so creation stays reachable where no basemap is configured, as `checkpoints-page.tsx` does — depends on T024 (`research.md` R8)

**Checkpoint**: An administrator can draw a footprint and create a warehouse end to end, and it
appears selected on the map. User Story 1 is independently demonstrable.

---

## Phase 4: User Story 2 - Reject Invalid or Duplicate Submissions (Priority: P2)

**Goal**: Invalid submissions — no complete footprint, missing or duplicate name, invalid boundary,
out-of-range coordinate — are refused with a clear, specific explanation, leaving the pending
footprint and entered name intact and creating nothing.

**Independent Test**: Attempt submission with fewer than three points, with a blank name, with an
existing warehouse's name, and with a self-crossing outline; verify each is rejected with a clear
message, no warehouse is created, and the collection is unchanged (`spec.md` US2).

### Tests for User Story 2 (write and observe RED first)

- [X] T026 [P] [US2] Add failing API integration tests for name conflicts in `apps/api/tests/integration/warehouses/creation/create.spec.ts`: 409 `E_WAREHOUSE_NAME_CONFLICT` for a name differing only by case, only by surrounding whitespace, and for an **archived** warehouse's name; and a 201 when the name belongs to a dock or weighing area — asserting no extra `warehouses` row after each rejection (`quickstart.md` scenarios 13, 14; FR-009, FR-010)
- [X] T027 [P] [US2] Add failing API integration tests for invalid payloads in the same file: 422 `E_VALIDATION_ERROR` for a blank name, for two points, and for a coordinate outside range; 422 `E_WAREHOUSE_INVALID_FOOTPRINT` for a self-crossing outline and for duplicate consecutive points; and assert that no `warehouses` **and no `warehouse_footprint_points`** row is left behind by any of them (`quickstart.md` scenarios 11, 15, 16; FR-005, FR-007, FR-011, FR-012, FR-018)
- [X] T028 [P] [US2] Add failing API unit tests in `apps/api/tests/unit/warehouses/creation/create.spec.ts` proving `CreateWarehouseUseCase` raises `InvalidWarehouseFootprintException` for a crossing outline and `DuplicateWarehouseNameException` when the repository reports `DUPLICATE_NAME`, without reaching persistence in the first case
- [X] T029 [P] [US2] Add a failing web validation test in `apps/web/src/features/warehouses/__tests__/create/validation.test.tsx`: submit stays disabled below three vertices with the guidance shown; a blank name is rejected on the name field; a 409 surfaces as a field-level conflict on the name; a crossing outline surfaces as a form-level message; an out-of-range coordinate surfaces on that vertex; and after every rejection the entered name and every vertex remain in place (`quickstart.md` scenarios 8, 11, 13, 15, 16; FR-017)

### Implementation for User Story 2

- [X] T030 [US2] Extend `apps/api/app/warehouses/create/create_warehouse_use_case.ts` to raise `InvalidWarehouseFootprintException` from `assertSimpleFootprint`, keeping the geometry check ahead of any repository call so a rejected outline never opens a transaction — depends on T028
- [X] T031 [P] [US2] Apply the client guard in `apps/web/src/features/warehouses/ui/create-warehouse-panel.tsx`: gate submit on `isSubmittableFootprint`, and render the guard's reason as the panel's guidance or form-level message before any request is sent — depends on T005, T022
- [X] T032 [US2] Map API failures in the panel's submit handler: `E_WAREHOUSE_NAME_CONFLICT` to a field-level error on `name`, `E_WAREHOUSE_INVALID_FOOTPRINT` to a form-level error, `E_VALIDATION_ERROR` through `applyValidationError`, and anything else to a toast titled "Unable to create warehouse" — following `apps/web/src/features/checkpoints/ui/checkpoint-resource-form.tsx` — depends on T031 (`contracts/warehouse-creation-ui-state.md` §"Error surfacing")
- [X] T033 [US2] Ensure a rejected submission preserves state across `apps/web/src/features/warehouses/ui/create-warehouse-panel.tsx` (entered name, coordinate field text) and `apps/web/src/features/warehouses/ui/warehouses-page.tsx` (pending vertices, active mode): neither is reset on an error path, and `create=warehouse` stays in the URL — depends on T032 (FR-017)

**Checkpoint**: Every invalid or conflicting submission is refused clearly and recoverably, with
nothing persisted. User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Restrict Creation to Authorized Administrators (Priority: P3)

**Goal**: Unauthenticated users, inactive users, and active users without warehouse management
permission cannot create a warehouse or start drawing, through the interface or directly.

**Independent Test**: Attempt creation as an unauthenticated visitor, an inactive user, and an active
non-administrator; verify each is refused, nothing is created, and the action is not offered
(`spec.md` US3).

### Tests for User Story 3 (write and observe RED first)

- [X] T034 [P] [US3] Add failing policy unit tests in `apps/api/tests/unit/warehouses/creation/create.spec.ts`: `WarehousePolicy.create` is true for `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN` and false for `OPERATIONS_LEAD` and `OBSERVER`, following the role table in `tests/unit/warehouses/consultation/list.spec.ts`
- [X] T035 [P] [US3] Add failing API integration tests in `apps/api/tests/integration/warehouses/creation/create.spec.ts`: an unauthenticated POST is refused, an active `OBSERVER`'s POST is refused, and no `warehouses` row exists after either (`quickstart.md` scenario 1; FR-006)
- [X] T036 [P] [US3] Add a failing web permissions test in `apps/web/src/features/warehouses/__tests__/create/permissions.test.tsx`: a non-administrator sees no create action in the control cluster or in the map-unavailable fallback, and loading `/warehouses?create=warehouse` directly renders ordinary consultation with no panel and an unarmed map (`contracts/warehouse-creation-ui-state.md` §"Permission gate"; FR-020)

### Implementation for User Story 3

- [X] T037 [US3] Gate the create action on `isAdministrator(user)` in `apps/web/src/features/warehouses/ui/warehouses-page.tsx` — omitted from both the control cluster and `mapUnavailableActions` — and make `create=warehouse` inert for a non-administrator so the panel never opens and the map is never armed — depends on T024, T025, T036

**Checkpoint**: All three user stories are independently functional and authorization holds on both
sides, with the server authoritative.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T038 [P] Confirm the existing warehouse consultation tests pass **unchanged in substance** — `apps/web/src/features/warehouses/__tests__/{consultation,warehouses-page,warehouse-map,warehouse-polygon}.test.tsx` — proving the first map mode did not alter browsing, searching, or selection (`quickstart.md` §"Regression guard")
- [X] T039 [P] Verify the delivered payloads match `contracts/warehouses-create.openapi.yaml` field for field — request shape in `apps/api/app/warehouses/shared/warehouse_validator.ts`, response shape from `apps/api/app/warehouses/shared/warehouse_transformer.ts` — including `doors: []` and the `footprint.points` nesting on both sides
- [ ] T040 Walk `quickstart.md` scenarios 1–20 manually against a running stack, including the concurrent-duplicate race (scenario 20) and the interrupted-submission retry (scenario 18)
- [X] T041 Run the full verification gate per Constitution Principle VII: `pnpm check`, `pnpm typecheck`, `pnpm --filter @portflow/api test`, `pnpm --filter @portflow/web test`, `pnpm test`, and the affected browser flow

---

## Phase 7: Product Review Feedback

**Purpose**: Two interaction changes requested after manually testing the delivered slice. Both are
recorded in `research.md` R12 and reflected in `spec.md` (FR-002c, FR-003, FR-004a, SC-009) and
`contracts/warehouse-creation-ui-state.md`.

- [X] T042 [P] Pin the polygon layer standing down during creation in `apps/web/src/features/warehouses/__tests__/warehouse-polygon.test.tsx`: `interactive` is false on every `MapGeoJSON` layer and the focusable markers are disabled — the page-level test double cannot see this, and MapLibre dispatches layer handlers independently of the canvas handler (`research.md` R11)
- [X] T043 Add a `disabled` prop to `apps/web/src/features/warehouses/map/warehouse-polygon.tsx` covering the layer's `interactive`, its marker buttons and its tooltip, and pass `disabled={isArmed}` from `apps/web/src/features/warehouses/map/warehouse-map.tsx` — depends on T042 (FR-002a)
- [X] T044 [P] Add failing tests in `apps/web/src/features/warehouses/__tests__/create/drawing.test.tsx` for the point-count summary, finishing the outline on a first-point click, vertices still draggable afterwards, and no finish action below three points (`quickstart.md` scenario 6b)
- [X] T045 Add `onComplete`/`completed` to `apps/web/src/components/resource-map/resource-map-polygon-placement.tsx`: the first vertex becomes a "Finish the outline" control once three points exist, and a finished outline stops arming the click capture while keeping every vertex draggable — depends on T044 (FR-002c)
- [X] T046 Own the finished state in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`: set it on completion, clear it when the mode is left, and reopen it whenever a boundary point is removed — depends on T045 (FR-002c)
- [X] T047 Replace the per-vertex fieldset list in `apps/web/src/features/warehouses/ui/create-warehouse-panel.tsx` with a point-count summary plus a `Coordinates (advanced)` disclosure collapsed by default, keeping every coordinate field and the "Add boundary point" action inside it — depends on T044 (FR-003, FR-004a)
- [X] T048 Update the existing create tests to open the disclosure before editing coordinates, and extend `apps/web/src/features/warehouses/__tests__/support/mock-warehouse-map.tsx` with a first-point-click affordance — depends on T045, T047
- [X] T049 Drop the "New warehouse" marker caption: remove the `label` prop from `resource-map-polygon-placement.tsx` and its call site, since no consumer passes one — depends on T045

**Checkpoint**: a stray click can no longer reshape a finished outline, the panel leads with the map
rather than with coordinates, and the pointer-free path survives one interaction away.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all user stories.**
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on US2 or US3.
- **User Story 2 (Phase 4)**: Depends on Foundational. Extends US1's use case and panel, so it is
  sequenced after US1 in a single-developer flow; its API rejection tests (T026–T028) can be written
  as soon as T021 exists.
- **User Story 3 (Phase 5)**: Depends on Foundational. Its API-side tests need only T016 and T021;
  T037 needs US1's page wiring.
- **Polish (Phase 6)**: Depends on all delivered stories.

### Within Each Story

- Every test task is written and observed failing before its implementation task.
- API: policy and validator → repository contract → repository implementation → use case →
  controller and route.
- Web: primitive → panel → page wiring → permission gate.

### Critical Path

T001 → T002/T003 → T006/T007 → T018 → T019 → T020 → T021 → T024 → T032 → T037

### Parallel Opportunities

- **Phase 2**: T002, T004, T006, T008, T009, T010, T011 all touch different files and start
  together; T003, T005, T007 each unblock as their test task goes RED.
- **Phase 3 tests**: T012, T013, T014, T015 are four different files and run together.
- **Phase 3 implementation**: T016, T017, T022 are independent of one another; the repository →
  use case → controller chain (T018 → T019 → T020 → T021) is strictly sequential.
- **Phase 4 tests**: T026, T027, T028, T029 run together.
- **Phase 5 tests**: T034, T035, T036 run together.
- **Cross-workspace**: the whole `apps/api` chain and the whole `apps/web` chain of a given story
  can proceed in parallel by two developers once Phase 2 is done — the mocked handlers (T010) let the
  web side progress before the endpoint exists.

---

## Parallel Example: User Story 1

```bash
# Launch the four RED test tasks together:
Task: "API integration happy path in apps/api/tests/integration/warehouses/creation/create.spec.ts"
Task: "API use case units in apps/api/tests/unit/warehouses/creation/create.spec.ts"
Task: "Web drawing test in apps/web/src/features/warehouses/__tests__/create/drawing.test.tsx"
Task: "Web creation test in apps/web/src/features/warehouses/__tests__/create/create.test.tsx"

# Then the independent implementation tasks:
Task: "Add create() to apps/api/app/warehouses/shared/warehouse_policy.ts"
Task: "Add createWarehouseValidator in apps/api/app/warehouses/shared/warehouse_validator.ts"
Task: "Implement apps/web/src/features/warehouses/ui/create-warehouse-panel.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 User Story 1.
4. **STOP and VALIDATE**: `quickstart.md` scenarios 2–6, 9, 10, 17 pass. An administrator can draw
   and create a warehouse, and it appears selected on the map.
5. Demo-able: the roadmap's core outcome for #208 is met, though rejections still rely on raw API
   errors and the create action is not yet permission-gated on the client.

### Incremental Delivery

1. Setup + Foundational → geometry rules, drawing primitive, and mutation ready.
2. US1 → draw and create works → demo (MVP).
3. US2 → every rejection is clear and recoverable → demo.
4. US3 → authorization is enforced and the action is hidden from non-administrators → demo.
5. Polish → regression guard, contract check, quickstart walkthrough, verification gate.

### Notes

- `[P]` marks different files with no incomplete in-phase dependency.
- No database migration is created by any task — #207's schema already carries every constraint this
  feature relies on.
- `useResourceMapPlacement`, `useCoordinateFields`, and `CoordinateField` are consumed unmodified; a
  task that finds itself editing one of them has drifted from `plan.md` and `research.md` R4/R7.
- Commit after each task or logical group; stop at any checkpoint to validate a story on its own.
