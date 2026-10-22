# Research: Full-Screen Warehouses Map

Phase 0 of [plan.md](./plan.md). Every decision below was taken against the current
`apps/web` code (`features/warehouses`, `features/warehouse-doors`, `components/resource-map`,
`components/lifecycle`) and the 13 V2 *Retenue* boards of the design reference.

## R1 — No API change

**Decision**: The feature is web-only. The `warehouses.index` read already returns every
warehouse with its `doors`, footprint points, statuses, lifecycle context, `createdAt`, and
`updatedAt`; door search, door summaries, and the centre are derived client-side.

**Rationale**: The spec is presentation-only (FR-022). Everything the V2 boards display is either
in the list DTO or derivable from it.

**Alternatives considered**: A server-side search endpoint across doors — rejected: the whole
site's warehouses and doors are already loaded for the map, and search is name-only.

## R2 — Detail card: the shared anchored `ResourceMapCard` replaces the `Sheet`

**Decision**: Adopt the primitive #320 plans (its D1/D2) rather than a second one: a generic
`ResourceMapCard` (`components/resource-map/resource-map-card.tsx`) rendered by the workspace
outside the map canvas, placed by the pure helper `resource-map-anchor.ts` (beside the anchor, flip
side, clamp to the map area, bottom dock below `md`, fixed top-right fallback with no anchor). For
warehouses the anchor is a **rectangle**, not a point: `WarehouseMap` reports, through
`onAnchorChange`, the screen-projected bounds of the selected outline (or of the outline being
drawn/edited, or of the door pin being placed/moved), recomputed on the map's `move`/`resize`
events with `map.project()`. The helper therefore accepts a rect (a point is a zero-size rect), so
the card sits beside the whole outline and never covers it (spec edge case).

Semantics follow #320's D2: the card is a non-modal labelled region (`aside` labelled by its
heading) with Close, Escape to close, focus to the heading on open and back to the warehouse on
the map (or the toolbar) on close. Archive and Reactivate keep the modal `AlertDialog`. Existing
warehouse feature tests that scope with `getByRole('dialog')` for the sheet migrate to
`getByRole('region', { name })`, story by story, never deleted without an equivalent.

**Rationale**: V2 places one card beside the outline (FR-005); one primitive across both maps
keeps them consistent and avoids a merge conflict between #320 and #321. Selection already fits
the map on the warehouse (`FitWarehouseBounds`), so the outline is on screen when the card opens.

**Alternatives considered**: MapLibre `MapPopup` — content lives inside the map canvas (invisible
to feature tests), cannot clamp to the viewport, and hosts forms in a MapLibre node. A non-modal
`dialog` role — announces a dialog without trapping focus. Keeping the `Sheet` — contradicts the
retained design.

**Deviation recorded**: `apps/web/AGENTS.md` says "A detail panel is a `Sheet` at `size="lg"`".
Maps become the explicit exception; the plan updates `apps/web/AGENTS.md` (see R9).

## R3 — Status filter pills over the existing `status` param

**Decision**: Replace the filter dropdown + "Showing" badge with two toggle pills, `Available` and
`Archived`, each with its count, inside the floating toolbar. They read and write the existing
`status` search param: Available only → `available`, Archived only → `archived`, both → `all`.
The last pressed pill is disabled, so both can never be off. Pills are `aria-pressed` toggle
buttons inside a group labelled `Filter by warehouse status`, built with the toggle group of the
shared `ResourceMapToolbar` shell (#320 D3). The card's door filter (`doorStatus`) reuses the same
toggle styling but stays single-valued (Available or Archived), as today.

**Rationale**: No URL change, so every link in circulation keeps working (FR-025), and the mapping
is total. Aligns with the cumulative pills #320 retains for Checkpoints.

**Alternatives considered**: A new multi-value param — rejected: needs a `transform` migration for
no behavioral gain.

## R4 — Grouped search across warehouses and doors

**Decision**: The toolbar search uses the shared `ResourceMapSearch` that #320 builds on
`@base-ui/react/autocomplete` (its D4), extended additively to accept **grouped** options
(`Warehouses`, `Doors`, each with a count heading) and a hint footer. The popup is labelled
`Search results`. Options are fed by a pure function
`searchWarehousesAndDoors(warehouses, statusFilter, text)` returning
`{ warehouses: WarehouseResult[], doors: DoorResult[] }`. It reuses `normalizeResourceSearch`
(case- and diacritic-insensitive) and searches only resources in the selected statuses (a door is
searched when its own status and its warehouse's status are both selected). Arrow keys move the
active option (`aria-activedescendant`), Enter or click opens it, Escape closes the popup. Opening
a warehouse result navigates `{ warehouseId }`; a door result navigates `{ warehouseId, doorId,
doorStatus: <door's status> }`. The map keeps emphasising matching warehouses as today (unlike
Checkpoints, whose spec hides non-matches — #320 D5 — `presentResources` keeps `isSearchMatch`).

The no-match state is a status panel under the toolbar (`No warehouse or door matches “…”`) with
`Clear search` and, when `status` is `available`, `Include archived` (sets `status=all`).

**Rationale**: FR-008–FR-011. Search text already lives in the URL; only the highlighted option is
transient.

**Alternatives considered**: Keep the single-list emphasis-only search — rejected: cannot surface
doors (US2).

## R5 — Mode banner and card for draw, outline editing, placement, and move

**Decision**: The four existing modes stay driven by the existing URL params (`create=warehouse`,
`create=door`, `edit=warehouse`, `edit=door`) and their existing session hooks. While one is
active, the toolbar is replaced by a `ResourceMapModeBanner` (`role="status"`, instruction text,
`Cancel`), and the card hosts the existing create/edit panels, restyled and reworded to the V2
copy. Escape cancels the mode. Search, filter, and warehouse selection are not rendered while a
mode is active (mode exclusivity edge case).

Outline editing gains a true **Undo** (step back one change) on top of the existing
restore-outline: `use-warehouse-edit-session` keeps a bounded history stack of draft point arrays
(push on move/insert/remove, pop on undo, cleared on save/cancel), and derives the
`<n> boundary points · <m> moved` counter by comparing the draft to the origin points.

**Rationale**: FR-012–FR-017 reuse the drawing, handle, and placement layers already built
(`PendingPolygonPlacement`, `EditablePolygonPlacement`, `useResourceMapPlacement`); only the chrome
and the undo history are new.

**Alternatives considered**: New URL params for the modes — rejected: the existing kind-valued
`create`/`edit` params are the documented deliberate exception that keeps modes exclusive.

## R6 — Centre coordinates

**Decision**: A pure `footprintCentre(points)` in `features/warehouses/geometry/` returns the
area-weighted polygon centroid (falling back to the vertex mean for a degenerate polygon), shown
to 4 decimals as in the design (`46.1557, -1.2270`).

**Rationale**: CONTEXT.md: the warehouse's display centre is derived from its polygon, not stored.

**Alternatives considered**: Bounds centre — rejected: misleading for L-shaped footprints.

## R7 — Lifecycle dialog and toast copy

**Decision**: Use the same additive members #320 adds to `ResourceLifecycleConfig` (its D8):
`describeTitle(action)` (warehouse: `Archive <name>?` / `Reactivate <name>?`) and
`successAction(action, result)` returning a `{ label, onClick }` toast action (`View`), plus one
more optional member owned by this feature, `describeSuccessDetail(action, result)`, for the toast
description (`Its <n> doors are archived with it. Find it under Archived to reactivate it.`); the
toast title comes from the existing `describeSuccess` (`<name> archived`). Resources that do not
opt in are unchanged. The
optional comment field stays (spec assumption). `View` navigates `{ status: 'all', warehouseId }`.

The archive effect sentence becomes the V2 one: `The warehouse and its <n> available doors can no
longer be selected for new discharges. Past discharges keep them. You can reactivate it later from
Archived.` (with singular/zero variants). The IN_USE refusal keeps the existing toast path.

**Rationale**: FR-019–FR-021 without forking the shared dialog that every resource uses; sibling
V2 issues (#318, #319, #320) can opt in the same way.

**Alternatives considered**: A warehouse-specific dialog — rejected: duplicates refusal handling.

## R8 — Door actions menu

**Decision**: Extend `ResourceRowActions` additively with optional `items` — non-lifecycle menu
entries rendered for everyone above `Edit` and the lifecycle entries. Doors pass `Show on map`
(select the door, fly to its point) and `Copy coordinates`. A row with only `items` still renders
its trigger, so non-administrators get the menu (US5 scenario 5). A shared
`copyText(text, label)` helper in `src/helpers/` writes to the clipboard and toasts success or the
failure (edge case "Clipboard unavailable"), and is reused by the card's centre copy.

**Rationale**: Keeps the "absent, not disabled" rule for management entries while adding
read-only conveniences.

## R9 — Shared map chrome lives in `components/resource-map`, warehouses adopt it first

**Decision**: Use the file names and APIs #320's plan already fixed, so the two branches converge
instead of colliding: `resource-map-card.tsx` (`ResourceMapCard`), `resource-map-anchor.ts`,
`resource-map-toolbar.tsx` (`ResourceMapToolbar` shell + toggle group), `resource-map-search.tsx`
(`ResourceMapSearch`), `resource-map-mode-banner.tsx` (`ResourceMapModeBanner`),
`resource-map-no-match.tsx` (`ResourceMapNoMatch`), and workspace slots (toolbar | banner, card,
no-match). This feature's additions to them are additive and optional: rect anchors (R2), grouped
search options (R4), and `describeSuccessDetail` (R7).

Whichever of #320/#321 merges second rebases onto the first and adopts its primitives, keeping
only its additive extensions; if #321 starts implementing before #320 merges, it creates these
files to #320's planned API. `ResourceMapControls` and `ResourceMapCreateControl` are deleted by
the branch that removes their last consumer. Both plans update the same `apps/web/AGENTS.md` map
rules (anchored card instead of `Sheet`, toggle pills instead of the filter dropdown); the second
branch reconciles the wording.

**Rationale**: Same chrome on both maps; avoids two parallel copies of the same primitives.
Coordination note left in the shared notes folder.

## R10 — Verification seams

**Decision**:
- Unit tests (no React): `searchWarehousesAndDoors`, status-pill ↔ `status` mapping,
  `footprintCentre`, door summary copy, edit-history undo and moved-count reducer, archive copy.
- Feature tests (real router + MSW, existing `__tests__/support`): one per user story, updated
  from `Sheet` to card where needed; existing lifecycle, bulk, conflict, and permission tests keep
  passing (SC-004).
- Accessibility: there is no automated a11y tool in `apps/web` (ADR 0001 keeps it out of scope).
  SC-005 is met by feature-test assertions on roles, accessible names, `aria-pressed`,
  `aria-activedescendant`, and focus return, plus a manual keyboard/contrast pass in both themes.
  **Flagged at plan review**: adding an axe-based check would be a separate decision.
- Browser: there is no Playwright suite yet; the affected journeys are run manually against the
  dev server (quickstart) in dark and light themes and at phone width.
