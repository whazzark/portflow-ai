# Tasks: Create a Weighing Area

**Input**: Design documents from `specs/site-references/operational-checkpoints/weighing-areas/create-a-weighing-area/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Observable business behavior follows RED → GREEN → REFACTOR (Constitution Principle IV).
Test tasks must be run and observed failing before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story so each story remains independently testable.
Per `plan.md`, this is a **frontend-only** feature — `apps/api`'s weighing-area create endpoint,
policy, validator, and tests already exist, are unmodified, and need no new required tasks (see
`contracts/weighing-area-create-api.md`'s requirement-mapping table). One small, recommended API
test is included in Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an
  incomplete task in the same phase.
- **[Story]**: Maps a task to its user story from `spec.md`.

## Phase 1: Setup

**Purpose**: Extend the checkpoints route's URL contract to carry the new create mode.

- [X] T001 Widen the `create` search param to `z.enum(['dock', 'weighing-area']).optional().catch(undefined)` in `apps/web/src/routes/_authenticated/checkpoints.tsx` (`contracts/weighing-area-creation-ui-state.md` §1)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract the shared coordinate-placement fields out of the dock form (so weighing-area
creation doesn't fork it), generalize the map test double to support either checkpoint kind, and
add the weighing-area create mutation.

**⚠️ CRITICAL**: No user story implementation starts until this phase is complete.

- [X] T002 Extract `useCoordinateFields`/`CoordinateField` out of `apps/web/src/features/docks/ui/dock-form.tsx` into a new, resource-agnostic `apps/web/src/components/resource-map/resource-placement-fields.tsx`, parameterized by an `idPrefix` string (not a `Dock`/`DockDto` type) for element ids, taking a `LatLng | null` pending value and an `onPendingChange` callback (`research.md` R7, `plan.md`'s "Reuse contract")
- [X] T003 [P] Add unit tests for the extracted primitive — parsing, range/NaN messages, touched-gating, two-way sync with an external pending value, and the decimal-typing-not-reset guard — in `apps/web/src/components/resource-map/__tests__/resource-placement-fields.test.tsx`
- [X] T004 Refactor `apps/web/src/features/docks/ui/dock-form.tsx` to consume `resource-placement-fields.tsx` instead of its local copy, with **no behavior change** — depends on T002; verified by the existing dock create tests passing unchanged
- [X] T005 [P] Generalize the placement affordances in `apps/web/src/features/checkpoints/__tests__/support/mock-checkpoint-map.tsx` from dock-specific wording (`"Simulate map click to place dock"`, `pending-dock-marker`, `"Pending dock at …"`) to kind-agnostic wording (`research.md` R8)
- [X] T006 Update the three test files that reference the old affordance wording — `apps/web/src/features/checkpoints/__tests__/create/placement.test.tsx`, `apps/web/src/features/docks/__tests__/create/create.test.tsx`, `apps/web/src/features/docks/__tests__/create/validation.test.tsx` — to match T005's renamed affordances, with no change to their dock assertions — depends on T005
- [X] T007 [P] Implement the weighing-area create mutation (`tuyauQuery.weighingAreas.store.mutationOptions()`) with weighing-area list query invalidation in `apps/web/src/features/weighing-areas/mutations/use-weighing-area-mutations.ts`, mirroring `use-dock-mutations.ts`

**Checkpoint**: The shared coordinate-fields primitive exists and is independently tested, dock
creation still passes its existing tests unchanged, the map test double supports either checkpoint
kind, and a typed weighing-area create mutation exists. User story implementation can now begin.

---

## Phase 3: User Story 1 - Place and Create a Valid Weighing Area (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator activates weighing-area creation, places a pending marker by
clicking (and optionally dragging) the map, names it, and confirms so the weighing area is created
as Available at the placed coordinates and appears immediately, selected.

**Independent Test**: Activate "New weighing area", click a point on the map, submit a unique name,
and verify the new weighing area appears on the map at the clicked coordinates with Available status
(spec.md, US1).

### Tests for User Story 1 (write and observe RED first)

- [X] T008 [P] [US1] Add a web test for the full happy path in `apps/web/src/features/weighing-areas/__tests__/create/create.test.tsx`: activating "New weighing area" arms placement (existing markers muted, both actions present as a dropdown per `ResourceMapCreateControl`), clicking the map drops a pending marker and populates the sheet's coordinate fields, dragging updates those fields, and place → name → submit → success toast → sheet shows the new weighing area's read-only detail at `checkpoint=weighing-area:<id>` with `create` cleared → area visible in the collection without a manual reload; include the filter-widening case (creating while `kinds=dock` and `status=archived` still selects and shows the new area) (`quickstart.md` scenarios 2, 4, 5, 10, 11)
- [X] T009 [US1] Add a web test for creation-flow exclusivity in `apps/web/src/features/checkpoints/__tests__/create/exclusivity.test.tsx`: with a pending weighing-area placement, selecting "New dock" discards it and arms dock placement instead (and the reverse), so at most one creation flow is ever active (`quickstart.md` scenario 12, spec FR-017)

### Implementation for User Story 1

- [X] T010 [US1] In `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`, replace the dock-only `isCreatingDock`/`pendingDockPlacement` state with a single `creationKind: 'DOCK' | 'WEIGHING_AREA' | null` (derived from `create` and `isAdministrator(user)`) and one `pendingPlacement`, reset whenever `creationKind` changes; add a "New weighing area" entry to the create-actions array (label, weighing-area checkpoint icon from `CheckpointKindIcon`); compute the `CheckpointMapPlacement` `label`/`icon` from `creationKind` (`contracts/weighing-area-creation-ui-state.md` §2–§3)
- [X] T011 [P] [US1] Implement `apps/web/src/features/weighing-areas/ui/weighing-area-form.tsx` (TanStack Form: name field, coordinate fields via `resource-placement-fields.tsx` with `idPrefix="weighing-area"`, submit button) mirroring `dock-form.tsx`'s structure
- [X] T012 [US1] Implement `apps/web/src/features/weighing-areas/ui/create-weighing-area-panel.tsx` (Sheet content wrapping `WeighingAreaForm`) mirroring `create-dock-panel.tsx` — depends on T011
- [X] T013 [US1] Wire `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx` to render `CreateWeighingAreaPanel` when `creationKind === 'WEIGHING_AREA'`, call the T007 mutation, and on success navigate (`replace: true`) to `checkpoint=WEIGHING_AREA:<new id>` with `create` cleared and `kinds`/`status` widened when they would hide the new area, mirroring `handleDockCreated` — depends on T010, T012
- [X] T014 [US1] Run the focused US1 tests and refactor the wiring without changing behavior

**Checkpoint**: User Story 1 is independently usable as the create-a-weighing-area MVP.

---

## Phase 4: User Story 2 - Reject Invalid or Duplicate Submissions (Priority: P2)

**Goal**: Submitting with no placed location, a blank name, an out-of-range coordinate, or a
duplicate name (against another weighing area, any status) is rejected with a clear, field-specific
(or blocking) message, and nothing entered or placed is lost. A duplicate dock name is **not**
rejected.

**Independent Test**: Attempt submission before placing a point, then with a blank name, then with a
name duplicating an existing weighing area; verify each is rejected with no weighing area created
and the pending placement/name preserved (spec.md, US2).

### Tests for User Story 2 (write and observe RED first)

- [X] T015 [US2] Add web tests in `apps/web/src/features/weighing-areas/__tests__/create/validation.test.tsx` covering: submission blocked with a clear message when no placement exists yet; a blank/whitespace-only name rejected inline on the name field; a duplicate name (differing only by case/whitespace) rejected inline via the `E_WEIGHING_AREA_NAME_CONFLICT` (409) path, tested against both an available and an archived fixture; a name matching an existing **dock** succeeding rather than being rejected; a manually-edited out-of-range or non-numeric coordinate rejected inline on the affected field; a network/server failure producing an error toast; and the entered name plus the pending marker's position surviving every rejection above (`quickstart.md` scenarios 3, 6, 7, 8, 9, 13)

### Implementation for User Story 2

- [X] T016 [US2] Add the Zod validation schema (name required/trimmed/≤255 chars; latitude −90..90; longitude −180..180) and the submit-blocked-without-placement guard to `apps/web/src/features/weighing-areas/ui/weighing-area-form.tsx`
- [X] T017 [US2] Special-case the `E_WEIGHING_AREA_NAME_CONFLICT` API error in `apps/web/src/features/weighing-areas/ui/weighing-area-form.tsx` to set an inline error on the `name` field (falling back to `applyValidationError` for `E_VALIDATION_ERROR`, and to a toast otherwise), per `contracts/weighing-area-creation-ui-state.md` §4
- [X] T018 [US2] Ensure a rejected submission never clears the pending placement marker and never navigates away, in `apps/web/src/features/weighing-areas/ui/weighing-area-form.tsx` and `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`
- [X] T019 [US2] Run the focused US2 tests and refactor validation/error handling without changing behavior

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Restrict Creation to Authorized Users (Priority: P3)

**Goal**: Users who are unauthenticated, inactive, or lack weighing-area management permission never
see the creation entry point and cannot place a marker or create a weighing area, even via a direct
URL.

**Independent Test**: As an unauthenticated visitor, an inactive user, and an active
non-administrator, verify the creation action is absent and any direct attempt is refused with
nothing created (spec.md, US3).

### Tests for User Story 3 (write and observe RED first)

- [X] T020 [US3] Add web tests in `apps/web/src/features/weighing-areas/__tests__/create/permissions.test.tsx` covering: the "New weighing area" action is absent for a non-administrator (reuse the `DOCK_OBSERVER` fixture — the underlying roles are generic, not dock-specific); and directly navigating to `/checkpoints?create=weighing-area` as a non-administrator does not arm placement mode or open the create sheet

### Implementation for User Story 3

- [X] T021 [US3] Confirm `creationKind` derivation in `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx` (from T010) gates both `create=dock` and `create=weighing-area` behind `isAdministrator(user)`, so a non-administrator's direct URL visit to either is inert (no placement mode, no sheet)
- [X] T022 [US3] Run the focused US3 tests; confirm (no backend code needed) that the existing 401/403 coverage for `POST /api/v1/weighing-areas` in `apps/api/tests/integration/weighing_areas.spec.ts` already satisfies FR-005 at the API boundary

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Close the one recommended backend gap, validate accessibility, integration, and
delivery quality across all three stories.

- [X] T023 [P] Add the recommended integration test — duplicate weighing-area name → `409`
      `E_WEIGHING_AREA_NAME_CONFLICT`, no second record persisted — to
      `apps/api/tests/integration/weighing_areas.spec.ts` (`contracts/weighing-area-create-api.md`
      "Recommended addition")
- [X] T024 [P] Review focus management on sheet open/close, the keyboard-only placement path
      (coordinate fields alone, without a map click), non-color-only pending-marker distinction, and
      accessible names/labels across `apps/web/src/features/weighing-areas/ui/` and
      `apps/web/src/features/checkpoints/`
- [X] T025 [P] Verify the generated Tuyau contract for `weighingAreas.store` matches
      `contracts/weighing-area-create-api.md` and required no regeneration
- [ ] T026 Execute the 13 end-to-end scenarios from
      `specs/site-references/operational-checkpoints/weighing-areas/create-a-weighing-area/quickstart.md`
      against `pnpm dev`
- [X] T027 Run `pnpm check`, `pnpm typecheck`, and `pnpm test`; resolve confirmed failures and record
      results in this file
- [X] T028 Obtain the constitution-required fresh read-only Codex review of the final diff and
      resolve or explicitly justify each confirmed finding
- [X] T029 Review `apps/web/src/components/resource-map/resource-placement-fields.tsx` for zero
      resource-specific coupling — no `Dock`/`WeighingArea` types, no resource-only naming/imports —
      confirming a future warehouse/warehouse-door creation feature could import and use it
      unmodified (`plan.md`'s "Reuse contract")

### Verification notes

- **T023** (2026-08-24): Added the recommended integration test to
  `apps/api/tests/integration/weighing_areas.spec.ts` pinning a duplicate weighing-area name
  (available *and* archived) to `409` `E_WEIGHING_AREA_NAME_CONFLICT` over HTTP, with the existing
  record count unchanged. Full API suite: 212/212 passing.
- **T024** (2026-08-24): Focus management and the pending-marker's non-color-only distinction are
  provided by shared, unmodified components — the `Sheet`/base-ui `Dialog` primitive (native focus
  trapping) and `PendingPlacementMarker` (pulsing-ring animation + always-visible text label, not
  color alone) — reused as-is for weighing areas via `CheckpointMap`'s existing `placement` prop.
  The keyboard-only placement path (typing both coordinates with no map click) is proven by a
  passing test (`weighing-areas/__tests__/create/create.test.tsx`). Accessible names/labels
  (`View weighing area <name> (<status>)`, `Weighing area name`, `Latitude`/`Longitude`) are
  verified indirectly by every test using `getByRole`/`getByLabelText`, which only pass when the
  correct ARIA roles and accessible names exist.
- **T025** (2026-08-24): Confirmed via `apps/api/.adonisjs/client/registry/schema.d.ts` —
  `weighing_areas.store` already exposes `POST /api/v1/weighing-areas` with `body` derived from
  `createWeighingAreaValidator` and the `422` validation-error shape documented in
  `contracts/weighing-area-create-api.md`. No client regeneration was required; `pnpm --filter
  @portflow/web typecheck` and all MSW-driven tests already exercise this typed contract.
- **T026**: Not executed against a live `pnpm dev` in this session, for the same reason recorded in
  `../../docks/create-a-dock/tasks.md`'s Phase 6 notes: `apps/api/.env` connects to the local
  Postgres instance at `127.0.0.1:5433` shared with sibling worktrees (`git worktree list` shows
  `feat-218-create-transport-company` alongside this one), and this session has no known
  administrator credentials for it; destructive reseeding (`migration:fresh --seed`) was rejected
  as unsafe against data other sessions may depend on. All 13 scenarios have automated-test
  equivalents one level below full-browser E2E: scenario 1 → `permissions.test.tsx`; 2 and 12
  (switching) → `create.test.tsx` and `checkpoints/__tests__/create/exclusivity.test.tsx`; 3, 6, 7,
  8 (partly), 9, 13 → `validation.test.tsx`; 4 and 5 → `create.test.tsx` and
  `resource-map/__tests__/resource-placement-fields.test.tsx` (decimal-typing and boundary cases);
  10 and 11 → `create.test.tsx`; cancellation (part of 12) is exercised implicitly by the unmodified
  `disablePointerDismissal`/`onClose` wiring already proven for docks. A human should run T026 for
  real-browser confirmation (map rendering, drag physics, focus order, and the two-action dropdown
  UX) before merge, per Constitution Principle VII.
- **T027** (2026-08-24): `pnpm check` (Biome) — clean, 557 files. `pnpm typecheck` — both
  `@portflow/api` and `@portflow/web` pass. `pnpm test` — `@portflow/api`: 212/212 passing;
  `@portflow/web`: 285/285 passing (269 pre-existing + 16 new across
  `resource-placement-fields.test.tsx`, `weighing-areas/__tests__/create/{create,validation,
  permissions}.test.tsx`, and `checkpoints/__tests__/create/exclusivity.test.tsx`).
- **T028** (2026-08-24): A fresh medium-effort `/code-review` of the final diff found one confirmed
  simplification finding, no correctness or reuse/efficiency issues:
  - **Simplification (fixed)**: the creation-flow-reset effect in `checkpoints-page.tsx` used a
    `previousCreationKind` ref with a manual not-equal comparison to satisfy Biome's
    `useExhaustiveDependencies` lint. The reviewer correctly noted this duplicates what
    `useEffect`'s dependency array already does — the effect only re-runs when `creationKind`
    actually changes, and calling `setPendingPlacement(null)` when it's already `null` (e.g. on
    mount) is a harmless no-op. Replaced the ref with a plain `useEffect(() => {
    setPendingPlacement(null) }, [creationKind])` plus a correctly-scoped
    `// biome-ignore lint/correctness/useExhaustiveDependencies` comment (the effect intentionally
    keys on `creationKind`'s identity without needing its value). Re-verified: `pnpm check` clean,
    `pnpm --filter @portflow/web typecheck` clean, full suite green (API 212/212, web 285/285 on a
    confirmed non-flaky rerun).
- **T029** (2026-08-24): `grep -in "dock\|weighing"` on
  `apps/web/src/components/resource-map/resource-placement-fields.tsx` returns zero matches — the
  module is fully resource-agnostic (its only type import is the generic `LatLng`).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational; delivers the MVP.
- **US2 (Phase 4)**: Depends on US1's form/sheet/mutation existing (adds validation branches to the
  same files); should remain independently testable once US1 lands.
- **US3 (Phase 5)**: Depends on US1's entry point and creation-kind wiring existing (adds the
  permission-gate verification around it — the gate itself is already part of T010).
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Write the listed observable tests first and confirm they fail for the expected missing behavior.
- Shared/foundational pieces before story-specific wiring.
- Story complete (its own tests green) before moving to the next priority.
- Changes sharing a file execute sequentially even when nearby tasks are marked parallel.

### Parallel Opportunities

- T003, T005, T007 can proceed in parallel in Phase 2 (different files, no interdependency); T004
  depends on T002, T006 depends on T005.
- T008 and T009 are independent RED tasks within US1 (different files).
- T011 can proceed in parallel with T010 (different files) before T012–T013 integrate them.
- T023, T024, and T025 can proceed in parallel in Polish.

## Parallel Example: Foundational Phase

```text
Task T003: Unit tests for resource-placement-fields.tsx in apps/web/src/components/resource-map/__tests__/resource-placement-fields.test.tsx
Task T005: Kind-agnostic placement affordances in apps/web/src/features/checkpoints/__tests__/support/mock-checkpoint-map.tsx
Task T007: Weighing-area create mutation in apps/web/src/features/weighing-areas/mutations/use-weighing-area-mutations.ts
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1) test-first.
3. Stop and validate: place a weighing area on the map and see it created as Available, selected.

### Incremental Delivery

1. Add validation/duplicate/blocking feedback through US2.
2. Add the authorization-gate verification through US3 (the gate itself lands with US1's T010).
3. Complete the recommended API test, accessibility, contract, quickstart, and repository-wide
   verification in Polish.

## Notes

- The API's create endpoint, authorization, validation, and uniqueness rule are pre-existing and
  unmodified; the only `apps/api` task is the recommended contract-pinning test (T023) — see
  `research.md` R1 and R9.
- T002/T004 extract and re-point dock creation onto a shared primitive without changing dock
  behavior; the existing dock create tests (updated only for wording by T006) are the regression
  guard for that extraction.
- `resource-placement-fields.tsx` is intentionally resource-agnostic (T002, checked by T029) so a
  future warehouse/warehouse-door creation feature can reuse it without rework — this feature only
  builds and exercises it for docks and weighing areas.
- Commit only logical groups and use the repository's Conventional Commit format.
