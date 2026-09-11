# Feature Specification: Change Another Eligible User Role

**Feature Branch**: `whazzark/change-another-eligible-user-role`

**Created**: 2026-07-09

**Last Updated**: 2026-09-10

**Status**: Draft

**Input**: User description: "l'issue 28 — Change Another Eligible User Role. Let an organization admin change the responsibility level of another user, from the API and from the user workbench. https://github.com/whazzark/portflow-ai/issues/28"

**Feature ID**: `GH-28`

**GitHub Issue**: [#28](https://github.com/whazzark/portflow-ai/issues/28)

**Parent Roadmap**: `specs/user-administration/user-role-change/roadmap.md`

**Roadmap Entry**: `GH-28`

**Priority**: priority:P2

**Milestone**: 0. Sécuriser l'administration des utilisateurs

**Domain**: user-administration

> Merged slice: this specification covers both the API seam and the web seam. It absorbs the former
> frontend-only slice "Change a User's Role From the Web Workbench", merged on 2026-09-10 and
> deleted from GitHub.

## User Scenarios & Testing *(mandatory)*

This is the first write slice on the user collection made consultable by GH-4. It turns the role
shown on a user's access record into something an organization admin can correct, so that a
responsibility level can follow a person's real job without revoking their access and inviting them
again under a different role.

The guards that refuse a role change — a user changing their own role, and the removal of the last
active organization admin — are the subject of GH-29 and are deliberately absent here.

### User Story 1 - Change an Eligible User's Role (Priority: P1)

An organization admin opens a user from the user workbench, sees the responsibility level that user
holds today, and assigns another one, so that what the user may do in the application matches what
the organization expects of them.

**Why this priority**: This is the outcome of the slice. Without it, the only way to correct a
responsibility level is to revoke access and invite the person again, which loses their access
history and their existing identity.

**Independent Test**: Sign in as an organization admin, open a pending, an active, and a cancelled
user in turn, assign each a different role among the four, and verify that the user's role changes,
that nothing else about the user changes, and that the collection and the access record show the new
role.

**Acceptance Scenarios**:

1. **Given** an active user holds the observer role, **When** an organization admin assigns them the operations lead role, **Then** the user holds the operations lead role and the workbench presents that role wherever the user appears.
2. **Given** a pending user has been invited as an operations lead, **When** an organization admin assigns them the operations admin role, **Then** the user holds the operations admin role and remains pending.
3. **Given** a cancelled user holds a role, **When** an organization admin assigns them another one, **Then** the user holds the new role and remains cancelled.
4. **Given** a user is presented on their access record, **When** an organization admin changes their role, **Then** the user's identity, email, access status, recorded lifecycle events, credentials, and password renewal requirement are unchanged.
5. **Given** a user holds the operations admin role, **When** an organization admin submits the operations admin role for that user, **Then** the user is left unchanged and the outcome is not presented as a failure.
6. **Given** the role filter of the user workbench is in use, **When** a user's role changes, **Then** the user appears under their new role and no longer under the previous one.

---

### User Story 2 - Refuse a Role Change the Organization Must Not Allow (Priority: P1)

The system refuses a role change that would act on a user whose access is not eligible, so that an
administrator cannot silently re-shape access that was deliberately withdrawn.

**Why this priority**: A role change is an authorization change. A refusal that is missing, or that
is only enforced by the interface, is a security defect, and the refusals must be observable at the
API whatever the workbench does.

**Independent Test**: Attempt the role change against a deactivated user, against an unknown user,
and with a role value outside the four roles, at the API seam, and verify each refusal, its reason,
and that the target user is left untouched.

**Acceptance Scenarios**:

1. **Given** a user is deactivated, **When** an organization admin attempts to change their role, **Then** the change is refused, the user's role is unchanged, and the refusal states that the user must be reactivated first.
2. **Given** a role value outside organization admin, operations admin, operations lead, and observer, **When** it is submitted for any user, **Then** the change is refused and no user is modified.
3. **Given** an identifier naming no user, **When** a role change is attempted for it, **Then** the change is refused and nothing is modified.
4. **Given** an organization admin opened an eligible user's record, **When** that user becomes ineligible before the change is confirmed, **Then** the change is refused against the user's current state rather than against the state that was displayed.
5. **Given** a role change is refused, **When** the workbench reports it, **Then** the displayed role is the user's unchanged role and the administrator can correct their choice without leaving the user administration area.

---

### User Story 3 - Withhold Role Changes From Every Other Viewer (Priority: P1)

Only the role responsible for user access may change a responsibility level, so that operational
roles cannot grant themselves or each other permissions they were not given.

**Why this priority**: Any viewer able to change a role can grant themselves organization admin. The
API must be the boundary, and the workbench must not present an action the API would refuse.

**Independent Test**: Attempt the role change as an operations admin, an operations lead, an
observer, an unauthenticated visitor, and a signed-in user whose access status is not active, and
verify that each attempt is denied at the API and that the workbench presents no role change entry
point to them.

**Acceptance Scenarios**:

1. **Given** an operations admin, an operations lead, or an observer is signed in, **When** they attempt to change any user's role, **Then** the attempt is denied and no user is modified.
2. **Given** a visitor is not authenticated, or a signed-in user's access status is not active, **When** a role change is attempted, **Then** the attempt is denied.
3. **Given** a viewer may not change roles, **When** they browse the user workbench, **Then** no role change action is presented, and reaching it directly still changes nothing.
4. **Given** an operations admin may consult active users only, **When** they attempt a role change on a pending, cancelled, or deactivated user, **Then** the refusal reveals neither the existence, nor the identity, nor the access status of that user.

---

### User Story 4 - Let the New Role Take Effect for the User (Priority: P2)

A user whose role changed exercises the permissions of their new role from that moment on, without
being signed out and without waiting for anything.

**Why this priority**: A role change that does not reach the person it describes is only a label. It
matters most when a responsibility is withdrawn, where a stale permission is a live security gap.

**Independent Test**: With a user signed in, change their role from operations admin to observer and
back, and verify that the permissions they exercise and the navigation they are offered follow the
current role on their next action, without a new sign-in.

**Acceptance Scenarios**:

1. **Given** a user is signed in as an operations admin, **When** an organization admin assigns them the observer role, **Then** their next attempt at an operations admin action is denied.
2. **Given** a user is signed in as an observer, **When** an organization admin assigns them the operations lead role, **Then** they exercise operations lead permissions without signing in again.
3. **Given** a user's role changed while they were signed in, **When** their session is represented to them, **Then** it carries the new role and the navigation offered matches it.
4. **Given** a user's role changed, **When** they continue working, **Then** they are not signed out and are not required to renew their password by this feature.

---

### User Story 5 - Recover From a Failed Role Change (Priority: P3)

An administrator receives clear feedback when a role change cannot be applied, and can retry without
losing their place in the user administration area.

**Why this priority**: A transient failure read as a success would leave an administrator believing a
responsibility was withdrawn when it was not.

**Independent Test**: Make the role change unavailable, submit one, verify the failure is
distinguished from a refusal and from a success, restore availability, retry, and confirm the change
is applied once.

**Acceptance Scenarios**:

1. **Given** the role change cannot be applied, **When** an administrator submits it, **Then** a clear failure is presented, distinct from a business refusal, and the user's role is unchanged.
2. **Given** a failure was reported, **When** the administrator retries after the problem is resolved, **Then** the change is applied once and the workbench shows the new role without a new sign-in.

### Edge Cases

- Submitting the role a user already holds MUST leave the user unchanged and MUST NOT be reported as a failure.
- A user's access status changing between the moment an administrator opens their record and the moment they confirm MUST be evaluated at execution: an eligible user that became deactivated MUST be refused.
- Two administrators changing the same user's role concurrently MUST leave that user holding exactly one of the two submitted roles, never a partial or combined state.
- A role change MUST NOT alter access status, lifecycle dates, identity, email, credentials, or the password renewal requirement.
- A role change MUST leave no trace on the user: after it is applied, nothing distinguishes a user whose role was changed from a user invited under that role.
- A refusal MUST NOT let a viewer infer the existence or the access status of a user they may not consult.
- An administrator changing their own role, and a change that would leave the organization without an active organization admin, are NOT refused by this feature; they are the subject of GH-29 (see Out of Scope).
- A user signed in on several browsers MUST exercise the new role on all of them, since the role is read from the API on each request.
- Credentials, password material, and session or remember-me tokens MUST NOT be exposed by any part of this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let an organization admin assign another user any one of the four roles: organization admin, operations admin, operations lead, observer.
- **FR-002**: A user MUST be eligible for a role change when their access status is pending, active, or cancelled.
- **FR-003**: The system MUST refuse a role change on a deactivated user, and the refusal MUST state that the user must be reactivated first.
- **FR-004**: The system MUST refuse a role value outside the four roles, and MUST refuse an identifier naming no user, without modifying anything.
- **FR-005**: A role change MUST modify the user's role and nothing else — access status, recorded lifecycle events and their responsible administrators, first name, last name, email, credentials, and password renewal requirement MUST be left as they were.
- **FR-006**: Submitting the role a user already holds MUST leave the user unchanged and MUST NOT be reported as a failure.
- **FR-007**: The system MUST restrict role changes to signed-in users whose access status is active and whose role is organization admin, and MUST deny operations admins, operations leads, observers, unauthenticated visitors, and any user whose access status is not active.
- **FR-008**: The API MUST be the authoritative authorization boundary: the web workbench MUST NOT present a role change action, nor an outcome, that the API would refuse to the same viewer.
- **FR-009**: A refusal MUST NOT disclose the existence, identity, or access status of a user the caller is not allowed to consult.
- **FR-010**: The new role MUST govern the user's authorization from the change onward, on every browser where they are signed in, without requiring them to sign in again; the feature MUST NOT sign the user out and MUST NOT record a password renewal requirement.
- **FR-011**: The representation of a signed-in user's own session MUST carry their current role, so that the navigation and actions offered to them follow a role change.
- **FR-012**: The workbench MUST let an organization admin change the role from an eligible user's access record, MUST present the role that user holds today, and MUST let the administrator choose among the four roles.
- **FR-013**: The workbench MUST NOT offer the role change on a user this feature refuses, and MUST make the reason for that ineligibility discoverable rather than silently omitting the action.
- **FR-014**: After a successful change, the workbench MUST present the user's new role wherever that user is shown, including the role filter and its counts, without requiring a full reload or a new sign-in.
- **FR-015**: A failure to apply the change MUST be presented distinctly from a business refusal and from a success, MUST leave the displayed role unchanged, and MUST be retryable without leaving the user administration area.
- **FR-016**: A role change MUST be applied in place and MUST NOT be recorded: this feature keeps no dated record of the change, no attribution to the administrator who made it, and no memory of the previously held role. The access record MUST continue to present the role a user holds today and nothing more.
- **FR-017**: Changing the role of a pending user MUST NOT issue, renew, or invalidate their activation link, and MUST leave their pending invitation exactly as it was. Reissuing an activation link when a pending user's role changes belongs to the slice that owns activation links.
- **FR-018**: This feature MUST NOT provide the self-role-change refusal or the final-organization-admin protection (GH-29), nor invitation, invitation cancellation or restoration, activation link issuing or renewal, pending user removal, deactivation, reactivation, identity update, or password reset.

### Key Entities

- **User**: A person holding access to the operating organization. Has a stable identity, a first name, a last name, an email, exactly one role, and exactly one access status. This feature changes the role and only the role.
- **User Role**: The responsibility level held by a user — organization admin, operations admin, operations lead, or observer. It determines what the user may consult and change; each role carries the permissions of the ones below it.
- **User Access Status**: The access state of a user — pending activation, active, deactivated, or cancelled before activation. It determines whether the user is eligible for a role change; it is read, never written, by this feature.
- **User Role Change**: The action of changing the responsibility level assigned to a user. It is performed by an organization admin on another user and is distinct from a user access status change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all authorization tests, only signed-in active organization admins change a role; operations admins, operations leads, observers, unauthenticated visitors, and non-active users obtain no change and no user information.
- **SC-002**: For each of the four access statuses, the outcome matches its rule in all tests: pending, active, and cancelled users accept the change, and deactivated users are refused with a reason naming reactivation.
- **SC-003**: In all tests, a refused or failed role change leaves the target user's role, access status, identity, credentials, and lifecycle events exactly as they were before the attempt.
- **SC-004**: A user whose role changed while signed in exercises exactly the permissions of the new role on their next action, on every browser where they are signed in, without signing in again, in all tests.
- **SC-005**: An organization admin changes a listed user's role in no more than 3 interactions from the user list, and sees the new role reflected within 2 seconds under normal operating conditions in 95% of attempts.
- **SC-006**: Correcting a user's responsibility level no longer requires revoking and re-issuing their access: in acceptance testing, zero role corrections involve cancellation, removal, or re-invitation.

## Dependencies

- GH-2 — Persist User Access Status and Lifecycle Metadata: supplies the access status this feature reads to decide eligibility, and the role it changes.
- GH-3 — Restrict Login to Active Users: establishes that only active users hold a session, which this feature's authorization rules assume.
- GH-4 — Browse and Filter the User List: supplies the collection and the access record the role change action attaches to, and the role filter that must follow the change.
- No open issue blocks this slice. It is the entry point of its roadmap's execution order: GH-29 depends on it.

## Out of Scope

- The refusal of a user changing their own role, and the protection of the last active organization admin. Both belong to GH-29, which guards the command this slice delivers and surfaces through the same workbench action. Until GH-29 ships, an organization admin can demote themselves or the last remaining organization admin and lock the organization out of user administration; GH-29 MUST ship before the action is exposed to production users.
- Invitation, invitation cancellation and restoration, activation link issuing and renewal, pending user removal, deactivation, reactivation, identity update, and password reset.
- Any history of role changes: recording who changed a role, when, or which role was held before. Resolved deliberately in FR-016; a later slice may add it, and would start from the moment it ships.
- Issuing, renewing, or invalidating a pending user's activation link as a consequence of a role change.
- Changing the role of several users in one action.
- Introducing a new role, including a customer role, or changing what any existing role is allowed to do.
- Notifying the user whose role changed; no delivery mechanism exists yet.

## Assumptions and Clarifications

- The application serves a single operating organization, so every consultable user is in the administrator's scope; no cross-organization check is introduced by this feature.
- Authorization is evaluated by the API on every request from the stored role, so a role change takes effect immediately for the target user without revoking their session, on every browser at once.
- A role change is not an access status change and does not belong to the access status history exposed by GH-4. It is deliberately untraced in this slice (FR-016): the organization accepts that it cannot later establish who changed a responsibility level, or when. Should that become a requirement, it is a separate slice, and it will only be able to record changes made after it ships.
- Pending and cancelled users are eligible now (FR-017). The pre-migration rule that a pending user's role change reissues their activation link is carried forward to the invitation slice, which owns links; it cannot be honoured here because no activation link exists in the delivered system.
- The four roles are nested in permission scope — organization admin, then operations admin, then operations lead, then observer — so any of the four is a valid destination for any eligible user; no transition between two specific roles is refused by this feature.
- The workbench presents the action on the access record already opened from the user list, so no per-user consultation seam is introduced.

## Source-derived decisions

- This slice is end-to-end: it owns both the role change command in `apps/api` and its action in the user workbench of `apps/web`. It absorbs the former frontend-only slice "Change a User's Role From the Web Workbench", which described the same outcome from the web side alone.
- The eligibility rules come from the pre-migration user domain backlog entry "P2 - User Role Change": pending, cancelled, and active users may have their role changed; deactivated users may not until they are reactivated; a user may not change their own role; the system must keep at least one active organization admin. The last two are GH-29's subject, the first three are this slice's.
- The same backlog entry states that changing a pending user's role invalidates the current activation link and issues a new one. Activation links do not exist in the delivered system yet, so that rule is deferred to the invitation slice rather than dropped (FR-017).
- The issue comment "Already delivered per .tracker/BACKLOG.md at migration time" does not hold against the current codebase: `apps/api` exposes user consultation only, and no role change command, policy, or route exists.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/28
- Parent roadmap: specs/user-administration/user-role-change/roadmap.md
- Absorbed scope: "Change a User's Role From the Web Workbench", a frontend-only slice merged here on 2026-09-10 and deleted from GitHub.
- Source backlog: `docs/backlog-user-domain.md`, section "P2 - User Role Change", as of commit `da7839d9^`.
- Related domain: user-administration
