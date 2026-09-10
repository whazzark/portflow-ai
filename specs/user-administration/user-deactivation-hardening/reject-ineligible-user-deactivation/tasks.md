---

description: "Task list for Reject Ineligible User Deactivation"
---

# Tasks: Reject Ineligible User Deactivation

**Input**: Design documents from
`/specs/user-administration/user-deactivation-hardening/reject-ineligible-user-deactivation/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV makes RED → GREEN → REFACTOR binding, and
[D12](./research.md#d12--verification-seams) fixes the seams: Japa unit tests for the use case's
decisions (repository swapped in the container) and for the repository's guarded write against the
real database (ADR-0014), Japa integration tests for the endpoint's authorization matrix, validation,
payload, and the session cut, and Vitest feature tests rendering the real router with MSW for the
workbench. `apps/web/e2e` does not exist, so this slice adds no end-to-end journey.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and
demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task serves (US1–US3)
- Exact file paths are given in every description

## Path Conventions

Web application monorepo — `apps/api/` (AdonisJS 7) and `apps/web/` (TanStack Start), per plan.md's
Structure Decision. The API side mirrors the delivered dock and truck lifecycle slices; the web side
extends the delivered users workbench.

## Two ordering rules that are not negotiable

1. **The authorization boundary is foundational, not a story.** `UserPolicy.deactivate` lands in
   Phase 2 and is called by the controller the moment the endpoint exists (T018). No checkpoint in
   this list exposes a deactivation an unauthorized caller can reach.
2. **The `SELF` guard lands in User Story 1, not User Story 2.** The spec files self-deactivation
   under US2's scenarios, but a checkpoint that lets an organization admin deactivate their own
   access is not a safe increment — with one seeded admin it is a lockout. US1 therefore implements
   and proves the refusal; US2 adds nothing to it.

The same reasoning shapes US1's use case: until US2 lands, every non-`DEACTIVATED` repository outcome
resolves to `UserNotFoundException`. That is uninformative but always safe, and it is precisely what
US2 exists to improve — its story is that the administrator is *told which reason applied*.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the ground this write stands on and create the module directories

- [X] T001 Confirm no migration is required by checking `access_status`, `deactivated_at`, and `deactivated_by_user_id` in `apps/api/database/schema.ts` and `apps/api/database/migrations/1783663779445_create_users_table.ts` against the field table in [data-model.md](./data-model.md)
- [X] T002 [P] Create the API slice and test directories `apps/api/app/users/deactivate/`, `apps/api/tests/unit/users/deactivation/`, and `apps/api/tests/integration/users/deactivation/`
- [X] T003 [P] Create the web directories `apps/web/src/features/users/mutations/` and `apps/web/src/features/users/__tests__/deactivate/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The refusal vocabulary, the authorization boundary, the guarded write, and the
parameter validation. No endpoint and no button is exposed by this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Create `apps/api/app/users/shared/user_exceptions.ts` with `UserNotFoundException` (404, `E_USER_NOT_FOUND`), `SelfDeactivationException` (409, `E_USER_SELF_DEACTIVATION`), `UserPendingInvitationException` (409, `E_USER_PENDING_INVITATION`), `UserCancelledInvitationException` (409, `E_USER_CANCELLED_INVITATION`), and `UserAlreadyDeactivatedException` (409, `E_USER_ALREADY_DEACTIVATED`), following the shape of `apps/api/app/docks/shared/dock_exceptions.ts` ([D2](./research.md#d2--the-http-shape-of-each-outcome))
- [X] T005 [P] Add `deactivate(user)` to `apps/api/app/users/shared/user_policy.ts` granting only a viewer whose `accessStatus` is `ACTIVE` and whose role is `ORGANIZATION_ADMIN`, leaving `list()` untouched, and documenting in a comment that which user may be deactivated is the use case's decision ([D1](./research.md#d1--where-each-refusal-is-decided))
- [X] T006 [P] Add `findById(id)`, the `DeactivateUserCommand` type, the `DeactivateUserResult` union (`DEACTIVATED` with the user, `NOT_FOUND`, `NOT_ACTIVE` with the observed `accessStatus`), and the `deactivateActive(command)` abstract signature to `apps/api/app/users/shared/repositories/user_repository.ts`, per the naming ADR-0013 fixes
- [X] T007 Implement `findById()` and `deactivateActive()` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`: one `User.transaction` containing the conditional `UPDATE … WHERE id = ? AND access_status = 'ACTIVE'` writing `access_status`, `deactivated_at`, `deactivated_by_user_id`, and `updated_at` by hand, then, only on one affected row, `DELETE FROM remember_me_tokens WHERE tokenable_id = ?`; on zero affected rows re-read the row to return `NOT_FOUND` or `NOT_ACTIVE` with its status, and reload the user with `deactivatedBy` for the success case. Mirror the structure and the commentary of the existing `renewPassword()` in the same file ([D3](./research.md#d3--the-guarded-write-is-the-concurrency-control), [D4](./research.md#d4--remembered-connections-are-revoked-in-the-same-transaction)) (depends on T006)
- [X] T008 [P] Create `apps/api/app/users/deactivate/deactivate_user_validator.ts` exporting `deactivateUserValidator = vine.create({ id: vine.string().uuid() })`, matching the identifier rule `apps/api/app/shared/validators/lifecycle_validator.ts` already uses ([D5](./research.md#d5--a-malformed-identifier-is-rejected-before-the-database-is-touched))
- [X] T009 [P] Add a `mockDeactivateUser(outcome)` helper to `apps/web/src/features/users/__tests__/support/test-helpers.ts` that registers an MSW handler for `POST /api/v1/users/:id/deactivate` returning either the updated user or an `{ error: { code, message } }` envelope, alongside the existing `mockUsers` handlers

**Checkpoint**: the refusal vocabulary exists, the policy can answer *may this viewer deactivate
users at all*, and the guarded write is callable in code — nothing is reachable over HTTP or in the
browser yet

---

## Phase 3: User Story 1 - Deactivate an Active User (Priority: P1) 🎯 MVP

**Goal**: An organization admin opens the record of an active user in the workbench, deactivates
them behind a confirmation, and the user loses sign-in access immediately while their history stays
intact and attributed.

**Independent Test**: Sign in as an organization admin, deactivate an active user other than
yourself, and verify the user carries the deactivation date and the responsible administrator, has
left the active view for the deactivated one without a reload, can no longer sign in, and that their
already-open session grants nothing on its next request.

**Scope note**: this phase also implements and proves the `SELF` refusal, for the reason given in
ordering rule 2 above.

### Tests for User Story 1 ⚠️

> Write these first and confirm they FAIL before implementing

- [X] T010 [P] [US1] Unit test in `apps/api/tests/unit/users/deactivation/deactivate.spec.ts`: `DeactivateUserUseCase` on an `ACTIVE` target returns the user with `accessStatus` `DEACTIVATED`, the supplied timestamp in `deactivatedAt`, and the acting admin in `deactivatedByUserId`, while `email`, `role`, `firstName`, `lastName`, `activatedAt`, `invitedAt`, `reactivatedAt`, and `passwordRenewalRequiredAt` are unchanged (US1.1, US1.5, US1.6, FR-010–FR-012), swapping `UserRepository` in the container as `tests/unit/users/consultation/list.spec.ts` does
- [X] T011 [US1] Unit test in `apps/api/tests/unit/users/deactivation/deactivate.spec.ts`: the use case throws `SelfDeactivationException` when the target id equals the acting administrator's id, and the repository is never called (FR-009) (same file as T010)
- [X] T012 [P] [US1] Unit test in `apps/api/tests/unit/users/deactivation/guarded_write.spec.ts` against the real `LucidUserRepository`: `deactivateActive()` on an `ACTIVE` user returns `DEACTIVATED` with the row updated, deletes that user's `remember_me_tokens` rows, and leaves another user's rows in place (FR-013, FR-018, D3, D4)
- [X] T013 [P] [US1] Integration test in `apps/api/tests/integration/users/deactivation/deactivate.spec.ts`: an organization admin deactivating an active user gets `200` with the `toAdministration` payload of [contracts/deactivate-user.md](./contracts/deactivate-user.md) — `accessStatus: "DEACTIVATED"`, `deactivatedAt` set, `deactivatedBy` resolved to `{ id, firstName, lastName }` — and no `password` or token field anywhere in the response
- [X] T014 [US1] Integration test in `apps/api/tests/integration/users/deactivation/deactivate.spec.ts`: after a successful deactivation the target's login attempt returns `401` indistinguishable from invalid credentials, and a request replaying the target's session cookie returns `401` (US1.3, US1.4, FR-013) (same file as T013)
- [X] T015 [P] [US1] Feature test in `apps/web/src/features/users/__tests__/deactivate/journey.test.tsx`: as an organization admin, open an active user's record, press `Deactivate`, confirm, and assert the success toast names the user, the record closes, the user moves from the `Active` view to `Deactivated`, and both tab counts follow — with no reload (US1.2, FR-016)

### Implementation for User Story 1

- [X] T016 [US1] Create `apps/api/app/users/deactivate/deactivate_user_use_case.ts` with `DeactivateUserInput` (`id`, `deactivatedByUserId`, `deactivatedAt`): throw `SelfDeactivationException` when the target is the actor, then call `deactivateActive()` and return the user on `DEACTIVATED`; every other outcome throws `UserNotFoundException` for now — US2 replaces that catch-all (depends on T004, T007)
- [X] T017 [US1] Add `deactivate()` to `apps/api/app/controllers/users_controller.ts`: take the authenticated user from `auth`, `bouncer.with(UserPolicy).authorize('deactivate')`, validate the route parameter with `request.validateUsing(deactivateUserValidator, { data: params })`, call the use case with `DateTime.now()`, and serialize the result through `UserTransformer.transform(user, { includeAccessHistory: true }).useVariant('toAdministration')` ([D6](./research.md#d6--what-the-endpoint-returns)) (depends on T005, T008, T016)
- [X] T018 [US1] Register `router.post('/:id/deactivate', [controllers.Users, 'deactivate']).as('deactivate')` inside the existing `/users` group of `apps/api/start/routes.ts`, keeping it under the `auth` and `passwordRenewalCompleted` middleware, then restart the API dev server so the Tuyau registry regenerates and `tuyauQuery.users.deactivate` exists for the web (depends on T017)
- [X] T019 [P] [US1] Create `apps/web/src/features/users/mutations/use-user-mutations.ts` exposing `deactivate` from `tuyauQuery.users.deactivate.mutationOptions()` and a `refreshUsers` that invalidates `userQueries.list()` exactly, invalidating on both the success and the failure path, following `apps/web/src/features/docks/mutations/use-dock-mutations.ts` ([D7](./research.md#d7--the-web-mutation-and-what-it-invalidates)) (depends on T018)
- [X] T020 [P] [US1] Create `apps/web/src/features/users/helpers/user-access-copy.ts` keyed by access action with only `deactivate` populated — button label `Deactivate`, pending label `Deactivating…`, dialog title, the effect sentence (they can no longer sign in; their history stays visible and attributed), and success and refusal titles built from `refusalTitle` / `confirmationMessage` / `namedRecord` in `apps/web/src/helpers/resource-copy.ts` ([D8](./research.md#d8--the-action-does-not-reuse-the-site-reference-lifecycle-components))
- [X] T021 [US1] Create `apps/web/src/features/users/ui/user-access-actions.tsx`: a destructive `Deactivate` button opening an `AlertDialog` with no comment field, submitting through the mutation, closing on success with a toast and staying open on a refusal with a toast built from `parseApiError` (depends on T019, T020)
- [X] T022 [US1] Render `UserAccessActions` in a `SheetFooter` at the bottom of `apps/web/src/features/users/ui/user-access-record.tsx`, and replace the component's "Read-only by design" comment with what the record now offers (depends on T021)
- [X] T023 [US1] Pass the authenticated viewer from `useAuthenticatedUser()` into the record so the footer can decide what it offers, keeping `apps/web/src/features/users/ui/user-sheet.tsx` a resolver over the retrieved collection and adding no new read seam (depends on T022)

**Checkpoint**: an organization admin can deactivate an active user end to end; the user cannot sign
in, their open session is dead, their own access is protected, and every other target is refused —
uninformatively, but safely

---

## Phase 4: User Story 2 - Refuse to Deactivate an Ineligible User (Priority: P1)

**Goal**: Every ineligible target is refused with its own reason, so an administrator learns what to
do instead — cancel the invitation, or nothing at all — rather than meeting one flat refusal.

**Independent Test**: Attempt to deactivate a pending user, a cancelled user, an already deactivated
user, an unknown identifier, and a malformed one, and verify each is refused with its own reason and
leaves every user completely unchanged.

### Tests for User Story 2 ⚠️

> Write these first and confirm they FAIL before implementing

- [X] T024 [P] [US2] Unit tests in `apps/api/tests/unit/users/deactivation/deactivate.spec.ts`: a `NOT_ACTIVE` outcome carrying `PENDING`, `CANCELLED`, and `DEACTIVATED` throws `UserPendingInvitationException`, `UserCancelledInvitationException`, and `UserAlreadyDeactivatedException` respectively, and a `NOT_FOUND` outcome throws `UserNotFoundException` (US2.1–US2.4, FR-004–FR-007)
- [X] T025 [P] [US2] Unit tests in `apps/api/tests/unit/users/deactivation/guarded_write.spec.ts` against the real repository: `deactivateActive()` on a pending, a cancelled, and an already deactivated user returns `NOT_ACTIVE` with that status, on an unknown id returns `NOT_FOUND`, and in every one of those cases writes no column and deletes no `remember_me_tokens` row (FR-019)
- [X] T026 [P] [US2] Integration tests in `apps/api/tests/integration/users/deactivation/deactivate.spec.ts`: one case per refusal asserting the status and `error.code` of [contracts/deactivate-user.md](./contracts/deactivate-user.md) — `404 E_USER_NOT_FOUND`, `409 E_USER_PENDING_INVITATION`, `409 E_USER_CANCELLED_INVITATION`, `409 E_USER_ALREADY_DEACTIVATED` — each asserting the target row is byte-for-byte unchanged
- [X] T027 [US2] Integration test in `apps/api/tests/integration/users/deactivation/deactivate.spec.ts`: a malformed `:id` returns `422 E_VALIDATION_ERROR` with `details`, and no user is read (US2.5, FR-008) (same file as T026)
- [X] T028 [US2] Integration test in `apps/api/tests/integration/users/deactivation/deactivate.spec.ts`: deactivating the same active user twice returns `200` then `409 E_USER_ALREADY_DEACTIVATED`, with the first call's `deactivatedAt` and `deactivatedByUserId` intact after the second (FR-018) (same file as T026, T027)
- [X] T029 [P] [US2] Feature test in `apps/web/src/features/users/__tests__/deactivate/refusals.test.tsx`: one case per `error.code` asserting the dialog stays open, the refusal toast carries that reason's sentence, and the collection query is refetched (FR-017)
- [X] T030 [P] [US2] Feature test in `apps/web/src/features/users/__tests__/deactivate/recovery.test.tsx`: a network failure surfaces the retryable failure sentence from `parseApiError` and changes nothing in the workbench (FR-019)

### Implementation for User Story 2

- [X] T031 [US2] Replace the catch-all in `apps/api/app/users/deactivate/deactivate_user_use_case.ts`: map `NOT_ACTIVE` onto the three status exceptions by reading `result.accessStatus`, and keep `NOT_FOUND` on `UserNotFoundException`, per the outcome table in [data-model.md](./data-model.md)
- [X] T032 [US2] Add a per-reason refusal sentence to `apps/web/src/features/users/helpers/user-access-copy.ts`, keyed by `error.code`, with the pending case naming invitation cancellation as the right action instead
- [X] T033 [US2] Resolve the refusal description from `parseApiError(cause).code` in `apps/web/src/features/users/ui/user-access-actions.tsx`, falling back to the API message for an unmapped code (depends on T032)

**Checkpoint**: every ineligible target is refused with a reason the administrator can act on, and no
refusal leaves a trace on any row

---

## Phase 5: User Story 3 - Refuse Deactivation to Anyone Not Entitled to It (Priority: P2)

**Goal**: The deactivation stays with the one role accountable for it, whether the request comes from
the interface or is sent directly, and the interface never offers what the API would refuse.

**Independent Test**: Attempt a deactivation as an unauthenticated visitor, as an operations admin,
an operations lead, and an observer, and verify every attempt is refused with no user changed and the
action never present in their interface.

**Scope note**: the policy itself landed in Phase 2 and has been enforced since T017. This phase
proves the whole matrix and makes the interface agree with it.

### Tests for User Story 3 ⚠️

> Write these first and confirm they FAIL before implementing

- [X] T034 [P] [US3] Integration tests in `apps/api/tests/integration/users/deactivation/deactivate.spec.ts`: no session returns `401 E_UNAUTHORIZED_ACCESS`; a viewer whose access is not active returns `401`; `OPERATIONS_ADMIN`, `OPERATIONS_LEAD`, and `OBSERVER` each return `403 E_AUTHORIZATION_FAILURE`; in every case the target is unchanged and the refusal is identical whether or not the target exists (US3.1, US3.2, FR-002)
- [X] T035 [P] [US3] Feature test in `apps/web/src/features/users/__tests__/deactivate/permissions.test.tsx`: an operations admin sees no `Deactivate` action on any record, and an organization admin sees none on their own record nor on a pending, cancelled, or already deactivated one (US3.3, FR-015)

### Implementation for User Story 3

- [X] T036 [US3] Gate the action in `apps/web/src/features/users/ui/user-access-actions.tsx` on all three conditions of [contracts/user-deactivation-action.md](./contracts/user-deactivation-action.md) — viewer role `ORGANIZATION_ADMIN`, record `accessStatus` `ACTIVE`, and `user.id !== viewer.id` — rendering nothing rather than a disabled control ([D10](./research.md#d10--who-sees-the-action))
- [X] T037 [US3] Confirm by reading `apps/api/app/controllers/users_controller.ts` that the policy check precedes the parameter validation and the use case, so an unauthorized caller can never learn whether a target exists, and add a comment recording why the order matters (FR-002)

**Checkpoint**: all three stories are independently demonstrable, and the interface offers exactly
what the API permits

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T038 [P] Run the browser journeys and the API checks of [quickstart.md](./quickstart.md), including the sign-in cut and the open-session cut, resetting with `pnpm --filter @portflow/api db:fresh`
- [X] T039 [P] Re-read [spec.md](./spec.md)'s FR-001–FR-020 against the diff and confirm every one maps to a passing test or a reviewed behavior, in particular FR-011's untouched-column list and FR-012's password renewal requirement
- [X] T040 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the repository root and resolve every finding — `pnpm check` and `pnpm typecheck` clean; API 1020/1020; web users 74/75, the one failure being the pre-existing `scale.perf.test.tsx` wall-clock budget, which fails 3 of 4 runs on the untouched baseline of this machine
- [ ] T041 Obtain a fresh read-only review of the final diff and resolve or explicitly justify every confirmed finding, per Constitution Principle VII

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependency — starts immediately
- **Foundational (Phase 2)**: depends on Setup — **blocks every user story**
- **User Story 1 (Phase 3)**: depends on Phase 2. Delivers the endpoint, so it blocks the two stories that refuse through it
- **User Story 2 (Phase 4)**: depends on Phase 3 — it refines the use case and the dialog US1 creates
- **User Story 3 (Phase 5)**: depends on Phase 3 for the endpoint and the component it gates; independent of Phase 4
- **Polish (Phase 6)**: depends on every story being complete

### User Story Dependencies

Unlike a read slice, these three stories share one endpoint and one dialog, so they are independently
**testable and demonstrable** but not independently orderable: US1 must exist before US2 and US3 have
anything to refuse through. US2 and US3 touch disjoint concerns — the use case's outcome mapping
versus the authorization matrix and the interface gate — and can be worked in parallel once US1 is
done, with T033 and T036 the only two tasks that meet in the same file.

### Within Each User Story

- Tests are written and confirmed failing before the implementation they cover
- Repository outcomes before the use case, the use case before the controller, the controller before
  the route, the route before anything in `apps/web` (the Tuyau registry regenerates from it)
- The mutation and the copy before the component, the component before the record that mounts it

### Parallel Opportunities

- T002 and T003 (Setup)
- T004, T005, T006, T008, T009 (Foundational) — five different files; T007 waits on T006
- T010, T012, T013, T015 (US1 tests) — four different files; T011 and T014 follow T010 and T013 in
  the same files
- T019 and T020 (US1 web) — different files, both feeding T021
- T024, T025, T026, T029, T030 (US2 tests) — five different files; T027 and T028 follow T026
- T034 and T035 (US3 tests)
- T038 and T039 (Polish)

---

## Parallel Example: User Story 1

```bash
# Launch the four independent US1 test tasks together:
Task: "Unit test the successful transition in apps/api/tests/unit/users/deactivation/deactivate.spec.ts"
Task: "Unit test the guarded write in apps/api/tests/unit/users/deactivation/guarded_write.spec.ts"
Task: "Integration test the 200 payload in apps/api/tests/integration/users/deactivation/deactivate.spec.ts"
Task: "Feature test the workbench journey in apps/web/src/features/users/__tests__/deactivate/journey.test.tsx"

# Then the two independent web building blocks:
Task: "Create the mutation hook in apps/web/src/features/users/mutations/use-user-mutations.ts"
Task: "Create the copy module in apps/web/src/features/users/helpers/user-access-copy.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup
2. Phase 2: Foundational — **blocks everything**
3. Phase 3: User Story 1
4. **STOP and VALIDATE**: deactivate an active user from the workbench, confirm they cannot sign in,
   confirm their open session is dead, confirm you cannot deactivate yourself
5. Demonstrable as it stands: the refusals are safe, only unspecific

### Incremental Delivery

1. Setup + Foundational → the guarded write and the policy exist
2. US1 → the write works end to end and every unsafe target is already refused (**MVP**)
3. US2 → each refusal gains the reason that makes it actionable
4. US3 → the matrix is proved and the interface stops offering what the API refuses
5. Polish → quickstart, full verification, fresh review

### Parallel Team Strategy

Two developers after Phase 3: one takes US2 (use case outcome mapping, refusal copy, refusal and
recovery tests), the other takes US3 (authorization matrix, interface gate). They meet only in
`user-access-actions.tsx`, at T033 and T036 — sequence those two.

---

## Notes

- `[P]` means a different file and no dependency on an incomplete task
- Verify each test fails before writing the code that makes it pass
- Commit after each task or logical group, with Conventional Commits per `AGENTS.md`
- No migration: every column this feature writes was delivered by GH-2
- **Follow-up worth an issue of its own, not a task here**: [D5](./research.md#d5--a-malformed-identifier-is-rejected-before-the-database-is-touched)
  found that every delivered site-reference `:id` lifecycle route has the same latent 500 on a
  malformed identifier, since `id` is a real `uuid` column and no route validates it. This slice
  fixes only its own endpoint
