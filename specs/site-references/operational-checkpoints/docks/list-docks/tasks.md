# Tasks: List Docks

**Input**: Design documents from `specs/site-references/operational-checkpoints/docks/list-docks/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Observable business behavior follows RED → GREEN → REFACTOR. Test tasks must be run and
observed failing before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story so each story remains independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an
  incomplete task in the same phase.
- **[Story]**: Maps a task to its user story from `spec.md`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the approved cartographic component and deployment configuration.

- [X] T001 Vendor the MapCN map registry component and its dependencies into `apps/web/src/components/ui/map.tsx`, `apps/web/package.json`, and `pnpm-lock.yaml`
- [X] T002 [P] Add validated light/dark MapLibre style configuration and build-time propagation in `apps/web/src/config/map.ts`, `apps/web/vite-env.d.ts`, `apps/web/.env.example`, `apps/web/.env.docker.example`, and `apps/web/Dockerfile`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the typed collection seam and test harness used by every story.

**⚠️ CRITICAL**: No user story implementation starts until this phase is complete.

- [X] T003 Create typed `docks.index` query options and dock DTO aliases in `apps/web/src/features/docks/queries/dock-queries.ts` and `apps/web/src/features/docks/types.ts`
- [X] T004 [P] Add representative available/archived dock fixtures, MSW handlers, route render helpers, and a jsdom-safe feature map test double under the dock fixtures and checkpoint test-support directories

**Checkpoint**: The complete collection can be loaded through a typed, testable web boundary.

---

## Phase 3: User Story 1 — Browse Available and Archived Docks (Priority: P1) 🎯 MVP

**Goal**: Authorized administrators can open `/checkpoints`, see all docks in the MapCN map, filter
the presentation by lifecycle status, and search by name with match emphasis instead of removal.

**Independent Test**: With one available and one archived dock, verify All is the default, each
status filter produces the expected map membership, search highlights normalized name matches
while muting nonmatches, and unauthorized users receive no dock data.

### Tests for User Story 1 (write and observe RED first)

- [X] T005 [P] [US1] Extend API integration tests for authorized complete-list ordering/full DTO fields and assert the removed item-detail route is unavailable in `apps/api/tests/integration/docks.spec.ts`
- [X] T006 [P] [US1] Add web behavior tests for authorization-aware navigation, All/Available/Archived parity, URL restoration, accessible overlay controls, case/diacritic search emphasis, zero-match clearing, and no search-driven viewport refit under `features/checkpoints/__tests__` and the authenticated-layout navigation tests

### Implementation for User Story 1

- [X] T007 [US1] Remove `docks.show` from `apps/api/start/routes.ts` and `apps/api/app/controllers/docks_controller.ts`, delete `apps/api/app/docks/show/get_dock_use_case.ts` and its obsolete unit coverage in `apps/api/tests/unit/docks/dock_use_cases.spec.ts`, then regenerate the Tuyau registry
- [X] T008 [P] [US1] Implement case/diacritic-insensitive checkpoint-name matching and status-first derived view helpers in `apps/web/src/features/checkpoints/checkpoint-search.ts`
- [X] T009 [P] [US1] Implement accessible dock markers with status, coordinates, match emphasis, and nonmatch muting in `apps/web/src/features/checkpoints/map/`
- [X] T010 [US1] Implement the MapCN checkpoint adapter with kind-specific glyphs, non-color-only match emphasis, stable viewport behavior, and stable typed marker identity under `apps/web/src/features/checkpoints/map/`
- [X] T011 [US1] Implement the absolute upper-left search and accessible radio-menu status controls with clear/no-match feedback in `features/checkpoints/ui/checkpoint-map-controls.tsx`
- [X] T012 [US1] Compose the dock collection adapter, URL-owned `status`/`search` state, status-specific empty copy, and responsive map layout in `features/checkpoints/ui/checkpoints-page.tsx`
- [X] T013 [US1] Add the validated `/checkpoints` route and authorized Checkpoints navigation, remove the former `/docks` page route, then regenerate `apps/web/src/routeTree.gen.ts`
- [X] T014 [US1] Run the focused API and web US1 tests and refactor the collection/search/filter implementation without changing behavior

**Checkpoint**: User Story 1 is independently usable as the list-docks MVP.

---

## Phase 4: User Story 2 — Inspect Dock Details (Priority: P2)

**Goal**: An accessible dock marker opens the exact read-only details, including
optional lifecycle history, without an item endpoint.

**Independent Test**: Select available and archived docks from markers, verify tooltip
and keyboard/pointer parity, exact collection-backed detail fields, lifecycle omission rules, and
safe clearing of stale or status-excluded selection.

### Tests for User Story 2 (write and observe RED first)

- [X] T015 [US2] Add tests for marker hover/focus, keyboard activation, collection-backed lifecycle detail, stale typed selections, and status-excluded selection clearing under `apps/web/src/features/checkpoints/__tests__/`

### Implementation for User Story 2

- [X] T016 [P] [US2] Implement read-only identifying, coordinate, status, timestamp, and optional lifecycle presentation in `apps/web/src/features/docks/ui/dock-details.tsx`
- [X] T017 [US2] Implement the controlled checkpoint sheet that dispatches dock selections to `DockDetails`
- [X] T018 [US2] Wire MapCN marker activation to URL-owned `checkpoint=dock:<id>`, clear invalid selections, and avoid fallback records
- [X] T019 [US2] Run the focused US2 tests and refactor detail selection without reintroducing `GET /api/v1/docks/:id`

**Checkpoint**: User Stories 1 and 2 work independently through the sole collection endpoint.

---

## Phase 5: User Story 3 — Understand Empty and Error States (Priority: P3)

**Goal**: Loading, empty filter, zero search match, collection error/retry, and degraded basemap
states are distinct and recoverable without losing accessible marker interaction.

**Independent Test**: Exercise delayed, empty, failing-then-successful collection responses and a
failed basemap style; verify the correct feedback and a working retry while markers/details remain
usable for map-only failure.

### Tests for User Story 3 (write and observe RED first)

- [X] T020 [US3] Add tests for pending-versus-empty, All and status-filter empty copy, collection failure/retry, search no-match distinction, and non-blocking basemap degradation in `features/checkpoints/__tests__/feedback/feedback.test.tsx`

### Implementation for User Story 3

- [X] T021 [P] [US3] Implement route pending feedback in `features/checkpoints/ui/checkpoints-pending.tsx`
- [X] T022 [P] [US3] Implement collection error feedback and router-reset retry in `features/checkpoints/ui/checkpoints-error.tsx`
- [X] T023 [US3] Implement filter-specific empty presentation and preserve zero-search-match context in the checkpoint page and controls
- [X] T024 [US3] Isolate basemap style failures as non-blocking feedback while preserving checkpoint detail interaction
- [X] T025 [US3] Run the focused US3 tests and refactor feedback state boundaries without conflating query and basemap failures

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate integration, accessibility, generated contracts, and delivery quality.

- [X] T026 [P] Verify generated Tuyau and TanStack contracts contain `docks.index` and `/checkpoints`, but no `docks.show` or `/docks` page route
- [X] T027 [P] Review responsive overlay placement, keyboard focus, accessible names, contrast, non-color-only matching, marker overlap fallback, and dark theme across `apps/web/src/features/checkpoints/`
- [X] T028 Execute the affected `/checkpoints` browser scenarios from `specs/site-references/operational-checkpoints/docks/list-docks/quickstart.md`
- [X] T029 Run `pnpm check`, `pnpm typecheck`, and `pnpm test`, resolve confirmed failures, and record any environment-only browser limitation in `specs/site-references/operational-checkpoints/docks/list-docks/tasks.md`
- [X] T030 Replace the titled layout with a full-area map, keep controls and empty feedback as overlays, and update the focused web tests and feature contract

## Phase 7: Checkpoint UI Boundary Refactor

**Purpose**: Align the page architecture with the durable Checkpoint interface category before
the independently delivered weighing-area list is integrated.

- [X] T031 Revise the approved UI contract and design artifacts for `/checkpoints`, typed resource selection, and resource-specific API boundaries
- [X] T032 Add and observe failing tests for the canonical route, removed `/docks` route, typed selection codec, generic checkpoint labels, and invalid-selection cleanup
- [X] T033 Implement the shared Checkpoint types, search/filter presentation, typed selection codec, kind-specific markers, layer visibility contract, and Dock DTO adapter
- [X] T034 Move page, map, controls, feedback, and sheet orchestration under `features/checkpoints`, retain Dock details/query ownership, and regenerate the route tree
- [X] T035 Run the focused checkpoint suite, Biome, web typecheck, build, and repository verification, then record results below

### Verification notes

- The Checkpoint refactor tests pass in reliable focused batches: 31 tests cover the typed codec,
  search/layer contract, marker variants, route/navigation removal, filters, selection/details,
  feedback, and retry behavior.
- `pnpm check`, repository `pnpm typecheck`, and the web production build pass after the refactor.
- The environment-backed API suite completes successfully. The combined `pnpm test` and the
  unscoped full web suite still do not terminate after their assertions because the known web test
  harness retains open handles; focused Checkpoint files return successful exit codes individually.
- `pnpm check`, `pnpm typecheck`, and `pnpm build` pass.
- The focused dock web files pass individually (17 tests), and the API suite passes (134 tests,
  including 16 dock integration tests) when the repository-required test environment variables
  are supplied.
- The unscoped root `pnpm test` cannot boot the API without those environment variables. With the
  variables supplied, the API suite passes; the concurrent full web run exposes pre-existing
  customer/layout timeouts and does not terminate reliably in this execution environment. The
  focused dock suite remains green.
- No configured browser runner is present in the repository, and this environment exposes no
  interactive browser harness. T028 was closed instead through a manual human browser review
  against `pnpm dev` (API + web) with seeded users and docks, following the scenarios in
  `quickstart.md`; the reviewer confirmed the journey.
- Local manual verification required two environment fixes not caused by this feature: the
  `1784700000000_create_transport_companies_table` migration was pending on the local database
  (`db:seed` failed until `migration:run` was re-run), and the API's local `WEB_ORIGIN` must match
  the web dev server's actual origin (`http://localhost:5173`), not the `:3000` shown in
  `apps/api/.env.example`, or the browser hits CORS errors.
- T029 verification on 2026-08-01: `pnpm check` and `pnpm typecheck` passed. The API suite
  completed successfully, and the web suite reached its assertions but did not terminate after
  81 seconds because the existing test harness retained open handles; the combined test process
  was stopped after confirming the same environment-only limitation documented above.

## Phase 8: Review Finding Hardening

**Purpose**: Preserve checkpoint interaction during basemap degradation, make overlapping markers
independently reachable, and align the filter/search controls with the accessible UI contract.

- [X] T036 [US3] Add RED/GREEN coverage for selectable markers and detail interaction when the basemap reports an error in `features/checkpoints/__tests__/feedback/feedback.test.tsx`
- [X] T037 [US1] Add deterministic marker offsets for identical or near-identical coordinates and cover the projection helper in `features/checkpoints/__tests__/map/checkpoint-marker-offset.test.ts`
- [X] T038 [US1] Replace the hand-rolled status menu with the shared accessible radio menu and add keyboard/focus/clear-search coverage in `features/checkpoints/__tests__/ui/checkpoint-map-controls.test.tsx`
- [X] T039 [P] Align `research.md`, `contracts/ui-state.md`, `quickstart.md`, and this task plan with the full-area map and degraded-marker behavior

Phase 8 verification on 2026-08-01: the focused hardening suite passed (10 tests across the
feedback, marker-offset, and map-controls files). `pnpm check`, `pnpm typecheck`, and
`git diff --check` also passed; the existing API and web build validations remain green from the
implementation run above.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational and delivers the MVP.
- **US2 (Phase 4)**: Depends on the US1 collection, marker, and map selection seams.
- **US3 (Phase 5)**: Depends on the US1 page/query state seams; its tests also protect US2 detail
  availability during map degradation.
- **Polish (Phase 6)**: Depends on all selected user stories.

### Within Each User Story

- Write the listed observable tests first and confirm they fail for the expected missing behavior.
- Implement the minimum behavior needed to make the focused tests pass.
- Refactor only after the focused suite is green.
- Changes sharing a file execute sequentially even when nearby tasks are marked parallel.

### Parallel Opportunities

- T002 can proceed alongside T001 once the expected style-variable names are fixed by the plan.
- T004 can proceed alongside T003 because it owns test support files rather than query code.
- T005 and T006 are independent RED tasks across API and web.
- T008 and T009 can proceed in parallel after their tests exist; T010–T013 then integrate them.
- T016 can proceed independently before T017–T018 wire selection.
- T021 and T022 can proceed in parallel after T020 establishes expected feedback.
- T026 and T027 can proceed in parallel before the end-to-end and repository-wide checks.

## Parallel Example: User Story 1

```text
Task T005: API list/detail-removal integration tests in apps/api/tests/integration/docks.spec.ts
Task T006: Web browse/filter/search tests in apps/web/src/features/docks/__tests__/ and layout tests

After RED:
Task T008: Pure derived-view/search helper in apps/web/src/features/docks/dock-search.ts
Task T009: Accessible dock marker presentation in apps/web/src/features/checkpoints/map/
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete US1 test-first.
3. Stop and validate the authorized All/Available/Archived plus highlighted-search journey.

### Incremental Delivery

1. Add exact collection-backed details and map activation through US2.
2. Add explicit loading, empty, retry, and degraded-map behavior through US3.
3. Complete generated-contract, accessibility, browser, and repository-wide verification.

## Notes

- MapCN is vendored through the shadcn-compatible registry; the feature owns its dock-specific
  adapter and never treats the map as authoritative state.
- Status filtering removes excluded docks. Search only annotates matches and mutes nonmatches.
- The selected dock is resolved from the currently loaded collection; no replacement detail route
  is introduced.
- Commit only logical groups and use the repository's Conventional Commit format.
