# Data Model: Active Discharge Overview

No persistence change. These are the web view models derived from the `discharges.show` payload
(`DischargeDetailDto`) and the dock occupancy read. They live in
`apps/web/src/features/discharges/active-discharge-view.ts` (pure, unit tested) unless noted.

## Inputs (existing)

| Source | Fields used |
|--------|-------------|
| `DischargeDetailDto` | `status`, `vesselName`, `vesselImo`, `vesselComment`, `dock`, `expectedStartAt`, `startedAt`, `expectedTonnage`, `productLots[]` (customer, `doorAssignments[]`), `truckPool[]` (`registration`, `releasedAt`), `shifts[]` |
| `shifts[]` | `id`, `status` (`PLANNED`/`ACTIVE`/`COMPLETED`), `plannedStartAt`, `plannedEndAt`, `actualStartAt`, `responsible` (+ readiness gap for ineligibility), `trucks[]`, `warehouseDoors[]`, `weighingAreas[]` with effective periods |
| Dock occupancy (#323) | `[{ discharge: { id, vesselName, status }, startAt, endAt }]` for the dock |

Shifts arrive in planned order. A discharge has at most one `ACTIVE` shift.

## DischargePeriod

`dischargePeriod(discharge) → { from: string, to: string | null }` (shared with #324)

- `ACTIVE` / `CLOSED`: `from = startedAt`; `PLANNED`: `from = expectedStartAt`.
- `to` = latest `plannedEndAt` among shifts, `null` when there is none.

## ActiveShiftSummary (Current shift card)

```text
ActiveShiftSummary =
  | { state: 'ACTIVE', shift, position: { index, total }, resources, next: NextShift | null }
  | { state: 'BETWEEN', last: ShiftRef | null, next: NextShift | null }
```

- `position.index` is the 1-based rank of the shift in planned order (« Shift 6 of 14 »).
- `resources` reuses `shiftResources(shift)` (in-effect trucks, doors with warehouse, weighing
  areas), each with its count.
- `next` = first `PLANNED` shift after the active one (or after the last completed one):
  `{ id, plannedStartAt, plannedEndAt, responsible, counts: { trucks, doors, weighingAreas } }`.
- `last` = the last `COMPLETED` shift; its end is `actualEndAt ?? plannedEndAt` (research D6).
- Responsible ineligibility and archived resources keep the existing markings (FR-009).

## DischargeProgress (Progress card)

```text
DischargeProgress = {
  shifts: { total, completed, active, planned, plannedEnd: string | null },
  lots: { total, customers, expectedTonnage, withDoor: { count, doorNames[] }, withoutDoor },
  trucks: { held, released: Array<{ registration, releasedAt }> },
}
```

- `withDoor` counts lots holding at least one door in effect (`isInEffect`), with distinct door
  names in first-seen order.
- `held` counts pool entries with `releasedAt === null`.

## DockTimeline (shared with #324)

```text
DockTimeline = {
  window: { from, to }           // whole days covering the discharge period, extended to Now
  now: string | null             // shown when inside the window
  lanes: Array<{
    discharge: { id, vesselName, status, isCurrent },
    blocks: Array<{ shiftId?, from, to, state: 'COMPLETED' | 'ACTIVE' | 'PLANNED' | 'OCCUPANCY',
                    overrun: boolean }>,
    breaks: Array<{ from, to }>  // inter-shift breaks of this discharge's lane
  }>
}
```

- This discharge's lane: one block per shift. `COMPLETED` from `actualStartAt` to
  `actualEndAt ?? plannedEndAt`; `ACTIVE` from `actualStartAt` to `max(plannedEndAt, now)` with
  `overrun = now > plannedEndAt`; `PLANNED` at the planned period.
- Other discharges: one `OCCUPANCY` block per occupancy entry, excluding this discharge.
- Labels: blocks show `HH–HH`; the lane header shows vessel, customer count, « planned until … ».

## State transitions

None introduced. The view reads shift statuses only; starting, completing, or adjusting shifts
belong to other features.
