# Research: Planned Shifts Week Calendar

Every decision below was made by comparing the current Shifts tab (`apps/web/src/features/discharges/`)
with the retained V2 boards of the design reference (*Shifts — calendrier*, *Panneau shift*,
*Edit shift*, *Add shift*, *Active — Shifts*, *Active — panneau shift*, *Closed — Shifts*). No
technical unknown remained open after this pass.

## R1. What already exists and what changes

- **Decision**: Restyle the existing components in place. Do not rebuild the calendar.
- **Rationale**: `shift-calendar.ts` already computes columns (a week at least), cut segments,
  breaks with durations, the Expected start and Now positions, and drawing. `ShiftCalendar`, `ShiftPanel`,
  `ShiftEditPanel`, and `AddShiftSheet` already deliver every flow the spec names. The V2 gap is
  presentation: a summary line, a legend, a shorter hour height, card and pill styling, panel header
  and footer, and sheet field layout.
- **Alternatives considered**: A new calendar component. Rejected because it would duplicate tested
  geometry (DST handling, midnight cuts, drawing snap) for no behavioral gain.

## R2. Summary line wording per discharge status

- **Decision**: A pure adapter `shiftsSummary(discharge)` in `shift-calendar.ts` returns the summary
  text segments and the gap total, by discharge status:
  - planned: `N shift(s) · <total> planned · <dd/MM HH:mm> → <dd/MM HH:mm>`
  - active: `N shift(s) · X completed · Y active · Z planned · ends <Ddd D Mmm>, <HH:mm>`, leaving out
    status counts that are zero
  - closed: `N shift(s) completed · <total> · <range>`
  - gap total: the sum of `readinessGaps.length` over planned shifts, shown in amber when > 0, on
    planned and active discharges.
- **Rationale**: Wording is taken verbatim from the three boards. A pure adapter is the AGENTS.md unit
  test seam ("unit tests cover pure adapters").
- **Total duration**: the sum of the shifts' planned durations (not the span), formatted like
  `formatShiftDuration` ("40 h", "7 h 30 min").
- **Alternatives considered**: Computing the summary inside the component. Rejected because it is not
  unit-testable and mixes wording with layout.

## R3. Hour height and vertical fit

- **Decision**: Lower `HOUR_HEIGHT_PX` from 32 to 20 (a 480 px day), as on the boards.
- **Rationale**: SC-004 asks for a full day without vertical scrolling at 1440 × 900. The shell
  header, record header, and tabs leave about 560 px. `blockRowCount` still fits all four lines in a
  6-hour or longer shift (120 px), and the time range always shows.
- **Alternatives considered**: Fitting the height to the viewport. Rejected as needless complexity.
  The fixed height matches the design.

## R4. Shift card content and status

- **Decision**: Keep the four lines in order (times and duration; status badge or gap badge;
  responsible; counts). Restyle them to V2: a 13 px semibold time, a muted duration, and an amber pill
  "N gap(s)" with a warning icon that replaces the status badge when the planned shift has gaps. The
  card keeps its amber border (`border-warning`, 2 px).
- **Rationale**: The planned board shows the gap pill in the status slot. The active and closed boards
  show status badges. The spec keeps the status on gap-free planned cards (Assumptions).
- **Accessible name**: `Shift <day> <times>` plus `, N gap(s)` when there are gaps (spec FR-018). The
  current name uses `formatShiftPeriod`, which already includes the day.

## R5. Continuation of a shift past midnight

- **Decision**: The continuation piece reads `<start>–<end> (cont.)`, then the lines its primary piece
  could not fit, using the continuation's own height. It stays decorative (`aria-hidden`), and the
  primary piece remains the shift's only control.
- **Rationale**: On *Active — Shifts*, a 22:00–06:00 shift shows its status in the 2-hour first piece
  and its responsible and counts in the continuation. Keeping one control preserves the tested
  behavior "keeps one control for a shift cut across two columns" and keyboard order.
- **Deviation noted for review**: In the board the continuation is also a link. Here a click on it
  does nothing, as today.

## R6. Breaks, Expected start, Now

- **Decision**: The break pill reads the duration only ("16 h") with the coffee icon, on the existing
  hatched fill, and keeps its tooltip with the times. The stacked list (narrow screens) and the
  screen-reader text keep "16 h break". The Expected start line keeps the `primary` dashed border and
  `indicator` label. The Now line keeps `destructive` (red on the board), gains a dot at its left end
  and a label `Now HH:mm`.
- **Rationale**: Matches the boards. Red for Now is the board's choice. Since the Now line is a status
  of time rather than an accent, it stays within the AGENTS.md colour rule.

## R7. Legend

- **Decision**: A legend on the summary row, from `md` up: a dashed indicator swatch "Expected
  start", a hatched swatch "Inter-shift break", and the three resource icons with their names. It is
  hidden on narrow screens, where the stacked list has no calendar.

## R8. Shift panel

- **Decision**:
  - Title: `formatShiftPeriod(shift)` without the "Shift " prefix ("Sun 27 Sept 06:00 – 14:00").
  - Description: the status badge, then `Shift <i> of <n> · <vesselName>`, where `i` is the shift's
    index in `discharge.shifts` (already in planned order) plus 1.
  - Trucks group: registrations as compact chips without per-truck period lines, when every truck has
    the same in-effect period. The group then ends with one line: "All resources since <date>" when
    every in-effect resource of the shift (trucks, doors, areas) shares that `effectiveFrom`, else
    "All trucks since <date>". When truck periods differ, or any truck period has ended, each truck
    keeps its own period line, as today.
  - Footer: planned and editable → Edit (unchanged). Completed → the muted text "A completed shift
    cannot be changed" and a Close button. Other cases → no footer, as today.
- **Rationale**: Boards *Panneau shift* ("All resources since…") and *Active — panneau shift* ("All
  trucks since…", "A completed shift cannot be changed", Close).
- **Alternatives considered**: Collapsing doors and areas the same way. Rejected because the boards
  keep "Since…" on each door and area.

## R9. Edit shift and Add shift sheets

- **Decision**:
  - `ShiftPeriodFields`: Responsible full width, then Planned start, Planned end, and a read-only
    Duration in a three-column row from `sm` up. Duration is a labelled output, not a paragraph.
  - `ShiftResourceChecklist`: the header count reads `<selected> of <rows> selected`.
  - `AddShiftSheet`: when the form opened without a drawn period and the discharge has shifts, the
    hint "Starts when the last shift ends, on <Ddd D Mmm> at <HH:mm>." is shown under the period while
    the planned start still equals the last shift's end. It disappears once the user changes it.
  - Titles, descriptions, Back to details, Cancel, Save and Add shift stay as today.
- **Rationale**: Boards *Edit shift* and *Add shift*. The live condition keeps the hint true.

## R10. Tokens and colour

- **Decision**: Use only existing « Marine sobre » tokens: `warning` for gaps, `primary`/`indicator`
  for the Expected start, `destructive` for Now, `muted`/`border` for hatching, `card` for surfaces.
  No new token is needed, because `--warning` exists in both themes (#946420 light, #d29f4e dark).

## R11. Verification

- **Decision**: Unit tests for `shiftsSummary`, the all-since rule, and the add-shift hint
  condition (pure). Feature tests (Vitest + Testing Library + MSW through the real router) extend
  `__tests__/detail/shifts.test.tsx`, `add-shift.test.tsx`, and `shift-edit.test.tsx`. There is no
  `apps/web/e2e` folder in this checkout, so browser verification is a manual run of the dev server
  against the seeded API, at 1440 × 900 and phone width, in light and dark (quickstart.md).
