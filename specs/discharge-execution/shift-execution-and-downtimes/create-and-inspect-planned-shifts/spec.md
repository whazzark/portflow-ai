# Feature Specification: Create and Inspect Planned Shifts

**Feature Branch**: `whazzark/create-and-inspect-planned-shifts`

**Created**: 2026-07-09

**Last refined**: 2026-09-17

**Status**: Draft

**Input**: User description: "https://github.com/whazzark/portflow-ai/issues/63"

**Feature ID**: `GH-63`

**GitHub Issue**: [#63](https://github.com/whazzark/portflow-ai/issues/63)

**Parent Roadmap**: `specs/discharge-execution/shift-execution-and-downtimes/roadmap.md`

**Roadmap Entry**: `GH-63`

**Priority**: priority:P1

**Milestone**: 5. Livrer l'exécution opérationnelle interactive

**Domain**: discharge-execution

## Clarifications

### Session 2026-09-17

- Q: On which discharges can a planned shift be added after the discharge is created? → A: Planned
  and active discharges. A closed discharge receives no new shift. On an active discharge, the added
  shift comes after every shift that has already started.
- Q: What does adding a planned shift set in the same step? → A: Its planned period and its
  responsible, always. On a planned discharge, its trucks, warehouse doors, and weighing areas may be
  selected in the same step, under the rules the existing planned shift correction applies. On an
  active discharge, the shift is added without resources; selecting them belongs to the runtime
  resource slices (GH-76, GH-77, GH-78).
- Q: What does inspecting a planned shift add to the shift panel and calendar already delivered? → A:
  A factual statement, on each planned shift, of what it still lacks to start: no usable truck, no
  usable warehouse door, no usable weighing area, or a responsible who is no longer eligible. It never
  states whether the shift or the discharge can start.
- Q: May a shift be added from the shift calendar? → A: Yes. Drawing a period over the calendar's
  columns with a mouse or a pen opens the same addition with that period entered, snapped to half an
  hour; a press without dragging enters its start and the last shift's duration. Everything else,
  including the rules and refusals, is the addition's. A finger keeps scrolling the calendar, and the
  section's `Add shift` action stays the way to add from a keyboard or a touch screen.
- Q: Does the calendar show how long the break between two shifts is? → A: Yes, as a fact only: each
  break reads its duration, on the calendar and between the shifts of the stacked list. No minimum
  break is warned about or enforced.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a Planned Shift to a Planned Discharge (Priority: P1)

As an operations lead or administrator, I want to add a shift to a discharge that has not started,
with its planned period, its responsible, and the trucks, warehouse doors, and weighing areas it will
use, so that the preparation follows the real work schedule as the vessel's discharge is extended or
split into more shifts, without recreating the discharge.

**Why this priority**: Today a discharge only has the shifts entered when it was created. Schedules
change before a vessel arrives, and every later execution slice (GH-64, GH-65, GH-66) acts on the
planned shifts a discharge holds. Adding one is the entry point of this roadmap.

**Independent Test**: Sign in as an operations lead, open a planned discharge with two planned shifts,
add a third shift planned between them with an eligible responsible, two held trucks, one door
currently assigned to a lot, and one weighing area, save, and verify that the Shifts section now
lists three shifts in planned-start order, that the new shift's panel shows exactly what was entered,
and that the section count reads three.

**Acceptance Scenarios**:

1. **Given** an operations lead, an operations admin, or an organization admin on the Shifts section
   of a planned discharge, **When** they choose to add a shift, **Then** a form opens asking for a
   planned start, a planned end, and a responsible, and offering the trucks, warehouse doors, and
   weighing areas a planned shift of this discharge may select.
2. **Given** that form, **When** the user enters a valid period, selects an eligible responsible, and
   saves without selecting any resource, **Then** the discharge gains a planned shift with exactly
   that period and responsible and no resource, and its panel opens.
3. **Given** that form, **When** the user also selects trucks held by the discharge, warehouse doors
   currently assigned to one of its lots, and available weighing areas, and saves, **Then** the new
   shift shows exactly those resources.
4. **Given** a new shift whose planned period lies before, between, or after the existing shifts,
   **When** it is saved, **Then** the shifts of the discharge are listed, and shown on the calendar, in
   planned-start order.
5. **Given** a shift has been added, **When** the user reads the discharge's section counts and its
   Overview preparation summary, **Then** they include the new shift without a reload.
6. **Given** a shift has been added, **When** another user opens the same discharge, **Then** they see
   the new shift with the same values.
7. **Given** a user allowed to add shifts on the Shifts section of a discharge that is not closed,
   **When** they draw a period over the shift calendar with a mouse, **Then** the addition form opens
   with that period as its planned start and end, snapped to half an hour.

---

### User Story 2 - Add a Planned Shift to an Active Discharge (Priority: P1)

As an operations lead or administrator, I want to add the next shifts of a discharge that is already
under way, so that work planned for the coming days has a period and an accountable responsible
before it begins.

**Why this priority**: A discharge often runs over several days, and its later shifts are only
planned once it is under way. Without adding shifts to an active discharge, GH-65 and GH-69 would
have no next shift to start.

**Independent Test**: Open an active discharge with one completed shift, one active shift, and no
planned shift; add a shift planned after the active one with an eligible responsible, and verify that
it is listed as planned after the started shifts, that it has no resource, and that the form offered
no resource selection. Then attempt to add a shift planned to start before the active shift and
verify the attempt is refused.

**Acceptance Scenarios**:

1. **Given** a user allowed to plan shifts on the Shifts section of an active discharge, **When** they
   choose to add a shift, **Then** the form asks for a planned start, a planned end, and a responsible,
   and offers no truck, warehouse door, or weighing area.
2. **Given** a valid period that starts after every started shift of the discharge and does not
   overlap another shift, and an eligible responsible, **When** the user saves, **Then** the discharge
   gains a planned shift with exactly that period and responsible and no resource, and the discharge
   stays active.
3. **Given** a planned period that starts before, or at the same time as, a shift of the discharge
   that is active or completed, **When** the user saves, **Then** the addition is refused, the user is
   told a new shift must come after the shifts already started, and that shift is identified.
4. **Given** an active discharge with several planned shifts, **When** a shift is added between two of
   them without overlapping either, **Then** it is accepted and listed between them.
5. **Given** an active discharge, **When** a shift is added, **Then** the active shift, if any, its
   resources, and every started shift are unchanged.

---

### User Story 3 - Be Stopped Before Adding an Incoherent Shift (Priority: P1)

As the user adding a shift, I want every value that breaks the shift rules to be explained next to
what I entered, without losing my input and without anything being partly saved, so that the shifts
the start and execution slices rely on are always coherent.

**Why this priority**: Overlapping shifts, an ineligible responsible, or a resource the shift cannot
use would break the start revalidation (GH-65) and the shift reports. Refusing them at the source is
part of adding a shift.

**Independent Test**: Submit an addition with, in turn, no planned start, an end before the start, a
period overlapping an existing shift, an observer as responsible, a truck not held by the discharge,
and a door not assigned to any lot of the discharge; verify each is refused with its explanation
attached to the offending value, that the other entered values are kept, and that the discharge's
shifts are unchanged.

**Acceptance Scenarios**:

1. **Given** the planned start, the planned end, or the responsible is missing, **When** the user
   saves, **Then** the addition is refused and each missing value is identified.
2. **Given** a planned end that is not after the planned start, **When** the user saves, **Then** the
   addition is refused and the period is identified.
3. **Given** a planned period that overlaps another shift of the same discharge, **When** the user
   saves, **Then** the addition is refused and the overlapped shift is identified by its planned
   period; a period that starts exactly when another shift ends, or ends exactly when another starts,
   is accepted.
4. **Given** a responsible who is not an active operations lead, operations admin, or organization
   admin, **When** the user saves, **Then** the addition is refused and the responsible is identified
   as not eligible.
5. **Given** a planned discharge and a selected truck that the discharge does not hold or that is
   suspended, a warehouse door not currently assigned to one of its lots or no longer available, or a
   weighing area no longer available, **When** the user saves, **Then** the addition is refused and
   each such resource is identified with its reason.
6. **Given** a resource selection submitted for a shift of an active discharge, **When** it is
   received, **Then** the addition is refused and nothing is added.
7. **Given** any refused addition, **When** the refusal is shown, **Then** every value the user entered
   is kept in the form and the discharge's shifts are unchanged.

---

### User Story 4 - See What a Planned Shift Still Lacks to Start (Priority: P2)

As any active user following a discharge, I want each planned shift to state plainly what it still
lacks to start, so that preparers can fill the gaps before the shift is due and observers can see
which upcoming shifts are not ready without opening every resource list.

**Why this priority**: A shift can only start with a truck, a warehouse door, a weighing area, and an
eligible responsible, and GH-65 revalidates them at start. Today only the absence of trucks is
signalled. Adding shifts is valuable without this, but a preparer then has to check each shift's
resources one by one.

**Independent Test**: Open a planned discharge with three planned shifts: one with a truck, a door,
and a weighing area; one with only a suspended truck and nothing else; and one whose responsible has
since been deactivated. Verify that the first shows no gap, that the second shows no usable truck, no
warehouse door, and no weighing area, that the third shows its responsible as no longer eligible, and
that the calendar marks the second and third as having gaps. Verify an observer sees the same.

**Acceptance Scenarios**:

1. **Given** a planned shift, **When** any active user opens its panel, **Then** it lists each gap
   among: no usable truck, no usable warehouse door, no usable weighing area, and a responsible who is
   no longer eligible; a shift with none of these states that nothing is missing among these
   elements.
2. **Given** a planned shift whose only selected trucks are suspended or archived, **When** it is
   inspected, **Then** it shows no usable truck, and the selected trucks remain listed with their
   markers.
3. **Given** a planned shift whose only selected warehouse doors or weighing areas are archived or no
   longer currently assigned to a lot of the discharge, **When** it is inspected, **Then** it shows the
   corresponding gap, and those resources remain listed with their markers.
4. **Given** a planned shift, **When** any active user reads the shift calendar, **Then** a planned
   shift with at least one gap is visibly distinguished from one without, by a signal that does not
   rely on colour alone.
5. **Given** an active or completed shift, **When** it is inspected, **Then** no gap statement is
   shown.
6. **Given** a gap statement, **When** it is shown, **Then** it states nothing about whether the shift
   or the discharge can start.
7. **Given** a user allowed to plan shifts on a planned discharge, **When** they read a gap, **Then**
   they are offered the way to fill it: the shift's correction for a missing resource or responsible,
   and the Truck pool section when the discharge holds no truck.
8. **Given** a change that fills or opens a gap, such as a truck being suspended or selected, **When**
   the shift is read again or the change was made on this page, **Then** the gaps reflect the current
   state.

---

### User Story 5 - Keep Additions Safe While Others Change the Discharge (Priority: P2)

As the user adding a shift, I want an addition that no longer applies to the discharge's current
state to be refused with an explanation, and never applied twice, so that concurrent planning never
leaves overlapping or duplicated shifts.

**Why this priority**: Several leads plan the same discharges, and a discharge may start or close
while a form is open. The rules of Stories 1 to 3 must hold under those conditions, but they refine
those flows.

**Independent Test**: Open the add-shift form on the same planned discharge in two sessions. In the
second, add a shift; in the first, save a shift overlapping it and verify the refusal names the new
shift. Then start the discharge in the second session and save an addition with resources in the
first; verify it is refused as the discharge has started and the detail refreshes. Finally, submit
the same valid addition twice quickly and verify one shift is added.

**Acceptance Scenarios**:

1. **Given** another user added a shift after the form was opened, **When** the user saves a period
   overlapping it, **Then** the addition is refused, the new shift is identified, and the Shifts
   section shows it.
2. **Given** a discharge that became active after the user opened a form with resources selected,
   **When** they save, **Then** the addition is refused, the user is told the discharge has started,
   their period and responsible are kept, and the detail shows its current state.
3. **Given** a discharge that was closed after the user opened the form, **When** they save, **Then**
   the addition is refused, the user is told the discharge is closed, and nothing is added.
4. **Given** a shift of the discharge that started after the form was opened, **When** the user saves
   a shift planned to start before it, **Then** the addition is refused as in User Story 2.
5. **Given** a responsible or resource that lost its eligibility or availability after the form was
   opened, **When** the user saves, **Then** the addition is refused, that value is identified as no
   longer available, and the user's other values are kept.
6. **Given** an addition being saved, **When** the user submits again or the same submission is
   repeated, **Then** exactly one shift is added.
7. **Given** a failure unrelated to the entered values, **When** saving fails, **Then** the user is
   told the shift could not be added and can retry without re-entering their values.

### Edge Cases

- A discharge may receive a shift planned in the past, as at creation; planned times never trigger a
  lifecycle transition.
- A shift may be added on a planned discharge whose other shifts all lie in the past or all lie in the
  future, and before the earliest existing shift.
- A responsible may already be responsible for other shifts of the same discharge, and the user adding
  the shift may select themselves.
- A shift may be added to a planned discharge that holds no truck; the form then offers no truck and
  points to the Truck pool section, and the shift is added with the no-usable-truck gap.
- An active discharge with no active shift, between two shifts, accepts a shift planned after its last
  completed shift.
- On an active discharge, the rule that a new shift comes after every started shift uses the shift's
  actual start once one is recorded, and its planned start until then.
- A planned shift on an active discharge added by this slice shows the no-usable-truck, no-usable-door,
  and no-usable-weighing-area gaps until the runtime resource slices let users select them.
- A closed discharge offers no action to add a shift, and an attempt is refused.
- Leaving the form or opening another shift before saving adds nothing.
- A discharge with the expected volume of 40 shifts can receive a 41st shift; no maximum number of
  shifts is enforced.
- A shift created by earlier seeding with no responsible eligible today is inspected like any other
  and shows the ineligible-responsible gap; reassigning it belongs to GH-66.
- A truck selected for the new shift may also be selected for other shifts of the same discharge.

## Requirements *(mandatory)*

### Functional Requirements

#### Authorization

- **FR-001**: The system MUST allow active operations leads, operations admins, and organization admins
  to add planned shifts as this slice defines.
- **FR-002**: The system MUST refuse an addition to observers, unauthenticated users, and users whose
  access is not active, without adding anything, and MUST NOT offer the action to them.
  Unauthenticated users and users whose access is not active MUST NOT receive any shift, user, or
  resource information.
- **FR-003**: Every active user, including observers, MUST be able to read the gaps of a planned
  shift.

#### Adding a planned shift

- **FR-004**: The Shifts section of a planned or active discharge MUST offer an action to add a shift to
  the users allowed to plan shifts. A closed discharge MUST NOT offer it, and an addition to a closed
  discharge MUST be refused.
- **FR-005**: An added shift MUST have a planned start, a planned end strictly after its start, and one
  responsible, and MUST be in the planned status.
- **FR-006**: The responsible MUST be an active operations lead, operations admin, or organization
  admin, and only such users MUST be offered.
- **FR-007**: The planned period of an added shift MUST NOT overlap the planned period of any other
  shift of the same discharge; a period that touches another shift's period at its start or end MUST
  be accepted.
- **FR-008**: On an active discharge, an added shift MUST start strictly after the start of every
  active or completed shift of that discharge.
- **FR-009**: On a planned discharge, the addition MUST allow selecting, in the same step, trucks held
  by the discharge that are not suspended, warehouse doors currently assigned to one of its product
  lots, and available weighing areas; each selection MAY be empty.
- **FR-010**: On an active discharge, the addition MUST NOT offer or accept any truck, warehouse door,
  or weighing area selection.
- **FR-011**: An addition MUST be atomic: either the shift with its responsible and all its selected
  resources is added, or nothing is.
- **FR-012**: An addition MUST NOT change the discharge's status, identity, product lots, door
  assignments, or truck pool, nor any other shift's period, responsible, status, or resources.
- **FR-013**: After an addition, the discharge's shifts MUST be ordered by planned start everywhere they
  are shown.
- **FR-014**: A successful addition MUST open the new shift's panel and update the Shifts section, its
  count, the calendar, and the Overview preparation summary without a reload.
- **FR-015**: Repeating the same addition submission MUST NOT add more than one shift.
- **FR-016**: Planned periods MUST NOT be constrained by the discharge's expected start and MAY be in
  the past.

#### Inspecting planned shifts

- **FR-017**: The panel of each planned shift MUST state each of the following gaps that applies, and
  MUST state that none applies otherwise: no usable truck, no usable warehouse door, no usable weighing
  area, responsible no longer eligible.
- **FR-018**: A truck MUST count as usable for a planned shift when it is selected for the shift, still
  held by the discharge, and neither suspended nor archived. A warehouse door MUST count as usable when
  it is selected for the shift, available in an available warehouse, and currently assigned to a
  product lot of the discharge. A
  weighing area MUST count as usable when it is selected for the shift and available.
- **FR-019**: A responsible MUST count as no longer eligible when they are not an active operations
  lead, operations admin, or organization admin.
- **FR-020**: The shift calendar MUST distinguish planned shifts with at least one gap from those
  without, by a signal that does not rely on colour alone.
- **FR-021**: Gap statements MUST reflect the current state of the shift, its responsible, and its
  resources whenever the discharge detail is read, and MUST update without a reload after a change
  made on the page.
- **FR-022**: Gap statements MUST NOT be shown for active or completed shifts, and MUST NOT state
  whether a shift or a discharge can start.
- **FR-023**: For users allowed to plan shifts on a planned discharge, each gap MUST lead to the way of
  filling it: the shift's correction, or the Truck pool section when the discharge holds no truck.

#### Concurrency and feedback

- **FR-024**: An addition MUST be judged against the discharge's state at the moment it is saved,
  including shifts added or started, status changes, and responsible or resource changes made after
  the form was opened.
- **FR-025**: Every refusal caused by entered values or by the discharge's current state MUST identify
  each offending value, shift, or state, explain the rule, and keep every value the user entered.
- **FR-026**: After a refusal caused by the discharge's current state, the detail MUST show that
  current state.
- **FR-027**: A refusal caused by a failure unrelated to the entered values MUST be shown as a failure
  the user can retry without re-entering their values.
- **FR-028**: While an addition is being saved, the form MUST show that saving is in progress and MUST
  NOT accept a second submission.
- **FR-029**: Users allowed to add shifts MUST be able to start an addition by drawing a period over
  the shift calendar with a mouse or a pen, which enters that period, snapped to half an hour, in the
  addition form. A press without dragging MUST enter its start and, when the discharge has a shift, an
  end as far after it as the last shift lasts. Drawing MUST NOT be offered to other users, MUST NOT
  start over a shift, and MUST be cancellable with Escape.
- **FR-030**: The shift calendar MUST state the duration of each break between a shift's end and the
  next shift's start, once per break, to every user who can read the shifts. It MUST NOT judge
  whether the break is long enough.

### Key Entities *(include if feature involves data)*

- **Discharge**: The planned or active discharge receiving a new shift; a closed discharge receives none.
- **Planned Shift**: A shift that has not started, with a planned period that overlaps no other shift of
  its discharge, one responsible, and, on a planned discharge, its selected trucks, warehouse doors,
  and weighing areas. This slice adds it after the discharge's creation.
- **Started Shift**: An active or completed shift of the discharge; an added shift must start after
  every one of them.
- **Shift Responsible**: The active operations lead, operations admin, or organization admin
  accountable for the shift.
- **Shift Preparation**: The explicit selection of a shift's planned period, responsible, trucks,
  warehouse doors, and weighing areas, never inherited from another shift.
- **Shift Gap**: A factual, derived statement that a planned shift has no usable truck, no usable
  warehouse door, no usable weighing area, or a responsible no longer eligible. It is not stored and
  carries no verdict on starting.
- **Shift Planner**: An active operations lead, operations admin, or organization admin allowed to add
  planned shifts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user allowed to plan shifts can add a planned shift with its responsible, two trucks, a
  warehouse door, and a weighing area to a planned discharge in under 1 minute on their first attempt.
- **SC-002**: In acceptance testing, 100% of valid additions produce exactly one planned shift whose
  period, responsible, and resources match the input, listed in planned-start order, with every other
  shift and the discharge unchanged.
- **SC-003**: 100% of the refused cases listed in User Stories 2, 3, and 5 are refused with an
  explanation identifying the offending value, shift, or state, keep the user's input, and add nothing.
- **SC-004**: 0 overlapping shifts and 0 duplicate shifts result from concurrent or repeated additions
  in acceptance testing.
- **SC-005**: 100% of addition attempts by observers, unauthenticated users, or non-active users, and of
  additions to closed discharges, are refused and add nothing.
- **SC-006**: For 100% of tested planned shifts, the gaps shown match the shift's current responsible
  and resources exactly, for every role, and no gap is shown on active or completed shifts.
- **SC-007**: A preparer can tell which planned shifts of a 40-shift discharge have gaps from the
  calendar alone, without opening any shift.
- **SC-008**: On a discharge with 40 shifts, an addition is saved and reflected on the detail within 2
  seconds for at least 95% of attempts under normal operating conditions.

## Assumptions

- The deployment serves a single site, so every offered responsible and resource belongs to it.
- The actors are the ones GH-53 settled for preparing a discharge and CONTEXT.md gives for shifts:
  operations leads, operations admins, and organization admins; observers keep read-only access.
- `CONTEXT.md` defines a planned shift as existing "including while its discharge is active" and a
  closed discharge as receiving no new shifts, and GH-53 recorded that adding shifts after creation
  belongs here for planned and active discharges alike.
- `CONTEXT.md` treats a shift resource change as preparation before activation and a runtime-resource
  change afterward. GH-54 and GH-55 therefore left the resources of an active discharge's planned
  shifts to GH-76, GH-77, and GH-78, and this slice does the same when adding a shift.
- Selecting resources while adding a shift to a planned discharge applies exactly the rules the
  delivered planned shift correction applies: trucks held and not suspended, doors currently assigned
  to a lot of the discharge, and available weighing areas.
- "Planned shifts start in chronological order" is enforced for an active discharge by requiring an
  added shift to start after every started shift. Actual start times are not recorded until GH-65; the
  planned start of a started shift stands in for it until then.
- Inspection extends the shift panel and calendar delivered by GH-58, GH-54, and GH-55, rather than
  introducing a new page. The panel and its address are unchanged.
- The four gaps are the start requirements `CONTEXT.md` names for an active shift and its responsible.
  Whether the discharge's customers, lots, and door assignments match is the Discharge Start
  Confirmation's concern (GH-56) and is not a shift gap.
- The Overview preparation summary keeps the counts GH-55 defined; it now includes added shifts, but
  its content is not otherwise changed here.
- The add form is opened from the Shifts section in the same way as the delivered shift correction,
  and is not kept in the page address.
- The shift's correction on a planned discharge is already delivered and remains the way to fill a
  gap; correcting shifts of an active discharge is not.
- The discharge activity log (GH-102) is not delivered; additions are not recorded as activity log
  entries here.
- Dates and times are entered and displayed with the same convention as the discharges list and
  detail.

## Out of Scope

- Replanning, reordering, or removing planned shifts, including on an active discharge (GH-64).
- Starting the first shift and activating the discharge, and revalidating a shift's responsible and
  resources at start (GH-56, GH-65).
- Reassigning a shift's responsible, and protecting a responsible's eligibility while they hold
  non-completed shifts (GH-66).
- Selecting or changing the trucks, warehouse doors, or weighing areas of shifts of an active
  discharge (GH-76, GH-77, GH-78).
- Stating whether a shift or a discharge is ready to start.
- Copying a shift, its responsible, or its resources to create another shift, or adding several shifts
  in one change.
- Drawing a period on the calendar by touch, or scrolling the calendar while drawing past its visible columns.
- Warning about or enforcing a minimum inter-shift break, or a maximum shift duration.
- Recording activity log entries (GH-102) and generating reports.

## Dependencies

- Blocked by GH-53, delivered: this slice adds shifts to the discharges that slice creates, under the
  shift rules it set.
- Relies on GH-58, GH-54, and GH-55, delivered: the Shifts section, the shift calendar and panel, the
  truck pool, door assignments, and the planned shift correction that this slice extends and reuses.
- Relies on the delivered site-reference and user foundations: available, suspended, and archived
  resources, and active users with their roles.
- GH-64, GH-65, and GH-66 depend on this slice and may be delivered in parallel once it exists; they
  act on the same Shifts section.
- GH-76, GH-77, and GH-78 own the resource selection of the planned shifts this slice adds to active
  discharges.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/63
- Parent roadmap: specs/discharge-execution/shift-execution-and-downtimes/roadmap.md
- Related specs: specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/prepare-a-discharge-with-product-lots-and-shifts/spec.md,
  specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/plan-the-discharge-truck-pool-and-shift-subsets/spec.md,
  specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/plan-warehouse-door-and-checkpoint-assignments/spec.md,
  specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/consult-a-prepared-discharge-in-the-web-workbench/spec.md
- Blockers: recorded as GitHub issue dependencies on the source issue.
- Related domain: discharge-execution
- Domain vocabulary: `CONTEXT.md` (Discharge, Planned Discharge, Active Discharge, Closed Discharge,
  Shift, Planned Shift, Active Shift, Completed Shift, Inter-Shift Break, Shift Preparation, Shift
  Responsible, Discharge Truck Assignment, Suspended Truck, Archived Resource, Operations Lead,
  Operations Admin, Organization Admin, Observer).
