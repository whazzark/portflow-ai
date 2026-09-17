# Implementation Plan: Confirm Discharge Start With Conflict Protection and Handling

**Branch**: `whazzark/confirm-discharge-start-with-conflict-protection` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/confirm-discharge-start-with-atomic-conflict-protection/spec.md`

## Summary

Let a preparer review a planned discharge and start it in one deliberate action that makes the
discharge and its earliest planned shift active together. The start is refused, with every problem
listed, when the preparation is incomplete, a reference is archived, the responsible is ineligible,
or another active discharge already holds the dock, a truck of the pool, or a current warehouse door.

In `apps/api`, the `discharges` slice gains a `start/` folder, authorized by a new
`DischargePolicy.start` ability:
- `GET /discharges/:id/start-check` evaluates the start rules on unlocked reads and returns
  `{ dischargeId, shiftId, problems }`.
- `POST /discharges/:id/start` locks the discharge `FOR UPDATE`, then claims the dock, every held
  truck, and every current door `FOR NO KEY UPDATE`. Shared references are locked `FOR SHARE` in the
  existing lock order. The command then queries the other active holders and evaluates the same rules.
  It either answers `409 E_DISCHARGE_START_REFUSED` with `meta.problems`, or writes both status
  transitions with the confirmation instant and actor, and answers with the detail.
- The pure `discharge_start_rules.ts` holds every rule and the closed problem taxonomy (four
  families, fifteen codes).

One migration adds `discharges.started_at` and `started_by_user_id`, and `shifts.actual_start_at`
and `started_by_user_id`, with a backfill. It also adds partial unique indexes for one active
discharge per dock and one active shift per discharge. The detail exposes the new fields, and the
seed sets them.

In `apps/web`:
- The detail header's reserved `actions` slot gains `Start`, for preparers on a planned discharge.
- `Start` opens `StartDischargeDialog`. It reviews the preparation from the cached detail and the
  check's shift, lists the problems grouped by kind of element, and
  confirms once none is left.
- A refusal refreshes the list in place. A stale answer follows the existing toast-and-close pattern.
- Success writes the returned detail. The existing `canCorrect` gating then removes every planning
  action.
- The pure `discharge-start-view.ts` builds the review and the problem lines.

The slice records no activity log entry and changes no pool, assignment, or selection row.

## Technical Context

**Language/Version**: TypeScript on the repository's Node.js ESM runtime (`apps/api` AdonisJS,
`apps/web` TanStack Start)

**Primary Dependencies**:
- API: AdonisJS 7, Lucid, Bouncer, VineJS 4, and Luxon, all already dependencies.
- Web: Tuyau 1.2, TanStack Start/Router/Query 5, React 19, shadcn/Base UI (`Dialog`, `Alert`,
  `Button`, `Skeleton`), sonner, and Tailwind CSS 4.
- No new dependency.

**Storage**: Existing PostgreSQL tables through Lucid:
- Written: `discharges` (`status`, `started_at`, `started_by_user_id`) and one `shifts` row
  (`status`, `actual_start_at`, `started_by_user_id`).
- Locked `FOR NO KEY UPDATE`: `docks`, `trucks`, `warehouse_doors`.
- Locked `FOR SHARE`: `customers`, `users`, `warehouses`, `weighing_areas`.
- Read: `product_lots`, `discharge_truck_assignments`, `warehouse_door_product_lot_assignments`,
  `shift_trucks`, `shift_warehouse_doors`, `shift_weighing_areas`, and other `discharges`.
- One migration: four nullable columns, a backfill, and two partial unique indexes (data-model.md).
- Seed updated to set the start columns.

**Testing**:
- **API unit (Japa):** the rules module at every code and combination, both use cases with stubbed
  repositories, the lock order, and the policy ability.
- **API integration (Japa, SQLite):**
  - both routes, for 401, 403, each preparing role, 404, 409 not planned, and each problem family;
  - the successful start's rows and detail, and that nothing else changed;
  - replay, the backfill-shaped detail, and both partial unique indexes;
  - a `Promise.all` race of two starts sharing a truck.
- **Web:** Vitest with jsdom, Testing Library, and MSW through the real router. Pure unit tests cover
  `discharge-start-view.ts`.
- **PostgreSQL:** the race and lock behavior are validated through `quickstart.md`. Playwright is not
  set up in `apps/web`.

**Target Platform**: Authenticated responsive web workstation backed by the Node.js API

**Project Type**: PNPM/Turbo monorepo web application (`apps/api` + `apps/web`)

**Performance Goals**: For 20 lots, 50 held trucks, and 40 planned shifts, the review opens and a
confirmation result shows within 3 seconds for 95% of attempts (SC-007).
- The check runs a fixed set of statements: the discharge, lots with customers, current assignments
  with doors and warehouses, the pool, the earliest planned shift with its responsible and current
  selections with statuses, and three holder queries.
- The command adds one lock statement per locked table and two updates, then the existing detail
  read.

**Constraints**:
- The API is authoritative for authorization and every rule. The web only words and links problems.
- The check and the command share one rules function (FR-016, spec Edge Cases).
- The start is all-or-nothing (FR-007, FR-021).
- No two active discharges ever hold one dock, truck, or door (SC-002).
- Planning rows are never written by the start (FR-009).
- The lock order stays compatible with every existing writer and archive (research.md Decision 4).

**Scale/Scope**:
- **API:**
  - Endpoints: two use cases (check, start) and one controller with two actions.
  - Domain: one pure rules module, one policy ability, and two exceptions (start refused, and the
    mapping of index conflicts).
  - Persistence: one repository port and its Lucid implementation (start state reads, claim locks,
    holder queries, activation write), and one migration.
  - Existing code: detail transformer, fixture, and repository-contract comment updates.
- **Web:**
  - UI: one dialog, one header action, and start details in the header and the shift card.
  - Data: one query and one mutation.
  - View logic: one pure view module.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Selected intent**: PASS. Issue #56 is selected. Its spec was clarified on 2026-09-17, and three
  inconsistencies found while planning were corrected in it (research.md, introduction). The plan
  leaves out GH-65's shift workspace, GH-69's later starts, GH-70's corrections, GH-75 to GH-78's
  runtime changes, and GH-102's activity log.
- **II. Independent delivery**: PASS. One vertical slice: the command in `apps/api` and the dialog in
  `apps/web`, mergeable as one PR. Its blockers, GH-54 and GH-55, are delivered.
- **III. Human gates**: PASS. The product question was settled with the product owner. The three
  spec corrections are called out for spec review. Human review of this plan is required before
  `/speckit-tasks`.
- **IV. Test-first behavior**: PASS. Every requirement maps to an observable seam:
  - API unit tests: each problem code at its edge (suspended versus archived truck, door versus
    warehouse archived, ended versus current rows, planned and closed holders ignored, no planned
    shift), ordering, all problems at once, the chosen shift, and the lock order.
  - API integration tests: each route's authorization and status answers; one representative refusal
    per family, asserting nothing changed; the successful start's rows; replay; the indexes; the race.
  - Web unit tests: the review grouping, and each code's text, fallback, and link.
  - Web feature tests: the action per role and status, the review, the problem states, the refusal
    refresh, each stale outcome, success, and the post-start detail.
- **V. Deep boundaries**: PASS.
  - **Use cases** own the transaction, the lock sequence, and exception mapping.
  - **The repository** owns locked and unlocked reads, holder queries, and the activation write,
    including mapping index violations to an outcome.
  - **The rules module** is pure.
  - **The controller** authorizes and serializes.
  - **The web dialog** owns mutation outcomes, the view module owns derivations, and the header only
    renders the action.
- **VI. Durable knowledge**: PASS. `CONTEXT.md` already defines the Discharge Start Confirmation, the
  Active Shift, and each exclusivity. The claim-lock obligation for runtime slices is recorded in the
  `DischargePreparationRepository` contract comment, where GH-53 recorded the lock order, and in
  research.md Decision 4. No ADR: the lock discipline is a documented extension of an existing one.
- **VII. Verification**: PASS. `quickstart.md` lists the API, race, and screen validations, the
  targeted suites, `db:fresh`, `pnpm check`, `pnpm typecheck`, `pnpm test`, and the fresh review.
- **VIII. One workflow owner**: PASS. No delivery state machine, Project field, or orchestrator is
  introduced. The discharge and shift statuses are product states.

**Post-design re-check**: PASS. Phase 1 adds two routes, four columns, and two indexes, and no
table. It bypasses no authorization and adds no cross-feature import in the web. The changes outside
the new `start/` folders are listed below, each with its reason:

| Change | Reason |
|---|---|
| `DischargePolicy.start` | Authorize the start separately from corrections (Decision 1) |
| Detail transformer and `findDetail` preload `startedBy` on discharge and shifts | The detail shows who started and when (FR-007, FR-026) |
| `DischargePreparationRepository` contract comment | Adds the claim lock mode and the runtime obligation (Decision 4) |
| Seed sets start columns | `db:fresh` matches a migrated database (Decision 6) |
| `DischargeDetailHeader` receives `actions`; `DischargeShiftsCard` shows the actual start | Reserved slot filled; FR-026 |
| `STALE_DETAIL_CODES` unchanged, `staleRefusalMessage` unchanged | The start reuses them without new stale codes |

None of them changes an existing page's behavior for a planned discharge apart from the new button.
The existing detail, access, and preparation-summary tests pin that.

## Project Structure

### Documentation (this feature)

```text
specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/confirm-discharge-start-with-atomic-conflict-protection/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── discharge-start.openapi.yaml
│   └── ui-state.md
├── checklists/requirements.md
└── tasks.md             # Created later by /speckit-tasks, not by this plan
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/
│   │   └── discharge_start_controller.ts                      # new: check(), store()
│   ├── discharges/
│   │   ├── start/
│   │   │   ├── discharge_start_rules.ts                       # new: evaluateDischargeStart, StartProblem taxonomy
│   │   │   ├── check_discharge_start_use_case.ts              # new: unlocked snapshot → rules
│   │   │   ├── start_discharge_use_case.ts                    # new: transaction, lock sequence, refusal or activation
│   │   │   └── discharge_start_exceptions.ts                  # new: DischargeStartRefusedException (409, meta)
│   │   └── shared/
│   │       ├── discharge_policy.ts                            # add start()
│   │       ├── discharge_detail_transformer.ts                # add startedAt/startedBy, shifts' actualStartAt/startedBy
│   │       └── repositories/
│   │           ├── discharge_start_repository.ts              # new port: readStartState, claimDock/Trucks/WarehouseDoors, findActiveHolders, activate
│   │           ├── lucid_discharge_start_repository.ts        # new
│   │           ├── discharge_preparation_repository.ts        # contract comment: claim locks and runtime obligation
│   │           └── lucid_discharge_repository.ts              # findDetail preloads start actors
│   └── models/{discharge,shift}.ts                            # startedBy relations
├── database/
│   ├── migrations/1786300000000_add_discharge_start_confirmation.ts  # new: columns, backfill, partial unique indexes
│   ├── schema.ts                                              # regenerated
│   └── fixtures/discharge_preparation.ts                      # start columns for active and closed scenarios
├── providers/repositories_provider.ts                         # bind DischargeStartRepository
├── start/routes.ts                                            # GET :id/start-check, POST :id/start
├── .adonisjs/                                                 # regenerated Tuyau registry and controllers, committed
└── tests/
    ├── unit/discharges/start/{rules,check_discharge_start,start_discharge,lock_order,policy}.spec.ts
    └── integration/discharges/start/
        ├── start_scenario.ts                                  # new: a startable discharge built on preparation_scenario.ts
        ├── start_check.spec.ts
        ├── start.spec.ts                                      # success, rows, detail, replay, authorization
        ├── start_refusals.spec.ts                             # one representative per family, nothing changed
        ├── active_indexes.spec.ts                             # both partial unique indexes
        └── start_race.spec.ts                                 # Promise.all race, no global transaction

apps/web/src/features/discharges/
├── discharge-start-view.ts                                    # new: startReview(detail, shiftId), describeStartProblem(problem, detail)
├── types.ts                                                   # StartCheckDto, StartProblemDto
├── queries/discharge-queries.ts                               # add startCheck(id)
├── mutations/use-discharge-mutations.ts                       # add start
├── ui/
    ├── start/
    │   ├── start-discharge-action.tsx                         # new: header button + dialog state
    │   ├── start-discharge-dialog.tsx                         # new
    │   ├── start-review.tsx                                   # new: lots, doors, pool count, starting shift
    │   └── start-problems.tsx                                 # new: grouped problems with links
    └── detail/
        ├── discharge-detail-page.tsx                          # passes <StartDischargeAction> to the header when canCorrect
        ├── discharge-detail-header.tsx                        # Started … by … on non-planned discharges
        └── discharge-shifts-card.tsx                          # actual start and starter on started shifts
└── __tests__/
    ├── support/{fixtures.ts,test-helpers.ts}              # start fields on builders; mockDischargeStart
    ├── discharge-start-view.test.ts                       # new, unit
    ├── detail/access.test.tsx                             # updated: Start for preparers on planned only
    └── start/{start-review,start-problems,start-refusals,start-stale,start-success}.test.tsx
```

**Structure Decision**: Extend the delivered discharge slice with a `start/` action folder on both
sides.

In the API:
- The start is an action on the discharge, but its reads, claim locks, holder queries, and status
  write are not preparation. They get their own `DischargeStartRepository` rather than growing
  `DischargePreparationRepository` further.
- The use case still takes the discharge lock through `lockPlannedDischarge` and the shared `FOR
  SHARE` locks through the preparation repository's existing methods (`lockCustomers`, `lockUsers`,
  `lockWeighingAreas`). That keeps the order defined in one contract comment, and the lock-order
  unit test pins it across both repositories.
- The rules module is pure, and both use cases feed it, so the check and the command cannot diverge.
- A dedicated controller keeps `DischargesController` to reads and identity writes, as GH-54 did for
  lot doors.

In the web:
- The dialog lives under `ui/start/`, beside `ui/planning/`, and the header only receives it as
  `actions`.
- Derivations live in `discharge-start-view.ts`, unit-tested like `discharge-planning-view.ts`.
- `detail/access.test.tsx` gains the start action, and its observer half stays a regression check.

## Complexity Tracking

No constitution violation to justify. The choices that go beyond existing precedent are each
recorded where they are decided:

| Choice | Where decided |
|---|---|
| `FOR NO KEY UPDATE` claim locks on docks, trucks, and doors | research.md Decision 4 |
| A `409` refusal carrying a problem list in `meta` rather than `422` field issues | research.md Decision 3 |
| A second repository in the discharge slice for the start | Structure Decision above |
| Start columns on both discharges and shifts, with a backfill | research.md Decision 6 |
| Partial unique indexes on active dock and active shift | research.md Decision 5 |
