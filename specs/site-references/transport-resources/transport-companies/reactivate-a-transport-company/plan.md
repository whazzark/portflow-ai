# Implementation Plan: Reactivate a Transport Company

**Branch**: `feat/221-reactivate-transport-company` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/transport-resources/transport-companies/reactivate-a-transport-company/spec.md`

## Summary

Close the transport-company lifecycle loop opened by #220: an authorized administrator restores archived companies end to end, one at a time or several at once. The API gains two contracts guarded by one new policy ability — `POST /api/v1/transport-companies/:id/reactivate` and `POST /api/v1/transport-companies/reactivate` — reusing the shared lifecycle-comment and selection validators, adding a pair of use cases and two conditional repository writes that only touch rows still in `ARCHIVED` state.

The defining property of this slice is what it does **not** add. Reactivation has no blocking lifecycle rule: the available-truck rule constrains archiving a company, never restoring one, so the reactivation path issues no truck read at all and its outcome vocabulary is two reasons (`ALREADY_AVAILABLE`, `NOT_FOUND`) rather than the archival path's three. The archive slice's `findBulkArchiveBlockers` is generalised into the status-parameterised `findBulkBlockers` it anticipated, so one partition rule serves both directions.

The web application makes both delivered lifecycle components direction-aware rather than adding parallel reactivate components: the details footer offers **Reactivate company** on an archived company, and the selection toolbar — today rendered only on the Available tab — is rendered on both tabs with its action derived from the active tab. No schema change, no migration, and no truck row is read or written.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js 22 toolchain

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, Bouncer 4, VineJS, Tuyau 1.2, TanStack Start/Router 1.168/1.170, TanStack Query 5.101, React 19.1, shadcn/Base UI, Sonner

**Storage**: PostgreSQL in runtime; in-memory SQLite through Lucid for automated API tests. This slice writes only existing `transport_companies` columns, so both engines are already compatible, including the `forUpdate` row locking used by the bulk write.

**Testing**: Japa 5.3 API unit/integration suites against the real Lucid repositories; Vitest 4.1, Testing Library, and MSW router-level web feature tests

**Target Platform**: Linux-hosted API and server-rendered web application; modern desktop and mobile browsers

**Project Type**: PNPM/Turbo monorepo web application with separate API and web workspaces

**Performance Goals**: A single reactivation produces a confirmed result or an explicit refusal within 2 seconds for at least 95% of attempts; a 100-company bulk reactivation completes within 2 seconds in the acceptance environment

**Constraints**: The API stays authoritative for authentication, role authorization, comment validation, selection validity, and the already-available guard; eligibility is evaluated at submission time, never from state captured when the dialog opened; identity, name, `createdAt`, and the most recent archival context are preserved; a bulk request never partially reactivates an individual company; no truck row is read for writing or modified, and in particular no truck is reactivated; no company is ever deleted; no schema change, no new runtime dependency

**Scale/Scope**: One site's low-cardinality reference collection; two new protected POST endpoints, one new policy ability, two new use cases, two new repository writes, one new exception, one generalised blocker module, two direction-aware web components on an existing authenticated route, and their API/web test seams

## Constitution Check

### Pre-design gate

- **I. Selected feature intent is versioned — PASS**: GitHub issue #221 is selected on `feat/221-reactivate-transport-company` and its reviewed `spec.md` is the behavioral contract. The three judgment calls flagged at specify time — no blocking rule, no name conflict, trucks untouched — are recorded in the spec's Assumptions, not carried only in conversation.
- **II. One independently deliverable feature per spec — PASS**: Single and bulk reactivation are one business outcome — restoring transport companies — expressed at two cardinalities over the same rules, authorization, and lifecycle metadata. They share the comment rule, the guard order, and the outcome vocabulary; splitting them would duplicate all three, and the archive slice already established the pair. Truck reactivation stays in its own issue.
- **III. Vanilla Spec Kit gates protect product intent — PASS**: The spec was reviewed before planning; this plan stops at the human plan-review gate before task generation. The asymmetry with archival — that reactivation deliberately has no blocker — is restated and justified under the post-design re-evaluation rather than silently applied.
- **IV. Test-first observable behavior — PASS**: API behavior begins with Japa unit and integration specs; web behavior begins with router-level Vitest/MSW feature tests. Each of the six single outcomes in FR-019 and each blocker reason in FR-025 has a named failing test before implementation, including the all-blocked, mixed-selection, and second-reactivation cases.
- **V. Deep boundaries and explicit contracts — PASS**: The use cases own the lifecycle decisions and exception mapping, the repositories own the conditional writes and the transactional bulk write, the controller and policy own HTTP adaptation and authorization, Tuyau carries the typed contracts, and the web feature owns dialog, selection, and view adaptation.
- **VI. Durable knowledge has a home — PASS**: Reactivation semantics are the `CONTEXT.md` definition of **Site Reference Reactivation**; this plan implements it rather than restating it as a new decision. The partial-success bulk model is the delivered customer and transport-company contract. No new ADR is required.
- **VII. Verification is part of delivery — PASS**: The quickstart defines focused API/web checks, the repository-wide `pnpm check`, `pnpm typecheck`, `pnpm test`, and the affected browser flow.
- **VIII. One workflow owner — PASS**: Spec Kit artifacts stay in this feature directory; no parallel delivery-state mechanism is added.

### Post-design re-evaluation

**PASS**. The data model, HTTP contracts, and validation guide preserve every pre-design gate.

Six design points deserve to be stated explicitly rather than buried:

- **The reactivation path performs no truck read.** This is the deliberate asymmetry with #220, and the single most important thing a reviewer should either accept or challenge now. `CONTEXT.md` states the rule as "It cannot be archived while it still provides available trucks" — a constraint on leaving `AVAILABLE`, not on returning to it. A company with zero available trucks is exactly the company archival produces, so requiring trucks in order to restore one would make every archival irreversible. `ReactivateTransportCompanyUseCase` therefore never injects `TruckRepository`, and its bulk sibling passes an empty blocker set. See [research.md](./research.md) Decision 3.
- **Reactivating a company deliberately leaves an available company with no available truck.** That is a legitimate, expected state, not a defect: the administrator restores the provider first and its trucks separately, through the truck lifecycle. The interface must not imply otherwise.
- **`findBulkArchiveBlockers` is generalised, exactly as #220 planned.** Its research Decision 12 recorded that a status parameter and an `ALREADY_AVAILABLE` reason were deliberately withheld until a second caller existed. This slice is that caller. The cost is that `BulkTransportCompanyLifecycleBlocker['reason']` widens to four members, so each endpoint's serialized type admits one or two reasons it can never produce — the same trade-off the delivered customer contract already accepted, and the reason the web layer keeps one blocker-reason formatter instead of two. See [research.md](./research.md) Decision 2.
- **Single reactivation needs no transaction, unlike single archival.** Archival locks the company row `forUpdate` because it must read `trucks` and write `transport_companies` atomically. Reactivation reads nothing else, so `UPDATE … WHERE id = ? AND status = 'ARCHIVED'` is atomic on its own and is what makes spec edge case 3 true. Adding a lock would be ceremony that serializes nothing. See [research.md](./research.md) Decision 5.
- **"Retry the blocked companies" is honest but nearly inert for reactivation.** FR-031 is inherited from the archival contract, where `HAS_AVAILABLE_TRUCKS` is genuinely recoverable. Neither reactivation blocker is: `ALREADY_AVAILABLE` means the company is already in the requested state, and `NOT_FOUND` means it is gone. The selection is still narrowed to the blocked companies so the requirement holds literally and the reasons stay on screen, but the retry that actually matters here is the whole-request failure, where the selection is preserved untouched. See [research.md](./research.md) Decision 10.
- **No name-conflict refusal exists, and a test proves it.** The `transport_companies_name_unique` index spans both lifecycle states, so an archived company's name cannot be taken while it is away. This is what makes reactivation total; it is asserted in the integration suite rather than left as a comment, because the day someone makes that index partial, this slice must fail loudly. See [research.md](./research.md) Decision 4.

No constitution exception requires complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/transport-resources/transport-companies/reactivate-a-transport-company/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── http-api.md
└── tasks.md              # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/
│   │   └── transport_companies_controller.ts                    # add reactivate + reactivateMany
│   ├── transport_companies/
│   │   ├── reactivate/
│   │   │   ├── reactivate_transport_company_use_case.ts         # new
│   │   │   └── reactivate_transport_companies_use_case.ts       # new
│   │   └── shared/
│   │       ├── repositories/
│   │       │   ├── transport_company_repository.ts              # add reactivateArchived(+Many) + result types
│   │       │   └── lucid_transport_company_repository.ts
│   │       ├── transport_company_exceptions.ts                  # add TransportCompanyAlreadyAvailableException
│   │       ├── transport_company_lifecycle_blockers.ts          # generalise to findBulkBlockers(expectedStatus)
│   │       ├── transport_company_policy.ts                      # add reactivate ability
│   │       └── transport_company_validator.ts                   # add reactivate validators
├── start/
│   └── routes.ts                                                # add POST /reactivate and POST /:id/reactivate
└── tests/
    ├── integration/transport_companies/lifecycle/
    │   ├── reactivate.spec.ts                                   # new
    │   └── bulk/reactivate.spec.ts                              # new
    └── unit/transport_companies/lifecycle/
        ├── reactivate.spec.ts                                   # new
        ├── bulk/reactivate.spec.ts                              # new
        └── bulk/blockers.spec.ts                                # extend for the ARCHIVED expectation

apps/web/
└── src/features/
    ├── transport-companies/
    │   ├── __tests__/
    │   │   ├── administration/permissions.test.tsx              # extend with reactivate affordances
    │   │   ├── lifecycle/reactivate.test.tsx                    # new
    │   │   ├── lifecycle/bulk-reactivate.test.tsx               # new
    │   │   └── support/test-helpers.ts                          # add reactivation interception helpers
    │   ├── mutations/use-transport-company-mutations.ts         # add reactivate + reactivateMany
    │   ├── types.ts                                             # bulk result type spans both directions
    │   └── ui/
    │       ├── transport-company-lifecycle-actions.tsx          # direction-aware (archive | reactivate)
    │       ├── bulk-transport-company-lifecycle-actions.tsx     # direction-aware + ALREADY_AVAILABLE label
    │       └── transport-company-details.tsx                    # footer for archived companies
    └── transport-resources/ui/
        └── transport-resources-workspace.tsx                    # selection + toolbar on both tabs
```

**Structure Decision**: Extend the existing two-workspace vertical-slice architecture in place. The API adds a `reactivate/` workflow directory holding both use cases, beside the delivered `create/`, `list/`, `available/`, `update/`, and `archive/` directories — exactly how `apps/api/app/customers/reactivate/` already holds `reactivate_customer_use_case.ts` and `reactivate_customers_use_case.ts`. The shared validator, exceptions, policy, blockers module, and repository grow to serve both lifecycle directions, and `transport_company_lifecycle_blockers.ts` becomes status-parameterised so one partition rule answers for both.

The web side adds **no new component**. Both delivered lifecycle components already own a comment, a confirmation dialog, and an outcome; each gains a direction rather than a twin, mirroring `features/customers/ui/lifecycle-actions.tsx` and `bulk-lifecycle-actions.tsx`, which have been direction-aware since customers shipped both transitions. Two gates open as a result:

- `TransportCompanyDetails` renders its footer for an administrator whatever the company's status, with **Edit company** + **Archive company** on an available company and **Reactivate company** alone on an archived one. Edit stays absent by design — the update slice refuses archived companies with `409 E_TRANSPORT_COMPANY_ARCHIVED`, and offering a form that cannot save would be worse than offering nothing.
- The selection checkboxes and the bulk toolbar are rendered on both lifecycle tabs instead of only the Available one, with the direction derived from `companyStatus`. `TransportCompanyList` already renders checkboxes only when the handlers are passed, so this is a workspace-level change: the Archived tab simply starts receiving the props the Available tab already gets. The archive plan deliberately withheld this pending "#221 defines bulk reactivation"; it now does.

One type change follows from the bulk endpoint pair. `BulkTransportCompanyLifecycleResult` is currently derived from `Route.Response<'transport_companies.archive_many'>` alone; once one component submits either direction, anchoring the shared type to one of the two endpoints is arbitrary and silently wrong the day they diverge. It becomes the union of both route responses, and `BulkTransportCompanyLifecycleBlocker` keeps deriving from it by indexed access, which distributes over that union. Today the two responses are structurally identical — same partition, same widened reason union — so the union collapses to one shape and nothing downstream narrows; if a later slice makes them differ, the bulk component fails typecheck instead of mistyping one path.

Multi-selection remains distinct from the single `transportCompanyId` selection that scopes the embedded trucks panel, and is still cleared when the lifecycle tab changes (FR-032). Neither dialog is modelled as a `companyDetailsMode` search param, for the reasons the archive plan recorded.

No migration is part of this slice: `status`, `reactivated_at`, `reactivated_by_user_id`, and `reactivation_comment` already exist on `transport_companies`, are already seeded, and are already read by the delivered consultation and details views. Generated files — the Tuyau contract and the TanStack route tree — are refreshed by their existing generators, never edited by hand.

## Complexity Tracking

No constitution violations require justification.
