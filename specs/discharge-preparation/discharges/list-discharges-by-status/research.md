# Research: List Discharges by Status

The spec has no open clarification. These are the technical decisions the plan rests on.

## R1. Where the status-specific values come from

**Decision**: Extend the existing `GET /api/v1/discharges` (`discharges.index`) response additively.
Every discharge gains `startedAt` and `expectedTonnage`; active discharges gain `activeShift` and
`nextShift`; planned discharges gain `startProblemCount`. The existing fields stay, so the search
(customer and product names) and the counts keep working unchanged.

**Rationale**: GH-61 deliberately reads the whole collection once and derives the three tabs and
their counts from it (spec Assumptions, repository comment on `list()`). Keeping one read keeps
switching tabs free of a new request and keeps the counts consistent with the rows.

**Alternatives considered**:
- One endpoint per status — rejected: three requests for what one read already answers, and the
  counts would need a fourth.
- Calling `GET /discharges/:id/start-check` from the browser for each planned row — rejected: N
  requests per page load, and a badge that appears after the row.

## R2. How the preparation badge counts problems

**Decision**: Extract the read-and-evaluate sequence of `CheckDischargeStartUseCase` (find plan,
read references, find active holders, `evaluateDischargeStart`) into one injectable
`DischargeStartEvaluator` in `app/discharges/start/`. The start check uses it unchanged; the list
use case calls it for each planned discharge, without locks, on one read connection, and keeps
`problems.length`.

**Rationale**: FR-012 requires the badge to agree with what the start dialog shows. Sharing the
exact evaluation is the only way that stays true as start rules evolve; a second, list-specific
readiness rule would drift.

**Alternatives considered**:
- A batched SQL evaluation of every planned discharge at once — rejected for now: it duplicates
  `discharge_start_rules.ts` in SQL. Planned discharges are a small subset (tens) of the ≤1,000
  discharges, so four indexed queries each fit SC-006's 2-second budget. If measurement shows
  otherwise, batching the evaluator's reads (`whereIn` on discharge ids) is the fallback and keeps
  the pure rules shared.
- Reusing `planned_shift_readiness` gaps — rejected: they cover shifts only, not archived
  references, held resources, or missing lots, so they would disagree with the start dialog.

## R3. Identifying the active and next shift

**Decision**: For active discharges only, read the shift in status `ACTIVE` (at most one, a domain
invariant) and the `PLANNED` shift with the lowest `sequence`, each with its responsible user.
Expose each as `{ id, sequence, plannedStartAt, plannedEndAt, responsible }`; the row renders
"Shift `sequence` / `shiftCount`".

**Rationale**: `sequence` is already the shift's 1-based position in planned-start order and is
kept contiguous by `discharge_preparation_rules` and `planned_shift_rules`, which is exactly the
"k / n" the design shows. `shiftCount` is already on the wire.

**Alternatives considered**: computing the position in the browser from a full shift list —
rejected: it ships every shift of every discharge to render one cell.

## R4. Expected tonnage

**Decision**: Sum the lots' `expectedQuantityTonnes` with `Decimal` in the list transformer and
send a fixed-3 string, as `DischargeDetailTransformer` does; render it with the existing
`formatTonnes`, which moves from `discharge-detail-view.ts` to `apps/web/src/helpers/` now that a
second screen uses it (its own comment asks for that).

**Rationale**: The web has no decimal arithmetic; summing on the server keeps the list and the
detail page identical to the thousandth.

## R5. Closure time

**Decision**: No wire field. The Closed cell always renders the muted placeholder (Clarification
Q1). #98 will add the recorded time to the response and the cell will show it.

**Rationale**: A field that is always `null` documents nothing and invites a fake value.

## R6. Customer cell

**Decision**: A `DischargeCustomers` cell renders the first two distinct customer names in
alphabetical order (`localeCompare`), then a « +N » trigger opening the existing shadcn `Tooltip`
with every name; the cell's accessible name lists every customer. The order is computed in the
browser from `productLots`, which already carries `customerName`.

**Rationale**: The data is already present; ordering is presentation.

## R7. Row opening and no-match

**Decision**: Keep GH-58's row click plus the vessel link (FR-007 is already met); add the trailing
Open chevron as decoration of that row. The no-match state gains the searched term and a Clear
search button that navigates with `search: ''` replaced, reusing `updateSearch`. No result counter
exists today; a feature test pins its absence.

## R8. Test seams

**Decision**:
- API unit: `DischargeStartEvaluator` is covered through the existing start-check tests (behavior
  unchanged); the list's shift selection is a pure helper with unit tests.
- API integration: `tests/integration/discharges/consultation/list.spec.ts` gains the new fields per
  status, and a parity test that a planned discharge's `startProblemCount` equals the length of its
  `start-check` problems.
- Web feature tests under `__tests__/list/` (MSW fixtures in `__tests__/support/fixtures.ts`):
  columns per tab, active/next shift cell, badge, customers « +N », no-match Clear search, counts
  unchanged by search.
- Browser: the existing discharges journey run against seeded data.
