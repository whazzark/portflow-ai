---
description: "Task list for Maintain Transport Company Contact Details (GH-254)"
---

# Tasks: Maintain Transport Company Contact Details

**Input**: Design documents from `specs/site-references/transport-resources/transport-companies/maintain-transport-company-contact-details/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [quickstart.md](./quickstart.md)

**Tests**: Test tasks are **included and mandatory**. Constitution principle IV requires business behavior to follow RED → GREEN → REFACTOR, and plan.md commits to Japa API specs and router-level Vitest/MSW web specs as the primary seams.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task serves (US1–US5)
- Every task names the exact file it touches

## Path Conventions

PNPM/Turbo monorepo with two workspaces: `apps/api/` (AdonisJS) and `apps/web/` (TanStack Start). Paths below are repository-relative and match the structure in plan.md.

## Read this before starting

This slice **widens two delivered request contracts**. From T009 onward, `POST /api/v1/transport-companies` and `PATCH /api/v1/transport-companies/:id` refuse a body without `contactPhone` and `contactEmail`. The delivered `create.spec.ts` and `update.spec.ts` suites fail at that moment. That failure is the expected RED signal, not a regression; T023 and T034 repair them inside the stories that own each path. Do not "fix" it by relaxing the validator.

---

## Phase 1: Setup

**Purpose**: Establish a known-good baseline before changing shared files

- [X] T001 Confirm work is on branch `feat/254-transport-company-details` and the working tree is clean
- [X] T002 Capture a green baseline by running `pnpm check`, `pnpm typecheck`, and `pnpm test`, so any later failure is attributable to this slice
- [X] T003 [P] Create the directory `apps/api/app/shared/validators/`, the only new source directory in this slice; every other target file or directory already exists

**Checkpoint**: Baseline green, target directory exists

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The columns, the constraint, the shared validation and normalization modules, the widened boundaries, and the test datasets. None of these carry story behavior on their own, and every story depends on them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Add migration `apps/api/database/migrations/1785200000000_add_transport_companies_contact_details.ts` altering `transport_companies` to add nullable `contact_phone` (`varchar(32)`) and `contact_email` (`varchar(255)`), plus the check constraint `transport_companies_contact_details_check` asserting `(contact_phone IS NULL) = (contact_email IS NULL)` via `table.check(...)`, following the form of the existing `transport_companies_archived_at_check` in `apps/api/database/migrations/1784700000000_create_transport_companies_table.ts`; `down()` drops the constraint and both columns
- [X] T005 Apply the migration with `pnpm --filter @portflow/api db:fresh` and commit the regenerated `apps/api/database/schema.ts` without hand-editing it (depends on T004)
- [X] T006 [P] Create `apps/api/app/shared/validators/contact_validator.ts` exporting an `isAcceptedPhoneNumber(value: string): boolean` predicate implementing the format in [data-model.md](./data-model.md) — only digits and `+ - . ( )` and spaces, `+` only as the first character and at most once, 6–20 digits — and a `phoneNumber()` Vine rule built on that same predicate with `vine.createRule`, mirroring the shape of `nonBlank` in `apps/api/app/site_references/shared/site_reference_validator.ts`. The predicate and the rule must share one implementation so the boundary rule and the domain rule can never drift.
- [X] T007 [P] Add `InvalidTransportCompanyContactPhoneException` (422, `E_TRANSPORT_COMPANY_CONTACT_PHONE_INVALID`) and `InvalidTransportCompanyContactEmailException` (422, `E_TRANSPORT_COMPANY_CONTACT_EMAIL_INVALID`) to `apps/api/app/transport_companies/shared/transport_company_exceptions.ts`, alongside the three delivered exceptions
- [X] T008 Create `apps/api/app/transport_companies/shared/normalize_transport_company_contact.ts` exporting `MAX_CONTACT_PHONE_LENGTH = 32`, `MAX_CONTACT_EMAIL_LENGTH = 255`, `assertValidContactPhone(value)`, and `assertValidContactEmail(value)`; each trims, validates against the shared predicate (phone) or a syntactic email check (email) plus its maximum length, throws the matching exception from T007, and returns the trimmed value — mirroring `assertValidSiteReferenceName` in `apps/api/app/site_references/shared/normalize_site_reference.ts` (depends on T006, T007)
- [X] T009 Widen both validators in `apps/api/app/transport_companies/shared/transport_company_validator.ts`: `createTransportCompanyValidator` and `updateTransportCompanyValidator` each gain a required `contactPhone` (`vine.string().trim().use(nonBlank()).use(phoneNumber()).maxLength(32)`) and a required `contactEmail` (`vine.string().trim().use(nonBlank()).email().maxLength(255)`), leaving the delivered `name` rule untouched (depends on T006). **This is the task that turns the delivered create/update suites red.**
- [X] T010 [P] Widen `CreateTransportCompanyCommand` and `UpdateTransportCompanyCommand` in `apps/api/app/transport_companies/shared/repositories/transport_company_repository.ts` with `contactPhone: string` and `contactEmail: string`; leave `TransportCompanyWriteResult` unchanged — contact values have no uniqueness rule, so they produce no new persistence refusal
- [X] T011 [P] Add `contactPhone` and `contactEmail` to the `pick` list in `apps/api/app/transport_companies/shared/transport_company_transformer.ts`, so all four endpoints of the resource carry them
- [X] T012 Regenerate the Tuyau registry by running the ace codegen command and commit the generated output under `apps/api/.adonisjs/` unmodified; confirm `TransportCompanyDto` on the web now carries both fields as `string | null` (depends on T009, T011)
- [X] T013 [P] Add faker-driven `contactPhone` and `contactEmail` defaults to `apps/api/database/factories/transport_company_factory.ts`, plus a `withoutContact` state setting both to `null`, so every existing factory caller keeps producing valid rows
- [X] T014 [P] Add contact values to five of the six entries in `apps/api/database/fixtures/transport_companies.ts`, leaving **Noroît Logistique** with both fields `null` as the seeded stand-in for a company registered before this slice, per [data-model.md](./data-model.md)
- [X] T015 [P] Add contact values to the companies in `apps/web/src/features/transport-companies/__tests__/support/fixtures.ts`, add one company carrying `null` for both, and widen `createdTransportCompany` to accept and return them
- [X] T016 [P] Add both fields to the default transport-company payload in `apps/web/src/test/msw/handlers.ts` so suites outside this feature keep receiving contract-shaped responses
- [X] T017 Widen the POST and PATCH interception in `apps/web/src/features/transport-companies/__tests__/support/test-helpers.ts` to read `contactPhone` and `contactEmail` from the request body and echo them in the response, and add a failure helper that returns a `422` carrying two field errors (depends on T015)

**Checkpoint**: Columns and constraint live in the database, the input contract is widened, the boundaries and datasets carry the two fields — user stories can begin

---

## Phase 3: User Story 1 - Record and Correct How to Reach a Company (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator records and later corrects a company's phone number and email address through the existing edit panel, and the values become authoritative everywhere the company appears, with identity, name, lifecycle state, and lifecycle context preserved.

**Independent Test**: Sign in as an administrator, open an available company with no contact details, submit a valid phone number and email address, and confirm the details panel shows them while `id`, `name`, `status`, and archive/reactivation context are unchanged.

### Tests for User Story 1 ⚠️ Write first, confirm they FAIL

- [X] T018 [P] [US1] Write `apps/api/tests/unit/transport_companies/administration/contact_details.spec.ts` covering the update path through the real Lucid repository: contact details are recorded on a company that had none; existing values are replaced; `id`, `name`, `status`, `createdAt`, and every archive/reactivation field are preserved; `updatedAt` advances; values with surrounding whitespace are stored trimmed; resubmitting identical values succeeds
- [X] T019 [P] [US1] Write `apps/api/tests/integration/transport_companies/administration/contact_details.spec.ts` covering `PATCH /api/v1/transport-companies/:id` returning `200` with both fields populated in the complete representation, for both `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, and covering an update that changes only the name while preserving both contact values, per [contracts/http-api.md](./contracts/http-api.md)
- [X] T020 [P] [US1] Write `apps/web/src/features/transport-companies/__tests__/administration/contact-details.test.tsx` covering: the edit form is pre-filled with the company's current name, phone number, and email address; opening it for the company with no contact details shows both fields empty and required; a successful save confirms, returns to the details view, and the directory reflects the change

### Implementation for User Story 1

- [X] T021 [US1] Widen `UpdateTransportCompanyInput` and `handle` in `apps/api/app/transport_companies/update/update_transport_company_use_case.ts` to normalize both contact values with `assertValidContactPhone` and `assertValidContactEmail` at the same point where `assertValidSiteReferenceName` is already called, passing all three to `updateAvailable` (depends on T008, T010)
- [X] T022 [US1] Add `contactPhone` and `contactEmail` to the `.update({...})` payload of the existing single conditional statement in `updateAvailable` in `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts`, keeping the `WHERE id = ? AND status = 'AVAILABLE'` guard atomic with the write (depends on T010)
- [X] T023 [US1] Repair the delivered update suites turned red by T009: widen every request payload and use-case input in `apps/api/tests/unit/transport_companies/administration/update.spec.ts` and `apps/api/tests/integration/transport_companies/administration/update.spec.ts` to carry valid contact values, and add an assertion that a rename preserves both (depends on T009, T021, T022)
- [X] T024 [P] [US1] Widen `apps/web/src/features/transport-companies/ui/transport-company-form.tsx` with required `contactPhone` and `contactEmail` fields: extend the Zod schema to mirror the server rules, read `defaultValues` from `company?.contactPhone ?? ''` and `company?.contactEmail ?? ''`, trim both in the submit handler alongside `name`, and label the inputs "Contact phone" and "Contact email"
- [X] T025 [US1] Widen the `onUpdate` value type in `apps/web/src/features/transport-companies/ui/edit-transport-company-panel.tsx` and the update mutation payload built in `apps/web/src/features/transport-resources/ui/transport-resources-workspace.tsx` to carry all three fields (depends on T024)

**Checkpoint**: An administrator can record and correct contact details end to end; T018–T020 pass and the delivered update suites are green again

---

## Phase 4: User Story 2 - See How to Reach a Company From the Directory (Priority: P2)

**Goal**: Any active user consulting a transport company reads its phone number and email address, and sees one explicit "not recorded" message for a company registered before this slice.

**Independent Test**: With one company carrying contact details and one carrying none, consult both as an active non-administrator and confirm the first shows both values and the second shows a single explicit "no contact details recorded" message rather than blank fields.

### Tests for User Story 2 ⚠️ Write first, confirm they FAIL

- [X] T026 [P] [US2] Write `apps/web/src/features/transport-companies/__tests__/details/contact.test.tsx` covering: a migrated company shows both values under a labelled contact section; the un-migrated company shows one explicit "no contact details recorded" message and no blank fields; the contact section is readable on an archived company; an observer reads it and is offered no action to change it
- [X] T027 [P] [US2] Extend `apps/api/tests/integration/transport_companies/consultation/list.spec.ts` and `available.spec.ts` to assert both fields are present in the payload — populated for a company with contact details and `null` for one without — and that an active `OBSERVER` receives them

### Implementation for User Story 2

- [X] T028 [US2] Add a contact section to `apps/web/src/features/transport-companies/ui/transport-company-details.tsx`, placed between the identity fields and the lifecycle section: when both values are present render two `ResourceDetailField`s labelled "Contact phone" and "Contact email"; when both are absent render a single explicit "No contact details recorded" message instead. Do not use the component's per-field "Not specified" fallback here — FR-004 makes a half-recorded contact impossible, so a section-level statement is the only truthful empty state.

**Checkpoint**: Contact details are readable by every active user, with an honest empty state; US1 still passes

---

## Phase 5: User Story 3 - Capture Contact Details When Registering a Company (Priority: P3)

**Goal**: An administrator records a new company's phone number and email address in the same submission that registers it, so no company enters the directory unreachable.

**Independent Test**: Create a company supplying a name, a phone number, and an email address, and confirm it is immediately consultable with all three; then attempt a creation missing either contact field and confirm it is refused with nothing created.

### Tests for User Story 3 ⚠️ Write first, confirm they FAIL

- [X] T029 [P] [US3] Extend `apps/api/tests/unit/transport_companies/administration/contact_details.spec.ts` with the creation path: the use case records both trimmed values through the real Lucid repository, and a created company satisfies the check constraint
- [X] T030 [P] [US3] Extend `apps/api/tests/integration/transport_companies/administration/contact_details.spec.ts` with `POST /api/v1/transport-companies` returning `201` with both fields populated, and with a creation missing either contact field returning `422` and creating nothing
- [X] T031 [P] [US3] Extend `apps/web/src/features/transport-companies/__tests__/administration/create.test.tsx` so the create flow fills all three fields, asserts the created company's details panel shows the contact section populated, and asserts a submission missing either contact field is blocked before it reaches the API

### Implementation for User Story 3

- [X] T032 [US3] Widen `CreateTransportCompanyInput` and `handle` in `apps/api/app/transport_companies/create/create_transport_company_use_case.ts` to normalize both contact values with `assertValidContactPhone` and `assertValidContactEmail` beside the existing name normalization (depends on T008, T010)
- [X] T033 [US3] Pass both fields through in `create` in `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts`; the existing spread already forwards command fields, so confirm both reach the insert and are not dropped alongside the explicitly-nulled lifecycle columns (depends on T010)
- [X] T034 [US3] Repair the delivered creation suites turned red by T009: widen every request payload and use-case input in `apps/api/tests/unit/transport_companies/administration/create.spec.ts` and `apps/api/tests/integration/transport_companies/administration/create.spec.ts` to carry valid contact values (depends on T009, T032, T033)
- [X] T035 [US3] Widen the `onCreate` value type in `apps/web/src/features/transport-companies/ui/create-transport-company-panel.tsx` and the create mutation payload built in `apps/web/src/features/transport-resources/ui/transport-resources-workspace.tsx` to carry all three fields (depends on T024)

**Checkpoint**: Every newly registered company is reachable; the delivered creation suites are green again

---

## Phase 6: User Story 4 - Be Prevented From Saving Unusable Contact Details (Priority: P4)

**Goal**: Missing and malformed contact details are refused with distinct, understandable feedback on both write paths, every offending field is reported at once, and no partial change is applied.

**Independent Test**: Submit each contact field missing, blank, malformed, and over-long on both the create and the update path; confirm each is refused, that a submission with three bad fields reports all three, and that the stored company keeps its previously recorded values.

### Tests for User Story 4 ⚠️ Write first, confirm they FAIL

- [X] T036 [P] [US4] Write a domain-rule spec in `apps/api/tests/unit/transport_companies/administration/contact_details.spec.ts` for `assertValidContactPhone` and `assertValidContactEmail`: `+33 2 40 12 34 56`, `02.40.12.34.56`, and `(02) 40-12-34-56` are accepted and returned trimmed; `+`, `()`, `12345`, and a 33-character number are refused with `InvalidTransportCompanyContactPhoneException`; `not-an-email` and a 256-character address are refused with `InvalidTransportCompanyContactEmailException`; a 20-digit number and a 255-character address are accepted
- [X] T037 [P] [US4] Extend `apps/api/tests/integration/transport_companies/administration/contact_details.spec.ts` with the boundary refusals on **both** `POST` and `PATCH`: missing, blank, whitespace-only, malformed, and over-long values each return `422 E_VALIDATION_ERROR` with a field-level message on the offending field; a submission carrying an invalid name, phone, and email reports all three fields in one response; nothing is written in any case; and a refused update leaves previously recorded values untouched
- [X] T038 [P] [US4] Extend `apps/api/tests/integration/transport_companies/administration/contact_details.spec.ts` with the non-uniqueness case: two different companies recording the same phone number and the same email address are both accepted, proving FR-014 has no accidental constraint behind it
- [X] T039 [P] [US4] Extend `apps/web/src/features/transport-companies/__tests__/administration/contact-details.test.tsx` with the refusal loop: a `422` carrying two field errors attaches one message to the phone input and one to the email input; a non-field error surfaces as a Sonner toast; correcting the values and resubmitting succeeds without reopening the company; cancelling leaves the company unchanged

### Implementation for User Story 4

- [X] T040 [US4] Confirm the widened validators from T009 report every offending field in one `422` rather than short-circuiting on the first, and that each rule's message names its field; adjust the rule definitions in `apps/api/app/shared/validators/contact_validator.ts` and `apps/api/app/transport_companies/shared/transport_company_validator.ts` if the emitted `details[]` does not match [contracts/http-api.md](./contracts/http-api.md) (depends on T009, T037)
- [X] T041 [US4] Confirm the form's error handling in `apps/web/src/features/transport-companies/ui/transport-company-form.tsx` attaches server field errors to the right inputs — the Zod field names, the Vine field names, and the `details[].field` values must all be `contactPhone` and `contactEmail` — keeping the existing `applyValidationError` then `parseApiError` fallback intact (depends on T024, T039)

**Checkpoint**: Every refusal in FR-022 that originates in validation is observable, distinct, and non-destructive on both paths

---

## Phase 7: User Story 5 - Be Blocked From Maintaining What Must Not Change (Priority: P5)

**Goal**: Contact-detail changes are refused for users without administration rights, for archived companies, and for companies that no longer exist, with the API authoritative regardless of what the interface offers.

**Independent Test**: Attempt contact changes as an unauthenticated visitor, as an active observer, on an archived company, and on an unknown id; confirm each is refused with its documented status and that any previously recorded contact is untouched.

**Note**: The policy abilities and the `WHERE status = 'AVAILABLE'` guard that produce these refusals were delivered by #218 and #219 and are unchanged by this slice. This story is therefore mostly proof rather than new code — implement nothing unless a test below proves the widened command broke an existing guarantee.

### Tests for User Story 5 ⚠️ Write first, confirm they FAIL

- [X] T042 [P] [US5] Extend `apps/api/tests/integration/transport_companies/administration/contact_details.spec.ts` with, on both `POST` and `PATCH`: unauthenticated returns `401 E_UNAUTHORIZED_ACCESS`; an active `OBSERVER` returns `403 E_AUTHORIZATION_FAILURE`; a non-administrator submitting a malformed phone number for an archived company receives `403`, proving the check ordering in [contracts/http-api.md](./contracts/http-api.md)
- [X] T043 [P] [US5] Extend `apps/api/tests/integration/transport_companies/administration/contact_details.spec.ts` with: updating an archived company returns `409 E_TRANSPORT_COMPANY_ARCHIVED`; an unknown id returns `404 E_TRANSPORT_COMPANY_NOT_FOUND`; and in both cases the stored company, including any recorded contact, is unchanged
- [X] T044 [P] [US5] Extend `apps/api/tests/unit/transport_companies/administration/contact_details.spec.ts` with: `updateAvailable` returns `ARCHIVED` for an archived company and `NOT_FOUND` for an unknown id when the command carries contact values, and a company archived between load and write is refused rather than updated
- [X] T045 [P] [US5] Extend `apps/web/src/features/transport-companies/__tests__/administration/permissions.test.tsx` with: an observer sees the contact section but no create or edit affordance anywhere, and `?companyDetailsMode=edit` opens no form for them; an administrator viewing an archived company sees the contact section read-only with no edit affordance

### Implementation for User Story 5

- [X] T046 [US5] Confirm no change is required in `apps/api/app/transport_companies/shared/transport_company_policy.ts` — `create` and `update` already grant exactly `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`, and `list` / `listAvailable` stay open to every active user, which is what makes the contact readable by non-administrators under FR-019. Record the confirmation; add code only if T042 or T045 fails.
- [X] T047 [US5] Confirm the failure path of `updateAvailable` in `apps/api/app/transport_companies/shared/repositories/lucid_transport_company_repository.ts` still distinguishes `ARCHIVED` from `NOT_FOUND` after the widened `UPDATE`, and that the refusal writes nothing (depends on T022, T044)

**Checkpoint**: All five stories pass independently; every refusal in FR-022 is observable and distinct

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T048 [P] Prove the check constraint directly: add a spec to `apps/api/tests/integration/transport_companies/administration/contact_details.spec.ts` that persists a company with exactly one of the two values set, bypassing the validator through the model, and asserts the database rejects it via `transport_companies_contact_details_check`
- [X] T049 [P] Confirm the directory search filter is untouched by running `apps/web/src/features/transport-companies/helpers/transport-company-search.test.ts`; `transportCompanyMatchesSearch` must still match on company name only, since no functional requirement asks for searching by contact
- [X] T050 [P] Confirm the neighbouring suites still pass unchanged: `pnpm --dir apps/web exec vitest run src/features/transport-resources src/features/trucks` and the `tests/*/trucks/` Japa specs, which read transport companies from the same collection and factory
- [X] T051 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` and resolve every failure
- [ ] T052 Walk the full browser flow in [quickstart.md](./quickstart.md) section 5 in a desktop and a narrow mobile viewport, paying particular attention to steps 11 and 12 — the un-migrated company's empty state and its forced contact capture on first edit
- [X] T053 Obtain a fresh read-only review of the final diff and resolve or explicitly justify every confirmed finding, per constitution principle VII

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **blocks all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on Foundational only — it is a read-path story and does not depend on US1
- **User Story 3 (Phase 5)**: Depends on Foundational; its web task shares `transport-company-form.tsx` with US1, so it is sequenced after T024
- **User Story 4 (Phase 6)**: Depends on Foundational and on both write paths existing (US1 and US3)
- **User Story 5 (Phase 7)**: Depends on Foundational and on US1; independent of US2, US3, and US4
- **Polish (Phase 8)**: Depends on all desired stories being complete

### Story Dependencies

This feature widens one resource's two existing write paths and one existing details panel, so the stories share files more than a typical multi-entity feature. They remain independently **testable and demonstrable**, but not fully independently **implementable**:

- **US1 (P1)**: Fully independent once Foundational is done. Delivers the update path and the widened form — the largest single increment.
- **US2 (P2)**: Genuinely independent of US1. It reads fields that Foundational already exposes through the transformer, so it can be built by a second developer in parallel with US1 from the moment Phase 2 closes.
- **US3 (P3)**: Independently testable. Reuses the form widened by US1 rather than duplicating it, so it is sequenced after T024.
- **US4 (P4)**: Independently testable. Proves rules that Foundational's validators already carry, across both write paths, so it follows US1 and US3.
- **US5 (P5)**: Independently testable and almost entirely verification — the guards it exercises were delivered by #218 and #219.

### Within Each Story

- Tests are written first and must FAIL before implementation
- Domain normalizers before use cases, use cases before repository wiring assertions
- API contract before the web form that consumes it
- Story complete before moving to the next priority

### Parallel Opportunities

- T006, T007, T010, T011, T013, T014, T015, T016 in Foundational touch different files and can run together; T008, T009, T012, T017 each wait on one of them
- T018, T019, T020 in US1 can be written together
- US2 can run entirely in parallel with US1 once Phase 2 closes — T026, T027, and T028 touch files no US1 task edits
- T029, T030, T031 in US3 can be written together
- T036, T037, T038, T039 in US4 can be written together
- T042, T043, T044, T045 in US5 can be written together
- T048, T049, T050 in Polish can run together
- Note the two shared files that serialize otherwise-parallel work: `transport-company-form.tsx` (T024, T041) and `transport-resources-workspace.tsx` (T025, T035)

---

## Parallel Example: Foundational and User Story 1

```bash
# Foundational — eight independent files at once:
Task: "Shared phoneNumber rule in apps/api/app/shared/validators/contact_validator.ts"
Task: "Two contact exceptions in apps/api/app/transport_companies/shared/transport_company_exceptions.ts"
Task: "Widen repository commands in transport_company_repository.ts"
Task: "Expose both fields in transport_company_transformer.ts"
Task: "Factory contact defaults and withoutContact state"
Task: "API fixtures with one deliberately un-migrated company"
Task: "Web fixtures with one company carrying no contact"
Task: "Default payload in apps/web/src/test/msw/handlers.ts"

# US1 — write all three failing specs together:
Task: "Update-path unit spec in tests/unit/transport_companies/administration/contact_details.spec.ts"
Task: "PATCH integration spec in tests/integration/transport_companies/administration/contact_details.spec.ts"
Task: "Web success-path spec in __tests__/administration/contact-details.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — the migration and the widened validators are the critical items
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: an administrator can record and correct a company's contact details end to end
5. Demo if ready

Note the MVP caveat: after US1 alone the update path works and the delivered suites are green, but the details panel does not yet display what was recorded (US2) and creation still cannot carry contact details even though the API now demands them (US3). US1 is demonstrable through the API and the form, not shippable on its own — **US3 in particular is not optional**, because T009 makes creation impossible until the create panel is widened.

### Incremental Delivery

1. Setup + Foundational → columns, constraint, and widened contract in place
2. US1 → recording and correcting works end to end → demo
3. US2 → the recorded contact becomes visible in the directory, with an honest empty state
4. US3 → new companies are born reachable, and creation works again
5. US4 → every missing or malformed value is refused distinctly on both paths
6. US5 → authorization and lifecycle guards proven intact under the widened command
7. Polish → constraint proof, neighbouring suites, repository-wide verification, browser flow, fresh review

### Parallel Team Strategy

1. One developer completes Setup + Foundational
2. Developer A takes US1 (critical path); Developer B takes US2 in parallel from the moment Phase 2 closes
3. Once T024 lands, Developer B picks up US3
4. US4 and US5 split between them once both write paths exist
5. Both converge on Polish

---

## Notes

- `apps/api/database/schema.ts` and everything under `apps/api/.adonisjs/` are generated. Regenerate and commit them; never hand-edit.
- The columns are nullable in the database while being required by the application. That is deliberate and load-bearing: FR-018 forbids backfilling the companies registered before this slice with placeholder values. The check constraint is what keeps the only genuinely corrupt state — exactly one of the two set — unrepresentable.
- No unique index is added for contact values. FR-014 makes them explicitly non-unique; T038 exists to keep that true.
- No contact history is written, no lifecycle actor or comment is recorded, and no message is ever sent to a recorded contact.
- Commit after each task or logical group, using Conventional Commits.
- Stop at any checkpoint to validate a story independently.
