# UI State Contract: Warehouse Door Archival

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **API**: [warehouse-doors-archive.openapi.yaml](./warehouse-doors-archive.openapi.yaml)

Defines the observable state of `/warehouses` while doors are archived, one at a time or several at
once. This is the contract the web tests assert against.

## URL contract

The route `/_authenticated/warehouses` gains **no new search param and no new value**. Existing
params (`status`, `search`, `warehouseId`, `doorId`, `doorStatus`, `create`, `edit`, `selecting`)
keep exactly the meaning they had, `selecting` included: it still holds `'warehouses'` or nothing.

Checking doors is **offered, never entered**, so there is no mode for a URL to carry. Opening an
available warehouse's Available doors as an administrator is the whole gesture: the checkboxes are
already there. What a URL would have to restore is therefore not a mode but a *queue of ids*, which
is transient by nature — it names records the collection may no longer hold by the time the link is
opened — so the checked set lives in component state and is not deep-linkable.

**Checking doors is offered** iff all of: the user is an administrator, a warehouse matching
`warehouseId` is found and is `AVAILABLE`, the door view is `available` (`doorStatus` absent and
defaulting to it counts), and no creation or update mode is armed (`create` and `edit` absent). Any
other combination — a missing permission, a missing or unknown id, an archived warehouse, the
Archived door view, a concurrent mode — renders **ordinary consultation**: no checkboxes, no
selection row, markers that select rather than check (FR-002, FR-027, FR-040).

Being offered costs the administrator nothing on its own. In particular the warehouse polygons stay
selectable while no door is checked; what a checked door suppresses is described under
"Map behaviour" below.

**Transitions**

| From | Action | To |
|---|---|---|
| Consultation, available warehouse selected, administrator | Check a door row, a door marker, or `Select all` | The id joins the checked set; the selection row gains `N selected`, `Archive selected`, and `Clear selection` |
| Checked doors | `Clear selection` in the selection row, or unchecking the last row | Checked set emptied; nothing else changes — there was no mode to leave |
| Checked doors | Switch to the Archived door view, and back | Checked set emptied for good — nothing is selectable there in this slice, and returning must not resurrect a queue the administrator watched disappear (FR-040, US4 §9) |
| Checked doors | Select another warehouse, or deselect the current one | Checked set emptied: a door of another warehouse can never enter the set, and reopening the same warehouse starts from empty (FR-040) |
| Checked doors | Activate `Create door` or a door/warehouse `Edit` | Checked set emptied before the session opens, and **cancelling that session does not bring it back** (FR-041) |
| Checked doors | Activate `Select warehouses` | The warehouse mode clears `warehouseId` as it already does, which empties the checked set with the panel |
| Checked doors | A door of the set leaves the Available list — archived from its own row menu, or by another administrator between two refetches | That id is dropped from the checked set: `Archive selected` never submits a door the view does not list (FR-040) |
| Checked doors | Successful bulk archival | Checked set narrowed to the ids blocked `IN_USE`, so they can be retried without reselecting (FR-039, research R9) |
| Checked doors | Refused or failed bulk archival | Unchanged — the whole selection and the typed comment are preserved (FR-025) |
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
| Doors checked | Rendered as above; the two gestures coexist without one shadowing the other. Archiving through the menu drops that door from the checked set with the row it removes |

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

### Several doors — the panel selection row

There is no control to press first: the affordances below are present whenever checking is offered.

| Element | Behaviour |
|---|---|
| `Select all` | A checkbox above the list, `aria-checked="mixed"` when the selection is partial, scoped to the available doors currently listed — the `truck-list.tsx` header |
| Row checkbox | On every available door row, `aria-label="Select door <name>"` |
| Door marker | Mirrors the row: ring plus `aria-pressed`, `aria-label="Select door <name>"` / `Deselect door <name>`, and a click both checks the door and highlights it — one target, both gestures (research R7) |
| Selection row | Beside `Select all`, and only once at least one door is checked: `N selected`, `Archive selected`, and a `Clear selection` button. The shared toolbar's trio, word for word (FR-039, FR-042) — its home differs because this selection lives in the panel, not on the map |
| `N selected` | Counts the whole checked set, not the rows on screen, so it always agrees with what `Archive selected` submits |
| Bulk confirmation | `BulkResourceLifecycleDialog` with `singular='door'`, `plural='doors'`, `idPrefix='warehouse-door'`, `action='archive'`. Title `Archive doors`; canonical sentence `N doors remain readable but are no longer available for new operations.`; one optional comment for the whole submission |
| Keyboard | Unchanged: select-all and clear stay bound to the **warehouses** on the map. Doors get no binding of their own — two meanings for one keystroke on one page is worse than none, and `Select all` is the door equivalent, as it is in the trucks and customers directories (research R8) |

The dialog is used rather than `BulkResourceLifecycleActions` because that component *is* the
floating map toolbar; the panel supplies the count, the trigger, and the clear itself, and hands the
dialog the same props the toolbar would have.

### Outcome reporting

The shared dialog's own reporting, unchanged (research R9):

| Outcome | Feedback |
|---|---|
| All archived | `toast.success` — `N doors archived` |
| Partial | `toast.warning` — `N doors archived; M doors unchanged`, described as `<name>: <reason>, …` |
| None archived | `toast.error` — `M doors unchanged`, same description |
| Request refused (401/403/422) | `toast.error` titled `Unable to archive doors`, dialog stays open, selection and comment intact |

Blocker reasons use the **default** labels — `used by an active or planned discharge`,
`not found`, `already archived` — because a door is blocked by itself, unlike a warehouse, which had
to override the first one. One label is *added* rather than overridden: `WAREHOUSE_ARCHIVED` reads
`its warehouse is archived`, the bulk counterpart of the single path's refusal of the same name.
Only a crafted submission reaches it, since the cascade leaves no available door under an archived
warehouse — the same reason the single path guards it.

## Map behaviour

| Condition | Door markers | Warehouse polygons |
|---|---|---|
| Consultation, non-administrator or archived view | Click selects the door (highlight) | Click selects the warehouse |
| Checking offered, nothing checked | Click checks the door **and** highlights it | Click selects the warehouse — unchanged. Checking is offered on every open available warehouse, so suppressing here would leave an administrator unable to switch warehouse at all |
| At least one door checked | As above; checked markers ring; archived doors are not listed and not rendered checkable | Click is suppressed, so a stray click cannot move the warehouse out from under a selection in progress |
| Door creation / update armed | Unchanged from #213/#214 — checking is not offered at the same time | Unchanged |

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
