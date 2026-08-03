# Implementation Plan: List Trucks

**Branch**: `feat/222-list-trucks` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/transport-resources/trucks/list-trucks/spec.md`

## Summary

Deliver one read-only, end-to-end truck consultation slice for every active user, with lifecycle visibility enforced through the same split read structure as Docks and Weighing Areas. The API will persist trucks as single-site lifecycle references related to their current transport company and expose an administrator-only complete collection plus a separate available-only collection for every active role. The existing `/transport-resources` web workspace will gain a Trucks resource view that selects the appropriate contract from the authenticated role, with permitted lifecycle tabs, counts, normalized registration/company search, deterministic registration ordering, URL-restorable selection, and in-context details. Each snapshot supports up to 1,000 trucks without pagination.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js 22 toolchain

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, Bouncer 4, Tuyau 1.2, TanStack Start/Router 1.168/1.170, TanStack Query 5.101, React 19.1, Zod 4.4, shadcn/Base UI

**Storage**: PostgreSQL in runtime; in-memory SQLite through Lucid for automated API tests

**Testing**: Japa 5.3 API unit/integration suites; Vitest 4.1, Testing Library, and MSW web feature tests

**Target Platform**: Linux-hosted API and server-rendered web application; modern desktop and mobile browsers

**Project Type**: PNPM/Turbo monorepo web application with separate API and web workspaces

**Performance Goals**: For a site containing up to 1,000 trucks, show the requested lifecycle collection or its explicit empty state within 2 seconds for at least 95% of consultation attempts under normal conditions

**Constraints**: API remains authoritative for authentication, endpoint-level archived visibility, lifecycle state, and provider relationship; the feature is read-only; the complete endpoint is administrator-only and the available endpoint returns no archived trucks or archived aggregates; the role-appropriate snapshot supplies counts, search, and details; no tenant/site key, pagination protocol, server-side search, show endpoint, or new dependency is introduced

**Scale/Scope**: One implicit site's collection of up to 1,000 trucks; two protected GET endpoints matching Docks and Weighing Areas (`index` complete for administrators, `available` for every active role); one all-active-role resource view with administrator-only archived controls within the canonical `/transport-resources` route; API and web TDD seams; create, update, archive, reactivate, discharge assignment, and operational selection UI remain outside this issue

## Constitution Check

### Pre-design gate

- **I. Selected feature intent is versioned — PASS**: GitHub issue #222 is selected on `feat/222-list-trucks`, and the reviewed `spec.md` is the behavioral contract.
- **II. One independently deliverable feature per spec — PASS**: Persistence, authorized consultation, interface states, and tests form one mergeable read outcome; mutations remain in issues #223–#226 and operational assignments remain separate roadmap work.
- **III. Vanilla Spec Kit gates protect product intent — PASS**: Material authorization and scale decisions were clarified before planning. This workflow stops at the required human plan-review gate before task generation.
- **IV. Test-first observable behavior — PASS**: API behavior will start with Japa tests against real Lucid persistence, and web behavior with router-level Vitest/MSW feature tests before implementation.
- **V. Deep boundaries and explicit contracts — PASS**: Separate complete-list and available-list use cases own their repository operations, policies enforce the established endpoint authorization split, repositories own bounded relational queries, controllers own HTTP adaptation, Tuyau carries both DTO contracts, and web adapters select presentation behavior from the authenticated role.
- **VI. Durable knowledge has a home — PASS**: The plan uses `CONTEXT.md` terms and follows the existing single-site, API vertical-slice, web vertical-slice, and typed-contract ADRs without creating a competing domain vocabulary.
- **VII. Verification is part of delivery — PASS**: The quickstart defines focused checks, the full repository gates, a 1,000-record acceptance check, and affected desktop/mobile browser flows.
- **VIII. One workflow owner — PASS**: Spec Kit artifacts stay in this feature directory, while GitHub continues to own operational status and review.

### Post-design re-evaluation

**PASS**. The data model, split HTTP contracts, web composition, and validation guide preserve all pre-design gates. The complete contract serves administrators and the available-only contract serves every active role, matching Docks and Weighing Areas without exposing archived data to non-administrators; mutations and operational selection UI remain independently reviewed behaviors. No constitution exception requires complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/transport-resources/trucks/list-trucks/
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
│   ├── controllers/trucks_controller.ts
│   ├── models/truck.ts
│   └── trucks/
│       ├── available/list_available_trucks_use_case.ts
│       ├── list/list_trucks_use_case.ts
│       └── shared/
│           ├── repositories/
│           │   ├── truck_repository.ts
│           │   └── lucid_truck_repository.ts
│           ├── truck_policy.ts
│           └── truck_transformer.ts
├── database/
│   ├── factories/truck_factory.ts
│   ├── migrations/1784900000000_create_trucks_table.ts
│   └── seeders/07_truck_seeder.ts
├── providers/repositories_provider.ts
├── start/routes.ts
└── tests/
    ├── integration/trucks/consultation/list.spec.ts
    └── unit/trucks/consultation/list.spec.ts

apps/web/src/
├── features/
│   ├── transport-companies/ui/transport-companies-page.tsx
│   ├── transport-resources/
│   │   ├── __tests__/resource-navigation.test.tsx
│   │   └── ui/transport-resources-page.tsx
│   └── trucks/
│       ├── __tests__/
│       │   ├── access/authorization.test.tsx
│       │   ├── details/open.test.tsx
│       │   ├── feedback/{retry,states}.test.tsx
│       │   ├── list/{lifecycle,search-and-sort}.test.tsx
│       │   └── support/{fixtures,test-helpers}.ts
│       ├── helpers/{truck-search.test,truck-search}.ts
│       ├── queries/truck-queries.ts
│       ├── types.ts
│       └── ui/
│           ├── truck-details.tsx
│           ├── truck-list.tsx
│           ├── truck-overview.tsx
│           ├── truck-section.tsx
│           ├── trucks-error.tsx
│           ├── trucks-page.tsx
│           └── trucks-pending.tsx
└── routes/_authenticated/transport-resources.tsx
```

**Structure Decision**: Extend the existing two-workspace vertical-slice architecture. The API adds dedicated Truck `list` and `available` slices around one relational DTO and repository, matching Docks and Weighing Areas without a generic site-reference abstraction. The canonical web route remains thin, selects `trucks.index` for administrators or `trucks.available` for other active roles, and composes concrete transport-company and truck workspaces through a small `transport-resources` parent feature. Existing company behavior remains intact, while truck behavior, queries, adapters, and tests stay in `features/trucks`. Generated database schema, controller/policy registries, route tree, and Tuyau types are refreshed through existing generators rather than edited manually.

### Integrated workspace amendment

The default `/transport-resources` route now composes a single integrated workspace: the left directory lists transport companies and the right directory lists all permitted trucks until a company is selected. Selecting the same company again clears the filter. Company and truck searches remain independent, and both read-only detail views open in side panels without replacing the workspace context. Explicit `resource=companies` and `resource=trucks` search states remain supported for legacy links and focused screens.

## Complexity Tracking

No constitution violations require justification.
