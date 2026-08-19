# Feature Specification: Enforce Persisted Site-Reference Usage Rules

**Feature Branch**: `feat/240-enforce-persisted-site-reference-usage`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Enforce Persisted Site-Reference Usage Rules — Issue #240"

**GitHub Issue**: [#240](https://github.com/whazzark/portflow-ai/issues/240)

**Parent Epic**: [#234](https://github.com/whazzark/portflow-ai/issues/234)

**Dependency**: [#236](https://github.com/whazzark/portflow-ai/issues/236) — Persist and Seed Discharge Preparation and Resource Reservations

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prevent Archiving References Required by Current Discharges (Priority: P1)

An operations administrator who attempts to archive a Customer, Dock, or Weighing Area receives the
established conflict outcome when that reference is currently required by a Planned or Active
Discharge. The reference remains available so current preparation or execution is not invalidated.

**Why this priority**: Archiving a reference that a current Discharge relies on would make active
business state inconsistent and could interrupt operations.

**Independent Test**: Persist one Planned or Active Discharge using each protected reference kind,
attempt each existing archive journey as an authorized administrator, and verify that every
attempt returns its established in-use conflict outcome without changing the reference.

**Acceptance Scenarios**:

1. **Given** an available Customer referenced by a Product Lot of a Planned or Active Discharge,
   **When** an authorized administrator attempts to archive the Customer, **Then** the established
   Customer-in-use conflict is returned and the Customer remains available.
2. **Given** an available Dock selected by a Planned or Active Discharge, **When** an authorized
   administrator attempts to archive the Dock, **Then** the established Dock-in-use conflict is
   returned and the Dock remains available.
3. **Given** an available Weighing Area with a current Shift membership in a Planned or Active
   Discharge, **When** an authorized administrator attempts to archive the Weighing Area, **Then**
   the established Weighing-Area-in-use conflict is returned and the Weighing Area remains
   available.
4. **Given** an available Customer, Dock, or Weighing Area with no current usage by a Planned or
   Active Discharge, **When** an authorized administrator archives it, **Then** the existing
   successful archive behavior and lifecycle metadata remain unchanged.

---

### User Story 2 - Release References When Operational Usage Ends (Priority: P1)

An operations administrator can archive an otherwise eligible site reference after its current
operational usage has ended, while past Discharges and assignments continue to retain their
historical references.

**Why this priority**: Historical traceability must not turn completed or explicitly released
usage into a permanent lifecycle blocker.

**Independent Test**: Persist historical references through Closed Discharges and released
assignments, attempt the applicable existing archive journeys, and verify that current usage is no
longer reported while all historical relationships remain readable.

**Acceptance Scenarios**:

1. **Given** a Customer, Dock, Weighing Area, Warehouse Door, or Truck referenced only by Closed
   Discharges, **When** its current usage is assessed, **Then** it is not reported as used by a
   Planned or Active Discharge.
2. **Given** a Weighing Area or Warehouse Door whose assignment within a Planned or Active
   Discharge has ended, **When** its current usage is assessed, **Then** the ended assignment does
   not make the reference appear in use.
3. **Given** a Truck whose Discharge reservation has been released, **When** its current usage is
   assessed, **Then** the released reservation does not make the Truck appear in use.
4. **Given** a reference with both historical usage and a separate current usage, **When** its
   current usage is assessed, **Then** the current Planned or Active usage still causes it to be
   reported as in use.

---

### User Story 3 - Reuse One Deterministic Usage Decision Across Reference Workflows (Priority: P2)

Current and future site-reference lifecycle workflows can ask which Customers, Docks, Weighing
Areas, Warehouse Doors, or Trucks in a collection are used by Planned or Active Discharges and
receive the same authoritative answer for the same persisted state.

**Why this priority**: One reusable usage rule prevents existing archive journeys and later Truck
or Warehouse Door workflows from interpreting the same Discharge state differently.

**Independent Test**: Prepare a mixed collection containing used, unused, released, repeated, and
unknown identifiers for each supported reference kind, assess each collection in different orders,
and verify that every assessment returns exactly the distinct currently used identifiers.

**Acceptance Scenarios**:

1. **Given** a collection containing used and unused identifiers of one supported reference kind,
   **When** current usage is assessed in bulk, **Then** the result contains exactly the distinct
   identifiers used by Planned or Active Discharges.
2. **Given** the same identifiers with a different order or repeated values, **When** current usage
   is assessed again against unchanged persisted state, **Then** the result is identical.
3. **Given** an empty collection, **When** current usage is assessed, **Then** an empty result is
   returned without changing any business state.
4. **Given** Truck or Warehouse Door usage is assessed before a corresponding lifecycle mutation
   workflow exists, **When** the result is consumed by internal business behavior or acceptance
   tests, **Then** the same Planned-or-Active and release rules apply without exposing a new user
   journey.

### Edge Cases

- The requested collection contains duplicate or unknown identifiers: duplicates do not duplicate
  the result, and unknown identifiers are not reported as used.
- One reference is used by several current Discharges: it appears once in the result.
- One reference has multiple historical assignments plus one current assignment: only the current
  assignment determines that it is in use.
- A current Shift membership or Warehouse Door assignment ends while its Discharge remains
  Planned or Active: the ended membership or assignment no longer blocks the reference.
- A Truck reservation is released while its Discharge remains Planned or Active: the released
  reservation no longer blocks the Truck.
- A Discharge changes from Active to Closed: all of its retained historical references stop
  qualifying as current usage.
- The same site reference appears in both a Closed Discharge and a Planned or Active Discharge: the
  current Discharge keeps it classified as in use.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Production usage decisions for supported site references MUST be derived from the
  authoritative persisted Discharge state and MUST NOT assume that every reference is unused.
- **FR-002**: A supported reference MUST be reported as currently in use only when it has a
  non-released qualifying relationship to a Planned or Active Discharge.
- **FR-003**: A Customer MUST qualify as currently in use when it is referenced by at least one
  Product Lot belonging to a Planned or Active Discharge.
- **FR-004**: A Dock MUST qualify as currently in use when it is the current Dock of at least one
  Planned or Active Discharge.
- **FR-005**: A Weighing Area MUST qualify as currently in use when it has a current Shift
  membership belonging to at least one Planned or Active Discharge.
- **FR-006**: A Warehouse Door MUST qualify as currently in use when it has a current Product Lot
  assignment belonging to at least one Planned or Active Discharge.
- **FR-007**: A Truck MUST qualify as currently in use when it has a non-released reservation for
  at least one Planned or Active Discharge.
- **FR-008**: References retained only by Closed Discharges MUST NOT qualify as currently in use.
- **FR-009**: Ended Shift memberships, ended Warehouse Door assignments, and released Truck
  reservations MUST NOT qualify their references as currently in use, even when their Discharge
  remains Planned or Active.
- **FR-010**: Historical relationships and captured business values MUST remain readable after
  they stop qualifying as current usage.
- **FR-011**: Usage assessment for a collection MUST return exactly the distinct requested
  identifiers that currently qualify as used; input order, duplicate identifiers, and unrelated
  persisted records MUST NOT change that set.
- **FR-012**: A bulk collection MUST be assessed collectively rather than through one independent
  usage lookup per identifier.
- **FR-013**: Existing Customer, Dock, and Weighing Area archive journeys MUST preserve their
  established successful and in-use conflict outcomes while applying the persisted usage rules.
- **FR-014**: A rejected archive attempt caused by current usage MUST leave the reference and its
  lifecycle metadata unchanged.
- **FR-015**: This feature MUST make Truck and Warehouse Door usage assessable for later lifecycle
  workflows without introducing a new site-reference mutation endpoint or user interface.
- **FR-016**: Usage assessment MUST be read-only and MUST NOT create, release, close, archive, or
  otherwise alter a Discharge, assignment, reservation, Shift membership, or site reference.

### Key Entities

- **Site Reference**: A reusable Customer, Dock, Weighing Area, Warehouse Door, or Truck whose
  eligibility for lifecycle changes can depend on current Discharge usage.
- **Current Site-Reference Usage**: A qualifying, non-released relationship between a supported
  site reference and a Planned or Active Discharge.
- **Discharge**: The operation whose Planned, Active, or Closed state determines whether retained
  resource relationships represent current or historical usage.
- **Product Lot**: The Discharge-owned material allocation that establishes current Customer usage.
- **Shift Resource Membership**: The effective or ended association that can establish current
  Weighing Area usage while it remains effective.
- **Warehouse Door Assignment**: The effective or ended assignment of a Warehouse Door to a
  Product Lot within a Discharge.
- **Discharge Truck Reservation**: The current or released reservation of a Truck for a Discharge,
  with captured historical business values retained after release.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across the acceptance matrix of five supported reference kinds, three Discharge
  states, and current versus released relationships where applicable, 100% of usage decisions
  match the rules in this specification.
- **SC-002**: 100% of existing Customer, Dock, and Weighing Area archive acceptance journeys retain
  their established success or conflict outcome when exercised against persisted Discharge state.
- **SC-003**: In every rejected in-use archive scenario, zero reference or lifecycle fields change.
- **SC-004**: Reordering or duplicating as many as 1,000 requested identifiers produces the same
  distinct usage result for unchanged persisted state in 100% of repeated assessments.
- **SC-005**: A mixed assessment of as many as 1,000 identifiers completes within 2 seconds in the
  acceptance environment for each supported reference kind.
- **SC-006**: Historical relationships remain readable in 100% of Closed, ended-assignment, and
  released-reservation acceptance scenarios while causing zero false current-usage blockers.
- **SC-007**: The delivered behavior adds zero new site-reference mutation journeys or user-facing
  destinations.

## Assumptions

- Issue #236 has delivered the persisted Planned, Active, and Closed Discharge preparation model,
  including Product Lots, current Docks, Warehouse Door assignments, Truck reservations, Shifts,
  and effective Shift resource memberships.
- Existing authorization, lifecycle metadata, and conflict contracts for Customer, Dock, and
  Weighing Area archival remain authoritative and are not redefined by this feature.
- A relationship with a recorded end or release no longer represents current usage; retaining it
  serves historical traceability only.
- Truck reservations are Discharge-level usage and remain current across Shift completion until
  explicitly released or until the Discharge is Closed.
- Warehouse Door usage is determined by its current Product Lot assignment, while Weighing Area
  usage is determined by its current Shift membership.
- The current single-site operational scope remains unchanged.
- New archive or other mutation workflows for Trucks and Warehouse Doors remain owned by later
  issues.
