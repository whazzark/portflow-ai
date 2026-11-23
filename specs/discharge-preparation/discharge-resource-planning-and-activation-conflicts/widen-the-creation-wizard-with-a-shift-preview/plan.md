# Implementation Plan: Wider Creation Wizard With a Shift Preview

**Branch**: `feat/323-wider-creation-wizard-shift-preview` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/widen-the-creation-wizard-with-a-shift-preview/spec.md`

## Summary

The creation wizard at `/discharges/new` now uses the full content width, and the Planned shifts
step opens on a read-only shift preview.

**In `apps/api`**: the `discharges` slice gains a `dock_occupancy/` folder.
- `GET /api/v1/discharges/dock-occupancy?dockId=<uuid>` is authorized by the existing
  `DischargePolicy.list` ability.
- It answers every planned or active discharge on that dock, each with an occupancy span. The span
  is the earliest planned shift start to the latest planned shift end, computed by one aggregate
  query.
- The read is dock-scoped so that #324's dock timeline can reuse it (research.md Decisions 1–3).

**In `apps/web`**:
- **Layout**: the form, footer, and pending skeleton drop their `max-w-5xl` column, and
  `StepIndicator` drops « Step X of 3 ». The Planned shifts description loses its trailing sentence.
  The existing sticky footer is kept as is.
- **Layout logic**: a pure `shift-preview.ts` lays out the preview, with its period, clipped
  occupancy blocks, « free from », numbered shift blocks, breaks, no-period placeholders, and totals.
- **Component**: a `ShiftPreview` component renders that layout above the Planned shifts card. It
  is fed by `form.Subscribe` and a new `dockOccupancy` query that is refetched on every opening.
  Failures show an inline retry.

No migration and no write path. No creation rule or validation changes.

## Technical Context

**Language/Version**: TypeScript on the repository's Node.js ESM runtime (`apps/api` AdonisJS,
`apps/web` TanStack Start)

**Primary Dependencies**:
- **API**: AdonisJS 7, Lucid, Bouncer, and VineJS 4, all already dependencies.
- **Web**: Tuyau 1.2, TanStack Start/Router/Query 5, TanStack Form, React 19, shadcn/Base UI
  (`Alert`, `Button`, `Skeleton`), and Tailwind CSS 4.
- No new dependency.

**Storage**: Existing PostgreSQL tables `discharges` and `shifts`, read only. No migration.

**Testing**:
- **API**: Japa integration tests on the route and unit tests for the use case and transformer
  (research.md Decision 9).
- **Web**: Vitest with jsdom, Testing Library, and MSW through the real router. There are pure unit
  tests for `shift-preview.ts`, and feature tests under `__tests__/create/`.
- Playwright is not set up in `apps/web`. Scrolling under the footer is checked manually through
  `quickstart.md`.

**Target Platform**: Authenticated responsive web workstation backed by the Node.js API.

**Project Type**: PNPM/Turbo monorepo web application (`apps/api` + `apps/web`).

**Performance Goals**:
- The preview reflects a shift edit within one second (SC-002). Layout is a pure computation over at
  most dozens of shifts and occupancies per render.
- The occupancy read is one grouped query on an indexed `dock_id`.

**Constraints**:
- The preview is advisory. Start blocking stays with GH-56 (FR-016).
- The API is authoritative for occupancy. The web only clips and positions it.
- Times use the browser zone, consistent with the shift fields and footer.
- The page is never scrolled sideways; only the preview's own box scrolls horizontally on narrow
  screens.

**Scale/Scope**:
- **API**:
  - one use case and one validator;
  - one repository method (abstract and Lucid), one transformer, one controller action, and one
    route;
  - the Tuyau registry is regenerated.
- **Web**:
  - one query and one pure layout module;
  - one component;
  - edits to `create-discharge-form.tsx`, `step-indicator.tsx`, and `create-discharge-pending.tsx`;
  - test helpers gain an MSW handler.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Selected intent**: PASS. Issue #323 is selected and its spec was reviewed before this plan.
  One wording correction to FR-007 is called out in research.md for plan review.
- **II. Independent delivery**: PASS. There is one vertical slice: a read endpoint and the wizard
  changes, mergeable as one PR. #314 is merged. #324 may reuse the endpoint but is not required.
- **III. Human gates**: PASS. Human review of this plan is required before `/speckit-tasks`.
- **IV. Test-first behavior**: PASS. Every FR maps to a seam:
  - **API integration**: FR-010, FR-011, FR-019, and FR-020.
  - **Web unit (`shift-preview.ts`)**: FR-007, FR-009, FR-010 through FR-014.
  - **Web feature**: FR-001 through FR-006, FR-015 through FR-018, and the regression of the
    existing creation journeys (SC-005).
- **V. Deep boundaries**: PASS.
  - The use case owns the read.
  - The repository owns the aggregate query.
  - The controller authorizes, validates the query string, and serializes.
  - On the web, the pure module owns every derivation, the component only renders, and the form
    keeps ownership of state.
- **VI. Durable knowledge**: PASS.
  - `CONTEXT.md` already defines Dock (« at most one active discharge »). « Dock occupancy » is a
    derived, preview-level notion defined in this feature's data-model.md and does not need a
    glossary entry unless #324 adopts it.
  - No ADR is needed.
- **VII. Verification**: PASS (planned). The PR will run `pnpm check`, `pnpm typecheck`, and
  `pnpm test`, plus the quickstart browser walk and a fresh read-only review.
- **VIII. One workflow owner**: PASS. No orchestration is added.

*Post-design re-check*: PASS. Design artifacts add no write path, no new ability, and no
cross-layer shortcut.

## Project Structure

### Documentation (this feature)

```text
specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/widen-the-creation-wizard-with-a-shift-preview/
├── spec.md
├── plan.md                         # This file
├── research.md                     # Phase 0
├── data-model.md                   # Phase 1
├── quickstart.md                   # Phase 1
├── contracts/
│   ├── dock-occupancy.openapi.yaml # Phase 1
│   └── ui-state.md                 # Phase 1
├── checklists/requirements.md
└── tasks.md                        # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/api/
├── app/controllers/discharges_controller.ts               # + dockOccupancy action
├── app/discharges/dock_occupancy/
│   ├── list_dock_occupancy_use_case.ts                    # new
│   └── dock_occupancy_validator.ts                        # new (dockId: uuid)
├── app/discharges/shared/
│   ├── dock_occupancy_transformer.ts                      # new
│   └── repositories/
│       ├── discharge_repository.ts                        # + listDockOccupancy(dockId)
│       └── lucid_discharge_repository.ts                  # + aggregate query
├── start/routes.ts                                        # + GET /discharges/dock-occupancy before /:id
└── tests/
    ├── integration/discharges/consultation/dock_occupancy.spec.ts   # new
    └── unit/discharges/consultation/dock_occupancy.spec.ts          # new

apps/web/src/features/discharges/
├── queries/discharge-queries.ts                           # + dockOccupancy(dockId)
├── shift-preview.ts                                       # new pure layout
├── ui/create/
│   ├── create-discharge-form.tsx                          # full width, preview, description
│   ├── create-discharge-pending.tsx                       # full width
│   ├── step-indicator.tsx                                 # no « Step X of 3 »
│   └── shift-preview.tsx                                  # new component
└── __tests__/
    ├── shift-preview.test.ts                              # new unit
    ├── create/shift-preview.test.tsx                      # new feature
    ├── create/steps.test.tsx, create/layout.test.tsx      # updated where they assert the stepper
    └── support/test-helpers.ts, support/fixtures.ts       # + occupancy handler and fixtures
```

**Structure Decision**: The repository's existing vertical slices are used. The read lives in the
API `discharges` slice beside `list/` and `show/`. The web additions stay in
`features/discharges`, with the pure module at feature level beside `shift-calendar.ts`.

## Complexity Tracking

No constitution violations to justify.
