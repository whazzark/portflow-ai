# Quickstart: Accept an Invitation and Open an Authenticated Session

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contracts**:
[invitation-acceptance-api.md](./contracts/invitation-acceptance-api.md),
[activation-screen.md](./contracts/activation-screen.md)

This guide shows how to run the feature and prove it works. It assumes the repository's usual
setup:

- `pnpm install` has run;
- a PostgreSQL instance is running from `docker/docker-compose.yml`;
- `apps/api/.env` points at that instance, with `WEB_ORIGIN=http://localhost:3000`, which GH-7
  made required.

## Run the stack

```bash
docker compose -f docker/docker-compose.yml up -d
pnpm --filter @portflow/api db:fresh     # migrations + seeds, drops and recreates
pnpm dev                                  # API on :3333, web on :3000
```

This slice adds no migration. The API dev server regenerates `.adonisjs/client/registry`, the Tuyau
registry the web imports, which is committed. Restart it once after adding the two routes, so
`tuyauQuery.auth.invitationAcceptance` exists, and commit the regenerated registry.

## Verify the API seam

```bash
pnpm --filter @portflow/api test --suites=unit --files="tests/unit/auth/**"
pnpm --filter @portflow/api test --suites=integration --files="tests/integration/auth/**"
```

The whole `auth` folder runs, not just the new files. The existing login, logout, `me`, and
password-renewal suites guard the two extractions this slice makes: the open-session probe (D7) and
the shared password rule (D8).

Expected results, per [invitation-acceptance-api.md](./contracts/invitation-acceptance-api.md):

| Scenario | Expected |
|---|---|
| Preview, usable link | `200`, exactly `firstName`, `lastName`, `email` |
| Preview or accept, link never issued, malformed, expired, used, or user not `PENDING` | `404`, the identical `E_ACTIVATION_LINK_UNUSABLE` body every time |
| Preview twice, then accept | The preview changed nothing; the acceptance succeeds |
| Accept, usable link, valid password, no session | `200` with the `toObject()` projection, `accessStatus: "ACTIVE"`, `activatedByUserId` = own id, `passwordRenewalRequired: false`, session cookie set, no `remember_web`, token row deleted |
| Login afterwards with the chosen password | `200` |
| Accept, password of 11 or 129 characters, or a mismatched confirmation | `422`, `details` on the field; the user stays `PENDING`; the link is still usable |
| Accept, password with surrounding spaces | `200`; login succeeds with or without the spaces, because the bodyparser trims every JSON string at login too (see data-model.md) |
| Accept while logged in, including a session confined to a password renewal | `409`, `E_INVITATION_ACCEPTANCE_SESSION_OPEN`; the link is still usable; the session is unchanged |
| Accept with a stale session (a deactivated user's cookie) | `200`; the stale session is replaced |
| Two concurrent acceptances through one link | Exactly one `200` and one `404`; one password recorded; one activation event |
| `SessionGuard.prototype.login` patched to throw | `500`, `E_INVITATION_ACCEPTED_SESSION_NOT_OPENED`; the user is `ACTIVE` and can log in |
| Any response of this contract | Never contains the token |

Manual check: invite a user as an organization admin, as in the GH-7 quickstart. Copy the secret
from `activationLink.url`, then:

```bash
curl -s -X POST http://localhost:3333/api/v1/auth/invitation-acceptance/preview \
  -H 'content-type: application/json' -d '{"token":"<secret>"}' | jq

curl -i -c jar2 -X POST http://localhost:3333/api/v1/auth/invitation-acceptance \
  -H 'content-type: application/json' \
  -d '{"token":"<secret>","password":"correct-horse-battery-staple","passwordConfirmation":"correct-horse-battery-staple"}'

curl -s -b jar2 http://localhost:3333/api/v1/auth/me | jq '.data.accessStatus'   # "ACTIVE"

# The same secret again answers the same 404 as a made-up one:
curl -s -X POST http://localhost:3333/api/v1/auth/invitation-acceptance/preview \
  -H 'content-type: application/json' -d '{"token":"<secret>"}'
curl -s -X POST http://localhost:3333/api/v1/auth/invitation-acceptance/preview \
  -H 'content-type: application/json' -d '{"token":"nope"}'
```

## Verify the activation screen

```bash
pnpm --filter @portflow/web test src/features/auth
```

Then, on http://localhost:3000:

1. Open a fresh activation link in a private window. The screen shows the invited person's name and
   email, a password field, and a confirmation field. There is no "remember me" and no application
   navigation.
2. Submit an 11-character password, then a mismatched confirmation. Each gets a field-level message,
   and what you typed stays.
3. Submit a valid password. The browser lands on the rotations view, logged in as the invited user
   with their role's navigation. Pressing Back does not return to the activation link.
4. Open the same link again. You get "This activation link can't be used", with no name or email,
   pointing to login and to asking an organization admin. A made-up `/activate/nope` shows exactly
   the same screen.
5. Log out, then log in with the chosen password. It works.
6. As an organization admin in another window, open `/users`. The user is in the active view, no
   longer pending, and their access record shows the activation event attributed to themselves.
7. Still logged in as that admin, open a second fresh link. The screen shows whose access it
   activates and "You're logged in as <admin>", with no password form. Click "Log out": the same
   screen now offers the form, and completing it logs you in as the invited user.
8. Close the browser after an activation and reopen the application. The session is gone, because
   it was a temporary one.

## Verify that the secret stays confidential

- **Referrer**: in the browser devtools on the activation screen, `document.querySelector('meta[name="referrer"]').content`
  is `no-referrer`.
- **Access log**: build and run the web image, then open an activation link:

```bash
docker build -f apps/web/Dockerfile -t portflow-web . && docker run --rm -p 8080:8080 portflow-web
# open http://localhost:8080/activate/test-secret, then:
docker logs <container> | grep -c activate        # 0
curl -sI http://localhost:8080/activate/test-secret | grep -i referrer-policy   # no-referrer
```

## Full verification before the PR

```bash
pnpm check
pnpm typecheck
pnpm test
```

After that, a fresh read-only review of the final diff is required (constitution VII).
