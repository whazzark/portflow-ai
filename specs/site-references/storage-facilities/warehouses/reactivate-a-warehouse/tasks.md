---

description: "Task list for Reactivate a Warehouse (GH-211)"
---

# Tasks: Reactivate a Warehouse

> **Amended by [#216 Reactivate a Warehouse Door](../../warehouse-doors/reactivate-a-warehouse-door/spec.md).**
> Archiving a warehouse now takes **every** door it holds and reactivating it gives every one of
> them back, so `warehouse_doors.archived_with_warehouse` is dropped. Where this document reasons
> about the marker, about restoring "exactly the cascaded set", or about leaving independently
> archived doors alone, read `spec.md`'s 2026-08-27 clarification instead. The text is kept as the
> delivery record of what was built at the time.

**Input**: Design documents from `specs/site-references/storage-facilities/warehouses/reactivate-a-warehouse/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Test tasks are **included and mandatory**. Constitution principle IV requires business
behavior to follow RED → GREEN → REFACTOR, so every story writes its failing observable test first.

**Organization**: Tasks are grouped by user story. Within a story, tests precede implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `US1`–`US3`, mapping to the user stories in [spec.md](./spec.md)

## Path Conventions

Monorepo: `apps/api` (AdonisJS) and `apps/web` (TanStack Start). All paths below are
repository-relative and exact.

**No migration is in this list.** Every column this feature writes already exists (research
**D13**), `archived_with_warehouse` included. If you find yourself writing one, re-read
[data-model.md](./data-model.md) first.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the baseline and confirm the test seams `#210` left behind are usable.

- [X] T001 Confirm the baseline is green before touching anything: `pnpm --filter @portflow/api test`, `pnpm --filter @portflow/web test`, `pnpm check`, `pnpm typecheck`. A pre-existing failure must be understood now, not discovered mid-slice
- [X] T002 [P] Verify `apps/api/database/factories/warehouse_door_factory.ts` exposes both the `archived` state (marker stays `false`) and the `archivedWithWarehouse` state (marker `true`); these two are the entire FR-007 vs FR-008 test matrix and need no edit if present
- [X] T003 [P] Add reactivation MSW handlers to `apps/web/src/features/warehouses/__tests__/support/handlers.ts`: `reactivateWarehouseHandler(response)`, `reactivateWarehousesHandler(result)`, plus refusal handlers for `E_WAREHOUSE_NOT_FOUND` (404), `E_WAREHOUSE_ALREADY_AVAILABLE` (409), and `E_VALIDATION_ERROR` (422), mirroring the delivered archive handlers
- [X] T004 [P] Add an archived-warehouse-with-cascaded-doors fixture to `apps/web/src/features/warehouses/__tests__/support/fixtures.ts` — one door `ARCHIVED` with `archivedWithWarehouse: true`, one `ARCHIVED` with `archivedWithWarehouse: false` — so the restore/leave-alone distinction is representable in web tests

**Checkpoint**: Baseline green, and both API and web test suites can express a cascaded archive
state without a prior archive call.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared API primitives every story below needs. Small, because `#210` already built
most of them — the policy, validator, blocker helper, and repository file all exist and only gain a
reactivation member.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Add `WarehouseAlreadyAvailableException` (409, `E_WAREHOUSE_ALREADY_AVAILABLE`, message "Warehouse is already available") to `apps/api/app/warehouses/shared/warehouse_exceptions.ts`, beside the delivered `WarehouseAlreadyArchivedException`
- [X] T006 [P] Add `reactivate(user)` to `apps/api/app/warehouses/shared/warehouse_policy.ts` returning `user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'`, leaving `list`, `create`, and `archive` untouched (research **D7**)
- [X] T007 [P] Add `reactivateWarehouseValidator` (`{ comment: lifecycleComment() }`) and `reactivateWarehousesValidator` (`{ ids: lifecycleIds(), comment: lifecycleComment() }`) to `apps/api/app/warehouses/shared/warehouse_validator.ts`, reusing `apps/api/app/shared/validators/lifecycle_validator.ts` unchanged
- [X] T008 Extend `apps/api/app/warehouses/shared/repositories/warehouse_repository.ts` with `ReactivateWarehouseCommand`, `ReactivateWarehousesCommand`, `ReactivateWarehouseResult` (arms `REACTIVATED` / `NOT_FOUND` / `ALREADY_AVAILABLE` — **no `IN_USE` arm**), and the `reactivateArchived` / `reactivateArchivedMany` abstract methods, per [contracts/warehouse-reactivate-api.md](./contracts/warehouse-reactivate-api.md). Reuse `BulkWarehouseLifecycleResult` unchanged
- [X] T009 Write the failing policy test in `apps/api/tests/unit/warehouses/warehouse_policy.spec.ts` asserting `reactivate` allows only `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, then confirm T006 makes it pass

**Checkpoint**: The reactivation vocabulary exists across policy, validation, exceptions, and the
repository interface. `pnpm typecheck` fails only on `LucidWarehouseRepository` not yet implementing
the two new abstracts — which is the next phase's job.

---

## Phase 3: User Story 1 - Bring One Archived Warehouse and Its Cascaded Doors Back Into Service (Priority: P1) 🎯 MVP

**Goal**: An administrator reactivates one archived warehouse; exactly the doors archived with it
return to service with the same reactivation context, and the marker is cleared on each.

**Independent Test**: Sign in as an administrator, open an archived warehouse on the warehouse map,
reactivate it with a comment, and verify the warehouse and exactly its cascaded doors become
available, doors archived on their own stay archived, archive context survives on both, and
`archivedWithWarehouse` is now `false` on every restored door.

### Tests for User Story 1 ⚠️

> **Write these FIRST and confirm they FAIL before implementing.**

- [X] T010 [P] [US1] Write failing unit tests in `apps/api/tests/unit/warehouses/lifecycle/reactivate.spec.ts` covering: archived warehouse reactivates and records time/actor/comment; already-available refused as `ALREADY_AVAILABLE`; unknown id refused as `NOT_FOUND`; comment trimmed; whitespace-only comment stored as `null`; a refused attempt leaves stored state untouched (FR-004, FR-005, FR-006, FR-011, FR-022)
- [X] T011 [P] [US1] Write failing unit tests in `apps/api/tests/unit/warehouses/lifecycle/door_restore.spec.ts` covering the restore predicate: only doors with `status = 'ARCHIVED' AND archived_with_warehouse = true` are restored; independently archived doors are untouched including their archive context; a warehouse with no doors and one with only independently archived doors both reactivate with `reactivatedDoorCount === 0`; restored doors share the warehouse's exact reactivation time, actor, and comment; `archived_with_warehouse` is `false` afterwards; `archivedAt`/`archivedByUserId`/`archiveComment` survive on both tables (FR-007, FR-008, FR-009, FR-010, FR-015)
- [X] T012 [US1] Write the failing double-cycle test in `apps/api/tests/unit/warehouses/lifecycle/door_restore.spec.ts`: archive W (door D cascades) → reactivate W → archive D on its own → archive W → reactivate W; assert D is **still archived** at the end. This is the only test that catches a missing marker-clearing write (research **D2**, SC-012)
- [X] T013 [P] [US1] Write failing integration tests in `apps/api/tests/integration/warehouses/lifecycle/reactivate.spec.ts` covering `POST /api/v1/warehouses/:id/reactivate`: 200 envelope `{ warehouse, reactivatedDoorCount }` with embedded doors and preserved archive context; 401 unauthenticated; 403 non-administrator and non-active user; 404 unknown id; 409 already available; 422 over-long comment with nothing changed (FR-002, FR-012, contract failure table)
- [X] T014 [P] [US1] Write failing web tests in `apps/web/src/features/warehouses/__tests__/reactivate.test.tsx` covering: the *Reactivate warehouse* action appears for an archived warehouse and not for an available one; the confirmation names the warehouse and its restorable door count; a comment is submitted; the success toast reports `reactivatedDoorCount`; cancelling leaves everything unchanged (FR-018, FR-019)
- [X] T015 [P] [US1] Write failing unit tests in `apps/web/src/features/warehouses/__tests__/warehouse-lifecycle-adapter.test.ts` for `countRestorableDoors` and `describeDoorRestore`, asserting correct agreement at 0, 1, and n doors

### Implementation for User Story 1

- [X] T016 [US1] Implement `applyReactivation(trx, eligibleIds, command)` in `apps/api/app/warehouses/shared/repositories/lucid_warehouse_repository.ts`: conditional `UPDATE` on `warehouses` (`status='ARCHIVED'` guard) asserting the affected-row count equals `eligibleIds.length` and throwing otherwise, then conditional `UPDATE` on `warehouse_doors` keyed on `warehouse_id IN (...) AND status='ARCHIVED' AND archived_with_warehouse = true` setting `status='AVAILABLE'` **and `archived_with_warehouse = false`**, returning the affected door count. Both writes share one timestamp, actor, and comment; neither touches an `archived_*` column (data-model **I1**–**I7**, research **D4**)
- [X] T017 [US1] Implement `reactivateArchived(command)` in `apps/api/app/warehouses/shared/repositories/lucid_warehouse_repository.ts`: `Warehouse.transaction`, `lockWarehouses(trx, [id])` **first** so the warehouses-before-doors lock order matches `archiveAvailable` and an archive/reactivate race queues instead of deadlocking (research **D3**), then `NOT_FOUND` / `ALREADY_AVAILABLE` branches, then `applyReactivation`, then reload through `withRelations` so `footprintPoints` and `doors` are preloaded for the transformer
- [X] T018 [US1] Create `apps/api/app/warehouses/reactivate/reactivate_warehouse_use_case.ts` calling `repository.reactivateArchived` with `input.comment?.trim() || null`, mapping `NOT_FOUND` → `WarehouseNotFoundException` and `ALREADY_AVAILABLE` → `WarehouseAlreadyAvailableException`, and returning `{ warehouse, reactivatedDoorCount }`, mirroring `archive/archive_warehouse_use_case.ts`
- [X] T019 [US1] Add the `reactivate` action to `apps/api/app/controllers/warehouses_controller.ts`: authorize `reactivate`, validate with `reactivateWarehouseValidator`, call the use case with `DateTime.now()` and the authenticated user id, and serialize `{ warehouse: WarehouseTransformer.transform(...), reactivatedDoorCount }` — the envelope, not the bare resource (research **D5**)
- [X] T020 [US1] Register `router.post('/:id/reactivate', [controllers.Warehouses, 'reactivate']).as('reactivate')` in the `/warehouses` group of `apps/api/start/routes.ts`
- [X] T021 [US1] Regenerate the Tuyau registry by running the API once (`pnpm --filter @portflow/api test` triggers the `generateRegistry` init hook) so `warehouses.reactivate` becomes available to the web client; confirm `apps/web/src/features/warehouses/types.ts` still typechecks without edits, since its DTOs derive from the read contract
- [X] T022 [P] [US1] Add `countRestorableDoors(warehouse)` (doors where `status === 'ARCHIVED' && archivedWithWarehouse === true`) and `describeDoorRestore(count)` to `apps/web/src/features/warehouses/warehouse-lifecycle-adapter.ts`, with the 0/1/n wording from [contracts/warehouse-reactivate-ui-state.md](./contracts/warehouse-reactivate-ui-state.md); document the count as advisory exactly as the archive counterparts are
- [X] T023 [US1] Add the `reactivate` mutation to `apps/web/src/features/warehouses/mutations/use-warehouse-mutations.ts` with `onSuccess: () => invalidateWarehouses()`, symmetric with `archive`
- [X] T024 [US1] Make `apps/web/src/features/warehouses/ui/warehouse-lifecycle-actions.tsx` two-directional: remove the `status === 'ARCHIVED'` early return, and render *Archive warehouse* (destructive) for an available warehouse or *Reactivate warehouse* (default variant) for an archived one, sharing one dialog, one comment field with `maxLength={1000}`, the stay-open-on-failure behavior, and the `error.details?.[0]?.message` extraction (research **D8**)
- [X] T025 [US1] In `apps/web/src/features/warehouses/ui/warehouse-details.tsx`, rename the `canArchive` prop to `canManageLifecycle` and render the lifecycle footer for **both** statuses, so an archived warehouse exposes its reactivate action
- [X] T026 [US1] Update the `WarehouseDetails` call site in `apps/web/src/features/warehouses/ui/warehouses-page.tsx` to pass `canManageLifecycle={canManageWarehouses}`, and confirm `pnpm typecheck` reports no other call site

**Checkpoint**: US1 is fully functional and independently testable. One archived warehouse can be
reactivated end to end from the map, its cascaded doors return with it, and the marker is cleared.
This is a shippable MVP on its own — bulk reactivation is additive.

---

## Phase 4: User Story 2 - Reactivate a Selection of Archived Warehouses Together (Priority: P1)

**Goal**: An administrator selects several archived warehouses on the map and reactivates the
eligible ones in one action, with partial success and per-warehouse reasons.

**Independent Test**: Select a mix of archived warehouses, already-available warehouses, and one
identifier that resolves to nothing; submit one reactivation with a shared comment; verify every
archived one is reactivated with its cascaded doors, every blocked one is untouched, and each blocked
one is named with `NOT_FOUND` or `ALREADY_AVAILABLE`.

### Tests for User Story 2 ⚠️

- [X] T027 [P] [US2] Write failing unit tests in `apps/api/tests/unit/warehouses/lifecycle/bulk_reactivate.spec.ts` covering: an all-archived selection reactivates every warehouse with its cascaded doors; a mixed selection applies partial success with exactly one reason per blocked warehouse; an all-blocked selection changes nothing and reports every entry; every warehouse and door in one submission shares an identical time, actor, and comment; the comment is recorded against no warehouse the submission did not reactivate (FR-030, FR-031, FR-032)
- [X] T028 [P] [US2] Extend `apps/api/tests/unit/warehouses/lifecycle/bulk_reactivate.spec.ts` with the all-or-nothing case: a failure part-way through leaves zero warehouses and zero doors reactivated, and the same selection can be retried (FR-033, FR-034)
- [X] T029 [P] [US2] Write failing integration tests in `apps/api/tests/integration/warehouses/lifecycle/bulk_reactivate.spec.ts` covering `POST /api/v1/warehouses/reactivate`: 200 with `{ updatedWarehouses, blockedWarehouses }` in submission order; **route order** — the bulk path must not resolve as `:id = 'reactivate'`; 403 for a non-administrator; 422 for empty, duplicated, and malformed selections with nothing changed (FR-035, contract route-order note)
- [X] T030 [P] [US2] Write failing web tests in `apps/web/src/features/warehouses/__tests__/bulk-reactivate.test.tsx` covering: select mode over archived warehouses yields a **Reactivate** action bar, not Archive; a partial outcome toast reports counts and names each blocked warehouse with its reason; the selection narrows to the blocked ids so a retry needs no reselection (FR-036, FR-037)
- [X] T031 [P] [US2] Extend `apps/web/src/features/warehouses/__tests__/selection-scope.test.tsx` with reactivation scope cases: with an archived warehouse checked, available warehouses are **not** checkable even under the `all` filter; with nothing checked, either status may start a selection; switching the lifecycle filter drops what it no longer lists while a search term never prunes the selection (FR-038). Existing archival assertions must survive unchanged

### Implementation for User Story 2

- [X] T032 [US2] Implement `reactivateArchivedMany(command)` in `apps/api/app/warehouses/shared/repositories/lucid_warehouse_repository.ts`: one transaction, `lockWarehouses` ordered by id, `findBulkBlockers(command.ids, indexById(warehouses), 'ARCHIVED')` with **no `usedIds` argument** so `IN_USE` cannot fire (research **D6**), then `applyReactivation` over the eligible ids, then reload through `withRelations` and return `orderByIds(eligibleIds, ...)` so output follows submission order
- [X] T033 [US2] Create `apps/api/app/warehouses/reactivate/reactivate_warehouses_use_case.ts` as a pass-through applying `input.comment?.trim() || null`, returning `BulkWarehouseLifecycleResult` and throwing nothing — every per-warehouse refusal is data, mirroring `archive/archive_warehouses_use_case.ts`
- [X] T034 [US2] Add the `reactivateMany` action to `apps/api/app/controllers/warehouses_controller.ts`: authorize `reactivate`, validate with `reactivateWarehousesValidator`, and serialize `{ updatedWarehouses: WarehouseTransformer.transform(...), blockedWarehouses }`
- [X] T035 [US2] Register `router.post('/reactivate', [controllers.Warehouses, 'reactivateMany']).as('reactivate_many')` in `apps/api/start/routes.ts` **before** the `/:id/reactivate` route from T020, and carry a comment recording why the order matters, as the archive routes already do
- [X] T036 [US2] Add the `reactivateMany` mutation to `apps/web/src/features/warehouses/mutations/use-warehouse-mutations.ts` **without** an `onSuccess` invalidation — the action bar owns when to refresh after reading a partial outcome, exactly as `archiveMany` does
- [X] T037 [P] [US2] Add `describeBulkDoorRestore(warehouseCount, restorableDoors)` and `countRestorableDoorsIn(warehouses)` to `apps/web/src/features/warehouses/warehouse-lifecycle-adapter.ts`, keeping each clause's grammatical agreement independent as `describeBulkDoorCascade` does
- [X] T038 [US2] Derive the bulk intent in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`: add a `selectionIntent` memo returning `undefined` when nothing is checked and otherwise `REACTIVATE`/`ARCHIVE` from the first checked warehouse's status, plus `bulkIntent = selectionIntent ?? (status === 'archived' ? 'REACTIVATE' : 'ARCHIVE')`, following `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx:145-152` (research **D9**)
- [X] T039 [US2] Widen `checkableIds` in `apps/web/src/features/warehouses/ui/warehouses-page.tsx` to admit warehouses whose status matches the current intent, or either status while nothing is checked, so a selection stays homogeneous by construction. Leave the existing pruning effect untouched — it already delivers FR-038
- [X] T040 [US2] Wire the reactivation branch into the `BulkResourceLifecycleActions` instance in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`: pass `intent={bulkIntent}`, the intent-appropriate `description`, and a `submit` that calls `reactivateMany` through `toBulkLifecycleOutcome`; **omit the `IN_USE` label override when the intent is `REACTIVATE`**, since that archival-specific wording would be wrong on a path where the reason cannot occur
- [X] T041 [US2] Make the Ctrl/Cmd+A select-all handler in `apps/web/src/features/warehouses/ui/warehouses-page.tsx` intent-aware: with nothing checked it prefers `REACTIVATE` when the lifecycle filter is `archived`, matching `checkpoints-page.tsx:288`

**Checkpoint**: US1 and US2 both work independently. A single warehouse and a selection can each be
reactivated, with the shared bulk bar reading Reactivate and reporting partial success.

---

## Phase 5: User Story 3 - Reject Invalid Submissions and Protect What Must Not Change (Priority: P2)

**Goal**: Every refusal path holds — authorization, validation, eligibility, concurrency — with
nothing changed and distinct, actionable feedback.

**Independent Test**: Attempt reactivation with an empty, duplicated, and malformed selection, with
an over-long comment, and as an unauthenticated visitor, a non-active user, and each active
non-administrator role; verify every attempt is refused before any warehouse or door changes.

**Note**: Most of this story's *enforcement* lands with US1 and US2 — the validators, the policy, and
the blocker branches are already wired by then. This phase is deliberately test-heavy: its job is to
prove the guard rails hold, and to add the one piece of UI that only exists for refusals.

### Tests for User Story 3 ⚠️

- [X] T042 [P] [US3] Extend `apps/api/tests/unit/warehouses/lifecycle/comment_validation.spec.ts` with reactivation cases: a 1,000-character comment is accepted, 1,001 is refused with no lifecycle change to any warehouse or door in the submission, and a whitespace-only comment is stored as `null` on the warehouse and on every restored door (FR-011, FR-012)
- [X] T043 [P] [US3] Write failing integration tests asserting invalid selections are rejected **before evaluation** in `apps/api/tests/integration/warehouses/lifecycle/bulk_reactivate.spec.ts`: empty `ids`, the same id twice (including differing letter case), and a non-UUID identifier each return 422 with zero rows changed — deliberately distinct from a well-formed unknown id, which is reported per warehouse as `NOT_FOUND` (FR-035)
- [X] T044 [P] [US3] Write failing authorization integration tests covering both endpoints in `apps/api/tests/integration/warehouses/lifecycle/reactivate.spec.ts` and `bulk_reactivate.spec.ts`: unauthenticated → 401; non-active user and every active non-administrator role → 403; no warehouse or door changes and no warehouse data disclosed (FR-002, FR-028)
- [X] T045 [US3] Write the failing concurrency test in `apps/api/tests/integration/warehouses/lifecycle/reactivate.spec.ts`: two overlapping submissions containing the same archived warehouse resolve to exactly one recorded reactivation of the warehouse and of each cascaded door, with the loser reporting `ALREADY_AVAILABLE` and zero contexts overwritten (FR-020, SC-008)
- [X] T046 [US3] Write the failing archive/reactivate race test in `apps/api/tests/integration/warehouses/lifecycle/reactivate.spec.ts`: concurrent archive and reactivate of the same warehouse never leave a warehouse available while a cascaded door stays archived, nor a door available under an archived warehouse (data-model **I1**/**I2**, research **D3**)
- [X] T047 [P] [US3] Write failing web tests in `apps/web/src/features/warehouses/__tests__/feedback-reactivate.test.tsx` covering distinct messaging for 404, 409 `ALREADY_AVAILABLE`, 422 validation (surfacing the field-level detail, not "Validation failure"), and a transient failure — and that the dialog stays open with the typed comment intact so a corrected resubmission needs no reopening (FR-041)
- [X] T048 [P] [US3] Extend `apps/web/src/features/warehouses/__tests__/authorization.test.tsx` so a non-administrator sees no reactivate action and no select control, and `/warehouses?selecting=warehouses` stays inert for them (FR-024, FR-039)

### Implementation for User Story 3

- [X] T049 [US3] Make every refusal path in `apps/web/src/features/warehouses/ui/warehouse-lifecycle-actions.tsx` produce distinct, actionable feedback for the reactivate direction — a not-found, already-available, validation, and transient failure must not collapse into one message — reusing the delivered `parseApiError` detail extraction
- [X] T050 [US3] Resolve any gap the T042–T048 tests expose across `apps/api/app/warehouses/` and `apps/web/src/features/warehouses/`; if all pass unchanged, record that explicitly in the PR description rather than leaving the phase silently empty

**Checkpoint**: All three stories are independently functional, and every refusal condition in the
spec has a test proving nothing changed.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T051 Extend the `Warehouse` entry in `CONTEXT.md` (line 152) to state that reactivating a warehouse restores exactly the doors archived with it, records the same reactivation context on them, and clears that record — so the canonical entry describes both directions. **Part of this delivery, not a follow-up** (Constitution VI, research **D12**)
- [ ] T052 [P] **NOT DONE — no Playwright harness exists in this repository** (no `playwright.config`, no `apps/web/e2e/`, no dependency; the path was inherited aspirationally from `#210`'s quickstart). Introducing one is an infrastructure decision outside this slice. If added later: the end-to-end journey for `apps/web/e2e/` is: sign in as an administrator, archive a warehouse with available doors, reactivate it, and assert the restored doors show as available with no stale "Archived with this warehouse" line, plus a bulk reactivation with a partial outcome
- [X] T053 Run the delivered `#210` regression net unchanged — `warehouses/lifecycle/archive`, `bulk_archive`, `door_cascade` (API) and `warehouses/__tests__/archive`, `bulk-archive` (web). Any edit needed here means this slice changed archival behavior and must be justified or reverted; `selection-scope` is the one file legitimately expected to gain cases. **Ran unchanged.** `bulk-archive` later gained one *added* case — no delivered assertion was edited — for the archive-direction consequence of giving the toolbar two intents: a blocked set mixing `IN_USE` and `ALREADY_ARCHIVED` must keep only the `IN_USE` warehouse checked, or the selection stops being homogeneous and its intent depends on blocker order (see T056)
- [X] T054 [P] Verify `apps/web/src/features/warehouse-doors/ui/warehouse-doors-panel.tsx` needs **no** change: a restored door must render as available with no archive provenance line, which its existing `status === 'ARCHIVED'` gate already delivers (research **D11**). Confirm by test rather than by reading
- [ ] T055 **NOT DONE — the shared dev database is in another worktree's migration state** (`add_truck_return_to_service` is applied but missing on this branch, so `migration:status` reports it corrupt). `db:fresh` would destroy that session's data. Run after reseeding on an isolated database: walk the browser flow in [quickstart.md](./quickstart.md) end to end, including the homogeneous-selection check and the non-administrator case
- [ ] T056 Constitution VII verification gate: `pnpm check` ✅ (742 files), `pnpm typecheck` ✅, `pnpm test` ✅ (API 747, web 711) — **the browser flow (T055) and the fresh read-only Codex review of the final diff remain outstanding**; the review is user-triggered. A `/code-review` pass ran on the final diff and found three web-side defects, all fixed here with a regression test each: the bulk `onSuccess` re-checked blocked ids in both directions (a refused reactivation came back as an *archival* offer over the same warehouse); `describeBulkDoorRestore` hardcoded "it" where the plural subject required "them"; and the single confirmation read its direction from the live status, so a refetch under the deliberately-open dialog could retitle it and rewire its button to the opposite lifecycle change
- [X] T057 Update the `#211` row in `specs/site-references/storage-facilities/warehouses/roadmap.md` from `specified` to `implemented`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **blocks all user stories**
- **US1 (Phase 3)**: Depends on Foundational. No dependency on US2 or US3
- **US2 (Phase 4)**: Depends on Foundational. Shares `lucid_warehouse_repository.ts`, `warehouses_controller.ts`, `routes.ts`, `use-warehouse-mutations.ts`, `warehouse-lifecycle-adapter.ts`, and `warehouses-page.tsx` with US1, so it is **file-serialized behind US1** even though it is behaviorally independent
- **US3 (Phase 5)**: Depends on US1 and US2 existing to test against
- **Polish (Phase 6)**: Depends on all desired stories being complete

### Critical path

```
T001 → T005–T008 → T016 → T017 → T018 → T019 → T020 → T021 → T024 → T032 → T034 → T038 → T039 → T040 → T051 → T056
```

`T016` (`applyReactivation`) is the single highest-leverage task: both stories' repository methods
call it, and both the marker-clearing write (FR-009) and the all-or-nothing guard (FR-021) live
inside it.

### Within each user story

- Tests are written and **must fail** before implementation (Constitution IV)
- Repository → use case → controller → route → contract regeneration → web mutation → web UI
- `T021` (Tuyau regeneration) gates every web task in US1; `T035` does the same for US2

### Parallel opportunities

- **Phase 1**: T002, T003, T004 in parallel
- **Phase 2**: T005, T006, T007 in parallel; T008 alone (its file is shared); T009 after T006
- **US1 tests**: T010, T011, T013, T014, T015 in parallel — five distinct files. T012 follows T011 (same file)
- **US1 impl**: T022 is parallel to the API chain (different package); T016→T017 and T024→T025→T026 are each serial within their file
- **US2 tests**: T027–T031 in parallel
- **US2 impl**: T037 is parallel to the API chain; T038–T041 all touch `warehouses-page.tsx` and **must run serially**
- **US3**: T042, T043, T044, T047, T048 in parallel. T045 then T046 follow T044 serially — all three write `integration/.../reactivate.spec.ts`
- **Polish**: T052 and T054 in parallel with the rest

### Same-file serialization (do not parallelize)

| File | Tasks |
|---|---|
| `lucid_warehouse_repository.ts` | T016, T017, T032 |
| `warehouses_controller.ts` | T019, T034 |
| `start/routes.ts` | T020, T035 |
| `use-warehouse-mutations.ts` | T023, T036 |
| `warehouse-lifecycle-adapter.ts` | T022, T037 |
| `warehouses-page.tsx` | T026, T038, T039, T040, T041 |
| `warehouse-lifecycle-actions.tsx` | T024, T049 |
| `bulk_reactivate.spec.ts` (integration) | T029, T043, T044 |
| `reactivate.spec.ts` (integration) | T013, T044, T045, T046 |
| `door_restore.spec.ts` | T011, T012 |

---

## Parallel Example: User Story 1

```bash
# Launch all six US1 test tasks together — six distinct files, no shared state:
Task: "Unit tests for single reactivation in apps/api/tests/unit/warehouses/lifecycle/reactivate.spec.ts"
Task: "Unit tests for the door restore predicate in apps/api/tests/unit/warehouses/lifecycle/door_restore.spec.ts"
Task: "Integration tests in apps/api/tests/integration/warehouses/lifecycle/reactivate.spec.ts"
Task: "Web dialog tests in apps/web/src/features/warehouses/__tests__/reactivate.test.tsx"
Task: "Adapter unit tests in apps/web/src/features/warehouses/__tests__/warehouse-lifecycle-adapter.test.ts"

# Then the API chain runs serially (one file), while T022 proceeds in parallel in apps/web.
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup
2. Phase 2: Foundational — **blocks everything**
3. Phase 3: User Story 1
4. **STOP and VALIDATE**: reactivate one archived warehouse end to end, confirm the door restore and
   the cleared marker, run the `#210` regression net
5. Shippable: an administrator can bring a warehouse back into service, one at a time

### Incremental Delivery

1. Setup + Foundational → reactivation vocabulary exists
2. US1 → single reactivation with door restore → **MVP**
3. US2 → bulk reactivation with partial success
4. US3 → refusal paths proven
5. Polish → `CONTEXT.md`, E2E, verification gate

### Parallel Team Strategy

Limited by file sharing rather than by story independence. US1 and US2 touch the same six files, so
splitting them across two developers will conflict. The realistic split is **API and web**: one
developer takes T016–T021 and T032–T035 while the other takes T022–T026 and T036–T041, synchronizing
at the Tuyau regeneration points (T021, then after T035).

---

## Notes

- `[P]` = different files, no dependency on an incomplete task
- Verify every test fails before implementing it (Constitution IV)
- Commit per task or logical group, Conventional Commits, never on `master`
- The two tests most worth writing carefully are **T012** (double cycle — the only one that catches a
  missing marker clear) and **T046** (archive/reactivate race — the only one that exercises the lock
  order). Every simpler test passes without either mechanism being correct
- Do **not** add a migration; every column already exists (research **D13**)
