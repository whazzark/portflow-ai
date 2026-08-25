# Implementation Plan: Reactivate a Truck

**Branch**: `feat/226-reactivate-truck` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/transport-resources/trucks/reactivate-a-truck/spec.md`

## Summary

Close the truck lifecycle loop opened by Archive a Truck (`#225`): let an active organization
administrator or operations administrator return an archived truck to service — individually, or for
several selected trucks in one action — while preserving its identity, attributes, transport-company
relationship, and history. The API adds two endpoints, `POST /api/v1/trucks/:id/reactivate` and
`POST /api/v1/trucks/reactivate`, backed by a `reactivate/` use-case directory and two new
repository methods writing only lifecycle columns that already exist. No migration is required.

The one rule with no counterpart on the archive side is the transport-company gate: an archived
truck may not return to service under an archived provider, because `CONTEXT.md` records that a
transport company cannot be archived while it still provides available trucks, and both
`CreateTruckUseCase` and `UpdateTruckUseCase` already refuse an unavailable company. Enforcing it
with a plain read would leave a check-then-act window against a concurrent company archival, so the
repository locks the truck's company row `FOR UPDATE` before reading its status — the mirror image
of `LucidTruckRepository#create`, which already locks that same row before inserting an available
truck, and of `LucidTransportCompanyRepository#archiveAvailable`, which locks it before counting
available trucks. Whichever transaction takes the company lock first commits before the other
observes the state, so the invariant holds in both directions with no new locking concept.

On the web, the existing `/transport-resources` truck workspace gains the reactivate branch of the
lifecycle dialog and bulk toolbar it already renders for archival, and its selection model — today
deliberately restricted to the available tab because `#225` had no reverse action — extends to the
archived tab, exactly as `customers-page.tsx` already does for both directions.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js 22 toolchain

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, VineJS 4, Bouncer 4, Tuyau 1.2, TanStack Router 1.170 / Query 5.101, React 19.1, shadcn/Base UI, Luxon 3.7

**Storage**: PostgreSQL in runtime; in-memory SQLite through Lucid for automated API tests. No schema change: `trucks` already carries `status`, `reactivated_at`, `reactivated_by_user_id`, and `reactivation_comment` from List Trucks (`#222`, migration `1784900000000_create_trucks_table.ts`)

**Testing**: Japa 5.3 API unit/integration suites; Vitest 4.1, Testing Library, and MSW web feature tests

**Target Platform**: Linux-hosted API and server-rendered web application; modern desktop and mobile browsers

**Project Type**: PNPM/Turbo monorepo web application with separate API and web workspaces

**Performance Goals**: At least 90% of representative authorized administrators reactivate an intended truck, or understand why they cannot, within 45 seconds of opening it (SC-007); reactivation itself is one row-locked read of the truck, one row-locked read of its transport company, and one status-guarded `UPDATE`, all on indexed primary keys, with no scale concern beyond the 1,000-truck dataset already validated by List Trucks (`#222`)

**Constraints**: API remains authoritative for authentication, role-based reactivate authorization, and the transport-company gate; the invariant "no available truck under an archived transport company" must hold against a concurrent company archival, which forces the company row to be locked `FOR UPDATE` inside the same transaction as the truck write rather than read beforehand; company status must be assessed at submission time, not when the truck was listed or selected; repeated or near-simultaneous reactivation of the same truck must record exactly one reactivation, achieved through the same status-guarded update the archive path already uses; a multiple reactivation must be all-or-nothing over its eligible subset while still reporting per-truck reasons for the rest; no new table, column, dependency, or usage-rule implementation is introduced; a refused reactivation must leave the row byte-for-byte unchanged, including its archive context

**Scale/Scope**: Two new protected endpoints (`POST /api/v1/trucks/:id/reactivate`, `POST /api/v1/trucks/reactivate`); one new API `reactivate/` slice (two use cases, two repository methods, two exceptions, two validator entries, one policy method) plus a contained generalization of the existing `truck_lifecycle_blockers.ts` to classify against an expected status; on the web, the reactivate branch of the existing lifecycle dialog and bulk toolbar, selection extended to the archived tab, and `reactivate`/`reactivateMany` mutations. Permanent deletion, update (`#224`), and any change to a transport company's own lifecycle remain out of scope

## Constitution Check

### Pre-design gate

- **I. Selected feature intent is versioned — PASS**: GitHub issue #226 is selected on `feat/226-reactivate-truck`, and the reviewed `spec.md` is the behavioral contract.
- **II. One independently deliverable feature per spec — PASS**: Authorization, validation, the transport-company gate, persistence, and interface for reactivating trucks — one at a time or several at once — form one mergeable outcome around a single business decision ("may this truck return to service?"). Multiple reactivation adds no new rule, only another way to invoke the same one. The slice depends on Archive a Truck (`#225`) and List Trucks (`#222`), both already merged on this branch's history.
- **III. Vanilla Spec Kit gates protect product intent — PASS**: The spec carries no `[NEEDS CLARIFICATION]` markers. The one materially new rule — refusing reactivation under an archived transport company — was derived from a recorded domain invariant rather than silently invented, and is called out in the spec's assumptions and checklist notes for the human spec-review gate. This plan proceeds to the required human plan-review gate before task generation.
- **IV. Test-first observable behavior — PASS**: API behavior starts with Japa tests (`tests/{unit,integration}/trucks/lifecycle/reactivate.spec.ts` and `.../lifecycle/bulk/reactivate.spec.ts`) against real Lucid persistence, and web behavior with router-level Vitest/MSW feature tests (`features/trucks/__tests__/lifecycle/reactivate.test.tsx`, `__tests__/bulk/reactivate.test.tsx`, `__tests__/bulk/mixed-reactivate.test.tsx`, `__tests__/selection/archived-selection.test.tsx`), before implementation.
- **V. Deep boundaries and explicit contracts — PASS**: `ReactivateTruckUseCase` owns the single-truck business decisions and maps repository outcomes to domain exceptions, `ReactivateTrucksUseCase` owns the multiple-reactivation intent, `truck_lifecycle_blockers.ts` owns pure eligibility classification, `LucidTruckRepository` owns the lock-and-conditional-update mechanics, `TrucksController#reactivate`/`#reactivateMany` own HTTP adaptation, and Tuyau carries the typed contract to the web adapter. Delegating the transport-company availability decision to the repository — which enforces it under a lock and reports it as a discriminated outcome — is not a layering shortcut but the shape already reviewed and merged for `CreateTruckUseCase`, where the same invariant demands the same lock.
- **VI. Durable knowledge has a home — PASS**: The transport-company invariant is consumed from its recorded home in `CONTEXT.md` and enforced with the locking discipline already established by the create and company-archive paths, rather than restated as a new rule. The lifecycle comment and selection payload rules are imported from the existing shared `#shared/validators/lifecycle_validator`, not re-declared. `truck_lifecycle_blockers.ts` is generalized in place to take an expected status, mirroring `customer_lifecycle_blockers.ts`, rather than gaining a second parallel classifier for the reverse direction. No new vocabulary or ADR is required.
- **VII. Verification is part of delivery — PASS**: The quickstart defines focused API/web checks, the full repository gates, and the affected desktop/mobile browser flow required before merge, including the concurrency flow that proves the invariant.
- **VIII. One workflow owner — PASS**: Spec Kit artifacts stay in this feature directory; GitHub Project continues to own operational status.

### Post-design re-evaluation

**PASS**. The data model and HTTP contract confirm this slice writes only lifecycle columns that
already exist and introduces no schema migration, for both the single and the multiple path.

Two design points deserve the reviewer's attention and neither requires a constitution exception:

1. **The transport-company gate crosses a slice boundary in reads only.** Reactivation must read a
   transport company's status, which trucks already do in `CreateTruckUseCase`/`UpdateTruckUseCase`
   (through `TransportCompanyRepository`) and in `LucidTruckRepository#create` (through a locked
   `TransportCompany` query). This slice adds no new direction of coupling and writes nothing
   outside the `trucks` table — a company's own lifecycle state is never changed here.
2. **`findBulkBlockers` is generalized rather than duplicated.** The existing truck classifier
   hardcodes `AVAILABLE` as the expected status and `ALREADY_ARCHIVED` as the mismatch reason. It
   gains an `expectedStatus` parameter and two new reasons, converging on the shape
   `customer_lifecycle_blockers.ts` already has. The existing archive call site passes `'AVAILABLE'`
   and its behavior is unchanged, which the merged archive suites verify.

A third point is a product consequence rather than a design choice, and it needs the reviewer's
decision rather than a code change here: **neither remedy the company refusal names is implemented
today.** Reactivate a Transport Company (`#221`) is still in the backlog, and Update a Truck
(`#224`) refuses to reassign an archived truck's provider. Since Archive a Transport Company
(`#220`) deliberately allows archiving a company that still provides archived trucks, a truck can
reach a state it cannot leave until `#221` ships. The gate is still correct — the alternative is
breaking a live invariant — but prioritizing `#221` (or widening `#224`) is a call to make outside
this plan. research.md records the options.

The slice is materially smaller than `#225`: the selection model, the bulk toolbar, the lifecycle
dialog, the API test layout, and the Tuyau bulk envelope all already exist and are extended rather
than built. The genuinely new construction is the company gate and its locking test coverage.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/transport-resources/trucks/reactivate-a-truck/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── http-api.md
├── checklists/
│   └── requirements.md
└── tasks.md              # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/trucks_controller.ts                    # add `reactivate`, `reactivateMany`
│   ├── trucks/
│   │   ├── reactivate/
│   │   │   ├── reactivate_truck_use_case.ts                 # new
│   │   │   └── reactivate_trucks_use_case.ts                # new
│   │   ├── archive/                                         # unchanged
│   │   └── shared/
│   │       ├── repositories/
│   │       │   ├── truck_repository.ts                      # add 2 methods + command/result types
│   │       │   └── lucid_truck_repository.ts                # add 2 methods (company row locked)
│   │       ├── truck_lifecycle_blockers.ts                  # add `expectedStatus` + 2 reasons
│   │       ├── truck_policy.ts                              # add `reactivate`
│   │       ├── truck_validator.ts                           # add reactivate + reactivateMany validators
│   │       ├── truck_exceptions.ts                          # add 2 lifecycle exceptions
│   │       └── truck_transformer.ts                         # unchanged
├── start/routes.ts                                          # add both reactivate routes
└── tests/
    ├── support/trucks/lifecycle_fixtures.ts                  # add archived-truck / archived-company scenarios
    ├── unit/trucks/lifecycle/reactivate.spec.ts              # new
    ├── unit/trucks/lifecycle/bulk/reactivate.spec.ts         # new
    ├── integration/trucks/lifecycle/reactivate.spec.ts       # new
    └── integration/trucks/lifecycle/bulk/reactivate.spec.ts  # new

apps/web/src/
└── features/trucks/
    ├── types.ts                                              # widen bulk result to both routes
    ├── mutations/use-truck-mutations.ts                      # add `reactivate`, `reactivateMany`
    ├── ui/
    │   ├── truck-lifecycle-actions.tsx                        # add the reactivate branch
    │   ├── truck-bulk-lifecycle-actions.tsx                   # add `isArchived`; 2 new reason labels
    │   ├── truck-details.tsx                                  # render a footer for archived trucks
    │   ├── truck-section.tsx                                  # unchanged (already threads selection)
    │   └── trucks-page.tsx                                    # selection + toolbar in the archived tab
    └── __tests__/
        ├── lifecycle/reactivate.test.tsx                     # new
        ├── bulk/reactivate.test.tsx                          # new
        ├── bulk/mixed-reactivate.test.tsx                    # new
        └── selection/archived-selection.test.tsx             # new
```

**Structure Decision**: Extend the existing `trucks` vertical slice by adding a `reactivate/`
use-case directory beside `archive/`, `create/`, `update/`, `list/`, and `available/` — the layout
`customers` and `docks` already use for the same transition. Persistence stays inside
`LucidTruckRepository` as two new methods on the existing model; no migration, table, or column is
added, and no file outside the trucks slice is modified on the API side. API tests extend the
`lifecycle/` and `lifecycle/bulk/` folders created by `#225`, and the shared truck lifecycle
fixtures gain the archived-truck and archived-company scenarios this slice needs.

On the web, no new component, route, or interaction pattern is introduced. `TruckLifecycleActions`
and `TruckBulkLifecycleActions` gain their reverse branch, converging on the shape
`features/customers/ui/lifecycle-actions.tsx` and `bulk-lifecycle-actions.tsx` already have.
`truck-details.tsx` currently renders its action footer only for available trucks; it renders one
for archived trucks too, carrying the reactivate action alone — archived trucks stay read-only, so
no edit control is offered. `trucks-page.tsx` lifts the available-only restriction on selection that
`#225` documented as deliberate: `visibleSelectedTruckIds` prunes against the trucks listed in the
active lifecycle tab rather than returning an empty set outside the available tab, and the bulk
toolbar receives which direction it is acting in — the pattern `customers-page.tsx` already runs.
Generated route tree, controller/policy registries, and Tuyau types are refreshed through existing
generators rather than edited manually.

## Complexity Tracking

No constitution violations require justification.
