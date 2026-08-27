# UI State Contract: Warehouse Door Archival

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **API**: [warehouse-doors-archive.openapi.yaml](./warehouse-doors-archive.openapi.yaml)

Defines the observable state of `/warehouses` while doors are archived, one at a time or several at
once. This is the contract the web tests assert against. It adds the **fourth map mode** on that
route, and the second one scoped to the selected warehouse rather than to the page.

## URL contract

The route `/_authenticated/warehouses` widens one existing search param.

| Param | Values | Meaning |
|---|---|---|
| `selecting` | `'warehouses'` \| `'doors'` \| absent | Which select mode is active. One param holding one value is what makes the two mutually exclusive by shape rather than by effect (FR-041). Deep-linkable. |

Existing params (`status`, `search`, `warehouseId`, `doorId`, `doorStatus`, `create`, `edit`) keep
their meaning. Door selection additionally **requires** `warehouseId` to name a warehouse present in
the collection and `AVAILABLE`, and `doorStatus` to be `available` (or absent and defaulting to it).

**Door selection is active** iff all of: `selecting === 'doors'`, the user is an administrator, a
warehouse matching `warehouseId` is found and is `AVAILABLE`, and no creation or update mode is armed
(`create` and `edit` absent). Any other combination — a missing permission, a missing or unknown id,
an archived warehouse, the Archived door view, a concurrent mode — renders **ordinary consultation**:
no checkboxes, no bulk bar, markers that select rather than check (FR-002, FR-027, FR-040).

Unlike `selecting='warehouses'`, which clears `warehouseId` when it is entered, `selecting='doors'`
**keeps the warehouse selected**: the Doors panel is the surface it acts on (research R7).

**Transitions**

| From | Action | To |
|---|---|---|
| Consultation, available warehouse selected, administrator | `Select doors` in the Doors panel header | `selecting='doors'`, `warehouseId` and `doorStatus='available'` kept, `doorId` cleared |
| Door selection | `Select doors` again, or `Clear selection` in the bar, or `Escape` | Checked set emptied; the mode ends on the control, stays on the clear (mirrors the warehouse mode) |
| Door selection | Switch to the Archived door view | Checked set emptied — nothing is selectable there in this slice (FR-040, US4 §9) |
| Door selection | Select another warehouse, or deselect the current one | Checked set emptied and `selecting` cleared: a door of another warehouse can never enter the set |
| Door selection | Activate `Create door` or a door/warehouse `Edit` | Checked set emptied and `selecting` cleared before the session opens (FR-041) |
| Door selection | Activate `Select warehouses` | `selecting='doors'` is replaced by `'warehouses'`, which clears `warehouseId` as it already does |
| Door selection | Successful bulk archival | Checked set narrowed to the ids blocked `IN_USE`; the mode stays on so they can be retried (FR-039, research R9) |
| Door selection | Refused or failed bulk archival | Unchanged — the whole selection and the typed comment are preserved (FR-025) |
| Consultation | Successful single archival | Nothing forced: the door leaves the Available view, the existing effect clears `doorId`, the warehouse stays selected (research R11) |

The Doors panel has no search, so no search-versus-selection rule exists here — unlike warehouses,
where a selected record hidden by a search term stays selected.

## Entry points

### One door — the row action menu

Every door row hosts `ResourceRowActions`, delivered empty by #214. This slice fills it.

| Condition | Row menu |
|---|---|
| Administrator, warehouse `AVAILABLE`, door `AVAILABLE` | Rendered, containing `Edit` then `Archive` (destructive) |
| Administrator, door `ARCHIVED` | **Not rendered at all** — no edit, no lifecycle action yet (#216 fills this) |
| Administrator, warehouse `ARCHIVED` | **Not rendered** — every door under it is archived |
| Non-administrator | **Not rendered** (FR-002) |
| Door selection active | Rendered as above; the two gestures coexist without one shadowing the other |

`Archive` opens `ResourceLifecycleDialog` — the same confirmation a dock, a truck, or a warehouse
opens:

| Element | Content |
|---|---|
| Title | `Archive door` |
| Effect sentence | `“<door name>” remains readable but is no longer available for new operations.` — the canonical wording, with **no** appended clause: a door cascades onto nothing (research R9) |
| Comment | `Comment (optional)`, `maxLength=1000`, described as `Keep a short explanation for the lifecycle change (maximum 1,000 characters).` |
| Actions | `Cancel` / `Archive` — `Archiving…` while pending |
| On success | Dialog closes, toast `Door archived`, warehouse collection invalidated |
| On refusal | **Dialog stays open with the typed comment intact**; the refusal is shown as a toast naming the door, and the collection is refreshed so the view stops being stale (FR-024, FR-026) |

### Several doors — the panel select mode

| Element | Behaviour |
|---|---|
| `Select doors` | A control in the Doors panel header, beside `Create door`. Rendered only for an administrator on an available warehouse. Pressed state while the mode is on; label `Stop selecting doors` then |
| `Select all` | A checkbox above the list, `aria-checked="mixed"` when the selection is partial, scoped to the available doors currently listed — the `truck-list.tsx` header |
| Row checkbox | On every available door row, `aria-label="Select door <name>"` |
| Door marker | Mirrors the row: ring plus `aria-pressed`, `aria-label="Select door <name>"` / `Deselect door <name>`, and a click toggles the check instead of highlighting the door (research R7) |
| Bulk bar | `BulkResourceLifecycleActions` with `singular='door'`, `plural='doors'`, `idPrefix='warehouse-door'`, `action='archive'`. Appears once at least one door is checked: `N selected`, `Archive selected`, `Clear selection` |
| Bulk confirmation | Title `Archive doors`; canonical sentence `N doors remain readable but are no longer available for new operations.`; one optional comment for the whole submission |
| Keyboard | While the mode is on, select-all and clear are bound to **doors**, and the warehouse bindings are disabled (research R8) |

### Outcome reporting

The shared bar's own reporting, with no overrides (research R9):

| Outcome | Feedback |
|---|---|
| All archived | `toast.success` — `N doors archived` |
| Partial | `toast.warning` — `N doors archived; M doors unchanged`, described as `<name>: <reason>, …` |
| None archived | `toast.error` — `M doors unchanged`, same description |
| Request refused (401/403/422) | `toast.error` titled `Unable to archive doors`, dialog stays open, selection and comment intact |

Blocker reasons use the **default** labels — `used by an active or planned discharge`,
`not found`, `already archived` — because a door is blocked by itself, unlike a warehouse, which had
to override the first one.

## Map behaviour

| Condition | Door markers | Warehouse polygons |
|---|---|---|
| Consultation | Click selects the door (highlight) | Click selects the warehouse |
| Door selection active | Click toggles the check; checked markers ring; archived doors are not listed and not rendered checkable | Click is suppressed while the mode is on, so a stray click cannot switch warehouse mid-selection |
| Door creation / update armed | Unchanged from #213/#214 — the door select mode cannot be active at the same time | Unchanged |

Marker offsets, tooltips, hover behaviour, and the archived marker styling are #212's and are not
modified.

## After a successful archival

| Surface | Expectation |
|---|---|
| Available door view | The archived door is gone; the count decreases |
| Archived door view | The door is there, its row reading `Archived on its own · <date> · <comment>` — the provenance line #210 delivered, now reachable in its second variant |
| Map | The marker restyles to archived in place; the position is unchanged |
| Warehouse | Unchanged — same status, same lifecycle context, even when its last available door was archived (FR-015) |
| Refresh | All of the above without a manual reload: the mutations invalidate `warehouseQueries.list()`, which embeds the doors (FR-026) |
