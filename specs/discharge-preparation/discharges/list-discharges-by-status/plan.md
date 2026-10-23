# Implementation Plan: List Discharges by Status

**Branch**: `feat/322-discharge-list-by-status` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from
`specs/discharge-preparation/discharges/list-discharges-by-status/spec.md`

## Summary

The discharges workbench keeps its Active / Planned / Closed tabs, counts, search, ordering, and
address state, and replaces its uniform row with one per status. The API's existing list endpoint
gains, additively, each discharge's actual start and expected tonnage, the active and next shift
of active discharges with their responsible, and the start-problem count of planned discharges,
computed by the very evaluation the start dialog uses. The web splits the table into per-status
columns, shortens customers to two names plus « +N », and adds Clear search to the no-match
state. No persistence changes. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript, React 19

**Primary Dependencies**: AdonisJS 7 with Lucid and Tuyau (API); TanStack Start / Router / Query,
shadcn/ui (web); `decimal.js` for tonnage sums

**Storage**: PostgreSQL — read only, no migration

**Testing**: Japa (API unit and integration), Vitest + Testing Library + MSW (web feature tests),
browser journey against seeded data

**Target Platform**: Web application (desktop first, usable at phone width)

**Project Type**: Web service + web application in a PNPM/Turbo monorepo

**Performance Goals**: SC-006 — requested tab, badges included, within 2 s at p95 for ≤1,000
discharges

**Constraints**: One list read feeds all three tabs and their counts (GH-61); the badge must agree
with the start check (FR-012); no closure time is exposed (Clarification Q1)

**Scale/Scope**: ≤1,000 discharges, of which planned ones are tens; 1 endpoint extended, 1 screen

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Note |
|-----------|--------|------|
| I. Selected intent versioned | ✅ | Spec for #322, clarified and reviewed |
| II. One deliverable per spec | ✅ | One screen's rows; closure time left to #98 |
| III. Human gates | ✅ | Spec reviewed before planning; this plan awaits review before tasks |
| IV. Test-first | ✅ | Integration, unit, and feature tests written red first (R8) |
| V. Deep boundaries | ✅ | Readiness stays in the start rules, reached through an injectable evaluator; repository owns the shift reads; transformer owns the wire shape |
| VI. Durable knowledge | ✅ | Uses `CONTEXT.md` terms (Active Shift, Shift Responsible); no new vocabulary |
| VII. Verification | ✅ | `pnpm check`, `pnpm typecheck`, `pnpm test`, discharges browser journey, fresh review |
| VIII. One workflow owner | ✅ | No new tooling |

Post-design re-check: unchanged, all pass. No complexity tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/discharge-preparation/discharges/list-discharges-by-status/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── discharges-index.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/
├── app/discharges/
│   ├── list/
│   │   ├── list_discharges_use_case.ts        # + start problem counts for planned discharges
│   │   └── discharge_list_shifts.ts           # new: pick active / next shift (pure)
│   ├── start/
│   │   ├── discharge_start_evaluator.ts       # new: extracted read-and-evaluate
│   │   └── check_discharge_start_use_case.ts  # uses the evaluator
│   └── shared/
│       ├── discharge_transformer.ts           # + startedAt, expectedTonnage, shifts, problem count
│       └── repositories/
│           ├── discharge_repository.ts        # list() returns the list read
│           └── lucid_discharge_repository.ts  # preload non-completed shifts of active discharges
└── tests/
    ├── unit/discharges/consultation/discharge_list_shifts.spec.ts
    └── integration/discharges/consultation/list.spec.ts

apps/web/src/
├── helpers/tonnes.ts                          # formatTonnes moved from discharge-detail-view
└── features/discharges/
    ├── ui/
    │   ├── discharges-page.tsx                # clear-search handler passed to the list
    │   ├── discharge-list.tsx                 # per-status columns, Open chevron
    │   └── list/
    │       ├── discharge-customers.tsx        # two names + « +N » tooltip
    │       ├── discharge-shift-cell.tsx       # active / next shift
    │       ├── preparation-badge.tsx          # Ready / n problems
    │       └── discharges-no-match.tsx        # term + Clear search
    └── __tests__/list/
        ├── row-content.test.tsx               # rewritten per status
        ├── customers.test.tsx                 # new
        ├── preparation-badge.test.tsx         # new
        └── search.test.tsx                    # + Clear search, no counter, totals
```

**Structure Decision**: Existing vertical slices. The list slice imports the evaluator from the
start slice rather than duplicating it; it is the one cross-slice dependency and exists to keep
FR-012 true.

## Implementation Approach

1. **API, RED**: extend `list.spec.ts` with the new fields per status, an active discharge between
   shifts, a deactivated responsible, a lot-less planned discharge (`"0.000"`, counted problem), and
   a parity test against `start-check`. Unit-test the shift picker.
2. **API, GREEN**:
   - Extract `DischargeStartEvaluator.evaluate(discharge, client)` from
     `CheckDischargeStartUseCase`; the existing start-check tests prove the refactor.
   - `list()` additionally preloads, for active discharges only, shifts in `ACTIVE` or `PLANNED`
     with their responsible.
   - `ListDischargesUseCase` evaluates each planned discharge on one read connection and returns
     `{ discharge, startProblemCount }` entries.
   - `DischargeTransformer` adds `startedAt`, `expectedTonnage` (Decimal sum, fixed 3),
     `activeShift`, `nextShift`, `startProblemCount`; regenerate the Tuyau registry.
3. **Web, RED**: update MSW fixtures and feature tests per tab, customers, badge, shift cell,
   no-match Clear search, counts under search, no counter.
4. **Web, GREEN**: move `formatTonnes` to `helpers/`; build the cell components; make
   `DischargeList` choose columns by status; IMO beneath the vessel name; trailing chevron;
   no-match with term and Clear search. Tokens only (`success`/`warning` statuses, `indicator`
   accent).
5. **Verify**: quickstart, `pnpm check`, `pnpm typecheck`, `pnpm test`, discharges browser journey
   on seeded data, fresh read-only review.

## Risks

- **Start evaluation cost** grows with planned discharges (4 queries each). Measured against
  SC-006 during implementation; fallback is batching the evaluator's reads (research R2).
- **Seed realism**: the fixtures must contain an active discharge between shifts and a Ready planned
  discharge to exercise both states in the browser; if missing, the browser check uses test data
  rather than changing the seed in this slice.

## Complexity Tracking

None.
