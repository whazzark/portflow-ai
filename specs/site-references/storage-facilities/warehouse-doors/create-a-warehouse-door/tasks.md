# Tasks: Create a Warehouse Door

**Input**: Design documents from `specs/site-references/storage-facilities/warehouse-doors/create-a-warehouse-door/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Observable business behavior follows RED → GREEN → REFACTOR (Constitution Principle IV).
Test tasks must be run and observed failing before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story so each story remains independently testable.
Per `plan.md`, this is a **full-stack** slice: `apps/api` has no warehouse-door write path today
(`WarehouseDoorsController` exposes only `available`, `WarehouseDoorRepository` only
`listAvailable()`, `WarehouseDoorPolicy` only `listAvailable()`). **No migration is needed** — #212
already created `warehouse_doors` with the `(warehouse_id, LOWER(name))` unique index, the
`name = TRIM(name)` / `LENGTH(name) > 0` CHECKs, and the coordinate range CHECKs. **No new geometry
module is needed** — `containsPoint` (API) and `isInsideFootprint` (web) already exist and are
unit-tested from #209. **No new shared map primitive is needed** — `useResourceMapPlacement`,
`PendingPlacementMarker`, `useCoordinateFields`, and `CoordinateField` are consumed unchanged.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an
  incomplete task in the same phase.
- **[Story]**: Maps a task to its user story from `spec.md`.

---

## Phase 1: Setup

**Purpose**: Widen the warehouses route's URL contract to carry the second creation mode.

- [X] T001 Widen `create` from `z.literal('warehouse')` to `z.enum(['warehouse', 'door']).optional().catch(undefined)` in `warehouseSearchSchema` in `apps/web/src/routes/_authenticated/warehouses.tsx`, leaving every other param untouched (`contracts/warehouse-door-creation-ui-state.md` §"URL contract", `research.md` R8)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the error vocabulary, the repository contract, the DTO field, the typed mutation,
and the web test seams — everything more than one user story depends on, and everything #214–#216
will reach for rather than fork.

**⚠️ CRITICAL**: No user story implementation starts until this phase is complete.

- [X] T002 [P] Create `apps/api/app/warehouse_doors/shared/warehouse_door_exceptions.ts` with `DuplicateWarehouseDoorNameException` (409, `E_WAREHOUSE_DOOR_NAME_CONFLICT`), `InvalidWarehouseDoorNameException` (422, `E_WAREHOUSE_DOOR_NAME_INVALID`), `InvalidWarehouseDoorCoordinatesException` (422, `E_WAREHOUSE_DOOR_COORDINATES_INVALID`), and `WarehouseDoorOutsideFootprintException` (422, `E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT`), following the shape of `apps/api/app/warehouses/shared/warehouse_exceptions.ts`. Do **not** add door-flavoured duplicates of `E_WAREHOUSE_NOT_FOUND` or `E_WAREHOUSE_ARCHIVED` — those are reused as they stand (`research.md` R3, `contracts/warehouse-doors-create.openapi.yaml`)
- [X] T003 [P] Add a failing assertion for `createdAt` to the transformer coverage in `apps/api/tests/unit/warehouse_doors/consultation/available.spec.ts`, proving the field is absent today (`research.md` R6)
- [X] T004 Add `createdAt` to the picked fields in `apps/api/app/warehouse_doors/shared/warehouse_door_transformer.ts`, leaving the door objects embedded by `WarehouseTransformer` untouched so #212's read contract does not change — depends on T003
- [X] T005 [P] Add `CreateWarehouseDoorCommand` (`{ warehouseId, name, latitude, longitude, contains: (points: { latitude: number; longitude: number }[]) => boolean }`), `CreateWarehouseDoorResult` (`CREATED` | `WAREHOUSE_NOT_FOUND` | `WAREHOUSE_ARCHIVED` | `OUTSIDE_FOOTPRINT` | `DUPLICATE_NAME`), and the abstract `create` method to `apps/api/app/warehouse_doors/shared/repositories/warehouse_door_repository.ts`, mirroring the `excludedDoors` callback shape already used by `UpdateWarehouseCommand` (`research.md` R5, `data-model.md`)
- [X] T006 [P] Implement `apps/web/src/features/warehouse-doors/mutations/use-warehouse-door-mutations.ts` exposing a `create` mutation built from `tuyauQuery.warehouseDoors.store.mutationOptions({ onSuccess })` that invalidates `warehouseQueries.list()` — one invalidation refreshes the whole embedded door collection, the reasoning `use-warehouse-mutations.ts` already records (`research.md` R11)
- [X] T007 [P] Extend `apps/web/src/features/warehouses/__tests__/support/handlers.ts` with `createWarehouseDoorHandler(created)` (201), `createWarehouseDoorConflictHandler()` (409 `E_WAREHOUSE_DOOR_NAME_CONFLICT`), `createWarehouseDoorOutsideFootprintHandler()` (422 `E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT`), `createWarehouseDoorArchivedWarehouseHandler()` (409 `E_WAREHOUSE_ARCHIVED`), and a network-failure variant; add a created-door fixture to `apps/web/src/features/warehouses/__tests__/support/fixtures.ts` beside the existing `WAREHOUSES` and `doorLifecycle` helpers
- [X] T008 [P] Extend `apps/web/src/features/warehouses/__tests__/support/mock-warehouse-map.tsx` with a `doorPlacement` seam mirroring the real prop — a "Simulate map click to place the door" button reporting the next `MOCK_CLICK_POINTS` entry, a "Simulate dragging the pending door" button, and a rendered pending marker labelled "New door" when `doorPlacement.pending` is set — keeping the existing polygon `placement` affordances unchanged (`research.md` R12)

**Checkpoint**: The error codes, repository contract, DTO field, typed mutation, MSW handlers, and
map test seam all exist. User story implementation can now begin.

---

## Phase 3: User Story 1 - Place and Create a Door Inside Its Warehouse (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator selects an available warehouse, activates door creation from
its Doors panel, clicks a point inside the footprint, names the door, and confirms — the door is
created Available at that exact position and appears immediately under its warehouse, selected.

**Independent Test**: As an authorized administrator, select an available warehouse, activate door
creation, click a point inside its footprint, submit a unique non-blank name, and verify the new
door appears in the Available door view and on the map at the clicked coordinates (`spec.md` US1).

### Tests for User Story 1 (write and observe RED first)

- [X] T009 [P] [US1] Add a failing API integration test for the happy path in `apps/api/tests/integration/warehouse_doors/creation/create.spec.ts`: an authenticated administrator POSTs `{ warehouseId, name, latitude, longitude }` for an available warehouse with the point inside its footprint, receives 201 with `status: 'AVAILABLE'`, the submitted coordinates, the containing `warehouseId`, and a `createdAt`; the persisted `warehouse_doors` row matches (`quickstart.md` scenarios 9, 10; FR-008, FR-015, FR-016)
- [X] T010 [P] [US1] Add failing API unit tests for `CreateWarehouseDoorUseCase` in `apps/api/tests/unit/warehouse_doors/creation/create.spec.ts` against a repository swapped through `app.container.swap` (as `tests/unit/warehouses/consultation/list.spec.ts` does): the name reaches the repository trimmed, status is never taken from input, and the coordinates pass through untouched (FR-010, FR-015)
- [X] T011 [P] [US1] Add a failing web placement test in `apps/web/src/features/warehouse-doors/__tests__/create/placement.test.tsx`: activating "Create door" on an available warehouse adds `create=door` while keeping `warehouseId`; a map click sets one pending marker labelled "New door"; a second click **moves** it rather than adding a second; dragging it updates the coordinate fields; typing both coordinate fields moves the marker; a click on a warehouse polygon or an existing door marker places the point instead of selecting (`quickstart.md` scenarios 3–6, 8; FR-003, FR-004, FR-022, FR-023)
- [X] T012 [P] [US1] Add a failing web creation test in `apps/web/src/features/warehouse-doors/__tests__/create/create.test.tsx`: a placed point plus a unique name submits, clears `create`, sets `doorStatus=available` and `doorId=<new id>` while keeping `warehouseId`, toasts "Door created", and reveals the new door selected even when the Archived door view was active; `status` and `search` are left untouched (`quickstart.md` scenarios 9, 11; FR-016, FR-017)

### Implementation for User Story 1

- [X] T013 [P] [US1] Add `create(user)` to `apps/api/app/warehouse_doors/shared/warehouse_door_policy.ts`, returning true for `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, mirroring `WarehousePolicy.create`
- [X] T014 [P] [US1] Create `apps/api/app/warehouse_doors/shared/warehouse_door_validator.ts` exporting `createWarehouseDoorValidator`: `warehouseId` a UUID, `name` via `nonBlank()` 1–255, `latitude` a number in [-90, 90], `longitude` a number in [-180, 180], following `apps/api/app/warehouses/shared/warehouse_validator.ts` (`contracts/warehouse-doors-create.openapi.yaml`, `research.md` R2)
- [X] T015 [US1] Implement `create` in `apps/api/app/warehouse_doors/shared/repositories/lucid_warehouse_door_repository.ts`: short-circuit a non-UUID `warehouseId` to `WAREHOUSE_NOT_FOUND` via `#shared/database/is_uuid`; inside one transaction select the warehouse `.where('status', 'AVAILABLE').forUpdate()` with `footprintPoints` preloaded in `position` order, evaluate `command.contains(points)` against that locked snapshot, and insert the door with `status: 'AVAILABLE'`; return the five result arms, distinguishing `WAREHOUSE_NOT_FOUND` from `WAREHOUSE_ARCHIVED` with a follow-up read, and mapping a `(warehouse_id, LOWER(name))` unique violation through `#shared/database/is_unique_violation` to `DUPLICATE_NAME` — depends on T005 (`research.md` R5, `data-model.md`)
- [X] T016 [US1] Implement `apps/api/app/warehouse_doors/create/create_warehouse_door_use_case.ts`: `normalizeSiteReferenceName` then length check, `isLegalSiteReferenceLatitude`/`Longitude`, then `repository.create` with `contains: (points) => containsPoint(points, { latitude, longitude })` imported from `#warehouses/shared/footprint_geometry`, returning the created door on `CREATED` — depends on T002, T015 (`research.md` R2)
- [X] T017 [US1] Add `store` to `apps/api/app/controllers/warehouse_doors_controller.ts` (`bouncer.with(WarehouseDoorPolicy).authorize('create')` → `request.validateUsing(createWarehouseDoorValidator)` → use case → `response.status(201)` → `serialize(WarehouseDoorTransformer.transform(door))`) and register `router.post('/', [controllers.WarehouseDoors, 'store']).as('store')` in the `/warehouse-doors` group of `apps/api/start/routes.ts` — depends on T004, T013, T014, T016 (`research.md` R1)
- [X] T018 [P] [US1] Implement `apps/web/src/features/warehouse-doors/ui/create-warehouse-door-panel.tsx`: a sheet titled "Create door" naming the containing warehouse, a required autofocused name field, a `useCoordinateFields` + `CoordinateField` pair always rendered as the keyboard-only placement path, a submit button disabled until a pending point exists and both coordinates parse, and a cancel action — reusing the shared primitives **unmodified** (`contracts/warehouse-door-creation-ui-state.md` §"Panel state", `research.md` R7)
- [X] T019 [P] [US1] Add an optional `onCreateDoor` action to `apps/web/src/features/warehouse-doors/ui/warehouse-doors-panel.tsx`, rendered as a "Create door" button in the existing header's trailing slot and omitted entirely when the prop is absent (`research.md` R10)
- [X] T020 [US1] Add `doorPlacement?: WarehouseMapDoorPlacement` to `apps/web/src/features/warehouses/map/warehouse-map.tsx` and a local `WarehouseDoorPlacementLayer` composing `useResourceMapPlacement({ armed, onPlace })` with a `PendingPlacementMarker` carrying a door icon and a "New door" label, mirroring `CheckpointPlacementLayer` in `apps/web/src/features/checkpoints/map/checkpoint-map.tsx`; disable warehouse-polygon and door-marker selection while it is armed, and keep `isArmed` — which suppresses `FitWarehouseBounds` — computed from the polygon `placement` and `editing` props only, so the view stays fitted on the selected warehouse (`research.md` R7, R9)
- [X] T021 [US1] Wire the mode in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`: derive `isCreatingDoor` from `create === 'door'`, `canManageWarehouses`, and a selected warehouse that is present and `AVAILABLE`; own the `LatLng | null` pending point and discard it whenever the mode leaves or the selected warehouse changes; pass `onCreateDoor` to `WarehouseDoorsPanel` and `doorPlacement` to `WarehouseMap`; render `CreateWarehouseDoorPanel` in the sheet in place of the details while the mode is active; on success invalidate the list then navigate to `{ create: undefined, doorStatus: 'available', doorId: <new id> }` keeping `warehouseId`, `status`, and `search` — depends on T006, T018, T019, T020 (`research.md` R8, R11; FR-017, FR-021)

**Checkpoint**: An administrator can place and create a door end to end, and it appears selected
under its warehouse. User Story 1 is independently demonstrable.

---

## Phase 4: User Story 2 - Reject Invalid, Misplaced, or Duplicate Submissions (Priority: P2)

**Goal**: Every submission without a placement, with a blank or duplicate name, or with a position
outside the containing footprint is refused with a clear, specific message, and the administrator
keeps their name and pending marker.

**Independent Test**: Attempt to submit before placing a point, with a blank name, with a name that
already belongs to a door of that warehouse, and with a position outside the footprint; verify each
is rejected with a clear message, no door is created, and the warehouse's door collection is
unchanged (`spec.md` US2).

### Tests for User Story 2 (write and observe RED first)

- [X] T022 [P] [US2] Extend `apps/api/tests/integration/warehouse_doors/creation/create.spec.ts` with the rejection matrix: 422 for a blank/whitespace-only name, a name over 255 characters, an out-of-range coordinate, and a point outside the footprint; 409 for a name duplicating an existing door of that warehouse, including a cross-case and a trimmed-whitespace variant and a name held by an **archived** door; a 201 for the same name used in a **different** warehouse; and no `warehouse_doors` row written on any rejection (`quickstart.md` scenarios 13–20; FR-009 to FR-014)
- [X] T023 [P] [US2] Extend `apps/api/tests/unit/warehouse_doors/creation/create.spec.ts` with the mapping of each repository result arm to its exception — `DUPLICATE_NAME` → `DuplicateWarehouseDoorNameException`, `OUTSIDE_FOOTPRINT` → `WarehouseDoorOutsideFootprintException` — plus the use case's own name and coordinate assertions (`data-model.md` §"Domain rules applied on creation")
- [X] T024 [P] [US2] Add a failing web validation test in `apps/web/src/features/warehouse-doors/__tests__/create/validation.test.tsx`: submitting without a placement is blocked with a placement message; a blank name shows a field error; a 409 conflict shows a field error on the name; a point outside the footprint is refused client-side with an inline message and the submit disabled; a 422 `E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT` shows a form-level error; an out-of-range coordinate shows a field error; and after **every** rejection the typed name and the pending marker remain (`quickstart.md` scenarios 12, 13, 15, 18, 20; FR-005, FR-009, FR-011, FR-014, FR-018)

### Implementation for User Story 2

- [X] T025 [US2] Complete the name and coordinate assertions in `apps/api/app/warehouse_doors/create/create_warehouse_door_use_case.ts` — trimmed-empty and over-length raise `InvalidWarehouseDoorNameException`, a non-finite or out-of-range coordinate raises `InvalidWarehouseDoorCoordinatesException` — and map `OUTSIDE_FOOTPRINT` to `WarehouseDoorOutsideFootprintException` and `DUPLICATE_NAME` to `DuplicateWarehouseDoorNameException` — depends on T016, T023
- [X] T026 [US2] Confirm the containment predicate is evaluated **inside** the transaction in `apps/api/app/warehouse_doors/shared/repositories/lucid_warehouse_door_repository.ts`, against the locked footprint rather than a pre-flight read, and that the door insert is skipped entirely when it fails — depends on T015 (`research.md` R5)
- [X] T027 [US2] Map the API error codes in `apps/web/src/features/warehouse-doors/ui/create-warehouse-door-panel.tsx`: `applyValidationError` first, then `E_WAREHOUSE_DOOR_NAME_CONFLICT` and `E_WAREHOUSE_DOOR_NAME_INVALID` onto the name field, `E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT` and `E_WAREHOUSE_ARCHIVED` as form-level errors, anything else as a toast — never clearing the typed name or the pending point — following `create-warehouse-panel.tsx` — depends on T018 (`contracts/warehouse-door-creation-ui-state.md` §"Feedback")
- [X] T028 [US2] Add the client containment guard to `apps/web/src/features/warehouse-doors/ui/create-warehouse-door-panel.tsx`, calling `isInsideFootprint` from `@/features/warehouses/geometry/footprint-validation` against the selected warehouse's footprint to disable submit and show an inline message — feedback only, the API stays authoritative — depends on T018 (`plan.md` §"Complexity Tracking")

**Checkpoint**: Every invalid, misplaced, or conflicting submission is refused clearly and
recoverably, with nothing written and nothing lost.

---

## Phase 5: User Story 3 - Restrict Creation to Authorized Administrators and Eligible Warehouses (Priority: P3)

**Goal**: Unauthenticated, inactive, and unpermitted users cannot create a door, and no one can add a
door to an archived warehouse — through the interface or directly against the endpoint.

**Independent Test**: Attempt creation as an unauthenticated visitor, an inactive user, an active
user without permission, and an authorized administrator targeting an archived warehouse; verify
each is refused, nothing is created, and the action is not offered (`spec.md` US3).

### Tests for User Story 3 (write and observe RED first)

- [X] T029 [P] [US3] Add `apps/api/tests/unit/warehouse_doors/warehouse_door_policy.spec.ts` covering `create` for both administrator roles and refusing every other role and non-active access status, following `apps/api/tests/unit/warehouses/warehouse_policy.spec.ts`
- [X] T030 [P] [US3] Extend `apps/api/tests/integration/warehouse_doors/creation/create.spec.ts` with 401 for no session, 403 for an active non-administrator, 404 `E_WAREHOUSE_NOT_FOUND` for an unknown **and** for a malformed `warehouseId` (never a 500), and 409 `E_WAREHOUSE_ARCHIVED` for an archived warehouse — with no row written in any case (`quickstart.md` scenarios 1, 2 and the direct API checks; FR-006, FR-007)
- [X] T031 [P] [US3] Add a failing web permissions test in `apps/web/src/features/warehouse-doors/__tests__/create/permissions.test.tsx`: the "Create door" action is absent for a non-administrator and absent — not disabled — for an archived warehouse; `?create=door&warehouseId=<id>` renders ordinary consultation with no panel and an unarmed map when the permission is missing, when `warehouseId` is absent or unknown, or when the warehouse is archived (`quickstart.md` scenarios 1, 2; FR-006, FR-007)

### Implementation for User Story 3

- [X] T032 [US3] Map the eligibility arms in `apps/api/app/warehouse_doors/create/create_warehouse_door_use_case.ts`: `WAREHOUSE_NOT_FOUND` → `WarehouseNotFoundException` and `WAREHOUSE_ARCHIVED` → `ArchivedWarehouseReadOnlyException`, both imported from `#warehouses/shared/warehouse_exceptions` rather than redeclared — depends on T016 (`research.md` R3)
- [X] T033 [US3] Gate the "Create door" action in `apps/web/src/features/warehouse-doors/ui/warehouse-doors-panel.tsx` so it renders only when `onCreateDoor` is supplied, and supply it from `apps/web/src/features/warehouses/ui/warehouses-page.tsx` only for an administrator whose selected warehouse is `AVAILABLE` — absent, not disabled, as the sheet footer's `Edit` already is — depends on T019, T021 (`research.md` R10)
- [X] T034 [US3] Make `create=door` inert in `apps/web/src/features/warehouses/ui/warehouses-page.tsx` whenever the permission is missing or `warehouseId` does not resolve to a present `AVAILABLE` warehouse — no panel, no armed map, no pending marker — mirroring how `create === 'warehouse'` is already gated on `canManageWarehouses` — depends on T021 (`contracts/warehouse-door-creation-ui-state.md` §"URL contract")

**Checkpoint**: Authorization and eligibility hold on both sides, and the interface never offers an
action the API would refuse.

---

## Phase 6: User Story 4 - Recover From Failed Submissions (Priority: P3)

**Goal**: A connectivity or server failure during submission leaves nothing created, reports itself
clearly, keeps the administrator's work, and lets a retry produce exactly one door — as do two
administrators racing for the same name.

**Independent Test**: Submit a valid door while the API fails, verify a clear message with the name
and pending marker preserved and nothing created; resolve the failure, retry, and verify exactly one
door exists (`spec.md` US4).

### Tests for User Story 4 (write and observe RED first)

- [X] T035 [P] [US4] Add a failing concurrency test to `apps/api/tests/integration/warehouse_doors/creation/create.spec.ts`: two near-simultaneous POSTs of the same trimmed name for the same warehouse yield exactly one 201 and one 409 `E_WAREHOUSE_DOOR_NAME_CONFLICT`, with exactly one row persisted (`quickstart.md` direct API checks; FR-020)
- [X] T036 [P] [US4] Extend `apps/web/src/features/warehouse-doors/__tests__/create/validation.test.tsx` with the failure path: a network or 500 failure shows an "Unable to create door" toast, creates no door, and preserves the name and pending marker; a retry after the handler recovers creates exactly one door and reveals it (`quickstart.md` scenario 22; FR-019)

### Implementation for User Story 4

- [X] T037 [US4] Verify and, if needed, correct `apps/api/app/warehouse_doors/shared/repositories/lucid_warehouse_door_repository.ts` so every non-`CREATED` arm leaves the transaction with no row written and the `DUPLICATE_NAME` arm relies on the unique index rather than a pre-read — the property that makes the race resolve to exactly one door — depends on T015, T035 (`research.md` R5)
- [X] T038 [US4] Ensure the generic failure branch in `apps/web/src/features/warehouse-doors/ui/create-warehouse-door-panel.tsx` toasts without resetting the form or clearing the pending point, so a retry re-sends the same submission — depends on T027 (`contracts/warehouse-door-creation-ui-state.md` §"Feedback")

**Checkpoint**: All four user stories are independently functional, and no failure path can create a
door or lose the administrator's work.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T039 [P] Update the #213 row in `specs/site-references/storage-facilities/warehouse-doors/roadmap.md` to point at this feature directory instead of "pending selection"
- [X] T040 [P] Run the regression guard from `quickstart.md`: `warehouse-doors/__tests__/{consultation,feedback,markers}.test.tsx` and `warehouses/__tests__/{consultation,warehouses-page,warehouse-map}.test.tsx` must pass unchanged in substance, proving the second map mode did not alter browsing, filtering, or selection and that the embedded door shape is unchanged
- [X] T041 [P] Verify the delivered payloads match `contracts/warehouse-doors-create.openapi.yaml` field for field — request shape in `apps/api/app/warehouse_doors/shared/warehouse_door_validator.ts`, response shape from `apps/api/app/warehouse_doors/shared/warehouse_door_transformer.ts` — including the added `createdAt` and the flat `latitude`/`longitude` on both sides
- [X] T042 Run `pnpm check`, `pnpm typecheck`, `pnpm --filter @portflow/api test`, `pnpm --filter @portflow/web test`, and `pnpm test`, resolving every finding
- [ ] T043 Walk `quickstart.md` scenarios 1–22 manually in the browser, including the keyboard-only placement path and the direct API checks (Constitution Principle VII)
- [ ] T044 Obtain a fresh read-only review of the final diff and resolve or explicitly justify every confirmed finding (Constitution Principle VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all user stories.**
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on US2, US3, or US4.
- **User Story 2 (Phase 4)**: Depends on Foundational. Extends US1's use case, repository, and panel,
  so it is sequenced after US1 in a single-developer flow; its API rejection tests (T022, T023) can
  be written as soon as T017 exists.
- **User Story 3 (Phase 5)**: Depends on Foundational. Its policy test (T029) needs only T013; its
  integration test needs T017; its client gating needs US1's page wiring (T021).
- **User Story 4 (Phase 6)**: Depends on US1 for the write path and on US2's panel error handling
  (T027) for its generic-failure branch.
- **Polish (Phase 7)**: Depends on all delivered stories.

### Within Each Story

- Every test task is written and observed failing before its implementation task.
- API: policy and validator → repository contract → repository implementation → use case →
  controller and route.
- Web: mutation → panel → panel action → map layer → page wiring → permission gate.

### Critical Path

T001 → T005 → T015 → T016 → T017 → T021 → T025 → T032 → T034

### Parallel Opportunities

- **Phase 2**: T002, T003, T005, T006, T007, T008 all touch different files and start together; T004
  unblocks as soon as T003 is RED.
- **Phase 3 tests**: T009, T010, T011, T012 are four different files and run together.
- **Phase 3 implementation**: T013, T014, T018, T019 are independent of one another; the repository →
  use case → controller chain (T015 → T016 → T017) is strictly sequential, and T020 → T021 follows
  the panel and action.
- **Phase 4 tests**: T022, T023, T024 run together.
- **Phase 5 tests**: T029, T030, T031 run together.
- **Phase 6 tests**: T035 and T036 run together.
- **Cross-workspace**: the whole `apps/api` chain and the whole `apps/web` chain of a given story can
  proceed in parallel by two developers once Phase 2 is done — the MSW handlers (T007) let the web
  side progress before the endpoint exists.

---

## Parallel Example: User Story 1

```bash
# Launch the four RED test tasks together:
Task: "API integration happy path in apps/api/tests/integration/warehouse_doors/creation/create.spec.ts"
Task: "API use case units in apps/api/tests/unit/warehouse_doors/creation/create.spec.ts"
Task: "Web placement test in apps/web/src/features/warehouse-doors/__tests__/create/placement.test.tsx"
Task: "Web creation test in apps/web/src/features/warehouse-doors/__tests__/create/create.test.tsx"

# Then the independent implementation tasks:
Task: "Add create() to apps/api/app/warehouse_doors/shared/warehouse_door_policy.ts"
Task: "Add createWarehouseDoorValidator in apps/api/app/warehouse_doors/shared/warehouse_door_validator.ts"
Task: "Implement apps/web/src/features/warehouse-doors/ui/create-warehouse-door-panel.tsx"
Task: "Add the Create door action to apps/web/src/features/warehouse-doors/ui/warehouse-doors-panel.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 User Story 1.
4. **STOP and VALIDATE**: `quickstart.md` scenarios 3–11 pass. An administrator can place and create
   a door, and it appears selected under its warehouse.
5. Demo-able: the roadmap's core outcome for #213 is met, though rejections still surface raw API
   errors and the action is not yet gated client-side.

### Incremental Delivery

1. Setup + Foundational → error codes, repository contract, mutation, and test seams ready.
2. Add User Story 1 → test independently → demo (MVP).
3. Add User Story 2 → every rejection is clear and recoverable.
4. Add User Story 3 → authorization and eligibility hold on both sides.
5. Add User Story 4 → failures and races cannot create or lose anything.
6. Polish → regression guard, full suite, manual walk, fresh review.

### Notes

- `[P]` tasks touch different files and carry no dependency on an incomplete task in the same phase.
- No migration, no new geometry module, and no new shared map primitive: T015's locked read reuses
  `containsPoint`, T018 and T020 reuse `useCoordinateFields`, `CoordinateField`,
  `useResourceMapPlacement`, and `PendingPlacementMarker` unmodified.
- Commit after each task or logical group, using Conventional Commits on
  `feat/213-create-warehouse-door`.
- Stop at any checkpoint to validate a story independently.
