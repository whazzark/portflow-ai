# Feature Specification: Reactivate a Transport Company

**Feature Branch**: `feat/221-reactivate-transport-company`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Let an authorized administrator reactivate an archived transport company, one company at a time or several at once. https://github.com/whazzark/portflow-ai/issues/221"

**Feature ID**: `GH-221`

**GitHub Issue**: [#221](https://github.com/whazzark/portflow-ai/issues/221)

**Parent Roadmap**: `specs/site-references/transport-resources/transport-companies/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bring an Archived Company Back Into Service (Priority: P1)

As an authorized administrator, I want to reactivate an archived transport company so that the site can work with that provider again — under its original identity and with its whole history intact — instead of creating a duplicate company that would split its records in two.

**Why this priority**: Restoring a provider without losing or duplicating its identity is the entire business outcome of the slice. Without it, a company archived by mistake or a contract that resumes forces administrators to create a look-alike company, which permanently fragments the transport history.

**Independent Test**: Sign in as an authorized administrator, open an archived transport company, confirm its reactivation with a comment, and verify that the company leaves the archived collection, returns to the available collection under the same identity and name, is offered again as a truck provider, and shows who reactivated it and when.

**Acceptance Scenarios**:

1. **Given** an archived transport company, **When** an authorized administrator confirms its reactivation, **Then** the company becomes available again and the administrator receives explicit confirmation.
2. **Given** a company was just reactivated, **When** any active user consults transport companies, **Then** the company appears again among available companies under the same identity and name, and no longer appears in the archived collection.
3. **Given** a company was just reactivated, **When** its details are inspected, **Then** they show that it is available, when it was reactivated, by whom, and the comment supplied at reactivation when one was given.
4. **Given** a company was just reactivated, **When** a truck is being created or its provider is being chosen, **Then** the company is offered again as a selectable provider.
5. **Given** an administrator opens the reactivation confirmation, **When** the confirmation is displayed, **Then** it states that the company will become selectable again for new operational use, and it offers an optional comment.
6. **Given** an administrator opens the reactivation confirmation, **When** the administrator abandons it, **Then** the company remains archived and entirely unchanged.
7. **Given** an archived company that provides archived trucks, **When** it is reactivated, **Then** the company becomes available and every one of its trucks keeps its own lifecycle state unchanged.

---

### User Story 2 - Be Blocked From Reactivating What Must Not Be Reactivated (Priority: P2)

As the operating organization, I want reactivation refused for users without administration rights, for companies that are already available, and for companies that do not exist, so that lifecycle rules and authorization stay trustworthy and an available company's history is never rewritten by a transition that never happened.

**Why this priority**: These guard rails are what make the reactivation record believable. They only matter once the successful path exists, but without them a repeated click would silently overwrite the actor and time of the real reactivation.

**Independent Test**: Attempt reactivation as an unauthenticated visitor, as an active non-administrator, on an already available company, and on a company that does not exist; verify each attempt is refused with the appropriate outcome and that no stored data changes.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** reactivation is attempted, **Then** it is refused and no transport-company data is exposed or modified.
2. **Given** an authenticated user whose access is not active or who holds no transport-company administration right, **When** reactivation is attempted, **Then** it is refused as unauthorized and the company is unchanged.
3. **Given** an active user without administration rights consults transport companies, **When** an archived company's details are displayed, **Then** no reactivate action is offered.
4. **Given** an already available transport company, **When** an administrator attempts to reactivate it, **Then** the attempt is refused as already available and any existing reactivation context is preserved unchanged.
5. **Given** a transport company identifier that does not exist, **When** an administrator attempts to reactivate it, **Then** the attempt is refused as not found without revealing other company data.
6. **Given** a reactivation comment longer than the allowed maximum length, **When** an administrator submits it, **Then** the reactivation is refused with a validation message and the company remains archived.

---

### User Story 3 - Bring Several Companies Back In One Action (Priority: P3)

As an authorized administrator restoring the transport-company reference after a bulk archival or a resumed framework contract, I want to select several archived companies and reactivate them in one action, and I want to be told exactly which ones came back and which ones were left untouched and why.

**Why this priority**: This is a throughput improvement on a behavior that must already be correct and safe on its own. It delivers standalone value once single reactivation and its guard rails exist, and it cannot be trusted before them. It is also the natural counterpart of the bulk archival already delivered for this resource.

**Independent Test**: Select a mix of companies — archived, already available, and unknown — reactivate them in one action, and verify that exactly the archived ones become available with shared lifecycle metadata, that every other one is reported individually with its reason, and that nothing about the blocked ones changed.

**Acceptance Scenarios**:

1. **Given** several archived transport companies, **When** an authorized administrator reactivates them in one action with a comment, **Then** all of them become available, each carries the same reactivation time, actor, and comment, and the administrator is told how many were reactivated.
2. **Given** a selection mixing archived companies with already available ones, **When** the administrator reactivates the selection, **Then** the archived companies become available, and each already available company is reported individually as already available with its existing reactivation context preserved.
3. **Given** a selection containing an identifier that does not exist, **When** the administrator reactivates the selection, **Then** that identifier is reported as not found and the other archived companies are still reactivated.
4. **Given** every company in the selection is blocked, **When** the administrator reactivates the selection, **Then** no company is reactivated, the administrator is told that nothing changed, and each blocking reason is reported.
5. **Given** an administrator has just reactivated a selection in which some companies were blocked, **When** the outcome is displayed, **Then** the blocked companies can be retried in place without reselecting them from the directory.
6. **Given** an administrator has selected companies, **When** the administrator abandons the confirmation, **Then** no company changes and the selection is preserved.
7. **Given** an active user without administration rights consults transport companies, **When** the directory is displayed, **Then** no multi-selection or bulk reactivate action is offered.
8. **Given** a selection of companies, **When** the administrator reactivates it, **Then** no truck of any selected company is modified.

### Edge Cases

- A company reactivated by another administrator after the confirmation was opened is refused on submission as already available rather than overwriting the first reactivation context; in a bulk action it is reported as blocked while its archived neighbours are still reactivated.
- A company archived again by another administrator after the confirmation was opened is still reactivated on submission, because eligibility is evaluated at submission time against stored state.
- Two administrators confirming the reactivation of the same company concurrently result in exactly one success and one already-available refusal; only one reactivation context is recorded. The same holds when one of them is reactivating that company as part of a larger selection.
- A reactivation comment consisting only of whitespace is treated as no comment rather than being stored as an empty text.
- A reactivation comment longer than the allowed maximum length is refused with a validation message and no company is reactivated, including in a bulk action.
- A bulk request carrying no company at all is refused as a validation error without changing anything.
- A bulk request naming the same company twice is refused as a validation error rather than reactivating it twice or reporting it twice.
- A bulk action never partially reactivates an individual company: each company is either fully reactivated with its lifecycle metadata or entirely untouched.
- A selection made in one lifecycle view stays meaningful when the administrator switches views: companies that are no longer eligible are reported as blocked rather than silently dropped.
- A reactivation that fails because the change could not be saved leaves every company in the request unchanged and offers the administrator a way to retry.
- A company reactivated a second time keeps a single most recent reactivation context rather than accumulating conflicting lifecycle information, and the context of its most recent archival remains readable as history.
- Reactivating a company does not bring back any of its trucks: trucks archived while the company was archived stay archived and must be reactivated through their own lifecycle.
- Historical discharges, truck records, and reports that referenced the company while it was archived are unaffected by the reactivation, and previously generated immutable report snapshots keep the values captured when they were produced.

## Requirements *(mandatory)*

### Functional Requirements

#### Reactivating one company

- **FR-001**: The system MUST allow a user holding transport-company administration rights within the operating organization to reactivate an existing archived transport company.
- **FR-002**: The system MUST deny reactivation to unauthenticated users, to users whose access is not active, and to authenticated users without transport-company administration rights.
- **FR-003**: The system MUST refuse the reactivation of a transport company that is already available, and MUST leave its existing lifecycle context unchanged.
- **FR-004**: The system MUST refuse the reactivation of a transport company that does not exist, without disclosing information about other companies.
- **FR-005**: The system MUST evaluate reactivation eligibility authoritatively at submission time, not from state captured when the reactivation experience was opened.
- **FR-006**: The system MUST NOT impose any additional lifecycle condition on reactivation: an archived company is reactivatable regardless of how many trucks it provides, of their lifecycle state, and of how long it has been archived.
- **FR-007**: The administrator MUST be able to supply an optional free-text comment explaining the reactivation.
- **FR-008**: The system MUST remove leading and trailing whitespace from the reactivation comment and MUST store a comment that is empty after trimming as no comment.
- **FR-009**: The system MUST reject a reactivation whose comment exceeds the maximum lifecycle comment length of 1,000 characters, leaving every targeted company archived.
- **FR-010**: A successful reactivation MUST record the available status, the reactivation time, the administrator who performed it, and the supplied comment when one was given.
- **FR-011**: A successful reactivation MUST replace any earlier reactivation context so that a company carries exactly one, most recent reactivation context.
- **FR-012**: A successful reactivation MUST preserve the company's stable identity, its current name, and the context of its most recent archival, which remains readable as history.
- **FR-013**: A reactivated transport company MUST be offered again for new operational use, including as the provider of a truck.
- **FR-014**: A reactivated transport company MUST appear again among available companies and MUST NOT appear among archived companies.
- **FR-015**: The system MUST preserve every existing association between the company and its trucks across a reactivation, and MUST NOT modify any truck record, in particular MUST NOT change any truck's lifecycle state.
- **FR-016**: A refused reactivation MUST leave the stored transport company, its lifecycle context, and its trucks entirely unchanged.
- **FR-017**: The reactivate experience MUST require an explicit confirmation, MUST state that the company becomes selectable again for new operational use, and MUST be offered only to users authorized to perform it, and only for archived companies.
- **FR-018**: The administrator MUST be able to abandon a reactivation in progress, leaving every targeted company unchanged.
- **FR-019**: The system MUST report the outcome of a reactivation attempt to the administrator, distinguishing success, already available, company not found, comment validation failure, unauthorized access, and retryable save failure.
- **FR-020**: Authorization and lifecycle decisions MUST be enforced authoritatively by the system regardless of what the user experience offers.

#### Reactivating several companies at once

- **FR-021**: The system MUST allow an authorized administrator to reactivate several transport companies in one action.
- **FR-022**: A bulk reactivation MUST be authorized by exactly the same administration right as reactivating one company, and MUST be denied to every other user.
- **FR-023**: A bulk reactivation MUST evaluate each company independently against the same rules that govern reactivating one company: existence and current lifecycle state.
- **FR-024**: A bulk reactivation MUST reactivate every eligible company in the request even when other companies in the same request are blocked.
- **FR-025**: A bulk reactivation MUST report, for every company that was not reactivated, its identity and the individual reason it was blocked, distinguishing already available and not found.
- **FR-026**: A bulk reactivation MUST leave every blocked company, its lifecycle context, and its trucks entirely unchanged.
- **FR-027**: Every company reactivated by one bulk request MUST carry the same reactivation time, the same administrator, and the same comment.
- **FR-028**: A bulk reactivation MUST NOT partially reactivate an individual company: each company is either reactivated with its complete lifecycle metadata or left untouched.
- **FR-029**: The system MUST reject a bulk request that names no company, and MUST reject a bulk request that names the same company more than once, in both cases without changing anything.
- **FR-030**: The system MUST report the aggregate outcome of a bulk reactivation to the administrator, stating how many companies were reactivated and how many were left unchanged.
- **FR-031**: The administrator MUST be able to retry the blocked companies of a bulk reactivation without reselecting them from the directory.
- **FR-032**: The multi-selection and bulk reactivate experience MUST be offered only to users authorized to reactivate, and MUST NOT interfere with selecting a single company to consult it or to scope its trucks.
- **FR-033**: A bulk reactivation MUST evaluate eligibility at submission time against authoritative stored state, not against the collection the administrator was looking at.

#### Out of scope

- **FR-034**: This slice MUST NOT create, rename, archive, permanently delete, import, or synchronize transport companies, and MUST NOT create, update, archive, or reactivate trucks.

### Key Entities *(include if feature involves data)*

- **Transport Company**: A site reference representing a company that operationally provides trucks. It carries a stable identity, a current company name, and a lifecycle status; this feature changes only that status from archived to available.
- **Transport Company Lifecycle Context**: The archival and reactivation information attached to a company — when each transition happened, by whom, and with which optional comment. A company carries at most one most recent archival context and at most one most recent reactivation context; a successful reactivation writes the latter and preserves the former. Companies reactivated by the same bulk action share an identical reactivation context.
- **Truck**: A vehicle provided by exactly one transport company. Its own lifecycle status is independent of its company's; no truck is read for writing or modified by this feature.
- **Bulk Reactivation Outcome**: The result of reactivating a selection — the companies that were reactivated, and for each company that was not, its identity and its individual blocking reason. It is what the administrator reads to know what happened and what to retry.
- **Administrator**: An authenticated user with active access and transport-company administration rights within the operating organization; the only actor permitted to reactivate a company, alone or in bulk.
- **Operating Site**: The operational scope that owns transport-company references and bounds which records an administrator may reactivate.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of reactivation attempts by authorized administrators on archived companies succeed, and 100% of attempts by unauthenticated visitors, non-active users, and active non-administrators are refused without any data change, for single and bulk reactivation alike.
- **SC-002**: In acceptance testing, 100% of attempts to reactivate an already available or non-existent company are refused with the corresponding outcome and leave stored data unchanged, including any previously recorded reactivation context.
- **SC-003**: Across all acceptance datasets, 100% of reactivated transport companies appear among companies selectable for new operational use, including as truck providers, and 0% of them remain in the archived collection.
- **SC-004**: In all acceptance datasets, 100% of reactivated companies keep their identity, their name, and their most recent archival context, 100% of their truck associations are unchanged, and 0% of trucks change lifecycle state as a result of a reactivation.
- **SC-005**: In acceptance testing, 100% of archived companies are reactivatable irrespective of the number and lifecycle state of the trucks they provide, confirming that no additional lifecycle condition blocks reactivation.
- **SC-006**: Every tested refusal condition — already available, company not found, over-long comment, empty selection, duplicated selection, unauthorized access, and retryable save failure — produces a distinct, understandable message, and 100% of retryable failures can be recovered through the offered retry.
- **SC-007**: A company reactivated twice carries exactly one reactivation context in 100% of tested runs, and it is the most recent one.
- **SC-008**: At least 90% of representative administrators can locate an archived company and complete or deliberately abandon its reactivation on their first attempt within 60 seconds.
- **SC-009**: For 95% of reactivation submissions under normal operating conditions, the administrator sees a confirmed result or an explicit refusal within 2 seconds.
- **SC-010**: Under concurrent reactivation of the same company, exactly one attempt succeeds and exactly one reactivation context is recorded in 100% of tested runs, whether the competing attempts are single or bulk.
- **SC-011**: In a bulk acceptance matrix mixing archived, already-available, and unknown companies, 100% of archived companies are reactivated and 100% of blocked companies are reported with their correct individual reason and left unchanged, in every tested combination including the all-blocked case.
- **SC-012**: Reactivating a selection of 100 companies completes within 2 seconds in the acceptance environment, and all reactivated companies in that request share one identical reactivation time, actor, and comment.
- **SC-013**: At least 90% of representative administrators can select several archived companies, reactivate them, and correctly state from the reported outcome which ones were not reactivated and why, on their first attempt.

## Assumptions

- "Authorized administrator" means an authenticated user with active access holding an organization-level or operations-level administration role — exactly the right that already governs transport-company creation, update, and archival, and the other site references' reactivation journeys.
- Each operating organization owns exactly one site, so the administrator's organization determines the site scope for transport-company records.
- Reactivation is the exact counterpart of archival (#220): it has no blocking lifecycle rule of its own. The available-truck rule recorded in `CONTEXT.md` constrains archiving a company, never restoring one, so an archived company is always reactivatable by an authorized administrator.
- A company's name stays reserved while it is archived — the site cannot give that name to another company in the meantime — so a reactivation can never produce a name conflict and no name-uniqueness refusal is specified.
- Reactivating a company deliberately does not touch its trucks. Trucks archived while the company was archived stay archived and are restored, if wanted, through the separate truck reactivation slice; the site therefore gets back an available provider that may temporarily provide no available truck, which is an accepted state.
- The reactivation comment is optional and follows the maximum lifecycle comment length of 1,000 characters already applied to customer, dock, weighing-area, and transport-company lifecycle actions. One comment applies to the whole request, whether it names one company or many.
- Reactivation records who reactivated the company and when, following the `CONTEXT.md` definition of Site Reference Reactivation and the lifecycle metadata already captured by the delivered customer, dock, and weighing-area reactivation journeys.
- Bulk reactivation follows the partial-success model already delivered for customers and mirrored by transport-company bulk archival: the request succeeds as a whole, eligible records are reactivated, and blocked records are returned with an individual reason rather than failing the entire request.
- No explicit maximum number of companies per bulk request is imposed, following the shared selection rule already used for customer and transport-company bulk lifecycle actions. Realistic selections are bounded by the site's low-cardinality reference collection.
- Multi-selection is a distinct concept from selecting one company to consult it or to scope its trucks; the two coexist without one overriding the other, exactly as delivered for bulk archival.
- Transport-company consultation (#217) is delivered, so archived companies already have a readable destination from which the reactivate action can be offered, and archival (#220) is delivered, so archived companies exist to reactivate.
- Site references are never permanently deleted; this slice completes the transport-company lifecycle loop opened by #220.
- Transport-company listing (#217), creation (#218), update (#219), and archival (#220) are independently deliverable sibling issues and stay outside this slice.
