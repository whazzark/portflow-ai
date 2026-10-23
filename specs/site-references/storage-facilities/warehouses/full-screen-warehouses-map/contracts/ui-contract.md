# UI Contract: `/warehouses`

The only external interface this feature touches is the `/warehouses` route. Its HTTP contract
with the API is unchanged.

## URL search params (unchanged, all preserved)

| Param | Values | Role in V2 |
|---|---|---|
| `status` | `available` (default) · `archived` · `all` | status pills (see data-model) |
| `search` | string | toolbar search text |
| `warehouseId` | id | selected warehouse → anchored card |
| `doorStatus` | `available` · `archived` | door pills in the card |
| `doorId` | id | highlighted door |
| `create` | `warehouse` · `door` | draw mode · door placement |
| `edit` | `warehouse` · `door` | outline editing · door move |
| `selecting` | `warehouses` | bulk selection (administrators) |

Existing gating rules stay: a mode or selection param a user is not entitled to resolves to
nothing.

## Accessible landmarks and names (feature-test seams)

| Element | Role | Accessible name |
|---|---|---|
| Map region | `region` | `Warehouses locations` (existing) |
| Map canvas | — | `Warehouses map` |
| Warehouse outline/label | `button` | `View warehouse <name> (Available)` · `View warehouse <name> (Archived)` — existing names kept |
| Door marker | `button` | `View warehouse door <name> (<status>)` — existing name kept |
| Search input | `combobox` (`ResourceMapSearch`) | `Search warehouses` |
| Results popup | `listbox` | `Search results`, groups `Warehouses`, `Doors` |
| Search hint | text | `Enter opens the highlighted result. Archived results appear when Archived is on.` |
| No-match panel | `status` | text `No warehouse or door matches “<text>”` |
| Status filter | `group` | `Filter by warehouse status`; pills `button[aria-pressed]` `Available, <n> warehouses` / `Archived, <n> warehouses` |
| Create | `button` | `Create warehouse` (administrators) |
| Legend | `region` | `Warehouse legend`, types Warehouse, Door; statuses Available, Archived |
| Map controls | `button` | `Zoom in`, `Zoom out`, `Fit all warehouses` |
| Detail card | `complementary` (non-modal `aside`) | the warehouse name |
| Card close | `button` | `Close` |
| Centre copy | `button` | `Copy centre coordinates` |
| Door filter | `group` | `Door status` |
| Door actions | `button` | `Actions for <door>` → menu `Edit`, `Show on map`, `Copy coordinates`, `Archive` / `Reactivate` |
| Mode banner | `status` | banner text (data-model), with `Cancel` button |
| Mode card | `complementary` (non-modal `aside`) | `New warehouse` · `Edit warehouse` · `New door` · `Edit door` |
| Archive dialog | `alertdialog` | `Archive <name>?` |
| Archive toast | `status` | `<name> archived`, action `View` |

Implementation note: the marker names the V2 boards' `aria-label`s suggest (`<name>, warehouse`) were
not adopted; the existing names are kept so the feature-test seam across ~50 suites is unchanged.

## Keyboard

- Typing in the search field opens the results; ↑/↓ move, Enter opens the active result, Escape
  closes the popup without clearing the text.
- Escape with the card open closes it and returns focus to the warehouse on the map.
- Escape in a mode cancels the mode.
- Existing bulk-selection shortcuts are unchanged.
