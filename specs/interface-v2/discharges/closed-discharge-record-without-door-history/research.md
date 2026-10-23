# Research: Closed Discharge Record Without Door History

Every unknown from the plan's Technical Context is resolved below. Findings come from the code on
`master` at `fddae051`, the sibling Interface V2 specs (#324, #328), and the design canvas page
**Discharges** (`discharges-retenue-closed-*` screens).

## R1. Does this feature need an API change?

- **Decision**: No. The feature is web-only and reads the existing discharge detail
  (`GET /api/v1/discharges/:id`).
- **Rationale**: The detail already carries everything the closed record shows: vessel name, IMO,
  comment, dock, expected tonnage, `startedAt`, product lots with their door assignments, the truck
  pool with `reservedAt`/`releasedAt`, and shifts with `plannedStartAt`, `plannedEndAt` and
  `actualStartAt`. The API already refuses every change to a closed discharge (`E_DISCHARGE_CLOSED`)
  and FR-017 forbids changing that.
- **Alternatives considered**: Adding `closedAt` to the detail now. Rejected: neither the
  `discharges` table nor the model has a closure time; recording it is Discharge Closure (#98),
  which owns that column and its contract.

## R2. Where does the Period end come from?

- **Decision**: The header Period reads `startedAt → closure time`. The closure time does not exist
  yet (R1), so the end renders as **Not recorded** for every closed discharge until #98 adds it to
  the detail. The view function takes the closure time as an optional input, so #98 only has to
  pass it.
- **Rationale**: FR-003 and the spec's edge cases: never invent a date. The design canvas shows a
  real end (`17/08/2026, 22:00`) because its scenario assumes closure is recorded.
- **Alternatives considered**: Using the last shift's planned end, or the latest truck release, as
  the end. Rejected: neither is the closure time, and the accepted spec forbids an invented end.
  **Review point**: in practice every closed discharge will read "Not recorded" until #98 ships.
- **Start**: `startedAt` when recorded; otherwise the earliest shift's actual start; otherwise
  **Not recorded**. Discharges started before the start actor/time was recorded exist in seeds.

## R3. What does the frozen dock timeline show, and how is it built?

- **Decision**: A new read-only `ClosedDockTimeline` component, fed by a pure
  `closedDockTimeline(detail)` view function. It shows:
  - a horizontal axis from the earliest shift start to the latest shift end, padded to whole local
    days, with one tick per day labelled like the shift calendar (`Sun 16 Aug`);
  - one block per shift, placed from `actualStartAt ?? plannedStartAt` to `plannedEndAt` (no actual
    end is recorded on shifts);
  - a **Started** marker at the Period start when it falls on the axis;
  - no Now line, no expected-start marker, no gaps, no blockers, no other discharges (FR-008).
  The same shifts are exposed to assistive technologies as a list of named periods.
- **Rationale**: #324 (planned) and #328 (active) will introduce a shared live dock timeline that
  depends on a dock-occupancy read (#323's planned `GET /discharges/dock-occupancy`). None of it is
  merged, and the closed record needs none of its live parts. A small frozen component keeps this
  slice independently deliverable; whichever dock timeline lands second can fold this one in.
- **Alternatives considered**: Reusing `ShiftCalendar` (the Shifts tab's week grid). Rejected: it
  is a weekly drawing/selection surface, not a period strip, and carries interaction this record
  must not have. Waiting for #324's component: rejected, it would block this slice.

## R4. What does the Summary card count?

- **Decision**: Three rows, each linking to its tab, following the design:
  - **Shifts**: `N shifts` (all shifts of the discharge).
  - **Product lots**: `N lots · N customers · <expected total>`, then the distinct warehouse doors
    the lots used (`Unloaded through Porte Nord and Porte Principale`) when there are any.
  - **Truck pool**: `N trucks` (distinct `truckId` in the pool), then `All released on <latest
    releasedAt>` when every entry has a release time.
  The card carries the note **Closed discharges are read-only**.
- **Rationale**: FR-009 requires the three counts; the extra lines use data already in the detail
  and match the canvas. Shift hours (`32 h` in the canvas) are left out: shifts record no actual
  end, so the total would be a planned figure presented as realized.
- **Alternatives considered**: Counting only completed shifts. Rejected: a closed discharge's shifts
  are all completed by definition (CONTEXT.md, Closed Discharge), so it would be the same number
  with a misleading qualifier.

## R5. How is the door history removed?

- **Decision**: `lotDoorCell` returns no history for a closed discharge, and `LotDoorChips` never
  renders the history popover for it. The `history` label variant (`'history'` / "Door history")
  becomes dead and is removed; the planned/active `N ended` popover stays (FR-016).
- **Rationale**: FR-010/FR-011. The chips already show each door once on a closed discharge; the
  `+N` overflow lists doors without periods and stays.
- **Alternatives considered**: Hiding the link in CSS or behind a flag. Rejected: the requirement
  is that no history is reachable (SC-002).

## R6. Header layout and vessel comment

- **Decision**: For a closed discharge, `DischargeDetailHeader` shows Dock · Period · IMO ·
  Expected tonnage (labelled, in that order) instead of Dock · Expected start · Started · Expected
  tonnage, with no actions. The vessel comment moves out of the identity card into a line under
  the header facts, rendered only when the Overview tab is open and the comment is non-empty.
  Planned and active headers are unchanged here.
- **Rationale**: FR-001–FR-005, FR-016. #324 and #328 will move planned and active headers to the
  same shape; this slice branches on status so it does not pre-empt them.
- **Merge risk**: #324/#328 edit the same header and Overview files. Whichever merges second
  rebases onto a shared header taking a `facts` list; noted in the plan's Complexity Tracking.

## R7. Read-only Truck pool and Shifts

- **Decision**: No behavior change; add regression tests. `canCorrect` is false for any non-planned
  discharge and `canAddShifts` is false for a closed one, which already hides selection, bulk
  actions, add/withdraw, the shift drawing surface, and shift editing.
- **Rationale**: FR-013–FR-015 hold today; tests pin them through the restyle.
