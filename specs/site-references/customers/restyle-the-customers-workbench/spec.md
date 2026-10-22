# Feature Specification: Restyle the Customers workbench

**Feature Branch**: `feat/318-restyle-customers-workbench`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Restyle the Customers workbench to the retained Interface V2 — GitHub issue https://github.com/whazzark/portflow-ai/issues/318 (parent epic #313, depends on #314 merged in #333). Customers shows the retained V2: available and archived lists, no-match state, row menu; detail sheet (including archived detail), create and edit sheets; archive and reactivate dialogs, archive confirmed by a toast; bulk selection and bulk archive with a toast reporting partial results; read-only rendering for users without administration rights; light theme supported. Out of scope: customer discharges in the detail workbench (#180). Design reference: Portflow — Écrans canvas, page \"Site references · Customers\" (Actuel vs Retenue)."

## Context

The Customers workbench (`/customers`) already lets every active user consult customers and lets
administrators create, correct, archive and reactivate them, one at a time or in bulk. Those
behaviors are specified in the sibling features `list-customers`, `create-a-customer`,
`update-a-customer`, `archive-a-customer` and `reactivate-a-customer`, and remain the business
contract. This feature changes how the workbench looks and reads so that it matches the retained
Interface V2 ("V2 retenue — Option A": a sortable table and a side sheet for detail, edit and
creation, as retained for Users), inside the V2 palette and authenticated shell delivered by #314.

The retained screens are the *Retenue* column of the design canvas page **Site references ·
Customers**: Available list, Archived list, no-match state, row menu, bulk selection, bulk archive
dialog, partial bulk result toast, create sheet, edit sheet, detail sheet, archived detail sheet,
archive dialog, archive confirmation toast, reactivate dialog, read-only rendering, light theme.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consult customers in the V2 lists (Priority: P1)

Any active user opens Customers and finds the page title "Customers" in the shell header, a search
field, the "Available" and "Archived" tabs each showing its count, and a bordered table listing the
customers of the active tab. Customer codes read in a monospaced face and open the customer's
detail. The Available table shows the reactivation comment and who reactivated the customer and
when; the Archived table shows the archive comment and who archived the customer and when. A
search that finds nothing in the active tab shows a dedicated no-match state.

**Why this priority**: The lists are the entry point of every other customer task and the screen
users see most; restyling them alone already delivers the V2 look for consultation.

**Independent Test**: Sign in as any active user with available and archived customers, open
Customers, switch tabs, sort, search for a term matching nothing in the active tab, and compare each
state with the retained Available, Archived and no-match screens.

**Acceptance Scenarios**:

1. **Given** 7 available and 2 archived customers, **When** a user opens Customers, **Then** the
   header shows "Customers", the tabs read "Available 7" and "Archived 2", Available is selected,
   and the table lists the 7 available customers with the columns Customer code, Company name,
   Reactivation comment, Reactivated and, for administrators, a selection column and an "Actions"
   column.
2. **Given** an available customer that was reactivated, **When** it is listed, **Then** its
   Reactivated cell shows the reactivating user's initials badge, full name and the reactivation
   date (e.g. "Claire Martin · 14 Aug 2026"); a customer never reactivated shows an em dash in both
   lifecycle cells.
3. **Given** the Archived tab is selected, **When** the table renders, **Then** its columns are
   Customer code, Company name, Archive comment and Archived, the Archived cell showing who archived
   the customer and when.
4. **Given** a sortable column header, **When** the user activates it, **Then** the list re-sorts
   and the header shows the active direction, while the other sortable headers show a neutral sort
   affordance.
5. **Given** a search that matches no customer of the active tab, **When** the list updates,
   **Then** the table is replaced by a no-match panel titled "No available customer matches “…”"
   (or "No archived customer matches “…”"), explaining where search looks, offering "Clear search",
   and, when customers of the other tab match, stating how many and offering to show that tab.
6. **Given** no customer exists at all in the active tab and no search is entered, **When** the tab
   renders, **Then** an empty state explains that there are no customers in that tab yet.

---

### User Story 2 - Inspect a customer in the detail sheet (Priority: P1)

A user opens a customer from its code or the row menu's "View" and a side sheet slides in over the
list. It names the company with the customer code beneath it, a close control, a summary block
(Status, Customer code, Created, Last updated) and a History section listing every lifecycle
transition newest first, each with its action, timestamp, actor and quoted comment. The sheet of an
available customer offers "Edit" and "Archive" to administrators; the sheet of an archived customer
offers "Reactivate" only.

**Why this priority**: The detail sheet is where users verify a customer and where administrators
start most lifecycle actions; it must exist for the edit and lifecycle stories to have a home.

**Independent Test**: Open the detail of an available customer that was archived then reactivated,
and of an archived customer, and compare with the retained Detail and Archived detail screens.

**Acceptance Scenarios**:

1. **Given** an available customer archived on 30/06/2026 and reactivated on 14/08/2026, **When**
   its detail opens, **Then** the History lists "Reactivated" first then "Archived", each with date
   and time, the actor's initials and full name, and the comment in quotation marks.
2. **Given** an archived customer, **When** an administrator opens its detail, **Then** Status reads
   "Archived", the footer offers "Reactivate" and no "Edit" action is shown.
3. **Given** a customer that never changed lifecycle, **When** its detail opens, **Then** the History
   section states there is no lifecycle history instead of listing empty entries.
4. **Given** the detail sheet is open, **When** the user closes it (close control, Escape, or
   clicking outside), **Then** the list is shown again with its tab, search and sort unchanged.
5. **Given** a customer id in the address that no longer resolves, **When** the sheet opens,
   **Then** it states that the customer could not be loaded.

---

### User Story 3 - Create and edit a customer in V2 sheets (Priority: P2)

An administrator chooses "Create customer" (a primary button with a plus icon beside the search) and
a side sheet titled "Create customer", subtitled "Available as soon as it is created", asks for the
Customer code and Company name, explains that the code identifies the customer in discharges and
reports, is stored in uppercase and can be changed later, and offers "Create customer" and "Cancel".
Editing an available customer opens a sheet titled "Edit customer", subtitled with the company name
and code, with the same two fields, a hint that reports already generated keep the previous code,
and "Save changes" and "Cancel".

**Why this priority**: Creation and correction are administrator-only and less frequent than
consultation, but they are core to keeping the reference list right.

**Independent Test**: As an administrator, open Create customer, submit a code already in use, then
a valid one; open Edit on an available customer and save a corrected company name; compare with the
retained Create and Edit screens.

**Acceptance Scenarios**:

1. **Given** the create sheet, **When** the administrator submits a code already used by another
   customer, **Then** the Customer code field is marked invalid with the message "Already used by
   {company name}." and the sheet stays open with the entered values.
2. **Given** valid values, **When** the administrator submits the create sheet, **Then** the
   customer is created, a confirmation toast names it, the sheet shows the new customer's detail,
   and the customer appears in the Available list.
3. **Given** the edit sheet of an available customer, **When** the administrator saves changes,
   **Then** the sheet returns to the customer's detail, a confirmation toast names it, and the list
   and detail show the corrected values.
4. **Given** either sheet with unsaved input, **When** the administrator chooses "Cancel" or closes
   the sheet, **Then** nothing is saved; "Cancel" closes the create sheet and returns the edit sheet
   to the customer's detail.

---

### User Story 4 - Archive and reactivate one customer (Priority: P2)

From the row menu ("View", "Edit", separator, "Archive" on an available row; "View", "Reactivate" on
an archived row) or from the detail sheet, an administrator opens a confirmation dialog. Archiving
asks "Archive {company name}?", explains that the customer (named by its code) can no longer be
added to a new discharge, that past discharges and reports keep it and that it can be reactivated
later, and takes an optional comment. Reactivating asks "Reactivate {company name}?", explains that
the customer can be added to new discharges again and that its archive stays in the history, and
takes an optional comment. A successful archive is confirmed by a toast "Customer “{company name}”
archived" and the counts update.

**Why this priority**: Lifecycle changes are rarer than consultation but carry consequences, so the
V2 copy that explains those consequences matters.

**Independent Test**: As an administrator, archive an available customer from its row menu with a
comment, then reactivate it from the Archived tab, and compare dialogs and toast with the retained
screens.

**Acceptance Scenarios**:

1. **Given** an available customer row, **When** an administrator opens its "Actions for {code}"
   menu, **Then** it offers View, Edit, a separator and Archive, Archive styled as a destructive
   item.
2. **Given** the archive dialog for Loire Minerals (LOIREMIN), **When** it opens, **Then** its title
   is "Archive Loire Minerals?", its text names LOIREMIN, the comment field is labelled "Comment
   (optional)" with the placeholder "Why is this customer archived?", and the actions are "Cancel"
   and a destructive "Archive".
3. **Given** the administrator confirms the archive, **When** it succeeds, **Then** the dialog
   closes, a toast reads "Customer “Loire Minerals” archived", the customer leaves the Available list
   and the tab counts update.
4. **Given** the reactivate dialog for Ouest Biomasse, **When** the administrator confirms with a
   comment, **Then** the customer returns to the Available list and its reactivation comment and
   actor appear in the Available table.
5. **Given** the archive is refused (for example the customer is used by a planned discharge),
   **When** the refusal returns, **Then** the administrator is told why and the customer stays
   available.

---

### User Story 5 - Bulk archive with a partial result (Priority: P3)

An administrator ticks several available customers (or uses the header checkbox to select all
listed). A bulk action bar appears showing "{n} selected" with "Archive" and "Clear". Choosing
Archive opens a confirmation dialog listing the selected customers by code and company name, with
an optional comment, "Cancel" and a destructive "Archive {n} customers". After submission, a toast
reports the outcome; when some customers could not be archived it states how many were archived and
names each skipped customer with its reason (e.g. "2 customers archived — NORDENG was skipped: a
planned discharge uses it."). Bulk reactivation on the Archived tab follows the same pattern.

**Why this priority**: Bulk handling is a power-user convenience layered on the single-customer
lifecycle.

**Independent Test**: As an administrator, select three available customers of which one is used by
a planned discharge, bulk archive them, and check the dialog and the partial-result toast against
the retained screens.

**Acceptance Scenarios**:

1. **Given** three available customers are selected, **When** the selection changes, **Then** a bulk
   action toolbar named "Bulk customer actions" shows "3 selected", "Archive" and "Clear".
2. **Given** the bulk archive dialog, **When** it opens, **Then** it lists each selected customer's
   code and company name, takes an optional comment (placeholder "Why are these customers
   archived?"), and its confirm button states how many customers will be archived.
3. **Given** one selected customer is used by a planned discharge, **When** the bulk archive
   completes, **Then** a toast reports "2 customers archived" and states that NORDENG was skipped
   because a planned discharge uses it, the two archived customers leave the list, and the selection
   narrows to the skipped customer.
4. **Given** every selected customer is archived, **When** the bulk archive completes, **Then** a
   success toast reports the number archived and the selection clears.
5. **Given** a selection, **When** the administrator changes tab or search, **Then** the selection
   clears.
6. **Given** a selection that includes a customer used by a planned discharge, **When** the bulk
   action bar and the bulk archive dialog render, **Then** neither announces that customer as
   skipped: the dialog lists every selected customer and its confirm action counts all of them;
   skipped customers are reported only in the result toast.

---

### User Story 6 - Read-only rendering for non-administrators (Priority: P2)

A user without administration rights sees the same lists, search, tabs, sorting, no-match state and
detail sheet, but no "Create customer" button, no selection checkboxes, no "Actions" column, and no
Edit, Archive or Reactivate action anywhere.

**Why this priority**: Most site users consult customers without administering them; they must not
be offered actions the API would refuse.

**Independent Test**: Sign in as an Observer, open Customers and a customer's detail, and compare
with the retained read-only screen.

**Acceptance Scenarios**:

1. **Given** an Observer, **When** Customers opens, **Then** the toolbar shows only the search field
   and the table shows Customer code, Company name and the two lifecycle columns, without selection
   or Actions columns.
2. **Given** an Observer opens a customer's detail, **When** the sheet renders, **Then** it shows
   the summary and History without any footer action.
3. **Given** an Observer navigates to the create or edit address directly, **When** the page loads,
   **Then** no create or edit sheet opens.

---

### User Story 7 - Light theme (Priority: P3)

A user who switched the appearance to light sees every Customers state above in the V2 light
palette, with the same layout and legible contrast.

**Why this priority**: The V2 palette ships both themes; Customers must not regress in light mode.

**Independent Test**: Switch to the light theme from the user menu and walk through the lists,
detail sheet, a dialog and a toast, comparing with the retained light-theme screen.

**Acceptance Scenarios**:

1. **Given** the light theme, **When** Customers opens, **Then** surfaces, borders, text, the active
   tab indicator, links and primary and destructive actions use the light V2 palette and every text
   pair keeps at least 4.5:1 contrast.

---

### Edge Cases

- A very long company name or comment is truncated in its cell with the full value available on
  hover, and wraps in the detail sheet and dialogs.
- Archiving the customer whose detail sheet is open updates the sheet in place to the archived
  state (Status "Archived", "Reactivate" offered).
- A bulk submission that fails entirely (network or server error) reports the failure in a toast and
  keeps the selection so the administrator can retry.
- Every selected customer is skipped: the toast states that none was archived and lists each with
  its reason.
- The no-match state for the Archived tab offers to show the Available tab when available customers
  match.
- At narrow widths the toolbar stacks, the table scrolls horizontally within its frame, and the
  sheet takes the full width.

## Requirements *(mandatory)*

### Functional Requirements

**Lists and toolbar**

- **FR-001**: The workbench MUST show the page title "Customers" in the shell header, a search field
  labelled "Search customers", and, for administrators only, a primary "Create customer" button with
  a plus icon.
- **FR-002**: The workbench MUST show "Available" and "Archived" tabs, each followed by its customer
  count, the selected tab marked by the V2 accent indicator.
- **FR-003**: The Available table MUST show Customer code, Company name, Reactivation comment and
  Reactivated; the Archived table MUST show Customer code, Company name, Archive comment and
  Archived. The Reactivated/Archived cell MUST show the actor's initials badge, full name and the
  transition date, or an em dash when there is none.
- **FR-004**: Customer codes MUST render in the monospaced face and act as links that open the
  customer's detail sheet, named "View customer {code}" for assistive technology.
- **FR-005**: Sortable columns MUST keep the existing sort behavior and per-tab sort memory, showing
  the active direction on the sorted column and a neutral affordance on the others.
- **FR-006**: When a search matches no customer in the active tab, the workbench MUST show a
  no-match panel naming the tab and the search term, describing which fields search looks in,
  offering "Clear search", and, when customers in the other tab match, stating their number and
  offering to show that tab.
- **FR-007**: Search MUST keep matching customer code, company name and lifecycle (archive and
  reactivation) comments, and the search field's placeholder and the no-match explanation MUST say
  so (e.g. placeholder "Search by code, company name or comment"; explanation "Search looks in
  customer codes, company names and lifecycle comments.").

**Row menu and selection (administrators)**

- **FR-008**: Each row MUST offer an "Actions for {code}" menu: View, Edit, a separator and a
  destructive Archive for an available customer; View and Reactivate for an archived customer.
- **FR-009**: Each row MUST offer a selection checkbox named "Select customer {code}", and the
  header a checkbox named "Select all available customers" / "Select all archived customers"
  acting on the customers currently listed.
- **FR-010**: While at least one customer is selected, a bulk action toolbar MUST show the number
  selected, the tab's bulk action (Archive on Available, Reactivate on Archived) and "Clear". The
  existing keyboard shortcuts for select-all and clear MUST keep working.

**Detail sheet**

- **FR-011**: The detail sheet MUST show the company name as title, the customer code beneath it, a
  close control, a summary of Status, Customer code, Created and Last updated, and a History section
  listing lifecycle transitions newest first with action, date and time, actor (initials badge and
  full name) and quoted comment.
- **FR-012**: For administrators, the detail sheet of an available customer MUST offer "Edit" and
  "Archive"; that of an archived customer MUST offer "Reactivate" only.
- **FR-013**: The detail sheet MUST NOT show a customer discharges section; that section belongs to
  #180.

**Create and edit sheets**

- **FR-014**: The create sheet MUST be titled "Create customer" with the subtitle "Available as soon
  as it is created", contain Customer code and Company name fields, a hint that the code identifies
  the customer in discharges and reports, is stored in uppercase and can be changed later, and the
  actions "Create customer" and "Cancel".
- **FR-015**: The edit sheet MUST be titled "Edit customer" with the subtitle "{company name} ·
  {code}", contain the same fields, a hint under the code that it is stored in uppercase and that
  reports already generated keep the previous code, and the actions "Save changes" and "Cancel".
- **FR-016**: A customer code already used by another customer MUST be reported on the Customer
  code field as "Already used by {company name}.", keeping the sheet open with the entered values.

**Lifecycle dialogs and toasts**

- **FR-017**: The archive dialog MUST be titled "Archive {company name}?", explain that the customer
  (named by code) can no longer be added to a new discharge, that past discharges and reports keep
  it and that it can be reactivated later, take an optional comment, and offer "Cancel" and a
  destructive "Archive".
- **FR-018**: The reactivate dialog MUST be titled "Reactivate {company name}?", explain that the
  customer (named by code) can be added to new discharges again and that its archive stays in the
  history, take an optional comment, and offer "Cancel" and "Reactivate".
- **FR-019**: A successful single archive MUST be confirmed by a toast reading "Customer “{company
  name}” archived"; a successful single reactivation MUST be confirmed by an equivalent toast.
- **FR-020**: The bulk archive dialog MUST list each selected customer's code and company name, take
  an optional comment, and offer "Cancel" and a destructive confirm action stating the number of
  customers to archive. The bulk reactivate dialog MUST follow the same layout.
- **FR-021**: After a bulk action, a toast MUST report the number of customers changed and, when some
  were skipped, name each skipped customer by code with a plain-language reason; the selection MUST
  then narrow to the skipped customers, or clear when none was skipped.

**Read-only, theme and shared**

- **FR-022**: Users without administration rights MUST see the lists, search, tabs, sort, no-match
  state and detail sheet without any create, edit, selection, row-menu or lifecycle control, and
  MUST NOT be able to open the create or edit sheet from the address.
- **FR-023**: Every state in this feature MUST render in both the dark and light V2 palettes using
  the shared theme tokens, with text contrast of at least 4.5:1.
- **FR-024**: The restyle MUST NOT change who may perform which action, the data shown, the address
  parameters that encode tab, search, sort, open customer and sheet mode, or the business rules of
  the sibling customer features beyond what this specification states.
- **FR-025**: Button labels MUST carry the action only (e.g. "Archive", "Edit", "Save changes"),
  creation buttons excepted ("Create customer").

### Key Entities

- **Customer**: a company registered for the site, identified by its Customer Code, with a company
  name, a status (Available or Archived), creation and update timestamps, and its latest archive and
  reactivation (actor, date, comment). No new attribute is introduced.
- **Lifecycle transition**: an archive or reactivation of a customer, with its actor, timestamp and
  optional comment, shown in the list's lifecycle columns and the detail History.
- **Bulk lifecycle outcome**: the result of a bulk archive or reactivation: the customers changed
  and the customers skipped, each with a reason (in use by a planned discharge, already in the
  target state, not found).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Each of the 16 retained Customers screens on the design canvas has a matching state in
  the application, and a side-by-side review finds no difference in layout, copy or available
  actions beyond those this specification documents (notably, no pre-submission preview of skipped
  customers in the bulk selection bar and dialog, and search copy that mentions lifecycle
  comments).
- **SC-002**: Every customer task available before the restyle (search, sort, switch tab, view,
  create, edit, archive, reactivate, bulk archive, bulk reactivate) can still be completed, with no
  increase in the number of steps.
- **SC-003**: 100% of text and interactive-control color pairs in the Customers states meet a 4.5:1
  contrast ratio in both themes.
- **SC-004**: A non-administrator finds zero create, edit, selection or lifecycle controls in any
  Customers state.
- **SC-005**: After a partial bulk archive, the administrator can identify every skipped customer
  and why from the toast alone, without opening another screen.
- **SC-006**: Every interactive control in the Customers states is reachable and operable by
  keyboard and has an accessible name.

## Clarifications

### Session 2026-10-22

- Q: Do the bulk selection bar and dialog preview skipped customers before submission, as drawn
  ("NORDENG is on a planned discharge and will be skipped", "Archive 2 of 3 customers?")? → A: No.
  Skipped customers are reported only in the result toast; the restyle introduces no API change.
  The design's pre-submission preview is a documented deviation.
- Q: Does search narrow to code and company name, as the design's copy says, or keep matching
  lifecycle comments? → A: Keep matching lifecycle comments; the placeholder and no-match copy say
  so. The design's "code or company name" wording is a documented deviation.
- Plan-time alignment (see `plan.md`, Spec adjustments): after a successful create or edit the
  sheet shows the customer's detail, as the `create-a-customer` and `update-a-customer` contracts
  already do; the bulk bar keeps the shared toolbar name "Bulk customer actions" rather than a
  "Bulk actions" region.

## Assumptions

- The V2 palette, theme tokens, shell header with page title, toast host and light/dark switch
  delivered by #314 (merged in #333) are available and are reused rather than redefined.
- The behavioral contracts of `list-customers`, `create-a-customer`, `update-a-customer`,
  `archive-a-customer` and `reactivate-a-customer` stay authoritative for business rules;
  this feature only changes presentation and the copy listed above.
- The canvas shows only the Available row menu; the Archived row menu (View, Reactivate) and the
  bulk reactivate flow follow the same pattern as their archive counterparts, matching today's
  behavior.
- The canvas does not draw a single reactivation toast; it mirrors the archive toast.
- Editing an archived customer stays refused, as today; the archived detail and row menu therefore
  offer no Edit.
- The "Already used by {company name}" message is derivable from the customers already listed and
  needs no new data from the API.
- Dates in list cells use the short day-month-year form drawn on the canvas (e.g. "14 Aug 2026");
  timestamps in the detail sheet use the existing date-and-time format.
- Responsive behavior below the drawn 1440px width follows the shell's existing conventions.

## Dependencies

- #314 / #333 — V2 palette and authenticated shell (merged).
- Out of scope: customer discharges in the detail sheet (#180) and the customer access model (#119).
