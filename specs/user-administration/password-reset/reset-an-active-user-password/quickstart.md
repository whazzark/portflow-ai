# Quickstart: Reset an Active User Password

**Feature**: `GH-17` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

How to run this feature and prove it works end to end. Shapes and reasoning live in
[contracts/http-api.md](./contracts/http-api.md), [data-model.md](./data-model.md), and
[research.md](./research.md); this file is the run guide.

## Prerequisites

- Node 22, `pnpm@10.28.1`, and a reachable PostgreSQL for `apps/api` (tests use better-sqlite3 and
  need nothing running).
- `pnpm install` at the repository root.
- The migration for this feature applied, which also regenerates `apps/api/database/schema.ts`:

```bash
pnpm --filter @portflow/api db:migrate
```

Reseed from scratch when the fixture users drift:

```bash
pnpm --filter @portflow/api db:fresh
```

## Run it

```bash
pnpm dev                       # api on :3333, web on :3000
```

## Validate by hand

Two browsers, or one browser and one private window, so the target's confinement is observable.

1. **Sign in as an organization admin** and open **Users**.
2. **Sign in as an active non-admin user** in the second browser, choosing *remember me*, and reach
   the application normally.
3. Back in the first browser, open that user's access record. The **Reset password** action is
   offered. Open it: the confirmation names the user and states that they will have to choose a new
   password before using the application again. **Cancel** — nothing changes (FR-016).
4. Confirm. The record and the collection show the outstanding renewal without a manual reload
   (FR-018, FR-020), and the access history gains a dated **Password reset** entry attributed to you
   (FR-003, FR-019).
5. In the second browser, do anything at all. The session is not signed out; it reaches nothing but
   the password renewal step (US1-3, US3-2).
6. Close that browser and reopen it. The remembered connection no longer restores a session — the
   revocation (FR-004a, US3-1).
7. Sign in there with the password the user already had. Sign-in succeeds and the renewal step is
   presented (US3-3). Choose a new password: the requirement clears, the application becomes
   reachable in the same session, and the **Password reset** entry stays in the access history
   (US1-4, data model).
8. Back as the administrator, check the refusals: the action is absent on a pending, deactivated, or
   cancelled user, and absent on your own record (FR-015, FR-007).
9. Sign in as an operations admin and open Users: no reset action anywhere, and no outstanding-renewal
   indicator on any user (FR-009, FR-019).

## Validate the API directly

The workbench must never be the only thing enforcing a rule (FR-009), so exercise the endpoint on its
own — with an operations admin's session, an operations lead's, an unauthenticated client, and an
administrator who owes their own renewal. Each must be refused with the status and code in
[contracts/http-api.md](./contracts/http-api.md#refusals), and each must leave the target's
requirement, reset event, and remembered connections untouched.

```bash
curl -i -b cookies.txt -X POST http://localhost:3333/api/v1/users/<id>/password-reset
```

## Automated verification

```bash
pnpm check                                                  # Biome format + lint
pnpm typecheck                                              # both apps
pnpm test                                                   # both suites
pnpm --filter @portflow/api test unit                       # use case only
pnpm --filter @portflow/api test integration                # endpoint contract
pnpm --filter @portflow/web test                            # workbench
```

New test files, following the conventions in `apps/api/tests/README.md` — unit tests in narrative
order, integration tests in request-flow order:

| File | Covers |
|---|---|
| `apps/api/tests/unit/users/password_reset/reset_user_password_use_case.spec.ts` | records the requirement and the attributed event; refuses a non-active target, an unknown target, and a self-reset; leaves everything untouched on refusal |
| `apps/api/tests/integration/users/administration/password_reset.spec.ts` | the full request contract: `401`, `403` unauthorized, `403` confined requester, success, `404`, `409`, `422`; revocation of the target's remembered connections and only theirs; the response disclosing no credential; repeated and concurrent resets leaving one requirement |
| `apps/web/src/features/users/__tests__/password-reset/*` | the action's visibility per role and target status, the confirmation and its cancellation, the record and collection reflecting the outstanding renewal, the reset event in the access history, and each refusal's feedback |

Use `UserFactory.apply('passwordReset')` for a user who already owes a renewal from a reset, and
`rememberOnANewBrowser` from `tests/integration/auth/password_renewal.spec.ts` as the model for
establishing and then asserting the absence of remembered connections.

## Browser journey

`apps/web` changes, so run the affected journey before marking the PR ready — steps 1 through 7
above are the journey.

## Definition of done

- Every acceptance scenario in [spec.md](./spec.md) is covered by one of the files above.
- `pnpm check`, `pnpm typecheck`, and `pnpm test` pass.
- A fresh read-only review of the final diff is obtained and every confirmed finding is resolved or
  explicitly justified (constitution VII).
