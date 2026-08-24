# Feature Specification: Update a Dock

**Feature Branch**: `feat/199-update-dock`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Let an authorized administrator update a dock's mutable information. https://github.com/whazzark/portflow-ai/issues/199"

**Feature ID**: `GH-199`

**GitHub Issue**: [#199](https://github.com/whazzark/portflow-ai/issues/199)

**Parent Roadmap**: `specs/site-references/operational-checkpoints/docks/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct an Available Dock's Name and Position (Priority: P1)

As an authorized administrator, I want to correct the name and the map position of an available
dock so that the berth operators see on the map matches the physical reality of the site.

**Why this priority**: This is the core outcome of the slice. Docks were placed once at creation
and quays get renumbered, re-surveyed, or mis-clicked; without correction the dock reference drifts
away from the site it is supposed to describe, and every operator selecting a dock is misled.

**Independent Test**: Sign in as an authorized administrator, open an available dock from the
checkpoint consultation area, change its name and drag its marker to a new point, save, and verify
the dock is shown under its new name at its new coordinates while keeping the same identity and
Available status.

**Acceptance Scenarios**:

1. **Given** an available dock exists, **When** an authorized administrator opens the update
   experience for it, **Then** the form is pre-filled with the dock's current name, latitude, and
   longitude.
2. **Given** the update experience is open for an available dock, **When** the administrator submits
   a different valid name, **Then** the dock is saved under the new name, the administrator receives
   explicit confirmation, and the dock's identity and Available status are unchanged.
3. **Given** the update experience is open for an available dock, **When** the administrator drags
   the dock's marker to a different point on the map and saves, **Then** the dock is stored at the
   final dragged coordinates and its marker is shown there without requiring a manual refresh.
4. **Given** the update experience is open, **When** the administrator edits the latitude or
   longitude values directly instead of using the map, **Then** the marker and the coordinate values
   stay in sync and the saved dock uses the values shown at submission time.
5. **Given** the administrator changes the name and the position in the same submission, **When**
   the update is saved, **Then** both changes take effect together, or neither does.
6. **Given** a dock was just updated, **When** any authorized user consults the checkpoint
   collection or the dock's details, **Then** the dock appears with its new name and position, its
   creation time is unchanged, and its last-updated time reflects the change.
7. **Given** the administrator submits the dock's current name and current coordinates unchanged,
   **When** the update is processed, **Then** it succeeds without reporting a duplicate and the dock
   is left in its current state.

---

### User Story 2 - Be Prevented From Saving Invalid or Duplicate Values (Priority: P2)

As an authorized administrator, I want blank, over-long, duplicate, and out-of-range values to be
refused with a clear, field-specific explanation so that no partial or corrupting change reaches the
dock reference and I can correct my mistake without starting over.

**Why this priority**: Dock name uniqueness and coordinate validity are what make a dock usable as
an operational reference. A silently accepted duplicate name or an impossible coordinate corrupts
every downstream discharge assignment that selects a dock, but this only matters once the successful
update path exists.

**Independent Test**: On an available dock, attempt in turn a blank name, an over-long name, a name
already used by another dock, and a latitude outside the legal range; verify each attempt is refused
with a distinct field-level message, the stored dock is untouched, and the entered values remain on
screen for correction.

**Acceptance Scenarios**:

1. **Given** an available dock, **When** the administrator submits an empty name or a name made only
   of whitespace, **Then** the update is refused with a message on the name field and the stored
   name is unchanged.
2. **Given** an available dock, **When** the administrator submits a name longer than the maximum
   allowed length, **Then** the update is refused with a message on the name field and the stored
   name is unchanged.
3. **Given** another dock already uses a given name, **When** the administrator submits that name,
   **Then** the update is refused as a duplicate with the message shown on the name field, and
   neither dock is modified.
4. **Given** another dock uses a name differing only by letter case or surrounding whitespace,
   **When** the administrator submits that name, **Then** the update is refused as a duplicate.
5. **Given** an archived dock uses a given name, **When** the administrator submits that name for an
   available dock, **Then** the update is still refused as a duplicate, because names stay unique
   regardless of lifecycle status.
6. **Given** a submitted name has leading or trailing whitespace but is otherwise valid and unused,
   **When** the update is processed, **Then** the surrounding whitespace is removed and the trimmed
   name is stored.
7. **Given** an available dock, **When** the administrator submits a latitude outside -90 to 90, a
   longitude outside -180 to 180, or a coordinate that is not a number, **Then** the update is
   refused with a message on the affected field and the stored position is unchanged.
8. **Given** an update was refused, **When** the administrator corrects the offending value and
   resubmits, **Then** the update succeeds without the administrator having to close and reopen the
   dock, and the values they had already entered were never lost.

---

### User Story 3 - Be Blocked From Updating What Must Not Change (Priority: P3)

As the operating organization, I want updates refused for users without dock administration rights,
for archived docks, and for docks that no longer exist, so that authorization and lifecycle rules
stay trustworthy no matter how the update is attempted.

**Why this priority**: These guard rails protect the integrity of the dock reference and must hold
even when bypassing the interface, but they are exercised less often than a normal correction.

**Independent Test**: Attempt an update as an unauthenticated visitor, as an authenticated but
inactive user, as an active user without dock administration rights, on an archived dock, and on a
dock identifier that does not exist; verify each attempt is refused with the appropriate outcome and
no dock data changes.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** an update is attempted, **Then** it is refused
   using the application's established access-handling behavior and no dock data is exposed or
   modified.
2. **Given** an authenticated user whose access is not active, or an active user without dock
   administration rights, **When** an update is attempted, **Then** it is refused as unauthorized and
   the dock is unchanged.
3. **Given** an active user without dock administration rights consults a dock's details, **When**
   the details are displayed, **Then** no update action is offered.
4. **Given** an archived dock, **When** an administrator attempts to update it, **Then** the update
   is refused because archived docks are read-only, and the message states that reactivation is
   required first.
5. **Given** an archived dock is consulted by an authorized administrator, **When** its details are
   displayed, **Then** the update action is either not offered or clearly unavailable, consistent
   with the read-only rule the system enforces.
6. **Given** a dock identifier that does not exist, **When** an administrator attempts to update it,
   **Then** the update is refused as not found without disclosing information about other docks.
7. **Given** any refused update, **When** the stored docks are inspected afterwards, **Then** no
   dock's name, position, status, or lifecycle context has changed.

### Edge Cases

- A dock archived by another administrator after the update form was opened is refused on submission
  as read-only rather than being silently updated.
- A dock renamed or repositioned by another administrator after the update form was opened is
  overwritten by the submitted values, and the administrator sees the resulting saved state rather
  than a stale view.
- A dock deleted or otherwise no longer resolvable between opening the form and submitting is refused
  as not found, and the administrator is returned to a consistent view of the remaining docks.
- Two administrators submitting the same new name for two different docks concurrently result in
  exactly one success and one duplicate refusal; no two docks end up sharing a name.
- A submitted name whose only difference from the dock's stored name is letter case or surrounding
  whitespace is treated as the dock's own name, not as a duplicate of itself.
- A name containing accented, punctuated, or non-Latin characters is accepted as long as it is
  non-blank after trimming and within the maximum length.
- A name at exactly the maximum allowed length is accepted; one character beyond it is refused.
- Coordinates at the exact boundary values (latitude -90 or 90, longitude -180 or 180) are accepted.
- A submission that changes only the position, leaving the name untouched, is accepted and does not
  trigger a duplicate-name refusal against the dock's own current name.
- A submission that contains no change at all is accepted and leaves the dock in its current state.
- The administrator abandons the update in progress (cancels, or navigates away): the dock is left
  exactly as it was and the marker returns to its stored position.
- The connection is lost or the save fails after submission: the dock is left exactly as it was, the
  administrator sees a clear retryable failure message, their entered values are preserved, and a
  retry does not produce a second, conflicting change.
- The administrator's dock administration right is revoked between opening the form and submitting:
  the submission is refused as if they had never been authorized.
- The dock being updated is referenced by a planned or in-progress discharge: the update is applied
  and the discharge keeps referencing the same dock, now under its corrected name and position.
- The administrator repositions the dock marker very close to another dock's marker: both markers
  remain individually distinguishable and selectable, and the update targets only the dock being
  edited.
- The administrator cannot use a pointing device: they can still reposition the dock by entering
  coordinate values directly, kept in sync with the marker.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated, active user holding dock administration rights
  to update an existing available dock.
- **FR-002**: The system MUST deny the update to unauthenticated users, to users whose access is not
  active, and to authenticated active users without dock administration rights, without changing any
  dock and without disclosing dock data beyond the application's established access-handling
  behavior.
- **FR-003**: The updatable information of a dock MUST be limited to its name, its latitude, and its
  longitude.
- **FR-004**: The administrator MUST be able to update the name alone, the position alone, or both
  together in a single submission, and a submission MUST be applied in full or not at all.
- **FR-005**: The system MUST let the administrator reposition the dock both by dragging its marker
  on the map and by editing its coordinate values directly, with both means of adjustment kept in
  sync with each other.
- **FR-006**: The update experience MUST be pre-filled with the dock's current name, latitude, and
  longitude, and MUST be reachable from the dock consultation area only by users authorized to
  perform the update.
- **FR-007**: The system MUST reject an update whose name is empty or consists only of whitespace.
- **FR-008**: The system MUST reject an update whose name exceeds the maximum site-reference name
  length of 255 characters.
- **FR-009**: The system MUST remove leading and trailing whitespace from the submitted name before
  validating, comparing, and storing it.
- **FR-010**: The system MUST reject an update whose resulting name is already used by another dock,
  comparing names without regard to letter case or surrounding whitespace and regardless of the other
  dock's lifecycle status.
- **FR-011**: The system MUST accept an update that resubmits the dock's own current name and MUST
  NOT report it as a duplicate.
- **FR-012**: The system MUST reject an update whose latitude falls outside -90 to 90, whose
  longitude falls outside -180 to 180, or whose submitted coordinate is not a number.
- **FR-013**: The system MUST refuse the update of an archived dock and MUST report that the dock is
  read-only until it is reactivated.
- **FR-014**: The system MUST refuse the update of a dock that does not exist, without disclosing
  information about other docks.
- **FR-015**: A successful update MUST preserve the dock's stable identity, its lifecycle status, its
  creation time, and its existing archive and reactivation context, and MUST record that the dock was
  last updated at that moment.
- **FR-016**: A refused update MUST leave the stored dock entirely unchanged, including when the
  failure is a connectivity or save failure rather than a validation refusal.
- **FR-017**: The system MUST make the updated name and position authoritative in every subsequent
  consultation, map rendering, detail view, and dock selection, without requiring a manual page
  reload.
- **FR-018**: The system MUST preserve every existing reference between the dock and the discharges
  assigned to it across an update; those discharges MUST continue to point at the same dock.
- **FR-019**: The system MUST NOT retroactively alter dock names or positions already captured in
  immutable report snapshots or other closed historical records.
- **FR-020**: The system MUST report the outcome of an update attempt, distinguishing success,
  validation failure, duplicate name, archived dock, dock not found, unauthorized access, and
  retryable save failure, with validation and duplicate outcomes shown against the field concerned.
- **FR-021**: The administrator MUST be able to correct a refused submission and resubmit it without
  reopening the dock, with their previously entered values preserved.
- **FR-022**: The administrator MUST be able to abandon an update in progress, leaving the dock
  unchanged and its marker at its stored position.
- **FR-023**: Authorization, validation, and uniqueness decisions MUST be enforced authoritatively by
  the system regardless of what the user experience offers or hides.
- **FR-024**: This slice MUST NOT create, archive, reactivate, or permanently delete docks, MUST NOT
  change a dock's lifecycle status, and MUST NOT update any other site reference type.

### Key Entities *(include if feature involves data)*

- **Dock**: A named operational berth at which a vessel is discharged, positioned by a latitude and
  a longitude on the site map. It carries a stable identity, a current name, a current position, a
  lifecycle status, a creation time, and a last-updated time. Only the name, latitude, and longitude
  are mutable through this feature.
- **Dock Name**: The unique, human-readable identifier of a dock. Uniqueness is enforced
  case-insensitively, after trimming, and across all docks regardless of lifecycle status.
- **Dock Position**: The dock's latitude and longitude. Both must be present and within their legal
  ranges, and they are always evaluated together as the dock's single map location.
- **Dock Lifecycle Context**: The archive and most recent reactivation information attached to a
  dock. It determines whether the dock may be updated at all and is never modified by an update.
- **Authorized Administrator**: An authenticated, active member of the operating organization whose
  assigned rights include dock administration; the only actor permitted to perform the update.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of update attempts by authorized administrators on
  available docks with valid, unique values succeed, and the corrected name and position are visible
  in consultation within 2 seconds under normal operating conditions without a manual reload.
- **SC-002**: In acceptance testing, 100% of update attempts by unauthenticated visitors, non-active
  users, and active users without dock administration rights are refused with no dock changed, and
  the update action is not offered to them.
- **SC-003**: In acceptance testing, 100% of attempts to update an archived dock or a dock that does
  not exist are refused with the corresponding outcome and leave stored data unchanged.
- **SC-004**: Across all acceptance datasets, 0% of docks end up sharing a name under
  case-insensitive, trimmed, cross-status comparison, including under concurrent submissions of the
  same new name, where exactly one submission succeeds.
- **SC-005**: In acceptance testing, 100% of updates with a blank name, an over-long name, a
  duplicate name, or an out-of-range or non-numeric coordinate are refused with a message on the
  field concerned, the stored dock unchanged, and the administrator's entered values preserved.
- **SC-006**: Every tested refusal condition — blank name, over-long name, duplicate name,
  out-of-range coordinate, archived dock, dock not found, unauthorized access, and retryable save
  failure — produces a distinct, understandable message, and 100% of retryable failures can be
  recovered by resubmitting without reopening the dock.
- **SC-007**: In 100% of acceptance datasets, updated docks keep their identity, lifecycle status,
  lifecycle context, and creation time, and 100% of discharges previously assigned to an updated dock
  remain assigned to it.
- **SC-008**: In 100% of acceptance tests, a dock repositioned by dragging its marker is stored at
  the final dragged coordinates rather than any intermediate position, and coordinates entered
  directly produce the same stored result as the equivalent drag.
- **SC-009**: At least 90% of representative administrators can locate a dock and complete a name or
  position correction on their first attempt within 60 seconds, without external help.

## Assumptions

- "Authorized administrator" means an authenticated user with active access holding an
  organization-level or operations-level administration role, the same dock administration right that
  already governs dock consultation (#197) and dock creation (#198).
- The only mutable business information of a dock is its name and its map position. Status is not
  directly editable: archival (#200) and reactivation (#201) are the separate slices that change it,
  and they own their own actor, time, and comment.
- Dock names are unique across all docks, available and archived alike, compared after trimming and
  without regard to letter case, matching the rule already enforced by dock creation (#198).
- The maximum name length and whitespace-trimming behavior follow the established site-reference name
  rules shared by the other site references.
- Archived docks are read-only; correcting an archived dock requires reactivating it first (#201).
- The update experience is offered from the same map-based dock consultation area introduced by #197
  (the checkpoints map) and reuses its marker interaction, rather than living on a separate
  standalone page. Direct coordinate entry stays available as a synchronized alternative so the
  feature remains usable without a pointing device.
- Concurrent edits resolve as last-write-wins on the dock as a whole: there is no field-level merge
  and no optimistic-locking prompt in this slice. The administrator is shown the saved result, so a
  silently stale view is not an acceptable outcome.
- Updating a dock is not a lifecycle transition and therefore captures no actor, no comment, and no
  archive or reactivation context; only the last-updated time changes alongside the corrected values.
- A dock referenced by planned or in-progress discharges may still be updated. Discharges reference
  the dock by its stable identity, so a correction is reflected wherever the dock is displayed without
  any discharge record changing, and no usage check blocks the update.
- Renaming or repositioning a dock does not rewrite history: immutable report snapshots and closed
  records keep the name and position captured when they were produced.
- Dock records already exist through creation (#198) and the seeded site-reference fixtures, so this
  slice is verifiable against existing data.
- The established application language, validation-messaging, focus-management, and accessibility
  conventions apply to the update flow's labels, errors, and confirmations.
- Dock consultation (#197), creation (#198), archival (#200), and reactivation (#201) are
  independently deliverable sibling issues and stay outside this slice, as does the update of any
  other map-based site reference (weighing areas, warehouses, warehouse doors), each of which is its
  own future issue.
