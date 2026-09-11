# Feature Specification: Invite a Pending User with a Confidential Activation Link

**Feature Branch**: `whazzark/invite-a-pending-user-with-a-confidential-activa`

**Created**: 2026-07-09

**Last Updated**: 2026-09-10

**Status**: Draft

**Input**: User description: "Invite a Pending User with a Confidential Activation Link — Let an organization admin grant a person access to the operating organization by creating a pending user and handing out the confidential link that lets them activate it. https://github.com/whazzark/portflow-ai/issues/7"

**Feature ID**: `GH-7`

**GitHub Issue**: [#7](https://github.com/whazzark/portflow-ai/issues/7)

**Parent Roadmap**: `specs/user-administration/invitation-onboarding/roadmap.md`

**Roadmap Entry**: `GH-7`

**Priority**: priority:P1

**Milestone**: 0. Sécuriser l'administration des utilisateurs

**Domain**: user-administration

> Vertical slice: this specification owns both the invitation command in `apps/api` and the
> invitation action in the user workbench of `apps/web`. It absorbs the invitation half of the
> former frontend-only slice "Invite and Accept an Invitation Through the Frontend"; the acceptance
> half belongs to GH-8.

## Clarifications

### Session 2026-09-10

- Q: How long should a user activation link stay valid? → A: 7 days from its issuance
- Q: What happens when the invited email already belongs to a user, including a cancelled or deactivated one? → A: Always refused, naming the existing access status and the action that applies; never an implicit restoration or reactivation
- Q: How is the once-only activation link presented to the inviting administrator? → A: A dedicated invitation outcome showing the link in clear text with a copy action, dismissible only by an explicit acknowledgement
- Q: Should this slice limit how often invitations can be issued? → A: No dedicated rate limit; the organization-admin restriction, the email conflict rule, and the dated attribution are the protections
- Q: Where does the workbench land once the invitation outcome is acknowledged? → A: On the pending view, with the created user visible and highlighted, without opening its access record

## User Scenarios & Testing *(mandatory)*

This delivery is the first write action of user administration and the entry point of the
invitation onboarding roadmap. Until now the organization's users could only be consulted; access
existed solely because it had been seeded. This slice lets an organization admin bring a new person
into the organization without ever choosing a password on their behalf: the invitation creates a
pending user and issues a confidential activation link that only the invited person can use to
choose their own initial password. Every later invitation slice — acceptance, link renewal,
cancellation, restoration, permanent removal — acts on the pending user this one creates.

### User Story 1 - Invite a Person and Hand Out Their Activation Link (Priority: P1)

An organization admin invites a person by recording their identity, their email, and the
responsibility level they will hold. The organization gains a pending user, and the admin receives
a confidential activation link, shown once, which they pass on to the invited person through a
channel of their choosing.

**Why this priority**: It is the whole outcome of the slice and the precondition of every other
invitation slice; without it, access can only exist through seeding.

**Independent Test**: Sign in as an organization admin, invite a person who holds no access yet,
verify the confidential activation link is presented once, and verify the pending user appears in
the user collection with their identity, their role, the pending access status, and an invitation
event dated and attributed to the inviting admin.

**Acceptance Scenarios**:

1. **Given** an organization admin is signed in and no user holds the given email, **When** they invite a person with a first name, a last name, an email, and a role, **Then** a user is created in the pending access status, holding exactly the recorded identity and role, and holding no password.
2. **Given** an invitation succeeds, **When** the outcome is presented, **Then** a dedicated invitation outcome shows the confidential activation link in clear text, offers a copy action, states that it will not be shown again, and stays open until the administrator acknowledges it explicitly.
3. **Given** an invitation succeeds, **When** the inviting admin consults the new user's access record, **Then** the invitation event is recorded with its date and attributed to the inviting admin, and no activation event is recorded.
4. **Given** an invitation succeeds, **When** the administrator acknowledges the invitation outcome, **Then** the pending view is selected with the new user visible and highlighted in it, its count updated, its access record not opened, and neither a new sign-in nor a manual reload required.
5. **Given** the confidential activation link has been shown once, **When** the admin acknowledges the outcome and then reopens it, the user record, or the user collection, **Then** the link is nowhere consultable again, and the interface points to the activation link renewal as the way to obtain a new one.

---

### User Story 2 - Keep Invitation Restricted to the Administrators Responsible for User Access (Priority: P1)

Only organization admins may grant access to the operating organization, and the API enforces it
whatever the interface offers, so that no other role can create access or obtain an activation link.

**Why this priority**: An invitation creates a credential-bearing path into the application; a
permissive write is a direct security defect, not a usability one.

**Independent Test**: Attempt an invitation as an organization admin, an operations admin, an
operations lead, an observer, an unauthenticated visitor, and a user whose access is not active,
and verify each outcome at the API seam, then verify the workbench never offers an entry point the
API would refuse.

**Acceptance Scenarios**:

1. **Given** an operations admin, an operations lead, or an observer is signed in, **When** they attempt to invite a person, **Then** the request is denied, no user is created, and no activation link is issued.
2. **Given** a visitor is not authenticated, or a signed-in user's access status is not active, **When** an invitation is attempted, **Then** the request is denied and no user is created.
3. **Given** a viewer may not invite, **When** they browse the user workbench, **Then** no invitation entry point is presented, and reaching the invitation surface directly still creates no user.
4. **Given** an organization admin invites a person, **When** the invitation succeeds, **Then** the created user belongs to the inviting admin's operating organization and to no other.

---

### User Story 3 - Refuse an Invitation That Conflicts with an Existing User (Priority: P2)

An organization admin who invites an email that already belongs to a user is refused and told which
existing user holds it and in which access status, so they choose the correct action — renewing an
activation link, restoring a cancelled invitation, or reactivating a deactivated user — instead of
creating a second access for the same person.

**Why this priority**: Duplicate access for one person breaks the identity the whole access model
relies on, but it only matters once inviting works at all.

**Independent Test**: Invite an email already held by a pending, an active, a deactivated, and a
cancelled user in turn, and verify that each attempt is refused, that no second user is created, no
activation link is issued, and the existing user is left untouched in its access status.

**Acceptance Scenarios**:

1. **Given** a user already holds the email, whatever their access status, **When** an organization admin invites that email, **Then** the invitation is refused, no user is created, no activation link is issued, and the existing user's access status, role, identity, and lifecycle events are unchanged.
2. **Given** the email is held by a user in a differently-cased or space-padded form, **When** it is invited, **Then** it is recognized as the same email and refused for the same reason.
3. **Given** an invitation is refused for a conflicting email, **When** the outcome is presented to the organization admin, **Then** it identifies the access status of the user already holding that email and points to the action that applies to it, without exposing that user's credentials or any activation link.
4. **Given** two invitations for the same email are submitted concurrently, **When** both are processed, **Then** exactly one pending user exists for that email and the other attempt is refused as a conflict.

---

### User Story 4 - Record a Trustworthy Identity and Role Before Access Exists (Priority: P2)

The invited identity and responsibility level are validated before any access is created, so that
the organization never carries a pending user with an unusable email, an empty name, or an
unrecognized role.

**Why this priority**: The invitation is the only moment where this information is entered by
someone other than its owner; an unusable email produces a pending user nobody can ever activate.

**Independent Test**: Submit invitations with a missing or blank first name, last name, email, or
role, with a malformed email, with an unknown role, and with padded or mixed-case values, and
verify which are refused, which are normalized, and that no user is created by a refused attempt.

**Acceptance Scenarios**:

1. **Given** an invitation omits the first name, the last name, the email, or the role, or provides them as blank, **When** it is submitted, **Then** it is refused with a field-level reason and no user is created.
2. **Given** an invitation carries a malformed email, **When** it is submitted, **Then** it is refused with a field-level reason and no user is created.
3. **Given** an invitation carries a role outside the organization's four responsibility levels, **When** it is submitted, **Then** it is refused and no user is created.
4. **Given** an invitation carries surrounding spaces in the identity or the email, **When** it succeeds, **Then** the stored identity and email carry no surrounding spaces, and the email is recognized case-insensitively from then on.
5. **Given** an organization admin may invite any responsibility level, **When** they invite an organization admin, an operations admin, an operations lead, or an observer, **Then** each is accepted and the created pending user holds exactly the chosen role.

---

### User Story 5 - Recover From a Failed Invitation Without Leaving Half-Granted Access (Priority: P3)

An organization admin whose invitation fails receives a clear, actionable outcome and can retry
without risking a user created without a link, or a link issued without a user.

**Why this priority**: The failure path is what keeps the organization's access trustworthy after a
transient problem, but the slice delivers its value without it.

**Independent Test**: Make the invitation fail after submission, verify no pending user and no
activation link were produced, retry once the problem is resolved, and verify a single pending user
results.

**Acceptance Scenarios**:

1. **Given** an invitation cannot be completed, **When** the failure is returned, **Then** neither a pending user nor an activation link exists for that email, and the failure is presented as retryable rather than as a validation refusal.
2. **Given** a retryable failure was shown, **When** the organization admin retries the same invitation after the problem is resolved, **Then** exactly one pending user is created and exactly one activation link is issued.
3. **Given** an invitation is being submitted, **When** the admin submits it again before the outcome is known, **Then** at most one pending user results for that email.

### Edge Cases

- An organization admin MUST NOT be able to invite themselves or any email they already hold; the attempt follows the conflict rule of User Story 3.
- An invitation whose outcome is never seen by its author — a closed window, a lost connection — MUST still leave a consistent pending user, whose activation link is then obtainable only through an activation link renewal.
- The activation link MUST NOT be inferable from the pending user's identity, email, role, or creation date, and MUST NOT be reconstructable from anything the user collection exposes.
- The activation link MUST NOT be exposed by the user collection, the access record, application logs, or any consultation seam, and MUST NOT be sent anywhere by this feature.
- A pending user MUST NOT be able to sign in, and MUST NOT hold a password, before their invitation is accepted.
- An expired activation link MUST leave its pending user intact and recoverable through an activation link renewal rather than through a second invitation.
- Inviting the last remaining organization admin's email, or any email already conflicting, MUST NOT alter the existing user in any way, including its role and its lifecycle events.
- An invitation recorded while the user collection is open MUST place the new user in the pending view, with an updated count, on the next successful refresh.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let an organization admin invite a person into their operating organization by providing a first name, a last name, an email, and one of the organization's four responsibility levels.
- **FR-002**: A successful invitation MUST create exactly one user in the pending access status, holding the provided identity and role, belonging to the inviting admin's operating organization, and holding no password.
- **FR-003**: A successful invitation MUST record the invitation as a dated access status change attributed to the inviting organization admin, and MUST record no other lifecycle event.
- **FR-004**: A successful invitation MUST issue exactly one confidential activation link for the created pending user, allowing its holder to accept the invitation and choose an initial password.
- **FR-005**: The activation link MUST be presented to the inviting administrator exactly once, in a dedicated invitation outcome that shows it in clear text, offers a copy action, and states that it cannot be shown again.
- **FR-005a**: The invitation outcome MUST require an explicit acknowledgement before it is dismissed; it MUST NOT close on its own, on a focus change, or on a navigation inside user administration.
- **FR-006**: The system MUST NOT allow the activation link to be retrieved again after the invitation outcome, through any consultation, export, or log seam; obtaining a new one MUST require an activation link renewal.
- **FR-007**: The activation link MUST be unguessable, MUST identify exactly one pending user, and MUST NOT be derivable from information the user collection exposes.
- **FR-008**: The activation link MUST expire 7 days after its issuance, after which it no longer permits acceptance while leaving its pending user intact and renewable.
- **FR-009**: The system MUST NOT deliver the activation link to the invited person; handing it out is the inviting administrator's responsibility in this delivery.
- **FR-010**: The system MUST restrict invitation to signed-in organization admins whose own access status is active, and MUST deny it to operations admins, operations leads, observers, unauthenticated visitors, and non-active users.
- **FR-011**: The API MUST be the authoritative authorization boundary: the workbench MUST NOT offer an invitation entry point to a viewer the API would refuse, and offering it MUST NOT be what prevents the creation.
- **FR-012**: The system MUST refuse an invitation whose email already belongs to a user in any access status — pending, active, deactivated, or cancelled — and MUST leave that user entirely unchanged. It MUST NOT implicitly restore a cancelled invitation, reactivate a deactivated user, or reissue an activation link for a pending one.
- **FR-013**: Email comparison MUST be case-insensitive and MUST ignore surrounding spaces, so that one person cannot hold two accesses through casing or padding.
- **FR-014**: A refusal for a conflicting email MUST tell the organization admin the access status of the user already holding it and which action applies — activation link renewal, invitation restoration, or user reactivation — without exposing credentials or any activation link.
- **FR-015**: The system MUST refuse an invitation missing or blanking the first name, the last name, the email, or the role, carrying a malformed email, or carrying a role outside the four responsibility levels, and MUST return refusals at field level.
- **FR-016**: The system MUST normalize the recorded identity and email by removing surrounding spaces before creating the user.
- **FR-017**: An organization admin MUST be able to invite any of the four responsibility levels, including another organization admin.
- **FR-018**: A refused or failed invitation MUST create no user, issue no activation link, and record no lifecycle event.
- **FR-019**: Concurrent or repeated invitations of the same email MUST result in at most one pending user, the others being refused as conflicts.
- **FR-020**: The workbench MUST present the invitation outcome without requiring a new sign-in and, once it is acknowledged, MUST select the pending view of the user collection with the created user visible and highlighted in it, its count updated, and its access record left unopened.
- **FR-021**: The workbench MUST distinguish a validation refusal, a conflict refusal, and a retryable failure, and MUST let the administrator retry or correct without losing what they entered.
- **FR-022**: This feature MUST NOT provide invitation acceptance, activation link renewal, invitation cancellation or restoration, pending user removal, deactivation, reactivation, role change, or identity update.

### Key Entities

- **User**: A person holding access to the operating organization, with a stable identity, a first name, a last name, an email unique across the organization, exactly one role, and exactly one access status.
- **Pending User**: A user whose access has been invited but not activated yet. Holds no password, cannot sign in, and is the only kind of user this feature creates.
- **User Activation Link**: A confidential, unguessable, time-bounded link tied to exactly one pending user, allowing its holder to accept the invitation and choose an initial password. Presented once at invitation and never consultable afterwards.
- **User Access Status Change**: A dated change of a user's access status, attributed to the administrator who caused it. This feature records exactly one of them per successful invitation: the invitation event.
- **User Role**: The responsibility level a user holds — organization admin, operations admin, operations lead, or observer — chosen by the inviting administrator.
- **Operating Organization**: The scope owning the invited user; an invitation never creates access outside the inviting administrator's organization.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all authorization tests, organization admins invite successfully, and operations admins, operations leads, observers, unauthenticated visitors, and non-active users create no user and obtain no activation link.
- **SC-002**: In all conflict tests — pending, active, deactivated, cancelled, differently-cased, and space-padded emails — no second user is created for a person already holding access, and the existing user is unchanged.
- **SC-003**: 100% of successful invitations produce exactly one pending user, exactly one dated and attributed invitation event, and exactly one activation link.
- **SC-004**: In all activation link tests, the link is presented exactly once and is unobtainable from every consultation, listing, and record seam afterwards.
- **SC-005**: An organization admin completes an invitation and captures the activation link in under 1 minute from the user collection, without leaving user administration.
- **SC-006**: In all failure and repeated-submission tests, at most one pending user exists per invited email, and no failure leaves a user without a link or a link without a user.
- **SC-007**: 95% of invitations return their outcome within 2 seconds under normal operating conditions.

## Dependencies

- GH-2 — Persist User Access Status and Lifecycle Metadata: supplies the pending access status and the dated, attributed invitation event this feature records.
- GH-3 — Restrict Login to Active Users: guarantees the created pending user cannot sign in before acceptance.
- GH-4 — Browse and Filter the User List: supplies the user collection and the workbench that hosts the invitation entry point and shows the resulting pending user.
- No open issue blocks this slice. It is the entry point of the roadmap's execution order: GH-8, GH-9, GH-12, GH-13, and GH-14 all depend on it.

## Out of Scope

- Accepting the invitation and choosing the initial password (GH-8), including everything the activation link leads to.
- Renewing a pending user's activation link (GH-9), which is also the only way to recover a link lost after the invitation outcome.
- Cancelling (GH-12), restoring (GH-13), and permanently removing (GH-14) an invitation or a never-activated user.
- Delivering the activation link by email, which is the standalone "Send invitation emails" slice; this feature hands the link to the inviting administrator only.
- Bulk or file-based invitation of several people at once, and re-inviting an existing user.
- Rate limiting or throttling of invitation attempts: no dedicated limit is introduced here, and any such protection is a cross-cutting decision taken outside this slice.
- Self-service registration: access is always granted by an organization admin.
- Role change, identity update, deactivation, and reactivation of an existing user.
- Cross-organization or multi-site invitation.

## Assumptions

- "Administrator responsible for user access" follows `CONTEXT.md`: only organization admins hold write access to the organization's users, so they are the only inviting actor in this slice.
- The operating organization manages exactly one site, so the inviting admin's organization determines the created user's scope without an organization or site picker.
- The invited person receives their activation link out of band, because email delivery is a separate, later slice; the invitation outcome is therefore designed to be copied by the administrator.
- The 7-day validity decided in Clarifications is owned here at issuance; enforcing it when the link is used belongs to GH-8, and recovering an expired link belongs to GH-9.
- The activation link is single-use in intent: acceptance, cancellation, and renewal each end the previous link's usefulness. Enforcing that end belongs to the slice performing the action.
- Only a non-reversible form of the activation secret is retained, which is why the link cannot be presented a second time.
- The four responsibility levels of `CONTEXT.md` — organization admin, operations admin, operations lead, observer — are exhaustive, and an organization admin may invite any of them, including a peer.
- Email is the identifying contact information of a user, unique across the organization case-insensitively, as the existing user collection already assumes.
- The workbench reuses the user administration patterns already established by GH-4 — the status views with counts, the pending view, and the field-level, conflict, and retryable failure states of the existing write surfaces.
- A pending user is visible to organization admins only, consistently with the consultation rules of GH-4; an operations admin never sees the users this feature creates until they become active.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/7
- Parent roadmap: specs/user-administration/invitation-onboarding/roadmap.md
- Absorbed scope: the invitation half of "Invite and Accept an Invitation Through the Frontend", a frontend-only slice split between GH-7 and GH-8 on 2026-09-10 and deleted from GitHub.
- Blockers: recorded as GitHub issue dependencies on the source issue.
- Domain vocabulary: CONTEXT.md (User Invitation, Pending User, User Activation Link, User Activation Link Renewal, User Invitation Acceptance, User Access Status, User Access Status Change, Organization Admin)
- Related slices: GH-8 (acceptance), GH-9 (link renewal), GH-12 (cancellation), GH-13 (restoration), GH-14 (permanent removal), standalone "Send invitation emails".
