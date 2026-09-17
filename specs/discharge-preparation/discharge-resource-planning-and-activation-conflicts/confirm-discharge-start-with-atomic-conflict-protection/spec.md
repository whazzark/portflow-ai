# Feature Specification: Confirm Discharge Start With Conflict Protection and Handling

**Feature Branch**: `whazzark/confirm-discharge-start-with-conflict-protection`

**Created**: 2026-07-09

**Last refined**: 2026-09-17

**Status**: Draft

**Input**: User description: "https://github.com/whazzark/portflow-ai/issues/56"

**Feature ID**: `GH-56`

**GitHub Issue**: [#56](https://github.com/whazzark/portflow-ai/issues/56)

**Parent Roadmap**: `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md`

**Roadmap Entry**: `GH-56`

**Priority**: priority:P1

**Milestone**: 4. Livrer la préparation interactive d'une Discharge

**Domain**: discharge-preparation

## Clarifications

### Session 2026-09-17

- Q: Must every product lot have at least one current warehouse door assignment for the discharge to
  start, or only enough doors for the first shift? → A: Every product lot needs at least one current
  warehouse door assignment; a lot without one refuses the start and is identified.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review the Preparation and Start the Discharge (Priority: P1)

As an operations lead or administrator, I want to review what a planned discharge is about to start
with, then confirm its start in one deliberate action that activates the discharge and its first
shift together, so that field work begins with the customers, product lots, door assignments, and
resources that were prepared, and never with an active discharge that has no started shift.

**Why this priority**: This is the boundary between tentative planning and operation. Until a
discharge can start from the product, no shift, rotation, dashboard, or report of a discharge
prepared from the product can exist.

**Independent Test**: Sign in as an operations lead, open a planned discharge whose dock is free,
whose lots all have warehouse doors, and whose earliest planned shift has a responsible, a truck, a
door, and a weighing area; open the start confirmation, verify it shows the preparation, confirm, and
verify the detail shows the discharge as active and that shift as active with its actual start time.

**Acceptance Scenarios**:

1. **Given** an operations lead, an operations admin, or an organization admin on the detail of a
   planned discharge, **When** they read the detail header, **Then** an action to start the discharge
   is offered.
2. **Given** that action, **When** the user opens it, **Then** a review shows the vessel and dock, each
   customer with its product lots, each lot's current warehouse doors with their warehouses, the
   number of trucks the discharge holds, and the shift that will start, identified by its planned
   start, with its planned period, responsible, trucks, warehouse doors, and weighing areas.
3. **Given** the review shows no blocking problem, **When** the user confirms, **Then** the discharge
   becomes active, its earliest planned shift becomes active with the confirmation time as its actual
   start and its planned period unchanged, and the detail shows both without the user reloading the
   page.
4. **Given** a discharge started this way, **When** any active user reads its detail, **Then** it shows
   who confirmed the start and when, and its other planned shifts remain planned.
5. **Given** a discharge started this way, **When** a user reads the dock, trucks, and warehouse doors
   it holds, **Then** every existing indication naming the discharges that hold a truck or a
   warehouse door (GH-54, GH-55) names it as active, in other discharges' details and planning
   choices.
6. **Given** the user opens the review, **When** they leave it without confirming, **Then** nothing
   changes.
7. **Given** an observer on a planned discharge's detail, **When** they read the header, **Then** no
   start action is offered, and a start attempt is refused without changing anything.
8. **Given** an unauthenticated visitor or a user whose access is not active, **When** they attempt to
   start a discharge, **Then** the attempt is refused, nothing changes, and no discharge information is
   disclosed.

---

### User Story 2 - Be Refused When Another Active Discharge Holds a Resource (Priority: P1)

As the user starting a discharge, I want the start refused whenever the dock, one of the trucks, or
one of the warehouse doors it holds is already held by another active discharge, with each conflict
named, so that one berth, one truck, or one door never serves two active discharges and I know
exactly which plan to revise.

**Why this priority**: Planned discharges may compete for the same resources by design (GH-53,
GH-54, GH-55); the start confirmation is the only place that competition is settled. Without it, two
active discharges could claim the same physical resource.

**Independent Test**: With an active discharge using dock A, truck T, and door D, prepare a planned
discharge that also uses dock A, holds truck T, and assigns door D to a lot; attempt to start it and
verify the start is refused, the review names dock A, truck T, and door D, each with the active
discharge holding it, and nothing changed on either discharge.

**Acceptance Scenarios**:

1. **Given** a planned discharge whose dock serves another active discharge, **When** the user
   confirms its start, **Then** the start is refused and the dock is identified with the vessel of the
   discharge it serves.
2. **Given** a planned discharge holding a truck held by another active discharge, **When** the user
   confirms its start, **Then** the start is refused and the truck is identified by its registration
   with the vessel of the discharge holding it, even if the first shift does not select that truck.
3. **Given** a planned discharge with a current door assignment for a door currently assigned in
   another active discharge, **When** the user confirms its start, **Then** the start is refused and
   the door is identified with its warehouse, the lot it is assigned to here, and the vessel of the
   other discharge.
4. **Given** a planned discharge sharing its dock, a truck, or a door only with other planned or
   closed discharges, **When** the user confirms its start, **Then** that sharing does not refuse the
   start, and the other discharges keep their plans unchanged.
5. **Given** a planned discharge sharing a weighing area or a warehouse, through distinct doors, with
   an active discharge, **When** the user confirms its start, **Then** that sharing does not refuse the
   start.
6. **Given** a start refused for several reasons at once, **When** the user reads the review, **Then**
   every conflict and every other blocking problem is listed together, each linked to the section of
   the detail where it can be fixed.
7. **Given** two planned discharges sharing the dock, a truck, or a door, **When** users confirm both
   starts at the same time, **Then** exactly one discharge becomes active, and the other start is
   refused with the conflict identified.

---

### User Story 3 - Be Refused When the Preparation Is Incomplete or Stale (Priority: P2)

As the user starting a discharge, I want the start refused, with every problem explained, whenever the
preparation could not support field work, so that the first rotation always has a usable truck, door,
weighing area, and product lot, and nothing is left half started.

**Why this priority**: The planning slices deliberately accept incomplete plans while a discharge is
planned; these refusals are what make that tolerance safe. The happy path of User Story 1 already
delivers value on a complete preparation.

**Independent Test**: Attempt, in turn, to start a discharge whose earliest planned shift has no
truck, no door, no weighing area, or a responsible whose access was deactivated; one with a lot
without a warehouse door; one with no planned shift; one whose dock was archived; and one already
started by another user; verify each is refused with the offending item identified and that the
discharge and its shifts are unchanged.

**Acceptance Scenarios**:

1. **Given** a planned discharge with no product lot or no planned shift, **When** the user confirms
   its start, **Then** the start is refused and the missing element is named.
2. **Given** a planned discharge whose earliest planned shift has no usable truck, no usable warehouse
   door, or no usable weighing area, **When** the user confirms, **Then** the start is refused and the
   shift and each missing kind of resource are named.
3. **Given** a product lot with no current warehouse door assignment, **When** the user confirms,
   **Then** the start is refused and every lot without a current warehouse door is identified by its
   customer and product name.
4. **Given** the responsible of the earliest planned shift is no longer an active operations lead,
   operations admin, or organization admin, **When** the user confirms, **Then** the start is refused
   and the shift and its responsible are identified.
5. **Given** the dock, a lot's customer, a warehouse door or its warehouse, a weighing area, or a truck
   selected for the first shift is archived, **When** the user confirms,
   **Then** the start is refused and each such reference is identified as no longer available.
6. **Given** the discharge was started, or its preparation changed, after the user opened the review,
   **When** they confirm, **Then** the confirmation acts only on the current state: a discharge already
   active or closed is not started again and the user is told so, and a changed preparation is checked
   as it now stands and the review shows it.
7. **Given** any refusal, **When** it occurs, **Then** the discharge stays planned, no shift becomes
   active, and no reservation, assignment, or selection of this or any other discharge changes.

### Edge Cases

- The shift that starts is the discharge's earliest planned shift by planned start. The user does not
  choose it; skipping a shift means removing or replanning it first (GH-64).
- A start is accepted before the discharge's expected start or the shift's planned start, and after
  them: planned times never trigger or forbid a lifecycle transition.
- Every product lot needs a current warehouse door, including lots whose doors no shift selects yet;
  a lot that will only be unloaded later is not exempt.
- Only the first shift's resources are required. Later planned shifts may still lack trucks, doors, or
  weighing areas and remain planned; their readiness is checked when each of them starts (GH-69).
- A truck of the pool that is suspended does not by itself refuse the start, as long as the first
  shift keeps another usable truck; it stays in the pool and its shifts with its suspended marker. It
  still refuses the start if another active discharge holds it.
- A truck is exclusive through the whole pool, not only through the first shift's trucks: every truck
  the discharge holds becomes held by an active discharge.
- A door is exclusive through its current assignments in the discharge, not only through the first
  shift's doors. A door assigned in another planned discharge is not a conflict; once this discharge
  starts, that other discharge keeps its assignment with the indication naming this one, and can only
  start once the door is no longer assigned here.
- A dock, truck, or door held by another discharge that was closed is free.
- The review and the refusal show the same list of problems in the same terms: a problem found when
  the review opens is shown before the user confirms, and the confirmation checks everything again.
  A refusal lists its problems in place, and the confirmation stays unavailable until the review is
  opened again and finds none.
- Confirming twice, through a repeated click or a resubmitted request, starts the discharge at most
  once and records one actual start.
- A planned discharge created by earlier seeding with released truck pool entries starts with only
  the trucks it still holds; released entries are neither checked nor reactivated.
- A preparation with the expected volume of up to 20 product lots, 50 held trucks, and 40 planned
  shifts can be reviewed and started without the review becoming unusable.

## Requirements *(mandatory)*

### Functional Requirements

#### Authorization

- **FR-001**: The system MUST allow active operations leads, operations admins, and organization
  admins to confirm the start of a planned discharge.
- **FR-002**: The system MUST refuse a start confirmation from observers, unauthenticated users, and
  users whose access is not active, without changing anything, and MUST NOT offer the start action to
  them. Unauthenticated users and users whose access is not active MUST NOT receive any discharge
  information.

#### Review

- **FR-003**: The detail of a planned discharge MUST offer the start action in its header, and only
  while the discharge is planned.
- **FR-004**: Opening the start action MUST show, before anything changes, the vessel, the dock, each
  customer with its product lots, each lot's current warehouse doors with their warehouses, the number
  of trucks held, and the shift that will start with its planned period, responsible, trucks,
  warehouse doors, and weighing areas.
- **FR-005**: The review MUST list every blocking problem known when it opens, in the terms of
  FR-016, grouped by the kind of element each concerns (dock, product lots and their doors, truck
  pool, shifts), naming for a conflict the active discharge holding the resource. While problems are
  listed the confirmation MUST be unavailable; the review checks again each time it opens, and the
  confirmation still checks everything again (FR-022).
- **FR-006**: Leaving the review without confirming MUST change nothing.

#### Activation

- **FR-007**: A successful confirmation MUST, as one indivisible change, make the discharge active,
  make its earliest planned shift active with the confirmation time as its actual start, preserve that
  shift's planned period, and record who confirmed the start and when.
- **FR-008**: A successful confirmation MUST make the discharge's dock, every truck it holds, and every
  warehouse door currently assigned to one of its lots held by an active discharge, from the
  confirmation time.
- **FR-009**: A successful confirmation MUST NOT change the discharge's other planned shifts, its
  product lots, its door assignments, its truck pool, or any other discharge's plan.
- **FR-010**: A confirmation on a discharge that is already active or closed MUST NOT start it again
  and MUST tell the user the discharge is no longer planned; the detail MUST then show its current
  state.

#### Preparation checks

- **FR-011**: The start MUST be refused when the discharge has no product lot or no planned shift.
- **FR-012**: The start MUST be refused when the earliest planned shift lacks at least one usable
  truck, one usable warehouse door, or one usable weighing area. A usable truck is held by the
  discharge and neither archived nor suspended; a usable door is currently assigned to a lot of the
  discharge and neither it nor its warehouse is archived; a usable weighing area is not archived.
- **FR-013**: The start MUST be refused when the responsible of the earliest planned shift is not an
  active operations lead, operations admin, or organization admin.
- **FR-014**: The start MUST be refused when the dock, a product lot's customer, or a warehouse door or
  warehouse currently assigned to one of the discharge's lots is archived.
- **FR-015**: The start MUST be refused when any product lot of the discharge has no current warehouse
  door assignment, identifying each such lot.

#### Conflict checks

- **FR-016**: Every refusal MUST belong to exactly one of these families, shared by the review, the
  refusal, and every screen showing them: incomplete preparation, unavailable reference, ineligible
  responsible, conflict with another active discharge, and discharge no longer planned.
- **FR-017**: The start MUST be refused when the discharge's dock serves another active discharge.
- **FR-018**: The start MUST be refused when any truck the discharge holds is held by another active
  discharge.
- **FR-019**: The start MUST be refused when any warehouse door currently assigned to one of the
  discharge's lots is currently assigned in another active discharge.
- **FR-020**: Sharing a weighing area or a warehouse with an active discharge, and sharing any resource
  with planned or closed discharges only, MUST NOT refuse the start.
- **FR-021**: The checks MUST be made against the state current at the moment of confirmation, and the
  checks and the activation MUST form one indivisible change: concurrent confirmations, and a planning
  change or another start running at the same time, MUST NOT let two active discharges hold the same
  dock, truck, or warehouse door, nor let a discharge start on a preparation that no longer passes the
  checks.

#### Feedback

- **FR-022**: Every refusal MUST list all blocking problems found, not only the first, each identifying
  the offending lot, shift, responsible, dock, truck, door, or reference, and, for a conflict, the
  vessel name of the active discharge holding the resource, which leads to that discharge.
- **FR-023**: Each listed problem MUST link to the section of the discharge detail where it can be
  fixed, or to the conflicting discharge for a conflict.
- **FR-024**: A failure unrelated to the preparation MUST be shown as a failure the user can retry
  from the review, distinct from a refusal.
- **FR-025**: While a confirmation is in progress, the review MUST show it and MUST NOT accept a
  second confirmation.
- **FR-026**: After a successful confirmation, the discharge detail MUST show the active discharge,
  its active shift with its actual start, and no preparation action or preparation summary, without
  the user reloading the page.

### Key Entities *(include if feature involves data)*

- **Planned Discharge**: A discharge created but not started, the subject of the confirmation.
- **Active Discharge**: The discharge after a successful confirmation, and every other started and
  not closed discharge against which conflicts are checked.
- **Discharge Start Confirmation**: The confirmation by a preparing user, at a recorded time, that the
  preparation matches the discharge, which activates the discharge and its first shift together.
- **First Shift**: The discharge's earliest planned shift by planned start, which becomes active with
  its actual start at the confirmation.
- **Dock**: The berth serving the discharge, exclusive among active discharges.
- **Discharge Truck Assignment**: A truck held by the discharge, exclusive among active discharges
  through the whole pool.
- **Warehouse Door Assignment**: A door currently assigned to a lot of the discharge, exclusive among
  active discharges.
- **Weighing Area** and **Warehouse**: Shared among active discharges and never a conflict.
- **Start Problem**: One reason a start cannot proceed, belonging to one family of FR-016 and
  identifying the item concerned and, for a conflict, the other active discharge.
- **Preparing User**: An active operations lead, operations admin, or organization admin allowed to
  prepare and start a discharge.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user allowed to prepare discharges can review and start a ready discharge in under 1
  minute on their first attempt.
- **SC-002**: After any sequence of tested and concurrent confirmations, 0 docks, trucks, or warehouse
  doors are held by more than one active discharge.
- **SC-003**: 0 discharges are observed active without an active or completed shift, and 0 shifts are
  observed active on a discharge that is not active.
- **SC-004**: 100% of the refused cases in User Stories 2 and 3 identify every offending item, and 0 of
  them change the discharge, its shifts, or any reservation.
- **SC-005**: 100% of start attempts by observers, unauthenticated users, or users whose access is not
  active change nothing.
- **SC-006**: In a usability check, at least 90% of users shown a refused start can name, without
  help, which resource or gap to fix and which other discharge holds a conflicting resource.
- **SC-007**: For a preparation of 20 product lots, 50 held trucks, and 40 planned shifts, the review
  opens and a confirmation result is shown within 3 seconds for at least 95% of attempts under normal
  operating conditions.

## Assumptions

- `CONTEXT.md` defines the Discharge Start Confirmation as confirmed "when starting the first shift"
  and as atomically activating both the discharge and its first shift, and forbids an active discharge
  without a started shift. This slice therefore delivers that whole activation, from the discharge
  detail. GH-65 builds on it: the shift workspace born with the started shift, and starting the first
  shift from there through the same confirmation; its specification should confirm this when refined.
- The shift that starts is the earliest planned shift, since shifts start in chronological order and a
  skipped shift is removed or replanned first.
- The actual start is the confirmation time. A retrospective actual start is entered by correcting the
  shift's actual times afterwards (GH-70), not in the confirmation.
- The actors are the ones GH-53 settled for preparing a discharge: operations leads, operations admins,
  and organization admins. The confirming user and the shift responsible may differ.
- Exclusivity is checked against active discharges only, as GH-53, GH-54, and GH-55 decided: planned
  discharges compete freely, and the other discharges' existing indications and warnings show the
  result once one of them starts.
- A truck is exclusive through the whole pool and a door through every current assignment of the
  discharge, as the `CONTEXT.md` definitions of a truck and of a warehouse door assignment state
  across active discharges, not only through the first shift's resources.
- Site-reference rules already refuse archiving a dock, customer, door, warehouse, weighing area, or
  truck in use by a planned discharge. The archived-reference checks still apply, because references
  seeded or changed outside those rules, and races with an archival, must not enter operations.
- A suspended truck is excluded from new operational work, so it cannot count as the first shift's
  usable truck; it is not removed from the pool or the shift by the start.
- Problems are reported all at once rather than one per attempt, because each fix happens in a
  different section and a user fixing them one refusal at a time would retry repeatedly.
- The review lists the problems it finds when it opens, since GH-55 left to this slice the verdict on
  whether a discharge can start. The confirmation revalidates everything, because the preparation can
  change between opening and confirming.
- The discharge activity log does not exist yet (GH-102). The confirmation records who started the
  discharge and when on the discharge itself; recording it as an activity log entry belongs to GH-102.
- The deployment serves a single site, so conflicts are checked across every discharge of the site.
- Dates and times are displayed with the same convention as the discharge detail.

## Out of Scope

- The shift workspace and its live view of the active shift (GH-65).
- Starting a later shift after a handover (GH-69), completing a shift (GH-68), and correcting actual
  times (GH-70).
- Resolving a conflict from the review, such as withdrawing a truck or a door here or releasing it from
  the other discharge; the user fixes the plan in its section or in the other discharge.
- Choosing which planned shift starts, or starting a discharge without starting a shift.
- Changing the dock, trucks, doors, or shift resources of an active discharge (GH-75 to GH-78).
- Checking truck capacity against the lots' expected quantities.
- Closing a discharge, and cancelling or reverting a start.
- Recording activity log entries (GH-102), dashboards, and reports.

## Dependencies

- Blocked by GH-54, now delivered: the confirmation checks the door assignments and the first shift's
  doors and weighing areas it records.
- Blocked by GH-55, now delivered: the confirmation checks the truck pool and the first shift's trucks
  it records, and takes the place GH-55 reserved for it in the detail header.
- Relies on GH-53 and GH-58, delivered: the planned discharge, its lots and shifts, and the detail
  whose sections the problems link to.
- Relies on the delivered site-reference foundation: availability, archival, and suspension of docks,
  customers, warehouses, doors, weighing areas, and trucks, and user access status and roles.
- GH-65 depends on this slice and must be refined to build on the activation it delivers rather than
  define a second one.
- GH-102 should record the start confirmation as a Discharge lifecycle activity log entry.
- Last slice of the roadmap's execution order.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/56, including its original acceptance
  criteria from 2026-07-09 in the issue's edit history.
- Parent roadmap: specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md
- Sibling slices: specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/prepare-a-discharge-with-product-lots-and-shifts/spec.md,
  specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/plan-warehouse-door-and-checkpoint-assignments/spec.md,
  specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/plan-the-discharge-truck-pool-and-shift-subsets/spec.md
- Related slice: specs/discharge-execution/shift-execution-and-downtimes/start-the-first-shift-and-activate-the-discharge/spec.md (GH-65)
- Absorbed scope: "Confirm Discharge Start With Visible Conflict Handling", a frontend-only slice
  merged here on 2026-09-10 and deleted from GitHub. This slice owns both the activation and its
  review and refusal screens, under the single problem taxonomy of FR-016.
- Blockers: recorded as GitHub issue dependencies on the source issue.
- Related domain: discharge-preparation
- Domain vocabulary: `CONTEXT.md` (Discharge Start Confirmation, Planned Discharge, Active Discharge,
  Discharge Preparation, Planned Shift, Active Shift, Shift Responsible, Dock, Truck, Suspended Truck,
  Discharge Truck Assignment, Warehouse, Warehouse Door, Warehouse Door Assignment, Weighing Area,
  Available Site Reference, Archived Resource, Operations Lead, Operations Admin, Organization Admin,
  Observer).
