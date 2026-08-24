# Feature Specification: Create a Transport Company

**Feature Branch**: `feat/218-create-transport-company`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Let an authorized administrator create a valid transport company. https://github.com/whazzark/portflow-ai/issues/218"

**Feature ID**: `GH-218`

**GitHub Issue**: [#218](https://github.com/whazzark/portflow-ai/issues/218)

**Parent Roadmap**: `specs/site-references/transport-resources/transport-companies/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register a New Transport Company (Priority: P1)

As an authorized administrator, I want to register a new transport company under the name it is known by so that operational users can immediately select it as the provider of the trucks arriving on site.

**Why this priority**: This is the core outcome of the slice. Until a company can be created, the transport-company reference can only be consulted or corrected, and every new provider the site starts working with is unusable until reference data is changed outside the product.

**Independent Test**: Sign in as an authorized administrator, open transport-company consultation, submit a unique valid name through the creation action, and verify a new available company with that name appears in the available collection without a manual refresh.

**Acceptance Scenarios**:

1. **Given** an authorized administrator is consulting transport companies, **When** the creation action is opened, **Then** an empty name entry is presented and no company exists yet.
2. **Given** the creation entry is open, **When** the administrator submits a unique, non-blank name, **Then** a new transport company is created with that name, and the administrator receives explicit confirmation of the creation.
3. **Given** a company was just created, **When** the available collection is displayed, **Then** the new company appears in it under the submitted name without the administrator having to refresh or navigate away.
4. **Given** a company was just created, **When** its details are inspected, **Then** it carries a stable identity, its submitted name, the available status, a creation time, and no archive or reactivation context.
5. **Given** the site has no transport company at all, **When** an authorized administrator creates the first one from the empty collection, **Then** the empty-state guidance is replaced by a collection containing exactly that company.
6. **Given** the creation entry is open with or without text typed, **When** the administrator abandons it, **Then** no company is created and the consultation returns to its normal state.

---

### User Story 2 - Be Prevented From Creating an Invalid or Duplicate Company (Priority: P2)

As an authorized administrator, I want blank, over-long, and already-used names to be refused with a clear explanation so that transport-company references stay unambiguous and no partial record is created.

**Why this priority**: Uniqueness and validity are what make the reference usable for selecting a provider. A blank or duplicated company name silently accepted would corrupt every downstream truck attachment and provider selection, and it only matters once the successful creation path exists.

**Independent Test**: Attempt creation with a blank name, a whitespace-only name, an over-long name, and a name already used by an available company and by an archived company; verify each attempt is refused with a distinct message and that no company is added to the dataset.

**Acceptance Scenarios**:

1. **Given** the creation entry is open, **When** the administrator submits an empty name or a name consisting only of whitespace, **Then** the creation is refused with a validation message and no company is created.
2. **Given** the creation entry is open, **When** the administrator submits a name longer than the allowed maximum length, **Then** the creation is refused with a validation message and no company is created.
3. **Given** an available transport company already uses a given name, **When** the administrator submits that name, **Then** the creation is refused as a duplicate, the message identifies the conflict, and the dataset is unchanged.
4. **Given** an archived transport company uses a given name, **When** the administrator submits that name, **Then** the creation is refused as a duplicate, because archived companies still reserve their name.
5. **Given** an existing transport company uses a name differing only by letter case or surrounding whitespace, **When** the administrator submits that name, **Then** the creation is refused as a duplicate.
6. **Given** a submitted name has leading or trailing whitespace but is otherwise valid and unused, **When** the creation is processed, **Then** the surrounding whitespace is removed and the trimmed name is stored.
7. **Given** a creation was refused, **When** the administrator corrects the name and resubmits, **Then** the creation succeeds without the administrator having to reopen the creation entry.

---

### User Story 3 - Be Blocked From Creating Without Administration Rights (Priority: P3)

As the operating organization, I want creation refused for unauthenticated visitors, for users whose access is not active, and for active users without transport-company administration rights so that reference data can only be extended by the people accountable for it.

**Why this priority**: This guard rail protects the integrity and traceability of the reference data, but it is only observable once the successful creation path exists.

**Independent Test**: Attempt creation as an unauthenticated visitor, as an authenticated user whose access is not active, and as an active non-administrator; verify each attempt is refused with the appropriate outcome, that no company is created, and that no creation action is offered to a non-administrator.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** creation is attempted, **Then** it is refused and no transport-company data is exposed or created.
2. **Given** an authenticated user whose access is not active, **When** creation is attempted, **Then** it is refused as unauthorized and no company is created.
3. **Given** an active user holding no transport-company administration right, **When** creation is attempted, **Then** it is refused as unauthorized and no company is created.
4. **Given** an active user without administration rights consults transport companies, **When** the collection is displayed, **Then** no creation action is offered.
5. **Given** the creation action is not offered in the interface, **When** the same creation is attempted directly against the system, **Then** it is still refused, because authorization is enforced by the system rather than by the interface.

### Edge Cases

- Two administrators submitting the same new name concurrently result in exactly one created company and one duplicate refusal; no two companies end up sharing a name.
- A company is created with a name whose only difference from an existing name is surrounding whitespace, and is refused as a duplicate rather than stored as a distinct company.
- A name at exactly the maximum allowed length is accepted; one character beyond it is refused.
- A name containing accented or non-Latin characters is accepted as long as it is non-empty and within the maximum length.
- A stored name keeps the display casing the administrator submitted, even though duplicate detection ignores case.
- A creation that fails because the record could not be saved leaves the dataset unchanged and offers the administrator a way to retry without retyping the name.
- A retried creation after an unclear failure does not produce two companies with the same name; the duplicate rule refuses the second attempt.
- A newly created company owns no trucks; it appears in provider selection as an available company with no truck attached.
- A company created while another user is consulting a stale collection appears once that collection is refreshed or retried.
- The archived collection is unaffected by a creation; a new company is never created directly in the archived state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a user holding transport-company administration rights within the operating organization to create a new transport company.
- **FR-002**: The system MUST deny creation to unauthenticated users, to users whose access is not active, and to authenticated users without transport-company administration rights.
- **FR-003**: The information supplied at creation MUST be limited to the company name.
- **FR-004**: The system MUST reject a creation whose name is empty or consists only of whitespace.
- **FR-005**: The system MUST reject a creation whose name exceeds the maximum site-reference name length of 255 characters.
- **FR-006**: The system MUST remove leading and trailing whitespace from the submitted name before validating, comparing, and storing it.
- **FR-007**: The system MUST reject a creation whose resulting name is already used by any existing transport company, available or archived, comparing names without regard to letter case or surrounding whitespace.
- **FR-008**: A successful creation MUST produce exactly one transport company with a stable identity that is unique and never reused.
- **FR-009**: A newly created transport company MUST be in the available lifecycle state and MUST carry no archive and no reactivation context.
- **FR-010**: A successful creation MUST record the creation time of the company.
- **FR-011**: A refused creation MUST leave the transport-company dataset entirely unchanged, with no partially created record.
- **FR-012**: A newly created transport company MUST be immediately usable in every subsequent consultation, search, and provider selection of available transport companies, without requiring the administrator to refresh or re-navigate.
- **FR-013**: The system MUST NOT attach, create, or modify any truck record as part of creating a transport company.
- **FR-014**: The creation experience MUST be offered only to users authorized to perform the creation, including from the empty transport-company collection.
- **FR-015**: The system MUST report the outcome of a creation attempt to the administrator, distinguishing success, validation failure, duplicate name, unauthorized access, and retryable save failure.
- **FR-016**: The administrator MUST be able to correct a refused submission and resubmit it without reopening the creation experience or retyping unaffected input.
- **FR-017**: The administrator MUST be able to abandon a creation in progress, leaving the dataset unchanged.
- **FR-018**: Authorization, validation, and uniqueness decisions MUST be enforced authoritatively by the system regardless of what the user experience offers.
- **FR-019**: The system MUST guarantee that concurrent creations of the same name result in at most one stored company bearing that name.
- **FR-020**: This slice MUST NOT update, archive, reactivate, permanently delete, import, or synchronize transport companies.

### Key Entities *(include if feature involves data)*

- **Transport Company**: A site reference representing a company that operationally provides trucks. It carries a stable identity, a company name, a lifecycle status, and a creation time. This feature adds a new one in the available state.
- **Transport Company Lifecycle Context**: The archive and most recent reactivation information attached to a company. A newly created company has none, and creation is not a lifecycle transition.
- **Administrator**: An authenticated user with active access and transport-company administration rights within the operating organization; the only actor permitted to create a transport company.
- **Operating Site**: The operational scope that owns transport-company references and bounds the collection within which company names must be unique.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of creation attempts by authorized administrators with a unique valid name succeed, and 100% of attempts by unauthenticated visitors, non-active users, and active non-administrators are refused without any company being created.
- **SC-002**: Across all acceptance datasets, 0% of transport companies share a name under case-insensitive comparison, including under concurrent submissions of the same name and across available and archived companies alike.
- **SC-003**: In acceptance testing, 100% of refused creations leave the transport-company record count unchanged, with no partially created company.
- **SC-004**: In acceptance testing, 100% of successfully created companies are available, carry no archive or reactivation context, own no truck, and are retrievable by their stable identity and their name.
- **SC-005**: At least 90% of representative administrators can create a transport company on their first attempt within 60 seconds, including from an empty collection.
- **SC-006**: For 95% of creation submissions under normal operating conditions, the administrator sees a confirmed result or an explicit refusal within 2 seconds, and the created company is visible in the available collection without a manual refresh.
- **SC-007**: Every tested refusal condition — blank name, whitespace-only name, over-long name, duplicate name, unauthorized access, and retryable save failure — produces a distinct, understandable message, and 100% of retryable failures can be recovered through the offered retry or resubmission without creating a second company.

## Assumptions

- "Authorized administrator" means an authenticated user with active access holding an organization-level or operations-level administration role, consistent with the administration rights already governing customer, dock, and transport-company update slices.
- Each operating organization owns exactly one site, so the administrator's organization determines the site scope of the created transport company.
- The only business information of a transport company is its company name. The domain deliberately excludes codes, contacts, addresses, email addresses, phone numbers, and legal ownership, in line with the transport-company consultation slice (#217) and the update slice (#219).
- Company names are unique across all transport companies, available and archived alike, compared without regard to letter case. The case-insensitive uniqueness constraint introduced by the update slice (#219) also governs creation; this slice adds no new uniqueness rule, it inherits and exercises it.
- The maximum name length of 255 characters and the whitespace-trimming behavior follow the established site-reference name rules shared by the other site references.
- A transport company is always created in the available state. Creating a company directly as archived is not a supported outcome; archival is the separate slice #220.
- Creation is individual: bulk creation, file import, and synchronization from an external provider registry are out of scope.
- Creation is not a lifecycle transition, so it records no archive or reactivation actor, time, or comment. Whether creation additionally records its own actor beyond the standard creation time is an implementation-level auditing concern deferred to planning, since no business behavior in this slice depends on it.
- Trucks reference their transport company by its stable identity, so a newly created company simply becomes selectable as a provider; attaching trucks to it belongs to the truck slices.
- Permanent deletion of a transport company does not exist in the domain; a company created in error is retired through archival (#220).
- Transport-company listing and consultation (#217), update (#219), archival (#220), and reactivation (#221) are independently deliverable sibling issues and stay outside this slice. The seeded site-reference fixtures already provide companies, so this slice is deliverable independently of them.
