# Implementation Plan: Let Active Users Manage Their Own Profile

**Branch**: `whazzark/let-active-users-update-their-identity` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`specs/user-administration/user-identity-update/let-active-users-update-their-identity/spec.md`

## Revisions — 2026-09-14

The product owner widened the slice after the identity was delivered and reviewed. Each change is
recorded where it belongs; this list is so a reviewer is not surprised:

- **The screen is the profile, and the naming reaches the API** ([research.md](./research.md) D16).
  `/profile`, `features/profile`, `app/users/profile/`, `PATCH /api/v1/me/profile`, and `Profile` in
  the user menu. `CONTEXT.md` gains **Profile** and **Password Change**. GH-24's administrator
  correction keeps `app/users/identity/` and `PATCH /api/v1/users/:id`.
- **Changing one's own password joins the slice** (US6, FR-021…FR-027,
  [contracts/patch-own-password.md](./contracts/patch-own-password.md),
  [research.md](./research.md) D15). It was in Out of Scope; it is now a second seam,
  `PATCH /api/v1/me/password`, on the same page. Tracing stays in GH-25 so the page ships in one pull
  request.
- **A password change revokes the user's other remembered connections**, sparing the one it was
  performed from — the rule the password renewal already applies.

## Summary

Open the identity correction GH-24 delivered to every active user, for their own identity, and give
them the password beside it.

**API.** One new write, `PATCH /api/v1/me/profile`. It carries no user identifier, sits behind the
password renewal gate by placement, and is admitted to every active role. It reuses GH-24's identity
rules wholesale: the normalization helpers, the validator fields, the locked read, and the
conditional write. It adds the one safeguard self-service needs: an address change must be confirmed
with the current password. That password is verified before any lock is taken, and before any
verdict on whether another user holds the address. The response is the session projection, so the
web refreshes the signed-in user from it directly.

**API, password** (2026-09-14). A second write, `PATCH /api/v1/me/password`, in the same slice: it
asks for the current password, refuses a new password equal to it, obeys the shared
`newPasswordFields`, and — in one transaction — replaces the hash and revokes every remembered
connection but the one the request came from.

**Web.** A new `/profile` route with its own feature module, holding two sections: **Identity** and
**Password**. The disabled "Profile · Coming soon" item in the user menu becomes an enabled
**Profile** entry. The identity form asks for the current password only while the email differs from
the stored one. The first name, last name, and email rules are shared with GH-24's `EditUserForm`
through one extracted schema, and the password rules with the renewal screen through
`new-password-schema.ts`.

Decisions and rejected alternatives are in [research.md](./research.md), the columns read and
written in [data-model.md](./data-model.md), and the two seams in [contracts/](./contracts/).

## Technical Context

**Language/Version**: TypeScript 5.7 on Node 22, ESM throughout the PNPM/Turbo monorepo.

**Primary Dependencies**:

- AdonisJS 7: Lucid, Bouncer, VineJS, session auth, and the `hash` service (scrypt).
- Tuyau for the typed API/web contract (ADR-0005).
- TanStack Start, Router, and Query.
- `useAppForm` and the shadcn/Tailwind primitives.
- Zod for client-side form rules.

**Storage**: PostgreSQL. No new table and no migration. `users` is the only table written, through
GH-24's `applyIdentity`, with `users_email_unique` on `LOWER(email)` as the authority on conflicts.

**Testing**:

- API: Japa `unit`, with SQLite per ADR-0014, for the use-case decisions. Japa `integration` for the
  endpoint's authorization and password matrix, and for sign-in after an address change.
- Web: Vitest, Testing Library, and MSW, rendering through the real router.
- No `apps/web/e2e` directory exists, so the browser pass is the manual one in
  [quickstart.md](./quickstart.md).

**Target Platform**: AdonisJS API server and a TanStack Start web application from this monorepo.

**Project Type**: Web application — `apps/api` + `apps/web`.

**Performance Goals**: SC-004 — 95% of accepted updates confirmed within 2 seconds. One request, at
most one scrypt verification (outside the transaction), one locked row, one conditional `UPDATE`.

**Constraints**:

- FR-003: no request input may name a user. Satisfied by a route without an identifier (D1).
- FR-004: the renewal gate applies by route placement.
- FR-009: the password is verified before any conflict verdict (D4).
- FR-010: the password is never stored, logged, or returned.
- FR-011: role, status, lifecycle columns, credentials, sessions, and remembered connections are
  untouched.
- Scrypt never runs inside a write, as `RenewPasswordUseCase` records.
- The `toObject()` session contract is reused unchanged.
- GH-24's `users.update` contract must not change.

**Scale/Scope**: one site, one organization, ≤ 200 users; one new endpoint, controller, use case,
validator, and pair of exceptions; one new route, feature module, and shared schema; one menu item
enabled.

## Constitution Check

*GATE: passed before Phase 0 research, re-checked after Phase 1 design — see the re-check below.*

| Principle | Assessment |
|---|---|
| I. Selected feature intent is versioned | PASS. Issue #25 is selected and its spec is written and clarified (2026-09-11). It is the contract this plan implements. |
| II. One independently deliverable feature per spec | PASS. One outcome: an active user updates their own identity. The API and web seams are two halves of one shippable write. Mailbox confirmation stays in GH-118, and correcting others stays in GH-24. |
| III. Vanilla Spec Kit gates | PASS. The spec is reviewed before this plan, and this plan awaits human review before `speckit-tasks`. |
| IV. Test-first observable behavior | PASS. RED → GREEN → REFACTOR in the order of D13, and every acceptance scenario maps to a Japa or Vitest seam (see quickstart). |
| V. Deep boundaries and explicit contracts | PASS. The policy authorizes; the use case decides (password, active row, unchanged submission) and owns the transaction; the repository owns the lock and conditional write through GH-24's operations; the controller adapts HTTP; the transformer projects. The web keeps the route thin and puts behavior in `features/profile` (ADR-0013, ADR-0008). |
| VI. Durable knowledge has a home | PASS. `User Identity Update` is already defined in `CONTEXT.md` and covers both paths; nothing is restated. No new ADR: every choice follows a decided pattern, and the one new shape, a page outside the resource workbenches, is recorded in research.md D9. |
| VII. Verification is part of delivery | PASS. `pnpm check`, `pnpm typecheck`, `pnpm test`, and the browser pass in [quickstart.md](./quickstart.md), then a fresh read-only review of the final diff. |
| VIII. One workflow owner | PASS. No new state machine. |

**Post-design re-check**: unchanged. The Phase 1 design adds one route, one use case, and one screen
inside existing patterns, and reuses GH-24's rules rather than duplicating them. No principle is
bent, and **Complexity Tracking is empty**.

## Project Structure

### Documentation (this feature)

```text
specs/user-administration/user-identity-update/let-active-users-update-their-identity/
├── spec.md
├── plan.md                          # This file
├── research.md                      # Phase 0 — D1…D13, decisions and rejected alternatives
├── data-model.md                    # Phase 1 — columns read and written, evaluation order
├── quickstart.md                    # Phase 1 — how to run and prove the feature
├── contracts/
│   ├── patch-own-profile.md        # PATCH /api/v1/me/profile
│   └── profile-screen.md           # /identity route, menu entry, form, outcomes
├── checklists/requirements.md
└── tasks.md                         # Phase 2 — produced by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── users/
│   │   ├── identity/
│   │   │   ├── update_own_profile_use_case.ts                # NEW — password, active row, apply
│   │   │   ├── update_own_profile_validator.ts               # NEW — identity fields + currentPassword
│   │   │   └── own_profile_exceptions.ts                     # NEW — D4's and D5's exceptions
│   │   └── shared/
│   │       ├── user_policy.ts                                 # + updateOwnProfile
│   │       └── user_validator.ts                              # + exported userIdentityFields
│   └── controllers/own_profile_controller.ts                 # NEW — update
├── start/routes.ts                                            # + me.profile.update (renewal-gated)
└── tests/
    ├── unit/users/profile/
    │   └── update_own_profile.spec.ts                        # NEW — use-case decisions
    └── integration/users/profile/
        └── update.spec.ts                                 # NEW — matrix, password, sign-in after

apps/web/
└── src/
    ├── routes/_authenticated/profile.tsx                     # NEW — thin route
    ├── components/layout/user-menu.tsx                        # Profile placeholder → Profile
    ├── components/layout/__tests__/authenticated-layout/
    │   └── user-menu.test.tsx                                 # placeholder expectations replaced
    ├── test/msw/handlers.ts                                   # + PATCH /api/v1/me/profile
    └── features/
        ├── users/
        │   ├── helpers/identity-schema.ts                     # NEW — shared name/email rules
        │   └── ui/edit-user-form.tsx                          # uses identity-schema
        └── identity/
            ├── mutations/use-own-profile-update.ts           # NEW — session seed + invalidation
            ├── ui/own-profile-page.tsx                       # NEW
            ├── ui/own-profile-form.tsx                       # NEW
            └── __tests__/
                ├── edit.test.tsx                              # NEW
                ├── email.test.tsx                             # NEW
                ├── refusals.test.tsx                          # NEW
                └── recovery.test.tsx                          # NEW
```

**Structure Decision**: the existing vertical-slice layout, unchanged.

- **API.** The self-service use case joins GH-24's in the `app/users/profile/` workflow slice, since
  it is the same workflow under another authorization path. Its validator and exceptions stay inside
  the slice, as `apps/api/AGENTS.md` asks, while the rules both paths obey stay under
  `app/users/shared/`.
- **Web.** A new `features/profile/` module owns the screen: it is not part of the administrator
  workbench in `features/users/`, which it only borrows a schema from.

## Phase sequence

1. **Shared rules**: extract `userIdentityFields` (API) and `identity-schema.ts` (web). GH-24's
   suites must stay green before anything else moves.
2. **Use case**, RED first against SQLite: password required, incorrect, and correct; re-cased
   address; unchanged submission; row no longer active; conflict only after verification; nothing
   else written.
3. **Policy, validator, exceptions, controller, route**, then the integration suite: the
   authorization matrix, the renewal gate, the password matrix, sign-in with the new and the former
   address, session and remember-me survival.
4. **Web**: MSW handler, mutation, page and form, route, menu entry, then the feature tests and the
   updated user-menu test.
5. **Verification**: `pnpm check`, `pnpm typecheck`, `pnpm test`, the browser pass, a fresh review.

## Review gate

This plan awaits human review before `/speckit-tasks`. These points are worth a reviewer's eye
because they are choices rather than consequences:

- **Endpoint shape** (D1): `PATCH /api/v1/me/profile`, a self resource with no identifier, rather
  than opening `PATCH /users/:id` to the requester.
- **Screen shape** (D9): a dedicated `/profile` page rather than a sheet or dialog over the current
  page.
- **Menu label** (D10): **Profile**, replacing "Profile", which `CONTEXT.md` avoids.
- **Cache refresh** (D12): invalidating every query after an accepted update, because the user's own
  name can be embedded anywhere a lifecycle actor is.

## Delivered

Implemented on 2026-09-11 against this plan, with the review findings resolved on 2026-09-14. The
shape is the one planned: one endpoint, one use case beside GH-24's in the same slice, one page, one
menu entry, and no migration.

**Widened on 2026-09-14** (see Revisions above): renamed to the profile end to end, and the password
change delivered beside the identity. After it: `pnpm check` and `pnpm typecheck` clean; API suite
1364/1364; web suite 1392/1392 across 290 files.

**Verification of the identity, before the widening**: `pnpm check` and `pnpm typecheck` clean; API suite 1349/1349; web suite 1386/1386
across 289 files; the browser pass of [quickstart.md](./quickstart.md) run against a throwaway
PostgreSQL, along with its `curl` checks. A fresh read-only review of the final diff is recorded in
[tasks.md](./tasks.md) T042.

**Deviations, each recorded where it belongs**:

- **A stale form is applied rather than refused** (spec clarification of 2026-09-14,
  [research.md](./research.md) D14). The review found that a form opened before an administrator's
  correction overwrites it silently. The product owner kept GH-24's reading; US5-3, the concurrency
  edge case, and SC-005 are amended. The address stays protected by the current password, so an
  address an administrator moved is never put back silently.
- **The client's password rule runs on submission only**, not on blur ([research.md](./research.md)
  D11). Judged on blur it fired while the password field had only just appeared, and TanStack Form
  then silently dropped the first click on **Save changes** — found in the browser, fixed, and
  pinned by a test.
- **The session cache is seeded under the exact key `SessionProvider` reads**, and the session is
  then left out of the invalidation that follows (D12).
- **The password-renewal requirement is re-checked under the lock**, beside the access status
  ([data-model.md](./data-model.md) rule 8), closing the same in-request window for an
  administrator's password reset.
- **The page keys its form on the user's id alone**, not on the address, so a session refreshed
  under the form never wipes what is being typed (tasks.md T018).

## Complexity Tracking

No constitution violation to justify. This section is intentionally empty.
