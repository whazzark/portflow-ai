# Feature Specification: Return a Truck to Service

**Feature Branch**: `feat/253-return-service-truck`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Let an authorized administrator return a suspended truck to service, restoring its eligibility for new discharge assignments, shift assignments, and rotations. https://github.com/whazzark/portflow-ai/issues/253"

**Feature ID**: `GH-253`

**GitHub Issue**: [#253](https://github.com/whazzark/portflow-ai/issues/253)

**Parent Roadmap**: `specs/site-references/transport-resources/trucks/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Put a Repaired Truck Back Into Service (Priority: P1)

As an organization administrator or operations administrator, I want to return a suspended truck to service once the breakdown is repaired, the maintenance slot is over, or the technical inspection has passed, so that the vehicle is offered again for new discharges, new shift assignments, and new rotations under the same identity, the same registration, and the same transport company.

**Why this priority**: Suspend a Truck From Service (`#252`) delivered a state a truck can enter but not leave. Today a temporarily immobilised vehicle is stuck: it cannot be returned to service, cannot be archived, cannot be updated, and cannot be reactivated. Every truck suspended since that slice shipped is waiting on this transition, so restoring availability is the whole point of the slice and its only primary outcome.

**Independent Test**: Sign in as an organization administrator or operations administrator, return a suspended truck to service, and verify the truck leaves the suspended collection, rejoins the available collection and the available count, is offered again for new operational work, keeps its stable identity, registration, vehicle model, capacity, and transport company, and shows its return time, responsible administrator, and comment.

**Acceptance Scenarios**:

1. **Given** a suspended truck, **When** an organization administrator returns it to service, **Then** the truck becomes available, appears in the available truck collection and the available truck count, and is offered again for selection for new operational work.
2. **Given** an operations administrator returns a suspended truck to service, **When** the truck's details are opened by an authorized administrator, **Then** the return time, the responsible administrator, and the return comment when one was supplied are shown.
3. **Given** an administrator returns a truck to service without supplying a comment, **When** the return completes, **Then** the truck is available with the return time and responsible administrator recorded and no comment shown.
4. **Given** a truck is returned to service, **When** its details are reviewed, **Then** its stable identity, registration, vehicle model, capacity, and current transport company are unchanged by the return.
5. **Given** a truck is returned to service, **When** the suspended truck collection is consulted, **Then** the truck is absent from it and it does not appear in the archived truck collection or archived count either.
6. **Given** a truck is returned to service, **When** an authorized administrator reviews it, **Then** the suspension that has just ended remains readable as history alongside the return, and any earlier archive and reactivation context is untouched.
7. **Given** a truck is returned to service and later suspended again, **When** its details are reviewed, **Then** the truck carries the latest suspension context and the return context of the cycle that preceded it, with its identity and history unaffected.

---

### User Story 2 - Resume New Operational Use Without Rewriting Past Work (Priority: P1)

As an operations administrator or operations lead, I want a truck that has come back from immobilisation to be immediately selectable for a new discharge, a new shift, and a new rotation — including through the shift assignments it kept while it was out of service — so that a repaired vehicle goes back to work without re-registering it and without anything being replayed or rewritten.

**Why this priority**: Suspension deliberately preserved existing discharge assignments, shift assignments, and in-progress rotations. If the return did not restore eligibility through those preserved assignments, an administrator would have to unassign and reassign the vehicle to use it again — reintroducing exactly the workaround suspension was built to remove. Restoring eligibility is inseparable from restoring availability, so it ships in the same slice.

**Independent Test**: Return to service a truck assigned to a planned discharge, a truck assigned to an active shift, and a truck whose rotation was in progress when it was suspended; verify each becomes selectable for new operational work, that the preserved discharge and shift assignments are unchanged and usable, that a new rotation can be started for the truck assigned to an active shift, and that no past discharge, rotation, downtime, or report is altered.

**Acceptance Scenarios**:

1. **Given** a suspended truck still assigned to a planned discharge, **When** an authorized administrator returns it to service, **Then** the discharge keeps the same truck assignment with its captured registration and transport company unchanged, and the truck is usable for that discharge as an available truck.
2. **Given** a suspended truck still assigned to an active shift, **When** it is returned to service, **Then** an operations lead may start a new rotation for it under the rules already governing rotation eligibility, without the shift's resources being reassigned.
3. **Given** a suspended truck, **When** it is returned to service, **Then** an operations administrator preparing a new discharge or a new shift is offered the truck for assignment.
4. **Given** a truck whose in-progress rotation continued through its suspension, **When** the truck is returned to service before that rotation is completed, **Then** the rotation is unaffected by the return, an empty return confirmation with continuation is now accepted, and the truck is not offered for a second concurrent rotation while that one is still in progress.
5. **Given** a truck is returned to service, **When** its past discharges, rotations, downtimes, and reports are consulted, **Then** they reference the same truck with no duplicate vehicle created and no historical value altered.
6. **Given** a truck is returned to service, **When** its registration is compared with the site's other trucks, **Then** the registration it held throughout the suspension is still its own and no conflict arises.

---

### User Story 3 - Keep the Return Authorized and Consistent With the Truck Lifecycle (Priority: P1)

As the system, I want to accept a return to service only from an authorized administrator, only on a truck of their own operating site, only on a truck that is currently suspended, and only when its transport company can still provide available trucks, so that the transition reverses a suspension and nothing else, and never produces an available truck the site's rules forbid.

**Why this priority**: The return is the only exit from the suspended state, which makes it the single place where an invalid available truck could be created. A transport company may be archived while its only trucks are suspended, because a suspended truck does not count as an available truck for that rule. Without an explicit refusal, this transition would silently break the standing invariant that an archived transport company provides no available trucks — the same invariant Reactivate a Truck (`#226`) already protects.

**Independent Test**: Attempt a return to service as an unauthenticated visitor, as each non-administrator active role, on an available truck, on an archived truck, on a truck whose transport company is archived, and on an unknown truck; verify every attempt is refused, no truck changes lifecycle state, and each refusal states a specific, actionable reason.

**Acceptance Scenarios**:

1. **Given** a user who is unauthenticated or whose access is not active, **When** they attempt to return a truck to service, **Then** the attempt is denied, the truck keeps its lifecycle state, and no truck data is disclosed.
2. **Given** an active operations lead or observer, **When** they attempt to return a suspended truck to service, **Then** the attempt is denied and the truck stays suspended, even though they may consult suspended trucks.
3. **Given** a truck that is already available, **When** an authorized administrator attempts to return it to service, **Then** the attempt is refused as already available and its existing lifecycle context is left unchanged.
4. **Given** an archived truck, **When** an authorized administrator attempts to return it to service, **Then** the attempt is refused, the truck stays archived, and the reason states that an archived truck is reactivated rather than returned to service.
5. **Given** a suspended truck whose transport company has been archived, **When** an authorized administrator attempts to return it to service, **Then** the attempt is refused, the truck stays suspended, and the reason states that the transport company must be reactivated first.
6. **Given** a truck that no longer exists or belongs to another operating site, **When** an authorized administrator attempts to return it to service, **Then** the attempt is refused as not found and no other truck is modified.
7. **Given** a truck that has been returned to service, **When** an authorized administrator archives, updates, or suspends it, **Then** those operations behave exactly as they do for any other available truck, with their own rules unchanged by this slice.

---

### User Story 4 - Understand and Recover From a Refused Return (Priority: P2)

As an organization administrator or operations administrator, I want each refused or failed return to explain itself and leave a safe retry path so that I can tell an authorization refusal from a lifecycle conflict, a blocked transport company, a stale view, a validation failure, or a temporary outage, and act on it without leaving a truck in an unclear state.

**Why this priority**: The return is what unblocks a repaired vehicle, often while a shift is waiting for it. A refusal that does not say whether the problem is the truck, the transport company, or the administrator's own permissions leaves the vehicle idle and the administrator guessing — and an opaque failure risks an administrator believing a truck is back in service when it is still withheld from every selection list.

**Independent Test**: Trigger an already-available conflict, an archived-truck conflict, an archived transport-company conflict, a stale-view conflict, an over-long comment, and a transient failure in turn; verify each produces distinct guidance, the truck's lifecycle state is never left ambiguous, and retrying after the blocking condition is resolved returns the truck to service exactly once.

**Acceptance Scenarios**:

1. **Given** an administrator is viewing a suspended truck that another administrator returned to service in the meantime, **When** the administrator submits a return, **Then** the attempt is refused as already available and the refreshed view shows the truck's authoritative available state and lifecycle context.
2. **Given** a return comment longer than the permitted maximum length, **When** the administrator submits it, **Then** the attempt is refused with a specific validation reason and the truck stays suspended.
3. **Given** a return is refused because the truck's transport company is archived, **When** the administrator reactivates that transport company and retries, **Then** the return succeeds and the truck becomes available.
4. **Given** a return fails because the underlying service is temporarily unavailable, **When** the administrator retries after the service recovers, **Then** the truck is returned to service exactly once with a single return time, actor, and comment.
5. **Given** a return is submitted twice in quick succession for the same truck, **When** both submissions are processed, **Then** the truck is returned to service exactly once and the later attempt is refused as already available.
6. **Given** a return is refused for any reason, **When** the administrator reviews the truck, **Then** the truck's displayed lifecycle state matches its authoritative stored state, with no partial return context recorded and its existing suspension context intact.

### Edge Cases

- An unauthenticated visitor or a user whose access is not active is denied the return without revealing whether the referenced truck exists.
- An authorized administrator attempts to return a truck belonging to another operating site: the attempt is refused and that truck is not disclosed or modified.
- A suspended truck's transport company was archived while the vehicle was out of service: the return is refused, and because a suspended truck cannot be updated, reactivating the transport company is the administrator's only route — the refusal says so rather than suggesting a reassignment that is unavailable.
- Two administrators return the same suspended truck to service at nearly the same time: exactly one return is recorded and the other attempt is refused as already available, with no return context overwritten.
- A truck is returned to service and archived by another administrator before a third administrator's return is submitted: the late attempt is refused with a current, actionable archived-truck reason.
- A truck is returned to service while its rotation from before the suspension is still in progress: the rotation is untouched, it may now be continued into a next rotation, and the truck is not offered for a second concurrent rotation until it completes.
- A truck is returned to service while it is assigned to an active shift whose other trucks were also suspended: the shift's assignments are unchanged, and rotations become startable for the returned truck alone.
- A truck is returned to service while it is assigned to a discharge that has since been completed or cancelled: the return succeeds, that discharge is unaffected, and the truck is simply available for new work.
- A truck that was archived and reactivated in the past is returned to service after a suspension: its archive and reactivation context remain readable as history and are not replaced by the return context.
- A truck cycles between available and suspended several times: only the latest suspension and the latest return are shown as current lifecycle context, and neither replaces the archive or reactivation context.
- A return comment containing only whitespace is treated as no comment rather than stored as a blank comment.
- A return comment longer than the permitted maximum length is refused with a specific validation reason and the truck stays suspended.
- Several suspended trucks come back from the same maintenance batch: each is returned to service by its own action, because this slice returns one truck at a time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authorized administrator to return a suspended truck to service, moving its lifecycle state from suspended to available and ending the temporary out-of-service period.
- **FR-002**: The system MUST allow only active organization administrators and operations administrators to return a truck to service at their operating site.
- **FR-003**: The system MUST deny the return to unauthenticated users and to every active role other than organization administrator and operations administrator, without changing any truck and without disclosing truck data.
- **FR-004**: The system MUST refuse the return of a truck that does not exist or that belongs to another operating site, without modifying any truck.
- **FR-005**: The system MUST refuse the return of a truck that is already available, and MUST leave its existing lifecycle context unchanged.
- **FR-006**: The system MUST refuse the return of an archived truck, MUST leave it archived, and MUST state that an archived truck is reactivated rather than returned to service.
- **FR-007**: The system MUST refuse the return of a suspended truck whose transport company is archived, MUST leave the truck suspended, and MUST state that the transport company must be reactivated first, so that an archived transport company never provides an available truck.
- **FR-008**: The system MUST assess the truck's lifecycle state and its transport company's state at the moment the return is submitted rather than at the moment the truck was opened for review.
- **FR-009**: A successful return MUST record the return time, the responsible administrator, and the supplied return comment as the truck's return-to-service context.
- **FR-010**: The system MUST accept an optional return comment, MUST trim surrounding whitespace from it, and MUST record no comment when the supplied value is absent, empty, or whitespace-only.
- **FR-011**: The system MUST reject a return comment that exceeds the permitted maximum length, with a specific validation reason and no lifecycle change.
- **FR-012**: A successful return MUST preserve the truck's stable identity, registration, vehicle model, capacity, and transport-company relationship, and MUST leave any earlier archive and reactivation context untouched.
- **FR-013**: A successful return MUST keep the suspension it ends readable as history alongside the return context, and MUST NOT erase it.
- **FR-014**: A returned truck MUST appear in the available truck collection and the available truck count, and MUST be offered in every collection presenting trucks for selection for new operational work.
- **FR-015**: A returned truck MUST NOT appear in the suspended truck collection, and MUST NOT appear in the archived truck collection or archived count.
- **FR-016**: A returned truck MUST be presented as available and MUST NOT be presented as temporarily out of service, for every role permitted to consult trucks, with its return context disclosed under the rules already governing truck lifecycle context.
- **FR-017**: A returned truck MUST be selectable for a new discharge assignment, a new shift assignment, and a new rotation, including through the discharge and shift assignments it retained while suspended and including a continuation accompanying an empty return confirmation.
- **FR-018**: A successful return MUST leave every existing discharge truck assignment, shift assignment, and in-progress rotation in place, with their captured registration and transport company unchanged, and MUST NOT release, cancel, alter, or replay any past discharge assignment, shift assignment, rotation, downtime, or report referencing the truck.
- **FR-019**: A returned truck MUST become rotation-eligible under the rules already governing rotation eligibility, so a truck with a rotation still in progress does not become eligible for a second concurrent rotation.
- **FR-020**: The system MUST report authorization refusals, not-found refusals, already-available conflicts, archived-truck conflicts, archived transport-company conflicts, validation failures, and transient failures with distinct, understandable, and actionable feedback.
- **FR-021**: The system MUST ensure that repeated or concurrent return attempts for the same truck result in exactly one recorded return, with every later attempt refused as already available.
- **FR-022**: A refused or failed return MUST leave the truck's stored lifecycle state and lifecycle context exactly as they were before the attempt.
- **FR-023**: After a return succeeds or is refused, the truck consultation experience MUST reflect the truck's authoritative current lifecycle state and context without requiring the administrator to leave the consultation context.
- **FR-024**: The return action MUST be offered only for trucks the administrator is permitted to return to service, while server-side authorization remains authoritative.
- **FR-025**: The system MUST return one truck to service per action; submitting several trucks for return in a single action is out of scope for this slice.
- **FR-026**: This slice MUST NOT suspend, archive, reactivate, permanently delete, update, or create trucks; suspension and the archival lifecycle remain owned by their own delivery slices with their own unchanged rules.
- **FR-027**: This slice MUST NOT change shift preparation, shift resource changes, discharge assignment, or rotation rules beyond restoring a returned truck to new operational use.

### Key Entities *(include if feature involves data)*

- **Truck**: The vehicle being put back into service. The return changes only its lifecycle status and lifecycle context; its stable identity, registration, vehicle model, capacity, and transport-company relationship are preserved.
- **Truck Lifecycle State**: The operational condition of a truck — available, suspended, or archived. This feature owns the single transition from suspended back to available.
- **Truck Suspension Context**: The out-of-service information recorded when the truck was suspended — suspension time, responsible administrator, and optional comment. The return ends the suspension it describes and keeps it readable as history.
- **Truck Return-to-Service Context**: The back-in-service information recorded by this feature — return time, responsible administrator, and optional comment — held alongside, and never replacing, the truck's suspension, archive, and reactivation context.
- **Transport Company**: The company providing the truck. Its state gates the return, because an archived transport company must never provide an available truck.
- **Rotation-Eligible Truck**: The existing notion of a truck that may start a rotation. The return restores eligibility under the existing rules rather than redefining them.
- **Authorized Administrator**: An active organization administrator or operations administrator permitted to return a truck to service at their operating site.
- **Operating Site**: The operational scope that owns truck records and bounds which trucks an authorized administrator may return to service.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of return attempts by organization administrators and operations administrators on suspended trucks whose transport company is available succeed, and the truck appears in available consultation and in every selection collection for new work immediately afterward.
- **SC-002**: In acceptance testing, 100% of return attempts by unauthenticated users and by active roles other than organization administrator and operations administrator are denied with zero lifecycle changes.
- **SC-003**: In acceptance testing, 100% of return attempts on already-available trucks, on archived trucks, and on suspended trucks whose transport company is archived are refused with the truck's existing lifecycle state and context left unchanged and a specific reason shown.
- **SC-004**: In acceptance testing, 100% of returned trucks retain their identity, registration, vehicle model, capacity, transport-company relationship, and historical discharge, rotation, downtime, and report references unchanged, and 100% of successful returns record a return time and responsible administrator.
- **SC-005**: In acceptance testing, 100% of returned trucks that kept a planned discharge assignment or an active shift assignment through their suspension are usable through that same assignment, with 0% of those assignments released or altered by the return.
- **SC-006**: In acceptance testing, 100% of returned trucks are offered for a new discharge assignment, a new shift assignment, and a new rotation, including through a continuation accompanying an empty return confirmation, while 0% become eligible for a second concurrent rotation.
- **SC-007**: In all acceptance datasets, repeated and near-simultaneous return attempts on the same truck produce exactly one recorded return, with zero lifecycle contexts overwritten by a refused attempt.
- **SC-008**: Every tested authorization, not-found, already-available, archived-truck, archived transport-company, validation, and transient-failure condition produces distinct and accurate feedback, and every transient failure can be recovered through a retry that returns the truck to service exactly once.
- **SC-009**: In acceptance testing, 100% of returned trucks are presented as available to every role permitted to see them, 0% remain in the suspended collection, and 0% appear in the archived collection or archived count, while 100% of their preceding suspensions remain readable as history to authorized administrators.
- **SC-010**: At least 90% of representative authorized administrators can return an intended truck to service, or understand why they cannot, on their first attempt within 45 seconds of opening the truck, and correctly identify the truck as immediately usable for new work afterward.

## Assumptions

- "Authorized administrator" means an active organization administrator or an active operations administrator, matching the truck write-access pattern established by Create a Truck (`#223`), Update a Truck (`#224`), Archive a Truck (`#225`), Reactivate a Truck (`#226`), and Suspend a Truck From Service (`#252`).
- The return is entered only from the suspended state. It is the exact reverse of `#252` and nothing more: an archived truck is still brought back by reactivation (`#226`), which keeps its own unchanged rules, and an available truck has nothing to return from.
- The return is refused while the truck's transport company is archived, for the same reason reactivation refuses it: the site's standing invariant is that an archived transport company provides no available trucks, and a suspended truck does not count as an available truck for that rule, so a company may legitimately have been archived while this vehicle was out of service.
- In that situation the administrator's only route is to reactivate the transport company, because reassigning a truck to another company requires updating it and a suspended truck is not updatable. The refusal therefore names company reactivation rather than reassignment, which is a deliberate difference from the reactivation refusal wording.
- The return records its own context — time, responsible administrator, optional comment — rather than reusing the reactivation context, because reactivation means "brought back from archival" and the two transitions must stay distinguishable in a truck's history.
- The suspension being ended is kept as readable history rather than cleared, consistent with archival context surviving a reactivation. A later suspension replaces the previous suspension context, as already specified by `#252`.
- The return comment is optional free text, consistent with the archive, reactivation, and suspension comments, and its maximum length matches the existing site-reference lifecycle comment limit. It carries what happened — repair completed, inspection passed, maintenance finished — without constraining it to a fixed list.
- The return restores eligibility rather than reconstructing assignments. Because suspension preserved every discharge assignment, shift assignment, and in-progress rotation, no assignment has to be recreated, and the returned truck is usable through the ones it kept.
- A truck whose rotation was still in progress when it was returned to service does not become eligible for a second rotation: the standing rule of at most one in-progress rotation per truck is unchanged, and this slice only removes the suspension gate that sat in front of it.
- Returning a truck to service is a one-truck-at-a-time action in this slice, symmetric with suspension, because it records a per-vehicle event. A multiple return is deliberately excluded and would be a separate issue if a batch maintenance workflow proves it necessary, as it did for archival and reactivation.
- The truck consultation workspace already exposes available, suspended, and archived lifecycle views and a lifecycle action area, delivered by List Trucks (`#222`), Archive a Truck (`#225`), Reactivate a Truck (`#226`), and Suspend a Truck From Service (`#252`); this slice adds the return action to the suspended view rather than introducing new surfaces.
- Returned trucks are visible to every role that can already consult available trucks, and the return context follows the same disclosure rules as the other lifecycle context, so operational users can see that a vehicle is back while the responsible administrator stays administration context.
- The truck's registration stayed reserved throughout the suspension, so the return cannot produce a registration conflict and no registration re-validation is required.
- The `Suspended Truck` glossary entry in `CONTEXT.md` states that a suspended truck must return to service before it can be archived, reactivated, or updated; that entry is revised to record that the return now exists, and the new vocabulary is added there as required by the constitution.
- Each operating organization owns exactly one site, so the administrator's organization determines which trucks they may return to service.
- API authorization and lifecycle checks are authoritative for every rule in this specification; any interface-level restriction is a courtesy that does not replace server-side enforcement.
- This slice depends on Suspend a Truck From Service (`#252`) and on the delivered truck lifecycle slices; permanent deletion of a truck remains out of scope for every current truck slice.
