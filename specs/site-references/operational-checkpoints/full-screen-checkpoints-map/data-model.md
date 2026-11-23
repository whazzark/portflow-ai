# Data Model: Full-screen Checkpoints map

**Feature**: [spec.md](./spec.md) | **Date**: 2026-10-22

No persisted data, API field or migration changes. The feature consumes the existing dock and
weighing-area DTOs (`docks.index`, `weighing_areas.index`) and mutations unchanged. This document
describes the **view state** the screen derives from them and from the URL.

## Source entities (unchanged)

| Entity | Source | Fields used |
|---|---|---|
| Dock | `DockDto` (`features/docks/types.ts`) | `id`, `name`, `latitude`, `longitude`, `status`, `archivedAt`, `createdAt`, `updatedAt` |
| Weighing area | `WeighingAreaDto` (`features/weighing-areas/types.ts`) | same fields |
| Bulk lifecycle result | `docks.archive_many` / `reactivate_many`, weighing-area equivalents | succeeded ids, blocked entries with reason |

Validation and lifecycle rules (required name, GPS bounds, uniqueness, archive refusal when in use,
reactivation refusals) stay enforced by the API; the UI shows its errors.

## View state

### Checkpoint (adapter output, unchanged)

`Checkpoint` / `PresentedCheckpoint` (`features/checkpoints/types.ts`): `kind` (`DOCK` |
`WEIGHING_AREA`), `id`, `name`, `latitude`, `longitude`, `status` (`AVAILABLE` | `ARCHIVED`),
`isSearchMatch`. Produced by `toDockCheckpoint` / `toWeighingAreaCheckpoint`.

### Filters (URL-backed)

| Toolbar control | URL parameter | Mapping |
|---|---|---|
| Docks + Weighing areas toggles | `kinds` | both on → absent; only docks → `dock`; only weighing areas → `weighing-area` |
| Available + Archived toggles | `status` | both on → `all`; one on → `available` / `archived`; default `available` |
| Search field | `search` | free text, default `''` |

Invariant: at least one toggle per group is on (the last active one is disabled).

Counts shown on toggles:

- Type toggle count = checkpoints of that kind in the selected statuses.
- Status toggle count = checkpoints of that status in the selected kinds.

### Search result

- `matches` = presented checkpoints (kinds + statuses applied) whose normalized name contains the
  normalized search (case- and accent-insensitive, `normalizeResourceSearch`).
- `total` = presented checkpoints before search.
- Map markers = `matches` while search is non-empty, otherwise all presented checkpoints.
- No-match state when search is non-empty and `matches` is empty.

### Screen mode (derived, mutually exclusive)

| Mode | Entered by | URL | Toolbar area shows |
|---|---|---|---|
| `browse` | default | none of the below | floating toolbar |
| `view` | selecting a marker or a suggestion, deep link, toast View | `checkpointId=<kind-prefixed id>` | toolbar + anchored detail card |
| `placing` | Create menu item | `create=dock\|weighing-area` (clears `checkpointId`) | placement banner + creation card once a pin exists |
| `moving` | Edit on an available checkpoint card | `edit=dock\|weighing-area` + `checkpointId` | move banner + edit card + ghost marker at origin |
| `selecting` | Select menu item, shift-click on an eligible marker | `selecting=docks\|weighing-areas` | select banner + floating bulk bar |

Transitions:

- `browse ↔ view`: select / Close, Escape, click on empty map, selected checkpoint filtered out.
- `browse|view → placing → view` (created checkpoint selected) or `→ browse` (Cancel / Escape).
- `view → moving → view` (Save changes or Cancel; Cancel restores the origin) or `→ browse` when the
  checkpoint no longer exists.
- `browse|view → selecting → browse` (Done, or Escape with nothing checked).
- `placing`, `moving` and `selecting` never coexist; only an administrator can enter them (gated in
  the component, authoritative in the API).

### Card anchor

`{ x, y } | null` in map-container pixels for the anchored point: the selected checkpoint in
`view`, the pending pin in `placing`, the draft pin in `moving`. `null` when there is no rendered
map (tests, map unavailable) → card uses its fallback position.

### Edit session (unchanged logic)

`use-checkpoint-edit-session.ts`: `{ kind, id, origin: LatLng }` plus `draft: { name, latitude,
longitude }`. Cancel restores `origin`; Save submits `draft`.

### Bulk selection (unchanged logic)

`checkedIds: Set<string>`, `selectionIntent` derived from the first checked checkpoint's status
(`ARCHIVE` for available, `REACTIVATE` for archived), `checkableIds` derived from kind, status and
intent. After archive, blocked `IN_USE` ids stay checked; after reactivation the selection clears.
