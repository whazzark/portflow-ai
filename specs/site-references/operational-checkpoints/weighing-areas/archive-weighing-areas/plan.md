# Implementation Plan: Archive Weighing Areas

**Branch**: `feat/205-archive-weighing-area` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/operational-checkpoints/weighing-areas/archive-weighing-areas/spec.md`

## Summary

Let an authorized administrator archive one eligible weighing area or a selection of them in one
action, with partial success and one stable reason (`NOT_FOUND`, `IN_USE`, `ALREADY_ARCHIVED`) per
blocked weighing area.

**Archive Docks (`#200`) has already delivered this exact capability for the other checkpoint kind
on the same map.** That commit (`f3f814a5`) reached this branch by fast-forwarding onto
`origin/master`, and it brings the select mode, checkable markers, the bulk action bar, the
selection shortcuts, and the whole bulk API shape. This slice is therefore mostly a
**generalization from one checkpoint kind to two**, which is also what FR-038 requires.

The work concentrates on three things:

1. **A bulk API path**, transposing `#200`'s backend: one transaction, `forUpdate()` row locks, a
   set-based update, and an affected-rows guard giving FR-031 its all-or-nothing behavior. The
   blocker helper takes the dock's `expectedStatus` signature so #206 can reuse it.
2. **Closing a validation gap on the existing single path** — `archiveWeighingAreaValidator` uses a
   bare `vine.string().nullable().optional()` comment, so today it neither trims nor caps length.
   FR-009/FR-010 require the shared `lifecycleComment()` (trim + 1,000 chars).
3. **Generalizing the delivered select mode** from `selecting=docks` to a kind-parameterized
   `selecting=docks | weighing-areas`, plus a weighing-area bulk action bar and a single-archive
   action on the details sheet. `CheckpointMarker` already handles both kinds and needs no change.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 25 (repo runs v25.7.0)

**Primary Dependencies**: API — AdonisJS 7, Lucid ORM, VineJS, Bouncer, Tuyau. Web — React 19,
TanStack Start/Router/Query, shadcn/ui, Tailwind 4, MapLibre-based checkpoint map.

**Storage**: PostgreSQL 17. `weighing_areas` already carries `status`, `archived_at`,
`archived_by_user_id`, `archive_comment`, and the reactivation columns — **no migration needed**.

**Testing**: Japa (API unit + integration), Vitest + Testing Library + MSW (web), Playwright for
browser flows.

**Target Platform**: Web application (single operating site, session-cookie auth).

**Project Type**: Web application — `apps/api` (AdonisJS) + `apps/web` (TanStack Start).

**Performance Goals**: A 100-weighing-area submission resolves within 2s (SC-010); usage assessment
stays set-based rather than one query per id (inherited from `#240` FR-012).

**Constraints**: Partial success with exactly one reason per blocked record; all-or-nothing
persistence for the eligible set; eligibility assessed at submission time under row locks so
concurrent submissions archive each weighing area exactly once.

**Scale/Scope**: Up to 500 weighing areas per site (`#202` SC-003); no cap on selection size.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Selected feature intent is versioned | Issue #205 selected; `spec.md` is the canonical contract | PASS |
| II. One independently deliverable feature | One outcome (archive weighing areas, single + multiple); reactivation (#206) stays out | PASS |
| III. Vanilla Spec Kit gates | Spec reviewed before planning; no repository-owned state machine added | PASS |
| IV. Test-first observable behavior | Every FR maps to a Japa or Vitest case; RED→GREEN→REFACTOR per task | PASS |
| V. Deep boundaries and explicit contracts | Use case owns the decision, repository owns the transaction, controller owns HTTP, adapter owns view translation | PASS |
| VI. Durable knowledge has a home | Reuses `CONTEXT.md` vocabulary and the `#240` usage rule; no canonical decision duplicated here | PASS |
| VII. Verification is part of delivery | Format, lint, typecheck, affected + fast suites, browser flow, fresh review | PASS |
| VIII. One workflow owner | No new delivery state machine; Project board owns Kanban | PASS |

**Result**: No violations — Complexity Tracking omitted.

One boundary nuance is inherited rather than introduced: for the **bulk** path the in-use check runs
inside the repository transaction (as the delivered dock and truck slices both do) rather than in
the use case, because eligibility must be assessed atomically with the row locks it guards. The
single path keeps its check in the use case. Research D1 and D3 record why this asymmetry is
inherited rather than "fixed".

## Project Structure

### Documentation (this feature)

```text
specs/site-references/operational-checkpoints/weighing-areas/archive-weighing-areas/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── weighing-area-archive-api.md
│   └── weighing-area-archive-ui-state.md
├── checklists/
│   └── requirements.md  # Written by /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/
│   │   └── weighing_areas_controller.ts        # + archiveMany
│   ├── weighing_areas/
│   │   ├── archive/
│   │   │   ├── archive_weighing_area_use_case.ts    # exists (single)
│   │   │   └── archive_weighing_areas_use_case.ts   # NEW (bulk)
│   │   └── shared/
│   │       ├── weighing_area_lifecycle_blockers.ts  # NEW
│   │       ├── weighing_area_validator.ts           # adopt lifecycleComment/lifecycleIds
│   │       ├── weighing_area_policy.ts              # archive() already present
│   │       └── repositories/
│   │           ├── weighing_area_repository.ts      # + archiveAvailableMany
│   │           └── lucid_weighing_area_repository.ts
│   ├── shared/
│   │   ├── lifecycle/bulk_lifecycle_records.ts      # reused as-is
│   │   └── validators/lifecycle_validator.ts        # reused as-is
│   └── site_references/shared/site_reference_usage_checker.ts  # WEIGHING_AREA supported
├── start/routes.ts                                  # + POST /weighing-areas/archive
└── tests/
    ├── unit/weighing_areas/lifecycle/bulk/archive.spec.ts       # NEW
    └── integration/weighing_areas/lifecycle/bulk/archive.spec.ts # NEW

apps/web/src/
├── routes/_authenticated/checkpoints.tsx            # selecting: + 'weighing-areas'
└── features/
    ├── checkpoints/
    │   ├── types.ts                                 # + plural labels & per-kind bulk copy
    │   ├── ui/checkpoints-page.tsx                  # kind-parameterize select mode
    │   ├── ui/checkpoint-map-controls.tsx           # "Select weighing areas" toggle
    │   ├── ui/bulk-archive-checkpoints-actions.tsx  # RENAMED from bulk-archive-docks-actions
    │   └── map/checkpoint-marker.tsx                # UNCHANGED (already kind-agnostic)
    ├── docks/
    │   └── dock-checkpoint-adapter.ts               # + bulk outcome adapter
    └── weighing-areas/
        ├── mutations/use-weighing-area-mutations.ts # + archive, archiveMany
        ├── types.ts                                 # + blocker/result types
        ├── weighing-area-checkpoint-adapter.ts      # + bulk outcome adapter
        ├── ui/weighing-area-details.tsx             # render lifecycle actions when AVAILABLE
        └── ui/weighing-area-lifecycle-actions.tsx   # NEW (single archive dialog)
```

**Structure Decision**: Existing vertical-slice layout, unchanged. The API slice lives under
`apps/api/app/weighing_areas/` with `shared/` for cross-operation concerns; the web work splits
between the shared `checkpoints` feature (the map both kinds share) and the `weighing-areas` feature
(mutations, types, archive actions). No new top-level directory, no migration, and no change to the
`site_references` usage abstraction.

**Decided**: `BulkArchiveDocksActions` is **generalized** into one kind-parameterized
`BulkArchiveCheckpointsActions` rather than mirrored into a weighing-area sibling — see research D8
for the component shape and the migration order. #201 and #206 both inherit it.

## Phase 0: Research

See [research.md](./research.md) for the seven decisions (D1–D7). The ones that shape the build:

- **D4 — select mode generalizes from one kind to two**: widen `selecting=docks` to
  `selecting=docks | weighing-areas` rather than adding a parallel mechanism (FR-038).
  `CheckpointMarker` is already kind-agnostic and needs no change.
- **D3 — bulk backend transposes `#200`**, using the dock's `expectedStatus` blocker signature so
  #206 inherits it.
- **D2 — the comment validator gap** on the already-delivered single path.
- **D7 — failures report in a toast**, exactly as the dock component does, with the dialog left open
  so the typed comment stays correctable. An earlier draft proposed diverging here; that rested on
  a wrong reading of the dock code and was dropped.

## Phase 1: Design

- [data-model.md](./data-model.md) — entities, the unchanged `weighing_areas` columns, blocker
  shape, and the archive state transition.
- [contracts/weighing-area-archive-api.md](./contracts/weighing-area-archive-api.md) — both
  endpoints, payloads, status codes, and the full outcome matrix.
- [contracts/weighing-area-archive-ui-state.md](./contracts/weighing-area-archive-ui-state.md) —
  selection scoping, toolbar and dialog states, outcome reporting, accessibility contract.
- [quickstart.md](./quickstart.md) — how to run and validate the feature end to end.

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1: **all gates still PASS**. The design adds no cross-layer shortcut, no
new persistence mechanism, and no second source of truth. It reuses `bulk_lifecycle_records.ts` and
`lifecycle_validator.ts` unchanged, and it narrows rather than widens existing behavior in exactly
one place — the comment validator — which is a spec-required correction (FR-009/FR-010) to an
existing gap, called out in research D3 so it is not mistaken for scope creep.
