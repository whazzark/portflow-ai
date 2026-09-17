---
description: "Task list for Confirm Discharge Start With Conflict Protection and Handling (GH-56)"
---

# Tasks: Confirm Discharge Start With Conflict Protection and Handling

**Input**: Design documents from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/confirm-discharge-start-with-atomic-conflict-protection/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required. Constitution IV mandates RED → GREEN → REFACTOR for business behavior, and
`apps/api/AGENTS.md` and `apps/web/AGENTS.md` name the test seams each layer must have. Write each
test task first, and confirm it fails for the expected reason before starting its implementation task.

**Organization**: Tasks are grouped by user story so that each story can be implemented and tested on
its own:
- **US1** reviews a ready discharge and starts it together with its first shift.
- **US2** refuses a start when another active discharge holds the dock, a truck, or a door, and
  serializes competing starts.
- **US3** refuses an incomplete or stale preparation, and completes the stale and failure outcomes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `[US1]`–`[US3]`, mapping to the user stories in `spec.md`

## Path Conventions

This is a PNPM/Turbo monorepo with `apps/api/` (AdonisJS) and `apps/web/` (TanStack Start). All
paths below are relative to the repository root. `F/` abbreviates `apps/web/src/features/discharges/`.

`#discharges/*`, `#models/*`, `#users/*`, `#shared/*`, `#database/*`, and `#generated/controllers`
are existing API import aliases. `@/…` is the web source alias.

**API conventions**, as GH-53 to GH-55 established them:
- **Use cases**: `@inject()` classes with an explicit `<UseCase>Input` type. They own the
  `db.transaction`, start with `lockPlannedDischarge` from
  `#discharges/shared/planned_discharge_guard`, and read the detail with
  `DischargeRepository.findDetail` after the transaction commits.
- **Repositories**: they return typed outcomes (`{ kind: … }`) and never throw HTTP exceptions. Row
  identities are made distinct, lower-case, and sorted before any lock (the `lockableIds` helper in
  `lucid_discharge_preparation_repository.ts`). Share locks use `query.knexQuery.forShare()`, and
  claim locks `query.knexQuery.forNoKeyUpdate()`.
- **Controllers**: authorize with `bouncer.with(DischargePolicy).authorize('start')` and return
  `serialize(DischargeDetailTransformer.transform(read))`, or the check's `{ data }`.
- **Exceptions**: extend `Exception` with `static status` and `static code`. The handler in
  `apps/api/app/exceptions/handler.ts` renders `meta` when the instance has it, as
  `app/users/invite/invitation_exceptions.ts` shows.
- **Integration tests**: `group.each.setup(() => testUtils.db().wrapInGlobalTransaction())`, in the
  order 401, 403, success per role, then endpoint-specific failures, each asserting nothing changed.
  Build on `apps/api/tests/integration/discharges/preparation/preparation_scenario.ts`.
- **Japa quirks**: `--files` matches whole path segments, a missing import hangs the runner, and a
  running `pnpm dev` holds the port.

**Web conventions**:
- Feature tests render through the real router with MSW (`renderDischargeDetail` and
  `renderDischargeTab` from `F/__tests__/support/test-helpers.ts`). They never mock the Tuyau client.
- Mutations follow `F/mutations/use-discharge-mutations.ts` (`applyDetail`,
  `refreshAfterStaleRefusal`).
- Refusals are parsed with `parseApiError` from `@/libraries/tuyau/api-error`.
- The dialog follows `F/ui/detail/withdraw-trucks-dialog.tsx`: mounted only while open, a refusal
  shown in a focused destructive `Alert`.
- Screen copy is exactly what `contracts/ui-state.md` specifies.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Start from a known-green baseline, so that every later red test is red because of this
slice.

- [X] T001 Run `pnpm --filter @portflow/api test` and `pnpm --dir apps/web exec vitest run` on the branch before any change, and record in the PR description that both pass. If either fails, stop and report instead of proceeding.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pieces every story shares:
- **API**:
  - the migration and its backfill, the models, and the seed;
  - the start fields in the detail and the `start` policy ability;
  - the problem taxonomy types, the refusal exception, and the start repository port with its
    unlocked state read;
  - the routes' wiring.
- **Web**: the DTO types, the fixture builders, and the MSW handler for the start.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for the shared pieces ⚠️

> Write these first and confirm they fail.

- [X] T002 [P] Create `apps/api/tests/integration/discharges/start/active_indexes.spec.ts` against T005, using factories only. It asserts:
  - a second `ACTIVE` discharge (`DischargeFactory.apply('active')`) on the same `dockId` is rejected by the database;
  - a `PLANNED` or `CLOSED` discharge on that dock is accepted;
  - a second `ACTIVE` shift (`ShiftFactory.apply('active')`) in one discharge is rejected, while an `ACTIVE` shift in each of two discharges is accepted.
- [X] T003 [P] Extend `apps/api/tests/unit/discharges/preparation/policy.spec.ts`: `DischargePolicy.start` allows `ACTIVE` operations leads, operations admins, and organization admins, and denies observers whatever their access status and preparing roles whose access is not `ACTIVE` (mirror the existing `update` cases).
- [X] T004 [P] Extend `apps/api/tests/integration/discharges/consultation/show.spec.ts`:
  - A planned discharge's detail has `startedAt: null` and `startedBy: null`, and each shift has `actualStartAt: null` and `startedBy: null`.
  - A discharge whose rows carry `startedAt`, `startedByUserId`, and a shift's `actualStartAt` and `startedByUserId` (set through factories) exposes them, with `startedBy` as `{ id, firstName, lastName }`.
  - A started row whose actor is `null` exposes `startedBy: null`.

### Implementation for the shared pieces

- [X] T005 Create `apps/api/database/migrations/1786300000000_add_discharge_start_confirmation.ts` per `data-model.md` Schema changes.
  - Add nullable `started_at` and `started_by_user_id` (uuid, references `users.id`, `onDelete('RESTRICT')`) to `discharges`, and nullable `actual_start_at` and `started_by_user_id` to `shifts`.
  - Backfill with raw SQL that runs on PostgreSQL and SQLite:
    - `UPDATE discharges SET started_at = COALESCE((SELECT MIN(planned_start_at) FROM shifts WHERE shifts.discharge_id = discharges.id), expected_start_at) WHERE status <> 'PLANNED'`
    - `UPDATE shifts SET actual_start_at = planned_start_at WHERE status <> 'PLANNED'`
  - Create `discharges_active_dock_unique` and `shifts_active_per_discharge_unique` with `this.schema.raw('CREATE UNIQUE INDEX … WHERE status = \'ACTIVE\'')`, as `1786200000000_add_current_planning_unique_indexes.ts` does.
  - `down()` drops both indexes, then the columns.
  - Run `node ace migration:run` in `apps/api` to regenerate `apps/api/database/schema.ts`, and commit it.
- [X] T006 [P] Add the start actor relations after T005:
  - `apps/api/app/models/discharge.ts`: `@belongsTo(() => User, { foreignKey: 'startedByUserId' }) declare startedBy`
  - `apps/api/app/models/shift.ts`: the same relation
- [X] T007 [P] Add `start(user: User): AuthorizerResponse` to `apps/api/app/discharges/shared/discharge_policy.ts`, returning `isEligibleShiftResponsible(user)`. Its doc comment says the start is authorized apart from corrections so a later slice can narrow it, and that whether the discharge is still planned is the use case's decision. Makes T003 pass.
- [X] T008 Expose the start fields in the detail after T006, making T004 pass:
  - In `apps/api/app/discharges/shared/repositories/lucid_discharge_repository.ts` `findDetail`, preload `startedBy` on the discharge and on each shift.
  - In `apps/api/app/discharges/shared/discharge_detail_transformer.ts`, add `startedAt` (ISO or `null`) and `startedBy` (`{ id, firstName, lastName }` or `null`) to the discharge, and `actualStartAt` and `startedBy` to each shift.
- [X] T009 [P] Update `apps/api/database/fixtures/discharge_preparation.ts` so every `ACTIVE` or `CLOSED` scenario sets `startedAt` to its earliest shift's `plannedStartAt`, and every `ACTIVE` or `COMPLETED` shift sets `actualStartAt` to its `plannedStartAt`. Leave the actors `null`, matching the migration's backfill (research.md Decision 6). Add both start fields to `DischargeFactory` and `ShiftFactory`'s `active`, `closed`, and `completed` states in `apps/api/database/factories/`, so factory rows respect the pairing.
- [X] T010 [P] Create `apps/api/app/discharges/start/discharge_start_rules.ts` with the types only, per `data-model.md` Start problem:
  - `StartProblemFamily`, `StartProblemCode` (the fifteen codes), and `ProblemRefType`.
  - `StartProblem = { family, code, subject: { type, id }, context?: { type, id }, holder?: { dischargeId, vesselName } }`.
  - `DischargeStartState`: the snapshot of research.md Decision 2. It has `discharge: { id, dockId, dockStatus }`, then:
    - `lots: Array<{ id, customerId, customerStatus, currentDoorIds: string[] }>`
    - `doors: Map<doorId, { status, warehouseStatus }>`
    - `heldTruckIds: string[]`
    - `firstShift: null | { id, responsible: { id, accessStatus, role }, trucks: Array<{ id, status }>, doorIds: string[], weighingAreas: Array<{ id, status }> }`
    - `holders: { dock: Holder | null, trucks: Map<truckId, Holder>, doors: Map<doorId, Holder> }`
  - `DischargeStartEvaluation = { shiftId: string | null; problems: StartProblem[] }`.
  - An `evaluateDischargeStart(state)` that returns `{ shiftId: state.firstShift?.id ?? null, problems: [] }` for now. US1 relies on it, and US2 and US3 fill it test-first.
- [X] T011 [P] Create `apps/api/app/discharges/start/discharge_start_exceptions.ts` with `DischargeStartRefusedException` (status 409, code `E_DISCHARGE_START_REFUSED`, message `This discharge cannot start yet`). It carries a readonly `meta: { shiftId: string | null; problems: StartProblem[] }` set from its constructor, as the invitation exceptions carry `meta`.
- [X] T012 Create the port `apps/api/app/discharges/shared/repositories/discharge_start_repository.ts` after T010. Every method takes a `TransactionClientContract` or `QueryClientContract`, and the doc comment of each lock method states its lock mode.
  - `readStartPlan(dischargeId, client)` returns `{ lots: Array<{ id, customerId }>, heldTruckIds, currentAssignments: Array<{ productLotId, warehouseDoorId }>, firstShift: null | { id, responsibleUserId, truckIds, warehouseDoorIds, weighingAreaIds } }`. The first shift is the planned shift with the lowest `planned_start_at`, then `sequence` (research.md Decision 7), and its selections are current rows only.
  - `readReferenceStatuses({ dockId, customerIds, userIds, truckIds, warehouseDoorIds, weighingAreaIds }, mode: 'READ' | 'CLAIM', client)` returns the statuses `DischargeStartState` needs (door with its warehouse's status, user with access status and role). With `CLAIM` it takes the locks of research.md Decision 4 steps 3–8 in that order: dock `FOR NO KEY UPDATE`, customers `FOR SHARE`, users `FOR SHARE`, trucks `FOR NO KEY UPDATE`, warehouses `FOR SHARE` then doors `FOR NO KEY UPDATE`, weighing areas `FOR SHARE`. Each is by sorted id, as separate statements.
  - `findActiveHolders({ dischargeId, dockId, truckIds, warehouseDoorIds }, client)` returns `{ dock, trucks, doors }` per `data-model.md` Other active discharges.
  - `activate({ dischargeId, shiftId, userId, instant }, client)` returns `{ kind: 'ACTIVATED' } | { kind: 'ACTIVE_ROW_CONFLICT' }`.
- [X] T013 Create `apps/api/app/discharges/shared/repositories/lucid_discharge_start_repository.ts` implementing T012's `readStartPlan` and `readReferenceStatuses` in `READ` mode only. `CLAIM`, `findActiveHolders`, and `activate` throw `new Error('not implemented')` until US1 and US2 fill them. Bind the port in `apps/api/providers/repositories_provider.ts`, as `DischargeUsageRepository` is bound.
- [X] T014 Create `apps/api/app/controllers/discharge_start_controller.ts` with `check` and `store`, each authorizing `start` and delegating to the use cases US1 creates. Register them in `apps/api/start/routes.ts` inside the discharges group, after `planning-options`:
  - `.get('/:id/start-check', [controllers.DischargeStart, 'check']).as('start_check')`
  - `.post('/:id/start', [controllers.DischargeStart, 'store']).as('start')`

  Boot the API once (`pnpm --filter @portflow/api dev`) to regenerate `apps/api/.adonisjs/`, and commit it.
- [X] T015 Add to `F/types.ts`: `StartCheckDto = Route.Response<'discharges.start_check'>['data']`, and `StartProblemDto = StartCheckDto['problems'][number]`. Also add a hand-written `StartRefusedMeta = { shiftId: string | null; problems: StartProblemDto[] }` for the error `meta`, which the registry does not type.
- [X] T016 [P] Extend `F/__tests__/support/fixtures.ts`:
  - `buildDischargeDetail` and `buildShift` default `startedAt`, `startedBy`, `actualStartAt`, and `startedBy` to `null`.
  - `DISCHARGE_DETAILS` for `MV Ocean Cedar` carries a start with `startedBy: null`.
  - Add `buildStartProblem(overrides)`, and `startableDetail()`: a planned detail whose lots all have a current door, and whose first planned shift has a truck, a door, and a weighing area.
- [X] T017 Add `mockDischargeStart({ user, detail, respondToCheck, respondToStart })` to `F/__tests__/support/test-helpers.ts`, following `mockDischargePlanning`. It serves the detail, and `GET …/start-check` (default: `{ data: { dischargeId, shiftId: first planned shift id, problems: [] } }`). `POST …/start` defaults to the detail with `status: 'ACTIVE'`, `startedAt`, `startedBy: user`, and the first planned shift active. It accepts `DischargeWriteAnswer` overrides and returns `state` with `current`, `detailRequests`, `checkRequests`, and `startRequests`.

**Checkpoint**: The migration runs on SQLite and PostgreSQL (`pnpm --filter @portflow/api db:fresh`). T002–T004 pass, and the existing API and web suites still pass.

---

## Phase 3: User Story 1 - Review the Preparation and Start the Discharge (Priority: P1) 🎯 MVP

**Goal**: A preparer opens `Start` on a planned discharge, reviews its customers, lots, doors, pool,
and first shift, and confirms. The discharge and its earliest planned shift become active at one
instant, recording the preparer. Observers and non-active users cannot.

**Independent Test**: As an operations lead, on a startable planned discharge, open the review,
check its content, confirm, and see the detail show `Active`, `Started … by …`, and the first shift
active with its start. As an observer, no `Start` button, and the API answers 403.

### Tests for User Story 1 ⚠️

- [X] T018 [P] [US1] Create `apps/api/tests/integration/discharges/start/start_scenario.ts`. `createStartableDischarge()` builds on `createPreparedDischarge()`:
  - a current door assignment for each of `wheat` and `barley` (`assignDoor`);
  - one reserved truck (`reserveTruck`), selected for `shift` (`selectShiftTruck`);
  - the shift's door, and a weighing area (`ShiftWarehouseDoorFactory`, `ShiftWeighingAreaFactory`);
  - a second planned shift one day later (`addPlannedShift`).

  It returns the prepared fields plus `truck`, `doors`, `weighingArea`, and `laterShift`.
- [X] T019 [P] [US1] Create `apps/api/tests/integration/discharges/start/start.spec.ts`:
  - **401** without a session.
  - **403** for observers and for each preparing role with a non-`ACTIVE` status. The discharge stays `PLANNED`.
  - **Success per `PREPARING_ROLES`**:
    - 200 with the detail: `status: 'ACTIVE'`, and `startedAt` equal to the first shift's `actualStartAt`, truncated to the second.
    - `startedBy.id` is the requester.
    - The first shift is `ACTIVE` with its `plannedStartAt`/`plannedEndAt` unchanged and `startedBy` the requester; `laterShift` stays `PLANNED` with `actualStartAt: null`.
  - **Nothing else written**: the pool, assignment, and selection rows are identical before and after, compared by id, `effectiveTo`, and `releasedAt`.
  - **First shift choice**: when `laterShift` has an earlier `plannedStartAt` than `shift`, `laterShift` is the one started.
  - **Missing discharge**: 404 `E_DISCHARGE_NOT_FOUND` for an unknown id and for a malformed one.
  - **Replay**: a second `POST` answers 409 `E_DISCHARGE_NOT_PLANNED`, and `startedAt` is unchanged.
  - **Not planned**: 409 `E_DISCHARGE_NOT_PLANNED` on `ACTIVE` and `CLOSED` discharges.
- [X] T020 [P] [US1] Create `apps/api/tests/integration/discharges/start/start_check.spec.ts`:
  - **401 and 403** as in T019.
  - **Ready discharge**: 200 `{ data: { dischargeId, shiftId: shift.id, problems: [] } }`, and nothing changed: the status stays `PLANNED`.
  - **Missing discharge**: 404.
  - **Not planned**: 409 `E_DISCHARGE_NOT_PLANNED` for active and closed discharges.
  - **No planned shift**: `shiftId: null` when every shift is `COMPLETED` or absent (build the rows with factories).
- [X] T021 [P] [US1] Create `apps/api/tests/unit/discharges/start/start_discharge.spec.ts` with the start repository, preparation repository, and `DischargeRepository` swapped in the container, as `tests/unit/discharges/truck_pool/withdraw.spec.ts` does:
  - An empty evaluation calls `activate` once with the discharge, the first shift, the user, and an instant truncated to the second.
  - `ACTIVE_ROW_CONFLICT` throws `DischargePlanningConflictException`.
  - A discharge that is not planned throws before any read.
  - The returned detail is read after the transaction.
- [X] T022 [P] [US1] Create `apps/api/tests/unit/discharges/start/check_discharge_start.spec.ts`: the use case returns the rules' evaluation with `dischargeId`, reads statuses in `READ` mode, and throws `DischargeNotFoundException` or `DischargeNotPlannedException` from an unlocked discharge read.
- [X] T023 [P] [US1] Create `F/__tests__/discharge-start-view.test.ts` for `startReview(detail, shiftId)`:
  - Customers are grouped with their lots in the detail's order, each lot listing only current doors as `{ door, warehouse }`, or none.
  - `heldTrucks` counts unreleased pool entries.
  - `shift` is the detail's shift with `shiftId`, with its current trucks (registration, suspended flag), doors, and weighing areas. `shift` is `null` for `shiftId: null`, or when that shift is missing from the detail.
- [X] T024 [P] [US1] Create `F/__tests__/start/start-review.test.tsx` with `mockDischargeStart`:
  - The lead on a planned discharge sees `Start` in the header. Opening it shows `Start <vessel>`, the vessel and dock, each customer with lots and `<door> · <warehouse>` (or `No warehouse door`), `<n> trucks held`, and the shift to start with its responsible and resources.
  - Initial focus is `Cancel`.
  - `Cancel` closes the dialog and sends no `POST`.
  - While the check loads, `Start discharge` is disabled.
- [X] T025 [P] [US1] Create `F/__tests__/start/start-success.test.tsx`: confirming sends one `POST` and shows `Starting…` with both buttons disabled while pending. On 200 the dialog closes, the toast `Discharge started` appears, the header shows `Active` and `Started <date> by <name>`, the Shifts section shows the started shift `Active` with its start, and the `Start` button, the preparation card, and the planning actions are gone.
- [X] T026 [US1] Extend `F/__tests__/detail/access.test.tsx`:
  - `Start` is shown for each preparing role on a planned discharge.
  - It is not shown for an observer on any status, nor for anyone on an active or closed discharge.
  - An active discharge's header shows `Started <date>` without `by` when `startedBy` is `null`.

### Implementation for User Story 1

- [X] T027 [US1] Create `apps/api/app/discharges/start/check_discharge_start_use_case.ts` (`CheckDischargeStartInput = { dischargeId }`):
  1. Read the discharge without a lock through `DischargeRepository` (add `findStatus(id): Promise<{ id, status, dockId } | null>` to `discharge_repository.ts` and `lucid_discharge_repository.ts`, `null` for malformed ids), and throw not found or not planned.
  2. `readStartPlan`, then `readReferenceStatuses(…, 'READ')`, then `findActiveHolders`.
  3. Build `DischargeStartState` and return `{ dischargeId, ...evaluateDischargeStart(state) }`.

  Extract the state assembly into an exported `buildStartState(plan, statuses, holders)` in `discharge_start_rules.ts`, so T028 reuses it. Makes T020 and T022 pass once `findActiveHolders` exists (T029 fills it with no-holder queries now, and US2 tests its matches).
- [X] T028 [US1] Create `apps/api/app/discharges/start/start_discharge_use_case.ts` (`StartDischargeInput = { dischargeId, userId }`). In one `db.transaction`:
  1. `lockPlannedDischarge`.
  2. `readStartPlan`.
  3. `readReferenceStatuses(…, 'CLAIM')`, with the truck ids being held pool trucks plus first-shift trucks, and the door ids being current assignment doors plus first-shift doors.
  4. `findActiveHolders`, then `buildStartState` and `evaluateDischargeStart`.
  5. When problems exist, throw `DischargeStartRefusedException({ shiftId, problems })`. Otherwise `activate` at `DateTime.now().toUTC().startOf('second')`, mapping `ACTIVE_ROW_CONFLICT` to `DischargePlanningConflictException`.

  After commit, return `findDetail`. Its doc comment states that the holder queries run only after every claim lock. Makes T021 pass.
- [X] T029 [US1] In `lucid_discharge_start_repository.ts`, implement:
  - **`activate`**: update the discharge `status = 'ACTIVE'`, `started_at`, `started_by_user_id`, `updated_at` where `id` and `status = 'PLANNED'`. Then the shift, the same where `id`, `discharge_id`, and `status = 'PLANNED'` (`actual_start_at`). Catch a unique violation on `discharges_active_dock_unique` or `shifts_active_per_discharge_unique` as `ACTIVE_ROW_CONFLICT`, detecting it as `isCurrentRowConflict` does in `lucid_discharge_preparation_repository.ts`. Run it in a savepoint so the transaction stays usable.
  - **`findActiveHolders`**: the three queries of `data-model.md`, each joined to `discharges` with `status = 'ACTIVE'` and `discharges.id <> dischargeId`. Return lower-case keyed maps with `{ dischargeId, vesselName }`, and skip queries with empty id lists.
  - **`readReferenceStatuses` in `CLAIM` mode**: the lock sequence of T012.
- [X] T030 [US1] Implement `check` and `store` in `apps/api/app/controllers/discharge_start_controller.ts`:
  - `check` returns `{ data: evaluation }`.
  - `store` passes `auth.user!.id` as `userId` and serializes the detail.

  Run T019 and T020 green.
- [X] T031 [P] [US1] Create `F/discharge-start-view.ts` with `startReview(detail, shiftId)` per T023. Reuse `groupLotsByCustomer` and `isInEffect` from `F/discharge-detail-view.ts`, and `heldPoolEntries` and `currentTruckIds` from `F/truck-pool-selection.ts`.
- [X] T032 [P] [US1] Add `startCheck(id)` to `F/queries/discharge-queries.ts`: `tuyauQuery.discharges.startCheck.queryOptions({ params: { id } }, { staleTime: 0, retry: false })`.
- [X] T033 [US1] Add `start` to `useDischargeMutations` in `F/mutations/use-discharge-mutations.ts`: `tuyauQuery.discharges.start.mutationOptions` with `onSuccess: applyDetail`, and `onError: (error, { params }) => refreshAfterStaleRefusal(error, params.id)`.
- [X] T034 [US1] Create `F/ui/start/start-review.tsx`, which renders `startReview`'s result as `contracts/ui-state.md` Content describes. Create `F/ui/start/start-discharge-dialog.tsx`, `StartDischargeDialog({ discharge, onClose })`:
  - It opens `Dialog` at `size="xl"` and loads `useQuery(dischargeQueries.startCheck(discharge.id))`.
  - While the check loads, it shows a skeleton line in place of the problems.
  - The footer holds `Cancel` (initial focus) and `Start discharge` (pending `Starting…`).
  - On success it calls `onClose` and `toast.success('Discharge started', { description: '<vessel> · shift of <planned start label>' })`.

  Problems and failures come in US2 and US3. Make T024 and T025 pass.
- [X] T035 [US1] Create `F/ui/start/start-discharge-action.tsx`, which holds the `Start` button and the dialog's open state. In `F/ui/detail/discharge-detail-page.tsx`, pass `actions={canCorrect ? <StartDischargeAction discharge={discharge} /> : undefined}` to `DischargeDetailHeader`.
- [X] T036 [US1] Show the start details:
  - In `F/ui/detail/discharge-detail-header.tsx`, when `discharge.startedAt` is set, add `Started <formatDateTime>` followed by ` by <first last>` when `startedBy` is set.
  - In `F/ui/detail/discharge-shifts-card.tsx`, add `Started <time> by <name>` (or without `by`) for shifts with `actualStartAt`.

  Make T026 pass.

**Checkpoint**: US1 is complete. A ready discharge starts end to end and the detail reflects it.
Without US2 and US3 an incomplete or conflicting discharge would also start, so the branch is
demoable but not mergeable.

---

## Phase 4: User Story 2 - Be Refused When Another Active Discharge Holds a Resource (Priority: P1)

**Goal**: A start is refused, with every conflict listed and naming the holding discharge, whenever
another active discharge uses the dock, holds a pool truck, or has a current assignment of one of
the discharge's current doors. Planned and closed discharges and shared weighing areas and
warehouses never refuse, and competing starts never both succeed.

**Independent Test**: With an active discharge on dock A holding truck T and door D, attempt to
start a planned discharge sharing all three. The check and the command list `DOCK_HELD`,
`TRUCK_HELD`, and `WAREHOUSE_DOOR_HELD` naming the active vessel, nothing changes, and the dialog
groups them under `Held by another active discharge` with links to that discharge.

### Tests for User Story 2 ⚠️

- [X] T037 [P] [US2] Create `apps/api/tests/unit/discharges/start/rules.spec.ts` with a `conflicts` group, building `DischargeStartState` literals:
  - A dock holder gives `DOCK_HELD` with subject dock and the holder.
  - A holder of a pool truck the first shift does not select still gives `TRUCK_HELD`.
  - A holder of a current door gives `WAREHOUSE_DOOR_HELD` with `context` the lot the door is assigned to.
  - With all three at once, all three are listed in dock, truck, door order, then by subject order.
  - With no holders there are no conflict problems.
- [X] T038 [P] [US2] Create `apps/api/tests/integration/discharges/start/start_conflicts.spec.ts` with `createStartableDischarge()` and a second discharge built with `createPreparedDischarge('ACTIVE')`:
  - **Holder on dock, pool truck, and door**: when that second discharge uses the same dock, holds the same truck, and has a current assignment of the same door, both the check and the command list the three conflicts with `holder.vesselName`.
  - **No change on refusal**: the command answers 409 `E_DISCHARGE_START_REFUSED` with `meta.problems`, and neither discharge changed.
  - **Holders that never refuse**:
    - The same sharing with a `PLANNED` holder, and with a `CLOSED` one, lets the start succeed and leaves the other discharge unchanged.
    - A released pool row or an ended assignment in an `ACTIVE` discharge does not conflict.
    - A shared weighing area, and a shared warehouse through a different door, do not conflict.
- [X] T039 [P] [US2] Create `apps/api/tests/integration/discharges/start/start_race.spec.ts` in the style of `tests/integration/users/role_change/final_admin.spec.ts`: no global transaction, manual cleanup in `group.each.setup`, and 20 rounds. Two startable discharges share one truck, and two starts are fired with `Promise.all` by two preparers. Exactly one answers 200, the other answers 409 with `E_DISCHARGE_START_REFUSED` (and a `TRUCK_HELD` problem) or `E_DISCHARGE_PLANNING_CONFLICT`, and exactly one of the two discharges is `ACTIVE`.
- [X] T040 [P] [US2] Create `apps/api/tests/unit/discharges/start/lock_order.spec.ts` in the style of `tests/unit/discharges/truck_pool/lock_order.spec.ts`. With recording repositories, `StartDischargeUseCase` calls, in order:
  1. `lockDischarge`
  2. `readStartPlan`
  3. `readReferenceStatuses` with mode `CLAIM`, and with truck and door id lists that include every held and current id
  4. `findActiveHolders`
  5. `activate`

  Add a Lucid-level test in the same file, with a recording `client`, that `readReferenceStatuses` in `CLAIM` mode issues the dock, customer, user, truck, warehouse, door, and weighing area statements in that order.
- [X] T041 [P] [US2] Extend `F/__tests__/discharge-start-view.test.ts` with `describeStartProblem(problem, detail)` for `DOCK_HELD`, `TRUCK_HELD`, and `WAREHOUSE_DOOR_HELD`: the text of `contracts/ui-state.md` and the link to the holder's detail with its section. Also add `groupStartProblems(problems)`, which gives the four family groups in taxonomy order and omits empty groups.
- [X] T042 [P] [US2] Create `F/__tests__/start/start-problems.test.tsx`:
  - **Conflicts from the check**: `Start discharge` stays enabled, and the alert `This discharge cannot start yet` shows the `Held by another active discharge` heading and each line.
  - **Link**: following a holder link closes the dialog and routes to that discharge's detail.
  - **Refusal on confirm**: a 409 `E_DISCHARGE_START_REFUSED` whose `meta.problems` differ from the check replaces the list, focuses the alert, keeps the dialog open, and refetches the detail.

### Implementation for User Story 2

- [X] T043 [US2] Implement the conflict rules in `evaluateDischargeStart` in `apps/api/app/discharges/start/discharge_start_rules.ts`: `DOCK_HELD`, `TRUCK_HELD` for every `heldTruckIds` entry with a holder, and `WAREHOUSE_DOOR_HELD` for every lot's current door with a holder, with the lot as `context`. Add the family-then-subject ordering helper that US3 extends. Makes T037 pass.
- [X] T044 [US2] Verify T029's `findActiveHolders` and `CLAIM` locks against T038–T040 and fix any gap. Then update the class doc comment of `apps/api/app/discharges/shared/repositories/discharge_preparation_repository.ts`:
  - Name the start's claim locks (`FOR NO KEY UPDATE` on docks, trucks, and doors, at their places in the existing order).
  - Record the obligation that runtime claims (GH-75, GH-76, GH-77) take the same lock before checking active holders (research.md Decision 4).
- [X] T045 [P] [US2] Add `describeStartProblem` and `groupStartProblems` to `F/discharge-start-view.ts` for the three conflict codes, with the holder link `{ to: '/discharges/$dischargeId', params: { dischargeId }, search: { tab } }`. Makes T041 pass.
- [X] T046 [US2] Create `F/ui/start/start-problems.tsx`:
  - It renders the destructive `Alert` (`ref`, `tabIndex={-1}`) with one list per group under its heading.
  - Each line is a link built from `describeStartProblem`. Section links use `DischargeTabLink` or `ShiftLink` from `F/ui/detail/discharge-tab-link.tsx`, holder links use a router `Link`, and every link calls `onNavigate` to close the dialog.
- [X] T047 [US2] Wire problems into `F/ui/start/start-discharge-dialog.tsx`:
  - Render `StartProblems` from the check's data when non-empty.
  - On a `mutateAsync` rejection whose `parseApiError(error).code` is `E_DISCHARGE_START_REFUSED`, `queryClient.setQueryData(dischargeQueries.startCheck(id).queryKey, { data: { dischargeId, ...(meta as StartRefusedMeta) } })`, invalidate the detail, and focus the alert.

  Makes T042 pass.

**Checkpoint**: US1 and US2 work together. Active-discharge conflicts are refused and shown, and
competing starts cannot both succeed.

---

## Phase 5: User Story 3 - Be Refused When the Preparation Is Incomplete or Stale (Priority: P2)

**Goal**: A start is refused, with every problem listed, when the discharge has no lot or planned
shift, a lot has no current door, the first shift lacks a usable truck, door, or weighing area, its
responsible is ineligible, or a reference is archived. A discharge started or changed meanwhile is
handled without starting twice, and failures unrelated to the preparation can be retried.

**Independent Test**: Attempt to start, in turn, a discharge whose first shift has no truck, no door,
or no weighing area, or a deactivated responsible. Then one with a lot without a door, one with no
planned shift, one whose dock was archived, and one already started from another tab. Each is refused
or reported with the offending item identified, and nothing changes.

### Tests for User Story 3 ⚠️

- [X] T048 [P] [US3] Extend `apps/api/tests/unit/discharges/start/rules.spec.ts` with `preparation`, `references`, `responsible`, and `ordering` groups. The preparation group:
  - `NO_PRODUCT_LOT`
  - `NO_PLANNED_SHIFT` with `shiftId: null`, and no shift problem
  - `LOT_WITHOUT_WAREHOUSE_DOOR` per lot
  - `SHIFT_WITHOUT_TRUCK` when the only truck is `SUSPENDED`, with no `TRUCK_ARCHIVED`, and when it is `ARCHIVED`, together with `TRUCK_ARCHIVED`; a suspended truck beside an available one gives no problem
  - `SHIFT_WITHOUT_WAREHOUSE_DOOR` when the shift's door is not currently assigned in the discharge or is archived, or its warehouse is
  - `SHIFT_WITHOUT_WEIGHING_AREA` when its only area is archived

  The references group:
  - `DOCK_ARCHIVED`
  - `CUSTOMER_ARCHIVED` with the lot as `context`
  - `WAREHOUSE_DOOR_ARCHIVED` once per lot context and once for the shift context, including for a door whose warehouse is archived
  - `WEIGHING_AREA_ARCHIVED`
  - `TRUCK_ARCHIVED`

  The responsible group: `RESPONSIBLE_INELIGIBLE` for an observer role and for each non-`ACTIVE` access status.

  The ordering group: a state with problems from all four families lists them family by family, and every applicable problem is present.
- [X] T049 [P] [US3] Create `apps/api/tests/integration/discharges/start/start_refusals.spec.ts` with one representative per family through the command, each asserting 409 `E_DISCHARGE_START_REFUSED`, the expected codes in `meta.problems`, and that the discharge, its shifts, and every planning row are unchanged:
  - **Incomplete preparation**: a lot without a door, plus a first shift without weighing area.
  - **Unavailable reference**: dock archived through the factory, bypassing the archive guard.
  - **Ineligible responsible**: responsible deactivated through the factory.
  - **Conflict family**: covered by T038.

  Also assert that the check lists exactly the same problems for each case.
- [X] T050 [P] [US3] Extend `F/__tests__/discharge-start-view.test.ts` with `describeStartProblem` for the twelve remaining codes: text, link (`tab`, and `shiftId` for shift contexts), and the bracketed fallback text when the subject is not in the detail.
- [X] T051 [P] [US3] Create `F/__tests__/start/start-refusals.test.tsx`:
  - The four groups render in order with their headings.
  - A shift problem's link closes the dialog and opens the Shifts section with `shiftId`.
  - A lot problem's link opens Product lots.
  - The check's failure shows `Unable to check this discharge.` and `Retry`, keeps `Start discharge` disabled, and `Retry` refetches.
  - A 500 or network error on `POST` shows `Unable to start this discharge. Try again.` inline with the dialog open and `Start discharge` enabled.
  - A 409 `E_DISCHARGE_PLANNING_CONFLICT` shows the `PLANNING_CONFLICT_MESSAGE` toast, keeps the dialog open, and refetches the check and the detail.
- [X] T052 [P] [US3] Create `F/__tests__/start/start-stale.test.tsx` with `test.each`, as `F/__tests__/planning/stale-state.test.tsx` does:
  - **`POST` answering 409 `E_DISCHARGE_NOT_PLANNED`**: toast `This discharge has already started`, the dialog closes, and the detail is refetched and shows `Active` without `Start`.
  - **`POST` answering 404 `E_DISCHARGE_NOT_FOUND`**: the stale toast, and the dialog closes.
  - **`POST` answering 403**: toast `You are not allowed to start discharges`, and the dialog closes.
  - **The check answering 409 `E_DISCHARGE_NOT_PLANNED` or 404**: the same closing outcomes.

### Implementation for User Story 3

- [X] T053 [US3] Implement the remaining rules in `apps/api/app/discharges/start/discharge_start_rules.ts` per `data-model.md` Usability rules and the code table. Use `isEligibleShiftResponsible` from `#users/shared/shift_responsible_eligibility` for `RESPONSIBLE_INELIGIBLE`, and complete the ordering. Makes T048 pass, then run T049 and fix any read gap in `lucid_discharge_start_repository.ts`, such as the customers' or warehouses' statuses.
- [X] T054 [P] [US3] Complete `describeStartProblem` in `F/discharge-start-view.ts` for every code, with the texts, links, and fallbacks of `contracts/ui-state.md`, reusing `lotLabel` from `F/discharge-planning-view.ts` and `formatShiftDay`/`formatShiftTime` from `F/discharge-detail-view.ts`. Makes T050 pass.
- [X] T055 [US3] Complete the dialog's states and outcomes in `F/ui/start/start-discharge-dialog.tsx` per `contracts/ui-state.md` States and Outcomes:
  - **Check failure**: the message with `Retry` (`refetch`).
  - **Other `POST` failures**: inline, dialog kept open.
  - **`E_DISCHARGE_PLANNING_CONFLICT`**: toast, then refetch the check and invalidate the detail.
  - **Stale answers**: `E_DISCHARGE_NOT_PLANNED`, `E_DISCHARGE_NOT_FOUND`, and 403 from either the check or the command show the toast and call `onClose`. The mutation's `refreshAfterStaleRefusal` invalidates the detail.

  Makes T051 and T052 pass.

**Checkpoint**: All user stories are independently functional. This is the minimum mergeable scope.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Gates, seed validation, documentation, and review.

- [X] T056 Run `pnpm --filter @portflow/api db:fresh` against PostgreSQL. It must succeed, proving the backfill and both partial unique indexes accept the seed. Then walk through `quickstart.md` "Validate the API contract", "Validate the race on PostgreSQL", and "Validate the screen", and fix any divergence, in the code or in the guide.
- [X] T057 [P] Confirm `F/__tests__/detail/preparation-summary.test.tsx` still passes: the Preparation region never mentions starting. Confirm the existing `F/__tests__/detail/*` and `F/__tests__/planning/*` suites pass unchanged, apart from the builder defaults T016 added.
- [X] T058 [P] Review every new API file for doc comments in the density of `change_lot_warehouse_doors_use_case.ts` and `discharge_resource_planning_rules.ts`. They explain why, and cover the lock order, the claim lock mode, why the check's reads are unlocked, and why no planning row is written.
- [X] T059 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` at the repository root, and fix every failure.
- [ ] T060 Update `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md`: set GH-56's status to reflect delivery once merged, and mark every task in this file done.
- [X] T061 Run a fresh read-only review of the final diff (constitution VII), resolve or justify each confirmed finding, and record the outcome in the PR description.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup and blocks every story.
- **US1 (Phase 3)**: depends on Foundational. This is the MVP.
- **US2 (Phase 4)**: depends on US1's use cases (T027, T028), repository (T029), and dialog (T034). Its rules (T043) and view helpers (T045) can start as soon as Foundational is done.
- **US3 (Phase 5)**: depends on US2's problem rendering (T046, T047) and ordering helper (T043). Its rules (T053) and view texts (T054) can start in parallel with US2's.
- **Polish (Phase 6)**: depends on every story being done.

### Within each story

Tests are written first and must fail. Then, in order: rules, repository, use case, controller and
route, web view helpers, query and mutation, dialog, header and cards.

### Key task dependencies

- **Phase 2**: T006 and T009 depend on T005; T008 on T006; T012 on T010; T013 on T012; T014 on T013; T015 on T014 (registry); T017 on T015 and T016.
- **US1**: T027 depends on T013; T028 on T011 and T027; T029 on T012; T030 on T027–T029; T032 and T033 on T014 (registry); T034 on T031–T033; T035 on T034; T036 on T008.
- **US2**: T043 depends on T010; T044 on T029; T045 on T031; T046 on T045; T047 on T034 and T046.
- **US3**: T053 depends on T043; T054 on T045; T055 on T047.

### Parallel opportunities

- **Phase 2**:
  - T002, T003, and T004 together.
  - Then T005, T007, T010, T011, and T016 together.
  - T006 and T009 after T005; T012 after T010; T013, T014, T015, and T017 in sequence.
- **US1 tests**: T018–T025 together. T026 after T016, whose builder defaults it relies on.
- **US1 implementation**: T031 and T032 in parallel with T027–T030.
- **US2 tests**: T037–T042 together. **US2 implementation**: T043 and T045 in parallel.
- **US3 tests**: T048–T052 together. **US3 implementation**: T053 and T054 in parallel.

---

## Parallel Example: User Story 1

```bash
# All US1 tests at once (different files):
Task: "T018 API start_scenario.ts"
Task: "T019 API integration start.spec.ts"
Task: "T020 API integration start_check.spec.ts"
Task: "T021 API unit start_discharge.spec.ts"
Task: "T022 API unit check_discharge_start.spec.ts"
Task: "T023 Web unit discharge-start-view.test.ts (startReview)"
Task: "T024 Web start/start-review.test.tsx"
Task: "T025 Web start/start-success.test.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T037 API unit rules.spec.ts (conflicts)"
Task: "T038 API integration start_conflicts.spec.ts"
Task: "T039 API integration start_race.spec.ts"
Task: "T040 API unit lock_order.spec.ts"
Task: "T041 Web unit discharge-start-view.test.ts (conflict problems)"
Task: "T042 Web start/start-problems.test.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T048 API unit rules.spec.ts (preparation, references, responsible, ordering)"
Task: "T049 API integration start_refusals.spec.ts"
Task: "T050 Web unit discharge-start-view.test.ts (remaining codes)"
Task: "T051 Web start/start-refusals.test.tsx"
Task: "T052 Web start/start-stale.test.tsx"
```

T041 and T050 extend the same file as T023: run each after the previous one lands. The same goes
for T037 and T048 in `rules.spec.ts`.

---

## Implementation Strategy

### MVP first (User Story 1)

1. Phase 1 baseline, then Phase 2 foundations.
2. Phase 3, US1: preparers review and start a ready discharge end to end, observers cannot, and a
   replay starts nothing.
3. **Stop and validate** with the US1 independent test and the successful-start part of
   `quickstart.md`.

US1 alone would start a conflicting or incomplete discharge, so it is demoable but not mergeable.

### Incremental delivery

1. US1 → a demoable start flow.
2. US2 → active-discharge exclusivity and serialized starts. With US1, this delivers the roadmap's
   atomic reservation.
3. US3 → complete preparation checks and every stale and failure outcome. **This is the minimum
   mergeable scope**: without it, a discharge could start with a lot without a door or a shift
   without resources.
4. Polish → gates, `db:fresh`, quickstart, fresh review, then the PR is ready for human review.

Each story ends at a checkpoint where the full API and web suites pass, so the branch can be paused
or reviewed after any of them.
