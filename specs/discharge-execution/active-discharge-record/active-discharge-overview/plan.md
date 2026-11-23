# Implementation Plan: Active Discharge Overview

**Branch**: `feat/328-active-discharge-overview` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`specs/discharge-execution/active-discharge-record/active-discharge-overview/spec.md`, approved with
its assumptions on 2026-10-22.

## Summary

Make the active discharge record say what is happening now. The header shared with the planned
record carries Dock · Period · IMO · Expected tonnage on every tab; the Overview of an active
discharge shows, in order, the vessel comment, a « Current shift » card (the Active Shift, its
resources, and the next shift), the dock timeline with a Now line, and a Progress card. Other tabs
stay read-only except Add shift, and the Shifts calendar keeps highlighting the Active Shift.

The work is web-only: every value comes from the existing `discharges.show` payload, plus the dock
occupancy read planned by #323 for the other discharges on the dock. Pure view models derive the
card, progress, and timeline; thin React components render them.

## Technical Context

**Language/Version**: TypeScript 5 (Node 22 / browser)

**Primary Dependencies**: TanStack Start + Router + Query, shadcn/ui on the « Marine sobre » tokens,
Tuyau typed client; AdonisJS 6 on the API side only if the dock occupancy read has not merged

**Storage**: N/A (no schema change)

**Testing**: Vitest unit tests for pure view models; Vitest + Testing Library feature tests through
the real router with MSW; Japa for the API read only if implemented here

**Target Platform**: Web workbench, desktop and phone widths

**Project Type**: Web application (PNPM/Turbo monorepo: `apps/api`, `apps/web`)

**Performance Goals**: Overview renders from the cached show query with one extra occupancy request;
no timers

**Constraints**: No new business rule or permission (FR-017); colour never the only signal; 375 px
width without horizontal scroll for the Current shift card

**Scale/Scope**: One record page; up to ~20 shifts and a handful of discharges per dock

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status |
|-----------|--------|
| I. Selected feature intent is versioned | ✅ Spec for #328 under `specs/discharge-execution/active-discharge-record/active-discharge-overview/` |
| II. One deliverable per spec | ✅ One outcome: the active record's header and Overview |
| III. Human gates | ✅ Spec reviewed and approved; this plan stops for review before tasks |
| IV. Test-first | ✅ View models RED→GREEN in unit tests; each user story starts with a failing feature test |
| V. Deep boundaries | ✅ Transport→view translation in `active-discharge-view.ts`; components render only; API untouched (or the #323 slice exactly as its contract) |
| VI. Durable knowledge | ✅ Domain term Active Shift kept in code; no `CONTEXT.md` change; the « Current shift » label is a UI label (research D3) |
| VII. Verification | ✅ `pnpm check`, `pnpm typecheck`, `pnpm test`, browser flow, fresh Claude Code review before ready |
| VIII. One workflow owner | ✅ No orchestration added |

Post-design re-check: unchanged, all pass. Two documented spec deviations (research D5, D6) are
raised for plan review rather than silently applied.

## Project Structure

### Documentation (this feature)

```text
specs/discharge-execution/active-discharge-record/active-discharge-overview/
├── spec.md
├── plan.md              # This file
├── research.md          # Decisions D1–D10
├── data-model.md        # View models
├── quickstart.md        # Validation guide
├── contracts/
│   └── active-record-ui.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
apps/web/src/features/discharges/
├── active-discharge-view.ts            # NEW pure: activeShiftSummary, dischargeProgress
├── discharge-detail-view.ts            # + dischargePeriod (shared with #324, if not already there)
├── dock-timeline.ts                    # NEW or from #324: pure lane/block layout, ACTIVE states, Now, overrun
├── queries/discharge-queries.ts        # + dock occupancy query (or from #323/#324)
├── ui/detail/
│   ├── discharge-detail-header.tsx     # facts line → Dock · Period · IMO · Expected tonnage (or from #324)
│   ├── discharge-detail-tabs.tsx       # Overview composition per status
│   ├── vessel-comment.tsx              # NEW or from #324: comment block on Overview
│   ├── active-shift-card.tsx           # NEW « Current shift »
│   ├── discharge-progress-card.tsx     # NEW « Progress »
│   ├── dock-timeline.tsx               # NEW or from #324: renders DockTimeline
│   └── discharge-identity-card.tsx     # no longer rendered for ACTIVE (removed if #324 removed it)
└── __tests__/
    ├── active-discharge-view.test.ts   # NEW unit
    ├── dock-timeline.test.ts           # NEW unit (active states), or extends #324's
    └── detail/
        ├── active-overview.test.tsx    # NEW feature: card, timeline, progress, order
        ├── active-header.test.tsx      # NEW feature: header facts on every tab, no actions
        ├── active-read-only.test.tsx   # NEW feature: tabs read-only, Add shift by role, calendar highlight
        └── identity.test.tsx           # updated for the new header facts

apps/api/app/discharges/dock_occupancy/  # ONLY if #323 has not merged: exactly its contract
```

**Structure Decision**: Web feature slice `features/discharges`, following `apps/web/AGENTS.md`:
pure adapters with unit tests, UI under `ui/detail/`, feature tests under `__tests__/detail/` with
MSW and the existing `support/fixtures.ts`. Files marked « or from #324/#323 » are reused when those
branches have merged at implementation time (research D2).

## Delivery order

1. Rebase on `master`; record which of #323 / #324 / #327 have merged.
2. **US2 header** (P1): shared Period helper and header facts; remove the facts card on active.
3. **US1 Current shift card** (P1): `activeShiftSummary` then the card, including the between-shifts
   state and markings.
4. **US3 dock timeline** (P2): occupancy query, active block states, Now, overrun.
5. **US4 progress and tabs** (P3): `dischargeProgress`, the card, and read-only / calendar tests.
6. Polish: phone width, accessibility names, `pnpm check`, `pnpm typecheck`, `pnpm test`, browser
   flow, fresh review.

## Plan review points

1. **Ordering with #323/#324** (research D2): build on them if merged, otherwise implement the shared
   header, timeline, and occupancy read to their contracts here. Alternative: wait for #324 to merge
   first.
2. **Progress card copy** (research D5): follow the design's three rows and drop the spec's
   « unloaded quantities are not available yet » sentence (FR-012, US4-1).
3. **Completed Shift actual end** (research D6): use the planned end until shift completion exposes
   an actual end (affects FR-008, FR-010).

## Complexity Tracking

No constitution violation to justify.
