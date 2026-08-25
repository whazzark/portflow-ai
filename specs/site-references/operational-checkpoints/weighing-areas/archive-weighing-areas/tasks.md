# Tasks: Archive Weighing Areas

**Input**: Design documents from
`specs/site-references/operational-checkpoints/weighing-areas/archive-weighing-areas/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Observable business behavior follows RED → GREEN → REFACTOR (Constitution Principle IV).
Test tasks are written and observed failing before their implementation tasks — except where the
backend already behaves correctly (`research.md` D1), where they are written and observed **passing**;
if one of those goes RED, that is a real gap, not a miswritten test.

**Organization**: Tasks are grouped by user story so each story stays independently testable.

**The shape of this feature** (`research.md`): Archive Docks (`#200`) already delivered this exact
capability for the other checkpoint kind on the same map. Three consequences drive the ordering below:

1. The **individual-archive backend already exists** for weighing areas
   (`ArchiveWeighingAreaUseCase`, `POST /weighing-areas/:id/archive`, policy, exceptions, usage
   check). US1's backend work is an HTTP-level test top-up, not new production code.
2. **Phase 2 generalizes delivered dock machinery from one kind to two, with docks still the only
   consumer.** This is the riskiest phase, because it edits shipped, working code. The delivered dock
   suites are the regression guard and must pass **unchanged**.
3. The **bulk surface does not exist** at any layer for weighing areas and is the largest deliverable
   (US4).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on an incomplete task in the phase.
- **[Story]**: Maps a task to its user story in `spec.md`.

---

## Phase 1: Setup

**Purpose**: Widen the checkpoints URL contract so the select mode can name either checkpoint kind.

- [X] T001 Widen the `selecting` search param from `z.enum(['docks'])` to `z.enum(['docks', 'weighing-areas']).optional().catch(undefined)` in the checkpoints search schema in `apps/web/src/routes/_authenticated/checkpoints.tsx` (`contracts/weighing-area-archive-ui-state.md` §B)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Two independent pieces of groundwork — close the comment-validation gap on the
already-delivered single path (`research.md` D2), and generalize the delivered dock bulk machinery to
be kind-parameterized (`research.md` D4, D8) — both with **docks as the only consumer**, so the
generalization is proven behavior-preserving before any weighing-area code depends on it.

**⚠️ CRITICAL**: US4 cannot begin until T005–T011 are complete. US1–US3 depend only on T002–T003.

**⚠️ The regression rule for this phase** (`research.md` D8): the delivered dock suites assert
accessible names and toast text. If the generalized code still emits `aria-label="Bulk dock actions"`,
`Archive selected docks?`, and `1 dock archived` byte-for-byte, they pass untouched. **Any edit to a
dock test during this phase is a defect in the generalization, not test maintenance.**

### Comment validation gap (independent of the generalization)

- [X] T002 [P] Add API tests for archive-comment handling to the existing flat `apps/api/tests/integration/weighing_areas.spec.ts` (matching the dock precedent, which topped up the flat `docks.spec.ts` rather than creating a nested file for the individual path): a comment with surrounding whitespace is stored trimmed; a whitespace-only comment is stored as `null`; a comment over 1,000 characters → `422` with the weighing area left `AVAILABLE` and its lifecycle columns untouched — expect RED on the trim and length cases (spec FR-009, FR-010; `research.md` D2)
- [X] T003 Replace `comment: vine.string().nullable().optional()` with the shared `lifecycleComment()` in `archiveWeighingAreaValidator` in `apps/api/app/weighing_areas/shared/weighing_area_validator.ts`, importing from `#shared/validators/lifecycle_validator` as `dock_validator.ts` does — leave `reactivateWeighingAreaValidator` untouched, it is #206's (depends on T002)
- [X] T004 Run the existing weighing-area suites (`apps/api/tests/integration/weighing_areas.spec.ts`, `apps/api/tests/unit/weighing_areas/*.spec.ts`) and confirm they are still green after T003 — this is a behavior change to a shipped path, so it needs its own guard (depends on T003)

### Generalize the delivered dock bulk machinery (docks remain the only consumer)

- [X] T005 [P] Add `CHECKPOINT_KIND_PLURAL_LABELS` and a `BULK_ARCHIVE_COPY: Record<CheckpointKind, { pluralLabel: string; toolbarAriaLabel: string; dialogTitle: string; dialogDescription: string; commentFieldId: string }>` to `apps/web/src/features/checkpoints/types.ts`, alongside the existing `CHECKPOINT_KIND_LABELS`. Dock values MUST reproduce the delivered strings exactly — `Bulk dock actions`, `Archive selected docks?`, `These docks will remain readable but no longer selectable for new discharges.`, `bulk-dock-archive-comment`. Weighing-area values per `contracts/weighing-area-archive-ui-state.md` §E (`research.md` D8)
- [X] T006 [P] Add a bulk outcome adapter `toBulkArchiveOutcome` to `apps/web/src/features/docks/dock-checkpoint-adapter.ts`, mapping `{ updatedDocks, blockedDocks }` onto the normalized `{ archivedCount, blocked }` shape (`research.md` D8)
- [X] T007 Rename `apps/web/src/features/checkpoints/ui/bulk-archive-docks-actions.tsx` to `bulk-archive-checkpoints-actions.tsx` and generalize `BulkArchiveDocksActions` into `BulkArchiveCheckpointsActions`, taking `{ kind, selectedIds, onClear, onSuccess, archive, refresh }` and exporting `BulkArchiveBlocker`/`BulkArchiveOutcome`. All copy comes from T005's record; the component must hold no dock- or weighing-area-specific knowledge and no `useDockMutations` import (depends on T005)
- [X] T008 Update `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx` to render `BulkArchiveCheckpointsActions` with `kind="DOCK"`, passing `useDockMutations().archiveMany` through T006's adapter as the `archive` prop and `refreshDocks` as `refresh` (depends on T006, T007)
- [X] T009 Kind-parameterize the select-mode state, discovered to span two files rather than one — the "Select docks" toggle actually lives inside `checkpoint-map.tsx`'s `MapControls`, not in `checkpoint-map-controls.tsx` as `research.md`/`#200`'s own tasks.md assumed:
  - In `apps/web/src/features/checkpoints/map/checkpoint-map.tsx`: widen `selectMode?: 'docks'` to `selectMode?: CheckpointKind`; replace `canSelectDocks: boolean` with `selectableKinds?: CheckpointKind[]`; replace `onToggleSelectMode?: () => void` with `onToggleSelectMode?: (kind: CheckpointKind) => void`; replace `onShiftSelectDock?: (id: string) => void` with `onShiftSelect?: (kind: CheckpointKind, id: string) => void`; render one `ControlButton` per entry in `selectableKinds` (was: one hard-coded button), labelled from T005's plural-label record; replace the hard-coded `checkpoint.kind === 'DOCK'` marker eligibility check with `selectableKinds?.includes(checkpoint.kind)`
  - In `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`: `isSelectingDocks` → `selectingKind: CheckpointKind | undefined` derived from the `selecting` param; `checkedDockIds` → `checkedIds`; `toggleDockChecked`/`startSelectingDocks`/`handleShiftSelectDock` → kind-aware equivalents that only ever check markers of `selectingKind` with status `AVAILABLE`; pass `selectableKinds={canManageCheckpoints ? CHECKPOINT_KINDS.filter((kind) => layerVisibility[kind]) : []}` so both toggles render when both layers are visible
  (depends on T001, T005, T008)
- [X] T010 Replace the hard-coded `checkpoint.kind === 'DOCK'` predicate in the Ctrl/Cmd+A handler in `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx` with a filter on `selectingKind`, preserving the existing guard that ignores the shortcut while focus is in an input, textarea, or contenteditable (depends on T009)
- [X] T011 Run the delivered dock suites — `apps/web/src/features/checkpoints/__tests__/bulk-archive/{select-mode,keyboard-shortcuts,bulk-archive-actions,resubmission}.test.tsx` and `apps/web/src/features/docks/__tests__/archive/*.test.tsx` — and confirm every one passes **with no edit to any test file**. Any required edit means T005–T010 changed dock behavior; fix the code, not the test (`research.md` D8)

**Checkpoint**: The comment validator matches the spec, and one kind-parameterized bulk toolbar and
select mode serve docks exactly as before. Weighing-area work can now begin.

---

## Phase 3: User Story 1 - Retire a Weighing Area From Operational Use (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator archives one available weighing area, optionally with a
comment, so it stops being offered for new operational work while staying fully consultable.

**Independent Test**: Sign in as an administrator, archive an available weighing area that no planned
or active discharge relies on, and verify it leaves the available scope, appears under the archived
status with its archive time, actor, and comment, and keeps its name and coordinates (spec.md US1).

### Tests for User Story 1

> Backend already exists (`research.md` D1) — the API tests should go GREEN immediately. If one goes
> RED, that is a real gap.

- [X] T012 [P] [US1] Extend `apps/api/tests/integration/weighing_areas.spec.ts` with the individual-archive happy paths not already covered by its existing "creates, lists, updates, archives, and reactivates an area" test: archiving without a comment → `200` with `archiveComment` null (the existing test only covers the with-comment case); and, on the seeded reactivated fixture or an equivalent, that a fresh archival preserves prior `reactivatedAt`/`reactivatedByUserId`/`reactivationComment` (spec FR-008, FR-011; `contracts/weighing-area-archive-api.md` §1)
- [X] T013 [P] [US1] Add `apps/web/src/features/weighing-areas/__tests__/archive/individual.test.tsx`: an "Archive weighing area" action appears on an available weighing area's details sheet for an administrator; activating it opens a confirmation carrying an optional comment field capped at 1,000 characters; confirming succeeds, shows a success toast, and switches the marker and details to Archived without a manual reload; the action then disappears from that weighing area's details (`contracts/weighing-area-archive-ui-state.md` §A; quickstart "Single archive")

### Implementation for User Story 1

- [X] T014 [P] [US1] Add an `archive` mutation (`tuyauQuery.weighingAreas.archive.mutationOptions({ onSuccess: () => invalidateWeighingAreas() })`) to `apps/web/src/features/weighing-areas/mutations/use-weighing-area-mutations.ts`, mirroring `use-dock-mutations.ts`
- [X] T015 [US1] Create `apps/web/src/features/weighing-areas/ui/weighing-area-lifecycle-actions.tsx`, mirroring `docks/ui/dock-lifecycle-actions.tsx`: archive-only, no reactivate branch (`research.md` D1, `#200` D6), an `AlertDialog` titled "Archive weighing area?" with an optional 1,000-character comment, calling T014's mutation and toasting success/failure (depends on T014)
- [X] T016 [US1] Render `WeighingAreaLifecycleActions` in `apps/web/src/features/weighing-areas/ui/weighing-area-details.tsx`, only when the viewer may manage checkpoints **and** `area.status === 'AVAILABLE'`, matching how `dock-details.tsx` gates `DockLifecycleActions` (depends on T015)
- [X] T017 [US1] Run the focused US1 tests (T012, T013) and refactor without changing behavior

**Checkpoint**: One weighing area can be archived end to end from the map. US1 is demonstrable on its
own.

---

## Phase 4: User Story 2 - Protect Weighing Areas Still Required by Current Work (Priority: P1)

**Goal**: Archival is refused for weighing areas a planned or active discharge relies on, for
already-archived ones, for unknown ones, and for unauthorized users — always leaving stored state
untouched.

**Independent Test**: Attempt archival as an unauthenticated visitor, as each non-administrator role,
on a weighing area holding a current shift membership in a planned or active discharge, and on an
already-archived one; verify every attempt is refused with a specific reason and no lifecycle state
changes (spec.md US2).

### Tests for User Story 2

- [X] T018 [P] [US2] Extend `apps/api/tests/integration/weighing_areas.spec.ts` with the refusal matrix not already covered — the file already asserts unauthenticated `401`, non-admin `403` (on list/create/update, not yet archive specifically), in-use `409`, and allow-after-ended `200`; add: unauthenticated and non-admin on the **archive** route specifically; unknown id → `404` `E_WEIGHING_AREA_NOT_FOUND`; already archived → `409` `E_WEIGHING_AREA_ALREADY_ARCHIVED` with the original archive context byte-identical afterwards (spec FR-002 to FR-005, FR-021; `contracts/weighing-area-archive-api.md` §1)
- [X] T019 [P] [US2] Add one more usage-boundary case to `apps/api/tests/integration/weighing_areas.spec.ts`, alongside the existing "rejects archival when a persisted current shift uses the area" and "allows archival when the membership has ended" tests: a weighing area whose *discharge* is **Closed** (membership itself not marked ended) archives successfully — proving the boundary is discharge status, not just membership state — built with `createPersistedWeighingAreaUsageScenario({ status: 'CLOSED' })` from `apps/api/tests/support/persisted_weighing_area_usage.ts` (spec FR-005, FR-006; `#240` FR-005)
- [X] T020 [P] [US2] Add `apps/web/src/features/weighing-areas/__tests__/archive/permissions.test.tsx`: the archive action is absent — not merely disabled — on a weighing area's details for a non-administrator, and absent for every viewer on an archived weighing area (spec FR-023; `contracts/weighing-area-archive-ui-state.md` §A)

### Implementation for User Story 2

> The backend already enforces every rule in this story (`research.md` D1). Expect T018–T019 to pass
> without production changes; T021 exists only for the frontend gating.

- [X] T021 [US2] Confirm the T016 gating covers both conditions from T020 (viewer may manage checkpoints **and** status is `AVAILABLE`) in `apps/web/src/features/weighing-areas/ui/weighing-area-details.tsx`, adjusting only if T020 is RED (depends on T016, T020)
- [X] T022 [US2] Run the focused US2 tests (T018–T020); if any API test is RED, treat it as a genuine backend gap and fix the use case rather than the test

**Checkpoint**: Every refusal path is proven and leaves stored state untouched. US1 + US2 together
are the MVP.

---

## Phase 5: User Story 3 - Understand and Recover From a Refused Archival (Priority: P2)

**Goal**: Each refusal explains itself distinctly and leaves a safe retry path, so an administrator
can release the blocker or correct the input and retry without leaving an ambiguous lifecycle state.

**Independent Test**: Trigger an in-use conflict, an already-archived conflict, a stale-view
conflict, an over-long comment, and a transient failure in turn; verify each produces distinct
guidance and that retrying after resolving the cause archives the weighing area exactly once
(spec.md US3).

### Tests for User Story 3

- [X] T023 [P] [US3] Add a concurrency test to `apps/api/tests/integration/weighing_areas.spec.ts`: two archival requests for the same weighing area fired at nearly the same time result in exactly one recorded archival, the loser returning `409 E_WEIGHING_AREA_ALREADY_ARCHIVED` with the winner's archive time, actor, and comment not overwritten (spec FR-020; SC-005)
- [X] T024 [P] [US3] Extend `apps/web/src/features/weighing-areas/__tests__/archive/individual.test.tsx`: an over-long comment surfaces its validation message **inside** the open dialog with the typed comment preserved, and shortening it and resubmitting succeeds without reopening the weighing area; an in-use refusal, an already-archived refusal, and a transient failure each render a distinct message (spec US3 scenarios 1–6, FR-019)

### Implementation for User Story 3

- [X] T025 [US3] Report refusals and failures with `toast.error('Unable to archive weighing area', { description })` in `apps/web/src/features/weighing-areas/ui/weighing-area-lifecycle-actions.tsx`, matching `dock-lifecycle-actions.tsx` exactly, and leave the dialog open on failure (`setOpen(false)` only on success) so the typed comment stays correctable — which is what satisfies spec US3 scenario 6. The description prefers the API error's field-level detail over its top-level message, since a validation failure's top-level message is only "Validation failure". *Revised: an earlier version of this task rendered failures inside the dialog as a deliberate divergence; that rested on a misreading of the dock component (which also keeps its dialog open), so the divergence was removed — see `research.md` D7* (depends on T015, T024)
- [X] T026 [US3] Map each API error code to a distinct, actionable message via `parseApiError` in `apps/web/src/features/weighing-areas/ui/weighing-area-lifecycle-actions.tsx`, covering `E_WEIGHING_AREA_NOT_FOUND`, `E_WEIGHING_AREA_ALREADY_ARCHIVED`, `E_WEIGHING_AREA_IN_USE`, validation failures, and transient failures (spec FR-019; depends on T025)
- [X] T027 [US3] Run the focused US3 tests (T023, T024) and refactor without changing behavior

**Checkpoint**: Every refusal is distinguishable and recoverable, and both checkpoint kinds report
failures identically (FR-038) — no follow-up alignment needed.

---

## Phase 6: User Story 4 - Archive Several Weighing Areas at Once (Priority: P3)

**Goal**: An authorized administrator selects several weighing areas on the Checkpoints map and
archives every eligible one in a single action, with each blocked one reported individually with its
reason.

**Independent Test**: Select a mix — eligible, in use, already archived, and an unknown id via the
API — submit one archive action with a shared comment, and verify exactly the eligible ones archive
while each blocked one is reported with `NOT_FOUND` / `IN_USE` / `ALREADY_ARCHIVED` and left unchanged
(spec.md US4).

### Tests for User Story 4

- [X] T028 [P] [US4] Add bulk archive integration tests in `apps/api/tests/integration/weighing_areas/lifecycle/bulk/archive.spec.ts` (new file), mirroring the dock suite: unauthenticated → `401`; non-administrator → `403`; empty `ids` → `422`; duplicate ids including case-differing → `422`; a malformed non-UUID id → `422`; an over-1,000-character comment → `422` — each asserted to touch zero weighing areas; a fully eligible selection archives all with one shared comment; a mixed selection archives only the eligible and reports the rest with the right reason in request order; an entirely blocked selection still returns `200` with empty `updatedWeighingAreas`, not `422` (spec FR-028, FR-033; `contracts/weighing-area-archive-api.md` §2)
- [X] T029 [P] [US4] Add a bulk concurrency test to `apps/api/tests/integration/weighing_areas/lifecycle/bulk/archive.spec.ts`: two overlapping submissions sharing one id archive it exactly once, the loser reporting it as `ALREADY_ARCHIVED` without overwriting the winner's context (spec FR-020; `research.md` D3)
- [X] T030 [P] [US4] Add `apps/api/tests/unit/weighing_areas/lifecycle/bulk_archive.spec.ts`: `findBulkBlockers` returns exactly one reason per id in guard order (missing → `NOT_FOUND`, wrong status → `ALREADY_ARCHIVED`, used → `IN_USE`), and `ArchiveWeighingAreasUseCase` partitions a mixed id list into `updatedWeighingAreas`/`blockedWeighingAreas` correctly (`data-model.md`)
- [X] T031 [P] [US4] Extend `apps/web/src/features/checkpoints/__tests__/bulk-archive/select-mode.test.tsx` with the weighing-area half: a "Select weighing areas" toggle is offered to administrators only; activating it sets `selecting=weighing-areas` and hides the create actions; weighing-area marker clicks toggle checked state instead of opening details; **dock markers keep opening their details sheet**; archived weighing-area markers are not checkable (`contracts/weighing-area-archive-ui-state.md` §B, §H)
- [X] T032 [P] [US4] Extend `apps/web/src/features/checkpoints/__tests__/bulk-archive/keyboard-shortcuts.test.tsx` for the weighing-area kind: shift-clicking an available weighing-area marker enters select mode and checks it; Ctrl/Cmd+A checks every visible available weighing area; Ctrl/Cmd+A while typing in the search field leaves native select-all alone (`contracts/weighing-area-archive-ui-state.md` §C)
- [X] T033 [P] [US4] Extend `apps/web/src/features/checkpoints/__tests__/bulk-archive/{bulk-archive-actions,resubmission}.test.tsx` for weighing areas: the bar appears once one is checked and reports `{n} selected`; a mixed submission toasts `{n} archived; {m} unchanged` listing each blocked one with its reason; archived ones drop out of the selection while blocked ones **stay checked**, so pressing "Archive selected" again resubmits exactly the blocked set — asserting the two request bodies as the dock resubmission test does (spec FR-035; `research.md` D6)
- [X] T034 [P] [US4] Add a search-scoping case to `apps/web/src/features/checkpoints/__tests__/bulk-archive/select-mode.test.tsx`: a checked weighing area hidden by a search term **stays checked**, while switching the status filter away from available or the resource-kind filter to docks empties the actionable selection (spec FR-036; `contracts/weighing-area-archive-ui-state.md` §D)

### Implementation for User Story 4 — backend

- [X] T035 [P] [US4] Create `apps/api/app/weighing_areas/shared/weighing_area_lifecycle_blockers.ts` mirroring `docks/shared/dock_lifecycle_blockers.ts`, with `findBulkBlockers(ids, byId, expectedStatus, usedIds?)` returning `{ id, name?, reason }` — `name` omitted for `NOT_FOUND` — but importing the generic `indexById`/`orderByIds` from `#shared/lifecycle/bulk_lifecycle_records` instead of redeclaring them as the dock module does (`data-model.md`; `research.md` D3)
- [X] T036 [US4] Add `ArchiveWeighingAreasCommand`, `BulkWeighingAreaLifecycleResult`, and an abstract `archiveAvailableMany(command)` to `apps/api/app/weighing_areas/shared/repositories/weighing_area_repository.ts`, re-exporting the blocker type from T035 (depends on T035)
- [X] T037 [US4] Implement `archiveAvailableMany` in `apps/api/app/weighing_areas/shared/repositories/lucid_weighing_area_repository.ts`: one `WeighingArea.transaction`, lock candidates with `.forUpdate()`, one set-based `findUsedByPlannedOrActiveDischarge({ referenceType: 'WEIGHING_AREA', referenceIds: command.ids, client: trx })`, blockers via T035, then a single `UPDATE … WHERE id IN (eligibleIds) AND status = 'AVAILABLE'`, throwing if `affectedRows !== eligibleIds.length` so the transaction rolls back (spec FR-030, FR-031; `contracts/weighing-area-archive-api.md` "Transactional guarantees"; depends on T036)
- [X] T038 [P] [US4] Add `archiveWeighingAreasValidator` (`{ ids: lifecycleIds(), comment: lifecycleComment() }`) to `apps/api/app/weighing_areas/shared/weighing_area_validator.ts` (depends on T003)
- [X] T039 [US4] Create `apps/api/app/weighing_areas/archive/archive_weighing_areas_use_case.ts`, a thin wrapper delegating to `archiveAvailableMany` and trimming the comment, mirroring `archive_docks_use_case.ts` (depends on T037)
- [X] T040 [US4] Add `archiveMany` to `apps/api/app/controllers/weighing_areas_controller.ts`: inject the T039 use case, authorize with the existing `WeighingAreaPolicy.archive` (no new policy method), validate with T038, and serialize `{ updatedWeighingAreas: WeighingAreaTransformer.transform(...), blockedWeighingAreas }` (depends on T038, T039)
- [X] T041 [US4] Register `router.post('/archive', [controllers.WeighingAreas, 'archiveMany']).as('archive_many')` in `apps/api/start/routes.ts`, inside the `weighing-areas` group and **before** the existing `/:id/archive` route so the literal path is not captured as `id` (`contracts/weighing-area-archive-api.md`; depends on T040)

### Implementation for User Story 4 — frontend

- [X] T042 [P] [US4] Add `BulkWeighingAreaLifecycleResult`/`BulkWeighingAreaLifecycleBlocker` to `apps/web/src/features/weighing-areas/types.ts`, derived from `Route.Response<'weighing_areas.archive_many'>` as `docks/types.ts` does (depends on T041 for the generated route type)
- [X] T043 [P] [US4] Add an `archiveMany` mutation (`tuyauQuery.weighingAreas.archiveMany.mutationOptions()` — the Tuyau client camelCases the server's snake_case route name, confirmed by `docks.archive_many` → `tuyauQuery.docks.archiveMany` in the delivered code) to `apps/web/src/features/weighing-areas/mutations/use-weighing-area-mutations.ts` (depends on T041)
- [X] T044 [P] [US4] Add a `toBulkArchiveOutcome` adapter to `apps/web/src/features/weighing-areas/weighing-area-checkpoint-adapter.ts`, mapping `{ updatedWeighingAreas, blockedWeighingAreas }` onto the normalized `{ archivedCount, blocked }` shape, mirroring T006 (depends on T042)
- [X] T045 [US4] Superseded by T009's widening of `checkpoint-map.tsx`: once `selectableKinds` includes `WEIGHING_AREA` when that layer is visible, the "Select weighing areas" toggle renders automatically from the same generalized control — no separate task needed. Kept as a no-op marker for traceability against the original plan.
- [X] T046 [US4] Wire the weighing-area consumer in `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`: render `BulkArchiveCheckpointsActions` with `kind="WEIGHING_AREA"` when `selectingKind === 'WEIGHING_AREA'`, passing T043's mutation through T044's adapter and `refreshWeighingAreas` as `refresh`; keep archived-elsewhere and out-of-scope ids pruned from the actionable set while leaving search-hidden ones checked (depends on T009, T010, T044, T045)
- [X] T047 [US4] Run the focused US4 tests (T028–T034) and refactor the wiring without changing behavior

**Checkpoint**: Both checkpoint kinds can be bulk-archived from one map through one component and one
select mode.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T048 [P] Confirm the delivered dock suites still pass untouched after Phase 6, closing the loop on T011 — the generalization must survive the weighing-area consumer being added
- [X] T049 [P] Run the full quickstart validation in `specs/site-references/operational-checkpoints/weighing-areas/archive-weighing-areas/quickstart.md`, including the seeded reactivated fixture (Pont-bascule Sud) proving prior reactivation context survives archival (spec FR-011)
- [X] T050 Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` from the repository root and resolve every finding (Constitution VII)
- [X] T051 Note in the PR description that `archiveWeighingAreaValidator` now trims and caps the archive comment at 1,000 characters — a deliberate behavior change to the already-delivered individual archive path required by FR-009/FR-010 (`research.md` D2). Failure reporting needs no note: it matches `dock-lifecycle-actions.tsx` exactly (`research.md` D7)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: T002–T004 depend only on Phase 1 being irrelevant to them and can start
  immediately; T005–T011 depend on T001. **Blocks US4 entirely**; US1–US3 need only T003.
- **US1 (Phase 3)**: after T003. **MVP.**
- **US2 (Phase 4)**: after T003; T021 also depends on T016 (US1).
- **US3 (Phase 5)**: after US1, since it refines the same dialog component.
- **US4 (Phase 6)**: after the whole of Phase 2.
- **Polish (Phase 7)**: after all desired stories.

### Within Phase 2

Two independent tracks that can run in parallel:

- **Validator track**: T002 → T003 → T004.
- **Generalization track**: (T005, T006 in parallel) → T007 → T008 → T009 → T010 → T011.

### User Story Dependencies

- **US1 (P1)**: independent once T003 lands.
- **US2 (P1)**: mostly test-only; its one implementation task touches the file US1 creates, so run it
  after US1 rather than concurrently.
- **US3 (P2)**: edits `weighing-area-lifecycle-actions.tsx` from US1 — sequential after US1.
- **US4 (P3)**: independent of US1–US3 at the file level except `weighing_area_validator.ts` (T038
  depends on T003) and the shared page (T046 depends on Phase 2's T009/T010).

### Cross-story file contention

| File | Tasks | Note |
|---|---|---|
| `checkpoints-page.tsx` | T008, T009, T010, T046 | Single-threaded; Phase 2 must settle before T046 |
| `weighing_area_validator.ts` | T003, T038 | T038 after T003 |
| `weighing-area-lifecycle-actions.tsx` | T015, T025, T026 | US1 then US3, sequential |
| `weighing-areas/__tests__/archive/individual.test.tsx` | T013, T024 | US1 then US3 |
| `checkpoints/__tests__/bulk-archive/select-mode.test.tsx` | T031, T034 | Both US4; same file, so not parallel with each other |
| `integration/weighing_areas.spec.ts` (existing flat file, topped up — not a new nested file, matching the dock precedent) | T002, T012, T018, T019, T023 | Same file across stories — parallel only if written as separate appends, otherwise sequential |

### Parallel Opportunities

- Phase 2's two tracks (validator, generalization) run fully in parallel.
- T005 ∥ T006; T012 ∥ T013; T018 ∥ T019 ∥ T020; T028 ∥ T029 ∥ T030 ∥ T031 ∥ T032 ∥ T033.
- T035 ∥ T038 (different files); T042 ∥ T043 ∥ T044.

---

## Parallel Example: User Story 4 tests

```bash
# Backend and frontend US4 tests are in disjoint files — launch together:
Task: "Bulk archive integration tests in apps/api/tests/integration/weighing_areas/lifecycle/bulk/archive.spec.ts"
Task: "Bulk unit tests in apps/api/tests/unit/weighing_areas/lifecycle/bulk_archive.spec.ts"
Task: "Select-mode weighing-area cases in apps/web/src/features/checkpoints/__tests__/bulk-archive/select-mode.test.tsx"
Task: "Keyboard shortcut cases in apps/web/src/features/checkpoints/__tests__/bulk-archive/keyboard-shortcuts.test.tsx"
```

---

## Implementation Strategy

### MVP (US1 + US2)

1. Phase 1 → Phase 2's validator track (T002–T004).
2. Phase 3 (US1) → **STOP and VALIDATE**: one weighing area archives end to end.
3. Phase 4 (US2) → every refusal proven to leave state untouched.
4. Deploy/demo. The bulk path is not needed for this to be useful — administrators can already retire
   a weighbridge without losing its history.

### Incremental Delivery

1. Setup + validator track → the comment rules match the spec.
2. US1 → individual archive (MVP).
3. US2 → refusals proven.
4. US3 → refusals become recoverable.
5. Phase 2 generalization track + US4 → bulk archive for both kinds.

### The risk to watch

Phase 2's generalization track is the only place this feature edits shipped, working code. T011 is
the gate: dock suites green **with no test edits**. If that gate needs a test change to pass, stop and
fix the generalization — a "small" assertion tweak there is a silent regression in a delivered
feature.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task.
- No database migration: `weighing_areas` already carries every column written here (`data-model.md`).
- `ALREADY_AVAILABLE` appears in the blocker union for #206's benefit and is never produced by this
  slice, which only ever passes `expectedStatus: 'AVAILABLE'`.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
