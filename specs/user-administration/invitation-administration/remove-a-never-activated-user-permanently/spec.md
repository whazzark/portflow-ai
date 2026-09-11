# Feature Specification: Remove a Never-Activated User Permanently

**Feature Branch**: `whazzark/remove-a-never-activated-user-permanently`

**Created**: 2026-07-09

**Last Updated**: 2026-09-11

**Status**: Draft

**Input**: User description: "https://github.com/whazzark/portflow-ai/issues/14 — Remove a Never-Activated User Permanently"

**Feature ID**: `GH-14`

**GitHub Issue**: [#14](https://github.com/whazzark/portflow-ai/issues/14)

**Parent Roadmap**: `specs/user-administration/invitation-administration/roadmap.md`

**Roadmap Entry**: `GH-14`

**Priority**: priority:P1

**Milestone**: 0. Sécuriser l'administration des utilisateurs

**Domain**: user-administration

> Merged slice: this specification covers both the API seam and the web seam. It absorbs the removal
> part of the former frontend-only slice "Manage Invitation Lifecycle From the Web Workbench",
> merged on 2026-09-10 and deleted from GitHub.

## Clarifications

### Session 2026-09-11

- Q: Should a removal leave any record behind — who removed which user, and when? → A: No. The removal is untraced: nothing is kept once the user is removed, neither a removed state, nor the removing administrator and date, nor the removed user's identity (FR-012).
- Q: How strong is the confirmation before a removal? → A: A single confirmation: a dialog naming the user and stating the removal is permanent, confirmed with one `Remove` action. No typed confirmation, whatever the user's role (FR-017).

## User Scenarios & Testing *(mandatory)*

An invitation can turn out to be a mistake: a misspelled email, the wrong person, a role nobody
should hold, or someone who never joined. Today the only trace of that mistake is a user that stays
in the collection forever and holds on to its email, so the person cannot be invited again
correctly. This slice lets an organization admin remove such a user outright, as if the invitation
had never happened, because a user whose access was never activated has never used the application
and leaves no history anyone needs to understand later.

Only users whose access was never activated are removable: pending users and cancelled users.
Anyone who once held access — active or deactivated — is kept, so that their historical actions stay
understandable; withdrawing their access is the job of user deactivation.

### User Story 1 - Remove a Never-Activated User (Priority: P1)

An organization admin opens a pending or a cancelled user from the user workbench, chooses to remove
them, confirms after being told the removal is permanent, and the user disappears from the
organization, freeing their email for a new invitation.

**Why this priority**: This is the outcome of the slice. Without it, a mistaken invitation can only
be cancelled, which keeps the user and their email forever and blocks inviting the same person again
with corrected details.

**Independent Test**: Sign in as an organization admin, invite a user, remove them, and verify that
they no longer appear in any view or count of the user collection, that their activation link no
longer leads anywhere, and that a new invitation with the same email succeeds. Repeat with a
cancelled user.

**Acceptance Scenarios**:

1. **Given** a pending user exists, **When** an organization admin removes them and confirms, **Then** the user no longer exists: they appear in no view of the user collection, the counts of every access status exclude them, and their access record can no longer be opened.
2. **Given** a cancelled user exists, **When** an organization admin removes them and confirms, **Then** the user no longer exists, with the same observable outcome as for a pending user.
3. **Given** a pending user holds an activation link, **When** they are removed, **Then** no activation link ever issued for them permits accepting an invitation or reveals their identity, email, or role.
4. **Given** a pending or cancelled user was removed, **When** an organization admin invites a person with the same email, **Then** the invitation is accepted as a new one, with no conflict and nothing inherited from the removed user.
5. **Given** an organization admin chooses to remove a user, **When** the confirmation is presented, **Then** it names the user, states that the removal is permanent and cannot be undone, and nothing is removed until the administrator confirms.
6. **Given** the confirmation is presented, **When** the administrator dismisses it, **Then** the user is left exactly as they were.
7. **Given** the user's access record is open, **When** the removal succeeds, **Then** the record closes, the workbench confirms which user was removed, and the administrator stays in the user administration area.

---

### User Story 2 - Refuse to Remove a User Who Once Held Access (Priority: P1)

The system refuses to remove anyone whose access was activated at some point, so that people who
have used the application keep their place in its history, and tells the administrator what to do
instead.

**Why this priority**: A permanent removal of the wrong user is irreversible. The rule separating
removable users from kept users must be enforced by the API against the user's current state,
whatever the workbench shows.

**Independent Test**: Attempt the removal, at the API seam, against an active user, a deactivated
user, and an unknown identifier, and verify each refusal, its reason, and that no user is modified.

**Acceptance Scenarios**:

1. **Given** a user is active, **When** an organization admin attempts to remove them, **Then** the removal is refused, the user is unchanged, and the refusal states that only users who never activated their access can be removed and that deactivation is how an active user's access is withdrawn.
2. **Given** a user is deactivated, **When** an organization admin attempts to remove them, **Then** the removal is refused, the user is unchanged, and the refusal states that users who once held access are kept.
3. **Given** an identifier naming no user, **When** a removal is attempted for it, **Then** the removal is refused as naming no user, and nothing is modified.
4. **Given** an organization admin opened a pending user's record, **When** that user's access is activated before the removal is confirmed, **Then** the removal is refused against the user's current state rather than the state that was displayed.
5. **Given** a user was already removed by another administrator, **When** a second removal of the same user is confirmed, **Then** it reports that the user no longer exists, changes nothing, and the workbench stops presenting that user.
6. **Given** a removal is refused, **When** the workbench reports it, **Then** the reason is presented, the user's displayed state is refreshed to their current one, and the administrator stays in the user administration area.

---

### User Story 3 - Withhold Removal From Every Other Viewer (Priority: P1)

Only the role responsible for user access may remove a user, and a refusal never reveals anything
about users the caller may not consult.

**Why this priority**: Removal is the most destructive action on the user collection. The API must be
the boundary, and the workbench must not present an action the API would refuse.

**Independent Test**: Attempt the removal as an operations admin, an operations lead, an observer, an
unauthenticated visitor, and a signed-in user whose access status is not active, and verify that
each attempt is denied at the API, that no user is modified, and that the workbench presents no
removal entry point to them.

**Acceptance Scenarios**:

1. **Given** an operations admin, an operations lead, or an observer is signed in, **When** they attempt to remove any user, **Then** the attempt is denied and no user is modified.
2. **Given** a visitor is not authenticated, or a signed-in user's access status is not active, **When** a removal is attempted, **Then** the attempt is denied and no user is modified.
3. **Given** a viewer may not remove users, **When** they browse the user workbench, **Then** no removal action is presented, and reaching it directly still removes nothing.
4. **Given** a viewer may not remove users, **When** they attempt a removal against a pending user, a cancelled user, an active user, or an identifier naming no user, **Then** all four attempts receive the same denial, revealing neither the existence, the identity, nor the access status of any user.

---

### User Story 4 - Recover From a Failed Removal (Priority: P3)

An administrator receives clear feedback when a removal cannot be applied, and can retry without
losing their place in the user administration area.

**Why this priority**: A transient failure read as a success would leave an administrator believing
an email was freed, or an activation link withdrawn, when it was not.

**Independent Test**: Make the removal unavailable, confirm one, verify the failure is distinguished
from a refusal and from a success, restore availability, retry, and confirm the user is removed
once.

**Acceptance Scenarios**:

1. **Given** the removal cannot be applied, **When** an administrator confirms it, **Then** a clear failure is presented, distinct from a business refusal, and the user still exists unchanged.
2. **Given** a failure was reported, **When** the administrator retries after the problem is resolved, **Then** the user is removed once and the workbench reflects it without a new sign-in.

### Edge Cases

- A removal MUST be all or nothing: after a failure or a refusal, the user, their activation link, and every other record MUST be exactly as they were; after a success, nothing belonging to the removed user MUST remain reachable.
- A user's access status changing between the moment an administrator opens their record and the moment they confirm MUST be evaluated at execution: a user that became active in between MUST be refused, and a pending user that became cancelled in between (or the reverse) MUST still be removed.
- A removal racing any other action on the same user — an invitation acceptance, an activation link renewal, a cancellation, a restoration, an identity update, a role change, or another removal — MUST end in a consistent state: either the user is removed and the other action did not take effect, or the other action took effect and the removal was evaluated against its result.
- An organization admin cannot remove themselves: their own access is active, so their own record is refused by the status rule, and the workbench never offers the action on it.
- Removing a never-activated organization admin MUST NOT be affected by any last-organization-admin protection: a user who never activated their access never counted as an active organization admin.
- A never-activated user referenced by a record that must stay understandable — for instance, named as responsible for an operational activity — MUST NOT be removed; the removal MUST be refused, leaving everything unchanged, rather than break or silently rewrite that record.
- A removal MUST NOT alter any other user, including the administrator who invited, renewed, or cancelled the removed user, and MUST NOT alter the lifecycle events recorded on other users.
- An administrator who kept the removed user's record, or a link to it, open MUST see that the user no longer exists on their next action, rather than a stale record.
- The removed user's email MUST become available for invitation as soon as the removal succeeds, whatever its casing or surrounding spaces in the new invitation.
- Credentials, activation links, and session or remember-me tokens MUST NOT be exposed by any part of this feature, including its confirmation, its outcome, and its refusals.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let an organization admin permanently remove a user whose access was never activated, which is a user whose access status is pending or cancelled.
- **FR-002**: The system MUST refuse the removal of an active user, and the refusal MUST state that only never-activated users can be removed and that deactivation is how an active user's access is withdrawn.
- **FR-003**: The system MUST refuse the removal of a deactivated user, and the refusal MUST state that users who once held access are kept.
- **FR-004**: The system MUST refuse a removal naming no user, without modifying anything.
- **FR-005**: Eligibility MUST be evaluated against the user's access status at the moment the removal is executed, not against the state the administrator was shown.
- **FR-006**: A successful removal MUST leave nothing of the user reachable: the user MUST no longer appear in any view or count of the user collection, their access record MUST no longer be consultable, and no consultation seam MUST return them.
- **FR-007**: A successful removal MUST end the usefulness of every activation link ever issued for the user: none MUST permit accepting an invitation or reveal the user's identity, email, or role, and each MUST be treated exactly like a link that never existed.
- **FR-008**: A successful removal MUST free the user's email, so that a later invitation with that email — compared case-insensitively and ignoring surrounding spaces — is accepted as a new invitation that inherits nothing from the removed user.
- **FR-009**: A removal MUST be all or nothing: a refused or failed removal MUST leave the user, their activation link, and every other record exactly as they were.
- **FR-010**: A removal MUST NOT modify any other user, nor the lifecycle events and responsible administrators recorded on any other user.
- **FR-011**: The system MUST refuse to remove a never-activated user referenced by a record that must stay understandable, leaving everything unchanged, rather than break or rewrite that record.
- **FR-012**: A removal MUST be permanent and MUST NOT be recorded: the system keeps no removed state, no record of who removed which user or when, and no copy of the removed user's identity, email, or role. A removed user cannot be restored; the only way back is a new invitation.
- **FR-013**: The system MUST restrict removal to signed-in users whose access status is active and whose role is organization admin, and MUST deny operations admins, operations leads, observers, unauthenticated visitors, and any user whose access status is not active.
- **FR-014**: The API MUST be the authoritative authorization boundary: the web workbench MUST NOT present a removal action, nor an outcome, that the API would refuse to the same viewer.
- **FR-015**: A denial MUST NOT disclose the existence, identity, or access status of any user: a viewer who may not remove users MUST receive the same denial whatever the identifier names.
- **FR-016**: The workbench MUST offer the removal on pending and cancelled users, from the user collection and from the user's access record, and MUST NOT offer it on active or deactivated users, nor on the viewer's own record.
- **FR-017**: The workbench MUST require a single explicit confirmation before removing: a dialog that names the user, states that the removal is permanent and cannot be undone, removes the user on one `Remove` action, and lets the administrator back out with no effect. It MUST NOT require typing the user's email or any other value, whatever the user's role.
- **FR-018**: After a successful removal, the workbench MUST close the removed user's access record if it was open, confirm which user was removed, and reflect the removal in every view and count of the user collection without a full reload or a new sign-in.
- **FR-019**: A failure to apply the removal MUST be presented distinctly from a business refusal and from a success, MUST leave the user presented as still existing, and MUST be retryable without leaving the user administration area.
- **FR-020**: When a removal is refused because the user's state changed or the user no longer exists, the workbench MUST present the reason and refresh the user's presentation to their current state.
- **FR-021**: This feature MUST NOT provide invitation, invitation acceptance, activation link renewal, invitation cancellation or restoration, deactivation, reactivation, role change, identity update, or password reset, and MUST NOT change the outcome of any of them.

### Key Entities

- **User**: A person holding access to the operating organization, with a stable identity, a first name, a last name, an email unique across the organization, exactly one role, and exactly one access status. This feature removes a user entirely, and only a user whose access was never activated.
- **User Access Status**: The access state of a user — pending activation, active, deactivated, or cancelled before activation. Pending and cancelled users are removable; active and deactivated users are not. It is read, never written, by this feature.
- **Pending User**: A user whose access has been invited but not activated yet. Removable.
- **Cancelled User**: A user whose invitation was withdrawn before activation. Removable.
- **User Activation Link**: A confidential link allowing a pending user to accept their invitation. Every link issued for a removed user stops permitting anything.
- **Pending User Removal**: The action of permanently removing a user whose access has never been activated. Distinct from a user invitation cancellation, which keeps the user and allows a later restoration, and from a user deactivation, which keeps a user who once held access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all authorization tests, only signed-in active organization admins remove a user; operations admins, operations leads, observers, unauthenticated visitors, and non-active users remove nothing and obtain an identical denial whatever the identifier names.
- **SC-002**: For each of the four access statuses, the outcome matches its rule in all tests: pending and cancelled users are removed, active users are refused with a reason naming deactivation, and deactivated users are refused with a reason stating they are kept.
- **SC-003**: In 100% of successful removals, the user is absent from every view and count of the user collection, every activation link issued for them permits nothing, and a new invitation with the same email succeeds.
- **SC-004**: In all refused, failed, and concurrent removal tests, the target user, their activation link, and every other user are exactly as they were before the attempt, or the user is entirely removed — never a partial state.
- **SC-005**: An organization admin removes a listed never-activated user in no more than 3 interactions from the user list, and sees the removal reflected within 2 seconds under normal operating conditions in 95% of attempts.
- **SC-006**: Reinviting a person whose invitation was a mistake no longer requires any intervention outside the workbench: in acceptance testing, 100% of such corrections are completed by a removal followed by a new invitation.

## Dependencies

- GH-2 — Persist User Access Status and Lifecycle Metadata: supplies the access status this feature reads to decide eligibility, including the cancelled status.
- GH-4 — Browse and Filter the User List: supplies the collection, its views and counts, and the access record the removal action attaches to.
- GH-7 — Invite a Pending User with a Confidential Activation Link: supplies the pending users and activation links this feature removes, and the invitation that must accept a freed email. Delivered.
- Deliverable in parallel with GH-12 (Cancel a Pending Invitation): neither blocks the other. Until GH-12 ships, cancelled users exist only through data already in that status, and removal of a cancelled user is verified against such data.
- GH-8 (Accept an Invitation) is not a dependency: FR-007 is verifiable without it, and GH-8 must treat the links of a removed user exactly like unknown links when it ships.

## Out of Scope

- Removing active or deactivated users, through any workflow. Withdrawing an active user's access is user deactivation.
- Any record of removals — who removed which user, when, or under which identity. Resolved deliberately in FR-012; a later slice may add one, and would only cover removals made after it ships.
- Restoring a removed user, or any removed or archived user state; a new invitation is the only way back.
- Removing several users in one action, and any automatic removal, such as expiring invitations that were never accepted.
- Changing the invitation conflict refusal of GH-7 so that it names removal as an option for a pending or cancelled email; that refusal keeps pointing to renewal and restoration.
- Invitation cancellation (GH-12) and restoration (GH-13), activation link renewal (GH-9), invitation acceptance (GH-8), and every other user administration action.
- Notifying the removed person; no delivery mechanism exists yet.

## Assumptions and Clarifications

- "Never activated" is read from the access status: pending and cancelled users have never held access, while active and deactivated users represent people who once had it. This follows the pre-migration rule that pending and cancelled users do not represent people who have used the application.
- Removal is untraced (FR-012, Clarifications), consistent with GH-28's untraced role change and with the absence of any user activity log in the delivered system. A removed user has no actions to attribute and no history to preserve, and keeping their identity after removal would contradict the purpose of a permanent removal. The organization accepts that it cannot later establish who removed a never-activated user, or when.
- A never-activated user cannot sign in and cannot have performed any action, so no lifecycle event of any other user names them as its responsible administrator. FR-011 protects against operational records that may name such a user in the future; none can in the delivered system.
- The application serves a single operating organization, so every consultable user is in the administrator's scope; no cross-organization check is introduced by this feature.
- The workbench presents the removal among the destructive access actions of the user collection and the access record, following the confirmation pattern of user deactivation, and labels it with the action alone (`Remove`).
- A cancelled user's record may be removed whether or not GH-12 has shipped; the action does not depend on how the user reached that status.

## Source-derived decisions

- This slice is end-to-end: it owns both the removal command in `apps/api` and its action in the user workbench of `apps/web`. It absorbs the removal part of the former frontend-only slice "Manage Invitation Lifecycle From the Web Workbench".
- The eligibility rules come from the pre-migration user domain backlog entry "P1 - Pending User Removal": only pending and cancelled users can be removed; removing them invalidates every activation link issued for them; active and deactivated users cannot be removed through normal workflows; an administrator who wants to reuse the email of a pending or cancelled user can remove that user first.
- The same backlog's principles state that active and deactivated users are not deleted in normal workflows because historical actions must remain understandable, while pending and cancelled users may be permanently removed because their access was never activated.
- The issue comment "Already delivered per .tracker/BACKLOG.md at migration time" does not hold against the current codebase: no removal command, policy, route, or workbench action exists, and no `.tracker/BACKLOG.md` exists in the repository history.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/14
- Parent roadmap: specs/user-administration/invitation-administration/roadmap.md
- Absorbed scope: the removal part of "Manage Invitation Lifecycle From the Web Workbench", a frontend-only slice split between GH-9, GH-12, GH-13 and GH-14 on 2026-09-10 and deleted from GitHub.
- Source backlog: `docs/backlog-user-domain.md`, sections "Principles" and "P1 - Pending User Removal", as of commit `da7839d9^`.
- Domain vocabulary: CONTEXT.md (Pending User Removal, Pending User, User Access Status, User Invitation Cancellation, User Activation Link, User Deactivation)
- Related domain: user-administration
