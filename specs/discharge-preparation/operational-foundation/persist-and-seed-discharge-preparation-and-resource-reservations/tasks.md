---

description: "Executable implementation tasks for Discharge preparation persistence and seeds"
---

# Tasks: Persist and Seed Discharge Preparation and Resource Reservations

**Input**: Design documents from `specs/discharge-preparation/operational-foundation/persist-and-seed-discharge-preparation-and-resource-reservations/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Tests**: Required by the Portflow constitution. Business behavior follows RED → GREEN → REFACTOR;
test tasks below must be written and observed failing before their implementation tasks.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the feature-specific paths and deterministic fixture boundary without adding
user-facing routes.

- [X] T001 [P] Create the Discharge preparation test directories and shared fixture entrypoint in `apps/api/tests/unit/discharges/`, `apps/api/tests/integration/database/`, and `apps/api/database/fixtures/index.ts`.
- [X] T002 [P] Define fixed scenario identifiers, reference timestamps, business keys, and UUID-only relations in the per-domain files under `apps/api/database/fixtures/`.
- [X] T003 Confirm issue #235 site-reference seed ordering and document the dependency in `apps/api/database/seeders/09_discharge_preparation_seeder.ts` before implementation; do not add a route or frontend entrypoint.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the portable persistence and model foundation required by every user story.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

### Tests first

- [X] T004 [P] Add a failing migration contract test for all Discharge preparation tables, foreign keys, scalar checks, unique keys, and timestamp columns in `apps/api/tests/integration/database/discharge_preparation_schema.spec.ts`.
- [X] T005 [P] Add failing model persistence tests for Discharge/Product Lot ownership, Shift responsibility, Door-to-Product-Lot consistency, and explicit resource memberships in `apps/api/tests/unit/discharges/models/persistence.spec.ts`.

### Persistence and models

- [ ] T006 Implement the portable schema for Discharges, Product Lots, Discharge Truck Assignments, Shifts, Door-to-Product-Lot assignments, and the three explicit Shift membership tables in the per-table migrations `apps/api/database/migrations/1785000000000_create_discharges_table.ts` through `1785000000007_create_shift_weighing_areas_table.ts`.
- [ ] T007 Regenerate the Lucid schema registry from the new migration and verify `apps/api/database/schema.ts` contains every model column with correct nullable and datetime types.
- [ ] T008 [P] Implement the Discharge model and lifecycle constants/relationships in `apps/api/app/models/discharge.ts`.
- [ ] T009 [P] Implement the Product Lot model and Discharge/Customer relationships in `apps/api/app/models/product_lot.ts`.
- [ ] T010 [P] Implement the Discharge Truck Assignment model with registration/provider snapshots and reservation relationships in `apps/api/app/models/discharge_truck_assignment.ts`.
- [ ] T011 [P] Implement the Shift model with planned/active/completed state, ordered time range, responsible User, and Discharge relationships in `apps/api/app/models/shift.ts`.
- [ ] T012 [P] Implement the Door-to-Product-Lot assignment model and consistency relationships in `apps/api/app/models/warehouse_door_product_lot_assignment.ts`.
- [ ] T013 [P] Implement explicit Shift Truck, Shift Warehouse Door, and Shift Weighing Area membership models in `apps/api/app/models/shift_truck.ts`, `apps/api/app/models/shift_warehouse_door.ts`, and `apps/api/app/models/shift_weighing_area.ts`.
- [ ] T014 [P] Add focused factories with explicit foreign-key injection and lifecycle states in `apps/api/database/factories/discharge_factory.ts`, `apps/api/database/factories/product_lot_factory.ts`, `apps/api/database/factories/discharge_truck_assignment_factory.ts`, `apps/api/database/factories/shift_factory.ts`, and `apps/api/database/factories/shift_resource_membership_factories.ts`.

### Foundation checkpoint

- [ ] T015 Run the migration contract and model persistence tests from `apps/api/tests/integration/database/discharge_preparation_schema.spec.ts` and `apps/api/tests/unit/discharges/models/persistence.spec.ts`; keep the phase blocked until the schema and model invariants are green.

---

## Phase 3: User Story 1 - Rely on Coherent Discharge Preparation Scenarios (Priority: P1) 🎯 MVP

**Goal**: Initialize complete Planned, Active, and Closed Discharge graphs with valid relationships
and focused scenario factories.

**Independent Test**: Run the managed seeder on an empty environment, inspect all three lifecycle
graphs and their required relationships, and verify the focused factories can construct one valid
graph without a user-facing creation flow.

### Tests first

- [ ] T016 [P] [US1] Add a failing initial-seed integration test for Planned, Active, and Closed graph completeness in `apps/api/tests/integration/database/discharge_preparation_seeders.spec.ts`.
- [ ] T017 [P] [US1] Add failing focused factory tests for one valid graph per lifecycle scenario in `apps/api/tests/unit/discharges/factories/discharge_preparation_factories.spec.ts`.
- [ ] T018 [P] [US1] Add failing invalid-graph tests for missing/ambiguous parents, Product Lot ownership mismatch, Door mismatch, and invalid Shift timing in `apps/api/tests/integration/database/discharge_preparation_seeders.spec.ts`.

### Implementation

- [ ] T019 [US1] Implement explicit parent resolution with descriptive missing-reference failures in `apps/api/database/seeders/09_discharge_preparation_seeder.ts`.
- [ ] T020 [US1] Implement the Planned graph creation/repair flow with vessel, Dock, Product Lots, Door assignments, truck reservations, Shifts, responsibles, and explicit Shift memberships in `apps/api/database/seeders/09_discharge_preparation_seeder.ts`.
- [ ] T021 [US1] Implement the Active graph creation/repair flow with a consistent active Discharge/Shift state and effective resource memberships in `apps/api/database/seeders/09_discharge_preparation_seeder.ts`.
- [ ] T022 [US1] Implement the Closed graph creation/repair flow with complete historical assignments and released current reservations in `apps/api/database/seeders/09_discharge_preparation_seeder.ts`.
- [ ] T023 [US1] Register the deterministic seeder after the site-reference seeders and ensure it runs only in supported development/test environments in `apps/api/database/seeders/09_discharge_preparation_seeder.ts`.
- [ ] T024 [US1] Complete the RED → GREEN assertions for graph completeness, lifecycle consistency, and focused factory construction in `apps/api/tests/integration/database/discharge_preparation_seeders.spec.ts` and `apps/api/tests/unit/discharges/factories/discharge_preparation_factories.spec.ts`.

**Checkpoint**: An empty supported environment contains one coherent Planned, Active, and Closed
graph and no mutation endpoint or interface has been introduced.

---

## Phase 4: User Story 2 - Preserve Historical Resource and Material Context (Priority: P1)

**Goal**: Preserve reservation snapshots, Door/Product Lot history, and explicit effective Shift
memberships while making Planned/Active resource usage visible to existing lifecycle protection.

**Independent Test**: Seed a graph, mutate current Truck/provider/site-reference values, reload the
Discharge graph, and verify snapshots/history remain unchanged; then verify Planned/Active references
are blocked from archival while Closed-only references are not.

### Tests first

- [ ] T025 [P] [US2] Add failing snapshot persistence tests for Truck registration/provider values and historical Door/Product Lot assignments in `apps/api/tests/unit/discharges/models/historical_context.spec.ts`.
- [ ] T026 [P] [US2] Add failing effective-membership tests proving each Shift owns explicit Truck, Door, and Weighing Area memberships without implicit inheritance in `apps/api/tests/unit/discharges/models/shift_memberships.spec.ts`.
- [ ] T027 [P] [US2] Add failing persisted site-reference usage tests for Customer, Dock, and Weighing Area Planned/Active blockers and Closed-only release behavior in `apps/api/tests/integration/site_references/persisted_discharge_usage.spec.ts`.

### Implementation

- [ ] T028 [US2] Complete historical snapshot columns, serialization, and relationship loading for Discharge Truck Assignments and Door-to-Product-Lot assignments in `apps/api/app/models/discharge_truck_assignment.ts` and `apps/api/app/models/warehouse_door_product_lot_assignment.ts`.
- [ ] T029 [US2] Implement effective-period membership queries and consistency validation for Shift Trucks, Shift Warehouse Doors, and Shift Weighing Areas in `apps/api/app/discharges/shared/repositories/lucid_discharge_usage_repository.ts`.
- [ ] T030 [US2] Replace the transitional no-op site-reference adapter with the persistence-backed usage checker in `apps/api/app/site_references/shared/persisted_site_reference_usage_checker.ts` and update its binding/imports where required.
- [ ] T031 [US2] Add persisted usage queries for Customer, Dock, Warehouse Door, and Weighing Area references used by Planned or Active Discharges in `apps/api/app/discharges/shared/repositories/lucid_discharge_usage_repository.ts`.
- [ ] T032 [US2] Complete the RED → GREEN snapshot, membership, and archive-protection assertions in `apps/api/tests/unit/discharges/models/historical_context.spec.ts`, `apps/api/tests/unit/discharges/models/shift_memberships.spec.ts`, and `apps/api/tests/integration/site_references/persisted_discharge_usage.spec.ts`.

**Checkpoint**: Historical preparation context survives current reference changes, and existing
site-reference lifecycle use cases observe real Planned/Active usage without blocking Closed-only
history.

---

## Phase 5: User Story 3 - Rebuild Focused and Repeatable Preparation Data (Priority: P2)

**Goal**: Make managed initialization deterministic, idempotent, drift-repairing, and safe across
partial failures while preserving unrelated records.

**Independent Test**: Run initialization three times, inject managed drift and unrelated records,
force a failure in one graph, rerun after correction, and compare stable identities and relationships.

### Tests first

- [ ] T033 [P] [US3] Add failing idempotence/drift tests covering three seed runs, stable identities, repaired managed values, and preserved unrelated records in `apps/api/tests/integration/database/discharge_preparation_seeders.spec.ts`.
- [ ] T034 [P] [US3] Add a failing per-graph transaction recovery test that interrupts one scenario and verifies no partial relationship is accepted while previously completed graphs remain valid in `apps/api/tests/integration/database/discharge_preparation_seeders.spec.ts`.
- [ ] T035 [P] [US3] Add failing reservation-conflict tests for duplicate unreleased Truck, Door, and Shift resource usage across Planned/Active graphs in `apps/api/tests/unit/discharges/reservation_invariants.spec.ts`.

### Implementation

- [ ] T036 [US3] Add key-based upsert/repair helpers for managed Discharges, Product Lots, assignments, Shifts, and memberships using the fixed fixture IDs in `apps/api/database/seeders/09_discharge_preparation_seeder.ts`.
- [ ] T037 [US3] Wrap each Planned, Active, and Closed graph initialization in its own transaction and make failure messages identify the graph and missing dependency in `apps/api/database/seeders/09_discharge_preparation_seeder.ts`.
- [ ] T038 [US3] Implement portable atomic reservation/conflict validation for unreleased Planned/Active Truck, Door, and Shift resource usage in `apps/api/app/discharges/shared/repositories/lucid_discharge_usage_repository.ts`.
- [ ] T039 [US3] Complete the RED → GREEN idempotence, drift, recovery, and reservation-conflict assertions in `apps/api/tests/integration/database/discharge_preparation_seeders.spec.ts` and `apps/api/tests/unit/discharges/reservation_invariants.spec.ts`.

**Checkpoint**: Repeated initialization converges without duplicates, unrelated records are preserved,
failed graphs are recoverable, and current resource conflicts are rejected atomically.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify the complete feature and keep the design/implementation artifacts aligned.

- [ ] T040 [P] Regenerate `apps/api/database/schema.ts` and generated registries after the final migration/model changes, then verify no generated file is stale.
- [ ] T041 [P] Add or update the shared fixture catalog in `apps/api/database/fixtures/discharge_preparation.ts` to document managed scenario keys and historical snapshot expectations.
- [ ] T042 Run the validation guide in `specs/discharge-preparation/operational-foundation/persist-and-seed-discharge-preparation-and-resource-reservations/quickstart.md`, including migration fresh/seed twice and the full API suite.
- [ ] T043 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the repository root; record any unrelated workspace dependency blocker without weakening the API validation.
- [ ] T044 [P] Review the final diff against `spec.md`, `plan.md`, `data-model.md`, and `contracts/managed-preparation-initialization.md`; resolve confirmed scope, integrity, and test-coverage findings before review.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies; T001–T003 can proceed in parallel where files do not overlap.
- **Phase 2 (Foundational)**: Depends on Phase 1; T004–T005 are RED tests and T006–T014 implement the shared persistence surface. T015 is the gate before story work.
- **Phase 3 (US1)**: Depends on Phase 2; delivers the MVP seed graphs and focused factory construction.
- **Phase 4 (US2)**: Depends on Phase 3 because snapshot and usage tests consume the managed graphs, although T025–T027 can be written in parallel.
- **Phase 5 (US3)**: Depends on Phase 3 and the historical model surface from Phase 4; tests can be written in parallel before implementation.
- **Phase 6 (Polish)**: Depends on all desired user stories being green.

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational; independently delivers coherent lifecycle graphs and is the MVP.
- **US2 (P1)**: Depends on Foundational and the US1 managed fixture catalog; adds historical snapshots and persisted usage protection.
- **US3 (P2)**: Depends on US1 graph creation and US2 reservation/history semantics; hardens repeatability and recovery.

### Parallel Execution Examples

#### Setup and Foundational

```text
T001, T002, T003 can be prepared in parallel.
T004 and T005 can be written in parallel as RED tests.
After T006/T007, T008–T014 can be split by model/factory files where no file is shared.
```

#### User Story 1

```text
T016, T017, and T018 can be written in parallel before implementation.
T019 can proceed alongside the focused factory implementation in T014.
T020, T021, and T022 must share the seeder file and should be applied sequentially.
```

#### User Story 2

```text
T025, T026, and T027 can be written in parallel as RED tests.
T028 and T029 can proceed in parallel because they touch model/repository boundaries separately.
T030 and T031 should be sequenced after the repository query shape is agreed.
```

#### User Story 3

```text
T033, T034, and T035 can be written in parallel as RED tests.
T036 and T037 share the seeder and must be sequenced.
T038 can proceed in parallel with the seeder hardening once the invariant inputs are stable.
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Setup and Foundational phases, including RED schema/model tests.
2. Implement the Discharge preparation models and focused factories.
3. Implement and test the Planned, Active, and Closed deterministic graphs.
4. Stop and validate US1 independently with the empty-environment seed test and migration checks.

### Incremental Delivery

1. Add US1 coherent graphs and factory scenarios.
2. Add US2 historical snapshots and persisted resource usage protection.
3. Add US3 idempotence, drift repair, per-graph transaction recovery, and conflict hardening.
4. Run the complete quickstart and repository verification before review.

### Notes

- `[P]` tasks touch different files and have no dependency on incomplete work.
- Every task has a sequential ID, a checkbox, required story labels for story phases, and concrete
  repository paths.
- No task introduces an API route or frontend component; those remain later feature slices.
