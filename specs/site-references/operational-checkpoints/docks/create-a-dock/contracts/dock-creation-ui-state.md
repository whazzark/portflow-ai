# Dock Creation UI Contract

## Route

`GET /checkpoints?status=<all|available|archived>&search=<text>&checkpoint=<kind>:<id>&create=dock`

- `create=dock` is a new, independent search-param value. It is orthogonal to `checkpoint`: both
  may be absent, either may be present alone, or both may technically coexist in the URL, but the
  create sheet takes presentation priority over any detail selection while `create=dock` is present
  (see "Precedence" below).
- Any other value (or absence) of `create` behaves exactly as today: no create sheet, no placement
  mode.
- The existing `checkpoint=<kind>:<id>` contract (see `../list-docks/contracts/ui-state.md`) is
  unchanged.

## Entry point

- The map's bottom-right control cluster (`apps/web/src/components/ui/map.tsx`'s `MapControls`,
  `showZoom`) carries a "New dock" action — a `ResourceMapCreateControl`
  (`apps/web/src/components/resource-map/resource-map-create-control.tsx`), stacked directly above
  the zoom buttons — rather than living in the top-left search/filter toolbar
  (`CheckpointMapControls`), which stays limited to search, status, and layer-visibility.
  `ResourceMapCreateControl` is resource-agnostic: it takes a list of `{key, label, onSelect}`
  actions and renders a single icon button when there is exactly one (today: dock only) or a small
  dropdown menu once a second creatable kind (e.g. weighing area) exists — no restructuring needed
  when that happens, just one more entry in the list.
- Visible only when the signed-in user is an organization or operations administrator
  (`isAdministrator(user)` — the same rule the API's `DockPolicy#create` enforces); absent (not
  disabled) for everyone else.
- Activating it navigates to `create=dock` (replacing history, consistent with other checkpoints
  search-param updates) without altering `status`, `search`, or an unrelated `checkpoint` selection,
  and arms map placement mode (see below). No Pending Dock Placement exists yet at this point.

## Map placement mode

While `create=dock` is present:

- The map is in placement mode: existing dock and weighing-area markers remain visible for spatial
  context but are not clickable/selectable (clicking one does not open its detail sheet).
- Clicking anywhere on the map sets (or moves, if one already exists) a Pending Dock Placement
  marker at the clicked coordinates. The marker is visually distinguishable from regular dock
  markers (e.g. a distinct pending/outline style) and is draggable.
- Before the first click, no pending marker exists yet; guidance on how to place the dock (click
  the map, or enter coordinates directly) lives in the sheet's own text (see "Entry sheet / form"),
  not as a separate overlay banner on the map itself.
- Dragging the pending marker updates its coordinates continuously and is reflected in the sheet's
  latitude/longitude fields on drag end.
- The map does not refit or recenter as a result of placement (panning/zooming stays under the
  administrator's control), and the marker stays anchored to its geographic coordinates through any
  pan/zoom.
- Placement mode is exited (existing markers become clickable again, the pending marker is removed)
  whenever `create` leaves the URL — success, cancellation, or navigating away.

## Entry sheet / form

- The sheet titled "Create dock" is open whenever `create=dock` is present (see "Precedence" for
  interaction with `checkpoint`).
- Unlike the read-only detail sheet, the create sheet is **non-modal** and renders **without a
  full-screen overlay**: the map beneath must stay clickable and visible so the administrator can
  place/drag the pending marker while the sheet is open. It also disables pointer-dismissal
  (clicking the map, which is "outside" the sheet, must place a marker, not close the sheet).
  Consequently, while creating, the sheet can only be closed via Escape or the explicit close
  button — **not** by clicking outside it — which differs from the read-only detail sheet's
  overlay-click-to-close behavior.
- It always shows a name field **and** latitude/longitude fields — the coordinate fields are never
  hidden or absent, even before any placement exists. This is required for keyboard-only
  administrators (no pointer to click the map): they can set both coordinates by typing, which
  establishes the Pending Dock Placement the same as a map click would.
- The coordinate fields are synced bidirectionally with the pending marker: dragging the marker (or
  clicking the map) updates both fields; editing a field updates the marker once *both* fields
  parse to a valid, in-range number (a single edited field alone cannot move the marker with only a
  partial coordinate).
- Each coordinate field shows its own inline error (required / not-a-number / out-of-range) once
  that field has been interacted with; an untouched empty field shows no error.
- The submit action is disabled until a Pending Dock Placement exists (both coordinates valid) and
  neither coordinate field currently has an error. A persistent status message explains that a
  location must be placed before creation is possible while it is disabled for that reason.

## Observable states

| State | Trigger | Required presentation |
|---|---|---|
| Closed | `create` absent or not `dock` | No creation sheet, no placement mode; existing checkpoints behavior unchanged |
| Open, no placement yet | `create=dock`, no click yet | Sheet with empty name and coordinate fields (all present, not hidden) and its own "place on the map or enter coordinates" guidance text; submit blocked |
| Open, placed | A map click (or programmatic first coordinate entry) has occurred | Pending marker visible on map; sheet's coordinate fields populated from it; name field editable; submit enabled once name is valid |
| Open, submitting | Form submitted, request in flight | Submit button shows a pending label; fields and marker remain, but resubmission is disabled |
| Blocked (no placement) | Submit attempted with no Pending Dock Placement | Clear inline message that a location must be placed first; no navigation, no request sent |
| Field validation failure | Blank name, or latitude/longitude out of range or non-numeric | Inline error under the specific field; entered name and pending marker retained; no navigation |
| Duplicate-name conflict | Server returns `E_DOCK_NAME_CONFLICT` (409) | Inline error under the `name` field; entered name and pending marker retained; no navigation |
| Network/server failure | Request cannot complete (network error, 5xx, or any other unrecognized error) | Toast-style failure message; entered name and pending marker retained; sheet and placement mode stay active |
| Success | 201 response | Toast confirms creation; sheet transitions to the read-only detail view for the newly created dock (`checkpoint=dock:<id>`, `create` cleared); placement mode exits; dock collection query is invalidated so the map shows it immediately at its final coordinates |
| Cancelled | User closes the sheet (Escape or the explicit close button — not an overlay click, since there is no overlay while creating) before submitting | `create` is cleared; placement mode exits and any pending marker is removed; no dock is created; `checkpoint` and other search state are unaffected |

## Precedence

While `create=dock` is present, the sheet renders the creation form and the map stays in placement
mode regardless of any `checkpoint` value in the URL. On successful creation, the URL is updated in
the same navigation to set `checkpoint=dock:<new id>` and clear `create`, so the sheet then shows
the new dock's read-only detail — the same sheet, transitioned from create mode to view mode,
matching the existing `CustomerSheet` create→view transition pattern.

## Form fields

| Field | Required | Client-side check (mirrors server) | Set by |
|---|---|---|---|
| Name | Yes | Non-blank after trim, ≤255 characters | Typed |
| Latitude | Yes | Numeric, -90 to 90 inclusive | Map click/drag, or typed (always visible) |
| Longitude | Yes | Numeric, -180 to 180 inclusive | Map click/drag, or typed (always visible) |

Status is never a form field: every created dock is `AVAILABLE` (data-model.md).

## Out of scope for this contract

Editing, archiving, reactivating, or deleting a dock; creating a weighing area, warehouse, or
warehouse door; any change to the `GET /api/v1/docks` collection contract or the existing
detail-sheet read contract (`../list-docks/contracts/ui-state.md`).

## Implementation note (non-normative)

The map-placement mechanism this contract describes (click-to-place, draggable pending marker,
suspended existing-marker selection while armed) is implemented as a shared, resource-agnostic
primitive (`apps/web/src/components/resource-map/resource-map-placement.tsx`) so that future
weighing-area, warehouse, and warehouse-door creation features can reuse the same interaction
without re-deriving it — see `research.md`. This contract only governs dock creation's use of it;
it does not authorize or describe those other resources' behavior.
