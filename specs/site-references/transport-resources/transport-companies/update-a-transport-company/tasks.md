---
description: "Task list for Update a Transport Company (GH-219)"
---

# Tasks: Update a Transport Company

**Input**: Design documents from `specs/site-references/transport-resources/transport-companies/update-a-transport-company/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [quickstart.md](./quickstart.md)

**Tests**: Test tasks are **included and mandatory**. Constitution principle IV requires business behavior to follow RED → GREEN → REFACTOR, and plan.md commits to Japa API specs and router-level Vitest/MSW web specs as the primary seams.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task serves (US1, US2, US3)
- Every task names the exact file it touches

## Path Conventions

PNPM/Turbo monorepo with two workspaces: `apps/api/` (AdonisJS) and `apps/web/` (TanStack Start). Paths below are repository-relative and match the structure in plan.md.

---

## Phase 1: Setup

**Purpose**: Establish a known-good baseline before changing shared files

- [X] T001 Confirm work is on branch `feat/219-update-transport-company` and the working tree is clean
- [X] T002 Capture a green baseline by running `pnpm check`, `pnpm typecheck`, and `pnpm test`, so any later failure is attributable to this slice
- [X] T003 [P] Create the API test directory `apps/api/tests/unit/transport_companies/administration/` and `apps/api/tests/integration/transport_companies/administration/`, and the web test directory `apps/web/src/features/transport-companies/__tests__/administration/`

**Checkpoint**: Baseline green, target directories exist

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema constraint and shared modules that carry no story behavior on their own but that every story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Add migration `apps/api/database/migrations/1785100000000_add_transport_companies_name_unique_index.ts` creating `CREATE UNIQUE INDEX transport_companies_name_unique ON transport_companies (LOWER(name))` inside `this.defer(async (db) => ...)` with `db.rawQuery`, and dropping the index in `down()`; follow the form used by `apps/api/database/migrations/1784500000000_create_docks_table.ts`
- [X] T005 Apply the migration with `pnpm --filter @portflow/api db:fresh` and commit the regenerated `apps/api/database/schema.ts` without hand-editing it (depends on T004)
- [X] T006 [P] Create `apps/api/app/transport_companies/shared/transport_company_exceptions.ts` exporting `TransportCompanyNotFoundException` (404, `E_TRANSPORT_COMPANY_NOT_FOUND`), `DuplicateTransportCompanyNameException` (409, `E_TRANSPORT_COMPANY_NAME_CONFLICT`), and `ArchivedTransportCompanyReadOnlyException` (409, `E_TRANSPORT_COMPANY_ARCHIVED`), mirroring `apps/api/app/customers/shared/customer_exceptions.ts`
- [X] T007 [P] Create `apps/api/app/transport_companies/shared/transport_company_validator.ts` exporting `updateTransportCompanyValidator` with a required `name` using `vine.string().use(nonBlank()).minLength(1).maxLength(255)` from `#site_references/shared/site_reference_validator`
- [X] T008 Extend `apps/api/app/transport_companies/shared/repositories/transport_company_repository.ts` with the `UpdateTransportCompanyCommand` type, the `TransportCompanyWriteResult` discriminated union (`UPDATED` / `NOT_FOUND` / `ARCHIVED` / `DUPLICATE_NAME`), and the abstract `updateAvailable(command)` method, per [data-model.md](./data-model.md)
- [X] T009 [P] Add `companyMode: z.enum(['view', 'edit']).catch('view')` to the search schema in `apps/web/src/routes/_authenticated/transport-resources.tsx`, leaving the existing loader and params untouched
- [X] T010 [P] Create `apps/web/src/features/transport-companies/mutations/use-transport-company-mutations.ts` exposing an `update` mutation from `tuyauQuery.transportCompanies.update` that invalidates both `transportCompanyQueries.all()` and `transportCompanyQueries.available()` on success, mirroring `apps/web/src/features/customers/mutations/use-customer-mutations.ts`

**Checkpoint**: Constraint enforced in the database, shared API modules and web plumbing in place — user stories can begin

---

## Phase 3: User Story 1 - Correct an Available Company's Name (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator renames an available transport company end to end, and the new name becomes authoritative everywhere the company appears, with identity, lifecycle state, and lifecycle context preserved.

**Independent Test**: Sign in as an administrator, open an available company, submit a different valid name, and confirm the directory and details show the new name while `id`, `status`, and archive/reactivation context are unchanged.

### Tests for User Story 1 ⚠️ Write first, confirm they FAIL

- [X] T011 [P] [US1] Write the happy-path unit spec in `apps/api/tests/unit/transport_companies/administration/update.spec.ts` covering: the use case renames an available company through the real Lucid repository; `id`, `status`, `createdAt`, and every archive/reactivation field are preserved; `updatedAt` advances; resubmitting the company's own current name succeeds
- [X] T012 [P] [US1] Write the happy-path integration spec in `apps/api/tests/integration/transport_companies/administration/update.spec.ts` covering `PATCH /api/v1/transport-companies/:id` returning `200` with the complete updated representation for both `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, per [contracts/http-api.md](./contracts/http-api.md)
- [X] T013 [P] [US1] Add an administrator fixture to `apps/web/src/features/transport-companies/__tests__/support/fixtures.ts` and PATCH interception to `apps/web/src/features/transport-companies/__tests__/support/test-helpers.ts`, then write the success-path web spec in `apps/web/src/features/transport-companies/__tests__/administration/update.test.tsx` covering: **Edit company** opens the pre-filled form in the detail pane, `companyMode=edit` survives a reload, a successful save confirms and returns to details, and the renamed company appears in the directory

### Implementation for User Story 1

- [X] T014 [US1] Implement `updateAvailable` in `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts` as `UPDATE ... WHERE id = ? AND status = 'AVAILABLE'`, returning `UPDATED` with the reloaded company, following `apps/api/app/customers/shared/repositories/lucid_customer_repository.ts` (depends on T008)
- [X] T015 [US1] Create `apps/api/app/transport_companies/update/update_transport_company_use_case.ts` that normalizes the name with `assertValidSiteReferenceName`, calls `updateAvailable`, and returns the updated company on `UPDATED` (depends on T014)
- [X] T016 [US1] Add the `update(user)` ability to `apps/api/app/transport_companies/shared/transport_company_policy.ts` granting `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, leaving `list` and `listAvailable` open to every active user
- [X] T017 [US1] Add the `update` action to `apps/api/app/controllers/transport_companies_controller.ts` that authorizes with `TransportCompanyPolicy.update`, validates with `updateTransportCompanyValidator`, calls the use case with `params.id`, and serializes through `TransportCompanyTransformer` (depends on T015, T016)
- [X] T018 [US1] Register `router.patch('/:id', [controllers.TransportCompanies, 'update']).as('update')` in the `transport_companies` group in `apps/api/start/routes.ts`, then regenerate the Tuyau registry by running an ace command and commit the generated output under `apps/api/.adonisjs/` unmodified (depends on T017)
- [X] T019 [P] [US1] Create `apps/web/src/features/transport-companies/ui/transport-company-form.tsx` using `useAppForm` with a Zod schema of `z.string().trim().min(1).max(255)` for `name`, pre-filled from the company, and a **Save changes** submit button, modelled on `apps/web/src/features/customers/ui/customer-form.tsx`
- [X] T020 [US1] Create `apps/web/src/features/transport-companies/ui/edit-transport-company-panel.tsx` wrapping the form with a heading and a cancel action, calling the update mutation and reporting success with a Sonner toast (depends on T010, T019)
- [X] T021 [US1] Wire edit mode in `apps/web/src/features/transport-companies/ui/transport-companies-page.tsx` and add the **Edit company** action to `apps/web/src/features/transport-companies/ui/transport-company-details.tsx`, so the detail pane renders the edit panel when `companyMode === 'edit'` and both cancel and success navigate back to `companyMode=view` (depends on T009, T020)

**Checkpoint**: An administrator can rename an available company end to end; T011–T013 pass

---

## Phase 4: User Story 2 - Be Prevented From Saving an Invalid or Duplicate Name (Priority: P2)

**Goal**: Invalid and already-used names are refused with distinct, understandable feedback, and no partial change is applied.

**Independent Test**: Submit a blank name, an over-long name, and a name already used by another company; confirm each is refused with its own message and the stored company is untouched, then correct the value and resubmit successfully.

### Tests for User Story 2 ⚠️ Write first, confirm they FAIL

- [X] T022 [P] [US2] Extend `apps/api/tests/unit/transport_companies/administration/update.spec.ts` with: a name already used by another company yields `DUPLICATE_NAME` including when it differs only by letter case or surrounding whitespace; a name with surrounding whitespace is stored trimmed; a blank name is rejected by the domain; a 255-character name is accepted and a 256-character name is rejected; the stored company is unchanged after every refusal
- [X] T023 [P] [US2] Extend `apps/api/tests/integration/transport_companies/administration/update.spec.ts` with: missing, blank, whitespace-only, and over-long `name` return `422 E_VALIDATION_ERROR` with a field-level message on `name`; a duplicate name returns `409 E_TRANSPORT_COMPANY_NAME_CONFLICT`; neither company is modified

### Implementation for User Story 2

- [X] T024 [US2] Add unique-violation translation to `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts`: catch the error, use `isUniqueViolation` from `#shared/database/is_unique_violation`, and map the `transport_companies_name_unique` constraint to `{ kind: 'DUPLICATE_NAME' }`, rethrowing anything else (depends on T004, T014)
- [X] T025 [US2] Map `DUPLICATE_NAME` to `DuplicateTransportCompanyNameException` in `apps/api/app/transport_companies/update/update_transport_company_use_case.ts` (depends on T006, T024)
- [X] T026 [P] [US2] Write the refusal-path web spec in `apps/web/src/features/transport-companies/__tests__/administration/update.test.tsx` covering: a `422` response attaches its message to the name field, a `409` duplicate surfaces as distinct error feedback, and the administrator can correct the value and resubmit without reopening the company
- [X] T027 [US2] Handle refusals in `apps/web/src/features/transport-companies/ui/transport-company-form.tsx` by first attempting `applyValidationError(formApi, error)` and falling back to a Sonner toast built from `parseApiError`, keeping the form open and the corrected value resubmittable (depends on T019, T026)
- [X] T028 [US2] Add a cancel path assertion and confirm no client-side duplicate checking exists in `apps/web/src/features/transport-companies/ui/edit-transport-company-panel.tsx`; cancelling must leave the company unchanged and return to `companyMode=view` (depends on T020)

**Checkpoint**: Every invalid and duplicate submission is refused distinctly and leaves data unchanged; US1 still passes

---

## Phase 5: User Story 3 - Be Blocked From Updating What Must Not Change (Priority: P3)

**Goal**: Updates are refused for users without administration rights, for archived companies, and for companies that no longer exist, with the API authoritative regardless of what the interface offers.

**Independent Test**: Attempt updates as an unauthenticated visitor, as an active observer, on an archived company, and on an unknown id; confirm each is refused with its documented status and no data changes, and that no update affordance is offered to a non-administrator.

### Tests for User Story 3 ⚠️ Write first, confirm they FAIL

- [X] T029 [P] [US3] Extend `apps/api/tests/unit/transport_companies/administration/update.spec.ts` with: an archived company yields `ARCHIVED`, an unknown id yields `NOT_FOUND`, and a company archived between load and write is refused rather than renamed
- [X] T030 [P] [US3] Extend `apps/api/tests/integration/transport_companies/administration/update.spec.ts` with: unauthenticated returns `401 E_UNAUTHORIZED_ACCESS`; an active `OBSERVER` returns `403 E_AUTHORIZATION_FAILURE`; an archived company returns `409 E_TRANSPORT_COMPANY_ARCHIVED`; an unknown id returns `404 E_TRANSPORT_COMPANY_NOT_FOUND`; and a non-administrator submitting a blank name for an archived company receives `403`, proving the check ordering in [contracts/http-api.md](./contracts/http-api.md)
- [X] T031 [P] [US3] Write `apps/web/src/features/transport-companies/__tests__/administration/permissions.test.tsx` covering: an observer sees no **Edit company** affordance and `?companyMode=edit` opens no form for them; an administrator viewing an archived company sees no affordance; an archived company requested with `companyMode=edit` directly opens no form

### Implementation for User Story 3

- [X] T032 [US3] Map `NOT_FOUND` to `TransportCompanyNotFoundException` and `ARCHIVED` to `ArchivedTransportCompanyReadOnlyException` in `apps/api/app/transport_companies/update/update_transport_company_use_case.ts`, throwing on any unexpected result kind (depends on T006, T015)
- [X] T033 [US3] Complete the failure path of `updateAvailable` in `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts`: when zero rows are affected, re-read the row to return `ARCHIVED` when it exists but is not available, and `NOT_FOUND` otherwise (depends on T014)
- [X] T034 [US3] Gate the **Edit company** affordance in `apps/web/src/features/transport-companies/ui/transport-company-details.tsx` behind `isAdministrator(sessionUser)` from `@/features/auth/policies/permissions` and `company.status === 'AVAILABLE'` (depends on T021, T031)
- [X] T035 [US3] Guard edit mode in `apps/web/src/features/transport-companies/ui/transport-companies-page.tsx` so `companyMode=edit` renders the details view instead of the form when the viewer is not an administrator or the selected company is archived (depends on T021, T034)

**Checkpoint**: All three stories pass independently; every refusal in FR-017 is observable and distinct

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T036 [P] Confirm the existing consultation suites still pass unchanged by running `pnpm --dir apps/web exec vitest run src/features/transport-companies` and the `tests/*/transport_companies/consultation/` Japa specs
- [X] T037 [P] Confirm truck associations survive a rename by extending `apps/api/tests/integration/transport_companies/administration/update.spec.ts` with a truck attached to the renamed company
- [X] T038 Update the slice row for #219 in `specs/site-references/transport-resources/transport-companies/roadmap.md` to point at this feature directory
- [X] T039 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` and resolve every failure
- [X] T040 Walk the full browser flow in [quickstart.md](./quickstart.md) section 5 in a desktop and a narrow mobile viewport
- [X] T041 Obtain a fresh read-only review of the final diff and resolve or explicitly justify every confirmed finding, per constitution principle VII

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **blocks all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on Foundational; its API tasks build on the repository write and use case created in US1
- **User Story 3 (Phase 5)**: Depends on Foundational; its API tasks build on the repository write and use case created in US1
- **Polish (Phase 6)**: Depends on all desired stories being complete

### Story Dependencies

This feature is one endpoint and one UI panel serving three behavioral stories, so the stories share files more than a typical multi-entity feature. They remain independently **testable and demonstrable**, but not fully independently **implementable**:

- **US1 (P1)**: Fully independent once Foundational is done. Delivers the working endpoint and edit panel.
- **US2 (P2)**: Independently testable. Extends the use case and repository created by US1 rather than duplicating them, so it is sequenced after US1.
- **US3 (P3)**: Independently testable. Also extends the US1 use case and repository, and gates the US1 affordance, so it is sequenced after US1. It is independent of US2 — the two can proceed in parallel by different developers once US1 lands.

### Within Each Story

- Tests are written first and must FAIL before implementation
- Repository write before use case, use case before controller, controller before route
- API contract before the web form that consumes it
- Story complete before moving to the next priority

### Parallel Opportunities

- T006, T007, T009, T010 in Foundational touch different files and can run together
- T011, T012, T013 in US1 can be written together
- T022, T023, T026 in US2 can be written together
- T029, T030, T031 in US3 can be written together
- T019 can proceed alongside the API tasks T014–T018
- After US1 lands, US2 and US3 can be developed in parallel; only T027 and T034 touch different files in the same feature module, so they do not conflict
- T036 and T037 in Polish can run together

---

## Parallel Example: User Story 1

```bash
# Write all three failing specs together:
Task: "Happy-path unit spec in apps/api/tests/unit/transport_companies/administration/update.spec.ts"
Task: "Happy-path integration spec in apps/api/tests/integration/transport_companies/administration/update.spec.ts"
Task: "Success-path web spec in apps/web/src/features/transport-companies/__tests__/administration/update.test.tsx"

# Then build the API chain while the form is built alongside it:
Task: "Implement updateAvailable in lucid_transport_company_repository.ts"   # T014 → T015 → T017 → T018
Task: "Create transport-company-form.tsx"                                    # T019, independent
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — the migration is the critical item
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: an administrator can rename an available company end to end
5. Demo if ready

Note the MVP caveat: after US1 alone the endpoint handles the happy path, but refusals are not yet mapped to their documented statuses. US1 is demonstrable, not shippable on its own — US2 and US3 are what make the endpoint safe to merge.

### Incremental Delivery

1. Setup + Foundational → constraint and plumbing ready
2. US1 → rename works end to end → demo
3. US2 → invalid and duplicate names refused cleanly
4. US3 → authorization, archived, and not-found refusals complete
5. Polish → repository-wide verification, browser flow, fresh review

### Parallel Team Strategy

1. One developer completes Setup + Foundational
2. US1 is a single-developer critical path; a second developer can take T019 in parallel
3. Once US1 lands, Developer A takes US2 and Developer B takes US3
4. Both converge on Polish

---

## Notes

- `apps/api/database/schema.ts` and everything under `apps/api/.adonisjs/` are generated. Regenerate and commit them; never hand-edit.
- The migration in T004 is the only schema change in this slice, and it constrains inserts as well as updates — creation (#218) inherits the guarantee.
- No lifecycle actor, timestamp, or comment is written by a rename; only `name` and `updatedAt` change.
- Commit after each task or logical group, using Conventional Commits.
- Stop at any checkpoint to validate a story independently.
