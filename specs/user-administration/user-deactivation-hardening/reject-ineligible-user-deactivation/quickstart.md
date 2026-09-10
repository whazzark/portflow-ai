# Quickstart: Reject Ineligible User Deactivation

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contracts**:
[deactivate-user.md](./contracts/deactivate-user.md),
[user-deactivation-action.md](./contracts/user-deactivation-action.md)

How to run and prove this feature. It assumes the repository's usual setup: `pnpm install`, a
PostgreSQL instance from `docker/docker-compose.yml`, and `apps/api/.env` pointing at it.

## Run the stack

```bash
docker compose -f docker/docker-compose.yml up -d
pnpm --filter @portflow/api db:fresh     # migrations + seeds, drops and recreates
pnpm dev                                  # API on :3333, web on :3000
```

The API's dev server regenerates `.adonisjs/` — the Tuyau registry the web client imports. After
adding the route, restart it once so `tuyauQuery.users.deactivate` exists.

**Before you start, read [D11](./research.md#d11--the-seeded-datasets-limits-for-manual-verification).**
The seed contains five users, all active, and exactly one organization admin — Claire Martin,
`claire.martin@portflow.ai`, password `Password!234`, the account you sign in with. There is no
seeded pending, cancelled, or deactivated user, so those refusals are driven through the API below.
And a user you deactivate through the workbench **cannot be restored until GH-32 ships**: reset with
`pnpm --filter @portflow/api db:fresh`.

## Verify the API seam

```bash
pnpm --filter @portflow/api test --suites=unit --files="tests/unit/users/**"
pnpm --filter @portflow/api test --suites=integration --files="tests/integration/users/**"
```

Expected, per [deactivate-user.md](./contracts/deactivate-user.md):

| Scenario | Expected |
|---|---|
| No session | `401`, `E_UNAUTHORIZED_ACCESS` |
| Signed in as `OPERATIONS_ADMIN`, `OPERATIONS_LEAD`, or `OBSERVER` | `403`, `E_AUTHORIZATION_FAILURE`, target unchanged |
| Organization admin → an active user | `200`, `accessStatus: "DEACTIVATED"`, `deactivatedAt` set, `deactivatedBy` resolved to the acting admin |
| Organization admin → their own id | `409`, `E_USER_SELF_DEACTIVATION`, still active |
| Organization admin → a pending user | `409`, `E_USER_PENDING_INVITATION`, still pending |
| Organization admin → a cancelled user | `409`, `E_USER_CANCELLED_INVITATION`, still cancelled |
| Organization admin → an already deactivated user | `409`, `E_USER_ALREADY_DEACTIVATED`, original date and actor intact |
| Organization admin → an unknown UUID | `404`, `E_USER_NOT_FOUND` |
| Organization admin → `:id` that is not a UUID | `422`, `E_VALIDATION_ERROR`, no user read |
| The same active user, twice in a row | first `200`, second `409 E_USER_ALREADY_DEACTIVATED` |
| After a `200` | the target's `remember_me_tokens` rows are gone; every other user's remain |
| After any refusal | no row in `users` and no row in `remember_me_tokens` changed |

Manual check, signed in as the seeded organization admin:

```bash
# Sign in as Claire Martin (ORGANIZATION_ADMIN)
curl -i -c jar -X POST http://localhost:3333/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"claire.martin@portflow.ai","password":"Password!234"}'

# The collection, to pick identifiers
curl -s -b jar http://localhost:3333/api/v1/users | jq '.data[] | {id, email, accessStatus}'

# Refused: her own access
curl -s -b jar -X POST http://localhost:3333/api/v1/users/<claire-id>/deactivate | jq
# → 409 E_USER_SELF_DEACTIVATION

# Refused: a malformed identifier, before any user is read
curl -s -b jar -X POST http://localhost:3333/api/v1/users/not-a-uuid/deactivate | jq
# → 422 E_VALIDATION_ERROR

# Refused: an unknown but well-formed identifier
curl -s -b jar -X POST \
  http://localhost:3333/api/v1/users/00000000-0000-4000-8000-999999999999/deactivate | jq
# → 404 E_USER_NOT_FOUND

# Success, then the same call again
curl -s -b jar -X POST http://localhost:3333/api/v1/users/<thomas-id>/deactivate | jq
# → 200, deactivatedAt and deactivatedBy set
curl -s -b jar -X POST http://localhost:3333/api/v1/users/<thomas-id>/deactivate | jq
# → 409 E_USER_ALREADY_DEACTIVATED, and the first call's date and actor are unchanged
```

The pending and cancelled refusals have no seeded subject. Create one in a REPL and call the
endpoint against it:

```bash
pnpm --filter @portflow/api exec node --import reflect-metadata --import tsx ace.js repl
# > const { UserFactory } = await import('#database/factories/user_factory')
# > const pending = await UserFactory.apply('invited').create()
# > const cancelled = await UserFactory.apply('cancelled').create()
# > console.log(pending.id, cancelled.id)
```

## Prove the sign-in cut

With the API still running, and `<thomas-id>` deactivated above:

```bash
curl -i -c thomas-jar -X POST http://localhost:3333/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"thomas.bernard@portflow.ai","password":"Password!234"}'
# → 401, the same invalid-credentials outcome as a wrong password: no reason disclosed
```

For a session that was already open, sign in as Thomas **before** deactivating him, keep the cookie
jar, deactivate him from Claire's session, then reuse his jar:

```bash
curl -i -b thomas-jar http://localhost:3333/api/v1/auth/me
# → 401: auth_middleware re-reads the user on every request and refuses a non-ACTIVE one
```

## Verify the workbench

```bash
pnpm --filter @portflow/web test src/features/users
```

Then by hand at <http://localhost:3000/users>, signed in as Claire Martin:

| Step | Expected |
|---|---|
| Open the record of an active user other than Claire | A destructive `Deactivate` button in the footer |
| Open Claire's own record | No `Deactivate` button at all |
| Sign in as Thomas Bernard (`OPERATIONS_ADMIN`) and open any record | No `Deactivate` button; no status tabs either |
| Press `Deactivate` | A confirmation naming the user, no comment field, `Cancel` and `Deactivate` |
| Confirm | Toast `User “…” deactivated`; the record closes; the user leaves `Active` and the `Deactivated` count increments — no reload |
| Reopen the record from the `Deactivated` view | `Deactivated at` and `Deactivated by` appear in the access history |
| Deactivate a user already deactivated in another tab | The dialog stays open, a refusal toast explains, and the collection refreshes underneath |
| Stop the API, then confirm a deactivation | A retryable failure toast; nothing changes |

## Full verification before the PR

```bash
pnpm check
pnpm typecheck
pnpm test
```

Then a fresh read-only review of the final diff, per Constitution VII.
