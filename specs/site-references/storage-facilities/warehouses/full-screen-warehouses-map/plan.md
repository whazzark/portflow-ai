# Implementation Plan: Full-Screen Warehouses Map

**Branch**: `feat/321-full-screen-warehouses-map` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`specs/site-references/storage-facilities/warehouses/full-screen-warehouses-map/spec.md`

## Summary

Re-present `/warehouses` as the V2 full-screen map: a floating toolbar (search combobox across
warehouses and doors, Available/Archived pills with counts, `Create warehouse`), a persistent
legend and map controls, one detail card anchored beside the selected outline instead of the
`Sheet`, a mode banner + card for draw, outline editing, door placement, and door move, a door
actions menu with `Show on map` and `Copy coordinates`, and V2 copy for the archive dialog,
the archive toast with `View`, the archived card, and the no-match state. It is web-only: no API,
data, or business-rule change (research R1). Existing URL params, session hooks, map layers,
lifecycle dialogs, and bulk selection are reused; new map chrome is added as shared, additive
primitives under `components/resource-map/` so #320 (Checkpoints) can adopt them.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19

**Primary Dependencies**: TanStack Start/Router/Query, Base UI + shadcn primitives
(`src/components/ui`), MapLibre GL via `components/ui/map.tsx`, sonner, Zod, Tuyau client

**Storage**: N/A (no persistence change)

**Testing**: Vitest + jsdom + Testing Library + MSW (unit and feature levels, ADR 0001);
no Playwright suite exists yet — browser journeys are manual (quickstart)

**Target Platform**: Modern desktop and mobile browsers, dark and light themes

**Project Type**: Web application (PNPM/Turbo monorepo; only `apps/web` changes)

**Performance Goals**: Card re-anchoring and search results update within one frame of map
movement or typing for a site of ~50 warehouses / ~300 doors

**Constraints**: All state a user can be halfway through stays in the URL (existing params only);
design tokens only (no hardcoded colors outside MapLibre paint); text contrast ≥ 4.5:1; every map
action has a keyboard path

**Scale/Scope**: One route, ~15 files changed, ~7 new shared map primitives, ~10 feature/unit test
files added or updated

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Selected intent versioned | ✅ | #321 selected; spec approved by the user on 2026-10-22 |
| II. One deliverable per spec | ✅ | One route's V2 presentation; Checkpoints stays in #320 |
| III. Human gates | ✅ | Spec reviewed; this plan stops for review before tasks |
| IV. Test-first | ✅ | Pure view models unit-tested first; one feature test per user story RED before UI (R10) |
| V. Deep boundaries | ✅ | UI adapters only; API stays authoritative for authorization and lifecycle |
| VI. Durable knowledge | ✅ | Map exceptions recorded in `apps/web/AGENTS.md`, not duplicated here (R9) |
| VII. Verification | ✅ | `pnpm check`/`typecheck`/`test`, manual browser journeys, fresh review |
| VIII. One workflow owner | ✅ | No new state machine |

Post-design re-check: ✅ unchanged. One documented convention change (`Sheet` detail panel and
filter dropdown → anchored card and pills on maps) is recorded in `apps/web/AGENTS.md`; it is not a
constitution violation.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/storage-facilities/warehouses/full-screen-warehouses-map/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R10 decisions
├── data-model.md        # client-side view models
├── quickstart.md        # validation guide
├── contracts/
│   └── ui-contract.md   # URL params, accessible names, keyboard
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code

```text
apps/web/
├── AGENTS.md                                   # map exceptions: anchored card, status pills
└── src/
    ├── helpers/
    │   └── copy-text.ts                        # NEW clipboard + toast helper (R8)
    ├── components/
    │   ├── lifecycle/
    │   │   ├── resource-lifecycle-actions.tsx  # + optional describeTitle, successAction (shared
    │   │   │                                   #   with #320), describeSuccessDetail (R7)
    │   │   └── resource-row-actions.tsx        # + optional non-lifecycle `items` (R8)
    │   └── resource-map/                       # names/APIs as planned by #320 (R9)
    │       ├── resource-map-workspace.tsx      # slots: toolbar | banner, card, no-match
    │       ├── resource-map-anchor.ts          # pure placement helper; + rect anchors (R2)
    │       ├── resource-map-card.tsx           # anchored non-modal region card (R2)
    │       ├── resource-map-toolbar.tsx        # floating toolbar shell + toggle group (R3)
    │       ├── resource-map-search.tsx         # Autocomplete search; + grouped options (R4)
    │       ├── resource-map-no-match.tsx       # no-match panel (R4)
    │       ├── resource-map-mode-banner.tsx    # mode banner (R5)
    │       └── resource-legend.tsx             # unchanged API; warehouse legend always complete
    └── features/
        ├── warehouses/
        │   ├── warehouse-search.ts             # + searchWarehousesAndDoors, status pills mapping
        │   ├── geometry/footprint-centre.ts    # NEW centroid (R6)
        │   ├── use-warehouse-edit-session.ts   # + undo history, moved count (R5)
        │   ├── warehouse-lifecycle.tsx         # V2 title, effect, toast with View (R7)
        │   ├── map/warehouse-map.tsx           # Fit all / zoom controls, onAnchorChange (bounds)
        │   ├── __tests__/support/mock-warehouse-map.tsx # + anchor props
        │   ├── map/warehouse-legend.tsx        # Warehouse / Door / Archived in every state
        │   ├── ui/warehouses-page.tsx          # Sheet → card; toolbar/banner composition
        │   ├── ui/warehouse-toolbar.tsx        # NEW (replaces warehouse-map-controls.tsx)
        │   ├── ui/warehouse-card.tsx           # NEW detail card (replaces warehouse-details.tsx)
        │   ├── ui/create-warehouse-panel.tsx   # V2 card body and copy
        │   ├── ui/edit-warehouse-panel.tsx     # V2 card body, Undo, moved counter
        │   └── __tests__/                      # new unit + feature tests; Sheet → card updates
        └── warehouse-doors/
            ├── ui/warehouse-doors-panel.tsx    # card section, door pills
            ├── ui/warehouse-door-row-actions.tsx # Show on map, Copy coordinates
            ├── ui/create-warehouse-door-panel.tsx # V2 card body and copy
            ├── ui/edit-warehouse-door-panel.tsx   # V2 card body, previous position
            └── __tests__/                      # updated feature tests
```

**Structure Decision**: Existing vertical slices `features/warehouses` and
`features/warehouse-doors` own screen behavior; route file `routes/_authenticated/warehouses.tsx`
is unchanged (its search schema already carries every param). Map-only chrome goes to
`components/resource-map/` as new files; lifecycle extensions are additive optional props so other
resources and the parallel V2 branches are unaffected.

## Delivery sequence (for task generation)

1. **Pure models (TDD unit)**: `searchWarehousesAndDoors` + door summary, pills ↔ `status`
   mapping, `footprintCentre`, edit history reducer, `copyText`, rect anchors in
   `resource-map-anchor.ts`. Shared map primitives are taken from #320 if merged by then, otherwise
   created to #320's planned API (R9).
2. **US1 Consult**: workspace full-bleed + toolbar + pills + legend + controls; anchored card with
   footprint summary, centre copy, doors, timestamps; operator has no management entries.
3. **US2 Search**: combobox results, keyboard, door result opening, no-match panel.
4. **US3 Draw / US4 Edit outline**: mode banner, card bodies, Undo + moved counter, Escape.
5. **US5 Doors**: placement/move banners and cards, door menu items.
6. **US6 Archive**: lifecycle config hooks, dialog title/effect, toast with `View`, archived card.
7. **US7 Light theme + narrow viewport**: token audit of every overlay, bottom-docked card.
8. **Polish**: delete `warehouse-map-controls.tsx` / `warehouse-details.tsx` once unused,
   `apps/web/AGENTS.md`, full verification and quickstart journeys, fresh review.

## Risks and coordination

- **#320 parallel branch** shares `components/resource-map/` and `components/lifecycle/`.
  Mitigation: this plan adopts #320's file names and APIs (`ResourceMapCard`,
  `resource-map-anchor.ts`, `ResourceMapSearch`, `ResourceMapToolbar`, `ResourceMapModeBanner`,
  `ResourceMapNoMatch`, `describeTitle`, `successAction`) and only adds optional extensions; the
  branch merged second rebases and adopts the first's primitives. Note left in the shared notes
  folder. Implementing after #320 merges is the lower-risk order.
- **Sibling V2 restyles (#318, #319)** may touch `components/lifecycle/`. Mitigation: additive
  optional config only.
- **Feature-test churn**: warehouse and door tests scoped with `getByRole('dialog')` for the sheet
  migrate to the card's `region` (R2), and tests reading the filter dropdown or "Showing" badge move
  to the pills — story by story, never deleted without an equivalent.
- **Card positioning in jsdom**: the mocked map reports no anchor, so feature tests see the
  fallback position; placement is covered by `resource-map-anchor.ts` unit tests and the browser
  journeys.
- **SC-005 automated a11y**: no axe tooling exists (ADR 0001); verified through role/name
  assertions and a manual pass — flagged for plan review (R10).

## Complexity Tracking

No constitution violations to justify.
