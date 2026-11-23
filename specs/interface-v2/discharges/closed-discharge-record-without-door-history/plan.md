# Implementation Plan: Closed Discharge Record Without Door History

**Branch**: `feat/329-closed-discharge-record-without-door-history` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/interface-v2/discharges/closed-discharge-record-without-door-history/spec.md`

## Summary

Give the closed discharge record its Interface V2 shape, as a read-only record: a header with
Dock · Period · IMO · Expected tonnage, an Overview made of a frozen dock timeline and a Summary,
product lots that list the doors they used with no door history, and Truck pool and Shifts tabs
that stay read-only. The change is web-only: the existing discharge detail already carries every
fact shown (research R1), and the API's refusal of changes to a closed discharge is untouched.
New pure view functions derive the period, timeline, and summary; small components render them;
`lotDoorCell` and `LotDoorChips` lose the closed-discharge history.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19

**Primary Dependencies**: TanStack Start / Router / Query, shadcn/ui on Tailwind CSS, lucide-react

**Storage**: N/A (reads `GET /api/v1/discharges/:id`; no schema or contract change)

**Testing**: Vitest with Testing Library (`apps/web`), existing fixtures in
`apps/web/src/features/discharges/__tests__/support/fixtures.ts`

**Target Platform**: Modern desktop and mobile browsers, down to 375 px wide

**Project Type**: Web application (PNPM/Turbo monorepo: `apps/api` AdonisJS, `apps/web` TanStack Start)

**Performance Goals**: No new request; derivations are linear in shifts, lots and pool entries
(tens of items)

**Constraints**: No invented closure time (FR-003); no history reachable on a closed record
(SC-002); planned and active records unchanged (FR-016); accessible names for every new region,
list, and link

**Scale/Scope**: One route (`/discharges/$dischargeId`), four tabs, about 6 touched files and 3
new ones in `apps/web/src/features/discharges/`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Selected feature intent is versioned | Pass | Issue #329 selected; spec accepted by the user on 2026-10-22 |
| II. One independently deliverable feature | Pass | Web-only slice; does not wait for #324/#328/#98 (R2, R3) |
| III. Spec Kit gates | Pass | Spec reviewed; this plan stops for review before `/speckit-tasks` |
| IV. Test-first observable behavior | Pass | Each FR maps to a failing Vitest feature or unit test first (see Test strategy) |
| V. Deep boundaries | Pass | Transport-to-view translation stays in pure view functions; components only render; no API shortcut |
| VI. Durable knowledge | Pass | Uses CONTEXT.md terms (Closed Discharge, Shift, Truck Pool, Warehouse Door Assignment); no new domain term; no ADR needed |
| VII. Verification | Pass | `pnpm check`, `pnpm typecheck`, `pnpm test`, browser walkthrough in quickstart, fresh review before ready |
| VIII. One workflow owner | Pass | No new process artifacts |

Post-design re-check: unchanged, all pass.

## Design

### Header (FR-001–FR-005)

`DischargeDetailHeader` gains a closed branch: facts `Dock`, `Period`, `IMO`, `Expected tonnage`
in that order; the `Expected start` and `Started` facts are not shown; the page already passes no
actions when `canCorrect` is false. A new `vesselComment` slot under the facts renders only when
the page's open tab is Overview and the comment is non-empty; the identity card, which carried it,
is no longer shown on a closed record. Period comes from `closedRecordPeriod(detail)` (R2):
`startedAt` (fallback: earliest actual shift start) → closure time, each missing side `Not
recorded`.

### Overview (FR-006–FR-009)

For `CLOSED`, `DischargeDetailTabs` renders `ClosedDockTimeline` then `ClosedDischargeSummary`
instead of the identity card (the Preparation card is already planned-only).

- `closedDockTimeline(detail)` (pure) returns the axis, day ticks, shift blocks and the Started
  marker offsets per data-model.md, or `null` without shifts.
- `ClosedDockTimeline` draws a strip with percentage offsets, the day labels, and the blocks; it
  mirrors the blocks in a visually hidden list `Shifts on the timeline`. No timer, no Now.
- `closedDischargeSummary(detail)` (pure) returns the counts and lines of R4.
- `ClosedDischargeSummary` renders the three rows as links built with the existing `tabSearch`,
  plus the read-only note.

### Product lots (FR-010–FR-013)

`lotDoorCell` returns `history: []` for `CLOSED` and drops the `'history'` label variant;
`LotDoorChips` and `HistoryPopover` lose the "Door history" branch. `canCorrect` already removes
add, edit, row actions and door planning for non-planned discharges.

### Truck pool and Shifts (FR-014, FR-015)

No production change (R7); regression tests pin the read-only state.

### Test strategy (TDD order)

1. Unit (`__tests__/closed-discharge-record.test.ts`): `closedRecordPeriod`, `closedDockTimeline`,
   `closedDischargeSummary` — written first, red, then implemented.
2. Unit (`__tests__/discharge-detail-view.test.ts`): update the closed `lotDoorCell` case to expect
   no history.
3. Feature (`__tests__/detail/closed-record.test.tsx`): header facts and order, no actions, Period
   `Not recorded`, vessel comment only on Overview, timeline region and no Now, Summary rows and
   links, Product lots with no History, Truck pool and Shifts read-only.
4. Feature (`__tests__/detail/product-lots.test.tsx`): replace the closed "Door history" test with
   the no-history assertion; keep the active `N ended` test (FR-016).
5. Existing `identity.test.tsx` and `tabs.test.tsx` cases for closed discharges are adjusted where
   they asserted the identity card or the old header facts.

## Project Structure

### Documentation (this feature)

```text
specs/interface-v2/discharges/closed-discharge-record-without-door-history/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── ui-state.md      # Phase 1: observable UI contract
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
apps/web/src/features/discharges/
├── closed-discharge-record.ts              # NEW: closedRecordPeriod, closedDockTimeline, closedDischargeSummary
├── discharge-detail-view.ts                # lotDoorCell: no closed history
├── __tests__/
│   ├── closed-discharge-record.test.ts     # NEW (unit)
│   ├── discharge-detail-view.test.ts       # updated closed lotDoorCell case
│   └── detail/
│       ├── closed-record.test.tsx          # NEW (feature)
│       ├── product-lots.test.tsx           # closed history test replaced
│       ├── identity.test.tsx               # closed cases adjusted
│       └── tabs.test.tsx                   # closed cases adjusted if needed
└── ui/detail/
    ├── closed-dock-timeline.tsx            # NEW
    ├── closed-discharge-summary.tsx        # NEW
    ├── discharge-detail-header.tsx         # closed facts, vessel comment slot
    ├── discharge-detail-page.tsx           # passes the open tab to the header
    ├── discharge-detail-tabs.tsx           # closed Overview content
    └── lot-door-chips.tsx                  # no Door history branch
```

**Structure Decision**: Stay inside the existing `features/discharges` vertical slice of `apps/web`,
following its split between pure view functions (`*.ts`, unit-tested) and rendering components
(`ui/detail/*.tsx`, feature-tested). No `apps/api` change.

## Complexity Tracking

No constitution violation. One coordination risk is recorded instead:

| Risk | Mitigation |
|---|---|
| #324 and #328 rework the same header and Overview files for planned and active records | This slice only adds a `CLOSED` branch and a vessel-comment slot. Whichever of #324/#328/#329 merges later rebases onto the other and folds the closed facts into the shared header and the frozen strip into the shared dock timeline. |
| #98 will introduce the closure time | `closedRecordPeriod` already takes an optional closure time; #98 only passes it from the detail. |
