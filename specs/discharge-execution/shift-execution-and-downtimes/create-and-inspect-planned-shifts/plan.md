# Implementation Plan: Create and Inspect Planned Shifts

**Branch**: `whazzark/create-and-inspect-planned-shifts` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/discharge-execution/shift-execution-and-downtimes/create-and-inspect-planned-shifts/spec.md`

## Summary

Let a preparer add a planned shift after a discharge exists, and let every role see what each planned
shift still lacks to start. Today a discharge only has the shifts entered at its creation. A planned
shift's period, responsible, and resources can be corrected, but only the absence of trucks is
signalled.

In `apps/api`, the `discharges` slice gains:
- `POST /discharges/:dischargeId/shifts`, authorized by `DischargePolicy.update` and answered with the
  discharge detail (`201`, or `200` on a replay of the same client-generated shift `id`). Under the
  discharge's `FOR UPDATE` lock it admits planned and active discharges and refuses closed ones. It
  applies the overlap and period rules, and on an active discharge the new "after every started
  shift" rule. It renumbers shifts with the correction's parking write, and on a planned discharge it
  writes the selected trucks, doors, and weighing areas with the correction's resource rules, now
  shared.
- `readinessGaps` on each shift of the detail, derived by a pure module from what the detail already
  preloads: `null` for started shifts, an ordered array of gap codes for planned ones.

In `apps/web`:
- The Shifts section gains `Add shift`, which opens `AddShiftSheet`. The sheet reuses the correction's
  period, responsible, and resource fields, and hides the resources on an active discharge. A success
  opens the new shift's panel.
- `ShiftDetails` gains a Readiness block. The calendar's truck-only warning becomes a gaps marker that
  does not rely on colour.

No migration, no seed change, no activity log entry.

## Technical Context

**Language/Version**: TypeScript on the repository's Node.js ESM runtime (`apps/api` AdonisJS,
`apps/web` TanStack Start)

**Primary Dependencies**:
- API: AdonisJS 7, Lucid, Bouncer, VineJS 4, and Luxon, all already dependencies.
- Web: Tuyau 1.2, TanStack Start/Router/Query 5, TanStack Form (`useAppForm`), Zod 4, React 19,
  shadcn/Base UI (`Sheet`, `Alert`, `Button`), lucide-react, sonner, and Tailwind CSS 4.
- No new dependency.

**Storage**: Existing PostgreSQL tables through Lucid:
- Written: `shifts` (insert, and `sequence` renumbering), plus `shift_trucks`,
  `shift_warehouse_doors`, and `shift_weighing_areas` (inserts, planned discharge only).
- Locked: `discharges` `FOR UPDATE`, then `users`, `trucks`, `warehouses`/`warehouse_doors`, and
  `weighing_areas` `FOR SHARE`, in that order.
- Read: `discharge_truck_assignments`, `warehouse_door_product_lot_assignments`, and current shift
  selections.
- No migration (data-model.md).

**Testing**:
- API: Japa unit tests for the addition rules (period, started shifts, sequences), the readiness
  derivation, the validator, and the use case with stubbed repositories (refusal order, replay,
  active-discharge resources, lock order). Japa integration tests for the route, covering every
  data-model.md refusal, a replay, renumbering, concurrent overlapping additions, and `readinessGaps`
  in `GET /discharges/:id`. The existing `correct_planned_shift` suites guard the shared resource
  module refactor.
- Web: Vitest with jsdom, Testing Library, and MSW through the real router, for the add sheet, its
  refusals and stale states, readiness, the calendar marker, and access. Unit tests cover
  `addShiftRulesSchema`.
- Playwright is not set up in `apps/web` and stays out of scope, as for GH-53 to GH-55.

**Target Platform**: Authenticated responsive web workstation backed by the Node.js API

**Project Type**: PNPM/Turbo monorepo web application (`apps/api` + `apps/web`)

**Performance Goals**: On a discharge with 40 shifts, an addition is saved and reflected within 2
seconds for 95% of attempts (SC-008). The command runs a fixed number of statements:
- the discharge lock and the replay lookup;
- one shift list;
- one lock per referenced table, only for non-empty lists;
- the pool, current selection, and current door assignment reads;
- one parking update plus one update per renumbered shift, as the correction does;
- one insert per written table;
- the existing detail read.

Readiness adds no query: it is computed in memory over the preloaded detail.

**Constraints**:
- The API is authoritative for authorization and every rule; client-side rules only mirror them.
- An addition is atomic and idempotent by shift `id`, and never changes another shift's period,
  responsible, status, or resources (FR-011, FR-012, FR-015).
- A started shift is never renumbered.
- Resource rules are exactly the correction's (FR-009), enforced by shared code.
- The responsible's role and access status never cross the wire; only the gap code does.
- No gap text says "ready" or "can start" (FR-022).

**Scale/Scope**:
- **API**: one command; one guard; two exceptions; one pure rules addition; one pure readiness
  module; one shared resource planning module extracted from the correction; one repository method;
  one transformer field; one route.
- **Web**: one sheet; one extracted resource-fields component; one readiness component; one schema
  addition; one mutation; changes to the calendar, shift details, Shifts section, and detail page.
- **Volume**: up to 40 shifts and 50 held trucks per discharge (GH-55's volumes).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|---|---|---|
| I. Selected feature intent is versioned | PASS | GH-63 is selected on its branch; spec.md carries the clarifications of 2026-09-17. |
| II. One independently deliverable feature per spec | PASS | One outcome: planned shifts can be added and their gaps read. Replanning, removal, reassignment, start, and runtime resources stay in GH-64, GH-66, GH-65, and GH-76 to GH-78. |
| III. Vanilla Spec Kit gates protect product intent | PASS | The spec was clarified with the user, and this plan awaits human review before `speckit-tasks`. |
| IV. Test-first observable behavior | PASS | Every acceptance scenario maps to an API integration test or a web feature test (see Test mapping). The rules and readiness are pure and unit-tested first. |
| V. Deep boundaries and explicit contracts | PASS | Controller: HTTP adaptation. Use case: decisions under lock. Pure modules: rules and readiness. `DischargePreparationRepository`: writes and locks. Transformer: wire shape. Web: pure schema, mutation adapter, UI. Contracts are in `contracts/`. |
| VI. Durable knowledge has a home | PASS | No new domain term. "Readiness gap" is a derived view of CONTEXT.md's Active Shift requirements and stays feature-local. The rule that GH-65 must switch to actual starts is recorded in research.md Decision 4 and the rules module's doc comment, not in a second document. |
| VII. Verification is part of delivery | PASS | quickstart.md lists lint, typecheck, targeted and full API and web suites, and the manual flows. Fresh review before PR. |
| VIII. One workflow owner | PASS | No workflow state is introduced. |

**Post-design re-check (after Phase 1)**: PASS, with no new violation. The design adds no table, no
dependency, and no cross-layer shortcut. Sharing the correction's resource planning reduces
duplication rather than adding coupling.

## Project Structure

### Documentation (this feature)

```text
specs/discharge-execution/shift-execution-and-downtimes/create-and-inspect-planned-shifts/
├── spec.md
├── plan.md              # this file
├── research.md          # Decisions 1–9
├── data-model.md        # written rows, derived readinessGaps, refusals
├── quickstart.md        # run and validate
├── contracts/
│   ├── planned-shifts.openapi.yaml
│   └── ui-state.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/discharge_shifts_controller.ts          # + store: 201/200, parseInstant
│   └── discharges/
│       ├── shifts/
│       │   ├── add_planned_shift_use_case.ts               # new: lock, replay, status, rules, resources, write
│       │   ├── planned_shift_validator.ts                  # + plannedShiftAdditionValidator (id, optional lists default [])
│       │   └── correct_planned_shift_use_case.ts           # uses planned_shift_resources; behavior unchanged
│       └── shared/
│           ├── discharge_exceptions.ts                     # + DischargeClosedException, ShiftIdConflictException
│           ├── shift_discharge_guard.ts                    # new: lockDischargeOpenToShifts (PLANNED | ACTIVE)
│           ├── planned_shift_rules.ts                      # + findAddedShiftIssues, startedShiftStart, planAddedShiftSequences
│           ├── planned_shift_resources.ts                  # new: trucks + doors + areas plan, moved from the correction
│           ├── planned_shift_readiness.ts                  # new: readinessGaps(shift, detail) — pure
│           ├── discharge_detail_transformer.ts             # + shifts[].readinessGaps
│           └── repositories/
│               ├── discharge_preparation_repository.ts     # + findShiftIdentity, insertPlannedShift
│               └── lucid_discharge_preparation_repository.ts
├── start/routes.ts                                         # + POST /:dischargeId/shifts as shifts.store
├── .adonisjs/                                              # regenerated Tuyau registry and controllers, committed
└── tests/
    ├── unit/discharges/shifts/{add_rules,add_planned_shift,readiness,validator}.spec.ts
    └── integration/discharges/
        ├── shifts/{add_planned_shift,add_planned_shift_refusals,add_planned_shift_concurrency}.spec.ts
        ├── shifts/correct_planned_shift.spec.ts            # unchanged: guards the shared resource module
        └── consultation/show.spec.ts                        # + readinessGaps per status and per gap

apps/web/src/features/discharges/
├── discharge-preparation-schema.ts                         # + addShiftFormValues, addShiftRulesSchema, toAddShiftBody
├── discharge-permissions.ts                                # + canAddShifts(user, discharge)
├── mutations/use-discharge-mutations.ts                    # + addShift (applyDetail)
└── ui/detail/
    ├── add-shift-sheet.tsx                                 # new
    ├── shift-resource-fields.tsx                           # new: extracted from shift-edit-panel
    ├── shift-edit-panel.tsx                                # uses ShiftResourceFields
    ├── shift-readiness.tsx                                 # new
    ├── shift-details.tsx                                   # + ShiftReadiness
    ├── shift-calendar.tsx                                  # lacksTrucks → gaps marker with icon and sr text
    ├── discharge-shifts-card.tsx                           # + Add shift in header and empty state
    └── discharge-detail-page.tsx                           # passes canAddShifts
└── __tests__/
    ├── support/fixtures.ts                                 # readinessGaps on fixture shifts; active and closed fixtures
    ├── discharge-preparation-schema.test.ts                # + add rules
    ├── discharge-permissions.test.ts                       # + canAddShifts
    └── detail/{add-shift,add-shift-refusals,add-shift-stale-state,shift-readiness}.test.tsx
        # plus updates to shifts.test.tsx (marker) and access.test.tsx (add action by role and status)
```

**Structure Decision**: Extend the delivered discharge slice in place.
- The command lives beside the correction in `discharges/shifts/`, because both write one planned
  shift.
- Locked writes join `DischargePreparationRepository`, which already states the lock order and
  `renumberShifts`.
- Rules and readiness are pure modules in `shared/`, so they are unit-tested at their edges and
  importable by GH-64 and GH-65.
- In the web, the sheet sits in `ui/detail/` with the other shift UI, and the resource fields are
  extracted rather than copied.

## Test mapping

| Spec | API test | Web test |
|---|---|---|
| US1 1–6, FR-004/005/009/011–016 | `add_planned_shift.spec.ts`: planned discharge with and without resources, order and renumbering, replay 200 | `add-shift.test.tsx` |
| US2 1–5, FR-008/010 | `add_planned_shift.spec.ts`: active discharge, after started shifts, between planned ones, started shifts unchanged; `add_rules.spec.ts` | `add-shift.test.tsx` (no resource fields) |
| US3 1–7, FR-006/007/025 | `add_planned_shift_refusals.spec.ts`; `validator.spec.ts` | `add-shift-refusals.test.tsx`; schema unit test |
| US4 1–8, FR-003/017–023 | `readiness.spec.ts`; `consultation/show.spec.ts` | `shift-readiness.test.tsx`; `shifts.test.tsx` |
| US5 1–7, FR-024/026–028 | `add_planned_shift_concurrency.spec.ts` (parallel overlapping additions: one 201, one 422); refusals for closed, resources on active, and lost eligibility | `add-shift-stale-state.test.tsx` |
| FR-001/002 | `add_planned_shift_refusals.spec.ts`: 401, 403 observer, 403 deactivated | `access.test.tsx` |

## Complexity Tracking

No constitution violation to justify. The choices that go beyond precedent are recorded where they
are decided:

| Choice | Where decided |
|---|---|
| Replay answered before the status check | research.md Decision 2 |
| Resources on an active discharge refused as `409`, not `422` | research.md Decision 3 |
| Started-shift rule on planned starts until GH-65 | research.md Decision 4 |
| Readiness derived on the API as codes, not in the web | research.md Decision 7 |
