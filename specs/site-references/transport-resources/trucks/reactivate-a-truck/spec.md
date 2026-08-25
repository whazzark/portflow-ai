# Feature Specification: Reactivate a Truck

**Feature Branch**: `feat/226-reactivate-truck`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Let an authorized administrator reactivate an archived truck. https://github.com/whazzark/portflow-ai/issues/226"

**Feature ID**: `GH-226`

**GitHub Issue**: [#226](https://github.com/whazzark/portflow-ai/issues/226)

**Parent Roadmap**: `specs/site-references/transport-resources/trucks/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Return an Archived Truck to Operational Use (Priority: P1)

As an organization administrator or operations administrator, I want to reactivate a truck the site archived earlier so that it becomes selectable again for new operational work, without creating a duplicate vehicle and without losing its registration, capacity, transport company, or past discharge involvement.

**Why this priority**: Archival is currently a one-way door. When a vehicle returns from a long repair, a lease is renewed, or a truck was archived by mistake, the only workaround is to create a new truck — which is refused because the registration is still taken by the archived record, and which would split the vehicle's history across two records. This is the primary outcome of the slice.

**Independent Test**: Sign in as an organization administrator or operations administrator, reactivate an archived truck whose transport company is available, and verify the truck leaves the archived collection, reappears in the available collection and in every selection offering trucks for new work, keeps its stable identity, registration, vehicle model, capacity, and transport company, and shows its reactivation time, responsible administrator, and comment.

**Acceptance Scenarios**:

1. **Given** an archived truck whose transport company is available, **When** an organization administrator reactivates it, **Then** the truck becomes available, disappears from the archived collection, and reappears in the available truck collection.
2. **Given** an operations administrator reactivates an archived truck, **When** the truck's details are opened by an authorized administrator, **Then** the reactivation time, the responsible administrator, and the reactivation comment when one was supplied are shown.
3. **Given** a truck is reactivated, **When** its details are reviewed, **Then** its stable identity, registration, vehicle model, capacity, and current transport company are unchanged by the reactivation.
4. **Given** an administrator reactivates a truck without supplying a comment, **When** the reactivation completes, **Then** the truck is available with the reactivation time and responsible administrator recorded and no comment shown.
5. **Given** a truck is reactivated, **When** any active user consults available trucks or chooses a truck for new operational work, **Then** the reactivated truck is offered again and the available count reflects its return.
6. **Given** a truck is reactivated, **When** its details are reviewed, **Then** the discharges, rotations, and reports that referenced it while it was available or archived still reference the same truck, with no duplicate vehicle created.

---

### User Story 2 - Keep Reactivation Consistent With the Provider Rule (Priority: P1)

As the system, I want to refuse reactivation of a truck whose transport company is archived, and to refuse reactivation by unauthorized users, so that no available truck is ever provided by a retired company and lifecycle changes stay accountable.

**Why this priority**: The site's standing rule is that a transport company cannot be archived while it still provides available trucks, and that a truck may only be created or assigned to an available company. Reactivating a truck under an archived company would break that invariant from the first delivery, leaving operational users able to select a vehicle whose provider the site no longer works with.

**Independent Test**: Attempt reactivation as an unauthenticated visitor, as each non-administrator active role, on a truck whose transport company is archived, on a truck that is already available, and on an unknown truck; verify every attempt is refused, no truck changes lifecycle state, and each refusal states a specific, actionable reason.

**Acceptance Scenarios**:

1. **Given** a user who is unauthenticated or whose access is not active, **When** they attempt to reactivate a truck, **Then** the attempt is denied, the truck stays archived, and no truck data is disclosed.
2. **Given** an active operations lead or observer, **When** they attempt to reactivate a truck, **Then** the attempt is denied and the truck stays archived, even though they may consult available trucks.
3. **Given** an archived truck whose transport company is archived, **When** an authorized administrator attempts to reactivate it, **Then** the attempt is refused, the truck stays archived, and the reason states that the transport company is archived and must be reactivated or the truck reassigned to an available company first.
4. **Given** a truck whose reactivation was refused because its transport company was archived, **When** that company is reactivated and the administrator retries, **Then** the reactivation succeeds.
5. **Given** a truck that is already available, **When** an authorized administrator attempts to reactivate it, **Then** the attempt is refused as already available and its existing lifecycle context is left unchanged.
6. **Given** a truck that no longer exists or belongs to another operating site, **When** an authorized administrator attempts to reactivate it, **Then** the attempt is refused as not found and no other truck is modified.

---

### User Story 3 - Understand and Recover From a Refused Reactivation (Priority: P2)

As an organization administrator or operations administrator, I want each refused or failed reactivation to explain itself and leave a safe retry path so that I can resolve the blocking condition or retry a transient failure without leaving a truck in an unclear lifecycle state.

**Why this priority**: A reactivation refusal is only useful if the administrator can tell an authorization refusal from an archived-provider conflict, a stale view, a validation failure, or a temporary outage, and can act on it. Without that, administrators retry blindly or assume the truck is back in service when it is not.

**Independent Test**: Trigger an archived-provider conflict, an already-available conflict, a stale-view conflict, an over-long comment, and a transient failure in turn; verify each produces distinct guidance, the truck's lifecycle state is never left ambiguous, and retrying after the blocking condition is resolved reactivates the truck exactly once.

**Acceptance Scenarios**:

1. **Given** an administrator is viewing an archived truck that another administrator reactivated in the meantime, **When** the administrator submits a reactivation, **Then** the attempt is refused as already available and the refreshed view shows the truck's authoritative available state and reactivation context.
2. **Given** a reactivation comment longer than the permitted maximum length, **When** the administrator submits it, **Then** the attempt is refused with a specific validation reason and the truck stays archived.
3. **Given** a reactivation fails because the underlying service is temporarily unavailable, **When** the administrator retries after the service recovers, **Then** the truck is reactivated exactly once with a single reactivation time, actor, and comment.
4. **Given** a reactivation is submitted twice in quick succession for the same truck, **When** both submissions are processed, **Then** the truck is reactivated exactly once and the later attempt is refused as already available.
5. **Given** a reactivation is refused for any reason, **When** the administrator reviews the truck, **Then** the truck's displayed lifecycle state matches its authoritative stored state with no partial reactivation context recorded and its archive context intact.

---

### User Story 4 - Reactivate Several Trucks at Once (Priority: P3)

As an organization administrator or operations administrator bringing a batch of vehicles back into service — a renewed lease, a transport company that serves the site again, a fleet returning from seasonal storage — I want to select several archived trucks and reactivate them in one action so that I do not have to repeat the same confirmation once per vehicle, and so that I can see at a glance which ones could not be reactivated and why.

**Why this priority**: Single-truck reactivation already delivers the outcome; multiple reactivation is an efficiency multiplier over the same rule set, and it is only worth building once the single path and its refusals are proven. It nonetheless belongs to this slice because trucks are archived in groups by the multiple archival already delivered, and the reverse action must be equally usable.

**Independent Test**: Select a mixed set of trucks — some eligible, one whose transport company is archived, one already available, one unknown identifier — reactivate them in one action, and verify that exactly the eligible trucks become available with identical reactivation metadata, that every other truck is untouched and reported with its own specific reason, and that the blocked ones can be retried on their own.

**Acceptance Scenarios**:

1. **Given** an authorized administrator selects several eligible archived trucks, **When** they reactivate the selection in one action, **Then** every selected truck becomes available and the workspace shows them removed from the archived collection without a manual refresh.
2. **Given** a selection mixing eligible trucks with one truck whose transport company is archived, **When** the selection is reactivated, **Then** the eligible trucks become available, the blocked truck stays archived, and the outcome names that truck and its archived-provider reason.
3. **Given** a selection containing a truck another administrator reactivated a moment earlier, **When** the selection is reactivated, **Then** the remaining eligible trucks are reactivated and the already-available truck is reported as unchanged with its existing lifecycle context intact.
4. **Given** several trucks are reactivated in one action, **When** their details are opened, **Then** they all carry the same reactivation time, the same responsible administrator, and the same comment.
5. **Given** an outcome reported some trucks as unchanged, **When** the administrator resolves the blocking condition and retries only those trucks, **Then** the retry reactivates the ones that are now eligible and leaves the rest reported again.
6. **Given** a user who is unauthenticated or is not an organization administrator or operations administrator, **When** they attempt a multiple reactivation, **Then** the whole attempt is denied and no truck changes lifecycle state.
7. **Given** a multiple reactivation fails part-way through because the underlying service becomes unavailable, **When** the failure is reported, **Then** no truck in the submission is left available and the administrator can retry the same selection.
8. **Given** an administrator has selected trucks in the archived view, **When** they switch to the available view or change the transport-company filter, **Then** the selection no longer offers trucks that are not listed in the new scope.

### Edge Cases

- An unauthenticated visitor or a user whose access is not active is denied reactivation without revealing whether the referenced truck exists.
- An authorized administrator attempts to reactivate a truck belonging to another operating site: the attempt is refused and that truck is not disclosed or modified.
- A truck's transport company is archived between the moment the administrator opens the truck and the moment they submit the reactivation: the reactivation is refused at submission time with a current, actionable archived-provider reason.
- A truck's transport company is reactivated between opening the truck and submitting the reactivation: the reactivation succeeds, because provider eligibility is assessed at submission time.
- A truck is reactivated while its registration is still the only record holding that plate: no registration conflict can arise, because an archived truck keeps its registration reserved and no other truck could have taken it.
- Two administrators reactivate the same archived truck at nearly the same time: exactly one reactivation is recorded and the other attempt is refused as already available, with no reactivation context overwritten.
- A reactivation comment containing only whitespace is treated as no comment rather than stored as a blank comment.
- A reactivation comment longer than the permitted maximum length is refused with a specific validation reason and the truck stays archived.
- A truck that has already been archived and reactivated before is archived and reactivated again: the latest reactivation context replaces the previous one and the truck's identity and history are unaffected.
- A reactivated truck is not automatically reserved by any discharge; returning to service only makes it selectable again.
- A multiple reactivation in which every selected truck turns out to be ineligible reactivates nothing and reports a reason for each one, rather than reporting an unexplained failure.
- A multiple reactivation naming the same truck twice is rejected as an invalid submission rather than reactivating it once and reporting the duplicate as already available.
- A multiple reactivation submitted with an empty selection is rejected as an invalid submission and reactivates nothing.
- A truck's transport company is archived after the administrator selected the truck but before the submission is processed: it is reported as unchanged while the rest of the selection is reactivated.
- Two administrators submit overlapping selections at nearly the same time: each overlapping truck is reactivated exactly once, and the losing submission reports it as already available without overwriting the recorded reactivation context.
- A selected truck is filtered out of view by a search term: it remains part of the selection, because search narrows what is displayed rather than what the administrator chose.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow only active organization administrators and operations administrators to reactivate a truck belonging to their operating site.
- **FR-002**: The system MUST deny reactivation to unauthenticated users and to every active role other than organization administrator and operations administrator, without changing any truck and without disclosing truck data.
- **FR-003**: The system MUST refuse reactivation of a truck that does not exist or that belongs to another operating site, without modifying any truck.
- **FR-004**: The system MUST refuse reactivation of a truck that is already available, and MUST leave its existing lifecycle context unchanged.
- **FR-005**: The system MUST refuse reactivation of an archived truck whose current transport company is archived, and MUST leave the truck archived.
- **FR-006**: A refusal caused by an archived transport company MUST state that reason explicitly and indicate that the company must be reactivated, or the truck reassigned to an available company, before the truck can return to service.
- **FR-007**: The system MUST assess the transport company's lifecycle state at the moment reactivation is submitted rather than at the moment the truck was opened for review.
- **FR-008**: A successful reactivation MUST change the truck's lifecycle status from archived to available and MUST record the reactivation time, the responsible administrator, and the supplied reactivation comment.
- **FR-009**: The system MUST accept an optional reactivation comment, MUST trim surrounding whitespace from it, and MUST record no comment when the supplied value is absent, empty, or whitespace-only.
- **FR-010**: The system MUST reject a reactivation comment that exceeds the permitted maximum length, with a specific validation reason and no lifecycle change.
- **FR-011**: A successful reactivation MUST preserve the truck's stable identity, registration, vehicle model, capacity, transport-company relationship, and every historical discharge, rotation, and report reference.
- **FR-012**: A successful reactivation MUST replace any previously recorded reactivation context with the new one, and MUST leave the truck's most recent archive context readable as history rather than deleting it.
- **FR-013**: A reactivated truck MUST reappear in the available truck collection, in the available truck count, and in every collection offering trucks for selection for new operational work.
- **FR-014**: A reactivated truck MUST become visible to active roles other than organization administrator and operations administrator wherever available trucks are already disclosed to them, consistent with the truck visibility rules established for truck consultation.
- **FR-015**: The system MUST NOT reserve, assign, or otherwise involve a reactivated truck in any discharge as a consequence of the reactivation.
- **FR-016**: The system MUST report authorization refusals, not-found refusals, already-available conflicts, archived-transport-company conflicts, validation failures, and transient failures with distinct, understandable, and actionable feedback.
- **FR-017**: The system MUST ensure that repeated or concurrent reactivation attempts for the same truck result in exactly one recorded reactivation, with every later attempt refused as already available, whether the truck was submitted on its own or as part of a multiple reactivation.
- **FR-018**: A refused or failed reactivation MUST leave the truck's stored lifecycle state and lifecycle context exactly as they were before the attempt.
- **FR-019**: After a reactivation succeeds or is refused, the truck consultation experience MUST reflect the truck's authoritative current lifecycle state and context without requiring the administrator to leave the consultation context.
- **FR-020**: The reactivation action MUST be offered only for trucks the administrator is permitted to reactivate, while server-side authorization remains authoritative.
- **FR-021**: This slice MUST NOT archive, permanently delete, update, or create trucks, and MUST NOT change any transport company's lifecycle state; those actions remain owned by separate delivery slices.
- **FR-022**: The system MUST allow an authorized administrator to submit several trucks for reactivation in one action.
- **FR-023**: A multiple reactivation MUST apply the same authorization, existence, lifecycle-state, and transport-company rules to every submitted truck as a single reactivation, assessed at submission time.
- **FR-024**: A multiple reactivation MUST reactivate every eligible truck in the submission and leave every ineligible truck unchanged, rather than refusing the whole submission because one truck is ineligible.
- **FR-025**: A multiple reactivation MUST report, for each truck it left unchanged, an identifying label and a specific reason distinguishing not found, already available, and archived transport company.
- **FR-026**: Every truck reactivated within one multiple reactivation MUST record the same reactivation time, the same responsible administrator, and the same comment.
- **FR-027**: A multiple reactivation MUST record either all of its eligible reactivations or none of them, so a failure part-way through never leaves some trucks available and others silently skipped.
- **FR-028**: A multiple reactivation MUST require at least one truck and MUST reject a submission naming the same truck more than once.
- **FR-029**: The administrator MUST be able to select several trucks in the truck consultation workspace, see how many are selected, clear the selection, and retry only the trucks reported as unchanged.
- **FR-030**: Selection MUST offer only trucks the administrator is permitted to reactivate, and MUST NOT carry a selected truck into a lifecycle view or transport-company scope where it is no longer listed.

### Key Entities *(include if feature involves data)*

- **Truck**: The vehicle returning to operational use. Reactivation changes only its lifecycle status and reactivation context; its stable identity, registration, vehicle model, capacity, and transport-company relationship are preserved.
- **Truck Lifecycle Context**: The reactivation information recorded by this feature — reactivation time, responsible administrator, and optional comment — alongside the archive context of the archival it reverses, which remains readable as history.
- **Transport Company**: The company that provides the truck. Its lifecycle status gates reactivation: an archived company blocks its trucks from returning to service, because an available truck may never be provided by an archived company.
- **Truck Selection**: The set of trucks an administrator has chosen in the consultation workspace for a multiple reactivation. It holds only trucks the administrator may reactivate, is scoped to the lifecycle view and transport-company filter in which they were chosen, and can be cleared or narrowed to the trucks a previous attempt left unchanged.
- **Reactivation Outcome**: The result of a multiple reactivation, pairing the trucks that were reactivated with the trucks left unchanged. Each unchanged truck carries an identifying label and one specific reason: not found, already available, or archived transport company.
- **Authorized Administrator**: An active organization administrator or operations administrator permitted to reactivate a truck at their operating site and to consult archived trucks.
- **Operating Site**: The operational scope that owns truck records and bounds which trucks an authorized administrator may reactivate.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of reactivation attempts by organization administrators and operations administrators on eligible archived trucks succeed, and the truck is present in available consultation and absent from archived consultation immediately afterward.
- **SC-002**: In acceptance testing, 100% of reactivation attempts by unauthenticated users and by active roles other than organization administrator and operations administrator are denied with zero lifecycle changes.
- **SC-003**: In acceptance testing, 100% of reactivation attempts on trucks whose transport company is archived are refused with the truck left archived and a specific archived-provider reason shown, and 100% of those trucks become reactivatable once their company is available again.
- **SC-004**: In acceptance testing, 100% of reactivated trucks retain their identity, registration, vehicle model, capacity, transport-company relationship, and historical discharge references unchanged, and 100% of successful reactivations record a reactivation time and responsible administrator.
- **SC-005**: In all acceptance datasets, repeated and near-simultaneous reactivation attempts on the same truck produce exactly one recorded reactivation, with zero lifecycle contexts overwritten by a refused attempt.
- **SC-006**: Every tested authorization, not-found, already-available, archived-transport-company, validation, and transient-failure condition produces distinct and accurate feedback, and every transient failure can be recovered through a retry that reactivates the truck exactly once.
- **SC-007**: At least 90% of representative authorized administrators can reactivate an intended truck, or understand why they cannot, on their first attempt within 45 seconds of opening the truck.
- **SC-008**: In acceptance testing, 100% of multiple reactivations containing a mix of eligible and ineligible trucks reactivate exactly the eligible trucks, leave every ineligible truck unchanged, and report a specific reason for each unchanged truck, including the all-blocked case.
- **SC-009**: In all acceptance datasets, every truck reactivated within one multiple reactivation shares an identical reactivation time, responsible administrator, and comment, and no multiple reactivation ever leaves part of its eligible set reactivated after a failure.
- **SC-010**: An authorized administrator reactivating ten selected trucks completes the action in fewer than half the confirmation steps required to reactivate them one at a time, and can retry the unchanged ones without reselecting the whole batch.
- **SC-011**: In acceptance testing, 0% of reactivations result in an available truck provided by an archived transport company, across every tested combination of truck and company lifecycle states.

## Assumptions

- "Authorized administrator" means an active organization administrator or an active operations administrator, matching the truck write-access pattern established by Create a Truck (`#223`), Update a Truck (`#224`), and Archive a Truck (`#225`).
- Reactivation is the exact inverse of archival and is offered both for one truck at a time and for several selected trucks in one action, mirroring Archive a Truck (`#225`) and the customer lifecycle precedent (`GH-195` / `GH-196`).
- A multiple reactivation reports partial success rather than refusing everything when one truck is ineligible, matching the multiple archival delivered by Archive a Truck (`#225`).
- Eligibility means the truck is currently archived and its current transport company is available. This follows from the standing domain rule recorded in `CONTEXT.md` — a transport company cannot be archived while it still provides available trucks — and from the existing rule that a truck may only be created or assigned to an available transport company. No other eligibility rule (such as age, capacity, or how long the truck has been archived) restricts reactivation.
- An administrator blocked by an archived transport company has two documented ways forward, both owned by other slices: reactivate the company, or reassign the truck to an available company through Update a Truck (`#224`). This slice only reports the blocker; it never changes a company's lifecycle state and never reassigns a provider on the administrator's behalf.
- Archived trucks keep their registration reserved, so reactivation can never collide with another truck's registration and needs no uniqueness resolution step.
- The reactivation comment is optional free text, consistent with the archive comment; its maximum length matches the existing site-reference lifecycle comment limit.
- The truck consultation workspace already exposes an archived view, a transport-company filter, a multi-selection model, and a lifecycle action area, all delivered by List Trucks (`#222`) and Archive a Truck (`#225`); this slice extends them rather than introducing them.
- Truck detail consultation already displays the latest reactivation context; this slice supplies the action that populates it.
- Available and archived remain the only truck lifecycle states, and a truck may cycle between them any number of times, each cycle replacing the previous reactivation context.
- Reactivation never restores, replays, or alters any past discharge, rotation, or report; it only makes the truck selectable for new work.
- Each operating organization owns exactly one site, so the administrator's organization determines which trucks they may reactivate.
- API authorization and eligibility checks are authoritative for every rule in this specification; any interface-level restriction is a courtesy that does not replace server-side enforcement.
- This slice depends on Archive a Truck (`#225`) and List Trucks (`#222`), both of which are prerequisites recorded on the issue; permanent deletion of a truck remains out of scope for every current truck slice.
