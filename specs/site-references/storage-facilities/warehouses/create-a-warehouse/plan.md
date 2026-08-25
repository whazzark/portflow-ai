# Implementation Plan: Create a Warehouse

**Branch**: `feat/208-create-warehouse` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/storage-facilities/warehouses/create-a-warehouse/spec.md`

## Summary

Let an authorized administrator create a warehouse by activating a creation mode on the existing
warehouse map (`/warehouses`), drawing the required footprint by clicking its boundary points
directly on the map, naming it, and confirming — the new warehouse appears immediately as Available
with the exact polygon that was drawn.

Unlike #203, where the backend already existed, **this slice is a genuine full-stack vertical**:

1. **The API has no warehouse write path yet.** `WarehousesController` exposes only `index`,
   `WarehouseRepository` declares only `list()`, and `WarehousePolicy` declares only `list()`. This
   feature adds `POST /api/v1/warehouses` with its policy, validator, use case, transactional
   repository write, and exceptions.
2. **The schema is already in place.** #207's migration created `warehouses` and
   `warehouse_footprint_points` with the ordered `position` primary key, the latitude/longitude CHECK
   constraints, and the `LOWER(name)` unique index. **No migration is required.**
3. **The map primitives are already resource-agnostic.** `useResourceMapPlacement` arms the map,
   captures clicks, and suppresses the map's normal click behaviour — which is precisely FR-002a. It
   is consumed unmodified; `onPlace` appends a vertex instead of replacing a point. `CoordinateField`
   and `ResourceMapCreateControl` are likewise reused as they stand.
4. **The warehouse map has no mode and no control cluster today.** This slice introduces both: a
   `MapControls` cluster hosting the create action, and a `create=warehouse` search param that makes
   mode exclusivity with the detail sheet fall out of navigation (FR-002b).

The one genuinely new shared primitive is a pending-polygon layer beside the existing placement
primitive: the outline plus one draggable marker per vertex, with a `LatLng[]` surface carrying no
warehouse vocabulary, because Update a Warehouse (#209) needs the identical drawing surface.

## Technical Context

**Language/Version**: TypeScript 5.7 (apps/api, AdonisJS on Node.js) and TypeScript 5.9 (apps/web, React 19 via TanStack Start)

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, VineJS, Bouncer 4, Tuyau 1.2; React 19.1, TanStack Router/Query/Form (`useAppForm`), `@tuyau/react-query`, Zod, `sonner`, MapLibre GL through the shared `Map` components, Tailwind CSS 4 — all pre-existing, no new runtime dependency

**Storage**: PostgreSQL via the existing `warehouses` and `warehouse_footprint_points` tables — no schema change, no migration

**Testing**: Japa unit and integration for apps/api; Vitest + Testing Library + MSW for apps/web; manual affected browser flow, as no Playwright suite is configured

**Target Platform**: Linux-hosted AdonisJS JSON API and modern desktop/tablet browsers

**Project Type**: PNPM/Turbo monorepo web application (`apps/api` + `apps/web`), extending an existing feature area

**Performance Goals**: The new warehouse is visible on the map within 2 seconds of a successful submission (SC-001). One insert plus a bounded set of point inserts in a single transaction; self-intersection detection is O(n²) over a handful of vertices

**Constraints**: Reuse the existing `/warehouses` route and its URL-as-state contract rather than introducing a page; consume `useResourceMapPlacement` and `CoordinateField` as-is rather than forking them; the API stays the authorization and business-state source of truth, with the client geometry guard as feedback only; point order must round-trip exactly; creation must be all-or-nothing; the existing consultation tests must pass unchanged in substance

**Scale/Scope**: One new endpoint, one new use case, one new pure geometry module per workspace, one new shared map primitive, one creation panel, and the first map mode on the warehouses page. No data migration, no new persisted entity, no change to warehouse doors

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

| Principle | Design evidence | Result |
|---|---|---|
| I. Selected feature intent is versioned | Issue #208 is selected off the Warehouses roadmap (#43) on `feat/208-create-warehouse`; `spec.md` is the behavioral contract, created only on selection. | PASS |
| II. One independently deliverable feature per spec | Scope is exactly "create a warehouse" end-to-end: UI mode → new endpoint → visible result. Update, archive, and reactivate stay in #209–#211; warehouse doors stay in roadmap #44 (FR-022). | PASS |
| III. Vanilla Spec Kit gates protect product intent | No clarification markers remain; the readiness checklist passes; the interaction model was confirmed with the product owner before planning. No repository-owned delivery state machine is introduced. | PASS |
| IV. Test-first observable behavior | Every requirement has an observable seam: policy and use case units, a pure geometry unit on each side, HTTP integration for each status code, and web tests for arming, drawing, validation, permissions, and the post-creation reveal. RED→GREEN applies to all of it — none of this behavior exists yet. | PASS |
| V. Deep boundaries and explicit contracts | Policy authorizes; the validator owns transport shape; the use case owns normalization and geometric invariants; the repository owns the transaction, `position` assignment, and unique-violation mapping; the transformer owns the DTO; the page owns URL state and the map owns rendering. No cross-layer shortcut. | PASS |
| VI. Durable knowledge has a home | `CONTEXT.md` already defines **Warehouse** and **Warehouse Footprint**, and ADR-0006 already records the polygon-over-point decision. No new vocabulary and no new ADR. | PASS |
| VII. Verification is part of delivery | `quickstart.md` requires checks, typecheck, API and web tests, the full fast suite, the affected browser flow, and a fresh review. | PASS |
| VIII. One workflow owner | Plan and artifacts stay inside Spec Kit; no new orchestration or delivery state. | PASS |

### Post-design re-check

Re-evaluated after Phase 1 (`data-model.md`, `contracts/`, `quickstart.md`):

- **II** — Confirmed PASS. The only shared-code touchpoint is *additive*: a new file beside
  `resource-map-placement.tsx`. No existing dock, weighing-area, or warehouse-door behavior changes,
  and `useCoordinateFields` is deliberately left untouched (research R7) so its two current callers
  are not churned.
- **IV** — Confirmed PASS. `quickstart.md` scenarios 1–20 are concrete RED targets that
  `/speckit-tasks` can order, split across API units, API integration, and four web test files.
- **V** — Confirmed PASS. The design adds a `create=warehouse` search-param value and a UI-state
  contract; neither crosses a layer boundary. The geometry rule lives in a pure module the future
  `UpdateWarehouseUseCase` (#209) can call without going through HTTP.
- No other gate is affected, and no new violation was found.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/storage-facilities/warehouses/create-a-warehouse/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── warehouses-create.openapi.yaml
│   └── warehouse-creation-ui-state.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/api/
├── app/warehouses/
│   ├── create/create_warehouse_use_case.ts              # NEW — normalize name, assert geometry, map DUPLICATE_NAME
│   └── shared/
│       ├── footprint_geometry.ts                        # NEW — pure: duplicate-consecutive + self-intersection
│       ├── warehouse_exceptions.ts                      # NEW — E_WAREHOUSE_NAME_CONFLICT (409), E_WAREHOUSE_INVALID_FOOTPRINT (422)
│       ├── warehouse_validator.ts                       # NEW — createWarehouseValidator
│       ├── warehouse_policy.ts                          # MODIFIED — add `create` (admin roles)
│       └── repositories/
│           ├── warehouse_repository.ts                  # MODIFIED — add `create` + command/result types
│           └── lucid_warehouse_repository.ts            # MODIFIED — transactional insert, position order, reload with preloads
├── app/controllers/warehouses_controller.ts             # MODIFIED — add `store`, 201
├── start/routes.ts                                      # MODIFIED — POST /api/v1/warehouses
└── tests/
    ├── unit/warehouses/creation/create.spec.ts          # NEW
    ├── unit/warehouses/creation/footprint_geometry.spec.ts  # NEW
    └── integration/warehouses/creation/create.spec.ts   # NEW

apps/web/src/
├── components/resource-map/
│   ├── resource-map-polygon-placement.tsx               # NEW — pending outline + draggable vertex markers (LatLng[])
│   ├── resource-map-placement.tsx                       # Unchanged — consumed as-is
│   ├── resource-placement-fields.tsx                    # Unchanged — CoordinateField reused
│   └── __tests__/resource-map-polygon-placement.test.tsx  # NEW
├── features/warehouses/
│   ├── geometry/footprint-validation.ts                 # NEW — pure client guard
│   ├── __tests__/footprint-validation.test.ts           # NEW — beside the existing footprint-frame.test.ts
│   ├── mutations/use-warehouse-mutations.ts             # NEW — create mutation + list invalidation
│   ├── ui/create-warehouse-panel.tsx                    # NEW — sheet: name, vertex list, remove-last, submit
│   ├── ui/warehouses-page.tsx                           # MODIFIED — creation mode, exclusivity, success reveal
│   ├── ui/warehouse-map-controls.tsx                    # Unchanged
│   ├── map/warehouse-map.tsx                            # MODIFIED — MapControls cluster, create control, pending layer
│   └── __tests__/create/{drawing,create,validation,permissions}.test.tsx  # NEW
└── routes/_authenticated/warehouses.tsx                 # MODIFIED — `create` search param
```

**Structure Decision**: Extend the existing API and web workspaces along their binding vertical-slice
conventions. On the API, creation is a `warehouses/create` workflow while persistence, authorization,
validation, and the geometry rule stay under `warehouses/shared`, where #209 will reach for them. On
the web, the resource-agnostic drawing surface lives in `components/resource-map/` next to the
placement primitive it partners with — the same placement decision #198 and #203 made, and justified
here by a second known consumer (#209) rather than by speculation. Everything warehouse-specific —
the mutation, the panel, the client guard, and the page's mode wiring — stays inside
`features/warehouses/`.

**Reuse contract for `resource-map-polygon-placement.tsx`**: like the placement primitive beside it,
its public surface must not encode warehouse semantics. It takes `armed: boolean`, `points: LatLng[]`,
`onAddPoint`, `onMovePoint(index, point)`, `onComplete`, `completed: boolean`, and styling, and
renders the outline plus vertex markers — with the first vertex becoming a "Finish the outline"
control once a ring exists. The footprint's meaning, its minimum size, and its validity all stay in
`features/warehouses/`. Nothing in it may import from `features/`.

## Complexity Tracking

*No Constitution Check violations were identified. This section intentionally left without entries.*

One decision worth recording without being a violation: the self-intersection guard is implemented
twice — authoritatively in `apps/api` and as pre-submit feedback in `apps/web` — because the
workspace has no shared package and this slice does not justify introducing the first one for a
~40-line pure function (research R6). Both copies carry their own unit tests. If #209 and the
warehouse-door slices need the same helper, a shared package becomes a separate, better-evidenced
decision at that point.
