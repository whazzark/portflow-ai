# Quickstart: Validate Truck Suspension

**Feature**: `GH-252` | **Spec**: [spec.md](./spec.md) | **Contract**: [contracts/http-api.md](./contracts/http-api.md) | **Data model**: [data-model.md](./data-model.md)

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

Confirm the seeded dataset provides at least: one `AVAILABLE` truck, one `AVAILABLE` truck reserved
by a planned or active discharge, one `SUSPENDED` truck, one `ARCHIVED` truck, and one truck that was
archived and later reactivated (so the preserved archive/reactivation context is observable next to a
new suspension).

### 1b. Verify the migration on **both** dialects — not optional

This is the one step that cannot be inferred from a green test run, because the test suite only ever
builds a fresh SQLite schema. Research [D2](./research.md) records that `.alter()` silently produces a
broken schema on SQLite and invalid SQL on PostgreSQL.

```bash
# SQLite path — exercised by the suites in step 2, but assert the constraint directly
pnpm --filter @portflow/api test unit --files=tests/unit/trucks/lifecycle/suspend.spec.ts

# PostgreSQL path — run against a real database, forwards and backwards
pnpm --filter @portflow/api db:migrate
pnpm --filter @portflow/api db:rollback
pnpm --filter @portflow/api db:migrate
```

Expected on PostgreSQL, verified with a direct query:

- exactly one check constraint on `trucks.status`, admitting all three values
- `CHECK (status != 'SUSPENDED' OR suspended_at IS NOT NULL)` present
- `trucks_registration_unique` and `trucks_status_index` still present
- `INSERT … status = 'SUSPENDED'` without `suspended_at` is **refused**
- `INSERT … status = 'BOGUS'` is **refused**
- rollback restores the two-value constraint and drops the three new columns

## 2. Run focused API verification

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/trucks/lifecycle/suspend.spec.ts
pnpm --filter @portflow/api test integration \
  --files=tests/integration/trucks/lifecycle/suspend.spec.ts
```

These must cover, per spec:

| Behaviour | Spec |
|---|---|
| Both administrator roles suspend an available truck; time, actor, comment recorded | FR-002, FR-008 |
| Comment absent / empty / whitespace-only ⇒ stored as `null`; comment trimmed | FR-009 |
| Comment over 1,000 characters ⇒ `422`, no lifecycle change | FR-010 |
| Unauthenticated, inactive, operations lead, observer ⇒ denied, no change | FR-003 |
| Unknown truck ⇒ `404` | FR-004 |
| Already suspended ⇒ `409 E_TRUCK_ALREADY_SUSPENDED`, existing context untouched | FR-005 |
| Archived truck ⇒ `409 E_TRUCK_ARCHIVED_CANNOT_SUSPEND`, stays archived | FR-006 |
| **Truck reserved by a planned or active discharge ⇒ suspension SUCCEEDS**, assignment rows unchanged | FR-017, FR-018 |
| **Truck assigned to an active shift ⇒ suspension SUCCEEDS**, `shift_trucks` rows unchanged | FR-018 |
| Registration, model, capacity, company, and any archive/reactivation context preserved | FR-011 |
| Concurrent double-suspend ⇒ exactly one recorded suspension, the loser refused | FR-022 |
| A refused suspension leaves the row byte-for-byte unchanged | FR-023 |

The two rows in bold are the point of the slice — they are precisely where suspension must behave
*unlike* archival. Reuse `createReservedTruckScenario` from `tests/support/trucks/lifecycle_fixtures.ts`,
which archival's suites already use to assert the opposite outcome.

## 3. Run the regression suites for the paths a third state breaks

Research [D3](./research.md) documents four delivered paths that read status as a boolean. These
suites already exist and must be extended, not just re-run green:

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/trucks/lifecycle/archive.spec.ts \
  --files=tests/unit/trucks/lifecycle/reactivate.spec.ts \
  --files=tests/unit/trucks/lifecycle/bulk/archive.spec.ts \
  --files=tests/unit/trucks/lifecycle/bulk/reactivate.spec.ts \
  --files=tests/unit/trucks/administration/update.spec.ts \
  --files=tests/unit/trucks/consultation/list.spec.ts
pnpm --filter @portflow/api test integration --files=tests/integration/trucks
```

New cases required in each:

- **archive** — archiving a suspended truck is refused with `E_TRUCK_SUSPENDED` and leaves it
  suspended. *Without the fix this test fails by succeeding.*
- **reactivate** — reactivating a suspended truck is refused with `E_TRUCK_SUSPENDED`.
  *Without the fix this test fails by succeeding.*
- **bulk archive / bulk reactivate** — a suspended truck in the selection is reported with
  `reason: 'SUSPENDED'`, the eligible trucks still change state, and the request returns `200`,
  not the `500` the row-count assertion would otherwise raise.
- **update** — updating a suspended truck is refused with `E_TRUCK_SUSPENDED`, not
  `E_TRUCK_ARCHIVED`.
- **list / available** — a suspended truck appears in `GET /trucks` for administrators and is absent
  from `GET /trucks/available` for every role.

## 4. Run the web feature tests

```bash
pnpm --dir apps/web exec vitest run src/features/trucks
```

New and extended coverage:

- the suspended tab lists suspended trucks, shows its count, and is offered to administrators only
- a non-administrator never sees the suspended tab and never receives a suspended truck
- suspending from the details panel calls `trucks.suspend`, shows success, and moves the truck out of
  the available tab without a manual refresh
- a refused suspension shows the specific reason and refreshes to the authoritative state
- a suspended truck shows **no** edit button and **no** lifecycle action, with the line explaining
  that it must be returned to service first
- selecting a suspended truck keeps the workspace on the suspended tab (the regression from research
  [D10](./research.md): the old two-way mapping bounces it to `available` and then clears it)
- the suspended tab offers no selection checkboxes and no bulk toolbar
- the overview total counts all three states

## 5. Repository gates

```bash
pnpm check
pnpm typecheck
pnpm test
```

All must pass before the PR is marked ready. `pnpm test` must confirm the merged truck, transport
company, discharge, and site-reference suites still pass — widening `TruckStatus` is a type change
that reaches every consumer of the truck model.

## 6. Manual browser flow

```bash
pnpm dev
```

As an organization administrator, then repeated as an operations administrator:

1. Open the transport-resources workspace and select a transport company.
2. On an available truck, open details and confirm **both** `Archive truck` and `Suspend truck` are
   offered.
3. Suspend it with a comment. Confirm the success toast, that the truck leaves the available tab and
   its count, and that it appears in the suspended tab with its count.
4. Open the suspended truck. Confirm the badge and status field read *Suspended* and are visually
   distinct from both *Available* and *Archived*; confirm the suspension time, actor, and comment are
   shown; confirm any earlier archive and reactivation context is still readable.
5. Confirm no `Edit truck` button and no lifecycle action is offered, and that the explanation names
   returning the truck to service as the next step.
6. Suspend a truck that is reserved by a planned discharge. Confirm it succeeds, and that the
   discharge still lists the truck.
7. In a second browser session, suspend the same truck concurrently. Confirm exactly one suspension
   is recorded and the second attempt reports *already suspended* and refreshes.
8. Select the suspended truck in the archived-tab bulk flow — confirm it is not selectable there.
9. Sign in as an operations lead and as an observer. Confirm neither sees the suspended tab and
   neither receives suspended trucks in any selection list.
10. Repeat step 3 on a mobile viewport.

## Known boundary to confirm, not to fix

After step 3 the truck cannot be returned to service through the product. That is issue `#253`, and
it is the expected outcome of this slice — see the plan's Constitution Check. Confirm the interface
says so rather than failing silently.
