# Feature Specification: Planned Shifts Week Calendar

**Feature Branch**: `feat/327-planned-shifts-week-calendar`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "l'issue github 327"

**GitHub Issue**: [#327](https://github.com/whazzark/portflow-ai/issues/327)

**Parent Epic**: [#313](https://github.com/whazzark/portflow-ai/issues/313) Interface V2

**Depends on**: [#314](https://github.com/whazzark/portflow-ai/issues/314) V2 palette and authenticated shell (merged in #333)

**Design reference**: [Portflow — Écrans canvas](https://claude.ai/artifact/1RyXTf3HKkxNHBS3ZVc3iT), page **Discharges**, boards *Shifts — calendrier*, *Panneau shift*, *Edit shift*, *Add shift*, *Active — Shifts*, *Active — panneau shift* and *Closed — Shifts* (*Retenue* column)

## Context

The Shifts tab of a discharge already shows a week calendar with breaks, an Expected start line,
shift cards, a shift panel, an Edit shift view, and an Add shift sheet (GH-63 and earlier slices).
This feature restyles that tab to the retained V2. It adds no business rule: who may add or edit a
shift, what an addition or correction accepts or refuses, how gaps are computed, and how a period
drawn on the calendar opens the addition all stay as they are. Only what the tab shows, and how, changes.

The issue is labelled `delivery:lite` (visual refresh, no Spec Kit artifacts). This spec was
requested anyway, to hold the visual contract for review. It adds no new behavioral contract.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a Discharge's Shift Plan at a Glance (Priority: P1)

As an operations lead, administrator, or observer opening the Shifts tab of a discharge, I want one
summary line and a 24-hour week calendar that shows every shift, the breaks between them, and the
expected start, so that I can judge the plan's coverage without opening each shift.

**Why this priority**: Users come to the Shifts tab to read this calendar. It is the core of the
retained V2 and the reason for the issue.

**Independent Test**: Open the Shifts tab of a seeded planned discharge with several shifts over
several days, and check the summary line, the legend, the columns, the hour gutter, the hatched
breaks with their durations, the Expected start line, and the content of each card.

**Acceptance Scenarios**:

1. **Given** a planned discharge with 5 shifts totalling 40 hours, from 27/09 06:00 to 29/09 22:00,
   **When** the user opens its Shifts tab, **Then** a summary line above the calendar reads
   "5 shifts · 40 h planned · 27/09 06:00 → 29/09 22:00".
2. **Given** an active discharge with 14 shifts, of which 5 are completed, 1 is active, and 8 are
   planned, ending Fri 18 Sept at 22:00, **When** the user opens its Shifts tab, **Then** the summary
   line reads "14 shifts · 5 completed · 1 active · 8 planned · ends Fri 18 Sept, 22:00".
3. **Given** a closed discharge with 4 completed shifts totalling 32 hours, **When** the user opens its
   Shifts tab, **Then** the summary line reads "4 shifts completed · 32 h · 16/08 06:00 → 17/08 22:00"
   and no Add shift action is offered.
4. **Given** any discharge with shifts, **When** the Shifts tab is shown on a wide screen, **Then** a
   legend beside the summary explains the Expected start line, the hatched inter-shift break, and
   the trucks, warehouse doors, and weighing areas icons used on cards.
5. **Given** a discharge with shifts, **When** the calendar is shown on a wide screen, **Then** each
   column is one day from 00:00 to 24:00, headed by its date (e.g. "Sun 27 Sept") and, for the
   discharge's own days, its number ("Day 1"). An hour gutter marks every two hours, and the whole
   24-hour day is visible without scrolling the calendar vertically.
6. **Given** two successive shifts separated by 16 hours, **When** the calendar is shown, **Then**
   the interval is drawn as a hatched inter-shift break labelled with its duration ("16 h"), in a
   pill that never covers a shift's text.
7. **Given** a discharge whose expected start falls after the first column's midnight, **When** the
   calendar is shown, **Then** a dashed line labelled "Expected start" marks that instant beneath the
   shift cards.
8. **Given** an active discharge, **When** the calendar is shown, **Then** a line marks the current
   time, labelled with it (e.g. "Now 22:14").
9. **Given** a shift card tall enough to show everything, **When** it is shown, **Then** it reads its
   time range and duration ("06:00–14:00 · 8 h"), its status, its responsible, and its counts of
   trucks, warehouse doors, and weighing areas, each count beside its icon.
10. **Given** a shift worked past midnight, **When** the calendar is shown, **Then** it is cut at
    midnight, and the piece in the following column reads its time range followed by "(cont.)".

---

### User Story 2 - Spot Planned Shifts That Still Lack Something (Priority: P1)

As an operations lead preparing a discharge, I want planned shifts with gaps to stand out in amber,
on the card and in the summary, so that I find what still needs preparing before the start without
opening each shift.

**Why this priority**: Gaps are what the user must act on before starting. The issue names the amber
« 1 gap » badge explicitly.

**Independent Test**: On a planned discharge where one planned shift lacks a warehouse door, check
the card and the summary line.

**Acceptance Scenarios**:

1. **Given** a planned shift with one gap, **When** the calendar is shown, **Then** its card has an
   amber border and an amber "1 gap" badge with a warning icon, placed where the status would be.
2. **Given** a planned shift with two gaps, **When** the calendar is shown, **Then** its badge reads
   "2 gaps".
3. **Given** a discharge whose planned shifts have gaps, **When** the Shifts tab is shown, **Then**
   the summary line ends with the total in amber (e.g. "· 1 gap").
4. **Given** a discharge whose planned shifts have no gap, **When** the Shifts tab is shown,
   **Then** neither the summary nor any card shows a gap badge.
5. **Given** a shift with a gap, **When** it is announced to assistive technology, **Then** its
   accessible name includes the gap count (e.g. "Shift Tue 29 Sept 06:00–14:00, 1 gap"), so the
   amber colour is never the only signal.

---

### User Story 3 - Inspect a Shift in Its Panel (Priority: P2)

As any user of the discharge, I want to choose a shift card and see its details in a side sheet
headed by its period, status, and position in the plan, so that I understand the shift without
leaving the calendar.

**Why this priority**: The panel already exists; V2 only changes its header and layout. It matters
less than the calendar itself.

**Independent Test**: Choose a planned shift, then a completed shift on an active discharge, and
check each panel's header, readiness statement, resource groups, and footer.

**Acceptance Scenarios**:

1. **Given** the calendar of planned discharge MV Atlantic Dawn, **When** the user chooses its first
   shift, **Then** a side sheet opens titled "Sun 27 Sept 06:00 – 14:00", with a "Planned" status
   badge and the line "Shift 1 of 5 · MV Atlantic Dawn".
2. **Given** the open panel of a planned shift, **When** it is shown, **Then** it lists Responsible,
   Duration, Planned start, and Planned end, then the readiness statement ("Ready." or the shift's
   gaps), then the Weighing areas, Warehouse doors, and Trucks groups, each with its count.
3. **Given** a planned shift whose resources were all assigned at the same time, **When** its panel is
   shown, **Then** it states once "All resources since <date, time>" instead of repeating the date on
   each truck.
4. **Given** a user allowed to correct the planned shift, **When** its panel is shown, **Then** an
   Edit action closes the panel's footer. Users without that permission see no Edit action.
5. **Given** a completed shift, **When** its panel is shown, **Then** it also lists Actual start and
   Started by. Its footer states "A completed shift cannot be changed" and offers Close.
6. **Given** an open panel, **When** the user closes it with Close, the close button, a click outside,
   or Escape, **Then** the calendar is shown again and the shift stays addressable by its link as today.

---

### User Story 4 - Edit and Add Shifts in Sheets (Priority: P3)

As an operations lead or administrator, I want Edit shift and Add shift to open as side sheets in the
V2 style, with the duration shown live and a clear hint of where a new shift starts, so that
correcting or extending the plan reads the same way as the rest of V2.

**Why this priority**: Both flows already work. Only their presentation changes.

**Independent Test**: Open Edit shift from a planned shift's panel, then Add shift from the tab's
action, and check their headers, field groups, counts, and footers. Save each with valid values.

**Acceptance Scenarios**:

1. **Given** a planned shift's open panel, **When** the user chooses Edit, **Then** the sheet shows
   "Back to details", the title "Edit shift", the description "Correct shift Sun 27 Sept 06:00 – 14:00:
   its period, its responsible, and the resources it will use.", and Cancel and Save actions.
2. **Given** the Edit shift or Add shift sheet, **When** the planned start and end are entered,
   **Then** a read-only Duration field beside them reads the resulting duration (e.g. "8 h").
3. **Given** the Edit shift or Add shift sheet on a planned discharge, **When** the resource groups
   are shown, **Then** Weighing areas, Warehouse doors, and Trucks each read "<selected> of <available>
   selected" with a Select all control. A warehouse door reads its warehouse and door with the
   customer and product it serves, and a suspended truck reads as Suspended.
4. **Given** a planned discharge with shifts, **When** the user chooses Add shift, **Then** the sheet is
   titled "Add shift", described "Plan a new shift for MV Atlantic Dawn: its period, its responsible,
   and the resources it will use.", pre-filled to start when the last shift ends, and states it
   (e.g. "Starts when the last shift ends, on Tue 29 Sept at 22:00.").
5. **Given** the Add shift sheet opened by drawing a period on the calendar, **When** it is shown,
   **Then** the drawn period is entered, and no "Starts when the last shift ends" hint is shown.
6. **Given** an active discharge, **When** the user opens Add shift, **Then** the sheet keeps today's
   description and offers no resource groups.
7. **Given** a submission in either sheet, **When** the server accepts or refuses it, **Then** the
   outcome, refusal messages, and post-save navigation are exactly those of today.

---

### Edge Cases

- **No shift**: the Shifts tab keeps its empty state ("No shifts planned"), with Add shift for users
  allowed to add. No summary line, legend, or calendar is shown.
- **One shift**: the summary uses the singular ("1 shift · 8 h planned · …"). No break is drawn.
- **Short break**: a break shorter than its pill still shows its duration in a compact pill that
  spills only into the padding of the cards around it, never over their text.
- **Break across midnight**: a break cut at midnight shows its duration once, in its tallest piece.
- **Short shift**: a card too short for every line drops lines from the bottom (counts, then
  responsible, then status or gap badge), always keeping its time range. The panel and the
  accessible name still give everything.
- **Discharge longer than a week**: the calendar adds one column per extra day and scrolls sideways,
  keeping the hour gutter in view. It opens on the active shift, else the next planned shift, else
  the last one.
- **Expected start on the first column's midnight**: no separate line is drawn, as the calendar
  already opens there.
- **Narrow screen**: the calendar is replaced by a stacked list of the same cards in planned order,
  each reading its day, with each break between two cards labelled with its duration. The summary
  line wraps. The legend is not shown.
- **Selected shift**: the chosen card is outlined in the focus colour within its own bounds, without
  moving its content or spilling over a neighbour.
- **Light and dark themes**: every colour (cards by status, amber gap, hatched break, Expected start,
  Now line) comes from the V2 palette tokens and reads correctly in both themes.

## Requirements *(mandatory)*

### Functional Requirements

#### Summary and legend

- **FR-001**: The Shifts tab MUST show a summary line above the calendar whenever the discharge has
  at least one shift.
- **FR-002**: On a planned discharge, the summary MUST read the shift count, the total planned
  duration followed by "planned", and the period from the first planned start to the last planned
  end ("5 shifts · 40 h planned · 27/09 06:00 → 29/09 22:00").
- **FR-003**: On an active discharge, the summary MUST read the shift count, the count of shifts in
  each status that has any (completed, active, planned), and the day and time the last shift ends
  ("14 shifts · 5 completed · 1 active · 8 planned · ends Fri 18 Sept, 22:00").
- **FR-004**: On a closed discharge, the summary MUST read the completed shift count, the total
  duration, and the period ("4 shifts completed · 32 h · 16/08 06:00 → 17/08 22:00").
- **FR-005**: When planned shifts have gaps, the summary MUST end with the total gap count in amber,
  with a warning icon ("· 1 gap", "· 3 gaps").
- **FR-006**: On a wide screen, a legend MUST explain the Expected start line, the hatched
  inter-shift break, and the trucks, warehouse doors, and weighing areas icons.

#### Calendar

- **FR-007**: The calendar MUST keep its current extent: a week at least, one column per day from
  midnight to midnight, opening on the day of the first shift or of the expected start when that
  comes first, with one more column per extra day.
- **FR-008**: Each column heading MUST read its date and, for the discharge's own days, its day
  number.
- **FR-009**: The calendar MUST show the full 24 hours of each day, with an hour gutter marking every
  two hours, without vertical scrolling on a typical laptop screen (at least 900 px of viewport height).
- **FR-010**: Every interval between one shift's end and the next shift's start MUST be drawn as a
  hatched inter-shift break, labelled once with its duration in a pill.
- **FR-011**: The expected start MUST be marked by a dashed line labelled "Expected start", drawn
  beneath the shift cards, unless the calendar opens on that exact instant.
- **FR-012**: On an active discharge, the current time MUST be marked by a line labelled "Now" and
  the time.
- **FR-013**: Drawing a period over the calendar with a mouse or a pen MUST keep opening Add shift
  with that period, for users allowed to add shifts, exactly as today.

#### Shift cards

- **FR-014**: Each shift card MUST read, in order of importance: its time range and duration; its
  status badge, or its gap badge when it has gaps; its responsible; and its counts of trucks,
  warehouse doors, and weighing areas, each beside its icon.
- **FR-015**: A planned shift with at least one gap MUST have an amber border and an amber
  "N gap(s)" badge with a warning icon.
- **FR-016**: Cards MUST be distinguished by status (active stands out, planned reads plainly,
  completed recedes), and the status MUST also be stated in text (badge or accessible name), so
  colour is never the only signal.
- **FR-017**: The continuation of a shift past midnight MUST read its time range followed by
  "(cont.)".
- **FR-018**: Each card MUST be a single control that opens the shift panel. Its accessible name MUST
  give the shift's day and time range, plus its gap count when it has gaps. Its accessible
  description MUST give its status, duration, responsible, and resource counts.

#### Shift panel

- **FR-019**: The shift panel MUST open as a side sheet (a bottom sheet on a narrow screen), titled by
  the shift's day and time range, with its status badge and the line "Shift <position> of <count> ·
  <vessel name>".
- **FR-020**: The panel MUST keep its current content (Responsible, Duration, planned and actual
  times, Started by, readiness statement, and resource groups with counts and periods), restyled to
  V2.
- **FR-021**: When every resource of a shift has been assigned since the same instant, the panel MUST
  state that instant once ("All resources since …"), rather than on each item.
- **FR-022**: A completed shift's panel MUST state "A completed shift cannot be changed" in its footer
  and offer Close. A planned shift's panel MUST offer Edit only to users allowed to correct it.

#### Edit shift and Add shift sheets

- **FR-023**: Edit shift MUST stay within the shift panel's sheet, reached by Edit and left by "Back to
  details", Cancel, or a save, as today.
- **FR-024**: Add shift MUST open as a side sheet from the tab's Add shift action or from a period
  drawn on the calendar, as today.
- **FR-025**: Both sheets MUST show a read-only Duration beside the planned start and end, updated as
  either changes.
- **FR-026**: Each resource group in both sheets MUST read "<selected> of <available> selected" and
  offer Select all.
- **FR-027**: When Add shift is pre-filled to follow the last shift, it MUST state where the new shift
  starts ("Starts when the last shift ends, on <day> at <time>.").
- **FR-028**: Both sheets MUST keep their fields, validation, refusals, permissions, idempotent
  submission, and post-save behavior unchanged.

#### Non-regression

- **FR-029**: The feature MUST NOT change any API contract, permission, business rule, or stored
  data. Everything shown MUST come from what the discharge detail already provides.
- **FR-030**: The Shifts tab MUST read the same on planned, active, and closed discharges, apart from
  the per-status differences stated above.

### Key Entities

- **Shift**: a work period of a discharge, known by its planned period. It has a status (planned,
  active, completed), a responsible, and resources (trucks, warehouse doors, weighing areas). A
  planned shift may have readiness gaps.
- **Inter-Shift Break**: the planned interval between two successive shifts. It is shown with its
  duration and is not a downtime.
- **Readiness gap**: a fact about a planned shift that it lacks a usable truck, warehouse door, or
  weighing area, or that its responsible is no longer eligible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the seeded planned, active, and closed discharges, the Shifts tab matches the
  retained V2 boards of the design reference in content, order, and wording, as judged by product
  review. Every difference is listed and accepted in the PR.
- **SC-002**: A user can tell how many shifts a discharge has, how long they last in total, and
  whether any planned shift has a gap from the summary line alone, without opening a shift.
- **SC-003**: A user can locate every planned shift with a gap in under 5 seconds on a discharge of up
  to 14 shifts.
- **SC-004**: On a 1440 × 900 screen, a full day from 00:00 to 24:00 is visible without vertical
  scrolling.
- **SC-005**: All existing automated tests and browser journeys for adding, inspecting, correcting,
  and drawing shifts pass with their observable behavior unchanged, adjusted only for wording and
  layout.
- **SC-006**: Every text and icon of the Shifts tab meets 4.5:1 contrast (3:1 for large text and
  non-text indicators) in both themes. The tab can be used with the keyboard alone, except for
  drawing a period, which stays a pointer shortcut.

## Assumptions

- The retained V2 boards are the visual reference. Their exact pixel sizes (for example six visible
  columns at 1440 px) are illustrative, and the existing "week at least" rule is kept.
- On a planned discharge every shift is planned, so a card with gaps shows its gap badge where the
  status badge would be, as the retained board does. A card without gaps keeps its "Planned" badge, as
  the issue lists status among the card's contents.
- Counts in summaries and badges use English singular and plural forms ("1 shift", "2 shifts",
  "1 gap", "2 gaps"). Durations use the existing shift duration format ("8 h", "7 h 30 min").
- The amber colour, hatching, card surfaces, and focus colour come from the V2 palette delivered by
  #314. No new colour token is introduced unless the palette lacks a warning tone.
- The Shifts tab's attention dot and count, the record header, and the start-blocking banner belong
  to #324 and are out of scope here.
- Observers see the same calendar, summary, and panel, without Add shift, Edit, or drawing, as today.

## Out of Scope

- Any change to shift rules: overlap, ordering, eligibility, gap computation, minimum break, or
  resource selection rules.
- The discharge record header, tab badges and attention dots, and the start-blocking banner (#324).
- The creation wizard's planned shifts step (#323).
- The active discharge overview (#328) and the closed discharge record (#329), beyond their Shifts
  tab.
- Removing, reordering, or replanning shifts from the calendar.

## Dependencies

- #314 / #333: V2 palette and authenticated shell (merged).
- Existing shift behavior specified in
  `specs/discharge-execution/shift-execution-and-downtimes/create-and-inspect-planned-shifts/spec.md`
  (GH-63), whose rules this feature restyles without changing them.
