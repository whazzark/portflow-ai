# Research: Wider Creation Wizard With a Shift Preview

Inputs: [spec.md](./spec.md), the V2 artboards « Étape 3 — Planned shifts » and « Étape 3 —
plusieurs shifts » of the design canvas, and the current code of `apps/web/src/features/discharges`
and `apps/api/app/discharges`.

One spec correction came out of planning. FR-007 said « free from » is the end of the latest
occupancy *ending* at or before the expected start. When an occupancy straddles the expected start,
that wording names an earlier end and claims the dock is free while it is not. FR-007 now uses the
latest end among occupancies that *start* before the expected start. Call this out at plan review.

## Decision 1 — Where dock occupancy comes from

- **Decision**: Add one read-only endpoint, `GET /api/v1/discharges/dock-occupancy?dockId=<uuid>`.
  It answers every planned or active discharge assigned to that dock that has at least one shift.
  Each item carries the discharge's id, vessel name, and status, plus an occupancy start and end.
  The start is the earliest `planned_start_at` of its shifts and the end is the latest
  `planned_end_at`. Items are ordered by start, then id.
- **Rationale**:
  - `GET /discharges` carries only `expectedStartAt` and `shiftCount`. Deriving occupancy there
    would mean one detail read per discharge on the dock.
  - Planned and active discharges on one dock are few, so the answer needs no time window or
    pagination. The client clips to its own period (spec Edge Cases).
  - One aggregate query (`min`/`max` over `shifts`, grouped by discharge) answers it, so no shift
    rows are loaded.
  - #324's Overview dock timeline needs the same data. A dock-scoped read that does not depend on
    the discharge being created serves both.
- **Alternatives considered**:
  - **Extend `GET /discharges` with each discharge's planned period.** This widens a list
    transformer whose comment deliberately keeps rows lean, and the wizard would still fetch every
    discharge on site to keep one dock's.
  - **`GET /docks/:id/occupancy` in the docks slice.** Docks are a site-reference slice. Occupancy
    is derived from discharges and authorized as discharge browsing, so it belongs to the
    discharges slice.
  - **Filter by a time window.** Unneeded at this volume, and it would couple the API to the
    preview's sizing rule.

## Decision 2 — Who may read occupancy

- **Decision**: Authorize with `DischargePolicy.list`, which lets every ACTIVE user read it.
- **Rationale**:
  - FR-019 requires that creators can read occupancy. Every active role can already browse every
    discharge with its dock and expected start, and occupancy reveals nothing beyond the planned
    shift periods the detail already shows to the same roles.
  - Reusing `list` keeps #324, which is read by every role, on the same endpoint.
- **Alternatives considered**: `DischargePolicy.create`. It would lock out observers from a read
  they can reconstruct anyway, and would force #324 to add a second ability.

## Decision 3 — What counts as occupancy

- **Decision**:
  - A discharge counts when its status is `PLANNED` or `ACTIVE` and it has at least one shift with
    both planned instants.
  - The span covers all of its shifts, whatever their own status (`PLANNED`, `ACTIVE`, or
    `COMPLETED`).
  - Closed discharges never count.
- **Rationale**:
  - This matches the spec's Key Entities and the « planned period » the footer and V2 header already
    use (`plannedCoverage`).
  - An active discharge's completed shifts are still part of its planned period.
  - A discharge without shifts has no span to draw. Creation requires at least one shift, so this
    case only arises from data predating that rule.
- **Alternatives considered**: Using actual execution times for active discharges. This is out of
  scope (spec Assumptions); no execution slice records actual ends yet.

## Decision 4 — Preview period sizing

- **Decision**: The preview is laid out by a pure module, `shift-preview.ts`, at day granularity in
  the browser's zone. This is the zone `shiftCalendar` and the date fields use.
  - **First day**: the day before « free from » when there is one. Otherwise it is the earlier of
    the expected start's day and the first shift's day.
  - **Last day**: the latest of the expected start's day and the last shift end's day. A shift
    ending at midnight does not reach the next day.
  - **Padding**: when the span is shorter than 7 days, days are added after it until it is 7 days
    long (FR-009's one-week minimum).
  - **Clipping**: occupancies that intersect the period are clipped to it, and others are dropped.
- **Rationale**:
  - The window shows the dock freeing up and the whole planned period, as the artboards do.
  - Padding only forward keeps the « free from » context day as the first column.
  - The artboards' exact first day (one or two days of context) differs between the two states, so
    a single deterministic rule is preferred to matching both pixel for pixel.
- **Alternatives considered**: Reusing `shiftCalendar`. It lays out a vertical week with hour
  gutters, midnight-cut pieces, and per-column percentages. The preview is a horizontal strip with
  whole-period percentages and no midnight cutting, so sharing it would twist both.

## Decision 5 — How shifts and breaks are drawn

- **Decision**:
  - Each shift with a valid period (end after start, the rule `plannedCoverage` uses) becomes a
    block numbered by its form position.
  - Breaks are the gaps between consecutive blocks after sorting by start. They are measured from
    the latest end so far, so overlapping shifts produce no break. Breaks are drawn as visible gaps;
    no duration label is needed (spec Assumptions).
  - Shifts without a valid period produce one « Shift n · no period yet » placeholder each, placed
    at the expected start, and never a period (FR-014).
  - The row label reads « n shifts · h h », counting only valid periods and summing their durations.
- **Rationale**: This follows the artboards, and the gap rule already used by `shiftCalendar`'s
  breaks.

## Decision 6 — Data flow in the wizard

- **Decision**:
  - `ShiftPreview` reads `dockId`, `vesselName`, `expectedStartAt`, and `shifts` from the form
    through `form.Subscribe`.
  - It queries `dischargeQueries.dockOccupancy(dockId)` with `staleTime: 0`. The step mounts only
    when it opens, so occupancy is read again on every opening (FR-019).
  - Loading draws the dock row as a skeleton.
  - An error shows an inline alert with « Retry » that calls `refetch`. The expected start and the
    shifts are still drawn (FR-017).
  - The preview never touches form validation or the footer's `isStepComplete` (FR-016).
- **Rationale**: This mirrors how `planningOptions` and `truckCandidates` refetch on opening.
  Subscribing to form state keeps the preview reactive (FR-015, SC-002) without lifting state.

## Decision 7 — Layout changes

- **Decision**:
  - Drop `max-w-5xl` (and `mx-auto`) from the form body, the footer row, and the pending skeleton,
    so the steps use the shell's content width (FR-001). Padding stays.
  - Remove the `md:hidden` « Step X of 3 » paragraph from `StepIndicator`. Step names stay
    visually hidden below `md`, as today (FR-002).
  - The footer is already sticky and already shows lots · tonnage · shifts · period and Cancel /
    Back / Next or Create (FR-003). It is kept and only widened.
  - Drop the sentence « A new shift starts when the last one ends. » from the Planned shifts
    description (FR-005). The behavior of `nextPlannedShift` is unchanged.
  - The preview is a normal-flow `section` above the Planned shifts card (FR-006, Story 3).
  - The track has a minimum width per day and scrolls horizontally inside its own box below that
    width.
- **Rationale**: These are the smallest changes that meet the V2 artboards. The step machinery,
  validation, and refusals stay untouched (Story 2, scenario 5).

## Decision 8 — Accessibility

- **Decision**:
  - The preview is a `section` labelled « Shift preview ».
  - Each row is a list of blocks.
  - Each block has accessible text, for example « MV Nordic Breeze, holds the dock until Sun 20
    Sept, 14:00 » or « Shift 2, Tue 22 Sept, 14:00 → 22:00 ».
  - The Expected start marker has the text « Expected start Tue 22 Sept, 06:00 ».
  - Other discharges use a solid filled block and planned shifts a dashed outline, so they differ by
    more than color (FR-018).
  - Purely decorative day separators are `aria-hidden`.
- **Rationale**: This follows the spec, and the existing calendar's labelled-region pattern.

## Decision 9 — Testing

- **Decision**:
  - **API integration tests** for the new route:
    - 401 when signed out and 403 for an inactive user.
    - 422 for a missing or malformed `dockId`.
    - Planned and active discharges are included; closed ones and those on other docks are excluded.
    - The span is the min and max over all shift statuses, and the order is start, then id.
    - Each role can read it.
  - **API unit tests**: the policy is reused, so only the use case and transformer shape need
    covering.
  - **Web unit tests** for `shift-preview.ts`: sizing, padding, clipping, « free from », numbering,
    breaks, overlaps, no-period placeholders, totals, and a clock-change day.
  - **Web feature tests** in `__tests__/create/shift-preview.test.tsx`, using MSW for the new route:
    preview order, live updates, dock change, empty dock, error and retry, no footnote, and many
    shifts.
  - Update `__tests__/create` assertions on the stepper.
- **Rationale**: This follows the repository's Japa and Vitest/MSW seams. Playwright is not set up
  in `apps/web`, so scroll-under-footer behavior is verified through `quickstart.md`.
