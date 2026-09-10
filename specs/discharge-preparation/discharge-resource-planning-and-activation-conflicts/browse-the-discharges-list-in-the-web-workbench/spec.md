# Feature Specification: Browse the Discharges List in the Web Workbench

**Feature Branch**: `whazzark/browse-the-discharges-list-in-the-web-workbench`

**Created**: 2026-07-09

**Last refined**: 2026-09-10

**Status**: Draft

**Input**: User description: "Browse the Discharges List in the Web Workbench. https://github.com/whazzark/portflow-ai/issues/61"

**Feature ID**: `GH-61`

**GitHub Issue**: [#61](https://github.com/whazzark/portflow-ai/issues/61)

**Parent Roadmap**: `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md`

**Roadmap Entry**: `GH-61`

**Priority**: priority:P0

**Milestone**: 3. Exploiter le modèle en lecture

**Domain**: discharge-preparation

## Clarifications

### Session 2026-09-10

- Q: Who may browse the discharges list, and which statuses can they see? → A: Every active
  authenticated user, in every role, may browse Planned, Active, and Closed discharges. Closed
  discharges stay readable as operational history rather than becoming administration-only.
- Q: How should the list present the Planned, Active, and Closed statuses? → A: One tab per status,
  following the directory convention, opening on Active discharges.
- Q: What should the list search match on? → A: Vessel name, vessel IMO, dock name, and also the
  customer names and product names of the discharge's product lots.
- Q: How should the closed discharges collection be bounded, given the site accumulates history and
  pagination is out of scope? → A: No bound. Each status collection returns every discharge it
  contains, and the 1,000-discharge performance target covers the whole closed history.
- Q: What happens when a user clicks a discharge row in this slice, given the detail screen is
  GH-58? → A: Nothing. Rows are inert read-only entries with no selection affordance; GH-58 adds
  selection and the detail panel.
- Q: When a search narrows the list, what should the status count show? → A: The status's total. The
  count is unchanged by the search, as in the existing directories.
- Q: Are the discharge counts visible on all three tabs at once, or only on the selected one? → A:
  All three at once, derived from a single read covering planned, active, and closed discharges.
- Q: Should the spec say "status" or "lifecycle state" for Planned, Active, and Closed? → A:
  "Status", matching the domain vocabulary in `CONTEXT.md`. The spec formerly referred to it as
  "lifecycle state" throughout.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the Site's Discharges by Status (Priority: P1)

As an active user, I want to reach a discharges workbench from the application's primary navigation
and consult the site's discharges grouped by their status, so that I can see what is being
discharged now, what is prepared for later, and what has already finished.

**Why this priority**: The site currently has no screen that shows a discharge at all. Making the
persisted discharges visible, correctly separated into planned, active, and closed work, is the
whole outcome of this slice and the entry point every later discharge screen is reached from.

**Independent Test**: Sign in as each active role against a dataset containing planned, active, and
closed discharges, open the discharges entry in the primary navigation, and verify that active
discharges are listed by default with their count and that the planned and closed collections are
each reachable and correct.

**Acceptance Scenarios**:

1. **Given** an active authenticated user in any role, **When** they open the application's primary
   navigation, **Then** the Operations group offers a Discharges entry that opens the discharges
   workbench.
2. **Given** the site has planned, active, and closed discharges, **When** an active user opens the
   discharges workbench, **Then** the active discharges are listed by default and each of the
   planned, active, and closed statuses shows its own count.
3. **Given** the discharges workbench is open, **When** the user switches to the planned or the
   closed collection, **Then** only the discharges in that status are listed, with that
   state's own count.
4. **Given** a discharge is listed in any status collection, **When** the user reads its entry,
   **Then** the vessel name, the dock, the expected start, the customers of its product lots, its
   number of product lots, and its number of shifts are visible, while the status is stated once by
   the selected tab rather than on every row.
5. **Given** an unauthenticated visitor or a user whose access is not active, **When** they request
   the discharges workbench, **Then** consultation is denied and no discharge, vessel, dock,
   customer, or product information is disclosed.
6. **Given** a discharge changes status while a user is consulting a stale collection,
   **When** the collection is refreshed or retried, **Then** the discharge appears in its
   authoritative current status collection and in no other.

---

### User Story 2 - Find and Situate a Discharge (Priority: P2)

As an active user, I want to find a discharge among the site's history by what I actually remember
about it — its vessel, its dock, its customer, or the product being unloaded — so that I can
identify the right one without scrolling through every discharge the site has ever run.

**Why this priority**: A discharge collection stays usable as the site accumulates history only if
users can narrow it. The ordering and the search scope are what make a list of several hundred
closed discharges navigable, but the collection already delivers value without them.

**Independent Test**: Populate each status with several discharges over multiple vessels,
docks, customers, and products, then search each of those five terms in turn and verify that only
the matching discharges of the selected status are listed, in a predictable order.

**Acceptance Scenarios**:

1. **Given** several discharges exist in the selected status, **When** the user searches by
   all or part of a vessel name, a vessel IMO, or a dock name, **Then** only the matching discharges
   of that state are listed.
2. **Given** several discharges exist in the selected status, **When** the user searches by
   all or part of a customer name or a product name, **Then** the discharges owning a matching
   product lot are listed, without the selected status changing.
3. **Given** the user searches with differing letter case or with surrounding whitespace, **When**
   the search is applied, **Then** matching is unaffected by either.
4. **Given** planned or active discharges are listed, **When** the collection is displayed, **Then**
   they are ordered by expected start, soonest first.
5. **Given** closed discharges are listed, **When** the collection is displayed, **Then** they are
   ordered by expected start, most recent first.
6. **Given** two discharges share the same vessel name, **When** both are listed, **Then** their
   dock, expected start, and customers distinguish them and neither is presented as the other.
7. **Given** a search is active, **When** the user switches status, **Then** the search
   applies to the newly selected state rather than being silently discarded.
8. **Given** a search narrows the listed discharges, **When** the collection is displayed, **Then**
   each status's count still reports the total number of discharges in that status.

---

### User Story 3 - Share and Restore a Consultation State (Priority: P3)

As an active user, I want the status I am looking at and the search I have typed to survive
a reload and to be shareable with a colleague, so that I can send someone the exact collection I am
discussing instead of describing how to reach it.

**Why this priority**: This is the repository's established behavior for every directory, and a
discharge collection is where operational conversations start. It refines an experience that is
already useful without it.

**Independent Test**: Select a status, type a search, copy the resulting address, reload it
and open it in a separate session, and verify that the same collection and search are restored.

**Acceptance Scenarios**:

1. **Given** the user has selected a status and typed a search, **When** the page is
   reloaded, **Then** the same status collection and the same search are restored.
2. **Given** the user copies the address of a filtered collection, **When** another authorized user
   opens it, **Then** they see the same status collection and search within their own permitted
   scope.
3. **Given** an address carries an unknown or invalid status, **When** it is opened,
   **Then** the workbench falls back to the default active collection rather than failing.

---

### User Story 4 - Recover From Empty and Failed Consultation (Priority: P3)

As an active user, I want distinct empty, no-match, loading, and failure feedback, so that I can
tell whether the site has no discharge in that state, my search found nothing, or consultation
simply has to be retried.

**Why this priority**: Without it, a site with no active discharge is indistinguishable from a
failed retrieval, and users escalate a working system.

**Independent Test**: Open the workbench with no discharges in the selected state, with a search
that matches nothing, and with a retryable retrieval failure, and verify that each state has its own
guidance and that retry recovers the collection.

**Acceptance Scenarios**:

1. **Given** the site has no discharge in the selected status, **When** the collection is
   displayed, **Then** an empty-state message specific to that status is shown.
2. **Given** discharges exist in the selected state but none match the search, **When** the search is
   applied, **Then** a no-match message is shown without claiming the status collection is empty.
3. **Given** discharge information cannot be retrieved, **When** consultation fails, **Then** an
   understandable failure message and a retry action are shown.
4. **Given** a previous retrieval failed and retrieval is available again, **When** the user retries,
   **Then** the current discharge collection is displayed.
5. **Given** the collection is being obtained, **When** the workbench is open, **Then** a clear
   loading state is shown rather than an empty collection.

### Edge Cases

- A status with no discharge at all remains selectable, keeps its own empty state, and
  does not hide the states that do contain discharges.
- A discharge whose dock has since been archived remains listed with the dock it uses; the archived
  dock is readable as history and is not replaced by another dock.
- A planned discharge with no product lot or no planned shift yet is still listed, showing zero
  rather than being omitted or presented as incomplete data.
- A discharge with no recorded vessel IMO is listed normally, with the absent value shown as an
  explicit muted `Not specified` placeholder rather than a fabricated or blank value.
- A closed discharge remains listed as history and is never presented as currently holding a dock,
  a truck, or a warehouse door for new operational work.
- Search input consisting only of whitespace behaves as no search; surrounding whitespace never
  prevents an otherwise matching vessel, dock, customer, or product name from being found.
- Vessel, dock, customer, and product names keep their display casing while search does not require
  the user to reproduce it.
- A discharge matching the search through several of its product lots is listed once, not once per
  matching lot.
- A site with a long closed history keeps the closed collection ordered and navigable rather than
  degrading into an unordered dump.
- A user consulting the workbench when the site has no discharge at all sees the empty state for
  each status collection and no error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow every active authenticated user, in every role, to consult the
  site's planned, active, and closed discharges.
- **FR-002**: The system MUST deny all discharge consultation to unauthenticated users and to users
  whose access is not active, disclosing no discharge, vessel, dock, customer, or product data.
- **FR-003**: The application's primary navigation MUST offer a Discharges entry in its Operations
  group that opens the discharges workbench, available to every active authenticated user.
- **FR-004**: The workbench MUST present the discharges of exactly one status at a time,
  offering Planned, Active, and Closed as the selectable states, and MUST select Active by default.
- **FR-005**: The workbench MUST show, for each status, the number of discharges that status
  contains. The count MUST report the state's total and MUST NOT change when a search narrows the
  listed rows.
- **FR-006**: Each listed discharge MUST expose its stable identity, vessel name, vessel IMO when
  recorded, dock, expected start, the customers of its product lots, its number of product lots,
  and its number of planned shifts. The status MUST NOT be repeated on each row: the selected tab
  already states which status is listed, so a status column would be one word repeated down it.
- **FR-007**: A discharge MUST appear in exactly one status collection, determined by its
  authoritative current status.
- **FR-008**: The user MUST be able to search the selected status collection by all or part of a
  vessel name, a vessel IMO, a dock name, a customer name of one of the discharge's product lots, or
  a product name of one of those lots.
- **FR-009**: Search matching MUST be unaffected by letter case and by surrounding whitespace, and a
  search consisting only of whitespace MUST behave as no search.
- **FR-010**: A discharge matching a search through several of its product lots MUST be listed once.
- **FR-011**: Changing the selected status MUST apply the current search to the newly
  selected state rather than discarding it.
- **FR-012**: The planned and active collections MUST use a deterministic ascending order by
  expected start, and the closed collection a deterministic descending order by expected start, with
  stable identity as the tie-breaker in every collection.
- **FR-013**: The selected status and the current search MUST be carried in the address, so
  that both survive a reload and can be shared with another authorized user.
- **FR-014**: An unknown or invalid status in a restored address MUST fall back to the
  default active collection rather than failing.
- **FR-015**: The system MUST show distinct feedback for an empty status collection and for a
  search with no matches.
- **FR-016**: The system MUST show a clear loading state while the collection is being obtained.
- **FR-017**: The system MUST show an understandable failure state with a retry action when
  retrieval fails, and retrying MUST display the current collection once retrieval is available.
- **FR-018**: Refreshing or retrying consultation MUST replace stale status, dock, customer, and
  product information with the authoritative current state.
- **FR-019**: A discharge MUST remain listed and readable when a site reference it uses has since
  been archived, without that reference being substituted by a current one.
- **FR-020**: Absent optional values, notably a missing vessel IMO, MUST be shown as an explicit
  placeholder and MUST NOT prevent a discharge from being listed.
- **FR-021**: Consultation MUST remain read-only for every role; this slice MUST NOT create,
  prepare, update, activate, close, or delete a discharge, and MUST NOT assign or release any dock,
  truck, warehouse door, weighing area, or shift.
- **FR-022**: This slice MUST NOT deliver the discharge detail screen; opening one discharge is the
  separate slice GH-58, which reuses the route and navigation entry created here.
- **FR-023**: Each status collection MUST contain every discharge in that status. The closed
  collection MUST NOT be truncated to a recent period, and MUST NOT require a search before it is
  listed.
- **FR-024**: Listed discharges MUST be presented as inert read-only entries. A row MUST NOT offer a
  selection affordance, MUST NOT open a panel, and MUST NOT carry a selected discharge in the
  address; selecting one discharge arrives with GH-58.

### Key Entities *(include if feature involves data)*

- **Discharge**: The operation of unloading a vessel at the site. For consultation it has a stable
  identity, a status of planned, active, or closed, a vessel description, a current dock,
  an expected start, product lots, and planned shifts.
- **Discharge Status**: The planned, active, or closed value that determines which collection a
  discharge is listed in.
- **Vessel Description**: The name, optional IMO, and optional comment identifying the vessel of a
  discharge. Only the name and the IMO are needed to identify a discharge in a list.
- **Dock**: The named operational berth where the vessel is discharged, shown to situate a discharge
  on the site and searchable by its name.
- **Product Lot**: A traceable quantity of bulk material for one customer within a discharge,
  identified by that customer and a product name. The list uses its customer name, its product name,
  and the count of lots per discharge.
- **Customer**: The company owning a product lot unloaded during the discharge, shown on the
  discharge entry and searchable by name.
- **Shift**: A work period belonging to a discharge. The list uses only the number of planned shifts
  as an indication of how far preparation has progressed.
- **Authorized User**: Any authenticated user with active access, in any role, permitted to consult
  every status of the site's discharges.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of active roles can consult the planned, active, and closed
  collections, and 100% of unauthenticated or non-active attempts receive no discharge, vessel, dock,
  customer, or product data.
- **SC-002**: In all acceptance datasets, 100% of the site's discharges appear in exactly one
  status collection matching their authoritative status, with no discharge missing and none
  duplicated across collections.
- **SC-003**: At least 90% of representative users can locate a named discharge from any one of its
  vessel, dock, customer, or product and read its status, dock, and expected start on their first
  attempt within 30 seconds.
- **SC-004**: For a site holding up to 1,000 discharges across all statuses, users see the
  requested collection or an explicit empty state within 2 seconds for at least 95% of consultation
  attempts under normal operating conditions.
- **SC-005**: Every tested empty, no-match, loading, stale-collection, and retrieval-failure
  condition produces distinct and accurate feedback, and 100% of retryable failures are recovered
  through the offered retry action once retrieval is available.
- **SC-006**: 100% of shared or reloaded consultation addresses restore the same status collection
  and search, and 100% of invalid status values fall back to the active collection
  without an error page.
- **SC-007**: Across the full acceptance run, 0% of consultation attempts change any discharge,
  shift, or site reference, verifying that the slice is read-only.

## Assumptions

- The deployment serves a single site, so every active authenticated user consults the same
  discharge collection; no per-site or per-organization filtering applies to this slice.
- Planned, Active, and Closed are the only discharge statuses relevant to consultation, and
  the domain's own status vocabulary is used rather than a harmonized one.
- Active is the default collection because it is what is happening on site now; Planned and Closed
  are each one explicit switch away for every role.
- The expected start is the ordering key for every collection, and it is recorded for every
  discharge, planned or not.
- A discharge's customers are the customers of its product lots; a discharge has no customer of its
  own.
- The product lot count and the planned shift count are shown as indicators of preparation progress.
  Reading a discharge's actual lots, shifts, doors, or trucks belongs to the detail slice GH-58.
- The read model consulted here was delivered by GH-236, which persists and seeds coherent planned,
  active, and closed preparation graphs; this slice adds no persistence and no seed data.
- The site is expected to hold up to 1,000 discharges across all statuses over its history, and each
  collection is consulted whole rather than in pages, as every other directory in the application
  already is.
- Consultation reads the site's discharges once and derives each status collection and each count
  from that single read, so switching status requires no further retrieval.
- The workbench is reached from the existing Operations navigation group, whose Discharges entry has
  no destination yet; this slice gives it one.
- Vessel names are not unique; a discharge is identified in the list by the combination of its
  vessel, dock, and expected start rather than by its vessel name alone.

## Out of Scope

- Opening one discharge and reading its full preparation graph, which is GH-58. Selecting a row is
  part of that slice, so rows are inert here.
- Preparing a discharge with its product lots and shifts (GH-53), assigning warehouse doors and
  checkpoints (GH-54), planning the truck pool and shift subsets (GH-55), and confirming a discharge
  start (GH-56).
- Any mutation of a discharge, a shift, or a site reference, including closing a discharge.
- The discharge activity log, discharge reports, rotation data, tonnage progress, and the operations
  dashboard.
- Pagination, saved filters, sorting chosen by the user, and exporting the collection.

## Dependencies

- No open issue blocks this slice. The operational read model it queries was delivered by GH-236,
  and neither `apps/api` nor `apps/web` carries a discharge query or route yet, so this slice creates
  them.
- It is the entry point of the roadmap's execution order: GH-58 depends on it for the route tree and
  the navigation entry, and the rest of the roadmap depends on GH-58.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/61
- Parent roadmap: specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md
- Blockers: recorded as GitHub issue dependencies on the source issue.
- Related domain: discharge-preparation
- Domain vocabulary: `CONTEXT.md` (Discharge, Planned Discharge, Active Discharge, Closed Discharge,
  Vessel Description, Product Lot, Customer, Dock, Shift).
