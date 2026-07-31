# Implementation Plan: List Docks

**Branch**: `feat/197-list-docks` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/operational-checkpoints/docks/list-docks/spec.md`

## Summary

Expose a read-only dock consultation screen to the roles already authorized by the API for the
complete dock collection inside the Checkpoints interface category. The `/checkpoints` TanStack
Start route will preload the existing typed
`GET /api/v1/docks` query, derive an All/Available/Archived status filter, and keep the filter,
checkpoint-name search, and typed `checkpoint=dock:<id>` selection in validated URL state. The page presents a
full-area MapCN/MapLibre map whose upper-left overlay contains the search field and status menu.
Search emphasizes matches and mutes nonmatches without removing spatial context; status filtering
hides excluded docks from the map. Dock markers expose name
tooltips and open the same read-only detail sheet on pointer or keyboard activation. Route-level
pending and error components will distinguish loading, filter-specific emptiness, search no-match,
recoverable collection failures, and a
non-blocking unavailable map background. Because the collection DTO already contains every detail,
the redundant `GET /api/v1/docks/:id` route, controller action, use case, tests, and generated Tuyau
contract will be removed. No persistence change or replacement endpoint is required.

## Technical Context

**Language/Version**: TypeScript 5.7 (`apps/api`) and TypeScript 5.9 (`apps/web`) on the repository's
Node.js ESM runtime

**Primary Dependencies**: AdonisJS 7, Lucid 22, Bouncer 4, Tuyau 1.2, TanStack Start/Router/Query,
React 19, TanStack Table 8, MapCN registry component, MapLibre GL, Zod 4, shadcn/Base UI,
Tailwind CSS 4

**Storage**: Existing PostgreSQL `docks` table through Lucid; SQLite-backed test database; no
schema change

**Testing**: Japa API integration tests; Vitest 4 with jsdom, Testing Library, and MSW for the web
feature; affected browser flow where configured

**Target Platform**: Authenticated responsive web workstation backed by the Node.js API

**Project Type**: PNPM/Turbo monorepo web application (`apps/api` + `apps/web`)

**Performance Goals**: At least 95% of normal successful loads reach the collection or correct
empty state within 2 seconds; status changes, local name matching, and detail selection reuse the
loaded query cache and do not refetch the collection

**Constraints**: API remains authoritative for authorization and site data; All is the default
status filter; archived records remain read-only; light/dark MapLibre style URLs and their
source attribution are deployment configuration rather than MapCN's default CARTO basemaps; the
page presents map-specific feedback if the basemap style fails; search is a client-side dock-name match that
preserves nonmatching context; no custom sorting, filtering beyond status, mutation, address lookup, pagination, or
persistence change in this slice

**Scale/Scope**: One route, one retained collection endpoint, one removed detail endpoint, three
status-filter choices, one dock-name search, one full-area map presentation, one read-only detail
sheet, and pending/empty/no-match/error/retry/degraded-map states for the site's dock reference collection

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I — Selected intent**: PASS. Issue #197 has the selected feature contract in `spec.md`; this
  plan does not expand the adjacent create, update, archive, or reactivate issues.
- **II — Independent delivery**: PASS. Authorized dock consultation, including its observable
  feedback states, can be implemented, tested, and reviewed without dock mutations.
- **III — Human gates**: PASS. The specification exists and planning was explicitly requested.
  This plan must receive human review before `$speckit-tasks` or implementation.
- **IV — Test-first behavior**: PASS. API route-removal/authorization/serialization regressions and
  web map, status filter, dock-name match/muting, no-match recovery, map marker, tooltip, detail,
  stale-selection, pending, empty, error, retry, and degraded map behaviors have observable test seams.
- **V — Deep boundaries**: PASS. Existing use case/repository/controller boundaries remain intact;
  Tuyau owns the transport contract and the docks web slice owns DTO-to-view presentation.
- **VI — Durable knowledge**: PASS. Domain vocabulary remains in `CONTEXT.md`, architectural
  choices remain in ADRs, and feature-specific decisions are recorded only in these artifacts.
- **VII — Verification**: PASS. The quickstart includes targeted suites and the repository-wide
  `pnpm check`, `pnpm typecheck`, and `pnpm test` gates plus an affected browser journey.
- **VIII — One workflow owner**: PASS. No workflow state, Project field, or delivery orchestrator
  is introduced.

**Post-design re-check**: PASS. The Phase 1 model and HTTP/UI contracts introduce no new storage,
cross-feature dependency, authorization bypass, or constitution exception. The cartographic
integration is isolated behind a feature-owned UI adapter and does not become authoritative state.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/operational-checkpoints/docks/list-docks/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── docks.openapi.yaml
│   └── ui-state.md
└── tasks.md             # Created later by /speckit-tasks, not by this plan
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/docks_controller.ts
│   ├── docks/
│   │   ├── list/list_docks_use_case.ts
│   │   └── shared/
│   │       ├── dock_policy.ts
│   │       ├── dock_transformer.ts
│   │       └── repositories/
│   └── models/dock.ts
└── tests/
    ├── integration/docks.spec.ts
    └── unit/docks/

apps/web/src/
├── components/layout/app-sidebar.tsx
├── components/ui/map.tsx
├── config/map.ts
├── features/checkpoints/
│   ├── __tests__/
│   ├── map/
│   │   ├── checkpoint-map.tsx
│   │   └── checkpoint-marker.tsx
│   ├── checkpoint-search.ts
│   ├── checkpoint-selection.ts
│   ├── types.ts
│   └── ui/
├── features/docks/
│   ├── __tests__/
│   ├── queries/dock-queries.ts
│   ├── dock-checkpoint-adapter.ts
│   ├── types.ts
│   └── ui/
│       └── dock-details.tsx
└── routes/_authenticated/checkpoints.tsx

apps/web/
├── .env.example
├── .env.docker.example
├── Dockerfile
└── package.json
```

**Structure Decision**: Keep the existing API and web dock vertical slices resource-specific, and
place the aggregate interface under `features/checkpoints` with a thin `/checkpoints` route. The
checkpoint slice owns route state, search/filter presentation, MapCN rendering, markers, legend,
feedback, and the shared sheet. The dock slice owns its Tuyau query, DTO, checkpoint adapter, and
detail renderer; a future weighing-area slice can add the same seams without creating a checkpoint
API entity. Remove the API `show` route,
controller dependency/action, `docks/show/get_dock_use_case.ts`, and their dedicated tests, then
regenerate the Tuyau registry so `docks.show` disappears from the client contract. Install MapCN's
`map` registry item into `components/ui/map.tsx`; it brings `maplibre-gl`, MapCN's Tailwind styles,
and the composable `Map`, `MapMarker`, `MarkerContent`, and `MarkerTooltip` primitives. Isolate their
use in `features/checkpoints/map/checkpoint-map.tsx`; page tests consume this category-owned adapter.
Render a standard search input with a clear affordance and an accessible radio-menu status
button in a responsive absolute overlay at the map's upper left. Normalize names for case- and
diacritic-insensitive substring matching in a pure feature helper. Apply status first so the map
receives that filtered set, then annotate matching IDs so matches gain a non-color-only emphasis
and nonmatches are muted rather than removed. Update the `search` URL parameter with replacement
navigation while typing, keep `status=all|available|archived`, and clear the typed `checkpoint`
selection when a status change excludes it. Do not refit or recenter the viewport for each search
keystroke. `/docks` is not retained as a page route.
Validate `VITE_MAP_STYLE_LIGHT_URL` and `VITE_MAP_STYLE_DARK_URL` in `config/map.ts`, document them
in both example environments, and pass them through the production web image build.
Reuse shared design-system primitives and the technical date formatter, but do not depend on the
`customers` business slice; equivalent dock UI stays feature-owned as required by ADR-0008.

## Complexity Tracking

No constitution violations require justification.
