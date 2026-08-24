# Implementation Plan: Create a Truck

**Branch**: `feat/223-create-truck` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/transport-resources/trucks/create-a-truck/spec.md`

## Summary

Add the truck write slice that List Trucks (`#222`) deferred: let an active organization
administrator or operations administrator register a new truck with a unique registration, a
positive capacity in tonnes, an optional vehicle model, and a currently available transport
company. The API adds one `POST /api/v1/trucks` endpoint backed by a `create` use case and
repository method on the existing `Truck` model and `trucks` table, enforcing duplicate-safe
registration uniqueness through the existing persisted index and rejecting a missing or archived
transport company as a business rule. The existing `/transport-resources` web workspace gains an
administrator-only create action reusing the Customer creation panel pattern, so a new truck is
immediately visible in the same consultation views built by `#222`.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js 22 toolchain

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, VineJS, Bouncer 4, Tuyau 1.2, TanStack Start/Router 1.168/1.170, TanStack Query 5.101, React 19.1, Zod 4.4, shadcn/Base UI

**Storage**: PostgreSQL in runtime; in-memory SQLite through Lucid for automated API tests. No schema change: reuses the `trucks` table and `trucks_registration_unique` functional index created by List Trucks (`#222`)

**Testing**: Japa 5.3 API unit/integration suites; Vitest 4.1, Testing Library, and MSW web feature tests

**Target Platform**: Linux-hosted API and server-rendered web application; modern desktop and mobile browsers

**Project Type**: PNPM/Turbo monorepo web application with separate API and web workspaces

**Performance Goals**: At least 90% of representative authorized administrators complete truck registration within 60 seconds of opening the creation experience (SC-004); creation itself is a single-row insert with no scale concern beyond the 1,000-truck dataset already validated by List Trucks (`#222`)

**Constraints**: API remains authoritative for authentication, role-based creation authorization, and the available-transport-company business rule; creation is single-truck only (no bulk/import); duplicate registration must be rejected even under near-simultaneous submissions using the existing unique index rather than a new locking mechanism; no new table, tenant/site key, or dependency is introduced; the new truck always starts `AVAILABLE`

**Scale/Scope**: One new protected `POST /api/v1/trucks` endpoint; one new API create slice (use case, repository method, validator, exceptions); one new `TransportCompanyRepository.findById` method reused for the availability check; one new web create panel/form/mutation wired into the existing Trucks workspace; update, archive, reactivate, and discharge assignment remain independently deliverable follow-up issues (`#224`–`#226`)

## Constitution Check

### Pre-design gate

- **I. Selected feature intent is versioned — PASS**: GitHub issue #223 is selected on `feat/223-create-truck`, and the reviewed `spec.md` is the behavioral contract.
- **II. One independently deliverable feature per spec — PASS**: Authorization, validation, persistence, and interface for creating one truck form one mergeable outcome; update, archive, reactivate, and operational assignment remain issues #224–#226.
- **III. Vanilla Spec Kit gates protect product intent — PASS**: The spec required no `[NEEDS CLARIFICATION]` markers; this plan proceeds to the required human plan-review gate before task generation.
- **IV. Test-first observable behavior — PASS**: API behavior starts with Japa tests (`tests/unit/trucks/administration/create.spec.ts`, `tests/integration/trucks/administration/create.spec.ts`) against real Lucid persistence, and web behavior with router-level Vitest/MSW feature tests, before implementation.
- **V. Deep boundaries and explicit contracts — PASS**: `CreateTruckUseCase` owns the business decision (authorized company, valid input), `LucidTruckRepository`/`LucidTransportCompanyRepository` own persistence mechanics, `TrucksController#store` owns HTTP adaptation, and Tuyau carries the typed contract to the web adapter, matching the existing List Trucks and Customer creation layering.
- **VI. Durable knowledge has a home — PASS**: The plan reuses `CONTEXT.md` role definitions (Organization Admin, Operations Admin), the existing single-site and vertical-slice ADRs, and the already-documented cross-table invariant from the List Trucks (`#222`) data model rather than introducing new vocabulary.
- **VII. Verification is part of delivery — PASS**: The quickstart defines focused API/web checks, the full repository gates, and the affected desktop/mobile browser flow required before merge.
- **VIII. One workflow owner — PASS**: Spec Kit artifacts stay in this feature directory; GitHub Project continues to own operational status.

### Post-design re-evaluation

**PASS**. The data model, HTTP contract, and quickstart confirm the write path reuses the existing `Truck` model, table, and index without new complexity; the one new cross-table check (transport company must be available) is implemented as an explicit use-case decision rather than a database trigger, keeping ownership boundaries clean. No constitution exception requires complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/transport-resources/trucks/create-a-truck/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── http-api.md
└── tasks.md              # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/trucks_controller.ts            # add `store`
│   ├── trucks/
│   │   ├── create/
│   │   │   └── create_truck_use_case.ts             # new
│   │   ├── available/list_available_trucks_use_case.ts
│   │   ├── list/list_trucks_use_case.ts
│   │   └── shared/
│   │       ├── repositories/
│   │       │   ├── truck_repository.ts               # add `create`
│   │       │   └── lucid_truck_repository.ts          # add `create`
│   │       ├── truck_policy.ts                        # add `create`
│   │       ├── truck_transformer.ts
│   │       ├── truck_validator.ts                     # new
│   │       └── truck_exceptions.ts                    # new
│   └── transport_companies/shared/
│       └── repositories/
│           ├── transport_company_repository.ts        # add `findById`
│           └── lucid_transport_company_repository.ts  # add `findById`
├── start/routes.ts                                    # add `POST /trucks`
└── tests/
    ├── unit/trucks/administration/create.spec.ts       # new
    └── integration/trucks/administration/create.spec.ts # new

apps/web/src/
└── features/trucks/
    ├── mutations/use-truck-mutations.ts                # new
    ├── ui/
    │   ├── create-truck-panel.tsx                       # new
    │   ├── truck-form.tsx                                # new
    │   └── trucks-page.tsx                               # wire in create action
    └── __tests__/
        └── details/create.test.tsx                      # new
```

**Structure Decision**: Extend the existing `trucks` vertical slice exactly as `customers` already
does for creation: a new `create/` use case, a new repository `create` method on the existing
`LucidTruckRepository`, a new validator and exception module under `trucks/shared/`, and one new
controller action wired to a new `TruckPolicy.create` check. The only cross-feature addition is
`TransportCompanyRepository.findById`, needed because truck creation must confirm the referenced
company is currently available — a rule the List Trucks (`#222`) data model already identified and
deferred to this slice. On the web side, the existing `/transport-resources` workspace and
`features/trucks` module gain a create panel/form/mutation following the proven
`features/customers` creation composition; no new route or workspace pattern is introduced.
Generated route tree, controller/policy registries, and Tuyau types are refreshed through existing
generators rather than edited manually.

## Complexity Tracking

No constitution violations require justification.
