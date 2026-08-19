# Implementation Plan: Enforce Persisted Site-Reference Usage Rules

**Branch**: `feat/240-enforce-persisted-site-reference-usage` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/site-references/operational-foundation/enforce-persisted-site-reference-usage-rules/spec.md`

## Summary

Complete the persistence-backed site-reference usage seam introduced with issue #236 so Customers,
Docks, Weighing Areas, Warehouse Doors, and Trucks are classified from current Planned or Active
Discharge relationships. Preserve the existing Customer, Dock, and Weighing Area archive outcomes,
exclude Closed and explicitly released history, and prove that bulk assessments remain one
deterministic set operation rather than one lookup per identifier.

The design extends the existing typed checker and Discharge usage repository, makes reference-type
routing exhaustive, adds the missing Truck reservation predicate, removes the obsolete no-Discharge
fallback, and adds two query-oriented indexes for Dock and Customer usage. Database-backed tests
drive the implementation before existing HTTP archive journeys are rewired from test doubles to
real persisted scenarios. No new route, controller, response DTO, site-reference mutation, or UI is
introduced.

## Technical Context

**Language/Version**: TypeScript 5.9.3 targeting ES2022; Node.js 24 production image and Node.js 25 CI

**Primary Dependencies**: AdonisJS 7.3.4, Lucid 22.4.2, Japa 5.3, Luxon 3.7, PostgreSQL driver,
Better SQLite 3, Biome

**Storage**: PostgreSQL in production; in-memory SQLite with foreign keys enabled for automated
repository and HTTP tests

**Testing**: Japa unit and integration suites against real Lucid repositories, Adonis database-query
events for query-count assertions, migration fresh/rollback checks, Biome, and TypeScript typecheck

**Target Platform**: Existing AdonisJS API process on the Linux deployment target; no web-client
runtime change

**Project Type**: PNPM/Turbo monorepo with one affected AdonisJS API application

**Performance Goals**: Assess up to 1,000 identifiers of one reference kind in under 2 seconds;
perform exactly one persisted SELECT for each non-empty bulk assessment and none for an empty input

**Constraints**: Preserve current archive HTTP contracts; keep usage assessment read-only; retain
historical rows and snapshots; accept an optional transaction client for bulk Customer archival;
remain portable across PostgreSQL and SQLite; use single-site scope; add no Truck or Warehouse Door
mutation workflow

**Scale/Scope**: Five supported reference kinds, three Discharge states, three single-reference
archive routes, one Customer bulk-archive route, one internal usage contract, and two additive
indexes; no new business tables or frontend files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Pre-research gate | Design re-check |
| --- | --- | --- |
| I. Selected feature intent is versioned | PASS — selected issue #240 has the canonical `spec.md` on its own branch. | PASS — all planning artifacts remain in the issue's feature directory. |
| II. One independently deliverable feature per spec | PASS — the outcome is one persisted usage rule; later Truck and Warehouse Door mutations remain separate. | PASS — checker, repository query, indexes, and regression tests ship as one independently verifiable slice. |
| III. Vanilla Spec Kit gates | PASS — the user invoked planning after reviewing the generated spec; plan review remains required before tasks. | PASS — no extra delivery state or repository-owned orchestrator is introduced. |
| IV. Test-first observable behavior | PASS — the spec defines archive conflicts, releases, determinism, and scale observably. | PASS — RED repository and HTTP scenarios precede the minimal query changes, then refactoring. |
| V. Deep boundaries and explicit contracts | PASS — use cases retain conflict decisions and the repository owns persisted usage resolution. | PASS — the existing checker delegates to a domain-oriented Discharge repository; controllers and DTOs remain unchanged. |
| VI. Durable knowledge has a home | PASS — vocabulary comes from `CONTEXT.md`; feature behavior remains in `spec.md`. | PASS — query decisions, projection rules, contract, and validation guide live only in this feature directory; no ADR is needed. |
| VII. Verification is part of delivery | PASS — focused, scale, migration, full API, and repository-wide checks are identified. | PASS — `quickstart.md` covers affected suites and required repository commands; no browser flow is relevant. |
| VIII. One workflow owner | PASS — Spec Kit owns artifacts and GitHub owns issue/PR state. | PASS — the design adds no phase tracker or delivery state machine. |

**Gate result**: PASS before research and after design. No constitution violation requires a
complexity exception.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/operational-foundation/enforce-persisted-site-reference-usage-rules/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── persisted-site-reference-usage.md
├── checklists/
│   └── requirements.md
└── tasks.md                         # created by /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── discharges/shared/repositories/
│   │   ├── discharge_usage_repository.ts
│   │   └── lucid_discharge_usage_repository.ts
│   └── site_references/shared/
│       ├── site_reference_usage_checker.ts
│       ├── persisted_site_reference_usage_checker.ts
│       └── no_discharge_site_reference_usage_checker.ts  # remove obsolete fallback
├── database/
│   └── migrations/
│       └── 1785100000000_add_site_reference_usage_indexes.ts
├── providers/
│   └── repositories_provider.ts
└── tests/
    ├── integration/
    │   ├── customers/lifecycle/archive.spec.ts
    │   ├── customers/lifecycle/bulk/archive.spec.ts
    │   ├── docks.spec.ts
    │   └── weighing_areas.spec.ts
```

**Structure Decision**: Keep the cross-reference usage abstraction in the existing
`site_references/shared` slice and all persisted Discharge relationship knowledge in
`discharges/shared/repositories`. Extend the existing production provider only through its bound
dependencies, place portable index changes with the API migrations, and test the real Lucid path at
the repository and HTTP boundaries. No controller, transformer, route, or frontend structure is
added.

## Phase 0: Research Outputs

Research is complete in [research.md](./research.md). Key decisions are:

- retain the existing checker-to-Discharge-repository seam and remove only the obsolete no-op;
- route all five reference kinds explicitly, with Truck based on unreleased Discharge reservations;
- treat Closed Discharges, ended memberships/assignments, and released reservations as history;
- deduplicate input, execute one distinct query, and return a stable identifier set;
- add Dock/status and Customer/Discharge indexes for predictable bulk performance;
- prove behavior with real SQLite-backed repositories and preserve all existing HTTP contracts.

No `NEEDS CLARIFICATION` remains.

## Phase 1: Design Outputs

- [data-model.md](./data-model.md) defines the existing persisted relationships, current-usage
  projection, release rules, and additive indexes.
- [contracts/persisted-site-reference-usage.md](./contracts/persisted-site-reference-usage.md)
  defines the internal bulk checker and unchanged archive HTTP outcomes.
- [quickstart.md](./quickstart.md) defines focused behavior, scale, migration, API, and full
  repository validation.

## Implementation Sequencing for Task Generation

1. Add failing database-backed tests for the five-type Planned/Active/Closed matrix, explicit
   releases, mixed history/current usage, empty/unknown/duplicate input, and stable distinct output.
2. Add failing query-count and 1,000-identifier performance tests for all five reference kinds,
   proving zero SELECTs for empty input and one SELECT for every non-empty bulk assessment.
3. Extend the supported reference type contract with `TRUCK`, replace catch-all branching with an
   exhaustive dispatch, add the unreleased Truck reservation query, deduplicate inputs, and sort
   returned identifiers deterministically.
4. Add the portable Dock/status and Customer/Discharge usage indexes and verify fresh migration and
   rollback behavior on the test database.
5. Replace stubbed acceptance arrangements with persisted Planned, Active, Closed, ended, and
   released scenarios for Customer single/bulk, Dock, and Weighing Area archive journeys; preserve
   exact conflict envelopes and unchanged lifecycle fields.
6. Verify the production provider resolves the persisted checker, remove the unreferenced
   no-Discharge fallback, and confirm no route or UI surface changes.
7. Refactor shared test setup only where it reduces duplicated graph construction without creating
   a second domain model, then run the complete quickstart verification.

## Complexity Tracking

No constitution violations or unjustified complexity exceptions are introduced.
