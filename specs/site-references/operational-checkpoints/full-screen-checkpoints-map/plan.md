# Implementation Plan: Full-screen Checkpoints map

**Branch**: `feat/320-full-screen-checkpoints-map` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`specs/site-references/operational-checkpoints/full-screen-checkpoints-map/spec.md`
([#320](https://github.com/whazzark/portflow-ai/issues/320), epic #313 Interface V2).

## Summary

Restyle the administrator Checkpoints screen to the retained V2: the map keeps filling the content
area under the V2 shell header, the filter dropdown and map-cluster buttons are replaced by a
floating toolbar (search with suggestions, type and status toggles with counts, Select, Create),
the side sheet is replaced by cards anchored to the selected checkpoint or pin, placement, move and
select modes announce themselves with a banner that replaces the toolbar, and archiving uses the V2
confirmation copy with a "View" toast. Everything is web-only (`apps/web`): no API, data or URL
schema change. Existing behavior (creation, edit, archive, reactivate, bulk, URL state, error and
empty states) is preserved and re-verified through the existing feature-test seam. See
[research.md](./research.md) for the twelve design decisions (D1–D12).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19

**Primary Dependencies**: TanStack Start / Router / Query, Base UI (`@base-ui/react` 1.6 —
Autocomplete, Menu, Toggle), shadcn primitives in `src/components/ui`, MapLibre GL through
`components/ui/map.tsx`, `sonner` toasts, Tuyau client (unchanged)

**Storage**: N/A (no persistence change; URL search parameters hold view state)

**Testing**: Vitest + Testing Library feature tests through the real router with MSW
(`renderCheckpoints`, `mockDocks`, mocked `CheckpointMap`); Vitest unit tests for pure helpers;
browser walkthrough and accessibility audit per [quickstart.md](./quickstart.md)

**Target Platform**: Evergreen desktop browsers, usable down to 390 px wide

**Project Type**: Web application (PNPM/Turbo monorepo; this feature touches `apps/web` only)

**Performance Goals**: Card follows its anchor during pan/zoom at display frame rate (anchor
recomputed on map `move` events, one `project()` call); search suggestions update per keystroke
for the site's tens of checkpoints without debounce

**Constraints**: No API or URL schema change; existing links keep working; « Marine sobre » tokens
only (no hardcoded colors); WCAG AA in dark and light themes; shared components used by other
screens (`BulkResourceLifecycleActions`, `ResourceMapControls`, `ResourceLifecycleDialog`) change
only additively

**Scale/Scope**: One screen (~15 checkpoints in seed, low hundreds at most); ~10 web modules
touched or added; ~22 existing checkpoint test files adapted

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|---|---|---|
| I. Selected feature intent is versioned | ✅ | #320 selected; spec reviewed and clarified (Q1 deferred discharges, Q2 kept bulk) |
| II. One independently deliverable feature | ✅ | One screen, one PR; discharges section deferred to its own issue |
| III. Vanilla Spec Kit gates | ✅ | Spec reviewed before this plan; plan review required before `/speckit-tasks` |
| IV. Test-first observable behavior | ✅ | Each user story starts with failing feature tests on the contract's names/copy (Phase plan below) |
| V. Deep boundaries | ✅ | UI-only; API stays authoritative; transport→view translation stays in existing adapters (`dock-checkpoint-adapter`, `weighing-area-checkpoint-adapter`) |
| VI. Durable knowledge has a home | ✅ | `apps/web/AGENTS.md` map rules updated (D12); no duplicated decision; no new domain term |
| VII. Verification | ✅ | `pnpm check`, `pnpm typecheck`, `pnpm test`, browser walkthrough, fresh read-only review before ready |
| VIII. One workflow owner | ✅ | No new workflow state |

**Post-design re-check (after Phase 1)**: ✅ unchanged. The only cross-cutting changes are additive
optional members on `ResourceLifecycleConfig` (D8) and new primitives under
`components/resource-map/` (D1, D3, D4), justified in research; no violation to track.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/operational-checkpoints/full-screen-checkpoints-map/
├── spec.md
├── plan.md              # this file
├── research.md          # D1–D12
├── data-model.md        # view state, modes, filters mapping
├── quickstart.md        # automated checks + browser walkthrough
├── contracts/
│   └── ui-state.md      # URL, accessible names, copy
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
apps/web/
├── AGENTS.md                                    # update map rules (D12)
└── src/
    ├── components/
    │   ├── lifecycle/
    │   │   └── resource-lifecycle-actions.tsx   # + optional describeTitle, successAction (D8)
    │   └── resource-map/
    │       ├── resource-map-workspace.tsx       # slots: toolbar | banner, card, no-match; keeps
    │       │                                    #   map-unavailable / source error / empty states
    │       ├── resource-map-card.tsx            # NEW anchored card + positioning (D1, D2)
    │       ├── resource-map-anchor.ts           # NEW pure placement/clamp helper (unit-tested)
    │       ├── resource-map-toolbar.tsx         # NEW floating toolbar shell + toggle group (D3)
    │       ├── resource-map-search.tsx          # NEW Autocomplete search with suggestions (D4)
    │       ├── resource-map-mode-banner.tsx     # NEW banner replacing the toolbar in modes
    │       └── resource-map-no-match.tsx        # NEW no-match state (FR-011)
    └── features/
        ├── checkpoints/
        │   ├── checkpoint-search.ts             # matches/total for suggestions & hiding (D5)
        │   ├── map/
        │   │   ├── checkpoint-map.tsx           # onAnchorChange, fitRequest, Fit all, ghost
        │   │   │                                #   marker; drop cluster create/select (D6, D7, D9, D10)
        │   │   └── checkpoint-marker.tsx        # selected state; drop search dimming
        │   ├── ui/
        │   │   ├── checkpoints-page.tsx         # compose toolbar/banners/cards; split by mode
        │   │   ├── checkpoint-map-toolbar.tsx   # NEW (replaces checkpoint-map-controls.tsx)
        │   │   ├── checkpoint-detail-card.tsx   # NEW (replaces checkpoint-sheet.tsx)
        │   │   ├── create-checkpoint-panel.tsx  # becomes the creation card body
        │   │   ├── edit-checkpoint-panel.tsx    # becomes the edit card body (previous position)
        │   │   └── checkpoint-resource-form.tsx # fields unchanged
        │   └── __tests__/                       # adapt + new tests per user story
        │       └── support/mock-checkpoint-map.tsx  # + anchor/fit/ghost props
        ├── docks/
        │   ├── dock-lifecycle.tsx               # V2 archive title/effect + View action config
        │   └── ui/dock-details.tsx              # superseded by the card; removed if unused
        └── weighing-areas/
            ├── weighing-area-lifecycle.tsx      # same as docks
            └── ui/weighing-area-details.tsx     # superseded by the card; removed if unused
```

**Structure Decision**: Stay inside the existing vertical slices (`features/checkpoints`,
`features/docks`, `features/weighing-areas`) and add only map-specific, resource-agnostic
primitives under `components/resource-map/` so #321 can adopt them. Route file
`routes/_authenticated/checkpoints.tsx` is unchanged.

## Delivery sequence (TDD per user story)

Each step starts by adapting or adding feature tests against [contracts/ui-state.md](./contracts/ui-state.md)
(RED), then the minimal implementation (GREEN), then refactor. Existing tests that assert the
sheet, the filter dropdown or the map-cluster buttons are migrated to the new names in the same
step, never deleted without an equivalent.

1. **Foundations** — `resource-map-anchor.ts` (unit: placement beside anchor, flip, clamp, bottom
   dock below `md`, fallback when no anchor), `ResourceMapCard`, `ResourceMapModeBanner`,
   workspace slots, mock map props.
2. **US1 Find** — toolbar toggles with counts and URL mapping, last-toggle guard, legend, Fit all,
   search suggestions (pick → select, Enter → fit), marker hiding, no-match state.
3. **US2 Inspect** — detail card content for both kinds and archived, Copy coordinates, close
   paths, deep link and legacy link, card closes when its checkpoint is filtered out; remove
   `CheckpointSheet`.
4. **US3 Create** — Create menu in toolbar, placement banner, creation card on the pin, success
   selection and kind-filter widening, API errors, cancel paths, exclusivity.
5. **US4 Move** — move banner, ghost marker, edit card with previous position, save, cancel
   restores origin, not-found path, weighing areas, no Edit when archived.
6. **US5 Archive/Reactivate** — `ResourceLifecycleConfig` additions (unit/feature test on another
   resource proving default copy unchanged), V2 title/effect copy, View toast action, refusal keeps
   dialog, reactivate.
7. **US7 Bulk** — Select menu entry, select banner with Done, existing bulk suites green with the
   new entry point.
8. **US6 Theme & responsive** — token audit of new overlays, light-theme and 390 px browser pass,
   accessibility audit.
9. **Docs & verification** — `apps/web/AGENTS.md` update, `pnpm check`, `pnpm typecheck`,
   `pnpm test`, quickstart walkthrough, fresh read-only review.

## Risks

| Risk | Mitigation |
|---|---|
| Conflicts with #321 on `components/resource-map/` | New files rather than rewrites; `ResourceMapControls` kept for warehouses; second PR to merge rebases and adopts the first's primitives |
| Card positioning untestable in jsdom | Pure `resource-map-anchor.ts` unit-tested; page tests assert presence/content with fallback position; real positioning checked in the browser walkthrough |
| Large test churn in ~22 checkpoint test files | Keep marker and select-mode accessible names unchanged (contract); migrate sheet/dropdown queries story by story |
| Shared lifecycle dialog change leaking to other resources | Optional members only; test that a resource without them keeps its current title and toast |

## Complexity Tracking

No constitution violation to justify.
