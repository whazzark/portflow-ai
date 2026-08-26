# Feature Specification: Archive Weighing Areas

**Feature Branch**: `feat/205-archive-weighing-area`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Let an authorized administrator archive one eligible weighing area or a selection of eligible weighing areas while preserving history and lifecycle metadata. https://github.com/whazzark/portflow-ai/issues/205"

**Feature ID**: `GH-205`

**GitHub Issue**: [#205](https://github.com/whazzark/portflow-ai/issues/205)

**Parent Roadmap**: `specs/site-references/operational-checkpoints/weighing-areas/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retire a Weighing Area From Operational Use (Priority: P1)

As an organization administrator or operations administrator, I want to archive a weighbridge the
site no longer operates so that it stops being offered when shifts are staffed and weighings are
recorded, while its name, position, and past involvement remain consultable.

**Why this priority**: Without archival, a decommissioned, relocated, or replaced weighbridge stays
permanently selectable for new operational work, and the only alternative — deleting it — would
destroy the history that recorded weighings and closed discharges depend on. This is the primary
outcome of the slice.

**Independent Test**: Sign in as an organization administrator or operations administrator, archive
an available weighing area that no planned or active discharge relies on, and verify the weighing
area leaves the available collection, appears under the archived status with its archive context,
and remains fully readable with an unchanged name and position.

**Acceptance Scenarios**:

1. **Given** an available weighing area that no planned or active discharge relies on, **When** an
   organization administrator archives it, **Then** the weighing area becomes archived and
   disappears from the available collection and from every selection offering weighing areas for
   new operational work.
2. **Given** an operations administrator archives an available weighing area, **When** the archived
   weighing area's details are opened by an authorized administrator, **Then** the archive time, the
   responsible administrator, and the archive comment when one was supplied are shown.
3. **Given** a weighing area is archived, **When** its details are reviewed, **Then** its stable
   identity, name, latitude, and longitude are unchanged by the archival.
4. **Given** an administrator archives a weighing area without supplying a comment, **When** the
   archival completes, **Then** the weighing area is archived with the archive time and responsible
   administrator recorded and no comment shown.
5. **Given** an administrator opens the archive confirmation for an eligible weighing area, **When**
   the confirmation is displayed, **Then** it names the weighing area, states that it remains
   readable but is no longer available for new operations, and it offers an optional comment.
6. **Given** an administrator opens the archive confirmation, **When** the administrator abandons
   it, **Then** the weighing area remains available and entirely unchanged.
7. **Given** a weighing area is archived, **When** the Checkpoints map is consulted under the
   archived status, **Then** the weighing area appears there with its archived status and its marker
   at its stored position.

---

### User Story 2 - Protect Weighing Areas Still Required by Current Work (Priority: P1)

As the system, I want to refuse archival of a weighing area that a planned or active discharge still
relies on, and to refuse archival by unauthorized users, so that current operations are never
invalidated and lifecycle changes stay accountable.

**Why this priority**: Archiving a weighbridge that a staffed shift depends on would break live
operational state, and unauthorized archival would silently remove a checkpoint other users still
need. Both must be prevented from the first delivery of this behavior.

**Independent Test**: Attempt archival as an unauthenticated visitor, as each non-administrator
active role, on a weighing area carrying a current shift membership in a planned or active
discharge, and on a weighing area that is already archived; verify every attempt is refused, no
weighing area changes lifecycle state, and each refusal states a specific, actionable reason.

**Acceptance Scenarios**:

1. **Given** a user who is unauthenticated or whose access is not active, **When** they attempt to
   archive a weighing area, **Then** the attempt is denied, the weighing area stays available, and
   no weighing-area data is disclosed.
2. **Given** an active user without weighing-area administration rights, **When** they attempt to
   archive a weighing area, **Then** the attempt is denied and the weighing area stays available,
   and no archive action was offered to them.
3. **Given** an available weighing area holding a current shift membership within a planned or
   active discharge, **When** an authorized administrator attempts to archive it, **Then** the
   attempt is refused as in use, the weighing area stays available, and the reason identifies that
   current operational work relies on it.
4. **Given** a weighing area whose only involvement is through closed discharges or ended shift
   memberships, **When** an authorized administrator archives it, **Then** the archival succeeds and
   every historical relationship remains readable.
5. **Given** a weighing area that is already archived, **When** an authorized administrator attempts
   to archive it again, **Then** the attempt is refused as already archived and the existing archive
   context is left unchanged.
6. **Given** a weighing area that no longer exists, **When** an authorized administrator attempts to
   archive it, **Then** the attempt is refused as not found and no other weighing area is modified.

---

### User Story 3 - Understand and Recover From a Refused Archival (Priority: P2)

As an organization administrator or operations administrator, I want each refused or failed archival
to explain itself and leave a safe retry path so that I can release the blocking work or retry a
transient failure without leaving a weighing area in an unclear lifecycle state.

**Why this priority**: An archival refusal is only useful if the administrator can tell an
authorization refusal from an in-use conflict, a stale view, or a temporary outage, and can act on
it. Without that, administrators retry blindly or assume the weighing area was archived when it was
not.

**Independent Test**: Trigger an in-use conflict, an already-archived conflict, a stale-view
conflict, an over-long comment, and a transient failure in turn; verify each produces distinct
guidance, the weighing area's lifecycle state is never left ambiguous, and retrying after the
blocking condition is resolved archives the weighing area exactly once.

**Acceptance Scenarios**:

1. **Given** an archival was refused because the weighing area is in use, **When** the blocking
   discharge is closed or its shift membership ends and the administrator retries, **Then** the
   archival succeeds.
2. **Given** an administrator is viewing a weighing area that another administrator archived in the
   meantime, **When** the administrator submits an archival, **Then** the attempt is refused as
   already archived and the refreshed view shows the weighing area's authoritative archived state
   and archive context.
3. **Given** an archival fails because the underlying service is temporarily unavailable, **When**
   the administrator retries after the service recovers, **Then** the weighing area is archived
   exactly once with a single archive time, actor, and comment.
4. **Given** an archival is submitted twice in quick succession for the same weighing area, **When**
   both submissions are processed, **Then** the weighing area is archived exactly once and the later
   attempt is refused as already archived.
5. **Given** an archival is refused for any reason, **When** the administrator reviews the weighing
   area, **Then** its displayed lifecycle state matches its authoritative stored state with no
   partial archive context recorded.
6. **Given** an archival is refused because the comment exceeds the maximum length, **When** the
   administrator shortens the comment and resubmits, **Then** the archival succeeds without the
   administrator having to reopen the weighing area or rebuild a selection.

---

### User Story 4 - Archive Several Weighing Areas at Once (Priority: P3)

As an organization administrator or operations administrator retiring a group of weighbridges — a
decommissioned weighing lane, a re-surveyed zone, an end-of-campaign cleanup — I want to select
several weighing areas and archive them in one action so that I do not have to repeat the same
confirmation once per checkpoint, and so that I can see at a glance which ones could not be archived
and why.

**Why this priority**: Single archival already delivers the outcome; multiple archival is an
efficiency multiplier over the same rule set, and it is only worth building once the single path and
its refusals are proven. It is nonetheless part of this slice because site reorganizations retire
checkpoints in groups, and archiving them one by one both wastes time and makes it easy to lose
track of which ones were blocked.

**Independent Test**: Select a mixed set of weighing areas — some eligible, one carrying a current
shift membership in a planned or active discharge, one already archived, one unknown identifier —
archive them in one action, and verify that exactly the eligible ones become archived with identical
archive metadata, that every other one is untouched and reported with its own specific reason, and
that the blocked ones can be retried on their own.

**Acceptance Scenarios**:

1. **Given** an authorized administrator selects several eligible available weighing areas, **When**
   they archive the selection in one action, **Then** every selected weighing area becomes archived,
   the administrator is told how many were archived, and the Checkpoints map shows them removed from
   the available collection without a manual refresh.
2. **Given** a selection mixing eligible weighing areas with one held by a planned or active
   discharge, **When** the selection is archived, **Then** the eligible ones are archived, the held
   one stays available, and the outcome names that weighing area and its in-use reason.
3. **Given** a selection containing a weighing area another administrator archived a moment earlier,
   **When** the selection is archived, **Then** the remaining eligible ones are archived and the
   already-archived one is reported as unchanged with its existing archive context intact.
4. **Given** a selection containing an identifier that resolves to no weighing area, **When** the
   selection is archived, **Then** that identifier is reported as not found and the other eligible
   weighing areas are still archived.
5. **Given** several weighing areas are archived in one action, **When** their details are opened,
   **Then** they all carry the same archive time, the same responsible administrator, and the same
   comment.
6. **Given** every weighing area in the selection is blocked, **When** the selection is archived,
   **Then** nothing is archived, the administrator is told that nothing changed, and each blocking
   reason is reported individually.
7. **Given** an outcome reported some weighing areas as unchanged, **When** the administrator
   resolves the blocking condition and retries only those, **Then** the retry archives the ones that
   are now eligible and leaves the rest reported again, without reselecting them from the map.
8. **Given** a user who is unauthenticated or without weighing-area administration rights, **When**
   they attempt a multiple archival, **Then** the whole attempt is denied, no weighing area changes
   lifecycle state, and no multi-selection or bulk archive action was offered to them.
9. **Given** an administrator has selected weighing areas under the available status, **When** they
   switch to the archived status or change the resource-kind filter, **Then** the selection no
   longer offers weighing areas that are not listed in the new scope.

### Edge Cases

- An unauthenticated visitor or a user whose access is not active is denied archival without
  revealing whether the referenced weighing area exists.
- A weighing area gains a current shift membership in a newly planned discharge between the moment
  the administrator opens it and the moment they submit the archival: the archival is refused at
  submission time with a current, actionable in-use reason.
- A discharge relying on the weighing area moves to closed, or its shift membership ends, between
  opening the weighing area and submitting the archival: the archival succeeds because current usage
  is assessed at submission time.
- Two administrators archive the same available weighing area at nearly the same time: exactly one
  archival is recorded and the other attempt is refused as already archived, with no archive context
  overwritten. The same holds when one of them is archiving it as part of a larger selection.
- An archive comment containing only whitespace is treated as no comment rather than stored as a
  blank comment.
- An archive comment longer than the permitted maximum length is refused with a specific validation
  reason, and every weighing area in the submission stays available.
- A weighing area archived with a comment is later consulted by an authorized administrator: the
  original comment, time, and actor remain readable and are not altered by any later consultation.
- An archived weighing area retains any previous reactivation context; archiving does not erase
  earlier lifecycle history.
- Archiving a weighing area does not release its name: the name stays reserved and a new weighing
  area may not reuse it, because weighing-area names are unique regardless of lifecycle status.
- Weighings already recorded at a weighing area, and closed discharges that referenced it, keep
  pointing at the same weighing area after it is archived and remain readable.
- A multiple archival in which every selected weighing area turns out to be ineligible archives
  nothing and reports a reason for each one, rather than reporting an unexplained failure.
- A multiple archival naming the same weighing area twice is rejected as an invalid submission
  rather than archiving it once and reporting the duplicate as already archived.
- A multiple archival submitted with an empty selection is rejected as an invalid submission and
  archives nothing.
- A multiple archival carrying a malformed identifier is rejected as an invalid submission before
  any weighing area changes, which is distinct from a well-formed identifier that resolves to
  nothing and is reported per weighing area as not found.
- A weighing area becomes held by a planned or active discharge after the administrator selected it
  but before the submission is processed: it is reported as unchanged while the rest of the
  selection is archived.
- Two administrators submit overlapping selections at nearly the same time: each overlapping
  weighing area is archived exactly once, and the losing submission reports it as already archived
  without overwriting the recorded archive context.
- A selected weighing area is filtered out of view by a search term: it remains part of the
  selection, because search narrows what is displayed rather than what the administrator chose.
- A multiple archival fails part-way through because the underlying service becomes unavailable: no
  weighing area in the submission is left archived and the administrator can retry the same
  selection.

## Requirements *(mandatory)*

### Functional Requirements

#### Archiving one weighing area

- **FR-001**: The system MUST allow only active organization administrators and operations
  administrators to archive a weighing area belonging to their operating site.
- **FR-002**: The system MUST deny archival to unauthenticated users, to users whose access is not
  active, and to every active role without weighing-area administration rights, without changing any
  weighing area and without disclosing weighing-area data.
- **FR-003**: The system MUST refuse archival of a weighing area that does not exist, without
  modifying any weighing area and without disclosing information about other weighing areas.
- **FR-004**: The system MUST refuse archival of a weighing area that is already archived, and MUST
  leave its existing archive time, actor, and comment unchanged.
- **FR-005**: The system MUST refuse archival of an available weighing area that currently holds a
  shift membership belonging to a planned or active discharge, and MUST leave the weighing area
  available.
- **FR-006**: The system MUST NOT treat involvement through closed discharges or through ended shift
  memberships as current usage that blocks archival.
- **FR-007**: The system MUST assess current usage at the moment archival is submitted rather than
  at the moment the weighing area was opened for review.
- **FR-008**: A successful archival MUST change the weighing area's lifecycle status from available
  to archived and MUST record the archive time, the responsible administrator, and the supplied
  archive comment.
- **FR-009**: The system MUST accept an optional archive comment, MUST trim surrounding whitespace
  from it, and MUST record no comment when the supplied value is absent, empty, or whitespace-only.
- **FR-010**: The system MUST reject an archive comment that exceeds the maximum lifecycle comment
  length of 1,000 characters, with a specific validation reason and no lifecycle change to any
  weighing area in the submission.
- **FR-011**: A successful archival MUST preserve the weighing area's stable identity, name,
  latitude, longitude, creation time, and any earlier reactivation context.
- **FR-012**: An archived weighing area MUST remain readable to organization administrators and
  operations administrators through weighing-area consultation, including its archive context.
- **FR-013**: An archived weighing area MUST be excluded from the available weighing-area
  collection and from every collection offering weighing areas for selection for new operational
  work, including shift resource staffing.
- **FR-014**: An archived weighing area MUST NOT be disclosed to active roles without weighing-area
  administration rights, consistent with the archived-area visibility rules already established by
  weighing-area consultation.
- **FR-015**: The system MUST preserve every existing reference between the weighing area and the
  shifts it was assigned to and the weighings recorded at it; no such record may be modified by this
  feature.
- **FR-016**: Archiving a weighing area MUST NOT release its name for reuse; weighing-area names
  remain unique across all weighing areas regardless of lifecycle status.
- **FR-017**: The archive experience MUST require an explicit confirmation, MUST name the weighing
  area and state that it remains readable but is no longer available for new operations, and MUST
  offer an optional comment. This wording is the one every site reference uses for archival; it is
  owned by `apps/web/src/components/lifecycle/lifecycle-copy.ts`.
- **FR-018**: The administrator MUST be able to abandon an archival in progress, leaving every
  targeted weighing area unchanged.
- **FR-019**: The system MUST report authorization refusals, not-found refusals, already-archived
  conflicts, in-use conflicts, comment validation failures, invalid submissions, and transient
  failures with distinct, understandable, and actionable feedback.
- **FR-020**: The system MUST ensure that repeated or concurrent archival attempts for the same
  weighing area result in exactly one recorded archival, with every later attempt refused as already
  archived, whether the weighing area was submitted on its own or as part of a multiple archival.
- **FR-021**: A refused or failed archival MUST leave the weighing area's stored lifecycle state and
  lifecycle context exactly as they were before the attempt.
- **FR-022**: After an archival succeeds or is refused, the weighing-area consultation experience
  MUST reflect the authoritative current lifecycle state and context without requiring the
  administrator to leave the Checkpoints map or reload the page.
- **FR-023**: The archive action MUST be offered only for weighing areas the administrator is
  permitted to archive, while server-side authorization remains authoritative.
- **FR-024**: The system MUST NOT permanently delete a weighing area.

#### Archiving several weighing areas at once

- **FR-025**: The system MUST allow an authorized administrator to submit several weighing areas for
  archival in one action.
- **FR-026**: A multiple archival MUST be authorized by exactly the same administration right as
  archiving one weighing area, and MUST be denied as a whole to every other user.
- **FR-027**: A multiple archival MUST apply the same existence, lifecycle-state, and in-use rules
  to every submitted weighing area as a single archival, assessed at submission time against
  authoritative stored state rather than against the collection the administrator was looking at.
- **FR-028**: A multiple archival MUST archive every eligible weighing area in the submission and
  leave every ineligible one unchanged, rather than refusing the whole submission because one is
  ineligible.
- **FR-029**: A multiple archival MUST report, for each weighing area it left unchanged, an
  identifying label and exactly one specific reason distinguishing not found, already archived, and
  in use.
- **FR-030**: Every weighing area archived within one multiple archival MUST record the same archive
  time, the same responsible administrator, and the same comment.
- **FR-031**: A multiple archival MUST record either all of its eligible archivals or none of them,
  so a failure part-way through never leaves some weighing areas archived and others silently
  skipped.
- **FR-032**: A multiple archival MUST NOT partially archive an individual weighing area: each one
  is either archived with its complete lifecycle metadata or left entirely untouched.
- **FR-033**: The system MUST reject, before any weighing area changes, a submission that names no
  weighing area, that names the same weighing area more than once, or that carries a malformed
  identifier.
- **FR-034**: The system MUST report the aggregate outcome of a multiple archival, stating how many
  weighing areas were archived and how many were left unchanged.
- **FR-035**: The administrator MUST be able to select several weighing areas in the Checkpoints
  map, see how many are selected, clear the selection, and retry only the weighing areas reported as
  unchanged without reselecting them.
- **FR-036**: Selection MUST offer only weighing areas the administrator is permitted to archive,
  MUST NOT carry a selected weighing area into a lifecycle status or resource-kind scope where it is
  no longer listed, and MUST keep a selected weighing area that is merely hidden by a search term.
- **FR-037**: The multi-selection and bulk archive experience MUST be offered only to users
  authorized to archive, and MUST NOT interfere with selecting a single checkpoint to consult its
  details.
- **FR-038**: Selecting and archiving weighing areas MUST behave consistently with the equivalent
  dock behavior already delivered on the same Checkpoints map — the same way selection is entered
  and left, the same selection shortcuts, and the same outcome reporting — so that administrators
  meet one interaction model for both checkpoint kinds rather than two.

#### Out of scope

- **FR-039**: This slice MUST NOT create, update, reactivate, or permanently delete weighing areas,
  and MUST NOT archive any other checkpoint or site-reference type; those behaviors remain owned by
  separate delivery slices.

### Key Entities *(include if feature involves data)*

- **Weighing Area**: The weighbridge checkpoint being retired from operational use. Archival changes
  only its lifecycle status and archive context; its stable identity, name, latitude, longitude, and
  creation time are preserved.
- **Weighing Area Lifecycle Context**: The archive information recorded by this feature — archive
  time, responsible administrator, and optional comment — alongside any previously recorded
  reactivation context, which archival preserves. Weighing areas archived by the same action share
  identical context.
- **Weighing Area Usage**: The determination of whether a weighing area currently holds a shift
  membership belonging to a planned or active discharge. It gates archival eligibility and ignores
  closed discharges and ended shift memberships.
- **Discharge**: The operational work that may currently rely on a weighing area through a staffed
  shift. A planned or active discharge blocks archival of the weighing areas its shifts hold; a
  closed discharge retains its historical references without blocking archival.
- **Weighing Area Selection**: The set of weighing areas an administrator has chosen in the
  Checkpoints map for a multiple archival. It holds only weighing areas the administrator may
  archive, is scoped to the lifecycle status and resource-kind filter in which they were chosen, is
  unaffected by search, and can be cleared or narrowed to the ones a previous attempt left
  unchanged.
- **Archival Outcome**: The result of a multiple archival, pairing the weighing areas that were
  archived with the ones left unchanged. Each unchanged weighing area carries an identifying label
  and one specific reason: not found, already archived, or in use.
- **Authorized Administrator**: An active organization administrator or operations administrator
  permitted to archive a weighing area at their operating site and to consult archived weighing
  areas.
- **Operating Site**: The operational scope that owns weighing-area records and bounds which
  weighing areas an authorized administrator may archive.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of archival attempts by organization administrators and
  operations administrators on eligible available weighing areas succeed, and the weighing area is
  absent from available consultation and present in archived consultation immediately afterward
  without a manual reload.
- **SC-002**: In acceptance testing, 100% of archival attempts by unauthenticated users, non-active
  users, and active users without weighing-area administration rights are denied with zero lifecycle
  changes, for single and multiple archival alike, and no archive action is offered to them.
- **SC-003**: In acceptance testing, 100% of archival attempts on weighing areas holding a current
  shift membership in a planned or active discharge are refused with the weighing area left
  available and a specific in-use reason shown, and 100% of weighing areas whose only involvement is
  closed or ended are archived successfully.
- **SC-004**: In acceptance testing, 100% of archived weighing areas retain their name, latitude,
  longitude, creation time, and prior reactivation context unchanged; 100% of successful archivals
  record an archive time and responsible administrator; and 0% of weighing areas are permanently
  deleted.
- **SC-005**: In all acceptance datasets, repeated and near-simultaneous archival attempts on the
  same weighing area produce exactly one recorded archival, with zero archive contexts overwritten,
  whether the competing attempts are single or multiple.
- **SC-006**: Every tested refusal condition — authorization, not found, already archived, in use,
  over-long comment, empty selection, duplicated selection, malformed identifier, and transient
  failure — produces distinct and accurate feedback, and every transient failure can be recovered
  through a retry that archives each weighing area exactly once.
- **SC-007**: In acceptance testing, 100% of shift assignments and recorded weighings previously
  attached to an archived weighing area remain attached to it and readable, and 0% of archived
  weighing areas appear in any collection offering weighing areas for new operational work.
- **SC-008**: In a multiple-archival acceptance matrix mixing eligible, in-use, already-archived, and
  unknown weighing areas, 100% of eligible ones are archived and 100% of blocked ones are reported
  with their correct individual reason and left unchanged, in every tested combination including the
  all-blocked case.
- **SC-009**: In all acceptance datasets, every weighing area archived within one multiple archival
  shares an identical archive time, responsible administrator, and comment, and no multiple archival
  ever leaves part of its eligible set archived after a failure.
- **SC-010**: Archiving a selection of 100 weighing areas completes within 2 seconds in the
  acceptance environment, and the administrator sees a confirmed result or an explicit refusal
  within 2 seconds for 95% of submissions under normal operating conditions.
- **SC-011**: At least 90% of representative authorized administrators can archive an intended
  weighing area, or understand why they cannot, on their first attempt within 45 seconds of opening
  it.
- **SC-012**: At least 90% of representative administrators can select several weighing areas,
  archive them, and correctly state from the reported outcome which ones were not archived and why,
  on their first attempt.

## Assumptions

- "Authorized administrator" means an active organization administrator or an active operations
  administrator, the same weighing-area administration right that already governs weighing-area
  consultation (#202), creation (#203), and update (#204).
- Each operating organization owns exactly one site, so the administrator's organization determines
  which weighing areas they may archive.
- Archival is offered both for one weighing area at a time and for several selected weighing areas
  in one action, as the issue's multiple-operation contract requires. Multiple archival applies
  exactly the same eligibility rules as single archival and adds no new rule of its own.
- A multiple archival reports partial success rather than refusing everything when one weighing area
  is ineligible, matching the site-reference lifecycle precedent already delivered for customers
  (`GH-195`), transport companies (`GH-220`), and trucks (`GH-225`).
- Invalid submissions — empty, duplicated, or malformed selections — are rejected as a whole before
  any weighing area changes, which is deliberately distinct from a well-formed identifier that
  resolves to nothing and is reported per weighing area as not found.
- Multiple archival requires a selection model on the Checkpoints map. Weighing-area consultation
  (#202) explicitly left it out of scope, but Archive Docks (#200) has since delivered exactly this
  model for the dock markers on the same map — a select mode, checkable markers, a bulk action bar,
  and selection shortcuts. This slice extends that delivered model to weighing areas rather than
  inventing a second one, which is what FR-038 requires.
- The archive comment is optional free text with a maximum length of 1,000 characters, the shared
  site-reference lifecycle comment limit already applied to customer, dock, and weighing-area
  archival. One comment applies to the whole submission, whether it names one weighing area or many.
- No explicit maximum number of weighing areas per submission is imposed, following the shared
  selection rule already used for the other site-reference bulk lifecycle actions. Realistic
  selections are bounded by the site's low-cardinality checkpoint collection, sized at up to 500
  weighing areas by #202.
- Eligibility means the weighing area is currently available and holds no shift membership belonging
  to a planned or active discharge. No other eligibility rule restricts archival.
- Current weighing-area usage is determined by the shared site-reference usage rule established by
  Enforce Persisted Site-Reference Usage Rules (`#240`), which already covers weighing areas through
  current shift membership and already excludes closed discharges and ended memberships.
- Available and archived remain the only weighing-area lifecycle states; archival is reversible only
  through Reactivate Weighing Areas (#206), which is a separate delivery slice that depends on this
  one.
- Reactivating an archived weighing area replaces its most recent lifecycle context rather than
  accumulating history, consistent with the existing site-reference lifecycle model.
- Archival never deletes data. Permanent deletion of a weighing area is out of scope for this and
  every current weighing-area slice.
- Archiving a weighing area does not free its name, because weighing-area name uniqueness already
  spans both lifecycle states as enforced by creation (#203) and update (#204).
- The archive experience is offered from the same map-based Checkpoints consultation area introduced
  by #202, reusing its lifecycle-status, resource-kind, and search filters rather than living on a
  separate standalone page.
- Multi-selection is a distinct concept from selecting one checkpoint to consult its details; the two
  coexist without one overriding the other.
- API authorization and eligibility checks are authoritative for every rule in this specification;
  any interface-level restriction is a courtesy that does not replace server-side enforcement.
- The established application language, validation-messaging, focus-management, and accessibility
  conventions apply to the archive flow's labels, confirmations, errors, and outcome reporting.
- Weighing-area records already exist through creation (#203) and the seeded site-reference
  fixtures, so this slice is verifiable against existing data.
- Weighing-area consultation (#202), creation (#203), update (#204), and reactivation (#206) are
  independently deliverable sibling issues and stay outside this slice, as does the archival of any
  other checkpoint type.
