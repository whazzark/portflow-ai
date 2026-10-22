# Implementation Plan: Show the Planned Discharge Header and Dock Timeline

**Branch**: `feat/324-planned-discharge-header-dock-timeline` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/show-the-planned-discharge-header-and-dock-timeline/spec.md`

## Summary

Rearrange the **planned** discharge record in `apps/web` so that:

1. the header carries Dock · Planned period · IMO · Expected tonnage on every tab, with the vessel
   comment on Overview only, and the Overview identity card is removed;
2. a banner reports how many problems block the start, with Review opening the existing Start
   dialog, and tabs carry an amber dot for the sections the start check reports problems in;
3. the Overview tab opens on a read-only dock timeline, followed by the Preparation card with a new
   Dock row.

The banner and the dots reuse the existing `GET /discharges/:id/start-check` and the Start dialog's
existing problem-to-section grouping (`startProblemSections`). The timeline needs one API addition:
the discharge detail gains `dockOccupations`, the other planned and active discharges assigned to the
same dock with their planned periods, read in the same way the detail already reads the other
discharges holding its trucks (`otherHoldings`). No migration, no new endpoint, no new business rule.

## Technical Context

**Language/Version**: TypeScript (Node 22 / browser), as the monorepo

**Primary Dependencies**: AdonisJS 6 + Lucid + Tuyau (API); TanStack Start/Router/Query, shadcn/ui,
Tailwind, lucide-react (web)

**Storage**: PostgreSQL — read only; no schema change

**Testing**: Japa integration tests (`apps/api/tests/integration/discharges/consultation`); Vitest +
Testing Library + MSW feature tests (`apps/web/src/features/discharges/__tests__`), Vitest unit
tests for pure view helpers

**Target Platform**: Web app, desktop first, usable at phone width

**Project Type**: Web application (`apps/api` + `apps/web`)

**Performance Goals**: The detail stays one request; `dockOccupations` costs one extra aggregate query
per detail read, bounded by the discharges on one dock

**Constraints**: API remains the source of truth for authorization and for whether a start is
blocked; signals never rest on colour alone; V2 « Marine sobre » tokens only (amber = `warning`)

**Scale/Scope**: One screen (planned discharge record), one DTO field, ~6 web components touched or
added

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Selected intent is versioned | PASS | Issue #324 selected; spec in this directory. |
| II. One deliverable per spec | PASS | Planned record only; active/closed records and other tabs are sibling issues (#325–#330). |
| III. Vanilla gates | PASS | Spec committed for review; this plan stops for plan review before `speckit-tasks`. |
| IV. Test-first | PASS | Each story starts from a failing feature test (web) or integration test (API); see quickstart. |
| V. Deep boundaries | PASS | Occupations are read by the repository, shaped by the detail transformer; the timeline's geometry lives in a pure web view module, rendered by UI components. No cross-layer shortcut. |
| VI. Durable knowledge | PASS | No new domain term is canonical outside this spec; "Dock Occupation" and "Planned Period" stay feature-local (see research R6). |
| VII. Verification | PASS | `pnpm check`, `pnpm typecheck`, `pnpm test`, fresh Claude Code review before the PR is ready. |
| VIII. One workflow owner | PASS | No orchestration added. |

Post-design re-check: PASS — the design adds one read-only field and reuses existing endpoints.

## Project Structure

### Documentation (this feature)

```text
specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/show-the-planned-discharge-header-and-dock-timeline/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── discharge-detail-dock-occupations.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
apps/api/
├── app/discharges/shared/
│   ├── discharge_detail_read.ts                    # + DockOccupation type, dockOccupations on the read
│   ├── discharge_detail_transformer.ts             # + dockOccupations in the DTO
│   └── repositories/
│       ├── discharge_repository.ts                 # findDetail doc: occupations beside holdings
│       └── lucid_discharge_repository.ts           # + findDockOccupations(dockId, dischargeId)
└── tests/integration/discharges/consultation/
    └── show.spec.ts                                # + dock occupation scenarios

apps/web/src/features/discharges/
├── discharge-detail-view.ts                        # + plannedPeriod(detail)
├── dock-timeline.ts                                # NEW pure: span, lanes, gaps, overlaps, now position
├── discharge-detail-sections.ts                    # + problemTabs(sections), dock row in preparationSummary
├── queries/discharge-queries.ts                    # startCheck reused by the banner (doc updated)
├── mutations/use-discharge-mutations.ts            # applyDetail also invalidates startCheck(id)
├── ui/detail/
│   ├── discharge-detail-page.tsx                   # start-check query for starters; banner; passes problem tabs
│   ├── discharge-detail-header.tsx                 # planned layout: facts line, comment slot
│   ├── discharge-detail-tabs.tsx                   # dots + accessible names; Overview = timeline + preparation
│   ├── discharge-identity-card.tsx                 # REMOVED from the planned Overview (kept for active/closed)
│   ├── discharge-preparation-card.tsx              # + Dock row
│   ├── start-blockers-banner.tsx                   # NEW
│   └── dock-timeline-card.tsx                      # NEW
├── ui/start/start-discharge-action.tsx             # open state lifted so Review can open the dialog
└── __tests__/
    ├── dock-timeline.test.ts                       # NEW unit
    ├── discharge-detail-view.test.ts               # + plannedPeriod
    ├── discharge-detail-sections.test.ts           # + problemTabs, dock row
    └── detail/
        ├── planned-header.test.tsx                 # NEW feature (US1)
        ├── start-blockers.test.tsx                 # NEW feature (US2)
        ├── dock-timeline.test.tsx                  # NEW feature (US3)
        ├── preparation-summary.test.tsx            # + Dock row (US4)
        └── identity.test.tsx / tabs.test.tsx       # updated to the new planned layout
    └── support/fixtures.ts, test-helpers.ts        # + dockOccupations default [], start-check handler
```

**Structure Decision**: Web application. API change confined to the discharge `shared` read model
(the detail read used by `show`, `store`, `update`, and `start` responses); web change confined to
`features/discharges` detail UI and its pure view modules.

## Design Decisions (summary — details in research.md)

- **D1 Occupations on the detail** (R1): `dockOccupations` is added to the discharge detail DTO, not a
  new endpoint. Every response that already returns the detail (show, create, identity correction,
  lots, shifts, start) carries it, so `applyDetail` keeps the timeline current with no extra wiring.
  Computed only for a PLANNED discharge; `[]` otherwise (FR-024: active/closed unchanged).
- **D2 Occupation period** (R2): per other discharge, `plannedStartAt` = earliest shift planned
  start, `plannedEndAt` = latest shift planned end, both `null` without shifts; `startedAt` for an
  active one. The web derives the occupied interval: active → from `startedAt` to `plannedEndAt`, or
  open-ended when a later end is unknown; planned → planned period, or the expected start instant when
  it has no shift.
- **D3 Start check for the banner** (R3): the page subscribes to `dischargeQueries.startCheck(id)`
  only when `discharge.status === 'PLANNED'` and the viewer may start (`canPrepareDischarges`, which
  mirrors `DischargePolicy.start`). The dialog keeps its own subscription to the same key, so its
  mount refetch updates the banner too (SC-003). `applyDetail` and the stale-refusal refresh also
  invalidate `startCheck(id)` (FR-010). Window-focus refetch keeps it current against other users.
  Errors are silent (FR-011).
- **D4 Tab dots** (R4): computed from `startProblemSections(problems, detail)` → the set of each
  section's `link.tab`; one dot per tab; the trigger's accessible name appends ", contains a problem".
- **D5 Review opens the dialog** (R5): `StartDischargeAction` becomes controlled by the page
  (`open` / `onOpenChange`), so the banner's Review and the header's Start open the same single
  dialog instance.
- **D6 Header layout**: for PLANNED, the facts line becomes Dock · Planned period · IMO · Expected
  tonnage; the comment renders under it when `tab === 'overview'` and non-empty. ACTIVE and CLOSED keep
  today's facts line and `DischargeIdentityCard` (FR-024).
- **D7 Timeline rendering** (R7): a horizontal, read-only strip built from semantic HTML (a list of
  lanes with time-positioned items, plus an `ol` of events for assistive technology), not a chart
  library. Geometry from the pure `dock-timeline.ts`; scrolls horizontally inside its card on narrow
  screens.
- **D8 Dock row**: derived from the detail — archived dock (`dock.status`), held by an ACTIVE
  occupation, else the dock name — so non-starters see it too and it passes no start verdict.

## Complexity Tracking

No constitution violations to justify.
