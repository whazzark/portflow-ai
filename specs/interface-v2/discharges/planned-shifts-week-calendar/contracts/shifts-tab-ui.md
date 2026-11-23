# UI Contract: Shifts Tab (V2)

The feature exposes no API. This contract lists the observable texts, roles, and accessible names
the feature tests assert. Copy is English, as in the rest of the app.

## Summary row (wide and narrow)

| Discharge | Text (example)                                                                  |
|-----------|---------------------------------------------------------------------------------|
| planned   | `5 shifts · 40 h planned · 27/09 06:00 → 29/09 22:00` + amber `1 gap`           |
| active    | `14 shifts · 5 completed · 1 active · 8 planned · ends Fri 18 Sept, 22:00`      |
| closed    | `4 shifts completed · 32 h · 16/08 06:00 → 17/08 22:00`                         |

- The amber gap part has a warning icon (decorative) and text `N gap(s)`, so colour is not the
  only signal.
- Legend (from `md`): `Expected start`, `Inter-shift break`, `Trucks`, `Doors`, `Weighing areas`.

## Calendar (from `md`)

- Container: list `Shift calendar` (existing), one `button` per shift.
- Button accessible name: `Shift <formatShiftPeriod>` + `, N gap(s)` when the shift has gaps.
  Its description gives status, duration, responsible, and counts (existing).
- `aria-pressed` reflects the open shift (existing).
- Visible card lines: `HH:mm–HH:mm` with `· <duration>`; status badge or `N gap(s)` pill;
  responsible; three counts beside icons.
- Continuation piece: `HH:mm–HH:mm (cont.)`, decorative.
- Break pill: `<duration>`, tooltip `<times>` (existing), narrow list item `<duration> break`.
- Expected start: label `Expected start`. Now (active discharge): label `Now HH:mm`.

## Shift panel (`dialog`)

- Name: `<formatShiftPeriod>` (for example `Sun 27 Sept 06:00 – 14:00`).
- Description: status badge, `Shift <i> of <n> · <vessel>`.
- Fields: Responsible, Duration, Planned start, Planned end, then Actual start and Started by once
  started.
- Trucks group: chips, then `All resources since <dd/MM/yyyy, HH:mm>` or `All trucks since …` when
  shared (research R8).
- Footer: `Edit` (planned, allowed); `A completed shift cannot be changed` + `Close` (completed).

## Edit shift (in the panel) and Add shift (`dialog`)

- Duration: a read-only labelled output `Duration` showing `<duration>` (for example `8 h`).
- Each resource group header: `<selected> of <available> selected`, `Select all` (existing).
- Add shift hint: `Starts when the last shift ends, on <Ddd D Mmm> at <HH:mm>.`
- Titles, descriptions, actions, refusals, and toasts: unchanged.
