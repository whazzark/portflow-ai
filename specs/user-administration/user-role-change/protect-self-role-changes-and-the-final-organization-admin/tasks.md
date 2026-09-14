---

description: "Task list for Protect Self-Role Changes and the Final Organization Admin"
---

# Tasks: Protect Self-Role Changes and the Final Organization Admin

**Input**: Design documents from
`/specs/user-administration/user-role-change/protect-self-role-changes-and-the-final-organization-admin/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution principle IV makes RED → GREEN → REFACTOR binding, and research D9
fixes the seams:

- Japa unit tests for the self check and the decision table;
- Japa integration tests for the refusal matrix and for a 50-round collision, run without a global
  transaction;
- Vitest feature tests rendering the real router with MSW for the workbench;
- a by-hand PostgreSQL run for the lock itself, because CI has no PostgreSQL service.

`apps/web/e2e` does not exist, so this slice adds no end-to-end journey.

**Organization**: Tasks are grouped by user story, so each story can be implemented, tested, and
demonstrated on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task serves (US1–US3)
- Exact file paths are given in every description

## Path Conventions

The monorepo holds a web application: `apps/api/` (AdonisJS 7) and `apps/web/` (TanStack Start), per
plan.md's Structure Decision. Every API file touched already exists from GH-28 except two new test
files and one test support module. On the web, the users feature is touched only in its mutation
module, and the one edit outside it is `components/layout/authenticated-layout.tsx`.

**No migration.** Any task that appears to need a schema change is out of scope (data-model.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Start from a green baseline, and give the tests one way to isolate the organization's
admin population in the shared in-memory database.

- [X] T001 Run the baseline and confirm it is green before any change: `pnpm --filter api test --files "tests/unit/users/role_change/*" --files "tests/integration/users/role_change/*"` and `pnpm --filter web test src/features/users/__tests__/role-change src/features/users/__tests__/identity src/components/layout/__tests__/authenticated-layout`
- [X] T002 [P] Create `apps/api/tests/support/organization_admins.ts`, exporting `hideActiveOrganizationAdmins(): Promise<() => Promise<void>>`. It reads the ids of every user who is currently `ACTIVE` with role `ORGANIZATION_ADMIN`, sets their role to `OPERATIONS_ADMIN` in one query-builder `update`, and returns a `restore` function that sets exactly those ids back to `ORGANIZATION_ADMIN`. Its doc comment must say why it exists: the suites share one in-memory database and do not reset it between files, the final admin rule counts the whole population, and a stray admin left by another file would silently make every "last admin" test pass for the wrong reason. It changes the role rather than the access status because `role` carries no lifecycle columns to keep consistent
- [X] T003 [P] Move the `untouchedFields` snapshot from `apps/api/tests/unit/users/role_change/change_role.spec.ts` into `apps/api/tests/support/user_snapshots.ts`, exported unchanged with its FR comment, and import it back into `change_role.spec.ts`, so the new unit file can reuse it (research D9, FR-009)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None. Each story brings its own exception and its own change to the use case, so no
shared code has to exist before them. The two P1 stories edit the same use case and exceptions
files, and are therefore ordered, not parallel (see Dependencies).

**Checkpoint**: Phase 1 complete — user story work can begin.

---

## Phase 3: User Story 1 — Refuse an Organization Admin Changing Their Own Role (Priority: P1) 🎯 MVP

**Goal**: The API refuses a role change naming the requester, whatever role is submitted and however
the identifier is cased. The workbench keeps offering no role control on the viewer's own record.

**Independent Test**: As an organization admin, `PATCH` your own id with each of the four roles, and
with the id upper-cased. Every call answers `409 E_USER_SELF_ROLE_CHANGE`, and your row is unchanged.
A non-admin naming themselves gets GH-28's 403. `/users?userId=<own id>&mode=edit` renders no `Role`
control.

### Tests for User Story 1 ⚠️

> Write these first and watch the API ones fail. The web one guards existing behavior and is expected
> to pass immediately.

- [X] T004 [P] [US1] In `apps/api/tests/unit/users/role_change/change_role.spec.ts`:
  - Declare a `REQUESTER_ID` constant, a valid v4 UUID naming no user, and pass it as `requestedByUserId` in every existing `handle` call. They fail to typecheck until T008 lands; that is the intended first RED.
  - Add "refuses an administrator changing their own role, whatever the role". An active organization admin names themselves with each of the four roles, including `ORGANIZATION_ADMIN`. Each call rejects with `SelfRoleChangeException`, and the row matches `untouchedFields` plus `role` from before.
  - Add "refuses a self-role change whose identifier is upper-cased". `userId` is the admin's id upper-cased and `requestedByUserId` is the stored one.
  - Add "refuses a self-role change before reading anything". `userId` and `requestedByUserId` are the same UUID naming no user, and the rejection is `SelfRoleChangeException`, not `UserNotFoundException`.
- [X] T005 [P] [US1] In `apps/api/tests/integration/users/role_change/change_role.spec.ts`:
  - Add "refuses an organization admin changing their own role". The admin `PATCH`es `/api/v1/users/<own id>/role` with each of the four roles and gets `409`, `error.code === 'E_USER_SELF_ROLE_CHANGE'`, and the exact message `Your own role can only be changed by another organization admin`. Their stored role and access status are unchanged afterwards.
  - Add "refuses a self-role change named in upper case": the same call with `id.toUpperCase()`.
  - Add "denies a non-admin naming themselves exactly as naming anyone": an operations admin, an operations lead, and an observer each `PATCH` their own id. Each gets a `403` whose body is identical to the one they get for another user's id (FR-011).
- [X] T006 [P] [US1] In `apps/web/src/features/users/__tests__/role-change/permissions.test.tsx`, add "offers no role control on the viewer's own record, even when the mode is typed by hand". Mock the collection with the viewer's own record, as `identity/permissions.test.tsx` does with `VIEWERS_OWN_RECORD`, and render `/users?userId=${ORGANIZATION_ADMIN.id}&mode=edit`. The record dialog opens, and `queryByRole('combobox', { name: 'Role' })` is absent (FR-010)

### Implementation for User Story 1

- [X] T007 [US1] Add `SelfRoleChangeException` to `apps/api/app/users/shared/user_exceptions.ts`: `status = 409`, `code = 'E_USER_SELF_ROLE_CHANGE'`, `message = 'Your own role can only be changed by another organization admin'`. Its doc comment must say why it is a 409 and not a 403, pointing to `SelfDeactivationException`'s reasoning, and that it is decided whatever role is submitted (research D1)
- [X] T008 [US1] In `apps/api/app/users/role_change/change_user_role_use_case.ts`:
  - Add `requestedByUserId: string` to `ChangeUserRoleInput`, documented as "the organization admin asking — the session's user, never the target".
  - At the top of `handle`, before the repository is called, throw `SelfRoleChangeException` when `input.userId.toLowerCase() === input.requestedByUserId.toLowerCase()`. The comment must carry the case-sensitivity reason `DeactivateUserUseCase` records: PostgreSQL matches an upper-cased UUID against the stored row.
  - Update the class doc comment so it says the use case now owns the self rule outright (depends on T007)
- [X] T009 [US1] In `apps/api/app/controllers/users_controller.ts`, `changeRole` destructures `auth` too, and passes `requestedByUserId: auth.getUserOrFail().id` to the use case. Authorization and then validation keep their current order, so FR-011 holds with no new code. Update the method's doc comment to mention the self refusal (depends on T008)
- [X] T010 [US1] Run the US1 tests and every GH-28 role-change test, and confirm both green: `pnpm --filter api test --files "tests/unit/users/role_change/*" --files "tests/integration/users/role_change/*"` and `pnpm --filter web test src/features/users/__tests__/role-change`

**Checkpoint**: Self-role changes are refused at the API. This is the MVP: no single request can demote
the last admin any more, because the requester always remains one.

---

## Phase 4: User Story 2 — Keep an Active Organization Admin Through Concurrent Changes (Priority: P1)

**Goal**: No role change, whether alone or colliding with others, leaves the organization without an
active organization admin. The decision is taken under locks when the change is applied.

**Independent Test**: The unit decision table ([data-model.md](./data-model.md)) passes row by row.
Fifty rounds of two admins demoting each other end every time with one `200` and one refusal, and
with exactly one active organization admin left. The same group passes against a scratch PostgreSQL
database ([quickstart.md](./quickstart.md#proving-the-lock-on-postgresql)).

### Tests for User Story 2 ⚠️

- [X] T011 [P] [US2] Create `apps/api/tests/unit/users/role_change/final_admin.spec.ts`. It holds one group named `ChangeUserRoleUseCase — final organization admin`, with `group.each.setup(() => testUtils.db().wrapInGlobalTransaction())`. Every test first calls `hideActiveOrganizationAdmins()` (T002) and creates its own users with `UserFactory`. `requestedByUserId` is a constant UUID naming no user, which is how the unit simulates a requester who already lost the role while their request was in flight. Tests, in the README's narrative order:
  - "demotes an organization admin while another remains active": two active admins; demote one to `OBSERVER` → succeeds.
  - "refuses demoting the only active organization admin": one active admin; each of `OPERATIONS_ADMIN`, `OPERATIONS_LEAD`, and `OBSERVER` rejects with `LastActiveOrganizationAdminException`. Assert `status === 409`, `code === 'E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN'`, and that the message is exactly `The organization must keep at least one active organization admin` (FR-007: no name, no count).
  - "no longer counts an admin deactivated before the change is applied": two admins; set the second's `accessStatus` to `DEACTIVATED` and save; demoting the first is refused (US2 scenario 2, FR-005).
  - "no longer counts an admin demoted before the change is applied": the same, with the second's role set to `OPERATIONS_ADMIN`.
  - "does not count pending or cancelled organization admins": one active admin plus an `invited` and a `cancelled` admin; demoting the active one is refused.
  - "always lets a pending or cancelled organization admin be demoted": with one active admin present, demoting the `invited` and the `cancelled` admins succeeds (US2 scenario 6).
  - "never refuses assigning the organization admin role": with one active admin, promoting an active `OBSERVER` succeeds, and submitting `ORGANIZATION_ADMIN` for that admin succeeds with the row unchanged (US2 scenario 7).
  - "lets three admins lose two, never three": A, B, and C are active admins; demoting B, then C, succeeds; demoting A is refused (US2 scenario 3).
  - "leaves every user untouched on a refusal": `untouchedFields` (T003) plus `role` of the target, and of the second admin deactivated beforehand, are identical before and after (FR-009).
- [X] T012 [P] [US2] Create `apps/api/tests/integration/users/role_change/final_admin.spec.ts` with two groups:
  - Group `PATCH /api/v1/users/:id/role — final organization admin`, under `wrapInGlobalTransaction` and `hideActiveOrganizationAdmins()`, with "still demotes an organization admin while the requester remains one": admin A demotes admin B → `200` and B's role is `OPERATIONS_ADMIN`. This is FR-008 over HTTP; a sequential request can never meet the refusal, because the requester counts.
  - Group `PATCH /api/v1/users/:id/role — concurrent demotions`, deliberately **without** `wrapInGlobalTransaction`. On PostgreSQL, a global transaction would put both requests on one connection and no lock could contend (research D9). Its `group.each.setup` returns the `restore` function from `hideActiveOrganizationAdmins()` as its cleanup.
  - In that group, one test, "keeps exactly one active organization admin when two admins demote each other", with `.timeout(60_000)`. It runs 50 rounds. Each round creates two active admins A and B and sends, with `Promise.all`, A demoting B and B demoting A, both to `OPERATIONS_ADMIN`.
  - Each round asserts exactly one `200`. The other response is either `409` with `error.code === 'E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN'` and the exact message, or `403` (its authorization ran after the winner committed). Exactly one of A and B is still an active organization admin, and so is exactly one user in the whole table.
  - The round then demotes the survivor directly, so the next round starts from none (SC-002).
  - Add a comment explaining that under SQLite this proves the serialized outcome only, and that the lock is proven by the quickstart's PostgreSQL run.

### Implementation for User Story 2

- [X] T013 [US2] Add `LastActiveOrganizationAdminException` to `apps/api/app/users/shared/user_exceptions.ts`: `status = 409`, `code = 'E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN'`, `message = 'The organization must keep at least one active organization admin'`. Its doc comment must say that it is worded about the rule, not about role changes, so GH-21 can throw it from deactivation unchanged, and that it never names or counts the remaining admins (FR-007, research D6, D7) (after T007 — same file)
- [X] T014 [US2] In `apps/api/app/users/shared/repositories/user_repository.ts`, add `| { kind: 'LAST_ACTIVE_ORGANIZATION_ADMIN' }` to `ChangeUserRoleResult`, rewording its doc comment to "the four outcomes of the locked write". Rewrite the abstract `changeRole` doc. It must say the write runs in one transaction opened by a locking read of the target and every active organization admin, that it refuses a deactivated target and the demotion of the last active organization admin, and that submitting the held role is still `CHANGED` with an unchanged row
- [X] T015 [US2] In `apps/api/app/users/shared/repositories/lucid_user_repository.ts`, add the private method `lockTargetAndActiveOrganizationAdmins(trx: TransactionClientContract, id: string)`, returning `{ target: User | null; otherActiveOrganizationAdmins: User[] }`.
  - Build the query as `User.query({ client: trx }).where('id', id).orWhere((admins) => admins.where('role', 'ORGANIZATION_ADMIN').where('accessStatus', 'ACTIVE')).orderBy('id')`, call `query.knexQuery.forNoKeyUpdate()` on it, then await it. Lucid exposes only `forUpdate()` and `forShare()`, so the lock goes through `knexQuery`; knex 3 compiles it to nothing on SQLite.
  - Split the rows in TypeScript: the target is the row whose id matches `id`, and the others are the remaining rows that are `ACTIVE` organization admins.
  - Its doc comment must condense research D3–D5:
    - locks are taken in id order, so two role changes cannot deadlock;
    - PostgreSQL re-evaluates the `WHERE` of any row it waited for, so an admin demoted or deactivated in the meantime is not counted;
    - `FOR NO KEY UPDATE` rather than `FOR UPDATE`, so foreign-key checks from rows referencing an admin neither wait nor deadlock;
    - a promotion committed while waiting is not seen, and the rule errs towards refusing;
    - GH-21 must call this helper from `deactivateActive`, so that the two commands take the same locks in the same order (depends on T014)
- [X] T016 [US2] Rewrite `changeRole` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts` to run inside `User.transaction(async (trx) => …)`. Replace the method's doc comment with the lock rationale, pointing to T015's helper (depends on T015). The body:
  1. Call `lockTargetAndActiveOrganizationAdmins(trx, command.userId)`.
  2. If there is no target, return `NOT_FOUND`.
  3. If the target's access status is `DEACTIVATED`, return `DEACTIVATED`.
  4. If the target is `ACTIVE` with role `ORGANIZATION_ADMIN`, `command.role !== 'ORGANIZATION_ADMIN'`, and there are no other active organization admins, return `LAST_ACTIVE_ORGANIZATION_ADMIN`.
  5. Otherwise, run GH-28's guarded `UPDATE` on `trx`: keep `whereNot('accessStatus', 'DEACTIVATED')` and the hand-written `updatedAt`. When it affects no row, re-read and return `DEACTIVATED` or `NOT_FOUND`, with the SQLite belt-and-braces comment `requirePasswordRenewal` uses.
  6. Reload with `preloadAccessHistory(User.query({ client: trx })…)` and return `CHANGED`.
- [X] T017 [US2] In `apps/api/app/users/role_change/change_user_role_use_case.ts`, map `result.kind === 'LAST_ACTIVE_ORGANIZATION_ADMIN'` to `throw new LastActiveOrganizationAdminException()`. Extend the `handle` doc comment: the rule is decided by the locked write at apply time, so a requester who lost the role in the same collision is still refused (depends on T013, T016)
- [X] T018 [P] [US2] In `CONTEXT.md`, extend the **User Role Change** entry with one sentence: an organization admin never changes their own role, and a role change never leaves the organization without an active organization admin. Do not restate the deactivation half, which is GH-21's (research D10)
- [X] T019 [P] [US2] In `apps/api/app/users/shared/user_policy.ts`, correct the `changeRole` doc comment's second paragraph. Which targets may be changed is now decided by `ChangeUserRoleUseCase` (the requester themselves) and by the locked write in the repository (a deactivated target, the last active organization admin), not by "the guarded write" alone. No code change
- [X] T020 [US2] Run `pnpm --filter api test --files "tests/unit/users/role_change/*" --files "tests/integration/users/role_change/*"` and confirm it green, including the 50-round group, then `pnpm --filter api test` in full. The repository method is shared with every role change, so the whole users suite must stay green

**Checkpoint**: The invariant holds against every combination of role changes. The API half of the
slice is complete.

---

## Phase 5: User Story 3 — Understand a Refused Role Change in the Workbench (Priority: P2)

**Goal**: A refused administrator reads the reason, sees the target as they stand, keeps any identity
correction already applied, and is followed at once to what their new situation allows: the record
for a demoted viewer, sign-in for a deactivated one.

**Independent Test**: With MSW, refuse the role change with `409 E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN`
and flip `auth.me` to an operations admin. The toast carries the message, and the panel gives way to
the record, with no `Edit` action and no status tabs. Flip `auth.me` to `401` instead, and the
location becomes `/login`.

### Tests for User Story 3 ⚠️

- [X] T021 [P] [US3] Create `apps/web/src/features/users/__tests__/role-change/final-admin.test.tsx`.
  - Its target is `active-2` recast as an organization admin (`{ ...USERS.find(active-2), role: 'ORGANIZATION_ADMIN' }`, applied in both `USERS` and the `ACTIVE_USERS_WITHOUT_LIFECYCLE` projection).
  - Its handlers flip after the role `PATCH` answers `409` with `{ error: { code: 'E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN', message: 'The organization must keep at least one active organization admin' } }`.
  - Tests:
    - "follows a viewer demoted in the same collision": `auth.me` then reports `{ ...ORGANIZATION_ADMIN, role: 'OPERATIONS_ADMIN' }`, and the collection is the operations admin projection. After `Save changes`, the refusal message appears (toast); the `Edit user` heading is gone; the record dialog names the target and shows `Organization admin`; no `Edit` button and no status `tablist` are rendered.
    - "sends a viewer deactivated in the same collision to sign-in": `auth.me` then answers `401`, and `router.state.location.pathname` becomes `/login`.
    - "keeps an identity correction that landed before the refusal": the first name and the role are both changed. The identity `PATCH` succeeds and updates the collection, in the style of `mockIdentityCorrection`. The role is refused, with `auth.me` flipping to an operations admin. The record then shows the corrected first name, and the identity was sent exactly once (FR-013).
  - The first two fail today, because `onError` does not refetch `auth.me`.
- [X] T022 [P] [US3] Create `apps/web/src/components/layout/__tests__/authenticated-layout/session-lost.test.tsx` with "sends a viewer whose session is lost mid-visit to sign-in instead of a blank frame".
  - Render `/` with `auth.me` answering an organization admin, and wait for the navigation.
  - Switch the `auth.me` handler to `401`, and call `queryClient.invalidateQueries({ queryKey: tuyauQuery.auth.me.queryKey() })` on the `queryClient` that `renderApp` returns.
  - Expect `router.state.location.pathname` to become `/login` and the sign-in heading to render.
  - Add a comment explaining that today the frame renders `null` and stays on `/`, and that a bare redirect would loop through `_guest` on the stale cached user

### Implementation for User Story 3

- [X] T023 [US3] In `apps/web/src/features/users/mutations/use-user-mutations.ts`, make `changeRole`'s `onError` `async () => { await refreshUsers(); await queryClient.invalidateQueries({ queryKey: tuyauQuery.auth.me.queryKey() }) }`. Rewrite the comments on the mutation and in `onSuccess`. The case is no longer "belt-and-braces": the final admin refusal only reaches a viewer who has just lost the organization admin role or their access, so the session must be refetched on a refusal too (research D8)
- [X] T024 [US3] In `apps/web/src/components/layout/authenticated-layout.tsx`, when `useSession().status === 'unauthenticated'`, run an effect, guarded by a ref so it runs once per loss, that calls `await resetSession(queryClient)` from `@/features/auth/session/session-cache`, then `await router.invalidate()`. This is the sequence `useLogout` uses, and `_authenticated`'s guard then redirects to `/login`. Keep rendering `null` for every non-authenticated status. The doc comment must explain why a bare `<Navigate to="/login">` is wrong: the failed refetch keeps the previous user in the cache, so `_guest`'s `ensureQueryData` would bounce the viewer straight back (research D8; contract "Losing the session mid-visit")
- [X] T025 [US3] Run the affected web suites and confirm them green: `pnpm --filter web test src/features/users src/features/auth src/components/layout`. The layout change reaches every authenticated page, so the auth and layout suites are part of the check

**Checkpoint**: All three stories are complete. A refused administrator is never left on a stale panel
or a blank page.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T026 [P] Tick the delivery boxes in [checklists/requirements.md](./checklists/requirements.md), under "Source acceptance criteria" and "Verification", naming the test that satisfies each, in the form GH-28's checklist uses
- [X] T027 Run the two role-change suites against a scratch PostgreSQL database, as in [quickstart.md](./quickstart.md#proving-the-lock-on-postgresql) (`portflow_gh29_verify`). Confirm all green, the 50 rounds included, with no `40P01` deadlock in the log, then drop the database. Record the outcome next to this task. *2026-09-11 — against `portflow_gh29_verify` in `portflow-postgres`: 43/43 green, no `40P01` in the log. With a temporary counter on the collision group, all 50 losers were `409 E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN` — never a `403` — so every round really contended on the lock. With `forNoKeyUpdate()` temporarily removed, round 1 failed: both demotions applied and no active organization admin remained. Both probes were reverted and the database dropped*
- [ ] T028 Walk the `psql`-staged collision in [quickstart.md](./quickstart.md#staging-the-collision-by-hand-postgresql) against `pnpm dev`, covering the demotion variant, the `COMMIT`-only variant, the deactivation variant, and the identity-kept variant. Then run the curl self-refusal checks. Restore every role and status changed on the shared `portflow-postgres`, and do not run `db:fresh` there. Note SC-005's 2-second observation. **API half done, browser half pending.** *2026-09-11 — run against an API server on port 3399 over a migrated and seeded `portflow_gh29_verify` rather than the shared dev database, so nothing on `portflow-postgres`'s shared data was touched:*
  - *Self checks: Claire naming herself answered `409 E_USER_SELF_ROLE_CHANGE` for all four roles and for the upper-cased id; Thomas (operations admin) got the same `403` naming himself as naming Claire.*
  - *Demotion variant: with Claire's row held by `psql`, her demotion of Thomas waited 3.1 s and was refused with `409 E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN`; Thomas remained the active organization admin, and Claire's next request was a `403`.*
  - *`COMMIT`-only variant: the same demotion waited, then succeeded (`200`).*
  - *Deactivation variant: `409`, then `auth.me` answered `401`.*
  - *The server log shows no error-level entry.*
  - *Still for a person: the browser walkthrough — the toast, the panel giving way to the record, the redirect to sign-in, the identity-kept variant, and SC-005's 2-second observation. Vitest covers each of these (`role-change/final-admin.test.tsx`, `authenticated-layout/session-lost.test.tsx`), but not in a real browser.*
- [X] T029 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the repository root. Then obtain a fresh read-only review of the final diff, and resolve or explicitly justify every confirmed finding (constitution VII)
- [ ] T030 Carry the GH-21 risk into the PR description: until GH-21 ships, a demotion and a deactivation applied at the same moment can still leave no active organization admin, and GH-21 closes it by calling `lockTargetAndActiveOrganizationAdmins` from `deactivateActive`. Mention the spec's planning revision to US3, FR-012, and SC-005, and the layout fix that now reaches every authenticated page. *Pending: no commit or PR has been made in this session*

### Review outcome (T029)

A fresh read-only review of the final diff was run by an independent agent. Its verdict: no
correctness bug in the production code. It confirmed, among other things:

- the id-ordered lock cannot deadlock with itself or with any other transaction that touches `users`;
- PostgreSQL's re-check of an `OR` predicate drops a colliding admin, and three admins demoting each other in a cycle always leave one;
- `FOR NO KEY UPDATE` has the right strength;
- the refusal order matches the contract;
- the layout effect reaches `/login` and does not re-enter.

Seven findings, all Low or nits, each resolved:

1. *CONFIRMED — a test passed for the wrong reason.* "never refuses assigning the organization admin role" promoted a second admin before the no-op, so it would have passed without the `command.role !== 'ORGANIZATION_ADMIN'` clause. It is now two tests, one of them the no-op on the only active admin.
2. *CONFIRMED — upper-cased ids behaved inconsistently on SQLite.* The lock matched the target through the admin half of its `OR`, and the `UPDATE` then missed it. `changeRole` now lower-cases the id once and uses it in every statement, and the helper documents that it expects that spelling. Covered by the new unit test "changes the role of a user named with an upper-cased identifier".
3. *PLAUSIBLE — a wrong comment.* The collision group's comment said a SQLite loser is always a 403. It now says either a 403 or a 409 can occur, depending on how the requests queue for the connection.
4. *CONFIRMED — the collision group left users behind.* Its cleanup now deletes the users it created, then restores the admins it hid.
5. *PLAUSIBLE — logout reset the session twice.* The layout effect now steps in only when a stale user is still cached, which is exactly the session lost mid-visit. Fixing this exposed a bug in the fix itself: `getQueryData` needs the exact key `queryOptions({}).queryKey`, not the prefix `queryKey()`. It was caught by `session-lost.test.tsx`, and the logout tests stay green.
6. *PLAUSIBLE — refusals waited on two refetches in a row.* The two refetches now run in parallel, so the refusal is reported sooner and the collection never arrives ahead of the session.
7. *Nit — a doc comment read as a guarantee.* `requestedByUserId` is now documented as "Refused if it names the target".

After the fixes, the role-change suites were rerun on SQLite and on the scratch PostgreSQL database: 45/45 on both.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T002 and T003 are needed by US2's unit tests; T003 also touches US1's unit file
- **Foundational (Phase 2)**: empty
- **US1 (Phase 3)**: depends on Setup (T003 moves a helper out of the file T004 edits). Delivers the MVP
- **US2 (Phase 4)**: depends on US1. It edits the same use case and exceptions files, and its unit calls need US1's `requestedByUserId`
- **US3 (Phase 5)**: its tests are MSW-driven and depend on nothing server-side, so they can be written as soon as Setup is done. Shipping US3 before US2 would be pointless: there is no refusal to follow until US2 exists
- **Polish (Phase 6)**: depends on every story being complete; T027 and T028 need US2 and US3

### Where the stories genuinely diverge

The API halves of US1 and US2 are one chain through `change_user_role_use_case.ts` and
`user_exceptions.ts`. That is one command acquiring two refusals, and the phases say so rather than
promising parallelism. US3 is truly independent: different files, a different app, and tests that
mock the API. It can be built alongside US2 by a second pair of hands.

### Within Each User Story

- Tests are written, and the API ones observed failing, before the implementation tasks in the same phase
- US2: exception → result type → locking helper → `changeRole` → use case mapping
- US3: the mutation callback and the layout effect are independent of each other

### Parallel Opportunities

- **Phase 1**: T002 and T003
- **Phase 3**: T004, T005, and T006 together
- **Phase 4**: T011 and T012 together; T018 and T019 alongside the T013 → T017 chain
- **Phase 5**: T021 and T022 together; T023 and T024 together. The whole phase can run in parallel with Phase 4
- **Phase 6**: T026 alongside T027 and T028

---

## Parallel Example: User Story 2

```bash
# The two failing test files, together:
Task: "Unit decision table in apps/api/tests/unit/users/role_change/final_admin.spec.ts"
Task: "Integration refusal and 50-round collision in apps/api/tests/integration/users/role_change/final_admin.spec.ts"

# Beside the repository chain T013 → T014 → T015 → T016 → T017:
Task: "User Role Change rules in CONTEXT.md"
Task: "changeRole doc comment in apps/api/app/users/shared/user_policy.ts"

# And, on the web, User Story 3 in full:
Task: "Workbench refusal journeys in apps/web/src/features/users/__tests__/role-change/final-admin.test.tsx"
Task: "Session lost mid-visit in apps/web/src/components/layout/__tests__/authenticated-layout/session-lost.test.tsx"
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1: Setup
2. Phase 3: User Story 1
3. **STOP and VALIDATE**: the curl self-refusal checks in [quickstart.md](./quickstart.md#proving-the-refusals-at-the-api)

The MVP already closes the only path a single request could take to lock the organization out: an
administrator demoting themselves. What remains open at that checkpoint is the collision, which US2
closes.

### Incremental delivery

- US1 closes self-demotion.
- US2 closes collisions between role changes, and makes the API half complete and reviewable.
- US3 makes the workbench follow the refused administrator instead of leaving them on a stale panel
  or a blank page.

Each phase leaves the branch green.

### Before the PR is ready

T027's PostgreSQL run is the only proof of the lock itself. The suites cannot provide it, because
they run on SQLite. Do not mark the PR ready without it, and record its outcome in this file.

---

## Notes

- `[P]` means a different file and no dependency on an incomplete task
- `[Story]` maps a task to the user story it serves, for traceability back to the spec's FRs
- Commit after each task or logical group, using Conventional Commits
- Verify tests fail before implementing
- No task changes the database schema. If one appears to need to, the design has drifted from
  data-model.md, and that is a plan change, not an implementation detail
