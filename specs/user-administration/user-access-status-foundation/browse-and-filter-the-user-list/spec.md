# Feature Specification: Browse and Filter the User List

**Feature Branch**: `feat/4-users-list`

**Created**: 2026-08-26

**Status**: Draft

**Input**: User description: "Browse and Filter the User List — Let the administrators who are responsible for user access consult the organization's users, filtered by access status and role, from the API and from the web workbench. https://github.com/whazzark/portflow-ai/issues/4"

**Feature ID**: `GH-4`

**GitHub Issue**: [#4](https://github.com/whazzark/portflow-ai/issues/4)

**Parent Roadmap**: `specs/user-administration/user-access-status-foundation/roadmap.md`

**Roadmap Entry**: `GH-4`

**Priority**: priority:P2

**Milestone**: 0. Sécuriser l'administration des utilisateurs

**Domain**: user-administration

> Merged slice: this specification covers both the API seam (formerly GH-4, "Filter User List Access by Role and Status") and the web seam (formerly GH-5, "Browse and Filter Users From the Web Workbench"). Issue #5 was closed in favor of #4; the two seams ship as one feature.

## User Scenarios & Testing *(mandatory)*

This delivery is the read-only foundation of user administration. It makes the access statuses and
lifecycle metadata persisted by GH-2 consultable, so that the later write slices — invitation,
cancellation, deactivation, reactivation, role change — act on a collection administrators can
already see and trust.

### User Story 1 - Consult Every User of the Organization (Priority: P1)

An organization admin consults the organization's users so they can see who holds access, at which
responsibility level, and in which access state, before deciding on any access change.

**Why this priority**: Complete visibility over pending, active, deactivated, and cancelled access is
the core value of the slice and the precondition of every later administration action.

**Independent Test**: Sign in as an organization admin when users exist in all four access statuses,
open Users, and verify that each status view lists exactly its users with an accurate count, a
default view on active users, and a specific empty state where a status has none.

**Acceptance Scenarios**:

1. **Given** users exist as pending, active, deactivated, and cancelled, **When** an organization admin opens the user collection, **Then** the active view is selected by default and shows every active user without showing users of another access status.
2. **Given** the collection is shown, **When** the organization admin switches to the pending, deactivated, or cancelled view, **Then** the view shows every user of that access status and its count matches the records shown.
3. **Given** several users exist, **When** the collection is shown, **Then** each user's first name, last name, email, role, and access status are identifiable without opening the user.
4. **Given** an access status has no user, **When** the organization admin selects its view, **Then** an explicit empty state for that status is shown and the other status views remain reachable.

---

### User Story 2 - Withhold User Information From Unauthorized Viewers (Priority: P1)

The organization's user information is restricted to the roles responsible for user access, so that
access states and invitation history never leak to viewers whose responsibilities do not include
user administration.

**Why this priority**: The user collection exposes who may sign in and who was revoked; a permissive
read is a security defect, and the API must enforce it whatever the interface does.

**Independent Test**: Request the user collection as an organization admin, an operations admin, an
operations lead, an observer, an unauthenticated visitor, and a user whose access is not active, and
verify that each outcome matches its authorization rule at the API seam, then verify the web
workbench never presents information the API would refuse.

**Acceptance Scenarios**:

1. **Given** users exist in every access status, **When** an operations admin consults the user collection, **Then** only active users are returned and no pending, deactivated, or cancelled user is exposed in the collection or in counts.
2. **Given** an operations lead or an observer is signed in, **When** they request the user collection, **Then** the request is denied and no user information is returned.
3. **Given** a visitor is not authenticated, or a user's access status is not active, **When** the user collection is requested, **Then** the request is denied.
4. **Given** a role may not consult users, **When** that user browses the web workbench, **Then** no user administration entry point is presented, and reaching the area directly still yields no user information.

---

### User Story 3 - Find a Specific User (Priority: P2)

An administrator narrows the collection by name, email, and role so they can reach one user, or one
population of users, without scanning the whole organization.

**Why this priority**: Filtering is what makes the collection usable beyond a handful of records; it
is valuable as soon as the collection is visible, but the collection is valuable without it.

**Independent Test**: With a collection covering several roles and statuses, search by fragments of
first name, last name, and email, combine the search with a role filter inside a status view, and
verify the visible records, the counts, and the return to the unfiltered view.

**Acceptance Scenarios**:

1. **Given** the collection is shown, **When** the administrator searches a fragment of a first name, last name, or email, **Then** only the users of the current status view matching that fragment remain visible, regardless of letter case.
2. **Given** a search is active, **When** the administrator also filters on a role, **Then** the visible users satisfy the access status view, the search, and the role filter together.
3. **Given** filters are active and no user matches, **When** the result is shown, **Then** a no-match state is shown, distinct from a status view that contains no user at all, and clearing the filters restores the view.
4. **Given** filters are active, **When** the administrator switches to another access status view, **Then** the visible set is consistent with the newly selected status and never shows a user of the previous view.

---

### User Story 4 - Inspect a User's Access Record (Priority: P2)

An administrator opens one user from the list and inspects their access record — identity, role,
current access status, and the dated history of how that status was reached, with the responsible
administrator when it was recorded. The record is opened from the collection already consulted, not
from a separate per-user consultation.

**Why this priority**: The lifecycle metadata already persisted has no consultable surface today;
exposing it read-only lets administrators justify an access decision before the write slices exist.

**Independent Test**: Open users in each access status from the list and verify that the record shows
identity, role, current status, and every recorded lifecycle event with its date and responsible
administrator, that unrecorded events are absent rather than empty, that opening a user issues no
further consultation request, and that no write action is offered.

**Acceptance Scenarios**:

1. **Given** a user is listed, **When** an administrator opens it, **Then** the record shows the user's first name, last name, email, role, and current access status, from the information already retrieved with the collection.
2. **Given** the opened user has recorded lifecycle events, **When** the record is shown, **Then** each recorded event — invitation, activation, cancellation, deactivation, reactivation — is presented with its date, in chronological order, together with the responsible administrator when one was recorded.
3. **Given** the opened user has never reached a given lifecycle event, **When** the record is shown, **Then** that event is not presented as an empty or unknown value.
4. **Given** a user access record is open, **When** the administrator looks for access actions, **Then** no invitation, cancellation, deactivation, reactivation, role change, or identity change is offered by this feature.
5. **Given** an operations admin is signed in, **When** they consult users, **Then** only active users are listed and therefore openable, no consultation seam exposes the access record of a non-active user, and the record they open carries identity, role, and access status without any lifecycle event.

---

### User Story 5 - Recover From a Consultation Failure (Priority: P3)

An administrator receives clear feedback when the user collection cannot be loaded and can retry
without leaving the user administration area.

**Why this priority**: A recoverable failure state prevents a transient problem from being read as
"this organization has no pending user", which would be a misleading basis for an access decision.

**Independent Test**: Make the user collection unavailable, verify the interface distinguishes the
failure from an empty collection, restore availability, retry, and confirm the collection loads
without a new sign-in.

**Acceptance Scenarios**:

1. **Given** user information cannot be loaded, **When** an administrator opens the user collection, **Then** a clear failure message is shown rather than an empty collection or a zero count.
2. **Given** a retryable failure is displayed, **When** the underlying problem is resolved and the administrator retries, **Then** the latest user collection becomes consultable without requiring a new sign-in.

### Edge Cases

- A user's access status changing while the collection is open MUST place that user in their current status view, with updated counts, on the next successful refresh.
- Switching access status views MUST NOT keep open a user who no longer belongs to the selected view.
- An open access record MUST follow the refreshed collection: it reflects the latest retrieved information, and it closes when the user it describes leaves the visible view.
- An administrator consulting the collection MUST find their own record, presented like any other.
- A lifecycle event recorded without a responsible administrator, or whose responsible administrator no longer holds access, MUST still be presented with its date and MUST NOT hide the event.
- A collection-loading failure MUST be distinguishable from a valid empty status view and from a no-match filter result.
- Counts MUST describe only what the viewer is allowed to see; an operations admin MUST NOT be able to infer the existence of pending, deactivated, or cancelled users from a count, a filter option, an empty view, or the name of an administrator responsible for a lifecycle event.
- Credentials, password material, activation links, and session or remember-me tokens MUST NOT be exposed by any part of this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let an organization admin consult every user of their operating organization, whatever the user's access status.
- **FR-002**: The system MUST restrict an operations admin's consultation to active users, in the collection and in every count.
- **FR-003**: The system MUST deny user consultation to operations leads, observers, unauthenticated visitors, and any user whose access status is not active.
- **FR-004**: The API MUST be the authoritative authorization boundary: the web workbench MUST NOT present, count, or cache user information the API would refuse to the same viewer.
- **FR-005**: Each consultable user MUST expose a stable identity, first name, last name, email, role, and current access status.
- **FR-006**: A consultable user's access record MUST expose the recorded lifecycle events — invitation, activation, cancellation, deactivation, reactivation — each with its date and, when recorded, the responsible administrator's identity.
- **FR-006a**: The consulted collection MUST carry every piece of information the access record presents, so that opening a user requires no further consultation. This feature MUST NOT introduce a per-user consultation seam.
- **FR-006b**: The lifecycle events and their responsible administrators MUST be exposed to organization admins only. An operations admin MUST receive identity, role, and access status without any lifecycle event, since a responsible administrator is itself a user they may not consult.
- **FR-007**: The system MUST NOT expose credentials, password material, activation links, or session and remember-me tokens through this feature.
- **FR-008**: The workbench MUST separate users by access status, MUST show a count per visible status view equal to the users represented in it, and MUST select the active view by default.
- **FR-009**: The workbench MUST only present status views the viewer is allowed to consult.
- **FR-010**: The workbench MUST provide a search over first name, last name, and email that is case-insensitive, matches fragments, and applies within the selected status view without requiring another collection request.
- **FR-011**: The workbench MUST provide a role filter, combinable with the search and with the selected status view.
- **FR-012**: The workbench MUST let the administrator sort the visible users on their displayed identity and role.
- **FR-013**: The workbench MUST provide a specific empty state per status view, a distinct no-match state when filters exclude every user, and a way to clear the active filters.
- **FR-014**: Loading failures MUST be distinguishable from empty results and MUST offer a retry that requests the latest collection.
- **FR-015**: The workbench MUST expose a user administration entry point only to viewers allowed to consult users.
- **FR-016**: This feature MUST NOT provide user invitation, invitation cancellation or restoration, activation link renewal, pending user removal, deactivation, reactivation, role change, or identity update.

### Key Entities

- **User**: A person holding access to the operating organization. Has a stable identity, a first name, a last name, an email, exactly one role, and exactly one current access status.
- **User Access Status**: The access state of a user — pending activation, active, deactivated, or cancelled before activation. It determines which viewers may see the user and which status view lists them.
- **User Role**: The responsibility level held by a user — organization admin, operations admin, operations lead, or observer. It determines both what a user may consult and how they are presented in the collection.
- **User Access Status Change**: A dated change of a user's access status, optionally attributed to the administrator who caused it. Read-only in this feature.
- **Operating Organization**: The scope owning the users visible to the viewer; users of another organization are outside the collection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all authorization tests, organization admins consult every access status, operations admins consult active users only, and operations leads, observers, unauthenticated visitors, and non-active users obtain no user information.
- **SC-002**: In all tested collection compositions — every status populated, single-status, and empty — the visible records, counts, and empty states are correct, and no user appears in a status view they do not belong to.
- **SC-003**: For a collection of up to 200 users, 95% of consultations present the selected status view and its count within 2 seconds under normal operating conditions.
- **SC-004**: In acceptance testing, an administrator locates a known user by name or email fragment within 3 interactions of entering the user administration area.
- **SC-005**: For every user whose access history is recorded, the access record presented to an organization admin carries each recorded lifecycle event with its date and responsible administrator, presents no unrecorded event, and carries no lifecycle event at all when presented to an operations admin.
- **SC-006**: In all retry tests, a resolved transient failure is recovered through the provided retry action, and the failure state is never presented as an empty collection.

## Dependencies

- GH-2 — Persist User Access Status and Lifecycle Metadata: supplies the access status and the dated, attributed lifecycle events this feature consults.
- GH-3 — Restrict Login to Active Users: establishes that only active users hold a session, which this feature's authorization rules assume.

## Out of Scope

- Every user access write action: invitation, invitation cancellation and restoration, activation link renewal, pending user removal, deactivation, reactivation, role change, and identity update.
- Bulk selection and bulk access actions on the collection.
- A per-user consultation seam: the access record is opened from the retrieved collection, so no single-user retrieval is introduced by this feature.
- Exporting the user collection and auditing consultation of it.
- Cross-organization or multi-site user consultation.

## Assumptions

- "Administrator responsible for user access" follows `CONTEXT.md`: organization admins hold read and write access to the organization's users, operations admins consult active users only, and operations leads and observers hold no user consultation right.
- The operating organization manages exactly one site, so the viewer's organization determines the collection without an organization or site picker.
- The four access statuses — pending, active, deactivated, cancelled — are exhaustive for consultation, and every user holds exactly one of them.
- Administrators see their own record in the collection like any other user.
- The collection is expected to remain at or below 200 users for this delivery, so search, role filtering, sorting, and the access record all apply to the retrieved collection, and pagination is out of scope. This follows the consultation convention already established by the customer and site-reference collections.
- The access record is a view over the consulted collection rather than a separately retrieved user, so refreshing the collection is what refreshes an open record.
- Email is the identifying contact information shown for a user; no additional contact channel is introduced by this feature.
- The web workbench reuses the existing collection consultation patterns — status views with counts, search, sortable table, read-only record panel opened from a row, empty, no-match, and retryable failure states.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/4
- Merged source issue (closed): https://github.com/whazzark/portflow-ai/issues/5
- Parent roadmap: specs/user-administration/user-access-status-foundation/roadmap.md
- Domain vocabulary: CONTEXT.md (Organization Admin, Operations Admin, Operations Lead, Observer, User Access Status, User Access Status Change, Pending User, User Deactivation, User Reactivation)
