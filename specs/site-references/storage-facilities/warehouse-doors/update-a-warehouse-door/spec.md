# Feature Specification: Update a Warehouse Door

**Feature Branch**: `feat/214-update-warehouse-door`

**Created**: 2026-08-26

**Status**: Draft

**Input**: User description: "Update a Warehouse Door — Let an authorized administrator update a door's mutable identity and GPS location. https://github.com/whazzark/portflow-ai/issues/214"

**Feature ID**: `GH-214`

**GitHub Issue**: [#214](https://github.com/whazzark/portflow-ai/issues/214)

**Parent Roadmap**: `specs/site-references/storage-facilities/warehouse-doors/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct an Available Door's Name and Position (Priority: P1)

As an authorized administrator, I want to rename an available warehouse door and move the point
where trucks stop to unload at it, so that the door operators are guided to matches the physical
reality of the warehouse.

**Why this priority**: This is the core outcome of the slice. Doors were named and placed once at
creation, and they get renumbered after works, re-surveyed, or simply mis-clicked by a few metres.
Without correction the only remedies are archiving the door and recreating it — which breaks the
continuity of the door every shift assignment, product lot assignment, and rotation references — or
leaving trucks guided to the wrong point.

**Independent Test**: Sign in as an authorized administrator, select an available warehouse, select
one of its available doors, activate the door update, change its name, drag its marker to another
point inside the warehouse footprint, and save; verify the door is shown under its new name at its
new coordinates while keeping the same identity, the same containing warehouse, its Available
status, and its creation time.

**Acceptance Scenarios**:

1. **Given** an available door of an available warehouse is selected and the administrator is
   authorized to manage warehouse doors, **When** they activate the door update, **Then** an
   editing state scoped to that door opens, pre-filled with its current name and current
   coordinates, its containing warehouse is shown as fixed, and an explicit way to leave without
   saving is offered.
2. **Given** the door update is active, **When** the administrator submits a different valid name,
   **Then** the door is saved under the new name, the administrator receives explicit confirmation,
   and the door's identity, containing warehouse, position, and Available status are unchanged.
3. **Given** the door update is active, **When** the administrator drags the door's marker to
   another point within or on the boundary of the containing warehouse's footprint and saves,
   **Then** the door is stored at the final dragged position and shown there without requiring a
   manual refresh.
4. **Given** the door update is active, **When** the administrator edits the latitude and longitude
   values directly instead of using the map, **Then** the marker and the coordinate values stay in
   sync and the saved position is the one shown at submission time.
5. **Given** the administrator changes the name and the position in the same submission, **When**
   the update is saved, **Then** both changes take effect together, or neither does.
6. **Given** a door was just updated, **When** any active user consults that warehouse's doors,
   **Then** the door appears in the door collection and on the map with its new name and position,
   its creation time is unchanged, and its last-updated time reflects the change.
7. **Given** the administrator resubmits the door's current name and current coordinates unchanged,
   **When** the update is processed, **Then** it succeeds without reporting a duplicate and the door
   is left in its current state.
8. **Given** the door update is active, **When** the administrator abandons it through its explicit
   cancel action, **Then** the stored name and position are left untouched, the marker returns to
   its stored coordinates, and the warehouse consultation area returns to its normal state.
9. **Given** the door update is active, **When** the administrator clicks elsewhere on the map,
   including on another door's marker or on a warehouse polygon, **Then** the door being updated
   stays the one being updated, no other door is selected, and its edited position is unchanged.
10. **Given** a door was renamed or moved, **When** the shifts, product lot assignments, and
    rotations that reference it are consulted, **Then** they still reference the same door, now
    shown under its corrected name and position.

---

### User Story 2 - Be Prevented From Saving Invalid, Duplicate, or Misplaced Values (Priority: P2)

As an authorized administrator, I want blank, over-long, duplicate, out-of-range, and out-of-
footprint values to be refused with a clear, specific explanation, so that no corrupting change
reaches the door reference and I can correct my mistake without reopening the door.

**Why this priority**: A door's name is how operators and operations leads designate an unloading
point inside a warehouse, and its position is what physically guides a truck. A duplicate name
inside a warehouse makes two unloading points indistinguishable in every selector, and a position
outside the warehouse footprint breaks the containment invariant the whole storage reference relies
on. This matters only once the successful update path exists.

**Independent Test**: On an available door, attempt in turn a blank name, an over-long name, a name
already used by another door of the same warehouse, a name used by an archived door of the same
warehouse, an out-of-range coordinate, a non-numeric coordinate, and a position outside the
containing warehouse's footprint; verify each attempt is refused with a distinct message shown
against the field concerned, the stored door is untouched, and the entered values and the pending
marker position remain on screen for correction.

**Acceptance Scenarios**:

1. **Given** an available door, **When** the administrator submits an empty name or a name made
   only of whitespace, **Then** the update is refused with a message on the name field and the
   stored name is unchanged.
2. **Given** an available door, **When** the administrator submits a name longer than the maximum
   allowed length, **Then** the update is refused with a message on the name field and the stored
   name is unchanged.
3. **Given** another door of the same warehouse already uses a given name, including one differing
   only by letter case or surrounding whitespace, **When** the administrator submits that name,
   **Then** the update is refused as a duplicate with the message shown on the name field, and
   neither door is modified.
4. **Given** an archived door of the same warehouse uses a given name, **When** the administrator
   submits that name for an available door, **Then** the update is still refused as a duplicate,
   because an archived door keeps its name reserved within its warehouse.
5. **Given** a door of a different warehouse uses a given name, **When** the administrator submits
   that name, **Then** the update succeeds, because door-name uniqueness is scoped to the containing
   warehouse.
6. **Given** a submitted name has leading or trailing whitespace but is otherwise valid and unused,
   **When** the update is processed, **Then** the surrounding whitespace is removed and the trimmed
   name is stored with its accepted letter casing preserved.
7. **Given** the administrator drags the marker outside the containing warehouse's footprint, or
   enters coordinates outside it, **When** they submit, **Then** the update is refused with a clear
   message stating the door must lie within or on the boundary of its warehouse's footprint, and the
   stored position is unchanged.
8. **Given** the administrator enters a latitude outside -90 to 90, a longitude outside -180 to 180,
   or a coordinate that is not a number, **When** they submit, **Then** the update is refused with a
   message on the affected coordinate field and the stored position is unchanged.
9. **Given** an update was refused, **When** the administrator corrects the offending value and
   resubmits, **Then** the update succeeds without them having to leave the door update and reopen
   the door, and the name and position they had already produced were never lost.

---

### User Story 3 - Be Blocked From Updating What Must Not Change (Priority: P3)

As the operating organization, I want updates refused for users without warehouse-door management
permission, for archived doors, for doors of archived warehouses, and for doors that no longer
exist, and I want the containing warehouse and the lifecycle status to stay out of reach, so that
authorization, containment, and lifecycle rules stay trustworthy no matter how the update is
attempted.

**Why this priority**: These guard rails protect the integrity of the door reference and must hold
even when the interface is bypassed, but they are exercised far less often than a normal correction.

**Independent Test**: Attempt an update as an unauthenticated visitor, as an authenticated but
inactive user, as an active user without warehouse-door management permission, on an archived door,
on a door of an archived warehouse, on a door identifier that does not exist, and with a submission
carrying another warehouse or another lifecycle status; verify each attempt is refused with the
appropriate outcome and no door data changes.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** a door update is attempted, **Then** it is refused
   using the application's established access-handling behavior and no warehouse-door data is
   exposed or modified.
2. **Given** an authenticated user whose access is not active, or an active user without
   warehouse-door management permission, **When** a door update is attempted, **Then** it is refused
   as unauthorized and the door is unchanged.
3. **Given** an active user without warehouse-door management permission consults a warehouse's
   doors, **When** a door is selected, **Then** no door update action is offered.
4. **Given** an archived door, **When** an administrator attempts to update it, **Then** the update
   is refused because archived doors are read-only, the message states that reactivation is required
   first, and the update action is either not offered or clearly unavailable.
5. **Given** a door whose containing warehouse is archived, **When** an administrator attempts to
   update it, **Then** the update is refused as ineligible and the door is unchanged.
6. **Given** a door identifier that does not exist, **When** an administrator attempts to update it,
   **Then** the update is refused as not found without disclosing information about other doors.
7. **Given** an update submission that also carries another containing warehouse, another lifecycle
   status, or another creation time, **When** it is processed, **Then** those values are refused or
   ignored, and only the name and the position can change.
8. **Given** any refused update, **When** the stored doors are inspected afterwards, **Then** no
   door's name, position, containing warehouse, status, or lifecycle context has changed.

---

### User Story 4 - Recover From Failed Submissions (Priority: P3)

As an authorized administrator, I want a submission that cannot be completed because of a
connectivity or server failure to leave the door exactly as it was, keep my entered name and
adjusted position, and be retryable, so that an interrupted correction never leaves the door in an
ambiguous half-corrected state.

**Why this priority**: A door that silently keeps its old name but its new position — or the
reverse — would be discovered only when a truck is guided to the wrong point, which is far more
costly than the failure itself.

**Independent Test**: Submit a valid door update while the underlying capability fails, verify a
clear retryable failure message with the name and adjusted position preserved and the stored door
unchanged, then resolve the failure and retry to verify the correction is applied exactly once.

**Acceptance Scenarios**:

1. **Given** a valid submission, **When** the request cannot be completed because of a connectivity
   or server failure, **Then** the administrator sees a clear retryable failure message, the stored
   door is entirely unchanged, and the entered name and adjusted position remain.
2. **Given** a failed submission is displayed and the underlying problem is resolved, **When** the
   administrator retries, **Then** the correction is applied exactly once and the door appears under
   its warehouse with its corrected name and position without requiring a new sign-in.
3. **Given** two administrators submit the same new name for two different doors of the same
   warehouse at nearly the same time, **When** both requests are processed, **Then** exactly one
   succeeds and the other receives the duplicate-name refusal with its own entered values intact.

### Edge Cases

- A door archived by another administrator after the update was opened is refused on submission as
  read-only rather than being silently updated.
- The containing warehouse is archived by another administrator after the update was opened — which
  cascades the door into the archived state — and the submission is refused as ineligible.
- The containing warehouse's footprint is reshaped by another administrator after the update was
  opened: containment is evaluated against the footprint stored at submission time, so a position
  that was inside the old outline but outside the new one is refused.
- A door renamed or moved by another administrator after the update was opened is overwritten by the
  submitted values, and the administrator sees the resulting saved state rather than a stale view.
- A door no longer resolvable between opening the update and submitting is refused as not found, and
  the administrator is returned to a consistent view of the warehouse's remaining doors.
- A submitted name whose only difference from the door's stored name is letter case or surrounding
  whitespace is treated as the door's own name, not as a duplicate of itself, and the corrected
  casing is stored.
- A name containing accented, punctuated, or non-Latin characters is accepted as long as it is
  non-blank after trimming and within the maximum length; a name at exactly the maximum length is
  accepted and one character beyond it is refused.
- A name already used by a warehouse, a dock, a weighing area, or a door of another warehouse does
  not block the update, because door-name uniqueness is scoped to the containing warehouse.
- A submission that changes only the name, or only the position, is accepted and does not trigger a
  duplicate refusal against the door's own current name.
- A submission that contains no change at all is accepted and leaves the door in its current state.
- The door is moved exactly onto the containing warehouse's footprint boundary: the update is
  accepted, because the boundary is a valid unloading position.
- The door is moved onto a position already occupied by another door of the same warehouse: the
  update is accepted, because no proximity rule exists between doors and each keeps its own identity.
- The door is moved into a point that also falls inside another, overlapping warehouse's footprint:
  the door stays attached to its own warehouse and the update is accepted, since only its own
  warehouse's footprint constrains it.
- The door is currently assigned to a product lot, planned into a shift, or targeted by an
  in-progress rotation: the update is applied and those records keep referencing the same door, now
  under its corrected name and position; no usage check blocks the update.
- Renaming or moving a door does not rewrite history: report snapshots and other closed records keep
  the name and position captured when they were produced.
- The administrator pans or zooms the map while the update is active: the marker stays anchored to
  its geographic coordinates rather than its prior screen position.
- The administrator activates the door update while the door creation mode is armed, or the reverse:
  at most one map mode stays active, and no pending creation placement leaks into the update.
- The administrator cannot use a pointing device: they can still reposition the door by entering
  latitude and longitude values directly, kept in sync with the marker on the map.
- The map background cannot be displayed while the door and its warehouse footprint are known: the
  update reports map-specific feedback and coordinate entry remains usable, rather than presenting
  the update as unavailable.
- The administrator's warehouse-door management permission is revoked between opening the update and
  submitting: the submission is refused as if they had never been authorized.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated, active user holding warehouse-door management
  permission to update an existing available warehouse door whose containing warehouse is available.
- **FR-002**: The system MUST deny the update to unauthenticated users, to users whose access is not
  active, and to authenticated active users without warehouse-door management permission, without
  changing any door and without disclosing warehouse-door data beyond the application's established
  access-handling behavior.
- **FR-003**: The updatable information of a warehouse door MUST be limited to its name and its GPS
  location; its identity, its containing warehouse, its lifecycle status, its creation time, and its
  lifecycle context MUST NOT be modifiable through this feature.
- **FR-004**: The administrator MUST be able to update the name alone, the position alone, or both
  together in a single submission, and a submission MUST be applied in full or not at all.
- **FR-005**: The system MUST offer the update as an explicit editing state scoped to one selected
  door, pre-filled with that door's current name and current coordinates, reachable only from the
  selected warehouse's existing door consultation context and only by users authorized to perform
  it. This feature MUST NOT introduce a standalone warehouse-door destination or door detail view.
- **FR-005a**: While the door update is active, the interface MUST make the active mode unmistakable
  and MUST offer an explicit way to leave it without saving. A click on the map away from the door
  being corrected — including on another door's marker or on a warehouse polygon — MUST NOT select
  another door, open warehouse details, or switch the update to another door.
- **FR-005b**: At most one warehouse map mode MUST be active at a time; activating the door update
  MUST leave any armed door creation mode and discard its pending placement, and activating door
  creation MUST end a door update in progress without saving it.
- **FR-006**: The system MUST let the administrator reposition the door by dragging its marker on
  the map and by editing its latitude and longitude values directly, with both means kept in sync;
  dragging remains the primary path and coordinate entry the equivalent pointer-free path.
- **FR-007**: The system MUST reject an update whose name is empty or consists only of whitespace.
- **FR-008**: The system MUST reject an update whose name exceeds the maximum site-reference name
  length of 255 characters.
- **FR-009**: The system MUST remove leading and trailing whitespace from the submitted name before
  validating, comparing, and storing it, and MUST preserve the accepted letter casing for display.
- **FR-010**: The system MUST reject an update whose resulting name is already used by another door
  of the same containing warehouse, comparing names without regard to letter case or surrounding
  whitespace and regardless of that other door's lifecycle status.
- **FR-011**: The system MUST accept an update that resubmits the door's own current name and MUST
  NOT report it as a duplicate.
- **FR-011a**: Warehouse-door name uniqueness MUST be evaluated only against the doors of the same
  containing warehouse; a name already used by a door of another warehouse, or by a warehouse, dock,
  weighing area, or any other site reference type, MUST NOT block the update.
- **FR-012**: The system MUST reject an update whose latitude falls outside -90 to 90, whose
  longitude falls outside -180 to 180, or whose coordinate is not a number, identifying the affected
  coordinate.
- **FR-013**: The system MUST reject an update whose resulting position does not lie within or on
  the boundary of the containing warehouse's footprint, with a clear message explaining the
  constraint, and MUST leave the stored position unchanged.
- **FR-013a**: Containment MUST be evaluated against the containing warehouse's footprint as stored
  at submission time, so that a footprint reshaped concurrently is honoured rather than a stale one.
- **FR-014**: A successful update MUST replace the door's name and coordinates with the submitted
  values and MUST preserve the door's stable identity, its containing warehouse, its lifecycle
  status, its creation time, and its existing archive and reactivation context, recording that the
  door was last updated at that moment.
- **FR-015**: The system MUST refuse the update of an archived door and MUST report that the door is
  read-only until it is reactivated.
- **FR-016**: The system MUST refuse the update of a door whose containing warehouse is archived,
  reporting it as ineligible, and MUST re-evaluate that eligibility at submission time.
- **FR-017**: The system MUST refuse the update of a door that does not exist, without disclosing
  information about other doors.
- **FR-018**: A refused update MUST leave the stored door entirely unchanged, including when the
  failure is a connectivity or save failure rather than a validation refusal, and MUST NOT leave a
  door renamed without being moved or moved without being renamed.
- **FR-019**: When two submissions claim the same name within the same warehouse at nearly the same
  time, exactly one MUST succeed and the other MUST receive the duplicate-name refusal.
- **FR-020**: The system MUST make the updated name and position authoritative in every subsequent
  consultation, map rendering, marker label, tooltip, and door selection, without requiring a manual
  page reload.
- **FR-021**: The system MUST preserve every existing reference between the door and the shifts,
  product lot assignments, rotations, and discharges attached to it across an update; those records
  MUST continue to point at the same door, and current or planned usage MUST NOT block the update.
- **FR-022**: The system MUST NOT retroactively alter warehouse-door names or positions already
  captured in immutable report snapshots or other closed historical records.
- **FR-023**: The system MUST report the outcome of an update attempt, distinguishing success,
  validation failure, duplicate name, invalid coordinates, a position outside the containing
  footprint, archived door, archived containing warehouse, door not found, unauthorized access, and
  retryable save failure, with validation, duplicate, and containment outcomes shown against the
  field concerned.
- **FR-024**: The administrator MUST be able to correct a refused submission and resubmit it without
  leaving the door update, with their previously entered name and adjusted position preserved.
- **FR-025**: The administrator MUST be able to abandon an update in progress, leaving the door
  unchanged, restoring the marker to its stored coordinates, and returning the warehouse
  consultation area to its normal state.
- **FR-026**: Authorization, validation, uniqueness, and containment decisions MUST be enforced
  authoritatively by the system regardless of what the user experience offers or hides.
- **FR-027**: This slice MUST NOT create, archive, reactivate, or permanently delete warehouse
  doors, MUST NOT change a door's lifecycle status, MUST NOT move a door to another warehouse, MUST
  NOT update several doors in one submission, MUST NOT change a warehouse's name or footprint, and
  MUST NOT update any other site reference type.

### Key Entities *(include if feature involves data)*

- **Warehouse Door**: A designated unloading door permanently belonging to one warehouse where a
  truck deposits bulk material. It carries a stable identity, a current name, one required GPS
  location, a containing warehouse, a lifecycle status, a creation time, and a last-updated time.
  Only the name and the GPS location are mutable through this feature.
- **Warehouse Door Name**: The human-readable identifier of a door, unique within its containing
  warehouse. Uniqueness is enforced case-insensitively, after trimming, and across both available
  and archived doors of that warehouse; it is independent of the names used in other warehouses and
  by other site reference types.
- **Warehouse Door GPS Location**: The required latitude and longitude of the point where a truck
  stops to unload, which must lie within or on the boundary of the containing warehouse's footprint.
  An update replaces both coordinates together.
- **Containing Warehouse**: The warehouse the door belongs to permanently. It is never changed by
  this feature; it must be available for the door to be updatable, and its stored footprint supplies
  the area the door's resulting position must fall within.
- **Warehouse Door Lifecycle Context**: The archive and most recent reactivation information
  attached to a door, including whether it was archived through its warehouse. It determines whether
  the door may be updated at all and is never modified by an update.
- **Authorized Administrator**: An authenticated, active member of the operating organization whose
  assigned permissions include warehouse-door management; the only actor permitted to perform the
  update.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of update attempts by authorized administrators on
  available doors of available warehouses with valid, unique values succeed, and the corrected name
  and position are visible in consultation within 2 seconds under normal operating conditions
  without a manual reload.
- **SC-002**: In acceptance testing, 100% of update attempts by unauthenticated visitors, non-active
  users, and active users without warehouse-door management permission are refused with no door
  changed, and the update action is not offered to them.
- **SC-003**: In acceptance testing, 100% of attempts to update an archived door, a door of an
  archived warehouse, or a door that does not exist are refused with the corresponding outcome and
  leave stored data unchanged.
- **SC-004**: Across all acceptance datasets, 0% of warehouses contain two doors sharing a name
  under case-insensitive, trimmed, cross-status comparison, including under concurrent submissions
  of the same new name, where exactly one submission succeeds.
- **SC-005**: In acceptance testing, 100% of updates with a blank name, an over-long name, a name
  duplicating another door of the same warehouse, an out-of-range or non-numeric coordinate, or a
  position outside the containing footprint are refused with a message on the field concerned,
  leaving the stored door unchanged and the administrator's entered name and adjusted position
  preserved.
- **SC-006**: Every tested refusal condition — blank name, over-long name, duplicate name, invalid
  coordinate, position outside the footprint, archived door, archived containing warehouse, door not
  found, unauthorized access, and retryable save failure — produces a distinct, understandable
  message, and 100% of retryable failures can be recovered by resubmitting without leaving the door
  update.
- **SC-007**: In 100% of acceptance datasets, updated doors keep their identity, containing
  warehouse, lifecycle status, lifecycle context, and creation time, and 100% of shifts, product lot
  assignments, rotations, and discharges previously referencing an updated door still reference it.
- **SC-008**: In 100% of acceptance datasets, every door still lies within or on the boundary of its
  containing warehouse's footprint after the full set of update attempts has been replayed.
- **SC-009**: In 100% of acceptance tests, a door repositioned by dragging its marker and then
  adjusting its coordinate values is stored at the final position, not at any intermediate one, and
  the coordinate path produces the same stored result as the equivalent map interaction.
- **SC-010**: In 100% of tested interrupted submissions (connectivity or server failure), the stored
  door is unchanged in both name and position, with no half-applied correction, and a retry after
  recovery applies the correction exactly once.
- **SC-011**: At least 90% of representative administrators can locate a door and complete a name
  correction or a repositioning on their first attempt within 90 seconds, without external help.
- **SC-012**: In 100% of tested submissions carrying a different containing warehouse, lifecycle
  status, or creation time, those values are refused or ignored and the stored door keeps its own.

## Assumptions

- "Authorized administrator" means an authenticated user with active access holding the same
  warehouse-door management permission that already governs door creation (#213), and narrower than
  the consultation access every active user has through #212. The server remains authoritative and
  the interface only mirrors that decision.
- The only mutable business information of a warehouse door is its name and its GPS location, as
  stated by #214. Status is not directly editable: archival (#215) and reactivation (#216) are the
  separate slices that change it, and they own their own actor, time, and comment.
- A door belongs permanently to one warehouse (`CONTEXT.md`), so this slice offers no way to move a
  door to another warehouse; a door in the wrong warehouse is archived there and recreated in the
  right one through #215 and #213.
- Door-name uniqueness is scoped to the containing warehouse and spans both available and archived
  doors, compared after trimming and without regard to letter case, matching the rule established by
  #212 and enforced by #213. The maximum name length and whitespace-trimming behavior follow the
  established site-reference name rules.
- Archived doors are read-only; correcting an archived door requires reactivating it first (#216),
  following the rule already applied to warehouses (#209), docks, and weighing areas.
- Archiving a warehouse cascades to its available doors, so an available door always has an
  available warehouse in a consistent state. The containing warehouse's availability is nevertheless
  re-evaluated at submission time so a concurrent warehouse archival is refused rather than raced.
- The position is replaced as a whole: latitude and longitude are submitted together, so there is no
  single-coordinate patch.
- Coordinate validity rules are exactly those enforced at creation (#213): a numeric latitude within
  -90 to 90, a numeric longitude within -180 to 180, and a resulting point within or on the boundary
  of the containing warehouse's footprint, with no proximity rule between doors and no limit on how
  far a door may be moved inside its footprint.
- Containment is evaluated against the containing warehouse's footprint as stored at submission
  time. The reciprocal invariant is already owned by warehouse update (#209), which refuses a
  reshape that would exclude an existing door; this slice never reshapes a footprint.
- The update experience is offered from the same map-based warehouse consultation area introduced by
  #212 and reuses the armed-map-mode pattern established by door creation (#213), acting on the
  selected door rather than on a standalone page or door detail view. Direct coordinate entry stays
  available as a synchronized alternative so the feature remains usable without a pointing device.
- Repositioning is expressed as dragging the door's own marker rather than clicking a new point on
  the map, because a stray click here would move stored data rather than an unsaved placement; the
  click-to-place gesture stays specific to creation (#213).
- Concurrent edits resolve as last-write-wins on the door as a whole: there is no field-level merge
  and no optimistic-locking prompt in this slice. The administrator is shown the saved result, so a
  silently stale view is not an acceptable outcome.
- Updating a door is not a lifecycle transition and therefore captures no actor, no comment, and no
  archive or reactivation context; only the last-updated time changes alongside the corrected values.
- A door referenced by product lot assignments, planned or active shifts, or rotations may still be
  renamed and repositioned. Those records reference the door by its stable identity, so a correction
  is reflected wherever the door is displayed without any operational record changing, and no usage
  check blocks the update. This differs deliberately from warehouse archival, which is blocked by
  usage, because an update removes nothing from the operation.
- One door is updated per submission; bulk renaming or bulk repositioning is out of scope.
- Warehouse-door records already exist through creation (#213) and the seeded site-reference
  fixtures, so this slice is verifiable against existing data, including warehouses holding several
  doors and archived doors reserving a name.
- The operating organization manages exactly one site, so the administrator's organization
  determines the warehouse and warehouse-door scope without an additional site picker.
- The established application language, validation-messaging, focus-management, and accessibility
  conventions apply to the update flow's labels, errors, and confirmations.
- Warehouse-door consultation (#212), creation (#213), archival (#215), and reactivation (#216) are
  independently deliverable sibling issues and stay outside this slice, as does the update of any
  other site reference type.
