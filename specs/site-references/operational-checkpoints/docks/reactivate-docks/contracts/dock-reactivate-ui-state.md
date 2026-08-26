# Contract: Dock Reactivate UI State

> **Superseded in part (2026-08-25)** — the lifecycle UI this contract describes has been unified.
> The component names and the exact confirmation copy below are historical: every site reference now
> renders `ResourceLifecycleActions` / `BulkResourceLifecycleActions`, and every lifecycle string
> comes from `apps/web/src/components/lifecycle/lifecycle-copy.ts`. Archival now reads "…remains
> readable but is no longer available for new operations", and lifecycle buttons carry the action
> alone (`Archive`, not `Archive dock`). The behavioral requirements in the sibling `spec.md` still
> hold; only their rendering moved.


**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

This contract describes how the reactivation direction is surfaced on `/checkpoints`. It extends
[#200's `dock-archive-ui-state.md`](../../archive-docks/contracts/dock-archive-ui-state.md) rather
than replacing it: the archive behavior documented there stays exactly as it is, and everything
below is the delta.

## Finding archived docks

The `status` search param already offers `available` (default), `archived`, and `all`, and archived
dock markers already render with their dashed outline and archive badge. No new filtering,
searching, or listing affordance is added — spec FR-020 is satisfied by the existing status filter,
which is the same route the administrator already uses to consult archived docks (#197).

## Individual reactivation — `DockLifecycleActions`

Today the component is archive-only and `dock-details.tsx` renders its footer only for
`AVAILABLE` docks, so an archived dock's sheet has no action. After this slice:

| Dock status | Footer content (administrator) | Footer content (non-administrator) |
|---|---|---|
| `AVAILABLE` | `Edit dock` + `Archive dock` (unchanged) | none (unchanged) |
| `ARCHIVED` | `Reactivate dock` only — **no** `Edit dock` | none |

`Edit dock` stays hidden for archived docks: updating one is refused server-side
(`E_DOCK_ARCHIVED`, `ArchivedDockReadOnlyException`), and #199 owns that rule.

The archived branch mirrors `customers/ui/lifecycle-actions.tsx`:

| Element | `AVAILABLE` (existing) | `ARCHIVED` (new) |
|---|---|---|
| Trigger button | `Archive dock`, `variant="destructive"` | `Reactivate dock`, `variant="default"` |
| Dialog title | `Archive dock?` | `Reactivate dock?` |
| Dialog description | "…remain readable but no longer selectable for new discharges." | "This dock will become selectable for new discharges again." |
| Comment field | optional, ≤1000 chars | optional, ≤1000 chars (same field, same description) |
| Confirm button | `Archive` | `Reactivate` |
| Success toast | `Dock archived` | `Dock reactivated` |
| Failure toast | `Unable to archive dock` + parsed API message | `Unable to reactivate dock` + parsed API message |

On success the dialog closes, the comment resets, and `docks.list` is invalidated. The status filter
is **not** rewritten (research D6): under `status=archived` the reactivated dock leaves the
presented collection and the page's existing selection effect closes the sheet; under `all` or
`available` the sheet stays open and re-renders as Available.

## Multiple reactivation — the same select mode, now intent-scoped

### Search param

Unchanged: `selecting=docks`, admin-only, cleared on `create`/`edit` entry, reset when left. **No
new param is introduced.**

### State (in `checkpoints-page.tsx`)

| State | Type | Notes |
|---|---|---|
| `checkedDockIds` | `Set<string>` | existing; unchanged in shape |
| `selectionIntent` | `'ARCHIVE' \| 'REACTIVATE' \| undefined` | **new**, derived (not stored): the status of any checked dock, since the set is homogeneous by construction; `undefined` when nothing is checked |
| `checkableDockIds` | `Set<string>` | **new**, derived and passed to `CheckpointMap`: every visible dock when `selectionIntent` is `undefined`; otherwise every visible dock whose status matches the intent |

### Marker interaction while `selecting === 'docks'`

| Gesture | Target | Behavior |
|---|---|---|
| Click | dock in `checkableDockIds` | toggles it in `checkedDockIds` (unchanged, now status-agnostic) |
| Click | dock **not** in `checkableDockIds` | no-op; the marker is not rendered as checkable (`checked` prop undefined) and opens nothing |
| Click | weighing area | opens the details sheet (unchanged) |
| Shift-click | any dock, any mode | enters select mode with that dock checked, fixing the intent from its status (was: available docks only) |
| Ctrl/Cmd+A | — | checks every **visible** dock matching the current intent; with an empty selection the intent falls back to the status filter (`archived` → archived docks, otherwise available docks) |

Unchecking the last dock clears the intent, making every dock checkable again. Changing the search,
status, or kind filter clears the selection (existing behavior), and therefore the intent with it.

### `BulkDockLifecycleActions` (renamed from `BulkArchiveDocksActions`)

Takes a new `intent: 'ARCHIVE' | 'REACTIVATE'` prop — the direct counterpart of
`bulk-lifecycle-actions.tsx`'s `isArchived`. The toolbar chrome, selection count, clear button,
comment field, and blocked-reason rendering are unchanged.

| Element | `ARCHIVE` (existing) | `REACTIVATE` (new) |
|---|---|---|
| Toolbar `aria-label` | `Bulk dock actions` | `Bulk dock actions` (unchanged) |
| Action button | `Archive selected`, `variant="destructive"` | `Reactivate selected`, `variant="default"` |
| Dialog title | `Archive selected docks?` | `Reactivate selected docks?` |
| Dialog description | "…remain readable but no longer selectable for new discharges." | "These docks will become selectable for new discharges again." |
| Confirm button | `Archive` | `Reactivate` |
| Mutation | `docks.archiveMany` | `docks.reactivateMany` |
| Success toast (no blockers) | `N docks archived` | `N docks reactivated` |
| Success toast (with blockers) | `N docks archived; M unchanged` + per-dock reasons | `N docks reactivated; M unchanged` + per-dock reasons |
| Failure toast | `Unable to archive docks` | `Unable to reactivate docks` |

Blocked docks are described as `name ?? id: <reason label>` using the existing
`BLOCKER_REASON_LABELS` map, which already carries `already available` and `not found`.

### After a successful bulk reactivation

- `docks.list` is invalidated, so the map re-renders from the server's truth.
- The **whole selection is cleared**, blocked docks included (research D7): neither
  `ALREADY_AVAILABLE` nor `NOT_FOUND` becomes eligible on a retry, unlike archiving's `IN_USE`,
  which the existing `handleBulkArchiveSuccess` deliberately keeps checked.
- The status filter is not rewritten, as for the individual path.

### Interaction with view/edit

Unchanged: entering select mode clears `checkpoint`, `create`, and `edit`; entering create or edit
clears `selecting`; create actions are hidden while selecting.

## What this contract does not do

- No new route, no new search param, no new map control, no second select mode.
- No change to the `checkpoint=<kind>:<id>` single-selection contract, to `checkpoint-search.ts`, or
  to the resource-agnostic `resource-map-*` primitives.
- No mixed-status selection, and therefore no client-side splitting of one selection into two
  requests.
- No reactivation affordance for weighing areas or any other checkpoint kind.
