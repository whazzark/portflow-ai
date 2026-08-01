# Implementation Plan: List Warehouses

**Branch**: `feat/207-list-warehouses` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/storage-facilities/warehouses/list-warehouses/spec.md`

## Summary

Deliver a read-only warehouse consultation slice for every active authenticated user. A protected
`GET /api/v1/warehouses` endpoint returns the current single-site collection, including each
warehouse's lifecycle status and complete ordered footprint. The web route follows the existing
checkpoints map pattern: it presents filtered warehouse polygons on the MapLibre map, provides
client-side name search and available/archived status filters, stores filter and selection state in
the URL, and opens the selected warehouse in a detail sheet while fitting its complete polygon.
Warehouses and ordered footprint points use relational storage so the PostgreSQL runtime and SQLite
test repository exercise the same model without introducing PostGIS or a separately maintained
center.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web)

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, Bouncer 4, Tuyau 1.2, React 19.1,
TanStack Start/Router/Query, Base UI/shadcn, Tailwind CSS 4

**Storage**: PostgreSQL in production; in-memory SQLite repository tests; new `warehouses` and
`warehouse_footprint_points` tables

**Testing**: Japa API unit/integration tests, Vitest/jsdom web feature tests with Testing Library
and MSW; manual affected browser flow because no Playwright suite is currently configured

**Target Platform**: Linux-hosted AdonisJS JSON API and modern desktop/mobile web browsers

**Project Type**: PNPM/Turbo web application with separate API and TanStack Start workspaces

**Performance Goals**: For up to 200 warehouses, 95% of normal consultations render the selected
lifecycle set and both counts within 2 seconds; selection and tab changes are client-local after the
collection response

**Constraints**: Read-only slice; active session required; all active roles may consult; API remains
the authorization and business-state source of truth; complete ordered polygons must be preserved;
client-side name search and status filtering follow the checkpoints consultation pattern; no
pagination/server-side search/sort controls, warehouse mutation, PostGIS, or stored center

**Scale/Scope**: One organization and one site in the current product model, at most 200 warehouses,
two lifecycle views, one collection endpoint, one web route, and one selected-warehouse detail view

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

| Principle | Design evidence | Result |
|---|---|---|
| I. Selected feature intent is versioned | Issue #207 is selected on `feat/207-list-warehouses`; `spec.md` is the behavioral contract. | PASS |
| II. One independently deliverable feature per spec | API, persistence, UI, and tests deliver only read-only warehouse consultation; management remains out of scope. | PASS |
| III. Vanilla Spec Kit gates protect product intent | The current spec has no clarification markers and its readiness checklist passes; this plan is the next explicit review artifact. | PASS |
| IV. Test-first observable behavior | API authorization/contract and web lifecycle, selection, footprint, empty, failure, and retry behavior have observable test seams. | PASS |
| V. Deep boundaries and explicit contracts | Policy authorizes; use case requests the collection; repository owns ordered persistence retrieval; transformer owns DTO shape; UI adapter owns framing. | PASS |
| VI. Durable knowledge has a home | Feature decisions remain in these artifacts; existing `CONTEXT.md` vocabulary and ADRs are referenced rather than copied into another canonical source. | PASS |
| VII. Verification is part of delivery | Quickstart requires checks, typechecking, API/web tests, the full fast suite, and the affected browser flow. | PASS |
| VIII. One workflow owner | No new delivery state or orchestration is introduced. | PASS |

### Post-design re-check

Phase 1 preserves all gates. The REST contract, normalized footprint model, and URL-driven UI keep
layer ownership explicit. No constitutional violation or complexity exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/storage-facilities/warehouses/list-warehouses/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── warehouses.openapi.yaml
└── tasks.md                       # generated later by /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/warehouses_controller.ts
│   ├── models/warehouse.ts
│   ├── models/warehouse_footprint_point.ts
│   └── warehouses/
│       ├── list/list_warehouses_use_case.ts
│       └── shared/
│           ├── repositories/warehouse_repository.ts
│           ├── repositories/lucid_warehouse_repository.ts
│           ├── warehouse_policy.ts
│           └── warehouse_transformer.ts
├── database/
│   ├── factories/warehouse_factory.ts
│   └── migrations/*_create_warehouses_tables.ts
├── providers/repositories_provider.ts
├── start/routes.ts
└── tests/
    ├── integration/warehouses/consultation/list.spec.ts
    └── unit/warehouses/consultation/list.spec.ts

apps/web/src/
├── components/layout/app-sidebar.tsx
├── features/warehouses/
│   ├── __tests__/
│   │   ├── consultation.test.tsx
│   │   ├── feedback.test.tsx
│   │   └── support/
│   ├── geometry/footprint-frame.ts
│   ├── map/warehouse-map.tsx
│   ├── map/warehouse-legend.tsx
│   ├── map/warehouse-polygon.tsx
│   ├── map/warehouse-tooltip.tsx
│   ├── queries/warehouse-queries.ts
│   ├── types.ts
│   └── ui/
│       ├── warehouse-details.tsx
│       ├── warehouse-footprint.tsx
│       ├── warehouse-map-controls.tsx
│       ├── warehouse-list.tsx
│       ├── warehouses-error.tsx
│       ├── warehouses-page.tsx
│       └── warehouses-pending.tsx
├── routes/_authenticated/warehouses.tsx
└── test/msw/handlers.ts
```

**Structure Decision**: Extend the existing API and web workspaces using their binding vertical
slice conventions. The collection endpoint is a warehouse `list` workflow; shared warehouse
persistence, authorization, and transport mapping stay under `app/warehouses/shared`. The route is
thin, while the web feature owns the checkpoints-compatible URL filters, MapLibre polygon layer,
status styling and legend, tooltip, selection sheet, and pure polygon-bounds adapter.

## Complexity Tracking

No constitutional violations require justification.
