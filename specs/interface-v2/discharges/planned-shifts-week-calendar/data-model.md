# Data Model: Planned Shifts Week Calendar

No persisted data, API field, or transport type changes. Everything is derived in the web app
from `DischargeDetailDto` as the API already returns it (`status`, `vesselName`, `expectedStartAt`,
and `shifts[]` with `status`, planned and actual times, `responsible`, `trucks`, `warehouseDoors`,
`weighingAreas` with effective periods, and `readinessGaps` for planned shifts).

## Derived view models (web only)

### ShiftsSummary

Derived by `shiftsSummary(discharge)` from the discharge status and its shifts.

| Field      | Meaning                                                                                 |
|------------|-----------------------------------------------------------------------------------------|
| `text`     | The summary sentence without the gap part, worded per discharge status (research R2).  |
| `gapCount` | Total readiness gaps across planned shifts; 0 hides the amber part.                     |

Rules:
- `null` when the discharge has no shift (the empty state shows instead).
- Counts use singular and plural forms ("1 shift", "1 gap").
- Total duration is the sum of planned durations; the range runs from the earliest planned start to
  the latest planned end.

### Calendar segment (existing, extended)

The existing `segments[]` from `shiftCalendar()`: `shift`, `column`, `topPct`, `heightPct`,
`primary`, `continuesFromPrevious`, `continuesToNext`. No new field. The continuation's lines are
derived in the component from its height (`blockRowCount`) and the primary's.

### Shared resource period (panel)

Derived from a shift's in-effect memberships:

| Value               | Meaning                                                                   |
|---------------------|---------------------------------------------------------------------------|
| `trucksSince`       | The single `effectiveFrom` shared by every in-effect truck, else `null`.  |
| `allResourcesSince` | That same instant when every in-effect door and area shares it too, else `null`. |

### Add-shift start hint

| Value           | Meaning                                                                            |
|-----------------|------------------------------------------------------------------------------------|
| `lastShiftEnd`  | The planned end of the discharge's last shift, or none when it has no shift.        |
| shown when      | the form did not open from a drawn period, and its planned start equals `lastShiftEnd`. |
