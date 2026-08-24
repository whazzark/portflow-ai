# Feature Specification: Update a Weighing Area

**Feature Branch**: `feat/204-update-weighing-area`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Update a Weighing Area — Let an authorized administrator update a weighing area's mutable information. https://github.com/whazzark/portflow-ai/issues/204"

**Feature ID**: `GH-204`

**GitHub Issue**: [#204](https://github.com/whazzark/portflow-ai/issues/204)

**Parent Roadmap**: `specs/site-references/operational-checkpoints/weighing-areas/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct an Available Weighing Area's Name and Position (Priority: P1)

As an authorized administrator, I want to correct the name and the map position of an available
weighing area so that the weighbridge operators see on the map matches the physical reality of the
site.

**Why this priority**: This is the core outcome of the slice. Weighing areas were placed once at
creation and weighbridges get renamed, re-surveyed, replaced, or mis-clicked; without correction the
weighing-area reference drifts away from the equipment it is supposed to describe, and every
operator recording a weighing selects a checkpoint that no longer matches the ground.

**Independent Test**: Sign in as an authorized administrator, open an available weighing area from
the checkpoint consultation area, change its name and drag its marker to a new point, save, and
verify the weighing area is shown under its new name at its new coordinates while keeping the same
identity and Available status.

**Acceptance Scenarios**:

1. **Given** an available weighing area exists, **When** an authorized administrator opens the
   update experience for it, **Then** the form is pre-filled with the weighing area's current name,
   latitude, and longitude.
2. **Given** the update experience is open for an available weighing area, **When** the
   administrator submits a different valid name, **Then** the weighing area is saved under the new
   name, the administrator receives explicit confirmation, and the weighing area's identity and
   Available status are unchanged.
3. **Given** the update experience is open for an available weighing area, **When** the
   administrator drags the weighing area's marker to a different point on the map and saves,
   **Then** the weighing area is stored at the final dragged coordinates and its marker is shown
   there without requiring a manual refresh.
4. **Given** the update experience is open, **When** the administrator edits the latitude or
   longitude values directly instead of using the map, **Then** the marker and the coordinate values
   stay in sync and the saved weighing area uses the values shown at submission time.
5. **Given** the administrator changes the name and the position in the same submission, **When**
   the update is saved, **Then** both changes take effect together, or neither does.
6. **Given** a weighing area was just updated, **When** any authorized user consults the checkpoint
   collection or the weighing area's details, **Then** the weighing area appears with its new name
   and position, its creation time is unchanged, and its last-updated time reflects the change.
7. **Given** the administrator submits the weighing area's current name and current coordinates
   unchanged, **When** the update is processed, **Then** it succeeds without reporting a duplicate
   and the weighing area is left in its current state.
8. **Given** the map currently hides weighing areas through the checkpoint-type filter, **When** the
   administrator successfully updates a weighing area, **Then** the updated area remains visible and
   selected rather than disappearing behind that filter.

---

### User Story 2 - Be Prevented From Saving Invalid or Duplicate Values (Priority: P2)

As an authorized administrator, I want blank, over-long, duplicate, and out-of-range values to be
refused with a clear, field-specific explanation so that no partial or corrupting change reaches the
weighing-area reference and I can correct my mistake without starting over.

**Why this priority**: Weighing-area name uniqueness and coordinate validity are what make a
weighing area usable as an operational reference. A silently accepted duplicate name or an
impossible coordinate corrupts every shift assignment and every weighing recorded against a
weighing area, but this only matters once the successful update path exists.

**Independent Test**: On an available weighing area, attempt in turn a blank name, an over-long
name, a name already used by another weighing area, and a latitude outside the legal range; verify
each attempt is refused with a distinct field-level message, the stored weighing area is untouched,
and the entered values remain on screen for correction.

**Acceptance Scenarios**:

1. **Given** an available weighing area, **When** the administrator submits an empty name or a name
   made only of whitespace, **Then** the update is refused with a message on the name field and the
   stored name is unchanged.
2. **Given** an available weighing area, **When** the administrator submits a name longer than the
   maximum allowed length, **Then** the update is refused with a message on the name field and the
   stored name is unchanged.
3. **Given** another weighing area already uses a given name, **When** the administrator submits that
   name, **Then** the update is refused as a duplicate with the message shown on the name field, and
   neither weighing area is modified.
4. **Given** another weighing area uses a name differing only by letter case or surrounding
   whitespace, **When** the administrator submits that name, **Then** the update is refused as a
   duplicate.
5. **Given** an archived weighing area uses a given name, **When** the administrator submits that
   name for an available weighing area, **Then** the update is still refused as a duplicate, because
   names stay unique regardless of lifecycle status.
6. **Given** a submitted name has leading or trailing whitespace but is otherwise valid and unused,
   **When** the update is processed, **Then** the surrounding whitespace is removed and the trimmed
   name is stored.
7. **Given** an available weighing area, **When** the administrator submits a latitude outside -90 to
   90, a longitude outside -180 to 180, or a coordinate that is not a number, **Then** the update is
   refused with a message on the affected field and the stored position is unchanged.
8. **Given** an update was refused, **When** the administrator corrects the offending value and
   resubmits, **Then** the update succeeds without the administrator having to close and reopen the
   weighing area, and the values they had already entered were never lost.

---

### User Story 3 - Be Blocked From Updating What Must Not Change (Priority: P3)

As the operating organization, I want updates refused for users without weighing-area administration
rights, for archived weighing areas, and for weighing areas that no longer exist, so that
authorization and lifecycle rules stay trustworthy no matter how the update is attempted.

**Why this priority**: These guard rails protect the integrity of the weighing-area reference and
must hold even when bypassing the interface, but they are exercised less often than a normal
correction.

**Independent Test**: Attempt an update as an unauthenticated visitor, as an authenticated but
inactive user, as an active user without weighing-area administration rights, on an archived
weighing area, and on a weighing-area identifier that does not exist; verify each attempt is refused
with the appropriate outcome and no weighing-area data changes.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** an update is attempted, **Then** it is refused
   using the application's established access-handling behavior and no weighing-area data is exposed
   or modified.
2. **Given** an authenticated user whose access is not active, or an active user without
   weighing-area administration rights, **When** an update is attempted, **Then** it is refused as
   unauthorized and the weighing area is unchanged.
3. **Given** an active user without weighing-area administration rights consults a weighing area's
   details, **When** the details are displayed, **Then** no update action is offered.
4. **Given** an archived weighing area, **When** an administrator attempts to update it, **Then** the
   update is refused because archived weighing areas are read-only, and the message states that
   reactivation is required first.
5. **Given** an archived weighing area is consulted by an authorized administrator, **When** its
   details are displayed, **Then** the update action is either not offered or clearly unavailable,
   consistent with the read-only rule the system enforces.
6. **Given** a weighing-area identifier that does not exist, **When** an administrator attempts to
   update it, **Then** the update is refused as not found without disclosing information about other
   weighing areas.
7. **Given** any refused update, **When** the stored weighing areas are inspected afterwards,
   **Then** no weighing area's name, position, status, or lifecycle context has changed.

### Edge Cases

- A weighing area archived by another administrator after the update form was opened is refused on
  submission as read-only rather than being silently updated.
- A weighing area renamed or repositioned by another administrator after the update form was opened
  is overwritten by the submitted values, and the administrator sees the resulting saved state rather
  than a stale view.
- A weighing area no longer resolvable between opening the form and submitting is refused as not
  found, and the administrator is returned to a consistent view of the remaining checkpoints.
- Two administrators submitting the same new name for two different weighing areas concurrently
  result in exactly one success and one duplicate refusal; no two weighing areas end up sharing a
  name.
- A submitted name whose only difference from the weighing area's stored name is letter case or
  surrounding whitespace is treated as the weighing area's own name, not as a duplicate of itself.
- A name containing accented, punctuated, or non-Latin characters is accepted as long as it is
  non-blank after trimming and within the maximum length.
- A name at exactly the maximum allowed length is accepted; one character beyond it is refused.
- Coordinates at the exact boundary values (latitude -90 or 90, longitude -180 or 180) are accepted.
- A submission that changes only the position, leaving the name untouched, is accepted and does not
  trigger a duplicate-name refusal against the weighing area's own current name.
- A submission that contains no change at all is accepted and leaves the weighing area in its current
  state.
- The administrator abandons the update in progress (cancels, or navigates away): the weighing area
  is left exactly as it was and the marker returns to its stored position.
- The connection is lost or the save fails after submission: the weighing area is left exactly as it
  was, the administrator sees a clear retryable failure message, their entered values are preserved,
  and a retry does not produce a second, conflicting change.
- The administrator's weighing-area administration right is revoked between opening the form and
  submitting: the submission is refused as if they had never been authorized.
- The weighing area being updated is assigned to a planned or in-progress shift, or already has
  weighings recorded against it: the update is applied, and those shifts and weighings keep
  referencing the same weighing area, now under its corrected name and position.
- The administrator repositions the weighing-area marker very close to another checkpoint's marker
  — another weighing area, a dock, or a warehouse door: all markers remain individually
  distinguishable and selectable, and the update targets only the weighing area being edited.
- The administrator starts an update while a checkpoint creation is in progress, or the reverse:
  only one placement session is active at a time and neither session silently discards the other's
  entered values.
- The administrator cannot use a pointing device: they can still reposition the weighing area by
  entering coordinate values directly, kept in sync with the marker.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated, active user holding weighing-area
  administration rights to update an existing available weighing area.
- **FR-002**: The system MUST deny the update to unauthenticated users, to users whose access is not
  active, and to authenticated active users without weighing-area administration rights, without
  changing any weighing area and without disclosing weighing-area data beyond the application's
  established access-handling behavior.
- **FR-003**: The updatable information of a weighing area MUST be limited to its name, its latitude,
  and its longitude.
- **FR-004**: The administrator MUST be able to update the name alone, the position alone, or both
  together in a single submission, and a submission MUST be applied in full or not at all.
- **FR-005**: The system MUST let the administrator reposition the weighing area both by dragging its
  marker on the map and by editing its coordinate values directly, with both means of adjustment kept
  in sync with each other.
- **FR-006**: The update experience MUST be pre-filled with the weighing area's current name,
  latitude, and longitude, and MUST be reachable from the checkpoint consultation area only by users
  authorized to perform the update.
- **FR-007**: The system MUST reject an update whose name is empty or consists only of whitespace.
- **FR-008**: The system MUST reject an update whose name exceeds the maximum site-reference name
  length of 255 characters.
- **FR-009**: The system MUST remove leading and trailing whitespace from the submitted name before
  validating, comparing, and storing it.
- **FR-010**: The system MUST reject an update whose resulting name is already used by another
  weighing area, comparing names without regard to letter case or surrounding whitespace and
  regardless of the other weighing area's lifecycle status.
- **FR-011**: The system MUST accept an update that resubmits the weighing area's own current name
  and MUST NOT report it as a duplicate.
- **FR-012**: The system MUST reject an update whose latitude falls outside -90 to 90, whose
  longitude falls outside -180 to 180, or whose submitted coordinate is not a number.
- **FR-013**: The system MUST refuse the update of an archived weighing area and MUST report that the
  weighing area is read-only until it is reactivated.
- **FR-014**: The system MUST refuse the update of a weighing area that does not exist, without
  disclosing information about other weighing areas.
- **FR-015**: A successful update MUST preserve the weighing area's stable identity, its lifecycle
  status, its creation time, and its existing archive and reactivation context, and MUST record that
  the weighing area was last updated at that moment.
- **FR-016**: A refused update MUST leave the stored weighing area entirely unchanged, including when
  the failure is a connectivity or save failure rather than a validation refusal.
- **FR-017**: The system MUST make the updated name and position authoritative in every subsequent
  consultation, map rendering, detail view, and weighing-area selection, without requiring a manual
  page reload.
- **FR-018**: The system MUST preserve every existing reference between the weighing area and the
  shifts it is assigned to, and any weighings already recorded at it, across an update; those records
  MUST continue to point at the same weighing area.
- **FR-019**: The system MUST NOT retroactively alter weighing-area names or positions already
  captured in immutable report snapshots or other closed historical records.
- **FR-020**: The system MUST report the outcome of an update attempt, distinguishing success,
  validation failure, duplicate name, archived weighing area, weighing area not found, unauthorized
  access, and retryable save failure, with validation and duplicate outcomes shown against the field
  concerned.
- **FR-021**: The administrator MUST be able to correct a refused submission and resubmit it without
  reopening the weighing area, with their previously entered values preserved.
- **FR-022**: The administrator MUST be able to abandon an update in progress, leaving the weighing
  area unchanged and its marker at its stored position.
- **FR-023**: The system MUST keep an update session scoped to the weighing area it was opened for:
  at most one placement session — creation or update, for any checkpoint type — is active at a time,
  and ending or leaving a session MUST NOT leave the map armed to move another checkpoint.
- **FR-024**: Authorization, validation, and uniqueness decisions MUST be enforced authoritatively by
  the system regardless of what the user experience offers or hides.
- **FR-025**: This slice MUST NOT create, archive, reactivate, or permanently delete weighing areas,
  MUST NOT change a weighing area's lifecycle status, and MUST NOT update any other site reference
  type.

### Key Entities *(include if feature involves data)*

- **Weighing Area**: A named weighbridge checkpoint where trucks are weighed, positioned by a
  latitude and a longitude on the site map. It carries a stable identity, a current name, a current
  position, a lifecycle status, a creation time, and a last-updated time. Only the name, latitude,
  and longitude are mutable through this feature.
- **Weighing Area Name**: The unique, human-readable identifier of a weighing area. Uniqueness is
  enforced case-insensitively, after trimming, and across all weighing areas regardless of lifecycle
  status.
- **Weighing Area Position**: The weighing area's latitude and longitude. Both must be present and
  within their legal ranges, and they are always evaluated together as the weighing area's single map
  location.
- **Weighing Area Lifecycle Context**: The archive and most recent reactivation information attached
  to a weighing area. It determines whether the weighing area may be updated at all and is never
  modified by an update.
- **Authorized Administrator**: An authenticated, active member of the operating organization whose
  assigned rights include weighing-area administration; the only actor permitted to perform the
  update.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of update attempts by authorized administrators on
  available weighing areas with valid, unique values succeed, and the corrected name and position are
  visible in consultation within 2 seconds under normal operating conditions without a manual reload.
- **SC-002**: In acceptance testing, 100% of update attempts by unauthenticated visitors, non-active
  users, and active users without weighing-area administration rights are refused with no weighing
  area changed, and the update action is not offered to them.
- **SC-003**: In acceptance testing, 100% of attempts to update an archived weighing area or a
  weighing area that does not exist are refused with the corresponding outcome and leave stored data
  unchanged.
- **SC-004**: Across all acceptance datasets, 0% of weighing areas end up sharing a name under
  case-insensitive, trimmed, cross-status comparison, including under concurrent submissions of the
  same new name, where exactly one submission succeeds.
- **SC-005**: In acceptance testing, 100% of updates with a blank name, an over-long name, a
  duplicate name, or an out-of-range or non-numeric coordinate are refused with a message on the
  field concerned, the stored weighing area unchanged, and the administrator's entered values
  preserved.
- **SC-006**: Every tested refusal condition — blank name, over-long name, duplicate name,
  out-of-range coordinate, archived weighing area, weighing area not found, unauthorized access, and
  retryable save failure — produces a distinct, understandable message, and 100% of retryable
  failures can be recovered by resubmitting without reopening the weighing area.
- **SC-007**: In 100% of acceptance datasets, updated weighing areas keep their identity, lifecycle
  status, lifecycle context, and creation time, and 100% of shift assignments (and any recorded
  weighings) previously attached to an updated weighing area remain attached to it.
- **SC-008**: In 100% of acceptance tests, a weighing area repositioned by dragging its marker is
  stored at the final dragged coordinates rather than any intermediate position, and coordinates
  entered directly produce the same stored result as the equivalent drag.
- **SC-009**: In 100% of acceptance tests covering session scoping, closing or leaving an update
  session leaves no checkpoint armed for movement, and starting a second placement session while one
  is in progress never silently discards entered values.
- **SC-010**: At least 90% of representative administrators can locate a weighing area and complete a
  name or position correction on their first attempt within 60 seconds, without external help.

## Assumptions

- "Authorized administrator" means an authenticated user with active access holding an
  organization-level or operations-level administration role, the same weighing-area administration
  right that already governs weighing-area consultation (#202) and creation (#203).
- The only mutable business information of a weighing area is its name and its map position. Status
  is not directly editable: archival (#205) and reactivation (#206) are the separate slices that
  change it, and they own their own actor, time, and comment.
- Weighing-area names are unique across all weighing areas, available and archived alike, compared
  after trimming and without regard to letter case, matching the rule already enforced by
  weighing-area creation (#203).
- Name uniqueness is scoped to weighing areas. A weighing area may carry the same name as a dock or
  another checkpoint type; cross-type name collisions are not a refusal condition.
- The maximum name length and whitespace-trimming behavior follow the established site-reference name
  rules shared by the other site references.
- Archived weighing areas are read-only; correcting an archived weighing area requires reactivating
  it first (#206).
- The update experience is offered from the same map-based checkpoint consultation area introduced by
  #202 and reuses its marker interaction, rather than living on a separate standalone page. Direct
  coordinate entry stays available as a synchronized alternative so the feature remains usable
  without a pointing device.
- The update experience mirrors the interaction model already delivered for updating a dock (#199),
  including its session-scoping rules, so administrators meet one consistent way of correcting any
  map-placed checkpoint.
- Concurrent edits resolve as last-write-wins on the weighing area as a whole: there is no field-level
  merge and no optimistic-locking prompt in this slice. The administrator is shown the saved result,
  so a silently stale view is not an acceptable outcome.
- Updating a weighing area is not a lifecycle transition and therefore captures no actor, no comment,
  and no archive or reactivation context; only the last-updated time changes alongside the corrected
  values.
- A weighing area assigned to planned or in-progress shifts, or already carrying recorded weighings,
  may still be updated. Those records reference the weighing area by its stable identity, so a
  correction is reflected wherever the weighing area is displayed without any shift or weighing record
  changing, and no usage check blocks the update.
- Renaming or repositioning a weighing area does not rewrite history: immutable report snapshots and
  closed records keep the name and position captured when they were produced.
- Weighing-area records already exist through creation (#203) and the seeded site-reference fixtures,
  so this slice is verifiable against existing data.
- The established application language, validation-messaging, focus-management, and accessibility
  conventions apply to the update flow's labels, errors, and confirmations.
- Weighing-area consultation (#202), creation (#203), archival (#205), and reactivation (#206) are
  independently deliverable sibling issues and stay outside this slice, as does the update of any
  other map-based site reference (docks, warehouses, warehouse doors), each of which is its own
  issue.
