# UI State Contract: Warehouse Creation Mode

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **API**: [warehouses-create.openapi.yaml](./warehouses-create.openapi.yaml)

Defines the observable state of the warehouse map while a footprint is being drawn. This is the
contract the web tests assert against; it introduces the **first map mode** on `/warehouses`.

## URL contract

The route `/_authenticated/warehouses` gains one search param.

| Param | Values | Meaning |
|---|---|---|
| `create` | `'warehouse'` \| absent | Warehouse creation mode is active. Deep-linkable. |

Existing params (`status`, `search`, `warehouseId`, `doorId`, `doorStatus`) keep their meaning.

**Transitions**

| From | Action | To |
|---|---|---|
| Consultation | Activate "Create warehouse" | `create=warehouse`, and `warehouseId`/`doorId`/`doorStatus` cleared (FR-002b) |
| Creation mode | Cancel, or dismiss the panel | `create` cleared, pending vertices discarded (FR-019) |
| Creation mode | Successful creation | `create` cleared, `warehouseId=<new id>`, `status='available'`, `search=''` (FR-016) |
| Creation mode | Rejected submission | Unchanged — name and vertices preserved (FR-017) |

`create=warehouse` in the URL for a user without warehouse management permission is **inert**: the
ordinary consultation view renders, no panel opens, and the map is not armed (FR-006, FR-020).

## Map state

| Condition | Map behaviour |
|---|---|
| Mode inactive | Polygons selectable; clicking one opens its details |
| Mode active | Cursor is a crosshair; a map click appends a boundary point; clicking an existing polygon does **not** open its details (FR-002a) |
| Mode active, ≥1 vertex | Each vertex renders as a draggable marker, visually distinct from persisted warehouses |
| Mode active, ≥2 vertices | The pending outline renders as a line following the vertices |
| Mode active, ≥3 vertices | The pending outline closes and fills, still visually distinct from persisted warehouses; the **first** vertex becomes an activatable control labelled "Finish the outline" |
| Outline finished | The map stops appending points; vertices stay draggable; the first vertex is a plain marker again (FR-002c) |
| Outline finished, then a point removed | The outline reopens and map clicks append again (FR-002c) |

Persisted warehouse polygons are non-interactive for the whole duration of the mode — layer,
focusable marker and tooltip alike. Arming the canvas is not sufficient on its own, because the map
dispatches layer-scoped handlers independently of the canvas click handler.

Pending vertices are anchored to geographic coordinates and survive pan and zoom.

## Creation panel

Opens as a sheet while the mode is active.

| Element | State |
|---|---|
| Title | "Create warehouse" |
| Name field | Text, required, trimmed on submit |
| Point summary | "No points placed yet" / "1 point placed" / "N points placed", with "· outline finished" appended once the outline is closed |
| "Remove last point" | Enabled while at least one vertex exists; reopens a finished outline |
| Coordinates disclosure | Collapsed by default, labelled "Coordinates (advanced)". Opening it reveals one latitude/longitude `CoordinateField` pair per vertex — kept in sync with the map in both directions — and an "Add boundary point" action. This is the pointer-free path (FR-004a) |
| Guidance | States that at least three points are required, while fewer than three exist |
| Submit | Disabled while fewer than three vertices exist, while any coordinate fails to parse, or while submitting. **Not** gated on the outline being finished |
| Cancel | Always available; leaves the mode |

The coordinate values are folded away rather than listed: drawing on the map is the expected path,
and a fieldset per vertex crowds the panel from four points onward. They are never removed — they
are the only way to place a footprint without a pointing device.

## Error surfacing

| Cause | Surface |
|---|---|
| Blank name (client or `E_VALIDATION_ERROR` on `name`) | Field-level message on the name field |
| Fewer than three vertices | Panel guidance; submit stays disabled |
| Coordinate unparseable or out of range | Message on the affected vertex field |
| Self-crossing or duplicate-consecutive outline (client guard or `E_WAREHOUSE_INVALID_FOOTPRINT`) | Form-level message naming the crossing outline |
| `E_WAREHOUSE_NAME_CONFLICT` (409) | Field-level conflict message on the name field |
| Network or 5xx failure | Toast titled "Unable to create warehouse"; mode, name, and vertices all preserved |

In every failure case the pending footprint and the entered name survive (FR-017), and no warehouse
is created (FR-018).

## Permission gate

`isAdministrator(user)` gates the create control's rendering. The control is offered in the map's
control cluster and, when no basemap is configured, next to the "map unavailable" notice. The server
remains authoritative: the client gate is a convenience, not the enforcement point.
