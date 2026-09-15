# Feature Specification: Prepare a Planned Discharge With Its Product Lots and Shifts

**Feature Branch**: `whazzark/prepare-a-planned-discharge-with-its-product-lot`

**Created**: 2026-07-09

**Last refined**: 2026-09-15

**Status**: Draft

**Input**: User description: "Prepare a planned discharge with its product lots and shifts. https://github.com/whazzark/portflow-ai/issues/53"

**Feature ID**: `GH-53`

**GitHub Issue**: [#53](https://github.com/whazzark/portflow-ai/issues/53)

**Parent Roadmap**: `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md`

**Roadmap Entry**: `GH-53`

**Priority**: priority:P1

**Milestone**: 4. Livrer la préparation interactive d'une Discharge

**Domain**: discharge-preparation

## Clarifications

### Session 2026-09-15

- Q: Beyond creating a planned discharge with its product lots and first planned shifts, what else
  does this slice cover while the discharge is still planned? → A: Creating the discharge with its
  lots and first shifts in one step, and, while it stays planned, correcting its vessel description,
  dock, and expected start and adding, correcting, or removing its product lots. Adding, replanning,
  or removing shifts and reassigning their responsible after creation stay with GH-63, GH-64, and
  GH-66.
- Q: Which roles may prepare and correct a planned discharge? → A: Operations leads, operations
  admins, and organization admins. Observers keep read-only access.
- Q: Where does the creation form live? → A: On a dedicated creation page with its own address,
  reached from the discharges list. A successful creation opens the new discharge's detail page
  delivered by GH-58.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prepare a Planned Discharge in One Step (Priority: P1)

As an operations lead or administrator, I want to record a vessel's upcoming discharge with its
dock, its expected start, the product lots it unloads for each customer, and the shifts that will
work it, so that the discharge exists in the product as a coherent preparation that doors, trucks,
and the start confirmation can then build on, instead of being seeded by hand.

**Why this priority**: No discharge can be prepared from the product today. Every later preparation,
start, execution, and reporting slice needs a discharge created through the product, and this is
the milestone's first interactive step.

**Independent Test**: Sign in as an operations lead, open the creation page from the discharges list,
enter a vessel, a dock, an expected start, two product lots for different customers, and two planned
shifts with their responsible, save, and verify that the detail page of a new planned discharge
opens showing exactly what was entered, and that the discharges list now includes it.

**Acceptance Scenarios**:

1. **Given** an operations lead, an operations admin, or an organization admin on the discharges list,
   **When** they choose to create a discharge, **Then** the creation page opens.
2. **Given** the creation page, **When** the user enters a vessel name, selects an available dock,
   enters an expected start, adds at least one product lot and at least one planned shift, and saves,
   **Then** a discharge is created in the planned status and its detail page opens.
3. **Given** a product lot is being added, **When** the user selects an available customer, enters a
   product name, an expected quantity in tonnes, and optionally a description, **Then** the lot is
   part of the saved discharge with exactly those values, and the discharge's expected tonnage is
   the sum of its lots' expected quantities.
4. **Given** a planned shift is being added, **When** the user enters its planned start and end and
   selects an eligible responsible, **Then** the shift is part of the saved discharge in the planned
   status with exactly that period and responsible.
5. **Given** the user entered the shifts out of chronological order, **When** the discharge is saved,
   **Then** its shifts are ordered by planned start.
6. **Given** the vessel IMO, the vessel comment, or a lot description is left empty, **When** the
   discharge is saved, **Then** it is created, and each empty value is shown as not specified.
7. **Given** a discharge was just created, **When** the user returns to the discharges list, **Then**
   the new discharge appears among the planned discharges.
8. **Given** an observer, **When** they browse the discharges list or a discharge detail, **Then** no
   action to create a discharge is offered, and a creation attempt, including by opening the creation
   page address directly, is refused without creating anything.
9. **Given** an unauthenticated visitor or a user whose access is not active, **When** they attempt
   to create a discharge, **Then** the attempt is refused, nothing is created, and no dock, customer,
   or user information is disclosed.

---

### User Story 2 - Be Stopped Before Recording an Incoherent Preparation (Priority: P1)

As the user preparing a discharge, I want every invalid value to be explained next to what I entered,
without losing the rest of my input and without anything being partly saved, so that I only ever
record a preparation the later slices can rely on.

**Why this priority**: A preparation with a duplicate lot, overlapping shifts, or an ineligible
responsible would break the door assignments, the start confirmation, and the reports that follow.
Refusing it at the source is part of the creation itself, not a refinement.

**Independent Test**: Submit a creation with, in turn, no vessel name, no lot, no shift, a zero
quantity, a quantity with four decimals, two lots with the same customer and product name in a
different case, overlapping shifts, a shift ending before it starts, and an observer as responsible;
verify each is refused with an explanation attached to the offending value, that the other entered
values are kept, and that no discharge, lot, or shift was created.

**Acceptance Scenarios**:

1. **Given** the vessel name, the dock, or the expected start is missing, **When** the user saves,
   **Then** creation is refused and the missing value is identified.
2. **Given** no product lot or no planned shift was added, **When** the user saves, **Then** creation
   is refused and the user is told that a discharge needs at least one product lot and one planned
   shift.
3. **Given** a lot has no customer, no product name, or no expected quantity, **When** the user saves,
   **Then** creation is refused and the incomplete lot and value are identified.
4. **Given** an expected quantity that is zero, negative, or has more than three decimal places,
   **When** the user saves, **Then** creation is refused with an explanation of the accepted quantity.
5. **Given** two lots with the same customer and the same product name, ignoring case and surrounding
   spaces, **When** the user saves, **Then** creation is refused and both lots are identified as
   duplicates.
6. **Given** a shift whose planned end is not after its planned start, **When** the user saves,
   **Then** creation is refused and that shift is identified.
7. **Given** two shifts whose planned periods overlap, **When** the user saves, **Then** creation is
   refused and both shifts are identified; two shifts where one ends exactly when the next starts are
   accepted.
8. **Given** a vessel IMO that is not a seven-digit number, **When** the user saves, **Then** creation
   is refused with an explanation of the expected format.
9. **Given** any refused creation, **When** the refusal is shown, **Then** every value the user
   entered is kept on the page and nothing has been created.
10. **Given** the dock, a customer, or a responsible selected on the page has since been archived,
    deactivated, or made ineligible, **When** the user saves, **Then** creation is refused, the
    affected value is identified as no longer available, and nothing is created.

---

### User Story 3 - Correct a Planned Discharge's Vessel, Dock, and Expected Start (Priority: P2)

As an operations lead or administrator, I want to correct the vessel description, the dock, or the
expected start of a discharge that has not started yet, so that its preparation follows the vessel's
real arrival without deleting and recreating the discharge.

**Why this priority**: Vessel arrivals move and berths change before a discharge starts. Creation is
valuable without corrections, but a preparation that cannot follow reality soon becomes wrong.

**Independent Test**: Open a planned discharge's detail, correct its vessel name, IMO, comment, dock,
and expected start, and verify that the detail and the discharges list show the corrected values,
that its lots and shifts are unchanged, and that the same correction is not offered on an active or a
closed discharge.

**Acceptance Scenarios**:

1. **Given** a planned discharge's detail and a user allowed to prepare discharges, **When** they
   correct the vessel name, IMO, comment, dock, or expected start and save, **Then** the detail shows
   the corrected values and the discharge keeps its status, product lots, shifts, truck pool, and
   door assignments unchanged.
2. **Given** a correction with a missing vessel name, an invalid IMO, a dock no longer available, or a
   missing expected start, **When** the user saves, **Then** the correction is refused with the same
   explanations as at creation, and the discharge is unchanged.
3. **Given** an active or a closed discharge, **When** a user reads its detail, **Then** no correction
   of its vessel description, dock, or expected start is offered, and a correction attempt is refused.
4. **Given** a discharge that became active after the user opened a correction, **When** they save,
   **Then** the correction is refused, the user is told the discharge has started, and the detail
   shows its current state.
5. **Given** an observer on a planned discharge's detail, **When** they read it, **Then** no correction
   is offered, and a correction attempt is refused.

---

### User Story 4 - Add, Correct, and Remove the Product Lots of a Planned Discharge (Priority: P2)

As an operations lead or administrator, I want to add a product lot, correct a lot's customer,
product name, expected quantity, or description, or remove a lot entered by mistake while the
discharge is still planned, so that the lots confirmed at start are the ones actually unloaded.

**Why this priority**: Cargo manifests are often finalized after the discharge is first prepared, and
the start confirmation checks that the planned lots match. Lot corrections keep the preparation
usable until then.

**Independent Test**: On a planned discharge, add a lot, correct another lot's quantity and customer,
remove a third lot, and verify the detail and expected tonnage after each; then verify that removing
the last lot, removing a lot with door assignments, creating a duplicate lot, and any lot change on
an active discharge are refused.

**Acceptance Scenarios**:

1. **Given** a planned discharge, **When** a user allowed to prepare discharges adds a valid product
   lot, **Then** the lot appears on the detail and the expected tonnage includes its quantity.
2. **Given** a lot of a planned discharge, **When** the user corrects its customer, product name,
   expected quantity, or description and saves, **Then** the detail shows the corrected lot, the
   expected tonnage reflects the corrected quantity, and the lot keeps its warehouse door assignments.
3. **Given** a lot of a planned discharge with no warehouse door assignment, current or ended, and
   another lot remaining, **When** the user removes it and confirms, **Then** it no longer appears on
   the detail and the expected tonnage no longer includes it.
4. **Given** the only product lot of a planned discharge, **When** the user attempts to remove it,
   **Then** the removal is refused because a discharge needs at least one product lot.
5. **Given** a lot that has or has had a warehouse door assignment, **When** the user attempts to
   remove it, **Then** the removal is refused and the user is told the lot has warehouse door
   assignments.
6. **Given** an added or corrected lot that would share its customer and product name with another lot
   of the same discharge, ignoring case and surrounding spaces, **When** the user saves, **Then** the
   change is refused and the existing lot is identified.
7. **Given** an added or corrected lot with an invalid quantity or a customer no longer available,
   **When** the user saves, **Then** the change is refused with an explanation, and the discharge's
   lots are unchanged.
8. **Given** an active or a closed discharge, **When** a user reads its product lots, **Then** no lot
   can be added, corrected, or removed, and any such attempt is refused.

### Edge Cases

- A dock currently serving another planned or active discharge may still be selected; whether two
  discharges can use one dock at the same time is decided when a discharge starts (GH-56), not when it
  is prepared.
- An archived dock or customer is never offered for selection, and a pending, deactivated, or
  cancelled user is never offered as responsible.
- A dock or customer cannot be archived while a planned discharge uses it, so a planned discharge's
  current dock and its lots' current customers remain available when they are corrected.
- Two lots may share a product name for different customers, and one customer may have several lots
  with different product names.
- Contiguous shifts, where one ends exactly when the next starts, are accepted; the inter-shift break
  has no minimum duration.
- Shifts may be planned on several days and are not constrained by the discharge's expected start,
  which remains indicative.
- An expected start or shift period in the past is accepted: planned times never trigger a lifecycle
  transition, and a discharge may be recorded after the fact.
- A responsible may be responsible for several shifts of the same discharge, and the user preparing
  the discharge may select themselves.
- An active observer is never offered as responsible and is refused if submitted.
- Saving the creation twice, for instance through a repeated click or a resubmitted request, creates
  one discharge, not two.
- Two users correcting the same planned discharge at once each apply their change to its current
  state; a lot removed by one cannot be corrected or recreated by the other's stale page, which is
  told the lot no longer exists.
- Correcting a lot's quantity or removing a lot changes the expected tonnage everywhere it is shown,
  including the discharges list.
- Leaving the creation page before saving creates nothing.
- A preparation with the expected volume of up to 20 product lots and 40 planned shifts can be
  entered and saved in one step.

## Requirements *(mandatory)*

### Functional Requirements

#### Authorization

- **FR-001**: The system MUST allow active operations leads, operations admins, and organization
  admins to create a planned discharge and to correct planned discharges as this slice defines.
- **FR-002**: The system MUST refuse creation and every correction to observers, unauthenticated
  users, and users whose access is not active, without creating or changing anything, and MUST NOT
  offer these actions to them.

#### Creation

- **FR-003**: The discharges list MUST offer an action to create a discharge to the users allowed to
  prepare discharges, opening a dedicated creation page with its own address.
- **FR-004**: A discharge MUST be created with a vessel name, an optional vessel IMO, an optional
  vessel comment, one dock, an expected start, at least one product lot, and at least one planned
  shift.
- **FR-005**: A created discharge MUST be in the planned status, and each of its shifts MUST be in the
  planned status.
- **FR-006**: Creation MUST be atomic: either the discharge with all its lots and shifts is created, or
  nothing is.
- **FR-007**: A successful creation MUST open the detail page of the created discharge, and the
  discharge MUST then appear in the discharges list.
- **FR-008**: Repeating the same creation submission MUST NOT create more than one discharge.
- **FR-009**: Creation MUST NOT reserve trucks, assign warehouse doors to lots, or select trucks,
  warehouse doors, or weighing areas for shifts.

#### Discharge identity

- **FR-010**: The vessel name MUST be required and MUST NOT be blank once surrounding spaces are
  removed.
- **FR-011**: A vessel IMO, when provided, MUST be a seven-digit number; the IMO and the vessel comment
  MAY be empty.
- **FR-012**: The dock MUST be selected among the site's available docks. A dock already used by
  another planned or active discharge MUST remain selectable.
- **FR-013**: The expected start MUST be a date and time, and MUST be accepted whether it is in the
  future or the past.

#### Product lots

- **FR-014**: Each product lot MUST have a customer selected among the site's available customers, a
  product name that is not blank, and an expected quantity; its description MAY be empty.
- **FR-015**: An expected quantity MUST be strictly positive, expressed in tonnes with no more than
  three decimal places.
- **FR-016**: Within one discharge, no two product lots MAY share the same customer and the same
  product name, compared without regard to case or surrounding spaces.
- **FR-017**: The discharge's expected tonnage MUST always equal the sum of its lots' expected
  quantities after creation and after every lot change.

#### Planned shifts

- **FR-018**: Each planned shift MUST have a planned start, a planned end strictly after its start,
  and one responsible.
- **FR-019**: The responsible MUST be an active operations lead, operations admin, or organization
  admin, and only such users MUST be offered as responsible.
- **FR-020**: The planned periods of the shifts of one discharge MUST NOT overlap; a shift MAY start
  exactly when the previous one ends.
- **FR-021**: The shifts of a discharge MUST be ordered by planned start regardless of the order in
  which they were entered.
- **FR-022**: Shift periods MUST NOT be constrained by the discharge's expected start, and MAY be in
  the past.

#### Corrections while planned

- **FR-023**: While a discharge is planned, the users allowed to prepare discharges MUST be able to
  correct its vessel name, vessel IMO, vessel comment, dock, and expected start from its detail, under
  the same rules as at creation.
- **FR-024**: While a discharge is planned, those users MUST be able to add a product lot, correct a
  lot's customer, product name, expected quantity, or description, and remove a lot, from the
  discharge detail, under the same rules as at creation.
- **FR-025**: Correcting a lot MUST keep it the same lot, including its warehouse door assignments.
- **FR-026**: Removing a lot MUST require an explicit confirmation, and MUST be refused when it is the
  discharge's only lot or when the lot has or has had a warehouse door assignment.
- **FR-027**: A correction MUST change only the values it concerns; the discharge's status, shifts,
  truck pool, and other lots MUST be unchanged.
- **FR-028**: The system MUST refuse every correction of this slice on an active or a closed discharge,
  including one started after the user opened the correction, and MUST NOT offer these corrections on
  such discharges.

#### Feedback

- **FR-029**: Every refusal caused by entered values MUST identify each offending value, explain the
  expected rule, and keep every value the user entered.
- **FR-030**: A dock, customer, or responsible that is no longer available or eligible when the user
  saves MUST cause a refusal identifying it, with nothing created or changed.
- **FR-031**: A refusal caused by a failure unrelated to the entered values MUST be shown as a failure
  that the user can retry without re-entering their values.
- **FR-032**: While a creation or correction is being saved, the page MUST show that saving is in
  progress and MUST NOT accept a second submission of the same change.

### Key Entities *(include if feature involves data)*

- **Discharge**: The operation of unloading a vessel at the site. This slice creates it in the planned
  status with a vessel description, a dock, an expected start, product lots, and planned shifts, and
  corrects its identity and lots while it stays planned.
- **Vessel Description**: The vessel's required name, optional seven-digit IMO, and optional comment.
- **Dock**: The available berth selected for the discharge.
- **Product Lot**: A traceable quantity of bulk material for one customer within a discharge,
  identified by that customer and a product name unique within the discharge, with an expected
  quantity in tonnes and an optional description.
- **Expected Tonnage**: The indicative quantity planned for the discharge, the sum of its lots'
  expected quantities.
- **Customer**: The available company owning a product lot.
- **Planned Shift**: A work period of the discharge with a planned start and end that do not overlap
  another shift of the same discharge, ordered by planned start, and one responsible.
- **Shift Responsible**: An active operations lead, operations admin, or organization admin
  accountable for a shift.
- **Preparing User**: An active operations lead, operations admin, or organization admin allowed to
  create and correct planned discharges.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user allowed to prepare discharges can create a discharge with three product lots and
  three planned shifts in under 5 minutes on their first attempt.
- **SC-002**: In acceptance testing, 100% of creations by operations leads, operations admins, and
  organization admins with valid input produce a planned discharge whose identity, lots, expected
  tonnage, and shifts match the input exactly, and 100% of creation and correction attempts by
  observers, unauthenticated users, or non-active users change nothing.
- **SC-003**: 100% of the invalid cases listed in User Story 2 and User Story 4 are refused with an
  explanation attached to the offending value, and 0 of them leave a discharge, lot, or shift partly
  created or changed.
- **SC-004**: 0 duplicate discharges result from repeated submissions of the same creation.
- **SC-005**: After every tested correction, the detail and the discharges list show the corrected
  values and expected tonnage, and 100% of values the correction did not concern are unchanged.
- **SC-006**: 100% of correction attempts on active or closed discharges are refused and change
  nothing.
- **SC-007**: A preparation of 20 product lots and 40 planned shifts is saved and its detail shown
  within 3 seconds for at least 95% of attempts under normal operating conditions.

## Assumptions

- The deployment serves a single site, so every created discharge belongs to it; no per-site
  selection applies.
- Operations leads prepare discharges alongside administrators, as the start confirmation that
  follows is theirs; the role hierarchy in `CONTEXT.md` gives operations admins and organization
  admins every operations lead permission.
- The "shifts" of this slice are the first planned shifts entered with the discharge. Adding further
  shifts, replanning or removing shifts, and reassigning a shift's responsible after creation belong
  to GH-63, GH-64, and GH-66, and apply to planned and active discharges alike.
- `CONTEXT.md` defines a discharge preparation as including at least one planned shift, so creation
  requires one, and at least one product lot for the start confirmation to have something to match.
  Seeded or legacy discharges without lots or shifts remain readable as GH-58 delivers.
- An IMO number has seven digits; a vessel without a known IMO leaves it empty rather than recording a
  placeholder.
- A lot keeps its warehouse door assignments when its customer or product name is corrected, because
  no rotation exists before the discharge starts and the start confirmation (GH-56) checks that lots
  and door assignments match. Removing a lot with assignments is refused rather than cascading, so
  that assignments are only ever changed by their own slice (GH-54).
- Corrections of a lot's description or of the vessel description after the discharge has started or
  closed, which `CONTEXT.md` allows with a comment, are not part of this slice.
- Dates and times are entered and displayed with the same convention as the discharges list and
  detail.
- The creation page follows the choice GH-58 made for the detail: a dedicated page with its own
  address, because a preparation with several lots and shifts does not fit a panel over the list.
  The identity and lot corrections are offered from the discharge detail.
- No draft is kept: leaving the creation page before saving discards what was entered.
- The discharge activity log does not exist yet; GH-102, which establishes it, depends on this slice.
  Creation and corrections are therefore not recorded as activity log entries here.
- Removing a whole planned discharge created by mistake is not part of this slice.

## Out of Scope

- Reserving trucks for the discharge and selecting a shift's trucks (GH-55).
- Assigning warehouse doors to product lots and selecting a shift's warehouse doors and weighing areas
  (GH-54).
- Adding further planned shifts after creation (GH-63), replanning, reordering, or removing shifts
  (GH-64), and reassigning a shift's responsible (GH-66).
- Confirming the discharge start and resolving dock, truck, or door conflicts (GH-56, GH-65).
- Runtime changes to an active discharge's dock, trucks, doors, or shift resources (GH-75 to GH-78).
- Correcting the vessel description or a lot description after the discharge has started or closed.
- Removing or cancelling a planned discharge.
- Recording activity log entries (GH-102) and generating reports.
- Creating a discharge from any screen other than the discharges list, such as a customer's detail.
- Creating docks, customers, or users from the creation page.

## Dependencies

- Blocked by GH-58, now delivered: a created discharge lands on the detail page that slice delivers,
  and the identity and lot corrections are offered from it. GH-61 delivered the discharges list that
  offers the creation action.
- Relies on the delivered site-reference foundation: available docks and customers, and active users
  with their roles.
- Relies on the preparation model persisted by GH-236: this slice writes discharges, product lots,
  and planned shifts into it rather than defining new kinds of records.
- GH-54, GH-55, GH-63, and GH-102 depend on this slice: they act on the discharges, product lots, and
  planned shifts it creates.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/53
- Parent roadmap: specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md
- Sibling slices: specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/consult-a-prepared-discharge-in-the-web-workbench/spec.md,
  specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/browse-the-discharges-list-in-the-web-workbench/spec.md
- Absorbed scope: "Create a Planned Discharge From the Frontend", a frontend-only slice merged here on
  2026-09-10 and deleted from GitHub. This slice owns both the preparation commands and the creation
  and correction screens.
- Blockers: recorded as GitHub issue dependencies on the source issue.
- Related domain: discharge-preparation
- Domain vocabulary: `CONTEXT.md` (Discharge, Planned Discharge, Discharge Preparation, Vessel
  Description, Dock, Product Lot, Expected Tonnage, Tonnage Measurement, Customer, Shift, Planned
  Shift, Inter-Shift Break, Shift Responsible, Operations Lead, Operations Admin, Organization Admin,
  Observer, Available Site Reference, Archived Resource).
