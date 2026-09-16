---
description: "Task list for Plan Warehouse Door and Checkpoint Assignments (GH-54)"
---

# Tasks: Plan Warehouse Door and Checkpoint Assignments

**Input**: Design documents from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/plan-warehouse-door-and-checkpoint-assignments/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required. Constitution IV mandates RED → GREEN → REFACTOR for business behavior, and
`apps/api/AGENTS.md` and `apps/web/AGENTS.md` name the test seams each layer must have. Write each
test task first and confirm it fails for the expected reason before starting its implementation task.

**Organization**: Tasks are grouped by user story so that each story can be implemented and tested on
its own:
- US1 assigns and withdraws a lot's warehouse doors.
- US2 selects a planned shift's warehouse doors and weighing areas.
- US3 makes every refusal precise, and closes the races with archives.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `[US1]`–`[US3]`, mapping to the user stories in `spec.md`

## Path Conventions

This is a PNPM/Turbo monorepo with `apps/api/` (AdonisJS) and `apps/web/` (TanStack Start). All paths
below are relative to the repository root.

`#discharges/*`, `#weighing_areas/*`, `#warehouse_doors/*`, `#models/*`, `#shared/*`,
`#database/factories/*`, and `#generated/controllers` are existing API import aliases. `@/…` is the
web source alias.

API conventions, as GH-53 established them:
- **Use cases**: `@inject()` classes with an explicit `<UseCase>Input` type. They own the
  `db.transaction`, start with `lockPlannedDischarge` from
  `#discharges/shared/planned_discharge_guard`, and read the detail with
  `DischargeRepository.findDetail` after the transaction commits.
- **Repositories**: they return typed outcomes (`{ kind: … }`) and never throw HTTP exceptions. Row
  identities go through `lockableIds` (distinct, lower-case, sorted) before any lock. Share locks use
  `query.knexQuery.forShare()`.
- **Refusals of chosen values**: collect `PreparationIssue`s and call `throwPreparationIssues` from
  `#discharges/shared/discharge_preparation_issues`.
- **Controllers**: authorize with `bouncer.with(DischargePolicy).authorize('update')`, validate, call
  the use case, and return `serialize(DischargeDetailTransformer.transform(discharge))`.
- **Integration tests**: `testUtils.db().wrapInGlobalTransaction()`, then the order 401, 403, success
  per role, then endpoint-specific failures, each asserting nothing changed. Reuse and extend
  `apps/api/tests/integration/discharges/preparation/preparation_scenario.ts`.

Web conventions:
- Feature tests render through the real router with MSW (`renderDischargeDetail` from
  `features/discharges/__tests__/support/test-helpers.ts`) and never mock the Tuyau client.
- Copy comes from `@/helpers/resource-copy`.
- Forms use `useAppForm`, the registered fields, `FormError`, and `SubmitButton`.
- Sheets follow `features/discharges/ui/detail/product-lot-sheet.tsx`: `Sheet` at `size="lg"`, the
  form mounted only while open.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Start from a known-green baseline, so that every later red test is red because of this
slice.

- [X] T001 Run `pnpm --filter @portflow/api test` and `pnpm --dir apps/web exec vitest run` on the branch before any change, and note in the PR description that both pass. If either fails, stop and report instead of proceeding.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the pieces every story shares:
- **API**: the current-row indexes, the new exceptions and issues, the recorded-instant rule, the
  planning reads and writes on the preparation repository, and the options query.
- **Web**: the options query and its test fixtures, the pure view module's read helpers, the
  checkbox group field, and the `canCorrect` wiring of the shifts card.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for the shared pieces ⚠️

> Write these first and confirm they fail.

- [X] T002 [P] Create `apps/api/tests/unit/discharges/planning/rules.spec.ts` with a `recordedInstant(now, latestRecorded)` group, against T008. It asserts:
  - With `latestRecorded` null, it returns `now` truncated to the second, in UTC.
  - With `latestRecorded` before that second, it returns `now` truncated to the second.
  - With `latestRecorded` equal to that second, or one second after it, it returns `latestRecorded` plus one second.
- [X] T003 [P] Create `apps/api/tests/integration/discharges/planning/current_row_indexes.spec.ts`, against T006. Using factories only (`WarehouseDoorProductLotAssignmentFactory`, `ShiftWarehouseDoorFactory`, `ShiftWeighingAreaFactory`), it asserts:
  - A second row with `effectiveTo: null` for the same `(dischargeId, warehouseDoorId)` is rejected by the database, even on another lot of the same discharge.
  - The same door current in two different discharges is accepted.
  - A new current row is accepted when the earlier row for the same door and discharge has an `effectiveTo`.
  - The same three cases hold for `(shiftId, warehouseDoorId)` on `shift_warehouse_doors` and for `(shiftId, weighingAreaId)` on `shift_weighing_areas`.
- [X] T004 [P] Create `apps/api/tests/integration/discharges/planning/planning_options.spec.ts`, against T011–T013, following `contracts/discharge-resource-planning.openapi.yaml`:
  - 401 unauthenticated and pending; 403 for an active observer.
  - 200 for each role in `PREPARING_ROLES`.
  - 404 `E_DISCHARGE_NOT_FOUND` for an unknown id and for `not-a-uuid`.
  - `warehouseDoors` holds available doors of available warehouses only. An archived door and every door of an archived warehouse are absent. Order is warehouse name, door name, id, compared case-insensitively.
  - Each door carries `warehouse: { id, name }`.
  - `otherDischargeAssignments` lists a door's current assignment in another planned and in another active discharge, as `{ discharge: { id, vesselName, status, expectedStartAt } }` ordered by `expectedStartAt`. It omits:
    - the requested discharge's own assignment;
    - an ended assignment;
    - an assignment in a closed discharge.
  - `weighingAreas` holds available areas only, as `{ id, name }`, ordered by name.
- [X] T005 [P] Create `apps/web/src/features/discharges/__tests__/discharge-planning-view.test.ts`, against T015. It uses `buildDischargeDetail`, `buildLot`, `buildShift`, and `buildDoorPeriod` from `__tests__/support/fixtures.ts` and asserts:
  - `currentDoorIds(lot)` returns only the doors of rows with `effectiveTo === null`.
  - `lotHoldingDoor(detail, doorId)` returns the lot with a current row for that door, and `null` when only ended rows exist.
  - `plannedShiftsSelectingDoor(detail, doorId)` returns planned shifts with a current door selection, ignoring ended selections and non-planned shifts.
  - `shiftDoorOptions(detail)` returns one entry per door currently assigned to a lot, as `{ id, name, warehouse, lot }`, ordered by warehouse name then door name, and is empty when no door is current.
  - `shiftSelectionNotice(periods, status)` returns:
    - `NONE_SELECTED` for no rows;
    - `NONE_CURRENTLY_SELECTED` for only ended rows on a planned or active discharge;
    - `null` when a row is current, and `null` on a closed discharge.

### API implementation

- [X] T006 Create `apps/api/database/migrations/1786200000000_add_current_planning_unique_indexes.ts`. Its `up` runs three raw `CREATE UNIQUE INDEX … WHERE effective_to IS NULL` statements through `this.defer(async (db) => db.rawQuery(...))` or `this.schema.raw(...)`, whichever the other raw migrations in the directory use:
  - `warehouse_door_product_lot_assignments_current_door_unique` on `warehouse_door_product_lot_assignments (discharge_id, warehouse_door_id)`;
  - `shift_warehouse_doors_current_unique` on `shift_warehouse_doors (shift_id, warehouse_door_id)`;
  - `shift_weighing_areas_current_unique` on `shift_weighing_areas (shift_id, weighing_area_id)`.

  `down` drops all three. The doc comment explains that the discharge lock is the guarantee and these indexes are the backstop that also holds on SQLite, where row locks are ignored (research.md Decision 7). Run the API test suite's migrations and confirm T003 passes.
- [X] T007 [P] Update `apps/api/app/discharges/shared/discharge_exceptions.ts`:
  - Change `DischargeNotPlannedException.message` to `Only a planned discharge can be changed`.
  - Add `ShiftNotFoundException` (404, `E_SHIFT_NOT_FOUND`, `Shift not found`).
  - Add `ShiftNotPlannedException` (409, `E_SHIFT_NOT_PLANNED`, `Only a planned shift can be planned`).
  - Add `DischargePlanningConflictException` (409, `E_DISCHARGE_PLANNING_CONFLICT`, `This discharge changed meanwhile`).

  Run `rg "Only a planned discharge can be corrected" apps` and update any test that asserts the old message. The web asserts codes, not API messages.
- [X] T008 [P] Create `apps/api/app/discharges/shared/discharge_resource_planning_rules.ts`, exporting `recordedInstant(now: DateTime, latestRecorded: DateTime | null): DateTime`. It truncates `now` to the second in UTC, and returns `latestRecorded` plus one second when that is not before the result. The doc comment covers three points: one instant is shared by every row a command starts and ends, the adjustment keeps the period checks and the existing start index from failing, and seconds are the precision SQLite stores (research.md Decision 7). Makes T002 pass.
- [X] T009 [P] Add four issue builders to `apps/api/app/discharges/shared/discharge_preparation_issues.ts`, each returning a `PreparationIssue` for a given `field`:
  - `unavailableWarehouseDoorIssue(field)`: rule `availableWarehouseDoor`, message `This warehouse door is no longer available`.
  - `doorSelectedByPlannedShiftIssue(field)`: rule `selectedByPlannedShift`, message `This warehouse door is still selected for a planned shift`.
  - `unassignedWarehouseDoorIssue(field)`: rule `assignedWarehouseDoor`, message `This warehouse door is not assigned to a product lot of this discharge`.
  - `unavailableWeighingAreaIssue(field)`: rule `availableWeighingArea`, message `This weighing area is no longer available`.
- [X] T010 Extend `apps/api/app/discharges/shared/repositories/discharge_preparation_repository.ts` and `lucid_discharge_preparation_repository.ts`. First extend the class doc comment's lock order to: discharge, docks, customers, users, warehouses, warehouse doors, weighing areas (research.md Decision 5). Every new method takes a `TransactionClientContract`:
  - `listCurrentDoorAssignments(dischargeId, client)`: `Array<{ id, productLotId, warehouseDoorId, effectiveFrom }>` for rows with `effective_to IS NULL`.
  - `listShifts(dischargeId, client)`: `Array<{ id, status }>`.
  - `latestDoorAssignmentTime(dischargeId, client)` and `latestShiftSelectionTime(shiftId, client)`: the latest `effective_from` or `effective_to` over every row in scope, current or ended, as a `DateTime` or `null`.
  - `listCurrentShiftSelections(dischargeId, client)`: `{ warehouseDoors: Array<{ id, shiftId, warehouseDoorId, effectiveFrom }>, weighingAreas: Array<{ id, shiftId, weighingAreaId, effectiveFrom }> }`, joined through `shifts` on `discharge_id`, current rows only.
  - `lockWarehouseDoors(ids, client)`: `Map<string, { id, status, warehouseStatus }>`. It first loads the doors' `warehouse_id`s without a lock (containment is permanent), locks those warehouses `FOR SHARE` ordered by id, then locks the doors `FOR SHARE` ordered by id.
  - `lockWeighingAreas(ids, client)`: `Map<string, { id, status }>`, locked `FOR SHARE` ordered by id.
  - `endRows(table, ids, instant, client)`, with `table` one of `'DOOR_ASSIGNMENT' | 'SHIFT_DOOR' | 'SHIFT_AREA'`: one batched `UPDATE … SET effective_to, updated_at WHERE id IN (…) AND effective_to IS NULL`.
  - `startDoorAssignments(rows, instant, client)`, `startShiftDoors(rows, instant, client)`, and `startShiftAreas(rows, instant, client)`: one batched insert each, through the models `WarehouseDoorProductLotAssignment`, `ShiftWarehouseDoor`, and `ShiftWeighingArea`. Each returns `{ kind: 'WRITTEN' } | { kind: 'CURRENT_ROW_CONFLICT' }`. The conflict is detected by a new `isCurrentRowConflict(error)` beside `isDuplicateLotIdentity`: Postgres `23505` with one of T006's index names, or `SQLITE_CONSTRAINT_UNIQUE` whose message names one. Run the insert inside a savepoint, as `writeProductLot` does, so the transaction stays usable.

  Add a unit case to `apps/api/tests/unit/discharges/planning/rules.spec.ts`: `isCurrentRowConflict` recognizes both engines' errors and rejects `product_lots_identity_unique`. Export the helper for that purpose.
- [X] T011 [P] Add `findPlanningOptions(dischargeId: string): Promise<PlanningOptions | null>` to `apps/api/app/discharges/shared/repositories/discharge_repository.ts` and `lucid_discharge_repository.ts`. It returns `null` when `isUuid` fails or the discharge does not exist. Otherwise it runs three queries, as `data-model.md` § Planning options specifies:
  - available doors in available warehouses, preloaded with `warehouse`, ordered by `LOWER(warehouses.name)`, `LOWER(warehouse_doors.name)`, id;
  - current assignments of those doors in `PLANNED` or `ACTIVE` discharges other than `dischargeId`, with the discharge's `id`, `vessel_name`, `status`, and `expected_start_at`, one entry per door and discharge, ordered by `expected_start_at` then id;
  - available weighing areas ordered by `LOWER(name)`, id.

  Export the `PlanningOptions` type from the abstract file.
- [X] T012 Create `apps/api/app/discharges/planning_options/list_planning_options_use_case.ts` (`ListPlanningOptionsUseCase`, input `{ dischargeId }`). It throws `DischargeNotFoundException` on `null`. Create `apps/api/app/discharges/shared/discharge_planning_options_transformer.ts`, which serializes to the `PlanningOptionsEnvelope` data shape of the OpenAPI contract, with ISO date-times. Depends on T011.
- [X] T013 Add `planningOptions({ bouncer, params, serialize })` to `apps/api/app/controllers/discharges_controller.ts`. It authorizes `update` and calls T012. In `apps/api/start/routes.ts`, inside the `discharges` group, add `router.get('/:id/planning-options', [controllers.Discharges, 'planningOptions']).as('planning_options')`. Boot the API (or run `node ace` registry generation as GH-53 did) to regenerate `apps/api/.adonisjs/` and commit it. Makes T004 pass. Depends on T012.

### Web implementation

- [X] T014 [P] In `apps/web/src/features/discharges/queries/discharge-queries.ts`, add `planningOptions: (id: string) => tuyauQuery.discharges.planningOptions.queryOptions({ params: { id } }, { staleTime: 0 })`, with a comment that another discharge may take a door at any moment. In `__tests__/support/fixtures.ts`, add:
  - `PLANNING_DOORS`: two warehouses, three doors; one door with an `otherDischargeAssignments` entry for an active discharge `MV Ocean Cedar`.
  - `PLANNING_WEIGHING_AREAS`: two areas.
  - `buildDoorSelection` and `buildAreaSelection`, modelled on `buildDoorPeriod`.

  In `__tests__/support/test-helpers.ts`, add `mockPlanningOptions({ dischargeId, doors, weighingAreas, status })`, modelled on `mockPreparationOptions`, where `status` may be `'error'` or `'pending'`. Depends on T013.
- [X] T015 [P] Create `apps/web/src/features/discharges/discharge-planning-view.ts` with `currentDoorIds`, `lotHoldingDoor`, `plannedShiftsSelectingDoor`, `shiftDoorOptions`, and `shiftSelectionNotice`, as `data-model.md` § Web derivations specifies. Reuse `isInEffect` from `discharge-detail-view.ts`, and never re-derive the in-effect rule. Makes T005 pass.
- [X] T016 [P] Create `apps/web/src/libraries/forms/fields/checkbox-group-field.tsx`, and register it as `CheckboxGroupField` in `apps/web/src/libraries/forms/form.tsx`. Its props are:
  - `legend`;
  - `groups: Array<{ id: string; label?: string; options: Array<{ id: string; label: string; hints?: string[] }> }>`;
  - `searchPlaceholder?`;
  - `emptyMessage`.

  It binds a `string[]` field and renders:
  - a `fieldset` with a `legend`, and a nested `fieldset` per labelled group;
  - one `Checkbox` per option, with its hints in a list tied to it through `aria-describedby`;
  - an `InputSearch` that filters options by label or group label without changing the value;
  - a visible `{n} selected` count;
  - `emptyMessage` when there are no options;
  - `FieldError` for errors.

  On a refused submit, focus goes to the first checkbox of the field. Use `getFieldPresentation` from `field-presentation.ts`, as `checkbox-field.tsx` does.
- [X] T017 [P] Create `apps/web/src/features/discharges/ui/planning/planning-options.ts`, exporting `usePlanningOptions(dischargeId)`. It returns `{ doors: PreparationOptions<PlanningDoor>, weighingAreas: PreparationOptions<{ id; name }> }` with the same `options` / `loading` / `onRetry` shape as `ui/preparation/preparation-options.ts`, from one `useQuery(dischargeQueries.planningOptions(dischargeId))`. Export the `optionsState` helper from `preparation-options.ts` rather than copying it. Depends on T014.
- [X] T018 Update `apps/web/src/features/discharges/ui/detail/discharge-detail-page.tsx` to pass `canCorrect` to `DischargeShiftsCard`, and add the prop to `discharge-shifts-card.tsx` without rendering any action yet. Run `vitest run src/features/discharges/__tests__/detail` and confirm nothing changed.

**Checkpoint**: The options query answers, the indexes hold, and the shared web pieces are ready.

---

## Phase 3: User Story 1 - Assign Warehouse Doors to the Product Lots of a Planned Discharge (Priority: P1) 🎯 MVP

**Goal**: A preparer assigns, withdraws, and moves doors between a planned discharge's lots from the
detail, and every change stays readable as an effective period.

**Independent Test**: Open a planned discharge with two lots as an operations lead. Assign two doors
of one warehouse to the first lot and one of another warehouse to the second, then save. Withdraw one
door from the first lot. The detail shows the current and ended assignments with their warehouses.

### Tests for User Story 1 ⚠️

- [X] T019 [P] [US1] Create `apps/api/tests/integration/discharges/planning/lot_warehouse_doors.spec.ts` for `PATCH /api/v1/discharges/:dischargeId/product-lots/:id/warehouse-doors`. First extend `preparation_scenario.ts` with `createPlanningReferences()`, which returns two available warehouses with two available doors each and two available weighing areas. Then assert:
  - 401 unauthenticated and pending, and 403 for an observer, with no assignment row created.
  - For each role in `PREPARING_ROLES`, assigning two doors of different warehouses answers 200 with the detail. The lot then has two current `doorAssignments` whose `effectiveFrom` values are equal.
  - Withdrawing one door answers 200. The row still exists with `effectiveTo` set, and the other door stays current.
  - **Move**: assigning to `barley` a door current on `wheat` ends `wheat`'s row, with its `effectiveTo` equal to the new row's `effectiveFrom`, and leaves exactly one current row for that door in the discharge.
  - **Reassign**: assigning again a door that was withdrawn from the same lot creates a second row, and the ended row is kept.
  - **Idempotence**: sending the same assign body twice leaves the row count unchanged, and `{ assign: [], withdraw: [] }` answers 200 with no row change.
  - **Stale withdrawal**: withdrawing a door that is current on another lot changes nothing on either lot.
  - **Other discharges**: a door current in another planned discharge, and one in an active discharge, are assigned. The other discharges' rows are unchanged.
  - **Shape**: 422 `E_VALIDATION_ERROR` with no row change for:
    - a repeated identity in `assign` (field `assign.1`);
    - an identity in both lists (field `withdraw.0`, rule `notInBothLists`);
    - a non-UUID;
    - more than 200 identities;
    - a missing `withdraw`.
- [X] T020 [P] [US1] Extend `apps/api/tests/integration/discharges/preparation/remove_product_lot.spec.ts`: after a door is assigned to `barley` and then withdrawn through the new route, removing `barley` still answers 409 `E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS`.
- [X] T021 [P] [US1] Add a `planLotDoorChanges` group to `apps/api/tests/unit/discharges/planning/rules.spec.ts`, against T028. The input is `{ lotId, assign, withdraw, currentAssignments }`, and the output is `{ end: assignmentIds[], start: doorIds[], moves: Array<{ doorId, fromLotId }> }`, with no issues in this story. Cases:
  - assigning a door already current on the lot yields nothing;
  - assigning a free door yields a start;
  - assigning a door current on another lot yields that row in `end`, a start, and a move;
  - withdrawing a door current on the lot yields an end;
  - withdrawing a door not current on the lot yields nothing;
  - identities are compared lower-cased.
- [X] T022 [P] [US1] Create `apps/api/tests/unit/discharges/planning/change_lot_warehouse_doors.spec.ts` with stubbed `DischargePreparationRepository` and `DischargeRepository`, modelled on `tests/unit/discharges/preparation/product_lots.spec.ts`. It asserts:
  - `lockDischarge` is called before `lockWarehouseDoors`.
  - `lockWarehouseDoors` receives only the `assign` identities.
  - `endRows('DOOR_ASSIGNMENT', …)` is called before `startDoorAssignments`, with the same instant.
  - An unknown `productLotId` throws `ProductLotNotFoundException` and writes nothing.
  - An empty change set writes nothing and returns the detail.
- [X] T023 [P] [US1] Create `apps/api/tests/unit/discharges/planning/validators.spec.ts` for `lotWarehouseDoorsValidator`:
  - it accepts empty lists;
  - it lower-cases identities;
  - it refuses a duplicate with rule `distinct`;
  - it refuses an identity in both lists with rule `notInBothLists` on `withdraw.N`;
  - it refuses 201 items, a non-UUID, and a missing key.
- [X] T024 [P] [US1] Extend `apps/web/src/features/discharges/__tests__/discharge-planning-view.test.ts`, against T031:
  - `lotDoorChangeSet(lot, chosenIds)` returns `assign` for checked doors that are not current on the lot, and `withdraw` for current doors that are unchecked. A checked door current on another lot is in `assign`.
  - `movedDoors(response, lotId, assignedIds)` returns `[{ doorId, fromLot }]` only for doors whose ended row on another lot has `effectiveTo` equal to the new current row's `effectiveFrom` on `lotId`.
- [X] T025 [P] [US1] Create `apps/web/src/features/discharges/__tests__/planning/lot-doors.test.tsx` with `mockDischargeDetail`, `mockPlanningOptions`, and an MSW handler that captures the PATCH body and answers a detail built from it. As an operations lead on a planned discharge, assert:
  - Each lot shows a button named `Edit warehouse doors of {customer} · {product}`.
  - Opening it shows the `Warehouse doors` sheet: doors grouped under warehouse `fieldset`s, current doors checked, the count `{n} selected`, and filtering by `Search doors` narrowing the list without unchecking.
  - Hints show `Assigned to {customer} · {product}` for a door of the other lot, and `Also assigned to MV Ocean Cedar (Active, expected …)`.
  - Checking a door and unchecking another sends `{ assign: [checked], withdraw: [unchecked] }`. The sheet then closes, the toast `Warehouse doors updated` shows, and the lot lists the new current door.
  - Checking the other lot's door shows `Taken from {customer} · {product}` in the toast description.
  - `Save` with no change closes the sheet and sends no request.
  - While the options are pending the list shows a skeleton and `Save` is disabled. On failure, `Unable to load the warehouse doors` and `Retry` show.
- [X] T026 [P] [US1] Update `apps/web/src/features/discharges/__tests__/detail/access.test.tsx`:
  - Preparers of every role see the lot doors `Edit` on a planned discharge.
  - An observer sees none on a planned discharge.
  - Nobody sees one on active or closed discharges.

  Keep the existing observer assertions unchanged.

### Implementation for User Story 1

- [X] T027 [US1] Create `apps/api/app/discharges/warehouse_doors/lot_warehouse_doors_validator.ts`, exporting `idChangeList()` and `lotWarehouseDoorsValidator`:
  - `idChangeList()` is `vine.array(vine.string().uuid().toLowerCase()).maxLength(200).distinct()`, or the Vine 4 equivalent the other validators use.
  - `lotWarehouseDoorsValidator` is `vine.create({ assign: idChangeList(), withdraw: idChangeList() })`, plus a `notInBothLists` check that reports each shared identity on `withdraw.N`. Use a Vine `createRule` on the object, or a post-validation check that throws `E_VALIDATION_ERROR` with that field; choose the one that yields the dotted field path and document why.

  Makes T023 pass.
- [X] T028 [US1] Add `planLotDoorChanges` to `apps/api/app/discharges/shared/discharge_resource_planning_rules.ts`, with the input and output of T021. Makes T021 pass.
- [X] T029 [US1] Create `apps/api/app/discharges/warehouse_doors/change_lot_warehouse_doors_use_case.ts` (`ChangeLotWarehouseDoorsUseCase`, input `{ dischargeId, productLotId, assign, withdraw }`). In one `db.transaction`:
  1. `lockPlannedDischarge`.
  2. `listProductLots`: find the lot, or throw `ProductLotNotFoundException`.
  3. `listCurrentDoorAssignments`.
  4. `lockWarehouseDoors(assign)`.
  5. `planLotDoorChanges`; stop early when nothing is to be written.
  6. `recordedInstant(DateTime.now(), await latestDoorAssignmentTime(...))`.
  7. `endRows('DOOR_ASSIGNMENT', …)`, then `startDoorAssignments`.

  After commit, return `findDetail`. The doc comment explains the change set (research.md Decision 2) and the end-before-start order (Decision 3). Depends on T010, T028. Makes T022 pass.
- [X] T030 [US1] Create `apps/api/app/controllers/discharge_product_lot_doors_controller.ts` (`update`: authorize `update`, validate with `lotWarehouseDoorsValidator`, call T029 with `params.dischargeId` and `params.id`). In `apps/api/start/routes.ts`, inside the `product_lots` group, add `router.patch('/:id/warehouse-doors', [controllers.DischargeProductLotDoors, 'update']).as('warehouse_doors')`. Regenerate and commit `apps/api/.adonisjs/`. Makes T019 and T020 pass. Depends on T027, T029.
- [X] T031 [P] [US1] Add `lotDoorChangeSet` and `movedDoors` to `apps/web/src/features/discharges/discharge-planning-view.ts`. Makes T024 pass.
- [X] T032 [US1] In `apps/web/src/features/discharges/mutations/use-discharge-mutations.ts`, add `changeLotDoors = useMutation(tuyauQuery.discharges.productLots.warehouseDoors.mutationOptions({ onSuccess: applyDetail, onError: (error, variables) => refreshAfterStaleRefusal(error, String(variables.params.dischargeId)) }))` and return it. Depends on T030.
- [X] T033 [US1] Create `apps/web/src/features/discharges/ui/planning/lot-warehouse-doors-sheet.tsx` (`LotWarehouseDoorsSheet`, props `{ discharge, lot, open, onOpenChange }`), following `contracts/ui-state.md` § `Warehouse doors` sheet:
  - Build the groups from `usePlanningOptions`, with hints from `lotHoldingDoor` and `otherDischargeAssignments`. Format the status as `Planned` or `Active`, and the date with `formatDateTime`.
  - Use a `useAppForm` with `defaultValues: { warehouseDoorIds: currentDoorIds(lot) }`.
  - On submit:
    - compute `lotDoorChangeSet`, and close without a request when both lists are empty;
    - otherwise call `changeLotDoors`, then toast `Warehouse doors updated`, with a `Taken from …` description built from `movedDoors`.
  - Disable `Save` while the options are pending or failed. Pending label from `WRITE_PENDING_LABELS.update`.

  In this story, any error toasts the API message and keeps the sheet open. US3 refines the outcomes. Depends on T016, T017, T031, T032.
- [X] T034 [US1] Update `apps/web/src/features/discharges/ui/detail/discharge-product-lots-card.tsx`. In `LotDoors`, when `canCorrect`, render a heading row `Warehouse doors` with a ghost `Edit` button whose `aria-label` is `Edit warehouse doors of {customer} · {product}`. Hold the open lot in local state and mount `LotWarehouseDoorsSheet`. Makes T025 and T026 pass. Depends on T033.

**Checkpoint**: US1 is functional. Preparers plan lot doors end to end, and observers see nothing new.

---

## Phase 4: User Story 2 - Select the Warehouse Doors and Weighing Areas of a Planned Shift (Priority: P1)

**Goal**: A preparer selects a planned shift's doors, among those assigned to the discharge's lots,
and its weighing areas, in one save.

**Independent Test**: On a planned discharge whose lots have door assignments, select two assigned
doors and one weighing area for the first shift, and another door and two areas for the second.
Remove one area from the second shift. Each shift shows exactly its current resources, and the
removed area shows as ended.

### Tests for User Story 2 ⚠️

- [X] T035 [P] [US2] Create `apps/api/tests/integration/discharges/planning/shift_checkpoints.spec.ts` for `PATCH /api/v1/discharges/:dischargeId/shifts/:id/checkpoints`. Extend `preparation_scenario.ts` with a second planned shift (non-overlapping) and a helper `assignDoorToLot(prepared, lotId, doorId)` that goes through the factory. Assert:
  - 401, 403 for an observer, and no selection row created.
  - For each role in `PREPARING_ROLES`, adding one assigned door and one area answers 200. The shift has exactly one current row of each, with equal `effectiveFrom`.
  - Doors and areas sent in one body are written together.
  - Removing ends the row and keeps it.
  - Adding again after removal creates a new row.
  - The same body twice leaves the row count unchanged, and an all-empty body answers 200 with no change.
  - The other shift's selections are unchanged, and nothing is copied to it.
  - An area already selected for a shift of another planned discharge is accepted for this shift.
  - **Shape**: 422 with no change for a duplicate in `weighingAreas.add`, an identity in both `warehouseDoors.add` and `warehouseDoors.remove` (field `warehouseDoors.remove.0`), and a missing `weighingAreas`.
- [X] T036 [P] [US2] Add a `planShiftCheckpointChanges` group to `apps/api/tests/unit/discharges/planning/rules.spec.ts`, against T043. The input is `{ shiftId, warehouseDoors: { add, remove }, weighingAreas: { add, remove }, currentSelections }`, and the output is `{ endDoors, startDoors, endAreas, startAreas }`. Cases: add a resource already current is nothing, add a new one is a start, remove a current one is an end, and remove a non-current one is nothing. Each kind is independent of the other.
- [X] T037 [P] [US2] Create `apps/api/tests/unit/discharges/planning/change_shift_checkpoints.spec.ts` with stubbed repositories. It asserts:
  - `lockDischarge` is called before `lockWeighingAreas`.
  - `lockWeighingAreas` receives only `weighingAreas.add`, and no door lock is taken.
  - Every `endRows` call comes before any start, with one instant.
  - An unknown `shiftId` throws `ShiftNotFoundException` and writes nothing.
- [X] T038 [P] [US2] Extend `apps/api/tests/unit/discharges/planning/validators.spec.ts` for `shiftCheckpointsValidator`: it accepts all-empty pairs, refuses a duplicate, refuses an identity in both lists of one pair with `notInBothLists` on `….remove.N`, and accepts the same identity in `warehouseDoors.add` and `weighingAreas.remove`.
- [X] T039 [P] [US2] Extend `apps/web/src/features/discharges/__tests__/discharge-planning-view.test.ts`, against T046: `shiftCheckpointChangeSet(shift, { warehouseDoorIds, weighingAreaIds })` returns add and remove lists per kind, computed against current selections only.
- [X] T040 [P] [US2] Create `apps/web/src/features/discharges/__tests__/planning/shift-checkpoints.test.tsx`. As an operations lead on a planned discharge with one door assigned to each lot, assert:
  - Each planned shift shows `Edit warehouse doors of shift {period}` and `Edit weighing areas of shift {period}`. A shift built with status `ACTIVE` shows neither.
  - Either button opens the `Shift checkpoints` sheet. After `Edit weighing areas…`, the `Weighing areas` legend is scrolled into view (assert `scrollIntoView` was called on it, stubbing it in jsdom).
  - The doors section lists only the assigned doors, each hinted `For {customer} · {product}`, with no request needed for them. The weighing areas come from `mockPlanningOptions`.
  - With no door assigned to any lot, the doors section reads `Assign warehouse doors to the product lots first`.
  - Checking one door and one area sends `{ warehouseDoors: { add: [door], remove: [] }, weighingAreas: { add: [area], remove: [] } }`, closes the sheet, shows the toast `Shift checkpoints updated`, and the shift lists both.
  - `Save` with no change sends nothing.
- [X] T041 [P] [US2] Update `apps/web/src/features/discharges/__tests__/detail/shifts.test.tsx`: a shift whose area selections are all ended shows them and `None currently selected`, a shift with none shows `None selected` (unchanged), and a closed discharge shows no `None currently selected`. Update `detail/access.test.tsx` so shift `Edit` buttons show for preparers on planned discharges only.

### Implementation for User Story 2

- [X] T042 [US2] Create `apps/api/app/discharges/checkpoints/shift_checkpoints_validator.ts`, exporting `shiftCheckpointsValidator = vine.create({ warehouseDoors: vine.object({ add: idChangeList(), remove: idChangeList() }), weighingAreas: vine.object({ add: idChangeList(), remove: idChangeList() }) })`, with the same `notInBothLists` mechanism as T027, applied per pair. Import `idChangeList` from T027. Makes T038 pass.
- [X] T043 [US2] Add `planShiftCheckpointChanges` to `apps/api/app/discharges/shared/discharge_resource_planning_rules.ts`. Makes T036 pass.
- [X] T044 [US2] Create `apps/api/app/discharges/checkpoints/change_shift_checkpoints_use_case.ts` (`ChangeShiftCheckpointsUseCase`, input `{ dischargeId, shiftId, warehouseDoors, weighingAreas }`). In one transaction:
  1. `lockPlannedDischarge`.
  2. `listShifts`: find the shift, or throw `ShiftNotFoundException`.
  3. `listCurrentShiftSelections`, filtered to the shift.
  4. `lockWeighingAreas(weighingAreas.add)`.
  5. `planShiftCheckpointChanges`, then `recordedInstant(DateTime.now(), await latestShiftSelectionTime(...))`.
  6. `endRows('SHIFT_DOOR')`, `endRows('SHIFT_AREA')`, `startShiftDoors`, `startShiftAreas`.

  After commit, return `findDetail`. The doc comment says doors are not locked here and points to research.md Decision 6. Depends on T010, T043. Makes T037 pass.
- [X] T045 [US2] Create `apps/api/app/controllers/discharge_shift_checkpoints_controller.ts` (`update`). In `apps/api/start/routes.ts`, inside the `discharges` group, add a `router.group(() => { router.patch('/:id/checkpoints', [controllers.DischargeShiftCheckpoints, 'update']).as('checkpoints') }).prefix('/:dischargeId/shifts').as('shifts')`, with a comment that GH-63 and GH-64 extend this group. Regenerate and commit `apps/api/.adonisjs/`. Makes T035 pass. Depends on T042, T044.
- [X] T046 [P] [US2] Add `shiftCheckpointChangeSet` to `apps/web/src/features/discharges/discharge-planning-view.ts`. Makes T039 pass.
- [X] T047 [US2] Add `changeShiftCheckpoints` to `apps/web/src/features/discharges/mutations/use-discharge-mutations.ts`, on `tuyauQuery.discharges.shifts.checkpoints`, with the same `onSuccess` and `onError` as T032. Depends on T045.
- [X] T048 [US2] Create `apps/web/src/features/discharges/ui/planning/shift-checkpoints-sheet.tsx` (`ShiftCheckpointsSheet`, props `{ discharge, shift, focus: 'warehouseDoors' | 'weighingAreas', open, onOpenChange }`), following `contracts/ui-state.md` § `Shift checkpoints` sheet:
  - The door groups come from `shiftDoorOptions(discharge)`, grouped by warehouse and hinted with their lot.
  - The areas come from `usePlanningOptions`.
  - On mount, `scrollIntoView` the section named by `focus`.
  - On submit, compute `shiftCheckpointChangeSet`, close without a request when every list is empty, or call `changeShiftCheckpoints` and toast `Shift checkpoints updated`.
  - Any error toasts and stays open; US3 refines this.

  Depends on T016, T017, T046, T047.
- [X] T049 [US2] Update `apps/web/src/features/discharges/ui/detail/discharge-shifts-card.tsx`:
  - `ResourceGroup` takes an optional `action` rendered beside its heading, and uses `shiftSelectionNotice` to add `None currently selected` after ended rows.
  - When `canCorrect` and `shift.status === 'PLANNED'`, the `Warehouse doors` and `Weighing areas` groups render a ghost `Edit` with `aria-label`s `Edit warehouse doors of shift {period}` and `Edit weighing areas of shift {period}`. Both open `ShiftCheckpointsSheet` with the matching `focus`, from local state.
  - `Trucks` gets no action.

  Makes T040 and T041 pass. Depends on T048.

**Checkpoint**: US1 and US2 are both functional and independently testable.

---

## Phase 5: User Story 3 - Be Stopped Before Recording an Unusable Assignment (Priority: P2)

**Goal**: Every unusable choice is refused with an explanation on the offending value, state changes
made meanwhile are reported, and no archive can race a new assignment or selection.

**Independent Test**: In turn, submit:
- an archived door, a door of an archived warehouse, and an archived weighing area;
- an unassigned door for a shift;
- a change on an active discharge, and a change on a lot removed meanwhile;
- the withdrawal of a door still selected for a planned shift.

Each is refused with its explanation, and no row is started or ended.

### Tests for User Story 3 ⚠️

- [X] T050 [P] [US3] Create `apps/api/tests/integration/discharges/planning/lot_warehouse_doors_refusals.spec.ts`. Each case asserts that the row counts of `warehouse_door_product_lot_assignments` are unchanged:
  - 422 with every issue reported at once: an archived door (`assign.0`), a door of an archived warehouse (`assign.1`), and an unknown UUID (`assign.2`), each with rule `availableWarehouseDoor`. A valid door in the same body is not assigned.
  - 422 `withdraw.0` / `selectedByPlannedShift` when a planned shift has a current selection of the door. After that selection is ended, the same withdrawal succeeds.
  - Moving that door to another lot of the same discharge is accepted, and the shift selection is untouched.
  - 409 `E_DISCHARGE_NOT_PLANNED` on an active and on a closed discharge (`createPreparedDischarge('ACTIVE')`, `'CLOSED'`), including with an unknown lot id.
  - 404 `E_PRODUCT_LOT_NOT_FOUND` for an unknown lot, a malformed lot id, and a lot of another discharge. 404 `E_DISCHARGE_NOT_FOUND` for a malformed discharge id.
- [X] T051 [P] [US3] Create `apps/api/tests/integration/discharges/planning/shift_checkpoints_refusals.spec.ts`. With no row change in each case:
  - 422 `warehouseDoors.add.N` / `assignedWarehouseDoor` for a door with no assignment, a door whose only assignment in this discharge ended, and a door current only in another discharge.
  - 422 `weighingAreas.add.0` / `availableWeighingArea` for an archived area and for an unknown UUID.
  - 409 `E_SHIFT_NOT_PLANNED` for a shift with status `ACTIVE` inside a planned discharge, built with `ShiftFactory`.
  - 409 `E_DISCHARGE_NOT_PLANNED` for an active discharge.
  - 404 `E_SHIFT_NOT_FOUND` for an unknown shift, a malformed shift id, and a shift of another discharge.
- [X] T052 [P] [US3] Create `apps/api/tests/integration/discharges/planning/archive_guards.spec.ts`. After planning through the new routes, it asserts:
  - Single and bulk archive of the assigned door answer the existing in-use refusal, and so does archiving its warehouse.
  - Single and bulk archive of the selected weighing area answer the code `WeighingAreaInUseException` carries.
  - After withdrawing the door and removing the area from every shift, each archive succeeds.
- [X] T053 [P] [US3] Add refusal groups to `apps/api/tests/unit/discharges/planning/rules.spec.ts`. `planLotDoorChanges` now also receives `doorsById` (from `lockWarehouseDoors`) and `plannedShiftDoorSelections`. `planShiftCheckpointChanges` receives `currentDoorAssignmentDoorIds` and `areasById`. Each returns `issues` with fields `assign.N`, `withdraw.N`, `warehouseDoors.add.N`, and `weighingAreas.add.N`, where `N` is the index in the submitted list. Cover every row of the `data-model.md` change set tables, and assert that every issue of one submission is reported together, not only the first.
- [X] T054 [P] [US3] Extend `change_lot_warehouse_doors.spec.ts` and `change_shift_checkpoints.spec.ts` in `apps/api/tests/unit/discharges/planning/`:
  - Issues throw `E_VALIDATION_ERROR` before any `endRows` call.
  - A `CURRENT_ROW_CONFLICT` outcome throws `DischargePlanningConflictException`.
  - A shift whose status is not `PLANNED` throws `ShiftNotPlannedException` before any lock on weighing areas.
- [X] T055 [P] [US3] Rewrite the archive case of `apps/api/tests/unit/weighing_areas/weighing_area_use_cases.spec.ts` ("blocks archival when a planned or active discharge uses the area"). The use case no longer calls the usage checker. A repository stub returning `{ kind: 'IN_USE' }` makes it throw `WeighingAreaInUseException`, and `NOT_FOUND` and `ALREADY_ARCHIVED` keep their exceptions. The existing integration cases in `apps/api/tests/integration/weighing_areas.spec.ts` must pass unchanged.
  **Result**: no rewrite was needed. The existing case resolves the real repository with a swapped usage checker, so it already exercises the `IN_USE` outcome the repository now decides under lock, and it passes unchanged.
- [X] T056 [P] [US3] Extend `apps/web/src/features/discharges/__tests__/discharge-planning-view.test.ts`, against T064: `describeIssues(details, changeSetPaths, labelOf)` maps `assign.1`, `withdraw.0`, `warehouseDoors.add.0`, and `weighingAreas.add.2` to the submitted identity's label as `{label}: {message}`, and ignores unknown paths without throwing.
- [X] T057 [P] [US3] Create `apps/web/src/features/discharges/__tests__/planning/lot-doors-refusals.test.tsx`:
  - A current door hinted `Selected for shift {period}`, once unchecked, blocks submit with `Remove this door from shift {period} first` on the field, sends no request, and moves focus to the first checkbox.
  - A 422 with `assign.0` / `availableWarehouseDoor` keeps the sheet open with `{door label}: This warehouse door is no longer available` and the choices kept.
  - A 422 `selectedByPlannedShift` refetches the detail and names the shift from it.
  - A 500 toasts the API message and keeps the sheet open.
- [X] T058 [P] [US3] Create `apps/web/src/features/discharges/__tests__/planning/shift-checkpoints-refusals.test.tsx`: a 422 `assignedWarehouseDoor` and a 422 `availableWeighingArea` are each shown on their section with the resource label, the choices are kept, and a 500 toasts and stays open.
- [X] T059 [P] [US3] Create `apps/web/src/features/discharges/__tests__/planning/stale-state.test.tsx`. For each code, the sheet closes, the detail request is made again, and the toast reads:

  | Code | Sheet | Toast |
  |---|---|---|
  | `E_DISCHARGE_NOT_PLANNED` | lot | `STARTED_REFUSAL_MESSAGE` |
  | `E_DISCHARGE_NOT_FOUND` | shift | `STARTED_REFUSAL_MESSAGE` |
  | `E_PRODUCT_LOT_NOT_FOUND` | lot | `LOT_GONE_MESSAGE` |
  | `E_SHIFT_NOT_FOUND`, `E_SHIFT_NOT_PLANNED` | shift | `This shift can no longer be planned` |
  | `E_DISCHARGE_PLANNING_CONFLICT` | both | `This discharge changed meanwhile. Check its doors and try again.` |

### Implementation for User Story 3

- [X] T060 [US3] Extend `planLotDoorChanges` and `planShiftCheckpointChanges` in `apps/api/app/discharges/shared/discharge_resource_planning_rules.ts` with the refusal inputs and `issues` of T053, using the issue builders from T009. Makes T053 pass.
- [X] T061 [US3] Update both use cases:
  - `change_lot_warehouse_doors_use_case.ts`: pass `lockWarehouseDoors`'s map, and `listCurrentShiftSelections` restricted to planned shifts, into the rules.
  - `change_shift_checkpoints_use_case.ts`:
    - after finding the shift, throw `ShiftNotPlannedException` when its status is not `PLANNED`;
    - pass the current assignments' door ids and `lockWeighingAreas`'s map into the rules.
  - In both, call `throwPreparationIssues(issues)` before any write, and map every `CURRENT_ROW_CONFLICT` outcome to `DischargePlanningConflictException`.

  Makes T050, T051, and T054 pass. Depends on T060.
- [X] T062 [US3] Harden the single weighing area archive, following `LucidDockRepository.archiveAvailable`:
  - In `apps/api/app/weighing_areas/shared/repositories/weighing_area_repository.ts`, add `{ kind: 'IN_USE' }` to `ArchiveWeighingAreaResult`.
  - In `lucid_weighing_area_repository.ts`, `archiveAvailable` runs in `WeighingArea.transaction`: it locks the row `FOR UPDATE`, answers `NOT_FOUND` or `ALREADY_ARCHIVED`, then calls `this.usageChecker.findUsedByPlannedOrActiveDischarge({ referenceType: 'WEIGHING_AREA', referenceIds: [id], client: trx })` and answers `IN_USE`, then updates. Inject the usage checker the way `archiveAvailableMany` already receives it.
  - In `apps/api/app/weighing_areas/archive/archive_weighing_area_use_case.ts`, remove the pre-checks and the `SiteReferenceUsageChecker` dependency, and map the outcomes, with `IN_USE` mapping to `WeighingAreaInUseException`.

  The doc comment cites research.md Decision 5. Makes T055 and T052's weighing area cases pass.
- [X] T063 [P] [US3] Update the comments in `apps/api/app/warehouse_doors/shared/repositories/lucid_warehouse_door_repository.ts` (in `archiveAvailable`, "No such writer exists yet…") and in `LucidWarehouseRepository.findWarehousesWithDoorsInUse` in `apps/api/app/warehouses/shared/repositories/lucid_warehouse_repository.ts`. Both must now say that `ChangeLotWarehouseDoorsUseCase` takes the warehouse and door share locks before inserting, which closes the race they described. No code change. Confirm T052's door and warehouse cases pass.
- [X] T064 [P] [US3] Add `describeIssues` to `apps/web/src/features/discharges/discharge-planning-view.ts`. Makes T056 pass.
- [X] T065 [US3] In `apps/web/src/features/discharges/mutations/use-discharge-mutations.ts`, add `E_SHIFT_NOT_FOUND`, `E_SHIFT_NOT_PLANNED`, and `E_DISCHARGE_PLANNING_CONFLICT` to `STALE_DETAIL_CODES`.
- [X] T066 [US3] Complete the outcomes of `lot-warehouse-doors-sheet.tsx` and `shift-checkpoints-sheet.tsx` under `apps/web/src/features/discharges/ui/planning/`, as `contracts/ui-state.md` § Outcomes specifies:
  - **422**: `describeIssues` results are set as field errors on `warehouseDoorIds` or `weighingAreaIds`, and the choices are kept. For `selectedByPlannedShift`, await the detail refetch and name the shifts through `plannedShiftsSelectingDoor`.
  - **Stale codes**: close, refetch, and toast. Reuse `STARTED_REFUSAL_MESSAGE` and `LOT_GONE_MESSAGE`, and export `SHIFT_GONE_MESSAGE` and `PLANNING_CONFLICT_MESSAGE` from the shift sheet.
  - **Other failures**: toast the API message and stay open.

  In the lot sheet, add the `Selected for shift {period}` hint and a submit-time validator that refuses unchecking such a door with `Remove this door from shift {period} first`. Makes T057, T058, and T059 pass. Depends on T064, T065.

**Checkpoint**: All three stories are functional and independently testable, and the archive races
are closed.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Consistency, documentation alignment, and the constitution's delivery gates.

- [X] T067 [P] Confirm the slice stayed within research.md Decisions 7 and 10. `git diff --stat master -- apps/api/database` shows only `1786200000000_add_current_planning_unique_indexes.ts`, with no seeder or fixture change and no Activity Log write. Revert anything that slipped in, or record the justification in the PR description.
- [X] T068 [P] Review every new or changed file for the API style rules in `apps/api/AGENTS.md` (airy function bodies, a blank line before a `return` after setup), and for doc comments explaining *why* on each new repository method, use case, and rule: the lock order, change sets, end before start, the recorded instant, and why shift doors are not locked.
- [X] T069 [P] Check that the copy and routes in `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/plan-warehouse-door-and-checkpoint-assignments/contracts/ui-state.md` and `quickstart.md` match the implementation, and fix any drift in those two files. Leave the roadmap's GH-54 status to the merge.
- [X] T070 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` at the repository root, and fix every finding. Record the result counts in this task.
  **Result (2026-09-15)**:
  - `pnpm check`: clean, after formatting and three lint fixes (rule-name `noSecrets` ignores, one needless `async`, a `role="status"` on the loading skeleton).
  - `pnpm typecheck`: both apps pass.
  - API tests: 1,623 passed (baseline 1,556). One options test first failed because another suite leaves committed site references behind; it now compares only its own rows.
  - Web tests: 325 files, 1,594 passed (baseline 1,554).
  - Both suites were run separately; the API ran on `PORT=3399`.
- [ ] T071 Run `pnpm --filter @portflow/api db:fresh` against PostgreSQL to prove the seed satisfies the new indexes. Then run `pnpm dev` and the API and screen validations of `quickstart.md`, including the observer checks and the two-session check. Record any deviation in the PR description.
  **Partial result (2026-09-15)**, on a scratch database `portflow_gh54` in the local `portflow-postgres` container, dropped afterwards:
  - Migrations, including the three partial unique indexes, and every seeder ran cleanly.
  - The planning, lot removal, and weighing area integration suites passed on PostgreSQL (77 tests), exercising `FOR SHARE`, the indexes, and the archive guards on a real engine.
  - An API smoke against the seed, as the lead and the observer, confirmed: the options name `MV Ocean Cedar` on its door; the observer gets 403; withdrawing the seeded door its planned shift selects is refused; assigning, replaying, and selecting work; two saves in one second record periods one second apart; an active discharge is refused; a selected weighing area cannot be archived.
  - **Not done**: the screen validation in a browser and the two-session check.
- [ ] T072 Obtain a fresh read-only review of the final diff, as Constitution VII requires, and resolve or explicitly justify every confirmed finding.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup and blocks every story.
- **US1 (Phase 3)**: depends on Foundational. This is the MVP.
- **US2 (Phase 4)**: depends on Foundational. Its API can be built in parallel with US1. Its
  integration tests need assigned doors, which `preparation_scenario.ts` creates through factories
  rather than US1's route. Its web sheet does not depend on US1's.
  - T049 and T034 both touch the detail page's cards, but in different files.
  - T041 and T026 both touch `detail/access.test.tsx`, so run them one after the other.
- **US3 (Phase 5)**: depends on US1 and US2. It extends both commands, both rules, and both sheets.
- **Polish (Phase 6)**: depends on every story being done.

### Within each story

Tests are written first and must fail. Then, in order: validator, rules, use case, controller and
route, registry regeneration, web view helpers, mutation, sheet, card.

### Key task dependencies

- T010 depends on T006, whose index names `isCurrentRowConflict` matches.
- T012 depends on T011, and T013 on T012.
- T014 depends on T013, the registry; T017 depends on T014.
- T029 depends on T010 and T028; T030 on T027 and T029; T032 on T030; T033 on T016, T017, T031, and T032; T034 on T033.
- T042 depends on T027 (`idChangeList`); T044 on T010 and T043; T045 on T042 and T044; T047 on T045; T048 on T016, T017, T046, and T047; T049 on T048 and T018.
- T061 depends on T060; T066 on T064, T065, T033, and T048.

### Parallel opportunities

- **Phase 2**:
  - T002–T005 together.
  - Then T006, T007, T008, T009, T011, T015, and T016 together.
  - T010 after T006; T012 and T013 in sequence; T014 and T017 after T013; T018 on its own.
- **US1 tests**: T019–T026 together.
- **US2 tests**: T035–T041 together. T041 goes after T026 because they share `detail/access.test.tsx`.
- **US1 and US2 implementation**: can be staffed at the same time. US2 waits only on T027 for `idChangeList`.
- **US3 tests**: T050–T059 together. **US3 implementation**: T062, T063, and T064 in parallel with T060 and T061.

---

## Parallel Example: User Story 1

```bash
# All US1 tests at once (different files):
Task: "T019 API integration lot_warehouse_doors.spec.ts"
Task: "T020 API integration remove_product_lot.spec.ts extension"
Task: "T021 API unit planLotDoorChanges in rules.spec.ts"
Task: "T022 API unit change_lot_warehouse_doors.spec.ts"
Task: "T023 API unit validators.spec.ts"
Task: "T024 Web unit discharge-planning-view.test.ts"
Task: "T025 Web planning/lot-doors.test.tsx"
Task: "T026 Web detail/access.test.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T050 API integration lot_warehouse_doors_refusals.spec.ts"
Task: "T051 API integration shift_checkpoints_refusals.spec.ts"
Task: "T052 API integration archive_guards.spec.ts"
Task: "T055 API unit weighing_area_use_cases.spec.ts rewrite"
Task: "T057 Web planning/lot-doors-refusals.test.tsx"
Task: "T058 Web planning/shift-checkpoints-refusals.test.tsx"
Task: "T059 Web planning/stale-state.test.tsx"
```

---

## Implementation Strategy

### MVP first (User Story 1)

1. Phase 1 baseline, then Phase 2 foundations.
2. Phase 3, US1: preparers assign, withdraw, and move lot doors end to end, observers cannot, and
   replays are harmless.
3. **Stop and validate** with the US1 independent test and the lot half of `quickstart.md`.

US1 alone relies on the current-row indexes and the discharge lock. It does not yet refuse archived
doors, so it is demoable but not mergeable.

### Incremental delivery

1. US1 → a demoable lot door flow.
2. US2 → shift checkpoint selection. Both P1 stories together make the first shift startable once
   GH-56 lands.
3. US3 → authoritative refusals and race safety. **This is the minimum mergeable scope**: without it,
   an archived door could be assigned, a shift could select an unassigned door, and a single weighing
   area archive could race a selection.
4. Polish → gates, `db:fresh`, quickstart, fresh review, then the PR is ready for human review.

Each story ends at a checkpoint where the full API and web suites pass, so the branch can be paused
or reviewed after any of them.
