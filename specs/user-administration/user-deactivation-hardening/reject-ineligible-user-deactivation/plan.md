# Implementation Plan: Reject Ineligible User Deactivation

**Branch**: `whazzark/reject-ineligible-user-deactivation` | **Date**: 2026-09-10 | **Spec**:
[spec.md](./spec.md)

**Input**: Feature specification from
`specs/user-administration/user-deactivation-hardening/reject-ineligible-user-deactivation/spec.md`

## Summary

Give the user workbench its first write. The API gains one endpoint —
`POST /api/v1/users/:id/deactivate` — reserved to an active organization admin, which moves one
`ACTIVE` user to `DEACTIVATED`, records the date and the responsible administrator, and revokes the
deactivated user's remembered connections in the same transaction. Every other target is refused
with its own reason: `PENDING_INVITATION`, `CANCELLED_INVITATION`, `ALREADY_DEACTIVATED`,
`NOT_FOUND`, and `SELF` for the administrator's own access. The web gains a `Deactivate` action in
the access record's footer, behind a confirmation, wired to the collection query the workbench
already holds.

Two things carry most of the design weight. First, the refusal reasons are business outcomes, not
authorization outcomes: the policy decides only whether the viewer may deactivate users **at all**,
and the use case decides which user they may deactivate — the same split `UserPolicy.list` and
`ListUsersUseCase` already document. Second, concurrency and the sign-in cut are settled by one
guarded write: a conditional `UPDATE … WHERE access_status = 'ACTIVE'` inside a transaction that
also deletes the target's `remember_me_tokens`, exactly the mechanism
`LucidUserRepository.renewPassword` already uses and justifies.

The decisions and their rejected alternatives are in [research.md](./research.md); the state
transition and projections are in [data-model.md](./data-model.md); the two contracts are in
[contracts/](./contracts/).

## Technical Context

**Language/Version**: TypeScript 5.7 on Node 22, ESM throughout the PNPM/Turbo monorepo.

**Primary Dependencies**: AdonisJS 7.3 (Lucid 22, Bouncer 4, session auth with the cookie store),
VineJS 4 for validation, Tuyau for the typed API/web contract (ADR-0005), TanStack Start + Router +
Query, shadcn/Tailwind primitives, Sonner for toasts.

**Storage**: PostgreSQL. The `users` table already carries `access_status`, `deactivated_at`, and
`deactivated_by_user_id` — GH-2 delivered them, and `browse-and-filter-the-user-list` already reads
them. **No migration.**

**Testing**: Japa for the API — `unit` for the use case's decisions (repository swapped through the
container, as `ListUsersUseCase`'s spec already does) and for the repository's guarded write against
the real database per ADR-0014, `integration` for the HTTP authorization matrix, validation, payload,
and the session cut. Vitest + Testing Library + MSW for the web, rendering through the real router.
No `apps/web/e2e` directory exists, so this slice adds no end-to-end journey.

**Target Platform**: AdonisJS API server and a TanStack Start web application, both already deployed
from this monorepo.

**Project Type**: Web application — `apps/api` + `apps/web`.

**Performance Goals**: SC-001 — the new access status visible in the workbench within 2 seconds,
through one invalidation of the collection query already held. One request per deactivation; no new
read seam.

**Constraints**: FR-014 keeps the API authoritative; FR-013 requires that no session or remembered
connection outlive the deactivation; FR-018 requires exactly one successful deactivation under
concurrency; FR-019 forbids a partial change; the `toAdministration()` projection served by
`GET /api/v1/users` must not change shape, since the workbench renders the deactivated user from it.

**Scale/Scope**: one site, one organization, ≤ 200 users, one new endpoint, one new API workflow
slice, one new web mutation and one new web component, no schema change.

## Constitution Check

*GATE: passed before Phase 0 research, re-checked after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Selected feature intent is versioned | PASS — issue #20 is selected, its spec is written, its one material ambiguity was clarified (FR-009, self-deactivation) and reviewed before this plan. |
| II. One independently deliverable feature per spec | PASS — one outcome: an active user can lose access, and every ineligible target is refused. The API and web halves are one shippable write; GH-21 and GH-32 stay out (FR-020). |
| III. Vanilla Spec Kit gates | PASS — spec reviewed before planning; this plan awaits human review before `speckit-tasks`. Two behavioral details surfaced during design (D5 malformed identifier, D9 what the record does after success); both are already covered by FR-008 and FR-016 and needed no spec change. |
| IV. Test-first observable behavior | PASS — RED → GREEN → REFACTOR on the six outcomes of the command, then on the workbench journeys. Every acceptance scenario maps to a Japa or Vitest seam (D12). |
| V. Deep boundaries and explicit contracts | PASS — policy authorizes coarsely, use case owns the eligibility and self rules, repository owns the guarded write and the token revocation, controller adapts HTTP and validates the route parameter, transformer owns the projection, and the users feature module owns the confirmation and the toast. No cross-layer shortcut (D1, D3). |
| VI. Durable knowledge has a home | PASS — vocabulary is read from `CONTEXT.md` (User Deactivation, User Access Status Change, Organization Admin) rather than restated. No new ADR: API ADR-0013 already fixes the use-case/repository split, the typed conditional outcome, and the `Input`/`Command`/`Result` naming this slice follows — it even names `NOT_ACTIVE` as an example outcome. |
| VII. Verification is part of delivery | PASS — `pnpm check`, `pnpm typecheck`, `pnpm test`, and the browser journeys in [quickstart.md](./quickstart.md) before the PR is ready, then a fresh read-only review of the final diff. |
| VIII. One workflow owner | PASS — no new state machine. The access status is data on `users`, not an orchestrator. |

No violation to justify; **Complexity Tracking is empty**.

## Project Structure

### Documentation (this feature)

```text
specs/user-administration/user-deactivation-hardening/reject-ineligible-user-deactivation/
├── spec.md
├── plan.md                          # This file
├── research.md                      # Phase 0 — decisions and rejected alternatives
├── data-model.md                    # Phase 1 — the one state transition and what it writes
├── quickstart.md                    # Phase 1 — how to run and prove the feature
├── contracts/
│   ├── deactivate-user.md           # POST /api/v1/users/:id/deactivate
│   └── user-deactivation-action.md  # The workbench action's observable contract
├── checklists/requirements.md
└── tasks.md                         # Phase 2 — produced by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── users/
│   │   ├── deactivate/
│   │   │   ├── deactivate_user_use_case.ts           # NEW — eligibility, self rule, actor/date
│   │   │   └── deactivate_user_validator.ts          # NEW — the :id route parameter (D5)
│   │   └── shared/
│   │       ├── user_exceptions.ts                    # NEW — the five refusal reasons
│   │       ├── user_policy.ts                        # + deactivate()
│   │       ├── repositories/user_repository.ts       # + findById(), deactivateActive()
│   │       └── repositories/lucid_user_repository.ts # + guarded write, token revocation
│   └── controllers/users_controller.ts               # + deactivate
├── start/routes.ts                                    # + POST /users/:id/deactivate
└── tests/
    ├── unit/users/deactivation/deactivate.spec.ts     # NEW — the six outcomes
    ├── unit/users/deactivation/guarded_write.spec.ts   # NEW — the conditional update and revocation
    └── integration/users/deactivation/deactivate.spec.ts # NEW — authorization, payload, session cut

apps/web/
└── src/features/users/
    ├── mutations/use-user-mutations.ts               # NEW — deactivate + collection invalidation
    ├── helpers/user-access-copy.ts                   # NEW — action-keyed copy over resource-copy
    ├── ui/user-access-actions.tsx                    # NEW — button, confirmation, toasts
    ├── ui/user-access-record.tsx                     # + footer carrying the action
    └── __tests__/deactivate/                          # journey, permissions, refusals, recovery
```

**Structure Decision**: the existing vertical-slice layout on both sides — a new API workflow slice
under `app/users/deactivate` with its validator, alongside the shared policy, exceptions,
repository, and transformer it extends, and the existing web feature module under
`src/features/users` gaining its first `mutations/` directory. This mirrors the delivered dock and
truck lifecycle slices on the API side, and the delivered users workbench on the web side. The one
deliberate divergence from the site-reference precedent is that the web action does **not** go
through `components/lifecycle` — see D8.

## Phase 0 — Outline & Research

Complete. See [research.md](./research.md): D1 the policy/use-case split for the refusal reasons, D2
the HTTP shape of each refusal, D3 the guarded write and what makes concurrency safe, D4 revoking
remembered connections inside the same transaction, D5 the malformed identifier, D6 what the
endpoint returns, D7 the web mutation and cache invalidation, D8 why the action does not reuse the
site-reference lifecycle components, D9 what the open record does after a success, D10 who sees the
action, D11 the seeded dataset's limits for manual verification, D12 the verification seams.

## Phase 1 — Design & Contracts

Complete. [data-model.md](./data-model.md) fixes the single state transition, the columns it writes,
and the rows it deletes; [contracts/deactivate-user.md](./contracts/deactivate-user.md) fixes the
endpoint, its authorization matrix, its six outcomes, and its payload;
[contracts/user-deactivation-action.md](./contracts/user-deactivation-action.md) fixes the
workbench action's observable contract; [quickstart.md](./quickstart.md) is the runnable validation
guide.

**Post-design Constitution re-check**: PASS, unchanged. The design adds no layer, no dependency, no
migration, and no state machine. It adds one endpoint, one use case, one guarded repository
operation, and one web component, each inside a boundary the codebase already owns.

## Complexity Tracking

No Constitution Check violation. Nothing to justify.
