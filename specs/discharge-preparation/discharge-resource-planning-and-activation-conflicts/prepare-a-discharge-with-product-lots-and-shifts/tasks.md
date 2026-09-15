---
description: "Task list for Prepare a Planned Discharge With Its Product Lots and Shifts (GH-53)"
---

# Tasks: Prepare a Planned Discharge With Its Product Lots and Shifts

**Input**: Design documents from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/prepare-a-discharge-with-product-lots-and-shifts/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required. Constitution IV mandates RED → GREEN → REFACTOR for business behavior, and
`apps/api/AGENTS.md` and `apps/web/AGENTS.md` name the test seams each layer must have. Write each
test task first and confirm it fails for the expected reason before starting its implementation task.

**Organization**: Tasks are grouped by user story so that each story can be implemented and tested on
its own:
- US1 creates a discharge.
- US2 makes every refusal of that creation precise and safe.
- US3 corrects the identity.
- US4 manages the lots.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `[US1]`–`[US4]`, mapping to the user stories in `spec.md`

## Path Conventions

This is a PNPM/Turbo monorepo with `apps/api/` (AdonisJS) and `apps/web/` (TanStack Start). All paths
below are relative to the repository root.

`#discharges/*`, `#users/*`, `#models/*`, `#shared/*`, `#database/factories/*`, and
`#generated/controllers` are existing API import aliases. `@/…` is the web source alias.

API conventions to follow throughout:
- **Use cases**: `@inject()` classes with an explicit `<UseCase>Input` type. They normalize input
  (trim, empty to `null`), never the validators (`apps/api/AGENTS.md`).
- **Repositories**: they return typed outcomes (`{ kind: … }`) and never throw HTTP exceptions.
- **Controllers**: authorize first, then validate, then call the use case, then set any non-200
  status on `ctx.response` and return `serialize(...)`.
- **Tests**: follow `tests/README.md`: 401, 403, success, then endpoint-specific failures.

Web conventions:
- Feature tests render through the real router with MSW (`renderApp`) and never mock the Tuyau
  client.
- Copy comes from `@/helpers/resource-copy`.
- Forms use `useAppForm`, the registered fields, `FormError`, and `SubmitButton`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Start from a known-green baseline, so that every later red test is red because of this
slice.

- [X] T001 Run `pnpm --filter @portflow/api test` and `pnpm --dir apps/web exec vitest run`, and note in the PR description that both pass on the branch before any change. If either fails, stop and report instead of proceeding.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the pieces every story shares:
- API: the preparation policy, the eligibility rule, the wire-format validators, the shared
  identity and lot validators, the exceptions, the issue-to-422 helper, and the locked-read
  repository.
- Web: indexed error mapping, date-time entry, the permission helper, the shared schemas and field
  groups, and the card action slot.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for the shared pieces ⚠️

> Write these first and confirm they fail.

- [X] T002 [P] Create `apps/api/tests/unit/shared/validators/tonnage.spec.ts`. Using `vine.create({ quantity: tonnageString() })` from T008, it asserts:
  - Accepted: `'1'`, `'0.001'`, `'1250.5'`, `'999999999.999'`.
  - Refused with a field error on `quantity`: `'0'`, `'0.000'`, `'-1'`, `'1.2345'`, `'1e3'`, `' 12'`, `'1,5'`, `''`, `'1000000000'`, and the number `12`.
- [X] T003 [P] Create `apps/api/tests/unit/shared/validators/instant.spec.ts`. It asserts that the `instant()` rule from T009 behaves as follows:
  - Accepted: `'2026-10-01T06:00:00.000+02:00'`, `'2026-10-01T04:00:00Z'`, and `'2026-10-01T06:00+02:00'`.
  - Refused: `'2026-10-01T06:00:00'` (no offset), `'2026-10-01'`, `'not a date'`, and `'2026-02-30T06:00:00Z'`.
  - `parseInstant('2026-10-01T06:00:00.000+02:00')` returns a valid Luxon `DateTime` equal to `2026-10-01T04:00:00Z`.
- [X] T004 [P] Create `apps/api/tests/unit/discharges/preparation/policy.spec.ts`, modelled on `apps/api/tests/unit/discharges/consultation/policy.spec.ts`:
  - `new DischargePolicy().create(user)` and `.update(user)` allow `OPERATIONS_LEAD`, `OPERATIONS_ADMIN`, and `ORGANIZATION_ADMIN` when `accessStatus` is `ACTIVE`.
  - Both deny `OBSERVER` whatever the status, and deny every role when `accessStatus` is `PENDING`, `CANCELLED`, or `DEACTIVATED`.
- [X] T005 [P] Create `apps/api/tests/unit/users/consultation/shift_responsible_eligibility.spec.ts`:
  - `SHIFT_RESPONSIBLE_ROLES` equals `['OPERATIONS_LEAD', 'OPERATIONS_ADMIN', 'ORGANIZATION_ADMIN']`.
  - `isEligibleShiftResponsible(user)` is `true` only for an `ACTIVE` user with one of those roles. It is `false` for an active observer and for pending, cancelled, and deactivated users of every role.
- [X] T006 [P] Extend `apps/web/src/libraries/forms/api-error.test.ts` with three cases for `applyValidationError`:
  - Details on `productLots.1.productName` and `shifts.0.responsibleUserId` are set as field errors on `productLots[1].productName` and `shifts[0].responsibleUserId`.
  - A flat path such as `vesselName` is unchanged, so the existing cases still pass.
  - When the optional `formFields` argument is given, a detail whose translated path is not in it is appended to the form-level error message rather than dropped.
- [X] T007 [P] Create `apps/web/src/helpers/dates.test.ts`:
  - `toDateTimeLocalValue('2026-10-01T04:00:00.000Z')` returns the `YYYY-MM-DDTHH:mm` value of that instant in the test's local zone. Build the expectation with `new Date(...)` getters, not a hard-coded string.
  - `fromDateTimeLocalValue('2026-10-01T06:00')` returns an ISO string with an explicit `±HH:MM` offset that denotes the same local wall time.
  - The two functions round-trip.
  - `fromDateTimeLocalValue('')` and an invalid value return `null`.

### API implementation

- [X] T008 [P] Create `apps/api/app/shared/validators/tonnage_validator.ts`, exporting `TONNAGE_PATTERN = /^\d{1,9}(\.\d{1,3})?$/` and `tonnageString()`. The latter returns `vine.string().regex(TONNAGE_PATTERN)` plus a `vine.createRule` that refuses a value whose digits are all zero. Add a doc comment: tonnages cross the wire as strings, so `NUMERIC(12,3)` receives exactly what was typed (research.md Decision 6). Makes T002 pass.
- [X] T009 [P] Create `apps/api/app/shared/validators/instant_validator.ts`, exporting two things:
  - `instant()`: `vine.string()` plus a rule that refuses anything `DateTime.fromISO(value, { setZone: true })` rejects as invalid, or that carries no explicit offset (check the raw string with `/(Z|[+-]\d{2}:?\d{2})$/`).
  - `parseInstant(value: string): DateTime`.

  Makes T003 pass.
- [X] T010 Add `create(user: User)` and `update(user: User)` to `apps/api/app/discharges/shared/discharge_policy.ts`. Both return `isEligibleShiftResponsible(user)`: the preparing roles are the responsible roles, per spec FR-001 and research.md Decision 9. Doc-comment that `update` covers identity and lot corrections. Depends on T011. Makes T004 pass.
- [X] T011 [P] Create `apps/api/app/users/shared/shift_responsible_eligibility.ts`, exporting `SHIFT_RESPONSIBLE_ROLES` (`as const`) and `isEligibleShiftResponsible(user: Pick<User, 'accessStatus' | 'role'>)`. The doc comment cites `CONTEXT.md` Shift Responsible and says GH-66 must import this rule rather than redefine it. Makes T005 pass.
- [X] T012 [P] Add four exceptions to `apps/api/app/discharges/shared/discharge_exceptions.ts`:
  - `DischargeNotPlannedException`: 409, `E_DISCHARGE_NOT_PLANNED`, `Only a planned discharge can be corrected`.
  - `ProductLotNotFoundException`: 404, `E_PRODUCT_LOT_NOT_FOUND`, `Product lot not found`.
  - `LastProductLotException`: 409, `E_DISCHARGE_LAST_PRODUCT_LOT`, `A discharge needs at least one product lot`.
  - `ProductLotHasDoorAssignmentsException`: 409, `E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS`, `This product lot has warehouse door assignments`.
- [X] T013 [P] Create `apps/api/app/discharges/shared/discharge_preparation_issues.ts`, exporting:
  - `type PreparationIssue = { field: string; rule: string; message: string }`;
  - `throwPreparationIssues(issues: PreparationIssue[]): void`, which does nothing for an empty list and otherwise throws `new errors.E_VALIDATION_ERROR(issues)` from `@vinejs/vine`.

  Add a unit case to `apps/api/tests/unit/discharges/preparation/rules.spec.ts` (create the file) asserting that the handler shape is produced: status 422, code `E_VALIDATION_ERROR`, `messages` equal to the issues (research.md Decision 3).
- [X] T014 [P] Create `apps/api/app/discharges/update/discharge_identity_validator.ts`, exporting `dischargeIdentityFields` (a plain object reused by other validators) and `correctDischargeIdentityValidator = vine.create(dischargeIdentityFields)`. The fields are:
  - `vesselName`: `vine.string().use(nonBlank()).maxLength(255)`;
  - `vesselImo`: `vine.string().regex(/^\s*(\d{7})?\s*$/).nullable()`, so blank passes and the use case turns it into `null`;
  - `vesselComment`: `vine.string().maxLength(2000).nullable()`;
  - `dockId`: `vine.string().uuid()`;
  - `expectedStartAt`: `instant()`.

  Every key is required and the nullable keys must be present. Use `nonBlank` from `#shared/validators/lifecycle_validator`. Depends on T009.
- [X] T015 [P] Create `apps/api/app/discharges/product_lots/product_lot_validator.ts`, exporting `productLotFields` and `productLotValidator = vine.create(productLotFields)`:
  - `customerId`: `vine.string().uuid()`;
  - `productName`: `vine.string().use(nonBlank()).maxLength(255)`;
  - `expectedQuantityTonnes`: `tonnageString()`;
  - `description`: `vine.string().maxLength(2000).nullable()`.

  Depends on T008.
- [X] T016 Create `apps/api/app/discharges/shared/repositories/discharge_preparation_repository.ts`, an abstract class whose methods all take a `TransactionClientContract`. Its doc comment gives the lock order: discharge, then docks, then customers, then users (research.md Decision 5). Start it with four abstract methods:
  - `lockDischarge(id, client): Promise<Discharge | null>`: `FOR UPDATE`, `null` for a malformed id.
  - `lockDocks(ids, client): Promise<Map<string, Dock>>`: `FOR SHARE`, ordered by id, deduplicated.
  - `lockCustomers(ids, client): Promise<Map<string, Customer>>`: same.
  - `lockUsers(ids, client): Promise<Map<string, User>>`: same.

  Create `lucid_discharge_preparation_repository.ts` beside it, implementing them:
  - `isUuid` filtering from `#shared/database/is_uuid`;
  - `.whereIn('id', ids).orderBy('id')` with `query.knexQuery.forShare()`, as `lockUsers` in `lucid_user_repository.ts` does with `forNoKeyUpdate`;
  - `.forUpdate()` on the discharge.

  Bind it in `apps/api/providers/repositories_provider.ts`. Later stories add methods to this pair.

### Web implementation

- [X] T017 [P] Update `apps/web/src/libraries/forms/api-error.ts`:
  - `applyValidationError(form, error, formFields?: readonly string[])` rewrites every numeric dotted segment into bracket notation, with `field.replace(/\.(\d+)(?=\.|$)/g, '[$1]')`.
  - When `formFields` is given, it appends the messages of unmatched details to `form`, separated by a space after `apiError.message`.

  Makes T006 pass without changing any existing caller.
- [X] T018 [P] Add `toDateTimeLocalValue(iso: string): string` and `fromDateTimeLocalValue(local: string): string | null` to `apps/web/src/helpers/dates.ts`:
  - native `Date` only;
  - the offset is computed from `getTimezoneOffset()` and formatted `±HH:MM`;
  - doc comment: entry uses the browser zone, as `formatDateTime` does for display (research.md Decision 6).

  Makes T007 pass.
- [X] T019 [P] Create `apps/web/src/libraries/forms/fields/date-time-field.tsx`, a `DateTimeField` modelled on `text-field.tsx`: the same `label`, `description`, `required`, and `id` props, `getFieldPresentation`, and `aria-describedby`. It renders `<Input type="datetime-local" step={60}>` bound to the string value. Register it in `apps/web/src/libraries/forms/form.tsx` beside `TextField`.
- [X] T020 [P] Create `apps/web/src/features/discharges/discharge-permissions.ts`, exporting `canPrepareDischarges(user: SessionUser | null | undefined): boolean`. It is `true` only for an `ACTIVE` `OPERATIONS_LEAD`, `OPERATIONS_ADMIN`, or `ORGANIZATION_ADMIN`. The doc comment follows `features/users/helpers/user-permissions.ts`: it mirrors the API rule and is not a security boundary. Add `apps/web/src/features/discharges/__tests__/discharge-permissions.test.ts` covering the four roles and a non-active user, written first.
- [X] T021 [P] Create `apps/web/src/features/discharges/discharge-preparation-schema.ts` and, first, its test `apps/web/src/features/discharges/__tests__/discharge-preparation-schema.test.ts`. The module exports:
  - `dischargeIdentitySchema`, a Zod object of strings:
    - `vesselName`: trimmed, required, at most 255 characters;
    - `vesselImo`: empty or `/^\d{7}$/` after trim, with message `Enter the 7-digit IMO number`;
    - `vesselComment`: at most 2000 characters;
    - `dockId`: required;
    - `expectedStartAt`: required and parseable by `fromDateTimeLocalValue`.
  - `productLotSchema`:
    - `customerId`: required;
    - `productName`: trimmed, required, at most 255 characters;
    - `expectedQuantityTonnes`: trimmed, matching `/^\d{1,9}(\.\d{1,3})?$/` and not all zeros, with message `Enter a quantity above 0 with at most 3 decimals`;
    - `description`: at most 2000 characters.
  - `emptyProductLot()`.
  - `toIdentityBody(values)` and `toProductLotBody(values)`: trim, turn empty optionals into `null`, convert dates with `fromDateTimeLocalValue`, and keep the quantity as its trimmed string.
  - `identityFormValues(detail)` and `productLotFormValues(lot)`: the inverse, for pre-filling.

  The test covers each rule's accept and refuse edges and both mappings.
- [X] T022 Create `apps/web/src/features/discharges/ui/preparation/discharge-identity-fields.tsx` and `product-lot-fields.tsx`:
  - Each renders its fields via `form.AppField` for a given `name` prefix: `''` for identity, and `productLots[i].` or `''` for a lot. They follow the labels of `contracts/ui-state.md`: `Vessel name`, `IMO number`, `Dock`, `Expected start`, `Vessel comment`; and `Customer`, `Product name`, `Expected quantity (t)`, `Description`.
  - Each takes its options as props: `docks: { id; name }[]` and `customers: { id; name }[]`.
  - They own no mutation and no submit.
  - Depends on T019 and T021.
- [X] T023 [P] Add an optional `actions?: ReactNode` prop to `apps/web/src/features/discharges/ui/detail/detail-section.tsx`, rendered inside `<CardAction>` from `@/components/ui/card` within the existing `CardHeader`. With no actions the markup is unchanged, and the existing `features/discharges/__tests__/detail/*` suites must stay green.
- [X] T024 [P] Add `available: () => tuyauQuery.docks.available.queryOptions({})` to `apps/web/src/features/docks/queries/dock-queries.ts`, mirroring `customerQueries.available`.

**Checkpoint**: The API and web unit suites from T002–T007, T013, T020, and T021 are green, and nothing user-visible has changed.

---

## Phase 3: User Story 1 - Prepare a Planned Discharge in One Step (Priority: P1) 🎯 MVP

**Goal**: A preparer opens `/discharges/new` from the list, enters the vessel, dock, expected start,
lots, and shifts, and lands on the new planned discharge's detail. An observer can do none of this.
A repeated submission creates one discharge.

**Independent Test**: Sign in as an operations lead, create a discharge with two lots and two shifts
entered out of order, and check four things: the detail shows exactly what was entered, with the
shifts in chronological order; the list's Planned tab shows the new discharge; resubmitting the same
body creates nothing new; an observer sees no action and is redirected away from `/discharges/new`.

### Tests for User Story 1 ⚠️

- [X] T025 [P] [US1] Create `apps/api/tests/integration/discharges/preparation/create.spec.ts`, with `testUtils.db().wrapInGlobalTransaction()` per test and factories for docks, customers, and users. Its body builder returns a valid body with a fresh `randomUUID()` id, two lots, and two shifts, where the later shift is listed first. Cases:
  - **401**: unauthenticated, and a logged-in `PENDING` user. Nothing is created (`Discharge.query()` count 0).
  - **403**: an `ACTIVE` observer gets `E_AUTHORIZATION_FAILURE`, and nothing is created.
  - **201 per role**: for each of `OPERATIONS_LEAD`, `OPERATIONS_ADMIN`, and `ORGANIZATION_ADMIN`, the `data` equals the `discharges.show` shape.
    - It has `id` equal to the body's id, `status: 'PLANNED'`, and the trimmed vessel name.
    - Each lot has its exact `expectedQuantityTonnes` with three decimals, and `expectedTonnage` is the sum.
    - Shifts are `PLANNED`, ordered by `plannedStartAt`, with their responsible.
    - `truckPool` is `[]`, every lot's `doorAssignments` is `[]`, and every shift's `trucks`, `warehouseDoors`, and `weighingAreas` are `[]` (FR-009).
  - **Persisted order**: `Shift.query().where('dischargeId', id).orderBy('sequence')` gives sequences `1, 2` in planned start order.
  - **Optional values**: `vesselImo: '  '`, `vesselComment: ''`, and `description: ''` are stored as `null`.
  - **Contiguous shifts**: a shift ending exactly when the next starts gives 201.
  - **Replay**: posting the same body twice gives `201`, then `200` with the same `data.id`, and exactly one discharge, two lots, and two shifts exist.
- [X] T026 [P] [US1] Create `apps/api/tests/unit/discharges/preparation/create.spec.ts`. It swaps `DischargePreparationRepository` for a stub (with `app.container.swap`, as `tests/unit/warehouses/creation/create.spec.ts` does) and asserts on `CreatePlannedDischargeUseCase.handle(input)`:
  - It passes the repository trimmed strings and `null` for blank optionals.
  - It passes shifts sorted by planned start, with `sequence` 1..N.
  - It returns `{ discharge, created: true }` on `CREATED`.
  - When the repository's `findDischargeIdentity(id)` finds an existing discharge, it returns `{ created: false }` without calling `createPlannedDischarge`.
  - It maps a primary-key `DUPLICATE_ID` outcome to `{ created: false }`.
- [X] T027 [P] [US1] Create `apps/api/tests/integration/users/consultation/eligible_shift_responsibles.spec.ts`:
  - 401 for unauthenticated and pending users.
  - 403 for an active observer.
  - 200 for a lead, an operations admin, and an organization admin, each with `data` holding exactly the active leads, operations admins, and organization admins.
  - The data excludes an active observer and a deactivated, a pending, and a cancelled lead.
  - It is ordered by `lastName`, `firstName`, then `id`, and each item has exactly the keys `id`, `firstName`, and `lastName`.
- [X] T028 [P] [US1] Rewrite the case `offers no creation or administration action to any role` in `apps/web/src/features/discharges/__tests__/access/authorization.test.tsx` into two tests:
  - For `ACTIVE_OBSERVER`, the same regex finds no action.
  - For each of `ACTIVE_OPERATIONS_LEAD`, `ACTIVE_OPERATIONS_ADMIN`, and `ACTIVE_ORGANIZATION_ADMIN`, a link named `Create discharge` points to `/discharges/new` and keeps the list's `status` and `search`. No other action from the regex is present.
- [X] T029 [P] [US1] Extend `apps/web/src/features/discharges/__tests__/support/test-helpers.ts` and `fixtures.ts` before the create tests:
  - Fixtures: `AVAILABLE_DOCKS`, `AVAILABLE_CUSTOMERS`, and `ELIGIBLE_RESPONSIBLES`.
  - `mockPreparationOptions({ user, docks, customers, responsibles, failTimes, delayMs })`, which registers `auth/me`, `GET /api/v1/docks/available`, `/customers/available`, and `/users/eligible-shift-responsibles`.
  - `mockCreateDischarge({ respond, onRequest })`, where `respond` receives the parsed body and returns `{ status, body }`. Its default builds a 201 detail from the body with `buildDischargeDetail`.
  - `renderCreateDischarge(search?)`, which calls `renderApp('/discharges/new?...')`.
- [X] T030 [P] [US1] Create `apps/web/src/features/discharges/__tests__/create/access.test.tsx`:
  - An observer opening `/discharges/new?status=closed&search=cedar` ends on the discharges list with the same search, and `GET /users/eligible-shift-responsibles` is never requested.
  - A lead opening it sees the heading `New discharge`, one `Product lot 1` group, and one `Shift 1` group.
  - The list's empty state, for a lead with no discharges, offers `Create discharge`.
- [X] T031 [P] [US1] Create `apps/web/src/features/discharges/__tests__/create/success.test.tsx`, which fills the form through accessible roles (comboboxes and options as in `features/trucks/__tests__/details/create.test.tsx`) with a vessel, a dock, an expected start, two lots (using `Add product lot`), and two shifts (using `Add shift`), the second earlier than the first. It asserts:
  - `Expected tonnage` shows the formatted sum before submitting.
  - The POST body has a UUID `id`, instants that end with an offset, quantities as the typed strings, and `null` for empty optionals.
  - While pending, the button reads `Creating…` and is disabled.
  - After 201, the detail heading shows the vessel name, the URL is `/discharges/{id}` with `status=planned` and the original search, a success toast is shown, and returning to the list refetches `discharges.index`.
  - A `200` replay response behaves identically.
  - `Remove` is disabled while one lot or one shift remains, and removes a group once there are two.
- [X] T032 [P] [US1] Create `apps/web/src/features/discharges/__tests__/create/options.test.tsx`:
  - While options load, the pending state is shown.
  - When one option request fails, `Unable to load the options for a new discharge` and `Try again` are shown, and retrying renders the form.
  - When available customers are empty, an alert names the missing collection and `Create discharge` is disabled.

### API implementation for User Story 1

- [X] T033 [P] [US1] Create `apps/api/app/discharges/create/create_planned_discharge_validator.ts`, exporting `createPlannedDischargeValidator = vine.create({...})` with these fields:
  - `id: vine.string().uuid()`;
  - `...dischargeIdentityFields`;
  - `productLots: vine.array(vine.object(productLotFields)).minLength(1).maxLength(100)`;
  - `shifts: vine.array(vine.object({ plannedStartAt: instant(), plannedEndAt: instant(), responsibleUserId: vine.string().uuid() })).minLength(1).maxLength(100)`.

  Depends on T014 and T015.
- [X] T034 [P] [US1] Create `apps/api/app/discharges/shared/discharge_preparation_rules.ts` with `orderShifts<T extends { plannedStartAt: DateTime }>(shifts: T[]): Array<T & { sequence: number }>`. It sorts ascending by instant with a stable tie on input index and numbers the result from 1. Add its cases to `apps/api/tests/unit/discharges/preparation/rules.spec.ts` first: out-of-order input, an already ordered input, and a single shift.
- [X] T035 [US1] Extend `DischargePreparationRepository` and its Lucid implementation (T016) with two methods:
  - `findDischargeIdentity(id, client): Promise<string | null>`.
  - `createPlannedDischarge(command, client): Promise<{ kind: 'CREATED'; dischargeId: string } | { kind: 'DUPLICATE_ID' }>`. It inserts the discharge with the supplied id and `status: 'PLANNED'`, then `ProductLot.createMany` (Decimal quantities), then `Shift.createMany` (`status: 'PLANNED'`, `sequence`), all with `{ client }`.

  A unique violation (`isUniqueViolation`) on the discharges primary key returns `DUPLICATE_ID`. Any other error rethrows. Export the `CreatePlannedDischargeCommand` type.
- [X] T036 [US1] Create `apps/api/app/discharges/create/create_planned_discharge_use_case.ts` with `CreatePlannedDischargeUseCase`:
  - **Input**: `CreatePlannedDischargeInput`, with raw strings and `DateTime` instants, as in `data-model.md`.
  - **Normalization**: trim, turn blank optionals into `null`, build `Decimal` quantities, and apply `orderShifts`.
  - **Transaction**: `db.transaction(async (client) => …)`. If `findDischargeIdentity` finds the id, return `{ dischargeId, created: false }`. Otherwise call `createPlannedDischarge` and map `DUPLICATE_ID` to `created: false`.
  - **After commit**: load the detail through `DischargeRepository.findDetail(dischargeId)`.
  - **Return**: `{ discharge, created }`.

  Makes T026 pass. Depends on T034 and T035.
- [X] T037 [US1] Add `store({ bouncer, request, response, serialize }: HttpContext)` to `apps/api/app/controllers/discharges_controller.ts`:
  - Authorize with `DischargePolicy` `create`.
  - Validate with `createPlannedDischargeValidator`.
  - Map the payload to the use-case input, converting instants with `parseInstant`.
  - Set `response.status(created ? 201 : 200)`.
  - Return `serialize(DischargeDetailTransformer.transform(discharge))`.
  - Inject the use case.
- [X] T038 [US1] Add `router.post('/', [controllers.Discharges, 'store']).as('store')` to the discharges group in `apps/api/start/routes.ts`, before `/:id`. T025 should now pass.
- [X] T039 [P] [US1] Add `abstract listEligibleShiftResponsibles(): Promise<User[]>` to `apps/api/app/users/shared/repositories/user_repository.ts` and implement it in `lucid_user_repository.ts`: `where('accessStatus', 'ACTIVE')`, `whereIn('role', SHIFT_RESPONSIBLE_ROLES)`, ordered by `lastName`, `firstName`, then `id`.
- [X] T040 [US1] Create `apps/api/app/users/eligible_shift_responsibles/list_eligible_shift_responsibles_use_case.ts` (`ListEligibleShiftResponsiblesUseCase.handle()`), which returns the repository result. Add `listEligibleShiftResponsibles(user)` to `apps/api/app/users/shared/user_policy.ts`, returning `isEligibleShiftResponsible(user)`. Depends on T039.
- [X] T041 [US1] Add `eligibleShiftResponsibles({ bouncer, serialize })` to `apps/api/app/controllers/users_controller.ts`. It authorizes `listEligibleShiftResponsibles` and returns `serialize(UserTransformer.transform(users).useVariant('toSummary'))`. Register `router.get('/eligible-shift-responsibles', [controllers.Users, 'eligibleShiftResponsibles']).as('eligible_shift_responsibles')` as the first route of the users group in `apps/api/start/routes.ts`, before any `/:id` route. T027 should now pass.
- [X] T042 [US1] Boot the API once (`pnpm --filter @portflow/api dev`, then stop it) to regenerate `apps/api/.adonisjs/client/registry/*` and `apps/api/.adonisjs/server/*`. Check that `discharges.store` and `users.eligible_shift_responsibles` appear in the registry, and commit the regenerated files.

### Web implementation for User Story 1

- [X] T043 [P] [US1] Add `eligibleResponsibles: () => tuyauQuery.users.eligibleShiftResponsibles.queryOptions({})` to `apps/web/src/features/discharges/queries/discharge-queries.ts`. Depends on T042.
- [X] T044 [P] [US1] Create `apps/web/src/features/discharges/mutations/use-discharge-mutations.ts`, exporting `useDischargeMutations()`, modelled on `features/customers/mutations/use-customer-mutations.ts`.
  - Start with `create = useMutation(tuyauQuery.discharges.store.mutationOptions(...))`.
  - Its `onSuccess` sets the query data of `dischargeQueries.detail(created.id)` to the response and invalidates `dischargeQueries.all()` exactly.
  - Export a shared `applyDetail(response)` helper for the later mutations.
- [X] T045 [P] [US1] Extend `apps/web/src/features/discharges/discharge-preparation-schema.ts`, and its test first:
  - `plannedShiftSchema`: `plannedStartAt` and `plannedEndAt` required and parseable, `responsibleUserId` required.
  - `emptyPlannedShift()`.
  - `createDischargeSchema`: the identity fields plus `productLots` with at least one item and `shifts` with at least one item.
  - `createDischargeFormDefaults()`: one empty lot and one empty shift.
  - `toCreateDischargeBody(values, id)`.
- [X] T046 [P] [US1] Create `apps/web/src/features/discharges/ui/preparation/planned-shift-fields.tsx`: `Planned start` and `Planned end` (`DateTimeField`), and `Responsible` (`SelectField`, whose options are `{ label: `${firstName} ${lastName}`, value: id }`), for a `shifts[i].` prefix. Depends on T019.
- [X] T047 [US1] Create `apps/web/src/features/discharges/ui/create/create-discharge-form.tsx`:
  - `useAppForm` with `createDischargeFormDefaults()`, and `createDischargeSchema` for `onBlur` and `onSubmit`.
  - Three `Card` sections, **Vessel and dock**, **Product lots**, and **Planned shifts**, per `contracts/ui-state.md`.
  - `form.AppField name="productLots" mode="array"` renders one `fieldset` with the legend `Product lot {n}` per item, each holding `ProductLotFields` and a `Remove` button named `Remove product lot {n}`. `Remove` calls `removeValue` and is disabled at one item. `Add product lot` calls `pushValue(emptyProductLot())`.
  - The same pattern applies to shifts, with `PlannedShiftFields`, `Shift {n}`, and `Add shift`.
  - A live `Expected tonnage` is computed in `form.Subscribe` from the valid quantities with exact string addition. Reuse `formatTonnes`, and add a pure `sumTonnes(values: string[]): string | null` to `features/discharges/discharge-detail-view.ts`, with unit cases in `discharge-detail-view.test.ts` written first.
  - The footer holds `Cancel`, a link back to the list with the search, and `SubmitButton` (`Create discharge`, pending `Creating…`), disabled when `disabled` is true.
  - The form takes `onSubmit(values)` and `disabled` props and owns no mutation.
- [X] T048 [US1] Create `apps/web/src/features/discharges/ui/create/create-discharge-page.tsx` and `create-discharge-pending.tsx`.
  - The page reads `useQuery` for `dockQueries.available()`, `customerQueries.available()`, and `dischargeQueries.eligibleResponsibles()`. It renders the error, retry, and empty-collection states of `contracts/ui-state.md`, modelled on `features/trucks/ui/create-truck-panel.tsx`.
  - It keeps a `creationId` with `useState(() => crypto.randomUUID())` for the page's lifetime.
  - On submit it calls `create.mutateAsync({ body: toCreateDischargeBody(values, creationId) })`. On success it shows `toast.success`, then calls `navigate({ to: '/discharges/$dischargeId', params: { dischargeId }, search: (previous) => ({ ...previous, status: 'planned' }) })`.
  - Depends on T044, T045, T047.
- [X] T049 [US1] Create `apps/web/src/routes/_authenticated/discharges.new.tsx` with `createFileRoute('/_authenticated/discharges/new')`:
  - `staticData: { breadcrumb: 'New discharge' }`.
  - The loader awaits `ensureSessionUser(queryClient)`. When `!canPrepareDischarges(user)`, it throws `redirect({ to: '/discharges', search: (previous) => previous, replace: true })`. Otherwise it `ensureQueryData`s the three option queries inside a `Promise.all`, and lets a failure reach the page's error state instead of the route error (catch it and return).
  - `pendingComponent: CreateDischargePending`, `component: CreateDischargePage`.
  - Regenerate `apps/web/src/routeTree.gen.ts` with `pnpm --dir apps/web generate`.

  T030 should now pass.

  **Implementation note**: The redirect runs in `beforeLoad`, which receives the typed inherited search. The option collections are not preloaded, so that `CreateDischargePage` owns their loading, failure-with-retry, and missing-collection states with `useQuery`. A loader preload would have consumed the first failure and hidden the retry state.
- [X] T050 [US1] Update `apps/web/src/features/discharges/ui/discharges-page.tsx`: when `canPrepareDischarges(useAuthenticatedUser())`, render a `Create discharge` `Button` that links to `/discharges/new` with the current search. Put it beside `InputSearch`, and also inside the list's empty state (`apps/web/AGENTS.md`: offer the create action in `Empty`). T028, T031, and T032 should now pass.

**Checkpoint**: US1 is fully functional. A preparer creates discharges end to end, an observer cannot,
and a replay is harmless. This is the MVP.

---

## Phase 4: User Story 2 - Be Stopped Before Recording an Incoherent Preparation (Priority: P1)

**Goal**: Every invalid creation is refused before anything is written:
- the API decides authoritatively, under locks that close the race with archives and deactivations;
- the offending values are identified on the right lot or shift;
- the form catches what it can before sending, and keeps every value.

**Independent Test**: Submit, one at a time: no vessel name, no lot, no shift, a zero quantity, a
four-decimal quantity, a duplicate lot in another case, overlapping shifts, an inverted shift, an
invalid IMO, an archived dock, an archived customer, and an observer as responsible. For each,
check that the refusal is attached to the offending field, that the other values are kept, and
that nothing was created.

### Tests for User Story 2 ⚠️

- [X] T051 [P] [US2] Extend `apps/api/tests/unit/discharges/preparation/rules.spec.ts` with `findPreparationIssues({ productLots, shifts })`:
  - Two lots with the same `customerId` and `'Wheat'` / `' wheat '` give `productLotIdentityUnique` on `productLots.0.productName` and `productLots.1.productName`.
  - The same name for different customers gives no issue.
  - `plannedEndAt` equal to or before `plannedStartAt` gives `shiftPeriodOrder` on `shifts.N.plannedEndAt`.
  - Shifts `[06–14]` and `[13–22]` give `shiftOverlap` on both `shifts.N.plannedStartAt`.
  - `[06–14]` and `[14–22]` give none.
  - Three mutually overlapping shifts report each index once.
  - A valid preparation gives `[]`.
- [X] T052 [P] [US2] Extend `apps/api/tests/unit/discharges/preparation/create.spec.ts`, using a stub repository that records call order:
  - Rule issues are thrown as `E_VALIDATION_ERROR` before any transaction or lock call.
  - Locks are requested in the order docks, customers, users, each with deduplicated ids.
  - A locked dock with `status: 'ARCHIVED'`, or absent from the map, raises `dockId` / `availableDock`.
  - A customer archived or missing for lot 1 raises `productLots.1.customerId` / `availableCustomer`.
  - A responsible that is an observer, deactivated, or missing for shift 0 raises `shifts.0.responsibleUserId` / `eligibleShiftResponsible`.
  - All reference issues of one submission are reported together, and `createPlannedDischarge` is not called.
- [X] T053 [P] [US2] Extend `apps/api/tests/integration/discharges/preparation/create.spec.ts` with 422 cases. Each asserts `error.code === 'E_VALIDATION_ERROR'`, the exact `details[].field` values, and that `Discharge`, `ProductLot`, and `Shift` counts are unchanged:
  - missing `vesselName`, a blank `vesselName`, missing `dockId`, missing `expectedStartAt`;
  - `productLots: []` and `shifts: []`;
  - a lot without `customerId`, without `productName`, or without `expectedQuantityTonnes`;
  - quantities `'0'`, `'-1'`, and `'1.2345'`;
  - `vesselImo: '123'`;
  - `expectedStartAt` without an offset;
  - a duplicate lot identity in another case;
  - an inverted shift, and overlapping shifts;
  - an archived dock and an unknown dock id (`DockFactory.apply('archived')` or its archived state);
  - an archived customer;
  - an observer, a deactivated lead, and a pending lead as responsible.
- [X] T054 [P] [US2] Extend `apps/api/tests/integration/docks.spec.ts` (single dock archive) and `apps/api/tests/integration/customers/lifecycle/archive.spec.ts` with one case each: archiving a dock or customer used by a planned discharge built with factories still gives `409 E_DOCK_IN_USE` or `E_CUSTOMER_IN_USE`, and leaves the reference `AVAILABLE`. Also add a unit case to `apps/api/tests/unit/docks/dock_use_cases.spec.ts` and the matching customer unit spec: the use case relies on the repository's `IN_USE` outcome rather than a usage check made outside the repository.
- [X] T055 [P] [US2] Create `apps/web/src/features/discharges/__tests__/create/validation.test.tsx`. Each case asserts that no POST is sent (via an `onRequest` spy) and that entered values are kept:
  - Submitting the untouched form shows required errors on the vessel name, dock, expected start, lot 1's customer, product name, and quantity, and shift 1's start, end, and responsible.
  - `'0'` and `'1.2345'` show the quantity message.
  - `'123'` shows the IMO message.
  - A duplicate lot (same customer, `Wheat` and `wheat`) shows an error on both lots' product name only after submit.
  - Overlapping shifts show an error on both planned starts, and an inverted shift on its planned end.
  - After a refused submission, focus is on the first field in error.
- [X] T056 [P] [US2] Create `apps/web/src/features/discharges/__tests__/create/server-refusals.test.tsx`:
  - A 422 with details `productLots.1.customerId` (`availableCustomer`) and `shifts.0.responsibleUserId` shows those messages under `Product lot 2`'s `Customer` and `Shift 1`'s `Responsible`, and every value is kept.
  - A detail on an unknown path appears in the form-level error.
  - A network failure (`HttpResponse.error()`) shows the failure toast and keeps values; resubmitting sends the same `id` as the first attempt.

### API implementation for User Story 2

- [X] T057 [US2] Add `findPreparationIssues({ productLots, shifts }): PreparationIssue[]` to `apps/api/app/discharges/shared/discharge_preparation_rules.ts`:
  - It compares lots by `customerId` and `productName.trim().toLowerCase()`, and checks shift order and pairwise overlap (`a.start < b.end && b.start < a.end`).
  - Messages: `This customer already has a lot with this product name`, `The planned end must be after the planned start`, and `This shift overlaps another shift`.
  - Also export `findLotIdentityClash(lots, candidate, ignoreLotId?)` for US4.

  Makes T051 pass.
- [X] T058 [US2] Update `CreatePlannedDischargeUseCase`:
  - Before opening the transaction, `throwPreparationIssues(findPreparationIssues(...))`.
  - Inside the transaction, after the replay check, call `lockDocks([dockId])`, `lockCustomers(lotCustomerIds)`, and `lockUsers(responsibleIds)`, in that order.
  - Build the `availableDock`, `availableCustomer`, and `eligibleShiftResponsible` issues from the locked rows: `status === 'AVAILABLE'` for docks and customers, and `isEligibleShiftResponsible` for users. Report customers per lot index and responsibles per shift index.
  - Throw them together before `createPlannedDischarge`.
  - Map a unique violation on `product_lots_identity_unique`, returned by the repository as a new `DUPLICATE_LOT_IDENTITY` kind, to the duplicate-lot issues as a backstop.

  Makes T052 and T053 pass.
- [X] T059 [US2] Harden the single archives (research.md Decision 5).
  - **Docks**: in `apps/api/app/docks/shared/repositories/lucid_dock_repository.ts`, run `archiveAvailable` in `Dock.transaction`. It locks the dock with `forUpdate()`, calls `this.usageChecker.findUsedByPlannedOrActiveDischarge({ referenceType: 'DOCK', referenceIds: [id], client: trx })`, returns a new `IN_USE` kind when used, and otherwise performs the existing guarded update with `{ client: trx }`.
  - **Dock use case**: in `apps/api/app/docks/archive/archive_dock_use_case.ts`, remove the pre-check and map `IN_USE` to `DockInUseException`. Add `IN_USE` to the `ArchiveDockResult` type in `dock_repository.ts`, and inject the usage checker in the Lucid repository as `archiveAvailableMany` already does.
  - **Customers**: apply the same change to `apps/api/app/customers/shared/repositories/lucid_customer_repository.ts`, `customer_repository.ts`, and `apps/api/app/customers/archive/archive_customer_use_case.ts`.

  Makes T054 pass. The existing dock and customer archive suites must stay green.

### Web implementation for User Story 2

- [X] T060 [US2] Extend `createDischargeSchema` in `apps/web/src/features/discharges/discharge-preparation-schema.ts` with a `superRefine`, used only in the form's `onSubmit` validator (the `own-profile-form` precedent: a cross-field error at blur blocks the first submit).
  - It adds the duplicate-lot issue at `['productLots', i, 'productName']`, the period-order issue at `['shifts', i, 'plannedEndAt']`, and the overlap issue at `['shifts', i, 'plannedStartAt']`, with the API's messages.
  - Split the form validators into `onBlur: createDischargeFieldsSchema` and `onSubmit: createDischargeSchema` in `create-discharge-form.tsx`.
  - Add the schema cases to `discharge-preparation-schema.test.ts` first.
- [X] T061 [US2] Update `apps/web/src/features/discharges/ui/create/create-discharge-page.tsx` and `create-discharge-form.tsx` to handle refused submissions:
  - Catch the mutation error in the form's `onSubmit` and call `applyValidationError(formApi, error, fieldNames(values))`. `fieldNames` is a helper in the schema module that lists every mounted field path, including `productLots[i].*` and `shifts[i].*`.
  - When it returns `false`, show `toast.error(resourceFailureTitle('create', 'discharge', values.vesselName.trim()), { description: parseApiError(error).message })`.
  - After any refusal, focus the first element with `aria-invalid="true"` inside the form.
  - `creationId` stays unchanged across retries.

  **Implementation note (T060–T061)**:
  - A plain `onSubmit` validator left a stale cross-rule error on the shift the user did not change. TanStack Form checks field validity before re-running form validators, so that stale error blocked every later submission.
  - The cross rules therefore run as an `onDynamic` validator (`creationCrossRulesSchema`) with `revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' })`: they run on submit, then on every change after the first attempt.
  - `createDischargeSchema`, the field rules plus the cross rules, remains the unit-tested contract.

  T055 and T056 should now pass.

**Checkpoint**: US1 and US2 together satisfy FR-001–FR-022 and FR-029–FR-032 for creation, and
the dock and customer archives stay consistent with the new writer.

---

## Phase 5: User Story 3 - Correct a Planned Discharge's Vessel, Dock, and Expected Start (Priority: P2)

**Goal**: A preparer corrects the identity of a planned discharge from its detail. Nothing else
changes, and active and closed discharges refuse.

**Independent Test**: On a planned discharge, `Edit` the vessel name, IMO, comment, dock, and expected
start, and verify the detail and list show the new values with lots and shifts untouched; verify no
`Edit` on an active or closed discharge or for an observer, and that a correction racing activation
is refused.

### Tests for User Story 3 ⚠️

- [X] T062 [P] [US3] Create `apps/api/tests/integration/discharges/preparation/correct_identity.spec.ts`, for `PATCH /api/v1/discharges/:id` with a full identity body:
  - **401**: unauthenticated, and a pending user.
  - **403**: an observer; the discharge is unchanged.
  - **200 per preparing role**: `data` shows the corrected, trimmed values, with `vesselImo: null` when sent blank. `status`, the lot ids and quantities, and the shift ids and periods are identical to before.
  - **404**: an unknown uuid and `not-a-uuid`, both `E_DISCHARGE_NOT_FOUND`.
  - **409**: an active and a closed discharge give `E_DISCHARGE_NOT_PLANNED`, unchanged.
  - **422**: a missing `vesselImo` key, a blank name, and a new archived dock (`dockId` / `availableDock`).
  - **Current dock not re-checked**: a planned discharge whose current dock was archived directly in the database is still corrected when `dockId` is unchanged.
- [X] T063 [P] [US3] Create `apps/api/tests/unit/discharges/preparation/correct_identity.spec.ts`, with a stub repository:
  - `lockDischarge` is called before any other lock.
  - `null` raises `DischargeNotFoundException`.
  - A non-`PLANNED` discharge raises `DischargeNotPlannedException` without calling `updateIdentity`.
  - `lockDocks` is called only when `dockId` differs from the current one.
  - Normalization trims values and turns blanks into `null`.
- [X] T064 [P] [US3] Update the case `shows %s the same read-only detail` in `apps/web/src/features/discharges/__tests__/detail/access.test.tsx`:
  - An observer sees no action on planned, active, and closed discharges.
  - Each preparing role sees `Edit` in `Overview` on a planned discharge only, and no action on active or closed ones.
- [X] T065 [P] [US3] Create `apps/web/src/features/discharges/__tests__/detail/correct-identity.test.tsx`, with MSW handlers added to `test-helpers.ts` as `mockCorrectIdentity({ respond, onRequest })`:
  - `Edit` opens the `Edit discharge` sheet, pre-filled: the expected start in local `datetime-local` form, and the IMO empty when `null`. The dock options include the current dock even if it is missing from available docks.
  - Saving sends every field, including `null`s, with instants that carry an offset.
  - While pending, the button reads `Saving…`.
  - On 200, the sheet closes, the Overview shows the response values without another GET of the detail, and a toast is shown.
  - On a 422, the sheet stays open with the field error.
  - On a 409 `E_DISCHARGE_NOT_PLANNED`, the sheet closes, the detail is refetched, and the `This discharge has started and can no longer be corrected` toast is shown.

### API implementation for User Story 3

- [X] T066 [US3] Add `updateIdentity(command: { dischargeId; vesselName; vesselImo; vesselComment; dockId; expectedStartAt }, client): Promise<void>` to `DischargePreparationRepository` and its Lucid implementation. It runs a guarded `Discharge.query({ client }).where('id', …).where('status', 'PLANNED').update({ …, updatedAt: DateTime.now().toSQL({ includeOffset: false }) })`, and throws `Error('Discharge changed during transaction')` if no row is affected, since the row is already locked.
- [X] T067 [US3] Create `apps/api/app/discharges/update/correct_discharge_identity_use_case.ts` with `CorrectDischargeIdentityUseCase`. Inside `db.transaction` it:
  - locks the discharge;
  - raises 404 or 409 as needed;
  - locks and checks the dock only if it changed, throwing `availableDock` via `throwPreparationIssues`;
  - calls `updateIdentity`.

  After commit it returns `DischargeRepository.findDetail(id)`. Makes T063 pass.
- [X] T068 [US3] Add `update({ bouncer, params, request, serialize }: HttpContext)` to `apps/api/app/controllers/discharges_controller.ts`: authorize `update`, validate with `correctDischargeIdentityValidator`, pass `params.id` and `parseInstant(expectedStartAt)`, and return the detail. Add `router.patch('/:id', [controllers.Discharges, 'update']).as('update')` to the discharges group in `apps/api/start/routes.ts`. Regenerate the registry as in T042. T062 should now pass.

### Web implementation for User Story 3

- [X] T069 [P] [US3] Add `correctIdentity` to `apps/web/src/features/discharges/mutations/use-discharge-mutations.ts`: `tuyauQuery.discharges.update.mutationOptions`. On success it calls `applyDetail`. On an error with code `E_DISCHARGE_NOT_PLANNED` or `E_DISCHARGE_NOT_FOUND`, it invalidates the detail query.
- [X] T070 [US3] Create `apps/web/src/features/discharges/ui/detail/edit-discharge-identity-sheet.tsx`:
  - `Sheet` with title `Edit discharge`, `DischargeIdentityFields` pre-filled with `identityFormValues(detail)`, and `SubmitButton` `Save` (pending `Saving…`).
  - Its dock options come from `useQuery(dockQueries.available())` plus the current dock when absent.
  - On success it closes and shows `toast.success(resourceSuccessMessage('update', 'discharge', vesselName))`.
  - On a 422 it runs `applyValidationError`.
  - On `E_DISCHARGE_NOT_PLANNED` or 404 it closes and shows a toast.
  - Otherwise it stays open and shows a toast.
- [X] T071 [US3] Wire the action into `apps/web/src/features/discharges/ui/detail/discharge-detail-page.tsx` and `discharge-identity-card.tsx`:
  - The page computes `canCorrect = canPrepareDischarges(useAuthenticatedUser()) && discharge.status === 'PLANNED'` and passes it down.
  - The identity card passes `actions={canCorrect ? <Button …>Edit</Button> : undefined}` to `DetailSection`, and the button opens the sheet held in local state.

  T064 and T065 should now pass.

**Checkpoint**: Identity corrections work independently of lot management.

---

## Phase 6: User Story 4 - Add, Correct, and Remove the Product Lots of a Planned Discharge (Priority: P2)

**Goal**: A preparer maintains a planned discharge's lots from its detail. The expected tonnage
follows every change. The last lot, and lots with door assignments, cannot be removed.

**Independent Test**: On a planned discharge, add a lot, correct another lot's quantity and customer,
and remove a third; verify detail and tonnage after each. Then verify the refusals: removing the
last lot, removing a lot with door assignments, a duplicate identity, and any lot change on an
active discharge.

### Tests for User Story 4 ⚠️

- [X] T072 [P] [US4] Create `apps/api/tests/integration/discharges/preparation/add_product_lot.spec.ts`, for `POST /api/v1/discharges/:dischargeId/product-lots`:
  - **401 and 403**, as in the other suites.
  - **201 per preparing role**: the detail includes the new lot, and `expectedTonnage` includes it.
  - **404** for an unknown or malformed discharge.
  - **409** `E_DISCHARGE_NOT_PLANNED` for active and closed discharges.
  - **422**:
    - an invalid quantity;
    - an archived customer (`customerId` / `availableCustomer`);
    - a clash with an existing lot of the same customer and ` WHEAT `, reported on `productName` / `productLotIdentityUnique`.
  - Every failure leaves the lot count unchanged.
- [X] T073 [P] [US4] Create `apps/api/tests/integration/discharges/preparation/correct_product_lot.spec.ts`, for `PATCH /api/v1/discharges/:dischargeId/product-lots/:id`:
  - **401 and 403**, as in the other suites.
  - **200**:
    - the corrected quantity changes `expectedTonnage`;
    - changing the customer keeps the lot id and its existing `doorAssignments` (use `WarehouseDoorProductLotAssignmentFactory`);
    - renaming to its own name in another case is accepted (no self-clash).
  - **404**:
    - `E_PRODUCT_LOT_NOT_FOUND` for an unknown lot, a malformed id, and a lot of another discharge;
    - `E_DISCHARGE_NOT_FOUND` for an unknown discharge.
  - **409** for an active discharge.
  - **422** for a clash with another lot.
  - **Current customer not re-checked**: a lot whose current customer was archived directly in the database is corrected when `customerId` is unchanged.
- [X] T074 [P] [US4] Create `apps/api/tests/integration/discharges/preparation/remove_product_lot.spec.ts`, for `DELETE /api/v1/discharges/:dischargeId/product-lots/:id`:
  - **401 and 403**, as in the other suites.
  - **200**: the detail no longer lists the lot, `expectedTonnage` drops by its quantity, and the row is gone.
  - **409** codes; the lot remains in each case:
    - `E_DISCHARGE_LAST_PRODUCT_LOT` for the only lot;
    - `E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS` for a lot with an ended assignment and for one with a current assignment;
    - `E_DISCHARGE_NOT_PLANNED` for active and closed discharges.
  - **404** for a lot of another discharge.
- [X] T075 [P] [US4] Create `apps/api/tests/unit/discharges/preparation/product_lots.spec.ts`, with a stub repository:
  - All three use cases lock the discharge first and refuse when it is not planned.
  - Add and correct call `findLotIdentityClash` against the locked discharge's lots, ignoring the corrected lot itself.
  - `lockCustomers` is called only for a new or changed customer.
  - Remove checks, in order, not planned, then last lot, then door assignments, and calls `deleteProductLot` only when all pass.
  - A foreign-key violation outcome from `deleteProductLot` maps to `ProductLotHasDoorAssignmentsException`.
  - Add `findLotIdentityClash` edge cases to `rules.spec.ts`.
- [X] T076 [P] [US4] Create `apps/web/src/features/discharges/__tests__/detail/add-product-lot.test.tsx` and `correct-product-lot.test.tsx`, with handlers added to `test-helpers.ts` (`mockAddProductLot` and `mockCorrectProductLot`):
  - `Add product lot` in the card header, and in the empty state of a planned discharge with no lot, opens an empty sheet; saving posts the body, updates the list and the `Expected tonnage` from the response, and shows a toast.
  - `Edit` on a lot, whose accessible name is `Edit {customer} · {product}`, opens a pre-filled sheet whose customer options include the current customer. Saving sends a PATCH.
  - A 422 on `productName` stays in the sheet.
  - A 404 `E_PRODUCT_LOT_NOT_FOUND` closes the sheet, refetches, and shows the toast `This product lot no longer exists`.
- [X] T077 [P] [US4] Create `apps/web/src/features/discharges/__tests__/detail/remove-product-lot.test.tsx`, with a `mockRemoveProductLot` handler:
  - `Remove {customer} · {product}` opens `Remove product lot?` with the lot described.
  - Confirming shows `Removing…`, then closes, updates the list from the response, and shows a toast.
  - `409 E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS` keeps the dialog open with the inline alert and disables `Remove`.
  - With a single lot, the lot's `Remove` is disabled and its tooltip reads `A discharge needs at least one product lot`.
  - An active discharge shows no lot action.

### API implementation for User Story 4

- [X] T078 [US4] Extend `DischargePreparationRepository` and its Lucid implementation with five methods:
  - `listProductLots(dischargeId, client)`: `{ id, customerId, productName }[]`.
  - `hasDoorAssignments(productLotId, client): Promise<boolean>`: any row of `warehouse_door_product_lot_assignments`, ended or not.
  - `insertProductLot(command, client)`.
  - `updateProductLot(command, client)`.
  - `deleteProductLot(productLotId, client): Promise<{ kind: 'DELETED' } | { kind: 'HAS_DOOR_ASSIGNMENTS' }>`: maps `isForeignKeyViolation` to that kind.

  Each write also sets the discharge's `updated_at`. Insert and update map `product_lots_identity_unique` violations to a `DUPLICATE_LOT_IDENTITY` kind.
- [X] T079 [US4] Create `apps/api/app/discharges/product_lots/add_product_lot_use_case.ts`, `correct_product_lot_use_case.ts`, and `remove_product_lot_use_case.ts`, each with its `…Input` type and a `db.transaction`:
  - Each locks the discharge (404 or 409) and loads its lots. Correct and remove then raise `ProductLotNotFoundException` when the lot id, guarded with `isUuid`, is not among them.
  - Add and correct:
    - check the clash with `findLotIdentityClash`, reported as a `productName` / `productLotIdentityUnique` issue;
    - lock and check the customer when it is new or changed (`customerId` / `availableCustomer`);
    - write, and map `DUPLICATE_LOT_IDENTITY` to the same issue.
  - Remove refuses `LastProductLotException` when the discharge has one lot, then `ProductLotHasDoorAssignmentsException` when `hasDoorAssignments` or the delete outcome says so, and otherwise deletes.
  - After commit, each returns `DischargeRepository.findDetail(dischargeId)`.

  Makes T075 pass.
- [X] T080 [US4] Create `apps/api/app/controllers/discharge_product_lots_controller.ts` with `store` (201), `update`, and `destroy`. Each authorizes `DischargePolicy` `update`; `store` and `update` validate with `productLotValidator`. Register a nested group in the discharges group of `apps/api/start/routes.ts`:

  ```ts
  router.group(() => {
    router.post('/', [controllers.DischargeProductLots, 'store']).as('store')
    router.patch('/:id', [controllers.DischargeProductLots, 'update']).as('update')
    router.delete('/:id', [controllers.DischargeProductLots, 'destroy']).as('destroy')
  }).prefix('/:dischargeId/product-lots').as('product_lots')
  ```

  Regenerate the registry as in T042, and check that `discharges.product_lots.*` is present. T072–T074 should now pass.

### Web implementation for User Story 4

- [X] T081 [P] [US4] Add three mutations to `apps/web/src/features/discharges/mutations/use-discharge-mutations.ts`: `addLot` (`tuyauQuery.discharges.productLots.store`), `correctLot` (`.update`), and `removeLot` (`.destroy`). All three call `applyDetail` on success. They invalidate the detail on `E_DISCHARGE_NOT_PLANNED`, `E_DISCHARGE_NOT_FOUND`, `E_PRODUCT_LOT_NOT_FOUND`, and `E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS`.
- [X] T082 [US4] Create `apps/web/src/features/discharges/ui/detail/product-lot-sheet.tsx`, with `mode: 'add' | 'edit'` and an optional `lot`:
  - It holds `ProductLotFields` with options from `customerQueries.available()`, plus the current customer in edit mode.
  - Titles are `Add product lot` or `Edit product lot`. Submit labels are `Add product lot` (`Adding…`) or `Save` (`Saving…`).
  - Outcomes follow `contracts/ui-state.md`: success closes and toasts; a 422 maps onto fields; `409` or `404` closes, refetches, and toasts; anything else toasts and stays open.
- [X] T083 [US4] Create `apps/web/src/features/discharges/ui/detail/remove-product-lot-dialog.tsx`, modelled on `features/users/ui/reset-password-confirmation.tsx`:
  - An `AlertDialog` mounted only while open, with title `Remove product lot?`, a description naming the customer, product, and formatted quantity, and a destructive `Remove` (`Removing…`).
  - Confirming calls `event.preventDefault(); void submit()`.
  - `E_DISCHARGE_LAST_PRODUCT_LOT` and `E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS` render an inline `Alert` and disable `Remove`.
  - `E_DISCHARGE_NOT_PLANNED` and 404 close the dialog and toast.
- [X] T084 [US4] Update `apps/web/src/features/discharges/ui/detail/discharge-product-lots-card.tsx` to take `canCorrect` from the detail page:
  - When true, the section header and the empty state render `Add product lot`.
  - Each lot's header row renders `Edit` and `Remove`, with `aria-label`s `Edit {customer} · {product}` and `Remove {customer} · {product}`.
  - `Remove` is disabled when the discharge has one lot, and described by the visible note `A discharge needs at least one product lot` through `aria-describedby`. A disabled button cannot show a tooltip; see `contracts/ui-state.md`.
  - The sheet and dialog are held in local state.

  T076 and T077 should now pass.

**Checkpoint**: All four stories are functional and independently testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Consistency, documentation alignment, and the constitution's delivery gates.

- [X] T085 [P] Confirm the slice stayed within research.md Decision 14: `git diff --stat master -- apps/api/database` shows no migration, seeder, or fixture change, and no Activity Log write was added. Revert anything that slipped in, or record the justification in the PR description.
- [X] T086 [P] Review every new or changed file for the API style rules in `apps/api/AGENTS.md` (airy function bodies, a blank line before a `return` after setup) and for doc comments on each new repository method, use case, and rule explaining *why*: lock order, the replay, and the reference re-check skipped when unchanged.
- [X] T087 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` at the repository root, and fix every finding.
  **Result (2026-09-15)**:
  - `pnpm check`: clean.
  - `pnpm typecheck`: both apps pass.
  - API tests: 1,556 passed.
  - Web tests: 316 files, 1,531 passed.
  - Both suites were run separately with `PORT=3399`, because an unrelated `bin/server.ts` held port 3333.
  - A combined `pnpm test` under a machine load average of 60–77 timed out 59 web tests across unrelated features. The same suite passed alone at a lower duration.
- [ ] T088 Run the API and screen validations of `quickstart.md` against a freshly seeded database (`pnpm --filter @portflow/api db:fresh`, then `pnpm dev`), including the observer checks and the stale-sheet check across two sessions. Record any deviation in the PR description.
- [ ] T089 Obtain a fresh read-only review of the final diff, as Constitution VII requires, and resolve or explicitly justify every confirmed finding.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup and blocks every story.
- **US1 (Phase 3)**: depends on Foundational. This is the MVP.
- **US2 (Phase 4)**: depends on US1. It hardens the creation command and form that US1 introduces.
- **US3 (Phase 5)**: depends on Foundational only. It can run in parallel with US1 and US2, but its web tasks touch `discharge-detail-page.tsx`, where US4 also edits.
- **US4 (Phase 6)**: depends on Foundational and on T057 (`findLotIdentityClash`) from US2. It can run in parallel with US3, but T084 must come after T071 because both edit the detail page wiring.
- **Polish (Phase 7)**: depends on every story being done.

### Within each story

Tests are written first and must fail. Then, in order: repository methods, use case, controller and
route, registry regeneration, web query and mutation, UI, route wiring.

### Key task dependencies

- T010 depends on T011.
- T014 depends on T009, and T015 on T008.
- T022 depends on T019 and T021.
- T033 depends on T014 and T015.
- T036 depends on T034 and T035.
- T043 depends on T042, the registry.
- T048 depends on T044, T045, and T047, and T049 on T048 and T020.
- T058 depends on T057.
- T067 depends on T066, and T068 on T067.
- T079 depends on T078 and T057, and T080 on T079.
- T082 and T083 depend on T081, and T084 on T082, T083, and T071.

### Parallel opportunities

- **Phase 2**: T002–T007 together; then T008, T009, T011, T012, T013, T014, T015, T017, T018, T019, T020, T021, T023, and T024 together; T010 after T011, T016 on its own, and T022 after T019 and T021.
- **US1 tests**: T025–T032 together.
- **US1 implementation**: T033, T034, and T039 together; T043–T046 together once T042 is done.
- **US2 tests**: T051–T056 together.
- **US3 and US4**: can be staffed at the same time once US2's T057 lands. Within US4, tests T072–T077 run together.

---

## Parallel Example: User Story 1

```bash
# All US1 tests at once (different files):
Task: "T025 API integration create.spec.ts"
Task: "T026 API unit create.spec.ts"
Task: "T027 API integration eligible_shift_responsibles.spec.ts"
Task: "T028 Web access/authorization.test.tsx rewrite"
Task: "T030 Web create/access.test.tsx"
Task: "T031 Web create/success.test.tsx"
Task: "T032 Web create/options.test.tsx"

# Independent API building blocks:
Task: "T033 create_planned_discharge_validator.ts"
Task: "T034 orderShifts in discharge_preparation_rules.ts"
Task: "T039 listEligibleShiftResponsibles in user repositories"
```

## Parallel Example: User Stories 3 and 4 after US2

```bash
Task: "T062 API integration correct_identity.spec.ts"
Task: "T072 API integration add_product_lot.spec.ts"
Task: "T073 API integration correct_product_lot.spec.ts"
Task: "T074 API integration remove_product_lot.spec.ts"
Task: "T065 Web detail/correct-identity.test.tsx"
Task: "T076 Web detail/add-product-lot + correct-product-lot tests"
Task: "T077 Web detail/remove-product-lot.test.tsx"
```

---

## Implementation Strategy

### MVP first (User Story 1)

1. Phase 1 baseline, then Phase 2 foundations.
2. Phase 3, US1: preparers can create discharges end to end, observers cannot, and replays are
   harmless.
3. **Stop and validate** with the US1 independent test and the creation half of `quickstart.md`.

US1 alone relies on the database constraints and the form's required fields. US2 is also P1, so the
PR is not ready without it.

### Incremental delivery

1. US1 → a demoable creation flow.
2. US2 → authoritative refusals and race safety. **This is the minimum mergeable scope**, because
   both stories are P1.
3. US3 → identity corrections.
4. US4 → lot maintenance.
5. Polish → gates, quickstart, fresh review, then the PR is ready for human review.

Each story ends at a checkpoint where the full API and web suites pass, so the branch can be paused
or reviewed after any of them.
