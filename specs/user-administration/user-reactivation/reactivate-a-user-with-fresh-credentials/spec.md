# Feature Specification: Reactivate a User with Fresh Credentials

**Feature Branch**: `whazzark/reactivate-a-user-with-fresh-credentials`

**Created**: 2026-07-09

**Last updated**: 2026-09-11 (clarification CLR-001 resolved)

**Status**: Draft

**Input**: User description: "https://github.com/whazzark/portflow-ai/issues/32 — Reactivate a User with Fresh Credentials"

**Feature ID**: `GH-32`

**GitHub Issue**: [#32](https://github.com/whazzark/portflow-ai/issues/32)

**Parent Roadmap**: `specs/user-administration/user-reactivation/roadmap.md`

**Roadmap Entry**: `GH-32`

**Priority**: priority:P2

**Milestone**: 0. Sécuriser l'administration des utilisateurs

**Domain**: user-administration

> Merged slice: this specification covers both the API seam and the web seam. It absorbs the former
> frontend-only slice "Reactivate a User From the Web Workbench", merged on 2026-09-10 and deleted
> from GitHub. The two seams ship as one feature.

## User Scenarios & Testing *(mandatory)*

This slice is the reverse of `Reject Ineligible User Deactivation` (`#20`) and the second producer
of the password renewal requirement. `Force a Password Change After Login` (`#117`) defined that
requirement, confines every session carrying it to the renewal step, and clears it on a completed
renewal. `Reset an Active User Password` (`#17`) was the first action to record it, and named this
slice as the other one. A reactivation restores sign-in access and records the same requirement, so
the credential a user held before their deactivation is replaced by one only they know before they
do any work.

"Fresh credentials" means the password the user chooses at their first sign-in after the
reactivation. The reactivation itself gives no credential to anyone (CLR-001).

### User Story 1 - Restore a Deactivated User's Access Under a New Password (Priority: P1)

An organization admin restores the access of a user who was deactivated, for example because they
have returned to the organization, from the user workbench. The user can sign in again with the
password they held before the deactivation, but reaches nothing except the password renewal step
until they have chosen a new password.

**Why this priority**: This is the entire outcome of the slice. Today a deactivation can't be
undone: a returning colleague has to be re-invited under a new identity, which is impossible anyway
because their email stays attached to the retired user. Their history then splits in two. Requiring
a new password is what makes the restored access safe, because the old credential may have been
shared or exposed while no one was watching it.

**Independent Test**: Sign in as an organization admin and reactivate a deactivated user from their
access record. Check that the reactivation is acknowledged and that the user is back in the active
view. Then sign in as that user with their pre-deactivation password. The renewal step should appear
instead of the application. Choosing a new password should clear the requirement and open the
application in the same session.

**Acceptance Scenarios**:

1. **Given** a deactivated user, **When** an organization admin reactivates them, **Then** their access status becomes Active, the date of the reactivation and the responsible administrator are recorded, the user is recorded as owing a password renewal, and the reactivation is confirmed.
2. **Given** the reactivation succeeded, **When** the user signs in with the password they held before their deactivation, **Then** the sign-in succeeds and the password renewal step is presented instead of the application frame.
3. **Given** the user is confined to the renewal step after a reactivation, **When** they choose a valid new password, **Then** the requirement is cleared, they reach the application in the same session, and their next sign-in uses the new password.
4. **Given** the reactivation succeeded, **When** the administrator consults the user's access record, **Then** it shows the reactivation with its date and responsible administrator, still shows the earlier deactivation with its own date and administrator, and shows that a password renewal is outstanding.
5. **Given** the reactivation succeeded, **When** the target user's record is examined, **Then** their identity, email, role, and every lifecycle event recorded before the reactivation are unchanged by it.
6. **Given** the reactivation succeeded, **When** the administrator consults its outcome, **Then** no password, temporary credential, or link is produced or disclosed, because the user signs back in with the password they already hold and is taken to the renewal step.
7. **Given** a user was reactivated, **When** any record they produced before their deactivation is consulted, **Then** it still names them, and the work they do after the reactivation is attributed to the same user, never to a second one.

---

### User Story 2 - Refuse to Reactivate an Ineligible User (Priority: P1)

The operating organization wants a reactivation refused whenever its target is not currently
deactivated. Access status then only moves along a meaningful path, and the administrator is told
which action applies instead rather than producing an inconsistent record.

**Why this priority**: The eligibility rules are what makes the command safe to expose. A
reactivation that activated a pending or cancelled user would let someone who never accepted an
invitation into the application without choosing a password, and it would bypass the invitation
workflow entirely. The rules ship with the successful path because the same action surfaces both.

**Independent Test**: Attempt to reactivate a pending user, a cancelled user, an active user, the
acting administrator's own access, an identifier that matches no user, and a malformed identifier.
Check that each attempt is refused with its own reason and leaves the target completely unchanged.

**Acceptance Scenarios**:

1. **Given** a pending user who has never activated their access, **When** an organization admin attempts to reactivate them, **Then** the attempt is refused with the reason `PENDING_INVITATION`, pointing to activation link renewal as the action that applies instead. The user stays pending, and their activation link is unaffected.
2. **Given** a user whose invitation was cancelled before activation, **When** an organization admin attempts to reactivate them, **Then** the attempt is refused with the reason `CANCELLED_INVITATION`, pointing to invitation restoration as the action that applies instead. The user stays cancelled.
3. **Given** a user who is already active, **When** an organization admin attempts to reactivate them, **Then** the attempt is refused with the reason `ALREADY_ACTIVE`, and nothing is recorded: no renewal requirement, no reactivation date, no responsible administrator.
4. **Given** an identifier that matches no user of the operating organization, **When** an organization admin attempts to reactivate it, **Then** the attempt is refused with the reason `NOT_FOUND`, without disclosing anything about other users.
5. **Given** an identifier that is not a valid user reference at all, **When** a reactivation is submitted for it, **Then** the request is rejected before any user is evaluated or changed.
6. **Given** an organization admin targets their own access, **When** they attempt to reactivate it, **Then** the attempt is refused with the reason `ALREADY_ACTIVE`, since only an active administrator can make the request, and nothing is recorded.
7. **Given** any refused reactivation attempt, **When** the stored users are inspected afterwards, **Then** no user's access status, renewal requirement, or lifecycle metadata has changed as a result.

---

### User Story 3 - Refuse Reactivation to Anyone Not Entitled to It (Priority: P1)

The operating organization wants reactivation refused to every actor who is not an active
organization admin. Restoring someone's access stays with the single role accountable for it,
whether the request comes from the interface or is sent directly.

**Why this priority**: Reactivation restores access, including an organization admin's full user
administration powers when the target holds that role. A permissive command would let a
lesser-privileged user bring a retired account back, which is an account takeover waiting to happen.
The API must enforce the rule whatever the interface offers.

**Independent Test**: Attempt a reactivation as an unauthenticated visitor, an operations admin, an
operations lead, an observer, and an organization admin confined to their own renewal step. Check
that every attempt is refused, no user is changed, and the action is never offered in their
interface.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** a reactivation is attempted, **Then** it is refused as unauthenticated and no user is changed.
2. **Given** an authenticated operations admin, operations lead, or observer, **When** a reactivation is attempted, **Then** it is refused as unauthorized, no user is changed, and the refusal discloses nothing about whether the targeted user exists or is deactivated.
3. **Given** an organization admin is confined to their own password renewal step, **When** they attempt a reactivation, **Then** it is refused like every other request from a confined session.
4. **Given** an organization admin whose own access stops being active between opening the record and confirming the reactivation, **When** they confirm, **Then** the request is refused as if they had never been authorized, and the targeted user is unchanged.
5. **Given** a viewer who may not reactivate users is browsing the user workbench, **When** they look for access actions, **Then** no reactivation is offered, and reaching the action directly still changes nothing.

---

### User Story 4 - Let Only a Fresh Sign-In Bring the User Back (Priority: P1)

An organization admin reactivating a user needs the access restored to begin at the user's next
sign-in, with the password they held before, and nowhere else. A browser session or remembered
connection left over from before the deactivation must not come back to life and hand the renewal
step, and therefore the choice of the new password, to whoever holds that browser.

**Why this priority**: A deactivation stops a user's existing sessions from granting access, but a
browser that was open when it happened can still hold what it needs to resume. If a reactivation
revived it, the holder of that browser could choose the user's new password without knowing any
password at all. This is the security consequence of the reactivation itself. It stays invisible
unless it is specified, and it can't be deferred without shipping a reactivation that reopens an
access the deactivation had closed.

**Independent Test**: Before deactivating a user, open a session for them on one browser and a
remembered connection on another. Deactivate the user, then reactivate them. Check that neither
browser regains any access, whether the renewal step or the application, and must sign in again.
Check that signing in with the pre-deactivation password leads to the renewal step, and that no
other user's sessions or remembered connections are affected.

**Acceptance Scenarios**:

1. **Given** a user held an open session when they were deactivated, **When** they are reactivated and that session is next used, **Then** it grants no access at all, not even the renewal step, and the browser is returned to sign-in.
2. **Given** a user held remembered connections when they were deactivated, **When** they are reactivated and any of those browsers is reopened, **Then** no remembered connection restores a session, whichever browser it came from.
3. **Given** the user's earlier sessions and remembered connections grant nothing, **When** the user signs in again with the password they held before the deactivation, **Then** the sign-in succeeds and the renewal step is presented, so the reactivation never leaves them without a route forward.
4. **Given** several users hold sessions and remembered connections, **When** one user is reactivated, **Then** every other user's sessions and remembered connections are untouched.
5. **Given** a reactivation is refused or fails, **When** the target's access is examined, **Then** their access status, renewal requirement, and lifecycle metadata are exactly as before the attempt.

---

### User Story 5 - Understand and Recover From a Refused Reactivation (Priority: P2)

An organization admin gets clear feedback when a reactivation can't be recorded and can retry
without leaving the user workbench. A refusal is then never read as a silent success, and a user is
never left half-reactivated.

**Why this priority**: The administrator acts on someone else's access and can't observe the result
by using it. An ambiguous outcome leads them to tell a returning colleague they can sign in when
they can't, or to reactivate repeatedly. This story protects the primary outcome rather than
creating it.

**Independent Test**: Attempt a reactivation against a user another administrator has just
reactivated, during a transient failure, and twice in quick succession. Check that each attempt
produces distinct feedback, that the recorded state after any refusal is exactly the state before
it, and that exactly one reactivation is ever recorded.

**Acceptance Scenarios**:

1. **Given** the target user was reactivated by someone else after the workbench listed them as deactivated, **When** the administrator confirms the reactivation, **Then** it is refused with `ALREADY_ACTIVE`, the date and responsible administrator of the first reactivation are unchanged, and the workbench shows the refreshed status.
2. **Given** two organization admins reactivate the same deactivated user at nearly the same moment, **When** both requests are processed, **Then** exactly one reactivation succeeds and the other resolves as `ALREADY_ACTIVE`, so the recorded date and responsible administrator are those of the first and are never overwritten.
3. **Given** the reactivation can't be recorded because the underlying service is temporarily unavailable, **When** the administrator retries after it recovers, **Then** exactly one reactivation is recorded, and the earlier attempt left nothing behind: no status change, no renewal requirement, no partial record.
4. **Given** the same reactivation is submitted twice in quick succession, **When** both submissions are processed, **Then** the user is reactivated once, owes exactly one renewal, and the second submission is reported as `ALREADY_ACTIVE` rather than as a second success.
5. **Given** any refused reactivation, **When** the administrator reviews the user's access record, **Then** it shows the state as it was before the attempt, and the action remains usable wherever the current status still allows it.

---

### User Story 6 - Act on the Reactivation From the User Workbench (Priority: P2)

An organization admin reactivates a user from the deactivated user they are already consulting,
confirms it deliberately, and sees the consequence in the workbench without reloading it or
reasoning about what happened.

**Why this priority**: The API seam makes the reactivation possible; the workbench makes it usable
by the person responsible for access. This is P2 because the outcome is complete and testable at
the API before the workbench presents it.

**Independent Test**: Open a deactivated user's access record in the workbench and invoke the
reactivation. Check that an explicit confirmation names the user and states the consequence, then
confirm. Check that the user moves from the deactivated view to the active view, that the view
counts follow, and that the record shows the reactivation and the outstanding renewal without a
manual reload. Repeat and cancel at the confirmation, and check that nothing was recorded.

**Acceptance Scenarios**:

1. **Given** a deactivated user's access record is open, **When** an organization admin looks for access actions, **Then** the reactivation is offered on that record.
2. **Given** a deactivated user is listed in the collection, **When** an organization admin opens that user's row menu, **Then** the reactivation is offered there too, under the same rules and with the same confirmation as on the record, without opening the record.
3. **Given** the reactivation is invoked, **When** the confirmation is presented, **Then** it names the user concerned and states plainly that they will be able to sign in again, and must choose a new password before using the application.
4. **Given** the confirmation is presented, **When** the administrator cancels it, **Then** nothing is recorded and the record is unchanged.
5. **Given** the confirmation is accepted, **When** the reactivation succeeds, **Then** the outcome is acknowledged, the user leaves the deactivated view for the active one, both view counts reflect the change, and the open record either follows the user or closes, according to the workbench's established rule for a user leaving the visible view.
6. **Given** a pending, cancelled, or active user's record or row menu is open, **When** the administrator looks for the reactivation, **Then** it isn't offered, consistent with the API's refusal.
7. **Given** the reactivation is being processed, **When** the administrator submits it again, **Then** the interface prevents a duplicate submission for the same user.
8. **Given** a user was just reactivated, **When** the administrator looks at the active view, **Then** they can tell, without opening the user, that the user owes a password renewal.

### Edge Cases

- The target's access status changes between the moment the workbench listed them and the moment the reactivation is confirmed. The outcome carries the reason that is current at submission time, not the state the administrator was looking at, and the workbench shows the refreshed status.
- The target already owed a password renewal when they were deactivated, for example because they were reset and then deactivated before renewing. After the reactivation they owe exactly one renewal, and completing it clears the requirement once, because the requirement is a single state rather than a queue.
- A user is deactivated, reactivated, deactivated again, and reactivated again. Each transition is refused or accepted on the current status alone. The access record presents the most recent deactivation and the most recent reactivation with their own dates and administrators, and the user's identity and history stay continuous throughout.
- A reactivated user is deactivated again before renewing. The renewal requirement stays standing through the second deactivation, and a later reactivation still leaves exactly one requirement.
- The target holds the organization admin role. The reactivation is allowed and restores the role unchanged, and the user's administration powers only become usable once the renewal is complete, because the renewal step confines everything else.
- The target is reactivated by the administrator who deactivated them, or by a different one. Both are allowed, and the reactivation is attributed to whoever performed it.
- The administrator who deactivated the target has themselves been deactivated or removed since. The reactivation is unaffected, and the earlier deactivation keeps its date and presented administrator, handled like every other departed actor in the access history.
- The user's pre-deactivation password is known to someone else. Whoever knows it can sign in after the reactivation and choose the new password before the user does. This is a known residual exposure, accepted with CLR-001 exactly as for a password reset. Closing it means handing over a credential, which was weighed and declined.
- The user has forgotten their pre-deactivation password. The reactivation gives them no route back in, and neither does any other delivered action. This is an accepted consequence of CLR-001: forgotten-password recovery is a separate concern, outside this slice and outside this milestone.
- The user never signs in after the reactivation. They stay active with the requirement standing indefinitely, which only a completed renewal clears; this slice doesn't expire it.
- An operations admin consults the user list after a reactivation. The reactivated user appears among the active users they are allowed to see, but the reactivation event, the earlier deactivation, and the outstanding renewal are withheld from them, like the rest of the access history.
- A reactivation targets a user of another operating organization or an identifier that doesn't exist. Both are refused identically, so neither confirms the existence of a user.
- The user was responsible for a shift or named in another user's lifecycle event before the deactivation. Those references kept pointing at them throughout and keep doing so. The reactivation restores sign-in access only, not any assignment they held before the deactivation.
- The connection is lost or the action fails after submission. The user is either fully reactivated, meaning active with the requirement and the recorded reactivation, or entirely unchanged. The administrator sees a clear retryable failure, and a retry produces neither a second reactivation nor a contradictory record.
- A transient failure must be distinguishable in the workbench from an eligibility refusal and from an authorization refusal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated user whose access is active and whose role is organization admin to reactivate one deactivated user of their operating organization.
- **FR-002**: The system MUST deny a reactivation attempt to unauthenticated visitors, to users whose access isn't active, to any session confined to its own password renewal, and to authenticated active users whose role isn't organization admin, operations admin included. A denial MUST change no user and MUST NOT disclose whether the targeted user exists or is deactivated.
- **FR-003**: A user is eligible for reactivation only when their current access status is Deactivated.
- **FR-004**: The system MUST refuse to reactivate a Pending user with the reason `PENDING_INVITATION`, pointing to activation link renewal as the action that applies instead, and MUST leave that user and their activation link unchanged.
- **FR-005**: The system MUST refuse to reactivate a Cancelled user with the reason `CANCELLED_INVITATION`, pointing to invitation restoration as the action that applies instead, and MUST leave that user unchanged.
- **FR-006**: The system MUST refuse to reactivate an Active user, the acting administrator included, with the reason `ALREADY_ACTIVE`, and MUST record nothing against them.
- **FR-007**: The system MUST refuse a reactivation whose target matches no user of the operating organization with the reason `NOT_FOUND`, without disclosing information about other users.
- **FR-008**: The system MUST reject a reactivation request carrying a malformed user reference before any user is evaluated or changed.
- **FR-009**: A successful reactivation MUST, as one inseparable change, set the user's access status to Active, record the date of the reactivation with the organization admin responsible for it, and record a password renewal requirement against the user.
- **FR-010**: The recorded requirement MUST be the same state that `#117` enforces and clears and that `#17` records. This feature MUST NOT introduce a second, parallel notion of "must change password". A user who already owed a renewal MUST owe exactly one afterwards.
- **FR-011**: A successful reactivation MUST preserve the user's stable identity, first and last name, email, role, and every lifecycle event already recorded, including the deactivation it reverses with its own date and administrator. It MUST keep every existing record that names the user attributed to that same user.
- **FR-012**: The reactivation MUST record the access change and the renewal requirement and nothing else. It MUST NOT change the user's password, and MUST NOT produce a temporary password, a link, or any other credential for the administrator to pass on. The user signs in with the password they held before the deactivation and is taken to the renewal step by the requirement.
- **FR-013**: The system MUST NOT disclose the user's password, password material, activation link, session token, or remembered-connection token through this feature.
- **FR-014**: After a successful reactivation, no session or remembered connection established before the reactivation MUST grant the user any access, the renewal step included, on any browser. The access MUST resume only through a new sign-in that presents the user's password. Every other user's sessions and remembered connections MUST be left untouched.
- **FR-015**: A refused or failed reactivation MUST leave the target user's access status, renewal requirement, password, sessions, remembered connections, and lifecycle metadata exactly as they were before the attempt, with no partial change recorded.
- **FR-016**: Concurrent or repeated reactivations of the same user MUST result in exactly one successful reactivation. Every other attempt MUST resolve as `ALREADY_ACTIVE` rather than a second access status change or a silent overwrite of the first reactivation's date and administrator.
- **FR-017**: The system MUST report the outcome of every reactivation attempt, with distinct, understandable, and actionable feedback for success, each refusal reason (`NOT_FOUND`, `PENDING_INVITATION`, `CANCELLED_INVITATION`, `ALREADY_ACTIVE`), an unauthenticated or unauthorized request, and a retryable failure.
- **FR-018**: Authorization and eligibility decisions MUST be enforced by the system regardless of what the workbench offers, hides, or last displayed. The workbench MUST NOT offer, and MUST NOT appear to perform, a reactivation the system would refuse to the same viewer.
- **FR-019**: The workbench MUST offer the reactivation from the access record of a deactivated user and from that user's row menu in the collection, under the same rules and with the same confirmation on both, and MUST NOT offer it on a user whose access status makes it refusable.
- **FR-020**: Before submitting the reactivation, the workbench MUST require an explicit confirmation that names the user and states the consequence: the user will be able to sign in again, and must choose a new password before using the application. Cancelling it MUST record nothing.
- **FR-021**: The workbench MUST prevent a duplicate submission of the same reactivation while one is in flight.
- **FR-022**: After a successful reactivation, the workbench MUST reflect the new state without a manual reload. The user MUST leave the deactivated view for the active one, and the view counts MUST follow. The open record MUST either follow the user or close, according to the workbench's established rule for a user leaving the visible view. Wherever the user is presented to an organization admin, the outstanding renewal MUST be visible without opening the user.
- **FR-023**: The access record MUST present the reactivation, with its date and responsible administrator, and the outstanding renewal requirement to viewers allowed to consult the access history. It MUST withhold both from viewers who may not, following the rule already established for lifecycle events by `Browse and Filter the User List` (`#4`).
- **FR-024**: This feature MUST NOT change sign-in, sign-out, remembered-connection, or password renewal behaviour, beyond restoring the user's eligibility to sign in and ensuring the pre-reactivation access FR-014 names grants nothing.
- **FR-025**: This feature MUST NOT provide deactivation, the last-active-organization-admin protection, password reset, self-service password change, forgotten-password recovery, invitation, invitation acceptance, cancellation or restoration, activation link renewal, pending user removal, role change, identity update, or reactivation of several users in one action.
- **FR-026**: This feature MUST NOT send any email or other notification to the reactivated user or anyone else.

### Key Entities *(include if feature involves data)*

- **User**: A member of the operating organization with a stable identity, an email, a role, a current access status (Pending, Active, Cancelled, or Deactivated), a password renewal requirement that is either standing or not, and the dated lifecycle events already recorded against them. The reactivation changes only the access status, the reactivation event, and the renewal requirement.
- **User Reactivation**: The administrator-side action of restoring sign-in access to a deactivated user while requiring a new password, as `CONTEXT.md` defines it. It is the reverse of User Deactivation.
- **User Access Status Change**: The dated record of a user moving from Deactivated to Active, attributed to the organization admin who caused it. It sits in the access history alongside the earlier deactivation, which it doesn't erase.
- **Password Renewal Requirement**: The state marking that a user must choose a new password before using the application. It is independent of the access status and of the role, and it is cleared only by a completed password renewal. It is recorded here, as by `#17`, and enforced and cleared by `#117`.
- **Reactivation Blocker**: The reason reported when a reactivation is refused: the target doesn't exist (`NOT_FOUND`), has never activated its access (`PENDING_INVITATION`), had its invitation withdrawn before activation (`CANCELLED_INVITATION`), or is already active (`ALREADY_ACTIVE`).
- **Organization Admin**: The only role that may reactivate a user, and the actor recorded against the reactivation.
- **Remembered Connection**: A connection that can be restored on a browser for at most 30 days without presenting a password. None established before the reactivation restores the user's access after it.
- **Operating Organization**: The scope that owns the users an administrator may reactivate. Users of another organization are outside it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of reactivations of a deactivated user by an organization admin succeed and leave the user active with exactly one outstanding renewal requirement. The new status is visible in the workbench within 2 seconds under normal operating conditions, without a manual reload.
- **SC-002**: In acceptance testing, 100% of reactivated users who sign in with their pre-deactivation password reach the renewal step instead of the application, and 100% of those who complete it reach the application in the same session.
- **SC-003**: In acceptance testing, 100% of sessions and remembered connections that existed before a reactivation grant no access after it, the renewal step included. 0% of any other user's sessions or remembered connections are affected.
- **SC-004**: In acceptance testing, 100% of reactivation attempts targeting a pending, cancelled, active, unknown, or out-of-organization user are refused with the correct one of `PENDING_INVITATION`, `CANCELLED_INVITATION`, `ALREADY_ACTIVE`, or `NOT_FOUND`, with zero users changed.
- **SC-005**: In acceptance testing, 100% of reactivation attempts by unauthenticated visitors, non-active requesters, sessions confined to their own renewal, operations admins, operations leads, and observers are refused with no user changed and nothing disclosed about the target, and the action is never offered to them in the workbench.
- **SC-006**: In 100% of concurrent-submission runs targeting the same deactivated user, exactly one reactivation succeeds, and the recorded date and responsible administrator are those of the successful one.
- **SC-007**: In 100% of acceptance datasets, a reactivated user keeps their identity, email, role, prior lifecycle events, and attribution on every record that already named them.
- **SC-008**: In acceptance testing, no reactivation response, access record, or collection payload discloses password material, activation links, or session and remembered-connection tokens, and no reactivation produces a credential of any kind.
- **SC-009**: In acceptance testing, 100% of refused and failed reactivations leave the target exactly as it was, and each refusal produces distinct and accurate feedback.
- **SC-010**: In acceptance testing, an organization admin completes a reactivation from an open access record or a row menu in no more than 3 interactions.
- **SC-011**: At least 90% of representative organization admins can find and complete the reactivation of a named deactivated user on their first attempt, within 60 seconds, without external help, and can tell from the outcome alone whether it succeeded and why it didn't.

## Assumptions

- `User Reactivation` follows its `CONTEXT.md` definition: it restores sign-in access to a deactivated user while requiring a new password, and it records the password renewal requirement that `#117` enforces.
- **CLR-001 (resolved 2026-09-11)**: the reactivation hands over no credential. The user signs in with the password they held before the deactivation and is confined to the renewal step until they choose a new one. This mirrors the decision recorded for the password reset (`#17`, its own CLR-001). The two accepted consequences are recorded as edge cases: whoever knows the pre-deactivation password can complete the renewal first, and a user who has forgotten it has no route back in until a recovery flow exists.
- Only organization admins may reactivate, following `CONTEXT.md`: they are the role responsible for users and their access, and the only one that can see deactivated users. Operations admins see active users only and hold no write access to them.
- Only a deactivated user may be reactivated. A pending user is served by activation link renewal, a cancelled user by invitation restoration, and an active user needs nothing. Each refusal names the action that applies instead, following the convention `Renew a Pending User Activation Link` (`#9`) established.
- A second, concurrent, or repeated reactivation resolves as `ALREADY_ACTIVE`, mirroring how `#20` resolves a second deactivation. The first reactivation's date and administrator are never overwritten, so the record always names who actually restored the access.
- No `SELF` reason is needed. A deactivated administrator can't sign in, so an administrator targeting themselves is necessarily active and is refused as `ALREADY_ACTIVE`.
- A reactivation can only add an active organization admin, never remove one, so the last-active-organization-admin protection (`#21`) doesn't bear on it.
- The reactivation restores the role the user held when deactivated. Changing it afterwards is a separate `User Role Change`, which `#28` refuses on a deactivated user precisely so it happens after the reactivation.
- Sessions and remembered connections from before the deactivation must grant nothing after the reactivation. Unlike a password reset, which keeps a live session open to preserve work in progress, a deactivated user had no access to work with, so there is nothing to preserve, and a revived session would hand the renewal step to whoever holds that browser. The deactivation already revokes remembered connections; whether leftover sessions need an explicit measure is a `/speckit-plan` question.
- The reactivation records only a date and the responsible administrator, like the deactivation it reverses and the User Access Status Change vocabulary. No comment or reason text is captured.
- The access record keeps the latest occurrence of each lifecycle event, as the access-status foundation decided ("keep the latest useful dates and actors on the user"), so a second cycle replaces the first cycle's dates rather than accumulating a full history.
- The reactivated user's email was never freed by the deactivation, so no uniqueness conflict can arise from restoring it.
- The workbench reuses the existing user administration surface: the collection and its active and deactivated views, the access record opened from a row, the row menu, and the confirmation, feedback, and error conventions of the other user access actions.
- The operating organization manages exactly one site, so the requester's organization determines which users are reactivatable, without an organization or site picker.
- The user learns of the reactivation out of band, consistent with this milestone excluding real email sending.

## Dependencies

- `#20` — Reject Ineligible User Deactivation (delivered): produces the deactivated user this slice restores, the deactivated view it acts from, and the revocation of remembered connections at deactivation.
- `#117` — Force a Password Change After Login (delivered): defines the password renewal requirement, confines every session carrying it, and clears it on a completed renewal. This slice is the second producer it was built for.
- `#17` — Reset an Active User Password (delivered): the first producer of the same requirement. It establishes that the requirement and the event that recorded it are presented separately, and that no credential is handed over.
- `#4` — Browse and Filter the User List (delivered): supplies the collection, its views, the access record, and the rules for consulting users and their access history.
- `#3` — Restrict Login to Active Users (delivered): establishes that only active users can sign in, which is what the reactivation restores.
- No open issue blocks this slice. It is the only slice of the `User Reactivation` roadmap (`#31`).

## Out of Scope

- Deactivating a user, owned by `#20`, and the last-active-organization-admin protection, owned by `#21`.
- The password renewal step itself, its validation rules, its confinement, and the revocation it performs on completion, all owned by `#117`.
- Recording the renewal requirement on an active user, owned by `#17`.
- Handing a credential or link to the reactivated user, declined with CLR-001, and forgotten-password recovery initiated by the user.
- Every other user access write action: invitation, invitation acceptance, cancellation and restoration, activation link renewal, pending user removal, role change, and identity update.
- Reactivating several users in one action.
- Notifying the reactivated user, or anyone else, by email or otherwise.
- A full, multi-cycle access history beyond the latest occurrence of each lifecycle event.

## Source-derived decisions

- This slice is end-to-end: it owns both the reactivation command with its eligibility rules in `apps/api` and its action in the user workbench of `apps/web`. It absorbs the former frontend-only slice "Reactivate a User From the Web Workbench", which described the same outcome from the web side alone.
- The pre-migration user domain backlog entry "P2 - User Reactivation" set the rules this slice keeps: only deactivated users can be reactivated, reactivation moves the user back to active, it requires a new password, it doesn't change the role, and a role change afterwards is a separate action.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/32
- Parent roadmap: specs/user-administration/user-reactivation/roadmap.md (`#31`)
- Absorbed scope: "Reactivate a User From the Web Workbench", a frontend-only slice merged here on 2026-09-10 and deleted from GitHub.
- Reversed action: specs/user-administration/user-deactivation-hardening/reject-ineligible-user-deactivation/spec.md (`#20`, delivered)
- User-side counterpart: specs/authenticated-shell/authenticated-shell/force-a-password-change-after-login/spec.md (`#117`, delivered)
- Sibling producer: specs/user-administration/password-reset/reset-an-active-user-password/spec.md (`#17`, delivered)
- Domain vocabulary: `CONTEXT.md` (User Reactivation, User Deactivation, User Access Status, User Access Status Change, Password Renewal Requirement, Password Renewal, Organization Admin, Remembered Connection, Login)
