# Warehouse Door Consultation UI Contract

## Route

`GET /warehouses?status=<all|available|archived>&search=<text>&warehouseId=<uuid>&doorStatus=<available|archived>&doorId=<uuid>`

- `status`, `search`, and `warehouseId` retain the existing warehouse consultation meaning.
- `doorStatus` is optional. When absent for a valid selected warehouse, it resolves to `available`
  for an available warehouse and `archived` for an archived warehouse.
- `doorId` is optional and may resolve only to a door that belongs to `warehouseId` and is admitted
  by the effective door lifecycle view.
- Selecting a different warehouse clears `doorStatus` and `doorId`, allowing the new warehouse's
  contextual default to apply.
- A door lifecycle change clears `doorId` only when the selected door is excluded from the new
  scope. `all` admits both states.
- Closing the warehouse panel clears `warehouseId`, `doorStatus`, and `doorId`.
- Back/forward navigation and reload restore every valid warehouse and door state.
- A malformed, missing, wrong-warehouse, stale, or filtered-out `doorId` never substitutes another
  door. It is cleared only after the warehouse snapshot with embedded doors has resolved successfully.

The feature introduces no `/warehouse-doors` page.

## Snapshot and Selection States

| Warehouse snapshot | Selected warehouse | Door selection | Required presentation |
|---|---|---|---|
| pending | unresolved or absent | unresolved or absent | Existing warehouse pending feedback; no false warehouse or door empty claim |
| success | absent | absent | Existing warehouse-only overview; no door marker, door label, door legend, panel, or separate door request |
| success | valid, with admitted doors | absent | Contextual lifecycle tab, counts, markers, and accessible door list |
| success | valid, with admitted doors | valid `doorId` | Selected list entry plus strongly emphasized exact marker; the door list remains visible |
| success | valid | stale, wrong-warehouse, or filtered-out `doorId` | Door selection clears; selected warehouse and lifecycle view remain |
| success | valid, with zero admitted doors | absent | Lifecycle-specific empty message; all three door tabs remain reachable |
| error | unresolved or absent | unresolved or absent | Existing warehouse failure feedback and retry; no partial door collection is presented as authoritative |
| retry succeeds | re-evaluated | re-evaluated | Latest warehouses, markers, counts, empty state, and valid selection replace stale data |
| success; basemap fails | valid | valid or absent | Map-specific feedback; embedded door list and selection remain available |

## Query and Projection

- The existing route loader preloads `GET /api/v1/warehouses`, whose items now include `doors`.
- The warehouse consultation screen never calls `GET /api/v1/warehouse-doors/available`; that
  endpoint is reserved for future operational selectors.
- A resolved warehouse snapshot remains cached for subsequent warehouse switches; selecting or
  filtering doors makes no second request.
- Counts are derived before lifecycle filtering from the selected warehouse's embedded `doors`.
- Refresh replaces name, location, and lifecycle state by stable door identity. A door is never
  duplicated when its values change.
- Snapshot pending/error/retry uses the existing warehouse source feedback; there is no independent
  door-source state or partial warehouse/door snapshot.

## Panel

- The selected warehouse uses an opt-in non-modal, overlay-free sheet with outside pointer dismissal
  disabled so the footprint and door markers remain focusable and clickable.
- Desktop uses a bounded right panel; narrow screens use a bounded bottom panel that leaves a usable
  part of the map visible.
- The panel retains the selected warehouse's name, lifecycle status, and footprint context.
- Available and Archived door tabs expose their labels, active state, and counts to assistive
  technology. No door search or custom sort control is present.
- The admitted door list uses deterministic name/identity order and provides a keyboard path when
  markers overlap or the map background is unavailable.
- Selecting a door keeps the admitted door collection visible and marks the exact list entry as
  selected. The selected marker receives strong visual emphasis.

## Map and Markers

- The warehouse overview renders no door markers, labels, or door legend until a warehouse is
  selected, regardless of which embedded door data is already loaded.
- The map keeps the complete selected warehouse footprint framed while its admitted doors are
  overlaid at recorded coordinates.
- The actual footprint polygon is the primary pointer target. No transparent hit area may extend
  beyond the polygon's geographic geometry.
- Each footprint has a compact center control that provides a visible, keyboard-focusable fallback
  target. The center control must not cover the footprint's full bounding box or intercept map clicks
  outside the footprint.
- Only doors belonging to the selected warehouse and admitted by the effective lifecycle view are
  rendered; selecting another warehouse replaces the overlay instead of accumulating door layers.
- Each marker is compact, uses a recognizable door symbol, has no persistent text label, and exposes
  an accessible button name containing door name and lifecycle state.
- Hovering or focusing a marker exposes a tooltip with the same name and status.
- Activating a marker by pointer or keyboard writes the exact `doorId` and selects the matching list
  entry; no item-detail request is made.
- The selected marker alone receives strong visual emphasis; other admitted markers remain visually
  quiet while preserving contrast, pointer targets, keyboard focus, and lifecycle recognition.
- Available markers use a solid, high-emphasis treatment. Archived markers use a muted/dashed
  treatment and archive badge. Labels and structure make status understandable without color.
- A door legend is shown while a warehouse is selected without removing the warehouse legend.
- Doors at the same or nearby coordinates receive stable visual offsets computed from coordinates
  and stable identity; every door remains independently reachable in the panel list.

## Door Selection

The selected list entry and marker expose the door's name and lifecycle status. The list remains the
primary keyboard and degraded-map path, while the map provides spatial emphasis at the recorded
location. No separate door detail panel, item-detail route, or door mutation control exists.
