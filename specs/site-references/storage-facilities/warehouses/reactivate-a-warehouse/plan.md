# Implementation Plan: Reactivate a Warehouse

**Branch**: `feat/211-reactivate-warehouse` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/storage-facilities/warehouses/reactivate-a-warehouse/spec.md`

## Summary

Let an authorized administrator reactivate one archived warehouse or a selection of them in one
action. A reactivation **restores exactly the doors that were archived with the warehouse** — the
ones carrying `archived_with_warehouse = true` — in the same transaction, with the same
reactivation time, actor, and comment, and clears that marker on each restored door. Doors archived
on their own stay archived and untouched. A warehouse is ineligible only when it does not exist
(`NOT_FOUND`) or is already available (`ALREADY_AVAILABLE`); there is no usage blocker on this path.

**Archive a Warehouse (`#210`) built most of the scaffolding for this slice on purpose.** Research
found three mechanisms already in place, each carrying a comment naming `#211` as its consumer:

- `warehouse_doors.archived_with_warehouse` — the column that makes the restore set knowable
  (research **D1**).
- `findBulkBlockers(..., expectedStatus, usedIds = new Set())` — the `'ARCHIVED'` branch emitting
  `ALREADY_AVAILABLE` is already written and currently unreachable (research **D6**).
- `BulkResourceLifecycleActions` with `intent: 'ARCHIVE' | 'REACTIVATE'` — the shared bulk bar
  already derives every label and tense from the intent (research **D9**).

So the work concentrates on **four** things:

1. **The restore transaction** — the one genuinely new mechanism. Two conditional writes under one
   transaction, warehouses locked before doors so an archive/reactivate race queues rather than
   deadlocks (research **D3**), with an affected-row guard making the pair all-or-nothing
   (research **D4**).

2. **Clearing the cascade marker on every restored door** (spec FR-009). Without it the marker
   decays across a second archive/reactivate cycle and silently resurrects a door that was retired
   on its own (research **D2**). This is the subtlest correctness requirement in the slice and
   SC-012 exists to test it.

3. **A reactivation path through every API layer** — policy ability, validators, two use cases, two
   repository methods, two controller actions, two routes. All modelled on the delivered archival
   path in the same slice directory, and on `app/weighing_areas/reactivate/`.

4. **Opening both UI gates that currently hard-stop on `AVAILABLE`.** `WarehouseLifecycleActions`
   returns `null` for an archived warehouse and `WarehouseDetails` renders its footer only for an
   available one; the bulk bar hard-codes `intent="ARCHIVE"` and `checkableIds` admits only
   available warehouses (research **D8**, **D9**).

**No database migration is required** (research **D13**): every column this slice writes already
exists, `archived_with_warehouse` included.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 25

**Primary Dependencies**: API — AdonisJS 7, Lucid ORM 22, VineJS, Bouncer, Tuyau. Web — React 19,
TanStack Start/Router/Query, shadcn/ui, Tailwind 4, MapLibre (`maplibre-gl`) polygon layers.

**Storage**: PostgreSQL 17. `warehouses` and `warehouse_doors` already carry `status`,
`archived_at`, `archived_by_user_id`, `archive_comment`, `reactivated_at`, `reactivated_by_user_id`,
and `reactivation_comment`; `warehouse_doors` also carries `archived_with_warehouse` from `#210`.
No migration, and `apps/api/database/schema.ts` needs no regeneration.

**Testing**: Japa (API unit + integration), Vitest + Testing Library + MSW (web), Playwright for the
browser flow.

**Target Platform**: Web application (single operating site, session-cookie auth).

**Performance Goals**: A 50-warehouse / 500-door submission resolves within 2s (SC-014). The restore
is two set-based `UPDATE`s over the whole eligible set, never one round-trip per warehouse or door.

**Constraints**: Partial success with exactly one reason per blocked warehouse; all-or-nothing
persistence spanning **two tables**; eligibility assessed at submission time under row locks taken
in the same fixed order archival uses, so concurrent submissions reactivate each warehouse and each
door exactly once.

**Scale/Scope**: Up to 200 warehouses per site (`#207` SC-002); no cap on selection size.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Selected feature intent is versioned | Issue #211 selected; `spec.md` is the canonical contract | PASS |
| II. One independently deliverable feature | One outcome (reactivate warehouses, single + multiple, incl. door restore); independent door reactivation (#216) and every other lifecycle action stay out | PASS |
| III. Vanilla Spec Kit gates | Spec reviewed before planning; zero `NEEDS CLARIFICATION` carried into Phase 0; no repository-owned state machine added | PASS |
| IV. Test-first observable behavior | Every FR maps to a Japa or Vitest case; RED → GREEN → REFACTOR per task | PASS |
| V. Deep boundaries and explicit contracts | Use case owns the decision, repository owns the two-table transaction and lock order, controller owns HTTP, adapter owns view translation | PASS |
| VI. Durable knowledge has a home | **PASS with a required action** — see below | PASS* |
| VII. Verification is part of delivery | Format, lint, typecheck, affected + fast suites, browser flow, fresh review | PASS |
| VIII. One workflow owner | No new delivery state machine; Project board owns Kanban | PASS |

**Result**: No violations to justify — Complexity Tracking omitted.

**Principle VI required action.** `CONTEXT.md:152` documents the archival cascade in full — the
cascade itself, the shared archive context, and the per-door record of *why* a door was archived —
but says nothing about the reverse direction. Shipping the restore without documenting it would
leave the canonical `Warehouse` entry describing half a lifecycle, which is a single-home failure
even though nothing in it becomes false. **Extending that entry is part of this delivery, not a
follow-up** (research **D12**). `#210` set this precedent by amending the same entry in its own
slice.

Two boundary nuances are inherited rather than introduced:

- **The restore write lives in the repository**, not the use case. The use case decides *whether* to
  reactivate; the repository owns the fact that "reactivate this warehouse" means two conditional
  writes under one transaction with a fixed lock order. That is the split `apps/api/AGENTS.md`
  prescribes ("Repositories expose domain-oriented operations and own locks, transactions, and
  conditional writes"), and it is exactly how `applyArchival` is already structured.
- **Blocker computation stays in the shared helper.** `findBulkBlockers` is called with
  `expectedStatus: 'ARCHIVED'` rather than reimplemented for this direction (research **D6**), so
  the two directions cannot drift apart in their reason vocabulary.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/storage-facilities/warehouses/reactivate-a-warehouse/
├── plan.md              # This file
├── research.md          # Phase 0 output — D1..D13 + risk register
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── warehouse-reactivate-api.md
│   └── warehouse-reactivate-ui-state.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (complete)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/
│   │   └── warehouses_controller.ts              # MODIFY — reactivate, reactivateMany
│   ├── warehouses/
│   │   ├── reactivate/                           # NEW directory
│   │   │   ├── reactivate_warehouse_use_case.ts  # NEW
│   │   │   └── reactivate_warehouses_use_case.ts # NEW
│   │   └── shared/
│   │       ├── repositories/
│   │       │   ├── warehouse_repository.ts       # MODIFY — commands, results, 2 abstracts
│   │       │   └── lucid_warehouse_repository.ts # MODIFY — reactivateArchived(+Many), applyReactivation
│   │       ├── warehouse_exceptions.ts           # MODIFY — WarehouseAlreadyAvailableException
│   │       ├── warehouse_policy.ts               # MODIFY — reactivate ability
│   │       └── warehouse_validator.ts            # MODIFY — 2 reactivate validators
│   └── models/                                   # UNCHANGED
├── database/migrations/                          # UNCHANGED (research D13)
├── start/routes.ts                               # MODIFY — 2 routes, reactivate before /:id
└── tests/
    ├── unit/warehouses/lifecycle/
    │   ├── reactivate.spec.ts                    # NEW
    │   ├── bulk_reactivate.spec.ts               # NEW
    │   ├── door_restore.spec.ts                  # NEW — the cascade-restore invariants
    │   └── comment_validation.spec.ts            # MODIFY — reactivate cases
    └── integration/warehouses/lifecycle/
        ├── reactivate.spec.ts                    # NEW
        └── bulk_reactivate.spec.ts               # NEW

apps/web/src/
├── components/resource-map/
│   └── bulk-resource-lifecycle-actions.tsx       # UNCHANGED — already intent-driven
└── features/
    ├── warehouse-doors/ui/warehouse-doors-panel.tsx  # UNCHANGED (research D11)
    └── warehouses/
        ├── mutations/use-warehouse-mutations.ts  # MODIFY — reactivate, reactivateMany
        ├── ui/
        │   ├── warehouse-details.tsx             # MODIFY — footer for both statuses
        │   ├── warehouse-lifecycle-actions.tsx   # MODIFY — two-directional
        │   └── warehouses-page.tsx               # MODIFY — intent derivation, checkableIds
        ├── warehouse-lifecycle-adapter.ts        # MODIFY — restore-count + description helpers
        └── __tests__/
            ├── reactivate.test.tsx               # NEW
            ├── bulk-reactivate.test.tsx          # NEW
            ├── feedback-reactivate.test.tsx      # NEW
            ├── selection-scope.test.tsx          # MODIFY — reactivate scope
            ├── warehouse-lifecycle-adapter.test.ts   # MODIFY
            └── support/{fixtures,handlers}.ts    # MODIFY — archived-with-doors fixture, MSW routes

CONTEXT.md                                        # MODIFY — Warehouse entry, reverse direction
```

**Structure Decision**: The existing vertical-slice layout is binding and unchanged. The API gains
one directory, `apps/api/app/warehouses/reactivate/`, sitting beside the delivered `archive/`,
`create/`, and `list/` — the same shape `apps/api/app/weighing_areas/reactivate/` already has. The
web feature gains no new directory: reactivation is a second direction on the existing
`features/warehouses/` surface, not a second surface. Nothing moves between packages, and no shared
component changes — `BulkResourceLifecycleActions` was already generalized by `#210`.

## Phase 0 — Research

Complete. See [research.md](./research.md): decisions **D1**–**D13** plus a risk register. No
`NEEDS CLARIFICATION` markers survived.

The three findings that most shape the plan:

- **D1/D2** — the restore set is `status = 'ARCHIVED' AND archived_with_warehouse = true`, and the
  marker must be cleared on restore or the next cycle is wrong.
- **D3** — lock warehouses before doors, matching archival, or concurrent archive/reactivate
  deadlocks. No usage query is needed on this path.
- **D11** — `WarehouseDoorsPanel` already handles a restored door correctly and needs no edit,
  despite spec FR-023 appearing to demand one.

## Phase 1 — Design & Contracts

Complete. Artifacts:

- [data-model.md](./data-model.md) — entities, the fields this slice writes, the restore predicate,
  and the lifecycle state machine for a warehouse and its doors.
- [contracts/warehouse-reactivate-api.md](./contracts/warehouse-reactivate-api.md) — both endpoints,
  request and response shapes, status codes, error codes, and the authorization matrix.
- [contracts/warehouse-reactivate-ui-state.md](./contracts/warehouse-reactivate-ui-state.md) —
  selection state, intent derivation, dialog states, and outcome presentation.
- [quickstart.md](./quickstart.md) — runnable validation scenarios proving the feature end to end.

### Post-design Constitution re-check

Re-evaluated against the same table after the design artifacts were written. **Still PASS**, with
the `CONTEXT.md` amendment (Principle VI) carried into implementation as a task-level obligation.

The design added no new dependency, no new package, no new shared abstraction, and no cross-layer
shortcut. The one asymmetry worth naming — the door update's affected-row count is returned rather
than asserted on, while the warehouse update's is asserted — is inherited from `applyArchival` and
justified in research **D4**: the expected door count is not knowable before the write, so an
assertion would be either vacuous or racy.

## Complexity Tracking

Not applicable — the Constitution Check records no violations.
