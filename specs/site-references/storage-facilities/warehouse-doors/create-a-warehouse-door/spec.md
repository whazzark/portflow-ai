# Feature Specification: Create a Warehouse Door

**Feature Branch**: `feat/213-create-warehouse-door`

**Created**: 2026-08-26

**Status**: Draft

**Input**: User description: "Create a Warehouse Door — Let an authorized administrator create a door within an eligible warehouse. https://github.com/whazzark/portflow-ai/issues/213"

**GitHub Issue**: [#213](https://github.com/whazzark/portflow-ai/issues/213)

**Parent Roadmap**: `specs/site-references/storage-facilities/warehouse-doors/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Place and Create a Door Inside Its Warehouse (Priority: P1)

An authorized administrator selects an available warehouse in the warehouse consultation area,
activates door creation for that warehouse, clicks the exact point inside its footprint where
trucks stop to unload, names the door, and confirms, so the door immediately becomes an available
unloading point of that warehouse.

**Why this priority**: This is the core outcome of the feature. Without it, warehouse doors can
only be consulted or seeded, never added by the site, and no later door behavior — update, archive,
reactivate, discharge assignment — has anything to operate on. The door's GPS location is required
information, so placing it is inseparable from creating the door.

**Independent Test**: As an authorized administrator, select an available warehouse, activate door
creation, click a point inside its footprint, submit a unique non-blank name, and verify the new
door appears under that warehouse in the Available door view and on the map at the clicked
coordinates.

**Acceptance Scenarios**:

1. **Given** an available warehouse is selected and the administrator is authorized to manage
   warehouse doors, **When** they activate door creation, **Then** the map enters a clearly
   signalled placement state scoped to that warehouse, an explicit way to leave it is offered, and
   no door is created yet.
2. **Given** door creation is active for a warehouse, **When** the administrator clicks a point
   within or on the boundary of that warehouse's footprint, **Then** a pending, clearly
   distinguishable placement marker appears at that point and no door is created yet.
3. **Given** a pending placement marker exists, **When** the administrator submits a non-blank name
   that is unique within that warehouse, **Then** a door is created under that warehouse with
   Available status at the pending marker's final coordinates, and it appears in the warehouse's
   door collection and on the map without requiring a manual refresh.
4. **Given** a pending placement marker exists, **When** the administrator drags it to a different
   point or edits its coordinate values before submitting, **Then** the door is created at the
   final adjusted position rather than at the original click position.
5. **Given** a door was just created, **When** the administrator consults it, **Then** its name,
   containing warehouse, latitude, longitude, Available status, and creation time match exactly the
   submitted name and the final placed position.
6. **Given** the archived door view is currently selected for that warehouse, **When** a door is
   successfully created, **Then** the Available door view is shown with the new door visible and
   selected rather than hidden by the previously selected lifecycle view.
7. **Given** door creation is active with or without a pending marker, **When** the administrator
   cancels or leaves the mode, **Then** the pending marker is discarded, no door is created, and
   the warehouse consultation area returns to its normal state.
8. **Given** door creation is active for a warehouse, **When** the administrator clicks on an
   existing door marker or on the warehouse polygon, **Then** the click places or moves the pending
   marker instead of selecting that existing door or opening the warehouse's details.

---

### User Story 2 - Reject Invalid, Misplaced, or Duplicate Submissions (Priority: P2)

An authorized administrator attempts to create a door without placing it, with a missing or
duplicate name, or at a position outside the containing warehouse's footprint, and is shown a
clear, specific explanation without losing the pending placement or the entered name.

**Why this priority**: Deposited quantities are attributed to warehouses through their doors, so a
duplicate name inside a warehouse or a door placed outside its warehouse would make operational
identity and truck guidance ambiguous. A clear rejection keeps the administrator able to correct
and retry immediately.

**Independent Test**: Attempt to submit before placing a point, with a blank name after placing a
point, with a name that already belongs to a door of that warehouse, and with a position outside
the warehouse footprint; verify each attempt is rejected with a clear message, no door is created,
and the warehouse's door collection is unchanged.

**Acceptance Scenarios**:

1. **Given** no point has been placed yet, **When** the administrator attempts to submit, **Then**
   the submission is blocked with a clear message directing them to place the door inside the
   warehouse footprint, and no door is created.
2. **Given** a pending placement exists and the name is blank or contains only whitespace, **When**
   the administrator submits, **Then** the submission is rejected with a clear field-specific
   message, the pending marker remains, and no door is created.
3. **Given** a pending placement exists and the submitted name already belongs to a door of that
   same warehouse, differing only by letter case or surrounding whitespace, **When** the
   administrator submits, **Then** the submission is rejected with a clear conflict message on the
   name field, the pending marker remains, and no duplicate door is created.
4. **Given** a pending placement exists and the submitted name already belongs to an archived door
   of that same warehouse, **When** the administrator submits, **Then** the submission is rejected
   as a duplicate, because an archived door keeps its name reserved within its warehouse.
5. **Given** the same name already belongs to a door of a different warehouse, **When** the
   administrator submits it for the selected warehouse, **Then** the door is created, because door
   names are unique only within their containing warehouse.
6. **Given** the administrator drags the pending marker outside the containing warehouse's
   footprint, or manually enters coordinates outside it, **When** they submit, **Then** the
   submission is rejected with a clear message stating the door must lie within or on the boundary
   of its warehouse footprint, and no door is created.
7. **Given** the administrator manually enters a non-numeric coordinate or a value outside the
   valid latitude or longitude range, **When** they submit, **Then** the submission is rejected
   with a clear message on the affected field and no door is created.
8. **Given** a submission was rejected, **When** the administrator reviews the form, **Then** the
   previously entered name and the pending marker's current position both remain so they can be
   corrected without starting over.

---

### User Story 3 - Restrict Creation to Authorized Administrators and Eligible Warehouses (Priority: P3)

A user who is not authenticated, not active, or lacks warehouse-door management permission cannot
create a door, and no user can add a door to an archived warehouse, whether they attempt it through
the interface or directly against the underlying capability.

**Why this priority**: Uncontrolled creation would let unauthorized users introduce operational
unloading points, and a door added to an archived warehouse would contradict the warehouse
lifecycle by presenting an available door under a warehouse that is no longer usable.

**Independent Test**: Attempt door creation as an unauthenticated visitor, as an authenticated but
inactive user, as an active user without warehouse-door management permission, and as an authorized
administrator on an archived warehouse; verify each attempt is refused, no pending marker or door
is created, and the creation action is not offered.

**Acceptance Scenarios**:

1. **Given** the user is not authenticated, **When** they attempt to create a warehouse door,
   **Then** the attempt is refused using the application's established access-handling behavior and
   no door is created.
2. **Given** the user is authenticated but not active, or is active without warehouse-door
   management permission, **When** they consult a warehouse, **Then** the door creation action is
   not offered, and a direct submission attempt is refused with no door created.
3. **Given** an authorized administrator selects an archived warehouse, **When** they consult its
   doors, **Then** the door creation action is not offered, and a direct submission targeting that
   warehouse is refused as ineligible with no door created.
4. **Given** the target warehouse is archived between activating door creation and submitting,
   **When** the administrator submits, **Then** the submission is refused as ineligible and no door
   is created.
5. **Given** the administrator's permission is revoked between activating door creation and
   submitting, **When** they submit, **Then** the submission is refused as if they had never been
   authorized.

---

### User Story 4 - Recover From Failed Submissions (Priority: P3)

An authorized administrator whose submission cannot be completed because of a connectivity or
server failure sees a clear failure message, keeps their entered name and pending placement, and
can retry without risking a duplicate door.

**Why this priority**: An ambiguous creation outcome would either lose the administrator's work or
introduce a second door at nearly the same position, which is costly to detect once trucks are
guided to it.

**Independent Test**: Submit a valid door while the underlying capability fails, verify a clear
failure message with the name and pending marker preserved and no door created, then resolve the
failure and retry to verify exactly one door is created.

**Acceptance Scenarios**:

1. **Given** a valid submission, **When** the request cannot be completed because of a connectivity
   or server failure, **Then** the administrator sees a clear failure message, no door is created,
   and the entered name and pending marker remain.
2. **Given** a failed submission is displayed and the underlying problem is resolved, **When** the
   administrator retries, **Then** exactly one door is created and it appears under its warehouse
   without requiring a new sign-in.
3. **Given** two administrators submit the same new name for the same warehouse at nearly the same
   time, **When** both requests are processed, **Then** exactly one door is created and the other
   receives the duplicate-name rejection with its own pending marker intact.

### Edge Cases

- The administrator clicks a point that nearly overlaps an existing door of the same warehouse: the
  pending marker stays visually distinguishable from existing door markers and does not merge with
  or select them.
- The administrator clicks a new point while a pending marker already exists: the marker moves to
  the new point rather than creating a second pending marker.
- The administrator clicks outside the containing warehouse's footprint while placement is active:
  the position is signalled as unacceptable rather than silently accepted, and no door is created.
- The administrator places the door exactly on the warehouse footprint boundary: the door is
  created, because the boundary is a valid unloading position.
- The administrator clicks inside a different warehouse's footprint while creating a door for the
  selected warehouse: the door is not attached to the other warehouse.
- Two warehouses overlap geographically: the created door belongs to the warehouse whose creation
  action was activated, never to the other one.
- The administrator pans or zooms the map after placing a pending marker: the marker stays anchored
  to its geographic coordinates rather than its prior screen position.
- The submitted name matches an existing door's name only after trimming leading or trailing
  whitespace: the submission is treated as a duplicate.
- The submitted name is at the maximum allowed length or contains accented characters or
  punctuation: the door is created and displayed exactly as accepted.
- The warehouse has no doors yet: creation works from the empty door state without requiring an
  existing door.
- The administrator cannot use a pointing device: they can still set and adjust the pending
  position by entering coordinate values directly, kept in sync with the pending marker.
- The map background cannot be displayed while the warehouse footprint is known: placement reports
  map-specific feedback and coordinate entry remains usable, rather than presenting creation as
  unavailable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated, active user with warehouse-door management
  permission to activate a door creation mode scoped to one selected available warehouse, from the
  existing warehouse consultation area.
- **FR-002**: The door creation action MUST be offered only within the selected warehouse's
  existing consultation context; this feature MUST NOT introduce a standalone warehouse-door
  creation destination.
- **FR-003**: While door creation is active, the system MUST let the administrator set the new
  door's position primarily by clicking a point on the map, which places a pending marker at that
  point without creating a door.
- **FR-004**: The system MUST let the administrator adjust the pending position before submitting,
  both by dragging the pending marker and by editing its coordinate values directly, with both
  means kept in sync with each other.
- **FR-005**: The system MUST block submission and show a clear message when no position has been
  placed yet, without creating a door.
- **FR-006**: The system MUST refuse warehouse-door creation for unauthenticated users, inactive
  users, and active users without warehouse-door management permission, without creating a door or
  disclosing warehouse-door data beyond the application's established access-handling behavior.
- **FR-007**: The system MUST refuse creation of a door under an archived warehouse, MUST NOT offer
  the creation action for an archived warehouse, and MUST re-evaluate the containing warehouse's
  eligibility at submission time.
- **FR-008**: Every created door MUST belong permanently to exactly one existing warehouse, which
  is the warehouse whose creation action was activated; the submission MUST NOT be able to attach
  the door to another warehouse.
- **FR-009**: The system MUST reject a door name that is blank or contains only whitespace, with a
  clear field-specific message, and MUST NOT create a door.
- **FR-010**: The system MUST remove leading and trailing whitespace from the submitted name before
  validating and storing it, and MUST preserve the accepted letter casing for display.
- **FR-011**: The system MUST reject a submitted name that duplicates the name of an existing door
  of the same warehouse, compared without letter case after trimming and regardless of that door's
  lifecycle state, with a clear conflict message, and MUST NOT create a duplicate door.
- **FR-012**: The system MUST accept a name that is already used by a door of a different
  warehouse, because door-name uniqueness is scoped to the containing warehouse.
- **FR-013**: The system MUST reject a pending position whose latitude falls outside -90 to 90,
  whose longitude falls outside -180 to 180, or whose manually entered coordinate is non-numeric,
  with a clear field-specific message, and MUST NOT create a door.
- **FR-014**: The system MUST reject a pending position that does not lie within or on the boundary
  of the containing warehouse's footprint, with a clear message explaining the constraint, and MUST
  NOT create a door.
- **FR-015**: A successfully created door MUST be assigned Available status automatically; the
  creator MUST NOT be able to choose an initial lifecycle state.
- **FR-016**: A successfully created door MUST record its creation time, MUST use the pending
  placement's final coordinates at the moment of submission, and MUST be immediately visible under
  its warehouse in the door collection and on the map without requiring a manual page reload.
- **FR-017**: After a successful creation, the system MUST present the newly created door in the
  available door view of its warehouse and identify it as the current selection, even when another
  lifecycle view was previously selected.
- **FR-018**: When a submission is rejected or fails, the system MUST preserve the entered name and
  the pending marker's current position so both can be corrected without starting over.
- **FR-019**: The system MUST NOT create a door as a side effect of a failed or partial submission,
  including when the request cannot be completed because of a connectivity or server failure, and a
  retry after such a failure MUST NOT create a second door.
- **FR-020**: When two submissions claim the same name within the same warehouse at nearly the same
  time, exactly one MUST succeed and the other MUST receive the duplicate-name rejection.
- **FR-021**: Cancelling or leaving door creation MUST discard any pending marker and MUST NOT
  create a door.
- **FR-022**: While door creation is active, clicks on the map MUST place or move the pending marker
  rather than selecting an existing door or opening warehouse details.
- **FR-023**: The pending marker MUST be visually distinguishable from existing door markers and
  MUST NOT be presented as an existing door.
- **FR-024**: Updating, archiving, reactivating, or permanently deleting a warehouse door, creating
  several doors in one submission, assigning a door to a product lot or discharge, and creating any
  other site reference type MUST remain outside this feature.

### Key Entities *(include if feature involves data)*

- **Warehouse Door**: A designated unloading door permanently belonging to one warehouse. On
  creation it receives a stable identity, the submitted trimmed name, the pending placement's final
  latitude and longitude, its containing warehouse, an automatically assigned Available status, and
  a creation time.
- **Warehouse Door Name**: The human-readable identifier of a door, unique within its containing
  warehouse. Uniqueness is evaluated after trimming, without regard to letter case, and across both
  available and archived doors of that warehouse.
- **Warehouse Door GPS Location**: The required latitude and longitude of the point where a truck
  stops to unload, which must lie within or on the boundary of the containing warehouse's
  footprint.
- **Containing Warehouse**: The storage destination the new door is created under. It must be
  available to accept a new door, and its footprint supplies the geographic area the door's
  position must fall within.
- **Pending Door Placement**: A transient, unsaved marker representing where a new door will be
  created if the administrator confirms. It exists only while door creation is active, is not a
  door until submission succeeds, and is discarded on cancellation or navigation away.
- **Authorized Administrator**: An authenticated, active member of the operating organization whose
  assigned permissions include warehouse-door management, including creation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of submissions with an available warehouse, a position
  within or on its footprint, and a name unique within that warehouse succeed, and the new door is
  visible under that warehouse at the placed coordinates within 2 seconds under normal operating
  conditions.
- **SC-002**: In acceptance testing, 100% of submissions with no placed position, a blank name, a
  duplicate name within the warehouse, an out-of-range coordinate, or a position outside the
  warehouse footprint are rejected with no door created, a clear message shown, and the entered
  name and pending placement preserved.
- **SC-003**: In 100% of tested unauthorized attempts (unauthenticated, inactive, or unpermitted
  users) and 100% of tested archived-warehouse attempts, no door is created and the attempt is
  refused.
- **SC-004**: At least 95% of authorized administrators can place and create a door on their first
  attempt without external help when providing valid data.
- **SC-005**: In 100% of tested duplicate-submission races for the same name within the same
  warehouse, exactly one door is created.
- **SC-006**: In 100% of acceptance tests, a door created after dragging or editing the pending
  position is stored at the final position, not the initial click position.
- **SC-007**: In 100% of tested submissions reusing a name that belongs to a door of another
  warehouse, the door is created and both doors remain independently identifiable under their own
  warehouse.
- **SC-008**: In 100% of tested connectivity or server failures during submission, no door is
  created, the failure is reported clearly, and a subsequent retry results in exactly one door.

## Assumptions

- This issue is the end-to-end creation slice for warehouse doors. Consultation is delivered by
  #212; update, archive, and reactivate belong to issues #214 through #216 and stay out of scope.
- "Authorized administrator" means an authenticated, active user whose role grants site-reference
  management, matching the permission model already applied to warehouse creation; the server
  remains authoritative and the interface only mirrors that decision.
- "Eligible warehouse" means an available warehouse. Archived warehouses accept no new doors,
  consistent with archival cascading to their doors and with archived doors being historical
  references only.
- A newly created door always starts Available; there is no way to create a door as already
  archived, and the door is available for new operational use because its warehouse is available.
- Door-name uniqueness is scoped to the containing warehouse and spans both available and archived
  doors, as established for warehouse-door consultation in #212. Names are compared after trimming
  and without letter case, and the accepted casing is preserved for display.
- The door's position is required and must lie within or on the boundary of its warehouse's
  footprint, matching the Warehouse Door GPS Location definition in `CONTEXT.md`.
- Clicking and dragging on the map is the primary way to set the door's position, matching the
  spatial consultation experience delivered by #212 and the click-to-place mechanism introduced for
  docks; direct coordinate entry remains a synchronized alternative so the feature stays usable
  without a pointing device.
- The creation action is presented from the selected warehouse's existing consultation context, so
  no standalone warehouse-door page, route, or detail view is introduced by this feature.
- One door is created per submission; creating several doors in one action is out of scope, though
  the administrator may repeat the flow.
- The name length limit already applied to site-reference names applies unchanged; this feature
  introduces no new naming rule beyond uniqueness and trimming.
- The established application language, validation-messaging, focus-management, and accessibility
  conventions apply to the creation flow's labels, errors, and map interactions.
