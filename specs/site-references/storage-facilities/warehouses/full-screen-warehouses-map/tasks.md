---
description: "Task list for the full-screen Warehouses map (#321)"
---

# Tasks: Full-Screen Warehouses Map

**Input**: Design documents from `specs/site-references/storage-facilities/warehouses/full-screen-warehouses-map/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/ui-contract.md](./contracts/ui-contract.md),
[quickstart.md](./quickstart.md)

**Tests**: Required. AGENTS.md and constitution IV mandate TDD: each test task is written first and
must fail (RED) before its implementation task (GREEN), then refactor. Unit tests never render React;
feature tests render through the real router with MSW and the mocked map
(`apps/web/src/features/warehouses/__tests__/support/`).

**Organization**: Grouped by user story (spec US1–US7). All paths are under `apps/web/src/` unless
stated otherwise. Existing tests that assert the `Sheet`, the filter dropdown, or the "Showing"
badge are migrated in the story that replaces them — never deleted without an equivalent.

**Coordination with #320**: Before starting Phase 2, check whether #320 has merged to `master`.
If it has, sync this branch with the base branch and **adopt** its `components/resource-map/`
primitives and `ResourceLifecycleConfig` members, skipping the "create" half of T015, T016, and T019–T024 and
keeping only the additive extensions. If not, create them to #320's planned API
(research R9) and let the second branch to merge reconcile.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: User story from spec.md (US1–US7)

---

## Phase 1: Setup

**Purpose**: Baseline before changing anything

- [ ] T001 Run `pnpm --filter @portflow/web test` and `pnpm typecheck` on the branch and record the baseline (all warehouse and door suites green) in the PR description draft
- [ ] T002 Check `origin/master` for #320's merge and, if merged, sync this worktree with the base branch (ccd `sync_with_base_branch`) and re-read `apps/web/src/components/resource-map/` before Phase 2

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure view models and shared map/lifecycle primitives every story composes.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

### Tests (RED first)

- [ ] T003 [P] Unit tests for `searchWarehousesAndDoors` (case/diacritic-insensitive, status scoping of warehouses and of doors through their warehouse, name ordering, `isEmpty`, blank text) and `describeDoorSummary` (`No doors`, `1 door`, `4 doors`, `2 doors · 1 archived`) in `features/warehouses/__tests__/warehouse-search.test.ts`
- [ ] T004 [P] Unit tests for `statusSelectionFromFilter` / `filterFromStatusSelection` (`available`/`archived`/`all` round trip, last pressed pill cannot be released) in `features/warehouses/__tests__/status-selection.test.ts`
- [ ] T005 [P] Unit tests for `footprintCentre` (square, L-shape centroid vs bounds centre, degenerate collinear fallback to vertex mean, 4-decimal formatting via `formatCoordinates`) in `features/warehouses/__tests__/footprint-centre.test.ts`
- [ ] T006 [P] Unit tests for the edit-history reducer (`move`/`insert`/`remove` push, `undo` pops and no-ops when empty, `restore` resets to origin, history bounded at 50, `movedCount` for moved/removed/inserted points) in `features/warehouses/__tests__/edit-history.test.ts`
- [ ] T007 [P] Unit tests for `resource-map-anchor.ts` placement (beside a point anchor, beside a rect anchor without overlapping it, flip side on overflow, clamp to map area, bottom dock below `md`, fixed top-right fallback with no anchor) in `components/resource-map/__tests__/resource-map-anchor.test.ts`
- [ ] T008 [P] Feature test proving `ResourceLifecycleDialog` keeps today's title and toast for a resource that does not set `describeTitle`, `successAction`, or `describeSuccessDetail`, and uses them when set, in `components/lifecycle/__tests__/resource-lifecycle-dialog.test.tsx`
- [ ] T009 [P] Feature test for `ResourceRowActions` `items`: entries render for a non-administrator row with no lifecycle action, and sit above `Edit`/lifecycle entries for an administrator, in `components/lifecycle/__tests__/resource-row-actions.test.tsx`
- [ ] T010 [P] Unit test for `copyText` (success toast with label; clipboard rejection or absence → failure toast, never a success) in `helpers/__tests__/copy-text.test.ts`

### Implementation (GREEN)

- [ ] T011 [P] Implement `searchWarehousesAndDoors` and `describeDoorSummary` in `features/warehouses/warehouse-search.ts` (reuse `normalizeResourceSearch`; keep `presentWarehouses`/`isSearchMatch` unchanged)
- [ ] T012 [P] Implement the status selection mapping in `features/warehouses/status-selection.ts`
- [ ] T013 [P] Implement `footprintCentre` and `formatCoordinates` in `features/warehouses/geometry/footprint-centre.ts`
- [ ] T014 [P] Implement the pure edit-history reducer in `features/warehouses/edit-history.ts`
- [ ] T015 [P] Create or adopt `components/resource-map/resource-map-anchor.ts` (#320 API) and add rect anchors (a point is a zero-size rect)
- [ ] T016 [P] Add optional `describeTitle`, `successAction`, and `describeSuccessDetail` to `ResourceLifecycleConfig` and use them in `ResourceLifecycleDialog` in `components/lifecycle/resource-lifecycle-actions.tsx`
- [ ] T017 [P] Add optional non-lifecycle `items` to `components/lifecycle/resource-row-actions.tsx`, rendering the trigger when only `items` exist
- [ ] T018 [P] Implement `copyText(text, label)` in `helpers/copy-text.ts` (sonner toasts, copy from `helpers/resource-copy` where a phrase exists)
- [ ] T019 Create or adopt `ResourceMapCard` (non-modal `aside` labelled by its heading, Close, Escape, focus to heading on open and back to a supplied return target on close, positioned by `resource-map-anchor.ts`) in `components/resource-map/resource-map-card.tsx`
- [ ] T020 [P] Create or adopt `ResourceMapToolbar` shell and its toggle group (`aria-pressed` buttons with counts, last pressed disabled) in `components/resource-map/resource-map-toolbar.tsx`
- [ ] T021 [P] Create or adopt `ResourceMapModeBanner` (`role="status"` text + `Cancel`) in `components/resource-map/resource-map-mode-banner.tsx`
- [ ] T022 [P] Create or adopt `ResourceMapNoMatch` (`role="status"`, message, action slot) in `components/resource-map/resource-map-no-match.tsx`
- [ ] T023 Create or adopt `ResourceMapSearch` on `@base-ui/react/autocomplete` and add grouped options (group heading with count) and a hint footer, keeping `InputSearch` styling, in `components/resource-map/resource-map-search.tsx`
- [ ] T024 Add the toolbar | banner, card, and no-match slots to `components/resource-map/resource-map-workspace.tsx`, keeping the map-unavailable, source-error, empty, and legend behavior; existing consumers (Checkpoints) unchanged
- [ ] T025 Add `onAnchorChange` (projected bounds of the selected outline, the outline being drawn or edited, or the door pin being placed or moved; recomputed on `move`/`resize`) and a `fitAllRequest` to `features/warehouses/map/warehouse-map.tsx`, and mirror the props (anchor reported as `undefined`) in `features/warehouses/__tests__/support/mock-warehouse-map.tsx`

**Checkpoint**: Foundational unit/feature tests green; existing warehouse, door, and checkpoint suites still green.

---

## Phase 3: User Story 1 — Consult warehouses on a full-screen map (Priority: P1) 🎯 MVP

**Goal**: Full-screen map with floating toolbar (search field, Available/Archived pills with counts, `Create warehouse` for administrators), persistent legend, Zoom in/out/Fit all, and the anchored detail card replacing the `Sheet`.

**Independent Test**: As a non-administrator on a site with available and archived warehouses that have doors, open `/warehouses`; verify toolbar, pills, legend, controls, card content, door highlight, centre copy, close paths, and absence of every management action (spec US1).

### Tests (RED first)

- [ ] T026 [P] [US1] Feature tests for toolbar and pills (default `Available` pressed with counts, toggling writes `status`, both → `all`, last pill disabled, legend entries Warehouse/Door/Archived visible, `Zoom in`/`Zoom out`/`Fit all warehouses` present) in `features/warehouses/__tests__/consultation.test.tsx`
- [ ] T027 [P] [US1] Feature tests for the detail card (`region` named after the warehouse; `Warehouse · Available`; `<n> boundary points · centre <lat>, <lng>`; `Copy centre coordinates` toasts; door pills `Door status` with counts; door rows with coordinates; selecting a door sets `doorId`; `Updated … · created …`; Close and Escape clear `warehouseId` and return focus) in `features/warehouses/__tests__/warehouse-card.test.tsx`
- [ ] T028 [P] [US1] Feature tests for operator gating (no `Create warehouse`, `Create door`, `Edit`, `Archive`, `Reactivate`, door management entries — absent, not disabled) in `features/warehouses/__tests__/authorization.test.tsx`

### Implementation (GREEN)

- [ ] T029 [P] [US1] Create `WarehouseToolbar` (search field slot, status toggle group bound to `status` via `status-selection.ts`, `Create warehouse` for administrators, existing Select entry for bulk) in `features/warehouses/ui/warehouse-toolbar.tsx`
- [ ] T030 [P] [US1] Create `WarehouseCard` (header with name, kind, status, Close; footprint summary with centre via `footprintCentre` and `copyText`; doors section slot; timestamps; footer slot) in `features/warehouses/ui/warehouse-card.tsx`
- [ ] T031 [P] [US1] Restyle `features/warehouse-doors/ui/warehouse-doors-panel.tsx` as the card's Doors section: `Create door` beside the heading, door pills (`Door status`) bound to `doorStatus`, rows with name + coordinates + actions trigger, hint `Select a door to highlight its unloading point on the map.`, existing door bulk selection kept
- [ ] T032 [US1] Make `features/warehouses/map/warehouse-legend.tsx` always list Warehouse, Door, and Archived, and add the `Fit all warehouses` control in `features/warehouses/map/warehouse-map.tsx`
- [ ] T033 [US1] Replace the `Sheet` and `WarehouseMapControls` in `features/warehouses/ui/warehouses-page.tsx` with `WarehouseToolbar` + `ResourceMapCard`/`WarehouseCard` in the workspace slots; anchor from `onAnchorChange`; footer `Edit` + `WarehouseLifecycleActions` for administrators as today
- [ ] T034 [US1] Migrate existing suites that queried the sheet, the filter dropdown, or the "Showing" badge (`features/warehouses/__tests__/warehouses-page.test.tsx`, `select-mode.test.tsx`, `selection-scope.test.tsx`, `features/warehouse-doors/__tests__/consultation.test.tsx`, `markers.test.tsx`, and any other failing suite) to the card region and pills, keeping every assertion's intent

**Checkpoint**: US1 independently demonstrable; all pre-existing suites green.

---

## Phase 4: User Story 2 — Find a warehouse or door by name (Priority: P1)

**Goal**: Grouped search results across warehouses and doors, keyboard opening, and the no-match state.

**Independent Test**: Type part of a door name and a warehouse name, open a result with the keyboard, then type a non-matching name and use `Include archived` and `Clear search` (spec US2).

### Tests (RED first)

- [ ] T035 [P] [US2] Feature tests for grouped results (`Search results` listbox, `Warehouses`/`Doors` groups with counts, door summary, `In <warehouse>`, hint text, scoping by status, matching warehouses still emphasised on the map) and opening (Enter/click on a warehouse → `warehouseId`; on a door → `warehouseId`, `doorId`, `doorStatus`; Escape closes the popup keeping the text) in `features/warehouses/__tests__/search.test.tsx`
- [ ] T036 [P] [US2] Feature tests for the no-match state (message names the text; `Include archived` shown only when `status=available` and sets `status=all`; `Clear search` empties `search`) in `features/warehouses/__tests__/search-no-match.test.tsx`

### Implementation (GREEN)

- [ ] T037 [US2] Create `WarehouseSearch` composing `ResourceMapSearch` with `searchWarehousesAndDoors`, navigation on open, and the hint `Enter opens the highlighted result. Archived results appear when Archived is on.` in `features/warehouses/ui/warehouse-search.tsx`, and mount it in `WarehouseToolbar`
- [ ] T038 [US2] Render `ResourceMapNoMatch` with `No warehouse or door matches “<text>”`, the explanation, `Clear search`, and conditional `Include archived` from `features/warehouses/ui/warehouses-page.tsx`

**Checkpoint**: US1 + US2 green — the P1 MVP is complete.

---

## Phase 5: User Story 3 — Create a warehouse by drawing its outline (Priority: P2)

**Goal**: Draw mode with banner and `New warehouse` card.

**Independent Test**: As an administrator, start `Create warehouse`, place points, `Remove last point`, close the outline, name, create; repeat and cancel (spec US3).

- [ ] T039 [P] [US3] Feature tests: banner `Drawing a new warehouse · click the first point to close the outline` replaces the toolbar; `New warehouse` region with `Click the map to add corners.`, required name, `<n> points placed`, `Remove last point`, `Coordinates (advanced)`, `Close the outline to create the warehouse.` until closed; create selects the new warehouse with a success toast; banner/card `Cancel` and Escape create nothing; validation and server refusals keep the drawing — in `features/warehouses/__tests__/create/drawing.test.tsx` and `create/create.test.tsx` (migrate existing assertions)
- [ ] T040 [US3] Render the draw-mode `ResourceMapModeBanner` and host the panel in `ResourceMapCard` from `features/warehouses/ui/warehouses-page.tsx`; Escape cancels the mode
- [ ] T041 [US3] Restyle `features/warehouses/ui/create-warehouse-panel.tsx` as the `New warehouse` card body with the V2 copy, points counter, `Remove last point`, collapsible `Coordinates (advanced)`, and `Cancel`/`Create warehouse`

---

## Phase 6: User Story 4 — Edit a warehouse by moving its outline handles (Priority: P2)

**Goal**: Outline editing with handles, midpoints, dashed previous outline, Undo, and moved counter.

**Independent Test**: Edit an available warehouse, move a point, add a midpoint, `Undo`, rename, save; repeat and cancel; try leaving a door outside (spec US4).

- [ ] T042 [P] [US4] Feature tests: banner `Drag a point to reshape <name> · click a midpoint to add one`; `Edit warehouse` region with `Previous outline shown dashed.`, `<n> boundary points · <m> moved`, `Undo` reverting one change at a time, `Save changes` updating with a toast, cancel/Escape keeping the original, door-outside refusal keeping the edit — in `features/warehouses/__tests__/update/reshape.test.tsx`, `update/save.test.tsx`, `update/session.test.tsx` (migrate existing assertions)
- [ ] T043 [US4] Wire `edit-history.ts` into `features/warehouses/use-warehouse-edit-session.ts` (undo stack, `movedCount`; restore kept)
- [ ] T044 [US4] Restyle `features/warehouses/ui/edit-warehouse-panel.tsx` as the `Edit warehouse` card body with the counter, `Undo`, `Coordinates (advanced)`, `Cancel`/`Save changes`, and render its banner from `features/warehouses/ui/warehouses-page.tsx`

---

## Phase 7: User Story 5 — Manage doors by placement, menu, and move (Priority: P2)

**Goal**: Door placement and move modes with banners and cards; door menu with `Show on map` and `Copy coordinates`.

**Independent Test**: Create a door by clicking inside and dragging the pin, use each menu entry, move a door, and try outside positions (spec US5).

- [ ] T045 [P] [US5] Feature tests for placement: banner `Placing a new door · click inside <warehouse>`; `New door` region with `In <warehouse> · drag the pin to adjust.`, name, latitude, longitude; outside refusal; success toast and door listed — in `features/warehouse-doors/__tests__/create/placement.test.tsx` and `create/create.test.tsx` (migrate existing assertions)
- [ ] T046 [P] [US5] Feature tests for the door menu (`Actions for <door>`: `Show on map` selects and highlights the door, `Copy coordinates` toasts, for everyone; `Edit`/`Archive` on available doors and `Reactivate` on archived ones for administrators; no management entry under an archived warehouse) in `features/warehouse-doors/__tests__/door-menu.test.tsx`
- [ ] T047 [P] [US5] Feature tests for move: banner `Drag the pin to move <door> · it must stay inside <warehouse>`; `Edit door` region with `Previous position <lat>, <lng>`; save toast; outside refusal — in `features/warehouse-doors/__tests__/update/reposition.test.tsx` and `update/entry.test.tsx` (migrate existing assertions)
- [ ] T048 [P] [US5] Pass `Show on map` and `Copy coordinates` as `items` in `features/warehouse-doors/ui/warehouse-door-row-actions.tsx` (with `onShowOnMap` from the page)
- [ ] T049 [P] [US5] Restyle `features/warehouse-doors/ui/create-warehouse-door-panel.tsx` as the `New door` card body with the V2 copy
- [ ] T050 [P] [US5] Restyle `features/warehouse-doors/ui/edit-warehouse-door-panel.tsx` as the `Edit door` card body with `Previous position`
- [ ] T051 [US5] Render the placement and move banners, host both door cards in `ResourceMapCard` (anchored to the pin), and implement `Show on map` (select door, fly to its point) in `features/warehouses/ui/warehouses-page.tsx`

---

## Phase 8: User Story 6 — Archive a warehouse and find it again (Priority: P2)

**Goal**: V2 archive dialog, toast with `View`, archived card with `Reactivate`.

**Independent Test**: Archive a warehouse with doors, check dialog copy, confirm, use `View`, reactivate; try one whose door is in use (spec US6).

- [ ] T052 [P] [US6] Unit tests for the V2 archive copy (`Archive <name>?`; effect sentence with 0/1/n available doors; toast detail `Its <n> doors are archived with it. Find it under Archived to reactivate it.` with singular/zero variants) in `features/warehouses/__tests__/warehouse-lifecycle.test.ts`
- [ ] T053 [P] [US6] Feature tests: dialog title and copy, optional comment kept, confirm archives, card closes, toast title/detail/`View` → `status=all` + `warehouseId` with the archived card (`Warehouse · Archived`, `Archived on <date, time>. It and its doors can’t be selected for new discharges; past discharges keep them.`, `Reactivate`; no `Edit`/`Archive`/`Create door`); IN_USE refusal unchanged; reactivation toast — in `features/warehouses/__tests__/archive.test.tsx`, `feedback-archive.test.tsx`, `reactivate.test.tsx`, `feedback-reactivate.test.tsx` (migrate existing assertions)
- [ ] T054 [US6] Set `describeTitle`, the V2 `describeEffect`, `describeSuccessDetail`, and `successAction` (`View`, via a navigate callback) in `features/warehouses/warehouse-lifecycle.tsx`
- [ ] T055 [US6] Render the archived state of `WarehouseCard` (archive time + consequence statement, `Reactivate` footer for administrators) in `features/warehouses/ui/warehouse-card.tsx`

---

## Phase 9: User Story 7 — Light theme and narrow viewports (Priority: P3)

**Goal**: Every overlay legible in light and dark themes; card docks at the bottom on narrow screens.

**Independent Test**: Switch theme on `/warehouses` across consultation, search, card, a mode, dialog, toast; repeat at 375 px (spec US7).

- [ ] T056 [P] [US7] Feature test: below `md` the card docks at the bottom and the toolbar wraps, every action reachable; a theme change keeps selection, filter, search, and mode — in `features/warehouses/__tests__/responsive-theme.test.tsx`
- [ ] T057 [US7] Audit `features/warehouses/ui/*`, `features/warehouse-doors/ui/*`, `features/warehouses/map/*`, and the new `components/resource-map/*` files for hardcoded colors; use « Marine sobre » tokens only (MapLibre paint keeps its light-palette steel blue) and fix contrast below 4.5:1

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T058 Delete `features/warehouses/ui/warehouse-map-controls.tsx` and `features/warehouses/ui/warehouse-details.tsx` once unused; delete `ResourceMapControls`/`ResourceMapCreateControl` only if no consumer remains (Checkpoints may still use them)
- [ ] T059 [P] Update the map rules in `apps/web/AGENTS.md` (maps: anchored `ResourceMapCard` instead of a `Sheet`; status filter as toggle pills instead of the dropdown), reconciling with #320's wording if already merged
- [ ] T060 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the repository root; fix every failure
- [ ] T061 Run the [quickstart.md](./quickstart.md) browser journeys (dark, light, 375 px, administrator and operator) and compare each state with its *Retenue* board; record results in the PR
- [ ] T062 Obtain a fresh read-only Claude Code review of the final diff (`/code-review` in a new session or a read-only subagent), resolve or justify every confirmed finding, then open/update the Draft PR linked to #321

---

## Dependencies & Execution Order

- **Phase 1** → **Phase 2** (T002 decides adopt vs create) → user stories.
- **US1 (Phase 3)** is the base layout for all stories: US2–US7 need T033 (page composed with toolbar, card, slots).
- **US2** depends on US1 only. **US3, US4, US5, US6** each depend on US1 and are independent of one another, but all edit `features/warehouses/ui/warehouses-page.tsx`, so their page-wiring tasks (T040, T044, T051, T038) run sequentially.
- **US7** after the stories whose overlays it audits.
- **Polish** last.

Within each story: test tasks (RED) → implementation (GREEN) → refactor; a migration task never removes an assertion without an equivalent.

## Parallel Opportunities

- Phase 2: T003–T010 together; then T011–T018 together; T019–T023 mostly parallel (T023 after T020 if the toolbar hosts it).
- US1: T026–T028 together; T029–T031 together.
- US5: T045–T047 together; T048–T050 together.
- After US1, test tasks of US3–US6 can be written in parallel; their page wiring is sequential.

### Example: Phase 2 tests

```text
T003 warehouse-search.test.ts   T004 status-selection.test.ts   T005 footprint-centre.test.ts
T006 edit-history.test.ts       T007 resource-map-anchor.test.ts T008 resource-lifecycle-dialog.test.tsx
T009 resource-row-actions.test.tsx  T010 copy-text.test.ts
```

## Implementation Strategy

- **MVP**: Phases 1–4 (US1 + US2, both P1): the full-screen consultation and search, with every
  existing management flow still reachable through the restyled card.
- **Increments**: US3 → US4 → US5 → US6 (any order after US1), then US7, each green and
  demonstrable before the next.
- **Commits**: one Conventional Commit per story at least (e.g. `feat(warehouses): …`), no
  attribution trailers.
