# Implementation Plan: Plan the Discharge Truck Pool and Shift Subsets

**Branch**: `whazzark/plan-the-discharge-truck-pool-and-shift-subsets` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/plan-the-discharge-truck-pool-and-shift-subsets/spec.md`

## Summary

Let a preparer choose which trucks a planned discharge holds, and which of those trucks each
planned shift uses. Planned discharges may compete for the same truck, and the competition stays
visible until the start confirmation settles it.

### API (`apps/api`)

The `discharges` slice gains four routes, all authorized by the existing
`DischargePolicy.update`:
- `GET …/:dischargeId/truck-pool/candidates` lists the available trucks the discharge does not
  hold, each with the other planned or active discharges holding it.
- `POST …/:dischargeId/truck-pool` reserves a set of trucks. It captures their registration and
  transport company, and reactivates a released row instead of duplicating it.
- `POST …/:dischargeId/truck-pool/withdrawals` deletes the reservations of a set of trucks. It also
  deletes their current selections in the discharge's planned shifts.
- `PUT …/:dischargeId/shifts/:shiftId/trucks` replaces a planned shift's selection by computing the
  difference.

Every write is a set operation, so replays are harmless. Every write answers with the discharge
detail, whose pool entries gain `otherHoldings`.

Refusals keep GH-53's scheme:
- `422 E_VALIDATION_ERROR` at `truckIds.N`, with the rules `availableTruck`, `heldTruck`, and
  `selectableTruck`;
- `409 E_DISCHARGE_NOT_PLANNED`;
- the new `404 E_SHIFT_NOT_FOUND` and `409 E_SHIFT_NOT_PLANNED`.

Writes lock the discharge `FOR UPDATE`, then the trucks they newly use `FOR SHARE`. That closes the
race with truck archive and suspension. The truck transport-company change, which checked usage
without a lock, is hardened in the same way GH-53 hardened the dock and customer archives.

### Web (`apps/web`)

On a planned discharge's detail, preparers get:
- **Truck pool card**: `Add trucks`, row selection, and `Withdraw`. The `Add trucks` sheet
  searches candidates; the `Withdraw trucks` confirmation names the planned shifts affected.
- **Shifts card**: each planned shift's Trucks group gets `Edit`, which opens a `Shift trucks`
  sheet with a checklist of the held trucks.

Every role sees an `Also held` marker on pool entries that other discharges hold. Selection state
reuses `useBulkSelection`; `422` details are mapped back to rows by a pure adapter.

### Durable vocabulary

The PR amends `CONTEXT.md` for the new exclusivity rule and the Truck Pool Withdrawal term. It
changes no table and no seed, and records no activity log entry.

## Technical Context

**Language/Version**: TypeScript on the repository's Node.js ESM runtime (`apps/api` AdonisJS,
`apps/web` TanStack Start)

**Primary Dependencies**:
- API: AdonisJS 7, Lucid, Bouncer, VineJS 4, and Luxon, all already dependencies.
- Web: Tuyau 1.2, TanStack Start/Router/Query 5, React 19, shadcn/Base UI (`Sheet`,
  `AlertDialog`, `Checkbox`, `Table`, `Badge`, `Alert`, `Empty`, `InputSearch`), sonner, and
  Tailwind CSS 4.
- No new dependency.

**Storage**: Existing PostgreSQL tables through Lucid:
- Written: `discharge_truck_assignments` (insert, reactivate, delete), `shift_trucks` (insert,
  delete), and `discharges.updated_at`.
- Read under lock: `discharges` (`FOR UPDATE`), and `trucks` joined to `transport_companies`
  (`FOR SHARE`).

No migration and no seed change (research.md Decision 11).

**Testing**:
- API unit tests (Japa): `truck_pool_rules` at every edge, the validators' bounds, and the use cases
  with stubbed repositories asserting lock order and write plans.
- API integration tests (Japa) on the existing factories: all four routes, `otherHoldings` on
  `discharges.show`, and the hardened truck company change.
- Web (Vitest with jsdom, Testing Library, and MSW, through the real router): feature tests for the
  pool card, both sheets, the confirmation, and the tabbed detail. Pure unit tests for the
  selection, refusal, and section adapters.
- Playwright is not set up in `apps/web`, and is out of scope, as for GH-53 and GH-58.

**Target Platform**: Authenticated responsive web workstation backed by the Node.js API

**Project Type**: PNPM/Turbo monorepo web application (`apps/api` + `apps/web`)

**Performance Goals**: For 300 site trucks and a pool of 50 trucks across 40 planned shifts, the
offer and every saved change are shown within 2 seconds for at least 95% of attempts (SC-007).
- The candidates read is two queries.
- Each write is a fixed number of statements: one lock per table and one batched insert or delete
  per table, followed by the existing detail read.
- The detail read gains one query for holdings.

**Constraints**:
- The API is authoritative for authorization and every rule; the web only mirrors it.
- Writes are atomic and idempotent.
- No reservation is refused because another discharge holds the truck.
- After every accepted write, every current selection of a planned shift is held by the discharge.
- Withdrawal leaves no released row.
- No write on active or closed discharges, nor on a shift that is not planned.
- No door, checkpoint, or shift schedule write.

**Scale/Scope**:
- **API**: one read and three writes, two controllers, four use cases, one rules module, one
  validator module, two exceptions, repository additions to `DischargePreparationRepository` and
  `DischargeRepository`, a detail read model, and one hardened truck use case.
- **Web**: two sheets, one confirmation dialog, one holdings badge component, two card changes, one
  query, three mutations, and two pure adapters.
- **Documentation**: `CONTEXT.md` amended, and the requirements checklist notes refreshed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Selected intent**: PASS. Issue #55 is selected. Its spec was clarified on 2026-09-15 with
  four answers and is the contract. The plan does not reach into GH-54, GH-56, GH-76, or GH-78. It
  only records the lock obligations they inherit (research.md Decision 4).
- **II. Independent delivery**: PASS. This is one vertical slice, mergeable as one PR. Its blocker,
  GH-53, is delivered, and so are GH-58's detail and GH-236's model. GH-54 may merge before or
  after; both only add actions to separate cards.
- **III. Human gates**: PASS. The product questions were settled through `/speckit-clarify` before
  planning. Human review of this plan is required before `/speckit-tasks`.
- **IV. Test-first behavior**: PASS. Every requirement has an observable seam:
  - API unit tests: the rules module, covering reservation plans, withdrawal plans, the selection
    difference, and issue precedence.
  - API integration tests: for each route, 401, 403, each role's success, 404, 409, and every 422
    rule, each asserting nothing changed. Also the idempotent replays, reactivation, the
    withdrawal cascade, and `otherHoldings`.
  - Web unit tests: the two adapters.
  - Web feature tests: every row of `contracts/ui-state.md`'s outcome tables, and the observer and
    active-discharge regressions.
- **V. Deep boundaries**: PASS.
  - **Use cases** own the transaction, the lock order, and exception mapping.
  - **The rules module** is pure and decides issues and write plans.
  - **Repositories** own locked reads, batched writes, and the malformed-id guard.
  - **Controllers** authorize, validate, and serialize.
  - **Web**: cards and sheets own mutation outcomes, adapters are pure, and the route file does not
    change.
- **VI. Durable knowledge**: PASS. The first clarification changes a rule stated in `CONTEXT.md`
  (Truck), so the PR amends it and adds the Truck Pool Withdrawal term (research.md Decision 10). No
  ADR is needed: the lock and refusal patterns extend GH-53's.
- **VII. Verification**: PASS. `quickstart.md` lists the API and screen validations, the targeted
  suites, `pnpm check`, `pnpm typecheck`, `pnpm test`, and the fresh review.
- **VIII. One workflow owner**: PASS. No delivery state machine, Project field, or orchestrator is
  introduced.

**Post-design re-check**: PASS. Phase 1 adds four routes and no table, bypasses no authorization,
and adds no cross-feature import in the web: candidate search uses the shared `helpers/search`
normalization. The changes outside the two slices are listed below, each with its reason:

| Change | Reason |
|---|---|
| `UpdateTruckUseCase` company change locks the truck and checks usage in one transaction | Keeps "no company change while a planned or active discharge holds the truck" true against the new writer (Decision 4) |
| `DischargeRepository.findDetail` returns a `DischargeDetailRead`; GH-53's five write controllers and `show` pass it to the transformer | `otherHoldings` on every detail response (Decision 3) |
| `CONTEXT.md` Truck and Discharge Truck Assignment amended; Truck Pool Withdrawal added | Clarification 1 and 3 changed domain rules (Decision 10) |

None of these changes the behavior of an existing page or endpoint, apart from the additive
`otherHoldings` field. The existing truck update, detail, and GH-53 tests pin that.

## Project Structure

### Documentation (this feature)

```text
specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/plan-the-discharge-truck-pool-and-shift-subsets/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── truck-pool.openapi.yaml
│   └── ui-state.md
├── checklists/requirements.md   # notes refreshed in the PR (Decision 10)
└── tasks.md                     # Created later by /speckit-tasks, not by this plan
```

### Source Code (repository root)

```text
CONTEXT.md                                                     # Truck, Discharge Truck Assignment amended; Truck Pool Withdrawal added

apps/api/
├── app/
│   ├── controllers/
│   │   ├── discharge_truck_pool_controller.ts                 # new: candidates(), store(), withdraw()
│   │   ├── discharge_shift_trucks_controller.ts               # new: update()
│   │   ├── discharges_controller.ts                           # show/store/update pass DischargeDetailRead
│   │   └── discharge_product_lots_controller.ts               # same
│   ├── discharges/
│   │   ├── truck_pool/
│   │   │   ├── list_truck_candidates_use_case.ts              # new
│   │   │   ├── reserve_trucks_use_case.ts                     # new
│   │   │   ├── withdraw_trucks_use_case.ts                    # new
│   │   │   ├── select_shift_trucks_use_case.ts                # new
│   │   │   └── truck_pool_validators.ts                       # new: truckIdsValidator (1..500), shiftTruckSelectionValidator (0..500)
│   │   └── shared/
│   │       ├── truck_pool_rules.ts                            # new: pure planReservation, planWithdrawal, planShiftSelection, issues
│   │       ├── discharge_exceptions.ts                        # add ShiftNotFoundException, ShiftNotPlannedException
│   │       ├── discharge_detail_transformer.ts                # takes DischargeDetailRead; truckPool[].otherHoldings
│   │       ├── discharge_detail_read.ts                       # new: DischargeDetailRead, OtherHolding types
│   │       └── repositories/
│   │           ├── discharge_preparation_repository.ts        # add lockTrucks, listTruckPool, findShift, listCurrentShiftTruckSelections, write methods
│   │           ├── lucid_discharge_preparation_repository.ts  # implement them
│   │           ├── discharge_repository.ts                    # findDetail → DischargeDetailRead; add listTruckCandidates
│   │           └── lucid_discharge_repository.ts              # holdings query; candidates query
│   └── trucks/
│       ├── update/update_truck_use_case.ts                    # company change: lock + usage check in one transaction
│       └── shared/repositories/{truck_repository,lucid_truck_repository}.ts  # locked company reassignment
├── start/routes.ts                                            # truck-pool and shift trucks routes in the discharges group
├── .adonisjs/                                                 # regenerated Tuyau registry and controllers, committed
└── tests/
    ├── unit/discharges/truck_pool/{rules,validators,reserve,withdraw,select_shift_trucks}.spec.ts
    └── integration/
        ├── discharges/truck_pool/{candidates,reserve,withdraw,select_shift_trucks,detail_holdings}.spec.ts
        ├── discharges/preparation/preparation_scenario.ts     # extended: trucks, pool rows, shift selections
        └── trucks/administration/update.spec.ts               # extended: company change still refused while held (location per existing file)

apps/web/src/features/discharges/
├── truck-pool-selection.ts                                    # new, pure: held trucks, affected shifts, offered shift trucks, candidateMatchesSearch
├── truck-pool-refusals.ts                                     # new, pure: truckIds.N details → per-truck reasons
├── discharge-detail-sections.ts                               # new, pure: section guard, tab search, tab counts, preparation summary
├── types.ts                                                   # add DISCHARGE_DETAIL_TABS
├── queries/discharge-queries.ts                               # add truckCandidates(dischargeId)
├── mutations/use-discharge-mutations.ts                       # add reserveTrucks, withdrawTrucks, selectShiftTrucks; stale codes
├── ui/detail/
│   ├── discharge-detail-page.tsx                              # header and section tabs; the open section from the URL
│   ├── discharge-detail-header.tsx                            # new: back link, vessel, status, facts line, actions place
│   ├── discharge-detail-tabs.tsx                              # new: section tabs with counts, one panel at a time
│   ├── discharge-preparation-card.tsx                         # new: Overview's preparation summary (planned only)
│   ├── discharge-tab-link.tsx                                 # new: link to another section, keeping list state
│   ├── discharge-detail-pending.tsx                           # skeleton shaped like header, tabs, one panel
│   ├── discharge-truck-pool-card.tsx                          # selection, Add trucks, Withdraw, holdings badge
│   ├── discharge-shifts-card.tsx                              # Edit on planned shifts' Trucks group; empty-pool pointer
│   ├── truck-holdings.tsx                                     # new: Also held badge and holding text
│   ├── add-trucks-sheet.tsx                                   # new
│   ├── withdraw-trucks-dialog.tsx                             # new
│   └── shift-trucks-sheet.tsx                                 # new
└── __tests__/
    ├── support/{fixtures.ts,test-helpers.ts}                  # candidates fixtures; mockTruckPlanning (stateful, like mockDischargeCorrections)
    ├── truck-pool-selection.test.ts                           # new, unit
    ├── truck-pool-refusals.test.ts                            # new, unit
    ├── discharge-detail-sections.test.ts                      # new, unit
    └── detail/
        ├── truck-pool.test.tsx                                # updated: holdings badge for every role; no actions for observers and active
        ├── reserve-trucks.test.tsx                            # new
        ├── withdraw-trucks.test.tsx                           # new
        ├── shift-trucks.test.tsx                              # new
        ├── tabs.test.tsx                                      # new
        └── preparation-summary.test.tsx                       # new
```

**Structure Decision**: Extend the discharge slice with GH-53's mutation shape.

In the API:
- The four actions share one `truck_pool/` folder, because they share the rules module, the
  validators, and the pool vocabulary.
- The shift selection gets its own controller, because its route nests under a shift.
- Locked reads and writes join `DischargePreparationRepository`, because `lockPlannedDischarge`
  already works on it and every write needs that lock.
- The candidates read and the holdings join `DischargeRepository`, which stays read-only.
- Route parameters are guarded with `isUuid` in the repository, so a malformed identity is a `404`,
  as in GH-53.

In the web:
- The sheets and the dialog live beside the cards that open them.
- The adapters sit at the feature root beside `discharge-preparation-schema.ts`.
- One optional search parameter, `tab`, on the detail route, and a search middleware on the list
  route that drops it (research Decision 12). Every existing detail test opens its section through
  `renderDischargeTab`.
- The existing `truck-pool.test.tsx` and `shifts.test.tsx` keep their observer and read assertions
  as regressions.

## Complexity Tracking

No constitution violation to justify. The choices that go beyond existing precedent are each
recorded where they are decided:

| Choice | Where decided |
|---|---|
| Planned discharges may hold the same truck; exclusivity deferred to GH-56 | spec Clarifications; research.md Decision 4 |
| Withdrawal deletes the reservation rather than releasing it | spec Clarifications; research.md Decision 5 |
| A typed detail read model instead of model extras | research.md Decision 3 |
| Selection state without `useAppForm`, with a pure refusal adapter | research.md Decision 9 |
| Hardening the truck transport-company change, outside the discharge slice | research.md Decision 4 |
