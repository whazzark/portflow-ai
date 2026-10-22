# Feature Specification: Product Lots Grouped by Customer

**Feature Branch**: `feat/325-product-lots-grouped-by-customer`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "l'issue github 325" — Product lots do not make missing or conflicting
warehouse doors visible at a glance. Product lots are grouped by customer with subtotals, and door
problems are shown on each lot with a direct Assign doors action. Acceptance: customer rows with
subtotal and Edit; lot rows with product, description, expected quantity and door chips; expected
total. « No door » and « Held by … » in amber with Assign doors. Lot menu (Edit, Assign doors,
Remove); Assign doors dialog with available doors grouped by warehouse and doors assigned to the
lot. Edit lot, edit a customer's lots and add lots in sheets.

**Feature ID**: `GH-325`

**GitHub Issue**: [#325](https://github.com/whazzark/portflow-ai/issues/325)

**Parent Epic**: [#313](https://github.com/whazzark/portflow-ai/issues/313) — Interface V2

**Depends on**: [#314](https://github.com/whazzark/portflow-ai/issues/314) — V2 palette and
authenticated shell (merged)

**Design reference**: Portflow — Écrans canvas, page **Discharges**, the *Retenue* artboards
`planned-product-lots`, `planned-lot-menu`, `planned-assign-doors`, `planned-lot-edit-sheet`,
`planned-customer-lots-edit-sheet`, `planned-add-lots-sheet`, `active-product-lots`, and
`closed-product-lots`.

**Domain**: discharge-preparation (web presentation only)

**Builds on**: the behaviors already specified in
`specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/` —
`prepare-a-discharge-with-product-lots-and-shifts`, `correct-a-customers-product-lots-at-once`,
`plan-warehouse-door-and-checkpoint-assignments`, and
`confirm-discharge-start-with-atomic-conflict-protection`. Their business rules are unchanged; this
feature changes how the Product lots tab presents and reaches them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Every Lot's Door Problem at a Glance (Priority: P1)

As an operations lead or administrator preparing a discharge, I want the Product lots tab to show,
on each lot, whether it has no warehouse door or a door held by another discharge, and to summarize
how many lots are affected, so that I know what still blocks the start without opening the start
confirmation or each lot's doors.

**Why this priority**: This is the problem the issue states. Today a lot without a door shows a
quiet dash, and a door held by an active discharge looks like any other door: the operator only
learns about them when trying to start the discharge.

**Independent Test**: On a planned discharge where one lot has no door, one lot has a door held by
an active discharge, and one lot has a usable door, open the Product lots tab and verify that the
first two lots carry an amber « No door » and « Held by <vessel> » indicator respectively, the third
carries none, and the summary above the table reads one lot without a door and one door held by
another discharge.

**Acceptance Scenarios**:

1. **Given** a planned discharge with a lot that has no current warehouse door, **When** any user
   who can read the discharge opens its Product lots tab, **Then** that lot's door cell shows
   « No door » in the amber warning tone instead of a dash.
2. **Given** a planned discharge with a lot whose current door is also currently assigned to an
   active discharge, **When** a user allowed to prepare discharges opens the tab, **Then** that door's chip shows the door in the
   amber warning tone together with « Held by <vessel name of the holding discharge> ».
3. **Given** a lot with several doors of which only one is held, **When** the tab is opened,
   **Then** only the held door carries the « Held by … » indicator; the others look as usual.
4. **Given** a planned discharge with door problems, **When** the tab is opened, **Then** a summary
   above the table states the number of lots, the number of customers, and the expected total, and
   then, only when non-zero, « N lots without a door » and « N doors held by another discharge ».
5. **Given** a planned discharge without any door problem, **When** the tab is opened, **Then** the
   summary states only the lots, customers, and expected total, and no lot carries an amber
   indicator.
6. **Given** the indicators shown on the tab, **When** the user opens the start confirmation,
   **Then** every lot flagged « No door » there is reported as having no warehouse door, and every
   door flagged « Held by … » is reported as held by the same discharge: the tab and the start
   confirmation never disagree.
7. **Given** a user who fixes a door problem (assigns a door, removes the held door), **When** the
   change is saved, **Then** the lot's indicator and the summary counts update without reloading the
   page.

---

### User Story 2 - Fix a Door Problem in One Step (Priority: P1)

As an operations lead or administrator, I want a direct Assign doors action on each lot that has a
door problem, and an Assign doors dialog that shows the available doors by warehouse beside the
doors the lot already has, so that I go from seeing a problem to fixing it without hunting through
menus.

**Why this priority**: Seeing a problem without a direct path to fix it only half-solves the issue.
The Assign doors dialog already exists; it must be reachable from the problem itself and say why a
door is a problem.

**Independent Test**: On a planned discharge, click Assign doors on a lot flagged « No door », add an
available door, save, and verify the indicator disappears; then open Assign doors on a lot flagged
« Held by … » and verify the held door explains which discharge holds it and that it blocks the
start.

**Acceptance Scenarios**:

1. **Given** a user allowed to prepare discharges on a planned discharge, **When** a lot shows
   « No door » or « Held by … », **Then** an Assign doors action is offered right beside the
   indicator, and it opens that lot's Assign doors dialog.
2. **Given** an observer, **When** they read a lot without a door, **Then** the amber « No door »
   indicator is shown but no Assign doors action is offered; « Held by … » is not shown to them
   (see Assumptions).
3. **Given** the Assign doors dialog opened for a lot, **When** it is shown, **Then** its title names
   the lot by customer, product, and expected quantity, and it shows two lists: the available doors,
   grouped under their warehouse with a count and a search, and the doors assigned to this lot, with
   a count.
4. **Given** an available door, **When** it is listed, **Then** it states how many other discharges
   it is also planned on, when any, and, when another lot of this discharge holds it, which lot
   (customer · product); each available door offers Add.
5. **Given** a door assigned to the lot that is held by an active discharge, **When** it is listed,
   **Then** it states the holding discharge and its status, and that it blocks this discharge's start
   until that discharge releases it.
6. **Given** a door assigned to the lot that planned shifts use, **When** it is listed, **Then** it
   states how many shifts use it and lists them, and its removal is blocked until it is removed from
   those shifts, as today.
7. **Given** the dialog, **When** the user has not changed anything, **Then** it says no change has
   been made yet; once doors are added or removed, it summarizes the pending changes before Save.
8. **Given** the dialog, **When** it is shown, **Then** it reminds the user that a door serves one lot
   of a discharge at a time and that several planned discharges may share a door, the first to start
   using it.
9. **Given** a narrow (phone-width) screen, **When** the dialog is shown, **Then** the two lists are
   reachable one at a time, as today.

---

### User Story 3 - Read a Discharge's Lots Customer by Customer (Priority: P2)

As any user who can read a discharge, I want its product lots grouped under their customer, each
customer with its lot count and subtotal, each lot with its product, description, expected quantity,
and door chips, and the expected total at the bottom, so that I read the cargo the way the manifest
is organized.

**Why this priority**: The grouping exists today; the V2 restyles it and adds the description and the
summary. It frames the problem indicators but delivers less on its own.

**Independent Test**: On a discharge with three customers, one having two lots, verify the three
customer rows, each with its lot count and subtotal, the lots under each, the
expected total, and that subtotals add up to the total.

**Acceptance Scenarios**:

1. **Given** a discharge with product lots, **When** its Product lots tab is opened, **Then** each
   customer appears as a row naming the customer, its number of lots, and the subtotal of their
   expected quantities, followed by its lots.
2. **Given** a lot row, **When** it is shown, **Then** it shows the product name, the description
   beneath it when there is one, the expected quantity in tonnes, and the lot's current doors as
   chips.
3. **Given** a lot with more doors than fit on its row, **When** it is shown, **Then** the remaining
   doors are reachable from a « +N » control, as today.
4. **Given** the table, **When** it ends, **Then** an Expected total row shows the discharge's
   expected tonnage, equal to the sum of the subtotals.
5. **Given** a planned discharge and a user allowed to prepare discharges, **When** the tab is
   opened, **Then** each customer row offers Edit and each lot row offers an actions menu with Edit,
   Assign doors, and Remove; an Add product lots action is offered for the tab.
6. **Given** an observer, or any user on an active or closed discharge, **When** the tab is opened,
   **Then** no Edit, actions menu, Assign doors, or Add product lots action is offered.
7. **Given** an active discharge, **When** the tab is opened, **Then** it states that the lots are
   read-only while the discharge is active, and no amber door problem indicator is shown.
8. **Given** a discharge with no product lot, **When** the tab is opened, **Then** an empty state
   says so and, for a user allowed to prepare it, offers Add product lots.

---

### User Story 4 - Edit, Correct, and Add Lots in Sheets (Priority: P2)

As an operations lead or administrator, I want to edit one lot, correct all of a customer's lots, and
add new lots in side sheets that keep the lots table in view, with running totals, so that I change
the preparation without losing sight of the discharge.

**Why this priority**: These corrections already exist; the V2 restyles them and adds totals and the
lot's doors in context. It completes the tab's redesign but is not where the reported problem lies.

**Independent Test**: Open the lot menu's Edit on a lot with a held door and verify the sheet shows
the lot's doors with their indicator and an Assign doors link but no door fields; open a customer's
Edit, change a quantity and verify the running total; open Add product lots, add two products and
verify the running count and total.

**Acceptance Scenarios**:

1. **Given** a lot's Edit, **When** the sheet opens, **Then** it lets the user correct the customer,
   product name, expected quantity, and description, and it shows the lot's current doors, with their
   problem indicators, read-only, an Assign doors action, and a note that doors are changed from
   Assign doors rather than from this form.
2. **Given** a lot's Edit sheet, **When** the user chooses Assign doors, **Then** the lot's Assign
   doors dialog opens.
3. **Given** a customer's Edit, **When** the sheet opens, **Then** it shows the customer with its
   current subtotal and every lot of that customer, lets the user correct, add, and remove lots, and
   shows a running « N lots · total » that follows the edits before saving.
4. **Given** Add product lots, **When** the sheet opens, **Then** it lets the user add lots customer by
   customer, with Add product within a customer and Add customer for another one, and shows a running
   « N lots · total », with a dash for the total while no quantity is entered.
5. **Given** any of these sheets, **When** the user saves, **Then** the same validation, atomicity,
   refusal, and permission rules as today apply, and the table, subtotals, expected total, problem
   indicators, and summary reflect the result without reloading.

---

### Edge Cases

- A lot that has had doors but has none now on a planned discharge shows « No door », the same as a
  lot that never had one.
- A lot whose only door is archived keeps today's archived marking on the chip; whether it also reads
  as a problem follows what the start confirmation reports for that lot, so the tab and the start
  confirmation stay consistent.
- A door held by an active discharge that is no longer readable by name is shown as held by
  « another active discharge ».
- When the door-problem information cannot be loaded, the lots, subtotals, and total are still shown;
  the indicators and the problem counts are left out rather than shown wrongly as « no problem ».
- A discharge that starts or is withdrawn while the tab is open: the next save is refused as today,
  and the tab then shows the discharge's current status, with or without actions accordingly.
- Several lots of the same discharge cannot share a door; a door already held by another lot of this
  discharge is shown as such in the Assign doors dialog and taking it moves it, as today.
- A customer whose name is long, or a lot whose description is long, wraps without pushing the
  quantity and door columns out of view.
- Indicators are not conveyed by color alone: « No door » and « Held by … » are written out, so they
  are perceivable without the amber tone and by assistive technologies.

## Requirements *(mandatory)*

### Functional Requirements

**Table layout**

- **FR-001**: The Product lots tab MUST group a discharge's lots by customer, one customer row per
  customer, showing the customer's name, its number of lots, and the subtotal of its lots' expected
  quantities, followed by that customer's lots.
- **FR-002**: Each lot row MUST show the product name, the description beneath it when present, the
  expected quantity in tonnes, and the lot's current warehouse doors as chips, overflowing into a
  « +N » control when they do not fit.
- **FR-003**: The table MUST end with an Expected total equal to the discharge's expected tonnage.
- **FR-004**: Above the table, the tab MUST show a summary with the number of lots, the number of
  customers, and the expected total.
- **FR-005**: The tab MUST follow the V2 palette and authenticated shell delivered by #314.

**Door problems (planned discharges only)**

- **FR-006**: On a planned discharge, a lot without any current warehouse door MUST show « No door »
  in the amber warning tone.
- **FR-007**: On a planned discharge, a current door of a lot that is held by an active discharge
  MUST show « Held by <vessel name> » in the amber warning tone on that door's chip, for users
  allowed to prepare and start the discharge.
- **FR-008**: The lots and doors flagged by FR-006 and FR-007 MUST be exactly those the start
  confirmation reports as « lot without warehouse door » and « warehouse door held » for this
  discharge at the same moment.
- **FR-009**: The summary MUST add « N lots without a door » and « N doors held by another
  discharge » when, and only when, those counts are non-zero.
- **FR-010**: Indicators and counts MUST update after any change made from the tab (doors, lots,
  customers) without a page reload.
- **FR-011**: When the door-problem information is unavailable, the tab MUST still show the lots and
  totals and MUST NOT show indicators or counts that would suggest there is no problem.
- **FR-012**: Active and closed discharges MUST NOT show amber door problem indicators or problem
  counts; an active discharge's tab MUST state that its lots are read-only while it is active.

**Actions (users allowed to prepare discharges, on a planned discharge)**

- **FR-013**: Each customer row MUST offer Edit, opening the correction of all that customer's lots.
- **FR-014**: Each lot row MUST offer an actions menu with Edit, Assign doors, and Remove; Remove
  MUST stay listed but disabled, with its reason, when the lot cannot be removed.
- **FR-015**: A lot showing « No door » or « Held by … » MUST also offer an Assign doors action beside
  the indicator, opening that lot's Assign doors dialog.
- **FR-016**: The tab MUST offer Add product lots, both above the table and in the empty state.
- **FR-017**: Observers, and every user on an active or closed discharge, MUST NOT be offered any of
  the actions of FR-013 to FR-016.

**Assign doors dialog**

- **FR-018**: The dialog MUST name the lot by customer, product, and expected quantity.
- **FR-019**: The dialog MUST list available doors grouped under their warehouse, with a count of
  available doors and a search over door and warehouse names.
- **FR-020**: Each available door MUST state, when applicable, on how many other discharges it is
  also planned and which lot of this discharge holds it, and MUST offer Add.
- **FR-021**: The dialog MUST list the doors assigned to the lot, with a count; each MUST offer
  Remove unless planned shifts still use it, in which case it MUST state how many shifts and list
  them.
- **FR-022**: An assigned door held by an active discharge MUST name that discharge and its status
  and state that it blocks this discharge's start until it is released.
- **FR-023**: The dialog MUST summarize the pending changes (or state there is none yet), state that
  a door serves one lot of a discharge at a time while several planned discharges may share it, and
  offer Cancel and Save.
- **FR-024**: On a phone-width screen, the dialog MUST present the two lists one at a time.

**Sheets**

- **FR-025**: Editing one lot MUST happen in a side sheet allowing correction of customer, product
  name, expected quantity, and description, and showing the lot's current doors read-only with their
  problem indicators, an Assign doors action, and a note that doors are changed from Assign doors.
  While the sheet has unsaved changes, Assign doors is unavailable and says to save or cancel them
  first, so leaving for the doors never discards an edit (added at implementation review).
- **FR-026**: Correcting a customer's lots MUST happen in a side sheet showing the customer with its
  subtotal and a running « N lots · total » that follows the edits.
- **FR-027**: Adding lots MUST happen in a side sheet organized by customer, with Add product and Add
  customer, and a running « N lots · total » showing a dash while no quantity is entered.

**Unchanged rules**

- **FR-028**: Every validation, atomicity, conflict, refusal, and permission rule of the existing
  lot, customer-lots, add-lots, removal, and door-assignment changes MUST remain as specified; this
  feature MUST NOT change what the server accepts or refuses.
- **FR-029**: Door problem indicators MUST be written out in text, not conveyed by color alone, and
  each action MUST be named for assistive technologies by the lot or customer it acts on.

### Key Entities

- **Product lot**: a customer's expected quantity of a product on a discharge, with an optional
  description and its warehouse door assignments; displayed under its customer.
- **Customer group**: the lots of one customer on a discharge, with their count and subtotal.
- **Door problem**: for a planned discharge, either a lot without a current warehouse door, or a
  current door of a lot held by an active discharge (naming that discharge). Derived from the same
  start-blocking problems the start confirmation reports; not stored separately.
- **Warehouse door availability**: for the Assign doors dialog, a door's warehouse, the other
  discharges it is planned on, the lot of this discharge holding it, and the shifts using it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a planned discharge, a user identifies every lot that has a door problem from the
  Product lots tab alone, without opening any dialog, sheet, or the start confirmation.
- **SC-002**: From a lot flagged with a door problem, a user reaches its Assign doors dialog in one
  click.
- **SC-003**: In 100% of checked states, the lots and doors flagged on the tab match the lots and
  doors the start confirmation reports for the same discharge.
- **SC-004**: The customer subtotals always add up to the Expected total shown, and the running
  totals of the sheets match the totals shown after saving.
- **SC-005**: Every existing product lot, customer-lots, add-lots, removal, and door-assignment
  acceptance test keeps passing, with only presentation-level adjustments.
- **SC-006**: The tab, dialog, and sheets are usable at phone width with no horizontal page scroll
  outside the table's own scroll area.

## Assumptions

- The issue lists « No door » and « Held by … » « with Assign doors ». The design shows the inline
  Assign doors button on « No door » lots only. This spec follows the issue: both indicators get the
  direct action, and the lot menu's Assign doors stays available for every lot. The spec reviewer
  may narrow FR-015 to « No door » to match the design exactly.
- « Held by » means held by an **active** discharge, the conflict that blocks the start. A door also
  planned on other planned discharges is not a problem; it is only mentioned (« Also on N
  discharges ») in the Assign doors dialog.
- « No door » is shown to every user who can read the planned discharge, including observers.
  « Held by … » and the held-door count are shown only to users allowed to prepare and start the
  discharge, because which active discharge holds a door is read from the start check, which
  observers may not read (amended at planning, 2026-10-22; see plan D2).
- The closed discharge's door history (ended assignments) is redesigned by #329, and the active
  discharge's overview by #328. This feature keeps today's door history access on active and closed
  discharges unchanged, apart from the grouped V2 layout.
- The discharge header, its start problem banner, and the tab bar belong to #324; this feature only
  covers the content of the Product lots tab and the dialogs and sheets opened from it.
- Customer rows and the lots within each keep the order used today (the order in which the
  discharge's lots are listed); the V2 does not introduce a new sort.
- No new data is stored and no business rule changes; any information missing on the web to show the
  indicators is exposed from what the server already computes for the start confirmation.
