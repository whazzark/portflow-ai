# Implementation Plan: Change Another Eligible User Role

**Branch**: `whazzark/change-another-eligible-user-role` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`specs/user-administration/user-role-change/change-another-eligible-user-role/spec.md`

## Revisions — 2026-09-11

Rebased on GH-24 (#293), which delivered an `Edit` panel on the user record under the same
`mode=edit` this plan reserved for the role panel:

- **The role is a field of the `Edit` panel**, not a panel of its own. `change-user-role-panel.tsx`
  is gone; GH-24's panel and form are renamed `EditUserPanel` / `EditUserForm` and carry the role, and
  `users-page.tsx` sends each change to its own endpoint. The record keeps no `Change role` action.
  The route adds no `mode` of its own: GH-24's `create | edit | view` is reused as is.
  [research.md](./research.md) D9 is replaced, and
  [contracts/role-change-action.md](./contracts/role-change-action.md) describes the delivered
  panel.
- **A malformed id is refused with a 422.** `changeUserRoleValidator` checks `params.id` as a UUID,
  as GH-24's and the deactivation validators do, so PostgreSQL never answers `22P02` with a 500.

## Summary

Give an organization admin one way to change another user's responsibility level, on both seams. The
API gains a single endpoint — `PATCH /api/v1/users/:id/role` — authorized by a new
`UserPolicy.changeRole` that admits organization admins only, and applied by a guarded conditional
`UPDATE` that refuses a deactivated target and accepts a pending, active, or cancelled one. The web
gains no route and no screen: the `/users` workbench gains an `edit` mode on the record it already
opens, a role `Select` built from the shared form primitives, and one mutation that invalidates the
collection.

The slice is small for one reason worth stating up front: FR-016 resolved role change traceability to
"untraced", which removes the migration, the model change, the transformer change, and the access
record section that a recorded history would have required. `users` is not altered at all — one
existing column changes value.

Design decisions and their rejected alternatives are in [research.md](./research.md); the columns and
typed outcomes in [data-model.md](./data-model.md); the two seams in
[contracts/](./contracts/); how to run and prove it in [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript — 5.7 in `apps/api`, 5.9 in `apps/web` — on Node 25 in CI, ESM throughout the PNPM/Turbo monorepo (`apps/*`).

**Primary Dependencies**: AdonisJS 7 (Lucid, Bouncer, VineJS, session auth), Tuyau for the typed
API/web contract (ADR-0005), TanStack Start + Router + Query, TanStack Form behind the project's
`useAppForm` wrapper, shadcn/Tailwind primitives, Zod for route search-param validation.

**Storage**: PostgreSQL (ADR-0002). The `users` table already carries every column this feature reads
and writes. **No migration.**

**Testing**: Japa for the API (`unit` and `integration` suites, with `UserFactory` for persisted
scenarios); Vitest + Testing Library + MSW for the web, rendering through the real router. No
`apps/web/e2e` directory exists, so this slice adds no end-to-end journey.

**Target Platform**: AdonisJS API server and a TanStack Start web application, both already deployed
from this monorepo.

**Project Type**: Web application — `apps/api` + `apps/web`.

**Performance Goals**: SC-005 — the new role visible within 2 seconds of submitting, in 95% of
attempts. One write plus one cache invalidation over a collection of at most a few hundred users; no
per-user read is introduced.

**Constraints**: FR-005 confines the write to `role` and `updated_at`; FR-008 keeps the API
authoritative for authorization; FR-009 requires the refusal ordering that keeps a 403 uninformative;
FR-016 forbids recording the change; FR-017 forbids touching a pending user's invitation; the
`toObject()` session contract behind `/auth/me` and `/auth/login` must not change.

**Scale/Scope**: one site, one organization (ADR-0003), ≤ 200 users, one new endpoint, one new use
case, one new policy method, one new repository operation, one new web mutation and panel, no schema
change.

## Constitution Check

*GATE: passed before Phase 0 research, re-checked after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Selected feature intent is versioned | PASS — issue #28 is selected, its spec was written, clarified, and reviewed, and is the contract this plan implements. |
| II. One independently deliverable feature per spec | PASS — one outcome: an eligible user's role becomes changeable. The API and web halves are two seams of one shippable command. The guards are GH-29's and stay out (FR-018). |
| III. Vanilla Spec Kit gates | PASS — spec reviewed before this plan; this plan awaits human review before `speckit-tasks`. Both material ambiguities were resolved in the spec rather than invented here. |
| IV. Test-first observable behavior | PASS — RED → GREEN → REFACTOR on the eligibility matrix and the authorization matrix, then on the workbench journeys. Every acceptance scenario maps to a Japa or Vitest seam (research D10). |
| V. Deep boundaries and explicit contracts | PASS — the policy authorizes the viewer, the use case owns the refusal decisions and their named exceptions, the repository owns the conditional write and its typed outcome, the controller adapts HTTP, the transformer owns the projection, and the web feature module owns screen behavior behind a thin route. No cross-layer shortcut. |
| VI. Durable knowledge has a home | PASS — role vocabulary is read from `CONTEXT.md`, not restated. No new ADR: the feature introduces no durable architectural decision beyond the existing patterns. |
| VII. Verification is part of delivery | PASS — `pnpm check`, `pnpm typecheck`, `pnpm test`, and the workbench walkthrough in [quickstart.md](./quickstart.md) before the PR is ready, then a fresh read-only review of the final diff. |
| VIII. One workflow owner | PASS — no new state machine; Spec Kit owns the artifacts, GitHub owns status. |

No violation to justify; **Complexity Tracking is empty**.

**One risk to carry, not a violation**: this slice ships a command whose two guards arrive with
GH-29. Principle II is satisfied — the command is independently deliverable and independently
valuable — but delivery sequencing is not, and the spec, the checklist, and
[quickstart.md](./quickstart.md) all record that GH-29 must land before the action reaches production
users.

## Project Structure

### Documentation (this feature)

```text
specs/user-administration/user-role-change/change-another-eligible-user-role/
├── spec.md
├── plan.md                          # This file
├── research.md                      # Phase 0 — D1..D10, decisions and rejected alternatives
├── data-model.md                    # Phase 1 — the one written column, eligibility, typed outcomes
├── quickstart.md                    # Phase 1 — how to run and prove the feature
├── contracts/
│   ├── change-user-role.md          # PATCH /api/v1/users/:id/role
│   └── role-change-action.md        # /users URL state and the workbench action
├── checklists/requirements.md
└── tasks.md                         # Phase 2 — produced by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── users/
│   │   ├── role_change/
│   │   │   └── change_user_role_use_case.ts             # NEW — maps typed outcomes to exceptions
│   │   └── shared/
│   │       ├── user_exceptions.ts                       # NEW — not found, deactivated
│   │       ├── user_validator.ts                        # NEW — changeUserRoleValidator
│   │       ├── user_policy.ts                           # + changeRole
│   │       ├── repositories/user_repository.ts          # + changeRole, command and result types
│   │       └── repositories/lucid_user_repository.ts    # + guarded UPDATE, re-read with preloads
│   └── controllers/users_controller.ts                  # + changeRole
├── start/routes.ts                                       # + users.change_role
└── tests/
    ├── unit/users/role_change/change_role.spec.ts        # NEW — eligibility, idempotence, isolation
    └── integration/users/role_change/change_role.spec.ts # NEW — authorization matrix, payload, refusals

apps/web/
└── src/
    ├── routes/_authenticated/users.tsx                   # unchanged — GH-24's `mode` is reused
    └── features/users/
        ├── helpers/user-labels.ts                        # + role select options
        ├── mutations/use-user-mutations.ts               # + changeRole + invalidation
        ├── ui/users-page.tsx                             # + saveUser: each change to its own seam
        ├── ui/edit-user-panel.tsx                        # GH-24's panel, renamed; now carries the role
        ├── ui/edit-user-form.tsx                         # GH-24's form, renamed; + role, read-only when deactivated
        └── __tests__/role-change/                        # NEW — change, permissions, refusals, recovery, session
```

**Structure Decision**: the existing vertical-slice layout on both sides — an API workflow slice under
`app/users/role_change` with its policy, validator, exceptions, and repository operation in
`app/users/shared`, and the web change inside the delivered `src/features/users` module behind the
thin `/users` route. The API slice mirrors `app/trucks/suspend`, the closest equivalent guarded write;
the web change mirrors the customers edit panel, which is the form and detail-panel contract
`apps/web/AGENTS.md` codifies.

`user-access-record.tsx` opens with a comment the implementation must correct rather than leave
lying — "Read-only by design: this feature offers no invitation, cancellation, deactivation,
reactivation, role change, or identity update (FR-016)". It was true of GH-4 and stops being true
here; the FR number it cites is GH-4's, not this spec's.

## Phase 0 — Outline & Research

Complete. See [research.md](./research.md): D1 endpoint shape and the GH-24 collision it avoids, D2
policy narrower than `list`, D3 refusal taxonomy and structural non-disclosure, D4 the conditional
`UPDATE` as concurrency control, D5 no migration and what that costs, D6 the write's exact payload,
D7 the response projection, D8 why FR-010/FR-011 need tests rather than code, D9 the web module shape
and its URL state, D10 verification seams.

## Phase 1 — Design & Contracts

Complete. [data-model.md](./data-model.md) fixes the eligibility matrix, the one written column, and
the repository's typed outcome; [contracts/change-user-role.md](./contracts/change-user-role.md)
fixes the endpoint, its authorization ordering, and every status it can return;
[contracts/role-change-action.md](./contracts/role-change-action.md) fixes the `mode` search
parameter, the gating rule, the form's primitives, and what a success invalidates;
[quickstart.md](./quickstart.md) is the runnable proof, including the nine-step manual walkthrough and
the curl checks for the refusals the interface cannot demonstrate.

### Constitution re-check after design

Re-evaluated against the artifacts above: unchanged, all eight principles PASS. The design added no
project, no table, no ADR, and no cross-layer shortcut; the only new abstraction is one repository
operation with a typed outcome, which principle V requires rather than merely permits.

## Next

`/speckit-tasks` after human review of this plan.
