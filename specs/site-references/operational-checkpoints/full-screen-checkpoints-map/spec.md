# Feature Specification: Full-screen Checkpoints map

**Feature Branch**: `feat/320-full-screen-checkpoints-map`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "l'issue github 320" — [whazzark/portflow-ai#320](https://github.com/whazzark/portflow-ai/issues/320)
"Full-screen Checkpoints map", child of epic [#313 Interface V2](https://github.com/whazzark/portflow-ai/issues/313),
depends on [#314](https://github.com/whazzark/portflow-ai/issues/314) (V2 palette and authenticated shell, merged).

**Design reference**: Portflow — Écrans canvas, page *Site references · Checkpoints*, retained
option C (*Retenue*): full-screen map, floating toolbar, cards anchored to the marker, status
legend. Artboards: Carte, Recherche et filtres, Menu Create, Create dock (placement), Create
weighing area (placement), Détail dock, Détail weighing area, Edit dock (déplacement), Archive
dock, Archivage confirmé, Archivés + Reactivate, Aucun résultat, Thème clair.

## Context

The Checkpoints screen (`/checkpoints`, administrators only) already lets an administrator see
docks and weighing areas on a map, search and filter them, create one by placing it on the map,
inspect it, edit its name and position, archive and reactivate it individually, and archive or
reactivate several at once. Today the map sits inside a page frame and every detail, creation and
edit flow opens in a side sheet that covers part of the map.

This feature restyles that screen to the retained V2: the map fills the whole content area, the
search, filters and Create action float over it in one toolbar, and details and forms appear as
cards anchored next to the selected checkpoint so the map context stays visible. It is a
presentation and interaction change of existing capabilities. The business rules of docks and
weighing areas (name and GPS location required, a dock serves at most one active discharge,
archive and reactivation rules, authorization) are unchanged and remain enforced by the API.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find checkpoints on a full-screen map (Priority: P1)

An administrator opens Checkpoints and sees the site's docks and weighing areas on a map that
fills the whole content area beside the application sidebar. A floating toolbar at the top offers
a search field, two type toggles (Docks, Weighing areas) and two status toggles (Available,
Archived), each showing how many checkpoints it covers, plus a Create button. A legend explains
the marker symbols (Dock, Weighing area, Archived) and map controls allow zooming in, zooming out
and fitting all checkpoints. Typing in the search field lists the matching checkpoints under the
field, with the matched text highlighted and the checkpoint's type shown.

**Why this priority**: Finding a checkpoint is the entry point of every other action on the
screen; the full-screen map with its floating toolbar is the core of the retained V2.

**Independent Test**: Seed docks and weighing areas in both statuses, open Checkpoints, and
verify the full-screen map, the toolbar counts, the legend, type and status filtering, the search
suggestions, and the no-match state, without performing any mutation.

**Acceptance Scenarios**:

1. **Given** 10 available docks, 2 available weighing areas and 3 archived checkpoints, **When**
   the administrator opens Checkpoints, **Then** the map fills the content area, Docks and
   Weighing areas are both on, Available is on and Archived is off, the toolbar shows the counts
   for each toggle, and only the 12 available checkpoints are drawn as markers.
2. **Given** the map is shown, **When** the administrator turns Weighing areas off, **Then** only
   dock markers remain, the legend lists only the visible types, and the setting survives a page
   reload and a shared link.
3. **Given** the map is shown, **When** the administrator turns Archived on, **Then** archived
   checkpoints are drawn with the archived marker style alongside the available ones.
4. **Given** the administrator types "chef" in the search field, **When** matching checkpoints
   exist in the selected types and statuses, **Then** a list under the field shows each match
   with the matched text highlighted and its type, followed by a summary such as "4 of 12
   available · Enter to zoom to all matches", and the map shows only the matching markers.
5. **Given** the suggestion list is open, **When** the administrator picks a suggestion (pointer
   or keyboard), **Then** the map centers on that checkpoint and opens its detail card; **When**
   instead they press Enter without picking one, **Then** the map zooms to fit all matches.
6. **Given** a search that matches nothing in the selected types and statuses, **When** the
   results are computed, **Then** the map shows the message "No checkpoint matches “<search>”",
   an explanation that search looks at names in the selected types and status, and two actions:
   Clear search, and Include archived (shown only while Archived is off).
7. **Given** the map is shown, **When** the administrator uses Fit all checkpoints, **Then** the
   map frames every currently visible checkpoint.

---

### User Story 2 - Inspect a checkpoint in an anchored card (Priority: P1)

Selecting a marker opens a detail card anchored next to that marker instead of a side sheet. The
card shows the checkpoint's name, its type and status, its GPS location with a button to copy the
coordinates, when it was last updated and created, and the actions available for its status:
Edit and Archive for an available checkpoint, Reactivate for an archived one. An archived
checkpoint's card states when it was archived and that it can no longer be selected for new
discharges while past discharges keep it.

**Why this priority**: Inspection is the gateway to edit, archive and reactivate, and the anchored
card is the main visual change compared with today's side sheet.

**Independent Test**: Select a dock, a weighing area and an archived checkpoint in turn and verify
each card's content, its anchoring to the selected marker, closing it, copying coordinates, and
deep-linking to a selected checkpoint.

**Acceptance Scenarios**:

1. **Given** an available dock, **When** the administrator selects its marker, **Then** the
   marker shows as selected and a card anchored to it shows the dock's name, "Dock · Available",
   its GPS location, "Updated <date, time> · created <date, time>", and the Edit and Archive
   actions.
2. **Given** an available weighing area, **When** the administrator selects its marker, **Then**
   the card shows "Weighing area · Available" with the same structure and actions.
3. **Given** an archived checkpoint visible in the archived view, **When** it is selected,
   **Then** the card shows "Archived", the archive date and time with the explanation that it
   can't be selected for new discharges while past discharges keep it, and a single Reactivate
   action.
4. **Given** a detail card is open, **When** the administrator uses Copy coordinates, **Then** the
   "latitude, longitude" text is copied to the clipboard and a brief confirmation is shown.
5. **Given** a detail card is open, **When** the administrator uses Close, presses Escape, or
   clicks an empty area of the map, **Then** the card closes and the selection is cleared.
6. **Given** a link to Checkpoints naming a selected checkpoint (including the legacy parameter
   name still accepted today), **When** it is opened, **Then** the map centers on that checkpoint
   and its card is open.
7. **Given** any checkpoint, **When** its card is open, **Then** the card shows no "Discharges"
   section: the V2 section listing a checkpoint's active and planned discharges is deferred to a
   follow-up issue (clarified 2026-10-22).

---

### User Story 3 - Create a dock or a weighing area by placing it on the map (Priority: P2)

The Create button opens a menu with "New dock — Berth where trucks are loaded" and "New weighing
area — Weighbridge where trucks are weighed". Choosing one enters placement mode: a banner over
the map says what to do ("Placing a new dock · click the map where trucks are loaded" or "Placing
a new weighing area · click the weighbridge position") with a Cancel action, and clicking the map
drops a draggable pin. A card anchored to the pin asks for the name and shows the latitude and
longitude, which follow the pin and can also be typed. Creating the checkpoint closes placement
mode, shows it on the map and confirms the creation.

**Why this priority**: Creation already works today; the V2 changes how it is presented, so it
follows the read paths in priority.

**Independent Test**: Create one dock and one weighing area through the menu and placement mode,
then verify they appear on the map, are selected, and that cancelling or validation errors leave
no checkpoint behind.

**Acceptance Scenarios**:

1. **Given** the toolbar, **When** the administrator opens Create, **Then** a menu offers New dock
   and New weighing area, each with its one-line description.
2. **Given** the administrator chose New dock, **When** placement mode starts, **Then** the
   placement banner with Cancel is shown, the other toolbar actions that would start another flow
   are unavailable, and clicking the map drops a pin and opens the "New dock" card with "Drag the
   pin to adjust its position.", a required Dock name, Latitude, Longitude, Cancel and Create dock.
3. **Given** a placed pin, **When** the administrator drags it, **Then** the latitude and
   longitude update; **When** they type valid coordinates, **Then** the pin moves to them.
4. **Given** a valid name and position, **When** the administrator selects Create dock, **Then**
   the dock is created, placement mode ends, the new dock is shown and selected on the map, and a
   success confirmation names it; if the type filter would hide it, the filter is widened so it
   stays visible.
5. **Given** the API rejects the creation (for example a missing name or a duplicate), **When**
   the administrator submits, **Then** the card stays open with the entered values and shows the
   errors next to the relevant fields.
6. **Given** placement mode, **When** the administrator uses Cancel (banner or card) or presses
   Escape, **Then** placement mode ends and no checkpoint is created.
7. **Given** the administrator chose New weighing area, **Then** the same flow applies with the
   weighing-area banner, "Place the pin where trucks stand on the weighbridge.", a required
   Weighing area name, and Create weighing area.

---

### User Story 4 - Edit a checkpoint by moving it (Priority: P2)

From an available checkpoint's card, Edit enters move mode: a banner says "Drag the pin to move
<name>" with Cancel, the pin becomes draggable, the previous position stays marked on the map, and
an "Edit dock" card anchored to the pin shows the previous coordinates, the editable name,
latitude and longitude, Cancel and Save changes.

**Why this priority**: Editing already exists; the V2 makes repositioning the primary editing
gesture.

**Independent Test**: Move and rename a dock, save, and verify the new position and name; then
start another edit and cancel, verifying nothing changed.

**Acceptance Scenarios**:

1. **Given** an available dock's card, **When** the administrator selects Edit, **Then** move mode
   starts with the banner, a draggable pin at the current position, a marker for the previous
   position labelled as such, and the edit card showing "Previous position <lat, lng>".
2. **Given** move mode, **When** the administrator drags the pin or types new coordinates or a new
   name and selects Save changes, **Then** the dock is updated, move mode ends, the dock's card
   shows the new values, and a success confirmation names it.
3. **Given** move mode, **When** the administrator uses Cancel or presses Escape, **Then** the pin
   returns to the previous position and nothing is saved.
4. **Given** the API rejects the update (validation error, or the dock was archived or deleted
   meanwhile), **When** the administrator saves, **Then** the error is shown and, where the dock
   no longer exists, move mode ends and the selection is cleared.
5. **Given** an available weighing area's card, **When** the administrator selects Edit, **Then**
   the same move mode applies with an "Edit weighing area" card.
6. **Given** an archived checkpoint, **Then** no Edit action is offered.

---

### User Story 5 - Archive and reactivate a checkpoint (Priority: P2)

Archive on an available checkpoint's card opens a confirmation dialog ("Archive <name>?") that
explains the consequence: the checkpoint can no longer be selected for new discharges, past
discharges keep it, and it can be reactivated later from Archived. Confirming archives it, closes
its card and shows a toast "<name> archived — Find it under Archived to reactivate it." with a
View action that opens the archived view on it. From an archived checkpoint's card, Reactivate
returns it to Available.

**Why this priority**: Archiving and reactivating already exist; the V2 changes their confirmation
and feedback.

**Independent Test**: Archive an available dock with no active discharge, follow the toast's View
action to its archived card, reactivate it, and verify it is available again; attempt to archive a
dock serving an active discharge and verify the refusal.

**Acceptance Scenarios**:

1. **Given** an available dock's card, **When** the administrator selects Archive, **Then** a
   dialog titled "Archive <name>?" explains the consequences and offers Cancel and Archive.
2. **Given** the dialog, **When** the administrator confirms, **Then** the dock is archived, the
   dialog and card close, the marker disappears while Archived is off, and the toast
   "<name> archived" with "Find it under Archived to reactivate it." and a View action is shown.
3. **Given** the toast, **When** the administrator selects View, **Then** Archived is turned on,
   the map centers on the archived dock and its card is open.
4. **Given** the API refuses the archive (for example the dock serves an active discharge),
   **When** the administrator confirms, **Then** the dialog stays open and the refusal reason is
   shown, and the dock remains available.
5. **Given** an archived checkpoint's card, **When** the administrator selects Reactivate and
   confirms, **Then** it becomes available, its card shows Available with Edit and Archive, and a
   success confirmation names it.
6. **Given** the same flows on a weighing area, **Then** they behave identically with
   weighing-area wording.

---

### User Story 6 - Use the screen in the light theme (Priority: P3)

The screen, including the map tiles, markers, toolbar, cards, banners, dialog, toasts and legend,
renders legibly in both the dark and light themes of the V2 shell.

**Why this priority**: The V2 palette and theme switch come from #314; this story only ensures the
Checkpoints screen honours them.

**Independent Test**: Switch the shell to the light theme and walk through the map, a detail card,
placement mode and the archive dialog, checking legibility and contrast.

**Acceptance Scenarios**:

1. **Given** the light theme is active, **When** the administrator opens Checkpoints, **Then** the
   map uses a light basemap and every overlay uses the light V2 palette.
2. **Given** either theme, **Then** text and essential markers meet WCAG AA contrast against their
   background.

---

### User Story 7 - Archive or reactivate several checkpoints at once (Priority: P3)

[NEEDS CLARIFICATION: Today an administrator can enter a select mode on the map (also by
shift-clicking a marker), check several docks or several weighing areas of the same status, and
archive or reactivate them together with partial-success feedback. The retained V2 artboards show
no affordance for this. Should the full-screen map keep bulk archive and reactivate (restyled to
the V2 toolbar, e.g. as a floating selection bar), or is it removed from the Checkpoints screen in
this issue?]

---

### Edge Cases

- **Map unavailable** (tiles fail to load): the toolbar, search and Create stay usable, and the
  screen says the map is unavailable while offering the creation actions, as today.
- **Weighing areas fail to load**: docks are still shown, a message says weighing areas could not
  be loaded with a Retry action, and their counts are not presented as zero.
- **No checkpoint configured**: the map shows that no checkpoints have been configured and, for an
  administrator, invites creating one.
- **Both toggles of one group off**: a type or status group cannot be left with every toggle off;
  turning off the last active toggle of a group is prevented.
- **Selected checkpoint filtered out or deleted**: if a filter, search or concurrent change hides
  the selected checkpoint, its card closes instead of pointing at nothing.
- **Card near the map edge or on a narrow viewport**: the anchored card stays fully visible (the
  map pans or the card repositions), and below tablet width cards may dock to the bottom of the
  screen instead of floating next to the marker.
- **Flow exclusivity**: placement mode and move mode are exclusive; starting one ends the other
  only by deliberate choice, and leaving the page or reloading in the middle of a flow discards
  the unsaved pin without creating or updating anything.
- **Overlapping markers**: checkpoints at the same or very close positions remain individually
  selectable, as today.
- **Non-administrator**: the screen is not reachable, as today; no create, edit, archive or
  reactivate action is exposed.

## Requirements *(mandatory)*

### Functional Requirements

**Layout and navigation**

- **FR-001**: The Checkpoints screen MUST display the map across the whole content area next to
  the V2 application sidebar, without a page header or side sheet reducing it.
- **FR-002**: The screen MUST overlay a floating toolbar containing: the search field; a
  "Checkpoint types" group with Docks and Weighing areas toggles; a "Filter by checkpoint status"
  group with Available and Archived toggles; and a Create button for administrators.
- **FR-003**: Each type and status toggle MUST show the number of checkpoints it covers.
- **FR-004**: The screen MUST overlay a legend for the visible marker kinds (Dock, Weighing area)
  and the archived marker style, and map controls for Zoom in, Zoom out and Fit all checkpoints.
- **FR-005**: Search text, type toggles, status toggles, the selected checkpoint, and an active
  creation or edit flow MUST be reflected in the URL so that reload, back/forward and shared links
  restore them; existing links (including the legacy selected-checkpoint parameter) MUST keep
  working.

**Search and filters**

- **FR-006**: Turning a type toggle off MUST hide that type's markers and legend entry; at least
  one type toggle and at least one status toggle MUST remain on.
- **FR-007**: The status toggles MUST select available checkpoints, archived checkpoints, or both;
  archived checkpoints MUST be drawn with a distinct archived style.
- **FR-008**: Search MUST match checkpoint names within the selected types and statuses, case- and
  accent-insensitively, and limit the markers to the matches.
- **FR-009**: While search text is present and matches exist, the screen MUST show a suggestion
  list of matches with the matched text highlighted, each match's type, and a summary of the match
  count over the filtered total with the hint that Enter zooms to all matches.
- **FR-010**: Choosing a suggestion MUST center the map on that checkpoint and open its detail
  card; pressing Enter without a chosen suggestion MUST fit the map to all matches. The list MUST
  be operable by keyboard.
- **FR-011**: When search text matches nothing, the screen MUST show the no-match state naming the
  search, explaining the search scope, and offering Clear search and, while archived checkpoints
  are excluded, Include archived.

**Detail cards**

- **FR-012**: Selecting a marker MUST mark it as selected and open a detail card anchored to it,
  replacing any previously open card.
- **FR-013**: The detail card MUST show the name, the type, the status, the GPS location with a
  Copy coordinates action, and the last-updated and created date-times; for an archived checkpoint
  it MUST also show the archive date-time and the consequence of being archived.
- **FR-014**: The card MUST offer Edit and Archive for an available checkpoint and Reactivate for
  an archived one, to administrators only.
- **FR-015**: The card MUST close via its Close action, Escape, or a click on an empty map area,
  clearing the selection.
- **FR-016**: The card MUST remain fully visible within the map area regardless of the marker's
  position.
- **FR-017**: The card MUST NOT show a checkpoint's related discharges in this feature; that V2
  section is deferred to a follow-up issue.

**Creation**

- **FR-018**: Create MUST open a menu with New dock and New weighing area, each with its one-line
  description.
- **FR-019**: Choosing a kind MUST enter placement mode with a banner naming the kind and the
  placement instruction and a Cancel action; while active, actions that would start another
  creation, an edit, or a selection MUST be unavailable except switching creation kind.
- **FR-020**: Clicking the map in placement mode MUST drop a draggable pin and open a creation card
  anchored to it with the required name field, latitude and longitude kept in sync with the pin,
  Cancel, and the kind-specific Create action.
- **FR-021**: A successful creation MUST end placement mode, select and reveal the new checkpoint
  (widening the type filter if needed), and confirm the creation by name; a rejected creation MUST
  keep the card and its values and show the errors.

**Move edit**

- **FR-022**: Edit MUST enter move mode with a banner "Drag the pin to move <name>" and Cancel, a
  draggable pin at the current position, a marker for the previous position, and an edit card
  showing the previous coordinates and the editable name, latitude and longitude, with Cancel and
  Save changes.
- **FR-023**: Dragging the pin and editing the coordinates MUST stay in sync; Save changes MUST
  persist the name and position; Cancel or Escape MUST restore the previous position without
  saving.
- **FR-024**: Move mode MUST apply to both docks and weighing areas, with kind-specific wording.

**Archive and reactivate**

- **FR-025**: Archive MUST open a confirmation dialog "Archive <name>?" explaining that the
  checkpoint can no longer be selected for new discharges, that past discharges keep it, and that
  it can be reactivated later from Archived, with Cancel and Archive.
- **FR-026**: The archive and reactivate confirmations MUST keep the existing optional comment
  recorded with the lifecycle change.
- **FR-027**: A successful archive MUST close the dialog and card and show a toast "<name>
  archived" with "Find it under Archived to reactivate it." and a View action that turns Archived
  on, centers on the checkpoint and opens its card.
- **FR-028**: A refused archive or reactivation MUST keep the dialog open with the entered comment
  and show the refusal reason returned by the API.
- **FR-029**: Reactivate MUST return the checkpoint to Available and confirm it by name.

**Bulk lifecycle**

- **FR-030**: Bulk archive and reactivate of checkpoints MUST be handled as decided in User Story
  7 (open question Q2).

**Theme, accessibility, states**

- **FR-031**: The screen MUST render in the dark and light themes of the V2 shell, including a
  basemap matching the active theme.
- **FR-032**: Every toolbar control, toggle, marker, card action and dialog MUST be reachable and
  operable by keyboard and have an accessible name; toggles MUST expose their pressed state.
- **FR-033**: The existing loading, map-unavailable, weighing-area-unavailable (with Retry), and
  nothing-configured states MUST remain, restyled to the V2.
- **FR-034**: The screen MUST remain restricted to administrators, with all business rules and
  authorization still enforced by the API.

### Key Entities

- **Checkpoint**: interface grouping of docks and weighing areas (see `CONTEXT.md`); not a separate
  site reference. Shown with name, kind, status, GPS location, and lifecycle dates.
- **Dock**: named operational berth with a required GPS location; serves at most one active
  discharge at a time.
- **Weighing area**: named weighbridge position with a required GPS location; may serve several
  active discharges.
- **Lifecycle change**: an archive or reactivation of a checkpoint with its date-time, author and
  optional comment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every acceptance criterion of #320 maps to at least one passing automated scenario:
  full-screen map with legend, search and the four filters, Create menu, dock and weighing-area
  placement, both detail cards, move edit, archive dialog and toast, archived view with Reactivate,
  no-match state, and light theme.
- **SC-002**: With the default filters, the map area occupies at least 90% of the content area at
  a 1440×900 viewport, and no detail, creation or edit flow covers more than 30% of the map.
- **SC-003**: An administrator can find a named checkpoint by search and open its card in under 10
  seconds and 3 interactions.
- **SC-004**: An administrator can create a dock (open menu, place, name, submit) in under 30
  seconds with no page change.
- **SC-005**: No existing capability of the Checkpoints screen regresses: create, edit, archive and
  reactivate of both kinds, URL-restorable state and legacy links, and the error and empty states
  keep passing their existing scenarios (adapted to the new presentation).
- **SC-006**: Automated accessibility checks of the map, a detail card, placement mode and the
  archive dialog report no serious or critical violations in either theme.

## Clarifications

### Session 2026-10-22

- Q: Is the V2 "Discharges" section of the detail cards in scope? → A: No, deferred to a
  follow-up issue (User Story 2 scenario 7, FR-017).

## Assumptions

- The V2 palette, theme switch and authenticated shell from #314 are available on `master` and
  are reused, not redefined.
- No API change is required: the detail cards use only the checkpoint data the screen already
  loads. The V2 "Discharges" section (a checkpoint's active and planned discharges, with the dock
  and weighing-area concurrency rule) is out of scope and will be specified in a follow-up issue.
- The archive and reactivation dialogs keep today's optional comment field even though the V2
  artboard omits it, because the comment is part of the recorded lifecycle history.
- Weighing areas get the same Edit-by-moving flow as docks: the V2 shows Edit on the weighing-area
  card and editing weighing areas exists today; the issue's "dock edit by moving it" is read as
  the representative case.
- Move mode keeps today's rule that only available checkpoints can be edited.
- The archived view is the archived status toggle (alone or combined with Available), not a
  separate screen.
- The shared map workspace is also restyled by #321 (Full-screen Warehouses map); the two issues
  should converge on one floating-toolbar and anchored-card presentation rather than diverge.
- Screen copy stays in English, as in the V2 artboards and the rest of the application.
