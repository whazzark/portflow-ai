---
description: "Task list for Reactivate a Transport Company (GH-221)"
---

# Tasks: Reactivate a Transport Company

**Input**: Design documents from `specs/site-references/transport-resources/transport-companies/reactivate-a-transport-company/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [quickstart.md](./quickstart.md)

**Tests**: Test tasks are **included and mandatory**. Constitution principle IV requires business behavior to follow RED → GREEN → REFACTOR, and plan.md commits to Japa API specs and router-level Vitest/MSW web specs as the primary seams.

**Organization**: Tasks are grouped by user story. US1 and US2 are independently deliverable increments; US3 (bulk) builds on both and says so rather than pretending otherwise.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task serves (US1, US2, US3)
- Every task names the exact file it touches

## Path Conventions

PNPM/Turbo monorepo with two workspaces: `apps/api/` (AdonisJS) and `apps/web/` (TanStack Start). Paths below are repository-relative and match the structure in plan.md.

**No migration is part of this slice.** `status`, `reactivated_at`, `reactivated_by_user_id`, and `reactivation_comment` already exist on `transport_companies`. If `apps/api/database/schema.ts` changes during this work, something else is out of date.

**No new shared validation rules.** `lifecycleComment()` and `lifecycleIds()` already live in `apps/api/app/shared/validators/lifecycle_validator.ts`, hoisted there by #220 precisely so this slice would import them. Do not redeclare either.

**Every test directory this slice needs already exists**, created by #220. No directory tasks.

---

## Phase 1: Setup

**Purpose**: Establish a known-good baseline before changing files that the delivered archive path shares

- [X] T001 Confirm work is on branch `feat/221-reactivate-transport-company` and the working tree is clean
- [X] T002 Capture a green baseline by running `pnpm check`, `pnpm typecheck`, and `pnpm test`, so any later failure is attributable to this slice
- [X] T003 Record the specific regression baseline this slice must preserve by running `pnpm --filter @portflow/api test unit --files=tests/unit/transport_companies/lifecycle/bulk/blockers.spec.ts`, `--files=tests/unit/transport_companies/lifecycle/bulk/archive.spec.ts`, and `pnpm --filter @portflow/api test integration --files=tests/integration/transport_companies/lifecycle/bulk/archive.spec.ts`; T031 generalises the module all three depend on

**Checkpoint**: Baseline green, delivered archive suites confirmed passing before the shared blockers module is touched

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Exception vocabulary, authorization, validation, and the repository contract for the single path — no story behavior on their own, but every story depends on them

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Add `reactivateTransportCompanyValidator` — `vine.create({ comment: lifecycleComment() })` — to `apps/api/app/transport_companies/shared/transport_company_validator.ts`, importing `lifecycleComment` from the existing `#shared/validators/lifecycle_validator` alongside the delivered archive validators; declare no new rule
- [X] T005 [P] Add `TransportCompanyAlreadyAvailableException` (409, `E_TRANSPORT_COMPANY_ALREADY_AVAILABLE`, "Transport company is already available") to `apps/api/app/transport_companies/shared/transport_company_exceptions.ts`, mirroring `CustomerAlreadyAvailableException` in `apps/api/app/customers/shared/customer_exceptions.ts` and leaving the delivered exceptions untouched
- [X] T006 [P] Add the `reactivate(user)` ability to `apps/api/app/transport_companies/shared/transport_company_policy.ts` granting `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, declared separately from `archive` even though the two resolve identically today, per [research.md](./research.md) Decision 1
- [X] T007 Extend `apps/api/app/transport_companies/shared/repositories/transport_company_repository.ts` with the `ReactivateTransportCompanyCommand` type and the `ReactivateTransportCompanyResult` union (`REACTIVATED` / `NOT_FOUND` / `ALREADY_AVAILABLE`), plus the abstract `reactivateArchived(command)` method; keep it a distinct type from `ArchiveTransportCompanyResult` and `TransportCompanyWriteResult` for the reason [data-model.md](./data-model.md) records

**Checkpoint**: Exception vocabulary, authorization, validation, and the single-path repository contract are declared — user stories can begin

---

## Phase 3: User Story 1 - Bring an Archived Company Back Into Service (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator reactivates an archived transport company end to end; the company returns to available selections under the same identity, carries its reactivation time, actor, and comment, and keeps the archival context that preceded it.

**Independent Test**: Sign in as an administrator, open an archived company, confirm the reactivation with a comment, and verify it moves to the Available tab with its reactivation context while its identity, name, and archive context are unchanged.

### Tests for User Story 1 ⚠️ Write first, confirm they FAIL

- [X] T008 [P] [US1] Write the happy-path unit spec in `apps/api/tests/unit/transport_companies/lifecycle/reactivate.spec.ts` covering: the use case reactivates an archived company; `id`, `name`, and `createdAt` are preserved; `status`, `reactivatedAt`, `reactivatedByUserId`, `reactivationComment`, and `updatedAt` are set with `reactivatedAt === updatedAt`; the archive triple is returned **unchanged**; a `null`, empty, and whitespace-only comment all store `null`; a comment with surrounding whitespace is stored trimmed; a company built with `TransportCompanyFactory.apply('reactivated')`, archived and reactivated again, ends with `reactivationComment: null` when no comment is given — the triple is replaced, not merged
- [X] T009 [P] [US1] Extend `apps/api/tests/unit/transport_companies/lifecycle/reactivate.spec.ts` with the no-blocker assertions that make FR-006 and SC-005 observable: an archived company providing **no** truck, one providing only archived trucks, and one providing **available** trucks all reactivate successfully; the last state is built directly with the company and truck factories, since archival would refuse to produce it; assert that no truck row changes lifecycle state and that the use case never injects `TruckRepository`, per [research.md](./research.md) Decision 3
- [X] T010 [P] [US1] Write the happy-path integration spec in `apps/api/tests/integration/transport_companies/lifecycle/reactivate.spec.ts` covering `POST /api/v1/transport-companies/:id/reactivate` returning `200` with the complete representation including a populated `reactivatedBy` summary and the preserved `archivedBy`, for both `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, with an empty body `{}` and with a comment; include the seeded *Noroît Logistique* case where `archivedByUserId` is `null`, asserting the reactivation succeeds and returns `archivedBy: null`, per [contracts/http-api.md](./contracts/http-api.md)
- [X] T011 [P] [US1] Extend `apps/api/tests/integration/transport_companies/lifecycle/reactivate.spec.ts` with the coupling assertions: after reactivation the company appears in `GET /api/v1/transport-companies` with both lifecycle contexts, appears again in `GET /api/v1/transport-companies/available`, `PATCH /api/v1/transport-companies/:id` on it now succeeds where it previously returned `409 E_TRANSPORT_COMPANY_ARCHIVED`, `POST /api/v1/trucks` naming it as provider now succeeds where it previously returned `422 E_TRUCK_TRANSPORT_COMPANY_INVALID`, and `POST /api/v1/transport-companies/:id/archive` on it works again subject to its own available-truck rule
- [X] T012 [P] [US1] Add the name-reservation regression to `apps/api/tests/integration/transport_companies/lifecycle/reactivate.spec.ts`: archive a company, assert that creating another company with the same name is refused with `409 E_TRANSPORT_COMPANY_NAME_CONFLICT` while it is archived, then assert the archived company still reactivates successfully. This asserts the premise that makes reactivation total; if `transport_companies_name_unique` is ever made partial, this test must fail loudly, per [research.md](./research.md) Decision 4
- [X] T013 [P] [US1] Add a reactivation interception helper to `apps/web/src/features/transport-companies/__tests__/support/test-helpers.ts` backed by a mutable collection (mirroring the delivered `mockTransportCompanyArchival`), then write the success-path web spec in `apps/web/src/features/transport-companies/__tests__/lifecycle/reactivate.test.tsx` covering: **Reactivate company** is offered to an administrator on an archived company and **Edit company** is not; the dialog states the company becomes selectable again and offers an optional comment capped at 1,000 characters; cancelling sends no request; a successful reactivation confirms, switches the directory to the **Available** tab with the company present and the available count incremented, and shows the reactivation time, actor, and comment in the open details panel

### Implementation for User Story 1

- [X] T014 [US1] Implement `reactivateArchived` in `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts` as a bare `UPDATE ... WHERE id = ? AND status = 'ARCHIVED'` setting the four reactivation fields, re-reading only when zero rows are affected to distinguish `NOT_FOUND` from `ALREADY_AVAILABLE`, and preloading both `archivedBy` and `reactivatedBy` on the returned company. **Take no transaction and no `forUpdate` lock** — unlike the delivered `archiveAvailable`, this path reads no second table and has nothing to serialize; follow `reactivateArchived` in `apps/api/app/customers/shared/repositories/lucid_customer_repository.ts`, adding the preloads it omits, per [research.md](./research.md) Decision 5 (depends on T007)
- [X] T015 [US1] Create `apps/api/app/transport_companies/reactivate/reactivate_transport_company_use_case.ts` accepting `{ id, reactivatedByUserId, reactivatedAt, comment }`, trimming the comment to `null` when blank, calling `reactivateArchived`, returning the company on `REACTIVATED`, and mapping `NOT_FOUND` and `ALREADY_AVAILABLE` to their exceptions. It injects `TransportCompanyRepository` only — **never** `TruckRepository` (depends on T005, T014)
- [X] T016 [US1] Add the `reactivate` action to `apps/api/app/controllers/transport_companies_controller.ts` that reads the user via `auth.use('web').getUserOrFail()`, authorizes with `TransportCompanyPolicy.reactivate`, validates with `reactivateTransportCompanyValidator`, calls the use case with `params.id` and `DateTime.now()`, and serializes through `TransportCompanyTransformer`; model it on the delivered `archive` action in the same file (depends on T004, T006, T015)
- [X] T017 [US1] Register `router.post('/:id/reactivate', [controllers.TransportCompanies, 'reactivate']).as('reactivate')` in the `transport_companies` group in `apps/api/start/routes.ts`, after the delivered `/:id/archive` route, then regenerate the Tuyau registry by running an ace command and commit the generated output under `apps/api/.adonisjs/` unmodified (depends on T016)
- [X] T018 [US1] Add a `reactivate` mutation to `apps/web/src/features/transport-companies/mutations/use-transport-company-mutations.ts` from `tuyauQuery.transportCompanies.reactivate`, invalidating both `transportCompanyQueries.all()` and `transportCompanyQueries.available()` on success alongside the delivered mutations (depends on T017)
- [X] T019 [US1] Make `apps/web/src/features/transport-companies/ui/transport-company-lifecycle-actions.tsx` direction-aware: derive the direction from `company.status`, and switch the mutation, the button label and variant (**Archive company** destructive / **Reactivate company** default), the dialog title and description, the comment field id, and the success and error toast wording. Add **no** new component; model the branching on `apps/web/src/features/customers/ui/lifecycle-actions.tsx`, per [research.md](./research.md) Decision 9 (depends on T018)
- [X] T020 [US1] Change the footer guard in `apps/web/src/features/transport-companies/ui/transport-company-details.tsx` from `canAdminister && !isArchived` to `canAdminister`, rendering **Edit company** + the lifecycle action on an available company and the lifecycle action **alone** on an archived one; rename the `onArchiveSuccess` prop to `onLifecycleSuccess` since it now serves both directions. Do not offer Edit on an archived company — the update slice refuses it with `409 E_TRANSPORT_COMPANY_ARCHIVED` (depends on T019)
- [X] T021 [US1] Wire reactivation in `apps/web/src/features/transport-resources/ui/transport-resources-workspace.tsx`: pass `onLifecycleSuccess` that navigates to `companyStatus: 'available'` after a reactivation and `'archived'` after an archival, clearing `transportCompanyId` and `truckId` in both cases as every other tab change already does, and keep the details sheet open on the company, per [research.md](./research.md) Decision 10 (depends on T018, T020)

**Checkpoint**: An administrator can reactivate an archived company end to end; T008–T013 pass. The API is already safe here — the policy ability and the conditional write ship with this story.

---

## Phase 4: User Story 2 - Be Blocked From Reactivating What Must Not Be Reactivated (Priority: P2)

**Goal**: Reactivation is refused for unauthorized users, for already available companies, and for unknown ids, with the API authoritative regardless of what the interface offers, and with no already-available company's history rewritten.

**Independent Test**: Attempt reactivation as an unauthenticated visitor, as an active observer, on an already available company, and on an unknown id; confirm each is refused with its documented status, nothing changes, and no reactivate affordance is offered to a non-administrator.

**Note on scope**: US1 already ships the policy ability and a conditional write that refuses both bad states, so this story does not make an unsafe path safe. What it adds is the guard **ordering** (a clear reason without a wasted write, and authorization before validation), the negative-path proof required by constitution principle IV, and the interface gating.

### Tests for User Story 2 ⚠️ Write first, confirm they FAIL

- [X] T022 [P] [US2] Extend `apps/api/tests/unit/transport_companies/lifecycle/reactivate.spec.ts` with: an unknown id raises `TransportCompanyNotFoundException`; an already available company raises `TransportCompanyAlreadyAvailableException` and its existing `reactivatedAt`, `reactivatedByUserId`, and `reactivationComment` are unchanged — use the seeded *Estuaire Bennes* shape, which already carries a previous reactivation context; a row reactivated between the pre-check and the write is still refused, proving the write's own result mapping is load-bearing
- [X] T023 [P] [US2] Extend `apps/api/tests/integration/transport_companies/lifecycle/reactivate.spec.ts` with: unauthenticated returns `401 E_UNAUTHORIZED_ACCESS`; a non-active user is refused by the auth middleware; an active `OBSERVER` returns `403 E_AUTHORIZATION_FAILURE`; an already available company returns `409 E_TRANSPORT_COMPANY_ALREADY_AVAILABLE`; an unknown id returns `404 E_TRANSPORT_COMPANY_NOT_FOUND`; a 1,000-character comment is accepted and 1,001 characters returns `422` with the company left `ARCHIVED`; and an observer submitting an over-long comment for an unknown id receives `403`, proving authorization precedes validation, per [contracts/http-api.md](./contracts/http-api.md)
- [X] T024 [P] [US2] Extend `apps/web/src/features/transport-companies/__tests__/administration/permissions.test.tsx` with: an active observer sees no **Reactivate company** affordance on either lifecycle tab; an administrator viewing an available company sees **Edit** and **Archive** but no reactivate affordance; an administrator viewing an archived company sees **Reactivate** but no **Edit**, and a hand-typed `companyDetailsMode=edit` on an archived company still opens no form; a `409 E_TRANSPORT_COMPANY_ALREADY_AVAILABLE` response and a retryable failure each surface distinctly and can be retried without reopening the company

### Implementation for User Story 2

- [X] T025 [US2] Add the pre-checks to `apps/api/app/transport_companies/reactivate/reactivate_transport_company_use_case.ts` in the order `findById` → `NOT_FOUND`, `status === 'AVAILABLE'` → `ALREADY_AVAILABLE`, then the conditional write; the write's own `NOT_FOUND` and `ALREADY_AVAILABLE` results keep mapping to the same exceptions so a row changing underneath is still refused, per [research.md](./research.md) Decision 6 (depends on T015)
- [X] T026 [US2] Verify in `apps/api/app/controllers/transport_companies_controller.ts` that the `reactivate` action authorizes **before** `request.validateUsing`, so an unauthorized caller learns nothing about validity or about the company's existence (depends on T016)
- [X] T027 [US2] Confirm the lifecycle affordance in `apps/web/src/features/transport-companies/ui/transport-company-details.tsx` renders only under `canAdminister`, that **Edit company** remains gated on `!isArchived`, and that the delivered `editSession` guard in `apps/web/src/features/transport-resources/ui/transport-resources-workspace.tsx` still blocks a hand-typed edit mode on an archived company (depends on T020)

**Checkpoint**: Every guard rail is enforced and distinctly reported; US1 still passes. **Single reactivation is complete and shippable here.**

---

## Phase 5: User Story 3 - Bring Several Companies Back In One Action (Priority: P3)

**Goal**: An administrator selects several archived companies and reactivates them in one action, receiving exactly which ones came back and which were left untouched and why.

**Independent Test**: Select a mix of archived, already available, and unknown companies, reactivate the selection, and verify exactly the archived ones are reactivated with shared lifecycle metadata while every other one is reported individually with its reason and left unchanged.

**⚠️ Depends on US1 (the write path and exception mapping) and US2 (the already-available and not-found semantics and their ordering).** Bulk reactivation must apply exactly the rules those stories establish, at a second cardinality.

**⚠️ This phase modifies a file the delivered archive path shares.** T031 generalises `transport_company_lifecycle_blockers.ts`; T032 exists to prove the archive suites recorded in T003 still pass afterwards.

### Tests for User Story 3 ⚠️ Write first, confirm they FAIL

- [X] T028 [P] [US3] Extend the pure unit spec in `apps/api/tests/unit/transport_companies/lifecycle/bulk/blockers.spec.ts` to cover `findBulkBlockers` at both expectations: with `'AVAILABLE'` it still produces `NOT_FOUND`, `ALREADY_ARCHIVED`, and `HAS_AVAILABLE_TRUCKS` in the delivered order; with `'ARCHIVED'` it produces only `NOT_FOUND` and `ALREADY_AVAILABLE`, omits `name` on `NOT_FOUND`, and **ignores any truck set it is handed**; both expectations return at most one reason per company, preserve the requested order, and return nothing for a fully eligible selection
- [X] T029 [P] [US3] Write the bulk unit spec in `apps/api/tests/unit/transport_companies/lifecycle/bulk/reactivate.spec.ts` covering: a fully archived selection reactivates every company with one identical `reactivatedAt`, `reactivatedByUserId`, and `reactivationComment`; a mixed selection reactivates exactly the archived companies and reports the rest; an all-blocked selection reactivates nothing and returns an empty `updatedCompanies`; `updatedCompanies` and `blockedCompanies` partition the requested ids exactly, once each, in requested order; blocked companies, their lifecycle context, and their trucks are unchanged; a company providing available trucks in the selection is **reactivated, not blocked**; and the bulk write issues **no** query against `trucks`
- [X] T030 [P] [US3] Write the bulk integration spec in `apps/api/tests/integration/transport_companies/lifecycle/bulk/reactivate.spec.ts` covering `POST /api/v1/transport-companies/reactivate`: unauthenticated `401`; active `OBSERVER` `403`; a mixed selection returning `200` with both collections shaped per [contracts/http-api.md](./contracts/http-api.md); an all-blocked selection returning `200` with an empty `updatedCompanies`; a `NOT_FOUND` blocker omitting `name`; no blocker ever reported as `ALREADY_ARCHIVED` or `HAS_AVAILABLE_TRUCKS`; empty `ids`, a non-UUID id, a duplicated id, and a 1,001-character comment each returning `422` with **no** company reactivated including the eligible ones; and a selection overlapping a concurrently reactivated company reporting it `ALREADY_AVAILABLE` while its neighbours are still reactivated
- [X] T031 [P] [US3] Extend the web test helpers in `apps/web/src/features/transport-companies/__tests__/support/test-helpers.ts` with bulk reactivation interception over a mutable collection returning a configurable partition, then write `apps/web/src/features/transport-companies/__tests__/lifecycle/bulk-reactivate.test.tsx` covering: checkboxes and the toolbar appear for an administrator on the **Archived** tab with a **Reactivate selected** action; an observer sees neither on either tab; a checkbox does not change which company scopes the trucks panel and vice versa; the toolbar reports the selection count and can clear it; cancelling changes nothing; a full success reports the count and removes the companies from the Archived tab; a partial success reports both counts, lists each blocked company with a readable **already available** reason, and reduces the selection to exactly the blocked companies; an all-blocked result says plainly that nothing changed; changing the lifecycle tab clears the selection in both directions

### Implementation for User Story 3

- [X] T032 [P] [US3] Add `reactivateTransportCompaniesValidator` — `vine.create({ ids: lifecycleIds(), comment: lifecycleComment() })` — to `apps/api/app/transport_companies/shared/transport_company_validator.ts`, importing both rules from `#shared/validators/lifecycle_validator` (depends on T004)
- [X] T033 [US3] Generalise `apps/api/app/transport_companies/shared/transport_company_lifecycle_blockers.ts`: rename `findBulkArchiveBlockers` to `findBulkBlockers(ids, companiesById, expectedStatus, companyIdsWithAvailableTrucks = new Set())`, emit `ALREADY_ARCHIVED` when `AVAILABLE` is expected and `ALREADY_AVAILABLE` when `ARCHIVED` is expected, consult the truck set **only** when `AVAILABLE` is expected, and widen `BulkTransportCompanyLifecycleBlocker['reason']` to the four-member union; keep `indexCompaniesById` and `orderCompanies` unchanged and model the result on `apps/api/app/customers/shared/customer_lifecycle_blockers.ts`, per [research.md](./research.md) Decision 2
- [X] T034 [US3] Update the delivered call site in `archiveAvailableMany` in `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts` to `findBulkBlockers(command.ids, companiesById, 'AVAILABLE', companyIdsWithAvailableTrucks)`, then re-run the three suites recorded in T003; all must pass unchanged, proving the generalisation is behaviour-preserving for archival (depends on T033)
- [X] T035 [US3] Extend `apps/api/app/transport_companies/shared/repositories/transport_company_repository.ts` with `ReactivateTransportCompaniesCommand` and the abstract `reactivateArchivedMany(command)`, reusing the delivered `BulkTransportCompanyLifecycleResult` unchanged (depends on T007, T033)
- [X] T036 [US3] Implement `reactivateArchivedMany` in `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts` inside one `TransportCompany.transaction`: load the requested rows `forUpdate`, partition with `findBulkBlockers(command.ids, companiesById, 'ARCHIVED')` — passing **no** truck set — update the eligible ids in one statement, assert the affected-row count equals the eligible count and throw otherwise, then reload the reactivated rows with `archivedBy` and `reactivatedBy` preloaded and return both collections in requested order; follow the delivered `archiveAvailableMany` in the same file, minus its truck read (depends on T034, T035)
- [X] T037 [US3] Create `apps/api/app/transport_companies/reactivate/reactivate_transport_companies_use_case.ts` accepting `{ ids, reactivatedByUserId, reactivatedAt, comment }`, trimming the comment to `null` when blank, and returning the repository's partition unchanged — it raises no exception, because per-company outcomes are data here, not failures (depends on T036)
- [X] T038 [US3] Add the `reactivateMany` action to `apps/api/app/controllers/transport_companies_controller.ts` authorizing with the same `TransportCompanyPolicy.reactivate` ability, validating with `reactivateTransportCompaniesValidator`, and serializing `{ updatedCompanies: TransportCompanyTransformer.transform(...), blockedCompanies }`; model it on the delivered `archiveMany` action in the same file (depends on T032, T037)
- [X] T039 [US3] Register `router.post('/reactivate', [controllers.TransportCompanies, 'reactivateMany']).as('reactivate_many')` **before** the parameterised `/:id/archive` and `/:id/reactivate` routes in the `transport_companies` group in `apps/api/start/routes.ts`, matching the delivered customer group ordering, then regenerate the Tuyau registry and commit the generated output under `apps/api/.adonisjs/` unmodified (depends on T038)
- [X] T040 [P] [US3] Change `BulkTransportCompanyLifecycleResult` in `apps/web/src/features/transport-companies/types.ts` to the union of `Route.Response<'transport_companies.archive_many'>['data']` and `Route.Response<'transport_companies.reactivate_many'>['data']`, leaving `BulkTransportCompanyLifecycleBlocker` deriving from it by indexed access; the two are structurally identical today, so the union collapses to one shape — it exists so a future divergence fails typecheck instead of typing one direction as the other, per [research.md](./research.md) Decision 2 (depends on T039)
- [X] T041 [US3] Add a `reactivateMany` mutation to `apps/web/src/features/transport-companies/mutations/use-transport-company-mutations.ts` from `tuyauQuery.transportCompanies.reactivateMany`, matching how the delivered `archiveMany` mutation is declared (depends on T039)
- [X] T042 [US3] Make `apps/web/src/features/transport-companies/ui/bulk-transport-company-lifecycle-actions.tsx` direction-aware: accept the lifecycle direction as a prop, and switch the mutation, the toolbar button label and variant (**Archive selected** / **Reactivate selected**), the dialog title and description, and the toast wording; extend `formatBlockerReason` with `ALREADY_AVAILABLE` → "already available" so one map serves both directions. Add **no** new component; model the branching on `apps/web/src/features/customers/ui/bulk-lifecycle-actions.tsx` (depends on T040, T041)
- [X] T043 [US3] Open selection to both tabs in `apps/web/src/features/transport-resources/ui/transport-resources-workspace.tsx`: pass `selectedIds`, `onToggleSelection`, and `onToggleVisible` to the **Archived** tab's `TransportCompanySection` under the same `canAdminister` guard the Available tab already uses, render `BulkTransportCompanyLifecycleActions` for both lifecycle tabs with the direction derived from `companyStatus`, keep clearing the selection on tab change, keep it independent of `transportCompanyId`, and on success replace the selection with exactly the blocked companies while staying on the current tab, per [research.md](./research.md) Decisions 9 and 10 (depends on T042)

**Checkpoint**: An administrator can reactivate a selection with per-company outcomes; US1, US2, and the delivered archive path all still pass

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification and the artifacts that make the slice reviewable

- [X] T044 [P] Run the focused single-reactivation API verification from [quickstart.md](./quickstart.md) §2 and confirm every listed outcome, including the name-reservation regression
- [X] T045 [P] Run the focused bulk-reactivation API verification from [quickstart.md](./quickstart.md) §3, including the assertion that the bulk write issues no query against `trucks` and that the delivered archive suites still pass after the blockers generalisation
- [X] T046 [P] Run the focused web verification from [quickstart.md](./quickstart.md) §4 and confirm the delivered archive, consultation, creation, and update specs still pass unchanged
- [X] T047 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the repository root; all must pass (depends on T044, T045, T046)
- [ ] T048 Complete the browser flow in [quickstart.md](./quickstart.md) §6 in a desktop and a narrow mobile viewport, including step 19 — confirm that retrying a blocked reactivation reproduces the same reason and that the blocked company is no longer listed on the tab it left
- [X] T049 [P] Update the `#221` row in `specs/site-references/transport-resources/transport-companies/roadmap.md` to `implemented` with artifact `./reactivate-a-transport-company/`
- [ ] T050 Obtain a fresh read-only review of the final diff per constitution principle VII, resolving or explicitly justifying every confirmed finding (depends on T047, T048)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on Foundational; its use-case task (T025) depends on US1's use case (T015)
- **US3 (Phase 5)**: Depends on US1 and US2 — see the warnings in Phase 5
- **Polish (Phase 6)**: Depends on every story that is being shipped

### User Story Dependencies

- **US1 (P1)**: Independent. Delivers the complete single-reactivation path, authorization included.
- **US2 (P2)**: Layers guard ordering, negative-path proof, and interface gating onto US1. Independently testable.
- **US3 (P3)**: **Not independent.** It applies the rules US1 and US2 establish, at a second cardinality, and it generalises the shared blockers module that the delivered archive path also uses.

### Within Each User Story

- Tests are written first and must FAIL before implementation
- Repository contract before repository implementation before use case before controller before route
- Route registration and Tuyau regeneration before any web mutation or type that depends on it (T017 → T018, T039 → T040/T041)
- Web presentation component before its wiring into the workspace (T019 → T020 → T021, T042 → T043)
- In US3, the blockers generalisation and its archive regression check (T033, T034) come before anything that consumes the new signature

### Parallel Opportunities

- T004, T005, T006 are three different files with no shared edits — fully parallel
- T008–T013 (US1 tests), T022–T024 (US2 tests), and T028–T031 (US3 tests) are parallel within their story
- T044, T045, T046, and T049 are parallel
- **Not parallel despite appearances**: T004 and T032 both edit `transport_company_validator.ts`; T007 and T035 both edit `transport_company_repository.ts`; T014 and T036 both edit `lucid_transport_company_repository.ts` — and T034 edits it too; T016 and T038 both edit `transport_companies_controller.ts`; T017 and T039 both edit `routes.ts`; T019 and T042 are different files but both flow into the workspace edits T021 and T043. Sequence each group.
- **Also not parallel**: T008 and T009 both extend `tests/unit/transport_companies/lifecycle/reactivate.spec.ts`, and T010, T011, T012 all extend `tests/integration/transport_companies/lifecycle/reactivate.spec.ts`. They are listed `[P]` because they are independent pieces of work that can be written concurrently, but they must be committed to the same file in sequence.

---

## Parallel Example: User Story 1

```bash
# Launch the US1 test-writing tasks together, confirm they fail:
Task: "Happy-path unit spec in apps/api/tests/unit/transport_companies/lifecycle/reactivate.spec.ts"
Task: "No-blocker assertions in apps/api/tests/unit/transport_companies/lifecycle/reactivate.spec.ts"
Task: "Happy-path integration spec in apps/api/tests/integration/transport_companies/lifecycle/reactivate.spec.ts"
Task: "Coupling assertions in apps/api/tests/integration/transport_companies/lifecycle/reactivate.spec.ts"
Task: "Name-reservation regression in apps/api/tests/integration/transport_companies/lifecycle/reactivate.spec.ts"
Task: "Web success-path spec in apps/web/src/features/transport-companies/__tests__/lifecycle/reactivate.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: an administrator can reactivate an archived company end to end

Unlike #220, US1 alone is **already safe**: the policy ability guards the endpoint and the conditional write refuses both bad states from the first line of the repository. What US1 alone lacks is proof and polish, not correctness.

### Incremental Delivery

1. Setup + Foundational → exception, ability, validator, contract in place
2. US1 → single reactivation works, the lifecycle loop is closed → demo
3. US2 → guard ordering proven and the interface gated → **single reactivation is finished and shippable**
4. US3 → bulk reactivation on top of finished rules, blockers module generalised → demo

Stopping after US2 delivers a complete, coherent product behavior. US3 is the increment that answers the bulk request and can be deferred without leaving anything half-built — the only cost of deferring it is that `findBulkArchiveBlockers` stays archive-shaped a while longer.

### Parallel Team Strategy

US1 and US2 are a single vertical thread through the same use case and are best done by one developer in order. Genuine parallelism here is across layers rather than across stories: while one developer works the API thread (T014–T017, T025–T026), another can build the web changes (T019, T042) against the contracts in [contracts/http-api.md](./contracts/http-api.md), joining at the wiring tasks (T021, T043).

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks — except where the "Also not parallel" note above applies
- No migration in this slice; `apps/api/database/schema.ts` must not change
- No new shared validation rules; import `lifecycleComment()` and `lifecycleIds()` from `#shared/validators/lifecycle_validator`
- `apps/api/.adonisjs/` and the TanStack route tree are generated — commit what the generators produce, never hand-edit
- Verify tests fail before implementing
- Commit after each task or logical group, using Conventional Commits
- Stop at any checkpoint to validate independently
- **Never add a truck read to the reactivation path.** Its absence is the specified behavior (FR-006, SC-005), not an oversight
- **Never cascade-reactivate a company's trucks.** An archived truck stays archived when its company returns (FR-015)
- Reactivation preserves the archival context; it does not clear `archivedAt`, `archivedByUserId`, or `archiveComment`
