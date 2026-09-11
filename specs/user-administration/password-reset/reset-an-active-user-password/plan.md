# Implementation Plan: Reset an Active User Password

**Branch**: `whazzark/reset-an-active-user-password` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/user-administration/password-reset/reset-an-active-user-password/spec.md`

## Summary

An organization admin requires an active user to choose a new password. The command records the
password renewal requirement that `#117` already enforces, records who reset and when, and revokes
every remembered connection the target holds — in one transaction, so a partial state is impossible.
Live sessions are left standing and are confined at their next request by the middleware that
already exists.

Nothing about the renewal step, its validation, or its confinement changes. This slice adds one
write to `apps/api` and one action to the user workbench in `apps/web`; the enforcement half is
already delivered and is reused as-is.

## Technical Context

**Language/Version**: TypeScript 5.7 on Node 22, ESM throughout

**Primary Dependencies**: AdonisJS 7 (`@adonisjs/lucid` 22, `@adonisjs/bouncer` 4, `@adonisjs/auth` 10, VineJS 4) in `apps/api`; TanStack Start + React 19, TanStack Query, TanStack Router, Tuyau client, shadcn/base-ui primitives in `apps/web`

**Storage**: PostgreSQL in production, better-sqlite3 in tests; Lucid migrations under `apps/api/database/migrations`

**Testing**: Japa (`unit` and `integration` suites) in `apps/api`; Vitest + Testing Library + MSW in `apps/web`

**Target Platform**: Linux server API, browser workstation

**Project Type**: PNPM/Turbo monorepo, `apps/api` + `apps/web`, vertical slices on both sides

**Performance Goals**: The reset is a single-user administrative write; SC-007's 2-second budget is met by invalidating the existing user collection query, with no new read seam

**Constraints**: The API stays the authorization authority (constitution V, ADR 0005). No cross-layer shortcut: the use case owns the business decision, the repository owns the guarded write, the controller owns HTTP adaptation. Passwords and tokens never leave the API.

**Scale/Scope**: Up to ~200 users in the collection (the assumption `#4` already delivers against); one new endpoint, one new migration, one new use case, one new web mutation and confirmation.

## Constitution Check

*GATE: passed before Phase 0, re-checked after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Selected feature intent is versioned | `#17` is selected, `spec.md` is approved and is the contract this plan implements. **PASS** |
| II. One independently deliverable feature per spec | One outcome — an administrator records the requirement — shipping as one issue, one directory, one branch, one PR, API and web together. **PASS** |
| III. Vanilla Spec Kit gates | Spec reviewed before this plan; this plan is reviewed before `/speckit-tasks`. Both spec clarifications were resolved explicitly rather than invented. **PASS** |
| IV. Test-first observable behavior | Every FR maps to a Japa unit test (use case), a Japa integration test (endpoint contract), or a Vitest test (workbench). RED → GREEN → REFACTOR per behavior. **PASS** |
| V. Deep boundaries and explicit contracts | `ResetUserPasswordUseCase` owns the decisions; `LucidUserRepository` owns the guarded `UPDATE` and the token deletion; `UsersController` owns HTTP adaptation; `UserPolicy` owns the role rule; the web adapts the DTO at the feature boundary. No shortcut requested. **PASS** |
| VI. Durable knowledge has a home | `CONTEXT.md` already defines `Password Reset`, `Password Renewal Requirement`, and `Password Renewal`; no new vocabulary and no new ADR. The one design decision worth keeping — event columns per producing action — is recorded in `research.md`, not duplicated elsewhere. **PASS** |
| VII. Verification is part of delivery | `pnpm check`, `pnpm typecheck`, `pnpm test`, plus the users browser journey, then a fresh read-only review before the PR is ready. **PASS** |
| VIII. One workflow owner | No new orchestration, no new state machine; the requirement stays the single state `#117` owns. **PASS** |

No violations, so **Complexity Tracking is empty** and omitted.

## Project Structure

### Documentation (this feature)

```text
specs/user-administration/password-reset/reset-an-active-user-password/
├── spec.md               # Approved behavioral contract
├── plan.md               # This file
├── research.md           # Phase 0 — decisions, rationale, alternatives
├── data-model.md         # Phase 1 — schema and DTO changes
├── quickstart.md         # Phase 1 — how to run and validate the feature
├── contracts/
│   └── http-api.md       # Phase 1 — the endpoint contract and its refusals
├── checklists/
│   └── requirements.md   # Spec quality checklist (complete)
└── tasks.md              # Phase 2 — NOT created by /speckit-plan
```

### Source Code (repository root)

```text
apps/api/
├── database/
│   ├── migrations/
│   │   └── 1785800000000_add_user_password_reset.ts   # NEW — password_reset_at, password_reset_by_user_id
│   ├── schema.ts                                       # REGENERATED — two columns on UserSchema
│   └── factories/user_factory.ts                       # EDIT — `passwordReset` state
├── app/
│   ├── models/user.ts                                  # EDIT — passwordResetBy relation
│   ├── users/
│   │   ├── password_reset/                             # NEW slice
│   │   │   ├── reset_user_password_use_case.ts
│   │   │   └── password_reset_exceptions.ts
│   │   └── shared/
│   │       ├── user_policy.ts                          # EDIT — resetPassword()
│   │       ├── repositories/user_repository.ts         # EDIT — requirePasswordRenewal contract
│   │       ├── repositories/lucid_user_repository.ts   # EDIT — guarded write + token revocation
│   │       └── transformers/user_transformer.ts        # EDIT — reset event + outstanding flag
│   └── controllers/users_controller.ts                 # EDIT — resetPassword action
├── start/routes.ts                                     # EDIT — POST /users/:id/password-reset
└── tests/
    ├── unit/users/password_reset/reset_user_password_use_case.spec.ts   # NEW
    └── integration/users/administration/password_reset.spec.ts          # NEW

apps/web/src/features/users/
├── mutations/use-user-mutations.ts        # NEW — resetPassword + collection invalidation
├── helpers/user-permissions.ts            # NEW — who may reset whom, mirroring the API rule
├── ui/reset-password-confirmation.tsx     # NEW — the confirmation dialog
├── ui/user-access-record.tsx              # EDIT — action + outstanding-renewal indicator
├── ui/user-access-history.tsx             # EDIT — the password reset event
├── ui/user-table.tsx                      # EDIT — collection-level indicator (FR-020)
└── __tests__/password-reset/              # NEW — permissions, success, refusals, confirmation
```

**Structure Decision**: The existing monorepo layout is used unchanged. On the API the feature is a
new vertical slice directory `app/users/password_reset/` beside `app/users/list/`, sharing
`app/users/shared/` for the policy, repository, and transformer, exactly as the truck and customer
lifecycle slices do. On the web it extends the existing `features/users` slice; no new feature
directory and no dependency on another business feature (ADR 0008).

## Design decisions

The reasoning and the rejected alternatives for each of these are in [research.md](./research.md).

1. **The slice lives under `#users`, not `#auth`.** `#auth` owns the session owner's own credentials
   (login, renewal); `#users` owns administration of other people's access, which is what this is.
   The route sits at `/api/v1/users/:id/password-reset` and `UserPolicy` already lives there.
2. **Two new columns, `password_reset_at` and `password_reset_by_user_id`**, beside the existing
   `password_renewal_required_at`. Each producing action owns its own dated, attributed event — the
   shape every other lifecycle event on `users` already has — while the requirement stays the single
   enforcement state `#117` writes and clears. This is also what lets `#32` land later without
   touching this slice.
3. **The outstanding requirement and the reset event are presented separately.** The requirement is
   a boolean derived from `password_renewal_required_at`; the reset is a dated, attributed history
   event. Deriving "outstanding since <date> by <admin>" from a single origin would misattribute the
   requirement once `#32` can also produce it.
4. **One guarded `UPDATE` plus one token deletion in one transaction**, mirroring `renewPassword`.
   The guard `WHERE id = ? AND access_status = 'ACTIVE'` is the concurrency control; the transaction
   exists because recording the requirement and revoking the connections must not be separable
   (FR-013).
5. **Both the reset event and the outstanding flag are withheld from viewers who may not consult the
   access history**, reusing `includeAccessHistory`. Either one says an administrator acted on that
   user, which is the same class of information `#4` already restricts.
6. **Refusal statuses follow the split `#117` established**: `409` for a lifecycle conflict (target
   not active), `422` for a refusal about the submitted target (self-reset), `404` for an unknown
   user, `403` from the policy, and `403` from the existing renewal middleware for a confined
   requester.

## Phase 1 re-check

After the design above: no new cross-layer dependency, no second source of truth, no repository-owned
state machine, no new domain vocabulary, and no ADR change. `CONTEXT.md` needs no edit. The
Constitution Check verdicts above are unchanged. **PASS**
