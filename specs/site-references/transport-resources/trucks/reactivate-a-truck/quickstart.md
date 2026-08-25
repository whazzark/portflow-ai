# Quickstart: Validate Truck Reactivation

## Prerequisites

- Node.js compatible with the repository toolchain
- PNPM 10.28.1
- Repository dependencies installed with `pnpm install`
- API and web environment files configured from their checked-in examples
- PostgreSQL available for the manual browser flow; automated API tests use in-memory SQLite

## 1. Prepare the development dataset

```bash
pnpm --filter @portflow/api db:fresh
```

Confirm the seeded dataset provides at least: one `ARCHIVED` truck whose transport company is
`AVAILABLE`, one `ARCHIVED` truck whose transport company is `ARCHIVED`, one truck already archived
*and* previously reactivated (so the replaced reactivation context is observable), one `AVAILABLE`
truck, and one `AVAILABLE` transport company that can be archived during the concurrency check. The
authoritative fields, transitions, and eligibility rules are defined in
[data-model.md](./data-model.md); the request/response shape and failure codes are defined in
[contracts/http-api.md](./contracts/http-api.md).

## 2. Run focused API verification

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/trucks/lifecycle/reactivate.spec.ts \
  --files=tests/unit/trucks/lifecycle/bulk/reactivate.spec.ts
pnpm --filter @portflow/api test integration \
  --files=tests/integration/trucks/lifecycle/reactivate.spec.ts \
  --files=tests/integration/trucks/lifecycle/bulk/reactivate.spec.ts
```

Expected outcomes:

- Unauthenticated users and active roles other than organization administrator and operations
  administrator receive `401`/`403`, with no lifecycle change and no truck data disclosed.
- An organization administrator and an operations administrator can each reactivate an eligible
  archived truck; it is returned with `status: "AVAILABLE"`, a server-set `reactivatedAt`, the
  caller as `reactivatedByUserId` with a populated `reactivatedBy`, and the supplied comment.
- Reactivating without a comment, with `null`, or with a whitespace-only comment records `null`; a
  comment longer than 1000 characters is rejected with `422` and no lifecycle change.
- `registration`, `vehicleModel`, `capacityTonnes`, and `transportCompanyId` are byte-for-byte
  unchanged after reactivation, and so are `archivedAt`, `archivedByUserId`, and `archiveComment`.
- A truck that had an earlier reactivation context has it **replaced** by the new one, while its
  archive context stays as recorded by the most recent archival.
- Reactivating a truck whose transport company is `ARCHIVED` is refused with
  `409 E_TRUCK_TRANSPORT_COMPANY_ARCHIVED`, the truck stays `ARCHIVED`, and the message names the
  remedy. Reactivating the same truck after its company becomes `AVAILABLE` succeeds.
- Reactivating an already-available truck is refused with `409 E_TRUCK_ALREADY_AVAILABLE` and its
  existing lifecycle context is left unchanged.
- Reactivating an unknown identifier is refused with `404 E_TRUCK_NOT_FOUND` and no other truck is
  modified.
- Two near-simultaneous reactivation requests for the same truck yield exactly one `200` and one
  `409 E_TRUCK_ALREADY_AVAILABLE`, with exactly one reactivation time, actor, and comment recorded.
- **Invariant check (SC-011)**: a reactivation racing an archival of the same transport company
  resolves in exactly one direction — either the reactivation is refused with
  `E_TRUCK_TRANSPORT_COMPANY_ARCHIVED`, or the company archival is refused because the company now
  provides an available truck. No interleaving leaves an `AVAILABLE` truck under an `ARCHIVED`
  company. Assert this by querying for that combination after the race and finding none.
- After reactivation, `GET /api/v1/trucks/available` includes the truck and `GET /api/v1/trucks`
  returns it with `status: "AVAILABLE"`.
- No discharge, rotation, or assignment row is created, modified, or restored by a reactivation.
- Every refused attempt leaves the truck row unchanged (no partial reactivation context).

Multiple reactivation, on `POST /api/v1/trucks/reactivate`:

- A submission of several eligible trucks reactivates all of them, and every reactivated truck
  carries an identical `reactivatedAt`, `reactivatedByUserId`, and `reactivationComment`.
- A mixed submission — eligible trucks plus one whose company is archived, one already available,
  one unknown id — returns `200` with exactly the eligible trucks in `updatedTrucks`, and the other
  three in `blockedTrucks` with reasons `TRANSPORT_COMPANY_ARCHIVED`, `ALREADY_AVAILABLE`, and
  `NOT_FOUND` respectively.
- A `NOT_FOUND` blocker omits `registration`; the others carry it.
- `updatedTrucks` preserves the order of the submitted ids.
- A submission in which every truck is ineligible returns `200`, reactivates nothing, and reports a
  reason for each one.
- An empty `ids` array, a non-UUID entry, or the same id submitted twice is rejected with `422` and
  reactivates nothing.
- Blocked trucks are byte-for-byte unchanged: no status, timestamp, actor, or comment written.
- A forced failure during the commit leaves **no** truck in the submission reactivated, and retrying
  the identical selection then succeeds.
- Two overlapping submissions reactivate each shared truck exactly once; the losing submission
  reports it as `ALREADY_AVAILABLE` without overwriting the recorded reactivation context.
- An unauthenticated user or a non-administrator role is denied the whole submission with zero
  lifecycle changes.

Regression, because `findBulkBlockers` is generalized in place:

```bash
pnpm --filter @portflow/api test unit --files=tests/unit/trucks/lifecycle/bulk/archive.spec.ts
pnpm --filter @portflow/api test integration --files=tests/integration/trucks/lifecycle/bulk/archive.spec.ts
```

The merged archive suites must pass unchanged: adding the `expectedStatus` argument must not alter
any archive classification.

## 3. Run focused web verification

```bash
pnpm --dir apps/web exec vitest run src/features/trucks
```

Expected outcomes:

- Only organization administrators and operations administrators see a reactivate control in an
  archived truck's details panel; other active roles do not see or reach it, and non-administrators
  cannot reach the archived view at all.
- The reactivate control is offered only for `ARCHIVED` trucks, and an archived truck's panel offers
  no edit control — archived trucks stay read-only.
- Confirming the reactivate dialog with an optional comment reactivates the truck, shows a success
  toast, and updates the workspace without a manual refresh: the truck leaves the archived tab and
  its count, and appears in the available tab with its reactivation context.
- An archived-provider refusal surfaces a distinct, actionable message naming the company remedy,
  and the truck remains in the archived tab.
- An already-available refusal (stale view) surfaces a distinct message and the refreshed view shows
  the truck's authoritative available state.
- A transient failure shows a distinct, retryable error, and retrying after recovery reactivates the
  truck exactly once.
- Cancelling the confirmation dialog performs no mutation and leaves the truck archived.

Selection and multiple reactivation:

- Selection controls now appear for administrators in **both** the available and archived views, and
  the toolbar action matches the view it is shown in (archive in available, reactivate in archived).
- Selecting several archived trucks shows the selected count; clearing the selection removes the
  toolbar.
- Reactivating a selection removes every reactivated truck from the archived tab and updates both
  lifecycle counts without a manual refresh.
- A mixed outcome reports the unchanged trucks by registration with a readable reason — including
  the archived-provider reason — and the "retry blocked" action resubmits only those trucks.
- Switching the lifecycle tab or changing the transport-company filter drops selected trucks that
  are not listed in the new scope; a selection made in the archived tab is never carried into an
  archive action.
- Typing a search term does **not** drop selected trucks that it hides.
- The existing archive selection flow in the available tab still behaves exactly as `#225` delivered
  it.

## 4. Run repository verification

```bash
pnpm check
pnpm typecheck
pnpm test
```

All commands must pass before the PR is marked ready. `pnpm test` must confirm the merged truck
archive suites (single and bulk, API and web) still pass unchanged after `findBulkBlockers` gains
its `expectedStatus` argument and `truck-details.tsx` gains an archived-truck footer. Because no
Playwright suite/script is currently configured, also complete the affected browser flow below.

## 5. Exercise the affected browser flow

Start both workspaces:

```bash
pnpm dev
```

Then validate in a desktop viewport and a narrow mobile viewport:

1. Sign in as an active observer and open **Site references → Transport resources → Trucks**;
   confirm no archived view and no reactivate control are reachable. Confirm a direct
   `POST /api/v1/trucks/:id/reactivate` from this session returns `403` with no lifecycle change.
2. Sign in as an active operations lead and repeat step 1; confirm the same denial.
3. Sign in as an active operations administrator, open the archived tab, open a truck whose
   transport company is available, reactivate it with a comment, and confirm: a success toast
   appears, the truck disappears from the archived tab and its count decreases, and it appears in
   the available tab with the reactivation time, your name, and the comment — while its archive
   context remains readable.
4. Reactivate a second eligible truck without a comment; confirm it is reactivated with no comment
   shown.
5. Open an archived truck whose transport company is archived and attempt to reactivate it; confirm
   a specific message names the company as the blocker and states the remedy, and the truck remains
   archived.
6. In two browser tabs, open the same archived truck, reactivate it in the first, then reactivate it
   in the second; confirm the second attempt reports an already-available conflict and the
   reactivation context recorded by the first attempt is unchanged.
7. Confirm a reactivated truck is offered again wherever trucks are chosen for new operational work,
   and that no discharge was created or altered by the reactivation.
8. Archive the truck reactivated in step 3, then reactivate it again; confirm the archive context
   reflects the newer archival and the reactivation context reflects the newer reactivation.
9. Sign in as an active organization administrator and repeat step 3 to confirm the same capability
   is available to that role.
10. Select three eligible archived trucks with their row checkboxes, confirm the count shown,
    reactivate them in one action with a comment, and confirm all three leave the archived tab and
    share an identical reactivation time, actor, and comment in their details.
11. Select a batch mixing eligible archived trucks with one whose company is archived; reactivate it
    and confirm the eligible ones return to service while the blocked one stays archived and is
    listed as unchanged with a readable reason.
12. Use the retry action on the blocked trucks; confirm only those are resubmitted.
13. Select trucks in the archived tab, then switch to the available tab and change the
    transport-company filter; confirm the selection no longer offers trucks absent from the new
    scope, then confirm a search term does not drop selected trucks it merely hides.
14. Repeat step 10 in a narrow mobile viewport and confirm the selection toolbar remains reachable
    and does not obscure the directory.
15. Regression: repeat the `#225` archive flow — select and archive several available trucks — and
    confirm it behaves exactly as before.

## 6. Note on the archived-provider remedy

Step 5 leaves a truck the administrator currently cannot recover: Reactivate a Transport Company
(`#221`) is not implemented, and Update a Truck (`#224`) refuses to reassign an archived truck's
provider. Reaching that state requires archiving a truck and then archiving its company, which
Archive a Transport Company (`#220`) permits. This slice reports the blocker correctly; clearing it
depends on `#221`. See research.md for the options and plan.md for the reviewer decision it needs.
