# UI Contract: Operational Checkpoints Workbench

## Route and state

- Authenticated route: `/checkpoints`; the existing Checkpoints sidebar item links to it.
- URL search state records visible resource types and independent Dock and Weighing Area name-search and available/archived status values.
- Changing one resource's name search preserves its selected status and does not alter the other resource's search or status state.
- Detail state records the named resource type, resource ID, and mode (`create`, `view`, or `edit`). Invalid or unauthorized combinations are normalized to a safe closed or read-only state.
- Search is a trimmed, case-insensitive substring match on `name` only. Changing search preserves that resource type's selected availability status.

## Workbench structure

- The primary workbench is a MapCN map of dock and weighing-area coordinates, backed by the owned shadcn-style component and `maplibre-gl`. It uses MapCN's default theme-aware CARTO styles with visible attribution and mounts its canvas only on the client.
- Each resource type uses a distinct marker icon; color reinforces the type and lifecycle state but is never the only differentiator. No generic Checkpoint record is displayed.
- The visible-type filter selects Docks, Weighing Areas, or both. Independent per-type lifecycle and search controls determine which resources of each visible type appear; counts and labels make every active filter explicit.
- Selecting a marker opens a details sheet backed by the selected list item. The sheet exposes name, GPS coordinates, lifecycle metadata, and permitted actions without a single-resource GET request.
- Each type's search remains a name-only, case-insensitive filter applied to that type's map markers and synchronized list. Empty, loading, retryable error, map-unavailable, and stale-detail states have visible, announced feedback.
- Active non-admin users may search, filter, and inspect details. They never receive create, edit, selection, archive, or reactivate controls.

## Administration flows

- Create and edit use one resource-aware form with labelled name, latitude, and longitude fields, the shared `useAppForm` API, client validation matching the API ranges, field-level server validation, and a form-level error.
- Create is individual and begins at version `1`. Edit is available-only and submits the version shown when the form opened.
- Individual archive and reactivation require confirmation and accept an optional comment of at most 1,000 characters. The submitted command includes the displayed version.
- Row selection is scoped to the currently visible resource type, status, and search result. Changing any of those clears selection and prior grouped feedback.
- Grouped archive/reactivation uses a keyboard-reachable selection toolbar, disables repeated submission while pending, confirms the action, and submits each selected ID with its displayed version.

## Mutation feedback and refresh

- Successful mutations invalidate both list and available queries for only the affected named resource. The workbench updates without a full-page reload.
- A grouped result reports every unchanged item by name when known and by ID otherwise, with a human-readable reason. Successful items are never shown as failed.
- After a grouped result, the announced inline outcome lists every changed and unchanged resource; it is not reduced to a summary toast. Changed IDs leave selection. Blocked IDs that still belong to the visible scope may remain selected, but stale items cannot be retried until an explicit reload obtains their current versions; missing or moved items remain in the dismissible outcome even when no row can stay selected.
- An individual `STALE_VERSION` response leaves the authoritative record unchanged, exits unsafe edit/action state, refreshes the affected queries, and presents an explicit “Reload latest data” action. The client never retries automatically.
- Network and request-level failures keep the confirmation/form recoverable and preserve entered comments where safe.

## Responsive and accessibility behavior

- The workbench reuses the Channel Marker tokens, IBM Plex typography, shadcn primitives, Lucide icons, and dark-mode provider.
- The route shell, filters, and synchronized list remain usable during SSR and when WebGL, the CARTO styles, or remote tiles are unavailable.
- A visible page title and labelled map filter controls identify the workbench, resource type, and resource status. The map has an accessible text/list representation of visible markers so location and type are not conveyed by visual position or color alone.
- At 375, 768, 1024, and 1440 px widths, the map, filters, sheet, confirmation dialog, and selection toolbar remain visible and operable without horizontal page overflow.
- Icon-only controls have accessible names; selection state is announced through checkboxes and row state; focus is visible; tab order follows the visual flow; dialogs do not trap focus after closure.
- Status, success, partial success, and blocker reasons use text in addition to color. Pending controls are disabled to prevent duplicate submissions.
