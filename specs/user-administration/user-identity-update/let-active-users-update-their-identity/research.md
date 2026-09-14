# Phase 0 Research: Let Active Users Manage Their Own Profile

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-11

No `NEEDS CLARIFICATION` marker remains in the specification: the one scope question — whether a user
may change their own email address — was answered on 2026-09-11 and written into FR-007 to FR-009.
The decisions below were taken against the code as GH-24 left it: `UpdateUserIdentityUseCase`, the
`normalize_user_identity` helpers, `UserRepository.findByIdForUpdate` and `applyIdentity`, and the
conventions in `apps/api/AGENTS.md`, `apps/web/AGENTS.md`, and the ADRs.

## D1 — A seam of its own: `PATCH /api/v1/me/profile`

**Decision**: The feature adds one endpoint, `PATCH /api/v1/me/profile`, named `me.profile.update`,
served by a new `OwnProfileController`. It carries no user identifier: the target is the session's
user, always. It is declared inside the `passwordRenewalCompleted()` group of `start/routes.ts`, next
to the business routes, not in the `/auth` group.

**Rationale**:

- *No identifier, so FR-003 holds by construction.* There is nothing in the request that could name
  another user, so no rule has to refuse one.
- *The two paths differ in every respect but the identity rules.* The administrator seam is gated to
  one role and refuses the requester; this one admits every active role and only the requester. It
  takes a field the other does not (`currentPassword`), and it answers in the session projection
  (`toObject()`), not the administration one (D7).
- *The renewal gate by placement.* `password_renewal_middleware.ts` records that which routes it
  guards "is decided in `start/routes.ts` by where a route is declared, not by a list of names".
  Declaring the route inside the guarded group is what delivers FR-004's "denied while a password
  renewal is required", with no per-route exception.

**Alternatives considered**:

- *Lift the self-exclusion in `PATCH /api/v1/users/:id` for `:id = me`*: rejected. The policy would
  have to admit every role and then depend on the target, which is the inversion GH-24's D1 refused.
  The response would also have to switch projection by target, and `E_USER_IDENTITY_SELF_UPDATE`
  exists precisely to keep the two paths apart.
- *`PATCH /api/v1/auth/me`*: rejected. The `/auth` group sits outside the renewal gate on purpose,
  since password renewal has to be reachable while a renewal is owed. This route would need a
  hand-added `passwordRenewalCompleted()`, which is the "list of names" the middleware warns against.
  It would also make `auth.me` both a route and a namespace in the Tuyau tree.
- *`PATCH /api/v1/users/me`*: rejected. It collides with `/users/:id`, whose validator refuses a
  non-UUID with `422`.

## D2 — Authorization: every active user, on themselves

**Decision**: `UserPolicy.updateOwnProfile(user)` answers `user.accessStatus === 'ACTIVE'`,
whatever the role. The controller authorizes it through Bouncer before validating anything, as
every users endpoint does.

**Rationale**: `middleware.auth()` already refuses a session whose user is not active (`401`). The
policy is kept anyway so that the authorization decision is explicit and tested at the seam where the
other users abilities live. Its doc comment states the difference from `updateIdentity`: every role
may update itself, and only an organization admin may correct someone else.

**Consequence** — the refusals of FR-004 come from three places:

| Who | Refused by | Answer |
|---|---|---|
| No session | `middleware.auth()` | `401` |
| Non-active user | `middleware.auth()`, which re-reads the user | `401` |
| Password renewal owed | `passwordRenewalCompleted()`, by placement (D1) | `403 E_PASSWORD_RENEWAL_REQUIRED` |

## D3 — One slice, two use cases, shared rules

**Decision**: The new `UpdateOwnProfileUseCase` lives in `app/users/profile/`, beside GH-24's
`UpdateUserIdentityUseCase`. It reuses everything GH-24 made shared:

- the helpers `assertValidUserIdentity`, `isSameUserIdentity`, and `isSameEmailAddress`;
- the repository's `findByIdForUpdate` and `applyIdentity`;
- `DuplicateUserEmailException` and `InvalidUserIdentityException`.

The VineJS rules for the three identity fields move from `updateUserIdentityValidator` into an
exported `userIdentityFields` in `user_validator.ts`, which both validators spread. The new use case
and its own validator and exceptions live inside the slice.

**Rationale**: FR-006 requires that a user cannot give themselves an identity an administrator could
not. Sharing the helpers, the validator fields, and the conditional write makes that true by
construction, and a divergence would have to be written on purpose. The two use cases stay separate
because they take different decisions:

| Use case | Decisions |
|---|---|
| Administrator (GH-24) | refuses the requester, and refuses a pending user's address change |
| Self-service (this slice) | requires the current password for an address change, and refuses a row that stopped being active (D5) |

**Alternatives considered**:

- *One use case with an `actor: 'SELF' | 'ADMIN'` switch*: rejected. Every decision would branch on
  it, and the two authorization stories would read as one.
- *A shared "apply under lock" routine that takes each path's decisions as a callback*: rejected. It
  is the boundary inversion GH-24's D5 recorded against a repository-owned `updateIdentity`, moved one
  layer up. The shared part is four lines of transaction plumbing, not worth an abstraction.

## D4 — Re-confirming the password for an address change

**Decision**:

1. **When it is required.** The current password is required if and only if the address changes as
   `isSameEmailAddress` sees it: trimmed and case-insensitive, matching `LOWER(email)` on
   `users_email_unique`. A name-only change or a re-cased address needs none (FR-008).
2. **Where it is verified.** `hash.verify(user.password, currentPassword)` runs against the session
   user the guard loaded for this request, **before** the transaction opens. Scrypt at `cost: 16384`
   is deliberately slow, and `RenewPasswordUseCase` already records that it must never run inside a
   write, here while holding a row lock.
3. **Re-checked under the lock.** Inside the transaction, the mailbox comparison is taken again
   against the locked row. The verification is refused as insufficient, with
   `E_CURRENT_PASSWORD_REQUIRED`, in two cases:
   - the submitted address differs from the locked one, but no password was verified. An
     administrator moved the address between the guard's read and the lock (GH-24).
   - the locked row's password hash is no longer the one verified.

   Both races are narrow and both fail safe.
4. **Order.** VineJS shape → domain normalization → password (presence, then verification) → lock →
   active check (D5) → unchanged short-circuit (D6) → `applyIdentity`, which is where the conflict is
   found. So no verdict on whether another user holds an address is given before the password is
   verified (FR-009). A malformed address is refused by VineJS first, which reveals nothing about
   other users.
5. **Refusals.**

| Exception | Status | Code | Message |
|---|---|---|---|
| `CurrentPasswordRequiredException` | 422 | `E_CURRENT_PASSWORD_REQUIRED` | Enter your current password to change your email address. |
| `CurrentPasswordIncorrectException` | 422 | `E_CURRENT_PASSWORD_INCORRECT` | The current password is incorrect. |

**Rationale for `422`**:

- Not `401`: the session is valid and must survive, and the web's `isUnauthorizedError` matches `401`
  and would sign the user out. `PasswordRenewalRequiredException` records the same reasoning.
- Not `403`: that would read as "you may not be here".
- The refusal is about a submitted value, like `E_PASSWORD_RENEWAL_UNCHANGED`.

Two codes rather than one, so that the message tells the user whether to type something or to retype
it.

**The field**: `currentPassword: vine.string().optional()`, not trimmed, the same treatment the login
validator gives a password. It is never stored, logged, returned, or written (FR-010). A missing
password short-circuits without hashing; no secret is involved, so there is nothing to time.

**Alternatives considered**:

- *Verify under the lock against the locked row*: rejected, because it runs scrypt inside a write.
- *Require the password for every self-service update*: rejected by FR-008. A name is not a
  credential, and the friction would buy nothing.
- *A one-time code sent to the current address*: out of scope. No mailer exists, and mailbox
  confirmation is GH-118.
- *Throttle incorrect attempts*: out of scope per the spec. Sign-in has no throttling either, and the
  attacker this guards against already holds the session.

## D5 — A row that stopped being active is refused as a closed session

**Decision**: If the locked read finds no row, or a row whose `accessStatus` is not `ACTIVE`, the use
case raises `OwnProfileUnavailableException` — `401 E_UNAUTHORIZED_ACCESS`, the same status and code
`middleware.auth()` answers.

**Rationale**: Across requests, the auth middleware already refuses a user who was deactivated while
the form was open. What remains is the window inside one request, between the guard's read and the
lock. The user's current state is "no longer allowed a session", so the answer is the one a session
that has ended gets: the web drops its session and the guards take over. That satisfies the spec's
edge case that such a user MUST NOT be updated. A never-activated user is the only kind that can be
deleted, so "no row" is the same case.

## D6 — An unchanged submission writes nothing

**Decision**: As GH-24's D10. Under the lock, `isSameUserIdentity(locked, submitted)`, an exact
comparison, short-circuits to a success with no `UPDATE` (FR-014). Re-casing a stored value is a
change and is applied. Whether the *mailbox* moves (D4) is the case-insensitive comparison.

**Consequence**: A form opened and submitted untouched never asks for a password and never writes.

## D7 — The response is the session projection

**Decision**: `200` with `UserTransformer.transform(user)` in its default `toObject()` variant, the
same shape `GET /api/v1/auth/me` returns.

**Rationale**: The client that submits this is the session holder, and the thing it must refresh is
its session (FR-018, SC-004). Returning the session shape lets the web seed its `auth.me` cache from
the response, with no second read and no new DTO. `toAdministration()` would hand an operations lead
or an observer the access-history block they are not shown anywhere else.

## D8 — Sessions and remembered connections need nothing

**Decision**: The feature revokes no token and touches no session.

**Rationale**:

- The session guard stores the user's id, not their address, and `remember_me_tokens` rows are keyed
  by user id. Changing the address therefore invalidates nothing, and the current session continues
  (US2).
- Sign-in looks the user up with `findByEmail` on `LOWER(email)`. The new address signs in at once,
  and the former one misses and gets the same `InvalidCredentialsException` as an unknown address
  (FR-012), with no code change.
- Signing out other sessions after an address change is out of scope (FR-020).

## D9 — Web: a dedicated `/profile` route

**Decision**:

- A new route, `routes/_authenticated/profile.tsx`, rendering a page from a new feature module
  `features/profile/`, with the breadcrumb "Your identity".
- It sits under `_authenticated`, so its `beforeLoad` guards already send an unauthenticated visitor
  to sign-in and a user who owes a renewal to `/password-renewal`.
- The page reads the signed-in user from the session context: no loader and no extra query.

**Rationale**:

- *URL state.* `apps/web/AGENTS.md` requires that anything a user can be halfway through lives in the
  URL. A route is the simplest way to make the form survive a reload and be shareable.
- *No new pattern.* A route works from every page without a layout-level search parameter, which
  nothing in the app has today.

**Alternatives considered**:

- *A `Sheet` opened by a search parameter on `_authenticated`*: rejected. It is a new cross-route
  pattern, and every child route whose `navigate({ search })` replaces its search would silently
  close it.
- *A `Dialog` held in `UserMenu` state*: rejected by the URL-state rule. Confirmations such as
  `LogOutConfirmation` are momentary; a form is not.
- *`/users?userId=<me>&mode=edit`*: rejected. `/users` is an administrator workbench, and GH-24's
  `mayEditUserIdentity` deliberately keeps it closed on one's own row.

## D10 — The menu entry

**Decision**: In `components/layout/user-menu.tsx`, the disabled **Profile · Coming soon** item
becomes an enabled **Profile** item with the same icon, linking to `/profile`. It is offered to
every signed-in user, since every one of them is an active user once past the `_authenticated`
guards.

**Rationale**:

- *The label.* `CONTEXT.md` lists "profile update" under *Avoid* for User Identity Update. The
  project's labels name the action. In a global menu, unlike a resource's footer, `Edit` alone would
  not say what is edited, so the object stays: **Profile**.
- *The page's copy.* Its title is "Your identity", and its submit label is "Save changes", as in
  `EditUserForm`.

## D11 — The form

**Decision**: `OwnProfileForm` is built with `useAppForm`, the registered `TextField`, `FormError`,
and `SubmitButton`, and pre-filled from the session user (FR-015).

- **Shared schema.** The first name, last name, and email rules move from `edit-user-form.tsx` into
  `features/users/helpers/identity-schema.ts`, which both forms use. The client side of FR-006 then
  cannot drift either.
- **Current password.** The field appears only while the typed address differs from the session's,
  compared trimmed and case-insensitively as the API does (FR-016). It uses `type="password"` and
  `autoComplete="current-password"`. The client schema requires it only while it is shown.
- **After a submission that did not apply.** The current password is cleared and the identity fields
  are kept (FR-019).
- **When the password rule runs** (*added at delivery, 2026-09-11*). Only on submission. Blur
  validates each field on its own. Judged on blur, the rule fires the moment the address field is
  left, while the password field has only just appeared, empty. TanStack Form then silently drops the
  first click on **Save changes** (see [tasks.md](./tasks.md), delivery notes).

**Refusal mapping**:

| API result | Form |
|---|---|
| `422 E_VALIDATION_ERROR` | `applyValidationError`, onto the field at fault |
| `422 E_CURRENT_PASSWORD_REQUIRED` / `E_CURRENT_PASSWORD_INCORRECT` | Error on the current password field |
| `409 E_USER_EMAIL_CONFLICT` | Error on the email field |
| `422 E_USER_IDENTITY_INVALID`, network, `5xx` | `FormError` and a failure toast from `helpers/resource-copy`; input kept; retry by submitting again (US5) |
| `401`, or `403 E_PASSWORD_RENEWAL_REQUIRED` | `resetSession` and `router.invalidate()`, as `usePasswordRenewal` does; the guards take the user to sign-in or to the renewal. No toast, since it would land on another screen |

## D12 — Cache after an accepted update

**Decision**: `useOwnProfileUpdate` wraps `tuyauQuery.me.profile.update.mutationOptions`. On
success it first writes the response into the `auth.me` cache with `setQueryData`, so the user menu
and the page update at once (SC-004). It then calls `queryClient.invalidateQueries()` for everything
else. On `E_CURRENT_PASSWORD_REQUIRED` it refetches `auth.me`, so a session whose address was moved
by an administrator (D4) shows the current address and the password field.

**Rationale**:

- *Why invalidate everything.* The signed-in user can be named anywhere a lifecycle actor is embedded:
  the user collection for an administrator, the `archivedBy` of site references, discharge
  activity. Enumerating those keys would rot with the next feature that names a user.
- *Why it is cheap.* `invalidateQueries()` refetches only active queries and marks the rest stale.
  The write is rare, and FR-018 is met without a manual reload.

**Alternative considered**: *Invalidate `auth.me` and `userQueries.list()` only*, as GH-24 does for
its target. Rejected: GH-24's target is only ever shown in the collection the administrator is
looking at, while the viewer's own name is embedded in other features' payloads.

## D15 — The password change is its own seam (*added 2026-09-14, with US6*)

**Decision**: `PATCH /api/v1/me/password`, served by `OwnProfileController.changePassword` and
`ChangeOwnPasswordUseCase`, beside the identity update in the same `app/users/profile/` slice. It
asks for the current password, refuses a new password equal to it, obeys the shared
`newPasswordFields`, and — in one transaction — writes the hash and revokes every remembered
connection but the one the request presented.

**Rationale**:

- *Not `POST /auth/password-renewal`.* That seam exists for the renewal an administrator imposed: it
  is reachable **only** while a requirement stands (`NOT_REQUIRED` otherwise), it deliberately asks
  for no current password, and it sits outside the renewal gate. A change the user chooses has the
  opposite shape on all three counts.
- *Not a second field on the profile update.* One request that may replace an identity, a credential,
  or both would make every refusal ambiguous and the audit of a credential write harder to read.
- *Where the work happens.* Both scrypt calls — verifying, then hashing — run before the transaction,
  as `RenewPasswordUseCase` records; the lock then re-checks that the row is still active, owes no
  renewal, and still holds the verified hash (D5's two windows, plus the credential itself).
- *Revocation.* A remembered connection restores access for up to 30 days without a password, so one
  established under the replaced credential must stop working — the rule `renewPassword` already
  applies. The connection the change was made from is spared, so the user is not signed out of the
  browser they are using.

**Alternatives considered**:

- *Revoke every remembered connection, the current one included*: rejected. It signs the user out of
  the browser they just used, for no gain: that connection is being re-authorized by the very
  password they have proved they hold.
- *Reuse `PasswordUnchangedException` (`E_PASSWORD_RENEWAL_UNCHANGED`)*: rejected. Its code names a
  renewal, and the interface would report a renewal the user was never asked for.
- *Ask for no current password, since the session is open*: rejected for the reason US2 gives about
  the address — an open session is not a credential.

## D16 — "Profile" names the screen, and the naming goes to the API (*2026-09-14*)

**Decision**: The self-service screen is the **profile**: `/profile` in the web, `features/profile`,
`PATCH /api/v1/me/profile` and `PATCH /api/v1/me/password` on the API, `app/users/profile/` for the
slice, and `Profile` in the user menu. `CONTEXT.md` gains **Profile** and **Password Change**, and no
longer lists "profile update" under *Avoid* for a user identity update.

**Rationale**: The page now carries the identity *and* the password, so naming it after one of the
two would misname it. The product owner asked for the rename to reach the API rather than stopping at
the surface, so that one word describes the seam, the slice, the module, and the screen. GH-24's
administrator correction keeps `app/users/identity/` and `PATCH /api/v1/users/:id`: correcting
someone else is not touching a profile.

**Consequence**: `me.identity.update` never shipped under that name; the registry, the route, and the
web client were renamed in place before delivery.

## D14 — A stale form is applied, not refused (*added at delivery, 2026-09-14*)

**Decision**: Neither seam carries the identity a form was opened on, and no version travels with the
request. A submission is applied over the identity as it stands, so a form opened before an
administrator's correction replaces it. The product owner confirmed this on 2026-09-14, and US5-3,
the concurrency edge case, and SC-005 were amended to say so.

**Rationale**: It is the reading GH-24 already delivered — its D5 rejected a client-supplied version
because nothing in the codebase carries one — and two seams disagreeing about the same write would be
worse than the loss they each allow. The exposure is narrow: a correction and a self-service update
of the same user, within the minutes a form stays open.

**What still protects the address**: it never moves without the current password (D4), and the
comparison is against the locked row. So the one change that costs a user their way in — an address
an administrator has just corrected being silently put back — is refused. The web then re-seeds the
field with the stored address and names the change rather than asking for a password to undo it.

**Alternative considered**: *the form sends the identity it was opened on, and the API refuses a
stale one with `409`.* It is what SC-005 asked for literally, and it would have made the refusal
visible. Rejected by the product owner: it adds a required field and an exception to a P2 slice,
diverges from GH-24, and would leave the administrator seam with the gap it closes for the
self-service one.

## D13 — Test seams and TDD order

**Decision**: RED → GREEN → REFACTOR in dependency order:

1. **Use-case decisions.** Japa `unit`, SQLite per ADR-0014, factories with a known password, in
   `tests/unit/users/profile/update_own_profile.spec.ts`.
2. **Endpoint.** Japa `integration`, in `tests/integration/users/profile/update.spec.ts`. It
   covers the authorization matrix for all four roles, unauthenticated, non-active, and renewal owed;
   the password matrix; conflict versus password ordering; sign-in with the new and the former
   address; and survival of the session and of remembered connections.
3. **Web.** Vitest, Testing Library, and MSW through the real router, in
   `features/profile/__tests__/` and the existing `user-menu.test.tsx`.

**Rationale**: It is the order GH-24 followed and the layout its tests already use:
`tests/{unit,integration}/users/profile/` exist. There is still no `apps/web/e2e` directory, so the
browser check is the manual pass in [quickstart.md](./quickstart.md).
