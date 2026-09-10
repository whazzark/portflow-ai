# Phase 1 Data Model: Browse the Discharges List in the Web Workbench

No table, column, index, migration, factory, or seed changes. Every entity below was delivered by
GH-236 and is consumed read-only. This document describes the **read model** the slice projects out
of them.

## Persisted entities consumed

### Discharge (`discharges`, `#models/discharge`)

| Field | Type | Use in this slice |
|---|---|---|
| `id` | uuid, PK | Stable identity, list key, order tie-breaker |
| `status` | `PLANNED` \| `ACTIVE` \| `CLOSED` | Determines the collection a discharge belongs to |
| `vesselName` | string, non-empty | Shown on the row; searchable |
| `vesselImo` | string, nullable | Shown on the row; searchable; renders as `Not specified` when null |
| `vesselComment` | text, nullable | **Not exposed** — detail context, belongs to GH-58 |
| `dockId` | uuid → `docks.id` | Resolved to the dock name |
| `expectedStartAt` | timestamp | Shown on the row; the ordering key |
| `createdAt` / `updatedAt` | timestamp | **Not exposed** — no requirement reads them |

Relations used: `dock` (belongsTo), `productLots` (hasMany), `shifts` (hasMany, counted only).
Relations deliberately unused: `truckAssignments`, `doorAssignments` — GH-54, GH-55, and GH-58.

### Product Lot (`product_lots`, `#models/product_lot`)

| Field | Use |
|---|---|
| `id` | Identity within the row's lot array |
| `dischargeId` | Ownership |
| `customerId` | Identifies the customer |
| `productName` | Shown with the customer; searchable |
| `expectedQuantityTonnes` | **Not exposed** — tonnage is out of scope |
| `description` | **Not exposed** |

### Customer (`customers`, `#models/customer`)

Only `id` and `name` are read, through `productLots.customer`. Archived customers are read normally:
FR-019 requires a discharge to stay readable when a reference it uses has been archived.

### Shift (`shifts`, `#models/shift`)

Counted, never loaded. See Decision 3 in `research.md` for the counting rule and the FR-006 wording
question it escalates.

### Dock (`docks`, `#models/dock`)

Only `id` and `name` are read. An archived dock is shown as-is and never substituted (FR-019).

## Projected read model

One `DischargeListItem` per discharge. This is the shape the transformer emits and the shape the web
DTO type mirrors; the authoritative field list is `contracts/discharges.openapi.yaml`.

```text
DischargeListItem
├── id            : string (uuid)
├── status        : 'PLANNED' | 'ACTIVE' | 'CLOSED'
├── vesselName    : string
├── vesselImo     : string | null
├── expectedStartAt : string | null (ISO 8601; NOT NULL in the column, nullable in transport)
├── dock          : { id: string, name: string }
├── productLots   : Array<{ id, customerId, customerName, productName }>
└── shiftCount    : number
```

Derived in the browser, never sent:

| Derived value | From | Requirement |
|---|---|---|
| Status collections | `status` | FR-004, FR-007 |
| Per-status counts | collection lengths, computed before search | FR-005 |
| Product-lot count | `productLots.length` | FR-006 |
| Distinct customers on a row | `productLots[].customerName`, de-duplicated | FR-006 |
| Search corpus | vessel name, IMO, dock name, lot customer and product names | FR-008 |
| Closed-tab order | reverse of the API's ascending order | FR-012 |

## Invariants this slice relies on

- Every discharge has exactly one status, so the three collections partition the payload with no
  overlap and no remainder (FR-007). Guaranteed by the `status` enum column.
- Every discharge has a non-null `dockId` and a non-null `expectedStartAt` in the database,
  guaranteed by `NOT NULL` in the GH-236 migration. The generated transport type nonetheless types
  `expectedStartAt` as nullable, so the browser coerces when ordering rather than asserting an
  invariant its types do not carry.
- `vesselName` is non-empty, guaranteed by the table's `LENGTH(TRIM(vessel_name)) > 0` check.
- `vesselImo` is the only nullable field the row displays, so it is the only one needing the
  `Not specified` placeholder (FR-020).
- A discharge may legitimately have zero product lots and zero shifts — a freshly planned one does —
  so the row renders `0` rather than treating it as missing data.

## State transitions

None. The slice performs no write and observes no transition. A discharge whose status changes
elsewhere simply appears in a different collection on the next fetch (FR-018), which the query
cache handles by refetching, not by mutating anything locally.
