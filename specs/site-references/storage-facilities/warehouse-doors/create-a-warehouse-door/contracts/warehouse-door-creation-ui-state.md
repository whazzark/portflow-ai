# UI State Contract: Warehouse Door Creation Mode

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **API**: [warehouse-doors-create.openapi.yaml](./warehouse-doors-create.openapi.yaml)

Defines the observable state of `/warehouses` while a door is being placed. This is the contract the
web tests assert against. It introduces the **second map mode** on that route, and the first one
scoped to a selected warehouse rather than to the page.

## URL contract

The route `/_authenticated/warehouses` widens one existing search param.

| Param | Values | Meaning |
|---|---|---|
| `create` | `'warehouse'` \| `'door'` \| absent | Which creation mode is active. One value at a time, so the two modes cannot both be armed. Deep-linkable. |

Existing params (`status`, `search`, `warehouseId`, `doorId`, `doorStatus`, `edit`, `selecting`)
keep their meaning. Door creation additionally **requires** `warehouseId` to name a warehouse that is
present in the collection and `AVAILABLE`.

**Door creation is active** iff all of: `create === 'door'`, the user is an administrator, a
warehouse matching `warehouseId` is found, and its status is `AVAILABLE`. Any other combination —
including a missing permission, a missing `warehouseId`, an unknown id, or an archived warehouse —
renders **ordinary consultation**: no panel, no armed map, no pending marker (FR-006, FR-007).

**Transitions**

| From | Action | To |
|---|---|---|
| Warehouse selected, available, administrator | Activate "Create door" | `create='door'`, `doorId` cleared, `warehouseId` kept |
| Door creation | Cancel, or dismiss the sheet | `create` cleared, pending point discarded (FR-021) |
| Door creation | Successful creation | `create` cleared, `doorStatus='available'`, `doorId=<new id>`, `warehouseId` kept (FR-017) |
| Door creation | Rejected or failed submission | Unchanged — name and pending point preserved (FR-018) |
| Door creation | `create` switched to `'warehouse'` | Door mode ends and its pending point is discarded; the two never coexist |

`status` and `search` are deliberately **not** reset on success: the containing warehouse is already
selected and visible, and `search` only annotates matches rather than pruning the collection. This
differs from warehouse creation (#208), where the new warehouse could be hidden by either.

## Entry point

| Condition | "Create door" action |
|---|---|
| Administrator, selected warehouse `AVAILABLE` | Rendered in the Doors panel header |
| Administrator, selected warehouse `ARCHIVED` | **Absent** — not disabled (FR-007) |
| Non-administrator, any warehouse | **Absent** (FR-006) |
| No warehouse selected | **Absent** — the Doors panel is not rendered |

The map's create control keeps its single "Create warehouse" action and gains nothing.

## Map state

| Condition | Map behaviour |
|---|---|
| Mode inactive | Warehouse polygons selectable; door markers selectable |
| Mode active | Cursor is a crosshair; a map click sets the pending point; clicking a polygon or an existing door marker does **not** select it (FR-022) |
| Mode active, no pending point | No pending marker; the selected warehouse stays framed |
| Mode active, pending point set | One draggable pending marker, labelled "New door", visually distinct from persisted door markers and never presented as one (FR-023) |
| Mode active, click again elsewhere | The single pending marker **moves**; a second marker is never created |
| Mode active, pan or zoom | The pending marker stays anchored to its coordinates |
| Mode active | The view stays fitted to the selected warehouse's footprint — unlike polygon drawing, door placement never changes the bounds (research R9) |
| Mode active | The selected warehouse's doors stay rendered, so the administrator can see what is already placed |

## Panel state

Rendered in the existing sheet, replacing the warehouse details and Doors panel while the mode is
active.

| Element | Behaviour |
|---|---|
| Title | "Create door" |
| Description | Names the containing warehouse and directs the administrator to click inside its footprint |
| Name field | Required, trimmed on submit, autofocused; error shown on blur and on submit |
| Latitude / Longitude fields | Always rendered — the accessible path to placement without a pointer. Synced both ways with the pending marker |
| Submit | Disabled while: no pending point, a coordinate field fails to parse or is out of range, or the pending point is outside the footprint. Reads "Creating…" while in flight |
| Cancel | Ends the mode and discards the pending point |
| Containment message | Shown inline when a pending point lies outside the selected warehouse's footprint |

## Feedback

| Outcome | Feedback |
|---|---|
| Success | Toast "Door created"; the warehouse collection refetches; the new door is revealed and selected in the Available view |
| `E_WAREHOUSE_DOOR_NAME_CONFLICT` | Field error on the name; pending point and name kept |
| `E_WAREHOUSE_DOOR_NAME_INVALID` | Field error on the name; pending point and name kept |
| `E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT` | Form-level error; pending point and name kept |
| `E_WAREHOUSE_ARCHIVED` | Form-level error stating the warehouse must be reactivated first; the mode does not silently end |
| `E_WAREHOUSE_NOT_FOUND` | Form-level error; the administrator is returned to consultation |
| `E_VALIDATION_ERROR` | Mapped onto the named field by the shared `applyValidationError` helper |
| Any other failure | Toast "Unable to create door" with the message; pending point and name kept (FR-019) |

## Accessibility

- The pending marker carries an always-visible "New door" label, so it is distinguishable without
  relying on color (FR-023).
- Both coordinate fields are reachable and operable by keyboard alone, and setting both places the
  door without any map interaction.
- Errors are associated with their field through `aria-describedby` / `aria-invalid`, as the shared
  `CoordinateField` and `TextField` already do.
- Focus moves into the panel when the mode opens and returns to the Doors panel when it closes.
