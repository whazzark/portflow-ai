# Tasks: Reactivate Docks

**Input**: Design documents from
`specs/site-references/operational-checkpoints/docks/reactivate-docks/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Observable business behavior follows RED → GREEN → REFACTOR (Constitution Principle IV).
Test tasks must be written and observed failing (or, for already-correct backend behavior, written
and observed passing — a real gap if they don't) before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story so each story remains independently testable.

Per `plan.md`/`research.md` D1, the **individual**-reactivate backend (`ReactivateDockUseCase`,
`reactivateDockValidator`, `DockPolicy.reactivate`, `LucidDockRepository.reactivateArchived`)
already exists and is already unit-tested — US1's backend work is an HTTP-level test top-up, not new
production code. The **bulk** surface does not exist at any layer and is this feature's primary
deliverable (US2). Unlike #200, the two stories are **not** file-disjoint: both extend the same two
components (`dock-lifecycle-actions.tsx` for US1, `checkpoints-page.tsx` for US2 — and US2's bar
work depends on Phases 1–2 touching files US1 does not). Contention is called out below.

Phases 1 and 2 are **behavior-preserving refactors** of what #200 shipped, each guarded by #200's
own test suite: no reactivation behavior is added until Phase 3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an
  incomplete task in the same phase.
- **[Story]**: Maps a task to its user story from `spec.md`.

---

## Phase 1: Setup

**Purpose**: Rename the bulk action bar to the bidirectional name it is about to earn, with no
behavior change, so the intent work in Phase 4 is a diff about behavior rather than a diff about
file names (`plan.md` "Why generalize rather than duplicate").

- [X] T001 Rename `apps/web/src/features/checkpoints/ui/bulk-archive-docks-actions.tsx` to `bulk-dock-lifecycle-actions.tsx` and its exported component `BulkArchiveDocksActions` to `BulkDockLifecycleActions`, updating the single import site in `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx` — no prop, label, mutation, or markup change
- [X] T002 Run the existing bulk-archive suites (`apps/web/src/features/checkpoints/__tests__/bulk-archive/*.test.tsx`) and confirm they are still green after T001 — the regression guard for the rename (depends on T001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Move the dock-checkability rule out of the map (and out of its test double) into the
page, so Phase 4 can make it intent-dependent in one place instead of three (`research.md` D4).
Behavior after this phase is identical to #200's: only `AVAILABLE` docks are checkable.

**⚠️ CRITICAL**: US2's select-mode work cannot be written correctly until this phase is complete.
US1 does not depend on it and may proceed in parallel.

- [X] T003 Replace `CheckpointMap`'s internally-derived `isAvailableDock`/`isSelectableDock` rule in `apps/web/src/features/checkpoints/map/checkpoint-map.tsx` with a `checkableDockIds?: Set<string>` prop: a dock marker is checkable when `selectMode === 'docks'` and its id is in the set, and the shift-click path uses the same membership test instead of its own status check
- [X] T004 [P] Mirror T003's prop change in `apps/web/src/features/checkpoints/__tests__/support/mock-checkpoint-map.tsx`, deleting its verbatim copy of the `AVAILABLE` rule so the double cannot diverge from the real map
- [X] T005 Compute `checkableDockIds` in `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx` — for now, every visible `AVAILABLE` dock — and pass it to `CheckpointMap`; keep `toggleDockChecked`'s guard consistent with the same set rather than re-testing `status` (depends on T003)
- [X] T006 Run the existing bulk-archive suites again and confirm they are still green after T003–T005 — the regression guard for the relocation, proving the refactor changed no behavior (depends on T004, T005)

**Checkpoint**: The checkability rule has one home, in the page. US1 and US2 implementation can now
both proceed.

---

## Phase 3: User Story 1 - Reactivate One Archived Dock (Priority: P1) 🎯 MVP candidate A

**Goal**: An authorized administrator opens an archived dock and reactivates it, optionally with a
comment, through the existing (already-correct) backend — the dock is offered again for new
discharge assignment while keeping its identity and its archive history.

**Independent Test**: Set the status filter to Archived or All, open an archived dock, reactivate it
with and without a comment, and verify it is shown Available with the new reactivation metadata
while its archive metadata, name, position, and creation time are unchanged (spec.md, US1).

### Tests for User Story 1 (write and observe first — most should go GREEN immediately per research D1)

- [X] T007 [P] [US1] Add the missing HTTP-level cases for the individual reactivate endpoint to `apps/api/tests/integration/docks.spec.ts` (alongside the two that already exist there): non-active user → 401 `E_UNAUTHORIZED_ACCESS`; unknown id → 404 `E_DOCK_NOT_FOUND`; already-available dock → 409 `E_DOCK_ALREADY_AVAILABLE`; happy path with a comment → 200 with `reactivatedAt`/`reactivatedByUserId`/`reactivationComment` set **and** `archivedAt`/`archivedByUserId`/`archiveComment` preserved; whitespace-only comment → 200 with `reactivationComment` null — every refusal case asserted to leave the dock row unchanged (`contracts/dock-reactivate-api.md` requirement-to-test mapping; spec FR-007, FR-008, FR-010, FR-013)
- [X] T008 [P] [US1] Add a web test for the individual reactivate UI in `apps/web/src/features/docks/__tests__/reactivate/individual.test.tsx` (new file): under `status=all`, an archived dock's details sheet offers "Reactivate dock" and **no** "Edit dock"; an available dock's sheet offers "Edit dock" + "Archive dock" and no reactivate action; activating it opens a confirmation with an optional comment field; confirming succeeds, shows a `Dock reactivated` toast, and the dock's marker and details switch to Available without a manual reload; a failing request shows an `Unable to reactivate dock` toast carrying the parsed API message (`quickstart.md` scenarios 2–5; `contracts/dock-reactivate-ui-state.md`)

### Implementation for User Story 1

- [X] T009 [P] [US1] Add a `reactivate` mutation (`tuyauQuery.docks.reactivate.mutationOptions({ onSuccess: () => invalidateDocks() })`) to `apps/web/src/features/docks/mutations/use-dock-mutations.ts`, mirroring the existing `archive` mutation
- [X] T010 [US1] Extend `apps/web/src/features/docks/ui/dock-lifecycle-actions.tsx` with the archived branch, mirroring `customers/ui/lifecycle-actions.tsx`: derive `archived = dock.status === 'ARCHIVED'` and switch the trigger label/variant, dialog title, dialog description, confirm label, mutation, and both toasts on it — one component, one dialog, one comment field for both directions (depends on T009; table in `contracts/dock-reactivate-ui-state.md`)
- [X] T011 [US1] Widen `apps/web/src/features/docks/ui/dock-details.tsx`'s footer condition from `canEdit && dock.status === 'AVAILABLE'` to `canEdit` alone, rendering "Edit dock" only for `AVAILABLE` docks while `DockLifecycleActions` renders for both statuses — an archived dock's sheet gets a reactivate action and no edit action (depends on T010)
- [X] T012 [US1] Run the focused US1 tests (T007, T008) and refactor without changing behavior

**Checkpoint**: An administrator can reactivate one archived dock end-to-end, with or without a
comment. US1 is independently demonstrable.

---

## Phase 4: User Story 2 - Reactivate a Selection of Archived Docks Together (Priority: P1) 🎯 MVP candidate B

**Goal**: An authorized administrator selects several archived docks on the checkpoints map and
reactivates every eligible one in a single action, with every blocked dock reported individually
with its reason.

**Independent Test**: Check several archived docks, submit one reactivation with a shared comment,
and verify they all become Available; then submit a selection mixing archived docks, an
already-available dock, and an unknown id via the API and verify partial success with
`ALREADY_AVAILABLE` / `NOT_FOUND` reported per dock (spec.md, US2).

### Tests for User Story 2 (write and observe RED first — this surface is entirely new)

- [X] T013 [P] [US2] Add bulk reactivation integration tests in `apps/api/tests/integration/docks/lifecycle/bulk/reactivate.spec.ts` (new file), mirroring `apps/api/tests/integration/customers/lifecycle/bulk/reactivate.spec.ts` and the sibling `bulk/archive.spec.ts`: unauthenticated → 401; non-active user → 401; non-admin → 403; empty `ids` → 422 with zero docks touched; duplicate ids, including case-differing → 422 with zero docks touched; a malformed (non-UUID) id → 422 with zero docks touched; an over-1000-char comment → 422 with zero docks touched; a fully-archived selection reactivates every dock with the shared comment, the same actor, and the same timestamp; a mixed selection (one already-available, one unknown id, one archived) reactivates only the archived one and reports the other two with `ALREADY_AVAILABLE`/`NOT_FOUND`, both lists in request order; a selection that is entirely blocked still returns 200 with an empty `updatedDocks`, not a 422; every reactivated dock keeps its id, name, latitude, longitude, `createdAt`, and its archive metadata (`contracts/dock-reactivate-api.md`; spec FR-004, FR-005, FR-009, FR-012, FR-013, FR-022)
- [X] T014 [P] [US2] Add a concurrency integration test in `apps/api/tests/integration/docks/lifecycle/bulk/reactivate.spec.ts`: fire two overlapping bulk reactivation requests that both include the same archived dock id at nearly the same time and assert exactly one reactivates it while the other reports `ALREADY_AVAILABLE`, with a single `reactivatedAt` and a single `reactivationComment` stored (`research.md` D5; spec FR-016; `quickstart.md` scenario 13)
- [X] T015 [P] [US2] Add a unit test for the bulk reactivation path in `apps/api/tests/unit/docks/lifecycle/bulk_reactivate.spec.ts` (new file), mirroring `bulk_archive.spec.ts`: `findBulkBlockers(ids, docksById, 'ARCHIVED')` produces `NOT_FOUND` for a missing id and `ALREADY_AVAILABLE` for an available one and **never** `IN_USE` even when a usage set would match; `ReactivateDocksUseCase`/`LucidDockRepository.reactivateArchivedMany` partitions a mixed id list into `updatedDocks`/`blockedDocks` correctly; a dock cycled archive → reactivate → archive → reactivate ends Available with both metadata groups populated and its identity unchanged (spec FR-021)
- [X] T016 [P] [US2] Add an intent-scoped select-mode test in `apps/web/src/features/checkpoints/__tests__/bulk-reactivate/select-mode.test.tsx` (new file): under `status=all` and select mode, with nothing checked both available and archived dock markers are checkable; checking an archived dock makes available markers non-checkable and vice versa; clearing the selection makes every dock checkable again; the action bar reads "Reactivate selected" for an archived selection and "Archive selected" for an available one (`contracts/dock-reactivate-ui-state.md`; `research.md` D3; `quickstart.md` scenario 7)
- [X] T017 [P] [US2] Add a bulk reactivation action bar test in `apps/web/src/features/checkpoints/__tests__/bulk-reactivate/bulk-reactivate-actions.test.tsx` (new file): "Reactivate selected" opens a confirmation titled `Reactivate selected docks?` with an optional shared comment; a fully-eligible submission posts to `docks.reactivate_many` with `{ ids, comment }`, clears the selection, and toasts `N docks reactivated`; a mixed submission toasts `N docks reactivated; M unchanged` with each blocked dock named and its reason labelled, and clears the selection **entirely**, blocked docks included (`research.md` D7); a failing request toasts `Unable to reactivate docks` with the parsed API message and leaves the selection intact
- [X] T018 [P] [US2] Add a keyboard-shortcut test in `apps/web/src/features/checkpoints/__tests__/bulk-reactivate/keyboard-shortcuts.test.tsx` (new file), mirroring the bulk-archive one: with nothing checked under `status=archived`, Ctrl/Cmd+A checks every visible archived dock and the bar reads "Reactivate selected"; under `status=available` or `all` with nothing checked it checks every visible available dock; with an archived selection already in progress it extends that selection with archived docks only; it stays inert while focus is in a text field

### Implementation for User Story 2 — backend

- [X] T019 [US2] Add `ReactivateDocksCommand` (`ids`, `reactivatedAt`, `reactivatedByUserId`, `reactivationComment`) and an abstract `reactivateArchivedMany(command): Promise<BulkDockLifecycleResult>` to `apps/api/app/docks/shared/repositories/dock_repository.ts`, reusing the existing `BulkDockLifecycleResult` unchanged (`data-model.md`)
- [X] T020 [US2] Implement `reactivateArchivedMany` in `apps/api/app/docks/shared/repositories/lucid_dock_repository.ts`: one `Dock.transaction`, lock candidate rows with `.forUpdate()`, compute blockers via `findBulkBlockers(command.ids, docksById, 'ARCHIVED')` with **no** usage-checker call, then `UPDATE … WHERE id IN (eligibleIds) AND status = 'ARCHIVED'` setting `status`, `reactivatedAt`, `reactivatedByUserId`, `reactivationComment`, `updatedAt` and leaving every archive column untouched, keeping the `affectedRows !== eligibleIds.length` guard — mirroring `archiveAvailableMany` and `LucidCustomerRepository.reactivateArchivedMany` (depends on T019; `research.md` D2)
- [X] T021 [P] [US2] Add `reactivateDocksValidator` to `apps/api/app/docks/shared/dock_validator.ts`, built from the same `lifecycleIds()`/`lifecycleComment()` factories as the existing `archiveDocksValidator`
- [X] T022 [US2] Create `apps/api/app/docks/reactivate/reactivate_docks_use_case.ts`: a thin wrapper delegating to `dockRepository.reactivateArchivedMany` with `comment?.trim() || null`, mirroring `archive_docks_use_case.ts` (depends on T020)
- [X] T023 [US2] Add `reactivateMany` to `apps/api/app/controllers/docks_controller.ts`: inject `ReactivateDocksUseCase`, authorize via the existing `DockPolicy.reactivate`, validate with T021's `reactivateDocksValidator`, call the use case, and serialize `{ updatedDocks: DockTransformer.transform(...), blockedDocks }` (depends on T021, T022)
- [X] T024 [US2] Register `router.post('/reactivate', [controllers.Docks, 'reactivateMany']).as('reactivate_many')` in `apps/api/start/routes.ts`, inside the `docks` group and **before** the existing `/:id/reactivate` route, then regenerate the Tuyau client so `docks.reactivate_many` appears in `apps/api/.adonisjs/client/registry/{index.ts,schema.d.ts,tree.d.ts}` and `apps/api/.adonisjs/server/routes.d.ts` (depends on T023)

### Implementation for User Story 2 — frontend

- [X] T025 [P] [US2] Add a `reactivateMany` mutation (`tuyauQuery.docks.reactivateMany.mutationOptions()`) to `apps/web/src/features/docks/mutations/use-dock-mutations.ts`; leave `apps/web/src/features/docks/types.ts` unchanged — `BulkDockLifecycleResult` derived from `Route.Response<'docks.archive_many'>` already describes this response exactly (depends on T024 for the generated route type; `data-model.md`)
- [X] T026 [US2] Add an `intent: 'ARCHIVE' | 'REACTIVATE'` prop to `apps/web/src/features/checkpoints/ui/bulk-dock-lifecycle-actions.tsx` and branch the action label and variant, dialog title, dialog description, confirm label, mutation, and both toast strings on it — the direct counterpart of `bulk-lifecycle-actions.tsx`'s `isArchived`; the toolbar chrome, selection count, clear button, comment field, and `BLOCKER_REASON_LABELS` rendering stay as they are (depends on T025; table in `contracts/dock-reactivate-ui-state.md`)
- [X] T027 [US2] Wire the intent through `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`: derive `selectionIntent` from the status of any checked dock (homogeneous by construction); make Phase 2's `checkableDockIds` every visible dock when the intent is undefined and every visible dock matching the intent otherwise; drop `toggleDockChecked`'s `AVAILABLE` guard in favour of set membership; generalize the Ctrl/Cmd+A handler to the current intent, falling back to the status filter when nothing is checked; generalize `handleShiftSelectDock` to any dock; pass `intent` to `BulkDockLifecycleActions`; and on a successful reactivation clear the whole selection rather than keeping blocked ids checked (depends on T005, T026; `research.md` D3, D7)
- [X] T028 [US2] Run the focused US2 tests (T013–T018) and refactor the intent/select-mode wiring without changing behavior

**Checkpoint**: An administrator can select and reactivate a batch of archived docks end-to-end, with
mixed selections partially succeeding and reporting per-dock reasons. US1 and US2 together form the
MVP.

---

## Phase 5: User Story 3 - Reject Invalid Selections and Protect What Must Not Change (Priority: P2)

**Goal**: Empty, malformed, or duplicate selections are rejected before any dock changes;
unauthorized actors are refused for both the individual and bulk paths; an administrator can resubmit
a reduced selection after a reactivation produced blockers without the already-reactivated docks
being re-attempted.

**Independent Test**: Attempt an empty selection, a duplicated id, a malformed id, and an
unauthorized bulk/individual reactivation; verify every attempt is refused before any dock changes;
then from a partially-blocked bulk result, resubmit a reduced selection and verify the
already-reactivated docks are not re-attempted (spec.md, US3).

> Most of US3's guard behavior is already proven by T007 (individual auth and lifecycle refusals) and
> T013 (bulk empty/duplicate/malformed/auth refusals) — those tasks were written against US3's
> acceptance criteria from the start, because the individual and bulk paths share one set of rules
> (`plan.md` Constitution Check, principle II). This phase adds the coverage that is genuinely
> specific to US3.

### Tests for User Story 3 (write and observe RED first)

- [X] T029 [P] [US3] Add a consolidated permission test in `apps/web/src/features/docks/__tests__/reactivate/permissions.test.tsx` (new file): for an Observer, "Reactivate dock" is rendered on no dock of any status and the "Select docks" toggle is absent; forcing `selecting=docks` via the URL as an Observer renders no checkable markers and no bulk action bar (spec US3 AC3; `quickstart.md` scenario 12)
- [X] T030 [P] [US3] Add a resubmission test in `apps/web/src/features/checkpoints/__tests__/bulk-reactivate/resubmission.test.tsx` (new file): from a bulk result mixing reactivated docks with `ALREADY_AVAILABLE`/`NOT_FOUND` blockers, assert the selection is emptied (no blocked dock stays checked, unlike the archive path's `IN_USE` handling), then build a fresh reduced selection of still-archived docks, resubmit, and assert its `updatedDocks` contains only the newly-reactivated docks and no dock reactivated by the prior request is re-attempted or re-reported (spec FR-018; `research.md` D7; `quickstart.md` scenario 8)

### Implementation for User Story 3

- [X] T031 [US3] Close any gap T029/T030 find: confirm the reactivation success handler in `checkpoints-page.tsx` clears the whole selection while the archive success handler still keeps exactly the `IN_USE`-blocked ids checked, and confirm both the "Reactivate dock" action and the "Select docks" toggle are gated on the same administrator check already used elsewhere on the page
- [X] T032 [US3] Run the focused US3 tests (T029, T030) and refactor without changing behavior

**Checkpoint**: All three user stories are independently functional. Every refusal path — individual,
bulk, and the request-validity gate in front of bulk — is proven end-to-end.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T033 Run the whole `apps/web/src/features/checkpoints/__tests__/bulk-archive/` suite and `apps/api/tests/integration/docks/lifecycle/bulk/archive.spec.ts` one final time, **unmodified**, and confirm #200's archive behavior is untouched — including that a mixed archive result still leaves `IN_USE`-blocked docks checked for a retry (`quickstart.md` scenario 16)
- [X] T034 [P] Verify accessibility across the changed UI: the reactivate dialog and the reactivate-intent action bar follow the same `role`/labelling conventions as their archive counterparts; the comment textarea is labelled in both directions; a marker that is not checkable because of the current intent is not a focus stop that silently does nothing; the intent change is conveyed by the bar's text, not by colour alone
- [X] T035 [P] Confirm `apps/web/src/routes/_authenticated/checkpoints.tsx` and the resource-agnostic `apps/web/src/components/resource-map/*` primitives are unchanged — no new search param, no lifecycle-intent leakage into shared map components (`plan.md` Constraints)
- [X] T036 Run the full `quickstart.md` validation, scenarios 1–16, against a running app with the fixtures listed in its Prerequisites (five archived docks, one available dock, one dock archived while referenced by a closed discharge)
- [X] T037 Run `pnpm typecheck`, `pnpm check`, and the full fast test suites (`pnpm --filter @portflow/api test`, `pnpm --filter @portflow/web test`) and resolve any fallout (Constitution Principle VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. Touches only the bar's file/symbol name.
- **Foundational (Phase 2)**: No dependency on Phase 1. **Blocks US2's page wiring (T027)** only —
  US1 does not depend on it.
- **User Stories (Phases 3–5)**: US1 depends on nothing beyond the existing codebase and may start
  immediately. US2 depends on Phases 1–2. US3 depends on both US1 and US2 being implemented, since
  it tests guard behavior across both paths.
- **Polish (Phase 6)**: Depends on all three stories.

### Within Phase 1 and Phase 2

T001 → T002 are sequential (rename, then verify). T003 and T004 change two files that must agree, so
review them together; T005 depends on T003; T006 verifies T003–T005 as a group.

### User Story Dependencies

- **US1 (P1)**: No dependency on Phases 1–2 or on US2. Fully self-contained — the individual backend
  already exists; only frontend wiring and an HTTP test top-up are added. Can ship alone as a
  minimal MVP.
- **US2 (P1)**: Depends on Phase 1 (T001, for the file T026 edits) and Phase 2 (T003–T005, for the
  set T027 makes intent-dependent). Does not depend on US1 except through the shared file noted
  below.
- **US3 (P2)**: Depends on US1 and US2 both being implemented; its resubmission test needs US2's
  action bar and its permission test covers both paths.

### Cross-story file contention

Unlike #200, US1 and US2 are **not** file-disjoint on the frontend:

- `apps/web/src/features/docks/mutations/use-dock-mutations.ts` — T009 (US1, adds `reactivate`) and
  T025 (US2, adds `reactivateMany`): two different functions in one file, so sequence them rather
  than running them truly in parallel.
- `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx` — T005 (Phase 2) and T027 (US2) both
  edit it, and T027 builds directly on T005's `checkableDockIds`. Nothing in US1 touches it.

Every other file US1 touches (`dock-lifecycle-actions.tsx`, `dock-details.tsx`) is untouched by US2,
and every backend file US2 touches (`dock_repository.ts`, `lucid_dock_repository.ts`,
`dock_validator.ts`, `docks_controller.ts`, `routes.ts`, all of `app/docks/reactivate/`) is untouched
by US1.

### Parallel Opportunities

- Phase 1: none — T001 then T002.
- Phase 2: T004 can run alongside T003 (different files, same contract); T005 needs T003; T006 last.
- US1: T007 and T008 in parallel (API vs. web); T009 can start immediately; T010 needs T009; T011
  needs T010.
- US2: T013–T018 all in parallel (six different test files, three backend / three frontend). On the
  backend, T021 is independent of the T019 → T020 → T022 → T023 → T024 chain and can be written at
  any point before T023. On the frontend, T025 waits for T024's generated types; T026 waits for
  T025; T027 waits for T026 and T005.
- US3: T029 and T030 in parallel.
- Phase 6: T034 and T035 in parallel.

---

## Parallel Example: User Story 2

```bash
# All six US2 test tasks touch different files — launch together:
Task: "Bulk reactivation integration tests in apps/api/tests/integration/docks/lifecycle/bulk/reactivate.spec.ts"
Task: "Bulk reactivation concurrency test in apps/api/tests/integration/docks/lifecycle/bulk/reactivate.spec.ts"
Task: "Bulk reactivation unit test in apps/api/tests/unit/docks/lifecycle/bulk_reactivate.spec.ts"
Task: "Intent-scoped select-mode test in apps/web/src/features/checkpoints/__tests__/bulk-reactivate/select-mode.test.tsx"
Task: "Bulk reactivation action bar test in apps/web/src/features/checkpoints/__tests__/bulk-reactivate/bulk-reactivate-actions.test.tsx"
Task: "Keyboard-shortcut test in apps/web/src/features/checkpoints/__tests__/bulk-reactivate/keyboard-shortcuts.test.tsx"
```

---

## Implementation Strategy

### MVP First

Both US1 and US2 are P1 because the issue's delivery boundary explicitly bundles individual and
multiple reactivate as one outcome (spec "Multiple-operation contract" and "Delivery boundary";
`plan.md` Constitution Check, principle II). The true minimum shippable slice is **both**:

1. Phase 1 (T001–T002) + Phase 2 (T003–T006) — two behavior-preserving refactors, each proven by
   #200's existing suite before any new behavior is written.
2. Phase 3 (US1, T007–T012) and Phase 4 (US2, T013–T028) — US1 first is the natural order: it is the
   smaller of the two, it de-risks the shared `use-dock-mutations.ts` file before US2 touches it,
   and it makes archived docks actionable at all, which is what makes US2's selection worth building.
3. **STOP and VALIDATE**: `quickstart.md` scenarios 1–10, 13–15.
4. At that point every rule in the spec is enforced by the backend (individual: since #178; bulk:
   built in Phase 4) — US3 makes the request-validity and resubmission guarantees *proven*, not
   *true*.

### Incremental Delivery

1. Phases 1–2 → the bar is named for both directions and the checkability rule has one home; nothing
   user-visible changed.
2. + US1 → demo reactivating a single archived dock (smallest possible MVP slice).
3. + US2 → demo batch reactivation with partial success (completes the issue's stated MVP).
4. + US3 → request-validity gate and resubmission behavior proven end-to-end.
5. Polish → archive regression guard, accessibility, quickstart, full suites.

### A note on the individual-path backend tasks

T007 tests behavior that is **already implemented and already unit-tested**. Write it before running
it, and expect it to go GREEN on first run. A test that goes RED here has found a real defect in the
existing #178 implementation — fix the implementation, do not soften the test to match it.

---

## Notes

- [P] tasks = different files, no dependencies.
- Verify tests fail before implementing, except where noted for the pre-existing
  individual-reactivate backend behavior (T007) and for the two refactor phases, whose guard suites
  (T002, T006) must stay green throughout.
- Commit after each task or logical group; Conventional Commits, on `feat/201-reactivate-docks`.
- Three decisions in `research.md` were resolved without user confirmation and are worth re-raising
  at review: **D3** (one homogeneous select mode with a derived intent, rather than a second
  `selecting` mode and a second map control), **D6** (a successful reactivation does not widen the
  status filter, so under `status=archived` the dock leaves the view), and **D7** (the whole
  selection is cleared after a bulk reactivation, since neither blocker is retryable). Changing any
  of them is a spec/plan change, not a task change.
