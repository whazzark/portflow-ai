# Tasks: Update a Dock

**Input**: Design documents from `specs/site-references/operational-checkpoints/docks/update-a-dock/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Observable business behavior follows RED → GREEN → REFACTOR (Constitution Principle IV).
Test tasks must be run and observed failing before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story so each story remains independently testable.

Per `plan.md`, **no `apps/api` production file changes**. The update endpoint, validator, policy,
use case, and repository already implement every backend requirement. What the API lacks is *test
coverage* for seven update behaviors — those tasks live in the user story whose rules they prove
(US2 for duplicate/range, US3 for archived/not-found), not in a separate backend phase, because
splitting them out would recreate the API-only/interface-only split the issue forbids.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an
  incomplete task in the same phase.
- **[Story]**: Maps a task to its user story from `spec.md`.

---

## Phase 1: Setup

**Purpose**: Extend the checkpoints route's URL contract to carry the new edit mode.

- [X] T001 Add an `edit` search param (`z.enum(['dock']).optional().catch(undefined)`) to the checkpoints search schema in `apps/web/src/routes/_authenticated/checkpoints.tsx`, alongside the existing `create` param and independent of `checkpoint` (`contracts/dock-edit-ui-state.md`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Generalize the shared dock form and add the update mutation seam that every user story
depends on. The form is shared with the create flow from #198, so this phase both changes it and
re-proves creation still works.

**⚠️ CRITICAL**: No user story implementation starts until this phase is complete.

- [X] T002 Generalize `apps/web/src/features/docks/ui/dock-form.tsx` from create-only to create-and-update: replace the `onCreate` prop and empty `defaultValues` with `initialValues: {name, latitude, longitude} | null`, a single `onSubmit`, and `submitLabel` / `pendingLabel` / `errorTitle` props; reduce `canSubmit` to `!hasCoordinateError` when `initialValues` is non-null, and render the "A location must be placed…" hint only when it is null. Consume `useCoordinateFields` **unchanged** — its no-overwrite guard is what allows typing decimals, and duplicating it would let a copy drift (`research.md` D4, `contracts/dock-edit-ui-state.md`)
- [X] T003 Update `apps/web/src/features/docks/ui/create-dock-panel.tsx` to pass the generalized `DockForm` props (`initialValues: null`, `onSubmit`, `submitLabel: 'Create dock'`, `pendingLabel: 'Creating…'`, `errorTitle: 'Unable to create dock'`) with no behavior change (depends on T002)
- [X] T004 Run the existing create suite (`apps/web/src/features/docks/__tests__/create/`) and confirm it is still green after T002–T003, with the create-only hint and "Create dock" label unchanged — this is the regression guard for the shared-form generalization (`quickstart.md` scenario 14)
- [X] T005 [P] Add an `update` mutation (`tuyauQuery.docks.update.mutationOptions()`) sharing the existing `invalidateDocks` invalidation in `apps/web/src/features/docks/mutations/use-dock-mutations.ts`, mirroring `use-customer-mutations.ts`
- [X] T006 [P] Extend the checkpoint map test double to render `placement.label` alongside the pending marker in `apps/web/src/features/checkpoints/__tests__/support/mock-checkpoint-map.tsx`, so edit tests can assert the draft marker carries the dock's own name rather than "New dock". The existing place/drag seams already serve edit unchanged (`research.md` D12)

**Checkpoint**: One form component serves both create and edit, creation is proven unregressed, a
typed update mutation exists, and the jsdom harness can assert the draft marker's label. User story
implementation can now begin.

---

## Phase 3: User Story 1 - Correct an Available Dock's Name and Position (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator opens an available dock, corrects its name and/or drags its
marker to a new point, and saves — the dock is stored and displayed with the corrected values while
keeping its identity, status, and creation time.

**Independent Test**: Open an available dock from `/checkpoints`, change its name and drag its
marker, save, and verify it is shown under its new name at its new coordinates with the same
identity and Available status (spec.md, US1).

### Tests for User Story 1 (write and observe RED first)

- [X] T007 [P] [US1] Add a web test covering the edit happy paths in `apps/web/src/features/docks/__tests__/update/update.test.tsx`: the "Edit dock" action is offered on an available dock for an administrator; activating it sets `edit=dock` while keeping `checkpoint=dock:<id>`, opens the panel with name/latitude/longitude **pre-filled**, and moves focus to the name field; a rename-only save succeeds, returns to read-only details, refreshes the collection without a reload, and leaves position, status, id and `createdAt` unchanged; a combined name+position save applies both; a no-change save succeeds with the submit button **enabled** and reports no duplicate (`quickstart.md` 1, 2, 4, 8, 9)
- [X] T008 [P] [US1] Add a web test covering the draft-placement behaviors in `apps/web/src/features/docks/__tests__/update/placement.test.tsx`: the edited dock renders **once** on the map, as the draft marker labelled with its own name and not as its ordinary marker; dragging the draft marker updates the coordinate fields and the saved value is the final dragged position; typing coordinates moves the draft marker; a "position modified" status with a restore control appears once the draft differs from stored, restores both marker and fields, and does **not** clear a name already typed (`quickstart.md` 3, 5, 6, 7; `research.md` D3, D10)

### Implementation for User Story 1

- [X] T009 [P] [US1] Add an "Edit dock" trigger to `apps/web/src/features/docks/ui/dock-details.tsx`, rendered only when the viewer is an administrator **and** `dock.status === 'AVAILABLE'`, mirroring `customer-details.tsx`'s `onEdit` prop shape
- [X] T010 [P] [US1] Implement `apps/web/src/features/docks/ui/edit-dock-panel.tsx` with the props in `contracts/dock-edit-ui-state.md` (`dock`, `draft`, `onDraftChange`, `onRestorePosition`, `onCancel`, `onUpdate`, `onSuccess`): a "Back to dock details" ghost header mirroring `edit-customer-panel.tsx`, the generalized `DockForm`, and the `role="status"` position-modified line with its restore control (depends on T002)
- [X] T011 [US1] Extend `apps/web/src/features/checkpoints/ui/checkpoint-sheet.tsx` to model the `'edit'` mode its `/** 'edit' is intentionally not modeled yet — see issue #199. */` comment reserves: widen the union to `'view' | 'create' | 'edit'`, remove that comment, render `EditDockPanel` in edit mode, and keep the sheet non-modal with pointer dismissal disabled for edit as it already is for create (`research.md` D9)
- [X] T012 [US1] Wire `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`: hold the edit session `{ id, editable }` latched when editing starts (`research.md` D5); seed the draft placement from the dock's stored coordinates; pass `placement={{ armed: true, pending: draft, onPlace, onMove, label: dock.name, icon: <AnchorIcon/> }}`; filter the edited dock out of the array passed to `<CheckpointMap checkpoints={…}>` **only**, leaving `hasMatches`/`emptyMessage` computed over the unfiltered set; and on success show a toast, clear `edit`, and keep the dock selected (`contracts/dock-edit-ui-state.md`)
- [X] T013 [US1] Run the focused US1 tests and refactor the edit-session/draft-placement wiring without changing behavior

**Checkpoint**: An administrator can correct an available dock's name and position end-to-end. US1
is independently demonstrable.

---

## Phase 4: User Story 2 - Be Prevented From Saving Invalid or Duplicate Values (Priority: P2)

**Goal**: Blank, over-long, duplicate, and out-of-range values are refused with a clear
field-specific message, the stored dock is untouched, and the administrator's entered values and
draft marker survive for correction.

**Independent Test**: On an available dock, submit in turn a blank name, an over-long name, another
dock's name, and an out-of-range latitude; verify each is refused on the offending field with the
dock unchanged, then correct one and resubmit successfully without reopening the dock (spec.md, US2).

### Tests for User Story 2 (write and observe RED first)

- [X] T014 [P] [US2] Add update-path integration tests in `apps/api/tests/integration/docks.spec.ts` for the four uncovered validation/uniqueness behaviors: a duplicate name → 409 `E_DOCK_NAME_CONFLICT` (exact, case-only difference, and surrounding-whitespace difference); a duplicate against an **archived** dock's name → 409, proving the `LOWER(name)` index is cross-status; the dock's **own** current name resubmitted → 200 and *not* a conflict; and an out-of-range coordinate → 422 asserting the `min`/`max` rule rather than `required`, with ±90 / ±180 boundary values accepted (`contracts/dock-update-api.md` requirement-to-test mapping; `research.md` D1 gaps 1, 2, 3, 5)
- [X] T015 [P] [US2] Add a duplicate-name unit test for `UpdateDockUseCase` (rejects with `DuplicateDockNameException` when the repository reports `DUPLICATE_NAME`) in `apps/api/tests/unit/docks/dock_use_cases.spec.ts`
- [X] T016 [P] [US2] Add a web test in `apps/web/src/features/docks/__tests__/update/validation.test.tsx`: blank, whitespace-only, and 256-character names, plus out-of-range and non-numeric coordinates, each refused with the message on the offending field; a 409 `E_DOCK_NAME_CONFLICT` response surfaced **on the name field** rather than as a bare toast; the entered values and draft marker position preserved across every refusal; and a corrected resubmission succeeding without closing the sheet (`quickstart.md` 10, 11; `research.md` D7)

### Implementation for User Story 2

- [X] T017 [US2] In `apps/web/src/features/docks/ui/dock-form.tsx`, confirm the existing `applyValidationError` → `E_DOCK_NAME_CONFLICT` special case fires for the update path too and reports under `errorTitle`, and ensure a rejected submission leaves both the form values and the caller's draft placement untouched so the marker does not snap back (spec FR-016, FR-021)
- [X] T018 [US2] Run the focused US2 tests (API and web) and refactor error surfacing without changing behavior

**Checkpoint**: US1 and US2 both work independently. Invalid and duplicate corrections are refused
without data loss.

---

## Phase 5: User Story 3 - Be Blocked From Updating What Must Not Change (Priority: P3)

**Goal**: Updates are refused for users without dock administration rights, for archived docks, and
for docks that no longer exist — whether attempted through the interface or directly.

**Independent Test**: Attempt an update as an Observer, on an archived dock, and on an unknown id;
verify each is refused with the appropriate outcome and no dock data changes (spec.md, US3).

### Tests for User Story 3 (write and observe RED first)

- [X] T019 [P] [US3] Add update-path integration tests in `apps/api/tests/integration/docks.spec.ts` for the two uncovered lifecycle guards: updating an **archived** dock → 409 `E_DOCK_ARCHIVED`, and updating an unknown id → 404 `E_DOCK_NOT_FOUND`, asserting in both cases that no dock row changed (`contracts/dock-update-api.md`; `research.md` D1 gaps 4, 6)
- [X] T020 [P] [US3] Add unit tests for `UpdateDockUseCase` rejecting with `ArchivedDockReadOnlyException` and `DockNotFoundException` for the corresponding repository results in `apps/api/tests/unit/docks/dock_use_cases.spec.ts`
- [X] T021 [P] [US3] Add a web test in `apps/web/src/features/docks/__tests__/update/permissions.test.tsx`: no "Edit dock" action is rendered for a non-administrator or for an archived dock (whose header still explains the archived state); an `edit=dock` URL is ignored — falling back to read-only details — when the viewer is not an administrator or the dock is not editable; a 409 `E_DOCK_ARCHIVED` response keeps the form open with values intact and names reactivation as the prerequisite; and a 404 `E_DOCK_NOT_FOUND` response leaves edit mode and clears the selection (`quickstart.md` 1, 13; `research.md` D7)

### Implementation for User Story 3

- [X] T022 [US3] Handle the two update-only failure codes in `apps/web/src/features/docks/ui/dock-form.tsx` / `edit-dock-panel.tsx` per `research.md` D7: `E_DOCK_ARCHIVED` as a form-level error naming reactivation as the prerequisite with the form left open, and `E_DOCK_NOT_FOUND` as a toast that exits edit mode and clears `checkpoint` from the URL
- [X] T023 [US3] In `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`, honour `edit=dock` only when the viewer is an administrator, the `checkpoint` param resolves to a dock in the loaded collection, and the latched session says `editable`; otherwise fall back to `view`. Make `create` win when both params are present, so two draft markers can never coexist (`contracts/dock-edit-ui-state.md`)
- [X] T024 [US3] Run the focused US3 tests (API and web) and refactor the guard wiring without changing behavior

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T025 [P] Confirm `apps/web/src/components/resource-map/resource-map-placement.tsx` is unchanged and its public surface is still resource-agnostic (plain `{latitude, longitude}`, no `Dock`/`DockDto`), so the weighing-area, warehouse, and warehouse-door issues can still consume it unmodified (`plan.md` Structure Decision)
- [X] T026 [P] Verify focus management and announcements across the edit flow: focus moves to the name field on entering edit mode and returns to the "Edit dock" trigger on leaving it; the position-modified line is `role="status"` so a drag is announced without stealing focus; both coordinate inputs remain keyboard-editable so a dock can be repositioned without a pointing device (`contracts/dock-edit-ui-state.md` Accessibility)
- [X] T027 Run the full `quickstart.md` validation, scenarios 1–14, against a running app with the three required dock fixtures (available under test, second available for collisions, archived)
- [X] T028 Run `pnpm typecheck`, `pnpm check`, and the full fast test suites (`pnpm --filter @portflow/api test`, `pnpm --filter @portflow/web test`) and resolve any fallout (Constitution Principle VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on T001. **Blocks all user stories** — every story renders the
  generalized form.
- **User Stories (Phases 3–5)**: All depend on Phase 2. US1 → US2 → US3 in priority order, or in
  parallel if staffed (see below).
- **Polish (Phase 6)**: Depends on all desired stories.

### Within Phase 2

- T002 → T003 → T004 are strictly sequential (same shared form, then its consumer, then its
  regression proof). T005 and T006 are independent of that chain and of each other.

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2. Self-contained MVP.
- **US2 (P2)**: Depends on Phase 2. Its web test needs an edit panel to type into, so in practice
  it follows US1; its two API test tasks (T014, T015) depend on nothing and can start immediately
  after Phase 1.
- **US3 (P3)**: Depends on Phase 2. Same shape — T019 and T020 are API-only and unblocked; T021–T023
  need US1's entry point and panel.

### Cross-story file contention

`dock-form.tsx` is touched in T002 (Phase 2), T017 (US2), and T022 (US3); `checkpoints-page.tsx` in
T012 (US1) and T023 (US3). Those tasks are **not** parallel with each other and are ordered by
phase. This is the main reason US2 and US3 should not be run concurrently by different people
without coordinating on those two files.

### Parallel Opportunities

- Phase 2: T005 and T006 in parallel, and in parallel with the T002→T003→T004 chain.
- US1: T007 and T008 in parallel (different test files); then T009 and T010 in parallel (different
  components) before the sequential T011 → T012.
- US2: T014, T015, T016 all in parallel (three different files, two of them backend).
- US3: T019, T020, T021 all in parallel.
- Phase 6: T025 and T026 in parallel.

---

## Parallel Example: User Story 2

```bash
# All three US2 test tasks touch different files — launch together:
Task: "Duplicate / self-name / coordinate-range update integration tests in apps/api/tests/integration/docks.spec.ts"
Task: "Duplicate-name unit test for UpdateDockUseCase in apps/api/tests/unit/docks/dock_use_cases.spec.ts"
Task: "Field-level refusal and value-preservation web tests in apps/web/src/features/docks/__tests__/update/validation.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (T001) → Phase 2 (T002–T006).
2. Phase 3 (T007–T013).
3. **STOP and VALIDATE**: `quickstart.md` scenarios 1–9 and 14.
4. At this point an administrator can correct a dock's name and position — the feature's whole
   reason for existing — with the server already refusing everything it should. US2 and US3 make
   those refusals *legible and proven*, they do not make them *true*.

### Incremental Delivery

1. Setup + Foundational → shared form generalized, creation unregressed.
2. + US1 → demo the correction flow (MVP).
3. + US2 → refusals surface on the right field; four API test gaps closed.
4. + US3 → lifecycle and authorization guards surfaced; three more API test gaps closed.
5. Polish → quickstart, accessibility, full suites.

### A note on the backend tasks

T014, T015, T019, and T020 test behavior that is **already implemented**. Write each test before
running it, and expect most to go GREEN on first run. A test that goes RED here has found a real
defect in the existing implementation — fix the implementation, do not soften the test to match it.

---

## Notes

- [P] tasks = different files, no dependencies.
- Verify tests fail before implementing, except where noted for the pre-existing backend behavior.
- Commit after each task or logical group; Conventional Commits, on `feat/199-update-dock`.
- Two decisions in `research.md` were resolved without user confirmation and are worth re-raising at
  review: **D6** (submit stays enabled when the form is pristine, because disabling it contradicts
  US1 AC7) and **D8** (a dock in use by a planned or active discharge stays updatable). Changing
  either is a spec change, not a task change.
