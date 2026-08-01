# Feature Specification: List Warehouses

**Feature Branch**: `feat/207-list-warehouses`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "List Warehouses — Let an authorized user consult available and archived warehouses and their footprints, with the same map consultation experience as Checkpoints. https://github.com/whazzark/portflow-ai/issues/207"

**GitHub Issue**: [#207](https://github.com/whazzark/portflow-ai/issues/207)

**Parent Roadmap**: `specs/site-references/storage-facilities/warehouses/roadmap.md`

## User Scenarios & Testing *(mandatory)*

This delivery also establishes the shared consultation interaction contract for `/checkpoints` and
`/warehouses`: available resources are the initial view, status filters expose counts, name search
emphasizes matches while preserving spatial context, and selected resources use the same accessible
detail and feedback patterns. Checkpoint-specific type filters and point markers remain supported.

### User Story 1 - Browse Available Warehouses (Priority: P1)

An active user consults the site's available warehouses so they can understand which storage destinations may be used for new operations. Each warehouse is identifiable by name and its available status.

**Why this priority**: Available warehouses are the primary operational reference set and provide the feature's core consultation value.

**Independent Test**: Sign in as an active user when available and archived warehouses exist, open Warehouses, and verify that the available view lists only available warehouses with an accurate count and a clear empty state when none exist.

**Acceptance Scenarios**:

1. **Given** available and archived warehouses exist, **When** an active user opens the warehouse collection, **Then** the available view is selected by default and shows every available warehouse without showing archived warehouses.
2. **Given** several available warehouses exist, **When** the collection is shown, **Then** each warehouse's name and available status are clear and the displayed available count matches the records shown.
3. **Given** no available warehouse exists, **When** an active user opens the warehouse collection, **Then** the user sees an explicit available-warehouse empty state and can still consult archived warehouses.

---

### User Story 2 - Inspect a Warehouse Footprint (Priority: P1)

An active user selects a warehouse on the warehouse map and inspects its geographic footprint so they can understand the full operational area associated with that storage destination.

**Why this priority**: The footprint is required warehouse information and is essential to distinguishing the physical coverage of each storage destination.

**Independent Test**: Open the warehouse map, select any visible warehouse, and verify that its details identify the warehouse and display the complete footprint polygon, including all boundary points, with the map framed from that footprint.

**Acceptance Scenarios**:

1. **Given** a warehouse is visible in the current collection, **When** an active user selects it on the map, **Then** the user sees the warehouse's name, lifecycle status, and full geographic footprint highlighted on the map.
2. **Given** a warehouse footprint extends beyond the initially visible area, **When** it is selected, **Then** the map fits the complete footprint without relying on a separately maintained warehouse center.
3. **Given** the user switches between warehouses, **When** a different warehouse is selected, **Then** the details and footprint correspond only to the newly selected warehouse.

---

### User Story 3 - Browse Archived Warehouses (Priority: P2)

An active user consults archived warehouses and their footprints so historical storage destinations remain understandable without making them appear available for new operations.

**Why this priority**: Historical visibility supports operational traceability, while clear lifecycle separation prevents archived references from being mistaken for usable destinations.

**Independent Test**: Switch to the archived view, verify that it contains only archived warehouses, inspect an archived warehouse's footprint, and confirm that no create, edit, archive, or reactivate behavior is provided by this slice.

**Acceptance Scenarios**:

1. **Given** archived warehouses exist, **When** an active user selects the archived view, **Then** every archived warehouse is shown, no available warehouse is shown, and the displayed archived count matches the records shown.
2. **Given** an archived warehouse is listed, **When** the user inspects it, **Then** its archived status and footprint remain visible as read-only information.
3. **Given** no archived warehouse exists, **When** the user selects the archived view, **Then** the user sees an explicit archived-warehouse empty state and can return to available warehouses.

---

### User Story 4 - Recover from Consultation Failure (Priority: P3)

An active user receives clear feedback when warehouses cannot be loaded and can retry without leaving the warehouse consultation area.

**Why this priority**: A recoverable failure state avoids misleading empty results and lets users resume consultation after a transient problem.

**Independent Test**: Make the warehouse collection unavailable, verify that the interface distinguishes the failure from an empty collection, restore availability, retry, and confirm that the collection and footprints load.

**Acceptance Scenarios**:

1. **Given** warehouse information cannot be loaded, **When** an active user opens the warehouse collection, **Then** the user sees a clear failure message rather than an empty collection.
2. **Given** a retryable loading failure is displayed, **When** the underlying problem is resolved and the user retries, **Then** the latest warehouse collection becomes consultable without requiring a new sign-in.

### Edge Cases

- If a lifecycle change occurs while a user is consulting warehouses, the next successful refresh MUST place the warehouse in its current lifecycle view and update its visible status and counts.
- Switching between available and archived views MUST NOT retain a selected warehouse that does not belong to the newly selected view.
- A footprint with many boundary points or an irregular shape MUST remain fully inspectable and MUST NOT be reduced to a single point or inferred address.
- A collection-loading failure MUST be distinguishable from valid empty available and archived views.
- Unauthenticated users and users whose access is no longer active MUST NOT receive warehouse information.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow every active authenticated user to consult the site's warehouse collection.
- **FR-002**: The system MUST deny warehouse information to unauthenticated users and to users who are not active.
- **FR-003**: The system MUST include every warehouse in the user's site scope, whether available or archived, and MUST NOT expose warehouses outside that scope.
- **FR-004**: The warehouse and checkpoint consultation experiences MUST separate available resources from archived resources and MUST select the available view by default.
- **FR-004a**: The warehouse consultation experience MUST provide the same map-oriented status filtering pattern as the checkpoints area, including available and archived filters and a way to show all warehouses.
- **FR-004b**: The warehouse consultation experience MUST provide a name search field that highlights matching warehouses while preserving the spatial context of the current lifecycle view, without requiring another collection request.
- **FR-005**: Each lifecycle view MUST display a count equal to the warehouses currently represented in that view.
- **FR-006**: Each listed warehouse MUST expose a stable identity, its name, its current lifecycle status, and its complete warehouse footprint.
- **FR-007**: The system MUST let a user select a listed warehouse and inspect its name, lifecycle status, and complete footprint as one coherent detail view.
- **FR-007a**: The map MUST present every warehouse matching the active status filter as a geographic polygon, visually emphasize warehouses matching the search, and selecting a polygon MUST open the corresponding warehouse detail view.
- **FR-007b**: Hovering or focusing a visible warehouse polygon MUST expose a tooltip containing the warehouse name and current lifecycle status.
- **FR-007c**: The map MUST provide a visible legend explaining the visual treatments for available and archived warehouses.
- **FR-008**: A displayed footprint MUST represent the warehouse's geographic polygon, including all of its boundary points, and MUST frame the complete polygon using a display position derived from that polygon.
- **FR-008a**: When a warehouse is selected, its polygon MUST be visually distinguished from the other visible warehouse polygons and the map MUST frame the selected polygon.
- **FR-008b**: Available and archived warehouse polygons MUST use visibly distinct styles; available warehouses use a solid/high-emphasis treatment and archived warehouses use a muted/dashed treatment consistent with the checkpoints convention.
- **FR-009**: Archived warehouses and their footprints MUST remain consultable as read-only historical references and MUST be clearly distinguished from warehouses available for new operations.
- **FR-010**: Each lifecycle view MUST provide a specific empty state when it contains no warehouses, without preventing access to the other lifecycle view.
- **FR-011**: Loading failures MUST be distinguishable from empty results and MUST provide a retry action that requests the latest collection.
- **FR-012**: After the collection is refreshed, warehouse placement, details, and lifecycle counts MUST reflect the latest successfully retrieved state.
- **FR-013**: This feature MUST NOT provide warehouse creation, update, archive, reactivation, permanent deletion, warehouse-door management, or selection for a discharge.

### Key Entities

- **Warehouse**: A named storage destination within the user's site scope. It has a stable identity, a lifecycle status of available or archived, and exactly one required footprint. An available warehouse may be selected for new operational use; an archived warehouse is a read-only historical reference.
- **Warehouse Footprint**: The complete geographic polygon outlining a warehouse's operational area, including truck unloading-position areas. Its display position is derived from its polygon and is not a separately maintained warehouse location, center, address, or single GPS point.
- **Site**: The operational scope that owns the warehouse references visible to the active user; warehouses belonging to another site are outside the collection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of active users can open the warehouse collection, distinguish the available and archived sets, and identify their counts on the first attempt without assistance.
- **SC-002**: For a collection of up to 200 warehouses, 95% of consultations show the selected lifecycle set and its counts within 2 seconds under normal operating conditions.
- **SC-003**: In acceptance testing, users can open any listed warehouse and inspect its complete footprint within 3 interactions from entering the warehouse area.
- **SC-004**: In all tested lifecycle combinations—mixed, available-only, archived-only, and fully empty—the interface shows the correct records, counts, and specific empty states with no archived warehouse presented as available.
- **SC-005**: In all authorization tests, warehouse information is withheld from unauthenticated and inactive users while every active user role can complete the read-only consultation journey.
- **SC-006**: In all retry tests, a resolved transient failure can be recovered through the provided retry action and the latest warehouse collection is then shown.

## Assumptions

- "Authorized user" means any active authenticated user in the operating organization; warehouse consultation is read-only for all active roles, while later warehouse-management features may impose narrower permissions.
- The operating organization manages exactly one site, so the active user's organization determines the site-scoped collection without an additional site picker.
- Every persisted warehouse has one valid required footprint polygon; defining, correcting, or validating footprint geometry belongs to warehouse creation and update, not this listing feature.
- Available and archived are the only warehouse lifecycle states relevant to consultation.
- The collection size is expected to remain at or below 200 warehouses for the initial delivery; pagination, server-side search, and sorting controls are outside this slice. Client-side name search follows the existing checkpoints consultation convention.
