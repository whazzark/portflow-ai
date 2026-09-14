# Implementation Plan: Reactivate a User with Fresh Credentials

**Branch**: `whazzark/reactivate-a-user-with-fresh-credentials` | **Date**: 2026-09-11 | **Spec**:
[spec.md](./spec.md)

**Input**: Feature specification from
`specs/user-administration/user-reactivation/reactivate-a-user-with-fresh-credentials/spec.md`

## Summary

Give a deactivated user a way back. The API gains one endpoint, `POST /api/v1/users/:id/reactivate`,
reserved to an active organization admin. It moves one `DEACTIVATED` user to `ACTIVE`, records the
date and the responsible administrator, records the password renewal requirement `#117` enforces,
and revokes the user's remembered connections, all in one guarded write. Every other target is
refused with its own reason: `PENDING_INVITATION`, `CANCELLED_INVITATION`, `ALREADY_ACTIVE`,
`NOT_FOUND`. No credential is handed over (CLR-001). The user signs in with the password they held
before and meets the renewal step. The web gains a `Reactivate` access action in the record footer
and the row menu. It is the fourth key of the access-action machinery the deactivation built for it.

Most of the slice is the deactivation run backwards, and it reuses that design wholesale. One thing
is new: **a session opened before the reactivation must not come back to life with it** (FR-014).
Sessions live in the cookie (API ADR-0001) and can't be deleted from the server. So every session
records the user's `reactivated_at` at the moment it is opened, and `authenticateOpenSession`, the
single definition of an open session, refuses one whose marker no longer matches. That is research
[D5](./research.md#d5--a-session-opened-before-the-latest-reactivation-grants-nothing), recorded
durably as API ADR-0015.

Decisions and rejected alternatives are in [research.md](./research.md). The transition, the columns
written, the rows deleted, and the session key are in [data-model.md](./data-model.md). The two
contracts are in [contracts/](./contracts/).

## Technical Context

**Language/Version**: TypeScript 5.7+ on Node, ESM throughout the PNPM 10 / Turbo monorepo.

**Primary Dependencies**: AdonisJS 7.3 (Lucid 22, Bouncer 4, session auth on the cookie store),
VineJS 4, Tuyau for the typed API/web contract (ADR-0005), TanStack Start + Router + Query 5,
shadcn/Tailwind primitives, Sonner for toasts.

**Storage**: PostgreSQL in every environment but tests, in-memory SQLite in tests (API ADR-0014).
`users.reactivated_at`, `users.reactivated_by_user_id` (GH-2), and
`users.password_renewal_required_at` (`#117`) already exist. **No migration.** One new key in the
cookie-held session (data-model.md).

**Testing**: Japa. `unit` covers the use case's outcomes and the repository's guarded write against
real SQLite. `integration` covers the HTTP matrix, validation, payload, concurrency, and the session
rule end to end. Vitest + Testing Library + MSW for the web, through the real router. No
`apps/web/e2e` exists, so the browser journey is manual in [quickstart.md](./quickstart.md).

**Target Platform**: The AdonisJS API server and the TanStack Start web application already deployed
from this monorepo.

**Project Type**: Web application, `apps/api` + `apps/web`.

**Performance Goals**: SC-001 is the new status visible within 2 seconds, through one invalidation of
the collection query already held. One request per reactivation. The session rule adds **no query**:
`authenticateOpenSession` already re-reads the user on every request.

**Constraints**:

- FR-009 / FR-015: status, event, requirement, and revocation are one indivisible change.
- FR-014: no pre-reactivation session or remembered connection grants anything, with no server-side
  session store to purge.
- FR-016: exactly one reactivation under concurrency.
- FR-012 / FR-013: no credential produced or disclosed.
- The `toAdministration()` projection must not change shape.
- The session rule must not change behaviour for any user never reactivated (FR-024).

**Scale/Scope**: One site, one organization, ≤ 200 users. One endpoint, one API workflow slice, one
repository operation, one shared auth helper, one new exception, one web mutation, and four copy
keys. No schema change.

## Constitution Check

*GATE: passed before Phase 0 research, re-checked after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Selected feature intent is versioned | PASS. Issue #32 is selected, its spec is written, and its one material ambiguity (CLR-001, whether a credential is handed over) was resolved by the user before this plan. |
| II. One independently deliverable feature per spec | PASS. One outcome: a deactivated user regains sign-in access under a required new password. The API and web halves ship as one write. The session rule is part of that outcome (FR-014), not a separate feature. Deactivation (#20), the reset (#17), and the renewal (#117) are consumed unchanged. |
| III. Vanilla Spec Kit gates | PASS. The spec was reviewed before planning, and this plan awaits human review before `speckit-tasks`. The spec explicitly deferred the leftover-session question to the plan; D5 answers it without a spec change. |
| IV. Test-first observable behavior | PASS. RED → GREEN → REFACTOR on the command's five outcomes, then on the session rule through HTTP, then on the workbench journeys. Every acceptance scenario maps to a seam in research D14. |
| V. Deep boundaries and explicit contracts | PASS. The policy authorizes coarsely. The use case maps outcomes to refusals. The repository owns the guarded write, the requirement, and the token revocation in one transaction. The controller adapts HTTP and validates `:id`. The session rule lives in `open_session.ts`, which already declares itself the single definition of an open session; the three places a session is opened stamp it through one shared helper. On the web, the users feature module owns the copy, the mutation, and the dialog reuse. No cross-layer shortcut. |
| VI. Durable knowledge has a home | PASS. Vocabulary comes from `CONTEXT.md` (User Reactivation, Password Renewal Requirement, Remembered Connection), and no new term is introduced. The first server-side invalidation of a cookie-store session is an architectural decision, so it gets **API ADR-0015** rather than living only in this feature's research. ADR-0013's naming and typed outcomes are followed as the deactivation did. |
| VII. Verification is part of delivery | PASS. `pnpm check`, `pnpm typecheck`, and `pnpm test` (including the unchanged `tests/integration/auth/**` as the D5 regression guard) and the browser journeys in [quickstart.md](./quickstart.md) before the PR, then a fresh read-only review of the final diff. |
| VIII. One workflow owner | PASS. No new state machine. The access status and the session marker are data, not an orchestrator. |

No violation to justify; **Complexity Tracking is empty**.

## Project Structure

### Documentation (this feature)

```text
specs/user-administration/user-reactivation/reactivate-a-user-with-fresh-credentials/
├── spec.md
├── plan.md                          # This file
├── research.md                      # Phase 0: decisions D1–D14 and rejected alternatives
├── data-model.md                    # Phase 1: the transition, what it writes/deletes, the session key
├── quickstart.md                    # Phase 1: how to run and prove the feature
├── contracts/
│   ├── reactivate-user.md           # POST /api/v1/users/:id/reactivate, incl. effect on sessions
│   └── user-reactivation-action.md  # The workbench action's observable contract
├── checklists/requirements.md
└── tasks.md                         # Phase 2: produced by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── users/
│   │   ├── reactivate/
│   │   │   ├── reactivate_user_use_case.ts            # NEW: outcome → refusal mapping (D1, D2)
│   │   │   └── reactivate_user_validator.ts           # NEW: the :id route parameter (D7)
│   │   └── shared/
│   │       ├── user_exceptions.ts                     # + UserAlreadyActiveException (D2)
│   │       ├── user_policy.ts                         # + reactivate()
│   │       └── repositories/
│   │           ├── user_repository.ts                 # + ReactivateUserCommand/Result, reactivateDeactivated()
│   │           └── lucid_user_repository.ts           # + guarded write, requirement, token revocation (D3, D4)
│   ├── auth/shared/
│   │   ├── session_reactivation.ts                    # NEW: session key, stamp, match (D5)
│   │   └── open_session.ts                            # + refuse a stale marker; stamp on restoration
│   └── controllers/
│       ├── users_controller.ts                        # + reactivate
│       ├── login_controller.ts                        # + stamp the session after login
│       └── invitation_acceptance_controller.ts        # + stamp the session after login
├── start/routes.ts                                     # + POST /users/:id/reactivate (under passwordRenewalCompleted)
├── docs/adr/0015-refuse-sessions-opened-before-a-reactivation.md  # NEW (D5)
└── tests/
    ├── unit/users/reactivation/reactivate.spec.ts      # NEW: the five outcomes, what is and is not written
    ├── unit/users/reactivation/guarded_write.spec.ts   # NEW: conditional update, revocation, preservation
    ├── integration/users/reactivation/reactivate.spec.ts  # NEW: authorization, validation, payload, concurrency
    └── integration/users/reactivation/sessions.spec.ts    # NEW: stale sessions refused, fresh login confined (FR-014)

apps/web/
└── src/features/users/
    ├── helpers/user-access-copy.ts                    # + 'reactivate' keys: labels, title, effect, refusals
    ├── user-access.tsx                                # + DEACTIVATED → ['reactivate'], variant, request branch
    ├── mutations/use-user-mutations.ts                # + reactivate, invalidating on success and error
    ├── ui/user-access-record.tsx                      # comment only: reactivation is now offered here
    ├── ui/user-row-actions.tsx                        # comment only: the menu already follows userAccessActions
    └── __tests__/
        ├── support/test-helpers.ts                    # + mockUsersWithReactivation
        └── reactivate/                                # journey, permissions, refusals, recovery, row-menu
```

**Structure Decision**: The existing vertical-slice layout on both sides. A new API workflow slice
`app/users/reactivate` with its validator sits beside the shared policy, exceptions, repository, and
transformer it extends, exactly as `app/users/deactivate` does. The session rule goes to
`app/auth/shared`, next to `open_session.ts` and `remembered_connection.ts`, the two modules that
already define what makes a session count. On the web, reactivation enters through the
`UserAccessAction` union and `UserAccessDialog`, the path the deactivation research (D8) reserved
for it, so the row menu and the record footer need no structural change.

## Phase 0: Outline & Research

Complete. See [research.md](./research.md):

- **D1** who decides each refusal, and why there is no `SELF`
- **D2** the HTTP shape of each outcome
- **D3** the guarded write as concurrency control
- **D4** status, requirement, event, and revocation as one change
- **D5** the session marker that stops a pre-reactivation session from reviving
- **D6** what happens to the old password
- **D7** the malformed identifier
- **D8** the response
- **D9** the web action joining `userAccessActions`
- **D10** mutation and invalidation
- **D11** what the workbench does after a success
- **D12** who sees the action
- **D13** the seeded dataset
- **D14** verification seams

## Phase 1: Design & Contracts

Complete:

- [data-model.md](./data-model.md) fixes the transition, the five columns written, the columns
  asserted untouched, the tokens deleted, and the session key with its decision table.
- [contracts/reactivate-user.md](./contracts/reactivate-user.md) fixes the endpoint, its
  authorization matrix, its outcomes, its payload, and its effect on existing sessions.
- [contracts/user-reactivation-action.md](./contracts/user-reactivation-action.md) fixes the
  workbench action.
- [quickstart.md](./quickstart.md) is the runnable validation guide, including the stale-session
  proof by hand.

Implementation notes the tasks must carry:

- **Order within the API.** The session rule (D5) lands and is proven *before* the endpoint can
  produce a reactivated user in integration tests. Its tests prime `reactivated_at` through the
  factory, so it can go test-first independently. Then comes the command. The `sessions.spec.ts`
  journey ties the two together.
- **Test sessions for reactivated users.** Open them through `POST /api/v1/auth/login` and
  `.withSession(response.session())`, or prime the marker with `.withSession({...})`. A bare
  `loginAs` *is* the stale session D5 refuses. No existing test uses a reactivated user, so no
  existing test changes.
- **Throw-site messages.** `UserPendingInvitationException` and `UserCancelledInvitationException`
  are thrown with reactivation-specific messages (D2). Their codes and statuses stay.
- **ADR-0015** states the rule, its exactness argument, and the counter-column alternative as the
  documented next step if a second session-ending trigger ever appears. Link it from ADR-0001's
  Consequences so the session model's two documents point at each other.

**Post-design Constitution re-check**: PASS, unchanged. The design adds no layer, dependency,
migration, or state machine. It adds one endpoint, one use case, one guarded repository operation,
one session rule at the existing single definition of an open session, and four copy keys, each
inside a boundary the codebase already owns.

## Complexity Tracking

No Constitution Check violation. Nothing to justify.
