# Implementation Plan: Update a Truck

**Branch**: `feat/224-update-truck` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/transport-resources/trucks/update-a-truck/spec.md`

## Summary

Add the truck correction slice that Create a Truck (`#223`) deferred: let an active organization
administrator or operations administrator correct an available truck's registration, vehicle model,
and capacity, and reassign it to another available transport company when the truck is not committed
to a planned or active discharge. The API adds one `PATCH /api/v1/trucks/:id` endpoint backed by an
`update` use case, two new `TruckRepository` methods (`findById`, `updateAvailable`), and three new
truck exceptions; the discharge-commitment rule reuses the already-delivered
`SiteReferenceUsageChecker.findUsedByPlannedOrActiveDischarge` with its existing `'TRUCK'` branch, so
no new persistence read is written. No migration is required: registration uniqueness is already
enforced by the `trucks_registration_unique` functional index created by List Trucks (`#222`). On the
web side, the existing Trucks workspace gains a URL-addressable edit mode reusing the delivered
`TruckForm`, following the `EditTransportCompanyPanel` / `CustomerForm` composition already proven in
this workspace.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js 22 toolchain

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, VineJS, Bouncer 4, Tuyau 1.2, TanStack Start/Router 1.168/1.170, TanStack Query 5.101, React 19.1, Zod 4.4, shadcn/Base UI

**Storage**: PostgreSQL in runtime; in-memory SQLite through Lucid for automated API tests. No schema change: reuses the `trucks` table, the `trucks_registration_unique` functional index, and the `discharge_truck_assignments` table already created by earlier slices

**Testing**: Japa 5.3 API unit/integration suites; Vitest 4.1, Testing Library, and MSW web feature tests

**Target Platform**: Linux-hosted API and server-rendered web application; modern desktop and mobile browsers

**Project Type**: PNPM/Turbo monorepo web application with separate API and web workspaces

**Performance Goals**: At least 90% of representative authorized administrators complete a correction within 60 seconds of opening the truck (SC-008); 95% of submissions return a confirmation or explicit refusal within 2 seconds (SC-009). The write is a single-row conditional UPDATE plus at most two indexed lookups, so no scale concern arises beyond the 1,000-truck dataset already validated by List Trucks (`#222`)

**Constraints**: API remains authoritative for authentication, role-based update authorization, the available-transport-company rule, the archived-truck read-only rule, and the discharge-commitment rule; registration uniqueness must hold under concurrent submissions using the existing unique index rather than a new locking mechanism; existing `discharge_truck_assignments` rows must remain untouched; no new table, column, tenant/site key, or dependency is introduced; an update never writes lifecycle status or archive/reactivation context

**Scale/Scope**: One new protected `PATCH /api/v1/trucks/:id` endpoint; one new API update slice (use case, validator, three exceptions, policy ability, controller action); two new `TruckRepository` methods; one new API test support helper for truck discharge usage; web changes limited to one new route search parameter, one generalized form, one new edit panel, one new mutation, and a guarded action on the existing details view; archive and reactivate remain independently deliverable follow-up issues (`#225`, `#226`)

## Constitution Check

### Pre-design gate

- **I. Selected feature intent is versioned — PASS**: GitHub issue #224 is selected on `feat/224-update-truck`, and the reviewed `spec.md` is the behavioral contract.
- **II. One independently deliverable feature per spec — PASS**: Authorization, validation, the discharge-commitment rule, persistence, and interface for correcting one truck form a single mergeable outcome; archive and reactivate remain issues #225 and #226.
- **III. Vanilla Spec Kit gates protect product intent — PASS**: The spec carried no `[NEEDS CLARIFICATION]` markers; the one genuine ambiguity (which fields stay editable while a truck is committed to a discharge) was resolved from `CONTEXT.md` and recorded in Assumptions. This plan proceeds to the required human plan-review gate before task generation.
- **IV. Test-first observable behavior — PASS**: API behavior starts with Japa specs (`tests/unit/trucks/administration/update.spec.ts`, `tests/integration/trucks/administration/update.spec.ts`) against real Lucid persistence, and web behavior with router-level Vitest/MSW feature tests, before implementation.
- **V. Deep boundaries and explicit contracts — PASS**: `UpdateTruckUseCase` owns the business decisions (lifecycle guard, provider-change eligibility, company availability), `LucidTruckRepository` owns persistence mechanics behind a discriminated result, `SiteReferenceUsageChecker` owns the discharge-usage question, `TrucksController#update` owns HTTP adaptation, and Tuyau carries the typed contract to the web adapter.
- **VI. Durable knowledge has a home — PASS**: The plan reuses the `CONTEXT.md` definitions of Truck, Truck Registration, and Discharge Truck Assignment, the List Trucks (`#222`) data model, and the existing single-site and vertical-slice ADRs. It introduces no new vocabulary and duplicates no canonical decision.
- **VII. Verification is part of delivery — PASS**: The quickstart defines focused API/web checks, the full repository gates, and the affected desktop/mobile browser flow required before merge.
- **VIII. One workflow owner — PASS**: Spec Kit artifacts stay in this feature directory; GitHub Project continues to own operational status.

### Post-design re-evaluation

**PASS**. The data model, HTTP contract, and quickstart confirm the write path reuses the existing
`trucks` table, index, and transformer without new persistence structures. The one genuinely new
business rule — a provider change is refused while the truck is committed to a planned or active
discharge — is expressed as an explicit use-case decision over the existing usage checker, exactly
as `ArchiveDockUseCase` and `ArchiveCustomerUseCase` already do for their own lifecycle blockers,
rather than as a database trigger or a repository-owned policy. No constitution exception requires
complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/transport-resources/trucks/update-a-truck/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── http-api.md
└── tasks.md              # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/trucks_controller.ts                  # add `update`
│   ├── trucks/
│   │   ├── update/
│   │   │   └── update_truck_use_case.ts                   # new
│   │   ├── create/create_truck_use_case.ts
│   │   ├── list/list_trucks_use_case.ts
│   │   ├── available/list_available_trucks_use_case.ts
│   │   └── shared/
│   │       ├── repositories/
│   │       │   ├── truck_repository.ts                     # add `findById`, `updateAvailable`
│   │       │   └── lucid_truck_repository.ts               # add `findById`, `updateAvailable`
│   │       ├── truck_policy.ts                             # add `update`
│   │       ├── truck_validator.ts                          # add `updateTruckValidator`
│   │       ├── truck_exceptions.ts                         # add 3 exceptions
│   │       └── truck_transformer.ts                        # unchanged
│   └── site_references/shared/site_reference_usage_checker.ts   # reused unchanged
├── start/routes.ts                                        # add `PATCH /trucks/:id`
└── tests/
    ├── support/persisted_truck_usage.ts                    # new
    ├── unit/trucks/administration/update.spec.ts           # new
    └── integration/trucks/administration/update.spec.ts    # new

apps/web/src/
├── routes/_authenticated/transport-resources.tsx           # add `truckMode` search param
└── features/trucks/
    ├── mutations/use-truck-mutations.ts                    # add `update`
    ├── ui/
    │   ├── truck-form.tsx                                   # generalize for create + edit
    │   ├── edit-truck-panel.tsx                             # new
    │   ├── truck-details.tsx                                # add guarded `Edit truck` action
    │   └── trucks-page.tsx                                  # render edit mode in both layouts
    └── __tests__/
        ├── administration/update.test.tsx                   # new
        ├── administration/permissions.test.tsx              # new
        └── support/test-helpers.ts                          # add PATCH interception
```

**Structure Decision**: Extend the existing `trucks` vertical slice the same way `transport_companies`
and `docks` were extended for their update behavior: a new `update/` use-case directory, new
repository methods on the existing abstract and Lucid repository, additional exports in the existing
shared validator and exception modules, one new policy ability, and one new controller action wired
to a new route. The only cross-feature dependency is the already-registered
`SiteReferenceUsageChecker`, injected into the use case exactly as `ArchiveDockUseCase` injects it.
On the web side, the existing `/transport-resources` route and `features/trucks` module gain a
URL-addressable edit mode following the delivered `companyDetailsMode` pattern, and `TruckForm`
grows an optional `truck` prop with `onCreate`/`onUpdate` handlers following the delivered
`CustomerForm` shape. No new route, workspace, or component pattern is introduced. Generated route
tree, controller/policy registries, and Tuyau types are refreshed through existing generators rather
than edited manually.

## Complexity Tracking

No constitution violations require justification.
