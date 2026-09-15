# Feature Specification: Correct a Customer's Product Lots at Once

**Feature Branch**: `whazzark/plan-the-discharge-truck-pool-and-shift-subsets`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "Correct all the product lots of one customer at once on a planned
discharge. Today, on a planned discharge's Product lots tab, an operations lead or administrator
corrects product lots one at a time. When a customer has several lots, correcting them means opening
and saving each lot separately. We want a single Edit action on the customer's group that opens all
of that customer's lots, prefilled, so the user can correct their product names, expected quantities,
and descriptions and save them in one atomic change: either every correction is applied or none is.
Duplicate product names must be judged on the final state of the customer's lots, so swapping two
lots' names is allowed. The same rules as the single-lot correction apply."

**Feature ID**: `GH-55`

**GitHub Issue**: [#55](https://github.com/whazzark/portflow-ai/issues/55), delivered alongside the
truck pool and shift subsets (`../plan-the-discharge-truck-pool-and-shift-subsets/`) rather than
under an issue of its own

**Parent Roadmap**: `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md`

**Domain**: discharge-preparation

## Clarifications

### Session 2026-09-15

- Q: Does the per-customer correction only correct the existing lots, or also add and remove lots?
  → A: It corrects, adds, and removes the customer's lots in the same change. Removals keep their
  blocks: a discharge keeps at least one lot, and a lot that has or has had a warehouse door
  assignment cannot be removed.
- Q: Can the whole group be moved to another customer? → A: Yes, to another available customer, in
  the same change.
- Q: Does the single-lot correction stay? → A: Yes, each lot keeps its own correction alongside the
  per-customer correction.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct Every Lot of a Customer in One Change (Priority: P1)

As an operations lead or administrator, I want to open all the product lots of one customer of a
planned discharge together, correct their product names, expected quantities, and descriptions, and
save them in a single change, so that a customer's revised cargo manifest is applied in one step
instead of lot by lot, and the discharge never shows a half-corrected customer.

**Why this priority**: A customer's manifest is usually revised as a whole: several quantities change
at once. Correcting lot by lot today takes one open-and-save per lot, and if the user is interrupted
or one correction is refused, the discharge is left with some of the customer's lots corrected and
others not, which the start confirmation then checks against.

**Independent Test**: On a planned discharge where one customer has three lots, open that customer's
correction, change two quantities and one product name, save, and verify that the detail shows the
three lots corrected, the customer's subtotal and the expected tonnage reflect the new quantities,
and every lot keeps its warehouse door assignments. Then repeat with one invalid quantity and verify
that nothing is saved.

**Acceptance Scenarios**:

1. **Given** a planned discharge with a customer that has several product lots, **When** a user
   allowed to prepare discharges opens the correction of that customer, **Then** every lot of that
   customer is listed with its current product name, expected quantity, and description, and the lots
   of other customers are not.
2. **Given** that correction opened, **When** the user corrects the product name, expected quantity,
   or description of any number of the listed lots and saves, **Then** the detail shows every
   corrected lot, the customer's subtotal and the discharge's expected tonnage reflect the corrected
   quantities, and each lot keeps its identity and its warehouse door assignments.
3. **Given** that correction opened, **When** the user saves without changing anything, **Then** the
   discharge's lots are unchanged.
4. **Given** a correction in which one lot has an invalid expected quantity or a missing product name,
   **When** the user saves, **Then** the change is refused, the offending lot and field are
   identified, what the user typed is kept, and none of the customer's lots is changed.
5. **Given** a correction that would leave two lots of the customer with the same product name,
   ignoring case and surrounding spaces, **When** the user saves, **Then** the change is refused, both
   clashing lots are identified, and none of the customer's lots is changed.
6. **Given** two lots of the customer whose product names are swapped in the same correction, **When**
   the user saves, **Then** the change is accepted, because the names are judged on the discharge's
   lots as they would be after the change.
7. **Given** a correction opened on a planned discharge that starts before the user saves, **When**
   they save, **Then** the change is refused, the user is told the discharge has started, none of the
   lots is changed, and the detail shows the discharge's current state.

---

### User Story 2 - Keep Corrections Out of Reach of Those Who May Not Make Them (Priority: P1)

As an organization, I want the per-customer correction offered and accepted only where a single-lot
correction is, so that grouping corrections gives no one a way around the preparation rules.

**Why this priority**: The per-customer correction changes several lots at once; it must be at least
as guarded as the corrections it groups.

**Independent Test**: As an observer on a planned discharge, and as an operations lead on an active
and on a closed discharge, verify that no per-customer correction is offered and that a correction
attempt is refused without changing any lot.

**Acceptance Scenarios**:

1. **Given** an observer on a planned discharge's detail, **When** they read its product lots,
   **Then** no per-customer correction is offered, and a correction attempt is refused.
2. **Given** an active or a closed discharge, **When** any user reads its product lots, **Then** no
   per-customer correction is offered, and a correction attempt is refused.
3. **Given** a correction attempt that lists a lot belonging to another customer or another discharge,
   **When** it is saved, **Then** it is refused and no lot is changed.
4. **Given** a planned discharge's lots, **When** a user allowed to prepare discharges reads them,
   **Then** each lot still offers its own correction alongside its customer's correction.

---

### User Story 3 - Add and Remove a Customer's Lots in the Same Change (Priority: P2)

As an operations lead or administrator, I want to add new lots for the customer and remove lots
entered by mistake within the same correction, so that the customer's lots match its revised manifest
after a single save, whatever the manifest changed.

**Why this priority**: A revised manifest often adds or drops a product as well as changing
quantities. Without it, the user would still need the separate add and remove actions, and the
customer would again be left half-revised between them.

**Independent Test**: On a planned discharge where a customer has two lots, one of them with a
warehouse door assignment, open the customer's correction, add a lot, remove the lot without doors,
correct the other lot's quantity, save, and verify the detail and expected tonnage. Then verify that
removing the lot with doors, and removing every lot of the discharge's only customer, are refused
without changing any lot.

**Acceptance Scenarios**:

1. **Given** a customer's correction opened, **When** the user adds one or more lots with a product
   name, an expected quantity, and optionally a description, and saves, **Then** the new lots appear
   under that customer, and the customer's subtotal and the expected tonnage include them.
2. **Given** a customer's correction opened, **When** the user removes a lot that never had a
   warehouse door assignment, and saves, **Then** the lot no longer appears, and the customer's
   subtotal and the expected tonnage no longer include it.
3. **Given** a customer's correction opened, **When** the user tries to remove a lot that has or has
   had a warehouse door assignment, **Then** the user is told before saving that it cannot be removed
   because it has warehouse door assignments, and a save that still removes it is refused without
   changing any lot.
4. **Given** a discharge whose only customer's lots are all removed in the correction, **When** the
   user saves, **Then** the change is refused because a discharge needs at least one product lot, and
   no lot is changed.
5. **Given** a discharge with other customers' lots, **When** the user removes every lot of one
   customer and saves, **Then** the change is accepted and that customer no longer appears among the
   discharge's lots.
6. **Given** an added lot whose product name matches another lot of the customer after the change,
   ignoring case and surrounding spaces, **When** the user saves, **Then** the change is refused, the
   clashing lots are identified, and no lot is changed.
7. **Given** a lot removed and a lot added with the same product name in the same correction, **When**
   the user saves, **Then** the change is accepted, because the names are judged after the change.

---

### User Story 4 - Move a Customer's Lots to Another Customer (Priority: P3)

As an operations lead or administrator, I want to change the customer of all the lots of a group in
the same correction, so that lots prepared under the wrong customer are fixed in one step without
losing their warehouse door assignments.

**Why this priority**: Preparing lots under the wrong customer is a less frequent mistake than a
revised quantity, but fixing it lot by lot repeats the same choice for every lot.

**Independent Test**: On a planned discharge, open a customer's correction, choose another available
customer, save, and verify that every lot of the group now appears under the new customer with its
warehouse door assignments; then verify that choosing a customer that already has a lot with one of
the same product names is refused.

**Acceptance Scenarios**:

1. **Given** a customer's correction opened, **When** the user chooses another available customer and
   saves, **Then** every lot kept in the correction, including lots added in it, appears under the new
   customer, each corrected lot keeps its identity and its warehouse door assignments, and the
   expected tonnage is unchanged by the move itself.
2. **Given** a new customer that already has lots on the discharge, **When** the move is saved without
   any product name clash, **Then** the moved lots join that customer's existing lots under one group,
   with one subtotal.
3. **Given** a new customer that already has a lot with the same product name as a moved lot, ignoring
   case and surrounding spaces, **When** the user saves, **Then** the change is refused, the clashing
   lots are identified, and no lot is changed.
4. **Given** a customer that is no longer available when the user saves, **When** the user saves,
   **Then** the change is refused with an explanation, and no lot is changed.
5. **Given** a customer's correction opened, **When** the user chooses a customer, **Then** only
   available customers are offered, along with the group's current customer.

---

### Edge Cases

- A customer with a single lot offers the same per-customer correction; it then corrects that one lot.
- A lot is removed only when the user explicitly removes it in the correction; a lot that is not listed
  in the correction is never removed by it.
- Another user removes one of the customer's lots while the correction is open: saving is refused,
  the user is told the discharge's lots changed, none of the lots is changed, and the detail shows the
  current lots.
- Another user adds a lot to the same customer while the correction is open: saving leaves the new lot
  untouched and does not move it to another customer, and still refuses a change whose product name
  would clash with it.
- Another user corrects one of the opened lots while the correction is open: the last saved correction
  applies, as it does for single-lot corrections today.
- The group's current customer is always available, because a customer cannot be archived while a
  planned discharge uses it; its availability is checked only when the group moves to another
  customer.
- A lot with warehouse door assignments, current or ended, can be corrected and moved like any other
  lot; its assignments follow it.
- A correction that removes some lots and makes another change refused leaves the removed lots in
  place, like every other lot.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Product lots section of a planned discharge MUST offer, to users allowed to prepare
  discharges, one correction per customer that opens all of that customer's lots together.
- **FR-002**: The per-customer correction MUST list every lot of that customer, and only those, each
  prefilled with its current product name, expected quantity, and description.
- **FR-003**: Users MUST be able to correct the product name, expected quantity, and description of
  any listed lot, add new lots for the customer, and remove listed lots, and save all of these in a
  single change.
- **FR-004**: Users MUST be able to change the customer of the whole group to another available
  customer in the same change; every lot the change keeps or adds then belongs to that customer.
- **FR-005**: The system MUST apply a per-customer correction atomically: either every correction,
  addition, removal, and customer change it contains is applied, or none is.
- **FR-006**: The system MUST validate every corrected and added lot with the same rules as GH-53
  defines for lots (a product name that is not blank, a valid expected quantity in tonnes, an optional
  description), and MUST identify each offending lot and field when it refuses.
- **FR-007**: The system MUST refuse a correction that would leave two lots of the same customer on
  the same discharge with the same product name, ignoring case and surrounding spaces, judged on all
  the discharge's lots as they would be after the change, including lots of the target customer and
  lots not listed in the correction.
- **FR-008**: The system MUST refuse a correction that removes a lot that has or has had a warehouse
  door assignment, and the correction MUST tell the user, before saving, which listed lots cannot be
  removed and why.
- **FR-009**: The system MUST refuse a correction that would leave the discharge without any product
  lot.
- **FR-010**: The system MUST refuse a move to a customer that is not available, and MUST offer only
  available customers, along with the group's current customer, when choosing one.
- **FR-011**: Corrected and moved lots MUST keep their identity, so their warehouse door assignments,
  current and ended, remain attached to them.
- **FR-012**: A lot MUST be removed only when the correction explicitly removes it; lots absent from
  the correction MUST be left unchanged.
- **FR-013**: The system MUST refuse a per-customer correction on an active or closed discharge, from
  a user not allowed to prepare discharges, or listing a lot that does not belong to that customer on
  that discharge, without changing any lot.
- **FR-014**: The system MUST refuse a per-customer correction when one of its listed lots no longer
  exists, without changing any lot.
- **FR-015**: After a successful correction, the detail MUST show the resulting lots, each customer's
  subtotal, and the discharge's expected tonnage without a manual reload.
- **FR-016**: A refused correction MUST keep what the user entered, so they can fix it and save again.
- **FR-017**: Each lot MUST keep its own single-lot correction alongside the per-customer correction.

### Key Entities *(include if feature involves data)*

- **Product lot**: A product a discharge unloads for one customer, with its product name, expected
  quantity, and optional description. Unique per discharge by customer and product name. Keeps its
  identity through corrections and customer changes, and with it its warehouse door assignments.
- **Customer's lots**: All the product lots of one customer on one discharge, shown as one group with
  a subtotal. The unit this feature corrects at once; not a stored entity of its own.
- **Planned discharge**: The only discharge status whose product lots may be corrected, and which must
  always keep at least one product lot.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user applies a customer's revised manifest (quantities changed on several lots, one
  product added, one removed) with one open and one save, instead of one action per lot.
- **SC-002**: In every refused per-customer correction, 100% of the discharge's lots are left exactly
  as they were before the attempt.
- **SC-003**: A user can complete a per-customer correction of up to 20 lots in under 2 minutes.
- **SC-004**: Every acceptance scenario of GH-53's lot addition, correction, and removal that concerns
  validation, authorization, discharge status, or removal blocks holds equally for the per-customer
  correction.

## Assumptions

- The per-customer correction is offered from the customer's group in the Product lots section of the
  discharge detail, where lots are already grouped under their customer with a subtotal.
- The editor already used to add product lots customer by customer is reused for the correction, so
  entry, validation feedback, and subtotal preview behave the same way as when adding lots.
- Moving a group to a customer that already has lots on the discharge joins those lots rather than
  being refused; lots are never merged, so a shared product name is a clash that refuses the change,
  consistent with GH-53's rule that one customer never has two lots with the same product name.
- The roles allowed to prepare discharges are those GH-53 defines: operations leads, operations
  admins, and organization admins; observers keep read-only access.
- Concurrent corrections by different users follow the last-saved-wins behavior of single-lot
  corrections; no optimistic locking is introduced by this feature.
- Volumes stay within those GH-53 uses for lots: a discharge's lots are counted in tens, not hundreds.
- The discharge activity log (GH-102) is not delivered; corrections are not recorded as activity
  entries here.

## Out of Scope

- Correcting the lots of several customers in one change.
- Moving only some of a group's lots to another customer in the per-customer correction; the
  single-lot correction remains the way to move one lot.
- Assigning warehouse doors to product lots (GH-54).
- Correcting product lots on an active or closed discharge.
- Importing a customer's lots from a cargo manifest file.
- Optimistic locking or conflict detection between concurrent corrections.

## Dependencies

- Builds on GH-53, delivered: lot addition, correction, and removal, their validation rules and
  removal blocks, and the customer-block editor used to add product lots.
- Builds on the Product lots section of the discharge detail (GH-58, extended by GH-55), where lots are
  grouped by customer and a lot's removal block is already known before asking.
- Independent of GH-54 and GH-56; GH-56's start confirmation checks the lots this feature corrects.
