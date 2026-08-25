# Feature Specification: Create a Warehouse

**Feature Branch**: `feat/208-create-warehouse`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Create a Warehouse — Let an authorized administrator create a warehouse with its required footprint. https://github.com/whazzark/portflow-ai/issues/208"

**GitHub Issue**: [#208](https://github.com/whazzark/portflow-ai/issues/208)

**Parent Roadmap**: `specs/site-references/storage-facilities/warehouses/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Draw and Create a Warehouse with Its Footprint (Priority: P1)

An authorized administrator activates the warehouse creation mode on the warehouse map, draws the
warehouse's operational footprint by clicking its boundary points directly on the map, names it,
and confirms, so the warehouse immediately becomes available as a storage destination with a
faithful representation of the area it occupies.

**Why this priority**: This is the core outcome of the feature. Without it, warehouses can only be
consulted, never added, and no other warehouse behavior — update, archive, reactivate, or door
management — has anything to operate on. The footprint is required warehouse information, so
drawing it is inseparable from creating the warehouse.

**Independent Test**: As an authorized administrator, activate the warehouse creation mode, click
at least three boundary points on the map, submit a unique name, and verify the new warehouse appears
on the map as a polygon matching the drawn boundary, with Available status.

**Acceptance Scenarios**:

1. **Given** the administrator is authorized to manage warehouses, **When** they activate the
   warehouse creation mode from the warehouse map, **Then** the map switches to a clearly signalled
   drawing state, an explicit way to leave the mode is offered, and no warehouse is created yet.
2. **Given** warehouse creation mode is active, **When** the administrator clicks successive points
   on the map, **Then** each click adds a pending boundary point, the pending footprint outline
   updates after each point, and no warehouse is created yet.
3. **Given** at least three pending boundary points have been placed, **When** the administrator
   submits a unique, non-blank name, **Then** a new warehouse is created with Available status and
   with a footprint whose boundary points match the pending ones in the order they were placed, and
   it appears in the warehouse collection without requiring a manual refresh.
4. **Given** a pending footprint is being drawn, **When** the administrator drags one of its
   boundary points to a different position, removes the most recently placed point, or adds a point
   before submitting, **Then** the warehouse is created from the final adjusted footprint rather
   than from any intermediate state.
5. **Given** a warehouse was just created, **When** the administrator opens its details, **Then**
   the name, Available status, creation time, and complete footprint polygon match exactly the
   submitted name and the final drawn boundary, and the map frames that footprint.
6. **Given** warehouse creation is active with or without pending boundary points, **When** the
   administrator cancels, **Then** all pending boundary points are discarded, no warehouse is
   created, and the map returns to its normal consultation state.
7. **Given** the collection currently shows the archived lifecycle view, **When** a warehouse is
   successfully created, **Then** the newly created warehouse is visible and selected rather than
   hidden by the administrator's previous lifecycle view or name search.
8. **Given** warehouse creation mode is active, **When** the administrator clicks on top of an
   existing warehouse's polygon, **Then** a boundary point is added at that position and the
   existing warehouse's details are not opened.
9. **Given** at least three boundary points have been placed, **When** the administrator clicks the
   first boundary point again, **Then** the outline is finished, the map stops accepting new
   boundary points, and the placed points remain adjustable.
10. **Given** a finished outline, **When** the administrator clicks elsewhere on the map, **Then**
    no boundary point is added and the outline is unchanged.
11. **Given** a finished outline, **When** the administrator removes the most recently placed
    boundary point, **Then** the outline reopens and the map accepts new boundary points again.

---

### User Story 2 - Reject Invalid or Duplicate Submissions (Priority: P2)

An authorized administrator attempts to create a warehouse without a complete footprint, with a
missing or duplicate name, or with an invalid boundary, and is shown a clear, specific explanation
without losing the pending footprint or the other entered values.

**Why this priority**: Deposited quantities are attributed to warehouses through their doors, so a
duplicate or geometrically invalid warehouse would corrupt operational identity and make door
placement ambiguous. A clear rejection keeps the administrator able to correct and retry
immediately.

**Independent Test**: Attempt to submit with fewer than three boundary points, with a blank name
after drawing a valid footprint, with a name that already belongs to a warehouse, and with a
self-intersecting boundary; verify each attempt is rejected with a clear message, no warehouse is
created, and the existing warehouse collection is unchanged.

**Acceptance Scenarios**:

1. **Given** fewer than three boundary points have been placed, **When** the administrator attempts
   to submit, **Then** the submission is blocked with a clear message stating that a footprint
   requires at least three boundary points, and no warehouse is created.
2. **Given** a valid pending footprint and a name that is blank or contains only whitespace,
   **When** the administrator submits, **Then** the submission is rejected with a clear
   field-specific message, the pending footprint remains, and no warehouse is created.
3. **Given** a valid pending footprint and a name that already belongs to a warehouse, differing
   only by case or surrounding whitespace, **When** the administrator submits, **Then** the
   submission is rejected with a clear conflict message on the name field, the pending footprint
   remains, and no duplicate warehouse is created.
4. **Given** the pending boundary crosses itself or contains duplicate consecutive points, **When**
   the administrator submits, **Then** the submission is rejected with a clear message explaining
   that the footprint outline must be a simple, non-crossing boundary, and no warehouse is created.
5. **Given** the administrator manually edits a boundary point's coordinate values to a value
   outside the valid latitude or longitude range, or to a non-numeric value, **When** they submit,
   **Then** the submission is rejected with a clear message on the affected point and no warehouse
   is created.
6. **Given** a submission was rejected, **When** the administrator reviews the form, **Then** the
   previously entered name and every pending boundary point remain so they can be corrected without
   redrawing the footprint from scratch.

---

### User Story 3 - Restrict Creation to Authorized Administrators (Priority: P3)

A user who is not authenticated, not active, or lacks warehouse management permission cannot create
a warehouse or start drawing a footprint, whether they attempt it through the interface or directly
against the underlying capability.

**Why this priority**: Uncontrolled creation would let unauthorized users introduce storage
destinations that discharges, doors, and rotations can then be attached to, so this protection must
hold even though it is exercised less often than a normal creation.

**Independent Test**: Attempt warehouse creation as an unauthenticated visitor, as an authenticated
but inactive user, and as an authenticated active user without warehouse management permission;
verify each attempt is refused, no pending footprint or warehouse is created, and the creation
action is not offered.

**Acceptance Scenarios**:

1. **Given** the user is not authenticated, **When** they attempt to create a warehouse, **Then**
   the attempt is refused using the application's established access-handling behavior and no
   warehouse is created.
2. **Given** the user is authenticated but not active, or is active without warehouse management
   permission, **When** they view the warehouse consultation area, **Then** the warehouse creation
   action is not offered, and a direct submission attempt is refused with no warehouse created.

### Edge Cases

- The administrator places a boundary point that nearly coincides with an existing warehouse's
  polygon or with one of its own earlier points: the pending footprint stays visually
  distinguishable from persisted warehouses and does not snap onto or select them.
- The administrator pans or zooms the map while drawing: every pending boundary point stays
  anchored to its geographic coordinates, not its prior screen position.
- The administrator activates warehouse creation mode while a warehouse's details are open: the
  details close, the previously selected warehouse is not carried into the creation flow, and the
  first map click adds a boundary point instead of reopening a detail view.
- The administrator clicks the first boundary point with fewer than three points placed: there is no
  ring to close, so finishing is not offered and the click behaves like any other placement.
- The administrator drags a boundary point of a finished outline into a position that makes the
  outline cross itself: the crossing is reported and submission is blocked, exactly as while drawing.
- The administrator finishes the outline and then cancels: the finished outline is discarded with
  the rest of the pending footprint, and no warehouse is created.
- The new footprint overlaps an existing warehouse's footprint: the creation succeeds, because
  overlapping footprints are not prohibited by the domain.
- The submitted name matches an existing warehouse's name only after trimming leading or trailing
  whitespace: the submission is treated as a duplicate.
- The submitted name matches an archived warehouse's name: the submission is still treated as a
  duplicate, since names must stay unique regardless of lifecycle status.
- The submitted name matches an existing dock, weighing area, or warehouse door name: the
  submission succeeds, because those are distinct site references with independent name uniqueness.
- Two administrators submit the same new warehouse name at nearly the same time: exactly one
  creation succeeds and the other receives the duplicate-name rejection with its own pending
  footprint intact.
- The connection is lost or the server fails after submission but before confirmation: the
  administrator sees a clear failure message, no warehouse is silently created twice, the pending
  footprint remains, and they can safely retry.
- The name is at the maximum allowed length or contains accented characters or punctuation: the
  warehouse is created and displayed exactly as entered.
- A boundary point sits exactly on a coordinate limit (latitude -90/90, longitude -180/180): the
  warehouse is created successfully.
- The footprint has many boundary points or an irregular shape: it is stored and displayed
  completely, without being simplified to a rectangle or reduced to a single point.
- The administrator's permission is revoked between activating creation and submitting: the
  submission is refused as if they were never authorized.
- The administrator cannot use a pointing device: they can still add, adjust, and remove boundary
  points by entering coordinate values directly, kept in sync with the pending footprint drawn on
  the map.
- The warehouse is created with no doors: it is a valid available warehouse that simply has no
  unloading doors yet, and door creation remains a separate behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated, active user with warehouse management
  permission to activate a warehouse creation mode from the warehouse map, presented as an explicit
  map mode in the same way the checkpoints map presents its own modes.
- **FR-001a**: While warehouse creation mode is active, the interface MUST make the active mode
  unmistakable and MUST offer an explicit way to leave it at any point, whether or not boundary
  points have been placed.
- **FR-002**: While warehouse creation mode is active, the system MUST let the administrator define
  the new warehouse's footprint primarily by clicking successive points directly on the map, each
  click adding a pending boundary point without creating a warehouse.
- **FR-002a**: While warehouse creation mode is active, a click on the map MUST add a boundary point
  and MUST NOT select an existing warehouse, open its details, or trigger any other click behaviour
  the map offers during normal consultation, including clicks landing on an existing warehouse's
  polygon.
- **FR-002b**: At most one warehouse map mode MUST be active at a time; activating warehouse
  creation mode MUST close any open warehouse detail view, and no other map mode MUST remain armed
  while a footprint is being drawn.
- **FR-002c**: Once at least three boundary points exist, the system MUST let the administrator
  finish the outline by clicking its first boundary point. A finished outline MUST stop accepting
  new boundary points, MUST keep every placed point adjustable, and MUST reopen for drawing when a
  boundary point is removed. Finishing MUST NOT be a precondition for submitting: a footprint of at
  least three valid points is submittable whether or not it has been finished.
- **FR-003**: The system MUST display the pending footprint outline as it is drawn, updating after
  every added, moved, or removed boundary point, and MUST show how many boundary points are
  currently placed and whether the outline is finished.
- **FR-004**: The system MUST let the administrator adjust the pending footprint before submitting,
  by dragging a boundary point, removing the most recently placed boundary point, adding further
  points, and editing a boundary point's coordinate values directly, with map and coordinate values
  kept in sync with each other.
- **FR-004a**: Drawing on the map MUST be the primary path. Direct coordinate entry MUST remain
  available for every boundary point as the pointer-free path, but MUST NOT occupy the creation
  panel by default; it MUST be reachable in at most one interaction.
- **FR-005**: The system MUST block submission and show a clear message when the pending footprint
  has fewer than three boundary points, without creating a warehouse.
- **FR-006**: The system MUST refuse warehouse creation for unauthenticated users, inactive users,
  and active users without warehouse management permission, without creating a warehouse or
  disclosing warehouse data beyond the application's established access-handling behavior.
- **FR-007**: The system MUST reject a warehouse name that is blank or contains only whitespace,
  with a clear field-specific message, and MUST NOT create a warehouse.
- **FR-008**: The system MUST trim leading and trailing whitespace from the submitted name before
  validating and storing it.
- **FR-009**: The system MUST reject a submitted name that duplicates an existing warehouse's name,
  compared case-insensitively after trimming and regardless of the existing warehouse's lifecycle
  status, with a clear conflict message, and MUST NOT create a duplicate warehouse.
- **FR-010**: Warehouse name uniqueness MUST be evaluated only against other warehouses; a name
  already used by a dock, weighing area, warehouse door, or any other site reference type MUST NOT
  block creation.
- **FR-011**: The system MUST reject a boundary point whose latitude falls outside -90 to 90, whose
  longitude falls outside -180 to 180, or whose manually entered coordinate is non-numeric, with a
  clear message identifying the affected point, and MUST NOT create a warehouse.
- **FR-012**: The system MUST reject a pending footprint whose outline crosses itself or contains
  duplicate consecutive boundary points, with a clear message, and MUST NOT create a warehouse.
- **FR-013**: A successfully created warehouse MUST persist its footprint as an ordered sequence of
  boundary points preserving the order in which they were drawn, so the stored polygon reproduces
  the drawn outline exactly.
- **FR-014**: A successfully created warehouse MUST be assigned Available status automatically; the
  creator MUST NOT be able to set an initial status.
- **FR-015**: A successfully created warehouse MUST record its creation time, MUST use the pending
  footprint's final boundary points at the moment of submission, and MUST be immediately visible in
  the warehouse collection without requiring a manual page reload.
- **FR-016**: After a successful creation, the system MUST present the new warehouse as selected and
  visible, adjusting the current lifecycle view or name search if it would otherwise hide it, and
  MUST frame its complete footprint.
- **FR-017**: When a submission is rejected, the system MUST preserve the administrator's previously
  entered name and every pending boundary point at its current position, so both can be corrected
  without redrawing the footprint.
- **FR-018**: The system MUST NOT create a warehouse, a partial warehouse, or an orphaned footprint
  as a side effect of a failed or partial submission, including when the request cannot be completed
  due to a connectivity or server failure.
- **FR-019**: Leaving warehouse creation mode — through its explicit cancel action or through the
  application's established dismissal convention — MUST discard every pending boundary point, MUST
  NOT create a warehouse, and MUST return the map to its normal consultation state with map clicks
  selecting warehouses again.
- **FR-020**: The warehouse creation action MUST be reachable only from within the warehouse
  consultation area and MUST NOT be offered to users who lack warehouse management permission.
- **FR-021**: The name and the footprint MUST be the only administrator-supplied warehouse
  attributes on creation; the feature MUST NOT capture storage capacity, stored product, address, or
  a separately maintained warehouse center.
- **FR-022**: Creating warehouse doors, and updating, archiving, reactivating, or permanently
  deleting a warehouse, MUST remain outside this feature.

### Key Entities

- **Warehouse**: A storage destination on the site where bulk material is deposited after being
  transported from a vessel. On creation it receives a stable identity, the submitted name, exactly
  one required footprint, an automatically assigned Available status, and a creation time. A newly
  created warehouse has no doors yet.
- **Warehouse Name**: The human-readable identifier of a warehouse, unique among warehouses.
  Uniqueness is enforced case-insensitively, after trimming, and across all warehouses regardless of
  lifecycle status.
- **Warehouse Footprint**: The required geographic polygon outlining the warehouse's operational
  area, including where trucks position themselves for unloading. It is an ordered sequence of at
  least three boundary points forming a simple, non-crossing outline; its display center is derived
  from the polygon rather than stored separately.
- **Pending Warehouse Footprint**: The transient, unsaved sequence of boundary points representing
  where a new warehouse will be created if the administrator confirms. It exists only while
  warehouse creation is active, is not a warehouse until submission succeeds, and is discarded on
  cancellation or on navigation away.
- **Authorized Administrator**: An authenticated, active member of the operating organization whose
  assigned permissions include warehouse management, including creation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of warehouse creation attempts with a valid footprint of
  at least three boundary points and a valid, unique name succeed, and the new warehouse is visible
  on the map with its complete footprint within 2 seconds under normal operating conditions.
- **SC-002**: In acceptance testing, 100% of warehouse creation attempts with fewer than three
  boundary points, a blank name, a duplicate name, an out-of-range coordinate, or a self-crossing
  outline are rejected with no warehouse created and a clear message shown, and the pending
  footprint and entered name are preserved.
- **SC-003**: In 100% of tested unauthorized-creation attempts (unauthenticated, inactive, or
  unpermitted users), no warehouse is created and the attempt is refused.
- **SC-004**: At least 95% of authorized administrators can draw a footprint and create a warehouse
  on their first attempt without needing external help, when providing valid data.
- **SC-005**: In 100% of tested duplicate-submission races (two near-simultaneous requests for the
  same warehouse name), exactly one warehouse is created.
- **SC-006**: In 100% of acceptance tests, a warehouse created after moving or removing boundary
  points is stored with the final adjusted footprint, point for point and in order, not with any
  intermediate outline.
- **SC-007**: In 100% of acceptance tests, a newly created warehouse is visible and selected
  immediately after creation, including when the previous lifecycle view or name search would
  otherwise have hidden it.
- **SC-009**: In 100% of acceptance tests, a map click after the outline is finished leaves the
  footprint unchanged, and removing a boundary point makes the map accept new points again.
- **SC-008**: In 100% of tested interrupted submissions (connectivity or server failure), no
  warehouse and no orphaned footprint remain, and a retry after recovery creates exactly one
  warehouse.

## Assumptions

- This issue is an end-to-end creation slice for the existing warehouse site reference;
  consultation is covered by #207, and update, archive, and reactivate behaviors belong to issues
  #209 through #211. Warehouse doors are a separate resource covered by roadmap #44.
- Warehouse management permission follows the existing site-reference administration model used for
  docks and weighing areas: organization administrators and operations administrators may create,
  the user's authenticated active status and assigned permissions determine access, and the server
  remains authoritative.
- A newly created warehouse always starts in Available status; there is no way to create one as
  already archived.
- Warehouse name uniqueness is global across the site's warehouses and independent of dock, weighing
  area, and warehouse door names, matching how these site references are separately identified.
- The creation action is presented from the existing warehouse map at `/warehouses` introduced by
  #207, as a creation action within that consultation area rather than as a separate standalone
  page.
- Warehouse creation is an armed map mode following the pattern already established on the
  checkpoints map, where activating a mode arms the map, captures its clicks, and suspends the
  normal click behaviour until the mode is left. The warehouse map has no mode today, so creation
  introduces the first one there; mode exclusivity is therefore only against warehouse detail
  selection until further warehouse modes exist.
- Drawing the polygon by clicking directly on the map is the primary and expected way to define the
  footprint. The click-to-place and drag-to-adjust mechanism introduced by dock creation (#198) is
  extended from a single point to an ordered sequence of boundary points rather than replaced by a
  different placement concept, and direct coordinate entry remains the accessibility fallback rather
  than the main path. Because it is the fallback and not the expected path, the coordinate values
  are folded away in the creation panel rather than listed per boundary point.
- Clicking the first boundary point to close a ring follows the convention of map drawing tools, so
  it needs no separate on-screen control. It exists to stop a stray click from reshaping an outline
  the administrator considers done — not to gate submission, which stays open from three valid
  points onward.
- Three boundary points is the minimum for a footprint, with no upper bound relevant to the initial
  delivery and no minimum enclosed area beyond a simple, non-crossing outline.
- Footprints of different warehouses may overlap; no geographic exclusivity, containment, or
  site-boundary constraint is enforced by this slice.
- Warehouse doors are placed within or on the boundary of a footprint, but door placement is
  validated when doors are created, not here; a warehouse may exist with no doors.
- The operating organization manages exactly one site, so the creating administrator's organization
  determines the site scope without an additional site picker.
- The established application language, validation-messaging, and accessibility conventions apply to
  the creation flow's labels, errors, and focus management.
