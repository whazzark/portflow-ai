# Feature Specification: Create a Truck

**Feature Branch**: `feat/223-create-truck`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Let an authorized administrator register a valid truck with a transport company. https://github.com/whazzark/portflow-ai/issues/223"

**Feature ID**: `GH-223`

**GitHub Issue**: [#223](https://github.com/whazzark/portflow-ai/issues/223)

**Parent Roadmap**: `specs/site-references/transport-resources/trucks/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register a New Truck for a Transport Company (Priority: P1)

As an organization administrator or operations administrator, I want to register a new truck with its registration, capacity, and current transport company so that the truck immediately becomes available for operational use and consultation.

**Why this priority**: Without creation, the truck reference and provider relationship established by list consultation (#222) can never grow beyond seed data; this is the entry point for every later truck lifecycle action.

**Independent Test**: Sign in as an organization administrator or operations administrator, submit a unique registration, a positive capacity, and an available transport company, and verify the truck is created as available, appears in truck consultation with the correct provider, and no other data changes.

**Acceptance Scenarios**:

1. **Given** an organization administrator supplies a unique registration, a positive capacity in tonnes, and an available transport company, **When** the truck is submitted, **Then** a new available truck is created with that registration, capacity, and provider, and it appears immediately in truck consultation.
2. **Given** an operations administrator omits the optional vehicle model, **When** the truck is submitted with the remaining required fields valid, **Then** the truck is created without a vehicle model and consultation shows it as not specified.
3. **Given** a truck is successfully created, **When** its details are opened, **Then** it shows an available status with no archive or reactivation context.
4. **Given** an authorized administrator submits a registration that differs from an existing truck's registration only by letter case or surrounding whitespace, **When** the truck is submitted, **Then** creation is rejected as a duplicate and no new truck is created.

---

### User Story 2 - Prevent Invalid or Unauthorized Truck Registration (Priority: P2)

As the system, I want to reject truck registrations that are unauthorized, incomplete, or assigned to an unsuitable transport company so that the truck and transport-company reference data stays trustworthy for operational use.

**Why this priority**: Registering trucks with missing identity, non-positive capacity, or an unsuitable provider would corrupt the reference data every later discharge and lifecycle workflow depends on.

**Independent Test**: Attempt creation as a non-administrator, as an unauthenticated visitor, with a blank or duplicate registration, with a zero or negative capacity, and with an archived or nonexistent transport company; verify every attempt is rejected, no truck is created, and each rejection carries a specific, understandable reason.

**Acceptance Scenarios**:

1. **Given** a user who is unauthenticated or whose access is not an organization administrator or operations administrator, **When** they attempt to create a truck, **Then** the attempt is denied and no truck is created.
2. **Given** a blank, whitespace-only, or missing registration, **When** creation is attempted, **Then** the attempt is rejected with a specific validation reason and no truck is created.
3. **Given** a capacity of zero, a negative value, or a non-numeric value, **When** creation is attempted, **Then** the attempt is rejected with a specific validation reason and no truck is created.
4. **Given** a transport company that is archived or no longer exists, **When** creation is attempted, **Then** the attempt is rejected with a specific validation reason and no truck is created.
5. **Given** a registration that already belongs to an available or archived truck, **When** creation is attempted, **Then** the attempt is rejected as a duplicate and no truck is created.

---

### User Story 3 - Recover From Creation Failures (Priority: P3)

As an organization administrator or operations administrator, I want clear feedback and a safe retry path when truck creation fails so that I can correct my input or retry a transient failure without producing a duplicate or partial truck.

**Why this priority**: Without distinct, recoverable feedback, an administrator cannot tell whether a failed submission left a truck partially created, and may retry blindly and create duplicates.

**Independent Test**: Trigger a validation failure, a duplicate-registration conflict, and a transient retrieval failure in turn; verify each produces distinct guidance, the truck list is never left with a partial or duplicate record, and correcting the input or retrying after a transient failure succeeds.

**Acceptance Scenarios**:

1. **Given** a creation attempt fails validation, **When** the administrator corrects the reported field and resubmits, **Then** the truck is created successfully and no earlier failed attempt leaves residual data.
2. **Given** a creation attempt fails because the underlying service is temporarily unavailable, **When** the administrator retries after the service recovers, **Then** the truck is created exactly once.
3. **Given** a creation attempt is submitted twice in quick succession with identical data, **When** both submissions are processed, **Then** at most one truck is created and the second attempt is rejected as a duplicate.

### Edge Cases

- An unauthenticated visitor or a user whose access is not active is denied truck creation without exposing whether the submitted registration already exists.
- An active operations lead or observer who attempts creation is denied even though they may consult available trucks.
- A registration that matches an existing truck only after trimming surrounding whitespace or normalizing letter case is treated as a duplicate.
- A capacity submitted with more precision than the stored decimal scale is rejected or normalized consistently rather than silently truncated in a way that changes the intended value.
- A transport company that becomes archived between when the administrator opens the creation form and when they submit is rejected at submission time with a current, actionable reason.
- A vehicle model value longer than the stored maximum length is rejected with a specific validation reason.
- Two administrators submitting different trucks with the same registration at nearly the same time result in exactly one truck created and the other rejected as a duplicate.
- A submitted registration, vehicle model, or transport-company reference containing only whitespace is treated as blank or missing rather than accepted as-is.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow only active organization administrators and operations administrators to create a truck.
- **FR-002**: The system MUST deny truck creation to unauthenticated users and to every active role other than organization administrator and operations administrator, without creating a truck or disclosing existing registrations.
- **FR-003**: The system MUST require a non-blank registration, a positive capacity expressed in tonnes, and a reference to exactly one transport company for every new truck.
- **FR-004**: The system MUST accept an optional vehicle model and MUST create the truck without one when it is omitted.
- **FR-005**: The system MUST reject a registration that duplicates an existing available or archived truck's registration without regard to letter case or surrounding whitespace, and MUST leave the dataset unchanged.
- **FR-006**: The system MUST reject a capacity that is zero, negative, or not a valid positive decimal value, and MUST leave the dataset unchanged.
- **FR-007**: The system MUST reject an assigned transport company that does not exist or is archived, and MUST leave the dataset unchanged.
- **FR-008**: The system MUST trim surrounding whitespace from the registration and vehicle model before validation and storage, and MUST preserve the submitted display casing.
- **FR-009**: A successfully created truck MUST start in the available lifecycle status with no archive or reactivation context.
- **FR-010**: A successfully created truck MUST be assigned a stable, system-generated identity and MUST become immediately visible in truck consultation with its registration, capacity, vehicle model when provided, and current transport company.
- **FR-011**: The system MUST report validation, duplicate, authorization, and transient failures with distinct, understandable, and actionable feedback, and MUST NOT create a truck when any such failure occurs.
- **FR-012**: The system MUST ensure that two creation attempts submitting the same registration result in at most one truck being created, with every later attempt rejected as a duplicate.
- **FR-013**: The creation experience MUST only offer transport companies that are currently available for assignment to a new truck.
- **FR-014**: This slice MUST NOT update, archive, reactivate, permanently delete, import, or bulk-create trucks; those actions remain owned by separate delivery slices.

### Key Entities *(include if feature involves data)*

- **Truck**: A vehicle newly registered for the site and provided by exactly one transport company. On creation it has a stable identity, mandatory unique registration, optional vehicle model, mandatory positive capacity in tonnes, and an available lifecycle status with no archive or reactivation context.
- **Truck Registration**: The mandatory business identifier displayed on a truck's registration plate; it must be unique, case-insensitively and whitespace-insensitively, across every available and archived truck at the site.
- **Transport Company**: The site reference assigned as a new truck's current provider; it must exist and be available at the time of creation.
- **Authorized Administrator**: An active organization administrator or operations administrator permitted to create a truck.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of organization-administrator and operations-administrator attempts with valid, unique input succeed and the new truck is visible in consultation immediately afterward.
- **SC-002**: In acceptance testing, 100% of attempts by unauthenticated users or by roles other than organization administrator and operations administrator are denied with zero trucks created.
- **SC-003**: In acceptance testing, 100% of attempts with a duplicate registration, non-positive capacity, or an archived or missing transport company are rejected with zero trucks created and a specific, actionable reason shown.
- **SC-004**: At least 90% of representative authorized administrators can successfully register a new truck on their first attempt within 60 seconds of opening the creation experience.
- **SC-005**: In all acceptance datasets, no two trucks ever share a registration once creation attempts complete, including under near-simultaneous duplicate submissions.
- **SC-006**: Every tested validation, duplicate, authorization, and transient-failure condition produces distinct and accurate feedback, and every transient failure can be recovered through a retry that creates exactly one truck.

## Assumptions

- "Authorized administrator" means an active organization administrator or an active operations administrator, matching the write-access pattern already established for Customers (`GH-193`) and for archived-truck consultation in List Trucks (`#222`).
- Registration uniqueness is case-insensitive and whitespace-trimmed across both available and archived trucks, consistent with the persisted uniqueness constraint established by List Trucks (`#222`).
- Capacity is expressed in tonnes as a positive decimal value; the stored precision matches the existing three-decimal scale used by List Trucks (`#222`).
- Vehicle model remains an optional free-text field with the same maximum length already established for site-reference display names.
- A newly created truck always starts in the available lifecycle status; creating a truck directly into an archived state is out of scope.
- A truck's transport company must be available at creation time; assigning an archived transport company is rejected outright rather than allowed with a warning.
- Truck creation is an individual action producing one truck per request; bulk or imported creation is out of scope for this slice.
- Update, archive, and reactivate remain independently deliverable follow-up issues (`#224`, `#225`, `#226`); this slice does not implement them.
- API authorization is authoritative for every rule in this specification; any interface-level restriction is a courtesy that does not replace server-side enforcement.
