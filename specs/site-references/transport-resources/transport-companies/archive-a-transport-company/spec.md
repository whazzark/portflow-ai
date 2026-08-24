# Feature Specification: Archive a Transport Company

**Feature Branch**: `feat/220-archive-transport-company-2`

**Created**: 2026-08-24

**Last Updated**: 2026-08-24 — bulk archival added to scope

**Status**: Draft

**Input**: User description: "Let an authorized administrator archive a company only when its lifecycle rules allow it, one company at a time or several at once. https://github.com/whazzark/portflow-ai/issues/220"

**Feature ID**: `GH-220`

**GitHub Issue**: [#220](https://github.com/whazzark/portflow-ai/issues/220)

**Parent Roadmap**: `specs/site-references/transport-resources/transport-companies/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retire a Company That No Longer Provides Trucks (Priority: P1)

As an authorized administrator, I want to archive an available transport company that no longer provides any available truck so that operational users stop selecting a provider the site no longer works with, while the company remains readable for history.

**Why this priority**: Retiring an obsolete provider without losing its history is the primary business outcome of the slice; without it, unusable companies stay selectable and pollute every operational choice.

**Independent Test**: Sign in as an authorized administrator, open an available transport company whose trucks are all archived or that has no truck at all, confirm the archive with a comment, and verify that the company leaves the available collection, appears in the archived collection with its archival context, and is no longer offered for new operational use.

**Acceptance Scenarios**:

1. **Given** an available transport company that provides no available truck, **When** an authorized administrator confirms its archival, **Then** the company becomes archived and the administrator receives explicit confirmation.
2. **Given** a company was just archived, **When** any active user consults transport companies, **Then** the company no longer appears among available companies and is readable in the archived collection under the same identity and name.
3. **Given** a company was just archived, **When** its details are inspected, **Then** they show that it is archived, when it was archived, by whom, and the comment supplied at archival when one was given.
4. **Given** an administrator opens the archive confirmation for an eligible company, **When** the confirmation is displayed, **Then** it states that the company will remain readable but will no longer be selectable for new operational use, and it offers an optional comment.
5. **Given** an administrator opens the archive confirmation, **When** the administrator abandons it, **Then** the company remains available and entirely unchanged.
6. **Given** an archived transport company, **When** a truck is being created or its provider is being chosen, **Then** the archived company is not offered as a selectable provider.

---

### User Story 2 - Be Prevented From Archiving a Company Still Providing Trucks (Priority: P2)

As the operating organization, I want archival refused for a company that still provides at least one available truck so that no truck is left with a retired provider and current operations stay consistent.

**Why this priority**: The lifecycle rule is what makes archival safe; archiving a company that still provides available trucks would leave operational records pointing at a retired reference.

**Independent Test**: Attempt to archive a company that provides one available truck and verify the attempt is refused with an actionable reason naming the blocking condition, that the company stays available, and that the same company becomes archivable once its last available truck is archived.

**Acceptance Scenarios**:

1. **Given** an available transport company providing at least one available truck, **When** an authorized administrator attempts to archive it, **Then** the archival is refused, the message explains that the company still provides available trucks, and the company remains available.
2. **Given** an archival was refused because of available trucks, **When** the company and its trucks are inspected, **Then** neither the company nor any truck has changed in any way.
3. **Given** a company whose only trucks are archived, **When** an authorized administrator attempts to archive it, **Then** the archival succeeds because archived trucks do not block the company's archival.
4. **Given** a company providing no truck at all, **When** an authorized administrator attempts to archive it, **Then** the archival succeeds.
5. **Given** a company whose available trucks are reserved by a planned or active discharge, **When** an authorized administrator attempts to archive it, **Then** the archival is refused for the same available-truck reason and current operations are unaffected.

---

### User Story 3 - Be Blocked From Archiving What Must Not Be Archived (Priority: P3)

As the operating organization, I want archival refused for users without administration rights, for companies that are already archived, and for companies that no longer exist so that lifecycle rules and authorization remain trustworthy.

**Why this priority**: These guard rails protect the integrity of the reference data, but they only matter once the successful archival path and its lifecycle rule exist.

**Independent Test**: Attempt archival as an unauthenticated visitor, as an active non-administrator, on an already archived company, and on a company removed in the meantime; verify each attempt is refused with the appropriate outcome and that no data changes.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** archival is attempted, **Then** it is refused and no transport-company data is exposed or modified.
2. **Given** an authenticated user whose access is not active or who holds no transport-company administration right, **When** archival is attempted, **Then** it is refused as unauthorized and the company is unchanged.
3. **Given** an active user without administration rights consults transport companies, **When** the company details are displayed, **Then** no archive action is offered.
4. **Given** an already archived transport company, **When** an administrator attempts to archive it, **Then** the attempt is refused as already archived and the existing archival context is preserved unchanged.
5. **Given** a transport company identifier that does not exist, **When** an administrator attempts to archive it, **Then** the attempt is refused as not found without revealing other company data.

---

### User Story 4 - Retire Several Companies in One Action (Priority: P4)

As an authorized administrator cleaning up the transport-company reference after a contract review, I want to select several companies and archive them in one action so that I do not have to repeat the same confirmation dozens of times, and I want to be told exactly which ones were archived and which ones were left untouched and why.

**Why this priority**: This is a throughput improvement on a behavior that must already be correct and safe on its own. It delivers standalone value once single archival, its lifecycle rule, and its guard rails exist, and it cannot be trusted before them.

**Independent Test**: Select a mix of companies — eligible, still providing available trucks, already archived, and unknown — archive them in one action, and verify that exactly the eligible ones are archived with shared lifecycle metadata, that every other one is reported individually with its reason, and that nothing about the blocked ones changed.

**Acceptance Scenarios**:

1. **Given** several available transport companies that provide no available truck, **When** an authorized administrator archives them in one action with a comment, **Then** all of them become archived, each carries the same archival time, actor, and comment, and the administrator is told how many were archived.
2. **Given** a selection mixing eligible companies with companies that still provide available trucks, **When** the administrator archives the selection, **Then** the eligible companies are archived, the blocking ones remain available, and each blocked company is reported individually with the available-truck reason.
3. **Given** a selection containing an already archived company, **When** the administrator archives the selection, **Then** that company is reported as already archived, its existing archival context is preserved, and the other eligible companies are still archived.
4. **Given** a selection containing an identifier that does not exist, **When** the administrator archives the selection, **Then** that identifier is reported as not found and the other eligible companies are still archived.
5. **Given** every company in the selection is blocked, **When** the administrator archives the selection, **Then** no company is archived, the administrator is told that nothing changed, and each blocking reason is reported.
6. **Given** an administrator has just archived a selection in which some companies were blocked, **When** the outcome is displayed, **Then** the blocked companies can be retried in place without reselecting them from the directory.
7. **Given** an administrator has selected companies, **When** the administrator abandons the confirmation, **Then** no company changes and the selection is preserved.
8. **Given** an active user without administration rights consults transport companies, **When** the directory is displayed, **Then** no multi-selection or bulk archive action is offered.

### Edge Cases

- A company archived by another administrator after the confirmation was opened is refused on submission as already archived rather than overwriting the first archival context; in a bulk action it is reported as blocked while its eligible neighbours are still archived.
- A truck attached to the company becomes available again after the confirmation was opened but before submission: the archival is refused for the available-truck reason evaluated at submission time.
- A company's last available truck is archived after the confirmation was opened: the archival succeeds because eligibility is evaluated at submission time.
- Two administrators confirming the archival of the same company concurrently result in exactly one success and one already-archived refusal; only one archival context is recorded. The same holds when one of them is archiving that company as part of a larger selection.
- An archival comment consisting only of whitespace is treated as no comment rather than being stored as an empty text.
- An archival comment longer than the allowed maximum length is refused with a validation message and no company is archived, including in a bulk action.
- A bulk request carrying no company at all is refused as a validation error without changing anything.
- A bulk request naming the same company twice is refused as a validation error rather than archiving it twice or reporting it twice.
- A bulk action never partially archives a single company: each company is either fully archived with its lifecycle metadata or entirely untouched.
- A selection made in one lifecycle view stays meaningful when the administrator switches views: companies that are no longer eligible are reported as blocked rather than silently dropped.
- An archival that fails because the change could not be saved leaves every company in the request unchanged and offers the administrator a way to retry.
- Archived companies remain readable in historical discharges, truck records, and reports, and previously generated immutable report snapshots keep the company values captured at the time they were produced.
- A company that was archived and is later reactivated keeps a single most recent archival context rather than accumulating conflicting lifecycle information.

## Requirements *(mandatory)*

### Functional Requirements

#### Archiving one company

- **FR-001**: The system MUST allow a user holding transport-company administration rights within the operating organization to archive an existing available transport company.
- **FR-002**: The system MUST deny archival to unauthenticated users, to users whose access is not active, and to authenticated users without transport-company administration rights.
- **FR-003**: The system MUST refuse the archival of a transport company that still provides at least one available truck, and MUST report that reason explicitly.
- **FR-004**: Trucks that are archived MUST NOT block the archival of the transport company that provides them.
- **FR-005**: A transport company providing no truck at all MUST be archivable.
- **FR-006**: The system MUST evaluate archival eligibility authoritatively at submission time, not from state captured when the archive experience was opened.
- **FR-007**: The system MUST refuse the archival of a transport company that is already archived, and MUST leave its existing archival context unchanged.
- **FR-008**: The system MUST refuse the archival of a transport company that does not exist, without disclosing information about other companies.
- **FR-009**: The administrator MUST be able to supply an optional free-text comment explaining the archival.
- **FR-010**: The system MUST remove leading and trailing whitespace from the archival comment and MUST store a comment that is empty after trimming as no comment.
- **FR-011**: The system MUST reject an archival whose comment exceeds the maximum lifecycle comment length of 1,000 characters, leaving every targeted company available.
- **FR-012**: A successful archival MUST record the archived status, the archival time, the administrator who performed it, and the supplied comment when one was given.
- **FR-013**: A successful archival MUST preserve the company's stable identity and current name.
- **FR-014**: An archived transport company MUST remain readable in transport-company consultation, in its details, and wherever it is referenced historically.
- **FR-015**: An archived transport company MUST NOT be offered for new operational use, including as the provider of a truck.
- **FR-016**: The system MUST preserve every existing association between the company and its trucks across an archival; no truck record may be modified by this feature.
- **FR-017**: The system MUST NOT permanently delete a transport company.
- **FR-018**: A refused archival MUST leave the stored transport company, its lifecycle context, and its trucks entirely unchanged.
- **FR-019**: The archive experience MUST require an explicit confirmation, MUST state that the company remains readable but is no longer selectable for new operational use, and MUST be offered only to users authorized to perform it.
- **FR-020**: The administrator MUST be able to abandon an archival in progress, leaving every targeted company unchanged.
- **FR-021**: The system MUST report the outcome of an archival attempt to the administrator, distinguishing success, available-truck conflict, already archived, company not found, comment validation failure, unauthorized access, and retryable save failure.
- **FR-022**: Authorization and lifecycle decisions MUST be enforced authoritatively by the system regardless of what the user experience offers.

#### Archiving several companies at once

- **FR-023**: The system MUST allow an authorized administrator to archive several transport companies in one action.
- **FR-024**: A bulk archival MUST be authorized by exactly the same administration right as archiving one company, and MUST be denied to every other user.
- **FR-025**: A bulk archival MUST evaluate each company independently against the same rules that govern archiving one company: existence, current lifecycle state, and the available-truck rule.
- **FR-026**: A bulk archival MUST archive every eligible company in the request even when other companies in the same request are blocked.
- **FR-027**: A bulk archival MUST report, for every company that was not archived, its identity and the individual reason it was blocked, distinguishing available-truck conflict, already archived, and not found.
- **FR-028**: A bulk archival MUST leave every blocked company, its lifecycle context, and its trucks entirely unchanged.
- **FR-029**: Every company archived by one bulk request MUST carry the same archival time, the same administrator, and the same comment.
- **FR-030**: A bulk archival MUST NOT partially archive an individual company: each company is either archived with its complete lifecycle metadata or left untouched.
- **FR-031**: The system MUST reject a bulk request that names no company, and MUST reject a bulk request that names the same company more than once, in both cases without changing anything.
- **FR-032**: The system MUST report the aggregate outcome of a bulk archival to the administrator, stating how many companies were archived and how many were left unchanged.
- **FR-033**: The administrator MUST be able to retry the blocked companies of a bulk archival without reselecting them from the directory.
- **FR-034**: The multi-selection and bulk archive experience MUST be offered only to users authorized to archive, and MUST NOT interfere with selecting a single company to consult it or to scope its trucks.
- **FR-035**: A bulk archival MUST evaluate eligibility at submission time against authoritative stored state, not against the collection the administrator was looking at.

#### Out of scope

- **FR-036**: This slice MUST NOT create, rename, reactivate, permanently delete, import, or synchronize transport companies, and MUST NOT create, update, or archive trucks.

### Key Entities *(include if feature involves data)*

- **Transport Company**: A site reference representing a company that operationally provides trucks. It carries a stable identity, a current company name, and a lifecycle status; this feature changes only that status from available to archived.
- **Transport Company Lifecycle Context**: The archival information attached to a company — when it was archived, by whom, and an optional comment — recorded by a successful archival and preserved by every refused attempt. Companies archived by the same bulk action share identical context.
- **Truck**: A vehicle provided by exactly one transport company. Its own lifecycle status determines whether it blocks its company's archival; no truck is modified by this feature.
- **Bulk Archival Outcome**: The result of archiving a selection — the companies that were archived, and for each company that was not, its identity and its individual blocking reason. It is what the administrator reads to know what happened and what to retry.
- **Administrator**: An authenticated user with active access and transport-company administration rights within the operating organization; the only actor permitted to archive a company, alone or in bulk.
- **Operating Site**: The operational scope that owns transport-company references and bounds which records an administrator may archive.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of archival attempts by authorized administrators on eligible companies succeed, and 100% of attempts by unauthenticated visitors, non-active users, and active non-administrators are refused without any data change, for single and bulk archival alike.
- **SC-002**: In acceptance testing, 100% of attempts to archive a company that still provides at least one available truck are refused with the available-truck reason, and 100% of companies whose trucks are all archived or that have no truck are archived successfully.
- **SC-003**: In acceptance testing, 100% of attempts to archive an already archived or non-existent company are refused with the corresponding outcome and leave stored data unchanged.
- **SC-004**: Across all acceptance datasets, 0% of archived transport companies appear among companies selectable for new operational use, and 100% of them remain readable in consultation and historical records.
- **SC-005**: In all acceptance datasets, 100% of archived companies keep their identity and name, 100% of their truck associations are unchanged, and 0% of transport companies are permanently deleted.
- **SC-006**: Every tested refusal condition — available trucks, already archived, company not found, over-long comment, empty selection, duplicated selection, unauthorized access, and retryable save failure — produces a distinct, understandable message, and 100% of retryable failures can be recovered through the offered retry.
- **SC-007**: At least 90% of representative administrators can locate a company and complete or deliberately abandon its archival on their first attempt within 60 seconds.
- **SC-008**: For 95% of archival submissions under normal operating conditions, the administrator sees a confirmed result or an explicit refusal within 2 seconds.
- **SC-009**: Under concurrent archival of the same company, exactly one attempt succeeds and exactly one archival context is recorded in 100% of tested runs, whether the competing attempts are single or bulk.
- **SC-010**: In a bulk acceptance matrix mixing eligible, truck-blocked, already-archived, and unknown companies, 100% of eligible companies are archived and 100% of blocked companies are reported with their correct individual reason and left unchanged, in every tested combination including the all-blocked case.
- **SC-011**: Archiving a selection of 100 companies completes within 2 seconds in the acceptance environment, and all archived companies in that request share one identical archival time, actor, and comment.
- **SC-012**: At least 90% of representative administrators can select several companies, archive them, and correctly state from the reported outcome which ones were not archived and why, on their first attempt.

## Assumptions

- "Authorized administrator" means an authenticated user with active access holding an organization-level or operations-level administration role, consistent with the administration rights already governing transport-company creation and update and the other site references.
- Each operating organization owns exactly one site, so the administrator's organization determines the site scope for transport-company records.
- The lifecycle rule for transport companies is the domain rule already recorded in `CONTEXT.md`: a transport company cannot be archived while it still provides available trucks. Because a truck reserved by a planned or active discharge is necessarily available, that rule also protects current discharges without a separate transport-company usage check.
- Truck availability is the truck's own lifecycle status, so a company blocked by an available truck becomes archivable once that truck is archived, which is a separate truck-lifecycle slice outside this issue.
- The archival comment is optional and follows the maximum lifecycle comment length of 1,000 characters already applied to customer, dock, and weighing-area archival. One comment applies to the whole request, whether it names one company or many.
- Bulk archival follows the partial-success model already delivered for customers: the request succeeds as a whole, eligible records are archived, and blocked records are returned with an individual reason rather than failing the entire request.
- No explicit maximum number of companies per bulk request is imposed, following the shared selection rule already used for customer bulk lifecycle actions. Realistic selections are bounded by the site's low-cardinality reference collection.
- Multi-selection is a distinct concept from selecting one company to consult it or to scope its trucks; the two coexist without one overriding the other.
- Archival records who archived the company, when, and the optional comment, following the lifecycle metadata already captured by the other site-reference archive journeys.
- Site references are never permanently deleted; archival is reversible only through the separate reactivation slice #221. Bulk reactivation is likewise owned by #221.
- Reactivating an archived company replaces its most recent lifecycle context rather than accumulating history, consistent with the existing site-reference lifecycle model.
- Transport-company consultation (#217) is delivered, so archived companies already have a readable destination and the archive action has a place to be offered.
- Transport-company listing (#217), creation (#218), update (#219), and reactivation (#221) are independently deliverable sibling issues and stay outside this slice.
