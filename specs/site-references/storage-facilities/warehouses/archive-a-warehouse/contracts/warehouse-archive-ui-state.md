# Contract: Warehouse Archive UI State

**Feature**: [../spec.md](../spec.md) | **Research**: [../research.md](../research.md)

Everything below lives in the `/warehouses` map workspace introduced by `#207`. No new route, no new
destination (spec Assumptions).

## Route search params (`routes/_authenticated/warehouses.tsx`)

| Param | Existing | Change |
|---|---|---|
| `status` | `'all' \| 'available' \| 'archived'`, default `'available'` | — |
| `search` | string, default `''` | — |
| `warehouseId` | optional | — |
| `doorId`, `doorStatus` | optional | — |
| **`selecting`** | — | **NEW**: `z.enum(['warehouses']).optional().catch(undefined)` |

`selecting` mirrors the Checkpoints `selecting=docks|weighing-areas` param. It is honoured only for
administrators; for anyone else it resolves to no select mode, and no bulk affordance renders
(FR-044).

Entering select mode clears `warehouseId`/`doorId`, as Checkpoints' `startSelecting` clears
`checkpoint`/`create`/`edit` — a details sheet and a bulk selection never coexist.

## Page state (`warehouses-page.tsx`)

| State | Rule |
|---|---|
| `checkedIds: Set<string>` | component state, not a search param — same as Checkpoints |
| cleared when | `selecting` becomes undefined |
| eligible ids | `status === 'AVAILABLE'` **and** the user is an administrator (FR-043) |
| status/filter change | ids not listed in the new scope are dropped (FR-043, US4 scenario 9) |
| search term | **never** prunes the selection — it narrows what is displayed, not what was chosen (FR-043) |
| id vanishes from the collection | dropped, so a failed refetch cannot strand a selection |

## Map affordances

| Affordance | Source | Warehouse form |
|---|---|---|
| Select-mode control | `checkpoint-map.tsx` `ControlButton` + `SquareDashedMousePointer` | "Select warehouses" / "Stop selecting warehouses" in `WarehouseMap`'s `MapControls` |
| Checkable feature | `CheckpointMarker`'s `checked` prop | the per-warehouse focus-marker button gains `aria-pressed`, a `Select/Deselect warehouse {name}` label, and `data-checked` |
| Checked emphasis | — | a `checked` case in the polygon `fill-opacity` / `line-width` paint, so the polygon shows selection too |
| Shift-click | `handleShiftSelect` | shift-clicking a polygon enters select mode and checks that warehouse |
| Ctrl/Cmd+A | `useSelectAllShortcut` (**D7**) | checks every visible available warehouse; ignored while a text field has focus |
| Escape | `useClearSelectionShortcut` (**D7**) | clears the checked set without leaving select mode; inert while nothing is checked |

**Required change to delivered code**: `WarehousePolygonLayer` currently skips the focus marker of
the selected warehouse (`if (warehouse.id === selectedId) return null`). In select mode every marker
must render, or a previously-opened warehouse becomes uncheckable (research **D6**).

## Confirmation dialogs

Both state that the warehouse remains readable but is no longer selectable for new operational work,
**and how many of its available doors are archived with it** (FR-023). Both offer an optional comment
(`maxLength={1000}`, "Maximum 1,000 characters"). Both are abandonable, leaving everything unchanged
(FR-024).

| | Single | Bulk |
|---|---|---|
| Component | `warehouse-lifecycle-actions.tsx` (new) | `BulkResourceLifecycleActions` (extracted, **D5**) |
| Trigger | button in `WarehouseDetails` | "Archive selected" in the bulk action bar |
| Door count | `warehouse.doors.filter(d => d.status === 'AVAILABLE').length` | summed across checked warehouses |
| On refusal | dialog **stays open** so the typed comment survives and can be corrected (FR-025, US3 scenario 6) | same |

The door count is advisory: the authoritative set is assessed at submission time (research **D9**), so
the wording must describe what will be archived without promising an exact number.

## Outcome reporting

Reuses the extracted action bar's `sonner` toasts and `BLOCKER_REASON_LABELS`:

| Outcome | Toast |
|---|---|
| all archived | `"3 warehouses archived"` |
| partial | `"2 warehouses archived; 1 unchanged"` + a description naming each blocked warehouse and its reason (FR-036) |
| all blocked | `"0 warehouses archived; 3 unchanged"` + every reason (US4 scenario 6) |
| request failed | error toast carrying `parseApiError(cause).message`, selection preserved for retry |

`IN_USE` renders as a warehouse-specific label naming the door cause, not the checkpoint wording
(research **D4**).

**Retry without reselecting** (FR-042): on a partial outcome the page narrows `checkedIds` to the
blocked ids rather than clearing it, so "Archive selected" retries exactly those — the behavior
`__tests__/bulk-archive/resubmission.test.tsx` already asserts for docks.

## Post-archival refresh

The success handler invalidates `warehouseQueries.list()`. Because the list embeds doors, one
invalidation refreshes the warehouse's status, its archive context, and every cascaded door's status
in a single round trip — the map, the counts, and the doors panel all update without a manual reload
(FR-029).

## Non-administrators

No select-mode control, no checkable markers, no bulk bar, no archive button, and `selecting` in the
URL has no effect (FR-030, FR-044). Server-side authorization stays authoritative; none of this is a
substitute for it.
