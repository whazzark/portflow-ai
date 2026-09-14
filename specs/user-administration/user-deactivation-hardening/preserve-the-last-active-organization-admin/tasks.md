---

description: "Task list for Preserve the Last Active Organization Admin"
---

# Tasks: Preserve the Last Active Organization Admin

**Input**: Design documents from
`/specs/user-administration/user-deactivation-hardening/preserve-the-last-active-organization-admin/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/deactivate-user.md](./contracts/deactivate-user.md),
[quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV makes RED → GREEN → REFACTOR binding, and
[research D7](./research.md#d7--proving-a-race-on-a-single-connection-test-database) fixes the three
proof layers:

- **Repository, sequential.** Every interleaving collapses to a commit order, so Japa unit tests
  against the real SQLite database (ADR-0014) play each order that matters.
- **HTTP, the in-flight window.** A test-only subclass of the real `LucidUserRepository` commits the
  competing change and then delegates to the real `deactivateActive`.
- **PostgreSQL, real concurrency.** The quickstart loop, run by hand, because the single-connection
  test database cannot run two transactions at once.

**Organization**: Tasks are grouped by user story so that each story can be implemented, tested,
and demonstrated on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task serves (US1–US2)
- Every description gives exact file paths

## Path Conventions

This is a web application monorepo, but only `apps/api/` changes. `apps/web/` receives one pinning
test and no code, and `CONTEXT.md` receives one sentence. See plan.md's Structure Decision.

## How the two stories split one mechanism

The same guarded write serves both stories. It locks the actor's and target's rows in id order, then
re-reads the actor before the existing `UPDATE`. The split follows what the re-read checks:

- **US1** checks that the actor's **access status** is still `ACTIVE`. That alone closes the mutual
  deactivation race and the three-admin cycle, which is the lockout the slice exists for.
- **US2** adds the actor's **role**, so a demotion committed while the request was in flight is also
  refused. It also pins that lost entitlement takes precedence over every reason about the target.

Each checkpoint is a safe increment. After US1, a demoted actor still passes the write, exactly as
under GH-20 today, and nothing is weaker than before.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Anchor the regression baseline. There is nothing to create: no migration, no new
directory, and no new dependency.

- [X] T001 Run the delivered deactivation suites and confirm they are green before any change, as the SC-005 regression baseline: `apps/api/tests/unit/users/deactivation/`, `apps/api/tests/integration/users/deactivation/`, and `apps/web/src/features/users/__tests__/deactivate/`. Use the commands in [quickstart.md §1](./quickstart.md#1-automated-seams). Also confirm that `users.access_status` and `users.role` exist in `apps/api/database/schema.ts`, so no migration is needed ([data-model.md](./data-model.md)).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The new outcome's type, its exception, and the use case branch that maps one to the
other. The repository never returns the new outcome yet, so this phase changes no behavior. It only
gives both stories something to go RED against.

**⚠️ CRITICAL**: Both stories depend on T002–T004.

- [X] T002 [P] Add `| { kind: 'ACTOR_NOT_ENTITLED' }` to `DeactivateUserResult` in `apps/api/app/users/shared/repositories/user_repository.ts`, carrying no field, and extend its JSDoc: the variant says the actor was no longer an active organization admin when the write took effect, and it deliberately carries nothing about the target ([research D3](./research.md#d3--precedence-lost-entitlement-beats-every-target-reason)). Amend the JSDoc of the abstract `deactivateActive` in the same file: it locks the actor's and target's rows in id order and re-reads the actor under that lock before its guarded `UPDATE` ([data-model.md](./data-model.md#the-guarded-write-extended)).
- [X] T003 [P] Add `DeactivationNoLongerAuthorizedException` to `apps/api/app/users/shared/user_exceptions.ts` with `static status = 403`, `static code = 'E_AUTHORIZATION_FAILURE'`, and `static message = 'Access denied'`. These are the three values Bouncer's `AuthorizationException` renders through `apps/api/app/exceptions/handler.ts`. Add a doc comment on why it impersonates the policy denial instead of declaring a code of its own: FR-004 and FR-008 require the same outcome, and only an actor who has already lost entitlement can receive it ([research D4](./research.md#d4--the-refusal-is-gh-20s-403-e_authorization_failure-byte-for-byte)).
- [X] T004 In `apps/api/app/users/deactivate/deactivate_user_use_case.ts`, map `result.kind === 'ACTOR_NOT_ENTITLED'` to `throw new DeactivationNoLongerAuthorizedException()`. Place it right after the `DEACTIVATED` return and before the `NOT_FOUND` branch, so that TypeScript still narrows `result.accessStatus` below. Leave the `SELF` refusal first and unchanged. Update the class JSDoc: the use case owns *which* user may be deactivated, and it also turns the write's in-flight entitlement re-check into the policy's refusal. Run `pnpm typecheck`.

**Checkpoint**: The build is green and behavior is unchanged. T001's suites still pass.

---

## Phase 3: User Story 1 — Never Lock the Organization Out When Admins Deactivate Each Other (Priority: P1) 🎯 MVP

**Goal**: When organization admins deactivate each other, at least one always remains. For the only
two admins, exactly one deactivation takes effect. The losing request writes nothing on either row
and receives GH-20's `403 E_AUTHORIZATION_FAILURE`.

**Independent Test**: Run the repository commit orders A→B then B→A, and the cycle A→B, B→C, C→A.
Then run the HTTP in-flight window, where the actor is deactivated by a competing admin just before
the write. Every run leaves at least one active organization admin, and every refusal is
byte-identical to the policy's `403`. On PostgreSQL, run the [quickstart §2](./quickstart.md#2-real-concurrency-on-postgresql-sc-001)
loop.

### Tests for User Story 1 ⚠️

> Write these first and watch them fail against the unchanged `deactivateActive`.

- [X] T005 [P] [US1] In `apps/api/tests/unit/users/deactivation/guarded_write.spec.ts`, add "refuses the second of two admins deactivating each other". Create two `ORGANIZATION_ADMIN` users A and B with `UserFactory.apply('active')`, and give A a remembered connection using the file's `rememberedConnection` helper. Call `deactivate(B, A)` and then `deactivate(A, B)`. Assert:
  - the first returns `DEACTIVATED`;
  - the second deep-equals `{ kind: 'ACTOR_NOT_ENTITLED' }`;
  - A is still `ACTIVE` and `ORGANIZATION_ADMIN`, with `deactivatedAt` and `deactivatedByUserId` still `null`;
  - A's remembered connection is still there;
  - B's `deactivatedByUserId` is still A's id.
- [X] T006 [US1] In the same file, add "keeps an organization admin through a three-admin cycle". Create three `ORGANIZATION_ADMIN` users A, B, and C, and play A→B, B→C, C→A in that order. Assert the results are `DEACTIVATED`, `ACTOR_NOT_ENTITLED`, and `DEACTIVATED`. Assert that C is still `ACTIVE` and `ORGANIZATION_ADMIN`, and that both recorded deactivations name an actor who was active when theirs took effect: B by A, A by C.
- [X] T007 [P] [US1] In `apps/api/tests/unit/users/deactivation/deactivate.spec.ts`, add "refuses as no longer authorized once the actor was deactivated". Create an `ORGANIZATION_ADMIN` actor and an active target, set the actor's `accessStatus` to `DEACTIVATED` directly with the model, and call the use case. Assert that it rejects with `DeactivationNoLongerAuthorizedException`, with `status` 403 and `code` `E_AUTHORIZATION_FAILURE`, and that the target is still `ACTIVE`. Add a second case: an actor targeting themselves while deactivated still gets `SelfDeactivationException`, because `SELF` stays first.
- [X] T008 [P] [US1] In `apps/api/tests/integration/users/deactivation/deactivate.spec.ts`, add a test-only `CompetingChangeRepository extends LucidUserRepository`, declared in this file. Its constructor takes a `competingChange: (actorId: string) => Promise<void>`, and its `deactivateActive(command)` awaits `competingChange(command.deactivatedByUserId)` before `return super.deactivateActive(command)`. Swap it in with `app.container.swap(UserRepository, () => new CompetingChangeRepository(change))` and restore it with `app.container.restore(UserRepository)` in the group's teardown. Then add "refuses a deactivation whose actor was deactivated while it was in flight":
  - The competing change deactivates the actor on behalf of a second organization admin, writing `accessStatus`, `deactivatedAt`, and `deactivatedByUserId`.
  - `client.post(deactivatePath(target.id)).loginAs(actor)` returns `403`.
  - Its `response.body()` deep-equals the body of a policy denial captured in the same test from an `OPERATIONS_ADMIN` calling the same path ([contracts/deactivate-user.md](./contracts/deactivate-user.md#errors)).
  - The target is still `ACTIVE`, with its `remember_me_tokens` intact.
  - The actor's deactivation record is still the competing admin's.
  - The actor's next request returns `401`.
- [X] T009 [US1] In the same integration file, add "still deactivates the only other organization admin". Exactly two `ORGANIZATION_ADMIN` users exist and nothing competes. `POST` by one against the other returns `200` with `accessStatus: 'DEACTIVATED'` (FR-007, spec edge case 1). This test passes before and after the change. It is there to catch any overreach of the new guard.

### Implementation for User Story 1

- [X] T010 [US1] In `apps/api/app/users/shared/repositories/lucid_user_repository.ts`, add a private `lockUsers(trx: TransactionClientContract, ids: string[])`. It returns `User.query({ client: trx }).whereIn('id', ids).orderBy('id').forUpdate()`, in the shape of `LucidWarehouseRepository.lockWarehouses` (`apps/api/app/warehouses/shared/repositories/lucid_warehouse_repository.ts`). Document it:
  - It locks in id order so overlapping deactivations queue instead of deadlocking.
  - It is a no-op on SQLite.
  - GH-29's role change guard must take the same lock ([contracts/deactivate-user.md](./contracts/deactivate-user.md#obligation-on-other-writers-of-usersrole-and-usersaccess_status)).

  Then, inside `deactivateActive`'s existing transaction and before the guarded `UPDATE`, call `lockUsers(trx, [command.deactivatedByUserId, command.id])`. Find the actor among the returned rows, comparing ids case-insensitively as `DeactivateUserUseCase` does. Return `{ kind: 'ACTOR_NOT_ENTITLED' }` without writing when the actor row is missing or its `accessStatus !== 'ACTIVE'`. Leave everything after that point unchanged. Rewrite the method's JSDoc to explain why the GH-20 guard alone let the mutual race through (write skew on two different rows under READ COMMITTED) and why the ordered lock closes it ([research D2](./research.md#d2--concurrency-control-lock-the-actor-and-target-rows-in-id-order)).
- [X] T011 [US1] Run T005–T009 and T001's suites. All must be green, with GH-20's cases unchanged.

**Checkpoint**: The mutual deactivation race can no longer lock the organization out. This is
shippable as the MVP.

---

## Phase 4: User Story 2 — Refuse a Deactivation Whose Actor Lost Organization Admin Access in Flight (Priority: P2)

**Goal**: A deactivation also takes effect only if its actor still holds the `ORGANIZATION_ADMIN`
role at the write, so a concurrent demotion is refused. Lost entitlement is reported ahead of every
reason about the target. A password renewal requirement does not count against the actor.

**Independent Test**: Demote the actor to each of the three other roles before the write, both at
the repository and through the HTTP in-flight window. Each attempt is refused with GH-20's `403`, the
target stays active, and nothing changes. With the actor deactivated or demoted and a pending,
cancelled, deactivated, or unknown target, the refusal is still `ACTOR_NOT_ENTITLED`.

### Tests for User Story 2 ⚠️

- [X] T012 [P] [US2] In `apps/api/tests/unit/users/deactivation/guarded_write.spec.ts`, add "refuses once the actor was demoted". Loop over `OPERATIONS_ADMIN`, `OPERATIONS_LEAD`, and `OBSERVER`. For each role, create an `ORGANIZATION_ADMIN` actor and an active target, update the actor's `role` to that value, and call `deactivate(target, actor)`. Assert that the result deep-equals `{ kind: 'ACTOR_NOT_ENTITLED' }` and that the target is still `ACTIVE` with `deactivatedAt` still `null`.
- [X] T013 [US2] In the same file, add "reports lost entitlement ahead of any reason about the target". Take two actors, one deactivated and one demoted to `OBSERVER`. Pair each with each target: the `invited`, `cancelled`, and `deactivated` factory states, plus the unknown id `00000000-0000-4000-8000-999999999999`. Assert `{ kind: 'ACTOR_NOT_ENTITLED' }` every time. For existing targets, also assert that `accessStatus`, `deactivatedAt`, `deactivatedByUserId`, and the remembered connection count are unchanged (FR-003, FR-004).
- [X] T014 [US2] In the same file, add "still counts an organization admin who owes a password renewal". Create the actor with `UserFactory.apply('passwordRenewalRequired').merge({ role: 'ORGANIZATION_ADMIN' })` and an active target. Assert `DEACTIVATED` (FR-006, [research D5](./research.md#d5--who-counts-access-status-and-role-nothing-else)). Check first that the factory state leaves `accessStatus` at `ACTIVE`. This is a regression pin that passes as soon as it is written.
- [X] T015 [P] [US2] In `apps/api/tests/integration/users/deactivation/deactivate.spec.ts`, reuse T008's `CompetingChangeRepository` and add "refuses a deactivation whose actor was demoted while it was in flight". The competing change sets the actor's `role` to `OPERATIONS_ADMIN`. Assert `403`, a body deep-equal to the policy denial's, and a target that is still `ACTIVE`.
- [X] T016 [P] [US2] In `apps/web/src/features/users/__tests__/deactivate/refusals.test.tsx`, add "reports a refusal for lost entitlement like any other refusal". Use `mockUsersWithDeactivation()`, `mockDeactivationRefused('E_AUTHORIZATION_FAILURE', 'Access denied', 403)`, and the file's `confirmDeactivation`. Assert that the toast title "Unable to deactivate user “Amélie Bernard”" and the text "Access denied" appear, and that the collection is read again, counted as in the file's existing "refreshes the collection on a refusal" test. This pins FR-008 with no web code change ([research D6](./research.md#d6--no-web-code-change-one-pinning-test)), so it passes as soon as it is written.

### Implementation for User Story 2

- [X] T017 [US2] In `apps/api/app/users/shared/repositories/lucid_user_repository.ts`, extend the actor check T010 added in `deactivateActive`: return `{ kind: 'ACTOR_NOT_ENTITLED' }` when the locked actor row's `role !== 'ORGANIZATION_ADMIN'`, as well as when it is missing or not `ACTIVE`. Mention in the comment that the check reads only status and role, never the password renewal requirement (D5), and that a role change committed before the lock is what it catches ([data-model.md](./data-model.md#locks-this-slice-takes-and-what-waits-on-them)).
- [X] T018 [US2] Run T012–T016 and every earlier test. All must be green.

**Checkpoint**: Any deactivation whose actor lost organization admin access before the write is
refused, and both stories hold.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Durable knowledge, stale comments, and the delivery gates

- [X] T019 [P] In `CONTEXT.md`, add one sentence to the **Organization Admin** entry: the operating organization always keeps at least one active organization admin ([research D8](./research.md#d8--the-invariant-gets-a-home-in-contextmd)). Do not add a new term, and keep the entry's `_Avoid_` line as it is.
- [X] T020 [P] In `apps/api/tests/unit/users/deactivation/guarded_write.spec.ts`, rewrite the group's header comment, which starts "The guard, not a lock, is the concurrency control". The guard still makes two deactivations of the *same* user record exactly one. The ordered row lock is what makes two deactivations of *each other* resolve to exactly one. Point to research D2.
- [X] T021 Run the repository gates from the root: `pnpm check`, `pnpm typecheck`, and `pnpm test`. Fix every finding.
- [X] T022 Run [quickstart.md §2](./quickstart.md#2-real-concurrency-on-postgresql-sc-001) against the development PostgreSQL instance. Run the mutual deactivation loop 50 times. Every run must end with one `200` and one `403`, no `500`, the expected `403` body, and one organization admin still active. Then run the three-admin cycle. Record the tallies in the PR description, because this is the only evidence for SC-001 and SC-002.
- [X] T023 Obtain a fresh read-only review of the final diff (Constitution VII) and resolve or explicitly justify every confirmed finding before marking the PR ready.
  - **Review outcome (2026-09-11):** one should-fix and two nits, all resolved.
    - *Should-fix:* T010's `FOR UPDATE` could deadlock against a concurrent password reset. The reset's foreign-key check takes `FOR KEY SHARE`, which `FOR UPDATE` blocks. This was reproduced in two `psql` sessions (`deadlock detected`) and fixed by switching `lockUsers` to `FOR NO KEY UPDATE` through the knex query. The quickstart races were rerun green on the final code ([research D2](./research.md#d2--concurrency-control-lock-the-actor-and-target-rows-in-id-order)).
    - *Nit:* nothing in the test suite catches the lock being removed. The `lockUsers` doc comment now says the quickstart's PostgreSQL runs are the only proof.
    - *Nit:* `CONTEXT.md` overstated the invariant as already enforced everywhere. It is now worded as a rule ("must always keep"), because role changes enforce it only once GH-29 ships.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. It records the baseline.
- **Foundational (Phase 2)**: Depends on T001. T002 and T003 are parallel. T004 needs both, because
  it narrows the new variant and throws the new exception.
- **US1 (Phase 3)**: Depends on Phase 2. Its tests T005–T009 are written against Phase 2's types and
  fail until T010.
- **US2 (Phase 4)**: Depends on Phase 2. T017 edits the actor check T010 introduces, so US2's
  implementation needs US1's. US2's tests T012, T015, and T016 can be written as soon as Phase 2 is
  done.
- **Polish (Phase 5)**: T019 and T020 can start at any time after Phase 2. T021–T023 need both
  stories.

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2. It is the MVP.
- **US2 (P2)**: Extends the lock-and-re-read step US1 adds. Its demotion refusal and its precedence
  pins are testable on their own, but its one line of implementation lands on top of T010.

### Within Each User Story

- Write the tests first. The repository tests (T005, T006, T012, T013) and the in-flight tests
  (T008, T015) must fail before T010 and T017 respectively. T009, T014, and T016 are regression pins
  that pass as soon as they are written, and that is expected.
- Same-file tasks run in order: T005 → T006 → T012 → T013 → T014 in `guarded_write.spec.ts`, and
  T008 → T009 → T015 in the integration spec.

### Parallel Opportunities

- T002 ∥ T003.
- In US1: T005 (repository spec) ∥ T007 (use case spec) ∥ T008 (integration spec). These are three
  different files.
- In US2: T012 (repository spec) ∥ T015 (integration spec) ∥ T016 (web spec).
- Polish: T019 ∥ T020.

---

## Parallel Example: User Story 1

```bash
# RED, three files at once:
Task: "T005 mutual deactivation order in apps/api/tests/unit/users/deactivation/guarded_write.spec.ts"
Task: "T007 use case maps a deactivated actor to the 403 in apps/api/tests/unit/users/deactivation/deactivate.spec.ts"
Task: "T008 in-flight window through HTTP in apps/api/tests/integration/users/deactivation/deactivate.spec.ts"

# GREEN, one file:
Task: "T010 ordered lock + actor status re-check in apps/api/app/users/shared/repositories/lucid_user_repository.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T012 demoted actor in apps/api/tests/unit/users/deactivation/guarded_write.spec.ts"
Task: "T015 in-flight demotion in apps/api/tests/integration/users/deactivation/deactivate.spec.ts"
Task: "T016 403 refusal pin in apps/web/src/features/users/__tests__/deactivate/refusals.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001: baseline green.
2. T002–T004: type, exception, and mapping. Behavior is unchanged.
3. T005–T010: RED on the mutual race and the in-flight deactivation, then GREEN with the ordered
   lock and the actor status re-check.
4. **Stop and validate**: run T011. If PostgreSQL is at hand, run the quickstart §2 loop too. The
   lockout the slice exists for is closed.

### Incremental Delivery

1. Setup, Foundational, and US1 close the mutual race. This is the MVP.
2. US2 adds the role to the re-check, pins precedence and the password renewal requirement, and pins
   the workbench refusal.
3. Polish writes the invariant into `CONTEXT.md`, corrects the stale test header, runs the gates and
   the PostgreSQL loop, and gets the review.

The slice is small, about one repository method's worth of behavior, so it is expected to ship as a
single PR with both stories. The split exists so that each commit is a safe, green increment.

---

## Notes

- `[P]` tasks touch different files and have no dependency on an incomplete task.
- Out of scope: do not touch `changeRole` or any role change refusal (GH-29), `UserPolicy`,
  `apps/web` source code, or the database schema. The contract records GH-29's locking obligation,
  and T010's doc comment on `lockUsers` points to it.
- Commit per logical group with Conventional Commits, for example
  `feat(users): keep an organization admin when admins deactivate each other`.
