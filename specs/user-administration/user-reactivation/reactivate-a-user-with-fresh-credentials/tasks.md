---

description: "Task list for Reactivate a User with Fresh Credentials"
---

# Tasks: Reactivate a User with Fresh Credentials

**Input**: Design documents from
`/specs/user-administration/user-reactivation/reactivate-a-user-with-fresh-credentials/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV makes RED → GREEN → REFACTOR binding, and
[D14](./research.md#d14--verification-seams) fixes the seams:

- Japa `unit` tests run the use case and the repository against real in-memory SQLite (API
  ADR-0014), with no fakes. They follow `tests/unit/users/deactivation/`.
- Japa `integration` tests cover the HTTP matrix, validation, payload, concurrency, and the session
  rule.
- Vitest feature tests render the real router with MSW for the workbench.

`apps/web/e2e` doesn't exist, so the browser journey is manual ([quickstart.md](./quickstart.md)).

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and
demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task serves (US1–US6)
- Exact file paths are given in every description

## Path Conventions

Web application monorepo: `apps/api/` (AdonisJS 7) and `apps/web/` (TanStack Start), per plan.md's
Structure Decision. The API slice mirrors `apps/api/app/users/deactivate/`. The web action enters
through the existing `UserAccessAction` machinery in `apps/web/src/features/users/`.

## Three ordering rules that are not negotiable

1. **The authorization boundary is foundational, not a story.** `UserPolicy.reactivate` lands in
   Phase 2, and the controller calls it the moment the endpoint exists (T023). No checkpoint exposes
   a reactivation an unauthorized caller can reach.
2. **The session marker is foundational, not User Story 4.** A checkpoint where users can be
   reactivated but a pre-deactivation session revives with them is not a safe increment. It hands the
   choice of the new password to whoever holds that browser ([D5](./research.md#d5--a-session-opened-before-the-latest-reactivation-grants-nothing)).
   Phase 2 therefore implements the marker and proves it against users whose `reactivated_at` is set
   by the factory. US4 proves it end to end through the real command and records the ADR.
3. **Status, event, requirement, and token revocation land together, in Phase 2's repository
   write.** FR-009 makes them one inseparable change. No task writes one without the others.

As the deactivation did, US1's use case resolves every non-`REACTIVATED` outcome to
`UserNotFoundException` until US2 lands. That is uninformative but always safe. US2's story is
precisely that the administrator is *told which reason applied*.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the ground this write stands on and create the module directories

- [X] T001 Confirm no migration is required: check `access_status`, `reactivated_at`, `reactivated_by_user_id`, and `password_renewal_required_at` in `apps/api/database/schema.ts`, and check the `reactivatedBy` relation in `apps/api/app/models/user.ts` and its preload in `preloadAccessHistory` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`, against the field table in [data-model.md](./data-model.md)
- [X] T002 [P] Create the API slice and test directories `apps/api/app/users/reactivate/`, `apps/api/tests/unit/users/reactivation/`, and `apps/api/tests/integration/users/reactivation/`
- [X] T003 [P] Create the web test directory `apps/web/src/features/users/__tests__/reactivate/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The refusal vocabulary, the authorization boundary, the guarded write with everything
FR-009 bundles into it, the parameter validation, and the session marker. No endpoint and no button
is exposed by this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for the foundation ⚠️

> Write these first and confirm they FAIL before implementing

- [X] T004 [P] Integration test in `apps/api/tests/integration/auth/session_reactivation.spec.ts` (the D5 rule in isolation, users created by `UserFactory` with `reactivatedAt` merged in):
  - a never-reactivated active user's `loginAs` session still answers `200` on `GET /api/v1/auth/me` (regression);
  - a user whose `reactivatedAt` is set, presenting a `loginAs` session with no marker, gets `401 E_UNAUTHORIZED_ACCESS`, and a second request on the same session is also `401`, because the session was forgotten;
  - a session primed with `.withSession({ auth_web: user.id, user_reactivated_at: <a different epoch ms> })` gets `401`;
  - the same user signing in through `POST /api/v1/auth/login` and replaying `.withSession(response.session())` gets `200`;
  - that user signing in with `rememberMe: true`, then replaying only `.encryptedCookie('remember_web', …)` (the restoration pattern of `tests/integration/auth/password_renewal.spec.ts`), gets `200` and keeps getting `200` on the restored session.
- [X] T005 [P] Unit test in `apps/api/tests/unit/users/reactivation/guarded_write.spec.ts` against the real `LucidUserRepository`. `reactivateDeactivated()` on a `DEACTIVATED` user returns `REACTIVATED` and sets `access_status` `ACTIVE`, `reactivated_at`, `reactivated_by_user_id`, and `password_renewal_required_at`. It deletes that user's `remember_me_tokens` rows and leaves another user's in place. It leaves `password`, `role`, `email`, `first_name`, `last_name`, `deactivated_at`, `deactivated_by_user_id`, `password_reset_at`, and `password_reset_by_user_id` unchanged, and returns the user with `reactivatedBy` and `deactivatedBy` preloaded (FR-009–FR-012, FR-014, D3, D4). Compare timestamps at second precision, as `tests/unit/users/deactivation/deactivate.spec.ts` does.

### Implementation for the foundation

- [X] T006 [P] Add `UserAlreadyActiveException` (409, `E_USER_ALREADY_ACTIVE`, message `User is already active`) to `apps/api/app/users/shared/user_exceptions.ts`, with a comment explaining why it is not `UserAlreadyActivatedException` ([D2](./research.md#d2--the-http-shape-of-each-outcome))
- [X] T007 [P] Add `reactivate(user)` to `apps/api/app/users/shared/user_policy.ts`. It grants only a viewer whose `accessStatus` is `ACTIVE` and whose role is `ORGANIZATION_ADMIN`. Add a comment saying which user may be reactivated is decided by the guarded write behind `ReactivateUserUseCase`, and that no self rule is needed because a viewer is never deactivated ([D1](./research.md#d1--where-each-refusal-is-decided))
- [X] T008 [P] Add the `ReactivateUserCommand` type (`id`, `reactivatedByUserId`, `reactivatedAt`) to `apps/api/app/users/shared/repositories/user_repository.ts`. Add the `ReactivateUserResult` union (`REACTIVATED` with the user, `NOT_FOUND`, `NOT_DEACTIVATED` with the observed `accessStatus`) and the documented `reactivateDeactivated(command)` abstract signature, per ADR-0013 naming
- [X] T009 Implement `reactivateDeactivated()` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`, as `deactivateActive()` with the guard reversed. It runs in one `User.transaction`:
  - the conditional `UPDATE … WHERE id = ? AND access_status = 'DEACTIVATED'` writes `accessStatus: 'ACTIVE'`, and writes `reactivatedAt`, `passwordRenewalRequiredAt`, and `updatedAt` all as `command.reactivatedAt.toSQL({ includeOffset: false })`, plus `reactivatedByUserId`;
  - on zero affected rows, re-read the row to return `NOT_FOUND` or `NOT_DEACTIVATED` with its status;
  - on one affected row, call the existing `revokeEveryRememberedConnection(trx, id)` and reload through `preloadAccessHistory`.

  Its comment records D3 and D4, including why the token delete is kept although deactivation already revoked them (depends on T008)
- [X] T010 [P] Create `apps/api/app/users/reactivate/reactivate_user_validator.ts` exporting `reactivateUserValidator = vine.create({ params: vine.object({ id: vine.string().uuid() }) })`, with the comment `reset_user_password_validator.ts` carries ([D7](./research.md#d7--a-malformed-identifier-is-rejected-before-the-database-is-touched))
- [X] T011 [P] Create `apps/api/app/auth/shared/session_reactivation.ts` ([D5](./research.md#d5--a-session-opened-before-the-latest-reactivation-grants-nothing)). It exports:
  - `REACTIVATION_SESSION_KEY = 'user_reactivated_at'`;
  - `recordSessionReactivation(session, user)`, which puts `user.reactivatedAt?.toMillis() ?? null`;
  - `matchesSessionReactivation(session, user)`, which compares the stored value (a missing key reads as `null`) with the same expression.

  Its comment explains the rule, why equality on the stored value is exact, and why `loginAs` without the key models a stale session
- [X] T012 In `apps/api/app/auth/shared/open_session.ts`, after the existing `ACTIVE` check:
  - when the session was restored from a remembered connection on this request (`viaRemember`), call `recordSessionReactivation` with the re-read user;
  - then, if `matchesSessionReactivation` is false, `ctx.session.forget('auth_web')` and forget `REACTIVATION_SESSION_KEY`, and throw the same `E_UNAUTHORIZED_ACCESS('Invalid or expired user session', …)` the expiry path throws.

  Extend the function's doc comment with the third condition (depends on T011)
- [X] T013 [P] Call `recordSessionReactivation(session, user)` right after `auth.use('web').login(...)` in `apps/api/app/controllers/login_controller.ts` (depends on T011)
- [X] T014 [P] Call `recordSessionReactivation(session, user)` right after `auth.use('web').login(user)`, inside the existing `try`, in `apps/api/app/controllers/invitation_acceptance_controller.ts` (depends on T011)
- [X] T015 [P] Add `mockUsersWithReactivation(viewer?, users?)`, `mockReactivationLostRace(targetId, …)`, `mockReactivationRefused(code, message, status?)`, and `mockReactivationUnreachable()` to `apps/web/src/features/users/__tests__/support/test-helpers.ts`, mirroring their deactivation counterparts:
  - the success handler for `POST /api/v1/users/:id/reactivate` rewrites the entry to `accessStatus: 'ACTIVE'`, a `REACTIVATED_AT`, a `reactivatedBy` naming the viewer, and `passwordRenewalRequired: true`, and the next collection read serves it;
  - the lost race answers `409 E_USER_ALREADY_ACTIVE` and serves the user as active afterwards.

  Add `REACTIVATED_AT` beside `DEACTIVATED_AT` in `apps/web/src/features/users/__tests__/support/fixtures.ts`

**Checkpoint**: `pnpm --filter @portflow/api test --files="tests/integration/auth/**"` passes, the
existing suites unchanged and T004 green. A session no longer counts for a user reactivated after it
was opened. The guarded write, the policy, and the refusal vocabulary exist in code. Nothing is
reachable over HTTP or in the browser yet.

---

## Phase 3: User Story 1 - Restore a Deactivated User's Access Under a New Password (Priority: P1) 🎯 MVP

**Goal**: An organization admin reactivates a deactivated user from the workbench. The user signs in
with their pre-deactivation password, meets only the renewal step, and reaches the application once
they have chosen a new password.

**Independent Test**: Sign in as an organization admin and reactivate a deactivated user from their
access record. Check the acknowledgement, and that the user is in the active view. Then sign in as
that user with the old password, check that the renewal step is presented instead of the
application, renew, and check that the application is reachable in the same session.

### Tests for User Story 1 ⚠️

> Write these first and confirm they FAIL before implementing

- [X] T016 [P] [US1] Unit test in `apps/api/tests/unit/users/reactivation/reactivate.spec.ts` (structure of `tests/unit/users/deactivation/deactivate.spec.ts`: `app.container.make`, global transaction). `ReactivateUserUseCase` on a `DEACTIVATED` target returns the user `ACTIVE`, with the supplied timestamp in `reactivatedAt`, the acting admin in `reactivatedByUserId`, and `passwordRenewalRequiredAt` set. `deactivatedAt`, `deactivatedByUserId`, `email`, `role`, `firstName`, `lastName`, `activatedAt`, `invitedAt`, and `password` are unchanged (US1.1, US1.5, FR-009, FR-011, FR-012)
- [X] T017 [US1] Unit test in `apps/api/tests/unit/users/reactivation/reactivate.spec.ts`: a target that already owed a renewal from a reset keeps its `passwordResetAt` / `passwordResetByUserId` and still owes exactly one renewal after the reactivation (FR-010, edge case "already owed a password renewal") (same file as T016)
- [X] T018 [P] [US1] Integration test in `apps/api/tests/integration/users/reactivation/reactivate.spec.ts`: an organization admin reactivating a deactivated user gets `200` with the payload of [contracts/reactivate-user.md](./contracts/reactivate-user.md), with these fields:
  - `accessStatus: "ACTIVE"`;
  - `reactivatedAt` set, and `reactivatedBy` resolved to `{ id, firstName, lastName }`;
  - `deactivatedAt` / `deactivatedBy` as before;
  - `passwordRenewalRequired: true`;
  - no `password`, `passwordRenewalRequiredAt`, token, or link field anywhere (US1.1, US1.4, US1.6, FR-013).
- [X] T019 [P] [US1] Integration test in `apps/api/tests/integration/users/reactivation/sessions.spec.ts`: after a reactivation through `POST /api/v1/users/:id/reactivate`, the target signs in through `POST /api/v1/auth/login` with the password they held before the deactivation and gets a session. On it:
  - `GET /api/v1/auth/me` answers `passwordRenewalRequired: true`;
  - `GET /api/v1/customers` answers `403 E_PASSWORD_RENEWAL_REQUIRED`;
  - after a valid `POST /api/v1/auth/password-renewal` on the same session, `GET /api/v1/customers` answers `200` (US1.2, US1.3, D6).
- [X] T020 [P] [US1] Update the `DEACTIVATED` case of `apps/web/src/features/users/user-access.test.ts` from `[]` to `['reactivate']`, and add a case asserting an operations admin is still offered nothing on a deactivated user
- [X] T021 [P] [US1] Feature test in `apps/web/src/features/users/__tests__/reactivate/journey.test.tsx` using `mockUsersWithReactivation`. As an organization admin, open David Évrard's record from the `Deactivated` view, press `Reactivate`, and confirm `Reactivate user?`. Assert:
  - the toast `User “David Évrard” reactivated`;
  - the record closes;
  - `Deactivated` drops by one and `Active` rises by one, with no reload (US1.1, FR-022).

### Implementation for User Story 1

- [X] T022 [US1] Create `apps/api/app/users/reactivate/reactivate_user_use_case.ts` with `ReactivateUserInput` (`id`, `reactivatedByUserId`, `reactivatedAt`). It calls `reactivateDeactivated()` and returns the user on `REACTIVATED`; every other outcome throws `UserNotFoundException` for now (US2 replaces that). Its doc comment states that no credential is generated or handed over (CLR-001, FR-012) (depends on T009)
- [X] T023 [US1] Add `reactivate()` to `apps/api/app/controllers/users_controller.ts`:
  - `bouncer.with(UserPolicy).authorize('reactivate')` **first**;
  - then `request.validateUsing(reactivateUserValidator, { data: { params } })`;
  - then the use case with the authenticated user's id and `DateTime.now()`;
  - serialize through `UserTransformer.transform(user, { includeAccessHistory: true }).useVariant('toAdministration')`.

  Its doc comment cites `deactivate`'s reasoning for the order ([D8](./research.md#d8--what-the-endpoint-returns)) (depends on T007, T010, T022)
- [X] T024 [US1] Register `router.post('/:id/reactivate', [controllers.Users, 'reactivate']).as('reactivate')` beside `deactivate` inside the `/users` group of `apps/api/start/routes.ts`, under the `auth` and `passwordRenewalCompleted()` middleware. Then restart the API dev server (or run its codegen) so `apps/api/.adonisjs/` regenerates and `tuyauQuery.users.reactivate` exists (depends on T023)
- [X] T025 [P] [US1] Add `reactivate` to `apps/web/src/features/users/mutations/use-user-mutations.ts` from `tuyauQuery.users.reactivate.mutationOptions()`. It calls `refreshUsers()` on success **and** on error, with the comment `deactivate` carries, and is returned from the hook ([D10](./research.md#d10--the-web-mutation-and-what-it-invalidates)) (depends on T024)
- [X] T026 [P] [US1] Add `'reactivate'` to the `UserAccessAction` union in `apps/web/src/features/users/helpers/user-access-copy.ts` and fill every `Record<UserAccessAction, …>`:
  - label `Reactivate`, pending `Reactivating…`, dismiss `Cancel`, no comment;
  - subject `user`, participle `reactivated`, failure verb `reactivate`, title `Reactivate user?`;
  - a `describeUserAccessEffect` branch naming the user and stating that they can sign in again with the password they held before, and must choose a new password before using the application (FR-020);
  - an empty `reactivate: {}` entry in `USER_ACCESS_REFUSAL_REASONS` for now (US5 fills it).

  Update the module comment ([D9](./research.md#d9--the-web-action-joins-the-existing-access-actions))
- [X] T027 [US1] In `apps/web/src/features/users/user-access.tsx`:
  - make `userAccessActions` return `['reactivate']` for a `DEACTIVATED` user, and rewrite its doc comment's "a deactivated user is offered nothing";
  - add `reactivate: 'default'` to `USER_ACCESS_ACTION_VARIANTS`;
  - take `reactivate` from `useUserMutations()`, include it in the `isPending` lookup, and add the `reactivate.mutateAsync({ params: { id: user.id } })` branch to `request()` (depends on T025, T026)

**Checkpoint**: an organization admin can reactivate a deactivated user end to end. The user's
pre-deactivation sessions are dead (Phase 2), and a fresh sign-in leads to the renewal step and then
to the application. Every ineligible target is refused, uninformatively but safely.

---

## Phase 4: User Story 2 - Refuse to Reactivate an Ineligible User (Priority: P1)

**Goal**: Every ineligible target is refused with its own reason, pointing to what to do instead, and
leaves every user unchanged.

**Independent Test**: Attempt to reactivate a pending user, a cancelled user, an active user, the
acting administrator's own access, an unknown identifier, and a malformed one. Check that each is
refused with its own reason and that nothing changes.

### Tests for User Story 2 ⚠️

> Write these first and confirm they FAIL before implementing

- [X] T028 [P] [US2] Unit tests in `apps/api/tests/unit/users/reactivation/reactivate.spec.ts`:
  - a `PENDING` target throws `UserPendingInvitationException` whose message names activation link renewal;
  - a `CANCELLED` target throws `UserCancelledInvitationException` whose message names invitation restoration;
  - an `ACTIVE` target, including the acting administrator's own id, throws `UserAlreadyActiveException`;
  - an unknown id throws `UserNotFoundException`.

  Each case asserts the row is unchanged (US2.1–US2.4, US2.6, FR-004–FR-007)
- [X] T029 [P] [US2] Unit tests in `apps/api/tests/unit/users/reactivation/guarded_write.spec.ts`: `reactivateDeactivated()` returns `NOT_DEACTIVATED` with the observed status on a pending, a cancelled, and an active user, and `NOT_FOUND` on an unknown id. In every one of those cases it writes no column and deletes no `remember_me_tokens` row (US2.7, FR-015)
- [X] T030 [P] [US2] Integration tests in `apps/api/tests/integration/users/reactivation/reactivate.spec.ts`, one case per refusal of [contracts/reactivate-user.md](./contracts/reactivate-user.md): `404 E_USER_NOT_FOUND`, `409 E_USER_PENDING_INVITATION`, `409 E_USER_CANCELLED_INVITATION`, `409 E_USER_ALREADY_ACTIVE` (an active user, and the admin's own id). Each asserts the target row is unchanged
- [X] T031 [US2] Integration test in `apps/api/tests/integration/users/reactivation/reactivate.spec.ts`: a malformed `:id` returns `422 E_VALIDATION_ERROR` with `details`, and no user is read (US2.5, FR-008) (same file as T030)

### Implementation for User Story 2

- [X] T032 [US2] Replace the catch-all in `apps/api/app/users/reactivate/reactivate_user_use_case.ts` with the outcome table of [data-model.md](./data-model.md). `NOT_DEACTIVATED` + `PENDING` throws `new UserPendingInvitationException('User has never activated their access; renew their activation link instead')`. `+ CANCELLED` throws `new UserCancelledInvitationException('User invitation was cancelled before activation; restore the invitation instead')`. `+ ACTIVE` throws `UserAlreadyActiveException`. `NOT_FOUND` stays on `UserNotFoundException`. A comment explains the throw-site messages (D2)

**Checkpoint**: every ineligible target is refused with a reason the administrator can act on, and no
refusal leaves a trace on any row

---

## Phase 5: User Story 3 - Refuse Reactivation to Anyone Not Entitled to It (Priority: P1)

**Goal**: Reactivation stays with the one role accountable for it, whether the request comes from
the interface or is sent directly, and the interface never offers what the API would refuse.

**Independent Test**: Attempt a reactivation as an unauthenticated visitor, an operations admin, an
operations lead, an observer, and an organization admin confined to their own renewal step. Check
that every attempt is refused with no user changed and the action never appears in their interface.

**Scope note**: the policy landed in Phase 2 and has been enforced since T023. This phase proves the
whole matrix and the interface's agreement with it.

### Tests for User Story 3 ⚠️

> Write these first and confirm they FAIL before implementing

- [X] T033 [P] [US3] Integration tests in `apps/api/tests/integration/users/reactivation/reactivate.spec.ts`:
  - no session returns `401 E_UNAUTHORIZED_ACCESS`;
  - a viewer whose access is not active returns `401`;
  - an organization admin whose own session owes a renewal (`UserFactory.apply('passwordRenewalRequired')`, role `ORGANIZATION_ADMIN`) returns `403 E_PASSWORD_RENEWAL_REQUIRED`;
  - `OPERATIONS_ADMIN`, `OPERATIONS_LEAD`, and `OBSERVER` each return `403 E_AUTHORIZATION_FAILURE`, and the body is identical for a known deactivated id, an unknown id, and a malformed id.

  In every case the target stays `DEACTIVATED` (US3.1–US3.4, FR-002)
- [X] T034 [P] [US3] Feature test in `apps/web/src/features/users/__tests__/reactivate/permissions.test.tsx`:
  - an organization admin is offered `Reactivate` on David Évrard's record;
  - an operations admin sees no `Reactivate` anywhere;
  - an organization admin sees none on an active, a pending, or a cancelled user's record (US3.5, US6.6, FR-019).

### Implementation for User Story 3

- [X] T035 [US3] Read `apps/api/app/controllers/users_controller.ts` and confirm `reactivate()` authorizes before it validates and before the use case, so a refusal is identical whatever the target. Confirm `userAccessActions` in `apps/web/src/features/users/user-access.tsx` returns nothing to any role but `ORGANIZATION_ADMIN`. Adjust only if T033 or T034 fail

**Checkpoint**: the authorization matrix is proven at the API, and the interface offers exactly what
it permits

---

## Phase 6: User Story 4 - Let Only a Fresh Sign-In Bring the User Back (Priority: P1)

**Goal**: No session or remembered connection from before the reactivation grants anything after it,
not even the renewal step. Access resumes only through a new sign-in with a password.

**Independent Test**: Before deactivating a user, open a session for them and a remembered
connection on another browser. Deactivate, then reactivate. Check that neither browser regains any
access, that a fresh sign-in reaches the renewal step, and that no other user is affected.

**Scope note**: the mechanism landed in Phase 2 (ordering rule 2) and the token revocation in T009.
This phase proves the story through the real commands, the deactivation then the reactivation, and
records the decision durably.

### Tests for User Story 4 ⚠️

> Write these first. They should pass on arrival if Phase 2 is right; a failure here is a gap in D5,
> not a missing feature.

- [X] T036 [P] [US4] Integration tests in `apps/api/tests/integration/users/reactivation/sessions.spec.ts`, each going through `POST /api/v1/users/:id/deactivate` then `POST /api/v1/users/:id/reactivate` as an organization admin:
  - a session the target opened through `POST /api/v1/auth/login` **before** the deactivation, replayed with `.withSession(…)` after the reactivation, gets `401` on `GET /api/v1/auth/me`, and again on the next request (US4.1);
  - a `remember_web` cookie obtained from a `rememberMe: true` login before the deactivation, replayed with `.encryptedCookie(…)` after the reactivation, restores no session (US4.2);
  - an unrelated active user's session and remembered connection, opened before, both still answer `200` afterwards (US4.4, SC-003).
- [X] T037 [US4] Integration test in `apps/api/tests/integration/users/reactivation/sessions.spec.ts`: a refused reactivation (target already active) leaves the target's session opened after its earlier reactivation working, and deletes none of its `remember_me_tokens` rows (US4.5, FR-015). Also: a user deactivated and reactivated twice has a session opened between the two cycles refused after the second (edge case "deactivated, reactivated, deactivated again, reactivated again") (same file as T036)

### Implementation for User Story 4

- [X] T038 [US4] Write `apps/api/docs/adr/0015-refuse-sessions-opened-before-a-reactivation.md` in the shape of `apps/api/docs/adr/0014-test-repositories-against-sqlite-instead-of-fakes.md`. It covers:
  - the problem: cookie-store sessions that can't be deleted, `clearWithBrowser` with no expiry, and the revival path;
  - the marker rule, and why equality on `reactivated_at` is exact;
  - where sessions are stamped;
  - the consequence for tests (`loginAs` models a stale session);
  - the dedicated counter column as the step to take if a second session-ending trigger ever appears.

  Add one sentence to the Consequences of `apps/api/docs/adr/0001-session-cookie-authentication.md` pointing to ADR-0015 ([D5](./research.md#d5--a-session-opened-before-the-latest-reactivation-grants-nothing))

**Checkpoint**: the reactivation reopens nothing the deactivation closed, proven through the real
commands, and the decision has its durable home

---

## Phase 7: User Story 5 - Understand and Recover From a Refused Reactivation (Priority: P2)

**Goal**: A refused or failed reactivation is never read as a success, each reason reads distinctly
in the workbench, and a retry records exactly one reactivation.

**Independent Test**: Reactivate a user someone else has just reactivated, during a transient
failure, and twice in quick succession. Check that each produces distinct feedback, that nothing
changes on a refusal, and that exactly one reactivation is ever recorded.

### Tests for User Story 5 ⚠️

> Write these first and confirm they FAIL before implementing

- [X] T039 [P] [US5] Integration test in `apps/api/tests/integration/users/reactivation/reactivate.spec.ts`: reactivating the same deactivated user twice returns `200`, then `409 E_USER_ALREADY_ACTIVE`, with the first call's `reactivatedAt` and `reactivatedByUserId` intact after the second (made by a second organization admin), and `passwordRenewalRequiredAt` still set (US5.1, US5.2, US5.4, FR-016)
- [X] T040 [P] [US5] Feature test in `apps/web/src/features/users/__tests__/reactivate/refusals.test.tsx`:
  - one case per `error.code` (`E_USER_ALREADY_ACTIVE`, `E_USER_PENDING_INVITATION`, `E_USER_CANCELLED_INVITATION`, `E_USER_NOT_FOUND`) via `mockReactivationRefused`, asserting the refusal toast title `Unable to reactivate user “David Évrard”` and that reason's own sentence;
  - with `mockReactivationLostRace`: the user moves to `Active`, the record closes, the toast explains;
  - the collection is refetched on a refusal (FR-017, US5.1, US5.5).
- [X] T041 [P] [US5] Feature test in `apps/web/src/features/users/__tests__/reactivate/recovery.test.tsx`: with `mockReactivationUnreachable`, the retryable failure sentence from `parseApiError` appears and nothing changes. After switching to `mockUsersWithReactivation` and retrying, the user is reactivated exactly once (US5.3, FR-015)

### Implementation for User Story 5

- [X] T042 [US5] Fill `USER_ACCESS_REFUSAL_REASONS.reactivate` in `apps/web/src/features/users/helpers/user-access-copy.ts` with second-person sentences:
  - `E_USER_ALREADY_ACTIVE`: this user is already active; someone else may have reactivated them;
  - `E_USER_PENDING_INVITATION`: this user has never activated their access; renew their activation link instead;
  - `E_USER_CANCELLED_INVITATION`: this user's invitation was withdrawn before they activated it; restore it instead;
  - `E_USER_NOT_FOUND`: this user no longer exists.

  See [contracts/user-reactivation-action.md](./contracts/user-reactivation-action.md)

**Checkpoint**: every refusal and failure is reported distinctly, and a retry never double-records

---

## Phase 8: User Story 6 - Act on the Reactivation From the User Workbench (Priority: P2)

**Goal**: The reactivation is usable from wherever the administrator is consulting the user,
confirmed deliberately, and its consequence is visible without a reload.

**Independent Test**: From a deactivated user's record and from their row menu, invoke the
reactivation. Check that the confirmation names the user and states the consequence. Cancel once
(nothing recorded), then confirm, and check that the active view shows the outstanding renewal and
the record's history shows the reactivation.

**Scope note**: the row menu and the record footer already follow `userAccessActions` (T027), so
this phase is mostly proof. Its implementation is limited to the comments that described the
workbench before reactivation existed.

### Tests for User Story 6 ⚠️

> Write these first and confirm they FAIL before implementing

- [X] T043 [P] [US6] Feature tests in `apps/web/src/features/users/__tests__/reactivate/journey.test.tsx`:
  - the confirmation names David Évrard, states he can sign in again and must choose a new password, and has no textbox (US6.3, FR-020);
  - `Cancel` records nothing and the record still offers `Reactivate` (US6.4);
  - while the request is in flight the confirm button reads `Reactivating…` and is disabled, so a second click sends nothing (US6.7, FR-021);
  - after a success, the `Active` view's Password column reads `Renewal required` for him (US6.8, FR-022);
  - reopened from `Active`, his access history lists `Deactivated` then `Reactivated`, with `by` names (US1.4, FR-023).

  Same file as T021
- [X] T044 [P] [US6] Feature test in `apps/web/src/features/users/__tests__/reactivate/row-menu.test.tsx`:
  - David Évrard's row menu in the `Deactivated` view ends with `Reactivate`, not styled destructive;
  - reactivating from it, without opening the record, shows the same confirmation and toast, and moves the row to `Active` (US6.2, FR-019);
  - pending, cancelled, and active rows offer no `Reactivate` (US6.6).

### Implementation for User Story 6

- [X] T045 [P] [US6] Update the doc comment of `UserAccessRecord` in `apps/web/src/features/users/ui/user-access-record.tsx`: reactivation is now among the access actions, and no longer "owned by its own slice and not offered here"
- [X] T046 [P] [US6] Update the doc comment of `UserRowActions` in `apps/web/src/features/users/ui/user-row-actions.tsx` to list reactivation among the access actions the menu offers

**Checkpoint**: all six stories are independently demonstrable, and the workbench presents the
reactivation from the record and the row alike

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T047 [P] Run the API checks, the stale-session proof, and the browser journeys of [quickstart.md](./quickstart.md), resetting with `pnpm --filter @portflow/api db:fresh` — run against a throwaway PostgreSQL 17 container: the curl round trip (stale pre-deactivation session 401 after the reactivation, fresh sign-in confined 403, renewal then 200, E_USER_ALREADY_ACTIVE, E_VALIDATION_ERROR, E_USER_NOT_FOUND) and the browser journey (record footer and row menu, confirmation wording, counts, Renewal required, history order, retryable failure leaving the user unchanged)
- [X] T048 [P] Re-read [spec.md](./spec.md) FR-001–FR-026 and SC-001–SC-011 against the diff, and confirm each maps to a passing test or a reviewed behaviour. Pay particular attention to FR-011's preserved columns, FR-013's no-disclosure rule, and FR-024's "unchanged for everyone never reactivated" — every FR and SC maps to a passing test or a verified behaviour; SC-010 is three interactions from the row menu
- [X] T049 [P] Set the `GH-32` row's status to `implemented` in `specs/user-administration/user-reactivation/roadmap.md`, and update the sentence below the table to say where it is implemented, pending review and merge, as `specs/user-administration/password-reset/roadmap.md` does for `GH-17`
- [X] T050 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the repository root and resolve every finding, including the unchanged `apps/api/tests/integration/auth/**` suites as the D5 regression guard — `pnpm check` and `pnpm typecheck` clean; API 1355/1355; web users feature 309/310, the one failure being the pre-existing `scale.perf.test.tsx` wall-clock budget (4.9 s against 2 s at a load average of ~140 on 10 cores). The full web suite on this machine timed out in 19–34 files of untouched features (trucks, transport companies, checkpoints, warehouses, customers), varying between runs — to be confirmed on an idle machine or CI
- [ ] T051 Obtain a fresh read-only review of the final diff and resolve or explicitly justify every confirmed finding, per Constitution Principle VII

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependency; starts immediately
- **Foundational (Phase 2)**: depends on Setup and **blocks every user story**
- **US1 (Phase 3)**: depends on Phase 2. It delivers the endpoint and the web action, so it blocks
  every other story
- **US2 (Phase 4)**, **US3 (Phase 5)**, **US4 (Phase 6)**: each depends only on Phase 3, and they
  are independent of one another
- **US5 (Phase 7)**: depends on Phase 3. Its API test (T039) is independent of US2, but its web
  refusal sentences read best after T032 gives each refusal its own code on the wire
- **US6 (Phase 8)**: depends on Phase 3 only
- **Polish (Phase 9)**: depends on every story being complete

### User Story Dependencies

The six stories share one endpoint and one dialog, so they are independently **testable and
demonstrable** but not independently orderable: US1 must exist before the others have anything to act
through. After US1 they separate cleanly:

- US2 touches the use case's outcome mapping;
- US3 is proof over the policy and the interface gate;
- US4 is proof over the session rule, plus the ADR;
- US5 touches the refusal copy;
- US6 is proof over the workbench, plus two comments.

The only files two of them share are `reactivate.spec.ts` (US2, US3, and US5 tests: sequence T030,
T031, T033, and T039 within it) and `journey.test.tsx` (T021, then T043).

### Within Each Phase

- Tests are written and confirmed failing before the implementation they cover (US4 excepted, as
  noted)
- In Phase 2: T008 → T009; T011 → T012, T013, T014
- In US1: repository (Phase 2) → use case (T022) → controller (T023) → route and registry (T024) →
  anything in `apps/web` that calls `tuyauQuery.users.reactivate` (T025, T027)
- The mutation (T025) and the copy (T026) come before the dialog wiring (T027)

### Parallel Opportunities

- T002, T003 (Setup)
- T004, T005, T006, T007, T008, T010, T011, T015 (Foundational): eight different files. T009 waits
  on T008, and T012–T014 wait on T011
- T016, T018, T019, T020, T021 (US1 tests): five different files. T017 follows T016 in the same file
- T025, T026 (US1 web building blocks)
- T028, T029, T030 (US2 tests); T031 follows T030
- T033, T034 (US3 tests)
- T036 (US4); T037 follows it; T038 is independent of both
- T039, T040, T041 (US5 tests)
- T043, T044, T045, T046 (US6)
- T047, T048, T049 (Polish)

---

## Parallel Example: Phase 2 and User Story 1

```bash
# Foundational: launch the independent building blocks together
Task: "Session marker integration tests in apps/api/tests/integration/auth/session_reactivation.spec.ts"
Task: "Guarded write unit test in apps/api/tests/unit/users/reactivation/guarded_write.spec.ts"
Task: "UserAlreadyActiveException in apps/api/app/users/shared/user_exceptions.ts"
Task: "UserPolicy.reactivate in apps/api/app/users/shared/user_policy.ts"
Task: "Session marker module in apps/api/app/auth/shared/session_reactivation.ts"
Task: "Web MSW helpers in apps/web/src/features/users/__tests__/support/test-helpers.ts"

# US1: launch the independent tests together
Task: "Use case unit test in apps/api/tests/unit/users/reactivation/reactivate.spec.ts"
Task: "200 payload integration test in apps/api/tests/integration/users/reactivation/reactivate.spec.ts"
Task: "Fresh sign-in journey in apps/api/tests/integration/users/reactivation/sessions.spec.ts"
Task: "Workbench journey in apps/web/src/features/users/__tests__/reactivate/journey.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup
2. Phase 2: Foundational. **This blocks everything**, including the session marker
3. Phase 3: User Story 1
4. **STOP and VALIDATE**: reactivate a user from the workbench. Confirm that their old session stays
   dead, that a fresh sign-in with the old password lands on the renewal step, and that renewing
   opens the application
5. Demonstrable as it stands: the refusals are safe, just not specific yet

### Incremental Delivery

1. Setup + Foundational: the guarded write, the policy, and the session marker exist
2. US1: the reactivation works end to end and cannot revive an old session (**MVP**)
3. US2: each refusal gains its actionable reason
4. US3 + US4: the authorization matrix and the session story are proven through the real commands;
   ADR-0015 is written
5. US5 + US6: the workbench reports every outcome distinctly and presents the action everywhere
6. Polish: quickstart, roadmap status, full verification, fresh review

### Parallel Team Strategy

After Phase 3, up to four developers can split the work: US2 (use case mapping), US3 + US4 (API
proof and the ADR), US5 (refusal copy and web refusal tests), and US6 (web workbench proof). They
meet only in `reactivate.spec.ts` (sequence T030 → T031 → T033 → T039) and in `journey.test.tsx`
(T021 → T043).

---

## Notes

- `[P]` means a different file and no dependency on an incomplete task
- Verify each test fails before writing the code that makes it pass, except US4, whose tests prove
  the Phase 2 mechanism through the real commands
- Commit after each task or logical group, with Conventional Commits per `AGENTS.md`
- No migration: every column this feature writes already exists (T001)
- A test that signs in a user whose `reactivated_at` is set must open the session through
  `POST /api/v1/auth/login` or prime the marker. A bare `loginAs` is the stale session D5 refuses
  (T004)
- Button labels carry the action alone, `Reactivate` and not `Reactivate user`. Only the dialog
  title names the resource, following `user-access-copy.ts`
