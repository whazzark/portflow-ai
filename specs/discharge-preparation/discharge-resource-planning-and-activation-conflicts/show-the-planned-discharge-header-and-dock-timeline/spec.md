# Feature Specification: Show the Planned Discharge Header and Dock Timeline

**Feature Branch**: `feat/324-planned-discharge-header-dock-timeline`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "l'issue github 324" — https://github.com/whazzark/portflow-ai/issues/324

**Feature ID**: `GH-324`

**GitHub Issue**: [#324](https://github.com/whazzark/portflow-ai/issues/324)

**Parent Epic**: [#313 Interface V2](https://github.com/whazzark/portflow-ai/issues/313)

**Depends on**: [#314 V2 palette and authenticated shell](https://github.com/whazzark/portflow-ai/issues/314) (merged)

**Domain**: discharge-preparation

**Design reference**: Portflow — Écrans canvas, page **Discharges**, row "planned discharge record",
retained V2 (*Retenue*). The canvas is private to its owner.

## Context

The planned discharge record (delivered by
`consult-a-prepared-discharge-in-the-web-workbench`, GH-58) currently repeats the dock, expected
start, and expected tonnage in both its header and an Overview card, and it says nothing about
whether the discharge can start until the user opens the Start dialog. It also gives no picture of
how the dock is occupied around the discharge's planned period.

This slice rearranges the **planned** discharge record so that its header carries the key facts on
every tab, a banner says up front how many problems block the start, each tab signals whether it
contains a problem, and the Overview tab shows the dock timeline followed by a Preparation card.
It adds no new business rule: which problems block a start remains owned by the Discharge Start
Confirmation (GH-56, out of scope).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the Key Facts of a Planned Discharge in Its Header (Priority: P1)

As an active user, I want the header of a planned discharge record to show its vessel, its Planned
status, its dock, its planned period, its vessel IMO, and its expected tonnage on whichever tab I am
on, with the vessel comment on the Overview tab, so that I always know which discharge I am working
on without a separate card repeating those facts.

**Why this priority**: The header is the only part of the record visible on every tab. Putting the
key facts there removes the duplicated Overview card and frees the Overview tab for the timeline
and the preparation.

**Independent Test**: Open a planned discharge with shifts, product lots, and a vessel comment, move
through each tab, and verify that the header facts stay identical on every tab, that the vessel
comment appears on Overview only, and that no other card repeats the header facts.

**Acceptance Scenarios**:

1. **Given** a planned discharge record is open on any tab, **When** the user reads its header,
   **Then** the vessel name is the page heading, a Planned status badge stands beside it, and a single
   line of facts reads, in this order, the dock, the planned period, the vessel IMO, and the expected
   tonnage.
2. **Given** the planned discharge has planned shifts, **When** the user reads the planned period,
   **Then** it runs from the earliest planned shift start to the latest planned shift end.
3. **Given** the planned discharge has no planned shift, **When** the user reads the planned period,
   **Then** it shows the expected start alone and states that no shift is planned.
4. **Given** the planned discharge has a vessel comment, **When** the user is on the Overview tab,
   **Then** the comment is shown under the header facts; **When** the user is on any other tab,
   **Then** the comment is not shown.
5. **Given** the planned discharge has no vessel comment, **When** the user is on the Overview tab,
   **Then** no empty comment placeholder is shown.
6. **Given** the dock is archived, **When** the user reads the header, **Then** the dock name carries
   the same archived marker the record already uses for archived references.
7. **Given** a user who may prepare discharges opens a planned discharge, **When** they read the
   header, **Then** the Edit and Start actions are available beside the heading; **Given** a user who
   may not prepare discharges, **Then** neither action is offered.
8. **Given** the Overview tab is open, **When** the user reads it, **Then** there is no separate
   Overview or Details card restating the dock, the expected start, the IMO, or the expected tonnage.

---

### User Story 2 - Know What Blocks the Start Before Opening It (Priority: P1)

As a user who may start discharges, I want a banner on the planned discharge record saying how many
problems block the start, with a Review action that opens the Start dialog, and each tab to show an
amber dot when it contains one of those problems, so that I know whether the discharge can start and
where to look without opening the confirmation first.

**Why this priority**: Today the user only learns that a start is blocked by trying it. Surfacing the
count and the affected tabs turns the record into a preparation checklist and is the main operational
value of this slice.

**Independent Test**: Open a planned discharge whose start check reports problems in the product lots
and the shifts but not in the truck pool, verify the banner count, the dots on Product lots and Shifts
only, and that Review opens the Start dialog listing the same problems; then fix every problem and
verify that the banner and the dots disappear.

**Acceptance Scenarios**:

1. **Given** a user who may start discharges opens a planned discharge whose start would be refused
   for n problems, **When** the record is shown, **Then** a banner reads "n problems block the start"
   (or "1 problem blocks the start" when n is 1) above the tabs, with a Review action.
2. **Given** the banner is shown, **When** the user activates Review, **Then** the Start dialog opens
   exactly as the Start action opens it, with the same problems listed.
3. **Given** the start check reports no problem, **When** the record is shown, **Then** no banner is
   shown and no tab carries a problem dot.
4. **Given** a problem concerns the dock, **When** the tabs are shown, **Then** the Overview tab carries
   an amber dot; a problem concerning a product lot or its warehouse doors marks Product lots; a
   problem concerning a held or archived truck of the pool marks Truck pool; a problem concerning a
   shift or its resources marks Shifts — following the same section grouping the Start dialog uses.
5. **Given** a tab carries a problem dot, **When** a screen-reader user reaches that tab, **Then** the
   tab's accessible name states that it contains a problem, so the signal does not rest on colour
   alone.
6. **Given** the user fixes a problem in a tab (for example assigns a warehouse door to a lot),
   **When** the change is saved, **Then** the banner count and the tab dots reflect the new start check
   without reloading the page.
7. **Given** the start check cannot be obtained, **When** the record is shown, **Then** the record is
   still fully readable, no banner or dot is shown, and the Start action still opens the Start dialog,
   which reports its own failure as it does today.
8. **Given** a user who may not start discharges opens a planned discharge, **When** the record is
   shown, **Then** neither the banner nor problem dots are shown, and no start check information is
   disclosed.

---

### User Story 3 - See How the Dock Is Occupied Around the Discharge (Priority: P2)

As an active user, I want the Overview tab of a planned discharge to open on a dock timeline that
shows the other discharges holding the same dock, the current time, the expected start, this
discharge's shifts, and the gaps between them, so that I can see whether the dock will be free when
this discharge is meant to start and how its shifts follow each other.

**Why this priority**: A dock serves at most one active discharge at a time, and a held dock is one of
the problems that blocks a start. The timeline explains that problem visually and shows shift gaps
that a list hides, but the record is useful without it.

**Independent Test**: Against a dataset where the dock of a planned discharge is held by an active
discharge and is also the dock of another planned discharge whose planned period overlaps, open the
planned discharge's Overview and verify each element of the timeline, then open a planned discharge
on a free dock with no shift and verify its timeline.

**Acceptance Scenarios**:

1. **Given** the Overview tab of a planned discharge is open, **When** the user reads it, **Then** the
   dock timeline is the first content of the tab, titled with the dock's name.
2. **Given** other discharges, active or planned, are assigned to the same dock with a period that
   falls within the timeline's span, **When** the user reads the timeline, **Then** each one is shown as
   a distinct occupation of the dock with its vessel name, its status, and its period, and leads to
   that discharge's record.
3. **Given** an active discharge holds the dock with no planned end, **When** the user reads the
   timeline, **Then** its occupation is shown as continuing to the end of the span rather than ending
   at an invented time.
4. **Given** the current time falls within the timeline's span, **When** the user reads it, **Then** a
   "Now" marker shows the current time; when the current time is outside the span, the timeline states
   whether the span is in the past or the future of now.
5. **Given** the planned discharge has an expected start, **When** the user reads the timeline,
   **Then** an "Expected start" marker shows it.
6. **Given** the planned discharge has planned shifts, **When** the user reads the timeline, **Then**
   each shift is shown in chronological order with its planned period, and each interval between two
   consecutive shifts with no shift planned is shown as a gap with its duration.
7. **Given** another discharge's occupation overlaps this discharge's planned period, **When** the user
   reads the timeline, **Then** the overlap is visibly distinguished and stated in words, not by colour
   alone.
8. **Given** no other discharge occupies the dock within the span, **When** the user reads the
   timeline, **Then** it states that the dock is free over that period.
9. **Given** the planned discharge has no planned shift, **When** the user reads the timeline, **Then**
   it shows the Now and Expected start markers and the other discharges' occupations, and states that
   no shift is planned.
10. **Given** the user is on the Product lots, Truck pool, or Shifts tab, **When** they read it, **Then**
    the dock timeline is not shown.

---

### User Story 4 - Follow the Preparation From the Overview (Priority: P2)

As an active user, I want a Preparation card below the timeline summarising the dock, the product
lots, the truck pool, and the shifts, each linking to where it is managed, so that the Overview tells
me what is prepared and takes me to what is missing.

**Why this priority**: The Preparation card already exists for product lots, truck pool, and shifts;
this slice adds the dock row and places the card after the timeline. It refines an existing summary.

**Independent Test**: Open a planned discharge with lots missing doors, no truck, and a held dock, and
verify each row's fact, its gap, and that each row's link opens the right tab.

**Acceptance Scenarios**:

1. **Given** the Overview tab of a planned discharge is open, **When** the user reads below the
   timeline, **Then** a Preparation card lists, in this order, Dock, Product lots, Truck pool, and
   Shifts.
2. **Given** the Preparation card is shown, **When** the user activates the Product lots, Truck pool,
   or Shifts row, **Then** the corresponding tab opens; **When** they activate the Dock row, **Then**
   focus moves to the dock timeline on the Overview tab.
3. **Given** the dock is held by another discharge or archived, **When** the user reads the Dock row,
   **Then** the gap is stated in words beside a warning icon; otherwise the row states the dock's name.
4. **Given** product lots without a current warehouse door, no reserved truck, or planned shifts
   without a truck, **When** the user reads the card, **Then** the rows state those gaps as they do
   today.
5. **Given** the card shows its rows, **When** the user reads it, **Then** it passes no verdict of its
   own on whether the discharge can start; the banner and the Start dialog own that answer.

### Edge Cases

- A discharge whose start check reports a single problem reads "1 problem blocks the start".
- A problem whose subject belongs to no tab (for example an archived customer reached through a
  product lot) marks the tab of the element the Start dialog lists it under.
- Several problems in one tab produce one dot, not one per problem; the dot does not carry a count.
- The tab counts (product lots, trucks, shifts) remain as today and are unaffected by problem dots.
- A shift spanning midnight or several days is shown continuously on the timeline.
- Shifts that touch end-to-start produce no gap; overlapping planned shifts are shown without a gap
  between them.
- An occupation by another discharge that starts before the span or ends after it is clipped at the
  span's edge and states that it continues.
- The other discharges on the dock are shown even when the viewer would otherwise reach them only
  from the list; leaving through one of them and returning restores the list state as navigation
  between discharges already does.
- The record of a discharge that starts while it is open (by another user) no longer shows the banner,
  the dots, or the planned layout once refreshed, and falls back to the active discharge record.
- On a narrow screen the header facts wrap without truncating values, and the timeline remains
  readable by scrolling within itself rather than the whole page.
- Loading, not-found, and failure states of the record are unchanged.

## Requirements *(mandatory)*

### Functional Requirements

**Header**

- **FR-001**: The planned discharge record MUST show, on every tab, a header with the vessel name as
  the page heading, a Planned status badge, and the facts Dock · Planned period · IMO · Expected
  tonnage, in that order.
- **FR-002**: The planned period MUST run from the earliest planned shift start to the latest planned
  shift end; with no planned shift it MUST show the expected start and state that no shift is
  planned.
- **FR-003**: The vessel comment MUST be shown in the header area on the Overview tab only, and MUST be
  omitted when empty.
- **FR-004**: The header MUST offer the Edit and Start actions to users who may prepare discharges, and
  neither to other users, as today.
- **FR-005**: The Overview tab MUST NOT contain a separate Overview or Details card restating header
  facts.

**Start blockers**

- **FR-006**: For a user who may start discharges, the planned discharge record MUST obtain the same
  start review the Start dialog uses and, when it reports one or more problems, show above the tabs a
  banner stating their number ("n problems block the start", singular for one) with a Review action.
- **FR-007**: The Review action MUST open the Start dialog exactly as the Start action does.
- **FR-008**: Each tab MUST show an amber dot when at least one reported problem belongs to it, using
  the section grouping the Start dialog already applies (dock → Overview; product lots and their doors
  → Product lots; trucks of the pool → Truck pool; shifts and their resources → Shifts).
- **FR-009**: A tab carrying a problem dot MUST expose that fact in its accessible name.
- **FR-010**: The banner and the dots MUST reflect the current start review after any change made from
  the record, without a page reload.
- **FR-011**: When the start review is unavailable or the viewer may not start discharges, the record
  MUST show neither banner nor dots and MUST remain fully usable.
- **FR-012**: Tabs MUST keep showing their counts.

**Dock timeline**

- **FR-013**: The Overview tab of a planned discharge MUST open on a dock timeline for the
  discharge's dock.
- **FR-014**: The timeline MUST show the other active and planned discharges assigned to the same dock
  whose period falls within its span, each with vessel name, status, and period, and each leading to
  that discharge's record.
- **FR-015**: The timeline MUST show a Now marker when now falls within its span, an Expected start
  marker, each planned shift of this discharge in order, and each gap between consecutive shifts with
  its duration.
- **FR-016**: The timeline MUST distinguish and state in words any overlap between another discharge's
  occupation and this discharge's planned period, and MUST state when the dock is free over the span.
- **FR-017**: The timeline's span MUST cover this discharge's planned period (or its expected start
  when no shift is planned) with a margin on either side, and MUST state whether now lies before or
  after the span when the Now marker falls outside it. The timeline MUST NOT be repeated on any other
  tab.
- **FR-018**: The timeline MUST disclose about other discharges only what the discharges list already
  discloses to the same viewer (vessel name, status, dock, period).

**Preparation card**

- **FR-019**: Below the timeline, the Overview tab MUST show a Preparation card with the rows Dock,
  Product lots, Truck pool, and Shifts, in that order, each linking to where it is managed.
- **FR-020**: The Dock row MUST state the dock's name, or the gap when the dock is held by another
  discharge or archived, in words beside a warning icon.
- **FR-021**: The Product lots, Truck pool, and Shifts rows MUST keep the facts and gaps they state
  today.

**Unchanged behavior**

- **FR-022**: The Edit discharge sheet and the Start dialog MUST keep their current behavior.
- **FR-023**: The Product lots, Truck pool, and Shifts tabs MUST keep their current content apart from
  the tab dots.
- **FR-024**: Active and closed discharge records are not changed by this slice; their redesign belongs
  to their own issues (#328, #329).

### Key Entities

- **Planned Discharge**: the discharge being viewed; provides vessel name, IMO, comment, dock,
  expected start, expected tonnage, product lots, truck pool, and shifts.
- **Planned Period**: derived span from the earliest planned shift start to the latest planned shift
  end of a discharge.
- **Start Problem**: an item of the start review that blocks the Discharge Start Confirmation; carries
  the element it concerns, which determines the tab it marks.
- **Dock Occupation**: another active or planned discharge assigned to the same dock, with its period
  (open-ended for an active discharge without a planned end).
- **Shift Gap**: an interval between two consecutive planned shifts of the discharge with no shift
  planned.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a planned discharge record, the dock, planned period, IMO, and expected tonnage are
  each shown exactly once per tab, on all four tabs.
- **SC-002**: A user who may start discharges can tell whether a planned discharge can start, and in
  which tabs its problems lie, without opening any dialog — verified in 100% of the acceptance
  scenarios of User Story 2.
- **SC-003**: The banner count always equals the number of problems the Start dialog lists when opened
  at the same moment.
- **SC-004**: A user can identify, from the Overview alone, which other discharge holds the dock at
  the expected start and every gap between shifts, in one reading without scrolling the page on a
  standard desktop screen.
- **SC-005**: Every signal introduced (problem dots, overlaps, gaps) is understandable without colour,
  as checked with a screen reader and in greyscale.
- **SC-006**: Existing browser journeys of the Edit discharge sheet and the Start dialog pass unchanged.

## Assumptions

- "Planned period" is derived from planned shifts (earliest start to latest end); a discharge without
  a shift has only its expected start. This matches how shifts already define when a discharge works.
- The banner and the dots are shown only to users who may start discharges, because the start review
  is restricted to them and only they can act on it; other active users see the record without them.
- "Other discharges holding the dock" means the other active and planned discharges assigned to the
  same dock; only an active one blocks the start, which the start review already reports as a held
  dock.
- The data needed for the timeline (other discharges on the same dock and their periods) may require
  the API to expose it for a planned discharge; the planning phase decides how, within existing
  authorization (any active user may already list discharges with their dock and expected start).
- The timeline is a read-only visualisation; it offers no drag, resize, or replanning of shifts.
- English UI copy follows the repository's existing labels; the banner wording follows the issue
  ("n problems block the start").
- The V2 palette and shell from #314 provide the amber warning tone and the badge styles.

## Out of Scope

- The rules deciding which problems block a start (Discharge Start Confirmation, #56).
- The redesign of the active discharge record (#328), the closed discharge record (#329), the
  not-found state (#330), and the product lots, truck pool, and shifts tab redesigns (#325, #326,
  #327).
- Any change to the Edit discharge sheet or to the Start dialog's content and behavior.
