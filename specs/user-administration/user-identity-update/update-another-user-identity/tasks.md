---

description: "Task list for Update Another User Identity (GH-24)"
---

# Tasks: Update Another User Identity

**Input**: Design documents from `specs/user-administration/user-identity-update/update-another-user-identity/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included, and not optional here. Constitution Principle IV requires RED → GREEN →
REFACTOR for observable business behavior, and [research.md](./research.md) D12 fixes the order:
repository outcomes → use-case decisions → endpoint matrix → workbench journeys.

**Organization**: Tasks are grouped by the five user stories of [spec.md](./spec.md). The API and
web halves of a story sit in the same phase, because a slice here is vertical (`AGENTS.md`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: US1…US5, matching the user stories of the specification
- Every task names its exact file path

## Path conventions

Monorepo: `apps/api` (AdonisJS, vertical slices under `app/<domain>/<workflow>`) and `apps/web`
(TanStack Start, features under `src/features/<feature>`). Tests live in `apps/api/tests/{unit,integration}/`
and `apps/web/src/features/<feature>/__tests__/`.

## A note on how these stories divide

One endpoint serves all five stories, so the substrate they share — the table, the model, the
exceptions, the validator, the policy, the port — is Phase 2 and belongs to no story. The stories
then divide by **behavior on that seam**: US1 applies a correction, US2 decides who may, US3 decides
what is acceptable, US4 accounts for it, US5 survives failure. US1 is the only phase that must ship
for the feature to exist; the others harden, prove, and expose it.

Recording a history row is part of US1's atomic write (FR-011 and FR-013 make the row inseparable
from the correction). **Presenting** that history is US4.

---

## Phase 1: Setup

**Purpose**: Make the working tree ready for the slice.

- [X] T001 Create the API slice and test directories: `apps/api/app/users/identity/`, `apps/api/tests/unit/users/identity/`, `apps/api/tests/integration/users/identity/`
- [X] T002 [P] Create the web test directory `apps/web/src/features/users/__tests__/identity/`
- [X] T003 Confirm the Tuyau registry regenerates: run `pnpm --filter @portflow/api dev` once and verify `apps/api/.adonisjs/client/registry/` rebuilds, per [quickstart.md](./quickstart.md)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The substrate every story needs. No user-visible behavior is delivered here.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

- [X] T004 Create the migration `apps/api/database/migrations/1785700000000_create_user_identity_changes_table.ts` with the columns, foreign keys, and `(user_id, changed_at)` index of [data-model.md](./data-model.md)
- [X] T005 Create the model `apps/api/app/models/user_identity_change.ts` with the `@beforeCreate` uuid assignment and the `changedBy` `belongsTo` relation
- [X] T006 Add the `identityChanges` `hasMany` relation to `apps/api/app/models/user.ts`
- [X] T007 [P] Create `apps/api/database/factories/user_identity_change_factory.ts` in the shape of `user_factory.ts`
- [X] T008 [P] Create `apps/api/app/users/shared/user_exceptions.ts` with the five exceptions and their statuses and codes from [research.md](./research.md) D8
- [X] T009 [P] Create `apps/api/app/users/shared/normalize_user_identity.ts` — trim the three fields, assert the name rules, mirroring `#site_references/shared/normalize_site_reference`
- [X] T010 [P] Create `apps/api/app/users/shared/user_validator.ts` exporting `updateUserIdentityValidator` with the three required fields of [contracts/patch-user-identity.md](./contracts/patch-user-identity.md)
- [X] T011 [P] Create `apps/api/app/users/shared/activation_link_issuer.ts` — the abstract port plus the implementation that reports the capability unavailable ([research.md](./research.md) D7)
- [X] T012 Bind `ActivationLinkIssuer` in `apps/api/providers/repositories_provider.ts` next to the existing repository bindings
- [X] T013 Add `findByIdForUpdate` and `applyIdentity`, with its typed outcome union (`UPDATED`, `NOT_FOUND`, `EMAIL_TAKEN`), to the abstraction `apps/api/app/users/shared/repositories/user_repository.ts` — two operations rather than one, because the use case owns the transaction that also holds the activation link ([research.md](./research.md) D5)
- [X] T014 Add `updateIdentity(viewer)` to `apps/api/app/users/shared/user_policy.ts` — active `ORGANIZATION_ADMIN` only

**Checkpoint**: the table exists, the vocabulary exists, the seam is declared. Stories can begin.

---

## Phase 3: User Story 1 — Correct Another User's Identity (Priority: P1) 🎯 MVP

**Goal**: An organization admin corrects another user's first name, last name, and email, and sees
the correction everywhere that user is named, with nothing else about the user disturbed.

**Independent Test**: Sign in as an organization admin, open another user from `/users`, change the
identity, confirm — the collection, the record, and the avatar initials carry the correction, and the
user's role, access status, lifecycle events, and password renewal state are unchanged.

### Tests for User Story 1 ⚠️ write first, watch them fail

- [X] T015 [P] [US1] Repository test in `apps/api/tests/unit/users/identity/identity_history.spec.ts`: `applyIdentity` returns `UPDATED` with the reloaded user, writes the three columns and `updated_at`, inserts exactly one history row carrying the previous and new identity, resolves the responsible administrator, and returns `NOT_FOUND` for an unknown id
- [X] T016 [P] [US1] Use-case test in `apps/api/tests/unit/users/identity/update_user_identity.spec.ts`: an identical submission writes no column and inserts no history row — the short circuit sits in the use case, above the repository (FR-013, [research.md](./research.md) D10)
- [X] T017 [P] [US1] Use-case test in `apps/api/tests/unit/users/identity/update_user_identity.spec.ts`: a valid correction of an active user is applied; a `PENDING` target whose email changes calls the issuer and, when it reports unavailable, raises `ActivationLinkUnavailableException` with nothing written; a `PENDING` target whose name alone changes never calls the issuer
- [X] T018 [P] [US1] Integration test in `apps/api/tests/integration/users/identity/update.spec.ts`: `200` with the corrected `toAdministration` body; targets in each of the four access statuses behave per [quickstart.md](./quickstart.md); the pending-email case answers `409 E_USER_ACTIVATION_LINK_UNAVAILABLE` and leaves the row untouched
- [X] T019 [P] [US1] Integration test in `apps/api/tests/integration/users/identity/update.spec.ts`: after a correction, `role`, `accessStatus`, every lifecycle column, `password`, and `passwordRenewalRequiredAt` are unchanged and no remember-me token is revoked (FR-011)
- [X] T020 [P] [US1] Web feature test in `apps/web/src/features/users/__tests__/identity/edit.test.tsx`: an organization admin opens a user, edits the identity, submits, and the row, the record, and the initials follow; `?userId=…&mode=edit` opens the panel directly on reload; "Back to details" leaves without changing anything

### Implementation for User Story 1

- [X] T021 [US1] Implement `findByIdForUpdate` and `applyIdentity` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`: the locked read, then — inside the caller's transaction — capture the previous identity, `UPDATE` the three columns and `updated_at`, `INSERT` the history row, reload with actors, return the typed outcome ([research.md](./research.md) D5)
- [X] T022 [US1] Create `apps/api/app/users/identity/update_user_identity_use_case.ts`: own the transaction, normalize the input, short-circuit an unchanged submission, invoke `ActivationLinkIssuer` inside that transaction when the target is `PENDING` and the email actually changes, map every outcome to its exception
- [X] T023 [US1] Add `update` to `apps/api/app/controllers/users_controller.ts`: authorize with `UserPolicy.updateIdentity`, validate, call the use case, serialize with the `toAdministration` variant
- [X] T024 [US1] Register `router.patch('/:id', [controllers.Users, 'update']).as('update')` in the `/users` group of `apps/api/start/routes.ts`
- [X] T025 [P] [US1] Create `apps/web/src/features/users/mutations/use-user-mutations.ts` wrapping `tuyauQuery.users.update.mutationOptions` and invalidating `userQueries.list()` on success, in the shape of `use-truck-mutations.ts`
- [X] T026 [US1] Add `mode: 'view' | 'edit'` to the Zod search schema of `apps/web/src/routes/_authenticated/users.tsx`, defaulting to `view`, cleared in `transform` when no `userId` is open
- [X] T027 [P] [US1] Create `apps/web/src/features/users/ui/user-identity-form.tsx` with `useAppForm`, the registered field components, `applyApiError`, `FormError`, and `SubmitButton`
- [X] T028 [US1] Create `apps/web/src/features/users/ui/edit-user-identity-panel.tsx`, left through its header's "Back to details", per `apps/web/AGENTS.md`
- [X] T029 [US1] Switch `apps/web/src/features/users/ui/user-sheet.tsx` on `mode` between `UserAccessRecord` and `EditUserIdentityPanel`
- [X] T030 [US1] Add the `Edit` entry point to `apps/web/src/features/users/ui/user-access-record.tsx` and remove the file's "read-only by design" comment, which this feature makes false
- [X] T031 [P] [US1] Add `USER_SINGULAR` to `apps/web/src/features/users/helpers/user-labels.ts` and build the toasts from the existing `resourceSuccessMessage` / `resourceFailureTitle` in `apps/web/src/helpers/resource-copy.ts` — the feature brings its noun, never its own phrasing

**Checkpoint**: an administrator can repair an identity end to end. This is the MVP.

---

## Phase 4: User Story 2 — Restrict Identity Correction to the Responsible Administrator (Priority: P1)

**Goal**: Only an active organization admin may correct another user, never themselves, and the
workbench offers the action to nobody the API would refuse.

**Independent Test**: Attempt the correction as each role, unauthenticated, as a non-active user, and
on your own record, and verify each outcome at the API seam; then verify no unauthorized viewer is
offered the action in the workbench.

### Tests for User Story 2 ⚠️ write first, watch them fail

- [X] T032 [P] [US2] Integration test in `apps/api/tests/integration/users/identity/update.spec.ts`: the full authorization matrix of [contracts/patch-user-identity.md](./contracts/patch-user-identity.md) — `401` unauthenticated, `403` for operations admin, operations lead, observer, and any non-active viewer, `200` for an active organization admin
- [X] T033 [P] [US2] Integration test in `apps/api/tests/integration/users/identity/update.spec.ts`: an administrator targeting themselves gets `403 E_USER_IDENTITY_SELF_UPDATE` and nothing is written; an unknown id gets `404 E_USER_NOT_FOUND`
- [X] T034 [P] [US2] Use-case test in `apps/api/tests/unit/users/identity/update_user_identity.spec.ts`: the self-target refusal is decided by the use case, before any write
- [X] T035 [P] [US2] Web feature test in `apps/web/src/features/users/__tests__/identity/permissions.test.tsx`: an operations admin sees no `Edit` action anywhere; an organization admin sees none on their own record; a hand-typed `?mode=edit` opens nothing in either case

### Implementation for User Story 2

- [X] T036 [US2] Raise `SelfIdentityUpdateException` in `apps/api/app/users/identity/update_user_identity_use_case.ts` when the target is the requesting administrator, with a message pointing at the self-service path GH-25 delivers
- [X] T037 [US2] Gate the `Edit` entry point in `apps/web/src/features/users/ui/user-access-record.tsx` on an organization-admin viewer whose id differs from the open user's
- [X] T038 [US2] Gate `mode=edit` in `apps/web/src/features/users/ui/user-sheet.tsx` so an ungated mode falls back to the record rather than opening the panel

**Checkpoint**: the seam is closed, and the interface is honest about it.

---

## Phase 5: User Story 3 — Reject an Invalid or Conflicting Identity (Priority: P1)

**Goal**: An incomplete, malformed, or already-used identity is refused with the field at fault
named, nothing is changed, and what the administrator typed survives.

**Independent Test**: Submit blank, over-long, and malformed values, then an address another user
already holds in a different casing and padded with spaces, and verify each refusal names its field,
changes nothing, and preserves the form.

### Tests for User Story 3 ⚠️ write first, watch them fail

- [X] T039 [P] [US3] Integration test in `apps/api/tests/integration/users/identity/update.spec.ts`: blank, whitespace-only, over-long, and malformed values each answer `422` naming the field, with the stored identity unchanged
- [X] T040 [P] [US3] Integration test in `apps/api/tests/integration/users/identity/update.spec.ts`: an address held by another user answers `409 E_USER_EMAIL_CONFLICT` for every access status of that other user, and for case- and whitespace-variant spellings, with neither user changed
- [X] T041 [P] [US3] Repository test in `apps/api/tests/unit/users/identity/identity_history.spec.ts`: a concurrent insert of the same address surfaces as the `EMAIL_TAKEN` outcome through the unique-index violation, not as an unhandled error
- [X] T042 [P] [US3] Web feature test in `apps/web/src/features/users/__tests__/identity/edit.test.tsx`: a `422` maps onto the field at fault, a `409 E_USER_EMAIL_CONFLICT` maps onto the email field, and in both cases the typed values are still there

### Implementation for User Story 3

- [X] T043 [US3] Apply `normalize_user_identity` in `apps/api/app/users/identity/update_user_identity_use_case.ts` and raise `InvalidUserIdentityException` for a value that survives VineJS but fails the domain rule
- [X] T044 [US3] Add the free-address pre-check and the `isUniqueViolation` catch to `updateIdentity` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`, both resolving to the `EMAIL_TAKEN` outcome ([research.md](./research.md) D6)
- [X] T045 [US3] Map `EMAIL_TAKEN` to `DuplicateUserEmailException` in `apps/api/app/users/identity/update_user_identity_use_case.ts`
- [X] T046 [US3] Map the refusal codes onto their fields in `apps/web/src/features/users/ui/user-identity-form.tsx` through `applyApiError`, keeping the entered values

**Checkpoint**: a correction can no longer degrade the collection it was meant to repair.

---

## Phase 6: User Story 4 — Account for Who Changed an Identity (Priority: P2)

**Goal**: An organization admin can see, on a user's record, every correction with its date, its
responsible administrator, and the identity before and after it — and an operations admin sees none
of it.

**Independent Test**: Correct a user as one organization admin, consult that user as another, and
verify the history; then consult the same user as an operations admin and verify the key is absent.

### Tests for User Story 4 ⚠️ write first, watch them fail

- [X] T047 [P] [US4] Integration test in `apps/api/tests/integration/users/consultation/list.spec.ts`: an organization admin's collection carries `identityChanges` with `changedBy` resolved and oldest first; an operations admin's payload has no such key at all, and the rest of their payload is unchanged
- [X] T048 [P] [US4] Integration test in `apps/api/tests/integration/users/identity/update.spec.ts`: successive corrections accumulate, and an entry survives the deactivation or the renaming of the administrator who made it
- [X] T049 [P] [US4] Web feature test in `apps/web/src/features/users/__tests__/identity/history.test.tsx`: the history renders date, administrator, and only the parts that actually changed; a never-corrected user renders no section at all; an entry with a null administrator still renders

### Implementation for User Story 4

- [X] T050 [US4] Add `identityChanges` to `toAdministration()` in `apps/api/app/users/shared/transformers/user_transformer.ts`, emitted through the existing `this.when(includeAccessHistory, …)` gate, leaving `toObject()` and `toSummary()` untouched
- [X] T051 [US4] Preload the identity changes and their `changedBy` actor in `list()` — and deliberately not in `listActive()` — in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`
- [X] T052 [P] [US4] Create `apps/web/src/features/users/ui/user-identity-history.tsx` rendering the entries oldest first, naming only the parts that differ
- [X] T053 [US4] Render the history below the access history in `apps/web/src/features/users/ui/user-access-record.tsx`, rendering nothing when the list is empty or the key is absent
- [X] T054 [P] [US4] Extend `apps/web/src/features/users/__tests__/support/fixtures.ts` with users carrying identity-change history

**Checkpoint**: an administrative rename can be explained without a database investigation.

---

## Phase 7: User Story 5 — Recover From a Failed Correction (Priority: P3)

**Goal**: A correction that cannot be applied is reported unambiguously, never presented as applied,
retryable without losing input, and never interleaved with a concurrent one.

**Independent Test**: Make the update fail transiently, verify the failure is reported and the
presented identity is unchanged, retry successfully; then run two concurrent corrections of the same
user and verify one complete identity and one reported refusal.

### Tests for User Story 5 ⚠️ write first, watch them fail

- [X] T055 [P] [US5] Repository test in `apps/api/tests/unit/users/identity/identity_history.spec.ts`: two concurrent corrections of the same user leave one complete identity and exactly two consistent history rows — never a mixed identity (SC-004, and the edge case on interleaving)
- [X] T056 [P] [US5] Web feature test in `apps/web/src/features/users/__tests__/identity/recovery.test.tsx`: a `5xx` or network failure shows a `FormError` with a retry, the collection still shows the previous identity, the typed values survive, and the retry succeeds without a new sign-in
- [X] T057 [P] [US5] Web feature test in `apps/web/src/features/users/__tests__/identity/recovery.test.tsx`: a user changed by someone else since the panel was opened yields an outcome reflecting current state, never a success over information the administrator never saw

### Implementation for User Story 5

- [X] T058 [US5] Report transient failures through `FormError` in `apps/web/src/features/users/ui/user-identity-form.tsx`, keeping the panel open, the input intact, and the submit button as the retry
- [X] T059 [US5] Keep the record on the invalidated collection in `apps/web/src/features/users/ui/user-sheet.tsx`, so a corrected user leaving the visible view closes the record instead of showing stale values
- [X] T060 [US5] Report the failure with the existing `resourceFailureTitle` from `apps/web/src/helpers/resource-copy.ts` — no new copy: a refused correction and a failed one read alike, which is what that helper is for

**Checkpoint**: a lost correction is impossible to mistake for an applied one.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T061 [P] Update the stale "read-only by design" comment in `apps/web/src/features/users/ui/user-access-record.tsx` and the `/edit/i` assertion in `apps/web/src/features/users/__tests__/record/record.test.tsx`, both of which this feature supersedes
- [X] T062 [P] Re-read `apps/api/app/users/identity/update_user_identity_use_case.ts` for the repository's comment convention: explain the pending-email rollback and the unchanged-submission short circuit, since neither is obvious from the code
- [ ] T063 Run the seven-step browser pass of [quickstart.md](./quickstart.md) against a fresh `db:fresh` — **not run**: `portflow-postgres` on port 5433 is shared with the sibling worktrees currently working in this repository, and `db:fresh` drops and recreates that database. It is the operator's to run.
- [X] T064 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` at the repository root — `check` and `typecheck` clean; API 438 unit + 599 integration green; the web suite is green per file and per feature, while a full parallel `vitest run` on a loaded machine times out ~17 unrelated tests across trucks, docks, customers, warehouse doors, and transport companies (they pass in isolation, and the same failures reproduce on unmodified sources)
- [ ] T065 Obtain a fresh read-only review of the final diff (`git diff master...HEAD`) and resolve or explicitly justify every confirmed finding — **not run**: a fresh review is triggered by the operator, not from inside the implementing session

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependency.
- **Foundational (Phase 2)**: depends on Setup. **Blocks every story.**
- **US1 (Phase 3)**: depends on Foundational. Delivers the endpoint the other four stories act on.
- **US2 (Phase 4)**, **US3 (Phase 5)**: depend on US1's endpoint existing. Independent of each other.
- **US4 (Phase 6)**: depends on US1 writing history rows. Independent of US2 and US3.
- **US5 (Phase 7)**: depends on US1. Independent of US2, US3, US4.
- **Polish (Phase 8)**: depends on everything shipped.

This is one endpoint, not five, so the stories are not mutually independent in the way a
multi-endpoint feature's would be. US1 is the trunk; US2 through US5 are independent of **each
other** and can be delivered, tested, and reviewed in any order once US1 is green.

### Within each story

- Tests first, failing, then implementation — Constitution Principle IV.
- Repository before use case, use case before controller, controller before route.
- API before the web half of the same story: the web reads the Tuyau registry the API generates.

### Parallel opportunities

- **Phase 2**: T007, T008, T009, T010, T011 touch five different new files — all parallel. T004 → T005 → T006 is a chain; T012 waits on T011; T013 and T014 edit two different existing files.
- **Phase 3 tests**: T015–T020 are six different files or independent cases — all parallel.
- **Phase 3 implementation**: T025, T027, T031 are new web files, parallel with each other and with the API chain T021 → T022 → T023 → T024.
- **Phase 4, 5, 6, 7**: each phase's test tasks are parallel; across phases, US2, US3, US4, and US5 can be staffed simultaneously once US1 is green.

---

## Parallel Example: Foundational

```bash
# Five independent new files, once T004–T006 have landed the table and its model:
Task: "Create apps/api/database/factories/user_identity_change_factory.ts"
Task: "Create apps/api/app/users/shared/user_exceptions.ts"
Task: "Create apps/api/app/users/shared/normalize_user_identity.ts"
Task: "Create apps/api/app/users/shared/user_validator.ts"
Task: "Create apps/api/app/users/shared/activation_link_issuer.ts"
```

## Parallel Example: User Story 1 tests

```bash
Task: "Repository outcomes in apps/api/tests/unit/users/identity/identity_history.spec.ts"
Task: "Use-case decisions in apps/api/tests/unit/users/identity/update_user_identity.spec.ts"
Task: "Endpoint success and pending-email refusal in apps/api/tests/integration/users/identity/update.spec.ts"
Task: "Edit journey in apps/web/src/features/users/__tests__/identity/edit.test.tsx"
```

---

## Implementation Strategy

### MVP first (Phases 1–3)

1. Phase 1 Setup.
2. Phase 2 Foundational — blocking.
3. Phase 3 US1.
4. **Stop and validate**: an organization admin corrects another user end to end, and nothing else
   about that user moves.

At this point the feature exists. US2's authorization is already enforced by the policy landed in
Phase 2 — Phase 4 proves it and closes the self-target hole, which is why it is the first increment
after the MVP and should not be skipped before a PR.

### Incremental delivery

1. Setup + Foundational → substrate ready.
2. US1 → the correction works → demo.
3. US2 → the seam is provably closed.
4. US3 → the correction can no longer degrade the collection.
5. US4 → the correction is accountable.
6. US5 → failure is survivable.
7. Polish → verification gates and review.

### Known limitation carried by this task list

Correcting a **pending** user's email address answers `409 E_USER_ACTIVATION_LINK_UNAVAILABLE` until
GH-7 delivers activation links ([research.md](./research.md) D7, confirmed at the plan review gate on
2026-09-10). T017 and T018 assert exactly that. When GH-7 lands, the only change is the port's
binding in T012.

---

## Notes

- `[P]` means different files and no dependency on an incomplete task.
- Commit after each task or logical group, with Conventional Commits.
- Verify each test fails before implementing it.
- Stop at any checkpoint to validate a story on its own.
