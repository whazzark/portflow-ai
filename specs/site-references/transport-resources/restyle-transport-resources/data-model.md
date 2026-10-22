# Data Model: Restyle Transport Resources

**Feature**: [spec.md](./spec.md) · **Date**: 2026-10-22

No persisted entity changes. The API DTOs (`TruckDto`, `AvailableTruckDto`, `SuspendedTruckDto`,
`TransportCompanyDto`) are consumed as they are. This document defines the web view model built
by `buildFleetView` (`apps/web/src/features/transport-resources/helpers/fleet-view.ts`) and the
rules it enforces.

## Inputs

| Field | Type | Notes |
|---|---|---|
| `companies` | `TransportCompanyDto[]` | All companies, any status. |
| `trucks` | `TruckDto[]` | Administrators: complete collection. Others: available + suspended collections, actors absent. |
| `statuses` | `Set<'available' \| 'suspended' \| 'archived'>` | Never empty. |
| `search` | `string` | Trimmed, case-insensitive. |
| `transportCompanyId` | `string \| undefined` | Company filter. |
| `sort` / `order` | `'registration' \| 'vehicleModel' \| 'capacity' \| 'status'` / `'asc' \| 'desc'` | Default `registration` / `asc`. |
| `administrator` | `boolean` | Controls archived-truck visibility and actors. |
| `pinnedCompanyId` | `string \| undefined` | A company just created, kept visible while empty. |

## Output: `FleetView`

```text
FleetView
├── counts: { available: number, suspended: number, archived: number }
├── groups: FleetGroup[]            (ordered by company name, locale-aware, ascending)
├── hiddenCompanyCount: number      (companies hidden by the company filter)
├── filteredCompany?: { id, name }  (when transportCompanyId resolves)
├── showArchivedNotice: boolean
└── isEmpty: boolean                (no group to render)

FleetGroup
├── company: TransportCompanyDto
├── summary: { available: number, suspended: number }   (all its trucks, unfiltered)
├── archiveBlockedBy: number        (= summary.available; Archive allowed when 0)
└── trucks: FleetTruck[]            (filtered + sorted)

FleetTruck
├── truck: TruckDto
├── status: 'available' | 'suspended' | 'archived'
└── canReactivate: boolean          (archived truck whose company is AVAILABLE)
```

## Rules

1. **Status membership** — a truck is listed when its status is pressed. A company group is
   listed when:
   - the company is `AVAILABLE` and has at least one listed truck; or
   - the company is `ARCHIVED`, `archived` is pressed (its archived trucks, if any, are listed
     under it — for non-administrators it is listed with no trucks); or
   - the company matches the search by name (with whatever trucks pass the statuses); or
   - it is `pinnedCompanyId` (just created, empty).
2. **Search** — a truck matches when its registration, vehicle model or company name contains the
   term; a company matches on its name. Applied after statuses.
3. **Company filter** — only the filtered company's group remains; `hiddenCompanyCount` = number of
   other groups that would otherwise be listed. An unknown id behaves as no filter.
4. **Sort** — within each group; `vehicleModel` null sorts last in both directions; ties fall back
   to registration ascending. `status` orders Available < Suspended < Archived.
5. **Counts** — computed over all readable resources, ignoring search and company filter.
   `available` and `suspended` count trucks. `archived` counts archived trucks for administrators
   and archived companies for non-administrators, who cannot read archived trucks
   (clarification Q2).
6. **Summary** — "N available · M suspended", the suspended clause omitted when M = 0, from the
   group's full truck list regardless of filters (unchanged in the filtered artboards).
7. **Archived notice** — `true` when `archived` is pressed, the user is an administrator and at
   least one listed archived truck has `canReactivate = false`.
8. **Read-only** — for non-administrators, `trucks` contains no archived truck and no actor;
   nothing else in the view model changes.

## Address state (route search)

See [contracts/url-state.md](./contracts/url-state.md).

## State transitions

Unchanged from the delivered slices (displayed only):

```text
Truck:   AVAILABLE ─suspend→ SUSPENDED ─return to service→ AVAILABLE
         AVAILABLE ─archive→ ARCHIVED ─reactivate (company AVAILABLE)→ AVAILABLE
Company: AVAILABLE ─archive (no AVAILABLE truck)→ ARCHIVED ─reactivate→ AVAILABLE
```
