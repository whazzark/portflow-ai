# Feature Specification: List Warehouse Doors

**Feature Branch**: `feat/212-list-warehouse-doors`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "List Warehouse Doors — Let an authorized user consult doors contained by warehouses and their lifecycle state. https://github.com/whazzark/portflow-ai/issues/212"

**GitHub Issue**: [#212](https://github.com/whazzark/portflow-ai/issues/212)

**Parent Roadmap**: `specs/site-references/storage-facilities/warehouse-doors/roadmap.md`

## Clarifications

### Session 2026-08-01

- Q: What uniqueness rule applies to warehouse-door names? → A: A door name is unique within its containing warehouse; the same name may be used in different warehouses.
- Q: Where do users consult warehouse doors? → A: Doors are shown within the selected warehouse's existing map and list context; there is no standalone warehouse-door consultation destination or door detail view.
- Q: Which lifecycle states reserve a warehouse-door name? → A: Available and archived doors both reserve their names within the containing warehouse.
- Q: How are warehouse-door names compared for uniqueness? → A: Surrounding whitespace is removed and names are compared without letter case; the accepted casing is preserved for display.
- Q: Which door lifecycle view is selected when a warehouse is opened? → A: Available is selected for an available warehouse, while Archived is selected for an archived warehouse.
- Q: Which read contracts expose warehouse doors? → A: The warehouse collection embeds all available and archived doors under their containing warehouse, while a dedicated available-only warehouse-door collection is prepared for future discharge selectors; no complete standalone warehouse-door endpoint is introduced.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse a Warehouse's Doors (Priority: P1)

An active user selects a warehouse in the existing warehouse consultation area and consults its contained doors in that warehouse's map and detail context, so they can understand which exact unloading points are available for current operations and which remain only as archived references.

**Why this priority**: Identifying the doors that belong to a warehouse and separating usable doors from archived ones is the feature's primary operational value.

**Independent Test**: Sign in as an active user, select available and archived warehouses containing doors, and verify that each selected warehouse shows only its own doors, with the lifecycle view matching the warehouse's status selected by default and accurate lifecycle counts.

**Acceptance Scenarios**:

1. **Given** an available warehouse contains available and archived doors, **When** an active user consults that warehouse's doors, **Then** available doors are shown by default and archived doors are accessible through a distinct lifecycle view.
2. **Given** a user switches between available and archived views for a warehouse, **When** either view is selected, **Then** only doors in the chosen lifecycle scope are presented and the displayed count matches that warehouse's doors in that state.
3. **Given** several warehouses contain doors, **When** the user selects one warehouse, **Then** every door shown as belonging to it is contained by that warehouse and no door from another warehouse is presented as its door.
4. **Given** an unauthenticated user or a user whose access is not active attempts to consult warehouse doors, **When** access is evaluated, **Then** no warehouse-door information is disclosed.
5. **Given** an archived warehouse is selected, **When** its doors are consulted, **Then** the archived-door view is selected by default and its historical doors remain readable.
6. **Given** a future discharge workflow requests warehouse doors eligible for new work, **When** the available-only collection is consulted, **Then** it contains only available doors whose containing warehouse is also available.

---

### User Story 2 - Locate and Select a Warehouse Door (Priority: P1)

An active user locates a door within its warehouse footprint and selects it in the list or on the map so they can identify the exact operational point and its current usability without opening a separate detail view.

**Why this priority**: A door is useful only when users can distinguish it from other doors in the same warehouse and identify its precise unloading position.

**Independent Test**: Select a warehouse with multiple doors, activate each visible door in turn, and verify that the exact selected door is highlighted in both the list and map while retaining its name and lifecycle status at a point inside or on the warehouse footprint.

**Acceptance Scenarios**:

1. **Given** a selected warehouse contains doors in the current lifecycle scope, **When** they are displayed on the warehouse map, **Then** each door appears exactly once at its recorded GPS location within or on the boundary of that warehouse's footprint.
2. **Given** a door is visible, **When** the user hovers it or gives it keyboard focus, **Then** the user can identify the door by name and lifecycle status.
3. **Given** a visible door is activated by pointer or keyboard, **When** it is selected, **Then** its list entry and map marker are both visibly emphasized, and the user can identify its name and lifecycle status without leaving the warehouse door list or opening a separate detail view.
4. **Given** doors in different warehouses have the same or similar names, **When** the user inspects either one, **Then** its containing warehouse, stable identity, and recorded location keep it distinguishable from the other door.

---

### User Story 3 - Understand Empty and Failure States (Priority: P2)

An active user receives clear feedback when a warehouse has no doors in the selected lifecycle state or when the warehouse consultation snapshot cannot be loaded, and can retry a recoverable failure.

**Why this priority**: Distinguishing an empty embedded door collection from a warehouse-snapshot retrieval failure prevents incorrect operational conclusions and makes transient failures recoverable.

**Independent Test**: Consult a warehouse once with no doors in a lifecycle state and once while the warehouse collection fails, then verify distinct empty and failure messages and a retry that shows the latest warehouse-and-door snapshot after recovery.

**Acceptance Scenarios**:

1. **Given** a warehouse contains no doors in the selected lifecycle state, **When** the warehouse collection including its embedded doors loads successfully, **Then** the user sees a lifecycle-specific empty state and can still switch to the other lifecycle views.
2. **Given** the warehouse collection including embedded doors cannot be loaded, **When** consultation enters its failure state, **Then** the user sees a clear failure message rather than a false empty collection and is offered a retry action.
3. **Given** a warehouse-collection failure is displayed and the underlying problem is resolved, **When** the user retries, **Then** the current warehouses and their embedded doors or the appropriate empty state replace the failure without requiring a new sign-in.
4. **Given** a door's name, GPS location, or lifecycle state changes before a refresh, **When** the latest warehouse collection is successfully retrieved, **Then** stale information is replaced and the door appears only in its authoritative current lifecycle context.

### Edge Cases

- A warehouse has no doors at all: every lifecycle view reports an appropriate empty state without implying a loading failure.
- A warehouse has doors in only one lifecycle state: the populated state remains consultable and the other state remains selectable with its own empty feedback.
- An archived warehouse is consulted: its archived doors remain readable as historical references, and no door is presented as available for new operational use.
- An archived door's name remains reserved within its warehouse, so another door in that warehouse cannot reuse the name.
- Door names that differ only by surrounding whitespace or letter case are the same name for uniqueness within a warehouse.
- Several doors share the same or very close GPS location: each retains an independent selectable identity and accessible name.
- A selected door is archived or moved before refresh: the stale selection is cleared or replaced by that same door's current authoritative context, never by another door.
- Warehouse-and-door retrieval remains pending: progress feedback is shown and the user is not shown a false empty state.
- The map background cannot load while the warehouse snapshot and embedded door data are available: door consultation reports map-specific feedback rather than treating the collection as unavailable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow every authenticated user with active access to consult warehouse doors belonging to the user's operating site.
- **FR-002**: The system MUST deny warehouse-door consultation to unauthenticated users and users whose access is not active without disclosing warehouse-door information.
- **FR-003**: The warehouse consultation collection MUST embed every available and archived warehouse door beneath its authoritative containing warehouse in the user's site scope.
- **FR-003a**: The system MUST expose a dedicated available-only warehouse-door collection for future operational selectors; it MUST include a door only when both the door and its containing warehouse are available, and the warehouse consultation UI in this feature MUST NOT consume this collection.
- **FR-004**: Every warehouse door MUST be presented as belonging to exactly one warehouse, and a warehouse-scoped view MUST NOT present another warehouse's doors as its own.
- **FR-004a**: Users MUST consult doors within the selected warehouse's existing map and list context; this feature MUST NOT introduce a standalone warehouse-door consultation destination or door detail view.
- **FR-005**: The consultation experience MUST provide available and archived lifecycle views for the selected warehouse; each view MUST contain only doors in the selected state, an available warehouse MUST select Available by default, an archived warehouse MUST select Archived by default, and each state MUST show an accurate count.
- **FR-006**: Each warehouse door MUST preserve a stable identity and expose its current name, containing warehouse, lifecycle status, latitude, and longitude for consultation.
- **FR-006a**: A warehouse-door name MUST be unique across both available and archived doors within its containing warehouse; archiving a door MUST NOT release its name, while doors in different warehouses MAY use the same name.
- **FR-006b**: Warehouse-door names MUST have surrounding whitespace removed before storage and MUST be compared without letter case for uniqueness, while preserving the accepted casing for display.
- **FR-007**: Each door in the selected lifecycle scope MUST be represented at its recorded GPS location within or on the boundary of its containing warehouse's footprint.
- **FR-008**: Each visible door location MUST expose the door's name and lifecycle status on pointer hover and keyboard focus.
- **FR-009**: Activating a visible door by pointer or keyboard MUST select that exact door in the list and map without replacing the warehouse door list or opening a separate detail view.
- **FR-010**: The selected door MUST have a visibly and programmatically identifiable selected state in both its list entry and map marker; its name and lifecycle status MUST remain available through the list, accessible marker label, and tooltip.
- **FR-011**: Available and archived doors MUST be visually and textually distinguishable without relying on color alone.
- **FR-012**: Archived doors MUST remain consultable as read-only historical references and MUST NOT be represented as available for new operational use.
- **FR-013**: When a warehouse has no doors in the selected lifecycle state, the system MUST show a lifecycle-specific empty state and MUST keep the other lifecycle views accessible.
- **FR-014**: While the warehouse collection including embedded door information is being retrieved, the system MUST show progress feedback and MUST NOT present a false empty state.
- **FR-015**: When the warehouse collection including embedded door information cannot be retrieved, the system MUST show an understandable failure state and provide an action to retry retrieval.
- **FR-016**: A successful warehouse-collection refresh or retry MUST replace stale door name, location, and lifecycle information with the latest authoritative state while preserving the door's permanent containing-warehouse relationship.
- **FR-017**: An invalid, stale, or lifecycle-filtered-out door selection MUST NOT display a different door and MUST return the user to a valid warehouse or door consultation state.
- **FR-018**: If the warehouse snapshot and embedded door data remain available while the map background cannot be displayed, the system MUST distinguish the map failure from a warehouse-collection failure.
- **FR-019**: Door creation, update, archival, reactivation, permanent deletion, assignment to product lots or discharges, and selection for operational execution MUST remain outside this feature.

### Key Entities *(include if feature involves data)*

- **Warehouse Door**: A designated unloading door permanently belonging to one warehouse. It has a stable identity, a mutable display name whose surrounding whitespace is removed and whose value remains unique without regard to letter case among both available and archived doors in that warehouse, a required GPS location, and a current lifecycle state of available or archived. Another warehouse may contain a door with the same name.
- **Warehouse**: The storage destination that contains a warehouse door. Its required footprint supplies the geographic boundary within or on which every contained door's GPS location lies.
- **Warehouse Door GPS Location**: The required latitude and longitude of the operational point where a truck stops to unload at a warehouse door.
- **Warehouse Door Lifecycle State**: The door's current classification. An available door may be used for new operations when its containing warehouse is also available; an archived door remains readable but is not available for new operational use.
- **Operating Site**: The operational scope that owns the warehouses and warehouse doors visible to the active user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of warehouse doors are presented under their correct containing warehouse and lifecycle state, with no door duplicated or attributed to another warehouse.
- **SC-002**: At least 90% of representative users can select a warehouse, locate a named door, identify its lifecycle state, and select it in both the list and map on their first attempt within 30 seconds.
- **SC-003**: For collections of up to 200 warehouses and 1,000 warehouse doors, at least 95% of successful consultations show the selected warehouse's door collection or correct empty state within 2 seconds under normal operating conditions.
- **SC-004**: In 100% of tested spatial records, each warehouse door is shown at its recorded GPS location within or on the containing warehouse footprint, and activating it selects that exact door in both the map and list.
- **SC-005**: In all tested lifecycle combinations, 100% of archived doors remain readable and 0% are presented as available for new operational use.
- **SC-006**: In 100% of tested empty, loading, map-failure, and retrieval-failure conditions, users receive distinct feedback; after a recoverable retrieval failure is resolved, the offered retry reaches the current collection or correct empty state.
- **SC-007**: In 100% of authorization tests, active authenticated user roles can complete read-only consultation while unauthenticated and non-active users receive no warehouse-door information.
- **SC-008**: In 100% of available-only collection tests, every returned door and its containing warehouse are available, and no archived door or door of an archived warehouse is returned.

## Assumptions

- "Authorized user" means any authenticated user with active access to the operating organization; warehouse-door consultation is read-only for all active roles, while later administration features may impose narrower permissions.
- The operating organization manages exactly one site, so the user's organization determines the warehouse and warehouse-door scope without an additional site picker.
- The existing warehouse consultation experience provides the sole user-facing entry point and the containing warehouse and footprint context in which doors are consulted; this feature extends the selected warehouse's map and list context rather than adding a standalone warehouse-door destination, door detail view, or separate warehouse lifecycle.
- The authoritative warehouse consultation response embeds all contained doors so warehouse geometry, lifecycle, and doors are consumed from one snapshot. A separate available-only warehouse-door endpoint is prepared solely as the safe source for future discharge selectors.
- Every warehouse door belongs permanently to one existing warehouse and has one valid required GPS location within or on that warehouse's footprint.
- Available and archived are the only warehouse-door lifecycle states relevant to consultation. A warehouse cannot be archived while it has available doors, so doors shown under an archived warehouse are historical references.
- The default door lifecycle view follows the selected warehouse's lifecycle state: Available for an available warehouse and Archived for an archived warehouse; users may still choose either lifecycle state.
- The initial delivery is sized for no more than 200 warehouses and 1,000 warehouse doors per site; pagination, custom sorting, and door-name search are outside this slice.
- Because consultation is read-only, it has no write-conflict journey; lifecycle changes made elsewhere are handled through the refresh and stale-selection behavior defined above.
- Warehouse-door creation, update, archival, and reactivation are independently deliverable follow-up issues #213 through #216; creating a discharge and selecting its door remain outside Issue #212.
