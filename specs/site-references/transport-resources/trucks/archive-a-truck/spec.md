# Feature Specification: Archive a Truck

**Feature Branch**: `feat/225-archive-truck`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Let an authorized administrator archive an eligible truck while preserving history. https://github.com/whazzark/portflow-ai/issues/225" — extended during specification review to include archiving several selected trucks in one action.

**Feature ID**: `GH-225`

**GitHub Issue**: [#225](https://github.com/whazzark/portflow-ai/issues/225)

**Parent Roadmap**: `specs/site-references/transport-resources/trucks/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retire a Truck From Operational Use (Priority: P1)

As an organization administrator or operations administrator, I want to archive a truck that the site no longer operates so that it stops being offered for new operational work while its registration, capacity, transport company, and past involvement remain consultable.

**Why this priority**: Without archival, a decommissioned, sold, or returned vehicle stays permanently selectable for new work, and the only alternative — deleting it — would destroy the history that discharge records depend on. This is the primary outcome of the slice.

**Independent Test**: Sign in as an organization administrator or operations administrator, archive an available truck that no current discharge relies on, and verify the truck leaves the available truck collection, appears in the archived collection with its archive context, and remains fully readable with unchanged registration, capacity, vehicle model, and transport company.

**Acceptance Scenarios**:

1. **Given** an available truck that no planned or active discharge relies on, **When** an organization administrator archives it, **Then** the truck becomes archived and disappears from the available truck collection and from every selection offering trucks for new operational work.
2. **Given** an operations administrator archives an available truck, **When** the archived truck's details are opened by an authorized administrator, **Then** the archive time, the responsible administrator, and the archive comment when one was supplied are shown.
3. **Given** a truck is archived, **When** its details are reviewed, **Then** its stable identity, registration, vehicle model, capacity, and current transport company are unchanged by the archival.
4. **Given** an administrator archives a truck without supplying a comment, **When** the archival completes, **Then** the truck is archived with the archive time and responsible administrator recorded and no comment shown.
5. **Given** a truck is archived, **When** any active user consults available trucks, **Then** the archived truck is absent and the available count reflects its removal.
6. **Given** a truck is archived, **When** the archived collection is consulted by an organization administrator or operations administrator, **Then** the truck appears there with its archived status.

---

### User Story 2 - Protect Trucks Still Required by Current Work (Priority: P1)

As the system, I want to refuse archival of a truck that a planned or active discharge still relies on, and to refuse archival by unauthorized users, so that current operations are never invalidated and lifecycle changes stay accountable.

**Why this priority**: Archiving a truck that current preparation or execution depends on would break live operational state, and unauthorized archival would silently remove a vehicle other users still need. Both must be prevented from the first delivery of this behavior.

**Independent Test**: Attempt archival as an unauthenticated visitor, as each non-administrator active role, on a truck reserved by a planned or active discharge, and on a truck that is already archived; verify every attempt is refused, no truck changes lifecycle state, and each refusal states a specific, actionable reason.

**Acceptance Scenarios**:

1. **Given** a user who is unauthenticated or whose access is not active, **When** they attempt to archive a truck, **Then** the attempt is denied, the truck stays available, and no truck data is disclosed.
2. **Given** an active operations lead or observer, **When** they attempt to archive a truck, **Then** the attempt is denied and the truck stays available, even though they may consult available trucks.
3. **Given** an available truck currently reserved by a planned or active discharge, **When** an authorized administrator attempts to archive it, **Then** the attempt is refused as in use, the truck stays available, and the reason identifies that current operational work relies on it.
4. **Given** a truck whose only discharge involvement is through closed discharges or released reservations, **When** an authorized administrator archives it, **Then** the archival succeeds and every historical relationship remains readable.
5. **Given** a truck that is already archived, **When** an authorized administrator attempts to archive it again, **Then** the attempt is refused as already archived and the existing archive context is left unchanged.
6. **Given** a truck that no longer exists, **When** an authorized administrator attempts to archive it, **Then** the attempt is refused as not found and no other truck is modified.

---

### User Story 3 - Understand and Recover From a Refused Archival (Priority: P2)

As an organization administrator or operations administrator, I want each refused or failed archival to explain itself and leave a safe retry path so that I can release the blocking work or retry a transient failure without leaving a truck in an unclear lifecycle state.

**Why this priority**: An archival refusal is only useful if the administrator can tell an authorization refusal from an in-use conflict, a stale view, or a temporary outage, and can act on it. Without that, administrators retry blindly or assume the truck was archived when it was not.

**Independent Test**: Trigger an in-use conflict, an already-archived conflict, a stale-view conflict, and a transient failure in turn; verify each produces distinct guidance, the truck's lifecycle state is never left ambiguous, and retrying after the blocking condition is resolved archives the truck exactly once.

**Acceptance Scenarios**:

1. **Given** an archival was refused because the truck is in use, **When** the blocking discharge is closed or its truck reservation is released and the administrator retries, **Then** the archival succeeds.
2. **Given** an administrator is viewing a truck that another administrator archived in the meantime, **When** the administrator submits an archival, **Then** the attempt is refused as already archived and the refreshed view shows the truck's authoritative archived state and archive context.
3. **Given** an archival fails because the underlying service is temporarily unavailable, **When** the administrator retries after the service recovers, **Then** the truck is archived exactly once with a single archive time, actor, and comment.
4. **Given** an archival is submitted twice in quick succession for the same truck, **When** both submissions are processed, **Then** the truck is archived exactly once and the later attempt is refused as already archived.
5. **Given** an archival is refused for any reason, **When** the administrator reviews the truck, **Then** the truck's displayed lifecycle state matches its authoritative stored state with no partial archive context recorded.

---

### User Story 4 - Archive Several Trucks at Once (Priority: P3)

As an organization administrator or operations administrator retiring a batch of vehicles — an ended lease, a transport company that stopped serving the site, a fleet renewal — I want to select several trucks and archive them in one action so that I do not have to repeat the same confirmation once per vehicle, and so that I can see at a glance which ones could not be archived and why.

**Why this priority**: Single-truck archival already delivers the outcome; multiple archival is an efficiency multiplier over the same rule set, and it is only worth building once the single path and its refusals are proven. It is nonetheless part of this slice because fleet changes retire trucks in groups, and archiving them one by one both wastes time and makes it easy to lose track of which vehicles were blocked.

**Independent Test**: Select a mixed set of trucks — some eligible, one reserved by a planned or active discharge, one already archived, one unknown identifier — archive them in one action, and verify that exactly the eligible trucks become archived with identical archive metadata, that every other truck is untouched and reported with its own specific reason, and that the blocked ones can be retried on their own.

**Acceptance Scenarios**:

1. **Given** an authorized administrator selects several eligible available trucks, **When** they archive the selection in one action, **Then** every selected truck becomes archived and the workspace shows them removed from the available collection without a manual refresh.
2. **Given** a selection mixing eligible trucks with one truck reserved by a planned or active discharge, **When** the selection is archived, **Then** the eligible trucks are archived, the reserved truck stays available, and the outcome names that truck and its in-use reason.
3. **Given** a selection containing a truck another administrator archived a moment earlier, **When** the selection is archived, **Then** the remaining eligible trucks are archived and the already-archived truck is reported as unchanged with its existing archive context intact.
4. **Given** several trucks are archived in one action, **When** their details are opened, **Then** they all carry the same archive time, the same responsible administrator, and the same comment.
5. **Given** an outcome reported some trucks as unchanged, **When** the administrator resolves the blocking condition and retries only those trucks, **Then** the retry archives the ones that are now eligible and leaves the rest reported again.
6. **Given** a user who is unauthenticated or is not an organization administrator or operations administrator, **When** they attempt a multiple archival, **Then** the whole attempt is denied and no truck changes lifecycle state.
7. **Given** a multiple archival fails part-way through because the underlying service becomes unavailable, **When** the failure is reported, **Then** no truck in the submission is left archived and the administrator can retry the same selection.
8. **Given** an administrator has selected trucks in the available view, **When** they switch to the archived view or change the transport-company filter, **Then** the selection no longer offers trucks that are not listed in the new scope.

### Edge Cases

- An unauthenticated visitor or a user whose access is not active is denied archival without revealing whether the referenced truck exists.
- An authorized administrator attempts to archive a truck belonging to another operating site: the attempt is refused and that truck is not disclosed or modified.
- A truck whose current transport company is itself archived can still be archived; the two lifecycle states remain independent and the truck-company relationship is preserved.
- A truck becomes reserved by a newly planned discharge between the moment the administrator opens the truck and the moment they submit the archival: the archival is refused at submission time with a current, actionable in-use reason.
- A discharge that relies on the truck moves to closed between opening the truck and submitting the archival: the archival succeeds because current usage is assessed at submission time.
- Two administrators archive the same available truck at nearly the same time: exactly one archival is recorded and the other attempt is refused as already archived, with no archive context overwritten.
- An archive comment containing only whitespace is treated as no comment rather than stored as a blank comment.
- An archive comment longer than the permitted maximum length is refused with a specific validation reason and the truck stays available.
- A truck archived with a comment is later consulted by an authorized administrator: the original comment, time, and actor remain readable and are not altered by any later consultation.
- An archived truck retains any previous reactivation context; archiving does not erase earlier lifecycle history.
- A multiple archival in which every selected truck turns out to be ineligible archives nothing and reports a reason for each one, rather than reporting an unexplained failure.
- A multiple archival naming the same truck twice is rejected as an invalid submission rather than archiving it once and reporting the duplicate as already archived.
- A multiple archival submitted with an empty selection is rejected as an invalid submission and archives nothing.
- A truck becomes reserved by a planned or active discharge after the administrator selected it but before the submission is processed: it is reported as unchanged while the rest of the selection is archived.
- Two administrators submit overlapping selections at nearly the same time: each overlapping truck is archived exactly once, and the losing submission reports it as already archived without overwriting the recorded archive context.
- A selected truck is filtered out of view by a search term: it remains part of the selection, because search narrows what is displayed rather than what the administrator chose.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow only active organization administrators and operations administrators to archive a truck belonging to their operating site.
- **FR-002**: The system MUST deny archival to unauthenticated users and to every active role other than organization administrator and operations administrator, without changing any truck and without disclosing truck data.
- **FR-003**: The system MUST refuse archival of a truck that does not exist or that belongs to another operating site, without modifying any truck.
- **FR-004**: The system MUST refuse archival of a truck that is already archived, and MUST leave its existing archive time, actor, and comment unchanged.
- **FR-005**: The system MUST refuse archival of an available truck that is currently relied upon by a planned or active discharge, and MUST leave the truck available.
- **FR-006**: The system MUST NOT treat involvement through closed discharges or through released truck reservations as current usage that blocks archival.
- **FR-007**: The system MUST assess current usage at the moment archival is submitted rather than at the moment the truck was opened for review.
- **FR-008**: A successful archival MUST change the truck's lifecycle status from available to archived and MUST record the archive time, the responsible administrator, and the supplied archive comment.
- **FR-009**: The system MUST accept an optional archive comment, MUST trim surrounding whitespace from it, and MUST record no comment when the supplied value is absent, empty, or whitespace-only.
- **FR-010**: The system MUST reject an archive comment that exceeds the permitted maximum length, with a specific validation reason and no lifecycle change.
- **FR-011**: A successful archival MUST preserve the truck's stable identity, registration, vehicle model, capacity, transport-company relationship, and any earlier reactivation context.
- **FR-012**: An archived truck MUST remain readable to organization administrators and operations administrators through truck consultation, including its archive context.
- **FR-013**: An archived truck MUST be excluded from the available truck collection, from the available truck count, and from every collection offering trucks for selection for new operational work.
- **FR-014**: An archived truck MUST NOT be disclosed to active roles other than organization administrator and operations administrator, consistent with the archived-truck visibility rules already established for truck consultation.
- **FR-015**: The system MUST report authorization refusals, not-found refusals, already-archived conflicts, in-use conflicts, validation failures, and transient failures with distinct, understandable, and actionable feedback.
- **FR-016**: The system MUST ensure that repeated or concurrent archival attempts for the same truck result in exactly one recorded archival, with every later attempt refused as already archived, whether the truck was submitted on its own or as part of a multiple archival.
- **FR-017**: A refused or failed archival MUST leave the truck's stored lifecycle state and lifecycle context exactly as they were before the attempt.
- **FR-018**: After an archival succeeds or is refused, the truck consultation experience MUST reflect the truck's authoritative current lifecycle state and context without requiring the administrator to leave the consultation context.
- **FR-019**: The archival action MUST be offered only for trucks the administrator is permitted to archive, while server-side authorization remains authoritative.
- **FR-020**: This slice MUST NOT reactivate, permanently delete, update, or create trucks; those actions remain owned by separate delivery slices.
- **FR-021**: The system MUST allow an authorized administrator to submit several trucks for archival in one action.
- **FR-022**: A multiple archival MUST apply the same authorization, existence, lifecycle-state, and in-use rules to every submitted truck as a single archival, assessed at submission time.
- **FR-023**: A multiple archival MUST archive every eligible truck in the submission and leave every ineligible truck unchanged, rather than refusing the whole submission because one truck is ineligible.
- **FR-024**: A multiple archival MUST report, for each truck it left unchanged, an identifying label and a specific reason distinguishing not found, already archived, and in use.
- **FR-025**: Every truck archived within one multiple archival MUST record the same archive time, the same responsible administrator, and the same comment.
- **FR-026**: A multiple archival MUST record either all of its eligible archivals or none of them, so a failure part-way through never leaves some trucks archived and others silently skipped.
- **FR-027**: A multiple archival MUST require at least one truck and MUST reject a submission naming the same truck more than once.
- **FR-028**: The administrator MUST be able to select several trucks in the truck consultation workspace, see how many are selected, clear the selection, and retry only the trucks reported as unchanged.
- **FR-029**: Selection MUST offer only trucks the administrator is permitted to archive, and MUST NOT carry a selected truck into a lifecycle view or transport-company scope where it is no longer listed.

### Key Entities *(include if feature involves data)*

- **Truck**: The vehicle being retired from operational use. Archival changes only its lifecycle status and archive context; its stable identity, registration, vehicle model, capacity, and transport-company relationship are preserved.
- **Truck Lifecycle Context**: The archive information recorded by this feature — archive time, responsible administrator, and optional comment — alongside any previously recorded reactivation context, which archival preserves.
- **Truck Usage**: The determination of whether a truck is currently relied upon by a planned or active discharge through an unreleased reservation. It gates archival eligibility and ignores closed discharges and released reservations.
- **Discharge**: The operational work that may currently rely on a truck. A planned or active discharge blocks archival of the trucks it reserves; a closed discharge retains its historical truck references without blocking archival.
- **Truck Selection**: The set of trucks an administrator has chosen in the consultation workspace for a multiple archival. It holds only trucks the administrator may archive, is scoped to the lifecycle view and transport-company filter in which they were chosen, and can be cleared or narrowed to the trucks a previous attempt left unchanged.
- **Archival Outcome**: The result of a multiple archival, pairing the trucks that were archived with the trucks left unchanged. Each unchanged truck carries an identifying label and one specific reason: not found, already archived, or in use.
- **Authorized Administrator**: An active organization administrator or operations administrator permitted to archive a truck at their operating site and to consult archived trucks.
- **Operating Site**: The operational scope that owns truck records and bounds which trucks an authorized administrator may archive.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of archival attempts by organization administrators and operations administrators on eligible available trucks succeed, and the truck is absent from available consultation and present in archived consultation immediately afterward.
- **SC-002**: In acceptance testing, 100% of archival attempts by unauthenticated users and by active roles other than organization administrator and operations administrator are denied with zero lifecycle changes.
- **SC-003**: In acceptance testing, 100% of archival attempts on trucks relied upon by a planned or active discharge are refused with the truck left available and a specific in-use reason shown.
- **SC-004**: In acceptance testing, 100% of archived trucks retain their registration, vehicle model, capacity, transport-company relationship, and prior reactivation context unchanged, and 100% of successful archivals record an archive time and responsible administrator.
- **SC-005**: In all acceptance datasets, repeated and near-simultaneous archival attempts on the same truck produce exactly one recorded archival, with zero archive contexts overwritten.
- **SC-006**: Every tested authorization, not-found, already-archived, in-use, validation, and transient-failure condition produces distinct and accurate feedback, and every transient failure can be recovered through a retry that archives the truck exactly once.
- **SC-007**: At least 90% of representative authorized administrators can archive an intended truck, or understand why they cannot, on their first attempt within 45 seconds of opening the truck.
- **SC-008**: In acceptance testing, 100% of multiple archivals containing a mix of eligible and ineligible trucks archive exactly the eligible trucks, leave every ineligible truck unchanged, and report a specific reason for each unchanged truck.
- **SC-009**: In all acceptance datasets, every truck archived within one multiple archival shares an identical archive time, responsible administrator, and comment, and no multiple archival ever leaves part of its eligible set archived after a failure.
- **SC-010**: An authorized administrator archiving ten selected trucks completes the action in fewer than half the confirmation steps required to archive them one at a time, and can retry the unchanged ones without reselecting the whole batch.

## Assumptions

- "Authorized administrator" means an active organization administrator or an active operations administrator, matching the truck write-access pattern established by Create a Truck (`#223`) and the archived-truck visibility rules established by List Trucks (`#222`).
- Archival is offered both for one truck at a time and for several selected trucks in one action. Multiple archival was added to this slice during specification review; it applies exactly the same eligibility rules as single archival and adds no new rule of its own.
- A multiple archival reports partial success rather than refusing everything when one truck is ineligible, matching the customer lifecycle precedent (`GH-195`) that administrators already use.
- Multiple archival requires a selection model in the truck consultation workspace, which List Trucks (`#222`) did not deliver; building it is part of this slice.
- The archive comment is optional free text, consistent with the customer lifecycle precedent (`GH-195`); its maximum length matches the existing site-reference lifecycle comment limit.
- Eligibility means the truck is currently available and is not relied upon by a planned or active discharge. No other eligibility rule (such as age, transport-company status, or capacity) restricts archival.
- Current truck usage is determined by the shared site-reference usage rule established by Enforce Persisted Site-Reference Usage Rules (`#240`), which already covers trucks and already excludes closed discharges and released reservations.
- Available and archived remain the only truck lifecycle states; archival is reversible only through Reactivate a Truck (`#226`), which is a separate delivery slice.
- Archival never deletes data. Permanent deletion of a truck is out of scope for this and every current truck slice.
- Each operating organization owns exactly one site, so the administrator's organization determines which trucks they may archive.
- Archiving a truck does not change its transport company, and the transport company's own lifecycle state neither blocks nor is affected by the truck's archival.
- API authorization and eligibility checks are authoritative for every rule in this specification; any interface-level restriction is a courtesy that does not replace server-side enforcement.
- Reactivate a Truck (`#226`) depends on this slice and is not implemented here; Update a Truck (`#224`) remains independent.
