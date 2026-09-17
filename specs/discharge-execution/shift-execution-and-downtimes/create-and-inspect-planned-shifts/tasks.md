---
description: "Task list for Create and Inspect Planned Shifts (GH-63)"
---

# Tasks: Create and Inspect Planned Shifts

**Input**: Design documents from `specs/discharge-execution/shift-execution-and-downtimes/create-and-inspect-planned-shifts/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required. Constitution IV mandates RED → GREEN → REFACTOR for business behavior, and
`apps/api/AGENTS.md` and `apps/web/AGENTS.md` name the test seams each layer must have. Write each
test task first and confirm it fails for the expected reason before starting its implementation task.

**Organization**: Tasks are grouped by user story, so that each story can be implemented and tested on
its own:
- US1 adds a planned shift, with resources, to a planned discharge.
- US2 adds a planned shift to an active discharge.
- US3 makes every refusal of an addition precise.
- US4 shows what a planned shift still lacks to start.
- US5 keeps additions safe under concurrency and stale forms.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `[US1]`–`[US5]`, mapping to the user stories in `spec.md`

## Path Conventions

This is a PNPM/Turbo monorepo with `apps/api/` (AdonisJS) and `apps/web/` (TanStack Start). All paths
below are relative to the repository root. `#discharges/*`, `#users/*`, `#models/*`, `#shared/*`, and
`#database/factories/*` are API import aliases; `@/…` is the web source alias.

API conventions, as GH-53 to GH-55 established them:
- **Use cases**: `@inject()` classes with an explicit `<UseCase>Input` type. They own the
  `db.transaction`, and read the detail with `DischargeRepository.findDetail` after the commit. Model
  the new use case on `apps/api/app/discharges/shifts/correct_planned_shift_use_case.ts`.
- **Repositories**: they return typed outcomes (`{ kind: … }`) and never throw HTTP exceptions.
- **Refusals of entered values**: collect every `PreparationIssue`, then call `throwPreparationIssues`
  once (`#discharges/shared/discharge_preparation_issues`).
- **Controllers**: authorize with `bouncer.with(DischargePolicy).authorize('update')`, validate, call
  the use case with `parseInstant` for instants, and return
  `serialize(DischargeDetailTransformer.transform(detail))`.
- **Integration tests**: `testUtils.db().wrapInGlobalTransaction()`, then 401, 403, success per role,
  then endpoint-specific failures, each asserting nothing changed. Reuse
  `apps/api/tests/integration/discharges/preparation/preparation_scenario.ts`: `createPreparedDischarge`,
  `preparer`, `PREPARING_ROLES`, `reserveTruck`, `assignDoorToLot`, `createPlanningReferences`,
  `addPlannedShift`.
- **Running tests**: from `apps/api`, `PORT=3399 node --import tsx ace.js test --files="shifts/*"`.
  `--files` matches trailing path segments, and a spec importing a missing module hangs rather than
  failing, so bound red runs with a timeout. New routes reach the Tuyau client registry only after a
  short `node ace serve` boot. Commit `apps/api/.adonisjs/`.

Web conventions:
- Feature tests render through the real router with MSW (`renderDischargeTab(id, 'shifts', search)`,
  `mockDischargeDetail`, `mockPreparationOptions`, `chooseOption`, `change` from
  `apps/web/src/features/discharges/__tests__/support/test-helpers.ts`), and never mock the Tuyau
  client.
- Copy comes from `@/helpers/resource-copy`. Forms use `useAppForm`, registered fields, `FormError`,
  and `SubmitButton`.
- Button labels carry the action only, except creation buttons (`Add shift`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a green baseline before changing shared shift code.

- [X] T001 Confirm the baseline is green by running `PORT=3399 node --import tsx ace.js test --files="shifts/*"` and `--files="truck_pool/*"` in `apps/api`, and `pnpm --filter @portflow/web test -- src/features/discharges/__tests__/detail/shift-edit.test.tsx src/features/discharges/__tests__/detail/shifts.test.tsx`. Record any pre-existing failure in the PR description rather than fixing it here.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared pieces every addition story needs: the resource planning module shared with
the correction, the state guard and exceptions, the addition rules, and the repository write.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Extract resource planning from the correction (research.md Decision 6). Create `apps/api/app/discharges/shared/planned_shift_resources.ts` exporting `planPlannedShiftResources(repository, { dischargeId, shiftId, truckIds, warehouseDoorIds, weighingAreaIds, now }, client)`. It moves `CorrectPlannedShiftUseCase`'s private `planWarehouseDoors` and `planWeighingAreas` there unchanged, calls `planShiftTruckSelection` first, and returns `{ trucks, warehouseDoors, weighingAreas, issues }`. `issues` concatenates the `ISSUES` plans in truck, door, area order. Keep the lock order: trucks, then warehouses and doors, then weighing areas.
- [X] T003 Refactor `apps/api/app/discharges/shifts/correct_planned_shift_use_case.ts` to call `planPlannedShiftResources`, with no behavior change. Re-run `--files="shifts/*"` and `--files="truck_pool/*"`, and `tests/unit/discharges/truck_pool/lock_order.spec.ts`: all must stay green (depends on T002).
- [X] T004 [P] Add `DischargeClosedException` (409, `E_DISCHARGE_CLOSED`, "A closed discharge receives no new shift") and `ShiftIdConflictException` (409, `E_SHIFT_ID_CONFLICT`, "This shift identity is already used") in `apps/api/app/discharges/shared/discharge_exceptions.ts`.
- [X] T005 [P] Write unit tests in `apps/api/tests/unit/discharges/shifts/add_rules.spec.ts` for the rules added in T006:
  - `findAddedShiftIssues(period, shifts)`: end not after start gives `plannedEndAt` · `shiftPeriodOrder`; overlap with any shift, whatever its status, gives `plannedStartAt` · `shiftOverlap`, and the message names the overlapped shift's planned period; touching periods at either end are accepted.
  - The started-shift rule: a start equal to or before the latest `ACTIVE`/`COMPLETED` start gives `plannedStartAt` · `shiftAfterStartedShifts`, naming that shift's period; a start strictly after is accepted; it never applies when every shift is `PLANNED`, including between two planned shifts of an active discharge.
  - `startedShiftStart(shift)` returns `plannedStartAt`.
  - `planAddedShiftSequences(shifts, added)`: before, between, and after existing shifts, returning the new sequence and only the changed existing sequences; it throws when a started shift would be renumbered.
- [X] T006 Implement `findAddedShiftIssues`, `startedShiftStart`, `shiftAfterStartedShiftsIssue`, and `planAddedShiftSequences` in `apps/api/app/discharges/shared/planned_shift_rules.ts`, reusing `isOrderedPeriod`, `periodsOverlap`, `orderShifts`, and `shiftPeriodOrderIssue` from `discharge_preparation_rules.ts`. Put the overlapped or started shift's period in the message, formatted as the existing messages format instants. Add a doc comment on `startedShiftStart` stating that GH-65 must prefer the actual start once it records one (research.md Decision 4). Make T005 green.
  - *Implementation note*: API messages stay generic, like every existing preparation message. Formatting an instant would need the viewer's time zone, which only the web has, so the web's client rule names the overlapped or started shift's period instead (T024).
- [X] T007 [P] Add `lockDischargeOpenToShifts(repository, dischargeId, client)` in `apps/api/app/discharges/shared/shift_discharge_guard.ts`, modelled on `planned_discharge_guard.ts`. It locks with `repository.lockDischarge`, throws `DischargeNotFoundException` when missing, and returns the discharge whatever its status. The use case decides on status after its replay lookup (research.md Decision 2).
- [X] T008 Add two methods to `apps/api/app/discharges/shared/repositories/discharge_preparation_repository.ts`:
  - `findShiftIdentity(dischargeId, shiftId, client)`: returns `true` when a shift of this discharge has the id, and `false` for an unknown, malformed, or foreign one.
  - `insertPlannedShift(command, client)`, returning `{ kind: 'INSERTED' } | { kind: 'DUPLICATE_ID' }`. The command is `{ dischargeId, shiftId, sequence, plannedStartAt, plannedEndAt, responsibleUserId, sequences, warehouseDoors: { inserts }, weighingAreas: { inserts } }`.

  Implement both in `lucid_discharge_preparation_repository.ts`. `insertPlannedShift` calls the existing `renumberShifts` first, then inserts the `PLANNED` shift inside a savepoint so that a primary key violation becomes `DUPLICATE_ID` and leaves the transaction usable, then inserts door and area selections from `effectiveFrom`, as `writePlannedShiftCorrection` does. Document it in the abstract class as the other writes are (depends on T006).
- [X] T009 [P] Add `plannedShiftAdditionValidator` in `apps/api/app/discharges/shifts/planned_shift_validator.ts`:
  - `id` is a uuid, lower-cased;
  - `plannedStartAt` and `plannedEndAt` use `instant()`;
  - `responsibleUserId` is a uuid;
  - `truckIds` uses `truckIds()`, and `warehouseDoorIds` and `weighingAreaIds` use `resourceIds()`, each optional and defaulting to `[]`.

  Cover it in `apps/api/tests/unit/discharges/shifts/validator.spec.ts`: a missing id, start, end, or responsible is refused at its field; omitted lists become `[]`; duplicate ids in a list are refused.

**Checkpoint**: The correction suites are still green, and the rules, guard, repository write, and
validator exist. Addition stories can begin.

---

## Phase 3: User Story 1 - Add a Planned Shift to a Planned Discharge (Priority: P1) 🎯 MVP

**Goal**: A preparer adds a shift, with its period, responsible, and optional trucks, doors, and
weighing areas, to a planned discharge. The new shift's panel opens, in planned-start order.

**Independent Test**: On a planned discharge with two planned shifts, add a third between them with
an eligible responsible, two held trucks, a door a lot holds, and a weighing area. The Shifts section
lists three shifts in order, the new panel shows exactly those values, and the count reads three.

### Tests for User Story 1

- [X] T010 [P] [US1] Write `apps/api/tests/unit/discharges/shifts/add_planned_shift.spec.ts` with stubbed repositories, as `correct_planned_shift.spec.ts` does:
  - on a planned discharge, the use case locks the discharge, then the responsible, then the resources through `planPlannedShiftResources`;
  - it inserts with the sequences from `planAddedShiftSequences`;
  - it writes truck selections after the shift insert;
  - it returns `{ detail, created: true }`;
  - when `findShiftIdentity` finds the id, it returns `{ detail, created: false }` without any other lock or write.
- [X] T011 [P] [US1] Write `apps/api/tests/integration/discharges/shifts/add_planned_shift.spec.ts` for `POST /api/v1/discharges/:dischargeId/shifts` on a planned discharge. Build the discharge with `createPreparedDischarge` and `addPlannedShift`, plus `reserveTruck`, `assignDoorToLot`, and `createPlanningReferences` for resources. Cover:
  - 401;
  - 403 for an observer;
  - 201 for each of `PREPARING_ROLES`, with no resource: the shift is `PLANNED` with exactly the period and responsible;
  - 201 with one truck, one door, and one weighing area: the rows appear in `shift_trucks`, `shift_warehouse_doors`, and `shift_weighing_areas` with a null `effective_to`;
  - a shift added before, between, and after existing shifts: `data.shifts` is in planned-start order and the `sequence` values in the database are `1..n`;
  - a past period is accepted;
  - a replay with the same `id` answers 200, with one shift in the database;
  - the discharge's status, lots, pool, and door assignments, and the other shifts' periods, responsibles, and resources, are unchanged.

### Implementation for User Story 1

- [X] T012 [US1] Implement `AddPlannedShiftUseCase` in `apps/api/app/discharges/shifts/add_planned_shift_use_case.ts`. Input: `{ dischargeId, id, plannedStartAt, plannedEndAt, responsibleUserId, truckIds, warehouseDoorIds, weighingAreaIds }`. Inside one transaction:
  1. `lockDischargeOpenToShifts`.
  2. `findShiftIdentity`; a found id means a replay (`created: false`).
  3. Closed discharge: throw `DischargeClosedException`.
  4. Active discharge with any non-empty list: throw `DischargeNotPlannedException`.
  5. `listShifts`, then `findAddedShiftIssues`.
  6. Lock the responsible with `lockUsers` and check `isEligibleShiftResponsible`, reporting `ineligibleShiftResponsibleIssue('responsibleUserId')`.
  7. On a planned discharge, call `planPlannedShiftResources` with the new `id` as `shiftId`.
  8. Throw every collected issue at once.
  9. `planAddedShiftSequences`, then `insertPlannedShift`. `DUPLICATE_ID` throws `ShiftIdConflictException`.
  10. When the truck plan has inserts, `writeShiftTruckSelection`.

  After the commit, read `findDetail`; throw `DischargeNotFoundException` if missing. Return `{ detail, created }`. Make T010 green (depends on T002–T009).
- [X] T013 [US1] Add `store` to `apps/api/app/controllers/discharge_shifts_controller.ts`: authorize `update`, validate with `plannedShiftAdditionValidator`, call the use case with `parseInstant` for both instants, set `response.status(created ? 201 : 200)`, and serialize the detail. Register `router.post('/:dischargeId/shifts', [controllers.DischargeShifts, 'store']).as('shifts.store')` in `apps/api/start/routes.ts`, beside `shifts.update`. Regenerate the Tuyau registry with a short `node ace serve` boot, and commit `apps/api/.adonisjs/`. Make T011 green (depends on T012).
- [X] T014 [P] [US1] Add `addShiftFormValues(discharge)`, `addShiftRulesSchema(discharge)`, `toAddShiftBody(values, id, dischargeStatus)`, `ADD_SHIFT_FIELDS`, and `addShiftFieldOf` in `apps/web/src/features/discharges/discharge-preparation-schema.ts`, reusing `shiftCorrectionFieldsSchema` and the period rules of `shiftCorrectionRulesSchema`. `addShiftFormValues` defaults the period with `nextPlannedShift` after the last shift. `toAddShiftBody` omits the resource lists when the discharge is not `PLANNED`. Cover the defaults, the body mapping, and the overlap rule in `apps/web/src/features/discharges/__tests__/discharge-preparation-schema.test.ts`.
- [X] T015 [P] [US1] Add `canAddShifts(user, discharge)` in `apps/web/src/features/discharges/discharge-permissions.ts`, returning `canPrepareDischarges(user) && discharge.status !== 'CLOSED'`, with cases in `apps/web/src/features/discharges/__tests__/discharge-permissions.test.ts`.
- [X] T016 [US1] Add the `addShift` mutation in `apps/web/src/features/discharges/mutations/use-discharge-mutations.ts`, on `tuyauQuery.discharges.shifts.store.mutationOptions`. Its `onSuccess` is `applyDetail`, and its `onError` calls `refreshAfterStaleRefusal`, as `correctShift` does (depends on T013).
- [X] T017 [US1] Extract `ShiftResourceFields` from `ShiftEditForm` into `apps/web/src/features/discharges/ui/detail/shift-resource-fields.tsx`. It renders the Weighing areas, Warehouse doors, and Trucks groups, with their current rows, offered rows, locked notes, empty-state links, and refusal reasons. It takes `{ form, discharge, shiftId: string | null, refusals, onLeave }`, where `shiftId: null` means no current selection. Update `apps/web/src/features/discharges/ui/detail/shift-edit-panel.tsx` to use it. `apps/web/src/features/discharges/__tests__/detail/shift-edit.test.tsx` must stay green.
- [X] T018 [P] [US1] Write `apps/web/src/features/discharges/__tests__/detail/add-shift.test.tsx`:
  - as a lead on a planned discharge, `Add shift` is in the Shifts section header and in the empty state;
  - the sheet shows Responsible, Planned start, Planned end, and the three resource groups;
  - saving a period between two shifts with a truck, a door, and an area posts the expected body with a uuid `id`;
  - with a 201 detail from MSW, the toast "Shift added" shows, the sheet closes, the URL has `shiftId=<id>`, the new shift's panel is open, and the Shifts count grows;
  - a second click while saving posts once.
- [X] T019 [US1] Implement `AddShiftSheet` in `apps/web/src/features/discharges/ui/detail/add-shift-sheet.tsx`, per `contracts/ui-state.md`:
  - `Sheet` on the right on desktop and from the bottom on mobile, with the form mounted only while open;
  - an `id` from `crypto.randomUUID()` in `useState`, fixed when the sheet opens;
  - the Responsible combobox from `useResponsibleOptions`, the Duration hint, and the Planned start and Planned end fields;
  - `ShiftResourceFields` with `shiftId={null}`;
  - `SubmitButton` labelled `Add shift` with `WRITE_PENDING_LABELS.create`;
  - on success, `toast.success('Shift added')`, close, and navigate with `shiftSearch(id)`, `replace: true`, and `resetScroll: false`.

  Map 422 responses with `applyValidationError(formApi, error, ADD_SHIFT_FIELDS, addShiftFieldOf)` and `listRefusals`, as the correction does (depends on T014, T016, T017).
- [X] T020 [US1] Wire the action in `apps/web/src/features/discharges/ui/detail/discharge-shifts-card.tsx`: a `canAddShifts` prop, an `Add shift` button with `PlusIcon` in `DetailSection`'s `actions`, the same button in the "No shifts planned" empty state, and `AddShiftSheet` open state. Pass `canAddShifts={canAddShifts(user, discharge)}` from `apps/web/src/features/discharges/ui/detail/discharge-detail-page.tsx`. Make T018 green (depends on T015, T019).

**Checkpoint**: A preparer can add a shift, with resources, to a planned discharge end to end. This is
the MVP.

---

## Phase 4: User Story 2 - Add a Planned Shift to an Active Discharge (Priority: P1)

**Goal**: The next shifts of an active discharge can be added with their period and responsible,
after every started shift, and without resources.

**Independent Test**: On an active discharge with a completed shift, an active shift, and no planned
shift, add a shift after the active one: it is planned, has no resource, and the form offered none.
A shift planned before the active one is refused.

### Tests for User Story 2

- [X] T021 [P] [US2] Extend `apps/api/tests/integration/discharges/shifts/add_planned_shift.spec.ts` with an active discharge (`createPreparedDischarge('ACTIVE')`, with its shifts set to `COMPLETED` and `ACTIVE` through `#database/factories/shift_factory` states). Cover:
  - 201 for a period after the active shift: `PLANNED`, no selection row, discharge still `ACTIVE`;
  - 201 for a period between two planned shifts that start after the active one;
  - 422 `plannedStartAt` · `shiftAfterStartedShifts` for a start equal to or before the active shift's start;
  - the completed and active shifts keep their `sequence`, period, and resources.
- [X] T022 [P] [US2] Extend `apps/web/src/features/discharges/__tests__/detail/add-shift.test.tsx` with an active discharge fixture: `Add shift` is shown; the sheet shows no Weighing areas, Warehouse doors, or Trucks group, and describes that resources are chosen once the shift is added; the posted body has no resource list; a start before the active shift shows the started-shift error on Planned start before any request.

### Implementation for User Story 2

- [X] T023 [US2] Confirm that T012's active-discharge path makes T021 green. Fix the use case or `findAddedShiftIssues` if a started shift is renumbered, or if the rule compares with the wrong start.
- [X] T024 [US2] In `apps/web/src/features/discharges/discharge-preparation-schema.ts`, extend `addShiftRulesSchema(discharge)` with the started-shift rule: a start not after the latest `ACTIVE`/`COMPLETED` planned start raises "A new shift must start after {formatShiftPeriod(shift)}" on `plannedStartAt`. Add unit cases to `discharge-preparation-schema.test.ts`. In `add-shift-sheet.tsx`, render `ShiftResourceFields` only when `discharge.status === 'PLANNED'`, and switch the description text per `contracts/ui-state.md`. Make T022 green.

**Checkpoint**: Shifts can be added to planned and active discharges.

---

## Phase 5: User Story 3 - Be Stopped Before Adding an Incoherent Shift (Priority: P1)

**Goal**: Every rule an addition breaks is explained at its value, the input is kept, and nothing is
added.

**Independent Test**: Submit, in turn:
- no planned start;
- an end before the start;
- an overlapping period;
- an observer as responsible;
- a truck the discharge does not hold;
- a door no lot holds.

Each is refused at its field, the other values stay, and the shifts are unchanged.

### Tests for User Story 3

- [X] T025 [P] [US3] Write `apps/api/tests/integration/discharges/shifts/add_planned_shift_refusals.spec.ts`. Each case asserts the response and that the shift count and every selection table are unchanged:
  - 422 for each missing field;
  - 422 `plannedEndAt` · `shiftPeriodOrder`;
  - 422 `plannedStartAt` · `shiftOverlap`, while a touching period is 201 in a separate case;
  - 422 `responsibleUserId` · `eligibleShiftResponsible` for an observer, and for a deactivated lead;
  - 422 `truckIds.0` for a truck not held, and for a suspended held truck;
  - 422 `warehouseDoorIds.0` · `assignedWarehouseDoor` for an available door no lot holds, and · `availableWarehouseDoor` for an archived door;
  - 422 `weighingAreaIds.0` · `availableWeighingArea` for an archived area;
  - several issues at once are all returned in one response;
  - 404 `E_DISCHARGE_NOT_FOUND`;
  - 409 `E_DISCHARGE_CLOSED` on `createPreparedDischarge('CLOSED')`;
  - 409 `E_DISCHARGE_NOT_PLANNED` for resources on an active discharge;
  - 409 `E_SHIFT_ID_CONFLICT` for an `id` of another discharge's shift;
  - 403 for a deactivated preparer.
- [X] T026 [P] [US3] Write `apps/web/src/features/discharges/__tests__/detail/add-shift-refusals.test.tsx`:
  - client rules: missing values, end before start, and overlap show inline errors and send no request;
  - a 422 with `responsibleUserId`, `truckIds.0`, and `warehouseDoorIds.0` shows the responsible error, the "Some trucks…" and "Some warehouse doors…" alert titles, and each row's reason, and the alert takes focus;
  - every entered value is still in the form after each refusal;
  - a 500 shows `FormError` "Unable to add the shift", and retrying posts the same `id`.

### Implementation for User Story 3

- [X] T027 [US3] Make T025 green. Adjust the refusal order in `add_planned_shift_use_case.ts`, so that issues are collected before any throw and state conflicts are thrown before any reference lock. Adjust the field paths if a case disagrees with `data-model.md`.
- [X] T028 [US3] Make T026 green in `add-shift-sheet.tsx`: the refusal alert and focus, as in `shift-edit-panel.tsx`; `FormError` with `apiError.message` for a 409 `E_SHIFT_ID_CONFLICT` or a non-API failure; the `id` kept across retries.

**Checkpoint**: All P1 stories are complete and independently testable.

---

## Phase 6: User Story 4 - See What a Planned Shift Still Lacks to Start (Priority: P2)

**Goal**: Every planned shift states its gaps (no usable truck, door, or weighing area; a responsible
no longer eligible) in its panel and on the calendar, for every role, with no verdict.

**Independent Test**: On a planned discharge, open:
- a fully resourced shift: nothing missing;
- a shift with only a suspended truck: three resource gaps;
- a shift whose responsible was deactivated: the responsible gap.

The calendar marks the last two. An observer sees the same, without actions.

### Tests for User Story 4

- [X] T029 [P] [US4] Write `apps/api/tests/unit/discharges/shifts/readiness.spec.ts` for `plannedShiftReadinessGaps` (T031), with plain objects shaped like the detail read. Cover:
  - `null` for `ACTIVE` and `COMPLETED`;
  - `[]` when every type has a usable resource and the responsible is eligible;
  - `NO_USABLE_TRUCK` for no membership, an ended membership, a suspended truck, an archived truck, and a truck whose pool entry is released;
  - `NO_USABLE_WAREHOUSE_DOOR` for an archived door, a door of an archived warehouse, and a door whose lot assignment ended;
  - `NO_USABLE_WEIGHING_AREA` for an archived area or an ended membership;
  - `RESPONSIBLE_NOT_ELIGIBLE` for an observer, a deactivated user, and a pending user;
  - one usable resource among unusable ones clears the gap;
  - the codes always come in enum order.
- [X] T030 [P] [US4] Extend `apps/api/tests/integration/discharges/consultation/show.spec.ts`: every shift carries `readinessGaps`, `null` for active and completed shifts. A planned shift built with `reserveTruck`, `selectShiftTruck`, `assignDoorToLot`, and selections has `[]`. After suspending its truck and deactivating its responsible, it has `["NO_USABLE_TRUCK","RESPONSIBLE_NOT_ELIGIBLE"]`. An observer receives the same values, and the response still carries no responsible role or access status.

### Implementation for User Story 4

- [X] T031 [US4] Implement `apps/api/app/discharges/shared/planned_shift_readiness.ts`. Export `READINESS_GAPS`, the ordered code tuple, the `ReadinessGap` type, and `plannedShiftReadinessGaps(shift, discharge)`. It applies FR-018 and FR-019 exactly as `data-model.md` states, using `isEligibleShiftResponsible` from `#users/shared/shift_responsible_eligibility`. Doc comment: GH-65 revalidates the same conditions at start and should import this module. Make T029 green.
- [X] T032 [US4] Add `readinessGaps: plannedShiftReadinessGaps(shift, resource)` to each shift in `apps/api/app/discharges/shared/discharge_detail_transformer.ts`. Confirm that `DischargeRepository.findDetail` in `lucid_discharge_repository.ts` preloads the responsible's `role` and `accessStatus`, each membership's truck status, the door's warehouse, the pool's `releasedAt`, and the lots' door assignments; add any missing preload without extra queries. Regenerate the registry and commit `apps/api/.adonisjs/`. Make T030 green (depends on T031).
- [X] T033 [P] [US4] Add `readinessGaps` to every shift in `apps/web/src/features/discharges/__tests__/support/fixtures.ts`: `[]` for planned shifts that are fully resourced, the matching codes for the others, and `null` for started shifts. Run `pnpm --filter @portflow/web typecheck` to catch every fixture and `detailFromCreation` in `test-helpers.ts` (depends on T032).
- [X] T034 [P] [US4] Write `apps/web/src/features/discharges/__tests__/detail/shift-readiness.test.tsx`:
  - a planned shift with `[]` shows "Readiness" and "Nothing missing among trucks, warehouse doors, weighing areas, and responsible.";
  - a shift with all four codes lists "No usable truck", "No usable warehouse door", "No usable weighing area", and "Responsible is no longer eligible" in order;
  - an active shift shows no Readiness block;
  - no text matches `/ready|can start/i`;
  - for a lead on a planned discharge, the block holds no `Edit` of its own (the panel footer has it), and `Go to truck pool` shows only when the pool holds no truck;
  - an observer, and a lead on an active discharge, see the gaps without those actions;
  - after a correction response whose detail clears a gap, the block updates without a reload.
- [X] T035 [US4] Implement `ShiftReadiness` in `apps/web/src/features/discharges/ui/detail/shift-readiness.tsx`, with labels in a `READINESS_GAP_LABELS` record keyed by code. Render it in `apps/web/src/features/discharges/ui/detail/shift-details.tsx` between the period fields and the resource groups when `shift.readinessGaps !== null`, passing `canCorrect` and whether the pool holds a truck (`heldPoolEntries`). Make T034 green (depends on T033).
- [X] T036 [US4] In `apps/web/src/features/discharges/ui/detail/shift-calendar.tsx` and `apps/web/src/features/discharges/shift-calendar.ts`, replace `missingTrucks` and `lacksTrucks` with `hasGaps = (shift.readinessGaps?.length ?? 0) > 0`. Keep the `border-warning` class, add a `TriangleAlertIcon` (`aria-hidden`) beside the status badge, and replace the "No truck selected" screen-reader phrase with `plural(gapCount, 'gap')`. Update `apps/web/src/features/discharges/__tests__/detail/shifts.test.tsx` and `apps/web/src/features/discharges/__tests__/shift-calendar.test.ts`: a planned shift with gaps is announced with "N gaps" and shows the icon; a shift without gaps and a started shift show neither. Leave the Overview preparation summary's counts in `discharge-detail-sections.ts` unchanged, and keep `preparation-summary.test.tsx` green.

**Checkpoint**: Gaps are readable for every planned shift on every discharge.

---

## Phase 7: User Story 5 - Keep Additions Safe While Others Change the Discharge (Priority: P2)

**Goal**: Additions are judged on the state at commit time, never duplicate or overlap, and a stale
form explains itself and keeps what it can.

**Independent Test**: Two sessions: an overlapping addition after another user's is refused and names
the new shift. An addition with resources after the discharge started is refused as started, keeping
the period and responsible. A double submit adds one shift.

### Tests for User Story 5

- [X] T037 [P] [US5] Write `apps/api/tests/integration/discharges/shifts/add_planned_shift_concurrency.spec.ts`, outside `wrapInGlobalTransaction` and with explicit cleanup, following any existing concurrency spec in `tests/integration/discharges`. Cover:
  - two overlapping additions sent concurrently with `Promise.all` and different ids: exactly one 201 and one 422 `shiftOverlap`, one new shift, contiguous sequences;
  - the same body sent twice concurrently: one 201 and one 200, one shift;
  - a discharge set to `ACTIVE` before a resource-bearing addition: 409 `E_DISCHARGE_NOT_PLANNED`;
  - a replay after the discharge was closed: still 200;
  - a responsible deactivated before saving: 422 `eligibleShiftResponsible`.
- [X] T038 [P] [US5] Write `apps/web/src/features/discharges/__tests__/detail/add-shift-stale-state.test.tsx`:
  - 409 `E_DISCHARGE_NOT_PLANNED`: after MSW switches the detail to `ACTIVE`, the toast "This discharge has started" shows, the sheet stays open, the resource groups disappear, the period and responsible are kept, and the next save posts no resource list;
  - 409 `E_DISCHARGE_CLOSED`: the toast "This discharge is closed" shows and the sheet closes;
  - 404 `E_DISCHARGE_NOT_FOUND` closes with the shared message;
  - a 422 `shiftOverlap` after another user's addition shows the error on Planned start, and the refetched calendar shows that shift.

### Implementation for User Story 5

- [X] T039 [US5] Make T037 green. If concurrent overlapping inserts both succeed, check that `lockDischargeOpenToShifts` takes `FOR UPDATE` before `listShifts`, and that `findShiftIdentity` runs under the lock.
- [X] T040 [US5] Handle the state codes in `add-shift-sheet.tsx`:
  - `E_DISCHARGE_NOT_PLANNED`: `toast.error(STARTED_REFUSAL_MESSAGE)`, clear `truckIds`, `warehouseDoorIds`, and `weighingAreaIds`, and keep the sheet open. The refetched detail hides the groups.
  - `E_DISCHARGE_CLOSED`: toast "This discharge is closed", then close.
  - `E_DISCHARGE_NOT_FOUND`: the shared message, then close.

  Make sure `refreshAfterStaleRefusal` in `use-discharge-mutations.ts` refetches on `E_DISCHARGE_CLOSED` too. Make T038 green.

**Checkpoint**: Every user story is complete and independently testable.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T041 [P] Update `specs/discharge-execution/shift-execution-and-downtimes/roadmap.md`, setting the GH-63 row's status to `in-progress`, and mark `CONTEXT.md` untouched in the PR description: no new domain term was introduced (plan.md Constitution Check VI).
- [X] T042 [P] Run through `quickstart.md`: the API contract checks 1–9 against a fresh `db:fresh`, and the seven workbench checks, including mobile width for the sheet. Fix any divergence, in the code or in `quickstart.md` if the guide is wrong.
- [X] T043 Run the full verification gates from the repository root: `pnpm lint`, `pnpm typecheck`, `PORT=3399 pnpm --filter @portflow/api test`, and `pnpm --filter @portflow/web test`. All must pass (constitution VII).
- [X] T044 Request a fresh read-only review of the final diff (constitution VII). Resolve confirmed findings, or justify them in the PR description.
- [X] T045 [US1] Draw a shift on the calendar (FR-029): `instantAt`, `periodPieces`, and `drawnPeriod` in `apps/web/src/features/discharges/shift-calendar.ts`; the pointer gesture and its preview in `ui/detail/shift-calendar.tsx` behind an `onDraw` prop that `discharge-shifts-card.tsx` passes only with `canAddShifts`; `AddShiftSheet`'s `period` through `addShiftFormValues(discharge, period)`. Covered by `__tests__/shift-calendar.test.ts` and `__tests__/detail/draw-shift.test.tsx`.
- [X] T046 [US4] Read each break's duration (FR-030): `shiftId`, `duration`, and `labelled` on `shiftCalendar`'s breaks; the label in the hatched area and a break item before the following shift in `ui/detail/shift-calendar.tsx`. Covered by `__tests__/shift-calendar.test.ts` and `__tests__/detail/shifts.test.tsx`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: none.
- **Foundational (T002–T009)**: after Setup; blocks every story. T003 depends on T002, T006 on T005,
  and T008 on T006. T004, T005, T007, and T009 are parallel.
- **US1 (T010–T020)**: after Foundational. It is the MVP.
- **US2 (T021–T024)**: after US1, since it extends US1's use case, test file, sheet, and schema.
- **US3 (T025–T028)**: after US1. It may run alongside US2, but both touch `add-shift-sheet.tsx` and
  the schema, so sequence those edits.
- **US4 (T029–T036)**: API tasks T029–T032 depend only on Foundational and can start alongside US1.
  Web tasks T033–T036 need T032's regenerated registry.
- **US5 (T037–T040)**: after US1 and US3 (refusal handling in the sheet).
- **Polish (T041–T044)**: after every story.

### Within Each Story

Tests first and failing, then the rules or use case, then the controller or route, then the web
schema, mutation, and UI. Regenerate the registry before any web task that needs a new route or
field.

### Parallel Opportunities

- Foundational: T004, T005, T007, and T009 together; then T006; then T008.
- US1: T010, T011, T014, and T015 together; T018 alongside T017.
- US2: T021 and T022 together.
- US3: T025 and T026 together.
- US4: T029 and T030 alongside all of US1; T033 and T034 together once T032 lands.
- US5: T037 and T038 together.
- Polish: T041 and T042 together.

## Parallel Example: User Story 1

```text
Task: "T010 [US1] Unit tests for AddPlannedShiftUseCase in apps/api/tests/unit/discharges/shifts/add_planned_shift.spec.ts"
Task: "T011 [US1] Integration tests for POST shifts in apps/api/tests/integration/discharges/shifts/add_planned_shift.spec.ts"
Task: "T014 [US1] addShift schema helpers in apps/web/src/features/discharges/discharge-preparation-schema.ts"
Task: "T015 [US1] canAddShifts in apps/web/src/features/discharges/discharge-permissions.ts"
```

## Parallel Example: User Story 4

```text
Task: "T029 [US4] Readiness unit tests in apps/api/tests/unit/discharges/shifts/readiness.spec.ts"
Task: "T030 [US4] readinessGaps in apps/api/tests/integration/discharges/consultation/show.spec.ts"
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (baseline) and Phase 2 (foundation, with the correction suites still green).
2. Phase 3: add a shift with resources to a planned discharge.
3. **Stop and validate** with quickstart API checks 1–3 and workbench check 1. This is shippable on
   its own: planned discharges can grow their schedule.

### Incremental Delivery

1. US1 lets planned discharges receive shifts. This is the MVP.
2. US2 extends additions to active discharges, which unblocks GH-65 and GH-69 having a next shift.
3. US3 completes the refusal contract for every P1 flow.
4. US4 adds readiness gaps, independent of the addition flows.
5. US5 hardens concurrency and stale forms.

Each increment keeps every earlier test green. Commit per task or per logical group with Conventional
Commits (`feat(discharges): …`, `test(discharges): …`, `refactor(discharges): …`).
