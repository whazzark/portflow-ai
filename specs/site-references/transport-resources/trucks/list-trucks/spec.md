# Feature Specification: List Trucks

**Feature Branch**: `feat/222-list-trucks`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "Let an authorized user consult available and archived trucks with their transport company. https://github.com/whazzark/portflow-ai/issues/222"

**Feature ID**: `GH-222`

**GitHub Issue**: [#222](https://github.com/whazzark/portflow-ai/issues/222)

**Parent Roadmap**: `specs/site-references/transport-resources/trucks/roadmap.md`

**Domain**: site-references

## Clarifications

### Session 2026-08-01

- Q: Which trucks may each active role consult? → A: Every active user may consult available trucks; only organization administrators and operations administrators may also consult archived trucks.
- Q: What maximum acceptance dataset must remain usable within 2 seconds? → A: Up to 1,000 trucks per site.
- Q: How must the complete and available truck collections be exposed? → A: Follow Docks and Weighing Areas: one administrator-only complete collection and one available-only collection for every active user.

### Session 2026-08-02

- Q: How should companies and trucks be arranged in the consultation workspace? → A: Use one integrated view with transport companies on the left and the trucks on the right; no synthetic “All trucks” company row is needed.
- Q: How does a user return from a company-filtered collection to all trucks? → A: Clicking the already selected company again clears the selection and restores all trucks permitted to the role.
- Q: How should resource details remain accessible in the integrated view? → A: A company row filters trucks, a secondary company action opens company details in a side panel, and selecting a truck opens its details in a side panel.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Trucks by Lifecycle State (Priority: P1)

As an active user, I want to consult the site's trucks that my role permits, together with each truck's transport company, so that I can identify vehicles usable for current work while authorized administrators retain access to retired references.

**Why this priority**: Distinguishing trucks available for operations from trucks retained only for history, while identifying their provider, is the primary outcome of the feature.

**Independent Test**: Sign in as every active role with both lifecycle states represented and verify that all roles can consult available trucks with their transport company, while only organization administrators and operations administrators can access archived trucks or archived counts.

**Acceptance Scenarios**:

1. **Given** the site has available and archived trucks, **When** any active user opens truck consultation, **Then** available trucks are shown by default with their available count.
2. **Given** an organization administrator or operations administrator opens truck consultation, **When** the collection loads, **Then** archived trucks and their count are accessible in a distinct lifecycle view.
3. **Given** an active operations lead or observer opens truck consultation or restores an archived-view URL, **When** the collection loads, **Then** no archived truck, archived count, or archived-view control is disclosed.
4. **Given** a truck appears in a lifecycle collection permitted to the user, **When** the user reviews its entry, **Then** the truck's registration, transport-company name, and lifecycle status are visible.
5. **Given** an archived truck exists, **When** an authorized administrator consults trucks, **Then** that truck remains readable but does not appear among trucks available for new operational use.

---

### User Story 2 - Find and Inspect a Truck (Priority: P2)

As an active user, I want to find and inspect a truck within the lifecycle scope permitted to my role so that I can confirm I have the intended vehicle, its provider, and whether it is usable.

**Why this priority**: A truck collection becomes operationally useful when users can locate the intended vehicle, distinguish similarly described vehicles, and verify the provider and carrying capacity attached to it.

**Independent Test**: Populate each lifecycle state with several trucks from multiple transport companies, find a truck by its identifying information, open it, and verify its registration, model, capacity, current transport company, status, and relevant lifecycle context.

**Acceptance Scenarios**:

1. **Given** several trucks exist in the selected lifecycle state, **When** the user searches by all or part of a registration without matching letter case or surrounding whitespace, **Then** only matching trucks in that state are shown.
2. **Given** several trucks exist in the selected lifecycle state, **When** the user searches by all or part of a transport-company name, **Then** trucks currently provided by matching companies are shown without changing the selected lifecycle state.
3. **Given** several trucks exist in the selected lifecycle state, **When** the collection is displayed, **Then** trucks are ordered predictably by registration.
4. **Given** the user selects an available truck, **When** its details open, **Then** the user can read its stable identity, current registration, vehicle model when recorded, capacity in tonnes, current transport company, available status, and any most recent reactivation context.
5. **Given** an authorized administrator selects an archived truck, **When** its details open, **Then** the administrator can read the same truck information, its archived status, and available archival context including when, by whom, and why it was archived.

---

### User Story 3 - Recover From Empty and Failed Consultation (Priority: P3)

As an active user, I want clear empty, no-match, loading, and failure feedback within my permitted truck scope so that I know whether no trucks exist, my search found nothing, or consultation must be retried.

**Why this priority**: Clear state feedback prevents an empty collection or temporary failure from being mistaken for missing permissions, missing vehicles, or lost reference data.

**Independent Test**: Open truck consultation with no records, with a search that has no matches, and with a retryable retrieval failure; verify that each state has distinct guidance and that retry can recover the collection.

**Acceptance Scenarios**:

1. **Given** no trucks exist in the selected lifecycle state, **When** the collection is displayed, **Then** the user sees an empty-state message specific to that lifecycle state.
2. **Given** trucks exist but none match the user's search, **When** the search is applied, **Then** the user sees a no-match message without being told that the lifecycle collection itself is empty.
3. **Given** truck information cannot be retrieved, **When** consultation fails, **Then** the user sees an understandable failure message and an action to retry.
4. **Given** a previous retrieval failed and retrieval is available again, **When** the user retries, **Then** the current truck collection and transport-company information are displayed.

### Edge Cases

- An unauthenticated visitor or a user whose access is not active is denied truck consultation without exposing truck or transport-company data.
- An active operations lead or observer who requests archived consultation receives no archived truck, archived count, or archived lifecycle context; the experience returns to the available collection.
- An active operations lead or observer who directly requests the complete collection is denied, while the available-only collection remains accessible.
- A truck whose lifecycle state or transport-company assignment changes while the user is consulting a stale collection appears with its authoritative current state and provider after the collection is refreshed or retried.
- A selected truck that is no longer present in the current collection is not replaced by another truck; the invalid detail state closes or returns to the collection.
- Search input containing only surrounding whitespace behaves as no search; surrounding whitespace does not prevent an otherwise matching registration or company name from being found.
- Registrations and company names retain their display casing, while search does not require users to enter the same casing.
- An archived truck remains identifiable when its transport company is also archived; both lifecycle states are presented independently without implying that the truck-company relationship has been removed.
- Missing optional vehicle-model or lifecycle details do not prevent a truck from being listed or inspected; absent values are shown as an explicit, muted italic `Not specified` placeholder without fabricated values.
- A lifecycle state with zero trucks remains selectable even when the other state contains records.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow every active authenticated user to consult available trucks belonging to the user's operating site.
- **FR-002**: The system MUST additionally allow active organization administrators and operations administrators to consult archived trucks belonging to their operating site.
- **FR-003**: The system MUST deny all truck consultation to unauthenticated users and users whose access is not active, and MUST withhold every archived truck and archived aggregate from active users outside the organization-administrator and operations-administrator roles.
- **FR-004**: The system MUST expose the complete available-and-archived collection and the available-only collection through distinct read contracts, matching the established Docks and Weighing Areas structure; the complete collection MUST be restricted to authorized administrators and the available-only collection MUST be accessible to every active authenticated user.
- **FR-005**: The user experience MUST select available trucks by default and show their count to every active user; it MUST expose a separate archived view and archived count only to organization administrators and operations administrators.
- **FR-006**: Each listed truck MUST expose its stable identity, current registration, current transport-company name, and lifecycle status.
- **FR-007**: Each truck MUST be associated with exactly one current transport company, and consultation MUST present that relationship for every truck permitted to the user.
- **FR-008**: The system MUST keep archived trucks readable to authorized administrators while excluding them from non-administrator consultation and every collection intended for selecting a truck for new operational use.
- **FR-009**: The user MUST be able to search the currently selected permitted lifecycle collection by all or part of a truck registration or current transport-company name, without letter case or surrounding whitespace affecting matching.
- **FR-010**: The currently selected lifecycle collection MUST use a deterministic ascending order by registration, with stable identity as the tie-breaker.
- **FR-011**: The user MUST be able to inspect one listed truck without leaving the consultation context.
- **FR-012**: Truck details MUST include stable identity, current registration, vehicle model when recorded, capacity expressed in tonnes, current transport company, and lifecycle status.
- **FR-013**: Available truck details MUST include the most recent reactivation time, actor, and comment when that context exists.
- **FR-014**: Archived truck details MUST include archive time, actor, and comment when that context exists and MUST be disclosed only to authorized administrators.
- **FR-015**: The system MUST show distinct feedback for an empty lifecycle collection and for a search with no matches.
- **FR-016**: The system MUST show a clear loading state while consultation data is being obtained.
- **FR-017**: The system MUST show an understandable failure state and allow the user to retry after a retrieval failure.
- **FR-018**: Refreshing or retrying consultation MUST replace stale lifecycle and transport-company information with the authoritative current state permitted to the user.
- **FR-019**: An invalid, stale, or no-longer-permitted truck selection MUST NOT display a different truck and MUST return the user to a valid collection state.
- **FR-020**: Consultation MUST remain read-only for every permitted role; mutation capabilities belong to separate delivery slices.
- **FR-021**: This slice MUST NOT create, update, archive, reactivate, permanently delete, import, synchronize, assign to a discharge, or otherwise select trucks for operational work.
- **FR-022**: The default consultation workspace MUST display transport companies in a left directory and trucks in a right directory; it MUST NOT require a synthetic company representing all trucks.
- **FR-023**: Selecting a transport company MUST filter the right directory and its lifecycle counts to that company's trucks; selecting the same company again MUST clear the filter and restore all trucks permitted to the role.
- **FR-024**: The workspace MUST provide independent company-name and truck registration/company searches, and MUST preserve the selected company while searching within either directory.
- **FR-025**: The workspace MUST keep company and truck inspection available through side panels without navigating away from the filtered consultation context.

### Key Entities *(include if feature involves data)*

- **Truck**: A vehicle registered for the site and provided by exactly one transport company at a time. For consultation it has a stable identity, mandatory current registration, optional vehicle model, capacity in tonnes, current lifecycle status, and optional lifecycle context.
- **Truck Registration**: The mandatory business identifier displayed on a truck's registration plate and used to distinguish it from every other available or archived truck at the site.
- **Transport Company**: The site reference that currently provides a truck for operational use. Its stable relationship and current name identify the provider shown with the truck, whether either reference is available or archived.
- **Truck Lifecycle Context**: The available archive or most recent reactivation information associated with a truck, including the event time, responsible user, and optional comment.
- **Operating Site**: The operational scope that owns truck and transport-company references and bounds which records an authorized user may consult.
- **Authorized Administrator**: An active organization administrator or operations administrator permitted to consult the site's complete available and archived truck collection.
- **Authorized User**: Any active authenticated user permitted to consult available trucks; archived consultation additionally requires an authorized administrator role.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of active roles can consult available trucks, 100% of organization-administrator and operations-administrator attempts can additionally consult archived trucks, and 100% of unauthenticated or non-active attempts receive no truck or transport-company data.
- **SC-002**: At least 90% of representative users can locate a named truck, identify its lifecycle state and transport company, and open its details on their first attempt within 30 seconds.
- **SC-003**: For a site with up to 1,000 trucks, users see the requested lifecycle collection or an explicit empty state within 2 seconds for at least 95% of consultation attempts under normal operating conditions.
- **SC-004**: In all acceptance datasets, 100% of trucks permitted to the requesting role are shown with the correct current transport company and lifecycle state, with no truck duplicated across lifecycle collections.
- **SC-005**: In all acceptance datasets, 100% of archived trucks remain visible to authorized administrators, while 0% of archived trucks, counts, or lifecycle context are disclosed to other active roles or appear in available operational selections.
- **SC-006**: Every tested empty, no-match, loading, stale-selection, and retrieval-failure condition produces distinct and accurate user feedback, and every retryable failure can be recovered through the offered retry action once retrieval is available.

## Assumptions

- "Authorized user" means any authenticated user with active access to the operating organization for available-truck consultation; only organization administrators and operations administrators are authorized for archived-truck consultation.
- Each operating organization owns exactly one site, so the user's organization determines the site scope for truck and transport-company records.
- Available and archived are the only truck lifecycle states relevant to consultation.
- A truck has one mandatory registration, one capacity expressed in tonnes, one optional free-text vehicle model, and exactly one current transport company.
- Truck registrations are unique across all available and archived trucks within the site; consultation does not reconcile duplicates or historical registration values.
- The consultation experience is expected to remain usable for sites containing up to 1,000 trucks across both lifecycle states.
- Available trucks are the default view for every active role. Archived trucks remain one explicit switch away only for organization administrators and operations administrators.
- Consultation uses the complete collection for authorized administrators and the separate available-only collection for other active roles; the browser never derives non-administrator visibility from a payload containing archived trucks.
- Search operates on the currently selected lifecycle state and matches the truck's current registration or current transport-company name. Changing lifecycle state does not change stored truck data, and each state retains deterministic registration ordering.
- The established Site Reference lifecycle supplies the `AVAILABLE` and `ARCHIVED` states and optional archive/reactivation context used by consultation.
- Truck creation, update, archival, and reactivation are independently deliverable follow-up issues #223 through #226.
- No transport company is selected initially; the right directory therefore starts with all trucks permitted to the role.
- Clicking a selected company toggles the filter off; there is no synthetic “All trucks” company item.
- Company and truck searches are independent and do not implicitly change the selected company or lifecycle state.
