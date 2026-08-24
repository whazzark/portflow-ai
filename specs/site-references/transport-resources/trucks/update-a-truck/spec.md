# Feature Specification: Update a Truck

**Feature Branch**: `feat/224-update-truck`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Let an authorized administrator update a truck's mutable information and provider assignment when allowed. https://github.com/whazzark/portflow-ai/issues/224"

**Feature ID**: `GH-224`

**GitHub Issue**: [#224](https://github.com/whazzark/portflow-ai/issues/224)

**Parent Roadmap**: `specs/site-references/transport-resources/trucks/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct an Available Truck's Own Information (Priority: P1)

As an organization administrator or operations administrator, I want to correct an available truck's registration, vehicle model, and capacity so that the truck reference used by operational users matches the vehicle actually present on the site today.

**Why this priority**: Registrations are re-plated, models are captured incorrectly at creation, and authorized payloads are revised. Without a correction path, the truck reference created by `#223` drifts away from reality and every capacity check and provider selection built on it becomes untrustworthy.

**Independent Test**: Sign in as an authorized administrator, open an available truck, submit a new valid registration, vehicle model, and capacity, and verify consultation shows the new values for the same truck while its identity, lifecycle status, and current provider are unchanged.

**Acceptance Scenarios**:

1. **Given** an available truck exists, **When** an authorized administrator submits a different valid registration, **Then** the truck is saved with the new registration, the administrator receives explicit confirmation, and truck consultation shows the new registration for the same truck identity.
2. **Given** an available truck exists, **When** an authorized administrator submits a different valid positive capacity in tonnes, **Then** the truck is saved with the new capacity and consultation reflects it immediately.
3. **Given** an available truck has a vehicle model, **When** an authorized administrator clears the vehicle model, **Then** the truck is saved without a vehicle model and consultation shows it as not specified.
4. **Given** an available truck has no vehicle model, **When** an authorized administrator supplies a valid vehicle model, **Then** the truck is saved with that vehicle model.
5. **Given** an administrator opens the update experience for an available truck, **When** the form is displayed, **Then** it is pre-filled with the truck's current registration, vehicle model, capacity, and current transport company.
6. **Given** an administrator resubmits the truck's current values unchanged, **When** the update is processed, **Then** the request succeeds without reporting a duplicate and the truck is left in its current state.
7. **Given** a truck's information was just updated, **When** its details are inspected, **Then** its stable identity, lifecycle status, and existing archive and reactivation context are unchanged by the update.

---

### User Story 2 - Reassign a Truck to Another Transport Company (Priority: P2)

As an organization administrator or operations administrator, I want to move an available truck to the transport company that actually provides it today so that provider information stays correct, while being prevented from doing so when the truck is committed to a planned or active discharge.

**Why this priority**: Provider reassignment is the second half of the issue's outcome and is the only truck change with a cross-workflow rule attached to it. It depends on the update path existing, and it must never silently rewrite the provider a discharge is already counting on.

**Independent Test**: Reassign an available truck that is not committed to any planned or active discharge to a different available transport company and verify consultation shows the new provider; then attempt the same reassignment on a truck assigned to a planned or active discharge and verify it is refused with the truck unchanged.

**Acceptance Scenarios**:

1. **Given** an available truck that is not assigned to any planned or active discharge, **When** an authorized administrator assigns it to a different available transport company, **Then** the reassignment is saved and consultation shows the truck under its new provider.
2. **Given** an available truck assigned to a planned or active discharge, **When** an authorized administrator attempts to assign it to a different transport company, **Then** the update is refused because the truck is committed to a discharge, the message states why, and the truck is entirely unchanged.
3. **Given** an available truck assigned to a planned or active discharge, **When** an authorized administrator updates only its registration, vehicle model, or capacity and keeps its current transport company, **Then** the update succeeds.
4. **Given** an available truck, **When** an authorized administrator submits a transport company that is archived or does not exist, **Then** the update is refused with a specific reason and the truck is entirely unchanged.
5. **Given** a truck has been reassigned to a new transport company, **When** an existing discharge truck assignment made before the reassignment is consulted, **Then** it still shows the registration and transport company captured at reservation time.
6. **Given** the update experience is opened for an available truck, **When** the transport-company choices are displayed, **Then** only currently available transport companies are offered, and the truck's own current company is shown as selected.

---

### User Story 3 - Be Prevented From Saving Invalid, Duplicate, or Forbidden Changes (Priority: P3)

As the operating organization, I want updates refused for invalid input, duplicate registrations, archived or missing trucks, and users without administration rights so that the truck reference stays unambiguous and no partial change is ever applied.

**Why this priority**: These guard rails protect the integrity of a reference every discharge, shift, and rotation depends on, but they only matter once the successful update and reassignment paths exist.

**Independent Test**: Attempt updates with a blank registration, an over-long registration, a non-positive capacity, an over-precise capacity, a registration already used by another truck, on an archived truck, on a truck that no longer exists, as an active non-administrator, and as an unauthenticated visitor; verify each attempt is refused with a distinct reason and no truck changes.

**Acceptance Scenarios**:

1. **Given** an available truck, **When** an administrator submits an empty or whitespace-only registration, **Then** the update is refused with a validation reason and the stored truck is unchanged.
2. **Given** an available truck, **When** an administrator submits a registration or vehicle model longer than the allowed maximum length, **Then** the update is refused with a validation reason and the stored truck is unchanged.
3. **Given** an available truck, **When** an administrator submits a capacity that is zero, negative, non-numeric, or more precise than the allowed decimal precision, **Then** the update is refused with a validation reason and the stored truck is unchanged.
4. **Given** another truck — available or archived — already uses a registration, **When** an administrator submits that registration, including one differing only by letter case or surrounding whitespace, **Then** the update is refused as a duplicate and neither truck is modified.
5. **Given** an archived truck, **When** an administrator attempts to update it, **Then** the update is refused because archived trucks are read-only, and the message states that reactivation is required first.
6. **Given** a truck identifier that does not exist, **When** an administrator attempts to update it, **Then** the update is refused as not found without revealing other truck data.
7. **Given** an unauthenticated visitor or a user whose access is not active, **When** an update is attempted, **Then** it is refused and no truck data is exposed or modified.
8. **Given** an authenticated active user whose role is neither organization administrator nor operations administrator, **When** an update is attempted, **Then** it is refused as unauthorized, the truck is unchanged, and no update action was offered to them in the interface.
9. **Given** an update was refused, **When** the administrator corrects the reported field and resubmits, **Then** the update succeeds without the administrator having to reopen the truck.

### Edge Cases

- A truck archived by another administrator after the update form was opened is refused on submission as read-only rather than being silently updated.
- A transport company archived by another administrator after the update form was opened is refused at submission time with a current, actionable reason.
- A truck committed to a discharge after the update form was opened has its provider reassignment refused at submission time, while its other changes remain submittable.
- A registration whose only difference from the truck's stored registration is letter case or surrounding whitespace is treated as unchanged rather than as a duplicate of itself.
- Two administrators submitting the same new registration for two different trucks at nearly the same time result in exactly one success and one duplicate refusal; no two trucks ever share a registration.
- A truck updated by another administrator after the form was opened does not have that change silently reverted without the administrator being informed of the resulting outcome.
- A capacity at exactly the allowed decimal precision is accepted; one additional fractional digit is refused.
- A registration or vehicle model at exactly the maximum allowed length is accepted; one character beyond it is refused.
- A registration or vehicle model containing accented or non-Latin characters is accepted as long as it is non-blank and within the maximum length.
- A vehicle model submitted as whitespace only is treated as blank and refused rather than stored as-is; clearing the vehicle model is expressed explicitly and succeeds.
- Reducing a truck's capacity below tonnages already recorded by past rotations does not rewrite or re-evaluate those historical rotations, capacity exceedances, or breaches.
- An update that fails because the change could not be saved leaves the truck exactly as it was and offers the administrator a way to retry.
- Reassigning a truck away from a transport company that was its last available truck does not itself archive, modify, or block that company.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow only active organization administrators and operations administrators to update a truck.
- **FR-002**: The system MUST deny the update to unauthenticated users, to users whose access is not active, and to every other active role, without modifying the truck or disclosing existing truck data.
- **FR-003**: The updatable information of a truck MUST be limited to its registration, vehicle model, capacity in tonnes, and current transport company.
- **FR-004**: The system MUST require a non-blank registration, a positive capacity in tonnes, and exactly one transport company on every update; the vehicle model MUST remain optional and clearable.
- **FR-005**: The system MUST reject a registration that is blank, whitespace-only, or longer than the maximum site-reference length of 255 characters, and MUST leave the truck unchanged.
- **FR-006**: The system MUST reject a vehicle model that is whitespace-only or longer than 255 characters, while accepting an explicit absence of vehicle model, and MUST leave the truck unchanged when rejected.
- **FR-007**: The system MUST reject a capacity that is zero, negative, not a valid number, or more precise than three decimal places, and MUST leave the truck unchanged.
- **FR-008**: The system MUST remove leading and trailing whitespace from the registration and vehicle model before validating, comparing, and storing them, and MUST preserve the submitted display casing.
- **FR-009**: The system MUST reject an update whose resulting registration is already used by another truck, available or archived, comparing registrations without regard to letter case or surrounding whitespace.
- **FR-010**: The system MUST accept an update that resubmits the truck's own current registration and MUST NOT report it as a duplicate.
- **FR-011**: The system MUST reject an assigned transport company that does not exist or is archived, and MUST leave the truck unchanged.
- **FR-012**: The system MUST refuse a change of transport company while the truck is assigned to a planned or active discharge, and MUST report that the truck is committed to a discharge.
- **FR-013**: The system MUST allow an update that keeps the truck's current transport company even while the truck is assigned to a planned or active discharge.
- **FR-014**: The system MUST refuse the update of an archived truck and MUST report that the truck is read-only until it is reactivated.
- **FR-015**: The system MUST refuse the update of a truck that does not exist, without disclosing information about other trucks.
- **FR-016**: A successful update MUST preserve the truck's stable identity, its lifecycle status, and its existing archive and reactivation context.
- **FR-017**: A refused update MUST leave the stored truck entirely unchanged, with no partial change applied.
- **FR-018**: The system MUST make the updated registration, vehicle model, capacity, and transport company authoritative in every subsequent consultation, selection, and detail view of that truck.
- **FR-019**: The system MUST NOT alter existing discharge truck assignments, which keep the registration and transport company captured at reservation time.
- **FR-020**: The system MUST NOT retroactively alter truck information already captured in immutable report snapshots or other closed historical records, and MUST NOT re-evaluate past rotations, capacity exceedances, or capacity breaches when a capacity changes.
- **FR-021**: The update experience MUST be pre-filled with the truck's current values, MUST offer only currently available transport companies alongside the truck's own current company, and MUST be offered only to users authorized to perform the update.
- **FR-022**: The system MUST report the outcome of an update attempt to the administrator, distinguishing success, validation failure, duplicate registration, invalid or archived transport company, provider change forbidden by discharge commitment, archived truck, truck not found, unauthorized access, and retryable save failure.
- **FR-023**: The administrator MUST be able to correct a refused submission and resubmit it without reopening the truck, and MUST be able to abandon an update in progress, leaving the truck unchanged.
- **FR-024**: The system MUST ensure that concurrent updates never leave two trucks sharing a registration under case-insensitive comparison.
- **FR-025**: Authorization, validation, and lifecycle decisions MUST be enforced authoritatively by the system regardless of what the user experience offers.
- **FR-026**: This slice MUST NOT create, archive, reactivate, permanently delete, import, or bulk-update trucks, and MUST NOT change transport-company or discharge records.

### Key Entities *(include if feature involves data)*

- **Truck**: A site reference for a vehicle registered for the site and provided by exactly one transport company at a time. It carries a stable identity, a mandatory unique registration, an optional vehicle model, a mandatory positive capacity in tonnes, a current transport company, and a lifecycle status. Registration, vehicle model, capacity, and current transport company are the only information mutable through this feature.
- **Truck Registration**: The mandatory business identifier displayed on a truck's registration plate; it must remain unique, case-insensitively and whitespace-insensitively, across every available and archived truck at the site.
- **Truck Lifecycle Context**: The archive and most recent reactivation information attached to a truck. It determines whether the truck may be updated and is never modified by an update.
- **Transport Company**: The site reference assigned as a truck's current provider; it must exist and be available at the time of the update.
- **Discharge Truck Assignment**: The existing reservation of a truck for one discharge, retaining the registration and transport company captured at reservation time. Its presence on a planned or active discharge is what forbids a provider change; it is never modified by an update.
- **Authorized Administrator**: An active organization administrator or operations administrator; the only actor permitted to update a truck.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of update attempts by authorized administrators on available trucks with valid input succeed, and the updated values are visible in truck consultation immediately afterward.
- **SC-002**: In acceptance testing, 100% of update attempts by unauthenticated visitors, non-active users, and active roles other than organization administrator and operations administrator are refused with zero truck data changed.
- **SC-003**: In acceptance testing, 100% of attempts to update an archived or non-existent truck are refused with the corresponding outcome and leave stored data unchanged.
- **SC-004**: In acceptance testing, 100% of attempts to change the transport company of a truck assigned to a planned or active discharge are refused with zero truck data changed, while 100% of updates that keep the current company on such a truck succeed.
- **SC-005**: Across all acceptance datasets, 0% of trucks end up sharing a registration under case-insensitive comparison, including under concurrent submissions of the same new registration.
- **SC-006**: In all acceptance datasets, 100% of updated trucks keep their identity, lifecycle status, lifecycle context, and existing discharge truck assignments, and 100% of previously captured historical registrations, provider names, and rotation tonnages remain unchanged.
- **SC-007**: Every tested refusal condition — blank or over-long registration, invalid vehicle model, invalid capacity, duplicate registration, invalid or archived transport company, discharge-committed provider change, archived truck, truck not found, unauthorized access, and retryable save failure — produces a distinct, understandable, actionable message, and 100% of retryable failures can be recovered through the offered retry or resubmission.
- **SC-008**: At least 90% of representative authorized administrators can locate a truck and complete a correction on their first attempt within 60 seconds of opening the truck.
- **SC-009**: For 95% of update submissions under normal operating conditions, the administrator sees a confirmed result or an explicit refusal within 2 seconds.

## Assumptions

- "Authorized administrator" means an active organization administrator or an active operations administrator, matching the write-access pattern already established for truck creation (`#223`) and archived-truck consultation in List Trucks (`#222`).
- Registration uniqueness is case-insensitive and whitespace-trimmed across both available and archived trucks, consistent with the persisted uniqueness constraint established by List Trucks (`#222`).
- Registration, vehicle model, and capacity remain editable even while the truck is assigned to a planned or active discharge; `CONTEXT.md` restricts only the transport company for a committed truck and explicitly describes the registration as editable, with historical assignments retaining the registration captured at reservation time.
- Capacity is expressed in tonnes as a positive decimal with at most three fractional digits, matching the stored precision established by List Trucks (`#222`) and enforced by truck creation (`#223`).
- Vehicle model remains an optional free-text field with the same 255-character maximum as other site-reference names, and clearing it is an explicit, supported change rather than an omission.
- An available truck must be provided by an available transport company, so an update may never leave an available truck pointing at an archived company; archived trucks are not updatable at all and therefore never reach this rule.
- Archived trucks are read-only; correcting an archived truck's information requires reactivation first, which is the separate slice `#226`.
- "Committed to a discharge" means the truck has a discharge truck assignment on a discharge whose status is planned or active; assignments on closed discharges do not restrict a provider change.
- A provider change is evaluated against the discharge state at submission time, not at the time the update form was opened.
- The update is a whole-record submission of the four mutable fields rather than a partial-field submission; resubmitting unchanged values is a valid no-op that succeeds.
- Concurrency is resolved by re-validating the truck's current state at submission time and by the persisted registration uniqueness constraint; no version token or optimistic-locking contract is introduced by this slice.
- An update is not a lifecycle transition and therefore captures no archive or reactivation actor, time, or comment; no dedicated truck change history is introduced by this slice.
- Truck records already exist through the seeded site-reference fixtures and through truck creation (`#223`), so this slice is independently deliverable.
- Listing and consultation (`#222`), creation (`#223`), archival (`#225`), and reactivation (`#226`) are independently deliverable sibling issues and stay outside this slice.
- The API is authoritative for every rule in this specification; any interface-level restriction is a courtesy that does not replace server-side enforcement.
