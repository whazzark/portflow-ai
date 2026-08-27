# Feature Specification: Force a Password Change After Login

**Feature Branch**: `feat/117-user-password-change-login`

**Created**: 2026-08-26

**Status**: Draft

**Input**: User description: "Force a Password Change After Login — an active user whose access requires a new password authenticates normally but reaches nothing but a password renewal step until they have chosen one. https://github.com/whazzark/portflow-ai/issues/117"

**Feature ID**: `GH-117`

**GitHub Issue**: [#117](https://github.com/whazzark/portflow-ai/issues/117)

**Parent Roadmap**: `specs/authenticated-shell/authenticated-shell/roadmap.md`

**Roadmap Entry**: `GH-117`

**Milestone**: Authenticated Shell (transversal)

**Domain**: authenticated-shell

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Renew a Required Password and Reach the Application (Priority: P1)

As an active user whose access has been marked as requiring a new password — because an organization administrator reset it, or because my access was reactivated after a deactivation — I want to be taken straight to a password renewal step when I sign in, and to reach the application as soon as I have chosen a new password, so that the credential I was handed is replaced by one only I know before I do any work.

**Why this priority**: This is the entire point of the slice. `Password Reset` and `User Reactivation` are both defined in `CONTEXT.md` as actions that *require* a user to choose a new password, but nothing in the authenticated shell makes that requirement effective today: a user handed a replacement credential can sign in and work indefinitely without ever changing it. Without the renewal step, the requirement is a stored intention with no observable consequence, and the two upstream slices that produce it cannot deliver their stated outcome.

**Independent Test**: Sign in as an active user carrying a password renewal requirement, verify the renewal step is presented instead of the application, choose a valid new password, and verify the requirement is cleared, the application frame and navigation become reachable in the same session without signing in again, and the next sign-in with the new password goes straight to the application.

**Acceptance Scenarios**:

1. **Given** an active user carrying a password renewal requirement, **When** they sign in with valid credentials, **Then** the sign-in succeeds, an authenticated session is opened, and the password renewal step is presented instead of the application frame.
2. **Given** the renewal step is presented, **When** the user submits a new password that satisfies the password rules together with a matching confirmation, **Then** the new password is recorded, the renewal requirement is cleared, and the user reaches the application frame in the same session without being asked to sign in again.
3. **Given** a user has renewed their password, **When** they sign out and sign in again with the new password, **Then** they reach the application frame directly and the renewal step is not presented.
4. **Given** a user has renewed their password, **When** they attempt to sign in with the password they were required to replace, **Then** the attempt is rejected exactly as any other invalid credential is rejected.
5. **Given** an active user carrying no renewal requirement, **When** they sign in with valid credentials, **Then** they reach the application frame directly and the renewal step is never presented.
6. **Given** a user is on the renewal step, **When** they consult it, **Then** it states plainly that a new password must be chosen before the application can be used, without disclosing which administrative action caused the requirement.

---

### User Story 2 - Confine the Session Until the Requirement Is Cleared (Priority: P1)

As the system, I want a session belonging to a user who owes a password renewal to reach nothing but the renewal step and the sign-out action — no application frame, no navigation, no reference data, no operational data, and no write action — whether that session was opened by a fresh sign-in or restored from a remembered connection, so that the requirement cannot be bypassed by navigating around the renewal step or by calling the application directly.

**Why this priority**: A renewal step that can be stepped around protects nothing. The requirement typically follows an administrator resetting a credential that may be known to someone else, so a session that can read customers, trucks, discharges, or users while the requirement stands defeats the reason the reset was performed. Confinement is inseparable from the renewal step and must ship with it; it is also the only requirement in this slice that must hold at the API, which is authoritative for business state and authorization.

**Independent Test**: Open a session for a user carrying a renewal requirement by fresh sign-in and again by restoring a remembered connection; from each, attempt to reach the application frame, every consultation surface, and a representative write action, both through the interface and by calling the API directly; verify every attempt other than the renewal step, the session representation, and sign-out is refused, and that nothing is disclosed or modified.

**Acceptance Scenarios**:

1. **Given** a session for a user carrying a renewal requirement, **When** the user attempts to reach the application frame or any application section, **Then** they are returned to the renewal step and no application content is shown.
2. **Given** a session for a user carrying a renewal requirement, **When** any consultation or write request other than the renewal, the session representation, and sign-out is issued directly to the API, **Then** it is refused, no business data is disclosed, and no business state is changed.
3. **Given** a remembered connection was established before the requirement was recorded, **When** the connection is restored on that browser, **Then** the restored session is confined to the renewal step exactly as a fresh sign-in is.
4. **Given** a session confined to the renewal step, **When** the user signs out, **Then** the sign-out succeeds, the session ends, and the renewal requirement remains recorded for the next sign-in.
5. **Given** a session is confined to the renewal step, **When** the session representation is consulted, **Then** it states that a password renewal is required and carries only the identity and role information already disclosed to a signed-in user.
6. **Given** a user carrying a renewal requirement is confined, **When** an unrelated user with no requirement is signed in elsewhere, **Then** that user's session is unaffected and reaches the application normally.
7. **Given** a renewal requirement is recorded for a user who already has a live session, **When** that user's next request is issued, **Then** the session becomes confined to the renewal step without the user being signed out.

---

### User Story 3 - Close the Window on the Replaced Credential (Priority: P1)

As a user renewing a password after a reset or a reactivation, I want the remembered connections held by my other browsers revoked at the moment I choose my new password, so that the credential I was told to replace stops granting access anywhere, while the browser I am renewing from stays signed in.

**Why this priority**: A remembered connection restores access for up to 30 days without presenting a password. If those connections survived the renewal, a browser that had been remembered under the replaced credential would keep working for weeks — the exact exposure the reset was performed to end. Revocation is the security consequence of the renewal itself, is invisible to the user unless it is specified, and cannot be deferred to a later slice without shipping a renewal that fails to close the window it exists to close.

**Independent Test**: Establish remembered connections for the same user on two browsers, record a renewal requirement, renew the password from the first browser, and verify the first browser stays signed in and reaches the application, the second browser's remembered connection no longer restores a session, and another user's remembered connections are untouched.

**Acceptance Scenarios**:

1. **Given** a user holds remembered connections on several browsers, **When** they renew their password on one of them, **Then** the remembered connections on the other browsers no longer restore a session and those browsers must sign in again with the new password.
2. **Given** a user renews their password on a browser, **When** they continue working on that browser, **Then** their session remains valid and they are not asked to sign in again.
3. **Given** a user renews their password on a browser where they had chosen to be remembered, **When** that browser is closed and reopened within the remembered period, **Then** access is restored normally, because the renewal does not revoke the connection it was performed from.
4. **Given** several users hold remembered connections, **When** one of them renews their password, **Then** only that user's other connections are revoked and every other user's connections are unaffected.
5. **Given** a renewal fails or is refused, **When** the user's other browsers are used, **Then** their remembered connections are still valid, because nothing was revoked.

---

### User Story 4 - Understand and Recover From a Refused Renewal (Priority: P2)

As a user on the renewal step, I want each refused submission to explain itself and leave a safe retry path so that I can tell a password that is too weak from a mismatched confirmation, a reused password, an expired session, or a temporary outage, and choose a valid password without losing access or being left unsure whether my password changed.

**Why this priority**: The renewal step stands between the user and every piece of their work, and it is the first thing they meet after being told their password was reset. An opaque refusal at that exact point leaves them locked out with no route forward and no one to ask, since the administrator who reset the credential cannot see why the renewal failed. It is a P2 because the primary outcome is already delivered by the stories above; it protects that outcome rather than creating it.

**Independent Test**: Submit in turn a password shorter than the minimum, a confirmation that does not match, the password being replaced, and a valid password during a transient failure; verify each produces distinct guidance, that the stored password is unchanged after every refusal, and that a subsequent valid submission completes the renewal exactly once.

**Acceptance Scenarios**:

1. **Given** the renewal step, **When** a new password shorter than the required minimum length is submitted, **Then** the submission is refused with a specific reason stating the minimum, the stored password is unchanged, and the requirement stands.
2. **Given** the renewal step, **When** the confirmation does not match the new password, **Then** the submission is refused with a specific mismatch reason and neither value is disclosed back to the user in plain form.
3. **Given** the renewal step, **When** the user submits the password they are required to replace, **Then** the submission is refused with a reason stating that the new password must differ from the current one, and the requirement stands.
4. **Given** the renewal step, **When** the session has expired in the meantime, **Then** the submission is refused, the user is returned to sign-in, and the requirement stands so that the renewal is presented again after the next successful sign-in.
5. **Given** a renewal fails because the underlying service is temporarily unavailable, **When** the user retries after the service recovers, **Then** the password is renewed exactly once and the requirement is cleared exactly once.
6. **Given** a renewal is submitted twice in quick succession, **When** both submissions are processed, **Then** the password is renewed exactly once and the later submission is refused or resolves to the same cleared state, never to a second password.
7. **Given** any refused renewal, **When** the user reviews the renewal step, **Then** the requirement is still shown as outstanding, no partial change has been recorded, and the step remains usable for another attempt.

### Edge Cases

- An unauthenticated visitor requests the renewal step or submits a renewal: the request is refused as unauthenticated, without revealing whether any user carries a requirement.
- A user carrying a renewal requirement is deactivated or cancelled before signing in: sign-in is rejected exactly as it is for any non-active access status, the renewal step is never reached, and the requirement stays recorded for a possible future reactivation.
- A user's access is deactivated while their session is confined to the renewal step: the next request is refused as unauthenticated and no password is recorded.
- A renewal requirement is recorded for a user who is already signed in and working: their session is confined at their next request rather than being terminated, and no work already saved is affected.
- A renewal requirement is recorded twice for the same user before they sign in: the user is required to choose one new password, not two, and one renewal clears the requirement.
- A user submits a valid renewal at almost the same moment an administrator records a fresh requirement: the outcome is unambiguous — either the requirement is cleared by the renewal, or it stands and the renewal step is presented again — and never a state where a password was recorded while the user believes it was not.
- A user carrying a requirement holds a remembered connection whose 30-day window expires while the requirement stands: the connection simply stops restoring access, and the requirement is still presented after the next sign-in.
- A user renews their password on a browser where they had not chosen to be remembered: the renewal succeeds and no remembered connection is created by it, because the renewal does not change the remembering choice made at sign-in.
- A new password containing leading or trailing whitespace is accepted as typed, because a password's surrounding whitespace is part of the secret and is never trimmed.
- A new password at exactly the minimum length is accepted; one character shorter is refused.
- A very long new password is accepted up to the supported maximum, and one beyond it is refused with a specific reason rather than being silently truncated.
- A user submits the renewal step's form with an empty new password or an empty confirmation: the submission is refused with a specific validation reason and no password is recorded.
- A user attempts to reach the sign-in screen while confined to the renewal step: they are returned to the renewal step, because they already hold a valid session.
- A user signs out from the renewal step and signs in again with the credential they were required to replace: the sign-in succeeds and the renewal step is presented again, because the requirement is cleared only by a completed renewal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST record, for each user, whether their access currently requires a new password to be chosen, as a state that is independent of their access status and of their role.
- **FR-002**: The system MUST authenticate a user carrying a password renewal requirement exactly as it authenticates any other active user, opening an authenticated session on valid credentials and rejecting invalid credentials and non-active access statuses with the unchanged, indistinguishable outcome.
- **FR-003**: The system MUST present the password renewal step, instead of the application frame and its navigation, to every session belonging to a user carrying a renewal requirement.
- **FR-004**: The system MUST apply the confinement to a session restored from a remembered connection exactly as it applies it to a session opened by a fresh sign-in.
- **FR-005**: The system MUST apply the confinement to a session that was opened before the requirement was recorded, from that session's next request onward, without terminating it.
- **FR-006**: The system MUST refuse, for a confined session, every request other than consulting the session representation, consulting and submitting the renewal, and signing out — disclosing no business data and changing no business state.
- **FR-007**: The system MUST enforce the confinement at the API, which stays authoritative; any restriction applied by the interface is a courtesy that does not replace server-side enforcement.
- **FR-008**: The session representation MUST state whether the signed-in user currently owes a password renewal, so that the interface can present the renewal step without inferring it, and MUST disclose no additional information about why the requirement exists.
- **FR-009**: The system MUST allow a confined user to choose a new password by submitting it together with a matching confirmation, and MUST NOT require them to re-enter the password they are replacing, because the session already proves they hold it.
- **FR-010**: The system MUST refuse a new password shorter than the required minimum length, longer than the supported maximum length, empty, or not matching its confirmation, each with its own specific and actionable reason.
- **FR-011**: The system MUST refuse a new password identical to the password being replaced, with a reason stating that the new password must differ from the current one.
- **FR-012**: The system MUST NOT trim, normalise, or otherwise alter a submitted password before recording it, and MUST NOT disclose a submitted password back to the user in plain form.
- **FR-013**: A successful renewal MUST record the new password as the user's password, MUST clear the renewal requirement, and MUST leave the user's identity, email, role, access status, and history unchanged.
- **FR-014**: A successful renewal MUST keep the session it was performed from valid, so the user reaches the application frame without signing in again, and MUST NOT change the remembering choice made at sign-in.
- **FR-015**: A successful renewal MUST revoke the user's remembered connections on every other browser, so that the replaced credential restores access nowhere, and MUST leave every other user's remembered connections untouched.
- **FR-016**: The system MUST ensure that repeated or concurrent renewal submissions for the same user record exactly one new password and clear the requirement exactly once.
- **FR-017**: A refused or failed renewal MUST leave the stored password and the renewal requirement exactly as they were before the attempt, with no partial change recorded and no remembered connection revoked.
- **FR-018**: The system MUST report validation failures, reused-password refusals, expired-session refusals, and transient failures with distinct, understandable, and actionable feedback, and MUST keep the renewal step usable for another attempt after any refusal.
- **FR-019**: The renewal step MUST state that a new password is required before the application can be used, MUST offer sign-out, and MUST NOT disclose which administrative action caused the requirement.
- **FR-020**: The system MUST refuse the renewal step and the renewal submission to unauthenticated requests, without revealing whether any user carries a requirement.
- **FR-021**: A user carrying no renewal requirement MUST reach the application frame directly on sign-in, with the shell's existing behaviour, navigation, and permissions unchanged by this slice.
- **FR-022**: The system MUST clear the renewal requirement only through a completed renewal; signing out, abandoning the renewal step, or signing in again MUST leave it standing.
- **FR-023**: This slice MUST NOT provide any action that records a renewal requirement for a user; recording it stays owned by Reset an Active User Password (`#17`) and Reactivate a User with Fresh Credentials (`#32`).
- **FR-024**: This slice MUST NOT provide a self-service password change for a user who owes no renewal, MUST NOT provide a forgotten-password recovery flow, and MUST NOT send any email or other notification.
- **FR-025**: This slice MUST NOT change the invitation, activation-link, deactivation, reactivation, or role-change behaviours, and MUST NOT change the sign-in, sign-out, or remembered-connection rules beyond the confinement and the revocation specified here.

### Key Entities *(include if feature involves data)*

- **User**: The person whose password is being renewed. The renewal changes only their password and their renewal requirement; identity, email, role, access status, and history are preserved.
- **Password Renewal Requirement**: The state marking that a user must choose a new password before using the application. Recorded by an administrative action outside this slice, read and enforced by it, and cleared only by a completed renewal.
- **Password Renewal**: The action by which a confined user chooses the new password the requirement demands, clearing it. It is the user-side counterpart of `Password Reset`, which is the administrator-side action of requiring it.
- **Authenticated Session**: The signed-in session opened by a login or restored from a remembered connection. While the requirement stands, it is confined to the renewal step, the session representation, and sign-out.
- **Remembered Connection**: The connection restorable on a browser for at most 30 days. It is confined like any other session while the requirement stands, and every one belonging to the user other than the one the renewal was performed from is revoked by a successful renewal.
- **Application Frame**: The protected shell and navigation delivered by Expose the Protected Application Frame and Minimal Navigation (`#116`), which the renewal step stands in front of while the requirement is outstanding.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of sign-ins by active users carrying a renewal requirement open a session and present the renewal step, and 0% reach the application frame before renewing.
- **SC-002**: In acceptance testing, 100% of valid renewals record the new password, clear the requirement, and give access to the application frame within the same session, with 0% requiring a second sign-in.
- **SC-003**: In acceptance testing, 100% of requests other than the session representation, the renewal, and sign-out that are issued from a confined session — through the interface and as direct requests bypassing it — are refused, with zero business records disclosed and zero business records modified.
- **SC-004**: In acceptance testing, 100% of sessions restored from a remembered connection for a user carrying a requirement are confined to the renewal step, matching the fresh sign-in outcome exactly.
- **SC-005**: In acceptance testing, 100% of successful renewals revoke the user's remembered connections on other browsers, 100% keep the renewing browser signed in, and 0% affect any other user's connections.
- **SC-006**: In acceptance testing, 100% of sign-in attempts using the replaced password after a renewal are rejected with the unchanged invalid-credentials outcome, and 100% of sign-ins with the new password reach the application frame directly.
- **SC-007**: In acceptance testing, 100% of refused renewals — too short, too long, empty, mismatched confirmation, reused password, expired session, transient failure — leave the stored password and the requirement unchanged, and each produces distinct and accurate feedback.
- **SC-008**: In all acceptance datasets, repeated and near-simultaneous renewal submissions for the same user record exactly one password and clear the requirement exactly once.
- **SC-009**: In acceptance testing, 100% of active users carrying no renewal requirement reach the application frame on sign-in with the shell's existing navigation and permissions unchanged, and 0% are shown the renewal step.
- **SC-010**: At least 90% of representative users presented with the renewal step complete a valid renewal on their first attempt within 60 seconds, and correctly state afterwards that their password has changed and that their other browsers must sign in again.

## Assumptions

- The renewal requirement is produced by `Password Reset` (`#17`) and `User Reactivation` (`#32`), both defined in `CONTEXT.md` as actions that require the user to choose a new password. Neither is delivered yet, and both keep ownership of recording the requirement. This slice defines the state, enforces it, and clears it, which is the whole of what "after login" means in the issue title.
- Because no delivered action records the requirement, this slice is exercised through seed fixtures and test factories that place a user in the required state. That is sufficient for independent verification and is how the slice stays deliverable ahead of `#17` and `#32`, in line with the constitution's one-independently-deliverable-feature-per-spec principle.
- The requirement is a user attribute rather than a session attribute, so that it survives sign-out, applies to every browser, and is cleared once for the user rather than once per session.
- A user carrying the requirement is authenticated normally rather than refused at sign-in. Refusing them would be indistinguishable from invalid credentials — the rule `CONTEXT.md` states for non-active access statuses — and would leave them no route to the renewal. The requirement gates the application, not the authentication.
- The renewal does not ask for the current password. The user has just presented it to open the session, and the practical case is a user working from a credential an administrator handed them; asking for it again adds friction without adding proof. The new password is still refused if it is identical to the one being replaced.
- The confinement covers everything except the session representation, the renewal, and sign-out. Sign-out must stay reachable so a user who cannot renew right now is not stranded in a session they cannot leave; the session representation must stay readable because it is what tells the interface to present the renewal step.
- Revoking the user's other remembered connections on renewal, while keeping the renewing browser signed in, is the confirmed decision for this slice. The requirement follows a reset or a reactivation, where the replaced credential may be known to someone else, and a remembered connection restores access for up to 30 days without a password.
- The minimum password length is 12 characters with no composition rules, following current guidance that length outperforms mandated character classes. A supported maximum is enforced so an arbitrarily long value cannot be submitted. No password history beyond the immediately replaced password is kept, so only reuse of the current password is refused.
- Passwords are never trimmed or normalised, unlike the email address at sign-in, because surrounding whitespace is part of the secret.
- The renewal step does not say whether the requirement came from a reset or a reactivation. The user's action is the same either way, and `CONTEXT.md` already establishes that access-related responses do not disclose the administrative reason behind them.
- A session opened before the requirement was recorded is confined at its next request rather than terminated, so an administrator recording a reset never discards work in progress in a way the user cannot see coming; the user meets the renewal step instead of an unexplained sign-out.
- The renewal step is a standalone screen presented in place of the authenticated shell, not a modal layered over it, so that no application content is rendered behind it and no navigation is reachable around it.
- `Password Renewal` and `Password Renewal Requirement` are new domain vocabulary introduced by this slice and are added to `CONTEXT.md` as the constitution requires. They are deliberately distinct from `Password Reset`, which `CONTEXT.md` defines as the administrator-side action and whose entry warns against "password change" as a synonym; the terms here name the user-side action and the state it clears.
- Each operating organization owns exactly one site, and the renewal concerns only the signed-in user's own access, so no cross-site or cross-user authorization question arises beyond the confinement itself.
- This slice depends on Authenticate the Web Shell Against the API Session (`#115`) and Expose the Protected Application Frame and Minimal Navigation (`#116`), both delivered, and on the existing remembered-connection behaviour.
- Rate limiting, brute-force protection, password-strength meters, multi-factor authentication, and password expiry after a fixed period are out of scope and would be separate issues.
