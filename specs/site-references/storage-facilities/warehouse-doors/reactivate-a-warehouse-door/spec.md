# Feature Specification: Reactivate a Warehouse Door

**Feature Branch**: `feat/216-reactivate-warehouse-door`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "l'issue 216" — https://github.com/whazzark/portflow-ai/issues/216

**Feature ID**: `GH-216`

**GitHub Issue**: [#216](https://github.com/whazzark/portflow-ai/issues/216)

**Parent Roadmap**: `specs/site-references/storage-facilities/warehouse-doors/roadmap.md`

**Domain**: site-references

## Clarifications

### Session 2026-08-27

- Q: How does a door archived on its own interact with its warehouse's own archival and
  reactivation? → A: Archiving a warehouse archives **every one** of its doors without exception,
  replacing the context of any door already archived on its own with the building's own; reactivating
  a warehouse returns **every one** of them to service. An archived warehouse therefore holds no door
  but doors archived with it, and the door's provenance is read off its warehouse's status rather
  than recorded on the door.

**This supersedes** #210 FR-012 and FR-013 (already-archived doors left untouched; a per-door record
of the archival origin) and #211 FR-007, FR-008, and FR-009 (only the marked doors restored;
independently archived ones left alone; the marker cleared). The `archived_with_warehouse` column
those requirements introduced is dropped by this slice, and the `Warehouse` and `Warehouse Door`
entries in `CONTEXT.md` are amended to state the new rule.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Put One Archived Door Back Into Service (Priority: P1)

As an authorized administrator, I want to reactivate a door of an available warehouse that was
archived on its own, so that the unloading point is offered again when discharges are prepared and
shifts are staffed, without losing the door's identity, its name, its position, or the record of
the period it spent archived.

**Why this priority**: This is the core outcome the slice exists for. Archiving a door on its own
(#215) is reversible in intent but not in practice: a door closed for works, or archived by
mistake, has no way back into the operational selection. Recreating it is impossible — archival
never released its name inside its warehouse — and reactivating the containing warehouse is no
remedy either: the warehouse is available, so there is nothing to reactivate. This slice is the only
path back.

**Independent Test**: Sign in as an authorized administrator, select an available warehouse, open
its archived doors, reactivate one of them with or without a comment, and verify the door becomes
available, keeps its identity, name, position, containing warehouse, and creation time, keeps its
archive record readable beside the new reactivation record, and is offered again wherever doors are
chosen for new operational work.

**Acceptance Scenarios**:

1. **Given** an archived door of an available warehouse that was archived on its own, **When** an
   authorized administrator reactivates it, **Then** its lifecycle status becomes available, the
   reactivating administrator and the reactivation time are recorded, and the reactivation is
   confirmed explicitly.
2. **Given** the administrator supplies a comment while reactivating, **When** the reactivation
   succeeds, **Then** that comment is recorded as the door's reactivation comment and is shown in
   the door's lifecycle context.
3. **Given** the administrator reactivates without supplying a comment, or supplies only
   whitespace, **When** the reactivation succeeds, **Then** the door is reactivated with the
   reactivation time and responsible administrator recorded and no reactivation comment shown.
4. **Given** a door was just reactivated, **When** its warehouse's doors are consulted, **Then** the
   door appears among the available doors and no longer among the archived ones, at its stored
   position on the map, and it no longer presents itself as archived or states how it was archived.
5. **Given** a door was just reactivated, **When** its details are consulted, **Then** its identity,
   name, latitude, longitude, containing warehouse, and creation time are unchanged, and only its
   lifecycle status and reactivation context differ.
6. **Given** a door that was archived with an archive comment, **When** it is reactivated, **Then**
   the record of who archived it, when, and with what comment remains consultable alongside the new
   reactivation record.
7. **Given** a door was just reactivated, **When** an authorized user prepares a discharge, staffs a
   shift, or assigns a product lot, **Then** the door is offered again among the warehouse doors
   available for new operational work.
8. **Given** a door was just reactivated, **When** the shifts, product lot assignments, rotations,
   and discharges recorded against it before archival are consulted, **Then** they still reference
   the same door, now shown as available.
9. **Given** an administrator opens the reactivation confirmation for an archived door, **When**
   they abandon it, **Then** the door remains archived and entirely unchanged, and the warehouse
   consultation area returns to its normal state.
10. **Given** a door is reactivated, **When** the containing warehouse and its other doors are
    inspected, **Then** the warehouse's own lifecycle status and context are untouched and no other
    door of that warehouse has changed status.

---

### User Story 2 - Be Refused With a Specific Reason When a Door Cannot Come Back (Priority: P2)

As an authorized administrator, I want a reactivation refused with a reason I can act on when the
door is already available, no longer exists, or sits under an archived warehouse, so that I know
whether to do nothing, to look elsewhere, or to reactivate the warehouse first.

**Why this priority**: The refusals are what keep the containment rule true — an available door
under an archived warehouse is an operationally invalid state, not merely a confusing display — and
they are what tell an administrator which of the two lifecycles is actually in the way. They matter
only once the successful path exists.

**Independent Test**: Attempt in turn to reactivate an available door, a door identifier that
resolves to nothing, a door belonging to another operating site, and an archived door whose
warehouse is archived; verify each attempt is refused with its own reason, that the
archived-warehouse refusal points at reactivating the warehouse and says the door returns with it,
and that no door and no warehouse changes.

**Acceptance Scenarios**:

1. **Given** a door that is already available, **When** an authorized administrator attempts to
   reactivate it, **Then** the attempt is refused as already available and the door's existing
   lifecycle context is left unchanged.
2. **Given** a door identifier that resolves to no door, or to a door of another operating site,
   **When** an authorized administrator attempts to reactivate it, **Then** the attempt is refused
   as not found, without disclosing information about other doors.
3. **Given** an archived door whose containing warehouse is archived — which means it was archived
   with that warehouse, since a warehouse archival takes every door it holds — **When** an
   authorized administrator attempts to reactivate the door on its own, **Then** the attempt is
   refused, the message directs the administrator to reactivating the containing warehouse and
   states that the door returns with it, and neither the door nor the warehouse changes.
4. **Given** a door was reactivated by another administrator after the confirmation was opened,
   **When** the reactivation is submitted, **Then** it is refused as already available rather than
   recording a second reactivation or overwriting the first one's comment.
5. **Given** the containing warehouse was archived by another administrator after the confirmation
   was opened, **When** the reactivation is submitted, **Then** eligibility is re-evaluated at
   submission time and the attempt is refused as ineligible.
6. **Given** an archived door of an available warehouse whose door is currently referenced by past
   shifts, rotations, or closed discharges, **When** it is reactivated, **Then** the reactivation
   succeeds, because no usage condition blocks a door's return to service.
7. **Given** any refused reactivation, **When** the stored doors and warehouses are inspected
   afterwards, **Then** no lifecycle status and no lifecycle context has changed as a result of
   that attempt.

---

### User Story 3 - Keep Unauthorized and Malformed Reactivations Out (Priority: P3)

As the operating organization, I want reactivation denied to anyone without warehouse-door
management permission and refused when the comment is invalid, and I want an interrupted submission
to leave the door exactly as it was, so that no unloading point is ever returned to service by an
unauthorized actor or as the side-effect of a broken request.

**Why this priority**: Returning a door to service has physical consequences — trucks will be sent
to it — so these guard rails must hold whether the request comes from the interface or is sent
directly. They are exercised far less often than a normal reactivation.

**Independent Test**: Attempt a reactivation as an unauthenticated visitor, as an authenticated but
inactive user, as each active role without warehouse-door management permission, and with an
over-long comment; then submit a valid reactivation while the underlying capability fails and retry
after recovery. Verify every refused attempt leaves the door archived and unchanged, that no
reactivation action was offered to unauthorized users, and that the retry reactivates the door
exactly once.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** a reactivation is attempted, **Then** it is
   refused using the application's established access-handling behavior, no door changes, and no
   warehouse-door data is disclosed.
2. **Given** an authenticated user whose access is not active, or an active user without
   warehouse-door management permission, **When** a reactivation is attempted, **Then** it is
   denied as unauthorized and the door is unchanged.
3. **Given** an active user without warehouse-door management permission consults a warehouse's
   archived doors, **When** the doors are displayed, **Then** no reactivation action is offered on
   any row.
4. **Given** a reactivation whose comment exceeds the maximum lifecycle comment length, **When** it
   is submitted, **Then** it is refused with a specific validation reason, the door stays archived,
   and shortening the comment and resubmitting succeeds without reopening the door.
5. **Given** a valid reactivation, **When** the request cannot be completed because of a
   connectivity or server failure, **Then** the administrator sees a clear retryable failure
   message, the stored door is entirely unchanged, and the entered comment remains available.
6. **Given** a failed reactivation is displayed and the underlying problem is resolved, **When** the
   administrator retries, **Then** the door is reactivated exactly once, with a single reactivation
   time, responsible administrator, and comment.
7. **Given** the administrator's warehouse-door management permission is revoked after the
   confirmation was opened, **When** the reactivation is submitted, **Then** it is denied as if they
   had never been authorized and the door is unchanged.

### Edge Cases

- A door is reactivated by another administrator between the moment the confirmation is opened and
  the moment it is submitted: the second submission is refused as already available rather than
  recording a second reactivation.
- Two administrators submit a reactivation of the same archived door at nearly the same time:
  exactly one reactivation is recorded, and the other submission is refused as already available
  rather than overwriting the first one's reactivation time, actor, or comment.
- The containing warehouse is archived while a door reactivation is in flight: the door never ends
  available under an archived warehouse; the submission is refused or the warehouse archival wins,
  and no state matching neither request is stored.
- The containing warehouse is reactivated while one of its archived doors is being reactivated on
  its own: at most one reactivation context is recorded on that door, and it never ends archived
  under an available warehouse.
- An archived door of an archived warehouse is never reactivated on its own: reactivating the
  warehouse restores it in the same action, which is one step, not two.
- A door archived on its own, whose warehouse is archived afterwards, is taken over by that
  archival — its archive time, actor, and comment are replaced by the building's — and returns to
  service with the building when it is reactivated.
- A door is archived, reactivated, and archived again: each transition is recorded in turn, and the
  most recent one determines the current status and the context shown.
- A reactivation comment consisting only of whitespace is treated as no comment rather than stored
  as a blank comment.
- A reactivation comment longer than the permitted maximum is refused with a specific validation
  reason and the door stays archived.
- Reactivating a door does not affect name uniqueness inside its warehouse, because an archived door
  already held its name reserved there.
- The containing warehouse's footprint was reshaped while the door was archived: the reactivation
  succeeds without re-validating the door's position, because warehouse update already refuses any
  reshape that would exclude an existing door, whatever that door's lifecycle status.
- The door was assigned to a product lot, planned into a shift, or targeted by a rotation before it
  was archived: those records keep pointing at the same door, and none of them is modified by the
  reactivation.
- Report snapshots and other closed historical records that captured the door while it was archived
  are not rewritten by the reactivation.
- The reactivation is confirmed while the door creation mode is armed or a door update is in
  progress: at most one map mode stays active, and no pending placement or unsaved correction leaks
  into the reactivation.
- The map background cannot be displayed while the warehouse and its doors are known: reactivation
  remains available from the door list, because it needs no map interaction.
- A reactivated door immediately stops presenting the "archived with this warehouse" or "archived on
  its own" provenance, even though its archive time and comment remain on record. That provenance is
  read off the containing warehouse's status, so it never contradicts the door's own state.

## Requirements *(mandatory)*

### Functional Requirements

#### Authorization and eligibility

- **FR-001**: The system MUST allow only authenticated, active users holding warehouse-door
  management permission — organization administrators and operations administrators — to reactivate
  an archived warehouse door of their operating site.
- **FR-002**: The system MUST deny reactivation to unauthenticated users, to users whose access is
  not active, and to every active role without warehouse-door management permission, without
  changing any door and without disclosing warehouse-door data beyond the application's established
  access-handling behavior.
- **FR-003**: A warehouse door is eligible for reactivation only when it is currently archived and
  its containing warehouse is available — which is precisely the condition under which it was
  archived on its own. No usage, occupancy, geographic, or naming condition blocks a reactivation.
- **FR-004**: The system MUST refuse the reactivation of a door that is already available, reporting
  it as already available, and MUST leave its existing lifecycle context unchanged.
- **FR-005**: The system MUST refuse the reactivation of an identifier that resolves to no door, or
  to a door of another operating site, reporting it as not found, without modifying any door and
  without disclosing information about other doors.
- **FR-006**: The system MUST refuse the reactivation of a door whose containing warehouse is
  archived, reporting the warehouse as the blocker, and MUST re-evaluate that condition at
  submission time.
- **FR-007**: That refusal MUST state that reactivating the containing warehouse returns this door
  to service with it, in the same action, and MUST NOT direct the administrator to reactivate the
  door afterwards: an archived warehouse holds no door but doors archived with it, so there is no
  second step to perform.
- **FR-008**: The system MUST never leave a door available under an archived warehouse as a result
  of this feature.

#### Recording the reactivation

- **FR-009**: A successful reactivation MUST change the door's lifecycle status from archived to
  available and MUST record the reactivation time, the responsible administrator, and the supplied
  reactivation comment.
- **FR-010**: The system MUST accept an optional reactivation comment, MUST trim surrounding
  whitespace from it, and MUST record no comment when the supplied value is absent, empty, or
  whitespace-only.
- **FR-011**: The system MUST reject a reactivation comment that exceeds the maximum lifecycle
  comment length of 1,000 characters, with a specific validation reason and no lifecycle change to
  the door.
- **FR-012**: A successful reactivation MUST preserve the door's stable identity, name, GPS
  location, containing warehouse, and creation time, changing only its lifecycle status and its
  reactivation context.
- **FR-013**: A successful reactivation MUST preserve the archive context already recorded on the
  door — who archived it, when, and with what comment — so that the full lifecycle history remains
  consultable after the door returns to service.
- **FR-014**: A successful reactivation MUST NOT alter the lifecycle status or lifecycle context of
  the containing warehouse or of any other door.
- **FR-015**: A door MUST be able to move between archived and available repeatedly over its life,
  each transition recorded in turn, with the most recent transition determining the current status
  and the context shown.
- **FR-016**: The system MUST NOT permanently delete a warehouse door.

#### Effects on the rest of the product

- **FR-017**: A reactivated door MUST be included again in its warehouse's available door
  collection and available door count, and in every collection offering warehouse doors for
  selection for new operational work, including discharge preparation, shift staffing, product lot
  assignment, and rotation targeting.
- **FR-018**: The system MUST preserve every existing reference between a reactivated door and the
  product lot assignments, shift door memberships, rotations, and discharges recorded against it; no
  such record may be modified by this feature.
- **FR-019**: The system MUST NOT retroactively alter warehouse-door names, positions, or lifecycle
  states already captured in immutable report snapshots or other closed historical records.
- **FR-020**: After a reactivation succeeds or is refused, the warehouse consultation experience
  MUST reflect the door's authoritative current lifecycle status and context — a reactivated door
  moving to the available doors and no longer presenting its archival provenance — without requiring
  the administrator to leave the warehouse consultation area or reload the page.

#### The reactivation experience

- **FR-021**: The reactivation MUST be offered as an explicit action on one selected archived door,
  reachable from the existing per-warehouse door consultation context, and MUST NOT introduce a
  standalone warehouse-door destination or door detail view.
- **FR-022**: The reactivation MUST require an explicit confirmation that names the door, states
  that the door becomes available again for new operations, and offers an optional comment, using
  the reactivation wording every site reference shares without a door-specific variant.
- **FR-023**: The administrator MUST be able to abandon a reactivation in progress, leaving the door
  unchanged and returning the warehouse consultation area to its normal state.
- **FR-024**: The reactivation action MUST be offered only to users permitted to perform it and only
  on doors eligible for it, while authorization and eligibility decisions remain enforced
  authoritatively by the system regardless of what the user experience offers or hides.
- **FR-025**: At most one warehouse map mode MUST remain active at a time: confirming a reactivation
  MUST NOT carry a pending door placement or an unsaved door correction with it.

#### Integrity of refused and failed attempts

- **FR-026**: A reactivation MUST be recorded in full or not at all: a failure MUST never leave a
  door available without its reactivation time, responsible administrator, and comment.
- **FR-027**: A refused or failed reactivation MUST leave the stored lifecycle status and lifecycle
  context of the door, of its containing warehouse, and of every other door exactly as they were
  before the attempt.
- **FR-028**: The system MUST ensure that repeated or concurrent reactivation attempts for the same
  door result in exactly one recorded reactivation, with every other attempt refused as already
  available.
- **FR-029**: The system MUST report the outcome of a reactivation attempt with distinct,
  understandable, and actionable feedback, distinguishing success, unauthorized access, door not
  found, door already available, archived containing warehouse, comment validation failure, and
  retryable save failure.
- **FR-030**: The administrator MUST be able to correct a refused submission and retry it without
  rebuilding the reactivation, with their entered comment preserved.

#### Out of scope

- **FR-031**: This slice MUST NOT list, create, update, or archive warehouse doors; MUST NOT archive
  or reactivate a warehouse; MUST NOT reactivate several doors in one submission; MUST NOT change a
  door's name, position, or containing warehouse as part of reactivating; MUST NOT permanently
  delete a door; and MUST NOT reactivate any other site-reference type. Those behaviors remain owned
  by separate delivery slices.

### Key Entities *(include if feature involves data)*

- **Warehouse Door**: The unloading door being returned to operational use. Reactivation changes only
  its lifecycle status and reactivation context; its stable identity, name, GPS location, containing
  warehouse, and creation time are preserved.
- **Containing Warehouse**: The warehouse the door belongs to permanently. It is never modified by
  this feature, and it must be available for the door to be eligible, because an available door
  under an archived warehouse is an invalid operational state.
- **Warehouse Door Archival Origin**: Whether an archived door was archived through its warehouse or
  on its own. It is not recorded on the door: a warehouse archival takes every door it holds and its
  reactivation gives every one of them back, so an archived warehouse holds only doors archived with
  it and an available one only doors archived on their own. The containing warehouse's status is
  therefore the origin, and it determines eligibility.
- **Warehouse Door Lifecycle Context**: The archive information already recorded on the door and the
  reactivation information recorded by this feature — reactivation time, responsible administrator,
  and optional comment. Both directions are kept side by side; repeating a direction replaces that
  direction's context rather than accumulating a history log.
- **Reactivation Comment**: The optional free-text explanation attached to the transition, trimmed
  before storage, absent when blank, and limited to 1,000 characters.
- **Authorized Administrator**: An authenticated, active member of the operating organization whose
  assigned permissions include warehouse-door management; the only actor permitted to reactivate a
  door.
- **Operating Site**: The operational scope that owns warehouse and warehouse-door records and bounds
  which doors an authorized administrator may reactivate.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of reactivation attempts by authorized administrators on
  independently archived doors of available warehouses succeed, and the door's available status is
  visible in consultation within 2 seconds under normal operating conditions without a manual
  reload.
- **SC-002**: In 100% of acceptance datasets, a reactivated door keeps its identity, name, latitude,
  longitude, containing warehouse, and creation time; its archive time, actor, and comment remain
  readable beside the new reactivation context; and 0% of doors are permanently deleted.
- **SC-003**: In acceptance testing, 100% of attempts to reactivate a door that is already
  available, a door that does not exist, a door of another operating site, or a door whose containing
  warehouse is archived are refused with the corresponding reason and leave stored data unchanged.
- **SC-004**: Across every tested path, 0% of runs leave a door available under an archived
  warehouse, and 100% of the archived-warehouse refusals name the warehouse's own reactivation as the
  single remedy.
- **SC-005**: In acceptance testing, 100% of reactivation attempts by unauthenticated visitors,
  non-active users, and active users without warehouse-door management permission are denied with
  zero lifecycle changes, and no reactivation action is offered to them.
- **SC-006**: In acceptance testing, 100% of reactivations carrying an over-long comment are refused
  with a specific validation reason and zero doors changed, and shortening the comment and
  resubmitting succeeds without reopening the door.
- **SC-007**: In acceptance testing, 100% of reactivations submitted without a comment, or with a
  whitespace-only comment, are recorded with a reactivation time and responsible administrator and
  no stored comment.
- **SC-008**: Across concurrent-submission acceptance scenarios where the same door is reactivated
  by two administrators at nearly the same time, exactly one reactivation is recorded in 100% of
  runs, with zero lifecycle contexts overwritten and every other submission refused as already
  available.
- **SC-009**: In 100% of tested interrupted submissions (connectivity or server failure), the stored
  door is unchanged, no door is left available without its complete reactivation context, and a
  retry after recovery reactivates the door exactly once.
- **SC-010**: In 100% of acceptance datasets, product lot assignments, shift door memberships,
  rotations, and discharges previously attached to a reactivated door remain attached to that same
  door, and the door appears again in every collection offering doors for new operational work.
- **SC-011**: In 100% of acceptance datasets, a door archived, reactivated, and archived again
  carries only the most recent transition of each direction, and its current status always matches
  its most recent transition.
- **SC-012**: Every tested refusal condition — unauthorized access, door not found, already
  available, archived containing warehouse, over-long comment, and retryable save failure — produces
  a distinct and accurate message that names the remedy, and
  100% of retryable failures can be recovered without rebuilding the reactivation.
- **SC-013**: At least 90% of representative authorized administrators can locate an archived door
  inside a warehouse and complete its reactivation on their first attempt within 60 seconds, without
  external help, and can correctly state from the refusal message when a warehouse must be
  reactivated first.

## Assumptions

- "Authorized administrator" means an authenticated user with active access holding the same
  warehouse-door management permission that already governs door creation (#213) and door update
  (#214) — organization administrators and operations administrators. Door consultation itself
  remains open to every active user through List Warehouse Doors (#212), so archived doors stay
  readable to all active users rather than to administrators only.
- Each operating organization owns exactly one site, so the administrator's organization determines
  which doors they may reactivate, without an additional site picker.
- Reactivation is the exact mirror of door archival (#215) and reuses its shape: same authorization,
  same optional comment model with the same 1,000-character limit, same all-or-nothing recording,
  same refusal vocabulary. Only the eligibility direction and the blocker set differ.
- This slice reactivates one door per submission. Unlike the map-selected site references —
  customers, docks, weighing areas, trucks, transport companies, and warehouses — doors are consulted
  as a list scoped to one selected warehouse, where lifecycle actions already belong to the per-row
  administration menu beside `Edit`. A bulk door selection has no surface to live on today and no
  operational driver: doors are archived and reactivated one at a time, or in bulk through their
  warehouse, which #210 and #211 already deliver. Bulk door reactivation is therefore deliberately
  out of scope rather than overlooked.
- Eligibility is exactly "archived, containing warehouse available", and that second condition is
  what "archived on its own" means. Nothing on the door records the origin, because #210's cascade
  takes every door of the warehouse and #211's restore gives every one of them back: an archived
  warehouse holds no independently archived door to tell apart. The refusal therefore has one
  wording and one remedy, which FR-007 states.
- Reactivation has no usage-based blocker, mirroring warehouse reactivation (#211). An archived door
  holds no current product lot assignment belonging to a planned or active discharge by
  construction, so the `IN_USE` reason that blocks archival cannot arise on this path.
- Reactivation has no geographic blocker either. Warehouse update (#209) refuses any footprint
  reshape that would leave an existing door outside the new outline, whatever that door's lifecycle
  status, so a door's stored position is still inside its warehouse's footprint when it returns to
  service and needs no re-validation.
- Reactivating a door has no effect on name uniqueness: door names are unique within their
  containing warehouse across both lifecycle states (#212 FR-006a, enforced by #213 and #214), and
  archival never released the name, so no duplicate can surface at reactivation time.
- Concurrency is resolved on the door itself with no optimistic-locking prompt: the first submission
  to reach a given door reactivates it, and every other concurrent submission sees it as already
  available. The containing warehouse's availability is re-read at submission time so a concurrent
  warehouse archival is refused rather than raced.
- Reactivation records its own lifecycle context and preserves the archive context recorded by #215
  or by the warehouse cascade; the two directions are kept side by side so a door's full lifecycle
  remains consultable. Repeating a direction replaces that direction's context rather than
  accumulating a history log.
- Consultation of a door's lifecycle is gated on its current status rather than on the presence of
  an archive timestamp alone, as already established by #210 and honoured by the Doors panel:
  reactivation leaves the archive context on record, and a restored door must stop presenting its
  archival provenance.
- This slice reuses the map-based warehouse consultation area and its per-warehouse Doors panel,
  introduced by #212 and extended by #213 and #214, as the surface the reactivation is triggered
  from. The per-row administration menu was deliberately introduced empty by #214 so that archival
  (#215) and reactivation (#216) arrive as entries beside `Edit` rather than as a restructuring of
  the panel.
- The confirmation names the door alone, not its containing warehouse. The shared reactivation
  wording states the effect on the named record, and the Doors panel the confirmation is opened
  from is already scoped to one selected warehouse, so repeating the warehouse would be redundant.
  Unlike warehouse archival and reactivation, which override the shared sentence to announce their
  door cascade, this slice has nothing extra to say and uses the canonical wording unchanged.
- A door of an archived warehouse offers no lifecycle action at all rather than a disabled one or an
  explanatory entry, following the "absent, not disabled" rule the per-row menu already applies. The
  row's own archival-provenance line — "Archived with this warehouse", derived from the warehouse's
  status — is what tells the administrator why, and reactivating the warehouse is the remedy.
- Reactivating a door is a lifecycle transition, not a correction: it captures an actor, a time, and
  an optional comment, and it changes nothing else. Correcting a door's name or position stays
  owned by #214 and requires the door to be available first.
- Available and archived remain the only warehouse-door lifecycle states. Reactivation never deletes
  data, and permanent deletion of a door is out of scope for this and every current storage-facility
  slice.
- Both `CONTEXT.md` entries change with this slice. The `Warehouse` entry stated that archival
  spared already-archived doors and that reactivation restored only the marked ones; it now states
  that both directions take every door of the warehouse. The `Warehouse Door` entry records that a
  door is archived and returned to service on its own only while its warehouse is available.
- API authorization and eligibility checks are authoritative for every rule in this specification;
  any interface-level restriction is a courtesy that does not replace server-side enforcement.
- The established application language, validation-messaging, focus-management, and accessibility
  conventions apply to the reactivation confirmation, its comment field, and its outcome reporting.
- Archive a Warehouse Door (#215) is recorded as a blocking dependency and is the only production
  path that produces an independently archived door; List Warehouse Doors (#212), the other recorded
  dependency, is delivered. Warehouse archival (#210) produces the archived doors this slice refuses,
  so the refusal paths are verifiable today while the success path lands with or after #215.
- List Warehouse Doors (#212), Create a Warehouse Door (#213), Update a Warehouse Door (#214), and
  Archive a Warehouse Door (#215) are independently deliverable sibling issues and stay outside this
  slice, as do warehouse archival and reactivation (#210, #211) and the reactivation of any other
  site-reference type.
