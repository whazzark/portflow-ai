# Feature Specification: Update a Transport Company

**Feature Branch**: `feat/219-update-transport-company`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Let an authorized administrator update a transport company's mutable information. https://github.com/whazzark/portflow-ai/issues/219"

**Feature ID**: `GH-219`

**GitHub Issue**: [#219](https://github.com/whazzark/portflow-ai/issues/219)

**Parent Roadmap**: `specs/site-references/transport-resources/transport-companies/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct an Available Company's Name (Priority: P1)

As an authorized administrator, I want to change the name of an available transport company so that the reference used by operational users matches how the provider is actually known today.

**Why this priority**: Correcting the name of a company that is in current operational use is the primary business outcome of the slice; without it the reference data drifts away from reality and operators select the wrong provider.

**Independent Test**: Sign in as an authorized administrator, open an available transport company, submit a new valid name, and verify that consultation shows the new name for the same company while its identity and lifecycle state are unchanged.

**Acceptance Scenarios**:

1. **Given** an available transport company exists, **When** an authorized administrator submits a different valid name for it, **Then** the company is saved with the new name and the administrator receives explicit confirmation of the change.
2. **Given** a company's name was just changed, **When** any active user consults transport companies, **Then** the company appears under its new name, keeps its stable identity, and remains in the available state.
3. **Given** a company's name was just changed, **When** its details are inspected, **Then** its existing archive or reactivation context is unchanged by the update.
4. **Given** an administrator opens the update experience for an available company, **When** the form is displayed, **Then** it is pre-filled with the company's current name.
5. **Given** an administrator submits the company's current name unchanged, **When** the update is processed, **Then** the request succeeds without reporting a duplicate and the company is left in its current state.

---

### User Story 2 - Be Prevented From Saving an Invalid or Duplicate Name (Priority: P2)

As an authorized administrator, I want invalid and already-used names to be rejected with a clear explanation so that transport-company references stay unambiguous and no partial change is applied.

**Why this priority**: Uniqueness and validity are what make the reference usable for selecting a provider; a duplicate or blank name silently accepted would corrupt every downstream selection.

**Independent Test**: Attempt to update a company with a blank name, an over-long name, and a name already used by another company, and verify that each attempt is refused with a distinct message and the stored company is untouched.

**Acceptance Scenarios**:

1. **Given** an available transport company, **When** an administrator submits an empty name or a name consisting only of whitespace, **Then** the update is refused with a validation message and the stored name is unchanged.
2. **Given** an available transport company, **When** an administrator submits a name longer than the allowed maximum length, **Then** the update is refused with a validation message and the stored name is unchanged.
3. **Given** another transport company already uses a given name, **When** an administrator submits that name, **Then** the update is refused as a duplicate, the message identifies the conflict, and neither company is modified.
4. **Given** another transport company uses a name differing only by letter case or surrounding whitespace, **When** an administrator submits that name, **Then** the update is refused as a duplicate.
5. **Given** a submitted name has leading or trailing whitespace but is otherwise valid and unused, **When** the update is processed, **Then** the surrounding whitespace is removed and the trimmed name is stored.
6. **Given** an update was refused, **When** the administrator corrects the name and resubmits, **Then** the update succeeds without the administrator having to reopen the company.

---

### User Story 3 - Be Blocked From Updating What Must Not Change (Priority: P3)

As the operating organization, I want updates refused for users without administration rights, for archived companies, and for companies that no longer exist so that lifecycle rules and authorization remain trustworthy.

**Why this priority**: These guard rails protect the integrity of the reference data, but they only matter once the successful update path exists.

**Independent Test**: Attempt updates as an unauthenticated visitor, as an active non-administrator, on an archived company, and on a company removed in the meantime; verify each attempt is refused with the appropriate outcome and no data changes.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** an update is attempted, **Then** it is refused and no transport-company data is exposed or modified.
2. **Given** an authenticated user whose access is not active or who holds no transport-company administration right, **When** an update is attempted, **Then** it is refused as unauthorized and the company is unchanged.
3. **Given** an active user without administration rights consults transport companies, **When** the company details are displayed, **Then** no update action is offered.
4. **Given** an archived transport company, **When** an administrator attempts to update it, **Then** the update is refused because archived companies are read-only, and the message states that reactivation is required first.
5. **Given** a transport company identifier that does not exist, **When** an administrator attempts to update it, **Then** the update is refused as not found without revealing other company data.

### Edge Cases

- A company archived by another administrator after the update form was opened is refused on submission as read-only rather than being silently updated.
- A company renamed by another administrator after the update form was opened does not have that change silently reverted without the administrator being informed of the resulting outcome.
- Two administrators submitting the same new name concurrently result in exactly one success and one duplicate refusal; no two companies end up sharing a name.
- A name whose only difference from the stored name is surrounding whitespace is treated as unchanged rather than as a duplicate of itself.
- A name containing accented or non-Latin characters is accepted as long as it is non-empty and within the maximum length.
- A submitted name at exactly the maximum allowed length is accepted; one character beyond it is refused.
- An update that fails because the change could not be saved leaves the company exactly as it was and offers the administrator a way to retry.
- Trucks already attached to the company remain attached across the rename and display the new company name.
- Previously generated immutable report snapshots and closed historical records keep the company name captured at the time they were produced.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a user holding transport-company administration rights within the operating organization to update an existing transport company.
- **FR-002**: The system MUST deny the update to unauthenticated users, to users whose access is not active, and to authenticated users without transport-company administration rights.
- **FR-003**: The updatable information of a transport company MUST be limited to its company name.
- **FR-004**: The system MUST reject an update whose name is empty or consists only of whitespace.
- **FR-005**: The system MUST reject an update whose name exceeds the maximum site-reference name length of 255 characters.
- **FR-006**: The system MUST remove leading and trailing whitespace from the submitted name before validating, comparing, and storing it.
- **FR-007**: The system MUST reject an update whose resulting name is already used by another transport company, comparing names without regard to letter case or surrounding whitespace.
- **FR-008**: The system MUST accept an update that resubmits the company's own current name and MUST NOT report it as a duplicate.
- **FR-009**: The system MUST refuse the update of an archived transport company and MUST report that the company is read-only until it is reactivated.
- **FR-010**: The system MUST refuse the update of a transport company that does not exist, without disclosing information about other companies.
- **FR-011**: A successful update MUST preserve the company's stable identity, its lifecycle status, and its existing archive and reactivation context.
- **FR-012**: A refused update MUST leave the stored transport company entirely unchanged.
- **FR-013**: The system MUST make the updated name the authoritative name in every subsequent consultation, selection, and detail view of that company.
- **FR-014**: The system MUST preserve every existing association between the company and its trucks across an update.
- **FR-015**: The system MUST NOT retroactively alter company names already captured in immutable report snapshots or other closed historical records.
- **FR-016**: The update experience MUST be pre-filled with the company's current name and MUST be offered only to users authorized to perform the update.
- **FR-017**: The system MUST report the outcome of an update attempt to the administrator, distinguishing success, validation failure, duplicate name, archived company, company not found, unauthorized access, and retryable save failure.
- **FR-018**: The administrator MUST be able to correct a refused submission and resubmit it without reopening the company.
- **FR-019**: The administrator MUST be able to abandon an update in progress, leaving the company unchanged.
- **FR-020**: Authorization and validation decisions MUST be enforced authoritatively by the system regardless of what the user experience offers.
- **FR-021**: This slice MUST NOT create, archive, reactivate, permanently delete, import, or synchronize transport companies, and MUST NOT change truck records.

### Key Entities *(include if feature involves data)*

- **Transport Company**: A site reference representing a company that operationally provides trucks. It carries a stable identity, a current company name, and a lifecycle status; only the company name is mutable through this feature.
- **Transport Company Lifecycle Context**: The archive and most recent reactivation information attached to a company. It determines whether the company may be updated and is never modified by an update.
- **Administrator**: An authenticated user with active access and transport-company administration rights within the operating organization; the only actor permitted to perform the update.
- **Operating Site**: The operational scope that owns transport-company references and bounds which records an administrator may update.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of update attempts by authorized administrators on available companies succeed, and 100% of attempts by unauthenticated visitors, non-active users, and active non-administrators are refused without any data change.
- **SC-002**: In acceptance testing, 100% of attempts to update an archived or non-existent company are refused with the corresponding outcome and leave stored data unchanged.
- **SC-003**: Across all acceptance datasets, 0% of transport companies end up sharing a name under case-insensitive comparison, including under concurrent submissions of the same new name.
- **SC-004**: At least 90% of representative administrators can locate a company and complete a name correction on their first attempt within 60 seconds.
- **SC-005**: For 95% of update submissions under normal operating conditions, the administrator sees a confirmed result or an explicit refusal within 2 seconds.
- **SC-006**: Every tested refusal condition — blank name, over-long name, duplicate name, archived company, company not found, unauthorized access, and retryable save failure — produces a distinct, understandable message, and 100% of retryable failures can be recovered through the offered retry or resubmission.
- **SC-007**: In all acceptance datasets, 100% of updated companies keep their identity, lifecycle state, lifecycle context, and truck associations, and 100% of previously captured historical company names remain unchanged.

## Assumptions

- "Authorized administrator" means an authenticated user with active access holding an organization-level or operations-level administration role, consistent with the administration rights already governing customer and operational-checkpoint site references.
- Each operating organization owns exactly one site, so the administrator's organization determines the site scope for transport-company records.
- The only mutable business information of a transport company is its company name. The domain deliberately excludes codes, contacts, addresses, email addresses, phone numbers, and legal ownership, in line with the transport-company consultation slice (#217).
- Company names are unique across all transport companies, available and archived alike, compared without regard to letter case, following the uniqueness rule already applied to customer company names and dock names.
- The maximum name length and whitespace-trimming behavior follow the established site-reference name rules shared by the other site references.
- Archived companies are read-only; changing an archived company's name requires reactivation first, which is the separate slice #221.
- Lifecycle transitions record their own actor, time, and comment. A name update is not a lifecycle transition and therefore captures no archive or reactivation context.
- Renaming a company does not rewrite history: immutable report snapshots and closed records keep the name captured when they were produced.
- Trucks reference their transport company by its stable identity, so a rename is reflected wherever the company name is displayed without any truck record changing.
- Transport-company records already exist through the seeded site-reference fixtures, so this slice is deliverable independently of the creation slice #218.
- Transport-company listing and consultation (#217), creation (#218), archival (#220), and reactivation (#221) are independently deliverable sibling issues and stay outside this slice.
