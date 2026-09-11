# Implementation Plan: Remove a Never-Activated User Permanently

**Branch**: `whazzark/remove-a-never-activated-user-permanently` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`specs/user-administration/invitation-administration/remove-a-never-activated-user-permanently/spec.md`

## Summary

Let an organization admin permanently remove a pending or cancelled user, on both seams. The API
gains one endpoint — `DELETE /api/v1/users/:id`, answering `204` — authorized by a new
`UserPolicy.remove` and applied by a single guarded `DELETE` whose `WHERE access_status IN
('PENDING', 'CANCELLED')` is both the eligibility rule and the concurrency control. The schema's
existing `ON DELETE CASCADE` takes the activation link with the user, and its `RESTRICT` on a
shift's responsible user becomes a named refusal. The web gains no route and no screen: `remove`
becomes the second access action of the record footer and the row menu, behind the existing
`UserAccessDialog`.

The slice is small because two clarifications removed work: FR-012 made the removal untraced, so
there is no migration, no trace table, and nothing to project after the fact; FR-017 settled on a
single confirmation, so the existing access dialog is reused as is.

Design decisions and their rejected alternatives are in [research.md](./research.md); the eligibility
matrix, what one removal deletes, and the typed outcome in [data-model.md](./data-model.md); the two
seams in [contracts/](./contracts/); how to run and prove it in [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript — 5.7 in `apps/api`, 5.9 in `apps/web` — on Node 25 in CI, ESM
throughout the PNPM/Turbo monorepo (`apps/*`).

**Primary Dependencies**: AdonisJS 7 (Lucid, Bouncer, VineJS, session auth), Tuyau for the typed
API/web contract, TanStack Start + Router + Query, shadcn/Tailwind primitives (`AlertDialog`,
`DropdownMenu`), `sonner` toasts.

**Storage**: PostgreSQL in production, SQLite with `foreign_keys = ON` in the test suites (ADR 0014).
The foreign keys this slice relies on are already declared. **No migration.**

**Testing**: Japa for the API (`unit` and `integration` suites, with `UserFactory`,
`UserActivationTokenFactory`, and `ShiftFactory`); Vitest + Testing Library + MSW for the web,
rendering through the real router. No `apps/web/e2e` directory exists, so no end-to-end journey.

**Target Platform**: AdonisJS API server and a TanStack Start web application, both deployed from
this monorepo.

**Project Type**: Web application — `apps/api` + `apps/web`.

**Performance Goals**: SC-005 — the removal reflected within 2 seconds in 95% of attempts, in at most
3 interactions from the list. One indexed single-row `DELETE` plus one collection refetch over at
most a few hundred users.

**Constraints**: FR-005 requires eligibility judged at execution; FR-009 requires all or nothing;
FR-011 requires a restricting reference to be refused rather than break; FR-012 forbids any trace;
FR-015 requires the refusal ordering that keeps a 403 uninformative; the `204` must stay consumable
by the Tuyau client, as `auth.logout`'s already is.

**Scale/Scope**: one site, one organization, ≤ 200 users; one endpoint, one use case, one policy
method, one repository operation, one database helper, one web mutation, one new access action. No
schema change.

## Constitution Check

*GATE: passed before Phase 0 research, re-checked after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Selected feature intent is versioned | PASS — issue #14 is selected; its spec was rewritten from the placeholder, clarified on 2026-09-11, and is the contract this plan implements. |
| II. One independently deliverable feature per spec | PASS — one outcome: a never-activated user can be removed. The API and web halves are two seams of one command. It does not wait on GH-12: cancelled users already exist in the schema. |
| III. Vanilla Spec Kit gates | PASS — both material ambiguities (trace, confirmation) were clarified in the spec rather than decided here; this plan awaits human review before `speckit-tasks`. |
| IV. Test-first observable behavior | PASS — RED → GREEN → REFACTOR on the eligibility matrix, the cascade, the restricting reference, and the authorization matrix, then on the workbench journeys. Every acceptance scenario maps to a Japa or Vitest seam (research D9). |
| V. Deep boundaries and explicit contracts | PASS — the policy authorizes the viewer, the use case maps typed outcomes to named exceptions, the repository owns the guarded write and the classification of its failures, the controller adapts HTTP, and the web feature module owns screen behaviour. No cross-layer shortcut. |
| VI. Durable knowledge has a home | PASS — Pending User Removal is read from `CONTEXT.md`, not restated. No ADR: the first `DELETE` route follows REST semantics already implied by ADR 0005 and needs no new decision. |
| VII. Verification is part of delivery | PASS — `pnpm check`, `pnpm typecheck`, `pnpm test`, and the walkthrough in [quickstart.md](./quickstart.md), then a fresh read-only review of the final diff. |
| VIII. One workflow owner | PASS — no new state machine; Spec Kit owns the artifacts, GitHub owns status. |

No violation to justify; **Complexity Tracking is empty**.

## Project Structure

### Documentation (this feature)

```text
specs/user-administration/invitation-administration/remove-a-never-activated-user-permanently/
├── spec.md
├── plan.md                          # This file
├── research.md                      # Phase 0 — D1..D9, decisions and rejected alternatives
├── data-model.md                    # Phase 1 — eligibility, what one removal deletes, typed outcome
├── quickstart.md                    # Phase 1 — how to run and prove the feature
├── contracts/
│   ├── remove-user.md               # DELETE /api/v1/users/:id
│   └── remove-action.md             # the Remove access action in the /users workbench
├── checklists/requirements.md
└── tasks.md                         # Phase 2 — produced by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── shared/database/
│   │   └── is_foreign_key_violation.ts              # NEW — PostgreSQL 23503, SQLite FOREIGNKEY
│   ├── users/
│   │   ├── removal/
│   │   │   ├── remove_user_use_case.ts               # NEW — maps typed outcomes to exceptions
│   │   │   ├── remove_user_validator.ts              # NEW — params.id as a UUID
│   │   │   └── removal_exceptions.ts                 # NEW — active, deactivated, referenced
│   │   └── shared/
│   │       ├── user_policy.ts                        # + remove
│   │       ├── repositories/user_repository.ts       # + removeNeverActivated, command and result
│   │       └── repositories/lucid_user_repository.ts # + guarded DELETE, zero-row re-read, FK catch
│   └── controllers/users_controller.ts               # + destroy → 204
├── start/routes.ts                                   # + router.delete('/:id').as('destroy')
├── .adonisjs/client/registry/*                       # regenerated — users.destroy
├── .adonisjs/server/routes.d.ts                      # regenerated
└── tests/
    ├── unit/users/removal/remove.spec.ts              # NEW — eligibility, cascade, isolation, reference, races
    └── integration/users/removal/remove.spec.ts       # NEW — authorization matrix, refusals, 204, re-invitation

apps/web/
└── src/features/users/
    ├── helpers/user-access-copy.ts                   # + 'remove' labels, effect, refusal reasons
    ├── mutations/use-user-mutations.ts               # + remove, refresh on success and error
    ├── user-access.tsx                               # userAccessActions + remove; dialog picks mutation
    └── __tests__/removal/                            # NEW — journey, row-menu, permissions, refusals, recovery
```

`ui/user-row-actions.tsx`, `ui/user-access-actions.tsx`, and `ui/user-access-record.tsx` need no
change: all three render whatever `userAccessActions` returns, with its variant and label, and the
record renders its footer as soon as that list is non-empty — which it now is for pending and
cancelled users.

**Structure Decision**: the existing vertical-slice layout on both sides — an API workflow slice under
`app/users/removal` with its use case, validator, and exceptions, and the policy and repository
operation in `app/users/shared`, as `password_reset` is laid out; the web change inside the delivered
`src/features/users` module, extending the access-action mechanism `deactivate` introduced rather
than adding a parallel one.

## Phase 0 — Outline & Research

Complete. See [research.md](./research.md): D1 the first `DELETE` route and its `204`, D2 the policy,
D3 the refusal taxonomy and why self-removal and a second removal need no code, D4 the guarded
`DELETE` as eligibility and concurrency control, D5 the three groups of foreign keys and why only one
needs handling, D6 refusing a restricting reference, D7 the use case's actorless input, D8 the web
action as a second access action, D9 verification seams.

## Phase 1 — Design & Contracts

Complete. [data-model.md](./data-model.md) fixes the eligibility matrix, the rows one removal
deletes, and `RemoveUserResult`; [contracts/remove-user.md](./contracts/remove-user.md) fixes the
endpoint, its authorization ordering, and every status it can return;
[contracts/remove-action.md](./contracts/remove-action.md) fixes where the action is offered, the
confirmation, and every outcome the administrator can see; [quickstart.md](./quickstart.md) is the
runnable proof, including the walkthrough and the curl checks for refusals the interface never
offers.

### Constitution re-check after design

Re-evaluated against the artifacts above: unchanged, all eight principles PASS. The design added no
project, no table, no ADR, and no cross-layer shortcut. Its one new shared abstraction,
`is_foreign_key_violation.ts`, mirrors `is_unique_violation.ts` and keeps database error codes out of
the repository body.

## Next

`/speckit-tasks` after human review of this plan.
