# Implementation Plan: Plan Warehouse Door and Checkpoint Assignments

**Branch**: `whazzark/plan-warehouse-door-and-checkpoint-assignments` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/plan-warehouse-door-and-checkpoint-assignments/spec.md`

## Summary

Let a preparer decide, on a planned discharge, which warehouse doors receive each product lot and
which doors and weighing areas each planned shift uses. Today only seeds write these rows.

In `apps/api`, the `discharges` slice gains two commands and one query, each authorized by
`DischargePolicy.update`:
- `PATCH /discharges/:dischargeId/product-lots/:id/warehouse-doors` applies a change set
  `{ assign, withdraw }` to a lot's current door assignments. A door current on another lot of the
  discharge moves at one instant.
- `PATCH /discharges/:dischargeId/shifts/:id/checkpoints` applies
  `{ warehouseDoors: { add, remove }, weighingAreas: { add, remove } }` to a planned shift's current
  selections.
- `GET /discharges/:id/planning-options` lists available doors, with their warehouse and their
  current assignments in other planned or active discharges, and available weighing areas.

Both commands answer with the existing discharge detail. They follow GH-53's refusal scheme:
- a chosen value is refused with `422` field paths;
- the state of the discharge, lot, or shift is refused with a `404` or `409` code.

Writes lock the discharge `FOR UPDATE`, then warehouses, doors, and weighing areas `FOR SHARE`. That
closes the race with archives the door repository recorded as an obligation. The single weighing
area archive moves under the same lock discipline. A migration adds partial unique indexes on
current rows as a database backstop.

In `apps/web`:
- On a planned discharge's detail, each lot's `Warehouse doors` block and each planned shift's
  `Warehouse doors` and `Weighing areas` groups gain an `Edit` action.
- The actions open `LotWarehouseDoorsSheet` and `ShiftCheckpointsSheet`. Both are built on a new
  registered `CheckboxGroupField` and on a pure `discharge-planning-view` module that computes change
  sets, moves, and indications.
- Superseded: `ShiftCheckpointsSheet` was dropped, and the lot sheet became a two-column
  `Warehouse doors` dialog without `CheckboxGroupField` (see `contracts/ui-state.md`).

The slice records no activity log entry and changes no seed.

## Technical Context

**Language/Version**: TypeScript on the repository's Node.js ESM runtime (`apps/api` AdonisJS,
`apps/web` TanStack Start)

**Primary Dependencies**:
- API: AdonisJS 7, Lucid, Bouncer, VineJS 4, and Luxon, all already dependencies.
- Web: Tuyau 1.2, TanStack Start/Router/Query 5, TanStack Form (`useAppForm`), Zod 4, React 19,
  shadcn/Base UI (`Sheet`, `Checkbox`, `InputSearch`, `Card`), sonner, and Tailwind CSS 4.
- No new dependency.

**Storage**: Existing PostgreSQL tables through Lucid:
- Written: `warehouse_door_product_lot_assignments`, `shift_warehouse_doors`, and
  `shift_weighing_areas`, whose rows are started and ended but never deleted.
- Read under lock: `discharges`, `warehouses`, `warehouse_doors`, and `weighing_areas`.
- Read: `product_lots`, `shifts`.
- One migration adds three partial unique indexes (research.md Decision 7). No seed change.

**Testing**:
- API: Japa unit tests, for the planning rules module, both use cases with stubbed repositories,
  and the validators' rules. Japa integration tests, for the three routes and the hardened weighing
  area archive, on the existing factories and `preparation_scenario.ts`.
- Web: Vitest with jsdom, Testing Library, and MSW, through the real router. Pure unit tests cover
  `discharge-planning-view.ts`.
- Playwright is not set up in `apps/web` and is out of scope, as it was for GH-53.

**Target Platform**: Authenticated responsive web workstation backed by the Node.js API

**Project Type**: PNPM/Turbo monorepo web application (`apps/api` + `apps/web`)

**Performance Goals**: For 20 lots and 40 shifts, a save completes and the updated detail shows
within 3 seconds for 95% of attempts (SC-007). A command runs a fixed number of statements:
- one lock per locked table;
- one read each of the lots, shifts, current assignments, and current selections;
- one batched update to end rows and one batched insert to start them;
- the existing detail read.

The options query is three statements.

**Constraints**:
- The API is authoritative for authorization and every rule. Client-side checks only mirror it.
- Each save is atomic and idempotent, and applies only the user's changes (FR-016 to FR-018).
- Rows are ended, never deleted.
- Every refusal of a chosen value identifies it.
- Observers, non-planned discharges, and non-planned shifts see no action.
- No truck, dock, lot, or shift period write.

**Scale/Scope**:
- **API**: two commands, one query, one pure rules module, two validators, three exceptions, one
  migration, one repository extension, and one hardened archive repository.
- **Web**:
  - Sheets: two sheets and their two actions on the existing cards.
  - Data: one options query, two mutations, and one options hook.
  - View logic: one pure view module.
  - Shared form infrastructure: one new registered form field.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Selected intent**: PASS. Issue #54 is selected. Its spec was clarified on 2026-09-15 and is
  the contract. The plan stays out of GH-55's trucks, GH-56's start confirmation, and GH-77 and
  GH-78's runtime changes. It only leaves the options query open for GH-55 to extend.
- **II. Independent delivery**: PASS. This is one vertical slice with its commands in `apps/api`
  and its sheets in `apps/web`, mergeable as one PR. Its blocker, GH-53, is delivered. GH-55 can
  land before or after it: each touches its own group on the shift card.
- **III. Human gates**: PASS. The three product questions were settled with the product owner
  before planning. Human review of this plan is required before `/speckit-tasks`.
- **IV. Test-first behavior**: PASS. Every requirement has an observable seam:
  - API unit tests: every change-set rule at its edges (no-op, move, repeated identity, both lists,
    withdrawal while selected, door not assigned), and the instant rule.
  - API integration tests: for each route, 401, 403, each role's success, 404, 409, and every 422
    rule, each asserting nothing changed; plus replay, move, ended-row readability, and the
    hardened archive.
  - Web unit tests: change sets, move detection, indications, and shift door eligibility.
  - Web feature tests through the real router: both sheets, their options states, client and server
    refusals, stale outcomes, and actions per role and status.
- **V. Deep boundaries**: PASS.
  - **Use cases** own the transaction, lock order, rule evaluation, and exception mapping.
  - **Repositories** own locked reads, batched end and start writes, and the malformed-id guard.
  - **The rules module** is pure: it takes current rows and a change set and returns issues and
    writes.
  - **Controllers** authorize, validate, and serialize.
  - **Web sheets** own mutation outcomes, the view module owns derivations, and the cards only
    render actions.
- **VI. Durable knowledge**: PASS. The vocabulary is already in `CONTEXT.md` (Warehouse Door
  Assignment, Shift Preparation, Checkpoint). No ADR is needed: the lock order extends GH-53's
  recorded discipline, and change-set commands are a slice decision in research.md Decision 2.
- **VII. Verification**: PASS. `quickstart.md` lists the API and screen validations, the targeted
  suites, `db:fresh`, `pnpm check`, `pnpm typecheck`, `pnpm test`, and the fresh review.
- **VIII. One workflow owner**: PASS. No delivery state machine, Project field, or orchestrator is
  introduced.

**Post-design re-check**: PASS. Phase 1 adds three routes and three indexes, and no table. It
bypasses no authorization and adds no cross-feature import in the web: the options come from the
discharges feature's own query. The changes outside the discharge slices are listed below, each
with its reason:

| Change | Reason |
|---|---|
| Single weighing area archive locks and checks usage in one transaction | Keeps "no archive while in use" true against the new selection writer (Decision 5) |
| Comments in the door and warehouse repositories that described a missing assignment writer | The writer now exists and takes the locks they asked for (Decision 5) |
| A migration with three partial unique indexes | Database backstop for single current rows (Decision 7) |
| A `CheckboxGroupField` in `libraries/forms` | The first multi-choice form field (Decision 9) |
| `E_DISCHARGE_NOT_PLANNED`'s message | Fits every planning writer; code unchanged (Decision 4) |

None of them changes an existing page's behavior, and the existing archive, form, and detail tests
pin that.

## Project Structure

### Documentation (this feature)

```text
specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/plan-warehouse-door-and-checkpoint-assignments/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── discharge-resource-planning.openapi.yaml
│   └── ui-state.md
├── checklists/requirements.md
└── tasks.md             # Created later by /speckit-tasks, not by this plan
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/
│   │   ├── discharges_controller.ts                          # add planningOptions()
│   │   ├── discharge_product_lot_doors_controller.ts         # new: update()
│   │   └── discharge_shift_checkpoints_controller.ts         # new: update()
│   ├── discharges/
│   │   ├── planning_options/
│   │   │   └── list_planning_options_use_case.ts             # new
│   │   ├── warehouse_doors/
│   │   │   ├── change_lot_warehouse_doors_use_case.ts        # new
│   │   │   └── lot_warehouse_doors_validator.ts              # new: { assign, withdraw }
│   │   ├── checkpoints/
│   │   │   ├── change_shift_checkpoints_use_case.ts          # new
│   │   │   └── shift_checkpoints_validator.ts                # new: { warehouseDoors, weighingAreas }
│   │   └── shared/
│   │       ├── discharge_planning_options_transformer.ts     # new: the options query's wire shape
│   │       ├── discharge_resource_planning_rules.ts          # new: pure change-set rules, recorded instant
│   │       ├── discharge_preparation_issues.ts               # add door, area, and shift issues
│   │       ├── planned_discharge_guard.ts                    # unchanged, reused
│   │       ├── discharge_exceptions.ts                       # add ShiftNotFound, ShiftNotPlanned, PlanningConflict; reword NotPlanned
│   │       └── repositories/
│   │           ├── discharge_preparation_repository.ts       # add planning reads, locks, end/start writes; lock-order comment
│   │           ├── lucid_discharge_preparation_repository.ts # same
│   │           ├── discharge_repository.ts                   # add findPlanningOptions()
│   │           └── lucid_discharge_repository.ts             # same
│   ├── weighing_areas/
│   │   ├── archive/archive_weighing_area_use_case.ts         # usage check moves into the repository
│   │   └── shared/repositories/{weighing_area_repository,lucid_weighing_area_repository}.ts  # archiveAvailable: lock + usage in one trx, IN_USE outcome
│   ├── warehouse_doors/shared/repositories/lucid_warehouse_door_repository.ts  # comment only
│   └── warehouses/shared/repositories/lucid_warehouse_repository.ts            # comment only
├── database/migrations/
│   └── 1786200000000_add_current_planning_unique_indexes.ts  # new: three partial unique indexes
├── start/routes.ts                                           # planning-options; product_lots.warehouse_doors; shifts group with checkpoints
├── .adonisjs/                                                # regenerated Tuyau registry and controllers, committed
└── tests/
    ├── unit/discharges/planning/{rules,change_lot_warehouse_doors,change_shift_checkpoints,validators}.spec.ts
    └── integration/
        ├── discharges/planning/{lot_warehouse_doors,shift_checkpoints,planning_options}.spec.ts
        ├── discharges/preparation/preparation_scenario.ts   # extended: doors, areas, assignments, selections
        ├── discharges/preparation/remove_product_lot.spec.ts # extended: a lot assigned through the API cannot be removed
        └── weighing_areas.spec.ts                           # extended: single archive in-use refusal still holds

apps/web/src/
├── libraries/forms/
│   ├── form.tsx                                              # register CheckboxGroupField
│   └── fields/checkbox-group-field.tsx                       # new: grouped options, filter, per-option hint
└── features/discharges/
    ├── discharge-planning-view.ts                            # new: change sets, moves, indications, shift door options
    ├── queries/discharge-queries.ts                          # add planningOptions(id)
    ├── mutations/use-discharge-mutations.ts                  # add changeLotDoors, changeShiftCheckpoints; stale codes
    └── ui/
        ├── planning/
        │   ├── lot-warehouse-doors-sheet.tsx                 # new
        │   ├── shift-checkpoints-sheet.tsx                   # new
        │   ├── planning-options.ts                           # new: options state hook
        │   ├── planning-options-state.tsx                    # new: loading, failure, and retry of a list
        │   └── planning-refusals.ts                          # new: stale refusal codes and their messages
        └── detail/
            ├── discharge-detail-page.tsx                     # passes canCorrect to the shifts card
            ├── discharge-product-lots-card.tsx               # Edit on each lot's doors
            └── discharge-shifts-card.tsx                     # canCorrect; Edit on doors and areas groups; None currently selected
    └── __tests__/
        ├── support/{fixtures.ts,test-helpers.ts}             # planning options fixtures and handlers
        ├── discharge-planning-view.test.ts                   # new, unit
        ├── detail/access.test.tsx                            # updated: planning actions for preparers on planned only
        ├── detail/shifts.test.tsx                            # updated: None currently selected
        └── planning/{lot-doors,lot-doors-refusals,shift-checkpoints,shift-checkpoints-refusals,options,stale-state}.test.tsx
```

No form field has a test of its own. `CheckboxGroupField` is covered through the sheet feature tests,
as `DateTimeField` is through GH-53's.

**Structure Decision**: Extend the delivered discharge slice with GH-53's mutation shape.

In the API:
- Each command gets a per-action folder with its validator, as GH-53's lot commands do.
- Locked reads and writes join `DischargePreparationRepository`, which already holds the discharge
  lock and GH-53's reference locks, so one repository states the whole lock order.
- The options query joins `DischargeRepository`, the slice's read repository.
- The rules module is pure. The use cases pass it rows read under lock and write what it returns,
  so every rule is unit-tested at its edges without a database.
- Shift routes open a `/:dischargeId/shifts` group, which GH-63 and GH-64 will extend.

In the web:
- The sheets live under `ui/planning/`, apart from GH-53's `ui/detail/` correction sheets, so that
  GH-55's truck sheet can sit beside them without touching them.
- Cards only gain actions. Derivations live in `discharge-planning-view.ts`, unit-tested like
  `discharge-detail-view.ts`.
- `detail/access.test.tsx` gains the planning actions, and its observer half stays a regression
  check.

## Complexity Tracking

No constitution violation to justify. The choices that go beyond existing precedent are each
recorded where they are decided:

| Choice | Where decided |
|---|---|
| Change-set bodies rather than final sets | research.md Decision 2 |
| A move derived from the response rather than signalled by it | research.md Decision 3 |
| Partial unique indexes as a database backstop, the slice's only schema change | research.md Decision 7 |
| Hardening the single weighing area archive, outside the discharge slice | research.md Decision 5 |
