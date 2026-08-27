# Research: Force a Password Change After Login

**Feature**: `GH-117` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

Phase 0 findings. Each decision records what was chosen, why, and what was rejected. Findings are
grounded in the delivered `#115` / `#116` authentication code and in `@adonisjs/auth`'s session guard
as it is actually installed, not inferred from the issue text.

Three things shape this slice and are worth stating before the decisions:

1. **The enforcement point already exists.** `AuthMiddleware` re-reads the user on every request and
   refuses a session whose `accessStatus` is no longer `ACTIVE`. The renewal requirement is the same
   shape of rule — a per-request check against a fresh row — so this slice adds a second gate beside
   an existing one rather than inventing a mechanism.
2. **The risk is not in the write.** Recording a password and clearing a flag is one guarded `UPDATE`.
   The risk is in the *route surface*: a confinement that any newly added endpoint silently escapes is
   worse than no confinement, because it reads as protection. **D3** and **D4** are the two
   decisions this slice most needs a reviewer to look at.
3. **One requirement cannot be implemented exactly as written**, for a reason that only shows up in
   the guard's source. **D8** records what ships instead, and why it fails in the safe direction.

---

## D1 — The requirement is one nullable timestamp on `users`

**Decision**: Add `users.password_renewal_required_at` (`timestamp`, nullable). Non-null means the
requirement stands; the renewal sets it to `NULL`. No actor column, no comment column, no history
table, and no new `access_status` value.

**Rationale**: The requirement is a user attribute, not a session attribute — spec assumption, and the
reason is load-bearing: it must survive sign-out (US2-4, FR-022), apply on every browser at once
(US2-3), and be cleared once for the user rather than once per session (FR-016). A column on `users`
is the only shape that gives all three for free.

A timestamp rather than a boolean because it costs the same, matches every other state marker on the
table (`invited_at`, `activated_at`, `cancelled_at`, `deactivated_at`, `reactivated_at`), and answers
"since when" for the administrator-side slices that will write it. No `password_renewal_required_by_user_id`
accompanies it: **this slice never writes the column**, and the actor belongs to whichever action
records the requirement. `#17` (Password Reset) and `#32` (User Reactivation) already have their own
actor columns to write — `reactivated_by_user_id` exists today — and inventing a third here would
guess at their design (FR-023).

No new `access_status` value. `CONTEXT.md` defines the access statuses as *pending, active,
deactivated, cancelled*, and a user owing a renewal is unambiguously **active**: they authenticate,
they hold a session, and every non-active status is rejected at login with the invalid-credentials
outcome (FR-002). Making the requirement a status would either break that rule or force a fifth value
into every consumer of `USER_ACCESS_STATUSES`.

**Alternatives rejected**:
- *A boolean `password_renewal_required`* — same cost, less information, out of step with the table.
- *A fifth access status* — see above; also collapses two independent axes into one.
- *A `password_renewals` history table* — nothing in the spec asks for renewal history, and the
  administrator-side slices will record their own action's context anyway.
- *Deriving the requirement from `password IS NULL`* — a pending user has a null password (see
  `LoginUserUseCase`'s comment on why `verifyCredentials()` was abandoned), so the two states would be
  indistinguishable, and an active user's password is never null.

---

## D2 — The migration needs no dialect branch

**Decision**: One migration, `1785500000000_add_user_password_renewal.ts`, adding a single nullable
timestamp. Plain `alterTable`, no `disableTransactions`, no SQLite branch.

**Rationale**: This is the exact question `#253`'s research [D2] got wrong and had to correct at
implementation time, so it was checked rather than assumed. The rule the correction established is
that on SQLite, knex implements *any added column carrying a `REFERENCES` clause* by rebuilding the
table — create, copy, `DROP TABLE`, rename — and that `DROP` is refused while foreign-key enforcement
is on if anything references the table.

`users` is referenced by more tables than `trucks` is: `remember_me_tokens`, every `*_by_user_id`
actor column across customers, trucks, transport companies, docks, weighing areas, warehouses, and
`users` itself. **A rebuild here would fail loudly.** The migration avoids it by adding no foreign
key: a bare `timestamp` column is a plain `ALTER TABLE ADD COLUMN` on both dialects.

The precedent is verified rather than argued: `1785300000000_add_archived_with_warehouse_to_warehouse_doors.ts`
adds a non-FK column to `warehouse_doors` — a table referenced by
`warehouse_door_product_lot_assignments` and `shift_warehouse_doors` — with no dialect branch and no
`disableTransactions`, and it is green in the suite today.

This is the single strongest argument for **D1**'s "no actor column" decision holding even if a
later slice wants one: adding `password_renewal_required_by_user_id` to `users` **will** need the
`PRAGMA foreign_keys` window that `1785200000000_add_transport_companies_contact_details.ts` and the
truck suspension migration document. Whoever delivers `#17` should read this paragraph first.

`database/schema.ts` is regenerated by `migration:run`, never edited.

---

## D3 — The confinement is a named middleware over a re-shaped route tree, not a route-name allowlist

**Decision**: Add `app/middleware/password_renewal_middleware.ts`, registered in `start/kernel.ts` as
`passwordRenewalCompleted`. Split the current single `/api/v1` group in two:

```text
/api/v1/auth   → middleware.auth()                                    // me, logout, password-renewal
/api/v1        → middleware.auth(), passwordRenewalCompleted()        // everything else
```

**Rationale**: FR-006 allows exactly three things through — the session representation, the renewal,
and sign-out — and refuses everything else. There are two ways to express "everything else", and they
fail in opposite directions.

Matching route names inside the middleware (`if (ctx.route?.name === 'auth.me') return next()`) keeps
the route file untouched and is deny-by-default, but it makes a **route rename a silent security
change**: `session-context.tsx` already depends on the name `auth.me` through
`Route.Response<'auth.me'>`, so the name is load-bearing in two unrelated places with nothing
connecting them.

Splitting the group moves the decision to where routes are declared. A new business endpoint added
anywhere inside the `/api/v1` group is confined without anyone remembering to do anything, which is
the failure direction that matters — a forgotten exemption produces a 403 someone reports, while a
forgotten guard produces a silent bypass. The residual footgun is the small `/api/v1/auth` group; that
is what **D4** tests.

Route names are unchanged by the split: a group `.as('auth')` with `.as('me')` inside still produces
`auth.me`, whether the group sits at the top level or nested. Tuyau's generated types and the web
client are untouched.

The middleware reads `ctx.auth.use('web').getUserOrFail()`, which the session guard has already loaded
fresh from the database during this request (`#authenticateViaId` calls `findById` every time). No
second query is needed, and the check therefore sees a requirement recorded seconds ago by another
administrator — FR-005 and US2-7.

**Alternatives rejected**:
- *Route-name allowlist inside the middleware* — above.
- *Fold the check into `AuthMiddleware`* — `AuthMiddleware` guards `/api/v1/auth` too, so it would have
  to learn which of its own routes to exempt, reintroducing the allowlist inside a class whose job is
  authentication, not authorization.
- *`.use()` on each of the seven resource groups* — allowlist-by-omission: the one thing a reviewer
  cannot see is a `.use()` that was never written.

**Observed, not changed**: `AuthMiddleware` re-fetches the user with `User.find(authenticatedUser.id)`
after `authenticateUsing` has already loaded the same row. It is redundant, but removing it is
unrelated to this slice and would touch a delivered security path for no behavioral gain.

---

## D4 — A route-inventory test proves the confinement, instead of trusting the route file

**Decision**: `tests/integration/auth/password_renewal_confinement.spec.ts` enumerates the registered
routes through `router.toJSON()` and, for every `/api/v1` pattern that is not one of the three
exemptions, issues a real request from a confined session and asserts `403`.

**Rationale**: **D3** moved the security decision into `start/routes.ts`, so the test has to read
`start/routes.ts` as the application actually loaded it — not as a hand-maintained list that drifts
from it. `router.toJSON()` is the same API `node ace list:routes` uses (verified in
`@adonisjs/core/build/commands/list/routes.js`), returning route nodes keyed by domain with `pattern`,
`name`, and `methods`.

This converts both of the slice's structural risks into test failures:

- a new endpoint added inside `/api/v1` that somehow escapes the group ⇒ the test requests it and gets
  something other than `403`;
- a new endpoint added to the small `/api/v1/auth` group ⇒ it is not in the three-entry exemption list,
  the test requests it, and a deliberate exemption has to be written down to make it pass.

Path parameters are filled with an arbitrary UUID. The assertion is safe because the middleware runs
before the controller, so a confined request is refused before any lookup can turn it into a `404` —
which is itself FR-006's "no business data is disclosed" restated as a test.

**Alternatives rejected**:
- *A hand-written list of protected endpoints* — the drift this test exists to catch.
- *Asserting middleware names off the route nodes* — the middleware container serializes awkwardly
  (`#formatMiddlewareAsString` in the ace command exists for this reason), and it would prove the
  middleware is *attached*, not that it *refuses*.

---

## D5 — Login succeeds; the requirement gates the application, not authentication

**Decision**: `LoginUserUseCase` and `LoginController` are unchanged. A user owing a renewal receives
`200` and a session, exactly like any other active user. The requirement is visible in the response
body (**D6**) and enforced from the next request onward.

**Rationale**: This is a spec assumption, and the code shows why there is no alternative.
`LoginUserUseCase` deliberately collapses every rejection reason — unknown email, wrong password,
non-active status — into one `InvalidCredentialsException`, with a dummy hash verification so a lookup
miss cannot be timed apart from a wrong password. `CONTEXT.md` states the same rule for `Login`.
Refusing a user who owes a renewal would either have to reuse that indistinguishable outcome — leaving
them no route to the renewal at all — or introduce a distinguishable one, which would tell an attacker
that a given address belongs to a real account whose password was just reset. The requirement gates
the application; authentication is untouched.

It also means the slice writes no new code in the login path, which is worth stating plainly: the
delivered `#115` behaviour, including the remembered-connection window, is unchanged.

---

## D6 — The session representation exposes a boolean, not the timestamp

**Decision**: `UserTransformer#toObject()` gains `passwordRenewalRequired: boolean`, derived from
`passwordRenewalRequiredAt !== null`. The timestamp itself is not serialized.

**Rationale**: FR-008 requires the session representation to say whether a renewal is owed *and* to
disclose nothing about why the requirement exists. A timestamp says *when* an administrator acted,
which — paired with the fact that the only two producers are a password reset and a reactivation —
tells the user more about administrative activity than the requirement itself does. The interface
needs one bit to choose a route; it gets one bit.

`toObject()` is currently reached only through `auth.me` and `auth.login`, both of which serialize the
signed-in user to themselves, so no other consumer's payload changes.

---

## D7 — The renewal is one guarded `UPDATE`, with no transaction and no row lock

**Decision**: `LucidUserRepository#renewPassword` issues

```sql
UPDATE users SET password = ?, password_renewal_required_at = NULL
WHERE id = ? AND password_renewal_required_at IS NOT NULL
```

and returns the affected row count. Zero rows means the requirement was already cleared; the use case
turns that into `E_PASSWORD_RENEWAL_NOT_REQUIRED`.

**Rationale**: FR-016 asks for exactly-once under repeated and concurrent submissions, and FR-017 asks
for no partial state on refusal. A single-row conditional `UPDATE` is atomic in both PostgreSQL and
SQLite, so the guard *is* the concurrency control. The truck lifecycle slices reach for
`SELECT … FOR UPDATE` because they must read a related row (the transport company) inside the same
transaction; there is no second row here, so the lock would protect nothing.

The same guarded `UPDATE` also delivers FR-024's refusal for a user who owes no renewal — one
mechanism, two requirements — and it is the reason the renewal can never overwrite a password that a
concurrent renewal has already set.

Password hashing (`hash.make`) happens before the `UPDATE`, outside any transaction: scrypt at
`cost: 16384` is deliberately slow, and holding a write transaction across it would be the one way
this endpoint could affect unrelated traffic.

---

## D8 — Other remembered connections are revoked by keeping the request's own token; one edge fails safe

**Decision**: The controller reads `remember_web` from the request and verifies it through
`User.rememberMeTokens.verify()`, passing the resulting identifier — or `null` — into the use case as
part of its command. The use case deletes every other token the user holds. With no identifier, all of
the user's tokens are deleted.

The split matters for principle V: reading a cookie is HTTP adaptation and belongs to the controller,
while *which* tokens survive a renewal is a business decision and belongs to the use case. Keeping
`ctx.request` out of the use case is also what makes the revocation rule unit-testable without an HTTP
context.

**Rationale**: FR-015 requires the replaced credential to stop restoring access anywhere while the
renewing browser stays signed in (FR-014), and US3-3 requires that browser's own remembered connection
to keep working after a restart. So the current token must be identified rather than swept.

Reading and verifying the request cookie is exactly what `AuthMiddleware` already does — it verifies
`remember_web` **before** calling `authenticateUsing`, and the ordering is not incidental. The session
guard's `#authenticateViaRememberCookie` *recycles* on use: it deletes the presented token, creates a
replacement, and sets a new cookie. Verifying after authentication would sometimes verify a token that
no longer exists.

**This is the requirement that cannot be implemented exactly as written.** On a request where the
session was restored from the remember cookie (`viaRemember === true`), the presented token has
already been recycled by the time the use case runs, so `verify()` returns `null` and *all* tokens are
deleted — including the fresh one this browser just received. The consequence is bounded and benign:
the session stays valid, so FR-014 holds and the user is not signed out or interrupted; they simply
have to sign in again the next time they reopen the browser. Revoking too much is the safe direction
for a slice whose entire purpose is to stop a replaced credential from working.

The case is also nearly unreachable through the product: a restored session is created by the very
first request the web shell makes, `GET /auth/me`, so the renewal `POST` always runs on an established
session with an un-recycled cookie. It is reachable only by a client whose *first* request is the
renewal itself. It is recorded here, and asserted in a test, rather than left for someone to discover.

**Alternatives rejected**:
- *Delete every token, then re-issue one for the remaining lifetime* — closes the edge above, but
  requires re-implementing the guard's private `#createRememberMeCookie` and re-deriving the fixed
  expiry. The repository already owns one override of the token provider
  (`FixedExpiryRememberMeTokensProvider`); a second, deeper coupling to the guard's internals buys a
  case that the product cannot reach.
- *Capture the recycled identifier in `AuthMiddleware` and pass it down* — the middleware reads the
  token *before* recycling, so the identifier it holds is the deleted one. It would have to read the
  response cookie back to find the replacement.
- *Leave every remembered connection alone* — rejected at spec time; it leaves the replaced credential
  restoring access for up to 30 days.
- *Revoke everything including the current browser* — rejected at spec time; FR-014.

---

## D9 — No current-password field; sameness is checked against the stored hash

**Decision**: The request body is `{ password, passwordConfirmation }`. FR-011 is enforced with
`hash.verify(user.password, password)` against the stored hash, refused as `422`
`E_PASSWORD_RENEWAL_UNCHANGED`.

**Rationale**: FR-009 states the reasoning — the session already proves the user holds the current
password, and the practical case is someone typing a credential an administrator handed them. Asking
for it again adds a field without adding proof.

`422` rather than `409` because the refusal is about the submitted value, matching
`E_TRUCK_TRANSPORT_COMPANY_INVALID`'s use of `422` for a value that is well-formed but not acceptable;
`409` in this codebase means a lifecycle conflict.

One consequence for the web: `applyValidationError` maps `details[]` onto form fields, and only VineJS
errors carry `details` — the exception handler emits `meta` for `Exception` subclasses. So the renewal
form maps `E_PASSWORD_RENEWAL_UNCHANGED` onto the password field explicitly rather than the response
being shaped to look like a validation error it is not.

The confirmation is checked by VineJS's `confirmed` rule, which reports the failure against the
*other* field rather than the one it is attached to (verified in the installed build). A mismatch is
therefore a plain `E_VALIDATION_ERROR` naming `passwordConfirmation`, and it reaches that field through
the existing `applyValidationError` path with no mapping at all.

---

## D10 — Minimum 12, maximum 128, no composition rules, no trimming

**Decision**: `vine.string().minLength(12).maxLength(128).confirmed({ as: 'passwordConfirmation' })`.
No `.trim()`.

**Rationale**: The spec's assumption, made concrete. The maximum exists so an unbounded string cannot
be pushed through scrypt; 128 is far above any real password and far below anything that costs
measurable time to hash.

The **absence of `.trim()` is deliberate and is the one rule most likely to be "fixed" by a future
reader**: every other string field in this codebase trims, and `loginValidator` itself trims the
email. Trimming a password silently changes the secret, and a password whose trailing space was
stripped on renewal but not at login would lock the user out of the account they just fixed. FR-012.

This is also the first place in the codebase where a password has a strength rule at all:
`loginValidator` uses `minLength(1)`, which is correct there — login must accept whatever was stored,
including passwords predating any rule, and a length refusal at login would leak that an account
exists. The two validators diverge on purpose.

---

## D11 — The renewal screen is a third pathless layout reusing `GuestLayout`

**Decision**: Add `routes/_password-renewal.tsx` (pathless layout, `component: GuestLayout`) with
`routes/_password-renewal/password-renewal.tsx` under it. Its `beforeLoad` requires an authenticated
session **and** `passwordRenewalRequired === true`, redirecting to `/login` when unauthenticated and to
`/` when nothing is owed. `_authenticated.tsx` and `_guest.tsx` each gain one redirect.

**Rationale**: FR-003 puts the renewal step *instead of* the application frame, and the spec assumption
rules out a modal over it — nothing of the application may render behind it. That excludes
`_authenticated`, whose component is `AuthenticatedLayout`. It equally excludes `_guest`, whose
`beforeLoad` throws a redirect to `/` for any authenticated user; a confined user is authenticated.

Reusing `GuestLayout` as the third layout's component costs one import and puts the renewal on the same
split-screen surface as login, which is where a user who has just been told to choose a password
expects to be. The guard is inverted relative to `_guest`'s: it exists to *keep* a confined user in
place.

The two edits to the delivered guards are one line each: `_authenticated` redirects to
`/password-renewal` when the session says a renewal is owed, and `_guest` does the same instead of
sending a confined user to `/` and letting `_authenticated` bounce them a second time — the spec's
"attempts to reach the sign-in screen while confined" edge case.

Sign-out (FR-019) cannot come from `UserMenu`, which lives in the sidebar. The screen calls `useLogout`
directly, which already resets the session cache and invalidates the router.

---

## D12 — A `passwordRenewalRequired` factory state carries `active`, and one seeded user carries it

**Decision**: Add a `passwordRenewalRequired` state to `UserFactory` that sets `accessStatus: 'ACTIVE'`,
the factory password, and `passwordRenewalRequiredAt`. Add a fifth entry to `USER_FIXTURES` using it,
and widen the fixture `state` field from the literal `'active'` to `'active' | 'passwordRenewalRequired'`.

**Rationale**: This is how the slice is verifiable at all before `#17` and `#32` exist (spec
assumption, FR-023). The state duplicates the `active` state's three lines rather than composing with
it because `01_user_seeder.ts` calls `UserFactory.apply(fixture.state)` with a single state name, and
widening the seeder to accept a list would change a shared file for one fixture's benefit.

A **new** fixture user rather than flagging an existing one: `USER_FIXTURES` seeds one user per role,
and the development dataset's organization admin is the account a developer signs in with. Flagging
one of the four would confine an existing role's login and change what every unrelated manual check
does. The new user takes the `OBSERVER` role, the least privileged, since what it demonstrates is the
confinement rather than any permission.

---

## D13 — A mid-session `403` surfaces as a message, and navigation self-corrects

**Decision**: The confinement refuses with `403` and code `E_PASSWORD_RENEWAL_REQUIRED`. On the web,
`_authenticated`'s `beforeLoad` redirects to the renewal step when the session reports the requirement;
an in-flight `403` on an already-rendered page surfaces through the existing `parseApiError` toast
path.

**Rationale**: `403` is the accurate status — the request is authenticated and forbidden — and a
distinct code lets a client tell it apart from the `401` that `isUnauthorizedError` already routes to
`/login`. Sending `401` instead would sign the user out, contradicting FR-005's "without terminating
it".

US2-7's requirement is that the session *becomes* confined, not that the interface repaints instantly.
A mutation that was already in flight when an administrator recorded the requirement shows the API's
message — which names the renewal — rather than a generic failure. Adding a global response
interceptor that redirects on this code would be a larger change to the shared Tuyau client than the
race justifies, and is noted here as the follow-up if it ever proves annoying in practice.

**Corrected at implementation time.** This decision originally claimed that "every navigation runs
`beforeLoad`, so the redirect covers the case the user will actually hit". That is wrong, and a
review of the delivered diff caught it. `ensureSessionUser` is `queryClient.ensureQueryData`, which
returns cached data and revalidates only when passed `revalidateIfStale`; `SessionProvider` is
mounted once at the root and otherwise refetches only on window focus or reconnect. So a session
confined *after* the shell loaded keeps reading `passwordRenewalRequired: false` from the cache:
`_authenticated`'s guard lets the navigation through, the section's own loader takes the `403`, and
the user meets the error component instead of the renewal step — the "wall of failed requests" the
redirect exists to prevent, and a miss against US2-1 for that path.

The API is unaffected: the confinement holds on every request, nothing is disclosed, and nothing is
written. What is missed is the courtesy redirect, which FR-007 already calls a courtesy.

It is **not fixed in this slice**, deliberately, and there are two reasons. Nothing in the product
records a requirement (FR-023), so a mid-session confinement is unreachable except by editing the
database by hand — the case cannot occur until `#17` or `#32` ships. And every fix costs more than
the slice should spend: refetching in `_authenticated`'s `beforeLoad` puts an `auth.me` round-trip on
every navigation in the whole application, and mapping the `403` to a redirect is the shared-client
interceptor this decision already weighed and rejected. **Whoever delivers `#17` or `#32` owns
closing it**, and should treat the interceptor as the likely answer, since by then the case is
reachable.
