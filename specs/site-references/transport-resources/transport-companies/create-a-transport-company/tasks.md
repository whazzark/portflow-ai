---
description: "Task list for Create a Transport Company (GH-218)"
---

# Tasks: Create a Transport Company

**Input**: Design documents from `specs/site-references/transport-resources/transport-companies/create-a-transport-company/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [quickstart.md](./quickstart.md)

**Tests**: Test tasks are **included and mandatory**. Constitution principle IV requires business behavior to follow RED → GREEN → REFACTOR, and plan.md commits to Japa API specs and router-level Vitest/MSW web specs as the primary seams.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task serves (US1, US2, US3)
- Every task names the exact file it touches

## Path Conventions

PNPM/Turbo monorepo with two workspaces: `apps/api/` (AdonisJS) and `apps/web/` (TanStack Start). Paths below are repository-relative and match the structure in plan.md.

**This slice ships no migration.** It depends on `transport_companies_name_unique`, the `LOWER(name)` index delivered by #219, which already constrains inserts. T003 verifies it before any story begins.

---

## Phase 1: Setup

**Purpose**: Establish a known-good baseline and confirm the inherited constraint is actually in place

- [X] T001 Confirm work is on branch `feat/218-create-transport-company` and the working tree is clean
- [X] T002 Capture a green baseline by running `pnpm check`, `pnpm typecheck`, and `pnpm test`, so any later failure is attributable to this slice
- [X] T003 Run `pnpm --filter @portflow/api db:fresh` and confirm the `transport_companies_name_unique` index exists on `transport_companies (LOWER(name))`; without it FR-007 and FR-019 have no enforcement mechanism and no duplicate task below can pass

**Checkpoint**: Baseline green, inherited unique index verified

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contract and plumbing that carry no story behavior on their own but that every story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Extend `apps/api/app/transport_companies/shared/repositories/transport_company_repository.ts` with the `CreateTransportCompanyCommand` type (`{ name: string }`), a `{ kind: 'CREATED'; company: TransportCompany }` variant on the existing `TransportCompanyWriteResult` union, and the abstract `create(command)` method, per [data-model.md](./data-model.md)
- [X] T005 [P] Add `createTransportCompanyValidator` to the existing `apps/api/app/transport_companies/shared/transport_company_validator.ts` with a required `name` using `vine.string().use(nonBlank()).minLength(1).maxLength(255)`, mirroring the `createCustomerValidator` shape in `apps/api/app/customers/shared/customer_validator.ts`
- [X] T006 [P] Add the `create(user)` ability to `apps/api/app/transport_companies/shared/transport_company_policy.ts` granting `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, leaving `list` and `listAvailable` open to every active user
- [X] T007 [P] Widen `companyDetailsMode` from `z.enum(['view', 'edit'])` to `z.enum(['view', 'edit', 'create']).catch('view')` in the search schema of `apps/web/src/routes/_authenticated/transport-resources.tsx`, and clear `companyDetailsId` whenever the mode is `create` so the two can never contradict each other; leave the loader, the other params, and the legacy redirect in `apps/web/src/routes/_authenticated/transport-companies.tsx` untouched

**Checkpoint**: Repository contract, validator, policy ability, and route state in place — user stories can begin

---

## Phase 3: User Story 1 - Register a New Transport Company (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator registers a new transport company end to end, and it becomes immediately selectable as an available provider without a manual refresh.

**Independent Test**: Sign in as an administrator, open the create action from the directory, submit a unique valid name, and confirm a new available company with that name appears in the available collection with a stable identity, no lifecycle context, and no truck.

### Tests for User Story 1 ⚠️ Write first, confirm they FAIL

- [X] T008 [P] [US1] Write the happy-path unit spec in `apps/api/tests/unit/transport_companies/administration/create.spec.ts` covering: the use case creates a company through the real Lucid repository; `id` is a fresh UUID distinct from every existing company; `status` is `AVAILABLE`; every archive and reactivation field is null; `createdAt` is set and `updatedAt` equals it; a name with surrounding whitespace is stored trimmed with its submitted casing preserved
- [X] T009 [P] [US1] Write the happy-path integration spec in `apps/api/tests/integration/transport_companies/administration/create.spec.ts` covering `POST /api/v1/transport-companies` returning `201` with the complete representation for both `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, and the created company then appearing in both `GET /api/v1/transport-companies` and `GET /api/v1/transport-companies/available` in its alphabetical position, per [contracts/http-api.md](./contracts/http-api.md)
- [X] T010 [P] [US1] Add POST interception to `apps/web/src/features/transport-companies/__tests__/support/test-helpers.ts`, then write the success-path web spec in `apps/web/src/features/transport-companies/__tests__/administration/create.test.tsx` covering: the create action opens an empty form in the sheet, `?companyDetailsMode=create` survives a reload, a successful save confirms and lands on the new company's details in `view` mode, and the new company appears in the available list

### Implementation for User Story 1

- [X] T011 [US1] Implement `create` in `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts` as `TransportCompany.create({ ...command, status: 'AVAILABLE' })` returning `{ kind: 'CREATED', company }` without preloading `archivedBy` or `reactivatedBy`, following `apps/api/app/docks/shared/repositories/lucid_dock_repository.ts` (depends on T004)
- [X] T012 [US1] Create `apps/api/app/transport_companies/create/create_transport_company_use_case.ts` that normalizes the name with `assertValidSiteReferenceName` from `#site_references/shared/normalize_site_reference`, calls `create`, returns the company on `CREATED`, and throws on any unexpected result kind, mirroring `apps/api/app/customers/create/create_customer_use_case.ts` (depends on T011)
- [X] T013 [US1] Add the `store` action to `apps/api/app/controllers/transport_companies_controller.ts` that authorizes with `TransportCompanyPolicy.create`, validates with `createTransportCompanyValidator`, calls the use case, sets `response.status(201)`, and serializes through `TransportCompanyTransformer` (depends on T005, T006, T012)
- [X] T014 [US1] Register `router.post('/', [controllers.TransportCompanies, 'store']).as('store')` before `index` in the `transport_companies` group in `apps/api/start/routes.ts`, then regenerate the Tuyau registry by running an ace command and commit the generated output under `apps/api/.adonisjs/` unmodified (depends on T013)
- [X] T015 [US1] Add a `create` mutation to `apps/web/src/features/transport-companies/mutations/use-transport-company-mutations.ts` from `tuyauQuery.transportCompanies.store` that invalidates both `transportCompanyQueries.all()` and `transportCompanyQueries.available()` on success, reusing the existing `invalidateTransportCompanies` helper (depends on T014, which is what puts `store` in the registry)
- [X] T016 [US1] Generalize `apps/web/src/features/transport-companies/ui/transport-company-form.tsx` to accept an optional `company` and an `onCreate` handler alongside `onUpdate`, defaulting the name field to `company?.name ?? ''` and switching the submit label between **Create transport company** and **Save changes** on the presence of `company`, keeping the single Zod schema, modelled on `apps/web/src/features/customers/ui/customer-form.tsx`
- [X] T017 [P] [US1] Create `apps/web/src/features/transport-companies/ui/create-transport-company-panel.tsx` wrapping the form with the title **Create transport company** and a description, with no "Back to company details" action since there is no originating company (depends on T016)
- [X] T018 [US1] Wire create mode in `apps/web/src/features/transport-resources/ui/transport-resources-workspace.tsx`: add a full-width **Create transport company** button under the directory search field, open the `Sheet` when `companyDetailsMode === 'create'` as well as when a company is resolved, make the `SheetContent` `aria-label` depend on the mode instead of the hard-coded "Transport company details", render `CreateTransportCompanyPanel` in create mode, and on success show a Sonner toast, set `companyStatus: 'available'`, and navigate to `companyDetailsMode=view` with the new company's `companyDetailsId` (depends on T007, T015, T017)
- [X] T019 [US1] Offer the same create action from the empty available collection: add an optional `onCreate` prop to `apps/web/src/features/transport-companies/ui/transport-company-list.tsx` rendered inside the `Empty` block only when `canAdminister` is true, the lifecycle is `available`, and no search is active, and pass it through `apps/web/src/features/transport-companies/ui/transport-company-section.tsx` (depends on T018)

**Checkpoint**: An administrator can create a company end to end from both entry points; T008–T010 pass

---

## Phase 4: User Story 2 - Be Prevented From Creating an Invalid or Duplicate Company (Priority: P2)

**Goal**: Blank, over-long, and already-used names are refused with distinct, understandable feedback, and no partial record is created.

**Independent Test**: Attempt creation with a blank name, an over-long name, and names already used by an available and by an archived company; confirm each is refused with its own message and the collection is unchanged, then correct the value and resubmit successfully producing exactly one company.

### Tests for User Story 2 ⚠️ Write first, confirm they FAIL

- [X] T020 [P] [US2] Extend `apps/api/tests/unit/transport_companies/administration/create.spec.ts` with: a name already used by an **available** company yields `DUPLICATE_NAME`; a name already used by an **archived** company yields the same; a name differing only by letter case or surrounding whitespace yields the same; a blank name is rejected by the domain with `InvalidSiteReferenceNameException`; a 255-character name is accepted and a 256-character name is rejected; the transport-company record count is unchanged after every refusal
- [X] T021 [P] [US2] Extend `apps/api/tests/integration/transport_companies/administration/create.spec.ts` with: missing, blank, whitespace-only, and over-long `name` return `422 E_VALIDATION_ERROR` with a field-level message on `name`; a duplicate name returns `409 E_TRANSPORT_COMPANY_NAME_CONFLICT` whose message names no company; the record count is unchanged; and two creations of the same name attempted back to back produce exactly one company and one `409`, proving FR-019 against the real index
- [X] T022 [P] [US2] Extend the refusal path of `apps/web/src/features/transport-companies/__tests__/administration/create.test.tsx` covering: a `422` response attaches its message to the name field, a `409` duplicate surfaces as distinct error feedback, and the administrator can correct the value and resubmit without reopening the form with only one company resulting

### Implementation for User Story 2

- [X] T023 [US2] Add unique-violation translation to `create` in `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts`: catch the error, use `isUniqueViolation` from `#shared/database/is_unique_violation`, return `{ kind: 'DUPLICATE_NAME' }`, and rethrow anything else (depends on T003, T011)
- [X] T024 [US2] Map `DUPLICATE_NAME` to the existing `DuplicateTransportCompanyNameException` from `apps/api/app/transport_companies/shared/transport_company_exceptions.ts` in `apps/api/app/transport_companies/create/create_transport_company_use_case.ts`; add no new exception class (depends on T012, T023)
- [X] T025 [US2] Handle refusals in the create branch of `apps/web/src/features/transport-companies/ui/transport-company-form.tsx` by first attempting `applyValidationError(formApi, error)` and falling back to a Sonner toast built from `parseApiError` with an **Unable to create transport company** title, keeping the panel open and the corrected value resubmittable (depends on T016, T022)
- [X] T026 [US2] Confirm the cancel path in `apps/web/src/features/transport-companies/ui/create-transport-company-panel.tsx` and `apps/web/src/features/transport-resources/ui/transport-resources-workspace.tsx`: closing or cancelling creates nothing and returns to `companyDetailsMode=view` with no `companyDetailsId`; confirm no client-side duplicate checking against the loaded collection exists anywhere in the feature (depends on T017, T018)

**Checkpoint**: Every invalid and duplicate submission is refused distinctly and leaves the collection unchanged; US1 still passes

---

## Phase 5: User Story 3 - Be Blocked From Creating Without Administration Rights (Priority: P3)

**Goal**: Creation is refused for unauthenticated visitors, for users whose access is not active, and for active users without administration rights, with the API authoritative regardless of what the interface offers.

**Independent Test**: Attempt creation as an unauthenticated visitor, as a non-active user, and as an active observer; confirm each is refused with its documented status and nothing is created, and that no creation affordance is offered to a non-administrator anywhere, including the empty state.

### Tests for User Story 3 ⚠️ Write first, confirm they FAIL

- [X] T027 [P] [US3] Extend `apps/api/tests/integration/transport_companies/administration/create.spec.ts` with: an unauthenticated request returns `401 E_UNAUTHORIZED_ACCESS`; a user whose access is not active is refused by the authentication middleware; an active `OBSERVER` returns `403 E_AUTHORIZATION_FAILURE`; and a non-administrator submitting a blank duplicate name receives `403`, proving the check ordering in [contracts/http-api.md](./contracts/http-api.md); nothing is created in any case
- [X] T028 [P] [US3] Extend `apps/web/src/features/transport-companies/__tests__/administration/permissions.test.tsx` covering: an observer sees no **Create transport company** button in the directory header and none in the available empty state; `?companyDetailsMode=create` opens no form for an observer; an administrator sees both affordances

### Implementation for User Story 3

- [X] T029 [US3] Gate both creation affordances behind `isAdministrator(user)` from `@/features/auth/policies/permissions`: the header button in `apps/web/src/features/transport-resources/ui/transport-resources-workspace.tsx` and the empty-state action fed by `canAdminister` in `apps/web/src/features/transport-companies/ui/transport-company-list.tsx` (depends on T018, T019, T028)
- [X] T030 [US3] Guard create mode itself in `apps/web/src/features/transport-resources/ui/transport-resources-workspace.tsx` so a `companyDetailsMode=create` URL renders no form and opens no sheet when the viewer is not an administrator, matching how edit mode is already guarded (depends on T018, T029)

**Checkpoint**: All three stories pass independently; every refusal in FR-015 is observable and distinct

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T031 [P] Confirm the delivered consultation and update behavior is unaffected by running `pnpm --dir apps/web exec vitest run src/features/transport-companies` and the `apps/api/tests/*/transport_companies/consultation/` and `administration/update.spec.ts` Japa specs; the form generalization in T016 and the sheet rewiring in T018 both touch code #219 delivered
- [X] T032 [P] Confirm a newly created company owns no truck and is offered as a provider with an empty truck list, by extending `apps/api/tests/integration/transport_companies/administration/create.spec.ts` and the workspace assertions in `apps/web/src/features/transport-companies/__tests__/administration/create.test.tsx`
- [X] T033 Update the #218 row in `specs/site-references/transport-resources/transport-companies/roadmap.md` to reflect the delivered status
- [X] T034 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` and resolve every failure
- [X] T035 Walk the full browser flow in [quickstart.md](./quickstart.md) section 5 in a desktop and a narrow mobile viewport
- [ ] T036 Obtain a fresh read-only review of the final diff and resolve or explicitly justify every confirmed finding, per constitution principle VII

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **blocks all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on Foundational; its API tasks build on the repository insert and use case created in US1
- **User Story 3 (Phase 5)**: Depends on Foundational; its web tasks gate the affordances created in US1
- **Polish (Phase 6)**: Depends on all desired stories being complete

### Story Dependencies

This feature is one endpoint and one panel mode serving three behavioral stories, so the stories share files more than a typical multi-entity feature. They remain independently **testable and demonstrable**, but not fully independently **implementable**:

- **US1 (P1)**: Fully independent once Foundational is done. Delivers the working endpoint and create panel.
- **US2 (P2)**: Independently testable. Extends the repository insert and use case created by US1 rather than duplicating them, so it is sequenced after US1.
- **US3 (P3)**: Independently testable. Gates the affordances US1 introduces, so it is sequenced after US1. It is independent of US2 — the two can proceed in parallel by different developers once US1 lands, and they touch different files.

### Within Each Story

- Tests are written first and must FAIL before implementation
- Repository insert before use case, use case before controller, controller before route, route before the web mutation that consumes the generated registry
- API contract before the web form that consumes it
- Story complete before moving to the next priority

### Parallel Opportunities

- T005, T006, T007 in Foundational touch different files and can run together
- T008, T009, T010 in US1 can be written together
- T016 can proceed alongside the API chain T011–T014; only T015 must wait for T014
- T020, T021, T022 in US2 can be written together
- T027 and T028 in US3 can be written together
- After US1 lands, US2 and US3 can be developed in parallel: US2 touches the repository, use case, and form; US3 touches the workspace and list
- T031 and T032 in Polish can run together

---

## Parallel Example: User Story 1

```bash
# Write all three failing specs together:
Task: "Happy-path unit spec in apps/api/tests/unit/transport_companies/administration/create.spec.ts"
Task: "Happy-path integration spec in apps/api/tests/integration/transport_companies/administration/create.spec.ts"
Task: "Success-path web spec in apps/web/src/features/transport-companies/__tests__/administration/create.test.tsx"

# Then build the API chain while the form is generalized alongside it:
Task: "Implement create in lucid_transport_company_repository.ts"   # T011 → T012 → T013 → T014 → T015
Task: "Generalize transport-company-form.tsx for create"            # T016, independent until T017
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup — T003 is the critical item, since the whole duplicate story rests on an index this slice does not create
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: an administrator can create a company from the directory and from the empty state, and it appears immediately
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → contract and plumbing ready
2. Add User Story 1 → creation works end to end → demo (MVP)
3. Add User Story 2 → refusals are distinct and non-destructive → demo
4. Add User Story 3 → authorization is enforced and affordances are gated → demo
5. Polish → full verification, browser flow, fresh review

### Parallel Team Strategy

One developer carries US1 through to its checkpoint. After that, a second developer can take US3 (web gating) while the first takes US2 (API refusals plus form error handling); the two touch disjoint files.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- Every task names the exact file it touches, so it can be executed without re-deriving the plan
- Verify tests fail before implementing
- Commit after each task or logical group, using Conventional Commits
- No migration and no change to `apps/api/database/schema.ts` is expected in this slice; if one appears, stop and reconcile with [research.md](./research.md) decision 2
- Stop at any checkpoint to validate the story independently
