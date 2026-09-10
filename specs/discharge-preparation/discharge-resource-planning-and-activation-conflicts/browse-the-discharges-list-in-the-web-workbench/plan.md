# Implementation Plan: Browse the Discharges List in the Web Workbench

**Branch**: `whazzark/browse-the-discharges-list-in-the-web-workbench` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/browse-the-discharges-list-in-the-web-workbench/spec.md`

## Summary

Give the site's persisted discharges their first screen. `apps/api` gains a `discharges` vertical
slice — policy, repository, use case, transformer, controller — behind one read contract,
`GET /api/v1/discharges`, that returns every Planned, Active, and Closed discharge with its dock,
its product lots with their customers, and its shift count. `apps/web` gains a `discharges` feature
and an `/discharges` route that preloads the typed Tuyau query, derives the three status
collections and their counts from that single read, and keeps the selected status and the search in
validated URL state. The existing `Operations → Discharges` sidebar entry, which today has no
destination, receives one.

The slice is read-only and its rows are inert: no discharge is opened, selected, or mutated here.
Consultation is open to every active authenticated user in every role, so no role-conditional
payload or second collection endpoint is needed — the one contract serves everyone.

## Technical Context

**Language/Version**: TypeScript on the repository's Node.js ESM runtime (`apps/api` AdonisJS,
`apps/web` TanStack Start)

**Primary Dependencies**: AdonisJS 7, Lucid, Bouncer, Tuyau 1.2, TanStack Start/Router/Query 5,
React 19, Zod 4, shadcn/Base UI primitives, Tailwind CSS 4

**Storage**: Existing PostgreSQL `discharges`, `product_lots`, `shifts`, `docks`, and `customers`
tables through Lucid, all delivered by GH-236. No migration, no schema change, no seed change.

**Testing**: Japa unit and integration tests (`apps/api`); Vitest with jsdom, Testing Library, and
MSW for the web feature; Playwright e2e is out of this slice's required scope

**Target Platform**: Authenticated responsive web workstation backed by the Node.js API

**Project Type**: PNPM/Turbo monorepo web application (`apps/api` + `apps/web`)

**Performance Goals**: At least 95% of normal successful loads reach the collection or the correct
empty state within 2 seconds for up to 1,000 discharges; switching status and typing a search reuse
the loaded query cache and never refetch

**Constraints**: The API stays authoritative for authorization; every active role reads the same
payload; the collection is unbounded and unpaginated; Active is the default status; counts report
status totals and ignore the search; rows carry no selection affordance and the address carries no
discharge id; no mutation, no detail screen, no activity log, no tonnage

**Scale/Scope**: One API slice with one endpoint, one web feature, one route, three status tabs,
one search across five fields, one navigation entry, and the pending/empty/no-match/error/retry
states for a collection the seeder already populates with 27 discharges

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I — Selected intent**: PASS. Issue #61 is selected, and its clarified `spec.md` is the contract.
  This plan does not expand GH-58 or the mutating slices GH-53 to GH-56.
- **II — Independent delivery**: PASS. The list is one vertical slice — one query in `apps/api`, one
  screen in `apps/web` — implementable, testable, reviewable, and mergeable as one PR without any
  other roadmap slice.
- **III — Human gates**: PASS. The spec was clarified through `/speckit-clarify` before planning.
  This plan requires human review before `/speckit-tasks` and implementation. One spec wording
  ambiguity is escalated rather than silently resolved; see Decision 3 in `research.md`.
- **IV — Test-first behavior**: PASS. Every behavior has an observable seam: policy and ordering as
  API unit tests, authentication/authorization/response shape as Japa integration tests, and tabs,
  counts, search, inert rows, URL state, empty, no-match, loading, error, and retry as web feature
  tests through the real router with MSW.
- **V — Deep boundaries**: PASS. The use case owns the read decision, the repository owns preloading
  and the deterministic base order, the controller owns authorization and transformation, and the
  web feature owns DTO-to-view presentation. No layer is short-circuited.
- **VI — Durable knowledge**: PASS. The vocabulary is already in `CONTEXT.md` (Discharge, Planned /
  Active / Closed Discharge, Product Lot, Customer, Dock, Shift). No new ADR: the slice reuses the
  established read-slice shape rather than introducing an architectural choice.
- **VII — Verification**: PASS. `quickstart.md` lists the targeted suites plus repository-wide
  `pnpm check`, `pnpm typecheck`, and `pnpm test`, and a manual browser pass over the three tabs.
- **VIII — One workflow owner**: PASS. No delivery state machine, Project field, or orchestrator is
  introduced.

**Post-design re-check**: PASS. Phase 1 adds one endpoint, no table, no cross-feature dependency,
and no authorization bypass. The single unbounded collection is a deliberate, recorded decision
bounded by the spec's 1,000-discharge scale assumption, not an unexamined default.

## Project Structure

### Documentation (this feature)

```text
specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/browse-the-discharges-list-in-the-web-workbench/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── discharges.openapi.yaml
│   └── ui-state.md
├── checklists/requirements.md
└── tasks.md             # Created later by /speckit-tasks, not by this plan
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/discharges_controller.ts          # new
│   ├── discharges/
│   │   ├── list/list_discharges_use_case.ts          # new
│   │   └── shared/
│   │       ├── discharge_policy.ts                   # new
│   │       ├── discharge_transformer.ts              # new
│   │       └── repositories/
│   │           ├── discharge_repository.ts           # new abstraction
│   │           ├── lucid_discharge_repository.ts     # new implementation
│   │           ├── discharge_usage_repository.ts     # existing, untouched
│   │           └── lucid_discharge_usage_repository.ts
│   └── models/{discharge,product_lot,shift,dock,customer}.ts   # existing, untouched
├── providers/repositories_provider.ts                # bind DischargeRepository
├── package.json                                      # add "#discharges/*" import alias
├── start/routes.ts                                   # add the /discharges group
└── tests/
    ├── unit/discharges/consultation/{list,ordering,scale}.spec.ts
    └── integration/discharges/consultation/list.spec.ts

apps/web/src/
├── components/layout/app-sidebar.tsx                 # give Discharges its href
├── features/discharges/
│   ├── types.ts
│   ├── queries/discharge-queries.ts
│   ├── discharge-search.ts                           # pure matcher
│   ├── discharge-collections.ts                      # pure grouping, counts, ordering
│   ├── ui/
│   │   ├── discharges-page.tsx
│   │   ├── discharge-list.tsx
│   │   ├── discharges-pending.tsx
│   │   └── discharges-error.tsx
│   └── __tests__/
│       ├── support/{fixtures.ts,test-helpers.ts}
│       ├── list/{status-tabs,search,ordering}.test.tsx
│       ├── access/authorization.test.tsx
│       ├── url/state.test.tsx
│       └── feedback/{states,retry}.test.tsx
└── routes/_authenticated/discharges.tsx              # new
```

**Structure Decision**: Follow the delivered read-slice shape exactly rather than inventing one.
On the API, `app/discharges/` already exists but holds only the shared usage repository consumed by
site-reference archival rules; this slice adds the `list/` workflow and the `shared/` policy,
transformer, and discharge repository beside it, leaving the usage repository untouched. Because
`#discharges/*` is missing from the `apps/api/package.json` import map — the two existing files are
reached by relative path from `providers/repositories_provider.ts` — the alias is added first so the
new slice imports like every other domain. Adding the controller and the route group regenerates
`.adonisjs/server/controllers.ts` and the Tuyau registry, which is what makes the typed query
available to the web.

On the web, `features/discharges/` owns everything: the Tuyau query, the DTO type, the pure grouping
and search helpers, and the presentation. The route file stays thin, holding only the Zod search
schema, the loader, and the pending and error components, per `apps/web/AGENTS.md`. Status tabs are
the directory convention, so the page uses `Tabs` with a count on each trigger and `InputSearch` for
the search, and renders `Empty` for an empty collection without offering a create action, since this
slice creates nothing. Rows are plain table rows with no `onSelect`, no hover affordance, and no
`dischargeId` in the schema — the deliberate departure from every other directory, required by
FR-024 and reversed by GH-58.
