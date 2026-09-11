# Feature Specification: Consult a Prepared Discharge in the Web Workbench

**Feature Branch**: `whazzark/consult-a-prepared-discharge-in-the-web-workbenc`

**Created**: 2026-07-09

**Last refined**: 2026-09-11

**Status**: Draft

**Input**: User description: "Consult a Prepared Discharge in the Web Workbench. https://github.com/whazzark/portflow-ai/issues/58"

**Feature ID**: `GH-58`

**GitHub Issue**: [#58](https://github.com/whazzark/portflow-ai/issues/58)

**Parent Roadmap**: `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md`

**Roadmap Entry**: `GH-58`

**Priority**: priority:P0

**Milestone**: 3. Exploiter le modèle en lecture

**Domain**: discharge-preparation

## Clarifications

### Session 2026-09-11

- Q: Should the discharge detail be a dedicated page reached from the list, or a panel opened over
  the list as the other directories do? → A: A dedicated discharge page with its own address,
  reached from a row of the list. About ten later slices add their panels, tabs, or actions to this
  detail, which a panel over the list has no room for. Leaving the page returns to the list with its
  status and search.
- Q: Should the detail show every warehouse door assignment and shift resource the discharge has
  had, or only those in effect now? → A: Every one it has had, each with its effective period, with
  those still in effect distinguished from those that ended. The same rule applies to every status,
  so a closed discharge, whose assignments have all ended, still shows what it used.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a Discharge and Read What Is Being Unloaded (Priority: P1)

As an active user, I want to open one discharge from the discharges list and read its vessel, its
dock, its expected start, and every product lot it unloads together with the warehouse doors that
receive each lot, so that I know exactly what this discharge moves, for whom, and where it goes.

**Why this priority**: The list tells a user that a discharge exists; only its detail tells them what
it is. The product lots and their warehouse doors are the heart of a discharge preparation, and this
is the screen every later preparation, execution, and closure slice is reached from.

**Independent Test**: Against a dataset containing planned, active, and closed discharges, sign in
as each active role, open one discharge of each status from the list, and verify that its vessel,
status, dock, expected start, product lots, expected quantities, and warehouse door assignments
match the persisted preparation.

**Acceptance Scenarios**:

1. **Given** the discharges list shows a discharge in any status, **When** an active user selects
   it, **Then** the detail page of that discharge opens.
2. **Given** a discharge detail is open, **When** the user reads its identity, **Then** the vessel
   name, the vessel IMO, the vessel comment, the status, the dock, and the expected start are
   visible.
3. **Given** a discharge has product lots, **When** the user reads its detail, **Then** every lot is
   listed once with its customer, its product name, its expected quantity in tonnes, and its
   description, and the discharge's expected tonnage, the sum of its lots' expected quantities, is
   shown.
4. **Given** a product lot has had warehouse doors assigned to it, **When** the user reads that
   lot, **Then** each assignment is shown with its door, the door's warehouse, and its effective
   period, and the assignments still in effect are distinguished from those that ended.
5. **Given** a product lot has never had a warehouse door assigned, **When** the user reads that
   lot, **Then** it states explicitly that no warehouse door is assigned rather than showing nothing.
6. **Given** a lot of a planned or active discharge has only ended door assignments, **When** the
   user reads that lot, **Then** its ended assignments are shown and it states that no warehouse
   door is currently assigned.
7. **Given** an unauthenticated visitor or a user whose access is not active, **When** they request
   a discharge detail, **Then** consultation is denied and no discharge, vessel, dock, customer,
   product, warehouse, truck, or user information is disclosed.

---

### User Story 2 - Read the Planned Shifts and Their Resources (Priority: P1)

As an active user, I want to read the shifts of a discharge in chronological order, each with its
planned period, its status, its responsible, and the trucks, warehouse doors, and weighing areas
selected for it, so that I know who follows each period of the discharge and with which resources.

**Why this priority**: Shifts are how a discharge is actually worked. Without them the detail
describes what is unloaded but not who unloads it or when, which is the question operations leads
ask before every shift.

**Independent Test**: Open a discharge with several shifts in different statuses and verify that
the shifts are listed in chronological order and that each one's planned period, status,
responsible, trucks, warehouse doors, and weighing areas match the persisted preparation.

**Acceptance Scenarios**:

1. **Given** a discharge has several shifts, **When** the user reads its detail, **Then** the shifts
   are listed in order of planned start, earliest first, each identified by its planned period.
2. **Given** a shift is listed, **When** the user reads it, **Then** its status of planned, active, or
   completed and the name of its responsible are visible.
3. **Given** a shift has had trucks, warehouse doors, and weighing areas selected for it, **When**
   the user reads it, **Then** each truck is shown by the registration captured in the discharge's
   truck pool, each warehouse door with its warehouse, and each weighing area by its name, each with
   its effective period.
4. **Given** a shift has resources still in effect and resources whose selection ended, **When** the
   user reads it, **Then** the resources still in effect are distinguished from those that ended.
5. **Given** a planned shift has never had a truck, a warehouse door, or a weighing area selected,
   **When** the user reads it, **Then** each missing resource type is stated explicitly as not
   selected rather than hidden.
6. **Given** a discharge has no shift, **When** the user reads its detail, **Then** an explicit
   no-shift state is shown.

---

### User Story 3 - Read the Discharge Truck Pool (Priority: P2)

As an active user, I want to read the trucks reserved for a discharge, each with the registration
and the transport company captured when it was reserved, so that I can tell which trucks this
discharge holds and which company provides them.

**Why this priority**: Shifts already show the trucks they use. The pool adds the trucks the
discharge holds without a shift using them yet, and the historical registration and company that
reports rely on. It is valuable on its own, but less often consulted than lots and shifts.

**Independent Test**: Open a discharge whose pool includes a truck whose registration or transport
company has since changed, an archived truck, a suspended truck, and a released truck, and verify
that each is shown with its captured values and the right marker.

**Acceptance Scenarios**:

1. **Given** a discharge has reserved trucks, **When** the user reads its truck pool, **Then** every
   reserved truck is listed once with its captured registration, its captured transport company,
   and when it was reserved.
2. **Given** a truck's registration or transport company changed after it was reserved, **When** the
   user reads the pool, **Then** the values captured at reservation are shown, not the current ones.
3. **Given** a truck was released from the discharge, **When** the user reads the pool, **Then** it is
   shown as released with its release time, distinct from the trucks the discharge still holds.
4. **Given** a reserved truck is currently archived or suspended, **When** the user reads the pool,
   **Then** that truck carries a visible archived or suspended marker.

---

### User Story 4 - Share, Restore, and Leave a Discharge Detail (Priority: P3)

As an active user, I want the discharge I am reading to be carried in the address and to return to
the list exactly as I left it, so that I can send a colleague the discharge we are discussing and
move between the list and a detail without losing my place.

**Why this priority**: This is the repository's established behavior for every consultation screen,
and discharges are what operational conversations are about. It refines an experience that is
already useful without it.

**Independent Test**: Select a status and a search in the list, open a discharge, reload the address
and open it in a separate session, then return to the list, and verify that the same discharge is
restored and that the list comes back with the same status and search.

**Acceptance Scenarios**:

1. **Given** a discharge detail is open, **When** the page is reloaded, **Then** the same discharge
   detail is shown again.
2. **Given** a user copies the address of a discharge detail, **When** another active user opens it,
   **Then** they see the same discharge.
3. **Given** the user opened a discharge from a filtered list, **When** they leave the detail,
   **Then** the list is shown with the status and the search they had selected.
4. **Given** an address refers to a discharge that does not exist, **When** it is opened, **Then** a
   not-found state is shown with a way back to the list, and no failure or retry is offered.

---

### User Story 5 - Recover From Loading and Failed Consultation (Priority: P3)

As an active user, I want distinct loading, failure, and empty-section feedback in a discharge
detail, so that I can tell a freshly planned discharge with nothing prepared yet from a detail that
failed to load.

**Why this priority**: A planned discharge with no lot, no shift, and no truck is legitimate; without
distinct feedback it is indistinguishable from a failed retrieval.

**Independent Test**: Open a freshly planned discharge with no lot, shift, or truck, then open a
detail while retrieval fails and recovers, and verify that each state has its own feedback and that
retry recovers the detail.

**Acceptance Scenarios**:

1. **Given** the detail is being obtained, **When** the user opens a discharge, **Then** a clear
   loading state is shown rather than an empty detail.
2. **Given** discharge information cannot be retrieved, **When** consultation fails, **Then** an
   understandable failure message and a retry action are shown.
3. **Given** a previous retrieval failed and retrieval is available again, **When** the user retries,
   **Then** the current detail of the discharge is displayed.
4. **Given** a discharge has no product lot, no shift, or no reserved truck, **When** the user reads
   its detail, **Then** each empty section states that nothing is prepared there yet, and the rest of
   the detail is shown normally.

### Edge Cases

- A discharge whose dock, customer, warehouse, warehouse door, weighing area, transport company, or
  truck has since been archived remains fully readable; the archived reference is shown with an
  archived marker and is never substituted by a current one.
- A truck whose registration or transport company changed after reservation is shown with the values
  captured at reservation, both in the truck pool and in the shifts that use it.
- Two product lots with the same product name for different customers are listed separately and are
  distinguished by their customer.
- A warehouse door assigned to two lots over time, or two doors of the same warehouse assigned to one
  lot, are each shown against the right lot with their warehouse, never merged.
- A closed discharge is readable as history. Its door assignments and shift resources are all shown
  with their ended periods, and it is never presented as currently holding its dock, its trucks, or
  its warehouse doors for new operational work.
- A resource selected, removed, and selected again for the same shift, or a door assigned to the
  same lot twice, appears once per effective period rather than being merged into one.
- A discharge with no recorded vessel IMO, no vessel comment, or a lot with no description shows each
  absent value as an explicit muted `Not specified` placeholder rather than a blank or fabricated
  value.
- A discharge whose status changes while its detail is open shows its authoritative current status,
  lots, shifts, and resources once the detail is refreshed or retried.
- A discharge opened from a list filtered on a search, and whose data then changes so that it no
  longer matches that search, keeps its detail page open; the return to the list restores the
  search as it was.
- A shift whose responsible has since lost their access is still shown with that person's name.
- A discharge with a long history of shifts keeps them in chronological order and each shift's
  resources attached to that shift only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow every active authenticated user, in every role, to consult the
  detail of any planned, active, or closed discharge of the site.
- **FR-002**: The system MUST deny discharge detail consultation to unauthenticated users and to
  users whose access is not active, disclosing no discharge, vessel, dock, customer, product,
  warehouse, truck, transport company, weighing area, or user data.
- **FR-003**: Every discharge listed in the discharges list MUST be selectable, and selecting it MUST
  open its detail. This replaces the inert rows delivered by GH-61.
- **FR-004**: The discharge detail MUST be a dedicated page with its own address, reached from the
  discharges list, rather than a panel opened over the list.
- **FR-005**: The detail MUST show the discharge's vessel name, vessel IMO, vessel comment, status,
  dock, and expected start.
- **FR-006**: The detail MUST list every product lot of the discharge exactly once, with its customer,
  product name, expected quantity, and description, and MUST show the discharge's expected tonnage as
  the sum of its lots' expected quantities.
- **FR-007**: Expected quantities and the expected tonnage MUST be expressed in tonnes and displayed
  with three decimal places.
- **FR-008**: Each product lot MUST show the warehouse doors assigned to it, each with its warehouse.
  A lot that has never had a door assigned MUST state so explicitly, and a lot of a planned or active
  discharge with no assignment in effect MUST state that no door is currently assigned.
- **FR-009**: The detail MUST list the discharge's shifts in ascending order of planned start, each
  with its planned period, its status of planned, active, or completed, and the name of its
  responsible.
- **FR-010**: Each shift MUST show the trucks, warehouse doors, and weighing areas selected for it,
  and MUST state explicitly each resource type that has none selected.
- **FR-011**: The detail MUST list the discharge's truck pool, each truck exactly once, with the
  registration and transport company captured when it was reserved and its reservation time.
- **FR-012**: A truck released from the discharge MUST be shown as released with its release time,
  distinct from the trucks the discharge still holds.
- **FR-013**: A truck MUST be identified everywhere in the detail, including in the shifts, by the
  registration captured in the discharge's truck pool rather than by its current registration.
- **FR-014**: The detail MUST show every warehouse door assignment and every shift resource the
  discharge has had, each with its effective period, and MUST distinguish those still in effect
  from those that ended. The same rule MUST apply to planned, active, and closed discharges, and
  each effective period MUST be shown separately rather than merged.
- **FR-015**: A discharge MUST remain fully readable when a site reference it uses has since been
  archived. The archived reference MUST be shown with an archived marker and MUST NOT be substituted
  by a current one; a reserved truck that is currently suspended MUST carry a suspended marker.
- **FR-016**: The detail MUST disclose the labels of every site reference and responsible it shows
  to every active role, including archived references that a role cannot otherwise browse.
- **FR-017**: Absent optional values, notably a missing vessel IMO, vessel comment, or lot
  description, MUST be shown as an explicit placeholder and MUST NOT prevent the detail from being
  shown.
- **FR-018**: A discharge with no product lot, no shift, or no reserved truck MUST show a
  section-specific empty state for each, and the rest of its detail MUST be shown normally.
- **FR-019**: The opened discharge MUST be carried in the address, so that it survives a reload and
  can be shared with another active user.
- **FR-020**: A discharge's detail address MUST open that discharge on its own, independently of
  any list status or search, including when opened directly without passing through the list.
- **FR-021**: The detail page MUST offer a way back to the discharges list, and returning from a
  discharge opened from the list MUST restore the status and the search the user had selected.
- **FR-022**: An address referring to a discharge that does not exist MUST show a not-found state
  with a way back to the list, distinct from a retrieval failure.
- **FR-023**: The system MUST show a clear loading state while the detail is being obtained, and an
  understandable failure state with a retry action when retrieval fails; retrying MUST display the
  current detail once retrieval is available.
- **FR-024**: Refreshing or retrying consultation MUST replace stale status, lot, shift, truck, and
  assignment information with the authoritative current state.
- **FR-025**: Consultation MUST remain read-only for every role. This slice MUST NOT create, prepare,
  update, activate, close, or delete a discharge, and MUST NOT assign, reassign, or release any dock,
  truck, warehouse door, weighing area, shift, or responsible.
- **FR-026**: The detail MUST NOT offer any action beyond navigation. Later slices add their own
  actions and panels to it.

### Key Entities *(include if feature involves data)*

- **Discharge**: The operation of unloading a vessel at the site. For consultation it has a stable
  identity, a status of planned, active, or closed, a vessel description, a dock, an expected start,
  product lots, a truck pool, warehouse door assignments, and shifts.
- **Vessel Description**: The name, optional IMO, and optional comment describing the vessel of a
  discharge. All three are shown in the detail.
- **Dock**: The named berth where the vessel is discharged. Shown with an archived marker when it has
  since been archived.
- **Product Lot**: A traceable quantity of bulk material for one customer within a discharge,
  identified by that customer and a product name, with an expected quantity in tonnes and an
  optional description.
- **Expected Tonnage**: The indicative quantity planned for a discharge, the sum of its product lots'
  expected quantities.
- **Customer**: The company owning a product lot. Shown by name on each lot.
- **Warehouse Door Assignment**: The assignment of a warehouse door to one product lot of the
  discharge, over an effective period that is still open while the assignment is in effect. Shown on
  the lot it serves, with the door's warehouse and its effective period.
- **Discharge Truck Assignment**: The reservation of a truck for the discharge, carrying the
  registration and transport company captured at reservation, a reservation time, and a release time
  once released.
- **Shift**: A work period of the discharge, identified to users by its planned period, with a status
  of planned, active, or completed and one responsible.
- **Shift Responsible**: The user accountable for a shift, shown by name.
- **Shift Resources**: The trucks, warehouse doors, and weighing areas selected for one shift, each
  over an effective period that is still open while the selection is in effect.
- **Weighing Area**: The checkpoint where trucks are weighed, shown by name on the shifts that use it.
- **Authorized User**: Any authenticated user with active access, in any role, permitted to consult
  the detail of every discharge of the site.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of active roles can open the detail of a planned, an
  active, and a closed discharge, and 100% of unauthenticated or non-active attempts receive no
  discharge or site reference data.
- **SC-002**: For every discharge of the acceptance datasets, 100% of its product lots, warehouse
  door assignments, truck pool entries, shifts, and shift resources are shown exactly once, attached
  to the right lot or shift and with the right effective period, with none missing and every one
  correctly marked as in effect or ended.
- **SC-003**: At least 90% of representative users, given a discharge, can say on their first
  attempt and within 30 seconds which warehouse doors receive a named customer's lot, who is
  responsible for its next planned shift, and which trucks its pool holds.
- **SC-004**: For a discharge holding up to 20 product lots, 60 reserved trucks, and 40 shifts, users
  see its detail within 2 seconds for at least 95% of consultation attempts under normal operating
  conditions.
- **SC-005**: 100% of archived references and of trucks whose registration or company changed after
  reservation are shown with their historical values and the right marker, and none is substituted
  by a current value.
- **SC-006**: 100% of reloaded or shared detail addresses restore the same discharge, 100% of
  returns to the list restore its status and search, and 100% of addresses to a non-existent
  discharge show the not-found state without an error page.
- **SC-007**: Every tested loading, retrieval-failure, stale-detail, not-found, and empty-section
  condition produces distinct and accurate feedback, and 100% of retryable failures are recovered
  through the offered retry action once retrieval is available.
- **SC-008**: Across the full acceptance run, 0% of consultation attempts change any discharge,
  shift, assignment, or site reference, verifying that the slice is read-only.

## Assumptions

- The deployment serves a single site, so every active user consults the same discharges; no
  per-site or per-organization filtering applies.
- Every status opens the same detail. The title's "prepared" names what the detail shows, the
  discharge preparation, not a restriction to planned discharges: active and closed discharges keep
  their preparation, and the later execution and closure slices are reached from this same detail.
- Every role may read every part of the detail, including the responsible of each shift and the
  captured truck and transport company values. Consulting discharge information is part of the
  Observer's permissions in `CONTEXT.md`, and GH-61 already opened every status to every role.
- A shift responsible is shown by name only. Contact details and access status are administration
  context and stay in the users directory.
- Shifts are identified to users by their planned period, as `CONTEXT.md` defines; an internal shift
  number is not shown.
- Dates and times use the same display convention as the discharges list.
- The dedicated page departs from the application's convention of opening a record in a panel over
  its list. The departure is deliberate, and the plan records it with the reason given in the
  Clarifications.
- Ended assignments are shown for what they are, periods of use. Who changed an assignment and why
  belongs to the activity log slice.
- The read model consulted here was delivered by GH-236; this slice adds no persistence and no seed
  data. That model records no actual start or end time for a discharge or a shift and no closure
  actor, so the detail shows none.
- A discharge is expected to hold up to 20 product lots, 60 reserved trucks, and 40 shifts, which the
  performance target covers; the detail is consulted whole rather than in pages.
- The detail describes the preparation graph only. Rotations, weighings, downtimes, tonnage progress,
  the activity log, and reports do not exist in the read model yet and belong to their own slices.

## Out of Scope

- Any mutation of a discharge, a product lot, a shift, an assignment, or a site reference: preparing
  a discharge (GH-53), assigning warehouse doors and checkpoints (GH-54), planning the truck pool and
  shift subsets (GH-55), confirming a discharge start (GH-56), runtime resource changes (GH-75 to
  GH-78), and closing a discharge.
- The discharge activity log, closure readiness, discharge reports, rotations, weighings, downtimes,
  realized tonnage, and validation progress.
- The shift workspace (GH-65) and the operations dashboard.
- Opening a discharge from any other screen than the discharges list, such as a customer's detail
  (GH-180).
- Exporting or printing a discharge detail.

## Dependencies

- Its blockers are delivered: GH-61 created the discharges list, its address state, and the
  Operations → Discharges navigation entry, and GH-236 persisted and seeded the preparation read model
  this slice consults. No single-discharge consultation exists yet on either side, so this slice
  creates it.
- GH-53 depends on this slice: a newly prepared discharge lands on the detail delivered here, where
  its lots and shifts are then read.
- GH-54 and GH-55, the runtime resource slices GH-75 to GH-77, the closure slices, the activity log
  slice, and the rotation adjustment slices add their own panels or actions to this detail. This slice
  delivers the detail they extend, without anticipating their content.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/58
- Parent roadmap: specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md
- Sibling slice: specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/browse-the-discharges-list-in-the-web-workbench/spec.md
- Blockers: recorded as GitHub issue dependencies on the source issue.
- Related domain: discharge-preparation
- Domain vocabulary: `CONTEXT.md` (Discharge, Discharge Preparation, Vessel Description, Dock,
  Product Lot, Expected Tonnage, Customer, Warehouse Door Assignment, Discharge Truck Assignment,
  Truck Registration, Suspended Truck, Archived Resource, Shift, Shift Responsible, Weighing Area).
