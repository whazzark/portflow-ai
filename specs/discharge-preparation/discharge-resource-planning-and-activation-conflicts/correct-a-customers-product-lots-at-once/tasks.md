---
description: "Task list for Correct a Customer's Product Lots at Once (delivered under GH-55)"
---

# Tasks: Correct a Customer's Product Lots at Once

**Input**: Design documents from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/correct-a-customers-product-lots-at-once/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required. Constitution IV mandates RED → GREEN → REFACTOR for business behavior. Write each
test task first, and confirm it fails for the expected reason before starting the implementation
task that makes it pass.

**Organization**: Tasks are grouped by user story, so each story can be implemented and tested on
its own:
- **US1** corrects a customer's existing lots in one change.
- **US2** keeps the correction behind the same guards as single-lot corrections.
- **US3** adds and removes lots in the same change.
- **US4** moves the group to another customer.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `[US1]`–`[US4]`, mapping to the user stories in `spec.md`

## Path Conventions

This is a PNPM/Turbo monorepo with `apps/api/` (AdonisJS) and `apps/web/` (TanStack Start). All paths
are relative to the repository root. `#discharges/*`, `#models/*`, `#shared/*`, and
`#database/factories/*` are API import aliases; `@/…` is the web source alias.

API conventions (as in GH-53 and GH-55):
- **Use cases**: `@inject()` classes with an explicit `<UseCase>Input` type, owning
  `db.transaction`. They lock with `lockPlannedDischarge` from
  `#discharges/shared/planned_discharge_guard`, and return `DischargeRepository.findDetail(...)` after
  commit, throwing `DischargeNotFoundException` when it is `null`.
- **Repositories**: they take the `TransactionClientContract` last, return typed outcomes
  (`{ kind: … }`), never throw HTTP exceptions, and bump the discharge with the existing private
  `touchDischarge`.
- **Refusals of an entered value**: `throwPreparationIssues` from
  `#discharges/shared/discharge_preparation_issues`.
- **Controllers**: `await bouncer.with(DischargePolicy).authorize('update')`, then
  `request.validateUsing(...)`, then the use case, then
  `serialize(DischargeDetailTransformer.transform(read))`.
- **Tests**: follow `apps/api/tests/README.md`. Integration groups use
  `testUtils.db().wrapInGlobalTransaction()` and `createPreparedDischarge`, `assignDoor`,
  `preparer`, and `PREPARING_ROLES` from
  `apps/api/tests/integration/discharges/preparation/preparation_scenario.ts`. Unit tests swap
  repositories with `app.container.swap(...)` and record `calls[]`, as
  `apps/api/tests/unit/discharges/preparation/product_lots.spec.ts` does.
- **Running a subset**: `cd apps/api && PORT=3399 node --import tsx ace.js test
  --files="preparation/*"`, run in the background with a bounded wait. `--files` matches trailing
  path segments. A spec importing a missing module hangs rather than fails, and macOS has no
  `timeout` command.

Web conventions:
- Feature tests render through the real router with MSW (`renderDischargeTab`,
  `mockDischargeCorrections`), and never mock the Tuyau client.
- Errors are read with `parseApiError` and applied with `applyValidationError`.
- Pending copy comes from `WRITE_PENDING_LABELS` in `@/helpers/resource-copy`.
- `STARTED_REFUSAL_MESSAGE` comes from `ui/detail/edit-discharge-identity-sheet.tsx`, and
  `LOT_REMOVAL_REASONS` from `ui/detail/remove-product-lot-dialog.tsx`.
- Run with `pnpm --dir apps/web exec vitest run src/features/discharges`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Start from a known-green baseline, so every later red test is red because of this
feature.

- [X] T001 Ensure `apps/api/.env` exists (copy `apps/api/.env.example` and generate `APP_KEY` if
  missing). Then run `cd apps/api && PORT=3399 node --import tsx ace.js test` and
  `pnpm --dir apps/web exec vitest run src/features/discharges`, and confirm both pass before any
  change. If either fails, stop and report instead of proceeding.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The request shape, the ownership and listing rules, the repository port, and the web
form model and building blocks that every story uses.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for the shared pieces ⚠️

- [X] T002 [P] Create `apps/api/tests/unit/discharges/preparation/customer_product_lots_validator.spec.ts`
  for `customerProductLotsCorrectionValidator` (T006), calling `.validate(payload)` and reading refusals
  with a `refusal()` helper as `apps/api/tests/unit/discharges/truck_pool/validators.spec.ts` does. Cover:
  - accepts `{ customerId, productLots: [], removedProductLotIds: [] }`;
  - accepts entries with and without `id`;
  - refuses a non-uuid `customerId`, entry `id`, and removed id;
  - refuses 101 entries in either array;
  - refuses a blank `productName`, a 256-character name, an invalid `expectedQuantityTonnes`, and a
    2001-character description;
  - requires `description` to be present, nullable.
- [X] T003 [P] Create `apps/api/tests/unit/discharges/preparation/customer_product_lots_rules.spec.ts`
  with a `planCustomerProductLotsCorrection — ownership and partition` group for T007. Lots fixture:
  Cargill `Blé tendre` and `Orge`, Soufflet `Orge`. Cover:
  - an entry id or removed id that is unknown, belongs to Soufflet, or differs only by case (accepted:
    ids compare lower-cased) gives `LOT_NOT_FOUND` (R1), or passes;
  - an id listed twice in `productLots`, or in both arrays, gives `ISSUES` with
    `productLotListedOnce` at the later position (`productLots.1.id` or `removedProductLotIds.0`),
    and the rules stop there (R2);
  - a valid request partitions into `corrections` (with `productLotId`), `insertions` (entries
    without id), and `removals`;
  - an empty request gives an empty `PLAN`.
- [X] T004 [P] *(Delivered in `apps/web/src/features/discharges/__tests__/customer-product-lots-schema.test.ts`, as are T016 and T034.)* Extend `apps/web/src/features/discharges/__tests__/discharge-preparation-schema.test.ts`
  for T010. Cover:
  - `customerProductLotsFormValues(group)` prefills rows in the group's order, with `lotId`,
    trimmed-as-sent values, `description ?? ''`, the group's `customerId`, and
    `removedProductLotIds: []`;
  - `toCustomerProductLotsBody` sends rows in order, with `id` only when `lotId` is set, trimmed
    values, an empty description as `null`, `customerId`, and `removedProductLotIds`;
  - `customerProductLotsFieldOf` maps `productLots.2.expectedQuantityTonnes` to
    `products[2].expectedQuantityTonnes` and `customerId` to `customerId`, and returns `null` for
    `removedProductLotIds.0` and `productLots.0.id`;
  - `customerProductLotsFieldNames` lists `customerId` and every row's three fields;
  - `customerProductLotsFieldsSchema` refuses a blank product name with the GH-53 message.

### API implementation

- [X] T005 [P] Export `lotIdentityKey` from `apps/api/app/discharges/shared/discharge_preparation_rules.ts`.
  Change nothing else; the existing `rules.spec.ts` stays green.
- [X] T006 [P] Add `customerProductLotsCorrectionValidator` to
  `apps/api/app/discharges/product_lots/product_lot_validator.ts`, as in `data-model.md` and the
  contract:
  - `customerId: vine.string().uuid()`;
  - `productLots`: an array (max 100) of objects with an optional `id: vine.string().uuid()` plus
    `productLotFields()` without `customerId`; destructure it out;
  - `removedProductLotIds`: an array (max 100) of `vine.string().uuid()`.

  Makes T002 pass.
- [X] T007 Create `apps/api/app/discharges/product_lots/customer_product_lots_rules.ts`, pure, in the
  style of `#discharges/shared/truck_pool_rules`. Export:
  - `CustomerProductLotsCorrectionRequest`:
    `{ customerId; targetCustomerId; productLots: Array<{ id?: string; productName: string; expectedQuantityTonnes: Decimal; description: string | null }>; removedProductLotIds: string[] }`,
    with already normalized values;
  - `CustomerProductLotsPlan`:
    `{ kind: 'LOT_NOT_FOUND' } | { kind: 'ISSUES'; issues: PreparationIssue[] } | { kind: 'LAST_LOT' } | { kind: 'PLAN'; removals: string[]; corrections: Array<ProductLotValues & { productLotId: string; identityChanges: boolean }>; insertions: ProductLotValues[] }`;
  - `planCustomerProductLotsCorrection(request, lots, lotIdsWithDoorAssignments: ReadonlySet<string>, targetCustomer: { status } | null)`,
    implementing R1, R2, and the partition. Corrections and insertions carry
    `customerId: request.targetCustomerId`. `identityChanges` compares `lotIdentityKey` of the lot
    before and after.

  Leave R3–R6 for the stories, with a `// R3–R6: added by US1, US3, US4` comment removed once they
  are done. Makes T003 pass.
- [X] T008 Extend `apps/api/app/discharges/shared/repositories/discharge_preparation_repository.ts`
  with:
  - `WriteCustomerProductLotsCorrectionCommand`: `{ dischargeId; removals: string[]; corrections: …; insertions: ProductLotValues[] }`,
    as in `data-model.md`;
  - `CustomerProductLotsWriteResult`: `WRITTEN | DUPLICATE_LOT_IDENTITY | HAS_DOOR_ASSIGNMENTS`;
  - `abstract listLotIdsWithDoorAssignments(productLotIds: string[], client): Promise<Set<string>>`,
    which returns lower-cased ids of lots with any assignment, current or ended;
  - `abstract writeCustomerProductLotsCorrection(command, client): Promise<CustomerProductLotsWriteResult>`,
    documented with the delete → park → update → insert → touch order (research.md Decision 5).

  In `lucid_discharge_preparation_repository.ts`:
  - implement `listLotIdsWithDoorAssignments`: one `whereIn` query, returning an empty set without
    querying for an empty list;
  - stub `writeCustomerProductLotsCorrection` with `throw new Error('Not implemented')`.

  Existing unit stubs that construct `DischargePreparationRepository` objects keep compiling,
  because they cast.

### Web implementation

- [X] T009 [P] Add an optional `blockedReason?: string` to `RemoveRowButton` in
  `apps/web/src/features/discharges/ui/preparation/repeated-rows.tsx`.
  - **Without it**: render exactly as today.
  - **With it**: render the button with `aria-disabled="true"`, a no-op click, and
    `aria-describedby` to an sr-only span holding the reason, inside `Tooltip` /
    `TooltipTrigger render={…}` / `TooltipContent side="left"` from `@/components/ui/tooltip`. Follow
    `ui/detail/product-lot-row-actions.tsx`.

  The create-discharge and add-lots tests stay green.
- [X] T010 [P] Add to `apps/web/src/features/discharges/discharge-preparation-schema.ts`, as listed in
  `data-model.md` Web adapters:
  - `CustomerProductLotsFormValues`, `customerProductLotsFormValues(group)`, and
    `emptyCorrectionLine()`;
  - `customerProductLotsFieldsSchema` (customer required, rows with `productLineSchema` plus
    `lotId: z.string().nullable()`, `removedProductLotIds: z.array(z.string())`);
  - `toCustomerProductLotsBody`, `customerProductLotsFieldOf`, and `customerProductLotsFieldNames`.

  `group` is an item of `groupLotsByCustomer(discharge.productLots)` from
  `discharge-detail-view.ts`. Makes T004 pass.
- [X] T011 Extract the customer block body of `ProductLotGroupsEditor`
  (`apps/web/src/features/discharges/ui/preparation/product-lot-groups-editor.tsx`) into
  `apps/web/src/features/discharges/ui/preparation/product-lot-group-fields.tsx`. It exports
  `ProductLotGroupFields = withFieldGroup({ defaultValues: { customerId: '', products: [emptyProductLine()] }, props: { … }, render })`.
  Props:
  - `customers: PreparationOptions<{ id; name }>` and `customerOptionFilter?: (id) => boolean`, the
    taken-customer filter the groups editor passes;
  - `customerField: 'editable' | 'fixed'`: `fixed` renders the customer's name as text instead of
    the combobox;
  - `customerDescription?: string`;
  - `blockLabel: string`, the legend;
  - `canAddProducts: boolean`;
  - `newProductLine: () => …`;
  - `rowRemoval?: (productIndex, rowCount) => { canRemove: boolean; blockedReason?: string }`:
    omitted, no row remove button; otherwise `RemoveRowButton` with the `blockedReason` of T009;
  - `onRowRemoved?: (productIndex) => void`, called before `removeValue`;
  - `emptyNotice?: string`, shown when there is no row.

  `blockRemoval` stays in `ProductLotGroupsEditor`, rendered beside the block through a `headerAction`
  slot prop. `ProductLotGroupsEditor` then maps each block onto `ProductLotGroupFields` with
  `customerField="editable"`, `canAddProducts`, `rowRemoval={(_, n) => ({ canRemove: n > 1 })}`,
  and its current filter. Depends on T009. All tests under `__tests__/create/` and
  `__tests__/detail/add-product-lots.test.tsx` stay green, unchanged.
- [X] T012 [P] Extend `mockDischargeCorrections` in
  `apps/web/src/features/discharges/__tests__/support/test-helpers.ts` with
  `http.patch(\`${API_BASE_URL}/api/v1/discharges/:dischargeId/customers/:customerId/product-lots\`)`:
  - record `state.customerLotRequests.push({ customerId, body })`;
  - honor an optional `respondToCustomerLots?: (change) => DischargeWriteAnswer` through the
    existing `answer` helper;
  - otherwise apply the body to `state.current`:
    - delete removed ids;
    - update each entry with an id (values, and `customer` from `AVAILABLE_CUSTOMERS` or the
      current lot when unchanged), keeping `doorAssignments`;
    - insert entries without id as `lot-added-<n>` with `lotFromBody`;
    - recompute `expectedTonnage` with `totalOf`;
    - answer `{ data: state.current }`.

---

## Phase 3: User Story 1 - Correct Every Lot of a Customer in One Change (Priority: P1) 🎯 MVP

**Goal**: A preparer opens `Edit` on a customer's group, corrects names, quantities, and descriptions
of its lots, and saves them atomically. Swaps are accepted.

**Independent Test**: On a planned discharge where one customer has three lots, correct two
quantities and one name, save, and check the detail, subtotal, expected tonnage, and kept door
assignments. Then save with one invalid quantity and check that nothing changed.

### Tests for User Story 1 ⚠️

- [X] T013 [P] [US1] Add a `R5 — identity after the change` group to
  `apps/api/tests/unit/discharges/preparation/customer_product_lots_rules.spec.ts`. Cover:
  - swapping `Blé tendre` and `Orge` between Cargill's two lots gives `PLAN` with both
    `identityChanges: true`;
  - a case-only rename (`BLÉ TENDRE`) gives `PLAN` with `identityChanges: false`;
  - an unchanged entry is planned, with `identityChanges: false`;
  - two entries renamed to `Colza` and ` colza ` give `ISSUES` `productLotIdentityUnique` at both
    `productLots.0.productName` and `productLots.1.productName`;
  - an entry renamed to the name of a Cargill lot that is not listed gives an issue at that entry
    only;
  - renaming to Soufflet's `Orge` name gives no issue: other customer, no move.
- [X] T014 [P] [US1] Add a `CorrectCustomerProductLotsUseCase` group to
  `apps/api/tests/unit/discharges/preparation/product_lots.spec.ts`. Extend `stubRepositories` with
  `listLotIdsWithDoorAssignments` and `writeCustomerProductLotsCorrection` (recording the command,
  returning an overridable `customerWriteOutcome`). Cover:
  - `calls` equals `['lockDischarge', 'listProductLots', 'writeCustomerProductLotsCorrection']` for
    a same-customer correction without removals;
  - the command carries lower-cased ids, trimmed names, `Decimal` quantities, `null` for a blank
    description, and `identityChanges`;
  - a missing discharge gives `DischargeNotFoundException`, and a non-planned one
    `DischargeNotPlannedException`, with no write;
  - `LOT_NOT_FOUND` gives `ProductLotNotFoundException`;
  - `ISSUES` gives `errors.E_VALIDATION_ERROR` with the issues;
  - `DUPLICATE_LOT_IDENTITY` gives `E_VALIDATION_ERROR` at `productLots.0.productName`;
  - success returns `findDetail`'s result.
- [X] T015 [P] [US1] Create `apps/api/tests/integration/discharges/preparation/correct_customer_product_lots.spec.ts`
  (group `Customer product lots correction HTTP contract`) for
  `PATCH /api/v1/discharges/:dischargeId/customers/:customerId/product-lots`. In each test, add a
  second Cargill lot to `createPreparedDischarge()` with
  `ProductLotFactory.merge({ dischargeId, customerId: cargill.id, productName: 'Orge', expectedQuantityTonnes: new Decimal('300.000') })`.
  Cover:
  - **Each role**: for each of `PREPARING_ROLES`, correcting both Cargill lots' quantities and one
    description gives 200. The response's Cargill lots have the new values and the same ids,
    `expectedTonnage` matches, and a door assigned with `assignDoor` to `wheat` is still in its
    `doorAssignments`.
  - **Swap**: swapping the two Cargill names gives 200, with the ids unchanged and the names
    swapped in the database.
  - **Clash**: renaming Cargill `Orge` to `blé tendre ` while listing only that lot gives 422
    `productLotIdentityUnique` at `productLots.0.productName`, and both lots are unchanged.
  - **Vine refusals**: a blank name and quantity `0` give 422 at their `productLots.N.*` fields, and
    nothing changes.
  - **Unlisted lot**: listing only `wheat` leaves Cargill `Orge` untouched (`updatedAt` unchanged).
- [X] T016 [P] [US1] Extend `apps/web/src/features/discharges/__tests__/discharge-preparation-schema.test.ts`
  with `customerProductLotsCrossRulesSchema(otherLots)` for T022. Cover:
  - swapped row names pass;
  - two rows sharing a name, ignoring case and spaces, give `This customer already has a lot with
    this product name` at the later `products.P.productName`;
  - a row matching an `otherLots` entry of the chosen customer gives the same message;
  - a row matching another customer's lot gives nothing.
- [X] T017 [P] [US1] Create `apps/web/src/features/discharges/__tests__/detail/correct-customer-product-lots.test.tsx`.
  - **Setup**: `allowFormJourneyTime()`, `mockDischargeCorrections`, a planned discharge whose
    Cargill France has `Blé tendre`, `Orge`, and `Colza`, and Soufflet Négoce has `Orge`.
  - **Opening**: the `Cargill France` rowgroup has a button named `Edit Cargill France`. Clicking it
    opens the dialog `Edit product lots`, showing the customer's name and three prefilled rows.
  - **Saving a correction**: change the `Orge` quantity and the `Colza` name, then save. Check that
    `state.customerLotRequests` holds one request with `customerId` Cargill, three rows with ids in
    order, and `removedProductLotIds: []`. The toast `Product lots updated` appears, the dialog
    closes, and the table shows the new values.
  - **Swap**: swapping two names shows no field error, and the request is sent.
  - **Client clash**: naming two rows alike shows the clash message, and no request is sent.
  - **422**: a `respondToCustomerLots` 422 at `productLots.1.expectedQuantityTonnes` shows the
    message on row 2, and the dialog stays open with the values kept.
  - **Stale refusals**: 409 `E_DISCHARGE_NOT_PLANNED` gives toast `STARTED_REFUSAL_MESSAGE` and
    closes the dialog; 404 `E_PRODUCT_LOT_NOT_FOUND` gives toast `This customer's product lots
    changed` and closes it.
  - **Network error**: toast `Unable to update the product lots`, and the dialog stays open.
  - **Cancel**: sends no request.
  - **US1 layout**: the dialog shows no `Add product` and no row remove buttons.

### API implementation for User Story 1

- [X] T018 [US1] Implement R5 in `planCustomerProductLotsCorrection`
  (`apps/api/app/discharges/product_lots/customer_product_lots_rules.ts`). Build the state after the
  change: lots neither listed nor removed, plus corrections and insertions under
  `targetCustomerId`. Then add `duplicateLotIssue(\`productLots.${index}.productName\`)` for every
  listed entry whose `lotIdentityKey` is held by more than one lot of that state. Makes T013 pass.
- [X] T019 [US1] Implement `writeCustomerProductLotsCorrection` in
  `apps/api/app/discharges/shared/repositories/lucid_discharge_preparation_repository.ts`, for
  corrections only (removals and insertions come in US3). In one savepoint, following
  `writeProductLot`:
  1. For each correction with `identityChanges`, update `product_name` to its
     `productLotId.toLowerCase()`.
  2. For each correction, update `customerId`, `productName`, `expectedQuantityTonnes`,
     `description`, and `updatedAt`, scoped by `id` and `dischargeId`.
  3. Run `touchDischarge`.
  4. Map a duplicate to `DUPLICATE_LOT_IDENTITY` with `isDuplicateLotIdentity`, and rethrow other
     errors.
- [X] T020 [US1] Create `apps/api/app/discharges/product_lots/correct_customer_product_lots_use_case.ts`,
  exporting `CorrectCustomerProductLotsInput` (as in `data-model.md`) and
  `CorrectCustomerProductLotsUseCase`.
  1. Normalize entries with `normalizeProductLot` (passing `customerId: input.targetCustomerId`).
  2. In `db.transaction`:
     - `lockPlannedDischarge`, then `listProductLots`;
     - `planCustomerProductLotsCorrection(request, lots, new Set(), null)` (the door read and the
       customer lock come in US3 and US4);
     - map `LOT_NOT_FOUND` to `ProductLotNotFoundException`, `ISSUES` to `throwPreparationIssues`,
       and `LAST_LOT` to `LastProductLotException`;
     - on `PLAN`, `writeCustomerProductLotsCorrection`, mapping `DUPLICATE_LOT_IDENTITY` to
       `duplicateLotIssue('productLots.0.productName')` and `HAS_DOOR_ASSIGNMENTS` to
       `ProductLotHasDoorAssignmentsException`.
  3. Return `findDetail`.

  Makes T014 pass.
- [X] T021 [US1] Create `apps/api/app/controllers/discharge_customer_product_lots_controller.ts`
  (`update`), modelled on `discharge_shift_trucks_controller.ts`: authorize, validate with
  `customerProductLotsCorrectionValidator`, then call the use case with
  `{ dischargeId: params.dischargeId, customerId: params.customerId, targetCustomerId: payload.customerId, productLots, removedProductLotIds }`.
  In `apps/api/start/routes.ts`, inside the `discharges` group after `shift_trucks.update`, add
  `router.patch('/:dischargeId/customers/:customerId/product-lots', [controllers.DischargeCustomerProductLots, 'update']).as('customer_product_lots.update')`.
  Makes T015 pass.
- [X] T022 [US1] Regenerate the registry: boot the API briefly
  (`cd apps/api && PORT=3399 node ace serve`, stop after it prints the server URL). Check that
  `discharges.customer_product_lots.update` is present in
  `apps/api/.adonisjs/client/registry/index.ts`, and that
  `apps/api/.adonisjs/server/controllers.ts` lists the controller. Commit the regenerated files.

### Web implementation for User Story 1

- [X] T023 [P] [US1] Add `customerProductLotsCrossRulesSchema(otherLots: Array<{ customerId: string; productName: string }>)`
  to `apps/web/src/features/discharges/discharge-preparation-schema.ts`: a `z.custom().superRefine`
  applying the identity key `[customerId, productName.trim().toLowerCase()]` across the rows under
  the form's `customerId` and `otherLots`, with issues at `['products', p, 'productName']` for later
  duplicates. Makes T016 pass.
- [X] T024 [US1] Add `correctCustomerLots` to `useDischargeMutations` in
  `apps/web/src/features/discharges/mutations/use-discharge-mutations.ts`:
  `useMutation(tuyauQuery.discharges.customerProductLots.update.mutationOptions({ onSuccess: applyDetail, onError: (error, variables) => refreshAfterStaleRefusal(error, String(variables.params.dischargeId)) }))`.
  Depends on T022.
- [X] T025 [US1] Create `apps/web/src/features/discharges/ui/detail/customer-product-lots-sheet.tsx`,
  exporting `CustomerProductLotsSheet({ discharge, customerId: string | null, onOpenChange })`, as
  in `contracts/ui-state.md`.
  - **Shell**: `Sheet` with `SheetContent size="lg" className="overflow-y-auto"`, title
    `Edit product lots`, description naming the customer. The form is mounted only while
    `customerId` is set and its group exists in `groupLotsByCustomer(discharge.productLots)`.
  - **Form**: `useAppForm` with `customerProductLotsFormValues(group)` and
    `revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' })`. Validators: `onChange` is
    `customerProductLotsFieldsSchema`; `onDynamic` is
    `customerProductLotsCrossRulesSchema(otherLots)`, where `otherLots` is the discharge's lots
    outside the group.
  - **Block**: `ProductLotGroupFields` with `customerField="fixed"`, `canAddProducts={false}`, no
    `rowRemoval`, `blockLabel` the customer's name, and `newProductLine={emptyCorrectionLine}`.
  - **Footer**: the summary as in `add-product-lots-sheet.tsx`, `Cancel`, and
    `form.SubmitButton pendingLabel={WRITE_PENDING_LABELS.update}` labelled `Save`.
  - **Submit**: `correctCustomerLots.mutateAsync({ params: { dischargeId, customerId }, body: toCustomerProductLotsBody(value) })`,
    then toast `Product lots updated` and close.
  - **Refusals**:
    - `applyValidationError(formApi, error, customerProductLotsFieldNames(value), customerProductLotsFieldOf)`;
    - `E_DISCHARGE_NOT_PLANNED` or `E_DISCHARGE_NOT_FOUND`: toast `STARTED_REFUSAL_MESSAGE` and
      close;
    - `E_PRODUCT_LOT_NOT_FOUND`: toast `This customer's product lots changed` and close;
    - otherwise, toast `Unable to update the product lots` with `description: apiError.message`.

  Depends on T010, T011, T023, and T024.
- [X] T026 [US1] Update `apps/web/src/features/discharges/ui/detail/discharge-product-lots-card.tsx`:
  - add `const [correctingCustomerId, setCorrectingCustomerId] = useState<string | null>(null)`;
  - when `canCorrect`, render in the header row's last cell (the `colSpan` cell) a right-aligned
    `Button size="sm" variant="ghost"` labelled `Edit`, with
    `aria-label={\`Edit ${group.customer.name}\`}`;
  - mount `<CustomerProductLotsSheet discharge={discharge} customerId={correctingCustomerId} onOpenChange={(open) => !open && setCorrectingCustomerId(null)} />`
    under `canCorrect`.

  Makes T017 pass; `product-lots.test.tsx`, `correct-product-lot.test.tsx`, and
  `remove-product-lot.test.tsx` stay green.

**Checkpoint**: The API suite and `vitest run src/features/discharges` pass. US1's independent test
passes in the browser.

---

## Phase 4: User Story 2 - Keep Corrections Out of Reach of Those Who May Not Make Them (Priority: P1)

**Goal**: The per-customer correction is offered and accepted only where a single-lot correction
is, and never touches another customer's or discharge's lots.

**Independent Test**: As an observer on a planned discharge, and as an operations lead on an active
and a closed discharge, check that no `Edit` is offered and that a request is refused without
changing any lot.

### Tests for User Story 2 ⚠️

- [X] T027 [P] [US2] Add to `apps/api/tests/integration/discharges/preparation/correct_customer_product_lots.spec.ts`.
  Each case asserts that every lot is unchanged. Cover:
  - **401 and 403**: 401 unauthenticated; 401 for a pending operations lead; 403 for an active
    observer, even with an invalid body (not validated).
  - **Not planned**: 409 `E_DISCHARGE_NOT_PLANNED` on `createPreparedDischarge('ACTIVE')` and
    `('CLOSED')`.
  - **Unknown discharge**: 404 `E_DISCHARGE_NOT_FOUND` for an unknown uuid and for `not-a-uuid`.
  - **Foreign lots**: 404 `E_PRODUCT_LOT_NOT_FOUND` for Soufflet's `barley` id listed under
    Cargill's path, for a lot of another prepared discharge, and for a random uuid in
    `removedProductLotIds`.
  - **Listed twice**: 422 `productLotListedOnce` when `wheat` is listed twice.
- [X] T028 [P] [US2] *(Delivered in `correct-customer-product-lots.test.tsx`.)* Extend `apps/web/src/features/discharges/__tests__/detail/product-lots.test.tsx`
  with a test using `mockDischargeCorrections` and `renderDischargeTab`. Cover:
  - `Edit Cargill France` present for an active operations lead on a planned discharge;
  - absent for `ACTIVE_OBSERVER`, on an `ACTIVE` discharge, and on a `CLOSED` discharge;
  - each lot row's `Actions for …` menu still offering `Edit` for the lead (FR-017).

### Implementation for User Story 2

- [X] T029 [US2] Make T027 and T028 pass. No production change is expected beyond Phase 2 and US1
  (the policy, the guard, R1, and R2 already refuse these cases). If one fails, fix it in the file
  owning the rule (`customer_product_lots_rules.ts`, the use case, the controller, or
  `discharge-product-lots-card.tsx`), and note why in the PR description.

**Checkpoint**: Both P1 stories pass. This is the minimum mergeable scope of the feature.

---

## Phase 5: User Story 3 - Add and Remove a Customer's Lots in the Same Change (Priority: P2)

**Goal**: The same sheet adds lots and removes lots, with removal blocks shown before saving and
enforced by the API.

**Independent Test**: On a customer with a door-assigned lot and an unassigned lot, add a lot, remove
the unassigned one, correct the other, save, and check the detail. Then check that removing the
door-assigned lot, and removing every lot of the discharge's only customer, are refused without
changes.

### Tests for User Story 3 ⚠️

- [X] T030 [P] [US3] Add an `R4 and R6 — removals and additions` group to
  `apps/api/tests/unit/discharges/preparation/customer_product_lots_rules.spec.ts`. Cover:
  - a removed id in `lotIdsWithDoorAssignments` gives `ISSUES` `removableProductLot` at
    `removedProductLotIds.N`, with the message `This product lot has warehouse door assignments`;
  - removing Cargill's `Orge` and adding `orge` gives `PLAN`;
  - adding `Blé tendre` while that lot stays gives an issue at the added entry;
  - removing every lot when no other customer has one gives `LAST_LOT`;
  - removing every Cargill lot while Soufflet's remains gives `PLAN`;
  - a door-assigned removal plus an empty result gives `ISSUES`, not `LAST_LOT`.
- [X] T031 [P] [US3] Extend the `CorrectCustomerProductLotsUseCase` group in
  `apps/api/tests/unit/discharges/preparation/product_lots.spec.ts`. Cover:
  - with removals, `calls` includes `listLotIdsWithDoorAssignments` after `listProductLots` and
    before the write, called with the removed ids;
  - it is not called without removals;
  - `LAST_LOT` gives `LastProductLotException`;
  - `HAS_DOOR_ASSIGNMENTS` from the write gives `ProductLotHasDoorAssignmentsException`;
  - the command carries `removals` and `insertions`.
- [X] T032 [P] [US3] Add to `apps/api/tests/integration/discharges/preparation/correct_customer_product_lots.spec.ts`.
  Cover:
  - **Mixed change**: correcting `wheat`, removing the second Cargill lot, and adding `Colza`
    `250` gives 200, with the right Cargill lots and `expectedTonnage`, and the added lot
    persisted with a new id.
  - **Door-assigned removal**: removing a lot with an ended `assignDoor` gives 422
    `removableProductLot` at `removedProductLotIds.0`, and nothing changes.
  - **Last lot**: on a discharge with a single lot and no door (delete `barley` before the
    request), removing it gives 409 `E_DISCHARGE_LAST_PRODUCT_LOT`, and nothing changes.
  - **Remove all of one customer**: removing both Cargill lots while Soufflet's remains gives 200,
    and no Cargill lot is left.
  - **Name reuse**: removing Cargill `Orge` and adding `ORGE` gives 200.
- [X] T033 [P] [US3] *(Delivered in `apps/web/src/features/discharges/__tests__/customer-lots-correction.test.ts`.)* Extend `apps/web/src/features/discharges/__tests__/discharge-detail-view.test.ts`
  with `correctionRowRemoval(lot, otherLotCount, rowCount)`. Cover:
  - a lot with door assignments gives `E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS`, even as the only row;
  - `null` (a new row) with `otherLotCount = 0` and `rowCount = 1` gives
    `E_DISCHARGE_LAST_PRODUCT_LOT`;
  - an undoored lot with `rowCount = 2` gives `null`;
  - `otherLotCount = 3` and `rowCount = 1` gives `null`.
- [X] T034 [P] [US3] Extend `apps/web/src/features/discharges/__tests__/discharge-preparation-schema.test.ts`:
  - `customerProductLotsCrossRulesSchema([])` with no rows gives `Add at least one product.`;
  - with a non-empty `otherLots` and no rows, it passes.
- [X] T035 [P] [US3] Extend `apps/web/src/features/discharges/__tests__/detail/correct-customer-product-lots.test.tsx`,
  replacing the US1 layout assertion. Cover:
  - **Add and remove**: `Add product` adds an empty row. Fill it, remove the undoored `Colza` row,
    and save: the request has the new row without id and `removedProductLotIds: ['<colza id>']`.
  - **Door-assigned row**: `Remove product 1` has `aria-disabled="true"`, the accessible description
    `This product lot has warehouse door assignments`, and a tooltip on focus (`fireEvent.focus`,
    selector `[data-slot="tooltip-content"]`).
  - **Only customer**: with a single customer, its last remaining row's remove is blocked with
    `A discharge needs at least one product lot`.
  - **Remove every row**: with Soufflet present, removing every Cargill row shows `Saving removes
    every product lot of this customer.`, and saving sends all ids as removed.
  - **422 on a removal**: at `removedProductLotIds.0`, the API message shows at form level, the
    dialog stays open, and the detail is requested again (`state.detailRequests` grows).
  - **409 last lot**: `E_DISCHARGE_LAST_PRODUCT_LOT` shows the form error `A discharge needs at
    least one product lot`, and the dialog stays open.

### API implementation for User Story 3

- [X] T036 [US3] Implement R4 and R6 in `apps/api/app/discharges/product_lots/customer_product_lots_rules.ts`:
  - `removableProductLot` issues come from `lotIdsWithDoorAssignments`, collected with R5's issues
    (R3 will join them in US4);
  - after issues, `LAST_LOT` applies when `lots.length - removals.length + insertions.length === 0`.

  Makes T030 pass.
- [X] T037 [US3] Extend `writeCustomerProductLotsCorrection` in
  `apps/api/app/discharges/shared/repositories/lucid_discharge_preparation_repository.ts`:
  - delete `removals` first, scoped by `dischargeId`;
  - `ProductLot.createMany` the `insertions` after the corrections, as `insertProductLots` does;
  - map `isForeignKeyViolation` to `HAS_DOOR_ASSIGNMENTS`.
- [X] T038 [US3] In `apps/api/app/discharges/product_lots/correct_customer_product_lots_use_case.ts`,
  call `listLotIdsWithDoorAssignments(removedIds, client)` when removals exist, and pass the set to
  the rules. Makes T031 and T032 pass.

### Web implementation for User Story 3

- [X] T039 [P] [US3] *(Delivered in `apps/web/src/features/discharges/customer-lots-correction.ts`.)* Add `correctionRowRemoval` to `apps/web/src/features/discharges/discharge-detail-view.ts`,
  as in `data-model.md`. Makes T033 pass.
- [X] T040 [P] [US3] Add the "at least one row when `otherLots` is empty" rule to
  `customerProductLotsCrossRulesSchema`, with the issue at `['products']` and the message
  `Add at least one product.`. Makes T034 pass.
- [X] T041 [US3] Update `apps/web/src/features/discharges/mutations/use-discharge-mutations.ts`:
  - add `E_DISCHARGE_LAST_PRODUCT_LOT` to `STALE_DETAIL_CODES`;
  - in `correctCustomerLots.onError`, also invalidate the detail on `E_VALIDATION_ERROR`, as
    `selectShiftTrucks` does.
- [X] T042 [US3] Update `apps/web/src/features/discharges/ui/detail/customer-product-lots-sheet.tsx`:
  - `canAddProducts`;
  - `rowRemoval={(index, rowCount) => …}`: `correctionRowRemoval` of the row's lot, found in the
    fresh `discharge.productLots` by `lotId`, mapped through `LOT_REMOVAL_REASONS`;
  - `onRowRemoved` pushing the row's `lotId`, when set, into `removedProductLotIds`;
  - `emptyNotice` `Saving removes every product lot of this customer.` when `otherLots` is not
    empty;
  - `E_DISCHARGE_LAST_PRODUCT_LOT` shown as the form error
    (`formApi.setErrorMap({ onSubmit: { form: LOT_REMOVAL_REASONS.E_DISCHARGE_LAST_PRODUCT_LOT, fields: {} } })`),
    keeping the sheet open.

  Makes T035 pass.

**Checkpoint**: US1–US3 pass, and `add-product-lots.test.tsx` and the create tests remain green.

---

## Phase 6: User Story 4 - Move a Customer's Lots to Another Customer (Priority: P3)

**Goal**: The sheet's customer can change. Every lot the change keeps or adds moves to the chosen
available customer, joining that customer's lots, while clashes are refused.

**Independent Test**: Move a customer's lots to another available customer, and check that every lot
appears under the new customer with its door assignments. Then choose a customer that already has a
lot with a shared product name, and check the refusal.

### Tests for User Story 4 ⚠️

- [X] T043 [P] [US4] Add an `R3 and moves` group to
  `apps/api/tests/unit/discharges/preparation/customer_product_lots_rules.spec.ts`. Cover:
  - `targetCustomerId` Soufflet with `targetCustomer` `null` or `{ status: 'ARCHIVED' }` gives an
    `availableCustomer` issue at `customerId`;
  - with `{ status: 'AVAILABLE' }` and no clash, `PLAN`, with every correction `identityChanges:
    true` and `customerId` Soufflet;
  - moving Cargill `Orge` onto Soufflet, which has `Orge`, gives an issue at that entry;
  - an unlisted Cargill lot stays Cargill in the state after the change: no clash is raised against
    Soufflet for it;
  - `targetCustomerId` equal to the path customer ignores `targetCustomer`.
- [X] T044 [P] [US4] Extend the `CorrectCustomerProductLotsUseCase` group in
  `apps/api/tests/unit/discharges/preparation/product_lots.spec.ts`. Cover:
  - a move calls `lockCustomers([targetCustomerId])` after `listProductLots` and before
    `listLotIdsWithDoorAssignments` and the write;
  - it is not called when the target equals the path customer, in any case;
  - an unavailable target gives `E_VALIDATION_ERROR` at `customerId`.
- [X] T045 [P] [US4] Add to `apps/api/tests/integration/discharges/preparation/correct_customer_product_lots.spec.ts`.
  Cover:
  - **Move**: moving both Cargill lots (with a door assigned to `wheat`) to Soufflet, after renaming
    Soufflet's `barley` out of the way in the same test setup, gives 200. Both ids now have
    customer Soufflet, and `wheat` keeps its door assignment.
  - **Clash**: moving Cargill `Orge` onto Soufflet, which has `Orge`, gives 422
    `productLotIdentityUnique`, and nothing changes.
  - **Unavailable target**: moving to an archived customer
    (`CustomerFactory.apply('archived').create()`) gives 422
    `availableCustomer` at `customerId`.
  - **Unlisted lot**: moving while listing only `wheat` leaves the second Cargill lot with Cargill.
- [X] T046 [P] [US4] Extend `apps/web/src/features/discharges/__tests__/detail/correct-customer-product-lots.test.tsx`.
  Cover:
  - **Combobox**: the `Customer` combobox shows `Cargill France`.
  - **Joins**: choosing `Soufflet Négoce` (with `chooseOption`) shows
    `Joins the 1 product lots of Soufflet Négoce.`. Adjust the pluralization to the component's
    copy, and keep `contracts/ui-state.md` in sync.
  - **Clash**: the `Orge` row shows the clash message, and nothing is sent.
  - **Move**: renaming it and saving sends `customerId` Soufflet.
  - **422**: `availableCustomer` at `customerId` shows the message on `Customer`.

### API implementation for User Story 4

- [X] T047 [US4] Implement R3 in `apps/api/app/discharges/product_lots/customer_product_lots_rules.ts`:
  when `targetCustomerId.toLowerCase() !== customerId.toLowerCase()` and `targetCustomer?.status`
  is not `AVAILABLE`, collect `unavailableCustomerIssue('customerId')` with R4 and R5. Makes T043
  pass.
- [X] T048 [US4] In `apps/api/app/discharges/product_lots/correct_customer_product_lots_use_case.ts`,
  when the group moves, call `lockCustomers([targetCustomerId], client)` after `listProductLots`,
  and pass `customers.get(targetCustomerId.toLowerCase()) ?? null` to the rules. Makes T044 and
  T045 pass.

### Web implementation for User Story 4

- [X] T049 [US4] Update `apps/web/src/features/discharges/ui/detail/customer-product-lots-sheet.tsx`:
  - `customerField="editable"`, with
    `customers={useCustomerOptions({ id: group.customer.id, name: group.customer.name })}`;
  - `customerDescription` from a `form.Subscribe` on `customerId`: when it differs from the group's
    customer and `otherLots` has lots of that customer,
    `Joins the ${n} product ${n === 1 ? 'lot' : 'lots'} of ${name}.`.

  Update T046's expected copy and `contracts/ui-state.md` to the singular or plural actually
  rendered. Makes T046 pass.

**Checkpoint**: All four stories pass their independent tests.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T050 [P] Remove the `R3–R6` placeholder comment from
  `apps/api/app/discharges/product_lots/customer_product_lots_rules.ts`, and check the module's doc
  comment describes the precedence of research.md Decision 3.
- [X] T051 [P] Update `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/correct-a-customers-product-lots-at-once/checklists/requirements.md`
  notes with the delivered scope, and mark the spec `**Status**: Implemented` in `spec.md`.
- [X] T052 *(2026-09-15: `pnpm check` clean, API and web typecheck clean, API 1692/1692, web 1701/1703. The 2 failures are in `shifts.test.tsx`, under concurrent shift work outside this feature, and were left to it by decision.)* Run `pnpm check`, `pnpm typecheck`, and `pnpm test` at the repository root, and fix every
  failure. The API suite must also pass on PostgreSQL in CI; the swap and move tests of T015 and
  T045 are the ones exercising the parking step there.
- [ ] T053 Run the API contract steps and the screen validation of
  `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/correct-a-customers-product-lots-at-once/quickstart.md`
  against `pnpm dev`, and record any deviation in the PR description.
- [ ] T054 Obtain the fresh read-only review of the final diff required by constitution VII. Resolve
  or justify each confirmed finding in the PR description, which states that this feature ships
  under GH-55.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup, and blocks every story.
- **US1 (Phase 3)**: depends on Foundational. This is the MVP, and it creates the route, use case,
  sheet, and card entry every later story extends.
- **US2 (Phase 4)**: depends on US1, because its tests exercise US1's route and `Edit` button.
- **US3 (Phase 5)**: depends on US1. It is independent of US2 and US4.
- **US4 (Phase 6)**: depends on US1. It is independent of US2. Its sheet task T049 edits the same
  file as T042, so run them sequentially.
- **Polish (Phase 7)**: depends on every story being done.

### Within each story

Tests are written first and must fail. Then: rules, repository write, use case, controller and
route, registry, web adapters, mutation, sheet, card.

### Key task dependencies

- **Foundational**:
  - T007 depends on T005.
  - T011 depends on T009.
  - T010 and T012 are independent.
- **US1**:
  - T018 depends on T007.
  - T019 depends on T008.
  - T020 depends on T018 and T019.
  - T021 depends on T006 and T020.
  - T022 depends on T021.
  - T024 depends on T022.
  - T025 depends on T010, T011, T023, and T024.
  - T026 depends on T025.
- **US3**:
  - T036 depends on T018.
  - T037 depends on T019.
  - T038 depends on T036, T037, and T008.
  - T042 depends on T039, T040, T041, and T026.
- **US4**:
  - T047 depends on T036.
  - T048 depends on T047 and T038 (same use case file).
  - T049 depends on T042.

### Parallel opportunities

- **Phase 2**: T002–T004 together. Then T005, T006, T009, T010, and T012 together. T007 after T005,
  T011 after T009, and T008 on its own.
- **US1 tests**: T013–T017 together.
- **US2 tests**: T027 and T028 together, alongside US3 test writing.
- **US3 tests**: T030–T035 together. T039 and T040 together.
- **US4 tests**: T043–T046 together.
- **Polish**: T050 and T051 together.

Tasks on the same file are never marked `[P]` against each other:
- `customer_product_lots_rules.spec.ts` groups (T013, T030, T043) run in order when written by one
  agent.
- The same holds for `product_lots.spec.ts` (T014, T031, T044),
  `correct_customer_product_lots.spec.ts` (T015, T027, T032, T045), and the web feature test
  (T017, T035, T046).

---

## Parallel Example: User Story 1

```bash
# All US1 tests at once (different files):
Task: "T013 API unit customer_product_lots_rules.spec.ts R5 group"
Task: "T014 API unit product_lots.spec.ts CorrectCustomerProductLotsUseCase group"
Task: "T015 API integration correct_customer_product_lots.spec.ts"
Task: "T016 Web discharge-preparation-schema.test.ts cross rules"
Task: "T017 Web detail/correct-customer-product-lots.test.tsx"

# API and web building blocks that do not touch the same files:
Task: "T018 rules R5"
Task: "T019 Lucid write (park, update, touch)"
Task: "T023 web cross rules schema"
```

## Parallel Example: User Stories 3 and 4 after US1

```bash
Task: "T032 API integration: removals and additions"      # same file as T045: run one after the other
Task: "T033 Web discharge-detail-view.test.ts correctionRowRemoval"
Task: "T034 Web schema at-least-one-row rule"
Task: "T043 API unit rules R3 group"                       # same file as T030: run one after the other
```

---

## Implementation Strategy

### MVP first (User Story 1)

1. Phase 1 baseline, then Phase 2 foundations: the validator, R1 and R2, the repository port, and
   the web form model, block extraction, and MSW handler.
2. Phase 3, US1: correcting a customer's existing lots atomically, swaps included.
3. **Stop and validate** with US1's independent test and quickstart steps 1 and 4.

### Incremental delivery

1. US1 → a demoable grouped correction.
2. US2 → the guards pinned. **This is the minimum mergeable scope**, because both stories are P1.
3. US3 → adding and removing in the same change, with removal blocks.
4. US4 → moving the group to another customer.
5. Polish → gates, quickstart, fresh review. The PR (shared with GH-55) is then ready for human
   review.

Each story ends at a checkpoint where the API and web discharge suites pass, so the work can pause
or be reviewed after any of them.
