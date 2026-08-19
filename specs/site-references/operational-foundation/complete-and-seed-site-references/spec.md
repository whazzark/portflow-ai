# Feature Specification: Complete and Seed Operational Site References

**Feature Branch**: `feat/235-seed-site-reference-foundation`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "Complete and Seed the Operational Site-Reference Foundation — Issue #235"

**GitHub Issue**: [#235](https://github.com/whazzark/portflow-ai/issues/235)

**Parent Epic**: [#234](https://github.com/whazzark/portflow-ai/issues/234)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start With Coherent Operational References (Priority: P1)

A product stakeholder starts a supported demonstration or test environment and receives a coherent set of Customers, Docks, Weighing Areas, Warehouses, Warehouse Doors, Transport Companies, and Trucks so the delivered reference workbenches and future operational scenarios use real relationships rather than fabricated placeholders.

**Why this priority**: Every later Discharge, Shift, Rotation, and dashboard slice depends on trustworthy reference identities and relationships.

**Independent Test**: Initialize an empty supported environment and verify that all seven reference kinds are present, their required relationships and geographic information are valid, and each existing consultation journey still presents its expected records.

**Acceptance Scenarios**:

1. **Given** an empty supported environment, **When** the reference foundation is initialized, **Then** every reference kind contains representative available, archived, and previously reactivated records.
2. **Given** initialized transport references, **When** their relationships are inspected, **Then** every Truck belongs to exactly one existing Transport Company and retains its own lifecycle independently from that company.
3. **Given** initialized storage references, **When** their relationships are inspected, **Then** every Warehouse Door belongs permanently to one existing Warehouse and its location lies within or on that Warehouse's footprint.
4. **Given** initialized geographic references, **When** Docks, Weighing Areas, Warehouses, and Warehouse Doors are consulted, **Then** their required locations or footprints are complete and geographically valid.
5. **Given** the existing site-reference workbenches, **When** an authorized user consults the initialized data, **Then** the existing consultation behavior and information remain compatible with the contracts already delivered.

---

### User Story 2 - Preserve Complete Storage Lifecycle Context (Priority: P1)

An operations administrator can rely on Warehouses and Warehouse Doors having the same durable lifecycle context as the other site references, so later availability and historical rules do not require special cases for storage resources.

**Why this priority**: Warehouses and Warehouse Doors currently expose lifecycle state but lack the complete persisted context required by the shared Site Reference vocabulary.

**Independent Test**: Prepare available, archived, and previously reactivated Warehouses and Warehouse Doors, reload them from authoritative storage, and verify that status, lifecycle occurrences, comments, and recorded actors remain coherent without changing their permanent identities or containment.

**Acceptance Scenarios**:

1. **Given** an archived Warehouse or Warehouse Door with recorded lifecycle context, **When** it is reloaded, **Then** its archived status, archival time, comment, and recorded actor still describe the same stable resource.
2. **Given** a previously archived Warehouse or Warehouse Door that has been reactivated, **When** it is reloaded, **Then** it is available and retains the latest reactivation time, comment, and recorded actor together with its prior archival context.
3. **Given** a lifecycle actor that remains a known User, **When** lifecycle context is inspected, **Then** the stored actor reference resolves to that User.
4. **Given** historical lifecycle context whose actor is unavailable, **When** the resource is loaded, **Then** its status, occurrence time, and comment remain usable without inventing an actor.
5. **Given** an archived Warehouse, **When** its contained Doors are inspected, **Then** none of those Doors is presented as available for new operational use.

---

### User Story 3 - Repeat Initialization Without Drift (Priority: P2)

A developer or delivery operator can run the reference initialization repeatedly and receive the same logical reference foundation without duplicate identities, broken relationships, or uncontrolled changes to unrelated records.

**Why this priority**: Repeatable environments are necessary for reliable business-rule tests, browser journeys, demonstrations, and later operational seed scenarios.

**Independent Test**: Initialize the same environment twice, compare the reference identities, lifecycle states, counts, containment, provider relationships, and geographic data after each run, and verify that the second run converges to the same logical result.

**Acceptance Scenarios**:

1. **Given** a successfully initialized reference foundation, **When** initialization runs again, **Then** no logical reference is duplicated and every managed reference keeps the same stable identity.
2. **Given** existing Truck-to-company and Door-to-warehouse relationships, **When** initialization runs again, **Then** no Truck or Door becomes detached or is reassigned to an unintended parent.
3. **Given** existing Warehouse footprints and Door locations, **When** initialization runs again, **Then** each managed footprint and location remains complete and valid without accumulating duplicate boundary points.
4. **Given** records outside the managed demonstration dataset, **When** initialization runs, **Then** those unrelated records are not removed or silently claimed as managed references.

### Edge Cases

- A previously reactivated resource is currently available: it remains in the available collection while retaining its last reactivation context.
- An archived or reactivated record has no resolvable historical actor: its lifecycle occurrence and comment remain readable and the missing actor is not replaced with another User.
- A containing Warehouse is archived: none of its Doors qualifies as available for new operational use, regardless of stale or inconsistent input.
- An archived Transport Company still provides archived Trucks: the provider relationship remains intact for historical consultation.
- Two Doors in different Warehouses use the same name: both remain valid, while names remain unique without letter case within each Warehouse.
- A managed reference already exists with a normalized business identifier: initialization reuses that logical reference rather than creating a case-variant duplicate.
- Initialization stops because one managed record is invalid: a later successful rerun must converge to one coherent dataset without duplicating records already accepted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The initialized foundation MUST include Customers, Docks, Weighing Areas, Warehouses, Warehouse Doors, Transport Companies, and Trucks.
- **FR-002**: Each reference kind MUST include at least one available record, one archived record, and one currently available record with prior reactivation context.
- **FR-003**: Every initialized reference MUST retain a stable permanent identity across repeated initialization runs.
- **FR-004**: The current lifecycle state of every reference MUST be either Available or Archived; prior reactivation is lifecycle context and MUST NOT introduce a third current state.
- **FR-005**: Warehouses and Warehouse Doors MUST support the same lifecycle context categories as the other site references: archival occurrence, archival actor when resolvable, archival comment, reactivation occurrence, reactivation actor when resolvable, and reactivation comment.
- **FR-006**: Lifecycle context MUST remain associated with the same permanent reference after reload and repeated initialization.
- **FR-007**: A recorded lifecycle actor MUST reference an existing User; historical lifecycle facts MUST remain usable when no actor is recorded or the former actor can no longer be resolved.
- **FR-008**: A previously reactivated reference MUST currently be Available and its reactivation occurrence MUST follow its retained archival occurrence.
- **FR-009**: Every initialized Dock and Weighing Area MUST have a valid required geographic point.
- **FR-010**: Every initialized Warehouse MUST have one complete valid footprint from which its display position can be derived.
- **FR-011**: Every initialized Warehouse Door MUST belong permanently to exactly one existing Warehouse and have a required location within or on that Warehouse's footprint.
- **FR-012**: An Archived Warehouse MUST NOT contain a Warehouse Door that qualifies as available for new operational use.
- **FR-013**: Every initialized Truck MUST belong to exactly one existing Transport Company and retain its mandatory registration and capacity information.
- **FR-014**: Reference business identifiers and names MUST continue to obey their established normalization and uniqueness rules across both lifecycle states.
- **FR-015**: Repeating initialization MUST NOT duplicate managed references, parent-child relationships, geographic boundary points, or lifecycle occurrences.
- **FR-016**: Repeating initialization MUST preserve valid managed identities and relationships while converging incomplete managed demonstration records to the declared reference scenarios.
- **FR-017**: Initialization MUST NOT remove or silently repurpose records that are outside its managed demonstration dataset.
- **FR-018**: Existing site-reference consultation journeys and their authorization, filtering, ordering, empty, failure, and response-shape behavior MUST remain compatible.
- **FR-019**: This feature MUST NOT introduce a new public consultation capability, user-facing destination, consumer contract, or create, update, archive, reactivate, delete, or bulk-mutation capability.
- **FR-020**: Discharges, Product Lots, resource reservations, Shifts, Downtimes, Rotations, Weighings, Activity Log Entries, and Report Snapshots MUST remain outside this feature.

### Key Entities *(include if feature involves data)*

- **Site Reference**: A reusable Customer, Transport Company, Truck, Dock, Weighing Area, Warehouse, or Warehouse Door owned by the operating site's operational context and identified permanently.
- **Site Reference Lifecycle Context**: The current Available or Archived state plus retained archival and reactivation occurrences, comments, and actor references when recorded. Prior reactivation does not replace the current state.
- **Warehouse**: A named storage destination with a required footprint, lifecycle context, and contained Warehouse Doors. An archived Warehouse has no Door available for new operational use.
- **Warehouse Door**: A named unloading point with lifecycle context, a required geographic location, and one permanent containing Warehouse.
- **Warehouse Footprint**: The ordered geographic boundary of a Warehouse. Its points collectively define the valid area for contained Warehouse Door locations.
- **Truck**: A registered vehicle with capacity information, lifecycle context, and exactly one current Transport Company.
- **Transport Company**: The site reference that currently provides one or more Trucks while retaining an independent lifecycle.
- **Lifecycle Actor**: A User recorded as responsible for an archival or reactivation occurrence when that actor is available for durable reference.
- **Managed Reference Dataset**: The declared logical references and relationships maintained by initialization; unrelated records are outside its ownership.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After initialization of an empty supported environment, 100% of the seven site-reference kinds are present and each kind includes available, archived, and previously reactivated scenarios.
- **SC-002**: Across two consecutive initialization runs, 100% of managed references retain the same stable identities and relationship targets, with zero duplicate logical references or footprint points added.
- **SC-003**: In all acceptance datasets, 100% of Trucks resolve to exactly one Transport Company and 100% of Warehouse Doors resolve to exactly one Warehouse.
- **SC-004**: In all geographic acceptance checks, every initialized point is within its valid coordinate range and every Warehouse Door lies within or on its Warehouse footprint.
- **SC-005**: In all lifecycle acceptance checks, every archived and previously reactivated Warehouse and Warehouse Door retains coherent occurrence, comment, and actor context without being misclassified for new operational use.
- **SC-006**: All existing site-reference consultation acceptance journeys pass without requiring users or consumers to adopt a new destination or data contract.
- **SC-007**: A clean reference initialization completes within 60 seconds for the declared demonstration dataset under normal supported conditions.

## Assumptions

- This feature prepares reference data for later operational-model issues; #236 owns Discharges and reservations, while #61, #58, #241, and #111 own the new consultation capabilities and screens.
- Existing lifecycle rules for Customers, Docks, Weighing Areas, Transport Companies, and Trucks remain authoritative; this feature aligns Warehouses and Warehouse Doors without redefining those rules.
- Available and Archived are the only current lifecycle states. A previously reactivated reference is Available with retained reactivation context.
- Lifecycle comments and actors are required for the managed archived and reactivated demonstration scenarios, while persistence remains capable of reading older historical records with unavailable actor context.
- Initialization is intended for the repository's supported demonstration and test environments, not as an administration workflow for production users.
- The managed demonstration dataset may repair its own incomplete records to converge on the declared scenarios, but does not own unrelated site-reference records.
- Existing consultation contracts may expose newly retained lifecycle context only where that context is already part of their contract; adding fields or new consultation entry points is outside this feature.
