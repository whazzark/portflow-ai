# Feature Specification: Plan Warehouse Door and Checkpoint Assignments

**Feature Branch**: `whazzark/plan-warehouse-door-and-checkpoint-assignments`

**Created**: 2026-07-09

**Last refined**: 2026-09-15

**Status**: Draft

**Input**: User description: "https://github.com/whazzark/portflow-ai/issues/54"

**Feature ID**: `GH-54`

**GitHub Issue**: [#54](https://github.com/whazzark/portflow-ai/issues/54)

**Parent Roadmap**: `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md`

**Roadmap Entry**: `GH-54`

**Priority**: priority:P1

**Milestone**: 4. Livrer la préparation interactive d'une Discharge

**Domain**: discharge-preparation

## Clarifications

### Session 2026-09-15

- Q: Does this slice also plan the doors and weighing areas of planned shifts that belong to an
  already active discharge? → A: No. It plans planned discharges only. Once a discharge is active,
  every change to its shifts' resources, including those of its planned shifts, is a runtime resource
  change owned by the runtime resource slices (GH-77, GH-78).
- Q: Must a shift's warehouse doors be doors currently assigned to a product lot of the same
  discharge, and what happens to planned shifts when such an assignment ends? → A: A shift may only
  select doors currently assigned to a lot of the same discharge. Withdrawing a door's last current
  assignment in the discharge is refused while a planned shift still selects it, and the shifts
  concerned are identified.
- Q: Is assigning a door already assigned in another planned or active discharge accepted? → A: Yes,
  with an indication naming the other discharge. The assignment is recorded, and the conflict is
  resolved when a discharge starts (GH-56).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assign Warehouse Doors to the Product Lots of a Planned Discharge (Priority: P1)

As an operations lead or administrator, I want to decide which warehouse doors receive each product
lot of a discharge that has not started yet, so that every truck deposit during the discharge is
attributed to the right customer's lot and the start confirmation finds the door assignments it
checks.

**Why this priority**: A rotation captures its product lot from its target door's assignment, and
the start confirmation (GH-56) checks that the required door assignments match the discharge. No
discharge prepared from the product can start or be traced to its customers without them.

**Independent Test**: Sign in as an operations lead, open a planned discharge with two product lots,
assign two doors of one warehouse to the first lot and one door of another warehouse to the second,
save, and verify that the detail shows each door, with its warehouse, as currently assigned to its
lot; then withdraw one door from the first lot and verify it is shown as an ended assignment of that
lot.

**Acceptance Scenarios**:

1. **Given** an operations lead, an operations admin, or an organization admin on the detail of a
   planned discharge, **When** they read a product lot, **Then** an action to change the lot's
   warehouse doors is offered.
2. **Given** that action, **When** the user chooses one or several available warehouse doors, each
   shown with its warehouse, and saves, **Then** each chosen door is shown on the lot as currently
   assigned, with its warehouse and the time its assignment started.
3. **Given** a lot with current door assignments, **When** the user withdraws one of its doors and
   saves, **Then** that door is no longer shown as currently assigned to the lot, and its assignment
   remains shown as ended with its effective period.
4. **Given** a door currently assigned to one lot of the discharge, **When** the user assigns it to
   another lot of the same discharge and saves, **Then** the door is currently assigned only to the
   second lot, the first lot shows that assignment as ended, and the user is told which lot the door
   was taken from.
5. **Given** a door whose assignment to a lot was ended, **When** the user assigns it to that lot
   again, **Then** a new current assignment is shown alongside the ended one.
6. **Given** the user saves a lot's doors without changing them, **When** the save completes, **Then**
   no assignment is started or ended.
7. **Given** an observer on a planned discharge's detail, **When** they read its lots, **Then** no
   action to change door assignments is offered, and an assignment attempt is refused without
   changing anything.
8. **Given** an unauthenticated visitor or a user whose access is not active, **When** they attempt to
   change a door assignment, **Then** the attempt is refused, nothing changes, and no discharge,
   warehouse, or door information is disclosed.

---

### User Story 2 - Select the Warehouse Doors and Weighing Areas of a Planned Shift (Priority: P1)

As an operations lead or administrator, I want to select, for each planned shift of a discharge that
has not started yet, the warehouse doors its trucks will deposit at and the weighing areas they will
be weighed in, so that each shift is prepared with the operational checkpoints it needs before it
starts.

**Why this priority**: A shift can only start with at least one warehouse door and one weighing area,
and its rotations may only target the doors and areas selected for it. Without this selection the
first shift of a discharge prepared from the product can never start.

**Independent Test**: On a planned discharge whose lots have door assignments, select two assigned
doors and one weighing area for the first planned shift and a different door and two weighing areas
for the second, save each, and verify the detail shows exactly those resources on each shift; then
remove one weighing area from the second shift and verify it is shown as ended on that shift.

**Acceptance Scenarios**:

1. **Given** a user allowed to prepare discharges on the detail of a planned discharge, **When** they
   read a planned shift, **Then** an action to change the shift's warehouse doors and weighing areas
   is offered.
2. **Given** that action, **When** the user chooses warehouse doors among the eligible doors, each
   shown with its warehouse and the lot it is assigned to, chooses weighing areas among the available
   weighing areas, and saves, **Then** the shift shows exactly those doors and weighing areas as
   currently selected.
3. **Given** a shift with selected resources, **When** the user removes a door or a weighing area
   from it and saves, **Then** the resource is no longer shown as currently selected for the shift,
   and its selection remains shown as ended with its effective period.
4. **Given** a door or weighing area selected for one planned shift, **When** the user prepares
   another planned shift, **Then** nothing is preselected for it and the resource may be selected
   again for that shift.
5. **Given** the user saves a shift's selection without changing it, **When** the save completes,
   **Then** no selection is started or ended.
6. **Given** a planned shift with no door or no weighing area selected, **When** the user reads it,
   **Then** it states which kind of resource has not been selected yet.
7. **Given** an observer, an unauthenticated visitor, or a user whose access is not active, **When**
   they attempt to change a shift's doors or weighing areas, **Then** the attempt is refused and
   nothing changes; the action is not offered to an observer.

---

### User Story 3 - Be Stopped Before Recording an Unusable Assignment (Priority: P2)

As the user planning doors and checkpoints, I want every assignment the discharge could not use to be
refused with an explanation, without anything being partly saved, so that the preparation stays
coherent for the start confirmation and the rotations that follow.

**Why this priority**: The planning actions of User Stories 1 and 2 already deliver value with valid
input; these refusals protect the invariants that later slices rely on and cover the concurrent and
stale cases a shared workbench produces.

**Independent Test**: Submit, in turn, an archived door, a door of an archived warehouse, an archived
weighing area, a door not assigned to any lot of the discharge for a shift, a change on an active
discharge, a change on a lot removed meanwhile, and the withdrawal of a door still selected for a
planned shift; verify each is refused with an explanation identifying the offending value and that no
assignment or selection was started or ended.

**Acceptance Scenarios**:

1. **Given** a door, its warehouse, or a weighing area archived after the user opened the change,
   **When** the user saves, **Then** the change is refused, the affected resource is identified as no
   longer available, and nothing changes.
2. **Given** a shift selection including a door that is not currently assigned to a product lot of
   the same discharge, **When** the user saves, **Then** the selection is refused and that door is
   identified.
3. **Given** a door currently selected for a planned shift of the discharge, **When** the user
   withdraws its last current assignment to a lot of that discharge, **Then** the withdrawal is
   refused and the shifts still selecting the door are identified.
4. **Given** a discharge that became active or closed after the user opened the change, **When** they
   save, **Then** the change is refused, the user is told the discharge is no longer planned, and the
   detail shows its current state.
5. **Given** a shift that is no longer planned, or a lot or shift removed after the user opened the
   change, **When** they save, **Then** the change is refused and the user is told the lot or shift is
   no longer available for planning.
6. **Given** two users assigning the same door to two different lots of the same discharge at once,
   **When** both save, **Then** the door ends up currently assigned to exactly one lot, and the other
   user is shown the current assignments.
7. **Given** a door currently assigned to a product lot of another planned or active discharge,
   **When** the user chooses it for a lot of this discharge, **Then** the door is offered with an
   indication naming the other discharge, and saving records the assignment without changing the
   other discharge; the conflict is left to the start confirmation (GH-56).

### Edge Cases

- A product lot may have several doors, from one or several warehouses, and a lot may have no door
  yet; whether every lot needs a door before starting is decided by the start confirmation (GH-56).
- Within one discharge, a door is currently assigned to at most one product lot, because a rotation
  takes its product lot from its target door's assignment.
- A weighing area may be selected for shifts of several discharges at once, since it may serve
  rotations of several active discharges.
- A planned shift may have no door or no weighing area selected; the requirement of at least one of
  each is enforced when the shift starts, not while it is planned.
- The same door may be currently assigned in several planned discharges, or in a planned and an active
  one. Each is shown the others as an indication; which discharge may use the door is decided when a
  discharge starts (GH-56).
- Resources are never inherited from another shift: a new or untouched planned shift has no door or
  weighing area selected until the user selects them.
- An archived door, a door of an archived warehouse, and an archived weighing area are never offered.
  A door or weighing area cannot be archived while a planned or active discharge currently uses it, so
  a planned discharge's current assignments and selections remain valid.
- Withdrawing a door or a weighing area keeps its ended assignment or selection readable on the
  detail; selecting it again starts a new one rather than reopening the ended one.
- A lot that has or has had a door assignment cannot be removed (GH-53), so withdrawing its doors does
  not make it removable.
- Correcting a lot's customer or product name (GH-53) keeps its door assignments unchanged.
- Repeating the same save, for instance through a repeated click or a resubmitted request, starts or
  ends each assignment and selection at most once.
- Leaving a change before saving changes nothing.
- A preparation with the expected volume of up to 20 product lots, 40 planned shifts, and every door
  and weighing area of the site can be planned without the offered choices becoming unusable.

## Requirements *(mandatory)*

### Functional Requirements

#### Authorization

- **FR-001**: The system MUST allow active operations leads, operations admins, and organization
  admins to change the warehouse door assignments of product lots and the warehouse doors and weighing
  areas of planned shifts as this slice defines.
- **FR-002**: The system MUST refuse these changes to observers, unauthenticated users, and users
  whose access is not active, without changing anything, and MUST NOT offer these actions to them.

#### Scope of planning

- **FR-003**: The changes of this slice MUST be offered from the discharge detail, on each product lot
  and on each planned shift, and only while the discharge is planned. Planned shifts of an active
  discharge MUST NOT be offered these changes.
- **FR-004**: The system MUST refuse every change of this slice on an active or a closed discharge, on
  a shift that is not planned, and on a lot or shift that no longer exists, including when the state
  changed after the user opened the change.

#### Warehouse door assignments

- **FR-005**: Users allowed to prepare discharges MUST be able to set which warehouse doors are
  currently assigned to a product lot, by assigning and withdrawing doors in one save.
- **FR-006**: Only available warehouse doors of available warehouses MUST be offered, each identified
  with its warehouse.
- **FR-007**: Within one discharge, a warehouse door MUST be currently assigned to at most one product
  lot. Assigning a door currently assigned to another lot of the same discharge MUST end that
  assignment and start the new one at the same instant, and MUST tell the user which lot the door was
  taken from.
- **FR-008**: Assigning a door MUST start an assignment effective from the time it is recorded;
  withdrawing a door MUST end its current assignment at the time it is recorded, and the ended
  assignment MUST remain readable with its effective period.
- **FR-009**: A door currently assigned to a product lot of another planned or active discharge MUST
  remain offered and assignable, with an indication naming that discharge. Recording the assignment
  MUST NOT change the other discharge.

#### Shift doors and weighing areas

- **FR-010**: Users allowed to prepare discharges MUST be able to set which warehouse doors and which
  weighing areas are currently selected for a planned shift, by adding and removing them in one save.
- **FR-011**: Only available weighing areas MUST be offered for a shift. The doors offered for a shift
  MUST be the doors currently assigned to a product lot of the same discharge, each shown with its
  warehouse and its lot.
- **FR-012**: Withdrawing a door's last current assignment within a discharge MUST be refused while a
  planned shift of that discharge still has the door selected, identifying those shifts.
- **FR-013**: Adding a resource to a shift MUST start a selection effective from the time it is
  recorded; removing it MUST end its current selection at that time, and the ended selection MUST
  remain readable with its effective period.
- **FR-014**: A shift's selection MUST NOT be copied or inherited from another shift, and selecting a
  resource for one shift MUST NOT change any other shift's selection.
- **FR-015**: A planned shift MUST be allowed to have no door or no weighing area selected, and the
  detail MUST state which kind of resource it still lacks.

#### Integrity

- **FR-016**: Each save MUST be atomic: either every assignment or selection change it contains is
  recorded, or none is.
- **FR-017**: Saving a lot's doors or a shift's resources without any change MUST NOT start or end any
  assignment or selection, and repeating the same save MUST NOT record its changes twice.
- **FR-018**: Concurrent changes to the same discharge MUST leave every door currently assigned to at
  most one of its lots and MUST NOT lose or duplicate an assignment or selection.
- **FR-019**: A change of this slice MUST NOT alter the discharge's status, dock, expected start,
  product lots, shifts' periods and responsibles, truck pool, or shift trucks.
- **FR-020**: A change of this slice MUST NOT confirm, activate, or reserve anything for the discharge
  start; conflicts between discharges are resolved when the discharge starts (GH-56).

#### Feedback

- **FR-021**: Every refusal MUST identify each offending lot, shift, door, or weighing area, explain
  the rule, and keep the user's unsaved choices on the page.
- **FR-022**: A door, warehouse, or weighing area that is no longer available when the user saves MUST
  cause a refusal identifying it, with nothing changed.
- **FR-023**: A failure unrelated to the chosen values MUST be shown as a failure the user can retry
  without choosing again.
- **FR-024**: While a change is being saved, the page MUST show that saving is in progress and MUST NOT
  accept a second submission of the same change.
- **FR-025**: After a successful save, the discharge detail MUST show the resulting current and ended
  assignments and selections without the user reloading the page.

### Key Entities *(include if feature involves data)*

- **Planned Discharge**: A discharge created but not started. This slice plans its door assignments
  and its planned shifts' doors and weighing areas.
- **Product Lot**: A traceable quantity of bulk material for one customer within the discharge, which
  receives warehouse door assignments.
- **Warehouse Door**: An available unloading door permanently belonging to one warehouse, assigned to
  lots and selected for shifts.
- **Warehouse Door Assignment**: The assignment of one door to one product lot of the discharge over
  an effective period that stays open while the assignment is current. Within a discharge a door has at
  most one current assignment.
- **Planned Shift**: A shift of the discharge that has not started, whose warehouse doors and weighing
  areas are selected explicitly.
- **Weighing Area**: An available operational checkpoint organized around a weighbridge, selected for
  shifts, possibly of several discharges.
- **Shift Resource Selection**: The selection of one door or weighing area for one shift over an
  effective period that stays open while the selection is current.
- **Preparing User**: An active operations lead, operations admin, or organization admin allowed to
  plan a discharge.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user allowed to prepare discharges can assign doors to three product lots and select
  doors and weighing areas for three planned shifts in under 5 minutes on their first attempt.
- **SC-002**: In acceptance testing, 100% of valid saves by operations leads, operations admins, and
  organization admins result in current assignments and selections that match the user's choices
  exactly, and 100% of attempts by observers, unauthenticated users, or non-active users change
  nothing.
- **SC-003**: 100% of the invalid cases listed in User Story 3 are refused with an explanation
  identifying the offending value, and 0 of them leave an assignment or selection partly started or
  ended.
- **SC-004**: After any sequence of tested and concurrent changes, 0 doors are currently assigned to
  more than one lot of the same discharge, and 0 assignments or selections are duplicated by repeated
  saves.
- **SC-005**: 100% of withdrawn door assignments and shift selections remain readable on the detail
  with their effective period.
- **SC-006**: 100% of change attempts on active or closed discharges, and on shifts that are not
  planned, are refused and change nothing.
- **SC-007**: For a preparation of 20 product lots and 40 planned shifts, a save completes and the
  updated detail is shown within 3 seconds for at least 95% of attempts under normal operating
  conditions.

## Assumptions

- "Checkpoint" in the issue title refers to the checkpoints a shift uses, its weighing areas. The dock,
  the other kind of checkpoint, belongs to the discharge rather than to a shift and is chosen and
  corrected by GH-53.
- The roles allowed to plan doors and checkpoints are the ones GH-53 allows to prepare and correct a
  discharge, since the same user prepares the whole discharge before confirming its start.
- The deployment serves a single site, so every offered door, warehouse, and weighing area belongs to
  it.
- Before a discharge starts no rotation exists, so withdrawing or moving a door assignment or a shift
  selection never affects operational records. Each change is still kept as an ended period, because
  `CONTEXT.md` makes every preparation change traceable and GH-58 shows ended assignments and
  selections.
- A door with no current assignment in the discharge cannot receive rotations for it, so a shift may
  only select doors currently assigned to one of its lots; withdrawing that assignment is refused
  rather than silently removing the door from planned shifts, following GH-53's choice to refuse
  rather than cascade.
- Once a discharge is active, `CONTEXT.md` classifies every shift resource change, including one to a
  planned shift, as a runtime resource change rather than preparation. The doors and weighing areas of
  the planned shifts of an active discharge are therefore left to the runtime resource slices (GH-78).
- Assigning a door already used by another discharge follows GH-53's choice for docks: planning is not
  blocked by another discharge, and the start confirmation (GH-56) resolves the conflict. The
  indication only names the other discharge, which every active user may already consult.
- The truck pool and each shift's trucks are planned by GH-55, which adds its own panel to the same
  detail.
- The discharge activity log does not exist yet (GH-102). Changes are kept as effective periods on the
  assignments and selections themselves and are not recorded as activity log entries here.
- Dates and times are displayed with the same convention as the discharge detail.
- Door and weighing area choices are made within the discharge detail rather than on a dedicated page,
  since each change concerns one lot or one shift of a detail that GH-58 designed to receive planning
  panels.

## Out of Scope

- Changing door assignments of an active discharge (GH-77), and changing the doors and weighing areas
  of any shift of an active discharge, whether active or planned (GH-78).
- Reserving trucks for the discharge and selecting a shift's trucks (GH-55).
- Confirming the discharge start, checking that every lot has a door and every first shift its
  resources, and resolving door conflicts between discharges (GH-56, GH-65).
- Choosing or correcting the discharge's dock, product lots, or shifts (GH-53, GH-63, GH-64, GH-66).
- Copying a shift's selection to other shifts or proposing a default selection.
- Choosing a rotation's target door or proposing a default door (rotation execution slices).
- Creating, archiving, or reactivating warehouses, doors, or weighing areas from the planning screen.
- Recording activity log entries (GH-102) and generating reports.

## Dependencies

- Blocked by GH-53, now delivered: the product lots and planned shifts this slice plans are created and
  corrected there.
- Relies on the discharge detail delivered by GH-58, which already reads current and ended door
  assignments and shift resources, and on the preparation model persisted by GH-236, which already
  holds door assignments and shift resource selections with effective periods.
- Relies on the delivered site-reference foundation: available warehouses, warehouse doors, and
  weighing areas, and their rule that a resource in use by a planned or active discharge cannot be
  archived.
- Deliverable in parallel with GH-55: neither blocks the other, but both add planning actions to the
  same discharge detail.
- GH-78 must cover the planned shifts of an active discharge as well as its active shift, since this
  slice does not; its specification should confirm this when it is refined.
- GH-56 depends on this slice: the start confirmation checks the door assignments it records and the
  first shift's doors and weighing areas it selects.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/54
- Parent roadmap: specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md
- Sibling slices: specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/prepare-a-discharge-with-product-lots-and-shifts/spec.md,
  specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/consult-a-prepared-discharge-in-the-web-workbench/spec.md,
  specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/plan-the-discharge-truck-pool-and-shift-subsets/spec.md
- Absorbed scope: the warehouse door and checkpoint half of "Update Discharge Resource Planning From
  the Frontend", a frontend-only slice split between GH-54 and GH-55 on 2026-09-10 and deleted from
  GitHub. This slice owns both the assignment commands and their planning screen.
- Blockers: recorded as GitHub issue dependencies on the source issue.
- Related domain: discharge-preparation
- Domain vocabulary: `CONTEXT.md` (Discharge Preparation, Planned Discharge, Discharge Start
  Confirmation, Product Lot, Warehouse, Warehouse Door, Warehouse Door Assignment, Checkpoint, Weighing
  Area, Planned Shift, Shift Preparation, Active Shift, Operations Lead, Operations Admin, Organization
  Admin, Observer, Available Site Reference, Archived Resource).
