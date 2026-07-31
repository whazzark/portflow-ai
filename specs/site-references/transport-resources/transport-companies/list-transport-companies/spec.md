# Feature Specification: List Transport Companies

**Feature Branch**: `feat/217-list-transport-companies`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Let an authorized user consult available and archived transport companies. https://github.com/whazzark/portflow-ai/issues/217"

**Feature ID**: `GH-217`

**GitHub Issue**: [#217](https://github.com/whazzark/portflow-ai/issues/217)

**Parent Roadmap**: `specs/site-references/transport-resources/transport-companies/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Companies by Lifecycle State (Priority: P1)

As an active operational user, I want to consult the site's available and archived transport companies separately so that I can identify companies usable for current work without losing access to retired references.

**Why this priority**: Distinguishing companies that can be used now from companies retained only for history is the primary outcome of the feature.

**Independent Test**: Sign in as an active user, open transport-company consultation with both lifecycle states represented, and verify that the user can switch between complete available and archived collections without any administration capability being required.

**Acceptance Scenarios**:

1. **Given** the site has available and archived transport companies, **When** an active user opens transport-company consultation, **Then** available companies are shown by default and archived companies are accessible in a distinct lifecycle view.
2. **Given** the user is viewing one lifecycle state, **When** the user switches to the other state, **Then** only companies in the selected state are shown and each state reports its record count.
3. **Given** an archived company exists, **When** an active user consults transport companies, **Then** that company remains readable but does not appear among companies available for new operational use.

---

### User Story 2 - Find and Inspect a Company (Priority: P2)

As an active operational user, I want to find a transport company by its current name and inspect its lifecycle context so that I can identify the right provider and understand whether it is still usable.

**Why this priority**: A collection is useful only when users can identify the intended company and understand the meaning of its status, especially as the number of references grows.

**Independent Test**: Populate each lifecycle state with several companies, search and sort the selected collection, open a matching company, and verify its identity, current name, status, and relevant lifecycle information.

**Acceptance Scenarios**:

1. **Given** several companies exist in the selected lifecycle state, **When** the user searches by all or part of a company name without matching letter case, **Then** only matching companies in that state are shown.
2. **Given** several companies exist in the selected lifecycle state, **When** the user sorts by company name, **Then** the companies are ordered predictably in the chosen direction without changing lifecycle state.
3. **Given** the user selects an available company, **When** its details open, **Then** the user can read its stable identity, current company name, available status, and any most recent reactivation context.
4. **Given** the user selects an archived company, **When** its details open, **Then** the user can read its stable identity, current company name, archived status, and available archival context including when, by whom, and why it was archived.

---

### User Story 3 - Recover From Empty and Failed Consultation (Priority: P3)

As an active operational user, I want clear empty, no-match, loading, and failure feedback so that I know whether no companies exist, my search found nothing, or consultation must be retried.

**Why this priority**: Clear state feedback prevents an empty collection or temporary failure from being mistaken for missing permissions or lost reference data.

**Independent Test**: Open transport-company consultation with no records, with a search that has no matches, and with a retryable retrieval failure; verify that each state has distinct guidance and that retry can recover the collection.

**Acceptance Scenarios**:

1. **Given** no companies exist in the selected lifecycle state, **When** the collection is displayed, **Then** the user sees an empty-state message specific to that lifecycle state.
2. **Given** companies exist but none match the user's search, **When** the search is applied, **Then** the user sees a no-match message without being told that the lifecycle collection itself is empty.
3. **Given** transport companies cannot be retrieved, **When** consultation fails, **Then** the user sees an understandable failure message and an action to retry.
4. **Given** a previous retrieval failed and retrieval is available again, **When** the user retries, **Then** the current transport-company collection is displayed.

### Edge Cases

- An unauthenticated visitor or a user whose access is not active is denied transport-company consultation without exposing company data.
- A company whose lifecycle state changes while the user is consulting a stale collection appears in its authoritative current state after the collection is refreshed or retried.
- Search input containing only surrounding whitespace behaves as no search; surrounding whitespace does not prevent an otherwise matching company name from being found.
- A stored company name retains its display casing, while search does not require the user to enter the same casing.
- Missing optional lifecycle comments or actor details do not prevent a company from being listed or inspected; unavailable context is presented without fabricated values.
- A lifecycle state with zero companies remains selectable even when the other state contains records.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow every active authenticated user to consult transport companies belonging to the user's operating site.
- **FR-002**: The system MUST deny consultation to unauthenticated users and users whose access is not active.
- **FR-003**: The consultation collection MUST include both available and archived transport companies while preserving each company's authoritative current lifecycle state.
- **FR-004**: The user experience MUST separate available and archived companies, select the available state by default, and show the count for each state.
- **FR-005**: Each listed company MUST expose its stable identity, current company name, and lifecycle status.
- **FR-006**: The system MUST keep archived companies readable through consultation while excluding them from every collection intended for selecting a transport company for new operational use.
- **FR-007**: The user MUST be able to search the currently selected lifecycle collection by all or part of the current company name, without letter case or surrounding whitespace affecting matching.
- **FR-008**: The currently selected lifecycle collection MUST use a deterministic ascending order by company name, with stable identity as the tie-breaker.
- **FR-009**: The user MUST be able to inspect one listed company without leaving the consultation context.
- **FR-010**: Available company details MUST include the most recent reactivation time, actor, and comment when that context exists.
- **FR-011**: Archived company details MUST include archive time, actor, and comment when that context exists.
- **FR-012**: The system MUST show distinct feedback for an empty lifecycle collection and for a search with no matches.
- **FR-013**: The system MUST show a clear loading state while consultation data is being obtained.
- **FR-014**: The system MUST show an understandable failure state and allow the user to retry after a retrieval failure.
- **FR-015**: Refreshing or retrying consultation MUST replace stale lifecycle information with the authoritative current state.
- **FR-016**: Consultation MUST remain read-only for users who are not authorized to administer transport companies.
- **FR-017**: This slice MUST NOT create, update, archive, reactivate, permanently delete, import, or synchronize transport companies.

### Key Entities *(include if feature involves data)*

- **Transport Company**: A site reference representing the company that operationally provides trucks. For this feature its consultation identity consists of a stable identifier, current company name, and current lifecycle status.
- **Transport Company Lifecycle Context**: The available archive or most recent reactivation information associated with a company, including the event time, responsible user, and optional comment.
- **Operating Site**: The operational scope that owns transport-company references and bounds which records an authorized user may consult.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of active user roles can open transport-company consultation, while unauthenticated and non-active users receive no transport-company data.
- **SC-002**: At least 90% of representative users can locate a named company, identify its lifecycle state, and open its details on their first attempt within 30 seconds.
- **SC-003**: For 95% of consultation attempts under normal operating conditions, users see the requested lifecycle collection or an explicit empty state within 2 seconds.
- **SC-004**: In all acceptance datasets, 100% of archived companies remain visible in archived consultation and 0% appear in available operational selections.
- **SC-005**: Every tested empty, no-match, loading, and retrieval-failure condition produces distinct user feedback, and every retryable failure can be recovered through the offered retry action once retrieval is available.

## Assumptions

- "Authorized user" means an authenticated user with active access to the operating organization, including observer and administrator roles; administration permissions are not required for read-only consultation.
- Each operating organization owns exactly one site, so the user's organization determines the site scope for transport-company records.
- A transport company requires only its current company name in this feature; codes, contacts, addresses, email addresses, phone numbers, and legal ownership are outside the domain model.
- The established Site Reference lifecycle supplies the `AVAILABLE` and `ARCHIVED` states and optional archive/reactivation context used by consultation.
- Available companies are the default view because they support current work; archived companies remain one explicit switch away for administration and historical understanding.
- Search operates on the currently selected lifecycle state. Changing lifecycle state does not change stored company data, and each state retains deterministic name ordering.
- Transport-company creation, update, archival, and reactivation are independently deliverable follow-up issues #218 through #221.
