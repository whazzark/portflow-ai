# Feature Specification: Suspend a Truck From Service

**Feature Branch**: `feat/252-suspend-truck`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Let an authorized administrator mark an available truck temporarily out of service. https://github.com/whazzark/portflow-ai/issues/252"

**Feature ID**: `GH-252`

**GitHub Issue**: [#252](https://github.com/whazzark/portflow-ai/issues/252)

**Parent Roadmap**: `specs/site-references/transport-resources/trucks/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Take a Truck Out of Service Without Retiring It (Priority: P1)

As an organization administrator or operations administrator, I want to mark an available truck temporarily out of service — because it broke down, entered a maintenance slot, or was called in for a technical inspection — so that it stops being offered for new operational work while it remains a live site reference under the same identity, the same registration, and the same transport company, ready to come back in days.

**Why this priority**: The site has no way to express a temporary immobilization today. The only lever is archival, which is the administrative retirement of a reference and is already being misused for this purpose in delivered data (`apps/api/database/fixtures/trucks.ts` archives a truck with the comment `"Vehicle temporarily suspended for fleet maintenance"`). Archiving a broken-down vehicle overstates what happened, pollutes the archived collection meant for retired references, and forces an administrative reactivation to undo a purely operational pause. This is the primary outcome of the slice.

**Independent Test**: Sign in as an organization administrator or operations administrator, suspend an available truck, and verify the truck leaves the available collection and every collection offering trucks for new operational work, appears as suspended rather than archived, keeps its stable identity, registration, vehicle model, capacity, and transport company, and shows its suspension time, responsible administrator, and comment.

**Acceptance Scenarios**:

1. **Given** an available truck, **When** an organization administrator suspends it, **Then** the truck becomes suspended, disappears from the available truck collection, and is no longer offered for selection for new operational work.
2. **Given** an operations administrator suspends an available truck, **When** the truck's details are opened by an authorized administrator, **Then** the suspension time, the responsible administrator, and the suspension comment when one was supplied are shown.
3. **Given** an administrator suspends a truck without supplying a comment, **When** the suspension completes, **Then** the truck is suspended with the suspension time and responsible administrator recorded and no comment shown.
4. **Given** a truck is suspended, **When** its details are reviewed, **Then** its stable identity, registration, vehicle model, capacity, and current transport company are unchanged by the suspension.
5. **Given** a truck is suspended, **When** the archived truck collection is consulted, **Then** the suspended truck is absent from it and any archive context left by an earlier archival is untouched.
6. **Given** a truck is suspended, **When** any active user consults trucks, **Then** the truck is presented as temporarily out of service and is distinguishable from both an available truck and an archived truck.

---

### User Story 2 - Stop New Work Without Disturbing Work Already Under Way (Priority: P1)

As an organization administrator or operations administrator, I want to record a suspension the moment a vehicle goes down — even while it is assigned to a planned or active discharge, and even while it is mid-rotation — so that the truck stops being offered for anything new without cancelling, releasing, or rewriting the work it is already part of.

**Why this priority**: A truck breaks down precisely because it is in service. If suspension were refused while the vehicle is assigned to a discharge, an administrator would first have to unassign it — the exact workaround this slice exists to remove, and one that would destroy the traceable assignment history. Suspension is a forward-looking gate on new work, not a retroactive erasure, and that distinction has to hold from the first delivery.

**Independent Test**: Suspend a truck assigned to a planned discharge, a truck assigned to an active shift, and a truck with an in-progress rotation; verify each suspension succeeds, that every existing discharge and shift assignment survives intact, that the in-progress rotation can still be carried through to completion, and that none of the three trucks is offered for a new discharge assignment, a new shift assignment, or a new rotation.

**Acceptance Scenarios**:

1. **Given** an available truck assigned to a planned discharge, **When** an authorized administrator suspends it, **Then** the suspension succeeds and the discharge keeps the truck assignment, its captured registration, and its captured transport company unchanged.
2. **Given** an available truck assigned to an active shift, **When** an authorized administrator suspends it, **Then** the suspension succeeds and the shift keeps its assigned resources, so its minimum-resource requirement is not violated by the suspension.
3. **Given** a truck with an in-progress rotation, **When** an authorized administrator suspends it, **Then** the suspension succeeds and that rotation can still be loaded, weighed, deposited, and completed by its empty return confirmation under the rules already governing it.
4. **Given** a suspended truck whose in-progress rotation is being completed, **When** the operations lead confirms the empty return with a continuation that would start the truck's next rotation, **Then** the continuation is refused because a suspended truck is not rotation-eligible, while completing the rotation without continuation succeeds.
5. **Given** a suspended truck assigned to an active shift, **When** an operations lead chooses a truck for a new rotation, **Then** the suspended truck is not offered.
6. **Given** a suspended truck, **When** an operations administrator prepares a new discharge or a new shift, **Then** the suspended truck is not offered for assignment.
7. **Given** a truck is suspended, **When** its past discharges, rotations, downtimes, and reports are consulted, **Then** they reference the same truck with no duplicate vehicle created and no historical value altered.

---

### User Story 3 - Keep Suspension Authorized and Consistent With the Truck Lifecycle (Priority: P1)

As the system, I want to accept a suspension only from an authorized administrator, only on a truck of their own operating site, and only on a truck that is currently available, so that a temporary out-of-service state never overwrites an archival, never applies twice, and never becomes a way around the archival rules.

**Why this priority**: Suspension introduces a third lifecycle state alongside available and archived. Without an explicit rule for every source state and every actor, the site would immediately face ambiguous records — a truck both archived and suspended, a suspension recorded twice with conflicting comments, or an operations lead removing a colleague's vehicle from service. The state is only useful if its entry conditions are exact from the first delivery.

**Independent Test**: Attempt suspension as an unauthenticated visitor, as each non-administrator active role, on a truck that is already suspended, on an archived truck, and on an unknown truck; verify every attempt is refused, no truck changes lifecycle state, and each refusal states a specific, actionable reason.

**Acceptance Scenarios**:

1. **Given** a user who is unauthenticated or whose access is not active, **When** they attempt to suspend a truck, **Then** the attempt is denied, the truck keeps its lifecycle state, and no truck data is disclosed.
2. **Given** an active operations lead or observer, **When** they attempt to suspend a truck, **Then** the attempt is denied and the truck stays available, even though they may consult available trucks.
3. **Given** a truck that is already suspended, **When** an authorized administrator attempts to suspend it, **Then** the attempt is refused as already suspended and its existing suspension time, actor, and comment are left unchanged.
4. **Given** an archived truck, **When** an authorized administrator attempts to suspend it, **Then** the attempt is refused, the truck stays archived, and the reason states that the truck must be reactivated before it can be suspended.
5. **Given** a truck that no longer exists or belongs to another operating site, **When** an authorized administrator attempts to suspend it, **Then** the attempt is refused as not found and no other truck is modified.
6. **Given** a suspended truck, **When** an authorized administrator attempts to archive it, **Then** the archival rules are unchanged by this slice and the archival is refused because the truck is not available.

---

### User Story 4 - Understand and Recover From a Refused Suspension (Priority: P2)

As an organization administrator or operations administrator, I want each refused or failed suspension to explain itself and leave a safe retry path so that I can tell an authorization refusal from a lifecycle conflict, a stale view, a validation failure, or a temporary outage, and act on it without leaving a truck in an unclear state.

**Why this priority**: A suspension is usually recorded under time pressure, right after a breakdown is reported. If a refusal is opaque, the administrator either retries blindly or walks away believing a vehicle is out of service when it is still being offered for new work — the exact operational mistake the state exists to prevent.

**Independent Test**: Trigger an already-suspended conflict, an archived-truck conflict, a stale-view conflict, an over-long comment, and a transient failure in turn; verify each produces distinct guidance, the truck's lifecycle state is never left ambiguous, and retrying after the blocking condition is resolved suspends the truck exactly once.

**Acceptance Scenarios**:

1. **Given** an administrator is viewing an available truck that another administrator suspended in the meantime, **When** the administrator submits a suspension, **Then** the attempt is refused as already suspended and the refreshed view shows the truck's authoritative suspended state and suspension context.
2. **Given** a suspension comment longer than the permitted maximum length, **When** the administrator submits it, **Then** the attempt is refused with a specific validation reason and the truck stays available.
3. **Given** a suspension fails because the underlying service is temporarily unavailable, **When** the administrator retries after the service recovers, **Then** the truck is suspended exactly once with a single suspension time, actor, and comment.
4. **Given** a suspension is submitted twice in quick succession for the same truck, **When** both submissions are processed, **Then** the truck is suspended exactly once and the later attempt is refused as already suspended.
5. **Given** a suspension is refused for any reason, **When** the administrator reviews the truck, **Then** the truck's displayed lifecycle state matches its authoritative stored state, with no partial suspension context recorded and its existing lifecycle context intact.

### Edge Cases

- An unauthenticated visitor or a user whose access is not active is denied suspension without revealing whether the referenced truck exists.
- An authorized administrator attempts to suspend a truck belonging to another operating site: the attempt is refused and that truck is not disclosed or modified.
- A truck is archived by another administrator between the moment the suspension is opened and the moment it is submitted: the suspension is refused with a current, actionable archived-truck reason.
- Two administrators suspend the same available truck at nearly the same time: exactly one suspension is recorded and the other attempt is refused as already suspended, with no suspension context overwritten.
- A truck is suspended while it is the only truck assigned to an active shift: the suspension succeeds and the shift keeps its assignment, but no new rotation can start for that truck; the shift's resource composition is changed only through shift preparation, which this slice does not touch.
- A truck is suspended between its loaded weighing and its deposit: the rotation continues to its empty return confirmation, and a continuation that would open the next rotation is refused.
- A truck's in-progress rotation records a capacity exceedance while the truck is suspended: the exceedance rules are unchanged, and the truck must still return to the dock and be weighed again before it may deposit.
- A truck that was suspended, returned to service, and suspended again keeps only its latest suspension context; the truck's identity and history are unaffected.
- A truck that was archived and reactivated in the past is suspended: its earlier archive and reactivation context remain readable as history and are not replaced by the suspension context.
- A suspended truck keeps its registration reserved, so no other truck can take that plate while the vehicle is out of service and no registration conflict can arise when it returns.
- A suspension comment containing only whitespace is treated as no comment rather than stored as a blank comment.
- A suspension comment longer than the permitted maximum length is refused with a specific validation reason and the truck stays available.
- A suspended truck cannot be returned to service through this slice; until Return a Truck to Service (`#253`) is delivered, suspension is a one-way transition in the product.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST introduce a third truck lifecycle state, suspended, meaning the truck is temporarily out of service while remaining a live site reference, distinct from both available and archived.
- **FR-002**: The system MUST allow only active organization administrators and operations administrators to suspend a truck belonging to their operating site.
- **FR-003**: The system MUST deny suspension to unauthenticated users and to every active role other than organization administrator and operations administrator, without changing any truck and without disclosing truck data.
- **FR-004**: The system MUST refuse suspension of a truck that does not exist or that belongs to another operating site, without modifying any truck.
- **FR-005**: The system MUST refuse suspension of a truck that is already suspended, and MUST leave its existing suspension time, actor, and comment unchanged.
- **FR-006**: The system MUST refuse suspension of an archived truck, MUST leave it archived, and MUST state that the truck must be reactivated before it can be suspended.
- **FR-007**: The system MUST assess the truck's lifecycle state at the moment suspension is submitted rather than at the moment the truck was opened for review.
- **FR-008**: A successful suspension MUST change the truck's lifecycle status from available to suspended and MUST record the suspension time, the responsible administrator, and the supplied suspension comment.
- **FR-009**: The system MUST accept an optional suspension comment, MUST trim surrounding whitespace from it, and MUST record no comment when the supplied value is absent, empty, or whitespace-only.
- **FR-010**: The system MUST reject a suspension comment that exceeds the permitted maximum length, with a specific validation reason and no lifecycle change.
- **FR-011**: A successful suspension MUST preserve the truck's stable identity, registration, vehicle model, capacity, transport-company relationship, and any earlier archive or reactivation context.
- **FR-012**: A suspended truck MUST keep its registration reserved so that no other truck may take that registration while the vehicle is out of service.
- **FR-013**: A suspended truck MUST be excluded from the available truck collection, from the available truck count, and from every collection offering trucks for selection for new operational work.
- **FR-014**: A suspended truck MUST NOT appear in the archived truck collection or the archived truck count.
- **FR-015**: A suspended truck MUST remain readable through truck consultation, presented as temporarily out of service and distinguishable from an available truck and from an archived truck, with its suspension context available to authorized administrators.
- **FR-016**: The disclosure of suspended trucks and their suspension context to active roles other than organization administrator and operations administrator MUST follow the truck visibility rules already established for truck consultation, extended so that operational users can tell why a truck they previously used is no longer offered.
- **FR-017**: The system MUST NOT refuse a suspension because the truck is assigned to a planned or active discharge, is assigned to an active shift, or has an in-progress rotation; suspension gates new operational use only.
- **FR-018**: A successful suspension MUST leave every existing discharge truck assignment, shift assignment, and in-progress rotation in place, with their captured registration and transport company unchanged, and MUST NOT release, cancel, alter, or replay any past discharge assignment, shift assignment, rotation, downtime, or report referencing the truck.
- **FR-019**: An in-progress rotation belonging to a truck suspended mid-rotation MUST remain completable through loading, loaded weighing, deposit, and empty return confirmation under the rules already governing it.
- **FR-020**: A suspended truck MUST NOT be rotation-eligible, MUST NOT be selectable for a new discharge assignment, a new shift assignment, or a new rotation, and MUST NOT be started into a next rotation by a continuation accompanying an empty return confirmation.
- **FR-021**: The system MUST report authorization refusals, not-found refusals, already-suspended conflicts, archived-truck conflicts, validation failures, and transient failures with distinct, understandable, and actionable feedback.
- **FR-022**: The system MUST ensure that repeated or concurrent suspension attempts for the same truck result in exactly one recorded suspension, with every later attempt refused as already suspended.
- **FR-023**: A refused or failed suspension MUST leave the truck's stored lifecycle state and lifecycle context exactly as they were before the attempt.
- **FR-024**: After a suspension succeeds or is refused, the truck consultation experience MUST reflect the truck's authoritative current lifecycle state and context without requiring the administrator to leave the consultation context.
- **FR-025**: The suspension action MUST be offered only for trucks the administrator is permitted to suspend, while server-side authorization remains authoritative.
- **FR-026**: The system MUST suspend one truck per action; submitting several trucks for suspension in a single action is out of scope for this slice.
- **FR-027**: This slice MUST NOT return a suspended truck to service, and MUST NOT archive, reactivate, permanently delete, update, or create trucks; the reverse transition and the archival lifecycle remain owned by separate delivery slices with their own unchanged rules.
- **FR-028**: This slice MUST NOT change shift preparation, shift resource changes, discharge assignment, or rotation rules beyond excluding suspended trucks from new operational use.

### Key Entities *(include if feature involves data)*

- **Truck**: The vehicle being taken temporarily out of service. Suspension changes only its lifecycle status and suspension context; its stable identity, registration, vehicle model, capacity, and transport-company relationship are preserved, and its registration stays reserved.
- **Truck Lifecycle State**: The operational condition of a truck, now one of available, suspended, or archived. Available means selectable for new work; suspended means temporarily out of service but still a live reference; archived means administratively retired.
- **Truck Suspension Context**: The out-of-service information recorded by this feature — suspension time, responsible administrator, and optional comment — held alongside, and never replacing, the truck's existing archive and reactivation context.
- **Discharge Truck Assignment**: The existing reservation of a truck for one discharge. Suspension never creates, releases, or alters one; it only prevents new ones from being made with a suspended truck.
- **Rotation-Eligible Truck**: The existing notion of a truck that may start a rotation. Suspension removes a truck from eligibility without interrupting a rotation already in progress.
- **Authorized Administrator**: An active organization administrator or operations administrator permitted to suspend a truck at their operating site.
- **Operating Site**: The operational scope that owns truck records and bounds which trucks an authorized administrator may suspend.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of suspension attempts by organization administrators and operations administrators on available trucks succeed, and the truck is absent from available consultation and from every selection collection for new work immediately afterward.
- **SC-002**: In acceptance testing, 100% of suspension attempts by unauthenticated users and by active roles other than organization administrator and operations administrator are denied with zero lifecycle changes.
- **SC-003**: In acceptance testing, 100% of suspension attempts on already-suspended and on archived trucks are refused with the truck's existing lifecycle state and context left unchanged and a specific reason shown.
- **SC-004**: In acceptance testing, 100% of suspended trucks retain their identity, registration, vehicle model, capacity, transport-company relationship, reserved registration, and historical discharge, rotation, downtime, and report references unchanged, and 100% of successful suspensions record a suspension time and responsible administrator.
- **SC-005**: In acceptance testing, 100% of suspensions of trucks assigned to a planned discharge, to an active shift, or holding an in-progress rotation succeed, with 0% of those assignments released or altered and 100% of those in-progress rotations completable to their empty return confirmation.
- **SC-006**: In acceptance testing, 0% of suspended trucks are offered for a new discharge assignment, a new shift assignment, or a new rotation, including through a continuation accompanying an empty return confirmation, across every tested combination of discharge and shift state.
- **SC-007**: In all acceptance datasets, repeated and near-simultaneous suspension attempts on the same truck produce exactly one recorded suspension, with zero suspension contexts overwritten by a refused attempt.
- **SC-008**: Every tested authorization, not-found, already-suspended, archived-truck, validation, and transient-failure condition produces distinct and accurate feedback, and every transient failure can be recovered through a retry that suspends the truck exactly once.
- **SC-009**: In acceptance testing, 100% of suspended trucks are presented as temporarily out of service and are distinguishable from available and archived trucks by every role permitted to see them, and 0% appear in the archived collection or archived count.
- **SC-010**: At least 90% of representative authorized administrators can suspend an intended truck, or understand why they cannot, on their first attempt within 45 seconds of opening the truck, and correctly identify the suspension as reversible rather than as a retirement.

## Assumptions

- "Authorized administrator" means an active organization administrator or an active operations administrator, matching the truck write-access pattern established by Create a Truck (`#223`), Update a Truck (`#224`), Archive a Truck (`#225`), and Reactivate a Truck (`#226`).
- Suspension is entered only from the available state. An archived truck must first be reactivated, because archival and reactivation keep their own rules and are explicitly untouched by this issue.
- Because archival rules are untouched, a suspended truck cannot be archived directly: archival still requires an available truck. An administrator wanting to retire a suspended vehicle returns it to service first, through Return a Truck to Service (`#253`).
- The reverse transition — returning a suspended truck to service — is out of scope and is owned by Return a Truck to Service (`#253`). This slice therefore delivers a state a truck can enter but not yet leave through the product; that is the accepted boundary recorded on the issue.
- Suspension gates new operational use only. It is never refused because of existing involvement, and it never unwinds that involvement: a broken-down truck can be marked out of service at the moment it goes down, which is the operational reality the state exists to record.
- A truck suspended mid-rotation finishes that rotation. Continuation is the one exception, because a continuation opens the truck's next rotation and a suspended truck is not rotation-eligible; the empty return confirmation without continuation remains available and completes the rotation.
- Suspension does not change an active shift's resource composition, so the standing rule that an active shift retains at least one truck, warehouse door, and weighing area is unaffected. A shift whose assigned trucks are all suspended simply cannot start new rotations; adjusting its resources remains the job of shift preparation and shift resource changes, which this slice does not touch.
- The suspension comment is optional free text, consistent with the archive and reactivation comments; its maximum length matches the existing site-reference lifecycle comment limit. It carries the reason a vehicle went down — a breakdown, a maintenance slot, a technical inspection — without constraining it to a fixed list.
- Suspended trucks remain visible to every role that can already consult available trucks, because a suspended truck is a live site reference and operational users need to understand why a vehicle they used yesterday is no longer offered. Suspension context detail follows the same disclosure rules as other lifecycle context.
- Suspended trucks are excluded from the archived collection and the archived count, because suspension is not retirement; they form their own lifecycle view in the truck consultation workspace alongside available and archived.
- A suspended truck keeps its registration reserved, exactly as an archived truck does, so a returning vehicle can never collide with a registration taken in its absence.
- Suspension is a one-truck-at-a-time action in this slice, unlike archival and reactivation, because it records a per-vehicle incident. A multiple suspension is deliberately excluded and would be a separate issue if a batch maintenance workflow proves it necessary.
- The truck consultation workspace already exposes lifecycle views, a transport-company filter, and a lifecycle action area, all delivered by List Trucks (`#222`), Archive a Truck (`#225`), and Reactivate a Truck (`#226`); this slice extends them rather than introducing them.
- A truck may cycle between available and suspended any number of times, each cycle replacing the previous suspension context while leaving archive and reactivation context untouched as history.
- The new lifecycle state receives its own `CONTEXT.md` glossary entry, as required by the issue and by the constitution's rule that domain vocabulary belongs in `CONTEXT.md`. The existing `Available Site Reference`, `Archived Resource`, `Truck`, and `Rotation-Eligible Truck` entries are revised to account for a third state.
- The delivered fixture that archives a truck with the comment `"Vehicle temporarily suspended for fleet maintenance"` is expected to move to the new suspended state, so seeded data stops modelling a maintenance pause as a retirement.
- Each operating organization owns exactly one site, so the administrator's organization determines which trucks they may suspend.
- API authorization and lifecycle checks are authoritative for every rule in this specification; any interface-level restriction is a courtesy that does not replace server-side enforcement.
- This slice depends on List Trucks (`#222`) and on the delivered truck lifecycle slices; permanent deletion of a truck remains out of scope for every current truck slice.
