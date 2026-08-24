# Implementation Plan: Archive Docks

**Branch**: `feat/200-archive-dock` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`specs/site-references/operational-checkpoints/docks/archive-docks/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the
execution workflow.

## Summary

Let an authorized administrator archive one available dock, or a selection of available docks
together, from the existing checkpoint consultation map (`/checkpoints`).

Research into the current codebase found a **split baseline**: the individual archive backend
(`POST /api/v1/docks/:id/archive`, `archiveDockValidator`, `ArchiveDockUseCase`,
`DockPolicy.archive`, `LucidDockRepository.archiveAvailable`) already exists, was delivered under
#178, and is already fully tested — it enforces every individual-archive rule this spec restates
(eligibility via `SiteReferenceUsageChecker`, already-archived, not-found, comment, lifecycle
metadata). **No production backend change is needed for the individual path.** But **no frontend
ever calls it** — `use-dock-mutations.ts` has no `archive` mutation and no UI offers the action —
so the individual user story is a **frontend-only gap**.

The multiple-archive user story — the capability explicitly called out in this issue — **does not
exist at any layer**. Customers already ship the exact shape this needs: a collection-level
`POST /customers/archive` endpoint, a transactional bulk repository method with row locking, a
`findBulkBlockers` helper producing `NOT_FOUND` / `IN_USE` / `ALREADY_ARCHIVED` per identifier, a
`distinctUuids` + non-empty selection validator, and a selection/toolbar/confirmation-dialog UI
(`BulkLifecycleActions`). This plan **replicates that pattern for Dock** rather than inventing a
new one, extracting the two reusable validator pieces (`distinctUuids`, the `ids`/`comment` schema
factory) into the shared site-reference validator module so Customer and Dock consume the same
rule instead of a second copy of it.

The one genuinely new design decision is **where multi-select lives**. Customers select rows in a
table; docks are consulted on a map with a single-selection model (`checkpoint=<kind>:<id>`, one
sheet, one marker highlighted at a time). Rather than bolting a table view onto the map feature or
teaching the shared, resource-agnostic map primitives about multi-select, this plan adds a
**dock-scoped "Select docks" mode**, entered through a new `selecting=docks` search param on the
existing `/checkpoints` route, following the same param-driven mode pattern already used by
`create` and `edit`. While active, dock markers become toggleable (a `checked` prop on
`CheckpointMarker`, additive to its existing single-`selected` prop), weighing-area markers and the
details sheet keep behaving as they do today, and a bottom action bar — `BulkArchiveDocksActions`,
the archive-only counterpart of `BulkLifecycleActions` — appears once at least one dock is checked.

## Technical Context

**Language/Version**: TypeScript (apps/web: React 19 via TanStack Start; apps/api: AdonisJS on
Node.js)

**Primary Dependencies**: TanStack Router/Query (`useDockMutations`, `tuyauQuery`), `@tuyau/react-query`
(typed client, route names generate response types), `sonner`; Radix-based `AlertDialog`/`Field`
primitives (already used by `bulk-lifecycle-actions.tsx` and `lifecycle-actions.tsx`); backend:
AdonisJS, VineJS, Lucid, Bouncer, Luxon (all pre-existing; individual-archive backend files are
read-only references, bulk backend files are new following the Customer bulk-archive shape)

**Storage**: PostgreSQL via the existing `docks` table — no migration, no schema change. Bulk
archive uses `SELECT … FOR UPDATE` inside one transaction, exactly as
`LucidCustomerRepository.archiveAvailableMany` does.

**Testing**: Vitest + Testing Library + MSW for `apps/web`; Japa for `apps/api` — new integration
specs under `apps/api/tests/integration/docks/lifecycle/{archive,bulk/archive}.spec.ts` and unit
specs under `apps/api/tests/unit/docks/lifecycle/`, mirroring the Customer lifecycle test layout;
new component tests under `apps/web/src/features/docks/__tests__/archive/` and
`apps/web/src/features/checkpoints/__tests__/bulk-archive/`

**Target Platform**: Web application (desktop and tablet browsers)

**Project Type**: Web application monorepo (`apps/api` + `apps/web`), extending an existing feature
area

**Performance Goals**: Archived status visible in consultation within 2 seconds of a successful
save (SC-001); a 100-identifier bulk archive completes within 5 seconds in the acceptance
environment (SC-009), matching the row-locked bulk `UPDATE … WHERE id IN (…)` shape already proven
for customers at that scale

**Constraints**: Must reuse the existing `/checkpoints` route, its `checkpoint=<kind>:<id>`
selection contract, and `CheckpointMap`/`CheckpointMarker` rather than introducing a second
dock-consultation surface (e.g. a table page); must not change the public surface of the
resource-agnostic `resource-map-placement.tsx` / `resource-map-workspace.tsx` primitives (docks
today, weighing areas and warehouses later); must not modify the individual-archive production
backend files, which are already correct and already tested; bulk archive and multi-select mode
must stay scoped to Dock — this issue does not add bulk operations for any other site reference or
a bulk *reactivate* for docks (#201's scope)

**Scale/Scope**: One new bulk API surface (route, validator, use case, repository method,
controller method) sized identically to the existing Customer bulk-archive surface; one new UI mode
in one existing feature area; one small shared-validator extraction; no new persisted entity, no
data migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Selected feature intent is versioned** — PASS. This spec was created from issue #200,
  selected off the Docks roadmap (#190). Not speculative bulk expansion.
- **II. One independently deliverable feature per spec** — PASS. Scope is exactly "archive one dock,
  or archive a selection of docks" end-to-end (entry point → API → visible archived result).
  Reactivate (#201), list (#197), create (#198), and update (#199) stay out, as does bulk support
  for any other site reference (spec FR-020). The individual and multiple paths are delivered
  together, as the issue's delivery boundary requires, because they share every rule, exception,
  and UI affordance — splitting them would just duplicate the eligibility check twice.
- **III. Vanilla Spec Kit gates** — PASS. No repository-owned delivery state machine introduced.
- **IV. Test-first observable behavior** — PASS with a scope note, symmetric with #199's. The
  individual-archive *implementation* already exists and is already tested (unit +
  integration) — that surface needs no new RED tests, only frontend RED→GREEN tests for the newly
  wired mutation and UI. The bulk surface is entirely new at every layer and is fully RED→GREEN,
  written before it is run.
- **V. Deep boundaries and explicit contracts** — PASS. `ArchiveDocksUseCase` owns the business
  decision (delegates eligibility to the repository + usage checker, exactly like
  `ArchiveCustomersUseCase`); `LucidDockRepository.archiveAvailableMany` owns persistence and
  locking; `DocksController.archiveMany` owns HTTP adaptation; `BulkArchiveDocksActions` owns
  transport-to-view translation. No layer is shortcut.
- **VI. Durable knowledge has a home** — PASS. The `distinctUuids` rule and the `ids`/`comment`
  bulk-lifecycle schema factory move from `customer_validator.ts` (where they are currently
  duplicated in spirit, one-off) into `site_reference_validator.ts`, their actual home, so a third
  site reference adopting bulk lifecycle actions later does not duplicate them a second time. This
  is recorded as decision D2 in `research.md` rather than left as an implicit side effect.
- **VII. Verification is part of delivery** — Deferred to implementation/verification phases.
- **VIII. One workflow owner** — PASS. Artifacts stay inside Spec Kit.

No violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/operational-checkpoints/docks/archive-docks/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── dock-archive-api.md
│   └── dock-archive-ui-state.md
├── checklists/
│   └── requirements.md  # /speckit-specify output
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/
├── app/site_references/shared/
│   └── site_reference_validator.ts        # MODIFIED — add distinctUuids rule + bulkLifecycleIds/bulkLifecycleComment factories
├── app/customers/shared/
│   └── customer_validator.ts              # MODIFIED — consume the extracted factories instead of its local copies (no behavior change)
├── app/docks/
│   ├── archive/
│   │   ├── archive_dock_use_case.ts       # UNCHANGED — already implements every individual FR
│   │   └── archive_docks_use_case.ts      # NEW — thin bulk wrapper, mirrors archive_customers_use_case.ts
│   ├── shared/
│   │   ├── dock_exceptions.ts             # UNCHANGED — DockNotFound/InUse/AlreadyArchived already exist
│   │   ├── dock_lifecycle_blockers.ts     # NEW — mirrors customer_lifecycle_blockers.ts (findBulkBlockers, indexDocksById, orderDocks)
│   │   ├── dock_policy.ts                 # UNCHANGED — `archive` already admin-only, reused for archiveMany
│   │   ├── dock_validator.ts              # MODIFIED — add archiveDocksValidator using the extracted factories
│   │   └── repositories/
│   │       ├── dock_repository.ts         # MODIFIED — add ArchiveDocksCommand, BulkDockLifecycleResult, abstract archiveAvailableMany
│   │       └── lucid_dock_repository.ts   # MODIFIED — implement archiveAvailableMany (forUpdate + usage check + partial update), mirrors archiveAvailableMany on the customer repository
│   └── update/, create/, list/, ...       # UNCHANGED
├── app/controllers/docks_controller.ts    # MODIFIED — add archiveMany, inject ArchiveDocksUseCase
├── start/routes.ts                        # MODIFIED — add `router.post('/archive', [controllers.Docks, 'archiveMany']).as('archive_many')` before the existing `/:id/archive`
└── tests/
    ├── integration/docks/lifecycle/
    │   ├── archive.spec.ts                # NEW — HTTP-level individual archive coverage (currently only unit-level)
    │   └── bulk/archive.spec.ts           # NEW — mirrors tests/integration/customers/lifecycle/bulk/archive.spec.ts
    └── unit/docks/lifecycle/
        └── bulk_archive.spec.ts           # NEW — mirrors the customer bulk-archive use-case unit spec

apps/web/
├── src/features/docks/
│   ├── mutations/use-dock-mutations.ts    # MODIFIED — add `archive` and `archiveMany` mutations + shared invalidation
│   ├── types.ts                           # MODIFIED — add BulkDockLifecycleResult / BulkDockLifecycleBlocker (derived from Route.Response<'docks.archive_many'>)
│   ├── ui/
│   │   ├── dock-details.tsx               # MODIFIED — render DockLifecycleActions in the footer when the dock is Available
│   │   ├── dock-lifecycle-actions.tsx     # NEW — archive-only counterpart of customers/ui/lifecycle-actions.tsx (no reactivate branch; #201's job)
│   │   └── bulk-archive-docks-actions.tsx # NEW — archive-only counterpart of customers/ui/bulk-lifecycle-actions.tsx
│   └── __tests__/archive/                 # NEW — individual archive UI tests (permissions, success, blockers)
├── src/features/checkpoints/
│   ├── checkpoint-selection.ts            # UNCHANGED — single-selection contract untouched; select mode is a parallel, separate param
│   ├── map/
│   │   ├── checkpoint-marker.tsx          # MODIFIED — add optional `checked` prop for the multi-select ring, additive to existing `selected`-driven styling
│   │   └── checkpoint-map.tsx             # MODIFIED — thread `selectMode`/`checkedIds`/`onToggleChecked` down to markers when active
│   ├── ui/
│   │   ├── checkpoint-map-controls.tsx    # MODIFIED — add an admin-only "Select docks" toggle
│   │   └── checkpoints-page.tsx           # MODIFIED — own `selecting` search param, checked-ids state, wiring to BulkArchiveDocksActions
│   └── __tests__/bulk-archive/            # NEW — select-mode component tests
└── src/routes/_authenticated/checkpoints.tsx  # MODIFIED — add `selecting: z.enum(['docks']).optional().catch(undefined)` to the search schema
```

**Structure Decision**: Web application monorepo, already in place. The individual-archive backend
is reused verbatim; the bulk backend is new but copies an already-proven shape (Customer) file for
file, so there is no unnecessary discovery risk. On the frontend, dock-specific work stays in
`apps/web/src/features/docks`, following the `lifecycle-actions.tsx` / `bulk-lifecycle-actions.tsx`
precedent from `apps/web/src/features/customers`. The `apps/web/src/features/checkpoints` changes
are additive: a new mode on the existing map (parallel to `create`/`edit`, not replacing the
existing single-selection `checkpoint` param), a new marker prop, and one new toggle in the
controls. No table/list view is introduced, and no change is made to the resource-agnostic map
primitives' public surface.

**Why not a table view for bulk selection**: Customers use a table because customers have no map
representation. Docks are inherently spatial — the whole point of #197–#199 was to make the map the
canonical dock surface — so introducing a second, list-based dock surface just for bulk archiving
would fragment where an administrator looks for docks and duplicate the search/status filtering
`checkpoint-search.ts` already provides on the map. Multi-select as a map mode keeps one dock
surface, consistent with #199's decision not to build a second map-editing mechanism for the same
reason.

## Complexity Tracking

*No Constitution Check violations were identified. This section intentionally left without
entries.*

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 design (research.md, data-model.md, contracts/, quickstart.md):

- **II. One independently deliverable feature per spec** — Confirmed still PASS. The design adds
  exactly one bulk API surface and one map mode, both scoped to Dock archiving. `quickstart.md`
  scenario 15 is a regression guard proving the existing single-selection view/edit flow from #199
  is unaffected by the new `selecting` param.
- **IV. Test-first observable behavior** — Confirmed still PASS. `quickstart.md` scenarios 1–14 are
  the RED targets `/speckit-tasks` will order; `contracts/dock-archive-api.md` carries a
  requirement-to-test mapping distinguishing "already covered" (individual, unit-level) from "net
  new" (individual HTTP-level, all of bulk).
- **V. Deep boundaries and explicit contracts** — Confirmed still PASS. Two new contracts are
  documented (`dock-archive-api.md` for the HTTP surface, `dock-archive-ui-state.md` for the
  select-mode state machine). Neither crosses a layer boundary; the bulk UI reaches the database
  only through the new typed `docks.archive_many` endpoint, exactly as the individual UI reaches it
  through `docks.archive`.
- **VI. Durable knowledge has a home** — Confirmed still PASS. The validator-extraction decision
  (D2) and the map-mode-vs-table-view decision (D4) are both recorded in `research.md` with
  rationale, so neither is left implicit in a diff.
- No other gate is affected. No new violations to record.
