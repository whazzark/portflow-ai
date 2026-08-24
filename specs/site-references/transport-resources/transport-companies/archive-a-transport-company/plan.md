# Implementation Plan: Archive a Transport Company

**Branch**: `feat/220-archive-transport-company-2` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Last Updated**: 2026-08-24 — bulk archival added to scope

**Input**: Feature specification from `specs/site-references/transport-resources/transport-companies/archive-a-transport-company/spec.md`

## Summary

Add the first lifecycle transition to the delivered transport-company slice: an authorized administrator archives available companies end to end, one at a time or several at once. The API gains two contracts guarded by one new policy ability — `POST /api/v1/transport-companies/:id/archive` and `POST /api/v1/transport-companies/archive` — sharing an optional lifecycle-comment validator, a pair of use cases, and conditional repository writes that only touch rows still in `AVAILABLE` state. The transport-company-specific lifecycle rule — a company cannot be archived while it still provides available trucks — is enforced through one new set-based read on `TruckRepository` that answers for a whole selection at once, and is used identically by both paths. Single archival refuses with a distinct `409`; bulk archival follows the delivered customer partial-success model, archiving every eligible company and returning the blocked ones with an individual reason. The web application adds an archive affordance to the transport-company details panel and a multi-selection toolbar to the directory, both mirroring the delivered customer lifecycle components. No schema change, no migration, and no truck row is written.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js 22 toolchain

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, Bouncer 4, VineJS, Tuyau 1.2, TanStack Start/Router 1.168/1.170, TanStack Query 5.101, React 19.1, Zod 4.4, shadcn/Base UI, Sonner

**Storage**: PostgreSQL in runtime; in-memory SQLite through Lucid for automated API tests. This slice writes only existing `transport_companies` columns and reads only existing `trucks` columns, so both engines are already compatible, including the `forUpdate` row locking used by the bulk write.

**Testing**: Japa 5.3 API unit/integration suites against the real Lucid repositories; Vitest 4.1, Testing Library, and MSW router-level web feature tests

**Target Platform**: Linux-hosted API and server-rendered web application; modern desktop and mobile browsers

**Project Type**: PNPM/Turbo monorepo web application with separate API and web workspaces

**Performance Goals**: A single archival produces a confirmed result or an explicit refusal within 2 seconds for at least 95% of attempts; a 100-company bulk archival completes within 2 seconds in the acceptance environment

**Constraints**: The API stays authoritative for authentication, role authorization, the available-truck lifecycle rule, comment validation, selection validity, and the already-archived guard; eligibility is evaluated at submission time, never from state captured when the dialog opened; identity, name, `createdAt`, and every truck association are preserved; a bulk request never partially archives an individual company; no truck row is created, updated, or archived; no company is ever deleted; no schema change, no new runtime dependency

**Scale/Scope**: One site's low-cardinality reference collection; two new protected POST endpoints, one new policy ability, two new use cases, two new repository writes, one new truck read, one confirmation dialog and one selection toolbar on an existing authenticated route, and their API/web test seams

## Constitution Check

### Pre-design gate

- **I. Selected feature intent is versioned — PASS**: GitHub issue #220 is selected on `feat/220-archive-transport-company-2` and its reviewed `spec.md` is the behavioral contract. The bulk scope change is recorded in the spec and in its checklist rather than carried only in conversation.
- **II. One independently deliverable feature per spec — PASS**: Single and bulk archival are one business outcome — retiring transport companies — expressed at two cardinalities over the same rules, the same authorization, and the same lifecycle metadata. They share the blocking rule, the comment, and the exception vocabulary; splitting them would duplicate all three. Reactivation (#221), including bulk reactivation, and truck archival (#225) stay in their own issues.
- **III. Vanilla Spec Kit gates protect product intent — PASS**: The spec was reviewed before planning and re-validated after the scope change; this plan stops at the human plan-review gate before task generation. The judgment call flagged at specify time — that the available-truck rule subsumes discharge-usage blocking — is restated and justified under the post-design re-evaluation rather than silently applied.
- **IV. Test-first observable behavior — PASS**: API behavior begins with Japa unit and integration specs; web behavior begins with router-level Vitest/MSW feature tests. Each of the seven single outcomes in FR-021 and each blocker reason in FR-027 has a named failing test before implementation, including the all-blocked and mixed-selection cases.
- **V. Deep boundaries and explicit contracts — PASS**: The use cases own the lifecycle decisions and exception mapping, the repositories own the conditional writes, the transactional bulk write, and the availability read, the controller and policy own HTTP adaptation and authorization, Tuyau carries the typed contracts, and the web feature owns dialog, selection, and view adaptation.
- **VI. Durable knowledge has a home — PASS**: The blocking rule is the one already recorded in `CONTEXT.md` under **Transport Company**; this plan implements it rather than restating it as a new decision. The partial-success bulk model is the delivered customer contract, not a new cross-cutting decision. No new ADR is required.
- **VII. Verification is part of delivery — PASS**: The quickstart defines focused API/web checks, the repository-wide `pnpm check`, `pnpm typecheck`, `pnpm test`, and the affected browser flow.
- **VIII. One workflow owner — PASS**: Spec Kit artifacts stay in this feature directory; no parallel delivery-state mechanism is added.

### Post-design re-evaluation

**PASS**. The data model, HTTP contracts, and validation guide preserve every pre-design gate.

Six design points deserve to be stated explicitly rather than buried:

- **No discharge-usage check is added for transport companies.** `SiteReferenceUsageChecker` has no `TRANSPORT_COMPANY` kind, and this slice does not add one. A truck reserved by a planned or active discharge is necessarily `AVAILABLE`, so the available-truck rule already refuses every company whose trucks are operationally engaged. Adding a second, weaker check would create two rules that can disagree. This is the specify-time judgment call, and it is now a design commitment: if a future slice allows an archived truck to be reserved, the rule must be revisited.
- **The transport-company use cases read `TruckRepository`.** This is a cross-slice repository dependency, and it is the mirror of the delivered `CreateTruckUseCase`, which already injects `TransportCompanyRepository` to validate a truck's provider. The rule is a transport-company rule, so it belongs to the transport-company use cases; only the data it needs lives in the truck slice.
- **The truck read is set-based from the start, and the single path uses it too.** Bulk archival makes the set shape necessary, and having the single use case call it with a one-element list is exactly how `ArchiveCustomerUseCase` already calls `findUsedByPlannedOrActiveDischarge`. One rule, one query shape, one place to be wrong. This reverses the YAGNI rejection recorded before bulk entered scope; [research.md](./research.md) Decision 2 states why.
- **Bulk archival is a partial success, not an atomic all-or-nothing.** The request returns `200` with archived and blocked collections. This is the delivered customer contract, and it is the right one: a selection is an administrator's convenience, not a business transaction, and failing forty archivals because one company gained a truck would be hostile. Atomicity holds where it matters — per company, inside one database transaction (FR-030).
- **A residual create-truck race is accepted.** Archiving reads truck availability and then writes the company; creating a truck reads company availability and then writes the truck. Two concurrent operations can therefore leave one available truck under a freshly archived company. The bulk path narrows but does not close this: it locks the company rows it archives, but truck creation never reads a company under that lock. This is the same shape as the accepted read-then-write window in the delivered customer, dock, and weighing-area archive journeys; it is recorded in [research.md](./research.md) rather than half-fixed here.
- **Until truck archival (#225) exists, a company that has any truck cannot be archived.** That is the rule working as specified, not a defect. It also shapes what bulk archival is realistically useful for today — cleaning up companies that never received trucks — and the seeded dataset keeps both outcomes demonstrable.

No constitution exception requires complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/transport-resources/transport-companies/archive-a-transport-company/
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
│   │   └── transport_companies_controller.ts                    # add archive + archiveMany
│   ├── site_references/shared/
│   │   └── site_reference_validator.ts                          # hoist lifecycleComment + lifecycleIds
│   ├── transport_companies/
│   │   ├── archive/
│   │   │   ├── archive_transport_company_use_case.ts            # new
│   │   │   └── archive_transport_companies_use_case.ts          # new
│   │   └── shared/
│   │       ├── repositories/
│   │       │   ├── transport_company_repository.ts              # add archiveAvailable(+Many) + result types
│   │       │   └── lucid_transport_company_repository.ts
│   │       ├── transport_company_exceptions.ts                  # add two lifecycle exceptions
│   │       ├── transport_company_lifecycle_blockers.ts          # new
│   │       ├── transport_company_policy.ts                      # add archive ability
│   │       └── transport_company_validator.ts                   # add archive validators
│   └── trucks/shared/repositories/
│       ├── truck_repository.ts                                  # add findCompanyIdsWithAvailableTrucks
│       └── lucid_truck_repository.ts
├── start/
│   └── routes.ts                                                # add POST /archive and POST /:id/archive
└── tests/
    ├── integration/transport_companies/lifecycle/
    │   ├── archive.spec.ts                                      # new
    │   └── bulk/archive.spec.ts                                 # new
    └── unit/transport_companies/lifecycle/
        ├── archive.spec.ts                                      # new
        └── bulk/archive.spec.ts                                 # new

apps/web/
└── src/features/
    ├── transport-companies/
    │   ├── __tests__/
    │   │   ├── administration/permissions.test.tsx              # extend with archive affordances
    │   │   ├── lifecycle/archive.test.tsx                       # new
    │   │   ├── lifecycle/bulk-archive.test.tsx                  # new
    │   │   └── support/test-helpers.ts                          # add archive interception helpers
    │   ├── mutations/use-transport-company-mutations.ts         # add archive + archiveMany
    │   ├── types.ts                                             # add bulk result/blocker types
    │   └── ui/
    │       ├── transport-company-lifecycle-actions.tsx          # new single confirmation dialog
    │       ├── bulk-transport-company-lifecycle-actions.tsx     # new selection toolbar + dialog
    │       ├── transport-company-details.tsx                    # add guarded archive affordance
    │       ├── transport-company-list.tsx                       # add optional selection checkboxes
    │       └── transport-company-section.tsx                    # pass selection through
    └── transport-resources/ui/
        └── transport-resources-workspace.tsx                    # own selection + blocked state, wire both paths
```

**Structure Decision**: Extend the existing two-workspace vertical-slice architecture in place. The API adds an `archive/` workflow directory holding both use cases, beside the delivered `create/`, `list/`, `available/`, and `update/` directories — exactly how `apps/api/app/customers/archive/` already holds `archive_customer_use_case.ts` and `archive_customers_use_case.ts`. The shared validator, exceptions, policy, and repository grow to serve both cardinalities, and one new module, `transport_company_lifecycle_blockers.ts`, holds the per-company blocking decision so the same rule is evaluated identically by both paths.

The web side keeps the transport-company master-detail panel established by #217. Single archival joins the details footer next to the delivered edit affordance, matching `features/customers/ui/lifecycle-actions.tsx`. Bulk archival adds a floating selection toolbar matching `features/customers/ui/bulk-lifecycle-actions.tsx`, fed by leading checkboxes that `TransportCompanyList` renders **only** when a selection handler is passed — which the workspace does only for administrators, and only on the Available tab. That gating matters: it keeps the observer's directory untouched, and it avoids inventing an answer to "what does bulk-archive mean on the Archived tab" before #221 defines bulk reactivation.

Multi-selection is deliberately kept separate from the existing single `transportCompanyId` selection, which scopes the embedded trucks panel: a row's checkbox joins the archive selection, a row's body still scopes the trucks panel, and neither clears the other (FR-034).

Neither dialog is modelled as a `companyDetailsMode` search param. Unlike edit and create, a half-open confirmation is not a state worth restoring from a URL, and a selection restored from a URL would be a selection the administrator never made.

No migration is part of this slice: `status`, `archived_at`, `archived_by_user_id`, and `archive_comment` already exist on `transport_companies`, are already seeded, and are already read by the delivered consultation slice. Generated files — the Tuyau contract and the TanStack route tree — are refreshed by their existing generators, never edited by hand.

## Complexity Tracking

No constitution violations require justification.
