# Feature Specification: Persist and Seed Discharge Preparation and Resource Reservations

**Feature Branch**: `feat/236-discharge-preparation-resource-reservations`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Persist and Seed Discharge Preparation and Resource Reservations — Issue #236"

**GitHub Issue**: [#236](https://github.com/whazzark/portflow-ai/issues/236)

**Parent Epic**: [#234](https://github.com/whazzark/portflow-ai/issues/234)

**Dependency**: [#235](https://github.com/whazzark/portflow-ai/issues/235) — Complete and Seed the Operational Site-Reference Foundation

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rely on Coherent Discharge Preparation Scenarios (Priority: P1)

A delivery operator or developer initializes a supported environment and can rely on planned,
active, and closed Discharges that represent complete preparation graphs rather than disconnected
records or placeholders. Each graph identifies its vessel, dock, customers, Product Lots,
Warehouse Doors, Discharge Truck Assignments, planned Shifts, and Shift Responsibles.

**Why this priority**: Every later Discharge consultation, start confirmation, Shift, Rotation, and
reporting slice depends on a coherent persisted preparation state.

**Independent Test**: Initialize an empty supported environment, inspect one Planned, one Active,
and one Closed Discharge, and verify that every required relationship is present, valid, and
consistent with the Discharge's lifecycle state.

**Acceptance Scenarios**:

1. **Given** an empty supported environment with the site-reference foundation, **When** discharge
   preparation is initialized, **Then** it contains at least one Planned, one Active, and one
   Closed Discharge with complete vessel, dock, Product Lot, Shift, and resource relationships.
2. **Given** a Planned Discharge, **When** its preparation graph is inspected, **Then** it has a
   vessel description, current dock, at least one Product Lot, at least one planned Shift, one
   responsible User per Shift, and the resources required by each prepared Shift.
3. **Given** an Active Discharge, **When** its preparation graph is inspected, **Then** its
   current operational state and active or historical Shift assignments are consistent, while its
   reserved trucks and effective operational resources remain traceable.
4. **Given** a Closed Discharge, **When** its preparation graph is inspected, **Then** its
   historical assignments remain readable and no resource is represented as currently reserved
   for new operational use by that Closed Discharge.

### User Story 2 - Preserve Historical Resource and Material Context (Priority: P1)

An operations user can inspect a prepared Discharge and understand which Product Lot was assigned
to each Warehouse Door, which trucks were reserved for the Discharge, which registration and
Transport Company values were captured at reservation time, and which resources were effective for
each Shift.

**Why this priority**: Later Rotations and corrections depend on historical snapshots and effective
resource membership, even when site references change after preparation.

**Independent Test**: Create or initialize a Discharge with multiple Product Lots, doors, trucks,
and Shifts, change the current site-reference values, and verify that the Discharge's captured
assignment values and effective membership history remain unchanged and attributable to the right
Discharge or Shift.

**Acceptance Scenarios**:

1. **Given** a Discharge Truck Assignment, **When** the assigned Truck's registration or provider
   is later changed in the site reference, **Then** the assignment still exposes the registration
   and Transport Company captured when the truck was reserved.
2. **Given** a Warehouse Door assigned to a Product Lot, **When** the assignment is inspected,
   **Then** it identifies the Discharge, Door, Product Lot, effective period or occurrence, and
   the relationship remains valid even when the current Door status later changes.
3. **Given** a Shift with resource memberships, **When** its preparation history is inspected,
   **Then** each assigned Truck, Warehouse Door, and Weighing Area can be identified as effective
   for that Shift without inheriting resources silently from another Shift.
4. **Given** two Shifts in one Discharge, **When** their memberships are compared, **Then** each
   Shift retains its own explicit resource set and any historical change can be distinguished from
   the current effective membership.

### User Story 3 - Rebuild Focused and Repeatable Preparation Data (Priority: P2)

A developer or delivery operator can initialize the preparation foundation repeatedly and construct
focused scenarios for business-rule tests without creating duplicate Discharges, assignments,
resources, or relationships.

**Why this priority**: Deterministic preparation data is required for reliable automated tests,
demonstrations, and future read-only consultation screens.

**Independent Test**: Initialize the same environment twice, compare the Discharge and assignment
identities and relationships, and construct a focused scenario containing only the records needed
for one business rule.

**Acceptance Scenarios**:

1. **Given** a successfully initialized preparation foundation, **When** initialization runs again,
   **Then** it converges to the same logical Discharges, assignments, memberships, and captured
   values without duplicating records.
2. **Given** records outside the managed preparation fixture catalog, **When** initialization runs,
   **Then** unrelated records are not removed, reassigned, or silently claimed by the managed
   scenarios.
3. **Given** a focused test scenario request, **When** a developer constructs it, **Then** the
   required Discharge graph can be built directly with valid relationships without invoking a
   user-facing creation workflow.
4. **Given** initialization fails part way through one scenario, **When** it is run again after
   the cause is corrected, **Then** accepted records are reused and the final result contains one
   coherent graph.

### Edge Cases

- A Discharge references a site resource that has since been archived: historical assignment data
  remains readable, while the resource is not considered available for a new reservation.
- A Truck or User referenced by historical context is no longer eligible: the assignment keeps its
  captured business values and does not substitute another current reference.
- A Product Lot or Warehouse Door is missing from a declared relationship: initialization fails
  explicitly rather than creating a partial graph.
- Two Product Lots in one Discharge use the same Customer and product identity: the preparation
  data is rejected unless the domain permits a distinct identity for the lots.
- Planned Shifts overlap or are not ordered: the invalid graph is rejected before it is accepted as
  a prepared scenario.
- A resource is reserved by more than one Planned or Active Discharge where the domain allows only
  one reservation: the conflicting graph is rejected without silently releasing the existing one.
- A Closed Discharge retains historical assignments: those records remain available for history,
  but they do not block a new reservation.
- A repeated initialization encounters a previously accepted subset: it reuses accepted identities
  and completes the missing relationships without duplication.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST persist Discharges in Planned, Active, and Closed lifecycle states.
- **FR-002**: Each Discharge MUST retain a Vessel Description containing its name, optional IMO,
  and optional descriptive comment.
- **FR-003**: Each Discharge MUST identify its current Dock, and the relationship MUST preserve the
  Dock identity used by that Discharge.
- **FR-004**: Each Product Lot MUST belong to one Discharge and one Customer, identify its product
  name, retain its expected quantity, and retain its descriptive information.
- **FR-005**: Product Lots within one Discharge MUST have a stable identity that distinguishes
  separate customer and product allocations and prevents unintended duplicates.
- **FR-006**: The system MUST persist the assignment of a Warehouse Door to a Product Lot within
  a Discharge, including the assignment's effective occurrence or period and stable references to
  the Discharge, Door, and Product Lot.
- **FR-007**: The system MUST persist Discharge Truck Assignments for a Discharge and capture the
  Truck registration and Transport Company values that were current when each truck was reserved.
- **FR-008**: A Truck MUST NOT be simultaneously reserved by more than one Planned or Active
  Discharge when the domain's reservation rule prohibits that conflict.
- **FR-009**: The system MUST persist planned Shifts belonging to a Discharge, including their
  planned time range, chronological position, and one responsible eligible User.
- **FR-010**: Planned Shifts belonging to one Discharge MUST have an unambiguous order and MUST NOT
  overlap; invalid timing relationships MUST be rejected.
- **FR-011**: The system MUST persist explicit Shift resource memberships for Trucks, Warehouse
  Doors, and Weighing Areas, including the effective history needed to distinguish current and
  prior membership.
- **FR-012**: A Shift MUST NOT inherit resource memberships implicitly from another Shift; every
  resource used by a Shift MUST be represented by that Shift's own membership.
- **FR-013**: Resource and material relationships MUST enforce required ownership and referential
  integrity, including Discharge-to-Product-Lot, Product-Lot-to-Customer, Door-to-Warehouse, and
  Shift-to-Responsible-User relationships.
- **FR-014**: Historical Discharge Truck Assignments, Door-to-Product-Lot assignments, and Shift
  memberships MUST remain readable after the referenced site resource changes lifecycle state or
  current descriptive values.
- **FR-015**: A Closed Discharge MUST retain its historical preparation graph without holding a
  current reservation that blocks a new Planned or Active Discharge.
- **FR-016**: Managed initialization MUST provide deterministic Planned, Active, and Closed
  preparation graphs with coherent reserved and released resource states.
- **FR-017**: Repeated managed initialization MUST reuse stable identities, avoid duplicate logical
  records, preserve unrelated records, and converge after a partial failure is corrected.
- **FR-018**: Focused scenario construction MUST support valid Discharge preparation graphs without
  requiring a user-facing creation workflow.
- **FR-019**: This feature MUST NOT introduce a new Discharge mutation endpoint or user interface;
  it establishes persisted business state and deterministic preparation data for later slices.

### Key Entities

- **Discharge**: The complete operation of unloading bulk material from one vessel, with Planned,
  Active, or Closed lifecycle state and a current Dock.
- **Vessel Description**: The name, IMO, and comment describing the vessel associated with a
  Discharge.
- **Product Lot**: A traceable quantity of material for one Customer within a Discharge, including
  product identity, expected quantity, and description.
- **Discharge Truck Assignment**: A Discharge-level reservation that captures a Truck's registration
  and Transport Company values at reservation time.
- **Planned Shift**: A future work period in a Discharge with an ordered planned range, responsible,
  and explicit resource memberships.
- **Shift Resource Membership**: The effective or historical association between a Shift and a
  Truck, Warehouse Door, or Weighing Area.
- **Warehouse Door-to-Product-Lot Assignment**: The Discharge-specific assignment that identifies
  where one Product Lot is expected to be deposited.
- **User**: An eligible operations user responsible for one or more Shifts.
- **Site References**: Existing Customers, Docks, Weighing Areas, Warehouses, Warehouse Doors,
  Transport Companies, and Trucks used by the preparation graph.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A newly initialized supported environment contains at least one valid Planned,
  Active, and Closed Discharge graph, each with all required preparation relationships present.
- **SC-002**: 100% of managed Product Lots, Door assignments, Truck Assignments, Shifts, and Shift
  memberships resolve to the intended parent and required site references after initialization.
- **SC-003**: Repeating initialization three times produces no additional managed logical records
  after the first successful run and preserves all managed identities and relationships.
- **SC-004**: A focused preparation scenario can be constructed and inspected without invoking a
  user-facing creation flow, with zero broken required relationships.
- **SC-005**: Historical Truck, Door, Product Lot, and Shift membership context remains unchanged
  and readable after current site-reference labels or lifecycle states are changed.
- **SC-006**: Invalid preparation graphs are rejected with an actionable failure and leave no
  silently accepted partial relationship that could be mistaken for a coherent scenario.

## Assumptions

- The site-reference foundation from issue #235 is available before preparation initialization
  runs, including Customers, Docks, Weighing Areas, Warehouses, Warehouse Doors, Transport
  Companies, Trucks, and eligible Users.
- This feature is a persistence and scenario-foundation slice; Discharge creation, update, start,
  closure, and other mutation workflows are out of scope.
- Existing lifecycle vocabulary and rules in `CONTEXT.md` are authoritative, including the meaning
  of Planned, Active, Closed, Shift, Discharge Truck Assignment, and Product Lot.
- Seeded scenarios are deterministic and representative; they do not attempt to model every valid
  operational combination.
- Historical snapshots remain readable even when the current referenced resource is archived or
  its mutable descriptive values change.
- Authorization remains governed by the existing application policies when future read or mutation
  workflows consume these records.
