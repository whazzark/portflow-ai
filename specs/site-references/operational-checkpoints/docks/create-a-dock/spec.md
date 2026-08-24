# Feature Specification: Create a Dock

**Feature Branch**: `feat/198-create-dock`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Let an authorized administrator create a valid dock by placing it directly on the map. Issue GitHub: https://github.com/whazzark/portflow-ai/issues/198"

**GitHub Issue**: [#198](https://github.com/whazzark/portflow-ai/issues/198)

**Parent Roadmap**: `specs/site-references/operational-checkpoints/docks/roadmap.md`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Place and Create a Valid Dock (Priority: P1)

An authorized administrator opens the dock creation action from the dock consultation area, clicks
a point on the map to mark where the new berth sits, names it, and confirms so the dock immediately
becomes available for operational use at that exact location.

**Why this priority**: This is the core outcome of the feature: without it, docks can only be
consulted, never added, and no other dock lifecycle behavior has anything to operate on. Placing
the dock directly on the map is the primary way administrators are expected to set its location,
since it matches how they already browse and recognize docks spatially.

**Independent Test**: As an authorized administrator, open the creation action, click a point on
the map, submit a unique name, and verify the new dock appears on the map at the clicked
coordinates with an Available status.

**Acceptance Scenarios**:

1. **Given** the administrator is authorized to manage docks and has activated dock creation,
   **When** they click a point on the map, **Then** a pending, clearly distinguishable placement
   marker appears at that point and no dock is created yet.
2. **Given** a pending placement marker is on the map, **When** the administrator submits a unique,
   non-blank name, **Then** a new dock is created at the pending marker's coordinates with
   Available status and appears in the dock collection without requiring a manual refresh.
3. **Given** a pending placement marker is on the map, **When** the administrator drags it to a
   different point before submitting, **Then** the dock is created at the final, adjusted point
   rather than the original click location.
4. **Given** a dock was just created, **When** the administrator opens its details, **Then** the
   name, latitude, longitude, Available status, and creation time match exactly the placed
   location and submitted name.
5. **Given** dock creation is active with or without a pending placement marker, **When** the
   administrator cancels, **Then** the pending marker is removed, no dock is created, and the map
   returns to its normal consultation state.

---

### User Story 2 - Reject Invalid or Duplicate Submissions (Priority: P2)

An authorized administrator attempts to create a dock without placing it, with a missing or
duplicate name, or with a manually entered coordinate outside the valid range, and is shown a
clear, specific explanation without losing the pending placement or their other entered values.

**Why this priority**: Preventing invalid, unplaced, or conflicting dock records protects the
reliability of every downstream feature that depends on dock identity and location, and a clear
rejection keeps the administrator able to correct and retry immediately.

**Independent Test**: Attempt to submit before placing a point, submit once with a blank name after
placing a point, and submit once with a name that already exists; verify each attempt is rejected
with a clear message, no dock is created, and the existing dock collection is unchanged.

**Acceptance Scenarios**:

1. **Given** no point has been placed on the map yet, **When** the administrator attempts to
   submit, **Then** the submission is blocked with a clear message directing them to place the dock
   on the map, and no dock is created.
2. **Given** a point is placed and the name field is blank or contains only whitespace, **When**
   the administrator submits, **Then** the submission is rejected with a clear message on the name
   field, the pending placement marker remains, and no dock is created.
3. **Given** a point is placed and a dock with the same name already exists, differing only by case
   or surrounding whitespace, **When** the administrator submits, **Then** the submission is
   rejected with a clear conflict message on the name field, the pending placement marker remains,
   and no duplicate dock is created.
4. **Given** the administrator manually edits the pending marker's coordinate fields to a value
   outside the valid latitude or longitude range, **When** they submit, **Then** the submission is
   rejected with a clear message on the affected field and no dock is created.
5. **Given** a submission was rejected, **When** the administrator reviews the form, **Then** the
   previously entered name and the pending placement marker's position both remain so they can be
   corrected without starting over.

---

### User Story 3 - Restrict Creation to Authorized Users (Priority: P3)

A user who is not authenticated, not active, or lacks dock management permission cannot create a
dock or place a pending marker, whether they attempt it through the interface or directly against
the underlying capability.

**Why this priority**: Uncontrolled creation would let unauthorized users introduce operational
berths, so this protection must hold even though it is exercised less often than a normal creation.

**Independent Test**: Attempt dock creation as an unauthenticated visitor, as an authenticated but
inactive user, and as an authenticated active user without dock management permission; verify each
attempt is refused, no placement marker or dock is created, and the creation action is not offered.

**Acceptance Scenarios**:

1. **Given** the user is not authenticated, **When** they attempt to create a dock, **Then** the
   attempt is refused using the application's established access-handling behavior and no dock is
   created.
2. **Given** the user is authenticated but not active, or is active without dock management
   permission, **When** they view the dock consultation area, **Then** the dock creation action is
   not offered, and a direct submission attempt is refused with no dock created.

### Edge Cases

- The administrator clicks a point that nearly overlaps an existing dock marker: the pending
  placement marker remains visually distinguishable from existing markers and does not merge with
  or select them.
- The administrator clicks a new point while a pending placement marker already exists: the pending
  marker moves to the new point rather than creating a second pending marker.
- The administrator pans or zooms the map after placing a pending marker: the marker stays anchored
  to its geographic coordinates, not its prior screen position.
- The submitted name matches an existing dock's name only after trimming leading or trailing
  whitespace: the submission is treated as a duplicate.
- The submitted name matches an existing archived dock's name: the submission is still treated as a
  duplicate, since names must stay unique regardless of lifecycle status.
- Two administrators submit the same new name at nearly the same time: exactly one creation
  succeeds and the other receives the duplicate-name rejection with its own pending marker intact.
- The connection is lost or the server fails after submission but before confirmation: the
  administrator sees a clear failure message, no dock is silently created twice, the pending marker
  remains, and they can safely retry.
- The name is at the maximum allowed length or contains accented characters or punctuation: the
  dock is created and displayed exactly as entered.
- The administrator drags the pending marker to the exact boundary coordinates (latitude -90/90,
  longitude -180/180): the dock is created successfully.
- The administrator's permission is revoked between activating creation and submitting: the
  submission is refused as if they were never authorized.
- The administrator cannot use a pointing device: they can still set and adjust the pending
  location by entering coordinate values directly, kept in sync with the pending marker.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated, active user with dock management permission
  to activate a dock creation mode from the dock consultation area.
- **FR-002**: While dock creation is active, the system MUST let the administrator set the new
  dock's location primarily by clicking a point on the map, which drops a pending placement marker
  at that point without creating a dock.
- **FR-003**: The system MUST let the administrator adjust the pending placement's location before
  submitting, both by dragging the pending marker on the map and by editing its coordinate values
  directly, with both means of adjustment kept in sync with each other.
- **FR-004**: The system MUST block submission and show a clear message when no location has been
  placed yet, without creating a dock.
- **FR-005**: The system MUST refuse dock creation for unauthenticated users, inactive users, and
  active users without dock management permission, without creating a dock, placing a marker, or
  disclosing dock data beyond the application's established access-handling behavior.
- **FR-006**: The system MUST reject a dock name that is blank or contains only whitespace, with a
  clear field-specific message, and MUST NOT create a dock.
- **FR-007**: The system MUST trim leading and trailing whitespace from the submitted name before
  validating and storing it.
- **FR-008**: The system MUST reject a submitted name that duplicates an existing dock's name,
  compared case-insensitively after trimming and regardless of the existing dock's lifecycle
  status, with a clear conflict message, and MUST NOT create a duplicate dock.
- **FR-009**: The system MUST reject a pending placement whose latitude falls outside -90 to 90 or
  whose longitude falls outside -180 to 180, or a non-numeric manually entered coordinate, with a
  clear field-specific message, and MUST NOT create a dock.
- **FR-010**: A successfully created dock MUST be assigned Available status automatically; the
  creator MUST NOT be able to set an initial status.
- **FR-011**: A successfully created dock MUST record its creation time, MUST use the pending
  placement's final coordinates at the moment of submission, and MUST be immediately visible in the
  dock collection without requiring a manual page reload.
- **FR-012**: When a submission is rejected, the system MUST preserve the administrator's
  previously entered name and MUST keep the pending placement marker at its current position, so
  both can be corrected without starting over.
- **FR-013**: The system MUST NOT create a dock as a side effect of a failed or partial submission,
  including when the request cannot be completed due to a connectivity or server failure.
- **FR-014**: Cancelling an active dock creation MUST remove any pending placement marker and MUST
  NOT create a dock.
- **FR-015**: The dock creation action MUST be reachable only from within the dock consultation
  area and MUST NOT be offered to users who lack dock management permission.
- **FR-016**: Updating, archiving, reactivating, or permanently deleting a dock, and creating any
  other site reference type, MUST remain outside this feature.

### Key Entities

- **Dock**: A named operational berth at which a vessel is discharged. On creation it receives a
  stable identity, the submitted name, the pending placement's final latitude and longitude, an
  automatically assigned Available status, and a creation time.
- **Dock Name**: The unique, human-readable identifier of a dock. Uniqueness is enforced
  case-insensitively, after trimming, and across all docks regardless of lifecycle status.
- **Pending Dock Placement**: A transient, unsaved marker representing where a new dock will be
  created if the administrator confirms. It exists only while dock creation is active, is not a
  dock until submission succeeds, and is discarded on cancellation or navigation away.
- **Authorized Administrator**: An authenticated, active member of the operating organization whose
  assigned permissions include dock management, including creation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of dock creation attempts with a placed location, a
  valid, unique name succeed and the new dock is visible on the map at the placed coordinates
  within 2 seconds under normal operating conditions.
- **SC-002**: In acceptance testing, 100% of dock creation attempts with no placed location, a
  blank name, an out-of-range coordinate, or a duplicate name are rejected with no dock created and
  a clear message shown, and the pending placement (when one exists) is preserved.
- **SC-003**: In 100% of tested unauthorized-creation attempts (unauthenticated, inactive, or
  unpermitted users), no dock or pending marker is created and the attempt is refused.
- **SC-004**: At least 95% of authorized administrators can successfully place and create a dock on
  their first attempt without needing external help, when providing valid data.
- **SC-005**: In 100% of tested duplicate-submission races (two near-simultaneous requests for the
  same name), exactly one dock is created.
- **SC-006**: In 100% of acceptance tests, a dock created by dragging the pending marker after the
  initial click is stored at the final dragged coordinates, not the original click coordinates.

## Assumptions

- This issue is an end-to-end creation slice for the existing dock site reference; consultation is
  covered by #197, and update, archive, and reactivate behaviors belong to issues #199 through
  #201.
- Dock management permission follows the existing application access model: the user's
  authenticated active status and assigned permissions determine access, while the server remains
  authoritative.
- A newly created dock always starts in Available status; there is no way to create a dock as
  already archived.
- Dock name uniqueness is global across the site's dock collection (not scoped by status), matching
  the constraint already enforced for dock consultation and other lifecycle operations.
- Clicking and dragging on the map is the primary way to set a new dock's location, matching the
  spatial, map-centric consultation experience from #197; direct coordinate entry remains available
  as a synchronized alternative so the feature stays usable without a pointing device.
- The established application language, validation-messaging, and accessibility conventions apply
  to the creation flow's labels, errors, and focus management.
- The creation action is presented from the same dock consultation area introduced in #197 (the map
  at `/checkpoints`), rather than as a separate standalone page.
- The click-to-place mechanism this feature introduces is expected to be reused by future creation
  behaviors for other map-based site references (weighing areas, warehouses, warehouse doors), but
  this issue delivers dock creation only; those other resources' creation flows remain out of scope
  here (see FR-016) and are each their own future issue.
