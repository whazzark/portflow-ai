---
description: "Task list for Return a Truck to Service (GH-253)"
---

# Tasks: Return a Truck to Service

**Input**: Design documents from `specs/site-references/transport-resources/trucks/return-a-truck-to-service/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [quickstart.md](./quickstart.md)

**Tests**: Included and mandatory. Constitution principle IV requires RED → GREEN → REFACTOR for all business behavior; every acceptance scenario maps to an observable test.

**Organization**: Tasks are grouped by user story. Each story phase is a complete, independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — a different file from every other task in the same phase, with no dependency on an incomplete task
- **[Story]**: `[US1]`–`[US4]`, mapping to the four user stories in spec.md
- Every task names the exact file or command it acts on

## Path Conventions

Monorepo per [plan.md](./plan.md): API in `apps/api/`, web in `apps/web/src/`. All paths below are repository-relative.

---

## Phase 1: Setup

**Purpose**: Establish a trustworthy baseline and clear the human gates before any code changes.

- [X] T001 Record a green baseline by running `pnpm --filter @portflow/api test` and `pnpm --dir apps/web exec vitest run src/features/trucks`; note the passing counts so any regression introduced later is provably new
- [X] T002 Clear the plan-review gate on the four points in the "Post-design re-evaluation" section of [plan.md](./plan.md). Two are product calls: whether to correct the shared archived-transport-company message (which supersedes a spec assumption), and whether a returned truck may disclose `suspendedBy` to operational users through `GET /trucks/available`. Two are acknowledgements: US2 scenario 4 cannot ship without a rotation model, and the detail pane's lifecycle section is restructured rather than branched

**Checkpoint**: Baseline recorded, product boundaries confirmed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, model, shared contract types, and the refusal vocabulary. Nothing behavioural — but nothing in Phases 3–6 compiles without it.

**Note**: unlike `#252`, the migration here is the *safe* artifact. It adds three nullable columns and changes no constraint (research [D2](./research.md)). The delivered `CHECK (status <> 'SUSPENDED' OR suspended_at IS NOT NULL)` is one-directional, so an `AVAILABLE` row keeping its `suspended_at` — exactly what a returned truck is — is already legal. Do not add a paired check for `AVAILABLE`: it would be false for every truck ever created.

- [X] T003 Create the migration `apps/api/database/migrations/1785400000000_add_truck_return_to_service.ts` adding `returned_to_service_at` (timestamp, nullable), `returned_to_service_by_user_id` (uuid, nullable, FK → `users.id`, `ON DELETE SET NULL`), and `return_to_service_comment` (text, nullable). **Corrected during implementation**: the task originally said "no dialect branch, no `disableTransactions`". That was wrong. The first version passed on PostgreSQL and failed the SQLite suite with `SqliteError: DROP TABLE "trucks" - FOREIGN KEY constraint failed`, because knex rebuilds the whole table for any added column carrying a `REFERENCES` clause, and `discharge_truck_assignments` and `shift_trucks` refuse the DROP. It now carries `disableTransactions` and a SQLite `PRAGMA foreign_keys` window, as `#252` does. No check-constraint change, and knex still generates its own rebuild — no hand-built table (research [D2](./research.md))
- [X] T004 Verified on **both** dialects — the SQLite half is what caught T003's original error. Against a real PostgreSQL with `pnpm --filter @portflow/api db:migrate`, `db:rollback`, `db:migrate`, then assert directly: the three columns exist and are nullable, the FK carries `ON DELETE SET NULL`, `trucks_status_check` and `trucks_suspended_at_check` are unchanged, an `AVAILABLE` row with a non-null `suspended_at` inserts, and rollback drops only the three new columns (quickstart step 1b). All confirmed by direct `pg_constraint` / `information_schema` queries
- [X] T005 Regenerate `apps/api/database/schema.ts` with `pnpm --filter @portflow/api db:migrate` — generated file, never hand-edited
- [X] T006 Declare `returnedToServiceAt`, `returnedToServiceByUserId`, `returnToServiceComment`, and a `returnedToServiceBy` `belongsTo(User)` relation in `apps/api/app/models/truck.ts`. `TRUCK_STATUSES` is **unchanged** — this slice adds no status value
- [X] T007 Add `ReturnTruckToServiceCommand` and `ReturnTruckToServiceResult` (`RETURNED` | `ALREADY_AVAILABLE` | `ARCHIVED` | `TRANSPORT_COMPANY_ARCHIVED` | `NOT_FOUND`) and declare the abstract `returnSuspendedToService` in `apps/api/app/trucks/shared/repositories/truck_repository.ts`. No existing result type widens — research [D6](./research.md)
- [X] T008 [P] Add `TruckArchivedCannotReturnException` (409, `E_TRUCK_ARCHIVED_CANNOT_RETURN`) and correct `TruckTransportCompanyArchivedException`'s message in `apps/api/app/trucks/shared/truck_exceptions.ts` to name reactivating the transport company as the only unblocking action. The delivered wording offers a reassignment that `updateAvailable`'s `WHERE status = 'AVAILABLE'` guard makes impossible for an archived truck and for a suspended one alike (research [D4](./research.md)) — gated on T002
- [X] T009 [P] Update the two asserted copies of the old message string in `apps/web/src/features/trucks/__tests__/lifecycle/reactivate.test.tsx` to match T008, keeping the suite green
- [X] T010 [P] Add the `returnToService` method to `apps/api/app/trucks/shared/truck_policy.ts`, matching the two-administrator pattern of `reactivate` and `suspend`
- [X] T011 [P] Add `returnTruckToServiceValidator` reusing the shared `lifecycleComment()` rule in `apps/api/app/trucks/shared/truck_validator.ts`
- [X] T012 [P] Expose the return context in `apps/api/app/trucks/shared/truck_transformer.ts`: all three fields plus a `returnedToServiceBy` summary in `toObject`, and `returnedToServiceAt` with `returnToServiceComment` — **no actor** — in `toOperationalView`, mirroring how it already treats suspension
- [X] T013 [P] Extract a `preloadLifecycleActors(query)` helper in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts` and route all nine `.preload('archivedBy').preload('reactivatedBy').preload('suspendedBy')` sites through it, adding `returnedToServiceBy`. A missed site is invisible in types — the actor silently serializes as `null` (research [D11](./research.md))
- [X] T014 [P] Add a `returned` state — `AVAILABLE` with both `suspendedAt` and `returnedToServiceAt` set — to `apps/api/database/factories/truck_factory.ts`
- [X] T015 [P] Append a sixth truck fixture in the `returned` state in `apps/api/database/fixtures/trucks.ts`, widening the local `TruckLifecycleAttributes` shape with the three fields. Leave `DD-404-PF` suspended so the suspended tab still has a subject, and leave `database/fixtures/shared.ts` untouched
- [X] T016 [P] ~~Extend `apps/api/tests/unit/database/storage_reference_lifecycle.spec.ts` for the new fixture state~~ — **no change needed**. That spec covers warehouse and warehouse-door lifecycle persistence only; it never reads truck fixtures, so the task's premise (from a `fixtures/index` grep hit) was wrong. The new fixture is covered instead by the seeded-dataset check in T047
- [X] T017 [P] Add a suspended-truck-with-archived-transport-company scenario helper to `apps/api/tests/support/trucks/lifecycle_fixtures.ts`, beside the existing `createArchivedTruckWithArchivedCompanyScenario`

**Checkpoint**: Schema carries the return context on both dialects; all shared types compile; the refusal vocabulary is in place.

---

## Phase 3: User Story 1 — Put a Repaired Truck Back Into Service (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator returns a suspended truck to service. It leaves the suspended collection, rejoins the available collection and count, and keeps its identity, attributes, transport company, and every earlier lifecycle context — including the suspension it just ended.

**Independent Test**: Sign in as an organization administrator, return a suspended truck with a comment, and verify it leaves the suspended collection, appears in the available collection and count, shows its return time, actor, and comment, still shows the suspension it ended, and keeps registration, model, capacity, and company unchanged.

### Tests for User Story 1 ⚠️ Write first; they must FAIL before implementation

- [X] T018 [P] [US1] Unit suite for the happy path in `apps/api/tests/unit/trucks/lifecycle/return_to_service.spec.ts`: both administrator roles succeed; time, actor, and comment recorded; comment trimmed; absent/empty/whitespace-only comment stored as `null`; registration, model, capacity, company, and any archive/reactivation context preserved; **the suspension context survives the return**; a suspend → return → suspend cycle keeps the latest suspension and the preceding return (FR-002, FR-009, FR-010, FR-012, FR-013, US1-7)
- [X] T019 [P] [US1] Integration suite in `apps/api/tests/integration/trucks/lifecycle/return_to_service.spec.ts` asserting `POST /api/v1/trucks/:id/return-to-service` returns `200` with the serialized return **and** suspension context per [contracts/http-api.md](./contracts/http-api.md)
- [X] T020 [P] [US1] Collection tests in `apps/api/tests/integration/trucks/consultation/suspended.spec.ts` and `apps/api/tests/integration/trucks/consultation/list.spec.ts`: a returned truck is absent from `GET /trucks/suspended` for every role, present in `GET /trucks/available`, and the exact-property assertion on `GET /trucks` gains the three new fields (FR-014, FR-015)
- [X] T021 [P] [US1] Web feature test in `apps/web/src/features/trucks/__tests__/lifecycle/return-to-service.test.tsx`: returning from the details panel calls `trucks.return_to_service`, shows a success toast, and moves the truck out of the suspended tab into the available tab, with the workspace following it, without a manual refresh
- [X] T022 [P] [US1] Web test in `apps/web/src/features/trucks/__tests__/details/open.test.tsx`: a returned truck's detail pane shows **both** the return context and the suspension it ended, newest first; an archived truck that was previously reactivated shows both of its blocks too

### Implementation for User Story 1

- [X] T023 [US1] Implement `returnSuspendedToService` in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`: one transaction, `forUpdate` on the truck row, refuse `AVAILABLE` as `ALREADY_AVAILABLE` and `ARCHIVED` as `ARCHIVED`, one `UPDATE … WHERE id = ? AND status = 'SUSPENDED'`, re-read through `preloadLifecycleActors`. **Do not clear the suspension columns.** The transport-company gate is deliberately *not* written here — it arrives in T037 so its test can fail first
- [X] T024 [US1] Implement `ReturnTruckToServiceUseCase` in `apps/api/app/trucks/return_to_service/return_truck_to_service_use_case.ts`, trimming the comment to `null` and mapping `NOT_FOUND`, `ALREADY_AVAILABLE`, and `ARCHIVED` to their exceptions
- [X] T025 [US1] Add the `returnToService` handler to `apps/api/app/controllers/trucks_controller.ts`, authorizing with `TruckPolicy#returnToService` and validating with `returnTruckToServiceValidator`
- [X] T026 [US1] Register `POST /trucks/:id/return-to-service` as `trucks.return_to_service` in `apps/api/start/routes.ts`, then refresh the generated route tree, controller/policy registries, and Tuyau types through the existing generators
- [X] T027 [P] [US1] Add the `returnToService` mutation, invalidating all three truck queries on success, in `apps/web/src/features/trucks/mutations/use-truck-mutations.ts` (depends on T026's generated types)
- [X] T028 [US1] In `apps/web/src/features/trucks/ui/truck-lifecycle-actions.tsx`: add `'return-to-service'` to `TruckLifecycleAction`, give it its `TRUCK_LIFECYCLE_COPY` entry, return it from `truckLifecycleActions('SUSPENDED')`, and delete the `truck-suspended-notice` dead-end branch. Add a per-action failure label to the copy record — the toast interpolates the action name, so without one it reads "Unable to return-to-service truck" (depends on T027)
- [X] T029 [P] [US1] Restructure the lifecycle section of `apps/web/src/features/trucks/ui/truck-details.tsx` from one status-derived block into a newest-first list of every context block the truck carries — archive, reactivation, suspension, return — omitting empty ones, each with its own heading and actor label. The badge and *Truck status* field keep showing the current status (research [D8](./research.md))
- [X] T030 [P] [US1] Update the stale comment in `apps/web/src/features/trucks/ui/truck-row-actions.tsx` — a suspended row now carries a lifecycle action — and confirm the early-return guard still behaves for every status

**Checkpoint**: A suspended truck can be returned to service end to end and its full history is readable. MVP deliverable.

---

## Phase 4: User Story 2 — Resume New Operational Use Without Rewriting Past Work (Priority: P1)

**Goal**: A returned truck is immediately usable through the discharge and shift assignments it kept while suspended, and nothing about its past is released, altered, or replayed.

**Independent Test**: Return a suspended truck that is still assigned to a planned discharge and to an active shift; verify it succeeds, that `discharge_truck_assignments` and `shift_trucks` rows are byte-for-byte unchanged, and that the truck is offered again in `GET /trucks/available`.

**Note**: US2 scenario 4 — an in-progress rotation, a continuation now accepted, no second concurrent rotation — **cannot be built**. There is still no rotation model in the codebase, unchanged since `#252`. It is carried as a forward constraint in T045 instead (research [D7](./research.md)).

### Tests for User Story 2 ⚠️ Write first

- [X] T031 [US2] Extend `apps/api/tests/integration/trucks/lifecycle/return_to_service.spec.ts`: a suspended truck built from `createReservedAndShiftedTruckScenario` returns `200`, and its assignment rows — including their captured registration and transport company — are byte-for-byte unchanged (FR-017, FR-018)
- [X] T032 [US2] Extend `apps/api/tests/unit/trucks/lifecycle/return_to_service.spec.ts`: the registration held throughout the suspension is still the truck's own with no duplicate vehicle created, and no historical discharge, shift, or downtime row referencing the truck is altered (FR-012, US2-5, US2-6)

### Implementation for User Story 2

- [X] T033 [US2] Confirm `returnSuspendedToService` in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts` writes only to `trucks`, and record why in a comment: the return restores eligibility rather than reconstructing assignments, because suspension preserved every one of them. Confirm `listAvailable` needs no change — a returned truck reappears by construction through its `status = 'AVAILABLE'` filter (FR-014, FR-018)

**Checkpoint**: A repaired vehicle goes back to work through the assignments it never lost.

---

## Phase 5: User Story 3 — Keep the Return Authorized and Consistent With the Truck Lifecycle (Priority: P1)

**Goal**: Only the two administrator roles can return a truck, only trucks of their site, only from the suspended state, and only when the transport company can still provide available trucks.

**Independent Test**: Attempt the return unauthenticated, as each non-administrator role, on an available truck, on an archived truck, on a suspended truck whose transport company is archived, and on an unknown truck. Every attempt is refused with its own specific reason and no truck changes state.

**⚠️ T035 is the task this phase exists for.** Every other rule in the slice is suspension read backwards; the transport-company gate is not. Because `findCompanyIdsWithAvailableTrucks` counts only available trucks, a company can be archived while its whole fleet is suspended, and returning one of those trucks would produce an available truck under an archived company — breaking a recorded invariant. T023 deliberately ships without the gate so T035 fails first.

### Tests for User Story 3 ⚠️ Write first

- [X] T034 [US3] Extend `apps/api/tests/integration/trucks/lifecycle/return_to_service.spec.ts`: unauthenticated and inactive users get `401`; operations lead and observer get `403`; unknown truck gets `404`; an available truck gets `409 E_TRUCK_ALREADY_AVAILABLE`; an archived truck gets `409 E_TRUCK_ARCHIVED_CANNOT_RETURN` and stays archived; and a truck that has just been returned can then be archived, suspended, and updated like any other available truck (FR-003, FR-004, FR-005, FR-006, US3-7)
- [X] T035 [US3] Extend `apps/api/tests/unit/trucks/lifecycle/return_to_service.spec.ts` using T017's scenario: returning a suspended truck whose transport company is archived is refused with `E_TRUCK_TRANSPORT_COMPANY_ARCHIVED` and leaves the truck suspended; reactivating the company and retrying then succeeds. **Verified to fail without the gate**: the gate was written into T023 rather than deferred, so its absence was reproduced by disabling the condition and re-running — 4 tests failed, then passed again once restored (FR-007, US4-3)
- [X] T036 [US3] Extend `apps/web/src/features/trucks/__tests__/lifecycle/return-to-service.test.tsx`: an operations lead and an observer can open a suspended truck and are offered no return action (FR-024)

### Implementation for User Story 3

- [X] T037 [US3] Add the transport-company gate to `returnSuspendedToService` in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`: read the truck's `transport_companies` row with `forUpdate` **inside the same transaction**, after the truck's own lock, and return `{ kind: 'TRANSPORT_COMPANY_ARCHIVED' }` unless it is `AVAILABLE`. Carry a comment recording why a plain read would leave a check-then-act window, and why the opposite lock order used by company archival cannot deadlock against it — its truck read takes no row locks (research [D3](./research.md))
- [X] T038 [US3] Map `TRANSPORT_COMPANY_ARCHIVED` to `TruckTransportCompanyArchivedException` in `apps/api/app/trucks/return_to_service/return_truck_to_service_use_case.ts`
- [X] T039 [P] [US3] Confirm no change is needed in `apps/api/app/trucks/shared/truck_lifecycle_blockers.ts` or in either bulk suite: `#252` already taught them `SUSPENDED`, and this slice adds no status value. If a bulk test needs editing, the change has drifted out of scope (research [D6](./research.md))

**Checkpoint**: The return reverses a suspension and nothing else, and can never produce an available truck the site's rules forbid.

---

## Phase 6: User Story 4 — Understand and Recover From a Refused Return (Priority: P2)

**Goal**: Each refusal family is distinguishable and actionable, concurrent attempts collapse to exactly one recorded return, and a refused attempt leaves the truck exactly as it was.

**Independent Test**: Trigger an already-available conflict, an archived-truck conflict, an archived-company conflict, a stale-view conflict, an over-long comment, and a transient failure; verify each produces distinct guidance, the stored state never changes on refusal, and a retry after the blocker is resolved returns the truck exactly once.

### Tests for User Story 4 ⚠️ Write first

- [X] T040 [US4] Extend `apps/api/tests/integration/trucks/lifecycle/return_to_service.spec.ts`: authorization, not-found, already-available, archived-truck, archived-company, validation, and transient-failure conditions each produce distinct codes, and after any refusal the stored row — status and all four context blocks — is unchanged (FR-020, FR-022)
- [X] T041 [US4] Extend `apps/api/tests/unit/trucks/lifecycle/return_to_service.spec.ts`: two near-simultaneous returns of the same truck record exactly one return, with the loser refused as **already available** and no return context overwritten; and a comment over 1,000 characters is refused with `422` while the truck stays suspended (FR-011, FR-021)
- [X] T042 [US4] Extend `apps/web/src/features/trucks/__tests__/lifecycle/return-to-service.test.tsx`: a refused return shows the specific reason and refreshes to the truck's authoritative state, so a stale view resolves itself

### Implementation for User Story 4

- [X] T043 [US4] Add the zero-row fallback to `returnSuspendedToService` in `apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts`, mirroring `suspendAvailable`'s: re-read and classify, because knex emits no `FOR UPDATE` on SQLite. Classify a re-read showing `AVAILABLE` as `ALREADY_AVAILABLE` — **not** the `NOT_FOUND` the suspend path returns for its own stale-read case, since here it means another return won the race (research [D5](./research.md))
- [X] T044 [US4] Confirm the failure branch of `apps/web/src/features/trucks/ui/truck-lifecycle-actions.tsx` covers the new action: `refreshTrucks()` is called and the parsed API message surfaced, and the toast reads correctly through T028's failure label rather than interpolating the raw action name

**Checkpoint**: Every refusal explains itself and leaves a safe retry path.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T045 Update `CONTEXT.md`: add the **Returned to Service** entry, and revise **Suspended Truck** — which currently states a suspended truck must return to service before it can be archived, reactivated, or updated while no way to do so exists — plus **Truck**, **Rotation-Eligible Truck**, and **Available Site Reference**. The **Rotation-Eligible Truck** revision carries the forward constraint from research [D7](./research.md): the return restores eligibility under the existing rules, and a rotation already in progress is unaffected and does not become a second concurrent rotation
- [X] T046 [P] Mark `#253` as implemented in `specs/site-references/transport-resources/trucks/roadmap.md`, and update the note stating that suspension's reverse transition is pending
- [X] T047 Run the repository gates: `pnpm check`, `pnpm typecheck`, `pnpm test`. Include a `pnpm --filter @portflow/api db:fresh` run — the new `AVAILABLE` fixture joins `operationalTrucks` and redistributes the 24 generated historical discharges across four trucks instead of three (research [D10](./research.md))
- [X] T048 Walked the manual browser flow in [quickstart.md](./quickstart.md) step 6 against an **isolated scratch database**, not the shared dev one, because another worktree's session was using it. Confirmed end to end: the return action on a suspended truck, the success path with the workspace following the truck to the available tab (Available 4→5, Suspended 1→0 with no manual refresh), both context blocks newest-first in the detail pane, Edit/Suspend/Archive offered again, the archived-company refusal carrying the corrected message, the recovery after reactivating the company, and an operations lead seeing the suspended collection with dates and comments but no actor fields and a `403` on the return. Not walked: the mobile viewport and the two-session concurrency check — both are covered by automated tests. Originally read: walk as both administrator roles, on desktop and on a mobile viewport, including the concurrent-return check and the operations-lead and observer visibility checks. Step 6's archived-company sequence is the one worth doing by hand: it is the only rule in the slice that is not the mirror of suspension, and the only one an administrator can hit without doing anything wrong
- [ ] T049 Obtain a fresh read-only review of the final diff per constitution principle VII, resolving or explicitly justifying every confirmed finding

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T002 gates T008/T009
- **Foundational (Phase 2)**: depends on Setup — **blocks every user story**
- **US1 (Phase 3)**: depends on Foundational. Delivers the MVP
- **US2 (Phase 4)**: depends on US1 — it asserts properties of the `returnSuspendedToService` written in T023
- **US3 (Phase 5)**: depends on US1 — T037 extends T023's method and T038 extends T024's use case
- **US4 (Phase 6)**: depends on US1 and US3 — T043 extends the same method, T044 extends T028's component
- **Polish (Phase 7)**: depends on all desired stories

### Critical path

`T003 → T005 → T006 → T007 → T023 → T024 → T025 → T026 → T037`

T037 is on the critical path despite sitting in Phase 5: without it the slice ships a rule-breaking write. It is deliberately *not* folded into T023 so that T035 fails first.

### Within Each User Story

- Tests are written first and must fail before implementation
- Repository method → use case → controller → route → generated types
- API before web, since the web adapter consumes Tuyau types generated from the routes

### Parallel Opportunities

- **Phase 2**: T008–T017 are ten different files and run in parallel once T006 and T007 land. T003 → T004 → T005 → T006 → T007 is a strict chain
- **Phase 3**: T018–T022 in parallel (five different files); then T027, and T029 and T030 in parallel once T026 has regenerated the Tuyau types. T028 depends on T027
- **Phase 4**: T031 and T032 are different files but extend suites T019 and T018 wrote; run them after Phase 3, then in parallel with each other
- **Phase 5**: T034, T035, and T036 are three different files and run in parallel; T037 → T038 are sequential
- **Phase 6**: T040, T041, and T042 are three different files and run in parallel
- **Phase 7**: T046 runs in parallel with T045

Test suites are shared across phases by design — `return_to_service.spec.ts` (unit and integration) and `return-to-service.test.tsx` each grow through four phases. Tasks that extend the same file are never marked `[P]` with each other, and phase order keeps them sequential.

## Parallel Example: User Story 3

```bash
# Three different files — write all three refusal suites together:
Task: "Authorization and lifecycle refusals in apps/api/tests/integration/trucks/lifecycle/return_to_service.spec.ts"
Task: "Archived-transport-company refusal in apps/api/tests/unit/trucks/lifecycle/return_to_service.spec.ts"
Task: "No return action for non-administrators in apps/web/src/features/trucks/__tests__/lifecycle/return-to-service.test.tsx"

# Then the gate itself, which must be sequential — one repository method, one use case:
Task: "Transport-company FOR UPDATE gate in apps/api/app/trucks/shared/repositories/lucid_truck_repository.ts"
Task: "TRANSPORT_COMPANY_ARCHIVED mapping in apps/api/app/trucks/return_to_service/return_truck_to_service_use_case.ts"
```

---

## Implementation Strategy

### MVP scope

**Phases 1–3 (T001–T030).** A suspended truck can be returned to service, rejoins the available collection, and its full lifecycle history is readable. That is the outcome the issue asks for and it is demonstrable on its own.

**Do not ship the MVP alone.** Until T037 lands, the return will happily produce an available truck under an archived transport company — a broken domain invariant, not a missing feature. **Phases 1–3 and 5 together are the smallest safely shippable increment**, the same shape `#252` had.

### Incremental delivery

1. Setup + Foundational → schema carries the return context; refusal vocabulary in place
2. + US1 → the return works end to end (MVP)
3. + US3 → the transport-company gate closes; safe to merge
4. + US2 → the preserved-assignment behaviour is pinned by tests
5. + US4 → refusals are legible, idempotent, and recoverable
6. Polish → vocabulary, roadmap, gates, browser flow, review

### Boundary closed, and the one still open

`#252` shipped a state a truck could enter but not leave, and said so in its own interface. T028 removes that message because the action now exists — after this slice no truck lifecycle state is a dead end.

US2 scenario 4 stays open: rotations do not exist in the codebase, so the continuation rules ship as `CONTEXT.md` constraints (T045) rather than code. Confirmed at the T002 gate.

---

## Notes

- `[P]` means a different file from every other task in the phase, with no incomplete dependency
- Every acceptance scenario in spec.md maps to a test task; US2 scenario 4 is the documented exception
- Verify each test fails before implementing it — T035 is the one that matters most, because a happy-path implementation would pass everything else
- Commit after each task or logical group; Conventional Commits, on this branch, never on `master`
