# Feature Specification: Restore a Cancelled Invitation with a New Activation Link

**Feature Branch**: `whazzark/restore-a-cancelled-invitation-with-a-new-activa`

**Created**: 2026-07-09

**Last Updated**: 2026-09-11

**Status**: Draft

**Input**: User description: "https://github.com/whazzark/portflow-ai/issues/13"

**Feature ID**: `GH-13`

**GitHub Issue**: [#13](https://github.com/whazzark/portflow-ai/issues/13)

**Parent Roadmap**: `specs/user-administration/invitation-administration/roadmap.md`

**Roadmap Entry**: `GH-13`

**Priority**: priority:P1

**Milestone**: 0. Sécuriser l'administration des utilisateurs

**Domain**: user-administration

> Vertical slice: this specification owns both the invitation restoration command in `apps/api`
> and the restoration action in the user workbench of `apps/web`. It absorbs the restoration part
> of the former frontend-only slice "Manage Invitation Lifecycle From the Web Workbench".

## Clarifications

### Session 2026-09-11

- Q: Should restoring an invitation let the administrator enter a comment, as cancelling one does? → A: An optional comment, under the same rules as the cancellation comment, offered in the confirmation and shown in the access record next to the restoration
- Q: Once a user is restored and pending again, what happens to the earlier cancellation (date, admin, comment) in their access record? → A: It is kept as history, presented in date order with the invitation and the restoration, and replaced only by a later cancellation
- Q: What does the pending view's `Invited` column show for a restored user? → A: The original invitation's date and inviting administrator, as for every pending user; the restoration appears in the access record only

## User Scenarios & Testing *(mandatory)*

Cancelling an invitation (GH-12) withdraws access before the invited person has activated it. It
keeps the user, their identity, role, and invitation, and kills their activation link at once. Until
now a cancellation could not be undone. Inviting the same email again is refused and routed to
restoration (GH-7), renewing a cancelled user's link is refused and routed to restoration (GH-9), and
the workbench says "Restore it instead" in both places, but no such action exists yet. The only way
back is to remove the user permanently (GH-14) and invite them again, which throws away the
invitation and the cancellation history. This slice lets an organization admin make a cancelled
invitation pending again.

The restoration never brings back an earlier activation link. The invitation may have been cancelled
because its link reached the wrong hands, and a link is usable again as soon as its user is pending
again (GH-8). So the restoration issues a new link, valid for 7 days from the restoration and shown
once to the restoring administrator, as an invitation or a renewal does.

### User Story 1 - Bring a Cancelled Invitee Back with a New Link (Priority: P1)

An organization admin learns that a cancelled invitation should go ahead after all: it was cancelled
by mistake, or the person's arrival is back on. The admin restores the invitation from the cancelled
user, receives a new confidential activation link shown once, and passes it on. The user is pending
again, carrying the date of the restoration and the administrator who made it, and the invited person
can activate their access with the new link, and only with it.

**Why this priority**: This is the whole outcome of the slice. Without it, a cancellation can only
be undone by removing the user and inviting them again, which loses their history.

**Independent Test**: Sign in as an organization admin, invite a person and keep the link, cancel the
invitation, then restore it. Verify that the user is back in the pending view with the restoration
date and administrator in their access record, that a new link is presented once with a validity of
7 days from the restoration, that the link kept from the invitation no longer permits acceptance,
and that the new link lets the invited person activate their access.

**Acceptance Scenarios**:

1. **Given** a cancelled user, **When** an organization admin restores their invitation, **Then** their access status becomes pending, the restoration is recorded with its date and attributed to that administrator, and exactly one new activation link is issued for them, valid for 7 days from the restoration.
2. **Given** a restoration succeeds, **When** the outcome is presented, **Then** a dedicated outcome shows the new activation link in clear text, offers a copy action, states that it will not be shown again, and stays open until the administrator acknowledges it explicitly.
3. **Given** a restored user holds their new link, **When** the invited person uses it within its validity, **Then** they accept the invitation and activate their access exactly as with a link issued at invitation.
4. **Given** an activation link was issued for the user before their invitation was cancelled, **When** it is presented after the restoration, **Then** it does not permit acceptance, receives the same unusable-link outcome as an unknown link, and leaves the user pending.
5. **Given** a restoration succeeds, **When** the user is consulted, **Then** their first name, last name, email, and role are exactly those they held while cancelled, they still hold no password, and they cannot sign in until they accept the invitation.
6. **Given** a restoration succeeds, **When** the organization admin consults the user's access record, **Then** it shows the restoration with its date, its responsible administrator, and its comment if one was entered, next to the original invitation event and the earlier cancellation event, both with their dates, administrators, and, for the cancellation, its comment, all unchanged. It states that the activation link is valid until its new expiry.
7. **Given** the new link has been shown once, **When** the administrator acknowledges the outcome and then reopens it, the user's record, or the user collection, **Then** the link is not available anywhere, and a renewal is the only way to obtain another one.

---

### User Story 2 - Keep Restoration Restricted to the Administrators Responsible for User Access (Priority: P1)

Only organization admins may restore an invitation. The API enforces this whatever the interface
offers, so that no other role can obtain a way into the application, reopen access the organization
chose to withdraw, or learn anything about users it may not consult.

**Why this priority**: A restoration hands out a new way into the application. A permissive
restoration is an access-granting defect, not a usability one.

**Independent Test**: Attempt a restoration as an organization admin, an operations admin, an
operations lead, an observer, an unauthenticated visitor, a user whose access is not active, and a
session confined to its own password renewal. Verify each outcome at the API seam, then verify that
the workbench never offers the action to a viewer the API would refuse.

**Acceptance Scenarios**:

1. **Given** an organization admin is signed in, **When** they restore a cancelled user's invitation, **Then** the restoration is allowed.
2. **Given** an operations admin, an operations lead, or an observer is signed in, **When** they attempt a restoration, **Then** it is denied, no link is issued, the user stays cancelled, and the refusal reveals neither the existence, nor the identity, nor the access status of the targeted user.
3. **Given** a visitor is not authenticated, the requester's own access status is not active, or the requester's session is confined to its own password renewal, **When** a restoration is attempted, **Then** it is denied and nothing changes.
4. **Given** a viewer may not restore invitations, **When** they browse the user workbench, **Then** no restoration entry point is presented, and reaching the restoration seam directly still changes nothing.
5. **Given** an organization admin is signed in, **When** they consult a user who is not cancelled, **Then** the workbench does not offer the restoration action on that user.

---

### User Story 3 - Refuse a Restoration That Does Not Apply (Priority: P1)

An organization admin can only restore an invitation that was cancelled. Every other attempt is
refused with a reason that names the user's current access status and points to the action that
applies, so the access status only moves along a meaningful path and no restoration hands out a
link to a user who should not get one.

**Why this priority**: The eligibility rule is what keeps restoration from becoming a back door that
issues links to active or deactivated users, or a second renewal that bypasses its rules. It ships
with the successful path because the same action surfaces both.

**Independent Test**: Attempt to restore the invitation of a pending user, an active user, a
deactivated user, and an identifier that matches no user of the organization. Verify that each
attempt is refused with a distinct reason, that no link is issued, and that the targeted user, if
any, is left entirely unchanged, including a pending user's current link.

**Acceptance Scenarios**:

1. **Given** a pending user, **When** an organization admin attempts to restore their invitation, **Then** the attempt is refused with a reason stating that the invitation is already pending and pointing to activation link renewal, and the user's current link keeps working exactly as before.
2. **Given** an active user, **When** an organization admin attempts to restore their invitation, **Then** the attempt is refused with a reason stating that this user has already activated their access, and nothing changes.
3. **Given** a deactivated user, **When** an organization admin attempts to restore their invitation, **Then** the attempt is refused with a reason stating that this user's access was deactivated and pointing to reactivation, and nothing changes.
4. **Given** an identifier that matches no user of the organization, **When** a restoration is attempted, **Then** it is refused as not found, identically whether or not such a user exists elsewhere, and nothing changes.
5. **Given** any refused restoration, **When** the targeted user is consulted, **Then** their access status, identity, role, lifecycle events, and current activation link, if any, are exactly as before the attempt, and no new link exists.

---

### User Story 4 - Restore From the User Workbench (Priority: P2)

An organization admin restores the invitation from the cancelled user they are already looking at,
either on the user's record or from the row menu of the cancelled view. The admin confirms it
deliberately, optionally explaining why the cancellation is reversed, captures the new link from the
outcome, and sees the user move to the pending view
without reloading. The workbench's existing "Restore it instead" pointers now lead to this action.

**Why this priority**: The API seam makes the restoration possible; the workbench makes it usable by
the administrator responsible for access. It is P2 because the outcome is complete and testable at
the API first.

**Independent Test**: Open a cancelled user's record, start the restoration, verify the confirmation
names the user, states that a new link will be issued and shown once, and offers an optional comment,
dismiss it, and verify that nothing changed. Then restore from the row menu of the cancelled view
with a comment, capture the link from the outcome, acknowledge it, and verify that the workbench is still on the cancelled view, the user is
listed in the pending view with both counts updated, and their access record shows the restoration
and its comment, all without a manual reload.

**Acceptance Scenarios**:

1. **Given** a cancelled user's access record is open, **When** an organization admin looks for access actions, **Then** the restoration is offered on that record, labelled "Restore".
2. **Given** a cancelled user is listed in the cancelled view, **When** an organization admin opens that user's row menu, **Then** the restoration is offered there too, under the same label, rules, confirmation, and outcome as on the record.
3. **Given** the restoration is started, **When** the confirmation is presented, **Then** it names the user, states that their invitation will be pending again and that a new activation link, valid for 7 days, will be shown once, states that any link they were given before stays unusable, offers an optional comment field, and presents a "Restore" button that confirms and a "Cancel" button that dismisses.
4. **Given** the confirmation is presented, **When** the organization admin dismisses it, **Then** nothing is recorded, whatever was typed in the comment is discarded, no link is issued, and the user stays cancelled.
5. **Given** the organization admin has confirmed, **When** the outcome is not known yet, **Then** the action shows that it is in progress and cannot be submitted a second time.
6. **Given** the organization admin confirms with a comment carrying surrounding spaces, **When** the restoration succeeds, **Then** the comment is recorded without them; a comment left empty or made of spaces only is recorded as no comment.
7. **Given** the organization admin enters a comment longer than 1,000 characters, **When** they confirm, **Then** the restoration is refused with a field-level reason, no link is issued, nothing changes, and the comment they entered is kept so they can shorten it.
8. **Given** the restoration succeeded, **When** the once-only outcome is presented, **Then** it stays open until acknowledged, even though the restored user no longer belongs to the view it was started from.
9. **Given** the outcome has been acknowledged, **When** the workbench is shown, **Then** it stays on the cancelled view, the user is no longer listed there and their record is closed, the user is listed in the pending view with a link that is not marked as expired, both counts reflect the change, and neither a new sign-in nor a manual reload is required.
10. **Given** the workbench tells an administrator to restore an invitation, after an invitation refused because the email belongs to a cancelled user or a renewal refused because the user is cancelled, **When** they look for that action on the cancelled user concerned, **Then** it is offered there.

---

### User Story 5 - Resolve Races and Failures Without Leaving a Half-Restored Invitation (Priority: P2)

A restoration that races with another change to the same user, or that fails midway, never leaves a
user who is pending but holds no link because of the restoration, cancelled but holding a live link,
or pending with two links that both work. The administrator is told what happened and can act on the
current state.

**Why this priority**: These paths keep a restored access trustworthy, but they only matter once the
successful path works.

**Independent Test**: Submit two restorations of the same cancelled user concurrently, restore a user
whom another administrator restored or removed after the workbench listed them, and make a
restoration fail after submission. Verify that each case ends in exactly one consistent state, that
at most one link permits acceptance, and that the administrator is told which state it is.

**Acceptance Scenarios**:

1. **Given** two restorations of the same cancelled user are submitted concurrently, **When** both are processed, **Then** exactly one restoration is recorded, attributed to the administrator whose request took effect, exactly one link is issued and permits acceptance, and the other request is refused as already pending and issues no link.
2. **Given** a cancelled user was restored or removed after the workbench listed them, **When** the administrator confirms the restoration, **Then** it is refused with a reason naming the user's current state, no link is issued, nothing changes, and the displayed collection can be refreshed to the current state.
3. **Given** a restoration cannot be completed, **When** the failure is returned, **Then** the user is still cancelled, no link exists for them, nothing is recorded, and the failure is presented as retryable rather than as a refusal.
4. **Given** a retryable failure was shown, **When** the administrator retries once the problem is resolved, **Then** exactly one restoration is recorded and exactly one link permits acceptance.
5. **Given** a restoration and a permanent removal of the same cancelled user are processed at almost the same moment, **When** both complete, **Then** the outcome is one of the two orders: either the restoration takes effect first and the removal then removes a pending user, their new link with them, as GH-14 allows; or the removal takes effect first and the restoration is refused as not found and issues no link. No link survives a removed user.

### Edge Cases

- An organization admin cannot restore an invitation of their own. Their own access is active, so the attempt follows the active-user refusal of User Story 3, and no separate self-restoration rule is needed.
- A cancelled user carrying another administrator's invitation or cancellation MUST be restorable by any organization admin, not only by the one who invited or cancelled them.
- A cancelled user who never held an activation link, such as one seeded before invitations existed, MUST be restorable like any other; the restoration issues their only link.
- A cancelled user whose link had been renewed before the cancellation gets a new link at restoration. Neither the renewed link nor the original one permits acceptance afterwards.
- A cancelled user whose email or name was corrected while cancelled (GH-24) is restored under the corrected identity. The new link is handed out for that identity, and once the user is pending again their email follows the pending-user rules GH-24 already sets.
- A cancelled user whose role was changed while cancelled (GH-28) is restored with that role.
- A user can be cancelled and restored several times. Each restoration issues a new link, and each cancellation ends it at once. Only the most recent restoration and the most recent cancellation, each with its comment, are kept on the user, as GH-12 already decides for the cancellation.
- A restoration whose outcome never reaches its author, for example because the window closed or the connection dropped, leaves a pending user with a live link that nobody holds. The recovery is a renewal (GH-9), which the workbench offers on that pending user.
- A restored user's pending view entry shows their original invitation date and inviting administrator, as for every pending user. The restoration appears in the access record, and the link validity tells whether the person can still activate their access.
- A restored user stays invisible to operations admins, like every non-active user, and appears to organization admins in the pending view.
- A restoration recorded by another administrator while the user collection is open MUST place the user in the pending view, with updated counts, on the next successful refresh.
- A restored organization admin is allowed: a pending user holds no access, so no last-administrator invariant is at stake.
- The administrator who restored an invitation is later deactivated or removed: the recorded restoration keeps its date and remains presented, with the responsible administrator handled like every other departed actor in the access history.
- No activation link, new or earlier, is exposed by a restoration refusal, the access record, the collection, application logs, or any consultation seam, and none is sent anywhere by this feature.
- A transient failure during the restoration is distinguishable, in the workbench, from a refusal on the target's access status and from an authorization refusal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let an organization admin restore the invitation of a cancelled user of their operating organization.
- **FR-002**: A successful restoration MUST move the user from the cancelled access status to the pending access status, and MUST change nothing else about the user: identity, email, role, absence of password, the original invitation event and its inviting administrator, the earlier cancellation event with its date, administrator, and comment, and every other lifecycle event are preserved.
- **FR-003**: A successful restoration MUST record the restoration as a dated access status change attributed to the restoring organization admin, carrying the administrator's comment when one was entered, and MUST record no other lifecycle event: no new invitation event and no activation link renewal. Only the most recent restoration MUST be kept, and a later restoration MUST replace it, comment included.
- **FR-003a**: The restoration comment MUST be optional and at most 1,000 characters long. Surrounding spaces MUST be removed, and a comment that is empty or made of spaces only MUST be recorded as no comment. A longer comment MUST be refused with a field-level reason, and the refusal MUST issue no link and change nothing.
- **FR-004**: A successful restoration MUST issue exactly one new activation link for the user. The link MUST be unguessable, MUST identify exactly one pending user, and MUST NOT be derivable from any earlier link or from anything the user collection exposes.
- **FR-005**: The new activation link MUST expire 7 days after the restoration, independently of the invitation date and of any earlier link's expiry.
- **FR-006**: No activation link issued for the user before the restoration MUST permit acceptance after it. At any time, at most one activation link per pending user MUST permit acceptance, and for a restored user it MUST be the link the restoration issued or one issued after it.
- **FR-007**: The status change and the issuance of the new link MUST take effect together. No outcome, failures included, may leave a pending user without a link because of a restoration that did not complete, or a cancelled user holding a usable link.
- **FR-008**: The new activation link MUST be presented to the restoring administrator exactly once, in a dedicated outcome that shows it in clear text, offers a copy action, and states that it cannot be shown again. The outcome MUST require an explicit acknowledgement before it is dismissed, and MUST NOT close on its own, on a focus change, on a navigation inside user administration, or because the restored user left the view it was started from.
- **FR-009**: The system MUST NOT allow the new activation link to be retrieved again after its outcome, through any consultation, export, or log seam; obtaining another one MUST require a renewal.
- **FR-010**: Only a cancelled user MUST be eligible for restoration. The system MUST refuse the restoration of a pending, active, or deactivated user, and of an identifier matching no user of the organization, MUST issue no link, and MUST leave any targeted user entirely unchanged, including a pending user's current link.
- **FR-011**: Each refusal MUST be distinguishable and MUST name the reason: already pending (pointing to activation link renewal), already activated, deactivated (pointing to reactivation), or not found. A user of another operating organization and a nonexistent identifier MUST be refused identically.
- **FR-012**: The system MUST restrict restoration to signed-in organization admins whose own access status is active, and MUST deny it to operations admins, operations leads, observers, unauthenticated visitors, non-active users, and sessions confined to their own password renewal.
- **FR-013**: A denial for lack of permission MUST NOT reveal whether the targeted user exists, nor their identity or access status.
- **FR-014**: The API MUST be the authoritative authorization and eligibility boundary. The workbench MUST offer the restoration action only to an organization admin viewing a cancelled user, and not offering it MUST NOT be what prevents the restoration.
- **FR-015**: The workbench MUST offer the restoration from a cancelled user's access record and from that user's row menu in the collection, labelled "Restore" in both places, with the same confirmation, the same refusals, and the same outcome.
- **FR-016**: The workbench MUST require an explicit confirmation that names the user concerned, offers an optional comment, and states that their invitation will be pending again, that a new activation link valid for 7 days will be shown once, and that any link they were given before stays unusable. Its confirm button MUST read "Restore" and its dismiss button "Cancel". Dismissing it MUST issue nothing, record nothing, and discard the typed comment; a refusal MUST keep the typed comment.
- **FR-017**: The workbench MUST prevent a duplicate submission of the same restoration while one is in progress.
- **FR-018**: Once the outcome is acknowledged, the workbench MUST stay on the view it was showing, close the restored user's record, list the user in the pending view and no longer in the cancelled view with both counts updated, and reflect the restoration and the new link's validity in the access record and the pending view, without requiring a new sign-in or a manual reload. It MUST NOT switch to the pending view on its own.
- **FR-019**: The restored user's access record MUST show the restoration date, the responsible administrator, and the restoration comment when one was recorded, alongside the preserved invitation and cancellation events, all presented in date order, and MUST state the validity of the new link. The restoration MUST NOT clear or alter the cancellation event it follows. The comment MUST follow the same visibility as the rest of the access record: organization admins only. No collection view gains a column for it, and in the pending view a restored user's `Invited` column MUST show the original invitation's date and inviting administrator, not the restoration.
- **FR-020**: Concurrent or repeated restorations of the same user MUST result in exactly one recorded restoration and exactly one issued link. The others MUST be refused as already pending and MUST issue no link.
- **FR-021**: A restoration processed concurrently with another change to the same user, including a permanent removal, MUST resolve to one consistent outcome, and MUST NEVER report a restoration as successful for a user who is no longer cancelled or no longer exists.
- **FR-022**: The workbench MUST distinguish a refusal from a retryable failure, keep the reason of a refusal readable, and let the administrator refresh the collection to the user's current state.
- **FR-023**: A restored user MUST NOT be able to sign in until they accept their invitation, and the refusal MUST be indistinguishable from invalid credentials.
- **FR-024**: A restored user MUST remain visible to organization admins and invisible to operations admins, following the existing consultation rules for pending users.
- **FR-025**: This feature MUST NOT deliver the activation link to the invited person, by email or otherwise; handing it out remains the restoring administrator's responsibility in this delivery.
- **FR-026**: This feature MUST NOT provide a required restoration reason, identity or role changes as part of the restoration, invitation, invitation acceptance, invitation cancellation, activation link renewal, pending user removal, deactivation, reactivation, password reset, role change, identity update, or bulk restoration, and MUST NOT change the outcome of any of them.

### Key Entities *(include if feature involves data)*

- **Cancelled User**: A user whose invitation was withdrawn before activation. Keeps their identity, email, role, and invitation event, holds no password and no usable activation link, and cannot sign in. The only kind of user whose invitation this feature restores.
- **Pending User**: A user whose access has been invited but not activated yet. What a restoration turns a cancelled user back into, with a new activation link.
- **User Invitation Restoration**: The action of making a cancelled user invitation pending again. It issues a new activation link valid for 7 days, never revives an earlier one, and is recorded as an access status change with its date, the organization admin who performed it, and an optional comment of at most 1,000 characters. It is neither a new invitation nor a renewal.
- **User Activation Link**: The confidential, unguessable, time-bounded link that lets a pending user accept their invitation. This feature issues a new one for each restoration, presented once and never consultable afterwards, and guarantees that none issued before the restoration permits acceptance.
- **User Access Status Change**: A dated change of a user's access status, attributed to the administrator who caused it. This feature records exactly one per successful restoration and leaves the earlier cancellation event in place.
- **Organization Admin**: The only actor allowed to restore an invitation, and the one the restoration event is attributed to.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all authorization tests, organization admins restore successfully, and operations admins, operations leads, observers, unauthenticated visitors, non-active requesters, and confined sessions change nothing, obtain no link, and learn nothing about the targeted user.
- **SC-002**: 100% of successful restorations produce exactly one pending user, exactly one dated and attributed restoration event, and exactly one link permitting acceptance, valid for 7 days from the restoration.
- **SC-003**: In all link tests, 100% of links issued before a cancellation fail to permit acceptance after the restoration, and 100% of links issued by a restoration let the invited person activate their access within their validity.
- **SC-004**: For each ineligible case (pending, active, deactivated, unknown, other organization), 100% of restoration attempts are refused with their distinct reason, issue no link, and leave the targeted user unchanged.
- **SC-005**: In all concurrency, repeated-submission, and failure tests, each user ends in exactly one consistent state. No test observes a pending user holding two usable links, a pending user left without one by a failed restoration, a cancelled user holding a usable link, or two restoration events for one restoration.
- **SC-006**: In all activation link tests, the restored link is presented exactly once and cannot be obtained afterwards from any consultation, listing, record, or log seam.
- **SC-007**: 100% of restorations leave the user's identity, email, role, invitation event, and earlier cancellation event unchanged, where removing the user and inviting them again would lose the invitation and cancellation history.
- **SC-008**: An organization admin restores a cancelled invitation and captures its new link from the cancelled view in under 1 minute, confirmation included, without leaving user administration.
- **SC-009**: 95% of restorations return their outcome within 2 seconds under normal operating conditions.

## Dependencies

- GH-12 — Cancel a Pending Invitation (delivered): produces the cancelled users this feature restores, ends their link at cancellation, and records the cancellation event the restoration keeps. It is a direct blocker of the source issue.
- GH-9 — Renew a Pending User Activation Link (delivered): establishes how a new link is issued for an existing user and presented once, which the restoration reuses. It is the recovery for a restoration outcome that never reached its author, and it already routes a cancelled user to restoration. It is a direct blocker of the source issue.
- GH-7 — Invite a Pending User with a Confidential Activation Link (delivered): supplies the activation link with its 7-day validity, the once-only outcome, and the email conflict refusal that routes a cancelled email to restoration.
- GH-8 — Accept an Invitation and Open an Authenticated Session (delivered): treats a link as usable only while its user is pending, which is why the restoration must guarantee no earlier link survives, and lets the new link be proven end to end.
- GH-4 — Browse and Filter the User List (delivered): supplies the cancelled and pending views, their counts, the row menu, and the access record showing the restoration event.
- GH-3 — Restrict Login to Active Users: guarantees a restored user cannot sign in before accepting.
- GH-14 — Remove a Never-Activated User Permanently (delivered): offers the other way out of a cancelled invitation on the same user, and races with restoration as User Story 5 states.
- GH-24 — Update Another User Identity and GH-28 — Change Another Eligible User Role (delivered): let an organization admin correct a cancelled user's identity or role before restoring them.
- GH-32 — Reactivate a User with Fresh Credentials: the action a deactivated user's restoration refusal points to. The refusal names it whether or not it is delivered yet.

## Out of Scope

- A required reason, or a fixed list of reasons, for the restoration.
- Changing the user's identity or role as part of the restoration; GH-24 and GH-28 own those corrections.
- Restoring a permanently removed user (GH-14): a new invitation is the only way back.
- Reactivating a deactivated user (GH-32).
- Reviving, extending, or reusing any earlier activation link.
- Notifying the invited person that their invitation was restored, and delivering the link by email, which is the standalone "Send invitation emails" slice.
- Restoring several invitations at once, restoring automatically, and restoration requested by the invited person.
- A full history of every cancellation and restoration beyond the most recent of each.
- Changing GH-7's conflict rule: inviting the email of a cancelled user stays refused and routed to restoration.
- Changing the 7-day validity, and rate limiting or throttling of restorations: as for invitation and renewal, no dedicated limit is introduced here.

## Assumptions

- `User Invitation Restoration` follows its `CONTEXT.md` definition, making a cancelled invitation pending again, and its "avoid" terms: it is not a resent or recreated invitation. The original invitation event and its inviting administrator are therefore kept, and the restoration is recorded as its own access status change, as a reactivation is distinct from an activation.
- The earlier cancellation event, its comment included, stays in the access record after the restoration as the history of what happened. It is replaced only by a later cancellation, as GH-12 already assumes, and the restoration is likewise replaced only by a later restoration. A full access history is not introduced here.
- The restoration comment copies the cancellation comment's rules (GH-12): optional, surrounding spaces removed, at most 1,000 characters, shown in the access record only. Reversing a cancellation is worth explaining for the same reason cancelling is, since the cancellation's own comment stays in the record and may otherwise read as the current state. The other access actions (invitation, deactivation, password reset, renewal, role change) keep a date and an actor only.
- The restoration issues a new link rather than bringing back the old one, for two reasons. The cancellation may have been made because the old link was compromised. And GH-8 treats a link as usable again once its user is pending, so a surviving old link would silently come back to life. GH-12 already leaves no live link on a cancelled user, so there is nothing to revive.
- The same once-only outcome as the invitation and the renewal is reused, so that administrators meet one way of handing out an activation link.
- The action is labelled "Restore": the button carries the action alone, since the record, the row, and the confirmation title already say what is restored. The confirmation keeps the product-wide "Cancel" dismiss button, since no other button in it starts with "Cancel".
- A confirmation precedes the restoration because it hands out a new way into the application, which the administrator should do deliberately and to the right person.
- After the restoration, the workbench stays on the cancelled view and does not follow the user to the pending view, as cancellation stays on the pending view (GH-12).
- Only organization admins may restore, following `CONTEXT.md`: they are the only role holding write access to the organization's users, and cancelled and pending users are visible to them only.
- The operating organization manages exactly one site, so the restoring admin's organization determines which users they may restore, without an organization or site picker.
- The workbench reuses the user administration patterns already established: the status views with counts, the record footer and row menu actions, the access record and its history, the confirmation used by the other access actions, the once-only activation link outcome, and the refusal and retryable failure states of the existing write surfaces.
- The invited person receives the restored link out of band, consistently with this milestone excluding real email sending.

## Source-derived decisions

- `CONTEXT.md` defines User Invitation Restoration as "the action of making a cancelled user invitation pending again", to avoid calling it "resend invitation" or "recreate invitation". The source issue's title adds that it comes with a new activation link.
- GH-7 (FR-012, FR-014) and GH-9 (FR-011) already route a cancelled user to restoration, and the workbench already says "Restore it instead" in both places. This feature makes those pointers actionable without changing their wording.
- GH-12 records that a cancellation after a later restoration replaces the earlier cancellation, and that no activation link remains live for a cancelled user.
- The source issue's migration comment reports the entry as already delivered. That delivery belongs to the pre-migration codebase: the current one records no restoration and offers none, so the behavior is specified here in full.
- This slice is end-to-end: it owns both the restoration command in `apps/api` and its action in the user workbench of `apps/web`, absorbing the restoration part of the former frontend-only slice "Manage Invitation Lifecycle From the Web Workbench".

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/13
- Parent roadmap: specs/user-administration/invitation-administration/roadmap.md
- Absorbed scope: the restoration part of "Manage Invitation Lifecycle From the Web Workbench", a frontend-only slice split between GH-9, GH-12, GH-13 and GH-14 on 2026-09-10 and deleted from GitHub.
- Blockers: recorded as GitHub issue dependencies on the source issue (GH-9, GH-12).
- Domain vocabulary: CONTEXT.md (User Invitation Restoration, User Invitation Cancellation, Pending User, User Access Status, User Access Status Change, User Activation Link, User Activation Link Renewal, User Invitation Acceptance, Pending User Removal, User Reactivation, Organization Admin)
- Related slices: GH-7 (invitation), GH-8 (acceptance), GH-9 (link renewal), GH-12 (cancellation), GH-14 (permanent removal), GH-24 (identity update), GH-28 (role change), GH-32 (reactivation), standalone "Send invitation emails".
