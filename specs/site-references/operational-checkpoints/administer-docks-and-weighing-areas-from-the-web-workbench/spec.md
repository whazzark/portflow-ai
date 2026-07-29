# Feature Specification: Administer Docks and Weighing Areas From the Web Workbench

**Feature ID**: `GH-41`
**GitHub Issue**: [#41](https://github.com/whazzark/portflow-ai/issues/41)
**Parent Roadmap**: `specs/site-references/operational-checkpoints/roadmap.md`
**Roadmap Entry**: `GH-41`
**Created**: 2026-07-09
**Status**: `Spec Draft`
**Priority**: priority:P1
**Milestone**: 1. Construire le socle des référentiels
**Domain**: site-references

## Clarifications

### Session 2026-07-29

- Q: Which behavior should GH-41 deliver? → A: Full workbench administration: consultation, search, creation, editing, archiving, and reactivation for docks and weighing areas.
- Q: Which users may consult and mutate dock and weighing-area references? → A: Any active user may consult; Organization Admins and Operations Admins may create, edit, archive, and reactivate.
- Q: What identity and location fields do both resource types require? → A: Both docks and weighing areas require a name plus GPS latitude and longitude.
- Q: How must dock and weighing-area names be unique? → A: Names are unique case-insensitively within each resource type; a dock and weighing area may share a name.
- Q: How should workbench search behave? → A: Search each dock or weighing-area list independently by case-insensitive substring of the name while preserving the selected availability status.
- Q: What happens when a grouped lifecycle action contains both eligible and blocked resources? → A: Eligible resources transition, blocked resources remain unchanged, and the result is reported for each resource.
- Q: When may a dock or weighing area be archived? → A: Archive is blocked by planned or active discharge references; reactivation restores availability.
- Q: Which lifecycle action model is in scope? → A: Individual and grouped archive/reactivate actions; create and edit remain individual.
- Q: Are lifecycle comments required? → A: Archive and reactivation comments are optional; each action still records its actor and timestamp.
- Q: What happens when two administrators modify the same resource concurrently? → A: A stale modification is rejected and the administrator must reload the latest resource state.

## User Scenarios & Testing

### User Story 1 - Administer Docks and Weighing Areas From the Web Workbench (Priority: P1)

As an active application user, I want to consult dock and weighing-area references from one web workbench, and as an Organization Admin or Operations Admin I want to administer them, so that operational checkpoint references remain accurate and safely available for discharge preparation.

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** an active application user, **When** they open the workbench, **Then** they can consult available and archived docks and weighing areas.
2. **Given** an Organization Admin or Operations Admin, **When** they use the workbench, **Then** they can create, edit, archive, and reactivate dock and weighing-area references subject to the applicable validation and lifecycle rules.
3. **Given** an authenticated user without an administration role, **When** they attempt a mutation through the service boundary, **Then** the mutation is refused even if a stale workbench displays an action control.

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.
- When an administrator submits a modification based on an outdated resource version, the service rejects it without changing the resource and the workbench prompts the administrator to reload the latest state.

## Requirements

### Functional Requirements

- **FR-001**: The workbench MUST support consultation, search, creation, editing, archiving, and reactivation for both dock and weighing-area site references.
- **FR-002**: The authoritative service boundary MUST allow any active application user to consult dock and weighing-area references and MUST authorize their creation, modification, archive, and reactivation only for Organization Admins and Operations Admins.
- **FR-003**: Each dock and weighing area MUST have a required name and required GPS latitude and longitude; creation and modification MUST reject missing, blank, malformed, or out-of-range values without changing the record.
- **FR-003a**: Dock names MUST be unique case-insensitively among docks, and weighing-area names MUST be unique case-insensitively among weighing areas; the same name MAY exist once in each resource type.
- **FR-003b**: The workbench MUST search docks and weighing areas independently by case-insensitive substring of the name, and MUST preserve the selected available or archived status filter while searching.
- **FR-004**: An archive operation MUST be rejected when the dock or weighing area is referenced by a planned or active discharge; reactivation MUST restore availability without replacing the resource identity or history.
- **FR-005**: The workbench MUST support individual and selection-scoped grouped archive and reactivation actions; creation and editing MUST remain individual operations.
- **FR-005a**: A grouped archive or reactivation action containing both eligible and blocked resources MUST transition every eligible resource, leave every blocked resource unchanged, and report the outcome for each selected resource.
- **FR-006**: Every successful archive or reactivation MUST record the acting user and action timestamp and MAY record a non-blank comment supplied for the action.
- **FR-007**: Every mutation MUST detect an outdated resource version, reject the stale mutation without changing the resource, and allow the workbench to prompt the administrator to reload the latest state.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- No explicit dependency was recorded in the source issue.

## Out of Scope

- Detailed administration rules for dock and weighing-area identity, location, authorization, and lifecycle transitions are in scope; operational use of these references during a discharge remains out of scope.

## Assumptions and Clarifications

- Any active application user may consult dock and weighing-area references; only Organization Admins and Operations Admins may create, modify, archive, or reactivate them.
- Both resource types require a named identity and a GPS location represented by latitude and longitude.
- Archived docks and weighing areas remain consultable but cannot be selected for new operational use; archive is blocked while either resource is referenced by a planned or active discharge.
- Grouped lifecycle actions may partially succeed: eligible resources transition, blocked resources remain unchanged, and each result is reported; malformed request-level input is rejected before any resource changes.
- Archive and reactivation comments are optional; when supplied, surrounding whitespace is ignored and a blank-only comment is treated as absent.
- Concurrent mutations use optimistic concurrency; stale mutations never overwrite a more recent resource state.

## Source-derived decisions

- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/41
- Parent roadmap: specs/site-references/operational-checkpoints/roadmap.md
- Related domain: site-references
