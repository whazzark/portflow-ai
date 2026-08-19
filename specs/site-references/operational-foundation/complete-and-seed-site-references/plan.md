# Implementation Plan: Complete and Seed Operational Site References

**Branch**: `feat/235-seed-site-reference-foundation` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/operational-foundation/complete-and-seed-site-references/spec.md`

## Summary

Complete the persisted lifecycle context of Warehouses and Warehouse Doors, then make the seven
site-reference seeders converge on a coherent managed demonstration dataset. A new additive Lucid
migration and model/factory updates align storage resources with the existing lifecycle schema.
Declarative seed records use normalized business identifiers, fixed lifecycle occurrences and one
explicit demo actor; repeated runs update the same identities and relationships, replace only the
managed warehouse footprints, preserve unrelated data, and fail when a declared parent is missing.
Existing read routes, authorization, filtering, ordering, transformers, DTOs and web screens remain
unchanged and serve as regression contracts.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 22 ESM toolchain

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, Luxon 3.7, PNPM 10/Turbo

**Storage**: PostgreSQL runtime; in-memory SQLite for Japa tests; additive lifecycle columns on
`warehouses` and `warehouse_doors`; existing relational tables for all seven references

**Testing**: Japa 5 unit/integration tests against Lucid, existing consultation integration suites,
and a disposable local PostgreSQL seed-rerun validation

**Target Platform**: Linux-hosted AdonisJS service and developer/test initialization environments

**Project Type**: PNPM/Turbo monorepo; API persistence and database initialization change only

**Performance Goals**: A clean initialization of the declared low-cardinality demonstration
dataset completes within 60 seconds; a rerun performs bounded work proportional to the managed set

**Constraints**: No new or changed HTTP/Tuyau contract, web route, consultation behavior or mutation;
stable UUIDs across reruns; case-insensitive business-key matching; fixed lifecycle occurrences;
nullable actor FKs with `SET NULL`; permanent Truck-to-company and Door-to-warehouse relationships;
door points must be within/on footprints; unrelated records remain untouched

**Scale/Scope**: Seven site-reference kinds, at least three lifecycle scenarios per kind, two
storage tables completed, eight ordered seeders, one managed demonstration dataset, and focused
migration/factory/seeder plus existing consultation regression tests

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

| Principle | Design evidence | Result |
|---|---|---|
| I. Selected feature intent is versioned | Issue #235 is selected on `feat/235-seed-site-reference-foundation`; `spec.md` is the behavioral contract. | PASS |
| II. One independently deliverable feature per spec | The delivery completes and initializes the site-reference foundation only; operational entities and new consultations remain in their own issues. | PASS |
| III. Vanilla Spec Kit gates protect product intent | The requirements checklist passed without material ambiguity, the user invoked planning after specification, and this command stops at plan review. | PASS |
| IV. Test-first observable behavior | Migration persistence, lifecycle scenarios, rerun convergence, relationship integrity, geographic validity and consultation compatibility have observable Japa seams. | PASS |
| V. Deep boundaries and explicit contracts | Lucid migrations/models own persistence, seeders own managed initialization, and existing repositories/use cases/controllers/transformers stay unchanged. | PASS |
| VI. Durable knowledge has a home | Existing `CONTEXT.md` and ADR 0006 remain authoritative; feature-specific initialization decisions live only in these artifacts. | PASS |
| VII. Verification is part of delivery | The quickstart requires focused tests, existing consultation regressions, repository gates and a disposable PostgreSQL rerun check. | PASS |
| VIII. One workflow owner | No workflow state or Project-field mirror is introduced; GitHub remains the operational tracker. | PASS |

### Post-design re-check

**PASS**. The additive schema, internal initialization contract and regression-only use of existing
HTTP interfaces preserve every gate. No layer shortcut, new public contract or independently
deliverable outcome has been folded into the feature. No constitution exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/operational-foundation/complete-and-seed-site-references/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── managed-reference-initialization.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/
├── app/models/
│   ├── warehouse.ts
│   └── warehouse_door.ts
├── database/
│   ├── factories/
│   │   ├── customer_factory.ts
│   │   ├── dock_factory.ts
│   │   ├── transport_company_factory.ts
│   │   ├── truck_factory.ts
│   │   ├── warehouse_factory.ts
│   │   ├── warehouse_door_factory.ts
│   │   └── weighing_area_factory.ts
│   ├── migrations/
│   │   └── <timestamp>_add_storage_reference_lifecycle_metadata.ts
│   ├── schema.ts                         # regenerated by Lucid
│   └── seeders/
│       ├── 01_user_seeder.ts
│       ├── 02_customer_seeder.ts
│       ├── 03_transport_company_seeder.ts
│       ├── 04_dock_seeder.ts
│       ├── 05_weighing_area_seeder.ts
│       ├── 06_warehouse_seeder.ts
│       ├── 07_warehouse_door_seeder.ts
│       └── 08_truck_seeder.ts
└── tests/
    ├── integration/database/site_reference_seeders.spec.ts
    └── unit/database/storage_reference_lifecycle.spec.ts
```

**Structure Decision**: Keep the change inside the API workspace and its existing Lucid database
boundary. Add one forward migration rather than rewriting delivered table migrations, extend the
two storage models and lifecycle-capable factories, normalize the duplicate `07` seeder ordering,
and verify the complete seeder chain at the database boundary. Existing vertical consultation
slices, controllers, routes, transformers and the web workspace are deliberately absent because
their contracts do not change. `database/schema.ts` is regenerated through Lucid, not hand-edited.

## Complexity Tracking

No constitutional violations require justification.
