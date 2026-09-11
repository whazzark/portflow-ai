# Implementation Plan: Cancel a Pending Invitation

**Branch**: `whazzark/cancel-a-pending-invitation` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`specs/user-administration/invitation-administration/cancel-a-pending-invitation/spec.md`

## Summary

Give an organization admin the one way to withdraw access before it is used. The API gains
`POST /api/v1/users/:id/cancel-invitation`, reserved to active organization admins. Its write is one
transaction: a guarded `UPDATE` moves a still-`PENDING` user to `CANCELLED`, recording the date, the
administrator, and an optional trimmed comment of at most 1,000 characters, and the same transaction
deletes that user's activation token. The status change and the end of the link are therefore
inseparable. Every other target status is refused with a code naming it (`E_USER_ALREADY_ACTIVATED`,
which is new, `E_USER_ALREADY_DEACTIVATED`, `E_USER_CANCELLED_INVITATION`, and `E_USER_NOT_FOUND`),
and a refusal changes nothing.

The web gains the action inside the existing user access pattern. `'cancel-invitation'` becomes a
second `UserAccessAction`, offered on pending users in both the record footer and the row menu. It
opens the shared `UserAccessDialog`, now action-aware: title **Cancel invitation?**, an optional
comment, **Keep invitation** / **Cancel invitation** buttons. On success the workbench stays on the
pending view and the record closes as its user leaves the view. The access history shows the
comment under the Cancelled event.

Most of the ground already exists. GH-2 shipped the `CANCELLED` status and its
`cancelled_at`/`cancelled_by_user_id` columns, GH-7 the token table, and GH-20 the guarded-write and
dialog shapes this slice mirrors. The design decisions and their rejected alternatives are in
[research.md](./research.md), the schema change and invariants in [data-model.md](./data-model.md),
and the two contracts in [contracts/](./contracts/).

## Technical Context

**Language/Version**: TypeScript 5.7 on Node 22, ESM throughout the PNPM/Turbo monorepo.

**Primary Dependencies**: AdonisJS 7 (Lucid, Bouncer, VineJS, session auth), Tuyau for the typed
API/web contract (ADR-0005), TanStack Start + Router + Query, shadcn/Tailwind primitives, sonner. No
new dependency.

**Storage**: PostgreSQL. One new nullable `text` column, `users.cancellation_comment`. The write
also deletes from the existing `user_activation_tokens` table. No new table or index.

**Testing**: Japa (`unit` and `integration`) for the API, with repository writes against SQLite
per ADR-0014. Vitest + Testing Library + MSW for the web, rendering through the real router. No
`apps/web/e2e` directory exists, so the browser flow is covered by the quickstart walkthrough.

**Target Platform**: The AdonisJS API server and the TanStack Start web application already deployed
from this monorepo.

**Project Type**: Web application (API + web) in one monorepo.

**Performance Goals**: SC-007, 95% of outcomes within 2 seconds. The write is three statements in
one short transaction on primary and unique keys (update, token delete, reload), plus one collection
invalidation. No polling.

**Constraints**:
- FR-005 forbids a partial effect, so status and token change in one transaction.
- FR-009 requires authorization before any read of the target.
- FR-011a fixes the labels.
- FR-013 forbids navigating to the cancelled view.
- The session contract `toObject()` and the invitation response must not change, and the
  deactivation dialog's copy and behavior must stay identical.

**Scale/Scope**: One site, one organization, at most 200 users. One endpoint, one column, one API
slice, and one new action inside existing web components.

## Constitution Check

*GATE: passed before Phase 0 research, re-checked after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Selected feature intent is versioned | PASS: issue #12 is selected. Its spec was rewritten from the migration stub and clarified in 3 answers (2026-09-11), and it is the contract this plan implements. |
| II. One independently deliverable feature per spec | PASS: one outcome, withdrawing a pending user's access. Restoration (GH-13), removal (GH-14), renewal (GH-9), and acceptance (GH-8) stay out (FR-019), and the slice ships without any of them. |
| III. Vanilla Spec Kit gates | PASS: the spec was written, clarified, and awaits review. This plan awaits human review before `speckit-tasks`. No behavioral question was invented; the remaining choices are design decisions recorded in `research.md`. |
| IV. Test-first observable behavior | PASS: RED → GREEN → REFACTOR on the guarded write and its outcomes, then on the endpoint's authorization, validation, and refusal matrix, then on the workbench journey. Every acceptance scenario maps to a Japa or Vitest seam (D14). |
| V. Deep boundaries and explicit contracts | PASS: the policy authorizes, the use case normalizes and maps outcomes to exceptions, the repository owns the transaction, guard, and token deletion behind a typed outcome, the controller adapts HTTP, and the transformer owns the projection. On the web, `userAccessActions` owns the offer rule, `user-access-copy` the wording, and `UserAccessDialog` the confirmation. |
| VI. Durable knowledge has a home | PASS: the vocabulary comes from `CONTEXT.md` (User Invitation Cancellation) with no edit needed. The one cross-slice obligation, that GH-8 and GH-9 must guard on the `users` row, is recorded once, in the HTTP contract, and cited by research D5. No ADR is needed: the design reuses the guarded-write pattern that deactivation and password reset already document. |
| VII. Verification is part of delivery | PASS: `pnpm check`, `pnpm typecheck`, `pnpm test`, and the [quickstart](./quickstart.md) walkthrough before the PR is ready, then a fresh read-only review of the final diff. |
| VIII. One workflow owner | PASS: no new state machine. `PENDING → CANCELLED` is a domain transition, not a workflow state. Spec Kit owns the artifacts, and GitHub owns status. |

No violation to justify, so **Complexity Tracking is empty**.

## Project Structure

### Documentation (this feature)

```text
specs/user-administration/invitation-administration/cancel-a-pending-invitation/
├── spec.md
├── plan.md                                # This file
├── research.md                            # Phase 0 — decisions and rejected alternatives
├── data-model.md                          # Phase 1 — the new column, the transition, invariants
├── quickstart.md                          # Phase 1 — how to run and prove the feature
├── contracts/
│   ├── http-api.md                        # POST /api/v1/users/:id/cancel-invitation
│   └── cancel-invitation-workbench.md     # the action, the confirmation, outcomes, test seams
├── checklists/requirements.md
└── tasks.md                               # Phase 2 — produced by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
apps/api/
├── database/
│   ├── migrations/
│   │   └── <timestamp>_add_user_cancellation_comment.ts          # NEW — users.cancellation_comment
│   ├── schema.ts                                                  # REGENERATED — cancellationComment
│   └── factories/user_factory.ts                                  # EDIT — null the comment where the pair is nulled
├── app/
│   ├── users/
│   │   ├── cancel_invitation/                                     # NEW slice
│   │   │   ├── cancel_user_invitation_use_case.ts                 # normalize comment, map outcome → exception
│   │   │   └── cancel_user_invitation_validator.ts                # params.id uuid, lifecycleComment()
│   │   └── shared/
│   │       ├── user_policy.ts                                     # EDIT — cancelInvitation()
│   │       ├── user_exceptions.ts                                 # EDIT — UserAlreadyActivatedException
│   │       ├── repositories/user_repository.ts                    # EDIT — cancelPendingInvitation contract
│   │       ├── repositories/lucid_user_repository.ts              # EDIT — guarded update + token delete, one trx
│   │       └── transformers/user_transformer.ts                   # EDIT — cancellationComment (gated)
│   └── controllers/users_controller.ts                            # EDIT — cancelInvitation action
├── start/routes.ts                                                # EDIT — POST /users/:id/cancel-invitation
├── .adonisjs/client/                                              # REGENERATED — users.cancel_invitation
└── tests/
    ├── unit/users/invitation_cancellation/cancel.spec.ts          # NEW
    ├── unit/users/invitation_cancellation/guarded_write.spec.ts   # NEW
    └── integration/users/invitation_cancellation/cancel.spec.ts   # NEW

apps/web/src/features/users/
├── helpers/user-access-copy.ts            # EDIT — 'cancel-invitation' keys; per-action title, effect,
│                                          #        dismiss label, success/failure shapes, refusal tables
├── user-access.tsx                        # EDIT — offer rule; action-aware UserAccessDialog with comment
├── mutations/use-user-mutations.ts        # EDIT — cancelInvitation, refreshes on success and error
├── ui/user-access-history.tsx             # EDIT — comment line under the Cancelled event
├── ui/user-access-record.tsx              # EDIT — docstring only (cancellation now offered)
└── __tests__/
    ├── support/fixtures.ts                # EDIT — pending user; cancelled user with a comment
    └── cancel-invitation/                 # NEW — permissions, confirmation, journey, refusals,
                                           #        recovery, row-menu
```

`ui/user-access-actions.tsx` and `ui/user-row-actions.tsx` need no change. Both render whatever
`userAccessActions` returns, with the per-action labels and variants, and mount the same dialog.

**Structure Decision**: The existing vertical-slice layout on both sides, unchanged. On the API, a
new workflow slice `app/users/cancel_invitation/` sits beside `deactivate/` and `password_reset/`,
sharing the policy, exceptions, repository, and transformer in `app/users/shared/`. On the web, the
work stays inside `features/users` and extends the user access action set that deactivation opened.
There is no new component and no dependency on another feature (ADR-0008).

## Design decisions

The reasoning and the rejected alternatives are in [research.md](./research.md).

1. **A command endpoint per transition** (D1): `POST /users/:id/cancel-invitation`, never a
   generic status `PATCH` and never a `DELETE`. Deletion is GH-14's and a term `CONTEXT.md` avoids.
2. **Guard as eligibility and concurrency control, token deletion in the same transaction** (D4):
   `deactivateActive` with the status and side effect swapped. The token is deleted rather than
   flagged, so a cancelled link is indistinguishable from an unknown one.
3. **Later slices must guard on the `users` row** (D5): a token-only renewal or acceptance write would
   not wait for a concurrent cancellation. This is recorded as an obligation in the HTTP contract,
   because the endpoints it constrains do not exist yet.
4. **The comment is a column beside the event it annotates** (D6): `cancellation_comment`, latest
   only, validated and normalized like every lifecycle comment in the product.
5. **One code per refusal, reusing the codes that already mean it** (D3). The only new one is
   `E_USER_ALREADY_ACTIVATED`, filed in `shared/` because GH-13 and GH-14 will refuse the same
   target.
6. **Authorization before validation** (D7), and no self-cancellation rule (D8), because the actor
   is always active and so already ineligible.
7. **A second user access action, not a second dialog** (D10, D11): `UserAccessDialog` becomes
   action-aware (title, effect, labels, comment, mutation, refusal table). Deactivation's rendering
   is pinned by its existing tests.
8. **No navigation after success** (D12): the record closes through the view-membership rule that
   `UsersPage` already applies to deactivation.

## Phase 0 — Outline & Research

Complete. See [research.md](./research.md), decisions D1 to D14. Technical Context holds no
`NEEDS CLARIFICATION`.

## Phase 1 — Design & Contracts

Complete. [data-model.md](./data-model.md) fixes the column, the migration shape, the one owned
transition, the invariants, the repository contract, and the projection.
[contracts/http-api.md](./contracts/http-api.md) fixes the endpoint, the processing order, the
response, the refusals, the concurrency behavior, and the obligations on GH-8, GH-9, and GH-13.
[contracts/cancel-invitation-workbench.md](./contracts/cancel-invitation-workbench.md) fixes the
offer rule, the confirmation, the outcomes, the history line, and the test seams.
[quickstart.md](./quickstart.md) is the runnable validation guide.

**Post-design Constitution re-check**: PASS, unchanged. The design adds one column, one endpoint, one
policy ability, and one exception, all inside existing patterns. There is no new layer, dependency,
or state machine, and no edit to `CONTEXT.md` or the ADRs. One behavioral detail surfaced during
design and is settled within the spec's existing requirements: the per-action refusal wording for
`E_USER_ALREADY_DEACTIVATED` (D11), which the spec's FR-007 already requires to be distinct.

## Complexity Tracking

No Constitution Check violation. Nothing to justify.
