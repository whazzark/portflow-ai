---

description: "Task list for Browse and Filter the User List"
---

# Tasks: Browse and Filter the User List

**Input**: Design documents from
`/specs/user-administration/user-access-status-foundation/browse-and-filter-the-user-list/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV makes RED → GREEN → REFACTOR binding, and D10 fixes
the verification seams: Japa unit tests for the use case's scoping decision, Japa integration tests
for the endpoint's authorization matrix and payload shapes, Vitest feature tests rendering the real
router with MSW for the workbench. `apps/web/e2e` does not exist, so this slice adds no end-to-end
journey.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and
demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task serves (US1–US5)
- Exact file paths are given in every description

## Path Conventions

Web application monorepo — `apps/api/` (AdonisJS 7) and `apps/web/` (TanStack Start), per
plan.md's Structure Decision. Both mirror the delivered customers slice.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the ground this read-only slice stands on and create the module directories

- [X] T001 Confirm every column this feature reads already exists and no migration is required, checking `apps/api/database/schema.ts` and `apps/api/database/migrations/` against the field table in [data-model.md](./data-model.md)
- [X] T002 [P] Create the API slice and test directories `apps/api/app/users/list/`, `apps/api/tests/unit/users/consultation/`, and `apps/api/tests/integration/users/consultation/`
- [X] T003 [P] Create the web feature directories `apps/web/src/features/users/queries/`, `apps/web/src/features/users/__tests__/support/`, and the `list/`, `permissions/`, `filters/`, `record/`, `recovery/` test folders under `apps/web/src/features/users/__tests__/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The read plumbing every story needs — model relations, repository operations, the
projection, and the policy. No endpoint and no screen is exposed by this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Declare the five self-referential `belongsTo(() => User)` relations — `invitedBy`, `activatedBy`, `cancelledBy`, `deactivatedBy`, `reactivatedBy`, each on its `*ByUserId` foreign key and each nullable — in `apps/api/app/models/user.ts`, mirroring `Customer.archivedBy` / `Customer.reactivatedBy` (D5)
- [X] T005 [P] Add the `list()` and `listActive()` abstract signatures to `apps/api/app/users/shared/repositories/user_repository.ts`, leaving `create()` and `findByEmail()` untouched
- [X] T006 Implement `list()` preloading the five lifecycle relations and `listActive()` filtering on `accessStatus = 'ACTIVE'` without preloads in `apps/api/app/users/shared/repositories/lucid_user_repository.ts` (depends on T004, T005)
- [X] T007 [P] Add `toAdministration()` to `apps/api/app/users/shared/transformers/user_transformer.ts` projecting `id`, `firstName`, `lastName`, `email`, `role`, `accessStatus` plus the lifecycle block whose `*By` actors are `toSummary()` projections or `null`, leaving `toObject()` and `toSummary()` byte-for-byte unchanged (D3, depends on T004)
- [X] T008 [P] Create `apps/api/app/users/shared/user_policy.ts` with `list(user)` granting only viewers whose `accessStatus` is `ACTIVE` and whose role is `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN` (D1)
- [X] T009 [P] Add an `invited` state to `apps/api/database/factories/user_factory.ts` setting `invitedAt` and `invitedByUserId`, so lifecycle fixtures can express a recorded invitation with a responsible administrator

**Checkpoint**: the collection can be queried and projected in code, and the policy can answer *may
this viewer consult users* — nothing is reachable over HTTP or in the browser yet

---

## Phase 3: User Story 1 - Consult Every User of the Organization (Priority: P1) 🎯 MVP

**Goal**: An organization admin opens `/users` and sees every user of the organization, separated by
access status, each view carrying its own count, with the active view selected on arrival and a
specific empty state where a status has none.

**Independent Test**: Sign in as an organization admin with users in all four access statuses, open
Users, and verify each status view lists exactly its users with an accurate count, that active is
the default, and that a status with no user shows its own empty state while the other views stay
reachable.

### Tests for User Story 1 ⚠️

> Write these first and confirm they FAIL before implementing

- [X] T010 [P] [US1] Unit test in `apps/api/tests/unit/users/consultation/list.spec.ts`: `ListUsersUseCase` returns every user whatever their access status when the viewer is an `ORGANIZATION_ADMIN`, swapping `UserRepository` in the container as `tests/unit/customers/consultation/list.spec.ts` does
- [X] T011 [P] [US1] Integration test in `apps/api/tests/integration/users/consultation/list.spec.ts`: `GET /api/v1/users` as an organization admin returns `200` with users in all four access statuses, the lifecycle fields present, `invitedBy` resolved to `{ id, firstName, lastName }`, and no `password` and no token anywhere in the payload

### Implementation for User Story 1

- [X] T012 [US1] Create `apps/api/app/users/list/list_users_use_case.ts` taking the authenticated viewer and returning `UserRepository.list()` for an `ORGANIZATION_ADMIN`, with the scope decided from the viewer and never from request input (D1)
- [X] T013 [US1] Create `apps/api/app/controllers/users_controller.ts` with `index` authorizing through `bouncer.with(UserPolicy).authorize('list')`, calling the use case with `auth.user`, and serializing `UserTransformer.toAdministration()`, following `apps/api/app/controllers/customers_controller.ts`
- [X] T014 [US1] Register the `/users` group with `router.get('/', [controllers.Users, 'index']).as('index')` inside the `/api/v1` authenticated group in `apps/api/start/routes.ts`
- [X] T015 [US1] Run the API codegen so `.adonisjs/` exposes `users.index` in the Tuyau registry and the response type is importable from `@portflow/api/registry`
- [X] T016 [P] [US1] Create `apps/web/src/features/users/__tests__/support/fixtures.ts` with `API_BASE_URL`, session users for each role, and a user collection spanning all four access statuses and all four roles, including recorded and unrecorded lifecycle events
- [X] T017 [P] [US1] Create `apps/web/src/features/users/__tests__/support/test-helpers.ts` mocking `/api/v1/auth/me` and `/api/v1/users` through MSW and rendering the real router at `/users`, following `features/customers/__tests__/support/test-helpers.ts`
- [X] T018 [US1] Feature test in `apps/web/src/features/users/__tests__/list/list.test.tsx`: the active view is selected on arrival, each status tab carries a count matching its rows, no view shows a user of another status, each row exposes first name, last name, email, role, and access status, and a status with no user shows its own empty state while the other views stay reachable (depends on T016, T017)
- [X] T019 [P] [US1] Create `apps/web/src/features/users/types.ts` deriving `UserDto` from `Route.Response<'users.index'>['data'][number]`, without widening the two payload shapes the contract fixes (depends on T015)
- [X] T020 [P] [US1] Create `apps/web/src/features/users/queries/user-queries.ts` exposing `list: () => tuyauQuery.users.index.queryOptions({})` (depends on T015)
- [X] T021 [US1] Create the thin route `apps/web/src/routes/_authenticated/users.tsx` with the Zod search schema from [contracts/users-workbench.md](./contracts/users-workbench.md) — `search`, `status`, `role`, `sort`, `order`, `userId`, each with a `.catch(...)` default — the `userQueries.list()` loader, and the `Users` breadcrumb
- [X] T022 [US1] Create `apps/web/src/features/users/ui/users-page.tsx` with one tab per access status, each labelled with its count, `active` selected by default, and `User access status` as the tablist's accessible name
- [X] T023 [US1] Create `apps/web/src/features/users/ui/user-table.tsx` rendering name, email, role, and access status per row, with an accessible name naming the view (for example `Active users`) and a per-status empty state
- [X] T024 [US1] Create `apps/web/src/features/users/ui/users-pending.tsx` and wire it as the route's `pendingComponent` in `apps/web/src/routes/_authenticated/users.tsx`
- [X] T025 [US1] Give the existing `Administration → Users` sidebar item `href: '/users'` in `apps/web/src/components/layout/app-sidebar.tsx`, making the already-gated item navigable rather than adding an entry (D9)

**Checkpoint**: an organization admin browses the full collection by access status — the MVP is
demonstrable

---

## Phase 4: User Story 2 - Withhold User Information From Unauthorized Viewers (Priority: P1)

**Goal**: The API refuses user consultation to every viewer outside the two administrator roles,
restricts an operations admin to active users without any lifecycle event, and the workbench never
presents or counts what the API would refuse.

**Independent Test**: Request the collection as an organization admin, an operations admin, an
operations lead, an observer, an unauthenticated visitor, and a non-active user, verify each outcome
against the matrix in [contracts/get-users.md](./contracts/get-users.md), then verify the workbench
presents nothing the API would refuse.

### Tests for User Story 2 ⚠️

- [X] T026 [US2] Extend `apps/api/tests/unit/users/consultation/list.spec.ts`: `ListUsersUseCase` calls `listActive()` and returns only active users when the viewer is an `OPERATIONS_ADMIN` (same file as T010, so sequential)
- [X] T027 [US2] Extend `apps/api/tests/integration/users/consultation/list.spec.ts` with the full authorization matrix: `401` / `E_UNAUTHORIZED_ACCESS` unauthenticated, `403` / `E_AUTHORIZATION_FAILURE` for `OPERATIONS_LEAD` and for `OBSERVER`, and `200` for an operations admin whose entries are all `accessStatus: "ACTIVE"` and carry no lifecycle key at all — absent, not `null` (same file as T011, so sequential)
- [X] T028 [US2] Feature test in `apps/web/src/features/users/__tests__/permissions/permissions.test.tsx`: an operations admin sees no status tabs and nothing disclosing another access status, only the active collection with its count; a lead or an observer sees no `Administration` group in the sidebar and reaching `/users` directly surfaces the route's error state with no user information

### Implementation for User Story 2

- [X] T029 [US2] Add the operations-admin branch to `apps/api/app/users/list/list_users_use_case.ts`, returning `UserRepository.listActive()` so the restriction stays a use-case decision on the consultable set rather than a permission on the endpoint (D1)
- [X] T030 [US2] Parameterize `toAdministration()` in `apps/api/app/users/shared/transformers/user_transformer.ts` so the lifecycle block is omitted entirely — every key absent, not `null` — for a viewer who is not an organization admin (FR-006b, D4)
- [X] T031 [US2] Select the projection from the viewer's role in `apps/api/app/controllers/users_controller.ts` so an operations admin receives the identity block only (depends on T030)
- [X] T032 [US2] Derive the tab set from the viewer's role in `apps/web/src/features/users/ui/users-page.tsx` — four access-status tabs for an organization admin, none for an operations admin, whose active collection is presented directly with its count so no empty `Pending` or `Deactivated` tab discloses the shape of a collection they may not read (FR-009, D6)
- [X] T033 [US2] Create `apps/web/src/features/users/ui/users-error.tsx` over `ResourceCollectionError` and wire it as the route's `errorComponent` in `apps/web/src/routes/_authenticated/users.tsx`, so a `403` surfaces with no user information
- [X] T034 [US2] Confirm the `Administration` group in `apps/web/src/components/layout/app-sidebar.tsx` stays gated behind `isAdministrator(user)`, so leads and observers get no entry point (FR-015)

**Checkpoint**: the authorization matrix holds on both seams; US1 and US2 are both demonstrable

---

## Phase 5: User Story 3 - Find a Specific User (Priority: P2)

**Goal**: An administrator narrows the visible view by name, email, and role, sorts it, and clears
the filters, entirely over the collection already retrieved.

**Independent Test**: With a collection covering several roles and statuses, search fragments of
first name, last name, and email, combine the search with a role filter inside a status view, and
verify the visible records, the counts, the no-match state, and the return to the unfiltered view.

### Tests for User Story 3 ⚠️

- [X] T035 [US3] Feature test in `apps/web/src/features/users/__tests__/filters/filters.test.tsx`: a case-insensitive fragment of a first name, last name, or email narrows the current view without a new request; a role filter combines with the search and the view; a no-match result shows a state distinct from a status view that holds no user; clearing the filters restores the view; and switching status never leaves a user of the previous view visible
- [X] T036 [P] [US3] Unit test `apps/web/src/features/users/helpers/user-search.test.ts` covering the fragment match over the three fields, the role filter, and the comparators for the identity and role sorts

### Implementation for User Story 3

- [X] T037 [US3] Create `apps/web/src/features/users/helpers/user-search.ts` with the case-insensitive fragment match over `firstName`, `lastName`, and `email`, the role filter, and the sort over displayed identity and role, reusing `normalizeSearch` from `@/helpers/search` and `formatFullName` from `features/users/helpers/name.ts`
- [X] T038 [US3] Wire `InputSearch` and the role filter into `apps/web/src/features/users/ui/users-page.tsx`, both held in the URL search params and applied to the selected view without refetching (depends on T037)
- [X] T039 [US3] Apply the `sort` and `order` search params to the visible rows in `apps/web/src/features/users/ui/user-table.tsx`, sortable on name and role
- [X] T040 [US3] Add the no-match state and its clear-filters affordance to `apps/web/src/features/users/ui/user-table.tsx`, distinct from the per-status empty state delivered in T023 (same file as T039, so sequential)

**Checkpoint**: the collection is navigable at scale; US1–US3 all work independently

---

## Phase 6: User Story 4 - Inspect a User's Access Record (Priority: P2)

**Goal**: Opening a row opens a read-only access record — identity, role, current access status, and
the recorded lifecycle events oldest first with their dates and responsible administrators —
resolved from the collection already retrieved, with no write action anywhere.

**Independent Test**: Open users in each access status and verify the record shows identity, role,
status, and every recorded event with its date and responsible administrator, that unrecorded events
are absent rather than blank, that opening a user issues no further consultation request, and that
no write action is offered.

### Tests for User Story 4 ⚠️

- [X] T041 [US4] Feature test in `apps/web/src/features/users/__tests__/record/record.test.tsx`: opening a row shows identity, role, and access status; recorded events appear oldest first with their date and responsible administrator, including an event whose administrator was never recorded; unrecorded events are absent rather than blank or unknown; no further request to `/api/v1/users` is issued on open; no invitation, cancellation, deactivation, reactivation, role change, or identity change is offered; an operations admin's record carries no lifecycle block; and the record closes when its user leaves the visible view

### Implementation for User Story 4

- [X] T042 [P] [US4] Create `apps/web/src/features/users/ui/user-access-record.tsx` presenting first name, last name, email, role, and access status with `ResourceDetailField` from `@/components/resource-map/resource-details`
- [X] T043 [P] [US4] Create `apps/web/src/features/users/ui/user-access-history.tsx` presenting invitation, activation, cancellation, deactivation, and reactivation oldest first (D8) with `formatDateTime` and `formatFullName`, omitting every unrecorded event, keeping an event whose responsible administrator is absent, and rendering nothing when the payload carries no lifecycle block — its own component, not an extension of `components/lifecycle/lifecycle-copy.ts` (D7)
- [X] T044 [US4] Create `apps/web/src/features/users/ui/user-sheet.tsx` resolving the record by `userId` from the retrieved collection, with an explicit state when that id names no user of the visible view, following `features/customers/ui/customer-sheet.tsx` (depends on T042, T043)
- [X] T045 [US4] Open the sheet from a row in `apps/web/src/features/users/ui/user-table.tsx` and hold the opened `userId` in the URL
- [X] T046 [US4] Drop `userId` and close the record when it names no user of the currently visible view, and let an open record follow the refreshed collection, in `apps/web/src/features/users/ui/users-page.tsx`

**Checkpoint**: the lifecycle metadata GH-2 persisted is finally consultable; US1–US4 all work
independently

---

## Phase 7: User Story 5 - Recover From a Consultation Failure (Priority: P3)

**Goal**: A failed collection load is unmistakably a failure — never an empty collection or a zero
count — and is retryable without a new sign-in.

**Independent Test**: Make the collection unavailable, verify the failure is distinguishable from an
empty collection, restore availability, retry, and confirm the collection loads without signing in
again.

### Tests for User Story 5 ⚠️

- [X] T047 [US5] Feature test in `apps/web/src/features/users/__tests__/recovery/recovery.test.tsx`: a failed `/api/v1/users` load shows a failure message rather than an empty collection or a zero count, and retrying once the failure is resolved loads the latest collection without a new sign-in

### Implementation for User Story 5

- [X] T048 [US5] Extend `apps/web/src/features/users/ui/users-error.tsx` with the retry that refetches the collection, keeping the failure visibly distinct from the empty and no-match states (builds on T033)
- [X] T049 [US5] Pass the router's `reset` through to the error component in `apps/web/src/routes/_authenticated/users.tsx` so the retry requests the latest collection

**Checkpoint**: all five user stories are independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T050 [P] Verify the accessible names fixed by the contract across `apps/web/src/features/users/ui/` — the `User access status` tablist and the view-naming table label — and confirm keyboard reachability of the tabs, the filters, and the row that opens the record
- [X] T051 [P] Re-read the final diff against FR-016 and confirm no write action, no bulk selection, and no per-user endpoint was introduced anywhere in `apps/api/app/users/`, `apps/api/start/routes.ts`, and `apps/web/src/features/users/`
- [X] T052 Run the API verification section of [quickstart.md](./quickstart.md), including the manual `curl` check that no `password` and no token appears in the payload
- [ ] T053 Run the workbench walkthrough of [quickstart.md](./quickstart.md) for all three role classes — **not run**: skipped at the user's request; the Vitest feature tests cover every journey on this checklist against the real router — organization admin, operations admin, and lead/observer — plus the stop-the-API retry check
- [X] T054 Sanity-check SC-003 by loading a 200-user collection and confirming the selected view and its count present within 2 seconds
- [X] T055 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the repository root and resolve every finding before the PR is ready (Principle VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — starts immediately
- **Foundational (Phase 2)**: depends on Setup — BLOCKS every user story
- **US1 (Phase 3)**: depends on Foundational
- **US2 (Phase 4)**: depends on Foundational; its API tasks extend files US1 creates, so it follows US1 in practice
- **US3 (Phase 5)**: depends on Foundational and on US1's page and table
- **US4 (Phase 6)**: depends on Foundational and on US1's page and table
- **US5 (Phase 7)**: depends on US2's error component (T033)
- **Polish (Phase 8)**: depends on every story being complete

### User Story Dependencies

- **US1 (P1)**: the only story that stands entirely on its own — it creates the endpoint and the screen
- **US2 (P1)**: shares the use case, controller, transformer, page, and route files with US1; independently testable, not independently buildable
- **US3 (P2)**: independent of US2, US4, and US5 — touches the search helper, the page's filter controls, and the table's sorting and no-match state
- **US4 (P2)**: independent of US2, US3, and US5 — adds the sheet and its two record components
- **US5 (P3)**: enriches the error component US2 created; independent of US3 and US4

### Within Each User Story

- Tests are written and confirmed failing before the implementation that satisfies them
- API before web: the endpoint and the regenerated Tuyau registry gate every web type
- Model → repository → transformer → use case → controller → route
- Feature module before route wiring; the route stays thin

### Parallel Opportunities

- T002 and T003 run together
- T005, T008, and T009 run together; T006 and T007 run together once T004 lands
- T010 and T011 run together; T016 and T017 run together; T019 and T020 run together once T015 lands
- T036 runs alongside T035; T042 and T043 run together
- T050 and T051 run together
- Once Foundational and US1 land, US3 and US4 can be built in parallel by different developers — they touch disjoint files apart from `users-page.tsx` and `user-table.tsx`, which must be coordinated

---

## Parallel Example: User Story 1

```bash
# The two API tests, written together and confirmed failing:
Task: "Unit test ListUsersUseCase scoping in apps/api/tests/unit/users/consultation/list.spec.ts"
Task: "Integration test GET /api/v1/users in apps/api/tests/integration/users/consultation/list.spec.ts"

# The web test scaffolding, written together:
Task: "Create fixtures in apps/web/src/features/users/__tests__/support/fixtures.ts"
Task: "Create MSW helpers in apps/web/src/features/users/__tests__/support/test-helpers.ts"

# The two thin web modules, once the Tuyau registry carries users.index:
Task: "Create apps/web/src/features/users/types.ts"
Task: "Create apps/web/src/features/users/queries/user-queries.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — blocks everything
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: an organization admin browses every access status with correct counts and
   empty states
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → the read plumbing exists
2. US1 → the collection is consultable (MVP)
3. US2 → the authorization matrix holds on both seams — **ship no further without this**
4. US3 → the collection is navigable at scale
5. US4 → the access record is inspectable
6. US5 → failures are recoverable

US1 and US2 are both P1 and together form the shippable read: US1 without US2 would expose the
collection past its intended audience, so the two ship as one increment even though they are tested
independently.

### Parallel Team Strategy

1. Everyone lands Setup + Foundational
2. One developer takes US1 through US2 — they share the endpoint and page files
3. Once US1 lands, a second developer takes US3 and a third takes US4, coordinating on
   `users-page.tsx` and `user-table.tsx`
4. US5 follows US2's error component and is a short finishing task

---

## Notes

- This slice adds no migration, no table, and no column — every field read was persisted by GH-2
- `toObject()` is the session contract behind `/auth/me` and `/auth/login`; it must not change (D3)
- The absence of a lifecycle block is a legitimate payload state, never a loading state
- No per-user endpoint: the record is resolved from the retrieved collection (FR-006a, D2)
- Commit after each task or logical group, with Conventional Commits on the feature branch
- Stop at any checkpoint to validate the story independently
