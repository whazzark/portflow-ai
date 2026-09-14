# Phase 0 Research: Reactivate a User with Fresh Credentials

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-11

No `NEEDS CLARIFICATION` marker remained in the specification. CLR-001 was resolved before
planning: the reactivation hands over no credential. The research below records the design
decisions the plan rests on. Each was taken against the delivered code, principally the deactivation
it reverses (`#20`) and the password reset it mirrors (`#17`).

The spec left one question open on purpose: whether sessions left over from before the deactivation
need an explicit measure. They do. [D5](#d5--a-session-opened-before-the-latest-reactivation-grants-nothing)
is the one decision here with no precedent in the codebase.

## D1 — Where each refusal is decided

**Decision**: `UserPolicy.reactivate` answers *may this viewer reactivate users at all*: an active
viewer whose role is `ORGANIZATION_ADMIN`, and nothing more. `ReactivateUserUseCase` answers *may
this viewer reactivate **this** user* by mapping the guarded write's outcome onto a named domain
exception.

There is no `SELF` rule. A deactivated administrator can't open a session, so an administrator
naming themselves is necessarily active and gets the `ALREADY_ACTIVE` refusal without a dedicated
check. `UserNotPendingException` already reasons the same way for activation link renewal.

**Rationale**: This is the split `UserPolicy.deactivate` and `DeactivateUserUseCase` already make,
for the reason `user_policy.ts` records: every Bouncer denial surfaces as one
`E_AUTHORIZATION_FAILURE`, so a rule expressed in the policy is a rule the administrator can never be
told the reason for. FR-017 requires `NOT_FOUND`, `PENDING_INVITATION`, `CANCELLED_INVITATION`, and
`ALREADY_ACTIVE` to be distinguishable.

**Alternatives considered**:

- *A `SelfReactivationException`*: rejected. It would be unreachable through the product, and a
  guard that can only fire on a state the system can't be in is a test with nothing to prove.

## D2 — The HTTP shape of each outcome

**Decision**:

| Outcome | Exception | Status | Code |
|---|---|---|---|
| Unknown target | `UserNotFoundException` (shared, existing) | 404 | `E_USER_NOT_FOUND` |
| Pending target | `UserPendingInvitationException` (shared, existing) | 409 | `E_USER_PENDING_INVITATION` |
| Cancelled target | `UserCancelledInvitationException` (shared, existing) | 409 | `E_USER_CANCELLED_INVITATION` |
| Active target | `UserAlreadyActiveException` (**new**, shared) | 409 | `E_USER_ALREADY_ACTIVE` |

The two existing status exceptions are reused for their **codes**. They are thrown with a
reactivation-specific message pointing at the action that applies instead (activation link renewal
for a pending user, invitation restoration for a cancelled one), because their static messages are
worded for the deactivation. `Exception`'s constructor takes the message, so no subclass is needed.

**Rationale**: The codes name the target's state, and that state is the same whichever command
meets it. The web keys its refusal sentences by action first and code second
(`USER_ACCESS_REFUSAL_REASONS`), so one code can already mean different things for two actions.
That is exactly how `E_USER_ALREADY_DEACTIVATED` serves both the deactivation and the invitation
cancellation today. `404` for the unknown target and `409` for every lifecycle conflict are the
statuses the whole users slice uses. `HttpExceptionHandler` renders both without reporting them.

**Alternatives considered**:

- *Reuse `UserAlreadyActivatedException` (`E_USER_ALREADY_ACTIVATED`) for an active target*:
  rejected. It means "the invitation is behind this user" and tells the administrator to deactivate
  them, which is the wrong advice here. The spec names the reason `ALREADY_ACTIVE`, and a reactivation
  refused because someone else got there first is a different statement.
- *A single `E_USER_NOT_DEACTIVATED` carrying the status in `meta`, like `E_USER_NOT_PENDING`*:
  viable, and the renewal slice's precedent. Rejected because the spec already names four distinct
  reasons, mirroring the deactivation's, and the deactivation's taxonomy is the one this command
  reverses. Keeping the two symmetrical is what lets the workbench read them side by side.

## D3 — The guarded write is the concurrency control

**Decision**: `UserRepository.reactivateDeactivated(command)` performs, inside `User.transaction`,
one conditional update:

```text
UPDATE users
   SET access_status = 'ACTIVE',
       reactivated_at = :reactivatedAt,
       reactivated_by_user_id = :reactivatedByUserId,
       password_renewal_required_at = :reactivatedAt,
       updated_at = :reactivatedAt
 WHERE id = :id AND access_status = 'DEACTIVATED'
```

It returns `{ kind: 'REACTIVATED', user }`, `{ kind: 'NOT_FOUND' }`, or
`{ kind: 'NOT_DEACTIVATED', accessStatus }`. A zero-row update is followed by a read that only
**names** the reason. It never decides the outcome.

**Rationale**: This is `deactivateActive` with the guard reversed, and it inherits that method's
whole argument: a single-row conditional `UPDATE` is atomic on both PostgreSQL and SQLite, so two
racing reactivations affect one row and zero rows. The loser reads back `ACTIVE` and resolves as
`ALREADY_ACTIVE` with the winner's date and actor untouched (FR-016). No `SELECT … FOR UPDATE` is
needed: there is no related row to read inside the transaction. The reset needed one only to tell
`NOT_FOUND` from `NOT_ACTIVE` before writing, which the post-write read does here as it does for the
deactivation.

API ADR-0013 fixes the naming: `ReactivateUserInput` for the use case, `ReactivateUserCommand` for
the repository, `ReactivateUserResult` for the outcome. They stay separate types even where their
fields coincide.

**Alternatives considered**:

- *Pre-read under `forUpdate()`, then write, as `requirePasswordRenewal` does*: rejected as
  unnecessary. The guard already settles the race, and the pre-read would be a second statement
  with no decision to make.

## D4 — One inseparable change: status, requirement, event, revocation

**Decision**: The single `UPDATE` above writes the access status, the reactivation event, and the
password renewal requirement together. In the same transaction, and only on success,
`revokeEveryRememberedConnection(trx, id)` deletes the target's `remember_me_tokens`. The requirement
is stamped with the reactivation instant.

Nothing else is written. `deactivated_at` and `deactivated_by_user_id` stay, as the record of the
deactivation this reverses (FR-011). `password_reset_at` and `password_reset_by_user_id` stay, as the
record of an earlier reset, if any. `password` is untouched (FR-012, CLR-001).

**Rationale**: FR-009 requires the status and the requirement to be "one inseparable change". A
reactivated user without the requirement would be an active user whose pre-deactivation credential
works unchallenged, which is the exposure the slice exists to close. Putting both in one statement
makes a partial state unrepresentable, not merely unlikely.

The requirement column is a state marker, read as a boolean everywhere (`#117`'s middleware,
`UserTransformer`'s `passwordRenewalRequired`). Overwriting a value an earlier reset left behind
changes nothing observable. It keeps FR-010 ("exactly one requirement") true by construction:
there is one column, and it is either set or not. What the record presents as the origin is each
event's own pair of columns, as `#17`'s research R3 designed for exactly this case: "a requirement
recorded by a reactivation will be dated by that event instead".

The token revocation is belt and braces. `deactivateActive` already deleted every token, and a
deactivated user can't create one. But users deactivated before that revocation existed, or by any
future path that forgets it, would otherwise carry a 30-day credential straight through the
reactivation, and D5's reasoning about restoration depends on no pre-reactivation token existing.
One idempotent statement makes that true regardless of history.

**Alternatives considered**:

- *Clear `password_reset_*` so the record shows only the reactivation as origin*: rejected. It would
  rewrite history. The access history renders every recorded event in order, and the reset did
  happen.
- *Record the requirement in a second statement*: rejected. It opens the partial state FR-015
  forbids for no benefit.

## D5 — A session opened before the latest reactivation grants nothing

**The problem.** Sessions use the cookie store (`config/session.ts`, API ADR-0001): the encrypted
cookie *is* the session, and there is no server-side record to delete. `clearWithBrowser: true`
leaves the cookie without an expiry, so a browser left open keeps its session for as long as it
stays open. Today a deactivated user's session is refused only because `authenticateOpenSession`
re-reads the user and finds them not `ACTIVE`, and the refusal doesn't clear the session. The moment
the reactivation makes them `ACTIVE` again, that same cookie authenticates. `#117` then confines it
to the renewal step, which hands the choice of the user's new password to whoever holds the browser.
They never have to present a password. This is the exposure FR-014 and User Story 4 forbid.

**Decision**: Every session records **the reactivation it was opened under**. When a session is
opened, the user's current `reactivated_at` (as epoch milliseconds, or `null` for a user never
reactivated) is written into the session under a dedicated key. `authenticateOpenSession`, the one
definition of an open session in this codebase, compares that value with the user's
`reactivated_at` as it re-reads the user on every request. If they differ, the session is forgotten
(`auth_web` and the marker) and the request is refused with the same `E_UNAUTHORIZED_ACCESS`,
"Invalid or expired user session", that an expired remembered connection gets.

The marker is written at the three places a session comes into being:

| Where | What happens there |
|---|---|
| `LoginController.store` | after `auth.use('web').login(...)` |
| `InvitationAcceptanceController.store` | after `auth.use('web').login(user)` |
| `authenticateOpenSession`, restoration branch | when the guard restored the session from a remembered connection on this request |

The comparison is **equality on the stored value**, not a clock comparison. Both sides read the same
`reactivated_at` column. A reactivation always writes a new value there, and nothing else ever
writes it.

**Why this is exact**:

- *A session from before the deactivation* carries the marker of an earlier reactivation, or `null`.
  The new reactivation replaced the value, so they differ, and the session is refused.
- *A session opened after the reactivation* was opened by a login that saw the new value, because
  login is refused until the reactivation commits. It matches, and the session is accepted.
- *A session restored from a remembered connection* is stamped at restoration with the current value.
  That is only safe if no remembered connection from before the reactivation survives, which D4
  guarantees by deleting them all in the reactivation's own transaction.
- *Deactivate → reactivate → deactivate → reactivate*: a session opened in the first active period
  carries the first reactivation's value and is refused after the second.
- *Every session in existence today, and every `loginAs` in the test suites*, carries no marker,
  which reads as `null`. A user never reactivated also has `null`, so nothing changes for them.
  No user has ever been reactivated, because no path to it exists before this slice, so no
  legitimate session is invalidated by the deployment.

**Rationale**: The rule belongs where the question "does this request carry an open session?" is
already answered once for the whole application. `open_session.ts` documents itself as that single
place, shared by `AuthMiddleware` and the public invitation acceptance. It re-reads the user on
every request already, so the check costs no query. Reusing `reactivated_at` as the marker needs no
migration and no second name for the same event: the value that changes exactly when a new access
period begins already exists.

This is the first mechanism in the codebase that invalidates a cookie-store session from the server
side. ADR-0001 records that the cookie holds the whole session. It doesn't say how such a session
is ended, and this decision answers that for the first time, so it is recorded as **API ADR-0015**.
A future slice that needs to end sessions for another reason (for example, if the reset's decision
to leave live sessions standing is ever revisited) generalizes that ADR instead of re-deriving it.

**Alternatives considered**:

- *Forget `auth_web` when `authenticateOpenSession` refuses a non-active user*: rejected as
  insufficient. It ends only the sessions of browsers that make a request while the user is
  deactivated. A laptop asleep through the whole deactivation keeps its cookie and wakes up into the
  reactivated account.
- *A server-side session store (database or Redis)*: rejected. It reverses ADR-0001, adds
  infrastructure to every environment, and changes every request's cost to close one path in one
  command.
- *A dedicated counter column (a "session generation" bumped by the reactivation)*: exact, and the
  runner-up. Rejected because it's a second column whose value changes at exactly the moments
  `reactivated_at` does. It would need a migration and a name for a concept `CONTEXT.md` doesn't have.
  If a second trigger for ending sessions ever appears, ADR-0015 is where the marker becomes a
  counter.
- *Store the session's opening time and refuse sessions opened before `reactivated_at`*: rejected.
  It compares clock readings taken by different requests, possibly on different servers, so any
  skew either refuses a legitimate post-reactivation session or admits a stale one. It also depends
  on how much precision each dialect keeps for a timestamp: values the model saves on SQLite carry
  no milliseconds, as `asStoredDateTime` notes. Keying it on `deactivated_at` instead is worse: the
  deactivation takes its timestamp before its write commits, so a login landing in that window
  looks newer than the deactivation it preceded. Equality on the stored value depends on none of
  this.
- *Rely on the renewal confinement*: rejected. It is the exposure itself: confinement puts the renewal
  step, and with it the new password, in the hands of whoever holds the browser.

**Consequence for tests**: a test that signs in a user whose `reactivated_at` is set must open the
session the real way (`POST /api/v1/auth/login`, then `.withSession(response.session())`, the pattern
`tests/integration/auth/login.spec.ts` already uses) or prime the marker with `.withSession({...})`.
A bare `loginAs` models exactly the stale session this decision refuses. No existing test is
affected: the user factory's `reactivated` state is unused.

## D6 — What the pre-deactivation password does

**Decision**: Nothing changes it. The user signs in with it through the unchanged login, which now
admits them because their status is `ACTIVE`. `#117`'s `PasswordRenewalMiddleware` confines the
session because `password_renewal_required_at` is set. The renewal clears the requirement, and
`renewPassword` revokes the user's other remembered connections as it always does.

**Rationale**: CLR-001. It is the reset's own path (`#17`, FR-010 there), already delivered and
tested end to end. The two residual exposures the spec accepts (a known old password, a forgotten
one) are consequences of this and need no design.

## D7 — A malformed identifier is rejected before the database is touched

**Decision**: `reactivate_user_validator.ts` declares
`vine.create({ params: vine.object({ id: vine.string().uuid() }) })`, run by the controller with
`request.validateUsing(reactivateUserValidator, { data: { params } })`. Authorization runs first, so a
caller who may not reactivate learns nothing from a validation error (FR-002).

**Rationale**: The reason `deactivate_user_validator.ts` records applies unchanged: `users.id` is a
`uuid` column, and a non-UUID string reaching PostgreSQL raises `22P02` as a 500 that the SQLite
suites never see (FR-008).

## D8 — What the endpoint returns

**Decision**: `200` with the reactivated user in the `toAdministration()` projection,
`includeAccessHistory: true`.

**Rationale**: It is the shape every user write returns to the only viewer who can reach it, and a
drop-in for the collection entry the workbench already holds. It carries the three things this call
wrote that the workbench presents: `accessStatus: 'ACTIVE'`, `reactivatedAt` / `reactivatedBy`, and
`passwordRenewalRequired: true`. It carries no credential of any kind (FR-013):
`password_renewal_required_at` itself stays unserialized, as the transformer already insists.

## D9 — The web action joins the existing access actions

**Decision**: `reactivate` becomes a fourth `UserAccessAction`. `userAccessActions` returns
`['reactivate']` for a `DEACTIVATED` user and the same viewer rules as the others. The confirmation
is the existing `UserAccessDialog`, and the wording is new keys in `helpers/user-access-copy.ts`:

| Key | Value |
|---|---|
| label | `Reactivate` |
| pending label | `Reactivating…` |
| dismiss | `Cancel` |
| takes comment | `false` |
| dialog title | `Reactivate user?` |
| subject / participle / failure verb | `user` / `reactivated` / `reactivate` |
| variant | `default`, not `destructive` |

The effect sentence names the user and says both halves of FR-020: they can sign in again with the
password they held before, and they must choose a new password before using the application.

**Rationale**: `user-access-copy.ts` was keyed by action precisely so that "GH-32 adds reactivation to
this same record, and it should add a key, not a second dialog" (deactivation research D8). The
password reset and the activation link renewal sit *outside* `userAccessActions` because they change
a credential rather than an access status. Reactivation changes an access status, so it belongs
inside. Being inside also gives it the row menu and the record footer from the one answer, as FR-019
requires. It isn't destructive: it restores access and removes nothing, and a red button would
misstate that.

**Alternatives considered**:

- *A dedicated `ReactivateUserDialog`, like `ResetPasswordDialog`*: rejected. It duplicates a shell
  that already handles confirmation, pending state, refusal-keeps-open, and toasts, for an action
  with no comment and no secret in its result.

## D10 — The web mutation and what it invalidates

**Decision**: `useUserMutations` gains `reactivate` from `tuyauQuery.users.reactivate`, invalidating
`userQueries.list()` exactly on success **and** on error, as `deactivate` does.

**Rationale**: The workbench derives views, counts, and the open record from that one query. One
invalidation moves the user from `Deactivated` to `Active`, updates both counts, and shows the
renewal in the Password column (FR-022). The error path refreshes too, because the commonest refusal
(`ALREADY_ACTIVE`, someone else got there first) means the record's state moved on.

## D11 — What the workbench does after a success

**Decision**: Nothing new. The user leaves the `deactivated` view, so `UsersPage`'s established rule,
which drops a `userId` naming no visible user from the URL, closes the record. A toast names the
user. In the `Active` view the existing Password column shows `Renewal required` for them, and their
record's access history already renders `Reactivated` with its date and actor. `user-access-history.tsx`
has listed that event since `#4`.

**Rationale**: FR-022 defers to "the workbench's established rule for a user leaving the visible
view", and FR-022's "outstanding renewal visible without opening the user" is the `#17` Password
column, which the `active` view already carries. No new UI element is required.

## D12 — Who sees the action

**Decision**: Offered when the viewer's role is `ORGANIZATION_ADMIN` and the user's `accessStatus` is
`DEACTIVATED`. The existing `user.id === viewer.id` exclusion in `userAccessActions` stays and is
moot here: a viewer is never deactivated.

**Rationale**: An operations admin receives active users only, so a deactivated row never reaches
their workbench. An operations lead or observer has no user workbench at all. The API stays
authoritative (FR-018).

## D13 — The seeded dataset and manual verification

**Decision**: No seeder change. The quickstart first deactivates a seeded user through the delivered
workbench, then reactivates them, which is the round trip the deactivation quickstart said "cannot be
restored until GH-32 ships". Pending and cancelled refusals use factory-created rows, as the
deactivation quickstart does.

## D14 — Verification seams

| Spec | Seam |
|---|---|
| US1.1, US1.5, FR-009–FR-012 | `tests/unit/users/reactivation/reactivate.spec.ts`: the use case writes status, event, and requirement, and nothing else. |
| FR-015, FR-016, D3, D4 | `tests/unit/users/reactivation/guarded_write.spec.ts`: the real `LucidUserRepository` on SQLite (ADR-0014). Zero rows on a non-deactivated target, the target's tokens deleted and nobody else's, a refusal deletes none, `deactivated_*` and `password_reset_*` preserved. |
| US2.1–US2.7, FR-004–FR-008 | Unit spec for each refusal; integration spec for the malformed `:id` (422, no user read). |
| US3.1–US3.5, FR-002 | `tests/integration/users/reactivation/reactivate.spec.ts`: unauthenticated, non-active, confined (`E_PASSWORD_RENEWAL_REQUIRED`), three-role matrix, and a denial identical for known and unknown ids. |
| US5.1–US5.4, FR-016 | Integration spec: two reactivations in sequence; the second is `409 E_USER_ALREADY_ACTIVE` with the first's date and actor intact. |
| US1.2–US1.3, US4.1–US4.4, FR-014, D5 | `tests/integration/users/reactivation/sessions.spec.ts`. A session opened before the deactivation is refused after the reactivation, even `GET /auth/me`, and a second request on it is still refused. A fresh login with the old password succeeds and is confined; the renewal then opens the application. A remembered connection created after the reactivation restores. Another user's session is untouched. |
| D5 regression | `tests/integration/auth/login.spec.ts` and `me.spec.ts` keep passing unchanged: never-reactivated users are unaffected. |
| US6, FR-019–FR-022 | `apps/web/src/features/users/__tests__/reactivate/`: journey, permissions, refusals (one per code), recovery (network failure), row menu, through the real router with MSW. |

No `apps/web/e2e` directory exists, so the browser journey stays manual in
[quickstart.md](./quickstart.md).
