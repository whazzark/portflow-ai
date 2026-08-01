# Phase 1 Data Model: List Docks

## Dock

Existing persisted site reference; this feature reads it without changing its schema or state.

| Field | Type | Required | Rules / meaning |
|---|---|---:|---|
| `id` | UUID string | yes | Stable identity; drives row keys and exact detail selection |
| `name` | string | yes | Dock label; unique case-insensitively in persistence |
| `latitude` | number | yes | GPS latitude in `[-90, 90]` |
| `longitude` | number | yes | GPS longitude in `[-180, 180]` |
| `status` | `AVAILABLE \| ARCHIVED` | yes | Current lifecycle classification; exactly one value |
| `archivedAt` | ISO date-time or null | no | Most recent recorded archive time |
| `archivedByUserId` | UUID string or null | no | Existing audit reference; not presented by this feature |
| `archiveComment` | string or null | no | Comment associated with the recorded archive event |
| `reactivatedAt` | ISO date-time or null | no | Most recent recorded reactivation time |
| `reactivatedByUserId` | UUID string or null | no | Existing audit reference; not presented by this feature |
| `reactivationComment` | string or null | no | Comment associated with the recorded reactivation event |
| `createdAt` | ISO date-time | yes | Creation time |
| `updatedAt` | ISO date-time | yes | Last persisted update time |

### Relationships

- A Dock is a Site Reference within the authenticated user's single Site scope. The current data
  model has no tenant/site foreign key because ADR-0003 defines a single-site deployment.
- Optional lifecycle actor IDs reference User records and become null if the user is deleted.
- Operational references from discharges constrain later archive behavior, but this read-only
  slice neither loads nor changes those relationships.

### Read invariants

- Every returned dock has one stable `id` and appears once in the complete collection.
- `AVAILABLE` and `ARCHIVED` remain mutually exclusive persisted states; the All presentation
  filter combines both without changing either state.
- Repository output is ordered by dock name ascending; the UI does not introduce user-controlled
  sorting in this slice.
- Missing lifecycle dates/comments remain null and are omitted from the detail presentation.
- Archived docks remain readable but are explicitly unavailable for new operational use.

### State transitions

No transition is initiated by this feature. Existing lifecycle behavior, delivered separately,
is represented for consultation only:

```text
AVAILABLE --archive--> ARCHIVED --reactivate--> AVAILABLE
```

If a retry observes a transition performed elsewhere, the refreshed collection classifies the
dock only by its newly returned current status.

## Dock Collection

The `data` array returned by `docks.index` is the screen's server state.

Derived views:

- `statusDocks = status === "all" ? data : data.filter(dock.status === selectedStatus)`
- `normalizedSearch = stripDiacritics(search.trim().toLocaleLowerCase())`
- `matchingDockIds = statusDocks whose normalized name includes normalizedSearch`; every
  `statusDocks` ID matches when search is empty
- `selectedDock = statusDocks.find(id === typed checkpoint selection id)` when the kind is `dock`
- `visibleMarkers = statusDocks.map({ id, name, latitude, longitude, status, isSearchMatch })`
- `visibleRows = statusDocks.map({ dock, isSearchMatch })`

An empty `statusDocks` view is a successful filter-specific empty state. Non-empty `statusDocks`
with zero `matchingDockIds` is a search no-match state: rows and markers remain present but muted.
A rejected or unavailable query is an error state, never an empty collection.

## Consultation URL State

| Field | Type | Default | Validation / behavior |
|---|---|---|---|
| `status` | `all \| available \| archived` | `all` | Unknown values normalize to `all` |
| `search` | string or absent | absent | Trimmed for matching; URL updates replace history while typing |
| `checkpoint` | `<kind>:<id>` or absent | absent | `dock:<id>` resolves the exact dock; malformed, unavailable, or status-excluded selections close/clear detail |

URL state owns restorable navigation only. The query cache owns dock server state; sheet open state
is derived from whether the typed checkpoint selection resolves to a current resource.

## Map Projection State

Map markers are derived presentation state, never a second dock data source. Each marker preserves
the dock's stable `id`, name, latitude, longitude, current status, kind, and match annotation. Marker
selection writes `checkpoint=dock:<id>`. Match emphasis combines more than
color (for example opacity plus scale/outline), and the table exposes the same distinction. Viewport
center/zoom and transient tooltip visibility remain local UI state and are not persisted in the
URL; search changes do not recenter or refit the viewport.
