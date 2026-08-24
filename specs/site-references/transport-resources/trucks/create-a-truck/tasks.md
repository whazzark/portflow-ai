# Tasks: Create a Truck

**Input**: Design documents from `specs/site-references/transport-resources/trucks/create-a-truck/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: Required by the Portflow constitution. Within every behavior phase, write an observable failing test, implement the minimum behavior, run it green, and refactor before advancing.

**Organization**: Tasks are grouped by user story so each increment remains demonstrable and testable. User Story 1 establishes the full create pipeline (API write path plus the web creation panel) that User Stories 2 and 3 extend with additional rejection coverage and recovery UX.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an incomplete task in the same batch.
- **[Story]**: Maps the task to a user story from spec.md.
- Every checklist item includes the exact repository file or directory it changes or validates.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure.

No setup tasks are required. The `#trucks/*` and `#transport_companies/*` import aliases, the `trucks`/`transport_companies` tables, and the `Truck`/`TransportCompany` models already exist from List Trucks (`#222`); this feature only adds a write path inside that existing module surface.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared validation, error, and cross-table lookup primitives every user story's create path depends on.

**⚠️ CRITICAL**: Complete this phase before user-story work.

- [X] T001 [P] Add `findById(id: string): Promise<TransportCompany | null>` to `apps/api/app/transport_companies/shared/repositories/transport_company_repository.ts` and implement it in `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts`
- [X] T002 [P] Implement `createTruckValidator` (registration non-blank/max 255, `vehicleModel` optional-nullable non-blank when present/max 255, `capacityTonnes` positive with a new `maxDecimalPlaces(3)` custom rule, `transportCompanyId` UUID) in `apps/api/app/trucks/shared/truck_validator.ts`
- [X] T003 [P] Add `DuplicateTruckRegistrationException` (`409`, `E_TRUCK_REGISTRATION_CONFLICT`) and `InvalidTransportCompanyException` (`422`, `E_TRUCK_TRANSPORT_COMPANY_INVALID`) in `apps/api/app/trucks/shared/truck_exceptions.ts`

**Checkpoint**: Shared validator, exceptions, and the transport-company lookup used by every story are ready.

---

## Phase 3: User Story 1 - Register a New Truck for a Transport Company (Priority: P1) 🎯 MVP

**Goal**: Let an organization administrator or operations administrator create a truck with a unique registration, positive capacity, optional vehicle model, and an available transport company, and see it immediately in truck consultation.

**Independent Test**: Sign in as an organization administrator or operations administrator, submit a unique registration, a positive capacity, and an available transport company (with and without a vehicle model), and verify the truck is created as available and appears immediately in consultation; submit a registration that duplicates an existing truck by case/whitespace and verify it is rejected with no truck created.

### Tests for User Story 1 — RED first

- [X] T004 [P] [US1] Write failing unit tests for `LucidTruckRepository.create()` covering successful creation (with and without `vehicleModel`, always `AVAILABLE` with no lifecycle context) and case-insensitive/whitespace-trimmed duplicate-registration rejection via the persisted unique index in `apps/api/tests/unit/trucks/administration/create.spec.ts`
- [X] T005 [P] [US1] Write failing integration tests for `POST /api/v1/trucks` covering `201` success for organization administrators and operations administrators, the exact response DTO shape, immediate visibility through `GET /api/v1/trucks` and `GET /api/v1/trucks/available`, and `409` for a case/whitespace duplicate registration in `apps/api/tests/integration/trucks/administration/create.spec.ts`
- [X] T006 [P] [US1] Write failing web tests for opening the create panel as an administrator, submitting valid data with and without a vehicle model, seeing the created truck in the workspace without a manual refresh, and the transport-company picker sourcing its options from the available-companies query in `apps/web/src/features/trucks/__tests__/details/create.test.tsx`

### Implementation for User Story 1 — GREEN then REFACTOR

- [X] T007 [US1] Implement `abstract create(command: CreateTruckCommand): Promise<TruckWriteResult>` (`CREATED` | `DUPLICATE_REGISTRATION`) on `TruckRepository` and `LucidTruckRepository`, inserting directly and catching a `trucks_registration_unique` violation via the existing `isUniqueViolation` helper, in `apps/api/app/trucks/shared/repositories/truck_repository.ts` and `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`
- [X] T008 [US1] Implement `CreateTruckUseCase`: load the transport company via `TransportCompanyRepository.findById`, throw `InvalidTransportCompanyException` when missing or not `AVAILABLE`, call `TruckRepository.create`, and throw `DuplicateTruckRegistrationException` on `DUPLICATE_REGISTRATION` in `apps/api/app/trucks/create/create_truck_use_case.ts` (depends on T001, T002, T003, T007)
- [X] T009 [P] [US1] Add a `create` method to `TruckPolicy` authorizing active `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN` users, alongside the existing `list`/`listAvailable` methods, in `apps/api/app/trucks/shared/truck_policy.ts`
- [X] T010 [US1] Wire a `store` controller action (authorize via `TruckPolicy.create`, validate via `createTruckValidator`, call `CreateTruckUseCase`, respond `201` with the transformed truck) and register the authenticated `POST /api/v1/trucks` route as `trucks.store` in `apps/api/app/controllers/trucks_controller.ts` and `apps/api/start/routes.ts` (depends on T008, T009)
- [X] T011 [US1] Regenerate the typed boundaries after the API becomes green; do not hand-edit `apps/api/database/schema.ts`, `apps/api/.adonisjs/server/controllers.ts`, `apps/api/.adonisjs/server/policies.ts`, or `apps/api/.adonisjs/client/registry/` (depends on T010)
- [X] T012 [US1] Add a `create` mutation with query invalidation of `truckQueries.all()`/`truckQueries.available()` in a new `useTruckMutations` hook in `apps/web/src/features/trucks/mutations/use-truck-mutations.ts` (depends on T011)
- [X] T013 [US1] Implement `CreateTruckPanel` and `TruckForm` (registration, capacity in tonnes, optional vehicle model, transport-company picker sourced from `transportCompanyQueries.available()`) following the `CreateCustomerPanel`/`CustomerForm` pattern, in `apps/web/src/features/trucks/ui/create-truck-panel.tsx` and `apps/web/src/features/trucks/ui/truck-form.tsx` (depends on T012)
- [X] T014 [US1] Wire an administrator-only "Create truck" trigger and the create panel into the workspace, following the `CustomerSheet` create-mode composition, in `apps/web/src/features/trucks/ui/trucks-page.tsx` (depends on T013)
- [X] T015 [US1] Run the focused US1 tests and refactor while preserving public behavior using `apps/api/tests/unit/trucks/administration/create.spec.ts`, `apps/api/tests/integration/trucks/administration/create.spec.ts`, and `apps/web/src/features/trucks/__tests__/details/create.test.tsx`

**Checkpoint**: User Story 1 is independently usable as the MVP: an organization administrator or operations administrator can register a truck and see it immediately in consultation.

---

## Phase 4: User Story 2 - Prevent Invalid or Unauthorized Truck Registration (Priority: P2)

**Goal**: Reject unauthorized, incomplete, or unsuitable truck registrations without creating a truck, with a specific, understandable reason for every rejection.

**Independent Test**: Attempt creation as a non-administrator and as an unauthenticated visitor, with a blank registration, a zero/negative/imprecise capacity, and an archived or nonexistent transport company; verify every attempt is rejected, no truck is created, and each rejection carries a specific reason.

### Tests for User Story 2 — RED first

- [X] T016 [P] [US2] Extend `apps/api/tests/integration/trucks/administration/create.spec.ts` with failing tests for `401` unauthenticated, `403` for `OPERATIONS_LEAD`/`OBSERVER`, and `422` for missing/blank `registration`, missing `capacityTonnes`, a missing/archived/nonexistent `transportCompanyId` — each asserting the dataset is unchanged and no existing registration is disclosed
- [X] T017 [P] [US2] Extend `apps/api/tests/unit/trucks/administration/create.spec.ts` with failing validator/use-case unit tests for blank registration, blank `vehicleModel`, zero/negative capacity, capacity with more than 3 fractional digits, and an archived/missing transport company
- [X] T018 [P] [US2] Write failing web tests asserting the create trigger is absent for `OPERATIONS_LEAD`/`OBSERVER` sessions and that the transport-company picker excludes archived companies in `apps/web/src/features/trucks/__tests__/access/authorization.test.tsx` and `apps/web/src/features/trucks/__tests__/details/create.test.tsx`

### Implementation for User Story 2 — GREEN then REFACTOR

- [X] T019 [US2] Confirm and, if needed, tighten `createTruckValidator` so every rejected case in T016/T017 produces a specific field-level VineJS error in `apps/api/app/trucks/shared/truck_validator.ts` (depends on T016, T017) — already satisfied by the Foundational implementation; verified green with no changes needed
- [X] T020 [US2] Confirm `CreateTruckUseCase` rejects a missing/archived transport company before any insert is attempted, with no truck row created, in `apps/api/app/trucks/create/create_truck_use_case.ts` (depends on T016, T017) — already satisfied by the US1 implementation; verified green with no changes needed
- [X] T021 [P] [US2] Restrict the transport-company picker to `transportCompanyQueries.available()` results and hide the "Create truck" trigger for roles other than `ORGANIZATION_ADMIN`/`OPERATIONS_ADMIN` in `apps/web/src/features/trucks/ui/create-truck-panel.tsx`, `apps/web/src/features/trucks/ui/truck-form.tsx`, and `apps/web/src/features/trucks/ui/trucks-page.tsx` — already satisfied by the US1 implementation; verified green with no changes needed
- [X] T022 [US2] Surface field-specific API validation and duplicate errors on the form via `applyValidationError`, keeping entered values on failure, in `apps/web/src/features/trucks/ui/truck-form.tsx` (depends on T021) — already satisfied by the US1 implementation; verified green with no changes needed
- [X] T023 [US2] Run the focused US2 tests and refactor while preserving public behavior using `apps/api/tests/integration/trucks/administration/create.spec.ts`, `apps/api/tests/unit/trucks/administration/create.spec.ts`, `apps/web/src/features/trucks/__tests__/access/authorization.test.tsx`, and `apps/web/src/features/trucks/__tests__/details/create.test.tsx`

**Checkpoint**: User Stories 1 and 2 both work independently; every unauthorized, incomplete, or unsuitable submission is rejected with a specific reason and no dataset mutation.

---

## Phase 5: User Story 3 - Recover From Creation Failures (Priority: P3)

**Goal**: Give clear, distinct feedback for validation, duplicate, and transient failures, and guarantee that correcting input or retrying never produces a duplicate or partial truck.

**Independent Test**: Trigger a validation failure, a duplicate-registration conflict, and a transient retrieval failure in turn; verify each produces distinct guidance, no partial/duplicate record is left, and correcting the input or retrying after a transient failure succeeds exactly once — including when two near-simultaneous submissions share the same registration.

### Tests for User Story 3 — RED first

- [X] T024 [P] [US3] Extend `apps/api/tests/integration/trucks/administration/create.spec.ts` with a failing test proving that two near-simultaneous `POST /api/v1/trucks` submissions with the same registration result in exactly one `201` and one `409`, with exactly one truck persisted
- [X] T025 [P] [US3] Write failing web tests for correcting a validation error and resubmitting successfully, retrying after a simulated transient/server failure with exactly one truck created, and distinct toast/error copy per failure kind (validation vs duplicate vs transient) in `apps/web/src/features/trucks/__tests__/details/create.test.tsx`

### Implementation for User Story 3 — GREEN then REFACTOR

- [X] T026 [US3] Confirm `LucidTruckRepository.create()` performs a single insert attempt with no pre-check query, so the persisted unique index — not application logic — is the sole race-safe duplicate guard, in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts` (depends on T024) — already satisfied by the US1 implementation; verified green with no changes needed
- [X] T027 [US3] Implement distinct toast messaging per failure kind (validation, duplicate, transient) and preserve entered form values across a failed submission in `apps/web/src/features/trucks/ui/truck-form.tsx` (depends on T025) — already satisfied by the US1 implementation (field errors for validation, `apiError.message`-driven toast description for duplicate/company-invalid/transient failures); verified green with no changes needed
- [X] T028 [US3] Run the focused US3 tests and refactor while preserving public behavior using `apps/api/tests/integration/trucks/administration/create.spec.ts` and `apps/web/src/features/trucks/__tests__/details/create.test.tsx`

**Checkpoint**: All three user stories are functional; every specified failure is understandable, leaves no partial state, and is safely retryable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Prove the delivery gates and verify the final implementation against the approved artifacts.

- [X] T029 [P] Run the focused API/web commands from `specs/site-references/transport-resources/trucks/create-a-truck/quickstart.md` — the manual desktop/narrow-viewport browser flow was skipped: it requires the shared dev PostgreSQL, and an attempt to seed it for this check found other worktree sessions already relying on that same instance, so it was intentionally not performed (user decision) in favor of the automated suites below
- [X] T030 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` — all green: `pnpm check` (Biome) clean, API `tsc --noEmit` and web `tsc --noEmit` clean, 208 API tests passed, 238 web tests passed
- [ ] T031 Obtain a fresh read-only Codex review against `specs/site-references/transport-resources/trucks/create-a-truck/spec.md` and resolve every confirmed finding in `apps/api/` and `apps/web/` — not run in this session; recommend `/code-review` before merge

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: None; nothing to do.
- **Phase 2 — Foundational**: No dependencies; blocks all user stories.
- **Phase 3 — User Story 1**: Depends on the complete foundational phase; establishes the full create pipeline (API + web) that US2 and US3 extend.
- **Phase 4 — User Story 2**: Depends on User Story 1's use case, policy, controller, and form; otherwise isolated to additional rejection coverage.
- **Phase 5 — User Story 3**: Depends on User Story 1's repository/form; may run in parallel with User Story 2 after US1 is green, coordinating shared edits to `truck-form.tsx`.
- **Phase 6 — Polish**: Depends on all selected user stories.

### User Story Dependency Graph

```text
Foundation → US1 (MVP) ─┬→ US2
                        └→ US3
US2 + US3 → Polish and delivery gates
```

### Within Each User Story

1. Write every listed test and confirm it fails for the intended missing behavior.
2. Implement repository/use-case behavior before HTTP adaptation.
3. Regenerate typed boundaries before consuming new API types in the web workspace.
4. Implement form/panel composition before wiring it into the workspace.
5. Run the focused story suite green, refactor, and rerun before advancing.

### Parallel Opportunities

- T001, T002, and T003 target independent files and can run in parallel.
- T004, T005, and T006 target independent test files and can run in parallel.
- T009 (policy) has no dependency on T007/T008 (repository/use case) and can run in parallel with them.
- T016, T017, and T018 target independent test files and can run in parallel.
- T021 (web picker/visibility) targets independent files from T019/T020 (backend validator/use case) and can run in parallel with them.
- T024 and T025 target independent test files and can run in parallel.
- US2 and US3 can run in parallel after US1, except for shared edits to `truck-form.tsx`, which must be coordinated or serialized (T022 before T027).

---

## Parallel Examples

### User Story 1

```text
Task T004: Repository create/duplicate unit tests in apps/api/tests/unit/trucks/administration/create.spec.ts
Task T005: HTTP create/duplicate integration tests in apps/api/tests/integration/trucks/administration/create.spec.ts
Task T006: Web create-panel tests in apps/web/src/features/trucks/__tests__/details/create.test.tsx
```

After T007/T008:

```text
Task T009: TruckPolicy.create authorization in apps/api/app/trucks/shared/truck_policy.ts
```

### User Story 2

```text
Task T016: Authorization/validation integration tests in apps/api/tests/integration/trucks/administration/create.spec.ts
Task T017: Validator/use-case unit tests in apps/api/tests/unit/trucks/administration/create.spec.ts
Task T018: Web visibility/picker tests in apps/web/src/features/trucks/__tests__/access/authorization.test.tsx
```

### User Story 3

```text
Task T024: Near-simultaneous duplicate integration test in apps/api/tests/integration/trucks/administration/create.spec.ts
Task T025: Retry/recovery web tests in apps/web/src/features/trucks/__tests__/details/create.test.tsx
```

---

## Implementation Strategy

### MVP First — User Story 1

1. Complete Foundation (T001–T003).
2. Execute T004–T006 as RED tests.
3. Execute T007–T014 for the smallest complete API/web create behavior.
4. Execute T015 and stop for independent MVP validation.
5. Demo an organization administrator or operations administrator registering a truck end-to-end before adding extra rejection coverage or recovery polish.

### Incremental Delivery

1. **Foundation**: Shared validator, exceptions, and transport-company lookup.
2. **US1**: Ship the working create pipeline — API write path plus the web creation panel.
3. **US2**: Add exhaustive authorization/validation rejection coverage and restrict the company picker, without changing the successful path.
4. **US3**: Add race-safe duplicate confirmation and distinct, retryable failure feedback, without changing the successful path.
5. **Polish**: Run quickstart validation, repository gates, and complete fresh review.

### Parallel Team Strategy

After US1 is green, one implementer may own US2 and another US3. They must coordinate the shared `truck-form.tsx` edits, while backend test/implementation files remain independently parallelizable.

## Notes

- `[P]` tasks change independent files and can run concurrently only after their declared prerequisites.
- `[US1]`, `[US2]`, and `[US3]` provide direct traceability to the specification stories.
- This feature creates a truck only; it does not update, archive, reactivate, permanently delete, import, or bulk-create trucks (`#224`–`#226`).
- Preserve unrelated staged/user changes and never hand-edit generated schema, route-tree, controller/policy manifest, or Tuyau declaration files.
- Keep commits focused and use Conventional Commits when the implementation is later committed.
