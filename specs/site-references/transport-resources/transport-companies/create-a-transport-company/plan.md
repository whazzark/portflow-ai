# Implementation Plan: Create a Transport Company

**Branch**: `feat/218-create-transport-company` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/transport-resources/transport-companies/create-a-transport-company/spec.md`

## Summary

Add the second administration behavior to the delivered transport-company vertical slice: an authorized administrator registers a new transport company end to end. The API gains a `POST /api/v1/transport-companies` contract guarded by a new `create` policy ability, a `createTransportCompanyValidator`, a dedicated create use case, and a repository insert that always writes `status = 'AVAILABLE'`. No migration is needed: the case-insensitive `LOWER(name)` unique index delivered by #219 already constrains inserts, so duplicates are refused atomically by the database rather than by a read-then-write check. The web application widens the transport-resources details sheet from a two-mode panel (`view`/`edit`) to three, adding a URL-addressable `create` mode reachable from a guarded directory action and from the available-lifecycle empty state; on success the invalidated consultation queries re-render the directory and the panel lands on the new company's details. Every refusal — validation, duplicate, unauthorized — leaves the collection unchanged with no partially created row.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js 22 toolchain

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, Bouncer 4, VineJS, Tuyau 1.2, TanStack Start/Router 1.168/1.170, TanStack Query 5.101, TanStack Form, React 19.1, Zod 4.4, shadcn/Base UI, Sonner

**Storage**: PostgreSQL in runtime; in-memory SQLite through Lucid for automated API tests. Both already carry the `transport_companies_name_unique` expression index this slice relies on.

**Testing**: Japa 5.3 API unit/integration suites against the real Lucid repository; Vitest 4.1, Testing Library, and MSW router-level web feature tests

**Target Platform**: Linux-hosted API and server-rendered web application; modern desktop and mobile browsers

**Project Type**: PNPM/Turbo monorepo web application with separate API and web workspaces

**Performance Goals**: Under normal conditions, a creation submission produces a confirmed result or an explicit refusal within 2 seconds for at least 95% of attempts, and the new company is visible without a manual refresh

**Constraints**: The API stays authoritative for authentication, role authorization, validation, and uniqueness; `name` is the only accepted field; a company is always created `AVAILABLE` with null lifecycle context; no truck row is read or written; no creation actor is stored; no schema change, no migration, and no new runtime dependency are introduced

**Scale/Scope**: One site's low-cardinality reference collection; one new protected POST endpoint, one new policy ability, one new use case, one new panel mode on an existing authenticated route, and their API/web test seams

## Constitution Check

### Pre-design gate

- **I. Selected feature intent is versioned — PASS**: GitHub issue #218 is selected on `feat/218-create-transport-company` and its reviewed `spec.md` is the behavioral contract.
- **II. One independently deliverable feature per spec — PASS**: The creation behavior, its write contract, authorization, validation, interface, and tests form one mergeable outcome. Consultation (#217) is already delivered; update (#219) is delivered; archival (#220) and reactivation (#221) stay in their own issues.
- **III. Vanilla Spec Kit gates protect product intent — PASS**: The spec was reviewed before planning, and this plan stops at the human plan-review gate before task generation. The one decision the spec explicitly deferred here — whether creation records its own actor — is resolved in the open in [research.md](./research.md) decision 3 rather than silently invented.
- **IV. Test-first observable behavior — PASS**: API behavior begins with Japa unit and integration specs; web behavior begins with router-level Vitest/MSW feature tests. Each outcome in FR-015 has a named failing test before implementation.
- **V. Deep boundaries and explicit contracts — PASS**: The use case owns the creation decision and exception mapping, the repository owns the insert and unique-violation translation, the controller and policy own HTTP adaptation and authorization, Tuyau carries the typed contract, and the web feature owns form and view adaptation.
- **VI. Durable knowledge has a home — PASS**: The plan follows `CONTEXT.md` vocabulary and existing ADRs 0003, 0005, and 0008. It introduces no cross-cutting decision, so no new ADR is required.
- **VII. Verification is part of delivery — PASS**: The quickstart defines focused API/web checks, the repository-wide `pnpm check`, `pnpm typecheck`, `pnpm test`, and the affected browser flow.
- **VIII. One workflow owner — PASS**: Spec Kit artifacts stay in this feature directory; no parallel delivery-state mechanism is added.

### Post-design re-evaluation

**PASS**. The data model, HTTP contract, and validation guide preserve every pre-design gate.

Three design points deserve to be stated explicitly rather than buried:

- **This slice ships no schema change.** FR-007 and FR-019 are guaranteed by an index that already exists, because #219 put the invariant in the database where concurrency can't defeat it. That was recorded at the time as a guarantee creation would inherit; this is the inheritance. The consequence for review is that "no migration" here is a deliberate design outcome, not an omission — if `transport_companies_name_unique` were missing, the duplicate and concurrency requirements would be unmet with no application-level fallback.
- **No creation actor is recorded, on purpose.** The spec deferred the question; decision 3 answers it with "no column". No requirement in this slice observes who created a company, all three delivered sibling site references behave the same way, and adding an unobservable column would be untestable behavior under principle IV. If reference-wide creation auditing is later wanted, it is one cross-resource issue, not a rider on this one.
- **The details sheet grows a third mode rather than a second component.** `companyDetailsMode` widens from `'view' | 'edit'` to `'view' | 'edit' | 'create'`, which touches code #219 delivered. This is bounded and intentional: one enum that cannot express contradictory states is safer than a parallel boolean, and `customers-page.tsx` already proves the three-mode shape. The existing `editSession` guard is unaffected, since it keys off `companyDetailsMode === 'edit'`.

No constitution exception requires complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/transport-resources/transport-companies/create-a-transport-company/
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
│   ├── controllers/
│   │   └── transport_companies_controller.ts          # add store action (201)
│   └── transport_companies/
│       ├── create/
│       │   └── create_transport_company_use_case.ts   # new
│       └── shared/
│           ├── repositories/
│           │   ├── transport_company_repository.ts    # add create + CREATED variant
│           │   └── lucid_transport_company_repository.ts
│           ├── transport_company_policy.ts            # add create ability
│           └── transport_company_validator.ts         # add createTransportCompanyValidator
├── start/
│   └── routes.ts                                      # add POST /
└── tests/
    ├── integration/transport_companies/administration/create.spec.ts   # new
    └── unit/transport_companies/administration/create.spec.ts          # new

apps/web/
├── src/
│   ├── features/transport-companies/
│   │   ├── __tests__/
│   │   │   ├── administration/
│   │   │   │   ├── create.test.tsx                    # new
│   │   │   │   └── permissions.test.tsx               # extend for the create affordance
│   │   │   └── support/
│   │   │       └── test-helpers.ts                    # add POST interception
│   │   ├── mutations/
│   │   │   └── use-transport-company-mutations.ts     # add create mutation
│   │   └── ui/
│   │       ├── create-transport-company-panel.tsx     # new
│   │       ├── transport-company-form.tsx             # accept optional company + onCreate
│   │       ├── transport-company-list.tsx             # guarded empty-state create action
│   │       └── transport-company-section.tsx          # pass the create action through
│   ├── features/transport-resources/
│   │   └── ui/transport-resources-workspace.tsx       # create mode, header action, sheet wiring
│   └── routes/_authenticated/
│       └── transport-resources.tsx                    # widen companyDetailsMode enum
```

No migration file and no change to `apps/api/database/schema.ts` are expected. Generated artifacts — the Tuyau registry under `apps/api/.adonisjs` and the TanStack route tree — are refreshed by their existing generators, never edited by hand.

**Structure Decision**: Extend the existing two-workspace vertical-slice architecture in place rather than creating a new feature module. The API follows the delivered dock and customer creation boundary (`create/` workflow directory, shared validator/exceptions/policy, thin controller returning `201`). The web side keeps the transport-company directory and details sheet established by #217 and extended by #219, and adds create as a third URL-addressable mode of that sheet, matching how customer administration models `create` in route search. The legacy `/transport-companies` redirect already supplies `companyDetailsMode: 'view'`, so widening the enum leaves it untouched.

## Complexity Tracking

No constitution violations require justification.
