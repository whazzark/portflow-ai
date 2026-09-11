# Feature Specification: Cancel a Pending Invitation

**Feature Branch**: `whazzark/cancel-a-pending-invitation`

**Created**: 2026-07-09

**Last Updated**: 2026-09-11

**Status**: Draft

**Input**: User description: "https://github.com/whazzark/portflow-ai/issues/12"

**Feature ID**: `GH-12`

**GitHub Issue**: [#12](https://github.com/whazzark/portflow-ai/issues/12)

**Parent Roadmap**: `specs/user-administration/invitation-administration/roadmap.md`

**Roadmap Entry**: `GH-12`

**Priority**: priority:P1

**Milestone**: 0. Sécuriser l'administration des utilisateurs

**Domain**: user-administration

> Vertical slice: this specification owns both the invitation cancellation command in `apps/api`
> and the cancellation action in the user workbench of `apps/web`. It absorbs the cancellation part
> of the former frontend-only slice "Manage Invitation Lifecycle From the Web Workbench".

## Clarifications

### Session 2026-09-11

- Q: Should cancelling an invitation require the administrator to enter a reason or comment? → A: An optional comment, offered in the confirmation and shown in the access record next to the cancellation
- Q: Where should the workbench land after a successful cancellation? → A: It stays on the pending view. The user leaves it and their record closes, both counts update, and a confirmation names the user, as deactivation does
- Q: How should the cancellation action and its confirmation buttons be labelled, given every confirmation's "Cancel" dismiss button? → A: The action reads "Cancel invitation" wherever it is offered and on the confirm button, and this confirmation's dismiss button reads "Keep invitation"
- Q: What should the cancelled view of the user collection show in its password column, which can only ever be blank there? → A: The cancellation comment, under a `Comment` header, in place of the password column; every other view keeps the password column (decided while testing, 2026-09-11)
- Q: And the pending view, whose password column is just as empty? → A: It shows when and by whom each user was invited, under an `Invited` header, in place of the password column; the active and deactivated views keep the password column (decided while testing, 2026-09-11)

## User Scenarios & Testing *(mandatory)*

An invitation hands a person a confidential activation link, valid for 7 days, that lets them
choose their own password and enter the organization. Until now, once an invitation was issued,
nothing could take it back: an invitation sent to the wrong person, to someone whose arrival fell
through, or through a channel later found to be compromised stayed usable until it expired. The
user workbench already tells an administrator trying to deactivate a pending user to "cancel their
invitation instead", but no such action exists yet. This slice lets an organization admin withdraw
access before it is activated. The user moves to the cancelled access status, their activation link
stops working at once, and the record stays visible so that it can later be restored (GH-13) or
permanently removed (GH-14).

### User Story 1 - Withdraw an Invitation Before It Is Accepted (Priority: P1)

An organization admin who no longer wants a pending user to join cancels that user's invitation.
The activation link they handed out stops working immediately, and the user moves from the pending
view to the cancelled view, carrying the date of the cancellation and the administrator who made
it.

**Why this priority**: This is the whole outcome of the slice. Without it, the only way to stop an
issued activation link is to wait for it to expire, and GH-13 has no cancelled invitation to
restore.

**Independent Test**: Sign in as an organization admin, invite a person, open the pending user's
record, cancel the invitation, and verify that the user has moved to the cancelled view with the
cancellation date and responsible administrator in their access record, that their identity, role,
and invitation event are unchanged, and that the activation link issued at invitation no longer
lets anyone activate that user.

**Acceptance Scenarios**:

1. **Given** a pending user, **When** an organization admin cancels their invitation, **Then** their access status becomes cancelled, the cancellation is recorded with its date and attributed to that administrator, and the workbench confirms the cancellation, naming the user.
2. **Given** a pending user holds an outstanding activation link, **When** their invitation is cancelled, **Then** that link immediately stops permitting the invitation to be accepted, whether or not it had expired, and no activation link remains live for that user.
3. **Given** an invitation was just cancelled, **When** the outcome is presented, **Then** the workbench stays on the pending view, the user is no longer listed in it and their record is closed, the user is listed in the cancelled view, both counts reflect the change, and neither a new sign-in nor a manual reload is required.
4. **Given** an invitation was just cancelled, **When** the organization admin consults the user's access record, **Then** it shows the cancellation with its date, its responsible administrator, and its comment if one was entered, next to the original invitation event, whose date and inviting administrator are unchanged.
5. **Given** an invitation was just cancelled, **When** the user is consulted, **Then** their first name, last name, email, and role are exactly those they held while pending, and they still hold no password.
6. **Given** a user's invitation was cancelled, **When** a sign-in is attempted with that user's email, **Then** it is refused with the same outcome as invalid credentials, without revealing their access status.

---

### User Story 2 - Keep Cancellation Restricted to the Administrators Responsible for User Access (Priority: P1)

Only organization admins may withdraw an invitation. The API enforces this whatever the interface
offers, so that no other role can revoke access or learn anything about users it may not consult.

**Why this priority**: Cancelling changes who may enter the organization. A permissive write is a
security defect, not a usability one.

**Independent Test**: Attempt a cancellation as an organization admin, an operations admin, an
operations lead, an observer, an unauthenticated visitor, and a user whose access is not active.
Verify each outcome at the API seam, then verify that the workbench never offers the action to a
viewer the API would refuse.

**Acceptance Scenarios**:

1. **Given** an operations admin, an operations lead, or an observer is signed in, **When** they attempt to cancel an invitation, **Then** the request is denied, the pending user and their activation link are unchanged, and the refusal reveals neither the existence, nor the identity, nor the access status of the targeted user.
2. **Given** a visitor is not authenticated, or a signed-in user's access status is not active, **When** a cancellation is attempted, **Then** the request is denied and nothing changes.
3. **Given** a viewer may not cancel invitations, **When** they browse the user workbench, **Then** no cancellation entry point is presented, and reaching the cancellation seam directly still changes nothing.
4. **Given** an organization admin is signed in, **When** they consult a user who is not pending, **Then** the workbench does not offer the cancellation action on that user.

---

### User Story 3 - Refuse a Cancellation That Does Not Apply (Priority: P1)

An organization admin can only cancel the invitation of a user who has not activated their access
yet. Every other attempt is refused with a reason that names the user's current access status and
points to the action that applies, so the access status only moves along a meaningful path.

**Why this priority**: The eligibility rule is what distinguishes cancellation from deactivation
and keeps a user who has already used the application from losing their history through the wrong
action. It ships with the successful path because the same action surfaces both.

**Independent Test**: Attempt to cancel the invitation of an active user, a deactivated user, an
already cancelled user, and an identifier that matches no user. Verify that each attempt is refused
with a distinct reason and that the targeted user, if any, is left entirely unchanged.

**Acceptance Scenarios**:

1. **Given** an active user, **When** an organization admin attempts to cancel their invitation, **Then** the attempt is refused with a reason stating that this user has already activated their access and pointing to deactivation, and nothing changes.
2. **Given** a deactivated user, **When** an organization admin attempts to cancel their invitation, **Then** the attempt is refused with a reason stating that this user had activated their access and has since been deactivated, and nothing changes.
3. **Given** a user whose invitation is already cancelled, **When** an organization admin attempts to cancel it again, **Then** the attempt is refused with a reason stating that the invitation was already cancelled, and the recorded cancellation date, administrator, and comment are unchanged.
4. **Given** an identifier that matches no user of the organization, **When** a cancellation is attempted, **Then** it is refused as not found and nothing changes.
5. **Given** any refused cancellation, **When** the targeted user is consulted, **Then** their access status, identity, role, lifecycle events, and outstanding activation link, if any, are exactly as before the attempt.

---

### User Story 4 - Confirm Before Withdrawing Access (Priority: P2)

Before cancelling, the organization admin confirms the action in a confirmation that names the user
and states the consequence, so that they never withdraw the wrong person's access by accident. The
confirmation lets them add an optional comment explaining why, which stays in the user's access
record.

**Why this priority**: A cancellation takes effect at once and invalidates a link the invited person
may be about to use. The confirmation is the last point at which the administrator can check they
are acting on the right user. The slice still delivers its value through the API without it.

**Independent Test**: Start a cancellation from the workbench, verify that the confirmation names
the user, states that their activation link will stop working, and offers an optional comment,
dismiss it, and verify that nothing was recorded. Then confirm it once with a comment and once
without, and verify each cancellation and its comment in the access record.

**Acceptance Scenarios**:

1. **Given** an organization admin starts cancelling a pending user's invitation, **When** the confirmation is presented, **Then** it names the user, states that the activation link they were given will stop working immediately and that they will not be able to activate their access, offers an optional comment field, and presents a "Cancel invitation" button that confirms and a "Keep invitation" button that dismisses.
2. **Given** the confirmation is presented, **When** the organization admin dismisses it with "Keep invitation" or by closing it, **Then** nothing is recorded, whatever was typed in the comment is discarded, and the user remains pending with their activation link intact.
3. **Given** the cancellation action is offered from several places in the workbench, **When** it is started from any of them, **Then** the same confirmation and the same outcome apply.
4. **Given** the organization admin has confirmed, **When** the outcome is not known yet, **Then** the action shows that it is in progress and cannot be submitted a second time.
5. **Given** the organization admin confirms with a comment carrying surrounding spaces, **When** the cancellation succeeds, **Then** the comment is recorded without them; a comment left empty or made of spaces only is recorded as no comment.
6. **Given** the organization admin enters a comment longer than 1,000 characters, **When** they confirm, **Then** the cancellation is refused with a field-level reason, nothing changes, and the comment they entered is kept so they can shorten it.

---

### User Story 5 - Resolve Races and Failures Without Leaving Half-Withdrawn Access (Priority: P2)

A cancellation that races with another change to the same user, or that fails midway, never leaves
a user who is cancelled but still holds a live link, or pending with a link already gone. The
administrator is told what happened and can act on the current state.

**Why this priority**: These paths are what keep a withdrawn access trustworthy, but they only
matter once the successful path works.

**Independent Test**: Submit two cancellations of the same pending user concurrently, cancel a user
whom another administrator cancelled after the workbench listed them, and make a cancellation fail
after submission. Verify that each case ends in exactly one consistent state and that the
administrator is told which one.

**Acceptance Scenarios**:

1. **Given** two cancellations of the same pending user are submitted concurrently, **When** both are processed, **Then** exactly one cancellation is recorded, attributed to the administrator whose request took effect, and the other is refused as already cancelled.
2. **Given** a pending user was cancelled, activated, or removed after the workbench listed them, **When** the administrator confirms the cancellation, **Then** it is refused with a reason naming the user's current state, nothing changes, and the displayed collection can be refreshed to the current state.
3. **Given** a cancellation cannot be completed, **When** the failure is returned, **Then** the user is still pending with their activation link still usable, and the failure is presented as retryable rather than as a refusal.
4. **Given** a retryable failure was shown, **When** the administrator retries once the problem is resolved, **Then** exactly one cancellation is recorded.

### Edge Cases

- An organization admin cannot cancel their own invitation. Their own access is active, so the attempt follows the active-user refusal of User Story 3, and no separate self-cancellation rule is needed.
- Cancelling a pending user whose activation link has already expired MUST succeed like any other cancellation, since expiry leaves the user pending (GH-7).
- A pending user whose activation link was never seen or copied by the inviting administrator MUST be cancellable like any other.
- A pending user carrying another administrator's invitation MUST be cancellable by any organization admin, not only by the one who invited them.
- A cancellation MUST end the usefulness of every activation link issued for that user before it, including one issued by a renewal running concurrently. No link issued before the cancellation may survive it.
- A cancellation that races with the invitation's acceptance MUST resolve to exactly one outcome: either the user becomes active and the cancellation is refused as not applicable, or the user becomes cancelled and the acceptance is refused. The user MUST never end up both active and cancelled, or active through a link that was cancelled.
- Inviting the email of a cancelled user remains refused and routed to restoration, as GH-7 already decides. Cancelling therefore does not free the email for a new invitation.
- A cancelled user MUST remain invisible to operations admins, like every non-active user, and MUST remain visible to organization admins in the cancelled view.
- A cancellation recorded by another administrator while the user collection is open MUST place the user in the cancelled view, with updated counts, on the next successful refresh.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let an organization admin cancel the invitation of a pending user of their operating organization.
- **FR-002**: A successful cancellation MUST move the user from the pending access status to the cancelled access status, and MUST change nothing else about the user: identity, email, role, and the original invitation event and its inviting administrator are preserved.
- **FR-003**: A successful cancellation MUST record the cancellation as a dated access status change attributed to the cancelling organization admin, carrying the administrator's comment when one was entered, and MUST record no other lifecycle event.
- **FR-003a**: The cancellation comment MUST be optional and at most 1,000 characters long. Surrounding spaces MUST be removed, and a comment that is empty or made of spaces only MUST be recorded as no comment. A longer comment MUST be refused with a field-level reason, and the refusal MUST change nothing.
- **FR-004**: A successful cancellation MUST immediately end the usefulness of every activation link issued for that user, so that none of them permits the invitation to be accepted afterwards, whether or not it had expired.
- **FR-005**: The status change and the end of the activation link MUST take effect together. No outcome, failures included, may leave a cancelled user with a usable activation link, or a pending user without one because of a cancellation that did not complete.
- **FR-006**: Only a pending user MUST be eligible for cancellation. The system MUST refuse the cancellation of an active, deactivated, or already cancelled user, and of an identifier matching no user of the organization, and MUST leave any targeted user entirely unchanged.
- **FR-007**: Each refusal MUST be distinguishable and MUST name the reason: already activated (pointing to deactivation), deactivated, already cancelled, or not found.
- **FR-008**: The system MUST restrict cancellation to signed-in organization admins whose own access status is active, and MUST deny it to operations admins, operations leads, observers, unauthenticated visitors, and non-active users.
- **FR-009**: A denial for lack of permission MUST NOT reveal whether the targeted user exists, nor their identity or access status.
- **FR-010**: The API MUST be the authoritative authorization and eligibility boundary. The workbench MUST offer the cancellation action only to an organization admin viewing a pending user, and not offering it MUST NOT be what prevents the cancellation.
- **FR-011**: The workbench MUST require an explicit confirmation that names the user concerned, states that their activation link stops working immediately and that they will not be able to activate their access, and offers an optional comment. Dismissing the confirmation MUST record nothing.
- **FR-011a**: The action MUST be labelled "Cancel invitation" wherever the workbench offers it and on the confirmation's confirm button, and the confirmation's dismiss button MUST read "Keep invitation", so that no two buttons of the confirmation start with "Cancel".
- **FR-012**: The cancellation action MUST behave identically wherever the workbench offers it: the same confirmation, the same refusals, and the same outcome.
- **FR-013**: After a successful cancellation, the workbench MUST stay on the view it was showing, close the cancelled user's record, list the user in the cancelled view and no longer in the pending view with both counts updated, and confirm the cancellation with a message naming the user, without requiring a new sign-in or a manual reload. It MUST NOT switch to the cancelled view on its own.
- **FR-014**: The cancelled user's access record MUST show the cancellation date, the responsible administrator, and the cancellation comment when one was recorded, alongside the preserved invitation event. The comment MUST follow the same visibility as the rest of the access record: organization admins only.
- **FR-014a**: In the cancelled view of the user collection, a `Comment` column MUST replace the password column and show each user's cancellation comment on one line, with the full text available on hover, and blank when none was recorded. The active and deactivated views MUST keep the password column unchanged.
- **FR-014b**: In the pending view of the user collection, an `Invited` column MUST replace the password column and show each user's invitation date with the inviting administrator beneath it ("by First Last"), the date alone when no administrator was recorded, and nothing when no invitation date exists. It MUST NOT derive a link expiry from that date: a renewed link (GH-9) outlives the invitation it belongs to.
- **FR-015**: Concurrent or repeated cancellations of the same user MUST result in exactly one recorded cancellation. The others are refused as already cancelled, and the recorded date, administrator, and comment are those of the cancellation that took effect.
- **FR-016**: The workbench MUST distinguish a refusal from a retryable failure, keep the reason of a refusal readable, and let the administrator refresh the collection to the user's current state.
- **FR-017**: A cancelled user MUST NOT be able to sign in, and the refusal MUST be indistinguishable from invalid credentials.
- **FR-018**: A cancelled user MUST remain visible to organization admins and invisible to operations admins, following the existing consultation rules.
- **FR-019**: This feature MUST NOT provide invitation restoration, pending user removal, activation link renewal, invitation acceptance, deactivation, reactivation, role change, identity update, password reset, or bulk cancellation.

### Key Entities

- **Pending User**: A user whose access has been invited but not activated yet. The only kind of user whose invitation this feature cancels.
- **Cancelled User**: A user whose invitation was withdrawn before activation, in the cancelled access status. Keeps their identity, email, role, and invitation event, holds no password and no usable activation link, cannot sign in, and represents a person who never used the application.
- **User Activation Link**: The confidential, time-bounded link that lets a pending user accept their invitation. This feature ends its usefulness and issues none.
- **User Access Status Change**: A dated change of a user's access status, attributed to the administrator who caused it. This feature records exactly one per successful cancellation: the cancellation event, which may carry the administrator's comment of at most 1,000 characters.
- **Organization Admin**: The only actor allowed to cancel an invitation, and the one the cancellation event is attributed to.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all authorization tests, organization admins cancel successfully, and operations admins, operations leads, observers, unauthenticated visitors, and non-active users change nothing and learn nothing about the targeted user.
- **SC-002**: 100% of successful cancellations produce exactly one cancelled user, exactly one dated and attributed cancellation event, and zero usable activation links for that user.
- **SC-003**: For each of the non-pending cases (active, deactivated, already cancelled, unknown), 100% of cancellation attempts are refused with their distinct reason, and the targeted user is unchanged.
- **SC-004**: In all concurrency, repeated-submission, and failure tests, each user ends in exactly one consistent state. No test observes a cancelled user holding a usable activation link, or two cancellation events for one withdrawal.
- **SC-005**: An organization admin withdraws a pending user's access in under 30 seconds from the user collection, confirmation included, without leaving user administration.
- **SC-006**: The time during which an issued activation link can be misused after the administrator decides to withdraw it drops from up to 7 days to zero: in all tests, a link used after its cancellation is confirmed never activates access.
- **SC-007**: 95% of cancellations return their outcome within 2 seconds under normal operating conditions.

## Dependencies

- GH-7 — Invite a Pending User with a Confidential Activation Link (delivered): creates the pending user and the activation link this feature withdraws. It is the only blocker recorded on the source issue.
- GH-2 — Persist User Access Status and Lifecycle Metadata: supplies the cancelled access status and the slot for the dated, attributed cancellation event.
- GH-3 — Restrict Login to Active Users: guarantees a cancelled user cannot sign in.
- GH-4 — Browse and Filter the User List: supplies the pending and cancelled views, their counts, and the access record showing the cancellation event.
- GH-20 — Reject Ineligible User Deactivation: already points an administrator trying to deactivate a pending user to invitation cancellation. This feature makes that pointer actionable.
- Deliverable in parallel with GH-14: neither blocks the other.
- Unblocks GH-13, which restores the cancelled invitations this feature produces.

## Out of Scope

- Restoring a cancelled invitation with a new activation link (GH-13).
- Permanently removing a pending or cancelled user (GH-14), which is also the way to free their email for a new invitation.
- Renewing a pending user's activation link (GH-9) and accepting an invitation (GH-8), including the public response shown to whoever presents a cancelled link.
- Notifying the invited person that their invitation was cancelled. No message is sent to them, since email delivery is the standalone "Send invitation emails" slice.
- A required reason, a fixed list of cancellation reasons, or comments on any other user access action.
- Cancelling several invitations at once.
- Cancelling pending invitations automatically, for example on expiry. An expired link leaves its user pending and renewable.
- Withdrawing access from a user who has already activated it, which is deactivation.

## Assumptions

- "Administrator responsible for user access" follows `CONTEXT.md`: only organization admins hold write access to the organization's users, so they are the only cancelling actor.
- The optional cancellation comment follows the existing optional lifecycle comment of site references (surrounding spaces removed, at most 1,000 characters). It is the first user access action to carry a comment; the others (invitation, deactivation, password reset, role change) keep a date and an actor only.
- Cancellation keeps only the latest cancellation date, actor, and comment on the user, following the existing access record model ("keep the latest useful dates and actors on the user", pre-migration backlog). A cancellation after a later restoration (GH-13) therefore replaces the earlier one, comment included. A full access history is not introduced here.
- Because invitation acceptance (GH-8) is not delivered yet, this slice proves FR-004 by showing that no activation link remains live for a cancelled user. GH-8 then owns presenting a cancelled link with the same public invalid-or-expired response as an unknown one, as the pre-migration acceptance rules require.
- The race between cancellation and acceptance or renewal is specified here as an invariant. It becomes testable end to end once GH-8 and GH-9 exist, and each of those slices remains responsible for respecting it from its own side.
- A cancelled user represents a person who never used the application, so no business record references them, and nothing beyond the user's own access record needs to change.
- The workbench reuses the user administration patterns already established: the status views with counts, the access record and its history, the confirmation used by deactivation and password reset, and the refusal and retryable failure states of the existing write surfaces.
- The operating organization manages exactly one site, so the cancelling admin's organization determines which users they may cancel, without an organization or site picker.

## Source-derived decisions

- The pre-migration user domain backlog entry "P1 - User Invitation Cancellation" is the source of the behavioral rules: only pending users can have their invitation cancelled, cancellation moves the user to cancelled, cancellation immediately invalidates the activation link, cancelled users remain visible to organization admins, and cancelled users do not appear to operations admins.
- The same backlog records that pending and cancelled users do not represent people who have used the application, and that expired, renewed, cancelled, already used, and unknown activation links produce the same public response. The latter is carried to GH-8.
- The source issue's migration comment reports the entry as already delivered. That delivery belongs to the pre-migration codebase: the current one holds the cancelled status and its lifecycle slot but provides no cancellation, so the behavior is specified here in full.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/12
- Parent roadmap: specs/user-administration/invitation-administration/roadmap.md
- Absorbed scope: the cancellation part of "Manage Invitation Lifecycle From the Web Workbench", a frontend-only slice split between GH-9, GH-12, GH-13 and GH-14 on 2026-09-10 and deleted from GitHub.
- Blockers: recorded as GitHub issue dependencies on the source issue.
- Domain vocabulary: CONTEXT.md (User Invitation Cancellation, Pending User, User Access Status, User Access Status Change, User Activation Link, User Invitation Restoration, Pending User Removal, Organization Admin)
- Related slices: GH-7 (invitation), GH-8 (acceptance), GH-9 (link renewal), GH-13 (restoration), GH-14 (permanent removal), GH-20 (ineligible deactivation refusal).
