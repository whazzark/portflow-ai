# Tasks: Create a Dock

**Input**: Design documents from `specs/site-references/operational-checkpoints/docks/create-a-dock/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Observable business behavior follows RED → GREEN → REFACTOR (Constitution Principle IV).
Test tasks must be run and observed failing before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story so each story remains independently testable.
Per `plan.md`, this is a **frontend-only** feature — `apps/api`'s dock-create endpoint, policy,
validator, and tests already exist, are unmodified, and need no new tasks (see
`contracts/dock-create-api.md`'s requirement-mapping table).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an
  incomplete task in the same phase.
- **[Story]**: Maps a task to its user story from `spec.md`.

## Phase 1: Setup

**Purpose**: Extend the checkpoints route's URL contract to carry the new create mode.

- [X] T001 Add a `create` search param (`z.enum(['dock']).optional().catch(undefined)`) to the checkpoints search schema in `apps/web/src/routes/_authenticated/checkpoints.tsx`, independent of the existing `checkpoint` param (`contracts/dock-creation-ui-state.md`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared, resource-agnostic map-placement primitive and the dock create
mutation seam that every user story depends on.

**⚠️ CRITICAL**: No user story implementation starts until this phase is complete.

- [X] T002 [P] Implement `useResourceMapPlacement` (armed/disarmed state, click-to-set, drag-to-adjust; takes/returns plain `{ latitude, longitude }`, no `Dock`/`DockDto` types) and a `PendingPlacementMarker` component (purely visual props — icon/label as `children` or a render prop, no resource-kind parameter) on top of the existing `useMap()`/`MapMarker` primitives in `apps/web/src/components/resource-map/resource-map-placement.tsx`. Resource-agnostic by design so weighing-area, warehouse, and warehouse-door creation can consume it unmodified later; only docks consume it in this feature (`research.md`, `plan.md`'s "Reusability contract")
- [X] T003 [P] Add unit tests for the placement hook and marker (arm/disarm, click sets coordinates, drag updates coordinates, geographic anchoring across pan/zoom) in `apps/web/src/components/resource-map/__tests__/resource-map-placement.test.tsx`
- [X] T004 [P] Extend the jsdom-safe checkpoint map test double to simulate placement-mode map clicks and pending-marker drags in `apps/web/src/features/checkpoints/__tests__/support/mock-checkpoint-map.tsx`
- [X] T005 [P] Implement the dock create mutation (`tuyauQuery.docks.store.mutationOptions()`) with dock-collection query invalidation in `apps/web/src/features/docks/mutations/use-dock-mutations.ts`

**Checkpoint**: The shared, resource-agnostic placement primitive is implemented and independently
tested, the test harness can simulate map placement in jsdom, and a typed create mutation exists.
User story implementation can now begin.

---

## Phase 3: User Story 1 - Place and Create a Valid Dock (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator activates dock creation, places a pending marker by clicking
(and optionally dragging) the map, names it, and confirms so the dock is created as Available at
the placed coordinates and appears immediately.

**Independent Test**: Activate creation, click a point on the map, submit a unique name, and verify
the new dock appears on the map at the clicked coordinates with Available status (spec.md, US1).

### Tests for User Story 1 (write and observe RED first)

- [X] T006 [P] [US1] Add a web test that activating "New dock" arms placement mode (hint shown, existing markers not selectable), clicking the map drops a pending marker and populates the sheet's coordinate fields, and dragging the marker updates those fields, in `apps/web/src/features/checkpoints/__tests__/create/placement.test.tsx`
- [X] T007 [P] [US1] Add a web test for the full happy path: place → name → submit → success toast → sheet transitions to the new dock's read-only detail at `checkpoint=dock:<id>` with `create` cleared → dock visible in the collection without a manual reload, in `apps/web/src/features/docks/__tests__/create/create.test.tsx`

### Implementation for User Story 1

- [X] T008 [US1] Add a "New dock" action to `apps/web/src/features/checkpoints/ui/checkpoint-map-controls.tsx`, visible only when `isAdministrator(user)`, that sets `create=dock` on activation
- [X] T009 [US1] Arm `useResourceMapPlacement` in `apps/web/src/features/checkpoints/map/checkpoint-map.tsx` whenever `create=dock`: render the placement hint and `PendingPlacementMarker`, and suspend existing dock/weighing-area marker selection while armed
- [X] T010 [P] [US1] Implement `apps/web/src/features/docks/ui/dock-form.tsx` (TanStack Form: name field, latitude/longitude fields two-way synced with the pending placement, submit button) mirroring `customer-form.tsx`'s structure
- [X] T011 [US1] Implement `apps/web/src/features/docks/ui/create-dock-panel.tsx` (Sheet content wrapping `DockForm`) mirroring `create-customer-panel.tsx`
- [X] T012 [US1] Wire `apps/web/src/features/checkpoints/ui/checkpoint-sheet.tsx` to render `CreateDockPanel` when `create=dock`, and on successful creation navigate to `checkpoint=dock:<new id>` with `create` cleared so the sheet shows the new dock's read-only detail (mirrors `CustomerSheet`'s create→view transition)
- [X] T013 [US1] Wire `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx` to own the pending-placement state shared between the map and the sheet, and to invalidate the dock collection query on successful creation
- [X] T014 [US1] Run the focused US1 tests and refactor the placement/creation wiring without changing behavior

**Checkpoint**: User Story 1 is independently usable as the create-a-dock MVP.

---

## Phase 4: User Story 2 - Reject Invalid or Duplicate Submissions (Priority: P2)

**Goal**: Submitting with no placed location, a blank name, an out-of-range coordinate, or a
duplicate name is rejected with a clear, field-specific (or blocking) message, and nothing entered
or placed is lost.

**Independent Test**: Attempt submission before placing a point, then with a blank name, then with
a duplicate name; verify each is rejected with no dock created and the pending placement/name
preserved (spec.md, US2).

### Tests for User Story 2 (write and observe RED first)

- [X] T015 [US2] Add web tests in `apps/web/src/features/docks/__tests__/create/validation.test.tsx` covering: submission blocked with a clear message when no placement exists yet; a blank/whitespace-only name rejected inline on the name field; a duplicate name (differing only by case/whitespace, including against an archived fixture) rejected inline on the name field via the `E_DOCK_NAME_CONFLICT` (409) path; a manually-edited out-of-range or non-numeric coordinate rejected inline on the affected field; and the entered name plus the pending marker's position both surviving every rejection above

### Implementation for User Story 2

- [X] T016 [US2] Add the Zod validation schema (name required/trimmed/≤255 chars; latitude -90..90; longitude -180..180) and the submit-blocked-without-placement guard to `apps/web/src/features/docks/ui/dock-form.tsx`
- [X] T017 [US2] Special-case the `E_DOCK_NAME_CONFLICT` API error in `apps/web/src/features/docks/ui/dock-form.tsx` to set an inline error on the `name` field (falling back to `applyValidationError` for `E_VALIDATION_ERROR` as today), per `research.md`
- [X] T018 [US2] Ensure a rejected submission never clears the pending placement marker and never navigates away, in `apps/web/src/features/docks/ui/dock-form.tsx` and `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`
- [X] T019 [US2] Run the focused US2 tests and refactor validation/error handling without changing behavior

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Restrict Creation to Authorized Users (Priority: P3)

**Goal**: Users who are unauthenticated, inactive, or lack dock management permission never see the
creation entry point and cannot place a marker or create a dock, even via a direct URL.

**Independent Test**: As an unauthenticated visitor, an inactive user, and an active
non-administrator, verify the creation action is absent and any direct attempt is refused with
nothing created (spec.md, US3).

### Tests for User Story 3 (write and observe RED first)

- [X] T020 [US3] Add web tests in `apps/web/src/features/docks/__tests__/create/permissions.test.tsx` covering: the "New dock" action is absent for a non-administrator (`DOCK_OBSERVER` fixture from `apps/web/src/features/docks/__tests__/support/fixtures.ts`); and directly navigating to `/checkpoints?create=dock` as a non-administrator does not arm placement mode or open the create sheet

### Implementation for User Story 3

- [X] T021 [US3] Gate `create=dock` handling behind `isAdministrator(user)` in `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx` / `checkpoint-sheet.tsx`, so a non-administrator's direct URL visit is inert (no placement mode, no sheet)
- [X] T022 [US3] Run the focused US3 tests; confirm (no backend code needed) that the existing 401/403 coverage for `POST /api/v1/docks` in `apps/api/tests/integration/docks.spec.ts` already satisfies FR-005 at the API boundary

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate accessibility, integration, and delivery quality across all three stories.

- [X] T023 [P] Review focus management on sheet open/close, the keyboard-only placement path (coordinate fields alone, without a map click), non-color-only pending-marker distinction, and accessible names/labels across `apps/web/src/features/docks/ui/` and `apps/web/src/features/checkpoints/`
- [X] T024 [P] Verify the generated Tuyau contract for `docks.store` matches `contracts/dock-create-api.md` and required no regeneration
- [ ] T025 Execute the 12 end-to-end scenarios from `specs/site-references/operational-checkpoints/docks/create-a-dock/quickstart.md` against `pnpm dev`
- [X] T026 Run `pnpm check`, `pnpm typecheck`, and `pnpm test`; resolve confirmed failures and record results in this file
- [X] T027 Obtain the constitution-required fresh read-only Codex review of the final diff and resolve or explicitly justify each confirmed finding
- [X] T028 Review `apps/web/src/components/resource-map/resource-map-placement.tsx` for zero dock-specific coupling — no `Dock`/`DockDto` types, no dock-only naming/imports — confirming a future weighing-area/warehouse/warehouse-door creation feature could import and use it unmodified (`plan.md`'s "Reusability contract")

### Verification notes

- **T026** (2026-08-22): `pnpm typecheck` passes cleanly across `@portflow/api` and `@portflow/web`.
  `pnpm test` (root, `turbo run test`) passes and terminates cleanly: 244 web tests across 89 files,
  193 API tests. `pnpm check` (`biome check .`) reports exactly one finding, in `.specify/integration.json`
  (a spec-kit metadata file), pre-existing and unrelated to this feature — confirmed via
  `git status`/`git diff` showing it untouched by this branch's changes. All findings in files this
  feature touches were fixed (`biome check --write [--unsafe]`).
- **T027** (2026-08-22): A fresh medium-effort review of the diff found one confirmed correctness
  bug and one confirmed simplification opportunity (a third finding, about `apps/api/.env.example`,
  concerns a file this feature never touched — pre-existing on this branch before this session,
  confirmed via `git diff --staged` showing only a trailing-newline change; left alone as
  out-of-scope, not reverted without the user's direction). Both confirmed findings in this
  feature's own code were fixed:
  - **Correctness (fixed)**: the pending→text sync effect in `dock-form.tsx` compared the whole
    `pending` object by reference (`[pending]` dependency), so it re-ran and canonicalized a
    coordinate field's text on *every* keystroke that happened to parse — e.g. typing "48.10"
    character by character collapsed back to "48.1" (or worse, "48." got reset to "48" mid-entry,
    corrupting the next keystroke). Fixed by comparing the field's *currently parsed* value against
    the incoming `pending` value and only overwriting when they actually differ (functional
    `setState` updater, no longer needs `latitudeText`/`longitudeText` in the dependency array).
    Added a regression test (`placement.test.tsx`, "allows typing a decimal coordinate without it
    being reset mid-entry") that types "48.10" character-by-character and asserts the final value
    is preserved exactly.
  - **Simplification (fixed)**: `parseCoordinate` and `coordinateError` independently reimplemented
    the same trim/parse/range logic, risking drift. `coordinateError` now delegates to
    `parseCoordinate` for the valid case and only re-derives the specific failure reason.
  - Full suite re-run after the fix: `pnpm typecheck`, `pnpm check` (clean except the pre-existing
    unrelated finding above), and `pnpm test` (244 web / 193 API tests) all pass.
- **T025**: Not executed against a live `pnpm dev` in this session. The local Postgres instance at
  `127.0.0.1:5433` is reachable, but it is a shared dev database (this worktree is one of several
  sibling worktrees on the same machine per `git worktree`/sibling-directory evidence), and getting
  a logged-in administrator session with known fixtures would require either destructive reseeding
  (`migration:fresh --seed`, rejected as unsafe against a database other sessions may depend on) or
  already-known credentials this session does not have. The 12 scenarios are instead covered by the
  automated web test suite one level below full-browser E2E: `placement.test.tsx` (scenarios 2–5),
  `create.test.tsx` (scenarios 9 and 12 — including the keyboard-only path), `validation.test.tsx`
  (scenarios 3, 6, 7, 8), `permissions.test.tsx` and the API's existing integration tests (1, 11),
  and cancellation is exercised implicitly by the non-modal/`disablePointerDismissal` wiring (10).
  A human should run T025 for real-browser confirmation (map rendering, drag physics, focus order)
  before merge, per Constitution Principle VII (human review remains mandatory) — this mirrors the
  precedent already set in `../list-docks/tasks.md`'s Phase 6 verification notes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational; delivers the MVP.
- **US2 (Phase 4)**: Depends on US1's form/sheet/mutation existing (adds validation branches to
  the same files); should remain independently testable once US1 lands.
- **US3 (Phase 5)**: Depends on US1's entry point and create-mode wiring existing (adds the
  permission gate around it).
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Write the listed observable tests first and confirm they fail for the expected missing behavior.
- Shared/foundational pieces before story-specific wiring.
- Story complete (its own tests green) before moving to the next priority.
- Changes sharing a file execute sequentially even when nearby tasks are marked parallel.

### Parallel Opportunities

- T002, T003, T004, T005 can all proceed in parallel in Phase 2 (different files, no interdependency).
- T006 and T007 are independent RED tasks within US1.
- T010 can proceed in parallel with T008/T009 (different files) before T011–T013 integrate them.
- T023, T024, and T028 can proceed in parallel in Polish.

## Parallel Example: Foundational Phase

```text
Task T002: useResourceMapPlacement + PendingPlacementMarker in apps/web/src/components/resource-map/resource-map-placement.tsx
Task T003: Placement hook/marker unit tests in apps/web/src/components/resource-map/__tests__/resource-map-placement.test.tsx
Task T004: Placement-aware checkpoint map test double in apps/web/src/features/checkpoints/__tests__/support/mock-checkpoint-map.tsx
Task T005: Dock create mutation in apps/web/src/features/docks/mutations/use-dock-mutations.ts
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1) test-first.
3. Stop and validate: place a dock on the map and see it created as Available.

### Incremental Delivery

1. Add validation/duplicate/blocking feedback through US2.
2. Add the authorization gate around the entry point and direct-URL access through US3.
3. Complete accessibility, contract, quickstart, and repository-wide verification in Polish.

## Notes

- The API's create endpoint, authorization, validation, and uniqueness rule are pre-existing and
  unmodified; no `apps/api` tasks are needed (see `research.md`'s "Backend requires no new work").
- `useResourceMapPlacement`/`PendingPlacementMarker` are intentionally resource-agnostic (T002,
  checked by T028) so weighing-area, warehouse, and warehouse-door creation can reuse them without
  rework. Wiring them into those other resources' creation flows is out of scope for this feature
  (spec FR-016) and belongs to their own future issues — this feature only builds and exercises the
  mechanism, for docks.
- Commit only logical groups and use the repository's Conventional Commit format.
