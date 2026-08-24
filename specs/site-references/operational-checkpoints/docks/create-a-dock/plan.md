# Implementation Plan: Create a Dock

**Branch**: `feat/198-create-dock` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/operational-checkpoints/docks/create-a-dock/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Let an authorized administrator create a dock by clicking its location directly on the existing
dock consultation map (`/checkpoints`), naming it, and confirming — the new dock appears
immediately as Available at the clicked (or subsequently dragged/adjusted) coordinates. Research
into the current codebase found that the API slice — validator, use case, policy, Lucid
repository, controller route, and both unit and integration tests — already exists and already
enforces every rule the spec requires (non-blank/trimmed name, case-insensitive uniqueness across
all statuses, latitude/longitude range checks, administrator-only authorization, automatic
`AVAILABLE` status). This feature is therefore a **frontend-only vertical slice**: add a "Create
dock" entry point that arms map-click placement, a draggable pending marker, and a name/coordinate
form to the checkpoints map UI, wired to the existing `POST /api/v1/docks` endpoint, following the
same Sheet + TanStack Form + tuyau-mutation pattern already used for customers.

The click-to-place mechanism (pending marker, drag-to-adjust, click-to-set) is built as a new
shared primitive in `apps/web/src/components/resource-map/` rather than dock-specific code, since
the same principle is intended for the future weighing-area, warehouse, and warehouse-door
creation issues, which already sit on the same shared `resource-map/*`/`Map` foundation as docks.
Only the generic mechanism is built and exercised here, for docks; wiring it into those other
resources' creation flows is explicitly out of scope for this issue (spec FR-016).

## Technical Context

**Language/Version**: TypeScript (apps/web: React 19 via TanStack Start; apps/api: AdonisJS on Node.js)

**Primary Dependencies**: TanStack Router/Query/Form (`useAppForm`), `@tuyau/react-query` (typed API client), Zod, `sonner` (toasts), Radix-based `Sheet`/`Field` UI primitives; backend: AdonisJS, VineJS validators, Lucid ORM, Bouncer policies (all pre-existing, unmodified)

**Storage**: PostgreSQL via the existing `docks` table/migration — no schema change required

**Testing**: Vitest + Testing Library for `apps/web` component/interaction tests; Japa for `apps/api` (existing API tests already cover this endpoint and require no new backend tests)

**Target Platform**: Web application (desktop and tablet browsers), served by the existing Portflow web app

**Project Type**: Web application monorepo (`apps/api` + `apps/web`), extending an existing feature area

**Performance Goals**: New dock visible in the map collection within 2 seconds of a successful submission (SC-001), matching existing checkpoint-loading expectations; no new backend load characteristics (single-row insert)

**Constraints**: Must reuse the existing `/checkpoints` route and `checkpoint=<kind>:<id>` selection contract (per #197) rather than introducing a new page or a persisted "Checkpoint" concept; must reuse the existing `isAdministrator` permission check and `POST /api/v1/docks` contract without backend changes; the new `resource-map-placement.tsx` primitive's public API (hook return shape, component props) MUST stay resource-agnostic — no `Dock`-specific types, names, or imports — so the weighing-area, warehouse, and warehouse-door creation issues can consume it unmodified when they are picked up

**Scale/Scope**: One new UI entry point (button + form sheet) in one existing feature area (`checkpoints`/`docks`); no new API surface, no new persisted entity, no data migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Selected feature intent is versioned** — PASS. This spec was created from issue #198,
  selected off the Docks roadmap (#190); it is not speculative bulk expansion.
- **II. One independently deliverable feature per spec** — PASS. Scope is exactly "create a dock"
  end-to-end (UI action → existing API → visible result); update/archive/reactivate stay in
  #199–#201, and creating any other site reference type — including weighing areas, warehouses, and
  warehouse doors — stays out of this issue per spec FR-016, even though this plan builds their
  future placement mechanism as a shared, unwired primitive (see Summary and Project Structure).
  Building a reusable primitive is an implementation-quality decision, not a scope expansion: no
  other resource's creation flow is delivered, tested, or exposed to users by this issue.
- **III. Vanilla Spec Kit gates** — PASS. No repository-owned delivery state machine introduced;
  this plan follows the standard spec → plan → tasks → implement lifecycle.
- **IV. Test-first observable behavior** — PASS, with a scope note: the API's observable behavior
  (authorization, validation, uniqueness, status defaulting) is already covered by existing RED→GREEN
  tests (`apps/api/tests/integration/docks.spec.ts`, `apps/api/tests/unit/docks/dock_use_cases.spec.ts`,
  `dock_policy.spec.ts`). New RED→GREEN coverage is required for the new frontend behavior: the
  create entry point's visibility, the form's client-side validation, success/duplicate/error
  handling, and the resulting map/list update.
- **V. Deep boundaries and explicit contracts** — PASS. No cross-layer shortcut is introduced: the
  new UI code calls the existing typed `docks.store` contract through a mutation hook, exactly like
  the customers feature calls `customers.store`; use case/repository/controller layers are reused
  unmodified.
- **VI. Durable knowledge has a home** — PASS. No new domain vocabulary or architectural decision
  is introduced that would need `CONTEXT.md`/ADR treatment; the feature reuses established Dock and
  Checkpoint vocabulary from #197.
- **VII. Verification is part of delivery** — Deferred to implementation/verification phases
  (lint, typecheck, affected tests, fast suite, browser flow, fresh review); not a plan-time gate.
- **VIII. One workflow owner** — PASS. This plan and its artifacts stay inside Spec Kit; no Project
  field or other state machine is introduced.

No violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/operational-checkpoints/docks/create-a-dock/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/                                    # Existing dock API slice — reused as-is, unmodified
├── app/docks/
│   ├── create/create_dock_use_case.ts       # Already implements the backend-enforced FRs (see contracts/dock-create-api.md)
│   └── shared/{dock_policy,dock_validator,dock_exceptions}.ts
├── app/controllers/docks_controller.ts      # `store` action already wired at POST /api/v1/docks
└── tests/
    ├── integration/docks.spec.ts            # Already covers auth, validation, creation, uniqueness
    └── unit/docks/{dock_use_cases,dock_policy}.spec.ts

apps/web/                                    # This feature's actual delivery surface
├── src/components/resource-map/
│   ├── resource-map-placement.tsx           # NEW — shared: useResourceMapPlacement hook + PendingPlacementMarker
│   │                                         #   (resource-agnostic; also intended for future weighing-area /
│   │                                         #    warehouse / warehouse-door creation, not wired for them here)
│   └── __tests__/
│       └── resource-map-placement.test.tsx  # NEW — hook/marker behavior tests
├── src/features/docks/
│   ├── mutations/
│   │   └── use-dock-mutations.ts            # NEW — create mutation + query invalidation
│   ├── ui/
│   │   ├── create-dock-panel.tsx            # NEW — Sheet panel, mirrors create-customer-panel.tsx
│   │   ├── dock-form.tsx                    # NEW — TanStack Form, mirrors customer-form.tsx; consumes the
│   │   │                                     #   pending placement for its coordinate fields
│   │   └── dock-details.tsx                 # Existing — unchanged
│   └── __tests__/
│       └── create/                          # NEW — component/interaction tests
├── src/features/checkpoints/
│   ├── map/
│   │   └── checkpoint-map.tsx               # MODIFIED — arm useResourceMapPlacement when creation is active;
│   │                                         #   suspend existing-marker selection while armed
│   ├── ui/
│   │   ├── checkpoint-map-controls.tsx      # MODIFIED — add "New dock" trigger for administrators
│   │   └── checkpoint-sheet.tsx             # MODIFIED — render CreateDockPanel in create mode
│   └── checkpoint-selection.ts              # Unchanged — `create` is a separate, independent search param
└── src/routes/_authenticated/checkpoints.tsx # MODIFIED — add `create` to the search-param schema
```

**Structure Decision**: Web application monorepo (`apps/api` + `apps/web`, already in place). No
backend files are added or changed — the create endpoint, its authorization, validation, and tests
already exist and already satisfy the spec. The map-click placement mechanism (pending marker,
drag-to-adjust) is built as a new shared, resource-agnostic primitive in
`apps/web/src/components/resource-map/`, alongside the other building blocks already shared across
docks, weighing areas, and warehouses — because the same principle is intended for those resources'
future creation issues too (per explicit user direction), and building it in place the first time
avoids a guaranteed near-term extraction. Dock-specific work (mutation hook, form, panel) lives in
`apps/web/src/features/docks`, following the customers feature's established pattern, plus small,
additive modifications to `apps/web/src/features/checkpoints` to expose the entry point, arm
placement on the map, and open the new panel from the existing checkpoint sheet/URL-selection
contract.

**Reusability contract for `resource-map/resource-map-placement.tsx`**: since this primitive is
built specifically so the weighing-area, warehouse, and warehouse-door creation issues can reuse it
later, its public surface must not encode dock semantics. Concretely: the hook takes/returns plain
`{ latitude, longitude }` pairs (not a `Dock` or `DockDto`), an `armed: boolean` flag and setters,
and the marker component takes purely visual props (icon/label content as `children` or a render
prop) rather than a resource kind. `CheckpointMap`/`features/docks` are the only current callers;
they adapt the generic shape to dock-specific concerns on their side, not the other way around.
This is checked in Polish (T028) and should guide code review during implementation.

## Complexity Tracking

*No Constitution Check violations were identified. This section intentionally left without entries.*

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 design (data-model.md, contracts/, quickstart.md):

- **V. Deep boundaries and explicit contracts** — Confirmed still PASS. The design adds a new
  `create=dock` search-param contract and a new UI-state contract
  (`contracts/dock-creation-ui-state.md`), but neither crosses or shortcuts an existing layer
  boundary: the UI mutation hook calls the existing typed `docks.store` contract exactly as
  designed, with no direct database or cross-feature access.
- **IV. Test-first observable behavior** — Confirmed still PASS. `quickstart.md`'s scenarios (1–12)
  give concrete RED targets for the new frontend tests, split across the shared placement primitive
  (`apps/web/src/components/resource-map/__tests__/resource-map-placement.test.tsx`) and dock-specific
  behavior (`apps/web/src/features/docks/__tests__/create/`), that `/speckit-tasks` will turn into
  ordered tasks; the API side needs no new RED tests since its GREEN tests already exist and already
  match every FR (see `contracts/dock-create-api.md`'s requirement-mapping table).
- No other gate is affected by the design. No new violations to record.
