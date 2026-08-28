# Implementation Plan: Reactivate a Warehouse Door

**Branch**: `feat/216-reactivate-warehouse-door` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/storage-facilities/warehouse-doors/reactivate-a-warehouse-door/spec.md`

## Summary

Let an authorized administrator put one independently archived door back into service: from the
Doors panel on `/warehouses`, a `Reactivate` entry in an archived door row's action menu opens the
shared lifecycle confirmation, and confirming it flips the door to available in one guarded write
that records the actor, the time, and an optional comment while preserving the door's identity,
name, position, containing warehouse, creation time, and archive history.

The slice is small because #214 built its container on purpose. What is genuinely new:

1. **The first warehouse-door lifecycle transition.** `POST /api/v1/warehouse-doors/:id/reactivate`
   with its policy ability, comment validator, use case, transactional repository write, and two new
   exceptions.
2. **A door-specific eligibility rule no sibling has.** A door is reactivatable only when it is
   archived, was archived *on its own*, and its containing warehouse is available — three conditions
   that are not independent, and whose interaction decides how the refusal is phrased (research R4).
3. **The row menu's first real entry.** `WarehouseDoorRowActions` ships with `actions={[]}` today;
   this slice fills it, with the shared `ResourceRowActions` and `ResourceLifecycleDialog` consumed
   unchanged.

Everything else is already there: the columns since #210, `lifecycleComment()` since the first site
reference, the confirmation dialog with its comment field and its keep-open-on-refusal behavior, and
the door DTO's `reactivatedAt` / `reactivationComment` members, already embedded by
`WarehouseTransformer`. **One migration, and it only drops a column** — `archived_with_warehouse`,
which the spec's clarification leaves with nothing to record (research R5, R6). **No new shared
component. No new geometry.**

Two rules carry the design. The **lock order stays warehouse-then-door**, matching #213's create,
#214's update, and #210's cascade, with the door's `warehouse_id` learned by an unlocked pre-read
that cannot go stale because containment is permanent. And **the guarded `UPDATE` is the sole
arbiter of eligibility** — `WHERE status = 'ARCHIVED'`, under the warehouse lock that already
confines this path to a door archived on its own — with the zero-row fallback re-reading both rows to
phrase which of the three refusals actually applies (research R4, R5).

## Technical Context

**Language/Version**: TypeScript 5.7 (apps/api, AdonisJS on Node.js) and TypeScript 5.9 (apps/web, React 19 via TanStack Start)

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, VineJS, Bouncer 4, Tuyau 1.2; React 19.1, TanStack Router/Query, `@tuyau/react-query`, `sonner`, MapLibre GL through the shared `Map` components, Tailwind CSS 4 — all pre-existing, no new runtime dependency

**Storage**: PostgreSQL via the existing `warehouse_doors` table; every column this slice writes was created by #210. One migration, dropping `archived_with_warehouse` (research R5, R6)

**Testing**: Japa unit and integration for apps/api; Vitest + Testing Library + MSW for apps/web; manual affected browser flow, as no Playwright suite is configured

**Target Platform**: Linux-hosted AdonisJS JSON API and modern desktop/tablet browsers

**Performance Goals**: The available status is visible in consultation within 2 seconds of a successful reactivation (SC-001). One locked warehouse read plus one guarded row update in a single transaction, with no footprint preload and no usage scan (research R6); the fallback re-reads run only on a refusal

**Constraints**: The reactivation stays inside the selected warehouse's existing door consultation context — no standalone door route, page, or detail view, which #212 FR-004a forbids and #216 does not lift (FR-021); eligibility is decided under lock inside the write transaction, never off the pre-read (FR-006, research R4); the client menu gate is a courtesy, the API stays authoritative (FR-024); a door must never end available under an archived warehouse (FR-008); the door objects embedded by `WarehouseTransformer` are unchanged, so every #212 consultation test passes unchanged in substance

**Scale/Scope**: One new endpoint, one new policy ability, one new validator, one new use case, one new repository method, two new exceptions, one new web lifecycle module, one row-actions wrapper widened, one mutation added, one panel line added. No migration, no new persisted entity, no bulk path, no new shared component

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

| Principle | Design evidence | Result |
|---|---|---|
| I. Selected feature intent is versioned | Issue #216 is selected off the Warehouse Doors roadmap (#44) on `feat/216-reactivate-warehouse-door`; `spec.md` is the behavioral contract, created only on selection. Its blocker #212 is delivered; #215 is recorded as an open dependency below rather than absorbed. | PASS |
| II. One independently deliverable feature per spec | Scope is exactly "reactivate one warehouse door" end-to-end: row action → new endpoint → available door visible. Archival stays in #215, the warehouse's own lifecycle in #210/#211, and bulk is refused by the spec rather than deferred (FR-031). | PASS |
| III. Vanilla Spec Kit gates protect product intent | No clarification markers remain and the readiness checklist passes. The two product defaults — single-door scope, and a confirmation that names the door alone — are stated in the spec's Assumptions and were surfaced to the product owner before planning, not silently invented. No repository-owned delivery state machine is introduced. | PASS |
| IV. Test-first observable behavior | Every requirement has an observable seam: policy and use-case units, HTTP integration for each of the five outcomes, and web tests for the menu gate, the confirmation, the success refresh, and the refusal handling. RED→GREEN applies throughout — no warehouse-door lifecycle behavior exists yet. | PASS |
| V. Deep boundaries and explicit contracts | The policy authorizes; the validator owns the comment's transport shape and length; the use case owns trimming and the result→exception mapping; the repository owns the lock order, the guarded write, and the fallback disambiguation; the transformer owns the DTO; the panel owns rendering. No cross-layer shortcut. | PASS |
| VI. Durable knowledge has a home | `CONTEXT.md`'s **Warehouse** entry already states that a door archived on its own stays archived through a warehouse reactivation. The reverse direction — that such a door is returned to service on its own — belongs in the **Warehouse Door** entry and is the one documentation change this slice owes (spec Assumptions). No new ADR. | PASS |
| VII. Verification is part of delivery | `quickstart.md` requires checks, typecheck, API and web tests, the full fast suite, the affected browser flow, and a fresh review. | PASS |
| VIII. One workflow owner | Plan and artifacts stay inside Spec Kit; no new orchestration or delivery state. | PASS |

### Open dependency, declared rather than resolved

**#215 Archive a Warehouse Door is not delivered**, and it is the only production path that produces
an independently archived door — the exact input this slice's success path consumes. This is
recorded, not worked around:

- Every **refusal** path is verifiable today. Warehouse archival (#210) produces archived doors
  under an archived warehouse, which exercises `WAREHOUSE_ARCHIVED`, `ALREADY_AVAILABLE`, and
  `DOOR_NOT_FOUND`.
- The **success** path is verifiable in tests today: `warehouse_door_factory.ts` ships an `archived`
  state, and placing that door under an available warehouse is exactly "archived on its own".
- What is *not* reachable until #215 ships is the end-to-end browser flow starting from an
  administrator archiving a door. `quickstart.md` marks that scenario accordingly.

This does not weaken Principle II: the slice is independently implementable, testable, reviewable,
and mergeable. It means the feature is fully exercisable in production only once its sibling lands,
which is a sequencing fact for the roadmap, not a scope compromise.

### Post-design re-check

Re-evaluated after Phase 1 (`data-model.md`, `contracts/`, `quickstart.md`):

- **II** — Confirmed PASS. Changes to shared code are *additive only*: `WarehouseDoorPolicy` gains
  `reactivate`, `warehouse_door_validator.ts` gains one validator,
  `warehouse_door_exceptions.ts` gains two, `WarehouseDoorRepository` gains one abstract method, and
  `useWarehouseDoorMutations` gains one mutation. `ResourceRowActions`,
  `ResourceLifecycleDialog`, and `lifecycle-copy.ts` are consumed **unchanged** (research R8) — no
  dock, weighing-area, checkpoint, truck, customer, or warehouse behavior changes.
- **IV** — Confirmed PASS. `quickstart.md` scenarios 1–22 are concrete RED targets that
  `/speckit-tasks` can order, split across API units, API integration, and three web test files.
- **V** — Confirmed PASS after re-check. The one boundary question this slice raised — *where* the
  three-way refusal is decided — is resolved in the **repository**, which owns the race it observes
  and returns a discriminated result; the use case maps result kinds to exceptions and owns no
  branch the database did not hand it. That is the same division `create` and `updateAvailable`
  already draw.
- **VI** — Confirmed PASS. The two new exceptions name conditions no existing code names, and
  `E_WAREHOUSE_NOT_FOUND` stays reused for the warehouse's own absence. The archived warehouse is the
  one deliberate departure from that rule (FR-007, research R3): its remedy is the door's — the door
  returns with the building — which `E_WAREHOUSE_ARCHIVED` would misstate.
- No other gate is affected, and no new violation was found.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/storage-facilities/warehouse-doors/reactivate-a-warehouse-door/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── warehouse-doors-reactivate.openapi.yaml
│   └── warehouse-door-reactivate-ui-state.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/api/
├── app/warehouse_doors/
│   ├── reactivate/reactivate_warehouse_door_use_case.ts   # NEW — trim the comment, map result kinds to exceptions
│   └── shared/
│       ├── warehouse_door_exceptions.ts                   # MODIFIED — E_WAREHOUSE_DOOR_ALREADY_AVAILABLE (409), E_WAREHOUSE_DOOR_ARCHIVED_WITH_WAREHOUSE (409)
│       ├── warehouse_door_validator.ts                    # MODIFIED — reactivateWarehouseDoorValidator ({ comment: lifecycleComment() })
│       ├── warehouse_door_policy.ts                       # MODIFIED — add `reactivate` (admin roles, same as `create`/`update`)
│       └── repositories/
│           ├── warehouse_door_repository.ts               # MODIFIED — add `reactivateArchived` + command/result types
│           └── lucid_warehouse_door_repository.ts         # MODIFIED — unlocked pre-read, locked warehouse read, guarded write, three-way fallback
├── app/controllers/warehouse_doors_controller.ts          # MODIFIED — add `reactivate`, 200
├── app/models/warehouse_door.ts                           # MODIFIED — drop `archivedWithWarehouse` and its boolean normalizer
├── app/warehouses/shared/
│   ├── warehouse_transformer.ts                           # MODIFIED — embedded doors lose `archivedWithWarehouse`
│   └── repositories/lucid_warehouse_repository.ts         # MODIFIED — the cascade and its mirror take every door of the warehouse
├── database/
│   ├── migrations/<ts>_drop_archived_with_warehouse_from_warehouse_doors.ts   # NEW (research R6)
│   └── factories/warehouse_door_factory.ts                # MODIFIED — drop the `archivedWithWarehouse` state
├── start/routes.ts                                        # MODIFIED — POST /api/v1/warehouse-doors/:id/reactivate
└── tests/
    ├── unit/warehouse_doors/reactivate/reactivate.spec.ts     # NEW
    ├── unit/warehouse_doors/warehouse_door_policy.spec.ts     # MODIFIED — the `reactivate` ability
    └── integration/warehouse_doors/reactivate/reactivate.spec.ts  # NEW

apps/web/src/
├── components/lifecycle/                                  # Unchanged — dialog, row menu, and copy consumed as they stand
├── features/warehouse-doors/
│   ├── warehouse-door-lifecycle.tsx                       # NEW — actions-by-status, lifecycle config, dialog wrapper (mirrors truck-lifecycle.tsx)
│   ├── mutations/use-warehouse-door-mutations.ts          # MODIFIED — reactivate mutation + warehouse-list invalidation
│   ├── ui/warehouse-door-row-actions.tsx                  # MODIFIED — `actions` filled, `renderDialog` supplied
│   ├── ui/warehouse-doors-panel.tsx                       # MODIFIED — reactivation line on available rows (research R10)
│   └── __tests__/reactivate/{entry,reactivate,refusals}.test.tsx  # NEW
└── features/warehouses/ui/warehouses-page.tsx             # UNCHANGED — the panel already receives everything the row menu needs
```

**Structure Decision**: Extend the existing API and web workspaces along their binding vertical-slice
conventions. On the API, the transition is a `warehouse_doors/reactivate` workflow while
authorization, validation, persistence, and the DTO stay under `warehouse_doors/shared`, where #215
will reach for them next — in particular the two new exceptions and the repository's lock-order
comment are written to be read by the archival slice, not just by this one. On the web, everything
door-specific lives in `features/warehouse-doors/`; `features/warehouses/` is untouched, because the
Doors panel already receives the warehouse status and the door objects the row menu needs, and the
map needs no new mode — a lifecycle confirmation is a dialog, not a map interaction.

**Boundary note**: this slice adds no new cross-feature import. `features/warehouse-doors/` already
imports `features/warehouses/types` and already invalidates `warehouseQueries.list()`, because the
warehouse collection is what embeds the doors. That direction is the existing one and is not
widened.

## Complexity Tracking

*No Constitution Check violations were identified. This section intentionally left without entries.*

Three decisions are worth recording without being violations:

- **A fallback branch that re-reads two rows.** The refusal path costs up to two extra unlocked
  reads. They run only when the guarded lock or the guarded write matched nothing — never on the
  success path — and they are what let a door reactivated by a concurrent warehouse restore answer
  `ALREADY_AVAILABLE` rather than a warehouse problem the administrator no longer has (research R4).
  The alternative, deciding eligibility off the pre-read before the transaction, is faster and wrong.
- **A migration that drops a column two delivered slices wrote.** `archived_with_warehouse` was
  #210's answer to "which doors does #211 restore?", and the clarification answers it differently:
  all of them. Keeping the column as a read-only provenance display was considered and rejected — it
  would be redundant with the warehouse's own status and free to drift from it (research R5).
- **A row line that renders a lifecycle context without an actor.** The panel shows
  `Reactivated · date · comment` but not who did it, because the embedded door DTO exposes only
  `reactivatedByUserId` (research R10). Widening that read contract would touch three consultation
  surfaces for a value no current design shows; the actor is recorded and asserted server-side
  instead.
