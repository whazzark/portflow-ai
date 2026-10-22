# Research: Show the Planned Discharge Header and Dock Timeline

## R1 — Where the timeline's other discharges come from

- **Decision**: Add `dockOccupations` to the discharge detail read and DTO, computed by
  `LucidDischargeRepository.findDetail` with one aggregate query (discharges on the same dock, status
  PLANNED or ACTIVE, other than this one, left-joined to shifts for `min(planned_start_at)` /
  `max(planned_end_at)`). Only for a PLANNED discharge.
- **Rationale**: The detail already carries `otherHoldings` for trucks under the same "what other
  discharges compete with this plan" reasoning, read by every role. Keeping it on the detail means
  every mutation that returns the detail (`applyDetail`) refreshes the timeline without new cache
  wiring, and the page stays one request. The list endpoint (`GET /discharges`) does not load shifts
  and has no dock filter, so the web cannot derive planned periods from it.
- **Alternatives considered**:
  - New `GET /discharges/:id/dock-occupations` endpoint — a second query to keep in sync after every
    mutation; no benefit for a field bounded by one dock.
  - Extend `GET /discharges` with shift periods and filter client-side — loads every discharge's
    shifts for one card, and widens the list's deliberately narrow DTO.

## R2 — The period of an occupation

- **Decision**: The API returns raw facts (`expectedStartAt`, `startedAt`, `plannedStartAt`,
  `plannedEndAt`); the web derives the drawn interval:
  - ACTIVE: from `startedAt` to `plannedEndAt` when it is later than `startedAt`; otherwise
    open-ended (drawn to the span's end, labelled "continues").
  - PLANNED with shifts: `plannedStartAt` → `plannedEndAt`.
  - PLANNED without shifts: a point at `expectedStartAt`, labelled "no shift planned".
- **Rationale**: Matches the spec's Planned Period assumption and its "no invented end" scenario.
  Keeping the derivation in a pure web module makes the edge cases unit-testable and leaves the API
  free of presentation rules.
- **Alternatives considered**: Computing intervals on the API — couples the DTO to one screen's
  drawing choices.

## R3 — Feeding the banner and keeping it current

- **Decision**: Reuse `dischargeQueries.startCheck(id)` (`staleTime: 0, gcTime: 0, retry: false`) from
  the page, enabled only for a PLANNED discharge viewed by a user who may start. Invalidate it in
  `applyDetail` and wherever the detail is invalidated after a stale refusal.
- **Rationale**: The start check is the authoritative list the Start dialog shows; reusing the same
  query key guarantees the banner and the dialog agree (SC-003). The endpoint is authorized by
  `DischargePolicy.start`, which `canPrepareDischarges` mirrors on the web, so no 403 is provoked for
  observers (FR-011, US2-8). Default `refetchOnWindowFocus` covers changes made by others (e.g. a dock
  becoming held).
- **Alternatives considered**:
  - Deriving problems on the web from the detail — duplicates the start rules (#56 owns them) and
    cannot see holders on other discharges.
  - Embedding start problems in the detail DTO — runs the start rules on every detail read for every
    role, and leaks start-only information to observers.

## R4 — Mapping problems to tabs

- **Decision**: `problemTabs(sections)` returns the set of `section.link.tab` from
  `startProblemSections(problems, detail)`. The Dock section maps to Overview.
- **Rationale**: The Start dialog already groups every problem code into Dock / Product lots / Truck
  pool / Shifts, including context-based cases (archived customer through a lot, held door through a
  lot). Reusing it keeps the dot and the dialog consistent by construction.

## R5 — Review opening the Start dialog

- **Decision**: Lift `StartDischargeAction`'s `open` state to `DischargeDetailPage` and pass
  `open`/`onOpenChange`; the banner's Review calls the same setter.
- **Rationale**: One dialog instance, identical behavior (FR-007, FR-022); focus return on close
  stays with the dialog's existing handling, and `onStarted` still focuses the heading.

## R6 — Vocabulary

- **Decision**: Do not add "Dock Occupation" or "Planned Period" to `CONTEXT.md` in this slice.
- **Rationale**: They are presentation terms of this screen, derived from Dock and Shift Planned
  Period, which `CONTEXT.md` already defines. If a later slice (e.g. #328) reuses them as business
  terms, it can promote them.

## R7 — Rendering the timeline

- **Decision**: Plain HTML + Tailwind with absolutely positioned items in percentage of the span;
  a visually hidden ordered list of the same events for screen readers; overlaps and gaps carry text
  labels. Span = this discharge's planned period (or expected start ± 12 h without shifts) padded by
  10 % of its length (minimum 2 h) on each side; Now drawn when inside, otherwise a "Now is before /
  after this period" note.
- **Rationale**: No chart dependency exists in `apps/web`; the content is a handful of intervals.
  Percentage positioning stays responsive; the card scrolls horizontally with a minimum width on
  phones (edge case "readable by scrolling within itself").
- **Alternatives considered**: A chart library (Recharts/visx) — new dependency for a static strip,
  weaker accessibility; reusing `shift-calendar` — a week grid, owned by #327's redesign.

## R8 — Testing seams

- **Decision**: API — extend `tests/integration/discharges/consultation/show.spec.ts` with factories
  for a held dock and a planned competitor; web — MSW feature tests through the real router
  (`renderDischargeTab`), plus Vitest unit tests for `dock-timeline.ts` and `plannedPeriod`. Fixtures
  default `dockOccupations: []` and the start-check handler to `{ problems: [] }`.
- **Rationale**: Follows `apps/api/AGENTS.md` and `apps/web/AGENTS.md`. Time-dependent assertions
  (Now) use Vitest fake timers with `shouldAdvanceTime`.
