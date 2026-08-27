# Implementation Plan: Force a Password Change After Login

**Branch**: `feat/117-user-password-change-login` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/authenticated-shell/authenticated-shell/force-a-password-change-after-login/spec.md`

## Summary

Make an existing domain rule effective. `CONTEXT.md` defines `Password Reset` as "requiring an active
user to choose a new password" and `User Reactivation` as restoring access "while requiring a new
password", but nothing in the authenticated shell enforces either. This slice adds
`users.password_renewal_required_at`, confines any session whose user carries it to a single renewal
step, and clears it when the user chooses a new password — revoking that user's remembered connections
on every other browser as it does.

The API adds one column, one middleware, one endpoint (`POST /api/v1/auth/password-renewal`), one
`password_renewal/` use-case directory beside `login/`, and one repository method. The web adds a third
pathless layout carrying the renewal screen, and one redirect each to the two delivered route guards.
Login is not touched.

**The write is trivial; the risk is entirely in the route surface.** Recording a password and clearing
a flag is one guarded `UPDATE`. Three things are worth a reviewer's attention:

1. **A confinement that a future endpoint can escape is worse than none**, because it reads as
   protection. The whole `/api/v1` group is behind one `middleware.auth()` today, and the three
   endpoints that must stay reachable while confined live inside it. The plan splits the group so that
   confinement is the default and exemption is a visible act, rather than matching route names inside
   the middleware — which would make renaming `auth.me` a silent security change, and that name is
   already load-bearing in `session-context.tsx`. Research [D3](./research.md).
2. **The route file is now a security artifact, so a test reads it back.** A route-inventory test walks
   `router.toJSON()` and issues a real confined request against every `/api/v1` pattern outside the
   three exemptions, asserting `403`. Research [D4](./research.md).
3. **One requirement cannot be implemented exactly as written.** FR-015 asks for the renewing browser's
   remembered connection to survive while every other is revoked. The session guard *recycles* the
   remember token when it uses it, so on the one request where a session is restored from the cookie,
   the presented token no longer exists and all of the user's tokens are revoked — including that
   browser's fresh one. The session survives, so the user is not signed out; they must sign in again
   after closing the browser. It is unreachable through the web shell, which always calls `auth.me`
   first, and it fails in the safe direction. Research [D8](./research.md).

Everything else reuses delivered shapes: the confinement is the same per-request check against a fresh
user row that `AuthMiddleware` already performs for `accessStatus`, and the guarded `UPDATE` is the
same status-guarded write the truck lifecycle slices use, minus the row lock they need for a second
row and this one does not.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js 22 toolchain

**Primary Dependencies**: AdonisJS 7.3, `@adonisjs/auth` 10.1 (session guard, remember-me tokens),
`@adonisjs/session` 8.1, Lucid 22.4 (knex 3.2.10), VineJS 4, Tuyau 1.2, TanStack Router 1.170 /
Query 5.101, React 19.1, shadcn/Base UI

**Storage**: PostgreSQL in runtime (ADR 0002); in-memory SQLite through better-sqlite3 12.11.1 for
automated API tests. **One migration is required**: a single nullable `password_renewal_required_at`
timestamp on `users`. No dialect branch and no `disableTransactions`, because the column carries no
`REFERENCES` clause and therefore does not trigger knex's SQLite table rebuild — the failure mode
`#253` hit and corrected. Verified against `1785300000000_add_archived_with_warehouse_to_warehouse_doors.ts`,
which adds a non-FK column to an equally referenced table with no branch (research
[D2](./research.md)).

**Testing**: Japa 5.3 API unit/integration suites; Vitest 4.1, Testing Library, and MSW web feature
tests

**Target Platform**: Linux-hosted API and server-rendered web application; modern desktop and mobile
browsers

**Performance Goals**: At least 90% of users presented with the renewal step complete a valid renewal
on their first attempt within 60 seconds (SC-010). The confinement adds no query — it reads the user
row the session guard already loaded on every request. The renewal itself is two scrypt operations
(one verify for FR-011, one make) plus one primary-key `UPDATE`.

**Constraints**: Password hashing is scrypt at `cost: 16384`, deliberately slow, so it must happen
outside any transaction. The confinement must not terminate the session (FR-005), which fixes the
refusal at `403`, not `401` — the web's `isUnauthorizedError` matches only `401` and would otherwise
sign the user out. Passwords must not be trimmed (FR-012), diverging from every other string field in
the codebase and from `loginValidator`'s own `.trim()` on the email. The renewal must be exactly-once
under concurrency (FR-016), delivered by `WHERE password_renewal_required_at IS NOT NULL` on the
`UPDATE` rather than by a lock. `LoginUserUseCase` must not gain a branch: its single
indistinguishable rejection outcome is a stated domain rule and a timing-attack defence.

**Scale/Scope**: One new endpoint; one new API `password_renewal/` slice (one use case, one validator,
two exceptions, one repository method); one new middleware and one kernel registration; one route-tree
split; one additive migration; one derived transformer field. On the web, one new pathless layout, one
new route, one screen, one form, one mutation, and one redirect added to each of the two delivered
route guards. No new role, no policy, no bulk path, no email, and no change to the login, logout, or
remembered-connection rules.

## Constitution Check

### Pre-design gate

- **I. Selected feature intent is versioned — PASS**: GitHub issue #117 is selected on
  `feat/117-user-password-change-login`, and the reviewed `spec.md` — which replaced the migration
  placeholder — is the behavioral contract.
- **II. One independently deliverable feature per spec — PASS**: The column, the confinement, the
  renewal endpoint, and the renewal screen form one mergeable outcome around a single business
  decision ("may this session use the application yet?"). The slice is deliberately narrower than the
  issue title might suggest: it never *records* a requirement, which stays with `#17` and `#32`
  (FR-023). See the note below on what that means for demonstrability.
- **III. Vanilla Spec Kit gates protect product intent — PASS**: The spec carries no
  `[NEEDS CLARIFICATION]` markers; its two scope-changing decisions were confirmed with the product
  owner before drafting. Three consequences this plan discovered are surfaced below rather than
  absorbed silently.
- **IV. Test-first observable behavior — PASS**: API behavior starts with Japa tests
  (`tests/unit/auth/password_renewal_use_case.spec.ts`,
  `tests/integration/auth/password_renewal.spec.ts`,
  `tests/integration/auth/password_renewal_confinement.spec.ts`) against real Lucid persistence, and
  web behavior with router-level Vitest/MSW feature tests, before implementation. The confinement
  sweep is written **first**: it is the security guarantee, and it is the one test that fails if the
  route split is done wrong.
- **V. Deep boundaries and explicit contracts — PASS**: `RenewPasswordUseCase` owns the business
  decisions and maps repository outcomes to domain exceptions,
  `LucidUserRepository#renewPassword` owns the guarded-update mechanics,
  `PasswordRenewalController#store` owns HTTP adaptation, `PasswordRenewalMiddleware` owns the
  request-level gate, and Tuyau carries the typed contract to the web adapter. No new layering
  shortcut is introduced.
- **VI. Durable knowledge has a home — PASS**: `CONTEXT.md` gains `Password Renewal` and
  `Password Renewal Requirement`, and the `Password Reset` entry is cross-referenced — its
  *Avoid: password change* note is what makes the new terms necessary rather than optional. No new ADR
  is required: the slice introduces no architectural decision, only a second gate beside the delivered
  access-status one.
- **VII. Verification is part of delivery — PASS**: The quickstart defines the focused API and web
  checks, the regression suites, the repository gates, the both-dialect migration check, and the
  manual flow — including the two-browser check that is the only way to observe token revocation.
- **VIII. One workflow owner — PASS**: Spec Kit artifacts stay in this feature directory; GitHub
  Project continues to own operational status.

### Post-design re-evaluation

**PASS**. The data model and HTTP contract confirm the slice writes to two columns of one table,
deletes rows from `remember_me_tokens`, adds one endpoint, and changes no other resource's behaviour.

Four points deserve the reviewer's attention. None requires a constitution exception; one is a product
decision this plan should not make alone.

1. **The slice ships a gate with no producer.** Nothing in the product can record a password renewal
   requirement, because `#17` and `#32` are both undelivered. The requirement reaches a running system
   only through the new seed fixture. This was the confirmed scope decision, and it keeps the slice
   independently deliverable under principle II — but a reviewer opening the app after merge will see
   no behaviour change unless they sign in as the new fixture user. The quickstart's step 1 exists for
   exactly that reason. **The alternative — folding an administrator action into this slice — would
   overlap `#17`'s stated scope**, and was rejected at spec time.

2. **`start/routes.ts` becomes a security artifact.** Before this slice, adding a route to the
   `/api/v1` group had no security consequence beyond requiring authentication. After it, *where* a
   route is declared decides whether a confined session can reach it. The plan makes the safe
   placement the default and tests the unsafe one (research [D3](./research.md),
   [D4](./research.md)), but the property is new and worth knowing about. The three-entry `/api/v1/auth`
   group is small enough to read at a glance, which is the point.

3. **FR-015 ships with a documented edge.** See summary point 3 and research
   [D8](./research.md). The behaviour is correct through the web shell and over-revokes in a case
   only a direct API client can reach. Closing it would mean re-implementing the guard's private
   cookie handling and re-deriving the fixed expiry — a second, deeper coupling to `@adonisjs/auth`
   internals on top of the one `FixedExpiryRememberMeTokensProvider` already carries. **The plan
   accepts the edge and asserts it in a test.** If the reviewer wants it closed instead, that is a
   deliberate trade of framework coupling for a case the product cannot reach.

4. **The password rules are the first in the codebase, and they are not symmetric with login.**
   `loginValidator` uses `minLength(1)` and will keep it: login must accept whatever was stored, and a
   length refusal there would leak that an account exists. The renewal uses 12–128 and, unlike every
   other string field in this repository, **does not trim** — trimming would silently change the
   secret and could lock a user out of the account they just fixed (research
   [D10](./research.md)). Both asymmetries are deliberate and both are the kind of thing a later
   reader tidies away; they are commented at the point of definition, not only here.

One boundary is **closed** by this slice: `#116` shipped an application frame that any authenticated
active user reaches unconditionally. After this slice the shell has a defined state in which a session
is valid but the application is not yet reachable, which is the seam `#17` and `#32` need in order to
mean anything.

## Project Structure

### Documentation (this feature)

```text
specs/authenticated-shell/authenticated-shell/force-a-password-change-after-login/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── http-api.md
├── checklists/
│   └── requirements.md
└── tasks.md              # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/
├── database/
│   ├── migrations/
│   │   └── 1785500000000_add_user_password_renewal.ts   # new — one nullable column, no dialect branch (D2)
│   ├── schema.ts                                        # regenerated by migration:run, never edited
│   ├── factories/user_factory.ts                        # add a `passwordRenewalRequired` state (D12)
│   └── fixtures/users.ts                                # add a fifth user in that state; widen the state union
├── app/
│   ├── auth/
│   │   ├── login/                                       # untouched (D5)
│   │   └── password_renewal/
│   │       ├── renew_password_use_case.ts               # new
│   │       ├── password_renewal_validator.ts            # new — 12–128, confirmed, not trimmed (D10)
│   │       └── password_renewal_exceptions.ts           # new — NOT_REQUIRED (409), UNCHANGED (422)
│   ├── controllers/password_renewal_controller.ts       # new
│   ├── middleware/password_renewal_middleware.ts        # new — 403 E_PASSWORD_RENEWAL_REQUIRED (D3)
│   ├── users/shared/
│   │   ├── repositories/user_repository.ts              # add renewPassword + command/result
│   │   ├── repositories/lucid_user_repository.ts        # guarded UPDATE, affected-row count (D7)
│   │   └── transformers/user_transformer.ts             # derived passwordRenewalRequired (D6)
├── start/
│   ├── kernel.ts                                        # register `passwordRenewalCompleted`
│   └── routes.ts                                        # split the /api/v1 group in two (D3)
└── tests/
    ├── unit/auth/password_renewal_use_case.spec.ts                # new
    ├── integration/auth/password_renewal.spec.ts                  # new
    ├── integration/auth/password_renewal_confinement.spec.ts      # new — router.toJSON() sweep (D4)
    └── integration/auth/{me,login}.spec.ts                        # extend for the new response field

apps/web/src/
├── routes/
│   ├── _password-renewal.tsx                            # new pathless layout, component: GuestLayout (D11)
│   ├── _password-renewal/password-renewal.tsx           # new route
│   ├── _authenticated.tsx                               # redirect to the renewal step when owed
│   └── _guest.tsx                                       # redirect to the renewal step instead of `/`
└── features/auth/
    ├── mutations/use-password-renewal.ts                # new
    ├── ui/
    │   ├── password-renewal-screen.tsx                  # new — heading, form, Log out (FR-019)
    │   └── password-renewal-form.tsx                    # new — maps E_PASSWORD_RENEWAL_UNCHANGED (D9)
    └── __tests__/
        ├── password-renewal/*.test.tsx                  # new — confinement, success, refusals, log out
        ├── login/success.test.tsx                       # mocked auth.me payload gains the new field
        └── session/*.test.tsx                           # same
```

**Structure Decision**: Extend the existing `auth` vertical slice with a `password_renewal/`
use-case directory beside `login/`, which is where the session-owning behaviour already lives. The
renewal writes to `users`, so persistence goes into `LucidUserRepository` as one new method rather
than a new repository — the same repository `LoginUserUseCase` reads through. The middleware is a
named middleware in `app/middleware/`, beside `auth` and `guest`, because it is a request-level gate
and not a policy: there is no resource and no role in the decision.

The route-tree split is the only structural change to a delivered file, and it is deliberate: it moves
the confinement decision from inside a middleware to the place routes are declared, so that adding a
business endpoint confines it by default (research [D3](./research.md)). Route names survive the
split unchanged, so Tuyau's generated types and the web client are untouched.

On the web, the renewal screen is a third pathless layout rather than a branch inside `_authenticated`:
FR-003 puts it *instead of* the application frame, so nothing of the shell may render behind it. It
reuses `GuestLayout` as its component, which puts the renewal on the same split-screen surface as
login at the cost of one import. Generated route tree, controller registry, and Tuyau types are
refreshed through existing generators rather than edited by hand.

## Complexity Tracking

No constitution violations require justification.
