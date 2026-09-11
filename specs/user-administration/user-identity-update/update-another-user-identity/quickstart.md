# Quickstart: Update Another User Identity

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contracts**:
[patch-user-identity.md](./contracts/patch-user-identity.md),
[users-workbench.md](./contracts/users-workbench.md)

How to run and prove this feature. It assumes the repository's usual setup: `pnpm install`, a
PostgreSQL instance from `docker/docker-compose.yml`, and `apps/api/.env` pointing at it.

## Run the stack

```bash
docker compose -f docker/docker-compose.yml up -d
pnpm --filter @portflow/api db:fresh     # migrations + seeds, drops and recreates
pnpm dev                                  # API on :3333, web on :3000
```

`db:fresh` runs the new `user_identity_changes` migration. The API's dev server regenerates
`.adonisjs/` — the Tuyau registry the web client imports — so restart it once after the route is
added and `tuyauQuery.users.update` exists.

## Verify the API seam

```bash
pnpm --filter @portflow/api test --suites=unit --files="tests/unit/users/**"
pnpm --filter @portflow/api test --suites=integration --files="tests/integration/users/**"
```

Expected, per [patch-user-identity.md](./contracts/patch-user-identity.md):

| Scenario | Expected |
|---|---|
| No session | `401` |
| Operations admin, operations lead, or observer | `403`, nothing changed |
| Organization admin whose own access status is not `ACTIVE` | `403` |
| Organization admin correcting another active user | `200`, corrected identity in the body, one new `identityChanges` entry with `changedBy` resolved |
| Same, targeting a deactivated or cancelled user | `200` — FR-003 puts every access status in reach |
| Same, targeting a pending user, names only | `200`, no activation link involved |
| Same, targeting a pending user, email changed | `409 E_USER_ACTIVATION_LINK_UNAVAILABLE`, identity unchanged, no history row — until GH-7 ships (D7) |
| Targeting themselves | `403 E_USER_IDENTITY_SELF_UPDATE` |
| Unknown id | `404 E_USER_NOT_FOUND` |
| Email held by another user, any access status, any casing, padded with spaces | `409 E_USER_EMAIL_CONFLICT`, neither user changed |
| Blank, over-long, or malformed values | `422`, field named, nothing changed |
| Submission identical to the stored identity | `200`, no new `identityChanges` entry |
| Any success | `role`, `accessStatus`, lifecycle columns, `password`, and `passwordRenewalRequiredAt` unchanged; no token revoked |

Manual check with a seeded organization admin:

```bash
curl -i -c jar -X POST http://localhost:3333/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"<seeded admin email>","password":"<seeded password>"}'

TARGET=$(curl -s -b jar http://localhost:3333/api/v1/users \
  | jq -r '.data[] | select(.email != "<seeded admin email>") | .id' | head -1)

curl -s -b jar -X PATCH "http://localhost:3333/api/v1/users/$TARGET" \
  -H 'content-type: application/json' \
  -d '{"firstName":"Camille","lastName":"Renard","email":"camille.renard@example.com"}' | jq '.data'

# The history is carried by the collection, since there is no per-user seam
curl -s -b jar http://localhost:3333/api/v1/users | jq --arg id "$TARGET" \
  '.data[] | select(.id == $id) | .identityChanges'
```

Sign in as an operations admin instead and confirm `identityChanges` is **absent** from every entry,
not empty.

## Verify the workbench

```bash
pnpm --filter @portflow/web test src/features/users
```

Then in the browser, signed in as an organization admin:

1. Open `/users`, open any user other than yourself — the record shows an `Edit` action.
2. Correct the first name, submit. The panel returns to the record, the row and the avatar initials
   follow, and the correction appears in the identity history with your name and today's date.
3. Reload with `?userId=<id>&mode=edit` in the address bar — the edit panel opens on that user.
4. Submit an address another user already holds, in a different casing. The email field is refused
   and what you typed is still there.
5. Leave through **Back to details** — nothing is changed.
6. Open your own record: no `Edit` action. Type `?mode=edit` by hand on it: nothing opens.
7. Sign in as an operations admin: no `Edit` action anywhere, and no identity history in any record.

## Before the PR is ready

```bash
pnpm check
pnpm typecheck
pnpm test
```

Then the browser pass above, a fresh read-only review of the final diff, and human approval.
