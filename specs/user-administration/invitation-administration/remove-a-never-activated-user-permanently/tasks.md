---

description: "Task list for Remove a Never-Activated User Permanently"
---

# Tasks: Remove a Never-Activated User Permanently

**Input**: Design documents from
`/specs/user-administration/invitation-administration/remove-a-never-activated-user-permanently/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV makes RED → GREEN → REFACTOR binding, and research D9
fixes the seams: Japa unit tests for the eligibility matrix, the cascade, and the write's isolation;
Japa integration tests for the authorization matrix and every status the endpoint returns; Vitest
feature tests rendering the real router with MSW for the workbench. `apps/web/e2e` does not exist,
so this slice adds no end-to-end journey.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and
demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task serves (US1–US4)
- Exact file paths are given in every description

## Path Conventions

Web application monorepo — `apps/api/` (AdonisJS 7) and `apps/web/` (TanStack Start), per plan.md's
Structure Decision. The API slice is laid out like `app/users/password_reset`; the web change extends
the access-action mechanism of `src/features/users/user-access.tsx` that deactivation introduced.

**No migration.** FR-012 resolved the removal to "untraced", and every foreign key the slice relies
on is already declared (data-model.md). Any task proposing a schema change is out of scope.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the ground the slice stands on and create the directories it needs

- [X] T001 Confirm no migration is required: check that `apps/api/database/migrations/1785700000000_create_user_activation_tokens_table.ts` declares `user_id … ON DELETE CASCADE`, that `1784200000000_create_remember_me_tokens_table.ts` declares `tokenable_id … ON DELETE CASCADE`, that `1785000000003_create_shifts_table.ts` declares `responsible_user_id … ON DELETE RESTRICT`, and that `apps/api/config/database.ts` sets `foreign_keys = ON` for SQLite — the four facts research D5 and D6 rest on
- [X] T002 [P] Create the API slice and test directories `apps/api/app/users/removal/`, `apps/api/tests/unit/users/removal/`, and `apps/api/tests/integration/users/removal/`
- [X] T003 [P] Create the web test directory `apps/web/src/features/users/__tests__/removal/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The write plumbing every story needs — the database helper, the guarded repository
operation and its typed outcome, the named exceptions, the validator, the policy method, and the MSW
handlers the web tests stand on. No endpoint and no screen is exposed by this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Create `apps/api/app/shared/database/is_foreign_key_violation.ts`, the sibling of `is_unique_violation.ts` in the same shape, returning true for PostgreSQL code `23503` and SQLite code `SQLITE_CONSTRAINT_FOREIGNKEY` (research D6) — *amended during T022/T023: SQLite reports `ON DELETE RESTRICT` as `SQLITE_CONSTRAINT_TRIGGER` with "FOREIGN KEY constraint failed", which the helper now also accepts*
- [X] T005 [P] Create `apps/api/app/users/removal/removal_exceptions.ts` with three 409 exceptions in the style of `apps/api/app/users/shared/user_exceptions.ts`: `UserActiveCannotBeRemovedException` (`E_USER_ACTIVE_CANNOT_BE_REMOVED`, message "Only users who never activated their access can be removed; deactivate an active user instead"), `UserDeactivatedCannotBeRemovedException` (`E_USER_DEACTIVATED_CANNOT_BE_REMOVED`, message "Users who once held access are kept and cannot be removed"), and `UserReferencedCannotBeRemovedException` (`E_USER_REFERENCED_CANNOT_BE_REMOVED`, message "This user is named in operational records and cannot be removed"); each with a doc comment saying why it is a 409 (research D3, FR-002, FR-003, FR-011)
- [X] T006 [P] Create `apps/api/app/users/removal/remove_user_validator.ts` exporting `removeUserValidator` — `vine.create({ params: vine.object({ id: vine.string().uuid() }) })` — copying the doc comment of `apps/api/app/users/deactivate/deactivate_user_validator.ts` on why `params.id` is validated (contract: [remove-user.md](./contracts/remove-user.md))
- [X] T007 [P] Add `remove(user)` to `apps/api/app/users/shared/user_policy.ts` returning `user.accessStatus === 'ACTIVE' && user.role === 'ORGANIZATION_ADMIN'`, with a doc comment in the register of `deactivate`'s: the policy says whether the viewer may remove anyone at all; *which* user is removable is the guarded write's decision. Do not merge it with `deactivate` (research D2, FR-013)
- [X] T008 Add `RemoveUserCommand` (`{ id: string }`), `RemoveUserResult` (`REMOVED` | `NOT_FOUND` | `NOT_REMOVABLE` with `accessStatus: UserAccessStatus` | `REFERENCED`), and the abstract `removeNeverActivated(command)` with its doc comment to `apps/api/app/users/shared/repositories/user_repository.ts`, exactly as typed in [data-model.md](./data-model.md)
- [X] T009 Implement `removeNeverActivated` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts` as one guarded statement — `User.query().where('id', command.id).whereIn('accessStatus', ['PENDING', 'CANCELLED']).delete()` — wrapped in a `try` whose `catch` returns `{ kind: 'REFERENCED' }` when `isForeignKeyViolation(error)` and rethrows otherwise; on zero affected rows re-read the row and return `NOT_FOUND` or `NOT_REMOVABLE` with the status observed; no transaction *(amended during T031: the statement runs in `User.transaction()`, a savepoint when nested, because PostgreSQL aborts the enclosing transaction on a refused delete — research D4)*. Carry a comment, in the register of `changeRole`'s, explaining that the guard is the eligibility rule and the concurrency control, that the activation link goes by the schema's `ON DELETE CASCADE` within the same statement, and why the `SET NULL` references are unreachable for a never-activated user (research D4–D6, depends on T004, T008)
- [X] T010 [P] Add removal handlers to `apps/web/src/features/users/__tests__/support/test-helpers.ts`, modelled on the deactivation ones: `mockUsersWithRemoval(viewer?, users?)` whose `DELETE /api/v1/users/:id` drops the entry from the collection it serves and answers `204` (or the `404` `E_USER_NOT_FOUND` body for an unknown id); `mockRemovalRefused(code, message, status = 409)`; `mockRemovalLostRace(targetId)` where the refusal is `E_USER_ACTIVE_CANNOT_BE_REMOVED` and the following read serves the target as `ACTIVE`; and `mockRemovalUnreachable()` answering `HttpResponse.error()`

**Checkpoint**: a never-activated user can be removed in code, and the policy can answer *may this
viewer remove users at all* — but nothing is reachable over HTTP and nothing is offered in the
interface.

---

## Phase 3: User Story 1 — Remove a Never-Activated User (Priority: P1) 🎯 MVP

**Goal**: An organization admin removes a pending or cancelled user from the workbench, after a
single confirmation; the user, their activation link, and their hold on their email are gone.

**Independent Test**: Sign in as an organization admin, remove a pending user and a cancelled user,
and verify each is absent from every view and count, that no activation token remains, and that a new
invitation with the same email succeeds.

### Tests for User Story 1 ⚠️

> Write these first and watch them fail before implementing T015–T021.

- [X] T011 [P] [US1] Unit tests in `apps/api/tests/unit/users/removal/remove.spec.ts` (with `testUtils.db().wrapInGlobalTransaction()`, like `tests/unit/users/deactivation/guarded_write.spec.ts`) against the repository and the use case: a `PENDING` target (`UserFactory.apply('invited')`) and a `CANCELLED` one (`apply('cancelled')`) come back `REMOVED` and are no longer in `users`; the target's `user_activation_tokens` row (`UserActivationTokenFactory`) is gone; the inviting admin and one unrelated user are byte-for-byte unchanged, lifecycle fields included (FR-010); the `users` count drops by exactly one and the activation-token count by exactly the target's, so nothing records the removal (FR-012); and a new user with the removed email in another casing can then be invited through `UserRepository.invite` (FR-008)
- [X] T012 [P] [US1] Integration tests in `apps/api/tests/integration/users/removal/remove.spec.ts` for the success path: an organization admin `DELETE`s `/api/v1/users/:id` for a pending and for a cancelled user, receives `204` with an empty body, `GET /api/v1/users` no longer lists them, and `POST /api/v1/users` with the same email upper-cased and space-padded answers `201` (contract: [remove-user.md](./contracts/remove-user.md), FR-006, FR-008)
- [X] T013 [P] [US1] Feature tests in `apps/web/src/features/users/__tests__/removal/journey.test.tsx`, in the shape of `__tests__/deactivate/journey.test.tsx`, using `mockUsersWithRemoval`: from the `Pending` view, open Chloé's record, press `Remove`, see the `Remove user?` alert dialog naming her and stating the removal is permanent, that her activation link stops working, and that her email can be invited again, with no textbox (FR-017); `Cancel` sends nothing and leaves her listed; confirming shows `User “Chloé …” removed`, closes the record, drops her row, and decrements the `Pending` count without a reload (FR-018); the same from the `Cancelled` view for Élodie
- [X] T014 [P] [US1] Feature tests in `apps/web/src/features/users/__tests__/removal/row-menu.test.tsx`, in the shape of `__tests__/deactivate/row-menu.test.tsx`: a pending and a cancelled row's menu end with `Remove`; choosing it opens the same confirmation, and confirming removes the user in three interactions from the list — menu, `Remove`, `Remove` (FR-016, SC-005)

### Implementation for User Story 1

- [X] T015 [US1] Create `apps/api/app/users/removal/remove_user_use_case.ts` with an explicit `RemoveUserInput` (`{ id: string }` — no actor, research D7), delegating to `UserRepository.removeNeverActivated` and returning nothing on `REMOVED`; map `NOT_FOUND` to `UserNotFoundException`, `REFERENCED` to `UserReferencedCannotBeRemovedException`, and `NOT_REMOVABLE` to `UserDeactivatedCannotBeRemovedException` when the status is `DEACTIVATED` and to `UserActiveCannotBeRemovedException` otherwise (data-model.md, "Repository operation"); the refusal branches land here because the union cannot be narrowed without them, and US2 proves them (depends on T005, T009)
- [X] T016 [US1] Add `destroy` to `apps/api/app/controllers/users_controller.ts`: `bouncer.with(UserPolicy).authorize('remove')` **before** anything else, then `request.validateUsing(removeUserValidator, { data: { params } })`, then the use case with `payload.params.id`, then `response.status(204)` with no body; doc comment on why authorization comes first, as `deactivate`'s says (research D1, D3, depends on T006, T007, T015)
- [X] T017 [US1] Register `router.delete('/:id', [controllers.Users, 'destroy']).as('destroy')` inside the existing `/users` group in `apps/api/start/routes.ts` (depends on T016)
- [X] T018 [US1] Regenerate and commit the Tuyau registry so `users.destroy` appears in `apps/api/.adonisjs/client/registry/index.ts`, `schema.d.ts`, `tree.d.ts`, and `apps/api/.adonisjs/server/routes.d.ts`, with method `DELETE`; confirm the client tree exposes it as `users.destroy` (depends on T017)
- [X] T019 [P] [US1] Add `remove` to `apps/web/src/features/users/mutations/use-user-mutations.ts` from `tuyauQuery.users.destroy.mutationOptions`, refreshing the collection on success and on error, with the same comment `deactivate` carries about refreshing on a refusal; return it from the hook (research D8, depends on T018)
- [X] T020 [P] [US1] Extend `apps/web/src/features/users/helpers/user-access-copy.ts` with the `'remove'` action: `UserAccessAction = 'deactivate' | 'remove'`; labels `Remove` / `Removing…`; past participle `removed`; failure verb `remove`; and make `describeUserAccessEffect` use its `action` — the deactivation sentence unchanged, the removal one naming the user and saying the removal is permanent and cannot be undone, that their activation link stops working, and that their email can be invited again (contract: [remove-action.md](./contracts/remove-action.md), FR-017)
- [X] T021 [US1] Wire the action in `apps/web/src/features/users/user-access.tsx`: `USER_ACCESS_ACTION_VARIANTS.remove = 'destructive'`; `userAccessActions` returns `['remove']` for an organization admin on a `PENDING` or `CANCELLED` user other than themselves, `['deactivate']` on an `ACTIVE` one as today, and `[]` otherwise, updating its doc comment; `UserAccessDialog` takes `deactivate` and `remove` from `useUserMutations()`, sends `remove.mutateAsync({ params: { id } })` for a removal, and reads `isPending` from the mutation its action uses. `ui/user-access-actions.tsx`, `ui/user-row-actions.tsx`, and `ui/user-access-record.tsx` need no change (depends on T019, T020)

**Checkpoint**: an organization admin can remove a never-activated user end to end. Refusals are
wired but not yet proven, and the authorization matrix is not yet pinned — US2 and US3 close both,
so do not expose the route beyond the development environment at this checkpoint.

---

## Phase 4: User Story 2 — Refuse to Remove a User Who Once Held Access (Priority: P1)

**Goal**: An active user, a deactivated user, an unknown or already-removed user, and a user named by
a restricting record are each refused with the right status and reason, and nothing moves.

**Independent Test**: Attempt the removal, at the API seam, against an active user, a deactivated
user, an unknown id, a pending user named as a shift's responsible, and the same pending user twice;
verify each refusal, its reason, and that no row changed.

### Tests for User Story 2 ⚠️

- [X] T022 [P] [US2] Extend `apps/api/tests/unit/users/removal/remove.spec.ts` with the refusal branches: an `ACTIVE` target raises `UserActiveCannotBeRemovedException`, a `DEACTIVATED` one `UserDeactivatedCannotBeRemovedException`, an unknown id `UserNotFoundException`, and a second removal of the same user `UserNotFoundException`; a pending user moved to `ACTIVE` after being read is refused as active — the guard is evaluated at execution (US2 scenario 4, FR-005); a pending user set as `responsibleUserId` of a `ShiftFactory` shift comes back `REFERENCED`; after every refusal the target row, its activation token, and the shift are unchanged (FR-009, FR-011)
- [X] T023 [P] [US2] Extend `apps/api/tests/integration/users/removal/remove.spec.ts` with `409` `E_USER_ACTIVE_CANNOT_BE_REMOVED` for an active target **and for the requesting admin's own id**, `409` `E_USER_DEACTIVATED_CANNOT_BE_REMOVED`, `409` `E_USER_REFERENCED_CANNOT_BE_REMOVED` for a shift's responsible, `404` `E_USER_NOT_FOUND` for an unknown id and for a second `DELETE` of a removed user, and `422` for an id that is not a UUID; each case asserts the target row is unchanged and the error body follows `{ error: { code, message } }` (FR-002–FR-004, FR-011)
- [X] T024 [P] [US2] Feature tests in `apps/web/src/features/users/__tests__/removal/refusals.test.tsx`, in the shape of `__tests__/deactivate/refusals.test.tsx`: each refusal code (via `mockRemovalRefused`) shows `Unable to remove user “…”` with its second-person reason; `mockRemovalLostRace` shows the active reason, and the refreshed collection moves the user to the `Active` view and closes the record; a `404` reads "This user no longer exists." and the row disappears; a referenced refusal leaves the dialog open over an unchanged user (FR-020, US2 scenarios 5–6)

### Implementation for User Story 2

- [X] T025 [US2] Add the three removal codes to `USER_ACCESS_REFUSAL_REASONS` in `apps/web/src/features/users/helpers/user-access-copy.ts` — "This user has activated their access, so they are kept. Deactivate them instead.", "This user once held access, so they are kept.", "This user is named in operational records, so they are kept." — reusing the existing `E_USER_NOT_FOUND` sentence (contract: [remove-action.md](./contracts/remove-action.md), depends on T020)

**Checkpoint**: every state-based refusal holds at both seams. The use case's refusal mapping landed
with T015; this phase is what proves it.

---

## Phase 5: User Story 3 — Withhold Removal From Every Other Viewer (Priority: P1)

**Goal**: Only an active organization admin can remove a user, the API is the boundary, and a denial
discloses nothing whatever the identifier names.

**Independent Test**: Attempt the removal as an operations admin, an operations lead, an observer, an
unauthenticated visitor, and a non-active user; verify each is denied at the API, that no user is
modified, and that the workbench offers them no `Remove`.

**Note**: no implementation task. T007 (policy), T016 (authorization before validation and lookup),
and T021 (`userAccessActions`) already carry the rule; this phase pins it with tests.

### Tests for User Story 3 ⚠️

- [X] T026 [P] [US3] Extend `apps/api/tests/integration/users/removal/remove.spec.ts` with the authorization matrix: `401` unauthenticated and for a non-active session; `403` for an operations admin, an operations lead, and an observer; and the `403` identical — status and body — whether the id names a pending, a cancelled, an active user, nobody, or is not a UUID at all, which proves the policy runs before validation and before the target is read; no user is modified in any case (FR-013, FR-015, SC-001)
- [X] T027 [P] [US3] Feature tests in `apps/web/src/features/users/__tests__/removal/permissions.test.tsx`, in the shape of `__tests__/deactivate/permissions.test.tsx`: an operations admin sees no `Remove` in any row menu or record; an organization admin sees no `Remove` on an active user, a deactivated user, or their own record, and sees `Deactivate` — not `Remove` — on an active one (FR-014, FR-016)

**Checkpoint**: the authorization boundary is proven at the API and mirrored — never replaced — by
the interface.

---

## Phase 6: User Story 4 — Recover From a Failed Removal (Priority: P3)

**Goal**: A failure is reported distinctly from a refusal and from a success, changes nothing, and is
retryable without leaving the user administration area.

**Independent Test**: Make the removal unreachable, confirm one, verify the failure is distinguished
from a business refusal, restore availability, retry, and confirm the user is removed once.

**Note**: no implementation task. `UserAccessDialog` already keeps itself open on a failure and
reports it as a toast; T021 routes a removal through that same path.

### Tests for User Story 4 ⚠️

- [X] T028 [P] [US4] Feature tests in `apps/web/src/features/users/__tests__/removal/recovery.test.tsx`, in the shape of `__tests__/deactivate/recovery.test.tsx`: with `mockRemovalUnreachable`, confirming shows a failure distinct from every refusal reason, the dialog stays open, and the user is still listed; after re-registering `mockUsersWithRemoval`, pressing `Remove` again removes the user exactly once and the workbench reflects it without a new sign-in (FR-019)

**Checkpoint**: all four stories are independently demonstrable.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T029 [P] Bring the comments the second access action falsifies up to date: the header of `apps/web/src/features/users/helpers/user-access-copy.ts` ("the record gains reactivation next"), the header of `apps/web/src/features/users/ui/user-row-actions.tsx` ("That trade turns when the user record gains its own second and third access action"), and the doc comment of `UserAccessDialog` in `apps/web/src/features/users/user-access.tsx`, which describes deactivation only — reword, do not delete the reasoning
- [X] T030 [P] Tick the delivery boxes in [checklists/requirements.md](./checklists/requirements.md) — "Source acceptance criteria" and "Verification" — naming the test that satisfies each, and drop the now-resolved "Decision to confirm at spec review" note
- [X] T031 Run the manual walkthrough and the curl refusal checks in [quickstart.md](./quickstart.md) against a seeded PostgreSQL database — the one place the `RESTRICT` and `CASCADE` behaviour is exercised outside SQLite
- [X] T032 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the repository root, then obtain a fresh read-only review of the final diff and resolve or explicitly justify every confirmed finding (Constitution VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — BLOCKS every user story
- **US1 (Phase 3)**: depends on Foundational. Delivers the MVP
- **US2 (Phase 4)**: depends on Foundational; its API tests need US1's endpoint (T016–T017), its copy task edits the file T020 creates the `'remove'` key in
- **US3 (Phase 5)**: depends on US1's endpoint and on T021's gate
- **US4 (Phase 6)**: depends on US1's dialog wiring (T021)
- **Polish (Phase 7)**: depends on every story being complete

### Where the stories genuinely diverge

The unit halves of US2 are independent of US1's HTTP work — T022 exercises the repository and the use
case directly. Everything else leans on US1: there is one endpoint and one dialog, and US2–US4 prove
refusals, authorization, and recovery *of that endpoint and that dialog*. Story-level parallelism
beyond the tests would be a fiction; the phases are ordered to say so.

### Within Each User Story

- Tests are written and observed failing before the implementation tasks in the same phase
- Helper and exceptions before repository, repository before use case, use case before controller,
  controller before route, route before the Tuyau registry, registry before the web mutation
- The copy and the mutation exist before `user-access.tsx` wires them into the dialog

### Parallel Opportunities

- **Phase 1**: T002 and T003
- **Phase 2**: T004, T005, T006, T007, and T010 — five different files; T008 → T009 is the one chain
- **Phase 3**: T011, T012, T013, T014 together; T020 alongside the API chain T015 → T016 → T017 → T018; T019 once T018 lands
- **Phase 4**: T022, T023, T024 together
- **Phase 5**: T026 and T027 together
- **Phase 7**: T029 and T030

---

## Parallel Example: User Story 1

```bash
# The four failing tests, together:
Task: "Repository and use case removal in apps/api/tests/unit/users/removal/remove.spec.ts"
Task: "DELETE success path and re-invitation in apps/api/tests/integration/users/removal/remove.spec.ts"
Task: "Record removal journey in apps/web/src/features/users/__tests__/removal/journey.test.tsx"
Task: "Row menu removal in apps/web/src/features/users/__tests__/removal/row-menu.test.tsx"

# The copy alongside the API chain, and the mutation once the registry exposes users.destroy:
Task: "Add the remove mutation in apps/web/src/features/users/mutations/use-user-mutations.ts"
Task: "Add the 'remove' copy in apps/web/src/features/users/helpers/user-access-copy.ts"
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1 — Setup
2. Phase 2 — Foundational
3. Phase 3 — User Story 1
4. **STOP and VALIDATE**: an organization admin removes a pending and a cancelled user end to end,
   and re-invites the same email

Do not demo the MVP against production data: at that checkpoint the refusals are wired but unproven,
and the authorization matrix is not yet pinned by tests.

### Incremental delivery

US1 → US2 → US3 close the P1 set and make the slice reviewable. US4 adds the proof that a failure is
recoverable. Each phase leaves the branch green.

### Before the PR is ready

Carry into the PR description that removal is deliberately untraced (FR-012) and irreversible, and
that `DELETE /api/v1/users/:id` is the first `DELETE` route of the API (research D1).

---

## Notes

- `[P]` means a different file and no dependency on an incomplete task
- `[Story]` maps a task to the user story it serves, for traceability back to the spec's FRs
- Commit after each task or logical group, using Conventional Commits
- Verify tests fail before implementing
- No task in this list changes the database schema; if one appears to need to, the spec's FR-012 is
  being reopened and that is a spec change, not an implementation detail
