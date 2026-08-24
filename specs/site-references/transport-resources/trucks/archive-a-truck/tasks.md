---

description: "Task list for Archive a Truck (GH-225)"
---

# Tasks: Archive a Truck

**Input**: Design documents from `specs/site-references/transport-resources/trucks/archive-a-truck/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [quickstart.md](./quickstart.md)

**Tests**: Test tasks are INCLUDED and MANDATORY. Constitution Principle IV requires business behavior to follow RED → GREEN → REFACTOR, and the plan's Constitution Check commits to Japa API suites and Vitest/MSW web suites written before implementation.

**Organization**: Tasks are grouped by user story so each can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task belongs to (US1–US4)
- Paths are repository-relative from the worktree root

## Path Conventions

This is a PNPM/Turbo monorepo web application:

- **API**: `apps/api/app/`, `apps/api/start/`, `apps/api/tests/`
- **Web**: `apps/web/src/`
- **Test data**: `apps/api/database/factories/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test data needed by every eligibility scenario. No new dependency, no migration — the `trucks` lifecycle columns and `discharge_truck_assignments.released_at` already exist.

- [X] T001 [P] Add a reserved-truck test helper composing `TruckFactory`, `DischargeFactory`, and `DischargeTruckAssignmentFactory` (planned/active discharge with a null `released_at`, plus released and closed-discharge variants) in `apps/api/tests/support/trucks/lifecycle_fixtures.ts`
- [X] T002 [P] Extend the web truck fixtures with archived trucks, lifecycle actors, and archive context in `apps/web/src/features/trucks/__tests__/support/fixtures.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared validation, authorization, and repository contracts that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Extract `distinctUuids`, `lifecycleComment()`, and `lifecycleIds()` as exported helpers in `apps/api/app/site_references/shared/site_reference_validator.ts`
- [X] T004 Replace the local copies with imports of the extracted helpers in `apps/api/app/customers/shared/customer_validator.ts` (depends on T003)
- [X] T005 [P] Add `TruckNotFoundException` (404, `E_TRUCK_NOT_FOUND`), `TruckAlreadyArchivedException` (409, `E_TRUCK_ALREADY_ARCHIVED`), and `TruckInUseException` (409, `E_TRUCK_IN_USE`) in `apps/api/app/trucks/shared/truck_exceptions.ts`
- [X] T006 [P] Add the `archive(user)` method applying the `ORGANIZATION_ADMIN` / `OPERATIONS_ADMIN` role check in `apps/api/app/trucks/shared/truck_policy.ts`
- [X] T007 Add `ArchiveTruckCommand`, `ArchiveTruckResult`, and the abstract `findById` / `archiveAvailable` signatures in `apps/api/app/trucks/shared/repositories/truck_repository.ts`
- [X] T008 Run the existing customer lifecycle suites (`apps/api/tests/unit/customers/lifecycle/`, `apps/api/tests/integration/customers/lifecycle/`) to prove the validator extraction changed no customer behavior (depends on T004)

**Checkpoint**: Shared plumbing ready — user story implementation can begin.

---

## Phase 3: User Story 1 - Retire a Truck From Operational Use (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator archives an eligible available truck; it leaves the available collection, appears in the archived collection with its archive context, and keeps every attribute and prior lifecycle history intact.

**Independent Test**: Sign in as an organization administrator or operations administrator, archive an available truck with no discharge involvement, and verify it is absent from available consultation, present in archived consultation with archive time/actor/comment, and unchanged in registration, vehicle model, capacity, and transport company.

### Tests for User Story 1 ⚠️

> **Write these FIRST and confirm they FAIL before implementing T012–T019.**

- [X] T009 [P] [US1] Unit tests for `ArchiveTruckUseCase` success: status transition, server-set archive time and actor, trimmed comment, `null` for blank/whitespace-only comment, attributes and prior reactivation context preserved — in `apps/api/tests/unit/trucks/lifecycle/archive.spec.ts`
- [X] T010 [P] [US1] Integration tests for `POST /api/v1/trucks/:id/archive` success: `200` envelope, populated `archivedBy`, and the truck's disappearance from `trucks.available` and persistence in `trucks.index` — in `apps/api/tests/integration/trucks/lifecycle/archive.spec.ts`
- [X] T011 [P] [US1] Web tests for the single archive flow: administrator sees the action on an available truck, confirming with and without a comment archives it, and the workspace moves it between lifecycle tabs without a manual refresh — in `apps/web/src/features/trucks/__tests__/lifecycle/archive.test.tsx`

### Implementation for User Story 1

- [X] T012 [US1] Implement `findById` (preloading `archivedBy` and `reactivatedBy`) and `archiveAvailable` with the status-guarded `UPDATE ... WHERE id = ? AND status = 'AVAILABLE'` plus a preloaded reload of the archived row in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`
- [X] T013 [US1] Create `ArchiveTruckUseCase` returning the archived truck on the success path in `apps/api/app/trucks/archive/archive_truck_use_case.ts`
- [X] T014 [US1] Add `archiveTruckValidator` (optional nullable trimmed comment, max 1000) using the extracted `lifecycleComment()` helper in `apps/api/app/trucks/shared/truck_validator.ts`
- [X] T015 [US1] Add the `archive` action authorizing via `TruckPolicy`, validating the payload, and passing `DateTime.now()` and the authenticated user id to the use case in `apps/api/app/controllers/trucks_controller.ts`
- [X] T016 [US1] Register `router.post('/:id/archive', [controllers.Trucks, 'archive']).as('archive')` in the trucks group of `apps/api/start/routes.ts`, then refresh the generated client types under `apps/api/.adonisjs/`
- [X] T017 [P] [US1] Add the `archive` mutation invalidating both `truckQueries.all()` and `truckQueries.available()` in `apps/web/src/features/trucks/mutations/use-truck-mutations.ts`
- [X] T018 [US1] Create the archive confirmation dialog (destructive trigger, `AlertDialog`, optional comment textarea capped at 1000, success toast), modeled on `features/customers/ui/lifecycle-actions.tsx`, in `apps/web/src/features/trucks/ui/truck-lifecycle-actions.tsx`
- [X] T019 [US1] Render the archive action for administrators on `AVAILABLE` trucks only in `apps/web/src/features/trucks/ui/truck-details.tsx`

**Checkpoint**: A truck can be archived end to end. Not yet safe to ship alone — the eligibility guards land in US2, which is also P1.

---

## Phase 4: User Story 2 - Protect Trucks Still Required by Current Work (Priority: P1)

**Goal**: Archival is refused for unauthorized callers, unknown trucks, already-archived trucks, and trucks a planned or active discharge still reserves — always leaving the row unchanged.

**Independent Test**: Attempt archival as an unauthenticated visitor, as each non-administrator active role, on a reserved truck, on an already-archived truck, and on an unknown id; verify every attempt is refused with its own specific reason and no truck changes lifecycle state.

### Tests for User Story 2 ⚠️

> **Write these FIRST and confirm they FAIL before implementing T023–T025.**

- [X] T020 [P] [US2] Unit tests for the refusal branches — not found, already archived, in use — plus the two must-succeed cases where usage is only through a closed discharge or a released assignment, using the T001 helper, in `apps/api/tests/unit/trucks/lifecycle/archive.spec.ts`
- [X] T021 [P] [US2] Integration tests asserting `401` unauthenticated, `403` for `OPERATIONS_LEAD` and `OBSERVER`, `404 E_TRUCK_NOT_FOUND`, `409 E_TRUCK_ALREADY_ARCHIVED` with its existing context intact, and `409 E_TRUCK_IN_USE` with the truck left available, in `apps/api/tests/integration/trucks/lifecycle/archive.spec.ts`
- [X] T022 [P] [US2] Web test asserting no archive control is rendered or reachable for non-administrator active roles in `apps/web/src/features/trucks/__tests__/access/authorization.test.tsx`

### Implementation for User Story 2

- [X] T023 [US2] Inject `SiteReferenceUsageChecker` and add the guard sequence — not found → already archived → `findUsedByPlannedOrActiveDischarge({ referenceType: 'TRUCK', referenceIds: [id] })` — before delegating to the repository, in `apps/api/app/trucks/archive/archive_truck_use_case.ts`
- [X] T024 [US2] Map a zero-affected-row result to `NOT_FOUND` or `ALREADY_ARCHIVED` so a state change racing the in-memory guards is still caught, in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`
- [X] T025 [US2] Map the repository result kinds onto `TruckNotFoundException` and `TruckAlreadyArchivedException`, and raise `TruckInUseException` from the usage guard, in `apps/api/app/trucks/archive/archive_truck_use_case.ts`

**Checkpoint**: Single-truck archival is complete and safe. This is the responsible MVP — US1 + US2 together.

---

## Phase 5: User Story 3 - Understand and Recover From a Refused Archival (Priority: P2)

**Goal**: Each refusal explains itself distinctly and leaves a safe retry path, so an administrator can tell an authorization denial from an in-use conflict, a stale view, or a transient outage.

**Independent Test**: Trigger an in-use conflict, an already-archived conflict from a stale view, and a transient failure in turn; verify each produces distinct guidance, the truck's displayed state matches its stored state, and retrying after the blocker clears archives it exactly once.

### Tests for User Story 3 ⚠️

- [X] T026 [P] [US3] Integration test submitting two archivals for the same truck in quick succession, asserting exactly one `200`, one `409 E_TRUCK_ALREADY_ARCHIVED`, and a single recorded archive time, actor, and comment, in `apps/api/tests/integration/trucks/lifecycle/archive.spec.ts`
- [X] T027 [P] [US3] Web tests asserting distinct messages per failure (`E_TRUCK_IN_USE`, `E_TRUCK_ALREADY_ARCHIVED`, transient), that a stale view refreshes to the authoritative archived state, and that a retry after recovery archives exactly once, in `apps/web/src/features/trucks/__tests__/lifecycle/archive.test.tsx`

### Implementation for User Story 3

- [X] T028 [US3] Map each API error code to its own actionable message via `parseApiError`, keeping the dialog open with the entered comment on a recoverable failure, in `apps/web/src/features/trucks/ui/truck-lifecycle-actions.tsx`
- [X] T029 [US3] Refresh truck queries after a refusal as well as a success, so a stale lifecycle state is replaced by the authoritative one without leaving the consultation context, in `apps/web/src/features/trucks/ui/truck-lifecycle-actions.tsx`

**Checkpoint**: Single-truck archival is fully recoverable and legible.

---

## Phase 6: User Story 4 - Archive Several Trucks at Once (Priority: P3)

**Goal**: An authorized administrator selects several trucks and archives them in one action, with partial success: eligible trucks are archived atomically with identical metadata, ineligible ones are left untouched and reported with a specific reason.

**Independent Test**: Select a mixed set — eligible trucks, one reserved, one already archived, one unknown id — archive in one action, and verify exactly the eligible trucks are archived with identical archive metadata, the other three are unchanged and reported with reasons `IN_USE` / `ALREADY_ARCHIVED` / `NOT_FOUND`, and the blocked ones can be retried on their own.

### Tests for User Story 4 ⚠️

> **Write these FIRST and confirm they FAIL before implementing T035–T046.**

- [X] T030 [P] [US4] Unit tests for `archiveAvailableMany` classification and atomicity: mixed eligible/blocked sets, all-blocked sets, identical archive metadata across the batch, submitted-id ordering of `updatedTrucks`, and `registration` omitted on a `NOT_FOUND` blocker — in `apps/api/tests/unit/trucks/lifecycle/bulk/archive.spec.ts`
- [X] T031 [P] [US4] Integration tests for `POST /api/v1/trucks/archive`: `200` with mixed outcome, `200` with everything blocked, `422` for empty/duplicate/non-UUID ids and an over-long comment, `401`/`403` rejecting the whole submission, rollback leaving nothing archived on a commit failure, and overlapping concurrent submissions archiving each shared truck exactly once — in `apps/api/tests/integration/trucks/lifecycle/bulk/archive.spec.ts`
- [X] T032 [P] [US4] Web tests for the happy bulk path: selecting several trucks shows the count, archiving removes them all from the available tab and updates both counts without a manual refresh, and clearing the selection hides the toolbar — in `apps/web/src/features/trucks/__tests__/bulk/archive.test.tsx`
- [X] T033 [P] [US4] Web tests for a mixed outcome: unchanged trucks listed by registration with readable reasons, and the retry action resubmitting only those trucks — in `apps/web/src/features/trucks/__tests__/bulk/mixed-archive.test.tsx`
- [X] T034 [P] [US4] Web tests for selection scoping: switching lifecycle tab or transport-company filter drops trucks absent from the new scope, a search term does not drop trucks it merely hides, and selection is offered only to administrators in the available view — in `apps/web/src/features/trucks/__tests__/selection/selection.test.tsx`

### Implementation for User Story 4 — API

- [X] T035 [P] [US4] Create the pure classification helpers `TruckLifecycleRecord`, `BulkTruckLifecycleBlocker`, `indexTrucksById`, `findBulkBlockers`, and `orderTrucks` (reasons `NOT_FOUND` / `IN_USE` / `ALREADY_ARCHIVED`, `registration` as the label) in `apps/api/app/trucks/shared/truck_lifecycle_blockers.ts`
- [X] T036 [US4] Add `ArchiveTrucksCommand`, `BulkTruckLifecycleResult`, and the abstract `archiveAvailableMany` / `findManyForLifecycle` signatures in `apps/api/app/trucks/shared/repositories/truck_repository.ts`
- [X] T037 [US4] Implement `archiveAvailableMany` in one transaction — `forUpdate()` load, a single usage query for the whole set with `client: trx`, classification via T035, one guarded `UPDATE ... WHERE id IN (eligible) AND status = 'AVAILABLE'`, an affected-row assertion, and an ordered preloaded reload — in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`
- [X] T038 [US4] Create `ArchiveTrucksUseCase` delegating to `archiveAvailableMany` with a once-computed archive time, actor, and trimmed comment in `apps/api/app/trucks/archive/archive_trucks_use_case.ts`
- [X] T039 [US4] Add `archiveTrucksValidator` (`ids` via the extracted `lifecycleIds()`, `comment` via `lifecycleComment()`) in `apps/api/app/trucks/shared/truck_validator.ts`
- [X] T040 [US4] Add the `archiveMany` action returning `{ updatedTrucks, blockedTrucks }` in `apps/api/app/controllers/trucks_controller.ts`
- [X] T041 [US4] Register `router.post('/archive', [controllers.Trucks, 'archiveMany']).as('archive_many')` in the trucks group of `apps/api/start/routes.ts`, then refresh the generated client types under `apps/api/.adonisjs/`

### Implementation for User Story 4 — Web

- [X] T042 [P] [US4] Add `BulkTruckLifecycleResult` and `BulkTruckLifecycleBlocker` derived from the `trucks.archive_many` route response in `apps/web/src/features/trucks/types.ts`
- [X] T043 [US4] Add the `archiveMany` mutation in `apps/web/src/features/trucks/mutations/use-truck-mutations.ts`
- [X] T044 [US4] Restructure each row into a container holding a `Checkbox` beside the existing details `<button>` (a checkbox cannot be nested inside it), with a select-all control covering the currently listed trucks and a per-row accessible label naming the registration, in `apps/web/src/features/trucks/ui/truck-list.tsx`
- [X] T045 [US4] Thread `selectedIds`, `onSelectionChange`, and the selectable flag through to `TruckList` in `apps/web/src/features/trucks/ui/truck-section.tsx`
- [X] T046 [US4] Own the selected-id set, derive the set pruned to the active lifecycle view and transport-company filter (not narrowed by search), and drive the retry selection from the previous outcome's blocked ids, in `apps/web/src/features/trucks/ui/trucks-page.tsx`
- [X] T047 [US4] Create the floating selection toolbar with selected count, archive-selected confirmation dialog with optional comment, partial-success toast, blocked list with readable reasons, retry-blocked action, and clear-selection control — modeled on `features/customers/ui/bulk-lifecycle-actions.tsx` — in `apps/web/src/features/trucks/ui/truck-bulk-lifecycle-actions.tsx`
- [X] T048 [US4] Render the toolbar for administrators in the available view only, wired to the selection state, in `apps/web/src/features/trucks/ui/trucks-page.tsx`

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T049 [P] Mark #225 as selected with its artifact path in the slice table of `specs/site-references/transport-resources/trucks/roadmap.md`
- [X] T050 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the worktree root and resolve every finding
- [ ] T051 Execute the manual browser flow in [quickstart.md](./quickstart.md) §5 in a desktop and a narrow mobile viewport, including the selection toolbar steps
- [ ] T052 Obtain a fresh read-only Codex review of the final diff and resolve or explicitly justify every confirmed finding, per Constitution Principle VII

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Independent of Phase 1, but BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2
- **US2 (Phase 4)**: Depends on Phase 2; shares `archive_truck_use_case.ts` and `lucid_truck_repository.ts` with US1, so it is sequenced after US1 rather than run alongside it
- **US3 (Phase 5)**: Depends on US1 (needs the dialog and endpoint to fail against) and on US2 (needs the refusal codes to distinguish)
- **US4 (Phase 6)**: Depends on Phase 2 only. Genuinely independent of US1–US3 — a different endpoint, use case, repository method, and UI surface — so it can be built in parallel by a second developer, with `truck_repository.ts`, `truck_validator.ts`, `trucks_controller.ts`, `routes.ts`, and `use-truck-mutations.ts` as the shared-file merge points
- **Polish (Phase 7)**: Depends on every story being delivered

### Within Each User Story

- Tests are written and confirmed failing before implementation
- Repository contract → repository implementation → use case → validator → controller → route
- API before web, since the web types derive from the generated route contract

### Parallel Opportunities

- T001 and T002 (different workspaces)
- T005 and T006 (different files) — T003, T004, T007, T008 are sequential
- All of T009–T011 (three different test files)
- All of T020–T022
- T026 and T027
- All of T030–T034 (five different test files) — the largest parallel batch
- T035 and T042 within US4; T044/T045 must precede T046 and T048, which share `trucks-page.tsx`
- With two developers: US1 → US2 → US3 on one track, US4 on the other, joining at the shared API files

---

## Parallel Example: User Story 4 tests

```bash
# Launch all five US4 test files together (all currently failing):
Task: "Unit tests for archiveAvailableMany in apps/api/tests/unit/trucks/lifecycle/bulk/archive.spec.ts"
Task: "Integration tests for POST /api/v1/trucks/archive in apps/api/tests/integration/trucks/lifecycle/bulk/archive.spec.ts"
Task: "Web bulk happy path in apps/web/src/features/trucks/__tests__/bulk/archive.test.tsx"
Task: "Web mixed outcome in apps/web/src/features/trucks/__tests__/bulk/mixed-archive.test.tsx"
Task: "Web selection scoping in apps/web/src/features/trucks/__tests__/selection/selection.test.tsx"
```

---

## Implementation Strategy

### Responsible MVP (US1 + US2)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational)
2. Complete Phase 3 (US1) — archival works end to end
3. Complete Phase 4 (US2) — archival is guarded
4. **STOP and VALIDATE**: run the quickstart §2/§3 checks for single archival

US1 alone is demoable but must not ship on its own: without US2 an administrator could archive a truck a planned or active discharge still reserves. Both stories are P1 for that reason.

### Incremental Delivery

1. Setup + Foundational → shared plumbing ready
2. US1 + US2 → single-truck archival, safe → demo
3. US3 → refusals become legible and recoverable → demo
4. US4 → multiple archival with partial success → demo
5. Polish → gates, browser flow, fresh review

### Parallel Team Strategy

1. Both developers complete Phase 2 together (it is small and blocking)
2. Developer A: US1 → US2 → US3
3. Developer B: US4, starting from its five test files
4. Coordinate on the six shared files listed under US4 dependencies; everything else is disjoint

---

## Notes

- No migration, no new dependency, and no new usage-rule implementation: the `trucks` lifecycle columns, `discharge_truck_assignments.released_at`, and the `'TRUCK'` branch of the shared usage checker all already exist.
- The single largest piece of genuinely new construction is T044, forced by the current markup: each truck row is one full-width `<button>`, and a checkbox cannot live inside it.
- T003/T004 touch the customers slice; T008 exists specifically to prove that touch was behavior-neutral.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
