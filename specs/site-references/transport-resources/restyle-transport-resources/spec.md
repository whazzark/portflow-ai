# Feature Specification: Restyle Transport Resources

**Feature Branch**: `feat/319-restyle-transport-resources`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "l'issue github 319 (https://github.com/whazzark/portflow-ai/issues/319) — Restyle Transport resources to the retained V2."

**Feature ID**: `GH-319`

**GitHub Issue**: [#319](https://github.com/whazzark/portflow-ai/issues/319)

**Parent Epic**: [#313](https://github.com/whazzark/portflow-ai/issues/313) — Interface V2

**Parent Roadmap**: `specs/site-references/transport-resources/roadmap.md`

**Domain**: site-references

**Design reference**: [Portflow — Écrans canvas](https://claude.ai/artifact/1RyXTf3HKkxNHBS3ZVc3iT),
page **Site references · Transport resources**, column *Retenue* ("V2 retenue — Option C": fleet
grouped by transport company, statuses as pills, suspension readable in the row). The canvas is
private; the artboards named below are the visual contract for this slice.

## Context

Today the Transport resources screen shows two side-by-side directories — transport companies on
the left, trucks on the right — each with its own status tabs, search, row menus, selection
checkboxes, and right-side panels for details, creation and editing. Selecting a company scopes the
truck directory to it.

The retained V2 replaces this with **one table of trucks grouped by transport company**: each
company is a collapsible group header carrying its contact details and truck counts, its trucks are
listed underneath, and details, creation and editing happen inline in the table rather than in side
panels. Status filtering becomes a single row of toggle pills shared by the whole fleet.

This slice is a **presentation change**. Business rules, lifecycle transitions, validation and
authorization delivered by the transport-company and truck slices stay as they are; where the
design suggests a different rule, this spec states which one wins.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the fleet grouped by transport company (Priority: P1)

As any active user, I open Transport resources and see every transport company as a group with its
contact details and how many trucks it currently provides, with its trucks listed underneath, so
that I understand the site's fleet at a glance without switching between two directories.

**Why this priority**: The grouped list is the frame every other V2 state is drawn in; nothing else
in the slice is reviewable without it.

**Independent Test**: Seed several companies with available and suspended trucks, open the screen,
and compare it with the *Transport resources · Retenue* artboard.

**Acceptance Scenarios**:

1. **Given** companies with available and suspended trucks, **When** a user opens Transport
   resources, **Then** one table titled for trucks by transport company shows the columns
   Registration, Vehicle model, Capacity, Suspension, Status and an actions column, with each
   company as a group header followed by its trucks.
2. **Given** a company group, **When** it is displayed, **Then** its header shows the company name,
   a summary of its truck counts ("2 available · 1 suspended", omitting a zero suspended count),
   its contact phone and contact email, and a control to collapse or expand the group.
3. **Given** a truck row, **When** it is displayed, **Then** it shows the registration, the vehicle
   model (or a dash when none), the capacity in tonnes, and a status pill (Available, Suspended or
   Archived) that differs in colour and label.
4. **Given** a suspended truck, **When** its row is displayed, **Then** the Suspension column shows
   the suspension comment followed by who suspended it and the date (for example "Tyre
   replacement, back on Friday · Claire Martin, 23/09/2026"); for an available truck the column
   shows a dash.
5. **Given** the default view, **When** the screen opens, **Then** the Available and Suspended pills
   are pressed, the Archived pill is not, every pill shows its count, and the rows are sorted by
   registration ascending within each group.
6. **Given** a user collapses a group, **When** the group is collapsed, **Then** only its header
   remains visible and the toggle announces the expanded state change.
7. **Given** the sortable columns Registration, Vehicle model, Capacity and Status, **When** the
   user activates a column header, **Then** trucks are re-sorted within each group by that column
   and the active sort and direction are indicated.

---

### User Story 2 - Narrow the fleet by status, company and search (Priority: P1)

As any active user, I narrow the fleet to suspended trucks, archived resources, one transport
company, or a search term, and I get a clear message with a way out when nothing matches.

**Why this priority**: Finding a given truck or company among the fleet is the screen's most
frequent use.

**Independent Test**: From the default view, toggle each status pill, filter by one company, and
search for a term that matches nothing; compare with the *Camions suspendus*, *Archivés*, *Filtre
par compagnie* and *Aucun résultat* artboards.

**Acceptance Scenarios**:

1. **Given** the default view, **When** the user presses only the Suspended pill, **Then** only
   suspended trucks are listed, under the companies that have one, and companies without a
   suspended truck are hidden.
2. **Given** an administrator presses only the Archived pill, **When** the list refreshes, **Then**
   archived companies appear as groups marked Archived with their archive comment, author and
   date, archived trucks appear with their archive comment, author and date, and a notice explains
   that a company must be reactivated before one of its trucks can be.
3. **Given** the user filters by a company (from a company group or its menu), **When** the filter
   applies, **Then** only that company's group is shown, a banner reads "Showing «company»" with a
   control to show all companies and states how many other companies are hidden.
4. **Given** a search term, **When** the user types it, **Then** trucks are matched on
   registration, vehicle model or company name, and companies are matched on name, within the
   pressed statuses.
5. **Given** a search term that matches nothing, **When** the list refreshes, **Then** the table
   shows "No truck or company matches «term»", explains what the search looks in and that archived
   trucks are hidden when the Archived pill is not pressed, and offers "Clear search" and, when the
   Archived pill is not pressed, "Include archived".
6. **Given** a filtered, searched or sorted view, **When** the user reloads or shares the address,
   **Then** the same view is restored.
7. **Given** a bookmarked address of the former Transport companies screen, **When** it is opened,
   **Then** the user lands on Transport resources with the equivalent filter applied.

---

### User Story 3 - Inspect a truck and a company in place (Priority: P2)

As any active user, I open a truck's or a company's details directly inside the table, without
losing my place in the list.

**Why this priority**: Details are read often but only after finding the resource.

**Independent Test**: Open a suspended truck's details and a company's details; compare with the
*Détail camion* and *Détail compagnie* artboards.

**Acceptance Scenarios**:

1. **Given** a truck row, **When** the user activates it (or chooses View in its menu), **Then** a
   detail area expands under the row showing its transport company, the company status, the
   creation and last-update timestamps, and a History of its recorded lifecycle events (suspended,
   returned to service, archived, reactivated), newest first, each with its timestamp, author and
   comment.
2. **Given** a suspended truck's details, **When** an administrator views them, **Then** they read
   "Return it to service before editing or archiving it." with a Return to service action.
3. **Given** a company group, **When** the user chooses View details in its menu, **Then** the
   group header expands into a company detail showing its status, contact phone, contact email,
   creation and last-update timestamps, and its archival context or "Never archived".
4. **Given** an administrator views an available company that still provides available trucks,
   **When** the detail is shown, **Then** Archive is visibly unavailable and the detail explains
   "Can be archived once it provides no available truck (N today)".
5. **Given** an expanded detail, **When** the user hides it (control or Escape), **Then** the row
   returns to its compact form and focus returns to the row.

---

### User Story 4 - Create and edit inline (Priority: P2)

As an administrator, I create a transport company or a truck, and correct a truck, directly in the
table.

**Why this priority**: Creation and correction are routine administration, less frequent than
reading.

**Independent Test**: Create a company, add a truck to it, and edit a truck's vehicle model; compare
with the *Create transport company*, *Create truck* and *Edit truck (en ligne)* artboards.

**Acceptance Scenarios**:

1. **Given** an administrator, **When** they open the Create split button, **Then** they can choose
   to create a truck or a transport company.
2. **Given** an administrator creates a transport company, **When** the form opens, **Then** an
   inline row at the top of the table asks for the company name, contact phone and contact email
   with Create and Cancel; on success the new company appears as an expanded, empty group and a
   success message is shown.
3. **Given** an administrator chooses Add truck in a company's menu, **When** the form opens,
   **Then** an inline row at the end of that company's group asks for registration, vehicle model
   and capacity in tonnes, states "Added to «company»", and shows the Available status it will
   take; Save adds the truck to the group.
4. **Given** an administrator creates a truck from the Create split button, **When** the form
   opens, **Then** they also choose its transport company among available companies.
5. **Given** an administrator chooses Edit on an available truck, **When** the row turns into an
   inline form, **Then** registration, vehicle model and capacity become editable, Save and Cancel
   are offered, and Escape cancels.
6. **Given** an available truck used by a planned or active discharge, **When** it is edited inline,
   **Then** its transport company cannot be changed and the row explains why.
   [NEEDS CLARIFICATION: the V2 shows the lock up front ("Company locked: used by planned discharge
   «MV Nordic Star»"), but today the system only reports it when the change is submitted. Should
   this slice expose the lock and the blocking discharge before editing, or keep the submit-time
   error and show it inline?]
7. **Given** a creation or edit is rejected (duplicate name or registration, invalid value,
   archived company), **When** the response arrives, **Then** the error is shown on the related
   field or row and the typed values are kept.
8. **Given** an administrator edits a company (company menu → Edit), **When** the form opens,
   **Then** the company group header becomes an inline form with the same fields as creation.

---

### User Story 5 - Suspend, return to service, archive and reactivate (Priority: P1)

As an administrator, I take a truck out of service, bring it back, archive it, or reactivate an
archived resource from the row or its menu, with a confirmation that tells me the consequence.

**Why this priority**: Suspension and return to service are the day-to-day lifecycle actions the
V2 makes readable in the row.

**Independent Test**: Suspend an available truck, return a suspended truck to service, archive an
available truck and reactivate it; compare with the *Menu ⋮ camion*, *Suspend truck*, *Suspension
confirmée*, *Return to service*, *Archive truck* and *Menu ⋮ compagnie* artboards.

**Acceptance Scenarios**:

1. **Given** an available truck, **When** an administrator opens its menu, **Then** it offers View,
   Edit, Suspend and, after a separator, Archive.
2. **Given** an administrator chooses Suspend, **When** the confirmation opens, **Then** it asks
   "Suspend «registration»?", explains that the truck is withdrawn from new discharges, shifts and
   rotations while discharges it already belongs to continue unchanged and its registration stays
   reserved, and offers an optional comment, Cancel and Suspend.
3. **Given** the suspension succeeds, **When** the dialog closes, **Then** the row shows the
   Suspended pill and its suspension comment, author and date, the group and pill counts update,
   and a confirmation toast reads "Truck «registration» suspended — It stays in its current
   discharges."
4. **Given** a suspended truck, **When** it is displayed to an administrator, **Then** its row
   offers a direct Return to service action; confirming "Return «registration» to service?"
   explains it becomes available again for new discharges, shift assignments and rotations and the
   suspension stays in its history, with an optional comment.
5. **Given** an available truck, **When** an administrator archives it, **Then** the confirmation
   "Archive «registration»?" explains the truck leaves the fleet for new discharges, shifts and
   rotations, past discharges keep it, its registration stays reserved and it can be reactivated
   later, with an optional comment.
6. **Given** an archived truck whose company is available, or an archived company, **When** an
   administrator views it with the Archived pill pressed, **Then** a Reactivate action is offered
   on the row or group header.
7. **Given** an archived truck whose company is archived, **When** an administrator views it,
   **Then** Reactivate is unavailable and the notice explains the company must be reactivated
   first.
8. **Given** a company's menu, **When** an administrator opens it, **Then** it offers View details,
   Edit, Add truck and, after a separator, Archive — unavailable with the reason "Still provides N
   available truck(s)" while the company provides an available truck.
9. **Given** a lifecycle action is refused by the system (truck in use, company archived,
   concurrent change), **When** the response arrives, **Then** the user sees the reason and the
   list reflects the current state.

---

### User Story 6 - Read-only fleet for users without administration rights (Priority: P1)

As an active user without administration rights, I see the same grouped fleet without any
creation, editing or lifecycle controls.

**Why this priority**: Most site users only consult the fleet; they must never be offered actions
the system will refuse.

**Independent Test**: Sign in as a non-administrator and compare with the *Lecture seule (sans droit
d'administration)* artboard.

**Acceptance Scenarios**:

1. **Given** a user without administration rights, **When** they open Transport resources,
   **Then** the Create button, every row and group actions menu, and every inline Return to
   service or Reactivate action are absent, while the search, status pills, collapse controls and
   detail views remain.
2. **Given** such a user, **When** they open a truck's or a company's details, **Then** no Edit,
   Suspend, Return to service, Archive or Reactivate action is shown.
3. **Given** such a user, **When** they view suspended trucks or the Archived pill, **Then** what
   they see matches what they are already authorized to read. [NEEDS CLARIFICATION: the read-only
   artboard shows the Archived pill and the suspending administrator's name to non-administrators,
   but today archived trucks and lifecycle authors are visible to administrators only. Keep
   today's visibility (Archived limited to archived companies or hidden, no author names), or
   widen read access as drawn?]

---

### User Story 7 - Light theme (Priority: P3)

As any user who chose the light appearance, I get the same Transport resources screen in the light
Marine sobre palette.

**Why this priority**: The theme tokens already exist (#314); this story only verifies every V2
element uses them.

**Independent Test**: Switch to the light appearance and compare with the *Thème clair · Retenue*
artboard.

**Acceptance Scenarios**:

1. **Given** the light appearance, **When** the screen and each state above (menus, dialogs, toast,
   inline forms, details, banners) are shown, **Then** they use the light palette with no dark
   surface or unreadable text.

---

### Edge Cases

- A company with no truck in the pressed statuses: its group is hidden, except right after it was
  created (empty group with an Add truck entry) or when the company itself matches the search.
- Releasing the last pressed status pill is not possible; at least one status stays selected.
- A truck whose vehicle model is empty: shows a dash and sorts last on Vehicle model.
- A suspended truck without a comment: the Suspension column shows only the author and date.
- A company without contact details (legacy data): the header omits the missing values.
- Long company names, comments or emails: truncated with the full text available on focus/hover,
  without breaking the row height of other rows.
- Two inline forms: opening a second create/edit form while one has unsaved values asks before
  discarding, or keeps only one form open at a time.
- The resource changed or disappeared between display and action: the action fails with the
  system's reason and the list refreshes.
- Loading and load failure: the table shows a loading state, and a failure shows a message with a
  retry, as today.
- Narrow viewports: the table scrolls horizontally inside its frame; the toolbar wraps.
- Keyboard: every row, group toggle, menu, inline form and dialog is reachable and operable by
  keyboard, and dialogs trap and restore focus.

## Requirements *(mandatory)*

### Functional Requirements

**Layout and listing**

- **FR-001**: The screen MUST present trucks in a single table grouped by transport company, each
  group led by a header showing the company name, its truck-count summary, its contact phone and
  email, a collapse/expand control and, for administrators, an actions menu.
- **FR-002**: Truck rows MUST show registration, vehicle model, capacity in tonnes, suspension
  context (comment, author, date) or a dash, a status pill, and, for administrators, the row's
  direct action and actions menu.
- **FR-003**: Status pills (Available, Suspended, Archived) MUST be distinguishable by label and
  colour that differ in lightness, and MUST meet the V2 contrast rules in both themes.
- **FR-004**: The table MUST support sorting by Registration, Vehicle model, Capacity and Status
  within each group, defaulting to Registration ascending.
- **FR-005**: The screen MUST keep the V2 authenticated shell (#314) with "Transport resources" as
  the page title and the Transport resources navigation entry marked current.

**Filtering and search**

- **FR-006**: The screen MUST offer toggle pills Available, Suspended and Archived, each with its
  count, defaulting to Available and Suspended pressed, and combine the pressed statuses.
- **FR-007**: Search MUST match trucks on registration, vehicle model or company name and companies
  on name, within the pressed statuses.
- **FR-008**: Users MUST be able to restrict the table to one transport company, see which company
  is shown and how many are hidden, and return to all companies in one action.
- **FR-009**: When nothing matches, the table MUST show the no-match state with the term, an
  explanation, "Clear search" and, when archived resources are excluded, "Include archived".
- **FR-010**: Status filter, company filter, search, sort and the open detail or form MUST be
  reflected in the address so the view survives a reload and can be shared; the former Transport
  companies address MUST keep redirecting to the equivalent view.

**Details**

- **FR-011**: A truck's details MUST expand inline under its row with transport company, company
  status, created and last-updated timestamps and its recorded lifecycle history, newest first.
- **FR-012**: A company's details MUST expand inline in its group with status, contact phone,
  contact email, created and last-updated timestamps, archival context, and the archive
  availability explanation.

**Creation and editing (administrators)**

- **FR-013**: A Create split button MUST let administrators create a truck or a transport company.
- **FR-014**: Company creation and editing MUST happen in an inline row with the company name,
  contact phone and contact email; the existing validation rules apply unchanged (all three are
  currently required, so the V2 "(optional)" labels do not apply).
- **FR-015**: Truck creation MUST happen in an inline row inside the target company's group (from
  Add truck) or with a company choice limited to available companies (from Create), with
  registration, vehicle model (optional) and capacity in tonnes.
- **FR-016**: Truck editing MUST happen inline on the truck's row, only for available trucks, with
  Save, Cancel and Escape to cancel.
- **FR-017**: The transport-company lock of a truck used by a planned or active discharge MUST be
  shown on the inline edit row (timing per the clarification in User Story 4).
- **FR-018**: Validation and conflict errors MUST be shown next to the affected field or row while
  keeping the entered values.

**Lifecycle (administrators)**

- **FR-019**: Truck menus MUST offer View, Edit, Suspend and Archive for available trucks; a
  suspended truck MUST offer Return to service directly on its row and no Edit or Archive; an
  archived truck MUST offer Reactivate, unavailable with an explanation when its company is
  archived.
- **FR-020**: Company menus MUST offer View details, Edit, Add truck and Archive for available
  companies, with Archive unavailable and explained while the company provides an available truck;
  an archived company MUST offer Reactivate.
- **FR-021**: Suspend, Return to service and Archive MUST ask for confirmation in a dialog that
  states the consequence and accepts an optional comment (up to the existing limit).
- **FR-022**: A successful suspension MUST show a confirmation toast naming the truck and stating it
  stays in its current discharges; other successful actions MUST show a confirmation message.
- **FR-023**: After any successful action, the affected rows, group summaries and pill counts MUST
  reflect the new state without a manual reload.
- **FR-024**: Bulk selection and bulk archive/reactivate of the current directories are not drawn
  in the V2. [NEEDS CLARIFICATION: remove bulk selection, bulk actions and their select-all
  keyboard shortcut from this screen, or keep them in a V2 form?]

**Access and theme**

- **FR-025**: Users without administration rights MUST see the grouped fleet, filters, search and
  details with no creation, editing or lifecycle control; the system remains the authority and
  refuses such actions regardless of the interface.
- **FR-026**: Every element of the screen MUST render correctly in the dark and light Marine sobre
  themes using the shared theme tokens.
- **FR-027**: All controls MUST have accessible names (the search field labelled for transport
  resources, not customers), and icon-only controls MUST name the resource they act on (for
  example "Actions for AB-123-CD").

### Key Entities

- **Transport company**: name, contact phone, contact email, status (available or archived),
  archival and reactivation context, created and updated timestamps; provides trucks.
- **Truck**: registration, vehicle model, capacity in tonnes, transport company, status
  (available, suspended or archived), the latest suspension, return-to-service, archival and
  reactivation context (time, author, comment), created and updated timestamps.
- **Fleet group** (presentation only): a transport company with the trucks shown under it and its
  counts of available and suspended trucks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every *Retenue* artboard of the Transport resources page (18 states) has a
  matching, demonstrable state in the application, reviewed side by side before merge.
- **SC-002**: A user finds a given truck by registration, model or company and opens its details in
  at most 3 interactions from the default view.
- **SC-003**: An administrator suspends a truck and sees the confirmation in at most 3
  interactions from its row (menu, Suspend, confirm).
- **SC-004**: A user without administration rights is shown zero creation, editing or lifecycle
  controls on the screen.
- **SC-005**: All text and status pills on the screen reach at least 4.5:1 contrast in both themes.
- **SC-006**: Every existing transport-company and truck business rule (validation, uniqueness,
  lifecycle gates, authorization) behaves exactly as before; no existing rule test changes its
  expectation.

## Assumptions

- This slice changes presentation only. Business rules, validation and authorization from the
  transport-company and truck specs stay authoritative; the system stays the source of truth.
- Company contact phone and email remain required; the "(optional)" labels on the *Create
  transport company* artboard are not adopted.
- The truck "History" shows the lifecycle events the system already records (the latest
  suspension, return to service, archival and reactivation), not an unbounded event log.
- The "Search customers" accessible label on the artboards is a design copy error; the field is
  named for transport resources.
- Group counts and pill counts are derived from the resources the user may read.
- The light theme and the shell come from #314 and are not changed here.
- Feedback toasts reuse the application's existing toast mechanism.

## Dependencies

- #314 / PR #333 — V2 palette and authenticated shell (merged).
- Delivered transport-company and truck slices under `specs/site-references/transport-resources/`.

## Out of Scope

- New lifecycle states, new business rules, or changes to which roles may act.
- Other screens of the Interface V2 epic (#313), including the discharge truck pool.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/319
- Parent epic: https://github.com/whazzark/portflow-ai/issues/313
- Design: https://claude.ai/artifact/1RyXTf3HKkxNHBS3ZVc3iT (page Site references · Transport
  resources, column Retenue)
