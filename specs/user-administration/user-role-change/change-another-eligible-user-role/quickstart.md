# Quickstart — Change Another Eligible User Role

**Feature**: [spec.md](./spec.md) · **Contracts**: [API](./contracts/change-user-role.md) · [workbench](./contracts/role-change-action.md)

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
password `Password!234` (`apps/api/database/factories/user_factory.ts`). The seeded dataset carries
active users only — the pending, cancelled, and deactivated cases below are created with the factory
states `invited`, `cancelled`, and `deactivated`.

## Automated verification

```bash
pnpm --filter api test --files "tests/unit/users/role_change/*"
pnpm --filter api test --files "tests/integration/users/role_change/*"
pnpm --filter web test src/features/users/__tests__/role-change
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
| 1 | Open an active user, use `Change role`, pick another role, submit | The record shows the new role; the table and the role filter's counts follow without a reload | US1, FR-012, FR-014 |
| 2 | Re-open the same user and submit the role they now hold | Accepted, nothing changes, no error is shown | FR-006 |
| 3 | Check the record after any change | Access status, email, and the access history are exactly as before; no "role changed" entry appears anywhere | FR-005, FR-016 |
| 4 | Switch to the `Pending` view, change a pending user's role | Accepted; the user stays pending | US1, FR-002 |
| 5 | Switch to the `Cancelled` view, change a cancelled user's role | Accepted; the user stays cancelled | US1, FR-002 |
| 6 | Open a deactivated user | No `Change role` action; the record says the user must be reactivated first | FR-003, FR-013 |
| 7 | Hand-type `/users?userId=<a deactivated user>&mode=edit` | The read-only record opens, not the form | FR-008, workbench contract |
| 8 | Reload the page while the form is open | The form is still open on the same user | URL-state convention |
| 9 | Sign in as an operations admin and open `/users` | No `Change role` action anywhere; `?mode=edit` opens nothing | US3, FR-008 |

## Proving the refusals at the API

The interface is not the boundary — check the endpoint directly. With an organization admin's session
cookie:

```bash
# Deactivated target → 409 E_USER_DEACTIVATED_CANNOT_CHANGE_ROLE
curl -i -X PATCH "$API/api/v1/users/$DEACTIVATED_ID/role" \
  -H 'Content-Type: application/json' -b "$COOKIE" -d '{"role":"OBSERVER"}'

# Unknown user → 404 E_USER_NOT_FOUND
# Invalid role → 422
# Same call with an operations lead's cookie → 403, whatever the id names
```

The 403 must come back identically for a pending, a cancelled, a deactivated, and a nonexistent id:
that is FR-009, and it holds because authorization runs before the target is read.

## Proving the new role reaches the user

1. Sign in as an operations admin in a second browser and confirm the administration screens they
   are entitled to.
2. As the organization admin, change that user's role to observer.
3. Back in the second browser, act again — the operations admin action is now refused, the navigation
   follows on the next `auth.me` fetch, and the session was never signed out.

That is US4 and FR-010/FR-011. Nothing was built for it: authorization is resolved from the row on
every request, and the session projection already carries the role.

## Known gap, by design

Until GH-29 ships, an organization admin can demote themselves or the last remaining organization
admin and lock the organization out of user administration. Do not expose the action to production
users before that slice lands.
