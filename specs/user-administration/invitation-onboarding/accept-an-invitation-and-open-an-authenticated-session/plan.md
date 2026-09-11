# Implementation Plan: Accept an Invitation and Open an Authenticated Session

**Branch**: `whazzark/accept-an-invitation-and-open-an-authenticated-s` | **Date**: 2026-09-11 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`specs/user-administration/invitation-onboarding/accept-an-invitation-and-open-an-authenticated-session/spec.md`

## Summary

This slice completes the onboarding GH-7 started. Today GH-7 hands an organization admin a link of
the form `${WEB_ORIGIN}/activate/<secret>`, and that link leads nowhere. After this slice, it opens
an activation screen: the invited person sees whose access it activates, chooses their initial
password, and lands in the application already logged in.

**API.** Two public endpoints, declared next to `auth.login`. Both take the secret in the request
body, never in the URL.

- `POST /api/v1/auth/invitation-acceptance/preview` answers whose access a link activates.
- `POST /api/v1/auth/invitation-acceptance` accepts. It refuses a browser that already holds a
  session, using exactly the rule `AuthMiddleware` applies. It finds the link by the SHA-256 digest
  GH-7 stores, then hashes the password outside the write. In one guarded transaction it deletes the
  token row and moves the user from `PENDING` to `ACTIVE`, with a self-attributed activation event.
  It then opens a temporary session, with no remembered connection.

Every unusable link, whatever the reason, gets one identical `404`.

**Web.** A pathless `_activation` layout on the login surface hosts `/activate/$token`. The screen
has five states: an unusable link, a browser already logged in (with "Log out" to continue), the
password form, "your access is active, log in", and a retryable failure. On success it replaces the
activation URL in history and lands where a login lands.

**Confidentiality.** nginx stops logging `/activate/` paths, and the route sends no `Referer`.

**Schema.** No change. GH-2 delivered every `users` column this slice writes, and GH-7 delivered the
token table.

The design decisions and their rejected alternatives are in [research.md](./research.md). The
transitions and invariants are in [data-model.md](./data-model.md). The two contracts are in
[contracts/](./contracts/).

## Technical Context

**Language/Version**: TypeScript 5.7, ESM throughout the PNPM/Turbo monorepo; the Dockerfiles build
on Node 24.

**Primary Dependencies**:

- API: AdonisJS 7 (Lucid, VineJS, the session guard with remember-me tokens).
- Contract: Tuyau for the typed API/web contract (ADR-0005).
- Web: TanStack Start, Router, and Query; the shared `useAppForm` form kit; Zod; shadcn/Tailwind
  primitives.
- Crypto: `node:crypto`, already used by the GH-7 issuer.
- No new dependency.

**Storage**: PostgreSQL, with no migration. The slice reads and deletes `user_activation_tokens`
rows (GH-7) and writes existing `users` columns (GH-2).

**Testing**:

- API: Japa `unit` suite (repository tests against SQLite, ADR-0014) and `integration` suite (HTTP
  seam, `@japa/api-client` with the session and auth plugins).
- Web: Vitest, Testing Library, and MSW through the real route tree (`renderApp`).
- No `apps/web/e2e` directory exists, so there is no browser journey.

**Target Platform**:

- The AdonisJS API server.
- The web application, served in production as a static build behind nginx (`apps/web/nginx.conf`).

**Project Type**: Web application in a monorepo, with `apps/api` and `apps/web`.

**Performance Goals**: SC-008, an outcome within 2 seconds.

- One preview request on opening the screen.
- One acceptance request, during which one scrypt hash runs, outside any transaction (D5).
- One `auth.me` refetch on landing.

**Constraints**:

| Requirement | What it rules out, or requires |
|---|---|
| FR-012 | The unusable outcome must be identical across reasons, so the validator cannot shape-check the token (D4). |
| FR-014 | The "session open" rule must match `AuthMiddleware` exactly (D7). |
| FR-018 | Racing acceptances must resolve to one; guarded writes do this on both dialects (D5). |
| FR-020 | The secret must never be in an API URL, a log, or a `Referer` (D1, D10). |
| Session contract | The `toObject()` session contract of `auth.login` and `auth.me` must not change (D9). |
| Regression | `AuthMiddleware` and password renewal behavior must not change: extractions only (D7, D8). |

**Scale/Scope**:

- One site and one organization, with 200 users or fewer.
- API: two endpoints, one new slice (`app/auth/invitation_acceptance`), and two small extractions
  (the open-session probe and the password rule).
- Web: one new pathless layout, one new route, and one new screen with its form.
- Deployment: one nginx `location`.

## Constitution Check

*GATE: passed before Phase 0 research, re-checked after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Selected feature intent is versioned | PASS — issue #8 is selected. Its spec is written and clarified, with 4 answers recorded in the 2026-09-11 session, and it is the contract this plan implements. |
| II. One independently deliverable feature per spec | PASS — one outcome: an invited person activates their access and is logged in. Invitation (GH-7) is delivered. Renewal (GH-9), cancellation (GH-12), restoration (GH-13), removal (GH-14), and email delivery stay out (FR-023). The slice ships without any of them, and it honors a future renewal or cancellation through the usability rule (D3) with no dependency on them. |
| III. Vanilla Spec Kit gates | PASS — the spec was written, clarified, and reviewed before this plan. The plan awaits human review before `speckit-tasks`. Nothing is invented here: every design choice is recorded with its alternatives in `research.md`. |
| IV. Test-first observable behavior | PASS — RED, GREEN, REFACTOR on the repository's guarded write, the use-case decision order, the endpoints' unusable matrix, validation, session-open refusal, concurrency and session-not-opened answer, then on the screen's five states. Every acceptance scenario maps to a Japa or Vitest seam (D13). |
| V. Deep boundaries and explicit contracts | PASS — each layer keeps its role: <br>• The controller adapts HTTP and owns the session: it reads it through the probe and opens it after commit. <br>• The use case owns the decision order: session first, then usability, then hash, then write. <br>• The repository owns the transaction and the guards, and returns a typed outcome. <br>• The transformer owns both projections. <br>• The web feature module owns the screen behind a thin route. <br>No layer is bypassed: the session is opened by the controller after the repository commits, rather than inside the transaction (D9). |
| VI. Durable knowledge has a home | PASS — the vocabulary (User Invitation Acceptance, User Activation Link, Temporary Session) is read from `CONTEXT.md`, and nothing is added to it. Two canonical rules that would otherwise be duplicated get a single home: the password rule, one per side (D8), and "what counts as an open session" (D7). No ADR is needed: the design reuses GH-7's token shape, the existing guard-as-concurrency-control pattern, and the existing pathless-layout pattern. |
| VII. Verification is part of delivery | PASS — before the PR is ready: `pnpm check`, `pnpm typecheck`, `pnpm test`, the manual journeys and confidentiality checks in [quickstart.md](./quickstart.md), then a fresh read-only review of the final diff. |
| VIII. One workflow owner | PASS — no new state machine. Spec Kit owns the artifacts, and GitHub owns status. |

No violation to justify; **Complexity Tracking is empty**.

## Project Structure

### Documentation (this feature)

```text
specs/user-administration/invitation-onboarding/accept-an-invitation-and-open-an-authenticated-session/
├── spec.md
├── plan.md                              # This file
├── research.md                          # Phase 0 — decisions and rejected alternatives
├── data-model.md                        # Phase 1 — transitions, usability rule, operations
├── quickstart.md                        # Phase 1 — how to run and prove the feature
├── contracts/
│   ├── invitation-acceptance-api.md     # POST …/invitation-acceptance/preview and …/invitation-acceptance
│   └── activation-screen.md             # /activate/$token states and behavior
├── checklists/requirements.md
└── tasks.md                             # Phase 2 — produced by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
apps/api/
├── start/routes.ts                                            # + two public routes beside auth.login
├── app/
│   ├── auth/
│   │   ├── invitation_acceptance/
│   │   │   ├── preview_invitation_use_case.ts                 # NEW — digest, usable lookup, refusal
│   │   │   ├── accept_invitation_use_case.ts                  # NEW — session → usable → hash → write
│   │   │   ├── invitation_acceptance_validator.ts             # NEW — token (string only) + new password
│   │   │   └── invitation_acceptance_exceptions.ts            # NEW — the three codes of data-model.md
│   │   ├── password_renewal/password_renewal_validator.ts     # composes the shared rule (no behavior change)
│   │   └── shared/
│   │       ├── new_password_rule.ts                           # NEW — extracted from the renewal validator (D8)
│   │       └── open_session.ts                                # NEW — extracted from AuthMiddleware (D7)
│   ├── middleware/auth_middleware.ts                          # delegates to open_session (no behavior change)
│   ├── controllers/invitation_acceptance_controller.ts        # NEW — preview, store (login after commit)
│   └── users/shared/
│       ├── activation_link_issuer.ts                          # + export digestActivationSecret, used by issue()
│       ├── repositories/user_repository.ts                    # + findPendingByActivationTokenHash, acceptInvitation
│       ├── repositories/lucid_user_repository.ts              # + the guarded transaction (D5)
│       └── transformers/user_transformer.ts                   # + toActivationPreview()
├── .adonisjs/client/registry/                                 # regenerated — committed Tuyau registry
└── tests/
    ├── unit/auth/invitation_acceptance/*.spec.ts              # NEW — use-case order, guarded write (SQLite)
    └── integration/auth/invitation_acceptance/*.spec.ts       # NEW — preview, accept, unusable, session, race

apps/web/
├── nginx.conf                                                 # + location ^~ /activate/ (D10)
└── src/
    ├── routes/
    │   ├── _activation.tsx                                    # NEW — GuestLayout, referrer head, no redirect
    │   └── _activation/activate.$token.tsx                    # NEW — thin, renders ActivationScreen
    └── features/auth/
        ├── helpers/new-password-schema.ts                     # NEW — extracted from the renewal form (D8)
        ├── mutations/use-invitation-acceptance.ts             # NEW — store mutation, success landing
        ├── queries/use-activation-preview.ts                  # NEW — token-keyed preview query (D12)
        ├── ui/activation-screen.tsx                           # NEW — the five states
        ├── ui/activation-form.tsx                             # NEW — useAppForm, applyValidationError
        ├── ui/password-renewal-form.tsx                       # imports the shared schema (no behavior change)
        └── __tests__/activation/*.test.tsx                    # NEW — success, unusable, validation, signed-in, recovery
```

**Structure Decision**: The existing vertical-slice layout on both sides.

- **API.** The acceptance is a new workflow slice under `app/auth`, beside login and password
  renewal. It is the user-side counterpart of an invitation, as renewal is of a reset (D2). Its
  persistence joins `UserRepository`, where GH-7 put the token write.
- **Web.** The screen lives in `features/auth`, beside the password renewal screen it mirrors,
  behind a third pathless layout sharing `GuestLayout`. That is exactly how `_password-renewal` was
  added (D11).
- **Workbench.** The GH-4 workbench needs no change: the activated user moves to the active view
  through the existing `activatedAt` and `activatedBy` projection.

## Phase 0 — Outline & Research

Complete. See [research.md](./research.md):

- D1: two public `POST` endpoints, with the secret in the body
- D2: the slice lives in `app/auth`
- D3: a usable link is found by digest, expiry, and pending status
- D4: one uniform `404`
- D5: one guarded transaction that consumes the link
- D6: a self-attributed activation event, and no renewal requirement
- D7: the open-session probe shared with `AuthMiddleware`
- D8: one password rule per side
- D9: the session opens after commit, with the session-not-opened answer
- D10: the confidentiality measures (nginx, `Referer`, history)
- D11: the `_activation` layout
- D12: the uncached, unretried preview query
- D13: the verification seams

## Phase 1 — Design & Contracts

Complete.

- [data-model.md](./data-model.md) fixes the only transition, the usability rule, the two repository
  operations, the projections, and the exceptions.
- [contracts/invitation-acceptance-api.md](./contracts/invitation-acceptance-api.md) fixes both
  endpoints, the acceptance's decision order, and every refusal.
- [contracts/activation-screen.md](./contracts/activation-screen.md) fixes the route, the layout's
  head, the five screen states, and how each API answer is rendered.
- [quickstart.md](./quickstart.md) is the runnable validation guide, including the confidentiality
  checks.

**Post-design Constitution re-check**: PASS, unchanged. The design adds two endpoints, one slice,
one route pair, and one nginx location, all inside existing patterns. It introduces no new layer, no
dependency, no table, and no state machine. It turns two would-be duplications into shared
definitions.

Two points surfaced during design and are resolved within the spec's contract, not by changing it:

- **The link format.** Moving the secret to a URL fragment would be the most robust confidentiality
  measure. It is deferred rather than taken, because it would break GH-7's delivered link format and
  every link already handed out (D10). The nginx and `Referer` measures meet FR-020 without it.
- **The "activated but no session" window.** FR-019 names this window, and it is answered in the
  very request that activated, so clarification 3's uniform outcome still holds for everyone else
  (D9).

## Complexity Tracking

No Constitution Check violation. Nothing to justify.
