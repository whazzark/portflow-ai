# Feature Specification: Reactivate Weighing Areas

**Feature Branch**: `feat/206-reactivate-weighing-area`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "l'issue 206" — https://github.com/whazzark/portflow-ai/issues/206

**Feature ID**: `GH-206`

**GitHub Issue**: [#206](https://github.com/whazzark/portflow-ai/issues/206)

**Parent Roadmap**: `specs/site-references/operational-checkpoints/weighing-areas/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bring One Archived Weighing Area Back Into Service (Priority: P1)

As an organization administrator or operations administrator, I want to reactivate a single archived
weighbridge that the site operates again so that it is offered once more when shifts are staffed and
weighings are recorded, without losing its identity or the record of the period it spent archived.

**Why this priority**: This is the core outcome the slice exists for. Archiving a weighing area
(#205) is reversible in intent but not yet in practice from the administration surface: a
weighbridge that returns to service after maintenance, or one archived by mistake, currently has no
way back into the operational selection without recreating it — which the unique-name rule forbids,
since archival never releases the name.

**Independent Test**: Sign in as an organization administrator or operations administrator, open an
archived weighing area on the Checkpoints map, reactivate it with or without a comment, and verify
it becomes available again, is offered once more for new operational work, and keeps its identity,
name, latitude, longitude, creation time, and its record of having been archived.

**Acceptance Scenarios**:

1. **Given** an archived weighing area, **When** an authorized administrator reactivates it,
   **Then** its lifecycle status becomes available, the reactivating administrator and the
   reactivation time are recorded, and the reactivation is confirmed.
2. **Given** the administrator supplies a comment while reactivating, **When** the reactivation
   succeeds, **Then** that comment is recorded as the reactivation comment and is shown in the
   weighing area's details.
3. **Given** the administrator reactivates without supplying a comment, or supplies only whitespace,
   **When** the reactivation succeeds, **Then** the weighing area is reactivated with the
   reactivation time and responsible administrator recorded and no reactivation comment shown.
4. **Given** a weighing area was just reactivated, **When** the Checkpoints map or the weighing
   area's details are consulted, **Then** it is shown as available with its marker at its stored
   position, and its identity, name, latitude, longitude, and creation time are unchanged.
5. **Given** a weighing area that was archived with an archive comment, **When** it is reactivated,
   **Then** the record of who archived it, when, and with what comment remains consultable alongside
   the new reactivation record.
6. **Given** a weighing area was just reactivated, **When** an authorized user staffs a shift or
   records a weighing, **Then** the weighing area is offered again among the weighing areas
   available for new operational work.
7. **Given** an administrator opens the reactivation confirmation for an archived weighing area,
   **When** the administrator abandons it, **Then** the weighing area remains archived and entirely
   unchanged.

---

### User Story 2 - Reactivate a Selection of Archived Weighing Areas Together (Priority: P1)

As an organization administrator or operations administrator, I want to select several archived
weighing areas on the Checkpoints map and reactivate the eligible ones in one action, so that
reopening a weighing lane after works does not require repeating the same confirmation once per
weighbridge, and so that I can see at a glance which ones could not be reactivated and why.

**Why this priority**: Weighing areas are archived in groups when a zone closes, so they come back
in groups when it reopens. A reactivation capability that only works one weighing area at a time
leaves the same slow, error-prone gap the multiple-archive capability (#205) was built to close,
and the issue explicitly places multiple reactivation inside this slice.

**Independent Test**: Select a mix of archived weighing areas, already-available weighing areas, and
one identifier that resolves to nothing, submit one reactivation action with an optional shared
comment, and verify every archived weighing area is reactivated with identical reactivation
metadata, every blocked one is left untouched, and the outcome names each blocked one with a
specific reason.

**Acceptance Scenarios**:

1. **Given** a selection made only of archived weighing areas, **When** an authorized administrator
   reactivates the selection in one action, **Then** every weighing area in the selection becomes
   available, the administrator is told how many were reactivated, and the Checkpoints map reflects
   the change without a manual reload.
2. **Given** several weighing areas are reactivated in one action, **When** their details are
   opened, **Then** they all carry the same reactivation time, the same responsible administrator,
   and the same comment.
3. **Given** a selection mixes archived weighing areas with weighing areas that are already
   available and with identifiers that resolve to no weighing area, **When** the administrator
   submits the reactivation, **Then** every archived weighing area is reactivated and every blocked
   one is left unchanged and reported individually with its own reason: not found, or already
   available.
4. **Given** a reactivation produced blocked weighing areas, **When** the administrator reviews the
   outcome, **Then** the reactivated ones and the blocked ones with their reasons are both clearly
   presented, and the administrator can tell exactly which weighing areas changed.
5. **Given** every weighing area in the selection is blocked, **When** the selection is reactivated,
   **Then** nothing is reactivated, the administrator is told that nothing changed, and each
   blocking reason is reported individually.
6. **Given** a selection contains ten archived weighing areas, **When** the administrator
   reactivates the selection, **Then** all ten become available in one action rather than requiring
   ten separate submissions.
7. **Given** an outcome reported some weighing areas as blocked, **When** the administrator narrows
   the selection to the remaining archived ones and resubmits, **Then** the resubmission succeeds
   for them without re-attempting or re-reporting the ones already reactivated.
8. **Given** an administrator has selected archived weighing areas, **When** they switch the
   lifecycle-status filter or the resource-kind filter, **Then** the selection no longer offers
   weighing areas that are not listed in the new scope; **and When** they merely narrow the search
   term, **Then** a selected weighing area hidden by the search remains part of the selection.

---

### User Story 3 - Reject Invalid Submissions and Protect What Must Not Change (Priority: P2)

As the operating organization, I want a reactivation refused outright when its selection is empty,
malformed, or contains duplicates, refused per-actor when the requester is not authorized, and
refused with a specific reason when a weighing area is not eligible, so that no weighbridge is ever
put back into service by mistake, by an unauthorized actor, or as a side-effect of a broken request.

**Why this priority**: Returning a weighing area to the pool offered for new operational work is a
decision with physical consequences on the site. These guard rails must hold whether the request
comes from the Checkpoints map or is sent directly, but they matter only once the successful
individual and multiple reactivation paths exist.

**Independent Test**: Attempt reactivation with an empty selection, with a duplicated identifier,
with a malformed identifier, with an over-long comment, and as an unauthenticated visitor, as a user
whose access is not active, and as each active role without weighing-area administration rights;
verify every attempt is refused before any weighing area changes and no partial effect is left
behind.

**Acceptance Scenarios**:

1. **Given** a multiple-reactivation request with an empty selection, **When** it is submitted,
   **Then** it is rejected as an invalid submission before any weighing area is evaluated or
   changed.
2. **Given** a multiple-reactivation request whose selection names the same weighing area twice, or
   carries an identifier that is not a valid weighing-area reference, **When** it is submitted,
   **Then** the whole request is rejected before any weighing area is evaluated or changed, rather
   than silently de-duplicating or skipping the malformed entry.
3. **Given** a reactivation whose comment exceeds the maximum lifecycle comment length, **When** it
   is submitted individually or for a selection, **Then** it is refused with a specific validation
   reason, no weighing area in the submission changes, and shortening the comment and resubmitting
   succeeds without rebuilding the selection.
4. **Given** an unauthenticated visitor, a user whose access is not active, or an active user
   without weighing-area administration rights, **When** a reactivation of one weighing area or of a
   selection is attempted, **Then** it is denied, no weighing area changes, no weighing-area data is
   disclosed, and no reactivation action was offered to them.
5. **Given** a weighing area that is already available, **When** an authorized administrator
   attempts to reactivate it individually, **Then** the attempt is refused as already available and
   its existing lifecycle context is left unchanged.
6. **Given** an identifier that resolves to no weighing area, **When** an authorized administrator
   attempts to reactivate it individually, **Then** the attempt is refused as not found, without
   disclosing information about other weighing areas.
7. **Given** any refused or failed reactivation, individual or multiple, **When** the stored
   weighing areas are inspected afterwards, **Then** no weighing area's lifecycle status or
   lifecycle context has changed as a result of that attempt.
8. **Given** a reactivation fails because the underlying service is temporarily unavailable,
   **When** the administrator retries after it recovers, **Then** each weighing area is reactivated
   exactly once, with a single reactivation time, actor, and comment.

### Edge Cases

- A weighing area is reactivated by another administrator between the moment a selection is built
  and the moment the reactivation is submitted: it is reported as blocked because it is already
  available, rather than being silently reactivated a second time or silently dropped.
- A selection that has become entirely blocked by the time it is submitted — every weighing area now
  available or no longer existing — reactivates nothing and reports every entry individually; it is
  not treated as an empty submission.
- Two administrators submit overlapping selections containing the same archived weighing area at
  nearly the same time: exactly one reactivation of it is recorded, and the other submission reports
  it as already available rather than reactivating it twice or overwriting the first reactivation's
  comment.
- A weighing area is archived by one administrator while another is reactivating a selection
  containing it: the outcome reflects the weighing area's authoritative state at submission time,
  and it never ends in a state matching neither request.
- A reactivation comment consisting only of whitespace is treated as no comment rather than stored
  as a blank comment.
- A reactivation comment longer than the permitted maximum is refused with a specific validation
  reason and every weighing area in the submission stays archived.
- A multiple reactivation fails part-way through because the underlying service becomes unavailable:
  no weighing area in the submission is left reactivated, and the administrator can retry the same
  selection.
- A very large selection is submitted: the action still applies in full or reports every blocked
  entry individually, rather than truncating the outcome silently.
- The administrator's weighing-area administration right is revoked between building the selection
  and submitting it: the submission is denied as if they had never been authorized, and no weighing
  area in the selection changes.
- A weighing area is archived and reactivated several times over its life: each transition replaces
  the lifecycle context of its own direction, and the most recent transition determines the current
  status.
- A reactivated weighing area is still referenced by the shifts it was assigned to and the weighings
  recorded at it before it was archived: those references keep pointing at the same weighing area
  and are unaffected by the reactivation.
- Reactivating a weighing area does not affect name uniqueness, because an archived weighing area
  already held its name reserved.
- A selected weighing area is filtered out of view by a search term: it remains part of the
  selection, because search narrows what is displayed rather than what the administrator chose.
- An administrator selects checkpoints of one kind and then reactivates: docks and weighing areas
  are never mixed inside a single reactivation submission.

## Requirements *(mandatory)*

### Functional Requirements

#### Reactivating one weighing area

- **FR-001**: The system MUST allow only active organization administrators and operations
  administrators to reactivate an archived weighing area belonging to their operating site.
- **FR-002**: The system MUST deny reactivation, individual or multiple, to unauthenticated users,
  to users whose access is not active, and to every active role without weighing-area administration
  rights, without changing any weighing area and without disclosing weighing-area data.
- **FR-003**: A weighing area is eligible for reactivation only when it is currently archived; no
  usage, scheduling, or occupancy condition blocks a reactivation.
- **FR-004**: The system MUST refuse reactivation of a weighing area that is already available,
  reporting the reason `ALREADY_AVAILABLE`, and MUST leave its existing lifecycle context unchanged.
- **FR-005**: The system MUST refuse reactivation of an identifier that resolves to no weighing
  area, reporting the reason `NOT_FOUND`, without modifying any weighing area and without disclosing
  information about other weighing areas.
- **FR-006**: A successful reactivation MUST change the weighing area's lifecycle status from
  archived to available and MUST record the reactivation time, the responsible administrator, and
  the supplied reactivation comment.
- **FR-007**: The system MUST accept an optional reactivation comment, MUST trim surrounding
  whitespace from it, and MUST record no comment when the supplied value is absent, empty, or
  whitespace-only.
- **FR-008**: The system MUST reject a reactivation comment that exceeds the maximum lifecycle
  comment length of 1,000 characters, with a specific validation reason and no lifecycle change to
  any weighing area in the submission.
- **FR-009**: A successful reactivation MUST preserve the weighing area's stable identity, name,
  latitude, longitude, and creation time, changing only its lifecycle status and its reactivation
  context.
- **FR-010**: A successful reactivation MUST preserve the archive context already recorded on the
  weighing area — who archived it, when, and with what comment — so that its full lifecycle history
  remains consultable after it returns to service.
- **FR-011**: A reactivated weighing area MUST be included again in the available weighing-area
  collection and in every collection offering weighing areas for selection for new operational work,
  including shift resource staffing.
- **FR-012**: The system MUST preserve every existing reference between a reactivated weighing area
  and the shifts it was assigned to and the weighings recorded at it; no such record may be modified
  by this feature.
- **FR-013**: The reactivation experience MUST require an explicit confirmation, MUST state that the
  weighing area becomes selectable again for new operational work, and MUST offer an optional
  comment.
- **FR-014**: The administrator MUST be able to abandon a reactivation in progress, leaving every
  targeted weighing area unchanged.
- **FR-015**: The system MUST ensure that repeated or concurrent reactivation attempts for the same
  weighing area result in exactly one recorded reactivation, with every other attempt refused as
  already available, whether the weighing area was submitted on its own or within a selection.
- **FR-016**: A refused or failed reactivation MUST leave the weighing area's stored lifecycle
  status and lifecycle context exactly as they were before the attempt.
- **FR-017**: After a reactivation succeeds or is refused, the weighing-area consultation experience
  MUST reflect the authoritative current lifecycle status and context without requiring the
  administrator to leave the Checkpoints map or reload the page.
- **FR-018**: The reactivation action MUST be offered only for weighing areas the administrator is
  permitted to reactivate, while authorization, eligibility, and submission-validity decisions
  remain enforced authoritatively by the system regardless of what the user experience offers or
  hides.
- **FR-019**: A weighing area MUST be able to move between archived and available repeatedly over
  its life, each transition recorded in turn, with the most recent transition determining the
  current status.

#### Reactivating several weighing areas at once

- **FR-020**: The system MUST allow an authorized administrator to submit several weighing areas for
  reactivation in one action, with one optional comment applying to the whole submission.
- **FR-021**: A multiple reactivation MUST be authorized by exactly the same administration right as
  reactivating one weighing area, and MUST be denied as a whole to every other user.
- **FR-022**: A multiple reactivation MUST apply the same existence and lifecycle-state rules to
  every submitted weighing area as an individual reactivation, assessed at submission time against
  authoritative stored state rather than against the collection the administrator was looking at.
- **FR-023**: Once the selection itself is valid, a multiple reactivation MUST apply partial
  success: every eligible weighing area MUST be reactivated, and every blocked one MUST be left
  completely unchanged rather than the whole submission being refused because one is ineligible.
- **FR-024**: A multiple reactivation MUST report, for each weighing area it left unchanged, an
  identifying label and exactly one specific reason: `NOT_FOUND` or `ALREADY_AVAILABLE`.
- **FR-025**: Every weighing area reactivated within one multiple reactivation MUST record the same
  reactivation time, the same responsible administrator, and the same comment, and that comment MUST
  be recorded against no weighing area the submission did not reactivate.
- **FR-026**: A multiple reactivation MUST record either all of its eligible reactivations or none
  of them, so a failure part-way through never leaves some weighing areas reactivated and others
  silently skipped.
- **FR-027**: A multiple reactivation MUST NOT partially reactivate an individual weighing area:
  each one is either reactivated with its complete lifecycle metadata or left entirely untouched.
- **FR-028**: The system MUST reject, before any weighing area changes, a submission that names no
  weighing area, that names the same weighing area more than once, or that carries a malformed
  identifier.
- **FR-029**: The system MUST report the aggregate outcome of a multiple reactivation, stating how
  many weighing areas were reactivated and how many were left unchanged, alongside the individual
  blocked entries and their reasons.
- **FR-030**: The administrator MUST be able to select several archived weighing areas in the
  Checkpoints map, see how many are selected, clear the selection, and resubmit a corrected or
  reduced selection without the weighing areas already reactivated being re-attempted or
  re-reported.
- **FR-031**: Selection MUST offer only weighing areas the administrator is permitted to reactivate,
  MUST NOT carry a selected weighing area into a lifecycle-status or resource-kind scope where it is
  no longer listed, and MUST keep a selected weighing area that is merely hidden by a search term.
- **FR-032**: The multi-selection and bulk reactivation experience MUST be offered only to users
  authorized to reactivate, and MUST NOT interfere with selecting a single checkpoint to consult its
  details.
- **FR-033**: Selecting and reactivating weighing areas MUST behave consistently with the dock
  reactivation already delivered on the same Checkpoints map — the same way selection is entered and
  left, the same selection shortcuts, and the same outcome reporting — so that administrators meet
  one interaction model for both checkpoint kinds rather than two.
- **FR-034**: The system MUST report authorization refusals, not-found refusals, already-available
  conflicts, comment validation failures, invalid submissions, and transient failures with distinct,
  understandable, and actionable feedback.

#### Out of scope

- **FR-035**: This slice MUST NOT list, create, update, or archive weighing areas, MUST NOT
  permanently delete a weighing area, MUST NOT change any weighing area's name, latitude, or
  longitude as part of reactivating, and MUST NOT reactivate any other checkpoint or site-reference
  type; those behaviors remain owned by separate delivery slices.

### Key Entities *(include if feature involves data)*

- **Weighing Area**: The weighbridge checkpoint being returned to operational use. Reactivation
  changes only its lifecycle status and reactivation context; its stable identity, name, latitude,
  longitude, and creation time are preserved.
- **Weighing Area Lifecycle Context**: The reactivation information recorded by this feature —
  reactivation time, responsible administrator, and optional comment — alongside the archive context
  recorded by #205, which reactivation preserves. Weighing areas reactivated by the same action
  share identical reactivation context.
- **Weighing Area Selection**: The set of archived weighing areas an administrator has chosen in the
  Checkpoints map for a multiple reactivation, submitted with one optional shared comment. It holds
  only weighing areas the administrator may reactivate, is scoped to the lifecycle status and
  resource-kind filter in which they were chosen, is unaffected by search, and must be non-empty and
  duplicate-free to be evaluated at all.
- **Reactivation Outcome**: The result of a reactivation, pairing the weighing areas that were
  reactivated with the ones left unchanged. Each unchanged weighing area carries an identifying
  label and exactly one reason: `NOT_FOUND` or `ALREADY_AVAILABLE`.
- **Authorized Administrator**: An active organization administrator or operations administrator
  permitted to reactivate a weighing area at their operating site and to consult archived weighing
  areas; the only actor permitted to perform this feature's actions.
- **Operating Site**: The operational scope that owns weighing-area records and bounds which
  weighing areas an authorized administrator may reactivate.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of individual reactivation attempts by organization
  administrators and operations administrators on archived weighing areas succeed, and the available
  status is visible in consultation within 2 seconds under normal operating conditions without a
  manual reload.
- **SC-002**: In acceptance testing, 100% of multiple reactivations on a selection made entirely of
  archived weighing areas reactivate every weighing area in the selection in one action.
- **SC-003**: In a multiple-reactivation acceptance matrix mixing archived, already-available, and
  unknown weighing areas, 100% of archived ones are reactivated and 100% of blocked ones are left
  unchanged and reported with the correct one of `NOT_FOUND` or `ALREADY_AVAILABLE`, in every tested
  combination including the all-blocked case.
- **SC-004**: In acceptance testing, 100% of reactivation submissions that are empty, duplicated,
  malformed, or carry an over-long comment are rejected with zero weighing areas changed.
- **SC-005**: In acceptance testing, 100% of reactivation attempts by unauthenticated visitors,
  non-active users, and active users without weighing-area administration rights are denied with
  zero lifecycle changes, for individual and multiple reactivation alike, and no reactivation action
  or bulk selection is offered to them.
- **SC-006**: Across concurrent-submission acceptance scenarios where the same weighing area appears
  in more than one simultaneous reactivation, exactly one reactivation of it is recorded in 100% of
  runs, with zero reactivation contexts overwritten and every other submission reporting it as
  already available.
- **SC-007**: In 100% of acceptance datasets, a reactivated weighing area keeps its identity, name,
  latitude, longitude, and creation time, keeps the archive context that preceded it, and appears
  again in every collection offering weighing areas for new operational work.
- **SC-008**: In 100% of acceptance datasets, shift assignments and recorded weighings previously
  attached to a weighing area remain attached to the same weighing area after it is reactivated, and
  0% of weighing areas are permanently deleted.
- **SC-009**: In all acceptance datasets, every weighing area reactivated within one multiple
  reactivation shares an identical reactivation time, responsible administrator, and comment, and no
  multiple reactivation ever leaves part of its eligible set reactivated after a failure.
- **SC-010**: Every tested refusal condition — authorization, not found, already available,
  over-long comment, empty selection, duplicated selection, malformed identifier, and transient
  failure — produces distinct and accurate feedback, and every transient failure can be recovered
  through a retry that reactivates each weighing area exactly once.
- **SC-011**: Reactivating a selection of 100 weighing areas completes within 2 seconds in the
  acceptance environment, and the administrator sees a confirmed result or an explicit refusal
  within 2 seconds for 95% of submissions under normal operating conditions.
- **SC-012**: At least 90% of representative authorized administrators can locate a batch of five to
  ten archived weighing areas and complete their reactivation in one action, on their first attempt,
  within 60 seconds, without external help, and can correctly state from the reported outcome which
  ones were not reactivated and why.

## Assumptions

- "Authorized administrator" means an active organization administrator or an active operations
  administrator — the same weighing-area administration right that already governs weighing-area
  consultation (#202), creation (#203), update (#204), and archival (#205).
- Each operating organization owns exactly one site, so the administrator's organization determines
  which weighing areas they may reactivate.
- Reactivation is the exact mirror of archival (#205) and reuses its shape: same authorization, same
  optional shared comment model with the same 1,000-character limit, same partial-success contract,
  same rejection of empty, duplicated, or malformed selections. Only the eligibility direction and
  the blocker set differ.
- Reactivation has no usage-based blocker. An archived weighing area holds no shift membership
  belonging to a planned or active discharge by construction, so `IN_USE` cannot arise on this path
  and the blocker set is exactly `NOT_FOUND` and `ALREADY_AVAILABLE`, as the issue states.
- Individual reactivation of one weighing area and multiple reactivation of a selection are the same
  capability at two scopes, not two features; they share eligibility rules, blocker reasons, comment
  handling, and authorization.
- The optional comment applies uniformly to every weighing area a given submission successfully
  reactivates; there is no per-weighing-area comment within one multiple reactivation, matching the
  shared-comment model already used by the comparable bulk lifecycle actions on other site
  references.
- A malformed or duplicated identifier in a selection causes the whole submission to be rejected
  before any evaluation, deliberately distinct from a well-formed identifier that resolves to
  nothing and is reported per weighing area as `NOT_FOUND`.
- Concurrency is resolved per weighing area with no optimistic-locking prompt: the first submission
  to reach a given weighing area reactivates it, and every other concurrent submission sees it as
  already available.
- Reactivation records its own lifecycle context and preserves the archive context recorded by #205;
  the two directions are kept side by side so a weighing area's full lifecycle remains consultable.
  Repeating a direction replaces that direction's context rather than accumulating a history log.
- This slice reuses the map-based Checkpoints consultation area introduced by #202 — extended with
  multi-selection and bulk lifecycle actions by Archive Docks (#200), Reactivate Docks (#201), and
  Archive Weighing Areas (#205) — as the surface from which one weighing area or a selection is
  reactivated, rather than introducing a separate standalone page. That surface already exposes the
  archived lifecycle-status filter needed to find archived weighing areas.
- Multi-selection is a distinct concept from selecting one checkpoint to consult its details; the
  two coexist without one overriding the other, and a submission never mixes checkpoint kinds.
- No explicit maximum number of weighing areas per submission is imposed, following the shared
  selection rule already used for the other site-reference bulk lifecycle actions. Realistic
  selections are bounded by the site's low-cardinality checkpoint collection, sized at up to 500
  weighing areas by #202.
- Individual weighing-area reactivation already exists on the API from earlier delivery, and the
  Checkpoints map already carries explicit placeholders for weighing-area reactivation. This slice
  owns the behavior end to end regardless: it completes the multiple-reactivation contract and the
  administration surface, and aligns any existing behavior — including comment validation — with
  this specification.
- Available and archived remain the only weighing-area lifecycle states. Reactivation never deletes
  data, and permanent deletion of a weighing area is out of scope for this and every current
  weighing-area slice.
- Reactivating a weighing area has no effect on name uniqueness, because weighing-area names are
  unique across both lifecycle states as enforced by creation (#203) and update (#204), and archival
  never released the name.
- The established application language, validation-messaging, focus-management, and accessibility
  conventions apply to the reactivation confirmation, comment field, and outcome reporting.
- Weighing-area records already exist in both lifecycle states through creation (#203), archival
  (#205), and the seeded site-reference fixtures, so this slice is verifiable against existing data.
- Listing (#202), creating (#203), updating (#204), and archiving (#205) weighing areas are
  independently deliverable sibling issues and stay outside this slice, as does the reactivation of
  any other checkpoint type.
