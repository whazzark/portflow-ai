# Feature Specification: Administer Docks and Weighing Areas From the Web Workbench

**Feature ID**: `GH-41`
**GitHub Issue**: [#41](https://github.com/whazzark/portflow-ai/issues/41)
**Parent Roadmap**: `specs/site-references/operational-checkpoints/roadmap.md`
**Roadmap Entry**: `GH-41`
**Created**: 2026-07-09
**Last Refined**: 2026-07-30
**Status**: `Spec Draft`
**Priority**: `priority:P1`
**Milestone**: `1. Construire le socle des référentiels`
**Domain**: `site-references`

## Objective

Give a site-reference administrator one web workbench from which to find, inspect, create, correct, archive, and reactivate the site's docks and weighing areas, so discharge preparation can rely on accurate operational checkpoints without erasing their history.

## Primary Actor and Flow

The primary actor is an active `Organization Admin` or `Operations Admin`.

The administrator opens **Checkpoints**, chooses either Docks or Weighing Areas, works in the available or archived view, searches or sorts the chosen references, and opens a reference's details. They may create a reference, edit an available reference, archive an eligible available reference after confirmation, or reactivate an archived reference. The workbench refreshes the affected view and reports the authoritative saved state or a recoverable failure.

`Checkpoint` is only the interface category joining these workflows. A dock and a weighing area remain separate site-reference types with separate identities and business rules.

## User Scenarios & Testing

### User Story 1 - Consult operational checkpoints (Priority: P1)

As a site-reference administrator, I want to browse and inspect docks and weighing areas from one workbench so that I can find the correct reference and understand whether it is available for new operations.

**Independent Test**: As each administrator role, open the Checkpoints workbench and verify both reference types, both lifecycle views, search, sorting, detail inspection, URL restoration, and the empty, no-result, loading, and retryable-error states.

**Acceptance Scenarios**:

1. **Given** an authorized administrator and existing docks and weighing areas, **When** they open Checkpoints and switch reference type, **Then** the workbench shows only records of the selected type with name, GPS location, lifecycle status, and an action to inspect details.
2. **Given** available and archived references of the selected type, **When** the administrator switches lifecycle view, **Then** available and archived records are separated, archived records remain consultable with lifecycle metadata, and archived records have no edit action.
3. **Given** a reference type, lifecycle view, search term, sort choice, and selected detail, **When** the administrator refreshes or shares the workbench URL, **Then** the same accessible view is restored and an invalid or stale combination is safely normalized.
4. **Given** the selected type has no records or no records matching the search, **When** the list is displayed, **Then** the workbench distinguishes an empty reference set from no search results and offers an appropriate next action.

### User Story 2 - Maintain checkpoint identity and location (Priority: P1)

As a site-reference administrator, I want to create and correct available docks and weighing areas so that each reference has an accurate name and operational GPS point.

**Independent Test**: Create and update one dock and one weighing area through the workbench, then verify the saved values and each field-addressable validation or duplicate-name failure through the service boundary and browser behavior.

**Acceptance Scenarios**:

1. **Given** an authorized administrator, **When** they submit a valid name, latitude, and longitude for the selected reference type, **Then** a new available reference of that type appears in the workbench.
2. **Given** an available dock or weighing area, **When** the administrator submits valid changes to its name or GPS location, **Then** the same reference identity is updated and remains available.
3. **Given** a blank or overlong name, a name already used by the same reference type without regard to case, an absent coordinate, or a coordinate outside its geographic range, **When** the form is submitted, **Then** no change is presented as saved and the workbench identifies the affected field or conflict.
4. **Given** an archived dock or weighing area, **When** the administrator inspects it, **Then** its identity, location, and lifecycle history are visible but it cannot enter edit mode until reactivated.

### User Story 3 - Manage checkpoint availability safely (Priority: P1)

As a site-reference administrator, I want to archive obsolete docks and weighing areas and reactivate them when needed so that new operational work uses current references while historical records remain intact.

**Independent Test**: For each reference type, exercise archive and reactivation with eligible, in-use, already-transitioned, missing, stale, and unauthorized records; verify lifecycle metadata, list refresh, error feedback, and unchanged state after failure.

**Acceptance Scenarios**:

1. **Given** an available dock or weighing area not referenced by a planned or active discharge, **When** an authorized administrator confirms archive with or without a comment, **Then** the same reference becomes archived, is excluded from available selections, remains consultable, and records the lifecycle metadata.
2. **Given** an archived dock or weighing area, **When** an authorized administrator confirms reactivation with or without a comment, **Then** the same reference becomes available with its name, GPS location, and history preserved.
3. **Given** a reference used by a planned or active discharge, **When** the administrator attempts to archive it, **Then** the reference remains available and the workbench explains that operational usage blocks archival.
4. **Given** a reference has become missing or changed lifecycle state since it was displayed, **When** the administrator submits an edit or lifecycle action, **Then** the authoritative state is preserved, the workbench reports the conflict or missing record, and affected data is refreshed without showing a false success.

## Invariants

- A dock and a weighing area are distinct site references. They cannot be converted into one another, share an identity, or be persisted as a generic checkpoint.
- Every reference has a stable identity, a required normalized name, a required latitude from `-90` through `90`, a required longitude from `-180` through `180`, and either `AVAILABLE` or `ARCHIVED` lifecycle status.
- Names are trimmed, non-blank, at most 255 characters, and unique without regard to case within their own reference type. A dock name does not conflict with a weighing-area name.
- Only available references may be edited or selected for new operational use. Archived references are read-only until reactivated.
- Archival never deletes a reference and cannot succeed while that reference is used by a planned or active discharge.
- Archive and reactivation preserve identity and historical references and record the acting user, server time, and normalized optional comment.
- The authoritative service boundary enforces authorization, validation, uniqueness, lifecycle, and usage rules. The workbench never treats hidden controls or cached state as enforcement.

## Authorization

- Only authenticated, active `Organization Admin` and `Operations Admin` users may access the Checkpoints administration workbench or create, edit, archive, and reactivate docks or weighing areas.
- Unauthenticated users are sent through the existing authentication flow. Authenticated users without an administration role cannot open this workbench or invoke its mutation actions.
- Existing read endpoints that expose available references or individual details to other active application users for operational workflows remain unchanged and are outside this workbench's authorization surface.

## Failure Cases

- Loading either selected list or detail may fail independently; the workbench keeps the chosen context visible and offers a retry without presenting stale data as newly loaded.
- Validation failures identify the relevant form field, preserve valid user input, and leave the stored reference unchanged.
- Duplicate-name, archived-read-only, already-archived, already-available, in-use, and not-found outcomes are shown as distinct actionable messages.
- A mutation that fails or is interrupted leaves the authoritative record unchanged for that operation; retrying never creates a second reference or silently duplicates a lifecycle transition.
- After a stale-state conflict, the workbench refreshes affected list and detail data and exits any mode that is no longer valid.
- Confirmation, form, and detail surfaces remain keyboard-operable, use visible focus, return focus to the initiating control when closed, and announce validation and mutation feedback without relying on color alone.

## Requirements

### Functional Requirements

- **FR-001**: The application MUST provide an administrator-only Checkpoints workbench that groups Dock and Weighing Area administration without introducing a generic checkpoint record.
- **FR-002**: The workbench MUST provide separate, clearly identified Dock and Weighing Area contexts and separate available and archived views for the selected type.
- **FR-003**: Each selected-type view MUST support name search, deterministic name sorting, detail inspection, and distinct loading, retryable-error, empty-dataset, and no-search-result states.
- **FR-004**: Navigable workbench state MUST restore the selected reference type, lifecycle view, search, sort, selected detail, and valid detail mode from the URL and MUST normalize inaccessible, invalid, or stale combinations.
- **FR-005**: An authorized administrator MUST be able to create a dock or weighing area with its required name, latitude, and longitude.
- **FR-006**: An authorized administrator MUST be able to edit the name or GPS location of an available dock or weighing area while preserving its stable identity.
- **FR-007**: Create and edit validation MUST enforce the name and coordinate invariants and return field-addressable or conflict-specific feedback without changing the record on failure.
- **FR-008**: An authorized administrator MUST be able to archive one eligible available reference and reactivate one archived reference after explicit confirmation, with one optional lifecycle comment per action.
- **FR-009**: Archival MUST be refused when the selected reference is used by a planned or active discharge; the blocked reference MUST remain available.
- **FR-010**: Accepted lifecycle transitions MUST preserve identity and history, update availability, and record actor, server time, and normalized optional comment.
- **FR-011**: After every mutation attempt, the workbench MUST reconcile affected list and detail data with the authoritative response, show explicit success or failure feedback, and never retain an invalid edit or lifecycle mode.
- **FR-012**: The authoritative service boundary MUST restrict workbench reads and all mutations to active Organization Admins and Operations Admins, regardless of client-visible controls.
- **FR-013**: The Checkpoints workbench MUST meet the project's supported keyboard, focus-management, labeling, contrast, responsive-layout, status-announcement, and error-presentation expectations.
- **FR-014**: Verification MUST cover business invariants at the application seam, authorization and stable failures at the HTTP seam, and the primary consultation and mutation journeys in the browser-facing workbench.

### Key Entities

- **Dock**: A named operational berth with a required GPS point where trucks are loaded during a discharge.
- **Weighing Area**: An operational checkpoint with a required GPS point where truck weights are recorded before and after loading.
- **Available Site Reference**: A dock or weighing area eligible for new operational use and for editing.
- **Archived Resource**: A retained, read-only dock or weighing area unavailable for new operational use until reactivated.
- **Lifecycle Metadata**: The latest archive or reactivation actor, server time, and optional comment exposed for consultation and traceability.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of specified Dock and Weighing Area consultation, creation, edit, archive, reactivation, and recovery scenarios produce the stated observable result.
- **SC-002**: 100% of unauthenticated and non-administrator attempts to access workbench data or mutations are refused by the authoritative boundary.
- **SC-003**: 100% of invalid identity or coordinate submissions leave the stored reference unchanged and identify the invalid field or duplicate conflict.
- **SC-004**: An administrator can switch to either reference type, locate a known reference, and open its details within 60 seconds using keyboard or pointer input.
- **SC-005**: After an accepted mutation, the workbench displays the resulting lifecycle or identity state within 2 seconds in the normal test environment without a full-page reload.
- **SC-006**: No archive or reactivation flow permanently deletes a reference, changes its stable identity, or removes its ability to resolve historical usage.

## Dependencies

- Parent roadmap: `specs/site-references/operational-checkpoints/roadmap.md`.
- The Dock and Weighing Area API capabilities historically delivered by GH-39 and GH-40.
- Domain definitions in `CONTEXT.md`, especially `Checkpoint`, `Dock`, `Dock GPS Location`, `Weighing Area`, `Weighing Area GPS Location`, `Available Site Reference`, `Archived Resource`, and `Site Reference Reactivation`.
- [ADR 0003](../../../../docs/adr/0003-single-site-without-tenant-isolation.md), [ADR 0005](../../../../docs/adr/0005-tuyau-api-web-contract.md), and [ADR 0008](../../../../docs/adr/0008-vertical-slice-web-frontend-with-explicit-ui-adapters.md).
- GH-53 owns durable planned/active Dock usage, and GH-54 owns durable planned/active Weighing Area assignment usage. Each must replace or extend the temporary no-discharge usage adapter before persisting the corresponding relationship.

## Out of Scope

- A generic Checkpoint entity, cross-type identity, or conversion between docks and weighing areas.
- Discharge planning, dock assignment, weighing-area assignment, runtime reassignment, rotations, or weighing operations.
- A map editor, reverse geocoding, address lookup, or geographic visualization beyond entering and displaying coordinates.
- Grouped archive/reactivation, bulk creation/editing, import/export, or permanent deletion.
- Administration of customers, fleet references, warehouses, or warehouse doors.
- Multi-site or tenant isolation beyond the existing single-site boundary.

## Assumptions and Clarifications

- The authenticated route is `/checkpoints`, matching the existing **Checkpoints** navigation entry.
- The default context is available Docks. The selected type and lifecycle view are explicit in navigable state so the URL never relies on a generic checkpoint identity.
- Search is case-insensitive name matching within the already selected type and lifecycle view. Sorting is by normalized display name in ascending or descending order.
- Creation and lifecycle actions are individual operations because the existing Dock and Weighing Area service contracts are individual; bulk behavior requires a separate product contract.
- A blank lifecycle comment is normalized as absent. This feature does not add a new comment-retention or length rule.
- Production may continue using the temporary no-discharge usage adapter only while the corresponding planned/active usage cannot be persisted. Focused tests still prove both blocked and unblocked archive outcomes through the usage-checker boundary.

## Traceability

- Source issue: [GitHub #41](https://github.com/whazzark/portflow-ai/issues/41)
- Parent roadmap: `specs/site-references/operational-checkpoints/roadmap.md`
- Related ADRs: `docs/adr/0003-single-site-without-tenant-isolation.md`, `docs/adr/0005-tuyau-api-web-contract.md`, `docs/adr/0008-vertical-slice-web-frontend-with-explicit-ui-adapters.md`
- Related domain terms: `CONTEXT.md` — Checkpoint, Dock, Dock GPS Location, Weighing Area, Weighing Area GPS Location, Available Site Reference, Archived Resource, Site Reference Reactivation
