# Feature Specification: Archive Docks

**Feature Branch**: `feat/200-archive-dock`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "l'issue 200 et prends en compte aussi qu'on puisse faire un archivage multiple de dock (also account for being able to do a multiple archiving of docks) — https://github.com/whazzark/portflow-ai/issues/200"

**Feature ID**: `GH-200`

**GitHub Issue**: [#200](https://github.com/whazzark/portflow-ai/issues/200)

**Parent Roadmap**: `specs/site-references/operational-checkpoints/docks/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Archive One Eligible Dock (Priority: P1)

As an authorized administrator, I want to archive a single available dock that is no longer in
active use so that it stops being offered for new discharge assignments while its history stays
consultable.

**Why this priority**: This is the core outcome the slice exists for. Without it, retired or
mis-created docks keep cluttering the selection an operator sees when planning a discharge, and the
site reference list never reflects the physical reality of the site.

**Independent Test**: Sign in as an authorized administrator, open an available dock that is not
referenced by any planned or active discharge, archive it optionally with a comment, and verify it
no longer appears in dock selections while it still appears, marked Archived, in consultation.

**Acceptance Scenarios**:

1. **Given** an available dock with no planned or active discharge referencing it, **When** an
   authorized administrator archives it, **Then** the dock's status becomes Archived, the archiving
   administrator and timestamp are recorded, and the dock is confirmed archived.
2. **Given** the administrator supplies a comment while archiving, **When** the archive succeeds,
   **Then** the comment is stored against that archive transition and is visible in the dock's
   details.
3. **Given** the administrator archives the dock without a comment, **When** the archive succeeds,
   **Then** the dock is archived with no archive comment recorded.
4. **Given** a dock was just archived, **When** any authorized user consults the checkpoint
   collection or the dock's details, **Then** the dock is shown as Archived, its identity, name, and
   position are unchanged, and it no longer appears among the docks offered for new discharge
   assignment.

---

### User Story 2 - Archive a Selection of Eligible Docks Together (Priority: P1)

As an authorized administrator, I want to select several docks at once and archive the eligible
ones in a single action, so that retiring a batch of docks after a site reorganization does not
require repeating the same action one dock at a time.

**Why this priority**: Docks are frequently retired in batches (a quay closes, a survey redraws
several berths at once). Requiring one-by-one archiving for every affected dock is slow and error
prone, and this is the capability the user explicitly asked to have covered in this slice.

**Independent Test**: Select a mix of eligible and ineligible docks (some in use, some already
archived, one identifier that no longer exists), submit one archive action with an optional shared
comment, and verify that every eligible dock is archived, every blocked dock is left untouched, and
the outcome names each blocked dock with a specific reason.

**Acceptance Scenarios**:

1. **Given** a selection made only of available docks with no current planned or active discharge,
   **When** an authorized administrator archives the selection, **Then** every dock in the selection
   is archived, all recording the same archiving administrator and timestamp.
2. **Given** the administrator supplies one comment for the whole selection, **When** the archive
   succeeds, **Then** that same comment is stored against every dock archived in that action.
3. **Given** a selection mixes eligible docks with docks that are already archived, docks currently
   used by a planned or active discharge, and identifiers that do not correspond to any dock,
   **When** the administrator submits the archive action, **Then** every eligible dock is archived
   and every blocked dock is reported individually with the reason it was not archived: not found,
   in use, or already archived.
4. **Given** a multiple-archive action produced blocked docks, **When** the administrator reviews
   the outcome, **Then** the successfully archived docks and the blocked docks with their reasons
   are both clearly presented, and the administrator can identify exactly which docks changed.
5. **Given** a selection contains ten eligible docks, **When** the administrator archives the
   selection, **Then** all ten become Archived in one action rather than requiring ten separate
   submissions.
6. **Given** the administrator archives a selection and some docks were blocked, **When** the
   administrator adjusts the selection to drop the blocked docks and resubmits, **Then** the
   resubmission succeeds for the remaining eligible docks without re-attempting the ones already
   archived.

---

### User Story 3 - Reject Invalid Selections and Protect What Must Not Change (Priority: P2)

As the operating organization, I want an archive request refused outright when it is empty,
malformed, or contains duplicate entries, and refused per-actor when the requester is not
authorized, so that no dock is ever archived by mistake, by an unauthorized actor, or as a
side-effect of a broken request.

**Why this priority**: These guard rails protect the integrity of the archive action and the
site-reference data, and they must hold whether the request comes from the interface or is sent
directly, but they matter only once the successful individual and multiple archive paths exist.

**Independent Test**: Attempt an archive request with an empty selection, with a duplicated
identifier, with a malformed identifier, and as an unauthenticated visitor, as an inactive user, and
as an active user without dock administration rights; verify every attempt is refused before any
dock changes and no partial effect is left behind.

**Acceptance Scenarios**:

1. **Given** an archive request with an empty selection, **When** it is submitted, **Then** it is
   rejected before any dock is evaluated or changed.
2. **Given** an archive request whose selection contains a duplicate identifier or an identifier
   that is not a valid dock reference, **When** it is submitted, **Then** the entire request is
   rejected before any dock is evaluated or changed, rather than silently de-duplicating or skipping
   the malformed entry.
3. **Given** an unauthenticated visitor, an authenticated user whose access is not active, or an
   active user without dock administration rights, **When** an archive of one dock or of a selection
   is attempted, **Then** it is refused as unauthorized and no dock is changed.
4. **Given** a dock that is already archived, **When** an administrator attempts to archive it
   individually, **Then** the attempt is refused as already archived and the dock's existing
   lifecycle metadata is unchanged.
5. **Given** a dock that is currently used by a planned or active discharge, **When** an
   administrator attempts to archive it individually, **Then** the attempt is refused as in use and
   the dock remains available.
6. **Given** a dock identifier that does not correspond to any existing dock, **When** an
   administrator attempts to archive it individually, **Then** the attempt is refused as not found,
   without disclosing information about other docks.
7. **Given** any refused archive attempt, individual or multiple, **When** the stored docks are
   inspected afterwards, **Then** no dock's status or lifecycle metadata has changed as a result of
   that attempt.

### Edge Cases

- A dock becomes used by a planned or active discharge, or is archived by another administrator,
  between the moment a selection is built and the moment the archive action is submitted: that dock
  is reported blocked with the reason current at submission time rather than being silently archived
  or silently dropped.
- A selection that becomes entirely blocked by the time it is submitted (every dock now in use,
  already archived, or no longer existing) archives nothing and reports every entry as blocked; it
  is not treated as an empty selection.
- Two administrators submit overlapping selections that both include the same dock at nearly the
  same time: exactly one archive of that dock succeeds, and the other request reports it as already
  archived rather than archiving it twice or silently overwriting the first archive's comment.
- A very large selection is submitted: the action still applies in full or reports every blocked
  entry individually, rather than truncating the outcome silently.
- A comment consisting only of whitespace is treated the same as no comment.
- A connection is lost or the archive action fails after submission: no dock ends up partially
  archived, the administrator sees a clear retryable failure message, and a retry does not produce a
  duplicate archive or a duplicate blocked report for docks already archived by the failed attempt.
- The administrator's dock administration right is revoked between building the selection and
  submitting it: the submission is refused as if they had never been authorized, and no dock in the
  selection is changed.
- A dock archived through this feature is still referenced by discharges that were already using it
  historically (closed discharges) or that captured it before archiving: those historical references
  keep pointing at the same dock and are unaffected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated, active user holding dock administration
  rights to archive one existing available dock.
- **FR-002**: The system MUST allow the same authorized administrator to submit a selection of
  several dock identifiers and archive every eligible dock in that selection through one action.
- **FR-003**: The system MUST deny an archive attempt, individual or multiple, to unauthenticated
  users, to users whose access is not active, and to authenticated active users without dock
  administration rights, without changing any dock and without disclosing dock data beyond the
  application's established access-handling behavior.
- **FR-004**: A multiple-archive request whose selection is empty MUST be rejected before any dock
  is evaluated or changed.
- **FR-005**: A multiple-archive request whose selection contains a malformed identifier or a
  duplicate identifier MUST be rejected in full before any dock is evaluated or changed.
- **FR-006**: A dock is eligible to be archived only when it is currently Available and is not
  currently referenced by a Planned or Active discharge.
- **FR-007**: The system MUST refuse to archive a dock that is already Archived, reporting the
  reason `ALREADY_ARCHIVED`, and MUST leave that dock's lifecycle metadata unchanged.
- **FR-008**: The system MUST refuse to archive a dock that is currently referenced by a Planned or
  Active discharge, reporting the reason `IN_USE`, and MUST leave that dock available.
- **FR-009**: The system MUST refuse to archive a dock identifier that does not correspond to any
  existing dock, reporting the reason `NOT_FOUND`, without disclosing information about other docks.
- **FR-010**: In a multiple-archive request, once the selection itself is valid, the system MUST
  apply partial success: every eligible dock in the selection MUST be archived, and every blocked
  dock MUST be left completely unchanged and reported individually with exactly one of the reasons
  `NOT_FOUND`, `IN_USE`, or `ALREADY_ARCHIVED`.
- **FR-011**: The administrator MAY supply one optional comment with an archive request, individual
  or multiple, and that same comment MUST be recorded against every dock the request successfully
  archives, and against no dock it does not archive.
- **FR-012**: A successful archive, individual or multiple, MUST record which administrator
  performed it and at what time, on every dock it archives.
- **FR-013**: A successful archive MUST preserve the dock's stable identity, its name, its position,
  and its creation time, and MUST change only its status and its archive lifecycle metadata.
- **FR-014**: The system MUST make an archived dock's status authoritative in every subsequent
  consultation, map rendering, detail view, and dock-selection surface, excluding it from selections
  offered for new discharge assignment without requiring a manual page reload.
- **FR-015**: The system MUST preserve every existing reference between an archived dock and the
  discharges already assigned to it; those discharges MUST continue to point at the same dock, and
  its history MUST remain consultable after archiving.
- **FR-016**: Concurrent archive attempts against the same dock, whether individual or as part of
  overlapping selections, MUST result in exactly one successful archive of that dock; every other
  concurrent attempt against it MUST resolve as a blocked outcome rather than a second archive or a
  silent overwrite.
- **FR-017**: The system MUST report the outcome of every archive attempt, distinguishing success,
  the three blocker reasons (`NOT_FOUND`, `IN_USE`, `ALREADY_ARCHIVED`), unauthorized access, and a
  retryable failure; for a multiple-archive request the outcome MUST separately list which docks
  were archived and which were blocked, each with its reason.
- **FR-018**: The administrator MUST be able to resubmit a corrected or reduced selection after a
  multiple-archive request produced blocked docks, without the already-archived docks in that prior
  request being re-attempted or re-reported.
- **FR-019**: Authorization, eligibility, and selection-validity decisions MUST be enforced
  authoritatively by the system regardless of what the user experience offers or hides.
- **FR-020**: This slice MUST NOT permanently delete a dock, MUST NOT reactivate an archived dock,
  and MUST NOT change any dock's name or position as part of archiving.

### Key Entities *(include if feature involves data)*

- **Dock**: A named operational berth positioned on the site map, carrying a stable identity, a
  current lifecycle status (Available or Archived), and archive lifecycle metadata. Only its status
  and archive metadata are affected by this feature.
- **Dock Archive Transition**: The record of one dock moving from Available to Archived: the
  archiving administrator, the time of the transition, and the optional comment supplied with it.
- **Multiple-Archive Selection**: A non-empty, duplicate-free set of dock identifiers submitted
  together with one optional shared comment, evaluated and applied as one action with per-dock
  partial-success outcomes.
- **Archive Blocker**: The reported reason a specific dock in a request was not archived: the dock
  does not exist (`NOT_FOUND`), it is referenced by a Planned or Active discharge (`IN_USE`), or it
  is already Archived (`ALREADY_ARCHIVED`).
- **Authorized Administrator**: An authenticated, active member of the operating organization whose
  assigned rights include dock administration; the only actor permitted to archive a dock or a
  selection of docks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of individual archive attempts by authorized
  administrators on eligible docks succeed, and the archived status is visible in consultation
  within 2 seconds under normal operating conditions without a manual reload.
- **SC-002**: In acceptance testing, 100% of multiple-archive attempts on a selection made entirely
  of eligible docks archive every dock in the selection in one action.
- **SC-003**: In acceptance testing, 100% of multiple-archive attempts on a mixed selection archive
  every eligible dock and report every blocked dock individually with the correct one of
  `NOT_FOUND`, `IN_USE`, or `ALREADY_ARCHIVED`.
- **SC-004**: In acceptance testing, 100% of multiple-archive requests with an empty, duplicated, or
  malformed selection are rejected with zero docks changed.
- **SC-005**: In acceptance testing, 100% of archive attempts by unauthenticated visitors,
  non-active users, and active users without dock administration rights are refused with no dock
  changed, and the archive action is not offered to them.
- **SC-006**: Across concurrent-submission acceptance scenarios where the same dock appears in more
  than one simultaneous archive request, exactly one request succeeds for that dock in 100% of runs,
  and every other request reports it as blocked rather than archiving it a second time.
- **SC-007**: In 100% of acceptance datasets, an archived dock keeps its identity, name, position,
  and creation time, and 100% of discharges previously referencing an archived dock remain able to
  reference it and read its history.
- **SC-008**: At least 90% of representative administrators can select a batch of five to ten
  eligible docks and complete their archiving in one action, on their first attempt, within 60
  seconds, without external help.
- **SC-009**: In acceptance testing involving a selection of 100 dock identifiers, the multiple
  archive action completes within 5 seconds in the acceptance environment.

## Assumptions

- "Authorized administrator" means an authenticated user with active access holding an
  organization-level or operations-level administration role, the same dock administration right
  that already governs dock consultation (#197), creation (#198), and update (#199).
- A dock qualifies as currently in use, and therefore ineligible for archiving, under the same
  Planned-or-Active discharge usage rule already established for site-reference archiving generally;
  this slice does not redefine that rule, only applies it to docks.
- Individual archiving of one dock and multiple archiving of a selection share the same eligibility
  rules, the same three blocker reasons, and the same authorization; multiple archiving is the
  selection-scoped extension of the same capability, not a separate feature.
- The optional comment applies uniformly to every dock a given request successfully archives; there
  is no per-dock comment within one multiple-archive request, matching the shared-comment model
  already used for comparable bulk lifecycle actions on other site references.
- A malformed or duplicate identifier in a selection causes the whole request to be rejected before
  any evaluation, rather than being silently dropped or de-duplicated, so the administrator always
  knows exactly what happened to what they selected.
- Concurrency is resolved per dock with no optimistic-locking prompt: the first request to reach a
  given dock archives it, and every other concurrent request sees it as already archived.
- This slice reuses the existing dock consultation area (the checkpoints map introduced by #197) as
  the surface from which one dock or a selection of docks is archived, extending it with a selection
  mechanism and a bulk action rather than introducing a separate standalone page.
- Reactivating an archived dock, listing, creating, and updating docks are separate, independently
  deliverable sibling issues (#197, #198, #199, #201) and stay outside this slice. Permanent deletion
  of a dock is not supported anywhere in the product.
- Archiving a dock does not rewrite history: discharges and other records that already reference the
  dock keep that reference and remain fully readable after the dock is archived.
- Dock records already exist through creation (#198) and the seeded site-reference fixtures, so this
  slice is verifiable against existing data, including data already marked in use by planned or
  active discharges.
- The established application language, validation-messaging, and accessibility conventions apply to
  the archive confirmation, comment field, and blocked-outcome reporting.
