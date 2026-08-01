# Checkpoint Consultation UI Contract

## Route

`GET /checkpoints?status=<all|available|archived>&search=<text>&checkpoint=<kind>:<id>`

- `status` defaults or normalizes to `all`.
- `search` is optional and is matched against dock names after trimming and case/diacritic normalization.
- `checkpoint=dock:<id>` opens only the matching dock from the current status-filtered collection.
- `weighing-area:<id>` is reserved for the future weighing-area source.
- A missing, malformed, unavailable, or stale checkpoint selection must not substitute another resource; detail closes and the collection
  remains usable.
- A status change that excludes the selected checkpoint clears `checkpoint`; search does not clear it.
- Back/forward navigation restores filter, search, and valid selection state.

## Observable states

| Query state | Selected status data | Selection | Required presentation |
|---|---|---|---|
| pending | unknown | any | Progress/skeleton feedback; no empty claim |
| success | one or more docks | absent | Status-filtered full-area map with selectable markers; All is default |
| success | one or more docks | matching `checkpoint=dock:<id>` | Map plus read-only detail sheet for that exact dock |
| success | any | invalid or stale `checkpoint` | Collection view with detail closed/cleared |
| success | zero status-filtered docks | absent | Filter-specific successful empty message |
| success | docks but zero search matches | any valid selection | Existing markers muted, explicit no-match message, and clear-search action |
| error | unknown | any | Clear load failure and `Try again` action |
| retry succeeds | current data | resolved again | Current map or correct filter-specific empty state |
| basemap style error | current data | any | Non-blocking map feedback; markers and detail remain usable |

## Checkpoint presentation entry

Each checkpoint exposes its resource kind, name, GPS location, lifecycle status, and stable ID.
With All selected, available and archived records may appear together. Available or Archived
excludes the other status from the map. A search match is emphasized and a nonmatch is muted
without being removed. Docks are the only loaded kind in this slice.

## Map overlay controls

- A responsive absolute overlay at the map's upper-left contains a labeled checkpoint-name search input
  with a clear affordance and an adjacent labeled status-filter button.
- The status menu uses one mutually exclusive choice: All, Available, or Archived; the active
  choice is exposed visually and to assistive technology.
- Search and filter controls have visible focus states, keyboard operation, and sufficient contrast.
- Match distinction does not rely on color alone.
- Typing search text updates URL state with replacement navigation and does not refit the map.

## Map

- The map plots every dock admitted by the selected status filter at its recorded coordinates.
- Each marker uses a recognizable dock symbol and has an accessible name containing the dock name.
- Hovering or focusing a marker displays the dock name in a tooltip.
- Clicking a marker or activating it from the keyboard writes the typed `checkpoint` selection and
  opens the resource-specific detail in the shared sheet.
- Failure of the configured MapLibre basemap style does not turn a successful dock query into a
  collection error; the marker layer remains available over the degraded background.

## Detail sheet

The sheet is read-only and presents:

- name;
- latitude and longitude;
- `Available` or `Archived` status;
- created and last-updated times;
- recorded archive/reactivation times and comments only when non-null;
- explicit unavailable-for-new-operations wording for archived docks.

Create, edit, archive, reactivate, delete, custom sort, and non-status filter controls are absent
from this feature.

## API read boundary

The UI currently consumes only `GET /api/v1/docks`. No `GET /api/v1/docks/:id` route remains; the
selected dock is resolved from the current collection by stable ID. Checkpoint remains an interface
category and does not introduce an API endpoint or persisted entity.
