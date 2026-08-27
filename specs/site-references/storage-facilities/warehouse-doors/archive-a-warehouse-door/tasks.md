# Tasks: Archive a Warehouse Door

> **Amended by [#216 Reactivate a Warehouse Door](../reactivate-a-warehouse-door/spec.md).** A door
> is archived *on its own* exactly while its containing warehouse is available, and nothing on the
> door records that: `warehouse_doors.archived_with_warehouse` is dropped, a later archival of the
> warehouse takes this door over, and the warehouse's reactivation brings it back. Where this
> document reasons about writing or reading that provenance, read `spec.md`'s amendment note
> instead. The text is kept as the delivery record of what was built at the time.

**Input**: Design documents from `specs/site-references/storage-facilities/warehouse-doors/archive-a-warehouse-door/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Observable business behavior follows RED → GREEN → REFACTOR (Constitution Principle IV).
Test tasks must be run and observed failing before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story so each story remains independently testable.
Per `plan.md`, this is a **full-stack** slice: `apps/api` has no warehouse-door lifecycle write today
(`WarehouseDoorsController` exposes `available`, `store`, and `update`; `WarehouseDoorRepository`
declares `create`, `updateAvailable`, and `listAvailable`; `WarehouseDoorPolicy` declares `create`,
`update`, and `listAvailable`).
**No migration is needed** — `warehouse_doors` already carries `status`, `archived_at`,
`archived_by_user_id`, `archive_comment`, and `archived_with_warehouse`, the last added by #210 for
the cascade. **No new shared component is needed** — `ResourceRowActions` was adopted empty by #214
for this slice to fill, and `ResourceLifecycleDialog` and `BulkResourceLifecycleDialog` are consumed
with no `describeEffect` and no overridden blocker label: a door cascades onto nothing, and the
default `IN_USE` label is already accurate for a door (`research.md` R9, R10). See
**Deviations recorded after delivery** at the end of this file for where the plan below and the
delivered slice differ.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an
  incomplete task in the same phase.
- **[Story]**: Maps a task to its user story from `spec.md`.

---

## Phase 1: Setup

**Purpose**: Widen the warehouses route's URL contract to carry the fourth map mode. *(Superseded —
no URL change was needed; see "Deviations recorded after delivery".)*

- [X] T001 ~~Widen `selecting` from `z.enum(['warehouses'])` to `z.enum(['warehouses', 'doors']).optional().catch(undefined)` in `warehouseSearchSchema` in `apps/web/src/routes/_authenticated/warehouses.tsx`, leaving every other param untouched, and extend the existing comment to record that `selecting=doors` is honoured only for an administrator, only alongside a `warehouseId` naming an **available** warehouse, and only in the Available door view — and that, unlike `selecting=warehouses`, it **keeps** `warehouseId` (`contracts/warehouse-door-archive-ui-state.md` §"URL contract", `research.md` R7)~~

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the error vocabulary, the transport validators, the repository contract, the DTO
members, the typed mutations, and the web test seams — everything more than one user story depends
on, and everything #216 will reach for rather than fork.

**⚠️ CRITICAL**: No user story implementation starts until this phase is complete.

- [X] T002 [P] Add `WarehouseDoorAlreadyArchivedException` (409, `E_WAREHOUSE_DOOR_ALREADY_ARCHIVED`, "Warehouse door is already archived") and `WarehouseDoorInUseException` (409, `E_WAREHOUSE_DOOR_IN_USE`, "Warehouse door is used by a planned or active discharge") to `apps/api/app/warehouse_doors/shared/warehouse_door_exceptions.ts`, mirroring `DockAlreadyArchivedException` and `DockInUseException` one-for-one. Extend the file's header comment to record that the existing `ArchivedWarehouseDoorReadOnlyException` ("Reactivate the door first") stays the **update** refusal and is not reused for an archive attempt, and that the containing warehouse keeps answering with `E_WAREHOUSE_NOT_FOUND` / `E_WAREHOUSE_ARCHIVED` (`research.md` R6, `contracts/warehouse-doors-archive.openapi.yaml`)
- [X] T003 [P] Add a failing assertion for the archive context to the transformer coverage in `apps/api/tests/integration/warehouse_doors/consultation/available.spec.ts`, proving `archivedAt`, `archivedByUserId`, `archiveComment`, and `archivedWithWarehouse` are absent today beside the `createdAt` (#213) and `updatedAt` (#214) already picked (`research.md` R5)
- [X] T004 Add `archivedAt`, `archivedByUserId`, `archiveComment`, and `archivedWithWarehouse` to the picked fields in `apps/api/app/warehouse_doors/shared/warehouse_door_transformer.ts`, with a comment recording that the reactivation members are #216's to add and that the door objects embedded by `WarehouseTransformer` are untouched so #212's read contract does not change — depends on T003 (`research.md` R5)
- [X] T005 [P] Add `archiveWarehouseDoorValidator` (`{ comment: lifecycleComment() }`) and `archiveWarehouseDoorsValidator` (`{ ids: lifecycleIds(), comment: lifecycleComment() }`) to `apps/api/app/warehouse_doors/shared/warehouse_door_validator.ts`, importing both helpers from `#shared/validators/lifecycle_validator` so the 1,000-character limit and the non-empty, distinct, lower-cased uuid array are the shared ones rather than a second definition (FR-013, FR-037; `contracts/warehouse-doors-archive.openapi.yaml`)
- [X] T006 [P] Add `ArchiveWarehouseDoorCommand` / `ArchiveWarehouseDoorResult` (`ARCHIVED` | `DOOR_NOT_FOUND` | `ALREADY_ARCHIVED` | `IN_USE` | `WAREHOUSE_NOT_FOUND` | `WAREHOUSE_ARCHIVED`), `ArchiveWarehouseDoorsCommand` / `BulkWarehouseDoorLifecycleResult` (`{ updatedDoors, blockedDoors }`), and the abstract `archiveAvailable` and `archiveAvailableMany` methods to `apps/api/app/warehouse_doors/shared/repositories/warehouse_door_repository.ts`, documenting — as the file already does for `create` and `updateAvailable` — that every arm but `ARCHIVED` is a transactional outcome rather than a pre-check (`data-model.md` §"Repository outcomes", `research.md` R2)
- [X] T007 [P] Add `archive` and `archiveMany` mutations to `apps/web/src/features/warehouse-doors/mutations/use-warehouse-door-mutations.ts`, built from `tuyauQuery.warehouseDoors.archive.mutationOptions(...)` and `tuyauQuery.warehouseDoors.archiveMany.mutationOptions(...)`, each invalidating `warehouseQueries.list()` exactly as the existing `create` and `update` mutations do, plus a `refreshWarehouseDoors` helper mirroring `useWarehouseMutations.refreshWarehouses` for the bulk bar's `refresh` prop
- [X] T008 [P] Extend `apps/web/src/features/warehouses/__tests__/support/handlers.ts` with `archiveWarehouseDoorHandler(archived)` (200), `archiveWarehouseDoorAlreadyArchivedHandler()` (409 `E_WAREHOUSE_DOOR_ALREADY_ARCHIVED`), `archiveWarehouseDoorInUseHandler()` (409 `E_WAREHOUSE_DOOR_IN_USE`), `archiveWarehouseDoorNotFoundHandler()` (404 `E_WAREHOUSE_DOOR_NOT_FOUND`), `archiveWarehouseDoorsHandler(outcome)` (200 with `updatedDoors` / `blockedDoors`), and network-failure variants of both endpoints; add archived-door and bulk-outcome fixtures to `apps/web/src/features/warehouses/__tests__/support/fixtures.ts` beside the existing created- and updated-door ones, including a door with `archivedWithWarehouse: true` so the two provenance lines can be told apart
- [X] T009 [P] Extend `apps/web/src/features/warehouses/__tests__/support/mock-warehouse-map.tsx` with a door **selection** seam beside the existing `doorPlacement` one: expose which door ids the marker layer received as checkable, render a per-door "Toggle door <name>" affordance calling back through the new marker `onToggleChecked` contract, and surface each door's checked state — keeping every existing affordance unchanged (`research.md` R7)

**Checkpoint**: The error codes, validators, repository contract, DTO members, typed mutations, MSW
handlers, and map test seam all exist. User story implementation can now begin.

---

## Phase 3: User Story 1 - Retire One Door From Operational Use (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator opens `Archive` from a door row's action menu, confirms with an
optional comment, and the door leaves the Available view for the Archived one — carrying its archive
time, actor, comment, and the fact that it was archived **on its own** — while its name, position,
containing warehouse, creation time, and every record referencing it are preserved.

**Independent Test**: Sign in as an authorized administrator, open an available warehouse, archive
one of its available doors that no Planned or Active Discharge relies on, and verify it leaves the
available door view, appears under Archived with its context and an `Archived on its own` provenance
line, and keeps its identity, name, GPS location, containing warehouse, and referencing records
(`spec.md` US1).

### Tests for User Story 1 (write and observe RED first)

- [X] T010 [P] [US1] Add a failing API integration test for the happy path in `apps/api/tests/integration/warehouse_doors/lifecycle/archive.spec.ts`: an authenticated administrator POSTs `/api/v1/warehouse-doors/:id/archive` with a comment, without one, and with a whitespace-only one; each returns 200 with `status: 'ARCHIVED'`, a populated archive context, `archivedWithWarehouse: false`, and `archiveComment` null for the last two; the persisted row keeps its `id`, `warehouseId`, `name`, `latitude`, `longitude`, `createdAt`, and any prior reactivation context, and its containing warehouse is byte-for-byte unchanged — including when the archived door was the warehouse's **last available** one (`quickstart.md` scenarios 5–8; FR-010 to FR-015)
- [X] T011 [P] [US1] Add failing API unit tests for `ArchiveWarehouseDoorUseCase` in `apps/api/tests/unit/warehouse_doors/lifecycle/archive.spec.ts` against a repository swapped through `app.container.swap` (as `tests/unit/warehouse_doors/update/update.spec.ts` does): the comment reaches the repository trimmed, a whitespace-only comment reaches it as `null`, the submission time and actor are passed through, and each result arm maps to its exception — `DOOR_NOT_FOUND` → `WarehouseDoorNotFoundException`, `ALREADY_ARCHIVED` → `WarehouseDoorAlreadyArchivedException`, `WAREHOUSE_NOT_FOUND` → `WarehouseNotFoundException`, `WAREHOUSE_ARCHIVED` → `ArchivedWarehouseReadOnlyException` (`research.md` R6, `data-model.md` §"Repository outcomes")
- [X] T012 [P] [US1] Add a failing API unit test in `apps/api/tests/unit/warehouse_doors/warehouse_door_policy.spec.ts` asserting the new `archive` ability is granted to `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, beside the existing `create` and `update` coverage
- [X] T013 [P] [US1] Add a failing web entry test in `apps/web/src/features/warehouse-doors/__tests__/archive/entry.test.tsx`: each available door row of an available warehouse hosts a menu labelled `Actions for <door name>` offering `Edit` **then** `Archive`, the latter styled destructive; choosing `Archive` opens a dialog titled `Archive door` whose sentence names the door and states it *remains readable but is no longer available for new operations*, with **no** cascade clause appended (`quickstart.md` scenarios 1, 3; `contracts/warehouse-door-archive-ui-state.md` §"Entry points")
- [X] T014 [P] [US1] Add a failing web confirmation test in `apps/web/src/features/warehouse-doors/__tests__/archive/confirmation.test.tsx`: the comment field is optional and capped at 1,000 characters; `Cancel` leaves the door untouched; confirming toasts `Door archived`, invalidates the warehouse collection, drops the door from the Available view and its count, and its row in the Archived view reads `Archived on its own`, the date, and the comment — distinct from the `Archived with this warehouse` line a cascade-archived door shows (`quickstart.md` scenarios 4–6; FR-017, FR-021, FR-022, FR-026)

### Implementation for User Story 1

- [X] T015 [P] [US1] Add `archive(user)` to `apps/api/app/warehouse_doors/shared/warehouse_door_policy.ts`, returning true for `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, mirroring the existing `create` and `update` abilities — depends on T012
- [X] T016 [US1] Implement `archiveAvailable` in `apps/api/app/warehouse_doors/shared/repositories/lucid_warehouse_door_repository.ts`: short-circuit a non-UUID `id` to `DOOR_NOT_FOUND` via `#shared/database/is_uuid`; pre-read the door unlocked to learn its permanent `warehouse_id`; inside one transaction select the warehouse `.where('status', 'AVAILABLE').forUpdate()` — **warehouse first**, the lock order `create`, `updateAvailable`, and #210's cascade all take — then update the door `.where('id', ...).where('status', 'AVAILABLE')` with `status: 'ARCHIVED'`, `archivedAt`, `archivedByUserId`, `archiveComment`, **`archivedWithWarehouse: false`**, and `updatedAt: archivedAt`; distinguish `WAREHOUSE_NOT_FOUND` from `WAREHOUSE_ARCHIVED` and `DOOR_NOT_FOUND` from `ALREADY_ARCHIVED` with follow-up reads, exactly as `updateAvailable` already does; re-read the row before returning it so the response carries what was written — depends on T006 (`research.md` R3, R4; `data-model.md` invariants I1–I3)
- [X] T017 [US1] Implement `apps/api/app/warehouse_doors/archive/archive_warehouse_door_use_case.ts`: take `{ id, archivedByUserId, archivedAt, comment }`, pass `archiveComment: input.comment?.trim() || null` to `repository.archiveAvailable`, return the door on `ARCHIVED`, and throw the mapped exception on every other arm — the shape `ArchiveDockUseCase` uses, minus its pre-checks, which now live in the transaction — depends on T002, T016 (`research.md` R2, R6)
- [X] T018 [US1] Add `archive` to `apps/api/app/controllers/warehouse_doors_controller.ts` (`auth.use('web').getUserOrFail()` → `bouncer.with(WarehouseDoorPolicy).authorize('archive')` → `request.validateUsing(archiveWarehouseDoorValidator)` → use case with `id: params.id`, `archivedByUserId: user.id`, `archivedAt: DateTime.now()` → `serialize(WarehouseDoorTransformer.transform(door))`, 200 — the bare door, not an envelope, since a door cascades onto nothing) and register `router.post('/:id/archive', [controllers.WarehouseDoors, 'archive']).as('archive')` in the `/warehouse-doors` group of `apps/api/start/routes.ts` — depends on T004, T005, T015, T017 (`research.md` R1)
- [X] T019 [P] [US1] Create `apps/web/src/features/warehouse-doors/warehouse-door-lifecycle.tsx` modelled on `apps/web/src/features/warehouses/warehouse-lifecycle.tsx`, exporting `WAREHOUSE_DOOR_SINGULAR = 'door'`, `WAREHOUSE_DOOR_PLURAL = 'doors'`, `warehouseDoorLifecycleActions(doorStatus, warehouseStatus): LifecycleAction[]` returning `['archive']` only when both are `AVAILABLE` and `[]` otherwise, and a `useWarehouseDoorLifecycleConfig(door)` hook returning a `ResourceLifecycleConfig` with `singular`, `name`, `isPending`, `refresh`, and `submit` — and **no** `describeEffect` and **no** `describeSuccess`, because the canonical sentence and success message are already exactly true of a door — depends on T007 (`research.md` R9, R10)
- [X] T020 [US1] Fill the menu in `apps/web/src/features/warehouse-doors/ui/warehouse-door-row-actions.tsx`: replace `actions={[]}` with `warehouseDoorLifecycleActions(door.status, warehouseStatus)` and add `renderDialog={({ action, onClose }) => <ResourceLifecycleDialog action={action} config={config} onClose={onClose} />}`, keeping `editable` and `name` as they are so an archived door's menu still renders **nothing at all** rather than a dead entry; update the file's header comment, which currently explains why `actions` is empty — depends on T019 (`contracts/warehouse-door-archive-ui-state.md` §"Entry points")
- [X] T021 [US1] Verify and, where needed, adjust the post-archival navigation in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`: nothing is forced — the archived door leaves the Available view, the existing "selected door is no longer admitted" effect clears `doorId` with `replace: true`, the warehouse stays selected, and neither `doorStatus` nor `status` is rewritten. Add a comment naming this as a decision rather than an omission — depends on T020 (`research.md` R11)

**Checkpoint**: An administrator can archive one eligible door end to end, and it is readable under
Archived with its own provenance. User Story 1 is independently demonstrable.

---

## Phase 4: User Story 2 - Protect Doors Current Work Depends On (Priority: P1)

**Goal**: A door held by a Planned or Active Discharge cannot be archived, and neither can one an
unauthorized user, an already-archived door, a door of an archived warehouse, or an unknown
identifier — each with its own actionable reason, and nothing written.

**Independent Test**: Attempt archival as an unauthenticated visitor, as each non-administrator
active role, on a door holding a current product lot assignment in a Planned or Active Discharge, on
an already archived door, on a door of an archived warehouse, and on an unknown identifier; verify
every attempt is refused, that no door changes lifecycle state, and that each refusal states a
specific reason (`spec.md` US2).

### Tests for User Story 2 (write and observe RED first)

- [X] T022 [P] [US2] Extend `apps/api/tests/integration/warehouse_doors/lifecycle/archive.spec.ts` with the refusal matrix: 401 unauthenticated and non-active; 403 for each active non-administrator role; 404 for an unknown and for a malformed door id (never a 500); 409 `E_WAREHOUSE_DOOR_ALREADY_ARCHIVED` on a second attempt **and** on a door archived *with* its warehouse, whose `archivedWithWarehouse: true`, time, actor, and comment must all survive untouched; 409 `E_WAREHOUSE_DOOR_IN_USE`; 409 `E_WAREHOUSE_ARCHIVED` for a door of an archived warehouse; and, after every one of them, the stored row is unchanged column for column (`quickstart.md` scenarios 2, 11, 13, 27; FR-002 to FR-006, FR-025)
- [X] T023 [US2] Add a failing API integration test for the usage boundaries in `apps/api/tests/integration/warehouse_doors/lifecycle/archive.spec.ts`: a door involved only through a **Closed** discharge, one whose door assignment has **ended**, and one that belongs to a planned or active **shift without a current product lot assignment** are each archived successfully — the shared rule (`#240` FR-006) and nothing wider (`quickstart.md` scenario 12; FR-007, FR-008)
- [X] T024 [P] [US2] Extend `apps/api/tests/unit/warehouse_doors/warehouse_door_policy.spec.ts` to the full matrix for `archive`: every role and every access status, including an inactive administrator
- [X] T025 [P] [US2] Add a failing web permissions test in `apps/web/src/features/warehouse-doors/__tests__/archive/permissions.test.tsx`: no action menu at all for a non-administrator; none on an archived door row; none on any door of an archived warehouse; and a direct `?selecting=doors` URL is inert for a non-administrator (`quickstart.md` scenarios 1, 2, 27; FR-002, FR-027, FR-030)

### Implementation for User Story 2

- [X] T026 [US2] Add the usage query to `archiveAvailable` in `apps/api/app/warehouse_doors/shared/repositories/lucid_warehouse_door_repository.ts`: inside the same transaction, after the warehouse lock and before the write, lock the door row `.forUpdate()` and call `usageChecker.findUsedByPlannedOrActiveDischarge({ referenceType: 'WAREHOUSE_DOOR', referenceIds: [id], client: trx })`, returning `IN_USE` when it matches. Inject `SiteReferenceUsageChecker` into the repository as `LucidWarehouseRepository` already does, and carry over that file's comment recording the one race this does **not** close — an `INSERT` into `warehouse_door_product_lot_assignments` is not blocked by a row lock on the door, an obligation on whoever writes the first assignment writer — depends on T016 (`research.md` R2, `data-model.md` §"Warehouse Door Usage")
- [X] T027 [US2] Map `IN_USE` to `WarehouseDoorInUseException` in `apps/api/app/warehouse_doors/archive/archive_warehouse_door_use_case.ts` — depends on T017, T026
- [X] T028 [US2] Gate the entry point in `apps/web/src/features/warehouse-doors/ui/warehouse-doors-panel.tsx` and `apps/web/src/features/warehouses/ui/warehouses-page.tsx`: the row menu keeps rendering nothing for a door or warehouse that is `ARCHIVED`, and `onEditDoor` / the archive config are passed only for an administrator — server-side authorization stays authoritative, the interface only mirrors it — depends on T020 (FR-027, FR-030)

**Checkpoint**: Every guard rail holds on both sides of the wire. Together with User Story 1 this is
the shippable increment — both are P1 because archiving a door in use would break live work.

---

## Phase 5: User Story 3 - Understand and Recover From a Refused Archival (Priority: P2)

**Goal**: Each refusal explains itself, keeps what the administrator typed, refreshes a stale view,
and leaves a retry path — and no repeated or concurrent attempt can archive a door twice or leave it
half-archived.

**Independent Test**: Trigger an in-use conflict, an already-archived conflict caused by a stale
view, an over-long comment, and a transient failure in turn; verify each produces distinct guidance,
that no door is ever left ambiguous, and that retrying after the blocking condition is resolved
archives the door exactly once (`spec.md` US3).

### Tests for User Story 3 (write and observe RED first)

- [X] T029 [P] [US3] Add a failing web feedback test in `apps/web/src/features/warehouse-doors/__tests__/archive/feedback.test.tsx`: each refusal code produces its own understandable message; the dialog **stays open with the typed comment intact**; the warehouse collection is refreshed after a refusal so a stale view catches up and a door archived elsewhere shows its authoritative archived state; a network failure is reported as retryable; and a retry after the condition is resolved succeeds without reopening the door (`quickstart.md` scenario 11; FR-023, FR-024, FR-026)
- [X] T030 [P] [US3] Add failing API integration tests for atomicity in `apps/api/tests/integration/warehouse_doors/lifecycle/archive.spec.ts`: a comment longer than 1,000 characters returns 422 with nothing written; two archivals of the same door submitted back to back record **exactly one** archival, the second refused as already archived with the first context untouched; and a door archival racing its warehouse's archival ends with the door archived exactly once, under one context, with a coherent `archivedWithWarehouse` value (`quickstart.md` scenario 13; FR-013, FR-024, FR-025, SC-007)

### Implementation for User Story 3

- [X] T031 [US3] Add a `WAREHOUSE_DOOR_ARCHIVE_ERROR_MESSAGES` map to `apps/web/src/features/warehouse-doors/warehouse-door-lifecycle.tsx` translating `E_WAREHOUSE_DOOR_IN_USE`, `E_WAREHOUSE_DOOR_ALREADY_ARCHIVED`, `E_WAREHOUSE_DOOR_NOT_FOUND`, and `E_WAREHOUSE_ARCHIVED` into the sentences the dialog shows, falling back to the API's own message for anything else — the pattern `warehouse-lifecycle.tsx` uses for its blocker labels, so no wording is invented at the call site — depends on T019, T029 (FR-023)
- [X] T032 [US3] Confirm — and cover in T029 rather than re-implement — that `ResourceLifecycleDialog` already calls `config.refresh` after a refusal as well as after a success, and that its `event.preventDefault()` on the confirm action is what keeps the dialog open with the comment. If either turns out not to hold for this config, fix it **in this feature's config**, not in the shared component — depends on T031

**Checkpoint**: Every refusal is legible and recoverable, and no race can double-archive a door.

---

## Phase 6: User Story 4 - Archive Several Doors at Once (Priority: P3)

**Goal**: An administrator selects several available doors of one warehouse — in the list or on the
map — and archives them in one action, with identical archive metadata, one specific reason per door
left unchanged, and a retry path for the ones that were merely in use.

**Independent Test**: Select a mixed set of doors — some eligible, one in use, one archived a moment
earlier, one unknown identifier — archive them in one action, and verify exactly the eligible ones
become archived with identical metadata, that every other door is untouched and reported with its own
reason, and that the blocked ones can be retried on their own (`spec.md` US4).

### Tests for User Story 4 (write and observe RED first)

- [X] T033 [P] [US4] Add failing API unit tests for the blocker helper in `apps/api/tests/unit/warehouse_doors/lifecycle/bulk_archive.spec.ts`: `NOT_FOUND` for an id resolving to nothing (and no `name`), `ALREADY_ARCHIVED` for an archived door, `IN_USE` for a used one, no blocker for an eligible one, and submission order preserved in the eligible set — mirroring `tests/unit/docks/lifecycle/bulk_archive.spec.ts` (`data-model.md` §"Blocker helper")
- [X] T034 [P] [US4] Add a failing API integration test in `apps/api/tests/integration/warehouse_doors/lifecycle/bulk_archive.spec.ts`: a mixed submission returns 200 archiving only the eligible doors, with one reason per blocked door; every door archived by one submission carries the **same** `archivedAt`, `archivedByUserId`, and `archiveComment`, and `archivedWithWarehouse: false`; an all-blocked submission returns an empty `updatedDoors` rather than an error; a submission spanning two warehouses is accepted and each door answers for its own; 422 for an empty, duplicated, or malformed `ids` and for an over-long comment, with nothing read or written; and a failure part-way through leaves **no** door archived (`quickstart.md` scenarios 21–26; FR-031 to FR-038, `research.md` R12)
- [X] T035 [P] [US4] Add a failing web selection test in `apps/web/src/features/warehouse-doors/__tests__/archive/selection.test.tsx`: `Select doors` appears in the Doors panel header only for an administrator on an available warehouse; pressing it sets `selecting=doors` while **keeping** `warehouseId`; available rows gain checkboxes under a `Select all` header; checking a row rings its marker and toggling a marker checks its row; switching to the Archived view, selecting another warehouse, or starting a create/edit session empties the selection and ends the mode; activating `Select warehouses` replaces the mode and clears `warehouseId` as it already does; and the select-all and clear shortcuts act on **doors** while the mode is on and on warehouses once it is off (`quickstart.md` scenarios 14–20; FR-039 to FR-042, `research.md` R7, R8)
- [X] T036 [P] [US4] Add a failing web bulk test in `apps/web/src/features/warehouse-doors/__tests__/archive/bulk.test.tsx`: the bar appears at the first check reading `N selected` with `Archive selected` and `Clear selection`; the confirmation counts the selection and offers one comment; a partial outcome toasts `N doors archived; M doors unchanged` with `<name>: <reason>` per blocked door using the **default** labels; an all-blocked outcome reports that nothing changed; after a submission only the `IN_USE` ids stay checked; and a refused request keeps the dialog open with the selection and comment intact (`quickstart.md` scenarios 21–24; `contracts/warehouse-door-archive-ui-state.md` §"Outcome reporting", `research.md` R9)

### Implementation for User Story 4

- [X] T037 [P] [US4] Create `apps/api/app/warehouse_doors/shared/warehouse_door_lifecycle_blockers.ts` exporting `WarehouseDoorLifecycleRecord`, `BulkWarehouseDoorLifecycleBlocker` (`NOT_FOUND` | `IN_USE` | `ALREADY_ARCHIVED` | `ALREADY_AVAILABLE`), and `findBulkBlockers(ids, doorsById, expectedStatus, usedIds)`, mirroring `apps/api/app/warehouses/shared/warehouse_lifecycle_blockers.ts` and reusing `indexById` / `orderByIds` from `#shared/lifecycle/bulk_lifecycle_records`. Carry the sibling's comment explaining that `expectedStatus` and `ALREADY_AVAILABLE` exist so #216's reactivation reuses this helper — depends on T033
- [X] T038 [US4] Implement `archiveAvailableMany` in `apps/api/app/warehouse_doors/shared/repositories/lucid_warehouse_door_repository.ts`: pre-read the submitted doors unlocked to learn their distinct `warehouse_id`s; inside one transaction lock those warehouses `.orderBy('id').forUpdate()`, then the doors `.whereIn('id', ids).orderBy('id').forUpdate()` — the fixed table-then-id order that cannot deadlock against #210's cascade or a concurrent overlapping submission; run the usage query over the submitted ids with the transaction client; compute blockers through T037; update the eligible doors in one guarded statement carrying `status`, `archivedAt`, `archivedByUserId`, `archiveComment`, `archivedWithWarehouse: false`, and `updatedAt`; throw if the affected-row count disagrees with the eligible count, as the dock and warehouse bulk writes do, so a concurrent change rolls the whole submission back; return `updatedDoors` in submission order beside `blockedDoors` — depends on T006, T026, T037 (`research.md` R3, R12; `data-model.md` §"Bulk archival")
- [X] T039 [US4] Implement `apps/api/app/warehouse_doors/archive/archive_warehouse_doors_use_case.ts` taking `{ ids, archivedByUserId, archivedAt, comment }` and delegating to `repository.archiveAvailableMany` with `archiveComment: input.comment?.trim() || null`, mirroring `ArchiveWarehousesUseCase` — depends on T038
- [X] T040 [US4] Add `archiveMany` to `apps/api/app/controllers/warehouse_doors_controller.ts` (authorize `archive`, validate with `archiveWarehouseDoorsValidator`, serialize `{ updatedDoors: WarehouseDoorTransformer.transform(result.updatedDoors), blockedDoors: result.blockedDoors }`, 200) and register `router.post('/archive', [controllers.WarehouseDoors, 'archiveMany']).as('archive_many')` **before** `/:id/archive` in the `/warehouse-doors` group of `apps/api/start/routes.ts`, with the same ordering comment the warehouses group carries — depends on T005, T018, T039 (`research.md` R1)
- [X] T041 [P] [US4] Add the `checked` / `onToggleChecked` contract to `apps/web/src/features/warehouse-doors/map/warehouse-door-marker.tsx`, mirroring `apps/web/src/features/checkpoints/map/checkpoint-marker.tsx`: when `checked` is defined the marker renders as a checkable item — `aria-pressed`, `aria-label="Select door <name>"` / `Deselect door <name>`, a `ring-2 ring-primary` when checked — and a click toggles instead of selecting; when it is undefined nothing changes for #212's consultation behavior — depends on T009
- [X] T042 [US4] Add the selection affordances to `apps/web/src/features/warehouse-doors/ui/warehouse-doors-panel.tsx`: a `Select doors` / `Stop selecting doors` header control beside `Create door`, rendered only when the caller passes `onToggleSelectMode`; a `Select all` checkbox above the list with `aria-checked="mixed"` for a partial selection, scoped to the available doors currently listed; and a per-row `Checkbox` labelled `Select door <name>` on available rows only — the `apps/web/src/features/trucks/ui/truck-list.tsx` layout, unchanged in substance — depends on T035
- [X] T043 [US4] Thread the selection through `apps/web/src/features/warehouses/map/warehouse-map.tsx`: accept `doorSelectMode`, `checkedDoorIds`, and `onToggleDoorChecked`, pass `checked` / `onToggleChecked` to each `WarehouseDoorMarker`, and suppress warehouse-polygon selection while the door mode is on so a stray click cannot switch warehouse mid-selection — leaving `isArmed`, `suppressesSelection`, and the placement layers untouched — depends on T041
- [X] T044 [US4] Wire the mode in `apps/web/src/features/warehouses/ui/warehouses-page.tsx`: derive `isSelectingDoors` from `selecting === 'doors'`, the administrator permission, an `AVAILABLE` selected warehouse, the Available door view, and no armed create/edit mode; hold a `checkedDoorIds` set cleared whenever the mode ends, the warehouse changes, or the lifecycle view changes; make entering any other mode clear it first and vice versa; rebind `useSelectAllShortcut` / `useClearSelectionShortcut` to the doors and disable the warehouse bindings while it is on; and render `BulkResourceLifecycleActions` with `singular="door"`, `plural="doors"`, `idPrefix="warehouse-door"`, `action="archive"`, **no** `describeEffect` and **no** `blockerReasonLabels`, `submit` posting through the `archiveMany` mutation, `refresh` invalidating the warehouse collection, and `onSuccess` narrowing the checked set to the `IN_USE` blockers — depends on T007, T042, T043 (`contracts/warehouse-door-archive-ui-state.md`, `research.md` R7, R8, R9)
- [X] T045 [US4] Add `toBulkWarehouseDoorLifecycleOutcome(result)` to `apps/web/src/features/warehouse-doors/warehouse-door-lifecycle.tsx`, mapping `{ updatedDoors, blockedDoors }` onto `{ updatedCount, blocked }`, and export `BulkWarehouseDoorLifecycleResult` from `apps/web/src/features/warehouse-doors/types.ts` as `Route.Response<'warehouse_doors.archive_many'>['data']` — depends on T019, T040 (`data-model.md` §"Web-side types")

**Checkpoint**: Several doors are archived in one action, with a legible partial outcome and a retry
path. The slice is feature-complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T046 [P] Extend `apps/api/tests/integration/warehouses/lifecycle/archive.spec.ts` and its reactivation sibling with the cross-slice guarantee: a door archived **on its own** is left entirely untouched by its warehouse's later archival — keeping its own time, actor, comment, and `archivedWithWarehouse: false` — and is **not** restored when that warehouse is reactivated, while the doors the cascade archived are (`data-model.md` invariant I1, SC-008)
- [X] T047 [P] Run the regression guard from `quickstart.md`: `warehouse-doors/__tests__/{consultation,feedback,markers}.test.tsx`, `warehouse-doors/__tests__/{create,update}/*`, and `warehouses/__tests__/{consultation,warehouses-page,warehouse-map,select-mode,selection-scope,keyboard-shortcuts,bulk-archive}.test.tsx` must pass unchanged in substance, proving the fourth map mode altered nothing about how warehouses and doors are browsed, created, corrected, or bulk-archived
- [X] T048 [P] Verify `warehouse_doors.available` (#212) and the 201 from `warehouse_doors.store` (#213) still serialize correctly with the four archive members added by T004, and that the doors embedded under `GET /api/v1/warehouses` are byte-for-byte unchanged
- [X] T049 Run `pnpm check`, `pnpm typecheck`, `pnpm --filter @portflow/api test`, `pnpm --filter @portflow/web test`, and `pnpm test`, and fix everything they surface
- [ ] T050 Walk `quickstart.md` scenarios 1–27 manually in the browser against seeded data, including the in-use refusal, the last-available-door case, and the mixed bulk selection (Constitution Principle VII)
- [ ] T051 Obtain a fresh read-only review of the final diff and resolve or explicitly justify every confirmed finding (Constitution Principle VII)

---

## Dependencies

- **Phase 1 → Phase 2 → Phase 3+**: Setup then Foundational block every story.
- **T003 → T004** (RED before the transformer changes); **T012 → T015**; **T033 → T037**.
- **T006 → T016 → T017 → T018**: repository contract, then the write, then the use case, then the
  endpoint.
- **T016 → T026 → T027**: the usage query extends the transaction T016 opened; US2's exception
  mapping extends T017's.
- **T026 → T038**: the bulk write reuses the injected usage checker T026 introduces.
- **T019 → T020 → T028**: the config, then the menu that renders it, then the gating.
- **T041 → T043 → T044**: the marker contract, then the map pass-through, then the page wiring.
- **T037, T038, T039 → T040**: helper, write, use case, then the route.
- **US1 → US2**: US2's implementation extends the transaction and the use case US1 delivers.
- **US3** depends on US1 for the dialog it reports through, and on US2 for the refusals it explains.
- **US4** depends on Foundational and on T026 only; its API and web chains are otherwise independent
  of US1–US3 and can proceed in parallel once Phase 2 is done.
- **Phase 7** depends on every story.

### Parallel opportunities

- **Phase 2**: T002, T003, T005, T006, T007, T008, T009 all run together (T004 waits on T003).
- **Phase 3 tests**: T010, T011, T012, T013, T014 run together.
- **Phase 4 tests**: T022, T024, T025 run together; T023 follows T022, which edits the same integration file.
- **Phase 5 tests**: T029 and T030 run together.
- **Phase 6 tests**: T033, T034, T035, T036 run together.
- **Phase 7**: T046, T047, T048 run together before T049.
- **Cross-workspace**: the whole `apps/api` chain and the whole `apps/web` chain of a given story can
  proceed in parallel by two developers once Phase 2 is done — the MSW handlers (T008) let the web
  side progress before the endpoints exist.

---

## Parallel Example: User Story 1

```bash
# Launch the five RED test tasks together:
Task: "API integration happy path in apps/api/tests/integration/warehouse_doors/lifecycle/archive.spec.ts"
Task: "API use case units in apps/api/tests/unit/warehouse_doors/lifecycle/archive.spec.ts"
Task: "Policy ability unit in apps/api/tests/unit/warehouse_doors/warehouse_door_policy.spec.ts"
Task: "Web entry test in apps/web/src/features/warehouse-doors/__tests__/archive/entry.test.tsx"
Task: "Web confirmation test in apps/web/src/features/warehouse-doors/__tests__/archive/confirmation.test.tsx"

# Then the independent implementation tasks:
Task: "Add archive() to apps/api/app/warehouse_doors/shared/warehouse_door_policy.ts"
Task: "Create apps/web/src/features/warehouse-doors/warehouse-door-lifecycle.tsx"
```

---

## Implementation Strategy

### MVP (User Stories 1 and 2)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 User Story 1 → 4. Phase 4 User Story 2.
5. **STOP and VALIDATE**: `quickstart.md` scenarios 1–13 pass. An administrator can archive an
   eligible door, and every guard rail refuses the ones that must not be archived.

Unlike most slices, the MVP is **two** stories: both are P1 because archiving a door held by a
planned or active discharge would break live operational work, so User Story 1 must not ship without
User Story 2's usage check.

### Incremental Delivery

1. Setup + Foundational → error codes, validators, repository contract, DTO members, mutations, and
   test seams ready.
2. Add User Story 1 → one door archives end to end → demo.
3. Add User Story 2 → the usage, authorization, and lifecycle guards hold on both sides (MVP).
4. Add User Story 3 → every refusal is legible, recoverable, and race-proof.
5. Add User Story 4 → several doors in one action, with a partial outcome and a retry path.
6. Polish → cross-slice guarantee, regression guard, full suite, manual walk, fresh review.

### Deviations recorded after delivery

The task descriptions above are kept as they were planned; delivery diverged from four of them, and
`contracts/warehouse-door-archive-ui-state.md`, `research.md` (R7, R8, R9), `plan.md`, and
`quickstart.md` have been realigned on what was actually built. The differences:

- **T001 was not carried out, and is not needed.** `selecting` still reads `z.enum(['warehouses'])`.
  Checking doors is offered, never entered — opening an available warehouse's Available doors as an
  administrator already puts the checkboxes there — so there is no mode for a URL to carry, and the
  checked set lives in component state (research R7). The permission, warehouse-status, door-view,
  and concurrent-mode conditions T001 would have documented are unchanged; they now gate the offer
  rather than a param value.
- **T042 delivers no `Select doors` / `Stop selecting doors` header control**, for the same reason.
  The `Select all` checkbox, the per-row checkboxes, and the selection row beside them are the whole
  affordance.
- **T044 renders `BulkResourceLifecycleDialog`, not `BulkResourceLifecycleActions`.** The toolbar
  half of that component is the floating map bar; this selection lives in the Doors panel, so the
  panel owns the toolbar's trio — `N selected`, `Archive selected`, `Clear selection` — and hands the
  dialog the same props (research R9). It also passes one `blockerReasonLabels` entry after all:
  `WAREHOUSE_ARCHIVED`, which the shared four have no label for.
- **T044 rebinds no keyboard shortcut.** `useSelectAllShortcut` and `useClearSelectionShortcut` stay
  bound to the warehouses on the map; rebinding follows from a mode, and there is none (research R8).

Two consequences of "offered, never entered" are load-bearing and were **not** in the original plan:
the map suppresses polygon selection only once a door is actually checked (otherwise every other
warehouse is unclickable on every open available warehouse), and `warehouses-page.tsx` carries two
effects — one dropping the checked set when its context goes, one pruning ids the Available list no
longer holds — where a URL param would have made both fall out of the shape.

### Notes

- `[P]` tasks touch different files and carry no dependency on an incomplete task in the same phase.
- No migration and no new shared component: T020 fills the container #214 chose, and both the
  confirmation sentence and the `IN_USE` blocker label are already accurate for a door as written.
- T016 and T038 are the two tasks where correctness is bought: the warehouse-then-door lock order and
  the explicit `archivedWithWarehouse: false` are what keep #210's cascade and this slice from
  archiving the same door twice with conflicting context.
- The blocker helper (T037) is written with the `expectedStatus` parameter its two delivered siblings
  carry, plus a required `availableWarehouseIds` set: a door may only be moved while its containing
  warehouse is available, whichever direction the transition goes. #216 reuses it rather than writing
  a third copy — but this slice delivers no reactivation path (FR-043).
- Commit after each task or logical group, using Conventional Commits on
  `feat/215-archive-warehouse-door`.
- Stop at any checkpoint to validate a story independently.
