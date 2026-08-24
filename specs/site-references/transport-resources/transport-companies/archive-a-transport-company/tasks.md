---
description: "Task list for Archive a Transport Company (GH-220)"
---

# Tasks: Archive a Transport Company

**Input**: Design documents from `specs/site-references/transport-resources/transport-companies/archive-a-transport-company/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [quickstart.md](./quickstart.md)

**Tests**: Test tasks are **included and mandatory**. Constitution principle IV requires business behavior to follow RED → GREEN → REFACTOR, and plan.md commits to Japa API specs and router-level Vitest/MSW web specs as the primary seams.

**Organization**: Tasks are grouped by user story. US1 to US3 are independently deliverable increments; US4 (bulk) genuinely builds on all three and says so rather than pretending otherwise.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task serves (US1, US2, US3, US4)
- Every task names the exact file it touches

## Path Conventions

PNPM/Turbo monorepo with two workspaces: `apps/api/` (AdonisJS) and `apps/web/` (TanStack Start). Paths below are repository-relative and match the structure in plan.md.

**No migration is part of this slice.** `status`, `archived_at`, `archived_by_user_id`, and `archive_comment` already exist on `transport_companies`. If `apps/api/database/schema.ts` changes during this work, something else is out of date.

---

## Phase 1: Setup

**Purpose**: Establish a known-good baseline before changing shared files

- [X] T001 Confirm work is on branch `feat/220-archive-transport-company-2` and the working tree is clean
- [X] T002 Capture a green baseline by running `pnpm check`, `pnpm typecheck`, and `pnpm test`, so any later failure is attributable to this slice
- [X] T003 [P] Create the test directories `apps/api/tests/unit/transport_companies/lifecycle/bulk/`, `apps/api/tests/integration/transport_companies/lifecycle/bulk/`, and `apps/web/src/features/transport-companies/__tests__/lifecycle/`

**Checkpoint**: Baseline green, target directories exist

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared validation rules, exception vocabulary, authorization, and repository contract that carry no story behavior on their own but that every story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Hoist the shared lifecycle validation rules into `apps/api/app/site_references/shared/site_reference_validator.ts`: export `lifecycleComment()` as `vine.string().trim().maxLength(1000).nullable().optional()`, the `distinctUuids` rule, and `lifecycleIds()` as `vine.array(vine.string().uuid().toLowerCase()).minLength(1).use(distinctUuids())`, copied verbatim from `apps/api/app/customers/shared/customer_validator.ts` with no rule changes, per [research.md](./research.md) Decision 6
- [X] T005 Replace the local `lifecycleComment`, `distinctUuids`, and `lifecycleIds` declarations in `apps/api/app/customers/shared/customer_validator.ts` with imports from `#site_references/shared/site_reference_validator`, leaving all four customer validators textually equivalent (depends on T004)
- [X] T006 Prove the hoist changed no behavior by running `pnpm --filter @portflow/api test integration --files=tests/integration/customers/lifecycle/archive.spec.ts` and `--files=tests/integration/customers/lifecycle/bulk/archive.spec.ts`; both must pass unchanged (depends on T005)
- [X] T007 [P] Add `archiveTransportCompanyValidator` — `vine.create({ comment: lifecycleComment() })` — to `apps/api/app/transport_companies/shared/transport_company_validator.ts`, importing the rule from `#site_references/shared/site_reference_validator` (depends on T004)
- [X] T008 [P] Add `TransportCompanyAlreadyArchivedException` (409, `E_TRANSPORT_COMPANY_ALREADY_ARCHIVED`, "Transport company is already archived") and `TransportCompanyHasAvailableTrucksException` (409, `E_TRANSPORT_COMPANY_HAS_AVAILABLE_TRUCKS`, "Transport company still provides available trucks") to `apps/api/app/transport_companies/shared/transport_company_exceptions.ts`, keeping the delivered exceptions untouched
- [X] T009 [P] Add the `archive(user)` ability to `apps/api/app/transport_companies/shared/transport_company_policy.ts` granting `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, mirroring the existing `update` ability
- [X] T010 Extend `apps/api/app/transport_companies/shared/repositories/transport_company_repository.ts` with the `ArchiveTransportCompanyCommand` type and the `ArchiveTransportCompanyResult` union (`ARCHIVED` / `NOT_FOUND` / `ALREADY_ARCHIVED`), plus the abstract `archiveAvailable(command)` method; keep it a distinct type from the existing `TransportCompanyWriteResult`, whose `ARCHIVED` member means the opposite thing, per [data-model.md](./data-model.md)

**Checkpoint**: Shared rules hoisted with customers still green, exception vocabulary and authorization in place, repository contract declared — user stories can begin

---

## Phase 3: User Story 1 - Retire a Company That No Longer Provides Trucks (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator archives an eligible available transport company end to end; the company leaves available selections, stays readable in the archived collection, and carries its archival time, actor, and comment.

**Independent Test**: Sign in as an administrator, open an available company with no available truck, confirm the archive with a comment, and verify it moves to the Archived tab with its archival context while its identity and name are unchanged.

### Tests for User Story 1 ⚠️ Write first, confirm they FAIL

- [X] T011 [P] [US1] Write the happy-path unit spec in `apps/api/tests/unit/transport_companies/lifecycle/archive.spec.ts` covering: the use case archives an available company with no truck and one whose trucks are all archived (`TruckFactory.apply('archived')`); `id`, `name`, and `createdAt` are preserved; `status`, `archivedAt`, `archivedByUserId`, `archiveComment`, and `updatedAt` are set with `archivedAt === updatedAt`; a `null`, empty, and whitespace-only comment all store `null`; a comment with surrounding whitespace is stored trimmed; a company created with `TransportCompanyFactory.apply('reactivated')` keeps its reactivation triple after archival
- [X] T012 [P] [US1] Write the happy-path integration spec in `apps/api/tests/integration/transport_companies/lifecycle/archive.spec.ts` covering `POST /api/v1/transport-companies/:id/archive` returning `200` with the complete archived representation including a populated `archivedBy` summary, for both `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, with an empty body `{}` and with a comment, per [contracts/http-api.md](./contracts/http-api.md)
- [X] T013 [P] [US1] Extend `apps/api/tests/integration/transport_companies/lifecycle/archive.spec.ts` with the coupling assertions: after archival the company still appears in `GET /api/v1/transport-companies` with its archive context, no longer appears in `GET /api/v1/transport-companies/available`, `PATCH /api/v1/transport-companies/:id` on it returns `409 E_TRANSPORT_COMPANY_ARCHIVED`, `POST /api/v1/trucks` naming it as provider returns `422 E_TRUCK_TRANSPORT_COMPANY_INVALID`, and its existing trucks are still associated
- [X] T014 [P] [US1] Add an archive interception helper to `apps/web/src/features/transport-companies/__tests__/support/test-helpers.ts` backed by a mutable collection (mirroring `mockTransportCompanyCreation`), then write the success-path web spec in `apps/web/src/features/transport-companies/__tests__/lifecycle/archive.test.tsx` covering: **Archive company** is offered to an administrator on an available company, the dialog states the company stays readable but stops being selectable and offers an optional comment, cancelling sends no request, and a successful archival confirms, switches the directory to the **Archived** tab with the company present and the available count decremented, and shows the archival time, actor, and comment in the open details panel

### Implementation for User Story 1

- [X] T015 [US1] Implement `archiveAvailable` in `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts` as `UPDATE ... WHERE id = ? AND status = 'AVAILABLE'` setting the five archive fields, re-reading only when zero rows are affected to distinguish `NOT_FOUND` from `ALREADY_ARCHIVED`, and preloading `archivedBy` on the returned company; follow `archiveAvailable` in `apps/api/app/customers/shared/repositories/lucid_customer_repository.ts`, adding the preload that the customer version omits (depends on T010)
- [X] T016 [US1] Create `apps/api/app/transport_companies/archive/archive_transport_company_use_case.ts` accepting `{ id, archivedByUserId, archivedAt, comment }`, trimming the comment to `null` when blank, calling `archiveAvailable`, returning the company on `ARCHIVED`, and mapping `NOT_FOUND` and `ALREADY_ARCHIVED` to their exceptions (depends on T008, T015)
- [X] T017 [US1] Add the `archive` action to `apps/api/app/controllers/transport_companies_controller.ts` that reads the user via `auth.use('web').getUserOrFail()`, authorizes with `TransportCompanyPolicy.archive`, validates with `archiveTransportCompanyValidator`, calls the use case with `params.id` and `DateTime.now()`, and serializes through `TransportCompanyTransformer`; model it on the `archive` action in `apps/api/app/controllers/weighing_areas_controller.ts` (depends on T007, T009, T016)
- [X] T018 [US1] Register `router.post('/:id/archive', [controllers.TransportCompanies, 'archive']).as('archive')` in the `transport_companies` group in `apps/api/start/routes.ts`, then regenerate the Tuyau registry by running an ace command and commit the generated output under `apps/api/.adonisjs/` unmodified (depends on T017)
- [X] T019 [US1] Add an `archive` mutation to `apps/web/src/features/transport-companies/mutations/use-transport-company-mutations.ts` from `tuyauQuery.transportCompanies.archive`, invalidating both `transportCompanyQueries.all()` and `transportCompanyQueries.available()` on success alongside the delivered `create` and `update` mutations (depends on T018)
- [X] T020 [P] [US1] Create `apps/web/src/features/transport-companies/ui/transport-company-lifecycle-actions.tsx` exposing a destructive **Archive company** button that opens an `AlertDialog` with an optional comment `Textarea` capped at `maxLength={1000}`, a cancel action, and a submit action disabled while pending; model it on `apps/web/src/features/customers/ui/lifecycle-actions.tsx`, scoped to archival only since reactivation belongs to #221
- [X] T021 [US1] Render the lifecycle actions in the footer of `apps/web/src/features/transport-companies/ui/transport-company-details.tsx` next to the delivered **Edit company** button, keeping the existing `canAdminister && !isArchived` guard for both (depends on T020)
- [X] T022 [US1] Wire archival in `apps/web/src/features/transport-resources/ui/transport-resources-workspace.tsx`: pass the archive callback down, show a success toast, keep the details sheet open on the company, and navigate to `companyStatus: 'archived'` clearing `transportCompanyId` and `truckId` as every other tab change already does, per [research.md](./research.md) Decision 9 (depends on T019, T021)

**Checkpoint**: An administrator can archive an eligible company end to end; T011–T014 pass

---

## Phase 4: User Story 2 - Be Prevented From Archiving a Company Still Providing Trucks (Priority: P2)

**Goal**: A company that still provides at least one available truck is refused with an actionable reason naming the blocker, and neither the company nor any truck changes.

**Independent Test**: Attempt to archive a company providing one available truck; confirm the refusal names the available trucks and nothing changed, then confirm the same company archives once its last available truck is archived.

### Tests for User Story 2 ⚠️ Write first, confirm they FAIL

- [X] T023 [P] [US2] Extend `apps/api/tests/unit/transport_companies/lifecycle/archive.spec.ts` with: a company providing one available truck raises `TransportCompanyHasAvailableTrucksException`; the company stays `AVAILABLE` and the truck row is byte-for-byte unchanged; a company whose trucks are all archived is unaffected by the rule; a company providing an available truck reserved by a planned or active discharge is refused for the same reason
- [X] T024 [P] [US2] Add a unit spec for the truck read in `apps/api/tests/unit/trucks/consultation/available_by_company.spec.ts` covering `findCompanyIdsWithAvailableTrucks`: it returns exactly the requested ids that still provide an `AVAILABLE` truck, omits ids whose trucks are all archived, omits ids with no truck, omits unknown ids, returns an empty set for an empty request, and issues one query rather than one per id
- [X] T025 [P] [US2] Extend `apps/api/tests/integration/transport_companies/lifecycle/archive.spec.ts` with `409 E_TRANSPORT_COMPANY_HAS_AVAILABLE_TRUCKS` for a company providing an available truck, asserting the stored company and truck are unchanged after the refusal
- [X] T026 [P] [US2] Extend `apps/web/src/features/transport-companies/__tests__/lifecycle/archive.test.tsx` with the conflict path: a `409 E_TRANSPORT_COMPANY_HAS_AVAILABLE_TRUCKS` response surfaces as error feedback naming the blocker, the dialog stays usable, and the company remains in the Available tab

### Implementation for User Story 2

- [X] T027 [US2] Add the abstract `findCompanyIdsWithAvailableTrucks(input: { transportCompanyIds: readonly string[]; client?: QueryClientContract }): Promise<Set<string>>` to `apps/api/app/trucks/shared/repositories/truck_repository.ts`; the optional `client` exists so the bulk path can read inside its transaction, mirroring `SiteReferenceUsageChecker`
- [X] T028 [US2] Implement it in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts` as a single query selecting distinct `transport_company_id` with `whereIn('transport_company_id', ids)` and `where('status', 'AVAILABLE')`, honouring the optional transaction client and returning an empty set for an empty request without querying (depends on T027)
- [X] T029 [US2] Inject `TruckRepository` into `apps/api/app/transport_companies/archive/archive_transport_company_use_case.ts` and throw `TransportCompanyHasAvailableTrucksException` when the company's id is in the set returned for `[input.id]`, mirroring how `ArchiveCustomerUseCase` calls the usage checker with a one-element list (depends on T016, T028)
- [X] T030 [US2] Surface the refusal in `apps/web/src/features/transport-companies/ui/transport-company-lifecycle-actions.tsx` from `parseApiError(error).message`, keeping the dialog open so the administrator reads the reason where they acted; do **not** inspect the loaded truck collection to pre-empt the conflict, per [research.md](./research.md) Decision 8 (depends on T020)

**Checkpoint**: The available-truck rule is enforced authoritatively and reported understandably; US1 still passes

---

## Phase 5: User Story 3 - Be Blocked From Archiving What Must Not Be Archived (Priority: P3)

**Goal**: Archival is refused for unauthorized users, for already-archived companies, and for unknown ids, with the API authoritative regardless of what the interface offers.

**Independent Test**: Attempt archival as an unauthenticated visitor, as an active observer, on an already archived company, and on an unknown id; confirm each is refused with its documented status, nothing changes, and no archive affordance is offered to a non-administrator.

### Tests for User Story 3 ⚠️ Write first, confirm they FAIL

- [X] T031 [P] [US3] Extend `apps/api/tests/unit/transport_companies/lifecycle/archive.spec.ts` with: an unknown id raises `TransportCompanyNotFoundException`; an already-archived company raises `TransportCompanyAlreadyArchivedException` and its original `archivedAt`, `archivedByUserId`, and `archiveComment` are unchanged; an already-archived company that also provides available trucks raises the already-archived exception, not the truck one, proving the ordering in [research.md](./research.md) Decision 3
- [X] T032 [P] [US3] Extend `apps/api/tests/integration/transport_companies/lifecycle/archive.spec.ts` with: unauthenticated returns `401 E_UNAUTHORIZED_ACCESS`; an active `OBSERVER` returns `403 E_AUTHORIZATION_FAILURE`; an already-archived company returns `409 E_TRANSPORT_COMPANY_ALREADY_ARCHIVED`; an unknown id returns `404 E_TRANSPORT_COMPANY_NOT_FOUND`; a 1,000-character comment is accepted and 1,001 characters returns `422` with the company left `AVAILABLE`; and an observer submitting an over-long comment for an unknown id receives `403`, proving authorization precedes validation
- [X] T033 [P] [US3] Extend `apps/web/src/features/transport-companies/__tests__/administration/permissions.test.tsx` with: an active observer sees no **Archive company** affordance anywhere; an administrator viewing an archived company sees no archive affordance; a `409 E_TRANSPORT_COMPANY_ALREADY_ARCHIVED` response and a retryable failure each surface distinctly and can be retried without reopening the company

### Implementation for User Story 3

- [X] T034 [US3] Add the pre-checks to `apps/api/app/transport_companies/archive/archive_transport_company_use_case.ts` in the order `findById` → `NOT_FOUND`, `status === 'ARCHIVED'` → `ALREADY_ARCHIVED`, then the truck rule, then the conditional write; the write's own `NOT_FOUND` and `ALREADY_ARCHIVED` results keep mapping to the same exceptions so a row changing underneath is still refused (depends on T029)
- [X] T035 [US3] Verify in `apps/api/app/controllers/transport_companies_controller.ts` that the `archive` action authorizes **before** `request.validateUsing`, so an unauthorized caller learns nothing about validity or about the company's existence (depends on T017)
- [X] T036 [US3] Confirm the archive affordance in `apps/web/src/features/transport-companies/ui/transport-company-details.tsx` is rendered only under `canAdminister && !isArchived`, and that no archive control exists in `apps/web/src/features/transport-companies/ui/transport-company-list.tsx` row menus for archived companies (depends on T021)

**Checkpoint**: Every guard rail is enforced and distinctly reported; US1 and US2 still pass. **Single archival is complete and shippable here.**

---

## Phase 6: User Story 4 - Retire Several Companies in One Action (Priority: P4)

**Goal**: An administrator selects several companies and archives them in one action, receiving exactly which ones were archived and which were left untouched and why.

**Independent Test**: Select a mix of eligible, truck-blocked, already-archived, and unknown companies, archive the selection, and verify exactly the eligible ones are archived with shared lifecycle metadata while every other one is reported individually with its reason and left unchanged.

**⚠️ Depends on US1 (the write path and exception mapping), US2 (the truck rule and its set-based read), and US3 (the already-archived and not-found semantics).** This is the one story in this slice that is not independent, and the dependency is real: bulk archival must apply exactly the rules those stories established.

### Tests for User Story 4 ⚠️ Write first, confirm they FAIL

- [X] T037 [P] [US4] Write a pure unit spec in `apps/api/tests/unit/transport_companies/lifecycle/bulk/blockers.spec.ts` for `findBulkArchiveBlockers`: it classifies unknown ids as `NOT_FOUND` without a `name`, archived companies as `ALREADY_ARCHIVED`, truck-providing companies as `HAS_AVAILABLE_TRUCKS`, returns at most one reason per company in the documented order, preserves the requested order, and returns nothing for a fully eligible selection
- [X] T038 [P] [US4] Write the bulk unit spec in `apps/api/tests/unit/transport_companies/lifecycle/bulk/archive.spec.ts` covering: a fully eligible selection archives every company with one identical `archivedAt`, `archivedByUserId`, and `archiveComment`; a mixed selection archives exactly the eligible companies and reports the rest; an all-blocked selection archives nothing and returns an empty `updatedCompanies`; `updatedCompanies` and `blockedCompanies` partition the requested ids exactly, once each, in requested order; blocked companies and their trucks are unchanged
- [X] T039 [P] [US4] Write the bulk integration spec in `apps/api/tests/integration/transport_companies/lifecycle/bulk/archive.spec.ts` covering `POST /api/v1/transport-companies/archive`: unauthenticated `401`; active `OBSERVER` `403`; a mixed selection returning `200` with both collections shaped per [contracts/http-api.md](./contracts/http-api.md); an all-blocked selection returning `200` with an empty `updatedCompanies`; a `NOT_FOUND` blocker omitting `name`; empty `ids`, a non-UUID id, a duplicated id, and a 1,001-character comment each returning `422` with **no** company archived including the eligible ones
- [X] T040 [P] [US4] Extend the web test helpers in `apps/web/src/features/transport-companies/__tests__/support/test-helpers.ts` with bulk archive interception over a mutable collection returning a configurable partition, then write `apps/web/src/features/transport-companies/__tests__/lifecycle/bulk-archive.test.tsx` covering: checkboxes appear only for an administrator and only on the Available tab; a checkbox does not change which company scopes the trucks panel and vice versa; the toolbar reports the selection count and can clear it; cancelling changes nothing; a full success reports the count and removes the companies from the Available tab; a partial success reports both counts, lists each blocked company with a readable reason, and reduces the selection to exactly the blocked companies; an all-blocked result says plainly that nothing changed; changing the lifecycle tab clears the selection

### Implementation for User Story 4

- [X] T041 [P] [US4] Add `archiveTransportCompaniesValidator` — `vine.create({ ids: lifecycleIds(), comment: lifecycleComment() })` — to `apps/api/app/transport_companies/shared/transport_company_validator.ts` (depends on T004)
- [X] T042 [P] [US4] Create `apps/api/app/transport_companies/shared/transport_company_lifecycle_blockers.ts` exporting `TransportCompanyLifecycleRecord`, `BulkTransportCompanyLifecycleBlocker` with `reason: 'NOT_FOUND' | 'ALREADY_ARCHIVED' | 'HAS_AVAILABLE_TRUCKS'`, `indexCompaniesById`, `orderCompanies`, and `findBulkArchiveBlockers(ids, companiesById, companyIdsWithAvailableTrucks)`; model it on `apps/api/app/customers/shared/customer_lifecycle_blockers.ts` but scope it to archival rather than parameterising an expected status, per [research.md](./research.md) Decision 12
- [X] T043 [US4] Extend `apps/api/app/transport_companies/shared/repositories/transport_company_repository.ts` with `ArchiveTransportCompaniesCommand`, `BulkTransportCompanyLifecycleResult` (`updatedCompanies`, `blockedCompanies`), and the abstract `archiveAvailableMany(command)` (depends on T010, T042)
- [X] T044 [US4] Implement `archiveAvailableMany` in `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts` inside one `TransportCompany.transaction`: load the requested rows `forUpdate`, call `findCompanyIdsWithAvailableTrucks` with the transaction client, partition with `findBulkArchiveBlockers`, update the eligible ids in one statement, assert the affected-row count equals the eligible count and throw otherwise, then reload the archived rows with `archivedBy` preloaded and return both collections in requested order; follow `archiveAvailableMany` in `apps/api/app/customers/shared/repositories/lucid_customer_repository.ts` (depends on T028, T043)
- [X] T045 [US4] Create `apps/api/app/transport_companies/archive/archive_transport_companies_use_case.ts` accepting `{ ids, archivedByUserId, archivedAt, comment }`, trimming the comment to `null` when blank, and returning the repository's partition unchanged — it raises no exception, because per-company outcomes are data here, not failures (depends on T044)
- [X] T046 [US4] Add the `archiveMany` action to `apps/api/app/controllers/transport_companies_controller.ts` authorizing with the same `TransportCompanyPolicy.archive` ability, validating with `archiveTransportCompaniesValidator`, and serializing `{ updatedCompanies: TransportCompanyTransformer.transform(...), blockedCompanies }`; model it on `archiveMany` in `apps/api/app/controllers/customers_controller.ts` (depends on T041, T045)
- [X] T047 [US4] Register `router.post('/archive', [controllers.TransportCompanies, 'archiveMany']).as('archive_many')` **before** the parameterised `/:id/archive` route in the `transport_companies` group in `apps/api/start/routes.ts`, matching the delivered customer group ordering, then regenerate the Tuyau registry and commit the generated output under `apps/api/.adonisjs/` unmodified (depends on T046)
- [X] T048 [P] [US4] Add `BulkTransportCompanyLifecycleResult` and `BulkTransportCompanyLifecycleBlocker` to `apps/web/src/features/transport-companies/types.ts`, derived from `Route.Response<'transport_companies.archive_many'>['data']` exactly as `apps/web/src/features/customers/types.ts` derives its equivalents (depends on T047)
- [X] T049 [US4] Add an `archiveMany` mutation to `apps/web/src/features/transport-companies/mutations/use-transport-company-mutations.ts` invalidating both consultation queries on success (depends on T047)
- [X] T050 [P] [US4] Add optional `selectedIds: Set<string>`, `onToggleSelection`, and `onToggleVisible` props to `apps/web/src/features/transport-companies/ui/transport-company-list.tsx`, rendering a leading `Checkbox` per row and a select-visible control **only** when those props are provided, so the delivered consultation rendering is byte-identical without them, per [research.md](./research.md) Decision 13
- [X] T051 [US4] Thread the same optional selection props through `apps/web/src/features/transport-companies/ui/transport-company-section.tsx` without changing its existing behavior (depends on T050)
- [X] T052 [P] [US4] Create `apps/web/src/features/transport-companies/ui/bulk-transport-company-lifecycle-actions.tsx` exposing a floating toolbar that reports the selection count, offers **Archive selected** and a clear action, opens an `AlertDialog` with the optional 1,000-character comment, and renders the blocked companies with readable reasons plus a retry action; model it on `apps/web/src/features/customers/ui/bulk-lifecycle-actions.tsx`, scoped to archival only (depends on T048)
- [X] T053 [US4] Own the selection in `apps/web/src/features/transport-resources/ui/transport-resources-workspace.tsx`: hold `selectedCompanyIds` and `blockedCompanies` state, pass the selection props to the Available tab's section only and only when `canAdminister`, clear both on lifecycle tab change, keep the selection independent of `transportCompanyId`, and on success show an aggregate toast, replace the selection with exactly the blocked companies, and stay on the Available tab, per [research.md](./research.md) Decision 9 (depends on T049, T051, T052)

**Checkpoint**: An administrator can archive a selection with per-company outcomes; US1, US2, and US3 still pass

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification and the artifacts that make the slice reviewable

- [X] T054 [P] Run the focused single-archival API verification from [quickstart.md](./quickstart.md) §2 and confirm every listed outcome
- [X] T055 [P] Run the focused bulk-archival API verification from [quickstart.md](./quickstart.md) §3, including the assertion that the bulk write issues one truck-availability read for the whole selection rather than one per company
- [X] T056 [P] Run the focused web verification from [quickstart.md](./quickstart.md) §4 and confirm the delivered consultation, creation, and update specs still pass unchanged
- [X] T057 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the repository root; all must pass (depends on T054, T055, T056)
- [ ] T058 Complete the browser flow in [quickstart.md](./quickstart.md) §6 in a desktop and a narrow mobile viewport, including step 20 — archiving a company individually while it is still part of a bulk selection must not double-report
- [X] T059 [P] Update the `#220` row in `specs/site-references/transport-resources/transport-companies/roadmap.md` to `implemented` with artifact `./archive-a-transport-company/`
- [X] T060 Obtain a fresh read-only review of the final diff per constitution principle VII, resolving or explicitly justifying every confirmed finding (depends on T057, T058)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on Foundational; its use-case task (T029) depends on US1's use case (T016)
- **US3 (Phase 5)**: Depends on Foundational; its use-case task (T034) depends on US2's guard (T029) because it fixes the check ordering around it
- **US4 (Phase 6)**: Depends on US1, US2, and US3 — see the warning in Phase 6
- **Polish (Phase 7)**: Depends on every story that is being shipped

### User Story Dependencies

- **US1 (P1)**: Independent. Delivers the complete single-archival path.
- **US2 (P2)**: Layers the blocking rule onto US1's write path. Independently testable — its refusal can be exercised without US3 or US4 existing.
- **US3 (P3)**: Layers guard rails and ordering onto US1 and US2. Independently testable.
- **US4 (P4)**: **Not independent.** It applies the rules US1–US3 establish, at a second cardinality. Attempting it earlier would mean writing the truck rule and the lifecycle guards twice.

### Within Each User Story

- Tests are written first and must FAIL before implementation
- Repository contract before repository implementation before use case before controller before route
- Route registration and Tuyau regeneration before any web mutation that types against it (T018 → T019, T047 → T048/T049)
- Web presentation component before its wiring into the workspace

### Parallel Opportunities

- T007, T008, T009 are three different files with no shared edits — fully parallel after T004
- T011–T014 (US1 tests), T023–T026 (US2 tests), T031–T033 (US3 tests), and T037–T040 (US4 tests) are parallel within their story
- T041 and T042 are different files and parallel; T050 and T052 are different files and parallel
- T054, T055, T056, and T059 are parallel
- **Not parallel despite appearances**: T007 and T041 both edit `transport_company_validator.ts`; T010 and T043 both edit `transport_company_repository.ts`; T015 and T044 both edit `lucid_transport_company_repository.ts`; T017 and T046 both edit `transport_companies_controller.ts`; T018 and T047 both edit `routes.ts`. Sequence each pair.

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together, confirm they fail:
Task: "Happy-path unit spec in apps/api/tests/unit/transport_companies/lifecycle/archive.spec.ts"
Task: "Happy-path integration spec in apps/api/tests/integration/transport_companies/lifecycle/archive.spec.ts"
Task: "Coupling assertions in apps/api/tests/integration/transport_companies/lifecycle/archive.spec.ts"
Task: "Web success-path spec in apps/web/src/features/transport-companies/__tests__/lifecycle/archive.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: an administrator can archive an eligible company end to end

US1 alone is demonstrable but **not shippable**: without US2 a company still providing available trucks would be archived, violating the `CONTEXT.md` domain rule. Treat US1 + US2 as the smallest correct release.

### Incremental Delivery

1. Setup + Foundational → shared rules hoisted, customers still green
2. US1 → single archival works → demo
3. US2 → the domain rule is enforced → **smallest correct release**
4. US3 → guard rails and ordering complete → single archival is finished and shippable
5. US4 → bulk archival on top of finished rules → demo

Stopping after US3 delivers the whole of the original issue scope. US4 is the increment added by the bulk request and can be deferred without leaving anything half-built.

### Parallel Team Strategy

US1 to US3 are a single vertical thread through the same use case and are best done by one developer in order. Genuine parallelism here is across layers rather than across stories: while one developer works the API thread (T015–T018, T027–T029, T034–T035), another can build the web components (T020, T050, T052) against the contracts in [contracts/http-api.md](./contracts/http-api.md), joining at the wiring tasks (T022, T053).

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- No migration in this slice; `apps/api/database/schema.ts` must not change
- `apps/api/.adonisjs/` and the TanStack route tree are generated — commit what the generators produce, never hand-edit
- Verify tests fail before implementing
- Commit after each task or logical group, using Conventional Commits
- Stop at any checkpoint to validate independently
- The residual create-truck race documented in [research.md](./research.md) Decision 7 is accepted, not fixed here — do not add locking to `CreateTruckUseCase` under this issue
