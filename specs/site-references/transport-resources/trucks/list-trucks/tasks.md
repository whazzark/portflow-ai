# Tasks: List Trucks

**Input**: Design documents from `specs/site-references/transport-resources/trucks/list-trucks/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: Required by the Portflow constitution. Within every behavior phase, write an observable failing test, implement the minimum behavior, run it green, and refactor before advancing.

**Organization**: Tasks are grouped by user story so each increment remains demonstrable and testable. User Story 1 establishes the Docks/Weighing Areas-style complete and available read contracts plus the directory shell used by Stories 2 and 3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an incomplete task in the same batch.
- **[Story]**: Maps the task to a user story from spec.md.
- Every checklist item includes the exact repository file or directory it changes or validates.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the Truck module namespace without adding dependencies or generated-file edits.

- [X] T001 Add the `#trucks/*` API import alias for `./app/trucks/*.js` in `apps/api/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the persisted Truck entity and realistic fixtures required by every story.

**⚠️ CRITICAL**: Complete this phase before user-story work. T002 must fail before T003–T005 implement the tested persistence behavior.

- [X] T002 Write and run failing persistence tests for case-insensitive registration uniqueness, positive decimal capacity, required company relation, archived-at consistency, UUID assignment, and nullable lifecycle actors in `apps/api/tests/unit/trucks/consultation/list.spec.ts`
- [X] T003 Implement the Truck table, foreign keys, checks, and indexes in `apps/api/database/migrations/1784900000000_create_trucks_table.ts`
- [X] T004 Implement the typed Truck Lucid model, UUID assignment, status union, and company/archive/reactivation relations in `apps/api/app/models/truck.ts`
- [X] T005 Implement available, archived, and reactivated persisted fixtures in `apps/api/database/factories/truck_factory.ts`
- [X] T006 Add idempotent representative truck development data tied to current transport companies in `apps/api/database/seeders/07_truck_seeder.ts`

**Checkpoint**: Truck persistence is portable across PostgreSQL/SQLite and the foundational tests are green.

---

## Phase 3: User Story 1 - Browse Trucks by Lifecycle State (Priority: P1) 🎯 MVP

**Goal**: Let every active user open Trucks within Transport resources and consult available trucks with their current company, while only organization administrators and operations administrators can see archived trucks, controls, and counts.

**Independent Test**: Sign in as every active role with mixed lifecycle data and verify all receive available trucks once with registration/company/status context, only administrators receive archived trucks or archived aggregates, and unauthenticated/non-active access receives no truck data.

### Tests for User Story 1 — RED first

- [X] T007 [P] [US1] Extend the failing real-Lucid tests for complete `list()` and filtered `listAvailable()` retrieval, bounded company/actor preloads, case-folded registration ordering, UUID tie-breaking, and authoritative refresh in `apps/api/tests/unit/trucks/consultation/list.spec.ts`
- [X] T008 [P] [US1] Write failing HTTP contract tests for administrator-only `trucks.index`, all-active-role `trucks.available`, complete versus available results, `401`/`403` denials, exact nested DTO shape, empty results, and no item route in `apps/api/tests/integration/trucks/consultation/list.spec.ts`
- [X] T009 [P] [US1] Create all active-role sessions, mixed lifecycle Truck DTOs, and MSW/render helpers in `apps/web/src/features/trucks/__tests__/support/fixtures.ts` and `apps/web/src/features/trucks/__tests__/support/test-helpers.ts`
- [X] T010 [P] [US1] Write failing router-level tests for Companies defaulting, Trucks navigation for every active role, administrator `trucks.index` versus non-admin `trucks.available` selection, and non-admin archived-URL normalization without archived disclosure in `apps/web/src/features/transport-resources/__tests__/resource-navigation.test.tsx` and `apps/web/src/features/trucks/__tests__/access/authorization.test.tsx`
- [X] T011 [P] [US1] Write failing lifecycle tests for available visibility/counts across all roles, administrator-only archived tabs/counts, registration/company rows, zero-record tabs, read-only controls, and independent company/truck statuses in `apps/web/src/features/trucks/__tests__/list/lifecycle.test.tsx`

### Implementation for User Story 1 — GREEN then REFACTOR

- [X] T012 [US1] Implement abstract and Lucid `list()`/`listAvailable()` repository operations with deterministic ordering and bounded preloads in `apps/api/app/trucks/shared/repositories/truck_repository.ts` and `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`
- [X] T013 [P] [US1] Implement Docks/Weighing Areas-style policy methods with administrator-only `list` and all-active-role `listAvailable` authorization in `apps/api/app/trucks/shared/truck_policy.ts`
- [X] T014 [US1] Implement separate complete-list and available-list workflows in `apps/api/app/trucks/list/list_trucks_use_case.ts` and `apps/api/app/trucks/available/list_available_trucks_use_case.ts`
- [X] T015 [US1] Implement the Truck DTO, numeric capacity normalization, lifecycle actor summaries, and current company summary in `apps/api/app/trucks/shared/truck_transformer.ts` and `apps/api/app/transport_companies/shared/transport_company_transformer.ts`
- [X] T016 [US1] Wire repository injection, thin `index`/`available` controller actions, and named authenticated `GET /api/v1/trucks` plus `GET /api/v1/trucks/available` routes in `apps/api/providers/repositories_provider.ts`, `apps/api/app/controllers/trucks_controller.ts`, and `apps/api/start/routes.ts`
- [X] T017 [US1] Regenerate the typed boundaries after the API becomes green; do not hand-edit `apps/api/database/schema.ts`, `apps/api/.adonisjs/server/controllers.ts`, `apps/api/.adonisjs/server/policies.ts`, or `apps/api/.adonisjs/client/registry/`
- [X] T018 [US1] Add the inferred `trucks.index`/`trucks.available` response types and zero-stale-time query options in `apps/web/src/features/trucks/types.ts` and `apps/web/src/features/trucks/queries/truck-queries.ts`
- [X] T019 [US1] Extend URL validation/loading with `resource`, `truckStatus`, `truckSearch`, and `truckId`, loading `trucks.index` for administrators or `trucks.available` for other active roles and normalizing non-admin archived state to Available in `apps/web/src/routes/_authenticated/transport-resources.tsx`
- [X] T020 [US1] Compose accessible Companies/Trucks resource navigation for every active role and refactor the company screen into the aggregate shell in `apps/web/src/features/transport-resources/ui/transport-resources-page.tsx` and `apps/web/src/features/transport-companies/ui/transport-companies-page.tsx`
- [X] T021 [US1] Implement the read-only lifecycle workspace with all-role available counts/rows, administrator-only archived tabs/counts, registration/company rows, and zero-record states in `apps/web/src/features/trucks/ui/trucks-page.tsx`, `apps/web/src/features/trucks/ui/truck-overview.tsx`, `apps/web/src/features/trucks/ui/truck-section.tsx`, and `apps/web/src/features/trucks/ui/truck-list.tsx`
- [X] T022 [US1] Run the focused US1 tests and refactor while preserving public behavior using `apps/api/tests/unit/trucks/consultation/list.spec.ts`, `apps/api/tests/integration/trucks/consultation/list.spec.ts`, `apps/web/src/features/transport-resources/__tests__/resource-navigation.test.tsx`, and `apps/web/src/features/trucks/__tests__/list/lifecycle.test.tsx`

**Checkpoint**: User Story 1 is independently usable as the MVP: every active role can browse available trucks with current companies, administrators can additionally browse archived trucks, and no archived data is disclosed to other roles.

---

## Phase 4: User Story 2 - Find and Inspect a Truck (Priority: P2)

**Goal**: Let an active user search and inspect trucks within the lifecycle scope permitted to the user's role, retaining deterministic registration order and URL-restorable details.

**Independent Test**: With several trucks from multiple companies in each state, search using partial mixed-case/whitespace/diacritic input, verify matching and order, select available and archived rows, reload their URLs, and verify exact details plus stale-selection reconciliation.

### Tests for User Story 2 — RED first

- [X] T023 [P] [US2] Write failing pure normalization and registration/company matching tests in `apps/web/src/features/trucks/helpers/truck-search.test.ts`
- [X] T024 [P] [US2] Write failing router-level search, highlighting, lifecycle scoping, whitespace-only, registration ordering, and UUID tie-break tests in `apps/web/src/features/trucks/__tests__/list/search-and-sort.test.tsx`
- [X] T025 [P] [US2] Write failing detail tests for toggle selection, URL restore, lifecycle auto-alignment, stale identity clearing, optional model, formatted capacity, independent company status, and archive/reactivation context in `apps/web/src/features/trucks/__tests__/details/open.test.tsx`

### Implementation for User Story 2 — GREEN then REFACTOR

- [X] T026 [US2] Implement trimmed case/diacritic normalization and registration-or-company matching in `apps/web/src/features/trucks/helpers/truck-search.ts`
- [X] T027 [US2] Add the labeled search control, two-field highlighting, lifecycle-scoped filtering, and deterministic client ordering in `apps/web/src/features/trucks/ui/truck-section.tsx`, `apps/web/src/features/trucks/ui/truck-list.tsx`, and `apps/web/src/features/trucks/ui/trucks-page.tsx`
- [X] T028 [US2] Implement semantic read-only details, capacity/date/actor formatting, URL-backed toggle selection, lifecycle alignment, and stale-ID clearing in `apps/web/src/features/trucks/ui/truck-details.tsx` and `apps/web/src/features/trucks/ui/trucks-page.tsx`
- [X] T029 [US2] Run the focused US2 tests and refactor while preserving public behavior using `apps/web/src/features/trucks/helpers/truck-search.test.ts`, `apps/web/src/features/trucks/__tests__/list/search-and-sort.test.tsx`, and `apps/web/src/features/trucks/__tests__/details/open.test.tsx`

**Checkpoint**: User Story 2 is independently verifiable on top of the authoritative P1 collection; search and exact in-context inspection work through refresh and browser navigation.

---

## Phase 5: User Story 3 - Recover From Empty and Failed Consultation (Priority: P3)

**Goal**: Distinguish lifecycle-empty, search-no-match, loading, failed-load, and failed-refresh states, then recover the current authoritative truck/provider snapshot through retry.

**Independent Test**: Render a zero-record lifecycle, a populated lifecycle with no search match, an unresolved request, an initial failure, and a refresh failure; verify distinct feedback and prove Try again replaces stale data with the recovered current state.

### Tests for User Story 3 — RED first

- [X] T030 [P] [US3] Write failing router-level tests for lifecycle-empty, no-match, loading, initial-error, and failed-refresh states in `apps/web/src/features/trucks/__tests__/feedback/states.test.tsx`
- [X] T031 [P] [US3] Write failing retry tests for refetch recovery, stale snapshot suppression, and authoritative lifecycle/provider replacement in `apps/web/src/features/trucks/__tests__/feedback/retry.test.tsx`

### Implementation for User Story 3 — GREEN then REFACTOR

- [X] T032 [US3] Implement accessible truck pending and retryable destructive-error presentations in `apps/web/src/features/trucks/ui/trucks-pending.tsx` and `apps/web/src/features/trucks/ui/trucks-error.tsx`
- [X] T033 [US3] Integrate distinct empty/no-match copy, error-before-stale-data handling, retry/refetch, and recovered snapshot reconciliation in `apps/web/src/features/trucks/ui/truck-section.tsx`, `apps/web/src/features/trucks/ui/trucks-page.tsx`, and `apps/web/src/routes/_authenticated/transport-resources.tsx`
- [X] T034 [US3] Run the focused US3 tests and refactor while preserving public behavior using `apps/web/src/features/trucks/__tests__/feedback/states.test.tsx` and `apps/web/src/features/trucks/__tests__/feedback/retry.test.tsx`

**Checkpoint**: All three user stories are functional; every specified exceptional consultation state is understandable and retryable where applicable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Prove scale, preserve adjacent behavior, complete delivery gates, and verify the final implementation against the approved artifacts.

- [X] T035 [P] Add 1,000-truck real-repository acceptance cases that verify deterministic complete/available results and bounded provider/actor loading in `apps/api/tests/unit/trucks/consultation/scale.spec.ts`
- [X] T036 [P] Add a 1,000-truck router-level correctness case proving role-appropriate endpoint selection, lifecycle derivation, and search without per-keystroke HTTP requests in `apps/web/src/features/trucks/__tests__/list/scale.test.tsx`
- [X] T037 Run all focused automated and manual desktop/narrow-browser scenarios, including the two-second acceptance measurement, from `specs/site-references/transport-resources/trucks/list-trucks/quickstart.md`
- [X] T038 Run `pnpm check`, `pnpm typecheck`, and `pnpm test`, fixing only feature-related findings in `apps/api/`, `apps/web/`, and `specs/site-references/transport-resources/trucks/list-trucks/`
- [X] T039 Obtain a fresh read-only Codex review against `specs/site-references/transport-resources/trucks/list-trucks/spec.md` and resolve every confirmed finding in `apps/api/` and `apps/web/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: No dependencies; starts immediately.
- **Phase 2 — Foundational**: Depends on T001 and blocks all user stories.
- **Phase 3 — User Story 1**: Depends on the complete foundational phase and establishes the complete/available API contracts and web directory shell.
- **Phase 4 — User Story 2**: Depends on User Story 1's collection/query/shell; its tests and implementation are otherwise isolated to search, selection, and details.
- **Phase 5 — User Story 3**: Depends on User Story 1's query/shell and may run in parallel with User Story 2 after P1 is green.
- **Phase 6 — Polish**: Depends on all selected user stories; T035 and T036 may run in parallel before final validation.

### User Story Dependency Graph

```text
Setup → Foundation → US1 (MVP) ─┬→ US2
                                └→ US3
US2 + US3 → Polish and delivery gates
```

### Within Each User Story

1. Write every listed test and confirm it fails for the intended missing behavior.
2. Implement persistence/query behavior before HTTP adaptation.
3. Regenerate typed boundaries before consuming new API types in the web workspace.
4. Implement route/query composition before feature presentation.
5. Run the focused story suite green, refactor, and rerun before advancing.

### Parallel Opportunities

- T003/T004 are sequential because the model follows the migration/schema contract; T005/T006 follow the model/factory relationship.
- After Foundation, T008 and T009 can proceed in parallel with T007; T013 can proceed independently of repository implementation.
- After T009, T010 and T011 can be authored in parallel because they target separate test files.
- After the API contract is generated, T018 can proceed alongside backend wiring verification.
- In US2, T023, T024, and T025 target independent test seams and can run in parallel.
- US2 and US3 can run in parallel after US1, except for shared edits to `trucks-page.tsx` and `truck-section.tsx`, which must be coordinated or serialized.
- T035 and T036 are independent API/web scale checks.

---

## Parallel Examples

### User Story 1

```text
Task T008: Complete/available HTTP authorization and DTO contract tests in apps/api/tests/integration/trucks/consultation/list.spec.ts
Task T009: Web MSW/session/Truck DTO support in apps/web/src/features/trucks/__tests__/support/
Task T013: Truck authorization policy in apps/api/app/trucks/shared/truck_policy.ts
```

After T009:

```text
Task T010: Resource-navigation and access tests in apps/web/src/features/transport-resources/__tests__/ and apps/web/src/features/trucks/__tests__/access/
Task T011: Lifecycle browsing tests in apps/web/src/features/trucks/__tests__/list/lifecycle.test.tsx
```

### User Story 2

```text
Task T023: Pure search-helper tests in apps/web/src/features/trucks/helpers/truck-search.test.ts
Task T024: Search/sort feature tests in apps/web/src/features/trucks/__tests__/list/search-and-sort.test.tsx
Task T025: Detail/URL feature tests in apps/web/src/features/trucks/__tests__/details/open.test.tsx
```

### User Story 3

```text
Task T030: Feedback-state tests in apps/web/src/features/trucks/__tests__/feedback/states.test.tsx
Task T031: Retry/recovery tests in apps/web/src/features/trucks/__tests__/feedback/retry.test.tsx
Task T032: Pending/error components in apps/web/src/features/trucks/ui/
```

---

## Implementation Strategy

### MVP First — User Story 1

1. Complete Setup and Foundation.
2. Execute T007–T011 as RED tests.
3. Execute T012–T021 for the smallest complete API/web behavior.
4. Execute T022 and stop for independent MVP validation.
5. Demo all-role available browsing and administrator-only archived browsing before adding search, details, or recovery enhancements.

### Incremental Delivery

1. **Foundation**: Persist coherent truck references with portable constraints and fixtures.
2. **US1**: Ship split complete/available lifecycle browsing with current company context.
3. **US2**: Add normalized discovery and URL-restorable inspection without changing the API contracts.
4. **US3**: Add explicit exceptional states and recovery without changing the successful path.
5. **Polish**: Prove 1,000-record behavior, run repository gates/browser flows, and complete fresh review.

### Parallel Team Strategy

After US1 is green, one implementer may own US2 and another US3. They must coordinate the shared `trucks-page.tsx` and `truck-section.tsx` edits, while tests and leaf UI components remain independently parallelizable.

## Notes

- `[P]` tasks change independent files and can run concurrently only after their declared prerequisites.
- `[US1]`, `[US2]`, and `[US3]` provide direct traceability to the specification stories.
- Add `/api/v1/trucks/available` as the established lifecycle-filtered read contract, but do not add a truck selection control, assignment eligibility rules, pagination, a show endpoint, mutation actions, or a generic site-reference framework in issue #222.
- Preserve unrelated staged/user changes and never hand-edit generated schema, route-tree, controller/policy manifest, or Tuyau declaration files.
- Keep commits focused and use Conventional Commits when the implementation is later committed.

## Phase 7: Integrated Company/Truck Workspace

**Purpose**: Reframe the default transport-resources experience as a company-filtered truck workspace without changing the protected API contracts.

- [X] T040 [P] [US1] Add failing workspace tests for no default selection, company filtering, second-click deselection, contextual lifecycle counts, independent searches, and archived-role visibility in `apps/web/src/features/transport-resources/__tests__/integrated-workspace.test.tsx`
- [X] T041 [P] [US2] Add failing side-panel tests for company details, truck details, close behavior, and preserving the selected company/search context in `apps/web/src/features/transport-resources/__tests__/side-panels.test.tsx`
- [X] T042 [US1] Update the route default/loading composition to render the integrated workspace while preserving explicit legacy company URLs in `apps/web/src/routes/_authenticated/transport-resources.tsx` and `apps/web/src/features/transport-resources/ui/transport-resources-page.tsx`
- [X] T043 [US1] Implement the left transport-company directory with an optional selected filter, second-click deselection, company search, status badges, and a dedicated details action in `apps/web/src/features/transport-companies/ui/transport-company-list.tsx` and `apps/web/src/features/transport-resources/ui/transport-resources-workspace.tsx`
- [X] T044 [US1] Scope truck lifecycle collections, searches, counts, stale selections, and role-appropriate endpoint data to the optional selected company in `apps/web/src/features/trucks/ui/trucks-page.tsx`
- [X] T045 [US2] Implement controlled company and truck side panels while preserving URL-backed context and read-only details in `apps/web/src/features/transport-resources/ui/transport-resources-workspace.tsx` and `apps/web/src/features/trucks/ui/trucks-page.tsx`
- [X] T046 [P] [US1] Update existing route and company/truck fixtures and tests for the integrated default workspace while retaining explicit legacy company-screen coverage in `apps/web/src/features/transport-resources/__tests__/`, `apps/web/src/features/transport-companies/__tests__/`, and `apps/web/src/features/trucks/__tests__/support/`
- [X] T047 Run focused integrated-workspace and side-panel tests, then run the complete web suite and typecheck.
