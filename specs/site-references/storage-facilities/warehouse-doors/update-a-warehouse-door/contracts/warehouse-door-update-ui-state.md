# UI State Contract: Warehouse Door Update Mode

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **API**: [warehouse-doors-update.openapi.yaml](./warehouse-doors-update.openapi.yaml)

Defines the observable state of `/warehouses` while a door is being corrected. This is the contract
the web tests assert against. It introduces the **third map mode** on that route, and the second one
scoped to a selection rather than to the page.

## URL contract

The route `/_authenticated/warehouses` widens one existing search param.

| Param | Values | Meaning |
|---|---|---|
| `edit` | `'warehouse'` \| `'door'` \| absent | Which update mode is active. One value at a time, so the two modes cannot both be armed. Deep-linkable. |

Existing params (`status`, `search`, `warehouseId`, `doorId`, `doorStatus`, `create`, `selecting`)
keep their meaning. Door update additionally **requires** `warehouseId` to name a warehouse present
in the collection and `AVAILABLE`, and `doorId` to name an `AVAILABLE` door of that warehouse.

**Door update is active** iff all of: `edit === 'door'`, `create` is absent, the user is an
administrator, a warehouse matching `warehouseId` is found and is `AVAILABLE`, and a door matching
`doorId` is found under it and is `AVAILABLE`. Any other combination — a missing permission, a
missing or unknown id, an archived door, an archived warehouse, or a concurrent creation mode —
renders **ordinary consultation**: no panel, no draft marker, no suppressed selection (FR-002,
FR-005, FR-015, FR-016).

**Transitions**

| From | Action | To |
|---|---|---|
| Available door selected under an available warehouse, administrator | Activate `Edit` | `edit='door'`, `warehouseId` and `doorId` kept |
| Door update | Cancel, or dismiss the sheet | `edit` cleared, draft discarded, stored door untouched (FR-025) |
| Door update | Successful save | `edit` cleared, `warehouseId`, `doorId`, `doorStatus`, and `search` all kept (research R11) |
| Door update | Rejected or failed submission | Unchanged — entered name and draft position preserved (FR-018, FR-024) |
| Door update | `doorId` or `warehouseId` cleared, or the selection becomes non-editable | `edit` cleared with `replace: true` (research R9) |
| Door update | A creation mode is activated | The session ends without saving; the two never coexist (FR-005b) |
| Door update | The door is reported not found by the API | `edit` and `doorId` cleared with `replace: true`; the administrator lands on a consistent view of the warehouse's remaining doors |

`doorStatus` is deliberately **not** forced: the update is offered only on an available door and
cannot change a door's status, so the Available view the administrator was already in still contains
it. `search` is deliberately **not** reset either — unlike #209, where a rename could dim the
corrected warehouse. `warehouseMatchesSearch` matches *warehouses*, so no door name takes part in the
filter and a door rename can hide nothing (research R11).

## Entry point

Every door row in the Doors panel hosts the shared per-row action menu, `ResourceRowActions`,
rendered as a **sibling** of the row button — the `truck-list.tsx` layout — and gated on the
warehouse-management permission. The trigger is an ellipsis button labelled `Actions for <door name>`.

| Condition | Row menu |
|---|---|
| Administrator, warehouse `AVAILABLE`, door `AVAILABLE` | Rendered, containing `Edit` |
| Administrator, door `ARCHIVED` | **Not rendered at all** — `editable: false` and no lifecycle action yet, so the component returns `null` (FR-015) |
| Administrator, warehouse `ARCHIVED` | **Not rendered** — every door under it is archived (FR-016) |
| Non-administrator | **Not rendered** (FR-002) |

The menu carries `Edit` and nothing else in this slice: `actions` is `[]` and no lifecycle dialog is
passed, because #214 delivers no lifecycle transition (FR-027). The container is chosen now so that
#215 and #216 add `Archive` and `Reactivate` as entries beside `Edit`, without moving a gesture
administrators have already learned (research R10).

Choosing `Edit` **selects the door and opens its session in one navigation** —
`{ warehouseId, doorId, edit: 'door' }` — so the action does not require the row to be selected
first. The label stays the bare action verb: the trigger already names the door, so nothing is
ambiguous against the warehouse's own `Edit` in the sheet footer.

The Doors panel header keeps `Create door` unchanged, and the map's create control gains nothing.

## Map state

| Condition | Map behaviour |
|---|---|
| Mode inactive | Warehouse polygons selectable; door markers selectable |
| Mode active | The door under edit is **replaced** by a draggable draft marker labelled with its own name; its ordinary marker is filtered out, so a stale stored position and the live draft never both claim the door (research R7) |
| Mode active | Dragging the draft marker moves it and updates the coordinate fields |
| Mode active | A click on the map, on a warehouse polygon, or on another door's marker selects nothing, opens nothing, and does **not** move the draft (FR-005a, research R7) |
| Mode active | The other doors of the warehouse stay rendered, so the administrator can see what they are moving between |
| Mode active | The view stays fitted to the selected warehouse's footprint — repositioning a point never changes the bounds |
| Mode active, pan or zoom | The draft marker stays anchored to its geographic coordinates |
| Mode ended | The marker returns to the door's stored coordinates (FR-025) |

## Panel state

Rendered in the existing sheet, replacing the warehouse details and Doors panel while the session is
active.

| Element | Behaviour |
|---|---|
| Back action | "Back to details" — leaves the session without saving |
| Title | "Edit door" |
| Description | Names the door and directs the administrator to drag the marker or edit its coordinates |
| Name field | Pre-filled with the door's name at session start; required; trimmed on submit; error on blur and on submit |
| Latitude / Longitude fields | Pre-filled with the door's position at session start. Always rendered — the pointer-free path. Synced both ways with the draft marker |
| "Position modified" / "Restore original position" | Shown once the draft differs from the session's origin; restoring returns the draft to the **snapshotted** origin, never to a refetched one |
| Submit | Reads "Save changes", and "Saving…" while in flight. Disabled while a coordinate field fails to parse or is out of range, or the draft lies outside the footprint |
| Cancel | Ends the session, discards the draft, leaves the stored door untouched |
| Containment message | Shown inline when the draft lies outside the selected warehouse's footprint |

Submitting with the door's current name and current position unchanged is **allowed** and succeeds
(FR-011, spec edge case): nothing disables the button on a no-op.

## Feedback

| Outcome | Feedback |
|---|---|
| Success | Toast "Door updated"; the warehouse collection refetches; the corrected door stays selected in the list and on the map |
| `E_WAREHOUSE_DOOR_NAME_CONFLICT` | Field error on the name; draft and entered name kept |
| `E_WAREHOUSE_DOOR_NAME_INVALID` | Field error on the name; draft and entered name kept |
| `E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT` | Form-level error; draft and entered name kept |
| `E_WAREHOUSE_DOOR_COORDINATES_INVALID` | Form-level error; draft and entered name kept |
| `E_WAREHOUSE_DOOR_ARCHIVED` | Form-level error stating the door must be reactivated first; the session does not silently end |
| `E_WAREHOUSE_ARCHIVED` | Form-level error stating the warehouse must be reactivated first |
| `E_WAREHOUSE_DOOR_NOT_FOUND` / `E_WAREHOUSE_NOT_FOUND` | The session closes and the administrator is returned to a consistent consultation view |
| `E_VALIDATION_ERROR` | Mapped onto the named field by the shared `applyValidationError` helper |
| Any other failure | Toast "Unable to update door" with the message; draft and entered name kept, so a retry re-sends the same submission (FR-018, FR-024) |

## Accessibility

- The draft marker carries an always-visible label naming the door, so the marker being moved is
  identifiable without relying on color or position.
- Both coordinate fields are reachable and operable by keyboard alone, and editing them repositions
  the door without any map interaction — the complete pointer-free path (FR-006).
- Errors are associated with their field through `aria-describedby` / `aria-invalid`, as the shared
  `CoordinateField` and `TextField` already do.
- "Position modified" is announced through `role="status"`, as `EditCheckpointPanel` already does.
- Focus moves into the panel when the session opens and returns to the Doors panel when it closes.
