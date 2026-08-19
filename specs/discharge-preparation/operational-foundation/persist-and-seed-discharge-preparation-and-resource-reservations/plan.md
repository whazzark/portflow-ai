# Implementation Plan: Persist and Seed Discharge Preparation and Resource Reservations

**Branch**: `feat/236-discharge-preparation-resource-reservations` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/discharge-preparation/operational-foundation/persist-and-seed-discharge-preparation-and-resource-reservations/spec.md`

## Summary

Add the durable persistence foundation for Discharge preparation: Discharges with vessel and Dock
context, Product Lots, historical Discharge Truck Assignments, planned/active Shifts, Warehouse
Door-to-Product-Lot assignments, and explicit Shift resource memberships. Add factories and a
deterministic, idempotent seeder for Planned, Active, and Closed graphs. Replace the transitional
site-reference usage no-op with a persistence-backed query so Planned/Active reservations protect
site references while Closed history does not block new use. Do not add mutation endpoints or UI.

The design uses normalized Lucid models and foreign-keyed join tables, portable PostgreSQL/SQLite
constraints, fixed managed seed identities, and one transaction per managed lifecycle graph.

## Technical Context

**Language/Version**: TypeScript 5.9 on the repository's Node.js runtime target

**Primary Dependencies**: AdonisJS 7, Lucid 22, Luxon, `@adonisjs/lucid/factories`, Japa 5,
Better SQLite 3, PostgreSQL driver, Biome

**Storage**: PostgreSQL in production; in-memory SQLite with foreign keys enabled for integration
tests; migrations and constraints must remain portable across both.

**Testing**: Japa unit and integration tests, migration fresh/rollback validation, Biome checks,
TypeScript typecheck, and the existing API fast suite. No browser flow is required because the
feature adds no UI.

**Target Platform**: AdonisJS API process on the existing Linux deployment target.

**Project Type**: Single AdonisJS web/API application with persistence, factories, and seeders.

**Performance Goals**: The complete managed initialization remains within the existing seeder test
budget of 60 seconds and repeated initialization performs bounded key-based lookups rather than
unbounded scans or graph duplication.

**Constraints**: Preserve API and frontend compatibility; no new mutation endpoint or UI; use
existing vertical-slice boundaries; retain historical snapshots; do not delete or claim unrelated
records; enforce required references and portable scalar constraints; protect cross-row reservation
checks atomically.

**Scale/Scope**: Three deterministic managed Discharge graphs (Planned, Active, Closed), focused
factories for the preparation aggregate, and the resource-usage checks needed by existing site
reference lifecycle use cases. No production-scale bulk import or user-facing workflow.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Pre-research gate | Design re-check |
| --- | --- | --- |
| I. Selected feature intent is versioned | PASS — issue #236 has the canonical `spec.md`. | PASS — design artifacts remain in the same feature directory. |
| II. One independently deliverable feature per spec | PASS — one persistence/seed foundation outcome; later workflows remain out of scope. | PASS — models, factories, usage protection, and seeds support one independently testable foundation. |
| III. Vanilla Spec Kit gates | PASS — spec review precedes this plan and plan review precedes tasks. | PASS — no repository-owned workflow or second state machine is introduced. |
| IV. Test-first observable behavior | PASS — acceptance scenarios and measurable outcomes are defined. | PASS — migrations, persistence, seed reruns, conflicts, and failure recovery have observable tests. |
| V. Deep boundaries and explicit contracts | PASS — API remains business source of truth. | PASS — models own persistence, seeders own initialization, and the existing usage-checker seam owns cross-domain protection. |
| VI. Durable knowledge has a home | PASS — vocabulary comes from `CONTEXT.md`; behavior is in `spec.md`. | PASS — data model, initialization contract, and validation guide live under this feature; no duplicate ADR is needed. |
| VII. Verification is part of delivery | PASS — checks and affected tests are identified. | PASS — quickstart covers focused, full API, migration, and repository checks. |
| VIII. One workflow owner | PASS — Spec Kit owns artifacts; GitHub owns issue/PR status. | PASS — seed initialization is product behavior, not a delivery orchestration state machine. |

**Gate result**: PASS. No constitution violation requires a complexity exception.

## Project Structure

### Documentation (this feature)

```text
specs/discharge-preparation/operational-foundation/persist-and-seed-discharge-preparation-and-resource-reservations/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── managed-preparation-initialization.md
├── checklists/
│   └── requirements.md
└── tasks.md                         # created by /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── models/
│   │   ├── discharge.ts
│   │   ├── product_lot.ts
│   │   ├── discharge_truck_assignment.ts
│   │   ├── shift.ts
│   │   ├── warehouse_door_product_lot_assignment.ts
│   │   ├── shift_truck.ts
│   │   ├── shift_warehouse_door.ts
│   │   └── shift_weighing_area.ts
│   ├── discharges/
│   │   └── shared/repositories/       # persisted usage and preparation queries
│   └── site_references/shared/        # persistence-backed usage checker adapter
├── database/
│   ├── migrations/1785000000000_create_discharges_table.ts
│   ├── migrations/1785000000001_create_product_lots_table.ts
│   ├── migrations/1785000000002_create_discharge_truck_assignments_table.ts
│   ├── migrations/1785000000003_create_shifts_table.ts
│   ├── migrations/1785000000004_create_warehouse_door_product_lot_assignments_table.ts
│   ├── migrations/1785000000005_create_shift_trucks_table.ts
│   ├── migrations/1785000000006_create_shift_warehouse_doors_table.ts
│   ├── migrations/1785000000007_create_shift_weighing_areas_table.ts
│   ├── factories/
│   │   ├── discharge_factory.ts
│   │   ├── product_lot_factory.ts
│   │   ├── discharge_truck_assignment_factory.ts
│   │   ├── shift_factory.ts
│   │   └── shift_resource_membership_factories.ts
│   └── seeders/09_discharge_preparation_seeder.ts
├── database/schema.ts                 # regenerated from migrations
└── tests/
    ├── unit/discharges/               # model/factory and invariant tests
    ├── integration/database/discharge_preparation_seeders.spec.ts
    └── integration/site_references/   # persisted usage protection regressions
```

**Structure Decision**: Keep persistence entities in the existing `apps/api/app/models` layer,
feature-specific queries and usage protection under the `discharges`/`site_references` vertical
slices, and deterministic data setup in the established numbered database seeder/factory layers.
No frontend or route directories are touched.

## Phase 0: Research outputs

Research is complete in [research.md](./research.md). Key decisions resolved before design:

- normalized foreign-keyed membership tables instead of polymorphic resource rows;
- portable scalar schema constraints plus atomic application checks for cross-row overlap/conflicts;
- stable fixed identities and key-based upsert/repair for managed graphs;
- one transaction per Planned/Active/Closed graph;
- persistence-backed site-reference usage protection;
- integration-first verification based on the existing site-reference seeder precedent.

## Phase 1: Design outputs

- [data-model.md](./data-model.md) defines fields, relationships, state rules, snapshots, and
  reservation invariants.
- [contracts/managed-preparation-initialization.md](./contracts/managed-preparation-initialization.md)
  defines the internal seed/repair contract and lifecycle guarantees.
- [quickstart.md](./quickstart.md) defines focused, migration, full API, and repository validation.

## Implementation sequencing for task generation

1. Add the migration and generated schema surface for all preparation entities and portable scalar
   constraints.
2. Add Lucid models and relationships, including historical snapshot columns and explicit membership
   tables.
3. Add focused factories with explicit foreign-key injection and states for planned, active,
   completed, and released contexts.
4. Add persistence-backed preparation queries and replace the transitional site-reference usage
   checker binding, preserving existing test seams.
5. Add the deterministic scenario seeder after the site-reference seeders, with stable identities,
   explicit parent resolution, per-graph transactions, and drift repair.
6. Add RED tests for model invariants, seed graph completeness, idempotence, snapshots, conflict
   protection, missing/ambiguous parents, and partial-graph recovery; implement until green.
7. Regenerate Lucid schema/indexes and run the quickstart plus repository verification commands.

## Complexity Tracking

No constitution violations or unjustified complexity exceptions are introduced.
