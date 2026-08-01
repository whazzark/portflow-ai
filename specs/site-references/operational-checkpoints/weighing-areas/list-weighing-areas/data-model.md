# Data Model: List Weighing Areas

## Persistence impact

This feature reads the existing `weighing_areas` relation. It adds no table, column, index, or data
migration.

## Weighing Area

Existing authoritative model: `apps/api/app/models/weighing_area.ts` backed by `weighing_areas`.

| Field | Type | Consultation rules |
|---|---|---|
| `id` | UUID | Stable identity; collection-backed detail selection and deterministic final ordering key |
| `name` | string | Required identifying label; supported writes enforce case-insensitive uniqueness |
| `latitude` | number | Required; inclusive range `-90..90`; shown in detail including boundary/zero values |
| `longitude` | number | Required; inclusive range `-180..180`; shown in detail including boundary/zero values |
| `status` | `AVAILABLE \| ARCHIVED` | Required current lifecycle state; controls marker styling and shared status-filter admission |
| `archivedAt` | timestamp or null | Existing lifecycle metadata; not required by this consultation UI |
| `archivedByUserId` | UUID or null | Existing actor reference; may be null after actor retention changes |
| `archiveComment` | string or null | Existing lifecycle metadata; outside the detail requirements for this slice |
| `reactivatedAt` | timestamp or null | Existing lifecycle metadata; not required by this consultation UI |
| `reactivatedByUserId` | UUID or null | Existing actor reference; may be null |
| `reactivationComment` | string or null | Existing lifecycle metadata; outside the detail requirements for this slice |
| `createdAt` | timestamp | Existing record metadata |
| `updatedAt` | timestamp | Existing record metadata and freshness marker |

### Invariants

- Every valid record has a non-empty normalized name and required latitude/longitude.
- `status` has exactly one current value, so a record can appear in only one status collection.
- Archived records remain persisted and readable; no consultation path deletes or mutates them.
- Collection order is `LOWER(name)`, then `name`, then `id`, all ascending.
- Missing lifecycle actor metadata does not prevent identity, coordinates, or status from being read.

### State transitions

The consultation feature performs no state transition. Other delivery slices own:

```text
AVAILABLE --archive--> ARCHIVED --reactivate--> AVAILABLE
```

The next successful collection refresh observes the authoritative current value.

## Authorized Administrator

An authenticated user whose existing role is either `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN`.
The API collection policy evaluates this role on every request. The browser's navigation visibility
is an ergonomic projection and is not an authorization boundary.

## Consultation view state

This state is URL-backed and not persisted as business data.

| Search parameter | Type | Default | Rules |
|---|---|---|---|
| `status` | `all \| available \| archived` | `all` | Existing shared checkpoint status filter; invalid input falls back to `all` |
| `search` | string | empty | Existing case/diacritic-insensitive resource-name match across both kinds |
| `checkpoint` | `<kind>:<id>` or absent | absent | `weighing-area:<id>` selects a weighing area; Dock selection remains unchanged |

### UI state derivation

- Each Weighing Area DTO is adapted to the shared `Checkpoint` presentation type with kind
  `WEIGHING_AREA`, then combined with adapted Dock DTOs.
- The shared status filter admits both resource kinds uniformly and search annotates both kinds
  without removing nonmatches.
- If no weighing areas exist, show resource-specific empty feedback even if docks remain visible.
- If weighing areas exist but none match the selected status, show selected-status weighing-area
  feedback while keeping the aggregate map usable.
- Detail data is the exact collection DTO whose ID is parsed from
  `checkpoint=weighing-area:<id>`; no second request or copied editable model is introduced.
- A missing, malformed, unavailable, or status-excluded selection clears `checkpoint` without
  substituting another resource; the loaded map remains usable.

## Shared Checkpoint presentation

Checkpoint remains a non-persisted UI category. A Weighing Area contributes `{ id, kind, name,
latitude, longitude, status }` through a resource-owned adapter. The aggregate collection never
changes resource identity or becomes an API write model.
