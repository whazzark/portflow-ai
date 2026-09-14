# Feature Specification: Let Active Users Manage Their Own Profile

> Renamed on 2026-09-14, when the product owner widened the slice from the identity alone to the
> profile: identity **and** password, on one self-service page. Issue #25 keeps its own title, "Let
> Active Users Update Their Identity"; this artifact is named for what it delivers.

**Feature Branch**: `whazzark/let-active-users-update-their-identity`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "Let Active Users Update Their Identity — Let a signed-in active user update their own identifying information, from the API and from the web application. https://github.com/whazzark/portflow-ai/issues/25"

**Feature ID**: `GH-25`

**GitHub Issue**: [#25](https://github.com/whazzark/portflow-ai/issues/25)

**Parent Roadmap**: `specs/user-administration/user-identity-update/roadmap.md`

**Roadmap Entry**: `GH-25`

**Priority**: priority:P2

**Milestone**: 0. Sécuriser l'administration des utilisateurs

**Domain**: user-administration

> Vertical slice: this specification covers both the self-service command in `apps/api` and its
> screen in `apps/web`. It absorbs the self-service half of the former frontend-only slice "Update
> User Identity From the Web Workbench"; that slice's administrator half was delivered by GH-24.

## Clarifications

### Session 2026-09-14 (scope)

- Q: Changing one's own password was out of scope, and `CONTEXT.md` avoided "profile" for a user
  identity update. Both were put to the product owner. → A: The slice widens. The self-service screen
  becomes the **profile** — identity and password together — and the renaming goes all the way to the
  API (`/api/v1/me/profile`, `/api/v1/me/password`). `CONTEXT.md` gains **Profile** and **Password
  Change**, and no longer avoids "profile" for an identity update. Tracing stays in GH-25 rather than
  in a slice of its own, so that one page ships in one pull request.
- Q: What happens to the connections a user left remembered on other browsers when they change their
  password? → A: They are revoked, as a password renewal already revokes them; only the connection
  the change was performed from survives. A credential replaced must stop restoring access.

### Session 2026-09-14

- Q: A form opened before an administrator corrected the same user can submit the identity it was
  opened on, and that submission is applied over the newer one. Should a stale submission be refused
  instead? → A: No. The last accepted update wins, as in GH-24: neither seam carries the identity a
  form was opened on, so a stale submission cannot be told from a deliberate one. US5-3, the
  concurrency edge case, and SC-005 are amended to say so. The one protection kept is the address:
  it never moves without the current password, so an address an administrator moved cannot be put
  back silently.

### Session 2026-09-11

- Q: May a signed-in user change their own email address — their sign-in identifier — or only their
  name? No mailer exists yet, so the new mailbox cannot be confirmed in this slice. → A: The email
  address is in scope. Changing it requires the user to re-enter their current password; confirming
  the new mailbox is left to GH-118.

## User Scenarios & Testing *(mandatory)*

This delivery is the second and last slice of the User Identity Update roadmap. GH-24 made a user's
identity correctable by an organization admin and established the identity rules — what an identity
is and how it is validated. This slice opens the same outcome to every active user for their own
identity, under a self-service authorization path, and adds the one safeguard that path needs: the
sign-in identifier is not changed on the strength of an open session alone.

### User Story 1 - Update My Own Name (Priority: P1)

A signed-in active user, whatever their role, updates their own first name or last name — a
misspelling at invitation time, a name that changed — without asking an administrator, so that
everywhere they are named, starting with their own session, carries the right name.

**Why this priority**: Today a user who spots a mistake in their own name depends on an organization
admin to fix it, and an organization admin cannot fix their own name at all: GH-24 refuses it and
directs them here. Fixing one's own name is the core of the slice and needs no safeguard beyond the
session.

**Independent Test**: Sign in as each active role, open one's own identity from the signed-in user's
menu, change the first and last name, confirm, and verify that the session, the signed-in user's
menu, and every other place that user is named carry the new name, with no other attribute changed
and no new sign-in required.

**Acceptance Scenarios**:

1. **Given** an active user is signed in, **When** they open their own identity, **Then** it is pre-filled with their current first name, last name, and email address.
2. **Given** the identity form is open, **When** the user submits a valid new first name or last name, **Then** the change is applied and their own session immediately presents the new name, without a new sign-in or a manual reload.
3. **Given** a name change has just been applied, **When** the user's identity is consulted again — by themselves or, for an organization admin, in the user collection — **Then** the change is durable and their role, access status, lifecycle events, credentials, and sessions are unchanged.
4. **Given** the identity form is open, **When** the user changes only part of their identity, **Then** the untouched parts keep their current values and are not cleared.
5. **Given** the identity form is open, **When** the user abandons the change, **Then** nothing is modified.
6. **Given** the submitted identity is identical to the current one, **When** it is confirmed, **Then** the outcome is a success and nothing is written.

---

### User Story 2 - Change My Own Email Address With My Password (Priority: P1)

A signed-in active user changes the email address they sign in with, confirming the change by
re-entering their current password, so that they keep control of their own sign-in identifier while
nobody can redirect it merely by finding their session open.

**Why this priority**: The email address is the sign-in identifier. Changing it is as much a part of
the identity as the name, but an unguarded change would let anyone at an unattended session take
the account's identifier; the password re-entry is what makes the change safe to open to every
user.

**Independent Test**: As an active user, submit a different email address without a password, then
with a wrong one, and verify both are refused with nothing changed; submit it with the correct
current password and verify the change is applied, the current session continues, the menu shows
the new address, the next sign-in succeeds with the new address and fails with the old one.

**Acceptance Scenarios**:

1. **Given** the identity form is open, **When** the user changes their email address, **Then** they are asked for their current password before the change can be submitted.
2. **Given** the user submits a different email address with their correct current password, **When** it is confirmed, **Then** the change is applied, their current session continues, and their own session immediately presents the new address.
3. **Given** an email change has been applied, **When** the user next signs in, **Then** the new address signs them in and the former address no longer does.
4. **Given** the user submits a different email address without their current password, or with an incorrect one, **When** it is confirmed, **Then** the whole submission is refused, the current password is named as the field at fault, nothing is changed — including any name change submitted alongside — and the identity they typed is preserved.
5. **Given** the submitted email address differs from the current one only by letter case or surrounding whitespace, **When** it is confirmed, **Then** it is treated as the same address: no password is required and the submission is handled as a name-only update.
6. **Given** the user changes only their name, **When** it is confirmed, **Then** no password is asked for.

---

### User Story 3 - Keep the Self-Service Path Confined to Oneself (Priority: P1)

The self-service path lets each active user change their own identity and nobody else's, and is
closed to anyone without an active, fully established session, so that it cannot become a second,
weaker way into the administration of other users.

**Why this priority**: GH-24 confines the correction of another user's identity to the organization
admin. A self-service path that could be pointed at someone else would bypass that rule entirely.
The API must enforce it whatever the interface does.

**Independent Test**: At the API seam, attempt a self-service update as each active role, as an
unauthenticated visitor, as a user whose password renewal is still required, and as a user whose
access status is not active, and verify each outcome; then verify no input to the self-service
path can change a user other than the one signed in.

**Acceptance Scenarios**:

1. **Given** an active organization admin, operations admin, operations lead, or observer is signed in, **When** they update their own identity, **Then** the update is accepted.
2. **Given** a signed-in user, **When** they submit a self-service update carrying any reference to another user, **Then** only their own identity can ever be affected and no other user is changed.
3. **Given** a visitor is not authenticated, or a user's access status is not active, **When** a self-service update is attempted, **Then** the request is denied and nothing is changed.
4. **Given** a signed-in user must still renew their password, **When** they attempt a self-service update, **Then** the request is denied until the renewal is complete, and the renewal screen offers no identity update.
5. **Given** an organization admin is signed in, **When** they want to change their own identity, **Then** they do so through this self-service path, under the same rules as every other user, including the password re-entry for an email change.

---

### User Story 4 - Reject an Invalid or Conflicting Identity (Priority: P2)

The user is stopped, with an explanation they can act on, when the identity they submit is
incomplete, malformed, or holds an address already used by another user — by exactly the rules an
organization admin's correction obeys.

**Why this priority**: The identity rules are those of GH-24 and must not diverge between the two
paths; a user must not be able to give themselves an identity an administrator could not.

**Independent Test**: Submit an empty name, an over-long name, a malformed address, and an address
already held by another user in every access status — each time with the correct current password
where the address changes — and verify each refusal names the field at fault, changes nothing, and
preserves what the user typed.

**Acceptance Scenarios**:

1. **Given** the identity form is open, **When** a required part of the identity is empty or blank, **Then** the update is refused, the field at fault is named, and nothing is changed.
2. **Given** the identity form is open, **When** the submitted email address is malformed, **Then** the update is refused with an explanation and nothing is changed.
3. **Given** another user already holds an email address, whatever their access status, **When** the user submits that address with their correct current password, **Then** the update is refused as a conflict and neither user is changed.
4. **Given** an address differs from another user's only by letter case or surrounding whitespace, **When** it is submitted, **Then** it is treated as the same address and refused as a conflict.
5. **Given** a changed address is submitted with an incorrect or missing current password, **When** it is confirmed, **Then** the refusal concerns the password only and reveals nothing about whether the address is already held by another user.
6. **Given** an update was refused, **When** the user corrects the offending value and submits again, **Then** the update succeeds without their having to re-enter the parts of the identity that were already valid.

---

### User Story 5 - Recover From a Failed Update (Priority: P3)

A user whose update cannot be applied is told so unambiguously and can retry without losing the
identity they typed.

**Why this priority**: An update silently lost, or wrongly presented as applied, leaves the user
believing their identity — possibly their sign-in identifier — is something it is not.

**Independent Test**: Make the update fail transiently, verify the failure is reported and the
presented identity is unchanged, then restore availability, retry, and confirm the update is applied
without a new sign-in.

**Acceptance Scenarios**:

1. **Given** a self-service update cannot be applied, **When** the user submits it, **Then** a clear failure is reported, their identity is unchanged everywhere, and the identity they typed remains available for a retry.
2. **Given** a retryable failure was reported, **When** the user retries after the underlying problem is resolved, **Then** the update is applied without requiring a new sign-in.
3. **Given** an organization admin corrected the user's identity since the user opened the form, **When** the user submits, **Then** the submission is applied whole over the identity as it now stands — the later update wins, per the clarification of 2026-09-14 — and the response carries the identity the user now has.
4. **Given** the administrator's correction moved the user's email address, **When** the user submits the form they opened on the former address, **Then** the submission is refused for want of the current password, the form presents the address as it now stands and says it was changed by an administrator, and nothing the user typed elsewhere is lost.

---

### User Story 6 - Change My Own Password (Priority: P1)

A signed-in active user replaces their own password from the same page as their identity, proving
they hold the current one, so that a credential they no longer trust stops working without an
administrator having to intervene.

**Why this priority**: Today a user who suspects their password is known to someone else can do
nothing about it themselves: only an administrator's password reset produces a new one, and it goes
through a renewal the user did not choose. Added to this slice on 2026-09-14, with the page that
carries it.

**Independent Test**: Sign in, open the profile page, submit a new password with the current one, and
verify that the next sign-in works with the new password and not the former one, that the session in
use stays open, and that a connection left remembered on another browser no longer restores access.

**Acceptance Scenarios**:

1. **Given** an active user is on their profile page, **When** they submit a new password together with their current one, **Then** the password is replaced, they stay signed in where they are, and the next sign-in works with the new password only.
2. **Given** the current password submitted is wrong or missing, **When** the change is submitted, **Then** it is refused, nothing is written, and the reason names the current password.
3. **Given** the new password is the one already in use, **When** the change is submitted, **Then** it is refused as changing nothing.
4. **Given** the new password is shorter than the rule the application applies elsewhere, or its confirmation does not match, **When** the change is submitted, **Then** it is refused on the field at fault, and nothing is written.
5. **Given** the user had connections remembered on other browsers, **When** the change is applied, **Then** those connections no longer restore access, while the connection the change was performed from still does.
6. **Given** a user owes a password renewal, **When** they reach for this change, **Then** they are refused and sent to the renewal, which asks for no current password.

### Edge Cases

- A user whose access status changes while the identity form is open — deactivated by an administrator, for instance — MUST NOT be updated; the outcome MUST reflect their current state.
- A password change MUST NOT be applied on the strength of an open session alone: the current password MUST be presented and verified every time.
- A password verified before the write MUST still be the stored one when the write lands; if it moved in between — another tab, or an administrator's reset — the change MUST be refused rather than applied over it.
- A password renewal falling due between the gate's read and the write MUST refuse the change, exactly as a deactivation does.
- Neither the current nor the new password MUST ever be stored in the clear, returned in a response, logged, or kept in the form once the submission is over.
- A refused password change MUST leave every remembered connection standing: only an applied one revokes.
- A self-service update and an organization admin's correction of the same user arriving concurrently MUST NOT interleave into a mixed identity: the last accepted update MUST be applied whole, and it replaces the earlier one rather than being refused (clarified 2026-09-14). The address is the exception: moving it always requires the current password, so an address an administrator has just corrected cannot be put back by a form opened before it.
- Updating one's own email address MUST NOT sign the user out, and MUST NOT affect their other sessions, remembered connections, password, or password renewal requirement.
- After an email change, sign-in MUST accept the new address and MUST reject the former one exactly as it rejects an unknown address.
- An email address freed by a self-service change MUST become usable for another user, and an address released and re-taken MUST NOT resurrect the previous holder's record.
- An organization admin who changes their own identity MUST be named with the new identity wherever they appear as the responsible administrator of a recorded lifecycle event, since the event resolves the administrator's current identity.
- The current password MUST be checked before any other verdict on a changed address is given, so that the self-service path cannot be used to learn which addresses other users hold without knowing the signed-in user's password.
- The current password MUST NOT be stored, returned, logged, or kept in the form after a submission that did not apply the change; it MUST be re-entered for each attempt.
- A current password is required only when the address changes as compared without regard to letter case or surrounding whitespace; a re-cased address is applied as typed without one.
- Identity values MUST be stored and presented as entered apart from insignificant surrounding whitespace: capitalization, accents, apostrophes, hyphens, and non-Latin characters MUST survive an update unchanged.
- Credentials other than the current password, activation links, and session or remember-me tokens MUST NOT be exposed or accepted by any part of this feature.
- An update MUST NOT be applied partially: either every submitted part of the identity is applied, or none is.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let every signed-in active user — organization admin, operations admin, operations lead, or observer — change their own identifying information.
- **FR-002**: The identity subject to this feature MUST be exactly the user's first name, last name, and email address, as in GH-24. No other attribute of the user MUST be changeable through this feature.
- **FR-003**: The self-service update MUST only ever apply to the signed-in user. No input to it MUST be able to direct it at another user.
- **FR-004**: The system MUST deny self-service updates to unauthenticated visitors, to any user whose access status is not active, and to a user whose password renewal is still required.
- **FR-005**: The API MUST be the authoritative authorization boundary: the profile page MUST NOT offer, optimistically apply, or cache a change the API would refuse.
- **FR-006**: The system MUST validate a self-service identity by the rules GH-24 established: a non-blank first name and last name within the stored length, a well-formed email address within the stored length, and an email address unique across the organization, compared without regard to letter case or surrounding whitespace and whatever the access status of the user already holding it.
- **FR-007**: The system MUST require the user's current password for a submission whose email address differs from the stored one, compared as in FR-006, and MUST refuse the whole submission when that password is missing or incorrect, naming the current password as the field at fault.
- **FR-008**: The system MUST NOT require the current password for a submission that leaves the email address unchanged as compared in FR-006.
- **FR-009**: The system MUST verify the current password before reporting whether a changed address conflicts with another user's.
- **FR-010**: The system MUST NOT store, return, or record the current password submitted with an update, and MUST NOT accept any other credential or token through this feature.
- **FR-011**: The system MUST apply an accepted update atomically and MUST leave the user's role, access status, recorded lifecycle events, credentials, password renewal requirement, sessions, and remembered connections untouched.
- **FR-012**: After an accepted email change, sign-in MUST use the new address; the former address MUST no longer sign the user in.
- **FR-013**: A refused update MUST change nothing and MUST name the part of the submission at fault so the user can correct it.
- **FR-014**: A submission identical to the stored identity MUST succeed without writing anything.
- **FR-015**: The profile page MUST be offered from the signed-in user's menu, in the entry reserved for it and previously shown as coming soon, to every active user. It MUST pre-fill the identity with the user's current one and MUST allow abandoning a change without applying it.
- **FR-016**: The profile page MUST ask for the current password once the email address in the form differs from the stored one, and only then.
- **FR-017**: The profile page MUST present the outcome of every change unambiguously — applied, refused with the reason, or failed and retryable — and MUST never present a refused or failed update as applied.
- **FR-018**: The profile page MUST show the updated identity in the signed-in user's menu and anywhere else the user is named, without requiring a new sign-in or a manual reload.
- **FR-019**: The profile page MUST preserve the identity the user typed across a refusal or a retryable failure, and MUST require the current password to be re-entered for every new attempt.
- **FR-020**: This feature MUST NOT provide confirmation of the new mailbox, notification of the former address, correction of another user's identity, role change, any access status change, or an identity change history.
- **FR-021**: The system MUST let every signed-in active user replace their own password, and MUST require the password currently in use to be presented with it.
- **FR-022**: The system MUST refuse a password change whose current password is missing or incorrect, naming that field, and MUST write nothing.
- **FR-023**: The system MUST refuse a new password identical to the one in use, as a change that changes nothing.
- **FR-024**: A new password MUST meet the rule the application already applies wherever a user chooses one — at a password renewal and at an invitation acceptance — and MUST be confirmed by a second entry that matches.
- **FR-025**: An applied password change MUST keep the connection it was performed from and MUST revoke every other remembered connection of that user, so that no credential established under the replaced password still restores access.
- **FR-026**: An applied password change MUST leave the user's identity, role, access status, lifecycle events, and password renewal requirement untouched, and MUST NOT sign the user out.
- **FR-027**: The password change MUST be refused to a user who owes a password renewal, who clears it through the renewal instead; the renewal MUST keep asking for no current password.

### Key Entities

- **User**: A person holding access to the operating organization. Carries the identity this feature updates, exactly one role, and exactly one access status.
- **User Identity**: The identifying information of a user — first name, last name, and email address — distinct from their role, access status, and credentials. The email address is unique across the organization and is the sign-in identifier.
- **User Identity Update**: The act of changing a user's identifying information; here performed by the user themselves. Only the updated identity is kept; no history of the change is retained by this feature.
- **Profile**: What a user manages about themselves — their identity and their password — and the name of the page that carries both. Not an action: the actions keep their own names.
- **Current Password**: The password the signed-in user already holds, re-entered to confirm a change of their email address or of the password itself. It is verified, never kept.
- **Password Change**: The act of replacing one's own password, having presented the current one. Distinct from a password renewal, which an administrator's reset imposes and which asks for no current password.
- **Remembered Connection**: A connection that restores access on one browser without a password. A password change keeps the one it was performed from and ends the others.
- **Signed-in User**: The active user whose session carries the request, and the only user this feature can change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all authorization tests, every active role updates its own identity, while unauthenticated visitors, non-active users, and users whose password renewal is still required obtain no change, and no self-service request ever changes a user other than the one signed in.
- **SC-002**: In all email-change tests, a different address submitted without the correct current password is refused and leaves the stored identity unchanged, and one submitted with it is applied, after which sign-in succeeds with the new address and fails with the former one.
- **SC-003**: In all validation tests — blank, over-long, malformed, duplicate, and case- or whitespace-variant values — the update is refused, the stored identity is unchanged, and the reported reason names the part of the submission at fault; no refusal given before the password is verified reveals whether an address is held by another user.
- **SC-004**: 100% of accepted updates are visible to the user in their own session without a further navigation step or a new sign-in, and 95% of them are confirmed within 2 seconds under normal operating conditions.
- **SC-005**: In all concurrency tests, a self-service update and an administrator's correction of the same user leave one complete identity, never a mix of the two; the later update replaces the earlier one, and an address an administrator moved is never restored without the user's current password (amended 2026-09-14).
- **SC-006**: In acceptance testing, a user updates their own name within 3 interactions of opening the signed-in user's menu, and no test run leaves a failed update presented as applied.
- **SC-007**: In all password-change tests, a submission without the correct current password, one repeating the password in use, one too short, and one whose confirmation differs are each refused with nothing written; an accepted one is followed by a sign-in that works with the new password and fails with the former, by a session that stayed open, and by remembered connections revoked everywhere but where the change was made.

## Dependencies

- Blocked by GH-24 — Update Another User Identity — which is delivered: it defines the identity, its
  validation, and its atomic update, which this slice reuses under a self-service authorization
  path. GH-24 also refuses an administrator's correction of themselves and directs
  them here.
- Sign-in restricted to active users and the password renewal gate are delivered by the user access
  status foundation; this slice relies on both to close the path to anyone without an active,
  fully established session.
- The signed-in user's menu, with the entry reserved for this feature, is delivered by the
  authenticated shell.
- GH-118 — Confirm self-service email changes — depends on this slice and adds the confirmation of
  the new mailbox that this slice deliberately leaves out.

## Out of Scope

- Confirming the new mailbox before or after an email change, and notifying the former address —
  GH-118 (clarified 2026-09-11).
- Correcting another user's identity — GH-24.
- Password renewal, which an administrator's reset or a reactivation imposes, and the password reset
  itself. Changing one's own password joined this slice on 2026-09-14 (see Clarifications) and is
  covered by US6; the renewal keeps its own screen and asks for no current password.
- Any second factor, password strength meter, breach check, or history of past passwords.
- Notifying a user, by any channel, that their password was changed.
- Role change, and every access status change.
- Signing out other sessions or remembered connections after an email change.
- Throttling repeated incorrect password attempts; sign-in carries no such throttling either.
- Detecting that a form was opened on an identity that has since changed, and refusing it on that
  ground. GH-24 carries no such check either (clarified 2026-09-14).
- A history of identity updates — who changed an identity, when, and from what — deferred with
  GH-24's former US4.
- Any additional profile attribute: a display name, an avatar, a phone number, or preferences.
- Offering the self-service update from the organization admin's own row in the user collection;
  that row keeps offering no identity correction, as GH-24 delivered it.

## Assumptions

- "Active user" follows `CONTEXT.md`: a user whose access status is active, whatever their role.
  Pending, deactivated, and cancelled users cannot sign in and so never reach this feature.
- A user whose password renewal is required is active but has not finished establishing their
  session; they renew their password first, as for every other business action.
- The operating organization manages exactly one site, per ADR 0003, so address uniqueness is
  organization-wide and colleagues' addresses are not secret from one another; FR-009 prevents the
  self-service path from being used to probe them without the signed-in user's password, not from
  the legitimate user themselves.
- The current password is the same credential sign-in verifies; no separate confirmation code or
  second factor is introduced.
- An email change is applied immediately once the password is verified; a user who mistypes their
  new address can still correct it within the same session, or have an organization admin correct
  it through GH-24.
- Names are free text: the feature validates presence and length, not the plausibility or the script
  of a person's name.
- An update is an ordinary act on one's own record and does not require a justification comment.
- The label of the menu entry follows the domain vocabulary, which avoids "profile update"; its exact
  wording is settled at planning time.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/25
- Parent roadmap: specs/user-administration/user-identity-update/roadmap.md
- Absorbed scope: the self-service half of "Update User Identity From the Web Workbench", a
  frontend-only slice split between GH-24 and GH-25 on 2026-09-10 and deleted from GitHub.
- Blockers: recorded as GitHub issue dependencies on the source issue.
- Domain vocabulary: CONTEXT.md (User Identity Update, Organization Admin, Operations Admin,
  Operations Lead, Observer, User Access Status, Login)
- Related decisions: docs/adr/0003-single-site-without-tenant-isolation.md,
  docs/adr/0005-tuyau-api-web-contract.md,
  docs/adr/0008-vertical-slice-web-frontend-with-explicit-ui-adapters.md
