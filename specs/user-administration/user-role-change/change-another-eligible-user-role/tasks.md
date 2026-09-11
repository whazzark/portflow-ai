---

description: "Task list for Change Another Eligible User Role"
---

# Tasks: Change Another Eligible User Role

**Input**: Design documents from
`/specs/user-administration/user-role-change/change-another-eligible-user-role/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV makes RED → GREEN → REFACTOR binding, and D10 fixes
the seams: Japa unit tests for the eligibility matrix and the write's isolation, Japa integration
tests for the authorization matrix and every status the endpoint returns, Vitest feature tests
rendering the real router with MSW for the workbench. `apps/web/e2e` does not exist, so this slice
adds no end-to-end journey.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and
demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task serves (US1–US5)
- Exact file paths are given in every description

## Path Conventions

Web application monorepo — `apps/api/` (AdonisJS 7) and `apps/web/` (TanStack Start), per plan.md's
Structure Decision. The API slice mirrors `app/trucks/suspend`; the web change lives inside the
delivered `src/features/users` module.

**No migration.** FR-016 resolved role change traceability to "untraced", so `users` is not altered
(D5). Any task proposing a schema change is out of scope for this slice.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the ground the slice stands on and create the directories it needs

- [X] T001 Confirm no migration is required by checking `apps/api/database/migrations/1783663779445_create_users_table.ts` and `apps/api/database/schema.ts` against the column table in [data-model.md](./data-model.md) — `role`, `access_status`, and `updated_at` must all already exist, and no activation-link column may be present
- [X] T002 [P] Create the API slice and test directories `apps/api/app/users/role_change/`, `apps/api/tests/unit/users/role_change/`, and `apps/api/tests/integration/users/role_change/`
- [X] T003 [P] Create the web directories `apps/web/src/features/users/mutations/` and `apps/web/src/features/users/__tests__/role-change/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The write plumbing every story needs — the guarded repository operation, its typed
outcome, the named exceptions, the validator, and the policy method. No endpoint and no screen is
exposed by this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Create `apps/api/app/users/shared/user_exceptions.ts` with `UserNotFoundException` (404, `E_USER_NOT_FOUND`) and `UserDeactivatedCannotChangeRoleException` (409, `E_USER_DEACTIVATED_CANNOT_CHANGE_ROLE`, message naming reactivation as the way forward), following the shape and message style of `apps/api/app/trucks/shared/truck_exceptions.ts` (D3, FR-003)
- [X] T005 [P] Create `apps/api/app/users/shared/user_validator.ts` exporting `changeUserRoleValidator`, a VineJS schema whose sole field `role` is `vine.enum(USER_ROLES)` from `#models/user`, so the four roles are validated against the model's own tuple (D3, FR-004)
- [X] T006 [P] Add `changeRole(user)` to `apps/api/app/users/shared/user_policy.ts` returning `user.accessStatus === 'ACTIVE' && user.role === 'ORGANIZATION_ADMIN'`, deliberately narrower than the existing `list` — do not refactor the two into a shared helper (D2, FR-007)
- [X] T007 Add `ChangeUserRoleCommand`, `ChangeUserRoleResult` (`CHANGED` with the user, `NOT_FOUND`, `DEACTIVATED`), and the `changeRole` abstract signature to `apps/api/app/users/shared/repositories/user_repository.ts`, leaving `create`, `findByEmail`, `list`, `listActive`, and `renewPassword` untouched
- [X] T008 Implement `changeRole` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts` as a single guarded statement — `.where('id', …).whereNot('accessStatus', 'DEACTIVATED').update({ role, updatedAt })` with `updatedAt` written by hand because `.update()` bypasses the model hook — re-reading the row on a zero-row result to classify `NOT_FOUND` versus `DEACTIVATED`, and re-reading it with the five lifecycle-actor preloads on `CHANGED`; carry a comment explaining why no transaction wraps it, in the register of the neighbouring `renewPassword` (D4, depends on T007)
- [X] T009 [P] Add `USER_SINGULAR` and the four-entry role option list built from `USER_ROLE_LABELS` to `apps/web/src/features/users/helpers/user-labels.ts`, so the form and the toasts take their noun and their labels from one place

**Checkpoint**: the role of an eligible user can be changed in code, and the policy can answer *may
this viewer change roles at all* — but nothing is reachable over HTTP and nothing is offered in the
interface.

---

## Phase 3: User Story 1 — Change an Eligible User's Role (Priority: P1) 🎯 MVP

**Goal**: An organization admin changes another user's responsibility level from the workbench, and
the change is visible everywhere that user appears.

**Independent Test**: Sign in as an organization admin, open a pending, an active, and a cancelled
user in turn, assign each a different role, and verify the role changes, nothing else about the user
changes, and the table, record, and role filter all follow.

### Tests for User Story 1 ⚠️

> Write these first and watch them fail before implementing T013–T020.

- [X] T010 [P] [US1] Unit tests in `apps/api/tests/unit/users/role_change/change_role.spec.ts` covering: the role changes for a `PENDING`, an `ACTIVE`, and a `CANCELLED` target (`UserFactory.apply('invited' | 'active' | 'cancelled')`); the access status is unchanged in each case; submitting the role already held succeeds with an unchanged row (FR-006); and a full-row comparison proves only `role` and `updatedAt` moved (FR-005, FR-016 — assert no lifecycle field, no `passwordRenewalRequiredAt`, and no new column records the change)
- [X] T011 [P] [US1] Integration test in `apps/api/tests/integration/users/role_change/change_role.spec.ts` for the success path: an organization admin `PATCH`es `/api/v1/users/:id/role`, receives `200` with the `toAdministration` projection including the access history, and the persisted row carries the new role (contract: [change-user-role.md](./contracts/change-user-role.md))
- [X] T012 [P] [US1] Feature test in `apps/web/src/features/users/__tests__/role-change/change.test.tsx`: an organization admin opens a user, uses `Change role`, picks another role, submits, and sees the new role in the record, in the table row, and in the role filter's counts — without a reload (FR-012, FR-014)

### Implementation for User Story 1

- [X] T013 [US1] Create `apps/api/app/users/role_change/change_user_role_use_case.ts` with an explicit `ChangeUserRoleInput` (`userId`, `role`), delegating to `UserRepository.changeRole` and returning the user on `CHANGED`; leave the refusal branches to US2 (depends on T008)
- [X] T014 [US1] Add `changeRole` to `apps/api/app/controllers/users_controller.ts`: `bouncer.with(UserPolicy).authorize('changeRole')` **before** any target lookup, then `request.validateUsing(changeUserRoleValidator)`, then the use case, then `serialize(UserTransformer.transform(user, { includeAccessHistory: true }).useVariant('toAdministration'))` (D3, D7, depends on T013)
- [X] T015 [US1] Register `router.patch('/:id/role', [controllers.Users, 'changeRole']).as('change_role')` inside the existing `/users` group in `apps/api/start/routes.ts` (depends on T014)
- [X] T016 [US1] Regenerate and commit the Tuyau registry so `users.change_role` appears in `apps/api/.adonisjs/client/registry/tree.d.ts`, `schema.d.ts`, and `apps/api/.adonisjs/server/routes.d.ts`; confirm the client tree exposes it as `users.changeRole`, the camel form the web will call (depends on T015)
- [X] T017 [P] [US1] Add the `mode` search parameter (`'view' | 'edit'`, defaulting to `view`) to the Zod schema in `apps/web/src/routes/_authenticated/users.tsx`, and clear it in the route's `transform` whenever `userId` is absent, so the two can never contradict each other (D9, workbench contract)
- [X] T018 [P] [US1] Create `apps/web/src/features/users/mutations/use-user-mutations.ts` exposing `changeRole` from `tuyauQuery.users.changeRole.mutationOptions`, invalidating `userQueries.list()` on success, in the shape of `apps/web/src/features/trucks/mutations/use-truck-mutations.ts` (the `auth.me` invalidation is US4's T032) (depends on T016)
- [X] T019 [US1] Create `apps/web/src/features/users/ui/change-user-role-panel.tsx`: `useAppForm` with a `SelectField` over the four roles defaulting to the role the user holds, `form.FormError`, `form.SubmitButton` with `WRITE_PENDING_LABELS.update` and the label `Change role`, and a header "Back to details" as the way out — modelled on `apps/web/src/features/customers/ui/customer-form.tsx` and the detail-panel chrome rules in `apps/web/AGENTS.md` (depends on T009, T018)
- [X] T020 [US1] Offer the action from `apps/web/src/features/users/ui/user-access-record.tsx` and switch between the record and the panel on `mode` in `apps/web/src/features/users/ui/user-sheet.tsx` and `apps/web/src/features/users/ui/users-page.tsx`; while editing `user-access-record.tsx`, correct its opening comment — "Read-only by design … no role change (FR-016)" cites GH-4's requirement numbering and stops being true here (depends on T017, T019)

**Checkpoint**: an organization admin can change an eligible user's role end to end. The refusals are
not yet exhaustive — US2 and US3 close them — so do not expose the route beyond the development
environment at this checkpoint.

---

## Phase 4: User Story 2 — Refuse a Role Change the Organization Must Not Allow (Priority: P1)

**Goal**: A deactivated target, an unknown user, and an invalid role are each refused with the right
status and reason, and the target is left untouched.

**Independent Test**: Attempt the change against a deactivated user, an unknown id, and with a role
outside the four, at the API seam; verify each refusal, its reason, and that nothing moved.

### Tests for User Story 2 ⚠️

- [X] T021 [P] [US2] Extend `apps/api/tests/unit/users/role_change/change_role.spec.ts` with the refusal branches: a `DEACTIVATED` target raises `UserDeactivatedCannotChangeRoleException`, an unknown id raises `UserNotFoundException`, and a target deactivated after the record was read is still refused — assert the guard is evaluated at execution, not against the state that was displayed (US2 scenario 4, D4)
- [X] T022 [P] [US2] Extend `apps/api/tests/integration/users/role_change/change_role.spec.ts` with `409` + `E_USER_DEACTIVATED_CANNOT_CHANGE_ROLE` for a deactivated target, `404` + `E_USER_NOT_FOUND` for an unknown id, and `422` for a missing or out-of-range `role`; each case must assert the target row is byte-for-byte unchanged (FR-005, SC-003)
- [X] T023 [P] [US2] Feature test in `apps/web/src/features/users/__tests__/role-change/refusals.test.tsx`: a deactivated user's record offers no `Change role` and states that the user must be reactivated first; a hand-typed `?mode=edit` on that user opens the read-only record; and an API refusal surfaces its message with the displayed role unchanged (FR-013, FR-015)

### Implementation for User Story 2

- [X] T024 [US2] *(landed with T013 — the result union cannot be narrowed to `CHANGED` without it)* Map the repository's `NOT_FOUND` and `DEACTIVATED` outcomes onto the two named exceptions in `apps/api/app/users/role_change/change_user_role_use_case.ts`, in the shape of `apps/api/app/trucks/suspend/suspend_truck_use_case.ts` — the repository stays free of HTTP-aware exception selection (depends on T013)
- [X] T025 [US2] Present the ineligibility in `apps/web/src/features/users/ui/user-access-record.tsx`: for a deactivated user, show why the role cannot be changed instead of silently omitting the action (FR-013, depends on T020)
- [X] T026 [US2] Gate `mode=edit` on the open user's eligibility in `apps/web/src/features/users/ui/users-page.tsx`, falling back to the read-only record — the honest-interface rule from `apps/web/AGENTS.md`, with the API still authoritative (depends on T017, T020)

**Checkpoint**: every state-based refusal holds at both seams.

---

## Phase 5: User Story 3 — Withhold Role Changes From Every Other Viewer (Priority: P1)

**Goal**: Only an active organization admin can change a role, the API is the boundary, and a
refusal discloses nothing about a user the caller may not consult.

**Independent Test**: Attempt the change as an operations admin, an operations lead, an observer, an
unauthenticated visitor, and a non-active user; verify each is denied at the API and that the
workbench offers them no entry point.

### Tests for User Story 3 ⚠️

- [X] T027 [P] [US3] Extend `apps/api/tests/integration/users/role_change/change_role.spec.ts` with the authorization matrix: `401` unauthenticated and for a non-active session, `403` for an operations admin, an operations lead, and an observer — and assert the `403` is identical whether the id names a pending, a cancelled, a deactivated, or a nonexistent user, which is what proves the policy runs before the target is read (FR-007, FR-009, D3)
- [X] T028 [P] [US3] Feature test in `apps/web/src/features/users/__tests__/role-change/permissions.test.tsx`: an operations admin sees no `Change role` on any record, and a hand-typed `?mode=edit` opens the read-only record (FR-008)

### Implementation for User Story 3

- [X] T029 [US3] Gate the entry point and the `edit` mode on `viewer.role === 'ORGANIZATION_ADMIN'` in `apps/web/src/features/users/ui/user-access-record.tsx` and `apps/web/src/features/users/ui/users-page.tsx`, reading the viewer from the existing `useAuthenticatedUser()` as `users-page.tsx` already does for `consultsEveryStatus` (depends on T020, T026)

**Checkpoint**: the authorization boundary is proven at the API and mirrored — never replaced — by
the interface.

---

## Phase 6: User Story 4 — Let the New Role Take Effect for the User (Priority: P2)

**Goal**: A user whose role changed exercises the new role's permissions immediately, on every
browser, without being signed out.

**Independent Test**: With a user signed in, change their role and back, and verify the permissions
they exercise and the navigation offered follow the current role on their next action, with no new
sign-in.

**Note**: D8 — this story is almost entirely verification. Bouncer already resolves policies against
the row on every request and `toObject()` already serializes `role`. Do not build a session
invalidation mechanism.

### Tests for User Story 4 ⚠️

- [ ] T030 [P] [US4] Integration test in `apps/api/tests/integration/users/role_change/change_role.spec.ts`: after an organization admin demotes a signed-in operations admin to observer, that user's own session is refused an operations admin action, `auth.me` reports the new role, and their session and remembered connections still exist (FR-010, FR-011)
- [ ] T031 [P] [US4] Feature test in `apps/web/src/features/users/__tests__/role-change/session.test.tsx`: when `auth.me` reports a new role, the navigation and the actions offered follow it without a new sign-in

### Implementation for User Story 4

- [ ] T032 [US4] Also invalidate the `auth.me` query in `apps/web/src/features/users/mutations/use-user-mutations.ts`, so an administrator who changed their own role sees their own navigation follow; note in a comment that GH-29 refuses that case outright and this line becomes belt-and-braces then (D9, depends on T018)

**Checkpoint**: the change reaches the person it describes, and the tests say so rather than the
architecture being taken on trust.

---

## Phase 7: User Story 5 — Recover From a Failed Role Change (Priority: P3)

**Goal**: A failure is reported distinctly from a refusal and from a success, changes nothing, and is
retryable without leaving the user administration area.

**Independent Test**: Make the change unavailable, submit one, verify the failure is distinguished
from a business refusal, restore availability, retry, and confirm the change is applied once.

### Tests for User Story 5 ⚠️

- [ ] T033 [P] [US5] Feature test in `apps/web/src/features/users/__tests__/role-change/recovery.test.tsx`: an unavailable endpoint yields a failure distinct from a refusal, the displayed role is unchanged, the panel stays open, and a retry after recovery applies the change exactly once (FR-015)

### Implementation for User Story 5

- [ ] T034 [US5] Handle the failure path in `apps/web/src/features/users/ui/change-user-role-panel.tsx`: `applyValidationError` first, then `parseApiError` into a `refusalTitle('change the role of', namedRecord(USER_SINGULAR, …))` toast with the API message as its description, keeping the panel open and the selection intact — the same shape as `customer-form.tsx`, with the copy built from `apps/web/src/helpers/resource-copy.ts` (depends on T019)

**Checkpoint**: all five stories are independently demonstrable.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T035 [P] Confirm `UserTransformer.toObject()` and `toSummary()` are byte-for-byte unchanged, so the `auth.me` and `auth.login` session contract this slice depends on has not moved
- [ ] T036 [P] Tick the delivery boxes in [checklists/requirements.md](./checklists/requirements.md) — the "Source acceptance criteria" and "Verification" sections — naming the test that satisfies each
- [ ] T037 Run the nine-step manual walkthrough and the curl refusal checks in [quickstart.md](./quickstart.md) against a seeded database
- [ ] T038 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the repository root, then obtain a fresh read-only review of the final diff and resolve or explicitly justify every confirmed finding (Constitution VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — BLOCKS every user story
- **US1 (Phase 3)**: depends on Foundational. Delivers the MVP
- **US2 (Phase 4)**: depends on Foundational; its web tasks depend on US1's panel existing
- **US3 (Phase 5)**: depends on Foundational; its web task depends on US1's entry point existing
- **US4 (Phase 6)**: depends on Foundational and on US1's mutation hook
- **US5 (Phase 7)**: depends on US1's panel
- **Polish (Phase 8)**: depends on every story being complete

### Where the stories genuinely diverge

The API halves of US2 and US3 are independent of US1 and of each other — T021, T022, T024, and T027
touch the use case and the test files, not the controller or the route. The web halves are not: US2's
T025/T026, US3's T029, and US5's T034 all edit files US1 creates. This is one command with one
interface, so full story-level parallelism on the web would be a fiction; the phases are ordered to
say so rather than to promise otherwise.

### Within Each User Story

- Tests are written and observed failing before the implementation tasks in the same phase
- Repository before use case, use case before controller, controller before route, route before the
  Tuyau registry, registry before the web mutation
- The panel exists before the tasks that gate, refuse, or recover inside it

### Parallel Opportunities

- **Phase 1**: T002 and T003
- **Phase 2**: T004, T005, T006, and T009 — four different files; T007 → T008 is the one chain
- **Phase 3**: T010, T011, T012 together; then T017 and T018 alongside the API chain T013 → T014 → T015 → T016
- **Phase 4**: T021, T022, T023 together
- **Phase 5**: T027 and T028 together
- **Phase 6**: T030 and T031 together
- **Phase 8**: T035 and T036

---

## Parallel Example: User Story 1

```bash
# The three failing tests, together:
Task: "Unit tests for the eligibility matrix in apps/api/tests/unit/users/role_change/change_role.spec.ts"
Task: "Integration success-path test in apps/api/tests/integration/users/role_change/change_role.spec.ts"
Task: "Workbench change flow in apps/web/src/features/users/__tests__/role-change/change.test.tsx"

# Once the API chain reaches the registry, the two web foundations, together:
Task: "Add the mode search parameter in apps/web/src/routes/_authenticated/users.tsx"
Task: "Create the changeRole mutation in apps/web/src/features/users/mutations/use-user-mutations.ts"
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1 — Setup
2. Phase 2 — Foundational
3. Phase 3 — User Story 1
4. **STOP and VALIDATE**: an organization admin changes an eligible user's role end to end

Do not demo the MVP to anyone who can reach production data: at that checkpoint the endpoint
authorizes the viewer but does not yet refuse a deactivated target exhaustively, and the
self-role-change and last-admin guards are GH-29's and absent throughout.

### Incremental delivery

US1 → US2 → US3 close the P1 set and make the slice reviewable. US4 adds the proof that the change
reaches the user it describes; US5 adds recovery. Each phase leaves the branch green.

### Before the PR is ready

GH-29 must land before this action is exposed to production users — an organization admin can
otherwise demote themselves or the last remaining organization admin and lock the organization out of
user administration. Carry that into the PR description; it is recorded in the spec's Out of Scope,
the plan's Constitution Check, and [quickstart.md](./quickstart.md).

---

## Notes

- `[P]` means a different file and no dependency on an incomplete task
- `[Story]` maps a task to the user story it serves, for traceability back to the spec's FRs
- Commit after each task or logical group, using Conventional Commits
- Verify tests fail before implementing
- No task in this list changes the database schema; if one appears to need to, the spec's FR-016 is
  being reopened and that is a spec change, not an implementation detail
