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

This slice adds no migration. The API's dev server regenerates `.adonisjs/` — the Tuyau registry the
web client imports — so restart it once after the route is added and `tuyauQuery.users.update`
exists.

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
| Organization admin correcting another active user | `200`, corrected identity in the body |
| Same, targeting a deactivated or cancelled user | `200` — FR-003 puts every access status in reach |
| Same, targeting a pending user, names only | `200`, their activation link untouched |
| Same, targeting a pending user, email changed | `409 E_USER_PENDING_EMAIL_LOCKED`, message explaining why, identity unchanged (D7) |
| Targeting themselves | `403 E_USER_IDENTITY_SELF_UPDATE` |
| Unknown id | `404 E_USER_NOT_FOUND` |
| Email held by another user, any access status, any casing, padded with spaces | `409 E_USER_EMAIL_CONFLICT`, neither user changed |
| Blank, over-long, or malformed values | `422`, field named, nothing changed |
| Submission identical to the stored identity | `200`, nothing written |
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

# A pending user's address cannot move: expect 409 E_USER_PENDING_EMAIL_LOCKED and its explanation
PENDING=$(curl -s -b jar http://localhost:3333/api/v1/users \
  | jq -r '.data[] | select(.accessStatus == "PENDING") | .id' | head -1)

curl -s -b jar -X PATCH "http://localhost:3333/api/v1/users/$PENDING" \
  -H 'content-type: application/json' \
  -d '{"firstName":"Camille","lastName":"Renard","email":"another.mailbox@example.com"}' | jq '.error'
```

## Verify the workbench

```bash
pnpm --filter @portflow/web test src/features/users
```

Then in the browser, signed in as an organization admin:

1. Open `/users`, open the row menu of any user other than yourself — it reads **View**, **Edit**,
   then the access actions. **Edit** opens the correction directly.
2. Open that user's record instead — `Edit` sits on the left of the footer, the access actions on the
   right.
3. Correct the first name, submit. The panel returns to the record, and the row and the avatar
   initials follow.
4. Reload with `?userId=<id>&mode=edit` in the address bar — the edit panel opens on that user.
5. Submit an address another user already holds, in a different casing. The email field is refused
   and what you typed is still there.
6. Open a pending user and change their email: the form explains that it cannot change until they have
   activated their access, and keeps what you typed. Change only their name: it is applied.
7. Leave through **Back to details** — nothing is changed.
8. Open your own record and your own row menu: no `Edit`. Type `?mode=edit` by hand on your record:
   nothing opens.
9. Sign in as an operations admin: no `Edit` anywhere.

## Before the PR is ready

```bash
pnpm check
pnpm typecheck
pnpm test
```

Then the browser pass above, a fresh read-only review of the final diff, and human approval.
