# Implementation Plan: Update Another User Identity

**Branch**: `whazzark/update-another-user-identity` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`specs/user-administration/user-identity-update/update-another-user-identity/spec.md`

## Summary

Turn the read-only user workbench into one that can repair an identity. The API gains a single write
— `PATCH /api/v1/users/:id` — reserved to an active organization admin acting on someone other than
themselves: it validates the first name, last name, and email, keeps the address unique across the
organization, applies the three columns and an immutable history row in one transaction, and touches
nothing else about the user. A new `user_identity_changes` table gives FR-013 the cumulative,
attributed history the clarification asked for, exposed through the existing `toAdministration()`
projection under the gate that already withholds the access history from anyone but an organization
admin. The web gains `mode=edit` on the existing `/users` route, an edit panel inside the record
sheet, and the identity history under the access history.

One branch of FR-015 is deliberately delivered as a refusal: correcting a **pending** user's email
address must re-issue their activation link, and no activation link mechanism exists until GH-7. The
use case calls an `ActivationLinkIssuer` port inside its transaction and rolls the whole correction
back when the port cannot serve — which is exactly what FR-015 prescribes for a failed issue. See
[research.md](./research.md) D7; this is the item to confirm at the plan review gate.

Decisions and rejected alternatives are in [research.md](./research.md); the table, relations, and
projection are in [data-model.md](./data-model.md); the two seams are in [contracts/](./contracts/).

## Technical Context

**Language/Version**: TypeScript 5.7 on Node 22, ESM throughout the PNPM/Turbo monorepo.

**Primary Dependencies**: AdonisJS 7 (Lucid, Bouncer, VineJS, session auth), Tuyau for the typed
API/web contract (ADR-0005), TanStack Start + Router + Query, `useAppForm` and the shadcn/Tailwind
primitives, Zod for route search-param validation.

**Storage**: PostgreSQL. One new table, `user_identity_changes`; no change to `users`, whose
`users_email_unique` index on `LOWER(email)` already enforces FR-010.

**Testing**: Japa for the API — `unit` for the repository outcomes and use-case decisions, SQLite per
ADR-0014, and `integration` for the endpoint's authorization matrix and response shape. Vitest +
Testing Library + MSW for the web, rendering through the real router. No `apps/web/e2e` directory
exists, so the browser pass is the manual one in [quickstart.md](./quickstart.md).

**Target Platform**: AdonisJS API server and a TanStack Start web application from this monorepo.

**Project Type**: Web application — `apps/api` + `apps/web`.

**Performance Goals**: SC-003 — an accepted correction confirmed within 2 seconds. One request, one
transaction, one locked row, one cache invalidation.

**Constraints**: GH-4's FR-006a forbids a per-user consultation seam, so the history rides the
collection; FR-006 keeps the API authoritative; FR-011 forbids touching role, access status, lifecycle
columns, credentials, sessions, and remembered connections; the `toObject()` session contract behind
`/auth/me` and `/auth/login` must not change; ADR-0003 means there is one organization, so FR-007 is
satisfied by construction (D9).

**Scale/Scope**: one site, one organization, ≤ 200 users; one new endpoint, one migration, one new
table and model, one new use case, one new port, one new web mode, one new panel, one new form.

## Constitution Check

*GATE: passed before Phase 0 research, re-checked after Phase 1 design — see the re-check below.*

| Principle | Assessment |
|---|---|
| I. Selected feature intent is versioned | PASS — issue #24 is selected, its spec is written, clarified, and reviewed, and is the contract this plan implements. |
| II. One independently deliverable feature per spec | PASS — one outcome: an administrator can repair another user's identity. The API and web seams are two halves of one shippable write. The activation-link *mechanism* stays in GH-7 (D7); self-service stays in GH-25. |
| III. Vanilla Spec Kit gates | PASS — spec reviewed before this plan; this plan awaits human review before `speckit-tasks`. The one place where delivery is narrower than the spec's happy path is stated, not silently implemented. |
| IV. Test-first observable behavior | PASS — RED → GREEN → REFACTOR in the order of D12; every acceptance scenario maps to a Japa or Vitest seam. |
| V. Deep boundaries and explicit contracts | PASS — policy authorizes, use case decides and coordinates the transaction, repository owns the lock and the conditional write with typed outcomes, controller adapts HTTP, transformer owns the projection, the web feature module owns screen behavior behind a thin route (ADR-0013, ADR-0007, ADR-0008). |
| VI. Durable knowledge has a home | PASS — `User Identity Update` is already defined in `CONTEXT.md` and is not restated. No new ADR: the table, the port, and the panel all follow patterns the repository has already decided. If GH-7 later replaces the port's binding, that is its decision to record, not this one's. |
| VII. Verification is part of delivery | PASS — `pnpm check`, `pnpm typecheck`, `pnpm test`, and the browser pass in [quickstart.md](./quickstart.md) before the PR is ready, then a fresh read-only review of the final diff. |
| VIII. One workflow owner | PASS — no new state machine; Spec Kit owns the artifacts, GitHub owns status. |

**Post-design re-check**: unchanged. The Phase 1 design adds one table, one port, and one route, all
inside existing patterns. No principle is bent, and **Complexity Tracking is empty**.

## Project Structure

### Documentation (this feature)

```text
specs/user-administration/user-identity-update/update-another-user-identity/
├── spec.md
├── plan.md                          # This file
├── research.md                      # Phase 0 — D1…D12, decisions and rejected alternatives
├── data-model.md                    # Phase 1 — the new table, relations, projection
├── quickstart.md                    # Phase 1 — how to run and prove the feature
├── contracts/
│   ├── patch-user-identity.md       # PATCH /api/v1/users/:id
│   └── users-workbench.md           # /users URL, panel, form, history
├── checklists/requirements.md
└── tasks.md                         # Phase 2 — produced by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
apps/api/
├── database/migrations/
│   └── 1785700000000_create_user_identity_changes_table.ts   # NEW
├── app/
│   ├── models/
│   │   ├── user.ts                                            # + hasMany identityChanges
│   │   └── user_identity_change.ts                            # NEW
│   ├── users/
│   │   ├── identity/
│   │   │   └── update_user_identity_use_case.ts               # NEW — decisions + transaction
│   │   └── shared/
│   │       ├── user_policy.ts                                 # + updateIdentity
│   │       ├── user_exceptions.ts                             # NEW — D8's five exceptions
│   │       ├── user_validator.ts                              # NEW — updateUserIdentityValidator
│   │       ├── normalize_user_identity.ts                     # NEW — trim + name rules
│   │       ├── activation_link_issuer.ts                      # NEW — port + unavailable binding
│   │       ├── repositories/user_repository.ts                # + findByIdForUpdate, applyIdentity
│   │       ├── repositories/lucid_user_repository.ts          # + locked transaction, preloads
│   │       └── transformers/user_transformer.ts               # + identityChanges on toAdministration
│   └── controllers/users_controller.ts                        # + update
├── providers/repositories_provider.ts                          # + ActivationLinkIssuer binding
├── database/factories/user_factory.ts                         # + identity-change factory
├── start/routes.ts                                            # + users.update
└── tests/
    ├── unit/users/identity/
    │   ├── update_user_identity.spec.ts                       # NEW — use-case decisions
    │   └── identity_history.spec.ts                           # NEW — repository outcomes, SQLite
    └── integration/users/identity/
        └── update.spec.ts                                     # NEW — authorization matrix, payload

apps/web/
└── src/
    ├── routes/_authenticated/users.tsx                        # + mode, transform
    └── features/users/
        ├── mutations/use-user-mutations.ts                    # NEW
        ├── ui/user-sheet.tsx                                  # + mode switch
        ├── ui/user-access-record.tsx                          # + Edit entry point, history block
        ├── ui/user-identity-history.tsx                       # NEW
        ├── ui/edit-user-identity-panel.tsx                    # NEW
        ├── ui/user-identity-form.tsx                          # NEW
        └── __tests__/identity/
            ├── edit.test.tsx                                  # NEW — journey, refusals, retry
            └── permissions.test.tsx                           # NEW — who is offered the action
```

**Structure Decision**: the existing vertical-slice layout, unchanged. The API gains one workflow
slice, `app/users/identity/`, beside the existing `app/users/list/`, with everything shared by the
domain under `app/users/shared/` — the shape `app/trucks/` already has. The web gains a `mutations/`
directory in `features/users/`, which `features/trucks/` already demonstrates, and keeps the route
file thin.

## Phase sequence

1. **Migration, model, factory** — `user_identity_changes`, its relations, and a factory, so every
   later test has a realistic scenario to persist.
2. **Repository** — the locked read and the conditional write, with typed outcomes (`UPDATED`,
   `NOT_FOUND`, `EMAIL_TAKEN`) and the history insert. RED first, against SQLite.
3. **Domain rules** — `normalize_user_identity`, `user_exceptions`, the `ActivationLinkIssuer` port
   and its unavailable binding.
4. **Use case** — self-exclusion, the unchanged-submission short circuit, the pending-email branch,
   the mapping from outcomes to exceptions.
5. **Policy, validator, controller, route** — then the integration suite's authorization matrix.
6. **Projection** — `identityChanges` on `toAdministration()`, its preloads, and the proof that an
   operations admin's payload is unchanged.
7. **Web** — route parameter and transform, mutation hook, edit panel and form, entry-point gating,
   history block, then the feature tests.
8. **Verification** — `pnpm check`, `pnpm typecheck`, `pnpm test`, the browser pass, fresh review.

## Review gate

**Confirmed on 2026-09-10.** FR-015's pending-user branch cannot be delivered as a success until GH-7
ships (D7), and the product owner confirmed the fail-closed design: the use case calls the
`ActivationLinkIssuer` port inside its transaction and rolls the whole correction back when the port
cannot serve, which is what FR-015 prescribes for a failed issue. Until GH-7 ships, correcting a
pending user's email address answers `409 E_USER_ACTIVATION_LINK_UNAVAILABLE`; their name stays
correctable, and every other access status is unaffected.

GH-7 is **not** recorded as a GitHub issue dependency on #24, deliberately: this slice ships without
it. When GH-7 lands, the only change here is the port's binding in `repositories_provider.ts`.

The plan is approved for `/speckit-tasks`.

## Delivered

Implemented on 2026-09-10 against this plan. Two shape refinements are recorded where they belong —
the repository's two operations in [research.md](./research.md) D5, and the corrected `401`/`403`
rows in [contracts/patch-user-identity.md](./contracts/patch-user-identity.md), since a viewer whose
access is not active is refused by `middleware.auth()` before any policy runs. Every other decision
landed as written.

Verification: `pnpm check` and `pnpm typecheck` clean; 438 API unit tests and 599 API integration
tests green; 75 users web tests green. The browser pass and the fresh read-only review are the
operator's, and are recorded as not run in [tasks.md](./tasks.md).

## Complexity Tracking

No constitution violation to justify. This section is intentionally empty.
