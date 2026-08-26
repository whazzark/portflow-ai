# Implementation Plan: Create a Warehouse Door

**Branch**: `feat/213-create-warehouse-door` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/storage-facilities/warehouse-doors/create-a-warehouse-door/spec.md`

## Summary

Let an authorized administrator add a door to an available warehouse: with the warehouse selected on
`/warehouses`, activating **Create door** from its Doors panel arms the map for a single point,
clicking inside the footprint drops a pending marker, and submitting a name unique within that
warehouse creates an Available door that appears immediately under its warehouse, in the list and on
the map.

This slice is narrower than #208 was, because two of its three hard parts already exist:

1. **The door schema and its invariants are already in place.** #212's migration created
   `warehouse_doors` with the `(warehouse_id, LOWER(name))` unique index, the `name = TRIM(name)`
   and non-empty CHECK constraints, and the latitude/longitude range CHECKs. **No migration is
   required.**
2. **The containment rule already exists on both sides.** `containsPoint`
   (`apps/api/app/warehouses/shared/footprint_geometry.ts`) and `isInsideFootprint`
   (`apps/web/src/features/warehouses/geometry/footprint-validation.ts`) were written for #209's
   "doors must stay inside the new outline" rule and are already unit-tested. This slice consumes
   both unchanged — it adds **no new geometry**.
3. **The point-placement primitives already exist.** `useResourceMapPlacement`,
   `PendingPlacementMarker`, `useCoordinateFields`, and `CoordinateField` were built
   resource-agnostic by #198 and are consumed as they stand. The warehouse map currently composes
   only the *polygon* placement layer; this slice adds a small local *point* layer beside it,
   mirroring `CheckpointPlacementLayer` one-for-one.

What is genuinely new is the **first warehouse-door write path**: `WarehouseDoorsController` exposes
only `available`, `WarehouseDoorRepository` declares only `listAvailable()`, and
`WarehouseDoorPolicy` declares only `listAvailable()`. This feature adds `POST /api/v1/warehouse-doors`
with its policy, validator, use case, transactional repository write, and exceptions — plus a second
map mode on `/warehouses`, scoped to the selected warehouse rather than to the page.

The one rule with no precedent is the **eligibility precondition**: a door may only be created under
an *available* warehouse, and that warehouse's status and footprint must be read inside the write
transaction, not before it, so a concurrent archival or footprint replacement cannot leave a door
available under an archived warehouse or outside its own footprint.

## Technical Context

**Language/Version**: TypeScript 5.7 (apps/api, AdonisJS on Node.js) and TypeScript 5.9 (apps/web, React 19 via TanStack Start)

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, VineJS, Bouncer 4, Tuyau 1.2; React 19.1, TanStack Router/Query/Form (`useAppForm`), `@tuyau/react-query`, Zod, `sonner`, MapLibre GL through the shared `Map` components, Tailwind CSS 4 — all pre-existing, no new runtime dependency

**Storage**: PostgreSQL via the existing `warehouse_doors` table created by #212 — no schema change, no migration

**Testing**: Japa unit and integration for apps/api; Vitest + Testing Library + MSW for apps/web; manual affected browser flow, as no Playwright suite is configured

**Target Platform**: Linux-hosted AdonisJS JSON API and modern desktop/tablet browsers

**Project Type**: PNPM/Turbo monorepo web application (`apps/api` + `apps/web`), extending an existing feature area

**Performance Goals**: The new door is visible under its warehouse within 2 seconds of a successful submission (SC-001). One locked warehouse read plus one insert in a single transaction; containment is an O(n) ray cast over a footprint of a few dozen vertices

**Constraints**: The creation action stays inside the selected warehouse's existing consultation context — no standalone door route, page, or detail view (FR-002); the warehouse's eligibility and footprint are evaluated inside the write transaction (FR-007, FR-014); the client containment guard is feedback only, the API stays authoritative; the embedded door shape in `warehouses.index` is not changed, so every #212 consultation test passes unchanged in substance

**Scale/Scope**: One new endpoint, one new use case, one new repository method, one new panel, one new map layer, and a second value for the existing `create` search param. No migration, no new persisted entity, no new geometry module, no change to warehouse consultation

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

| Principle | Design evidence | Result |
|---|---|---|
| I. Selected feature intent is versioned | Issue #213 is selected off the Warehouse Doors roadmap (#44) on `feat/213-create-warehouse-door`, with its blocker #212 closed; `spec.md` is the behavioral contract, created only on selection. | PASS |
| II. One independently deliverable feature per spec | Scope is exactly "create a warehouse door" end-to-end: panel action → new endpoint → visible door. Update, archive, and reactivate stay in #214–#216 (FR-024); warehouse creation and consultation are already delivered. | PASS |
| III. Vanilla Spec Kit gates protect product intent | No clarification markers remain and the readiness checklist passes. The one defaulted rule — archived warehouses accept no new doors — is stated in the spec's Assumptions and re-derived here from #210's cascade, not silently invented. No repository-owned delivery state machine is introduced. | PASS |
| IV. Test-first observable behavior | Every requirement has an observable seam: policy and use-case units, HTTP integration for each status code, and web tests for arming, placement, validation, permissions, eligibility, and the post-creation reveal. RED→GREEN applies throughout — no warehouse-door write behavior exists yet. | PASS |
| V. Deep boundaries and explicit contracts | The policy authorizes; the validator owns transport shape and coordinate ranges; the use case owns name normalization and the containment decision; the repository owns the locked warehouse read, the insert, and the unique-violation mapping; the transformer owns the DTO; the page owns URL state and the map owns rendering. No cross-layer shortcut. | PASS |
| VI. Durable knowledge has a home | `CONTEXT.md` already defines **Warehouse Door** and **Warehouse Door GPS Location** ("within or on the boundary of its warehouse footprint"), and ADR-0006 already records the polygon footprint decision. No new vocabulary and no new ADR. | PASS |
| VII. Verification is part of delivery | `quickstart.md` requires checks, typecheck, API and web tests, the full fast suite, the affected browser flow, and a fresh review. | PASS |
| VIII. One workflow owner | Plan and artifacts stay inside Spec Kit; no new orchestration or delivery state. | PASS |

### Post-design re-check

Re-evaluated after Phase 1 (`data-model.md`, `contracts/`, `quickstart.md`):

- **II** — Confirmed PASS. The only change to shared code is *additive*: `WarehouseDoorTransformer`
  gains `createdAt` (research R6), which the existing `warehouse_doors.available` consumer ignores.
  No dock, weighing-area, or warehouse consultation behavior changes, and `useCoordinateFields` and
  `PendingPlacementMarker` are consumed without modification.
- **IV** — Confirmed PASS. `quickstart.md` scenarios 1–22 are concrete RED targets that
  `/speckit-tasks` can order, split across API units, API integration, and four web test files.
- **V** — Confirmed PASS. The design adds a `create=door` search-param value and a UI-state
  contract; neither crosses a layer boundary. The containment decision stays in the use case, which
  hands the repository a predicate evaluated against the footprint read inside the transaction —
  the same `excludedDoors` shape `UpdateWarehouseCommand` already uses.
- **VI** — Confirmed PASS after re-check. Reusing `E_WAREHOUSE_NOT_FOUND` and `E_WAREHOUSE_ARCHIVED`
  for the eligibility failures (research R3) keeps one code per condition rather than minting a
  door-flavoured duplicate of an existing warehouse fact.
- No other gate is affected, and no new violation was found.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/storage-facilities/warehouse-doors/create-a-warehouse-door/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── warehouse-doors-create.openapi.yaml
│   └── warehouse-door-creation-ui-state.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/api/
├── app/warehouse_doors/
│   ├── create/create_warehouse_door_use_case.ts          # NEW — normalize name, range-check the point, own the containment decision
│   └── shared/
│       ├── warehouse_door_exceptions.ts                  # NEW — E_WAREHOUSE_DOOR_NAME_CONFLICT (409), E_WAREHOUSE_DOOR_NAME_INVALID (422), E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT (422)
│       ├── warehouse_door_validator.ts                   # NEW — createWarehouseDoorValidator
│       ├── warehouse_door_policy.ts                      # MODIFIED — add `create` (admin roles)
│       ├── warehouse_door_transformer.ts                 # MODIFIED — expose `createdAt`
│       └── repositories/
│           ├── warehouse_door_repository.ts              # MODIFIED — add `create` + command/result types
│           └── lucid_warehouse_door_repository.ts        # MODIFIED — locked warehouse read, insert, unique-violation mapping
├── app/controllers/warehouse_doors_controller.ts         # MODIFIED — add `store`, 201
├── start/routes.ts                                       # MODIFIED — POST /api/v1/warehouse-doors
└── tests/
    ├── unit/warehouse_doors/creation/create.spec.ts      # NEW
    ├── unit/warehouse_doors/warehouse_door_policy.spec.ts # NEW
    └── integration/warehouse_doors/creation/create.spec.ts # NEW

apps/web/src/
├── components/resource-map/                              # Unchanged — placement, fields, and create control reused as they stand
├── features/warehouse-doors/
│   ├── mutations/use-warehouse-door-mutations.ts         # NEW — create mutation + warehouse-list invalidation
│   ├── ui/create-warehouse-door-panel.tsx                # NEW — sheet: name, synced coordinates, submit
│   ├── ui/warehouse-doors-panel.tsx                      # MODIFIED — "Create door" action in the panel header
│   └── __tests__/create/{placement,create,validation,permissions}.test.tsx  # NEW
├── features/warehouses/
│   ├── map/warehouse-map.tsx                             # MODIFIED — door placement layer, fit kept while it is armed
│   ├── ui/warehouses-page.tsx                            # MODIFIED — door creation mode, exclusivity, success reveal
│   └── __tests__/support/mock-warehouse-map.tsx          # MODIFIED — expose the door placement seam
└── routes/_authenticated/warehouses.tsx                  # MODIFIED — `create` accepts `'door'`
```

**Structure Decision**: Extend the existing API and web workspaces along their binding vertical-slice
conventions. On the API, creation is a `warehouse_doors/create` workflow while authorization,
validation, persistence, and the DTO stay under `warehouse_doors/shared`, where #214–#216 will reach
for them. On the web, everything door-specific — the mutation, the panel, the panel action — lives in
`features/warehouse-doors/`, while the map layer and the mode's URL wiring live in
`features/warehouses/` because they belong to the surface that owns the map and the search params.
Nothing new is added to `components/resource-map/`: this slice is the reuse case those primitives
were built for.

**Boundary note on the cross-feature reach**: `features/warehouse-doors/` already imports
`features/warehouses/types`, and its new mutation invalidates `warehouseQueries.list()` because the
warehouse collection is what embeds the doors. That direction is the existing one and is not
widened — `features/warehouses/` gains no import from `features/warehouse-doors/` beyond the
`WarehouseDoorsPanel` and `WarehouseDoorMarker` it already renders.

## Complexity Tracking

*No Constitution Check violations were identified. This section intentionally left without entries.*

One decision worth recording without being a violation: the containment rule is evaluated **twice**
in the request path — once in the use case against the footprint the repository read under lock, and
once in the browser against the footprint already in the warehouse collection. The browser copy is
pre-submit feedback only and reuses `isInsideFootprint`, which #209 already introduced and tested;
this slice adds no third copy and no new module. The duplication is the one `research.md` R6 of
#208 already justified and is inherited here rather than re-argued.
