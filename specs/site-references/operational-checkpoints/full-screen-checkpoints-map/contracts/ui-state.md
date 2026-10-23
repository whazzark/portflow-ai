# UI Contract: Full-screen Checkpoints map

**Feature**: [../spec.md](../spec.md) | **Date**: 2026-10-22

No HTTP contract changes: the screen keeps using the existing dock and weighing-area endpoints
(`GET/POST/PATCH /api/v1/docks`, `/archive`, `/reactivate`, bulk variants, and the weighing-area
equivalents). This contract fixes the observable interface feature tests and browser checks rely
on: the URL, the accessible structure, and the copy.

## Route and URL

`/_authenticated/checkpoints` — search schema unchanged:

| Parameter | Values | Notes |
|---|---|---|
| `search` | string, default `''` | search text |
| `kinds` | `dock` \| `weighing-area` \| absent | absent = both types |
| `status` | `all` \| `available` \| `archived`, default `available` | `all` = both status toggles on |
| `checkpointId` | kind-prefixed id | open detail card |
| `checkpoint` | legacy alias | rewritten to `checkpointId` in `beforeLoad` (unchanged) |
| `create` | `dock` \| `weighing-area` | placement mode; wins over `edit` |
| `edit` | `dock` \| `weighing-area` | move mode; requires `checkpointId` |
| `selecting` | `docks` \| `weighing-areas` | select mode |

Non-administrators: `create`, `edit`, `selecting` are ignored (no mode opens).

## Regions and accessible names

| Element | Role / name | State |
|---|---|---|
| Map section | `region` "Checkpoints locations" | — |
| Map canvas | "Checkpoints map" | — |
| Toolbar search | `combobox` "Search checkpoints" | `aria-expanded` with suggestions |
| Suggestions | `listbox` "Matching checkpoints"; each `option` "<name>" with kind text | highlighted option `aria-selected` |
| Suggestion footer | text "<n> of <total> <status> · Enter to zoom to all matches" | not an option |
| Type group | `group` "Checkpoint types"; buttons "Docks <count>", "Weighing areas <count>" | `aria-pressed`; last active disabled |
| Status group | `group` "Filter by checkpoint status"; buttons "Available <count>", "Archived <count>" | `aria-pressed`; last active disabled |
| Select menu | button "Select" → items "Select docks", "Select weighing areas" | admin only |
| Create menu | button "Create" → items "New dock" (desc. "Berth where trucks are loaded"), "New weighing area" (desc. "Weighbridge where trucks are weighed") | admin only |
| Legend | "Dock", "Weighing area", "Archived" (visible kinds only) | — |
| Map controls | buttons "Zoom in", "Zoom out", "Fit all checkpoints" | — |
| Marker | button "View <kind> <name> (<status>)" (unchanged) | `aria-pressed` when selected; select mode keeps "Select/Deselect <kind> <name>" |
| No-match state | `status` "No checkpoint matches “<search>”" + buttons "Clear search", "Include archived" (only while Archived is off) | — |

## Detail card

`complementary` region labelled by its `heading` (level 2) = checkpoint name.

- Subtitle: "Dock · Available" / "Weighing area · Archived".
- "GPS location" with "<lat>, <lng>" (4 decimals) and button "Copy coordinates" → success toast
  "Coordinates copied".
- Available: footer "Updated <dd/mm/yyyy, hh:mm> · created <dd/mm/yyyy, hh:mm>"; buttons "Edit",
  "Archive".
- Archived: note "Archived on <dd/mm/yyyy, hh:mm>. It can’t be selected for new discharges; past
  discharges keep it."; button "Reactivate".
- Button "Close"; Escape closes; focus moves to the heading on open.
- No "Discharges" section (deferred).

## Mode banners (replace the toolbar)

| Mode | Banner text | Action |
|---|---|---|
| Placing dock | "Placing a new dock · click the map where trucks are loaded" | "Cancel" |
| Placing weighing area | "Placing a new weighing area · click the weighbridge position" | "Cancel" |
| Moving | "Drag the pin to move <name>" | "Cancel" |

## Creation card

Heading "New dock" / "New weighing area"; hint "Drag the pin to adjust its position." / "Place the
pin where trucks stand on the weighbridge."; fields "Dock name"/"Weighing area name" (required),
"Latitude", "Longitude"; buttons "Cancel", "Create dock"/"Create weighing area". Success toast from
`resourceSuccessMessage('create', …)`. API field errors via `applyApiError`.

## Edit card

Heading "Edit dock" / "Edit weighing area"; "Previous position <lat, lng>"; fields name, "Latitude",
"Longitude"; buttons "Cancel", "Save changes". Ghost marker "Previous position of <name>". Success
toast from `resourceSuccessMessage('update', …)`.

## Archive / reactivate

- Alert dialog title "Archive <name>?"; description "The dock can no longer be selected for new
  discharges. Past discharges keep it. You can reactivate it later from Archived." (weighing-area
  wording analogous); optional comment field (unchanged); buttons "Cancel", "Archive".
- Success toast "<name> archived" with description "Find it under Archived to reactivate it." and
  action "View" → `status` includes archived, `checkpointId=<id>`.
- Refusal: dialog stays open, comment kept, error toast with the API reason (unchanged).
- Reactivate: existing reactivation dialog and success toast.

## Bulk selection

Entered from the toolbar's "Select" menu (items "Select docks", "Select weighing areas") or by
shift-clicking an eligible marker. The toolbar stays visible while selecting — search and filters
keep narrowing the map without pruning the checked set, as before — and the Select and Create menus
give way to a "Stop selecting docks" / "Stop selecting weighing areas" button. Markers that cannot
be checked keep opening their card. Unchanged `BulkResourceLifecycleActions` bar ("<n> selected", action, Clear), dialog with optional
comment, partial-success summary, keyboard shortcuts.
