---

description: "Task list for Reactivate a Truck (GH-226)"
---

# Tasks: Reactivate a Truck

**Input**: Design documents from `specs/site-references/transport-resources/trucks/reactivate-a-truck/`

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

**Purpose**: Test data for the archived-truck states every scenario needs. No new dependency, no migration — the `trucks` reactivation columns already exist from List Trucks (`#222`).

- [X] T001 [P] Add archived-truck lifecycle scenarios — an archived truck under an `AVAILABLE` transport company, an archived truck under an `ARCHIVED` transport company, and an archived truck carrying a prior reactivation context — composing `TruckFactory` and `TransportCompanyFactory`, in `apps/api/tests/support/trucks/lifecycle_fixtures.ts`
- [X] T002 [P] Extend the web truck fixtures with archived trucks whose company is archived and with prior reactivation context (`reactivatedAt`, `reactivatedBy`, `reactivationComment`) in `apps/web/src/features/trucks/__tests__/support/fixtures.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Exceptions, authorization, the generalized blocker classifier, and repository contracts that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Add `TruckAlreadyAvailableException` (409, `E_TRUCK_ALREADY_AVAILABLE`) and `TruckTransportCompanyArchivedException` (409, `E_TRUCK_TRANSPORT_COMPANY_ARCHIVED`, message naming both remedies) in `apps/api/app/trucks/shared/truck_exceptions.ts`
- [X] T004 [P] Add the `reactivate(user)` method applying the same `ORGANIZATION_ADMIN` / `OPERATIONS_ADMIN` role check as `archive` in `apps/api/app/trucks/shared/truck_policy.ts`
- [X] T005 Generalize `findBulkBlockers` to take `expectedStatus: 'AVAILABLE' | 'ARCHIVED'` plus an optional `archivedCompanyIds` set, add `transportCompanyId` to `TruckLifecycleRecord`, and extend `BulkTruckLifecycleBlocker['reason']` with `ALREADY_AVAILABLE` and `TRANSPORT_COMPANY_ARCHIVED`, in `apps/api/app/trucks/shared/truck_lifecycle_blockers.ts`
- [X] T006 Update the existing `archiveAvailableMany` call site to pass `'AVAILABLE'` as the expected status, leaving its classification behavior identical, in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts` (depends on T005)
- [X] T007 Add `ReactivateTruckCommand`, `ReactivateTruckResult`, and the abstract `reactivateArchived` signature in `apps/api/app/trucks/shared/repositories/truck_repository.ts`
- [X] T008 Run the merged truck archive suites (`apps/api/tests/unit/trucks/lifecycle/archive.spec.ts`, `apps/api/tests/unit/trucks/lifecycle/bulk/archive.spec.ts`, `apps/api/tests/integration/trucks/lifecycle/archive.spec.ts`, `apps/api/tests/integration/trucks/lifecycle/bulk/archive.spec.ts`) to prove the classifier generalization changed no archive behavior (depends on T006)

**Checkpoint**: Shared plumbing ready — user story implementation can begin.

---

## Phase 3: User Story 1 - Return an Archived Truck to Operational Use (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator reactivates an archived truck whose transport company is available; it leaves the archived collection, reappears wherever trucks are offered for new work, and keeps its identity, attributes, transport company, and archive history intact.

**Independent Test**: Sign in as an organization administrator or operations administrator, reactivate an archived truck under an available company, and verify it is present in available consultation with its reactivation time/actor/comment, absent from archived consultation, and unchanged in registration, vehicle model, capacity, transport company, and archive context.

### Tests for User Story 1 ⚠️

> **Write these FIRST and confirm they FAIL before implementing T012–T019.**

- [X] T009 [P] [US1] Unit tests for `ReactivateTruckUseCase` success: `ARCHIVED` → `AVAILABLE`, server-set reactivation time and actor, trimmed comment, `null` for blank/whitespace-only comment, attributes and archive context preserved, and a prior reactivation context replaced — in `apps/api/tests/unit/trucks/lifecycle/reactivate.spec.ts`
- [X] T010 [P] [US1] Integration tests for `POST /api/v1/trucks/:id/reactivate` success: `200` envelope, populated `reactivatedBy`, unchanged `archivedAt` / `archivedByUserId` / `archiveComment`, and the truck's appearance in `trucks.available` and persistence in `trucks.index` with `status: "AVAILABLE"` — in `apps/api/tests/integration/trucks/lifecycle/reactivate.spec.ts`
- [X] T011 [P] [US1] Web tests for the single reactivate flow: an administrator sees the action on an archived truck (and no edit control), confirming with and without a comment reactivates it, and the workspace moves it from the archived tab to the available tab without a manual refresh — in `apps/web/src/features/trucks/__tests__/lifecycle/reactivate.test.tsx`

### Implementation for User Story 1

- [X] T012 [US1] Implement `reactivateArchived` in one transaction — truck loaded `forUpdate()`, status-guarded `UPDATE ... WHERE id = ? AND status = 'ARCHIVED'` writing `status`, `reactivatedAt`, `reactivatedByUserId`, `reactivationComment`, and `updatedAt`, then a reload preloading `archivedBy` and `reactivatedBy` — in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`
- [X] T013 [US1] Create `ReactivateTruckUseCase` building the command with a trimmed-or-null comment and returning the reactivated truck on the success path in `apps/api/app/trucks/reactivate/reactivate_truck_use_case.ts`
- [X] T014 [US1] Add `reactivateTruckValidator` (optional nullable trimmed comment, max 1000) using `lifecycleComment()` from `#shared/validators/lifecycle_validator` in `apps/api/app/trucks/shared/truck_validator.ts`
- [X] T015 [US1] Add the `reactivate` action authorizing via `TruckPolicy`, validating the payload, and passing `DateTime.now()` and the authenticated user id to the use case in `apps/api/app/controllers/trucks_controller.ts`
- [X] T016 [US1] Register `router.post('/:id/reactivate', [controllers.Trucks, 'reactivate']).as('reactivate')` in the trucks group of `apps/api/start/routes.ts`, then refresh the generated client types under `apps/api/.adonisjs/`
- [X] T017 [P] [US1] Add the `reactivate` mutation invalidating both `truckQueries.all()` and `truckQueries.available()` in `apps/web/src/features/trucks/mutations/use-truck-mutations.ts`
- [X] T018 [US1] Add the archived branch to the lifecycle dialog — non-destructive trigger, "Reactivate truck?" copy, optional comment textarea capped at 1000, success toast — modeled on `features/customers/ui/lifecycle-actions.tsx`, in `apps/web/src/features/trucks/ui/truck-lifecycle-actions.tsx`
- [X] T019 [US1] Render the action footer for `ARCHIVED` trucks as well as available ones, carrying the reactivate action alone and no edit control (archived trucks stay read-only), in `apps/web/src/features/trucks/ui/truck-details.tsx`

**Checkpoint**: A truck can be reactivated end to end. Not yet safe to ship alone — the transport-company gate lands in US2, which is also P1.

---

## Phase 4: User Story 2 - Keep Reactivation Consistent With the Provider Rule (Priority: P1)

**Goal**: Reactivation is refused for unauthorized callers, unknown trucks, already-available trucks, and trucks whose transport company is archived — always leaving the row unchanged, and never producing an available truck under an archived company.

**Independent Test**: Attempt reactivation as an unauthenticated visitor, as each non-administrator active role, on a truck whose company is archived, on an already-available truck, and on an unknown id; verify every attempt is refused with its own specific reason, no truck changes lifecycle state, and the company-blocked truck reactivates successfully once its company is available.

### Tests for User Story 2 ⚠️

> **Write these FIRST and confirm they FAIL before implementing T024–T026.**

- [X] T020 [P] [US2] Unit tests for the refusal branches — not found, already available, transport company archived — plus the must-succeed case where the same truck is reactivated after its company becomes available, using the T001 fixtures, in `apps/api/tests/unit/trucks/lifecycle/reactivate.spec.ts`
- [X] T021 [P] [US2] Integration tests asserting `401` unauthenticated, `403` for `OPERATIONS_LEAD` and `OBSERVER`, `404 E_TRUCK_NOT_FOUND`, `409 E_TRUCK_ALREADY_AVAILABLE` with its existing context intact, and `409 E_TRUCK_TRANSPORT_COMPANY_ARCHIVED` with the truck left archived, in `apps/api/tests/integration/trucks/lifecycle/reactivate.spec.ts`
- [X] T022 [P] [US2] Integration test for the invariant (SC-011): run a truck reactivation concurrently with an archival of that truck's transport company, assert exactly one succeeds and the other is refused (`E_TRUCK_TRANSPORT_COMPANY_ARCHIVED` or the company's available-truck refusal), and assert no `AVAILABLE` truck exists under an `ARCHIVED` company afterwards — in `apps/api/tests/integration/trucks/lifecycle/reactivate.spec.ts`
- [X] T023 [P] [US2] Web test asserting no reactivate control is rendered or reachable for non-administrator active roles, and that the archived view stays unreachable for them, in `apps/web/src/features/trucks/__tests__/access/authorization.test.tsx`

### Implementation for User Story 2

- [X] T024 [US2] Inside the `reactivateArchived` transaction, return `NOT_FOUND` / `ALREADY_AVAILABLE` from the locked truck row, then load that truck's `TransportCompany` row with `forUpdate()` and return `TRANSPORT_COMPANY_ARCHIVED` unless it is `AVAILABLE`, before the guarded update — in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`
- [X] T025 [US2] Map a zero-affected-row result to `NOT_FOUND` or `ALREADY_AVAILABLE` so a state change racing the locked reads is still caught, in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`
- [X] T026 [US2] Map the repository result kinds onto `TruckNotFoundException`, `TruckAlreadyAvailableException`, and `TruckTransportCompanyArchivedException` in `apps/api/app/trucks/reactivate/reactivate_truck_use_case.ts`

**Checkpoint**: Single-truck reactivation is complete and safe. This is the responsible MVP — US1 + US2 together.

---

## Phase 5: User Story 3 - Understand and Recover From a Refused Reactivation (Priority: P2)

**Goal**: Each refusal explains itself distinctly and leaves a safe retry path, so an administrator can tell an authorization denial from an archived-provider conflict, a stale view, a validation failure, or a transient outage.

**Independent Test**: Trigger an archived-provider conflict, an already-available conflict from a stale view, an over-long comment, and a transient failure in turn; verify each produces distinct guidance, the truck's displayed state matches its stored state, and retrying after the blocker clears reactivates it exactly once.

### Tests for User Story 3 ⚠️

- [X] T027 [P] [US3] Integration test submitting two reactivations for the same truck in quick succession, asserting exactly one `200`, one `409 E_TRUCK_ALREADY_AVAILABLE`, and a single recorded reactivation time, actor, and comment, in `apps/api/tests/integration/trucks/lifecycle/reactivate.spec.ts`
- [X] T028 [P] [US3] Web tests asserting distinct messages per failure (`E_TRUCK_TRANSPORT_COMPANY_ARCHIVED` naming the company remedy, `E_TRUCK_ALREADY_AVAILABLE`, over-long comment, transient), that a stale view refreshes to the authoritative available state, and that a retry after recovery reactivates exactly once, in `apps/web/src/features/trucks/__tests__/lifecycle/reactivate.test.tsx`

### Implementation for User Story 3

- [X] T029 [US3] Map each reactivation error code to its own actionable message via `parseApiError` — the provider conflict must state that the company be reactivated or the truck reassigned — keeping the dialog open with the entered comment on a recoverable failure, in `apps/web/src/features/trucks/ui/truck-lifecycle-actions.tsx`
- [X] T030 [US3] Extend the existing post-refusal query refresh to the reactivate branch, so a stale lifecycle state is replaced by the authoritative one without leaving the consultation context, in `apps/web/src/features/trucks/ui/truck-lifecycle-actions.tsx`

**Checkpoint**: Single-truck reactivation is fully recoverable and legible.

---

## Phase 6: User Story 4 - Reactivate Several Trucks at Once (Priority: P3)

**Goal**: An authorized administrator selects several archived trucks and reactivates them in one action, with partial success: eligible trucks are reactivated atomically with identical metadata, ineligible ones are left untouched and reported with a specific reason.

**Independent Test**: Select a mixed set — eligible archived trucks, one whose company is archived, one already available, one unknown id — reactivate in one action, and verify exactly the eligible trucks are reactivated with identical reactivation metadata, the other three are unchanged and reported with reasons `TRANSPORT_COMPANY_ARCHIVED` / `ALREADY_AVAILABLE` / `NOT_FOUND`, and the blocked ones can be retried on their own.

### Tests for User Story 4 ⚠️

> **Write these FIRST and confirm they FAIL before implementing T036–T046.**

- [X] T031 [P] [US4] Unit tests for `reactivateArchivedMany` classification and atomicity: mixed eligible/blocked sets, all-blocked sets, identical reactivation metadata across the batch, submitted-id ordering of `updatedTrucks`, and `registration` omitted on a `NOT_FOUND` blocker — in `apps/api/tests/unit/trucks/lifecycle/bulk/reactivate.spec.ts`
- [X] T032 [P] [US4] Integration tests for `POST /api/v1/trucks/reactivate`: `200` with mixed outcome, `200` with everything blocked, `422` for empty/duplicate/non-UUID ids and an over-long comment, `401`/`403` rejecting the whole submission, rollback leaving nothing reactivated on a commit failure, and overlapping concurrent submissions reactivating each shared truck exactly once — in `apps/api/tests/integration/trucks/lifecycle/bulk/reactivate.spec.ts`
- [X] T033 [P] [US4] Web tests for the happy bulk path: selecting several archived trucks shows the count, reactivating removes them all from the archived tab and updates both counts without a manual refresh, and clearing the selection hides the toolbar — in `apps/web/src/features/trucks/__tests__/bulk/reactivate.test.tsx`
- [X] T034 [P] [US4] Web tests for a mixed outcome: unchanged trucks listed by registration with readable reasons including the archived-provider one, and the retry action resubmitting only those trucks — in `apps/web/src/features/trucks/__tests__/bulk/mixed-reactivate.test.tsx`
- [X] T035 [P] [US4] Web tests for archived-tab selection scoping: selection offered to administrators in both tabs with the action matching the tab, switching lifecycle tab or transport-company filter drops trucks absent from the new scope, a search term does not drop trucks it merely hides, and an archived-tab selection is never carried into an archive action — in `apps/web/src/features/trucks/__tests__/selection/archived-selection.test.tsx`

### Implementation for User Story 4 — API

- [X] T036 [US4] Add `ReactivateTrucksCommand` and the abstract `reactivateArchivedMany` signature (returning the existing `BulkTruckLifecycleResult`) in `apps/api/app/trucks/shared/repositories/truck_repository.ts`
- [X] T037 [US4] Implement `reactivateArchivedMany` in one transaction — submitted trucks loaded `forUpdate()` ordered by `id`, the distinct transport companies of the archived ones loaded `forUpdate()` ordered by `id`, classification via `findBulkBlockers(..., 'ARCHIVED', undefined, archivedCompanyIds)`, one guarded `UPDATE ... WHERE id IN (eligible) AND status = 'ARCHIVED'`, an affected-row assertion, and an ordered preloaded reload — in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`
- [X] T038 [US4] Create `ReactivateTrucksUseCase` delegating to `reactivateArchivedMany` with a once-computed reactivation time, actor, and trimmed comment in `apps/api/app/trucks/reactivate/reactivate_trucks_use_case.ts`
- [X] T039 [US4] Add `reactivateTrucksValidator` (`ids` via `lifecycleIds()`, `comment` via `lifecycleComment()`) in `apps/api/app/trucks/shared/truck_validator.ts`
- [X] T040 [US4] Add the `reactivateMany` action returning `{ updatedTrucks, blockedTrucks }` in `apps/api/app/controllers/trucks_controller.ts`
- [X] T041 [US4] Register `router.post('/reactivate', [controllers.Trucks, 'reactivateMany']).as('reactivate_many')` before the `/:id/reactivate` route in the trucks group of `apps/api/start/routes.ts`, then refresh the generated client types under `apps/api/.adonisjs/`

### Implementation for User Story 4 — Web

- [X] T042 [P] [US4] Widen `BulkTruckLifecycleResult` and `BulkTruckLifecycleBlocker` to cover both the `trucks.archive_many` and `trucks.reactivate_many` route responses in `apps/web/src/features/trucks/types.ts`
- [X] T043 [US4] Add the `reactivateMany` mutation in `apps/web/src/features/trucks/mutations/use-truck-mutations.ts`
- [X] T044 [US4] Add an `isArchived` prop selecting the reactivate mutation, button variant, dialog copy, and toast wording, and add `ALREADY_AVAILABLE` and `TRANSPORT_COMPANY_ARCHIVED` to `formatBlockerReason`, in `apps/web/src/features/trucks/ui/truck-bulk-lifecycle-actions.tsx`
- [X] T045 [US4] Prune `visibleSelectedTruckIds` against the trucks listed in the *active* lifecycle tab instead of returning an empty set outside the available tab, and drop the `truckStatus === 'available'` guard from `lifecycleActionIds` so the retry path works in both directions, in `apps/web/src/features/trucks/ui/trucks-page.tsx`
- [X] T046 [US4] Pass `selectable`, `selectedIds`, and `onSelectionChange` to the archived `TruckSection`, and render the bulk toolbar for administrators in both tabs with the direction it is acting in, in `apps/web/src/features/trucks/ui/trucks-page.tsx`

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T047 [P] Update the `#226` slice row to its delivered status in the slice table of `specs/site-references/transport-resources/trucks/roadmap.md`
- [X] T048 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the worktree root and resolve every finding, confirming in particular that the merged truck archive suites (single, bulk, API and web) still pass after T005/T006 and T019
- [X] T049 Execute the manual browser flow in [quickstart.md](./quickstart.md) §5 in a desktop and a narrow mobile viewport, including step 15's archive regression
- [X] T050 [P] Open a follow-up issue recording the two items in [research.md](./research.md) that this slice deliberately does not fix: the archived-provider escape hatch depends on Reactivate a Transport Company (`#221`), and `archiveAvailableMany` acquires its `forUpdate()` locks without an explicit order
- [X] T051 Obtain a fresh read-only Codex review of the final diff and resolve or explicitly justify every confirmed finding, per Constitution Principle VII

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Independent of Phase 1, but BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2
- **US2 (Phase 4)**: Depends on Phase 2; shares `reactivate_truck_use_case.ts` and `lucid_truck_repository.ts` with US1, so it is sequenced after US1 rather than run alongside it
- **US3 (Phase 5)**: Depends on US1 (needs the dialog and endpoint to fail against) and on US2 (needs the refusal codes to distinguish)
- **US4 (Phase 6)**: Depends on Phase 2, and on T005 in particular since its classification path is the reason the classifier was generalized. Otherwise genuinely independent of US1–US3 — a different endpoint, use case, repository method, and UI surface — so it can be built in parallel by a second developer, with `truck_repository.ts`, `truck_validator.ts`, `trucks_controller.ts`, `routes.ts`, `use-truck-mutations.ts`, and `lucid_truck_repository.ts` as the shared-file merge points
- **Polish (Phase 7)**: Depends on every story being delivered

### Within Each User Story

- Tests are written and confirmed failing before implementation
- Repository contract → repository implementation → use case → validator → controller → route
- API before web, since the web types derive from the generated route contract

### Parallel Opportunities

- T001 and T002 (different workspaces)
- T003 and T004 (different files) — T005, T006, T007, T008 are sequential
- All of T009–T011 (three different test files)
- All of T020–T023 (four different test files; T020–T022 share `reactivate.spec.ts` per suite but are separate cases and can be authored together)
- T027 and T028
- All of T031–T035 (five different test files) — the largest parallel batch
- T036 and T042 within US4; T045 must precede T046, which share `trucks-page.tsx`
- With two developers: US1 → US2 → US3 on one track, US4 on the other, joining at the shared API files

---

## Parallel Example: User Story 4 tests

```bash
# Launch all five US4 test files together (all currently failing):
Task: "Unit tests for reactivateArchivedMany in apps/api/tests/unit/trucks/lifecycle/bulk/reactivate.spec.ts"
Task: "Integration tests for POST /api/v1/trucks/reactivate in apps/api/tests/integration/trucks/lifecycle/bulk/reactivate.spec.ts"
Task: "Web bulk happy path in apps/web/src/features/trucks/__tests__/bulk/reactivate.test.tsx"
Task: "Web mixed outcome in apps/web/src/features/trucks/__tests__/bulk/mixed-reactivate.test.tsx"
Task: "Web archived-tab selection scoping in apps/web/src/features/trucks/__tests__/selection/archived-selection.test.tsx"
```

---

## Implementation Strategy

### Responsible MVP (US1 + US2)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational)
2. Complete Phase 3 (US1) — reactivation works end to end
3. Complete Phase 4 (US2) — reactivation is guarded, and the provider invariant holds under concurrency
4. **STOP and VALIDATE**: run the quickstart §2/§3 checks for single reactivation

US1 alone is demoable but must not ship on its own: without US2 an administrator could return a truck to service under an archived transport company, breaking an invariant the company-archival path actively enforces. Both stories are P1 for that reason.

### Incremental Delivery

1. Setup + Foundational → shared plumbing ready, archive behavior proven unchanged
2. US1 + US2 → single-truck reactivation, safe → demo
3. US3 → refusals become legible and recoverable → demo
4. US4 → multiple reactivation with partial success → demo
5. Polish → gates, browser flow, follow-up issue, fresh review

### Parallel Team Strategy

1. Both developers complete Phase 2 together (it is small and blocking, and T005 gates US4)
2. Developer A: US1 → US2 → US3
3. Developer B: US4, starting from its five test files
4. Coordinate on the six shared files listed under US4 dependencies; everything else is disjoint

---

## Notes

- No migration and no new dependency: `trucks.reactivated_at`, `reactivated_by_user_id`, and `reactivation_comment` already exist and are already read by the truck consultation contract.
- No usage checker is called. An archived truck cannot be reserved by a planned or active discharge — archival refuses exactly that — so there is no usage question on the way back.
- T005 and T006 modify code delivered by `#225`; T008 exists specifically to prove that touch was behavior-neutral, and T048 re-proves it against the final diff.
- T019 changes an existing rendering condition (`truck-details.tsx` renders no footer for archived trucks today), so the merged `#225` details tests are part of the regression surface.
- T024 is the heart of the slice: the company row must be read **under `forUpdate()`**, inside the same transaction as the write. A plain read reintroduces the check-then-act window the invariant cannot tolerate. See [data-model.md](./data-model.md) for the lock ordering and deadlock analysis.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
