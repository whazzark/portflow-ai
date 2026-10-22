# Feature Specification: Truck pool floating bulk actions

**Feature Branch**: `feat/326-truck-pool-floating-bulk-actions`

**Created**: 2026-10-22

**Status**: Draft

**Input**: GitHub issue [#326 Truck pool floating bulk actions](https://github.com/whazzark/portflow-ai/issues/326), child of epic #313 "Interface V2", depending on #314 (V2 palette and authenticated shell, merged in #333). Design reference: the *Retenue* artboards of the **Discharges** page in the "Portflow — Écrans canvas" design canvas (planned truck pool, Also held by, withdraw dialog, add trucks sheet).

## Context

The Truck pool section of a planned discharge already lets a preparer reserve trucks through the
Add trucks sheet, select held trucks, and withdraw one or several of them after a confirmation
that names the planned shifts losing them. Today the bulk withdrawal is a `Withdraw (n)` button in
the section header: once the preparer scrolls down a long pool to select trucks, the action has
scrolled out of view, there is no way to clear the selection other than unchecking every row, and
the "Also held by" competition is visible only by hovering each warning icon.

This feature restyles the planned truck pool to the retained V2 design. It changes how the pool is
read and acted on, not what a reservation or a [Truck Pool Withdrawal](../../../../CONTEXT.md) is:
the existing reservation and withdrawal rules, refusals, and permissions stay unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Withdraw selected trucks from a floating action bar (Priority: P1)

A preparer reviewing a planned discharge's truck pool checks the trucks to withdraw anywhere in
the table. A floating action bar appears at the bottom of the content area, stays in view while
they scroll, states how many trucks are selected, and offers **Clear** and **Withdraw**. Withdraw
opens the existing confirmation; Clear empties the selection and the bar disappears.

**Why this priority**: This is the problem the issue names: the bulk action scrolls away from the
rows being selected. It is the core of the outcome and is usable on its own.

**Independent Test**: On a planned discharge with more trucks than fit on screen, select a truck
near the bottom of the pool, confirm the bar is visible without scrolling back up, withdraw
through it, and confirm the trucks leave the pool and the bar disappears.

**Acceptance Scenarios**:

1. **Given** a preparer on a planned discharge with held trucks and no selection, **When** they
   check one truck, **Then** a floating bar appears at the bottom of the content area reading
   « 1 truck selected » with **Clear** and **Withdraw** actions.
2. **Given** the bar shows 2 selected trucks, **When** the preparer checks a third, **Then** the
   bar reads « 3 trucks selected »; it never lists the registrations of the selected trucks.
3. **Given** the bar is visible, **When** the preparer scrolls the page, **Then** the bar stays
   anchored at the bottom of the content area and does not cover the application sidebar.
4. **Given** the bar is visible, **When** the preparer chooses **Clear**, **Then** every truck is
   unchecked, the "select all" checkbox is unchecked, and the bar disappears.
5. **Given** the bar is visible, **When** the preparer unchecks the last selected truck (one by
   one or through "select all"), **Then** the bar disappears.
6. **Given** 2 trucks selected, **When** the preparer chooses **Withdraw**, **Then** the
   withdrawal confirmation opens for exactly those 2 trucks.
7. **Given** the preparer confirms the withdrawal, **When** it succeeds, **Then** the trucks leave
   the pool, the selection is emptied, the bar disappears, and the success message appears as
   today.
8. **Given** the preparer cancels the withdrawal confirmation, **When** the dialog closes, **Then**
   the selection and the bar remain as they were.
9. **Given** a selected truck is withdrawn by someone else and disappears on refresh, **When** the
   pool updates, **Then** the bar's count drops accordingly and the bar disappears if nothing
   remains selected.
10. **Given** a user who cannot correct the discharge (not a preparer, or the discharge is no
    longer planned), **When** they view the truck pool, **Then** no selection checkboxes, no
    per-row withdraw action, and no floating bar are offered.

---

### User Story 2 - Read the pool's state and competition at a glance (Priority: P2)

Above the table, a summary line states how many trucks the discharge holds and how many of them
are suspended (« 9 trucks reserved · 1 suspended »). When at least one held truck is also held by
another planned discharge, a hint explains that competition (« Also held by planned discharges: the
first to start keeps the truck »). On the affected row, the warning icon next to the registration
opens a popover listing the other discharges holding that truck and their status.

**Why this priority**: It replaces hover-only discovery of conflicts with information visible on
arrival, but the pool is still usable without it.

**Independent Test**: On a planned discharge whose pool contains a suspended truck and a truck also
reserved by another planned discharge, read the summary line and hint, then open the warning icon's
popover by click and by keyboard and read the competing discharges.

**Acceptance Scenarios**:

1. **Given** a planned discharge holding 9 trucks, 1 of them suspended, **When** the truck pool is
   displayed, **Then** the summary line reads « 9 trucks reserved · 1 suspended ».
2. **Given** a planned discharge holding 1 truck and none suspended, **When** the pool is
   displayed, **Then** the summary line reads « 1 truck reserved » with no suspended part.
3. **Given** at least one held truck is also held by another discharge, **When** the pool is
   displayed, **Then** the « Also held by » hint appears above the table with the warning icon.
4. **Given** no held truck is held by another discharge, **When** the pool is displayed, **Then**
   no « Also held by » hint is shown.
5. **Given** a row whose truck is also held by MV Timeline Multi-Jours (Planned) and MV Nordic
   Breeze (Planned), **When** the user clicks or activates the warning icon with the keyboard,
   **Then** a popover titled « Also held by » lists both discharges with their status and explains
   that only one active discharge can hold a truck, so starting a discharge settles it.
6. **Given** the popover is open, **When** the user presses Escape or clicks elsewhere, **Then**
   it closes and focus returns to the warning icon.
7. **Given** a suspended held truck, **When** the pool is displayed, **Then** its row shows a
   « Suspended » marker next to the registration.

---

### User Story 3 - Withdraw and reserve with the V2 dialog and sheet (Priority: P3)

The withdrawal confirmation and the Add trucks sheet adopt the retained V2 layout. The
confirmation names the trucks, the discharge whose pool they leave, and the planned shifts that
lose them. The Add trucks sheet groups the trucks not in the pool by transport company, shows how
many are selected in each group, and states inline which other discharges already hold a candidate.

**Why this priority**: These surfaces already work; this story aligns their presentation and
wording with V2 and makes conflict information readable without hovering.

**Independent Test**: Withdraw a truck used by two planned shifts and read the confirmation; open
Add trucks, search, select trucks in two companies, and reserve them.

**Acceptance Scenarios**:

1. **Given** truck AA-101-PF is used by 2 planned shifts of MV Atlantic Dawn, **When** the
   preparer asks to withdraw it, **Then** the confirmation is titled « Withdraw AA-101-PF? », says
   it leaves the pool of MV Atlantic Dawn and is also removed from the 2 shifts that use it, and
   lists those shifts chronologically by period.
2. **Given** 3 trucks selected, none used by a planned shift, **When** the preparer chooses
   Withdraw, **Then** the confirmation is titled « Withdraw 3 trucks? », names the 3 registrations,
   and shows no shift list.
3. **Given** the withdrawal is refused because the discharge is no longer planned, **When** the
   refusal arrives, **Then** the confirmation closes and the existing "discharge started" message
   is shown, as today.
4. **Given** the Add trucks sheet is open, **When** candidates are listed, **Then** they are grouped
   by transport company, each group header shows its name and its truck count, and the sheet
   states how many trucks are not in the pool.
5. **Given** the preparer has selected trucks in a group, **When** the group header is displayed,
   **Then** it shows « n of m » selected for that group, and the sheet footer shows the total
   selected with **Cancel** and **Add trucks**.
6. **Given** a candidate held by another discharge, **When** it is listed, **Then** its row states
   « Held by <vessel names> · <status> » inline, without requiring a hover.
7. **Given** the preparer searches the sheet, **When** a group has no matching candidate, **Then**
   that group is not shown, and the existing search, select-all-visible, refusal and retry
   behaviors are unchanged.

---

### Edge Cases

- A pool with a single held truck: the summary reads « 1 truck reserved » and the bar reads
  « 1 truck selected ».
- A pool where every truck is selected: the "select all" checkbox is checked, the bar shows the full
  count, and Clear unchecks everything.
- A partial selection: the "select all" checkbox shows a mixed state.
- A planned discharge with released history rows: none can be selected, and they count neither in
  the summary nor in the bar.
- A preparer opens the per-row withdraw action while a bulk selection exists: the confirmation
  concerns only that row's truck; on success the withdrawn truck leaves the selection and the bar
  keeps the remaining count.
- The floating bar never hides the last rows of the table: the content leaves room below the
  table while the bar is shown.
- The selection is per visit: leaving the discharge or switching section tab clears it.
- An empty pool: the empty state and its Add trucks action are shown; no summary line, hint, or bar.
- Narrow (phone-width) viewport: the bar stays within the content width, its actions remain
  reachable, and the count does not wrap onto the actions.
- Active and closed discharges: their read-only truck pools are out of scope here and keep their
  current behavior (no selection, no bar).

## Requirements *(mandatory)*

### Functional Requirements

**Floating bulk action bar**

- **FR-001**: The truck pool of a planned discharge MUST, for a user allowed to correct it, show a
  floating action bar anchored at the bottom of the content area whenever at least one held truck
  is selected, and MUST hide it when the selection becomes empty.
- **FR-002**: The bar MUST state « n truck(s) selected » with correct singular and plural, and MUST
  NOT list the selected trucks' registrations.
- **FR-003**: The bar MUST offer **Clear**, which empties the selection, and **Withdraw**, which
  opens the withdrawal confirmation for exactly the selected held trucks.
- **FR-004**: The bar MUST remain visible while the page scrolls, MUST stay within the content
  area (never over the application sidebar), and MUST NOT permanently hide table rows beneath it.
- **FR-005**: The section header MUST no longer carry the `Withdraw (n)` button; **Add trucks**
  remains in the header.
- **FR-006**: The bar MUST be exposed to assistive technology as a toolbar named for the selected
  trucks, its actions MUST be keyboard reachable, and a hidden bar MUST not be focusable.
- **FR-007**: The selection MUST only contain trucks the discharge still holds; a truck that
  leaves the pool for any reason MUST leave the selection and the count.

**Summary, hint, and popover**

- **FR-008**: Above the table, the pool MUST show a summary line « n truck(s) reserved » counting
  held trucks, followed by « · n suspended » only when at least one held truck is suspended.
- **FR-009**: When at least one held truck is also held by another discharge, the pool MUST show
  a hint with a warning icon: « Also held by planned discharges: the first to start keeps the
  truck » when every other holder is planned, or « Also held by other discharges: a truck can serve
  only one active discharge » when one of them is active (amended at plan review, research R6);
  otherwise the hint MUST be absent.
- **FR-010**: The warning icon on an affected row MUST open, on click and on keyboard activation, a
  popover titled « Also held by » listing each other discharge holding the truck with its vessel
  name and status, and the sentence explaining that starting a discharge settles the competition.
  The popover MUST close on Escape or outside click and return focus to the icon.
- **FR-011**: A held suspended truck MUST show a « Suspended » marker beside its registration.
- **FR-012**: The table MUST show, for each truck, the number of planned shifts currently using it
  (Shifts column), with the existing Registration, Transport company, Reserved, and Released
  columns, held trucks first and released history after.

**Withdrawal confirmation and Add trucks sheet**

- **FR-013**: The withdrawal confirmation MUST name the truck (one) or the count and registrations
  (several), the discharge whose pool they leave, and, when any, the planned shifts that lose them
  with their count, in chronological order.
- **FR-014**: The Add trucks sheet MUST group candidates by transport company with a per-group
  count, show « n of m » selected per group when some are selected, show the number of trucks not
  in the pool, and state each candidate's other holdings inline as « Held by … · status ».
- **FR-015**: Reservation and withdrawal rules, refusals, permissions, success and error messages
  other than the wording listed above MUST remain unchanged.
- **FR-016**: Every surface in this feature MUST use the V2 palette and shell delivered by #314 and
  render correctly in both light and dark themes.

### Key Entities

- **Truck pool entry**: a truck reserved for the discharge, with registration, transport company,
  service status (available or suspended), reservation and release times, the other discharges
  holding it, and the planned shifts using it. All already present in the discharge detail.
- **Truck selection**: the transient set of held trucks a preparer has checked during the visit;
  never persisted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With a pool of at least 20 trucks, a preparer can select a truck at the bottom of the
  table and start its withdrawal without scrolling back up (0 scroll actions between selecting and
  choosing Withdraw).
- **SC-002**: A preparer can empty a selection of any size in one action.
- **SC-003**: On opening a planned truck pool, a reader can tell how many trucks are reserved, how
  many are suspended, and whether any is contested by another discharge without hovering or
  opening anything.
- **SC-004**: Every action in the bar, the popover, the confirmation, and the sheet can be
  completed with the keyboard alone.
- **SC-005**: Existing reservation and withdrawal journeys (including refusals and stale-state
  handling) keep passing unchanged.

## Assumptions

- Only planned discharges' truck pools are in scope. The active and closed truck pool restyles in
  the design canvas belong to the active and closed discharge issues (#328, #329).
- The Shifts column (FR-012) is taken from the retained V2 design even though the issue's
  acceptance criteria do not name it; it is derived from data the discharge detail already holds.
  The reviewer may remove it from scope.
- The floating bar reuses the floating bulk-action pattern already used by the site reference
  workbenches, so bulk actions look and behave alike across the application. The truck pool bar
  uses the labels « n trucks selected », « Clear », and « Withdraw » from the V2 design.
- Section tab counts and the planned discharge header shown on the artboards belong to other
  issues (#324) and are not part of this feature.
- No API change is needed: every displayed fact is already returned by the discharge detail and
  truck candidates.
- Who may select and withdraw is unchanged: a preparer allowed to correct a planned discharge.
