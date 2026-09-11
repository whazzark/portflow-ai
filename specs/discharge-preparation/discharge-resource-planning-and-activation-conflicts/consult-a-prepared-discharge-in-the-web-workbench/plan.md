# Implementation Plan: Consult a Prepared Discharge in the Web Workbench

**Branch**: `whazzark/consult-a-prepared-discharge-in-the-web-workbenc` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/consult-a-prepared-discharge-in-the-web-workbench/spec.md`

## Summary

Give one discharge its own page.

In `apps/api`, the `discharges` slice gains a `show/` workflow behind one read contract,
`GET /api/v1/discharges/:id`. It returns the discharge's whole preparation graph in one response:
- its vessel description and dock;
- its product lots with their customers and every warehouse door assignment they have had;
- its truck pool, with the registration and transport company captured at reservation;
- its shifts, with their responsible and every truck, door, and weighing area membership.

Every site reference arrives with its label and current status, so archived references stay
readable for every role. Unknown and malformed ids share one 404.

In `apps/web`, the discharges route becomes a layout that keeps owning the list's `status` and
`search`. The list moves to an index child, and a new `/discharges/$dischargeId` child renders the
detail as a full page. Because the parent owns the list state, the page's way back returns to the
exact tab and search the user came from. The list's rows, inert since GH-61, become selectable.

The slice is read-only and identical for every active role. It changes no table and no seed.

## Technical Context

**Language/Version**: TypeScript on the repository's Node.js ESM runtime (`apps/api` AdonisJS,
`apps/web` TanStack Start)

**Primary Dependencies**: AdonisJS 7, Lucid, Bouncer, `decimal.js` (already an API dependency),
Tuyau 1.2, TanStack Start/Router/Query 5, React 19, Zod 4, shadcn/Base UI primitives, Tailwind CSS 4

**Storage**: Existing PostgreSQL tables through Lucid, all delivered by GH-236 and the
site-reference slices:
- Discharge graph: `discharges`, `product_lots`, `warehouse_door_product_lot_assignments`,
  `discharge_truck_assignments`, `shifts`, `shift_trucks`, `shift_warehouse_doors`,
  `shift_weighing_areas`.
- Site references and users: `docks`, `customers`, `warehouses`, `warehouse_doors`,
  `weighing_areas`, `trucks`, `transport_companies`, `users`.

No migration, no schema change, and no seed change.

**Testing**: Japa unit and integration tests in `apps/api`, using the existing factories. In the
web: Vitest with jsdom, Testing Library, and MSW, through the real router. Playwright e2e is out of
this slice's required scope, as it was for GH-61.

**Target Platform**: Authenticated responsive web workstation backed by the Node.js API

**Project Type**: PNPM/Turbo monorepo web application (`apps/api` + `apps/web`)

**Performance Goals**: At least 95% of normal loads show the detail within 2 seconds, for a
discharge of up to 20 lots, 60 pool trucks, and 40 shifts (SC-004). The query count is fixed per
relation level and does not grow with those numbers.

**Constraints**:
- The API stays authoritative for authorization, and every active role reads the same payload.
- Captured registrations and company names are shown, never current ones.
- Every effective period is shown on its own.
- Quantities keep three decimals end to end.
- An unknown or malformed id is a not-found outcome, never a retryable failure.
- No mutation and no action button.

**Scale/Scope**:
- API: one endpoint, one use case, one transformer, one exception, and one policy method.
- Web: one layout route, the list moved to an index route, and one detail route with its four
  cards.
- Two small shared changes: ancestor breadcrumbs keep the search, and a new `isNotFoundError`
  helper.
- One list change: rows become selectable.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Selected intent**: PASS. Issue #58 is selected, and its clarified `spec.md` is the
  contract. The plan does not reach into GH-53 to GH-56 or into any later slice that will extend
  this page.
- **II. Independent delivery**: PASS. This is one vertical slice, with one query in `apps/api` and
  one page in `apps/web`, mergeable as one PR. Its blockers, GH-61 and GH-236, are delivered.
- **III. Human gates**: PASS. The spec's two open product questions were settled with the product
  owner on 2026-09-11 before planning. Human review of this plan is required before
  `/speckit-tasks`.
- **IV. Test-first behavior**: PASS. Every behavior has an observable seam:
  - API unit tests: graph assembly, ordering, the registration fallback, and decimal sums.
  - API integration tests: authentication, per-role success, 404s, and the response shape.
  - Web unit tests: the pure period and tonnage helpers.
  - Web feature tests, through the real router with MSW: every section, the address state, and
    the not-found, error, and retry states.
- **V. Deep boundaries**: PASS.
  - The use case owns the not-found decision.
  - The repository owns preloading, ordering, and the malformed-id guard.
  - The transformer owns the captured-registration join and the decimal sum.
  - The controller owns authorization and serialization.
  - The web feature owns deriving in-effect and ended from the payload.
- **VI. Durable knowledge**: PASS. The vocabulary is already in `CONTEXT.md`. No ADR is needed:
  the one departure from a web convention (a page instead of a `Sheet`) is a product decision
  recorded in the spec's Clarifications and research.md Decision 9, not a new architecture.
- **VII. Verification**: PASS. `quickstart.md` lists the targeted suites, the repository-wide
  `pnpm check`, `pnpm typecheck`, and `pnpm test`, and a manual browser pass.
- **VIII. One workflow owner**: PASS. No delivery state machine, Project field, or orchestrator is
  introduced.

**Post-design re-check**: PASS. Phase 1 adds one endpoint, no table, no authorization bypass, and
no cross-feature import. It touches two shared web files, the header breadcrumb and the API-error
helper, and neither change alters any existing page (research.md Decisions 7 and 8).

## Project Structure

### Documentation (this feature)

```text
specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/consult-a-prepared-discharge-in-the-web-workbench/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── discharge-detail.openapi.yaml
│   └── ui-state.md
├── checklists/requirements.md
└── tasks.md             # Created later by /speckit-tasks, not by this plan
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/discharges_controller.ts                  # add show()
│   └── discharges/
│       ├── show/show_discharge_use_case.ts                   # new
│       └── shared/
│           ├── discharge_exceptions.ts                       # new: DischargeNotFoundException
│           ├── discharge_policy.ts                           # add view()
│           ├── discharge_detail_transformer.ts               # new
│           └── repositories/
│               ├── discharge_repository.ts                   # add findDetail(id)
│               └── lucid_discharge_repository.ts             # implement findDetail(id)
├── start/routes.ts                                           # add GET /discharges/:id as show
└── tests/
    ├── unit/discharges/consultation/{show,policy}.spec.ts    # show new, policy extended
    └── integration/discharges/consultation/show.spec.ts      # new

apps/web/src/
├── components/layout/authenticated-header.tsx                # ancestor crumbs keep the search
├── libraries/tuyau/api-error.ts                              # add isNotFoundError
├── routes/_authenticated/
│   ├── discharges.tsx                                        # becomes the layout
│   ├── discharges.index.tsx                                  # new: the list, moved
│   └── discharges.$dischargeId.tsx                           # new: the detail
└── features/discharges/
    ├── types.ts                                              # add detail DTO types
    ├── queries/discharge-queries.ts                          # add detail(id)
    ├── discharge-detail-view.ts                              # new: pure period, notice, and formatTonnes helpers
    ├── ui/
    │   ├── discharge-list.tsx                                # rows become selectable
    │   ├── discharges-page.tsx                               # route API follows the move
    │   └── detail/
    │       ├── discharge-detail-page.tsx
    │       ├── discharge-identity-card.tsx
    │       ├── discharge-product-lots-card.tsx
    │       ├── discharge-shifts-card.tsx
    │       ├── discharge-truck-pool-card.tsx
    │       ├── discharge-status-badge.tsx                    # discharge and shift statuses
    │       ├── effective-period.tsx                          # "Since …" / "… – …", muted when ended
    │       ├── discharge-detail-pending.tsx
    │       ├── discharge-detail-error.tsx
    │       └── discharge-not-found.tsx
    └── __tests__/
        ├── support/{fixtures.ts,test-helpers.ts}             # add detail fixtures and mockDischargeDetail
        ├── discharge-detail-view.test.ts                     # new, unit
        ├── list/row-selection.test.tsx                       # replaces list/inert-rows.test.tsx
        └── detail/{identity,product-lots,shifts,truck-pool,navigation,access,feedback}.test.tsx
```

`routeTree.gen.ts` regenerates from the three route files. `formatTonnes` stays in the feature's
pure helper module, where the unit test covers it. It moves to `helpers/` when a second feature,
most likely rotations, needs to display tonnes.

**Structure Decision**: Follow the delivered read-slice shape and add to it rather than invent a
new one.

In the API, `show/` sits beside `list/` in `app/discharges/`. The list and the detail share the
policy and the repository, but not the transformer: the two shapes differ in almost every field,
and the list transformer's own comment keeps detail fields out of it. The detail transformer is a
separate class in `shared/`, because the controller that serializes it is shared.

In the web, `features/discharges/` owns the detail beside the list. The detail components live
under `ui/detail/` because the page is made of four cards and their support pieces, and those
would otherwise crowd the list's files. The route files stay thin: schema, loader, and components
only, per `apps/web/AGENTS.md`. The detail loader turns a 404 into `notFound()` and lets
everything else reach the error component (research.md Decision 7).

Restructuring `discharges.tsx` into a layout keeps GH-61's search schema where it is, so the
list's URL-state tests should keep passing unchanged. They are the regression check for the move.
Only `inert-rows.test.tsx` is replaced, because FR-003 reverses the behavior it pins.

## Complexity Tracking

No constitution violation to justify. Two deliberate departures from web conventions are recorded
where they are decided, not here:
- A full page instead of a `Sheet` (research.md Decision 9).
- A breadcrumb resolved from loader data to name the vessel, which widens the shared `staticData.breadcrumb` type (research.md Decision 10).
