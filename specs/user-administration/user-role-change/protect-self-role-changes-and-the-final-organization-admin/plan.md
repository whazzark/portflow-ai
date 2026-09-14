# Implementation Plan: Protect Self-Role Changes and the Final Organization Admin

**Branch**: `whazzark/protect-self-role-changes-and-the-final-organiza` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`specs/user-administration/user-role-change/protect-self-role-changes-and-the-final-organization-admin/spec.md`

## Summary

This slice adds two refusals to GH-28's `PATCH /api/v1/users/:id/role`, without changing its request,
its success payload, or any existing failure.

- **Self role change.** `ChangeUserRoleUseCase` receives the requester and refuses, before any read,
  a request naming them in any letter case and with any role: `409 E_USER_SELF_ROLE_CHANGE`.
- **Final organization admin.** `LucidUserRepository.changeRole` becomes one transaction. It opens
  with a single locking read — the target plus every active organization admin, `ORDER BY id`,
  `FOR NO KEY UPDATE` — then decides on those rows, then writes. It reports a demotion of the only
  active organization admin as a new typed outcome, which the use case maps to `409
  E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN`.

The self rule means a single request can never demote the last admin. The final admin rule
therefore exists for collisions, and the lock is the whole of it. It serializes every change that
counts the same admins, and PostgreSQL re-reads any row it waited for. A demotion racing another
demotion, or arriving after a deactivation, is judged against the organization as it then stands.

The web gains no control and no copy. `changeRole`'s `onError` also refetches `auth.me`. That is
needed because the final admin refusal only reaches an administrator who has just lost that role or
their access, so the workbench must follow them at once. Planning established this fact and
corrected User Story 3 of the spec accordingly (spec, Revisions). Existing code shows the toast and
falls back to the record for a demoted viewer. A deactivated viewer needs one more change:
`AuthenticatedLayout` renders a blank page when the session is lost mid-visit, and now sends the
viewer to sign-in instead (research D8, added while generating tasks).

Decisions and rejected alternatives are in [research.md](./research.md). The invariant, decision
table, and typed outcomes are in [data-model.md](./data-model.md), and the delta on each seam is in
[contracts/](./contracts/). How to run the feature and prove it, including staging the collision on
PostgreSQL, is in [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript — 5.7 in `apps/api`, 5.9 in `apps/web` — on Node 25 in CI, ESM
throughout the PNPM/Turbo monorepo (`apps/*`).

**Primary Dependencies**: AdonisJS 7 (Lucid 22 over knex 3, Bouncer, VineJS, session auth), Tuyau
for the typed API/web contract (ADR-0005), TanStack Start + Router + Query, TanStack Form behind
`useAppForm`, MSW in web tests.

**Storage**: PostgreSQL (ADR-0002) in every environment but the test suites, which run on in-memory
SQLite (`apps/api/.env.test`, one pooled connection). **No migration.** The locking clause is
PostgreSQL-only, and knex compiles it to nothing on SQLite (research D3, D4).

**Testing**: Japa `unit` and `integration` suites with `UserFactory`. Vitest + Testing Library + MSW
for the web, rendering through the real router. The PostgreSQL lock is proven by hand: the two
role-change suites are run against a scratch database, and a `psql` session stages the collision
([quickstart.md](./quickstart.md)). There is no PostgreSQL service in CI and no `apps/web/e2e`.

**Target Platform**: The AdonisJS API server and the TanStack Start web application, both already
deployed from this monorepo.

**Project Type**: Web application — `apps/api` + `apps/web`.

**Performance Goals**: SC-005: the refusal and the refreshed view within 2 seconds in 95% of
attempts. The added cost per role change is one locking `SELECT` over at most a few hundred rows,
returning the target and a handful of admins, inside a transaction that holds its locks for a few
milliseconds.

**Constraints**:

- FR-002 needs a case-insensitive self check.
- FR-005 and FR-006 require the decision to be taken under locks, at apply time.
- FR-007 forbids disclosing the remaining admins.
- FR-009 means nothing may be written on a refusal.
- FR-011 keeps authorization before both refusals.
- GH-28's request and success contracts must not change.
- The locks must not deadlock role changes with each other, nor make an admin's ordinary work wait
  on foreign-key checks (research D4).

**Scale/Scope**: One site and one organization (ADR-0003), ≤ 200 users. No new endpoint or policy
method. The change amounts to 2 new exceptions, 1 new typed outcome, 1 rewritten repository method
with 1 private helper, 1 use case change, 1 controller change, 1 web callback, 1 effect in the
shared authenticated layout, and 1 glossary sentence.

## Constitution Check

*GATE: passed before Phase 0 research, re-checked after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Selected feature intent is versioned | PASS. Issue #29 is selected, and its spec replaced the migration placeholder at the path the issue names. No speculative GH-21 code is written. The seam GH-21 needs is only named (research D7). |
| II. One independently deliverable feature per spec | PASS. One outcome: role changes can no longer lock the organization out of user administration. It ships alone and is valuable alone. The deactivation half of the same invariant is GH-21's, recorded as a risk below. |
| III. Vanilla Spec Kit gates | PASS, with a disclosed spec revision. Planning found that US3 as written described an unreachable state, and the spec was corrected under a dated Revisions heading rather than silently reinterpreted. **The human spec review should cover that revision** before this plan is reviewed. |
| IV. Test-first observable behavior | PASS. RED → GREEN → REFACTOR runs on the decision table (unit), the refusal matrix and the 50-round collision (integration), and the workbench following a demoted or deactivated viewer (Vitest). Every acceptance scenario maps to a seam (research D9). |
| V. Deep boundaries and explicit contracts | PASS. The policy authorizes the viewer (unchanged). The use case owns both refusals and their exceptions, including the self rule outright. The repository owns the transaction, the lock order and strength, and reports what the locked write observed, as it already does with `EMAIL_TAKEN` and `REFERENCED` (research D2). The controller adapts HTTP. The web mutation owns what a refusal refreshes. |
| VI. Durable knowledge has a home | PASS. `CONTEXT.md` gains the two rules under **User Role Change**. No ADR: the locking decision is local to one repository and is documented in research and in its doc comment, where the codebase keeps its other locking decisions. |
| VII. Verification is part of delivery | PASS. `pnpm check`, `pnpm typecheck`, and `pnpm test`, plus the PostgreSQL run and staged collision in [quickstart.md](./quickstart.md), then a fresh read-only review of the final diff. |
| VIII. One workflow owner | PASS. No new state machine. |

No violation to justify, so **Complexity Tracking is empty**.

**Risk carried, not a violation**: until GH-21 ships, a demotion and a deactivation applied at the
same moment can still leave no active organization admin, because the deactivation half is
unguarded. GH-21 closes it by calling this slice's locking helper from `deactivateActive`, so the
two commands take the same locks in the same order. The spec (Out of Scope), the contract, the
quickstart, and the checklist all record the gap.

## Project Structure

### Documentation (this feature)

```text
specs/user-administration/user-role-change/protect-self-role-changes-and-the-final-organization-admin/
├── spec.md                               # revised during planning — see its Revisions heading
├── plan.md                               # This file
├── research.md                           # Phase 0 — D1..D10
├── data-model.md                         # Phase 1 — invariant, decision table, typed outcomes
├── quickstart.md                         # Phase 1 — suites, PostgreSQL run, staged collision
├── contracts/
│   ├── change-user-role-guards.md        # delta on PATCH /api/v1/users/:id/role
│   └── role-change-refusals-workbench.md # delta on the /users Edit panel
├── checklists/requirements.md
└── tasks.md                              # Phase 2 — produced by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/users_controller.ts                    # changeRole: + auth, passes requestedByUserId
│   └── users/
│       ├── role_change/change_user_role_use_case.ts       # + requestedByUserId, self check, maps the new outcome
│       └── shared/
│           ├── user_exceptions.ts                         # + SelfRoleChangeException, LastActiveOrganizationAdminException
│           ├── user_policy.ts                             # changeRole doc comment only: who decides which target
│           └── repositories/
│               ├── user_repository.ts                     # + LAST_ACTIVE_ORGANIZATION_ADMIN; changeRole doc
│               └── lucid_user_repository.ts               # changeRole → transaction + lockTargetAndActiveOrganizationAdmins
└── tests/
    ├── unit/users/role_change/
    │   ├── change_role.spec.ts                            # existing calls gain requestedByUserId; + self refusals
    │   └── final_admin.spec.ts                            # NEW — decision table rows 4–5, bystanders hidden in the global transaction
    └── integration/users/role_change/
        ├── change_role.spec.ts                            # + self refusals (lower/upper case, all roles), non-admin self → 403
        └── final_admin.spec.ts                            # NEW — refusal payload; concurrency group without global transaction, 50 rounds

apps/web/src/
├── components/layout/
│   ├── authenticated-layout.tsx                            # unauthenticated → resetSession + router.invalidate, once
│   └── __tests__/authenticated-layout/session-lost.test.tsx # NEW — a mid-visit 401 ends on /login, not a blank page
└── features/users/
    ├── mutations/use-user-mutations.ts                     # changeRole onError: + auth.me invalidation, comment corrected
    └── __tests__/role-change/
        ├── final-admin.test.tsx                            # NEW — demoted viewer, deactivated viewer, identity kept
        └── permissions.test.tsx                            # + no Role control on the viewer's own record

CONTEXT.md                                                   # User Role Change: + the two rules
```

**Structure Decision**: The existing vertical-slice layout on both sides, which GH-28 established
for this very command. The API refusals follow `DeactivateUserUseCase` (self check before the
repository, lower-cased) and `ApplyUserIdentityResult` (a cross-row condition reported by the
repository as a typed outcome). The locking read follows the ordered `forUpdate()` of
`lucid_warehouse_repository.ts`, at the lock strength of research D4. On the web, the users feature is edited
only in the mutation module, which already owns what each mutation refreshes. `edit-user-form.tsx`,
`users-page.tsx`, and `user-sheet.tsx` are not touched, and their existing behavior is what
[the workbench contract](./contracts/role-change-refusals-workbench.md) relies on. The one edit
outside the feature is `authenticated-layout.tsx`. It reuses `useLogout`'s reset-then-invalidate
sequence rather than adding a navigation of its own. A bare `<Navigate to="/login">` would loop:
the stale cached user would make `_guest` bounce the viewer straight back.

Implementation notes the tasks must carry:

- `use-user-mutations.ts` line 65 says GH-29 "refuses the case in the API, so this is
  belt-and-braces". That stops being the whole truth. The comment must say why a refusal now
  refetches the session too, rather than keep a rationale that no longer holds.
- GH-28's unit and integration tests call the use case and the endpoint without a requester. The use
  case input change makes the unit calls fail to typecheck until each passes `requestedByUserId`.
  That is intended, and it is where the self rule first goes RED.
- Any test that must observe the final admin rule has to hide the active organization admins left by
  other files, which share the in-memory database. The unit tests do it inside their global
  transaction. The concurrency group does it in `group.each.setup` and restores them in the cleanup
  function it returns, because a global transaction would put both requests on one PostgreSQL
  connection, and no lock could then contend (research D9).

## Phase 0 — Outline & Research

Complete. See [research.md](./research.md):

- D1: the self check in the use case, lower-cased and before any read.
- D2: the final admin rule as a typed repository outcome.
- D3: one locking read of the target and the active admins, in id order, and the four alternatives
  that fail.
- D4: `FOR NO KEY UPDATE` through `knexQuery`.
- D5: the promotion-while-waiting limit.
- D6: codes, messages, and precedence.
- D7: the seam GH-21 reuses.
- D8: one `auth.me` invalidation, and why the refused viewer is always stale.
- D9: verification seams, including the no-global-transaction concurrency group.
- D10: no migration, no ADR.

## Phase 1 — Design & Contracts

Complete.

- [data-model.md](./data-model.md) fixes the invariant, the decision table and its order, the
  locked scope, and the extended input, outcome, and exceptions.
- [contracts/change-user-role-guards.md](./contracts/change-user-role-guards.md) fixes the full
  failure table after this slice, the two error bodies, and the concurrency behavior, replacing
  GH-28's section.
- [contracts/role-change-refusals-workbench.md](./contracts/role-change-refusals-workbench.md) fixes
  the unchanged entry points FR-010 rests on, the refusal handling, and what a refusal refreshes.
- [quickstart.md](./quickstart.md) is the runnable proof: the suites, the scratch PostgreSQL run of
  the 50-round group, the curl checks, and the `psql`-staged collision for both a demotion and a
  deactivation.

### Constitution re-check after design

Re-evaluated against the artifacts above, and unchanged: all eight principles PASS. The design adds
no project, no table, and no ADR. The only new mechanism is one private locking helper, and the only
new client behavior is one refetch. The one planning consequence outside this directory's design
files is the spec revision to US3, FR-012, and SC-005, disclosed under principle III above.

## Next

Review the spec revision and this plan, then run `/speckit-tasks`.
