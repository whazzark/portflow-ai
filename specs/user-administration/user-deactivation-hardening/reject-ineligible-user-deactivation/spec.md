# Feature Specification: Reject Ineligible User Deactivation

**Feature Branch**: `whazzark/reject-ineligible-user-deactivation`

**Created**: 2026-07-09

**Last Updated**: 2026-09-10

**Status**: Draft

**Input**: User description: "l'issue 20" — https://github.com/whazzark/portflow-ai/issues/20

**Feature ID**: `GH-20`

**GitHub Issue**: [#20](https://github.com/whazzark/portflow-ai/issues/20)

**Parent Roadmap**: `specs/user-administration/user-deactivation-hardening/roadmap.md`

**Roadmap Entry**: `GH-20`

**Priority**: priority:P2

**Milestone**: 0. Sécuriser l'administration des utilisateurs

**Domain**: user-administration

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deactivate an Active User (Priority: P1)

As an organization admin, I want to deactivate an active user who has left the organization or must
lose access, so that they can no longer sign in while everything they already did stays visible and
attributed to them.

**Why this priority**: This is the outcome the slice exists for, and the entry point of the whole
roadmap. Until it exists, the only way to stop someone from signing in is to change their password
or edit the database by hand, and no other slice of user deactivation, reactivation, or last-admin
protection has anything to act on.

**Independent Test**: Sign in as an organization admin, open the record of an active user in the
user workbench, deactivate them, and verify the user moves to the deactivated view carrying the
date and the responsible administrator, while that user can no longer sign in and their existing
session stops granting access.

**Acceptance Scenarios**:

1. **Given** an active user other than the actor, **When** an organization admin deactivates them,
   **Then** their access status becomes Deactivated, the date of the change and the responsible
   administrator are recorded, and the deactivation is confirmed.
2. **Given** a user was just deactivated, **When** the organization admin consults the workbench,
   **Then** the user has left the active view for the deactivated one, both counts reflect the
   change without a manual reload, and the access record shows the deactivation with its date and
   its responsible administrator.
3. **Given** a user was just deactivated, **When** they attempt to sign in with credentials that
   were valid a moment earlier, **Then** the attempt is refused with the same outcome as invalid
   credentials, without revealing that the refusal is due to their access status.
4. **Given** a deactivated user still has an open session, or a remembered connection on another
   browser, **When** that session or connection is next used, **Then** it grants no access and the
   user is returned to sign-in.
5. **Given** a user was deactivated, **When** any record they previously produced is consulted,
   **Then** that record still names them, their identity, email, and role are unchanged, and the
   lifecycle events recorded before the deactivation are preserved.
6. **Given** a user carried a password renewal requirement before the deactivation, **When** they
   are deactivated, **Then** the requirement is neither cleared nor added by the deactivation.

---

### User Story 2 - Refuse to Deactivate an Ineligible User (Priority: P1)

As the operating organization, I want a deactivation refused whenever it targets a user who is not
currently active, or the administrator's own access, so that the access status only ever moves along
a meaningful path and an administrator is told what to do instead rather than silently producing an
inconsistent record.

**Why this priority**: The eligibility rules are what makes the deactivation command safe to expose
at all, and they are the named subject of this slice. They ship with the successful path, not after
it, because the same action surfaces both.

**Independent Test**: Attempt to deactivate a pending user, a cancelled user, an already
deactivated user, the acting administrator's own access, and an identifier that matches no user, and
verify each attempt is refused with its own reason and leaves the target completely unchanged.

**Acceptance Scenarios**:

1. **Given** a pending user who has never activated their access, **When** an organization admin
   attempts to deactivate them, **Then** the attempt is refused with the reason
   `PENDING_INVITATION`, the user stays pending, and their activation link is unaffected.
2. **Given** a user whose invitation was cancelled before activation, **When** an organization
   admin attempts to deactivate them, **Then** the attempt is refused with the reason
   `CANCELLED_INVITATION` and the user stays cancelled.
3. **Given** a user who is already deactivated, **When** an organization admin attempts to
   deactivate them again, **Then** the attempt is refused with the reason `ALREADY_DEACTIVATED`,
   and the date and responsible administrator of the original deactivation are unchanged.
4. **Given** an identifier that matches no user, **When** an organization admin attempts to
   deactivate it, **Then** the attempt is refused with the reason `NOT_FOUND`, without disclosing
   anything about other users.
5. **Given** an organization admin consulting their own access record, **When** they attempt to
   deactivate themselves, **Then** the attempt is refused with the reason `SELF`, their access stays
   active, and the deactivation is not offered on their own record in the first place.
6. **Given** an identifier that is not a valid user reference at all, **When** a deactivation is
   submitted for it, **Then** the request is rejected before any user is evaluated or changed.
7. **Given** any refused deactivation attempt, **When** the stored users are inspected afterwards,
   **Then** no user's access status or lifecycle metadata has changed as a result of that attempt.

---

### User Story 3 - Refuse Deactivation to Anyone Not Entitled to It (Priority: P2)

As the operating organization, I want the deactivation refused to every actor who is not an active
organization admin, so that the ability to cut someone's access stays with the single role
accountable for it, whether the request comes from the interface or is sent directly.

**Why this priority**: This guard rail protects the most sensitive write in user administration,
but it is only meaningful once the successful and refused paths above exist.

**Independent Test**: Attempt a deactivation as an unauthenticated visitor, as an operations admin,
as an operations lead, and as an observer, and verify every attempt is refused with no user changed
and the action never offered in their interface.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** a deactivation is attempted, **Then** it is
   refused as unauthenticated and no user is changed.
2. **Given** an authenticated operations admin, operations lead, or observer, **When** a
   deactivation is attempted, **Then** it is refused as unauthorized, no user is changed, and the
   refusal discloses nothing about whether the targeted user exists.
3. **Given** an operations admin consulting the workbench, **When** they open the record of an
   active user, **Then** no deactivation action is offered to them.
4. **Given** an organization admin whose own access stops being active between opening the record
   and confirming the deactivation, **When** they confirm, **Then** the request is refused as if
   they had never been authorized and the targeted user is unchanged.

### Edge Cases

- The targeted user's access status changes between the moment the record is opened and the moment
  the deactivation is confirmed: the outcome carries the reason current at submission time rather
  than the state the actor was looking at, and the workbench shows the refreshed status.
- Two organization admins deactivate the same active user at nearly the same time: exactly one
  deactivation succeeds, and the other resolves as `ALREADY_DEACTIVATED`, so the recorded date and
  responsible administrator are those of the first and are never overwritten.
- The connection is lost, or the action fails after submission: the user is either fully
  deactivated or entirely unchanged, the administrator sees a clear retryable failure, and a retry
  produces neither a second access status change nor a contradictory record.
- The deactivated user is holding an open session at the moment of the deactivation: their session
  keeps no privilege of its own, and their very next request is refused.
- The deactivated user is the responsible of a non-completed shift, or is named as the responsible
  administrator of another user's lifecycle event: those references keep pointing at them and stay
  readable; deactivation retires the access, not the person's history.
- An organization admin deactivates the last *other* active organization admin: this slice allows
  it, because the acting administrator necessarily stays active. Combined with the refusal of
  self-deactivation, this command on its own can never leave the organization without an active
  organization admin.
- Two organization admins deactivate each other at the same instant: both requests pass the
  self-deactivation and eligibility checks against a state where the other is still active, so the
  organization can still be left with no active organization admin. Closing that window is exactly
  the atomic protection GH-21 owns, and this slice does not attempt it.
- An organization admin who wants to retire their own access cannot do it themselves: another
  organization admin must perform it, which is what keeps every deactivation attributable to someone
  who remains.
- The workbench record of a user who was just deactivated by someone else is open on screen: it
  follows the refreshed collection rather than acting on the stale status it was showing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated user whose access is active and whose role is
  organization admin to deactivate one existing active user.
- **FR-002**: The system MUST deny a deactivation attempt to unauthenticated visitors, to users
  whose access is not active, and to authenticated active users whose role is not organization
  admin — operations admin included — without changing any user and without disclosing whether the
  targeted user exists.
- **FR-003**: A user is eligible for deactivation only when their current access status is Active.
- **FR-004**: The system MUST refuse to deactivate a user whose access status is Pending, reporting
  the reason `PENDING_INVITATION`, and MUST leave that user and their activation link unchanged.
- **FR-005**: The system MUST refuse to deactivate a user whose access status is Cancelled,
  reporting the reason `CANCELLED_INVITATION`, and MUST leave that user unchanged.
- **FR-006**: The system MUST refuse to deactivate a user who is already Deactivated, reporting the
  reason `ALREADY_DEACTIVATED`, and MUST leave the date and responsible administrator of the
  original deactivation unchanged.
- **FR-007**: The system MUST refuse a deactivation whose target matches no existing user,
  reporting the reason `NOT_FOUND`, without disclosing information about other users.
- **FR-008**: A deactivation request carrying a malformed user reference MUST be rejected before any
  user is evaluated or changed.
- **FR-009**: The system MUST refuse a deactivation whose target is the acting administrator's own
  access, reporting the reason `SELF`, and MUST leave that administrator active; retiring an
  organization admin's own access requires another organization admin to perform it.
- **FR-010**: A successful deactivation MUST set the user's access status to Deactivated and MUST
  record the date of the change together with the organization admin responsible for it.
- **FR-011**: A successful deactivation MUST preserve the user's stable identity, first and last
  name, email, role, and every lifecycle event already recorded, MUST NOT delete the user, and MUST
  keep every existing record that names them readable and attributed to them.
- **FR-012**: A deactivation MUST NOT add, clear, or otherwise change the user's password renewal
  requirement, which stays independent of the access status.
- **FR-013**: After a successful deactivation, the user MUST NOT be able to sign in, and no session
  or remembered connection they hold on any browser MUST grant them further access; a sign-in
  attempt MUST be refused with the same outcome as invalid credentials, revealing no reason.
- **FR-014**: Authorization and eligibility decisions MUST be enforced authoritatively by the
  system regardless of what the user experience offers, hides, or last displayed.
- **FR-015**: The user workbench MUST offer the deactivation from the access record of an active
  user, only to an actor entitled to perform it and never on that actor's own record, and MUST ask
  for an explicit confirmation before applying it.
- **FR-016**: After a successful deactivation, the workbench MUST reflect the new access status
  without a manual reload: the user leaves the active view for the deactivated one, the view counts
  follow, and the open record either follows the user or closes according to the workbench's
  established rule for a user leaving the visible view.
- **FR-017**: The system MUST report the outcome of every deactivation attempt, distinguishing
  success, each refusal reason (`NOT_FOUND`, `PENDING_INVITATION`, `CANCELLED_INVITATION`,
  `ALREADY_DEACTIVATED`, `SELF`), unauthorized access, and a retryable failure.
- **FR-018**: Concurrent deactivations of the same user MUST result in exactly one successful
  deactivation; every other concurrent attempt MUST resolve as `ALREADY_DEACTIVATED` rather than a
  second access status change or a silent overwrite of the first.
- **FR-019**: A deactivation that fails after submission MUST leave the user entirely unchanged, and
  retrying it MUST NOT produce a duplicate access status change.
- **FR-020**: This slice MUST NOT delete a user, MUST NOT reactivate a deactivated user, MUST NOT
  change any user's role or identity, MUST NOT deactivate several users in one action, and MUST NOT
  implement the last-active-organization-admin protection, which GH-21 owns.

### Key Entities *(include if feature involves data)*

- **User**: A member of the operating organization carrying a stable identity, an email, a role, a
  current access status (Pending, Active, Cancelled, or Deactivated), and the dated lifecycle
  events already recorded against them. Only the access status and the deactivation event are
  affected by this feature.
- **User Access Status Change**: The dated record of a user moving from Active to Deactivated,
  attributed to the organization admin who caused it.
- **Deactivation Blocker**: The reported reason a deactivation was refused: the target does not
  exist (`NOT_FOUND`), it has never activated its access (`PENDING_INVITATION`), its invitation was
  withdrawn before activation (`CANCELLED_INVITATION`), it is already deactivated
  (`ALREADY_DEACTIVATED`), or it is the acting administrator's own access (`SELF`).
- **Organization Admin**: An authenticated user with active access holding the organization admin
  role; the only actor permitted to deactivate a user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of deactivations of an eligible active user by an
  organization admin succeed, and the new status is visible in the workbench within 2 seconds under
  normal operating conditions without a manual reload.
- **SC-002**: In acceptance testing, 100% of sign-in attempts made by a user deactivated moments
  earlier are refused, and the refusal is indistinguishable from an invalid-credentials refusal.
- **SC-003**: In acceptance testing, 100% of requests made with a session or remembered connection
  held by a deactivated user are refused at the first request following the deactivation.
- **SC-004**: In acceptance testing, 100% of deactivation attempts targeting a pending, cancelled,
  already deactivated, or unknown user, or the acting administrator's own access, are refused with
  the correct one of `PENDING_INVITATION`, `CANCELLED_INVITATION`, `ALREADY_DEACTIVATED`,
  `NOT_FOUND`, or `SELF`, with zero users changed.
- **SC-005**: In acceptance testing, 100% of deactivation attempts by unauthenticated visitors,
  non-active users, operations admins, operations leads, and observers are refused with no user
  changed, and the action is never offered to them in the workbench.
- **SC-006**: Across concurrent-submission acceptance scenarios targeting the same active user,
  exactly one deactivation succeeds in 100% of runs, and the recorded date and responsible
  administrator are those of the successful one.
- **SC-007**: In 100% of acceptance datasets, a deactivated user keeps their identity, email, role,
  prior lifecycle events, and password renewal requirement state, and 100% of the records already
  naming them remain readable and attributed to them.
- **SC-008**: At least 90% of representative organization admins can find and complete the
  deactivation of a named active user on their first attempt, within 60 seconds, without external
  help, and can tell from the outcome alone whether it succeeded and why it did not.

## Assumptions

- "Organization admin" is the single role entitled to deactivate, following the domain definition
  that gives it read and write access to active and deactivated users, while an operations admin
  consults active users only and therefore never sees a deactivation action.
- Deactivation records only a date and the responsible administrator, matching the User Access
  Status Change vocabulary; no comment or reason text is captured with it, unlike site-reference
  archiving.
- An organization admin may not deactivate their own access. It is refused with its own `SELF`
  reason rather than merely hidden from the interface, so that every deactivation leaves an
  accountable administrator behind and this command alone can never strip the organization of its
  last active organization admin. The one residual path to that state — two administrators
  deactivating each other simultaneously — is the atomic protection GH-21 owns.
- A pending user is stopped through invitation cancellation and a cancelled one through pending user
  removal, both already delivered; deactivation is deliberately not a second route to the same
  outcome, which is why those statuses are refused with their own reasons rather than accepted.
- The refusal reasons are surfaced to the administrator as distinct, actionable outcomes, following
  the per-reason blocker model already used by site-reference archiving.
- Access status is already re-checked on every authenticated request and at every sign-in, so no new
  session-expiry mechanism is introduced: a deactivated user loses access through the checks the
  access-status foundation already delivered.
- The workbench surface is the existing user record introduced by the user list slice, extended with
  its first write action rather than replaced by a separate page; the established application
  language, confirmation, validation-messaging, and accessibility conventions apply.
- A deactivated user's email stays attached to them and is not freed for a new invitation, because
  the user is retired rather than deleted.
- Only one user is deactivated per action; no selection or batch deactivation is introduced, since
  the user workbench offers no multi-selection today and none was requested.
- No email or in-application notification is sent to the deactivated user; notification delivery is
  outside this milestone.

## Dependencies

- None. No open issue blocks this slice: the access statuses it changes and the user workbench that
  lists them are already delivered.
- It is the entry point of the roadmap's execution order: GH-21 depends on it, and so does GH-32
  in the User Reactivation roadmap, which needs a deactivated user to restore.

## Out of Scope

- The last-active-organization-admin protection, owned by GH-21 and layered on this command:
  refusing self-deactivation here removes the single-request path to a lockout, but not the
  concurrent one.
- Reactivating a deactivated user, owned by GH-32.
- Password reset (GH-17), user role change, and user identity update.
- Invitation cancellation and pending user removal, already delivered.
- Deactivating several users in one action, and permanently deleting a user, which the product does
  not support anywhere.
- Notifying the deactivated user, or anyone else, that the deactivation happened.

## Source-derived decisions

- This slice is end-to-end: it owns both the deactivation command with its eligibility rules in
  `apps/api` and its action in the user workbench of `apps/web`. It absorbs the former frontend-only
  slice "Deactivate a User From the Web Workbench", which described the same outcome from the web
  side alone.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/20
- Parent roadmap: specs/user-administration/user-deactivation-hardening/roadmap.md
- Absorbed scope: "Deactivate a User From the Web Workbench", a frontend-only slice merged here on
  2026-09-10 and deleted from GitHub.
- Domain vocabulary: `CONTEXT.md` — User Deactivation, User Access Status, User Access Status
  Change, Organization Admin, Login.
- Related domain: user-administration
