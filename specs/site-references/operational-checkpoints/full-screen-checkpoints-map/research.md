# Research: Full-screen Checkpoints map

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-22

The spec carries no open clarification. This research records the design decisions needed to turn
the current screen (`apps/web/src/features/checkpoints/`) into the retained V2 without changing the
API, and the constraints found while reading the existing code.

## Starting point

- `CheckpointsPage` (`ui/checkpoints-page.tsx`, ~840 lines) already composes a map that fills the
  shell content area (`ResourceMapWorkspace`), filters in a dropdown (`ResourceMapControls`), a
  create control and per-kind "Select docks / weighing areas" toggles in the map's control cluster,
  and a single `CheckpointSheet` that hosts the detail, creation and edit panels.
- The bulk selection bar (`components/lifecycle/bulk-resource-lifecycle-actions.tsx`) is already a
  floating bar at the bottom of the map.
- Feature tests replace `CheckpointMap` with `__tests__/support/mock-checkpoint-map.tsx` (jsdom
  cannot run MapLibre). Anything rendered *inside* `CheckpointMap` is invisible to feature tests.
- URL state already covers every spec need: `search`, `kinds` (`dock | weighing-area | undefined`),
  `status` (`all | available | archived`), `checkpointId`, legacy `checkpoint`, `create`, `edit`,
  `selecting`.
- The V2 shell (#314) keeps the breadcrumb header above the content area; the V2 artboards keep it
  too, so "full screen" means the whole content area under the header, which the workspace already
  fills.
- `apps/web/AGENTS.md` currently prescribes "a detail panel is a `Sheet` at `size="lg"`" and "the
  filter dropdown for a map". The V2 deliberately replaces both on the maps.

## Decisions

### D1 — Anchored cards are rendered by the page, positioned by an anchor the map reports

- **Decision**: Add a generic `ResourceMapCard` overlay under `components/resource-map/`, rendered
  by the workspace *outside* the map canvas. The map component reports the screen position of the
  anchored point (selected checkpoint, pending pin or draft pin) through an `onAnchorChange`
  callback, recomputed on the map's `move`/`resize` events with `map.project()`. The card places
  itself beside the anchor, flips side and clamps to the map area so it is always fully visible
  (FR-016), and below the `md` breakpoint docks to the bottom of the map. With no anchor (mocked map
  in tests, map unavailable) it falls back to a fixed top-right position.
- **Rationale**: Keeps detail, creation and edit cards inside the feature-test seam (the mock map
  never renders them otherwise), keeps focus management and forms in normal React DOM, and gives
  #321 the same primitive for warehouses and doors.
- **Alternatives considered**: `MapPopup`/`MarkerPopup` from `components/ui/map.tsx` (MapLibre
  popups) — anchoring for free, but content lives inside the map canvas, is invisible to feature
  tests, cannot clamp to the viewport, and hosts forms inside a MapLibre DOM node. Keeping the
  `Sheet` — rejected by the spec.

### D2 — Cards are non-modal labelled regions; the archive confirmation stays a modal alert dialog

- **Decision**: A card is an `aside` labelled by its heading (`role="region"` semantics, as in the
  V2 artboard), with a Close button, Escape to close, and focus moved to the heading when it opens
  and back to the marker (or the toolbar) when it closes. Archive and Reactivate keep the shared
  `ResourceLifecycleDialog` (an `AlertDialog`).
- **Rationale**: The map must stay operable while a card is open (pan, select another marker);
  a modal dialog would block it. Destructive confirmations stay modal.
- **Alternatives considered**: Non-modal `Dialog` — announces as a dialog but does not trap focus,
  which misleads assistive technology.

### D3 — The floating toolbar replaces the filter dropdown; URL parameters are unchanged

- **Decision**: New `CheckpointMapToolbar` with: search (D4), a "Checkpoint types" toggle group
  (Docks, Weighing areas), a "Filter by checkpoint status" toggle group (Available, Archived), each
  toggle a `button` with `aria-pressed` and its count, then Select (D7) and Create (D6). Toggles map
  onto the existing parameters: both kinds on ⇔ `kinds` absent; both statuses on ⇔ `status=all`.
  The last active toggle of a group is disabled (FR-006). During placement, move or select mode the
  toolbar is replaced by the mode banner, as in the V2 artboards and as #321 specifies.
- **Rationale**: Zero URL migration (FR-005), existing links keep working, and the toggle model is
  exactly the cumulative Available/Archived pills #321 also adopts.
- **Alternatives considered**: New `types`/`statuses` multi-value parameters — needs a migration and
  legacy rewrite for no gain.

### D4 — Search suggestions use the Base UI Autocomplete primitive

- **Decision**: Build `ResourceMapSearch` (in `components/resource-map/`) on
  `@base-ui/react/autocomplete`, already shipped with the `@base-ui/react` dependency behind
  `components/ui/combobox.tsx`. Options are the matching checkpoints (highlighted match, kind
  label); a non-option footer shows "<n> of <total> <status label> · Enter to zoom to all matches".
  Picking an option selects the checkpoint (sets `checkpointId`); Enter with no highlighted option
  requests a fit to all matches. The search text stays in `search` in the URL. The no-match state
  (FR-011) replaces today's inline "No checkpoints match" line.
- **Rationale**: Accessible combobox semantics (keyboard, `aria-activedescendant`) without a
  hand-rolled listbox; the primitive is already a dependency. `InputSearch` remains the field
  styling so the web guideline "search a collection with `InputSearch`" still holds in spirit.
- **Alternatives considered**: Hand-rolled `role="listbox"` — duplicates keyboard handling;
  `cmdk` — new dependency.

### D5 — Search hides non-matching markers (behavior change from today's dimming)

- **Decision**: `presentCheckpoints` callers pass only matches to the map while a search is active;
  `isSearchMatch` dimming is no longer used by Checkpoints. Counts on the toggles stay computed
  over the type/status filters, not the search, as today.
- **Rationale**: The approved spec requires the map to show only the matching markers (User Story
  1, scenario 4; FR-008). The shared `presentResources` helper keeps `isSearchMatch` for the
  warehouses map until #321 decides.

### D6 — Create moves into the toolbar as a labelled menu

- **Decision**: A "Create" button with a dropdown menu offering "New dock — Berth where trucks are
  loaded" and "New weighing area — Weighbridge where trucks are weighed". The map-cluster
  `ResourceMapCreateControl` is no longer used by Checkpoints; the map-unavailable fallback keeps
  its creation buttons. Choosing an item keeps today's `create=<kind>` URL flow and placement logic
  (`useResourceMapPlacement`, `PendingPlacementMarker`).
- **Rationale**: Matches the V2 menu; reuses the existing, tested placement mechanics.

### D7 — Bulk select mode is entered from a toolbar "Select" menu; the shared bar is reused

- **Decision**: A "Select" menu in the toolbar offers "Select docks" and "Select weighing areas"
  (same accessible names as today's map-cluster toggles, so the existing bulk tests keep their
  queries). Entering select mode shows a mode banner ("Selecting docks · click markers to check
  them", Done) in place of the toolbar; the existing `BulkResourceLifecycleActions` floating bar,
  shift-click entry, keyboard shortcuts, eligibility rules and partial-success handling are kept
  unchanged. The shared bulk bar component is not modified (it is also used by other site
  references and may be restyled by #326).
- **Rationale**: Spec User Story 7 / FR-030–030b: keep the capability, restyled for the V2 map,
  with no regression.

### D8 — Archive confirmation and "View" toast through opt-in hooks on the shared lifecycle config

- **Decision**: Extend `ResourceLifecycleConfig` (in `components/lifecycle/resource-lifecycle-actions.tsx`)
  with two optional, additive members: `describeTitle(action)` (Checkpoints returns
  "Archive <name>?") and `successAction(action, result)` returning a `{ label, onClick }` toast
  action (Checkpoints returns "View" after an archive). Checkpoints supplies `describeEffect` with
  the V2 copy ("The dock can no longer be selected for new discharges. Past discharges keep it. You
  can reactivate it later from Archived."). The optional comment field stays (spec assumption).
  "View" navigates to `status=all` (or keeps `archived`), `checkpointId=<id>`.
- **Rationale**: Other resources keep their copy untouched; the shared dialog keeps one place for
  refusal handling (dialog stays open, refusal toast with the API reason — FR-028).
- **Alternatives considered**: A Checkpoints-specific dialog — duplicates refusal handling.

### D9 — Move mode reuses the edit session; the previous position becomes a ghost marker

- **Decision**: Keep `use-checkpoint-edit-session.ts` (origin + draft) and the `edit=<kind>` URL
  flow. `CheckpointMap` renders a non-interactive "Previous position of <name>" ghost marker at the
  origin while editing. The edit card (D1) shows "Previous position <lat, lng>", the name, latitude
  and longitude fields, Cancel and Save changes. "Back to details" is replaced by Cancel, which
  restores the origin (FR-023).
- **Rationale**: Existing tested logic; only presentation changes.

### D10 — Fit all and fit-to-matches are explicit map requests

- **Decision**: `CheckpointMap` gains a "Fit all checkpoints" control (zoom in/out stay) and a
  `fitRequest` prop (`{ key, ids }`) that the page bumps when Enter is pressed in search. Selection
  still centers on the selected checkpoint through the existing `FitCheckpointBounds` effect.
- **Rationale**: Keeps camera control inside the map component, as today.

### D11 — Theme: nothing new to build

- **Decision**: The map already switches the basemap between `VITE_MAP_STYLE_LIGHT_URL` and
  `VITE_MAP_STYLE_DARK_URL` on the document theme (`useResolvedTheme` in `components/ui/map.tsx`).
  All new overlays use « Marine sobre » tokens only (no hardcoded colors), so they follow the theme.
  Verification is a light-theme pass in the browser and the accessibility checks.

### D12 — Durable guidance is updated in `apps/web/AGENTS.md`, no new ADR

- **Decision**: Update the "Forms and UI" rules: on the maps, a record is shown in a card anchored
  to its map feature (`ResourceMapCard`), and status/type filters are toolbar toggles; directories
  keep `Sheet` and tabs. No ADR: the vertical-slice architecture (ADR 0008) is unchanged.
- **Rationale**: Constitution VI — the guidance is the durable home; leaving the old rule would
  make the next map feature reimplement the sheet.

## Cross-issue coordination

- **#321 Full-screen Warehouses map** (`feat/321-full-screen-warehouses-map`) shares
  `ResourceMapWorkspace`, `ResourceMapControls` and the search helpers. This feature adds new
  shared primitives (`ResourceMapCard`, `ResourceMapSearch`, `ResourceMapToolbar` shell,
  `ResourceMapModeBanner`) without changing the behavior the warehouses page depends on;
  `ResourceMapControls` stays until #321 migrates. Whichever PR merges second rebases onto the
  first and adopts its primitives.
- **#326 Truck pool floating bulk actions** may restyle `BulkResourceLifecycleActions`; this feature
  only consumes it.
- **Deferred**: the V2 "Discharges" section on detail cards (spec Clarifications) needs a follow-up
  issue.
