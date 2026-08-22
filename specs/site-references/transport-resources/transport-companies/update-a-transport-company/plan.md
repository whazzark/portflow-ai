# Implementation Plan: Update a Transport Company

**Branch**: `feat/219-update-transport-company` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/transport-resources/transport-companies/update-a-transport-company/spec.md`

## Summary

Add the first administration behavior to the delivered transport-company vertical slice: an authorized administrator renames an available transport company end to end. The API gains a `PATCH /api/v1/transport-companies/:id` contract guarded by a new policy ability, a Vine validator, a dedicated update use case, and a repository write that updates only rows still in `AVAILABLE` state. Case-insensitive name uniqueness becomes a real database constraint through a new unique index, so duplicates are refused atomically rather than by a read-then-write check. The web application extends the existing transport-resources master-detail panel with a URL-addressable edit mode: an administrator opens the edit form from company details, submits a new name, and the invalidated consultation queries re-render the renamed company in place. Every refusal — validation, duplicate, archived, not found, unauthorized — keeps the stored company untouched.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js 22 toolchain

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, Bouncer 4, VineJS, Tuyau 1.2, TanStack Start/Router 1.168/1.170, TanStack Query 5.101, TanStack Form, React 19.1, Zod 4.4, shadcn/Base UI, Sonner

**Storage**: PostgreSQL in runtime; in-memory SQLite through Lucid for automated API tests. Both support the deferred `LOWER(name)` unique index used by this slice.

**Testing**: Japa 5.3 API unit/integration suites against the real Lucid repository; Vitest 4.1, Testing Library, and MSW router-level web feature tests

**Target Platform**: Linux-hosted API and server-rendered web application; modern desktop and mobile browsers

**Project Type**: PNPM/Turbo monorepo web application with separate API and web workspaces

**Performance Goals**: Under normal conditions, an update submission produces a confirmed result or an explicit refusal within 2 seconds for at least 95% of attempts

**Constraints**: The API stays authoritative for authentication, role authorization, lifecycle rules, validation, and uniqueness; the only mutable field is `name`; archived companies stay read-only; identity, lifecycle status, lifecycle context, and truck associations are preserved; no lifecycle actor/comment is recorded for a rename; no new runtime dependency and no new tenant/site key are introduced

**Scale/Scope**: One site's low-cardinality reference collection; one new protected PATCH endpoint, one new policy ability, one new database index, one edit mode on an existing authenticated route, and their API/web test seams

## Constitution Check

### Pre-design gate

- **I. Selected feature intent is versioned — PASS**: GitHub issue #219 is selected on `feat/219-update-transport-company` and its reviewed `spec.md` is the behavioral contract.
- **II. One independently deliverable feature per spec — PASS**: The rename behavior, its write contract, authorization, validation, uniqueness constraint, interface, and tests form one mergeable outcome. Creation (#218), archival (#220), and reactivation (#221) stay in their own issues.
- **III. Vanilla Spec Kit gates protect product intent — PASS**: The spec was reviewed before planning, and this plan stops at the human plan-review gate before task generation. The spec's documented assumptions carry the material decisions; no silent invention was required.
- **IV. Test-first observable behavior — PASS**: API behavior begins with Japa unit and integration specs; web behavior begins with router-level Vitest/MSW feature tests. Each refusal path in FR-017 has a named failing test before implementation.
- **V. Deep boundaries and explicit contracts — PASS**: The use case owns the update decision and exception mapping, the repository owns the conditional write and unique-violation translation, the controller and policy own HTTP adaptation and authorization, Tuyau carries the typed contract, and the web feature owns form and view adaptation.
- **VI. Durable knowledge has a home — PASS**: The plan follows `CONTEXT.md` vocabulary and existing ADRs 0003, 0005, and 0008. Adding the uniqueness index applies the rule already established for customers and docks rather than inventing a new cross-cutting decision, so no new ADR is required.
- **VII. Verification is part of delivery — PASS**: The quickstart defines focused API/web checks, the repository-wide `pnpm check`, `pnpm typecheck`, `pnpm test`, and the affected browser flow.
- **VIII. One workflow owner — PASS**: Spec Kit artifacts stay in this feature directory; no parallel delivery-state mechanism is added.

### Post-design re-evaluation

**PASS**. The data model, HTTP contract, and validation guide preserve every pre-design gate.

Two design points deserve to be stated explicitly rather than buried:

- The new `LOWER(name)` unique index is a schema change introduced by a behavior slice. It is in scope because FR-007 is the invariant this slice must guarantee, and enforcing it in the database is the only way to keep it true under concurrent submissions (spec edge case 3). The seeded fixtures are already case-insensitively distinct and the seeder already asserts that, so the migration applies to existing data without a cleanup step.
- The index constrains inserts as well as updates, which means it partly pre-satisfies a rule that creation (#218) will also need. This is a consequence of putting the invariant where it belongs, not scope creep into #218: no creation behavior, endpoint, or interface is added here.

No constitution exception requires complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/transport-resources/transport-companies/update-a-transport-company/
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
│   │   └── transport_companies_controller.ts          # add update action
│   └── transport_companies/
│       ├── update/
│       │   └── update_transport_company_use_case.ts   # new
│       └── shared/
│           ├── repositories/
│           │   ├── transport_company_repository.ts    # add updateAvailable + write result types
│           │   └── lucid_transport_company_repository.ts
│           ├── transport_company_exceptions.ts        # new
│           ├── transport_company_policy.ts            # add update ability
│           └── transport_company_validator.ts         # new
├── database/
│   ├── migrations/
│   │   └── 1785100000000_add_transport_companies_name_unique_index.ts   # new
│   └── schema.ts                                      # regenerated, never hand-edited
├── start/
│   └── routes.ts                                      # add PATCH /:id
└── tests/
    ├── integration/transport_companies/administration/update.spec.ts    # new
    └── unit/transport_companies/administration/update.spec.ts          # new

apps/web/
├── src/
│   ├── features/transport-companies/
│   │   ├── __tests__/
│   │   │   ├── administration/
│   │   │   │   ├── update.test.tsx                    # new
│   │   │   │   └── permissions.test.tsx               # new
│   │   │   └── support/
│   │   │       ├── fixtures.ts                        # add admin user + update fixtures
│   │   │       └── test-helpers.ts                    # add PATCH interception
│   │   ├── mutations/
│   │   │   └── use-transport-company-mutations.ts     # new
│   │   └── ui/
│   │       ├── edit-transport-company-panel.tsx       # new
│   │       ├── transport-company-form.tsx             # new
│   │       ├── transport-companies-page.tsx           # wire edit mode
│   │       └── transport-company-details.tsx          # add guarded edit affordance
│   └── routes/_authenticated/
│       └── transport-resources.tsx                    # add companyMode search param
```

**Structure Decision**: Extend the existing two-workspace vertical-slice architecture in place rather than creating a new feature module. The API follows the delivered customer administration boundary (`update/` workflow directory, shared validator/exceptions/policy, thin controller). The web side keeps the transport-company master-detail panel established by #217 and adds edit as a URL-addressable mode of that panel, matching how customer administration models `mode` in route search. Generated files — `apps/api/database/schema.ts`, the Tuyau contract, and the TanStack route tree — are refreshed by their existing generators, never edited by hand.

## Complexity Tracking

No constitution violations require justification.
