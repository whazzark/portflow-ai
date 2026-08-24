---
description: "Task list for Update a Truck (GH-224)"
---

# Tasks: Update a Truck

**Input**: Design documents from `specs/site-references/transport-resources/trucks/update-a-truck/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [quickstart.md](./quickstart.md)

**Tests**: Test tasks are **included and mandatory**. Constitution principle IV requires business behavior to follow RED → GREEN → REFACTOR, and plan.md commits to Japa API specs and router-level Vitest/MSW web specs as the primary seams.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task serves (US1, US2, US3)
- Every task names the exact file it touches

## Path Conventions

PNPM/Turbo monorepo with two workspaces: `apps/api/` (AdonisJS) and `apps/web/` (TanStack Start). Paths below are repository-relative and match the structure in plan.md.

**No migration is part of this slice.** `trucks_registration_unique` and every column this feature writes were created by List Trucks (`#222`); `discharge_truck_assignments` and the `'TRUCK'` branch of `LucidDischargeUsageRepository` already exist. Do not add a migration.

---

## Phase 1: Setup

**Purpose**: Establish a known-good baseline before changing shared files

- [X] T001 Confirm work is on branch `feat/224-update-truck` and the working tree is clean
- [X] T002 Capture a green baseline by running `pnpm check`, `pnpm typecheck`, and `pnpm test`, so any later failure is attributable to this slice
- [X] T003 [P] Create the web test directory `apps/web/src/features/trucks/__tests__/administration/`; the API directories `apps/api/tests/unit/trucks/administration/` and `apps/api/tests/integration/trucks/administration/` already exist from Create a Truck (`#223`)

**Checkpoint**: Baseline green, target directories exist

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared API modules and web plumbing that carry no story behavior on their own but that every story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Extend `apps/api/app/trucks/shared/truck_exceptions.ts` with `TruckNotFoundException` (404, `E_TRUCK_NOT_FOUND`), `ArchivedTruckReadOnlyException` (409, `E_TRUCK_ARCHIVED`), and `TruckTransportCompanyLockedException` (409, `E_TRUCK_TRANSPORT_COMPANY_LOCKED`, message naming the planned-or-active discharge commitment), leaving the existing `DuplicateTruckRegistrationException` and `InvalidTransportCompanyException` unchanged
- [X] T005 [P] Extract the shared field builders in `apps/api/app/trucks/shared/truck_validator.ts` (`registration`, `capacityTonnes`, `transportCompanyId`, and the base `vehicleModel`) and add `updateTruckValidator` requiring all four keys with `vehicleModel` as `.nullable()` but **not** `.optional()`, so an omitted key is a `422` rather than a silent clear; `createTruckValidator` must keep its current `.nullable().optional()` behavior and its existing specs must still pass
- [X] T006 Extend `apps/api/app/trucks/shared/repositories/truck_repository.ts` with the `UpdateTruckCommand` type, the `UPDATED` / `NOT_FOUND` / `ARCHIVED` members of the `TruckWriteResult` union, and the abstract `findById(id)` and `updateAvailable(command)` methods, per [data-model.md](./data-model.md#repository-contract)
- [X] T007 [P] Add `truckMode: z.enum(['view', 'edit']).catch('view')` to the search schema in `apps/web/src/routes/_authenticated/transport-resources.tsx`, alongside the existing `companyDetailsMode`, leaving the loader and every other param untouched
- [X] T008 [P] Add an `update` mutation to `apps/web/src/features/trucks/mutations/use-truck-mutations.ts` from `tuyauQuery.trucks.update` that invalidates both `truckQueries.all()` and `truckQueries.available()` on success, mirroring the existing `create` mutation and `use-transport-company-mutations.ts`

**Checkpoint**: Shared API modules and web plumbing in place — user stories can begin

---

## Phase 3: User Story 1 - Correct an Available Truck's Own Information (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator corrects an available truck's registration, vehicle model, and capacity end to end, and the new values become authoritative everywhere the truck appears, with identity, lifecycle status, and lifecycle context preserved.

**Independent Test**: Sign in as an administrator, open an available truck, submit a new registration, vehicle model, and capacity, and confirm the directory and details show the new values while `id`, `status`, and archive/reactivation context are unchanged.

### Tests for User Story 1 ⚠️ Write first, confirm they FAIL

- [X] T009 [P] [US1] Write the happy-path unit spec in `apps/api/tests/unit/trucks/administration/update.spec.ts` covering: the use case updates registration, vehicle model, and capacity on an available truck through the real Lucid repository; `id`, `status`, `createdAt`, and every archive/reactivation field are preserved; `updatedAt` advances; `vehicleModel: null` clears the model; resubmitting all four current values succeeds as a no-op; a reactivated truck keeps its retained archive context
- [X] T010 [P] [US1] Write the happy-path integration spec in `apps/api/tests/integration/trucks/administration/update.spec.ts` covering `PATCH /api/v1/trucks/:id` returning `200` with the complete updated representation for both `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, and the updated truck appearing in both `trucks.index` and `trucks.available`, per [contracts/http-api.md](./contracts/http-api.md)
- [X] T011 [P] [US1] Add PATCH interception to `apps/web/src/features/trucks/__tests__/support/test-helpers.ts` and any missing administrator fixture to `apps/web/src/features/trucks/__tests__/support/fixtures.ts`, then write the success-path web spec in `apps/web/src/features/trucks/__tests__/administration/update.test.tsx` covering: **Edit truck** opens the form pre-filled with all four current values in the detail pane, `truckMode=edit` survives a reload, a successful save confirms and returns to `truckMode=view`, the corrected truck appears in the directory in its new position, and the same flow works in the embedded workspace layout

### Implementation for User Story 1

- [X] T012 [US1] Implement `findById` and the `UPDATED` path of `updateAvailable` in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts` as `UPDATE ... WHERE id = ? AND status = 'AVAILABLE'`, reloading the row with `archivedBy` and `reactivatedBy` preloaded so the transformer emits the consultation representation; follow `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts` (depends on T006)
- [X] T013 [US1] Create `apps/api/app/trucks/update/update_truck_use_case.ts` that normalizes `registration` and `vehicleModel` with `assertValidSiteReferenceName`, loads the truck with `findById`, calls `updateAvailable`, and returns the updated truck on `UPDATED` (depends on T012)
- [X] T014 [US1] Add the `update(user)` ability to `apps/api/app/trucks/shared/truck_policy.ts` granting `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, leaving `list`, `listAvailable`, and `create` unchanged
- [X] T015 [US1] Add the `update` action to `apps/api/app/controllers/trucks_controller.ts` that authorizes with `TruckPolicy.update`, validates with `updateTruckValidator`, calls the use case with `params.id`, and serializes through `TruckTransformer` (depends on T013, T014)
- [X] T016 [US1] Register `router.patch('/:id', [controllers.Trucks, 'update']).as('update')` in the `trucks` group in `apps/api/start/routes.ts`, then regenerate the Tuyau registry by running an ace command and commit the generated output under `apps/api/.adonisjs/` unmodified (depends on T015)
- [X] T017 [P] [US1] Generalize `apps/web/src/features/trucks/ui/truck-form.tsx` with an optional `truck?: TruckDto` prop plus `onCreate` and `onUpdate` handlers, deriving `defaultValues` from the truck when present, dispatching on its presence in `onSubmit`, and switching the submit label between **Create truck** and **Save changes**; keep the existing Zod schema, capacity bounds, and decimal refinement shared between both modes, modelled on `apps/web/src/features/customers/ui/customer-form.tsx`
- [X] T018 [US1] Create `apps/web/src/features/trucks/ui/edit-truck-panel.tsx` wrapping the form with a heading, a back-to-details action, and the company-list loading/error/empty handling already used by `create-truck-panel.tsx`, calling the update mutation and reporting success with a Sonner toast (depends on T008, T017)
- [X] T019 [US1] Add the **Edit truck** action to `apps/web/src/features/trucks/ui/truck-details.tsx` and wire edit mode in `apps/web/src/features/trucks/ui/trucks-page.tsx` so the detail pane renders `EditTruckPanel` when `truckMode === 'edit'` in **both** the embedded sheet and the standalone detail card, with cancel and success navigating back to `truckMode=view` (depends on T007, T018)

**Checkpoint**: An administrator can correct an available truck's own information end to end; T009–T011 pass

---

## Phase 4: User Story 2 - Reassign a Truck to Another Transport Company (Priority: P2)

**Goal**: An authorized administrator moves an uncommitted available truck to another available transport company, and is refused when the truck is committed to a planned or active discharge.

**Independent Test**: Reassign an available truck with no unreleased assignment on a planned or active discharge and confirm the new provider appears; then attempt the same reassignment on a committed truck and confirm it is refused with every field unchanged, while a registration-only change on that same truck still succeeds.

### Tests for User Story 2 ⚠️ Write first, confirm they FAIL

- [X] T020 [P] [US2] Create `apps/api/tests/support/persisted_truck_usage.ts` exporting `createPersistedTruckUsageScenario({ status, released })` that builds a truck, a discharge of the given `DischargeStatus`, and a `DischargeTruckAssignmentFactory` row (applying the `released` state when requested), mirroring `apps/api/tests/support/persisted_dock_usage.ts`
- [X] T021 [P] [US2] Extend `apps/api/tests/unit/trucks/administration/update.spec.ts` with: reassigning an uncommitted truck to another `AVAILABLE` company succeeds; reassigning a truck committed to a `PLANNED` discharge and again to an `ACTIVE` discharge raises the locked exception with none of the four fields written; a truck whose only assignment is released, and one assigned only to a `CLOSED` discharge, can both be reassigned; a committed truck accepts a registration, vehicle model, and capacity change that keeps its current company; an archived or nonexistent submitted company raises the invalid-company exception (depends on T020)
- [X] T022 [P] [US2] Extend `apps/api/tests/integration/trucks/administration/update.spec.ts` with the `409 E_TRUCK_TRANSPORT_COMPANY_LOCKED` and `422 E_TRUCK_TRANSPORT_COMPANY_INVALID` responses, and assert that a committed truck reports the lock even when the submitted company is also archived, proving the check ordering in [data-model.md](./data-model.md#decision-order-in-the-use-case) (depends on T020)
- [X] T023 [P] [US2] Extend `apps/web/src/features/trucks/__tests__/administration/update.test.tsx` with: the company select offers the available companies plus the truck's own current company with the current one selected; a successful reassignment updates the details and the directory; `E_TRUCK_TRANSPORT_COMPANY_LOCKED` and `E_TRUCK_TRANSPORT_COMPANY_INVALID` each surface as distinct error feedback

### Implementation for User Story 2

- [X] T024 [US2] Inject `SiteReferenceUsageChecker` into `apps/api/app/trucks/update/update_truck_use_case.ts` and, **only when** the submitted `transportCompanyId` differs from the stored one, call `findUsedByPlannedOrActiveDischarge({ referenceType: 'TRUCK', referenceIds: [id] })` and raise `TruckTransportCompanyLockedException` on a hit; follow the injection and call shape of `apps/api/app/docks/archive/archive_dock_use_case.ts` (depends on T004, T013)
- [X] T025 [US2] Add the conditional company check to `apps/api/app/trucks/update/update_truck_use_case.ts`: when and only when the assignment changes, load the company with `TransportCompanyRepository.findById` and raise `InvalidTransportCompanyException` unless its status is `AVAILABLE`; place it after the usage check per the documented decision order (depends on T024)
- [X] T026 [US2] Ensure the edit path in `apps/web/src/features/trucks/ui/edit-truck-panel.tsx` passes the available companies **plus the truck's own current company** to the form, so the pre-filled value is always selectable even if that company has since been archived, and that the create path in `create-truck-panel.tsx` keeps its available-only filter (depends on T018)

**Checkpoint**: Reassignment works for uncommitted trucks and is refused for committed ones; US1 still passes

---

## Phase 5: User Story 3 - Be Prevented From Saving Invalid, Duplicate, or Forbidden Changes (Priority: P3)

**Goal**: Invalid input, duplicate registrations, archived or missing trucks, and users without administration rights are all refused with distinct, understandable feedback, and no partial change is ever applied.

**Independent Test**: Attempt updates with a blank registration, an over-precise capacity, a duplicate registration, on an archived truck, on an unknown id, as an active observer, and as an unauthenticated visitor; confirm each is refused with its documented status and the stored truck is untouched, then correct the value and resubmit successfully.

### Tests for User Story 3 ⚠️ Write first, confirm they FAIL

- [X] T027 [P] [US3] Extend `apps/api/tests/unit/trucks/administration/update.spec.ts` with: a registration used by another available or archived truck yields `DUPLICATE_REGISTRATION`, including when it differs only by letter case or surrounding whitespace; resubmitting the truck's own current registration is not a duplicate; registration and vehicle model are stored trimmed with display casing preserved; a 255-character registration is accepted and a 256-character one rejected; an archived truck yields `ARCHIVED`; an unknown id yields `NOT_FOUND`; a truck archived between load and write is refused rather than updated
- [X] T028 [P] [US3] Extend `apps/api/tests/integration/trucks/administration/update.spec.ts` with: unauthenticated returns `401 E_UNAUTHORIZED_ACCESS`; an active `OBSERVER` and an active `OPERATIONS_LEAD` return `403 E_AUTHORIZATION_FAILURE`; a missing key, blank `registration`, whitespace-only `vehicleModel`, zero, negative, and 4-decimal `capacityTonnes`, and a non-UUID `transportCompanyId` each return `422 E_VALIDATION_ERROR` with a field-level message; an omitted `vehicleModel` key returns `422` rather than clearing the model; a duplicate registration returns `409 E_TRUCK_REGISTRATION_CONFLICT`; an archived truck returns `409 E_TRUCK_ARCHIVED`; an unknown id returns `404 E_TRUCK_NOT_FOUND`; every refusal leaves the stored truck unchanged
- [X] T029 [P] [US3] Write `apps/web/src/features/trucks/__tests__/administration/permissions.test.tsx` covering: an observer sees no **Edit truck** affordance and `?truckMode=edit` opens no form for them; an administrator viewing an archived truck sees no affordance; an archived truck requested with `truckMode=edit` directly opens no form

### Implementation for User Story 3

- [X] T030 [US3] Add unique-violation translation to `updateAvailable` in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`, reusing the `isUniqueViolation` plus `trucks_registration_unique` constraint-marker check already written for `create` — extract it into one shared private helper rather than duplicating it — and return `{ kind: 'DUPLICATE_REGISTRATION' }` (depends on T012)
- [X] T031 [US3] Complete the failure path of `updateAvailable` in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`: when zero rows are affected, re-read the row to return `ARCHIVED` when it exists but is not available, and `NOT_FOUND` otherwise, including for a row found `AVAILABLE` on re-read (concurrently reactivated) (depends on T012)
- [X] T032 [US3] Map every remaining result in `apps/api/app/trucks/update/update_truck_use_case.ts`: `NOT_FOUND` → `TruckNotFoundException`, `ARCHIVED` → `ArchivedTruckReadOnlyException`, `DUPLICATE_REGISTRATION` → `DuplicateTruckRegistrationException`, throwing on any unexpected kind; the early `findById` guard must raise not-found and archived before any provider rule is evaluated (depends on T004, T013, T031)
- [X] T033 [US3] Handle refusals in `apps/web/src/features/trucks/ui/truck-form.tsx` by first attempting `applyValidationError(formApi, error)` and falling back to a Sonner toast built from `parseApiError`, keeping the form open and the corrected value resubmittable without reopening the truck, and using an update-specific toast title in edit mode (depends on T017, T029)
- [X] T034 [US3] Gate the **Edit truck** affordance in `apps/web/src/features/trucks/ui/truck-details.tsx` behind `isAdministrator(user)` from `@/features/auth/policies/permissions` and `truck.status === 'AVAILABLE'` (depends on T019, T029)
- [X] T035 [US3] Guard edit mode in `apps/web/src/features/trucks/ui/trucks-page.tsx` so `truckMode=edit` renders the details view instead of the form when the viewer is not an administrator or the selected truck is archived, and capture edit eligibility once per edit session in local state so a background refetch cannot discard an in-progress form, mirroring the `editSession` guard in `apps/web/src/features/transport-resources/ui/transport-resources-workspace.tsx` (depends on T019, T034)

**Checkpoint**: All three stories pass independently; every refusal in FR-022 is observable and distinct

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T036 [P] Confirm the existing truck suites still pass unchanged by running `pnpm --dir apps/web exec vitest run src/features/trucks` and the `tests/*/trucks/consultation/` and `tests/*/trucks/administration/create.spec.ts` Japa specs
- [X] T037 [P] Extend `apps/api/tests/integration/trucks/administration/update.spec.ts` to assert that after a registration change and a reassignment, existing `discharge_truck_assignments` rows keep their `registration_snapshot`, `transport_company_id`, and `transport_company_name_snapshot`, and that the previously assigned `transport_companies` row is unmodified (FR-019, FR-020, FR-026)
- [X] T038 [P] Confirm no `CONTEXT.md` or ADR change is required: the truck provider-lock rule and the editable-registration rule this slice enforces are already documented there, so the code must match the existing wording rather than the wording being amended (constitution principle VI)
- [X] T039 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` and resolve every failure
- [X] T040 Walk the full browser flow in [quickstart.md](./quickstart.md) section 5 in a desktop and a narrow mobile viewport
- [X] T041 Obtain a fresh read-only review of the final diff and resolve or explicitly justify every confirmed finding, per constitution principle VII

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **blocks all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on Foundational; its API tasks extend the use case created in US1
- **User Story 3 (Phase 5)**: Depends on Foundational; its API tasks extend the repository write and use case created in US1
- **Polish (Phase 6)**: Depends on all desired stories being complete

### Story Dependencies

This feature is one endpoint and one UI panel serving three behavioral stories, so the stories share files more than a typical multi-entity feature. They remain independently **testable and demonstrable**, but not fully independently **implementable**:

- **US1 (P1)**: Fully independent once Foundational is done. Delivers the working endpoint and edit panel.
- **US2 (P2)**: Independently testable. Adds the usage check and the conditional company check to the US1 use case rather than duplicating it, so it is sequenced after US1.
- **US3 (P3)**: Independently testable. Completes the US1 repository failure paths and gates the US1 affordance, so it is sequenced after US1. It is independent of US2 — the two can proceed in parallel by different developers once US1 lands, and they touch disjoint files apart from `update_truck_use_case.ts` (T024/T025 vs T032) and `trucks-page.tsx`/`truck-form.tsx`, which need a brief merge.

### Within Each Story

- Tests are written first and must FAIL before implementation
- Repository write before use case, use case before controller, controller before route
- API contract before the web form that consumes it
- Story complete before moving to the next priority

### Parallel Opportunities

- T004, T005, T007, T008 in Foundational touch different files and can run together; T006 must land before T012
- T009, T010, T011 in US1 can be written together
- T017 can proceed alongside the API chain T012–T016
- T020 unblocks T021 and T022, which can then be written together with T023
- T027, T028, T029 in US3 can be written together
- T030 and T031 both edit `lucid_truck_repository.ts` and must be sequenced, not parallelized
- After US1 lands, US2 and US3 can be developed in parallel
- T036, T037, T038 in Polish can run together

---

## Parallel Example: User Story 1

```bash
# Write all three failing specs together:
Task: "Happy-path unit spec in apps/api/tests/unit/trucks/administration/update.spec.ts"
Task: "Happy-path integration spec in apps/api/tests/integration/trucks/administration/update.spec.ts"
Task: "Success-path web spec in apps/web/src/features/trucks/__tests__/administration/update.test.tsx"

# Then build the API chain while the form is generalized alongside it:
Task: "Implement findById and updateAvailable in lucid_truck_repository.ts"   # T012 → T013 → T015 → T016
Task: "Generalize truck-form.tsx for create and edit"                         # T017, independent
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: an administrator can correct an available truck's registration, vehicle model, and capacity end to end
5. Demo if ready

Note the MVP caveat: after US1 alone the endpoint handles the happy path, but refusals are not yet mapped to their documented statuses and the provider-lock rule is not yet enforced. US1 is demonstrable, not shippable on its own — US2 and US3 are what make the endpoint safe to merge.

### Incremental Delivery

1. Setup + Foundational → shared modules and plumbing ready
2. US1 → correcting a truck works end to end → demo
3. US2 → provider reassignment works and is refused for committed trucks
4. US3 → validation, duplicate, archived, not-found, and authorization refusals complete
5. Polish → snapshot guarantees, repository-wide verification, browser flow, fresh review

### Parallel Team Strategy

1. One developer completes Setup + Foundational
2. US1 is a single-developer critical path; a second developer can take T017 in parallel
3. Once US1 lands, Developer A takes US2 and Developer B takes US3, coordinating on `update_truck_use_case.ts`
4. Both converge on Polish

---

## Notes

- Everything under `apps/api/.adonisjs/` is generated. Regenerate and commit it; never hand-edit.
- There is no migration in this slice. If a task seems to need one, re-read [data-model.md](./data-model.md) — the constraint already exists.
- `SiteReferenceUsageChecker` is already bound in `apps/api/providers/repositories_provider.ts` and already implements the `'TRUCK'` branch; T024 injects it, it does not create it.
- No lifecycle actor, timestamp, or comment is written by an update; only the four mutable fields and `updatedAt` change.
- A refusal is always total — the endpoint never applies some submitted fields and rejects others.
- Commit after each task or logical group, using Conventional Commits.
- Stop at any checkpoint to validate a story independently.
