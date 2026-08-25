---

description: "Task list for Archive a Warehouse (GH-210)"
---

# Tasks: Archive a Warehouse

**Input**: Design documents from `specs/site-references/storage-facilities/warehouses/archive-a-warehouse/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Test tasks are **included and mandatory**. Constitution principle IV requires business
behavior to follow RED → GREEN → REFACTOR, so every story writes its failing observable test first.

**Organization**: Tasks are grouped by user story. Within a story, tests precede implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `US1`–`US4`, mapping to the user stories in [spec.md](./spec.md)

## Path Conventions

Monorepo: `apps/api` (AdonisJS) and `apps/web` (TanStack Start). All paths below are
repository-relative and exact.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Land the schema change every later task depends on.

- [X] T001 Create migration `apps/api/database/migrations/<timestamp>_add_archived_with_warehouse_to_warehouse_doors.ts` adding `archived_with_warehouse` to `warehouse_doors` as `boolean NOT NULL DEFAULT false`, per [data-model.md](./data-model.md) (research **D2**)
- [X] T002 Run `pnpm --filter @portflow/api db:migrate` to apply T001 and regenerate `apps/api/database/schema.ts`; confirm `WarehouseDoorSchema.$columns` now lists `archivedWithWarehouse` and that the file's "DO NOT EDIT manually" banner is intact
- [X] T003 [P] Add `archivedWithWarehouse: false` to the factory defaults and an `archivedWithWarehouse` state in `apps/api/database/factories/warehouse_door_factory.ts` so tests can build a door that was archived by a cascade

**Checkpoint**: `pnpm --filter @portflow/api test` still green on the new schema. Seeded archived
doors correctly default to `archived_with_warehouse = false` — they were not archived by a cascade.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The warehouse lifecycle slice does not exist yet — `apps/api/app/warehouses/` holds
only `list/`. This phase creates the shared primitives every story below needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] Create `apps/api/app/warehouses/shared/warehouse_exceptions.ts` with `WarehouseNotFoundException` (404, `E_WAREHOUSE_NOT_FOUND`), `WarehouseAlreadyArchivedException` (409, `E_WAREHOUSE_ALREADY_ARCHIVED`), and `WarehouseInUseException` (409, `E_WAREHOUSE_IN_USE`, message naming the blocking door cause), following `apps/api/app/weighing_areas/shared/weighing_area_exceptions.ts`
- [X] T005 [P] Create `apps/api/app/warehouses/shared/warehouse_validator.ts` exporting `archiveWarehouseValidator` (`{ comment: lifecycleComment() }`) and `archiveWarehousesValidator` (`{ ids: lifecycleIds(), comment: lifecycleComment() }`), reusing `apps/api/app/shared/validators/lifecycle_validator.ts` unchanged
- [X] T006 [P] Create `apps/api/app/warehouses/shared/warehouse_lifecycle_blockers.ts` with `WarehouseLifecycleRecord`, `BulkWarehouseLifecycleBlocker`, and `findBulkBlockers(ids, byId, expectedStatus, usedWarehouseIds)`, mirroring `weighing_area_lifecycle_blockers.ts` including the `expectedStatus` parameter and unreachable `ALREADY_AVAILABLE` member so `#211` can reuse it (research **D11**)
- [X] T007 [P] Add `archive(user)` to `apps/api/app/warehouses/shared/warehouse_policy.ts` returning `user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'`, leaving `list` untouched
- [X] T008 [P] Write the failing transformer test in `apps/api/tests/unit/warehouses/consultation/transformer.spec.ts` asserting `WarehouseTransformer` emits warehouse lifecycle context and per-door lifecycle context including `archivedWithWarehouse` (research **D8**)
- [X] T009 Extend `apps/api/app/warehouses/shared/warehouse_transformer.ts` to emit `archivedAt`, `archivedByUserId`, `archiveComment`, `reactivatedAt`, `reactivatedByUserId`, `reactivationComment`, `createdAt`, `updatedAt` on the warehouse and the same set plus `archivedWithWarehouse` on each door, making T008 pass
- [X] T010 Extend `apps/api/app/warehouses/shared/repositories/warehouse_repository.ts` with `findById`, `archiveAvailable`, and `archiveAvailableMany` signatures plus the `ArchiveWarehouseCommand`/`ArchiveWarehousesCommand`/`ArchiveWarehouseResult`/`BulkWarehouseLifecycleResult` types from [data-model.md](./data-model.md)
- [X] T011 [P] Widen `apps/web/src/features/warehouses/types.ts` with the lifecycle context fields, `BulkWarehouseLifecycleResult`, and the blocker type; `WarehouseDto` derives from `Route.Response<'warehouses.index'>` so it follows the regenerated Tuyau contract automatically
- [X] T012 [P] Widen the hand-written MSW fixtures in `apps/web/src/features/warehouses/__tests__/support/fixtures.ts` and `apps/web/src/features/warehouse-doors/__tests__/support/` with the new lifecycle fields — these do **not** follow contract regeneration and will otherwise fail the web suites (research **D8**)

**Checkpoint**: The slice's shared primitives exist and `GET /warehouses` now carries lifecycle
context. Existing `#207`/`#212` consumers are unaffected — the change is purely additive.

---

## Phase 3: User Story 1 - Retire a Warehouse and Its Doors From Operational Use (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator archives one eligible warehouse; its available doors are
archived with it, sharing one archive time, actor, and comment, while everything else is preserved.

**Independent Test**: Sign in as an administrator, archive the seeded `socomac` warehouse, and verify
it leaves the available collection, appears archived with its context, keeps its name and complete
footprint, and that `Porte Quai` is archived under it with the same context. Then archive `sica` and
verify `Porte Nord` is archived while `Porte Historique` keeps its original context.

### Tests for User Story 1 ⚠️

> Write these first and confirm they FAIL before implementing.

- [X] T013 [P] [US1] Unit test the archive happy path in `apps/api/tests/unit/warehouses/lifecycle/archive.spec.ts`: status becomes `ARCHIVED`, archive time/actor/comment recorded, comment trimmed, whitespace-only comment stored as `null` (FR-010, FR-014)
- [X] T014 [P] [US1] Unit test the door cascade in `apps/api/tests/unit/warehouses/lifecycle/door_cascade.spec.ts`: available doors become archived with the warehouse's exact context and `archivedWithWarehouse = true` (FR-011, FR-013); already-archived doors keep their original time, actor, and comment and stay `archivedWithWarehouse = false` (FR-012); a warehouse with no doors archives successfully (FR-009)
- [X] T015 [P] [US1] Unit test preservation in `apps/api/tests/unit/warehouses/lifecycle/archive.spec.ts`: warehouse `name`, `createdAt`, every footprint point in `position` order, and prior reactivation context are unchanged (FR-016); each door's `name`, `latitude`, `longitude`, containing warehouse, and prior reactivation context are unchanged (FR-017)
- [X] T016 [P] [US1] Integration test `POST /api/v1/warehouses/:id/archive` in `apps/api/tests/integration/warehouses/lifecycle/archive.spec.ts` asserting the `200` body shape from [contracts/warehouse-archive-api.md](./contracts/warehouse-archive-api.md), including embedded doors and `archivedDoorCount`
- [X] T017 [P] [US1] Web feature test in `apps/web/src/features/warehouses/__tests__/archive.test.tsx`: an administrator opens a warehouse, sees the archive action, the confirmation names the warehouse and its available-door count, confirming archives it, and the refreshed view shows the warehouse and its doors archived

### Implementation for User Story 1

- [X] T018 [US1] Implement `findById` in `apps/api/app/warehouses/shared/repositories/lucid_warehouse_repository.ts`, preloading `footprintPoints` ordered by `position` and `doors` with the same ordering `list()` uses
- [X] T019 [US1] Implement `archiveAvailable` in `apps/api/app/warehouses/shared/repositories/lucid_warehouse_repository.ts` as one `Warehouse.transaction`: lock the warehouse then its doors with `orderBy('id').forUpdate()` (warehouses table first, always), conditionally update `warehouses where status = 'AVAILABLE'`, then `warehouse_doors where warehouse_id = ? and status = 'AVAILABLE'` setting `archivedWithWarehouse = true` and the same timestamp/actor/comment; return `ARCHIVED` with `archivedDoorCount`, or the `NOT_FOUND`/`ALREADY_ARCHIVED` outcome (research **D3**, FR-027)
- [X] T020 [US1] Create `apps/api/app/warehouses/archive/archive_warehouse_use_case.ts` taking `{ id, archivedByUserId, archivedAt, comment }`, delegating to the repository and mapping its typed outcome onto the named exceptions from T004
- [X] T021 [US1] Add `archive()` to `apps/api/app/controllers/warehouses_controller.ts`: `auth.use('web').getUserOrFail()`, `bouncer.with(WarehousePolicy).authorize('archive')`, `request.validateUsing(archiveWarehouseValidator)`, then serialize the transformed warehouse plus `archivedDoorCount`
- [X] T022 [US1] Register `router.post('/:id/archive', [controllers.Warehouses, 'archive']).as('archive')` inside the existing `/warehouses` group in `apps/api/start/routes.ts`
- [X] T023 [P] [US1] Create `apps/web/src/features/warehouses/mutations/use-warehouse-mutations.ts` exposing `archive` and a `refreshWarehouses` invalidation of `warehouseQueries.list()`, following `use-weighing-area-mutations.ts`
- [X] T024 [US1] Create `apps/web/src/features/warehouses/ui/warehouse-lifecycle-actions.tsx`: an archive button plus an `AlertDialog` stating the warehouse remains readable but is no longer selectable for new operational work and how many of its available doors are archived with it, computed as `warehouse.doors.filter(d => d.status === 'AVAILABLE').length` (research **D9**, FR-023), with an optional 1,000-character comment and a cancel that changes nothing (FR-024)
- [X] T025 [US1] Render the archive action and the warehouse's archive context (time, actor, comment) in `apps/web/src/features/warehouses/ui/warehouse-details.tsx`
- [X] T026 [US1] Show each door's archive context in `apps/web/src/features/warehouse-doors/ui/warehouse-doors-panel.tsx` so a cascaded door's shared context and an independently archived door's original context are both visible (FR-012)

**Checkpoint**: One warehouse can be archived end to end, its doors cascade correctly, and nothing
else changes. This is a demonstrable increment — but see the MVP note in Implementation Strategy
before shipping it alone.

---

## Phase 4: User Story 2 - Protect Warehouses Whose Doors Current Work Depends On (Priority: P1)

**Goal**: Archival is refused when a door of the warehouse is in current use, when the warehouse is
already archived or unknown, and for every unauthorized caller — leaving warehouse and doors intact.

**Independent Test**: Attempt archival as an unauthenticated visitor, as each non-administrator
active role, on a warehouse whose door holds a current product lot assignment in a Planned or Active
discharge, and on an already-archived warehouse. Every attempt is refused, no warehouse and no door
changes state, and each refusal carries a specific reason.

### Tests for User Story 2 ⚠️

- [X] T027 [P] [US2] Unit test `apps/api/tests/unit/warehouses/warehouse_policy.spec.ts`: `archive` allows `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN` only, and `list` is unchanged
- [X] T028 [P] [US2] Unit test eligibility in `apps/api/tests/unit/warehouses/lifecycle/archive.spec.ts`: unknown id refuses as not found (FR-003); already-archived refuses and leaves existing context untouched (FR-004); a warehouse with a door holding a current product lot assignment in a Planned/Active discharge refuses as in use with warehouse and doors unchanged (FR-005)
- [X] T029 [P] [US2] Unit test the usage derivation in `apps/api/tests/unit/warehouses/lifecycle/door_usage.spec.ts`: usage comes from the `WAREHOUSE_DOOR` checker, doors involved only through Closed discharges or ended assignments do **not** block (FR-007), and usage is assessed at submission time rather than at read time (FR-008)
- [X] T030 [P] [US2] Integration test the refusal matrix in `apps/api/tests/integration/warehouses/lifecycle/archive.spec.ts`: `401` unauthenticated, `403` active non-administrator, `404` `E_WAREHOUSE_NOT_FOUND`, `409` `E_WAREHOUSE_ALREADY_ARCHIVED`, `409` `E_WAREHOUSE_IN_USE` — each asserting zero lifecycle change and that `401`/`403` disclose nothing about existence (FR-002)
- [X] T031 [P] [US2] Web feature test in `apps/web/src/features/warehouses/__tests__/authorization.test.tsx`: an active non-administrator sees no archive action anywhere in the warehouse workspace (FR-030)

### Implementation for User Story 2

- [X] T032 [US2] Inject `SiteReferenceUsageChecker` into `apps/api/app/warehouses/archive/archive_warehouse_use_case.ts` and assess eligibility before delegating: load the warehouse's door ids, call `findUsedByPlannedOrActiveDischarge({ referenceType: 'WAREHOUSE_DOOR', referenceIds })`, and throw `WarehouseInUseException` when the result is non-empty (research **D1**, FR-005, FR-006)
- [X] T033 [US2] Complete the use case's outcome mapping so a race lost after the pre-check still surfaces as `ALREADY_ARCHIVED` rather than a silent success, and every refusal leaves stored state untouched (FR-028)
- [X] T034 [US2] Gate the archive action in `apps/web/src/features/warehouses/ui/warehouse-details.tsx` on `isAdministrator(user)` from `apps/web/src/features/auth/policies/permissions.ts`, with server-side authorization remaining authoritative (FR-030)

**Checkpoint**: Both P1 stories are complete. Archival is safe: it can never invalidate live
unloading work, and only administrators can perform it.

---

## Phase 5: User Story 3 - Understand and Recover From a Refused Archival (Priority: P2)

**Goal**: Every refusal explains itself distinctly and leaves a safe retry path, with no partial
state and no double archival.

**Independent Test**: Trigger an in-use conflict, an already-archived conflict, a stale-view
conflict, an over-long comment, and a transient failure in turn. Each produces distinct guidance,
neither warehouse nor door state is ever ambiguous, and retrying after the blocker clears archives
exactly once.

### Tests for User Story 3 ⚠️

- [X] T035 [P] [US3] Unit test idempotency in `apps/api/tests/unit/warehouses/lifecycle/archive.spec.ts`: repeated and concurrent archival of the same warehouse records exactly one archival with one context, the loser refusing as already archived, and its doors archived exactly once (FR-026)
- [X] T036 [P] [US3] Unit test comment validation in `apps/api/tests/unit/warehouses/lifecycle/archive.spec.ts`: a comment over 1,000 characters is refused with a validation reason and no lifecycle change to warehouse or doors (FR-015)
- [X] T037 [P] [US3] Integration test `422` responses in `apps/api/tests/integration/warehouses/lifecycle/archive.spec.ts` and assert every refusal code is distinct across the matrix (FR-025)
- [X] T038 [P] [US3] Web feature test in `apps/web/src/features/warehouses/__tests__/feedback.test.tsx`: on refusal the dialog stays open, the typed comment survives, the error names the specific cause, shortening an over-long comment and resubmitting succeeds, and the displayed lifecycle state matches the authoritative state after any refusal

### Implementation for User Story 3

- [X] T039 [US3] Map each API failure to a distinct, actionable message in `apps/web/src/features/warehouses/ui/warehouse-lifecycle-actions.tsx`, surfacing `parseApiError(cause).details?.[0]?.message ?? error.message` so a validation failure shows its field-level detail rather than "Validation failure" (FR-025)
- [X] T040 [US3] Keep the dialog open on failure in `apps/web/src/features/warehouses/ui/warehouse-lifecycle-actions.tsx` — `setOpen(false)` only on success, with `event.preventDefault()` in the confirm handler so Radix does not close it (US3 scenario 6)
- [X] T041 [US3] Refresh authoritative state after both success and refusal by invalidating `warehouseQueries.list()`, so the map, counts, details, and doors panel all reflect stored state without a manual reload (FR-029)

**Checkpoint**: Refusals are legible and recoverable; no refusal can leave a warehouse or a door in
an unclear state.

---

## Phase 6: User Story 4 - Archive Several Warehouses at Once (Priority: P3)

**Goal**: An administrator selects several warehouses on the map and archives them in one action,
with partial success, one reason per blocked warehouse, and one shared lifecycle context.

**Independent Test**: Select a mixed set — eligible, door-in-use, already-archived, unknown id —
archive in one action, and verify exactly the eligible ones and their available doors are archived
with identical metadata, every other one is untouched and reported with its own reason, and the
blocked ones can be retried without reselecting.

### Extraction baseline and shared components (do these first) ⚠️

> These three tasks modify **delivered** dock and weighing-area code. They depend on nothing else in
> this feature and can be pulled forward to Phase 2 to de-risk early.

- [X] T042 [P] [US4] Record the green baseline by running `pnpm --filter @portflow/web test -- checkpoints/__tests__/bulk-archive`, `checkpoints/__tests__/bulk-reactivate`, and `checkpoints/__tests__/bulk-reactivate-weighing-areas`; these suites must pass **unedited** after T043–T045 or the extraction changed delivered behavior
- [X] T043 [US4] Extract `apps/web/src/components/resource-map/bulk-resource-lifecycle-actions.tsx` from `apps/web/src/features/checkpoints/ui/bulk-checkpoint-lifecycle-actions.tsx`, parameterized by explicit `singular`, `plural`, `description`, and `idPrefix` strings instead of `CheckpointKind`, keeping `BulkLifecycleBlocker`/`BulkLifecycleOutcome`/`BLOCKER_REASON_LABELS` intact (research **D5**)
- [X] T044 [US4] Reduce `apps/web/src/features/checkpoints/ui/bulk-checkpoint-lifecycle-actions.tsx` to a thin wrapper resolving those four strings from `CHECKPOINT_KIND_SINGULAR_LABELS`, `CHECKPOINT_KIND_PLURAL_LABELS`, `CHECKPOINT_PARAM_BY_KIND`, and `BULK_LIFECYCLE_DESCRIPTIONS`, keeping every delivered dock and weighing-area string byte-identical
- [X] T045 [US4] Extract `useSelectAllShortcut({ enabled, onSelectAll })` and `useClearSelectionShortcut({ enabled, onClear })` into `apps/web/src/components/resource-map/use-bulk-selection-shortcuts.ts` and rewire `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx` onto them, preserving the two non-obvious behaviors: Ctrl/Cmd+A is ignored while an `INPUT`/`TEXTAREA`/`contentEditable` has focus, and Escape binds only while something is checked (research **D7**)

### Tests for User Story 4 ⚠️

- [X] T046 [P] [US4] Unit test the bulk matrix in `apps/api/tests/unit/warehouses/lifecycle/bulk_archive.spec.ts`: a mixed submission archives every eligible warehouse and its doors, leaves the rest untouched, and reports exactly one reason per blocked warehouse distinguishing `NOT_FOUND`, `IN_USE`, `ALREADY_ARCHIVED` (FR-035, FR-036)
- [X] T047 [P] [US4] Unit test shared context and atomicity in `apps/api/tests/unit/warehouses/lifecycle/bulk_archive.spec.ts`: every warehouse and every cascaded door in one submission shares one archive time, actor, and comment (FR-037); a failure part-way through leaves nothing archived in either table (FR-027, FR-038); an all-blocked submission archives nothing and reports each reason (US4 scenario 6)
- [X] T048 [P] [US4] Integration test `POST /api/v1/warehouses/archive` in `apps/api/tests/integration/warehouses/lifecycle/bulk_archive.spec.ts`: the `200` partial-success body, `422` for empty / duplicated / malformed selections rejected before any change (FR-040), `401`/`403` denying the whole submission (FR-033), and that `/warehouses/archive` resolves to `archiveMany` rather than `:id = 'archive'`
- [X] T049 [P] [US4] Web unit test `apps/web/src/features/warehouses/__tests__/warehouse-lifecycle-adapter.test.ts` for the bulk-result → `BulkLifecycleOutcome` mapping
- [X] T050 [P] [US4] Web feature test `apps/web/src/features/warehouses/__tests__/select-mode.test.tsx`: entering and leaving select mode, checkable polygons, the selection count, clearing, and that a non-administrator is offered none of it (FR-044)
- [X] T051 [P] [US4] Web feature test `apps/web/src/features/warehouses/__tests__/bulk-archive.test.tsx`: the bulk dialog's summed door count, the partial-success toast naming each blocked warehouse and reason, the all-blocked outcome, and retrying only the blocked ones without reselecting (FR-041, FR-042)
- [X] T052 [P] [US4] Web feature test `apps/web/src/features/warehouses/__tests__/selection-scope.test.tsx`: switching the status filter drops warehouses no longer listed, a search term does **not** prune the selection, and ids vanishing from the collection are dropped (FR-043, US4 scenario 9)
- [X] T053 [P] [US4] Web feature test `apps/web/src/features/warehouses/__tests__/keyboard-shortcuts.test.tsx`: Ctrl/Cmd+A checks every visible available warehouse and is ignored while typing; Escape clears without leaving select mode

### Implementation for User Story 4

- [X] T054 [US4] Implement `archiveAvailableMany` in `apps/api/app/warehouses/shared/repositories/lucid_warehouse_repository.ts`: one transaction, lock warehouses then doors with `orderBy('id').forUpdate()`, assess door usage set-based with `client: trx`, project used door ids back onto their warehouses, compute blockers via `findBulkBlockers`, update both tables for the eligible set, and guard the warehouse update's affected-row count against `eligibleIds.length` (research **D1**, **D3**)
- [X] T055 [US4] Create `apps/api/app/warehouses/archive/archive_warehouses_use_case.ts` delegating to `archiveAvailableMany` with the trimmed comment, following `archive_weighing_areas_use_case.ts`
- [X] T056 [US4] Add `archiveMany()` to `apps/api/app/controllers/warehouses_controller.ts` returning `{ updatedWarehouses, blockedWarehouses }` per [contracts/warehouse-archive-api.md](./contracts/warehouse-archive-api.md)
- [X] T057 [US4] Register `router.post('/archive', [controllers.Warehouses, 'archiveMany']).as('archive_many')` **before** the `/:id/archive` route from T022 in `apps/api/start/routes.ts`
- [X] T058 [P] [US4] Create `apps/web/src/features/warehouses/warehouse-lifecycle-adapter.ts` mapping `BulkWarehouseLifecycleResult` onto `BulkLifecycleOutcome`, and add `archiveMany` to `use-warehouse-mutations.ts`
- [X] T059 [US4] Add `selecting: z.enum(['warehouses']).optional().catch(undefined)` to the search schema in `apps/web/src/routes/_authenticated/warehouses.tsx`
- [X] T060 [US4] Make polygons checkable in `apps/web/src/features/warehouses/map/warehouse-polygon.tsx`: optional `checkedIds`/`onToggleChecked`, the focus-marker button gaining `aria-pressed`, a `Select/Deselect warehouse {name}` label and `data-checked` as `CheckpointMarker` does, a `checked` case in the fill/line paint, and **removal of the `if (warehouse.id === selectedId) return null` early return while in select mode** so every warehouse stays checkable (research **D6**)
- [X] T061 [US4] Add the select-mode `ControlButton` with `SquareDashedMousePointer` to `MapControls` in `apps/web/src/features/warehouses/map/warehouse-map.tsx`, labelled "Select warehouses" / "Stop selecting warehouses", and thread the checkable props through to `WarehousePolygons`
- [X] T062 [US4] Wire select mode in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`: `checkedIds` state, entering select mode clearing `warehouseId`/`doorId`, shift-click entering select mode and checking, the three selection-scoping rules from [contracts/warehouse-archive-ui-state.md](./contracts/warehouse-archive-ui-state.md), and the T045 shortcut hooks
- [X] T063 [US4] Render `BulkResourceLifecycleActions` from `warehouses-page.tsx` with warehouse labels, the summed available-door count in its description, the T058 submit adapter, and a success handler that narrows `checkedIds` to the blocked ids so a retry needs no reselection (FR-042)

**Checkpoint**: All four user stories are independently functional, and warehouses meet the same
bulk-selection interaction model as the Checkpoints map rather than a second one (FR-045).

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T064 Amend the `Warehouse` entry in `CONTEXT.md` (line 152) to describe the door cascade and the door-usage blocking rule, replacing "it cannot be archived while it still has available warehouse doors", and note in one sentence why warehouses diverge from the transport-company/truck container rule (research **D10**) — **required by constitution principle VI, not a follow-up**
- [X] T065 [P] Update the `#210` row in `specs/site-references/storage-facilities/warehouses/roadmap.md` from `selected` to `implemented`
- [ ] T066 [P] Add the end-to-end archive journey including the door cascade under `apps/web/e2e/` — **NOT DONE**: the repository has no Playwright configuration, no `e2e/` directory, and no Playwright dependency in any `package.json`. The constitution says "Playwright where configured", and it is not. Standing up an E2E harness is its own deliverable, not part of this issue.
- [X] T067 Run the full verification gate: `pnpm check`, `pnpm typecheck`, `pnpm test`, and the browser flow in [quickstart.md](./quickstart.md)
- [ ] T068 **Human/CI step, not runnable here** — obtain a fresh read-only Codex review of the final diff and resolve or explicitly justify every confirmed finding (constitution principle VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T002 depends on T001; T003 depends on T002.
- **Foundational (Phase 2)**: depends on Phase 1 — **blocks all user stories**. T009 depends on T008; T011/T012 depend on T009 having regenerated the contract.
- **US1 (Phase 3)**: depends on Phase 2.
- **US2 (Phase 4)**: depends on Phase 2. T032/T033 extend the use case created in T020, so in practice US2 follows US1.
- **US3 (Phase 5)**: depends on US1 (the dialog) and US2 (the refusals it reports).
- **US4 (Phase 6)**: depends on Phase 2. T042–T045 depend on nothing in this feature and may be pulled forward.
- **Polish (Phase 7)**: depends on all stories being complete.

### User Story Dependencies

- **US1 (P1)**: the only story with no dependency on another story.
- **US2 (P1)**: shares the use case and controller with US1; both P1 stories form the shippable unit.
- **US3 (P2)**: reports what US2 refuses — it has nothing to describe without US2.
- **US4 (P3)**: independent of US3. Its API path is a separate use case, controller method, and route, and its extraction tasks are independent of everything.

### Within Each User Story

Tests are written and confirmed failing before implementation. Repository before use case, use case
before controller, controller before route, API before the web adapter that consumes it.

### Parallel Opportunities

- **Phase 2**: T004, T005, T006, T007, T008 are five different new files — all parallel. T011 and T012 are parallel with each other once T009 lands.
- **US1**: T013–T017 all parallel (five different test files). T023 parallel with the API tasks.
- **US2**: T027–T031 all parallel.
- **US3**: T035–T038 all parallel.
- **US4**: T046–T053 all parallel — eight test files. T058 parallel with the API tasks.
- **Cross-story**: after Phase 2, US4's extraction block (T042–T045) can proceed on a separate track from US1/US2 entirely.

---

## Parallel Example: User Story 1

```bash
# Write all five failing tests together:
Task: "Unit test archive happy path in apps/api/tests/unit/warehouses/lifecycle/archive.spec.ts"
Task: "Unit test door cascade in apps/api/tests/unit/warehouses/lifecycle/door_cascade.spec.ts"
Task: "Unit test preservation in apps/api/tests/unit/warehouses/lifecycle/archive.spec.ts"
Task: "Integration test POST /warehouses/:id/archive in apps/api/tests/integration/warehouses/lifecycle/archive.spec.ts"
Task: "Web feature test archive journey in apps/web/src/features/warehouses/__tests__/archive.test.tsx"
```

---

## Implementation Strategy

### MVP scope: US1 **and** US2 together

The template's default MVP is User Story 1 alone. **This feature is the exception, deliberately.**
Both stories are P1 in the spec, and US1 without US2 would let an administrator archive a warehouse
whose door is assigned to a Planned or Active discharge — cascading the archival onto a door that
live unloading work depends on. That is precisely the outcome the issue's "without invalidating its
doors" forbids. Ship Phases 1–4 as the first increment, never Phase 3 alone.

### Incremental delivery

1. Phases 1–2 → the slice's foundation exists and `GET /warehouses` carries lifecycle context.
2. Phases 3–4 → **MVP**: one warehouse can be archived safely, with its door cascade and every guard.
3. Phase 5 → refusals become legible and recoverable.
4. Phase 6 → bulk archival on the map, sharing the delivered interaction model.
5. Phase 7 → documentation, E2E, and the verification gate.

### Parallel team strategy

After Phase 2, two tracks run without collision:

- **Track A (API + single flow)**: US1 → US2 → US3.
- **Track B (web platform)**: T042–T045 extractions, then US4's web tasks once Track A's bulk API
  lands. Track B touches `components/resource-map/` and `features/checkpoints/`; Track A touches
  `apps/api/` and `features/warehouses/ui/`.

### Risk order

Highest first, matching the plan's post-design re-check:

1. **T043–T045** modify delivered dock and weighing-area code — T042's baseline is the guard.
2. **T001–T002** gate every API task; nothing referencing `archivedWithWarehouse` compiles until
   `schema.ts` regenerates.
3. **T057** route ordering — cheap to get wrong, cheap to test (T048 covers it).
4. **T012** hand-written MSW fixtures do not follow contract regeneration.

---

## Notes

- `[P]` means a different file with no incomplete dependency.
- Every API task follows `apps/api/AGENTS.md`: use cases own decisions, repositories own locks,
  transactions, and conditional writes; controllers own HTTP; policies own authorization.
- Every web task follows `apps/web/AGENTS.md`: MSW for network mocking, never a mocked Tuyau client;
  feature tests render through the real router and providers.
- Commit per task or logical group, using Conventional Commits (`feat(warehouses): …`).
- Stop at any checkpoint to validate the increment independently.
