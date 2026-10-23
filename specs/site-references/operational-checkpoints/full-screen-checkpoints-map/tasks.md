# Tasks: Full-screen Checkpoints map

**Input**: Design documents from `specs/site-references/operational-checkpoints/full-screen-checkpoints-map/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/ui-state.md](./contracts/ui-state.md),
[quickstart.md](./quickstart.md)

**Tests**: Required. The constitution (IV) and `AGENTS.md` mandate TDD for observable behavior:
every story starts with failing feature tests written against `contracts/ui-state.md`, run through
the real router with MSW (`renderCheckpoints`, `mockDocks` in
`apps/web/src/features/checkpoints/__tests__/support/test-helpers.ts`) and the mocked map
(`__tests__/support/mock-checkpoint-map.tsx`). Pure helpers get Vitest unit tests that never render
React. Existing tests asserting the sheet, the filter dropdown or the map-cluster buttons are
migrated to the new names in the story that replaces them, never deleted without an equivalent.

**Organization**: Grouped by user story (spec numbering). All paths are relative to the repository
root. Run a story's tests with
`pnpm --filter @portflow/web test -- <path>`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: User story label (US1–US7) for story phases only

## Path Conventions

- Web app: `apps/web/src/` — shared map primitives in `components/resource-map/`, shared lifecycle
  in `components/lifecycle/`, feature slices in `features/checkpoints/`, `features/docks/`,
  `features/weighing-areas/`
- No API (`apps/api`) change in this feature

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the baseline before changing a screen covered by many tests.

- [X] T001 Run `pnpm --filter @portflow/web test -- src/features/checkpoints src/features/docks src/features/weighing-areas src/components/resource-map` and `pnpm typecheck` on the branch tip and note any pre-existing failure in the PR description (no code change)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Resource-agnostic map primitives and test seams every story uses (research D1, D2,
D3, D10).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Write failing unit tests for the card placement helper in `apps/web/src/components/resource-map/__tests__/resource-map-anchor.test.ts`: places the card to the right of the anchor with a gap, flips left when it would overflow the right edge, clamps vertically and horizontally inside the container, returns a bottom-docked layout below the `md` breakpoint width, and returns the top-right fallback when the anchor is `null`
- [X] T003 [P] Implement the pure helper `computeResourceMapCardPlacement({ anchor, container, card, breakpoint })` in `apps/web/src/components/resource-map/resource-map-anchor.ts` until T002 passes
- [X] T004 [P] Write failing component tests in `apps/web/src/components/resource-map/__tests__/resource-map-card.test.tsx`: renders an `aside` (complementary) labelled by its level-2 heading, a "Close" button calling `onClose`, Escape calling `onClose`, focus moved to the heading on mount, and a fallback position when `anchor` is `null`
- [X] T005 Implement `ResourceMapCard` (props: `title`, `subtitle?`, `anchor`, `onClose?`, `children`, `footer?`) in `apps/web/src/components/resource-map/resource-map-card.tsx` using `resource-map-anchor.ts`, a `ResizeObserver` on the card and its container, and « Marine sobre » tokens only (popover surface, border, shadow) until T004 passes
- [X] T006 [P] Write failing component tests in `apps/web/src/components/resource-map/__tests__/resource-map-mode-banner.test.tsx`: renders the banner text in a `status` region and one action button with the given label calling `onAction`
- [X] T007 [P] Implement `ResourceMapModeBanner` (props: `children`, `actionLabel`, `onAction`) in `apps/web/src/components/resource-map/resource-map-mode-banner.tsx` until T006 passes
- [X] T008 [P] Implement `ResourceMapToolbar` (floating container that wraps on narrow widths) and `ResourceMapToggleGroup` (a `group` with an accessible name; each item a `button` with `aria-pressed`, label and count; the last pressed item is disabled) in `apps/web/src/components/resource-map/resource-map-toolbar.tsx`, with failing-first tests in `apps/web/src/components/resource-map/__tests__/resource-map-toolbar.test.tsx` covering pressed state, counts in the accessible name and the last-active guard
- [X] T009 Extend `ResourceMapWorkspace` in `apps/web/src/components/resource-map/resource-map-workspace.tsx` with optional slots `toolbar` (top-left, replaced by `banner` when a banner is given), `banner`, `card` and `overlay` (centred, for the no-match state), keeping `controls` and every existing state (map unavailable with `mapUnavailableActions`, source message with retry, empty message, legend) so `apps/web/src/features/warehouses/ui/warehouses-page.tsx` renders unchanged; run the warehouses tests to confirm
- [X] T010 Extend the map props in `apps/web/src/features/checkpoints/map/checkpoint-map.tsx` and its test double `apps/web/src/features/checkpoints/__tests__/support/mock-checkpoint-map.tsx` with `onAnchorChange?: (anchor: { x: number; y: number } | null) => void`, `anchorPoint?: LatLng`, `fitRequest?: { key: number; ids: string[] }` and `ghost?: { position: LatLng; label: string }`; in the real map report `map.project(anchorPoint)` on `load`, `move` and `resize` and `null` when absent; the mock records `fitRequest` in a `data-fit-request` attribute, renders the ghost as a labelled element, and always reports `null`

**Checkpoint**: Primitives tested in isolation; the checkpoints and warehouses suites still pass.

---

## Phase 3: User Story 1 - Find checkpoints on a full-screen map (Priority: P1) 🎯 MVP

**Goal**: Floating toolbar with type/status toggles and counts, legend, Fit all, search
suggestions, marker hiding and the no-match state (FR-001–FR-011; research D3, D4, D5, D10).

**Independent Test**: With seeded docks and weighing areas in both statuses, open `/checkpoints`
and verify toolbar counts, toggles and URL, legend, suggestions (pick and Enter), and the no-match
state without any mutation.

### Tests for User Story 1 ⚠️ write first, confirm they fail

- [X] T011 [P] [US1] Rewrite `apps/web/src/features/checkpoints/__tests__/ui/checkpoint-map-controls.test.tsx` as `apps/web/src/features/checkpoints/__tests__/ui/checkpoint-map-toolbar.test.tsx` (remove the old file): "Checkpoint types" group with "Docks <n>" and "Weighing areas <n>", "Filter by checkpoint status" group with "Available <n>" and "Archived <n>", `aria-pressed` reflecting the URL (`kinds`, `status`), toggling updates `kinds`/`status` in the router location, the last pressed toggle of each group is disabled, counts follow data-model.md (type counts within selected statuses, status counts within selected kinds)
- [X] T012 [P] [US1] Add `apps/web/src/features/checkpoints/__tests__/list/search.test.tsx`: typing "chef" opens the `listbox` "Matching checkpoints" with one `option` per match (name and kind text) and the footer "<n> of <total> available · Enter to zoom to all matches"; choosing an option sets `checkpointId` and closes the list; pressing Enter with no highlighted option sets the map's `data-fit-request` to the matching ids; only matching markers are rendered while searching; search is case- and accent-insensitive
- [X] T013 [P] [US1] Add `apps/web/src/features/checkpoints/__tests__/list/no-match.test.tsx`: a search matching nothing shows the status "No checkpoint matches “<search>”" with the scope explanation, "Clear search" empties `search`, "Include archived" sets `status=all` and is absent when Archived is already on
- [X] T014 [US1] Update `apps/web/src/features/checkpoints/__tests__/list/list.test.tsx` and `apps/web/src/features/checkpoints/__tests__/map/markers.test.tsx` to the new toolbar names (no filter dropdown, no "Showing:" badge), keep their legend, empty-state and weighing-area-error expectations, and add a "Fit all checkpoints" control expectation in `apps/web/src/features/checkpoints/__tests__/map/checkpoint-marker.test.tsx` only if it renders the real map controls (otherwise cover it in T019)

### Implementation for User Story 1

- [X] T015 [P] [US1] Add `searchCheckpoints(presented, search)` returning `{ matches, total }` to `apps/web/src/features/checkpoints/checkpoint-search.ts` with unit tests in `apps/web/src/features/checkpoints/__tests__/checkpoint-search.test.ts`; leave the shared `presentResources` and its `isSearchMatch` untouched for the warehouses map
- [X] T016 [P] [US1] Implement `ResourceMapSearch` on `@base-ui/react/autocomplete` in `apps/web/src/components/resource-map/resource-map-search.tsx` (props: `label`, `value`, `onValueChange`, `items` with `id`, `name`, `kindLabel`, `onPick(id)`, `onSubmitAll()`, `footer`), styled like `InputSearch`, highlighting the matched substring with `<mark>`, with component tests in `apps/web/src/components/resource-map/__tests__/resource-map-search.test.tsx` (keyboard navigation, pick, Enter without highlight calls `onSubmitAll`)
- [X] T017 [P] [US1] Implement `ResourceMapNoMatch` (props: `search`, `explanation`, `actions`) as a `status` region in `apps/web/src/components/resource-map/resource-map-no-match.tsx`
- [X] T018 [US1] Create `CheckpointMapToolbar` in `apps/web/src/features/checkpoints/ui/checkpoint-map-toolbar.tsx` composing `ResourceMapToolbar`, `ResourceMapSearch` and two `ResourceMapToggleGroup`s mapped to `kinds`/`status` per data-model.md, with `startActions`/`endActions` slots for the later Select and Create menus; delete `apps/web/src/features/checkpoints/ui/checkpoint-map-controls.tsx`
- [X] T019 [US1] In `apps/web/src/features/checkpoints/map/checkpoint-map.tsx` add a "Fit all checkpoints" `ControlButton` next to the zoom controls, honour `fitRequest` by fitting the bounds of the requested ids (reuse the `FitCheckpointBounds` logic, `maxZoom: 13`, `padding: 56`), and stop rendering the search dimming in `apps/web/src/features/checkpoints/map/checkpoint-marker.tsx` (non-matches are no longer passed in)
- [X] T020 [US1] Wire US1 in `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`: pass `toolbar={<CheckpointMapToolbar …/>}` instead of `controls`, compute counts per data-model.md, pass only `matches` to the map while searching, bump `fitRequest` on submit-all, set `checkpointId` on pick, render `ResourceMapNoMatch` through the workspace `overlay` slot, and keep the legend restricted to visible kinds; make T011–T014 pass

**Checkpoint**: US1 independently demonstrable; detail still opens in the old sheet until US2.

---

## Phase 4: User Story 2 - Inspect a checkpoint in an anchored card (Priority: P1)

**Goal**: Replace the detail sheet with an anchored card for docks, weighing areas and archived
checkpoints (FR-012–FR-017; research D1, D2).

**Independent Test**: Select a dock, a weighing area and an archived checkpoint; verify card content,
Copy coordinates, close paths, deep link and legacy link.

### Tests for User Story 2 ⚠️ write first, confirm they fail

- [X] T021 [P] [US2] Rewrite `apps/web/src/features/checkpoints/__tests__/details/details.test.tsx` against the card contract: complementary region named by the checkpoint name, subtitle "Dock · Available" / "Weighing area · Available" / "… · Archived", "GPS location" with 4-decimal "lat, lng", "Updated <date, time> · created <date, time>", "Edit" and "Archive" for available, the archived note "Archived on <date, time>. It can’t be selected for new discharges; past discharges keep it." and only "Reactivate" for archived, no "Discharges" section, and no admin actions for a non-administrator
- [X] T022 [P] [US2] Add close and clipboard cases to `apps/web/src/features/checkpoints/__tests__/details/details.test.tsx`: "Close" and Escape clear `checkpointId`; "Copy coordinates" writes "lat, lng" to `navigator.clipboard` (stubbed) and shows the toast "Coordinates copied"; changing a filter so the selected checkpoint is hidden closes the card
- [X] T023 [P] [US2] Update `apps/web/src/features/checkpoints/__tests__/details/legacy-param.test.tsx` to assert the card (not a `dialog`) opens for both `checkpointId` and the legacy `checkpoint` parameter

### Implementation for User Story 2

- [X] T024 [US2] Create `CheckpointDetailCard` in `apps/web/src/features/checkpoints/ui/checkpoint-detail-card.tsx` on `ResourceMapCard`: title, subtitle with kind and status indicator, GPS location with Copy coordinates (`navigator.clipboard.writeText`, toast "Coordinates copied"), lifecycle line (`formatDateTime` from `apps/web/src/helpers/dates`), archived note, footer with Edit (available only) and the kind's lifecycle actions (`DockLifecycleActions` / weighing-area equivalent) for administrators
- [X] T025 [US2] In `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx` replace `CheckpointSheet` in view mode with `CheckpointDetailCard` through the workspace `card` slot, pass `anchorPoint` (selected checkpoint) and store the reported anchor, clear `checkpointId` on close and when the selection is filtered out, and close on a click on empty map (new `onMapClick` prop on the map and its mock); make T021–T023 pass
- [X] T026 [US2] Remove `apps/web/src/features/docks/ui/dock-details.tsx` and `apps/web/src/features/weighing-areas/ui/weighing-area-details.tsx` if no longer imported after T025 (keep and adapt them instead if another screen still imports them)

**Checkpoint**: US1 + US2 form the MVP read experience.

---

## Phase 5: User Story 3 - Create a dock or a weighing area by placing it on the map (Priority: P2)

**Goal**: Toolbar Create menu, placement banner, creation card anchored to the pin (FR-018–FR-021;
research D6).

**Independent Test**: Create one dock and one weighing area through the menu; cancel another
placement; verify selection, toast and errors.

### Tests for User Story 3 ⚠️ write first, confirm they fail

- [X] T027 [P] [US3] Update `apps/web/src/features/checkpoints/__tests__/create/placement.test.tsx`: toolbar "Create" menu items "New dock" (description "Berth where trucks are loaded") and "New weighing area" (description "Weighbridge where trucks are weighed"); choosing one sets `create`, replaces the toolbar with the banner "Placing a new dock · click the map where trucks are loaded" / "Placing a new weighing area · click the weighbridge position" and "Cancel"; placing a pin shows the "New dock" card with its hint, required name, Latitude, Longitude, "Cancel" and "Create dock"
- [X] T028 [P] [US3] Update `apps/web/src/features/checkpoints/__tests__/create/exclusivity.test.tsx`: no Create or Select menu while placing, moving or selecting; switching creation kind discards the pin; Escape and both Cancel buttons leave placement with nothing created
- [X] T029 [P] [US3] Update `apps/web/src/features/docks/__tests__/create/create.test.tsx`, `validation.test.tsx`, `permissions.test.tsx` and the weighing-area equivalents in `apps/web/src/features/weighing-areas/__tests__/create/` to drive creation through the toolbar menu and the card (success selects the new checkpoint, widens `kinds` if it would hide it, toast from `resourceSuccessMessage`; API field errors stay on the card; non-administrators get no Create menu)

### Implementation for User Story 3

- [X] T030 [US3] Add a "Create" menu (Base UI menu via `apps/web/src/components/ui/dropdown-menu.tsx`, item label plus description line, kind icon) to the toolbar `endActions` from `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`, shown only to administrators in browse/view modes, and stop passing `createActions` to the map's control cluster (keep `ResourceMapCreateControl` itself, still used by `apps/web/src/features/warehouses/map/warehouse-map.tsx`, and keep `mapUnavailableActions`)
- [X] T031 [US3] Turn `apps/web/src/features/checkpoints/ui/create-checkpoint-panel.tsx` into the creation card body (heading, kind hint, `CheckpointResourceForm` fields, Cancel and Create <kind>) rendered in `ResourceMapCard` anchored to the pending pin, and render `ResourceMapModeBanner` with the placement copy in place of the toolbar from `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`; Escape cancels; make T027–T029 pass

**Checkpoint**: Creation works end to end in the V2 presentation.

---

## Phase 6: User Story 4 - Edit a checkpoint by moving it (Priority: P2)

**Goal**: Move mode with banner, ghost previous position and edit card (FR-022–FR-024; research D9).

**Independent Test**: Move and rename a dock and save; start another edit and cancel; verify the
origin is restored.

### Tests for User Story 4 ⚠️ write first, confirm they fail

- [X] T032 [P] [US4] Update `apps/web/src/features/docks/__tests__/update/update.test.tsx`, `placement.test.tsx`, `session.test.tsx`, `validation.test.tsx` and `permissions.test.tsx`: "Edit" on the card sets `edit=dock`, shows the banner "Drag the pin to move <name>" with "Cancel", the ghost "Previous position of <name>", and the "Edit dock" card with "Previous position <lat, lng>", name, Latitude, Longitude, "Cancel" and "Save changes"; save updates and returns to the card with a success toast; Cancel and Escape restore the origin without a request; a 404 ends move mode and clears the selection; no Edit on an archived dock
- [X] T033 [P] [US4] Apply the same updates to the weighing-area suites in `apps/web/src/features/weighing-areas/__tests__/update/` with "Edit weighing area" wording

### Implementation for User Story 4

- [X] T034 [US4] Render the ghost marker from the `ghost` prop in `apps/web/src/features/checkpoints/map/checkpoint-map.tsx` (non-interactive, muted kind icon, accessible label "Previous position of <name>") and pass the draft position as `anchorPoint` while moving
- [X] T035 [US4] Turn `apps/web/src/features/checkpoints/ui/edit-checkpoint-panel.tsx` into the edit card body (heading "Edit <kind>", "Previous position <lat, lng>", fields, Cancel restoring the origin via `use-checkpoint-edit-session.ts`, Save changes) rendered in `ResourceMapCard`, and show the move banner instead of the toolbar from `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`; delete `apps/web/src/features/checkpoints/ui/checkpoint-sheet.tsx` once nothing imports it; make T032–T033 pass

**Checkpoint**: No side sheet remains on the Checkpoints screen.

---

## Phase 7: User Story 5 - Archive and reactivate a checkpoint (Priority: P2)

**Goal**: V2 archive confirmation copy and "View" toast through opt-in lifecycle hooks
(FR-025–FR-029; research D8).

**Independent Test**: Archive a dock, follow View to its archived card, reactivate it; attempt to
archive an in-use dock and see the refusal.

### Tests for User Story 5 ⚠️ write first, confirm they fail

- [X] T036 [P] [US5] Update `apps/web/src/features/docks/__tests__/archive/individual.test.tsx`, `recovery.test.tsx` and `permissions.test.tsx`: alert dialog titled "Archive <name>?" with "The dock can no longer be selected for new discharges. Past discharges keep it. You can reactivate it later from Archived.", the optional comment field, "Cancel" and "Archive"; success closes dialog and card and shows the toast "<name> archived" with "Find it under Archived to reactivate it." and a "View" action that sets `status` to include archived and `checkpointId` to the dock; an in-use refusal keeps the dialog and comment and shows the API reason
- [X] T037 [P] [US5] Apply the same updates to `apps/web/src/features/weighing-areas/__tests__/archive/` with weighing-area wording, and update `apps/web/src/features/docks/__tests__/reactivate/` and `apps/web/src/features/weighing-areas/__tests__/reactivate/` to reactivate from the archived card
- [X] T038 [P] [US5] Confirm a resource without the new hooks keeps its copy: run the customers and warehouses archive suites (`apps/web/src/features/customers/__tests__/lifecycle/` and `apps/web/src/features/warehouses/__tests__/`) unchanged after T039

### Implementation for User Story 5

- [X] T039 [US5] Add optional `describeTitle?: (action) => string` and `successAction?: (action, result) => { label: string; onClick: () => void } | undefined` to `ResourceLifecycleConfig` in `apps/web/src/components/lifecycle/resource-lifecycle-actions.tsx`, used by `ResourceLifecycleDialog` for the title and as the `action` of `toast.success` (with a `description` when supplied via a new optional `describeSuccessDetail?`), defaults unchanged
- [X] T040 [US5] Supply the V2 hooks in `apps/web/src/features/docks/dock-lifecycle.tsx` and `apps/web/src/features/weighing-areas/weighing-area-lifecycle.tsx` (title "Archive <name>?", V2 effect copy, success "<name> archived" with "Find it under Archived to reactivate it.", "View" calling an `onView` passed from the card), and have `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx` implement `onView` by navigating to `status` including archived and `checkpointId=<id>`; make T036–T038 pass

**Checkpoint**: All individual lifecycle flows run in the V2 presentation.

---

## Phase 8: User Story 7 - Archive or reactivate several checkpoints at once (Priority: P3)

**Goal**: Keep bulk select mode, entered from a toolbar "Select" menu with a select banner
(FR-030–FR-030b; research D7).

**Independent Test**: Select docks, archive three (one in use), verify partial success; reactivate two
archived weighing areas together.

### Tests for User Story 7 ⚠️ write first, confirm they fail

- [X] T041 [P] [US7] Update the three `select-mode.test.tsx` files in `apps/web/src/features/checkpoints/__tests__/bulk-archive/`, `bulk-reactivate/` and `bulk-reactivate-weighing-areas/`: enter via the toolbar "Select" menu items "Select docks" / "Select weighing areas"; the banner "Selecting docks" / "Selecting weighing areas" with "Done" replaces the toolbar; "Done" (and Escape with nothing checked) clears `selecting`; shift-click still enters select mode; marker clicks never open a card while selecting
- [X] T042 [P] [US7] Run the unchanged `bulk-archive-actions`, `bulk-reactivate-actions`, `keyboard-shortcuts` and `resubmission` suites in the same folders and adjust only entry-point queries that referenced the removed map-cluster toggle

### Implementation for User Story 7

- [X] T043 [US7] Add the "Select" menu to the toolbar `startActions` (administrators, browse/view modes, only kinds currently visible), render `ResourceMapModeBanner` with "Done" while `selecting` is set, and remove the per-kind select toggles from the map control cluster in `apps/web/src/features/checkpoints/map/checkpoint-map.tsx` and `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`, leaving `BulkResourceLifecycleActions` unchanged; make T041–T042 pass

**Checkpoint**: Bulk lifecycle has no regression.

---

## Phase 9: User Story 6 - Use the screen in the light theme (Priority: P3)

**Goal**: Every new overlay follows the active theme with AA contrast (FR-031, FR-032; research
D11).

**Independent Test**: Switch to the light theme and walk through map, card, placement and archive
dialog; accessibility audit in both themes.

- [X] T044 [P] [US6] Audit `apps/web/src/components/resource-map/resource-map-card.tsx`, `resource-map-toolbar.tsx`, `resource-map-search.tsx`, `resource-map-mode-banner.tsx`, `resource-map-no-match.tsx` and `apps/web/src/features/checkpoints/ui/*.tsx` for hardcoded colors and replace them with tokens from `apps/web/src/styles/globals.css`
- [X] T045 [US6] Browser pass per `quickstart.md` steps 1, 3, 6, 8 and 9 in dark and light themes and at 390 px width (card docks to the bottom, toolbar wraps), plus an axe audit of the map, an open card, placement mode and the archive dialog with no serious or critical violation; fix findings in the files above

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T046 [P] Update the "Forms and UI" rules in `apps/web/AGENTS.md`: on the maps a record opens in a `ResourceMapCard` anchored to its map feature and modes use `ResourceMapModeBanner`; map filters are toolbar toggles (`ResourceMapToggleGroup`); directories keep the `Sheet` and tabs (research D12)
- [X] T047 [P] Remove dead code left by the migration (unused exports in `apps/web/src/features/checkpoints/types.ts`, the map-cluster select labels, `CheckpointSheet` remnants) and confirm `ResourceMapControls` and `ResourceMapCreateControl` are still used by warehouses before keeping them
- [X] T048 Leave a note in the shared session notes folder and in the PR description listing the new `components/resource-map/` primitives for #321, and draft the follow-up issue for the deferred "Discharges" card section (to be created by the operator)
- [X] T049 Run `pnpm check`, `pnpm typecheck` and `pnpm test` from the repository root; fix every failure
- [X] T050 Obtain a fresh read-only Claude Code review of the final diff (`/code-review` in a new session or a read-only review subagent) and resolve or justify every confirmed finding before marking the PR ready

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup; blocks every story.
- **US1 (Phase 3)**: after Foundational.
- **US2 (Phase 4)**: after Foundational; shares `checkpoints-page.tsx` with US1, so implement after
  US1 to avoid conflicting edits (tests T021–T023 can be written in parallel with US1).
- **US3, US4, US5 (Phases 5–7)**: after US2 (they open from or return to the card). US3 and US4
  both edit `checkpoints-page.tsx`; run them sequentially. US5 touches mostly lifecycle files and
  can overlap US3/US4 except T040's page wiring.
- **US7 (Phase 8)**: after US1 (toolbar slots); independent of US3–US5.
- **US6 (Phase 9)**: after all overlays exist (US1–US5, US7).
- **Polish (Phase 10)**: last.

### Within Each Story

Tests first and failing → helpers/primitives → feature components → page wiring → story suite
green → refactor.

### Parallel Opportunities

- Phase 2: T002/T003 (anchor), T004 (card tests), T006/T007 (banner), T008 (toolbar) are in
  different files.
- US1: T011, T012, T013 in parallel; T015, T016, T017 in parallel before T018–T020.
- US2–US5: all test tasks marked [P] can be written ahead while the previous story's
  implementation finishes.
- Docks and weighing-area suite updates (T029, T032/T033, T036/T037) split cleanly by folder.

## Parallel Example: User Story 1

```text
Task: "T011 Rewrite toolbar tests in apps/web/src/features/checkpoints/__tests__/ui/checkpoint-map-toolbar.test.tsx"
Task: "T012 Add search suggestion tests in apps/web/src/features/checkpoints/__tests__/list/search.test.tsx"
Task: "T013 Add no-match tests in apps/web/src/features/checkpoints/__tests__/list/no-match.test.tsx"

Task: "T015 searchCheckpoints in apps/web/src/features/checkpoints/checkpoint-search.ts"
Task: "T016 ResourceMapSearch in apps/web/src/components/resource-map/resource-map-search.tsx"
Task: "T017 ResourceMapNoMatch in apps/web/src/components/resource-map/resource-map-no-match.tsx"
```

## Implementation Strategy

### MVP First

1. Phases 1–2, then US1 and US2: the V2 map, toolbar, search and anchored detail card. Validate
   with quickstart steps 1–3. This is demonstrable but still uses the old creation/edit sheet, so
   do not merge it alone.

### Incremental Delivery (one PR)

2. US3 → US4 → US5 → US7 → US6, each ending with its story suite green, then Polish. The PR is
   opened as a Draft after US2 and marked ready only after T049–T050.

### Commits

One Conventional Commit per story phase, e.g. `feat(checkpoints): Find checkpoints from the V2
floating toolbar`, `feat(checkpoints): Inspect a checkpoint in an anchored card`.
