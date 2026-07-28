---
description: "Portflow task list grouped by independently deliverable user story"
---

# Tasks: Administer Customers From the Web Workbench

**Input**: `spec.md`, `plan.md`, `data-model.md`, `contracts/`, `research.md`, and `quickstart.md` in this feature directory.
**Prerequisites**: Approved spec and plan.

## Task format

`- [ ] T001 [P?] [US1] [RED|GREEN|REFACTOR|DOC] Concrete action in an exact path`

- `[P]` means the task is safe to run in parallel with other tasks in the same phase.
- Every task names its user story where applicable, an exact repository path, and its test-first stage.
- Tests come before the implementation they prove.

## Phase 1: Setup

- [X] T001 [SETUP] [DOC] Audit the existing customer API and web vertical slices against `specs/site-references/customer-reference-and-site-reference-lifecycle-foundation/administer-customers-from-the-web-workbench/plan.md`, recording only contract-divergent seams in `specs/site-references/customer-reference-and-site-reference-lifecycle-foundation/administer-customers-from-the-web-workbench/research.md`.
- [X] T002 [P] [SETUP] [DOC] Verify customer status, identity constraints, lifecycle metadata, and discharge-reference relationships against `apps/api/database/migrations/1784300000000_create_customers_table.ts`, `apps/api/database/migrations/1784400000000_add_customer_lifecycle_metadata.ts`, and `specs/site-references/customer-reference-and-site-reference-lifecycle-foundation/administer-customers-from-the-web-workbench/data-model.md`.
- [X] T003 [P] [SETUP] [DOC] Verify the existing named customer routes, serialized DTOs, and web mutation/query seams against `specs/site-references/customer-reference-and-site-reference-lifecycle-foundation/administer-customers-from-the-web-workbench/contracts/api.md` and `specs/site-references/customer-reference-and-site-reference-lifecycle-foundation/administer-customers-from-the-web-workbench/contracts/ui.md`.

## Phase 2: Foundational

- [X] T004 [FOUNDATION] [GREEN] Define one shared grouped lifecycle result and blocker vocabulary in `apps/api/app/customers/shared/repositories/customer_repository.ts` and `apps/api/app/customers/shared/customer_lifecycle_blockers.ts` for `updatedCustomers`, `blockedCustomers`, and `NOT_FOUND`, `IN_USE`, `ALREADY_ARCHIVED`, and `ALREADY_AVAILABLE`.
- [X] T005 [FOUNDATION] [GREEN] Align controller serialization and shared error mapping with the customer API contract in `apps/api/app/controllers/customers_controller.ts` and `apps/api/app/customers/shared/customer_transformer.ts`, preserving individual mutation error envelopes.
- [X] T006 [P] [FOUNDATION] [GREEN] Align frontend transport types and query invalidation seams with the grouped result contract in `apps/web/src/features/customers/types.ts`, `apps/web/src/features/customers/queries/customer-queries.ts`, and `apps/web/src/features/customers/mutations/use-customer-mutations.ts`.

## Phase 3: User Story 1 - Consult the Customer Reference (Priority: P1)

**Goal**: Active users can consult available and archived customers through a restorable, searchable, sortable, accessible workbench without receiving mutation authority.

**Independent test**: Run the API consultation suites in `apps/api/tests/unit/customers/consultation/list.spec.ts`, `apps/api/tests/unit/customers/consultation/available.spec.ts`, `apps/api/tests/integration/customers/consultation/list.spec.ts`, and `apps/api/tests/integration/customers/consultation/available.spec.ts`, plus the related web suites; verify available/archived consultation, URL restoration, empty/no-result states, loading/retry feedback, and observer read-only behavior.

- [X] T007 [P] [US1] [RED] Add one unit and one integration test suite per consultation endpoint in `apps/api/tests/unit/customers/consultation/list.spec.ts`, `apps/api/tests/unit/customers/consultation/available.spec.ts`, `apps/api/tests/integration/customers/consultation/list.spec.ts`, and `apps/api/tests/integration/customers/consultation/available.spec.ts`.
- [X] T008 [P] [US1] [RED] Add web tests for available/archived tabs, search, sorting, detail inspection, empty/no-result states, loading, retryable errors, and URL-restored state in `apps/web/src/features/customers/__tests__/list/list.test.tsx`, `apps/web/src/features/customers/__tests__/details/open.test.tsx`, and `apps/web/src/features/customers/__tests__/feedback/feedback.test.tsx`.
- [X] T009 [US1] [GREEN] Close any consultation contract gaps found by the failing tests in `apps/api/app/customers/list/list_customers_use_case.ts`, `apps/api/app/customers/available/list_available_customers_use_case.ts`, `apps/api/app/customers/shared/customer_transformer.ts`, and `apps/api/app/controllers/customers_controller.ts`.
- [X] T010 [US1] [GREEN] Close any workbench state or accessibility gaps found by the failing tests in `apps/web/src/routes/_authenticated/customers.tsx`, `apps/web/src/features/customers/ui/customers-page.tsx`, `apps/web/src/features/customers/ui/customer-table.tsx`, and `apps/web/src/features/customers/ui/customer-details.tsx`.
- [X] T011 [US1] [REFACTOR] Consolidate consultation view-model, URL-state, and status-label handling without moving business authorization or lifecycle decisions into `apps/web/src/features/customers/types.ts`, `apps/web/src/features/customers/helpers/customer-search.ts`, and `apps/web/src/routes/_authenticated/customers.tsx`.

## Phase 4: User Story 2 - Maintain Available Customer Identity (Priority: P1)

**Goal**: Organization Admins and Operations Admins can create and edit available customers with normalized, unique identity fields; archived customers remain read-only.

**Independent test**: Run the API administration suites in `apps/api/tests/unit/customers/administration` and `apps/api/tests/integration/customers/administration`, plus the details web suite; verify both administrator roles, observer refusal, normalization, field-level validation, duplicate conflicts, identity preservation, and archived read-only behavior.

- [X] T012 [P] [US2] [RED] Add one unit and one integration test suite per administration endpoint in `apps/api/tests/unit/customers/administration/create.spec.ts`, `apps/api/tests/unit/customers/administration/update.spec.ts`, `apps/api/tests/integration/customers/administration/create.spec.ts`, and `apps/api/tests/integration/customers/administration/update.spec.ts`.
- [X] T013 [P] [US2] [RED] Add web tests for administrator-only create/edit controls, field-level validation, form-level duplicate errors, identity preservation, and archived read-only details in `apps/web/src/features/customers/__tests__/details/create.test.tsx`, `apps/web/src/features/customers/__tests__/details/update.test.tsx`, and `apps/web/src/features/customers/__tests__/details/permissions.test.tsx`.
- [X] T014 [US2] [GREEN] Implement or correct customer normalization, validation, uniqueness mapping, and available-only update behavior in `apps/api/app/customers/shared/customer_validator.ts`, `apps/api/app/customers/shared/normalize_customer.ts`, `apps/api/app/customers/create/create_customer_use_case.ts`, and `apps/api/app/customers/update/update_customer_use_case.ts`.
- [X] T015 [US2] [GREEN] Implement or correct typed create/update form submission, field-level error presentation, and archived read-only mode in `apps/web/src/features/customers/ui/customer-form.tsx`, `apps/web/src/features/customers/ui/create-customer-panel.tsx`, and `apps/web/src/features/customers/ui/edit-customer-panel.tsx`.
- [X] T016 [US2] [REFACTOR] Keep role-derived affordances, server authorization failures, and customer form view models separated at the web boundary in `apps/web/src/features/customers/ui/customers-page.tsx`, `apps/web/src/features/customers/ui/customer-details.tsx`, and `apps/web/src/features/customers/mutations/use-customer-mutations.ts`.

## Phase 5: User Story 3 - Manage Customer Availability Safely (Priority: P1)

**Goal**: Authorized administrators can archive/reactivate customers individually or in groups, with safe lifecycle decisions, partial-success results, preserved history, and actionable recovery feedback.

**Independent test**: Run the focused API and web customer suites; exercise available, archived, in-use, missing, stale, mixed, duplicate, and empty selections. Verify eligible records transition, blocked records remain unchanged, every blocker has one reason, lifecycle metadata is retained, and the workbench refreshes recoverably.

### RED: API behavior

- [X] T017 [P] [US3] [RED] Add unit tests for individual and bulk archive outcomes in `apps/api/tests/unit/customers/lifecycle/archive.spec.ts` and `apps/api/tests/unit/customers/lifecycle/bulk/archive.spec.ts`.
- [X] T018 [P] [US3] [RED] Add unit tests for individual and bulk reactivation outcomes in `apps/api/tests/unit/customers/lifecycle/reactivate.spec.ts` and `apps/api/tests/unit/customers/lifecycle/bulk/reactivate.spec.ts`.
- [X] T019 [P] [US3] [RED] Add integration tests proving individual and bulk archive outcomes, usage blockers, stale lifecycle state, and partial results in `apps/api/tests/integration/customers/lifecycle/archive.spec.ts` and `apps/api/tests/integration/customers/lifecycle/bulk/archive.spec.ts`.
- [X] T020 [P] [US3] [RED] Add integration tests proving individual and bulk reactivation outcomes, request validation, authorization, duplicate IDs, and lifecycle comments in `apps/api/tests/integration/customers/lifecycle/reactivate.spec.ts` and `apps/api/tests/integration/customers/lifecycle/bulk/reactivate.spec.ts`.

### GREEN: API behavior

- [X] T021 [US3] [GREEN] Implement request-order classification and distinct-ID blocker mapping in `apps/api/app/customers/shared/customer_lifecycle_blockers.ts`, preserving known labels and null labels for missing records.
- [X] T022 [US3] [GREEN] Move row-state and planned/active discharge usage re-evaluation into the locked repository transaction, update only eligible records, and return partial results in `apps/api/app/customers/shared/repositories/lucid_customer_repository.ts`.
- [X] T023 [US3] [GREEN] Return structured partial-success outcomes from archive and reactivate use cases while retaining individual transition invariants and trimmed lifecycle comments in `apps/api/app/customers/archive/archive_customers_use_case.ts` and `apps/api/app/customers/reactivate/reactivate_customers_use_case.ts`.
- [X] T024 [US3] [GREEN] Adapt grouped lifecycle controller actions to serialize `updatedCustomers` and `blockedCustomers` while preserving policy checks and shared authentication, authorization, validation, and individual-error behavior in `apps/api/app/controllers/customers_controller.ts`.
- [X] T025 [US3] [GREEN] Verify lifecycle actor/time/comment metadata and historical customer retention are returned consistently after individual and grouped transitions in `apps/api/app/customers/shared/customer_transformer.ts`, `apps/api/app/models/customer.ts`, and the dedicated archive/reactivate integration suites.

### RED: Web behavior

- [X] T026 [P] [US3] [RED] Add MSW-backed tests for structured mixed archive/reactivate results, successful-selection clearing, blocked-selection retention, retry/removal feedback, and refresh of available and all-customer queries in `apps/web/src/features/customers/__tests__/bulk/archive.test.tsx`, `apps/web/src/features/customers/__tests__/bulk/reactivation.test.tsx`, and `apps/web/src/features/customers/__tests__/feedback/feedback.test.tsx`.
- [X] T027 [P] [US3] [RED] Add web tests for individual lifecycle confirmations, stale/already-in-state outcomes, comment handling, and archived/available status transitions in `apps/web/src/features/customers/__tests__/lifecycle/lifecycle.test.tsx`.

### GREEN: Web behavior

- [X] T028 [US3] [GREEN] Translate grouped lifecycle transport results into typed mutation state, invalidate both customer query families, clear changed IDs, and retain blocked IDs in `apps/web/src/features/customers/mutations/use-customer-mutations.ts`.
- [X] T029 [US3] [GREEN] Render per-record blocker reasons and actionable retry/removal feedback without presenting successful records as failures in `apps/web/src/features/customers/ui/bulk-lifecycle-actions.tsx` and `apps/web/src/features/customers/ui/customer-section.tsx`.
- [X] T030 [US3] [GREEN] Preserve individual lifecycle confirmation, optional comments, accessible status announcements, and administrator-only controls in `apps/web/src/features/customers/ui/lifecycle-actions.tsx`, `apps/web/src/features/customers/ui/customer-details.tsx`, and `apps/web/src/features/customers/ui/customer-table.tsx`.

### REFACTOR: Story integration

- [X] T031 [US3] [REFACTOR] Consolidate API and web blocker/result mapping behind the existing customer feature types and helpers in `apps/api/app/customers/shared/customer_lifecycle_blockers.ts`, `apps/api/app/customers/shared/repositories/customer_repository.ts`, `apps/web/src/features/customers/types.ts`, and `apps/web/src/features/customers/mutations/use-customer-mutations.ts`.
- [X] T032 [US3] [REFACTOR] Update the customer API and UI contracts plus focused validation scenarios to reflect the final partial-success result and recovery behavior in `specs/site-references/customer-reference-and-site-reference-lifecycle-foundation/administer-customers-from-the-web-workbench/contracts/api.md`, `specs/site-references/customer-reference-and-site-reference-lifecycle-foundation/administer-customers-from-the-web-workbench/contracts/ui.md`, and `specs/site-references/customer-reference-and-site-reference-lifecycle-foundation/administer-customers-from-the-web-workbench/quickstart.md`.

## Final verification

- [X] T033 [VERIFY] [DOC] Run `pnpm check` from `package.json` and resolve formatting/lint failures in changed API, web, and feature-artifact paths.
- [X] T034 [VERIFY] [DOC] Run `pnpm typecheck` from `package.json` and resolve failures reported for `apps/api/tsconfig.json` and `apps/web/tsconfig.json`.
- [X] T035 [VERIFY] [DOC] Run `pnpm test` from `package.json` after the focused suites in `apps/api/tests/` and `apps/web/src/features/customers/__tests__/` are green, preserving authorization, lifecycle, and partial-success assertions.
- [X] T036 [VERIFY] [DOC] Run the configured authenticated customer browser journey, or document the unavailable browser seam and equivalent coverage in `specs/site-references/customer-reference-and-site-reference-lifecycle-foundation/administer-customers-from-the-web-workbench/quickstart.md`.
- [X] T037 [VERIFY] [DOC] Perform the manual SC-004 timed workbench review described in `specs/site-references/customer-reference-and-site-reference-lifecycle-foundation/administer-customers-from-the-web-workbench/quickstart.md`, recording whether a known customer can be opened and a lifecycle action begun within 60 seconds.
- [X] T038 [VERIFY] [DOC] Perform the manual SC-005 mutation-refresh timing review described in `specs/site-references/customer-reference-and-site-reference-lifecycle-foundation/administer-customers-from-the-web-workbench/quickstart.md`, recording whether resulting state and lifecycle metadata appear within 2 seconds without a full-page reload.
- [X] T039 [VERIFY] [DOC] Run `$speckit-analyze` and `$speckit-converge` for `specs/site-references/customer-reference-and-site-reference-lifecycle-foundation/administer-customers-from-the-web-workbench/` and resolve any reported gaps.

## Dependencies and execution order

- Phase 1 precedes Phase 2; the baseline audit identifies which existing seams require implementation changes.
- Phase 2 precedes all user-story work because API and web layers must share the grouped result and blocker vocabulary.
- US1 and US2 can proceed in parallel after Phase 2 when they touch separate test/UI files; US3 depends on the shared result contract and may reuse the consultation and identity fixtures.
- Within US3, T017–T020 and T026–T027 are RED tests and can proceed in parallel by file ownership. T021–T025 depend on the API RED tests; T028–T030 depend on the stable API result shape and web RED tests. T031–T032 follow green implementation.
- Final verification begins after T032 and is repeated after any convergence fix.

## Parallel execution examples

### User Story 1

```text
Stream A: T007 → T009
Stream B: T008 → T010 → T011
```

### User Story 2

```text
Stream A: T012 → T014
Stream B: T013 → T015 → T016
```

### User Story 3

```text
Stream A: T017 → T021 → T022 → T023
Stream B: T018 → T023
Stream C: T019 → T022
Stream D: T020 → T024 → T025
Stream E: T026 → T028 → T029
Stream F: T027 → T030
```

Streams that edit the same file must be serialized; these examples identify conceptual ownership and dependency flow.

## Implementation strategy

1. Audit the baseline and establish the shared grouped-result contract.
2. Preserve and independently verify consultation and identity administration while implementing the API partial-success lifecycle behavior test-first.
3. Update the web mutation adapter and feedback components against the stable API result, then refactor shared mapping.
4. Run repository checks, browser coverage, cross-artifact analysis, and convergence before delivery review.

**Suggested MVP**: User Story 1 consultation plus the smallest vertical slice of User Story 3: grouped archive/reactivate partial success through the API and corresponding web blocker feedback. User Story 2 remains a required P1 slice and must stay green throughout.
