# Implementation Plan: List Warehouse Doors

**Branch**: `feat/212-list-warehouse-doors` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/storage-facilities/warehouse-doors/list-warehouse-doors/spec.md`

## Summary

Deliver a read-only warehouse-door consultation slice for every active authenticated user. The
protected `GET /api/v1/warehouses` collection embeds every available and archived door beneath its
authoritative warehouse, giving the web one warehouse/footprint/door snapshot. A protected
`GET /api/v1/warehouse-doors/available` collection returns only available doors whose containing
warehouse is also available, preparing a safe source for future discharge selectors without adding
discharge behavior here. The web keeps `/warehouses` as the sole entry point and preserves its
warehouse-only overview until one warehouse is selected. Selection frames that footprint and
progressively reveals only its lifecycle-admitted doors as compact accessible markers with no
persistent labels; hover, focus, or selection reveals identity, and the selected marker alone gains
strong emphasis. The adjacent list remains the primary dense-navigation path and presents counts
plus the selected door state. URL state restores lifecycle and selection. The warehouse sheet becomes
non-modal for this screen so the map remains interactive while the panel is open.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js ESM runtime

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, Bouncer 4, Tuyau 1.2, React 19.1,
TanStack Start/Router/Query, MapLibre GL 6.1, Base UI/shadcn, Tailwind CSS 4, Zod 4

**Storage**: PostgreSQL in production; in-memory SQLite for API tests; new `warehouse_doors` table
referencing the existing `warehouses` table

**Testing**: Japa API unit/integration tests against the real Lucid repository; Vitest/jsdom web
unit and real-router feature tests with Testing Library and MSW; manual affected browser flow
because no Playwright suite or script is configured in this checkout

**Target Platform**: Linux-hosted AdonisJS JSON API and responsive modern desktop/mobile browsers

**Project Type**: PNPM/Turbo web application with separate API and TanStack Start workspaces

**Performance Goals**: For up to 200 warehouses and 1,000 warehouse doors, 95% of successful
consultations show the selected warehouse's door collection or correct empty state within 2
seconds; warehouse switching, lifecycle filtering, counts, and selection are client-local after the
single warehouse snapshot is cached

**Constraints**: Read-only slice; active session required; all active roles may consult; API remains
the authorization and business-state source of truth; one implicit site; permanent warehouse
containment; each GPS point is within or on its warehouse footprint; warehouse-scoped,
case-insensitive name uniqueness across lifecycle states; no complete standalone door collection,
item-detail route, pagination, search, custom sort, mutation, discharge creation/assignment,
PostGIS, or new dependency

**Scale/Scope**: One organization and one site, at most 200 warehouses and 1,000 doors, one expanded
warehouse endpoint, one selector-safe available-door endpoint, one existing warehouse web route,
two door lifecycle views, and one selected-door state

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

| Principle | Design evidence | Result |
|---|---|---|
| I. Selected feature intent is versioned | Issue #212 is selected on `feat/212-list-warehouse-doors`; the clarified `spec.md` remains the behavioral contract. | PASS |
| II. One independently deliverable feature per spec | Persistence, protected read contract, warehouse-screen integration, and tests deliver one consultation outcome; issues #213–#216 retain all mutations. | PASS |
| III. Vanilla Spec Kit gates protect product intent | Clarification resolved name, entry-point, and lifecycle-default choices; this plan and its design artifacts form the required second human review gate. | PASS |
| IV. Test-first observable behavior | API authorization/collection tests and web lifecycle, marker, detail, empty, failure, retry, and URL-state tests provide failing observable seams before implementation. | PASS |
| V. Deep boundaries and explicit contracts | Warehouse policy/use case/repository/transformer own the nested consultation snapshot; the door repository and available use case own selector safety; the warehouse-door web slice owns presentation of embedded DTOs. | PASS |
| VI. Durable knowledge has a home | The plan references `CONTEXT.md` and ADRs; feature decisions stay in this directory and no duplicate canonical vocabulary or architecture record is introduced. | PASS |
| VII. Verification is part of delivery | The quickstart requires focused API/web suites, repository gates, and desktop/mobile affected browser flows. | PASS |
| VIII. One workflow owner | The design adds no delivery state, orchestration, or Project-field mirror. | PASS |

### Post-design re-check

Phase 1 preserves every gate. The expanded warehouse projection, selector-safe named door resource,
immutable warehouse foreign key, explicit nested/minimal DTOs, URL-backed UI state, progressive
door-overlay disclosure, and non-modal composition seam keep layer and feature ownership explicit.
The small shared sheet option and marker-offset extraction are technical primitives required by
observable interaction, not a new business abstraction. No constitutional violation or complexity
exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/storage-facilities/warehouse-doors/list-warehouse-doors/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── warehouse-doors.openapi.yaml
│   └── warehouse-door-ui-state.md
└── tasks.md                              # generated later by /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/
│   │   ├── warehouse_doors_controller.ts
│   │   └── warehouses_controller.ts
│   ├── models/
│   │   ├── warehouse.ts
│   │   └── warehouse_door.ts
│   └── warehouse_doors/
│       ├── available/list_available_warehouse_doors_use_case.ts
│       └── shared/
│           ├── repositories/
│           │   ├── warehouse_door_repository.ts
│           │   └── lucid_warehouse_door_repository.ts
│           ├── warehouse_door_policy.ts
│           └── warehouse_door_transformer.ts
├── app/warehouses/shared/
│   ├── repositories/lucid_warehouse_repository.ts
│   └── warehouse_transformer.ts
├── database/
│   ├── factories/warehouse_door_factory.ts
│   ├── migrations/*_create_warehouse_doors_table.ts
│   ├── schema.ts                         # regenerated from migrations
│   └── seeders/07_warehouse_door_seeder.ts
├── providers/repositories_provider.ts
├── start/routes.ts
└── tests/
    ├── integration/
    │   ├── warehouse_doors/consultation/available.spec.ts
    │   └── warehouses/consultation/list.spec.ts
    └── unit/warehouse_doors/consultation/available.spec.ts

apps/web/src/
├── components/
│   ├── resource-map/resource-marker-offset.ts
│   └── ui/sheet.tsx
├── features/
│   ├── checkpoints/map/checkpoint-marker-offset.ts  # replaced by shared helper
│   ├── warehouse-doors/
│   │   ├── __tests__/
│   │   │   ├── consultation.test.tsx
│   │   │   ├── feedback.test.tsx
│   │   │   ├── marker-offset.test.ts
│   │   │   └── support/
│   │   ├── map/
│   │   │   ├── warehouse-door-legend.tsx
│   │   │   └── warehouse-door-marker.tsx
│   │   ├── ui/
│   │   │   └── warehouse-doors-panel.tsx
│   │   ├── types.ts
│   │   └── warehouse-door-presentation.ts
│   └── warehouses/
│       ├── map/warehouse-map.tsx
│       └── ui/warehouses-page.tsx
├── routes/_authenticated/warehouses.tsx
├── routeTree.gen.ts                      # regenerated by TanStack Router
└── test/msw/handlers.ts
```

**Structure Decision**: Add a dedicated warehouse-door persistence/API slice while extending the
existing warehouse read slice to preload and transform its contained doors. The named door resource
exposes only the selector-safe `/available` collection. The Warehouses screen remains the sole web
composition boundary and consumes doors through its existing warehouse query; `features/warehouse-doors`
owns filtering, counts, marker presentation, and selection, but no transport query. Shared UI changes
are limited to an opt-in overlay-free sheet mode and a generic deterministic marker-collision helper;
the warehouse map composes the door overlay only for a selected warehouse and otherwise retains its
current overview behavior. Existing consumers retain their current behavior. Generated database
schema and route-tree files are refreshed through their generators, never edited as feature source.

## Complexity Tracking

No constitutional violations require justification.
