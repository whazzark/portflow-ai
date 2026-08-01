# Feature Specification: List Weighing Areas

**Feature Branch**: `feat/202-list-weighing-areas`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "List Weighing Areas — Let an authorized user consult available and archived weighing areas, including empty, detail, and error states. https://github.com/whazzark/portflow-ai/issues/202"

**GitHub Issue**: [#202](https://github.com/whazzark/portflow-ai/issues/202)

**Parent Roadmap**: `specs/site-references/operational-checkpoints/weighing-areas/roadmap.md`

**Domain**: site-references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consult Weighing Areas by Status (Priority: P1)

An authorized administrator consults the site's weighing areas and can clearly distinguish the areas currently available for operations from those that have been archived.

**Why this priority**: The collection is the primary entry point for understanding which weighing checkpoints the site has and whether each one can currently be used.

**Independent Test**: Populate the site with available and archived weighing areas, open the weighing-area collection as an authorized administrator, and verify that every area is shown in the correct status grouping with its identifying information.

**Acceptance Scenarios**:

1. **Given** the site has available and archived weighing areas, **When** an authorized administrator opens the weighing-area collection, **Then** all weighing areas are listed and each is clearly identified as available or archived.
2. **Given** multiple weighing areas exist, **When** the collection is displayed, **Then** areas within each status are ordered consistently by name so that a known area can be located predictably.
3. **Given** a signed-in user is not authorized to administer weighing areas, **When** that user attempts to consult the complete collection, **Then** access is denied without disclosing the collection.

---

### User Story 2 - Inspect Weighing Area Details (Priority: P2)

An authorized administrator selects a weighing area to inspect its identity, operational status, and exact GPS location, including for an archived area.

**Why this priority**: A list establishes availability, while the detail view provides the precise information needed to identify and verify an operational checkpoint.

**Independent Test**: Select both an available and an archived weighing area from the collection and verify that each detail view presents the same record's name, status, and required latitude and longitude.

**Acceptance Scenarios**:

1. **Given** a weighing area appears in the collection, **When** an authorized administrator selects it, **Then** the detail state shows its name, current status, latitude, and longitude.
2. **Given** an archived weighing area appears in the collection, **When** an authorized administrator selects it, **Then** its detail remains consultable and its archived status is clearly visible.
3. **Given** a restored selection no longer identifies a weighing area in the current collection or is excluded by the selected status, **When** the collection is resolved, **Then** the stale selection is cleared without substituting another checkpoint and the map remains usable.

---

### User Story 3 - Recover from Empty and Error States (Priority: P3)

An authorized administrator receives useful feedback when there are no weighing areas in a selected status or when the collection cannot be loaded, rather than seeing an ambiguous blank screen.

**Why this priority**: Explicit empty and failure states keep the consultation workflow understandable and recoverable under normal exceptional conditions.

**Independent Test**: Consult the collection with no weighing areas, with one status containing no areas, and with a simulated retrieval failure; verify the corresponding message and retry behavior.

**Acceptance Scenarios**:

1. **Given** the site has no weighing areas, **When** an authorized administrator opens the collection, **Then** a clear empty state explains that no weighing areas are available to consult.
2. **Given** weighing areas exist but none have the selected status, **When** the administrator views that status, **Then** a status-specific empty state appears without implying that the other status is also empty.
3. **Given** the collection fails to load, **When** the failure is presented, **Then** the administrator sees a clear error state with an action to retry the same consultation.
4. **Given** an error state and the underlying failure has cleared, **When** the administrator retries, **Then** the collection is loaded without requiring the administrator to leave the weighing-area section.

### Edge Cases

- A weighing area changes between available and archived while the administrator is consulting the collection; the next successful refresh or retry reflects its current status and avoids showing it in both status groups.
- Two weighing-area names differ only by letter case; the ordering remains deterministic and every record remains distinguishable by its own identity and details.
- Coordinates lie on valid geographic boundaries, including latitude -90 or 90 and longitude -180 or 180; the detail state presents them without treating them as missing.
- An archived area has incomplete historical actor information because the actor is no longer retained; consultation still shows the area's current identity, coordinates, and archived status.
- The administrator loses authorization during consultation; the next protected request is denied and previously retrieved administrative data is not presented as current.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST require a signed-in user to be authorized before disclosing the complete weighing-area collection.
- **FR-002**: The system MUST allow organization administrators and operations administrators to consult the complete weighing-area collection, including available and archived areas.
- **FR-003**: The system MUST deny the complete weighing-area collection to users who are not authorized to administer weighing areas.
- **FR-004**: The collection MUST distinguish available weighing areas from archived weighing areas without requiring the administrator to infer status from missing actions or other indirect cues.
- **FR-005**: The collection MUST present every weighing area exactly once under its current status.
- **FR-006**: Weighing areas within each status MUST be ordered by name using one consistent ordering rule.
- **FR-007**: Each collection entry MUST provide enough information to identify the weighing area and open its detail state, including its name and current status.
- **FR-008**: An authorized administrator MUST be able to inspect a weighing area's name, current status, latitude, and longitude.
- **FR-009**: Archived weighing areas MUST remain consultable in both the collection and detail states.
- **FR-010**: When no weighing areas exist, the system MUST present an explicit collection-level empty state rather than an empty or incomplete-looking collection.
- **FR-011**: When no weighing areas have the selected status, the system MUST present an explicit status-specific empty state while preserving access to any other populated status.
- **FR-012**: When the collection cannot be retrieved, the system MUST present an understandable error state and allow the administrator to retry the same request.
- **FR-013**: The system MUST resolve weighing-area details from the current complete collection and MUST clear an invalid, missing, or status-excluded selection without substituting another checkpoint.
- **FR-014**: A successful retry or refresh MUST replace stale empty or error feedback with the current collection and status of each weighing area.
- **FR-015**: This feature MUST NOT create, update, archive, reactivate, or permanently delete a weighing area; those behaviors belong to separate delivery slices.
- **FR-016**: The shared Checkpoints map MUST allow an administrator to show Docks only, Weighing Areas only, or both resource kinds.
- **FR-017**: The resource-kind filter MUST preserve at least one visible resource kind, remain combined with the lifecycle-status filter, and persist in the URL for reload and browser-history behavior.
- **FR-018**: The resource-kind filter menu MUST remain open while its checkboxes are adjusted and MUST toggle open or closed reliably from its trigger.

### Key Entities

- **Weighing Area**: An operational checkpoint organized around a weighbridge. For consultation it has a stable identity, a name, a required GPS location expressed as latitude and longitude, and one current status.
- **Weighing Area Status**: The current availability classification of a weighing area: available for operational use or archived while retained for history and consultation.
- **Authorized Administrator**: An organization administrator or operations administrator permitted to consult the complete administrative collection of available and archived weighing areas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of authorized administrators can locate a named weighing area, identify its current status, and open its details on their first attempt without assistance.
- **SC-002**: An authorized administrator can distinguish available from archived weighing areas within 10 seconds of the collection becoming visible.
- **SC-003**: For a site with up to 500 weighing areas, the collection becomes usable within 2 seconds for at least 95% of successful consultations under normal operating conditions.
- **SC-004**: In acceptance testing, 100% of weighing areas appear exactly once in the collection under their current status, and every displayed detail matches the selected area.
- **SC-005**: In acceptance testing, every empty, stale-selection, authorization, and collection-retrieval-failure scenario produces the specified state, and every retryable collection failure can be recovered without leaving the Checkpoints map.

## Assumptions

- The complete administrative collection is limited to organization administrators and operations administrators, consistent with existing site-reference administration rules; other active users may receive available weighing areas through operational selection flows outside this feature.
- Available and archived are the only weighing-area statuses relevant to this feature.
- The collection supports the existing shared Checkpoints search and status filters plus a resource-kind filter; pagination and bulk selection remain outside this issue.
- Detail consultation includes the weighing area's current identifying and location data. Mutation controls and complete lifecycle audit presentation are outside this issue.
- The existing authentication and access-status rules remain authoritative, and the service remains the source of truth for authorization.
