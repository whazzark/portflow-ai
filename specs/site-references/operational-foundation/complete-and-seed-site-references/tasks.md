# Tasks: Complete and Seed Operational Site References

**Input**: Design documents from `specs/site-references/operational-foundation/complete-and-seed-site-references/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/managed-reference-initialization.md`, `quickstart.md`

**Tests**: Tests are required by the Portflow constitution and this feature's acceptance criteria.
Within each story, write the observable test first, confirm RED for the intended missing behavior,
implement the minimum change, confirm GREEN, then refactor without weakening coverage.

**Organization**: Tasks are grouped by user story. US2 is implemented before US1 because the
storage lifecycle persistence it supplies is required by the coherent seven-reference dataset;
both stories remain Priority P1 and independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its stated prerequisites because it owns different files
- **[Story]**: Maps the task to US1, US2, or US3 from `spec.md`
- Every checklist item includes an exact repository-relative file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Make the existing seeder dependency order deterministic before behavior changes.

- [X] T001 Rename `apps/api/database/seeders/07_truck_seeder.ts` to `apps/api/database/seeders/08_truck_seeder.ts` so Warehouse Doors always seed before Trucks without duplicate numeric prefixes

---

## Phase 2: Foundational (Blocking Test Infrastructure)

**Purpose**: Establish the expected managed keys, fixed lifecycle facts, actor identity, and
geometry assertions used by every story test without duplicating the contract in implementation.

**⚠️ CRITICAL**: Complete this phase before starting a user story.

- [X] T002 Create reusable expected managed-key, fixed-timestamp, actor-email, relationship, and point-in-polygon test fixtures in `apps/api/tests/fixtures/site_reference_seeders.ts`

**Checkpoint**: Shared acceptance fixtures are ready; story tests can now drive behavior.

---

## Phase 3: User Story 2 - Preserve Complete Storage Lifecycle Context (Priority: P1)

**Goal**: Warehouses and Warehouse Doors reload with complete archive/reactivation occurrences,
comments, and nullable User actors while retaining permanent identity and containment.

**Independent Test**: Persist available, archived, and previously reactivated Warehouses and
Doors, reload them, resolve and delete lifecycle actors, and verify retained facts plus the rule
that an archived Warehouse contributes no available Door.

### Tests for User Story 2

> Write T003 first and confirm RED because storage lifecycle columns/model relations are missing.

- [X] T003 [US2] Add failing migration/model/factory persistence tests for available, archived, reactivated, actor-resolved, actor-deleted, permanent-containment, and archived-parent selector scenarios in `apps/api/tests/unit/database/storage_reference_lifecycle.spec.ts` and `apps/api/tests/unit/warehouse_doors/consultation/available.spec.ts`

### Implementation for User Story 2

- [X] T004 [US2] Add the six nullable lifecycle columns and `users.id` actor foreign keys with `ON DELETE SET NULL` to both storage tables in `apps/api/database/migrations/1785000000000_add_storage_reference_lifecycle_metadata.ts`
- [X] T005 [US2] Run the Lucid migration generator and verify the generated lifecycle properties in `apps/api/database/schema.ts`
- [X] T006 [P] [US2] Type the six lifecycle fields and add `archivedBy`/`reactivatedBy` User relations while preserving footprints and doors in `apps/api/app/models/warehouse.ts`
- [X] T007 [P] [US2] Type the six lifecycle fields and add `archivedBy`/`reactivatedBy` User relations while preserving permanent Warehouse containment in `apps/api/app/models/warehouse_door.ts`
- [X] T008 [P] [US2] Implement available, archived, and previously reactivated factory states with retained ordered archive/reactivation context in `apps/api/database/factories/warehouse_factory.ts`
- [X] T009 [P] [US2] Implement available, archived, and previously reactivated factory states with retained ordered archive/reactivation context in `apps/api/database/factories/warehouse_door_factory.ts`
- [X] T010 [US2] Run the focused lifecycle and available-door tests to GREEN and refactor the persistence mapping without changing consultation DTOs in `apps/api/tests/unit/database/storage_reference_lifecycle.spec.ts` and `apps/api/tests/unit/warehouse_doors/consultation/available.spec.ts`

**Checkpoint**: Storage references independently persist coherent lifecycle history and preserve
selector safety when the parent Warehouse is archived.

---

## Phase 4: User Story 1 - Start With Coherent Operational References (Priority: P1) 🎯 MVP

**Goal**: A clean supported environment contains coherent available, archived, and previously
reactivated scenarios for all seven reference kinds with valid actors, parents, and geography.

**Independent Test**: Run the complete seeder chain on an empty database, inspect all seven kinds,
verify lifecycle scenarios, Truck/company and Door/Warehouse relationships, polygon containment,
and then execute the existing consultation regression suites unchanged.

### Tests for User Story 1

> Write T011 first and confirm RED for the missing scenarios and storage lifecycle context.

- [X] T011 [US1] Add a failing clean-initialization contract test covering all seven lifecycle scenario sets, fixed actor references, Truck/company ownership, Door/Warehouse containment, coordinate ranges, footprint ordering, archived-parent safety, and the 60-second bound in `apps/api/tests/integration/database/site_reference_seeders.spec.ts`

### Implementation for User Story 1

- [X] T012 [P] [US1] Enrich the available, archived, and reactivated Customer declarations with fixed ordered lifecycle facts and the explicit demo actor in `apps/api/database/factories/customer_factory.ts` and `apps/api/database/seeders/02_customer_seeder.ts`
- [X] T013 [P] [US1] Enrich Transport Company declarations with fixed archive/reactivation facts and resolve `thomas.bernard@portflow.ai` deterministically in `apps/api/database/seeders/03_transport_company_seeder.ts`
- [X] T014 [P] [US1] Add the declared reactivated Dock scenario and complete fixed archive/reactivation facts and actor context in `apps/api/database/factories/dock_factory.ts` and `apps/api/database/seeders/04_dock_seeder.ts`
- [X] T015 [P] [US1] Add the declared archived and reactivated Weighing Area scenarios with valid coordinates, fixed lifecycle facts, and actor context in `apps/api/database/factories/weighing_area_factory.ts` and `apps/api/database/seeders/05_weighing_area_seeder.ts`
- [X] T016 [P] [US1] Add fixed complete lifecycle context to available, archived, and reactivated Warehouses while preserving each declared ordered footprint in `apps/api/database/seeders/06_warehouse_seeder.ts`
- [X] T017 [US1] Add fixed complete lifecycle context to available, archived, and reactivated Doors, require each declared Warehouse, and keep every Door within/on its footprint in `apps/api/database/seeders/07_warehouse_door_seeder.ts`
- [X] T018 [US1] Add fixed complete lifecycle context to Truck scenarios, resolve every declared Transport Company, and preserve positive capacities in `apps/api/database/seeders/08_truck_seeder.ts`
- [X] T019 [US1] Run the clean-initialization test and all existing site-reference consultation suites to GREEN without modifying routes, authorization, filters, ordering, transformers, response envelopes, or DTO fields in `apps/api/tests/integration/database/site_reference_seeders.spec.ts` and `apps/api/tests/integration/`

**Checkpoint**: A clean environment supplies the complete operational reference foundation and all
delivered read contracts remain compatible.

---

## Phase 5: User Story 3 - Repeat Initialization Without Drift (Priority: P2)

**Goal**: Repeated or recovery initialization converges the managed dataset without changing UUIDs,
parents, fixed history, or unrelated records and fails explicitly for missing/ambiguous parents.

**Independent Test**: Seed once, capture identities and facts, add unrelated rows and repairable
managed drift, seed again, then compare exact counts, UUIDs, parents, lifecycle occurrences,
coordinates, footprints, and unrelated rows; also resume after a deliberately interrupted run.

### Tests for User Story 3

> Extend the integration contract in T020 and confirm RED against the current create-or-skip paths.

- [X] T020 [US3] Add failing rerun, normalized-case match, managed-drift repair, unrelated-data preservation, missing/ambiguous-parent failure, stable-footprint, and interrupted-run recovery scenarios in `apps/api/tests/integration/database/site_reference_seeders.spec.ts`

### Implementation for User Story 3

- [X] T021 [P] [US3] Replace Customer create-or-skip behavior with normalized-code convergence that preserves UUIDs and repairs only declared managed fields in `apps/api/database/seeders/02_customer_seeder.ts`
- [X] T022 [P] [US3] Replace Transport Company create-or-skip behavior with normalized-name convergence and explicit multiple-match failure in `apps/api/database/seeders/03_transport_company_seeder.ts`
- [X] T023 [P] [US3] Replace Dock create-or-skip behavior with normalized-name convergence that preserves UUIDs and fixed lifecycle/geographic facts in `apps/api/database/seeders/04_dock_seeder.ts`
- [X] T024 [P] [US3] Replace Weighing Area create-or-skip behavior with normalized-name convergence that preserves UUIDs and fixed lifecycle/geographic facts in `apps/api/database/seeders/05_weighing_area_seeder.ts`
- [X] T025 [P] [US3] Converge each managed Warehouse in place and replace only its own footprint with the exact declared positions without touching unrelated Warehouses or points in `apps/api/database/seeders/06_warehouse_seeder.ts`
- [X] T026 [US3] Converge each Door by resolved Warehouse UUID plus normalized name, restore its declared parent/coordinates/lifecycle fields, and fail instead of skipping a missing parent in `apps/api/database/seeders/07_warehouse_door_seeder.ts`
- [X] T027 [US3] Converge each Truck by normalized registration, restore its declared company/scalars/lifecycle fields, and fail for missing or ambiguous providers in `apps/api/database/seeders/08_truck_seeder.ts`
- [X] T028 [US3] Run the two-pass and recovery initialization contract to GREEN and refactor duplicated convergence mechanics without expanding ownership beyond declared keys in `apps/api/tests/integration/database/site_reference_seeders.spec.ts` and `apps/api/database/seeders/`

**Checkpoint**: Two runs and interrupted-run recovery produce one stable managed dataset while
unrelated data remains untouched.

---

## Phase 6: Polish & Cross-Cutting Verification

**Purpose**: Prove compatibility on both supported database seams and prepare a reviewable delivery.

- [X] T029 Re-run and resolve the focused lifecycle, seeder, and complete existing consultation regressions documented in `specs/site-references/operational-foundation/complete-and-seed-site-references/quickstart.md`
- [X] T030 Validate `db:fresh` followed by `db:seed` on a disposable PostgreSQL database, including stable snapshots, unrelated-row preservation, generated schema, and the 60-second target from `specs/site-references/operational-foundation/complete-and-seed-site-references/contracts/managed-reference-initialization.md`
- [X] T031 Run `pnpm check`, `pnpm typecheck`, and `pnpm test`, then resolve every feature-related failure in `apps/api/` and `specs/site-references/operational-foundation/complete-and-seed-site-references/`
- [X] T032 Obtain a fresh read-only Codex review of the final diff and resolve or explicitly justify every confirmed finding against `specs/site-references/operational-foundation/complete-and-seed-site-references/spec.md` and `specs/site-references/operational-foundation/complete-and-seed-site-references/plan.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on T001 and blocks all story tests.
- **US2 (Phase 3, P1)**: Depends on Foundation and supplies the storage lifecycle schema/models used
  by the initialized Warehouse and Door scenarios.
- **US1 (Phase 4, P1)**: Depends on US2 and supplies the coherent empty-database foundation.
- **US3 (Phase 5, P2)**: Depends on US1's declared dataset and adds rerun/recovery convergence.
- **Polish (Phase 6)**: Depends on every selected story.

### User Story Dependency Graph

```text
Setup → Foundation → US2 (storage lifecycle) → US1 (coherent clean initialization)
                                                   → US3 (rerun convergence) → Polish
```

### Within Each User Story

- Write the story test and observe the expected RED state before implementation.
- For US2, migrate and regenerate schema before models; models precede their respective factories.
- For US1, parent seeders must be runnable before Warehouse Doors and Trucks.
- For US3, rerun/recovery tests precede convergence changes; validate the entire ordered chain only
  after every resource-specific convergence path is implemented.
- Complete each checkpoint before depending on its output from the next phase.

### Parallel Opportunities

- After T005, T006 and T007 can run in parallel; T008 and T009 can then run in parallel on their
  respective model tracks.
- After T011 is RED, T012–T016 can run in parallel because they own separate factories/seeders;
  T017 follows T016 and T018 follows T013 for parent-first validation.
- After T020 is RED, T021–T025 can run in parallel; Door and Truck convergence follow their parent
  seeders before T028 validates the full chain.
- T029 documentation-driven regression verification can be prepared while the disposable
  PostgreSQL environment for T030 is provisioned, but final results must reflect the same diff.

## Parallel Example: User Story 2

```text
Task T006: Warehouse lifecycle model in apps/api/app/models/warehouse.ts
Task T007: Warehouse Door lifecycle model in apps/api/app/models/warehouse_door.ts

After those models:
Task T008: Warehouse lifecycle factory in apps/api/database/factories/warehouse_factory.ts
Task T009: Warehouse Door lifecycle factory in apps/api/database/factories/warehouse_door_factory.ts
```

## Parallel Example: User Story 1

```text
Task T012: Customer lifecycle dataset
Task T013: Transport Company lifecycle dataset
Task T014: Dock lifecycle dataset
Task T015: Weighing Area lifecycle dataset
Task T016: Warehouse lifecycle dataset
```

## Parallel Example: User Story 3

```text
Task T021: Customer convergence
Task T022: Transport Company convergence
Task T023: Dock convergence
Task T024: Weighing Area convergence
Task T025: Warehouse and footprint convergence
```

## Implementation Strategy

### MVP First: Priority-P1 Foundation

1. Complete Setup and Foundation.
2. Complete US2 with RED → GREEN lifecycle persistence tests.
3. Complete US1 with RED → GREEN clean-initialization and consultation tests.
4. **STOP AND VALIDATE**: the combined P1 scope is the minimum useful operational-reference MVP;
   US2 alone is independently testable but US1 is the product outcome consumed by later epics.

### Incremental Delivery

1. Setup + Foundation → deterministic order and shared test seam.
2. US2 → complete storage lifecycle persistence, independently verified.
3. US1 → coherent clean initialization for all seven kinds, independently verified.
4. US3 → deterministic rerun and recovery convergence, independently verified.
5. Polish → PostgreSQL validation, repository gates, and fresh review.

### Parallel Team Strategy

1. Complete Setup, Foundation, and the US2 schema generator step serially.
2. Split Warehouse and Warehouse Door model/factory tracks after schema generation.
3. Split independent resource seeders during US1, then join for child seeders and integration tests.
4. Split independent convergence edits during US3, then join for the two-pass contract.

## Notes

- `[P]` tasks never edit the same file in the same phase and begin only after their shared prerequisite.
- No task creates or changes a route, controller, policy, use case, transformer, Tuyau DTO, or web file.
- Generated `apps/api/database/schema.ts` is refreshed through Lucid and not hand-edited.
- Commit after each task or coherent RED/GREEN/refactor group using Conventional Commits.
- Do not run `db:fresh` against any database containing valued data.
