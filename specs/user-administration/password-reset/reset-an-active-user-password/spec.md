# Feature Specification: Reset an Active User Password

**Feature Branch**: `whazzark/reset-an-active-user-password`

**Created**: 2026-07-09

**Last updated**: 2026-09-10 (clarifications CLR-001 and CLR-002 resolved)

**Status**: Draft

**Input**: User description: "l'issue 17 — Reset an Active User Password: let an organization admin require an active user to choose a new password, from the API and from the user workbench. https://github.com/whazzark/portflow-ai/issues/17"

**Feature ID**: `GH-17`

**GitHub Issue**: [#17](https://github.com/whazzark/portflow-ai/issues/17)

**Parent Roadmap**: `specs/user-administration/password-reset/roadmap.md`

**Roadmap Entry**: `GH-17`

**Priority**: priority:P2

**Milestone**: 0. Sécuriser l'administration des utilisateurs

**Domain**: user-administration

> Merged slice: this specification covers both the API seam and the web seam. It absorbs the former
> frontend-only slice "Initiate and Complete a Password Reset Through the Frontend", merged on
> 2026-09-10 and deleted from GitHub. The two seams ship as one feature.

## User Scenarios & Testing *(mandatory)*

This slice delivers the administrator-side half of a pair whose user-side half is already in place.
`Force a Password Change After Login` (`#117`) defined the password renewal requirement, confined
every session carrying it to the renewal step, and cleared it on a completed renewal — but
deliberately shipped **no action that records the requirement**, exercising it through fixtures
instead. This feature is one of the two producers that closes that gap; the other is
`Reactivate a User with Fresh Credentials` (`#32`).

### User Story 1 - Require an Active User to Choose a New Password (Priority: P1)

An organization admin, told that a user's password may be known to someone else or is no longer
usable by its owner, resets that user's password from the user workbench. The user is not signed
out and loses no work in progress, but from their next request onward they reach nothing but the
password renewal step until they have chosen a new password.

**Why this priority**: This is the entire outcome of the slice, and the reason the renewal step
exists. Until an administrator can record the requirement, a credential that must be replaced can
only be replaced by the person who no longer controls it, and `#117` remains a mechanism with no
trigger.

**Independent Test**: Sign in as an organization admin, reset an active user's password from that
user's access record, verify the reset is acknowledged, then sign in as the target user and verify
the renewal step is presented instead of the application, that choosing a new password clears the
requirement, and that the application becomes reachable in the same session.

**Acceptance Scenarios**:

1. **Given** an active user carrying no renewal requirement, **When** an organization admin resets that user's password, **Then** the reset succeeds and the user is recorded as owing a password renewal.
2. **Given** the reset succeeded, **When** the target user next signs in, **Then** the sign-in succeeds and the password renewal step is presented instead of the application frame.
3. **Given** the target user was already signed in and working when the reset was recorded, **When** their next request is issued, **Then** their session is confined to the renewal step without being terminated and without discarding work already saved.
4. **Given** the target user is confined to the renewal step, **When** they choose a new password, **Then** the requirement is cleared, they reach the application in the same session, and no further reset is outstanding.
5. **Given** the reset succeeded, **When** the administrator consults the target user's access record, **Then** the record states that a password renewal is outstanding, with the date of the reset and the administrator who performed it.
6. **Given** the reset succeeded, **When** the administrator consults the outcome, **Then** no password, temporary credential, and no link is produced or disclosed by it, because the target user keeps signing in with the password they already hold and is taken to the renewal step by it.
7. **Given** a reset is performed, **When** the target user's record is examined, **Then** their identity, email, role, access status, and lifecycle history are unchanged by it.

---

### User Story 2 - Confine the Reset to the Administrators Responsible for User Access (Priority: P1)

The reset is available only to organization admins, and only against active users of their operating
organization, so that a lesser-privileged viewer cannot force a colleague through a credential change
and no administrator can lock themselves or a non-active user into a state the lifecycle does not
support.

**Why this priority**: A password reset takes an authenticated user's access away until they act. A
permissive reset is a denial-of-service against colleagues at best and an account-takeover step at
worst, and the API must enforce the rule whatever the interface offers.

**Independent Test**: Attempt the reset as an organization admin, an operations admin, an operations
lead, an observer, an unauthenticated visitor, and a user confined to their own renewal step; and
against an active user, a pending user, a deactivated user, a cancelled user, an unknown user, and
the requester themselves. Verify each outcome at the API seam, then verify the workbench never
offers what the API would refuse.

**Acceptance Scenarios**:

1. **Given** an organization admin is signed in, **When** they reset an active user's password, **Then** the reset is allowed.
2. **Given** an operations admin, an operations lead, or an observer is signed in, **When** they attempt a reset, **Then** the attempt is denied, no requirement is recorded, and no user information is disclosed by the refusal.
3. **Given** a visitor is not authenticated, or the requester's own access status is not active, **When** a reset is attempted, **Then** the attempt is denied and no requirement is recorded.
4. **Given** the target user is pending, deactivated, or cancelled, **When** an organization admin attempts to reset their password, **Then** the attempt is refused with a reason stating that only an active user's password can be reset, and no requirement is recorded.
5. **Given** an organization admin is signed in, **When** they attempt to reset their own password, **Then** the attempt is refused, because requiring oneself to renew is a self-service password change rather than an administrative reset.
6. **Given** an identifier naming no user of the operating organization, **When** a reset is attempted, **Then** the attempt is refused without revealing whether that user exists elsewhere.
7. **Given** a viewer may not reset passwords, **When** they browse the user workbench, **Then** no reset action is presented, and reaching the action directly still records nothing.
8. **Given** an administrator is confined to their own password renewal step, **When** they attempt a reset, **Then** the attempt is refused like every other request from a confined session.

---

### User Story 3 - Close the Window on the Password Being Replaced (Priority: P1)

An organization admin resetting a password because it may be known to someone else needs the
remembered connections held under that password to stop restoring access at once, while the target
user's live session stays open long enough to take them to the renewal step, so that the reset ends
the exposure it was performed to end without discarding work the user has in progress.

**Why this priority**: A remembered connection restores access for up to 30 days without presenting
a password. If those connections survived the reset, a browser remembered under the replaced
credential would keep working for weeks — the exact exposure the reset exists to end. Revocation is
the security consequence of the reset itself, is invisible unless specified, and cannot be deferred
to a later slice without shipping a reset that closes nothing.

**Independent Test**: Establish, for the target user, a live session on one browser and remembered
connections on two others. Reset their password. Verify neither remembered connection restores a
session any more, that the live session is not terminated but reaches nothing but the renewal step
at its next request, that no other user's sessions or remembered connections are affected, and that
the target still reaches the renewal step by signing in with the password they already hold.

**Acceptance Scenarios**:

1. **Given** the target user holds remembered connections on several browsers, **When** their password is reset, **Then** none of those connections restores a session any more, whichever browser it was established from, and each of those browsers must sign in again.
2. **Given** the target user holds a live session, **When** their password is reset, **Then** the session is not terminated: at its next request it is confined to the renewal step, so work already saved is untouched and the user meets the renewal instead of an unexplained sign-out.
3. **Given** the target user's remembered connections were revoked, **When** they sign in again with the password they already hold, **Then** the sign-in succeeds and the renewal step is presented, so the reset never leaves them without a route forward.
4. **Given** several users hold sessions and remembered connections, **When** one user's password is reset, **Then** only that user's remembered connections are revoked and every other user's sessions and remembered connections are untouched.
5. **Given** a reset is refused or fails, **When** the target user's access is examined, **Then** no remembered connection has been revoked, no session has been affected, and no requirement has been recorded.
6. **Given** the target user holds no remembered connection at all, **When** their password is reset, **Then** the reset succeeds exactly as it does otherwise, with nothing to revoke.

---

### User Story 4 - Understand and Recover From a Refused Reset (Priority: P2)

An organization admin receives clear feedback when a reset cannot be recorded, and can retry without
leaving the user workbench, so that a refusal is never read as a silent success and a user is never
left half-reset.

**Why this priority**: The administrator acts on someone else's access and cannot observe the result
by using it. An ambiguous outcome leads them either to leave a compromised credential standing or to
reset repeatedly. It protects the primary outcome rather than creating it.

**Independent Test**: Attempt a reset against a user whose access status changed in the meantime,
during a transient failure, twice in quick succession, and against a user who already owes a
renewal. Verify each produces distinct feedback, that the recorded state after any refusal is exactly
the state before it, and that a subsequent valid attempt records exactly one outstanding requirement.

**Acceptance Scenarios**:

1. **Given** the target user was deactivated or cancelled after the workbench listed them, **When** the administrator confirms the reset, **Then** the reset is refused with a reason naming the current access status, nothing is recorded, and the displayed collection can be refreshed to the current state.
2. **Given** the reset cannot be recorded because the underlying service is temporarily unavailable, **When** the administrator retries after it recovers, **Then** exactly one outstanding requirement is recorded and the earlier attempt left nothing behind.
3. **Given** the same reset is submitted twice in quick succession, **When** both submissions are processed, **Then** the target user owes exactly one password renewal and the second submission resolves to that same state rather than to a second, different one.
4. **Given** the target user already owes a password renewal from an earlier reset or reactivation, **When** an organization admin resets their password again, **Then** the outcome is unambiguous, the user still owes exactly one renewal, and the reset that is presented as outstanding is the most recent one.
5. **Given** the target user completed their renewal moments before, **When** a reset submitted just beforehand is processed, **Then** the resulting state is unambiguous — either the renewal cleared the requirement or the reset recorded a new one — and never a state where the interface reports a reset that was not recorded.
6. **Given** any refused reset, **When** the administrator reviews the user's access record, **Then** it shows the state as it was before the attempt and the action remains usable for another attempt.

---

### User Story 5 - Act on the Reset From the User Workbench (Priority: P2)

An organization admin performs the reset from the user they are already consulting, confirms it
deliberately, and sees the consequence reflected in the record without having to reload the
workbench or reason about what happened.

**Why this priority**: The API seam makes the reset possible; this is what makes it usable by the
person actually responsible for access. It is P2 because the outcome above is complete and testable
at the API before the workbench presents it.

**Independent Test**: Open an active user's access record in the workbench, invoke the reset, verify
an explicit confirmation naming the affected user and stating the consequence, confirm, and verify
the record and the collection reflect the outstanding renewal without a manual reload; then repeat
and cancel at the confirmation, verifying nothing was recorded.

**Acceptance Scenarios**:

1. **Given** an active user's access record is open, **When** an organization admin looks for access actions, **Then** the password reset is offered on that record.
2. **Given** the reset is invoked, **When** the confirmation is presented, **Then** it names the user concerned and states plainly that the user will have to choose a new password before using the application again.
3. **Given** the confirmation is presented, **When** the administrator cancels it, **Then** nothing is recorded and the record is unchanged.
4. **Given** the confirmation is accepted, **When** the reset succeeds, **Then** the outcome is acknowledged and the open record and the collection show the outstanding renewal without a manual reload.
5. **Given** a non-active user's access record is open, **When** the administrator looks for the reset, **Then** it is not offered, consistent with the API's refusal.
6. **Given** the reset is being processed, **When** the administrator submits it again, **Then** the interface prevents a duplicate submission for the same user.
7. **Given** an active user is listed in the collection, **When** an organization admin opens that user's row menu, **Then** the password reset is offered there too, under the same rules and with the same confirmation as on the record, without opening the record.

### Edge Cases

- The target user's access status changes between the moment the workbench listed them and the moment the reset is confirmed: the decision is taken on the current state, not the displayed one.
- The target user completes a password renewal at almost the same moment a reset is recorded: the outcome is one of the two unambiguous states, never a reset the administrator was told succeeded but which left no requirement.
- Two organization admins reset the same user at almost the same moment: the user owes exactly one renewal, and the reset presented as outstanding is one of the two, consistently in the record and in the collection.
- A user who already owes a renewal from a reactivation is reset: they still owe exactly one renewal, and completing it clears both origins at once, because the requirement is a single state rather than a queue.
- An organization admin resets a user who is another organization admin: the reset is allowed, because the requirement removes no access and no last-administrator invariant is at stake.
- The administrator who performed a reset is deactivated or removed afterwards: the recorded reset keeps its date and remains presented, with the responsible administrator handled exactly as every other unattributed or departed actor in the access history.
- The target user never signs in again: the requirement stands indefinitely, is cleared only by a completed renewal, and is not expired by this feature.
- A reset is recorded while the target user is on the sign-in screen: the next successful sign-in presents the renewal step.
- The target user is deactivated after a reset and later reactivated: the reactivation's own requirement and the reset's requirement resolve to a single outstanding renewal.
- A reset is attempted against a user of another operating organization or a user identifier that does not exist: both are refused identically, so neither confirms the existence of a user.
- No password, temporary credential, activation link, session token, or remembered-connection token is disclosed by the reset response, by the access record, or by the collection.
- The target user is signed in on the very browser their connection was remembered from: the reset revokes the remembered connection but leaves the live session standing and confined, so closing that browser means signing in again while the current visit is not interrupted.
- The target user is reset twice with no sign-in in between: the second reset finds no remembered connection left to revoke and succeeds all the same.
- A remembered connection is established, the reset is recorded, and the browser is only reopened weeks later: it simply no longer restores access, and the requirement is still presented after the next sign-in.
- Whoever holds the target's live confined session can complete the renewal themselves and choose the new password. This is a known and accepted residual exposure of leaving live sessions standing; closing it means terminating sessions, which was weighed and declined.
- A transient failure during the reset must be distinguishable, in the workbench, from a refusal on the target's access status and from an authorization refusal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let an organization admin require an active user of their operating organization to choose a new password, by recording a password renewal requirement against that user.
- **FR-002**: The recorded requirement MUST be the same state that `Force a Password Change After Login` (`#117`) enforces and clears; this feature MUST NOT introduce a second, parallel notion of "must change password".
- **FR-003**: The system MUST record, with the requirement, the date of the reset and the administrator who performed it, so the access record can state when and by whom the renewal was required.
- **FR-004**: A successful reset MUST leave the target user's identity, email, role, access status, and lifecycle history unchanged, and MUST NOT terminate their live sessions; those sessions are confined to the renewal step at their next request by `#117`.
- **FR-004a**: A successful reset MUST revoke every remembered connection held by the target user, on every browser, so that the password being replaced restores access nowhere, and MUST leave every other user's remembered connections untouched.
- **FR-005**: The system MUST restrict the reset to organization admins whose own access status is active, and MUST deny it to operations admins, operations leads, observers, unauthenticated visitors, and any session confined to its own password renewal.
- **FR-006**: The system MUST refuse a reset whose target is not an active user, with a reason naming the refusal, and MUST record nothing.
- **FR-007**: The system MUST refuse an administrator's attempt to reset their own password, because a self-service password change is out of scope and stays out of scope.
- **FR-008**: The system MUST refuse a reset targeting a user outside the requester's operating organization, or an identifier naming no user, without revealing whether such a user exists.
- **FR-009**: The API MUST be the authoritative authorization boundary: the workbench MUST NOT offer, and MUST NOT appear to perform, a reset the API would refuse to the same viewer.
- **FR-010**: The reset MUST record the renewal requirement and nothing else: it MUST NOT change the target user's password, and MUST NOT produce a temporary password, a reset link, or any other credential for the administrator to pass on. The target user signs in with the password they already hold and is taken to the renewal step by the requirement.
- **FR-010a**: The system MUST NOT disclose the target user's password, password material, activation link, session token, or remembered-connection token through this feature.
- **FR-011**: A reset recorded against a user who already owes a renewal MUST leave exactly one outstanding requirement, refreshed to the most recent reset's date and administrator.
- **FR-012**: The system MUST ensure that repeated or concurrent resets against the same user leave exactly one outstanding requirement and one consistent recorded origin.
- **FR-013**: A refused or failed reset MUST leave the target user's requirement, password, sessions, and remembered connections exactly as they were before the attempt, with no partial change recorded.
- **FR-014**: The system MUST report authorization refusals, access-status refusals, self-reset refusals, unknown-target refusals, and transient failures with distinct, understandable, and actionable feedback.
- **FR-015**: The workbench MUST offer the reset from the access record of an active user and from that user's row menu in the collection, under the same rules and with the same confirmation on both, and MUST NOT offer it on a user whose access status makes it refusable.
- **FR-016**: The workbench MUST require an explicit confirmation that names the user concerned and states the consequence — that the user will have to choose a new password before using the application again — before the reset is submitted, and cancelling it MUST record nothing.
- **FR-017**: The workbench MUST prevent a duplicate submission of the same reset while one is in flight.
- **FR-018**: After a successful reset, the workbench MUST reflect the outstanding renewal in the open access record and in the collection without requiring a manual reload.
- **FR-019**: The access record MUST present an outstanding renewal requirement, with its date and responsible administrator, to viewers allowed to consult the access history, and MUST withhold it from viewers who may not — consistent with the rule already established for lifecycle events by `Browse and Filter the User List` (`#4`).
- **FR-020**: The collection MUST let an organization admin tell, without opening a user, that the user owes a password renewal.
- **FR-021**: This feature MUST NOT change sign-in, sign-out, remembered-connection, or password renewal behaviour beyond recording the requirement and revoking the target user's remembered connections as FR-004a states.
- **FR-022**: This feature MUST NOT provide a self-service password change, a forgotten-password recovery flow, user invitation, invitation cancellation or restoration, activation link renewal, pending user removal, deactivation, reactivation, role change, or identity update.
- **FR-023**: This feature MUST NOT send any email or other notification; announcing the reset to the user stays owned by `Send password reset emails` (`#123`).

### Key Entities *(include if feature involves data)*

- **User**: The active person whose password is being reset. The reset changes only their password renewal requirement and whatever access this specification records as revoked with it; identity, email, role, access status, and lifecycle history are preserved.
- **Password Reset**: The administrator-side action of requiring an active user to choose a new password. It records a password renewal requirement, together with its date and responsible administrator.
- **Password Renewal Requirement**: The state marking that a user must choose a new password before using the application. Independent of access status and role, it survives sign-out, applies on every browser at once, and is cleared only by a completed password renewal. Written here, enforced and cleared by `#117`.
- **Organization Admin**: The only role that may perform the reset, and the actor recorded against it.
- **Remembered Connection**: The connection restorable on a browser for at most 30 days without presenting a password. Every one held by the target user is revoked by a successful reset; every other user's are untouched.
- **Operating Organization**: The scope owning the users an administrator may reset; users of another organization are outside it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of resets performed by an organization admin against an active user record exactly one outstanding password renewal requirement, and 100% of the users they target reach the renewal step instead of the application on their next request.
- **SC-002**: In all authorization tests, organization admins may reset active users, and operations admins, operations leads, observers, unauthenticated visitors, non-active requesters, and sessions confined to their own renewal obtain no reset and disclose no user information.
- **SC-003**: In acceptance testing, 100% of resets targeting a pending, deactivated, cancelled, unknown, or out-of-organization user, and 100% of self-reset attempts, are refused with nothing recorded.
- **SC-004**: In acceptance testing, 100% of refused and failed resets leave the target's requirement, password, sessions, and remembered connections exactly as they were, and each refusal produces distinct and accurate feedback.
- **SC-005**: In all acceptance datasets, repeated, concurrent, and re-applied resets against the same user leave exactly one outstanding requirement with one consistent recorded origin.
- **SC-006**: In acceptance testing, 100% of successful resets affect only the target user; zero sessions and zero remembered connections belonging to any other user are affected.
- **SC-007**: In acceptance testing, an organization admin completes a reset from an open access record in no more than 3 interactions, and the outstanding renewal is visible in the record and the collection within 2 seconds without a manual reload.
- **SC-008**: In acceptance testing, 100% of resets leave the target user's identity, email, role, access status, and lifecycle history unchanged.
- **SC-009**: In acceptance testing, no reset response, access record, or collection payload discloses password material, activation links, or session and remembered-connection tokens, and no reset produces a credential of any kind.
- **SC-010**: In acceptance testing, 100% of successful resets revoke every remembered connection held by the target user, 0% terminate the target's live sessions, and 100% of those live sessions reach nothing but the renewal step at their next request.
- **SC-011**: In acceptance testing, 100% of target users whose remembered connections were revoked reach the renewal step by signing in with the password they already held, and 0% are left with no route back into the application.

## Dependencies

- `#117` — Force a Password Change After Login (delivered): defines the password renewal requirement, confines every session carrying it, and clears it on a completed renewal. This feature is the administrator-side producer it was built for and adds no second mechanism.
- `#4` — Browse and Filter the User List (delivered): supplies the user collection, the access record the action is offered from, and the authorization rules for consulting users and their access history.
- `#3` — Restrict Login to Active Users: establishes that only active users hold a session, which the "active target" rule builds on.
- No open issue blocks this slice; it is the only remaining slice of the `Password Reset` roadmap (`#16`).

## Out of Scope

- Self-service password change for a user who owes no renewal, and forgotten-password recovery initiated by the user.
- The password renewal step itself, its validation rules, its confinement, and the revocation it performs on completion — all owned by `#117`.
- Announcing the reset to the user by email or any other notification, owned by `#123`.
- Recording the renewal requirement as part of a reactivation, owned by `#32`.
- Every other user access write action: invitation, invitation cancellation and restoration, activation link renewal, pending user removal, deactivation, reactivation, role change, and identity update.
- Bulk password resets over a selection of users.
- Password expiry after a fixed period, password history beyond the immediately replaced password, rate limiting, brute-force protection, and multi-factor authentication.
- Auditing or exporting reset activity beyond what the access record presents.

## Assumptions

- `Password Reset` follows its `CONTEXT.md` definition: it is the action of *requiring* an active user to choose a new password, and it is explicitly not password recovery. The renewal requirement it records is the one `#117` already enforces.
- Only organization admins may reset, following `CONTEXT.md`: they are the role responsible for managing users and their access. Operations admins may consult active users but hold no write access to them.
- Only an active user may be reset. A pending user has no password yet and is served by activation link renewal; a deactivated user is served by reactivation, which records the requirement itself; a cancelled user holds no access to protect.
- An administrator may not reset themselves. The renewal step is reachable only by users who owe a renewal, so a self-reset would be a self-service password change under another name, and `#117` placed that out of scope.
- A reset does not terminate the target's live sessions. `#117` already confines a live session at its next request, which is how the target meets the renewal step instead of an unexplained sign-out, and terminating it would discard work in progress the administrator cannot see.
- A reset does revoke every remembered connection held by the target user, because a remembered connection restores access for up to 30 days without presenting a password, and leaving those standing would keep the replaced credential usable for weeks — the exposure the reset was performed to end. This mirrors the revocation `#117` performs on a completed renewal, applied at the moment the requirement is recorded rather than when it is cleared.
- Leaving live sessions standing is accepted with a known residual exposure: whoever holds such a session can complete the renewal themselves. Terminating sessions would close it, at the cost of turning every reset into an unexplained sign-out with lost work; the exposure is bounded by the session's own lifetime, whereas a remembered connection's is 30 days, which is why the two are treated differently.
- The reset changes no credential. The target user keeps the password they already hold, signs in with it normally, and is confined to the renewal step — the behaviour `#117` already specifies, including its edge case where the credential being replaced still authenticates. A user who has forgotten their password is not served by this feature; forgotten-password recovery is a separate, out-of-scope concern, and `CONTEXT.md` warns against reading `Password Reset` as password recovery.
- The requirement is a single user-level state, not a queue: a user reset twice, or reset and reactivated, owes exactly one renewal and clears it once.
- The reset is recorded with a date and a responsible administrator, in the same shape as the existing lifecycle events, and is presented in the access record alongside them. `#117` deliberately left no actor recorded against the requirement, noting that the actor belongs to whichever action records it — this one.
- The access history, including the reset, stays restricted to viewers allowed to consult it, following the rule `#4` established: a responsible administrator is itself a user that a lesser-privileged viewer may not consult.
- The operating organization manages exactly one site, so the requester's organization determines which users are resettable without an organization or site picker.
- The workbench reuses the existing user administration surface — the collection, the access record opened from a row, and the confirmation, feedback, and error conventions already used by the site-reference write actions.
- The reset is a single-user action invoked from one user's record; bulk selection is a separate concern and is not introduced here.
- The user is informed of the reset out of band until `#123` delivers email, consistent with this milestone excluding real email sending.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/17
- Parent roadmap: specs/user-administration/password-reset/roadmap.md (`#16`)
- Absorbed scope: "Initiate and Complete a Password Reset Through the Frontend", a frontend-only slice merged here on 2026-09-10 and deleted from GitHub.
- User-side counterpart: specs/authenticated-shell/authenticated-shell/force-a-password-change-after-login/spec.md (`#117`, delivered)
- Consuming slice: specs/standalone/send-password-reset-emails/spec.md (`#123`, blocked by this one)
- Sibling producer: specs/user-administration/user-reactivation/reactivate-a-user-with-fresh-credentials/spec.md (`#32`)
- Domain vocabulary: CONTEXT.md (Password Reset, Password Renewal Requirement, Password Renewal, Organization Admin, User Access Status, Remembered Connection)
