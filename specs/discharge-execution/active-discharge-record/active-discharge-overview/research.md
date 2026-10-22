# Research: Active Discharge Overview

Inputs: [spec.md](./spec.md) (approved with its assumptions), issue #328, the design canvas
boards `v2/discharges/discharges-retenue-active-{overview,shifts,shift-panel,product-lots,truck-pool}`
(read 2026-10-22), the current web discharge record, the API's `discharges.show` payload, and the
sibling plans for #323 (dock occupancy read) and #324 (planned header and dock timeline).

## Decision 1 — The record reads only what `discharges.show` already returns, plus dock occupancy

- **Decision**: The Active Shift card, the header Period, the Progress card, and the discharge's own
  lane on the timeline are derived in the web app from the existing `discharges.show` payload
  (`startedAt`, `expectedTonnage`, `vesselImo`, `vesselComment`, `productLots`, `truckPool`,
  `shifts[]` with `status`, planned period, `actualStartAt`, `responsible`, and resource periods).
  The other discharges on the dock come from the dock occupancy read introduced by #323
  (`GET /api/v1/discharges/dock-occupancy?dockId=`). No other API change.
- **Rationale**: FR-017 forbids new business rules. Every field the design shows is already in the
  payload except other discharges' periods, which #323 already plans as a dock-scoped read meant to
  be reused by #324 and here.
- **Alternatives considered**: A dedicated "active overview" endpoint — rejected, it duplicates the
  show payload and puts presentation choices in the API. Embedding occupancy in `discharges.show` —
  rejected, #323 already decided a separate dock-scoped read.

## Decision 2 — Ordering with #323 and #324: build on them, provide them only if absent

- **Decision**: Implementation starts by rebasing on `master`. If #324 (shared header with Period
  and IMO, dock timeline component) and #323 (dock occupancy read) have merged, this feature extends
  them: an `ACTIVE` variant of the header and timeline. If either has not merged, this feature
  implements the missing piece to the **same contract and file locations** those plans name, so the
  later branch adopts it instead of duplicating it, and leaves a note in the shared notes folder.
- **Rationale**: The approved spec says whichever lands first provides the shared piece. Waiting
  would block this issue on two others; building a parallel copy would leave two timelines.
- **Alternatives considered**: Hard dependency (implement only after #324 merges) — viable and the
  simpler review; it is the recommended order if the reviewer prefers it (see Plan review point 1).

## Decision 3 — The card is titled « Current shift »; the code says Active Shift

- **Decision**: The visible title is « Current shift », with the Active status badge, as the
  design shows. Code, test names, and view models use the domain term `activeShift`.
- **Rationale**: The spec left the title to the design reference. `CONTEXT.md` governs domain
  vocabulary in the model; a UI title chosen by product design is a label, not a new domain term.
- **Alternatives considered**: « Active shift » as title — closer to `CONTEXT.md`, but diverges from
  the retained design and from the truck pool's « Current shift » tag.

## Decision 4 — Period on an active discharge

- **Decision**: `Period = startedAt → latest plannedEndAt among its shifts`, formatted
  `14/09/2026, 06:00 → 18/09/2026, 22:00`, as in the design. For a planned discharge #324 uses
  `expectedStartAt → latest plannedEndAt`; the shared helper takes the status into account.
- **Rationale**: Matches the spec assumption and the design exactly.

## Decision 5 — Progress card follows the design's three summary rows

- **Decision**: The Progress card, subtitled « Read-only while active, except adding shifts »,
  shows three rows, each linking to its tab:
  - **Shifts**: `n shifts · c completed · a active · p planned`, then « Ends <day> at <time> as
    planned » (the latest planned end).
  - **Product lots**: `n lots · k customers · <expected tonnage>`, then how many lots hold a
    warehouse door now (with the door names) and how many hold none.
  - **Truck pool**: `n trucks held`, then the released trucks with their release time (« 1 released
    on 14/09/2026, 12:00 (CC-303-PF) »), when any.
- **Rationale**: FR-012 asks for expected tonnage and completed shifts out of total; the design shows
  both and more, all from the show payload. The spec's extra sentence « unloaded quantities are not
  available yet » does not appear in the retained design.
- **Spec deviation to confirm at plan review**: drop the « unloaded quantities are not available
  yet » sentence from FR-012 / US4-1, so the card matches the design until #111 adds figures.

## Decision 6 — A Completed Shift's actual end is not available yet

- **Decision**: The schema has no shift `actualEndAt` (shift completion is not implemented). Where
  the spec names « the last Completed Shift with its actual end » (FR-008, US1-4) and places
  Completed Shifts « at their actual periods » (FR-010), the record uses the actual start and the
  planned end until shift completion exposes an actual end. The view model reads an optional
  `actualEndAt` so the later feature only has to add the field.
- **Rationale**: FR-017 forbids adding the field here; the "between shifts" state cannot occur in
  real data until shift completion ships, but the view must still be correct when it does.
- **Spec deviation to confirm at plan review**: accepted as a documented limitation.

## Decision 7 — The Shifts calendar already highlights the Active Shift

- **Decision**: Keep the existing behavior: `shift-calendar.tsx` gives the `ACTIVE` block its own
  border and fill and a status badge (colour is never the only signal) and draws a Now line on an
  active discharge. This feature adds a feature test proving FR-015 and adopts #327's calendar if it
  has merged by then.
- **Rationale**: No new code is needed for FR-015; a test pins it.

## Decision 8 — Read-only tabs already hold; nothing new to disable

- **Decision**: `canCorrect` is already `canPrepare && status === 'PLANNED'` and `canAddShifts`
  already allows `ACTIVE` for preparers. This feature adds feature tests for FR-013/FR-014 and does
  not restyle Product lots or Truck pool (owned by #325 and #326).

## Decision 9 — Now

- **Decision**: Now is the client clock when the record renders; it moves on refetch and re-render,
  not on a timer. The timeline window covers the discharge's period (actual start to latest planned
  end, extended to Now if Now is later), widened to whole days.
- **Rationale**: Live updates are out of scope (#113); the existing calendar already reads
  `new Date()` the same way.

## Decision 10 — Tests

- **Decision**: Unit tests (Vitest, no React) for the pure view models in `active-discharge-view.ts`
  and the timeline layout; feature tests through the real router with MSW for the Overview,
  header, tabs, and permissions, in `features/discharges/__tests__/detail/`. No e2e suite exists
  in `apps/web`; the browser flow is checked by hand per [quickstart.md](./quickstart.md).
