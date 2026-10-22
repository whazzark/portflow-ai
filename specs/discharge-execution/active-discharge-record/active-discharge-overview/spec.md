# Feature Specification: Active Discharge Overview

**Feature Branch**: `feat/328-active-discharge-overview`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "l'issue github 328" — [#328 Active discharge overview](https://github.com/whazzark/portflow-ai/issues/328)

**GitHub Issue**: [#328](https://github.com/whazzark/portflow-ai/issues/328)

**Parent Epic**: [#313 Interface V2](https://github.com/whazzark/portflow-ai/issues/313)

**Domain**: discharge-execution

**Design reference**: Portflow — Écrans canvas, page **Discharges**, rows for the active discharge
record (*Retenue* column). The canvas is private.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See What Is Happening Now on an Active Discharge (Priority: P1)

As an active user following a discharge that has started, I want the Overview of its record to
lead with the Active Shift — who is responsible for it, which trucks, warehouse doors, and weighing
areas it uses, and which shift comes next — so that I know at a glance who to talk to and what is
working right now without opening the Shifts tab.

**Why this priority**: This is the problem the issue states: today the active record shows the
same facts card as a planned one and does not say what is happening now. The Active Shift card is
the core of the outcome.

**Independent Test**: Against a dataset with an active discharge whose first shift has started and
which has at least one further planned shift, sign in as each active role, open that discharge, and
verify that its Overview shows, first, a card naming the Active Shift with its planned period,
actual start, responsible, trucks, warehouse doors, weighing areas, and the next planned shift,
matching the persisted shifts.

**Acceptance Scenarios**:

1. **Given** an active discharge with an Active Shift, **When** an active user opens its Overview,
   **Then** the first card presents that shift: its planned period, its actual start, its Shift
   Responsible, and the trucks, warehouse doors (with their warehouse), and weighing areas it holds
   now, each with its count.
2. **Given** the Active Shift is followed by at least one Planned Shift, **When** the Overview is
   shown, **Then** the card names the next Planned Shift by its planned period and its responsible.
3. **Given** the Active Shift is the last shift of the discharge, **When** the Overview is shown,
   **Then** the card says no further shift is planned instead of naming a next shift.
4. **Given** an active discharge with no Active Shift, because its last shift was completed and the
   next one has not started, **When** the Overview is shown, **Then** the card says no shift is
   active, names the last Completed Shift by its period, and names the next Planned Shift, or says
   none is planned.
5. **Given** a resource or responsible shown on the card has been archived or has lost eligibility
   since the shift started, **When** the card is shown, **Then** it is still listed with the same
   archived or ineligible marking the rest of the record uses.

---

### User Story 2 - Read the Active Discharge's Key Facts on Every Tab (Priority: P1)

As an active user, I want the active discharge's header to carry its vessel, its status, and its
key facts — dock, period, IMO, expected tonnage — on every tab, exactly as the planned record does,
so that I never lose track of which discharge I am reading and the Overview no longer repeats them
in a separate facts card.

**Why this priority**: The issue requires the active record to share the planned record's header;
without it the Overview cannot drop its facts card and the record reads differently from one status
to the next.

**Independent Test**: Open an active discharge, switch through Overview, Product lots, Truck pool,
and Shifts, and verify that the header shows the vessel name, the Active status, and Dock · Period ·
IMO · Expected tonnage on each tab, that the vessel comment appears on Overview only, and that no
separate facts card repeats them.

**Acceptance Scenarios**:

1. **Given** an active discharge, **When** any of its tabs is open, **Then** the header shows its
   vessel name, the Active status, and, on one line, its dock, its period, its vessel IMO, and its
   expected tonnage.
2. **Given** an active discharge whose vessel has a comment, **When** the Overview is open, **Then**
   the comment is shown on the Overview, and it is not shown on the other tabs.
3. **Given** an active discharge whose vessel has no comment, **When** the Overview is open, **Then**
   no empty comment block is shown.
4. **Given** an active discharge, **When** the Overview is open, **Then** no card repeats the dock,
   period, IMO, or expected tonnage already in the header.
5. **Given** an active discharge, **When** the header is shown, **Then** it offers no Edit or Start
   action, since a started discharge is no longer corrected as a preparation.

---

### User Story 3 - Place the Active Shift on the Dock Timeline (Priority: P2)

As an active user, I want the Overview to show, after the Active Shift card, the dock timeline of
this discharge with a Now line, so that I see where the discharge stands against its shifts, the
breaks between them, and the other discharges holding the same dock.

**Why this priority**: It turns the Active Shift into a position in time and shows how much of the
planned work lies behind and ahead, but the Active Shift card alone already answers who and what.

**Independent Test**: Open an active discharge whose shifts are partly behind and partly ahead of
the current time and verify that the timeline shows its completed, active, and planned shifts, the
inter-shift breaks, the other discharges holding the dock in the shown window, and a Now line at
the current time, with the Active Shift distinguished from the others.

**Acceptance Scenarios**:

1. **Given** an active discharge, **When** the Overview is shown, **Then** the dock timeline comes
   right after the Active Shift card and before the Progress card.
2. **Given** the timeline is shown, **When** the user reads it, **Then** it shows the discharge's
   Completed Shifts from their actual start, the Active Shift from its actual start, the Planned
   Shifts at their planned periods, the Inter-Shift Breaks between them, the other discharges holding
   the same dock during the shown window, and a Now line at the current time.
3. **Given** the Active Shift has run past its planned end, **When** the timeline is shown, **Then**
   the Active Shift extends from its actual start to Now, and the overrun is visible against its
   planned end.
4. **Given** the timeline is shown on the active record, **When** the user reads it, **Then** it is
   not repeated on any other tab.

---

### User Story 4 - Find the Progress Card and the Active Shift on the Other Tabs (Priority: P3)

As an active user, I want the Overview to end with a Progress card, and the Shifts calendar to
highlight the Active Shift, while the other tabs stay read-only except for adding a shift, so that
the record reads as a discharge in progress rather than one being prepared.

**Why this priority**: It completes the retained layout; the progress figures themselves belong to
later issues, and the read-only tabs mostly confirm existing behavior.

**Independent Test**: Open an active discharge as a preparer and as a non-preparer and verify that
the Overview ends with a Progress card, that the Shifts calendar highlights the Active Shift, that
Product lots and Truck pool offer no correction, and that Add shift is offered on Shifts to preparers
only.

**Acceptance Scenarios**:

1. **Given** an active discharge, **When** the Overview is shown, **Then** its last card is a
   Progress card summarising its shifts (completed, active, and planned out of the total, and the
   planned end), its product lots (count, customers, expected tonnage, lots with and without a
   warehouse door), and its truck pool (trucks held, trucks released), each linking to its tab.
2. **Given** an active discharge, **When** the Shifts tab is open, **Then** the Active Shift is
   highlighted in the calendar and distinguishable from Completed and Planned Shifts without relying
   on colour alone.
3. **Given** an active discharge and a viewer allowed to prepare discharges, **When** the Product
   lots, Truck pool, or Shifts tab is open, **Then** no correction action is offered except Add shift
   on the Shifts tab.
4. **Given** an active discharge and a viewer not allowed to prepare discharges, **When** any tab is
   open, **Then** no action that changes the discharge is offered, Add shift included.

---

### Edge Cases

- An active discharge with no Active Shift between two shifts: the Active Shift card shows its
  "no shift active" state (US1-4); the timeline still shows Now; the Shifts calendar highlights
  nothing.
- An active discharge whose every shift is completed and none is planned: the card says no shift is
  active and none is planned, and offers Add shift to a preparer as the way forward.
- An Active Shift that started before its planned start (allowed once the previous shift is
  completed): the card and the timeline use its actual start; the planned period stays readable.
- An Active Shift holding no truck, door, or weighing area cannot exist (an Active Shift always
  holds at least one of each); the card is not required to render an empty resource group.
- A shift holding many trucks or doors: the card shows counts and lists them without growing the
  Overview past the timeline; the full lists remain on the Shifts tab.
- The discharge is closed or a shift starts or completes while the page is open: the page reflects
  the change on its next load or refetch; live updates are out of scope.
- A planned or closed discharge is unaffected by this feature: neither shows the Active Shift card
  nor the Progress card.
- A viewer whose session has expired or who lacks access: the existing record access rules apply
  unchanged.

## Requirements *(mandatory)*

### Functional Requirements

**Header**

- **FR-001**: The active discharge record MUST show the same header as the planned record on every
  tab: vessel name, status badge reading Active, and the facts line Dock · Period · IMO · Expected
  tonnage.
- **FR-002**: For an active discharge, the Period MUST run from the discharge's actual start to the
  planned end of its last shift.
- **FR-003**: The header of an active discharge MUST NOT offer Edit or Start.
- **FR-004**: The vessel comment MUST be shown on the Overview only, and only when the vessel has
  one.

**Overview**

- **FR-005**: The Overview of an active discharge MUST present, in this order: the Active Shift
  card, the dock timeline, then the Progress card, with no separate facts card.
- **FR-006**: The Active Shift card MUST show the Active Shift's planned period, actual start, Shift
  Responsible, and the trucks, warehouse doors with their warehouse, and weighing areas it holds now,
  each group with its count.
- **FR-007**: The Active Shift card MUST name the next Planned Shift, by its planned period and its
  responsible, or state that no further shift is planned.
- **FR-008**: When the discharge has no Active Shift, the card MUST say so, name the last Completed
  Shift by its period when there is one, and name the next Planned Shift or state that none is
  planned.
- **FR-009**: The Active Shift card MUST mark archived resources and an ineligible responsible the
  same way the rest of the discharge record does.
- **FR-010**: The dock timeline MUST show the discharge's Completed Shifts from their actual start,
  the Active Shift from its actual start to its planned end or to Now if later, its Planned Shifts at
  their planned periods, its Inter-Shift Breaks, the other discharges holding the same dock in the
  shown window, and a Now line.
- **FR-011**: The dock timeline MUST distinguish the Active Shift from Completed and Planned Shifts
  without relying on colour alone, and MUST NOT be repeated on another tab.
- **FR-012**: The Progress card MUST summarise the discharge's shifts (total, completed, active,
  planned, planned end), its product lots (count, customers, expected tonnage, lots with and without
  a warehouse door now), and its truck pool (trucks held, trucks released with their release time),
  each row linking to its tab.

**Other tabs**

- **FR-013**: The Product lots and Truck pool tabs of an active discharge MUST be read-only.
- **FR-014**: The Shifts tab of an active discharge MUST be read-only except for Add shift, offered
  only to viewers allowed to prepare discharges.
- **FR-015**: The Shifts calendar of an active discharge MUST highlight the Active Shift, without
  relying on colour alone.

**Scope guard**

- **FR-016**: Planned and closed discharge records MUST NOT show the Active Shift card or the
  Progress card.
- **FR-017**: This feature MUST NOT change any business rule, permission, or state transition owned
  by the API; it only presents what the discharge record already exposes, plus the dock occupancy
  the planned record's timeline needs.

### Key Entities

- **Discharge (active)**: The started discharge whose record is read; carries its vessel
  description, dock, actual start, expected tonnage, and shifts.
- **Active Shift**: The discharge's single started, not yet completed shift, with its planned
  period, actual start, Shift Responsible, and the trucks, warehouse doors, and weighing areas it
  holds now.
- **Planned Shift / Completed Shift**: The shifts before and after the Active Shift, placed on the
  timeline and named as the next or last shift on the card.
- **Dock occupancy**: The other discharges holding the same dock during the timeline's window, as
  the planned record's dock timeline already shows them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user opening an active discharge can name its Shift Responsible and the number of
  trucks working now within 5 seconds, without leaving the Overview or scrolling past its first card.
- **SC-002**: On every tab of an active discharge, its dock, period, IMO, and expected tonnage are
  visible without scrolling, and none of them is shown twice on the Overview.
- **SC-003**: In every acceptance scenario, the shift named as active, next, or last on the card and
  highlighted on the timeline and calendar is the same shift, and matches the persisted shift
  states.
- **SC-004**: No action that changes an active discharge is reachable from its record except Add
  shift, and Add shift is reachable by preparers only.
- **SC-005**: The Overview of an active discharge is usable at phone width, with the Active Shift
  card readable without horizontal scrolling.

## Assumptions

- **Dependencies**: The V2 palette and shell (#314, merged) is in place. The dock timeline component
  and the shared header come from #324 (planned discharge header and dock timeline); the week
  calendar comes from #327. This feature reuses both rather than introducing its own, so whichever
  lands first provides the shared piece and the others adopt it.
- **Vocabulary**: The issue calls the first card "Current shift". `CONTEXT.md` lists "current
  shift" as a term to avoid in favour of **Active Shift**, so the spec uses Active Shift. The card's
  visible title is « Current shift », as in the design reference (confirmed at plan review).
- **Period on an active discharge**: Assumed to run from the discharge's actual start to the planned
  end of its last shift, as the planned record's Planned period runs from its expected start to the
  same end (matches the design reference; confirmed at plan review).
- **Progress card content**: Progress figures and live updates are out of scope (#111, #113). The
  card shows only what the record already knows, as the design's three rows (Shifts, Product lots,
  Truck pool), so that #111 later adds figures in place (confirmed at plan review, 2026-10-22).
- **Completed Shift end**: Shifts have no recorded actual end until shift completion ships; a
  Completed Shift is drawn and named to its planned end until then (confirmed at plan review,
  2026-10-22).
- **Now line**: Positioned at the time the page was loaded or last refetched; it does not move by
  itself and the record is not pushed updates in this feature.
- **No shift lifecycle actions**: Starting, completing, or adjusting shifts from this record belong
  to the discharge-execution features that own them and are not offered here.
- **Access**: Every active user who can open a discharge record today can read the active record;
  only the roles that may already prepare discharges (operations lead, operations admin,
  organization admin) see Add shift.
