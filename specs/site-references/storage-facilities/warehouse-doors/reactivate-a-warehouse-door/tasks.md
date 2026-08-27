# Tasks: Reactivate a Warehouse Door

**Input**: Design documents from `specs/site-references/storage-facilities/warehouse-doors/reactivate-a-warehouse-door/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Observable business behavior follows RED → GREEN → REFACTOR (Constitution Principle IV).
Test tasks must be run and observed failing before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story so each story remains independently testable.
Per `plan.md`, this is a **full-stack** slice: `apps/api` has no warehouse-door lifecycle path today
(`WarehouseDoorsController` exposes `store`, `update`, `available`; `WarehouseDoorRepository`
declares `create`, `updateAvailable`, `listAvailable`; `WarehouseDoorPolicy` declares `create`,
`update`, `listAvailable`). **One migration is needed, and it only drops a column** —
`archived_with_warehouse`, which the spec's clarification leaves with nothing to record (Phase 6);
#210 already added every column this slice writes. **`WarehouseTransformer` loses that one member**
and is otherwise unchanged; `WarehouseDoorTransformer` gains the three reactivation members, so the
endpoint's own `200` reports what it just wrote.
**No shared component change is needed** — `ResourceRowActions`, `ResourceLifecycleDialog`, and
`lifecycle-copy.ts` are consumed exactly as they stand, which is what #214 built the empty row menu
for.

**Blocked-on note**: #215 Archive a Warehouse Door is not delivered. Every task below is
implementable and testable today — an archived door under an available warehouse is exactly a door
archived on its own — but the end-to-end browser round trip that *starts* by archiving a door is only walkable once #215
lands (`quickstart.md`, "Manual browser flow").

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an
  incomplete task in the same phase.
- **[Story]**: Maps a task to its user story from `spec.md`.

---

## Phase 1: Setup

**Purpose**: The two shared API gates every later task composes — who may act, and what the body may
carry. Both are additive to files that already exist.

- [X] T001 [P] Add a `reactivate(user: User): AuthorizerResponse` ability returning `user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'` to `apps/api/app/warehouse_doors/shared/warehouse_door_policy.ts`, identical to the existing `create` and `update` abilities (`research.md` R7; FR-001)
- [X] T002 [P] Add `reactivateWarehouseDoorValidator = vine.create({ comment: lifecycleComment() })` to `apps/api/app/warehouse_doors/shared/warehouse_door_validator.ts`, importing `lifecycleComment` from `#shared/validators/lifecycle_validator` exactly as `warehouse_validator.ts` does — do **not** write a door-specific comment rule (`research.md` R7; FR-010, FR-011)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The error vocabulary, the repository contract, the typed mutation, and the web test
seams — everything more than one user story depends on, and everything #215 will reach for rather
than fork.

**⚠️ CRITICAL**: No user story implementation starts until this phase is complete.

- [X] T003 [P] Add `WarehouseDoorAlreadyAvailableException` (409, `E_WAREHOUSE_DOOR_ALREADY_AVAILABLE`, "Warehouse door is already available") and `WarehouseDoorArchivedWithWarehouseException` (409, `E_WAREHOUSE_DOOR_ARCHIVED_WITH_WAREHOUSE`, "This warehouse door was archived with its warehouse. Reactivate the warehouse and the door returns with it.") to `apps/api/app/warehouse_doors/shared/warehouse_door_exceptions.ts`, following the shape of `WarehouseAlreadyAvailableException`. Do **not** add a door-flavoured duplicate of `E_WAREHOUSE_ARCHIVED` or `E_WAREHOUSE_NOT_FOUND` — those stay reused for the containing warehouse — and extend the file's existing header comment to say why `WarehouseDoorArchivedWithWarehouseException` names a warehouse fact from a door file: its remedy is the door's — reactivating the warehouse brings the door back in the same action, which `E_WAREHOUSE_ARCHIVED`'s "reactivate the warehouse first" would misstate (`research.md` R3; `contracts/warehouse-doors-reactivate.openapi.yaml`)
- [X] T004 [P] Add `ReactivateWarehouseDoorCommand` (`{ id, reactivatedAt: DateTime, reactivatedByUserId: string, reactivationComment: string | null }`), `ReactivateWarehouseDoorResult` (`REACTIVATED` | `DOOR_NOT_FOUND` | `ALREADY_AVAILABLE` | `WAREHOUSE_ARCHIVED` | `WAREHOUSE_NOT_FOUND`), and the abstract `reactivateArchived` method to `apps/api/app/warehouse_doors/shared/repositories/warehouse_door_repository.ts`, documenting — as the neighbouring `UpdateWarehouseDoorResult` does — that every arm but `REACTIVATED` is a repository outcome rather than a pre-check (`data-model.md` §"Transport types")
- [X] T005 [P] Add a `reactivate` mutation to `apps/web/src/features/warehouse-doors/mutations/use-warehouse-door-mutations.ts` built from `tuyauQuery.warehouseDoors.reactivate.mutationOptions({ onSuccess })`, invalidating `warehouseQueries.list()` exactly as the existing `create` and `update` mutations do, and export a `refreshWarehouseDoors` helper performing that same invalidation so `ResourceLifecycleConfig.refresh` can be called on the failure path too (`research.md` R12)
- [X] T006 [P] Extend `apps/web/src/features/warehouses/__tests__/support/handlers.ts` with `reactivateWarehouseDoorHandler(reactivated)` (200), `reactivateWarehouseDoorAlreadyAvailableHandler()` (409 `E_WAREHOUSE_DOOR_ALREADY_AVAILABLE`), `reactivateWarehouseDoorArchivedWithWarehouseHandler()` (409 `E_WAREHOUSE_DOOR_ARCHIVED_WITH_WAREHOUSE`), `reactivateWarehouseDoorNotFoundHandler()` (404 `E_WAREHOUSE_DOOR_NOT_FOUND`), a 422 comment-validation variant, and a network-failure variant
- [X] T007 [P] Add fixtures to `apps/web/src/features/warehouses/__tests__/support/fixtures.ts` beside the existing door fixtures: an archived door under an **available** warehouse (archived on its own — `status: 'ARCHIVED'`, populated `archivedAt` / `archiveComment`), an **archived warehouse** holding two archived doors (archived with it, sharing the building's own archive context), and a **reactivated** door (`status: 'AVAILABLE'` with both `archivedAt` and `reactivatedAt` / `reactivationComment` populated, to prove the row gates on current status)

**Checkpoint**: The error codes, repository contract, typed mutation, MSW handlers, and fixtures all
exist. User story implementation can now begin.

---

## Phase 3: User Story 1 - Put One Archived Door Back Into Service (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator opens `Reactivate` from an archived door row's action menu,
optionally comments, and confirms — the door becomes available with its actor, time, and comment
recorded, while its identity, name, position, containing warehouse, creation time, and archive
history are preserved.

**Independent Test**: Sign in as an authorized administrator, select an available warehouse, open its
archived doors, reactivate one that was archived on its own with or without a comment, and verify it
becomes available, keeps everything else, keeps its archive record readable, and is offered again
wherever doors are chosen for new operational work (`spec.md` US1).

### Tests for User Story 1 (write and observe RED first)

- [X] T008 [P] [US1] Add a failing API integration test for the happy paths in `apps/api/tests/integration/warehouse_doors/lifecycle/reactivate.spec.ts`, following `apps/api/tests/integration/warehouses/lifecycle/reactivate.spec.ts`: an authenticated administrator POSTs `/api/v1/warehouse-doors/:id/reactivate` on a door archived on its own under an available warehouse, with a comment, without a body, and with a whitespace-only comment; each returns 200 with `status: 'AVAILABLE'` and an advanced `updatedAt`, and the persisted row carries `reactivated_at`, `reactivated_by_user_id`, the trimmed-or-null comment, an unchanged `id` / `warehouse_id` / `name` / `latitude` / `longitude` / `created_at`, and its **original** `archived_at`, `archived_by_user_id`, and `archive_comment` (`quickstart.md` scenarios 7, 11, 12; FR-009, FR-010, FR-012, FR-013)
- [X] T009 [P] [US1] Add a failing API integration assertion in the same file that a reactivated door appears in `GET /api/v1/warehouse-doors/available`, and that no other door of the same warehouse changed status (`quickstart.md` scenarios 10, 13; FR-014, FR-017)
- [X] T010 [P] [US1] Add failing API unit tests for `ReactivateWarehouseDoorUseCase` in `apps/api/tests/unit/warehouse_doors/lifecycle/reactivate.spec.ts` against a repository swapped through `app.container.swap` (as `tests/unit/warehouse_doors/creation/create.spec.ts` does): the comment reaches the repository trimmed, and `undefined` / `''` / whitespace-only all arrive as `null`; the actor and the time are passed through from the caller and never read from a payload (`research.md` R7; FR-010)
- [X] T011 [P] [US1] Add a failing web test in `apps/web/src/features/warehouse-doors/__tests__/reactivate/reactivate.test.tsx`: on the Archived door view of an available warehouse, the row for a door archived on its own exposes `Actions for <door name>` containing `Reactivate`; choosing it opens a dialog titled `Reactivate warehouse door?` describing `“<name>” becomes available again for new operations.` with a `Comment (optional)` field and `Cancel` / `Reactivate` buttons; confirming calls the endpoint, closes the dialog, shows a `Warehouse door reactivated` toast, and refetches the warehouse collection (`contracts/warehouse-door-reactivate-ui-state.md` §"The confirmation", §"After a submission"; FR-020, FR-022)
- [X] T012 [P] [US1] Add failing web assertions in the same file that after a success the panel **stays on the Archived tab**, both tab counts move, and — on the Available tab — the reactivated door's row shows `Reactivated · <date> · <comment>` and **no** `Archived …` line despite its stored `archivedAt` (`research.md` R10, R11; `quickstart.md` scenarios 8, 9)
- [X] T013 [P] [US1] Add a failing web assertion in the same file that cancelling the dialog — via `Cancel` and via `Escape` — issues no request and leaves the door archived (`quickstart.md` scenario 6; FR-023)

### Implementation for User Story 1

- [X] T014 [US1] Implement `reactivateArchived` in `apps/api/app/warehouse_doors/shared/repositories/lucid_warehouse_door_repository.ts`: guard `isUuid(command.id)` → `DOOR_NOT_FOUND`; take the **unlocked pre-read** of the door to learn its `warehouseId`, as `updateAvailable` does and for the same reason (containment is permanent); open a transaction, lock the warehouse with `.where('id', door.warehouseId).where('status', 'AVAILABLE').forUpdate()` — **without** `.preload('footprintPoints')`, since reactivation asks no containment question; then run the guarded write `.where('id', command.id).where('status', 'ARCHIVED').update({ status: 'AVAILABLE', reactivatedAt, reactivatedByUserId, reactivationComment, updatedAt: reactivatedAt })`, writing `updatedAt` explicitly because a query-builder update bypasses Lucid's timestamp hooks. The locked warehouse read above is what confines this path to a door archived on its own, so the write needs no provenance predicate. Do **not** null the archive columns. Re-read the row and return `{ kind: 'REACTIVATED', door }`. For this story, both miss paths may return `DOOR_NOT_FOUND`; T023 refines them — depends on T004 (`research.md` R5, R6; `data-model.md`)
- [X] T015 [US1] Create `apps/api/app/warehouse_doors/reactivate/reactivate_warehouse_door_use_case.ts` modelled on `#warehouses/reactivate/reactivate_warehouse_use_case`: accept `{ id, reactivatedByUserId, reactivatedAt, comment }`, call `repository.reactivateArchived` with `reactivationComment: input.comment?.trim() || null`, throw `WarehouseDoorNotFoundException` on `DOOR_NOT_FOUND`, and return the door on `REACTIVATED` — depends on T014 (`research.md` R7; `data-model.md` §"Result → exception mapping")
- [X] T016 [US1] Add a `reactivate` action to `apps/api/app/controllers/warehouse_doors_controller.ts` that reads the user with `auth.use('web').getUserOrFail()`, authorizes `WarehouseDoorPolicy`'s `reactivate`, validates with `reactivateWarehouseDoorValidator`, calls the use case with `params.id`, `user.id`, `DateTime.now()`, and `payload.comment`, and serializes through `WarehouseDoorTransformer` with a 200 — mirroring `WarehousesController.reactivate` — and register `router.post('/:id/reactivate', [controllers.WarehouseDoors, 'reactivate']).as('reactivate')` in the `warehouse-doors` group of `apps/api/start/routes.ts`. No ordering guard is needed: this slice adds no collection route — depends on T001, T002, T015 (`research.md` R1)
- [X] T017 [P] [US1] Create `apps/web/src/features/warehouse-doors/warehouse-door-lifecycle.tsx` modelled line for line on `apps/web/src/features/trucks/truck-lifecycle.tsx`, exporting `WAREHOUSE_DOOR_SINGULAR = 'warehouse door'`, `warehouseDoorLifecycleActions(door, warehouseStatus)` returning `['reactivate']` only when `door.status === 'ARCHIVED' && warehouseStatus === 'AVAILABLE'` and `[]` otherwise, `useWarehouseDoorLifecycleConfig(door)` building the `ResourceLifecycleConfig` (`singular`, `name: door.name`, `submit`, `refresh`, `isPending`), and `WarehouseDoorLifecycleDialog` wrapping `ResourceLifecycleDialog`. Pass **no** `describeEffect` and **no** `describeSuccess`: this slice has nothing to add to the canonical wording — depends on T005 (`research.md` R8, R9; FR-022)
- [X] T018 [US1] Wire the menu in `apps/web/src/features/warehouse-doors/ui/warehouse-door-row-actions.tsx`: pass `actions={warehouseDoorLifecycleActions(door, warehouseStatus)}` and `renderDialog={({ action, onClose }) => <WarehouseDoorLifecycleDialog action={action} door={door} onClose={onClose} />}`, and replace the file's "deliberately empty / #215 and #216 will fill it" comment with what is now true. `ResourceRowActions` itself is **not** modified — its non-empty-actions arm already requires exactly this pair — depends on T017
- [X] T019 [US1] Add the reactivation line to `apps/web/src/features/warehouse-doors/ui/warehouse-doors-panel.tsx`, symmetric with the existing archived line and gated the same way: when `door.status === 'AVAILABLE' && door.reactivatedAt`, render `Reactivated · {formatDateTime(door.reactivatedAt)}{door.reactivationComment ? ` · ${door.reactivationComment}` : ''}`. Do not render the actor — the embedded DTO carries `reactivatedByUserId`, not a resolved user, exactly as the archive line does (`research.md` R10)

**Checkpoint**: An authorized administrator can reactivate an eligible door end to end, and the panel
tells the new story. User Story 1 is independently demonstrable.

---

## Phase 4: User Story 2 - Be Refused With a Specific Reason When a Door Cannot Come Back (Priority: P2)

**Goal**: Every ineligible door is refused with the one reason that names its remedy — already
available, not found, archived with its warehouse, or sitting under an archived warehouse — and
nothing changes.

**Independent Test**: Attempt in turn to reactivate an available door, an unknown identifier, an
archived door whose warehouse is archived, and a door recorded as archived through its warehouse;
verify each is refused with its own reason, that the archived-warehouse refusals point at
reactivating the warehouse, and that no door and no warehouse changes (`spec.md` US2).

### Tests for User Story 2 (write and observe RED first)

- [X] T020 [P] [US2] Add failing API integration tests to `apps/api/tests/integration/warehouse_doors/lifecycle/reactivate.spec.ts` for each refusal: an available door → 409 `E_WAREHOUSE_DOOR_ALREADY_AVAILABLE`; any door of an archived warehouse → 409 `E_WAREHOUSE_DOOR_ARCHIVED_WITH_WAREHOUSE`, whose message names the one-step remedy and never "reactivate the warehouse first"; an unknown UUID and a malformed `not-a-uuid` → 404 `E_WAREHOUSE_DOOR_NOT_FOUND` and never a 500. Assert after each that the stored door's status and every lifecycle column are byte-identical to before (`quickstart.md` scenarios 15–18; FR-004, FR-005, FR-006, FR-007, FR-027)
- [X] T021 [P] [US2] Add a failing API integration test asserting the two archived-warehouse refusals carry **different** messages — one saying the door returns with the warehouse, the other saying the warehouse must be reactivated first — so an administrator can tell a one-step remedy from a two-step one (`research.md` R3, R4; FR-029)
- [X] T022 [P] [US2] Add a failing web test in `apps/web/src/features/warehouse-doors/__tests__/reactivate/entry.test.tsx` covering the whole gate matrix of `contracts/warehouse-door-reactivate-ui-state.md` §"When the entry is offered": available door → `Edit` only; archived door under an available warehouse → `Reactivate` only; any door of an archived warehouse → **no menu rendered at all**; and a viewer without warehouse-door management permission → no menu on any row (`quickstart.md` scenarios 1–4; FR-003, FR-024)

### Implementation for User Story 2

- [X] T023 [US2] Refine the two miss paths of `reactivateArchived` in `apps/api/app/warehouse_doors/shared/repositories/lucid_warehouse_door_repository.ts` into the three-way fallback of `research.md` R4: when the locked warehouse read misses **or** the guarded write affects zero rows, re-read the door — gone → `DOOR_NOT_FOUND`, `status === 'AVAILABLE'` → `ALREADY_AVAILABLE` — then re-read the warehouse — gone or `AVAILABLE` → `WAREHOUSE_NOT_FOUND` (retryable; guidance the administrator cannot act on is worse than a retry, the reasoning `create` documents), archived → `WAREHOUSE_ARCHIVED`. Comment why the door is consulted first: a warehouse reactivation committing in that window restores the door, and `ALREADY_AVAILABLE` is then both true and actionable — depends on T014
- [X] T024 [US2] Extend the mapping in `apps/api/app/warehouse_doors/reactivate/reactivate_warehouse_door_use_case.ts` to throw `WarehouseDoorAlreadyAvailableException` on `ALREADY_AVAILABLE`, `WarehouseDoorArchivedWithWarehouseException` on `WAREHOUSE_ARCHIVED` (the door's own remedy, FR-007), and `WarehouseNotFoundException` — imported from `#warehouses/shared/warehouse_exceptions` rather than minted as a door-flavoured duplicate — on `WAREHOUSE_NOT_FOUND` — depends on T003, T023 (`data-model.md` §"Result → exception mapping")
- [X] T025 [US2] Add failing-then-passing unit coverage in `apps/api/tests/unit/warehouse_doors/lifecycle/reactivate.spec.ts` that each of the five repository result kinds maps to its exception, with the repository swapped to return each kind in turn — depends on T024

**Checkpoint**: Every ineligible door is refused with an actionable reason, and the interface offers
the action only where it can succeed. User Stories 1 and 2 both work.

---

## Phase 5: User Story 3 - Keep Unauthorized and Malformed Reactivations Out (Priority: P3)

**Goal**: Reactivation is denied to anyone without warehouse-door management permission, refused when
the comment is invalid, and an interrupted submission leaves the door exactly as it was and is
retryable.

**Independent Test**: Attempt a reactivation as an unauthenticated visitor, as an inactive user, and
as each active role without the permission; then with an over-long comment; then submit a valid one
while the capability fails and retry after recovery (`spec.md` US3).

### Tests for User Story 3 (write and observe RED first)

- [X] T026 [P] [US3] Add failing assertions for the `reactivate` ability to `apps/api/tests/unit/warehouse_doors/warehouse_door_policy.spec.ts`, beside the existing `create` and `update` cases: allowed for `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, refused for every other role (FR-001, FR-002)
- [X] T027 [P] [US3] Add failing API integration tests to `apps/api/tests/integration/warehouse_doors/lifecycle/reactivate.spec.ts`: unauthenticated → 401; an authenticated user whose access is not active → 403; each active non-admin role → 403; with the stored door unchanged in every case (`quickstart.md` scenario 19; FR-002, SC-005)
- [X] T028 [P] [US3] Add a failing API integration test for the comment rule: a 1,001-character comment → 422 naming the `comment` field with the door still archived, and the same request at exactly 1,000 characters → 200, following `apps/api/tests/unit/warehouses/lifecycle/comment_validation.spec.ts` for the boundary shape (`quickstart.md` scenario 20; FR-011, SC-006)
- [X] T029 [P] [US3] Add a failing API integration test for concurrency: two simultaneous reactivations of the same archived door produce exactly one 200 and one 409 `E_WAREHOUSE_DOOR_ALREADY_AVAILABLE`, with a single stored `reactivated_at` / `reactivated_by_user_id` / `reactivation_comment` — the loser must not overwrite the winner's context (`quickstart.md` scenario 22; FR-028, SC-008)
- [X] T030 [P] [US3] Add a failing web test in `apps/web/src/features/warehouse-doors/__tests__/reactivate/refusals.test.tsx`: on a 409 and on a network failure, the dialog **stays open** with the typed comment intact, an `Unable to reactivate warehouse door “<name>”` toast appears described by the server's message, the warehouse collection is refetched **on the failure path too**, and a retry after the handler recovers succeeds exactly once (`contracts/warehouse-door-reactivate-ui-state.md` §"Refusal"; FR-026, FR-030, SC-009)
- [X] T031 [P] [US3] Add a failing web assertion in the same file that a 422 comment refusal surfaces the **field-level** message rather than the bare "Validation failure", relying on `ResourceLifecycleDialog`'s existing `error.details?.[0]?.message` preference (FR-029)

### Implementation for User Story 3

- [X] T032 [US3] Make T026–T031 pass. Expect **no production change** beyond what Phases 1–4 already delivered: the policy ability (T001), the validator (T002), the guarded write's atomicity (T014), and the dialog's keep-open-and-refresh behavior are what these tests assert. Record in the PR description any test that required a production change, since that indicates a gap in an earlier phase rather than new scope — depends on T016, T024
- [X] T033 [US3] Verify the all-or-nothing guarantee explicitly: add an assertion to `apps/api/tests/integration/warehouse_doors/lifecycle/reactivate.spec.ts` that a door is never left `AVAILABLE` without a complete `reactivated_at` / `reactivated_by_user_id` trio, and never left available under an archived warehouse, across every refusal and failure path exercised in Phases 4–5 — depends on T032 (FR-008, FR-026, SC-004)

**Checkpoint**: All three user stories are independently functional and the guard rails hold.

---

## Phase 6: The cascade rule this slice changes

**Purpose**: The spec's clarification widens #210's cascade and #211's restore to every door of the
warehouse, which is what makes `archived_with_warehouse` redundant and this slice's eligibility a
two-condition predicate. These tasks land that change and remove the column.

- [X] T039 Widen the cascade in `apps/api/app/warehouses/shared/repositories/lucid_warehouse_repository.ts`: `applyArchival`'s door update drops its `.where('status', 'AVAILABLE')` guard so every door of the warehouse is archived with it and a door archived on its own has its time, actor, and comment replaced by the building's; `applyReactivation`'s drops both `.where('status', 'ARCHIVED')` and `.where('archivedWithWarehouse', true)` so it is the exact mirror. Document both, and that `archivedDoorCount` / `reactivatedDoorCount` now report every door the write touched (#210 FR-012, FR-013 and #211 FR-007–FR-009, as amended by this slice)
- [X] T040 Update the tests that asserted the narrow rule: `apps/api/tests/unit/warehouses/lifecycle/door_cascade.spec.ts` (an already-archived door is taken over, not skipped), `door_restore.spec.ts` (every door comes back; the full archive → restore → archive-on-its-own → archive → restore cycle ends with the door available), `bulk_archive.spec.ts`, `bulk_reactivate.spec.ts`, and `apps/api/tests/integration/warehouses/lifecycle/door_archived_on_its_own.spec.ts` — depends on T039
- [X] T041 Create `apps/api/database/migrations/<ts>_drop_archived_with_warehouse_from_warehouse_doors.ts` using raw `ALTER TABLE … DROP COLUMN` rather than `table.dropColumn`, which on SQLite rebuilds the table and is refused by the children of `warehouse_doors`; run `pnpm --filter @portflow/api db:migrate` to regenerate `apps/api/database/schema.ts` (`research.md` R6)
- [X] T042 Remove the column's readers and writers: the model's `archivedWithWarehouse` declaration and its boolean normalizer, the factory's default and its `archivedWithWarehouse` state, `WarehouseTransformer`'s embedded member, `WarehouseDoorTransformer`'s picked member, and every write in `lucid_warehouse_door_repository.ts` (`create`, `archiveAvailable`, `archiveAvailableMany`) — depends on T041
- [X] T043 Take the provenance off the door in `apps/web`: `warehouse-doors-panel.tsx` derives "Archived with this warehouse" / "Archived on its own" from `warehouse.status`; `warehouse-door-lifecycle.tsx` drops the flag from its gate; `warehouse-lifecycle.tsx` collapses `countAvailableDoors` / `countRestorableDoors` into one `countDoors` and restates the cascade and restore sentences without "available" and "archived with it"; fixtures, handlers, and the tests asserting that copy follow — depends on T042
- [X] T044 [P] Amend the **Warehouse** entry in `CONTEXT.md` to state that archival takes every door of the warehouse and that reactivation is its exact mirror, and the **Warehouse Door** entry to state that a door is archived and returned to service on its own only while its warehouse is available. Keep both to the vocabulary definition — no procedure, no issue numbers (Constitution Principle VI)
- [X] T045 [P] Amend #210's and #211's own specifications to record the superseded requirements, so no delivered artifact keeps describing the narrow rule

**Checkpoint**: One rule governs both directions, and nothing records a provenance the warehouse's
own status does not already state.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T035 [P] Update `specs/site-references/storage-facilities/warehouse-doors/roadmap.md` to mark #216 delivered with its artifact path, leaving the other rows untouched
- [X] T036 Run `pnpm check`, `pnpm typecheck`, `pnpm --filter @portflow/api test`, `pnpm --filter @portflow/web test`, and `pnpm test`, and fix what they report
- [ ] T037 Walk `quickstart.md` scenarios 1–14, 17, and 21 in the browser, recording the result in the PR description and noting explicitly that the archive→reactivate round trip through the interface stays blocked on #215 rather than silently skipping it
- [ ] T038 Obtain a fresh read-only review of the final diff and resolve or explicitly justify each confirmed finding (Constitution Principle VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001 and T002 are independent files
- **Foundational (Phase 2)**: Independent of Phase 1 in practice, but both must be complete before any user story
- **User Story 1 (Phase 3)**: Depends on Phases 1–2 — delivers the MVP
- **User Story 2 (Phase 4)**: Depends on Phase 3, because T023 refines the repository method T014 creates and T024 extends the use case T015 creates
- **User Story 3 (Phase 5)**: Depends on Phases 3–4 for the endpoint it exercises; it adds almost no production code of its own
- **Phase 6 (the cascade rule)**: T039–T043 depend on Phases 3–5 being green, since they change the
  behaviour those phases assert; T044 and T045 are documentation and depend only on T039
- **Polish (Phase 7)**: Depends on every story and on Phase 6

### The one cross-story dependency, stated plainly

US2 is **not** independent of US1 at the file level: `reactivateArchived` and the use case's
exception mapping are created in Phase 3 and refined in Phase 4. This is deliberate — splitting the
repository method across two files to keep the phases file-disjoint would be worse code for the sake
of a chart. Each story stays independently *testable* and *demonstrable*, which is what the
constitution asks: after Phase 3 an administrator can reactivate a door end to end; after Phase 4
every refusal names its remedy.

### Within Each User Story

- Tests are written and observed failing before their implementation tasks
- Repository before use case, use case before controller, controller before web wiring
- The web lifecycle module (T017) before the row wiring (T018) that consumes it

### Parallel Opportunities

- T001 and T002 (Setup) — different files
- T003, T004, T005, T006, T007 (Foundational) — five different files, two workspaces
- T008–T013 (US1 tests) — API integration, API unit, and web files are disjoint
- T017 is parallel to T014–T016: the web lifecycle module needs only the mutation from T005, not the API implementation
- T020, T021, T022 (US2 tests) — API and web files are disjoint
- T026–T031 (US3 tests) — policy unit, integration, and web files are disjoint
- T044 and T045 (Phase 6) — `CONTEXT.md` and the two sibling spec folders

---

## Parallel Example: User Story 1

```bash
# Write all six US1 tests together and observe them fail:
Task: "API integration happy paths in apps/api/tests/integration/warehouse_doors/lifecycle/reactivate.spec.ts"      # T008
Task: "API integration availability + isolation assertions in the same file"                                        # T009
Task: "API unit comment trimming in apps/api/tests/unit/warehouse_doors/lifecycle/reactivate.spec.ts"               # T010
Task: "Web confirmation flow in apps/web/src/features/warehouse-doors/__tests__/reactivate/reactivate.test.tsx"     # T011
Task: "Web tab/count/row-line assertions in the same file"                                                          # T012
Task: "Web cancel assertions in the same file"                                                                      # T013

# Then the API chain (T014 → T015 → T016) and the web module (T017) in parallel.
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup — policy ability and comment validator
2. Complete Phase 2: Foundational — exceptions, repository contract, mutation, test seams
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: `quickstart.md` scenarios 5–13 pass; an administrator reactivates a door
   end to end and the panel reflects it
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → the seams exist, nothing is user-visible
2. Add User Story 1 → the happy path works → **MVP**
3. Add User Story 2 → every refusal names its remedy, and the menu hides what cannot succeed
4. Add User Story 3 → the guard rails and the recovery path are proven
5. Polish → roadmap, full verification, review
6. Phase 6 → the cascade rule, the dropped column, `CONTEXT.md`, and the amended sibling specs

### Note on staffing

This slice is small and its phases are chained through two API files; splitting it across
developers would cost more in coordination than it saves. One developer, four sittings, is the
realistic shape.

---

## Notes

- `[P]` tasks touch different files and depend on nothing incomplete in the same phase
- `[Story]` maps a task to its user story for traceability
- Every test task must be observed failing before its implementation task is started
- Commit after each task or logical group, using Conventional Commits on
  `feat/216-reactivate-warehouse-door`
- `ResourceRowActions`, `ResourceLifecycleDialog`, `lifecycle-copy.ts`, and `WarehouseTransformer`
  are consumed unchanged — a task that proposes editing one of them has
  drifted from the plan
