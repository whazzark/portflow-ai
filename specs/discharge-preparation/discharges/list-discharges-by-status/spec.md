# Feature Specification: List Discharges by Status

**Feature Branch**: `feat/322-discharge-list-by-status`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "l'issue github 322 — Discharge list by status.
https://github.com/whazzark/portflow-ai/issues/322"

**GitHub Issue**: [#322](https://github.com/whazzark/portflow-ai/issues/322)

**Parent Epic**: [#313](https://github.com/whazzark/portflow-ai/issues/313) Interface V2

**Domain**: discharge-preparation

**Design reference**: Portflow — Écrans canvas, page **Discharges**, boards *Liste — Active*,
*Liste — Planned*, *Liste — Closed* and *Liste — aucun résultat* (*Retenue* column).

## Context

The discharges workbench delivered by GH-61
(`specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/browse-the-discharges-list-in-the-web-workbench/spec.md`)
lists the site's discharges in Active, Planned, and Closed tabs, each with its count, and GH-58
made every row open its discharge. Every tab shows the same columns today — vessel, IMO, dock,
expected start, every customer, product lot count, and shift count — whatever the discharge's
status, and the customer cell grows with each customer of the discharge.

What a user needs from a row depends on the status: on an active discharge, where it is and who is
running it now; on a planned one, when it starts and whether it is ready to start; on a closed one,
when it ran and how much it represented. This slice keeps the workbench's tabs, counts, search,
ordering, address state, and empty/failure feedback from GH-61, and replaces the uniform row with a
status-specific one. Everything GH-61 specifies and this spec does not change remains in force.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read an Active Discharge's Live Situation (Priority: P1)

As an active user, I want each active discharge to show its dock, when it started, the shift
running now and its responsible, so that I can see at a glance who is in charge of what on the
site without opening each discharge.

**Why this priority**: Active is the tab the workbench opens on and the one consulted during
operations. Showing the running shift and its responsible on the row is the main gain of the issue.

**Independent Test**: Seed active discharges with an active shift, and one between shifts, open the
workbench, and verify that each row shows its vessel, dock, actual start, shift situation,
responsible, expected tonnage, and shortened customers.

**Acceptance Scenarios**:

1. **Given** an active discharge whose shift is in progress, **When** the user reads its row in the
   Active tab, **Then** the row shows the vessel name with its IMO, the dock, the time the discharge
   actually started, the active shift's position among the discharge's shifts (for example
   "Shift 7 / 11") with its planned time range, the shift responsible's name, the discharge's
   expected tonnage, and its customers.
2. **Given** an active discharge between two shifts (its previous shift completed, the next one not
   yet started), **When** the user reads its row, **Then** the row states that no shift is in
   progress and shows the next planned shift and its responsible when one exists, rather than
   presenting a completed or planned shift as running.
3. **Given** the Active tab is selected, **When** the user reads the column headers, **Then** they
   are Vessel, Dock, Started, Active shift, Expected tonnage, and Customers; the expected start, the
   product lot count, and the shift count are not shown.

---

### User Story 2 - See Whether a Planned Discharge Is Ready to Start (Priority: P1)

As an operations lead, I want each planned discharge to show its expected start and whether its
preparation is ready, so that I can spot which upcoming discharges still need work before they can
start.

**Why this priority**: Today a lead has to open every planned discharge to learn whether it can
start. The preparation badge turns the Planned tab into a to-do list.

**Independent Test**: Seed planned discharges with zero, one, and several start problems, open the
Planned tab, and verify each row's badge reads Ready or the right number of problems, matching what
the discharge's start check reports.

**Acceptance Scenarios**:

1. **Given** a planned discharge whose start check reports no problem, **When** the user reads its
   row in the Planned tab, **Then** a Ready preparation badge is shown.
2. **Given** a planned discharge whose start check reports n problems (n ≥ 1), **When** the user
   reads its row, **Then** a preparation badge reads "1 problem" or "n problems", styled as a
   warning distinct from Ready.
3. **Given** a planned discharge, **When** the user reads its row, **Then** the row shows the vessel
   name with its IMO, the dock, the expected start, the preparation badge, its product lot count
   with its expected tonnage (for example "8 lots · 22,843.000 t"), and its customers.
4. **Given** the preparation of a planned discharge changes so that its start check result changes,
   **When** the list is refreshed, **Then** the badge reflects the new result.
5. **Given** the Planned tab is selected, **When** the user reads the column headers, **Then** they
   are Vessel, Dock, Expected start, Preparation, Lots · tonnage, and Customers.

---

### User Story 3 - Read a Closed Discharge's Dates and Tonnage (Priority: P2)

As an active user, I want each closed discharge to show when it started, when it was closed, and its
tonnage, so that I can find a past discharge by its period and size.

**Why this priority**: The closed history is consulted after the fact; its rows matter less often
than active and planned ones but must stay readable as the history grows.

**Independent Test**: Seed closed discharges, open the Closed tab, and verify each row shows its
start, closure, expected tonnage, and shortened customers.

**Acceptance Scenarios**:

1. **Given** a closed discharge, **When** the user reads its row in the Closed tab, **Then** the row
   shows the vessel name with its IMO, the dock, the time it actually started, the time it was
   closed, its expected tonnage, and its customers.
2. **Given** the Closed tab is selected, **When** the user reads the column headers, **Then** they
   are Vessel, Dock, Started, Closed, Expected tonnage, and Customers.
3. **Given** a closed discharge whose closure time is not known, **When** its row is displayed,
   **Then** the Closed cell shows an explicit muted placeholder rather than a fabricated time.
   [NEEDS CLARIFICATION: No closure time is recorded for a discharge today — Discharge Closure
   (#98) is not delivered. What should the Closed column show?]

---

### User Story 4 - Recognise a Discharge's Customers and Open It (Priority: P2)

As an active user, I want a compact customer cell and a row I can open from anywhere, so that rows
stay one line high however many customers a discharge serves and I reach the discharge in one
action.

**Why this priority**: The unbounded customer list is the issue's stated problem; it degrades every
tab, but the list stays usable without it.

**Independent Test**: Seed discharges with zero, one, two, and five distinct customers, and verify
the customer cell in each tab, then open discharges by clicking different parts of their rows and
by keyboard.

**Acceptance Scenarios**:

1. **Given** a discharge with one or two distinct customers, **When** its row is displayed, **Then**
   all of their names are shown and no « +N » indicator appears.
2. **Given** a discharge with more than two distinct customers, **When** its row is displayed,
   **Then** two customer names are shown followed by « +N », where N is the number of remaining
   distinct customers.
3. **Given** a discharge whose customers are shortened, **When** the user hovers or focuses the
   « +N » indicator, or a screen reader reads the cell, **Then** every customer's name is available.
4. **Given** a discharge with no product lot yet, **When** its row is displayed, **Then** the
   customer cell shows the muted em dash used for absent values.
5. **Given** a listed discharge, **When** the user clicks anywhere on its row, **Then** that
   discharge opens, carrying the list's status and search so that its way back restores them.
6. **Given** a listed discharge, **When** a keyboard user tabs to the row's link and activates it, or
   a user opens it in a new tab, **Then** that discharge opens as with a click on the row.

---

### User Story 5 - Search Without a Counter and Recover From No Match (Priority: P3)

As an active user, I want the search to narrow the list without a result counter competing with the
tab counts, and to clear a search that matched nothing in one action, so that I am never stuck on an
empty list.

**Why this priority**: It refines an existing search behavior rather than adding a capability.

**Independent Test**: Search for a term matching nothing, verify the no-match state and its Clear
search action, then clear and verify the list is restored.

**Acceptance Scenarios**:

1. **Given** the user types a search, **When** the list narrows, **Then** no result counter is shown
   next to the search field.
2. **Given** a search matches no discharge of the selected status, **When** the list is displayed,
   **Then** a no-match state names the search term, suggests checking the vessel name, IMO, dock,
   customer, or product, and offers a Clear search action, without claiming the status is empty.
3. **Given** the no-match state, **When** the user activates Clear search, **Then** the search is
   emptied, removed from the address, and the selected status's full collection is listed again.
4. **Given** a search narrows the list, **When** the user reads the tab counts, **Then** they behave
   as decided for FR-016.

### Edge Cases

- An active discharge whose active shift's responsible has since lost eligibility or been
  deactivated still shows that responsible's name; the row reflects the recorded responsible rather
  than hiding it.
- An active discharge between shifts with no further planned shift shows the no-shift-in-progress
  state without a next shift.
- An active discharge started before its start time was recorded shows an explicit placeholder in
  Started rather than a fabricated time or its expected start.
- A planned discharge with no product lot shows "0 lots" with no tonnage, and its preparation badge
  counts that missing lot as a problem, as the start check does.
- A planned discharge whose start check cannot currently be evaluated keeps its row listed; its
  badge never claims Ready when readiness is unknown.
- Several product lots of the same customer count that customer once in the customer cell and in
  « +N ».
- Customer names keep their display casing; the two shown are chosen in a stable order so the same
  discharge always shows the same two.
- A long vessel or customer name truncates within its cell without widening the row or hiding the
  remaining columns; its full value stays available on hover and to assistive technologies.
- A discharge with no vessel IMO shows the vessel name with an explicit muted placeholder for the
  IMO, as GH-61 requires.
- Tonnage is shown in tonnes with three decimals and thousands separators, consistently with the
  rest of the application.

## Requirements *(mandatory)*

### Functional Requirements

#### Unchanged from GH-61

- **FR-001**: The workbench MUST keep the Active, Planned, and Closed tabs in that order, open on
  Active, show each status's count on its tab, and keep the search, the per-status ordering, the
  address-carried status and search, and the empty, loading, and failure states specified by GH-61,
  except where this spec changes them.
- **FR-002**: Consultation MUST remain available to every active authenticated user in every role
  and read-only; the preparation badge and the shift information MUST NOT give any role a new
  action on the list.

#### Rows shared by every status

- **FR-003**: Every row MUST identify the discharge by its vessel name with the vessel IMO beneath
  it (or an explicit placeholder when no IMO is recorded) and MUST show its dock. The IMO MUST NOT
  occupy its own column.
- **FR-004**: The status MUST NOT be repeated on each row; the selected tab states it.
- **FR-005**: The customer cell MUST show at most two distinct customer names, in a stable order,
  followed by « +N » when the discharge has N more distinct customers; every customer name MUST
  remain available on hover, on focus, and to assistive technologies.
- **FR-006**: A discharge with no customer yet MUST show the muted em dash used for absent values in
  its customer cell.
- **FR-007**: Clicking anywhere on a row MUST open its discharge; each row MUST also carry a real
  link to the discharge reachable by keyboard and usable to open it in a new tab, and opening a
  discharge MUST carry the list's status and search.
- **FR-008**: The product lot count and shift count columns MUST be removed from every tab; only the
  Planned tab shows the product lot count, inside Lots · tonnage.

#### Status-specific columns

- **FR-009**: The Active tab MUST show the columns Vessel, Dock, Started, Active shift, Expected
  tonnage, and Customers. Started MUST be the time the discharge actually started.
- **FR-010**: The Active shift cell MUST show, for the discharge's active shift, its position among
  the discharge's shifts in the form "Shift k / n", its planned time range, and its responsible's
  name. When no shift of the discharge is active, it MUST state that no shift is in progress and
  MUST show the next planned shift's position, time range, and responsible when one exists.
- **FR-011**: The Planned tab MUST show the columns Vessel, Dock, Expected start, Preparation,
  Lots · tonnage, and Customers.
- **FR-012**: The Preparation badge MUST read Ready when the discharge's start check reports no
  problem, and "1 problem" or "n problems" otherwise, n being the number of problems that start
  check reports for the discharge at the time the list is read. The badge MUST agree with the
  problems shown when the user opens that discharge's start.
- **FR-013**: The Ready and problem badges MUST be distinguishable by more than color alone.
- **FR-014**: The Closed tab MUST show the columns Vessel, Dock, Started, Closed, Expected tonnage,
  and Customers. The Closed cell MUST show [NEEDS CLARIFICATION: source of the closure time —
  see User Story 3].
- **FR-015**: A discharge's expected tonnage MUST be the sum of the expected quantities of its
  product lots, in tonnes with three decimals.

#### Search feedback

- **FR-016**: No result counter MUST be shown next to the search field. The tab counts MUST
  [NEEDS CLARIFICATION: keep reporting each status's total while a search narrows the list, as
  GH-61 FR-005 requires, or report the number of matches per status, as the retained no-match
  design suggests by showing 0 on every tab?]
- **FR-017**: The no-match state MUST name the searched term, suggest the searchable fields, and
  offer a Clear search action that empties the search, removes it from the address, and restores the
  selected status's collection. It MUST remain distinct from a status's empty state, which keeps its
  creation action for users allowed to prepare discharges.
- **FR-018**: Any absent value in a status-specific column (actual start, closure time, next shift,
  tonnage of a discharge with no lot) MUST be shown as an explicit muted placeholder and MUST NOT
  prevent the discharge from being listed.

### Key Entities *(include if feature involves data)*

- **Discharge**: As in GH-61, plus the values each row now needs: its actual start time, its
  closure time, and its expected tonnage.
- **Active Shift**: The discharge's shift in progress, if any, identified to the user by its
  position among the discharge's shifts and its planned time range, with its Shift Responsible.
- **Planned Shift**: The next shift of an active discharge between shifts, shown with its position,
  time range, and responsible.
- **Shift Responsible**: The user accountable for a shift, named on the active discharge's row.
- **Discharge Start Check**: The evaluation of whether a planned discharge can start and every
  problem preventing it; its problem count drives the preparation badge.
- **Product Lot**: Its customer feeds the customer cell; its expected quantity feeds the expected
  tonnage.
- **Customer**: A distinct company owning one or more product lots of the discharge.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of rows in each tab show exactly that tab's columns, and
  no row shows a column belonging to another status.
- **SC-002**: For 100% of seeded planned discharges, the preparation badge matches the number of
  problems the discharge's start check reports.
- **SC-003**: For 100% of seeded active discharges, the active shift cell names the shift actually
  in progress and its responsible, or states that none is in progress.
- **SC-004**: Every row stays one line of customers high whatever the discharge's number of
  customers, and 100% of customer names remain reachable on hover and by assistive technologies.
- **SC-005**: At least 90% of representative users can tell, from the Planned tab alone and within
  10 seconds, which planned discharges are not ready to start.
- **SC-006**: For a site holding up to 1,000 discharges across all statuses, users see the requested
  tab's rows, badges included, within 2 seconds for at least 95% of consultation attempts.
- **SC-007**: 100% of no-match states can be left with one Clear search action, landing on the
  selected status's full collection.

## Assumptions

- "Tonnage" means the expected tonnage (the sum of the product lots' expected quantities), as the
  retained design labels it. Discharged net tonnage depends on rotations, which are not recorded
  yet, and is out of scope.
- "Start" on the Active and Closed tabs means the actual start recorded by the Discharge Start
  Confirmation; the Planned tab keeps the expected start.
- "Current shift" in the issue is the domain's **Active Shift**; the column is labelled Active shift
  to follow `CONTEXT.md`, which avoids "current shift".
- The shift position "k / n" counts every shift of the discharge in planned-start order, completed
  and planned ones included.
- The preparation problem count is the same evaluation as the start check the start dialog already
  shows; this slice adds no new readiness rule.
- The two customers shown are the first two distinct customer names in alphabetical order.
- Each tab keeps GH-61's ordering: Planned and Active by expected start ascending, Closed by expected
  start descending.
- The design reference shows the counts next to each tab label without parentheses and an Open
  chevron at the end of each row; visual details follow the V2 palette and shell delivered by #314.
- The search's matching rules (vessel, IMO, dock, customer, product; case- and whitespace-
  insensitive) are unchanged.

## Out of Scope

- Recording a discharge's closure, its time, or who closed it (Discharge Closure, #98).
- Discharged net tonnage, rotation progress, and any operations dashboard figure.
- Any action on a discharge from the list, including starting a planned discharge or fixing its
  preparation problems.
- The discharge detail, creation wizard, and not-found screens, covered by sibling issues of #313.
- Pagination, user-chosen sorting, column configuration, and export.

## Dependencies

- #314 (V2 palette and authenticated shell), merged in #333.
- GH-61 (discharges list) and GH-58 (opening a discharge), delivered.
- The discharge start check (GH-56), delivered, whose problem evaluation the badge reuses.
- The closure time of closed discharges depends on the answer to the Closed-column clarification.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/322
- Parent epic: https://github.com/whazzark/portflow-ai/issues/313
- Base spec: `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/browse-the-discharges-list-in-the-web-workbench/spec.md`
- Domain vocabulary: `CONTEXT.md` (Discharge, Planned/Active/Closed Discharge, Discharge Start
  Confirmation, Discharge Closure, Shift, Active Shift, Shift Responsible, Product Lot, Customer).
