# Phase 0 Research: List Docks

## Complete collection contract

**Decision**: Keep the existing named Tuyau route `docks.index`, backed by `GET /api/v1/docks`, as
the sole dock read endpoint and remove `GET /api/v1/docks/:id` (`docks.show`).

**Rationale**: The endpoint already returns available and archived docks ordered by name, with the
stable identity, GPS coordinates, status, timestamps, and optional lifecycle fields required by
the specification. One cached collection lets the UI change filters and resolve a selected dock
without extra requests or transient disagreement between the map and detail sheet. Removing
the redundant detail route also prevents future clients from choosing a second read path.

**Alternatives considered**:

- Combine `docks.available` with one request per archived/detail record: rejected because no
  archived-only endpoint exists and it would create unnecessary requests.
- Retain `docks.show` for possible future consumers: rejected because no current consumer needs it,
  all detail fields are already in the complete collection, and unused parallel contracts create
  maintenance and authorization drift.
- Add a new screen-specific endpoint: rejected because it would duplicate an adequate contract.

Removing `docks.show` includes the Adonis route, controller injection/action, dedicated show use
case, route/use-case tests, and regenerated Tuyau registry. Repository `findById` remains because
the update and lifecycle use cases still need it.

## Authorization boundary

**Decision**: Preserve `DockPolicy.list`: organization administrators and operations
administrators can retrieve the complete available-and-archived collection. Keep authentication
middleware and Bouncer as authoritative; expose the navigation affordance only to the same roles.

**Rationale**: Archived reference administration is already protected by the complete-list policy,
while active users of other roles use the separate `docks.available` selection contract. This
matches the selected feature's “authorized user” wording without expanding the repository's role
model or disclosing archived data to a broader audience.

**Alternatives considered**:

- Permit every active user to call `docks.index`: rejected because it changes the established API
  authorization boundary and would broaden issue #197 beyond the approved contract.
- Rely on hiding the sidebar item: rejected as a security boundary; client visibility is only an
  ergonomic mirror of the server policy.

## Route and navigable state

**Decision**: Add the authenticated route `/checkpoints` as the sole destination of the
“Checkpoints” sidebar item, and validate `status=all|available|archived`, optional normalized
`search`, and optional typed `checkpoint=<kind>:<id>` URL state. The current dock selection format
is `checkpoint=dock:<id>`; `weighing-area:<id>` is reserved for the future peer resource. Invalid,
missing, unavailable, or status-excluded selections close the detail state. Search does not clear
selection because it never excludes a checkpoint. The former `/docks` page route is not retained.

**Rationale**: `CONTEXT.md` defines Checkpoint as the interface category grouping docks and
weighing areas without replacing their separate business identities. The UI route therefore names
that category while the API contracts remain resource-specific. Filter, search, checkpoint kind,
and selected identity have restore/share value, so ADR-0008 places them in the URL. Replacement
navigation while typing avoids one browser-history entry per character.

**Alternatives considered**:

- `/docks`: rejected because it exposes the first resource as the identity of an interface that is
  explicitly intended to aggregate docks and weighing areas.
- `/checkpoints/docks`: rejected because the map is the checkpoint hub, not a dock-only subpage.
- Component-local filter, search, and selection state: rejected because refresh/back/forward would lose the
  consultation state.
- A nested `/docks/:id` route: rejected because the established reference-list pattern uses a
  sheet and this slice needs one collection-centric retry/error boundary.

## UI composition and feedback states

**Decision**: Use route preloading with `ensureQueryData`, the same query options in `useQuery`, an
accessible MapCN map for the current status filter, and a read-only sheet
for details. Use route-level pending and error components; empty copy belongs to the selected
filter; retry calls the TanStack Router error reset so the loader/query is attempted again.

**Rationale**: This follows the proven customer consultation seam and TanStack Query cache model.
Pending UI prevents a false empty collection, distinct status copy makes successful zero-data
responses unambiguous, and a route error component can recover from transport/server failures. The
marker layer and keyboard-accessible controls prevent the map from becoming inaccessible when the basemap is degraded.

**Alternatives considered**:

- Copy customer components into a cross-feature generic reference framework: rejected because it
  would couple business slices and over-generalize before repeated dock-specific needs exist.
- Render an empty marker layer while fetching: rejected because it violates FR-012.
- Browser refresh as the only retry: rejected because FR-013 requires an explicit retry action.

## Search and status controls

**Decision**: Place a responsive search input and adjacent filter button in an absolute upper-left
overlay within the map. The filter button opens a radio-style menu with All, Available, and
Archived; All is the default. Apply status first and hide excluded docks from the map.
Then perform case- and diacritic-insensitive substring matching on dock names. Matching
markers receive a non-color-only emphasis; nonmatches remain visible but muted. A zero-match search
keeps that context and shows a result message with a clear-search action. Search does not trigger
viewport fitting or a network request.

**Rationale**: Status is a real dataset constraint, whereas search is an orientation aid. Keeping
nonmatches visible preserves the geographic relationship between the requested dock and its peers
and avoids a visually blank map. A dedicated no-match message prevents the muted state from being
confused with empty data. Radio semantics expose the filter as one mutually exclusive choice, and
URL ownership makes the view restorable.

**Alternatives considered**:

- Hide nonmatching docks during search: rejected because it removes spatial context and makes a
  zero-match search indistinguishable from an empty filter unless additional state is inferred.
- Highlight matches without muting nonmatches: rejected because dense marker sets would not make
  the result sufficiently discoverable.
- Search every dock field: rejected because the requested user cue is the dock name and coordinates
  or lifecycle text would produce surprising matches.
- Use a command/autocomplete palette: deferred because all known docks are already present in the
  map; a standard search input is simpler and does not imply a selection-only workflow.
- Keep filter/search component-local: rejected because refresh and back/forward must restore them.

## Map rendering and basemap boundary

**Decision**: Install MapCN's `map` registry item through the repository's existing shadcn CLI,
which vendors the customizable component into `apps/web/src/components/ui/map.tsx` and adds its
`maplibre-gl` dependency and Tailwind integration. Compose `Map`, `MapMarker`, `MarkerContent`, and
`MarkerTooltip` behind a checkpoint-owned `CheckpointMap` adapter. Resource-specific adapters map
dock DTOs, and later weighing-area DTOs, into a shared presentation contract. Plot only checkpoints
admitted by the active status filter, fit the initial viewport to their coordinates, render a
kind-specific glyph inside each marker, and route activation through the typed checkpoint selection.

Override MapCN's default CARTO styles with deployment-approved MapLibre styles configured through
`VITE_MAP_STYLE_LIGHT_URL` and `VITE_MAP_STYLE_DARK_URL`. The configured styles own their source
attribution. Missing, invalid, or unavailable styles render the non-blocking unavailable-map state.

**Rationale**: MapCN follows the shadcn copy-into-the-repository model already used by the web app,
matches its Tailwind styling, supports theme-aware MapLibre styles, and provides the marker and
tooltip composition required here. The checkpoint adapter contains browser/WebGL rendering and
keeps page behavior testable in jsdom without loading a live map style. Explicit deployment styles avoid
silently relying on MapCN's default CARTO basemaps, whose terms differ by usage.

**Alternatives considered**:

- Direct MapLibre GL primitives: rejected because MapCN already provides repository-owned,
  theme-aware shadcn-compatible composition over the same engine.
- React Leaflet/Leaflet: rejected in favor of the user's selected MapCN convention and its closer
  fit with the existing shadcn component workflow.
- A hand-drawn coordinate canvas: rejected because it would not provide a recognizable geographic
  map or established pan/zoom interaction.
- Keep MapCN's default CARTO styles implicitly: rejected because the basemap license and service
  terms must be an explicit deployment decision.
- Replace the map with a table: rejected because the approved Checkpoints experience is a full-area
  map; overlapping points and basemap failure are handled by accessible marker fallback behavior.

## Detail presentation

**Decision**: Render name, latitude, longitude, status badge, created/updated times, and only the
archive/reactivation dates and comments that are non-null. Mark archived docks as unavailable for
new operational use. Use existing date formatting and design-system sheet/detail primitives or a
dock-owned equivalent where the current helper is business-feature-local.

**Rationale**: This directly maps FR-008 through FR-010, avoids invented placeholders for absent
lifecycle facts, and keeps the feature read-only ahead of issues #198–#201.

**Alternatives considered**:

- Show lifecycle actor IDs: rejected because the spec does not require internal identifiers and
  the DTO does not expose resolved user labels.
- Reverse geocoding and coordinate editing: rejected as outside the selected scope.

## Verification strategy

**Decision**: Add/organize API regression tests for complete-list authorization, ordering, and DTO
fields and removal of the detail route, then implement web behavior test-first with Vitest,
Testing Library, and MSW. Cover the default All filter, Available/Archived filtering parity across
map, URL restoration, name normalization, match emphasis/nonmatch muting, zero-match clear,
selection invalidation on status change, map marker projection, tooltip on hover/focus,
pointer/keyboard marker activation, overlapping-coordinate fallback,
lifecycle omissions, stale URL selection, pending state, collection failure/retry, and basemap-style
failure degradation. Run the affected browser journey plus repository-wide checks before review.

**Rationale**: These are public behaviors and boundary guarantees rather than component internals,
which satisfies the constitution's RED–GREEN–REFACTOR and verification requirements.

**Alternatives considered**:

- Snapshot-only component tests: rejected because they do not prove interaction, URL state, retry,
  or authorization behavior.
- API tests only: rejected because most new behavior is in the frontend state machine.

## Resolved clarifications

All technical-context questions are resolved.
