# Checkpoint UI Integration Contract: Weighing Areas

## Existing route

`GET /checkpoints?kinds=<dock|weighing-area>&status=<all|available|archived>&search=<text>&checkpoint=<kind>:<id>`

- No new page route is introduced.
- `status`, `search`, retry, degraded-map behavior, and browser-history semantics remain those of the
  merged Checkpoint feature.
- `kinds` is omitted when both resource kinds are visible, and is set to `dock` or `weighing-area`
  when only that resource kind is visible. At least one kind remains enabled.
- The kind and status filters combine before search highlighting; search preserves nonmatching spatial
  context within the currently visible kinds.
- `checkpoint=weighing-area:<id>` selects a weighing area; `checkpoint=dock:<id>` remains unchanged.
- A status change clears a selected resource only when that resource is excluded by the new status.
- Search applies to visible resource names, emphasizes matches, and preserves nonmatching spatial
  context.

## Data composition

- The route keeps its existing `docks.index` preload. The aggregate page loads
  `weighingAreas.index` through an independent typed query state.
- The page adapts both DTO collections into the shared `Checkpoint` presentation type and combines
  them without creating a Checkpoint API entity.
- A Weighing Area collection pending/error state is explicit and retryable without hiding or
  disabling successfully loaded Dock markers. The existing Dock route error and basemap degradation
  behavior remain unchanged.
- The existing All/Available/Archived filter applies uniformly to docks and weighing areas.
- The resource-kind menu uses persistent checkboxes for Docks and Weighing Areas. It stays open while
  a checkbox is changed and closes through the trigger, Escape, or outside click.
- Docks use a solid blue circular marker with an anchor symbol; Weighing Areas use a circular marker with
  a blue outline and scale symbol. The type distinction is repeated in the legend without introducing a
  competing color system.
- Archived docks and Weighing Areas use the same neutral treatment: light background, muted icon, dashed
  border, and archive badge. Their anchor or scale icon remains the type distinction, and color is never
  the only type or lifecycle signal.
- The resource-kind filter uses small neutral anchor and scale icons without marker backgrounds or archive
  badges.

## Weighing-area presentation

- Every admitted weighing area is plotted at its latitude and longitude with the existing scale
  marker symbol and an accessible label containing its name and lifecycle status.
- Docks and weighing areas are both visible by default now that both resource sources are delivered.
- The legend identifies both resource kinds and both lifecycle statuses when both kinds are loaded.
- If no weighing areas exist, or none exist for the selected status, weighing-area-specific empty
  feedback is shown even when dock markers keep the aggregate map populated.
- Selecting a weighing-area marker writes `checkpoint=weighing-area:<id>` and opens the shared sheet.

## Detail state

- The shared Checkpoint sheet resolves the selected Weighing Area directly from the current complete
  collection, exactly as it resolves a Dock.
- Detail opens without another request and shows name, status, latitude, longitude, and applicable
  lifecycle metadata from that collection DTO.
- A missing, malformed, unavailable, or status-excluded selection closes and clears `checkpoint`
  without substituting another resource.
- Closing the sheet clears only the `checkpoint` search parameter.

## Scope boundary

The integration adds no create, edit, archive, reactivate, delete, table, pagination, new map
provider, Checkpoint persistence model, Checkpoint API endpoint, or Weighing Area detail endpoint.
