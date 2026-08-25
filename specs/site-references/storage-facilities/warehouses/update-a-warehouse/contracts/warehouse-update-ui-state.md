# UI State Contract: Update a Warehouse

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **API**: [warehouses-update.openapi.yaml](./warehouses-update.openapi.yaml)

The behavioral contract of the update mode on `/warehouses`. It states what is observable, not how
it is built.

## URL state

`/warehouses` gains one search param beside the existing `create`, `warehouseId`, `doorId`,
`doorStatus`, `search`, and `status`.

| Param | Values | Meaning |
|---|---|---|
| `edit` | `warehouse` \| absent | The update mode is requested for the warehouse named by `warehouseId`. |

Rules:

- `edit` is meaningful **only** together with a `warehouseId` that resolves to a visible warehouse.
  Alone, it is inert.
- `edit` is scoped to the selection it was opened for. Any navigation that drops or changes
  `warehouseId` drops `edit` with it — a session must never be left armed for whichever warehouse is
  selected next.
- `edit=warehouse` requested by a user without warehouse management permission is **inert**: no
  panel, no editable ring, ordinary consultation. Same rule the `create` param already follows.
- `edit=warehouse` requested for an **archived** warehouse is inert in the same way; the server
  refuses the submission regardless (409 `E_WAREHOUSE_ARCHIVED`).
- `create` and `edit` are mutually exclusive. Activating either drops the other, and activating
  creation ends an update in progress without saving it (FR-005b).

## Mode states

| State | Sheet | Map | Entry |
|---|---|---|---|
| Consultation | Warehouse details + doors panel | Polygons selectable, auto-fit on selection | Default |
| **Update** | Update panel, pre-filled | Edited ring editable, other polygons inert, auto-fit suspended | Update action in the details panel |
| Creation | Create panel | Armed for click-to-append | Create action in the map control cluster |

## Update panel

Pre-filled at session start with the warehouse's stored name and complete footprint (FR-005).

| Element | Behavior |
|---|---|
| Back / cancel | Leaves the mode, restores the stored outline, keeps the warehouse selected (FR-026). |
| Name field | Pre-filled; client-side blank and length feedback; server messages land on this field (FR-024). |
| Point count | Running count of the draft's boundary points (FR-006). |
| "Modified" indicator | Shown when the draft differs from the session's snapshotted origin, with a way to restore it — the same affordance `EditCheckpointPanel` offers for a moved marker. |
| Coordinates (advanced) | Folded away by default, reachable in one interaction. One fieldset per boundary point, each with latitude, longitude, **insert after this point**, and **remove** (FR-006d). |
| Geometry feedback | The first blocking problem, in the panel: too few points, duplicate consecutive points, self-crossing, flat outline, doors outside. |
| Save | Disabled while the draft is unacceptable or unchanged-and-empty; label switches to a pending state during submission. |

## Map gestures in update mode

| Gesture | Result |
|---|---|
| Drag a vertex marker | Moves that boundary point; the ring redraws (FR-006). |
| Click a per-edge insert handle | Inserts a boundary point at that edge's midpoint, between its two endpoints (FR-006a). |
| Remove control on a focused/hovered vertex, or `Delete` / `Backspace` | Removes that boundary point; the ring closes over the gap (FR-006b). |
| Any of the above at exactly three points | Removal is disabled with an explanation; insertion and dragging stay available (FR-006b). |
| Click on empty map | **Nothing.** The map is not armed in update mode (FR-005a). |
| Click on another warehouse's polygon | **Nothing.** No selection change, no boundary point added (FR-005a). |
| Pan / zoom | Every boundary point stays at its geographic position; the map does not re-fit (research R12). |

The edited warehouse's **doors stay rendered** throughout: they are the constraint the administrator
is shaping around (research R12).

## Outcome handling

| Outcome | HTTP | Where it is shown |
|---|---|---|
| Success | 200 | Mode closes, warehouse stays selected, map frames the corrected polygon, list refreshed without a reload (FR-021). |
| Blank / over-long name | 422 `E_WAREHOUSE_NAME_INVALID` | Name field |
| Duplicate name | 409 `E_WAREHOUSE_NAME_CONFLICT` | Name field |
| Invalid outline or coordinate | 422 `E_WAREHOUSE_INVALID_FOOTPRINT` | Panel, against the outline or the affected point |
| Doors outside the new outline | 409 `E_WAREHOUSE_DOORS_OUTSIDE_FOOTPRINT` | Panel, naming the doors |
| Archived warehouse | 409 `E_WAREHOUSE_ARCHIVED` | Panel, stating that reactivation is required first |
| Warehouse not found | 404 `E_WAREHOUSE_NOT_FOUND` | Mode closes, selection cleared, consultation left consistent |
| Unauthorized | 401 / 403 | Established access-handling behavior |
| Connectivity / server failure | — | Toast, retryable, draft preserved |

Every refusal preserves the entered name and the draft outline exactly as they stood, so the
administrator corrects and resubmits without leaving the mode or redrawing (FR-025).

## Session rules

Carried over from the discipline `useCheckpointEditSession` hardened after #199 (research R11):

1. A session is discarded whenever the selection it belongs to changes identity or disappears.
2. `editable` and the origin values are snapshotted once at session start and never re-derived from
   live query data — a background refetch of another administrator's change must not end an
   in-progress edit, masquerade as this administrator's unsaved work, or become what cancellation
   restores.
3. Nothing lets a caller re-arm a session for a warehouse that is not the selected one.
