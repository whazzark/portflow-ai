# Implementation Plan: List Transport Companies

**Branch**: `feat/217-list-transport-companies` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/transport-resources/transport-companies/list-transport-companies/spec.md`

## Summary

Deliver a read-only, end-to-end transport-company consultation slice for every active authenticated user. The API will persist transport companies as single-site lifecycle references and expose one complete lifecycle collection plus one available-only collection for operational selectors. The web application will load the complete collection through Tuyau/React Query, present available and archived tabs with unfiltered counts, perform normalized name search while preserving deterministic name ordering, and open lifecycle details in a URL-addressable master-detail panel without leaving the collection.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js 22 toolchain

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, Bouncer 4, Tuyau 1.2, TanStack Start/Router 1.168/1.170, TanStack Query 5.101, TanStack Table 8.21, React 19.1, Zod 4.4, shadcn/Base UI

**Storage**: PostgreSQL in runtime; in-memory SQLite through Lucid for automated API tests

**Testing**: Japa 5.3 API unit/integration suites; Vitest 4.1, Testing Library, and MSW web feature tests

**Target Platform**: Linux-hosted API and server-rendered web application; modern desktop and mobile browsers

**Project Type**: PNPM/Turbo monorepo web application with separate API and web workspaces

**Performance Goals**: Under normal conditions, show the requested collection or its explicit empty state within 2 seconds for at least 95% of consultation attempts

**Constraints**: API remains authoritative for authentication, active-access authorization, lifecycle state, and selector safety; the feature is read-only; archived records never enter the available-only endpoint; no tenant/site key is added because the MVP dataset implicitly represents one operating organization and one site; no new dependency or pagination protocol is introduced

**Scale/Scope**: One site's low-cardinality reference collection; two protected GET endpoints, one canonical authenticated web route plus a compatibility redirect, one lifecycle master-detail experience, and their API/web test seams

## Constitution Check

### Pre-design gate

- **I. Selected feature intent is versioned — PASS**: GitHub issue #217 is selected on a feature branch and its `spec.md` is the behavioral contract.
- **II. One independently deliverable feature per spec — PASS**: Consultation, its read contract, persistence, authorization, interface, and tests form one mergeable outcome; lifecycle mutations remain in issues #218–#221.
- **III. Vanilla Spec Kit gates protect product intent — PASS**: The user explicitly selected the current issue/spec for planning. This plan stops at the required human plan-review gate before task generation.
- **IV. Test-first observable behavior — PASS**: API behavior will begin with Japa tests and web behavior with router-level Vitest/MSW feature tests before implementation.
- **V. Deep boundaries and explicit contracts — PASS**: Use cases own consultation intent, the repository owns lifecycle queries, the controller/policy own HTTP and authorization, Tuyau carries the typed contract, and the web feature owns view adaptation.
- **VI. Durable knowledge has a home — PASS**: The plan follows `CONTEXT.md` vocabulary and the existing single-site and vertical-slice ADRs. No new cross-feature architectural decision is introduced.
- **VII. Verification is part of delivery — PASS**: The quickstart defines focused and repository-wide checks plus the affected browser flow for pre-PR verification.
- **VIII. One workflow owner — PASS**: Spec Kit artifacts remain in this feature directory and no parallel delivery-state mechanism is added.

### Post-design re-evaluation

**PASS**. The data model, HTTP contracts, and validation guide preserve all pre-design gates. The available-only endpoint is part of the same read slice because it makes the archived-exclusion invariant observable at the API boundary; it does not add an administration behavior. No constitution exception requires complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/transport-resources/transport-companies/list-transport-companies/
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
│   ├── controllers/
│   │   └── transport_companies_controller.ts
│   ├── models/
│   │   └── transport_company.ts
│   └── transport_companies/
│       ├── available/
│       │   └── list_available_transport_companies_use_case.ts
│       ├── list/
│       │   └── list_transport_companies_use_case.ts
│       └── shared/
│           ├── repositories/
│           │   ├── transport_company_repository.ts
│           │   └── lucid_transport_company_repository.ts
│           ├── transport_company_policy.ts
│           └── transport_company_transformer.ts
├── database/
│   ├── factories/transport_company_factory.ts
│   ├── migrations/<timestamp>_create_transport_companies_table.ts
│   └── seeders/03_transport_company_seeder.ts
└── tests/
    ├── integration/transport_companies/consultation/
    └── unit/transport_companies/consultation/

apps/web/
├── src/
│   ├── components/layout/app-sidebar.tsx
│   ├── features/transport-companies/
│   │   ├── __tests__/
│   │   │   ├── details/
│   │   │   ├── feedback/
│   │   │   ├── list/
│   │   │   └── support/
│   │   ├── helpers/transport-company-search.ts
│   │   ├── queries/transport-company-queries.ts
│   │   ├── types.ts
│   │   └── ui/
│   │       ├── transport-companies-error.tsx
│   │       ├── transport-companies-page.tsx
│   │       ├── transport-companies-pending.tsx
│   │       ├── transport-company-details.tsx
│   │       ├── transport-company-list.tsx
│   │       ├── transport-company-overview.tsx
│   │       └── transport-company-section.tsx
│   └── routes/_authenticated/
│       ├── transport-companies.tsx
│       └── transport-resources.tsx
└── src/components/layout/__tests__/authenticated-layout/
```

**Structure Decision**: Extend the existing two-workspace vertical-slice architecture. The API slice mirrors the customer consultation boundary but exposes only read operations. The web route stays declarative while `features/transport-companies` owns query, URL-state adaptation, presentation, and router-level behavior tests. Generated files such as `apps/api/database/schema.ts` and the TanStack route tree are refreshed by their existing generators rather than edited manually.

## Complexity Tracking

No constitution violations require justification.
