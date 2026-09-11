# Quickstart: Invite a Pending User with a Confidential Activation Link

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contracts**:
[post-users.md](./contracts/post-users.md),
[invite-user-workbench.md](./contracts/invite-user-workbench.md)

How to run and prove this feature. It assumes the repository's usual setup: `pnpm install`, a
PostgreSQL instance from `docker/docker-compose.yml`, and `apps/api/.env` pointing at it.

## Run the stack

```bash
docker compose -f docker/docker-compose.yml up -d
pnpm --filter @portflow/api db:fresh     # migrations + seeds, drops and recreates
pnpm dev                                  # API on :3333, web on :3000
```

`WEB_ORIGIN` is now required (D3): it is already in `.env.example` and `.env.docker.example`, and
this slice adds it to `apps/api/.env.test` and to the `ci-checks.yml` job environment. A missing
value fails at boot, deliberately — an invitation must never hand out a link built from a guess.

The API's dev server regenerates `.adonisjs/` — the Tuyau registry the web client imports — and
`database/schema.ts`, which gains `UserActivationTokenSchema` once the migration has run. Restart it
once after adding the route so `tuyauQuery.users.store` exists.

## Verify the API seam

```bash
pnpm --filter @portflow/api test --suites=unit --files="tests/unit/users/**"
pnpm --filter @portflow/api test --suites=integration --files="tests/integration/users/**"
```

Expected, per [post-users.md](./contracts/post-users.md):

| Scenario | Expected |
|---|---|
| No session | `401`, `E_UNAUTHORIZED_ACCESS` |
| Signed in as `OPERATIONS_ADMIN`, `OPERATIONS_LEAD`, or `OBSERVER` | `403`, `E_AUTHORIZATION_FAILURE`, no user created |
| Organization admin, valid payload | `201`, `accessStatus: "PENDING"`, `invitedAt` set, `invitedBy` resolved, `password` absent, one activation token row |
| Same payload, padded and differently cased email | `409`, `E_USER_EMAIL_CONFLICT`, `meta.accessStatus` naming the existing user's status |
| Email held by a cancelled or deactivated user | `409` with that status; the existing user unchanged |
| Blank name, malformed email, unknown role | `422`, `E_VALIDATION_ERROR`, field-level details, no user created |
| Any successful invitation | `activationLink.expiresAt` is `invitedAt + 7 days` |
| `GET /api/v1/users` afterwards | the new pending user is listed; no activation link anywhere in the payload |
| Two concurrent invitations of one email | exactly one `201`, one `409`, one user |

Manual check with a seeded organization admin:

```bash
curl -i -c jar -X POST http://localhost:3333/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"<seeded admin email>","password":"<seeded password>"}'

curl -s -b jar -X POST http://localhost:3333/api/v1/users \
  -H 'content-type: application/json' \
  -d '{"firstName":"Claire","lastName":"Martin","email":"claire.martin@portflow.test","role":"OPERATIONS_LEAD"}' | jq

# The link is in that response and nowhere else:
curl -s -b jar http://localhost:3333/api/v1/users | jq '.data[] | select(.accessStatus=="PENDING")'
```

The second call must show the pending user with no activation link, and repeating the `POST` must
answer `409` with `meta.accessStatus: "PENDING"`.

## Verify the workbench

```bash
pnpm --filter @portflow/web test src/features/users
```

Then, signed in as an organization admin on http://localhost:3000:

1. `/users` offers the invitation entry point, and the pending view's empty state offers it too.
2. Opening it puts `mode=create` in the URL; reloading reopens the same form.
3. Submitting a blank name or a malformed email shows field-level messages and keeps what was typed.
4. Submitting an email that already exists shows a refusal naming its access status and the action
   that applies — renew, restore, reactivate, or nothing for an active user.
5. Submitting a valid invitation shows the activation link with a copy action, its expiry date, and
   the statement that it will not be shown again. Clicking outside and pressing `Escape` do not
   dismiss it.
6. Reloading at that moment shows the "no longer available" state naming the pending user and
   pointing to the activation link renewal — the proof that the link has no second read.
7. Acknowledging lands on the pending view with the new user highlighted, its record not opened, and
   the pending count incremented — with no reload and no new sign-in.
8. Opening that user's access record shows the invitation event, dated and attributed to you, and no
   activation link.

Signed in as an operations admin:

9. `/users` offers no invitation entry point, and a hand-typed `?mode=create` opens nothing.
10. `POST /api/v1/users` with that session is refused `403`, whatever the interface shows.

## Full verification before the PR

```bash
pnpm check
pnpm typecheck
pnpm test
```
