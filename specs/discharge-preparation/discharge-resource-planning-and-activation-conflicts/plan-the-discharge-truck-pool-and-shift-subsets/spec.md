# Feature Specification: Plan the Discharge Truck Pool and Shift Subsets

**Feature Branch**: `whazzark/plan-the-discharge-truck-pool-and-shift-subsets`

**Created**: 2026-07-09

**Last refined**: 2026-09-15

**Status**: Draft

**Input**: User description: "https://github.com/whazzark/portflow-ai/issues/55"

**Feature ID**: `GH-55`

**GitHub Issue**: [#55](https://github.com/whazzark/portflow-ai/issues/55)

**Parent Roadmap**: `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md`

**Roadmap Entry**: `GH-55`

**Priority**: priority:P1

**Milestone**: 4. Livrer la préparation interactive d'une Discharge

**Domain**: discharge-preparation

## Clarifications

### Session 2026-09-15

- Q: When does a truck become exclusive to a discharge? → A: Only once the discharge is active.
  Several planned discharges may reserve the same truck, with a warning naming the other discharges
  that hold it, and the conflict is refused atomically when a discharge starts (GH-56).
- Q: What happens when a truck used by planned shifts is removed from the pool? → A: The removal
  also removes the truck from every planned shift that uses it in the same change, after a
  confirmation naming those shifts; it is never refused for that reason.
- Q: What does removing a truck from a planned discharge's pool leave behind? → A: Nothing. Before
  the discharge starts, the removal withdraws the reservation entirely, as if the truck had never
  been reserved; releases kept as history begin once the discharge is active (GH-76).
- Q: Who selects trucks for the planned shifts of an active discharge? → A: Not this slice. Every
  truck selection on an active discharge, including for its planned shifts, belongs to GH-76 and
  GH-78, whose specs must cover planned shifts explicitly.
- Q: How is the discharge detail organised now that it carries planning actions for several
  sections? → A: A header that stays in view (vessel, status, dock, expected start, expected
  tonnage, and a place for actions on the whole discharge), then one section at a time among
  Overview, Product lots, Truck pool, and Shifts, in preparation order and with their counts. The
  open section is kept in the address. On a planned discharge, the overview adds a factual
  preparation summary with the gaps the preparation rules already name, and no verdict on whether
  the discharge can start (GH-56).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reserve Trucks for a Planned Discharge (Priority: P1)

As an operations lead or administrator, I want to reserve the trucks a planned discharge will use,
picking them among the site's available trucks and seeing which other discharges already hold each
one, so that the discharge holds its intended fleet before it starts and competing plans are visible
long before the start confirmation settles them.

**Why this priority**: A discharge cannot start without trucks, and today a discharge created from
the product has none. The truck pool is also what the shift subsets draw from, so nothing else in
this slice works without it.

**Independent Test**: Sign in as an operations lead, open a planned discharge's detail, reserve
three available trucks in one change, and verify that the truck pool lists them with their current
registration, transport company, and reservation time. Then open another planned discharge, verify
that those three trucks are offered with a warning naming the first discharge, reserve one of them,
and verify that both pools mark it as also held by the other discharge.

**Acceptance Scenarios**:

1. **Given** an operations lead, an operations admin, or an organization admin on a planned
   discharge's detail, **When** they choose to add trucks to the truck pool, **Then** they are offered
   the site's available trucks that this discharge does not already hold, each identified by its
   registration and transport company.
2. **Given** that offer, **When** the user selects one or several trucks and saves, **Then** every
   selected truck appears in the discharge's truck pool as held, with the registration and transport
   company it has at that moment and its reservation time.
3. **Given** the site has many trucks, **When** the user looks for a truck to reserve, **Then** they can
   narrow the offer by registration or by transport company.
4. **Given** a truck held by another planned or active discharge, **When** the user adds trucks,
   **Then** that truck is offered with a warning identifying every other discharge that holds it by
   its vessel name and status, and reserving it succeeds.
5. **Given** an archived truck, a suspended truck, or a truck already held by the discharge, **When**
   the user adds trucks, **Then** that truck is not offered, and an attempt to reserve an archived or
   suspended truck is refused.
6. **Given** a selection where one truck has since been archived or suspended, **When** the user
   saves, **Then** the whole change is refused, every truck that can no longer be reserved is
   identified with its reason, the user's selection is kept, and no truck of the selection has been
   reserved.
7. **Given** a truck held by this discharge that another planned or active discharge also holds,
   **When** a user reads the truck pool, **Then** that truck carries a marker identifying every other
   discharge that holds it, whichever discharge reserved it first, and the marker disappears once the
   other discharges no longer hold it.
8. **Given** a truck is reserved, **When** its registration or transport company changes later,
   **Then** the pool keeps showing the values captured when it was reserved.
9. **Given** an observer, **When** they read a planned discharge's detail, **Then** they see the truck
   pool but no action to change it is offered, and a change attempt is refused.
10. **Given** an unauthenticated visitor or a user whose access is not active, **When** they attempt to
    change a truck pool, **Then** the attempt is refused, nothing changes, and no truck, transport
    company, or discharge information is disclosed.

---

### User Story 2 - Select the Trucks Each Planned Shift Uses (Priority: P1)

As an operations lead or administrator, I want to choose, for each planned shift of a planned
discharge, which of the discharge's held trucks that shift will use, so that each shift starts with
an explicit, reviewed fleet rather than silently inheriting one.

**Why this priority**: A shift cannot become active without at least one assigned truck, and shift
resources are never inherited from another shift. Without per-shift selection the start
confirmation (GH-56) has nothing to check.

**Independent Test**: On a planned discharge with four held trucks and two planned shifts, select two
trucks for the first shift and three for the second, and verify that each shift lists exactly its
own trucks by their captured registration. Then verify that a truck not held by the discharge cannot
be selected for a shift.

**Acceptance Scenarios**:

1. **Given** a planned shift of a planned discharge and a user allowed to prepare discharges, **When**
   they choose to select the shift's trucks, **Then** they are offered exactly the trucks the
   discharge holds that are not suspended, with the trucks already selected for that shift marked as
   such; a suspended truck already selected for the shift is shown with a suspended marker and can
   only be deselected.
2. **Given** that offer, **When** the user selects or deselects trucks and saves, **Then** the shift
   lists exactly the selected trucks, each by the registration captured in the discharge's truck pool.
3. **Given** the offer, **When** the user chooses to select every offered truck, **Then** all of them
   become selected, and nothing is saved until the user saves.
4. **Given** a truck selected for one shift, **When** another shift of the same discharge is prepared,
   **Then** the truck may be selected for it too, and selecting it there does not change the first
   shift.
5. **Given** a truck is added to the truck pool, **When** the user reads the planned shifts, **Then** no
   shift has selected it until a user selects it for that shift.
6. **Given** a planned shift has no truck selected, **When** the user reads it, **Then** it states that
   no truck is selected, and the discharge stays planned and editable.
7. **Given** a truck that is not held by the discharge, or is suspended without being already
   selected for the shift, **When** a selection attempt includes it, **Then** the change is
   refused, that truck is identified with its reason, and the shift's trucks are unchanged.
8. **Given** a shift whose selection has not changed, **When** the user saves, **Then** nothing changes
   and the trucks already selected keep their selection.
9. **Given** an observer, **When** they read a planned shift, **Then** they see its trucks but no action
   to change them is offered, and a change attempt is refused.

---

### User Story 3 - Withdraw Trucks From a Planned Discharge's Pool (Priority: P2)

As an operations lead or administrator, I want to remove from a planned discharge's pool a truck it
no longer needs, so that it stops competing with other discharges' plans and stops being planned for
this one's shifts.

**Why this priority**: Fleet plans change before a discharge starts, and a truck reserved by mistake
blocks the truck's archival and makes every other discharge planning it look contested. Reservation
is valuable without withdrawal, but a pool that only grows soon stops matching reality.

**Independent Test**: On a planned discharge holding a truck selected for two planned shifts, withdraw
it, confirm, and verify that the pool no longer lists it at all, that neither shift lists it anymore,
and that another planned discharge holding it no longer marks it as also held by this one.

**Acceptance Scenarios**:

1. **Given** a truck held by a planned discharge and selected for no shift, **When** a user allowed to
   prepare discharges withdraws it and confirms, **Then** the pool no longer lists it, neither as held
   nor as released.
2. **Given** a held truck selected for one or several planned shifts, **When** the user chooses to
   withdraw it, **Then** the confirmation names every shift that currently selects it, and after
   confirmation the truck is withdrawn and no shift lists it anymore.
3. **Given** a truck withdrawn from this discharge, **When** a user reads or plans another
   discharge's pool, **Then** this discharge is no longer named in that truck's warning or marker.
4. **Given** a truck withdrawn from this discharge, **When** the user reserves it again for the same
   discharge, **Then** it is held, listed once in the pool, with the registration, transport company,
   and reservation time current at the new reservation, and no shift selects it until a user does.
5. **Given** a held truck that is currently suspended, **When** the user withdraws it, **Then** the
   withdrawal succeeds like any other.
6. **Given** a truck already withdrawn by another user, **When** the user withdraws it from a stale
   page, **Then** the pool shows that the truck is no longer listed and nothing else changes.
7. **Given** several held trucks, **When** the user withdraws them in one change and confirms, **Then**
   all of them are withdrawn together, or none is when the change is refused.

---

### User Story 4 - Keep the Truck Plan Coherent While Others Change the Discharge (Priority: P2)

As the user planning trucks, I want every change that no longer applies to the discharge's current
state to be refused with an explanation, without losing what I selected and without anything being
partly saved, so that the pool and the shift subsets the start confirmation relies on are always
coherent.

**Why this priority**: Several users prepare discharges at once, trucks are suspended and
reassigned by administrators, and a discharge may be started while its detail is open. The pool
invariants must hold under those conditions, but they refine the flows of Stories 1 to 3.

**Independent Test**: Open the truck pool and a shift's selection in two sessions; in the second
session, withdraw a truck, start the discharge, and suspend a truck; in the first session, save a
change that depends on each, and verify every change is refused with its reason, the selection is
kept, and the detail refreshes to the current state.

**Acceptance Scenarios**:

1. **Given** a discharge that became active or closed after the user opened a truck change, **When**
   they save, **Then** the change is refused, the user is told the discharge is no longer planned,
   and the detail shows its current state.
2. **Given** a truck that was withdrawn by another user after the user opened a shift's selection,
   **When** the user saves a selection including it, **Then** the change is refused, the truck is
   identified as no longer held by the discharge, and the shift's trucks are unchanged.
3. **Given** a planned shift that was removed or started after the user opened its selection,
   **When** the user saves, **Then** the change is refused and the user is told the shift is no
   longer planned or no longer exists.
4. **Given** any refused change, **When** the refusal is shown, **Then** the user's selection is kept
   on the page so the change can be adjusted and saved again.
5. **Given** a change being saved, **When** the user submits again or the same change is resubmitted,
   **Then** the truck is reserved, selected, or withdrawn once, never twice.
6. **Given** a failure unrelated to the entered change, **When** the save fails, **Then** the user is
   told the change could not be saved and can retry it without selecting the trucks again.

---

### User Story 5 - Move Between a Discharge's Planning Sections (Priority: P2)

As any active user, I want the discharge detail to show one section at a time behind a header that
always names the discharge, with each section's count and a summary of what the preparation still
lacks, so that I can find a section without scrolling past the others and a preparer is guided from
the product lots to the truck pool to the shifts.

**Why this priority**: This slice adds planning actions to two sections, and GH-54 and GH-56 add
more. Stacked on one page, the detail no longer fits a reading or an order of work. It refines how
Stories 1 to 3 are reached rather than what they do.

**Independent Test**: Open a planned discharge with two lots, one held truck, and two shifts without
trucks; verify the sections and counts, open the Shifts section, reload and share its address, follow
the summary and the empty-pool hint to the Truck pool, then return to the list and open another
discharge.

**Acceptance Scenarios**:

1. **Given** a discharge detail, **When** it opens from the list or from an address naming no
   section, **Then** the header shows the vessel, the status, the dock, the expected start, and the
   expected tonnage, and the Overview section is open, with the Product lots, Truck pool, and Shifts
   sections offered in that order.
2. **Given** the sections are offered, **When** the user reads them, **Then** Product lots shows the
   number of lots, Shifts the number of shifts, and Truck pool the number of trucks the discharge
   still holds; a closed discharge's Truck pool shows no count.
3. **Given** a user opens a section, **When** the page is reloaded or its address is opened by
   another active user, **Then** the same discharge opens on the same section.
4. **Given** an address naming a section that does not exist, **When** it is opened, **Then** the
   discharge opens on its Overview, and no failure or not-found state is shown.
5. **Given** a section is open, **When** the user returns to the list, **Then** the list shows the
   status and search it was left with, and the next discharge opened from it opens on its Overview.
6. **Given** a change of this slice is accepted, **When** the user reads the counts, **Then** they
   show the result without a reload.
7. **Given** a planned discharge, **When** any active user reads its Overview, **Then** a preparation
   summary states the number of product lots and how many have no warehouse door currently
   assigned, the number of trucks reserved or that none is, and the number of shifts and how many
   planned shifts have no truck selected, each linked to its section, and states nothing about
   whether the discharge can start.
8. **Given** an active or closed discharge, **When** a user reads its Overview, **Then** no
   preparation summary is shown.
9. **Given** a user allowed to prepare discharges, a planned discharge holding no truck, and a
   planned shift, **When** they read the Shifts section or open a shift's truck selection, **Then**
   they are pointed to the Truck pool section.

### Edge Cases

- A planned discharge may hold no truck and its planned shifts may select none; the discharge stays
  planned and editable, and requiring a truck is decided when the first shift starts (GH-56, GH-65).
- A truck held by this discharge that is suspended afterwards stays in the pool and in the shifts
  that already select it, with a suspended marker. It cannot be newly selected for a shift until it is
  returned to service, and it can still be withdrawn.
- A truck returned to service while held by this discharge is offered again for shift selection
  without being reserved again, through the reservation it kept.
- A truck cannot be archived while a planned discharge holds it, and its transport company cannot
  change while it is held, so a held truck is never archived and never changes company.
- A truck held by an active discharge may still be reserved by a planned discharge, with the same
  warning; that planned discharge can only start once the truck is released from the active one, which
  GH-56 enforces.
- Once a discharge holding a truck starts, the other planned discharges keep their reservation of that
  truck and their shift selections, now marked as held by an active discharge.
- A truck whose only earlier discharges are closed, or whose earlier reservations were released, is
  offered like any other available truck.
- Two planned shifts that select the same truck both keep it; a truck may be selected for every shift
  of the discharge.
- A shift's selection and the pool stay consistent: after any accepted change, every truck selected
  for a planned shift is held by the discharge.
- A truck registration or transport company renamed after reservation shows the captured value in
  the pool, in every shift, and in any withdrawal confirmation.
- A planned discharge created by earlier seeding may already show released pool entries. They stay
  as they are; withdrawing a truck never creates one, and reserving a truck that has a released entry
  in the same discharge makes it held again, listed once.
- A pool with the expected volume of up to 50 held trucks across 40 planned shifts, on a site with up
  to 300 trucks, can be planned and read without losing the user's place.
- Leaving a truck change before saving changes nothing.
- Opening another section while a truck change is open leaves it unsaved, as leaving the page does.
- A closed discharge holds no truck, so its Truck pool section shows its history without a count.
- Until GH-54 lets users assign warehouse doors, the preparation summary reports every planned lot as
  having no warehouse door currently assigned; the statement is true and stays factual.

## Requirements *(mandatory)*

### Functional Requirements

#### Authorization

- **FR-001**: The system MUST allow active operations leads, operations admins, and organization admins
  to reserve, withdraw, and select trucks for planned discharges as this slice defines.
- **FR-002**: The system MUST refuse every change of this slice to observers, unauthenticated users,
  and users whose access is not active, without changing anything, and MUST NOT offer these actions
  to them. Unauthenticated users and users whose access is not active MUST NOT receive any truck,
  transport company, or discharge information.

#### Truck pool reservation

- **FR-003**: The detail of a planned discharge MUST offer, to the users allowed to prepare
  discharges, an action to add trucks to its truck pool.
- **FR-004**: The trucks offered for reservation MUST be exactly the site's available trucks that the
  discharge does not already hold, excluding archived and suspended trucks, and each MUST be
  identified by its registration and transport company.
- **FR-005**: The user MUST be able to narrow the trucks offered for reservation by registration and
  by transport company.
- **FR-006**: The user MUST be able to reserve one or several trucks in one change. The change MUST be
  atomic: either every selected truck is reserved, or none is.
- **FR-007**: A reservation MUST capture the truck's registration and transport company current at
  the moment of reservation, and its reservation time. Later changes to the truck or its company
  MUST NOT alter the captured values.
- **FR-008**: A truck held by other planned or active discharges MUST remain reservable by a planned
  discharge. This slice MUST NOT refuse a reservation because another discharge holds the truck;
  exclusivity between active discharges is enforced when a discharge starts (GH-56).
- **FR-009**: Every truck offered for reservation, and every held truck in a pool, that another planned
  or active discharge also holds MUST carry a warning identifying each of those discharges by its
  vessel name and status, reflecting the current reservations.
- **FR-010**: A reservation attempt for an archived, suspended, or unknown truck MUST be refused and
  MUST identify the truck and its reason.
- **FR-011**: Reserving a truck already held by the same discharge MUST NOT create a second
  reservation.
- **FR-012**: Reserving a truck previously withdrawn from the same discharge, or whose earlier entry
  in the same discharge's pool is released, MUST make it held with values captured at the new
  reservation, listed once in the pool.

#### Truck pool withdrawal

- **FR-013**: The users allowed to prepare discharges MUST be able to withdraw one or several trucks
  held by a planned discharge in one change, after an explicit confirmation. The change MUST be
  atomic.
- **FR-014**: When a truck to withdraw is selected for planned shifts, the confirmation MUST name each
  of those shifts, and the withdrawal MUST also remove the truck from each of them in the same change.
- **FR-015**: A withdrawn truck MUST no longer be listed in the pool, neither as held nor as released,
  and MUST no longer count as held by the discharge. Withdrawal MUST NOT leave a released entry.
- **FR-016**: A withdrawn truck MUST no longer count toward the warnings of other discharges, and MUST
  no longer block the truck's archival on account of this discharge.
- **FR-017**: Withdrawing a truck MUST be allowed whether the truck is available or suspended.

#### Shift truck subsets

- **FR-018**: Each planned shift of a planned discharge MUST offer, to the users allowed to prepare
  discharges, an action to select the trucks that shift uses.
- **FR-019**: The trucks offered for a shift MUST be exactly the trucks held by the discharge that are
  not suspended; trucks already selected for that shift MUST be marked as selected, including
  suspended ones, which MUST remain deselectable.
- **FR-020**: The user MUST be able to select and deselect several trucks and save the shift's
  selection in one atomic change, and MUST be able to select every offered truck at once.
- **FR-021**: A saved selection MUST change only the trucks added or removed; trucks that stay
  selected MUST keep their selection.
- **FR-022**: A truck MUST be selectable for several shifts of the same discharge, and changing one
  shift's selection MUST NOT change any other shift.
- **FR-023**: Reserving a truck MUST NOT select it for any shift, and no shift MUST ever receive trucks
  from another shift without an explicit selection for that shift.
- **FR-024**: A selection including a truck that is not held by the discharge, or is suspended
  without being already selected for that shift MUST be refused, identifying each such
  truck and its reason.
- **FR-025**: After every accepted change of this slice, every truck selected for a planned shift of
  the discharge MUST be held by that discharge.
- **FR-026**: Every truck shown for a shift MUST be identified by the registration captured in the
  discharge's truck pool.

#### Discharge and shift state

- **FR-027**: The system MUST refuse every change of this slice on an active or closed discharge, and on
  a shift that is not planned or no longer exists, including when that state was reached after the
  user opened the change, and MUST NOT offer these changes there.
- **FR-028**: A planned discharge MUST remain valid and editable with an empty truck pool and with
  planned shifts that select no truck.
- **FR-029**: A change of this slice MUST NOT alter the discharge's status, vessel description, dock,
  expected start, product lots, warehouse door assignments, shift periods, shift responsibles, or the
  warehouse doors and weighing areas selected for shifts.

#### Feedback

- **FR-030**: Every refused change MUST identify each truck, shift, or discharge state that caused it,
  explain the rule, and keep the user's selection on the page.
- **FR-031**: After a refusal caused by the discharge's current state, the detail MUST show that
  current state.
- **FR-032**: A refusal caused by a failure unrelated to the change MUST be shown as a failure the user
  can retry without selecting the trucks again.
- **FR-033**: While a change is being saved, the page MUST show that saving is in progress and MUST NOT
  accept a second submission of the same change; a repeated submission MUST NOT apply the change
  twice.
- **FR-034**: After every accepted change, the truck pool and every affected shift MUST show the
  result without the user reloading the page.

#### Detail organisation

- **FR-035**: The discharge detail MUST show, above every section, the vessel name, the status, the
  dock, the expected start, and the expected tonnage, and MUST reserve a place in that header for
  actions on the whole discharge.
- **FR-036**: The detail MUST offer the sections Overview, Product lots, Truck pool, and Shifts, in
  that order, and MUST show one section at a time.
- **FR-037**: The open section MUST be kept in the page address. An address naming no section or an
  unknown one MUST open the Overview.
- **FR-038**: Every way back from the detail to the list MUST keep the list's status and search and
  MUST NOT carry the open section.
- **FR-039**: The Product lots, Truck pool, and Shifts sections MUST show their number of lots, held
  trucks, and shifts, updated after every accepted change; a closed discharge's Truck pool MUST show
  no count.
- **FR-040**: The Overview of a planned discharge MUST show a preparation summary linking to each
  section, with the number of product lots and of lots without a warehouse door currently assigned,
  the number of held trucks or that none is held, and the number of shifts and of planned shifts
  without a truck selected. It MUST NOT state whether the discharge can start.
- **FR-041**: The preparation summary MUST NOT be shown on an active or closed discharge.
- **FR-042**: For a user allowed to prepare discharges, the Shifts section and the truck selection of
  a shift MUST point to the Truck pool section while the discharge holds no truck and has a planned
  shift.

### Key Entities *(include if feature involves data)*

- **Discharge Truck Pool**: The set of trucks reserved for a discharge, each entry held or released.
  This slice lets users add held entries and withdraw them entirely while the discharge is planned;
  released entries come only from releases on an active discharge or from earlier seeding.
- **Discharge Truck Assignment**: The reservation of one truck for one discharge, capturing the truck's
  registration and transport company and the reservation time, and the release time once released.
  Before the discharge starts, a withdrawn assignment ceases to exist.
  Several planned discharges may hold the same truck; at most one active discharge may, which the
  start confirmation enforces.
- **Truck**: The site reference reserved. Only an available truck can be newly reserved or newly
  selected for a shift; a suspended truck keeps its existing reservation and selections.
- **Transport Company**: The company providing a truck, captured by name at reservation.
- **Planned Shift**: A shift of the discharge that has not started. This slice sets which held trucks
  it uses.
- **Shift Truck Selection**: The explicit membership of one held truck in one planned shift's subset.
  A shift's subset is always included in the discharge's held trucks.
- **Preparing User**: An active operations lead, operations admin, or organization admin allowed to
  plan a discharge's trucks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user allowed to prepare discharges can reserve 15 trucks for a planned discharge and
  select a subset of them for three planned shifts in under 5 minutes on their first attempt.
- **SC-002**: In acceptance testing, 100% of trucks held by more than one planned or active discharge
  are marked in each of their pools and in the reservation offer with every other holding discharge,
  and 0 reservations are refused because another discharge holds the truck.
- **SC-003**: After 100% of accepted changes, every truck selected for a planned shift is held by its
  discharge, and every held truck shows the registration and transport company captured at its
  reservation.
- **SC-004**: 100% of the refused cases listed in User Stories 1, 2, and 4 identify the truck, shift,
  or discharge state that caused them, keep the user's selection, and leave the pool and every shift
  exactly as they were.
- **SC-005**: 100% of change attempts by observers, unauthenticated users, or non-active users, and of
  changes on active or closed discharges, are refused and change nothing.
- **SC-006**: Immediately after a withdrawal, the truck is absent from the discharge's pool and
  shifts, and the discharge is no longer named in any other discharge's warning for that truck, in
  100% of tested cases.
- **SC-007**: For a site of 300 trucks and a discharge holding 50 trucks across 40 planned shifts, the
  trucks to reserve or select are shown, and a change is saved and reflected on the detail, within
  2 seconds for at least 95% of attempts under normal operating conditions.
- **SC-008**: Every section of a discharge detail is reachable from any other in one action, and an
  address naming a section reopens that section in 100% of tested cases.

## Assumptions

- The deployment serves a single site, so every truck offered belongs to the discharge's site.
- The actors are the ones GH-53 settled for preparing a discharge: operations leads, operations
  admins, and organization admins. Observers keep read-only access to the pool and shift trucks
  delivered by GH-58.
- This slice covers planned discharges only. `CONTEXT.md` treats a shift resource change as
  preparation before activation and as a runtime-resource change afterward, so assigning and
  releasing trucks on an active discharge belongs to GH-76, and changing the trucks of an active
  discharge's shifts, planned or active, belongs to GH-76 and GH-78. Because GH-78 is framed around
  the active shift, its spec, or GH-76's, must explicitly cover selecting trucks for the planned
  shifts of an active discharge; otherwise those shifts could not receive trucks.
- Exclusivity is guaranteed only between active discharges, and is enforced atomically by the start
  confirmation (GH-56), as the milestone's "validation et réservation atomique" describes. Planned
  discharges may compete for a truck, and the warnings make that competition visible. This departs
  from the `CONTEXT.md` definition of a truck ("at most one planned or active discharge"), which must
  be amended to match.
- A truck held by any planned or active discharge still counts as in use for its archival and keeps its
  transport company, as the delivered site-reference rules define; this slice does not change them.
- Removing a truck from a planned discharge's pool is a withdrawal, not a release: before the
  discharge starts nothing has happened operationally, so the reservation is removed entirely, as
  GH-53 removes a product lot. It ends this discharge's claim on the truck, for other discharges'
  warnings and for its archival. The release kept as history, which GH-58 already displays, is the
  runtime operation of an active discharge (GH-76). The activity log (GH-102) will be the place that
  traces withdrawals.
- Deselecting a truck from a planned shift withdraws the selection rather than recording an ended
  period, because a shift that has not started has no effective period for its resources yet. Ended
  periods begin with runtime adjustments to active shifts (GH-78).
- Withdrawing a truck selected for planned shifts removes it from those shifts in the same change,
  after a confirmation naming them, rather than being refused. The pool and the subsets are planned
  together in this slice, and refusing would force the user to deselect the truck shift by shift.
- A suspended truck is excluded from every collection offering trucks for new operational work, as
  `CONTEXT.md` defines, which covers both reserving it and newly selecting it for a shift. It keeps
  the reservation and selections it already has, as a return to service restores it through them.
- Transport-company availability needs no separate check here: the site-reference rules already
  refuse archiving a company that provides available trucks and returning a truck to service under an
  archived company, and this slice relies on them.
- A reservation captures the truck's registration and transport company again when a withdrawn truck
  is reserved again for the same discharge; nothing of the withdrawn reservation is kept.
- The truck pool change and each shift's selection are offered from the discharge detail delivered by
  GH-58, where GH-53 already placed the discharge's other planning corrections.
- The expected volumes, up to 50 held trucks, 40 planned shifts, and 300 trucks on the site, extend
  the volumes GH-53 used for lots and shifts.
- The discharge activity log does not exist yet; GH-102, which establishes it, is not delivered.
  Reservations, withdrawals, and shift selections are therefore not recorded as activity log entries
  here.
- Dates and times are displayed with the same convention as the discharges list and detail.

## Out of Scope

- Assigning warehouse doors to product lots and selecting a shift's warehouse doors and weighing areas
  (GH-54).
- Confirming the discharge start, including checking that the first shift has at least one truck,
  refusing a truck held by another active discharge, and its conflict handling (GH-56, GH-65).
- Choosing between competing planned discharges, or withdrawing a truck from another discharge, from
  this discharge's detail.
- Assigning and releasing trucks on an active discharge (GH-76), adjusting an active shift's
  resources (GH-78), and selecting trucks for the planned shifts of an active discharge (GH-76 or
  GH-78).
- Adding, replanning, reordering, or removing shifts, and reassigning a shift's responsible (GH-63,
  GH-64, GH-66).
- Copying a shift's trucks to another shift, or selecting trucks for several shifts in one change.
- Suspending, returning to service, archiving, or editing trucks, and creating trucks or transport
  companies from the discharge detail.
- Checking truck capacity against a lot's expected quantity, or proposing a number of trucks.
- Stating whether a discharge is ready to start, and the start action itself, which takes the header's
  action place (GH-56).
- Recording activity log entries (GH-102) and generating reports.

## Dependencies

- Blocked by GH-53, now delivered: this slice plans the trucks of the planned discharges and planned
  shifts that slice creates, from the discharge detail it extends.
- Relies on GH-58, delivered: the discharge detail already reads the truck pool, with captured values,
  released entries, and archived and suspended markers, and each shift's trucks.
- Relies on the delivered site-reference foundation: available, suspended, and archived trucks, their
  transport companies, and the persisted usage rules that keep a held truck from being archived.
- Relies on the preparation model persisted by GH-236: this slice writes discharge truck assignments
  and shift truck memberships into it rather than defining new kinds of records.
- Deliverable in parallel with GH-54: neither blocks the other, but both add planning actions to the
  same discharge detail.
- GH-56 depends on this slice: activating the first shift requires it to hold at least one truck,
  and the start confirmation is where a truck reserved by several discharges becomes exclusive.
- GH-76 and GH-78 inherit the truck selection of an active discharge's planned shifts, which this
  slice deliberately does not offer.
  GH-76 and GH-78 later change the pool and shift trucks this slice plans, once the discharge is
  active.
- GH-54 and GH-56 build on the header and sections this slice introduces: warehouse doors join the
  Product lots and Shifts sections, and the start action joins the header.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/55
- Parent roadmap: specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md
- Sibling slices: specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/prepare-a-discharge-with-product-lots-and-shifts/spec.md,
  specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/plan-warehouse-door-and-checkpoint-assignments/spec.md,
  specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/consult-a-prepared-discharge-in-the-web-workbench/spec.md
- Absorbed scope: the truck pool half of "Update Discharge Resource Planning From the Frontend", a
  frontend-only slice split between GH-54 and GH-55 on 2026-09-10 and deleted from GitHub. This slice
  owns both the truck planning commands and their actions on the discharge detail.
- Blockers: recorded as GitHub issue dependencies on the source issue.
- Related domain: discharge-preparation
- Domain vocabulary: `CONTEXT.md` (Discharge, Planned Discharge, Discharge Preparation, Shift, Planned
  Shift, Shift Preparation, Truck, Suspended Truck, Returned to Service, Discharge Truck Assignment,
  Truck Registration, Transport Company, Available Site Reference, Archived Resource, Operations
  Lead, Operations Admin, Organization Admin, Observer).
