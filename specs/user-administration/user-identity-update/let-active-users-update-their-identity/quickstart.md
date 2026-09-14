# Quickstart: Let Active Users Manage Their Own Profile

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contracts**:
[patch-own-profile.md](./contracts/patch-own-profile.md),
[profile-screen.md](./contracts/profile-screen.md)

How to run and prove this feature. It assumes the repository's usual setup: `pnpm install`, a
PostgreSQL instance from `docker/docker-compose.yml`, and `apps/api/.env` pointing at it.

## Run the stack

```bash
docker compose -f docker/docker-compose.yml up -d
pnpm --filter @portflow/api db:fresh     # migrations + seeds, drops and recreates
pnpm dev                                  # API on :3333, web on :3000
```

This slice adds no migration. The API's dev server regenerates `.adonisjs/`, the Tuyau registry the
web client imports. Restart it once after the route is added, so that `tuyauQuery.me.profile.update`
exists.

## Verify the API seam

```bash
pnpm --filter @portflow/api test --suites=unit --files="tests/unit/users/profile/**"
pnpm --filter @portflow/api test --suites=integration --files="tests/integration/users/profile/**"
```

The second command also re-runs GH-24's `update.spec.ts`, which must stay green: the only change it
sees is the extracted `userIdentityFields`.

Expected, per [patch-own-profile.md](./contracts/patch-own-profile.md):

| Scenario | Expected |
|---|---|
| No session | `401` |
| Non-active user | `401` |
| Active user owing a password renewal | `403 E_PASSWORD_RENEWAL_REQUIRED`, nothing changed |
| Each active role, names only | `200`, session projection, new names |
| Address changed, no `currentPassword` | `422 E_CURRENT_PASSWORD_REQUIRED`, nothing changed, names included |
| Address changed, wrong `currentPassword` | `422 E_CURRENT_PASSWORD_INCORRECT`, nothing changed |
| Address changed to one another user holds, wrong `currentPassword` | `422 E_CURRENT_PASSWORD_INCORRECT`, not `409`: no conflict is revealed |
| Address changed to one another user holds (any status, any casing, padded), correct `currentPassword` | `409 E_USER_EMAIL_CONFLICT`, neither user changed |
| Address changed, correct `currentPassword` | `200`; the same session keeps working; sign-in with the new address succeeds, with the former one fails |
| Address re-cased only, no password | `200`, applied as typed |
| Blank, over-long, or malformed values | `422`, field named, nothing changed |
| Submission identical to the stored identity | `200`, nothing written, `updated_at` unchanged |
| Any success | `role`, `accessStatus`, lifecycle columns, `password`, and `passwordRenewalRequiredAt` unchanged; no remember-me token deleted |
| An organization admin renames themselves | Their name on the lifecycle events they are responsible for follows, in `GET /api/v1/users` |

Manual check with any seeded active user:

```bash
curl -s -c jar -X POST http://localhost:3333/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"<seeded email>","password":"<seeded password>"}' > /dev/null

# Names only: no password needed
curl -s -b jar -X PATCH http://localhost:3333/api/v1/me/profile \
  -H 'content-type: application/json' \
  -d '{"firstName":"Camille","lastName":"Renard","email":"<seeded email>"}' | jq '.data'

# Address change without the password: expect 422 E_CURRENT_PASSWORD_REQUIRED
curl -s -b jar -X PATCH http://localhost:3333/api/v1/me/profile \
  -H 'content-type: application/json' \
  -d '{"firstName":"Camille","lastName":"Renard","email":"camille.renard@example.com"}' | jq '.error'

# With it: expect 200, then the new address signs in and the former one does not
curl -s -b jar -X PATCH http://localhost:3333/api/v1/me/profile \
  -H 'content-type: application/json' \
  -d '{"firstName":"Camille","lastName":"Renard","email":"camille.renard@example.com","currentPassword":"<seeded password>"}' | jq '.data.email'

curl -s -b jar http://localhost:3333/api/v1/auth/me | jq '.data.email'   # same session, new address
```

## Verify the password seam

```bash
pnpm --filter @portflow/api test --suites=unit --files="tests/unit/users/profile/**"
pnpm --filter @portflow/api test --suites=integration --files="tests/integration/users/profile/**"
```

Expected, per [patch-own-password.md](./contracts/patch-own-password.md):

| Scenario | Expected |
|---|---|
| No session | `401` |
| Active user owing a password renewal | `403 E_PASSWORD_RENEWAL_REQUIRED` |
| Wrong or missing `currentPassword` | `422 E_CURRENT_PASSWORD_INCORRECT` (or `E_VALIDATION_ERROR` when absent), nothing written |
| New password equal to the current one | `422 E_PASSWORD_UNCHANGED` |
| New password under 12 characters, or a confirmation that differs | `422 E_VALIDATION_ERROR`, field named |
| Each active role, valid submission | `200`; sign-in works with the new password and fails with the former |
| Remembered on two browsers, changed from one | Only that browser's connection survives |

```bash
# Expect 422 E_CURRENT_PASSWORD_INCORRECT, then 200
curl -s -b jar -X PATCH http://localhost:3333/api/v1/me/password \
  -H 'content-type: application/json' \
  -d '{"currentPassword":"wrong","password":"correct-horse-battery-staple","passwordConfirmation":"correct-horse-battery-staple"}' | jq '.error.code'

curl -s -b jar -X PATCH http://localhost:3333/api/v1/me/password \
  -H 'content-type: application/json' \
  -d '{"currentPassword":"<seeded password>","password":"correct-horse-battery-staple","passwordConfirmation":"correct-horse-battery-staple"}' | jq '.data.email'
```

## Verify the web

```bash
pnpm --filter @portflow/web test src/features/profile src/features/users src/components/layout
```

The users and layout suites are included because the identity schema moves out of
`edit-user-form.tsx` and the user menu changes.

Then in the browser:

1. Sign in as an observer. Open the user menu: **Profile** is enabled and there is no
   **Coming soon**. Click it: `/profile` opens on two sections, **Identity** and **Password**, the
   identity pre-filled.
2. Change the last name, then **Save changes**. The toast confirms it, and the user menu shows the new
   name without a reload.
3. Change the email: a **Current password** field appears. Put the address back, in another casing:
   the field disappears.
4. Change the email and submit without a password: the field is refused. Type a wrong password: the
   field is refused and emptied, and the new address is still typed.
5. Type the address of another user and the correct password: the email field says the address is
   already used.
6. Type a free address and the correct password. It is applied, the menu shows it, and the session
   continues. Log out, sign in with the new address, and check that the former one is refused.
7. Reload `/profile`: the form reopens on the current identity.
8. Stop the API and submit: the failure is reported in the form and the typed identity is kept.
   Restart the API and submit again: it is applied.
9. As an organization admin, rename yourself on `/profile`, then open `/users`. Your row shows the
   new name, it still offers no **Edit**, and the lifecycle events you are responsible for name you
   with the new identity.
10. Have an organization admin require a password renewal for a user while that user has `/profile`
    open, then submit as that user. They are taken to `/password-renewal`, and nothing is changed.
11. In the **Password** section, submit with a wrong current password: the refusal lands on that
    field and empties it, while the new password typed is kept. Submit a new password under 12
    characters, then one whose confirmation differs: each is refused before anything is sent.
12. Submit a valid change. The toast confirms it, the form empties, and the session stays open. Log
    out, then sign in with the new password; the former one is refused.
13. Sign in on a second browser with **Remember me**, change the password from the first, and check
    that the second browser no longer restores the session while the first still works.

## Before the PR is ready

```bash
pnpm check
pnpm typecheck
pnpm test
```

Then the browser pass above, a fresh read-only review of the final diff, and human approval.
