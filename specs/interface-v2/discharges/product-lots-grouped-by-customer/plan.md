# Implementation Plan: Product Lots Grouped by Customer

**Branch**: `feat/325-product-lots-grouped-by-customer` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/interface-v2/discharges/product-lots-grouped-by-customer/spec.md`

## Summary

Restyle and extend the existing Product lots tab of the discharge detail (web only, no API change)
so door problems are visible on each lot and fixable in one click:

1. a summary line above the grouped table, with problem counts;
2. « No door » (derived from the detail) and « Held by <vessel> » (from the existing start check) in
   the amber warning tone, with an inline Assign doors action for preparers;
3. a « Read-only while the discharge is active » note on active discharges;
4. Assign doors dialog copy aligned with the V2 (quantity in the description, « Also on N
   discharges », the hold explained, shift-lock wording, « No change yet », the one-lot rule);
5. the Edit product lot sheet shows the lot's doors read-only with an Assign doors action.

The add-lots and customer-lots sheets already carry running totals; they only get V2 copy checks.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19

**Primary Dependencies**: TanStack Start / Router / Query / Form, Tuyau client, shadcn/ui
(Base UI), Tailwind with « Marine sobre » tokens, lucide-react

**Storage**: N/A (no persistence change)

**Testing**: Vitest + Testing Library feature tests through the real router, MSW for the network;
pure unit tests for derivations

**Target Platform**: Web (desktop and phone width)

**Project Type**: Web application — `apps/web` only; `apps/api` unchanged

**Performance Goals**: No extra request beyond the start check, which #324 also reads on the same
page with the same query key (one request serves both)

**Constraints**: API stays the source of truth (start check decides « held »); amber reserved for
statuses; button labels carry the action only; accessible names name their lot or customer

**Scale/Scope**: ~8 web files touched, 1 new pure helper, 4 feature test files extended

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Note |
|-----------|--------|------|
| I. Selected intent versioned | ✅ | #325 selected; spec approved 2026-10-22 |
| II. One deliverable per spec | ✅ | Product lots tab only; header/banner (#324), active overview (#328), closed door history (#329) excluded |
| III. Human gates | ✅ | Spec approved; this plan stops for review |
| IV. Test-first | ✅ | Each story starts with failing feature tests (see Delivery order) |
| V. Deep boundaries | ✅ | Derivation in a pure view helper; components render; API decides holds |
| VI. Durable knowledge | ✅ | No new domain term; « Held by » reuses the start check vocabulary |
| VII. Verification | ✅ | `pnpm check`, `pnpm typecheck`, `pnpm test`, fresh review before ready |
| VIII. One workflow owner | ✅ | No new state machine |

Post-design re-check: unchanged, all pass. One **spec delta** is introduced (D2) and recorded in the
spec.

## Design Decisions

- **D1 No door** (R2): `lotDoorProblems(detail, problems)` in
  `discharge-detail-view.ts` flags, on a planned discharge, each lot with no assignment whose
  `effectiveTo` is `null` — the exact start rule. Shown to every reader. Replaces today's dash on
  planned discharges; active/closed keep today's rendering.
- **D2 Held by** (R2, R3): the card subscribes to `dischargeQueries.startCheck(discharge.id)` with
  `enabled: canCorrect` (preparer roles = start roles; planned only). `WAREHOUSE_DOOR_HELD` problems
  with a `PRODUCT_LOT` context mark that lot's door chip « Held by <holder.vesselName> ». Observers
  cannot read the start check (403 by GH-56), so they see « No door » but no « Held by »; **spec
  delta**: the spec's observer assumption and US2/AS2 are amended to say so.
- **D3 Unknown holds** (R5): while the check is loading, failed or disabled, `heldKnown` is false:
  held indicators and the held count are omitted, nothing claims "no problem"; no error on the tab.
- **D4 Freshness** (R4): `applyDetail` in `use-discharge-mutations.ts` also invalidates
  `startCheck(id)`. #324 makes the identical change; the second PR to land keeps a single call.
- **D5 Table** : summary line (`N lots · N customers · total`, then non-zero problem counts) above the
  table; « No door » text and held chips in `text-warning` with written words (no color-only
  signal); inline « Assign doors » (`variant="outline"`, `size="xs"`), accessible name
  `Assign doors for <customer> · <product>`, beside the indicator, for preparers on problem lots
  (FR-015 as approved: both « No door » and « Held by »). Existing grouping, menu, footer and
  empty state are kept and restyled to the V2 artboard.
- **D6 Active note**: on an active discharge the card shows « Read-only while the discharge is
  active » beside the summary.
- **D7 Dialog**: description `<customer> · <product> · <quantity>`; `DoorHoldings` shows the text
  `Also on N discharges` (tooltip kept); assigned rows held by an active discharge get a warning note
  `Held by <vessel> (Active). It blocks this discharge's start until <vessel> releases it.` (passed
  from the card's `lotDoorProblems`); the shift lock reads `Used by N shift(s). Remove it from them
  before removing it from the lot.`; `LotDoorChangeSummary` says `No change yet` when empty; a muted
  rule note sits under the columns.
- **D8 Edit lot sheet**: a read-only « Warehouse doors » field reusing `LotDoorChips` (with the
  lot's problems), an « Assign doors » button calling an `onAssignDoors(lot)` prop from the card
  (closes the sheet, opens the dialog), and the note `Doors are changed from Assign doors, not from
  this form.`
- **D9 Sheets**: customer-lots and add-lots sheets keep their behavior; verify the customer field
  shows the customer's subtotal and the footer reads `N lot(s) · total` / `—`, adjusting copy only
  where it differs from the artboards.

## Project Structure

### Documentation (this feature)

```text
specs/interface-v2/discharges/product-lots-grouped-by-customer/
├── spec.md
├── plan.md                      # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/product-lots-tab.ui.md
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks
```

### Source Code

```text
apps/web/src/features/discharges/
├── discharge-detail-view.ts                         # + lotDoorProblems, productLotsSummary
├── mutations/use-discharge-mutations.ts             # applyDetail invalidates startCheck(id)
├── ui/detail/
│   ├── discharge-product-lots-card.tsx              # summary, start-check subscription, inline action, active note
│   ├── lot-door-chips.tsx                           # No door / Held by indicators
│   ├── product-lot-sheet.tsx                        # read-only doors + Assign doors
│   ├── customer-product-lots-sheet.tsx              # copy check only
│   └── add-product-lots-sheet.tsx                   # copy check only
├── ui/planning/
│   ├── lot-warehouse-doors-dialog.tsx               # description, rule note, held map prop
│   ├── assigned-doors-column.tsx                    # held-by-active note, shift-lock wording
│   ├── available-doors-column.tsx                   # (unchanged logic)
│   ├── door-holdings.tsx                            # visible « Also on N discharges »
│   ├── door-transfer-row.tsx                        # REMOVE_FROM_SHIFT_FIRST wording
│   └── lot-door-change-summary.tsx                  # « No change yet »
└── __tests__/
    ├── discharge-detail-view.test.ts                # lotDoorProblems, summary
    ├── detail/product-lots.test.tsx                 # US1, US2 inline action, US3
    ├── detail/correct-product-lot.test.tsx          # US4 doors in sheet
    └── planning/lot-doors.test.tsx                  # US2 dialog copy
```

**Structure Decision**: Existing `features/discharges` vertical slice; no new module, no route
change, no API change.

## Delivery Order (TDD)

1. **US1** — unit tests for `lotDoorProblems`/summary (red) → helper; feature tests for « No door »,
   « Held by », counts, observer view, unavailable check (red) → card + chips + invalidation.
2. **US2** — feature tests for the inline Assign doors and the dialog copy (red) → card action,
   dialog/columns/summary copy.
3. **US3** — feature tests for active note and actions per role/status (red) → card.
4. **US4** — feature test for the lot sheet's doors and Assign doors hand-off (red) → sheet; check
   sheet copy against artboards.
5. Full suite, `pnpm check`, `pnpm typecheck`; browser check at desktop and 375 px; fresh review.

## Coordination

- **#324** reads the same `startCheck(id)` query and adds the same `applyDetail` invalidation;
  rebase keeps one. It owns the header banner and tab dots.
- **#329** owns the closed-discharge door history; this plan leaves `LotDoorChips`' history popover
  logic as is so #329 can remove it independently.

## Complexity Tracking

No constitution violations.
