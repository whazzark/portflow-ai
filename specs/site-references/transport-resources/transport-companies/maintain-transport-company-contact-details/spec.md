# Feature Specification: Maintain Transport Company Contact Details

**Feature Branch**: `feat/254-transport-company-details`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Let an authorized administrator record and maintain how to reach a transport company, so operations can contact the provider responsible for the trucks a shift depends on. https://github.com/whazzark/portflow-ai/issues/254"

**Feature ID**: `GH-254`

**GitHub Issue**: [#254](https://github.com/whazzark/portflow-ai/issues/254)

**Parent Roadmap**: `specs/site-references/transport-resources/transport-companies/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record and Correct How to Reach a Company (Priority: P1)

As an authorized administrator, I want to record and later correct the phone number and email address of an existing transport company so that operations can reach the provider responsible for the trucks a shift depends on.

**Why this priority**: This is the primary business outcome of the slice. Transport companies already exist in the directory, so widening the update path is what first makes a company reachable; without it a truck-shortage downtime leaves operations with a company name and no way to act on it.

**Independent Test**: Sign in as an authorized administrator, open an available transport company that has no contact details, submit a valid phone number and email address, and verify that the company's details panel shows them afterwards while its name, identity, and lifecycle state are unchanged.

**Acceptance Scenarios**:

1. **Given** an available transport company with no contact details recorded, **When** an authorized administrator submits a valid phone number and email address for it, **Then** both are saved and the administrator receives explicit confirmation of the change.
2. **Given** a transport company with contact details recorded, **When** an authorized administrator opens the update experience, **Then** the form is pre-filled with the company's current name, phone number, and email address.
3. **Given** a transport company with contact details recorded, **When** an authorized administrator submits a different valid phone number and email address, **Then** the previous values are replaced and the company keeps its identity, name, and lifecycle state.
4. **Given** an administrator submits the company's current name and contact details unchanged, **When** the update is processed, **Then** the request succeeds without reporting a duplicate and the company is left in its current state.
5. **Given** an administrator changes only the company name and resubmits the current contact details, **When** the update is processed, **Then** the name changes and the contact details are preserved.
6. **Given** a transport company registered before this feature and therefore holding no contact details, **When** an administrator updates it, **Then** the update is accepted only once a valid phone number and email address are supplied.

---

### User Story 2 - See How to Reach a Company From the Directory (Priority: P2)

As an operational user consulting the transport-company directory, I want to see a company's phone number and email address so that I can reach the provider without asking an administrator.

**Why this priority**: Recording the details delivers no value until the people handling a truck shortage can read them; this story turns stored data into the operational outcome the issue asks for.

**Independent Test**: With one company that has contact details recorded and one registered before this feature that has none, consult both as an active non-administrator and verify that the first shows its phone number and email address and the second shows an explicit "not recorded" state.

**Acceptance Scenarios**:

1. **Given** a transport company with contact details recorded, **When** any active user consults its details, **Then** its phone number and email address are displayed under a clearly labelled contact section.
2. **Given** a transport company registered before this feature with no contact details recorded, **When** any active user consults its details, **Then** the contact section states explicitly that no contact details are recorded rather than showing blank fields.
3. **Given** an archived transport company with contact details recorded, **When** any active user consults its details, **Then** its contact details remain visible in read-only form.
4. **Given** an active user without administration rights, **When** the company details are displayed, **Then** the contact details are readable and no action to change them is offered.

---

### User Story 3 - Capture Contact Details When Registering a Company (Priority: P3)

As an authorized administrator, I want to record a new transport company's phone number and email address at the moment I register it so that no company ever enters the directory unreachable.

**Why this priority**: Capturing details at creation is what keeps the directory reachable going forward, but the outcome is already obtainable through the update path, so this closes the gap rather than opening it.

**Independent Test**: Create a new transport company supplying a phone number and an email address in the same submission, and verify the created company is immediately consultable with those details recorded.

**Acceptance Scenarios**:

1. **Given** an authorized administrator registering a new transport company, **When** a valid name, phone number, and email address are supplied together, **Then** the company is created with those details recorded and immediately visible in its details panel.
2. **Given** an authorized administrator registering a new transport company, **When** the phone number or the email address is missing, **Then** the creation is refused with a validation message and no transport company is created.
3. **Given** a creation attempt is refused for any reason, **When** the outcome is reported, **Then** no transport company is created and no contact detail is stored.

---

### User Story 4 - Be Prevented From Saving Unusable Contact Details (Priority: P4)

As an authorized administrator, I want missing and malformed contact details to be rejected with a clear explanation so that recorded details can actually be used to reach the company and no partial change is applied.

**Why this priority**: A stored but unusable phone number or email address is worse than none, because operations discovers the problem only during an incident. The guard rail matters once the recording path exists.

**Independent Test**: Submit each contact field missing, malformed, and over-long, and verify each attempt is refused with a distinct message while the stored company is untouched.

**Acceptance Scenarios**:

1. **Given** an available transport company, **When** an administrator submits an email address that is not a valid email address, **Then** the submission is refused with a validation message and the stored company is unchanged.
2. **Given** an available transport company, **When** an administrator submits a phone number that does not follow an acceptable phone-number format, **Then** the submission is refused with a validation message and the stored company is unchanged.
3. **Given** an available transport company, **When** an administrator submits an empty or whitespace-only phone number or email address, **Then** the submission is refused as a missing required detail and the stored company is unchanged.
4. **Given** an available transport company, **When** an administrator submits a contact value longer than its allowed maximum length, **Then** the submission is refused with a validation message and the stored company is unchanged.
5. **Given** a contact value has leading or trailing whitespace but is otherwise valid, **When** the submission is processed, **Then** the surrounding whitespace is removed and the trimmed value is stored.
6. **Given** a submission was refused, **When** the administrator corrects the offending value and resubmits, **Then** the submission succeeds without the administrator having to reopen the company.
7. **Given** a submission contains an invalid name, an invalid phone number, and an invalid email address, **When** it is processed, **Then** all three offending fields are reported together and nothing is saved.

---

### User Story 5 - Be Blocked From Maintaining What Must Not Change (Priority: P5)

As the operating organization, I want contact-detail changes refused for users without administration rights, for archived companies, and for companies that no longer exist so that lifecycle rules and authorization remain trustworthy.

**Why this priority**: These guard rails protect the integrity of the reference data, but they only matter once the successful recording path exists.

**Independent Test**: Attempt to change contact details as an unauthenticated visitor, as an active non-administrator, on an archived company, and on a company removed in the meantime; verify each attempt is refused with the appropriate outcome and no data changes.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** a contact-detail change is attempted, **Then** it is refused and no transport-company data is exposed or modified.
2. **Given** an authenticated user whose access is not active or who holds no transport-company administration right, **When** a contact-detail change is attempted, **Then** it is refused as unauthorized and the company is unchanged.
3. **Given** an archived transport company, **When** an administrator attempts to change its contact details, **Then** the change is refused because archived companies are read-only, and the message states that reactivation is required first.
4. **Given** a transport company identifier that does not exist, **When** an administrator attempts to change its contact details, **Then** the attempt is refused as not found without revealing other company data.

### Edge Cases

- A company archived by another administrator after the update form was opened is refused on submission as read-only rather than being silently updated.
- When two administrators submit different changes to the same company concurrently, the later write wins and both submissions each receive their own confirmed outcome — the fresh, current record on success, or an explicit refusal — matching how a concurrent rename is already resolved for the company name; contact details carry no additional conflict-detection mechanism beyond that.
- A contact value consisting only of whitespace is refused as a missing required detail, never stored as a blank value.
- A contact value at exactly the maximum allowed length is accepted; one character beyond it is refused.
- A phone number expressed in international form with a leading `+`, and one expressed in national form with separators, are both accepted.
- An email address whose local or domain part contains non-ASCII characters is judged by the same validity rule as any other email address in the product, with no transport-company-specific exception.
- Two different transport companies may record the same phone number or email address; contact details carry no uniqueness rule.
- A company registered before this feature remains valid and consultable with no contact details, and is never auto-filled with placeholder values; the requirement applies to submissions, not to records at rest.
- A submission that fails because the change could not be saved leaves the company exactly as it was and offers the administrator a way to retry.
- Trucks already attached to the company remain attached and unaffected when its contact details change.
- Previously generated immutable report snapshots and closed historical records are unaffected by contact-detail changes; they never gain nor lose contact information retroactively.
- Recording contact details never changes the company's lifecycle status, archive context, or reactivation context.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a user holding transport-company administration rights within the operating organization to record and change the contact details of an existing transport company.
- **FR-002**: The system MUST allow the same administrator to supply contact details in the same submission that registers a new transport company.
- **FR-003**: The contact details of a transport company MUST consist of exactly two values: a contact phone number and a contact email address. No contact person, postal address, or other contact field is carried by this slice.
- **FR-004**: Both the contact phone number and the contact email address MUST be required in every accepted creation and update submission. There is no way to record only one of them, and no way to clear a recorded contact detail without replacing it.
- **FR-005**: The system MUST deny recording and changing contact details to unauthenticated users, to users whose access is not active, and to authenticated users without transport-company administration rights.
- **FR-006**: The system MUST refuse contact-detail changes on an archived transport company and MUST report that the company is read-only until it is reactivated.
- **FR-007**: The system MUST refuse contact-detail changes on a transport company that does not exist, without disclosing information about other companies.
- **FR-008**: The system MUST remove leading and trailing whitespace from every submitted contact value before validating and storing it, and MUST refuse a value that is empty or contains only whitespace as a missing required detail.
- **FR-009**: The system MUST reject a submitted email address that is not a syntactically valid email address.
- **FR-010**: The system MUST reject a submitted phone number that does not match an accepted phone-number format allowing international and national notations, digits, spaces, and the separators `+`, `-`, `.`, `(`, and `)`.
- **FR-011**: The system MUST reject a submitted contact value that exceeds its maximum length: 32 characters for the phone number and 255 characters for the email address.
- **FR-012**: The system MUST report every offending field of a refused submission together, so the administrator can correct them in one pass.
- **FR-013**: A refused submission MUST leave the stored transport company entirely unchanged, including its name and any previously recorded contact details.
- **FR-014**: The system MUST NOT apply any uniqueness rule to contact details; two transport companies may record identical phone numbers or email addresses.
- **FR-015**: A successful contact-detail change MUST preserve the company's stable identity, its name unless the name was deliberately changed in the same submission, its lifecycle status, and its existing archive and reactivation context.
- **FR-016**: The system MUST preserve every existing association between the company and its trucks across a contact-detail change.
- **FR-017**: The system MUST NOT retroactively alter or enrich transport-company information already captured in immutable report snapshots or other closed historical records.
- **FR-018**: The system MUST keep transport companies registered before this feature valid and consultable with no contact details recorded, MUST NOT fill them with placeholder values, and MUST require valid contact details before accepting any subsequent update of such a company.
- **FR-019**: Every user permitted to consult transport companies MUST be able to read a company's recorded contact details, including for archived companies.
- **FR-020**: The company details view MUST present contact details in a clearly labelled section and MUST state explicitly when no contact details are recorded, rather than showing empty values.
- **FR-021**: The update experience MUST be pre-filled with the company's current name and current contact details, and MUST be offered only to users authorized to change them.
- **FR-022**: The system MUST report the outcome of every submission to the administrator, distinguishing success, missing required contact detail, malformed contact detail, over-long value, duplicate company name, archived company, company not found, unauthorized access, and retryable save failure.
- **FR-023**: The administrator MUST be able to correct a refused submission and resubmit it without reopening the company, and MUST be able to abandon a submission in progress, leaving the company unchanged.
- **FR-024**: Authorization and validation decisions MUST be enforced authoritatively by the system regardless of what the user experience offers.
- **FR-025**: This slice MUST NOT send messages to a recorded contact, and MUST NOT archive, reactivate, permanently delete, import, or synchronize transport companies, nor change truck records.

### Key Entities *(include if feature involves data)*

- **Transport Company**: A site reference representing a company that operationally provides trucks. It carries a stable identity, a current company name, its contact details, and a lifecycle status.
- **Transport Company Contact Details**: The pair of values describing how to reach the company — a phone number and an email address — attached to exactly one transport company, always recorded together, subject to no uniqueness rule, and absent only on companies registered before this feature.
- **Transport Company Lifecycle Context**: The archive and most recent reactivation information attached to a company. It determines whether contact details may be changed and is never modified by such a change.
- **Administrator**: An authenticated user with active access and transport-company administration rights within the operating organization; the only actor permitted to record or change contact details.
- **Operating Site**: The operational scope that owns transport-company references and bounds which records an administrator may maintain.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of contact-detail submissions by authorized administrators on available companies succeed, and 100% of attempts by unauthenticated visitors, non-active users, and active non-administrators are refused without any data change.
- **SC-002**: In acceptance testing, 100% of attempts to change the contact details of an archived or non-existent company are refused with the corresponding outcome and leave stored data unchanged.
- **SC-003**: Every tested refusal condition — missing phone number, missing email address, malformed phone number, malformed email address, over-long value, duplicate company name, archived company, company not found, unauthorized access, and retryable save failure — produces a distinct, understandable message, and 100% of retryable failures can be recovered through the offered retry or resubmission.
- **SC-004**: At least 90% of representative administrators can locate a company and record its contact details on their first attempt within 90 seconds.
- **SC-005**: An operational user handling a truck shortage can obtain a reachable phone number for the responsible company from the directory in under 30 seconds, without leaving the transport-company directory and without asking an administrator.
- **SC-006**: For 95% of submissions under normal operating conditions, the administrator sees a confirmed result or an explicit refusal within 2 seconds.
- **SC-007**: In all acceptance datasets, 100% of companies whose contact details changed keep their identity, name, lifecycle state, lifecycle context, and truck associations, and 100% of previously captured historical records remain unchanged.
- **SC-008**: After this feature ships, 100% of transport companies created or updated through it carry both a phone number and an email address, and 100% of companies still holding none display an explicit "not recorded" state rather than empty values.

## Assumptions

- "Authorized administrator" means an authenticated user with active access holding an organization-level or operations-level administration role — the same right that already governs transport-company creation (#218) and update (#219).
- Each operating organization owns exactly one site, so the administrator's organization determines the site scope for transport-company records.
- Contact details are business reference data, not personal data requiring restricted visibility: any user permitted to consult the transport-company directory may read them. Restricting visibility further would defeat the operational outcome of reaching the provider during a truck shortage.
- A phone number and an email address are the only contact fields carried. A contact person and a postal address were deliberately excluded: the phone number serves the live truck-shortage call and the email address serves the written trail, while a named individual and an address serve neither and would age faster than the company itself.
- Requiring both details applies to submissions, not to stored records. Transport companies registered before this feature keep no contact details and are neither invalidated nor backfilled with placeholder values; the first administrator to update such a company supplies them at that moment. This deliberately avoids fabricating contact data that no one can verify.
- Contact details are held as current values only. This slice keeps no history of previous contact details; who changed them and when is covered by the transversal activity log, not by this feature.
- The company name keeps the rules established by #218 and #219 — non-blank, at most 255 characters, trimmed, unique across all companies without regard to letter case. This slice widens the accepted contract of both paths with the two contact fields and changes nothing about the name.
- Contact details carry no uniqueness rule, because several transport companies can legitimately share a dispatcher, a switchboard number, or a shared mailbox.
- Phone numbers are stored as submitted after trimming, without normalization to a canonical international format, because operations dials what was recorded.
- Email-address validity follows the rule already applied elsewhere in the product rather than a transport-company-specific one.
- Archived companies are read-only, so changing an archived company's contact details requires reactivation first, which is the separate slice #221.
- Trucks reference their transport company by its stable identity, so contact-detail changes are reflected wherever the company is displayed without any truck record changing.
- Transport-company listing and consultation (#217), archival (#220), and reactivation (#221) are independently deliverable sibling issues and stay outside this slice.
- Sending an email, an SMS, or any other message to a recorded contact is explicitly outside this issue, as stated in its scope boundary.
