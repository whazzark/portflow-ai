# Implementation Plan: Invite a Pending User with a Confidential Activation Link

**Branch**: `whazzark/invite-a-pending-user-with-a-confidential-activa` | **Date**: 2026-09-10 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`specs/user-administration/invitation-onboarding/invite-a-pending-user-with-a-confidential-activation-link/spec.md`

## Summary

Turn user administration from a read-only workbench into one that can grant access. The API gains
one write seam — `POST /api/v1/users` — reserved to active organization admins: it normalizes the
submitted identity, refuses any email already held by a user whatever their access status, creates
the pending user with its dated and attributed invitation event, and issues one confidential
activation link valid for 7 days. The link's secret is returned exactly once, in that response, and
is never readable again: only its digest is stored, in a dedicated `user_activation_tokens` row that
GH-9, GH-12, and GH-13 will replace or revoke.

The web gains the invitation half of the existing `/users` workbench: a `mode=create` sheet with the
identity and role form, then a modal dialog showing the link with a copy action that only an explicit
acknowledgement dismisses, after which the workbench lands on the pending view with the new user
highlighted. Reloading during the outcome step loses the secret by construction, and the panel
says so and points to the renewal (GH-9) rather than pretending otherwise.

The design decisions and their rejected alternatives are in [research.md](./research.md); the new
table and the write projections are in [data-model.md](./data-model.md); the two contracts are in
[contracts/](./contracts/).

## Technical Context

**Language/Version**: TypeScript 5.7 on Node 22, ESM throughout the PNPM/Turbo monorepo.

**Primary Dependencies**: AdonisJS 7 (Lucid, Bouncer, VineJS, session auth), Tuyau for the typed
API/web contract (ADR-0005), TanStack Start + Router + Query, shadcn/Tailwind primitives, Zod for
route search-param validation. `node:crypto` for the activation secret — no new dependency.

**Storage**: PostgreSQL. One new table, `user_activation_tokens`; the `users` table is unchanged —
GH-2 already delivered `access_status`, `invited_at`, and `invited_by_user_id`.

**Testing**: Japa for the API (`unit` and `integration` suites, SQLite-backed repository tests per
ADR-0014); Vitest + Testing Library + MSW for the web, rendering through the real router. No
`apps/web/e2e` directory exists in the repository, so this slice adds no end-to-end journey.

**Target Platform**: AdonisJS API server and a TanStack Start web application, both already deployed
from this monorepo.

**Performance Goals**: SC-007 — the invitation outcome within 2 seconds. One write request, one
collection invalidation, no polling. The activation secret is digested with SHA-256, not scrypt, so
no deliberately slow hash runs inside the write (D2).

**Constraints**: FR-006 forbids any second read of the link, so the secret exists only in the `201`
response body; FR-007 forbids a guessable link; FR-011 keeps the API authoritative for
authorization; FR-018 forbids partial writes, so the user row and its token row are written in one
transaction; the `toObject()` session contract used by `/auth/me` and `/auth/login` and the
`toAdministration()` collection contract used by `GET /api/v1/users` must not change.

**Scale/Scope**: one site, one organization, ≤ 200 users, one new endpoint, one new table, one new
API slice, one new web panel pair on an existing route, no change to the existing read seam.

## Constitution Check

*GATE: passed before Phase 0 research, re-checked after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Selected feature intent is versioned | PASS — issue #7 is selected, its spec is written and clarified (5 answers recorded in the 2026-09-10 session), and it is the contract this plan implements. |
| II. One independently deliverable feature per spec | PASS — one outcome: an organization admin can grant access. Acceptance (GH-8), renewal (GH-9), cancellation (GH-12), restoration (GH-13), and removal (GH-14) stay out (FR-022), and this slice ships without any of them. |
| III. Vanilla Spec Kit gates | PASS — spec written, clarified, and reviewed before this plan; the plan awaits human review before `speckit-tasks`. No ambiguity is invented here: the two open assumptions were resolved by `/speckit-clarify`, and the remaining design choices are recorded in `research.md`. |
| IV. Test-first observable behavior | PASS — RED → GREEN → REFACTOR on the endpoint's authorization matrix, its conflict and validation refusals, and its once-only payload, then on the workbench journey. Every acceptance scenario maps to a Japa or Vitest seam (D12). |
| V. Deep boundaries and explicit contracts | PASS — the policy authorizes, the use case decides and normalizes, the repository owns the transactional write and its typed outcome, the controller adapts HTTP, the transformer owns the projection, and the web feature module owns the panel behavior behind a thin route. The activation link issuer is a domain service of the users slice, injected, so the secret and the clock stay testable (D2). |
| VI. Durable knowledge has a home | PASS — invitation vocabulary is read from `CONTEXT.md`; the routing and form conventions from `apps/web/AGENTS.md`; the slice layout from `apps/api/AGENTS.md`. One durable decision is genuinely new — how an issued-once secret is stored and looked up — and it is recorded in `research.md` (D1, D2) rather than duplicated across documents; no new ADR is needed, since it introduces no pattern beyond the existing `remember_me_tokens` shape it mirrors. |
| VII. Verification is part of delivery | PASS — `pnpm check`, `pnpm typecheck`, `pnpm test`, and the workbench journeys in [quickstart.md](./quickstart.md) before the PR is ready, then a fresh read-only review of the final diff. |
| VIII. One workflow owner | PASS — no new state machine; Spec Kit owns the artifacts, GitHub owns status. |

No violation to justify; **Complexity Tracking is empty**.

## Project Structure

### Documentation (this feature)

```text
specs/user-administration/invitation-onboarding/invite-a-pending-user-with-a-confidential-activation-link/
├── spec.md
├── plan.md                          # This file
├── research.md                      # Phase 0 — decisions and rejected alternatives
├── data-model.md                    # Phase 1 — the new token table and the write projections
├── quickstart.md                    # Phase 1 — how to run and prove the feature
├── contracts/
│   ├── post-users.md                # POST /api/v1/users
│   └── invite-user-workbench.md     # /users invitation URL and panel contract
├── checklists/requirements.md
└── tasks.md                         # Phase 2 — produced by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
apps/api/
├── database/
│   ├── migrations/
│   │   └── 178XXXXXXXXXX_create_user_activation_tokens_table.ts   # NEW — one live link per pending user
│   └── factories/
│       ├── user_factory.ts                                        # + invitedBy on the `invited` state
│       └── user_activation_token_factory.ts                       # NEW — valid and expired states
├── app/
│   ├── models/
│   │   ├── user.ts                                                # + hasOne activationToken
│   │   └── user_activation_token.ts                               # NEW
│   ├── users/
│   │   ├── invite/
│   │   │   ├── invite_user_use_case.ts                            # NEW — normalize, refuse, create, issue
│   │   │   ├── invite_user_validator.ts                           # NEW — identity, email, role
│   │   │   └── invitation_exceptions.ts                           # NEW — E_USER_EMAIL_CONFLICT
│   │   └── shared/
│   │       ├── user_policy.ts                                     # + invite()
│   │       ├── normalize_user.ts                                  # NEW — trim identity and email
│   │       ├── activation_link_issuer.ts                          # NEW — secret, digest, expiry, URL
│   │       ├── repositories/user_repository.ts                    # + invite(): typed outcome
│   │       ├── repositories/lucid_user_repository.ts              # + transactional user + token write
│   │       └── transformers/user_transformer.ts                    # unchanged — reuses toAdministration
│   └── controllers/users_controller.ts                            # + store
├── config/... , start/env.ts                                      # + WEB_ORIGIN required (D3)
└── tests/
    ├── unit/users/invitation/invite.spec.ts                       # NEW — decisions, normalization, expiry
    └── integration/users/invitation/invite.spec.ts                # NEW — authorization, refusals, payload

apps/web/
├── src/
│   ├── routes/_authenticated/users.tsx                            # + mode, invitedUserId, transform
│   └── features/users/
│       ├── types.ts                                               # + InvitationResultDto
│       ├── mutations/use-user-mutations.ts                        # NEW — invite + collection invalidation
│       ├── helpers/user-invitation-copy.ts                        # NEW — conflict wording per status
│       ├── ui/users-page.tsx                                      # + invite entry point, landing, highlight
│       ├── ui/invite-user-panel.tsx                               # NEW — form step
│       ├── ui/invite-user-form.tsx                                # NEW — useAppForm, applyValidationError
│       ├── ui/activation-link-dialog.tsx                          # NEW — outcome dialog, copy, acknowledge
│       ├── ui/user-table.tsx                                      # + highlighted row
│       └── __tests__/invitation/*.test.tsx                        # NEW — journey, refusals, reload, landing
└── (no new dependency)
```

**Structure Decision**: the existing vertical-slice layout on both sides — a new API workflow slice
under `app/users/invite` with its validator and exceptions, its shared helpers next to the policy and
repository already there, and the web work as new panels inside the existing `src/features/users`
module behind the same thin `/users` route. This mirrors the delivered customers slice, which is the
closest equivalent write, and keeps the invitation inside the workbench GH-4 built rather than on a
route of its own.

## Phase 0 — Outline & Research

Complete. See [research.md](./research.md): D1 dedicated token table, D2 digest and issuer boundary,
D3 absolute link and `WEB_ORIGIN`, D4 endpoint and route name, D5 policy split, D6 conflict decision
and its `meta`, D7 normalization home, D8 transactional repository outcome, D9 response projection,
D10 URL shape of the two invitation steps, D11 what a reload during the outcome step must say, D12
verification seams.

## Phase 1 — Design & Contracts

Complete. [data-model.md](./data-model.md) fixes the new table, its invariants, and the write
projections; [contracts/post-users.md](./contracts/post-users.md) fixes the endpoint, its
authorization outcomes, its refusals, and its once-only payload;
[contracts/invite-user-workbench.md](./contracts/invite-user-workbench.md) fixes the URL parameters
and the observable behavior of the two panel steps; [quickstart.md](./quickstart.md) is the runnable
validation guide.

**Post-design Constitution re-check**: PASS, unchanged. The design adds one table, one endpoint, and
one injected domain service, all inside the existing patterns; it introduces no new layer, no new
dependency, and no state machine. No behavioral question surfaced during design that the spec does
not already answer.

## Complexity Tracking

No Constitution Check violation. Nothing to justify.
