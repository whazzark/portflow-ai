# Feature Specification: Wider Creation Wizard With a Shift Preview

**Feature Branch**: `feat/323-wider-creation-wizard-shift-preview`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "l'issue github 323" —
[#323 Wider creation wizard with a shift preview](https://github.com/whazzark/portflow-ai/issues/323)

**GitHub Issue**: [#323](https://github.com/whazzark/portflow-ai/issues/323)

**Parent Epic**: [#313 Interface V2](https://github.com/whazzark/portflow-ai/issues/313)

**Depends on**: [#314](https://github.com/whazzark/portflow-ai/issues/314) V2 palette and shell
(merged)

**Domain**: discharge-preparation

**Builds on**: `../prepare-a-discharge-with-product-lots-and-shifts/spec.md` (GH-53), which owns
what a creation records, who may create, the creation rules, and step-by-step validation. This
feature changes how the creation page is laid out and adds a read-only preview; it changes no
creation rule.

**Design reference**: [Portflow — Écrans canvas](https://claude.ai/artifact/1RyXTf3HKkxNHBS3ZVc3iT),
page **Discharges**, row *Création — /discharges/new*, retained V2 (*Retenue*, Option A):
« Étape 3 — Planned shifts » and « Étape 3 — plusieurs shifts ».

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plan Shifts Knowing When the Dock Is Free (Priority: P1)

As an operations lead preparing a discharge, when I reach the Planned shifts step I want to see,
above the shift form, how the dock I selected is occupied by other discharges, where my expected
start falls, and where the shifts I am entering land, so that I plan shifts that fit the dock's
free time instead of discovering a clash only when the discharge is started.

**Why this priority**: This is the only new capability of the issue. Today the creation page gives
no view of the dock's occupancy while shifts are planned, so a lead plans blind and learns about a
held dock only at start confirmation.

**Independent Test**: With an active discharge on dock A whose last planned shift ends on day D at
14:00, open the creation page, select dock A with an expected start on day D+2 at 06:00, add lots,
reach Planned shifts, enter two shifts, and verify that the preview above the form shows the other
discharge on dock A ending on D at 14:00, the Expected start marker on D+2 at 06:00, and both shifts
as separate blocks with the break between them visible, updating as each shift's dates change.

**Acceptance Scenarios**:

1. **Given** a creation that has reached the Planned shifts step, **When** the step opens, **Then**
   a « Shift preview » appears first, above the Planned shifts form, with a summary line naming the
   selected dock, when the dock is free from (when another discharge occupies it before the expected
   start), and the expected start.
2. **Given** other planned or active discharges assigned to the selected dock whose occupancy falls
   within the preview period, **When** the preview shows, **Then** each appears on the dock's row as
   a block naming its vessel and when it ends, and the time between them and this discharge reads as
   free dock time.
3. **Given** the expected start entered on the first step, **When** the preview shows, **Then** an
   Expected start marker is drawn at that moment, labelled with its time.
4. **Given** this discharge's planned shifts with a planned start and end, **When** the preview
   shows, **Then** each is a block on this discharge's row at its planned period, identified by its
   shift number, and any gap between two consecutive shifts is visible as an inter-shift break.
5. **Given** the user changes a shift's planned start or end, adds a shift, or removes one, **When**
   the change is made, **Then** the preview reflects it without leaving the step.
6. **Given** a shift with no complete period yet, **When** the preview shows, **Then** that shift is
   not drawn as a period; the preview indicates it has no period yet rather than guessing one.
7. **Given** this discharge's row, **When** shifts have periods, **Then** its label carries the
   vessel name entered on the first step and a summary of the shift count and total planned hours.
8. **Given** a selected dock with no other discharge occupying it in the preview period, **When**
   the preview shows, **Then** the dock's row shows the dock free over the whole period and the
   summary line does not claim a « free from » moment.

---

### User Story 2 - Work Through the Wizard on the Full Content Width (Priority: P2)

As an operations lead, I want the three creation steps to use the full width of the content area,
with a stepper that shows each step's number and name and a footer that keeps the creation's
totals and its actions in reach, so that wide rows (shift periods, responsible, duration) and the
preview fit without cramping.

**Why this priority**: It is the V2 restyle that makes room for the preview and aligns the page
with the V2 shell, but the creation already works without it.

**Independent Test**: Open the creation page on a wide screen, walk the three steps, and verify each
step spans the content width, the stepper shows only numbers and names (no « Step X of 3 »), and
the footer stays visible at the bottom with lots · tonnage · shifts · planned period and Cancel,
Back (from step 2), and Next or Create discharge.

**Acceptance Scenarios**:

1. **Given** the creation page on a wide screen, **When** any step shows, **Then** its content spans
   the full content width of the V2 shell instead of a narrow centered column.
2. **Given** any step, **When** the stepper shows, **Then** it shows each step's number (or a
   completed mark) and name, the current step marked as current, and no « Step X of 3 » text at any
   width.
3. **Given** any step, **When** the page shows, **Then** a footer stuck to the bottom of the page
   shows the number of lots, the total expected tonnage, the number of shifts, and the planned
   period (or that there is no planned period yet), followed by Cancel, Back (except on the first
   step), and Next to the following step or Create discharge on the last step.
4. **Given** the Planned shifts step and its preview, **When** the step shows, **Then** no
   informational footnote appears under the Planned shifts form or under the preview, and the
   Planned shifts description no longer carries the sentence about new shifts starting when the last
   one ends.
5. **Given** the existing step navigation, validation, and creation behavior, **When** the user
   walks the wizard, **Then** they behave exactly as before (reached steps reopen from the stepper,
   Next is offered only once the step on screen is valid, refusals open the step holding the
   faulty field).

---

### User Story 3 - Plan Many Shifts Without Losing the Preview (Priority: P3)

As an operations lead entering a long discharge with many shifts, I want the page itself to scroll
under the sticky footer while the preview stays first on the step, so that every shift row stays
reachable and the footer actions never cover them.

**Why this priority**: It matters only for long discharges, and only refines how the P1 and P2
layout behaves when content grows.

**Independent Test**: Enter eight shifts on the Planned shifts step and verify the page scrolls,
the preview stays above the form at the top of the step, the last shift row and Add shift can be
scrolled clear of the footer, and the footer stays visible.

**Acceptance Scenarios**:

1. **Given** more shifts than fit on screen, **When** the user scrolls, **Then** the whole page
   scrolls under the sticky footer; the preview is not pinned and remains the first thing on the
   step.
2. **Given** the page scrolled to its end, **When** the last shift row and Add shift show, **Then**
   neither is hidden behind the footer.
3. **Given** many shifts, **When** the preview shows, **Then** every shift with a period is drawn and
   still distinguishable by its number, with breaks between consecutive shifts still visible.

### Edge Cases

- **No other discharge on the dock**: the dock row reads free over the whole period (Story 1,
  scenario 8).
- **Another discharge's occupancy overlaps this discharge's expected start or shifts**: both are
  drawn as they are; the preview informs and never blocks Next or Create discharge. Start
  confirmation rules (GH-56) stay the only enforcement.
- **Occupancy outside the preview period**: an occupancy that starts before or ends after the period
  is drawn clipped to the period; occupancies entirely outside it are not drawn.
- **Closed discharges** on the dock are not occupancy and are not drawn.
- **No shift with a period yet**: the preview still shows the dock row and the Expected start marker;
  the period is sized around the expected start and the other discharges near it.
- **Shifts far from the expected start**: the period grows to include every shift with a period, the
  expected start, and the occupancy it shows.
- **The dock or expected start is changed** by going back to the first step: the preview shows the
  newly selected dock's occupancy and the new expected start on return.
- **Occupancy cannot be loaded**: the preview says the dock's occupancy is unavailable and offers to
  retry, while still drawing the expected start and this discharge's shifts; the form remains usable
  and creation is not blocked.
- **Narrow screens**: the stepper keeps numbers and names readable or visually hidden-but-announced
  names as today, without « Step X of 3 »; the preview stays readable by scrolling it horizontally
  within its own box rather than scrolling the page sideways.
- **Times** are shown in the site's local time, consistently with the shift fields and footer.

## Requirements *(mandatory)*

### Functional Requirements

**Layout**

- **FR-001**: The creation page MUST lay out its three steps (Vessel and dock, Product lots, Planned
  shifts) on the full content width of the V2 authenticated shell.
- **FR-002**: The stepper MUST show each step's number (or a completed mark for a reached step) and
  name, mark the current step, and MUST NOT show « Step X of 3 » at any width. Existing stepper
  navigation rules are unchanged.
- **FR-003**: A footer MUST stay stuck to the bottom of the page on every step, showing the lot
  count, total expected tonnage, shift count, and planned period (or that none exists yet), then
  Cancel, Back (not on the first step), and Next to the following step or Create discharge on the
  last step.
- **FR-004**: When the content is taller than the screen, the page MUST scroll under the sticky
  footer and every row and action MUST remain reachable above it.
- **FR-005**: The Planned shifts step MUST NOT show an informational footnote under the form or under
  the preview; its description reads « The periods the discharge will be worked, each with its
  responsible. »

**Shift preview**

- **FR-006**: The Planned shifts step MUST show a « Shift preview » as its first element, above the
  Planned shifts form; it scrolls with the page and is not pinned.
- **FR-007**: The preview MUST show a summary line with the selected dock's name, « free from » the
  end of the latest other discharge occupancy ending at or before the expected start (only when
  there is one), and the expected start.
- **FR-008**: The preview MUST show a legend distinguishing other discharges, planned shifts, and the
  Expected start marker.
- **FR-009**: The preview MUST show a timeline whose period, at day granularity with each day
  labelled, covers the expected start, every shift of this discharge that has a complete period, and
  the occupancy of other discharges adjacent to them, with a minimum span of one week.
- **FR-010**: The preview MUST show a dock row drawing, for each other planned or active discharge
  assigned to the selected dock whose occupancy intersects the period, a block from the start to
  the end of its occupancy, naming its vessel and when it ends; free time on the dock MUST read as
  free.
- **FR-011**: A discharge's occupancy MUST be the span from its earliest planned shift start to its
  latest planned shift end; closed discharges and the discharge being created are not other
  occupancy.
- **FR-012**: The preview MUST show an Expected start marker at the expected start entered on the
  first step, labelled with its time.
- **FR-013**: The preview MUST show a row for this discharge, labelled with its vessel name and,
  once shifts have periods, their count and total planned hours, drawing each shift with a complete
  period as a block at that period identified by its shift number, so that breaks between
  consecutive shifts appear as gaps.
- **FR-014**: A shift without a complete period MUST NOT be drawn as a period; the preview MUST
  indicate that it has no period yet.
- **FR-015**: The preview MUST update as shifts are added, removed, or their planned start or end
  changes, and MUST reflect the dock and expected start currently selected on the first step.
- **FR-016**: The preview MUST be informational only: it MUST NOT validate, block, or alter Next,
  Create discharge, or any creation rule.
- **FR-017**: When the occupancy of the selected dock cannot be obtained, the preview MUST say so and
  offer a retry, while still showing the expected start and this discharge's shifts; the form MUST
  remain usable.
- **FR-018**: Each preview block MUST expose its meaning to assistive technology (vessel and end of an
  occupancy; shift number and period of a shift), and the timeline MUST NOT rely on color alone to
  distinguish other discharges from planned shifts.

**Data and access**

- **FR-019**: The occupancy of a dock MUST be readable by every user allowed to create a discharge
  (operations leads, operations admins, organization admins), and MUST be the authoritative state
  held by the system at the time the Planned shifts step opens; it is read again whenever the step is
  opened.
- **FR-020**: The occupancy read MUST expose only what the preview needs for each other discharge:
  its identity, vessel name, status, and occupancy start and end.

### Key Entities

- **Dock occupancy**: for a dock, the other planned or active discharges assigned to it, each with
  its vessel name, status, and occupancy span (earliest planned shift start to latest planned shift
  end). Read-only, derived from existing discharges and their planned shifts.
- **Shift preview**: a read-only view of the selected dock's occupancy, this discharge's expected
  start, and its draft planned shifts over a period sized to them. Nothing in it is stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the Planned shifts step, a lead can tell from the preview alone, without leaving the
  creation page, whether the dock is occupied by another discharge at the expected start and at each
  planned shift, in 100% of the acceptance scenarios.
- **SC-002**: Every change to a shift's period, and every added or removed shift, is reflected in the
  preview within one second of the change.
- **SC-003**: With eight or more shifts, every shift row and Add shift remain reachable above the
  sticky footer, and the preview remains the first element of the step.
- **SC-004**: The stepper never shows « Step X of 3 », and no footnote appears under the Planned
  shifts form or the preview, at any screen width.
- **SC-005**: Existing creation journeys (create with lots and shifts, step validation, refusals
  reopening the faulty step) pass unchanged.

## Assumptions

- The occupancy shown is advisory. Which discharges actually block a start remains governed by the
  start confirmation (GH-56): only an active discharge holding the dock blocks; planned ones are
  shown because they compete for the same dock time.
- A discharge's occupancy is its planned period (earliest planned shift start to latest planned
  shift end), the same « planned period » the footer and the V2 record header use. For an active
  discharge, its planned shifts likewise bound its occupancy; actual execution times are out of
  scope.
- The API does not expose other discharges' planned periods per dock today (the discharges list
  carries only the expected start and a shift count), so this feature includes the read-only
  occupancy read the preview needs. Issue #324 (planned discharge dock timeline) needs the same
  occupancy; the plan should define it once so both reuse it.
- Inter-shift breaks are shown as visible gaps between consecutive shift blocks; no break duration
  label is required in the preview.
- The vessel name on this discharge's row falls back to a neutral label (« This discharge ») when
  none has been entered yet.
- Step navigation, validation, refusal handling, and the content of steps 1 and 2 are unchanged
  apart from their width; their restyle follows the V2 palette and shell from #314.
- The creation page keeps its current address, roles, and success behavior from GH-53.
