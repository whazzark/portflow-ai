# Quickstart: Validate Returning a Truck to Service

**Feature**: `GH-253` | **Spec**: [spec.md](./spec.md) | **Contract**: [contracts/http-api.md](./contracts/http-api.md) | **Data model**: [data-model.md](./data-model.md)

## Prerequisites

- Node.js compatible with the repository toolchain
- PNPM 10.28.1
- Repository dependencies installed with `pnpm install`
- API and web environment files configured from their checked-in examples
- PostgreSQL available for the manual browser flow and for step 1b; automated API tests use
  in-memory SQLite

## 1. Prepare the development dataset

```bash
pnpm --filter @portflow/api db:fresh
```

Confirm the seeded dataset provides at least: one `SUSPENDED` truck (the subject of the new action),
one truck that was suspended and **returned to service** (so the two-context history is observable),
one truck that was archived and later reactivated, one `ARCHIVED` truck, and one plain `AVAILABLE`
truck.

**Check the side effect, do not assume it.** The returned fixture is `AVAILABLE`, so it joins
`operationalTrucks` in `database/fixtures/discharge_preparation.ts` and redistributes the 24 generated
historical discharges across four trucks instead of three (research [D10](./research.md)). Confirm the
seeder completes and the full suite in step 5 stays green.

### 1b. Verify the migration on both dialects

Routine here, unlike `#252`: the migration adds three nullable columns and changes no constraint
(research [D2](./research.md)).

```bash
pnpm --filter @portflow/api db:migrate
pnpm --filter @portflow/api db:rollback
pnpm --filter @portflow/api db:migrate
```

Expected on PostgreSQL:

- the three columns exist, all nullable
- `returned_to_service_by_user_id` is a FK to `users.id` with `ON DELETE SET NULL`
- the delivered `trucks_status_check` and `trucks_suspended_at_check` are **unchanged**
- an `AVAILABLE` row carrying a non-null `suspended_at` — a returned truck — inserts without complaint
- rollback drops the three columns and leaves suspension intact

## 2. Run focused API verification

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/trucks/lifecycle/return_to_service.spec.ts
pnpm --filter @portflow/api test integration \
  --files=tests/integration/trucks/lifecycle/return_to_service.spec.ts
```

These must cover, per spec:

| Behaviour | Spec |
|---|---|
| Both administrator roles return a suspended truck; time, actor, comment recorded | FR-002, FR-009 |
| Comment absent / empty / whitespace-only ⇒ stored as `null`; comment trimmed | FR-010 |
| Comment over 1,000 characters ⇒ `422`, truck stays suspended | FR-011 |
| Unauthenticated, inactive, operations lead, observer ⇒ denied, no change | FR-003 |
| Unknown truck ⇒ `404` | FR-004 |
| Already available ⇒ `409 E_TRUCK_ALREADY_AVAILABLE`, context untouched | FR-005 |
| Archived truck ⇒ `409 E_TRUCK_ARCHIVED_CANNOT_RETURN`, stays archived | FR-006 |
| **Archived transport company ⇒ `409`, truck stays suspended; reactivating the company then lets the return succeed** | FR-007, US4-3 |
| Registration, model, capacity, company, and archive/reactivation context preserved | FR-012 |
| **Suspension context still readable after the return** | FR-013, US1-6 |
| Suspend → return → suspend again keeps the latest suspension and the preceding return | US1-7 |
| Truck reserved by a planned discharge and assigned to an active shift ⇒ return succeeds, rows unchanged | FR-017, FR-018 |
| Returned truck is present in `/trucks/available` and absent from `/trucks/suspended` | FR-014, FR-015 |
| Returned truck can then be archived, suspended, and updated like any available truck | US3-7 |
| Concurrent double-return ⇒ exactly one recorded return, the loser refused as already available | FR-021 |
| A refused return leaves the row byte-for-byte unchanged | FR-022 |

The bold rows are where this slice can go wrong. The transport-company gate is the one business rule
that is not simply the mirror image of suspension (research [D3](./research.md)), and preserving the
suspension context is what separates a return from a reactivation.

Reuse `createSuspendedTruckScenario` and `createReservedAndShiftedTruckScenario` from
`tests/support/trucks/lifecycle_fixtures.ts`; add a suspended-truck-with-archived-company scenario
beside the archived-truck one that already exists.

## 3. Run the regression suites for the paths this slice touches

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/trucks/lifecycle/reactivate.spec.ts \
  --files=tests/unit/trucks/lifecycle/suspend.spec.ts \
  --files=tests/unit/database/storage_reference_lifecycle.spec.ts
pnpm --filter @portflow/api test integration --files=tests/integration/trucks
```

What must change, and why:

- **consultation/list** — the exact-property assertion gains the three new fields.
- **consultation/suspended** — a returned truck is absent; the operational variant carries
  `returnedToServiceAt` and `returnToServiceComment` but **not** `returnedToServiceBy`.
- **lifecycle/reactivate** — unchanged in behaviour; only the archived-company message moves
  (research [D4](./research.md)).
- **storage_reference_lifecycle** — extend for the new fixture state.
- Nothing in the bulk suites changes. If a bulk test needs editing, the change has drifted out of
  scope (research [D6](./research.md)).

## 4. Run the web feature tests

```bash
pnpm --dir apps/web exec vitest run src/features/trucks
```

New and extended coverage:

- an administrator sees **Return to service** on a suspended truck, in both the detail footer and the
  row menu; the `truck-suspended-notice` dead-end message is gone
- `__tests__/lifecycle/suspend.test.tsx` asserts that notice today and is updated with the action
- returning from the details panel calls `trucks.return_to_service`, shows success, and moves the
  truck out of the suspended tab into the available tab without a manual refresh
- the workspace follows the truck to the available tab after the return (the selection-sync effect
  already handles three states; assert it rather than trust it)
- a refused return — already available, archived company — shows the specific reason and refreshes to
  the authoritative state
- **the detail pane of a returned truck shows both the return context and the suspension it ended**,
  newest first (research [D8](./research.md)); an archived truck that was previously reactivated shows
  both of its blocks too
- a non-administrator sees a suspended truck but is offered no return action
- the suspended tab still offers no selection checkboxes and no bulk toolbar

## 5. Repository gates

```bash
pnpm check
pnpm typecheck
pnpm test
```

All must pass before the PR is marked ready.

## 6. Manual browser flow

```bash
pnpm dev
```

As an organization administrator, then repeated as an operations administrator:

1. Open the transport-resources workspace and go to the **Suspended** tab.
2. Open a suspended truck. Confirm **Return to service** is offered and the dead-end message is gone.
3. Return it with a comment. Confirm the success toast, that the truck leaves the suspended tab and
   its count, that it appears in the available tab with its count, and that the workspace follows it.
4. Reopen it. Confirm the return time, actor, and comment are shown **and** that the suspension it
   ended is still readable beneath, with the registration, model, capacity, and company unchanged.
5. Confirm **Edit**, **Archive**, and **Suspend** are all offered again on the returned truck.
6. Archive the truck's transport company, suspend one of its trucks — wait: the company can only be
   archived once none of its trucks is available, so suspend the truck **first**, then archive the
   company. Now attempt the return: confirm it is refused, that the reason names reactivating the
   transport company, and that no reassignment is suggested. Reactivate the company and retry;
   confirm it now succeeds.
7. In a second browser session, return the same truck concurrently. Confirm exactly one return is
   recorded and the second attempt reports *already available* and refreshes.
8. Sign in as an operations lead and as an observer. Confirm each sees the suspended tab, can open a
   suspended truck, and is offered **no** return action.
9. Repeat step 3 on a mobile viewport.

Step 6 is the flow worth doing by hand: it is the only rule in the slice that is not the mirror image
of suspension, and the only one an administrator can hit without doing anything wrong.

## Boundary now closed

`#252` shipped a state with no exit and its quickstart said so. After this slice a suspended truck can
be returned to service through the product, and the only remaining gap is the rotation half of the
spec — US2-4 — which has no code to attach to until rotations exist (research [D7](./research.md)).
