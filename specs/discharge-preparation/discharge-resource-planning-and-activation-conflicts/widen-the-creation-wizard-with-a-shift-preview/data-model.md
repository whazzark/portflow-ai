# Data Model: Wider Creation Wizard With a Shift Preview

Nothing is stored or migrated. This feature adds one derived read model on the API and one derived
view model on the web.

## Dock occupancy (API read model)

Derived from `discharges` and `shifts`, for one dock.

| Field | Type | Source / rule |
|-------|------|---------------|
| `discharge.id` | uuid | `discharges.id` |
| `discharge.vesselName` | string | `discharges.vessel_name` |
| `discharge.status` | `PLANNED` \| `ACTIVE` | `discharges.status`; `CLOSED` excluded |
| `startAt` | ISO instant | `min(shifts.planned_start_at)` over every shift of the discharge |
| `endAt` | ISO instant | `max(shifts.planned_end_at)` over every shift of the discharge |

Rules (research.md Decision 3):

- Only discharges with `dock_id = :dockId` and status `PLANNED` or `ACTIVE` are included.
- A discharge with no shift that has both instants is omitted.
- The span covers all of the discharge's shifts, whatever each shift's status.
- Items are ordered by `startAt` ascending, then `discharge.id`.
- An unknown dock answers an empty list. An archived dock answers its occupancy like any other dock.
- The discharge being created does not exist yet, so it is never part of the answer. #324 filters
  out its own discharge client-side.

## Shift preview (web view model)

Computed by `shift-preview.ts` from the form values (`dockId`, `vesselName`, `expectedStartAt`,
`shifts[]`) and the occupancy items. All instants are in the browser zone.

### Inputs

- **Expected start**: `fromDateTimeLocalValue(expectedStartAt)`. It is always valid here, because
  step 1 must be complete before step 3 opens.
- **Shift periods**: for each `shifts[i]`, the parsed start and end. A period is valid when both
  parse and the end is after the start, the same rule as `plannedCoverage`.
- **Occupancy**: the items above, or `null` while loading or on error.

### Outputs

| Part | Content |
|------|---------|
| `days` | Ordered day columns `{ start, label }` (for example « Tue 22 »). The period runs from `days[0].start` to the end of the last day. |
| `freeFrom` | The latest `endAt` among occupancies with `startAt` before the expected start, or `null`. |
| `occupancies` | For each item intersecting the period: `{ discharge, startAt, endAt, leftPct, widthPct, clippedStart, clippedEnd }`. |
| `freeGaps` | The parts of the dock row not covered by an occupancy, as `{ leftPct, widthPct }`, read « Dock free ». |
| `expectedStart` | `{ at, leftPct }`. |
| `shifts` | For each valid period: `{ number, startAt, endAt, leftPct, widthPct }`. `number` is the 1-based form position. |
| `breaks` | Gaps between consecutive shift blocks after sorting by start, measured from the latest end so far: `{ leftPct, widthPct }`. Overlapping shifts produce no break. |
| `unscheduled` | The numbers of shifts without a valid period, read « Shift n · no period yet ». |
| `summary` | `{ count, totalHours }` over valid periods, read « n shifts · h h ». `null` when there is none. |

### Period sizing (research.md Decision 4)

- **First day**:
  - when `freeFrom` exists, the day before it, but never more than 7 days before the expected
    start's day (a discharge left open long after its planned shifts must not stretch the period
    over weeks; older occupancy is clipped);
  - otherwise, the day of the earlier of the expected start and the first valid shift start.
- **Last day**: the day of the latest of the expected start and the last valid shift end. An end
  exactly at midnight belongs to the previous day.
- **Padding**: when the span is shorter than 7 days, days are appended until it is 7.
- **Day boundaries**: days are counted on the calendar, as in `shiftCalendar`, so a clock change
  never moves a column off midnight.
- **Positions**: an instant is placed by its day's index plus its clock time within that day, as
  a share of the period's days. Every day column is equal, so on a clock-change day the hour the
  clocks skip or repeat never shifts what comes after it.
