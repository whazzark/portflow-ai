# Feature Specification: Archive a Warehouse Door

> **Amended by [#216 Reactivate a Warehouse Door](../reactivate-a-warehouse-door/spec.md).** A door
> is archived *on its own* exactly while its containing warehouse is available; nothing on the door
> records that. Archiving the warehouse afterwards takes this door over — replacing its archive time,
> actor, and comment with the building's — and reactivating the warehouse brings it back with every
> other door. `warehouse_doors.archived_with_warehouse`, which the requirements below write, is
> dropped. The passages this changes are marked in place.

**Feature Branch**: `feat/215-archive-warehouse-door`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Archive a Warehouse Door — Let an authorized administrator archive an eligible warehouse door while preserving history. https://github.com/whazzark/portflow-ai/issues/215" — extended during specification to include archiving several selected doors of the same warehouse in one action.

**Feature ID**: `GH-215`

**GitHub Issue**: [#215](https://github.com/whazzark/portflow-ai/issues/215)

**Parent Roadmap**: `specs/site-references/storage-facilities/warehouse-doors/roadmap.md`

**Domain**: site-references

## Clarifications

### Session 2026-08-27

- Q: Does this slice cover archiving one door only, or also several selected doors in one action? → A: Both, matching the single-and-multiple contract already delivered for customers (`GH-195`), transport companies (`GH-220`), trucks (`GH-225`), docks (`GH-200`), weighing areas (`GH-205`), and warehouses (`GH-210`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retire One Door From Operational Use (Priority: P1)

As an organization administrator or operations administrator, I want to archive a single unloading
door that is walled up, condemned, or no longer usable, so that it stops being offered for new
discharges while its name, position, and complete operational past stay readable under its
warehouse.

**Why this priority**: This is the primary outcome of the slice. A door that can no longer receive
trucks stays selectable for new work forever otherwise, and the only alternatives are worse:
deleting it would destroy the product lot assignments, shift memberships, and rotations that closed
discharges and reports depend on, and archiving the whole warehouse would withdraw every other door
of a building that is still perfectly operational.

**Independent Test**: Sign in as an organization administrator or operations administrator, select
an available warehouse, archive one of its available doors that no Planned or Active Discharge
relies on, and verify the door leaves the available door view, appears under the archived view with
its archive time, responsible administrator, and optional comment, is described as archived on its
own rather than with its warehouse, and keeps its identity, name, GPS location, containing
warehouse, and every record that referenced it.

**Acceptance Scenarios**:

1. **Given** an available door of an available warehouse that no Planned or Active Discharge relies
   on, **When** an organization administrator archives it, **Then** the door becomes archived,
   leaves the warehouse's available door view, and stops being offered in every collection
   proposing doors for new operational work.
2. **Given** an available door, **When** an operations administrator archives it with a comment,
   **Then** the archive time, the responsible administrator, and the trimmed comment are recorded on
   that door and shown when it is consulted.
3. **Given** an administrator archives a door without supplying a comment, **When** the archival
   completes, **Then** the door is archived with its archive time and responsible administrator
   recorded and no comment shown.
4. **Given** a door has been archived on its own — its warehouse still being available — **When** it
   is consulted under that warehouse, **Then** it is presented as archived on its own rather than
   archived with its warehouse, and it keeps its stable identity, name, GPS location, containing warehouse, and creation time unchanged.
5. **Given** a door has been archived, **When** the warehouse's door lifecycle views are consulted,
   **Then** the available count no longer includes it, the archived count does, and its marker is
   presented as archived at the same position inside the warehouse footprint.
6. **Given** a door has been archived, **When** the product lot assignments, shift door memberships,
   rotations, and discharges that referenced it are consulted, **Then** they still point at that
   same door and remain readable.
7. **Given** an archived door, **When** an administrator creates another door in the same warehouse
   under the archived door's name, **Then** the name is refused as a duplicate, because archiving a
   door does not release its name within its warehouse.
8. **Given** the last available door of a warehouse is archived, **When** the warehouse is
   consulted, **Then** the warehouse itself is still available, with an empty available door view
   and its own lifecycle state and context untouched.
9. **Given** a door has been archived, **When** an unvalidated rotation that targeted it is
   corrected, **Then** the archived door remains historically eligible exactly as before its
   archival.

---

### User Story 2 - Protect Doors Current Work Depends On (Priority: P1)

As the system, I want to refuse archival of a door still relied upon by a Planned or Active
Discharge, and to refuse archival by unauthorized users, so that retiring an unloading point never
invalidates live work and lifecycle changes stay accountable.

**Why this priority**: Archiving a door that a planned or active discharge is currently unloading
into would break live operational state, and an unauthorized archival would silently withdraw an
unloading point other users still need. Both must be prevented from the first delivery of this
behavior.

**Independent Test**: Attempt archival as an unauthenticated visitor, as each non-administrator
active role, on a door holding a current product lot assignment in a Planned or Active Discharge, on
an already archived door, on a door of an archived warehouse, and on an identifier that resolves to
no door; verify every attempt is refused, that no door changes lifecycle state, and that each
refusal states a specific, actionable reason.

**Acceptance Scenarios**:

1. **Given** a user who is unauthenticated or whose access is not active, **When** they attempt to
   archive a door, **Then** the attempt is denied, the door stays unchanged, and no warehouse-door
   data is disclosed beyond the application's established access-handling behavior.
2. **Given** an active user without warehouse-door administration rights, **When** they consult a
   warehouse's doors, **Then** no archive action is offered on any door, and a direct attempt is
   denied with the door left unchanged.
3. **Given** an available door holding a current product lot assignment belonging to a Planned or
   Active Discharge, **When** an authorized administrator attempts to archive it, **Then** the
   attempt is refused as in use, the door stays available, and the reason identifies that current
   operational work relies on that door.
4. **Given** a door involved only through Closed Discharges or through ended door assignments,
   **When** an authorized administrator archives it, **Then** the archival succeeds and every
   historical relationship remains readable.
5. **Given** a door that is already archived, whether on its own or with its warehouse, **When** an
   authorized administrator attempts to archive it again, **Then** the attempt is refused as already
   archived and its existing archive time, actor, and comment are left unchanged.
6. **Given** a door whose containing warehouse is archived, **When** an authorized administrator
   attempts to archive it, **Then** the attempt is refused and no door or warehouse changes state.
7. **Given** an identifier that resolves to no door, or a door belonging to another operating site,
   **When** an authorized administrator attempts to archive it, **Then** the attempt is refused as
   not found and no other door is modified.
8. **Given** an authorized administrator opens the archive confirmation for an eligible door,
   **When** the confirmation is displayed, **Then** it names the door, states that it remains
   readable but is no longer available for new operations, and offers an optional comment.
9. **Given** an administrator opens the archive confirmation, **When** they abandon it, **Then** the
   door remains entirely unchanged and the warehouse consultation area returns to its normal state.

---

### User Story 3 - Understand and Recover From a Refused Archival (Priority: P2)

As an organization administrator or operations administrator, I want each refused or failed archival
to explain itself and leave a safe retry path, so that I can release the blocking work or retry a
transient failure without ever being unsure whether a door was archived.

**Why this priority**: A refusal is only useful if the administrator can tell an authorization
refusal from an in-use conflict, a stale view, or a temporary outage, and can act on it. Without
that, administrators retry blindly or assume a door was withdrawn from operations when it was not.

**Independent Test**: Trigger an in-use conflict, an already-archived conflict caused by a stale
view, an over-long comment, and a transient failure in turn; verify each produces distinct guidance,
that no door is ever left in an ambiguous or partially applied lifecycle state, and that retrying
after the blocking condition is resolved archives the door exactly once.

**Acceptance Scenarios**:

1. **Given** an archival was refused because the door is in use, **When** the blocking Discharge is
   closed or that door assignment ends and the administrator retries, **Then** the archival succeeds.
2. **Given** an administrator is viewing a door that another administrator archived in the meantime,
   **When** they submit an archival, **Then** it is refused as already archived and the refreshed
   view shows the door's authoritative archived state and archive context.
3. **Given** an archival fails because the underlying service is temporarily unavailable, **When**
   the administrator retries after recovery, **Then** the door is archived exactly once, with a
   single archive time, actor, and comment.
4. **Given** an archival is submitted twice in quick succession for the same door, **When** both
   submissions are processed, **Then** the door is archived exactly once and the later attempt is
   refused as already archived without overwriting the recorded archive context.
5. **Given** an archival is refused because the comment exceeds the maximum length, **When** the
   administrator shortens the comment and resubmits, **Then** the archival succeeds without them
   having to reopen the door or rebuild a selection.
6. **Given** an archival is refused or fails for any reason, **When** the doors of the warehouse are
   reviewed, **Then** every displayed lifecycle state matches the authoritative stored state, with
   no partial archive context recorded on any door.

---

### User Story 4 - Archive Several Doors at Once (Priority: P3)

As an organization administrator or operations administrator retiring a group of unloading points —
a condemned side of a building, a re-surveyed row of doors, an end-of-campaign cleanup — I want to
select several doors of a warehouse and archive them in one action, so that I do not repeat the same
confirmation once per door, and so that I see at a glance which ones could not be archived and why.

**Why this priority**: Single archival already delivers the outcome; multiple archival is an
efficiency multiplier over the same rule set and is only worth building once the single path and its
refusals are proven. It is nonetheless part of this slice because warehouses hold many doors and
retiring them one by one both wastes time and makes it easy to lose track of which ones were blocked.

**Independent Test**: In one warehouse, select a mixed set of doors — some eligible, one holding a
current product lot assignment in a Planned or Active Discharge, one archived a moment earlier by
another administrator, one unknown identifier — archive them in one action, and verify exactly the
eligible ones become archived with identical archive metadata, that every other door is untouched
and reported with its own specific reason, and that the blocked ones can be retried on their own.

**Acceptance Scenarios**:

1. **Given** an authorized administrator selects several eligible available doors of a warehouse,
   **When** they archive the selection in one action, **Then** every selected door becomes archived,
   the administrator is told how many doors were archived, and the warehouse's door views and map
   markers reflect it without a manual refresh.
2. **Given** a selection mixing eligible doors with one held by a Planned or Active Discharge,
   **When** the selection is archived, **Then** the eligible ones are archived, the held one stays
   available, and the outcome names that door and its in-use reason.
3. **Given** a selection containing a door another administrator archived a moment earlier, **When**
   the selection is archived, **Then** the remaining eligible ones are archived and the
   already-archived one is reported as unchanged with its existing archive context intact.
4. **Given** a selection containing an identifier that resolves to no door, **When** the selection is
   archived, **Then** that identifier is reported as not found and the other eligible doors are
   still archived.
5. **Given** several doors are archived in one action, **When** they are consulted, **Then** every
   one of them carries the same archive time, the same responsible administrator, and the same
   comment, and every one of them is described as archived on its own — their warehouse being
   available, which is what that description reads off (amended by #216).
6. **Given** every door in the selection is blocked, **When** the selection is archived, **Then**
   nothing is archived, the administrator is told that nothing changed, and each blocking reason is
   reported individually.
7. **Given** an outcome reported some doors as unchanged, **When** the administrator resolves the
   blocking condition and retries only those, **Then** the retry archives the ones that are now
   eligible and leaves the rest reported again, without reselecting them.
8. **Given** a user who is unauthenticated or without warehouse-door administration rights, **When**
   they attempt a multiple archival, **Then** the whole attempt is denied, no door changes lifecycle
   state, and no door multi-selection or bulk archive action was offered to them.
9. **Given** an administrator has selected doors in a warehouse's available door view, **When** they
   switch to the archived view, select another warehouse, or start a door creation or door update,
   **Then** the door selection is left in a state that offers only doors that are still selectable
   in the new context, and no hidden door stays queued for archival.

### Edge Cases

- An unauthenticated visitor or a user whose access is not active is denied archival without
  revealing whether the referenced door exists.
- A door receives a current product lot assignment in a newly planned Discharge between the moment
  the administrator opens the warehouse and the moment they submit: the archival is refused at
  submission time with a current, actionable in-use reason.
- The Discharge relying on the door moves to Closed, or the door assignment ends, between opening
  the warehouse and submitting: the archival succeeds, because current usage is assessed at
  submission time.
- A door that belongs to a planned or active shift but holds no current product lot assignment is
  archivable: archival withdraws it from new work without removing it from that shift or altering
  any shift resource record.
- The archived door is the last available door of its warehouse: the archival succeeds, the
  warehouse stays available with an empty available door view, and no warehouse lifecycle rule is
  triggered.
- A door archived on its own is later caught by its warehouse's archival: the warehouse takes it
  over, replacing its archive time, actor, and comment with the building's, and a later warehouse
  reactivation brings it back with every other door (amended by #216).
- A door of an archived warehouse is submitted for archival on its own: the attempt is refused
  because the warehouse is archived, and its archive context is not rewritten.
- Two administrators archive the same available door at nearly the same time: exactly one archival is
  recorded, the other attempt is refused as already archived, and no archive context is overwritten.
  The same holds when one of them is archiving it as part of a larger selection.
- An administrator archives a door while another administrator archives its containing warehouse:
  the door ends up archived exactly once, with one archive context, and neither submission leaves it
  half-archived or archived twice with conflicting contexts.
- An archive comment containing only whitespace is treated as no comment rather than stored as a
  blank comment.
- An archive comment longer than the permitted maximum length is refused with a specific validation
  reason, and every door in the submission stays unchanged.
- A door archived with a comment is later consulted: the original comment, time, and actor remain
  readable and are not altered by any later consultation.
- An archived door retains any previous reactivation context; archival does not erase earlier
  lifecycle history.
- Archiving a door does not release its name within its warehouse, and does not affect the
  availability of that name in any other warehouse.
- An unvalidated rotation whose target door has since been archived remains correctable to that
  door, because rotation door correction applies historical eligibility.
- A door being updated by another administrator is archived in the meantime: the pending update is
  refused as read-only rather than silently applied to an archived door.
- The administrator opens the archive confirmation for a door and then selects another door: the
  confirmation still names, and acts on, the door it was opened for.
- A multiple archival in which every selected door turns out to be ineligible archives nothing and
  reports a reason for each one, rather than reporting an unexplained failure.
- A multiple archival naming the same door twice is rejected as an invalid submission rather than
  archiving it once and reporting the duplicate as already archived.
- A multiple archival submitted with an empty selection is rejected as an invalid submission and
  archives nothing.
- A multiple archival carrying a malformed identifier is rejected as an invalid submission before any
  door changes, which is distinct from a well-formed identifier that resolves to nothing and is
  reported per door as not found.
- A door becomes assigned within a Planned or Active Discharge after the administrator selected it
  but before the submission is processed: that door is reported as unchanged while the rest of the
  selection is archived.
- Two administrators submit overlapping door selections at nearly the same time: each overlapping
  door is archived exactly once, and the losing submission reports it as already archived without
  overwriting the recorded archive context.
- A multiple archival fails part-way through because the underlying service becomes unavailable: no
  door in the submission is left archived, and the administrator can retry the same selection.
- The containing warehouse is archived by another administrator while a door selection is open: the
  submission archives nothing, because those doors are already archived through the cascade, and
  each is reported as unchanged.
- The map background cannot be displayed while the warehouse snapshot and its doors are available:
  archival stays usable from the warehouse's door list, which reports map-specific feedback rather
  than presenting the whole feature as unavailable.
- The administrator's warehouse-door administration right is revoked between opening the
  confirmation and submitting: the submission is refused as if they had never been authorized.

## Requirements *(mandatory)*

### Functional Requirements

#### Archiving one warehouse door

- **FR-001**: The system MUST allow only active organization administrators and operations
  administrators to archive a warehouse door belonging to their operating site, using the same
  administration right that already governs door creation and door update.
- **FR-002**: The system MUST deny archival to unauthenticated users, to users whose access is not
  active, and to every active role without warehouse-door administration rights, without changing any
  door and without disclosing warehouse-door data beyond the application's established
  access-handling behavior.
- **FR-003**: The system MUST refuse archival of a door that does not exist or belongs to another
  operating site, without modifying any door and without disclosing information about other doors.
- **FR-004**: The system MUST refuse archival of a door that is already archived and MUST leave its
  existing archive time, actor, and comment unchanged. *(Amended by #216: the provenance clause is
  dropped with the column.)*
- **FR-005**: The system MUST refuse archival of a door whose containing warehouse is archived,
  leaving the door and the warehouse unchanged.
- **FR-006**: The system MUST refuse archival of an available door that is currently in use, and MUST
  leave that door unchanged.
- **FR-007**: A warehouse door MUST count as currently in use exactly as defined by the shared
  site-reference usage rules — a current product lot assignment belonging to a Planned or Active
  Discharge — and this feature MUST NOT introduce a second definition of door usage.
- **FR-008**: The system MUST NOT treat involvement through Closed Discharges, through ended door
  assignments, through past rotations, or through membership in a shift without a current product lot
  assignment as current usage that blocks archival.
- **FR-009**: The system MUST assess door usage, door lifecycle state, and containing-warehouse
  lifecycle state at the moment archival is submitted rather than at the moment the warehouse was
  opened for review.
- **FR-010**: A successful archival MUST change the door's lifecycle status from available to
  archived and MUST record the archive time, the responsible administrator, and the supplied archive
  comment.
- **FR-011**: ~~A successful archival MUST record that the door was archived on its own rather than
  through its warehouse, so that a later warehouse archival leaves it untouched and a later warehouse
  reactivation does not restore it.~~ **Superseded by #216**: the containing warehouse's own status
  states the provenance — an archival on its own is only possible while that warehouse is available —
  and a later warehouse archival takes this door over rather than leaving it untouched.
- **FR-012**: The system MUST accept an optional archive comment, MUST trim surrounding whitespace
  from it, and MUST record no comment when the supplied value is absent, empty, or whitespace-only.
- **FR-013**: The system MUST reject an archive comment that exceeds the maximum lifecycle comment
  length of 1,000 characters, with a specific validation reason and no lifecycle change to any door
  in the submission.
- **FR-014**: A successful archival MUST preserve the door's stable identity, name, GPS location,
  containing-warehouse relationship, creation time, and any earlier reactivation context, and MUST
  NOT detach, relocate, rename, or delete the door.
- **FR-015**: A successful archival MUST NOT change the containing warehouse's lifecycle status,
  archive context, name, or footprint, including when the archived door was the warehouse's last
  available door.
- **FR-016**: A successful archival MUST NOT modify any product lot assignment, shift door
  membership, rotation, or Discharge that references the door; all such records MUST remain readable
  and attached to that same door.
- **FR-017**: An archived door MUST remain consultable as a read-only historical reference under its
  containing warehouse, consistent with the archived-door visibility rules already established by
  warehouse-door consultation, and MUST expose its archive time, responsible administrator, comment
  when one was supplied, and whether it was archived on its own or with its warehouse.
- **FR-018**: An archived door MUST be excluded from the warehouse's available door view and count,
  from the available-only warehouse-door collection, and from every collection offering doors for
  selection for new operational work.
- **FR-019**: Archiving a door MUST NOT release its name for reuse within its containing warehouse.
- **FR-020**: Archiving a door MUST NOT retroactively alter any rotation, shift, report snapshot, or
  other closed historical record referencing it, and MUST NOT remove the door from the historical
  eligibility that lets an unvalidated rotation still be corrected onto it.
- **FR-021**: The archive experience MUST require an explicit confirmation that names the door and
  states that it remains readable but is no longer available for new operations, and MUST offer an
  optional comment. The wording MUST be the shared site-reference lifecycle wording rather than
  phrasing owned by this feature.
- **FR-022**: The administrator MUST be able to abandon an archival in progress, leaving every
  targeted door unchanged.
- **FR-023**: The system MUST report authorization refusals, not-found refusals, already-archived
  conflicts, archived-containing-warehouse refusals, in-use conflicts, comment validation failures,
  invalid submissions, and transient failures with distinct, understandable, and actionable feedback.
- **FR-024**: The system MUST ensure that repeated or concurrent archival attempts for the same door
  result in exactly one recorded archival, with every later attempt refused as already archived,
  whether the door was submitted on its own, as part of a multiple archival, or through its
  warehouse's archival.
- **FR-025**: A door archival MUST be recorded in full or not at all, and a refused or failed
  archival MUST leave the stored lifecycle state and lifecycle context of every targeted door exactly
  as they were before the attempt.
- **FR-026**: After an archival succeeds or is refused, the warehouse consultation experience MUST
  reflect the authoritative current lifecycle state, lifecycle counts, and map markers of the
  affected doors without requiring the administrator to leave the warehouse map or reload the page.
- **FR-027**: The archive action MUST be offered only for doors the administrator is permitted to
  archive — an available door of an available warehouse — and MUST be absent rather than disabled
  otherwise, while server-side authorization and eligibility remain authoritative.
- **FR-028**: The system MUST NOT permanently delete a warehouse door.

#### Archiving several warehouse doors at once

- **FR-029**: The system MUST allow an authorized administrator to submit several warehouse doors for
  archival in one action.
- **FR-030**: A multiple archival MUST be authorized by exactly the same administration right as
  archiving one door, and MUST be denied as a whole to every other user.
- **FR-031**: A multiple archival MUST apply the same existence, lifecycle-state,
  containing-warehouse, and usage rules to every submitted door as a single archival, assessed at
  submission time against authoritative stored state rather than against the view the administrator
  was looking at.
- **FR-032**: A multiple archival MUST archive every eligible door in the submission and leave every
  ineligible door unchanged, rather than refusing the whole submission because one door is
  ineligible.
- **FR-033**: A multiple archival MUST report, for each door it left unchanged, an identifying label
  and exactly one specific reason distinguishing not found, already archived, and in use.
- **FR-034**: Every door archived within one multiple archival MUST record the same archive time, the
  same responsible administrator, and the same comment. *(Amended by #216: the "recorded as archived
  on its own" clause is dropped with the column.)*
- **FR-035**: A multiple archival MUST record either all of its eligible archivals or none of them,
  so a failure part-way through never leaves some doors archived and others silently skipped.
- **FR-036**: A multiple archival MUST NOT partially archive an individual door: each one is either
  archived with its complete lifecycle metadata or left entirely untouched.
- **FR-037**: The system MUST reject, before any door changes, a submission that names no door, that
  names the same door more than once, or that carries a malformed identifier.
- **FR-038**: The system MUST report the aggregate outcome of a multiple archival, stating how many
  doors were archived and how many were left unchanged.
- **FR-039**: The administrator MUST be able to select several doors, see how many are selected, clear
  the selection, and retry only the doors reported as unchanged without reselecting them.
- **FR-040**: Door selection MUST offer only doors the administrator is permitted to archive, MUST be
  scoped to the selected warehouse and to the door lifecycle view in which the doors were chosen, and
  MUST NOT carry a selected door into a context where it is no longer listed.
- **FR-041**: At most one warehouse-map mode MUST be active at a time: entering door selection MUST
  end a door creation or door update in progress without saving it and MUST NOT coexist with the
  warehouse-polygon selection used to archive or reactivate warehouses, and starting any of those
  modes MUST leave door selection. Selecting doors for archival MUST NOT interfere with selecting a
  single door to highlight its unloading point on the map.
- **FR-042**: Selecting and archiving doors MUST behave consistently with the site-reference
  selection model already delivered for docks, weighing areas, and warehouses — the same way
  selection is entered and left, the same selection count and clearing, the same bulk action bar, and
  the same outcome reporting — so that administrators meet one interaction model across site
  references rather than a second one for doors.

#### Out of scope

- **FR-043**: This slice MUST NOT create, update, reactivate, or permanently delete warehouse doors;
  MUST NOT archive or reactivate a warehouse or any other site-reference type; MUST NOT change a
  door's name, position, or containing warehouse; and MUST NOT create, end, or modify any door
  assignment, shift membership, rotation, or Discharge. Those behaviors remain owned by separate
  delivery slices.

### Key Entities *(include if feature involves data)*

- **Warehouse Door**: The unloading door being retired from operational use. Archival changes only
  its lifecycle status and archive context; its stable identity, name, GPS location, containing
  warehouse, and creation time are preserved.
- **Warehouse Door Lifecycle Context**: The archive information recorded by this feature — archive
  time, responsible administrator, optional comment, and the fact that the door was archived on its
  own rather than through its warehouse — alongside any previously recorded reactivation context,
  which archival preserves. All doors archived by one submission share identical context.
- **Containing Warehouse**: The warehouse the door belongs to permanently. It must be available for
  its doors to be archivable individually, and archiving one of its doors never changes its own
  lifecycle status, context, name, or footprint.
- **Warehouse Door Usage**: The determination of whether a door currently holds a product lot
  assignment belonging to a Planned or Active Discharge. Such a door is ineligible for archival;
  Closed Discharges, ended assignments, and shift membership without a current assignment are
  ignored.
- **Discharge**: The operational work that may currently rely on a door. A Planned or Active
  Discharge blocks archival of the door it holds; a Closed Discharge retains its historical
  references without blocking archival.
- **Warehouse Door Selection**: The set of doors an administrator has chosen for a multiple
  archival. It holds only doors the administrator may archive, is scoped to one warehouse and to the
  lifecycle view in which they were chosen, and can be cleared or narrowed to the ones a previous
  attempt left unchanged.
- **Archival Outcome**: The result of a multiple archival, pairing the doors that were archived with
  the ones left unchanged. Each unchanged door carries an identifying label and one specific reason:
  not found, already archived, or in use.
- **Authorized Administrator**: An active organization administrator or operations administrator
  permitted to archive warehouse doors at their operating site.
- **Operating Site**: The operational scope that owns warehouse and warehouse-door records and bounds
  which doors an authorized administrator may archive.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of archival attempts by organization administrators and
  operations administrators on eligible available doors succeed, and the door is absent from the
  available door view and present in the archived door view immediately afterward without a manual
  reload.
- **SC-002**: In acceptance testing, 100% of archival attempts by unauthenticated users, non-active
  users, and active users without warehouse-door administration rights are denied with zero lifecycle
  changes to any door, for single and multiple archival alike, and no archive action or door
  multi-selection is offered to them.
- **SC-003**: In acceptance testing, 100% of archival attempts on doors currently holding a product
  lot assignment within a Planned or Active Discharge are refused with the door left unchanged and a
  specific in-use reason shown, and 100% of doors involved only through Closed Discharges, ended
  assignments, or shift membership without a current assignment are archived successfully.
- **SC-004**: In acceptance testing, 100% of archival attempts on an already archived door, on a door
  of an archived warehouse, and on an identifier resolving to no door are refused with the
  corresponding reason and leave stored data unchanged, including the archive context of doors
  archived with their warehouse.
- **SC-005**: In acceptance testing, 100% of archived doors retain their identity, name, GPS
  location, containing warehouse, creation time, and prior reactivation context; 100% of their
  containing warehouses keep their own lifecycle state and context; and 0% of doors are permanently
  deleted.
- **SC-006**: In acceptance testing, 100% of product lot assignments, shift door memberships,
  rotations, and discharges previously attached to an archived door remain attached to that same door
  and readable, 100% of archived door names remain reserved within their warehouse, and 0% of
  archived doors appear in any collection offering doors for new operational work.
- **SC-007**: In all acceptance datasets, repeated and near-simultaneous archival attempts on the
  same door — including one submitted on its own and one through its warehouse's archival — produce
  exactly one recorded archival with zero archive contexts overwritten.
- **SC-008**: In 100% of acceptance datasets, a door archived on its own is presented as such while
  its warehouse is available, and a subsequent warehouse archival and reactivation takes it over and
  brings it back with 100% of the warehouse's other doors (amended by #216).
- **SC-009**: Every tested refusal condition — authorization, not found, already archived, archived
  containing warehouse, in use, over-long comment, empty selection, duplicated selection, malformed
  identifier, and transient failure — produces distinct and accurate feedback, and every transient
  failure can be recovered through a retry that archives each door exactly once.
- **SC-010**: In a multiple-archival acceptance matrix mixing eligible, in-use, already-archived, and
  unknown doors, 100% of eligible ones are archived and 100% of blocked ones are reported with their
  correct individual reason and left unchanged, in every tested combination including the all-blocked
  case.
- **SC-011**: Archiving a selection of 50 doors completes within 2 seconds in the acceptance
  environment, and the administrator sees a confirmed result or an explicit refusal within 2 seconds
  for 95% of submissions under normal operating conditions.
- **SC-012**: At least 90% of representative authorized administrators can archive an intended door,
  or understand why they cannot, on their first attempt within 45 seconds of opening its warehouse.
- **SC-013**: At least 90% of representative administrators can select several doors, archive them,
  and correctly state from the reported outcome which ones were not archived and why, on their first
  attempt.

## Assumptions

- "Authorized administrator" means an active organization administrator or an active operations
  administrator — the same administration right that already governs door creation (#213) and door
  update (#214), and the one every other site-reference lifecycle action applies. Warehouse-door
  consultation itself remains open to every active user (#212), so archived doors stay readable to
  all active users rather than to administrators only.
- Each operating organization owns exactly one site, so the administrator's organization determines
  which doors they may archive without an additional site picker.
- Door usage is the shared site-reference usage rule established by Enforce Persisted Site-Reference
  Usage Rules (`#240` FR-006) — a current product lot assignment in a Planned or Active Discharge —
  reused as-is rather than redefined here. A door that belongs to a shift without holding such an
  assignment is therefore archivable; archival withdraws it from new work and never edits a shift's
  resources, which remain owned by the discharge-execution slices.
- A door is eligible when it is available and its containing warehouse is available. Because
  archiving a warehouse cascades onto its available doors (#210), an available door under an
  archived warehouse is unreachable by construction; the containing-warehouse rule is nevertheless
  enforced at submission time so a concurrent warehouse archival is refused rather than raced.
- Nothing requires a warehouse to keep at least one available door, so archiving the last available
  door of a warehouse is allowed and leaves the warehouse available with an empty available door
  view. A warehouse without an available door simply cannot receive new door assignments.
- Archiving a door on its own is distinguishable from being archived through the warehouse cascade
  by the containing warehouse's own status, and only by that (amended by #216): a door is archived on
  its own exactly while its warehouse is available. A later archival of that warehouse takes the door
  over, and the warehouse's reactivation brings it back with every other.
- The archive comment is optional free text with a maximum length of 1,000 characters, the shared
  site-reference lifecycle comment limit already applied to customer, transport-company, truck, dock,
  weighing-area, and warehouse archival. One comment applies to the whole submission, whether it
  names one door or many.
- Archival is offered both for one door at a time and for several selected doors in one action, per
  the product decision recorded in Clarifications and matching the six delivered sibling archive
  slices. Multiple archival applies exactly the same eligibility rules as single archival and adds no
  new rule of its own.
- A multiple archival reports partial success rather than refusing everything when one door is
  ineligible, matching the site-reference lifecycle precedent already delivered for customers
  (`GH-195`), transport companies (`GH-220`), trucks (`GH-225`), docks (`GH-200`), weighing areas
  (`GH-205`), and warehouses (`GH-210`).
- Invalid submissions — empty, duplicated, or malformed selections — are rejected as a whole before
  any door changes, which is deliberately distinct from a well-formed identifier that resolves to
  nothing and is reported per door as not found.
- No explicit maximum number of doors per submission is imposed, following the shared selection rule
  already used for the other site-reference bulk lifecycle actions. Realistic selections are bounded
  by the doors of one warehouse, within the 1,000 doors per site sized by #212.
- A door selection is scoped to the warehouse currently selected in the warehouse consultation area,
  because doors are consulted only within their containing warehouse (#212 FR-004a) and a single
  submission that mixed doors of several warehouses would have no place to be built. This slice makes
  only available doors selectable; Reactivate a Warehouse Door (#216) owns making archived doors
  selectable for the opposite direction, exactly as warehouse reactivation (#211) did for warehouses.
- The archive experience is offered from the selected warehouse's existing door list and map context
  introduced by #212, as an action beside the existing per-door update entry, and this slice
  introduces no standalone warehouse-door destination or door detail view.
- The warehouse map already hosts several exclusive modes — door creation (#213), door update (#214),
  and the warehouse-polygon selection used by warehouse archival and reactivation (#210, #211). Door
  selection joins them as one more mutually exclusive mode rather than a parallel one, extending the
  delivered selection model instead of inventing a second one.
- The doors panel offers lifecycle views and counts but no door-name search (#212), so no
  search-versus-selection interaction exists in this slice.
- Available and archived remain the only warehouse-door lifecycle states; archival is reversible only
  through Reactivate a Warehouse Door (#216), a separate delivery slice that depends on this one.
- Reactivating an archived door replaces its most recent lifecycle context rather than accumulating
  history, consistent with the existing site-reference lifecycle model.
- Archival never deletes data. Permanent deletion of a warehouse door is out of scope for this and
  every current storage-facility slice.
- Rotation door correction applies historical eligibility (`CONTEXT.md`), so archiving a door does not
  invalidate the correction of an unvalidated rotation that targeted it; this specification only
  requires that archival leave that behavior untouched.
- API authorization and eligibility checks are authoritative for every rule in this specification; any
  interface-level restriction is a courtesy that does not replace server-side enforcement.
- The established application language, validation-messaging, focus-management, and accessibility
  conventions apply to the archive flow's labels, confirmations, errors, and outcome reporting.
- Warehouse-door records already exist through creation (#213) and the seeded site-reference
  fixtures, including warehouses holding several doors and doors already archived through their
  warehouse, so this slice is verifiable against existing data.
- List Warehouse Doors (#212), Create a Warehouse Door (#213), Update a Warehouse Door (#214), and
  Reactivate a Warehouse Door (#216) are independently deliverable sibling issues and stay outside
  this slice, as does the archival of any other site-reference type.
