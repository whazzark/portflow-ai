# Implementation Plan: Renew a Pending User Activation Link

**Branch**: `whazzark/renew-a-pending-user-activation-link` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/user-administration/invitation-onboarding/renew-a-pending-user-activation-link/spec.md`

## Summary

An organization admin replaces a pending user's activation link. One transaction does the work:
the command locks the user, checks they are still pending, records the renewal's date and actor,
deletes the previous token row, and inserts a new one valid for 7 days. The previous link is
therefore unusable the moment the new one exists, and a failure leaves the previous link exactly as
it was. The new link is returned once, in the same `{ user, activationLink }` envelope the
invitation uses, and the workbench presents it in the same once-only dialog.

The collection projection also gains the live link's expiry, so the record can say *valid until* or
*expired*, and the pending view can mark the invitations whose link no longer works.

GH-7 already delivered the issuer, the token table with its one-row-per-user invariant, and the
outcome dialog. This slice reuses all three, and adds one command, two columns, and one workbench
action.

## Technical Context

**Language/Version**: TypeScript 5.7 on Node 22, ESM throughout

**Primary Dependencies**: `apps/api` uses AdonisJS 7 (`@adonisjs/lucid` 22, `@adonisjs/bouncer` 4, `@adonisjs/auth` 10, VineJS 4). `apps/web` uses TanStack Start + React 19, TanStack Query, TanStack Router, TanStack Table, the Tuyau client, and shadcn/base-ui primitives.

**Storage**: PostgreSQL in production, better-sqlite3 in tests; Lucid migrations under `apps/api/database/migrations`

**Testing**: Japa (`unit` and `integration` suites) in `apps/api`; Vitest + Testing Library + MSW in `apps/web`

**Target Platform**: Linux server API, browser workstation

**Project Type**: PNPM/Turbo monorepo, `apps/api` + `apps/web`, vertical slices on both sides

**Performance Goals**: SC-009, 95% of renewals in under 2 seconds. The command is a single-row transaction with one delete and one insert. The collection read gains one preload (`activationToken`, indexed on `user_id`) and stays within GH-4's budget at ~200 users.

**Constraints**: The API stays the authorization authority (constitution V, ADR 0005). The secret is never stored, logged, or returned outside the `200` of this command. The use case owns the decision, the repository owns the locked write, and the controller owns HTTP adaptation (ADR 0013).

**Scale/Scope**: One new endpoint, one migration (two columns), one use case, one policy method, three new projection keys. On the web: one mutation, one dialog, one pure helper, one record field, one pending-view column, and one history entry.

## Constitution Check

*GATE: passed before Phase 0, re-checked after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Selected feature intent is versioned | `#9` is selected, and `spec.md` is the contract this plan implements. Its one clarification (link validity) was resolved on 2026-09-11. **PASS** |
| II. One independently deliverable feature per spec | One outcome — replacing a pending user's link — shipping as one issue, one directory, one branch, and one PR, API and web together. The validity display serves that outcome, as FR-022 records. **PASS** |
| III. Vanilla Spec Kit gates | The spec was reviewed before this plan, and this plan is to be reviewed before `/speckit-tasks`. **PASS** |
| IV. Test-first observable behavior | Every FR maps to a Japa unit test (use case against SQLite), a Japa integration test (endpoint and projection), or a Vitest feature test (workbench) — see research D14. RED → GREEN → REFACTOR per behavior. **PASS** |
| V. Deep boundaries and explicit contracts | `RenewActivationLinkUseCase` decides and picks the refusal. `LucidUserRepository.renewActivationLink` owns the locked transaction. `UsersController.renewActivationLink` owns HTTP. `UserPolicy.renewActivationLink` owns the role rule. `ActivationLinkIssuer` is reused, not duplicated. The web adapts the DTO in `helpers/activation-link.ts`. No shortcut is requested. **PASS** |
| VI. Durable knowledge has a home | `CONTEXT.md` already defines *User Activation Link Renewal*. No new vocabulary and no ADR are needed. The concurrency contract GH-8 and GH-12 must honour is recorded once, in research D6. **PASS** |
| VII. Verification is part of delivery | `pnpm check`, `pnpm typecheck`, `pnpm test`, and the users journey in [quickstart.md](./quickstart.md), then a fresh read-only review before the PR is ready. **PASS** |
| VIII. One workflow owner | No new orchestration or state machine. The link's validity is derived, never stored as a state. **PASS** |

There are no violations, so **Complexity Tracking** is empty and omitted.

## Project Structure

### Documentation (this feature)

```text
specs/user-administration/invitation-onboarding/renew-a-pending-user-activation-link/
├── spec.md                        # Approved behavioral contract
├── plan.md                        # This file
├── research.md                    # Phase 0 — decisions D1–D14, rationale, alternatives
├── data-model.md                  # Phase 1 — columns, token replacement, projections
├── quickstart.md                  # Phase 1 — run and validate
├── contracts/
│   ├── http-api.md                # Phase 1 — POST …/activation-link-renewal and the extended GET /users
│   └── renewal-workbench.md       # Phase 1 — entry points, dialog steps, validity, test seams
├── checklists/
│   └── requirements.md            # Spec quality checklist (complete)
└── tasks.md                       # Phase 2 — NOT created by /speckit-plan
```

### Source Code (repository root)

```text
apps/api/
├── database/
│   ├── migrations/
│   │   └── 1786000000000_add_user_activation_link_renewal.ts   # NEW — activation_link_renewed_at, _by_user_id
│   ├── schema.ts                                                # REGENERATED — two columns on UserSchema
│   └── factories/user_activation_token_factory.ts               # REUSED — GH-7's factory (valid and `expired` states) gets its first callers
├── app/
│   ├── models/user.ts                                           # EDIT — activationLinkRenewedBy relation
│   ├── users/
│   │   ├── activation_link_renewal/                             # NEW slice
│   │   │   ├── renew_activation_link_use_case.ts
│   │   │   ├── renew_activation_link_validator.ts
│   │   │   └── activation_link_renewal_exceptions.ts            # E_USER_NOT_PENDING (meta.accessStatus)
│   │   └── shared/
│   │       ├── user_policy.ts                                   # EDIT — renewActivationLink()
│   │       ├── repositories/user_repository.ts                  # EDIT — renewActivationLink contract
│   │       ├── repositories/lucid_user_repository.ts            # EDIT — locked transaction; preload token + actor
│   │       └── transformers/user_transformer.ts                 # EDIT — three gated keys
│   └── controllers/users_controller.ts                          # EDIT — renewActivationLink action
├── start/routes.ts                                              # EDIT — POST /users/:id/activation-link-renewal
└── tests/
    ├── unit/users/activation_link_renewal/renew_activation_link_use_case.spec.ts   # NEW
    ├── integration/users/activation_link_renewal/renew.spec.ts                     # NEW
    └── integration/users/consultation/list.spec.ts                                 # EDIT — new keys, gating

apps/web/src/features/users/
├── helpers/activation-link.ts                  # NEW — activationLinkState(user, now)
├── helpers/activation-link.test.ts             # NEW — unit, expiry boundary
├── helpers/user-permissions.ts                 # EDIT — canRenewActivationLink
├── mutations/use-user-mutations.ts             # EDIT — renewActivationLink, refresh on success and error
├── ui/renew-activation-link-dialog.tsx         # NEW — confirmation, then ActivationLinkDialog
├── ui/activation-link-dialog.tsx               # EDIT — origin: 'invitation' | 'renewal'
├── ui/user-access-actions.tsx                  # EDIT — record footer entry point
├── ui/user-row-actions.tsx                     # EDIT — row menu entry point
├── ui/user-access-record.tsx                   # EDIT — Activation link field
├── ui/user-access-history.tsx                  # EDIT — Activation link renewed entry
├── ui/user-table.tsx                           # EDIT — pending-only column, Password hidden there (keyed on its existing `view` prop)
├── __tests__/support/fixtures.ts               # EDIT — pending fixtures with valid / expired / no link
└── __tests__/activation-link-renewal/          # NEW — permissions, confirmation, success, refusals, validity
```

**Structure Decision**: The monorepo layout is unchanged. On the API the feature is a new vertical
slice directory, `app/users/activation_link_renewal/`, beside `invite/` and `password_reset/`. It
shares `app/users/shared/` for the policy, the repository, the transformer, and the issuer. On the
web it extends the existing `features/users` slice, with no new feature directory and no dependency
on another business feature (ADR 0008).

## Design decisions

The reasoning and the rejected alternatives for each decision are in [research.md](./research.md).

1. **`POST /api/v1/users/:id/activation-link-renewal`**, named `users.activation_link_renewal`,
   with no body (D2). Each call issues a new secret, so it is neither `PUT` nor a readable link
   resource.
2. **The policy authorizes the viewer; the repository decides the target** (D3). There is no
   self-renewal rule: the requester is necessarily active, so naming themselves is simply a
   non-pending target (D4).
3. **One transaction with a row lock** (D5): lock `users`, check `PENDING`, update the renewal
   columns under a guard, delete the previous token, and insert the new one. Two concurrent
   renewals leave the last one's link, and a failure leaves the previous link untouched.
4. **The `users` row lock is the serialization point** for every write that consumes or retires a
   pending user's link. The contract GH-8 and GH-12 must honour for FR-016 is written down in D6.
   This slice tests its own half.
5. **The renewal is an event on `users`** (D7): `activation_link_renewed_at` /
   `activation_link_renewed_by_user_id`, overwritten per renewal and never cleared, mirroring
   `password_reset_*`. The migration copies that migration's SQLite handling (D8).
6. **Validity crosses the wire as one expiry** (D9). `activationLinkExpiresAt` is gated with the
   history and `null` for non-pending users, and the web derives *valid / expired / missing* at
   render time. A server-computed flag would go stale while the collection is open.
7. **The response reuses the invitation's envelope** (D10), so the web reuses `ActivationLinkDto`
   and `ActivationLinkDialog` unchanged, apart from an `origin` prop for one sentence.
8. **Refusals**: `404 E_USER_NOT_FOUND`, `409 E_USER_NOT_PENDING` with `meta.accessStatus`, and
   `403` from the policy or the renewal middleware (D11). The web turns `meta.accessStatus` into the
   action that applies instead.
9. **One dialog that confirms, then presents** (D12). It is mounted only while open, held in
   component state rather than the URL, the same as the invitation's secret and the reset's
   confirmation. It stays mounted through the collection refresh, because the user stays pending.
10. **The pending view swaps the Password column for an Activation link column** (D13). The column
    marks *Expired* and *Not issued* only, and is blank for a valid link.

## Phase 1 re-check

After the design above there is no new cross-layer dependency, no second source of truth for the
link (the token row stays the only one, and validity is derived), no repository-owned state
machine, no new domain vocabulary, and no ADR change. `CONTEXT.md` needs no edit. The Constitution
Check verdicts are unchanged. **PASS**
