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

## Revisions — 2026-09-11

After delivery, the product owner narrowed the slice; the tasks below are kept as they were run, and
annotated rather than rewritten, so the history of the branch stays readable:

- **The identity history is deferred** (former US4, FR-013, FR-014, SC-005). The table, model, factory,
  projection, and history block were built, then removed: T004–T007 and Phase 6 are marked
  *Deferred*, and the history assertions of T015, T016, T055 were dropped. The repository test file is
  now `apps/api/tests/unit/users/identity/apply_identity.spec.ts`.
- **A pending user's email is refused with an explanation** — `409 E_USER_PENDING_EMAIL_LOCKED` —
  instead of failing closed on an activation-link port. T011 and T012 are *Removed*; T017, T018, T022
  are updated.
- **The entry points follow the customer directory** — the row actions menu and the left of the record
  footer — and the `mode` parameter is `create | edit | view`. T026, T030, T037 are updated, and the
  work is recorded as Phase 9.

A `~~struck~~` task was delivered, then withdrawn by these revisions.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: US1…US5, matching the user stories of the specification
- Every task names its exact file path

## Path conventions

Monorepo: `apps/api` (AdonisJS, vertical slices under `app/<domain>/<workflow>`) and `apps/web`
(TanStack Start, features under `src/features/<feature>`). Tests live in `apps/api/tests/{unit,integration}/`
and `apps/web/src/features/<feature>/__tests__/`.

## A note on how these stories divide

One endpoint serves all five stories, so the substrate they share — the exceptions, the validator,
the policy, the repository seam — is Phase 2 and belongs to no story. The stories then divide by
**behavior on that seam**: US1 applies a correction, US2 decides who may, US3 decides what is
acceptable, US4 accounted for it (deferred on 2026-09-11), US5 survives failure. US1 is the only
phase that must ship for the feature to exist; the others harden and prove it.

As first planned, recording a history row was part of US1's atomic write and presenting it was US4.
Both are deferred; a correction now writes the three columns and `updated_at`, nothing else.

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

- [ ] ~~T004 Create the migration `apps/api/database/migrations/1785700000000_create_user_identity_changes_table.ts` with the columns, foreign keys, and `(user_id, changed_at)` index of [data-model.md](./data-model.md)~~ — *Deferred 2026-09-11 — history not delivered; no migration ships*
- [ ] ~~T005 Create the model `apps/api/app/models/user_identity_change.ts` with the `@beforeCreate` uuid assignment and the `changedBy` `belongsTo` relation~~ — *Deferred 2026-09-11 — history not delivered*
- [ ] ~~T006 Add the `identityChanges` `hasMany` relation to `apps/api/app/models/user.ts`~~ — *Deferred 2026-09-11 — history not delivered; `User` is unchanged*
- [ ] ~~T007 [P] Create `apps/api/database/factories/user_identity_change_factory.ts` in the shape of `user_factory.ts`~~ — *Deferred 2026-09-11 — history not delivered*
- [X] T008 [P] Create `apps/api/app/users/shared/user_exceptions.ts` with the five exceptions and their statuses and codes from [research.md](./research.md) D8 — *2026-09-11: `PendingUserEmailChangeException` (`E_USER_PENDING_EMAIL_LOCKED`) replaces `ActivationLinkUnavailableException`*
- [X] T009 [P] Create `apps/api/app/users/shared/normalize_user_identity.ts` — trim the three fields, assert the name rules, mirroring `#site_references/shared/normalize_site_reference`
- [X] T010 [P] Create `apps/api/app/users/shared/user_validator.ts` exporting `updateUserIdentityValidator` with the three required fields of [contracts/patch-user-identity.md](./contracts/patch-user-identity.md)
- [ ] ~~T011 [P] Create `apps/api/app/users/shared/activation_link_issuer.ts` — the abstract port plus the implementation that reports the capability unavailable ([research.md](./research.md) D7)~~ — *Removed 2026-09-11 — no link is reissued; GH-7 (#292) owns `ActivationLinkIssuer` for invitations*
- [ ] ~~T012 Bind `ActivationLinkIssuer` in `apps/api/providers/repositories_provider.ts` next to the existing repository bindings~~ — *Removed 2026-09-11 with T011*
- [X] T013 Add `findByIdForUpdate` and `applyIdentity`, with its typed outcome union (`UPDATED`, `NOT_FOUND`, `EMAIL_TAKEN`), to the abstraction `apps/api/app/users/shared/repositories/user_repository.ts` — two operations rather than one, because the use case owns the transaction its decisions are taken in ([research.md](./research.md) D5)
- [X] T014 Add `updateIdentity(viewer)` to `apps/api/app/users/shared/user_policy.ts` — active `ORGANIZATION_ADMIN` only

**Checkpoint**: the vocabulary exists, the seam is declared. Stories can begin.

---

## Phase 3: User Story 1 — Correct Another User's Identity (Priority: P1) 🎯 MVP

**Goal**: An organization admin corrects another user's first name, last name, and email, and sees
the correction everywhere that user is named, with nothing else about the user disturbed.

**Independent Test**: Sign in as an organization admin, open another user from `/users`, change the
identity, confirm — the collection, the record, and the avatar initials carry the correction, and the
user's role, access status, lifecycle events, and password renewal state are unchanged.

### Tests for User Story 1 ⚠️ write first, watch them fail

- [X] T015 [P] [US1] Repository test in `apps/api/tests/unit/users/identity/apply_identity.spec.ts` (first `identity_history.spec.ts`): `applyIdentity` returns `UPDATED` with the reloaded user, writes the three columns and `updated_at`, and returns `NOT_FOUND` for an unknown id — *2026-09-11: the history-row and responsible-administrator assertions were dropped with the history*
- [X] T016 [P] [US1] Use-case test in `apps/api/tests/unit/users/identity/update_user_identity.spec.ts`: an identical submission writes nothing — the short circuit sits in the use case, above the repository ([research.md](./research.md) D10)
- [X] T017 [P] [US1] Use-case test in `apps/api/tests/unit/users/identity/update_user_identity.spec.ts`: a valid correction of an active user is applied; a `PENDING` target whose email changes raises `PendingUserEmailChangeException` with nothing written; a `PENDING` target whose name alone changes, or whose address is only re-cased, is applied — *2026-09-11: replaces the issuer-port assertions*
- [X] T018 [P] [US1] Integration test in `apps/api/tests/integration/users/identity/update.spec.ts`: `200` with the corrected `toAdministration` body; targets in each of the four access statuses behave per [quickstart.md](./quickstart.md); the pending-email case answers `409 E_USER_PENDING_EMAIL_LOCKED` with its explanation and leaves the row untouched
- [X] T019 [P] [US1] Integration test in `apps/api/tests/integration/users/identity/update.spec.ts`: after a correction, `role`, `accessStatus`, every lifecycle column, `password`, and `passwordRenewalRequiredAt` are unchanged and no remember-me token is revoked (FR-011)
- [X] T020 [P] [US1] Web feature test in `apps/web/src/features/users/__tests__/identity/edit.test.tsx`: an organization admin opens a user, edits the identity, submits, and the row, the record, and the initials follow; `?userId=…&mode=edit` opens the panel directly on reload; "Back to details" leaves without changing anything

### Implementation for User Story 1

- [X] T021 [US1] Implement `findByIdForUpdate` and `applyIdentity` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`: the locked read, then — inside the caller's transaction — `UPDATE` the three columns and `updated_at`, reload with actors, return the typed outcome ([research.md](./research.md) D5) — *2026-09-11: the history `INSERT` was removed*
- [X] T022 [US1] Create `apps/api/app/users/identity/update_user_identity_use_case.ts`: own the transaction, normalize the input, short-circuit an unchanged submission, raise `PendingUserEmailChangeException` when the target is `PENDING` and the mailbox would change, map every outcome to its exception — *2026-09-11: replaces the call to the issuer port*
- [X] T023 [US1] Add `update` to `apps/api/app/controllers/users_controller.ts`: authorize with `UserPolicy.updateIdentity`, validate, call the use case, serialize with the `toAdministration` variant
- [X] T024 [US1] Register `router.patch('/:id', [controllers.Users, 'update']).as('update')` in the `/users` group of `apps/api/start/routes.ts`
- [X] T025 [P] [US1] Create `apps/web/src/features/users/mutations/use-user-mutations.ts` wrapping `tuyauQuery.users.update.mutationOptions` and invalidating `userQueries.list()` on success, in the shape of `use-truck-mutations.ts`
- [X] T026 [US1] Add `mode` to the Zod search schema of `apps/web/src/routes/_authenticated/users.tsx`, dropped in `transform` when no `userId` is open — *2026-09-11: `create | edit | view`, optional, as on `/customers`, merged with GH-7's `create` (which clears `userId`)*
- [X] T027 [P] [US1] Create `apps/web/src/features/users/ui/user-identity-form.tsx` with `useAppForm`, the registered field components, `applyApiError`, `FormError`, and `SubmitButton`
- [X] T028 [US1] Create `apps/web/src/features/users/ui/edit-user-identity-panel.tsx`, left through its header's "Back to details", per `apps/web/AGENTS.md`
- [X] T029 [US1] Switch `apps/web/src/features/users/ui/user-sheet.tsx` on `mode` between `UserAccessRecord` and `EditUserIdentityPanel`
- [X] T030 [US1] Add the `Edit` entry point to `apps/web/src/features/users/ui/user-access-record.tsx` and remove the file's "read-only by design" comment, which this feature makes false — *2026-09-11: moved from the header to the left of the footer, see T068*
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
- [X] T037 [US2] Gate the `Edit` entry point in `apps/web/src/features/users/ui/user-access-record.tsx` on an organization-admin viewer whose id differs from the open user's — *2026-09-11: the rule is now `mayEditUserIdentity`, shared with the row menu (T066)*
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
- [X] T041 [P] [US3] Repository test in `apps/api/tests/unit/users/identity/apply_identity.spec.ts`: a concurrent insert of the same address surfaces as the `EMAIL_TAKEN` outcome through the unique-index violation, not as an unhandled error
- [X] T042 [P] [US3] Web feature test in `apps/web/src/features/users/__tests__/identity/edit.test.tsx`: a `422` maps onto the field at fault, a `409 E_USER_EMAIL_CONFLICT` maps onto the email field, and in both cases the typed values are still there

### Implementation for User Story 3

- [X] T043 [US3] Apply `normalize_user_identity` in `apps/api/app/users/identity/update_user_identity_use_case.ts` and raise `InvalidUserIdentityException` for a value that survives VineJS but fails the domain rule
- [X] T044 [US3] Add the free-address pre-check and the `isUniqueViolation` catch to `updateIdentity` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`, both resolving to the `EMAIL_TAKEN` outcome ([research.md](./research.md) D6)
- [X] T045 [US3] Map `EMAIL_TAKEN` to `DuplicateUserEmailException` in `apps/api/app/users/identity/update_user_identity_use_case.ts`
- [X] T046 [US3] Map the refusal codes onto their fields in `apps/web/src/features/users/ui/user-identity-form.tsx` through `applyApiError`, keeping the entered values

**Checkpoint**: a correction can no longer degrade the collection it was meant to repair.

---

## Phase 6: User Story 4 — Account for Who Changed an Identity (Priority: P2) — *Deferred 2026-09-11*

> **Deferred 2026-09-11 — history not delivered.** The product owner decided the identity history is
> not needed for now. Every task below was delivered, then withdrawn before merge; none ships. The
> story may return as a slice of its own ([research.md](./research.md) D3, D4).

**Goal (as planned)**: An organization admin can see, on a user's record, every correction with its
date, its responsible administrator, and the identity before and after it — and an operations admin
sees none of it.

### Tests for User Story 4

- [ ] ~~T047 [P] [US4] Integration test in `apps/api/tests/integration/users/consultation/list.spec.ts`: an organization admin's collection carries `identityChanges` with `changedBy` resolved and oldest first; an operations admin's payload has no such key at all, and the rest of their payload is unchanged~~ — *Deferred*
- [ ] ~~T048 [P] [US4] Integration test in `apps/api/tests/integration/users/identity/update.spec.ts`: successive corrections accumulate, and an entry survives the deactivation or the renaming of the administrator who made it~~ — *Deferred*
- [ ] ~~T049 [P] [US4] Web feature test in `apps/web/src/features/users/__tests__/identity/history.test.tsx`: the history renders date, administrator, and only the parts that actually changed; a never-corrected user renders no section at all; an entry with a null administrator still renders~~ — *Deferred*

### Implementation for User Story 4

- [ ] ~~T050 [US4] Add `identityChanges` to `toAdministration()` in `apps/api/app/users/shared/transformers/user_transformer.ts`, emitted through the existing `this.when(includeAccessHistory, …)` gate, leaving `toObject()` and `toSummary()` untouched~~ — *Deferred*
- [ ] ~~T051 [US4] Preload the identity changes and their `changedBy` actor in `list()` — and deliberately not in `listActive()` — in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`~~ — *Deferred*
- [ ] ~~T052 [P] [US4] Create `apps/web/src/features/users/ui/user-identity-history.tsx` rendering the entries oldest first, naming only the parts that differ~~ — *Deferred*
- [ ] ~~T053 [US4] Render the history below the access history in `apps/web/src/features/users/ui/user-access-record.tsx`, rendering nothing when the list is empty or the key is absent~~ — *Deferred*
- [ ] ~~T054 [P] [US4] Extend `apps/web/src/features/users/__tests__/support/fixtures.ts` with users carrying identity-change history~~ — *Deferred*

---

## Phase 7: User Story 5 — Recover From a Failed Correction (Priority: P3)

**Goal**: A correction that cannot be applied is reported unambiguously, never presented as applied,
retryable without losing input, and never interleaved with a concurrent one.

**Independent Test**: Make the update fail transiently, verify the failure is reported and the
presented identity is unchanged, retry successfully; then run two concurrent corrections of the same
user and verify one complete identity and one reported refusal.

### Tests for User Story 5 ⚠️ write first, watch them fail

- [X] T055 [P] [US5] Repository test in `apps/api/tests/unit/users/identity/apply_identity.spec.ts`: two concurrent corrections of the same user leave one complete identity — never a mixed identity (SC-004, and the edge case on interleaving) — *2026-09-11: the two-history-rows assertion was dropped with the history*
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
- [X] T062 [P] Re-read `apps/api/app/users/identity/update_user_identity_use_case.ts` for the repository's comment convention: explain the pending-email refusal and the unchanged-submission short circuit, since neither is obvious from the code
- [ ] T063 Run the browser pass of [quickstart.md](./quickstart.md) against a fresh `db:fresh` — **not run**: `portflow-postgres` on port 5433 is shared with the sibling worktrees currently working in this repository, and `db:fresh` drops and recreates that database. It is the operator's to run. *2026-09-11: a partial pass ran against the shared seeded database — the row menu, the footer, a correction applied then reverted, GH-7's invitation panel opening alongside, and a pending user's different address refused with the explanatory message under the form while a re-cased one is accepted*
- [X] T064 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` at the repository root — `check` and `typecheck` clean; API 438 unit + 599 integration green; the web suite is green per file and per feature, while a full parallel `vitest run` on a loaded machine times out ~17 unrelated tests across trucks, docks, customers, warehouse doors, and transport companies (they pass in isolation, and the same failures reproduce on unmodified sources)
- [ ] T065 Obtain a fresh read-only review of the final diff (`git diff master...HEAD`) and resolve or explicitly justify every confirmed finding — **not run**: a fresh review is triggered by the operator, not from inside the implementing session

---

## Phase 9: Revisions of 2026-09-11

**Purpose**: Apply the product owner's decisions of 2026-09-11 recorded at the top of this file.

- [X] T066 [P] Create `apps/web/src/features/users/helpers/user-identity.ts` exporting `mayEditUserIdentity(viewer, user)` — organization admin, never on their own record — and make `apps/web/src/features/users/ui/users-page.tsx` ask it for the open record
- [X] T067 [P] Offer `Edit` in the row actions menu of `apps/web/src/features/users/ui/user-row-actions.tsx` — View, Edit, then the access actions — wired through `onEdit` in `user-table.tsx` to `?userId=…&mode=edit` in `users-page.tsx`, with its test in `apps/web/src/features/users/__tests__/identity/row-menu.test.tsx`
- [X] T068 Move `Edit` to the left of the record footer: `apps/web/src/features/users/ui/user-access-record.tsx` owns the footer (none when no action is available) and `user-access-actions.tsx` renders only its buttons and confirmation, as `CustomerDetails` / `CustomerLifecycleActions` do
- [X] T069 Remove the identity history end to end: migration, `UserIdentityChange` model and factory, the `identityChanges` relation, preloads, projection, `user-identity-history.tsx`, fixtures, and their tests (Phase 6)
- [X] T070 Replace the activation-link port with `PendingUserEmailChangeException` (`409 E_USER_PENDING_EMAIL_LOCKED`) raised by `UpdateUserIdentityUseCase`, with a message saying why and when the address can change; delete the port and its binding (T011, T012); the web shows the message as the form-level error, input preserved
- [X] T071 Rebase on GH-7 (#292): keep its `ActivationLinkIssuer`, merge `mode` into `create | edit | view` in `apps/web/src/routes/_authenticated/users.tsx`, regenerate the Tuyau registry with both `users.store` and `users.update`
- [X] T072 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` after the rebase and the pending-email refusal — clean; API 1104/1104, web 1128/1128

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependency.
- **Foundational (Phase 2)**: depends on Setup. **Blocks every story.**
- **US1 (Phase 3)**: depends on Foundational. Delivers the endpoint the other four stories act on.
- **US2 (Phase 4)**, **US3 (Phase 5)**: depend on US1's endpoint existing. Independent of each other.
- **US4 (Phase 6)**: deferred on 2026-09-11; as planned, it depended on US1 writing history rows.
- **US5 (Phase 7)**: depends on US1. Independent of US2 and US3.
- **Polish (Phase 8)**: depends on everything shipped.
- **Revisions (Phase 9)**: applied after Phase 8, on the delivered branch.

This is one endpoint, not five, so the stories are not mutually independent in the way a
multi-endpoint feature's would be. US1 is the trunk; US2, US3, and US5 are independent of **each
other** and can be delivered, tested, and reviewed in any order once US1 is green.

### Within each story

- Tests first, failing, then implementation — Constitution Principle IV.
- Repository before use case, use case before controller, controller before route.
- API before the web half of the same story: the web reads the Tuyau registry the API generates.

### Parallel opportunities

- **Phase 2**: T008, T009, T010 touch three different new files — all parallel; T013 and T014 edit two different existing files.
- **Phase 3 tests**: T015–T020 are six different files or independent cases — all parallel.
- **Phase 3 implementation**: T025, T027, T031 are new web files, parallel with each other and with the API chain T021 → T022 → T023 → T024.
- **Phase 4, 5, 7**: each phase's test tasks are parallel; across phases, US2, US3, and US5 can be staffed simultaneously once US1 is green.

---

## Parallel Example: Foundational

```bash
# Three independent new files:
Task: "Create apps/api/app/users/shared/user_exceptions.ts"
Task: "Create apps/api/app/users/shared/normalize_user_identity.ts"
Task: "Create apps/api/app/users/shared/user_validator.ts"
```

## Parallel Example: User Story 1 tests

```bash
Task: "Repository outcomes in apps/api/tests/unit/users/identity/apply_identity.spec.ts"
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
5. ~~US4 → the correction is accountable.~~ Deferred on 2026-09-11.
6. US5 → failure is survivable.
7. Polish → verification gates and review.

### Known limitation carried by this task list

Correcting a **pending** user's email address answers `409 E_USER_PENDING_EMAIL_LOCKED`, with an
explanation, by the product owner's decision of 2026-09-11 ([research.md](./research.md) D7). T017 and
T018 assert exactly that. Their names stay correctable. Reissuing their activation link from a
correction remains a possible follow-up on top of GH-7's `ActivationLinkIssuer`.

---

## Notes

- `[P]` means different files and no dependency on an incomplete task.
- Commit after each task or logical group, with Conventional Commits.
- Verify each test fails before implementing it.
- Stop at any checkpoint to validate a story on its own.
