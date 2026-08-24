# Contract: Dock Archive UI State

**Feature**: [../spec.md](../spec.md) | **Status**: Entirely new — no dock archive UI exists today.

## Individual archive — `DockLifecycleActions`

Self-contained component, mirroring `customers/ui/lifecycle-actions.tsx` minus the reactivate
branch (research D6). Rendered by `dock-details.tsx` in the sheet footer, only when
`dock.status === 'AVAILABLE'` and the viewer can administer docks (same `canEdit` gate already used
for the "Edit dock" action).

**Props**: `{ dock: DockDto }` — no external state; owns its own dialog-open, comment, and
submitting state, exactly like the Customer version.

**State machine**:

```
closed --[click "Archive dock"]--> dialog open
dialog open --[cancel]--> closed
dialog open --[confirm]--> submitting
submitting --[docks.archive 200]--> closed, toast "Dock archived", dockQueries.list() invalidated
submitting --[docks.archive 4xx/5xx]--> dialog open, error surfaced via parseApiError, dialog stays open with the comment preserved
```

No other page state depends on this component: once `dockQueries.list()` is invalidated, the
already-selected dock's `status` flows back through `checkpoints-page.tsx`'s existing
`selectedDock`/`selectedResource` derivation, `DockDetails` re-renders as Archived, and the
"Archive dock" action disappears on its own — no new wiring is needed in `checkpoints-page.tsx` for
this half of the feature (contrast with the multi-select mode below, which does need page-level
wiring).

## Multiple archive — select mode + `BulkArchiveDocksActions`

### Entry point

A new admin-only toggle in `CheckpointMapControls` ("Select docks"), visible only when the `DOCK`
layer is visible (`layerVisibility.DOCK`). Activating it calls
`navigate({ search: (previous) => ({ ...previous, selecting: 'docks' }) })`.

### Search param

`checkpoints.tsx` route schema gains:

```ts
selecting: z.enum(['docks']).optional().catch(undefined)
```

Parallel to `create` and `edit`, not nested inside either. `selecting=docks` and `create=…` /
`edit=dock` are mutually exclusive in practice (entering one clears the checked-ids state and the
other mode's param), mirroring how `create` and `edit` already treat each other as mutually
exclusive (plan.md Summary, "creation wins" comment in `checkpoints-page.tsx`).

### State

`checkpoints-page.tsx` owns:

```ts
const [checkedDockIds, setCheckedDockIds] = useState<Set<string>>(new Set())
const [blockedDocks, setBlockedDocks] = useState<BulkDockLifecycleBlocker[]>([])
```

Same shape as `customers-page.tsx`'s `selectedCustomerIds`/`blockedCustomers`. Both reset whenever
`selecting` leaves `'docks'`, whenever the search/status filter changes (a dock scrolled out of view
should not silently stay armed for archiving — mirrors `updateSearch`/`updateStatus` clearing
selection in `customers-page.tsx`), and whenever a create or edit session starts.

### Marker interaction while `selecting === 'docks'`

- `CheckpointMap` receives `selectMode: 'docks'`, `checkedIds: Set<string>`,
  `onToggleChecked: (id: string) => void` (all optional, `undefined` when not selecting).
- For each `DOCK` checkpoint, `CheckpointMarker` receives `checked={checkedIds.has(checkpoint.id)}`
  and its click handler calls `onToggleChecked(checkpoint.id)` instead of `onSelect(checkpoint)`.
- `WEIGHING_AREA` markers are unaffected: `onSelect` still opens the details sheet for them, exactly
  as today. (A weighing area cannot be part of a dock archive selection — it is a different site
  reference kind entirely, so this is not a limitation, just scope.)
- Archived dock markers remain visible (per the existing `status` filter) but are not offered as
  checkable: only `status === 'AVAILABLE'` dock checkpoints receive `checked`/toggle behavior,
  matching the eligibility rule. An archived dock's marker keeps its ordinary "View" behavior even
  while selecting, so an administrator can still open it to see why it is not eligible, rather than
  presenting a checkbox that would silently do nothing.
- The details sheet does not open for an *available* dock click while selecting — that click toggles
  the checkbox instead. An archived dock click still opens its details, since it was never offered
  as checkable in the first place. Editing an available dock stays reachable by leaving select mode
  first.

### `BulkArchiveDocksActions`

Rendered by `checkpoints-page.tsx` alongside the map, visible only when `selecting === 'docks'` and
`canManageCheckpoints`. Archive-only counterpart of `bulk-lifecycle-actions.tsx` (research D6): no
`isArchived` branch, single action "Archive selected".

**Props**: `{ blockedDocks: BulkDockLifecycleBlocker[]; checkedIds: string[]; onClear: () => void;
onSuccess: (result: BulkDockLifecycleResult) => void }`.

**State machine** (identical shape to `BulkLifecycleActions`):

```
hidden --[checkedIds becomes non-empty]--> visible, showing "{n} selected" + "Archive selected"
visible --[click "Archive selected"]--> dialog open (optional shared comment)
dialog open --[cancel]--> visible
dialog open --[confirm]--> submitting
submitting --[docks.archive_many 200, blockedDocks empty]--> hidden, toast "{n} docks archived", checkedIds cleared
submitting --[docks.archive_many 200, blockedDocks non-empty]--> visible, toast "{archived} docks archived; {blocked} unchanged",
    checkedIds reset to exactly the IN_USE-blocked ids (so the administrator can watch usage clear and retry — mirrors customers-page.tsx's onSuccess)
    blockedDocks shown inline with each dock's name + reason, "Retry blocked docks" reopens the dialog
submitting --[docks.archive_many 4xx/5xx]--> dialog open, error surfaced, checkedIds and comment preserved
```

On success, `dockQueries.list()` is invalidated by the `archiveMany` mutation's own `onSuccess`
(same pattern as `archive`/`update`), so archived markers update to the Archived style without a
manual reload (spec FR-014).

### Interaction with view/edit

Entering select mode while a dock is selected for viewing or being edited exits that mode first
(clears `checkpoint`/`edit`, same "one mode at a time" rule creation already enforces against
editing). Starting create or edit while select mode is active exits select mode and clears
`checkedDockIds` — an abandoned selection is discarded, never silently carried into an unrelated
flow, matching the existing `setPendingPlacement(null)` discard-on-switch behavior.

## What this contract does not do

- No selection persists across a page reload or across leaving `/checkpoints` — `checkedDockIds` is
  component state, not a search param, deliberately: unlike `checkpoint`/`edit` (which identify a
  single resource worth deep-linking to), an in-progress bulk selection is a working set, not a
  destination, matching why `customers-page.tsx`'s `selectedCustomerIds` is also local state, not a
  search param.
- No keyboard multi-select (shift-click range, ctrl-click) beyond per-marker toggle — out of scope;
  the spec's SC-008 target (five to ten docks in under 60 seconds) does not require it.
