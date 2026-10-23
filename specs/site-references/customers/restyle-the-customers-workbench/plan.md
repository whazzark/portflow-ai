# Implementation Plan: Restyle the Customers workbench

**Branch**: `feat/318-restyle-customers-workbench` | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from
`specs/site-references/customers/restyle-the-customers-workbench/spec.md` (GitHub issue #318,
epic #313).

## Summary

Bring `/customers` to the retained Interface V2 inside the V2 shell from #314: restyled toolbar,
tabs and tables (actor chips with short dates, monospaced codes, visible Actions column), a
no-match panel with a cross-tab hint, V2 detail sheet with a History timeline, V2 create and edit
sheets keeping "Back to details" and conflict field errors, V2 lifecycle dialog copy, a V2 bulk bar and a
bulk dialog that lists the selection. The change is web-only: no API, schema or URL change. Shared
lifecycle components gain optional seams and two new shared primitives (History timeline, actor
chip) instead of changing their defaults, so the other directories and the parallel sibling
restyles are unaffected until they opt in. Decisions: [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19

**Primary Dependencies**: TanStack Start/Router, TanStack Query, TanStack Table, TanStack Form
(`useAppForm`), shadcn/ui on Base UI, Tailwind CSS v4 with the « Marine sobre » tokens, sonner,
lucide-react, Tuyau client

**Storage**: N/A (reads the existing `customers.index` API; no persistence change)

**Testing**: Vitest + Testing Library feature tests through the real router with MSW
(`src/features/customers/__tests__`); Vitest unit tests for pure helpers; manual browser
walk-through ([quickstart.md](quickstart.md)) — the repository has no Playwright suite

**Target Platform**: Modern evergreen browsers, desktop first, usable at phone width

**Project Type**: Web application (PNPM/Turbo monorepo; this feature touches `apps/web` only)

**Performance Goals**: No regression: list filtering, sorting and tab switching stay client-side
and instant for the site's customer volume (hundreds of rows)

**Constraints**: Theme tokens only (no hex), ≥ 4.5:1 text contrast in both themes, URL keeps all
in-progress state, API stays authoritative for permissions and conflicts, shared lifecycle defaults
unchanged

**Scale/Scope**: One route (`/customers`), ~10 feature files, 4 shared files touched or added, ~20
existing customer test files updated plus new ones

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Selected feature intent is versioned | ✅ | Issue #318 selected; spec approved with two clarifications |
| II. One independently deliverable feature | ✅ | Customers workbench only; #180 discharges excluded |
| III. Vanilla Spec Kit gates | ✅ | Spec reviewed before this plan; plan review required before tasks |
| IV. Test-first observable behavior | ✅ | Each changed behavior (no-match hint, conflict field errors, sheet navigation, History, bulk list/confirm, read-only) gets a failing feature test first; copy-only changes update existing assertions |
| V. Deep boundaries and explicit contracts | ✅ | UI adapters only; conflict messages derive from API error codes, no client-side business rule; shared seams documented in [contracts/shared-lifecycle-seams.md](contracts/shared-lifecycle-seams.md) |
| VI. Durable knowledge has a home | ✅ | `apps/web/AGENTS.md` sheet rule kept (product decision 2026-10-23); no new domain vocabulary |
| VII. Verification is part of delivery | ✅ | `pnpm check`, `pnpm typecheck`, `pnpm test`, quickstart walk-through in both themes, fresh read-only review |
| VIII. One workflow owner | ✅ | No new workflow state |

Post-design re-check: unchanged — all gates pass; no Complexity Tracking entries.

## Spec adjustments made at plan time

Recorded in the spec's Clarifications section; please confirm during plan review.

1. **Post-write navigation**: create and edit return to the customer's detail sheet (with the
   existing confirmation toast) instead of closing the sheet — the behavior the `create-a-customer`
   and `update-a-customer` contracts already define, which FR-024 says the restyle keeps.
2. **Bulk bar name**: the shared toolbar keeps its role and name "Bulk customer actions" rather
   than becoming a "Bulk actions" region, so every directory keeps one accessible pattern (R2).

## Documented deviations from the boards

- Bulk skips are reported only after submission (clarification Q1).
- Search copy mentions lifecycle comments (clarification Q2).
- Partial bulk toast keeps the shared sentence ("2 customers archived; 1 customer unchanged",
  "NORDENG: used by an active or planned discharge") — R9.
- Bulk dialog keeps the shared title "Archive selected customers?" with the selection listed and a
  counted confirm button.
- Create and edit sheets have no footer "Cancel" (product decision 2026-10-23, shared with #317).
- Lifecycle dialogs keep the shared "Maximum 1,000 characters" field description beneath the
  comment.

## Design overview

### Shared (additive, see [contracts/shared-lifecycle-seams.md](contracts/shared-lifecycle-seams.md))

- `components/lifecycle/resource-lifecycle-actions.tsx`: optional `describeTitle`,
  `commentPlaceholder` on `ResourceLifecycleConfig`.
- `components/lifecycle/bulk-resource-lifecycle-actions.tsx`: optional `selection`,
  `describeConfirm`, `commentPlaceholder`; toolbar restyled to the V2 bar with unchanged accessible
  names.
- `components/lifecycle/resource-lifecycle-history.tsx` (new): History timeline.
- `components/resource/resource-actor.tsx` (new): actor chip with optional short date.
- `helpers/dates.ts`: `formatShortDate`.

### Customers feature

- `customers-page.tsx`: toolbar (search placeholder, Create with plus icon), V2 tabs with counts,
  bulk bar wiring (`selection`, `describeConfirm`, `commentPlaceholder`), no-match actions
  (clear search, show other tab).
- `customer-section.tsx` + new `customer-no-match.tsx`: no-match panel and empty states.
- `customer-table.tsx`: V2 table styling, visible Actions header, `ResourceActor` lifecycle cells,
  archived rows not dimmed.
- `customer-row-actions.tsx`: menu named by code, separator before lifecycle items (via
  `ResourceRowActions` rendering a `DropdownMenuSeparator` between edit/view and lifecycle items
  when both exist — a visual change for every directory's menu, no name change).
- `customer-lifecycle.tsx`: `describeTitle`, `describeEffect`, `commentPlaceholder` for customers.
- `customer-details.tsx`: V2 header, summary grid with status dot, `ResourceLifecycleHistory`, V2
  footer.
- `create-customer-panel.tsx`, `edit-customer-panel.tsx`, `customer-form.tsx`: V2 headers, hints,
  submit in a bordered footer (no Cancel; edit keeps "Back to details"), conflict field errors with
  owner lookup from the loaded list.
- `customer-sheet.tsx`: passes the loaded customers for the conflict lookup.

### Conventions

- `apps/web/AGENTS.md` is unchanged: the product owner decided on 2026-10-23 (with #317) to keep
  its sheet rule — edit sheets are left through "Back to details", creation sheets get "Cancel"
  only when unmodal over a map — rather than the boards' footer Cancel.

### Coordination with sibling sessions

Leave a note in the shared session notes folder naming the new shared primitives and seams so #317,
#319, #320, #321 and #326 reuse them rather than building parallel versions, and flagging that
`BulkResourceLifecycleActions` and `ResourceRowActions` change visually for every directory.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/customers/restyle-the-customers-workbench/
├── spec.md
├── plan.md                         # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── customers-workbench-ui.md
│   └── shared-lifecycle-seams.md
├── checklists/requirements.md
└── tasks.md                        # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
apps/web/
└── src/
    ├── helpers/dates.ts                              # + formatShortDate
    ├── helpers/dates.test.ts                         # formatShortDate unit test
    ├── components/
    │   ├── lifecycle/
    │   │   ├── resource-lifecycle-actions.tsx        # + describeTitle, commentPlaceholder
    │   │   ├── bulk-resource-lifecycle-actions.tsx   # + selection, describeConfirm, commentPlaceholder; V2 bar
    │   │   ├── resource-row-actions.tsx              # separator before lifecycle items
    │   │   └── resource-lifecycle-history.tsx        # new
    │   └── resource/
    │       └── resource-actor.tsx                    # new
    └── features/customers/
        ├── customer-lifecycle.tsx
        ├── ui/
        │   ├── customers-page.tsx
        │   ├── customer-section.tsx
        │   ├── customer-no-match.tsx                 # new
        │   ├── customer-table.tsx
        │   ├── customer-row-actions.tsx
        │   ├── customer-details.tsx
        │   ├── customer-sheet.tsx
        │   ├── create-customer-panel.tsx
        │   ├── edit-customer-panel.tsx
        │   └── customer-form.tsx
        └── __tests__/
            ├── list/        # columns, lifecycle cells, no-match, empty, row menu
            ├── details/     # detail, history, create/edit sheets, conflicts, permissions
            ├── lifecycle/   # dialog copy, toasts
            ├── bulk/        # bar, dialog list and confirm label, partial toast
            └── selection/   # unchanged behavior, updated names
```

**Structure Decision**: Web-only change inside the existing `apps/web` vertical slice
(`src/features/customers`) plus additive shared primitives under `src/components/lifecycle` and
`src/components/resource`, as `apps/web/AGENTS.md` prescribes for resource-shaped primitives.

## Complexity Tracking

No constitution violations.
