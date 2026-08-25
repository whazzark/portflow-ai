# Tasks: Update a Warehouse

**Input**: Design documents from `specs/site-references/storage-facilities/warehouses/update-a-warehouse/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Observable business behavior follows RED → GREEN → REFACTOR (Constitution Principle IV).
Test tasks must be run and observed failing before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story so each story remains independently testable.
Per `plan.md`, this is a **full-stack** slice: `apps/api` has a warehouse write path but only one
(`WarehousesController` exposes `index` and `store`, `WarehouseRepository` declares `create` and
`list`, `WarehousePolicy` declares `create` and `list`). **No migration is needed** — `warehouses`,
`warehouse_footprint_points`, and `warehouse_doors` all exist. The one genuinely new business rule
is door containment (FR-016); everything else reuses rules #208 already made pure and reusable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an
  incomplete task in the same phase.
- **[Story]**: Maps a task to its user story from `spec.md`.

---

## Phase 1: Setup

**Purpose**: Extend the warehouses route's URL contract to carry the new update mode.

- [X] T001 Add `edit: z.literal('warehouse').optional().catch(undefined)` to `warehouseSearchSchema` in `apps/web/src/routes/_authenticated/warehouses.tsx`, beside the existing `create` param (`contracts/warehouse-update-ui-state.md` §"URL state")

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the containment predicates, the resource-agnostic editable-ring layer, the error
vocabulary, the typed mutation, and the test doubles — everything more than one user story depends
on.

**⚠️ CRITICAL**: No user story implementation starts until this phase is complete.

- [X] T002 [P] Write failing unit tests for the API containment predicate in `apps/api/tests/unit/warehouses/update/footprint_containment.spec.ts`: a point strictly inside a convex ring, strictly outside it, exactly on an edge, exactly on a vertex, inside the notch of a concave ring (outside it), and on the implied closing edge — all reported per `research.md` R5, with "on the boundary" counting as contained
- [X] T003 Add the pure `containsPoint(points, point)` export to `apps/api/app/warehouses/shared/footprint_geometry.ts`: an explicit on-boundary test (collinearity plus the existing `isBetween`) **before** an even-odd ray cast, reusing the module's existing planar-geometry helpers and keeping it free of Lucid, HTTP, and container dependencies — depends on T002 (`research.md` R5)
- [X] T004 [P] Write failing unit tests for the web mirror in `apps/web/src/features/warehouses/__tests__/footprint-containment.test.ts`, covering the same cases as T002 plus `doorsOutsideFootprint` returning the offending doors in stored order and an empty array when the warehouse has no doors
- [X] T005 Add `isInsideFootprint(points, point)` and `doorsOutsideFootprint(points, doors)` to `apps/web/src/features/warehouses/geometry/footprint-validation.ts`, mirroring T003 exactly and importing nothing outside `features/warehouses/types` — depends on T004 (`research.md` R7)
- [X] T006 [P] Write failing tests for the editable-ring layer in `apps/web/src/components/resource-map/__tests__/resource-map-polygon-editing.test.tsx`: one draggable marker per boundary point whose drag reports `(index, point)`; exactly one insert handle per edge, each reporting `onInsertPoint(index, midpoint)` for **its own** edge; a remove control per vertex reporting `onRemovePoint(index)`; every remove control disabled at `minimumPoints`; and the layer **never** arming the map (no `useResourceMapPlacement` click capture)
- [X] T007 Extract the GeoJSON outline rendering out of `apps/web/src/components/resource-map/resource-map-polygon-placement.tsx` into a new `apps/web/src/components/resource-map/resource-map-polygon-outline.tsx`, and consume it from the placement layer with no behavior change — `apps/web/src/components/resource-map/__tests__/resource-map-polygon-placement.test.tsx` must keep passing unchanged in substance (`research.md` R8)
- [X] T008 Implement `apps/web/src/components/resource-map/resource-map-polygon-editing.tsx` exporting `EditablePolygonPlacement` with the surface `{ points: LatLng[], onMovePoint(index, point), onInsertPoint(index, point), onRemovePoint(index), minimumPoints, fillColor }`: renders the ring through `PolygonOutline`, a draggable button marker per vertex with its remove control and `Delete`/`Backspace` handling, and one hollow midpoint handle per edge attaching its click natively with `stopPropagation` the way `FinishOutlineButton` does. No import from `features/` — depends on T006, T007 (`plan.md` §"Reuse contract", `research.md` R9, R10)
- [X] T009 [P] Add `WarehouseNotFoundException` (404, `E_WAREHOUSE_NOT_FOUND`), `ArchivedWarehouseReadOnlyException` (409, `E_WAREHOUSE_ARCHIVED`), and `WarehouseDoorsOutsideFootprintException` (409, `E_WAREHOUSE_DOORS_OUTSIDE_FOOTPRINT`, constructed with the offending door names folded into its message the way `InvalidWarehouseFootprintException` already accepts one) in `apps/api/app/warehouses/shared/warehouse_exceptions.ts`, following `apps/api/app/docks/shared/dock_exceptions.ts` (`contracts/warehouses-update.openapi.yaml`)
- [X] T010 [P] Add the warehouse update mutation with list-query invalidation to `apps/web/src/features/warehouses/mutations/use-warehouse-mutations.ts`, beside the existing `create`, following the same `tuyauQuery` + `invalidateWarehouses` shape
- [X] T011 [P] Extend `apps/web/src/features/warehouses/__tests__/support/handlers.ts` with an `updateWarehouseHandler` (200, 404 `E_WAREHOUSE_NOT_FOUND`, 409 for each of the three conflict codes, 422 for both footprint and name codes, plus a network-failure variant) and add fixtures to `support/fixtures.ts` for a warehouse **with doors**, a warehouse **without doors**, and an **archived** warehouse
- [X] T012 [P] Extend the map test double at `apps/web/src/features/warehouses/__tests__/support/mock-warehouse-map.tsx` with editing affordances — "Simulate dragging boundary point N", "Simulate inserting on edge N", "Simulate removing boundary point N", and "Simulate map click away from the outline" — so the update tests can drive the map without MapLibre

**Checkpoint**: Both containment predicates exist and are independently tested, the editable-ring
layer is tested and carries no warehouse vocabulary, the placement layer still passes after the
outline extraction, and the error codes, typed mutation, handlers, and map affordances are in place.
User story implementation can now begin.

---

## Phase 3: User Story 1 - Correct an Available Warehouse's Name and Footprint (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator opens an available warehouse, corrects its name and reshapes
its footprint through the outline's own handles, and saves — the correction takes effect as one
all-or-nothing change that preserves identity, status, creation time, and doors.

**Independent Test**: Open an available warehouse from the map, rename it, drag a boundary point,
insert one on a chosen edge, remove another, save, and verify the warehouse shows its new name and
polygon while keeping the same identity, Available status, and creation time (`spec.md` US1).

### Tests for User Story 1 (write and observe RED first)

- [X] T013 [P] [US1] Add a failing API integration test for the happy path in `apps/api/tests/integration/warehouses/update/update.spec.ts`: an authenticated administrator PATCHes a name and a footprint and receives 200; the persisted `warehouse_footprint_points` rows carry `position` 0..n-1 in the **submitted order** with no row left over from the previous outline; `id`, `status`, `created_at`, and every lifecycle column are unchanged; `updated_at` moved; and the returned `doors` are identical in count and position (`quickstart.md` scenarios 13–15; FR-015, FR-017, FR-022)
- [X] T014 [P] [US1] Add failing API unit tests for `UpdateWarehouseUseCase` in `apps/api/tests/unit/warehouses/update/update.spec.ts` against a repository swapped through `app.container.swap` (as `tests/unit/warehouses/creation/create.spec.ts` does): a name-only payload reaches the repository trimmed with no footprint, a footprint-only payload reaches it with no name, the submitted point order passes through untouched, and status is never taken from input (FR-003, FR-004, FR-009)
- [X] T015 [P] [US1] Add a failing web session test in `apps/web/src/features/warehouses/__tests__/update/session.test.tsx`: activating the update adds `edit=warehouse` to the URL and opens a panel pre-filled with the stored name and every boundary point; activating creation ends the session without saving and the reverse drops any pending creation footprint; cancelling restores the stored outline and keeps the warehouse selected; and the session is discarded when the selection changes identity or disappears (`quickstart.md` scenarios 3, 4, 21; FR-005, FR-005b, FR-026, `research.md` R11)
- [X] T016 [P] [US1] Add a failing web reshape test in `apps/web/src/features/warehouses/__tests__/update/reshape.test.tsx`: dragging a boundary point redraws the ring at the same count; inserting on edge *n* places a point between that edge's two endpoints and nowhere else in the order; removing a point that is **not** the last added closes the ring over the gap; a click on empty map and a click on another warehouse's polygon both change nothing and select nothing; and no finish-the-outline control exists (`quickstart.md` scenarios 5–8, 10; FR-005a, FR-006, FR-006a, FR-006b, FR-006c, SC-012)

### Implementation for User Story 1

- [X] T017 [P] [US1] Add `update(user)` to `apps/api/app/warehouses/shared/warehouse_policy.ts`, returning true for `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, mirroring the existing `create` ability
- [X] T018 [P] [US1] Add `updateWarehouseValidator` to `apps/api/app/warehouses/shared/warehouse_validator.ts`: optional `name` via `nonBlank()` 1–255 and optional `footprint.points` (3–`MAX_FOOTPRINT_POINTS`, coordinates in range), each `requiredWhen` present, with at least one of the two required — following the `requiredWhen`/`requiredIfMissing` shape of `updateDockValidator` (`contracts/warehouses-update.openapi.yaml`, `research.md` R1, R2)
- [X] T019 [US1] Add `findWithDoors(id)`, `UpdateWarehouseCommand`, `UpdateWarehouseResult` (`{ kind: 'UPDATED'; warehouse } | { kind: 'NOT_FOUND' } | { kind: 'ARCHIVED' } | { kind: 'DUPLICATE_NAME' }`), and the abstract `updateAvailable` method to `apps/api/app/warehouses/shared/repositories/warehouse_repository.ts`, following the four-kind result shape of `DockRepository.updateAvailable`
- [X] T020 [US1] Implement `findWithDoors` and `updateAvailable` in `apps/api/app/warehouses/shared/repositories/lucid_warehouse_repository.ts`: one transaction updating the row `where('id', id).where('status', 'AVAILABLE')` and always bumping `updatedAt`, then — when a footprint was submitted — deleting every `warehouse_footprint_points` row for the warehouse and re-inserting the submitted sequence with `position` from the array index; zero affected rows resolved into `NOT_FOUND` vs `ARCHIVED` the way the dock repository does; `LOWER(name)` unique violations mapped through `#shared/database/is_unique_violation` into `DUPLICATE_NAME`; and the warehouse reloaded with ordered `footprintPoints` and `doors` so `WarehouseTransformer` can serialize it — depends on T019 (`research.md` R3, `data-model.md`)
- [X] T021 [US1] Implement `apps/api/app/warehouses/update/update_warehouse_use_case.ts`: normalize the name through `normalizeSiteReferenceName` when present, range-check each submitted coordinate, call `assertSimpleFootprint` when a footprint is present, then `repository.updateAvailable`, mapping `NOT_FOUND`/`ARCHIVED`/`DUPLICATE_NAME` onto their exceptions and throwing on any unexpected kind — mirroring `UpdateDockUseCase` result kind for result kind. Containment (FR-016) is added by T034 — depends on T009, T020
- [X] T022 [US1] Add `update` to `apps/api/app/controllers/warehouses_controller.ts` (`bouncer.with(WarehousePolicy).authorize('update')` → `request.validateUsing(updateWarehouseValidator)` → use case with `params.id` → `serialize(WarehouseTransformer.transform(warehouse))`, 200), register `router.patch('/:id', [controllers.Warehouses, 'update']).as('update')` in the `/warehouses` group of `apps/api/start/routes.ts`, and commit the regenerated `warehouses.update` entry in `apps/api/.adonisjs/client/registry/index.ts` — depends on T017, T018, T021
- [X] T023 [P] [US1] Implement `apps/web/src/features/warehouses/use-warehouse-edit-session.ts` owning `{ warehouseId, editable, originName, originPoints, draftName, draftPoints }` with move/insert/remove-at-index operations, carrying the three rules `useCheckpointEditSession` hardened after #199 — session discarded when the selection changes identity or disappears, `editable` and the origins snapshotted once at session start and never re-derived from live query data, and no way to arm a session for a warehouse that is not selected (`data-model.md` §"Warehouse edit session", `research.md` R11)
- [X] T024 [P] [US1] Implement `apps/web/src/features/warehouses/ui/update-warehouse-panel.tsx`: a sheet with a back/cancel action, a name field pre-filled from the session, the running boundary-point count, a "modified" indicator offering to restore the snapshotted origin (as `EditCheckpointPanel` does for a moved marker), a `Coordinates (advanced)` disclosure collapsed by default holding one fieldset per boundary point with its latitude, longitude, "insert after this point" (pre-filled with the split edge's midpoint) and "remove" controls, and a save button (`contracts/warehouse-update-ui-state.md` §"Update panel", FR-006d)
- [X] T025 [US1] Offer the update action from the warehouse detail view in `apps/web/src/features/warehouses/ui/warehouse-details.tsx`, wired from `apps/web/src/features/warehouses/ui/warehouses-page.tsx` — depends on T024
- [X] T026 [US1] Add an `excludedId` prop to `apps/web/src/features/warehouses/map/warehouse-polygon.tsx` so the warehouse owned by an open edit session is not drawn twice, keeping the existing `disabled` behavior intact (`research.md` R12)
- [X] T027 [US1] Wire the editing layer into `apps/web/src/features/warehouses/map/warehouse-map.tsx`: render `EditablePolygonPlacement` for the session's draft, pass `excludedId` to `WarehousePolygons`, keep the edited warehouse's **doors rendered**, treat an open session like an armed mode for polygon-selection `disabled` and for suppressing `FitWarehouseBounds`, and re-fit once when the session closes — depends on T008, T026 (`research.md` R12)
- [X] T028 [US1] Wire the mode in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`: derive the requested session from the `edit` param, `warehouseId`, and `isAdministrator(user)`; make `edit` and `create` mutually exclusive; drop `edit` with any navigation that changes or clears `warehouseId`; and on success invalidate the list, clear `edit`, keep the warehouse selected, and clear `search` when the corrected warehouse would otherwise fall out of view — depends on T010, T023, T024, T027 (`research.md` R13, FR-005b, FR-021)

**Checkpoint**: An administrator can correct a warehouse's name and outline end to end and see the
saved result without a reload. User Story 1 is independently demonstrable — but **not shippable on
its own**: door containment (FR-016) is enforced by T034 in User Story 2.

---

## Phase 4: User Story 2 - Be Prevented From Saving Invalid or Duplicate Values (Priority: P2)

**Goal**: Blank, over-long, duplicate, out-of-range, geometrically impossible, and door-excluding
submissions are refused with a clear, specific explanation, leaving the stored warehouse untouched
and the administrator's name and draft outline intact.

**Independent Test**: On an available warehouse attempt in turn a blank name, an over-long name,
another warehouse's name, a footprint below three points, an out-of-range coordinate, a self-crossing
outline, and a reshape that excludes a door; verify each is refused with a distinct message against
the field, boundary point, or doors concerned, and nothing is stored (`spec.md` US2).

### Tests for User Story 2 (write and observe RED first)

- [X] T029 [P] [US2] Add failing API integration tests for name refusals in `apps/api/tests/integration/warehouses/update/update.spec.ts`: 409 `E_WAREHOUSE_NAME_CONFLICT` for another warehouse's name differing only by case, only by surrounding whitespace, and for an **archived** warehouse's name; 200 when the name belongs to a dock or weighing area; 200 when the warehouse's own current name is resubmitted; and a trimmed name stored for `"  North Shed  "` — asserting the stored warehouse is unchanged after each refusal (`quickstart.md` scenarios 16–18; FR-009 to FR-011a)
- [X] T030 [P] [US2] Add failing API integration tests for geometry refusals and atomicity in `apps/api/tests/integration/warehouses/update/update.spec.ts`: 422 `E_VALIDATION_ERROR` for a blank name, a two-point footprint, an empty payload, and an out-of-range coordinate; 422 `E_WAREHOUSE_INVALID_FOOTPRINT` for a self-crossing outline, duplicate consecutive points, and a flat outline; and after every one of them the previous footprint rows are **byte-for-byte unchanged** with no orphaned or partially replaced row (`quickstart.md` scenario 19; FR-012 to FR-014, FR-020)
- [X] T031 [P] [US2] Add failing API integration tests for door containment in `apps/api/tests/integration/warehouses/update/update.spec.ts`: 409 `E_WAREHOUSE_DOORS_OUTSIDE_FOOTPRINT` naming the doors when a reshape excludes an `AVAILABLE` door, the same refusal when it excludes only an **ARCHIVED** door, 200 when a door sits exactly on the resulting boundary, and 200 for a warehouse with no doors — with every door row unchanged after each refusal (`quickstart.md` scenario 20; FR-016, FR-016a, SC-010)
- [X] T032 [P] [US2] Add failing API unit tests in `apps/api/tests/unit/warehouses/update/update.spec.ts` proving `UpdateWarehouseUseCase` raises `InvalidWarehouseFootprintException` for a crossing outline and `WarehouseDoorsOutsideFootprintException` for an excluded door **without reaching `updateAvailable`** in either case, and that the containment message names the offending doors
- [X] T033 [P] [US2] Add a failing web validation test in `apps/web/src/features/warehouses/__tests__/update/validation.test.tsx`: a blank name is rejected on the name field; a 409 name conflict surfaces on the name field; a crossing outline surfaces as a panel-level message before any request; doors falling outside are named in the panel with save disabled; every remove control is disabled at exactly three boundary points; and after every refusal the entered name and the draft outline remain in place with `edit=warehouse` still in the URL (`quickstart.md` scenarios 9, 17, 19, 20; FR-006b, FR-024, FR-025)

### Implementation for User Story 2

- [X] T034 [US2] Extend `apps/api/app/warehouses/update/update_warehouse_use_case.ts` with the containment decision: read the warehouse and its doors through `findWithDoors`, resolve absent → `WarehouseNotFoundException` and archived → `ArchivedWarehouseReadOnlyException` from that read, then reject any door not satisfying `containsPoint` with `WarehouseDoorsOutsideFootprintException` naming them — all before `updateAvailable` is called, so a refused submission never opens a transaction — depends on T003, T021, T032 (`research.md` R4, R6)
- [X] T035 [P] [US2] Apply the client guards in `apps/web/src/features/warehouses/ui/update-warehouse-panel.tsx`: gate save on `checkFootprint` and `doorsOutsideFootprint`, and render the first blocking problem as the panel's message — naming the offending doors — before any request is sent — depends on T005, T024 (`research.md` R7)
- [X] T036 [US2] Map API failures in the panel's submit handler: `E_WAREHOUSE_NAME_CONFLICT` and `E_WAREHOUSE_NAME_INVALID` to a field-level error on `name`, `E_WAREHOUSE_INVALID_FOOTPRINT` and `E_WAREHOUSE_DOORS_OUTSIDE_FOOTPRINT` to a panel-level message, `E_VALIDATION_ERROR` through `applyValidationError`, and anything else to a retryable toast titled "Unable to update warehouse" — following `apps/web/src/features/checkpoints/ui/checkpoint-resource-form.tsx` — depends on T035 (`contracts/warehouse-update-ui-state.md` §"Outcome handling")
- [X] T037 [US2] Enforce the three-point floor end to end: pass `minimumPoints={3}` from `apps/web/src/features/warehouses/map/warehouse-map.tsx` and disable the per-point remove control in `apps/web/src/features/warehouses/ui/update-warehouse-panel.tsx` with the explanation, so the draft can never be taken below three points through either path — depends on T008, T024 (FR-006b, SC-012)
- [X] T038 [US2] Ensure a refused submission preserves state across `apps/web/src/features/warehouses/ui/update-warehouse-panel.tsx` (entered name, coordinate field text) and `apps/web/src/features/warehouses/use-warehouse-edit-session.ts` (draft points, snapshotted origin): neither is reset on an error path and `edit=warehouse` stays in the URL — depends on T036 (FR-025)

**Checkpoint**: Every invalid, conflicting, or door-excluding submission is refused clearly and
recoverably, with nothing persisted and the draft intact. User Stories 1 and 2 both work
independently, and the door-containment invariant now holds.

---

## Phase 5: User Story 3 - Be Blocked From Updating What Must Not Change (Priority: P3)

**Goal**: Updates are refused for users without warehouse management permission, for archived
warehouses, and for warehouses that no longer exist — through the interface or directly.

**Independent Test**: Attempt an update as an unauthenticated visitor, an inactive user, an active
non-administrator, on an archived warehouse, and on an unknown identifier; verify each is refused
with the appropriate outcome and no warehouse data changes (`spec.md` US3).

### Tests for User Story 3 (write and observe RED first)

- [X] T039 [P] [US3] Add failing policy unit tests in `apps/api/tests/unit/warehouses/update/update.spec.ts`: `WarehousePolicy.update` is true for `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN` and false for `OPERATIONS_LEAD` and `OBSERVER`, following the role table in `tests/unit/warehouses/consultation/list.spec.ts`
- [X] T040 [P] [US3] Add failing API integration tests in `apps/api/tests/integration/warehouses/update/update.spec.ts`: an unauthenticated PATCH is refused, an active `OBSERVER`'s PATCH is refused, an **archived** warehouse returns 409 `E_WAREHOUSE_ARCHIVED`, an unknown id returns 404 `E_WAREHOUSE_NOT_FOUND` disclosing nothing about other warehouses, and a warehouse archived **between** the read and the write is still refused by the `status = 'AVAILABLE'` guard — with no warehouse changed in any case (`quickstart.md` scenarios 1, 2, 22, 23; FR-002, FR-018, FR-019, `research.md` R4)
- [X] T041 [P] [US3] Add a failing web permissions test in `apps/web/src/features/warehouses/__tests__/update/permissions.test.tsx`: a non-administrator sees no update action on a warehouse's details, and `/warehouses?warehouseId=…&edit=warehouse` renders ordinary consultation with no panel and a non-editable ring; an authorized administrator sees no update action on an **archived** warehouse and the same param is inert there too (`contracts/warehouse-update-ui-state.md` §"URL state"; FR-002, FR-018)

### Implementation for User Story 3

- [X] T042 [US3] Gate the update action on `isAdministrator(user)` in `apps/web/src/features/warehouses/ui/warehouses-page.tsx` and `ui/warehouse-details.tsx`, and make `edit=warehouse` inert for a non-administrator so the panel never opens and no ring becomes editable — depends on T025, T028, T041
- [X] T043 [US3] Make an archived warehouse read-only on both sides in `apps/web/src/features/warehouses/ui/warehouse-details.tsx` and `apps/web/src/features/warehouses/ui/update-warehouse-panel.tsx`: omit or disable the update action for it, keep `edit=warehouse` inert, and surface the server's `E_WAREHOUSE_ARCHIVED` message stating that reactivation is required first when a session is submitted against a warehouse archived meanwhile — depends on T036, T042 (FR-018, Edge case)

**Checkpoint**: All three user stories are independently functional, authorization and lifecycle
rules hold on both sides, and the server stays authoritative.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T044 [P] Confirm the existing warehouse suites pass **unchanged in substance** — `apps/web/src/features/warehouses/__tests__/{consultation,warehouses-page,warehouse-map,warehouse-polygon}.test.tsx`, the `create/` suite, and `apps/web/src/components/resource-map/__tests__/resource-map-polygon-placement.test.tsx` after the T007 outline extraction — proving the second map mode altered neither browsing nor drawing (`quickstart.md` §"Automated verification")
- [X] T045 [P] Verify the delivered payloads match `contracts/warehouses-update.openapi.yaml` field for field — request shape in `apps/api/app/warehouses/shared/warehouse_validator.ts`, response shape from `apps/api/app/warehouses/shared/warehouse_transformer.ts` — including the at-least-one-member rule, the `footprint.points` nesting, and every error code and status
- [ ] T046 Walk `quickstart.md` scenarios 1–26 manually against a running stack, including the concurrent-archive case (scenario 22), the interrupted-submission retry (scenario 24), and the concurrent-duplicate race (scenario 26)
- [X] T047 Run the full verification gate per Constitution Principle VII: `pnpm check`, `pnpm typecheck`, `pnpm --filter @portflow/api test`, `pnpm --filter @portflow/web test`, `pnpm test`, and the affected browser flow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all user stories.**
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on US2 or US3.
- **User Story 2 (Phase 4)**: Depends on Foundational. Extends US1's use case and panel, so it is
  sequenced after US1 in a single-developer flow; its API refusal tests (T029–T032) can be written as
  soon as T022 exists. **US1 must not ship without T034.**
- **User Story 3 (Phase 5)**: Depends on Foundational. Its API-side tests need only T017 and T022;
  T042 and T043 need US1's page wiring and US2's error mapping.
- **Polish (Phase 6)**: Depends on all delivered stories.

### Within Each Story

- Every test task is written and observed failing before its implementation task.
- API: policy and validator → repository contract → repository implementation → use case →
  controller, route, and regenerated registry.
- Web: pure guard → map layer → session hook → panel → page wiring → permission gate.

### Critical Path

T001 → T002/T003 → T006/T007 → T008 → T019 → T020 → T021 → T022 → T028 → T034 → T036 → T042

### Parallel Opportunities

- **Phase 2**: T002, T004, T006, T009, T010, T011, and T012 are all independent. T003 depends only on
  T002, T005 only on T004, and T008 on T006 plus T007 — so the API geometry track, the web geometry
  track, and the map-layer track run in parallel end to end.
- **Phase 3**: the four test tasks T013–T016 are independent of each other; T017, T018, T023, and
  T024 touch four different files and can run together once the tests are red.
- **Phase 4**: T029–T033 are independent; T035 can proceed while T034 is being written.
- **Phase 5**: T039–T041 are independent.
- **Across stories**: with more than one developer, US3's API tests (T039, T040) can be written as
  soon as T022 lands, in parallel with US2.

---

## Parallel Example: Phase 2

```bash
# Three independent tracks, launched together:
Task: "T002 failing containment tests in apps/api/tests/unit/warehouses/update/footprint_containment.spec.ts"
Task: "T004 failing containment tests in apps/web/src/features/warehouses/__tests__/footprint-containment.test.ts"
Task: "T006 failing editable-ring tests in apps/web/src/components/resource-map/__tests__/resource-map-polygon-editing.test.tsx"

# Independent scaffolding, launched together:
Task: "T009 warehouse update exceptions in apps/api/app/warehouses/shared/warehouse_exceptions.ts"
Task: "T010 update mutation in apps/web/src/features/warehouses/mutations/use-warehouse-mutations.ts"
Task: "T011 MSW handlers and fixtures in apps/web/src/features/warehouses/__tests__/support/"
Task: "T012 map test-double affordances in apps/web/src/features/warehouses/__tests__/support/mock-warehouse-map.tsx"
```

---

## Implementation Strategy

### MVP scope

User Story 1 (Phase 3) is the demonstrable MVP: an administrator corrects a name and an outline and
sees the saved result. It is **not a releasable increment on its own** — FR-016's door containment
lands with T034 in User Story 2, and shipping the correction path without it would let a reshape
store a door outside its warehouse. The smallest releasable slice is therefore Phases 1–4.

### Incremental delivery

1. Phase 1 + Phase 2 → guards, layer, and error vocabulary ready.
2. Phase 3 → US1, demo the correction path. **Stop and validate.**
3. Phase 4 → US2, every refusal path including door containment. **First releasable point.**
4. Phase 5 → US3, authorization and lifecycle closed on both sides.
5. Phase 6 → regression, contract conformance, manual walkthrough, verification gate.

### Parallel team strategy

With two developers, split Phase 2 along its API and web tracks, then take US1's API chain
(T017–T022) and its web chain (T023–T028) in parallel — they meet only at T028, which consumes the
typed mutation from T010.

---

## Notes

- `[P]` tasks touch different files and have no dependency on an incomplete task in the same phase.
- No migration: `warehouses`, `warehouse_footprint_points`, and `warehouse_doors` all exist.
- `apps/api/.adonisjs/client/registry/index.ts` is committed and regenerated by running the API dev
  server; its `warehouses.update` entry must appear in the reviewed diff (T022).
- The footprint is replaced as a whole. Any task tempted to diff boundary points individually is
  going against `research.md` R3 and `data-model.md`.
- Verify tests fail before implementing; commit after each task or logical group.

---

## Implementation Notes

- **T046 is the only task left open**: walking `quickstart.md` scenarios 1–26 manually against a
  running stack is a human verification step and was not performed. Everything it covers is
  exercised by automated tests except the browser-level feel of the map gestures (drag, per-edge
  insert handle, per-vertex removal), which no test double can stand in for.
- **A real defect was found and fixed while implementing US2.** The first containment predicate
  tested collinearity exactly (`cross === 0`). At real site coordinates that never holds: the seeded
  North Shed doors sit *on* a diagonal footprint edge, and an exact test reported them as outside,
  so opening that warehouse for correction would have refused a submission that changed nothing.
  Both copies of the predicate now measure the perpendicular distance against a documented
  `ON_BOUNDARY_TOLERANCE_DEGREES` of 1e-9 (~0.1 mm), five orders of magnitude above the arithmetic
  noise and far below any placement precision the site can mean. Regression tests at realistic
  coordinates were added on both sides.
- **T035 grew a client-side door guard.** The panel now names the doors a reshape would exclude and
  disables saving *before* any request, rather than only mapping the API refusal (`research.md` R7,
  R10). The API stays the enforcement point, and a separate test drives the server path with a
  change the client guard accepts.
- **T042 and T043 needed no code of their own.** The permission gate and the archived read-only rule
  fell out of T025's action gating and T023's `editable` snapshot; T041's four tests pass against
  that implementation and pin the behavior.
- `apps/api/.env` was created locally from `.env.example` to run the API suite. It is gitignored and
  is not part of the change.
