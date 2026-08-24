# Implementation Plan: Create a Weighing Area

**Branch**: `feat/203-create-weighing-area` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/operational-checkpoints/weighing-areas/create-a-weighing-area/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Let an authorized administrator create a weighing area by clicking its location on the existing
shared Checkpoints map (`/checkpoints`), naming it, and confirming — the new area appears
immediately as Available at the clicked (or dragged/typed) coordinates.

Research into the current codebase found that **both halves of the mechanism already exist**:

1. **The API slice is complete and tested.** `POST /api/v1/weighing-areas` is routed to
   `WeighingAreasController.store`, guarded by `WeighingAreaPolicy.create` (administrator roles
   only, behind the active-user `auth` middleware), validated by `createWeighingAreaValidator`,
   normalized by `CreateWeighingAreaUseCase`, and persisted by `LucidWeighingAreaRepository` under
   a `LOWER(name)` unique index scoped to the `weighing_areas` table. Unit and integration tests
   already cover trimming, blank-name rejection, boundary and illegal coordinates,
   case-insensitive uniqueness across Available and Archived, and unauthenticated/unauthorized
   refusal. No backend behavior change is required.
2. **The map-placement mechanism is already a shared, resource-agnostic primitive.** #198 built
   `useResourceMapPlacement` + `PendingPlacementMarker` in
   `apps/web/src/components/resource-map/resource-map-placement.tsx` explicitly so that this issue
   could consume it unmodified, and `ResourceMapCreateControl` already collapses to a dropdown when
   more than one create action is offered.

This feature is therefore a **frontend-only vertical slice** whose real work is (a) adding the
weighing-area mutation, form, and panel, and (b) generalizing the checkpoints page's creation state
from "is creating a dock" to "which checkpoint kind is being created", so the two flows are mutually
exclusive (FR-017) and the success handler widens the right filter (FR-013). To avoid duplicating
the ~120 lines of coordinate parsing/sync logic currently living inside `dock-form.tsx`, that logic
is extracted into a shared `resource-placement-fields.tsx` module that both forms consume; the
existing dock create tests are the regression guard for that extraction.

## Technical Context

**Language/Version**: TypeScript (apps/web: React 19 via TanStack Start; apps/api: AdonisJS on Node.js)

**Primary Dependencies**: TanStack Router/Query/Form (`useAppForm`), `@tuyau/react-query` (typed API client), Zod, `sonner` (toasts), Radix-based `Sheet`/`Field` UI primitives, MapLibre GL via the shared `Map` components; backend: AdonisJS, VineJS, Lucid, Bouncer (all pre-existing, unmodified)

**Storage**: PostgreSQL via the existing `weighing_areas` table — no schema change, no migration

**Testing**: Vitest + Testing Library + MSW for `apps/web`; Japa for `apps/api` (existing API tests already cover this endpoint; one optional contract-pinning integration test is proposed in `contracts/weighing-area-create-api.md`)

**Target Platform**: Web application (desktop and tablet browsers), served by the existing Portflow web app

**Project Type**: Web application monorepo (`apps/api` + `apps/web`), extending an existing feature area

**Performance Goals**: New weighing area visible on the map within 2 seconds of a successful submission (SC-001); single-row insert, no new backend load characteristics

**Constraints**: Must reuse the existing `/checkpoints` route, its `checkpoint=<kind>:<id>` selection contract, and its `create` search param rather than introducing a new page; must reuse the existing `isAdministrator` check and `POST /api/v1/weighing-areas` contract without backend behavior changes; the shared placement primitive from #198 MUST be consumed as-is, not forked; the coordinate-field extraction MUST leave dock creation behavior byte-for-byte unchanged, proven by the existing dock create tests still passing untouched in substance

**Scale/Scope**: One new creation flow in one existing feature area; no new API surface, no new persisted entity, no data migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Selected feature intent is versioned** — PASS. This spec was created from issue #203,
  selected off the Weighing Areas roadmap (#191), after its blocker #202 closed. Not speculative
  bulk expansion.
- **II. One independently deliverable feature per spec** — PASS. Scope is exactly "create a
  weighing area" end-to-end (UI action → existing API → visible result). Update, archive, and
  reactivate stay in #204–#206, and creating any other site reference type stays out per spec
  FR-019. The coordinate-field extraction touches dock code but delivers no dock behavior change:
  it is an implementation-quality decision of the same character as #198's decision to build the
  placement primitive as shared, and is guarded by the existing dock tests.
- **III. Vanilla Spec Kit gates** — PASS. No repository-owned delivery state machine introduced;
  standard spec → plan → tasks → implement lifecycle.
- **IV. Test-first observable behavior** — PASS, with a scope note. The API's observable behavior
  (authorization, validation, uniqueness, trimming, status defaulting) is already covered by
  existing GREEN tests (`apps/api/tests/integration/weighing_areas.spec.ts`,
  `apps/api/tests/unit/weighing_areas/{weighing_area_use_cases,weighing_area_policy}.spec.ts`).
  New RED→GREEN coverage is required for all new frontend behavior: the create entry point's
  visibility and permission gating, placement arming, the form's validation, conflict/error
  handling, mutual exclusivity with dock creation, and the resulting map/selection update.
- **V. Deep boundaries and explicit contracts** — PASS. The new UI code calls the existing typed
  `weighingAreas.store` contract through a mutation hook, exactly as `use-dock-mutations.ts` calls
  `docks.store`. Use case, repository, policy, and controller layers are reused unmodified; no
  cross-layer shortcut is introduced.
- **VI. Durable knowledge has a home** — PASS. `CONTEXT.md` already defines **Weighing Area** and
  **Weighing Area GPS Location**; no new domain vocabulary and no architectural decision requiring
  an ADR is introduced.
- **VII. Verification is part of delivery** — Deferred to implementation/verification (lint,
  typecheck, affected tests, fast suite, browser flow, fresh review); not a plan-time gate.
- **VIII. One workflow owner** — PASS. Plan and artifacts stay inside Spec Kit.

No violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/operational-checkpoints/weighing-areas/create-a-weighing-area/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/                                          # Existing weighing-area API slice — reused as-is
├── app/weighing_areas/
│   ├── create/create_weighing_area_use_case.ts    # Already implements every backend-enforced FR
│   └── shared/{weighing_area_policy,weighing_area_validator,weighing_area_exceptions}.ts
├── app/controllers/weighing_areas_controller.ts   # `store` already wired at POST /api/v1/weighing-areas
├── database/migrations/1784600000000_create_weighing_areas_table.ts  # LOWER(name) unique index already in place
└── tests/
    ├── integration/weighing_areas.spec.ts         # MODIFIED (optional) — pin the 409 conflict code the UI depends on
    └── unit/weighing_areas/{weighing_area_use_cases,weighing_area_policy}.spec.ts  # Unchanged

apps/web/                                          # This feature's actual delivery surface
├── src/components/resource-map/
│   ├── resource-map-placement.tsx                 # Existing — consumed unmodified (built by #198 for this issue)
│   ├── resource-map-create-control.tsx            # Existing — already renders a dropdown for 2+ actions
│   ├── resource-placement-fields.tsx              # NEW — shared coordinate fields extracted from dock-form.tsx
│   └── __tests__/
│       └── resource-placement-fields.test.tsx     # NEW — parsing, sync, and touched-error behavior
├── src/features/weighing-areas/
│   ├── mutations/
│   │   └── use-weighing-area-mutations.ts         # NEW — create mutation + list invalidation
│   ├── ui/
│   │   ├── weighing-area-form.tsx                 # NEW — name field + shared coordinate fields + submit
│   │   ├── create-weighing-area-panel.tsx         # NEW — Sheet panel, mirrors create-dock-panel.tsx
│   │   └── weighing-area-details.tsx              # Existing — unchanged
│   └── __tests__/
│       ├── create/{create,validation,permissions}.test.tsx   # NEW
│       └── support/{fixtures,handlers}.ts         # MODIFIED — add a create handler + created-area fixture
├── src/features/docks/ui/dock-form.tsx            # MODIFIED — consume the extracted shared fields (no behavior change)
├── src/features/checkpoints/
│   ├── ui/checkpoints-page.tsx                    # MODIFIED — generalize creation state to a checkpoint kind
│   ├── ui/checkpoint-sheet.tsx                    # Unchanged — already renders an opaque `createPanel`
│   ├── map/checkpoint-map.tsx                     # Unchanged — `CheckpointMapPlacement` is already kind-agnostic
│   └── __tests__/support/mock-checkpoint-map.tsx  # MODIFIED — kind-agnostic placement affordances
├── src/features/docks/__tests__/create/*.test.tsx # MODIFIED — follow the mock's renamed affordances
└── src/routes/_authenticated/checkpoints.tsx      # MODIFIED — widen `create` to 'dock' | 'weighing-area'
```

**Structure Decision**: Web application monorepo (`apps/api` + `apps/web`, already in place). No
backend behavior is added or changed — the create endpoint, its authorization, validation, and
tests already exist and already satisfy every backend-enforced requirement in the spec (see
`contracts/weighing-area-create-api.md` for the requirement-mapping table). All delivery happens in
`apps/web`: a weighing-area mutation/form/panel following the dock feature's established pattern,
plus additive generalization of the checkpoints page so the two creation flows coexist. The
coordinate-field logic moves into `apps/web/src/components/resource-map/`, next to the placement
primitive it partners with, because it is the same "set a site reference's location" concern and
will be needed a third and fourth time by the warehouse and warehouse-door creation issues.

**Reuse contract for `resource-placement-fields.tsx`**: like the placement primitive it sits beside,
its public surface must not encode weighing-area or dock semantics. It takes an `idPrefix` string
for element ids, a `LatLng | null` pending value, and an `onPendingChange` callback, and returns
per-axis `{ text, error, onChange }` plus a rendered `CoordinateField`. Resource-specific concerns —
the name label, placeholder, submit label, and the API conflict error code — stay in each feature's
own form. This is verified during implementation by the fact that dock creation's existing tests
pass without changing their assertions.

## Complexity Tracking

*No Constitution Check violations were identified. This section intentionally left without entries.*

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 design (data-model.md, contracts/, quickstart.md):

- **II. One independently deliverable feature per spec** — Confirmed still PASS. The design keeps
  the dock touchpoints strictly mechanical (import the extracted fields; follow the mock's renamed
  affordances). No dock behavior, copy, or contract changes, and no other site reference's creation
  flow is delivered.
- **IV. Test-first observable behavior** — Confirmed still PASS. `quickstart.md`'s scenarios 1–13
  give concrete RED targets split across the shared fields module
  (`components/resource-map/__tests__/resource-placement-fields.test.tsx`) and weighing-area
  behavior (`features/weighing-areas/__tests__/create/`), which `/speckit-tasks` will order.
- **V. Deep boundaries and explicit contracts** — Confirmed still PASS. The design adds a
  `create=weighing-area` search-param value and a UI-state contract
  (`contracts/weighing-area-creation-ui-state.md`); neither crosses a layer boundary.
- No other gate is affected. No new violations to record.
