# Feature Specification: Closed Discharge Record Without Door History

**Feature Branch**: `feat/329-closed-discharge-record-without-door-history`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "https://github.com/whazzark/portflow-ai/issues/329 — Closed discharge record without door history (child of epic #313 Interface V2)"

**Feature ID**: `GH-329`

**GitHub Issue**: [#329](https://github.com/whazzark/portflow-ai/issues/329)

**Parent Issue**: [#313](https://github.com/whazzark/portflow-ai/issues/313) Interface V2

**Domain**: interface-v2 / discharges

## Context

The discharge record of a Closed Discharge currently shows the same identity card and header as a
planned one, and each product lot exposes a per-lot door history (a `History` link that opens a
"Door history" popover listing every warehouse door assignment with its effective period). That
per-lot history will be superseded by the Discharge Activity Log (#101, #103), which becomes the
single place where a discharge's changes are read.

Interface V2 gives the planned (#324) and active (#328) records a shared header carrying the key
facts and an Overview led by the dock timeline. This feature gives the closed record the same
shape, as a read-only record: a frozen dock timeline and a Summary on Overview, and product lots
that show the doors they used without any history affordance.

Design reference: "Portflow — Écrans canvas", page **Discharges**, row for the closed record
(*Retenue* column).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a closed discharge at a glance (Priority: P1)

Any user who may consult discharges opens a closed discharge and immediately sees which vessel it
was, at which dock, over which period, with which IMO and expected tonnage, then on the Overview
the discharge's shifts laid out on its period and a summary of what it involved (shifts, product
lots, trucks).

**Why this priority**: The closed record is consulted after the fact (reporting, customer
questions, validation follow-up). Its value is answering "what was this discharge" without
navigating every tab.

**Independent Test**: Open a closed discharge with several shifts, lots and trucks; the header and
the Overview alone answer dock, period, IMO, expected tonnage, vessel comment, shift layout, and
the counts of shifts, lots and trucks.

**Acceptance Scenarios**:

1. **Given** a closed discharge, **When** a user opens its record on any tab, **Then** the header
   shows the vessel name, the `Closed` status badge, and the facts Dock · Period · IMO · Expected
   tonnage.
2. **Given** a closed discharge with a vessel comment, **When** the user is on the Overview tab,
   **Then** the vessel comment is shown there; **When** the user is on any other tab, **Then** the
   vessel comment is not shown.
3. **Given** a closed discharge, **When** the user opens Overview, **Then** it shows a frozen dock
   timeline spanning the discharge's period with each of its shifts placed on it, followed by a
   Summary card giving the number of shifts, product lots and trucks.
4. **Given** a closed discharge, **When** the user views its dock timeline, **Then** it carries no
   "Now" marker, no expected-start marker for planning, no planning gaps or start blockers, and it
   does not change while the page stays open.
5. **Given** a closed discharge, **When** the user opens Overview, **Then** no separate identity
   ("Overview"/details) card repeating the header facts and no Preparation card is shown.

---

### User Story 2 - See the doors a product lot used, without door history (Priority: P1)

On the Product lots tab of a closed discharge, each lot shows the warehouse doors it used as chips,
and nothing on the lot offers a door history.

**Why this priority**: This is the issue's core change: the per-lot door history is withdrawn
ahead of the Discharge Activity Log, while the record still answers "which doors did this lot go
through".

**Independent Test**: Open the Product lots tab of a closed discharge whose lots had several
successive door assignments; each lot lists its doors once each as chips and no `History`
control, link, or door-history popover exists anywhere on the tab.

**Acceptance Scenarios**:

1. **Given** a closed discharge whose lot was assigned doors A, then B, then A again, **When** the
   user views that lot, **Then** it shows the chips A and B, each once.
2. **Given** a closed discharge, **When** the user views the Product lots tab, **Then** no lot
   shows a `History` button or link, and no "Door history" popover can be opened.
3. **Given** a lot whose doors exceed what fits in its row, **When** the user views it, **Then**
   the row keeps the overflow control (`+N`) that lists every door the lot used, without effective
   periods.
4. **Given** a lot that never had a door assigned, **When** the user views it, **Then** the lot
   says it had no door assigned, as today.
5. **Given** a door or warehouse that has since been archived, **When** its chip is shown,
   **Then** the chip still names it and marks it as archived, as today.

---

### User Story 3 - Consult the truck pool and shifts as a read-only record (Priority: P2)

On the Truck pool and Shifts tabs of a closed discharge, the user reads what was used and when, and
no action to change the discharge is offered.

**Why this priority**: Closed discharges receive no new shifts or resource changes; the record
must not suggest otherwise. Most of this is already true today and must be preserved through the
V2 restyle.

**Independent Test**: As a user who may prepare discharges, open each tab of a closed discharge;
no edit, start, add, withdraw, release, reassign, or row action is available.

**Acceptance Scenarios**:

1. **Given** a closed discharge and a user who may prepare discharges, **When** the user views the
   header, **Then** no Edit or Start action is shown.
2. **Given** a closed discharge, **When** the user views the Truck pool tab, **Then** the trucks
   the discharge used are listed with their reservation and release information, without
   selection, bulk actions, add, withdraw or release actions, and the tab label carries no held
   count.
3. **Given** a closed discharge, **When** the user views the Shifts tab, **Then** its shifts are
   listed and each can be opened for reading, without add, edit, reorder, remove, or resource
   change actions.
4. **Given** a closed discharge, **When** the user views the Product lots tab, **Then** no add,
   edit, remove, or door-assignment action is offered.

### Edge Cases

- A closed discharge with a single shift: the timeline still spans the discharge's period and
  shows that one shift; the Summary reads 1 shift.
- A closed discharge whose closure time is not recorded (for example closed before discharge
  closure records it): the Period shows the start and an explicit "not recorded" end rather than
  an invented date; the timeline spans from the start to the end of the last shift.
- A shift without a recorded actual start: it is placed on the timeline at its planned times.
- A discharge closed with no product lot or no truck: the Summary shows 0 for that count; the
  corresponding tab shows its usual empty state without any call to add.
- A shared link to one of a closed discharge's tabs opens that tab directly, with the same header.
- A user who opened the record while the discharge was active and it is closed meanwhile: on the
  next load of the record, the closed presentation applies; no live transition is required.
- Long dock names, vessel names or many doors on a lot do not break the header or the lot row on a
  narrow screen.

## Requirements *(mandatory)*

### Functional Requirements

#### Header

- **FR-001**: The closed record's header MUST show the vessel name and the `Closed` status badge,
  on every tab.
- **FR-002**: The header MUST show, labelled and in this order, Dock · Period · IMO · Expected
  tonnage, on every tab, consistent with the active record header (#328).
- **FR-003**: The Period MUST read from the discharge's actual start to its closure time; when the
  closure time is not recorded, it MUST show the start with an explicit "not recorded" end.
- **FR-004**: The header MUST NOT offer Edit, Start, or any other action that changes the
  discharge.
- **FR-005**: The vessel comment MUST be shown on the Overview tab only, and MUST be omitted when
  the discharge has none.

#### Overview

- **FR-006**: Overview MUST show, in this order, a frozen dock timeline then a Summary card, and no
  other card repeating the header facts, and no Preparation card.
- **FR-007**: The frozen dock timeline MUST span the discharge's period and place each of the
  discharge's shifts on it, at its actual times when recorded and otherwise at its planned times.
- **FR-008**: The frozen dock timeline MUST NOT show a "Now" marker, planning gaps, start blockers,
  or other discharges' occupancy, and MUST NOT move or refresh over time.
- **FR-009**: The Summary card MUST show the number of shifts, the number of product lots, and the
  number of distinct trucks the discharge used.

#### Product lots

- **FR-010**: Each product lot of a closed discharge MUST show as chips every warehouse door it was
  assigned during the discharge, each door once, keeping the existing archived marking and
  overflow (`+N`) list.
- **FR-011**: A closed discharge's product lots MUST NOT offer a `History` button or link, nor any
  popover or view listing a lot's door assignments with their effective periods.
- **FR-012**: A lot that never had a door assigned MUST keep saying so.
- **FR-013**: The Product lots tab of a closed discharge MUST NOT offer add, edit, remove, or door
  assignment actions.

#### Truck pool and Shifts

- **FR-014**: The Truck pool tab of a closed discharge MUST be read-only: no selection, bulk
  action, add, withdraw, or release action, and no held-truck count on the tab label.
- **FR-015**: The Shifts tab of a closed discharge MUST be read-only: shifts can be opened for
  reading, with no add, edit, reorder, remove, or resource-change action.

#### Scope boundaries

- **FR-016**: Planned and active records MUST keep their current door display; withdrawing the
  ended-assignments affordance from them is not part of this feature.
- **FR-017**: This feature MUST NOT change who may consult a discharge, nor the API's rules that
  refuse changes to a closed discharge.

### Key Entities

- **Closed Discharge**: a discharge explicitly declared physically finished; carries vessel name,
  IMO, vessel comment, dock, expected tonnage, actual start, and closure time once recorded.
- **Shift**: one working period of the discharge, with planned times and, once started, actual
  times; placed on the timeline.
- **Product Lot**: a customer's material in the discharge, with its warehouse door assignments
  (read here only as the set of doors used).
- **Truck Pool**: the trucks reserved for the discharge, each with its reservation and release.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the header and Overview alone, without opening another tab, a user can state the
  dock, period, IMO, expected tonnage, and the number of shifts, lots and trucks of a closed
  discharge.
- **SC-002**: On a closed discharge, 0 door-history controls or door-history views are reachable
  from the record.
- **SC-003**: On a closed discharge, 0 actions that would change the discharge are offered on any
  tab, for any user.
- **SC-004**: For every product lot, the set of door chips shown equals the set of distinct doors
  the lot was assigned during the discharge.
- **SC-005**: The closed record shows the same header layout as the active record, differing only
  in status badge and actions.

## Assumptions

- The Discharge Activity Log (#101, #103) is the future home for door assignment history; until it
  ships, a closed lot's assignment periods are not consultable from the web interface. This is
  accepted by the issue.
- The closure time comes from Discharge Closure (#98). Until it is recorded for a discharge, the
  Period shows the "not recorded" end described in FR-003; this feature does not record closure
  itself.
- The Period start is the discharge's actual start (the first shift's confirmed start), not its
  expected start.
- "Frozen" means the timeline is a record of the discharge's own shifts over its period: no Now
  line, no other discharges' occupancy, no planning aids. Other discharges that held the dock at
  the time are out of scope for a closed record.
- The Summary counts all of the discharge's shifts, all of its product lots, and every distinct
  truck that was in its truck pool.
- The header and dock timeline introduced for the planned (#324) and active (#328) records are
  reused when available; this feature does not depend on them being merged first and must render
  the closed record on its own.
- The `+N` overflow list of doors is a listing of doors, not a history, and is kept.
- Authorization is unchanged: whoever may consult a discharge today may consult the closed record.

## Out of Scope

- The full discharge history and Discharge Activity Log (#101, #103).
- Recording discharge closure (#98) or its readiness review (#97).
- Changes to planned (#324) or active (#328) records, including their ended-assignments link.
- Grouping product lots by customer (#325), truck pool bulk actions (#326), and the shift calendar
  (#327).
- Post-closure corrections of vessel information or product lot descriptions.

## Dependencies

- #314 V2 palette and authenticated shell (merged in #333).

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/329
- Parent epic: https://github.com/whazzark/portflow-ai/issues/313
- Related: #324, #328 (shared header and dock timeline), #98 (closure time), #101, #103
  (activity log).
