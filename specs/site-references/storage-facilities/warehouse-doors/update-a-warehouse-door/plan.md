# Implementation Plan: Update a Warehouse Door

**Branch**: `feat/214-update-warehouse-door` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/storage-facilities/warehouse-doors/update-a-warehouse-door/spec.md`

## Summary

Let an authorized administrator correct an available door of an available warehouse: from the
Doors panel on `/warehouses`, the `Edit` entry in a door row's action menu opens a session pre-filled
with that door's current name and coordinates, the marker becomes draggable — with the coordinate fields as the
synchronized pointer-free path — and saving applies the name, the position, or both in one atomic
write that keeps the door's identity, containing warehouse, status, and creation time.

The slice is narrow because every piece it needs was built before it:

1. **The schema is complete.** `warehouse_doors` (#212) already carries `updated_at`, the
   `(warehouse_id, LOWER(name))` unique index, the `name = TRIM(name)` and `LENGTH(name) > 0`
   CHECKs, and the coordinate range CHECKs. **No migration.**
2. **The rules already have one implementation each.** `containsPoint` and `isInsideFootprint`
   (#209), `normalizeSiteReferenceName` and the coordinate predicates (`#site_references/shared`),
   and the four door exceptions (#213) are consumed unchanged.
3. **The interaction primitives already exist.** `PendingPlacementMarker` is draggable,
   `useCoordinateFields` already binds it to two text fields, and `WarehouseDoorPlacementLayer`
   already composes them on the warehouse map. This slice reuses that layer with `armed: false`
   rather than adding a second one.
4. **The row action menu already exists.** `ResourceRowActions` (`components/lifecycle/`) is the
   per-row administration menu trucks, customers, and transport companies already use, and
   `truck-list.tsx` is the layout precedent line for line. Adopting it now is what lets #215 and
   #216 add `Archive` and `Reactivate` as menu entries instead of restructuring the Doors panel
   (research R10).

What is genuinely new is the **first warehouse-door update path**: `PATCH /api/v1/warehouse-doors/:id`
with its policy ability, validator, use case, transactional repository write, and two new
exceptions — plus a third map mode on `/warehouses`, the second one scoped to a selection rather than
to the page.

Two rules carry the design. The **lock order** is warehouse-then-door, matching #213's create and
#210's cascade, with the door's `warehouse_id` learned by an unlocked pre-read that cannot go stale
because containment is permanent (research R2). And the **unique index is the sole arbiter of the
name**: it lets a door resubmit its own name — or a different casing of it — with no self-exclusion
clause, while still resolving a concurrent claim of one name to exactly one winner (research R4).

## Technical Context

**Language/Version**: TypeScript 5.7 (apps/api, AdonisJS on Node.js) and TypeScript 5.9 (apps/web, React 19 via TanStack Start)

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, VineJS, Bouncer 4, Tuyau 1.2; React 19.1, TanStack Router/Query/Form (`useAppForm`), `@tuyau/react-query`, Zod, `sonner`, MapLibre GL through the shared `Map` components, Tailwind CSS 4 — all pre-existing, no new runtime dependency

**Storage**: PostgreSQL via the existing `warehouse_doors` table created by #212 — no schema change, no migration

**Testing**: Japa unit and integration for apps/api; Vitest + Testing Library + MSW for apps/web; manual affected browser flow, as no Playwright suite is configured

**Target Platform**: Linux-hosted AdonisJS JSON API and modern desktop/tablet browsers

**Project Type**: PNPM/Turbo monorepo web application (`apps/api` + `apps/web`), extending an existing feature area

**Performance Goals**: The corrected name and position are visible in consultation within 2 seconds of a successful save (SC-001). One locked warehouse read plus one guarded row update in a single transaction; containment is an O(n) ray cast over a footprint of a few dozen vertices, skipped entirely on a name-only update (research R3)

**Constraints**: The update stays inside the selected warehouse's existing door consultation context — no standalone door route, page, or detail view, which #212 FR-004a forbids and #214 does not lift (FR-005); the containing warehouse's eligibility and footprint are read under lock inside the write transaction (FR-013a, FR-016); the client containment guard is feedback only, the API stays authoritative; the door's identity, containing warehouse, status, creation time, and lifecycle context are unreachable from this payload (FR-003); the embedded door shape in `warehouses.index` is unchanged, so every #212 consultation test passes unchanged in substance

**Scale/Scope**: One new endpoint, one new policy ability, one new use case, one new repository method, two new exceptions, one new panel, one new row-actions wrapper, one new session hook, one widened search-param value, one additive transformer member, and one prop made optional on an existing shared component. No migration, no new persisted entity, no new geometry module, no new shared component

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

| Principle | Design evidence | Result |
|---|---|---|
| I. Selected feature intent is versioned | Issue #214 is selected off the Warehouse Doors roadmap (#44) on `feat/214-update-warehouse-door`, with its blocker #212 closed and its sibling #213 delivered; `spec.md` is the behavioral contract, created only on selection. | PASS |
| II. One independently deliverable feature per spec | Scope is exactly "update a warehouse door" end-to-end: row action → new endpoint → corrected door visible. Archive and reactivate stay in #215–#216, and re-parenting a door to another warehouse is refused by the domain, not deferred (FR-027). | PASS |
| III. Vanilla Spec Kit gates protect product intent | No clarification markers remain and the readiness checklist passes. The three defaulted rules — name-only mutable identity, archived doors read-only, usage not blocking an update — are stated in the spec's Assumptions and re-derived here from `CONTEXT.md` and #209, not silently invented. No repository-owned delivery state machine is introduced. | PASS |
| IV. Test-first observable behavior | Every requirement has an observable seam: policy and use-case units, HTTP integration for each status code, and web tests for the entry point, the session, repositioning, validation, and permissions. RED→GREEN applies throughout — no warehouse-door update behavior exists yet. | PASS |
| V. Deep boundaries and explicit contracts | The policy authorizes; the validator owns transport shape, coordinate ranges, and the "position submitted whole" rule; the use case owns name normalization and the containment decision; the repository owns the locked warehouse read, the guarded update, and the unique-violation mapping; the transformer owns the DTO; the page owns URL state and the map owns rendering. No cross-layer shortcut. | PASS |
| VI. Durable knowledge has a home | `CONTEXT.md` already defines **Warehouse Door** ("permanently belonging to one warehouse") and **Warehouse Door GPS Location** ("within or on the boundary of its warehouse footprint"), which are the two invariants this slice enforces. No new vocabulary and no new ADR. | PASS |
| VII. Verification is part of delivery | `quickstart.md` requires checks, typecheck, API and web tests, the full fast suite, the affected browser flow, and a fresh review. | PASS |
| VIII. One workflow owner | Plan and artifacts stay inside Spec Kit; no new orchestration or delivery state. | PASS |

### Post-design re-check

Re-evaluated after Phase 1 (`data-model.md`, `contracts/`, `quickstart.md`):

- **II** — Confirmed PASS. The only changes to shared code are *additive*: `WarehouseDoorTransformer`
  gains `updatedAt` (research R5), `WarehouseMapDoorPlacement` gains `label`, the `edit` search param
  gains one value, and `ResourceRowActions.renderDialog` becomes optional (research R10). Every
  existing consumer ignores the first three and already satisfies the fourth. No dock,
  weighing-area, checkpoint, truck, customer, or warehouse behavior changes.
  The row menu is scoped carefully: adopting `ResourceRowActions` **anticipates** #215/#216 by
  choosing the container they will fill, and delivers none of their behavior — `actions` is `[]`
  and no lifecycle dialog is written here, so FR-027 holds.
- **IV** — Confirmed PASS. `quickstart.md` scenarios 1–24 are concrete RED targets that
  `/speckit-tasks` can order, split across API units, API integration, and five web test files.
- **V** — Confirmed PASS after re-check. The containment decision stays in the use case, which hands
  the repository a predicate evaluated against the footprint read under lock — the same `contains`
  shape `CreateWarehouseDoorCommand` already uses. The one boundary question this slice raised —
  whether the repository should decide "name only, so skip containment" — is resolved in the *use
  case*, which simply omits the predicate (research R3), leaving the repository with no business
  branch.
- **VI** — Confirmed PASS. The two new exceptions (research R6) name conditions no existing code
  names; the warehouse's own failures keep reusing `E_WAREHOUSE_NOT_FOUND` and `E_WAREHOUSE_ARCHIVED`
  rather than minting door-flavoured duplicates, as #213 established.
- No other gate is affected, and no new violation was found.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/storage-facilities/warehouse-doors/update-a-warehouse-door/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── warehouse-doors-update.openapi.yaml
│   └── warehouse-door-update-ui-state.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/api/
├── app/warehouse_doors/
│   ├── update/update_warehouse_door_use_case.ts          # NEW — normalize the name, range-check the point, own the containment decision, map results to exceptions
│   └── shared/
│       ├── warehouse_door_exceptions.ts                  # MODIFIED — E_WAREHOUSE_DOOR_NOT_FOUND (404), E_WAREHOUSE_DOOR_ARCHIVED (409)
│       ├── warehouse_door_validator.ts                   # MODIFIED — updateWarehouseDoorValidator (partial body, coordinates required together)
│       ├── warehouse_door_policy.ts                      # MODIFIED — add `update` (admin roles, same as `create`)
│       ├── warehouse_door_transformer.ts                 # MODIFIED — expose `updatedAt`
│       └── repositories/
│           ├── warehouse_door_repository.ts              # MODIFIED — add `updateAvailable` + command/result types
│           └── lucid_warehouse_door_repository.ts        # MODIFIED — unlocked pre-read, locked warehouse read, guarded update, unique-violation mapping
├── app/controllers/warehouse_doors_controller.ts         # MODIFIED — add `update`, 200
├── start/routes.ts                                       # MODIFIED — PATCH /api/v1/warehouse-doors/:id
└── tests/
    ├── unit/warehouse_doors/update/update.spec.ts        # NEW
    ├── unit/warehouse_doors/warehouse_door_policy.spec.ts # MODIFIED — the `update` ability
    └── integration/warehouse_doors/update/update.spec.ts # NEW

apps/web/src/
├── components/resource-map/                              # Unchanged — draggable marker and coordinate fields reused as they stand
├── components/lifecycle/resource-row-actions.tsx          # MODIFIED — `renderDialog` made optional, for a resource whose lifecycle slices are not delivered yet
├── features/warehouse-doors/
│   ├── use-warehouse-door-edit-session.ts                # NEW — snapshot origin name/position and editability once; discard with the selection
│   ├── mutations/use-warehouse-door-mutations.ts         # MODIFIED — update mutation + warehouse-list invalidation
│   ├── ui/edit-warehouse-door-panel.tsx                  # NEW — sheet: name, synced coordinates, restore-position, save
│   ├── ui/warehouse-door-row-actions.tsx                 # NEW — per-row menu; `Edit` only for now, the seam #215/#216 fill
│   ├── ui/warehouse-doors-panel.tsx                      # MODIFIED — each row hosts its action menu, as `truck-list.tsx` does
│   └── __tests__/update/{entry,session,reposition,validation,permissions}.test.tsx  # NEW
├── features/warehouses/
│   ├── map/warehouse-map.tsx                             # MODIFIED — `label` on the door placement layer; the edited door excluded from the marker layer; selection suppressed while a session is open
│   ├── ui/warehouses-page.tsx                            # MODIFIED — door update mode, exclusivity, param hygiene, success handling
│   └── __tests__/support/mock-warehouse-map.tsx          # MODIFIED — expose the door-edit seam
└── routes/_authenticated/warehouses.tsx                  # MODIFIED — `edit` accepts `'door'`
```

**Structure Decision**: Extend the existing API and web workspaces along their binding vertical-slice
conventions. On the API, the update is a `warehouse_doors/update` workflow while authorization,
validation, persistence, and the DTO stay under `warehouse_doors/shared`, where #215 and #216 will
reach for them next. On the web, everything door-specific — the session hook, the panel, the row
action, the mutation — lives in `features/warehouse-doors/`, while the map layer and the mode's URL
wiring stay in `features/warehouses/`, which owns the map and the search params. Nothing is added to
`components/resource-map/`: this slice is the third caller of primitives built to be reused. The one
shared component it does touch, `ResourceRowActions`, is edited rather than duplicated — a fourth
caller with no lifecycle actions yet is exactly the case its `renderDialog` prop had not met.

**Boundary note on the cross-feature reach**: `features/warehouse-doors/` already imports
`features/warehouses/types` and `features/warehouses/geometry`, and its mutation already invalidates
`warehouseQueries.list()` because the warehouse collection is what embeds the doors. That direction
is the existing one and is not widened — `features/warehouses/` gains no import from
`features/warehouse-doors/` beyond the `WarehouseDoorsPanel`, `WarehouseDoorMarker`, and now
`EditWarehouseDoorPanel` it renders, and the session hook it consumes.

## Complexity Tracking

*No Constitution Check violations were identified. This section intentionally left without entries.*

Three decisions are worth recording without being violations:

- **A third near-identical edit-session hook.** `useCheckpointEditSession`, `useWarehouseEditSession`,
  and now `useWarehouseDoorEditSession` share three rules and differ in what they snapshot. Research
  R8 rejects unifying them *inside this slice* — it would rewrite two delivered features — and marks
  the generalization as a candidate once a fourth caller appears. The duplication is bounded to
  roughly forty lines and is covered by each feature's own tests.
- **A deliberate divergence from the checkpoint edit gesture.** Checkpoints arm click-to-place while
  editing; this slice does not (research R7), because a door is dragged among sibling door markers
  where a click reads as a selection. It is one boolean, recorded rather than hidden, and reversible
  without touching a contract.
- **Containment evaluated twice per request.** Once in the use case against the footprint the
  repository read under lock, once in the browser for pre-submit feedback. This is the duplication
  #208's research justified and #213 inherited; this slice adds no third copy and no new module.
- **A container chosen for slices not yet delivered.** The door rows adopt `ResourceRowActions`
  because #215 and #216 will need `Archive` and `Reactivate` beside `Edit` (research R10). The
  anticipation is deliberate and bounded to the *container*: this slice ships an empty `actions`
  array and no lifecycle dialog, so it delivers none of their behavior (FR-027). The alternative —
  a bare button now, a menu in two slices — would move a gesture administrators had already
  learned.
