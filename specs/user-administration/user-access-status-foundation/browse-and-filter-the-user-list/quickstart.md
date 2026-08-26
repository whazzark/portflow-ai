# Quickstart: Browse and Filter the User List

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contracts**:
[get-users.md](./contracts/get-users.md), [users-workbench.md](./contracts/users-workbench.md)

How to run and prove this feature. It assumes the repository's usual setup: `pnpm install`, a
PostgreSQL instance from `docker/docker-compose.yml`, and `apps/api/.env` pointing at it.

## Run the stack

```bash
docker compose -f docker/docker-compose.yml up -d
pnpm --filter @portflow/api db:fresh     # migrations + seeds, drops and recreates
pnpm dev                                  # API on :3333, web on :3000
```

The API's dev server regenerates `.adonisjs/` — the Tuyau registry the web client imports. After
adding the route, restart it once so `tuyauQuery.users.index` exists.

## Verify the API seam

```bash
pnpm --filter @portflow/api test --suites=unit --files="tests/unit/users/**"
pnpm --filter @portflow/api test --suites=integration --files="tests/integration/users/**"
```

Expected, per [get-users.md](./contracts/get-users.md):

| Scenario | Expected |
|---|---|
| No session | `401`, `E_UNAUTHORIZED_ACCESS` |
| Signed in as `OBSERVER` or `OPERATIONS_LEAD` | `403`, `E_AUTHORIZATION_FAILURE` |
| Signed in as `ORGANIZATION_ADMIN`, users in all four statuses | `200`, every user, lifecycle fields present, `invitedBy` resolved to `{ id, firstName, lastName }` |
| Signed in as `OPERATIONS_ADMIN`, same fixture | `200`, only `accessStatus: "ACTIVE"` entries, no lifecycle field in any entry |
| Any authorized viewer | no `password` and no token in the payload |

Manual check with a seeded organization admin:

```bash
curl -i -c jar -X POST http://localhost:3333/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"<seeded admin email>","password":"<seeded password>"}'
curl -s -b jar http://localhost:3333/api/v1/users | jq '.data[0]'
```

## Verify the workbench

```bash
pnpm --filter @portflow/web test src/features/users
```

Then, signed in as an organization admin on http://localhost:3000:

1. The sidebar shows `Administration → Users`; it navigates to `/users`.
2. The active view is selected on arrival and its tab count matches the rows shown.
3. Switching to Pending, Deactivated, and Cancelled shows exactly those users, each with its own
   count and its own empty state where the status has none.
4. Typing a fragment of a first name, a last name, or an email narrows the visible rows, in any
   letter case; adding a role filter narrows further; clearing both restores the view.
5. Filters that exclude everything show a no-match state, distinct from an empty status view.
6. Opening a row opens the access record: identity, role, access status, then the recorded lifecycle
   events oldest first, each with its date and its responsible administrator where one exists.
   Unrecorded events are absent, not blank. No write action is offered.
7. The URL carries `status`, `search`, `role`, `sort`, `order`, and `userId`; reloading restores the
   same view and the same open record.

Signed in as an operations admin:

8. `Administration → Users` is present; `/users` lists active users only, with no status tabs and no
   lifecycle block in the record.

Signed in as an operations lead or an observer:

9. No `Administration` group in the sidebar, and navigating to `/users` directly surfaces the route's
   error state with no user information.

Then stop the API and reload `/users`: the screen must show a retryable failure, never an empty
collection. Restart the API, retry, and the collection loads without signing in again.

## Before the PR

```bash
pnpm check
pnpm typecheck
pnpm test
```
