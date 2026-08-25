# Feature Specification: Archive a Warehouse

**Feature Branch**: `feat/210-archive-warehouse`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Let an authorized administrator archive an eligible warehouse without invalidating its doors. https://github.com/whazzark/portflow-ai/issues/210" — extended during specification review to include archiving several selected warehouses in one action.

**Feature ID**: `GH-210`

**GitHub Issue**: [#210](https://github.com/whazzark/portflow-ai/issues/210)

**Parent Roadmap**: `specs/site-references/storage-facilities/warehouses/roadmap.md`

**Domain**: site-references

## Clarifications

### Session 2026-08-25

- Q: Does this slice cover archiving one warehouse only, or also several selected warehouses in one action? → A: Both, matching the single-and-multiple contract already delivered for customers (`GH-195`), transport companies (`GH-220`), trucks (`GH-225`), docks (`GH-200`), and weighing areas (`GH-205`).
- Q: How does warehouse archival interact with the warehouse's doors? → A: Archiving a warehouse also archives every one of its available doors, in the same action and with the same lifecycle context. No door is deleted, renamed, moved, detached from its warehouse, or stripped of its history, and no door already archived is altered.
- Q: What then makes a warehouse ineligible for archival? → A: The warehouse must be available, and none of its doors may be currently in use by a Planned or Active Discharge, because archiving such a door would invalidate live operational work.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retire a Warehouse and Its Doors From Operational Use (Priority: P1)

As an organization administrator or operations administrator, I want to archive a storage building
the site no longer uses so that neither it nor its unloading doors are offered for new discharges,
while its name, footprint, doors, and past involvement stay fully consultable.

**Why this priority**: Without archival, a decommissioned or repurposed warehouse stays permanently
selectable for new operational work, and the only alternative — deleting it — would destroy the
footprint, doors, assignments, and rotations that closed discharges and reports depend on. This is
the primary outcome of the slice.

**Independent Test**: Sign in as an organization administrator or operations administrator, archive
an available warehouse none of whose doors is currently in use, and verify the warehouse leaves the
available collection, appears under the archived status with its archive context, keeps its name and
complete footprint, and that each of its formerly available doors is now archived under it with the
same archive context and an unchanged name, location, and containing warehouse.

**Acceptance Scenarios**:

1. **Given** an available warehouse whose doors are none of them currently in use, **When** an
   organization administrator archives it, **Then** the warehouse becomes archived and disappears
   from the available warehouse collection and from every selection offering warehouses for new
   operational work.
2. **Given** an available warehouse containing available doors, **When** an operations administrator
   archives it, **Then** every one of those doors becomes archived in the same action, carrying the
   same archive time, the same responsible administrator, and the same comment as the warehouse.
3. **Given** a warehouse containing both available and already archived doors, **When** it is
   archived, **Then** its available doors become archived and its already archived doors keep their
   existing archive time, actor, and comment unchanged.
4. **Given** a warehouse containing no door at all, **When** an authorized administrator archives it,
   **Then** the archival succeeds.
5. **Given** a warehouse has been archived, **When** its details are opened, **Then** its stable
   identity, name, complete footprint, and creation time are unchanged by the archival, and the
   archive time, responsible administrator, and archive comment when one was supplied are shown.
6. **Given** a warehouse has been archived, **When** its doors are consulted, **Then** each door
   keeps its stable identity, name, GPS location, and containing warehouse, and every past door
   assignment and rotation still points at that same door and remains readable.
7. **Given** an administrator archives a warehouse without supplying a comment, **When** the archival
   completes, **Then** the warehouse and its cascaded doors are archived with the archive time and
   responsible administrator recorded and no comment shown.
8. **Given** a warehouse has been archived, **When** the warehouse map is consulted under the
   archived status, **Then** the warehouse appears there with its archived status and its complete
   footprint polygon, and its archived doors are shown within that footprint.

---

### User Story 2 - Protect Warehouses Whose Doors Current Work Depends On (Priority: P1)

As the system, I want to refuse archival of a warehouse when any of its doors is still relied upon by
a Planned or Active Discharge, and to refuse archival by unauthorized users, so that archiving a
building never invalidates live unloading work and lifecycle changes stay accountable.

**Why this priority**: Because archival cascades to the warehouse's doors, archiving a warehouse
whose door is assigned to a product lot in current work would break live operational state — exactly
what this slice must not do. Unauthorized archival would silently withdraw a storage destination
other users still need. Both must be prevented from the first delivery of this behavior.

**Independent Test**: Attempt archival as an unauthenticated visitor, as each non-administrator
active role, on a warehouse one of whose doors holds a current product lot assignment in a Planned or
Active Discharge, and on a warehouse that is already archived; verify every attempt is refused, that
no warehouse and no door changes lifecycle state, and that each refusal states a specific, actionable
reason.

**Acceptance Scenarios**:

1. **Given** a user who is unauthenticated or whose access is not active, **When** they attempt to
   archive a warehouse, **Then** the attempt is denied, the warehouse and its doors stay unchanged,
   and no warehouse data is disclosed.
2. **Given** an active user without warehouse administration rights, **When** they attempt to archive
   a warehouse, **Then** the attempt is denied, the warehouse and its doors stay unchanged, and no
   archive action was offered to them.
3. **Given** an available warehouse one of whose doors holds a current product lot assignment
   belonging to a Planned or Active Discharge, **When** an authorized administrator attempts to
   archive it, **Then** the attempt is refused as in use, the warehouse and every one of its doors
   stay unchanged, and the reason identifies that a door of that warehouse is relied upon by current
   operational work.
4. **Given** a warehouse whose doors are involved only through Closed Discharges or through ended
   door assignments, **When** an authorized administrator archives it, **Then** the archival succeeds
   and every historical relationship remains readable.
5. **Given** a warehouse that is already archived, **When** an authorized administrator attempts to
   archive it again, **Then** the attempt is refused as already archived, and the existing archive
   context of both the warehouse and its doors is left unchanged.
6. **Given** a warehouse that does not exist or belongs to another operating site, **When** an
   authorized administrator attempts to archive it, **Then** the attempt is refused as not found and
   no other warehouse or door is modified.
7. **Given** an authorized administrator opens the archive confirmation for an eligible warehouse,
   **When** the confirmation is displayed, **Then** it names the warehouse, states how many of its
   available doors will be archived with it, states that the warehouse and those doors remain
   readable but are no longer selectable for new operational work, and offers an optional comment.
8. **Given** an administrator opens the archive confirmation, **When** the administrator abandons it,
   **Then** the warehouse and every one of its doors remain entirely unchanged.

---

### User Story 3 - Understand and Recover From a Refused Archival (Priority: P2)

As an organization administrator or operations administrator, I want each refused or failed archival
to explain itself and leave a safe retry path so that I can release the blocking work or retry a
transient failure without leaving a warehouse or its doors in an unclear lifecycle state.

**Why this priority**: An archival refusal is only useful if the administrator can tell an
authorization refusal from an in-use conflict, a stale view, or a temporary outage, and can act on
it. Without that, administrators retry blindly or assume the warehouse was archived when it was not —
and because archival cascades to doors, an ambiguous outcome is doubly costly.

**Independent Test**: Trigger an in-use conflict, an already-archived conflict, a stale-view
conflict, an over-long comment, and a transient failure in turn; verify each produces distinct
guidance, that neither the warehouse's nor any door's lifecycle state is ever left ambiguous or
partially applied, and that retrying after the blocking condition is resolved archives the warehouse
and its doors exactly once.

**Acceptance Scenarios**:

1. **Given** an archival was refused because a door of the warehouse is in use, **When** the blocking
   Discharge is closed or that door assignment ends and the administrator retries, **Then** the
   archival succeeds and the warehouse's available doors are archived with it.
2. **Given** an administrator is viewing a warehouse that another administrator archived in the
   meantime, **When** the administrator submits an archival, **Then** the attempt is refused as
   already archived and the refreshed view shows the warehouse's authoritative archived state and
   archive context.
3. **Given** an archival fails because the underlying service is temporarily unavailable, **When**
   the administrator retries after the service recovers, **Then** the warehouse and its doors are
   archived exactly once, with a single archive time, actor, and comment.
4. **Given** an archival is submitted twice in quick succession for the same warehouse, **When** both
   submissions are processed, **Then** the warehouse is archived exactly once and the later attempt
   is refused as already archived.
5. **Given** an archival is refused or fails for any reason, **When** the administrator reviews the
   warehouse, **Then** its displayed lifecycle state and every one of its doors' lifecycle states
   match their authoritative stored state, with no partial archive context recorded on the warehouse
   or on any door.
6. **Given** an archival is refused because the comment exceeds the maximum length, **When** the
   administrator shortens the comment and resubmits, **Then** the archival succeeds without the
   administrator having to reopen the warehouse or rebuild a selection.

---

### User Story 4 - Archive Several Warehouses at Once (Priority: P3)

As an organization administrator or operations administrator retiring a group of buildings — a
decommissioned storage row, a re-surveyed zone, an end-of-campaign cleanup — I want to select several
warehouses and archive them in one action so that I do not have to repeat the same confirmation once
per building, and so that I can see at a glance which ones could not be archived and why.

**Why this priority**: Single archival already delivers the outcome; multiple archival is an
efficiency multiplier over the same rule set, and it is only worth building once the single path, its
door cascade, and its refusals are proven. It is nonetheless part of this slice because site
reorganizations retire buildings in groups, and archiving them one by one both wastes time and makes
it easy to lose track of which ones were blocked.

**Independent Test**: Select a mixed set of warehouses — some eligible, one with a door currently
assigned in a Planned or Active Discharge, one already archived, one unknown identifier — archive
them in one action, and verify that exactly the eligible ones and their available doors become
archived with identical archive metadata, that every other warehouse and all of its doors are
untouched and reported with its own specific reason, and that the blocked ones can be retried on
their own.

**Acceptance Scenarios**:

1. **Given** an authorized administrator selects several eligible available warehouses, **When** they
   archive the selection in one action, **Then** every selected warehouse and each of its available
   doors becomes archived, the administrator is told how many warehouses were archived, and the
   warehouse map shows them removed from the available collection without a manual refresh.
2. **Given** a selection mixing eligible warehouses with one whose door is held by a Planned or Active
   Discharge, **When** the selection is archived, **Then** the eligible ones are archived, the held
   one and all of its doors stay unchanged, and the outcome names that warehouse and its in-use
   reason.
3. **Given** a selection containing a warehouse another administrator archived a moment earlier,
   **When** the selection is archived, **Then** the remaining eligible ones are archived and the
   already-archived one is reported as unchanged with its existing archive context, and that of its
   doors, intact.
4. **Given** a selection containing an identifier that resolves to no warehouse, **When** the
   selection is archived, **Then** that identifier is reported as not found and the other eligible
   warehouses are still archived.
5. **Given** several warehouses are archived in one action, **When** their details and their doors are
   opened, **Then** every archived warehouse and every door archived with them carries the same
   archive time, the same responsible administrator, and the same comment.
6. **Given** every warehouse in the selection is blocked, **When** the selection is archived, **Then**
   nothing is archived, the administrator is told that nothing changed, and each blocking reason is
   reported individually.
7. **Given** an outcome reported some warehouses as unchanged, **When** the administrator resolves the
   blocking condition and retries only those, **Then** the retry archives the ones that are now
   eligible and leaves the rest reported again, without reselecting them from the map.
8. **Given** a user who is unauthenticated or without warehouse administration rights, **When** they
   attempt a multiple archival, **Then** the whole attempt is denied, no warehouse and no door changes
   lifecycle state, and no multi-selection or bulk archive action was offered to them.
9. **Given** an administrator has selected warehouses under the available status, **When** they switch
   to the archived status or to the all-warehouses view, **Then** the selection no longer offers
   warehouses that are not listed in the new scope.

### Edge Cases

- An unauthenticated visitor or a user whose access is not active is denied archival without revealing
  whether the referenced warehouse exists.
- A door of the warehouse receives a current product lot assignment in a newly planned Discharge
  between the moment the administrator opens the warehouse and the moment they submit the archival:
  the archival is refused at submission time with a current, actionable in-use reason.
- The Discharge relying on a door of the warehouse moves to Closed, or that door assignment ends,
  between opening the warehouse and submitting the archival: the archival succeeds, because current
  usage is assessed at submission time.
- A warehouse containing no door at all is archivable; the absence of doors is not a failure and is
  not reported as an empty-cascade error.
- A warehouse all of whose doors are already archived is archivable, and no door's archive context is
  overwritten by the warehouse's archival.
- The number of doors displayed in the confirmation is the number of currently available doors
  assessed at submission time; if that number changed since the confirmation was opened, the
  authoritative submission-time set is archived and the reported outcome reflects it.
- Two administrators archive the same available warehouse at nearly the same time: exactly one
  archival is recorded, the doors are archived exactly once, and the other attempt is refused as
  already archived with no archive context overwritten. The same holds when one of them is archiving
  it as part of a larger selection.
- An archive comment containing only whitespace is treated as no comment rather than stored as a blank
  comment, on the warehouse and on every door archived with it.
- An archive comment longer than the permitted maximum length is refused with a specific validation
  reason, and every warehouse in the submission, with all of its doors, stays unchanged.
- A warehouse archived with a comment is later consulted: the original comment, time, and actor remain
  readable on the warehouse and on the doors archived with it, and are not altered by any later
  consultation.
- An archived warehouse retains any previous reactivation context; archival does not erase earlier
  lifecycle history, on the warehouse or on its doors.
- Archiving a warehouse does not release its name, and archiving its doors does not release their
  names within it: names stay reserved across both lifecycle states.
- Rotations, product lot assignments, and shift door memberships already recorded against a door keep
  pointing at that same door after its warehouse is archived and remain readable, including for the
  correction of an unvalidated rotation whose target door has since been archived.
- A multiple archival in which every selected warehouse turns out to be ineligible archives nothing
  and reports a reason for each one, rather than reporting an unexplained failure.
- A multiple archival naming the same warehouse twice is rejected as an invalid submission rather than
  archiving it once and reporting the duplicate as already archived.
- A multiple archival submitted with an empty selection is rejected as an invalid submission and
  archives nothing.
- A multiple archival carrying a malformed identifier is rejected as an invalid submission before any
  warehouse or door changes, which is distinct from a well-formed identifier that resolves to nothing
  and is reported per warehouse as not found.
- A door of a selected warehouse becomes assigned within a Planned or Active Discharge after the
  administrator selected the warehouse but before the submission is processed: that warehouse is
  reported as unchanged while the rest of the selection is archived.
- Two administrators submit overlapping selections at nearly the same time: each overlapping warehouse
  is archived exactly once, and the losing submission reports it as already archived without
  overwriting the recorded archive context of the warehouse or of its doors.
- A selected warehouse is filtered out of view by a search term: it remains part of the selection,
  because search narrows what is displayed rather than what the administrator chose.
- A multiple archival fails part-way through because the underlying service becomes unavailable: no
  warehouse and no door in the submission is left archived, and the administrator can retry the same
  selection.

## Requirements *(mandatory)*

### Functional Requirements

#### Archiving one warehouse

- **FR-001**: The system MUST allow only active organization administrators and operations
  administrators to archive a warehouse belonging to their operating site.
- **FR-002**: The system MUST deny archival to unauthenticated users, to users whose access is not
  active, and to every active role without warehouse administration rights, without changing any
  warehouse or door and without disclosing warehouse data.
- **FR-003**: The system MUST refuse archival of a warehouse that does not exist or belongs to another
  operating site, without modifying any warehouse or door and without disclosing information about
  other warehouses.
- **FR-004**: The system MUST refuse archival of a warehouse that is already archived, and MUST leave
  the existing archive time, actor, and comment of that warehouse and of each of its doors unchanged.
- **FR-005**: The system MUST refuse archival of an available warehouse when at least one of its doors
  is currently in use, and MUST leave the warehouse and every one of its doors unchanged.
- **FR-006**: A warehouse door MUST count as currently in use exactly as defined by the shared
  site-reference usage rules — a current product lot assignment belonging to a Planned or Active
  Discharge — and this feature MUST NOT introduce a second definition of door usage.
- **FR-007**: The system MUST NOT treat involvement through Closed Discharges, through ended door
  assignments, or through past rotations as current usage that blocks archival.
- **FR-008**: The system MUST assess door usage at the moment archival is submitted rather than at the
  moment the warehouse was opened for review.
- **FR-009**: A warehouse containing no door, or containing only archived doors, MUST be archivable.
- **FR-010**: A successful archival MUST change the warehouse's lifecycle status from available to
  archived and MUST record the archive time, the responsible administrator, and the supplied archive
  comment.
- **FR-011**: A successful archival MUST change every currently available door of that warehouse to
  archived, recording on each of them the same archive time, the same responsible administrator, and
  the same comment as the warehouse.
- **FR-012**: A successful archival MUST leave every door of that warehouse that is already archived
  entirely unchanged, including its existing archive time, actor, and comment.
- **FR-013**: The system MUST record, for each door archived as part of its warehouse's archival, that
  it was archived through its warehouse rather than on its own, so that a later warehouse
  reactivation can restore exactly those doors.
- **FR-014**: The system MUST accept an optional archive comment, MUST trim surrounding whitespace
  from it, and MUST record no comment when the supplied value is absent, empty, or whitespace-only.
- **FR-015**: The system MUST reject an archive comment that exceeds the maximum lifecycle comment
  length of 1,000 characters, with a specific validation reason and no lifecycle change to any
  warehouse or door in the submission.
- **FR-016**: A successful archival MUST preserve the warehouse's stable identity, name, complete
  footprint including every boundary point, creation time, and any earlier reactivation context.
- **FR-017**: A successful archival MUST preserve every door's stable identity, name, GPS location,
  containing-warehouse relationship, creation time, and any earlier reactivation context, and MUST
  NOT detach, relocate, rename, or delete any door.
- **FR-018**: A successful archival MUST NOT modify any product lot assignment, shift door membership,
  rotation, or Discharge that references the warehouse or its doors; all such records MUST remain
  readable and attached to the same doors.
- **FR-019**: An archived warehouse, its footprint, and its doors MUST remain consultable as read-only
  historical references by every active user, consistent with the archived-warehouse visibility rules
  already established by warehouse consultation.
- **FR-020**: An archived warehouse MUST be excluded from the available warehouse collection, from the
  available warehouse count, and from every collection offering warehouses for selection for new
  operational work.
- **FR-021**: A door archived as part of its warehouse's archival MUST be excluded from every
  collection offering warehouse doors for selection for new operational work.
- **FR-022**: Archiving a warehouse MUST NOT release its name for reuse, and archiving its doors MUST
  NOT release their names within that warehouse.
- **FR-023**: The archive experience MUST require an explicit confirmation that names the warehouse,
  states how many of its available doors will be archived with it, states that the warehouse and those
  doors remain readable but are no longer selectable for new operational work, and offers an optional
  comment.
- **FR-024**: The administrator MUST be able to abandon an archival in progress, leaving every targeted
  warehouse and every one of their doors unchanged.
- **FR-025**: The system MUST report authorization refusals, not-found refusals, already-archived
  conflicts, door-in-use conflicts, comment validation failures, invalid submissions, and transient
  failures with distinct, understandable, and actionable feedback.
- **FR-026**: The system MUST ensure that repeated or concurrent archival attempts for the same
  warehouse result in exactly one recorded archival of that warehouse and of its doors, with every
  later attempt refused as already archived, whether the warehouse was submitted on its own or as part
  of a multiple archival.
- **FR-027**: A warehouse archival MUST be recorded in full or not at all: a failure MUST never leave a
  warehouse archived while some of its available doors remain available, nor doors archived while
  their warehouse remains available.
- **FR-028**: A refused or failed archival MUST leave the stored lifecycle state and lifecycle context
  of the warehouse and of every one of its doors exactly as they were before the attempt.
- **FR-029**: After an archival succeeds or is refused, the warehouse consultation experience MUST
  reflect the authoritative current lifecycle state and context of the warehouse and its doors without
  requiring the administrator to leave the warehouse map or reload the page.
- **FR-030**: The archive action MUST be offered only for warehouses the administrator is permitted to
  archive, while server-side authorization remains authoritative.
- **FR-031**: The system MUST NOT permanently delete a warehouse or a warehouse door.

#### Archiving several warehouses at once

- **FR-032**: The system MUST allow an authorized administrator to submit several warehouses for
  archival in one action.
- **FR-033**: A multiple archival MUST be authorized by exactly the same administration right as
  archiving one warehouse, and MUST be denied as a whole to every other user.
- **FR-034**: A multiple archival MUST apply the same existence, lifecycle-state, and door-usage rules
  to every submitted warehouse as a single archival, assessed at submission time against authoritative
  stored state rather than against the collection the administrator was looking at.
- **FR-035**: A multiple archival MUST archive every eligible warehouse in the submission, together
  with its available doors, and leave every ineligible warehouse and all of its doors unchanged,
  rather than refusing the whole submission because one warehouse is ineligible.
- **FR-036**: A multiple archival MUST report, for each warehouse it left unchanged, an identifying
  label and exactly one specific reason distinguishing not found, already archived, and door in use.
- **FR-037**: Every warehouse archived within one multiple archival, and every door archived with
  those warehouses, MUST record the same archive time, the same responsible administrator, and the
  same comment.
- **FR-038**: A multiple archival MUST record either all of its eligible archivals or none of them, so
  a failure part-way through never leaves some warehouses archived and others silently skipped.
- **FR-039**: A multiple archival MUST NOT partially archive an individual warehouse: each one is
  either archived together with all of its available doors and its complete lifecycle metadata, or
  left entirely untouched.
- **FR-040**: The system MUST reject, before any warehouse or door changes, a submission that names no
  warehouse, that names the same warehouse more than once, or that carries a malformed identifier.
- **FR-041**: The system MUST report the aggregate outcome of a multiple archival, stating how many
  warehouses were archived and how many were left unchanged.
- **FR-042**: The administrator MUST be able to select several warehouses in the warehouse map, see
  how many are selected, clear the selection, and retry only the warehouses reported as unchanged
  without reselecting them.
- **FR-043**: Selection MUST offer only warehouses the administrator is permitted to archive, MUST NOT
  carry a selected warehouse into a lifecycle status scope where it is no longer listed, and MUST keep
  a selected warehouse that is merely hidden by a search term.
- **FR-044**: The multi-selection and bulk archive experience MUST be offered only to users authorized
  to archive, and MUST NOT interfere with selecting a single warehouse to consult its details and
  doors.
- **FR-045**: Selecting and archiving warehouses MUST behave consistently with the equivalent
  checkpoint behavior already delivered on the Checkpoints map — the same way selection is entered and
  left, the same selection shortcuts, and the same outcome reporting — so that administrators meet one
  interaction model across site references rather than a second one for warehouse polygons.

#### Out of scope

- **FR-046**: This slice MUST NOT create, update, reactivate, or permanently delete warehouses; MUST
  NOT create, update, relocate, or independently archive or reactivate a warehouse door; and MUST NOT
  archive any other site-reference type. Those behaviors remain owned by separate delivery slices.

### Key Entities *(include if feature involves data)*

- **Warehouse**: The storage destination being retired from operational use. Archival changes only its
  lifecycle status and archive context; its stable identity, name, complete footprint, and creation
  time are preserved.
- **Warehouse Footprint**: The warehouse's geographic polygon, including every boundary point.
  Archival does not alter it, and it remains consultable for the archived warehouse.
- **Warehouse Door**: An unloading door permanently belonging to one warehouse. When its warehouse is
  archived, an available door becomes archived with it and records that it was archived through its
  warehouse; an already archived door is untouched. No door's identity, name, location, containing
  warehouse, or history is altered.
- **Warehouse Lifecycle Context**: The archive information recorded by this feature — archive time,
  responsible administrator, and optional comment — alongside any previously recorded reactivation
  context, which archival preserves. A warehouse and the doors archived with it share identical
  context, as do all warehouses archived by the same action.
- **Warehouse Door Usage**: The determination of whether a door currently holds a product lot
  assignment belonging to a Planned or Active Discharge. A single such door makes its whole warehouse
  ineligible for archival; Closed Discharges and ended assignments are ignored.
- **Discharge**: The operational work that may currently rely on a warehouse through one of its doors.
  A Planned or Active Discharge blocks archival of the warehouse owning the door it holds; a Closed
  Discharge retains its historical references without blocking archival.
- **Warehouse Selection**: The set of warehouses an administrator has chosen in the warehouse map for
  a multiple archival. It holds only warehouses the administrator may archive, is scoped to the
  lifecycle status in which they were chosen, is unaffected by search, and can be cleared or narrowed
  to the ones a previous attempt left unchanged.
- **Archival Outcome**: The result of a multiple archival, pairing the warehouses that were archived
  with the ones left unchanged. Each unchanged warehouse carries an identifying label and one specific
  reason: not found, already archived, or door in use.
- **Authorized Administrator**: An active organization administrator or operations administrator
  permitted to archive a warehouse at their operating site.
- **Operating Site**: The operational scope that owns warehouse records and bounds which warehouses an
  authorized administrator may archive.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of archival attempts by organization administrators and
  operations administrators on eligible available warehouses succeed, and the warehouse is absent from
  available consultation and present in archived consultation immediately afterward without a manual
  reload.
- **SC-002**: In acceptance testing, 100% of archival attempts by unauthenticated users, non-active
  users, and active users without warehouse administration rights are denied with zero lifecycle
  changes to any warehouse or door, for single and multiple archival alike, and no archive action is
  offered to them.
- **SC-003**: In acceptance testing, 100% of archival attempts on warehouses having at least one door
  currently assigned within a Planned or Active Discharge are refused with the warehouse and all of
  its doors left unchanged and a specific door-in-use reason shown; and 100% of warehouses whose doors
  are involved only through Closed Discharges or ended assignments, whose doors are all archived, or
  that have no door, are archived successfully.
- **SC-004**: In every successful archival, 100% of the warehouse's available doors are archived in
  the same action with an identical archive time, actor, and comment, and 100% of its already archived
  doors keep their original archive time, actor, and comment unchanged.
- **SC-005**: In acceptance testing, 100% of archived warehouses retain their name, complete footprint
  with every boundary point, creation time, and prior reactivation context unchanged; 100% of their
  doors retain their name, GPS location, and containing warehouse; and 0% of warehouses or doors are
  permanently deleted.
- **SC-006**: In acceptance testing, 100% of product lot assignments, shift door memberships, and
  rotations previously attached to a door of an archived warehouse remain attached to that same door
  and readable, and 0% of archived warehouses or their doors appear in any collection offering
  warehouses or doors for new operational work.
- **SC-007**: In all acceptance datasets, repeated and near-simultaneous archival attempts on the same
  warehouse produce exactly one recorded archival of the warehouse and of each of its doors, with zero
  archive contexts overwritten, whether the competing attempts are single or multiple.
- **SC-008**: Across every tested failure and refusal path, 0% of runs leave a warehouse archived
  while one of its available doors remains available, or a door archived while its warehouse remains
  available.
- **SC-009**: Every tested refusal condition — authorization, not found, already archived, door in
  use, over-long comment, empty selection, duplicated selection, malformed identifier, and transient
  failure — produces distinct and accurate feedback, and every transient failure can be recovered
  through a retry that archives each warehouse and its doors exactly once.
- **SC-010**: In a multiple-archival acceptance matrix mixing eligible, door-blocked, already-archived,
  and unknown warehouses, 100% of eligible ones are archived with their doors and 100% of blocked ones
  are reported with their correct individual reason and left unchanged, in every tested combination
  including the all-blocked case.
- **SC-011**: Archiving a selection of 50 warehouses totalling up to 500 doors completes within 2
  seconds in the acceptance environment, and the administrator sees a confirmed result or an explicit
  refusal within 2 seconds for 95% of submissions under normal operating conditions.
- **SC-012**: At least 90% of representative authorized administrators can archive an intended
  warehouse, or understand why they cannot, on their first attempt within 45 seconds of opening it,
  and correctly state before confirming how many doors will be archived with it.
- **SC-013**: At least 90% of representative administrators can select several warehouses, archive
  them, and correctly state from the reported outcome which ones were not archived and why, on their
  first attempt.

## Assumptions

- "Authorized administrator" means an active organization administrator or an active operations
  administrator, the same administration right already applied to every other site-reference lifecycle
  action. Warehouse consultation itself remains open to every active user, as established by List
  Warehouses (#207), so archived warehouses and their doors stay readable to all active users rather
  than to administrators only.
- Each operating organization owns exactly one site, so the administrator's organization determines
  which warehouses they may archive.
- **The door cascade supersedes the current `CONTEXT.md` warehouse definition.** `CONTEXT.md` states
  that a warehouse "cannot be archived while it still has available warehouse doors". This
  specification instead archives those doors together with the warehouse, per the product decision
  recorded in Clarifications. Delivering this slice therefore requires amending the `Warehouse` entry
  in `CONTEXT.md` to describe the cascade and the door-usage blocking rule; leaving the two in
  disagreement would violate the constitution's single-home rule for domain vocabulary.
- "Without invalidating its doors" is read as: no door is deleted, detached from its warehouse,
  renamed, relocated, stripped of its assignment and rotation history, or left in an inconsistent
  state. Archiving a door alongside its warehouse withdraws it from new operational work while keeping
  it entirely readable, which is what archival means for every site reference.
- Because archival cascades to doors, the eligibility rule is stated at door level: a warehouse is
  eligible when it is available and none of its doors is currently in use. Warehouses have no direct
  relationship to a Discharge of their own; they serve operations exclusively through their doors.
- Warehouse-door usage is the shared site-reference usage rule established by Enforce Persisted
  Site-Reference Usage Rules (`#240` FR-006) — a current product lot assignment in a Planned or Active
  Discharge — reused as-is rather than redefined here.
- Archive a Warehouse Door (#215) and Reactivate a Warehouse Door (#216) remain separate slices. This
  slice does not depend on them: a warehouse with no door, or one whose doors are already archived
  through seeded fixtures, is archivable today, and a warehouse with available doors is archivable
  through the cascade. Archiving or reactivating a single door independently of its warehouse remains
  out of scope.
- FR-013 records the cascade linkage so that Reactivate a Warehouse (#211) can restore exactly the
  doors this feature archived, without resurrecting doors that were archived on their own beforehand.
  How #211 uses that record is its own decision and is out of scope here.
- The archive comment is optional free text with a maximum length of 1,000 characters, the shared
  site-reference lifecycle comment limit already applied to customer, transport-company, truck, dock,
  and weighing-area archival. One comment applies to the whole submission, whether it names one
  warehouse or many, and is copied onto every door archived by that submission.
- Archival is offered both for one warehouse at a time and for several selected warehouses in one
  action, per the product decision recorded in Clarifications and matching the five delivered sibling
  archive slices. Multiple archival applies exactly the same eligibility rules as single archival and
  adds no new rule of its own.
- A multiple archival reports partial success rather than refusing everything when one warehouse is
  ineligible, matching the site-reference lifecycle precedent already delivered for customers
  (`GH-195`), transport companies (`GH-220`), trucks (`GH-225`), docks (`GH-200`), and weighing areas
  (`GH-205`).
- Invalid submissions — empty, duplicated, or malformed selections — are rejected as a whole before
  any warehouse changes, which is deliberately distinct from a well-formed identifier that resolves to
  nothing and is reported per warehouse as not found.
- No explicit maximum number of warehouses per submission is imposed, following the shared selection
  rule already used for the other site-reference bulk lifecycle actions. Realistic selections are
  bounded by the site's low-cardinality warehouse collection, sized at up to 200 warehouses by #207.
- Multiple archival requires a selection model on the warehouse map. List Warehouses (#207) did not
  deliver one, but Archive Docks (#200) and Archive Weighing Areas (#205) have delivered exactly this
  model — a select mode, checkable map features, a bulk action bar, and selection shortcuts — for
  markers on the Checkpoints map, which #207 already established as the shared consultation
  interaction contract for the warehouse map. This slice extends that delivered model from point
  markers to warehouse polygons rather than inventing a second one, which is what FR-045 requires.
- Available and archived remain the only warehouse and warehouse-door lifecycle states; archival is
  reversible only through Reactivate a Warehouse (#211), a separate delivery slice that depends on
  this one.
- Reactivating an archived warehouse replaces its most recent lifecycle context rather than
  accumulating history, consistent with the existing site-reference lifecycle model.
- Archival never deletes data. Permanent deletion of a warehouse or a warehouse door is out of scope
  for this and every current storage-facility slice.
- Warehouse names remain reserved across both lifecycle states, consistent with the site-reference
  name-uniqueness convention; door names remain unique within their containing warehouse across both
  states, as already established by List Warehouse Doors (#212 FR-006a).
- The archive experience is offered from the map-based warehouse consultation area introduced by #207,
  reusing its lifecycle-status filters and name search rather than living on a separate standalone
  page.
- Multi-selection is a distinct concept from selecting one warehouse to consult its details and doors;
  the two coexist without one overriding the other.
- API authorization and eligibility checks are authoritative for every rule in this specification; any
  interface-level restriction is a courtesy that does not replace server-side enforcement.
- The established application language, validation-messaging, focus-management, and accessibility
  conventions apply to the archive flow's labels, confirmations, errors, and outcome reporting.
- Warehouse and warehouse-door records already exist through the seeded site-reference fixtures, so
  this slice is verifiable against existing data without depending on Create a Warehouse (#208).
- List Warehouses (#207), Create a Warehouse (#208), Update a Warehouse (#209), and Reactivate a
  Warehouse (#211) are independently deliverable sibling issues and stay outside this slice, as does
  the archival of any other site-reference type.
