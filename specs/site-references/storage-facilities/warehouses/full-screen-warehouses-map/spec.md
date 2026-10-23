# Feature Specification: Full-Screen Warehouses Map

**Feature Branch**: `feat/321-full-screen-warehouses-map`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "l'issue github 321 (https://github.com/whazzark/portflow-ai/issues/321) — Full-screen Warehouses map"

**GitHub Issue**: [#321](https://github.com/whazzark/portflow-ai/issues/321)

**Parent Epic**: [#313 Interface V2](https://github.com/whazzark/portflow-ai/issues/313)

**Depends on**: [#314 V2 palette and authenticated shell](https://github.com/whazzark/portflow-ai/issues/314) (merged)

**Design reference**: [Portflow — Écrans canvas](https://claude.ai/artifact/1RyXTf3HKkxNHBS3ZVc3iT),
page **Site references · Warehouses**, column *Retenue* (Option C): Carte, Recherche, Aucun
résultat, Détail entrepôt + portes, Create warehouse (tracé), Edit warehouse (contour), Create door,
Menu porte, Edit door (déplacement), Archive warehouse, Archivage confirmé, Archivés + Reactivate,
Thème clair.

## Context

Warehouses and their doors are already fully manageable on `/warehouses`: consultation, status
filters, name search, creation by footprint, footprint and name correction, archival and
reactivation (single and bulk), and door creation, correction, archival, and reactivation. Those
business rules are specified in the sibling feature directories under
`specs/site-references/storage-facilities/warehouses/` and
`specs/site-references/storage-facilities/warehouse-doors/` and remain the behavioral contract.

This feature changes **how** those capabilities are presented and reached: the page becomes a
full-screen map under the V2 shell, with a floating toolbar, a single detail card anchored to the
selected warehouse's outline, explicit on-map modes (draw, outline editing, door placement, door
move), search across warehouses **and** doors, and the V2 archive confirmation, toast, archived
view, and no-match states. No warehouse or door business rule changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consult warehouses on a full-screen map (Priority: P1)

Any active user opens Warehouses and sees the site's warehouses as outlines on a map that fills the
whole content area of the shell. A floating toolbar holds the search field, the status filter
(Available and Archived, each with its count), and — for administrators — `Create warehouse`. A
legend (Warehouse, Door, Archived) and map controls (Zoom in, Zoom out, Fit all warehouses) float
over the map. Selecting a warehouse opens a detail card anchored next to its outline showing its
name, kind and status, its footprint summary (number of boundary points and centre coordinates with
a copy action), its doors with their status filter and coordinates, and its update and creation
times.

**Why this priority**: Consultation is the foundation every other journey on this screen starts
from, and it is the core visual change of the V2.

**Independent Test**: Sign in as a non-administrator user on a site with available and archived
warehouses that have doors, open Warehouses, and verify the full-screen map, toolbar, legend, map
controls, status counts, and the anchored detail card with doors; verify no management action is
offered.

**Acceptance Scenarios**:

1. **Given** a site with available and archived warehouses, **When** a user opens Warehouses,
   **Then** the map fills the shell content area, available warehouses are shown with their names,
   the status filter shows `Available` selected with its count and `Archived` unselected with its
   count, and the map is framed on the visible warehouses.
2. **Given** the map is open, **When** the user looks at it, **Then** a legend identifies Warehouse,
   Door, and Archived symbols and remains visible in every state of the screen (consultation,
   search, card, draw, edit, placement).
3. **Given** the map is open, **When** the user uses Zoom in, Zoom out, or Fit all warehouses,
   **Then** the map zooms accordingly or reframes on all warehouses visible under the current filter.
4. **Given** a warehouse on the map, **When** the user selects its outline or name, **Then** its
   doors appear as door symbols on the map and a detail card opens next to the outline, without
   hiding it, showing name, `Warehouse · <status>`, `<n> boundary points · centre <lat>, <lng>`,
   the doors list with an Available/Archived door filter and counts, each door's name and
   coordinates, and `Updated <date, time> · created <date, time>`.
5. **Given** the detail card is open, **When** the user selects a door in the list, **Then** that
   door's unloading point is highlighted on the map.
6. **Given** the detail card is open, **When** the user uses the copy action on the centre
   coordinates, **Then** the coordinates are copied and the user receives a confirmation.
7. **Given** the detail card is open, **When** the user closes it (Close button or Escape),
   **Then** the card disappears and the map stays in place.
8. **Given** a user who is not an administrator, **When** they consult Warehouses, **Then**
   `Create warehouse`, `Create door`, `Edit`, `Archive`, `Reactivate`, and the door management menu
   entries are absent (not disabled); door `Show on map` and `Copy coordinates` remain available.

---

### User Story 2 - Find a warehouse or door by name (Priority: P1)

A user types in the toolbar search field and sees grouped results — warehouses and doors — so they
can jump to the right place on the map even when they only know a door's name.

**Why this priority**: Searching doors is new in V2 and is the fastest route to a resource on a busy
site; the no-match state prevents dead ends.

**Independent Test**: With several warehouses and doors, type part of a door name and of a warehouse
name, check the grouped results, open one with the keyboard, then type a name that matches nothing
and use each no-match action.

**Acceptance Scenarios**:

1. **Given** the search field has focus, **When** the user types text, **Then** a results list
   opens with a `Warehouses` group (count, each with its name and door summary, e.g. `4 doors` or
   `2 doors · 1 archived`) and a `Doors` group (count, each with its name and `In <warehouse>`),
   with the matching text emphasized, and matching warehouses are emphasized on the map.
2. **Given** results are shown, **When** the user moves through them with the arrow keys and
   presses Enter (or clicks one), **Then** a warehouse result selects that warehouse and opens its
   card; a door result selects its warehouse, opens its card, and highlights that door.
3. **Given** the status filter, **When** the user searches, **Then** only resources in the selected
   statuses are searched; a hint states that archived results appear when Archived is on.
4. **Given** a search text matching no warehouse or door name in the selected statuses, **When** the
   results would be empty, **Then** a no-match message names the search text
   (`No warehouse or door matches “<text>”`), explains what search looks at, and offers
   `Clear search` and — when Archived is not selected — `Include archived`.
5. **Given** the no-match state, **When** the user chooses `Include archived`, **Then** Archived is
   added to the status filter and the search is re-run; **When** they choose `Clear search`,
   **Then** the search is emptied and the map shows all warehouses under the current filter.
6. **Given** search text with different letter case or accents than a name, **When** the user
   searches, **Then** matching ignores case and diacritics, as it does today.

---

### User Story 3 - Create a warehouse by drawing its outline (Priority: P2)

An administrator chooses `Create warehouse`, enters a draw mode where clicking the map adds
corners, closes the outline by clicking the first point, names the warehouse, and creates it.

**Why this priority**: Creation is the main write path for the screen, reshaped around direct map
drawing.

**Independent Test**: As an administrator, start Create warehouse, place points, remove the last
one, close the outline, name it, create it, and verify it appears selected on the map; repeat and
cancel to verify nothing is created.

**Acceptance Scenarios**:

1. **Given** an administrator on the map, **When** they choose `Create warehouse`, **Then** the
   toolbar is replaced by a mode banner (`Drawing a new warehouse · click the first point to close
   the outline`, with `Cancel`) and a `New warehouse` card shows `Click the map to add corners.`, a
   required `Warehouse name` field, the number of points placed, `Remove last point`, an expandable
   `Coordinates (advanced)` section, `Cancel`, and `Create warehouse`.
2. **Given** draw mode, **When** the administrator clicks the map, **Then** a corner is added, the
   outline in progress is drawn, and the points counter updates; `Remove last point` removes the most
   recent one.
3. **Given** at least the minimum number of points, **When** the administrator clicks the first
   point, **Then** the outline closes; until it is closed, `Create warehouse` is unavailable and the
   card states `Close the outline to create the warehouse.`
4. **Given** a closed outline and a valid name, **When** the administrator chooses `Create
   warehouse`, **Then** the warehouse is created, the mode ends, the new warehouse is selected with
   its card open, and a success toast confirms it.
5. **Given** draw mode, **When** the administrator uses `Coordinates (advanced)`, **Then** they can
   enter or correct the corner coordinates by keyboard and the map outline reflects them.
6. **Given** draw mode, **When** the administrator chooses `Cancel` (banner or card) or presses
   Escape, **Then** the mode ends and nothing is created.
7. **Given** an invalid outline or name, or a refusal from the server, **When** creation is
   attempted, **Then** the existing validation and failure messages are shown in the card and the
   drawing is preserved.

---

### User Story 4 - Edit a warehouse by moving its outline handles (Priority: P2)

An administrator chooses `Edit` on an available warehouse's card, then reshapes its outline by
dragging point handles or adding points at midpoints, and may rename it.

**Why this priority**: Correcting a footprint directly on the map replaces the separate edit sheet.

**Independent Test**: As an administrator, edit an available warehouse, move one point, add one at a
midpoint, undo, rename, save, and verify the change; repeat and cancel to verify nothing changes.

**Acceptance Scenarios**:

1. **Given** an available warehouse's card, **When** the administrator chooses `Edit`, **Then** a
   mode banner (`Drag a point to reshape <name> · click a midpoint to add one`, with `Cancel`)
   replaces the toolbar, handles appear on every outline point and midpoint, the previous outline
   stays visible dashed, and an `Edit warehouse` card shows the name field, `<n> boundary points ·
   <m> moved`, `Undo`, `Coordinates (advanced)`, `Cancel`, and `Save changes`.
2. **Given** outline editing, **When** the administrator drags a point handle, **Then** the outline
   follows and the moved counter updates; **When** they click a midpoint handle, **Then** a new
   point is added there; **When** they choose `Undo`, **Then** the last change is reverted.
3. **Given** valid changes, **When** the administrator chooses `Save changes`, **Then** the
   warehouse is updated, the mode ends, its card shows the new values, and a success toast confirms
   it.
4. **Given** outline editing, **When** the administrator cancels or presses Escape, **Then** the
   original outline and name are kept.
5. **Given** a change that would leave a door outside the new outline, or any other existing
   footprint rule violation, **When** saving, **Then** the existing refusal is explained in the card
   and the edit is preserved.

---

### User Story 5 - Manage doors by placement, menu, and move (Priority: P2)

From a warehouse's card, an administrator creates a door by placing it inside the outline, opens a
door's menu to edit, show on map, copy coordinates, archive, or reactivate it, and edits a door by
dragging its pin.

**Why this priority**: Doors are the operational targets of rotations; managing them in place on the
map is part of the retained V2.

**Independent Test**: As an administrator, create a door by clicking inside a warehouse and
adjusting the pin, open its menu and use each entry, move it by dragging, then try to place or move
a door outside the outline.

**Acceptance Scenarios**:

1. **Given** an available warehouse's card, **When** the administrator chooses `Create door`,
   **Then** a mode banner (`Placing a new door · click inside <warehouse>`, with `Cancel`) replaces
   the toolbar and a `New door` card shows `In <warehouse> · drag the pin to adjust.`, a required
   `Door name` field, `Latitude` and `Longitude` fields, `Cancel`, and `Create door`.
2. **Given** door placement, **When** the administrator clicks inside the outline, **Then** a pin
   is placed and the coordinates fields are filled; dragging the pin or editing the fields moves it.
3. **Given** a pin outside the warehouse footprint, **When** the administrator tries to create the
   door, **Then** creation is refused with the existing outside-footprint message.
4. **Given** a valid name and position, **When** the administrator chooses `Create door`, **Then**
   the door is created, appears in the card's door list and on the map, and a success toast confirms
   it.
5. **Given** a door in the card's list, **When** the user opens its actions menu, **Then** it offers
   `Show on map` and `Copy coordinates` to everyone and, for administrators, `Edit` and `Archive` on
   an available door, or `Reactivate` on an archived door, under the existing door lifecycle rules
   (no door management entry while its warehouse is archived).
6. **Given** a door's `Edit`, **When** it opens, **Then** a mode banner (`Drag the pin to move
   <door> · it must stay inside <warehouse>`, with `Cancel`) replaces the toolbar, the previous
   position stays marked, and an `Edit door` card shows `Previous position <lat>, <lng>`, name,
   latitude, longitude, `Cancel`, and `Save changes`.
7. **Given** door editing, **When** the administrator drags the pin within the outline and saves,
   **Then** the door is updated and a success toast confirms it; a position outside the outline is
   refused with the existing message.
8. **Given** a door's `Archive` or `Reactivate`, **When** confirmed, **Then** the existing door
   lifecycle dialog, rules, and feedback apply.

---

### User Story 6 - Archive a warehouse and find it again (Priority: P2)

An administrator archives a warehouse through a V2 confirmation dialog, gets a toast that leads to
the archived view, and can reactivate an archived warehouse from its card.

**Why this priority**: Archival is the destructive-looking action of the screen; V2 makes its
consequences explicit and its undo path discoverable.

**Independent Test**: As an administrator, archive a warehouse with doors, check the dialog text,
confirm, use the toast's `View`, and reactivate it from its archived card.

**Acceptance Scenarios**:

1. **Given** an available warehouse's card, **When** the administrator chooses `Archive`, **Then**
   a dialog titled `Archive <warehouse>?` explains that the warehouse and its `<n>` available doors
   can no longer be selected for new discharges, that past discharges keep them, and that it can be
   reactivated later from Archived, with `Cancel` and `Archive`.
2. **Given** the dialog, **When** the administrator confirms, **Then** the warehouse and all of its
   doors are archived under the existing rule, the card closes, the warehouse leaves the Available
   view, and a toast states `<warehouse> archived`, `Its <n> doors are archived with it. Find it
   under Archived to reactivate it.`, with a `View` action.
3. **Given** the toast, **When** the administrator chooses `View`, **Then** Archived is included in
   the status filter and the archived warehouse is selected with its card open.
4. **Given** a warehouse with a door in use by a planned or active discharge, **When** archival is
   attempted, **Then** it is refused and the dialog explains why, as today.
5. **Given** the Archived filter is on, **When** the user views the map, **Then** archived
   warehouses use the Archived symbol of the legend, and selecting one opens a card with status
   `Archived`, its footprint summary, and `Archived on <date, time>. It and its doors can’t be
   selected for new discharges; past discharges keep them.`
6. **Given** an archived warehouse's card, **When** an administrator chooses `Reactivate` and
   confirms, **Then** the warehouse and its doors return to service under the existing rule and a
   success toast confirms it; no `Edit`, `Archive`, or `Create door` is offered on an archived
   warehouse.

---

### User Story 7 - Use the screen in the light theme (Priority: P3)

A user who selected the light theme sees the same screen with the light map basemap and light
surfaces, with every state legible.

**Why this priority**: The V2 shell supports both themes; Warehouses must not break in light.

**Independent Test**: Switch to the light theme and go through consultation, search, card, a mode,
the dialog, and the toast; verify contrast and legibility.

**Acceptance Scenarios**:

1. **Given** the light theme, **When** the user opens Warehouses, **Then** the basemap, toolbar,
   legend, controls, card, banners, menus, dialog, and toast all use light-theme colors and meet the
   same contrast requirements as the dark theme.
2. **Given** a theme change while on Warehouses, **When** it applies, **Then** the map and every
   overlay switch without losing the current selection, filter, search, or mode.

### Edge Cases

- **No warehouses at all**: the map shows the site area with an empty-state message and, for
  administrators, `Create warehouse`.
- **Filter excluding everything** (both statuses off, or only Archived with none archived): the
  status filter never allows both statuses to be off; an empty status shows its zero count and an
  empty-state message.
- **Mode exclusivity**: only one of draw, outline editing, door placement, or door move can be
  active at a time; while a mode is active, selecting another warehouse, searching, and filtering
  are unavailable.
- **Leaving a mode with unsaved changes** (Cancel, Escape, navigating away): changes are discarded
  without a confirmation prompt, as today.
- **Card placement near the screen edge**: the card stays fully visible and never covers its own
  warehouse's outline; when the outline is too large, the map pans so both fit.
- **Concurrent change**: if the selected warehouse or door was changed, archived, or reactivated by
  someone else, the existing conflict refusal is shown and the card refreshes.
- **Deep links**: a link to a selected warehouse, door, status filter, search, or mode keeps
  restoring that state, under the same permission and status checks as today.
- **Narrow viewports**: on narrow screens the card becomes a bottom panel over the map, and the
  toolbar wraps; every action stays reachable.
- **Keyboard and assistive technology**: every map action has a keyboard path (selection via search
  or list, coordinates fields for drawing and placement); warehouses and doors on the map have
  accessible names (`<name>, warehouse`, `<name>, warehouse, archived`, `<name>, warehouse door`).
- **Clipboard unavailable**: copy actions report failure instead of claiming success.

## Requirements *(mandatory)*

### Functional Requirements

**Layout and consultation**

- **FR-001**: The Warehouses page MUST present the map filling the entire content area of the V2
  authenticated shell, with the toolbar, legend, map controls, card, banners, and toasts floating
  over it.
- **FR-002**: The floating toolbar MUST contain the search field, a status filter with
  independently toggleable `Available` and `Archived` options each showing its count, and, for
  administrators only, `Create warehouse`. `Available` MUST be the only status selected initially.
- **FR-003**: The legend MUST identify the Warehouse, Door, and Archived symbols and MUST be
  visible in every state of the screen.
- **FR-004**: Map controls MUST offer Zoom in, Zoom out, and Fit all warehouses (framing the
  warehouses visible under the current filter), and the basemap attribution MUST remain visible.
- **FR-005**: Selecting a warehouse MUST open a single detail card anchored next to its outline,
  showing name, kind and status, boundary point count, centre coordinates with a copy action, its
  doors (with an Available/Archived door filter and counts, each door's name and coordinates, and an
  actions menu), its last update and creation times, and the actions permitted by its status and the
  user's role.
- **FR-006**: Selecting a door in the card MUST highlight its unloading point on the map; doors of
  the selected warehouse MUST be shown on the map with the Door symbol.
- **FR-007**: Management actions (`Create warehouse`, `Edit`, `Archive`, `Reactivate`,
  `Create door`, door `Edit`/`Archive`/`Reactivate`) MUST be offered only to administrators and
  only when the existing lifecycle rules allow them; otherwise they MUST be absent, not disabled.

**Search**

- **FR-008**: Search MUST match warehouse names and door names, ignoring case and diacritics, within
  the selected statuses.
- **FR-009**: Search results MUST be grouped into `Warehouses` and `Doors` with counts; a warehouse
  result MUST show its door summary and a door result its warehouse; results MUST be navigable by
  keyboard and opened with Enter or a click.
- **FR-010**: Opening a warehouse result MUST select it; opening a door result MUST select its
  warehouse and highlight that door.
- **FR-011**: When no warehouse or door matches, the screen MUST show a no-match state naming the
  search text, explaining what search covers, and offering `Clear search` and, when Archived is not
  selected, `Include archived`.

**Modes**

- **FR-012**: Creating a warehouse, editing a warehouse outline, placing a door, and moving a door
  MUST each be an explicit on-map mode announced by a banner replacing the toolbar with a `Cancel`
  action, paired with a card holding the form; only one mode MAY be active at a time.
- **FR-013**: Draw mode MUST add a corner per map click, show the count of placed points, allow
  removing the last point, close the outline when the first point is clicked, and allow creation
  only once the outline is closed and valid.
- **FR-014**: Outline editing MUST provide draggable handles on every point, midpoint handles that
  add a point, an undo of the last change, a counter of moved points, and the previous outline shown
  dashed until saved or cancelled.
- **FR-015**: Draw mode and outline editing MUST offer an expandable `Coordinates (advanced)`
  section to enter or correct corner coordinates without a pointer.
- **FR-016**: Door placement and door move MUST position the door by clicking inside the outline
  and/or dragging its pin, mirror the position in Latitude/Longitude fields that can also be typed,
  and, for a move, show the door's previous position.
- **FR-017**: Cancelling a mode (banner, card, or Escape) MUST discard its unsaved changes and
  return to the previous consultation state.

**Door menu**

- **FR-018**: Each door's actions menu MUST offer `Show on map` (centres and highlights the door)
  and `Copy coordinates` to every user, plus `Edit` and `Archive` or `Reactivate` for administrators
  as the existing door rules allow.

**Archive and reactivate**

- **FR-019**: Archiving a warehouse MUST require confirmation in a dialog titled `Archive
  <warehouse>?` that states how many available doors are archived with it, that it can no longer be
  selected for new discharges, that past discharges keep it, and that it can be reactivated from
  Archived.
- **FR-020**: A successful archival MUST show a toast naming the warehouse, stating its doors are
  archived with it, and offering `View`, which includes Archived in the filter and selects the
  archived warehouse.
- **FR-021**: An archived warehouse's card MUST show its archive date and time and the consequence
  statement, and offer `Reactivate` to administrators.
- **FR-022**: All warehouse and door lifecycle rules (cascading archival and reactivation, usage
  blocker, optional comment, conflicts, bulk selection) MUST behave exactly as currently specified;
  only their presentation changes.

**Theming and feedback**

- **FR-023**: The screen and every overlay MUST support the V2 dark and light themes, including a
  theme-appropriate basemap, with contrast of at least 4.5:1 for text.
- **FR-024**: Creations, updates, archivals, reactivations, and copies MUST give feedback through
  the V2 toast; failures MUST keep the user's input and show the existing error messages.
- **FR-025**: Selection, status filter, search, door filter, and active mode MUST remain reflected
  in the page address so the view can be shared and restored, under the existing permission checks.

### Key Entities

- **Warehouse**: storage destination with a name, status (Available or Archived), footprint
  outline, derived centre, doors, and creation/update/archive times. Unchanged.
- **Warehouse Footprint**: required polygon outlining the warehouse; edited through draw mode and
  outline handles. Unchanged rules.
- **Warehouse Door**: unloading door with a name, status, and GPS location inside its warehouse's
  footprint. Unchanged rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every acceptance criterion of #321 maps to at least one passing automated scenario:
  full-screen map with legend, search across warehouses and doors, detail card with doors, outline
  editing, creation by drawing, door placement, door menu, door move, archive dialog and toast,
  archived view with Reactivate, no-match state, and light theme.
- **SC-002**: A user can locate any door by name and see it highlighted on the map in under
  10 seconds, without knowing its warehouse.
- **SC-003**: An administrator can create a warehouse with a 4-corner outline and name in under
  1 minute, and a door in under 30 seconds.
- **SC-004**: 100% of existing warehouse and door lifecycle scenarios (create, update, archive,
  reactivate, bulk, conflicts, permissions) still pass after the redesign.
- **SC-005**: Every state of the screen passes an automated accessibility check with no serious or
  critical violation in both dark and light themes.
- **SC-006**: Each V2 board of the design reference (13 *Retenue* screens) has a corresponding
  reachable state in the application, verified by a human product review.

## Assumptions

- **Presentation-only scope**: no API, data, or business-rule change is needed; door search uses
  the doors already returned with the warehouse list.
- **Bulk selection kept**: the existing bulk archive/reactivate selection for warehouses and doors
  is not drawn in the V2 boards; it is kept with unchanged behavior and restyled to the V2 toolbar
  and card rather than removed. Removing it would be a separate decision.
- **Archive comment kept**: the V2 archive dialog does not draw the optional comment field; the
  existing optional comment is kept in the dialog because the domain records it. The same applies
  to warehouse and door reactivation dialogs, which reuse the V2 dialog style.
- **Door filter in the card** reuses the same Available/Archived toggle pattern as the toolbar
  status filter; door archival/reactivation dialogs keep their current content in V2 style.
- **Status filter** follows the cumulative Available/Archived pills retained for Checkpoints (#320);
  the current `all/available/archived` choice maps onto it (both selected = all).
- **Basemap**: the existing map provider and its light/dark styles are reused; attribution stays as
  required by the provider.
- **Shared map components** used by Checkpoints may be reused, but changes to Checkpoints'
  presentation belong to its own issue.
- The V2 shell, palette, toast, and dialog primitives from #314 are available and reused.
