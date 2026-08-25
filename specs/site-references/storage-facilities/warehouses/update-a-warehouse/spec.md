# Feature Specification: Update a Warehouse

**Feature Branch**: `feat/209-update-warehouse`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Update a Warehouse — Let an authorized administrator update a warehouse's mutable identity and footprint. https://github.com/whazzark/portflow-ai/issues/209"

**Feature ID**: `GH-209`

**GitHub Issue**: [#209](https://github.com/whazzark/portflow-ai/issues/209)

**Parent Roadmap**: `specs/site-references/storage-facilities/warehouses/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct an Available Warehouse's Name and Footprint (Priority: P1)

As an authorized administrator, I want to correct the name of an available warehouse and reshape
the footprint drawn on the warehouse map so that the storage destination operators see matches the
physical reality of the site.

**Why this priority**: This is the core outcome of the slice. Warehouses were named and drawn once
at creation, and buildings are extended, re-surveyed, renamed, or simply mis-drawn. Without
correction the warehouse reference drifts away from the area it is supposed to describe, and every
operator choosing a storage destination — and every door positioned inside that footprint — is
misled.

**Independent Test**: Sign in as an authorized administrator, open an available warehouse from the
warehouse map, rename it, then reshape its footprint by dragging a boundary point, inserting one on
a chosen edge, and removing another; save, and verify the warehouse is shown under its new name with
its new polygon while keeping the same identity, Available status, and creation time.

**Acceptance Scenarios**:

1. **Given** an available warehouse exists, **When** an authorized administrator activates the
   warehouse update mode for it, **Then** the map switches to a clearly signalled editing state
   pre-filled with the warehouse's current name and every one of its current boundary points, and
   an explicit way to leave the mode without saving is offered.
2. **Given** the update mode is active for an available warehouse, **When** the administrator
   submits a different valid name, **Then** the warehouse is saved under the new name, the
   administrator receives explicit confirmation, and the warehouse's identity, footprint, and
   Available status are unchanged.
3. **Given** the update mode is active, **When** the administrator drags one or more boundary points
   to new positions and saves, **Then** the warehouse footprint is stored with the final dragged
   positions, in the same boundary order, and the polygon is shown there without requiring a manual
   refresh.
4. **Given** the update mode is active, **When** the administrator designates a specific edge of the
   outline to receive a new boundary point, **Then** a boundary point is inserted between that edge's
   two endpoints and nowhere else, the outline redraws through it, and the saved footprint contains
   it at that position in the boundary order.
5. **Given** the update mode is active on a footprint of more than three boundary points, **When**
   the administrator removes any boundary point — not only the most recently added one — **Then**
   the outline closes over the gap and the saved footprint contains exactly the remaining boundary
   points in their remaining order.
6. **Given** the update mode is active, **When** the administrator clicks the map away from the
   footprint being corrected, including on another warehouse's polygon, **Then** nothing is added to
   the footprint, no other warehouse is selected, and the outline is unchanged.
7. **Given** the update mode is active, **When** the administrator edits a boundary point's
   coordinate values directly instead of using the map, **Then** the drawn outline and the
   coordinate values stay in sync and the saved footprint uses the values shown at submission time.
8. **Given** the administrator changes the name and the footprint in the same submission, **When**
   the update is saved, **Then** both changes take effect together, or neither does.
9. **Given** a warehouse was just updated, **When** any active user consults the warehouse
   collection or that warehouse's details, **Then** the warehouse appears with its new name and
   polygon, the map frames the new polygon, its creation time is unchanged, and its last-updated
   time reflects the change.
10. **Given** the administrator submits the warehouse's current name and current footprint
    unchanged, **When** the update is processed, **Then** it succeeds without reporting a duplicate
    and the warehouse is left in its current state.
11. **Given** the update mode is active, **When** the administrator abandons the update through its
    explicit cancel action, **Then** the stored name and footprint are left untouched, the polygon
    returns to its stored shape, and the map returns to its normal consultation state.

---

### User Story 2 - Be Prevented From Saving Invalid or Duplicate Values (Priority: P2)

As an authorized administrator, I want blank, over-long, duplicate, out-of-range, and geometrically
impossible values to be refused with a clear, specific explanation so that no partial or corrupting
change reaches the warehouse reference and I can correct my mistake without redrawing the footprint
from scratch.

**Why this priority**: Warehouse name uniqueness and footprint validity are what make a warehouse
usable as an operational reference: deposited quantities are attributed through doors positioned
inside the footprint. A silently accepted duplicate name or a self-crossing outline corrupts
operational identity, but this only matters once the successful update path exists.

**Independent Test**: On an available warehouse, attempt in turn a blank name, an over-long name, a
name already used by another warehouse, a footprint reduced below three boundary points, an
out-of-range coordinate, a self-crossing outline, and a reshape that pushes one of the warehouse's
doors outside the outline; verify each attempt is refused with a distinct message shown against the
field, boundary point, or doors concerned, the stored warehouse is untouched, and the entered values
and edited outline remain on screen for correction.

**Acceptance Scenarios**:

1. **Given** an available warehouse, **When** the administrator submits an empty name or a name made
   only of whitespace, **Then** the update is refused with a message on the name field and the
   stored name is unchanged.
2. **Given** an available warehouse, **When** the administrator submits a name longer than the
   maximum allowed length, **Then** the update is refused with a message on the name field and the
   stored name is unchanged.
3. **Given** another warehouse already uses a given name, including one differing only by letter
   case or surrounding whitespace, **When** the administrator submits that name, **Then** the update
   is refused as a duplicate with the message shown on the name field, and neither warehouse is
   modified.
4. **Given** an archived warehouse uses a given name, **When** the administrator submits that name
   for an available warehouse, **Then** the update is still refused as a duplicate, because names
   stay unique regardless of lifecycle status.
5. **Given** a submitted name has leading or trailing whitespace but is otherwise valid and unused,
   **When** the update is processed, **Then** the surrounding whitespace is removed and the trimmed
   name is stored.
6. **Given** a footprint reduced to exactly three boundary points, **When** the administrator
   attempts to remove one of them, **Then** the removal is prevented with a clear explanation that a
   footprint must keep at least three boundary points, and a submission that nevertheless carries
   fewer than three is refused with the same explanation and leaves the stored footprint unchanged.
7. **Given** the administrator moves a boundary point so that the outline crosses itself, contains
   duplicate consecutive points, or collapses onto a single line enclosing no area, **When** they
   submit, **Then** the update is refused with a clear message explaining that the outline must be a
   simple, non-crossing boundary enclosing an area, and the stored footprint is unchanged.
8. **Given** the administrator enters a latitude outside -90 to 90, a longitude outside -180 to 180,
   or a coordinate that is not a number, **When** they submit, **Then** the update is refused with a
   message identifying the affected boundary point and the stored footprint is unchanged.
9. **Given** a warehouse that has doors, **When** the administrator reshapes its footprint so that
   one or more of those doors would fall outside the resulting outline, **Then** the update is
   refused with a message naming the doors concerned, and the stored footprint and every door are
   unchanged.
10. **Given** an update was refused, **When** the administrator corrects the offending value and
    resubmits, **Then** the update succeeds without them having to leave the update mode and reopen
    the warehouse, and the name and the edited outline they had already produced were never lost.

---

### User Story 3 - Be Blocked From Updating What Must Not Change (Priority: P3)

As the operating organization, I want updates refused for users without warehouse management
permission, for archived warehouses, and for warehouses that no longer exist, so that authorization
and lifecycle rules stay trustworthy no matter how the update is attempted.

**Why this priority**: These guard rails protect the integrity of the warehouse reference and must
hold even when the interface is bypassed, but they are exercised less often than a normal
correction.

**Independent Test**: Attempt an update as an unauthenticated visitor, as an authenticated but
inactive user, as an active user without warehouse management permission, on an archived warehouse,
and on a warehouse identifier that does not exist; verify each attempt is refused with the
appropriate outcome and no warehouse data changes.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** an update is attempted, **Then** it is refused
   using the application's established access-handling behavior and no warehouse data is exposed or
   modified.
2. **Given** an authenticated user whose access is not active, or an active user without warehouse
   management permission, **When** an update is attempted, **Then** it is refused as unauthorized
   and the warehouse is unchanged.
3. **Given** an active user without warehouse management permission consults a warehouse's details,
   **When** the details are displayed, **Then** no update action is offered.
4. **Given** an archived warehouse, **When** an administrator attempts to update it, **Then** the
   update is refused because archived warehouses are read-only, and the message states that
   reactivation is required first.
5. **Given** an archived warehouse is consulted by an authorized administrator, **When** its details
   are displayed, **Then** the update action is either not offered or clearly unavailable,
   consistent with the read-only rule the system enforces.
6. **Given** a warehouse identifier that does not exist, **When** an administrator attempts to
   update it, **Then** the update is refused as not found without disclosing information about other
   warehouses.
7. **Given** any refused update, **When** the stored warehouses are inspected afterwards, **Then**
   no warehouse's name, footprint, status, or lifecycle context has changed.

### Edge Cases

- A warehouse archived by another administrator after the update mode was opened is refused on
  submission as read-only rather than being silently updated.
- A warehouse renamed or reshaped by another administrator after the update mode was opened is
  overwritten by the submitted values, and the administrator sees the resulting saved state rather
  than a stale view.
- A warehouse no longer resolvable between opening the update mode and submitting is refused as not
  found, and the administrator is returned to a consistent view of the remaining warehouses.
- Two administrators submitting the same new name for two different warehouses concurrently result
  in exactly one success and one duplicate refusal; no two warehouses end up sharing a name.
- A submitted name whose only difference from the warehouse's stored name is letter case or
  surrounding whitespace is treated as the warehouse's own name, not as a duplicate of itself.
- A name containing accented, punctuated, or non-Latin characters is accepted as long as it is
  non-blank after trimming and within the maximum length; a name at exactly the maximum length is
  accepted and one character beyond it is refused.
- A submission that changes only the footprint, leaving the name untouched, is accepted and does not
  trigger a duplicate-name refusal against the warehouse's own current name.
- A submission that contains no change at all is accepted and leaves the warehouse in its current
  state.
- Boundary points at the exact coordinate limits (latitude -90 or 90, longitude -180 or 180) are
  accepted.
- The administrator reshapes the footprint so that it overlaps another warehouse's footprint: the
  update succeeds, because overlapping footprints are not prohibited by the domain.
- The administrator enlarges the footprint far beyond its original area, or reduces it to a very
  small one: both are accepted as long as the outline stays simple and encloses an area, since the
  domain sets no size limits.
- The administrator inserts many boundary points into an already detailed outline: the resulting
  polygon is stored and displayed completely, without being simplified or truncated, and the
  insertion handles offered on each edge stay visually distinguishable from the real boundary points
  however dense the outline becomes.
- The administrator inserts a boundary point on an edge and immediately removes it again: the
  outline returns to exactly its previous shape and boundary order.
- The administrator removes a boundary point down to three and then wants to reshape that corner:
  they insert a point first and remove the unwanted one afterwards, since the footprint is never
  allowed to drop below three points.
- The administrator pans or zooms the map while editing: every boundary point, moved or not, stays
  anchored to its geographic coordinates rather than its prior screen position.
- The administrator activates the update mode while the warehouse creation mode is armed, or the
  reverse: at most one map mode stays active, and no pending creation footprint leaks into the
  update.
- While the update mode is active, a click on empty map or on another warehouse's polygon adds
  nothing to the footprint, does not select that warehouse, and does not switch the update to it.
- The connection is lost or the save fails after submission: the warehouse is left exactly as it
  was, the administrator sees a clear retryable failure message, their name and edited outline are
  preserved, and a retry does not produce a second, conflicting change.
- The administrator's warehouse management permission is revoked between opening the update mode and
  submitting: the submission is refused as if they had never been authorized.
- The warehouse being updated is referenced by planned or in-progress discharges, rotations, or
  shifts: the update is applied and those records keep referencing the same warehouse, now under its
  corrected name and footprint.
- The warehouse contains doors whose recorded positions would fall outside the reshaped footprint:
  the update is refused, the doors concerned are named, and nothing is changed — neither the stored
  footprint nor any door.
- A door sits exactly on the reshaped outline rather than strictly inside it: the door is still
  contained, so the update is accepted.
- Every door of the warehouse is archived and one of them would fall outside the reshaped outline:
  the update is still refused, because archived doors keep their recorded position inside their
  warehouse's footprint.
- The warehouse has no doors at all: no containment check applies and the footprint may be reshaped
  freely within the geometry rules.
- Renaming or reshaping a warehouse does not rewrite history: report snapshots and other closed
  records keep the name and footprint captured when they were produced.
- The administrator cannot use a pointing device: they can still move, insert, and remove boundary
  points through the coordinate path, where inserting after a designated point starts from the
  midpoint of the edge it splits, kept in sync with the outline drawn on the map.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated, active user holding warehouse management
  permission to update an existing available warehouse.
- **FR-002**: The system MUST deny the update to unauthenticated users, to users whose access is not
  active, and to authenticated active users without warehouse management permission, without
  changing any warehouse and without disclosing warehouse data beyond the application's established
  access-handling behavior.
- **FR-003**: The updatable information of a warehouse MUST be limited to its name and its
  footprint; identity, lifecycle status, creation time, lifecycle context, and its doors MUST NOT be
  modifiable through this feature.
- **FR-004**: The administrator MUST be able to update the name alone, the footprint alone, or both
  together in a single submission, and a submission MUST be applied in full or not at all.
- **FR-005**: The system MUST offer the update as an explicit warehouse map mode, pre-filled with
  the warehouse's current name and complete current footprint, reachable only from the warehouse
  consultation area and only by users authorized to perform the update.
- **FR-005a**: While the update mode is active, the interface MUST make the active mode
  unmistakable and MUST offer an explicit way to leave it without saving. A click on the map away
  from the footprint being corrected — including on another warehouse's polygon — MUST have no
  effect: it MUST NOT select another warehouse, open its details, or add a boundary point.
- **FR-005b**: At most one warehouse map mode MUST be active at a time; activating the update mode
  MUST leave any armed creation mode and discard its pending footprint, and activating creation MUST
  end an update in progress without saving it.
- **FR-006**: The system MUST let the administrator reshape the footprint directly on the map
  through three gestures on the outline itself — moving an existing boundary point, inserting a new
  one, and removing one — updating the displayed outline after every change and showing how many
  boundary points it currently has. Reshaping MUST be driven by the outline's own handles, never by
  clicks landing elsewhere on the map.
- **FR-006a**: Inserting a boundary point MUST require the administrator to designate the edge that
  receives it, through a handle offered on each edge of the outline, and the new point MUST take its
  place between that edge's two endpoints. The system MUST NOT infer an insertion position from a
  click made away from the outline, and MUST NOT append a point to an arbitrary end of the boundary
  order.
- **FR-006b**: The administrator MUST be able to remove any boundary point of the footprint, not
  only the most recently inserted one, and the outline MUST close over the gap. When the footprint
  holds exactly three boundary points, the system MUST prevent removal with a clear explanation
  rather than let the outline fall below three points and refuse the submission afterwards.
- **FR-006c**: The footprint being corrected is a closed outline at all times; the system MUST NOT
  require or offer a step to close or finish it, and no boundary point MUST carry a special role in
  the editing gestures.
- **FR-006d**: The system MUST let the administrator edit any boundary point's coordinate values
  directly as the pointer-free path, kept in sync with the outline drawn on the map, and MUST offer
  through that same path an equivalent for both map gestures: inserting a boundary point after a
  designated one, pre-filled with the midpoint of the edge it splits so the resulting outline stays
  valid and visible, and removing a designated boundary point. Reshaping on the map remains the
  primary path, and coordinate entry MUST be reachable in at most one interaction without occupying
  the update panel by default.
- **FR-007**: The system MUST reject an update whose name is empty or consists only of whitespace.
- **FR-008**: The system MUST reject an update whose name exceeds the maximum site-reference name
  length of 255 characters.
- **FR-009**: The system MUST remove leading and trailing whitespace from the submitted name before
  validating, comparing, and storing it.
- **FR-010**: The system MUST reject an update whose resulting name is already used by another
  warehouse, comparing names without regard to letter case or surrounding whitespace and regardless
  of the other warehouse's lifecycle status.
- **FR-011**: The system MUST accept an update that resubmits the warehouse's own current name and
  MUST NOT report it as a duplicate.
- **FR-011a**: Warehouse name uniqueness MUST be evaluated only against other warehouses; a name
  already used by a dock, weighing area, warehouse door, or any other site reference type MUST NOT
  block the update.
- **FR-012**: The system MUST reject an update whose resulting footprint has fewer than three
  boundary points.
- **FR-013**: The system MUST reject an update whose resulting footprint outline crosses itself,
  contains duplicate consecutive boundary points, or encloses no area.
- **FR-014**: The system MUST reject an update whose boundary point has a latitude outside -90 to
  90, a longitude outside -180 to 180, or a coordinate that is not a number, identifying the
  affected boundary point.
- **FR-015**: A successful update MUST replace the warehouse's footprint with the submitted ordered
  sequence of boundary points, preserving that order exactly, and MUST NOT leave any boundary point
  of the previous footprint behind.
- **FR-016**: The system MUST refuse an update whose resulting footprint would no longer contain
  one or more of the warehouse's existing doors, whatever their lifecycle status, and MUST name the
  doors that would fall outside so the administrator can adjust the outline around them. The refused
  update MUST leave the stored footprint and every door unchanged.
- **FR-016a**: This feature MUST NOT move, archive, or delete a door in order to make a reshape
  possible; doors always remain attached to the same warehouse and are only ever a constraint on the
  resulting outline.
- **FR-017**: A successful update MUST preserve the warehouse's stable identity, its lifecycle
  status, its creation time, and its existing archive and reactivation context, and MUST record that
  the warehouse was last updated at that moment.
- **FR-018**: The system MUST refuse the update of an archived warehouse and MUST report that the
  warehouse is read-only until it is reactivated.
- **FR-019**: The system MUST refuse the update of a warehouse that does not exist, without
  disclosing information about other warehouses.
- **FR-020**: A refused update MUST leave the stored warehouse and its footprint entirely unchanged,
  including when the failure is a connectivity or save failure rather than a validation refusal, and
  MUST NOT leave a partially replaced footprint or an orphaned boundary point behind.
- **FR-021**: The system MUST make the updated name and footprint authoritative in every subsequent
  consultation, map rendering, detail view, tooltip, name search, and warehouse selection, without
  requiring a manual page reload, and MUST frame the updated polygon when the warehouse is selected.
- **FR-022**: The system MUST preserve every existing reference between the warehouse and the
  discharges, rotations, shifts, and doors attached to it across an update; those records MUST
  continue to point at the same warehouse.
- **FR-023**: The system MUST NOT retroactively alter warehouse names or footprints already captured
  in immutable report snapshots or other closed historical records.
- **FR-024**: The system MUST report the outcome of an update attempt, distinguishing success,
  validation failure, duplicate name, invalid footprint geometry, a reshape excluding existing
  doors, archived warehouse, warehouse not found, unauthorized access, and retryable save failure,
  with validation, duplicate, and door-containment outcomes shown against the field, boundary point,
  or doors concerned.
- **FR-025**: The administrator MUST be able to correct a refused submission and resubmit it without
  leaving the update mode, with their previously entered name and edited outline preserved.
- **FR-026**: The administrator MUST be able to abandon an update in progress, leaving the warehouse
  unchanged, restoring the displayed polygon to its stored shape, and returning the map to its
  normal consultation state with clicks selecting warehouses again.
- **FR-027**: Authorization, validation, uniqueness, and geometry decisions MUST be enforced
  authoritatively by the system regardless of what the user experience offers or hides.
- **FR-028**: This slice MUST NOT create, archive, reactivate, or permanently delete warehouses,
  MUST NOT change a warehouse's lifecycle status, MUST NOT create, update, archive, or reactivate
  warehouse doors, and MUST NOT update any other site reference type.

### Key Entities *(include if feature involves data)*

- **Warehouse**: A named storage destination on the site where bulk material is deposited. It
  carries a stable identity, a current name, exactly one required footprint, a lifecycle status, a
  creation time, and a last-updated time. Only the name and the footprint are mutable through this
  feature.
- **Warehouse Name**: The unique, human-readable identifier of a warehouse. Uniqueness is enforced
  case-insensitively, after trimming, and across all warehouses regardless of lifecycle status; it
  is independent of the names of other site reference types.
- **Warehouse Footprint**: The required geographic polygon outlining the warehouse's operational
  area, including where trucks position themselves for unloading. It is an ordered sequence of at
  least three boundary points forming a simple, non-crossing outline enclosing an area; its display
  center is derived from the polygon rather than stored separately. An update replaces it as a
  whole.
- **Warehouse Door**: An unloading point belonging permanently to one warehouse, recorded at a
  position within or on its warehouse's footprint. Doors are never created, moved, or removed by
  this feature; they only constrain how a footprint may be reshaped.
- **Warehouse Lifecycle Context**: The archive and most recent reactivation information attached to
  a warehouse. It determines whether the warehouse may be updated at all and is never modified by an
  update.
- **Authorized Administrator**: An authenticated, active member of the operating organization whose
  assigned permissions include warehouse management; the only actor permitted to perform the update.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of update attempts by authorized administrators on
  available warehouses with valid, unique values succeed, and the corrected name and polygon are
  visible in consultation within 2 seconds under normal operating conditions without a manual
  reload.
- **SC-002**: In acceptance testing, 100% of update attempts by unauthenticated visitors, non-active
  users, and active users without warehouse management permission are refused with no warehouse
  changed, and the update action is not offered to them.
- **SC-003**: In acceptance testing, 100% of attempts to update an archived warehouse or a warehouse
  that does not exist are refused with the corresponding outcome and leave stored data unchanged.
- **SC-004**: Across all acceptance datasets, 0% of warehouses end up sharing a name under
  case-insensitive, trimmed, cross-status comparison, including under concurrent submissions of the
  same new name, where exactly one submission succeeds.
- **SC-005**: In acceptance testing, 100% of updates with a blank name, an over-long name, a
  duplicate name, fewer than three boundary points, an out-of-range or non-numeric coordinate, a
  self-crossing or area-less outline, or a reshape excluding an existing door are refused with a
  message on the field, boundary point, or doors concerned, leaving the stored warehouse unchanged
  and the administrator's entered values and edited outline preserved.
- **SC-006**: Every tested refusal condition — blank name, over-long name, duplicate name,
  insufficient boundary points, invalid coordinate, invalid outline, door excluded by the reshape,
  archived warehouse, warehouse not found, unauthorized access, and retryable save failure —
  produces a distinct, understandable message, and 100% of retryable failures can be recovered by
  resubmitting without leaving the update mode.
- **SC-007**: In 100% of acceptance datasets, updated warehouses keep their identity, lifecycle
  status, lifecycle context, and creation time, and 100% of doors, discharges, rotations, and shifts
  previously attached to an updated warehouse remain attached to it.
- **SC-008**: In 100% of acceptance tests, a footprint reshaped by moving, inserting, and removing
  boundary points is stored with the final outline, point for point and in order, not with any
  intermediate state, and each gesture performed through direct coordinate entry produces the same
  stored result as the equivalent map interaction.
- **SC-009**: At least 90% of representative administrators can locate a warehouse and complete a
  name correction or a footprint reshape on their first attempt within 90 seconds, without external
  help.
- **SC-010**: In 100% of acceptance datasets, every door of every warehouse still lies within or on
  its warehouse's footprint after the full set of update attempts has been replayed, and 100% of
  reshapes that would have excluded a door were refused with the doors named.
- **SC-011**: In 100% of tested interrupted submissions (connectivity or server failure), the stored
  warehouse and its complete footprint are unchanged, with no partially replaced footprint, and a
  retry after recovery applies the correction exactly once.
- **SC-012**: In 100% of acceptance tests, a boundary point inserted on a designated edge is stored
  between that edge's two endpoints and nowhere else in the boundary order, a click made away from
  the outline leaves the footprint unchanged, and no footprint can be taken below three boundary
  points through the interface.

## Assumptions

- "Authorized administrator" means an authenticated user with active access holding an
  organization-level or operations-level administration role — the same warehouse management
  permission that already governs warehouse creation (#208), and narrower than the consultation
  access every active user has through #207.
- The only mutable business information of a warehouse is its name and its footprint. Status is not
  directly editable: archival (#210) and reactivation (#211) are the separate slices that change it,
  and they own their own actor, time, and comment.
- Warehouse names are unique across all warehouses, available and archived alike, compared after
  trimming and without regard to letter case, matching the rule already enforced by warehouse
  creation (#208). The maximum name length and whitespace-trimming behavior follow the established
  site-reference name rules shared by the other site references.
- Archived warehouses are read-only; correcting an archived warehouse requires reactivating it first
  (#211), following the rule already applied to docks (#199) and weighing areas.
- The footprint is replaced as a whole rather than patched point by point: the submission carries the
  complete resulting ordered sequence of boundary points, so there is no partial-footprint edit and
  no per-point history.
- Footprint validity rules are exactly those enforced at creation (#208): at least three boundary
  points, coordinates within their legal ranges, and a simple, non-crossing outline enclosing an
  area, with no minimum or maximum size and no site-boundary constraint.
- Footprints of different warehouses may overlap, so reshaping one warehouse over another is not a
  conflict this slice detects.
- The update experience is offered from the same map-based warehouse consultation area introduced by
  #207 and reuses the armed-map-mode pattern established by warehouse creation (#208), rather than
  living on a separate standalone page. Direct coordinate entry stays available as a synchronized
  alternative so the feature remains usable without a pointing device.
- The editing gestures deliberately differ from those of creation (#208), because the two act on
  different things: creation builds an open polyline where a click appends the next point and the
  first point closes the ring, while an update starts from an outline that is already closed. On a
  closed outline "append at the end" designates no meaningful position, so insertion is expressed as
  splitting a designated edge — the convention of map and vector editors, where the gesture itself
  says where the point goes — and a click landing away from the outline does nothing rather than
  inferring an insertion position from an invisible calculation. A stray click is far more costly
  here than during creation: it would deform stored data rather than an unsaved sketch.
- Removal likewise widens from creation's "remove the last point placed", which has no meaning on a
  closed outline, to removing any designated boundary point. Preventing removal at three points,
  rather than allowing it and refusing the submission afterwards, is a deliberate addition to the
  literal scope of #209: it keeps the administrator from having to recover from a state the interface
  let them reach. Replacing a corner stays possible by inserting before removing.
- Because the outline is closed from the start, this slice has no equivalent of creation's
  finish-the-outline step (#208 FR-002c) and no first-point control; that is a simplification of the
  interaction, not an omission.
- Concurrent edits resolve as last-write-wins on the warehouse as a whole: there is no field-level
  merge, no per-boundary-point merge, and no optimistic-locking prompt in this slice. The
  administrator is shown the saved result, so a silently stale view is not an acceptable outcome.
- Updating a warehouse is not a lifecycle transition and therefore captures no actor, no comment, and
  no archive or reactivation context; only the last-updated time changes alongside the corrected
  values.
- A warehouse referenced by planned or in-progress discharges, rotations, or shifts may still be
  updated. Those records reference the warehouse by its stable identity, so a correction is reflected
  wherever the warehouse is displayed without any operational record changing, and no usage check
  blocks the update.
- Warehouse doors belong permanently to their warehouse and are positioned within or on its
  footprint (#44). That containment is a domain invariant this slice must preserve, so a reshape
  excluding an existing door is refused (FR-016) rather than silently breaking it. This slice never
  creates, moves, archives, or deletes a door, so a warehouse whose doors block a needed reshape
  stays blocked until door repositioning is delivered by the warehouse-door roadmap (#44); that
  trade-off was accepted deliberately in favour of never storing a door outside its warehouse.
- Door containment is evaluated against every door of the warehouse regardless of lifecycle status,
  since archived doors keep their recorded position and remain consultable inside their warehouse's
  footprint.
- Warehouse records already exist through creation (#208) and the seeded site-reference fixtures, so
  this slice is verifiable against existing data, including warehouses that already have doors.
- The operating organization manages exactly one site, so the administrator's organization determines
  the site scope without an additional site picker.
- The established application language, validation-messaging, focus-management, and accessibility
  conventions apply to the update flow's labels, errors, and confirmations.
- Warehouse consultation (#207), creation (#208), archival (#210), and reactivation (#211) are
  independently deliverable sibling issues and stay outside this slice, as does the update of any
  other site reference type.
