# Data Model: Show the Planned Discharge Header and Dock Timeline

No table, column, or migration changes. The slice adds one read-model field on the API and a few
derived web view models.

## API read model

### DockOccupation (new, `app/discharges/shared/discharge_detail_read.ts`)

Another discharge assigned to the same dock as the discharge being read.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `dischargeId` | uuid | `discharges.id` | Never the discharge being read |
| `vesselName` | string | `discharges.vessel_name` | |
| `status` | `'PLANNED' \| 'ACTIVE'` | `discharges.status` | Closed discharges are excluded |
| `expectedStartAt` | instant | `discharges.expected_start_at` | |
| `startedAt` | instant \| null | `discharges.started_at` | Set for ACTIVE |
| `plannedStartAt` | instant \| null | `min(shifts.planned_start_at)` | `null` without shifts |
| `plannedEndAt` | instant \| null | `max(shifts.planned_end_at)` | `null` without shifts |

Ordering: ACTIVE first, then by `coalesce(plannedStartAt, expectedStartAt)` ascending, then `id`.

`DischargeDetailRead` gains `dockOccupations: DockOccupation[]` — empty unless the discharge read is
PLANNED.

## Web view models (pure, `apps/web/src/features/discharges`)

### PlannedPeriod (`discharge-detail-view.ts`)

`{ startAt: string; endAt: string } | null` — earliest `plannedStartAt` / latest `plannedEndAt` over
the detail's shifts; `null` without shifts (header then shows the expected start and "no shift
planned").

### DockTimeline (`dock-timeline.ts`)

Input: the detail, `now`. Output:

| Field | Meaning |
|-------|---------|
| `span` | `{ startAt, endAt }` — planned period (or expected start ± 12 h) padded 10 % / ≥ 2 h each side |
| `now` | `{ position: number }` (0–1) when inside the span, else `{ relation: 'BEFORE' \| 'AFTER' }` |
| `expectedStart` | `{ at, position }` |
| `shifts` | `[{ id, startAt, endAt, from, to }]` in planned-start order; `from`/`to` are 0–1 positions |
| `gaps` | `[{ startAt, endAt, durationMinutes, from, to }]` between consecutive shifts with no shift planned (touching or overlapping shifts produce none) |
| `occupations` | `[{ dischargeId, vesselName, status, startAt, endAt \| null, from, to, clippedStart, clippedEnd, openEnded, pointOnly, overlapsPlannedPeriod }]` filtered to those intersecting the span |
| `dockFree` | `true` when no occupation falls within the span |

Rules:

- Active occupation: `startAt = startedAt`; `endAt = plannedEndAt` if later than both `startedAt`
  and now, else `null` (`openEnded`, drawn to the span's end): an active discharge that overran its
  plan still holds the dock until it is closed.
- An active occupation ending before the span is kept with `outsideSpan: true`: listed (it holds the
  dock now and is why a start is refused), not drawn, and not counted against `dockFree`. Planned
  occupations outside the span are dropped.
- Planned occupation with shifts: `plannedStartAt → plannedEndAt`; without shifts: `pointOnly` at
  `expectedStartAt`.
- `overlapsPlannedPeriod`: the occupation's interval intersects this discharge's planned period (or,
  without shifts, contains its expected start).
- Positions are clamped to [0, 1]; `clippedStart` / `clippedEnd` mark an interval cut by the span.

### Problem tabs (`discharge-detail-sections.ts`)

`problemTabs(sections: StartProblemSection[]): ReadonlySet<DischargeDetailTab>` — the tabs of the
sections the start check reports problems in.

### Preparation summary, Dock row (`discharge-detail-sections.ts`)

`dock: { name: string; gap: null | { kind: 'ARCHIVED' } | { kind: 'HELD'; vesselName: string; dischargeId: string } }`
— ARCHIVED from `detail.dock.status`; HELD from the first ACTIVE `dockOccupation`.
