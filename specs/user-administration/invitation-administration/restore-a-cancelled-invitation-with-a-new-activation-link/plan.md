# Implementation Plan: Restore a Cancelled Invitation with a New Activation Link

**Branch**: `whazzark/restore-a-cancelled-invitation-with-a-new-activa` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`specs/user-administration/invitation-administration/restore-a-cancelled-invitation-with-a-new-activation-link/spec.md`

## Summary

Give an organization admin the way back from a cancellation. The API gains
`POST /api/v1/users/:id/restore-invitation`, reserved to active organization admins, with an
optional comment. The use case issues a new activation link in memory, then one transaction does
the rest: a guarded `UPDATE` moves a still-`CANCELLED` user to `PENDING` and records the
restoration's date, administrator, and trimmed comment; the same transaction deletes any token the
user still holds and inserts the new one, valid for 7 days. The status change and the new link are
therefore inseparable, and no link issued before the restoration can work after it. The answer is
the `{ user, activationLink }` envelope the invitation and the renewal already use. Every other
target status is refused with one code, `E_USER_NOT_CANCELLED`, naming the status in `meta`, and a
refusal changes nothing.

The web gains **Restore** on a cancelled user's record and row menu. It opens a dedicated
confirmation with the lifecycle comment field, and on success hands the link to the page-level
`IssuedActivationLinkProvider`, so the once-only outcome stays open while the restored user leaves
the cancelled view under it. The access history gains an **Invitation restored** event with its
comment, after the cancellation it reverses, which stays in place.

Nearly everything is reused. GH-12 delivered the comment rule and the link deletion at
cancellation, GH-9 delivered link issuance for an existing user and the page-level outcome, and GH-8
delivered the acceptance that makes the new link usable. The design decisions and their rejected
alternatives are in [research.md](./research.md), the columns and invariants in
[data-model.md](./data-model.md), and the two contracts in [contracts/](./contracts/).

## Technical Context

**Language/Version**: TypeScript 5.7 on Node 22, ESM throughout the PNPM/Turbo monorepo.

**Primary Dependencies**: AdonisJS 7 (Lucid, Bouncer, VineJS, session auth), Tuyau for the typed
API/web contract (ADR-0005), TanStack Start + Router + Query, shadcn/base-ui primitives, sonner. No
new dependency.

**Storage**: PostgreSQL in production, better-sqlite3 in tests. Three new nullable columns on
`users` (`invitation_restored_at`, `invitation_restored_by_user_id`,
`invitation_restoration_comment`). The write deletes from and inserts into the existing
`user_activation_tokens`. No new table or index.

**Testing**: Japa (`unit` and `integration`) for the API, with repository writes against SQLite per
ADR-0014. Vitest + Testing Library + MSW for the web, rendering through the real router. No
`apps/web/e2e` directory exists, so the browser flow is the quickstart walkthrough.

**Target Platform**: The AdonisJS API server and the TanStack Start web application already deployed
from this monorepo.

**Project Type**: Web application (API + web) in one monorepo.

**Performance Goals**: SC-009, 95% of restorations within 2 seconds. The write is four statements
in one short transaction on primary and unique keys (guarded update, token delete, token insert,
reload), plus one non-awaited collection invalidation.

**Constraints**:
- FR-007 forbids a partial effect, so status, event, and token change in one transaction.
- FR-006 requires that no pre-restoration link survive, because GH-8 accepts any live token of a
  pending user.
- FR-013 requires authorization before any read of the target.
- FR-008 requires the outcome to outlive the record and row it was started from.
- The session representation `toObject()`, the invitation and renewal responses, and
  `UserAccessDialog`'s three existing actions must not change.

**Scale/Scope**: One site, one organization, at most 200 users. One endpoint, one migration (three
columns), one API slice, one policy ability, one exception; on the web, one dialog, one permission
helper, one mutation, one history event, and an `origin` value on the existing outcome.

## Constitution Check

*GATE: passed before Phase 0 research, re-checked after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Selected feature intent is versioned | PASS: issue #13 is selected. Its spec was rewritten from the migration stub and clarified in 3 answers (2026-09-11), and it is the contract this plan implements. |
| II. One independently deliverable feature per spec | PASS: one outcome, making a cancelled invitation pending again with a new link. Cancellation, removal, renewal, acceptance, identity update, and role change stay out (FR-026), and the slice ships without changing any of them. |
| III. Vanilla Spec Kit gates | PASS: the spec was written and clarified, and awaits review. This plan awaits human review before `speckit-tasks`. No behavioral question was invented; the remaining choices are design decisions recorded in `research.md`. |
| IV. Test-first observable behavior | PASS: RED → GREEN → REFACTOR on the guarded write and its outcomes, then the endpoint's authorization, validation, refusal matrix, and the acceptance of the new link, then the workbench journey. Every acceptance scenario maps to a Japa or Vitest seam (D15). |
| V. Deep boundaries and explicit contracts | PASS: the policy authorizes, the use case issues the link, normalizes the comment, and maps outcomes to exceptions, the repository owns the transaction, guard, and token replacement behind a typed outcome, the controller adapts HTTP, and the transformer owns the projection. On the web, `canRestoreInvitation` owns the offer rule, `RestoreInvitationDialog` the confirmation and refusals, and `IssuedActivationLinkProvider` the outcome. |
| VI. Durable knowledge has a home | PASS: the vocabulary comes from `CONTEXT.md` (User Invitation Restoration) with no edit needed; the column and label naming follows its "avoid: user restoration" (D6, D14). No ADR is needed: the design reuses the guarded-write pattern of GH-12 and the link issuance and outcome of GH-9. No new cross-slice obligation arises (http-api, "Obligations on other slices"). |
| VII. Verification is part of delivery | PASS: `pnpm check`, `pnpm typecheck`, `pnpm test`, and the [quickstart](./quickstart.md) walkthrough before the PR is ready, then a fresh read-only review of the final diff. |
| VIII. One workflow owner | PASS: no new state machine. `CANCELLED → PENDING` is a domain transition, not a workflow state. Spec Kit owns the artifacts, and GitHub owns status. |

No violation to justify, so **Complexity Tracking is empty**.

## Project Structure

### Documentation (this feature)

```text
specs/user-administration/invitation-administration/restore-a-cancelled-invitation-with-a-new-activation-link/
├── spec.md
├── plan.md                              # This file
├── research.md                          # Phase 0 — decisions D1–D15 and rejected alternatives
├── data-model.md                        # Phase 1 — the columns, the transition, invariants, contract
├── quickstart.md                        # Phase 1 — how to run and prove the feature
├── contracts/
│   ├── http-api.md                      # POST /api/v1/users/:id/restore-invitation
│   └── restoration-workbench.md         # entry points, confirmation, outcomes, history, test seams
├── checklists/requirements.md
└── tasks.md                             # Phase 2 — produced by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
apps/api/
├── database/
│   ├── migrations/
│   │   └── 1786100000000_add_user_invitation_restoration.ts        # NEW — three columns, dialect branch
│   ├── schema.ts                                                    # REGENERATED
│   └── factories/user_factory.ts                                    # EDIT — null the three columns
├── app/
│   ├── models/user.ts                                               # EDIT — invitationRestoredBy relation
│   ├── users/
│   │   ├── restore_invitation/                                      # NEW slice
│   │   │   ├── restore_user_invitation_use_case.ts                  # issue link, normalize comment, map outcome
│   │   │   ├── restore_user_invitation_validator.ts                 # params.id uuid, lifecycleComment()
│   │   │   └── invitation_restoration_exceptions.ts                 # E_USER_NOT_CANCELLED (meta.accessStatus)
│   │   └── shared/
│   │       ├── user_policy.ts                                       # EDIT — restoreInvitation()
│   │       ├── repositories/user_repository.ts                      # EDIT — restoreCancelledInvitation contract
│   │       ├── repositories/lucid_user_repository.ts                # EDIT — guarded update + token replace; preload
│   │       └── transformers/user_transformer.ts                     # EDIT — three gated keys
│   └── controllers/users_controller.ts                              # EDIT — restoreInvitation action
├── start/routes.ts                                                  # EDIT — POST /users/:id/restore-invitation
├── .adonisjs/client/                                                # REGENERATED — users.restore_invitation
└── tests/
    ├── unit/users/invitation_restoration/restore.spec.ts            # NEW
    ├── unit/users/invitation_restoration/guarded_write.spec.ts      # NEW
    ├── integration/users/invitation_restoration/restore.spec.ts     # NEW
    └── integration/users/consultation/list.spec.ts                  # EDIT — new keys, gating

apps/web/src/features/users/
├── helpers/user-permissions.ts            # EDIT — canRestoreInvitation
├── helpers/user-permissions.test.ts       # EDIT — the offer rule per status and role
├── mutations/use-user-mutations.ts        # EDIT — restoreInvitation, gcTime 0, refresh both ways
├── ui/restore-invitation-dialog.tsx       # NEW — confirmation + comment, refusals, hands link to page
├── ui/issued-activation-link.tsx          # EDIT — held value carries origin
├── ui/activation-link-dialog.tsx          # EDIT — origin 'restoration' sentence
├── ui/renew-activation-link-dialog.tsx    # EDIT — passes origin 'renewal'
├── ui/user-access-actions.tsx             # EDIT — record footer entry point
├── ui/user-access-record.tsx              # EDIT — asks canRestoreInvitation
├── ui/user-row-actions.tsx                # EDIT — row menu entry point
├── ui/user-access-history.tsx             # EDIT — Invitation restored event with comment
└── __tests__/
    ├── support/fixtures.ts                # EDIT — a restored user; restoration keys on USERS
    └── invitation-restoration/            # NEW — helpers, permissions, confirmation, journey,
                                           #        row-menu, refusals, recovery, history
```

`user-access.tsx`, `helpers/user-access-copy.ts`, and `ui/user-table.tsx` need no change (D11, D14).

**Structure Decision**: The existing vertical-slice layout on both sides, unchanged. On the API, a
new workflow slice `app/users/restore_invitation/` sits beside `cancel_invitation/` and
`activation_link_renewal/`, sharing the policy, repository, transformer, and issuer in
`app/users/shared/`. On the web, the work stays inside `features/users` and joins the
credential-issuing family the renewal opened. There is no new feature directory and no dependency
on another business feature (ADR-0008).

## Design decisions

The reasoning and the rejected alternatives are in [research.md](./research.md).

1. **A command endpoint mirroring its inverse** (D1): `POST /users/:id/restore-invitation`, never a
   generic status `PATCH` and never a second `POST /users`, which GH-7 refuses by design.
2. **One refusal code with the status in `meta`** (D3): `409 E_USER_NOT_CANCELLED`, the renewal's
   shape. The existing per-status codes carry messages pointing to cancellation and deactivation,
   which would mislead here.
3. **Guard as eligibility and concurrency control, token replaced in the same transaction** (D5):
   `cancelPendingInvitation` with the statuses swapped, plus delete-then-insert of the token. Two
   restorations leave one link; a failure leaves the user cancelled with none.
4. **The restoration is its own event, latest only, named after the invitation** (D6):
   `invitation_restored_*` and `invitation_restoration_comment`. The cancellation and the invitation
   events are left as they were.
5. **The response reuses the `{ user, activationLink }` envelope** (D9), so the web reuses
   `ActivationLinkDto` and the page-level outcome.
6. **A dedicated dialog, not a fourth `UserAccessAction`** (D11): the outcome is a secret, so it
   needs the renewal's in-flight lock, `gcTime: 0`, and hand-off to the page.
7. **The outcome lives at page level** (D12): the record closes and the row disappears as the user
   leaves the cancelled view, and the link stays on screen until **Done**. No navigation, no toast.
8. **The history reads Invited → Cancelled → Invitation restored** (D14), with both comments, and the
   pending view's `Invited` column is untouched.

## Phase 0 — Outline & Research

Complete. See [research.md](./research.md), decisions D1 to D15. Technical Context holds no
`NEEDS CLARIFICATION`.

## Phase 1 — Design & Contracts

Complete. [data-model.md](./data-model.md) fixes the columns, the migration shape, the one owned
transition, the invariants, the repository and use case contracts, and the projection.
[contracts/http-api.md](./contracts/http-api.md) fixes the endpoint, the processing order, the
response, the refusals, and the concurrency behavior.
[contracts/restoration-workbench.md](./contracts/restoration-workbench.md) fixes the offer rule, the
entry points, the confirmation, the outcomes, the history event, and the test seams.
[quickstart.md](./quickstart.md) is the runnable validation guide.

**Post-design Constitution re-check**: PASS, unchanged. The design adds three columns, one endpoint,
one policy ability, and one exception, all inside existing patterns, plus one `origin` value on an
existing web outcome. There is no new layer, dependency, or state machine, and no edit to
`CONTEXT.md` or the ADRs. One consequence of the spec's latest-only model surfaced during design and
is recorded rather than changed: after invite → cancel → restore → cancel, the first cancellation is
replaced, so the record shows a restoration without the cancellation it reversed (D6). The spec
already excludes a full access history.

## Complexity Tracking

No Constitution Check violation. Nothing to justify.
