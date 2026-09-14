# Quickstart: Reactivate a User with Fresh Credentials

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contracts**:
[reactivate-user.md](./contracts/reactivate-user.md),
[user-reactivation-action.md](./contracts/user-reactivation-action.md)

How to run and prove this feature. It assumes the repository's usual setup: `pnpm install`, a
PostgreSQL instance from `docker/docker-compose.yml`, and `apps/api/.env` pointing at it.

## Run the stack

```bash
docker compose -f docker/docker-compose.yml up -d
pnpm --filter @portflow/api db:fresh     # migrations + seeds, drops and recreates
pnpm dev                                  # API on :3333, web on :3000
```

The API's dev server regenerates `.adonisjs/`, the Tuyau registry the web client imports. After
adding the route, restart it once so `tuyauQuery.users.reactivate` exists.

**The seed has no deactivated user** ([research D13](./research.md#d13--the-seeded-dataset-and-manual-verification)).
Every scenario below starts by deactivating one through the delivered `#20` command. You sign in as
Claire Martin, the one organization admin, `claire.martin@portflow.ai` / `Password!234`. Thomas
Bernard (`thomas.bernard@portflow.ai`, same password) is the user deactivated and reactivated.
Reset any time with `pnpm --filter @portflow/api db:fresh`.

## Verify the API seam

```bash
pnpm --filter @portflow/api test --suites=unit --files="tests/unit/users/**"
pnpm --filter @portflow/api test --suites=integration --files="tests/integration/users/**"
pnpm --filter @portflow/api test --suites=integration --files="tests/integration/auth/**"
```

The last line is the regression guard for [research D5](./research.md#d5--a-session-opened-before-the-latest-reactivation-grants-nothing):
the login, session, remembered-connection, and renewal suites must pass unchanged.

Expected, per [reactivate-user.md](./contracts/reactivate-user.md):

| Scenario | Expected |
|---|---|
| No session | `401`, `E_UNAUTHORIZED_ACCESS` |
| `OPERATIONS_ADMIN`, `OPERATIONS_LEAD`, or `OBSERVER` | `403`, `E_AUTHORIZATION_FAILURE`, identical for a known and an unknown id, target unchanged |
| Organization admin whose own session owes a renewal | `403`, `E_PASSWORD_RENEWAL_REQUIRED` |
| Organization admin → a deactivated user | `200`, `accessStatus: "ACTIVE"`, `reactivatedAt` and `reactivatedBy` set, `deactivatedAt` and `deactivatedBy` unchanged, `passwordRenewalRequired: true` |
| Organization admin → an active user, or their own id | `409`, `E_USER_ALREADY_ACTIVE`, nothing recorded |
| Organization admin → a pending user | `409`, `E_USER_PENDING_INVITATION`, still pending, activation link unaffected |
| Organization admin → a cancelled user | `409`, `E_USER_CANCELLED_INVITATION`, still cancelled |
| Organization admin → an unknown UUID | `404`, `E_USER_NOT_FOUND` |
| Organization admin → `:id` that is not a UUID | `422`, `E_VALIDATION_ERROR`, no user read |
| The same deactivated user, twice in a row | first `200`, second `409 E_USER_ALREADY_ACTIVE`, first date and actor intact |
| After a `200` | the target's `remember_me_tokens` rows are gone, everyone else's remain; `password` unchanged |
| After any refusal | no row in `users` and no row in `remember_me_tokens` changed |

## Prove the round trip by hand

```bash
# Sign in as Claire Martin (ORGANIZATION_ADMIN)
curl -s -c claire -X POST http://localhost:3333/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"claire.martin@portflow.ai","password":"Password!234"}' > /dev/null

curl -s -b claire http://localhost:3333/api/v1/users | jq '.data[] | {id, email, accessStatus}'

# Thomas signs in BEFORE anything happens, and keeps that browser (cookie jar) open
curl -s -c thomas-old -X POST http://localhost:3333/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"thomas.bernard@portflow.ai","password":"Password!234"}' > /dev/null

# Deactivate him (#20, delivered), then reactivate him (this feature)
curl -s -b claire -X POST http://localhost:3333/api/v1/users/<thomas-id>/deactivate | jq .data.accessStatus
curl -s -b claire -X POST http://localhost:3333/api/v1/users/<thomas-id>/reactivate \
  | jq '.data | {accessStatus, reactivatedAt, reactivatedBy, deactivatedAt, passwordRenewalRequired}'
# → "ACTIVE", reactivation set, deactivation kept, passwordRenewalRequired: true

# Again: someone got there first
curl -s -b claire -X POST http://localhost:3333/api/v1/users/<thomas-id>/reactivate | jq .error.code
# → "E_USER_ALREADY_ACTIVE"
```

**The stale session stays dead** (FR-014):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -b thomas-old http://localhost:3333/api/v1/auth/me
# → 401, even though Thomas is ACTIVE again: that session predates the reactivation
```

**A fresh sign-in with the old password leads to the renewal step, and only there**:

```bash
curl -s -c thomas-new -X POST http://localhost:3333/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"thomas.bernard@portflow.ai","password":"Password!234"}' | jq .data.passwordRenewalRequired
# → true

curl -s -o /dev/null -w '%{http_code}\n' -b thomas-new http://localhost:3333/api/v1/customers
# → 403 (E_PASSWORD_RENEWAL_REQUIRED)

curl -s -b thomas-new -c thomas-new -X POST http://localhost:3333/api/v1/auth/password-renewal \
  -H 'content-type: application/json' \
  -d '{"password":"a-brand-new-passphrase","passwordConfirmation":"a-brand-new-passphrase"}'

curl -s -o /dev/null -w '%{http_code}\n' -b thomas-new http://localhost:3333/api/v1/customers
# → 200: the same session reaches the application
```

The pending and cancelled refusals have no seeded subject. Create one in a REPL, as the
deactivation quickstart does:

```bash
pnpm --filter @portflow/api exec node --import reflect-metadata --import tsx ace.js repl
# > const { UserFactory } = await import('#database/factories/user_factory')
# > console.log((await UserFactory.apply('invited').create()).id, (await UserFactory.apply('cancelled').create()).id)
```

## Verify the workbench

```bash
pnpm --filter @portflow/web test src/features/users
```

Then by hand at <http://localhost:3000/users>, signed in as Claire Martin, after deactivating Thomas
Bernard from his record:

| Step | Expected |
|---|---|
| Open the **Deactivated** tab | Thomas is listed. His row menu offers `Reactivate` |
| Open his record | A `Reactivate` button in the footer, not styled as destructive |
| Open any active, pending, or cancelled record | No `Reactivate` anywhere |
| Press `Reactivate` | `Reactivate user?`, naming Thomas, saying he can sign in again and must choose a new password first; no comment field |
| Press `Cancel` | Nothing changes; Thomas is still deactivated |
| Confirm | Toast `User “Thomas Bernard” reactivated`; the record closes; `Deactivated` count drops, `Active` count rises. No reload |
| Open the **Active** tab | Thomas's Password column reads `Renewal required` |
| Open his record | History shows `Deactivated` then `Reactivated`, each with date and `by Claire Martin`; Password reads `Renewal required` |
| In a second tab, reactivate a user already reactivated in the first | Refusal toast saying the user is already active; the collection refreshes |
| Stop the API, then confirm a reactivation | A retryable failure toast; nothing changes |
| In a private window, sign in as Thomas with `Password!234` | The renewal step, never the application, until he chooses a new password |
| Sign in as Thomas (`OPERATIONS_ADMIN`) after renewing | No status tabs and no `Reactivate` action |

## Full verification before the PR

```bash
pnpm check
pnpm typecheck
pnpm test
```

Then a fresh read-only review of the final diff, per Constitution VII.
