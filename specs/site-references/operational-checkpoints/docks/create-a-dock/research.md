# Research: Create a Dock

## Future extension: Create a Weighing Area (#203)

This is deliberately a **documentation-only** note, not a build-ahead of #203 — Constitution
Principle II (one independently deliverable feature per spec) keeps weighing-area creation out of
this issue. It exists so whoever picks up #203 has a concrete, verified starting point instead of
reverse-engineering one from #198's diff.

**#203 is a near-mechanical mirror of #198**, confirmed by reading the actual backend code:
- `apps/api/app/weighing_areas/create/create_weighing_area_use_case.ts` and
  `apps/api/app/weighing_areas/shared/weighing_area_validator.ts`'s `createWeighingAreaValidator`
  are structurally identical to the dock versions — same `{name, latitude, longitude}` shape, same
  trim/range rules, same case-insensitive duplicate-name exception
  (`DuplicateWeighingAreaNameException`). `POST /api/v1/weighing-areas` already exists and is
  already tested, exactly like docks were before #198 — so #203 will almost certainly be
  frontend-only too.
- Issue #202 ("List Weighing Areas", #203's blocker) is already closed/done — #203 is unblocked and
  ready to be picked up whenever prioritized.

**Already reusable with zero changes** (built resource-agnostic in #198, on purpose):
`useResourceMapPlacement`/`PendingPlacementMarker` (`apps/web/src/components/resource-map/resource-map-placement.tsx`),
`ResourceMapCreateControl` (`apps/web/src/components/resource-map/resource-map-create-control.tsx`
— its 2-action dropdown branch is already implemented *and tested*, just never fed a second real
action), `MapControls`'s `children` slot, `CheckpointSheet`'s `mode`/`createPanel` composition, and
(as of this note) `CheckpointMapPlacement`'s `label`/`icon` fields — the pending-marker visual is no
longer hardcoded to dock's "New dock"/`AnchorIcon`, so a weighing-area placement session supplies
its own.

**What #203 still needs to build**, in order:
1. `use-weighing-area-mutations.ts`, `weighing-area-form.tsx`, `create-weighing-area-panel.tsx` —
   mirror `use-dock-mutations.ts`/`dock-form.tsx`/`create-dock-panel.tsx`; the field shape is
   identical (verified above), so this should be close to a rename exercise.
2. Add `'weighing-area'` to the `create` search-param enum in
   `apps/web/src/routes/_authenticated/checkpoints.tsx` (currently `z.enum(['dock'])`).
3. Generalize `checkpoints-page.tsx`'s dock-only creation state bundle (`isCreatingDock`,
   `pendingDockPlacement`, `startCreatingDock`, `cancelCreatingDock`, `createDock`,
   `handleDockCreated`, `createPanel`) into a kind-parametric model once there are two real callers
   to justify it — e.g. an `activeCreation: { kind: CheckpointKind; pending: LatLng | null } | null`
   plus a small per-kind config (mutation hook, form panel, label, icon). This was intentionally
   **not** built in #198, since until #203 exists it would be exercised by nothing but dock —
   indistinguishable from unused speculative code.
4. Append a second entry to the `createActions` array passed to `CheckpointMap` —
   `ResourceMapCreateControl` renders this as a dropdown menu automatically.
5. Pass weighing-area's own `label`/`icon` through `CheckpointMapPlacement` for its placement
   session.

## Decision: Entry point lives in a resource-agnostic control beside the map's zoom buttons, not the top toolbar

**Decision**: The "New dock" trigger was relocated from the top-left `CheckpointMapControls`
toolbar into the map's bottom-right control cluster, alongside newly-added zoom in/out buttons
(`apps/web/src/components/ui/map.tsx`'s `MapControls`, given a new optional `children` slot for
this purpose). The button itself is a new shared component,
`ResourceMapCreateControl` (`apps/web/src/components/resource-map/resource-map-create-control.tsx`),
which takes a `{key, label, onSelect}[]` list: one action renders a single icon button, two or more
render a dropdown menu — so a future second creatable resource kind (e.g. weighing area) is a
one-line addition to the list passed from `checkpoints-page.tsx`, not a rewrite.

**Rationale**: The original top-left placement visually collided with the search/filter toolbar
(reported directly against a live screenshot). Moving it to the bottom-right, where zoom controls
were about to be added anyway, both fixes the collision and groups map-level actions (navigate,
create) together rather than mixing a mutation action into the search/filter/status toolbar. The
`{key,label,onSelect}[]` shape (rather than a single dock-specific prop) was chosen explicitly so
the same mechanism serves weighing-area creation later without restructuring — while intentionally
*not* wiring a second entry today (weighing-area creation has no spec yet); the multi-action
dropdown branch is covered by a dedicated unit test
(`apps/web/src/components/resource-map/__tests__/resource-map-create-control.test.tsx`) precisely
so it isn't unexercised dead code in the meantime.

**Implementation note**: this codebase's `DropdownMenuItem` wraps `@base-ui/react/menu`, whose
item-selection prop is `onClick`, not Radix's `onSelect` — and the low-level `ControlButton` (now
exported from `map.tsx` for the single-action case) has a fixed prop signature with no ref
forwarding, so it cannot serve as a `DropdownMenuTrigger`'s `render` target; the multi-action
trigger reuses the plain `Button` component instead (already proven compatible with
`DropdownMenuTrigger`'s `render` prop elsewhere in `resource-map-controls.tsx`).

## Decision: `CheckpointSheet` takes an explicit `mode` prop, matching `CustomerSheet`'s convention

**Decision**: `CheckpointSheet` (which already received an opaque `createPanel?: ReactNode` from a
prior refactor) now also takes `mode?: 'view' | 'create'`, explicitly driving the same branching
that was previously implicit in `Boolean(createPanel)`. This mirrors the `mode?: 'create' | 'edit' |
'view'` convention `CustomerSheet` already uses elsewhere in this app.

**Rationale**: motivated by a future "move an existing dock" capability (issue #199, no spec yet):
when that lands, the natural extension is a third `mode === 'edit'` arm plus an `editPanel` slot,
added without disturbing the `'create'` arm. This plan deliberately stops at renaming/explicitating
the existing `'view'`/`'create'` branching — it does **not** add an `'edit'` mode, an `editPanel`
prop, or speculative `dock?`/`onUpdate` props on `dock-form.tsx` (mirroring `CustomerForm`'s
create/update dual-purpose shape), since #199 has no spec yet to build against; adding that
scaffolding now would be unused code. The underlying click/drag-to-place mechanism
(`useResourceMapPlacement`/`PendingPlacementMarker`) already supports being seeded from an existing
resource's coordinates instead of starting at `null` — confirmed via a repo-wide search that no
"drag an existing resource" pattern exists anywhere yet to conflict with or duplicate — so no
change was needed there for this future capability to slot in later.

## Decision: Backend requires no new work

**Decision**: Ship this feature without touching `apps/api`. The `POST /api/v1/docks` endpoint
(`DocksController#store`), its authorization (`DockPolicy#create`, ORGANIZATION_ADMIN /
OPERATIONS_ADMIN only), its validator (`createDockValidator`: non-blank trimmed name ≤255 chars,
latitude -90..90, longitude -180..180), its use case (`CreateDockUseCase`, which normalizes the
name and always creates with `AVAILABLE` status), and its uniqueness rule (case-insensitive across
all statuses via `CREATE UNIQUE INDEX docks_name_unique ON docks (LOWER(name))`) already exist and
are already covered by passing tests (`apps/api/tests/integration/docks.spec.ts`,
`apps/api/tests/unit/docks/{dock_use_cases,dock_policy}.spec.ts`). The endpoint accepts any
double-precision latitude/longitude, so full-precision map-click coordinates need no rounding or
special handling before submission.

**Rationale**: Every functional requirement in `spec.md` maps to already-implemented,
already-tested backend behavior; map-click placement only changes how the client determines the
`latitude`/`longitude` values it sends, not the request/response contract itself. Re-implementing
or re-testing the backend would duplicate existing coverage and contradict Constitution Principle
VI (no duplicated canonical decisions).

**Alternatives considered**: Re-verify with a fresh backend test pass regardless — rejected as
redundant; the existing integration test titled "creates and exposes a normalized dock" and the
unit test "enforces normalized uniqueness across available and archived docks" already exercise
exactly the scenarios in spec.md's User Story 1 and User Story 2.

## Decision: Map click is the primary way to set location; synced coordinate fields are the accessible fallback

**Decision**: While dock creation is active, clicking anywhere on the `CheckpointMap` drops a
pending, draggable placement marker at that point (or moves an existing pending marker there). The
creation sheet's latitude/longitude fields are two-way synced with that marker: dragging the marker
updates the fields, and editing the fields moves the marker. Both paths funnel into the same pending
coordinate state, which is what gets submitted.

**Rationale**: The user's explicit direction is to create a dock's location primarily by placing it
on the map, matching how the map-centric `/checkpoints` consultation experience (#197) already
works. A pointer-only interaction, however, would be unusable without a mouse/touch input and would
violate the established accessibility conventions this repo already commits to (spec.md
Assumptions). Keeping the coordinate fields as a synced fallback satisfies both: map-click stays the
primary, expected path, while keyboard-only users retain a fully equivalent way to place and adjust
the pending location.

**Alternatives considered**: Map-click only, no coordinate fields — rejected, not keyboard
accessible and provides no way to enter a precise, pre-known coordinate. Coordinate fields only (the
originally planned design before this revision) — superseded per explicit user direction; kept only
as the fallback/precision path, not the primary one.

**Implementation refinement (discovered while building)**: the coordinate fields are rendered
**always**, not gated behind an existing Pending Dock Placement as `data-model.md`/the UI contract
originally specified. A keyboard-only administrator has no way to produce a first placement at all
without a pointer — there is no keyboard equivalent of "click the map" — so if the fields only
appeared after a placement already existed, keyboard-only creation would be impossible, contradicting
this very decision's stated goal. With both fields always present, typing valid values into both
establishes the Pending Dock Placement for the first time, exactly as a map click does. `data-model.md`
and `contracts/dock-creation-ui-state.md` were updated to match this corrected behavior.

**Implementation refinement (non-modal sheet)**: making the map clickable while the create sheet is
open required the `Sheet` to render **non-modal** (`modal={false}`) and **without its full-screen
overlay** (`showOverlay={false}`) while creating — a modal sheet's default focus-trap/`inert`
background and full-viewport overlay both block the underlying map from receiving clicks at all.
This also required `disablePointerDismissal` on the sheet while creating, since a non-modal dialog's
default behavior is to close on any "outside" press — which every map click is. The net effect: the
create sheet can only be dismissed via Escape or its close button, not by clicking the map (clicking
the map places a marker instead) — a deliberate, necessary difference from the read-only detail
sheet's normal overlay-click-to-close behavior. Discovered via a failing web test
(`checkpoints/__tests__/create/placement.test.tsx`) before being fixed, per the RED→GREEN cycle.

## Decision: Build the placement mechanism as a shared, resource-agnostic primitive in `components/resource-map/`, not dock-specific code

**Decision**: Implement map-click placement and the draggable pending marker as a new shared
primitive — a hook (e.g. `useResourceMapPlacement`) plus a `<PendingPlacementMarker>` component —
alongside the existing shared map building blocks in `apps/web/src/components/resource-map/`
(`resource-map-workspace.tsx`, `resource-map-controls.tsx`, `resource-map-search.ts`,
`resource-map-types.ts`, `resource-marker-offset.ts`). It is built on the existing `useMap()` /
`MapMarker` primitives from `apps/web/src/components/ui/map.tsx` (`draggable`, `onDragEnd`, and a
`map.on('click', handler)` binding scoped to when placement is armed) — no new mapping library or
dependency is needed. `CheckpointMap` consumes this hook for dock placement; it does not own
click/drag/pending-marker logic itself.

**Rationale**: The user confirmed this same click-to-place principle will be reused for creating a
weighing area, a warehouse, and a warehouse door — all of which already share the `resource-map/*`
building blocks (`WarehouseMap`, `CheckpointMap`, and the still-to-be-built warehouse-door map all
sit on the same `ResourceMapWorkspace`/`Map` foundation). Writing the placement logic directly
inside `features/docks` or `features/checkpoints` would mean re-deriving the same click/drag/sync
mechanism from scratch in each future creation issue (#199+ for docks aside, and the analogous
issues under the weighing-areas, warehouses, and warehouse-doors roadmaps), duplicating a canonical
decision in violation of Constitution Principle VI. Placing it beside the other `resource-map/*`
primitives — which are already shared across exactly those features — makes it available to them
without rework.

**Scope note**: Only the generic mechanism is built and exercised by this issue, for docks. Wiring
it into weighing-area, warehouse, or warehouse-door creation is explicitly out of scope here (spec
FR-016) and remains for their own future issues to deliver end-to-end, per Constitution Principle
II (one independently deliverable feature per spec).

**Alternatives considered**: Build it dock-specific inside `features/docks`/`features/checkpoints`
now and extract it to `resource-map/` later when the second consumer arrives — rejected; the reuse
is already known and explicit, so building it in place the first time avoids a guaranteed near-term
refactor and keeps the dock feature's own code limited to dock-specific concerns (name field,
duplicate-name handling, dock mutation). A separate, custom click-catching overlay div positioned
over the map canvas instead of MapLibre's native events — rejected, unnecessary when `useMap()`/
`MapMarker` already expose click and drag natively.

## Decision: Reuse the customers feature's Sheet + TanStack Form + tuyau mutation pattern for the surrounding form

**Decision**: Structure the non-map parts of dock creation the same way
`apps/web/src/features/customers` already structures customer creation: a `use-dock-mutations.ts`
hook wrapping `tuyauQuery.docks.store.mutationOptions()` with query invalidation, a `dock-form.tsx`
built on `useAppForm` with a Zod schema and `applyValidationError` for server-side field errors, and
a `create-dock-panel.tsx` rendered inside the existing `Sheet`. The form's name field and the two
(synced) coordinate fields all live in this sheet; the map click/drag interaction lives in
`CheckpointMap` and reports the pending coordinate up to the page, which feeds both the sheet and
the pending-marker rendering.

**Rationale**: This is the only established creation pattern in the codebase and keeps the new UI
consistent with existing conventions, accessibility behavior, and error handling (toast for generic
failures, inline field errors for validation failures), even though the coordinate portion of the
form is now primarily driven by the map rather than typed first.

**Alternatives considered**: An inline `MapPopup` anchored to the pending marker instead of the
side `Sheet` — rejected; the checkpoints page already uses the `Sheet` for every other
dock/weighing-area interaction (`CheckpointSheet`), and a popup would be a second, inconsistent
surface plus harder to keep accessible (focus management, keyboard dismissal) than the existing
Sheet primitive.

## Decision: Represent "create" as an independent search param, not a `checkpoint=` selection

**Decision**: Add a new, independent boolean-ish search param (e.g. `create=dock`) to the
`/checkpoints` route's search schema, separate from the existing `checkpoint=<kind>:<id>` selection
param. `CheckpointSheet` opens in create mode when `create=dock` is present, and the map enters
placement mode (click-to-place armed) for the same duration.

**Rationale**: The `checkpoint=<kind>:<id>` contract (established by #197, FR-027 of
`list-docks/spec.md`) is explicitly typed to identify an *existing* resource by kind and id.
Overloading it with a synthetic "new" id would stretch that contract's meaning and complicate
`parseCheckpointSelection`/`serializeCheckpointSelection`, which assume a real, selectable
resource. A separate param keeps both contracts simple, independently restorable through
navigation, and avoids introducing a fake Checkpoint identity. It also gives the map an unambiguous
signal for when to arm click-to-place versus normal marker-selection behavior.

**Alternatives considered**: Encode creation as `checkpoint=dock:new` — rejected, breaks the typed
selection contract and would require special-casing `new` throughout `checkpoint-selection.ts` and
downstream lookups. A route-level modal outside the search-param system — rejected, since it would
not be restorable via URL/back-navigation like every other checkpoints-page state, and would not
naturally coordinate with the map's placement-mode toggle.

## Decision: While placement mode is active, existing marker selection is suspended

**Decision**: When `create=dock` is present, clicking anywhere on the map (including on top of an
existing dock/weighing-area marker) places or moves the pending marker rather than opening that
marker's detail sheet. Existing markers stay visible (for spatial context) but are not clickable
while creation is active.

**Rationale**: The map cannot serve two conflicting click behaviors at once (select-existing vs.
place-new) without ambiguity. Placement is a short-lived, explicit mode the administrator opted
into, so suspending unrelated marker interaction for its duration is the same trade-off the
consultation feature already makes for its own status-filter/search overlays (context said to
remain visible but not to compete for the primary interaction).

**Alternatives considered**: Allow existing-marker clicks to still open detail view during
placement — rejected, ambiguous (would the click place a marker on top of the existing one, or
open its detail?) and likely to produce accidental placements right next to a dock the
administrator meant to inspect instead.

## Decision: Entry point lives in `CheckpointMapControls`, gated by `isAdministrator`

**Decision**: Add a "New dock" action to `CheckpointMapControls` (the existing top-left overlay
that already hosts search, status filter, and layer-visibility controls), visible only when
`isAdministrator(user)` is true — reusing the exact permission helper already used by the
customers and trucks features (`@/features/auth/policies/permissions`), which matches
`DockPolicy#create`'s ORGANIZATION_ADMIN / OPERATIONS_ADMIN rule. Activating it sets `create=dock`
and shows a brief placement hint (e.g. "Click the map to place the new dock") until the first click
lands.

**Rationale**: `ResourceMapWorkspace` has no other toolbar/action slot, and `CheckpointMapControls`
is already the map's single overlay for user-initiated actions. Reusing `isAdministrator` avoids
inventing new client-side permission logic and keeps the frontend gate aligned with the backend
policy the server already enforces authoritatively. The placement hint gives the administrator an
explicit cue that the map is now in a different interaction mode, addressing the edge case of an
administrator who activates creation but doesn't immediately understand it changed the map's click
behavior.

**Alternatives considered**: A page-level button outside the map overlay — rejected, since the
checkpoints page has no page header/toolbar by design (list-docks FR-026: the map fills the
available page area without a separate page title or list).

## Decision: Map the duplicate-name conflict to an inline `name` field error, not a generic toast

**Decision**: `dock-form.tsx` first tries the existing `applyValidationError(form, error)` helper
(handles HTTP 422 `E_VALIDATION_ERROR`, i.e. blank name / out-of-range coordinates). If that
returns `false` **and** the parsed error code is `E_DOCK_NAME_CONFLICT` (HTTP 409), set the `name`
field's error directly via the same `form.setErrorMap` mechanism instead of falling through to the
generic `toast.error` path used by `customer-form.tsx`.

**Rationale**: `applyValidationError` only recognizes `E_VALIDATION_ERROR` (see
`apps/web/src/libraries/forms/api-error.ts`), because `DuplicateDockNameException` is a distinct
409 exception, not a VineJS validation failure. Without this special case, a duplicate name would
surface as a disconnected toast instead of next to the field it concerns, weakening spec User
Story 2's "clear, specific explanation" intent — and unlike the coordinate fields, the pending
marker has nothing to visually flag for a name conflict, so the inline field message is the only
place this feedback can land.

**Alternatives considered**: Reuse the generic toast fallback as-is (the plain customers-feature
pattern) — rejected as a worse UX for a field-identifiable error the form can point to directly;
the extra branch is a small, targeted addition, not a new abstraction.
