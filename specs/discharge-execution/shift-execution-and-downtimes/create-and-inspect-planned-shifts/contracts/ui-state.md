# UI State Contract: Create and Inspect Planned Shifts

**Feature**: `GH-63` | **Plan**: [../plan.md](../plan.md)

This contract covers what the Shifts section of the discharge detail shows and does. The section
counts, the tabs, the shift panel's address (`?tab=shifts&shiftId=…`), and the correction flow stay
as GH-55 and GH-54 delivered them.

## Permissions

| Viewer | Discharge | `Add shift` | Resource fields in the form | Readiness block | `Go to truck pool` in readiness | Draw on calendar |
|---|---|---|---|---|---|---|
| `canPrepareDischarges` | PLANNED | shown | shown | planned shifts | shown | shown |
| `canPrepareDischarges` | ACTIVE | shown | hidden | planned shifts | hidden (runtime slices own filling gaps) | shown |
| `canPrepareDischarges` | CLOSED | hidden | — | — (no planned shift) | — | hidden |
| Observer | any | hidden | — | planned shifts | hidden | hidden |

`canAddShifts = canPrepareDischarges(user) && discharge.status !== 'CLOSED'`. This mirrors
`DischargePolicy.update` and the status guard, and is not a security boundary.

## Shifts section

- **Header action**: `Add shift` (primary, with a `PlusIcon`), in the `DetailSection` action slot. The
  empty state ("No shifts planned") offers the same action.
- **Calendar block of a planned shift with `readinessGaps.length > 0`**: warning border, a
  `TriangleAlertIcon` beside the status badge, and the phrase "1 gap" / "N gaps" appended to the
  block's screen-reader summary. This replaces the truck-only `lacksTrucks` marker.
- **Calendar block of a planned shift with no gap, or of a started shift**: unchanged, with no marker.
- **Break between two shifts**: the hatched area, over a `bg-muted/40` fill, carries an outline
  `Badge` with a `CoffeeIcon` and the duration (`formatShiftDuration`, e.g. "30 min", "8 h"), once per
  break, centred in its tallest piece when it crosses midnight. The badges sit in a layer above the
  shifts, beneath the drawing preview, so every break reads its duration: a break under 20px tall
  gets a compact 16px badge, which spills only into the padding of the cards around it. Hovering a
  badge opens a tooltip: "Break · {end of the shift}–{start of the next}" and "Time between the end
  of a shift and the start of the next one." The badge takes no focus and starts no drawing. In the
  stacked list, a "{duration} break" item sits before the shift that follows the break, as a dashed
  divider around the same badge; on the calendar that item is `sr-only`, so assistive technology
  reads it in order. Overlapping or touching shifts have no break.

## Drawing a shift on the calendar

Offered when `canAddShifts`, on the calendar drawn at `md` and wider; the stacked list is unchanged.

| Gesture | Result |
|---|---|
| Mouse or pen press on a column's day area, outside any shift block | Starts a drawing, with a crosshair cursor over the columns. The pointer is captured. |
| Drag | A dashed preview block, cut at midnight like a shift, reads the drawn times. It may cross a shift; the form then names the overlap. Positions snap to `DRAW_STEP_MINUTES` (30). |
| Release after dragging | Opens `Add shift` with `plannedStartAt` and `plannedEndAt` set to the drawn period, earliest first. |
| Release where the press began | Opens `Add shift` with that start and, when the discharge has a shift, an end as far after it as the last shift lasts; otherwise no end. |
| `Escape` during a drawing, or `pointercancel` | Drops the drawing; nothing opens. |
| Press on a shift block | Selects that shift as before; no drawing. |
| Touch | No drawing: the calendar scrolls. `Add shift` stays the touch and keyboard way to add. |

The preview is `aria-hidden`; the gesture is a pointer shortcut to the same addition.

## Add shift sheet (`AddShiftSheet`)

Opened over the section: on the right on desktop, from the bottom on mobile, like `ShiftPanel`. It is
not reflected in the address; a reload or leaving discards it.

| State | Shows |
|---|---|
| Open | Title "Add shift". Description "Plan a new shift for {vessel}: its period, its responsible, and the resources it will use." On an active discharge, the description drops "and the resources it will use" and adds "It takes no resources while the discharge is under way.". Fields: Responsible (combobox, eligible responsibles), Duration hint, Planned start, Planned end, then on a planned discharge only: Weighing areas, Warehouse doors, Trucks, with the same rows, locked notes, and empty-state links (`Go to product lots`, `Go to truck pool`) as the shift correction. Footer: `Add shift` submit. |
| Client rule broken | Inline field errors from `addShiftRulesSchema`: end not after start on `plannedEndAt`; overlap with the period of the overlapped shift on `plannedStartAt`; on an active discharge, "A new shift must start after {period of the latest started shift}" on `plannedStartAt`. Checked on submit, then on change. |
| Saving | Submit shows `WRITE_PENDING_LABELS.create`; a second submit is ignored. The generated `id` is unchanged. |
| 201 / 200 | Detail cache replaced by the response. Toast "Shift added". Sheet closes; `shiftSearch(id)` opens the new shift's panel; the calendar scrolls to it. |
| 422 | Field errors mapped with `applyValidationError`; refused resources listed per group, as the correction does (`listRefusals`); the refusal alert takes focus. Every value is kept. |
| 409 `E_DISCHARGE_NOT_PLANNED` | Toast "This discharge has started". Detail refetched. The sheet stays open on the now-active discharge: resource fields disappear and their values are cleared, while the period and responsible are kept. The next save sends no resource. |
| 409 `E_DISCHARGE_CLOSED` | Toast "This discharge is closed". Detail refetched. Sheet closes. |
| 404 `E_DISCHARGE_NOT_FOUND` | Same handling as every preparation form: toast and close. |
| 409 `E_SHIFT_ID_CONFLICT` / network / 5xx | Toast "Unable to add the shift" with the API message, as the correction and every preparation form report a failure that no field owns; sheet stays open, values kept; save can be retried with the same `id`. The client rules leave out a shift carrying that `id`, so a retry after a lost response still reaches the API as a replay. |

## Shift details: readiness block (`ShiftReadiness`)

Rendered in `ShiftDetails` between the period fields and the resource groups, only when
`shift.readinessGaps !== null`.

| `readinessGaps` | Content |
|---|---|
| `[]` | Heading "Readiness", text "Nothing missing among trucks, warehouse doors, weighing areas, and responsible." |
| non-empty | Heading "Readiness", a warning list with one item per code, in order: "No usable truck", "No usable warehouse door", "No usable weighing area", "Responsible is no longer eligible". For a viewer with `canCorrect` (preparer on a planned discharge), `Go to truck pool` is shown when the discharge holds no truck. The block offers no `Edit` of its own: the panel footer's `Edit` already opens the correction. |

No wording anywhere states that a shift or discharge is "ready" or "can start". The resource groups
below keep showing suspended and archived resources with their markers, so a gap can be traced to
them.
