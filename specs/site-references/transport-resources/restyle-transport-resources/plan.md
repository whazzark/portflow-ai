# Implementation Plan: Restyle Transport Resources

**Branch**: `feat/319-restyle-transport-resources` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`specs/site-references/transport-resources/restyle-transport-resources/spec.md`

## Summary

Replace the two side-by-side directories of `/transport-resources` (companies on the left, trucks
on the right, each with tabs, checkboxes and side sheets) with the retained V2: one table of trucks
grouped by transport company, shared status pills, a company filter banner, inline details,
inline create/edit rows, row-level Return to service / Reactivate, V2 confirmation copy and a
suspension toast. The change is web-only: a pure `buildFleetView` view model drives the table, the
existing forms and lifecycle dialog are reused through additive seams, and bulk selection is
removed from this screen. No API, DTO, policy or business rule changes.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19

**Primary Dependencies**: TanStack Start/Router/Query/Form, Tuyau client, shadcn/ui primitives in
`apps/web/src/components/ui`, sonner, Zod, Tailwind with the #314 Marine sobre tokens

**Storage**: N/A (reads and writes through the existing API)

**Testing**: Vitest + Testing Library + MSW (`apps/web`); Japa API suites unchanged and must stay
green

**Target Platform**: Desktop browsers, usable down to phone width

**Project Type**: Web application (PNPM/Turbo monorepo: `apps/api`, `apps/web`)

**Performance Goals**: Instant client-side filtering for a site fleet (tens of companies, a few
hundred trucks); `buildFleetView` memoised on its inputs

**Constraints**: API stays the authority; no change to read access (Q2); text and pills ≥ 4.5:1
in both themes; shared `components/lifecycle` defaults unchanged (sibling branches assert them)

**Scale/Scope**: One route, ~15 new/rewritten components, 1 view-model module, test suites
reorganised under `features/transport-resources/__tests__/`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Selected intent is versioned | ✅ | Spec approved 2026-10-22 with clarifications recorded. |
| II. One deliverable per spec | ✅ | One screen, one PR. |
| III. Human gates | ✅ | Spec reviewed; this plan stops for review before tasks. |
| IV. Test-first | ✅ | `fleet-view` rules TDD'd; story suites written failing before each UI slice. |
| V. Deep boundaries | ✅ | API untouched; UI adapter `buildFleetView` owns transport-to-view translation. |
| VI. Durable knowledge | ✅ | No new domain term; "Fleet group" is presentation-only and stays in this feature dir. |
| VII. Verification | ✅ | `pnpm check`, `pnpm typecheck`, `pnpm test`, manual quickstart walkthrough, fresh review. |
| VIII. One workflow owner | ✅ | No orchestration added. |

Post-design re-check: ✅ no violation; Complexity Tracking empty.

## Key decisions

Detailed in [research.md](./research.md):

- **R1** Web-only; DTOs already carry every drawn field.
- **R2** `buildFleetView` pure view model ([data-model.md](./data-model.md)).
- **R3** New address state ([contracts/url-state.md](./contracts/url-state.md)); legacy
  `/transport-companies` redirect remapped.
- **R4** Status pills with fleet-wide counts; non-administrators' Archived = archived companies.
- **R5** Inline forms from extracted `useTruckForm` / `useTransportCompanyForm`; known refusals
  mapped to fields (company lock on the company field after save — Q1).
- **R6** Additive lifecycle seams `describeTitle`, `commentPlaceholder` (same contract as #318)
  and `describeSuccessDetail` (suspension toast description).
- **R7** History via #318's `ResourceLifecycleHistory` / `ResourceActor` contract; `formatDate`
  for numeric short dates.
- **R8** Bulk selection, toolbar and shortcuts removed from this screen (Q3); shared bulk code
  untouched.
- **R9** Interaction details; **review point**: the company filter is entered by clicking the
  company name in its group header ("Show only «company»"), which the artboards do not draw.

Accessible names and copy: [contracts/ui-contract.md](./contracts/ui-contract.md).

## Spec alignment notes

- US1 #4 / US6 #3: actor names on truck suspension/archive cells are shown to administrators only
  (non-administrators' DTOs carry none). Company archive context keeps today's visibility.
- US4 #6 / FR-017: the inline edit row shows a company select; the lock surfaces as a field error
  after a refused save.
- Create split button: its primary segment opens the choice menu (no default creation drawn).

## Project Structure

### Documentation (this feature)

```text
specs/site-references/transport-resources/restyle-transport-resources/
├── spec.md
├── plan.md              # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── url-state.md
│   └── ui-contract.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
apps/web/src/
├── routes/_authenticated/
│   ├── transport-resources.tsx            # new search schema + invariants, same loader
│   └── transport-companies.tsx            # redirect remapped to the new params
├── helpers/dates.ts                       # + formatDate (dd/mm/yyyy)
├── components/lifecycle/
│   ├── resource-lifecycle-actions.tsx     # + describeTitle, commentPlaceholder, describeSuccessDetail (optional)
│   └── resource-lifecycle-history.tsx     # shared with #318 (create if not merged yet)
├── components/resource/resource-actor.tsx # shared with #318 (create if not merged yet)
├── features/transport-resources/
│   ├── helpers/fleet-view.ts (+ .test.ts) # view model
│   ├── ui/
│   │   ├── transport-resources-page.tsx   # rewritten: data, URL state, layout
│   │   ├── fleet-toolbar.tsx              # search, status pills, Create split button
│   │   ├── fleet-banners.tsx              # company filter banner, archived notice
│   │   ├── fleet-table.tsx                # frame, sortable header, groups, no-match row
│   │   ├── company-group-rows.tsx         # header row, company detail, inline company form
│   │   ├── company-group-actions.tsx      # company menu + lifecycle dialogs
│   │   ├── truck-row.tsx                  # row, status pill, suspension cell, direct action
│   │   ├── truck-row-actions.tsx          # truck menu + lifecycle dialogs
│   │   ├── truck-detail-row.tsx           # inline detail + History
│   │   ├── truck-form-row.tsx             # inline create/edit truck
│   │   └── company-form-row.tsx           # inline create company
│   └── __tests__/                         # list, filters, details, create-edit, lifecycle, read-only, navigation
├── features/trucks/
│   ├── truck-lifecycle.tsx                # V2 copy via seams; bulk helpers removed
│   ├── ui/truck-form.tsx                  # → useTruckForm hook + schema export
│   ├── ui/truck-status-pill.tsx           # new
│   ├── mutations/use-truck-mutations.ts   # archiveMany/reactivateMany removed
│   └── ui/{trucks-page,truck-section,truck-list,truck-row-actions,truck-details,create-truck-panel,edit-truck-panel}.tsx   # deleted
└── features/transport-companies/
    ├── transport-company-lifecycle.tsx    # bulk helpers removed
    ├── ui/transport-company-form.tsx      # → useTransportCompanyForm hook + schema export
    ├── mutations/use-transport-company-mutations.ts   # bulk mutations removed
    └── ui/{transport-company-section,transport-company-list,transport-company-row-actions,transport-company-details,create-transport-company-panel,edit-transport-company-panel}.tsx   # deleted
```

`features/transport-resources/ui/transport-resources-workspace.tsx` is deleted. `trucks-error.tsx`,
`trucks-pending.tsx` and `transport-companies-error.tsx` stay (route boundaries, retry state),
restyled only if they use hard-coded colours.

**Structure Decision**: Keep the existing vertical slices: resource-specific pieces (forms, status
pill, lifecycle config) stay in `features/trucks` and `features/transport-companies`; the
composed screen and its view model live in `features/transport-resources`.

## Delivery order (input to /speckit-tasks)

1. Shared seams: `formatDate`, lifecycle dialog optional props, History/Actor (or rebase on #318).
2. `buildFleetView` with unit tests (TDD).
3. Route schema + redirect (tests for invariants and legacy mapping).
4. P1 read path: table, groups, pills, search, company filter, no-match, read-only (US1, US2, US6).
5. P1 lifecycle: menus, direct actions, V2 dialogs, suspension toast (US5).
6. P2 details (US3), then inline create/edit (US4).
7. Remove the old directories, sheets, bulk usage and their tests; port business assertions.
8. Light theme pass, quickstart walkthrough, `pnpm check && pnpm typecheck && pnpm test`.

## Risks

- **Merge overlap with #318** on `components/lifecycle/*` and `helpers/dates.ts`: mitigated by
  identical additive contracts; whichever lands second rebases (noted in the shared session notes).
- **Test churn**: ~6,000 lines of trucks / transport-companies UI tests target the removed layout.
  Business assertions are ported, not dropped; the API suites are the backstop for rules (SC-006).
- **Grouped table semantics**: group header rows inside one `tbody` keep a single accessible table;
  verified with Testing Library roles.

## Complexity Tracking

No constitution violation to justify.
