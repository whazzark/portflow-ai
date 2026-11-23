# Implementation Plan: Truck pool floating bulk actions

**Branch**: `feat/326-truck-pool-floating-bulk-actions` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/truck-pool-floating-bulk-actions/spec.md`

## Summary

Restyle the planned discharge's Truck pool tab to the retained V2 design, entirely inside
`apps/web`. The `Withdraw (n)` header button gives way to a floating selection bar that sticks to
the bottom of the content column while the pool is in view, states « n trucks selected », and offers
Clear and Withdraw. Above the table, a summary line (« n trucks reserved · n suspended ») and,
when any held truck is contested, an « Also held by » hint. The per-row warning icon becomes a
click/keyboard popover instead of a hover tooltip, and the table gains a Shifts column. The
withdrawal confirmation adopts the V2 copy (naming the discharge and the number of shifts), and the
Add trucks sheet groups candidates by transport company with per-group « n of m » counts and inline
« Held by … » text.

No API, contract, or persistence change: every fact shown is already in the discharge detail and
truck-candidate reads. Reservation and withdrawal requests, refusal handling, and permissions are
reused unchanged.

The floating bar is introduced as a small presentational primitive in `components/lifecycle`
so the reference workbenches being restyled in #318/#319 can adopt the same bar later; this slice
does not touch `BulkResourceLifecycleActions` to avoid colliding with them (see
[research.md](./research.md) R1).

## Technical Context

**Language/Version**: TypeScript on the repository's Node.js ESM runtime (`apps/web` TanStack Start)

**Primary Dependencies**: React 19, TanStack Router/Query 5, shadcn on Base UI primitives
(`Popover`, `AlertDialog`, `Sheet`, `Checkbox`, `Table`), Tailwind CSS 4, lucide-react

**Storage**: N/A — no persisted state; the selection is transient component state.

**Testing**: Vitest with jsdom, Testing Library, and MSW through the real router
(`renderDischargeTab`, `mockTruckPlanning`); unit tests for pure view helpers in
`truck-pool-selection.ts`. No API tests (no API change). No Playwright suite exists for this flow.

**Target Platform**: Authenticated responsive web workstation (desktop first, usable at phone width)

**Project Type**: PNPM/Turbo monorepo web application; this slice touches `apps/web` only

**Performance Goals**: Pools of a few dozen trucks; derived counts are linear in pool size and
computed per render without memoisation concerns.

**Constraints**: V2 « Marine sobre » tokens only (no hardcoded colors), light and dark themes,
keyboard and screen-reader operable bar and popover, no horizontal page scroll at phone width.

**Scale/Scope**: One tab of one screen: the truck pool card, its withdraw dialog, its add sheet,
the holdings indicator, and one new shared presentational component.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Selected feature intent is versioned | PASS | #326 selected; spec in its feature directory. |
| II. One deliverable per spec | PASS | One outcome: the V2 planned truck pool. Active/closed pools stay with #328/#329. |
| III. Vanilla gates | PASS | Spec reviewed by the operator before this plan; plan review pending before tasks. |
| IV. Test-first | PASS | Each story starts with failing feature tests through the real router; view helpers get unit tests first. |
| V. Deep boundaries | PASS | Counts and grouping live in pure helpers (`truck-pool-selection.ts`); components render them. No API shortcut. |
| VI. Durable knowledge | PASS | Uses CONTEXT.md terms (Truck Pool Withdrawal, Suspended Truck). No new vocabulary, no ADR needed. |
| VII. Verification | PASS | `pnpm check`, `pnpm typecheck`, `pnpm test`, manual browser check of the tab in both themes and at phone width, fresh review before ready. |
| VIII. One workflow owner | PASS | No orchestration added. |

Post-design re-check: PASS — design adds one presentational primitive and pure helpers; no
violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/truck-pool-floating-bulk-actions/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1 (derived view state; no persisted data)
├── quickstart.md        # Phase 1
├── contracts/
│   └── ui-state.md      # Phase 1 (UI contract: roles, names, copy)
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
apps/web/src/
├── components/lifecycle/
│   └── floating-selection-bar.tsx            # NEW: presentational sticky bar (count, actions, Clear)
└── features/discharges/
    ├── truck-pool-selection.ts               # + poolSummary, shiftCountByTruck, candidateGroups
    ├── ui/detail/
    │   ├── discharge-truck-pool-card.tsx     # summary line, hint, Shifts column, floating bar
    │   ├── truck-holdings.tsx                # Tooltip → Popover; + inline variant for the sheet
    │   ├── withdraw-trucks-dialog.tsx        # V2 copy: discharge name, shift count
    │   └── add-trucks-sheet.tsx              # grouped by company, « n of m », inline holdings
    └── __tests__/
        ├── truck-pool-selection.test.ts      # + helper unit tests
        └── detail/
            ├── truck-pool.test.tsx           # summary, hint, popover, Shifts column
            ├── withdraw-trucks.test.tsx      # floating bar journeys, V2 dialog copy
            ├── reserve-trucks.test.tsx       # grouping, « n of m », inline holdings
            └── truck-planning-stale-state.test.tsx  # bar count follows a refreshed pool
```

**Structure Decision**: Web-only change within the existing `features/discharges` vertical slice.
The one cross-feature piece (the floating bar) goes under `src/components/lifecycle`, where
apps/web/AGENTS.md files shared bulk-action primitives.

## Complexity Tracking

No constitution violations.
