# Quickstart: Validate Forcing a Password Change After Login

**Feature**: `GH-117` | **Spec**: [spec.md](./spec.md) | **Contract**: [contracts/http-api.md](./contracts/http-api.md) | **Data model**: [data-model.md](./data-model.md)

## Prerequisites

- Node.js compatible with the repository toolchain
- PNPM 10.28.1
- Repository dependencies installed with `pnpm install`
- API and web environment files configured from their checked-in examples
- PostgreSQL available for the manual browser flow and for step 1b; automated API tests use
  in-memory SQLite

## 1. Prepare the development dataset

```bash
pnpm --filter @portflow/api db:fresh
```

Confirm the seeded dataset now provides **five** users: the four existing role fixtures, all
unchanged and all signing in straight into the application, plus one new `OBSERVER` carrying a
standing password renewal requirement (research [D12](./research.md)).

**Check that the four existing fixtures are untouched.** If signing in as the organization admin lands
on the renewal screen, an existing fixture was flagged instead of a new one being added, and every
other manual flow in the repository is now blocked behind a password change.

### 1b. Verify the migration on both dialects

```bash
pnpm --filter @portflow/api db:migrate
pnpm --filter @portflow/api db:rollback
pnpm --filter @portflow/api db:migrate
```

Expected on PostgreSQL and on SQLite alike:

- `users.password_renewal_required_at` exists and is nullable
- existing rows carry `NULL`
- **no** new check constraint, **no** new foreign key, and `users_email_unique` unchanged
- rollback drops the column and leaves every other user column in place

The dialect question here is the one `#253` got wrong and had to correct at implementation time, so
confirm it rather than assume it: this column carries no `REFERENCES` clause, so knex does a plain
`ALTER TABLE ADD COLUMN` on SQLite instead of rebuilding a table that half the schema points at
(research [D2](./research.md)). If the SQLite run reports `DROP TABLE "users" - FOREIGN KEY
constraint failed`, a foreign key was added to the migration and the decision needs revisiting.

## 2. Run focused API verification

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/auth/password_renewal_use_case.spec.ts
pnpm --filter @portflow/api test integration \
  --files=tests/integration/auth/password_renewal.spec.ts \
  --files=tests/integration/auth/password_renewal_confinement.spec.ts
```

These must cover, per spec:

| Behaviour | Spec |
|---|---|
| A user owing a renewal logs in with `200`, a session, and `passwordRenewalRequired: true` | FR-002, FR-008 |
| Valid renewal ⇒ password replaced, requirement cleared, `200` with `passwordRenewalRequired: false` | FR-013 |
| The session that renewed stays valid and reaches business endpoints immediately afterwards | FR-014 |
| Old password rejected at login afterwards with the unchanged invalid-credentials body | US1-4 |
| Password shorter than 12, longer than 128, empty, or mismatched confirmation ⇒ `422`, nothing written | FR-010, FR-017 |
| A password with leading/trailing whitespace is stored as typed and logs in as typed | FR-012 |
| New password equal to the current one ⇒ `422 E_PASSWORD_RENEWAL_UNCHANGED`, requirement stands | FR-011 |
| Renewal by a session owing nothing ⇒ `409 E_PASSWORD_RENEWAL_NOT_REQUIRED` | FR-024 |
| **Two renewals in flight ⇒ exactly one password recorded, the loser gets `409`** | FR-016 |
| Unauthenticated renewal ⇒ `401`, revealing nothing about any user | FR-020 |
| Sign-out while confined ⇒ `204`, requirement still standing at the next sign-in | FR-022, US2-4 |
| A user deactivated while confined ⇒ next request `401`, no password written | edge case |
| **Every `/api/v1` route outside the three exemptions ⇒ `403 E_PASSWORD_RENEWAL_REQUIRED`** | FR-006, FR-007 |
| `403` for a non-existent id as well as an existing one — no existence disclosed | FR-006 |
| A requirement recorded mid-session confines the next request without signing the user out | FR-005, US2-7 |
| A session restored from a remembered connection is confined identically to a fresh sign-in | FR-004, US2-3 |
| **Renewal deletes the user's other remember tokens and keeps the presented one** | FR-015, US3-1, US3-3 |
| Another user's remember tokens are untouched | US3-4 |
| A refused renewal revokes nothing | US3-5 |
| Renewal as the first request of a remember-restored session revokes all tokens, session survives | research [D8](./research.md) |

The bold rows are where this slice can go wrong.

- The **confinement sweep** is the security guarantee. Write it against `router.toJSON()`, not against
  a hand-kept list, so a route added later cannot quietly escape it
  (research [D4](./research.md)).
- The **concurrency** row proves the guarded `UPDATE`, which is also what produces the
  not-required refusal — one mechanism, two requirements (research [D7](./research.md)).
- The **token revocation** rows are the only place the session guard's recycling behaviour shows
  through. The last row asserts the known edge rather than pretending it does not exist.

Use `UserFactory.apply('passwordRenewalRequired')` for confined users and
`UserFactory.apply('active')` for unconfined ones, with `USER_FACTORY_PASSWORD` as the credential.

## 3. Run the regression suites for the paths this slice touches

```bash
pnpm --filter @portflow/api test integration --files=tests/integration/auth
pnpm --filter @portflow/api test unit --files=tests/unit/auth/login_use_case.spec.ts
```

What must change, and why:

- **integration/auth/me** and **integration/auth/login** — response assertions gain
  `passwordRenewalRequired`. The existing remembered-connection and non-active-status tests must pass
  **unmodified**; if one needs editing, the login path was changed and it should not have been
  (research [D5](./research.md)).
- **unit/auth/login_use_case** — unchanged. This slice adds no branch to `LoginUserUseCase`.
- Nothing in the customers, trucks, docks, weighing-areas, transport-companies, or warehouses suites
  changes. They authenticate as users owing no renewal, so the new middleware passes them through. If
  one of those suites goes red, the middleware is confining an unconfined session.

## 4. Run the web feature tests

```bash
pnpm --dir apps/web exec vitest run src/features/auth
```

New and extended coverage:

- logging in as a user owing a renewal lands on the renewal screen, not on the application shell, and
  no navigation is rendered
- submitting a valid new password lands on the application shell without a second sign-in
- a too-short password, a mismatched confirmation, and a reused password each surface their own
  message on the right field, and the screen stays usable for another attempt
- an expired session during submission returns the user to sign-in
- **navigating directly to an application route while confined returns to the renewal screen**, and
  navigating to `/login` while confined does the same (research [D11](./research.md))
- opening `/password-renewal` while owing nothing redirects to the application; opening it signed out
  redirects to `/login`
- the renewal screen offers **Log out**, and using it returns to the sign-in screen
- `__tests__/login/success.test.tsx` and the session tests keep passing with
  `passwordRenewalRequired: false` added to their mocked `auth.me` payload

## 5. Repository gates

```bash
pnpm check
pnpm typecheck
pnpm test
```

All must pass before the PR is marked ready.

## 6. Manual browser flow

```bash
pnpm dev
```

1. Sign in as the seeded organization admin. Confirm you reach the application directly and that
   nothing about this slice is visible. **This is the regression check that matters most** — every
   other manual flow in the repository depends on it.
2. Sign in as the seeded observer carrying the requirement, **with "Remember me for 30 days" ticked**.
   Confirm the renewal screen appears instead of the shell, that it explains a new password is needed,
   that it does not say why, and that no sidebar or navigation is reachable.
3. Type an application URL directly into the address bar. Confirm you are returned to the renewal
   screen. Do the same with `/login`.
4. Submit a password under 12 characters, then a mismatched confirmation, then the password you signed
   in with. Confirm three distinct messages and that the screen stays usable.
5. Submit a valid new password. Confirm you reach the application in the same session, with no second
   sign-in, and that the navigation and your role's permissions are exactly as they would be for any
   other user.
6. Sign out and back in with the **new** password: straight into the application. Then try the **old**
   password: rejected with the same message as any wrong password.
7. Before step 5, in a second browser, sign in as the same user with "Remember me" ticked, close it,
   and confirm reopening restores the session. After step 5, reopen it again: it must ask for a
   sign-in. The browser that performed the renewal must still restore after a restart.
8. Sign out from the renewal screen instead of renewing, then sign in again. Confirm the renewal
   screen returns — the requirement is cleared only by a completed renewal.
9. Repeat step 2 and step 5 on a mobile viewport.

Steps 3 and 7 are the ones worth doing by hand. Step 3 is the whole point of the slice, and step 7 is
the only behaviour a user experiences on a device they are not holding.

## Boundary this slice leaves open

Nothing in the product records a password renewal requirement. This slice defines the state, enforces
it, and clears it; `#17` (Reset an Active User Password) and `#32` (Reactivate a User with Fresh
Credentials) own the actions that set it, and neither is delivered (FR-023). Until one of them ships,
the requirement reaches a running system only through the seed fixture — which is why step 1's
five-user check is a prerequisite for every other manual step here.
