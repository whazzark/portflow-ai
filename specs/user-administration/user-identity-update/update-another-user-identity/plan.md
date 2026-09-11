# Implementation Plan: Update Another User Identity

**Branch**: `whazzark/update-another-user-identity` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`specs/user-administration/user-identity-update/update-another-user-identity/spec.md`

## Revisions — 2026-09-11

Two product decisions narrowed the delivery after the plan was approved, and one convention was
aligned. Each is recorded where it belongs; this list is so a reviewer is not surprised:

- **The identity correction history is deferred.** The former US4 (FR-013, FR-014, SC-005) — the
  `user_identity_changes` table, the `identityChanges` key on `toAdministration()`, the history block
  in the record — was built, then removed at the product owner's request. No migration ships with this
  slice. [research.md](./research.md) D3 and D4 are marked superseded.
- **A pending user's email address cannot be corrected; the refusal explains why.** No activation link
  is reissued and there is no link port in this slice any more: `UpdateUserIdentityUseCase` refuses
  with `409 E_USER_PENDING_EMAIL_LOCKED` and writes nothing. A pending user's names stay correctable.
  GH-7 (#292) owns `ActivationLinkIssuer` for invitations; this slice does not use it. D7 is
  superseded.
- **The workbench entry points follow the customer directory**: `Edit` in the row actions menu and
  `Edit` on the left of the record footer, both fed by one rule, and the `mode` search parameter is
  `create | edit | view` as on `/customers` (D11).

## Summary

Turn the read-only user workbench into one that can repair an identity. The API gains a single write
— `PATCH /api/v1/users/:id` — reserved to an active organization admin acting on someone other than
themselves: it validates the first name, last name, and email, keeps the address unique across the
organization, applies the three columns in one transaction around a locked read, and touches nothing
else about the user. The web gains `mode=edit` on the existing `/users` route, an edit panel inside
the record sheet, and two entry points — the row actions menu and the record footer — in the shape the
customer directory already has.

A **pending** user's email address is deliberately not correctable: their invitation was issued for
the address on record, and the product owner chose a plain, explained refusal over reissuing the link
(2026-09-11). The use case answers `409 E_USER_PENDING_EMAIL_LOCKED` whenever a pending target's
address would change; their names remain correctable. See [research.md](./research.md) D7.

Decisions and rejected alternatives are in [research.md](./research.md); the columns written and the
projection are in [data-model.md](./data-model.md); the two seams are in [contracts/](./contracts/).

## Technical Context

**Language/Version**: TypeScript 5.7 on Node 22, ESM throughout the PNPM/Turbo monorepo.

**Primary Dependencies**: AdonisJS 7 (Lucid, Bouncer, VineJS, session auth), Tuyau for the typed
API/web contract (ADR-0005), TanStack Start + Router + Query, `useAppForm` and the shadcn/Tailwind
primitives, Zod for route search-param validation.

**Storage**: PostgreSQL. No new table and no migration; `users`, whose `users_email_unique` index on
`LOWER(email)` already enforces FR-010, is the only table written.

**Testing**: Japa for the API — `unit` for the repository outcomes and use-case decisions, SQLite per
ADR-0014, and `integration` for the endpoint's authorization matrix and response shape. Vitest +
Testing Library + MSW for the web, rendering through the real router. No `apps/web/e2e` directory
exists, so the browser pass is the manual one in [quickstart.md](./quickstart.md).

**Target Platform**: AdonisJS API server and a TanStack Start web application from this monorepo.

**Project Type**: Web application — `apps/api` + `apps/web`.

**Performance Goals**: SC-003 — an accepted correction confirmed within 2 seconds. One request, one
transaction, one locked row, one cache invalidation.

**Constraints**: GH-4's FR-006a forbids a per-user consultation seam; FR-006 keeps the API
authoritative; FR-011 forbids touching role, access status, lifecycle columns, credentials, sessions,
and remembered connections; the `toObject()` session contract behind `/auth/me` and `/auth/login` must
not change; ADR-0003 means there is one organization, so FR-007 is satisfied by construction (D9).

**Scale/Scope**: one site, one organization, ≤ 200 users; one new endpoint, one new use case, one new
web mode, one new panel, one new form, one shared rule for the two entry points.

## Constitution Check

*GATE: passed before Phase 0 research, re-checked after Phase 1 design — see the re-check below.*

| Principle | Assessment |
|---|---|
| I. Selected feature intent is versioned | PASS — issue #24 is selected, its spec is written, clarified, and reviewed, and is the contract this plan implements. |
| II. One independently deliverable feature per spec | PASS — one outcome: an administrator can repair another user's identity. The API and web seams are two halves of one shippable write. Activation links stay GH-7's (D7); the history, deferred, would be its own slice (D3); self-service stays in GH-25. |
| III. Vanilla Spec Kit gates | PASS — spec reviewed before this plan; this plan awaited human review before `speckit-tasks`. The two places where delivery is narrower than the first spec — no history, no pending-email correction — are stated, not silently implemented. |
| IV. Test-first observable behavior | PASS — RED → GREEN → REFACTOR in the order of D12; every acceptance scenario maps to a Japa or Vitest seam. |
| V. Deep boundaries and explicit contracts | PASS — policy authorizes, use case decides and coordinates the transaction, repository owns the lock and the conditional write with typed outcomes, controller adapts HTTP, transformer owns the projection, the web feature module owns screen behavior behind a thin route (ADR-0013, ADR-0007, ADR-0008). |
| VI. Durable knowledge has a home | PASS — `User Identity Update` is already defined in `CONTEXT.md` and is not restated. No new ADR: the panel, the row menu, and the footer all follow patterns the repository has already decided. |
| VII. Verification is part of delivery | PASS — `pnpm check`, `pnpm typecheck`, `pnpm test`, and the browser pass in [quickstart.md](./quickstart.md) before the PR is ready, then a fresh read-only review of the final diff. |
| VIII. One workflow owner | PASS — no new state machine; Spec Kit owns the artifacts, GitHub owns status. |

**Post-design re-check**: unchanged. The Phase 1 design adds one route and one use case, inside
existing patterns. No principle is bent, and **Complexity Tracking is empty**.

## Project Structure

### Documentation (this feature)

```text
specs/user-administration/user-identity-update/update-another-user-identity/
├── spec.md
├── plan.md                          # This file
├── research.md                      # Phase 0 — D1…D12, decisions and rejected alternatives
├── data-model.md                    # Phase 1 — the columns written, the projection
├── quickstart.md                    # Phase 1 — how to run and prove the feature
├── contracts/
│   ├── patch-user-identity.md       # PATCH /api/v1/users/:id
│   └── users-workbench.md           # /users URL, entry points, panel, form
├── checklists/requirements.md
└── tasks.md                         # Phase 2 — produced by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── users/
│   │   ├── identity/
│   │   │   └── update_user_identity_use_case.ts               # NEW — decisions + transaction
│   │   └── shared/
│   │       ├── user_policy.ts                                 # + updateIdentity
│   │       ├── user_exceptions.ts                             # + D8's exceptions
│   │       ├── user_validator.ts                              # NEW — updateUserIdentityValidator
│   │       ├── normalize_user_identity.ts                     # NEW — trim + name rules, comparisons
│   │       └── repositories/
│   │           ├── user_repository.ts                         # + findByIdForUpdate, applyIdentity
│   │           └── lucid_user_repository.ts                   # + locked read, conditional write
│   └── controllers/users_controller.ts                        # + update
├── start/routes.ts                                            # + users.update
└── tests/
    ├── unit/users/identity/
    │   ├── update_user_identity.spec.ts                       # NEW — use-case decisions
    │   └── apply_identity.spec.ts                             # NEW — repository outcomes, SQLite
    └── integration/users/identity/
        └── update.spec.ts                                     # NEW — authorization matrix, payload

apps/web/
└── src/
    ├── routes/_authenticated/users.tsx                        # + mode edit/view, transform
    └── features/users/
        ├── helpers/user-identity.ts                           # NEW — mayEditUserIdentity
        ├── mutations/use-user-mutations.ts                    # + updateIdentity
        ├── ui/users-page.tsx                                  # + edit mode, row-menu entry
        ├── ui/user-table.tsx                                  # + onEdit on the row menu
        ├── ui/user-row-actions.tsx                            # + Edit item
        ├── ui/user-sheet.tsx                                  # + mode switch
        ├── ui/user-access-record.tsx                          # owns the footer, + Edit on the left
        ├── ui/user-access-actions.tsx                         # buttons + confirmation only
        ├── ui/edit-user-identity-panel.tsx                    # NEW
        ├── ui/user-identity-form.tsx                          # NEW
        └── __tests__/identity/
            ├── edit.test.tsx                                  # NEW — journey, refusals
            ├── permissions.test.tsx                           # NEW — who is offered the action
            ├── recovery.test.tsx                              # NEW — failures and retry
            └── row-menu.test.tsx                              # NEW — the row entry point
```

**Structure Decision**: the existing vertical-slice layout, unchanged. The API gains one workflow
slice, `app/users/identity/`, beside the existing `app/users/list/`, with everything shared by the
domain under `app/users/shared/` — the shape `app/trucks/` already has. The web keeps the route file
thin and puts the one rule both entry points ask under `features/users/helpers/`.

## Phase sequence

1. **Repository** — the locked read and the conditional write, with typed outcomes (`UPDATED`,
   `NOT_FOUND`, `EMAIL_TAKEN`). RED first, against SQLite.
2. **Domain rules** — `normalize_user_identity` and `user_exceptions`.
3. **Use case** — self-exclusion, the unchanged-submission short circuit, the pending-email refusal,
   the mapping from outcomes to exceptions.
4. **Policy, validator, controller, route** — then the integration suite's authorization matrix.
5. **Web** — route parameter and transform, mutation, edit panel and form, the shared rule, the row
   menu and footer entry points, then the feature tests.
6. **Verification** — `pnpm check`, `pnpm typecheck`, `pnpm test`, the browser pass, fresh review.

## Review gate

**Confirmed on 2026-09-10**, then **revised on 2026-09-11**. The plan first delivered FR-015's
pending-user branch as a fail-closed port waiting on GH-7. GH-7 has since shipped (#292), and the
product owner chose not to reissue links from a correction at all: a pending user's email address is
refused with an explanation, which removes the port and any dependency on GH-7. Every other access
status, and a pending user's names, are fully correctable.

The identity history was deferred on the same date; it may return as a slice of its own.

The plan is approved for `/speckit-tasks`.

## Delivered

Implemented on 2026-09-10 against this plan, revised on 2026-09-11 as recorded above. Two shape
refinements are recorded where they belong — the repository's two operations in
[research.md](./research.md) D5, and the corrected `401`/`403` rows in
[contracts/patch-user-identity.md](./contracts/patch-user-identity.md), since a viewer whose access is
not active is refused by `middleware.auth()` before any policy runs.

Verification after the 2026-09-11 revisions, on top of #292: `pnpm check` and `pnpm typecheck`
clean; API suite 1104/1104; web suite 1128/1128. The fresh read-only review is recorded as not run in
[tasks.md](./tasks.md).

## Complexity Tracking

No constitution violation to justify. This section is intentionally empty.
