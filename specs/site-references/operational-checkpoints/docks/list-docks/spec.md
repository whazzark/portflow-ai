# Feature Specification: List Docks

**Feature Branch**: `feat/197-list-docks`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Permettre à un utilisateur autorisé de consulter les quais disponibles et archivés, avec les états vide, détail et erreur. Afficher les quais sur une carte avec leur nom au survol et ouvrir leur détail depuis leur marqueur. Ajouter une recherche qui met en évidence les quais correspondants sans masquer le contexte spatial, ainsi qu'un filtre de statut Tous/Disponibles/Archivés. Issue GitHub : https://github.com/whazzark/portflow-ai/issues/197"

**GitHub Issue**: [#197](https://github.com/whazzark/portflow-ai/issues/197)

**Parent Roadmap**: `specs/site-references/operational-checkpoints/docks/roadmap.md`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Available and Archived Docks (Priority: P1)

An authorized user opens the Checkpoints page, consults the site's docks, and can clearly distinguish docks that are available for new operational use from docks that have been archived.

**Why this priority**: This is the primary outcome of the feature and gives users a reliable view of the dock references they can use or may need to recognize in historical records.

**Independent Test**: Provide at least one available dock and one archived dock, open the dock consultation area as an authorized user, and verify that both records are initially present, can be filtered by status, and remain correctly identified.

**Acceptance Scenarios**:

1. **Given** the site has available and archived docks and the user is authorized to consult them, **When** the user opens the dock consultation area, **Then** all docks are shown by default and each dock's lifecycle status is clearly identified.
2. **Given** an available dock and an archived dock are visible, **When** the user reviews the map, **Then** each dock appears exactly once at its recorded GPS location.
3. **Given** the user is not authenticated or is not authorized to consult docks, **When** the user attempts to access the dock consultation area, **Then** no dock information is disclosed and access is refused using the application's established access-handling behavior.
4. **Given** all docks are displayed, **When** the user chooses Available or Archived from the status filter, **Then** only docks with that status remain on the map, and the active choice is clearly indicated.
5. **Given** docks in the selected status scope have different names, **When** the user searches for part of a dock name, **Then** matching map markers are emphasized while non-matching markers remain present but visually muted.
6. **Given** no dock name matches the search, **When** the search is applied, **Then** the spatial context remains visible in a muted state and an explicit no-match message offers a way to clear the search.

---

### User Story 2 - Inspect Dock Details (Priority: P2)

An authorized user selects a dock from the current status-filtered map and inspects its identifying, location, status, and relevant lifecycle information without changing it.

**Why this priority**: The collection establishes which docks exist; the detail view supplies the information needed to identify a dock confidently and understand whether it can be used in new operations.

**Independent Test**: Select one available dock and one archived dock from their map markers, then verify that each interaction opens the read-only details for the exact selected dock.

**Acceptance Scenarios**:

1. **Given** a dock marker is visible on the map, **When** the user selects it, **Then** the detail state identifies that dock and shows its name, latitude, longitude, current status, creation time, and last-update time.
2. **Given** the selected dock has archive or reactivation history, **When** its detail state is shown, **Then** the relevant lifecycle date and comment are visible when recorded.
3. **Given** an archived dock is selected, **When** its details are shown, **Then** the dock remains readable and is clearly identified as unavailable for new operational use.
4. **Given** a detail state refers to a dock that is absent from the current collection, **When** the state is resolved, **Then** no unrelated dock is shown and the invalid detail state is closed or replaced by the collection view.
5. **Given** a dock marker is visible on the map, **When** the user hovers it or gives it keyboard focus, **Then** a tooltip identifies the dock by name.
6. **Given** a dock marker is visible on the map, **When** the user activates it with a pointer or keyboard, **Then** the read-only detail state opens for that exact dock.

---

### User Story 3 - Understand Empty and Error States (Priority: P3)

An authorized user receives clear feedback when a status filter contains no docks or when the dock collection cannot be loaded, and can retry a failed load.

**Why this priority**: Explicit empty and failure feedback prevents users from mistaking missing data or a loading failure for an incomplete interface.

**Independent Test**: Load the consultation area once with no docks for the selected status and once with a recoverable loading failure; verify the distinct empty message and the error message with a working retry action.

**Acceptance Scenarios**:

1. **Given** no docks exist for the selected status, **When** the collection loads successfully, **Then** the user sees a status-specific empty message rather than an empty or misleading collection.
2. **Given** dock information cannot be loaded, **When** the consultation area enters the error state, **Then** the user sees a clear failure message and an action to try loading the collection again.
3. **Given** the collection previously failed to load and the underlying problem is resolved, **When** the user retries, **Then** the error state is replaced by the current dock collection or the appropriate empty state.

### Edge Cases

- A site has no docks at all: the all-docks view and each status filter report an appropriate empty state without implying a loading failure.
- Only one status has docks: the all-docks view shows that collection while the other status filter shows its empty state.
- A dock changes status between the initial load and a retry: the refreshed collection places it only under its current status.
- Several docks share similar names or coordinates: each remains independently selectable and its detail state is tied to its stable identity.
- Several docks share the same or very close coordinates: each marker retains an independent stable identity and accessible name.
- Lifecycle dates or comments are absent: the detail state omits unavailable optional facts without displaying invented placeholders.
- A dock-loading request remains pending: the user receives progress feedback and does not see a false empty state.
- The map background cannot load: the user receives map-specific feedback rather than a collection-level loading failure.
- A status change excludes the dock whose detail sheet is open: the invalid selection is cleared and no unrelated dock is substituted.
- Search text differs only by case or diacritics: matching remains consistent and predictable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated, active user whose permissions include dock consultation to access the dock collection for their site.
- **FR-002**: The system MUST refuse dock consultation to unauthenticated or unauthorized users without disclosing dock information.
- **FR-003**: The system MUST include both available and archived docks in the consultation experience.
- **FR-004**: The system MUST provide a clearly labeled lifecycle-status filter with All, Available, and Archived choices, and MUST present All by default.
- **FR-005**: Each map marker MUST preserve the dock's stable identity and recorded GPS location for selection.
- **FR-006**: Each dock MUST appear exactly once according to its current status.
- **FR-007**: Users MUST be able to select any visible available or archived dock and inspect its details.
- **FR-008**: The detail state MUST show the selected dock's name, latitude, longitude, current status, creation time, and last-update time.
- **FR-009**: The detail state MUST show recorded archive or reactivation dates and comments when those facts exist.
- **FR-010**: Archived docks MUST remain readable and MUST be identified as unavailable for new operational use.
- **FR-011**: When the current status filter contains no docks, the system MUST show a filter-specific empty state and MUST distinguish it from a loading failure.
- **FR-012**: While dock information is being retrieved, the system MUST show progress feedback and MUST NOT present a false empty state.
- **FR-013**: When the dock collection cannot be loaded, the system MUST show a clear error state with an action that retries the load.
- **FR-014**: A successful retry MUST replace the error state with the current collection or the appropriate empty state.
- **FR-015**: An invalid, stale, or status-filtered-out detail selection MUST NOT display a different dock and MUST return the user to a valid collection state.
- **FR-016**: Dock creation, modification, archival, reactivation, custom sorting, filtering beyond lifecycle status, permanent deletion, address lookup, and coordinate editing MUST remain outside this feature.
- **FR-017**: The current lifecycle-status filter MUST plot every included dock on a map at its recorded latitude and longitude.
- **FR-018**: Each map marker MUST use a recognizable dock symbol and expose the dock name on pointer hover and keyboard focus.
- **FR-019**: Activating a map marker with a pointer or keyboard MUST open the exact read-only detail state for that dock.
- **FR-020**: The interface MUST show map-specific feedback when the map background is unavailable.
- **FR-021**: The map MUST expose a dock-name search control positioned as an overlay in its upper-left area without preventing keyboard access to the map.
- **FR-022**: Dock-name search MUST use case- and diacritic-insensitive partial matching and MUST emphasize matching docks while keeping non-matching map markers visible but muted.
- **FR-023**: When dock-name search has no matches, the system MUST show an explicit no-match message and a clear-search action without presenting the result as an empty status collection.
- **FR-024**: The map MUST expose an adjacent status-filter control that opens the All, Available, and Archived choices and applies the selected choice to the map.
- **FR-025**: Search and status-filter state MUST be restorable through navigation, and their labels, active state, focus state, and match distinction MUST remain understandable without relying on color alone.
- **FR-026**: The dock map MUST fill the available page area below the application header, without a separate page title, description, or dock list.
- **FR-027**: The consultation experience MUST use `/checkpoints` as its sole page route and MUST encode an exact selected resource as a typed `checkpoint=<kind>:<id>` URL value, without introducing a Checkpoint API entity.

### Key Entities

- **Dock**: A named operational berth at which a vessel is discharged. It has a stable identity, required latitude and longitude, a current lifecycle status, creation and last-update times, and optional lifecycle history.
- **Dock Status**: The current lifecycle classification of a dock. An available dock can be selected for new operational use; an archived dock is read-only and remains visible for administration and historical understanding.
- **Dock Lifecycle Information**: Optional facts recording a dock's most recent archive or reactivation, including the event time and any recorded comment.
- **Checkpoint**: The interface category grouping docks and weighing areas. It is not a persisted site reference and does not replace their distinct business identities or API contracts.
- **Authorized User**: An authenticated, active member of the operating organization whose assigned permissions allow consultation of the site's dock references.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of available and archived docks are presented under the correct status, with no dock duplicated or omitted.
- **SC-002**: At least 95% of successful dock collection loads show the collection or the correct empty state within 2 seconds under normal operating conditions.
- **SC-003**: At least 95% of users can identify a dock on the map and open its details from its marker on their first attempt.
- **SC-004**: In 100% of tested empty-data cases, users can distinguish an empty status filter from a loading failure.
- **SC-005**: In 100% of tested recoverable loading failures, users are shown a retry action and can reach the current collection or empty state after the failure is resolved.
- **SC-006**: In 100% of tested unauthorized-access cases, no dock information is visible.
- **SC-007**: In 100% of acceptance tests, each status-filter choice produces the correct included dock set on the map.
- **SC-008**: In 100% of tested searches, matching docks are distinguishable without removing non-matching spatial context, and a zero-match search provides a working clear action.

## Assumptions

- The issue is an end-to-end consultation slice for the existing dock site reference; mutation behavior belongs to issues #198 through #201.
- Dock consultation follows the existing application access model: the user's authenticated active status and assigned permissions determine access, while the server remains authoritative.
- Available and archived are the only dock lifecycle statuses relevant to this feature; All is a presentation filter that combines them.
- A dock's GPS location is represented by its latitude and longitude; the map visualizes those recorded coordinates without address lookup or coordinate editing.
- The map is the primary consultation view and fills the available page area; controls and feedback are presented as overlays.
- The site already provides dock data and stable dock identities; this feature does not migrate or reconcile existing records.
- The established application language and accessibility conventions apply to labels, feedback, keyboard interaction, and focus management.
