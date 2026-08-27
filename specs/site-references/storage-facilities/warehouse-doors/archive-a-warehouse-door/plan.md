# Implementation Plan: Archive a Warehouse Door

**Branch**: `feat/215-archive-warehouse-door` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/storage-facilities/warehouse-doors/archive-a-warehouse-door/spec.md`

## Summary

Let an authorized administrator retire an unloading door from operational use, one at a time or
several at once, without touching anything that references it. From the Doors panel on `/warehouses`,
an `Archive` entry in a door row's action menu opens the shared lifecycle confirmation; a checkbox on
every available door row and its map marker — offered as soon as the warehouse opens, with no mode to
enter — builds a selection the shared bulk confirmation archives in one action, reporting one reason
per door it could not take.

Most of the slice is assembly. What is genuinely new is the **first warehouse-door lifecycle write**:
two endpoints, one policy ability, two use cases, two repository methods, a blocker helper, and two
exceptions.

1. **The schema is complete.** `warehouse_doors` already carries `status`, `archived_at`,
   `archived_by_user_id`, `archive_comment`, and `archived_with_warehouse` — the last added by #210
   for the cascade. **No migration.**
2. **The rules already have one implementation each.** Door usage is the shared
   `SiteReferenceUsageChecker` rule (`#240` FR-006) reused as-is; the comment limit and the
   id-array validation are `lifecycleComment()` and `lifecycleIds()`; the blocker shape is the one
   docks and warehouses already return.
3. **The interface primitives already exist.** `ResourceRowActions` was adopted by #214 with an empty
   `actions` array *specifically* so this slice could fill it; `ResourceLifecycleDialog` and
   `BulkResourceLifecycleDialog` are the same components every other site reference uses, and both
   fit doors with **no override** — no cascade clause to append, and the default in-use blocker label
   is already accurate for a door (research R9).

Three decisions carry the design.

- **Eligibility is decided inside the write transaction, warehouse locked first** (research R2, R3).
  A pre-flight check would leave a window in which #210's cascade commits between the check and the
  write, archiving a door twice and overwriting the archive time, actor, comment, and provenance that
  a later warehouse reactivation depends on. Locking warehouses (ordered by id) then doors (ordered
  by id) is the order every existing writer on these two tables already takes.
- **`archived_with_warehouse = false` is written, not defaulted** (research R4). The column describes
  the archival that is current, and writing it is what keeps a door retired on its own from being
  resurrected by #211.
- **Door selection is a fourth, warehouse-scoped map mode**, entered from the Doors panel header
  rather than the map's control cluster (research R7). The cluster is page-scoped and its
  `Select warehouses` neighbour *clears* `warehouseId`, closing the very panel a door selection acts
  on; the panel header already owns the door-scoped `Create door`.

## Technical Context

**Language/Version**: TypeScript 5.7 (apps/api, AdonisJS on Node.js) and TypeScript 5.9 (apps/web, React 19 via TanStack Start)

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, VineJS, Bouncer 4, Tuyau 1.2; React 19.1, TanStack Router/Query, `@tuyau/react-query`, Zod, `sonner`, MapLibre GL through the shared `Map` components, Tailwind CSS 4 — all pre-existing, no new runtime dependency

**Storage**: PostgreSQL via the existing `warehouse_doors` table (#212, extended by #210) — no schema change, no migration

**Testing**: Japa unit and integration for apps/api; Vitest + Testing Library + MSW for apps/web; manual affected browser flow, as no Playwright suite is configured

**Target Platform**: Linux-hosted AdonisJS JSON API and modern desktop/tablet browsers

**Performance Goals**: A selection of 50 doors is archived within 2 seconds, and 95% of submissions return a confirmed result or an explicit refusal within 2 seconds (SC-011). One locked warehouse read, one locked door read, one usage query, and one guarded update per transaction — all set-based, independent of selection size

**Constraints**: Archival stays inside the selected warehouse's existing door consultation context — no standalone door route, page, or detail view, which #212 FR-004a forbids and #215 does not lift; eligibility and usage are re-decided under lock at submission time (FR-009); the door's name, position, containing warehouse, and creation time are unreachable from this payload (FR-014); the containing warehouse is never written (FR-015); nothing referencing the door is written (FR-016); the embedded door shape in `warehouses.index` is unchanged, so every #212 consultation test passes unchanged in substance

**Scale/Scope**: Two new endpoints, one new policy ability, two new use cases, two new repository methods, one new blocker helper, two new exceptions, four additive transformer members, one new web lifecycle module, one widened search-param value, checkboxes in one panel, and a `checked` contract on one marker. No migration, no new persisted entity, no new shared component

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

| Principle | Design evidence | Result |
|---|---|---|
| I. Selected feature intent is versioned | Issue #215 is selected off the Warehouse Doors roadmap (#44) on `feat/215-archive-warehouse-door`, with its blocker #212 delivered and its siblings #213–#214 merged; `spec.md` is the behavioral contract, created only on selection. | PASS |
| II. One independently deliverable feature per spec | Scope is exactly "archive a warehouse door" end-to-end: row action and selection → two endpoints → the door readable under Archived with its context. Reactivation stays in #216; nothing here anticipates it beyond the blocker helper's existing `expectedStatus` parameter. | PASS |
| III. Vanilla Spec Kit gates protect product intent | The one material ambiguity — single versus single-and-multiple — was asked before the spec was written and is recorded in its Clarifications. Every other default is stated in Assumptions and re-derived here from `CONTEXT.md`, `#240`, and #210. No repository-owned delivery state machine. | PASS |
| IV. Test-first observable behavior | Every requirement has an observable seam: policy and use-case units, a blocker-helper unit, HTTP integration per status code and per blocker reason, a cross-slice test that #211 does not restore a door archived on its own, and five web test files. RED→GREEN applies throughout — no warehouse-door lifecycle write exists yet. | PASS |
| V. Deep boundaries and explicit contracts | The policy authorizes; the validators own transport shape, the id array, and the comment limit; the use cases own comment normalization and the mapping from repository outcome to exception; the repository owns lock order, the guarded write, and the transactional usage read; the transformer owns the DTO; the page owns URL state and the map owns rendering. The one boundary this slice bends — the usage query living inside the repository transaction — is recorded in Complexity Tracking with the precedent it follows. | PASS |
| VI. Durable knowledge has a home | `CONTEXT.md` already defines **Site Reference** archival ("no longer available for new operations but still visible in administration, historical discharges, and reports") and **Rotation Door Correction**'s historical eligibility, which is what FR-020 preserves. No new vocabulary, no new ADR. The door cascade wording #210 amended stays accurate: this slice adds the independent path it already anticipated. | PASS |
| VII. Verification is part of delivery | `quickstart.md` requires checks, typecheck, API and web tests, the full fast suite, the affected browser flow, and a fresh review. | PASS |
| VIII. One workflow owner | Plan and artifacts stay inside Spec Kit; no new orchestration or delivery state. | PASS |

### Post-design re-check

Re-evaluated after Phase 1 (`data-model.md`, `contracts/`, `quickstart.md`):

- **II** — Confirmed PASS. Every change to shared code is *additive*: four members on
  `WarehouseDoorTransformer` (research R5), no new search param or value (research R7), and one
  optional `checked` contract on `WarehouseDoorMarker` mirroring the one `CheckpointMarker` already
  has. No dock, weighing-area, checkpoint, truck, customer, transport-company, or warehouse behavior
  changes. `ResourceRowActions`, `ResourceLifecycleDialog`, and `BulkResourceLifecycleDialog` are
  consumed **unmodified** — the second and third with no `describeEffect` and no overridden blocker
  label, which is the evidence that the shared lifecycle copy fits a door as written.
- **IV** — Confirmed PASS. `quickstart.md` scenarios 1–27 are concrete RED targets that
  `/speckit-tasks` can order, split across API units, API integration, one cross-slice regression,
  and five web test files.
- **V** — Confirmed PASS after re-check. The use cases are not empty: they normalize the comment and
  own the outcome-to-exception mapping, the seam `UpdateWarehouseDoorUseCase` already established.
  The repository owns no business branch it invented — the usage *definition* stays in the shared
  checker, and the lifecycle guards are the same `WHERE status = 'AVAILABLE'` predicates the
  delivered lifecycle writes use.
- **VI** — Confirmed PASS. The two new exceptions name conditions no existing code names, and mirror
  `DockAlreadyArchivedException` / `DockInUseException` one-for-one. The containing warehouse's own
  failures keep reusing `E_WAREHOUSE_NOT_FOUND` and `E_WAREHOUSE_ARCHIVED` rather than minting
  door-flavoured duplicates, as #213 and #214 established (research R6).
- No other gate is affected, and no new violation was found.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/storage-facilities/warehouse-doors/archive-a-warehouse-door/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── warehouse-doors-archive.openapi.yaml
│   └── warehouse-door-archive-ui-state.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/api/
├── app/warehouse_doors/
│   ├── archive/
│   │   ├── archive_warehouse_door_use_case.ts             # NEW — trim the comment, map each repository outcome to its exception
│   │   └── archive_warehouse_doors_use_case.ts            # NEW — trim the comment, delegate the bulk write
│   └── shared/
│       ├── warehouse_door_exceptions.ts                   # MODIFIED — E_WAREHOUSE_DOOR_ALREADY_ARCHIVED (409), E_WAREHOUSE_DOOR_IN_USE (409)
│       ├── warehouse_door_lifecycle_blockers.ts           # NEW — findBulkBlockers, mirroring the dock and warehouse helpers
│       ├── warehouse_door_validator.ts                    # MODIFIED — archiveWarehouseDoorValidator, archiveWarehouseDoorsValidator
│       ├── warehouse_door_policy.ts                       # MODIFIED — add `archive` (admin roles, as `create` and `update`)
│       ├── warehouse_door_transformer.ts                  # MODIFIED — expose the archive context (research R5)
│       └── repositories/
│           ├── warehouse_door_repository.ts               # MODIFIED — archiveAvailable + archiveAvailableMany, commands and results
│           └── lucid_warehouse_door_repository.ts         # MODIFIED — unlocked pre-read, warehouse-then-door locks, usage query in-transaction, guarded writes
├── app/controllers/warehouse_doors_controller.ts          # MODIFIED — add `archive` and `archiveMany`, both 200
├── start/routes.ts                                        # MODIFIED — POST /warehouse-doors/archive before POST /warehouse-doors/:id/archive
└── tests/
    ├── unit/warehouse_doors/warehouse_door_policy.spec.ts # MODIFIED — the `archive` ability
    ├── unit/warehouse_doors/lifecycle/{archive,bulk_archive}.spec.ts        # NEW
    ├── integration/warehouse_doors/lifecycle/{archive,bulk_archive}.spec.ts # NEW
    └── integration/warehouses/lifecycle/archive.spec.ts   # MODIFIED — a door archived on its own survives its warehouse's archival and is not restored by #211

apps/web/src/
├── components/lifecycle/                                  # Unchanged — dialogs, bulk bar, row menu, and copy consumed as they stand
├── features/warehouse-doors/
│   ├── warehouse-door-lifecycle.tsx                       # NEW — lifecycle config, actions per status, bulk outcome adapter
│   ├── mutations/use-warehouse-door-mutations.ts          # MODIFIED — archive + archiveMany, invalidating the warehouse collection
│   ├── ui/warehouse-door-row-actions.tsx                  # MODIFIED — `Archive` beside `Edit`, with its confirmation
│   ├── ui/warehouse-doors-panel.tsx                       # MODIFIED — `Select all`, per-row checkboxes, and the selection row (count, action, clear)
│   ├── map/warehouse-door-marker.tsx                      # MODIFIED — optional `checked` contract, as CheckpointMarker has
│   └── __tests__/archive/{entry,confirmation,selection,bulk,permissions}.test.tsx  # NEW
├── features/warehouses/
│   ├── map/warehouse-map.tsx                              # MODIFIED — pass door check state through to the markers; suppress polygon selection once a door is checked
│   ├── ui/warehouses-page.tsx                             # MODIFIED — checked set, its context and pruning effects, exclusivity, bulk dialog wiring
│   └── __tests__/support/{handlers,mock-warehouse-map}.tsx # MODIFIED — the two new endpoints and the door checkbox seam
└── routes/_authenticated/warehouses.tsx                   # Unchanged — no new search param or value
```

**Structure Decision**: Extend the existing API and web workspaces along their binding vertical-slice
conventions. On the API, archival is a `warehouse_doors/archive` workflow while authorization,
validation, persistence, the blocker helper, and the DTO stay under `warehouse_doors/shared`, where
#216 will reach for them next — the blocker helper in particular is written with the
`expectedStatus` parameter its two delivered siblings carry, plus the containing-warehouse guard both
directions need, so reactivation reuses it rather than writing a third copy. On the web, everything
door-specific — the lifecycle config, the row action, the panel, the marker, the mutations — lives in
`features/warehouse-doors/`, while the checked set and the bulk confirmation stay in
`features/warehouses/`, which owns the page the selection is scoped by.

**Boundary note on the cross-feature reach**: `features/warehouse-doors/` already imports
`features/warehouses/types` and its mutations already invalidate `warehouseQueries.list()`, because
the warehouse collection is what embeds the doors. That direction is the existing one and is not
widened — `features/warehouses/` gains no import from `features/warehouse-doors/` beyond the panel,
the marker, and now the lifecycle module's outcome adapter it renders.

## Complexity Tracking

*No Constitution Check violations were identified. This section intentionally left without entries.*

Four decisions are worth recording without being violations:

- **The usage query runs inside the repository transaction.** Strictly read, "the repository owns
  persistence mechanics" would put the in-use decision in the use case, which is where
  `ArchiveDockUseCase` puts it. Research R2 rejects that here: a dock has no cascading parent, so its
  lost race merely fails to archive, whereas a door's lost race lets #210's cascade and this write
  both archive the same door and overwrite its recorded context. The *definition* of usage is not
  restated — the repository calls the same shared `SiteReferenceUsageChecker` — and
  `LucidWarehouseRepository` already made this exact trade for the cascade side.
- **A third copy of `findBulkBlockers`.** Docks and warehouses each have one, and doors now get a
  third, differing only in its record type and its reason set. Unifying them would touch two
  delivered features to save roughly forty lines; the generalization is a candidate once #216 and the
  remaining reactivation slices make the fourth and fifth callers concrete, and each copy is covered
  by its own unit test.
- **A selection without a mode.** The page carries warehouse drawing, door placement, door
  correction, and warehouse selection — each a mode held by `create`, `edit`, or `selecting`, one
  value apiece, so they stay mutually exclusive by *shape*. Door checking is deliberately not a
  fifth: it is offered whenever it is meaningful and holds no param at all (research R7). The cost is
  that its exclusivity cannot be expressed by shape, so `warehouses-page.tsx` carries two effects
  instead — one dropping the checked set when its context goes, one pruning ids the Available list no
  longer holds. Both are written as `setDoorSelection` updaters over the existing state, mirroring
  the warehouse selection's own `checkableIds` pruning effect.
- **Keyboard shortcuts are left alone.** `useSelectAllShortcut` and `useClearSelectionShortcut` stay
  bound to warehouses; doors get the panel's `Select all` and `Clear selection` instead, the trucks
  and customers model (research R8). Rebinding follows from a mode, and there is none to rebind on.
