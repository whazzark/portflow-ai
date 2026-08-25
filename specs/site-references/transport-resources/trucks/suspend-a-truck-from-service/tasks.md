---
description: "Task list for Suspend a Truck From Service (GH-252)"
---

# Tasks: Suspend a Truck From Service

**Input**: Design documents from `specs/site-references/transport-resources/trucks/suspend-a-truck-from-service/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [quickstart.md](./quickstart.md)

**Tests**: Included and mandatory. Constitution principle IV requires RED → GREEN → REFACTOR for all business behavior; every acceptance scenario maps to an observable test.

**Organization**: Tasks are grouped by user story. Each story phase is a complete, independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: `[US1]`–`[US4]`, mapping to the four user stories in spec.md
- Every task names the exact file or command it acts on

## Path Conventions

Monorepo per [plan.md](./plan.md): API in `apps/api/`, web in `apps/web/src/`. All paths below are repository-relative.

---

## Phase 1: Setup

**Purpose**: Establish a trustworthy baseline and clear the human gates before any code changes.

- [X] T001 Record a green baseline by running `pnpm --filter @portflow/api test` and `pnpm --dir apps/web exec vitest run src/features/trucks`; note the passing counts so the regressions introduced in Phase 5 are provably new
- [X] T002 Clear the plan-review gate on the three open points in the "Post-design re-evaluation" section of [plan.md](./plan.md): the dead-end state until `#253`, the three unshippable rotation scenarios, and whether suspended trucks stay non-editable — a human decision, not a code change

**Checkpoint**: Baseline recorded, product boundaries confirmed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, model, and shared contract types. Nothing behavioural — but nothing in Phases 3–6 compiles without it.

**⚠️ CRITICAL**: T003 is the riskiest artifact in the slice. Research [D2](./research.md) records why knex's `.alter()` must not be used: it reports success on SQLite while leaving the old two-value check in place, and emits malformed SQL on PostgreSQL.

- [X] T003 Create the dialect-branched migration `apps/api/database/migrations/1785300000000_add_truck_suspension.ts` with `static disableTransactions = true`: add `suspended_at`, `suspended_by_user_id` (FK → `users.id`, `ON DELETE SET NULL`), and `suspension_comment`; widen the `trucks.status` check to `('AVAILABLE','ARCHIVED','SUSPENDED')` via a `pg_constraint` lookup on PostgreSQL and a manual table rebuild on SQLite; add `CHECK (status != 'SUSPENDED' OR suspended_at IS NOT NULL)`. Follow the verified recipe and carry the dialect comment, as `1785200000000_add_transport_companies_contact_details.ts` does
- [X] T004 Verify T003 against a real PostgreSQL with `pnpm --filter @portflow/api db:migrate`, `db:rollback`, `db:migrate`, then assert directly: exactly one status check admitting three values, the paired `suspended_at` check present, `trucks_registration_unique` and `trucks_status_index` intact, `SUSPENDED` without `suspended_at` refused, a bogus status refused, and rollback restoring the two-value constraint. The SQLite-only test suite structurally cannot cover this (quickstart step 1b)
- [X] T005 Regenerate `apps/api/database/schema.ts` with `pnpm --filter @portflow/api db:migrate` — generated file, never hand-edited
- [X] T006 Widen `TRUCK_STATUSES` to `['AVAILABLE','ARCHIVED','SUSPENDED']` and declare `suspendedAt`, `suspendedByUserId`, `suspensionComment`, plus a `suspendedBy` `belongsTo(User)` relation, in `apps/api/app/models/truck.ts`
- [X] T007 Add `SuspendTruckCommand` and `SuspendTruckResult` (`SUSPENDED` | `ALREADY_SUSPENDED` | `ARCHIVED` | `NOT_FOUND`), declare the abstract `suspendAvailable`, and widen `ArchiveTruckResult`, `ReactivateTruckResult`, and `TruckWriteResult` with their `SUSPENDED` kinds in `apps/api/app/trucks/shared/repositories/truck_repository.ts`
- [X] T008 Widen `TruckLifecycleRecord.status` to the three-value union and add `'SUSPENDED'` to `BulkTruckLifecycleBlocker.reason` in `apps/api/app/trucks/shared/truck_lifecycle_blockers.ts` — required for compilation once T006 lands, since `indexTrucksById` maps `Truck` onto this record
- [X] T009 [P] Add `TruckAlreadySuspendedException` (409, `E_TRUCK_ALREADY_SUSPENDED`), `TruckArchivedCannotSuspendException` (409, `E_TRUCK_ARCHIVED_CANNOT_SUSPEND`), and `SuspendedTruckReadOnlyException` (409, `E_TRUCK_SUSPENDED`) in `apps/api/app/trucks/shared/truck_exceptions.ts`
- [X] T010 [P] Add the `suspend` method to `apps/api/app/trucks/shared/truck_policy.ts`, matching the two-administrator pattern of `archive` and `reactivate`
- [X] T011 [P] Add `suspendTruckValidator` reusing the shared `lifecycleComment()` rule in `apps/api/app/trucks/shared/truck_validator.ts`
- [X] T012 [P] Expose `suspendedAt`, `suspendedByUserId`, `suspensionComment`, and a `suspendedBy` summary in `apps/api/app/trucks/shared/truck_transformer.ts`, symmetric with the archive and reactivation blocks
- [X] T013 [P] Add a `suspended` state to `apps/api/database/factories/truck_factory.ts`
- [X] T014 [P] Append a fifth truck fixture in a `suspended` state and reword the reactivated truck's archive comment away from `"Vehicle temporarily suspended for fleet maintenance"` in `apps/api/database/fixtures/trucks.ts`, declaring the suspended lifecycle shape locally — `database/fixtures/shared.ts` serves every site reference and must NOT gain `SUSPENDED` (research [D8](./research.md))
- [X] T015 [P] Add a suspended-truck scenario helper to `apps/api/tests/support/trucks/lifecycle_fixtures.ts`, beside `createReservedTruckScenario`
- [X] T016 [P] Widen `TruckLifecycle` to `'available' | 'suspended' | 'archived'` in `apps/web/src/features/trucks/types.ts`
- [X] T017 [P] Widen the `truckStatus` search enum to `z.enum(['available','suspended','archived']).catch('available')` in `apps/web/src/routes/_authenticated/transport-resources.tsx`

**Checkpoint**: Schema carries the third state on both dialects; all shared types compile. User story work can begin.

---

## Phase 3: User Story 1 — Take a Truck Out of Service Without Retiring It (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator suspends an available truck, which leaves the available collection, appears as suspended rather than archived, and keeps its identity, attributes, transport company, and any earlier lifecycle context.

**Independent Test**: Sign in as an organization administrator, suspend an available truck with a comment, and verify it leaves the available collection and count, appears in the suspended collection, shows its suspension time, actor, and comment, and keeps registration, model, capacity, and company unchanged.

### Tests for User Story 1 ⚠️ Write first; they must FAIL before implementation

- [X] T018 [P] [US1] Unit suite for the happy path in `apps/api/tests/unit/trucks/lifecycle/suspend.spec.ts`: both administrator roles succeed; time, actor, and comment recorded; comment trimmed; absent/empty/whitespace-only comment stored as `null`; registration, model, capacity, company, and any archive/reactivation context preserved (FR-002, FR-008, FR-009, FR-011)
- [X] T019 [P] [US1] Integration suite in `apps/api/tests/integration/trucks/lifecycle/suspend.spec.ts` asserting `POST /api/v1/trucks/:id/suspend` returns `200` with the serialized suspension context per [contracts/http-api.md](./contracts/http-api.md)
- [X] T020 [P] [US1] Web feature test in `apps/web/src/features/trucks/__tests__/lifecycle/suspend.test.tsx`: suspending from the details panel calls `trucks.suspend`, shows a success toast, and moves the truck out of the available tab into the suspended tab without a manual refresh

### Implementation for User Story 1

- [X] T021 [US1] Implement `suspendAvailable` in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`: one transaction, `forUpdate` on the truck row, refuse non-`AVAILABLE`, one status-guarded `UPDATE`, re-read with all three actor preloads. Add `.preload('suspendedBy')` to `findById`, `list`, and `listAvailable`
- [X] T022 [US1] Implement `SuspendTruckUseCase` in `apps/api/app/trucks/suspend/suspend_truck_use_case.ts`, trimming the comment to `null` and mapping repository outcomes to the exceptions from T009
- [X] T023 [US1] Add the `suspend` handler to `apps/api/app/controllers/trucks_controller.ts`, authorizing with `TruckPolicy#suspend` and validating with `suspendTruckValidator`
- [X] T024 [US1] Register `POST /trucks/:id/suspend` as `trucks.suspend` in `apps/api/start/routes.ts`, then refresh the generated route tree, controller/policy registries, and Tuyau types through the existing generators
- [X] T025 [P] [US1] Add the `suspend` mutation, invalidating both truck queries on success, in `apps/web/src/features/trucks/mutations/use-truck-mutations.ts`
- [X] T026 [US1] Make `apps/web/src/features/trucks/ui/trucks-page.tsx` tri-state: a third administrator-only tab with its count, a three-way `scopedTrucks` partition, `activeLifecycleStatus` over three values, and a selection-sync effect that keeps a suspended truck on the suspended tab. Research [D10](./research.md) records the two regressions this prevents — a suspended truck appearing in neither list, and selection bouncing then clearing
- [X] T027 [P] [US1] Render the third state in `apps/web/src/features/trucks/ui/truck-details.tsx`: a distinct badge and status field, and a suspension-context block showing time, actor, and comment beside the preserved archive and reactivation context
- [X] T028 [P] [US1] Add the suspended count and correct the total to span all three states in `apps/web/src/features/trucks/ui/truck-overview.tsx`
- [X] T029 [P] [US1] Derive the section label from the three-value lifecycle in `apps/web/src/features/trucks/ui/truck-section.tsx`
- [X] T030 [US1] Offer **Suspend truck** beside **Archive truck** for available trucks in `apps/web/src/features/trucks/ui/truck-lifecycle-actions.tsx`, with its own confirmation dialog and optional comment field

**Checkpoint**: A truck can be suspended end to end and is visible as suspended. MVP deliverable.

---

## Phase 4: User Story 2 — Stop New Work Without Disturbing Work Already Under Way (Priority: P1)

**Goal**: Suspension succeeds for a truck already assigned to a planned or active discharge or shift, leaves every existing assignment intact, and removes the truck from every collection offering trucks for new work.

**Independent Test**: Suspend a truck reserved by a planned discharge and a truck assigned to an active shift; verify both succeed, that `discharge_truck_assignments` and `shift_trucks` rows are unchanged, and that neither truck appears in `GET /trucks/available`.

**Note**: This story's implementation is largely the deliberate *absence* of a check. Research [D4](./research.md) records that US2 scenarios 3–5 (in-progress rotation, continuation refusal, new-rotation exclusion) cannot be built — there is no rotation model in the codebase — and are carried as forward constraints in T054 instead.

### Tests for User Story 2 ⚠️ Write first

- [X] T031 [P] [US2] Integration test in `apps/api/tests/integration/trucks/lifecycle/suspend.spec.ts`: suspending a truck from `createReservedTruckScenario` on a `PLANNED` and on an `ACTIVE` discharge returns `200`, and the assignment rows — including their registration and company snapshots — are byte-for-byte unchanged (FR-017, FR-018)
- [X] T032 [P] [US2] Unit test in `apps/api/tests/unit/trucks/lifecycle/suspend.spec.ts`: a truck assigned to an active shift suspends successfully and its `shift_trucks` rows are unchanged; assert explicitly that suspension does not consult `SiteReferenceUsageChecker`, which is the single behavioural difference from archival
- [X] T033 [P] [US2] Test in `apps/api/tests/integration/trucks/consultation/list.spec.ts` that a suspended truck is absent from `GET /api/v1/trucks/available` for every role and present in `GET /api/v1/trucks` for administrators only (FR-013, FR-015, FR-020)

### Implementation for User Story 2

- [X] T034 [US2] Confirm `suspendAvailable` in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts` omits both the `SiteReferenceUsageChecker` call and the transport-company `FOR UPDATE` lock, and record why in a comment: suspension is never refused for a truck in use (FR-017), and it removes an available truck rather than producing one, so it cannot break the archived-company invariant (research [D6](./research.md), [D7](./research.md))

**Checkpoint**: Suspension succeeds exactly where archival is refused, and disturbs nothing already under way.

---

## Phase 5: User Story 3 — Keep Suspension Authorized and Consistent With the Truck Lifecycle (Priority: P1)

**Goal**: Only the two administrator roles can suspend, only trucks of their site, and only available trucks — and the three delivered lifecycle paths stop treating status as a boolean.

**Independent Test**: Attempt suspension unauthenticated, as each non-administrator role, on an already-suspended truck, on an archived truck, and on an unknown truck; then attempt to archive, reactivate, and update a suspended truck. Every attempt is refused with its own specific reason and no truck changes state.

**⚠️ Two of these regression tests fail *by succeeding* before their fix.** Research [D3](./research.md) is the audit.

### Tests for User Story 3 ⚠️ Write first

- [X] T035 [P] [US3] Authorization tests in `apps/api/tests/integration/trucks/lifecycle/suspend.spec.ts`: unauthenticated and inactive users get `401`, operations lead and observer get `403`, no truck changes state, no truck data disclosed (FR-003)
- [X] T036 [P] [US3] Lifecycle refusal tests in `apps/api/tests/unit/trucks/lifecycle/suspend.spec.ts`: unknown truck ⇒ `404`; already suspended ⇒ `E_TRUCK_ALREADY_SUSPENDED` with existing context untouched; archived ⇒ `E_TRUCK_ARCHIVED_CANNOT_SUSPEND` and still archived (FR-004, FR-005, FR-006)
- [X] T037 [P] [US3] Regression test in `apps/api/tests/unit/trucks/lifecycle/archive.spec.ts`: archiving a suspended truck is refused with `E_TRUCK_SUSPENDED` and leaves it suspended. **Currently this request succeeds** — the test must fail by archiving the truck before T043
- [X] T038 [P] [US3] Regression test in `apps/api/tests/unit/trucks/lifecycle/reactivate.spec.ts`: reactivating a suspended truck is refused with `E_TRUCK_SUSPENDED`. **Currently this request succeeds**, silently making the truck available — the test must fail that way before T044
- [X] T039 [P] [US3] Regression tests in `apps/api/tests/unit/trucks/lifecycle/bulk/archive.spec.ts` and `.../bulk/reactivate.spec.ts`: a suspended truck in the selection is reported with `reason: 'SUSPENDED'`, the eligible trucks still change state, and the response is `200` — not the `500` the transaction's row-count assertion currently raises
- [X] T040 [P] [US3] Regression test in `apps/api/tests/unit/trucks/administration/update.spec.ts`: updating a suspended truck is refused with `E_TRUCK_SUSPENDED`, not the misleading `E_TRUCK_ARCHIVED`
- [X] T041 [P] [US3] Web test in `apps/web/src/features/trucks/__tests__/lifecycle/suspend.test.tsx`: a suspended truck offers no **Edit truck** button and no lifecycle action, and states that it must be returned to service first

### Implementation for User Story 3

- [X] T042 [US3] Map `ALREADY_SUSPENDED`, `ARCHIVED`, and `NOT_FOUND` to their exceptions in `apps/api/app/trucks/suspend/suspend_truck_use_case.ts`
- [X] T043 [US3] Guard `archiveAvailable` against any non-`AVAILABLE` status and return `{ kind: 'SUSPENDED' }` in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`; map it in `apps/api/app/trucks/archive/archive_truck_use_case.ts`
- [X] T044 [US3] Guard `reactivateArchived` against any non-`ARCHIVED` status and return `{ kind: 'SUSPENDED' }` in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`; map it in `apps/api/app/trucks/reactivate/reactivate_truck_use_case.ts` (same file as T043 — do not parallelize)
- [X] T045 [P] [US3] Return `reason: 'SUSPENDED'` for a suspended truck on both expected-status branches in `apps/api/app/trucks/shared/truck_lifecycle_blockers.ts`, so neither bulk path misreports it nor trips its row-count assertion
- [X] T046 [P] [US3] Distinguish the suspended case from the archived one in `apps/api/app/trucks/update/update_truck_use_case.ts` and in `updateAvailable`'s non-available branch, throwing `SuspendedTruckReadOnlyException`. Keep the `WHERE status = 'AVAILABLE'` guard as it is (research [D5](./research.md))
- [X] T047 [P] [US3] Gate the **Edit truck** button on `truck.status === 'AVAILABLE'` rather than `!isArchived` in `apps/web/src/features/trucks/ui/truck-details.tsx`
- [X] T048 [US3] Render no lifecycle action for a suspended truck in `apps/web/src/features/trucks/ui/truck-lifecycle-actions.tsx`, with a short line naming returning it to service as the next step and noting that action is not yet available

**Checkpoint**: Every lifecycle transition is exact in all three directions; no delivered path reads status as a boolean.

---

## Phase 6: User Story 4 — Understand and Recover From a Refused Suspension (Priority: P2)

**Goal**: Each refusal family is distinguishable and actionable, concurrent attempts collapse to one recorded suspension, and a refused attempt leaves the truck exactly as it was.

**Independent Test**: Trigger an already-suspended conflict, an archived-truck conflict, a stale-view conflict, an over-long comment, and a transient failure; verify each produces distinct guidance, the stored state never changes on refusal, and a retry after recovery suspends the truck exactly once.

### Tests for User Story 4 ⚠️ Write first

- [X] T049 [P] [US4] Test in `apps/api/tests/integration/trucks/lifecycle/suspend.spec.ts` that authorization, not-found, already-suspended, archived, validation, and transient-failure conditions each produce distinct codes, and that after any refusal the stored row — status and all three context blocks — is unchanged (FR-021, FR-023)
- [X] T050 [P] [US4] Concurrency test in `apps/api/tests/unit/trucks/lifecycle/suspend.spec.ts`: two near-simultaneous suspensions of the same truck record exactly one suspension, with the loser refused as already suspended and no context overwritten (FR-022)
- [X] T051 [P] [US4] Validation test in `apps/api/tests/unit/trucks/lifecycle/suspend.spec.ts`: a comment over 1,000 characters is refused with `422` and the truck stays available (FR-010)
- [X] T052 [P] [US4] Web test in `apps/web/src/features/trucks/__tests__/lifecycle/suspend.test.tsx`: a refused suspension shows the specific reason and refreshes to the truck's authoritative state, so a stale view resolves itself

### Implementation for User Story 4

- [X] T053 [US4] On a failed suspension in `apps/web/src/features/trucks/ui/truck-lifecycle-actions.tsx`, call `refreshTrucks()` and surface the parsed API message, matching the archive and reactivate branches

**Checkpoint**: Every refusal explains itself and leaves a safe retry path.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T054 Update `CONTEXT.md`: add the **Suspended Truck** entry as the issue requires, and revise **Available Site Reference**, **Archived Resource**, **Truck**, and **Rotation-Eligible Truck** so the glossary stops implying a binary lifecycle. The **Rotation-Eligible Truck** revision carries the forward constraints from research [D4](./research.md) — suspension removes eligibility without interrupting an in-progress rotation, and a continuation may not start a new rotation for a suspended truck
- [X] T055 [P] Mark `#252` as implemented in `specs/site-references/transport-resources/trucks/roadmap.md`
- [X] T056 [P] Add a note to GitHub issue `#253` that returning a truck to service must carry the same archived-transport-company gate and `FOR UPDATE` company lock as `#226`, or it will produce an available truck under an archived company (research [D6](./research.md))
- [X] T057 Run the repository gates: `pnpm check`, `pnpm typecheck`, `pnpm test`. The full suite is the gate, not the truck suites alone — widening `TruckStatus` reaches every consumer of the truck model
- [X] T058 Walk the manual browser flow in [quickstart.md](./quickstart.md) step 6 as both administrator roles, on desktop and on a mobile viewport, including the concurrent-suspension check and the operations-lead and observer visibility checks
- [ ] T059 Obtain a fresh read-only review of the final diff per constitution principle VII, resolving or explicitly justifying every confirmed finding

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — **blocks every user story**
- **US1 (Phase 3)**: depends on Foundational. Delivers the MVP
- **US2 (Phase 4)**: depends on US1 — it asserts properties of the `suspendAvailable` written in T021
- **US3 (Phase 5)**: depends on Foundational; T042 depends on US1's use case. T037–T040 and T043–T046 are independent of US1 and can start as soon as Phase 2 lands
- **US4 (Phase 6)**: depends on US1 (T053 extends T030's component)
- **Polish (Phase 7)**: depends on all desired stories

### Critical path

`T003 → T004 → T005 → T006 → T007/T008 → T021 → T022 → T023 → T024`

T003 and T004 gate everything. A migration that is silently wrong on SQLite produces a green test suite and a broken schema (research [D2](./research.md)).

### Within Each User Story

- Tests are written first and must fail before implementation
- Repository method → use case → controller → route → generated types
- API before web, since the web adapter consumes Tuyau types generated from the routes

### Parallel Opportunities

- **Phase 2**: T009–T017 are nine different files and run in parallel once T006 lands. T007 and T008 are sequential with it (compilation)
- **Phase 3**: T018–T020 in parallel; then T025, T027, T028, T029 in parallel once T024 has regenerated the Tuyau types
- **Phase 4**: T031–T033 in parallel
- **Phase 5**: T035–T041 all in parallel — seven different spec files. T043 and T044 touch the same repository file and must be sequential; T045, T046, T047 are parallel to each other
- **Phase 6**: T049–T052 in parallel
- **Phase 7**: T055 and T056 in parallel

## Parallel Example: User Story 3

```bash
# All seven regression and refusal suites are different files — write them together:
Task: "Authorization tests in apps/api/tests/integration/trucks/lifecycle/suspend.spec.ts"
Task: "Lifecycle refusal tests in apps/api/tests/unit/trucks/lifecycle/suspend.spec.ts"
Task: "Archive-of-suspended regression in apps/api/tests/unit/trucks/lifecycle/archive.spec.ts"
Task: "Reactivate-of-suspended regression in apps/api/tests/unit/trucks/lifecycle/reactivate.spec.ts"
Task: "Bulk blocker regressions in apps/api/tests/unit/trucks/lifecycle/bulk/{archive,reactivate}.spec.ts"
Task: "Update-of-suspended regression in apps/api/tests/unit/trucks/administration/update.spec.ts"
Task: "Suspended-truck action guards in apps/web/src/features/trucks/__tests__/lifecycle/suspend.test.tsx"

# Then the three independent fixes:
Task: "SUSPENDED blocker reason in apps/api/app/trucks/shared/truck_lifecycle_blockers.ts"
Task: "Suspended refusal in apps/api/app/trucks/update/update_truck_use_case.ts"
Task: "Edit-button guard in apps/web/src/features/trucks/ui/truck-details.tsx"
```

---

## Implementation Strategy

### MVP scope

**Phases 1–3 (T001–T030).** A truck can be suspended, is visible as suspended, and keeps everything about itself. That is the outcome the issue asks for and it is demonstrable on its own.

Do not ship the MVP alone, though: until Phase 5 lands, a suspended truck can still be archived or reactivated by the delivered endpoints, which is a data-integrity bug, not a missing feature. **Phases 1–3 and 5 together are the smallest safely shippable increment.**

### Incremental delivery

1. Setup + Foundational → schema carries the third state on both dialects
2. + US1 → suspension works end to end (MVP)
3. + US3 → every lifecycle transition is exact; safe to merge
4. + US2 → the in-use behaviour is pinned by tests
5. + US4 → refusals are legible and recoverable
6. Polish → vocabulary, roadmap, gates, browser flow, review

### Post-review addition: FR-016

- [X] T055 Add `GET /api/v1/trucks/suspended` with a `listSuspended` ability open to every active user, backed by `ListSuspendedTrucksUseCase` and `LucidTruckRepository.listSuspended`, in `apps/api/app/trucks/suspended/`, `apps/api/app/trucks/shared/truck_policy.ts` and `apps/api/start/routes.ts`
- [X] T056 Add the `toOperationalView` variant to `apps/api/app/trucks/shared/truck_transformer.ts`, withholding the lifecycle actor identities while keeping the suspension date and comment (FR-015 / FR-016)
- [X] T057 Integration spec in `apps/api/tests/integration/trucks/consultation/suspended.spec.ts`: every active role reads the collection, an unauthenticated caller is refused, the responsible administrator is withheld, and the complete collection still carries it
- [X] T058 Offer the suspended tab to every active role in `apps/web/src/features/trucks/ui/trucks-page.tsx`, reading `truckQueries.suspended()` for non-administrators, and keep the archived tab administrator-only
- [X] T059 Hide the lifecycle actor field from non-administrators in `apps/web/src/features/trucks/ui/truck-details.tsx`
- [X] T060 Replace the "hides the suspended tab from non-administrators" web spec with its inverse and add the withheld-administrator case in `apps/web/src/features/trucks/__tests__/lifecycle/suspend.test.tsx`

FR-016 was delivered after the initial review flagged it as the only functional requirement without a task. Suspended trucks are disclosed to every active role; the archived collection stays administrator-only, and so does the identity of whoever suspended the truck.

### Known boundary, carried deliberately

After this slice a suspended truck cannot be returned to service through the product — that is issue `#253`. T048 makes the interface say so. Three of User Story 2's acceptance scenarios ship as `CONTEXT.md` constraints (T054) rather than code, because rotations do not exist yet. Both were confirmed at the T002 gate.

---

## Notes

- `[P]` means different files with no incomplete dependency
- Every acceptance scenario in spec.md maps to a test task; the three rotation scenarios are the documented exception
- Verify each test fails before implementing it — T037 and T038 must fail *by succeeding*
- Commit after each task or logical group; Conventional Commits, on this branch, never on `master`
