# Implementation Plan: Archive a Truck

**Branch**: `feat/225-archive-truck` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/transport-resources/trucks/archive-a-truck/spec.md`

## Summary

Add the first truck lifecycle mutation: let an active organization administrator or operations
administrator archive an available truck that no planned or active discharge still reserves —
individually, or for several selected trucks in one action — while preserving each truck's identity,
attributes, transport-company relationship, and earlier lifecycle history. The API adds two
endpoints, `POST /api/v1/trucks/:id/archive` and `POST /api/v1/trucks/archive`, backed by an
`archive` use-case directory and four new repository methods on the existing `Truck` model and
`trucks` table. Eligibility reuses two mechanisms that already exist and need no new persistence
work: the shared `SiteReferenceUsageChecker`, whose `LucidDischargeUsageRepository` already resolves
`'TRUCK'` against unreleased `discharge_truck_assignments` on planned or active discharges (`#240`),
and a status-guarded conditional `UPDATE` that makes concurrent archival attempts collapse to
exactly one recorded archival without application-level locking. The multiple path wraps that same
update in one transaction with `forUpdate` row locks and returns a partial-success outcome pairing
archived trucks with per-truck blocking reasons, exactly as customer lifecycle already does. The
existing `/transport-resources` workspace gains an administrator-only archive action in the truck
details panel plus a new multi-selection model and bulk action bar in the truck directory, reusing
the Customer lifecycle dialog and bulk-toolbar patterns, so archived trucks immediately leave the
available collection and appear in the archived collection built by List Trucks (`#222`).

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js 22 toolchain

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, VineJS, Bouncer 4, Tuyau 1.2, TanStack Start/Router 1.168/1.170, TanStack Query 5.101, React 19.1, shadcn/Base UI, Luxon

**Storage**: PostgreSQL in runtime; in-memory SQLite through Lucid for automated API tests. No schema change: the `trucks` table already carries `status`, `archived_at`, `archived_by_user_id`, and `archive_comment` from List Trucks (`#222`), and `discharge_truck_assignments` already carries `released_at` from `#236`

**Testing**: Japa 5.3 API unit/integration suites; Vitest 4.1, Testing Library, and MSW web feature tests

**Target Platform**: Linux-hosted API and server-rendered web application; modern desktop and mobile browsers

**Project Type**: PNPM/Turbo monorepo web application with separate API and web workspaces

**Performance Goals**: At least 90% of representative authorized administrators archive an intended truck, or understand why they cannot, within 45 seconds of opening it (SC-007); archival itself is one indexed conditional `UPDATE` plus one bounded usage query over a single identifier, with no scale concern beyond the 1,000-truck dataset already validated by List Trucks (`#222`)

**Constraints**: API remains authoritative for authentication, role-based archive authorization, and the in-use eligibility rule; repeated or near-simultaneous archival of the same truck must record exactly one archival, achieved through a status-guarded conditional update rather than a new locking mechanism; a multiple archival must be all-or-nothing over its eligible subset while still reporting per-truck reasons for the rest, which forces one transaction with `forUpdate` locks rather than a loop over the single-archive path; usage must be assessed at submission time, not at the time the trucks were listed or selected; no new table, column, dependency, or usage-rule implementation is introduced; a refused archival must leave the row byte-for-byte unchanged

**Scale/Scope**: Two new protected endpoints (`POST /api/v1/trucks/:id/archive`, `POST /api/v1/trucks/archive`); one new API archive slice (two use cases, four repository methods, a truck lifecycle-blockers module, two validator entries, three exceptions, one policy method); two shared validator helpers extracted to their existing site-reference home; on the web, a new lifecycle dialog, a new multi-selection model and bulk action bar in the truck directory, and `archive`/`archiveMany` mutations; reactivation (`#226`), update (`#224`), and permanent deletion remain out of scope

## Constitution Check

### Pre-design gate

- **I. Selected feature intent is versioned — PASS**: GitHub issue #225 is selected on `feat/225-archive-truck`, and the reviewed `spec.md` is the behavioral contract.
- **II. One independently deliverable feature per spec — PASS**: Authorization, validation, eligibility, persistence, and interface for archiving trucks — one at a time or several at once — form one mergeable outcome around a single business decision ("may this truck be archived?"). Multiple archival adds no new rule, only a new way to invoke the same one, so it does not make this two features. Reactivation (`#226`) is a separate slice that depends on this one; update (`#224`) is independent.
- **III. Vanilla Spec Kit gates protect product intent — PASS**: The spec carries no `[NEEDS CLARIFICATION]` markers. The one material scope question — whether multiple archival belongs to this slice — was raised explicitly rather than silently decided, and the product owner's answer (include it) is recorded in the spec's assumptions and checklist notes. This plan proceeds to the required human plan-review gate before task generation.
- **IV. Test-first observable behavior — PASS**: API behavior starts with Japa tests (`tests/{unit,integration}/trucks/lifecycle/archive.spec.ts` and `.../lifecycle/bulk/archive.spec.ts`) against real Lucid persistence, and web behavior with router-level Vitest/MSW feature tests (`features/trucks/__tests__/lifecycle/archive.test.tsx`, `__tests__/bulk/*.test.tsx`, `__tests__/selection/selection.test.tsx`), before implementation.
- **V. Deep boundaries and explicit contracts — PASS**: `ArchiveTruckUseCase` owns the single-truck business decisions (exists, not already archived, not in use), `ArchiveTrucksUseCase` owns the multiple-archival intent, `truck_lifecycle_blockers.ts` owns the pure eligibility-classification rules, `LucidTruckRepository` owns the conditional-update and transaction mechanics, `TrucksController#archive`/`#archiveMany` own HTTP adaptation, and Tuyau carries the typed contract to the web adapter — the exact layering already reviewed for `ArchiveCustomerUseCase`/`ArchiveCustomersUseCase`.
- **VI. Durable knowledge has a home — PASS**: The in-use rule is consumed from the existing shared `SiteReferenceUsageChecker` rather than reimplemented for trucks, and the lifecycle-comment and lifecycle-ids validation rules are moved to the existing `site_references/shared` home instead of being duplicated a second time. The one deliberate structural repetition — a truck-local `truck_lifecycle_blockers.ts` mirroring the customer one — is justified in research.md as code shape rather than a duplicated canonical decision, since the underlying eligibility rule has exactly one owner. No new vocabulary or ADR is required.
- **VII. Verification is part of delivery — PASS**: The quickstart defines focused API/web checks, the full repository gates, and the affected desktop/mobile browser flow required before merge.
- **VIII. One workflow owner — PASS**: Spec Kit artifacts stay in this feature directory; GitHub Project continues to own operational status.

### Post-design re-evaluation

**PASS**. The data model and HTTP contract confirm this slice writes only lifecycle columns that
already exist and introduces no schema migration, for both the single and the multiple path. The one
cross-feature touch — extracting `lifecycleComment()` and `lifecycleIds()` from
`customer_validator.ts` into the shared site-reference validator — removes duplication rather than
adding coupling, and leaves customer behavior byte-for-byte identical. The in-use decision is
consumed from the existing shared checker for both paths, so trucks and customers cannot drift into
two interpretations of the same persisted discharge state, and single and multiple archival cannot
drift from each other.

Adding multiple archival roughly doubles the slice, and the honest majority of that cost is on the
web side: the truck directory has no selection model today, and its rows are single `<button>`
elements that must be restructured before a checkbox can live in them (research.md records this).
That is new UI construction, not new business rule — the API half is a near-mechanical transposition
of the reviewed customer bulk path. The growth is therefore in volume, not in architectural surface,
and Principle II still holds because both paths answer one business question. No constitution
exception requires complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/transport-resources/trucks/archive-a-truck/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── http-api.md
├── checklists/
│   └── requirements.md
└── tasks.md              # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/trucks_controller.ts                  # add `archive`, `archiveMany`
│   ├── trucks/
│   │   ├── archive/
│   │   │   ├── archive_truck_use_case.ts                  # new
│   │   │   └── archive_trucks_use_case.ts                 # new
│   │   ├── create/create_truck_use_case.ts
│   │   ├── list/list_trucks_use_case.ts
│   │   ├── available/list_available_trucks_use_case.ts
│   │   └── shared/
│   │       ├── repositories/
│   │       │   ├── truck_repository.ts                     # add 4 methods + command/result types
│   │       │   └── lucid_truck_repository.ts               # add 4 methods
│   │       ├── truck_lifecycle_blockers.ts                 # new (pure classification helpers)
│   │       ├── truck_policy.ts                             # add `archive`
│   │       ├── truck_validator.ts                          # add archive + archiveMany validators
│   │       ├── truck_exceptions.ts                         # add 3 lifecycle exceptions
│   │       └── truck_transformer.ts                        # unchanged
│   ├── site_references/shared/
│   │   ├── site_reference_validator.ts                     # add `lifecycleComment`, `lifecycleIds`
│   │   └── site_reference_usage_checker.ts                 # unchanged (already supports 'TRUCK')
│   └── customers/shared/customer_validator.ts              # import the extracted helpers
├── start/routes.ts                                         # add both archive routes
└── tests/
    ├── unit/trucks/lifecycle/archive.spec.ts                # new
    ├── unit/trucks/lifecycle/bulk/archive.spec.ts           # new
    ├── integration/trucks/lifecycle/archive.spec.ts         # new
    └── integration/trucks/lifecycle/bulk/archive.spec.ts    # new

apps/web/src/
└── features/trucks/
    ├── types.ts                                             # add bulk blocker/result types
    ├── mutations/use-truck-mutations.ts                     # add `archive`, `archiveMany`
    ├── ui/
    │   ├── truck-lifecycle-actions.tsx                       # new (single archive dialog)
    │   ├── truck-bulk-lifecycle-actions.tsx                  # new (selection toolbar + dialog)
    │   ├── truck-details.tsx                                 # render the archive action
    │   ├── truck-list.tsx                                    # row restructure + checkbox
    │   ├── truck-section.tsx                                 # thread selection props
    │   └── trucks-page.tsx                                   # own selection state, scope pruning
    └── __tests__/
        ├── lifecycle/archive.test.tsx                       # new
        ├── bulk/archive.test.tsx                            # new
        ├── bulk/mixed-archive.test.tsx                      # new
        └── selection/selection.test.tsx                     # new
```

**Structure Decision**: Extend the existing `trucks` vertical slice exactly as `customers` already
does for lifecycle, adding an `archive/` use-case directory beside the existing `create/`, `list/`,
and `available/` directories rather than introducing a generic site-reference lifecycle abstraction.
Persistence work stays inside `LucidTruckRepository` as four new methods on the existing model; no
migration, table, or column is added. The only file touched outside the trucks slice on the API side
is `customer_validator.ts`, which switches to importing the lifecycle-comment and lifecycle-ids rules
from their new shared home so the same limits govern customer and truck lifecycle payloads — and,
later, truck reactivation (`#226`). API tests introduce a `lifecycle/` folder, with a `bulk/`
subfolder, under the existing `tests/unit/trucks/` and `tests/integration/trucks/` trees, matching
the `customers` layout exactly.

On the web side the change is larger, because List Trucks (`#222`) delivered no selection model. The
truck directory currently renders each row as a single full-width `<button>` that opens the details
panel; a checkbox cannot be nested inside it, so `truck-list.tsx` rows become a row container
holding a `Checkbox` beside the existing details `<button>`, with the select-all control in the list
header. `trucks-page.tsx` owns the selected-id set and prunes it to the trucks listed in the current
lifecycle view and transport-company filter, mirroring `customers-page.tsx`'s
`visibleSelectedCustomerIds`. Selection and the bulk toolbar are rendered only for administrators
and only in the available view, since this slice delivers archive and not reactivate. The single
archive dialog follows `features/customers/ui/lifecycle-actions.tsx` and the bulk toolbar follows
`features/customers/ui/bulk-lifecycle-actions.tsx`, so no new interaction pattern is invented; no
new route or workspace is added. Generated route tree, controller/policy registries, and Tuyau types
are refreshed through existing generators rather than edited manually.

## Complexity Tracking

No constitution violations require justification.
