# Implementation Plan: Suspend a Truck From Service

**Branch**: `feat/252-suspend-truck` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/transport-resources/trucks/suspend-a-truck-from-service/spec.md`

## Summary

Add a third truck lifecycle state, `SUSPENDED`, and one action that enters it: an active organization
administrator or operations administrator suspends an available truck, which stops being offered for
new operational work while remaining a live site reference under the same identity, registration, and
transport company. The API adds `POST /api/v1/trucks/:id/suspend`, a `suspend/` use-case directory, one
repository method, and one migration adding three lifecycle columns and widening the `trucks.status`
check constraint. There is no bulk endpoint: the spec settles suspension as one truck per action.

The action itself is the simplest in the truck lifecycle. It mirrors `archiveAvailable` — one
transaction, `forUpdate` on the truck row, a status guard, one guarded `UPDATE` — with two deliberate
subtractions. It does **not** consult `SiteReferenceUsageChecker`, because suspension is never refused
for a truck on a planned or active discharge; that is the whole point of the state. And it does **not**
lock the transport-company row the way `reactivateArchived` does, because suspension removes an
available truck rather than producing one, so it can only make the "no available truck under an
archived company" invariant more true.

The work is not in the action. It is in the three consequences of adding a value to a status field
that four merged code paths read as a boolean, and in two product boundaries the issue draws:

1. **A third state breaks delivered write paths, silently.** `archiveAvailable` guards only against
   `ARCHIVED`, so it would archive a suspended truck. `reactivateArchived` guards only against
   `AVAILABLE`, so it would reactivate one. Both bulk paths would misclassify a suspended truck and
   then trip their own transaction row-count assertion, turning a legitimate request into a `500`.
   `UpdateTruckUseCase` would refuse a suspended truck with "Archived trucks are read-only". All four
   are fixed here; research [D3](./research.md) is the audit.
2. **The migration cannot use knex's `.alter()`.** Spike-verified against the repository's own
   dependency versions: on SQLite it reports success while leaving the old two-value check in place
   next to the new one, so `SUSPENDED` inserts still fail; on PostgreSQL it emits malformed SQL. The
   migration is hand-written and dialect-branched, with a manual table rebuild on SQLite. Research
   [D2](./research.md) records the spike and the verified recipe.
3. **Most of the spec's operational-use rules have no code to attach to yet.** There is no rotation
   model in the codebase, and no discharge or shift assignment use cases — only tables, factories, and
   a usage-read repository. Suspension's exclusion from new work is therefore satisfied by
   construction through `listAvailable`'s `status = 'AVAILABLE'` filter, and three of User Story 2's
   acceptance scenarios cannot be verified until rotations exist. Research [D4](./research.md) maps
   scenario by scenario what ships and what does not.

On the web, the truck workspace becomes genuinely tri-state rather than gaining a branch. Today a
suspended truck would fall into neither the available nor the archived partition and disappear from the
workspace entirely, and selecting one would bounce the tab and then clear the selection. A third tab,
a third count, a widened route search enum, and a three-way lifecycle action replace the boolean
`isArchived` reads. A suspended truck offers no lifecycle action at all, because returning it to
service is issue `#253`.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js 22 toolchain

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4 (knex 3.2.10), VineJS 4, Bouncer 4, Tuyau 1.2,
TanStack Router 1.170 / Query 5.101, React 19.1, shadcn/Base UI, Luxon 3.7

**Storage**: PostgreSQL in runtime (ADR 0002); in-memory SQLite through better-sqlite3 12.11.1 for
automated API tests. **One migration is required** — unlike `#225` and `#226`, which wrote only
columns that already existed. It adds `suspended_at`, `suspended_by_user_id`, `suspension_comment`,
widens the `trucks.status` check constraint to three values, and adds the paired
`status != 'SUSPENDED' OR suspended_at IS NOT NULL` check.

**Testing**: Japa 5.3 API unit/integration suites; Vitest 4.1, Testing Library, and MSW web feature
tests

**Target Platform**: Linux-hosted API and server-rendered web application; modern desktop and mobile
browsers

**Performance Goals**: At least 90% of representative authorized administrators suspend an intended
truck, or understand why they cannot, within 45 seconds of opening it (SC-010). The write itself is one
row-locked read and one status-guarded `UPDATE` on a primary key, with no scale concern beyond the
1,000-truck dataset already validated by List Trucks (`#222`).

**Constraints**: The migration must run correctly on PostgreSQL *and* SQLite, and knex's `.alter()`
produces a silently broken schema on the first and invalid SQL on the second, so the status-check
change is hand-written per dialect and needs `disableTransactions` for SQLite's foreign-key pragma —
the same reason `1785200000000_add_transport_companies_contact_details.ts` already documents. Adding a
third status value must not leave any delivered path treating status as a boolean; four such paths
exist and are enumerated in research D3. Suspension must be accepted for a truck reserved by a planned
or active discharge, which is the opposite of archival's rule, so it must **not** call the usage
checker. Repeated or concurrent suspension of the same truck must record exactly one suspension, via
the row lock and status guard the archive path already uses. `TruckStatus` widening is a type change
that reaches every consumer of the truck model, so the full suite is the gate, not the truck suites
alone.

**Scale/Scope**: One new endpoint (`POST /api/v1/trucks/:id/suspend`); one new API `suspend/` slice
(one use case, one repository method, two exceptions, one validator, one policy method); one migration;
corrections to four delivered paths (single archive, single reactivate, `findBulkBlockers`, update);
three new truck columns surfaced through the model and transformer. On the web, a third lifecycle tab
and count, a widened route search enum, a three-way lifecycle action, and a `suspend` mutation. No bulk
endpoint, no return-to-service, and no change to discharge, shift, transport-company, or archival rules.

## Constitution Check

### Pre-design gate

- **I. Selected feature intent is versioned — PASS**: GitHub issue #252 is selected on
  `feat/252-suspend-truck`, and the reviewed `spec.md` — with all three clarifications resolved — is the
  behavioral contract.
- **II. One independently deliverable feature per spec — PASS**: Authorization, validation,
  persistence, the migration, and interface for suspending a truck form one mergeable outcome around a
  single business decision ("may this truck be taken out of service?"). The four corrections in
  research D3 are not separate features; they are the delivered lifecycle paths being made correct in
  the presence of the state this slice introduces, and shipping without them would leave data-integrity
  bugs behind.
- **III. Vanilla Spec Kit gates protect product intent — PASS**: The spec carries no
  `[NEEDS CLARIFICATION]` markers; its three material ambiguities were put to the human and answered
  rather than invented. Two consequences this plan discovered — the dead-end state until `#253`, and the
  unverifiable rotation scenarios — are surfaced below for the plan-review gate rather than absorbed.
- **IV. Test-first observable behavior — PASS**: API behavior starts with Japa tests
  (`tests/{unit,integration}/trucks/lifecycle/suspend.spec.ts`) against real Lucid persistence, and web
  behavior with router-level Vitest/MSW feature tests, before implementation. The regression cases in
  research D3 are written first and observably fail — two of them fail *by succeeding*, which is the
  clearest possible demonstration that the third state breaks a boolean assumption.
- **V. Deep boundaries and explicit contracts — PASS**: `SuspendTruckUseCase` owns the business
  decisions and maps repository outcomes to domain exceptions, `LucidTruckRepository#suspendAvailable`
  owns the lock-and-guarded-update mechanics, `TrucksController#suspend` owns HTTP adaptation, and
  Tuyau carries the typed contract to the web adapter. No new layering shortcut is introduced.
- **VI. Durable knowledge has a home — PASS**: The new state gets its `CONTEXT.md` entry, as the issue
  requires, and four existing entries are revised so the glossary stops implying a binary lifecycle.
  The comment rules are imported from the shared `#shared/validators/lifecycle_validator`, not
  re-declared. `findBulkBlockers` is extended in place rather than duplicated. No new ADR is required:
  the migration technique is a dialect workaround recorded in research and in the migration's own
  comment, not an architectural decision.
- **VII. Verification is part of delivery — PASS**: The quickstart defines the focused API and web
  checks, the regression suites for the four corrected paths, the repository gates, and the browser
  flow. It also defines a PostgreSQL migration check that the SQLite-only test suite structurally
  cannot provide.
- **VIII. One workflow owner — PASS**: Spec Kit artifacts stay in this feature directory; GitHub
  Project continues to own operational status.

### Post-design re-evaluation

**PASS**. The data model and HTTP contract confirm the slice writes only to `trucks`, adds one
endpoint, and changes no other resource's lifecycle rules.

Three points deserve the reviewer's attention. None requires a constitution exception; two are product
decisions this plan should not make alone.

1. **This slice delivers a state with no exit.** Once a truck is suspended, nothing in the product
   returns it to service — `#253` owns that, and it is in the backlog. The interface will say so, but
   an administrator can still strand a vehicle in a state only a database write can leave. This is
   exactly the situation `#226`'s plan flagged for archived trucks under archived companies, and the
   answer then was to record it rather than widen scope. The same answer is available here, and so is a
   different one: sequence `#252` and `#253` into the same delivery. **That is a prioritization call
   for the reviewer, not a code change.** If `#252` ships alone, consider seeding no suspended fixture
   in production-like environments.

2. **Three acceptance scenarios cannot ship.** User Story 2's scenarios 3, 4, and 5 describe an
   in-progress rotation continuing under suspension, a continuation being refused, and a suspended truck
   not being offered for a new rotation. **There is no rotation model in the codebase.** The rules are
   correct and they are recorded in `CONTEXT.md` for the future rotation slice, but they are not
   implemented or tested here. Scenarios 1, 2, 6, and 7 — the discharge and shift assignment cases —
   ship and are testable today, and they carry the outcome that matters: suspension succeeds exactly
   where archival is refused. A reviewer reading the spec would reasonably expect all seven; four ship.

3. **A suspended truck cannot be edited, and reports that accurately.** Keeping
   `updateAvailable`'s `WHERE status = 'AVAILABLE'` guard is the minimal reading of FR-027 and FR-028,
   and widening it would drag in `UpdateTruckUseCase`'s compare-and-swap reassignment loop. But a
   vehicle in the workshop is a plausible moment to correct its recorded capacity. If suspended trucks
   should be editable, that is a small follow-up against `#224` — research [D5](./research.md) records
   the trade-off. Correcting the *refusal message* is not optional and is in scope: FR-021 requires
   accurate feedback, and a new state reporting itself as "archived" fails that.

One further consequence is recorded rather than acted on: because `findCompanyIdsWithAvailableTrucks`
counts only available trucks, a transport company can be archived while it still provides suspended
trucks. That is correct today — a suspended truck is not available, so no invariant is broken — but it
means **`#253` must carry the same archived-transport-company gate, and the same `FOR UPDATE` company
lock, that `#226` already has.** Research [D6](./research.md) and `data-model.md` record it; it is worth
a note on issue `#253`.

The slice is larger than `#226` in one dimension only: it is the first truck lifecycle change requiring
a migration, and that migration is the riskiest artifact in it. The spike in research D2 exists because
the obvious approach fails silently on the dialect the test suite uses — a green suite would have
proved nothing.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/transport-resources/trucks/suspend-a-truck-from-service/
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
├── database/
│   ├── migrations/
│   │   └── 1785300000000_add_truck_suspension.ts        # new — dialect-branched (research D2)
│   ├── schema.ts                                        # regenerated by migration:run, never edited
│   ├── factories/truck_factory.ts                       # add `suspended` state
│   └── fixtures/trucks.ts                               # add a suspended truck; reword the misleading archive comment
├── app/
│   ├── models/truck.ts                                  # widen TRUCK_STATUSES; 3 columns + `suspendedBy` relation
│   ├── controllers/trucks_controller.ts                 # add `suspend`
│   ├── trucks/
│   │   ├── suspend/
│   │   │   └── suspend_truck_use_case.ts                # new
│   │   ├── update/update_truck_use_case.ts              # correct the suspended refusal (D5)
│   │   └── shared/
│   │       ├── repositories/
│   │       │   ├── truck_repository.ts                  # add suspendAvailable + command/result; widen 3 result types
│   │       │   └── lucid_truck_repository.ts            # add suspendAvailable; guard archive & reactivate against SUSPENDED
│   │       ├── truck_lifecycle_blockers.ts              # widen status union; add `SUSPENDED` blocker reason
│   │       ├── truck_policy.ts                          # add `suspend`
│   │       ├── truck_validator.ts                       # add suspendTruckValidator
│   │       ├── truck_exceptions.ts                      # add 3 exceptions
│   │       └── truck_transformer.ts                     # expose the suspension context
├── start/routes.ts                                      # add POST /trucks/:id/suspend
└── tests/
    ├── support/trucks/lifecycle_fixtures.ts             # add a suspended-truck scenario
    ├── unit/trucks/lifecycle/suspend.spec.ts            # new
    ├── integration/trucks/lifecycle/suspend.spec.ts     # new
    └── {unit,integration}/trucks/…                      # extend archive, reactivate, both bulk, update, list (D3)

apps/web/src/
├── routes/_authenticated/transport-resources.tsx        # truckStatus enum gains 'suspended'
└── features/trucks/
    ├── types.ts                                         # TruckLifecycle gains 'suspended'
    ├── mutations/use-truck-mutations.ts                 # add `suspend`
    ├── ui/
    │   ├── trucks-page.tsx                              # third tab/count; tri-state partition and selection sync
    │   ├── truck-details.tsx                            # tri-state badge, status, context section, edit-button guard
    │   ├── truck-lifecycle-actions.tsx                  # three-way: archive+suspend / reactivate / none
    │   ├── truck-overview.tsx                           # third count; total over three states
    │   └── truck-section.tsx                            # tri-state section label
    └── __tests__/
        ├── lifecycle/suspend.test.tsx                   # new
        ├── list/lifecycle.test.tsx                      # extend for the third tab
        └── selection/…                                  # suspended tab offers no selection
```

**Structure Decision**: Extend the existing `trucks` vertical slice with a `suspend/` use-case
directory beside `archive/`, `reactivate/`, `create/`, `update/`, `list/`, and `available/` — the
layout every truck lifecycle action already uses. Persistence stays inside `LucidTruckRepository` as
one new method plus guards on two existing ones. The migration is the only file outside the trucks
slice on the API side, and `database/schema.ts` is regenerated rather than edited.

On the web, no new component or route is introduced; the workspace's boolean lifecycle reads become
three-valued. The suspended tab is the first truck tab without selection or a bulk toolbar, which is
the honest rendering of the spec's one-truck-per-action decision. Generated route tree, controller and
policy registries, and Tuyau types are refreshed through existing generators rather than edited by
hand.

## Complexity Tracking

No constitution violations require justification.
