# Tasks: Reactivate Weighing Areas

**Input**: Design documents from
`specs/site-references/operational-checkpoints/weighing-areas/reactivate-weighing-areas/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Observable business behavior follows RED → GREEN → REFACTOR (Constitution Principle IV).
Test tasks are written and observed failing before their implementation tasks — with one documented
exception: the individual-reactivate backend already exists and is correct (`research.md` D1), so
its tests are **characterization** tests, written and expected to pass on first run. Each such task
says so explicitly. A characterization test that goes RED has found a real defect; fix the
implementation, do not soften the test.

**Organization**: Tasks are grouped by user story so each story remains independently testable.

This slice starts from the most complete baseline of any weighing-area lifecycle slice:

- The **individual** reactivate backend exists end to end and is partly tested. US1's backend work
  is an HTTP-level test top-up, not new production code.
- The **bulk** backend does not exist at any layer and is US2's primary deliverable — five
  mechanical additions, no new abstraction (`research.md` D3).
- The **frontend select mode** is already kind-and-intent driven. #205 left four `#206`
  forward-references marking exactly where this slice plugs in; filling them is the entire bulk-UI
  change (`research.md` D4).

One task changes already-shipped behavior: T004 corrects `reactivateWeighingAreaValidator` to
enforce the 1,000-character lifecycle comment limit (`research.md` D2). It is isolated in Phase 2
with its own RED test so it can be dropped cleanly if plan review rejects it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an
  incomplete task in the same phase.
- **[Story]**: Maps a task to its user story from `spec.md`.

---

## Phase 1: Setup

**Purpose**: Give the multi-selection tests a second archived weighing area to select, and record a
green baseline for the suites this slice must not regress. No production code changes here.

- [X] T001 Append a fourth entry to `WEIGHING_AREAS` in `apps/web/src/features/weighing-areas/__tests__/support/fixtures.ts` — a second `ARCHIVED` weighing area (e.g. `Gamma Scale`, a distinct UUID, `archivedAt`/`archiveComment` populated, `reactivatedAt`/`reactivationComment` null) — appended at index 3 so every existing positional reference (`WEIGHING_AREAS[0]`, `[1]`, `[2]`) keeps pointing at the same fixture; a single archived fixture cannot express "select several archived weighing areas"
- [X] T002 Run `pnpm --filter @portflow/web test` and `pnpm --filter @portflow/api test` and record the baseline as green — specifically `apps/web/src/features/checkpoints/__tests__/bulk-archive/*`, `apps/web/src/features/checkpoints/__tests__/bulk-reactivate/*`, `apps/web/src/features/weighing-areas/__tests__/*`, and `apps/api/tests/integration/weighing_areas*`; a fixture appended in T001 must not have disturbed any of them (depends on T001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Make `weighing_area_validator.ts` the single, consistent home for both reactivation
request shapes before either story touches it. US1's individual endpoint depends on the corrected
comment rule; US2's bulk endpoint depends on the new selection validator; US3 asserts both.

**⚠️ CRITICAL**: US2's controller task (T022) cannot be completed until T005 exists, and US3's
comment-validation assertions rely on T004.

- [X] T003 Add a RED integration case to `apps/api/tests/integration/weighing_areas.spec.ts`: `POST /api/v1/weighing-areas/:id/reactivate` with a 1,001-character comment returns 422, and the weighing area is re-read afterwards to assert it is still `ARCHIVED` with its `reactivatedAt`, `reactivatedByUserId`, and `reactivationComment` all still null (spec FR-008, FR-016; `contracts/weighing-area-reactivate-api.md`) — this is the one genuinely RED test against existing backend behavior
- [X] T004 Change `reactivateWeighingAreaValidator` in `apps/api/app/weighing_areas/shared/weighing_area_validator.ts` from `vine.create({ comment: vine.string().nullable().optional() })` to `vine.create({ comment: lifecycleComment() })`, matching `archiveWeighingAreaValidator` in the same file; `lifecycleComment` is already imported there (depends on T003; `research.md` D2)
- [X] T005 Add `reactivateWeighingAreasValidator = vine.create({ ids: lifecycleIds(), comment: lifecycleComment() })` to `apps/api/app/weighing_areas/shared/weighing_area_validator.ts`, built from the same factories as the existing `archiveWeighingAreasValidator` directly above it (depends on T004 — same file)

**Checkpoint**: Both reactivation request shapes are validated by the shared lifecycle factories.
The individual endpoint now enforces the comment limit; the bulk endpoint has a validator waiting
for its controller. US1 and US2 implementation can both proceed.

---

## Phase 3: User Story 1 - Bring One Archived Weighing Area Back Into Service (Priority: P1) 🎯 MVP candidate A

**Goal**: An authorized administrator opens an archived weighing area on the Checkpoints map and
reactivates it, optionally with a comment, through the existing (already-correct) backend — the
weighing area is offered again for new operational work while keeping its identity and its archive
context.

**Independent Test**: Set the status filter to Archived or All, open an archived weighing area,
reactivate it with and without a comment, and verify it is shown available with the new reactivation
metadata while its archive context, name, latitude, longitude, and creation time are unchanged
(`spec.md`, US1).

### Tests for User Story 1

> T006 is a **characterization** test of behavior that already exists and is already correct
> (`research.md` D1). Write it, then expect it to pass on first run.

- [X] T006 [P] [US1] Add the missing HTTP-level cases for the individual reactivate endpoint to `apps/api/tests/integration/weighing_areas.spec.ts`, alongside the happy path already there: unknown id → 404 `E_WEIGHING_AREA_NOT_FOUND`; already-available weighing area → 409 `E_WEIGHING_AREA_ALREADY_AVAILABLE` with its lifecycle context unchanged; a user whose access is not active → denied; an active non-administrator → denied; happy path with a comment → 200 with `status: 'AVAILABLE'`, `reactivatedAt`/`reactivatedByUserId`/`reactivationComment` set **and** `archivedAt`/`archivedByUserId`/`archiveComment` preserved and `name`/`latitude`/`longitude`/`createdAt` unchanged; whitespace-only comment → 200 with `reactivationComment` null — every refusal case asserting the stored row is unchanged (`contracts/weighing-area-reactivate-api.md` coverage table; spec FR-002, FR-004 to FR-007, FR-009, FR-010)
- [X] T007 [P] [US1] Add a web test for the individual reactivate UI in `apps/web/src/features/weighing-areas/__tests__/reactivate/individual.test.tsx` (new file), modelled on `apps/web/src/features/weighing-areas/__tests__/archive/individual.test.tsx`: under `status=all`, an archived weighing area's detail sheet offers `Reactivate weighing area` and **no** `Edit weighing area`; an available one offers `Edit weighing area` + `Archive weighing area` and no reactivate action; activating it opens a confirmation titled `Reactivate weighing area?` with an optional comment field capped at 1,000 characters; confirming posts to `weighing_areas.reactivate`, shows a `Weighing area reactivated` toast, and flips the marker and sheet to available without a manual reload; cancelling leaves the weighing area archived and unchanged (`quickstart.md` scenarios 1–3, 5; `contracts/weighing-area-reactivate-ui-state.md` section A)
- [X] T008 [P] [US1] Add a recovery test in `apps/web/src/features/weighing-areas/__tests__/reactivate/recovery.test.tsx` (new file), modelled on the sibling `archive/recovery.test.tsx`: a 422 refusal shows an `Unable to reactivate weighing area “{name}”` toast whose description carries the **field-level** validation message rather than the generic top-level one, the dialog stays open with the typed comment intact, and resubmitting after shortening the comment succeeds without reopening the weighing area (spec US3 scenario 3, FR-016, FR-034; `research.md` D8; `quickstart.md` scenario 4)

### Implementation for User Story 1

- [X] T009 [P] [US1] Add a `reactivate` mutation (`tuyauQuery.weighingAreas.reactivate.mutationOptions({ onSuccess: () => invalidateWeighingAreas() })`) to `apps/web/src/features/weighing-areas/mutations/use-weighing-area-mutations.ts`, mirroring the existing `archive` mutation, and export it from the returned object
- [X] T010 [US1] Extend `apps/web/src/features/weighing-areas/ui/weighing-area-lifecycle-actions.tsx` with the archived branch, taking the branching shape from `docks/ui/dock-lifecycle-actions.tsx`: derive `archived = area.status === 'ARCHIVED'` and switch the trigger label and variant, dialog title, dialog description, confirm label, mutation, and both toast strings on it. **Keep this component's existing error handling unchanged** — `event.preventDefault()` on the confirm handler so the dialog survives a refusal, and `error.details?.[0]?.message ?? error.message` as the toast description (depends on T009; `research.md` D8; table in `contracts/weighing-area-reactivate-ui-state.md` section A)
- [X] T011 [US1] Widen the footer condition in `apps/web/src/features/weighing-areas/ui/weighing-area-details.tsx` from `canEdit && area.status === 'AVAILABLE'` to `canEdit` alone, keeping `Edit weighing area` inside an `area.status === 'AVAILABLE'` guard while `WeighingAreaLifecycleActions` renders for both statuses — the shape `docks/ui/dock-details.tsx` already uses, so an archived weighing area's sheet gets a reactivate action and no edit action (depends on T010; spec FR-013, FR-018)
- [X] T012 [US1] Run the focused US1 tests (T006, T007, T008) and refactor without changing behavior

**Checkpoint**: An administrator can reactivate one archived weighing area end to end, with or
without a comment. US1 is independently demonstrable.

---

## Phase 4: User Story 2 - Reactivate a Selection of Archived Weighing Areas Together (Priority: P1) 🎯 MVP candidate B

**Goal**: An authorized administrator selects several archived weighing areas on the Checkpoints map
and reactivates every eligible one in a single action, with every blocked entry reported
individually with its reason.

**Independent Test**: Check several archived weighing areas, submit one reactivation with a shared
comment, and verify they all become available with identical reactivation metadata; then submit a
selection mixing archived weighing areas, an already-available one, and an unknown identifier via
the API and verify partial success with `ALREADY_AVAILABLE` / `NOT_FOUND` reported per entry
(`spec.md`, US2).

### Tests for User Story 2 (write and observe RED first — this surface is entirely new)

- [X] T013 [P] [US2] Add bulk reactivation integration tests in `apps/api/tests/integration/weighing_areas/lifecycle/bulk/reactivate.spec.ts` (new file), mirroring the sibling `bulk/archive.spec.ts`: unauthenticated → denied; non-active user → denied; active non-administrator → denied; a selection made only of archived weighing areas reactivates every one with the shared comment, the same actor, and the same timestamp; a mixed selection (one already-available, one unknown id, one archived) reactivates only the archived one and reports the other two with `ALREADY_AVAILABLE` (carrying `name`) and `NOT_FOUND` (carrying no `name`), both lists in request order; a fully-blocked selection still returns 200 with an empty `updatedWeighingAreas`, not a 4xx; every reactivated weighing area keeps its id, name, latitude, longitude, `createdAt`, and its archive context; an archived weighing area referenced by recorded weighings and a closed discharge's ended shift membership reactivates successfully with those references intact and **never** reports `IN_USE` (`contracts/weighing-area-reactivate-api.md`; spec FR-004, FR-005, FR-009 to FR-012, FR-023 to FR-025; uses `apps/api/tests/support/persisted_weighing_area_usage.ts`)
- [X] T014 [US2] Add a concurrency case to `apps/api/tests/integration/weighing_areas/lifecycle/bulk/reactivate.spec.ts`: fire two overlapping bulk reactivations that both include the same archived weighing-area id at nearly the same time and assert exactly one reactivates it while the other reports `ALREADY_AVAILABLE`, with a single `reactivatedAt` and a single `reactivationComment` stored and the first writer's comment never overwritten (depends on T013 — same file; `research.md` D6; spec FR-015; `quickstart.md` scenario 11)
- [X] T015 [P] [US2] Add a unit test for the bulk reactivation path in `apps/api/tests/unit/weighing_areas/lifecycle/bulk_reactivate.spec.ts` (new file), mirroring `bulk_archive.spec.ts`: `findBulkBlockers(ids, areasById, 'ARCHIVED')` produces `NOT_FOUND` for a missing id and `ALREADY_AVAILABLE` for an available one, and **never** `IN_USE` even when a non-empty `usedIds` set is passed; `ReactivateWeighingAreasUseCase` partitions a mixed id list into `updatedWeighingAreas`/`blockedWeighingAreas` correctly and trims the comment to null when it is blank; a weighing area cycled archive → reactivate → archive → reactivate ends available with both context groups populated and its identity unchanged (spec FR-003, FR-007, FR-019)
- [X] T016 [P] [US2] Add an intent-scoped select-mode test in `apps/web/src/features/checkpoints/__tests__/bulk-reactivate-weighing-areas/select-mode.test.tsx` (new file), modelled on `__tests__/bulk-reactivate/select-mode.test.tsx`: under `status=all` and `Select weighing areas` mode, with nothing checked both available and archived weighing-area markers are checkable; checking an archived one fixes the intent and makes available markers non-checkable, and the bar reads `Reactivate selected`; checking an available one instead reads `Archive selected`; clearing the selection makes both statuses checkable again (`contracts/weighing-area-reactivate-ui-state.md` section B; `quickstart.md` scenario 10)
- [X] T017 [P] [US2] Add a bulk reactivation action-bar test in `apps/web/src/features/checkpoints/__tests__/bulk-reactivate-weighing-areas/bulk-reactivate-actions.test.tsx` (new file): `Reactivate selected` opens a confirmation titled `Reactivate selected weighing areas?` carrying the weighing-area reactivate description and an optional shared comment; a fully-eligible submission posts to `weighing_areas.reactivate_many` with `{ ids, comment }`, clears the selection, and toasts `N weighing areas reactivated`; a mixed submission toasts `N weighing areas reactivated; M unchanged` with each blocked entry named and its reason labelled `already available` / `not found`, and clears the selection **entirely** including blocked entries (`research.md` D5); an all-blocked submission toasts `0 weighing areas reactivated; M unchanged` rather than an error; a failing request toasts `Unable to reactivate weighing areas` and leaves the selection intact (spec FR-024, FR-029, FR-034; `quickstart.md` scenarios 9, 11, 12)
- [X] T018 [P] [US2] Add a keyboard-shortcut test in `apps/web/src/features/checkpoints/__tests__/bulk-reactivate-weighing-areas/keyboard-shortcuts.test.tsx` (new file), mirroring the dock one: with only weighing areas visible under `status=archived` and nothing checked, Ctrl/Cmd+A checks every visible archived weighing area and the bar reads `Reactivate selected`; under `status=available` it checks the available ones and reads `Archive selected`; with an archived selection already in progress it extends that selection with archived weighing areas only; it stays inert while focus is in a text field (spec FR-030; `quickstart.md` scenario 16)

### Implementation for User Story 2 — backend

- [X] T019 [US2] Add `ReactivateWeighingAreasCommand` (`ids`, `reactivatedAt`, `reactivatedByUserId`, `reactivationComment`) and an abstract `reactivateArchivedMany(command): Promise<BulkWeighingAreaLifecycleResult>` to `apps/api/app/weighing_areas/shared/repositories/weighing_area_repository.ts`, reusing the existing `BulkWeighingAreaLifecycleResult` unchanged (`data-model.md` "Bulk Reactivation Result")
- [X] T020 [US2] Implement `reactivateArchivedMany` in `apps/api/app/weighing_areas/shared/repositories/lucid_weighing_area_repository.ts`: one `WeighingArea.transaction`, lock candidate rows with `.forUpdate()`, compute blockers via `findBulkBlockers(command.ids, areasById, 'ARCHIVED')` with **no** usage-checker call, then `UPDATE … WHERE id IN (eligibleIds) AND status = 'ARCHIVED'` setting `status`, `reactivatedAt`, `reactivatedByUserId`, `reactivationComment`, `updatedAt` and leaving every archive column untouched, keeping the `affectedRows !== eligibleIds.length` guard that rolls back rather than writing partially — mirroring `archiveAvailableMany` in the same file and `LucidDockRepository.reactivateArchivedMany` (depends on T019; spec FR-022, FR-026, FR-027; `research.md` D3, D6)
- [X] T021 [US2] Create `apps/api/app/weighing_areas/reactivate/reactivate_weighing_areas_use_case.ts`: a thin `@inject()`ed wrapper delegating to `weighingAreaRepository.reactivateArchivedMany` with `comment?.trim() || null`, mirroring `archive/archive_weighing_areas_use_case.ts` exactly (depends on T020)
- [X] T022 [US2] Add `reactivateMany` to `apps/api/app/controllers/weighing_areas_controller.ts`: inject `ReactivateWeighingAreasUseCase`, authorize via the existing `WeighingAreaPolicy.reactivate`, validate with T005's `reactivateWeighingAreasValidator`, take one `DateTime.now()` for the whole submission, and serialize `{ updatedWeighingAreas: WeighingAreaTransformer.transform(...), blockedWeighingAreas }` — mirroring the `archiveMany` method directly above it (depends on T005, T021; spec FR-021, FR-025)
- [X] T023 [US2] Register `router.post('/reactivate', [controllers.WeighingAreas, 'reactivateMany']).as('reactivate_many')` in `apps/api/start/routes.ts`, inside the `weighing_areas` group and **before** the existing `/:id/reactivate` route so the literal segment is not captured as an id, then regenerate the Tuyau client so `weighing_areas.reactivate_many` appears in `apps/api/.adonisjs/client/registry/{index.ts,schema.d.ts,tree.d.ts}` and `apps/api/.adonisjs/server/routes.d.ts` and commit those regenerated files (depends on T022; `contracts/weighing-area-reactivate-api.md` "Typed client")

### Implementation for User Story 2 — frontend

- [X] T024 [US2] Add a `reactivateMany` mutation (`tuyauQuery.weighingAreas.reactivateMany.mutationOptions()`) to `apps/web/src/features/weighing-areas/mutations/use-weighing-area-mutations.ts`; leave `apps/web/src/features/weighing-areas/types.ts` unchanged — `BulkWeighingAreaLifecycleResult` derived from `Route.Response<'weighing_areas.archive_many'>` already describes this response exactly (depends on T023 for the generated route type, and on T009 — same file; `data-model.md`)
- [X] T025 [P] [US2] In `apps/web/src/features/checkpoints/types.ts`, add `'REACTIVATE'` to `BULK_LIFECYCLE_INTENTS.WEIGHING_AREA` and add `REACTIVATE: 'These weighing areas will be offered again for new operational work.'` to `BULK_LIFECYCLE_DESCRIPTIONS.WEIGHING_AREA`, deleting the `#206` comment above `BULK_LIFECYCLE_INTENTS` — nothing else in this file changes (`contracts/weighing-area-reactivate-ui-state.md` section B, changes 1 and 2)
- [X] T026 [US2] In `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`, change `submitBulkLifecycle`'s `WEIGHING_AREA` arm to branch on `bulkIntent`, routing `'REACTIVATE'` to `weighingAreaMutations.reactivateMany` and everything else to `archiveMany`, exactly as the dock arm already does; delete the four now-stale `#206` comments (on `BULK_LIFECYCLE_CAPABLE_KINDS`, on `checkableIds`, on the Ctrl/Cmd+A handler, and on the `bulkIntent` clamp) and adjust their surrounding wording to describe the shipped behavior. **Change nothing else** — `checkableIds`, `selectionIntent`, `bulkIntent`, the Ctrl/Cmd+A handler, `handleBulkReactivateSuccess`, and the `refresh`/`onSuccess` wiring are already correct for this kind (depends on T024, T025; `research.md` D4, D5)
- [X] T027 [US2] Run the focused US2 tests (T013–T018) and refactor without changing behavior

**Checkpoint**: An administrator can select and reactivate a batch of archived weighing areas end to
end, with mixed selections partially succeeding and reporting per-entry reasons. US1 and US2
together form the MVP.

---

## Phase 5: User Story 3 - Reject Invalid Submissions and Protect What Must Not Change (Priority: P2)

**Goal**: Empty, malformed, duplicated, and over-commented submissions are rejected before any
weighing area changes; unauthorized actors are refused on both the individual and bulk paths; an
administrator can resubmit a reduced selection after a reactivation produced blocked entries without
the already-reactivated ones being re-attempted.

**Independent Test**: Attempt an empty selection, a duplicated identifier, a malformed identifier, an
over-long comment, and an unauthorized reactivation of both scopes; verify every attempt is refused
before any weighing area changes; then from a partially-blocked result, resubmit a reduced selection
and verify the already-reactivated weighing areas are not re-attempted (`spec.md`, US3).

> Much of US3's guard behavior is already proven by T003 (individual comment limit), T006
> (individual authorization and lifecycle refusals), and T013 (bulk authorization refusals) — those
> were written against US3's acceptance criteria from the start, because the individual and bulk
> paths share one rule set (`plan.md` Constitution Check, principle II). This phase adds the
> coverage that is genuinely specific to US3.

### Tests for User Story 3 (write and observe RED first)

- [X] T028 [P] [US3] Add submission-validity cases to `apps/api/tests/integration/weighing_areas/lifecycle/bulk/reactivate.spec.ts`: empty `ids` → 422; `ids` repeating one identifier, including in differing case → 422; `ids` carrying a non-UUID → 422; a comment over 1,000 characters → 422 — each asserting **zero** weighing areas were evaluated or changed by re-reading every candidate row afterwards, and each distinct from the per-entry `NOT_FOUND` a well-formed-but-unknown identifier produces (depends on T013 — same file; spec FR-028; `contracts/weighing-area-reactivate-api.md`)
- [X] T029 [P] [US3] Add a consolidated permission test in `apps/web/src/features/weighing-areas/__tests__/reactivate/permissions.test.tsx` (new file), modelled on `archive/permissions.test.tsx`: for a non-administrator, `Reactivate weighing area` is rendered on no weighing area of any status and the `Select weighing areas` toggle is absent; forcing `selecting=weighing-areas` via the URL renders no checkable markers and no bulk action bar; the same for a user whose access is not active (spec FR-002, FR-032; `quickstart.md` scenarios 8, 16)
- [X] T030 [P] [US3] Add a resubmission test in `apps/web/src/features/checkpoints/__tests__/bulk-reactivate-weighing-areas/resubmission.test.tsx` (new file): from a result mixing reactivated weighing areas with `ALREADY_AVAILABLE`/`NOT_FOUND` blockers, assert the selection is emptied and no blocked entry stays checked — unlike the archive path, which keeps `IN_USE` entries checked — then build a fresh reduced selection of still-archived weighing areas, resubmit, and assert only the newly-reactivated ones come back and nothing from the prior request is re-attempted or re-reported (spec FR-030, US2 scenario 7; `research.md` D5; `quickstart.md` scenario 14)

### Implementation for User Story 3

- [X] T031 [US3] Close any gap T028–T030 expose in `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`: confirm `handleBulkReactivateSuccess` clears the whole selection while `handleBulkArchiveSuccess` still keeps exactly the `IN_USE`-blocked ids checked, and confirm the reactivate action, the select-mode toggle, and the bulk toolbar are all gated on the same `canManageCheckpoints` check already used elsewhere in that file — expected to be a no-op verification, since the page already routes `onSuccess` by intent and gates by role
- [X] T032 [US3] Run the focused US3 tests (T028, T029, T030) and refactor without changing behavior

**Checkpoint**: All three user stories are independently functional. Every refusal path — individual,
bulk, and the submission-validity gate in front of bulk — is proven end to end.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T033 Run `apps/web/src/features/checkpoints/__tests__/bulk-archive/*` and `apps/api/tests/integration/weighing_areas/lifecycle/bulk/archive.spec.ts` one final time, **unmodified**, and confirm #205's archive behavior is untouched — including that a mixed archive result still leaves `IN_USE`-blocked weighing areas checked for a retry (`quickstart.md` scenario 17)
- [X] T034 Run `apps/web/src/features/checkpoints/__tests__/bulk-reactivate/*` and `apps/api/tests/integration/docks/lifecycle/bulk/reactivate.spec.ts` one final time, **unmodified**, and confirm #201's dock reactivate behavior is untouched — this slice shares every code path it enables with docks (`quickstart.md` scenario 18)
- [X] T035 [P] Confirm no `#206` reference remains anywhere under `apps/` (`grep -rn "#206" apps/`) — all four forward-references were placeholders this slice fills, and a stale pointer to a shipped issue is worse than no comment
- [X] T036 [P] Confirm the files this slice must not change are unchanged: `apps/web/src/features/checkpoints/map/checkpoint-map.tsx`, `apps/web/src/features/checkpoints/__tests__/support/mock-checkpoint-map.tsx`, `apps/web/src/features/checkpoints/ui/bulk-checkpoint-lifecycle-actions.tsx`, `apps/web/src/features/weighing-areas/weighing-area-checkpoint-adapter.ts`, `apps/web/src/features/weighing-areas/types.ts`, `apps/web/src/routes/_authenticated/checkpoints.tsx`, and `apps/api/app/weighing_areas/reactivate/reactivate_weighing_area_use_case.ts` — no new search param, no new component, no change to the individual use case (`plan.md` Constraints; `contracts/weighing-area-reactivate-ui-state.md` section C)
- [X] T037 [P] Verify accessibility across the changed UI — `apps/web/src/features/weighing-areas/ui/weighing-area-lifecycle-actions.tsx` and the bulk toolbar rendered from `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`: the reactivate dialog and the reactivate-intent action bar follow the same `role`/labelling conventions as their archive counterparts; the comment textarea is labelled in both directions; a marker made non-checkable by the current intent is not a focus stop that silently does nothing; the intent change is conveyed by the bar's text, not by colour alone
- [ ] T038 **NOT RUN — needs your go-ahead.** Run the full `quickstart.md` validation, scenarios 1–18, against a running app with the fixtures listed in its Prerequisites (five archived weighing areas, one available, one archived while carrying recorded weighings and a closed discharge's ended shift membership). Left undone deliberately: its Prerequisites require `pnpm --filter @portflow/api db:fresh`, which drops and reseeds the local dev database, plus an interactive browser session. Every scenario's logic is covered by the automated suites; this task is the manual end-to-end confirmation on top of them.
- [X] T039 Run `pnpm typecheck`, `pnpm check`, and the full fast test suites (`pnpm --filter @portflow/api test`, `pnpm --filter @portflow/web test`) and resolve any fallout (Constitution Principle VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. Touches one test fixture file.
- **Foundational (Phase 2)**: No dependency on Phase 1. **Blocks US2's controller (T022)** and
  underpins US3's comment-validation assertions. US1's UI work does not depend on it.
- **User Stories (Phases 3–5)**: US1 may start immediately after Phase 2. US2 depends on Phase 2
  (T005) and on Phase 1 (T001, for the second archived fixture its tests select). US3 depends on
  both US1 and US2 being implemented, since it tests guard behavior across both paths.
- **Polish (Phase 6)**: Depends on all three stories.

### Within Phase 1 and Phase 2

T001 → T002 are sequential (add fixture, then verify nothing regressed). T003 → T004 → T005 are
sequential: T003 is the RED test for T004, and T005 edits the same file as T004.

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2's T004 (so the comment limit T008 exercises actually
  exists). The individual backend already exists; only frontend wiring and an HTTP test top-up are
  added. Can ship alone as the smallest MVP slice.
- **US2 (P1)**: Depends on Phase 1 (T001) and Phase 2 (T005). Its backend chain
  (T019 → T020 → T021 → T022 → T023) must complete before its frontend chain (T024 → T026), because
  T024 needs the route type T023 generates.
- **US3 (P2)**: Depends on US1 and US2 both being implemented; its resubmission test needs US2's
  bulk toolbar and its permission test covers both paths.

### Cross-story file contention

US1 and US2 are **not** file-disjoint on the frontend:

- `apps/web/src/features/weighing-areas/mutations/use-weighing-area-mutations.ts` — T009 (US1, adds
  `reactivate`) and T024 (US2, adds `reactivateMany`): two different functions in one file, so
  sequence them rather than running them in parallel. T024 is deliberately not marked [P].
- `apps/api/tests/integration/weighing_areas.spec.ts` — T003 (Phase 2) and T006 (US1) both append
  cases to it; sequence them.
- `apps/api/tests/integration/weighing_areas/lifecycle/bulk/reactivate.spec.ts` — T013 (US2), T014
  (US2), and T028 (US3) all write to it; T013 creates it, the other two extend it.
- `apps/api/app/weighing_areas/shared/weighing_area_validator.ts` — T004 and T005 both edit it, in
  that order.

Every other file US1 touches (`weighing-area-lifecycle-actions.tsx`, `weighing-area-details.tsx`) is
untouched by US2, and every backend file US2 touches (`weighing_area_repository.ts`,
`lucid_weighing_area_repository.ts`, `weighing_areas_controller.ts`, `routes.ts`,
`app/weighing_areas/reactivate/reactivate_weighing_areas_use_case.ts`) is untouched by US1.

### Parallel Opportunities

- Phase 1: none — T001 then T002.
- Phase 2: none — T003 → T004 → T005 is a strict chain.
- US1: T006, T007, and T008 in parallel (one API file, two new web files); T009 can start
  immediately; T010 needs T009; T011 needs T010.
- US2: T013, T015, T016, T017, and T018 in parallel (five different files, two backend / three
  frontend); T014 extends T013's file. On the backend, T019 → T020 → T021 → T022 → T023 is a strict
  chain. On the frontend, T025 is independent of the whole backend chain and can be done at any
  point; T024 waits for T023; T026 waits for T024 and T025.
- US3: T028, T029, and T030 in parallel (three different files).
- Phase 6: T035, T036, and T037 in parallel.

---

## Parallel Example: User Story 2

```bash
# Five of the six US2 test tasks touch different files — launch together:
Task: "Bulk reactivation integration tests in apps/api/tests/integration/weighing_areas/lifecycle/bulk/reactivate.spec.ts"
Task: "Bulk reactivation unit test in apps/api/tests/unit/weighing_areas/lifecycle/bulk_reactivate.spec.ts"
Task: "Intent-scoped select-mode test in apps/web/src/features/checkpoints/__tests__/bulk-reactivate-weighing-areas/select-mode.test.tsx"
Task: "Bulk reactivation action-bar test in apps/web/src/features/checkpoints/__tests__/bulk-reactivate-weighing-areas/bulk-reactivate-actions.test.tsx"
Task: "Keyboard-shortcut test in apps/web/src/features/checkpoints/__tests__/bulk-reactivate-weighing-areas/keyboard-shortcuts.test.tsx"

# T025 is independent of the entire backend chain and can run alongside any of the above:
Task: "Enable the REACTIVATE intent for weighing areas in apps/web/src/features/checkpoints/types.ts"
```

---

## Implementation Strategy

### MVP First

Both US1 and US2 are P1 because the issue's delivery boundary explicitly bundles individual and
multiple reactivate as one outcome (issue "Multiple-operation contract" and "Delivery boundary";
`plan.md` Constitution Check, principle II). The true minimum shippable slice is **both**:

1. Phase 1 (T001–T002) + Phase 2 (T003–T005) — one fixture, one behavior correction with its own RED
   test, one new validator.
2. Phase 3 (US1, T006–T012) then Phase 4 (US2, T013–T027). US1 first is the natural order: it is the
   smaller of the two, it de-risks the shared `use-weighing-area-mutations.ts` file before US2
   touches it, and it makes archived weighing areas actionable at all, which is what makes US2's
   selection worth building.
3. **STOP and VALIDATE**: `quickstart.md` scenarios 1–12, 15–16.
4. At that point every rule in the spec is enforced by the backend — US3 makes the
   submission-validity and resubmission guarantees *proven*, not *true*.

### Incremental Delivery

1. Phases 1–2 → the validator module is consistent; the individual comment limit now matches the
   archive path. Nothing else user-visible changed.
2. + US1 → demo reactivating a single archived weighing area (smallest possible slice).
3. + US2 → demo batch reactivation with partial success (completes the issue's stated MVP).
4. + US3 → submission-validity gate and resubmission behavior proven end to end.
5. Polish → both regression guards, stale-comment sweep, accessibility, quickstart, full suites.

### A note on T006

T006 tests behavior that is **already implemented and already unit-tested**. Write it before running
it, and expect it to go GREEN on first run. A test that goes RED here has found a real defect in the
existing implementation — fix the implementation, do not soften the test to match it. T003 is the
opposite case and is genuinely RED by design.

---

## Notes

- [P] tasks = different files, no dependencies.
- Verify tests fail before implementing, except T006 (characterization of correct existing
  behavior) and T031 (expected no-op verification).
- Commit after each task or logical group; Conventional Commits, on
  `feat/206-reactivate-weighing-area`.
- Three decisions in `research.md` were resolved without user confirmation and are worth re-raising
  at review: **D2** (correcting `reactivateWeighingAreaValidator` changes already-shipped behavior —
  an over-long reactivation comment goes from accepted to refused; drop T003–T004 and the FR-008
  individual row if rejected), **D5** (the whole selection is cleared after a bulk reactivation,
  since neither blocker is retryable), and **D7** (a successful reactivation does not widen the
  status filter, so under `status=archived` the weighing area leaves the view). Changing any of them
  is a spec/plan change, not a task change.
