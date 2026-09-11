---
description: "Task list for Consult a Prepared Discharge in the Web Workbench (GH-58)"
---

# Tasks: Consult a Prepared Discharge in the Web Workbench

**Input**: Design documents from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/consult-a-prepared-discharge-in-the-web-workbench/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required. Constitution IV mandates RED → GREEN → REFACTOR for business behavior, and
`apps/api/AGENTS.md` and `apps/web/AGENTS.md` name the test seams each layer must have. Write each
test task first and confirm it fails before starting its implementation task.

**Organization**: Tasks are grouped by user story so that each story can be implemented and tested
on its own. The API endpoint grows one section per story, in the order the stories are listed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `[US1]`–`[US5]`, mapping to the user stories in `spec.md`

## Path Conventions

This is a PNPM/Turbo monorepo with `apps/api/` (AdonisJS) and `apps/web/` (TanStack Start). All
paths below are relative to the repository root. `#discharges/*`, `#models/*`, and
`#database/factories/*` are existing API import aliases.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Start from a known-green baseline. Phase 2 restructures a delivered route, so every
later red test must be red because of this slice.

- [X] T001 Run `pnpm --filter @portflow/api test` and `pnpm --filter @portflow/web test -- src/features/discharges src/components/layout`, and record in the PR description that both pass on the branch before any change. If either fails, stop and report instead of proceeding.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the minimal end-to-end read path that every story extends:
- `GET /api/v1/discharges/:id`, returning the discharge's identity, or `E_DISCHARGE_NOT_FOUND`;
- the typed web query over that endpoint;
- the nested route structure that lets a detail page carry the list's `status` and `search`.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for the read path ⚠️

> Write these first and confirm they fail.

- [X] T002 [P] Extend `apps/api/tests/unit/discharges/consultation/policy.spec.ts` with `DischargePolicy.view`. It must allow all four roles (`ORGANIZATION_ADMIN`, `OPERATIONS_ADMIN`, `OPERATIONS_LEAD`, `OBSERVER`) when `accessStatus` is `ACTIVE`, and deny `PENDING`, `CANCELLED`, and `DEACTIVATED`, mirroring the existing `list` cases.
- [X] T003 [P] Create `apps/api/tests/unit/discharges/consultation/show.spec.ts` with three cases:
  - `LucidDischargeRepository.findDetail(id)` returns `null` for an unknown UUID.
  - It returns `null` for a string that is not a UUID, such as `not-a-uuid`, without a database error.
  - `ShowDischargeUseCase.handle({ id })` throws `DischargeNotFoundException` (status 404, code `E_DISCHARGE_NOT_FOUND`) in both cases, and returns the discharge with its `dock` preloaded for a known id.
  - Use `DischargeFactory` and `DockFactory`.
- [X] T004 [P] Create `apps/api/tests/integration/discharges/consultation/show.spec.ts`, modelled on `list.spec.ts` in the same folder:
  - Unauthenticated and non-active (`PENDING`) requests both get 401, and neither body contains the vessel name.
  - Each of the four active roles gets 200 with an identical body carrying `id`, `status`, `vesselName`, `vesselImo`, `vesselComment`, `expectedStartAt`, and `dock: { id, name, status }` for a Planned, an Active (`DischargeFactory.apply('active')`), and a Closed (`.apply('closed')`) discharge.
  - An unknown UUID and the path `not-a-uuid` both get 404 with `body().error.code === 'E_DISCHARGE_NOT_FOUND'`.
  - The test needs no global delete, because it reads by id.

### API implementation

- [X] T005 [P] Create `apps/api/app/discharges/shared/discharge_exceptions.ts` exporting `DischargeNotFoundException extends Exception`, with `static status = 404`, `static code = 'E_DISCHARGE_NOT_FOUND'`, and `static message = 'Discharge not found'`. Follow `apps/api/app/customers/shared/customer_exceptions.ts`.
- [X] T006 [P] Add `view(user: User): AuthorizerResponse` to `apps/api/app/discharges/shared/discharge_policy.ts`, returning `user.accessStatus === 'ACTIVE'`. Give it a doc comment saying that every role may read every discharge's detail (FR-001) and that a separate method gives later slices a place to narrow access (research.md Decision 12).
- [X] T007 Add `abstract findDetail(id: string): Promise<Discharge | null>` to `apps/api/app/discharges/shared/repositories/discharge_repository.ts`. Its doc comment should say it returns one discharge with its whole preparation graph, and `null` for an unknown or malformed id. Implement it in `apps/api/app/discharges/shared/repositories/lucid_discharge_repository.ts`:
  - Return `null` early when `!isUuid(id)`, using `#shared/database/is_uuid` as `lucid_warehouse_door_repository.ts` does.
  - Otherwise run `Discharge.query().where('id', id).preload('dock').first()`.
  - Later stories add their preloads to this same query.
- [X] T008 Create `apps/api/app/discharges/show/show_discharge_use_case.ts` with `ShowDischargeUseCase`:
  - `@inject()` it and give it the `DischargeRepository`.
  - `handle(input: ShowDischargeInput)`, where `ShowDischargeInput = { id: string }`, awaits `findDetail`.
  - It throws `DischargeNotFoundException` on `null` and otherwise returns the discharge.
  - Depends on T005 and T007.
- [X] T009 Create `apps/api/app/discharges/shared/discharge_detail_transformer.ts` with `DischargeDetailTransformer extends BaseTransformer<Discharge>`. Its `toObject()` picks `id`, `status`, `vesselName`, `vesselImo`, `vesselComment`, and `expectedStartAt`, and adds `dock: { id, name, status }`. Write the class doc comment in the style of `discharge_transformer.ts`: it is the detail's shape, it carries labels and statuses because non-administrators cannot list archived references (research.md Decision 2), and it serves every role.
- [X] T010 Add `show({ bouncer, params, serialize }: HttpContext)` to `apps/api/app/controllers/discharges_controller.ts`:
  - Inject `ShowDischargeUseCase` beside `ListDischargesUseCase`.
  - Authorize with `bouncer.with(DischargePolicy).authorize('view')`.
  - Assign `const discharge = await this.showDischargeUseCase.handle({ id: params.id })`.
  - Return `serialize(DischargeDetailTransformer.transform(discharge))`.
  - Depends on T006, T008, and T009.
- [X] T011 Register `router.get('/:id', [controllers.Discharges, 'show']).as('show')` in the `/discharges` group of `apps/api/start/routes.ts`, after `index`. Boot the API with `pnpm --filter @portflow/api dev`, or run its type generation, so that Tuyau regenerates `apps/api/.adonisjs/server/controllers.ts` and the client registry. Confirm that `discharges.show` appears. Depends on T010.

### Web read path and route structure

- [X] T012 [P] Extend `apps/web/src/features/discharges/__tests__/support/fixtures.ts`:
  - Add a `DischargeDetailDto`-typed builder `buildDischargeDetail(overrides)` that produces a complete detail matching `contracts/discharge-detail.openapi.yaml`, with safe defaults.
  - Add three fixtures derived from the existing `DISCHARGES` list fixtures, one Planned, one Active, and one Closed, sharing their `id` and `vesselName` so that a row can open its own detail.
- [X] T013 [P] Extend `apps/web/src/features/discharges/__tests__/support/test-helpers.ts`:
  - Add `mockDischargeDetail({ user, detail, notFound, failTimes, delayMs, onRequest })`. It registers `GET ${API_BASE_URL}/api/v1/discharges/:id` in MSW, answering the fixture whose `id` matches.
  - It answers `404` with `{ error: { code: 'E_DISCHARGE_NOT_FOUND', message: 'Discharge not found' } }` when `notFound` is set or no fixture matches.
  - It answers `500` for the first `failTimes` calls, and delays by `delayMs` when that is set.
  - It also mocks `/api/v1/auth/me`, as `mockDischarges` does.
  - Add `renderDischargeDetail(id, search = '')`, which calls `renderApp(`/discharges/${id}${search}`)`.
- [X] T014 Add types to `apps/web/src/features/discharges/types.ts`:
  - `DischargeDetailDto = Route.Response<'discharges.show'>['data']`.
  - Derived aliases: `DischargeDetailProductLotDto`, `DischargeDoorPeriodDto`, `DischargeTruckPoolEntryDto`, `DischargeShiftDto`, `DischargeShiftTruckPeriodDto`, and `DischargeWeighingAreaPeriodDto`.
  - Depends on T011.
- [X] T015 Add `detail: (id: string) => ...` to `apps/web/src/features/discharges/queries/discharge-queries.ts`, wrapping `tuyauQuery.discharges.show.queryOptions(...)` with the id as the `id` path parameter and `staleTime: 0`, as `all()` does. This is the first query in the web with a path parameter, so check the generated signature in `@tuyau/core`; the mutations in `features/customers/customer-lifecycle.tsx` pass `{ params: { id } }`. Depends on T011.
- [X] T016 Restructure the discharges routes as described in research.md Decision 8 and `contracts/ui-state.md` § Routes:
  1. Create `apps/web/src/routes/_authenticated/discharges.index.tsx`, holding the list's `loader` (with `ensureSessionUser` and `dischargeQueries.all()`), `pendingComponent: DischargesPending`, `errorComponent: DischargesError`, and `component: DischargesPage`, moved verbatim from `discharges.tsx`.
  2. Reduce `apps/web/src/routes/_authenticated/discharges.tsx` to a layout route that keeps `staticData: { breadcrumb: 'Discharges' }` and the existing `dischargesSearchSchema` (`search`, `status`) as `validateSearch`, and declares no component, so that it renders an `<Outlet />`.
  3. Replace the file's GH-58 comment with one explaining that the parent owns the list's state, so that the detail child inherits it and its way back restores it.
  4. Keep `getRouteApi('/_authenticated/discharges')` in `apps/web/src/features/discharges/ui/discharges-page.tsx` reading the search from the layout route. Change it only if typechecking requires the index route id.
  5. Regenerate `routeTree.gen.ts` and run `pnpm --filter @portflow/web test -- src/features/discharges src/components/layout`. Every existing list test must still pass, apart from `list/inert-rows.test.tsx`, which is replaced in US1.
- [X] T017 Create `apps/web/src/routes/_authenticated/discharges.$dischargeId.tsx` with `staticData: { breadcrumb: 'Details' }`. Its `loader` receives `params.dischargeId`, awaits `ensureSessionUser(queryClient)`, and returns `queryClient.ensureQueryData(dischargeQueries.detail(params.dischargeId))`. Its component is `DischargeDetailPage`. Pending, error, and not-found components arrive in US4 and US5. Depends on T015 and T016.
- [X] T018 Create `apps/web/src/features/discharges/ui/detail/discharge-status-badge.tsx`, exporting `DischargeStatusBadge` (labels `Planned`, `Active`, `Closed`) and `ShiftStatusBadge` (labels `Planned`, `Active`, `Completed`). Both are built on `components/ui/badge`, carry text labels, and never rely on color alone.
- [X] T019 Create `apps/web/src/features/discharges/ui/detail/discharge-detail-page.tsx`, exporting `DischargeDetailPage`. It reads `dischargeId` with `getRouteApi('/_authenticated/discharges/$dischargeId')`, reads the detail with `useQuery(dischargeQueries.detail(dischargeId))`, and renders:
  - a visible `h1` holding the vessel name, with `DischargeStatusBadge` beside it;
  - a vertical stack of cards, which the story tasks fill in.
  - Use the list page's outer padding (`p-4 md:p-6`), without its fixed-height overflow clamp, so that the page scrolls.
  - Depends on T017 and T018.

**Checkpoint**: `/discharges/<id>` shows the vessel name and status for every role, and the API
answers 404 for unknown and malformed ids. The list behaves exactly as before.

---

## Phase 3: User Story 1 - Open a Discharge and Read What Is Being Unloaded (Priority: P1) 🎯 MVP

**Goal**: A user selects a row of the list and reads the discharge's identity, expected tonnage,
product lots, and every warehouse door assignment each lot has had.

**Independent Test**: As each role, open a Planned, an Active, and a Closed discharge from the
list. Check that the vessel, status, dock, expected start, expected tonnage, lots, quantities,
descriptions, and door assignments with their periods match the fixtures, and that archived
references carry a marker.

### Tests for User Story 1 ⚠️

- [X] T020 [P] [US1] Extend `apps/api/tests/unit/discharges/consultation/show.spec.ts` with the lot graph:
  - Lots are ordered by customer `companyName`, then `productName`, then `id`.
  - Each lot carries its `customer` and every `doorAssignments` row, in effect or ended, ordered by `effectiveFrom`, then `id`, each with its `warehouseDoor.warehouse`.
  - A door assigned to the same lot over two periods yields two entries.
  - An archived customer, warehouse, and door, each built with its factory's `archived` state, are still returned.
  - Seed the graph with `ProductLotFactory`, `WarehouseFactory`, `WarehouseDoorFactory`, and `WarehouseDoorProductLotAssignmentFactory`.
- [X] T021 [P] [US1] Add a transformer unit test to `apps/api/tests/unit/discharges/consultation/show.spec.ts`:
  - Each lot serializes `expectedQuantityTonnes` as a string with exactly three decimals: `12.5` becomes `"12.500"`.
  - `expectedTonnage` is the decimal sum. Lots of `0.1` and `0.2` sum to exactly `"0.300"`, and a discharge with no lot has `"0.000"`.
  - `customer`, `warehouseDoor`, `warehouse`, and `dock` each serialize as `{ id, name, status }`, with the customer's `name` taken from `companyName`.
- [X] T022 [P] [US1] Extend `apps/api/tests/integration/discharges/consultation/show.spec.ts`:
  - An `OBSERVER` receives an archived dock, customer, warehouse, and door with their names and `status: 'ARCHIVED'` (FR-015, FR-016).
  - The `productLots[].doorAssignments[]` shape matches `DoorPeriod` in the contract.
- [X] T023 [P] [US1] Create `apps/web/src/features/discharges/__tests__/discharge-detail-view.test.ts`, a unit test with no rendering, covering the pure helpers:
  - `isInEffect(period)` is true exactly when `effectiveTo === null`.
  - `splitPeriods(periods)` returns `{ inEffect, ended }`, preserving the input order in each group.
  - `lotDoorNotice(lot, dischargeStatus)` returns:
    - `'NONE_ASSIGNED'` when the lot has no assignment;
    - `'NONE_CURRENTLY_ASSIGNED'` when the discharge is `PLANNED` or `ACTIVE` and every assignment has ended;
    - `null` when an assignment is in effect;
    - `null` for a `CLOSED` discharge whose assignments have all ended.
  - `formatTonnes('1234.500')` returns `'1,234.500 t'`, and `formatTonnes('0.000')` returns `'0.000 t'`.
  - `formatPeriod({ effectiveFrom, effectiveTo })` returns `Since <formatDateTime(from)>` for an open period and `<from> – <to>` for an ended one.
- [X] T024 [P] [US1] Create `apps/web/src/features/discharges/__tests__/list/row-selection.test.tsx` and delete `apps/web/src/features/discharges/__tests__/list/inert-rows.test.tsx`. The new test covers:
  - Each row exposes a link named `View discharge <vessel name>`.
  - Clicking that link, or pressing Enter on it, navigates to `/discharges/<id>` carrying the current `status` and `search`.
  - Clicking elsewhere on the row navigates the same way.
  - Mock both endpoints with `mockDischarges` and `mockDischargeDetail`.
- [X] T025 [P] [US1] Create `apps/web/src/features/discharges/__tests__/detail/identity.test.tsx`. Through `renderDischargeDetail`, it asserts:
  - the vessel name as `heading` level 1 and the status badge text;
  - the IMO, comment, dock, expected start (via `formatDateTime`), and expected tonnage (`formatTonnes`);
  - the italic `Not specified` for a null IMO and a null comment;
  - an `Archived` badge beside an archived dock.
- [X] T026 [P] [US1] Create `apps/web/src/features/discharges/__tests__/detail/product-lots.test.tsx`, covering:
  - Every lot is shown once, with its customer, product, quantity, and description (`Not specified` when null).
  - Two lots with the same product for different customers are shown separately.
  - Door assignments read `<warehouse> › <door>` with their period, in-effect entries first and ended ones after.
  - `No warehouse door assigned` appears for a lot without assignments.
  - `No warehouse door currently assigned` appears for an Active discharge's lot whose assignments have all ended, and does not appear for the same lot on a Closed discharge.
  - Archived customer, warehouse, and door references carry the `Archived` badge.
- [X] T027 [P] [US1] Create `apps/web/src/features/discharges/__tests__/detail/access.test.tsx`, modelled on `__tests__/access/authorization.test.tsx`. For each of the four roles, the same detail renders with no `button` other than navigation: no edit, activate, close, assign, release, or delete. An unauthenticated session requesting `/discharges/<id>` renders no discharge data and follows the app's existing 401 handling.

### Implementation for User Story 1

- [X] T028 [US1] In `LucidDischargeRepository.findDetail`, in `apps/api/app/discharges/shared/repositories/lucid_discharge_repository.ts`, preload `productLots`:
  - Include `customer` and `doorAssignments`, ordered by `effective_from`, then `id`, with `warehouseDoor` → `warehouse`.
  - Order lots by customer `company_name`, then `product_name`, then `id`. Join `customers` inside the preload callback and select `product_lots.*`, so that the order is applied in SQL (research.md Decision 6).
  - Apply no status filter anywhere.
- [X] T029 [US1] Extend `DischargeDetailTransformer` in `apps/api/app/discharges/shared/discharge_detail_transformer.ts`:
  - Emit `expectedTonnage`, the sum of `productLot.expectedQuantityTonnes` using `Decimal` from `decimal.js` starting at `new Decimal(0)`, serialized with `.toFixed(3)`.
  - Emit `productLots[]` as `{ id, productName, description, expectedQuantityTonnes: toFixed(3), customer: { id, name: companyName, status }, doorAssignments: [{ id, effectiveFrom, effectiveTo, warehouseDoor: { id, name, status }, warehouse: { id, name, status } }] }`.
  - Put the `{ id, name, status }` projection in one private helper so that every reference serializes identically.
  - Depends on T028.
- [X] T030 [P] [US1] Create `apps/web/src/features/discharges/discharge-detail-view.ts` with the pure helpers T023 pins: `isInEffect`, `splitPeriods`, `lotDoorNotice`, `formatTonnes`, and `formatPeriod`.
  - `formatTonnes` must not do arithmetic on the value. It groups the integer part of the fixed-3 string with `Intl.NumberFormat('en-GB')`, keeps the three decimals verbatim, and appends ` t`.
  - Give it a doc comment saying that it belongs in `helpers/` once a second feature displays tonnes (plan.md).
- [X] T031 [P] [US1] Create `apps/web/src/features/discharges/ui/detail/effective-period.tsx`. It renders `formatPeriod(period)` and marks an ended period as muted, with a text `Ended` label for screen readers, so that the state never relies on color alone.
- [X] T032 [US1] Make the rows in `apps/web/src/features/discharges/ui/discharge-list.tsx` selectable (research.md Decision 11):
  - The vessel-name cell becomes a TanStack `Link` to `/discharges/$dischargeId` with `params`, `search: (previous) => previous`, and `aria-label="View discharge <vessel name>"`.
  - Remove `hover:bg-transparent` and the inert-row comment.
  - Add `cursor-pointer` and an `onClick` on the row that navigates the same way, as `features/customers/ui/customer-table.tsx` does.
  - Depends on T017.
- [X] T033 [P] [US1] Create `apps/web/src/features/discharges/ui/detail/discharge-identity-card.tsx`. It is a `Card` headed `Overview`, with `ResourceDetailField`s for IMO, vessel comment, dock, expected start, and expected tonnage. A `ResourceStatusBadge` appears beside the dock when its status is not `AVAILABLE`.
- [X] T034 [US1] Create `apps/web/src/features/discharges/ui/detail/discharge-product-lots-card.tsx`:
  - A `Card` headed `Product lots`, with one entry per lot showing customer (with its badge when archived), product name, `formatTonnes(expectedQuantityTonnes)`, and description (`Not specified` when null).
  - Under each lot, its door assignments from `splitPeriods`, in-effect entries first: each reads `<warehouse> › <door>`, with badges when those are archived, followed by `EffectivePeriod`.
  - Then the `lotDoorNotice` copy, when there is one.
  - Depends on T030 and T031.
- [X] T035 [US1] Render `DischargeIdentityCard` and `DischargeProductLotsCard` in `apps/web/src/features/discharges/ui/detail/discharge-detail-page.tsx`, below the heading. Depends on T033 and T034.

**Checkpoint**: US1 is complete. Selecting a row opens a detail showing the identity and product
lots, identical for every role and read-only.

---

## Phase 4: User Story 2 - Read the Planned Shifts and Their Resources (Priority: P1)

**Goal**: The detail lists the discharge's shifts in planned-start order, each with its period,
status, responsible, and every truck, warehouse door, and weighing area it has had.

**Independent Test**: Open a discharge with several shifts in different statuses. Check the order,
each shift's period, status, and responsible, and its three resource groups with their periods and
`None selected` notices.

### Tests for User Story 2 ⚠️

- [X] T036 [P] [US2] Extend `apps/api/tests/unit/discharges/consultation/show.spec.ts` with shifts:
  - Shifts are ordered by `plannedStartAt`, then `id`. Each preloads `responsible`, and `truckMemberships`, `warehouseDoorMemberships` (with `warehouseDoor.warehouse`), and `weighingAreaMemberships` (with `weighingArea`), each ordered by `effectiveFrom`, then `id`, with ended memberships included.
  - The transformer emits `responsible: { id, firstName, lastName }` and nothing else about the user.
  - A shift truck's `registration` is the discharge pool's `registrationSnapshot`, even after the truck's own `registration` has been changed.
  - When the discharge has no pool entry for that truck, `registration` falls back to the truck's current registration (research.md Decision 3).
  - Use `ShiftFactory`, the three factories in `shift_resource_membership_factories.ts`, `TruckFactory`, and `DischargeTruckAssignmentFactory`.
- [X] T037 [P] [US2] Extend `apps/api/tests/integration/discharges/consultation/show.spec.ts`: the `shifts[]` shape matches `ShiftDetail` in the contract, and the body contains no responsible `email`, `role`, or `accessStatus`.
- [X] T038 [P] [US2] Create `apps/web/src/features/discharges/__tests__/detail/shifts.test.tsx`, covering:
  - Shifts are rendered in planned-start order, each showing its planned period, `ShiftStatusBadge` text, and the responsible's full name.
  - Each shift shows three groups labelled `Trucks`, `Warehouse doors`, and `Weighing areas`, with entries and periods in-effect first.
  - A suspended truck carries a `Suspended` badge, and an archived weighing area carries an `Archived` badge.
  - `None selected` appears for an empty group.
  - An explicit no-shift empty state appears when `shifts` is empty.

### Implementation for User Story 2

- [X] T039 [US2] In `LucidDischargeRepository.findDetail`, in `apps/api/app/discharges/shared/repositories/lucid_discharge_repository.ts`:
  - Preload `shifts`, ordered by `planned_start_at`, then `id`, with `responsible`, `truckMemberships` (with `truck`), `warehouseDoorMemberships` (with `warehouseDoor` → `warehouse`), and `weighingAreaMemberships` (with `weighingArea`), each membership ordered by `effective_from`, then `id`.
  - Also preload `truckAssignments`, which the registration resolution needs.
- [X] T040 [US2] Extend `DischargeDetailTransformer` in `apps/api/app/discharges/shared/discharge_detail_transformer.ts` with `shifts[]` as `ShiftDetail`:
  - Build a `truckId → registrationSnapshot` map from `truckAssignments` once per discharge.
  - Emit each shift truck as `{ id, truckId, registration: map.get(truckId) ?? truck.registration, truckStatus: truck.status, effectiveFrom, effectiveTo }`.
  - Add a comment citing research.md Decision 3 for the fallback.
  - Depends on T039.
- [X] T041 [US2] Create `apps/web/src/features/discharges/ui/detail/discharge-shifts-card.tsx`:
  - A `Card` headed `Shifts`, with one entry per shift: planned period (`formatDateTime` for both ends), `ShiftStatusBadge`, and `Responsible: <firstName> <lastName>`.
  - Three labelled groups per shift, each using `splitPeriods` and `EffectivePeriod`:
    - trucks by registration, with `ResourceStatusBadge` when the status is not `AVAILABLE`;
    - doors as `<warehouse> › <door>`;
    - weighing areas by name.
  - `None selected` for an empty group.
  - An `Empty` state titled `No shifts planned` when `shifts` is empty.
  - Render it in `discharge-detail-page.tsx` after the product lots.
  - Depends on T040.

**Checkpoint**: US1 and US2 are complete, and each can still be demonstrated on its own.

---

## Phase 5: User Story 3 - Read the Discharge Truck Pool (Priority: P2)

**Goal**: The detail lists every truck ever reserved for the discharge, with the registration and
company captured at reservation, when it was reserved, and when it was released.

**Independent Test**: Open a discharge whose pool includes a re-registered truck, a truck whose
company changed, an archived truck, a suspended truck, and a released truck. Check the captured
values and the markers.

### Tests for User Story 3 ⚠️

- [X] T042 [P] [US3] Extend `apps/api/tests/unit/discharges/consultation/show.spec.ts` with the pool:
  - `truckPool[]` is ordered by `registrationSnapshot`, then `id`, and includes released entries (`DischargeTruckAssignmentFactory.apply('released')`).
  - Each entry emits the captured `registration` and `transportCompany.name` even after the truck's registration and company were changed.
  - `truckStatus` reflects a suspended truck (`TruckFactory.apply('suspended')`) and an archived one (`.apply('archived')`).
  - `transportCompany.status` is `ARCHIVED` for an archived company, and `transportCompany.id` and `status` are `null` when `transportCompanyId` is null.
- [X] T043 [P] [US3] Extend `apps/api/tests/integration/discharges/consultation/show.spec.ts`: the `truckPool[]` shape matches `TruckPoolEntry` in the contract, for a Closed discharge whose truck is released.
- [X] T044 [P] [US3] Create `apps/web/src/features/discharges/__tests__/detail/truck-pool.test.tsx`, covering:
  - One row per pool entry, with captured registration, captured company, and reservation time.
  - Held trucks come before released ones, and released ones show `Released <time>` and are muted.
  - The `Suspended` and `Archived` truck badges and the `Archived` company badge appear.
  - An explicit empty state appears when `truckPool` is empty.

### Implementation for User Story 3

- [X] T045 [US3] In `LucidDischargeRepository.findDetail`, in `apps/api/app/discharges/shared/repositories/lucid_discharge_repository.ts`, order the `truckAssignments` preload by `registration_snapshot`, then `id`, and preload `truck` and `transportCompany` on it.
- [X] T046 [US3] Extend `DischargeDetailTransformer` in `apps/api/app/discharges/shared/discharge_detail_transformer.ts` with `truckPool[]` as `TruckPoolEntry`:
  - `{ id, truckId, registration: registrationSnapshot, truckStatus: truck.status, transportCompany: { id: transportCompanyId, name: transportCompanyNameSnapshot, status: transportCompany?.status ?? null }, reservedAt, releasedAt }`.
  - Depends on T045.
- [X] T047 [US3] Create `apps/web/src/features/discharges/ui/detail/discharge-truck-pool-card.tsx`:
  - A `Card` headed `Truck pool` with a `Table` of registration, transport company, reserved, and released.
  - Held entries first, then released ones, muted and reading `Released <formatDateTime>`, split on `releasedAt === null`.
  - `ResourceStatusBadge` for a non-`AVAILABLE` truck or company.
  - An `Empty` state titled `No trucks reserved` when the pool is empty.
  - Render it in `discharge-detail-page.tsx` after the shifts.
  - Depends on T046.

**Checkpoint**: The whole preparation graph is readable, and the response matches
`contracts/discharge-detail.openapi.yaml` field for field.

---

## Phase 6: User Story 4 - Share, Restore, and Leave a Discharge Detail (Priority: P3)

**Goal**: The detail address survives a reload and can be shared. The way back and the breadcrumb
restore the list's tab and search. An unknown discharge shows a not-found state with no retry.

**Independent Test**: Select a status and a search, open a discharge, reload, open the address in
a fresh session, go back. The same discharge is restored, and the list returns with its state.
An unknown id shows the not-found state.

### Tests for User Story 4 ⚠️

- [X] T048 [P] [US4] Create `apps/web/src/features/discharges/__tests__/detail/navigation.test.tsx`, covering:
  - From `/discharges?status=closed&search=loire`, opening a row and then activating `Back to discharges` returns to the Closed tab with `loire` in the search box.
  - The `Discharges` breadcrumb link does the same.
  - Re-rendering the same detail address shows the same discharge.
  - `/discharges/<id>` without a query string opens it, and its back link lands on the Active tab.
  - `/discharges/<closed id>?status=active&search=zzz` still opens that discharge.
  - An unknown id, and the path `/discharges/nope`, show not-found copy and a `Back to discharges` link, with no `Retry` button.
- [X] T049 [P] [US4] Extend `apps/web/src/libraries/tuyau/api-error.test.ts` with `isNotFoundError`: it is true for a `TuyauError` with status 404, and false for 401, 500, network errors, and non-Tuyau errors.
- [X] T050 [P] [US4] Create `apps/web/src/components/layout/__tests__/authenticated-layout/breadcrumb-search.test.tsx`, covering:
  - On a nested route, an ancestor crumb's link keeps the current search.
  - On every single-crumb page, the crumb is still rendered as the current page and not as a link.
  - Use the discharges routes as the nested case.

### Implementation for User Story 4

- [X] T051 [P] [US4] Add `export function isNotFoundError(error: unknown): boolean` beside `isUnauthorizedError` in `apps/web/src/libraries/tuyau/api-error.ts`, returning `error instanceof TuyauError && error.status === 404`.
- [X] T052 [P] [US4] In `apps/web/src/components/layout/authenticated-header.tsx`, make the ancestor crumb's `Link` keep the current search: render `<Link to={match.href} search={(previous) => previous} />`, or the equivalent the router's types accept. Add a comment saying that a nested route's parent owns its list state, so its crumb must return to the list the user came from (research.md Decision 8).
- [X] T053 [P] [US4] Create `apps/web/src/features/discharges/ui/detail/discharge-not-found.tsx`. It uses `Empty` with the title `Discharge not found` and a description saying that the address refers to no discharge, plus a `Back to discharges` `Link` to `/discharges` with `search: (previous) => previous`. It has no retry action.
- [X] T054 [US4] In `apps/web/src/routes/_authenticated/discharges.$dischargeId.tsx`, wrap the loader's `ensureQueryData` in a `try`/`catch` that rethrows TanStack Router's `notFound()` when `isNotFoundError(error)` and rethrows anything else unchanged. Set `notFoundComponent: DischargeNotFound`. Depends on T051 and T053.
- [X] T055 [US4] Add a `Back to discharges` `Link` above the heading in `apps/web/src/features/discharges/ui/detail/discharge-detail-page.tsx`, to `/discharges` with `search: (previous) => previous`, styled as the ghost `size="sm"` back button that `features/customers/ui/edit-customer-panel.tsx` uses.

**Checkpoint**: Every navigation path in `contracts/ui-state.md` works, and not-found is never
presented as a failure.

---

## Phase 7: User Story 5 - Recover From Loading and Failed Consultation (Priority: P3)

**Goal**: Loading, failure with retry, and empty sections each have their own feedback.

**Independent Test**: Delay the detail response, fail it and then recover, and open a planned
discharge with no lot, shift, or truck. Each case shows its own feedback, and retry recovers.

### Tests for User Story 5 ⚠️

- [X] T056 [P] [US5] Create `apps/web/src/features/discharges/__tests__/detail/feedback.test.tsx`, covering:
  - With `mockDischargeDetail({ delayMs })`, the pending state renders before the detail, and never an empty detail.
  - With `failTimes: 1`, the error state shows a `Retry` action, and activating it displays the detail without a page reload.
  - A detail with empty `productLots`, `shifts`, and `truckPool` shows three distinct section empty states, while the identity card still renders.
  - Visiting the same detail twice issues two requests (`onRequest` count), proving `staleTime: 0` refreshes stale data (FR-024).

### Implementation for User Story 5

- [X] T057 [P] [US5] Create `apps/web/src/features/discharges/ui/detail/discharge-detail-pending.tsx`: a heading-sized `Skeleton` plus one card-shaped `Skeleton` per section, following `features/discharges/ui/discharges-pending.tsx`.
- [X] T058 [P] [US5] Create `apps/web/src/features/discharges/ui/detail/discharge-detail-error.tsx`, following `discharges-error.tsx`. It renders `ResourceCollectionError` with `label="discharge"`. Its retry reads `dischargeId` from `getRouteApi('/_authenticated/discharges/$dischargeId').useParams()`, calls `queryClient.removeQueries({ queryKey: dischargeQueries.detail(dischargeId).queryKey })`, and then awaits `router.invalidate()`.
- [X] T059 [US5] Set `pendingComponent: DischargeDetailPending` and `errorComponent: DischargeDetailError` in `apps/web/src/routes/_authenticated/discharges.$dischargeId.tsx`. Depends on T057 and T058.
- [X] T060 [US5] Add an `Empty` state titled `No product lots` to `apps/web/src/features/discharges/ui/detail/discharge-product-lots-card.tsx`, for a discharge with no lot. Confirm that the shifts and truck-pool empty states from T041 and T047 use distinct titles, and that the identity card is unaffected (FR-018).

**Checkpoint**: All five stories are complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Scale, regression, and the repository's delivery gates.

- [X] T061 [P] Add a scale case to `apps/api/tests/unit/discharges/consultation/show.spec.ts`. Build one discharge with 20 lots, 60 pool trucks, and 40 shifts, each shift with one membership of each kind, using the factories. Assert that `findDetail` returns the whole graph, with no entry missing or duplicated (SC-002, SC-004).
- [X] T062 [P] Extend `apps/web/src/components/layout/__tests__/authenticated-layout/discharges-navigation.test.tsx` so that the sidebar's `Operations → Discharges` entry must be marked as the current page on `/discharges/<id>`, as it already is on `/discharges`. If the nested route breaks that, fix the sidebar's active-match in `apps/web/src/components/layout/app-sidebar.tsx` so that it also matches descendant paths.
- [X] T063 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` at the repository root, and fix every failure the slice introduced.
- [ ] T064 Walk through every table in `quickstart.md` against the seeded database (`pnpm --filter @portflow/api db:fresh`, then `pnpm dev`), as an observer and as an organization admin, and note the result in the PR description.
  - **Partial, 2026-09-11**: the API table was validated against the existing seeded dev database (27 discharges), as an operations lead, without running `db:fresh`, which would wipe the database shared with the main checkout. Every managed discharge returned its full graph, and unknown and malformed ids returned `E_DISCHARGE_NOT_FOUND`. The browser tables still need a human pass. This validation also surfaced the seed issue recorded in quickstart.md § Known data issue.
- [X] T065 Request a fresh read-only review of the final diff, per Constitution VII, and resolve or explicitly justify every confirmed finding.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks every story, because it creates the
  endpoint, the Tuyau key, the route structure, and the page shell.
- **US1 to US5 (Phases 3 to 7)**: Each depends on Phase 2 only, with the file overlaps noted
  below.
- **Polish (Phase 8)**: Depends on every story the delivery includes.

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2.
- **US2 (P1)**: Functionally independent of US1. It edits the same repository, transformer, and
  page files, so run it after US1 or merge carefully. It preloads `truckAssignments` itself, so it
  does not need US3.
- **US3 (P2)**: Independent of US1 and US2 functionally, with the same files. T045 adds ordering and
  nested preloads to the `truckAssignments` preload that T039 introduced. If US3 runs before US2,
  T045 introduces the preload itself.
- **US4 (P3)**: Independent of US1 to US3. It touches the detail route, the page header, the shared
  header, and the API-error helper.
- **US5 (P3)**: T056 to T059 are independent. T060 edits the lot card from US1 and checks the cards
  from US2 and US3, so it runs last.

### Within Each Story

- Tests first, confirmed red.
- API: repository preload, then transformer.
- Web: pure helpers, then components, then page composition.

### Parallel Opportunities

- Phase 2:
  - T002, T003, and T004 (tests) run together.
  - T005 and T006 run together, and alongside T007.
  - T012 and T013 run together.
  - T018 can start as soon as Phase 1 is done.
- US1: T020 to T027 (all tests) run together. After them, T030, T031, and T033 run in parallel with
  the API tasks T028 and T029.
- US2: T036, T037, and T038 run together.
- US3: T042, T043, and T044 run together.
- US4: T048 to T053 all run together. Only T054 and T055 wait.
- US5: T056, T057, and T058 run together.
- Across stories: US4 can proceed in parallel with US1 to US3, since it shares no file with them
  except the page header line.

---

## Parallel Example: User Story 1

```bash
# All US1 tests at once, confirmed red:
Task: "T020 API unit — lot graph ordering and archived references in apps/api/tests/unit/discharges/consultation/show.spec.ts"
Task: "T022 API integration — observer receives archived labels in apps/api/tests/integration/discharges/consultation/show.spec.ts"
Task: "T023 Web unit — period, notice, and tonnes helpers in apps/web/src/features/discharges/__tests__/discharge-detail-view.test.ts"
Task: "T024 Web feature — row selection in apps/web/src/features/discharges/__tests__/list/row-selection.test.tsx"
Task: "T026 Web feature — product lots card in apps/web/src/features/discharges/__tests__/detail/product-lots.test.tsx"

# Then API and web implementation side by side:
Task: "T028 + T029 lot preloads and transformer in apps/api/app/discharges/shared/"
Task: "T030 pure helpers in apps/web/src/features/discharges/discharge-detail-view.ts"
Task: "T033 identity card in apps/web/src/features/discharges/ui/detail/discharge-identity-card.tsx"
```

## Parallel Example: User Story 4

```bash
Task: "T051 isNotFoundError in apps/web/src/libraries/tuyau/api-error.ts"
Task: "T052 ancestor crumb keeps search in apps/web/src/components/layout/authenticated-header.tsx"
Task: "T053 not-found state in apps/web/src/features/discharges/ui/detail/discharge-not-found.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: confirm the green baseline.
2. Phase 2: build the endpoint, the route restructure, and the page shell. Every list test must
   still pass.
3. Phase 3 (US1): make rows selectable and add the identity and product lots.
4. **Stop and validate**: run the US1 independent test as each role. This is already useful: a
   user can open any discharge and see what it unloads and where it goes.

### Incremental Delivery

1. Setup + Foundational: the foundation is ready.
2. US1: rows open a detail with identity and lots (MVP).
3. US2: shifts and their resources.
4. US3: the truck pool, which completes the preparation graph.
5. US4: sharing, the way back, and not-found.
6. US5: loading, failure and retry, and empty sections.
7. Polish: scale, gates, the quickstart walkthrough, and a fresh review.

The slice ships as one PR, per Constitution II. The checkpoints are review and demo points inside
it, not separate merges.

---

## Notes

- `[P]` marks tasks that touch different files and depend on no incomplete task.
- No task writes to the database outside test factories. The slice is read-only (FR-025), and no
  migration, seed, or mutation endpoint may appear in the diff.
- Commit after each task or logical group with Conventional Commits, for example
  `feat(discharges): consult one discharge's preparation graph`.
- If a test passes before its implementation exists, it is not testing the new behavior. Tighten
  it before moving on.
