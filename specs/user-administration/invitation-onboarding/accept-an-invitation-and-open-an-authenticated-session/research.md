# Phase 0 Research: Accept an Invitation and Open an Authenticated Session

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-11

No `NEEDS CLARIFICATION` marker remained in the specification. The 2026-09-11 session settled four
points: the signed-in browser, the session type, the uniform unusable-link outcome, and the identity
shown. The decisions below were each checked against the code GH-7 delivered and the repository's
conventions. Every decision rests on existing seams; none adds a dependency or a table.

## D1 — Two public `POST` endpoints under `/api/v1/auth`, with the secret in the body

**Decision**: Add two routes outside the `auth()` middleware group, next to `auth.login`:

- `POST /api/v1/auth/invitation-acceptance/preview`, named `auth.invitation_acceptance.preview`,
  answers whose access a link activates.
- `POST /api/v1/auth/invitation-acceptance`, named `auth.invitation_acceptance.store`, accepts the
  invitation and opens the session.

Both take the secret as `token` in the JSON body and are served by one `InvitationAcceptanceController`.

**Rationale**: The secret is a credential, so it must never sit in an API URL. Request paths and
query strings are what access logs, reverse proxies, and error trackers record by default; request
bodies are not (FR-020). The preview is a read, but it is a read keyed by a credential, which is
the same reason a login is a `POST`. The routes sit under `/auth` because acceptance is a way to
open a session, like login, and the web already reaches `/auth/*` from outside the application
frame.

**Alternatives considered**:

- *`GET /api/v1/auth/invitation-acceptance/:token`*: rejected — it puts the secret in every access
  log between the browser and the API.
- *The secret in a custom header*: rejected — it works, but nothing else in the API reads a
  credential from a custom header, and the Tuyau contract models bodies, not bespoke headers.
- *One endpoint, with the identity returned only by the acceptance*: rejected — FR-001 wants the
  identity shown on opening, and US2 wants an unusable link recognized before a password is typed.

## D2 — The slice lives in `app/auth/invitation_acceptance`

**Decision**: Create `app/auth/invitation_acceptance/` holding `preview_invitation_use_case.ts`,
`accept_invitation_use_case.ts`, `invitation_acceptance_validator.ts`, and
`invitation_acceptance_exceptions.ts`. The persistence goes through the existing `UserRepository`.

**Rationale**: `CONTEXT.md` pairs each administrator-side action with a user-side counterpart.
Password renewal, the counterpart of a password reset, already lives in `app/auth`, next to login,
because its actor is the user and its outcome is about their own session. Acceptance is the
user-side counterpart of an invitation, performed by the invited person, and it ends in a login.
Login and password renewal already reach users through `UserRepository`, so acceptance does too.

**Alternatives considered**:

- *`app/users/invitation_acceptance`*: rejected — `app/users` holds the organization admin's
  workflows, every one of them behind `UserPolicy`. Acceptance has no policy and no administrator.
- *A dedicated `UserActivationTokenRepository`*: rejected — the token row and the user row are
  consumed in one transaction (D5). Two repositories would push the transaction up into the use
  case for a single write. GH-7 already put the token write inside `UserRepository.invite`.

## D3 — A usable link is found by digest, expiry, and pending status in one read

**Decision**: Export `digestActivationSecret(secret)` from
`app/users/shared/activation_link_issuer.ts` and make `issue()` use it, so issuance and lookup share
one SHA-256 definition. A link is usable when three things hold: a `user_activation_tokens` row
matches the presented token's digest, its `expires_at` is later than now, and its user is
`PENDING`. `UserRepository` gains `findPendingByActivationTokenHash(hash, now)`, which returns the
user or `null`. The preview calls it; the acceptance calls it again before hashing the password,
then relies on the guarded write (D5).

**Rationale**: GH-7 chose SHA-256 over a 256-bit secret for exactly this lookup: one indexed query
on `user_activation_tokens.hash`. Sharing the digest function turns "the lookup hashes the way the
issuer hashes" from a coincidence into a single definition. Three rules cover every unusable case
in FR-010:

| Unusable case | Rule that catches it |
|---|---|
| Never issued, malformed | No digest matches |
| Replaced by a renewal (GH-9) | No digest matches, because the row was replaced |
| Already used | No digest matches, because acceptance deletes the row (D5) |
| Expired | `expires_at` is not later than now |
| User no longer pending (GH-12 or later) | The user is not `PENDING` |

**Alternatives considered**:

- *Compare secrets in constant time after loading the row by user*: rejected — the link carries no
  user identifier, and a digest lookup on 256 bits of entropy leaks nothing a timing attack could
  exploit.
- *Check expiry in the use case against a loaded row*: rejected — the rule would then live in two
  places, the read and the guarded write. Passing `now` to the repository keeps it in the query, and
  keeps the clock testable.

## D4 — One uniform refusal: `404 E_ACTIVATION_LINK_UNUSABLE`

**Decision**: Every unusable-link case, on both endpoints, answers
`404 { error: { code: 'E_ACTIVATION_LINK_UNUSABLE', message: 'This activation link cannot be used' } }`,
with no `meta` and no `details`. The validator only requires `token` to be a string: no length,
charset, or format rule, so a malformed secret reaches the digest lookup and fails there, like any
other.

**Rationale**: Clarification 3 wants one outcome whatever the reason. Any validator rule on `token`
would give malformed links a distinguishable `422`. SHA-256 is cheap on any input, and the
bodyparser's existing size limit already bounds it. `404` is in the handler's `ignoreStatuses`, so a
stale link is never reported as an application error. Being logged is the one thing a secret must
not be. `404` is also the literal truth for every case: no usable link matches.

**Alternatives considered**:

- *`410 Gone`*: rejected — it is untrue for a link that never existed, and it is not in
  `ignoreStatuses`, so every stale link would be reported.
- *Separate codes per reason*: rejected by clarification 3.

## D5 — Acceptance is one guarded transaction that consumes the link

**Decision**: `UserRepository.acceptInvitation({ tokenHash, hashedPassword, acceptedAt })` returns
`{ kind: 'ACCEPTED'; user } | { kind: 'UNUSABLE' }`. In one transaction, it does three things:

1. **Consume the link.** A guarded `DELETE` on `user_activation_tokens` matches the digest with
   `expires_at > acceptedAt`, and must affect exactly one row.
2. **Activate the user.** A guarded `UPDATE` on `users` matches that user with
   `access_status = 'PENDING'`, and must affect exactly one row. It sets `password`,
   `access_status = 'ACTIVE'`, `activated_at = acceptedAt`, `activated_by_user_id` = the user's own
   id, and `updated_at`.
3. **Report.** Either zero-row outcome rolls back and reports `UNUSABLE`. On success, the user is
   reloaded and reported as `ACCEPTED`.

The password is hashed with scrypt before the call, never inside the transaction.

**Rationale**: The guarded delete is the concurrency control. Two acceptances racing on one link
both reach it, and only one deletes the row: the loser matches zero rows and rolls back. This is
the same guard-as-concurrency-control that `renewPassword` and `deactivateActive` use, and it holds
on both PostgreSQL and SQLite (FR-018). The row is deleted, not marked as used, for three reasons:
nothing reads a used link, the uniform outcome needs no "used" distinction, and GH-7 designed the
table to hold one live link. Hashing outside the transaction follows the rule
`renew_password_use_case.ts` states: a slow hash must never hold a write open.

**Alternatives considered**:

- *A `used_at` column*: rejected — it adds a migration and keeps a dead credential digest around,
  with no reader.
- *`SELECT … FOR UPDATE` followed by unguarded writes*: rejected — `forUpdate()` is a no-op on
  SQLite (ADR-0014). The guards are what make the outcome correct on both dialects.

## D6 — The activation event is self-attributed and leaves no renewal requirement

**Decision**: `activated_by_user_id` is the activated user's own id. `password_renewal_required_at`
stays `null`. `invited_at`, `invited_by_user_id`, identity, email, and role are not written. A pending
user holds no remembered connection, so there is nothing to revoke.

**Rationale**: The spec's assumptions follow `CONTEXT.md`: a user access status change is "optionally
attributed to the user who caused it", and the invited person causes their own activation (FR-006).
A renewal requirement exists for a credential someone else knows (FR-007). The user collection
already resolves `activatedBy` through `preloadAccessHistory`, so the organization admin's workbench
shows the event with no web change (US1-5).

## D7 — "A session is open" means exactly what `AuthMiddleware` accepts

**Decision**: Extract the authentication part of `AuthMiddleware.handle` into
`app/auth/shared/open_session.ts`. It exports `resolveOpenSessionUser(ctx): Promise<User | null>`,
which covers three things:

- the guard check, including a restore from a remembered connection;
- the fixed-expiry check on remembered connections;
- the `ACTIVE` status check.

`AuthMiddleware` calls it and throws `E_UNAUTHORIZED_ACCESS` on `null`, so its behavior is unchanged
and its existing tests are the regression net. `InvitationAcceptanceController.store` calls it and
passes `signedInUserId` into `AcceptInvitationInput`. The use case refuses a non-null value with
`409 E_INVITATION_ACCEPTANCE_SESSION_OPEN` before it reads the link or hashes anything. The preview
does not consult the session.

**Rationale**: The web decides which panel to show from `auth.me`, which goes through
`AuthMiddleware`. Suppose the API's idea of an open session were looser, for example the raw guard
check: a browser holding a stale session (a deactivated user's cookie, or an expired remembered
connection) would see the form, because `auth.me` answers `401`, yet the API would refuse every
submission as signed in. The person would be stuck on a screen they cannot complete. One function
used by both seams makes that impossible. The rule itself — never accept from someone else's
session — is a business decision, so it lives in the use case. The controller only reads the
session, as `PasswordRenewalController` only reads the remembered-connection cookie.

**Alternatives considered**:

- *`auth.use('web').check()` alone*: rejected — the stuck-screen defect above.
- *The `guest` middleware*: rejected — it redirects rather than refusing, and it has the same
  looseness as `check()`.
- *Silently replacing the session on acceptance*: rejected by clarification 1.

## D8 — One password rule, shared by both user-side password flows

**Decision**: Move the `password` and `passwordConfirmation` rules of `passwordRenewalValidator`
into `app/auth/shared/new_password_rule.ts`. They are 12 to 128 characters, with no validator trim, and
`confirmed({ as: 'passwordConfirmation' })`. Both `passwordRenewalValidator` and the new acceptance
validator compose them. On the web, move the Zod schemas out of `password-renewal-form.tsx` into
`features/auth/helpers/new-password-schema.ts`, the blur schema and the submit-time `refine`, and
use them in both forms.

**Rationale**: FR-004 requires the rule to be the renewal rule, not a copy of it. The constitution
(VI) forbids a second hand-maintained definition of a canonical decision. Sharing it on each side
keeps the API authoritative and the web a mirror, which is how the renewal already works. The
renewal's "must differ from the current password" refusal is a use-case check, not a validator
rule, so it does not travel. A pending user has no current password.

## D9 — The session opens after commit, and a failure to open it has its own answer

**Decision**: After `acceptInvitation` returns `ACCEPTED`, the controller calls
`auth.use('web').login(user)` without remembering, which regenerates the session id. It then answers
`200 { data: UserTransformer.transform(user) }`, the `toObject()` projection `auth.login` and
`auth.me` already return. If `login` throws after the commit, the controller answers
`E_INVITATION_ACCEPTED_SESSION_NOT_OPENED`, status `500` and reported, and the web tells the person
their access is active and links to the login screen (FR-019, US5-4).

**Rationale**: The write belongs to the repository and the session to the controller (principle V),
so the session can only open after the commit. The one failure window left is "activated, no
session", and FR-019 names it. Only the request that performed the activation can know it happened,
so answering it there discloses nothing to a stale-link holder; clarification 3 still holds. If the
response is lost on the network instead, the retry meets the uniform outcome. Its copy points to
logging in, and the chosen password works. That is the spec's fallback. Reporting the anomaly at
`500` is deliberate: it is a server fault an operator should see. The report carries the exception,
never the body.

The same `toObject()` projection keeps the web's session cache contract unchanged. Session
regeneration on login also closes session fixation, as it does at login.

**Alternatives considered**:

- *Opening the session inside the repository transaction*: rejected — it would make the repository
  depend on the HTTP context.
- *Returning `200` with `sessionOpened: false`*: rejected — a success status for a request that
  failed its second half would bypass every error path the web already has.

## D10 — The secret leaves the activation screen nowhere

**Decision**: Close each place the secret could leak:

| Leak path | Measure |
|---|---|
| API request | The secret travels only in request bodies (D1). |
| API responses and errors | No response carries it back. No exception message or `meta` includes it. The unusable-link refusal is not reported (D4). |
| Web server access log | `apps/web/nginx.conf` gains `location ^~ /activate/` with `access_log off` and `add_header Referrer-Policy "no-referrer" always`, serving `/index.html` with `try_files /index.html =404`. That form serves the file inside this location; the `try_files $uri /index.html` fallback of `location /` would be an internal redirect, finishing the request in `location /`, where it is logged and gets no header. |
| `Referer` header | The activation layout route sets `<meta name="referrer" content="no-referrer">` through its `head`. |
| Browser address bar and history | Leaving the screen after success uses `navigate({ replace: true })`, so the activation URL is replaced in history rather than kept behind the application. |

**Rationale**: FR-020 and SC-006. nginx's default access log records every path, and the path *is*
the secret: the link shape `/activate/<secret>` was fixed and handed out by GH-7. The API never
logs request bodies, and the handler reports exceptions without them. Three reasons each justify the
`Referer` measures: the SPA loads same-origin assets, the API is cross-origin, and a future external
link must not change the answer. The meta tag covers a dev server that ignores nginx; the header
covers any browser that honors only the header.

**Alternatives considered**:

- *Move the secret to a URL fragment (`/activate#<secret>`), which never reaches a server*:
  rejected for this slice — the most robust option, but it changes GH-7's delivered link format and
  would break every link already handed out within its 7-day window. It is worth reconsidering
  together with "Send invitation emails", before links start travelling by mail.
- *`access_log off` for the whole site*: rejected — it loses operational visibility for every other
  route to protect one.

## D11 — A pathless `_activation` layout, not `_guest`

**Decision**: Add `src/routes/_activation.tsx` and `src/routes/_activation/activate.$token.tsx`.
The layout renders `GuestLayout` and sets the referrer `head`. Its `beforeLoad` resolves the session
through `ensureSessionUser`, tolerating a `401`, and never redirects. The child route is thin and
renders `ActivationScreen` from `features/auth`. The screen owns five states:

| State | What the screen shows |
|---|---|
| Loading | Nothing yet |
| Unusable link | The D4 outcome |
| Signed in | The `auth.me` user is named, with a "Log out" action through the existing `useLogout` |
| Ready | The identity from the preview, then the password form |
| Accepted without a session | The D9 answer |

After success it runs `resetSession`, then `router.navigate({ to: '/', search: { section: 'rotations' }, replace: true })`.
On `E_INVITATION_ACCEPTANCE_SESSION_OPEN` it runs `resetSession` and `router.invalidate()`, so
the signed-in state renders from a fresh `auth.me`.

**Rationale**: `_guest` exists to push a signed-in user out, which would hide the signed-in panel
FR-015 requires. `_password-renewal` exists to keep a confined user in. Acceptance needs neither
redirect: it must render for everyone and decide inside the screen. A third pathless layout sharing
`GuestLayout` is exactly how `_password-renewal` was added. The screen lives in `features/auth`, the
module `apps/web/AGENTS.md` names as the shared exception, beside the renewal screen it mirrors.
`useLogout` already resets the session and invalidates the router without navigating, so a logout
from this screen stays on the same link and the form appears (US4-3).

The explicit `navigate` on success, instead of login's `invalidate()`, is needed because no guard on
this route redirects a signed-in user. It is also what makes the `replace` of D10 possible.

**Alternatives considered**:

- *A top-level `activate.$token.tsx` with no layout*: rejected — it would duplicate `GuestLayout`'s
  mounting and put the `head` on a leaf route that future activation screens (for GH-9 messaging,
  or email delivery) would not share.

## D12 — The preview is a query keyed by the token, never retried or cached

**Decision**: `ActivationScreen` loads the preview with `useQuery`, which calls the typed `tuyau`
client for `auth.invitation_acceptance.preview` with `retry: false`, `gcTime: 0`, and
`staleTime: Infinity`. A `404 E_ACTIVATION_LINK_UNUSABLE` renders the unusable state. A network or
unknown failure renders a retryable error with a "Try again" action that refetches.

**Rationale**: The preview is a read, so it belongs in the query layer, but `tuyauQuery` only offers
`mutationOptions` for a `POST` route, so the query calls the client directly. With `retry: false`, a
dead link answers at once instead of after three backoffs. With `gcTime: 0`, the token-keyed entry
leaves memory as soon as the screen unmounts. With `staleTime: Infinity`, a window refocus does not
replay the credential. Acceptance is a mutation through
`tuyauQuery.auth.invitationAcceptance.store.mutationOptions`, shaped like `useLogin`.

## D13 — Verification seams

**Decision**:

| Seam | What it covers |
|---|---|
| API unit, `tests/unit/auth/invitation_acceptance/` | The use-case decisions (session refusal first, unusable refusal, hashing outside the write) and the repository's guarded write against SQLite (ADR-0014): consumption, activation fields, rollback on either zero-row outcome, expiry at `acceptedAt`. |
| API integration, `tests/integration/auth/invitation_acceptance/` | Preview and acceptance end to end: the D3 unusable matrix on both endpoints, validation, the session-open refusal (including a confined session and a stale one), concurrency, the session-not-opened answer (a patched `SessionGuard.prototype.login`, the prototype-patch pattern `warehouses/update/update.spec.ts` uses), and the absence of the token in every response. |
| Web Vitest, `src/features/auth/__tests__/activation/` | `renderApp('/activate/<token>')` with MSW: success and landing with history replaced, the unusable state, validation and retry, the signed-in state and log out then continue, the session-not-opened state, and the referrer meta. |
| Regression | The existing `AuthMiddleware`, login, and password-renewal suites guard the D7 and D8 extractions. |

There is no `apps/web/e2e` directory in the repository, so this slice adds no browser journey. The
nginx change is checked manually in [quickstart.md](./quickstart.md).

The spec's acceptance scenarios map to these seams as follows:

| Spec scenarios | Seams |
|---|---|
| US1 | Integration and Vitest |
| US2 | Integration matrix and Vitest unusable state |
| US3 | Integration validation and Vitest form |
| US4 | Integration session-open and Vitest signed-in |
| US5 | Unit guarded write, integration concurrency and session-not-opened, Vitest retry |
