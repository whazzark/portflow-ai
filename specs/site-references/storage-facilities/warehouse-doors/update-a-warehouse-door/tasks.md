# Tasks: Update a Warehouse Door

**Input**: Design documents from `specs/site-references/storage-facilities/warehouse-doors/update-a-warehouse-door/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Observable business behavior follows RED → GREEN → REFACTOR (Constitution Principle IV).
Test tasks must be run and observed failing before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story so each story remains independently testable.
Per `plan.md`, this is a **full-stack** slice: `apps/api` has no warehouse-door update path today
(`WarehouseDoorsController` exposes `available` and `store`, `WarehouseDoorRepository` declares
`create` and `listAvailable`, `WarehouseDoorPolicy` declares `create` and `listAvailable`).
**No migration is needed** — #212 already created `warehouse_doors` with `updated_at`, the
`(warehouse_id, LOWER(name))` unique index, the `name = TRIM(name)` / `LENGTH(name) > 0` CHECKs, and
the coordinate range CHECKs. **No new geometry module is needed** — `containsPoint` (API) and
`isInsideFootprint` (web) already exist and are unit-tested from #209. **No new shared component is
needed** — `PendingPlacementMarker`, `useCoordinateFields`, `CoordinateField`,
`WarehouseDoorPlacementLayer`, and `ResourceRowActions` are all consumed as they stand, the last
with one prop relaxed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an
  incomplete task in the same phase.
- **[Story]**: Maps a task to its user story from `spec.md`.

---

## Phase 1: Setup

**Purpose**: Widen the warehouses route's URL contract to carry the second update mode.

- [X] T001 Widen `edit` from `z.literal('warehouse')` to `z.enum(['warehouse', 'door']).optional().catch(undefined)` in `warehouseSearchSchema` in `apps/web/src/routes/_authenticated/warehouses.tsx`, leaving every other param untouched, and record in the existing comment that `edit=door` is honoured only alongside a `warehouseId` naming an available warehouse and a `doorId` naming an available door of it (`contracts/warehouse-door-update-ui-state.md` §"URL contract", `research.md` R9)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the error vocabulary, the repository contract, the DTO field, the typed mutation,
the relaxed row-menu prop, and the web test seams — everything more than one user story depends on,
and everything #215–#216 will reach for rather than fork.

**⚠️ CRITICAL**: No user story implementation starts until this phase is complete.

- [X] T002 [P] Add `WarehouseDoorNotFoundException` (404, `E_WAREHOUSE_DOOR_NOT_FOUND`, "Warehouse door not found") and `ArchivedWarehouseDoorReadOnlyException` (409, `E_WAREHOUSE_DOOR_ARCHIVED`, "Archived warehouse doors are read-only. Reactivate the door first.") to `apps/api/app/warehouse_doors/shared/warehouse_door_exceptions.ts`, following the shape of `ArchivedDockReadOnlyException` and `ArchivedWarehouseReadOnlyException`. Do **not** add door-flavoured duplicates of `E_WAREHOUSE_NOT_FOUND` or `E_WAREHOUSE_ARCHIVED` — those stay reused for the containing warehouse, and extend the file's existing header comment to say so (`research.md` R6, `contracts/warehouse-doors-update.openapi.yaml`)
- [X] T003 [P] Add a failing assertion for `updatedAt` to the transformer coverage in `apps/api/tests/integration/warehouse_doors/consultation/available.spec.ts` (corrected during implementation from the unit spec, which stubs the repository and never serializes a door), proving the field is absent today beside the `createdAt` #213 added (`research.md` R5)
- [X] T004 Add `updatedAt` to the picked fields in `apps/api/app/warehouse_doors/shared/warehouse_door_transformer.ts`, leaving the door objects embedded by `WarehouseTransformer` untouched so #212's read contract does not change — depends on T003 (`research.md` R5)
- [X] T005 [P] Add `UpdateWarehouseDoorCommand` (`{ id, name?, latitude?, longitude?, contains?: (points: WarehouseFootprintPoint[]) => boolean }`), `UpdateWarehouseDoorResult` (`UPDATED` | `DOOR_NOT_FOUND` | `DOOR_ARCHIVED` | `WAREHOUSE_NOT_FOUND` | `WAREHOUSE_ARCHIVED` | `OUTSIDE_FOOTPRINT` | `DUPLICATE_NAME`), and the abstract `updateAvailable` method to `apps/api/app/warehouse_doors/shared/repositories/warehouse_door_repository.ts`, reusing the `contains` callback shape `CreateWarehouseDoorCommand` already declares and documenting that `contains` is absent on a name-only update (`data-model.md` §"Repository contract", `research.md` R2, R3)
- [X] T006 [P] Make `renderDialog` optional in `apps/web/src/components/lifecycle/resource-row-actions.tsx` — `renderDialog?: (props: { action: LifecycleAction; onClose: () => void }) => ReactNode` — and guard its single call site with `renderDialog?.(...)`, adding a comment that a resource whose lifecycle slices are not delivered yet has no dialog to render. The three existing consumers (`truck-row-actions.tsx`, `customer-row-actions.tsx`, `transport-company-row-actions.tsx`) keep passing it unchanged (`research.md` R10)
- [X] T007 [P] Add an `update` mutation to `apps/web/src/features/warehouse-doors/mutations/use-warehouse-door-mutations.ts` built from `tuyauQuery.warehouseDoors.update.mutationOptions({ onSuccess })`, invalidating `warehouseQueries.list()` exactly as the existing `create` mutation does, and return it beside `create`
- [X] T008 [P] Extend `apps/web/src/features/warehouses/__tests__/support/handlers.ts` with `updateWarehouseDoorHandler(updated)` (200), `updateWarehouseDoorConflictHandler()` (409 `E_WAREHOUSE_DOOR_NAME_CONFLICT`), `updateWarehouseDoorOutsideFootprintHandler()` (422 `E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT`), `updateWarehouseDoorArchivedHandler()` (409 `E_WAREHOUSE_DOOR_ARCHIVED`), `updateWarehouseDoorNotFoundHandler()` (404 `E_WAREHOUSE_DOOR_NOT_FOUND`), and a network-failure variant; add an updated-door fixture to `apps/web/src/features/warehouses/__tests__/support/fixtures.ts` beside the existing created-door fixture
- [X] T009 [P] Extend `apps/web/src/features/warehouses/__tests__/support/mock-warehouse-map.tsx` with a door-**edit** seam beside the existing `doorPlacement` one: a "Simulate dragging the door being edited" button reporting the next `MOCK_CLICK_POINTS` entry through `doorPlacement.onMove`, a rendered draft marker labelled with the door's name when `doorPlacement.pending` is set and `armed` is false, and an assertion surface for which door ids the marker layer received — keeping every existing affordance unchanged (`research.md` R7)

**Checkpoint**: The error codes, repository contract, DTO field, typed mutation, relaxed row-menu
prop, MSW handlers, and map test seam all exist. User story implementation can now begin.

---

## Phase 3: User Story 1 - Correct an Available Door's Name and Position (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator opens `Edit` from a door row's action menu, corrects the name,
drags the marker or types coordinates, and saves — the name, the position, or both are applied
atomically while identity, containing warehouse, status, and creation time are preserved.

**Independent Test**: Sign in as an authorized administrator, open an available warehouse, choose
`Edit` in one of its available door rows' menus, rename it, drag its marker inside the footprint, and
save; verify the door is shown under its new name at its new coordinates with the same identity,
containing warehouse, Available status, and creation time (`spec.md` US1).

### Tests for User Story 1 (write and observe RED first)

- [X] T010 [P] [US1] Add a failing API integration test for the happy paths in `apps/api/tests/integration/warehouse_doors/update/update.spec.ts`: an authenticated administrator PATCHes `/api/v1/warehouse-doors/:id` with a name only, a position only, both together, and a no-op resubmission of the current values; each returns 200 with the corrected values, an advanced `updatedAt`, and an unchanged `id`, `warehouseId`, `status`, and `createdAt`; the persisted `warehouse_doors` row matches (`quickstart.md` scenarios 10–13; FR-004, FR-011, FR-014)
- [X] T011 [P] [US1] Add failing API unit tests for `UpdateWarehouseDoorUseCase` in `apps/api/tests/unit/warehouse_doors/update/update.spec.ts` against a repository swapped through `app.container.swap` (as `tests/unit/warehouse_doors/creation/create.spec.ts` does): the name reaches the repository trimmed, the coordinates pass through untouched, a `contains` predicate **is** supplied when a position is submitted and **is not** when only a name is, and neither `warehouseId` nor `status` is ever part of the command (`research.md` R3, `data-model.md`)
- [X] T012 [P] [US1] Add a failing web entry test in `apps/web/src/features/warehouse-doors/__tests__/update/entry.test.tsx`: each available door row of an available warehouse hosts a menu trigger labelled `Actions for <door name>` containing exactly one item, `Edit`; choosing it navigates to `edit=door` while setting `warehouseId` and `doorId` in the same step, even when no door was selected beforehand; the panel opens titled "Edit door" (`quickstart.md` scenarios 1, 2b, 3; `contracts/warehouse-door-update-ui-state.md` §"Entry point")
- [X] T013 [P] [US1] Add a failing web session test in `apps/web/src/features/warehouse-doors/__tests__/update/session.test.tsx`: the panel is pre-filled with the door's name and coordinates; "Position modified" and "Restore original position" appear once the draft moves and restore the **snapshotted** origin, not a refetched one; a background refetch changing the door does not end the session or alter the origin; cancelling and dismissing the sheet both leave the stored door untouched and return the marker to its stored coordinates; changing the selected warehouse discards the session (`quickstart.md` scenarios 7, 23; FR-025, `data-model.md` §"WarehouseDoorEditSession")
- [X] T014 [P] [US1] Add a failing web reposition test in `apps/web/src/features/warehouse-doors/__tests__/update/reposition.test.tsx`: the door under edit is represented by a single labelled draft marker and its ordinary marker is absent from the layer while the other doors stay rendered; dragging the draft updates the coordinate fields; typing both coordinate fields moves the draft; a click on empty map, on a warehouse polygon, and on another door's marker selects nothing, opens nothing, and does **not** move the draft (`quickstart.md` scenarios 4–6, 8; FR-005a, FR-006, `research.md` R7)

### Implementation for User Story 1

- [X] T015 [P] [US1] Add `update(user)` to `apps/api/app/warehouse_doors/shared/warehouse_door_policy.ts`, returning true for `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, mirroring the existing `create` ability
- [X] T016 [P] [US1] Add `updateWarehouseDoorValidator` to `apps/api/app/warehouse_doors/shared/warehouse_door_validator.ts`: `name` via `nonBlank()` 1–255 `.optional().requiredWhen(hasOwn).requiredIfMissing(['latitude', 'longitude'])`, `latitude` a number in [-90, 90] `.optional().requiredWhen(hasOwn).requiredIfExists('longitude')`, `longitude` a number in [-180, 180] `.optional().requiredWhen(hasOwn).requiredIfExists('latitude')` — so an empty body and a lone coordinate are both 422, and a position is always submitted whole. Deliberately **not** the `updateDockValidator` shape, which leaves the coordinates untied (`research.md` R1, `contracts/warehouse-doors-update.openapi.yaml`)
- [X] T017 [US1] Implement `updateAvailable` in `apps/api/app/warehouse_doors/shared/repositories/lucid_warehouse_door_repository.ts`: short-circuit a non-UUID `id` to `DOOR_NOT_FOUND` via `#shared/database/is_uuid`; pre-read the door unlocked to learn its permanent `warehouse_id`; inside one transaction select the warehouse `.where('status', 'AVAILABLE').forUpdate()` with `footprintPoints` preloaded in `position` order — **warehouse first**, the lock order `create` and #210's cascade already take — evaluate `command.contains` when present, then update the door `.where('id', ...).where('status', 'AVAILABLE')` with the submitted values plus `updatedAt: DateTime.now().toSQL({ includeOffset: false })`; return the seven result arms, distinguishing `WAREHOUSE_NOT_FOUND` from `WAREHOUSE_ARCHIVED` and `DOOR_NOT_FOUND` from `DOOR_ARCHIVED` with follow-up reads, and mapping a unique violation through `#shared/database/is_unique_violation` to `DUPLICATE_NAME` — depends on T005 (`research.md` R2, R4, R5; `data-model.md`)
- [X] T018 [US1] Implement `apps/api/app/warehouse_doors/update/update_warehouse_door_use_case.ts`: `normalizeSiteReferenceName` then length check when a name is present, `isLegalSiteReferenceLatitude`/`Longitude` when coordinates are present, then `repository.updateAvailable` passing `contains: (points) => containsPoint(points, { latitude, longitude })` from `#warehouses/shared/footprint_geometry` **only when a position was submitted**, returning the door on `UPDATED` — depends on T002, T017 (`research.md` R3)
- [X] T019 [US1] Add `update` to `apps/api/app/controllers/warehouse_doors_controller.ts` (`bouncer.with(WarehouseDoorPolicy).authorize('update')` → `request.validateUsing(updateWarehouseDoorValidator)` → use case with `id: params.id` → `serialize(WarehouseDoorTransformer.transform(door))`, 200) and register `router.patch('/:id', [controllers.WarehouseDoors, 'update']).as('update')` in the `/warehouse-doors` group of `apps/api/start/routes.ts`, declared after `/available` so that path never resolves as `:id` — depends on T004, T015, T016, T018 (`research.md` R1)
- [X] T020 [P] [US1] Implement `apps/web/src/features/warehouse-doors/use-warehouse-door-edit-session.ts` mirroring `apps/web/src/features/checkpoints/use-checkpoint-edit-session.ts`: snapshot `warehouseId`, `doorId`, `editable` (the door is `AVAILABLE` **and** its warehouse is `AVAILABLE`), `originName`, and `origin` once when the session opens; never re-derive them from live query data; expose `draft`, `setDraft`, `restoreOrigin`, and `clear`; discard the session whenever the selection changes identity or goes away (`research.md` R8, `data-model.md` §"WarehouseDoorEditSession")
- [X] T021 [P] [US1] Implement `apps/web/src/features/warehouse-doors/ui/edit-warehouse-door-panel.tsx`: a "Back to details" action, a sheet titled "Edit door" naming the door, a required name field pre-filled from `originName`, a `useCoordinateFields` + `CoordinateField` pair bound to the draft as the keyboard-only path, a "Position modified" / "Restore original position" row shown once the draft differs from `origin`, and a "Save changes" / "Saving…" submit with a cancel beside it — modelled on `apps/web/src/features/checkpoints/ui/edit-checkpoint-panel.tsx` and reusing the shared primitives **unmodified**. Submitting unchanged values must stay enabled (`contracts/warehouse-door-update-ui-state.md` §"Panel state", `research.md` R7)
- [X] T022 [P] [US1] Create `apps/web/src/features/warehouse-doors/ui/warehouse-door-row-actions.tsx` wrapping `ResourceRowActions`, modelled on `apps/web/src/features/trucks/ui/truck-row-actions.tsx`: `actions={[]}` because #214 delivers no lifecycle transition, `editable` from the door's and its warehouse's status, `name={door.name}`, `onEdit` calling back with the door id, and **no** `renderDialog` — depends on T006 (`research.md` R10)
- [X] T023 [US1] Host the menu in `apps/web/src/features/warehouse-doors/ui/warehouse-doors-panel.tsx`: turn each `<li key={door.id}>` into a `<li className="flex items-center gap-1">` holding the existing row `<button>` (given `min-w-0 flex-1`) plus `<WarehouseDoorRowActions>` as a sibling, exactly as `apps/web/src/features/trucks/ui/truck-list.tsx` does; accept an optional `onEditDoor` prop and pass the containing warehouse's status through — depends on T022 (`contracts/warehouse-door-update-ui-state.md` §"Entry point")
- [X] T024 [US1] Extend `apps/web/src/features/warehouses/map/warehouse-map.tsx`: add `label` to `WarehouseMapDoorPlacement` and pass it to `PendingPlacementMarker` in `WarehouseDoorPlacementLayer` (defaulting to "New door" so #213 is unaffected); accept the id of a door under edit and filter it out of the rendered marker layer; widen `suppressesSelection` from `doorPlacement?.armed` to `doorPlacement !== undefined` so an unarmed edit session still suppresses selection, while leaving `isArmed` — which suppresses `FitWarehouseBounds` — computed from the polygon `placement` and `editing` props only (`research.md` R7)
- [X] T025 [US1] Wire the mode in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`: derive `isEditingDoor` from `edit === 'door'`, `create === undefined`, `canManageWarehouses`, a present `AVAILABLE` warehouse, and an admitted `AVAILABLE` door; consume `useWarehouseDoorEditSession`; pass `onEditDoor` to `WarehouseDoorsPanel` and `doorPlacement={{ armed: false, pending: draft, onPlace: setDraft, onMove: setDraft, label: door.name }}` plus the edited door id to `WarehouseMap`; render `EditWarehouseDoorPanel` in the sheet in place of the details while the session is active; ensure the sheet's `onOpenChange` and the existing creation entry points end the session without saving; on success invalidate the list, toast "Door updated", and navigate to `{ edit: undefined }` keeping `warehouseId`, `doorId`, `doorStatus`, `status`, and `search` — depends on T007, T020, T021, T023, T024 (`research.md` R9, R11; FR-005b, FR-020)

**Checkpoint**: An administrator can correct a door's name and position end to end, and the corrected
door stays selected under its warehouse. User Story 1 is independently demonstrable.

---

## Phase 4: User Story 2 - Be Prevented From Saving Invalid, Duplicate, or Misplaced Values (Priority: P2)

**Goal**: Every blank, over-long, duplicate, out-of-range, or out-of-footprint submission is refused
with a clear, specific message, the stored door is untouched, and the administrator keeps their
entered name and draft position.

**Independent Test**: On an available door, attempt in turn a blank name, an over-long name, a name
already used by another door of the same warehouse, an out-of-range coordinate, a non-numeric
coordinate, and a position outside the footprint; verify each is refused with a distinct message
against the field concerned, the stored door is unchanged, and nothing entered is lost (`spec.md` US2).

### Tests for User Story 2 (write and observe RED first)

- [X] T026 [P] [US2] Extend `apps/api/tests/integration/warehouse_doors/update/update.spec.ts` with the rejection matrix: 422 for a blank/whitespace-only name, a name over 255 characters, an out-of-range coordinate, a lone coordinate without its pair, an empty body, and a position outside the containing footprint; 409 for a name duplicating **another** door of that warehouse, including a cross-case and a trimmed-whitespace variant and a name held by an **archived** door of that warehouse; 200 for a name already used by a door of a **different** warehouse and for a case-only change to the door's own name; and no column changed on any rejection (`quickstart.md` scenarios 14–22; FR-007 to FR-013, FR-011a)
- [X] T027 [P] [US2] Extend `apps/api/tests/unit/warehouse_doors/update/update.spec.ts` with the mapping of each repository result arm to its exception — `DUPLICATE_NAME` → `DuplicateWarehouseDoorNameException`, `OUTSIDE_FOOTPRINT` → `WarehouseDoorOutsideFootprintException` — plus the use case's own name and coordinate assertions (`data-model.md` §"Domain rules applied on update")
- [X] T028 [P] [US2] Add a failing web validation test in `apps/web/src/features/warehouse-doors/__tests__/update/validation.test.tsx`: a blank name shows a field error; a 409 conflict shows a field error on the name; a draft outside the footprint is refused client-side with an inline message and the submit disabled; a 422 `E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT` shows a form-level error; an out-of-range coordinate shows a field error; and after **every** rejection the entered name and the draft position both remain and the session stays open (`quickstart.md` scenarios 16, 17, 20, 22; FR-018, FR-024)

### Implementation for User Story 2

- [X] T029 [US2] Complete the name and coordinate assertions in `apps/api/app/warehouse_doors/update/update_warehouse_door_use_case.ts` — a trimmed-empty or over-length name raises `InvalidWarehouseDoorNameException`, a non-finite or out-of-range coordinate raises `InvalidWarehouseDoorCoordinatesException` — and map `OUTSIDE_FOOTPRINT` to `WarehouseDoorOutsideFootprintException` and `DUPLICATE_NAME` to `DuplicateWarehouseDoorNameException` — depends on T018, T027
- [X] T030 [US2] Confirm in `apps/api/app/warehouse_doors/shared/repositories/lucid_warehouse_door_repository.ts` that the containment predicate is evaluated **inside** the transaction against the locked footprint, that the door update is skipped entirely when it fails, and that no containment check runs when `contains` is absent — depends on T017 (`research.md` R2, R3)
- [X] T031 [US2] Map the API error codes in `apps/web/src/features/warehouse-doors/ui/edit-warehouse-door-panel.tsx`: `applyValidationError` first, then `E_WAREHOUSE_DOOR_NAME_CONFLICT` and `E_WAREHOUSE_DOOR_NAME_INVALID` onto the name field, `E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT`, `E_WAREHOUSE_DOOR_COORDINATES_INVALID`, `E_WAREHOUSE_DOOR_ARCHIVED`, and `E_WAREHOUSE_ARCHIVED` as form-level errors, `E_WAREHOUSE_DOOR_NOT_FOUND` and `E_WAREHOUSE_NOT_FOUND` through an `onNotFound` callback, anything else as a toast — never clearing the entered name or the draft — following `create-warehouse-door-panel.tsx` — depends on T021 (`contracts/warehouse-door-update-ui-state.md` §"Feedback")
- [X] T032 [US2] Add the client containment guard to `apps/web/src/features/warehouse-doors/ui/edit-warehouse-door-panel.tsx`, calling `isInsideFootprint` from `@/features/warehouses/geometry/footprint-validation` against the containing warehouse's footprint to disable submit and show an inline message — feedback only, the API stays authoritative — depends on T021 (`plan.md` §"Complexity Tracking")

**Checkpoint**: Every invalid, duplicate, or misplaced submission is refused clearly and recoverably,
with nothing stored and nothing lost.

---

## Phase 5: User Story 3 - Be Blocked From Updating What Must Not Change (Priority: P3)

**Goal**: Unauthenticated, inactive, and unpermitted users cannot update a door; archived doors,
doors of archived warehouses, and doors that do not exist are refused; and the containing warehouse,
lifecycle status, and creation time stay unreachable — through the interface or directly against the
endpoint.

**Independent Test**: Attempt an update as an unauthenticated visitor, an inactive user, an active
user without permission, on an archived door, on a door of an archived warehouse, on a door
identifier that does not exist, and with a payload carrying another warehouse or status; verify each
is refused with the appropriate outcome and no door data changes (`spec.md` US3).

### Tests for User Story 3 (write and observe RED first)

- [X] T033 [P] [US3] Extend `apps/api/tests/unit/warehouse_doors/warehouse_door_policy.spec.ts` to cover the `update` ability for both administrator roles, refusing every other role and every non-active access status, beside the existing `create` coverage
- [X] T034 [P] [US3] Extend `apps/api/tests/integration/warehouse_doors/update/update.spec.ts` with 401 for no session, 403 for an active non-administrator, 404 `E_WAREHOUSE_DOOR_NOT_FOUND` for an unknown **and** for a malformed door id (never a 500), 409 `E_WAREHOUSE_DOOR_ARCHIVED` for an archived door, 409 `E_WAREHOUSE_ARCHIVED` for a door of an archived warehouse, and a 200 whose `warehouseId`, `status`, and `createdAt` are unchanged when the payload also carries those members — with no column written in any refusal (`quickstart.md` scenario 2 and the direct API checks; FR-002, FR-003, FR-015, FR-016, FR-017)
- [X] T035 [P] [US3] Add a failing web permissions test in `apps/web/src/features/warehouse-doors/__tests__/update/permissions.test.tsx`: no row menu is rendered at all for a non-administrator, for an archived door, or under an archived warehouse — not a menu with a dead item; `?edit=door&warehouseId=<id>&doorId=<id>` renders ordinary consultation with no panel and no draft marker when the permission is missing, when either id is absent or unknown, when the door is archived, when the warehouse is archived, or when a creation mode is armed (`quickstart.md` scenarios 1, 2; FR-005b, `contracts/warehouse-door-update-ui-state.md` §"Entry point")

### Implementation for User Story 3

- [X] T036 [US3] Map the lifecycle and existence arms in `apps/api/app/warehouse_doors/update/update_warehouse_door_use_case.ts`: `DOOR_NOT_FOUND` → `WarehouseDoorNotFoundException`, `DOOR_ARCHIVED` → `ArchivedWarehouseDoorReadOnlyException`, `WAREHOUSE_NOT_FOUND` → `WarehouseNotFoundException` and `WAREHOUSE_ARCHIVED` → `ArchivedWarehouseReadOnlyException` — the last two imported from `#warehouses/shared/warehouse_exceptions` rather than redeclared — depends on T018 (`research.md` R6)
- [X] T037 [US3] Gate the row menu in `apps/web/src/features/warehouse-doors/ui/warehouse-door-row-actions.tsx` and `warehouse-doors-panel.tsx` so `editable` is true only for an `AVAILABLE` door under an `AVAILABLE` warehouse, and so the whole menu is omitted for a non-administrator — relying on `ResourceRowActions` returning `null` when it has nothing to offer rather than rendering a disabled item — depends on T022, T023 (`research.md` R10)
- [X] T038 [US3] Make `edit=door` inert and self-cleaning in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`: render ordinary consultation whenever the permission is missing, `create` is set, or `warehouseId`/`doorId` do not resolve to a present `AVAILABLE` warehouse and an admitted `AVAILABLE` door; and drop the param with `replace: true` as soon as the selection goes away or becomes non-editable, mirroring the existing `create === 'door'` hygiene effects — depends on T025 (`research.md` R9, `contracts/warehouse-door-update-ui-state.md` §"URL contract")

**Checkpoint**: Authorization, lifecycle, and immutability hold on both sides, and the interface never
offers an action the API would refuse.

---

## Phase 6: User Story 4 - Recover From Failed Submissions (Priority: P3)

**Goal**: A connectivity or server failure leaves the door exactly as it was, reports itself clearly,
keeps the administrator's entered name and draft position, and lets a retry apply the correction
exactly once — as does a race between two administrators claiming one name.

**Independent Test**: Save a valid change while the API fails, verify a clear retryable message with
the name and draft preserved and the stored door unchanged; resolve the failure, retry, and verify
the correction was applied exactly once (`spec.md` US4).

### Tests for User Story 4 (write and observe RED first)

- [X] T039 [P] [US4] Add a failing concurrency test to `apps/api/tests/integration/warehouse_doors/update/update.spec.ts`: two near-simultaneous PATCHes renaming **two different doors of the same warehouse** to the same trimmed name yield exactly one 200 and one 409 `E_WAREHOUSE_DOOR_NAME_CONFLICT`, with only one door carrying that name afterwards (`quickstart.md` direct API checks; FR-019)
- [X] T040 [P] [US4] Extend `apps/web/src/features/warehouse-doors/__tests__/update/validation.test.tsx` with the failure path: a network or 500 failure shows an "Unable to update door" toast, leaves the stored door unchanged, and preserves the entered name and draft position; a retry after the handler recovers applies the correction exactly once and keeps the door selected (`quickstart.md` scenario 25; FR-018)

### Implementation for User Story 4

- [X] T041 [US4] Verify and, if needed, correct `apps/api/app/warehouse_doors/shared/repositories/lucid_warehouse_door_repository.ts` so every non-`UPDATED` arm leaves the transaction with no column written — never a door renamed without being moved, or moved without being renamed — and so the `DUPLICATE_NAME` arm relies on the unique index rather than a pre-read, which is what makes the race resolve to exactly one winner and a self-rename succeed without a self-exclusion clause — depends on T017, T039 (`research.md` R4, `data-model.md`)
- [X] T042 [US4] Ensure the generic failure branch in `apps/web/src/features/warehouse-doors/ui/edit-warehouse-door-panel.tsx` toasts without resetting the form, clearing the draft, or closing the session, so a retry re-sends the same submission — depends on T031 (`contracts/warehouse-door-update-ui-state.md` §"Feedback")

**Checkpoint**: All four user stories are independently functional, and no failure path can
half-apply a correction or lose the administrator's work.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T043 [P] Update the #214 row in `specs/site-references/storage-facilities/warehouse-doors/roadmap.md` if its status has moved since `/speckit-specify` set it to `in progress` — verified: it already reads `in progress` with `update-a-warehouse-door/spec.md`, which stays accurate until the PR merges
- [X] T044 [P] Run the regression guard from `quickstart.md`: under `apps/web/src/features/`, the suites `warehouse-doors/__tests__/{consultation,feedback,markers}.test.tsx`, `warehouse-doors/__tests__/create/*`, `warehouses/__tests__/{consultation,warehouses-page,warehouse-map}.test.tsx`, `warehouses/__tests__/update/*`, and — because T006 relaxed a shared prop — `trucks/__tests__/*`, `customers/__tests__/*`, and `transport-companies/__tests__/*` must all pass unchanged in substance
- [X] T045 [P] Verify the delivered payloads match `contracts/warehouse-doors-update.openapi.yaml` field for field — request shape in `apps/api/app/warehouse_doors/shared/warehouse_door_validator.ts`, response shape from `apps/api/app/warehouse_doors/shared/warehouse_door_transformer.ts` — including the added `updatedAt`, the partial body's `anyOf`, and the paired `latitude`/`longitude`
- [X] T046 Run `pnpm check`, `pnpm typecheck`, `pnpm --filter @portflow/api test`, `pnpm --filter @portflow/web test`, and `pnpm test`, resolving every finding
- [X] T047 Walk `quickstart.md` scenarios 1–26 manually in the browser, including the keyboard-only repositioning path and the direct API checks (Constitution Principle VII) — walked against the seeded stack for scenarios 1, 2, 2b, 3, 7, 10, 17, 20 and the FR-027 menu boundary, each confirmed in the UI and, where it writes, in `warehouse_doors`. The remaining scenarios are covered by the automated suites (T010, T026, T034, T039 on the API; T012–T014, T028, T035, T040 on the web)
- [ ] T048 Obtain a fresh read-only review of the final diff and resolve or explicitly justify every confirmed finding (Constitution Principle VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all user stories.**
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on US2, US3, or US4.
- **User Story 2 (Phase 4)**: Depends on Foundational. Extends US1's use case, repository, and panel,
  so it is sequenced after US1 in a single-developer flow; its API rejection tests (T026, T027) can
  be written as soon as T019 exists.
- **User Story 3 (Phase 5)**: Depends on Foundational. Its policy test (T033) needs only T015; its
  integration test needs T019; its client gating needs US1's row menu (T022, T023) and page wiring
  (T025).
- **User Story 4 (Phase 6)**: Depends on US1 for the write path and on US2's panel error handling
  (T031) for its generic-failure branch.
- **Polish (Phase 7)**: Depends on all delivered stories.

### Within Each Story

- Every test task is written and observed failing before its implementation task.
- API: policy and validator → repository contract → repository implementation → use case →
  controller and route.
- Web: session hook and panel → row-actions wrapper → doors panel → map layer → page wiring →
  permission gate.

### Critical Path

T001 → T005 → T017 → T018 → T019 → T025 → T029 → T036 → T038

### Parallel Opportunities

- **Phase 2**: T002, T003, T005, T006, T007, T008, T009 all touch different files and start together;
  T004 unblocks as soon as T003 is RED.
- **Phase 3 tests**: T010, T011, T012, T013, T014 are five different files and run together.
- **Phase 3 implementation**: T015, T016, T020, T021 are independent of one another; the repository →
  use case → controller chain (T017 → T018 → T019) is strictly sequential, and T022 → T023 → T025
  follows the panel, with T024 independent until T025.
- **Phase 4 tests**: T026, T027, T028 run together.
- **Phase 5 tests**: T033, T034, T035 run together.
- **Phase 6 tests**: T039 and T040 run together.
- **Cross-workspace**: the whole `apps/api` chain and the whole `apps/web` chain of a given story can
  proceed in parallel by two developers once Phase 2 is done — the MSW handlers (T008) let the web
  side progress before the endpoint exists.

---

## Parallel Example: User Story 1

```bash
# Launch the five RED test tasks together:
Task: "API integration happy paths in apps/api/tests/integration/warehouse_doors/update/update.spec.ts"
Task: "API use case units in apps/api/tests/unit/warehouse_doors/update/update.spec.ts"
Task: "Web entry test in apps/web/src/features/warehouse-doors/__tests__/update/entry.test.tsx"
Task: "Web session test in apps/web/src/features/warehouse-doors/__tests__/update/session.test.tsx"
Task: "Web reposition test in apps/web/src/features/warehouse-doors/__tests__/update/reposition.test.tsx"

# Then the independent implementation tasks:
Task: "Add update() to apps/api/app/warehouse_doors/shared/warehouse_door_policy.ts"
Task: "Add updateWarehouseDoorValidator in apps/api/app/warehouse_doors/shared/warehouse_door_validator.ts"
Task: "Implement apps/web/src/features/warehouse-doors/use-warehouse-door-edit-session.ts"
Task: "Implement apps/web/src/features/warehouse-doors/ui/edit-warehouse-door-panel.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 User Story 1.
4. **STOP and VALIDATE**: `quickstart.md` scenarios 3–13 pass. An administrator can rename and move
   a door, and the corrected door stays selected under its warehouse.
5. Demo-able: the roadmap's core outcome for #214 is met, though rejections still surface raw API
   errors and the menu is not yet gated client-side.

### Incremental Delivery

1. Setup + Foundational → error codes, repository contract, mutation, relaxed row-menu prop, and test
   seams ready.
2. Add User Story 1 → test independently → demo (MVP).
3. Add User Story 2 → every rejection is clear and recoverable.
4. Add User Story 3 → authorization, lifecycle, and immutability hold on both sides.
5. Add User Story 4 → failures and races cannot half-apply or lose anything.
6. Polish → regression guard, full suite, manual walk, fresh review.

### Notes

- `[P]` tasks touch different files and carry no dependency on an incomplete task in the same phase.
- No migration, no new geometry module, and no new shared component: T017's locked read reuses
  `containsPoint`, T021 reuses `useCoordinateFields` and `CoordinateField` unmodified, T024 reuses
  `PendingPlacementMarker` through the existing `WarehouseDoorPlacementLayer`, and T022 reuses
  `ResourceRowActions` with a single prop relaxed by T006.
- T022 and T023 deliberately choose the **container** #215 and #216 will fill with `Archive` and
  `Reactivate`; this slice ships an empty `actions` array and no lifecycle dialog, so FR-027 holds.
- Commit after each task or logical group, using Conventional Commits on
  `feat/214-update-warehouse-door`.
- Stop at any checkpoint to validate a story independently.
