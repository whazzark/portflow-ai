# Feature Specification: Reactivate Docks

**Feature Branch**: `feat/201-reactivate-docks`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "l'issue 201" — https://github.com/whazzark/portflow-ai/issues/201

**Feature ID**: `GH-201`

**GitHub Issue**: [#201](https://github.com/whazzark/portflow-ai/issues/201)

**Parent Roadmap**: `specs/site-references/operational-checkpoints/docks/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reactivate One Archived Dock (Priority: P1)

As an authorized administrator, I want to reactivate a single archived dock that is back in service
so that it is offered again for new discharge assignments without losing its identity or the record
of the period it spent archived.

**Why this priority**: This is the core outcome the slice exists for. Archiving is already
reversible in intent but not yet in practice for docks from the administration surface: a berth that
reopens after works, or a dock archived by mistake, currently has no way back into the operational
selection without recreating it under a new identity and breaking its history.

**Independent Test**: Sign in as an authorized administrator, open an archived dock, reactivate it
optionally with a comment, and verify it becomes Available again, reappears among the docks offered
for new discharge assignment, and keeps its identity, name, position, creation time, and its record
of having been archived.

**Acceptance Scenarios**:

1. **Given** an archived dock, **When** an authorized administrator reactivates it, **Then** the
   dock's status becomes Available, the reactivating administrator and timestamp are recorded, and
   the dock is confirmed reactivated.
2. **Given** the administrator supplies a comment while reactivating, **When** the reactivation
   succeeds, **Then** the comment is stored against that reactivation transition and is visible in
   the dock's details.
3. **Given** the administrator reactivates the dock without a comment, **When** the reactivation
   succeeds, **Then** the dock is reactivated with no reactivation comment recorded.
4. **Given** a dock was just reactivated, **When** any authorized user consults the checkpoint
   collection or the dock's details, **Then** the dock is shown as Available, its identity, name,
   position, and creation time are unchanged, and it is offered again for new discharge assignment.
5. **Given** a dock that was archived with an archive comment, **When** it is reactivated, **Then**
   the record of who archived it, when, and with what comment remains consultable alongside the new
   reactivation record.

---

### User Story 2 - Reactivate a Selection of Archived Docks Together (Priority: P1)

As an authorized administrator, I want to select several archived docks at once and reactivate the
eligible ones in a single action, so that bringing a quay back into service after works does not
require repeating the same action one dock at a time.

**Why this priority**: Docks are archived in batches when a quay closes, so they come back in
batches when it reopens. A reactivation capability that only works one dock at a time leaves the
same slow, error-prone gap the multiple-archive capability was built to close, and the issue
explicitly places multiple reactivation inside this slice.

**Independent Test**: Select a mix of archived docks, already-available docks, and one identifier
that no longer exists, submit one reactivation action with an optional shared comment, and verify
every archived dock is reactivated, every blocked dock is left untouched, and the outcome names each
blocked dock with a specific reason.

**Acceptance Scenarios**:

1. **Given** a selection made only of archived docks, **When** an authorized administrator
   reactivates the selection, **Then** every dock in the selection becomes Available, all recording
   the same reactivating administrator and timestamp.
2. **Given** the administrator supplies one comment for the whole selection, **When** the
   reactivation succeeds, **Then** that same comment is stored against every dock reactivated in
   that action.
3. **Given** a selection mixes archived docks with docks that are already available and identifiers
   that do not correspond to any dock, **When** the administrator submits the reactivation action,
   **Then** every archived dock is reactivated and every blocked dock is reported individually with
   the reason it was not reactivated: not found, or already available.
4. **Given** a multiple-reactivation action produced blocked docks, **When** the administrator
   reviews the outcome, **Then** the successfully reactivated docks and the blocked docks with their
   reasons are both clearly presented, and the administrator can identify exactly which docks
   changed.
5. **Given** a selection contains ten archived docks, **When** the administrator reactivates the
   selection, **Then** all ten become Available in one action rather than requiring ten separate
   submissions.
6. **Given** a multiple-reactivation action produced blocked docks, **When** the administrator drops
   the blocked docks from the selection and resubmits, **Then** the resubmission succeeds for the
   remaining archived docks without re-attempting the ones already reactivated.

---

### User Story 3 - Reject Invalid Selections and Protect What Must Not Change (Priority: P2)

As the operating organization, I want a reactivation request refused outright when it is empty,
malformed, or contains duplicate entries, and refused per-actor when the requester is not
authorized, so that no dock is ever put back into service by mistake, by an unauthorized actor, or
as a side-effect of a broken request.

**Why this priority**: Returning a dock to the pool offered for new discharge assignments is an
operational decision with physical consequences on the site. These guard rails must hold whether the
request comes from the interface or is sent directly, but they matter only once the successful
individual and multiple reactivation paths exist.

**Independent Test**: Attempt a reactivation request with an empty selection, with a duplicated
identifier, with a malformed identifier, and as an unauthenticated visitor, as an inactive user, and
as an active user without dock administration rights; verify every attempt is refused before any
dock changes and no partial effect is left behind.

**Acceptance Scenarios**:

1. **Given** a reactivation request with an empty selection, **When** it is submitted, **Then** it
   is rejected before any dock is evaluated or changed.
2. **Given** a reactivation request whose selection contains a duplicate identifier or an identifier
   that is not a valid dock reference, **When** it is submitted, **Then** the entire request is
   rejected before any dock is evaluated or changed, rather than silently de-duplicating or skipping
   the malformed entry.
3. **Given** an unauthenticated visitor, an authenticated user whose access is not active, or an
   active user without dock administration rights, **When** a reactivation of one dock or of a
   selection is attempted, **Then** it is refused as unauthorized and no dock is changed.
4. **Given** a dock that is already available, **When** an administrator attempts to reactivate it
   individually, **Then** the attempt is refused as already available and the dock's existing
   lifecycle metadata is unchanged.
5. **Given** a dock identifier that does not correspond to any existing dock, **When** an
   administrator attempts to reactivate it individually, **Then** the attempt is refused as not
   found, without disclosing information about other docks.
6. **Given** any refused reactivation attempt, individual or multiple, **When** the stored docks are
   inspected afterwards, **Then** no dock's status or lifecycle metadata has changed as a result of
   that attempt.

### Edge Cases

- A dock is reactivated by another administrator between the moment a selection is built and the
  moment the reactivation action is submitted: that dock is reported blocked as already available at
  submission time rather than being silently reactivated a second time or silently dropped.
- A selection that becomes entirely blocked by the time it is submitted (every dock now available or
  no longer existing) reactivates nothing and reports every entry as blocked; it is not treated as an
  empty selection.
- Two administrators submit overlapping selections that both include the same archived dock at
  nearly the same time: exactly one reactivation of that dock succeeds, and the other request
  reports it as already available rather than reactivating it twice or silently overwriting the
  first reactivation's comment.
- A dock is archived by one administrator while another is reactivating a selection containing it:
  the outcome reflects the dock's state at submission time, and the dock never ends in a state that
  matches neither request.
- A very large selection is submitted: the action still applies in full or reports every blocked
  entry individually, rather than truncating the outcome silently.
- A comment consisting only of whitespace is treated the same as no comment.
- A connection is lost or the reactivation action fails after submission: no dock ends up partially
  reactivated, the administrator sees a clear retryable failure message, and a retry does not
  produce a duplicate reactivation or a duplicate blocked report for docks already reactivated by
  the failed attempt.
- The administrator's dock administration right is revoked between building the selection and
  submitting it: the submission is refused as if they had never been authorized, and no dock in the
  selection is changed.
- A dock is archived and reactivated several times over its life: each transition is recorded in
  turn, and the latest transition determines the current status without erasing the previous ones.
- A dock reactivated through this feature is still referenced by the discharges that used it before
  it was archived: those historical references keep pointing at the same dock and are unaffected by
  the reactivation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated, active user holding dock administration rights
  to reactivate one existing archived dock.
- **FR-002**: The system MUST allow the same authorized administrator to submit a selection of
  several dock identifiers and reactivate every eligible dock in that selection through one action.
- **FR-003**: The system MUST deny a reactivation attempt, individual or multiple, to
  unauthenticated users, to users whose access is not active, and to authenticated active users
  without dock administration rights, without changing any dock and without disclosing dock data
  beyond the application's established access-handling behavior.
- **FR-004**: A multiple-reactivation request whose selection is empty MUST be rejected before any
  dock is evaluated or changed.
- **FR-005**: A multiple-reactivation request whose selection contains a malformed identifier or a
  duplicate identifier MUST be rejected in full before any dock is evaluated or changed.
- **FR-006**: A dock is eligible to be reactivated only when it is currently Archived; no usage,
  scheduling, or occupancy condition blocks a reactivation.
- **FR-007**: The system MUST refuse to reactivate a dock that is already Available, reporting the
  reason `ALREADY_AVAILABLE`, and MUST leave that dock's lifecycle metadata unchanged.
- **FR-008**: The system MUST refuse to reactivate a dock identifier that does not correspond to any
  existing dock, reporting the reason `NOT_FOUND`, without disclosing information about other docks.
- **FR-009**: In a multiple-reactivation request, once the selection itself is valid, the system
  MUST apply partial success: every eligible dock in the selection MUST be reactivated, and every
  blocked dock MUST be left completely unchanged and reported individually with exactly one of the
  reasons `NOT_FOUND` or `ALREADY_AVAILABLE`.
- **FR-010**: The administrator MAY supply one optional comment with a reactivation request,
  individual or multiple, and that same comment MUST be recorded against every dock the request
  successfully reactivates, and against no dock it does not reactivate.
- **FR-011**: A successful reactivation, individual or multiple, MUST record which administrator
  performed it and at what time, on every dock it reactivates.
- **FR-012**: A successful reactivation MUST preserve the dock's stable identity, its name, its
  position, and its creation time, and MUST change only its status and its reactivation lifecycle
  metadata.
- **FR-013**: A successful reactivation MUST preserve the archive lifecycle metadata already
  recorded on the dock — who archived it, when, and with what comment — so that the dock's full
  lifecycle history remains consultable after it returns to service.
- **FR-014**: The system MUST make a reactivated dock's status authoritative in every subsequent
  consultation, map rendering, detail view, and dock-selection surface, including it again among the
  docks offered for new discharge assignment without requiring a manual page reload.
- **FR-015**: The system MUST preserve every existing reference between a reactivated dock and the
  discharges already assigned to it; those discharges MUST continue to point at the same dock.
- **FR-016**: Concurrent reactivation attempts against the same dock, whether individual or as part
  of overlapping selections, MUST result in exactly one successful reactivation of that dock; every
  other concurrent attempt against it MUST resolve as a blocked outcome rather than a second
  reactivation or a silent overwrite.
- **FR-017**: The system MUST report the outcome of every reactivation attempt, distinguishing
  success, the two blocker reasons (`NOT_FOUND`, `ALREADY_AVAILABLE`), unauthorized access, and a
  retryable failure; for a multiple-reactivation request the outcome MUST separately list which
  docks were reactivated and which were blocked, each with its reason.
- **FR-018**: The administrator MUST be able to resubmit a corrected or reduced selection after a
  multiple-reactivation request produced blocked docks, without the already-reactivated docks in
  that prior request being re-attempted or re-reported.
- **FR-019**: Authorization, eligibility, and selection-validity decisions MUST be enforced
  authoritatively by the system regardless of what the user experience offers or hides.
- **FR-020**: The system MUST let an administrator find and select archived docks in order to
  reactivate them, individually or as a selection, from the dock consultation surface.
- **FR-021**: A dock MUST be able to move between Archived and Available repeatedly over its life,
  each transition recorded in turn, with the most recent transition determining the current status.
- **FR-022**: This slice MUST NOT permanently delete a dock, MUST NOT archive a dock, and MUST NOT
  change any dock's name or position as part of reactivating.

### Key Entities *(include if feature involves data)*

- **Dock**: A named operational berth positioned on the site map, carrying a stable identity, a
  current lifecycle status (Available or Archived), and lifecycle metadata for both directions of
  the transition. Only its status and reactivation metadata are affected by this feature.
- **Dock Reactivation Transition**: The record of one dock moving from Archived back to Available:
  the reactivating administrator, the time of the transition, and the optional comment supplied with
  it.
- **Multiple-Reactivation Selection**: A non-empty, duplicate-free set of dock identifiers submitted
  together with one optional shared comment, evaluated and applied as one action with per-dock
  partial-success outcomes.
- **Reactivation Blocker**: The reported reason a specific dock in a request was not reactivated:
  the dock does not exist (`NOT_FOUND`), or it is already Available (`ALREADY_AVAILABLE`).
- **Authorized Administrator**: An authenticated, active member of the operating organization whose
  assigned rights include dock administration; the only actor permitted to reactivate a dock or a
  selection of docks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of individual reactivation attempts by authorized
  administrators on archived docks succeed, and the available status is visible in consultation
  within 2 seconds under normal operating conditions without a manual reload.
- **SC-002**: In acceptance testing, 100% of multiple-reactivation attempts on a selection made
  entirely of archived docks reactivate every dock in the selection in one action.
- **SC-003**: In acceptance testing, 100% of multiple-reactivation attempts on a mixed selection
  reactivate every archived dock and report every blocked dock individually with the correct one of
  `NOT_FOUND` or `ALREADY_AVAILABLE`.
- **SC-004**: In acceptance testing, 100% of multiple-reactivation requests with an empty,
  duplicated, or malformed selection are rejected with zero docks changed.
- **SC-005**: In acceptance testing, 100% of reactivation attempts by unauthenticated visitors,
  non-active users, and active users without dock administration rights are refused with no dock
  changed, and the reactivation action is not offered to them.
- **SC-006**: Across concurrent-submission acceptance scenarios where the same dock appears in more
  than one simultaneous reactivation request, exactly one request succeeds for that dock in 100% of
  runs, and every other request reports it as blocked rather than reactivating it a second time.
- **SC-007**: In 100% of acceptance datasets, a reactivated dock keeps its identity, name, position,
  and creation time, keeps the record of the archiving that preceded it, and is offered again for
  new discharge assignment.
- **SC-008**: In 100% of acceptance datasets, discharges that referenced a dock before it was
  archived still reference the same dock after it is reactivated.
- **SC-009**: At least 90% of representative administrators can locate a batch of five to ten
  archived docks and complete their reactivation in one action, on their first attempt, within 60
  seconds, without external help.
- **SC-010**: In acceptance testing involving a selection of 100 dock identifiers, the multiple
  reactivation action completes within 5 seconds in the acceptance environment.

## Assumptions

- "Authorized administrator" means an authenticated user with active access holding the same
  organization-level or operations-level dock administration right that already governs dock
  consultation (#197), creation (#198), update (#199), and archiving (#200).
- Reactivation is the exact mirror of archiving (#200) and reuses its shape: same authorization,
  same optional shared comment model, same partial-success contract, same rejection of empty,
  duplicate, or malformed selections. Only the eligibility direction and the blocker set differ.
- Reactivation has no usage-based blocker. An archived dock is not referenced by any planned or
  active discharge by construction, so `IN_USE` cannot arise on this path and the blocker set is
  exactly `NOT_FOUND` and `ALREADY_AVAILABLE`, as stated in the issue.
- Individual reactivation of one dock and multiple reactivation of a selection are the same
  capability at two scopes, not two features; they share eligibility rules, blocker reasons, comment
  handling, and authorization.
- The optional comment applies uniformly to every dock a given request successfully reactivates;
  there is no per-dock comment within one multiple-reactivation request, matching the shared-comment
  model already used for the comparable bulk lifecycle actions on other site references.
- A malformed or duplicate identifier in a selection causes the whole request to be rejected before
  any evaluation, rather than being silently dropped or de-duplicated, so the administrator always
  knows exactly what happened to what they selected.
- Concurrency is resolved per dock with no optimistic-locking prompt: the first request to reach a
  given dock reactivates it, and every other concurrent request sees it as already available.
- This slice reuses the existing dock consultation area (the checkpoints map introduced by #197,
  extended with selection and bulk lifecycle actions by #200) as the surface from which one dock or
  a selection of docks is reactivated, including the means to see archived docks in order to select
  them, rather than introducing a separate standalone page.
- The API already exposes individual dock reactivation from earlier delivery; this slice owns the
  behavior end to end regardless, and completes it with the multiple-reactivation contract and the
  administration surface, aligning any existing behavior with this specification.
- Listing, creating, updating, and archiving docks are separate, independently deliverable sibling
  issues (#197, #198, #199, #200) and stay outside this slice. Permanent deletion of a dock is not
  supported anywhere in the product.
- Dock records already exist through creation (#198), archiving (#200), and the seeded
  site-reference fixtures, so this slice is verifiable against existing data, including docks
  already in the archived state.
- The established application language, validation-messaging, and accessibility conventions apply to
  the reactivation confirmation, comment field, and blocked-outcome reporting.
