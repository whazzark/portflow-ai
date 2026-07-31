# Feature Specification: Administer Customers From the Web Workbench

**Feature ID**: `GH-37`
**GitHub Issue**: [#37](https://github.com/whazzark/portflow-ai/issues/37)
**Parent Roadmap**: `specs/site-references/customers/roadmap.md`
**Roadmap Entry**: `GH-37`
**Created**: 2026-07-28
**Status**: `Spec Draft`
**Priority**: `priority:P0`
**Milestone**: `1. Construire le socle des référentiels`
**Domain**: `site-references`

## User Scenarios & Testing

The primary actor is an active application user. A customer is a site reference representing a company and is not an application user. Organization Admins and Operations Admins are the only actors allowed to change customer records.

### User Story 1 - Consult the customer reference (Priority: P1)

As an active application user, I want to browse and search site customers so that I can select the correct customer during discharge preparation and inspect the site's reference data.

**Independent Test**: With an active user session, verify that the customer workbench can list, search, sort, and inspect available and archived customers, including its empty and retryable-error states.

**Acceptance Scenarios**:

1. **Given** an active user and available customers, **When** they open the customer workbench, **Then** the available customers are displayed with their code, company name, and lifecycle status.
2. **Given** archived customers exist, **When** the user opens the archived view, **Then** archived customers remain consultable and their lifecycle metadata is visible, but edit controls are absent.
3. **Given** a search term, status view, and sort choice, **When** the user refreshes or shares the workbench URL, **Then** the same view can be restored and invalid combinations are safely normalized.
4. **Given** no customers match the search or no customers exist, **When** the user views the result, **Then** the workbench distinguishes an empty dataset from no search results and explains the next useful action.

### User Story 2 - Maintain available customer identity (Priority: P1)

As an Organization Admin or Operations Admin, I want to create and edit available customers so that discharge preparation uses accurate customer references.

**Independent Test**: As each authorized administrator role, create one customer and update each identity field through the workbench; verify the saved record and validation feedback through the service boundary and browser behavior.

**Acceptance Scenarios**:

1. **Given** an authorized administrator, **When** they submit a valid customer code and company name, **Then** an available customer is created and appears in the available list.
2. **Given** an available customer, **When** an authorized administrator changes its code or company name with valid values, **Then** the same customer identity is updated and its lifecycle status remains available.
3. **Given** blank, whitespace-only, overlong, or duplicate identity values, **When** the administrator submits the form, **Then** the customer is not changed and the workbench identifies the invalid field or duplicate conflict.
4. **Given** an archived customer, **When** an administrator opens it, **Then** the customer can be viewed but cannot enter an edit state until it is reactivated.

### User Story 3 - Manage customer availability safely (Priority: P1)

As an Organization Admin or Operations Admin, I want to archive and reactivate customers individually or in groups so that obsolete references cannot be selected for new work while historical data remains intact.

**Independent Test**: Exercise individual and mixed grouped lifecycle actions with available, archived, missing, and in-use customers; verify changed records, blocked records, reasons, persisted metadata, and refreshed workbench state.

**Acceptance Scenarios**:

1. **Given** an available customer with no planned or active discharge reference, **When** an authorized administrator confirms archive, **Then** the customer becomes archived, is excluded from available selections, and remains visible in the archived view.
2. **Given** an archived customer, **When** an authorized administrator confirms reactivation, **Then** it becomes available with its identity preserved and can be selected for new work.
3. **Given** a customer referenced by a planned or active discharge, **When** an administrator attempts to archive it, **Then** the customer remains available and the workbench reports that operational reference as the blocking reason.
4. **Given** a selection containing eligible and blocked customers, **When** an authorized administrator confirms a grouped archive or reactivate action, **Then** eligible customers transition, blocked customers remain unchanged, and each blocked customer is reported separately with an actionable reason.
5. **Given** a customer has become stale or unavailable since it was displayed, **When** the administrator submits a lifecycle action, **Then** the service boundary preserves the authoritative state, reports the conflict or missing record, and the workbench refreshes without presenting the failed record as changed.

## Edge Cases

- Unauthenticated users cannot access customer data or actions; authenticated users without an administration role may consult but cannot mutate, even if a stale screen shows a mutation control.
- A customer code and company name are required, trimmed, non-blank strings with a maximum length of 255 characters; each is unique without regard to case. Normalized blank lifecycle comments are stored as absent.
- A grouped request with an empty selection, malformed identifier, duplicate identifier, or invalid comment is rejected as a whole before any lifecycle change. A valid mixed selection is partially successful: eligible records change and blocked records do not.
- Grouped results preserve the request order within changed and blocked groups. Missing records expose their selected identity and a not-found reason without inventing labels.
- Repeating archive on an archived customer or reactivation on an available customer does not change the record and returns an explicit already-in-state outcome.
- A failed or interrupted mutation leaves customer state and lifecycle metadata unchanged for that record. Retry is safe and never silently duplicates a lifecycle transition.
- A lifecycle comment is optional, trimmed, and limited to 1,000 characters; it is shown as consultation metadata when present.
- Every accepted archive and reactivation records the actor and server time. Historical customer identity and references are retained; permanent deletion is not available.
- List, detail, form, confirmation, loading, retryable-error, and grouped-result feedback states are keyboard-operable, have accessible names and labels, preserve focus sensibly, and announce validation or mutation errors.

## Requirements

### Functional Requirements

- **FR-001**: The customer workbench MUST provide separate consultation views for available and archived customers, with search, sorting, detail inspection, and clear empty, no-result, loading, and retryable-error states.
- **FR-002**: The authoritative service boundary MUST allow any active application user to consult customers and MUST authorize customer creation, modification, archive, and reactivation only for Organization Admins and Operations Admins.
- **FR-003**: The workbench MUST allow an authorized administrator to create a customer with a required code and company name, and to modify those identity fields only while the customer is available.
- **FR-004**: Customer identity validation MUST trim input, reject blank values, enforce the stated length limit, and enforce case-insensitive uniqueness without changing the customer on failure.
- **FR-005**: The workbench MUST support individual archive and reactivation actions with confirmation and an optional lifecycle comment.
- **FR-006**: The workbench MUST support selection-scoped grouped archive and reactivation actions; creation and modification MUST remain individual operations.
- **FR-007**: An archive operation MUST succeed only when the customer has no reference from a planned or active discharge. Reactivation MUST restore availability without creating a new customer identity.
- **FR-008**: A grouped lifecycle operation MUST commit each eligible transition, leave blocked or invalid records unchanged, and return a structured result identifying every changed and blocked record with one actionable reason.
- **FR-009**: Accepted lifecycle changes MUST preserve customer identity and historical references, update the current lifecycle state, and record the acting user, server time, and optional comment.
- **FR-010**: The workbench MUST refresh affected lists and detail data after mutation, clear successfully changed selections, retain blocked selections for recovery, and never present an unauthorized or failed mutation as successful.
- **FR-011**: The workbench MUST keep navigable filters, sorting, status view, selected detail, and detail mode restorable through the URL while normalizing invalid combinations without exposing inaccessible records.
- **FR-012**: The service boundary MUST expose stable, field-addressable validation and business-error information so the workbench can present failures without reimplementing authorization or lifecycle rules.
- **FR-013**: Customer administration interactions MUST satisfy the project's supported accessibility expectations for keyboard operation, labels, focus management, status announcements, confirmations, and error presentation.
- **FR-014**: Verification MUST cover business rules at the domain/application seam, authorization and error behavior at the service boundary, and primary consultation and mutation journeys in the web workbench.

### Key Entities

- **Customer**: A reusable site reference for a company, identified by a stable identity, normalized code, and company name.
- **Available Site Reference**: A customer that may be selected for new operational use and may be edited or archived when lifecycle rules permit.
- **Archived Resource**: A retained, consultation-only customer unavailable for new operational use until reactivated.
- **Site Reference Reactivation**: The lifecycle transition that restores an archived customer without replacing its identity or history.
- **Lifecycle Metadata**: The latest archive/reactivation actor, time, and optional comment retained for consultation and traceability.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of authorized consultation, creation, modification, individual lifecycle, and grouped lifecycle scenarios produce the specified observable result, including failure and recovery paths.
- **SC-002**: 100% of unauthorized mutation attempts are refused by the authoritative service boundary, regardless of whether the workbench displays a stale mutation affordance.
- **SC-003**: For a grouped action containing both eligible and blocked records, 100% of eligible records transition, 100% of blocked records remain unchanged, and every record appears exactly once in the appropriate result group.
- **SC-004**: An administrator can locate a known customer, open its details, and begin the intended lifecycle action within 60 seconds using keyboard or pointer input.
- **SC-005**: After an accepted mutation, the workbench shows the resulting state and lifecycle metadata within 2 seconds in the normal test environment, without requiring a full-page reload.
- **SC-006**: Archived customers remain available for consultation and historical reference resolution throughout their retention period, and no customer is permanently deleted by this feature.

## Dependencies

- Parent roadmap: `specs/site-references/customers/roadmap.md`.
- Customer identity and lifecycle domain terms in `CONTEXT.md`, especially `Site Reference`, `Available Site Reference`, `Archived Resource`, and `Site Reference Reactivation`.
- Customer foundation slices GH-35 and GH-36, which establish the customer record and lifecycle rules used here; this feature owns their web-workbench administration surface and must not duplicate their business invariants.
- Discharge preparation slice GH-53, which must replace the temporary no-discharge usage adapter with a persistence-backed checker before it introduces the first durable planned or active discharge reference.
- [ADR 0003](../../../../docs/adr/0003-single-site-without-tenant-isolation.md), [ADR 0005](../../../../docs/adr/0005-tuyau-api-web-contract.md), and [ADR 0008](../../../../docs/adr/0008-vertical-slice-web-frontend-with-explicit-ui-adapters.md).

## Out of Scope

- Customer-user accounts, invitations, roles, or application-user administration.
- Permanent deletion or destructive removal of customer records or historical references.
- Administration of transport companies, trucks, docks, weighing areas, warehouses, or warehouse doors.
- Bulk customer creation or modification.
- Introducing tenant or multi-site isolation beyond the existing single-site boundary.

## Assumptions and Clarifications

- The workbench is the authenticated customer administration screen at `/customers`; its visible controls are a convenience and the authoritative service boundary decides access.
- Available and archived customers are both consultable, but only available customers are selectable for new operational use and editable.
- One optional comment supplied for a grouped lifecycle action applies to every customer that successfully transitions in that action.
- Grouped lifecycle operations use partial success for valid selections; malformed request-level input is rejected before any record changes.
- Customer identity fields use the existing site-reference conventions: trimmed values, 255-character maximum, and case-insensitive uniqueness.
- **Approved delivery clarification (2026-07-28)**: GH-37 preserves FR-007 through the `SiteReferenceUsageChecker` boundary and verifies both blocked and unblocked outcomes with injected adapters. Because the current schema cannot persist a discharge or customer-discharge reference, production temporarily binds that boundary to `NoDischargeSiteReferenceUsageChecker`. GH-53 is not merge-ready until it replaces this adapter atomically with its persistence-backed discharge model; no deployment may persist such references while the no-discharge adapter remains active.

## Traceability

- Source issue: [GitHub #37](https://github.com/whazzark/portflow-ai/issues/37)
- Parent roadmap: `specs/site-references/customers/roadmap.md`
- Related ADRs: `docs/adr/0003-single-site-without-tenant-isolation.md`, `docs/adr/0005-tuyau-api-web-contract.md`, `docs/adr/0008-vertical-slice-web-frontend-with-explicit-ui-adapters.md`
- Related domain terms: `CONTEXT.md` — Customer, Site Reference, Available Site Reference, Archived Resource, Site Reference Reactivation
