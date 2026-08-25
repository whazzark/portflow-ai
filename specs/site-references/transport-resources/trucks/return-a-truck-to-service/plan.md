# Implementation Plan: Return a Truck to Service

**Branch**: `feat/253-return-service-truck` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/transport-resources/trucks/return-a-truck-to-service/spec.md`

## Summary

Deliver the one transition `#252` left missing: an active organization administrator or operations
administrator returns a suspended truck to service, moving it from `SUSPENDED` back to `AVAILABLE` so
it is offered again for new discharges, shift assignments, and rotations. The API adds
`POST /api/v1/trucks/:id/return-to-service`, a `return_to_service/` use-case directory, one repository
method, and one migration adding three nullable context columns. No status value is added, no bulk
endpoint exists, and no delivered lifecycle rule changes.

**The risk profile is largely the inverse of `#252`'s.** There, the action was trivial and the
migration was the dangerous artifact — a hand-written, dialect-branched enum widening that failed
silently on the dialect the test suite uses. Here the risk moved into three places listed below.

The migration is *smaller* — three nullable columns, no status value, no constraint change — but the
plan's first claim that it therefore needed no dialect branch was wrong, and implementation proved it:
on SQLite, knex rebuilds the whole table for any added column with a `REFERENCES` clause, and that
rebuild's `DROP TABLE trucks` is refused by `discharge_truck_assignments` and `shift_trucks`. It
carries the same `PRAGMA foreign_keys` window `#252` documents. Corrected in research
[D2](./research.md).

1. **One business rule that is not a mirror image.** Every other rule in this slice is suspension read
   backwards. This one is not: because `findCompanyIdsWithAvailableTrucks` counts only available
   trucks, a transport company can be archived while its whole fleet is suspended, and returning one
   of those trucks would produce an available truck under an archived company. `#252` predicted this
   and wrote it down for `#253`. The return therefore carries `#226`'s gate **and** its `FOR UPDATE`
   company lock; research [D3](./research.md) records why a plain read leaves a check-then-act window
   and why the opposite lock order used by company archival cannot deadlock against it.
2. **A refusal message that is already wrong in a delivered path.** The archived-company refusal tells
   the administrator to "reactivate the company or reassign the truck". Reassignment goes through
   `updateAvailable`, guarded by `WHERE status = 'AVAILABLE'` — so it is impossible for an archived
   truck and for a suspended one alike. The advice has never been followable. One shared, accurate
   message replaces it; research [D4](./research.md).
3. **An interface structure that cannot express the spec.** `truck-details.tsx` renders exactly one
   lifecycle context block, chosen by current status. A truck that has just been returned is
   `AVAILABLE`, so the delivered panel would show it the *reactivation* block — usually empty — hiding
   both the return (FR-009) and the suspension it ended (FR-013). US1-6 requires both at once, which
   one block structurally cannot do. Research [D8](./research.md).

Everything else is the mirror of suspension and reuses its shape: the same row lock and status-guarded
update, the same optional trimmed comment on the shared `lifecycleComment()` rule, the same
one-truck-per-action decision, the same absence of a bulk path.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js 22 toolchain

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4 (knex 3.2.10), VineJS 4, Bouncer 4, Tuyau 1.2,
TanStack Router 1.170 / Query 5.101, React 19.1, shadcn/Base UI, Luxon 3.7

**Storage**: PostgreSQL in runtime (ADR 0002); in-memory SQLite through better-sqlite3 12.11.1 for
automated API tests. **One migration is required**: three nullable columns
(`returned_to_service_at`, `returned_to_service_by_user_id`, `return_to_service_comment`), no status
value and no check-constraint change — but still `disableTransactions` and a SQLite branch, because
the actor column's foreign key makes knex rebuild the table on that dialect (research
[D2](./research.md), corrected during implementation).

**Testing**: Japa 5.3 API unit/integration suites; Vitest 4.1, Testing Library, and MSW web feature
tests

**Target Platform**: Linux-hosted API and server-rendered web application; modern desktop and mobile
browsers

**Performance Goals**: At least 90% of representative authorized administrators return an intended
truck to service, or understand why they cannot, within 45 seconds of opening it (SC-010). The write
is one row-locked read, one locked company read, and one status-guarded `UPDATE` on a primary key.

**Constraints**: The return is the only writer that can turn a suspended truck into an available one,
which makes it the only place an available truck under an archived transport company could be created;
the company row must be read under `FOR UPDATE` inside the same transaction as the truck's own lock.
The suspension context must survive the return (FR-013) — legal at the schema level because the
delivered `status <> 'SUSPENDED' OR suspended_at IS NOT NULL` check is one-directional, verified
against the migration rather than assumed. Repeated or concurrent returns must record exactly one
return, via the row lock plus a `WHERE status = 'SUSPENDED'` guard. Nothing in the bulk paths may
change: `#252` already taught them `SUSPENDED`, and this slice adds no status value.

**Scale/Scope**: One new endpoint (`POST /api/v1/trucks/:id/return-to-service`); one new API
`return_to_service/` slice (one use case, one repository method, one new exception, one validator, one
policy method); one additive migration; three new truck columns surfaced through the model and both
transformer variants; one corrected message on a delivered exception. On the web, a third lifecycle
action, a `returnToService` mutation, and a restructured lifecycle-context section in the detail pane.
No bulk endpoint, no new status value, no route-search change, and no change to discharge, shift,
transport-company, or archival rules.

## Constitution Check

### Pre-design gate

- **I. Selected feature intent is versioned — PASS**: GitHub issue #253 is selected on
  `feat/253-return-service-truck`, and the reviewed `spec.md` is the behavioral contract.
- **II. One independently deliverable feature per spec — PASS**: Authorization, validation,
  persistence, the migration, and interface for returning a truck to service form one mergeable
  outcome around a single business decision ("may this truck come back into service?"). The two
  corrections carried alongside it — the archived-company message and the single-block context pane —
  are not separate features; they are the delivered paths being made correct in the presence of this
  transition, and shipping without them would leave unfollowable advice and a spec requirement
  undelivered.
- **III. Vanilla Spec Kit gates protect product intent — PASS**: The spec carries no
  `[NEEDS CLARIFICATION]` markers. Its two scope decisions were resolved by documented assumption
  against delivered precedent rather than invented. Three consequences this plan discovered are
  surfaced below for the review gate rather than absorbed silently — including one that supersedes a
  spec assumption.
- **IV. Test-first observable behavior — PASS**: API behavior starts with Japa tests
  (`tests/{unit,integration}/trucks/lifecycle/return_to_service.spec.ts`) against real Lucid
  persistence, and web behavior with router-level Vitest/MSW feature tests, before implementation. The
  archived-transport-company case is written first, because it is the one rule that is not the mirror
  of suspension and the one most likely to be implemented as a happy path.
- **V. Deep boundaries and explicit contracts — PASS**: `ReturnTruckToServiceUseCase` owns the
  business decisions and maps repository outcomes to domain exceptions,
  `LucidTruckRepository#returnSuspendedToService` owns the lock-and-guarded-update mechanics,
  `TrucksController#returnToService` owns HTTP adaptation, and Tuyau carries the typed contract to the
  web adapter. No new layering shortcut is introduced.
- **VI. Durable knowledge has a home — PASS**: `CONTEXT.md` gains the return vocabulary, and the
  `Suspended Truck` entry is revised — it currently states that a suspended truck must return to
  service before it can be archived, reactivated, or updated, while no way to do so exists. The
  comment rules are imported from the shared `#shared/validators/lifecycle_validator`, not
  re-declared. No new ADR is required: this slice introduces no architectural decision, only the
  second application of `#226`'s existing one.
- **VII. Verification is part of delivery — PASS**: The quickstart defines the focused API and web
  checks, the regression suites, the repository gates, the PostgreSQL migration check, and the manual
  flow for the archived-company rule.
- **VIII. One workflow owner — PASS**: Spec Kit artifacts stay in this feature directory; GitHub
  Project continues to own operational status.

### Post-design re-evaluation

**PASS**. The data model and HTTP contract confirm the slice writes only to `trucks`, adds one
endpoint, adds no status value, and changes no other resource's lifecycle rules.

Four points deserve the reviewer's attention. None requires a constitution exception; two are product
decisions this plan should not make alone.

1. **A spec assumption is superseded.** The spec assumed the archived-company refusal on this path
   would be worded differently from `#226`'s, on the belief that `#226`'s wording was correct. It is
   not: "reassign the truck" is impossible for an archived truck, because reassignment requires
   `updateAvailable`, which is guarded by `WHERE status = 'AVAILABLE'`. The advice has never been
   followable in either path. The plan therefore keeps **one** exception and **one** code and corrects
   the shared message to name company reactivation alone. This edits a delivered slice's message and
   one asserted string in `apps/web/src/features/trucks/__tests__/lifecycle/reactivate.test.tsx` — the
   same call `#252` made for its misleading update refusal. **Confirm the wording change is wanted.**

2. **A returned truck discloses `suspendedBy` to operational users.** `#252` deliberately withheld the
   suspending administrator from `GET /trucks/suspended` via the operational transformer variant. But
   `GET /trucks/available` serializes with `toObject`, so once a truck is returned, an operations lead
   or observer can read who suspended it. This follows the delivered rule — `archivedBy` and
   `reactivatedBy` are already disclosed there — and FR-016 points at exactly that rule, so the plan
   changes nothing. **But this slice is what turns it from hypothetical into reachable**: before it, no
   suspended truck could ever re-enter the available collection. If the intent of `#252`'s withholding
   was that the suspending administrator is never operational information, `/trucks/available` should
   move to the operational variant — a small follow-up against `#222`, not a silent change here.
   Research [D9](./research.md). **This is a product call for the reviewer.**

3. **One acceptance scenario still cannot ship.** User Story 2's scenario 4 describes a rotation that
   was in progress across the suspension, a continuation now being accepted, and the truck not being
   offered for a second concurrent rotation. **There is still no rotation model in the codebase** —
   unchanged since `#252`'s research. The rule is correct and is recorded in `CONTEXT.md` for the
   future rotation slice, but it is not implemented or tested here. Scenarios 1, 2, 3, 5, and 6 — the
   discharge and shift assignment cases, the availability collections, and the registration — all ship
   and are testable today. A reviewer reading the spec would reasonably expect all six; five ship.

4. **The detail pane is restructured, not branched.** Showing the return context and the suspension it
   ended at the same time (US1-6) is impossible in a panel that renders one status-derived block, so
   the section becomes a newest-first list of every context block the truck carries. This repairs two
   pre-existing gaps as a side effect: an archived truck currently hides its earlier reactivation, and
   a suspended truck currently hides its archive history — which `#252`'s own FR-011 said should stay
   readable. The change stays inside `truck-details.tsx`. Research [D8](./research.md).

One boundary is **closed** rather than opened by this slice: `#252` shipped a state a truck could
enter but not leave, and flagged it for its own reviewer. After this slice, a suspended truck can be
returned to service through the product, and no lifecycle state is a dead end.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/transport-resources/trucks/return-a-truck-to-service/
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
│   │   └── 1785400000000_add_truck_return_to_service.ts   # new — purely additive (research D2)
│   ├── schema.ts                                          # regenerated by migration:run, never edited
│   ├── factories/truck_factory.ts                         # add a `returned` state
│   └── fixtures/trucks.ts                                 # add a returned truck; widen the local lifecycle shape (D10)
├── app/
│   ├── models/truck.ts                                    # 3 columns + `returnedToServiceBy` relation
│   ├── controllers/trucks_controller.ts                   # add `returnToService`
│   ├── trucks/
│   │   ├── return_to_service/
│   │   │   └── return_truck_to_service_use_case.ts        # new
│   │   └── shared/
│   │       ├── repositories/
│   │       │   ├── truck_repository.ts                    # add returnSuspendedToService + command/result
│   │       │   └── lucid_truck_repository.ts              # add the method; extract preloadLifecycleActors (D11)
│   │       ├── truck_policy.ts                            # add `returnToService`
│   │       ├── truck_validator.ts                         # add returnTruckToServiceValidator
│   │       ├── truck_exceptions.ts                        # add TruckArchivedCannotReturnException; correct the archived-company message (D4)
│   │       └── truck_transformer.ts                       # expose the return context in both variants
├── start/routes.ts                                        # add POST /trucks/:id/return-to-service
└── tests/
    ├── support/trucks/lifecycle_fixtures.ts               # add a suspended-truck-with-archived-company scenario
    ├── unit/trucks/lifecycle/return_to_service.spec.ts    # new
    ├── integration/trucks/lifecycle/return_to_service.spec.ts  # new
    ├── integration/trucks/consultation/{list,suspended}.spec.ts # extend for the 3 new fields
    └── unit/database/storage_reference_lifecycle.spec.ts  # extend for the new fixture state

apps/web/src/features/trucks/
├── mutations/use-truck-mutations.ts                       # add `returnToService`
├── ui/
│   ├── truck-lifecycle-actions.tsx                        # third action; drop the dead-end notice; per-action failure label
│   ├── truck-row-actions.tsx                              # a suspended row now carries an action
│   └── truck-details.tsx                                  # lifecycle context becomes a newest-first list (D8)
└── __tests__/
    ├── lifecycle/return-to-service.test.tsx               # new
    ├── lifecycle/suspend.test.tsx                         # asserts the dead-end notice today; update
    ├── lifecycle/reactivate.test.tsx                      # asserts the archived-company message; update (D4)
    ├── details/open.test.tsx                              # extend for the multi-block context pane
    ├── list/row-actions.test.tsx                          # extend for the suspended row action
    └── support/fixtures.ts                                # add a returned truck and an archived-company refusal
```

**Structure Decision**: Extend the existing `trucks` vertical slice with a `return_to_service/`
use-case directory beside `suspend/`, `archive/`, `reactivate/`, `create/`, `update/`, `list/`,
`available/`, and `suspended/` — the layout every truck lifecycle action already uses. Persistence
stays inside `LucidTruckRepository` as one new method, shaped on `reactivateArchived` because it
guards the same invariant from a different source state. The migration is the only file outside the
trucks slice on the API side, and `database/schema.ts` is regenerated rather than edited.

On the web, no new component, route, tab, count, or search parameter is introduced — `#252` already
made the workspace tri-state. The suspended tab simply stops being terminal: it gains one action and
keeps `selectable={false}` and no bulk toolbar, which remains the honest rendering of the
one-truck-per-action decision. The only structural change is inside the detail pane's lifecycle
section. Generated route tree, controller and policy registries, and Tuyau types are refreshed through
existing generators rather than edited by hand.

## Complexity Tracking

No constitution violations require justification.
