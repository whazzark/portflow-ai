# Implementation Plan: Planned Shifts Week Calendar

**Branch**: `feat/327-planned-shifts-week-calendar` | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/interface-v2/discharges/planned-shifts-week-calendar/spec.md`

## Summary

Restyle the discharge Shifts tab to the retained V2. A summary line and a legend go above the existing
week calendar. The day gets shorter (20 px per hour) so 24 hours fit. Cards, break pills, the
Expected start and Now lines, and continuations are restyled. The shift panel gets a new header,
compact trucks, and a completed-shift footer. The Edit shift and Add shift sheets get a Duration
output, "x of y selected" counts, and a start hint. This is web only: no API, permission, or rule
change. The work extends existing components and their tested geometry (research R1).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19

**Primary Dependencies**: TanStack Start/Router, TanStack Form (`useAppForm`), shadcn/ui primitives
(Sheet, Badge, Tooltip), Tailwind CSS v4 with the « Marine sobre » tokens, lucide-react

**Storage**: N/A (reads `DischargeDetailDto` only)

**Testing**: Vitest + Testing Library + MSW through the real router (feature tests), and Vitest for
pure adapters (unit tests)

**Target Platform**: Modern desktop and mobile browsers, light and dark themes

**Project Type**: Web application (`apps/web` only, in the PNPM/Turbo monorepo)

**Performance Goals**: No regression. The summary is O(shifts) and recomputes on render, as the
calendar does.

**Constraints**: Tokens only, no hardcoded colours (web AGENTS.md). Amber is for the gap status
only. The sheet uses `size="lg"`. Colour is never the only signal. Keyboard use is unchanged.

**Scale/Scope**: Up to about 20 shifts per discharge. About 8 files touched in
`apps/web/src/features/discharges`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Note |
|-----------|--------|------|
| I. Selected intent versioned | ✅ | Issue #327 selected; spec in its feature directory. The issue is `delivery:lite`, and the spec was requested anyway. |
| II. One deliverable per spec | ✅ | Shifts tab only. Header and tab dot are #324's. |
| III. Human gates | ✅ | Spec reviewed by the user before this plan. This plan stops for review before tasks. |
| IV. Test-first | ✅ | Each visible change starts from a failing feature or unit test (quickstart). |
| V. Boundaries | ✅ | Wording lives in pure adapters (`shift-calendar.ts`, `discharge-detail-view.ts`). Components only lay out. No cross-layer shortcut. |
| VI. Durable knowledge | ✅ | No new domain term. "Inter-Shift Break" and "Planned Shift" are from `CONTEXT.md`. |
| VII. Verification | ✅ | `pnpm check`, `pnpm typecheck`, `pnpm test`, a manual browser pass, and a fresh review before ready. |
| VIII. One workflow owner | ✅ | No orchestration added. |

Post-design re-check: unchanged, all pass. No complexity to track.

## Project Structure

### Documentation (this feature)

```text
specs/interface-v2/discharges/planned-shifts-week-calendar/
├── spec.md
├── plan.md              # this file
├── research.md          # decisions R1–R11
├── data-model.md        # derived view models (no persisted change)
├── quickstart.md        # automated and manual validation
├── contracts/
│   └── shifts-tab-ui.md # observable texts, roles, accessible names
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
apps/web/src/features/discharges/
├── shift-calendar.ts                     # + shiftsSummary(); hour height stays in the component
├── discharge-detail-view.ts              # + sharedResourcePeriod() for the panel
├── discharge-preparation-schema.ts       # + addShiftStartHint() beside addShiftFormValues()
├── ui/detail/
│   ├── discharge-shifts-card.tsx         # summary row + legend above the calendar
│   ├── shift-calendar-summary.tsx        # NEW: summary line, amber gap count, legend
│   ├── shift-calendar.tsx                # 20 px/h, V2 card, gap pill, (cont.) lines, break pill, Now label
│   ├── shift-details.tsx                 # panel title/description, compact trucks, completed footer
│   ├── shift-resource-group.tsx          # optional compact rendering + trailing "since" line
│   ├── shift-resource-fields.tsx         # Duration as a read-only labelled output in the period row
│   ├── shift-resource-checklist.tsx      # "x of y selected"
│   └── add-shift-sheet.tsx               # start hint
└── __tests__/
    ├── shift-calendar.test.ts            # + shiftsSummary
    ├── discharge-detail-view.test.ts     # + sharedResourcePeriod
    └── detail/
        ├── shifts.test.tsx               # summary, legend, gap pill, names, panel header/footer, trucks
        ├── add-shift.test.tsx            # hint, Duration output, counts
        ├── draw-shift.test.tsx           # no hint when drawn
        └── shift-edit.test.tsx           # Duration output, counts
```

**Structure Decision**: The existing `apps/web` vertical slice `features/discharges`. One new UI file
(`shift-calendar-summary.tsx`) keeps `shift-calendar.tsx` (584 lines) from growing further. All
wording adapters stay beside their siblings.

## Implementation Approach

1. **Summary (US1, US2)**: a test-first `shiftsSummary()`, then `ShiftCalendarSummary`, rendered by
   `DischargeShiftsCard` above `ShiftCalendar` only when there are shifts.
2. **Calendar (US1, US2)**: `HOUR_HEIGHT_PX = 20`. V2 card styling with the gap pill in the status
   slot and the accessible name `, N gap(s)`. The continuation renders `(cont.)` plus overflow lines
   (research R5). The break pill shows the duration only on the calendar. The Now line gets a dot and
   a `Now HH:mm` label.
3. **Panel (US3)**: title without "Shift ", the description line `Shift i of n · vessel`.
   `sharedResourcePeriod()` drives compact truck chips and the trailing "All … since" line. Completed
   shifts get the footer text and Close.
4. **Sheets (US4)**: the Duration output inside the period row, the checklist "x of y selected", and
   the Add shift hint via `addShiftStartHint(discharge, values, drawn)`.
5. **Verification**: quickstart, automated then manual. Then a fresh `/code-review` and the PR.

## Risks

- **Existing tests asserting old copy** ("Shift …" panel title, "N selected", "Duration 8 h",
  "16 h break" on the calendar): update them deliberately with the new contract, never loosen them.
- **Shorter hour height**: a 2–3-hour shift shows only its time and status on the calendar. This is
  accepted by the spec (Edge cases, short shift).
- **#324 overlap**: #324 also touches the discharge detail (header, tabs). This plan touches only the
  Shifts section component and its children, so the merge should be mechanical.

## Complexity Tracking

No violations.
