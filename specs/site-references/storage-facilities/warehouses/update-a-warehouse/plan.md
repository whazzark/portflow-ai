# Implementation Plan: Update a Warehouse

**Branch**: `feat/209-update-warehouse` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/storage-facilities/warehouses/update-a-warehouse/spec.md`

## Summary

Let an authorized administrator correct an available warehouse's name and reshape its footprint from
the warehouse map (`/warehouses`), in one all-or-nothing submission that preserves the warehouse's
identity, status, creation time, and doors — and that is refused when the new outline would push one
of those doors outside it.

This slice is a full-stack vertical with an unusually clear precedent on each side:

1. **The API has no update path.** `WarehousesController` exposes only `index` and `store`;
   `WarehouseRepository` declares only `create` and `list`; `WarehousePolicy` declares only `create`
   and `list`. This feature adds `PATCH /api/v1/warehouses/:id` with its policy ability, validator,
   use case, transactional repository write, and three new exceptions — following the shape
   `UpdateDockUseCase` (#199) already established, result kind for result kind.
2. **The schema is already in place.** #207's migration created `warehouses` and
   `warehouse_footprint_points` with the ordered `position` primary key and the `LOWER(name)` unique
   index; `warehouse_doors` exists. **No migration is required.**
3. **One genuinely new business rule.** Door containment (FR-016) is the only thing here with no
   precedent anywhere in the codebase. It costs one pure predicate — `containsPoint` — added beside
   `assertSimpleFootprint`, which the create slice deliberately left reusable for exactly this.
4. **The drawing layer draws but cannot edit.** `PendingPolygonPlacement` arms map clicks and appends
   vertices; an update never arms the map, inserts on a designated edge, and removes any vertex. It
   gets a sibling layer rather than a mode flag (research R8).
5. **The edit-session discipline already exists.** `useCheckpointEditSession` encodes the three rules
   #199 hardened — snapshot at session start, discard on selection change, never re-derive from live
   query data. Those rules are carried over to a warehouse-specific hook; the hook itself is not
   generalized (research R11).

## Technical Context

**Language/Version**: TypeScript 5.7 (apps/api, AdonisJS on Node.js) and TypeScript 5.9 (apps/web, React 19 via TanStack Start)

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, VineJS, Bouncer 4, Tuyau 1.2; React 19.1, TanStack Router/Query/Form (`useAppForm`), `@tuyau/react-query`, Zod, `sonner`, MapLibre GL through the shared `Map` components, Tailwind CSS 4 — all pre-existing, no new runtime dependency

**Storage**: PostgreSQL via the existing `warehouses`, `warehouse_footprint_points`, and `warehouse_doors` tables — no schema change, no migration

**Testing**: Japa unit and integration for apps/api; Vitest + Testing Library + MSW for apps/web; manual affected browser flow, as no Playwright suite is configured

**Target Platform**: Linux-hosted AdonisJS JSON API and modern desktop/tablet browsers

**Project Type**: PNPM/Turbo monorepo web application (`apps/api` + `apps/web`), extending an existing feature area

**Performance Goals**: The corrected name and polygon are visible within 2 seconds of a successful submission (SC-001). One guarded row update plus a bounded delete-and-reinsert of footprint points in a single transaction; the self-intersection guard stays O(n²) and containment O(n·d) over a handful of vertices and doors

**Constraints**: Reuse the existing `/warehouses` route and its URL-as-state contract rather than introducing a page; the API stays the authorization and business-state source of truth, with both client geometry guards as feedback only; boundary-point order must round-trip exactly; an update is all-or-nothing and must never leave a partially replaced footprint; the existing consultation and creation tests must pass unchanged in substance

**Scale/Scope**: One new endpoint, one new use case, one new pure predicate per workspace, one new shared map layer, one update panel, one edit-session hook, and the second map mode on the warehouses page. No data migration, no new persisted entity, no change to warehouse doors

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

| Principle | Design evidence | Result |
|---|---|---|
| I. Selected feature intent is versioned | Issue #209 is selected off the Warehouses roadmap (#43) on `feat/209-update-warehouse`; `spec.md` is the behavioral contract, created only on selection. | PASS |
| II. One independently deliverable feature per spec | Scope is exactly "update a warehouse" end-to-end: map mode → new endpoint → visible corrected result. Archive and reactivate stay in #210–#211; warehouse doors stay in roadmap #44 (FR-028). | PASS |
| III. Vanilla Spec Kit gates protect product intent | No clarification markers remain; the readiness checklist passes; the door-containment rule and the two interaction questions were settled with the product owner before planning. No repository-owned delivery state machine is introduced. | PASS |
| IV. Test-first observable behavior | Every requirement lands on exactly one seam (research R14): policy and use-case units, a pure geometry unit per workspace, HTTP integration per status code, and four web test files. None of this behavior exists yet, so RED → GREEN applies throughout. | PASS |
| V. Deep boundaries and explicit contracts | Policy authorizes; the validator owns transport shape; the use case owns normalization, geometry, and the containment decision; the repository owns the transaction, `position` assignment, the status guard, and unique-violation mapping; the transformer owns the DTO; the page owns URL state, the session hook owns draft state, and the map layer owns rendering. No cross-layer shortcut. | PASS |
| VI. Durable knowledge has a home | `CONTEXT.md` already defines **Warehouse**, **Warehouse Footprint**, and **Warehouse Door**, and ADR-0006 already records the polygon-over-point decision. No new vocabulary and no new ADR. | PASS |
| VII. Verification is part of delivery | `quickstart.md` requires checks, typecheck, API and web tests, the full fast suite, the affected browser flow, and a fresh review. | PASS |
| VIII. One workflow owner | Plan and artifacts stay inside Spec Kit; no new orchestration or delivery state. | PASS |

### Post-design re-check

Re-evaluated after Phase 1 (`data-model.md`, `contracts/`, `quickstart.md`):

- **II** — Confirmed PASS. The only shared-code touchpoints are additive: a new file beside
  `resource-map-polygon-placement.tsx` and one extracted `PolygonOutline` both layers render.
  `resource-map-placement.tsx`, `resource-placement-fields.tsx`, and every dock, weighing-area, and
  warehouse-door behavior are untouched.
- **IV** — Confirmed PASS. `quickstart.md` scenarios 1–22 are concrete RED targets `/speckit-tasks`
  can order, split across API units, API integration, and five web test files.
- **V** — Confirmed PASS. Door containment is decided in the use case from data the repository
  returns, not inside a query; the repository never learns why a footprint is unacceptable. The new
  `edit` search-param value and the UI-state contract cross no layer boundary.
- **VI** — Confirmed PASS after re-reading `CONTEXT.md`: "within or on the boundary" is already the
  recorded door-placement rule, so FR-016 enforces existing vocabulary rather than introducing any.
- No other gate is affected, and no new violation was found.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/storage-facilities/warehouses/update-a-warehouse/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── warehouses-update.openapi.yaml
│   └── warehouse-update-ui-state.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/api/
├── app/warehouses/
│   ├── update/update_warehouse_use_case.ts              # NEW — normalize, assert geometry, assert containment, map result kinds
│   └── shared/
│       ├── footprint_geometry.ts                        # MODIFIED — add pure `containsPoint` (on-boundary counts as inside)
│       ├── warehouse_exceptions.ts                      # MODIFIED — E_WAREHOUSE_NOT_FOUND (404), E_WAREHOUSE_ARCHIVED (409), E_WAREHOUSE_DOORS_OUTSIDE_FOOTPRINT (409)
│       ├── warehouse_validator.ts                       # MODIFIED — updateWarehouseValidator (optional name / optional footprint, at least one)
│       ├── warehouse_policy.ts                          # MODIFIED — add `update` (admin roles, same as `create`)
│       └── repositories/
│           ├── warehouse_repository.ts                  # MODIFIED — add `findWithDoors` + `updateAvailable` with command/result types
│           └── lucid_warehouse_repository.ts            # MODIFIED — guarded row update + transactional footprint replacement
├── app/controllers/warehouses_controller.ts             # MODIFIED — add `update`, 200
├── start/routes.ts                                      # MODIFIED — PATCH /api/v1/warehouses/:id
├── .adonisjs/client/registry/index.ts                   # MODIFIED (generated) — warehouses.update entry
└── tests/
    ├── unit/warehouses/update/update.spec.ts            # NEW
    ├── unit/warehouses/update/footprint_containment.spec.ts  # NEW
    └── integration/warehouses/update/update.spec.ts     # NEW

apps/web/src/
├── components/resource-map/
│   ├── resource-map-polygon-editing.tsx                 # NEW — un-armed editable ring: vertex markers, per-edge insert handles, per-vertex remove
│   ├── resource-map-polygon-placement.tsx               # MODIFIED — outline rendering extracted to the shared `PolygonOutline`
│   ├── resource-map-polygon-outline.tsx                 # NEW — the GeoJSON outline both layers render
│   └── __tests__/resource-map-polygon-editing.test.tsx  # NEW
├── features/warehouses/
│   ├── geometry/footprint-validation.ts                 # MODIFIED — add `isInsideFootprint` + `doorsOutsideFootprint`
│   ├── use-warehouse-edit-session.ts                    # NEW — draft footprint + name, snapshotted origin, discarded on selection change
│   ├── mutations/use-warehouse-mutations.ts             # MODIFIED — add the update mutation + list invalidation
│   ├── ui/update-warehouse-panel.tsx                    # NEW — sheet: pre-filled name, point count, coordinate path, submit/cancel
│   ├── ui/warehouse-details.tsx                         # MODIFIED — expose the update action to authorized administrators on available warehouses
│   ├── ui/warehouses-page.tsx                           # MODIFIED — edit mode, exclusivity with creation, success handling
│   ├── map/warehouse-map.tsx                            # MODIFIED — editing layer, edited polygon excluded from selection layer, doors kept visible
│   ├── map/warehouse-polygon.tsx                        # MODIFIED — accept an excluded id while a session is open
│   └── __tests__/
│       ├── update/{session,reshape,validation,permissions}.test.tsx  # NEW
│       └── footprint-containment.test.ts                # NEW
└── routes/_authenticated/warehouses.tsx                 # MODIFIED — `edit` search param
```

**Structure Decision**: Extend both workspaces along their binding vertical-slice conventions. On the
API, the update is a `warehouses/update` workflow while persistence, authorization, validation, and
the geometry rules stay under `warehouses/shared` — where #208 already put them and where #210 and
#211 will reach next. On the web, the resource-agnostic editable-ring layer lives in
`components/resource-map/` beside the drawing layer it partners with, and everything
warehouse-specific — the session hook, the mutation, the panel, the client guards, and the page's
mode wiring — stays inside `features/warehouses/`.

**Reuse contract for `resource-map-polygon-editing.tsx`**: like the placement layers beside it, its
public surface must not encode warehouse semantics. It takes `points: LatLng[]`,
`onMovePoint(index, point)`, `onInsertPoint(index, point)`, `onRemovePoint(index)`,
`minimumPoints: number`, and styling, and renders the ring, its draggable vertex markers, and one
insert handle per edge. It never arms the map. What the ring means, what it may not overlap, and who
may edit it all stay in `features/warehouses/`. Nothing in it may import from `features/`.

## Complexity Tracking

*No Constitution Check violations were identified. This section intentionally left without entries.*

Two decisions worth recording without being violations:

1. **The client geometry guard is duplicated a second time.** `containsPoint` joins
   `assertSimpleFootprint` as a pure function implemented once per workspace, for the reason #208 R6
   gave and this slice does not change: there is no shared package, and one more ~25-line predicate
   does not justify creating the first one. Both copies carry their own unit tests. The duplicated
   surface is now two functions, and the warehouse-door slices (#44) will need the same containment
   predicate — that is the point at which `packages/geometry` becomes an evidence-backed decision
   rather than speculation, and it should be revisited there rather than here (research R7).
2. **The edit-session discipline is copied, not abstracted.** `use-warehouse-edit-session.ts` repeats
   the three rules `useCheckpointEditSession` hardened after #199 while drafting a different shape —
   a sequence of points with insert-at-index and remove-at-index rather than a single point. A hook
   generic over both would be used half-way by each of its two callers, and would force a
   cross-feature import the vertical-slice convention does not make. If a third editable-geometry
   resource appears, promoting a shared session hook into `components/resource-map/` becomes the
   better-evidenced decision (research R11).
