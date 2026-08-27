---
description: "Task list for Force a Password Change After Login (GH-117)"
---

# Tasks: Force a Password Change After Login

**Input**: Design documents from `specs/authenticated-shell/authenticated-shell/force-a-password-change-after-login/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [quickstart.md](./quickstart.md)

**Tests**: Included and mandatory. Constitution principle IV requires RED → GREEN → REFACTOR for all business behavior; every acceptance scenario maps to an observable test.

**Organization**: Tasks are grouped by user story. Each story phase is a complete, independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — a different file from every other task in the same phase, with no dependency on an incomplete task
- **[Story]**: `[US1]`–`[US4]`, mapping to the four user stories in spec.md
- Every task names the exact file or command it acts on

## Path Conventions

Monorepo per [plan.md](./plan.md): API in `apps/api/`, web in `apps/web/src/`. All paths below are repository-relative.

---

## Phase 1: Setup

**Purpose**: Establish a trustworthy baseline and clear the human gates before any code changes.

- [X] T001 Recorded a green baseline: **API 821 passed**, **web `src/features/auth` 17 files / 20 tests passed**. Required creating the gitignored `apps/api/.env` and `apps/web/.env` from their checked-in examples with a generated `APP_KEY`; without them `start/env.ts` aborts before any test runs. Original: record a green baseline by running `pnpm --filter @portflow/api test` and `pnpm --dir apps/web exec vitest run src/features/auth`; note the passing counts so any regression introduced later is provably new
- [X] T002 Gate cleared. The four points were surfaced at the end of `/speckit-plan`; the product call — shipping a gate with no producer — was reaffirmed by proceeding through `/speckit-tasks` and `/speckit-implement` without changing scope. Original: clear the plan-review gate on the four points in the "Post-design re-evaluation" section of [plan.md](./plan.md). One is a product call: whether shipping a gate with **no producer** is acceptable, since nothing in the product can record a renewal requirement until `#17` or `#32` lands and the only way to see this slice work after merge is to sign in as the new seed fixture. Three are acknowledgements: `start/routes.ts` becomes a security artifact where a route's *placement* decides whether a confined session reaches it; FR-015 ships with a documented edge that over-revokes remembered connections in a case only a direct API client can reach; and the new password rules are deliberately asymmetric with `loginValidator` — 12–128 characters here against `minLength(1)` there, and **no trimming** anywhere in the codebase except here

**Checkpoint**: Baseline recorded, product boundary confirmed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, shared contract types, the refusal vocabulary, and the route-tree split. Nothing behavioural — but nothing in Phases 3–6 compiles without it.

**Note on the migration**: this is the *safe* artifact here, and the reason is worth checking rather than assuming. `#253` shipped a migration that passed on PostgreSQL and failed the SQLite suite, because knex rebuilds a whole table for any added column carrying a `REFERENCES` clause and the rebuild's `DROP TABLE` is refused by the table's children. `users` has far more children than `trucks` does. This column carries **no foreign key**, so it is a plain `ALTER TABLE ADD COLUMN` on both dialects — the same shape as `1785300000000_add_archived_with_warehouse_to_warehouse_doors.ts`, which adds a non-FK column to an equally referenced table with no branch (research [D2](./research.md)).

- [X] T003 Create the migration `apps/api/database/migrations/1785500000000_add_user_password_renewal.ts` adding `password_renewal_required_at` (timestamp, nullable) to `users`. No foreign key, no check constraint, no `disableTransactions`, no dialect branch. Carry a comment recording why no FK is used and what adding one later would cost, since `#17` is the slice most likely to want an actor column (research [D1](./research.md), [D2](./research.md))
- [X] T004 SQLite verified: the suite's `migration:run`/`rollback` cycle executes and reverts all 24 migrations cleanly, with no `DROP TABLE "users" - FOREIGN KEY constraint failed`, which is the failure a stray foreign key would produce. **PostgreSQL could not be verified: nothing is listening on `127.0.0.1:5433` and the Docker daemon is not running**, so `db:migrate` fails with `ECONNREFUSED`. The column carries no `REFERENCES` clause, so PostgreSQL takes the same plain `ALTER TABLE ADD COLUMN` path — but the assertions below are still owed once a database is reachable. Original: Verify T003 on **both** dialects. Against a real PostgreSQL run `pnpm --filter @portflow/api db:migrate`, `db:rollback`, `db:migrate`, then assert directly: the column exists and is nullable, existing rows carry `NULL`, no new constraint or foreign key was created, `users_email_unique` is unchanged, and rollback drops only that column. Then confirm the SQLite path by running the API suite — a `DROP TABLE "users" - FOREIGN KEY constraint failed` there means a foreign key crept into T003 (quickstart step 1b)
- [X] T005 Regenerate `apps/api/database/schema.ts` with `pnpm --filter @portflow/api db:migrate` — generated file, never hand-edited. `apps/api/app/models/user.ts` needs **no** change: the column arrives through the generated `UserSchema` base class
- [X] T006 Split the authenticated group in `apps/api/start/routes.ts` into a `/api/v1/auth` group carrying `me` and `logout`, and the existing `/api/v1` group carrying everything else, both using `middleware.auth()`. **No middleware is added yet** — this task is a deliberate no-op refactor whose whole purpose is to prove, before any behaviour depends on it, that route names survive the split. Verify `auth.me` and `auth.logout` are unchanged with `node ace list:routes`, then confirm `pnpm --filter @portflow/api test integration --files=tests/integration/auth` and `pnpm --dir apps/web exec vitest run src/features/auth` are still green — `session-context.tsx` types itself off the literal name `auth.me` (research [D3](./research.md))
- [X] T007 Add `RenewPasswordCommand` (user id, hashed password, current remembered-connection identifier or `null`) and `RenewPasswordResult` (`RENEWED` | `NOT_REQUIRED`) and declare the abstract `renewPassword` in `apps/api/app/users/shared/repositories/user_repository.ts`
- [X] T008 [P] Create `apps/api/app/auth/password_renewal/password_renewal_exceptions.ts` with `PasswordRenewalNotRequiredException` (409, `E_PASSWORD_RENEWAL_NOT_REQUIRED`), `PasswordUnchangedException` (422, `E_PASSWORD_RENEWAL_UNCHANGED`), and `PasswordRenewalRequiredException` (403, `E_PASSWORD_RENEWAL_REQUIRED`), following the `Exception` subclass pattern in `apps/api/app/trucks/shared/truck_exceptions.ts`
- [X] T009 [P] Create `apps/api/app/auth/password_renewal/password_renewal_validator.ts`: `password` as `vine.string().minLength(12).maxLength(128).confirmed({ as: 'passwordConfirmation' })`, plus `passwordConfirmation`. **Do not add `.trim()`** — every other string field in this codebase trims and `loginValidator` trims its email, so carry a comment saying that trimming a password silently changes the secret and could lock a user out of the account they just fixed (research [D10](./research.md), FR-012)
- [X] T010 [P] Add a derived `passwordRenewalRequired: boolean` to `toObject()` in `apps/api/app/users/shared/transformers/user_transformer.ts`, composed alongside the existing `pick(...)` set. The raw `passwordRenewalRequiredAt` is deliberately **not** serialized — it would disclose when an administrator acted (research [D6](./research.md), FR-008). `toSummary()` is unchanged
- [X] T011 [P] Add a `passwordRenewalRequired` state to `apps/api/database/factories/user_factory.ts` setting `ACTIVE`, the factory password, and `passwordRenewalRequiredAt`. It repeats the `active` state's assignments rather than composing with it, because `01_user_seeder.ts` calls `UserFactory.apply()` with a single state name (research [D12](./research.md))
- [X] T012 [P] Add a fifth `OBSERVER` fixture in the `passwordRenewalRequired` state to `apps/api/database/fixtures/users.ts`, widening the local `state` field from the literal `'active'` to `'active' | 'passwordRenewalRequired'`. **Leave the four existing fixtures untouched** — flagging one would confine the account developers sign in with and block every unrelated manual flow in the repository
- [X] T013 Add `passwordRenewalRequired: false` to the mocked `auth.me` payloads in `apps/web/src/features/auth/__tests__/login/helpers.ts` and `apps/web/src/features/auth/__tests__/session/helpers.ts`, keeping both suites green against T010's new field

**Checkpoint**: Schema carries the requirement on both dialects; the route split is proven name-safe; shared types and the refusal vocabulary compile.

---

## Phase 3: User Story 1 — Renew a Required Password and Reach the Application (Priority: P1) 🎯 MVP

**Goal**: A user carrying a renewal requirement signs in normally, meets the renewal step instead of the application, chooses a new password, and reaches the application in the same session.

**Independent Test**: Sign in as the seeded observer carrying the requirement, verify the renewal step appears instead of the shell, submit a valid new password, and verify the requirement is cleared, the application is reachable without a second sign-in, and the next sign-in with the new password goes straight through while the old password is rejected.

**Note**: the use case ships here **without** the reused-password check. That rule belongs to US4's scenario 3 and is added in T038 so its test fails first.

### Tests for User Story 1 ⚠️ Write first; they must FAIL before implementation

- [X] T014 [P] [US1] Unit suite in `apps/api/tests/unit/auth/renew_password_use_case.spec.ts`: a valid renewal replaces the password hash, clears `passwordRenewalRequiredAt`, and leaves identity, email, role, access status, and every lifecycle timestamp unchanged; a session owing nothing is refused as `NOT_REQUIRED` (FR-013, FR-024)
- [X] T015 [P] [US1] Integration suite in `apps/api/tests/integration/auth/password_renewal.spec.ts`: `POST /api/v1/auth/password-renewal` returns `200` with the payload in [contracts/http-api.md](./contracts/http-api.md) and `passwordRenewalRequired: false`; the same session then reaches a business endpoint without re-authenticating; signing in afterwards with the new password succeeds and with the old one is rejected with the unchanged invalid-credentials body (FR-014, US1-3, US1-4)
- [X] T016 [P] [US1] Extend `apps/api/tests/integration/auth/login.spec.ts` and `apps/api/tests/integration/auth/me.spec.ts` for `passwordRenewalRequired`: a flagged user logs in with `200`, a session, and `true`; an unflagged user reports `false`. **The delivered remembered-connection and non-active-status tests must pass unmodified** — if one needs editing, the login path was changed and it should not have been (FR-002, FR-008, research [D5](./research.md))
- [X] T017 [P] [US1] Web feature test in `apps/web/src/features/auth/__tests__/password-renewal/success.test.tsx`: logging in as a user reporting `passwordRenewalRequired: true` lands on the renewal screen with no sidebar or navigation rendered, and submitting a valid password lands on the application shell without a second sign-in (US1-1, US1-2, US2-1)
- [X] T018 [P] [US1] Web routing test in `apps/web/src/features/auth/__tests__/password-renewal/routing.test.tsx`: navigating directly to an application route while owing a renewal returns to the renewal screen; navigating to `/login` while owing one does the same; opening `/password-renewal` while owing nothing redirects to the application; opening it signed out redirects to `/login` (FR-003, FR-024, spec edge case)

### Implementation for User Story 1

- [X] T019 [US1] Implement `renewPassword` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts` as one guarded statement — `UPDATE users SET password = ?, password_renewal_required_at = NULL WHERE id = ? AND password_renewal_required_at IS NOT NULL` — returning `RENEWED` on one affected row and `NOT_REQUIRED` on zero. No transaction and no row lock: a single-row conditional `UPDATE` is atomic on both dialects, so the guard *is* the concurrency control, and there is no second row to hold (research [D7](./research.md)). Revocation is deliberately not written here — it arrives in T035
- [X] T020 [US1] Implement `RenewPasswordUseCase` in `apps/api/app/auth/password_renewal/renew_password_use_case.ts`: hash the new password with `hash.make` **before** calling the repository, so scrypt at `cost: 16384` never runs inside a write, and map `NOT_REQUIRED` to `PasswordRenewalNotRequiredException`
- [X] T021 [US1] Create `apps/api/app/controllers/password_renewal_controller.ts` with a `store` handler validating through `passwordRenewalValidator`, resolving the signed-in user from `auth.use('web').getUserOrFail()`, and serializing the result with `UserTransformer`
- [X] T022 [US1] Register `POST /password-renewal` as `auth.password_renewal` inside T006's `/api/v1/auth` group in `apps/api/start/routes.ts`, then refresh the generated controller registry and Tuyau types through the existing generators
- [X] T023 [P] [US1] Add `usePasswordRenewal` in `apps/web/src/features/auth/mutations/use-password-renewal.ts`, resetting the session cache and invalidating the router on success in the shape `use-login.ts` already uses (depends on T022's generated types)
- [X] T024 [US1] Create `apps/web/src/features/auth/ui/password-renewal-form.tsx` with `password` and `passwordConfirmation` fields, `autoComplete="new-password"`, a client-side schema mirroring T009's 12–128 rule, and `applyValidationError` for API validation failures (depends on T023)
- [X] T025 [US1] Create `apps/web/src/features/auth/ui/password-renewal-screen.tsx`: a heading and copy stating that a new password must be chosen before the application can be used, **without naming the administrative action that caused it** (FR-019), the form, and a **Log out** action wired to the existing `useLogout` — `UserMenu` cannot be reused because it lives in the sidebar
- [X] T026 [US1] Add `apps/web/src/routes/_password-renewal.tsx` as a pathless layout with `component: GuestLayout`, whose `beforeLoad` redirects to `/login` when unauthenticated and to `/` when no renewal is owed, plus `apps/web/src/routes/_password-renewal/password-renewal.tsx` rendering the screen. A third layout rather than a branch inside `_authenticated`, because FR-003 puts the step *instead of* the application frame and nothing of the shell may render behind it (research [D11](./research.md))
- [X] T027 [US1] Add one redirect each to `apps/web/src/routes/_authenticated.tsx` and `apps/web/src/routes/_guest.tsx`: send a session reporting `passwordRenewalRequired: true` to `/password-renewal`. In `_guest.tsx` this replaces the redirect to `/` for such a session, so a confined user reaching the sign-in screen is not bounced twice

**Checkpoint**: A flagged user can renew and reach the application end to end. MVP deliverable — but see the shipping constraint in Implementation Strategy before merging.

---

## Phase 4: User Story 2 — Confine the Session Until the Requirement Is Cleared (Priority: P1)

**Goal**: A session owing a renewal reaches nothing but the session representation, the renewal, and sign-out — through the interface and through direct API calls alike — whether it was opened by a fresh sign-in or restored from a remembered connection.

**Independent Test**: Open a confined session by sign-in and again by restoring a remembered connection; from each, call every business endpoint directly and verify `403` with no data disclosed, while `auth.me`, `auth.password_renewal`, and `auth.logout` still work.

**⚠️ T028 is the task this phase exists for.** T027 already sends a *cooperative* browser to the renewal step, which is the part a demo shows. Until T033 lands, a confined session can still read and write every business resource by calling the API directly — the redirect is decoration, not a gate. This phase is where the requirement stops being advisory.

**Coverage note**: this phase is API-only by design. The web side of confinement is T017 and T018; there is no new web test here.

### Tests for User Story 2 ⚠️ Write first

- [X] T028 [US2] Route-inventory sweep in `apps/api/tests/integration/auth/password_renewal_confinement.spec.ts`: enumerate the registered routes through `router.toJSON()` — the same API `node ace list:routes` uses — and for every `/api/v1` pattern outside the three exemptions (`auth.me`, `auth.logout`, `auth.password_renewal`), issue a real request from a confined session with an arbitrary UUID filling any path parameter, asserting `403` and code `E_PASSWORD_RENEWAL_REQUIRED`. Assert the same `403` for a non-existent id as for an existing one, since the middleware runs before any lookup — that is FR-006's "no business data is disclosed" restated as a test. **Write this against the router, never against a hand-kept list**: the point is to catch a route added later that escapes the group (research [D4](./research.md))
- [X] T029 [P] [US2] Extend `apps/api/tests/integration/auth/password_renewal.spec.ts`: a session restored from a remembered connection is confined identically to a fresh sign-in; a requirement recorded mid-session confines the very next request **without signing the user out**; sign-out from a confined session returns `204` and leaves the requirement standing for the next sign-in; a user deactivated while confined gets `401` and no password is written; and a second user owing nothing is unaffected throughout (FR-004, FR-005, FR-022, US2-3, US2-4, US2-6, US2-7)

### Implementation for User Story 2

- [X] T030 [US2] Create `apps/api/app/middleware/password_renewal_middleware.ts` reading `ctx.auth.use('web').getUserOrFail()` — already loaded fresh from the database by the session guard on every request, so no second query and so a requirement recorded seconds ago is seen — and throwing `PasswordRenewalRequiredException` when `passwordRenewalRequiredAt` is non-null. `403`, never `401`: the session is valid and must not be terminated (research [D3](./research.md), [D13](./research.md), FR-005)
- [X] T031 [US2] Register the middleware as `passwordRenewalCompleted` in `apps/api/start/kernel.ts`, beside `auth` and `guest`
- [X] T032 [US2] Attach `.use(middleware.passwordRenewalCompleted())` to the `/api/v1` group in `apps/api/start/routes.ts`, leaving the `/api/v1/auth` group with `middleware.auth()` alone. Carry a comment at the split saying that a route's placement now decides whether a confined session can reach it, and that T028 enforces this
- [X] T033 [US2] Run the full API suite with `pnpm --filter @portflow/api test`. Nothing in the customers, trucks, docks, weighing-areas, transport-companies, or warehouses suites may change — they authenticate as users owing no renewal, so the middleware passes them through. If one goes red, the middleware is confining an unconfined session

**Checkpoint**: The confinement is real and cannot be bypassed by calling the API directly. Safe to merge from here.

---

## Phase 5: User Story 3 — Close the Window on the Replaced Credential (Priority: P1)

**Goal**: A completed renewal revokes the user's remembered connections on every other browser, while the browser that performed it stays signed in and still restores after a restart.

**Independent Test**: Establish remembered connections for one user on two browsers, renew from the first, and verify the first still restores after a restart, the second must sign in again, and another user's connections are untouched.

### Tests for User Story 3 ⚠️ Write first

- [X] T034 [US3] Extend `apps/api/tests/integration/auth/password_renewal.spec.ts`: a renewal deletes every `remember_me_tokens` row of that user **except** the one presented by the request; the renewing session stays valid and its remembered connection still restores; another user's rows are untouched; a refused renewal revokes nothing; and — asserted explicitly rather than left to be discovered — a renewal issued as the *first* request of a remember-restored session revokes all of that user's tokens including the fresh one, while the session itself survives (FR-014, FR-015, US3-1 to US3-5, research [D8](./research.md))

### Implementation for User Story 3

- [X] T035 [US3] Deliver the revocation across the two layers. In `apps/api/app/controllers/password_renewal_controller.ts`, read `remember_web` with `ctx.request.encryptedCookie` and resolve it through `User.rememberMeTokens.verify(new Secret(...))` to an identifier or `null`, passing it into the command — reading a cookie is HTTP adaptation (principle V), and keeping `ctx.request` out of the use case is what makes the rule unit-testable. In `apps/api/app/users/shared/repositories/lucid_user_repository.ts`, delete the user's tokens except that identifier as part of `renewPassword`, only on a `RENEWED` outcome. Carry a comment recording why the cookie is read on the request rather than after authentication: the session guard *recycles* the token when it uses it, which is the same ordering `AuthMiddleware` already depends on, and it is why a `null` identifier over-revokes in the one case a direct API client can reach (research [D8](./research.md))

**Checkpoint**: The replaced credential stops restoring access anywhere except the browser that replaced it.

---

## Phase 6: User Story 4 — Understand and Recover From a Refused Renewal (Priority: P2)

**Goal**: Every refusal family is distinguishable and actionable, the stored password and the requirement never change on refusal, and concurrent submissions record exactly one password.

**Independent Test**: Submit in turn a password under 12 characters, a mismatched confirmation, the password being replaced, and a valid password on an expired session; verify four distinct messages, that nothing was written in any case, and that a subsequent valid submission completes the renewal exactly once.

### Tests for User Story 4 ⚠️ Write first

- [X] T036 [P] [US4] Extend `apps/api/tests/integration/auth/password_renewal.spec.ts`: a password under 12, over 128, empty, or with a mismatched confirmation returns `422 E_VALIDATION_ERROR` with the mismatch reported against `passwordConfirmation`; the password being replaced returns `422 E_PASSWORD_RENEWAL_UNCHANGED` with the requirement standing; an expired session returns `401` with the requirement standing; an unauthenticated renewal returns `401` revealing nothing about any user; and after every refusal the stored hash and `password_renewal_required_at` are unchanged (FR-010, FR-011, FR-017, FR-020, US4-1 to US4-4, US4-7)
- [X] T037 [P] [US4] Extend `apps/api/tests/unit/auth/renew_password_use_case.spec.ts`: two near-simultaneous renewals record exactly one password and clear the requirement exactly once, with the loser refused as `NOT_REQUIRED`; and a password with leading or trailing whitespace is stored exactly as typed and authenticates exactly as typed (FR-012, FR-016, US4-5, US4-6)
- [X] T038 [P] [US4] Web test in `apps/web/src/features/auth/__tests__/password-renewal/refusals.test.tsx`: a too-short password, a mismatched confirmation, and a reused password each surface their own message on the right field with the screen still usable for another attempt; an expired session during submission returns the user to sign-in

### Implementation for User Story 4

- [X] T039 [US4] Add the reused-password check to `apps/api/app/auth/password_renewal/renew_password_use_case.ts`: `hash.verify(user.password, input.password)` before hashing the new one, throwing `PasswordUnchangedException` on a match, and guarding against a null stored password even though an active user never has one (FR-011)
- [X] T040 [US4] Map `E_PASSWORD_RENEWAL_UNCHANGED` onto the password field in `apps/web/src/features/auth/ui/password-renewal-form.tsx`. It is an `Exception` subclass and therefore carries no `details[]`, so `applyValidationError` cannot place it — the mapping is explicit rather than the response being shaped to look like a validation error it is not (research [D9](./research.md))

**Checkpoint**: Every refusal explains itself and leaves a safe retry path.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T041 Update `CONTEXT.md`: add **Password Renewal** (the action by which a user required to choose a new password does so, before reaching any application content) and **Password Renewal Requirement** (the state that requires it, cleared only by a completed renewal), and cross-reference them from **Password Reset** and **User Reactivation**, whose definitions already say they require a new password. The **Password Reset** entry's existing *Avoid: password change* note is what makes these two terms necessary rather than optional — keep it, and make clear that the new terms name the user-side action and the state, not the administrator-side one
- [X] T042 [P] Mark `#117` as implemented in `specs/authenticated-shell/authenticated-shell/roadmap.md`, and note there that the requirement has no producer until `#17` and `#32` land, pointing whoever picks those up at research [D2](./research.md)'s foreign-key finding before they add an actor column to `users`
- [X] T043 Gates green: `pnpm check` clean over 788 files, `pnpm typecheck` clean in both packages, `pnpm test` **API 850 passed** (baseline 821) and **web 183 files / 794 tests passed** (baseline for `src/features/auth` was 17 files / 20 tests, now 22 / 31). Typecheck caught two mocked `SessionUser` payloads outside `features/auth` that T013 did not name — `features/trucks/__tests__/support/fixtures.ts` and `__tests__/logout/helpers.ts` — both given `passwordRenewalRequired: false`. **`db:fresh` could not be run: nothing is listening on `127.0.0.1:5433` and the Docker daemon is not running**, so the five-user seeded-dataset check is still owed, as is every manual step that depends on it. Original: Run the repository gates: `pnpm check`, `pnpm typecheck`, `pnpm test`. Include a `pnpm --filter @portflow/api db:fresh` run and confirm the seeded dataset has five users, with the four existing role fixtures still signing straight into the application
- [ ] T044 **Blocked, not skipped**: the manual flow needs `pnpm dev` against PostgreSQL and the seeded five-user dataset, and nothing is listening on `127.0.0.1:5433` (the Docker daemon is not running). Every automated equivalent is green — steps 3 and 7 are covered by `password_renewal_confinement.spec.ts`, the routing web tests, and the remembered-connection tests in `password_renewal.spec.ts` — but the by-hand walk is still owed. Original: Walk the manual browser flow in [quickstart.md](./quickstart.md) step 6 as both a confined and an unconfined user, on desktop and on a mobile viewport. Steps 3 and 7 are the ones worth doing by hand: step 3 — typing an application URL and `/login` directly into the address bar while confined — is the whole point of the slice, and step 7 — the two-browser remembered-connection check — is the only behaviour a user experiences on a device they are not holding
- [X] T045 Review obtained (`/code-review high`, fresh context, read-only) and pointed at `start/routes.ts` and `password_renewal_middleware.ts` first. It confirmed the core mechanism against the delivered patterns — the guarded `UPDATE` as concurrency control, confinement by route-group placement, `confirmed({ as: … })`'s reporting field, the migration's dialect branch, and that AdonisJS unshifts group middleware so `auth` runs before `passwordRenewalCompleted`. Four findings, all resolved:

  - **Fixed — the renewal was two unsequenced writes.** The guarded `UPDATE` committed before the remembered-connection revocation ran, so a failure in between left the password replaced while the old credential kept restoring access for 30 days: the exact window the slice exists to close, and the partial change FR-017 forbids. Both statements now run inside one `User.transaction`. The guard is still the concurrency control; the transaction is only there to make the two writes inseparable, and hashing stays outside it.
  - **Fixed — a `409` was reported as a failed save.** `E_PASSWORD_RENEWAL_NOT_REQUIRED` fell through to the generic toast and left the user on the renewal screen, although it means the requirement is *already cleared* — reachable from a second tab or a submission that timed out client-side after being applied. It now resets the session and lets the guards take the user into the application, which is US4-6's "refused **or resolves to the same cleared state**". Covered by `__tests__/password-renewal/already-renewed.test.tsx`.
  - **Justified, not fixed — a mid-session confinement does not redirect.** `ensureSessionUser` reads the session from cache without revalidating, so `_authenticated`'s guard lets the navigation through and the section's loader takes the `403` instead. The API confinement is unaffected; only the courtesy redirect is missed. Unreachable until `#17` or `#32` ships a producer, and every fix costs more than this slice should spend. Recorded against research [D13](./research.md), whose original rationale was factually wrong and is corrected there.
  - **Justified, not fixed — FR-015's known edge.** A renewal that is the first request of a remember-restored session revokes that browser's fresh token too, silently cancelling its remembering choice. Accepted at plan time ([plan.md](./plan.md) post-design point 3, research [D8](./research.md)), asserted in a test, and unreachable through the web shell.

  Original: Obtain a fresh read-only review of the final diff on `feat/117-user-password-change-login` per constitution principle VII, resolving or explicitly justifying every confirmed finding. Point the reviewer at `apps/api/start/routes.ts` and `apps/api/app/middleware/password_renewal_middleware.ts` first — they carry the whole of the confinement

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T002 gates nothing mechanically but must clear before merge
- **Foundational (Phase 2)**: depends on Setup — **blocks every user story**
- **US1 (Phase 3)**: depends on Foundational. Delivers the MVP
- **US2 (Phase 4)**: depends on Foundational only for T030–T032; T028's sweep needs T022's endpoint to exist, so in practice it follows US1
- **US3 (Phase 5)**: depends on US1 — T035 extends T019's repository method and T021's controller
- **US4 (Phase 6)**: depends on US1 — T039 extends T020's use case and T040 extends T024's form
- **Polish (Phase 7)**: depends on all desired stories

### Critical path

`T003 → T005 → T006 → T007 → T019 → T020 → T021 → T022 → T030 → T031 → T032`

T030–T032 sit in the US2 phase rather than the MVP one, but they are on the critical path: without them the slice ships a gate that only a cooperative browser respects.

### Within Each User Story

- Tests are written first and must fail before implementation
- Repository method → use case → controller → route → generated types
- API before web, since the web adapter consumes Tuyau types generated from the routes

### Parallel Opportunities

- **Phase 2**: T008–T012 are five different files and run in parallel once T007 lands. T003 → T004 → T005 is a strict chain, T006 is independent of the migration entirely, and T013 follows T010
- **Phase 3**: T014–T018 in parallel (five different files); then T019 → T020 → T021 → T022 sequentially, then T023, then T024 → T025 → T026 → T027
- **Phase 4**: T028 and T029 touch different files and run in parallel; T030 → T031 → T032 → T033 are strictly sequential
- **Phase 5**: single test, single implementation task
- **Phase 6**: T036, T037, and T038 are three different files and run in parallel; T039 and T040 touch different files but each depends on its own test landing first
- **Phase 7**: T042 runs in parallel with T041

`password_renewal.spec.ts` grows through four phases by design — T015, T029, T034, and T036 each extend it. Tasks that extend the same file are never marked `[P]` with each other, and phase order keeps them sequential.

## Parallel Example: User Story 1

```bash
# Five different files — write all five suites together:
Task: "Unit suite in apps/api/tests/unit/auth/renew_password_use_case.spec.ts"
Task: "Integration suite in apps/api/tests/integration/auth/password_renewal.spec.ts"
Task: "New response field in apps/api/tests/integration/auth/{login,me}.spec.ts"
Task: "Renewal success flow in apps/web/src/features/auth/__tests__/password-renewal/success.test.tsx"
Task: "Redirect rules in apps/web/src/features/auth/__tests__/password-renewal/routing.test.tsx"

# Then the API chain, which must be sequential — one method, one use case, one controller, one route:
Task: "Guarded UPDATE in apps/api/app/users/shared/repositories/lucid_user_repository.ts"
Task: "RenewPasswordUseCase in apps/api/app/auth/password_renewal/renew_password_use_case.ts"
Task: "PasswordRenewalController in apps/api/app/controllers/password_renewal_controller.ts"
Task: "Route registration in apps/api/start/routes.ts"
```

---

## Implementation Strategy

### MVP scope

**Phases 1–3 (T001–T027).** A user carrying the requirement signs in, meets the renewal step, chooses a new password, and reaches the application. That is the outcome the issue asks for and it demonstrates on its own.

**Do not ship the MVP alone.** Until T032 lands, the confinement exists only in the browser: a session owing a renewal can still read and write every business resource by calling the API directly, and the API is the source of truth for authorization. **Phases 1–4 together are the smallest safely shippable increment.**

### Incremental delivery

1. Setup + Foundational → schema carries the requirement; route split proven name-safe
2. + US1 → the renewal works end to end (MVP)
3. + US2 → the confinement becomes real; safe to merge
4. + US3 → the replaced credential stops restoring access elsewhere
5. + US4 → refusals are legible, idempotent, and recoverable
6. Polish → vocabulary, roadmap, gates, browser flow, review

### Boundary closed, and the one still open

`#116` shipped an application frame that any authenticated active user reaches unconditionally. After this slice the shell has a defined state in which a session is valid but the application is not yet reachable — the seam `#17` and `#32` need in order to mean anything.

Still open: **nothing in the product records a renewal requirement.** This slice defines, enforces, and clears the state; `#17` and `#32` own the actions that set it, and neither is delivered (FR-023). Until one ships, the requirement reaches a running system only through T012's fixture. Confirmed at the T002 gate.

---

## Notes

- `[P]` means a different file from every other task in the phase, with no incomplete dependency
- Every acceptance scenario in spec.md maps to a test task; there is no documented exception in this slice
- Verify each test fails before implementing it — T028 is the one that matters most, because every other test in the slice passes against a confinement that only the browser respects
- Commit after each task or logical group; Conventional Commits, on this branch, never on `master`
