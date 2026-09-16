---
description: "Task list for Plan the Discharge Truck Pool and Shift Subsets (GH-55)"
---

# Tasks: Plan the Discharge Truck Pool and Shift Subsets

**Input**: Design documents from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/plan-the-discharge-truck-pool-and-shift-subsets/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required. Constitution IV mandates RED → GREEN → REFACTOR for business behavior, and
`apps/api/AGENTS.md` and `apps/web/AGENTS.md` name the test seams each layer must have. Write each
test task first and confirm it fails for the expected reason before starting its implementation
task.

**Organization**: Tasks are grouped by user story so that each story can be implemented and tested
on its own:
- US1 reserves trucks, with the `Also held` warnings.
- US2 selects the trucks of each planned shift.
- US3 withdraws trucks, and removes them from planned shifts.
- US4 keeps every change coherent when others act at the same time.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `[US1]`–`[US4]`, mapping to the user stories in `spec.md`

## Path Conventions

This is a PNPM/Turbo monorepo with `apps/api/` (AdonisJS) and `apps/web/` (TanStack Start). All paths
below are relative to the repository root.

`#discharges/*`, `#trucks/*`, `#models/*`, `#shared/*`, `#database/factories/*`, and
`#generated/controllers` are existing API import aliases. `@/…` is the web source alias.

API conventions to follow throughout, as in GH-53:
- **Use cases**: `@inject()` classes with an explicit `<UseCase>Input` type, owning
  `db.transaction`. They lock through `lockPlannedDischarge` from
  `#discharges/shared/planned_discharge_guard`, and return `DischargeRepository.findDetail(...)`
  after commit.
- **Repositories**: they take the `TransactionClientContract` last, return typed outcomes
  (`{ kind: … }`), never throw HTTP exceptions, and guard identities with `isUuid` from
  `#shared/database/is_uuid`. Each write bumps the discharge's `updated_at` through the existing
  `touchDischarge`.
- **Refusals of an entered value**: raised with `throwPreparationIssues` from
  `#discharges/shared/discharge_preparation_issues`.
- **Controllers**: `await bouncer.with(DischargePolicy).authorize('update')`, then
  `request.validateUsing(...)`, then the use case, then
  `serialize(DischargeDetailTransformer.transform(read))`.
- **Tests**: follow `apps/api/tests/README.md`: 401, 403, success per preparing role, then
  endpoint-specific failures. Integration groups use `testUtils.db().wrapInGlobalTransaction()`.
  Unit tests swap repositories with `app.container.swap(...)` and record `calls[]` to assert lock
  order.

Web conventions:
- Feature tests render through the real router with MSW (`renderDischargeDetail`) and never mock
  the Tuyau client.
- Errors are read with `parseApiError` from `@/libraries/tuyau/api-error`.
- Pending copy comes from `@/helpers/resource-copy`.
- Selection uses `useBulkSelection` from `@/components/lifecycle/use-bulk-selection`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Start from a known-green baseline, so that every later red test is red because of this
slice.

- [X] T001 Run `pnpm --filter @portflow/api test` and `pnpm --dir apps/web exec vitest run` on the branch before any code change, and note in the PR description that both pass. If either fails, stop and report instead of proceeding.
  **Result (2026-09-15)**: API 1,556 passed; web 319 files, 1,554 passed. The worktree needed a local, gitignored `apps/api/.env` built from `.env.example` with a generated `APP_KEY` before the API suite could boot.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the pieces every story shares:
- API: the request validators, the shift exceptions, the issue messages, the locked reads of the
  pool, trucks, and shifts, the detail read model with `otherHoldings`, and the scenario helpers.
- Web: the pure selection and refusal adapters, the fixtures, the stateful MSW helper, and passing
  `canCorrect` to the two cards.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for the shared pieces ⚠️

> Write these first and confirm they fail.

- [X] T002 [P] Create `apps/api/tests/unit/discharges/truck_pool/validators.spec.ts` for the validators of T008.
  - `truckIdsValidator` accepts one lower-case UUID, one upper-case UUID, and 500 distinct UUIDs.
  - It refuses: a missing `truckIds`, `[]`, 501 UUIDs, `['not-a-uuid']`, `truckIds: 'x'`, and two identical UUIDs (field `truckIds`, rule `distinct`).
  - `shiftTruckSelectionValidator` accepts `[]` and 500 UUIDs, and refuses 501, duplicates, and a missing `truckIds`.
- [X] T003 [P] Create `apps/api/tests/integration/discharges/truck_pool/detail_holdings.spec.ts`, for `GET /api/v1/discharges/:id`, using the scenario helpers of T012.
  - A planned discharge A holds truck T. Planned discharge B and active discharge C also hold T, while closed discharge D has a released row for T. A's pool entry for T has `otherHoldings` equal to C then B: `ACTIVE` first, then by vessel name. Each item is `{ dischargeId, vesselName, status }`.
  - A's entry for a truck no other discharge holds has `otherHoldings: []`.
  - A released entry of A has `otherHoldings: []`, even when T is held elsewhere.
  - Every entry of closed D has `otherHoldings: []`.
  - C's entry for T lists A and B.
  - An active observer receives the same `otherHoldings`.
  - Every other field of the detail is unchanged; the existing consultation suite pins the rest.
- [X] T004 [P] Create `apps/web/src/features/discharges/truck-pool-selection.test.ts`, a pure unit test of T018 using `buildDischargeDetail`, `buildPoolEntry`, and `buildShift` from the test fixtures:
  - `heldPoolEntries(detail)` returns entries with `releasedAt === null` on a non-closed discharge, in pool order.
  - `shiftsSelectingTrucks(detail, truckIds)` returns only `PLANNED` shifts whose trucks with `effectiveTo === null` include one of the ids, in `plannedStartAt` order. It ignores ended rows and non-planned shifts.
  - `offeredShiftTrucks(detail, shiftId)` returns held, non-suspended trucks, plus suspended trucks currently selected for that shift, each with `{ truckId, registration, truckStatus, selected, canCheck }`. `canCheck` is `false` for a suspended truck.
  - `candidateMatchesSearch(candidate, search)` matches registration or transport company name, ignoring case, accents, and surrounding spaces, and an empty search matches everything.
- [X] T005 [P] Create `apps/web/src/features/discharges/truck-pool-refusals.test.ts`, a pure unit test of T019.
  - `truckRefusals(error, submittedTruckIds)` maps each `E_VALIDATION_ERROR` detail at `truckIds.N` to `{ truckId: submittedTruckIds[N], message }`.
  - A detail at `truckIds` or at an index beyond the list goes to `summary`.
  - A non-validation error returns `null`.
  **Note**: The pure tests live in `apps/web/src/features/discharges/__tests__/`, beside the feature's other pure tests, and `truckRefusals` takes the already parsed `ApiError` rather than the raw error, so it stays pure.

### API implementation

- [X] T006 [P] Add two exceptions to `apps/api/app/discharges/shared/discharge_exceptions.ts`, following the existing classes:
  - `ShiftNotFoundException`: 404, `E_SHIFT_NOT_FOUND`, `Shift not found`.
  - `ShiftNotPlannedException`: 409, `E_SHIFT_NOT_PLANNED`, `Only a planned shift's trucks can be selected`.
- [X] T007 [P] Create `apps/api/app/discharges/shared/truck_pool_rules.ts` with the issue helpers only. The planners come in each story. Export:
  - `TRUCK_ISSUE_MESSAGES`:
    - `availableTruck: 'This truck is no longer available to reserve'`;
    - `heldTruck: "This truck is no longer in this discharge's pool"`;
    - `selectableTruck: 'A suspended truck cannot be newly selected'`.
  - `truckIssue(index: number, rule: keyof typeof TRUCK_ISSUE_MESSAGES): PreparationIssue`, returning `{ field: \`truckIds.${index}\`, rule, message }`.

  Doc-comment the module as pure: no database, as research.md Decision 6 requires.
- [X] T008 [P] Create `apps/api/app/discharges/truck_pool/truck_pool_validators.ts`, exporting two validators. Makes T002 pass.
  - `truckIdsValidator = vine.create({ truckIds: vine.array(vine.string().uuid()).minLength(1).maxLength(500).distinct() })`
  - `shiftTruckSelectionValidator = vine.create({ truckIds: vine.array(vine.string().uuid()).maxLength(500).distinct() })`
  **Note**: Vine's `distinct()` runs before `toLowerCase()`, so the existing `distinctUuids` rule of `#shared/validators/lifecycle_validator` is now exported and reused.

  If Vine's `distinct()` is case-sensitive, add a rule that compares lower-cased values, so two casings of one UUID are refused too (research.md Decision 7).
- [X] T009 Create `apps/api/app/discharges/shared/discharge_detail_read.ts`, exporting:
  - `type OtherHolding = { dischargeId: string; vesselName: string; status: 'PLANNED' | 'ACTIVE' }`;
  - `type DischargeDetailRead = { discharge: Discharge; otherHoldings: ReadonlyMap<string, OtherHolding[]> }`, keyed by lower-cased truck id.

  Then change `findDetail(id)` in `apps/api/app/discharges/shared/repositories/discharge_repository.ts` and `lucid_discharge_repository.ts` to return `Promise<DischargeDetailRead | null>`:
  - After the existing preloads, collect the truck ids of assignments with `releasedAt === null`, only when the discharge is not `CLOSED`.
  - Run one query: `discharge_truck_assignments` joined to `discharges`, with `truck_id IN (…)`, `released_at IS NULL`, `discharges.status IN ('PLANNED','ACTIVE')`, and `discharges.id <> :id`. Select `truck_id`, `discharges.id`, `vessel_name`, and `status`, ordered by `CASE status WHEN 'ACTIVE' THEN 0 ELSE 1 END`, `vessel_name`, then `discharges.id`.
  - Group the rows into the map. Skip the query when there are no held trucks.
- [X] T010 Update `apps/api/app/discharges/shared/discharge_detail_transformer.ts` so `transform` takes a `DischargeDetailRead`. Each `truckPool` item gains `otherHoldings: read.otherHoldings.get(assignment.truckId.toLowerCase()) ?? []`, forced to `[]` when `assignment.releasedAt !== null` or the discharge is `CLOSED`.
  - Update the six call sites to pass the read: `discharges_controller.ts` `show`, `store`, `update`, and `discharge_product_lots_controller.ts` `store`, `update`, `destroy`.
  - Update the GH-53 use cases that return `findDetail` results (`create_planned_discharge_use_case.ts`, `correct_discharge_identity_use_case.ts`, `add_product_lot_use_case.ts`, `correct_product_lot_use_case.ts`, `remove_product_lot_use_case.ts`) to return the read, and their unit specs under `apps/api/tests/unit/discharges/preparation/` whose `findDetail` stubs return a `Discharge`.
  **Note**: `tests/unit/discharges/consultation/show.spec.ts` unwraps the read in its helpers, and `tests/integration/discharges/consultation/show.spec.ts` now pins `otherHoldings: []` on a released entry. The GH-53 use cases needed no change: they return `findDetail`'s value as is.

  Depends on T009. Makes T003 pass; the existing consultation and preparation suites must stay green.
- [X] T011 Extend `apps/api/app/discharges/shared/repositories/discharge_preparation_repository.ts` and `lucid_discharge_preparation_repository.ts` with four locked reads. Document in the class comment that the lock order is now discharge, then trucks (research.md Decision 4). Every method takes the client last.
  - `lockTrucks(ids, client): Promise<Map<string, LockedTruck>>`
    - `LockedTruck = { id, status, registration, transportCompanyId, transportCompanyName }`.
    - `trucks` is left-joined to `transport_companies`, with `lockableIds(ids)`, `orderBy('trucks.id')`, and `query.knexQuery.forShare('trucks')`, keyed by lower-cased id.
    - When `transportCompanyName` is null, it falls back to the same `'Transport non référencé'` label the fixtures use for a missing company.
  - `listTruckPool(dischargeId, client)`: `{ id, truckId, releasedAt }[]` for the discharge, no lock beyond the discharge's.
  - `listCurrentShiftTruckSelections(dischargeId, client)`: `{ id, shiftId, truckId }[]` from `shift_trucks` joined to `shifts`, with `shifts.discharge_id = :id`, `shifts.status = 'PLANNED'`, and `effective_to IS NULL`.
  - `findShift(dischargeId, shiftId, client)`: `{ id, status } | null`, returning `null` when `!isUuid(shiftId)` or the shift belongs to another discharge.
  **Note**: `lockTrucks` locks `trucks` `FOR SHARE` and preloads the company in a second read, rather than joining it, so the lock stays on the truck rows only.
- [X] T012 [P] Extend `apps/api/tests/integration/discharges/preparation/preparation_scenario.ts` with helpers built on the existing factories (`TruckFactory`, `TransportCompanyFactory`, `DischargeTruckAssignmentFactory`, `ShiftTruckFactory`):
  - `createAvailableTruck(overrides?)`, which also creates its transport company;
  - `reserveTruck(discharge, truck, { released?: boolean })`, which captures the snapshots like a real reservation;
  - `selectShiftTruck(shift, truck, { ended?: boolean })`;
  - `truckPoolRows(dischargeId)` and `shiftTruckRows(shiftId)`, which return raw rows for asserting that nothing changed.

### Web implementation

- [X] T013 [P] Extend `apps/web/src/features/discharges/__tests__/support/fixtures.ts`:
  - `buildPoolEntry` gains `otherHoldings: []` by default, and an optional override.
  - Add `buildTruckCandidate(overrides)` returning `{ id, registration, transportCompany: { id, name }, otherHoldings: [] }`.
  - Add `TRUCK_CANDIDATES`: four candidates, one of them held by an active discharge `MV Ocean Cedar`.
- [X] T014 Add `mockTruckPlanning` to `apps/web/src/features/discharges/__tests__/support/test-helpers.ts`. Model it on `mockDischargeCorrections`: stateful `state.current`, `detailRequests`, and a `requests` log.
  - Options: `{ user = OPERATIONS_LEAD, detail, candidates = TRUCK_CANDIDATES, respondToCandidates, respondToReserve, respondToWithdraw, respondToShiftTrucks }`, each a `DischargeWriteAnswer`.
  - When an answer is `undefined`, the handler applies the change to `state.current` and returns `{ data: state.current }`:
    - reserve appends pool entries built from the candidates;
    - withdraw removes held entries and those trucks' current rows from planned shifts;
    - shift trucks replaces the shift's current rows.
  - The handlers are:
    - `GET {API_BASE_URL}/discharges/:dischargeId/truck-pool/candidates`;
    - `POST …/truck-pool`;
    - `POST …/truck-pool/withdrawals`;
    - `PUT …/shifts/:shiftId/trucks`.

  Depends on T013.
- [X] T015 [P] Add the TypeScript type for the candidate and holding shapes to `apps/web/src/features/discharges/types.ts` (create the section if absent): `TruckCandidateDto = Route.Response<'discharges.truck_pool.candidates'>['data'][number]`. Until the registry exists (T031), declare it structurally from `contracts/truck-pool.openapi.yaml` and switch to the `Route` type in T032.
- [X] T016 Update `apps/web/src/features/discharges/ui/detail/discharge-detail-page.tsx` to pass `canCorrect` to `DischargeShiftsCard` and `DischargeTruckPoolCard`, and add the optional `canCorrect?: boolean` prop, unused for now, to both cards. The existing detail tests must stay green.
- [X] T017 [P] Create `apps/web/src/features/discharges/ui/detail/truck-holdings.tsx`, exporting `TruckHoldings({ holdings })`. It renders nothing for an empty list. Otherwise it renders a warning `Badge` `Also held` and the text `{vesselName} · {Planned|Active}` joined by `, `, as in `contracts/ui-state.md` Rows.
- [X] T018 [P] Create `apps/web/src/features/discharges/truck-pool-selection.ts` with the four pure functions `heldPoolEntries`, `shiftsSelectingTrucks`, `offeredShiftTrucks`, and `candidateMatchesSearch`. The last one uses `normalizeSearch` from `@/helpers/search`. Makes T004 pass.
- [X] T019 [P] Create `apps/web/src/features/discharges/truck-pool-refusals.ts` with `truckRefusals(error, submittedTruckIds): { byTruck: Map<string, string>; summary: string[] } | null`, built on `parseApiError`. Makes T005 pass.

**Checkpoint**: The shared pieces are in place, and every existing API and web suite is green.

---

## Phase 3: User Story 1 - Reserve Trucks for a Planned Discharge (Priority: P1) 🎯 MVP

**Goal**: A preparer reserves one or several available trucks for a planned discharge, from a
searchable sheet. Trucks other discharges hold are offered with a warning, and the pool marks them
for every role.

**Independent Test**: As an operations lead on a planned discharge, reserve three trucks in one
change. Check the pool shows each with its captured registration, company, and reservation time.
Then, on another planned discharge, check the trucks are offered with `Also held`, reserve one, and
check that both pools mark it.

### Tests for User Story 1 ⚠️

- [X] T020 [P] [US1] Create `apps/api/tests/unit/discharges/truck_pool/rules.spec.ts` with a `planReservation` group:
  - **Unknown, archived, and suspended trucks** each give `availableTruck` at their request index. Several of them give several issues, in request order.
  - **Trucks**:
    - an available truck with no row is an insert with the snapshots and `reservedAt = now`;
    - an already held truck is omitted;
    - a released row becomes a reactivation;
    - a truck held by another discharge is not an issue, because other holdings are not inputs.
  - **Idempotency**: the plan is empty when every requested truck is held.
- [X] T021 [P] [US1] Create `apps/api/tests/unit/discharges/truck_pool/reserve.spec.ts`, with stub repositories:
  - `ReserveTrucksUseCase` calls, in order, `lockDischarge`, then `lockTrucks` with every requested id, then `listTruckPool`, then the write.
  - A missing discharge throws `DischargeNotFoundException`, and an `ACTIVE` one throws `DischargeNotPlannedException`, before `lockTrucks`.
  - Issues are thrown as `E_VALIDATION_ERROR` with no write call.
  - An empty plan makes no write call and still returns the detail read.
- [X] T022 [P] [US1] Create `apps/api/tests/integration/discharges/truck_pool/candidates.spec.ts`, for `GET /api/v1/discharges/:dischargeId/truck-pool/candidates`:
  - **401 and 403** as in the other suites.
  - **200 per preparing role**:
    - only `AVAILABLE` trucks are returned, not archived or suspended ones;
    - trucks the discharge holds are excluded, but a truck with only a released row for it is included;
    - order is lower-cased registration, then id;
    - `transportCompany.name` is current;
    - `otherHoldings` lists other planned and active holders, `ACTIVE` first, and never a closed discharge.
  - **404** for an unknown or malformed discharge.
  - **409** `E_DISCHARGE_NOT_PLANNED` for active and closed discharges.
- [X] T023 [P] [US1] Create `apps/api/tests/integration/discharges/truck_pool/reserve.spec.ts`, for `POST /api/v1/discharges/:dischargeId/truck-pool`:
  - **401 and 403**, each leaving `truckPoolRows` unchanged.
  - **200 per preparing role**, reserving two trucks: the detail's pool lists both as held, with `registration`, `transportCompany.name`, and `reservedAt` set, and no shift gains a truck.
  - **Held elsewhere**: a truck held by another planned discharge and one held by an active discharge are reserved, and both pools then show each other in `otherHoldings`.
  - **Replay**: the same body twice gives 200 with one row per truck.
  - **Reactivation**: a truck with a released row for this discharge is held again on the same row id, with `releasedAt` null, a new `reservedAt`, and snapshots captured again after the truck's registration was changed directly in the database.
  - **404 and 409** as for candidates.
  - **422**: `availableTruck` at `truckIds.1` for an archived truck and at `truckIds.0` for a suspended one, and the Vine shape failures (`[]`, duplicates, non-UUID). No row is written in any 422 case, including the valid trucks of a partly refused body.
- [X] T024 [P] [US1] Update `apps/web/src/features/discharges/__tests__/detail/truck-pool.test.tsx`:
  - **Holdings marker**: a held entry with `otherHoldings` shows `Also held` and `MV Ocean Cedar · Active` for an observer and for an operations lead, and a released entry shows no badge.
  - **Observer on a planned discharge, and lead on an active one**: no `Add trucks`, checkbox, or `Withdraw` is rendered.
  - **Lead on a planned discharge**: `Add trucks` in the header, and in the `No trucks reserved` empty state.
- [X] T025 [P] [US1] Create `apps/web/src/features/discharges/__tests__/detail/reserve-trucks.test.tsx`, using `mockTruckPlanning`:
  - **Opening**: `Add trucks` opens the `Add trucks` dialog. It shows skeletons, then the candidates. The `MV Ocean Cedar` candidate shows `Also held`.
  - **Search**: typing a company name filters rows. Checking two rows, clearing the search, and seeing `2 selected` shows the selection survives a search.
  - **Success**: `Reserve` shows `Reserving…`, posts `{ truckIds }` in selection order, closes the dialog, shows the toast `2 trucks reserved`, and the pool lists both.
  - **`Reserve` disabled** with nothing selected.
  - **Candidates error**: `Unable to load trucks` with `Retry`, which refetches.
  - **No candidates**: `No trucks to add`.
  - **422**: `availableTruck` at `truckIds.0` keeps the dialog open, shows the reason under that row and the alert `Some trucks can no longer be reserved`, and keeps the selection.
  - **409** `E_DISCHARGE_NOT_PLANNED`: closes, refetches the detail, and shows the toast `This discharge has started and can no longer be corrected`.
  - **Network error**: keeps the dialog open with its selection and shows the toast `Unable to reserve trucks`.

### API implementation for User Story 1

- [X] T026 [US1] Add `planReservation(requested, pool, trucks, now)` to `apps/api/app/discharges/shared/truck_pool_rules.ts`, as specified in `data-model.md` Pure rules. It returns `{ kind: 'ISSUES', issues } | { kind: 'PLAN', inserts, reactivations }`, where each item carries `truckId`, `registrationSnapshot`, `transportCompanyId`, `transportCompanyNameSnapshot`, and `reservedAt`. Reactivations also carry the existing row id. Makes T020 pass.
- [X] T027 [US1] Add `writeTruckReservations({ dischargeId, inserts, reactivations }, client)` to `DischargePreparationRepository` and its Lucid implementation, in one savepoint:
  - one batched insert into `discharge_truck_assignments`;
  - one update per reactivation (`released_at = null`, the snapshots, `reserved_at`), restricted to `id` and `discharge_id`;
  - then `touchDischarge`.

  Map a unique violation on `(discharge_id, truck_id)` to `{ kind: 'ALREADY_HELD' }`, which the use case treats as a replay and ignores. Otherwise return `{ kind: 'WRITTEN' }`.
- [X] T028 [US1] Add `listTruckCandidates(dischargeId)` to `DischargeRepository` and `LucidDischargeRepository`. It returns `{ kind: 'NOT_FOUND' } | { kind: 'NOT_PLANNED' } | { kind: 'LISTED', candidates }`.
  - Guard the id with `isUuid`, then read the discharge status.
  - Select `AVAILABLE` trucks left-joined to `transport_companies`, with `WHERE NOT EXISTS` a held row for this discharge, ordered by `LOWER(registration)`, then `id`.
  - Run the holdings query of T009 for those truck ids, excluding this discharge.
  **Note**: The candidates are serialized through a small `TruckCandidateTransformer` in `app/discharges/shared/`, so their shape reaches the Tuyau registry like every other response.

  Extract the holdings query from T009 into a private method both use.
- [X] T029 [US1] Create `apps/api/app/discharges/truck_pool/list_truck_candidates_use_case.ts` (maps `NOT_FOUND` and `NOT_PLANNED` to the discharge exceptions) and `reserve_trucks_use_case.ts` (`ReserveTrucksInput { dischargeId, truckIds }`).
  - In `db.transaction`, the reservation runs `lockPlannedDischarge`, then `lockTrucks(truckIds)`, then `listTruckPool`, then `planReservation`, throwing issues through `throwPreparationIssues`.
  - It writes only a non-empty plan.
  - After commit it returns `findDetail`, throwing `DischargeNotFoundException` when null.

  Makes T021 pass.
- [X] T030 [US1] Create `apps/api/app/controllers/discharge_truck_pool_controller.ts` with `candidates` (returns `serialize({ data })` in the same envelope as `trucks.available`) and `store` (validates `truckIdsValidator`, returns the detail with status 200). Both authorize `DischargePolicy` `update`. In the discharges group of `apps/api/start/routes.ts`, beside the product lots group, register:

  ```ts
  router.group(() => {
    router.get('/candidates', [controllers.DischargeTruckPool, 'candidates']).as('candidates')
    router.post('/', [controllers.DischargeTruckPool, 'store']).as('store')
  }).prefix('/:dischargeId/truck-pool').as('truck_pool')
  ```

- [X] T031 [US1] Boot the API once (`pnpm --filter @portflow/api dev`, then stop it) to regenerate `apps/api/.adonisjs/client/registry/*` and `apps/api/.adonisjs/server/*`. Check that `discharges.truck_pool.candidates` and `discharges.truck_pool.store` are present, and commit the regenerated files. T022 and T023 should now pass.
  **Note**: The test runner regenerates only the controllers index; the client registry needed a short `node ace serve` boot, which was stopped right after.

### Web implementation for User Story 1

- [X] T032 [P] [US1] Add `truckCandidates: (dischargeId: string) => tuyauQuery.discharges.truckPool.candidates.queryOptions({ params: { dischargeId } }, { staleTime: 0 })` to `apps/web/src/features/discharges/queries/discharge-queries.ts`, following the existing `detail` factory's call shape. Switch `TruckCandidateDto` in `types.ts` to the `Route` type. Depends on T031.
- [X] T033 [P] [US1] Add `reserveTrucks` to `apps/web/src/features/discharges/mutations/use-discharge-mutations.ts`, using `tuyauQuery.discharges.truckPool.store.mutationOptions`. On success it runs `applyDetail`, then invalidates `dischargeQueries.truckCandidates(dischargeId).queryKey`. On error it runs `refreshAfterStaleRefusal`, and it also invalidates the candidates on a `422`. Depends on T031.
- [X] T034 [US1] Create `apps/web/src/features/discharges/ui/detail/add-trucks-sheet.tsx`, following `contracts/ui-state.md` `Add trucks` sheet exactly:
  - `Sheet`, `SheetContent size="lg"`, rendering its body only while open.
  - The candidate states: loading skeletons, error with `Retry`, `Empty`, no match, ready.
  - `InputSearch` filtered with `candidateMatchesSearch`.
  - `useBulkSelection`, with a select-all over the visible rows (`aria-checked="mixed"`), following `features/trucks/ui/truck-list.tsx`.
  - `TruckHoldings` on each row, and the `{n} selected` count.
  - `Reserve` (`Reserving…`), disabled while nothing is selected or while pending.
  **Note**: The sheet already keeps a refused truck that dropped out of the refreshed candidates listed and checked, which T065 asks for.

  Outcomes:
  - Success: toast, then `onClose`.
  - `422`: build `truckRefusals` from the submitted ids, render each reason under its row with `aria-describedby`, render the summary `Alert`, and focus it.
  - `E_DISCHARGE_NOT_PLANNED` or `E_DISCHARGE_NOT_FOUND`: toast `STARTED_REFUSAL_MESSAGE`, then close.
  - Anything else: `toast.error('Unable to reserve trucks', { description })`, staying open.

  Depends on T032, T033, T017, T018, T019.
- [X] T035 [US1] Update `apps/web/src/features/discharges/ui/detail/discharge-truck-pool-card.tsx`:
  - Render `TruckHoldings` after the registration of each held row.
  - When `canCorrect`, render `Add trucks` in the `DetailSection` `actions` slot and in the empty state, opening `AddTrucksSheet` held in local state.

  T024 and T025 should now pass.

**Checkpoint**: US1 is fully functional. Preparers reserve trucks, and every role sees shared
holdings.

---

## Phase 4: User Story 2 - Select the Trucks Each Planned Shift Uses (Priority: P1)

**Goal**: A preparer chooses, for each planned shift of a planned discharge, which held trucks it
uses, in one atomic save.

**Independent Test**: On a planned discharge with four held trucks and two planned shifts, select
two trucks for the first and three for the second. Check each shift lists exactly its own trucks by
captured registration, and that a truck the discharge does not hold is refused.

### Tests for User Story 2 ⚠️

- [X] T036 [P] [US2] Add a `planShiftSelection` group to `apps/api/tests/unit/discharges/truck_pool/rules.spec.ts`:
  - **Difference**:
    - an unchanged set gives an empty plan;
    - adding gives inserts with `effectiveFrom = now`;
    - removing gives `deleteIds` of the current rows;
    - an empty request deletes every current row.
  - **Held rule**: a truck not in `heldTruckIds` gives `heldTruck` at its index.
  - **Suspended trucks**:
    - a suspended truck being added gives `selectableTruck`;
    - a suspended truck already selected and kept gives no issue;
    - a suspended truck already selected and removed is deleted.
  - **Precedence**: a truck both unheld and suspended gives `heldTruck` only.
  - **Ended rows** are never in `currentSelection`, so they are never deleted.
- [X] T037 [P] [US2] Create `apps/api/tests/unit/discharges/truck_pool/select_shift_trucks.spec.ts`, with stub repositories:
  - `SelectShiftTrucksUseCase` calls, in order, `lockDischarge`, then `findShift`, then `listTruckPool`, then `listCurrentShiftTruckSelections`, then `lockTrucks` with only the added ids (sorted by the repository), then the write.
  - A `null` shift throws `ShiftNotFoundException`, and a shift with `status: 'ACTIVE'` throws `ShiftNotPlannedException`, both before any truck lock.
  - Issues make no write call.
- [X] T038 [P] [US2] Create `apps/api/tests/integration/discharges/truck_pool/select_shift_trucks.spec.ts`, for `PUT /api/v1/discharges/:dischargeId/shifts/:shiftId/trucks`:
  - **401 and 403**, each leaving `shiftTruckRows` unchanged.
  - **200 per preparing role**:
    - replacing `[A]` with `[A, B]` keeps A's row id and adds B;
    - then `[B]` deletes A's row;
    - then `[]` clears the selection;
    - the detail's `shifts[i].trucks` shows the pool's captured registration.
  - **Isolation**: another planned shift selecting A is untouched, and an ended row of the same shift is untouched.
  - **Replay**: the same body twice gives the same rows.
  - **404**:
    - `E_SHIFT_NOT_FOUND` for an unknown shift, a malformed id, and a shift of another discharge;
    - `E_DISCHARGE_NOT_FOUND` for an unknown discharge.
  - **409**:
    - `E_DISCHARGE_NOT_PLANNED` for active and closed discharges;
    - `E_SHIFT_NOT_PLANNED` for an `ACTIVE` shift built by factory on a planned discharge.
  - **422**:
    - `heldTruck` for a truck held only by another discharge, and for a truck whose row for this discharge is released;
    - `selectableTruck` for a suspended held truck not yet selected;
    - a suspended truck already selected is kept when resubmitted;
    - no row changes in any 422 case.
- [X] T039 [P] [US2] Create `apps/web/src/features/discharges/__tests__/detail/shift-trucks.test.tsx`, using `mockTruckPlanning`:
  - **Access**: a lead on a planned discharge sees `Edit trucks for shift {period}` only on planned shifts. An observer, and a lead on an active discharge, see none.
  - **Initial state**: the dialog `Shift trucks` lists held, non-suspended trucks with the current ones checked, and `Save` is disabled until the selection changes.
  - **Suspended truck**: one already selected is checked with its marker. Once unchecked it is disabled, with the note `Suspended trucks cannot be newly selected`.
  - **Select all** checks every checkable row.
  - **Save**: shows `Saving…`, sends `PUT` with the full `truckIds`, closes, shows the toast `Shift trucks updated`, and the shift's Trucks group lists exactly the selection.
  - **Empty pool**: `No trucks reserved` with `Save` disabled.
  - **`404 E_SHIFT_NOT_FOUND`**: closes, refetches, and shows the toast `This shift is no longer planned`.
  - **409 `E_DISCHARGE_NOT_PLANNED`**: closes and shows the started toast.
  - **Network error**: stays open with the selection and shows the toast `Unable to update shift trucks`.
- [X] T040 [P] [US2] Update `apps/web/src/features/discharges/__tests__/detail/shifts.test.tsx` so its read-only assertions run as an observer, and add one case: a lead on a closed discharge sees no `Edit` in any Trucks group.

### API implementation for User Story 2

- [X] T041 [US2] Add `planShiftSelection(requested, heldTruckIds, currentSelection, trucks, now)` to `apps/api/app/discharges/shared/truck_pool_rules.ts`, as in `data-model.md`. It returns `{ kind: 'ISSUES', issues } | { kind: 'PLAN', deleteIds, inserts }`. Makes T036 pass.
- [X] T042 [US2] Add `writeShiftTruckSelection({ dischargeId, shiftId, deleteIds, inserts }, client)` to `DischargePreparationRepository` and its Lucid implementation, in one savepoint:
  - delete `shift_trucks` by id, restricted to that `shift_id` and `effective_to IS NULL`;
  - one batched insert with `effective_to` null;
  - then `touchDischarge`.

  Map a unique violation on `(shift_id, truck_id, effective_from)` to `{ kind: 'ALREADY_SELECTED' }`, which the use case ignores as a replay.
- [X] T043 [US2] Create `apps/api/app/discharges/truck_pool/select_shift_trucks_use_case.ts` (`SelectShiftTrucksInput { dischargeId, shiftId, truckIds }`).
  - In `db.transaction`: `lockPlannedDischarge`, then `findShift` (throwing `ShiftNotFoundException` or `ShiftNotPlannedException`), then `listTruckPool` to build the held set, then `listCurrentShiftTruckSelections` filtered to the shift.
  - Compute the added ids, lock them with `lockTrucks`, run `planShiftSelection`, throw its issues, and write a non-empty plan.
  - Return `findDetail`.

  Makes T037 pass.
- [X] T044 [US2] Create `apps/api/app/controllers/discharge_shift_trucks_controller.ts` with `update`: authorize `update`, validate `shiftTruckSelectionValidator`, run the use case with `params.dischargeId` and `params.shiftId`, and return the detail. In the discharges group of `apps/api/start/routes.ts` register `router.put('/:dischargeId/shifts/:shiftId/trucks', [controllers.DischargeShiftTrucks, 'update']).as('shift_trucks.update')`. Regenerate the registry as in T031 and check that `discharges.shift_trucks.update` is present. T038 should now pass.

### Web implementation for User Story 2

- [X] T045 [P] [US2] Add `selectShiftTrucks` to `use-discharge-mutations.ts`, with `tuyauQuery.discharges.shiftTrucks.update.mutationOptions`, `applyDetail`, and `refreshAfterStaleRefusal`. Add `E_SHIFT_NOT_FOUND` and `E_SHIFT_NOT_PLANNED` to `STALE_DETAIL_CODES`. Depends on T044.
- [X] T046 [US2] Create `apps/web/src/features/discharges/ui/detail/shift-trucks-sheet.tsx`, following `contracts/ui-state.md` `Shift trucks` sheet:
  - Props `{ detail, shift, open, onClose }`.
  - Rows come from `offeredShiftTrucks(detail, shift.id)`, and the initial selection from its `selected` flags.
  - `useBulkSelection`, with select-all over the checkable rows.
  - A suspended row is disabled once unchecked, with the note tied by `aria-describedby`.
  - The `{n} selected` count.
  - The empty state when the pool holds nothing.
  - `Save` (`Saving…`), disabled when the selection equals the initial one or while pending.
  **Note**: The sheet fixes its rows when it opens, so a refreshed detail never moves a row under the pointer. The row that T064 appends after a refusal is added there.

  Outcomes:
  - Success: toast `Shift trucks updated`, then close.
  - `422`: reasons under their rows and the summary `Alert` `Some trucks can no longer be selected`, focused.
  - `E_DISCHARGE_NOT_PLANNED` or `E_DISCHARGE_NOT_FOUND`: the started toast, then close.
  - `E_SHIFT_NOT_FOUND` or `E_SHIFT_NOT_PLANNED`: toast `This shift is no longer planned`, then close.
  - Anything else: toast `Unable to update shift trucks`, staying open.

  Depends on T045 and T018.
- [X] T047 [US2] Update `apps/web/src/features/discharges/ui/detail/discharge-shifts-card.tsx`. When `canCorrect` and `shift.status === 'PLANNED'`, render a ghost `Edit` in the Trucks group header, with `aria-label="Edit trucks for shift {planned period}"`, using the same period text as the shift's `article` label. It opens `ShiftTrucksSheet` for that shift from local state. Keep `ResourceGroup` generic by passing the action as an optional `action` prop, used only by the Trucks group. T039 and T040 should now pass.

**Checkpoint**: US1 and US2 together let a preparer build a startable truck plan.

---

## Phase 5: User Story 3 - Withdraw Trucks From a Planned Discharge's Pool (Priority: P2)

**Goal**: A preparer withdraws one or several trucks. The reservations disappear entirely, the
trucks leave every planned shift, and other discharges stop naming this one.

**Independent Test**: On a planned discharge holding a truck selected for two planned shifts,
withdraw it and confirm. Check the pool no longer lists it, not even as released, that neither
shift lists it, and that another planned discharge holding it no longer names this one.

### Tests for User Story 3 ⚠️

- [X] T048 [P] [US3] Add a `planWithdrawal` group to `apps/api/tests/unit/discharges/truck_pool/rules.spec.ts`:
  - **Held trucks**: a held truck yields its assignment id and the ids of its current selections across several shifts.
  - **Ignored trucks**: a released-only truck, and a truck with no row, are ignored.
  - **Selections of other trucks** are untouched.
  - **Nothing to withdraw**: requesting only ignored trucks gives empty lists.
- [X] T049 [P] [US3] Create `apps/api/tests/unit/discharges/truck_pool/withdraw.spec.ts`, with stub repositories:
  - `WithdrawTrucksUseCase` calls `lockDischarge`, then `listTruckPool`, then `listCurrentShiftTruckSelections`, then the write.
  - It never calls `lockTrucks`.
  - Empty lists make no write call.
  - A not-planned discharge throws before any read.
- [X] T050 [P] [US3] Create `apps/api/tests/integration/discharges/truck_pool/withdraw.spec.ts`, for `POST /api/v1/discharges/:dischargeId/truck-pool/withdrawals`:
  - **401 and 403**, each leaving the rows unchanged.
  - **200 per preparing role**, withdrawing truck A selected for two planned shifts and truck B selected for none:
    - both assignment rows are deleted, not released;
    - A's current `shift_trucks` rows are deleted;
    - an ended row for A on the same shift remains;
    - another truck's selection remains;
    - the detail lists neither truck in `truckPool` or current shift trucks.
  - **Released row**: a released row of this discharge for truck C is untouched when C is requested.
  - **A suspended held truck** is withdrawn.
  - **Replay** of the same body gives 200 with no change.
  - **Other holdings**: another planned discharge holding A loses this discharge from its `otherHoldings`.
  - **404 and 409** as for the reservation, each changing nothing.
  - **422** for shape failures only.
- [X] T051 [P] [US3] Create `apps/web/src/features/discharges/__tests__/detail/withdraw-trucks.test.tsx`, using `mockTruckPlanning`:
  - **Single withdrawal**: `Withdraw {registration}` opens `Withdraw truck?`, which names the registration and lists the planned shifts selecting it (a `list` of periods). Confirming shows `Withdrawing…`, posts `{ truckIds: [id] }`, closes, shows the toast `Truck withdrawn`, and the pool no longer lists the truck.
  - **Bulk withdrawal**: checking two rows shows `Withdraw (2)` in the header, which opens `Withdraw 2 trucks?`. On success the toast is `2 trucks withdrawn` and the selection is cleared.
  - **Select all**: `Select all held trucks` is `mixed` after one row is checked.
  - **Shifts**: a truck selected by no shift shows no shift list.
  - **409**: closes, refetches, and shows the started toast.
  - **Network error**: keeps the dialog open and shows the toast `Unable to withdraw trucks`.
  - **Access**: an observer and an active discharge show no checkbox and no `Withdraw`.

### API implementation for User Story 3

- [X] T052 [US3] Add `planWithdrawal(requested, pool, currentSelections)` to `apps/api/app/discharges/shared/truck_pool_rules.ts`, returning `{ assignmentIds, selectionIds }`. Makes T048 pass.
- [X] T053 [US3] Add `deleteTruckWithdrawal({ dischargeId, assignmentIds, selectionIds }, client)` to `DischargePreparationRepository` and its Lucid implementation, in one savepoint:
  1. delete `shift_trucks` by id with `effective_to IS NULL`;
  2. then delete `discharge_truck_assignments` by id with `discharge_id` and `released_at IS NULL`;
  3. then `touchDischarge`.

  Selections go first so that no foreign key or invariant is ever violated mid-statement. Doc-comment that deleting, not releasing, follows the spec's third clarification.
- [X] T054 [US3] Create `apps/api/app/discharges/truck_pool/withdraw_trucks_use_case.ts` (`WithdrawTrucksInput { dischargeId, truckIds }`). In `db.transaction`: `lockPlannedDischarge`, then `listTruckPool`, then `listCurrentShiftTruckSelections`, then `planWithdrawal`, then the write when either list is non-empty. Return `findDetail`. Makes T049 pass.
- [X] T055 [US3] Add `withdraw` to `apps/api/app/controllers/discharge_truck_pool_controller.ts` (authorize `update`, validate `truckIdsValidator`, return the detail with 200), and register `router.post('/withdrawals', [controllers.DischargeTruckPool, 'withdraw']).as('withdraw')` in the `truck_pool` group of `apps/api/start/routes.ts`. Regenerate the registry as in T031 and check that `discharges.truck_pool.withdraw` is present. T050 should now pass.

### Web implementation for User Story 3

- [X] T056 [P] [US3] Add `withdrawTrucks` to `use-discharge-mutations.ts`, with `tuyauQuery.discharges.truckPool.withdraw.mutationOptions`, `applyDetail`, invalidation of `truckCandidates(dischargeId)`, and `refreshAfterStaleRefusal`. Depends on T055.
- [X] T057 [US3] Create `apps/web/src/features/discharges/ui/detail/withdraw-trucks-dialog.tsx`, modelled on `remove-product-lot-dialog.tsx`:
  - An `AlertDialog` mounted while open, with props `{ detail, truckIds, onClose, onWithdrawn }`.
  - The title is `Withdraw truck?` or `Withdraw {n} trucks?`.
  - The description names the registrations and, when `shiftsSelectingTrucks(detail, truckIds)` is not empty, adds `They will also be removed from these shifts:` followed by a `ul` of periods formatted as on the shifts card.
  - The confirm button is a destructive `Withdraw` (`Withdrawing…`), with `event.preventDefault()`.
  - Outcomes: success shows the toast and calls `onWithdrawn`; `409` and `404` close with the started toast; anything else shows the toast `Unable to withdraw trucks` and stays open.

  Depends on T056 and T018.
- [X] T058 [US3] Update `apps/web/src/features/discharges/ui/detail/discharge-truck-pool-card.tsx` for the case `canCorrect`:
  - **Row selection**: a leading `Checkbox` per held row named `Select {registration}`, and a header `Select all held trucks` with `mixed`, through `useBulkSelection`.
  - **Row action**: a ghost `Withdraw` per held row with `aria-label="Withdraw {registration}"`.
  - **Header action**: `Withdraw ({n})` in the `actions` slot beside `Add trucks` while the selection is not empty.
  - **Dialog**: the dialog target is held in local state, and `onWithdrawn` clears the selection.
  - **Pruning**: call `retainOnly(heldTruckIds)` whenever the detail changes, so trucks no longer held drop out of the selection.
  **Note**: The pruning with `retainOnly` is already in place here, as T059's last case requires.

  T051 should now pass.

**Checkpoint**: US1 to US3 give the full reserve, select, and withdraw cycle.

---

## Phase 6: User Story 4 - Keep the Truck Plan Coherent While Others Change the Discharge (Priority: P2)

**Goal**: A change that no longer fits the discharge's current state is refused with its reason,
keeps the user's selection, and saves nothing partially. Truck administration can no longer break
a reservation's snapshot under concurrency.

**Independent Test**: Open the truck pool and a shift's selection in two sessions. In the second,
withdraw a truck, start the discharge, and suspend a truck. In the first, save a change depending
on each, and check every change is refused with its reason, the selection is kept, and the detail
shows the current state.

### Tests for User Story 4 ⚠️

- [X] T059 [P] [US4] Create `apps/web/src/features/discharges/__tests__/detail/truck-planning-stale-state.test.tsx`, using `mockTruckPlanning`:
  - **Withdrawn elsewhere**: the `Shift trucks` dialog is open with truck X checked, and the server has withdrawn X (`respondToShiftTrucks` returns 422 `heldTruck` at X's index, and the refetched detail no longer holds X). The dialog stays open, X is still listed at the end, checked, with `This truck is no longer in this discharge's pool`, the alert `Some trucks can no longer be selected` has focus, and unchecking X then saving succeeds.
  - **Suspended elsewhere**: the `Add trucks` dialog gets a 422 `availableTruck`. The candidates are refetched, and the refused truck stays selected with its reason until unchecked.
  - **Discharge started**: with the discharge started (`respondToWithdraw` returns 409 `E_DISCHARGE_NOT_PLANNED`, and the refetched detail is `ACTIVE`), the dialog closes, the toast shows, and the pool card no longer renders checkboxes or actions.
  - **Double submission**: clicking `Reserve` twice while pending sends one request.
  - **Pruning**: after a refetch that no longer holds a checked truck, `Withdraw ({n})` counts only held trucks.
- [X] T060 [P] [US4] Extend `apps/api/tests/integration/trucks/administration/update.spec.ts` with a test: changing the transport company of a truck held by a planned discharge created through `POST /api/v1/discharges/:dischargeId/truck-pool` (not the persisted usage helper) is refused with 409 `E_TRUCK_TRANSPORT_COMPANY_LOCKED`, and the truck's company and the assignment's snapshot are unchanged. After a withdrawal through the API, the same change succeeds.
- [X] T061 [P] [US4] Extend `apps/api/tests/unit/trucks/administration/update.spec.ts`:
  - `UpdateTruckUseCase` no longer calls `usageChecker.findUsedByPlannedOrActiveDischarge` outside a transaction when the company changes.
  - It maps the repository's `TRANSPORT_COMPANY_LOCKED` outcome to `TruckTransportCompanyLockedException`.
  - An update that keeps the company does not request the locked path.
  **Note**: The use case keeps its unlocked usage check, which decides the refusal's order when the submitted company is also archived, as an existing test pins. The authoritative check is the repository's locked re-check, which returns `TRANSPORT_COMPANY_LOCKED`. The new unit test injects a reservation between the two.
- [X] T062 [P] [US4] Create `apps/api/tests/unit/discharges/truck_pool/lock_order.spec.ts`. With one recording stub shared by the three write use cases, assert that:
  - the first recorded call is always `lockDischarge`;
  - `lockTrucks` is never called before it;
  - the reservation locks every requested id and the selection only the added ids;
  - the withdrawal locks no truck.

  This pins research.md Decision 4 for the implementers of GH-56, GH-63, GH-64, GH-76, and GH-78.

### Implementation for User Story 4

- [X] T063 [US4] Harden the transport company change, as in research.md Decision 4:
  - Add a `reassignAvailable(command)` method to `apps/api/app/trucks/shared/repositories/truck_repository.ts`, or extend `updateAvailable`, following the locked `archiveAvailable` at `lucid_truck_repository.ts:230-265`. It:
    - opens `Truck.transaction`;
    - locks the truck `FOR UPDATE`;
    - checks `usageChecker.findUsedByPlannedOrActiveDischarge({ referenceType: 'TRUCK', referenceIds: [id], client: trx })`;
    - returns `{ kind: 'TRANSPORT_COMPANY_LOCKED' }` when in use, and otherwise performs the existing compare-and-swap update inside the same transaction.
  - In `apps/api/app/trucks/update/update_truck_use_case.ts`, route company changes through it and drop the unguarded usage check at lines 62-70.
  **Note**: `updateAvailable` takes the locked path only for a reassignment; an update keeping the company writes as before.

  Makes T060 and T061 pass. The whole existing `trucks/administration` suite must stay green.
- [X] T064 [US4] Complete the stale-state behavior in `apps/web/src/features/discharges/ui/detail/shift-trucks-sheet.tsx`. After a `422`, trucks from `truckRefusals.byTruck` that are no longer among the offered rows are appended at the end of the list, checked, with their reason, and can be unchecked but not re-checked. They are dropped from the list once unchecked. Makes the first case of T059 pass.
  **Note**: The sheet's rows are fixed when it opens, so a truck withdrawn elsewhere is still listed where it was rather than appended. Once unchecked it cannot be checked again. A refused selection also refetches the detail.
- [X] T065 [US4] Complete the stale-state behavior in `apps/web/src/features/discharges/ui/detail/add-trucks-sheet.tsx`:
  - After a `422`, refused trucks that the refetched candidates no longer contain stay listed, checked, with their reason, until unchecked, mirroring T064.
  - Clicking `Reserve` while `isPending` is a no-op.
  **Note**: Both sheets guard submission with a ref, because the pending state reaches the button a render later.

  T059 should now pass entirely.
- [X] T066 [US4] Review the three write use cases and the Lucid repository for research.md Decision 4. Every write path locks the discharge before reading pool, shift, or selection rows, and truck locks use `lockableIds` ordering. Add a doc comment on `DischargePreparationRepository` that lists the later slices which must lock the discharge first: GH-56, GH-63, GH-64, GH-76, and GH-78. T062 should pass.

**Checkpoint**: All four stories are functional and independently testable.

---

## Phase 7: User Story 5 - Move Between a Discharge's Planning Sections (Priority: P2)

**Goal**: The detail becomes a persistent header and four section tabs (Overview, Product lots,
Truck pool, Shifts) with counts, the open section kept in `?tab=`, a factual preparation summary on
a planned discharge's Overview, and pointers from Shifts to the Truck pool while the pool is empty.

**Independent Test**: spec.md User Story 5. `contracts/ui-state.md` sections `Route and URL state`,
`Page layout`, `Overview: Preparation card`, and `Cross-section links` are the exact contract.

Placed after US4 rather than before it: US4's tests were already written when this story was
added, so T074 migrates them with the rest.

### Tests for User Story 5 ⚠️

- [X] T074 [P] [US5] Add `renderDischargeTab(id, tab, search?)` to `apps/web/src/features/discharges/__tests__/support/test-helpers.ts`, and migrate every detail test that reads a section other than Overview to open that section: `product-lots`, `add-product-lot`, `correct-product-lot`, `remove-product-lot`, `truck-pool`, `reserve-trucks`, `withdraw-trucks`, `shifts`, `shift-trucks`, and `truck-planning-stale-state`. Rewrite `feedback.test.tsx`'s empty-sections case to open each tab, and assert no `tablist` while loading. Loop `access.test.tsx`'s no-action checks over `DISCHARGE_DETAIL_TABS`. Green before and after the restructuring.
- [X] T075 [P] [US5] Create `apps/web/src/features/discharges/__tests__/discharge-detail-sections.test.ts`: `isDischargeDetailTab`; `tabSearch('overview')` is `{ tab: undefined }`; `detailTabCounts` counts held trucks only and gives a closed pool `null`; `preparationSummary` counts lots with no door in effect (none, only ended, one current), held trucks only, and planned shifts with no current truck (ended rows ignored, non-planned shifts ignored, a suspended current truck counts).
- [X] T076 [P] [US5] Create `apps/web/src/features/discharges/__tests__/detail/tabs.test.tsx`: opens on Overview with tabs `Overview`, `Product lots (2)`, `Truck pool (1)`, `Shifts (2)`; `?tab=shifts` opens Shifts; `?tab=nope` falls back to Overview; a click writes `tab`, keeps `status` and `search`, and reads the detail no more; Overview removes `tab`; history back and a reload keep the section; a closed pool tab has no count; the count follows a reservation; the header facts show on every section.
- [X] T077 [P] [US5] Add to `detail/navigation.test.tsx` that the back link from `?status=closed&tab=shifts` lands on a list address without `tab=` and the next discharge opens on Overview, and to `apps/web/src/components/layout/__tests__/authenticated-layout/breadcrumb-search.test.tsx` that the parent crumb's href keeps `status` and has no `tab=`.
- [X] T078 [P] [US5] Create `apps/web/src/features/discharges/__tests__/detail/preparation-summary.test.tsx`: exact copy with gaps for an observer; no gap once prepared; the row link opens its section; no `Preparation` region on active and closed discharges.
- [X] T079 [P] [US5] Add to `detail/shifts.test.tsx`: a preparer with an empty pool sees `No truck is reserved for this discharge yet.` and `Go to truck pool` opens the Truck pool; an observer and a preparer on an active discharge see no pointer. Extend `shift-trucks.test.tsx`'s empty-pool case: `Go to truck pool` closes the sheet and opens the Truck pool.

### Implementation for User Story 5

- [X] T080 [US5] Add `DISCHARGE_DETAIL_TABS` and `DischargeDetailTab` to `apps/web/src/features/discharges/types.ts`, and `validateSearch` with `tab: z.enum(DISCHARGE_DETAIL_TABS).optional().catch(undefined)` to `apps/web/src/routes/_authenticated/discharges.$dischargeId.tsx` (research Decision 12).
- [X] T081 [US5] Add a search middleware dropping `tab` to `apps/web/src/routes/_authenticated/discharges.index.tsx`, with a comment on why it lives there. Makes T077 pass.
- [X] T082 [US5] Create `apps/web/src/features/discharges/discharge-detail-sections.ts` (`isDischargeDetailTab`, `tabSearch`, `detailTabCounts`, `preparationSummary`), reusing `heldPoolEntries`, `lotDoorNotice`, and `currentTruckIds`, now exported from `truck-pool-selection.ts`. Makes T075 pass.
- [X] T083 [P] [US5] Create `ui/detail/discharge-tab-link.tsx`: a `Link` to `.` from the detail route that spreads the previous search and `tabSearch(tab)`.
- [X] T084 [P] [US5] Create `ui/detail/discharge-detail-header.tsx`: back link, `h1` and status badge in one parent, facts `dl` (dock via `ReferenceLabel`, expected start, expected tonnage alone in its `dd`), and an `actions` place.
- [X] T085 [US5] Create `ui/detail/discharge-detail-tabs.tsx` (controlled `Tabs`, `TabsList` named `Discharge sections` in a sideways-scrolling wrapper, counts, one card per panel) and rewrite `ui/detail/discharge-detail-page.tsx` to read `tab`, push on change, and render the header and tabs. Makes T076 pass.
- [X] T086 [US5] Create `ui/detail/discharge-preparation-card.tsx` and render it in the Overview panel of a planned discharge. Makes T078 pass.
- [X] T087 [US5] Add the empty-pool pointer to `ui/detail/discharge-shifts-card.tsx` and the `Go to truck pool` link, closing the sheet first, to `ui/detail/shift-trucks-sheet.tsx`'s empty state. Makes T079 pass.
- [X] T088 [US5] Reshape `ui/detail/discharge-detail-pending.tsx` as header blocks, a tab bar block, and one panel block.
- [X] T089 [US5] Update `quickstart.md` "Validate the screens" to open the matching tab at each step, and add the shared-address and 360px steps.

**Checkpoint**: `pnpm --dir apps/web exec vitest run src/features/discharges src/components/layout` and `pnpm typecheck` pass.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Durable knowledge, documentation alignment, and the constitution's delivery gates.

- [X] T067 [P] Amend `CONTEXT.md` as in research.md Decision 10:
  - **Truck**: replace "can be assigned to at most one planned or active discharge" with "can be held by several planned discharges but by at most one active discharge, which the Discharge Start Confirmation enforces".
  - **Discharge Truck Assignment**: add "Before the discharge starts, removing a truck is a Truck Pool Withdrawal that deletes the assignment; once active, a release ends it and keeps its history."
  - **Truck Pool Withdrawal**: add this entry after Discharge Truck Assignment: "The removal of a truck from a planned discharge's pool, together with its current selections in the discharge's planned shifts, leaving no released assignment behind." Add `_Avoid_: release, unassignment`.
- [X] T068 [P] Refresh the Notes section of `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/plan-the-discharge-truck-pool-and-shift-subsets/checklists/requirements.md`. It must describe the four clarified decisions instead of the pre-clarification defaults, while keeping every checkbox line unchanged.
- [X] T069 [P] Confirm the slice stayed within research.md Decision 11:
  - `git diff --stat master -- apps/api/database` shows no migration, seeder, or fixture change;
  - no activity log write was added;
  - the only change outside `apps/api/app/discharges`, `apps/api/app/controllers`, `apps/api/start/routes.ts`, `apps/api/.adonisjs`, `apps/web/src/features/discharges`, and tests is the truck update hardening, plus `CONTEXT.md`.
  **Result (2026-09-15)**: No database, seed, or activity log change. Outside the slice's directories, the diff holds the truck reassignment hardening, the now exported `distinctUuids` rule, and `CONTEXT.md`.

  Revert anything else, or justify it in the PR description.
- [X] T070 [P] Review every new or changed file against the style rules in `apps/api/AGENTS.md` and `apps/web/AGENTS.md`. Every new repository method, use case, and rule needs a doc comment that explains why: the lock order, delete versus release, the idempotent replays, and why candidates are unpaginated. User-visible strings must match `contracts/ui-state.md` exactly.
- [ ] T071 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` at the repository root, and fix every finding. Record the results, with test counts, under this task.
  **Result (2026-09-15), gates not all green**:
  - `pnpm check`: clean.
  - API: typecheck clean, and the full suite passes (1,609 tests, up from the 1,556 baseline).
  - Web: typecheck and the suite fail, but only in work this slice did not write. While the gates ran, another editor was changing this worktree, turning the discharge detail into tabs (`discharge-detail-sections.ts`, `tabs.test.tsx`, `preparation-summary.test.tsx`, and edits to the detail route, pages, and tests). Their missing module fails the typecheck, and their new tests account for all 8 failures (1,606 of 1,614 passed). Every test this slice added passed in the last run before those edits: 212 in the discharges feature.
  - Rerun all three gates once that work has settled.
- [ ] T072 Run the API and screen validations of `quickstart.md` against a freshly seeded database (`pnpm --filter @portflow/api db:fresh`, then `pnpm dev`), including the observer checks and the two-session stale refusal. Record any deviation in the PR description.
- [ ] T073 Obtain a fresh read-only review of the final diff, as Constitution VII requires, and resolve or explicitly justify every confirmed finding.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup and blocks every story.
- **US1 (Phase 3)**: depends on Foundational. This is the MVP.
- **US2 (Phase 4)**: depends on Foundational only. Its API and tests build held trucks with factories, so it can run in parallel with US1. Its web tasks touch `use-discharge-mutations.ts`, which US1 and US3 also edit.
- **US3 (Phase 5)**: depends on Foundational, and on T030 (the truck pool controller and route group from US1), which T055 extends. T058 edits the pool card after T035.
- **US4 (Phase 6)**: depends on US1 to US3. Its web tasks complete the sheets and card they introduced. T060 to T063, the truck hardening, can start right after Foundational.
- **US5 (Phase 7)**: depends on US1 to US4, whose detail tests it migrates. T072's screen validation covers it.
- **Polish (Phase 8)**: depends on every story being done. T067 and T068 can be done at any time.

### Within each story

Tests are written first and must fail. Then, in order: rules, repository writes, use case,
controller and route, registry regeneration, web query and mutation, UI.

### Key task dependencies

- T010 depends on T009, and T028 extracts T009's holdings query.
- T014 depends on T013.
- T029 depends on T026, T027, and T011.
- T031 depends on T030. T032 and T033 depend on T031. T034 depends on T032, T033, T017, T018, and T019. T035 depends on T034 and T016.
- T043 depends on T041, T042, and T011. T044 depends on T043. T045 depends on T044. T046 depends on T045 and T018. T047 depends on T046 and T016.
- T054 depends on T052, T053, and T011. T055 depends on T054 and T030. T056 depends on T055. T057 depends on T056. T058 depends on T057 and T035.
- T081 and T082 depend on T080. T085 depends on T082, T083, and T084. T086 and T087 depend on T083.
- T063 is independent of the discharge tasks. T064 depends on T046, and T065 on T034. T066 depends on T029, T043, and T054.

### Parallel opportunities

- **Phase 2**: T002–T005 together. Then T006, T007, T008, T012, T013, T015, T017, T018, and T019 together. T009, then T010. T011 on its own. T014 after T013. T016 on its own.
- **US1 tests**: T020–T025 together.
- **US2 tests**: T036–T040 together. The US2 API tasks, T041–T044, can run beside the US1 API tasks, T026–T031, if both avoid editing `routes.ts` at the same time.
- **US3 tests**: T048–T051 together.
- **US4**: T059–T062 together, and T063 at any point after Foundational.
- **Polish**: T067–T070 together.

---

## Parallel Example: User Story 1

```bash
# All US1 tests at once (different files):
Task: "T020 API unit rules.spec.ts planReservation group"
Task: "T021 API unit reserve.spec.ts"
Task: "T022 API integration candidates.spec.ts"
Task: "T023 API integration reserve.spec.ts"
Task: "T024 Web detail/truck-pool.test.tsx update"
Task: "T025 Web detail/reserve-trucks.test.tsx"

# Web building blocks once the registry exists (T031):
Task: "T032 truckCandidates query"
Task: "T033 reserveTrucks mutation"
```

## Parallel Example: User Stories 2 and 3 after Foundational

```bash
Task: "T036 API unit rules.spec.ts planShiftSelection group"
Task: "T038 API integration select_shift_trucks.spec.ts"
Task: "T039 Web detail/shift-trucks.test.tsx"
Task: "T048 API unit rules.spec.ts planWithdrawal group"   # same file as T036: run after it, or merge the groups
Task: "T050 API integration withdraw.spec.ts"
Task: "T051 Web detail/withdraw-trucks.test.tsx"
Task: "T060 API integration trucks update hardening"
```

---

## Implementation Strategy

### MVP first (User Story 1)

1. Phase 1 baseline, then Phase 2 foundations, including `otherHoldings` on the detail.
2. Phase 3, US1: preparers reserve trucks with visible shared holdings, and observers only see the
   markers.
3. **Stop and validate** with the US1 independent test and the reservation part of `quickstart.md`.

US1 alone gives a pool but no shift subsets. US2 is also P1, so the PR is not ready without it.

### Incremental delivery

1. US1 → a demoable reservation flow.
2. US2 → shift subsets. **This is the minimum mergeable scope**, because both stories are P1 and a
   discharge cannot start without shift trucks.
3. US3 → withdrawal, with its cascade to planned shifts.
4. US4 → stale-state polish and the truck administration hardening.
5. Polish → `CONTEXT.md`, gates, quickstart, fresh review, then the PR is ready for human review.

Each story ends at a checkpoint where the full API and web suites pass, so the branch can be paused
or reviewed after any of them.
