# Implementation Plan: List Weighing Areas

**Branch**: `feat/202-list-weighing-areas` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/operational-checkpoints/weighing-areas/list-weighing-areas/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Extend the merged `/checkpoints` map so authorized administrators can consult weighing areas beside
docks without introducing a second checkpoint screen. Retain `GET /api/v1/weighing-areas` as the
sole Weighing Area read contract, remove the redundant `GET /api/v1/weighing-areas/:id` route and its
dedicated controller/use-case/test/registry surface, strengthen deterministic ordering and
consultation-focused contract coverage, then add a resource-owned Tuyau query, DTO adapter, detail
renderer, fixtures, and tests to the existing Checkpoint aggregation
seams. The shared route keeps its All/Available/Archived status filter, normalized search, typed
`checkpoint=weighing-area:<id>` selection, map, marker, legend, pending/error boundary, and degraded
basemap behavior. No persistence schema or mutation behavior changes are required.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js 22

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, Bouncer 4, Tuyau 1.2, TanStack Start/Router 1.168+, TanStack Query 5.101, React 19, Tailwind CSS 4, existing shadcn/Base UI primitives

**Storage**: Existing PostgreSQL `weighing_areas` table; SQLite in-memory database for automated API tests; no migration

**Testing**: Japa 5 API unit/integration tests; Vitest 4 + Testing Library + MSW feature tests; manual affected browser flow; repository-wide Biome and TypeScript checks

**Target Platform**: AdonisJS HTTP service on Linux and responsive modern-browser TanStack Start workstation

**Project Type**: PNPM/Turbo web application with separate API and web workspaces

**Performance Goals**: Collection usable within 2 seconds for at least 95% of successful consultations with up to 500 areas; status distinguishable within 10 seconds

**Constraints**: API remains authoritative for authorization and business state; the existing
`/checkpoints` route and shared map remain the only checkpoint consultation surface; docks and
weighing areas keep separate resource contracts; no create/update/archive/reactivate/delete
controls; archived records remain readable; search/status/typed selection stay URL-backed;
weighing-area pending/failure/retry feedback is source-specific so the already-delivered Dock map
remains usable; basemap failure remains non-blocking

**Scale/Scope**: Single site, up to 500 weighing areas added to the existing dock map, two resource
kinds, three shared status-filter choices, one shared search, one collection-backed typed detail
sheet, and one retained Weighing Area API read endpoint

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-design gate

- **Selected and independently deliverable intent**: PASS. GitHub issue #202 has one end-to-end
  consultation outcome, an active feature directory, and a dedicated non-`master` branch.
- **Human spec review**: PASS as an input gate for this invocation. The current reviewed `spec.md`
  is the behavioral source of truth; no material clarification remains in the plan.
- **Test-first observable behavior**: PASS. API authorization/ordering/response behavior and web
  consultation states will be driven through failing Japa and router-level Vitest/MSW tests before
  implementation.
- **Deep boundaries and explicit contracts**: PASS. Lucid repository owns ordering, use cases own
  reads, controllers adapt HTTP, each resource slice owns its Tuyau DTO/query/detail adapter, and the
  merged Checkpoint slice owns only aggregate map and URL-state presentation.
- **Durable knowledge placement**: PASS. Existing vocabulary and ADRs already cover weighing areas,
  authorization authority, Tuyau, and frontend slices; no new durable architecture decision is
  introduced.
- **Verification and workflow ownership**: PASS. Spec Kit retains artifact state, GitHub retains
  Kanban/review state, and final verification includes the repository gates and affected browser
  flow.

### Post-design gate

PASS. The Phase 1 design preserves the merged Docks boundary: Checkpoint remains a UI category,
not an API or persisted entity; the two named resource APIs remain authoritative; resource adapters
feed one shared map; URL state is limited to search, status, and typed selection; and every specified
exceptional state has a validation scenario. Plan review remains the required human gate before
`$speckit-tasks`.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/operational-checkpoints/weighing-areas/list-weighing-areas/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── weighing-areas.openapi.yaml
│   └── checkpoint-ui-state.md
└── tasks.md                         # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/weighing_areas_controller.ts
│   └── weighing_areas/
│       ├── list/list_weighing_areas_use_case.ts
│       └── shared/
│           ├── repositories/lucid_weighing_area_repository.ts
│           ├── weighing_area_policy.ts
│           └── weighing_area_transformer.ts
└── tests/
    ├── integration/weighing_areas.spec.ts
    └── unit/weighing_areas/weighing_area_use_cases.spec.ts

apps/web/src/
├── routes/_authenticated/checkpoints.tsx
├── features/checkpoints/
│   ├── __tests__/
│   ├── map/checkpoint-marker.tsx
│   ├── types.ts
│   └── ui/
│       ├── checkpoint-map-panel.tsx
│       ├── checkpoint-sheet.tsx
│       └── checkpoints-page.tsx
├── features/weighing-areas/
│   ├── __tests__/
│   │   └── support/
│   ├── weighing-area-checkpoint-adapter.ts
│   ├── queries/weighing-area-queries.ts
│   ├── types.ts
│   └── ui/weighing-area-details.tsx
└── features/docks/                  # Existing merged peer resource, reused unchanged where possible
```

**Structure Decision**: Extend commit `829b19d1`'s established Checkpoint aggregation instead of
creating the previously planned `/checkpoints/weighing-areas` route, status-tab table, second page,
or duplicate page-level pending/error components. Keep the existing Dock route preload intact and
load the Weighing Area source through its own query state inside the aggregate page so its failure
cannot regress Dock consultation. `features/weighing-areas` owns its Tuyau query, DTO type,
checkpoint adapter, fixtures, and read-only detail renderer; `features/checkpoints` combines Dock
and Weighing Area presentation
records, uses the already-reserved `WEIGHING_AREA` kind and `weighing-area:<id>` codec, renders both
marker kinds in one legend/map, changes the layer-visibility contract so both delivered resource
kinds are visible by default, and delegates sheet content through a discriminated resource union.
Preserve the existing map search/status semantics and extend them across both resource kinds. Show
weighing-area-specific empty feedback even when docks keep the aggregate map non-empty. Resolve the
selected Weighing Area from the current collection exactly as Docks does, clear stale or
status-excluded selections, remove the redundant API show seam, and regenerate the Tuyau registry.
Reuse shared design-system and Checkpoint primitives without depending on the Customers slice.

## Complexity Tracking

No constitution violations require justification.
