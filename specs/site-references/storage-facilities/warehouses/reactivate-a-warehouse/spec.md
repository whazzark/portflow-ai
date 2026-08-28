# Feature Specification: Reactivate a Warehouse

**Feature Branch**: `feat/211-reactivate-warehouse`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "l'issue 211" — https://github.com/whazzark/portflow-ai/issues/211

**Feature ID**: `GH-211`

**GitHub Issue**: [#211](https://github.com/whazzark/portflow-ai/issues/211)

**Parent Roadmap**: `specs/site-references/storage-facilities/warehouses/roadmap.md`

**Domain**: site-references

## Clarifications

### Session 2026-08-27 — amended by [#216](../../warehouse-doors/reactivate-a-warehouse-door/spec.md)

- Q: Which doors does a warehouse reactivation restore? → A: **Amended.** Every door the warehouse
  holds. Archiving a warehouse now takes every one of its doors — replacing the context of any door
  archived on its own — so its reactivation is the exact mirror and gives every one of them back.
  There is no independently archived door under an archived warehouse to leave alone.

**FR-007, FR-008, and FR-009 below are superseded by this answer**, and the
`archived_with_warehouse` record they turned on is dropped by #216. Their original wording is kept,
struck through, so the change is legible rather than silently rewritten.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bring One Archived Warehouse and Its Cascaded Doors Back Into Service (Priority: P1)

As an organization administrator or operations administrator, I want to reactivate a single archived
storage building that the site uses again so that it and the doors that were archived with it are
offered once more for new discharges, without losing the building's identity, footprint, doors, or
the record of the period it spent archived.

**Why this priority**: This is the core outcome the slice exists for. Archiving a warehouse (#210)
is reversible in intent but not yet in practice: a building that returns to service after works, or
one archived by mistake, currently has no way back into the operational selection. Recreating it is
impossible — archival never released its name — and reactivating its doors one by one would not
bring the building itself back. This story is also the only one that restores the door cascade, the
behavior that distinguishes warehouse reactivation from every sibling reactivation slice.

**Independent Test**: Sign in as an organization administrator or operations administrator, open an
archived warehouse on the warehouse map, reactivate it with or without a comment, and verify the
warehouse becomes available, every one of its doors becomes available again, and the warehouse keeps
its identity, name, complete footprint, creation time, and its record of having been archived.

**Acceptance Scenarios**:

1. **Given** an archived warehouse, **When** an authorized administrator reactivates it, **Then**
   its lifecycle status becomes available, the reactivating administrator and the reactivation time
   are recorded, and the reactivation is confirmed.
2. **Given** an archived warehouse whose doors were archived with it, **When** it is reactivated,
   **Then** every one of those doors becomes available again in the same action and carries the same
   reactivation time, the same responsible administrator, and the same comment as the warehouse.
3. **Given** an archived warehouse holding a door that had been archived on its own before the
   warehouse was archived, **When** the warehouse is reactivated, **Then** that door becomes
   available with every other — the warehouse's archival had already taken it over (amended by
   #216).
4. **Given** an archived warehouse with no door at all, **When** it is reactivated, **Then** the
   reactivation succeeds and the absence of doors to restore is not reported as a failure.
5. **Given** the administrator supplies a comment while reactivating, **When** the reactivation
   succeeds, **Then** that comment is recorded as the reactivation comment on the warehouse and on
   every door restored with it, and is shown in the warehouse's details.
6. **Given** the administrator reactivates without supplying a comment, or supplies only whitespace,
   **When** the reactivation succeeds, **Then** the warehouse is reactivated with the reactivation
   time and responsible administrator recorded and no reactivation comment shown.
7. **Given** a warehouse was just reactivated, **When** the warehouse map or the warehouse's details
   are consulted, **Then** it is shown as available with its footprint unchanged, its identity,
   name, every boundary point, and creation time are unchanged, and each restored door is shown as
   available rather than still claiming to be archived.
8. **Given** a warehouse that was archived with an archive comment, **When** it is reactivated,
   **Then** the record of who archived it, when, and with what comment remains consultable alongside
   the new reactivation record, on the warehouse and on the doors restored with it.
9. **Given** a warehouse was just reactivated, **When** an authorized user prepares a discharge or
   staffs a shift, **Then** the warehouse and its restored doors are offered again among the
   warehouses and warehouse doors available for new operational work.
10. **Given** an administrator opens the reactivation confirmation for an archived warehouse,
    **When** the administrator abandons it, **Then** the warehouse and every one of its doors remain
    archived and entirely unchanged.

---

### User Story 2 - Reactivate a Selection of Archived Warehouses Together (Priority: P1)

As an organization administrator or operations administrator, I want to select several archived
warehouses on the warehouse map and reactivate the eligible ones in one action, so that reopening a
storage zone after works does not require repeating the same confirmation once per building, and so
that I can see at a glance which ones could not be reactivated and why.

**Why this priority**: Warehouses are archived in groups when a storage zone closes, so they come
back in groups when it reopens. Archive a Warehouse (#210) already delivers group archival; a
reactivation capability that only works one warehouse at a time would leave the reverse direction
slow and error-prone, and would break the single-and-multiple contract every sibling site-reference
lifecycle action already honors.

**Independent Test**: Select a mix of archived warehouses, already-available warehouses, and one
identifier that resolves to nothing, submit one reactivation action with an optional shared comment,
and verify every archived warehouse is reactivated together with the doors archived with it, every
blocked one is left untouched with all of its doors, and the outcome names each blocked one with a
specific reason.

**Acceptance Scenarios**:

1. **Given** a selection made only of archived warehouses, **When** an authorized administrator
   reactivates the selection in one action, **Then** every warehouse in the selection becomes
   available together with the doors archived with it, the administrator is told how many were
   reactivated, and the warehouse map reflects the change without a manual reload.
2. **Given** several warehouses are reactivated in one action, **When** their details are opened,
   **Then** they and all of their restored doors carry the same reactivation time, the same
   responsible administrator, and the same comment.
3. **Given** a selection mixes archived warehouses with warehouses that are already available and
   with identifiers that resolve to no warehouse, **When** the administrator submits the
   reactivation, **Then** every archived warehouse is reactivated and every blocked one is left
   unchanged, with all of its doors, and reported individually with its own reason: not found, or
   already available.
4. **Given** a reactivation produced blocked warehouses, **When** the administrator reviews the
   outcome, **Then** the reactivated ones and the blocked ones with their reasons are both clearly
   presented, and the administrator can tell exactly which warehouses changed.
5. **Given** every warehouse in the selection is blocked, **When** the selection is reactivated,
   **Then** nothing is reactivated, the administrator is told that nothing changed, and each
   blocking reason is reported individually.
6. **Given** a selection contains ten archived warehouses, **When** the administrator reactivates
   the selection, **Then** all ten become available in one action rather than requiring ten separate
   submissions.
7. **Given** an outcome reported some warehouses as blocked, **When** the administrator narrows the
   selection to the remaining archived ones and resubmits, **Then** the resubmission succeeds for
   them without re-attempting or re-reporting the ones already reactivated.
8. **Given** an administrator has selected archived warehouses, **When** they switch the
   lifecycle-status filter, **Then** the selection no longer offers warehouses that are not listed
   in the new scope; **and When** they merely narrow the search term, **Then** a selected warehouse
   hidden by the search remains part of the selection.

---

### User Story 3 - Reject Invalid Submissions and Protect What Must Not Change (Priority: P2)

As the operating organization, I want a reactivation refused outright when its selection is empty,
malformed, or contains duplicates, refused per-actor when the requester is not authorized, and
refused with a specific reason when a warehouse is not eligible, so that no building and no
unloading door is ever put back into service by mistake, by an unauthorized actor, or as a
side-effect of a broken request.

**Why this priority**: Returning a warehouse to the pool offered for new discharges is a decision
with physical consequences on the site, and it moves several doors at once. These guard rails must
hold whether the request comes from the warehouse map or is sent directly, but they matter only once
the successful individual and multiple reactivation paths exist.

**Independent Test**: Attempt reactivation with an empty selection, with a duplicated identifier,
with a malformed identifier, with an over-long comment, and as an unauthenticated visitor, as a user
whose access is not active, and as each active role without warehouse administration rights; verify
every attempt is refused before any warehouse or door changes and no partial effect is left behind.

**Acceptance Scenarios**:

1. **Given** a multiple-reactivation request with an empty selection, **When** it is submitted,
   **Then** it is rejected as an invalid submission before any warehouse or door is evaluated or
   changed.
2. **Given** a multiple-reactivation request whose selection names the same warehouse twice, or
   carries an identifier that is not a valid warehouse reference, **When** it is submitted, **Then**
   the whole request is rejected before any warehouse or door is evaluated or changed, rather than
   silently de-duplicating or skipping the malformed entry.
3. **Given** a reactivation whose comment exceeds the maximum lifecycle comment length, **When** it
   is submitted individually or for a selection, **Then** it is refused with a specific validation
   reason, no warehouse and no door in the submission changes, and shortening the comment and
   resubmitting succeeds without rebuilding the selection.
4. **Given** an unauthenticated visitor, a user whose access is not active, or an active user
   without warehouse administration rights, **When** a reactivation of one warehouse or of a
   selection is attempted, **Then** it is denied, no warehouse and no door changes, no warehouse
   data is disclosed, and no reactivation action was offered to them.
5. **Given** a warehouse that is already available, **When** an authorized administrator attempts to
   reactivate it individually, **Then** the attempt is refused as already available, and its
   existing lifecycle context and every one of its doors are left unchanged — in particular, no
   archived door of that warehouse is restored as a side-effect.
6. **Given** an identifier that resolves to no warehouse, or one belonging to another operating
   site, **When** an authorized administrator attempts to reactivate it individually, **Then** the
   attempt is refused as not found, without disclosing information about other warehouses.
7. **Given** any refused or failed reactivation, individual or multiple, **When** the stored
   warehouses and doors are inspected afterwards, **Then** no warehouse's and no door's lifecycle
   status or lifecycle context has changed as a result of that attempt.
8. **Given** a reactivation fails because the underlying service is temporarily unavailable, **When**
   the administrator retries after it recovers, **Then** each warehouse and each of its cascaded
   doors is reactivated exactly once, with a single reactivation time, actor, and comment.

### Edge Cases

- A warehouse is reactivated by another administrator between the moment a selection is built and
  the moment the reactivation is submitted: it is reported as blocked because it is already
  available, rather than being silently reactivated a second time or silently dropped.
- A selection that has become entirely blocked by the time it is submitted — every warehouse now
  available or no longer existing — reactivates nothing and reports every entry individually; it is
  not treated as an empty submission.
- Two administrators submit overlapping selections containing the same archived warehouse at nearly
  the same time: exactly one reactivation of it and of its cascaded doors is recorded, and the other
  submission reports it as already available rather than reactivating it twice or overwriting the
  first reactivation's comment.
- A warehouse is archived by one administrator while another is reactivating a selection containing
  it: the outcome reflects the warehouse's authoritative state at submission time, and neither the
  warehouse nor any of its doors ends in a state matching neither request.
- A door of an archived warehouse is restored by the warehouse's reactivation and, at nearly the
  same moment, another administrator archives that same warehouse again: the door never ends
  available under an archived warehouse, nor archived under an available one.
- An archived warehouse contains no door: it is reactivatable, and the empty cascade is not reported
  as an error.
- An archived warehouse's doors were all archived independently before the warehouse was archived:
  reactivating the warehouse makes the building available and restores no door, which is the correct
  outcome rather than a failure.
- A warehouse is archived, reactivated, and archived again: the second archival cascades to whatever
  doors are available at that moment, and the second reactivation restores exactly that second
  cascaded set, not the first one.
- A reactivation comment consisting only of whitespace is treated as no comment rather than stored
  as a blank comment, on the warehouse and on every door restored with it.
- A reactivation comment longer than the permitted maximum is refused with a specific validation
  reason and every warehouse in the submission, with all of its doors, stays archived.
- A multiple reactivation fails part-way through because the underlying service becomes unavailable:
  no warehouse and no door in the submission is left reactivated, and the administrator can retry
  the same selection.
- A very large selection is submitted: the action still applies in full or reports every blocked
  entry individually, rather than truncating the outcome silently.
- The administrator's warehouse administration right is revoked between building the selection and
  submitting it: the submission is denied as if they had never been authorized, and no warehouse and
  no door in the selection changes.
- A reactivated warehouse and its restored doors are still referenced by the product lot
  assignments, shift door memberships, and rotations recorded against them before archival: those
  references keep pointing at the same doors and are unaffected by the reactivation.
- Reactivating a warehouse does not affect name uniqueness, because an archived warehouse already
  held its name reserved, and its doors already held their names reserved within it.
- A reactivated warehouse's footprint overlaps another warehouse's footprint: the reactivation
  succeeds, because overlapping footprints are permitted by the domain.
- A selected warehouse is filtered out of view by a search term: it remains part of the selection,
  because search narrows what is displayed rather than what the administrator chose.
- An administrator selects warehouses and then reactivates: warehouses and checkpoints are never
  mixed inside a single reactivation submission.

## Requirements *(mandatory)*

### Functional Requirements

#### Reactivating one warehouse

- **FR-001**: The system MUST allow only active organization administrators and operations
  administrators to reactivate an archived warehouse belonging to their operating site.
- **FR-002**: The system MUST deny reactivation, individual or multiple, to unauthenticated users,
  to users whose access is not active, and to every active role without warehouse administration
  rights, without changing any warehouse or door and without disclosing warehouse data.
- **FR-003**: A warehouse is eligible for reactivation only when it is currently archived; no usage,
  occupancy, geographic, or door-count condition blocks a reactivation.
- **FR-004**: The system MUST refuse reactivation of a warehouse that is already available,
  reporting the reason `ALREADY_AVAILABLE`, and MUST leave its existing lifecycle context and every
  one of its doors unchanged.
- **FR-005**: The system MUST refuse reactivation of an identifier that resolves to no warehouse, or
  to a warehouse of another operating site, reporting the reason `NOT_FOUND`, without modifying any
  warehouse or door and without disclosing information about other warehouses.
- **FR-006**: A successful reactivation MUST change the warehouse's lifecycle status from archived
  to available and MUST record the reactivation time, the responsible administrator, and the
  supplied reactivation comment.
- **FR-007**: A successful reactivation MUST change back to available **every** door of the
  warehouse, recording on each of them the same reactivation time, the same responsible
  administrator, and the same comment as the warehouse. *(Amended by #216: was "exactly those doors
  recorded as archived through their warehouse".)*
- **FR-008**: ~~A successful reactivation MUST leave entirely unchanged every door of that warehouse
  that was archived on its own rather than through its warehouse, including its lifecycle status and
  its existing archive time, actor, and comment.~~ **Superseded by #216**: an archived warehouse
  holds no such door — its own archival took every door it contains — so every one of them returns
  to service with it.
- **FR-009**: ~~A door restored by its warehouse's reactivation MUST no longer be recorded as archived
  through its warehouse, so that a later archival of the same warehouse cascades according to the
  doors available at that moment rather than to a stale record.~~ **Superseded by #216**: with both
  directions taking every door, there is no record to clear, and the `archived_with_warehouse`
  column is dropped.
- **FR-010**: A warehouse containing no door MUST be reactivatable, and the absence of doors to
  restore MUST NOT be reported as a failure.
- **FR-011**: The system MUST accept an optional reactivation comment, MUST trim surrounding
  whitespace from it, and MUST record no comment when the supplied value is absent, empty, or
  whitespace-only.
- **FR-012**: The system MUST reject a reactivation comment that exceeds the maximum lifecycle
  comment length of 1,000 characters, with a specific validation reason and no lifecycle change to
  any warehouse or door in the submission.
- **FR-013**: A successful reactivation MUST preserve the warehouse's stable identity, name,
  complete footprint including every boundary point, and creation time, changing only its lifecycle
  status and its reactivation context.
- **FR-014**: A successful reactivation MUST preserve every door's stable identity, name, GPS
  location, containing-warehouse relationship, and creation time, and MUST NOT detach, relocate,
  rename, or delete any door.
- **FR-015**: A successful reactivation MUST preserve the archive context already recorded on the
  warehouse and on each door it restores — who archived it, when, and with what comment — so that
  the full lifecycle history remains consultable after the building returns to service.
- **FR-016**: A reactivated warehouse MUST be included again in the available warehouse collection,
  in the available warehouse count, and in every collection offering warehouses for selection for
  new operational work; each door it restored MUST be included again in every collection offering
  warehouse doors for selection for new operational work.
- **FR-017**: The system MUST preserve every existing reference between a reactivated warehouse, its
  doors, and the product lot assignments, shift door memberships, rotations, and Discharges recorded
  against them; no such record may be modified by this feature.
- **FR-018**: The reactivation experience MUST require an explicit confirmation that names the
  warehouse, states how many of its doors return to service with it, states that the warehouse and
  those doors become available again for new operations, and offers an optional comment. The
  reactivation wording is the one every site reference uses, owned by
  `apps/web/src/components/lifecycle/lifecycle-copy.ts`; the door restore clause is appended to it.
- **FR-019**: The administrator MUST be able to abandon a reactivation in progress, leaving every
  targeted warehouse and every one of their doors unchanged.
- **FR-020**: The system MUST ensure that repeated or concurrent reactivation attempts for the same
  warehouse result in exactly one recorded reactivation of that warehouse and of each of its
  cascaded doors, with every other attempt refused as already available, whether the warehouse was
  submitted on its own or within a selection.
- **FR-021**: A warehouse reactivation MUST be recorded in full or not at all: a failure MUST never
  leave a warehouse available while one of its cascaded doors remains archived, nor a door available
  while its warehouse remains archived.
- **FR-022**: A refused or failed reactivation MUST leave the stored lifecycle status and lifecycle
  context of the warehouse and of every one of its doors exactly as they were before the attempt.
- **FR-023**: After a reactivation succeeds or is refused, the warehouse consultation experience
  MUST reflect the authoritative current lifecycle status and context of the warehouse and of its
  doors — including a restored door no longer presenting itself as archived — without requiring the
  administrator to leave the warehouse map or reload the page.
- **FR-024**: The reactivation action MUST be offered only for warehouses the administrator is
  permitted to reactivate, while authorization, eligibility, and submission-validity decisions
  remain enforced authoritatively by the system regardless of what the user experience offers or
  hides.
- **FR-025**: A warehouse and its doors MUST be able to move between archived and available
  repeatedly over their life, each transition recorded in turn, with the most recent transition
  determining the current status.
- **FR-026**: The system MUST NOT permanently delete a warehouse or a warehouse door.

#### Reactivating several warehouses at once

- **FR-027**: The system MUST allow an authorized administrator to submit several warehouses for
  reactivation in one action, with one optional comment applying to the whole submission.
- **FR-028**: A multiple reactivation MUST be authorized by exactly the same administration right as
  reactivating one warehouse, and MUST be denied as a whole to every other user.
- **FR-029**: A multiple reactivation MUST apply the same existence and lifecycle-state rules to
  every submitted warehouse as an individual reactivation, assessed at submission time against
  authoritative stored state rather than against the collection the administrator was looking at.
- **FR-030**: Once the selection itself is valid, a multiple reactivation MUST apply partial success:
  every eligible warehouse MUST be reactivated together with its cascaded doors, and every blocked
  one MUST be left completely unchanged, with all of its doors, rather than the whole submission
  being refused because one is ineligible.
- **FR-031**: A multiple reactivation MUST report, for each warehouse it left unchanged, an
  identifying label and exactly one specific reason: `NOT_FOUND` or `ALREADY_AVAILABLE`.
- **FR-032**: Every warehouse reactivated within one multiple reactivation, and every door restored
  with those warehouses, MUST record the same reactivation time, the same responsible administrator,
  and the same comment, and that comment MUST be recorded against no warehouse and no door the
  submission did not reactivate.
- **FR-033**: A multiple reactivation MUST record either all of its eligible reactivations or none
  of them, so a failure part-way through never leaves some warehouses reactivated and others
  silently skipped.
- **FR-034**: A multiple reactivation MUST NOT partially reactivate an individual warehouse: each
  one is either reactivated together with all of its cascaded doors and its complete lifecycle
  metadata, or left entirely untouched.
- **FR-035**: The system MUST reject, before any warehouse or door changes, a submission that names
  no warehouse, that names the same warehouse more than once, or that carries a malformed
  identifier.
- **FR-036**: The system MUST report the aggregate outcome of a multiple reactivation, stating how
  many warehouses were reactivated and how many were left unchanged, alongside the individual
  blocked entries and their reasons.
- **FR-037**: The administrator MUST be able to select several archived warehouses in the warehouse
  map, see how many are selected, clear the selection, and resubmit a corrected or reduced selection
  without the warehouses already reactivated being re-attempted or re-reported.
- **FR-038**: Selection MUST offer only warehouses the administrator is permitted to reactivate,
  MUST NOT carry a selected warehouse into a lifecycle-status scope where it is no longer listed,
  and MUST keep a selected warehouse that is merely hidden by a search term.
- **FR-039**: The multi-selection and bulk reactivation experience MUST be offered only to users
  authorized to reactivate, and MUST NOT interfere with selecting a single warehouse to consult its
  details and doors.
- **FR-040**: Selecting and reactivating warehouses MUST behave consistently with the warehouse
  archival already delivered on the same warehouse map and with the equivalent checkpoint behavior
  on the Checkpoints map — the same way selection is entered and left, the same selection shortcuts,
  and the same outcome reporting — so that administrators meet one interaction model across site
  references rather than a second one for warehouse polygons.
- **FR-041**: The system MUST report authorization refusals, not-found refusals, already-available
  conflicts, comment validation failures, invalid submissions, and transient failures with distinct,
  understandable, and actionable feedback.

#### Out of scope

- **FR-042**: This slice MUST NOT list, create, update, or archive warehouses; MUST NOT create,
  update, relocate, or independently archive or reactivate a warehouse door; MUST NOT permanently
  delete a warehouse or a door; MUST NOT change any warehouse's name or footprint as part of
  reactivating; and MUST NOT reactivate any other site-reference type. Those behaviors remain owned
  by separate delivery slices.

### Key Entities *(include if feature involves data)*

- **Warehouse**: The storage destination being returned to operational use. Reactivation changes
  only its lifecycle status and reactivation context; its stable identity, name, complete footprint,
  and creation time are preserved.
- **Warehouse Footprint**: The warehouse's geographic polygon, including every boundary point.
  Reactivation does not alter it, and it does not need to be re-validated against other warehouses,
  since footprints may overlap.
- **Warehouse Door**: An unloading door permanently belonging to one warehouse. Every door of a
  reactivated warehouse returns to available with it, carrying the warehouse's own reactivation
  context (amended by #216). No door's identity, name, location, containing warehouse, or history is
  altered.
- **Warehouse Door Archival Origin**: Whether an archived door was archived through its warehouse or
  on its own. Since #216 it is nothing recorded on the door: an archived warehouse holds only doors
  archived with it, so the containing warehouse's status states the origin.
- **Warehouse Lifecycle Context**: The reactivation information recorded by this feature —
  reactivation time, responsible administrator, and optional comment — alongside the archive context
  recorded by #210, which reactivation preserves. A warehouse and the doors restored with it share
  identical reactivation context, as do all warehouses reactivated by the same action.
- **Warehouse Selection**: The set of archived warehouses an administrator has chosen in the
  warehouse map for a multiple reactivation, submitted with one optional shared comment. It holds
  only warehouses the administrator may reactivate, is scoped to the lifecycle status in which they
  were chosen, is unaffected by search, and must be non-empty and duplicate-free to be evaluated at
  all.
- **Reactivation Outcome**: The result of a reactivation, pairing the warehouses that were
  reactivated with the ones left unchanged. Each unchanged warehouse carries an identifying label
  and exactly one reason: `NOT_FOUND` or `ALREADY_AVAILABLE`.
- **Authorized Administrator**: An active organization administrator or operations administrator
  permitted to reactivate a warehouse at their operating site; the only actor permitted to perform
  this feature's actions.
- **Operating Site**: The operational scope that owns warehouse and warehouse-door records and
  bounds which warehouses an authorized administrator may reactivate.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of individual reactivation attempts by organization
  administrators and operations administrators on archived warehouses succeed, and the available
  status of the warehouse and of its restored doors is visible in consultation within 2 seconds
  under normal operating conditions without a manual reload.
- **SC-002**: In every successful reactivation, 100% of the warehouse's doors become available with
  an identical reactivation time, actor, and comment, and 100% of them keep their archive time,
  actor, and comment readable beside it (amended by #216).
- **SC-003**: In acceptance testing, 100% of archived warehouses that have no door are reactivated
  successfully with zero doors restored and zero
  errors reported.
- **SC-004**: In acceptance testing, 100% of multiple reactivations on a selection made entirely of
  archived warehouses reactivate every warehouse in the selection, with its cascaded doors, in one
  action.
- **SC-005**: In a multiple-reactivation acceptance matrix mixing archived, already-available, and
  unknown warehouses, 100% of archived ones are reactivated with their cascaded doors and 100% of
  blocked ones are left unchanged, with all of their doors, and reported with the correct one of
  `NOT_FOUND` or `ALREADY_AVAILABLE`, in every tested combination including the all-blocked case.
- **SC-006**: In acceptance testing, 100% of reactivation submissions that are empty, duplicated,
  malformed, or carry an over-long comment are rejected with zero warehouses and zero doors changed.
- **SC-007**: In acceptance testing, 100% of reactivation attempts by unauthenticated visitors,
  non-active users, and active users without warehouse administration rights are denied with zero
  lifecycle changes to any warehouse or door, for individual and multiple reactivation alike, and no
  reactivation action or bulk selection is offered to them.
- **SC-008**: Across concurrent-submission acceptance scenarios where the same warehouse appears in
  more than one simultaneous reactivation, exactly one reactivation of it and of each of its
  cascaded doors is recorded in 100% of runs, with zero lifecycle contexts overwritten and every
  other submission reporting it as already available.
- **SC-009**: Across every tested failure and refusal path, 0% of runs leave a warehouse available
  while one of its cascaded doors remains archived, or a door available while its warehouse remains
  archived.
- **SC-010**: In 100% of acceptance datasets, a reactivated warehouse keeps its identity, name,
  complete footprint with every boundary point, and creation time; 100% of its doors keep their
  name, GPS location, and containing warehouse; the archive context that preceded the reactivation
  remains readable on both; and 0% of warehouses or doors are permanently deleted.
- **SC-011**: In 100% of acceptance datasets, product lot assignments, shift door memberships, and
  rotations previously attached to a door of a reactivated warehouse remain attached to that same
  door, and the warehouse and its restored doors appear again in every collection offering
  warehouses or doors for new operational work.
- **SC-012**: In all acceptance datasets, a warehouse archived, reactivated, and archived again
  cascades on each archival to every door it holds, and each reactivation restores every one of them
  — 100% of runs leave the warehouse and its doors on the same side of the lifecycle.
- **SC-013**: Every tested refusal condition — authorization, not found, already available,
  over-long comment, empty selection, duplicated selection, malformed identifier, and transient
  failure — produces distinct and accurate feedback, and every transient failure can be recovered
  through a retry that reactivates each warehouse and its doors exactly once.
- **SC-014**: Reactivating a selection of 50 warehouses totalling up to 500 doors completes within 2
  seconds in the acceptance environment, and the administrator sees a confirmed result or an
  explicit refusal within 2 seconds for 95% of submissions under normal operating conditions.
- **SC-015**: At least 90% of representative authorized administrators can locate a batch of five to
  ten archived warehouses and complete their reactivation in one action, on their first attempt,
  within 60 seconds, without external help, can correctly state before confirming how many doors
  return with a given warehouse, and can correctly state from the reported outcome which ones were
  not reactivated and why.

## Assumptions

- "Authorized administrator" means an active organization administrator or an active operations
  administrator — the same warehouse administration right that already governs warehouse archival
  (#210). Warehouse consultation itself remains open to every active user, as established by List
  Warehouses (#207), so archived warehouses and their doors stay readable to all active users rather
  than to administrators only.
- Each operating organization owns exactly one site, so the administrator's organization determines
  which warehouses they may reactivate.
- Reactivation is the exact mirror of archival (#210) and reuses its shape: same authorization, same
  optional shared comment model with the same 1,000-character limit, same door cascade, same
  partial-success contract, same rejection of empty, duplicated, or malformed selections. Only the
  eligibility direction and the blocker set differ.
- "Exact mirror" is literal since #216: the archival takes every door of the warehouse, so the
  restore gives every one of them back. Recovering a door on its own remains Reactivate a Warehouse
  Door (#216), and it applies only while the containing warehouse is available — which is the only
  state in which a door is archived on its own at all.
- Reactivation has no usage-based blocker. An archived warehouse holds no door with a current
  product lot assignment belonging to a Planned or Active Discharge by construction, so the
  `IN_USE` reason that blocks archival cannot arise on this path, and the blocker set is exactly
  `NOT_FOUND` and `ALREADY_AVAILABLE`.
- Reactivation has no geographic blocker either: Create a Warehouse (#208) establishes that
  footprints of different warehouses may overlap, so a footprint never needs re-validating when its
  warehouse returns to service.
- Individual reactivation of one warehouse and multiple reactivation of a selection are the same
  capability at two scopes, not two features; they share eligibility rules, blocker reasons, comment
  handling, cascade behavior, and authorization. Covering both matches the single-and-multiple
  contract already delivered for customers (`GH-195`), transport companies (`GH-220`), trucks
  (`GH-225`), docks (`GH-200`), weighing areas (`GH-205`, `GH-206`), and warehouse archival
  (`GH-210`).
- The optional comment applies uniformly to every warehouse a given submission successfully
  reactivates and to every door restored with them; there is no per-warehouse or per-door comment
  within one multiple reactivation.
- A malformed or duplicated identifier in a selection causes the whole submission to be rejected
  before any evaluation, deliberately distinct from a well-formed identifier that resolves to
  nothing and is reported per warehouse as `NOT_FOUND`.
- Concurrency is resolved per warehouse with no optimistic-locking prompt: the first submission to
  reach a given warehouse reactivates it and its cascaded doors, and every other concurrent
  submission sees it as already available. As with archival, the all-or-nothing guarantee spans the
  warehouse and its doors together, because a door made available under an archived warehouse — or
  left archived under an available one — is an operationally invalid state, not merely an
  inconsistent display.
- Reactivation records its own lifecycle context and preserves the archive context recorded by #210;
  the two directions are kept side by side so a warehouse's full lifecycle remains consultable.
  Repeating a direction replaces that direction's context rather than accumulating a history log.
- Consultation of a door's lifecycle is gated on its current status rather than on the presence of
  an archive timestamp alone, as already established by #210: reactivation leaves the archive
  context readable, and a restored door must not keep presenting itself as archived.
- This slice reuses the map-based warehouse consultation area introduced by #207 — extended with
  multi-selection and bulk lifecycle actions by Archive a Warehouse (#210) — as the surface from
  which one warehouse or a selection is reactivated, rather than introducing a separate standalone
  page. That surface already exposes the archived lifecycle-status filter needed to find archived
  warehouses, and #210 already lifted the bulk lifecycle machinery into a resource-agnostic form
  this slice drives with a warehouse configuration rather than duplicating.
- Multi-selection is a distinct concept from selecting one warehouse to consult its details and
  doors; the two coexist without one overriding the other, and a submission never mixes warehouses
  with checkpoints.
- No explicit maximum number of warehouses per submission is imposed, following the shared selection
  rule already used for the other site-reference bulk lifecycle actions. Realistic selections are
  bounded by the site's low-cardinality warehouse collection, sized at up to 200 warehouses by #207.
- Available and archived remain the only warehouse and warehouse-door lifecycle states. Reactivation
  never deletes data, and permanent deletion of a warehouse or a door is out of scope for this and
  every current storage-facility slice.
- Reactivating a warehouse has no effect on name uniqueness: warehouse names are unique across both
  lifecycle states as enforced by creation (#208), door names are unique within their containing
  warehouse across both states as established by List Warehouse Doors (#212 FR-006a), and archival
  never released either.
- The `Warehouse` entry in `CONTEXT.md` already describes the archival cascade and the cascade
  record introduced by #210. Delivering this slice requires extending that entry to state that
  reactivating a warehouse restores exactly the doors archived with it, so that the reverse
  direction is documented in the same single home as the forward one.
- API authorization and eligibility checks are authoritative for every rule in this specification;
  any interface-level restriction is a courtesy that does not replace server-side enforcement.
- The established application language, validation-messaging, focus-management, and accessibility
  conventions apply to the reactivation confirmation, comment field, and outcome reporting.
- Warehouse and warehouse-door records already exist in both lifecycle states through creation
  (#208), archival (#210), and the seeded site-reference fixtures, so this slice is verifiable
  against existing data.
- List Warehouses (#207), Create a Warehouse (#208), Update a Warehouse (#209), and Archive a
  Warehouse (#210) are independently deliverable sibling issues and stay outside this slice, as do
  Archive a Warehouse Door (#215), Reactivate a Warehouse Door (#216), and the reactivation of any
  other site-reference type. The issue records #210 and #207 as blocking dependencies; both are
  delivered.
