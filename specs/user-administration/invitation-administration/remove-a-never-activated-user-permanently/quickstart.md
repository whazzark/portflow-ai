# Quickstart — Remove a Never-Activated User Permanently

**Feature**: [spec.md](./spec.md) · **Contracts**: [API](./contracts/remove-user.md) · [workbench](./contracts/remove-action.md)

How to run this feature and prove it does what the spec says. Run every command from the repository
root.

## Prerequisites

```bash
pnpm install
docker compose -f docker/docker-compose.yml up -d   # PostgreSQL
pnpm --filter api db:fresh                          # migrate + seed
pnpm dev                                            # API and web together
```

The seeded organization admin is `claire.martin@portflow.ai`; every seeded account uses the factory
password `Password!234`. The seed carries active users only: create pending users through `Invite`
in the workbench, and cancelled or deactivated ones with the `UserFactory` states `cancelled` and
`deactivated` (invitation cancellation, GH-12, is not delivered).

## Automated verification

```bash
pnpm --filter api test --files "tests/unit/users/removal/*"
pnpm --filter api test --files "tests/integration/users/removal/*"
pnpm --filter web test src/features/users/__tests__/removal
```

Before the PR is ready:

```bash
pnpm check
pnpm typecheck
pnpm test
```

No end-to-end run: `apps/web/e2e` does not exist in this repository.

## Manual walkthrough

Sign in as the organization admin and open `/users`.

| # | Do this | Expect | Covers |
|---|---|---|---|
| 1 | Invite `jane.doe@example.com`, acknowledge the link, open the pending user's row menu | `Remove` is the last item; there is no `Deactivate` | FR-016 |
| 2 | Press `Remove`, then `Cancel` | Nothing sent; the user is still pending | FR-017, US1 scenario 6 |
| 3 | Press `Remove`, then `Remove` in the dialog | Toast `User “Jane Doe” removed`; the row leaves the table and the `Pending` count drops by one, without a reload | US1, FR-018, SC-005 |
| 4 | Query `user_activation_tokens` for the removed id | No row: the link copied in step 1 matches no stored digest, like an unknown link (acceptance, GH-8, has no screen yet to open it in) | FR-007 |
| 5 | Invite `Jane.Doe@Example.com ` again | Accepted as a new pending user, no conflict | FR-008 |
| 6 | Open the new user's record, press `Remove` in the footer, confirm | The record closes and the user is gone | FR-016, FR-018 |
| 7 | Open a cancelled user's record and remove them | Same outcome as a pending user | US1 scenario 2 |
| 8 | Open an active user's and a deactivated user's record, and your own | No `Remove` anywhere | FR-016 |
| 9 | Sign in as an operations admin and open `/users` | Active users only; no `Remove` anywhere | US3, FR-014 |

## Proving the refusals at the API

The interface is not the boundary — check the endpoint directly, with an organization admin's
session cookie:

```bash
# Active target, or your own id → 409 E_USER_ACTIVE_CANNOT_BE_REMOVED
curl -i -X DELETE "$API/api/v1/users/$ACTIVE_ID" -b "$COOKIE"

# Deactivated target → 409 E_USER_DEACTIVATED_CANNOT_BE_REMOVED
# Pending user named as a shift's responsible (ShiftFactory) → 409 E_USER_REFERENCED_CANNOT_BE_REMOVED
# The same pending id twice → 204, then 404 E_USER_NOT_FOUND
# An id that is not a UUID → 422
# Any of the above with an operations lead's cookie → 403, identical whatever the id names
```

After every refusal, `GET /api/v1/users` shows the target exactly as before.

The test suites run on SQLite; to see the `CASCADE` and `RESTRICT` behaviour on PostgreSQL without
touching the dev database, point them at a scratch one and drop it afterwards:

```bash
docker exec portflow-postgres psql -U postgres -c "CREATE DATABASE portflow_gh14_verify"
cd apps/api && DB_CONNECTION=postgres DB_PORT=5433 DB_DATABASE=portflow_gh14_verify \
  node --import tsx ace.js test --files "tests/unit/users/removal/*" --files "tests/integration/users/removal/*"
docker exec portflow-postgres psql -U postgres -c "DROP DATABASE portflow_gh14_verify WITH (FORCE)"
```

## Known limits, by design

- Nothing records who removed which user, or when (FR-012). A removal cannot be undone; the only way
  back is a new invitation.
- The invitation conflict refusal still points a pending or cancelled email to renewal or
  restoration, not to removal (spec, Out of Scope).
