# Feature Specification: Create a Weighing Area

**Feature Branch**: `feat/203-create-weighing-area`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Create a Weighing Area — Let an authorized administrator create a valid weighing area. https://github.com/whazzark/portflow-ai/issues/203"

**GitHub Issue**: [#203](https://github.com/whazzark/portflow-ai/issues/203)

**Parent Roadmap**: `specs/site-references/operational-checkpoints/weighing-areas/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Place and Create a Valid Weighing Area (Priority: P1)

An authorized administrator opens the weighing-area creation action from the checkpoint
consultation area, clicks the point on the map where trucks are positioned on the weighbridge,
names the area, and confirms, so the weighing area immediately becomes available for operational
use at that exact location.

**Why this priority**: This is the core outcome of the feature. Without it, weighing areas can only
be consulted, never added, and no other weighing-area lifecycle behavior has anything to operate
on. Placing the area directly on the map matches how administrators already browse and recognize
checkpoints spatially.

**Independent Test**: As an authorized administrator, open the weighing-area creation action, click
a point on the map, submit a unique name, and verify the new weighing area appears on the map at
the clicked coordinates with Available status.

**Acceptance Scenarios**:

1. **Given** the administrator is authorized to manage weighing areas and has activated weighing-area
   creation, **When** they click a point on the map, **Then** a pending, clearly distinguishable
   placement marker appears at that point and no weighing area is created yet.
2. **Given** a pending placement marker is on the map, **When** the administrator submits a unique,
   non-blank name, **Then** a new weighing area is created at the pending marker's coordinates with
   Available status and appears in the checkpoint collection without requiring a manual refresh.
3. **Given** a pending placement marker is on the map, **When** the administrator drags it to a
   different point before submitting, **Then** the weighing area is created at the final, adjusted
   point rather than the original click location.
4. **Given** a weighing area was just created, **When** the administrator opens its details,
   **Then** the name, latitude, longitude, Available status, and creation time match exactly the
   placed location and submitted name.
5. **Given** weighing-area creation is active with or without a pending placement marker, **When**
   the administrator cancels, **Then** the pending marker is removed, no weighing area is created,
   and the map returns to its normal consultation state.
6. **Given** the map currently hides weighing areas through the checkpoint-type filter, **When** a
   weighing area is successfully created, **Then** the newly created area is visible and selected
   rather than hidden by the administrator's previous filter.

---

### User Story 2 - Reject Invalid or Duplicate Submissions (Priority: P2)

An authorized administrator attempts to create a weighing area without placing it, with a missing
or duplicate name, or with a manually entered coordinate outside the valid range, and is shown a
clear, specific explanation without losing the pending placement or their other entered values.

**Why this priority**: Weighings recorded at an area feed rotation net tonnage, so a duplicate or
mislocated weighing area would corrupt operational identity downstream. A clear rejection keeps the
administrator able to correct and retry immediately.

**Independent Test**: Attempt to submit before placing a point, submit once with a blank name after
placing a point, and submit once with a name that already belongs to a weighing area; verify each
attempt is rejected with a clear message, no weighing area is created, and the existing checkpoint
collection is unchanged.

**Acceptance Scenarios**:

1. **Given** no point has been placed on the map yet, **When** the administrator attempts to
   submit, **Then** the submission is blocked with a clear message directing them to place the
   weighing area on the map, and no weighing area is created.
2. **Given** a point is placed and the name field is blank or contains only whitespace, **When**
   the administrator submits, **Then** the submission is rejected with a clear message on the name
   field, the pending placement marker remains, and no weighing area is created.
3. **Given** a point is placed and a weighing area with the same name already exists, differing
   only by case or surrounding whitespace, **When** the administrator submits, **Then** the
   submission is rejected with a clear conflict message on the name field, the pending placement
   marker remains, and no duplicate weighing area is created.
4. **Given** the administrator manually edits the pending marker's coordinate fields to a value
   outside the valid latitude or longitude range, **When** they submit, **Then** the submission is
   rejected with a clear message on the affected field and no weighing area is created.
5. **Given** a submission was rejected, **When** the administrator reviews the form, **Then** the
   previously entered name and the pending placement marker's position both remain so they can be
   corrected without starting over.

---

### User Story 3 - Restrict Creation to Authorized Users (Priority: P3)

A user who is not authenticated, not active, or lacks weighing-area management permission cannot
create a weighing area or place a pending marker, whether they attempt it through the interface or
directly against the underlying capability.

**Why this priority**: Uncontrolled creation would let unauthorized users introduce operational
weighbridge checkpoints that shifts and rotations can then be assigned to, so this protection must
hold even though it is exercised less often than a normal creation.

**Independent Test**: Attempt weighing-area creation as an unauthenticated visitor, as an
authenticated but inactive user, and as an authenticated active user without weighing-area
management permission; verify each attempt is refused, no placement marker or weighing area is
created, and the creation action is not offered.

**Acceptance Scenarios**:

1. **Given** the user is not authenticated, **When** they attempt to create a weighing area,
   **Then** the attempt is refused using the application's established access-handling behavior and
   no weighing area is created.
2. **Given** the user is authenticated but not active, or is active without weighing-area
   management permission, **When** they view the checkpoint consultation area, **Then** the
   weighing-area creation action is not offered, and a direct submission attempt is refused with no
   weighing area created.

### Edge Cases

- The administrator clicks a point that nearly overlaps an existing checkpoint marker of either
  kind: the pending placement marker remains visually distinguishable from existing markers and
  does not merge with or select them.
- The administrator clicks a new point while a pending placement marker already exists: the pending
  marker moves to the new point rather than creating a second pending marker.
- The administrator pans or zooms the map after placing a pending marker: the marker stays anchored
  to its geographic coordinates, not its prior screen position.
- The submitted name matches an existing weighing area's name only after trimming leading or
  trailing whitespace: the submission is treated as a duplicate.
- The submitted name matches an existing archived weighing area's name: the submission is still
  treated as a duplicate, since names must stay unique regardless of lifecycle status.
- The submitted name matches an existing dock's name: the submission succeeds, because docks and
  weighing areas are distinct site references with independent name uniqueness.
- Two administrators submit the same new weighing-area name at nearly the same time: exactly one
  creation succeeds and the other receives the duplicate-name rejection with its own pending marker
  intact.
- The administrator activates weighing-area creation while dock creation is already active, or the
  reverse: only one creation flow is active at a time, and the abandoned flow's pending marker is
  discarded rather than carried into the new one.
- The connection is lost or the server fails after submission but before confirmation: the
  administrator sees a clear failure message, no weighing area is silently created twice, the
  pending marker remains, and they can safely retry.
- The name is at the maximum allowed length or contains accented characters or punctuation: the
  weighing area is created and displayed exactly as entered.
- The administrator drags the pending marker to the exact boundary coordinates (latitude -90/90,
  longitude -180/180): the weighing area is created successfully.
- The administrator's permission is revoked between activating creation and submitting: the
  submission is refused as if they were never authorized.
- The administrator cannot use a pointing device: they can still set and adjust the pending
  location by entering coordinate values directly, kept in sync with the pending marker.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated, active user with weighing-area management
  permission to activate a weighing-area creation mode from the checkpoint consultation area,
  distinctly from the existing dock creation action.
- **FR-002**: While weighing-area creation is active, the system MUST let the administrator set the
  new weighing area's location primarily by clicking a point on the map, which drops a pending
  placement marker at that point without creating a weighing area.
- **FR-003**: The system MUST let the administrator adjust the pending placement's location before
  submitting, both by dragging the pending marker on the map and by editing its coordinate values
  directly, with both means of adjustment kept in sync with each other.
- **FR-004**: The system MUST block submission and show a clear message when no location has been
  placed yet, without creating a weighing area.
- **FR-005**: The system MUST refuse weighing-area creation for unauthenticated users, inactive
  users, and active users without weighing-area management permission, without creating a weighing
  area, placing a marker, or disclosing checkpoint data beyond the application's established
  access-handling behavior.
- **FR-006**: The system MUST reject a weighing-area name that is blank or contains only
  whitespace, with a clear field-specific message, and MUST NOT create a weighing area.
- **FR-007**: The system MUST trim leading and trailing whitespace from the submitted name before
  validating and storing it.
- **FR-008**: The system MUST reject a submitted name that duplicates an existing weighing area's
  name, compared case-insensitively after trimming and regardless of the existing area's lifecycle
  status, with a clear conflict message, and MUST NOT create a duplicate weighing area.
- **FR-009**: Weighing-area name uniqueness MUST be evaluated only against other weighing areas; a
  name already used by a dock or any other site reference type MUST NOT block creation.
- **FR-010**: The system MUST reject a pending placement whose latitude falls outside -90 to 90 or
  whose longitude falls outside -180 to 180, or a non-numeric manually entered coordinate, with a
  clear field-specific message, and MUST NOT create a weighing area.
- **FR-011**: A successfully created weighing area MUST be assigned Available status automatically;
  the creator MUST NOT be able to set an initial status.
- **FR-012**: A successfully created weighing area MUST record its creation time, MUST use the
  pending placement's final coordinates at the moment of submission, and MUST be immediately
  visible in the checkpoint collection without requiring a manual page reload.
- **FR-013**: After a successful creation, the system MUST present the new weighing area as
  selected and visible, adjusting the checkpoint-type visibility if the administrator's current
  filter would otherwise hide it.
- **FR-014**: When a submission is rejected, the system MUST preserve the administrator's
  previously entered name and MUST keep the pending placement marker at its current position, so
  both can be corrected without starting over.
- **FR-015**: The system MUST NOT create a weighing area as a side effect of a failed or partial
  submission, including when the request cannot be completed due to a connectivity or server
  failure.
- **FR-016**: Cancelling an active weighing-area creation MUST remove any pending placement marker
  and MUST NOT create a weighing area.
- **FR-017**: At most one checkpoint creation flow MUST be active at a time; activating
  weighing-area creation MUST discard any pending dock placement, and the reverse.
- **FR-018**: The weighing-area creation action MUST be reachable only from within the checkpoint
  consultation area and MUST NOT be offered to users who lack weighing-area management permission.
- **FR-019**: Updating, archiving, reactivating, or permanently deleting a weighing area, and
  creating any other site reference type, MUST remain outside this feature.

### Key Entities

- **Weighing Area**: An operational checkpoint organized around a weighbridge where truck weights
  are recorded before and after loading. On creation it receives a stable identity, the submitted
  name, the pending placement's final latitude and longitude, an automatically assigned Available
  status, and a creation time.
- **Weighing Area Name**: The human-readable identifier of a weighing area, unique among weighing
  areas. Uniqueness is enforced case-insensitively, after trimming, and across all weighing areas
  regardless of lifecycle status.
- **Weighing Area GPS Location**: The required latitude and longitude of the point where a truck is
  positioned on the weighbridge, set by the pending placement's final coordinates.
- **Pending Weighing Area Placement**: A transient, unsaved marker representing where a new
  weighing area will be created if the administrator confirms. It exists only while weighing-area
  creation is active, is not a weighing area until submission succeeds, and is discarded on
  cancellation, on switching to another creation flow, or on navigation away.
- **Authorized Administrator**: An authenticated, active member of the operating organization whose
  assigned permissions include weighing-area management, including creation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of weighing-area creation attempts with a placed location
  and a valid, unique name succeed and the new weighing area is visible on the map at the placed
  coordinates within 2 seconds under normal operating conditions.
- **SC-002**: In acceptance testing, 100% of weighing-area creation attempts with no placed
  location, a blank name, an out-of-range coordinate, or a duplicate name are rejected with no
  weighing area created and a clear message shown, and the pending placement (when one exists) is
  preserved.
- **SC-003**: In 100% of tested unauthorized-creation attempts (unauthenticated, inactive, or
  unpermitted users), no weighing area or pending marker is created and the attempt is refused.
- **SC-004**: At least 95% of authorized administrators can successfully place and create a
  weighing area on their first attempt without needing external help, when providing valid data.
- **SC-005**: In 100% of tested duplicate-submission races (two near-simultaneous requests for the
  same weighing-area name), exactly one weighing area is created.
- **SC-006**: In 100% of acceptance tests, a weighing area created by dragging the pending marker
  after the initial click is stored at the final dragged coordinates, not the original click
  coordinates.
- **SC-007**: In 100% of acceptance tests, a newly created weighing area is visible and selected
  immediately after creation, including when the checkpoint-type filter previously hid weighing
  areas.

## Assumptions

- This issue is an end-to-end creation slice for the existing weighing-area site reference;
  consultation is covered by #202, and update, archive, and reactivate behaviors belong to issues
  #204 through #206.
- Weighing-area management permission follows the existing site-reference administration model used
  for docks: organization administrators and operations administrators may create, the user's
  authenticated active status and assigned permissions determine access, and the server remains
  authoritative.
- A newly created weighing area always starts in Available status; there is no way to create one as
  already archived.
- Weighing-area name uniqueness is global across the site's weighing areas and independent of dock
  names, matching how the two site references are separately identified in consultation (#202).
- The creation action is presented from the same shared Checkpoints map at `/checkpoints`
  introduced by #197 and #202, as a second creation action alongside "Create dock", rather than as
  a separate standalone page.
- The click-to-place, drag-to-adjust, and synchronized coordinate-entry mechanism introduced by
  dock creation (#198) is reused for weighing areas rather than reinvented; this feature adds no
  new placement interaction concept.
- The established application language, validation-messaging, and accessibility conventions apply
  to the creation flow's labels, errors, and focus management.
- The weighing area's name and GPS location are the only administrator-supplied attributes on
  creation; no weighbridge capacity, identifier, or equipment metadata is captured by this slice.
