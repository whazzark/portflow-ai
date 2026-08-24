# Tasks: Update a Weighing Area

**Input**: Design documents from `specs/site-references/operational-checkpoints/weighing-areas/update-a-weighing-area/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Observable business behavior follows RED → GREEN → REFACTOR (Constitution Principle IV).
Test tasks must be run and observed failing before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story so each story remains independently testable.

Per `plan.md`, **no `apps/api` production file changes**. The update endpoint, validator, policy,
use case, and repository already implement every backend requirement. What the API lacks is *test
coverage* for ten update behaviors — those tasks live in the user story whose rules they prove (US2
for duplicate/trim/range, US3 for authorization/archived/not-found), not in a separate backend
phase, because splitting them out would recreate the API-only/interface-only split the issue forbids.

The frontend is a **generalization of the machinery #199 built for docks**, not a second edit path.
Phase 2 does that generalization and re-proves both the create flows and the whole dock edit flow
before any weighing-area work starts.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an
  incomplete task in the same phase.
- **[Story]**: Maps a task to its user story from `spec.md`.

---

## Phase 1: Setup

**Purpose**: Widen the checkpoints route's URL contract so the edit mode can name a second kind.

- [X] T001 Widen the `edit` search param from `z.enum(['dock'])` to `z.enum(['dock', 'weighing-area'])` in `apps/web/src/routes/_authenticated/checkpoints.tsx`, leaving `create`, `checkpoint`, `kinds`, `search`, and `status` untouched (`contracts/checkpoint-edit-ui-state.md` URL contract)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Generalize the weighing-area form and the dock-bound edit session into the shared,
kind-keyed machinery every user story depends on — then prove nothing that already shipped regressed.

**⚠️ CRITICAL**: No user story implementation starts until this phase is complete.

- [X] T002 Generalize `apps/web/src/features/weighing-areas/ui/weighing-area-form.tsx` from create-only to create-and-update, mirroring `apps/web/src/features/docks/ui/dock-form.tsx` prop-for-prop: replace the `onCreate` prop and empty `defaultValues` with `initialValues: {name, latitude, longitude} | null`, a single `onSubmit`, an optional `onNotFound`, and `submitLabel` / `pendingLabel` / `errorTitle` props; reduce `canSubmit` to `!hasCoordinateError` when `initialValues` is non-null; render the "Click the map to place…" and "A location must be placed…" hints only when it is null; `autoFocus` the name field when editing. Consume `useCoordinateFields` **unchanged** (`research.md` D4, `contracts/checkpoint-edit-ui-state.md`)
- [X] T003 Update `apps/web/src/features/weighing-areas/ui/create-weighing-area-panel.tsx` to pass the generalized `WeighingAreaForm` props (`initialValues: null`, `onSubmit`, `submitLabel: 'Create weighing area'`, `pendingLabel: 'Creating…'`, `errorTitle: 'Unable to create weighing area'`) with no behavior change (depends on T002)
- [X] T004 Run the existing create suite (`apps/web/src/features/weighing-areas/__tests__/create/`) and confirm it is still green after T002–T003, with the create-only hint text and the "Create weighing area" label unchanged — the regression guard for the shared-form generalization (`quickstart.md` scenario 16)
- [X] T005 [P] Add an `update` mutation (`tuyauQuery.weighingAreas.update.mutationOptions()`) sharing the existing `invalidateWeighingAreas` invalidation in `apps/web/src/features/weighing-areas/mutations/use-weighing-area-mutations.ts`, mirroring `use-dock-mutations.ts`
- [X] T006 Extract the dock-bound edit session out of `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx` into a new `apps/web/src/features/checkpoints/use-checkpoint-edit-session.ts`, keyed on **kind + id** rather than on the dock: session becomes `{ kind, id, editable, origin }`, and the hook exposes `isEditing`, `session`, `draft`, `setDraft`, `restoreOrigin`, `clear` per `contracts/checkpoint-edit-ui-state.md`. Carry all three review-hardened rules across verbatim — session discarded whenever its selection goes away or changes identity **or kind**; `editable` and `origin` snapshotted once and never re-derived from live query data; creation controls hidden while a session is open (`research.md` D3)
- [X] T007 Rewire `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx` and `apps/web/src/features/checkpoints/ui/checkpoint-sheet.tsx` onto the generalized session: replace `isEditingDock` / `draftDockPlacement` / `startEditingDock` / `cancelEditingDock` / `restoreDockPosition` with their kind-agnostic equivalents; rename the sheet's `canEditDock` / `onEditDock` props to `canEditCheckpoint` / `onEditCheckpoint`; generalize the map-only filter predicate to `!(c.kind === session.kind && c.id === session.id)`. `EditDockPanel` and `DockDetails` keep their current surfaces and behavior (depends on T006)
- [X] T008 Run the full dock update suite unchanged — `apps/web/src/features/docks/__tests__/update/{update,placement,validation,permissions,session}.test.tsx` — and confirm every test is green after T006–T007. This is the regression gate for the generalization: dock behavior must be byte-for-byte the same, and any edit to those five files other than the renamed sheet props is a signal the generalization changed behavior it should not have (`quickstart.md` scenario 15)

**Checkpoint**: One form component serves create and edit for weighing areas, one kind-keyed session
serves both checkpoint kinds, a typed update mutation exists, and both the create flows and the whole
dock edit flow are proven unregressed. User story implementation can now begin.

---

## Phase 3: User Story 1 - Correct an Available Weighing Area's Name and Position (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator opens an available weighing area, corrects its name and/or
drags its marker to a new point, and saves — the area is stored and displayed with the corrected
values while keeping its identity, status, and creation time.

**Independent Test**: Open an available weighing area from `/checkpoints`, change its name and drag
its marker, save, and verify it is shown under its new name at its new coordinates with the same
identity and Available status (spec.md, US1).

### Tests for User Story 1 (write and observe RED first)

- [X] T009 [P] [US1] Add a web test covering the edit happy paths in `apps/web/src/features/weighing-areas/__tests__/update/update.test.tsx`: the "Edit weighing area" action is offered on an available area for an administrator; activating it sets `edit=weighing-area` while keeping `checkpoint=weighing-area:<id>`, opens the panel with name/latitude/longitude **pre-filled**, and moves focus to the name field; a rename-only save succeeds, returns to read-only details, refreshes the collection without a reload, and leaves position, status, id and `createdAt` unchanged; a combined name+position save applies both; a no-change save succeeds with the submit button **enabled** and reports no duplicate; and the `kinds` and `status` search params are unchanged by a successful save (`quickstart.md` 1, 2, 4, 8, 9; `research.md` D8, D9)
- [X] T010 [P] [US1] Add a web test covering the draft-placement behaviors in `apps/web/src/features/weighing-areas/__tests__/update/placement.test.tsx`: the edited area renders **once** on the map, as the draft marker labelled with its own name and not as its ordinary marker; dragging the draft marker updates the coordinate fields and the saved value is the final dragged position; typing coordinates moves the draft marker; a "position modified" status with a restore control appears once the draft differs from the snapshotted origin, restores both marker and fields, and does **not** clear a name already typed (`quickstart.md` 3, 5, 6, 7; `research.md` D6, D7)

### Implementation for User Story 1

- [X] T011 [P] [US1] Add `canEdit` / `onEdit` props and an "Edit weighing area" footer trigger to `apps/web/src/features/weighing-areas/ui/weighing-area-details.tsx`, rendered only when the viewer is an administrator **and** `area.status === 'AVAILABLE'`, mirroring `dock-details.tsx`
- [X] T012 [P] [US1] Implement `apps/web/src/features/weighing-areas/ui/edit-weighing-area-panel.tsx` with the props in `contracts/checkpoint-edit-ui-state.md` (`area`, `draft`, `origin`, `onDraftChange`, `onRestorePosition`, `onCancel`, `onNotFound`, `onUpdate`, `onSuccess`): a "Back to weighing area details" ghost header, the generalized `WeighingAreaForm`, and the `role="status"` position-modified line whose comparison is against **`origin`, never the live DTO** (depends on T002)
- [X] T013 [US1] Wire the weighing-area edit branch in `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`: render `EditWeighingAreaPanel` when the session's kind is `WEIGHING_AREA`; add `updateWeighingArea` calling the T005 mutation; pass `placement={{ armed: true, pending: draft, onPlace, onMove, label: area.name, icon: <CheckpointKindIcon kind="WEIGHING_AREA"/> }}`; on success show a "Weighing area updated" toast, clear `edit`, keep the area selected, and **widen no filter** (`research.md` D8; `contracts/checkpoint-edit-ui-state.md`)
- [X] T014 [US1] Run the focused US1 tests and refactor the weighing-area edit wiring without changing behavior, checking that nothing dock-specific has crept back into the shared session or the shared page branches

**Checkpoint**: An administrator can correct an available weighing area's name and position
end-to-end. US1 is independently demonstrable.

---

## Phase 4: User Story 2 - Be Prevented From Saving Invalid or Duplicate Values (Priority: P2)

**Goal**: Blank, over-long, duplicate, and out-of-range values are refused with a clear
field-specific message, the stored weighing area is untouched, and the administrator's entered
values and draft marker survive for correction.

**Independent Test**: On an available weighing area, submit in turn a blank name, an over-long name,
another area's name, and an out-of-range latitude; verify each is refused on the offending field
with the area unchanged, then correct one and resubmit successfully without reopening the area
(spec.md, US2).

### Tests for User Story 2 (write and observe RED first)

- [X] T015 [P] [US2] Add update-path integration tests in `apps/api/tests/integration/weighing_areas.spec.ts` for six uncovered validation/uniqueness behaviors: an empty body `{}` → 422 asserting the `required` rule; a duplicate name → 409 `E_WEIGHING_AREA_NAME_CONFLICT` (exact, case-only difference, and surrounding-whitespace difference); a duplicate against an **archived** area's name → 409, proving the `LOWER(name)` index is cross-status; the area's **own** current name resubmitted, exactly and with different casing → 200 and *not* a conflict; a name with surrounding whitespace stored trimmed on the update path; and an out-of-range coordinate → 422 asserting the `min`/`max` rule rather than `required`, with ±90 / ±180 boundary values accepted (`contracts/weighing-area-update-api.md` requirement-to-test mapping)
- [X] T016 [P] [US2] Add a duplicate-name unit test for `UpdateWeighingAreaUseCase` (rejects with `DuplicateWeighingAreaNameException` when the repository reports `DUPLICATE_NAME`) in `apps/api/tests/unit/weighing_areas/weighing_area_use_cases.spec.ts`
- [X] T017 [P] [US2] Add a web test in `apps/web/src/features/weighing-areas/__tests__/update/validation.test.tsx`: blank, whitespace-only, and 256-character names, plus out-of-range and non-numeric coordinates, each refused with the message on the offending field; a 409 `E_WEIGHING_AREA_NAME_CONFLICT` response surfaced **on the name field** rather than as a bare toast; the entered values and draft marker position preserved across every refusal; and a corrected resubmission succeeding without closing the sheet (`quickstart.md` 10, 11, 12; `research.md` D11)

### Implementation for User Story 2

- [X] T018 [US2] In `apps/web/src/features/weighing-areas/ui/weighing-area-form.tsx`, confirm the existing `applyValidationError` → `E_WEIGHING_AREA_NAME_CONFLICT` branch fires for the update path too and reports under `errorTitle`, and ensure a rejected submission leaves both the form values and the caller's draft placement untouched so the marker does not snap back (spec FR-016, FR-021)
- [X] T019 [US2] Run the focused US2 tests (API and web) and refactor error surfacing without changing behavior

**Checkpoint**: US1 and US2 both work independently. Invalid and duplicate corrections are refused
without data loss.

---

## Phase 5: User Story 3 - Be Blocked From Updating What Must Not Change (Priority: P3)

**Goal**: Updates are refused for users without weighing-area administration rights, for archived
areas, and for areas that no longer exist — whether attempted through the interface or directly —
and an edit session can never arm the map for a checkpoint it was not opened for.

**Independent Test**: Attempt an update as an Observer, on an archived area, and on an unknown id;
verify each is refused with the appropriate outcome and no weighing-area data changes (spec.md, US3).

### Tests for User Story 3 (write and observe RED first)

- [X] T020 [P] [US3] Add update-path integration tests in `apps/api/tests/integration/weighing_areas.spec.ts` for three uncovered guards: an unauthenticated update → 401 and an active non-administrator (Observer) update → 403, neither changing the row; updating an **archived** area → 409 `E_WEIGHING_AREA_ARCHIVED`; and updating an unknown id → 404 `E_WEIGHING_AREA_NOT_FOUND`. Assert in every case that no weighing-area row changed (`contracts/weighing-area-update-api.md`)
- [X] T021 [P] [US3] Add unit tests for `UpdateWeighingAreaUseCase` rejecting with `ArchivedWeighingAreaReadOnlyException` and `WeighingAreaNotFoundException` for the corresponding repository results in `apps/api/tests/unit/weighing_areas/weighing_area_use_cases.spec.ts`
- [X] T022 [P] [US3] Add a web test in `apps/web/src/features/weighing-areas/__tests__/update/permissions.test.tsx`: no "Edit weighing area" action is rendered for a non-administrator or for an archived area (whose header still explains the archived state); an `edit=weighing-area` URL is ignored — falling back to read-only details — when the viewer is not an administrator or the area is not editable; a 409 `E_WEIGHING_AREA_ARCHIVED` response keeps the form open with values intact and names reactivation as the prerequisite; and a 404 `E_WEIGHING_AREA_NOT_FOUND` response leaves edit mode and clears the selection (`quickstart.md` 1, 13; `research.md` D11)
- [X] T023 [P] [US3] Add a cross-kind session-scoping web test in `apps/web/src/features/weighing-areas/__tests__/update/session.test.tsx`, mirroring the dock suite's `session.test.tsx` across kinds: `edit` is cleared everywhere `checkpoint` is (selection cleanup, status-filter change, view-mode close), so selecting a **dock** merely to view it after editing a weighing area never arms the map to move it; both "New dock" and "New weighing area" controls are hidden for the duration of an edit session; a mismatched `?checkpoint=dock:<id>&edit=weighing-area` URL is inert; and a background refetch that moves the area cannot masquerade as an unsaved change nor become what "Restore original position" restores (spec FR-023, SC-009; `quickstart.md` 14; `research.md` D3)

### Implementation for User Story 3

- [X] T024 [US3] Handle the two update-only failure codes in `apps/web/src/features/weighing-areas/ui/weighing-area-form.tsx` per `research.md` D11: `E_WEIGHING_AREA_ARCHIVED` as a form-level error naming reactivation as the prerequisite with the form left open, and `E_WEIGHING_AREA_NOT_FOUND` as a toast that calls `onNotFound()`, exits edit mode, and clears `checkpoint` from the URL
- [X] T025 [US3] In `apps/web/src/features/checkpoints/use-checkpoint-edit-session.ts` and `checkpoints-page.tsx`, honour `edit=<kind>` only when the viewer is an administrator, the `checkpoint` param resolves to a checkpoint of **that same kind** in the loaded collection, and the latched session says `editable`; otherwise fall back to `view`. Keep `create` winning when both params are present, so two draft markers can never coexist (`contracts/checkpoint-edit-ui-state.md`)
- [X] T026 [US3] Run the focused US3 tests (API and web) and refactor the guard wiring without changing behavior

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T027 [P] Confirm `apps/web/src/components/resource-map/resource-map-placement.tsx` and `resource-placement-fields.tsx` are unchanged and their public surfaces are still resource-agnostic (plain `{latitude, longitude}`, no resource DTO), so the warehouse and warehouse-door issues can still consume them unmodified (`plan.md` Structure Decision)
- [X] T028 [P] Confirm no `apps/api` production file changed — `git diff --stat master -- apps/api/app apps/api/start apps/api/database` must show nothing outside `apps/api/tests/` (`plan.md` Summary; `research.md` D1)
- [X] T029 [P] Verify focus management and announcements across the weighing-area edit flow: focus moves to the name field on entering edit mode and returns to the "Edit weighing area" trigger on leaving it; the position-modified line is `role="status"` so a drag is announced without stealing focus; both coordinate inputs remain keyboard-editable so an area can be repositioned without a pointing device (`contracts/checkpoint-edit-ui-state.md` Accessibility)
- [X] T030 Run the full `quickstart.md` validation, scenarios 1–16, against a running app with the required fixtures (available area under test, second available area for collisions, archived area, at least one dock for the cross-kind scenarios)
- [X] T031 Run `pnpm typecheck`, `pnpm check`, and the full fast test suites (`pnpm --filter @portflow/api test`, `pnpm --filter @portflow/web test`) and resolve any fallout (Constitution Principle VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on T001. **Blocks all user stories** — every story renders the
  generalized form through the generalized session.
- **User Stories (Phases 3–5)**: All depend on Phase 2. US1 → US2 → US3 in priority order, or in
  parallel if staffed (see below).
- **Polish (Phase 6)**: Depends on all desired stories.

### Within Phase 2

Two independent chains plus one parallel task:

- T002 → T003 → T004 (shared form, then its consumer, then its regression proof)
- T006 → T007 → T008 (session extraction, then its consumers, then the dock regression gate)
- T005 is independent of both.

T008 is the phase's hard gate: if any of the five dock update test files needs a behavior change to
pass, the generalization has broken something and must be corrected rather than the tests adjusted.

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2. Self-contained MVP.
- **US2 (P2)**: Depends on Phase 2. Its web test needs an edit panel to type into, so in practice it
  follows US1; its two API test tasks (T015, T016) depend on nothing and can start immediately after
  Phase 1.
- **US3 (P3)**: Depends on Phase 2. Same shape — T020 and T021 are API-only and unblocked; T022–T025
  need US1's entry point and panel.

### Cross-story file contention

`weighing-area-form.tsx` is touched in T002 (Phase 2), T018 (US2), and T024 (US3);
`checkpoints-page.tsx` in T007 (Phase 2), T013 (US1), and T025 (US3);
`use-checkpoint-edit-session.ts` in T006 (Phase 2) and T025 (US3);
`apps/api/tests/integration/weighing_areas.spec.ts` in T015 (US2) and T020 (US3). Those tasks are
**not** parallel with each other and are ordered by phase. This is the main reason US2 and US3
should not be run concurrently by different people without coordinating on those four files.

### Parallel Opportunities

- Phase 2: T005 in parallel with both chains; the T002→T003→T004 and T006→T007→T008 chains can run
  in parallel with each other until T008, which needs T007.
- US1: T009 and T010 in parallel (different test files); then T011 and T012 in parallel (different
  components) before the sequential T013 → T014.
- US2: T015, T016, T017 all in parallel (three different files, two of them backend).
- US3: T020, T021, T022, T023 all in parallel.
- Phase 6: T027, T028 and T029 in parallel.

---

## Parallel Example: User Story 3

```bash
# All four US3 test tasks touch different files — launch together:
Task: "Unauthorized / archived / not-found update integration tests in apps/api/tests/integration/weighing_areas.spec.ts"
Task: "Archived + not-found unit tests for UpdateWeighingAreaUseCase in apps/api/tests/unit/weighing_areas/weighing_area_use_cases.spec.ts"
Task: "Entry-point and refusal permission tests in apps/web/src/features/weighing-areas/__tests__/update/permissions.test.tsx"
Task: "Cross-kind session-scoping tests in apps/web/src/features/weighing-areas/__tests__/update/session.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (T001) → Phase 2 (T002–T008).
2. Phase 3 (T009–T014).
3. **STOP and VALIDATE**: `quickstart.md` scenarios 1–9, 15 and 16.
4. At this point an administrator can correct a weighing area's name and position — the feature's
   whole reason for existing — with the server already refusing everything it should. US2 and US3
   make those refusals *legible and proven*, they do not make them *true*.

### Incremental Delivery

1. Setup + Foundational → form generalized, edit session generalized by kind, creation and dock
   editing both proven unregressed.
2. + US1 → demo the correction flow (MVP).
3. + US2 → refusals surface on the right field; six API test gaps closed.
4. + US3 → authorization, lifecycle, and session-scoping guards surfaced; four more API test gaps
   closed.
5. Polish → quickstart, accessibility, full suites.

### A note on the backend tasks

T015, T016, T020, and T021 test behavior that is **already implemented**. Write each test before
running it, and expect most to go GREEN on first run. A test that goes RED here has found a real
defect in the existing implementation — fix the implementation, do not soften the test to match it.

---

## Notes

- [P] tasks = different files, no dependencies.
- Verify tests fail before implementing, except where noted for the pre-existing backend behavior.
- Commit after each task or logical group; Conventional Commits, on `feat/204-update-weighing-area`.
- `contracts/checkpoint-edit-ui-state.md` supersedes #199's `dock-edit-ui-state.md`, but that file
  is **not** edited by this slice: Constitution Principle I revises a spec only when its own issue
  is selected. The supersession is recorded here and in `plan.md` instead.
- Three decisions in `research.md` were resolved without user confirmation and are worth re-raising
  at review: **D3** (extracting the edit session into a hook rather than generalizing it inline),
  **D9** (submit stays enabled when the form is pristine, because disabling it contradicts US1 AC7),
  and **D10** (a weighing area in use by a planned or active shift stays updatable, even though the
  same area would be un-archivable). Changing any of them is a spec change, not a task change.
