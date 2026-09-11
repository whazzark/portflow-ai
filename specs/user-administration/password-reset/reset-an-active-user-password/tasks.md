---

description: "Task list for Reset an Active User Password (GH-17)"
---

# Tasks: Reset an Active User Password

**Input**: Design documents from `specs/user-administration/password-reset/reset-an-active-user-password/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [quickstart.md](./quickstart.md)

**Tests**: Test tasks are included and are **not optional here**. Constitution IV requires business
behavior to follow RED → GREEN → REFACTOR, and `AGENTS.md` repeats it as a delivery gate. Every
behavioral task below is preceded by the test that must fail first.

**Organization**: Tasks are grouped by user story. A caveat worth stating plainly: this is one
vertical slice — one endpoint and one workbench action — so the five stories are increments of the
same seam rather than five separable deliverables. Each is independently **testable**, and US1 is
independently **demonstrable**; US2, US3, and US4 harden the same endpoint and are not shipped
without it. They stay separate phases because each has its own failing test to write first and its
own checkpoint to stop at.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task serves (US1–US5)
- Every task names the exact file it touches

## Path Conventions

Monorepo per [plan.md](./plan.md): `apps/api/` (AdonisJS, Japa) and `apps/web/` (TanStack Start,
Vitest). All paths are repository-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean baseline before a TDD slice, so a red test is red for the right reason

- [X] T001 Install workspace dependencies from the repository root with `pnpm install`
- [X] T002 Apply migrations and confirm the generated `apps/api/database/schema.ts` is current with `pnpm --filter @portflow/api db:migrate`
- [X] T003 Confirm the baseline is green with `pnpm check`, `pnpm typecheck`, and `pnpm test`

**Checkpoint**: Baseline green — any failure from here belongs to this feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistence, model, factory, and contract declarations every story needs. No behavior
is delivered here, so no test precedes these tasks.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create the migration `apps/api/database/migrations/1785800000000_add_user_password_reset.ts` adding `password_reset_at` (nullable timestamp) and `password_reset_by_user_id` (nullable uuid FK to `users.id`, `ON DELETE SET NULL`), with `static disableTransactions = true` and a `down()` that toggles `PRAGMA foreign_keys` around the SQLite rebuild — per [research.md](./research.md) R7, this becomes the newest migration and its `down()` runs while the whole schema still stands
- [X] T005 Run `pnpm --filter @portflow/api db:migrate` to apply T004 and regenerate `apps/api/database/schema.ts` (generated file — never hand-edited)
- [X] T006 [P] Add the `passwordResetBy` `belongsTo` relation on `password_reset_by_user_id` to `apps/api/app/models/user.ts`, beside the five existing self-referential lifecycle relations
- [X] T007 [P] Add a `passwordReset` state to `apps/api/database/factories/user_factory.ts` — the `passwordRenewalRequired` state plus `passwordResetAt` and `passwordResetByUserId` — repeating assignments rather than composing, per the note already in that file
- [X] T008 [P] Create `apps/api/app/users/password_reset/password_reset_exceptions.ts` with `UserNotFoundException` (`404`, `E_USER_NOT_FOUND`), `UserNotActiveException` (`409`, `E_USER_NOT_ACTIVE`), and `PasswordResetSelfForbiddenException` (`422`, `E_USER_PASSWORD_RESET_SELF`), matching the statuses in [contracts/http-api.md](./contracts/http-api.md#refusals)
- [X] T009 Declare `requirePasswordRenewal` with its `RequirePasswordRenewalCommand` and `RequirePasswordRenewalResult` (`RESET` | `NOT_FOUND` | `NOT_ACTIVE`) types on the abstract `apps/api/app/users/shared/repositories/user_repository.ts`
- [X] T010 Add a `resetPassword(user)` method to `apps/api/app/users/shared/user_policy.ts` returning true only for an `ACTIVE` `ORGANIZATION_ADMIN` — foundational rather than story-scoped so no write endpoint is ever exposed unauthorized, even mid-branch

**Checkpoint**: Schema, model, factory, exceptions, and contracts in place — story work can begin

---

## Phase 3: User Story 1 - Require an Active User to Choose a New Password (Priority: P1) 🎯 MVP

**Goal**: An organization admin records the renewal requirement and its attributed event against an
active user, and the target meets the renewal step at their next request.

**Independent Test**: Reset an active user's password through the API as an organization admin;
assert the requirement stands, the reset event carries the date and the administrator, the response
discloses no credential, and the target user's next request reaches nothing but the renewal step.

### Tests for User Story 1 ⚠️

> Write these first and watch them fail

- [X] T011 [P] [US1] Create `apps/api/tests/unit/users/password_reset/reset_user_password_use_case.spec.ts` asserting the happy path — the use case records the requirement, the reset date, and the responsible administrator, and leaves identity, email, role, access status, and lifecycle history untouched (FR-001, FR-003, FR-004)
- [X] T012 [P] [US1] Create `apps/api/tests/integration/users/administration/password_reset.spec.ts` asserting the `200` contract — the payload shape of [contracts/http-api.md](./contracts/http-api.md#200-ok), `passwordRenewalRequired: true`, the attributed `passwordResetAt`/`passwordResetBy`, and the absence of `password`, `passwordRenewalRequiredAt`, and any token (FR-010, FR-010a, SC-009)
- [X] T013 [US1] Extend `apps/api/tests/integration/auth/password_renewal_confinement.spec.ts` (or add to T012's file) asserting that a user reset while holding a live session is not signed out and is confined to the renewal step at their next request (US1-3)

### Implementation for User Story 1

- [X] T014 [US1] Implement `requirePasswordRenewal` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts` — inside `User.transaction`, a guarded `UPDATE … WHERE id = ? AND access_status = 'ACTIVE'` writing `passwordRenewalRequiredAt`, `passwordResetAt`, `passwordResetByUserId`, and `updatedAt` by hand (the query builder bypasses the model's autoUpdate hook), returning `RESET` on one affected row
- [X] T015 [US1] Create `apps/api/app/users/password_reset/reset_user_password_use_case.ts` taking `{ targetUserId, actorUserId, resetAt }`, calling the repository, and returning the updated user
- [X] T016 [US1] Add the `resetPassword` action to `apps/api/app/controllers/users_controller.ts` — authorize through `UserPolicy`, read the actor from `auth`, pass `DateTime.now()`, and serialize the result through `UserTransformer` with `includeAccessHistory: true`; no VineJS validator, because the request carries no body
- [X] T017 [US1] Declare `POST /:id/password-reset` as `password_reset` inside the existing `/users` group in `apps/api/start/routes.ts`, so the route inherits `auth` and `passwordRenewalCompleted`
- [X] T018 [US1] Extend `toAdministration()` in `apps/api/app/users/shared/transformers/user_transformer.ts` with `passwordResetAt`, `passwordResetBy`, and the derived `passwordRenewalRequired`, all three gated on the existing `includeAccessHistory` option so they are absent — not null — for viewers who may not consult the access history
- [X] T019 [US1] Preload `passwordResetBy` in `UserRepository.list()` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`, leaving `listActive()` unpreloaded as it is today

**Checkpoint**: The endpoint records the requirement and the attributed event, and the target meets the renewal step. US1 is demonstrable on its own.

---

## Phase 4: User Story 2 - Confine the Reset to the Administrators Responsible for User Access (Priority: P1)

**Goal**: Only an active organization admin may reset, and only an active user who is not the
requester may be reset. Every other combination is refused with its own status and nothing written.

**Independent Test**: Issue the reset as each role, unauthenticated, and from a session confined to
its own renewal; and against an active, pending, deactivated, cancelled, unknown, and self target.
Assert each status and code, and that the target's requirement, reset event, and remembered
connections are unchanged after every refusal.

### Tests for User Story 2 ⚠️

- [X] T020 [P] [US2] Extend `apps/api/tests/unit/users/password_reset/reset_user_password_use_case.spec.ts` with the refusals — unknown target, non-active target, and self-reset each raising their own exception and writing nothing (FR-006, FR-007, FR-008)
- [X] T021 [US2] Extend `apps/api/tests/integration/users/administration/password_reset.spec.ts` with the full refusal matrix in request-flow order per `apps/api/tests/README.md` — `401` unauthenticated, `403` for operations admin, operations lead, and observer, `403` `E_PASSWORD_RENEWAL_REQUIRED` for a requester who owes their own renewal, then `404`, `409`, and `422` (FR-005, FR-014)

### Implementation for User Story 2

- [X] T022 [US2] Classify the target in `requirePasswordRenewal` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts` — a `forUpdate()` read before the guarded update, plus a re-read on the zero-row branch because knex emits no `FOR UPDATE` on SQLite — returning `NOT_FOUND` and `NOT_ACTIVE` (depends on T014, same method)
- [X] T023 [US2] Raise the refusals in `apps/api/app/users/password_reset/reset_user_password_use_case.ts` — `PasswordResetSelfForbiddenException` when the target is the actor, checked before the write, then `UserNotFoundException` and `UserNotActiveException` from the repository result (depends on T015)

**Checkpoint**: The endpoint is safe to expose. Every refusal is distinct and writes nothing.

---

## Phase 5: User Story 3 - Close the Window on the Password Being Replaced (Priority: P1)

**Goal**: A successful reset revokes every remembered connection the target holds — sparing none —
while leaving live sessions standing to be confined at their next request, and touching no other
user's connections.

**Independent Test**: Give the target a live session and remembered connections on two more browsers,
reset, and assert both remembered connections are gone, the live session survives but reaches only
the renewal step, another user's connections are intact, and a refused reset revokes nothing.

### Tests for User Story 3 ⚠️

- [X] T024 [US3] Extend `apps/api/tests/integration/users/administration/password_reset.spec.ts` with the revocation contract — every remembered connection of the target deleted, another user's untouched, the target's live session not terminated, and nothing revoked by a refused reset (FR-004a, FR-013, SC-010) — modelling the setup on `rememberOnANewBrowser` and `rememberedConnectionIdsOf` in `apps/api/tests/integration/auth/password_renewal.spec.ts`
- [X] T025 [US3] Add a case to the same file asserting the target reaches the renewal step by signing in with the password they already hold after their connections were revoked (US3-3, SC-011)

### Implementation for User Story 3

- [X] T026 [US3] Delete every `remember_me_tokens` row for the target inside the same transaction in `requirePasswordRenewal` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`, reached only on the `RESET` branch — through the query builder, not `RememberMeToken`, for the reason already recorded in `revokeOtherRememberedConnections`; no connection is spared, because the actor is not the target (depends on T014, T022)

**Checkpoint**: The reset closes the 30-day restore window it exists to close.

---

## Phase 6: User Story 4 - Understand and Recover From a Refused Reset (Priority: P2)

**Goal**: Repeated, concurrent, and re-applied resets resolve unambiguously to one outstanding
requirement, and the workbench tells the administrator which refusal happened.

**Independent Test**: Reset the same user twice, reset two racing requests, reset a user who already
owes a renewal from a reactivation-shaped fixture, and drive each refusal through the workbench.
Assert one requirement with one consistent origin, and distinct feedback per refusal.

### Tests for User Story 4 ⚠️

- [X] T027 [P] [US4] Extend `apps/api/tests/integration/users/administration/password_reset.spec.ts` with idempotency and concurrency — a second reset refreshing the event to the newer date and administrator while leaving exactly one requirement, and two near-simultaneous resets doing the same (FR-011, FR-012, SC-005)
- [X] T028 [P] [US4] Create `apps/web/src/features/users/__tests__/password-reset/refusals.test.tsx` asserting distinct, actionable feedback for the `403`, `404`, `409`, and `422` refusals and for a network failure, that the record still shows the pre-attempt state, and that the action stays usable for another attempt (FR-014, US4-6)

### Implementation for User Story 4

- [X] T029 [US4] Confirm the guarded write in `apps/api/app/users/shared/repositories/lucid_user_repository.ts` satisfies T027 without a second mechanism, and record why in a comment if the guard needed adjusting (depends on T022, T026)
- [X] T030 [US4] Map each refusal code to its message in `apps/web/src/features/users/ui/reset-password-confirmation.tsx` through `parseApiError` from `apps/web/src/libraries/tuyau/api-error.ts` (depends on T035)

**Checkpoint**: No reset can be reported as succeeding while writing nothing, and no refusal is opaque.

---

## Phase 7: User Story 5 - Act on the Reset From the User Workbench (Priority: P2)

**Goal**: An organization admin performs the reset from the access record they already have open,
confirms deliberately, and sees the consequence without reloading.

**Independent Test**: Open an active user's record as an organization admin, invoke the action,
cancel at the confirmation and assert nothing changed, then confirm and assert the record, the
collection, and the access history reflect the reset. Repeat as an operations admin and against a
non-active target, asserting the action is absent.

### Tests for User Story 5 ⚠️

- [X] T031 [P] [US5] Create `apps/web/src/features/users/__tests__/password-reset/permissions.test.tsx` asserting the action is offered only to an organization admin, only on an active target, and never on the viewer's own record (FR-015, FR-007)
- [X] T032 [P] [US5] Create `apps/web/src/features/users/__tests__/password-reset/confirmation.test.tsx` asserting the confirmation names the user and states the consequence, that cancelling records nothing, and that a duplicate submission is prevented while one is in flight (FR-016, FR-017)
- [X] T033 [P] [US5] Create `apps/web/src/features/users/__tests__/password-reset/success.test.tsx` asserting the open record and the collection show the outstanding renewal after a successful reset without a manual reload, and that the access history gains the dated, attributed `Password reset` entry (FR-018, FR-019, FR-020)
- [X] T034 [P] [US5] Extend `apps/web/src/features/users/__tests__/support/fixtures.ts` with users carrying `passwordResetAt`, `passwordResetBy`, and `passwordRenewalRequired`, and an operations-admin projection where those keys are absent

### Implementation for User Story 5

- [X] T035 [P] [US5] Create `apps/web/src/features/users/helpers/user-permissions.ts` with the rule mirroring the API's — organization admin, active target, not oneself — and its unit test beside it
- [X] T036 [P] [US5] Create `apps/web/src/features/users/mutations/use-user-mutations.ts` wrapping `tuyauQuery.users.passwordReset` and invalidating `userQueries.list()` on success, following `use-truck-mutations.ts`
- [X] T037 [US5] Create `apps/web/src/features/users/ui/reset-password-confirmation.tsx` on the existing `AlertDialog` primitive — the action reads `Reset password`, the action alone, per the convention stated in `apps/web/src/components/lifecycle/lifecycle-copy.ts` (depends on T036)
- [X] T038 [US5] Offer the action and present the outstanding renewal in `apps/web/src/features/users/ui/user-access-record.tsx`, gated by T035 (depends on T035, T037)
- [X] T039 [P] [US5] Add the `password-reset` event to `recordedEvents` in `apps/web/src/features/users/ui/user-access-history.tsx`, read uncast off the DTO like the five existing events so a dropped key breaks the build
- [X] T040 [P] [US5] Show the outstanding renewal in the collection in `apps/web/src/features/users/ui/user-table.tsx`, so an organization admin can tell without opening a user (FR-020)
- [X] T046 [US5] Offer the reset from the row menu in `apps/web/src/features/users/ui/user-row-actions.tsx`, gated by `canResetPassword` and mounting the same `ResetPasswordDialog` as the record footer, covered by `apps/web/src/features/users/__tests__/password-reset/row-menu.test.tsx` (FR-015, US5-7)

**Checkpoint**: The feature is usable by the person responsible for access, and every story is complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T041 Run the full gate from the repository root: `pnpm check`, `pnpm typecheck`, `pnpm test` — green: Biome clean (967 files), both apps typecheck, API 1127 passing, web 1158 passing (246 files)
- [ ] T042 Walk the browser journey in [quickstart.md](./quickstart.md#validate-by-hand), steps 1–7, with two browsers — **not run**: needs a PostgreSQL instance and a seeded dataset that this worktree has no `.env` for. Every step is covered by an automated test, but a human pass on the real app is still owed before the PR is ready
- [ ] T043 Exercise the endpoint directly per [quickstart.md](./quickstart.md#validate-the-api-directly) as each unauthorized role, confirming the workbench is never the only thing enforcing a rule (FR-009) — **not run manually**; the integration suite covers the same matrix against the real HTTP stack with real sessions
- [X] T044 [P] Update the `GH-17` row in `specs/user-administration/password-reset/roadmap.md` from `planned` to its delivered status
- [ ] T045 Obtain a fresh read-only review of the final diff and resolve or explicitly justify every confirmed finding (constitution VII) — **owed**; this is a user-triggered review and cannot be self-certified

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: needs Setup — blocks every story
- **US1 (Phase 3)**: needs Foundational — the MVP
- **US2 (Phase 4)**: needs US1, because T022 and T023 extend the method and use case US1 creates
- **US3 (Phase 5)**: needs US1 and US2, because T026 adds to the same transaction
- **US4 (Phase 6)**: needs US2 and US3 on the API side; T030 needs T035 on the web side
- **US5 (Phase 7)**: needs US1 for the endpoint and the DTO keys; independent of US2–US4 otherwise
- **Polish (Phase 8)**: needs every story

### Honest note on story independence

US2, US3, and US4 harden the endpoint US1 creates and share its files, so they are sequential rather
than parallel. US5 is the one story that can genuinely proceed alongside the others once US1 has
landed the endpoint and the DTO keys — a second developer can build the workbench against those
while the API refusals and revocation are written.

### Within Each Story

- The failing test comes first, always
- Repository before use case, use case before controller, controller before route
- Transformer changes before any web task that reads the new keys

### Parallel Opportunities

- T006, T007, T008 in Foundational (different files)
- T011 and T012 in US1 (different test files)
- T027 and T028 in US4 (different apps)
- T031, T032, T033, T034 in US5 (different test files)
- T035, T036, T039, T040 in US5 (different source files)

---

## Parallel Example: User Story 5

```bash
# The failing tests together:
Task: "permissions.test.tsx — who is offered the action"
Task: "confirmation.test.tsx — naming, cancelling, duplicate submission"
Task: "success.test.tsx — record, collection, and history after a reset"
Task: "fixtures.ts — users carrying the new keys"

# Then the independent source files together:
Task: "user-permissions.ts — the visibility rule"
Task: "use-user-mutations.ts — the mutation and its invalidation"
Task: "user-access-history.tsx — the reset event"
Task: "user-table.tsx — the collection indicator"
```

---

## Implementation Strategy

### MVP (US1 only)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1
2. **STOP and validate**: an organization admin can require an active user to renew, and that user
   meets the renewal step
3. This is demonstrable, but it is **not shippable**: the endpoint still accepts a self-reset and a
   non-active target, and revokes nothing. US2 and US3 are both P1 for that reason.

### Shippable increment

Phases 1–5 (US1 + US2 + US3) is the smallest set that can merge: authorized, refusing correctly, and
closing the remembered-connection window. US4 and US5 then complete the spec.

### Notes

- `[P]` means different files and no dependency on incomplete work
- Verify each test fails before implementing against it
- Commit per task or per logical group, Conventional Commits, `<type>(<domain>): <Description>`
- `apps/api/database/schema.ts` is generated by `db:migrate` — never hand-edit it
