# Feature Specification: Update Another User Identity

**Feature Branch**: `whazzark/update-another-user-identity`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "Update Another User Identity — Let an organization admin correct the identifying information of another user of the organization, from the API and from the user workbench. https://github.com/whazzark/portflow-ai/issues/24"

**Feature ID**: `GH-24`

**GitHub Issue**: [#24](https://github.com/whazzark/portflow-ai/issues/24)

**Parent Roadmap**: `specs/user-administration/user-identity-update/roadmap.md`

**Roadmap Entry**: `GH-24`

**Priority**: priority:P2

**Milestone**: 0. Sécuriser l'administration des utilisateurs

**Domain**: user-administration

> Vertical slice: this specification covers both the administrator command in `apps/api` and its
> screen in the user workbench of `apps/web`. It absorbs the administrator half of the former
> frontend-only slice "Update User Identity From the Web Workbench"; that slice's self-service half
> belongs to GH-25.

## Clarifications

### Session 2026-09-11

- Q: Must every accepted correction be recorded as a dated, attributed history entry (US4, FR-013,
  FR-014, SC-005)? → A: No, not for now. The history is deferred and leaves this slice; a correction
  records nothing but the corrected identity.
- Q: GH-7 has delivered activation links. Should correcting a pending user's email address replace
  their link and show the new one to the administrator? → A: No. A pending user's email address is
  not correctable; the refusal simply explains why and when it becomes correctable. Their name
  remains correctable.
- Q: Where is the correction offered in the workbench? → A: As in the customer directory: an `Edit`
  item in the user row's actions menu, and an `Edit` action on the left of the open record's footer.

## User Scenarios & Testing *(mandatory)*

This delivery is the first write slice of the User Identity Update roadmap. It makes the identifying
information already consulted through GH-4 correctable by the administrator responsible for user
access, and it establishes the identity rules — what an identity is and how it is validated — that
GH-25 later reuses under a self-service authorization path.

### User Story 1 - Correct Another User's Identity (Priority: P1)

An organization admin corrects the identifying information of another user of the organization —
a misspelled name, a name that changed, a mistyped address entered at invitation time — so that the
user collection, the access records, and every place a user is named stay truthful.

**Why this priority**: A wrong identity is visible everywhere a user is named and cannot be repaired
today without touching the database. Correcting it is the whole value of the slice.

**Independent Test**: Sign in as an organization admin, open another user from the user collection,
change their identifying information, confirm, and verify that the collection, the open access
record, and every other presentation of that user carry the corrected identity, with no other
attribute of the user changed.

**Acceptance Scenarios**:

1. **Given** an organization admin has opened another user of the organization, **When** they submit a valid identity, **Then** the change is applied and the user is presented with the corrected identity in the collection and in their access record.
2. **Given** an identity has just been corrected, **When** the updated user is consulted again, **Then** the correction is durable and the user's role, access status, lifecycle events, and credentials are unchanged.
3. **Given** the identity form is open, **When** the organization admin changes only part of the identity, **Then** the untouched parts keep their current values and are not cleared.
4. **Given** the identity form is open, **When** the organization admin abandons the change, **Then** nothing is modified and the user keeps the identity they had.
5. **Given** the submitted identity is identical to the current one, **When** it is confirmed, **Then** the outcome is a success and nothing is written.
6. **Given** the corrected user is pending, **When** the organization admin submits a different email address for them, **Then** the correction is refused with a message explaining that the address of a user who has not activated their access yet cannot be changed, and when it can; nothing is changed and the form keeps what was typed.
7. **Given** the corrected user is pending, **When** only their name is corrected, **Then** the correction is applied and their outstanding activation link is left untouched.

---

### User Story 2 - Restrict Identity Correction to the Responsible Administrator (Priority: P1)

The ability to change someone else's identifying information is confined to the role responsible for
user access, so that a user cannot be renamed — or given another person's address — by anyone whose
responsibilities do not include user administration.

**Why this priority**: An identity is how the organization recognizes a user and, through the email
address, how sign-in and every account-recovery flow reach them. A permissive write is a security
defect, and the API must enforce it whatever the interface does.

**Independent Test**: Attempt an identity update on another user as an organization admin, an
operations admin, an operations lead, an observer, an unauthenticated visitor, and a user whose
access is not active, and verify each outcome at the API seam; then verify the workbench offers the
action to no viewer the API would refuse.

**Acceptance Scenarios**:

1. **Given** an active organization admin is signed in, **When** they update another user of their organization, **Then** the update is accepted.
2. **Given** an operations admin, an operations lead, or an observer is signed in, **When** they attempt to update another user's identity, **Then** the request is denied and no identity is changed.
3. **Given** a visitor is not authenticated, or a signed-in user's access status is not active, **When** an identity update is attempted, **Then** the request is denied.
4. **Given** an organization admin is signed in, **When** they attempt to update their own identity through this administrator seam, **Then** the request is refused and they are directed to the self-service path, which is not delivered by this feature.
5. **Given** a role may not update identities, **When** that user browses the user workbench, **Then** no identity correction entry point is presented, and reaching the action directly still changes nothing.
6. **Given** a user belongs to another organization, **When** an organization admin attempts to update them, **Then** the request is refused exactly as for a user that does not exist, revealing nothing about that user.

---

### User Story 3 - Reject an Invalid or Conflicting Identity (Priority: P1)

The administrator is stopped, with an explanation they can act on, when the identity they submit is
incomplete, malformed, or already used by another user, so that a correction never degrades the
collection it was meant to repair.

**Why this priority**: The email address identifies a user uniquely and carries sign-in; accepting a
duplicate or a malformed one would break access for two people at once. Validation is inseparable
from the correction itself.

**Independent Test**: Submit an empty name, an over-long name, a malformed address, and an address
already held by another user in every access status, and verify each rejection names the field at
fault, changes nothing, and preserves what the administrator had typed.

**Acceptance Scenarios**:

1. **Given** the identity form is open, **When** a required part of the identity is empty or blank, **Then** the update is refused, the field at fault is named, and nothing is changed.
2. **Given** the identity form is open, **When** the submitted email address is malformed, **Then** the update is refused with an explanation and nothing is changed.
3. **Given** another user of the organization already holds an email address, **When** an organization admin submits that same address for a different user, **Then** the update is refused as a conflict and neither user is changed.
4. **Given** an address is held by another user whose access status is pending, cancelled, or deactivated, **When** the same address is submitted for a different user, **Then** the update is refused exactly as it would be for an active user.
5. **Given** an address differs from another user's only by letter case or surrounding whitespace, **When** it is submitted, **Then** it is treated as the same address and refused as a conflict.
6. **Given** an update was refused, **When** the administrator corrects the offending value and submits again, **Then** the update succeeds without their having to re-enter the parts that were already valid.

---

### User Story 4 - Account for Who Changed an Identity (Deferred)

Deferred on 2026-09-11 (see Clarifications): recording and presenting a dated, attributed history of
identity corrections is not delivered by this slice. The story keeps its number so that US5 and the
existing references to it stay stable; it may return as a slice of its own.

---

### User Story 5 - Recover From a Failed Correction (Priority: P3)

An administrator whose correction cannot be applied is told so unambiguously and can retry without
losing what they typed and without leaving the user administration area.

**Why this priority**: A correction silently lost, or wrongly presented as applied, is worse than no
correction at all: the administrator moves on believing the collection is repaired.

**Independent Test**: Make the update fail transiently, verify the failure is reported and the
presented identity is unchanged, then restore availability, retry, and confirm the correction is
applied without a new sign-in.

**Acceptance Scenarios**:

1. **Given** an identity update cannot be applied, **When** the administrator submits it, **Then** a clear failure is reported, the user keeps their current identity everywhere, and the submitted values remain available for a retry.
2. **Given** a retryable failure was reported, **When** the administrator retries after the underlying problem is resolved, **Then** the correction is applied without requiring a new sign-in.
3. **Given** the user was changed by someone else since the form was opened, **When** the administrator submits, **Then** the outcome reflects the current state of that user rather than the state the form was opened on, and the administrator is not shown a success over information they never saw.

### Edge Cases

- A user whose access status changes while the identity form is open MUST NOT be corrected on the basis of the stale record; the outcome MUST reflect the user's current state.
- Two organization admins correcting the same user concurrently MUST NOT interleave into a mixed identity: the last accepted correction MUST be complete and the losing one MUST be reported rather than silently discarded.
- An email address freed by a correction MUST become usable for another user, and an address released and re-taken MUST NOT resurrect the previous holder's record.
- Correcting the identity of a user who is the responsible administrator of a recorded lifecycle event MUST update how that event names them, since the event resolves the administrator's current identity.
- Correcting an identity MUST NOT affect the user's sessions, remembered connections, password, or password renewal requirement, and MUST NOT sign the user out, including when the corrected part is the address the user signs in with.
- Submitting a different email address for a pending user MUST be refused, whatever else the submission corrects, with a message the administrator can read as it stands; nothing MUST be changed. Their activation link was handed out under the address recorded at invitation, and this slice issues no replacement.
- An address differing from a pending user's stored one only by letter case or surrounding whitespace is the same mailbox, so it MUST NOT trigger that refusal.
- A correction that leaves a pending user's email address untouched MUST NOT disturb their outstanding activation link.
- Identity values MUST be stored and presented as entered apart from insignificant surrounding whitespace: capitalization, accents, apostrophes, hyphens, and non-Latin characters MUST survive a correction unchanged.
- Credentials, password material, activation links, and session or remember-me tokens MUST NOT be exposed or accepted by any part of this feature.
- A correction MUST NOT be applied partially: either every submitted part of the identity is applied, or none is.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let an active organization admin change the identifying information of another user of their operating organization.
- **FR-002**: The identity subject to this feature MUST be exactly the user's first name, last name, and email address. No other attribute of the user MUST be changeable through this feature.
- **FR-003**: The system MUST allow the correction of any user of the administrator's operating organization whatever that user's access status — pending, active, deactivated, or cancelled — since a mistyped identity is worth repairing wherever it was entered, and a cancelled invitation may later be restored. For a pending user, FR-015 excludes the email address.
- **FR-004**: The system MUST refuse an identity update targeting the requesting administrator themselves; self-service identity update is GH-25 and is not delivered here.
- **FR-005**: The system MUST deny identity updates to operations admins, operations leads, observers, unauthenticated visitors, and any user whose access status is not active.
- **FR-006**: The API MUST be the authoritative authorization boundary: the workbench MUST NOT offer, optimistically apply, or cache an identity change the API would refuse to the same viewer.
- **FR-007**: The system MUST refuse an update targeting a user outside the requesting administrator's operating organization, with an outcome indistinguishable from a user that does not exist.
- **FR-008**: The system MUST require a non-blank first name and last name, and MUST reject values exceeding the length the user collection already stores.
- **FR-009**: The system MUST reject a malformed email address.
- **FR-010**: The system MUST keep the email address unique across the organization, comparing without regard to letter case or surrounding whitespace, and MUST reject a conflict whatever the access status of the user already holding the address.
- **FR-011**: The system MUST apply an accepted correction atomically and MUST leave the user's role, access status, recorded lifecycle events, credentials, password renewal requirement, sessions, and remembered connections untouched.
- **FR-012**: A refused update MUST change nothing and MUST name the part of the identity at fault so the administrator can correct it.
- **FR-013**: *Deferred 2026-09-11.* Recording each accepted identity change as a dated, attributed history entry is not delivered by this feature (see Clarifications).
- **FR-014**: *Deferred 2026-09-11,* with FR-013: there is no identity change history to expose.
- **FR-015**: The email address MUST be correctable through this feature for a user who is active, deactivated, or cancelled. For a pending user it MUST NOT be: a submission carrying a different address — compared as in FR-010 — MUST be refused as a whole, change nothing, and carry a message stating that the email address of a user who has not activated their access yet cannot be changed, and that it can be corrected once they have. A pending user's name MUST remain correctable, and a correction that keeps their address MUST leave their outstanding activation link untouched.
- **FR-016**: The workbench MUST offer the identity correction from the user's row in the collection, through its actions menu, and from the user record already opened from it, through its footer — the placement the customer directory uses. It MUST pre-fill the correction with the user's current identity, and MUST allow abandoning it without change.
- **FR-017**: The workbench MUST present the outcome of a correction unambiguously — applied, refused with the reason, or failed and retryable — and MUST never present a refused or failed correction as applied.
- **FR-018**: The workbench MUST show the corrected identity in the collection, in the open record, and anywhere else the user is named, without requiring a new sign-in or a manual reload.
- **FR-019**: The workbench MUST preserve the administrator's input across a refusal or a retryable failure.
- **FR-020**: This feature MUST NOT provide self-service identity update, email-change confirmation, role change, invitation, invitation cancellation or restoration, activation link renewal or reissue, pending user removal, deactivation, reactivation, password reset, bulk identity edits, or an identity change history.

### Key Entities

- **User**: A person holding access to the operating organization. Carries the identity this feature corrects, exactly one role, and exactly one access status.
- **User Identity**: The identifying information of a user — first name, last name, and email address — distinct from their role, access status, and credentials. The email address is unique across the organization.
- **User Identity Update**: The act of changing a user's identifying information, here performed by an organization admin on another user. Only the corrected identity is kept; no history of the change is retained by this feature.
- **User Activation Link**: The confidential link by which a pending user activates their access, handed out at invitation under the address then recorded. This feature neither replaces nor invalidates it, which is why a pending user's address is not correctable here.
- **Organization Admin**: The role responsible for user access and the only actor authorized by this feature.
- **Operating Organization**: The scope owning the users an administrator may correct; users of another organization are out of reach.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all authorization tests, an active organization admin corrects another user's identity, and operations admins, operations leads, observers, unauthenticated visitors, non-active users, and the administrator acting on themselves obtain no identity change.
- **SC-002**: In all validation tests — blank, over-long, malformed, duplicate, and case- or whitespace-variant values — the update is refused, the user's stored identity is unchanged, and the reported reason names the part of the identity at fault.
- **SC-003**: 100% of accepted corrections are visible to the administrator without a further navigation step or a new sign-in, and 95% of them are confirmed within 2 seconds under normal operating conditions.
- **SC-004**: In all concurrency tests, two simultaneous corrections of the same user leave one complete identity and one reported refusal, never a mixed identity and never a silent loss.
- **SC-005**: *Deferred 2026-09-11,* with FR-013.
- **SC-007**: In all pending-user tests, submitting a different email address is refused with the explanatory message and leaves the user's identity and activation link unchanged, while correcting only the name — or re-casing the same address — is applied.
- **SC-006**: In acceptance testing, an administrator corrects a known user's identity within 3 interactions of entering the user administration area, and no test run leaves a failed correction presented as applied.

## Dependencies

- The identifying information this slice changes is persisted by GH-2, and the user workbench that
  displays it is delivered by GH-4. Both are delivered.
- GH-7 — Invite a Pending User with a Confidential Activation Link — is delivered (#292) and creates
  the pending users and activation links FR-015 protects. This slice uses none of its mechanics: it
  refuses a pending user's address change rather than replacing their link (clarified 2026-09-11).
- It is the entry point of the roadmap's execution order: GH-25 depends on it, and GH-118 depends on
  GH-25.

## Out of Scope

- Self-service identity update by the user themselves — GH-25 — including the reuse of these identity
  rules under a self-service authorization path.
- Confirmation of a self-service email change — GH-118.
- Role change and its protections — GH-28 and GH-29.
- Every access status change: invitation, invitation cancellation and restoration, activation link
  renewal, pending user removal, deactivation, and reactivation.
- Standalone activation link renewal — GH-9.
- Correcting a pending user's email address, and the activation link replacement it would require
  (clarified 2026-09-11).
- A history of identity corrections — who changed an identity, when, and from what (former US4,
  deferred 2026-09-11).
- Password reset, password renewal, and any effect on credentials or sessions.
- Bulk identity edits over a selection of users, and importing identities from an external directory.
- Notifying a user that their identity was changed by an administrator.
- Cross-organization or multi-site user administration.

## Assumptions

- "Organization admin" follows `CONTEXT.md`: the role responsible for managing users and their
  access within the operating organization, and the only role holding write access to users.
- The operating organization manages exactly one site, so the administrator's organization determines
  the users they may correct without an organization or site picker, per ADR 0003.
- The identity of a user is the first name, last name, and email address already consulted through
  GH-4; no additional contact channel or display name is introduced by this feature. All three are
  correctable here, per the clarification of 2026-09-10.
- The email address remains the sign-in identifier, so uniqueness across the organization is a
  business rule rather than a storage detail.
- The user collection remains at or below the volume established by GH-4, so a correction refreshes
  the retrieved collection rather than introducing a per-user consultation seam.
- The correction is offered from the user's row and from the user record opened from the collection,
  following the workbench conventions established by GH-4 and the site-reference directories.
- Names are free text: the feature validates presence and length, not the plausibility or the script
  of a person's name.
- A correction is an ordinary administrative act and does not require a justification comment, unlike
  the commented corrections used in discharge operations.
- The user whose identity is corrected is not notified by this feature; notification, if wanted,
  belongs to a later slice.
- A pending user whose address was mistyped at invitation can still activate with the link the
  administrator handed on, whatever channel carried it; their address is then correctable like any
  active user's.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/24
- Parent roadmap: specs/user-administration/user-identity-update/roadmap.md
- Absorbed scope: the administrator half of "Update User Identity From the Web Workbench", a
  frontend-only slice split between GH-24 and GH-25 on 2026-09-10 and deleted from GitHub.
- Blockers: recorded as GitHub issue dependencies on the source issue.
- Domain vocabulary: CONTEXT.md (User Identity Update, Organization Admin, Operations Admin,
  Operations Lead, Observer, User Access Status, Pending User, User Activation Link)
- Related decisions: docs/adr/0003-single-site-without-tenant-isolation.md,
  docs/adr/0005-tuyau-api-web-contract.md,
  docs/adr/0008-vertical-slice-web-frontend-with-explicit-ui-adapters.md
