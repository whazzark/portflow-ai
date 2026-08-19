# Tasks: Enforce Persisted Site-Reference Usage Rules

**Input**: Design documents from `/specs/site-references/operational-foundation/enforce-persisted-site-reference-usage-rules/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/persisted-site-reference-usage.md, quickstart.md

**Tests**: Required by the repository constitution and this feature's approved TDD plan. Add each
observable test first, run it before implementation, and confirm the expected failure. If a case is
already green because issue #236 delivered part of the behavior, retain it as explicit regression
evidence and continue with the still-failing acceptance cases.

**Organization**: Tasks are grouped by user story so each business increment can be implemented and
validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its phase prerequisites because it changes a different file.
- **[Story]**: Maps the task to a user story from spec.md.
- Every task names the exact repository path it reads, creates, updates, deletes, or validates.

## Phase 1: Setup (Baseline)

**Purpose**: Establish the current behavioral baseline before adding tests or changing the usage
seam.

- [X] T001 Run the existing archive suites as a baseline and record any pre-existing failures before editing `apps/api/tests/integration/customers/lifecycle/archive.spec.ts`, `apps/api/tests/integration/customers/lifecycle/bulk/archive.spec.ts`, `apps/api/tests/integration/docks.spec.ts`, or `apps/api/tests/integration/weighing_areas.spec.ts`

---

## Phase 2: Foundational (Shared Test Infrastructure)

**Purpose**: Provide reusable persisted Discharge arrangements and a real-checker test harness used
by every user story.

**⚠️ CRITICAL**: Complete this phase before starting user-story tests.

- [X] T002 Create reusable Planned, Active, Closed, current, ended, and released Discharge graph builders with existing factories in `apps/api/tests/support/persisted_discharge_usage.ts`

**Checkpoint**: All stories can arrange authoritative persisted usage without duplicating a second
domain model.

---

## Phase 3: User Story 1 - Prevent Archiving References Required by Current Discharges (Priority: P1) 🎯 MVP

**Goal**: Existing Customer, Dock, and Weighing Area archive journeys use authoritative Planned or
Active Discharge state, return their established conflicts, and leave blocked references unchanged.

**Independent Test**: Persist qualifying current usage for each protected reference, call the
existing single and Customer bulk archive routes as an authorized administrator, and verify the
established conflict outcome and unchanged lifecycle fields.

### Tests for User Story 1

> Write and run these tests before the implementation task. Retain already-green #236 behavior as
> regression evidence; the complete story is not accepted until every case uses real persisted
> state rather than a checker test double.

- [X] T004 [P] [US1] Replace the single-Customer in-use test double with Planned and Active Product Lot arrangements and assert `409 E_CUSTOMER_IN_USE` plus unchanged lifecycle fields in `apps/api/tests/integration/customers/lifecycle/archive.spec.ts`
- [X] T005 [P] [US1] Replace the Customer bulk in-use test double with a mixed persisted used-and-eligible arrangement and assert `200`, request-ordered `IN_USE` blockers, and eligible archival in `apps/api/tests/integration/customers/lifecycle/bulk/archive.spec.ts`
- [X] T006 [P] [US1] Add persisted Planned and Active Dock archive conflict cases asserting `409 E_DOCK_IN_USE` and unchanged lifecycle fields in `apps/api/tests/integration/docks.spec.ts`
- [X] T007 [P] [US1] Add persisted current Shift-membership Weighing Area archive conflict cases asserting `409 E_WEIGHING_AREA_IN_USE` and unchanged lifecycle fields in `apps/api/tests/integration/weighing_areas.spec.ts`

### Implementation for User Story 1

- [X] T009 [US1] Remove the obsolete unconditional-unused adapter at `apps/api/app/site_references/shared/no_discharge_site_reference_usage_checker.ts` and verify the sole production binding remains persisted in `apps/api/providers/repositories_provider.ts`
- [X] T010 [US1] Run the five User Story 1 integration targets from `specs/site-references/operational-foundation/enforce-persisted-site-reference-usage-rules/quickstart.md` and resolve failures only in the files owned by T004-T009

**Checkpoint**: Current persisted Customer, Dock, and Weighing Area usage blocks all existing
archive journeys with unchanged public contracts. This is the suggested MVP.

---

## Phase 4: User Story 2 - Release References When Operational Usage Ends (Priority: P1)

**Goal**: Closed Discharges and explicitly ended or released relationships remain readable history
without qualifying as current usage for any of the five supported reference kinds.

**Independent Test**: Assess Customers, Docks, Weighing Areas, Warehouse Doors, and Trucks across
Planned, Active, and Closed Discharges, end or release applicable relationships while the parent
remains current, and verify only non-released Planned/Active usage is returned.

### Tests for User Story 2

- [X] T013 [P] [US2] Add a Closed-only Product Lot scenario that allows Customer archival through persisted state in `apps/api/tests/integration/customers/lifecycle/archive.spec.ts`
- [X] T014 [P] [US2] Add a Closed-only Dock scenario that allows archival through persisted state in `apps/api/tests/integration/docks.spec.ts`
- [X] T015 [P] [US2] Add ended-membership and Closed-only Weighing Area scenarios that allow archival through persisted state in `apps/api/tests/integration/weighing_areas.spec.ts`

### Implementation for User Story 2

- [X] T016 [US2] Add `TRUCK` to the exhaustive reference-kind contract in `apps/api/app/site_references/shared/site_reference_usage_checker.ts`
- [X] T017 [US2] Replace catch-all routing with exhaustive five-type dispatch and implement the Product Lot, Dock, current Weighing Area membership, current Warehouse Door assignment, and unreleased Truck reservation predicates in `apps/api/app/discharges/shared/repositories/lucid_discharge_usage_repository.ts`
- [X] T018 [US2] Run the persisted usage matrix and affected archive suites from `specs/site-references/operational-foundation/enforce-persisted-site-reference-usage-rules/quickstart.md` and resolve failures only in files owned by T011-T017

**Checkpoint**: All five reference kinds distinguish current usage from retained historical state,
and applicable existing archive journeys succeed after release.

---

## Phase 5: User Story 3 - Reuse One Deterministic Usage Decision Across Reference Workflows (Priority: P2)

**Goal**: Every supported caller receives the same distinct, stable usage Set for the same state;
empty input performs no read and non-empty bulk input performs one bounded read.

**Independent Test**: Assess up to 1,000 mixed used, unused, unknown, duplicated, and reordered
identifiers for each reference kind, verify stable lexical Set output, one SELECT per non-empty
assessment, zero SELECTs for empty input, and completion within two seconds.

### Tests for User Story 3


### Implementation for User Story 3

- [X] T021 [US3] Deduplicate requested identifiers before persistence access, short-circuit empty input, and return lexically sorted distinct IDs while preserving the optional transaction client in `apps/api/app/discharges/shared/repositories/lucid_discharge_usage_repository.ts`
- [X] T022 [P] [US3] Add portable `discharges(dock_id, status)` and `product_lots(customer_id, discharge_id)` indexes with reversible down operations in `apps/api/database/migrations/1785100000000_add_site_reference_usage_indexes.ts`
- [ ] T023 [US3] Validate the index migration through disposable fresh, rollback, and re-application runs documented in `specs/site-references/operational-foundation/enforce-persisted-site-reference-usage-rules/quickstart.md`
- [X] T024 [US3] Run the deterministic contract and scale suites from `specs/site-references/operational-foundation/enforce-persisted-site-reference-usage-rules/quickstart.md` and resolve failures only in files owned by T019-T023

**Checkpoint**: The internal usage contract is deterministic, set-based, transaction-compatible,
and ready for later Truck and Warehouse Door lifecycle workflows without new product surface.

---

## Phase 6: Polish & Cross-Cutting Verification

**Purpose**: Consolidate test setup, validate the full repository, and satisfy delivery gates.

- [X] T025 Refactor duplicated graph arrangements without changing behavior in `apps/api/tests/support/persisted_discharge_usage.ts`
- [ ] T026 Run every focused scenario and migration check in `specs/site-references/operational-foundation/enforce-persisted-site-reference-usage-rules/quickstart.md`
- [X] T027 Run `pnpm check` and resolve formatting or lint findings in `apps/api/` and `specs/site-references/operational-foundation/enforce-persisted-site-reference-usage-rules/`
- [X] T028 Run `pnpm typecheck` and resolve type failures in `apps/api/`
- [ ] T029 Run `pnpm test` and resolve regressions in `apps/api/` and other affected workspace test paths
- [X] T030 Obtain a fresh read-only Codex review of the final diff under `apps/api/` and `specs/site-references/operational-foundation/enforce-persisted-site-reference-usage-rules/`, then resolve or explicitly justify every confirmed finding before PR readiness

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependency; establishes the baseline.
- **Foundational (Phase 2)**: Depends on T001 and blocks every user story.
- **User Story 1 (Phase 3)**: Depends on T002-T003; no dependency on another story.
- **User Story 2 (Phase 4)**: Depends on T002-T003; no behavioral dependency on US1, though a
  sequential implementation avoids simultaneous edits to the shared usage suite.
- **User Story 3 (Phase 5)**: Depends on US2 because it hardens and scales the complete five-type
  query introduced by T016-T017.
- **Polish (Phase 6)**: Depends on all selected stories.

### User Story Dependency Graph

```text
Setup → Foundation ─┬─→ US1 (current archive blockers / MVP)
                    └─→ US2 (five-type release rules) → US3 (determinism and scale)

US1 + US2 + US3 → Polish and delivery verification
```

### Within Each User Story

- Write observable tests first and run them before the corresponding production task.
- Complete the smallest checker/repository change that makes the new tests green.
- Refactor only after the focused story suite is green.
- Run the story checkpoint before advancing to the next dependent story.

### Parallel Opportunities

- After T003, T004-T007 can proceed in parallel because each changes a separate archive test file.
- After T003, T011 and T013-T015 can proceed in parallel; schedule T012 after T011 because both
  update the shared persisted-usage suite.
- T016 can be prepared while T013-T015 are written, but T017 waits until the RED usage tests exist.
- T019 and T020 can proceed in parallel because they change different test files.
- After T019-T020 are RED, T021 and T022 can proceed in parallel because query logic and migration
  indexes live in different files.
- T027 and T028 run sequentially after T026 so any required fixes cannot overlap.

---

## Parallel Example: User Story 1

```text
Task T004: Persisted Customer single-archive conflict tests
Task T005: Persisted Customer bulk-archive mixed-outcome test
Task T006: Persisted Dock archive conflict tests
Task T007: Persisted Weighing Area archive conflict tests
```

## Parallel Example: User Story 2

```text
Task T011: Five-type lifecycle matrix in the shared usage suite
Task T013: Closed-only Customer archive success
Task T014: Closed-only Dock archive success
Task T015: Ended/Closed Weighing Area archive success
```

## Parallel Example: User Story 3

```text
Task T019: Deterministic Set contract tests
Task T020: Query-count and 1,000-identifier scale tests

After both tests are RED:
Task T021: Bulk normalization and stable Set implementation
Task T022: Dock and Customer usage indexes
```

---

## Implementation Strategy

### MVP First: User Story 1

1. Complete T001-T003.
2. Complete T004-T010 using persisted arrangements rather than checker doubles.
3. Stop and validate the five focused targets in quickstart.md.
4. Demonstrate that current Planned/Active usage produces the established archive conflicts and
   leaves references unchanged.

### Incremental Delivery

1. **US1**: Make existing archive blockers trustworthy against persisted state.
2. **US2**: Complete all five reference kinds and historical release semantics.
3. **US3**: Guarantee deterministic bulk behavior, bounded query count, and scale.
4. **Polish**: Run the complete quality gates and fresh review.

### Parallel Team Strategy

1. Complete the baseline and shared test infrastructure together.
2. In parallel, prepare the four US1 HTTP test files while another contributor prepares the US2
   matrix; serialize changes to the shared persisted-usage spec.
3. After the five-type query is green, parallelize deterministic contract tests, scale tests, and
   the independent index migration.
4. Rejoin for quickstart, repository-wide verification, and fresh final review.

---

## Notes

- `[P]` means the task changes a different file and has no dependency on an incomplete task in its
  phase.
- Unit tests that isolate archive use cases with explicit checker doubles may remain; acceptance
  evidence for this issue must use the production persisted path.
- Truck usage comes from Discharge Truck reservations, not Shift Truck memberships.
- Warehouse Door usage comes from Product Lot assignments, not Shift Warehouse Door memberships.
- Do not add a usage endpoint, Truck archive endpoint, Warehouse Door archive endpoint, controller,
  transformer, frontend route, or UI.
- Keep commits focused and use Conventional Commits when implementation begins.
