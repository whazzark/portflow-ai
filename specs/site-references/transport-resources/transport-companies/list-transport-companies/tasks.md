# Tasks: List Transport Companies

**Input**: Design documents from `specs/site-references/transport-resources/transport-companies/list-transport-companies/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/http-api.md`, `quickstart.md`

**Tests**: Required by the approved plan and constitution. For observable behavior, add the failing test first, confirm the intended failure, implement the minimum behavior, then refactor with the focused suite green.

**Organization**: Tasks are grouped by user story so each priority can be implemented and validated as a coherent increment. Persistence and shared test seams live in the foundational phase because every story depends on them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and does not depend on an incomplete task
- **[Story]**: Maps the task to a user story from `spec.md`
- Every task names the exact file or directory it changes

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the new vertical slice and establish its source/test locations without adding feature behavior.

- [x] T001 Add the `#transport_companies/*` API import alias for the planned vertical slice in `apps/api/package.json`
- [x] T002 [P] Create shared transport-company HTTP fixtures and the authenticated router render helper in `apps/web/src/features/transport-companies/__tests__/support/fixtures.ts` and `apps/web/src/features/transport-companies/__tests__/support/test-helpers.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Provide the persisted lifecycle entity and shared boundaries required by every consultation story.

**⚠️ CRITICAL**: No user-story implementation begins until this phase is complete.

- [x] T003 Create the portable UUID transport-company table, lifecycle check constraint, nullable actor foreign keys, and status index in `apps/api/database/migrations/<timestamp>_create_transport_companies_table.ts`
- [x] T004 [P] Map transport-company fields, timestamps, `AVAILABLE`/`ARCHIVED` status, and archive/reactivation actor relations in `apps/api/app/models/transport_company.ts`
- [x] T005 [P] Add available, archived, and previously reactivated record traits for API tests in `apps/api/database/factories/transport_company_factory.ts`
- [x] T006 Define the read-only `list()` and `listAvailable()` persistence boundary in `apps/api/app/transport_companies/shared/repositories/transport_company_repository.ts`

**Checkpoint**: The schema, model, fixtures, and repository contract are ready for test-first story work.

---

## Phase 3: User Story 1 - Browse Companies by Lifecycle State (Priority: P1) 🎯 MVP

**Goal**: Every active authenticated role can consult the complete authoritative collection, switch between available and archived views with unfiltered counts, and use an API collection that excludes archived companies from operational selection.

**Independent Test**: Sign in as each active role with both lifecycle states persisted, open `/transport-resources`, verify available is selected by default with no company selected, switch to archived, confirm each tab's complete count and records, and verify unauthenticated/non-active requests disclose no data and the available-only endpoint never returns archived records.

### Tests for User Story 1 (write first and confirm RED)

- [x] T007 [P] [US1] Add use-case tests for complete and available-only consultation delegation in `apps/api/tests/unit/transport_companies/consultation/list.spec.ts` and `apps/api/tests/unit/transport_companies/consultation/available.spec.ts`
- [x] T008 [P] [US1] Add integration coverage for all active roles, unauthenticated/non-active denial, deterministic complete lifecycle ordering, actor summaries, empty results, and authoritative refreshes in `apps/api/tests/integration/transport_companies/consultation/list.spec.ts`
- [x] T009 [P] [US1] Add integration coverage proving the available endpoint returns only current `AVAILABLE` rows, orders name then UUID, and supports empty results in `apps/api/tests/integration/transport_companies/consultation/available.spec.ts`
- [x] T010 [P] [US1] Add router-level tests for default available view, archived switching, unfiltered counts, zero-record selectable tabs, URL restoration, and the absence of mutation controls in `apps/web/src/features/transport-companies/__tests__/list/lifecycle.test.tsx`
- [x] T011 [P] [US1] Add authenticated-layout navigation coverage for the Transport resources entry across active roles and responsive sidebar modes in `apps/web/src/components/layout/__tests__/authenticated-layout/transport-companies-navigation.test.tsx`

### Implementation for User Story 1

- [x] T012 [US1] Implement real Lucid complete and available-only queries with actor preloads and deterministic name/UUID ordering in `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts`
- [x] T013 [P] [US1] Implement the complete collection use case in `apps/api/app/transport_companies/list/list_transport_companies_use_case.ts`
- [x] T014 [P] [US1] Implement the selector-safe available collection use case in `apps/api/app/transport_companies/available/list_available_transport_companies_use_case.ts`
- [x] T015 [P] [US1] Authorize `list` and `listAvailable` for any active authenticated user in `apps/api/app/transport_companies/shared/transport_company_policy.ts`
- [x] T016 [P] [US1] Serialize stable identity, name, lifecycle status/context, nullable actor summaries, and timestamps in `apps/api/app/transport_companies/shared/transport_company_transformer.ts`
- [x] T017 [US1] Adapt the two read use cases through authorized controller actions in `apps/api/app/controllers/transport_companies_controller.ts`
- [x] T018 [US1] Register protected `GET /api/v1/transport-companies` and `/api/v1/transport-companies/available` routes before any parameterized transport-company routes in `apps/api/start/routes.ts`
- [x] T019 [P] [US1] Add transport-company response and lifecycle view types inferred from Tuyau in `apps/web/src/features/transport-companies/types.ts`
- [x] T020 [P] [US1] Define the complete-collection React Query options and cache key in `apps/web/src/features/transport-companies/queries/transport-company-queries.ts`
- [x] T021 [US1] Add the authenticated `/transport-resources` route with validated company status, search, selected-company, and independent lifecycle order URL state plus loader/pending/error boundaries, retaining `/transport-companies` as a state-preserving redirect
- [x] T022 [US1] Implement the read-only master-detail shell, default aggregate no-selection state, available/archived company tabs, unfiltered lifecycle counts, and URL-backed tab switching in `apps/web/src/features/transport-companies/ui/transport-companies-page.tsx`
- [x] T023 [US1] Render lifecycle-specific collections and preserve a selectable zero-record tab in `apps/web/src/features/transport-companies/ui/transport-company-section.tsx`
- [x] T024 [US1] Add the unified Transport resources link for every active role under Site references in `apps/web/src/components/layout/app-sidebar.tsx`
- [x] T025 [US1] Regenerate typed API/database and TanStack route artifacts through existing generators, updating `apps/api/database/schema.ts` and `apps/web/src/routeTree.gen.ts`

**Checkpoint**: User Story 1 is independently usable as the read-only consultation MVP, and the dedicated available endpoint protects future operational selectors.

---

## Phase 4: User Story 2 - Find and Inspect a Company (Priority: P2)

**Goal**: Users can search the selected lifecycle by normalized current name, independently order each lifecycle view by name, and inspect URL-addressable lifecycle details without leaving consultation.

**Independent Test**: With several companies in each state, search using partial mixed-case text with surrounding whitespace, toggle name order in both tabs and reload, then open available and archived companies and verify stable identity, current name, status, relevant lifecycle context, and graceful missing values.

### Tests for User Story 2 (write first and confirm RED)

- [x] T026 [P] [US2] Add unit coverage for trimmed, case-insensitive, diacritic-insensitive, name-only matching and whitespace-only input in `apps/web/src/features/transport-companies/helpers/transport-company-search.test.ts`
- [x] T027 [P] [US2] Add router-level tests for normalized selected-lifecycle search with matching-name highlighting, automatic deterministic name/UUID ordering, and the absence of a redundant list header or manual ordering control in `apps/web/src/features/transport-companies/__tests__/list/search-and-sort.test.tsx`
- [x] T028 [P] [US2] Add router-level master-detail tests for available reactivation context, archived archive context, nullable actors/comments, URL restoration, aggregate return, legacy-route redirection, and stale selected identity cleanup in `apps/web/src/features/transport-companies/__tests__/details/open.test.tsx`

### Implementation for User Story 2

- [x] T029 [US2] Implement trimmed, case-folded, diacritic-insensitive current-name matching in `apps/web/src/features/transport-companies/helpers/transport-company-search.ts`
- [x] T030 [US2] Implement automatic stable name ordering with UUID tie-breaking and keyboard-native toggle selection, showing identity/name per row while the active lifecycle tab supplies status context, in `apps/web/src/features/transport-companies/ui/transport-company-list.tsx`
- [x] T031 [US2] Apply selected-lifecycle search, distinguish no-match from empty data, and connect URL-backed selection in `apps/web/src/features/transport-companies/ui/transport-company-section.tsx`
- [x] T032 [P] [US2] Render identity, status, archive context, latest reactivation context, actor summaries, dates, and unavailable optional values in `apps/web/src/features/transport-companies/ui/transport-company-details.tsx`
- [x] T033 [US2] Implement the URL-controlled details panel and aggregate no-selection overview, clearing a selection when the selected row is clicked again or disappears from refreshed data
- [x] T034 [US2] Wire search, deterministic ordering, and in-context details selection into `apps/web/src/features/transport-companies/ui/transport-companies-page.tsx`

**Checkpoint**: User Story 2 can be tested independently against either lifecycle collection while preserving the consultation context.

---

## Phase 5: User Story 3 - Recover From Empty and Failed Consultation (Priority: P3)

**Goal**: Consultation clearly distinguishes loading, lifecycle-empty, search-no-match, and retrieval-failure states, and retry replaces stale lifecycle data with the recovered authoritative response.

**Independent Test**: Exercise an empty selected lifecycle, a non-empty lifecycle with no search matches, a delayed request, and a failed-then-successful request; verify distinct feedback and that retry displays the latest recovered lifecycle collection.

### Tests for User Story 3 (write first and confirm RED)

- [x] T035 [P] [US3] Add router-level loading, lifecycle-empty, and search-no-match feedback tests in `apps/web/src/features/transport-companies/__tests__/feedback/states.test.tsx`
- [x] T036 [P] [US3] Add router-level failure, retry, stale-data replacement, and recovery tests with MSW in `apps/web/src/features/transport-companies/__tests__/feedback/retry.test.tsx`

### Implementation for User Story 3

- [x] T037 [P] [US3] Implement route-level consultation loading feedback in `apps/web/src/features/transport-companies/ui/transport-companies-pending.tsx`
- [x] T038 [P] [US3] Implement understandable retrieval failure feedback and a router-aware retry action in `apps/web/src/features/transport-companies/ui/transport-companies-error.tsx`
- [x] T039 [US3] Finalize lifecycle-specific empty and normalized-search no-match messages in `apps/web/src/features/transport-companies/ui/transport-company-section.tsx`
- [x] T040 [US3] Ensure retry/refetch replaces stale snapshots and reconciles selected lifecycle/detail URL state in `apps/web/src/features/transport-companies/queries/transport-company-queries.ts` and `apps/web/src/features/transport-companies/ui/transport-companies-page.tsx`

**Checkpoint**: All three user stories are independently observable, testable, and recoverable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete representative data, verification, and delivery evidence across the finished slice.

- [x] T041 [P] Add representative available, archived, previously reactivated, and nullable-actor/comment development records in `apps/api/database/seeders/03_transport_company_seeder.ts`
- [x] T042 Run the focused API and web suites from `specs/site-references/transport-resources/transport-companies/list-transport-companies/quickstart.md`, resolving failures in the files owned by T007-T040
- [x] T043 Run `pnpm check`, `pnpm typecheck`, and `pnpm test`, resolving regressions in the files owned by this feature
- [ ] T044 Execute and record the desktop/mobile, observer/admin, unauthenticated/non-active, selector-safety, retry, and no-mutation browser checks from `specs/site-references/transport-resources/transport-companies/list-transport-companies/quickstart.md`
- [x] T045 Obtain a fresh read-only Codex review of the final diff and resolve or explicitly justify every confirmed finding in the pull-request handoff

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks every user story.
- **User Story 1 (Phase 3)**: Depends on Phase 2 and delivers the MVP API and consultation shell.
- **User Story 2 (Phase 4)**: Depends on the US1 collection, route, and page shell; its tests and behavior remain focused on finding and inspection.
- **User Story 3 (Phase 5)**: Depends on the US1 query/route and US2 selected-state reconciliation; its feedback scenarios remain independently testable.
- **Polish (Phase 6)**: Depends on every story selected for delivery.

### User Story Dependency Graph

```text
Setup → Foundation → US1 (MVP) → US2 → US3 → Polish
```

- **US1** establishes authoritative collection and selector-safe API contracts plus lifecycle browsing.
- **US2** consumes US1's collection and URL-backed page shell; it does not change API behavior.
- **US3** consumes the established query and selected-state behavior to expose failure and recovery states.

### Within Each User Story

- Write the story's tests first and confirm that they fail for the intended missing behavior.
- Complete persistence/use-case behavior before HTTP adaptation, and HTTP adaptation before web consumption.
- Complete query and route state before dependent page composition.
- Keep focused suites green while refactoring, then validate the story at its checkpoint.

### Parallel Opportunities

- T002 can proceed alongside T001.
- T004 and T005 can proceed after the migration shape is agreed while T006 establishes the repository boundary.
- US1 test tasks T007-T011 can be authored in parallel; implementation pairs T013/T014, T015/T016, and T019/T020 touch independent files.
- US2 test tasks T026-T028 can be authored in parallel, and T032 can proceed alongside the search/table work once the response type exists.
- US3 test tasks T035-T036 and boundary components T037-T038 touch independent files.
- T041 can proceed alongside final automated verification once the migration/model contract is stable.

---

## Parallel Examples

### User Story 1

```text
Task T007: API use-case tests
Task T008: Complete-collection integration tests
Task T009: Available-only integration tests
Task T010: Web lifecycle browsing tests
Task T011: Sidebar navigation tests
```

### User Story 2

```text
Task T026: Search helper unit tests
Task T027: Search and deterministic-order router tests
Task T028: Details-sheet router tests
```

### User Story 3

```text
Task T035: Loading/empty/no-match tests
Task T036: Failure/retry/stale-replacement tests
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Setup and Foundation.
2. Execute T007-T011 as RED tests.
3. Implement T012-T025 and keep the focused API/web suites green.
4. Stop at the US1 checkpoint and demonstrate lifecycle browsing plus available-only selector safety.

### Incremental Delivery

1. **US1**: Ship authoritative lifecycle browsing and safe operational reads.
2. **US2**: Add normalized finding, stable ordering, and in-context lifecycle inspection.
3. **US3**: Add explicit feedback and retry recovery.
4. Complete representative seeding, repository-wide verification, browser checks, and fresh review before marking the PR ready.

---

## Notes

- `[P]` means separate files and no dependency on an unfinished task; shared-file edits remain sequential.
- Generated `apps/api/database/schema.ts` and `apps/web/src/routeTree.gen.ts` must be refreshed through repository generators, not hand-edited.
- The feature remains read-only: do not add create, update, archive, reactivate, delete, bulk, import, or synchronization actions.
- Do not introduce tenant keys, pagination, a show endpoint, a duplicate-name constraint, new dependencies, or Playwright infrastructure in this issue.
- Archived records must never be sourced from the complete consultation endpoint for new operational selectors; use the dedicated available-only contract.
- Commit after a focused task or logical RED/GREEN/REFACTOR group using Conventional Commits.
