# Feature Specification: Accept an Invitation and Open an Authenticated Session

**Feature Branch**: `whazzark/accept-an-invitation-and-open-an-authenticated-s`

**Created**: 2026-07-09

**Last Updated**: 2026-09-11

**Status**: Draft

**Input**: User description: "Accept an Invitation and Open an Authenticated Session — Let an invited person follow their confidential activation link, choose their initial password, and land in the application signed in. https://github.com/whazzark/portflow-ai/issues/8"

**Feature ID**: `GH-8`

**GitHub Issue**: [#8](https://github.com/whazzark/portflow-ai/issues/8)

**Parent Roadmap**: `specs/user-administration/invitation-onboarding/roadmap.md`

**Roadmap Entry**: `GH-8`

**Priority**: priority:P1

**Milestone**: 0. Sécuriser l'administration des utilisateurs

**Domain**: user-administration

> Vertical slice: this specification owns both the acceptance command in `apps/api` and the
> activation screen in `apps/web`. It absorbs the acceptance half of the former frontend-only slice
> "Invite and Accept an Invitation Through the Frontend"; the invitation half belongs to GH-7.

## Clarifications

### Session 2026-09-11

- Q: What happens when an activation link is opened in a browser that already holds an authenticated session? → A: The acceptance is refused at the API while the session is open; the screen names the signed-in user and offers to sign out and continue on the same link
- Q: Which session does a successful acceptance open? → A: A temporary session only; the activation screen offers no remembering choice, which the user can make at a later sign-in
- Q: Does the unusable-link outcome distinguish why a link can no longer be used? → A: No; one identical outcome for every reason, pointing both to signing in and to asking an organization admin for a new link
- Q: What does the activation screen show about the pending user before the password is chosen? → A: Their first name, last name, and email
- Q: Implementation found that the API's request parsing trims surrounding spaces from every submitted string, passwords included, at login and at password renewal alike. Should FR-005's "never trimmed" stand? → A: No; amend the spec to accept the consistent trimming. A password's surrounding spaces are removed at acceptance exactly as they are at login, so nobody is locked out

## User Scenarios & Testing *(mandatory)*

GH-7 lets an organization admin invite a person: the organization gains a pending user who holds no
password, and the admin receives a confidential activation link, shown once, which they pass on
through a channel of their choosing. Until this slice ships, that link leads nowhere, and a pending
user can never become an active one. This slice completes the onboarding. The invited person opens
their link, chooses their own initial password, and lands in the application already signed in.
Nobody ever chooses a password on their behalf, and they never need a separate first sign-in.

The actor is the invited person. They are not signed in and hold no password yet. Holding the
activation link is the only proof they present, and it proves they are the person the
administrator meant to invite.

### User Story 1 - Activate One's Access and Land in the Application Signed In (Priority: P1)

An invited person opens the activation link they received. The screen shows whose access the link
activates, and the person chooses their initial password. Their access becomes active and they land
in the application, signed in, with the permissions of the role they were invited with.

**Why this priority**: It is the whole outcome of the slice. Without it every invitation ends in a
pending user nobody can ever activate, and access can still only exist through seeding.

**Independent Test**: Invite a person as an organization admin and capture the activation link.
In a browser holding no session, open the link, choose a valid password, and verify three things:
the browser lands in the application signed in as the invited user with their role's permissions,
the user is now active with a dated activation event, and the chosen password signs them in again
after they sign out.

**Acceptance Scenarios**:

1. **Given** a pending user holds a usable activation link, **When** the invited person opens it in a browser holding no session, **Then** the activation screen shows the first name, last name, and email of the access being activated, and offers a password field and a confirmation field.
2. **Given** the activation screen is open for a usable link, **When** the person submits a valid password and a matching confirmation, **Then** the user's access status becomes active, the chosen password becomes their password, and an activation event is recorded, dated and attributed to the user themselves.
3. **Given** an acceptance succeeds, **When** the outcome is returned, **Then** the browser holds an authenticated temporary session for the activated user, with no remembered connection, and lands where a sign-in lands, with the navigation and permissions of the user's role, without any separate sign-in.
4. **Given** an acceptance succeeded, **When** the user signs out and then signs in with their email and the password they chose, **Then** the sign-in succeeds like any active user's.
5. **Given** an acceptance succeeded, **When** an organization admin consults the user collection, **Then** the user appears as active and no longer as pending, their access record shows the activation event next to the unchanged invitation event, and their identity, email, and role are unchanged.
6. **Given** an acceptance succeeded, **When** the same activation link is opened again, **Then** it no longer permits acceptance and follows the unusable-link outcome of User Story 2.

---

### User Story 2 - Refuse an Activation Link That Can No Longer Be Used (Priority: P1)

A person who opens an activation link that is unknown, expired, already used, or whose pending user
no longer awaits activation is told that the link cannot be used and what to do next. Nothing is
changed, and nothing about any user is disclosed.

**Why this priority**: The activation link is a credential-bearing path into the application. If an
unusable link still sets a password or reveals an identity, that is a direct security defect.

**Independent Test**: Open, then submit a password through, each of these links in turn: a link
that was never issued, a malformed one, one past its 7-day validity, one already used for an
acceptance, and one whose user is no longer pending. Verify that every attempt meets the same
unusable-link outcome, that no password is recorded and no access status changes, and that the
screen reveals no name or email.

**Acceptance Scenarios**:

1. **Given** a link that was never issued or is malformed, **When** it is opened or submitted, **Then** the unusable-link outcome is presented, and no identity is disclosed.
2. **Given** a link more than 7 days past its issuance, **When** it is opened or submitted, **Then** the unusable-link outcome is presented, the pending user stays pending and holds no password, and the link remains recoverable through an activation link renewal.
3. **Given** a link already used for a successful acceptance, **When** it is opened or submitted, **Then** the unusable-link outcome is presented, and the active user's password, session state, and lifecycle events are unchanged.
4. **Given** a link whose user is no longer pending, whatever the reason, **When** it is opened or submitted, **Then** the unusable-link outcome is presented and that user is left unchanged.
5. **Given** the activation screen was opened while its link was still usable, **When** the link expires or stops being usable before the password is submitted, **Then** the submission is refused with the unusable-link outcome and no password is recorded.
6. **Given** any unusable link, **When** the outcome is presented, **Then** it is the same whatever the reason, and it points to both next steps: signing in for a person who already activated their access, or asking an organization admin for a new link otherwise.

---

### User Story 3 - Choose a Trustworthy Initial Password (Priority: P2)

The invited person's initial password must meet the password rule the application already enforces
when a user renews their password. That way no account starts its life with a weaker credential
than a renewed one.

**Why this priority**: A weak or mistyped initial password is the credential the whole access then
rests on. That only matters once acceptance works at all.

**Independent Test**: On a usable link, submit a password that is too short, too long, empty, or
mismatched with its confirmation, and one that carries surrounding spaces. Verify which submissions
are refused with a field-level reason, that a refused one leaves the user pending with the link still
usable, and that a space-padded password logs in exactly as it would anywhere else in the application.

**Acceptance Scenarios**:

1. **Given** a usable link, **When** the submitted password is empty, shorter than 12 characters, or longer than 128 characters, **Then** the acceptance is refused with a specific, field-level reason, and the user stays pending with the link still usable.
2. **Given** a usable link, **When** the confirmation does not match the password, **Then** the acceptance is refused with a reason attached to the confirmation, and the user stays pending with the link still usable.
3. **Given** a usable link, **When** a valid password carrying leading or trailing spaces is accepted, **Then** its surrounding spaces are removed exactly as at login, so signing in succeeds with or without them.
4. **Given** a refusal for an invalid password, **When** the person corrects the password and submits it again from the same screen, **Then** the acceptance succeeds without the link being reopened.

---

### User Story 4 - Never Complete an Acceptance From Someone Else's Session (Priority: P2)

A browser that already holds an authenticated session — typically the inviting administrator testing
the link they just copied — cannot complete an acceptance. The activation screen names the user
signed in on that browser and offers to sign out and continue on the same link. That way an
administrator never chooses a password for an invited person by mistake, and no open session is
ended without its owner's action.

**Why this priority**: Accepting from the wrong session would let someone other than the invited
person choose the password, which the invitation model exists to prevent. The main flow still
delivers its value without this guard.

**Independent Test**: Sign in as an organization admin, open a usable activation link in that same
browser, and verify three things: the password form is not offered, the screen names the signed-in
admin, and an acceptance submitted anyway is refused without consuming the link. Then sign out from
the screen and verify that the activation screen for the same link is offered and completes.

**Acceptance Scenarios**:

1. **Given** a browser holds an authenticated session, including one confined to a password renewal, **When** a usable activation link is opened in it, **Then** the activation screen shows whose access the link activates, names the signed-in user, does not offer the password form, and offers to sign out and continue.
2. **Given** a browser holds an authenticated session, **When** an acceptance is submitted from it, **Then** the API refuses it, records no password, leaves the user pending with the link still usable, and leaves the open session untouched.
3. **Given** the screen offered to sign out and continue, **When** the signed-in user chooses it, **Then** that browser's session ends as a regular sign-out would end it, and the activation screen for the same link is presented, ready to accept.
4. **Given** a browser holds an authenticated session, **When** an unusable link is opened in it, **Then** the unusable-link outcome is presented and the open session is left untouched.

---

### User Story 5 - Recover From a Failed Acceptance Without a Half-Activated Access (Priority: P3)

An invited person whose acceptance fails receives a clear, actionable outcome and can retry without
risking half-activated access. Activation, password, and link consumption happen together or not at
all.

**Why this priority**: The failure path keeps the organization's access trustworthy after a transient
problem, but the slice delivers its value without it.

**Independent Test**: Make an acceptance fail after submission, and verify that the user is still
pending, holds no password, and that the link is still usable. Retry once the problem is resolved,
and verify that a single acceptance results. Submit the same acceptance twice concurrently and
verify that exactly one succeeds.

**Acceptance Scenarios**:

1. **Given** an acceptance cannot be completed, **When** the failure is returned, **Then** the user is still pending, holds no password, has no activation event, and keeps a usable link, and the failure is presented as retryable rather than as a validation refusal or an unusable link.
2. **Given** a retryable failure was shown, **When** the person retries from the same screen after the problem is resolved, **Then** exactly one acceptance is recorded.
3. **Given** the same link is submitted twice, concurrently or in quick succession, **When** both are processed, **Then** exactly one acceptance is recorded with exactly one password and one activation event, and the other attempt meets the unusable-link outcome.
4. **Given** the activation was recorded but the session could not be opened, **When** the outcome is returned, **Then** the user stays active with the password they chose, and the person is told their access is active and directed to sign in with it.

### Edge Cases

- Opening the activation screen changes nothing. The link can be opened, left, and reopened any number of times while it stays usable, and only a successful acceptance ends its usefulness.
- A pending user cannot sign in before acceptance. A sign-in attempt with their email keeps the sign-in outcome that is indistinguishable from invalid credentials.
- The activation screen shows the identity as currently recorded, not as recorded at invitation. The user is activated with their current identity, email, and role.
- An acceptance does not depend on the inviting administrator: it succeeds even if that administrator has since been deactivated or had their role changed.
- The activation secret never leaves the activation screen through application logs, error reports, or navigation to another site. After a successful acceptance the browser no longer displays the link.
- An activated user holds no password renewal requirement: the password they just chose is not one someone else knows.
- A link replaced by an activation link renewal (GH-9) or ended by an invitation cancellation (GH-12) is unusable under the rule of User Story 2, whichever slice ships first.
- Once activated, the user's access follows the ordinary rules: signing out, signing in with or without a remembered connection, and the consultation rules of the user collection.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let the holder of a usable activation link open an activation screen that shows the first name, last name, and email of the pending user the link activates.
- **FR-002**: Opening the activation screen MUST NOT change any state. It MUST NOT consume the link, change the access status, record an event, or end any session.
- **FR-003**: The system MUST let the holder of a usable activation link accept the invitation by submitting a password together with a matching confirmation, with no other credential and no prior sign-in.
- **FR-004**: The system MUST refuse an initial password that is empty, shorter than 12 characters, longer than 128 characters, or different from its confirmation, each with its own field-level, actionable reason. The rule MUST be the one enforced for a password renewal.
- **FR-005**: The system MUST treat a submitted password exactly as login treats it: its surrounding spaces are removed, as they are for every submitted value, and it MUST NOT be otherwise altered. The system MUST NOT disclose a submitted password back in plain form.
- **FR-006**: A successful acceptance MUST, as one indivisible change: record the chosen password as the user's password, make the user's access status active, record the activation as a dated access status change attributed to the user themselves, and make the activation link unusable from then on.
- **FR-007**: A successful acceptance MUST leave the user's identity, email, role, and invitation event unchanged, and MUST NOT record a password renewal requirement.
- **FR-008**: A successful acceptance MUST open an authenticated temporary session for the activated user in the browser it was performed from, and MUST land that browser where a sign-in lands, with the navigation and permissions of the user's role and no separate sign-in.
- **FR-009**: After a successful acceptance, the user MUST be able to sign in with their email and the chosen password exactly like any other active user.
- **FR-010**: The system MUST treat as unusable an activation link that was never issued, is malformed, is more than 7 days past its issuance, was already used for an acceptance, has been replaced, or belongs to a user who is no longer pending.
- **FR-011**: The system MUST refuse to open or accept through an unusable link, and MUST check the link's usability again when the acceptance is submitted, not only when the screen is opened.
- **FR-012**: The unusable-link outcome MUST be identical whatever the reason. It MUST disclose no identity, email, or access status, MUST change no state, and MUST point both to signing in and to asking an organization admin for a new link.
- **FR-013**: An expired link MUST leave its pending user pending, with no password, and recoverable through an activation link renewal.
- **FR-014**: The system MUST refuse an acceptance submitted from a browser that holds an authenticated session, including one confined to a password renewal. The refusal MUST record no password, leave the user pending with the link still usable, and leave the open session untouched.
- **FR-015**: When a usable link is opened in a browser that holds an authenticated session, the activation screen MUST name the signed-in user and MUST NOT offer the password form. It MUST offer to sign out and continue, which ends that session as a regular sign-out would and then presents the activation screen for the same link.
- **FR-016**: The API MUST be the authoritative boundary for every rule of this slice. The activation screen withholding an action MUST NOT be what prevents it.
- **FR-017**: A refused or failed acceptance MUST record no password, change no access status, record no event, and leave a usable link usable.
- **FR-018**: Concurrent or repeated acceptances through the same link MUST result in exactly one acceptance, with one recorded password and one activation event. The other attempts MUST meet the unusable-link outcome.
- **FR-019**: If the activation is recorded but the session cannot be opened, the user MUST remain active with the chosen password, and the person MUST be told their access is active and directed to sign in.
- **FR-020**: The activation secret MUST NOT be recorded in application logs or error reports, MUST NOT be returned by any response, and MUST NOT be passed to another site. After a successful acceptance the browser MUST no longer display the activation link.
- **FR-021**: The activation screen MUST distinguish a password validation refusal, the unusable-link outcome, the refusal from a signed-in browser, and a retryable failure. After any refusal other than the unusable-link outcome, it MUST let the person retry without reopening the link.
- **FR-022**: This feature MUST NOT change the sign-in rule for pending users: sign-in stays refused for them, with the outcome indistinguishable from invalid credentials.
- **FR-023**: This feature MUST NOT provide invitation, activation link renewal, invitation cancellation or restoration, email delivery of the link, a remembered connection at acceptance, identity correction by the invited person, or a forgotten-password recovery flow.

### Key Entities

- **Pending User**: A user whose access has been invited but not activated yet. Holds no password, cannot sign in, and is the only kind of user this feature acts on.
- **User Activation Link**: The confidential, unguessable, time-bounded link GH-7 issues for exactly one pending user. It is usable until it is used for an acceptance, expires 7 days after issuance, or is replaced, and it is the only proof the invited person presents.
- **User Invitation Acceptance**: The action by which a pending user activates their access by choosing their initial password. It is the action this feature delivers.
- **User Access Status Change**: A dated change of a user's access status, optionally attributed to the user who caused it. This feature records exactly one per successful acceptance, the activation event, attributed to the activated user themselves.
- **User Access Status**: Moves from pending to active through a successful acceptance, and through nothing else in this feature.
- **Temporary Session**: The authenticated session a successful acceptance opens. It ends when the user closes their browser.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful acceptances produce exactly one active user, one recorded password, one activation event attributed to that user, and one open session, and leave the link unusable.
- **SC-002**: In all unusable-link tests (never issued, malformed, expired, already used, replaced, and user no longer pending), no password is recorded, no access status changes, and no identity or email is disclosed.
- **SC-003**: In all signed-in-browser tests, no acceptance completes, the link stays usable, and the open session is unchanged.
- **SC-004**: In all concurrent and repeated-submission tests, at most one acceptance is recorded per link, and no failure leaves a user active without a password or a link consumed without an activation.
- **SC-005**: An invited person goes from opening their link to working in the application in under 1 minute, without a separate sign-in.
- **SC-006**: In all activation tests, the activation secret appears in no application log, error report, or response.
- **SC-007**: 100% of activated users sign in successfully with their chosen password after signing out.
- **SC-008**: 95% of acceptances return their outcome within 2 seconds under normal operating conditions.

## Dependencies

- GH-7 — Invite a Pending User with a Confidential Activation Link: supplies the pending user, the activation link, its 7-day validity, and the rule that only a non-reversible form of the secret is retained. It is delivered.
- GH-2 — Persist User Access Status and Lifecycle Metadata: supplies the active access status and the dated, attributed activation event this feature records.
- GH-3 — Restrict Login to Active Users: keeps a pending user unable to sign in, and lets the activated user sign in afterwards.
- Force a Password Change After Login: supplies the password rule reused here and the confinement that FR-014 treats as an open session.
- Authenticate the Web Shell Against the API Session: supplies the authenticated session, the landing a sign-in reaches, and sign-out.
- GH-4 — Browse and Filter the User List: supplies the user collection in which the activated user moves from pending to active.
- Deliverable in parallel with GH-9: neither blocks the other. GH-9 replaces a link; this slice honours the replacement through FR-010.

## Out of Scope

- Inviting a person and issuing the activation link (GH-7).
- Renewing an activation link (GH-9), which is also how an expired or lost link is recovered.
- Cancelling (GH-12), restoring (GH-13), and permanently removing (GH-14) an invitation or a never-activated user. This slice only guarantees that a link whose user is no longer pending is unusable.
- Delivering the activation link by email, which is the standalone "Send invitation emails" slice.
- Offering a remembered connection at acceptance. The activated user chooses it at a later sign-in.
- Letting the invited person correct their identity or email during acceptance. That is a User Identity Update.
- A forgotten-password recovery flow, password strength meters, multi-factor authentication, and password expiry.
- Rate limiting or throttling of acceptance attempts. The link's secret cannot be guessed, and any such protection is a cross-cutting decision taken outside this slice, as GH-7 decided for invitation.
- Notifying the inviting administrator that an invitation was accepted.

## Assumptions

- The invited person is the only actor. Holding the activation link is the proof GH-7 designed it to be, so acceptance requires no other credential, and an unguessable, time-bounded, single-purpose link is the protection.
- The activation screen shows the pending user's name and email so the person can confirm the link is theirs before choosing a password, and so a password manager can store the credential against the right email. Showing them to the link's holder discloses nothing the link was not already meant to grant.
- The initial password follows the rule already enforced for a password renewal: at least 12 and at most 128 characters, no composition rules, and surrounding spaces removed as they are at login and at renewal, so the same typed password works at every entry point. There is no previous password, so the renewal's "must differ from the current password" refusal has no counterpart here.
- The acceptance opens a temporary session rather than offering the remembering choice of the sign-in screen. The first activation may happen on a shared operations terminal, and ending with the browser is the safer default. The user can choose a remembered connection at their next sign-in.
- The session opened at acceptance lands where a sign-in lands, so an activated user enters the application exactly as they will every day afterwards.
- The unusable-link outcome is deliberately uniform. Separating "expired" from "already used" or "cancelled" would tell anyone holding a stale link — a forwarded message, a chat history — what became of the access. Both possible next steps fit in one message.
- A browser holding a session cannot accept, rather than having that session silently replaced. The likely case is the inviting administrator opening the link they just copied, and completing it would let them choose the invited person's password. Signing out stays one explicit action away.
- The activation event is attributed to the activated user themselves. `CONTEXT.md` allows an access status change to be optionally attributed to the user who caused it, and the invited person causes their own activation.
- A successful acceptance makes the link unusable for good. GH-7 records that the link is single-use in intent and that ending its usefulness belongs to the slice performing the action, which here is acceptance.
- The 7-day validity is decided and issued by GH-7. This slice enforces it when the link is opened and again when it is submitted.
- The activation screen is a public screen reached at the link's address, presented on the same surface as the sign-in screen, and needs no application navigation.
- Each operating organization owns exactly one site, so an activated user's scope is their organization with no site choice.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/8
- Parent roadmap: specs/user-administration/invitation-onboarding/roadmap.md
- Absorbed scope: the acceptance half of "Invite and Accept an Invitation Through the Frontend", a frontend-only slice split between GH-7 and GH-8 on 2026-09-10 and deleted from GitHub.
- Blockers: recorded as GitHub issue dependencies on the source issue. GH-7, the only direct blocker, is delivered.
- Domain vocabulary: CONTEXT.md (User Invitation Acceptance, Pending User, User Activation Link, User Activation Link Renewal, User Access Status, User Access Status Change, Login, Temporary Session, Remembered Connection, Password Renewal)
- Related slices: GH-7 (invitation), GH-9 (link renewal), GH-12 (cancellation), GH-13 (restoration), GH-14 (permanent removal), standalone "Send invitation emails".
