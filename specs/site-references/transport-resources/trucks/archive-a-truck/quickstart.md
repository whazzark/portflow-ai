# Quickstart: Validate Truck Archival

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

Confirm the seeded dataset provides at least: one `AVAILABLE` truck with no discharge involvement,
one `AVAILABLE` truck reserved by a `PLANNED` or `ACTIVE` discharge through an unreleased
`discharge_truck_assignments` row, one truck whose only assignments belong to a closed discharge or
carry a `released_at` value, one already-`ARCHIVED` truck, and one truck whose transport company is
itself `ARCHIVED`. The authoritative fields, transitions, and eligibility rules are defined in
[data-model.md](./data-model.md); the request/response shape and failure codes are defined in
[contracts/http-api.md](./contracts/http-api.md).

## 2. Run focused API verification

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/trucks/lifecycle/archive.spec.ts \
  --files=tests/unit/trucks/lifecycle/bulk/archive.spec.ts
pnpm --filter @portflow/api test integration \
  --files=tests/integration/trucks/lifecycle/archive.spec.ts \
  --files=tests/integration/trucks/lifecycle/bulk/archive.spec.ts
```

Expected outcomes:

- Unauthenticated users and active roles other than organization administrator and operations
  administrator receive `401`/`403`, with no lifecycle change and no truck data disclosed.
- An organization administrator and an operations administrator can each archive an eligible
  available truck; it is returned with `status: "ARCHIVED"`, a server-set `archivedAt`, the caller
  as `archivedByUserId` with a populated `archivedBy`, and the supplied comment.
- Archiving without a comment, with `null`, or with a whitespace-only comment records `null`; a
  comment longer than 1000 characters is rejected with `422` and no lifecycle change.
- `registration`, `vehicleModel`, `capacityTonnes`, `transportCompanyId`, and any pre-existing
  reactivation context are byte-for-byte unchanged after archival.
- Archiving a truck reserved by a planned or active discharge through an unreleased assignment is
  refused with `409 E_TRUCK_IN_USE` and the truck stays `AVAILABLE`.
- Archiving a truck whose assignments are all released, or belong only to closed discharges,
  succeeds — released and historical usage never blocks archival.
- Archiving an already-archived truck is refused with `409 E_TRUCK_ALREADY_ARCHIVED` and its
  existing archive time, actor, and comment are left unchanged.
- Archiving an unknown identifier is refused with `404 E_TRUCK_NOT_FOUND` and no other truck is
  modified.
- Two near-simultaneous archival requests for the same truck yield exactly one `200` and one
  `409 E_TRUCK_ALREADY_ARCHIVED`, with exactly one archive time, actor, and comment recorded.
- A truck whose transport company is `ARCHIVED` can still be archived.
- After archival, `GET /api/v1/trucks/available` omits the truck and `GET /api/v1/trucks` still
  returns it with `status: "ARCHIVED"`.
- Every refused attempt leaves the truck row unchanged (no partial archive context).

Multiple archival, on `POST /api/v1/trucks/archive`:

- A submission of several eligible trucks archives all of them, and every archived truck carries an
  identical `archivedAt`, `archivedByUserId`, and `archiveComment`.
- A mixed submission — eligible trucks plus one reserved, one already archived, one unknown id —
  returns `200` with exactly the eligible trucks in `updatedTrucks`, and the other three in
  `blockedTrucks` with reasons `IN_USE`, `ALREADY_ARCHIVED`, and `NOT_FOUND` respectively.
- A `NOT_FOUND` blocker omits `registration`; the others carry it.
- `updatedTrucks` preserves the order of the submitted ids.
- A submission in which every truck is ineligible returns `200`, archives nothing, and reports a
  reason for each one.
- An empty `ids` array, a non-UUID entry, or the same id submitted twice is rejected with `422` and
  archives nothing.
- Blocked trucks are byte-for-byte unchanged: no status, timestamp, actor, or comment written.
- A forced failure during the commit leaves **no** truck in the submission archived, and retrying
  the identical selection then succeeds.
- Two overlapping submissions archive each shared truck exactly once; the losing submission reports
  it as `ALREADY_ARCHIVED` without overwriting the recorded archive context.
- An unauthenticated user or a non-administrator role is denied the whole submission with zero
  lifecycle changes.

## 3. Run focused web verification

```bash
pnpm --dir apps/web exec vitest run src/features/trucks
```

Expected outcomes:

- Only organization administrators and operations administrators see an archive control in the
  truck details panel; other active roles do not see or reach it.
- The archive control is offered only for `AVAILABLE` trucks; an archived truck's details show no
  archive action in this slice.
- Confirming the archive dialog with an optional comment archives the truck, shows a success toast,
  and updates the workspace without a manual refresh: the truck leaves the available tab and its
  count, and appears in the administrator-only archived tab with its archive context.
- An in-use refusal surfaces a distinct, actionable message naming the current-discharge reason,
  and the truck remains in the available tab.
- An already-archived refusal (stale view) surfaces a distinct message and the refreshed view shows
  the truck's authoritative archived state.
- A transient failure shows a distinct, retryable error, and retrying after recovery archives the
  truck exactly once.
- Cancelling the confirmation dialog performs no mutation and leaves the truck available.

Selection and multiple archival:

- Selection controls appear only for administrators, and only in the available view.
- Selecting several trucks shows the selected count; clearing the selection removes the toolbar.
- Archiving a selection removes every archived truck from the available tab and updates both
  lifecycle counts without a manual refresh.
- A mixed outcome reports the unchanged trucks by registration with a readable reason, and the
  "retry blocked" action resubmits only those trucks.
- Switching the lifecycle tab or changing the transport-company filter drops selected trucks that
  are not listed in the new scope.
- Typing a search term does **not** drop selected trucks that it hides.
- A selected truck's row checkbox is independently reachable by keyboard and does not open the
  details panel; the row's details button still does.

## 4. Run repository verification

```bash
pnpm check
pnpm typecheck
pnpm test
```

All commands must pass before the PR is marked ready. `pnpm test` must confirm the existing customer
lifecycle and bulk suites still pass unchanged after `lifecycleComment()` and `lifecycleIds()` move
to `site_references/shared/site_reference_validator.ts`. Because no Playwright suite/script is
currently configured, also complete the affected browser flow below.

## 5. Exercise the affected browser flow

Start both workspaces:

```bash
pnpm dev
```

Then validate in a desktop viewport and a narrow mobile viewport:

1. Sign in as an active observer and open **Site references → Transport resources → Trucks**; open
   an available truck and confirm no archive control is visible. Confirm a direct
   `POST /api/v1/trucks/:id/archive` from this session returns `403` with no lifecycle change.
2. Sign in as an active operations lead and repeat step 1; confirm the same denial.
3. Sign in as an active operations administrator, open an eligible available truck, archive it with
   a comment, and confirm: a success toast appears, the truck disappears from the available tab and
   its count decreases, and it appears in the archived tab with the archive time, your name, and the
   comment.
4. Archive a second eligible truck without a comment; confirm it is archived with no comment shown.
5. Open a truck reserved by a planned or active discharge and attempt to archive it; confirm a
   specific in-use message is shown and the truck remains available.
6. In two browser tabs, open the same available truck, archive it in the first, then archive it in
   the second; confirm the second attempt reports an already-archived conflict and the archive
   context recorded by the first attempt is unchanged.
7. Confirm an archived truck is still fully readable — registration, vehicle model, capacity, and
   transport company are unchanged — and that it does not appear in the available collection.
8. Archive a truck whose transport company is archived; confirm it succeeds and both lifecycle
   states are presented independently.
9. Sign in as an active organization administrator and repeat step 3 to confirm the same capability
   is available to that role.
10. Select three available trucks with their row checkboxes, confirm the count shown, archive them
    in one action with a comment, and confirm all three leave the available tab and share an
    identical archive time, actor, and comment in their details.
11. Select a batch mixing eligible trucks with one reserved by a planned or active discharge;
    archive it and confirm the eligible ones are archived while the reserved one stays available and
    is listed as unchanged with a readable reason.
12. Use the retry action on the blocked trucks; confirm only those are resubmitted.
13. Select trucks in the available tab, then switch to the archived tab and change the
    transport-company filter; confirm the selection no longer offers trucks absent from the new
    scope, then confirm a search term does not drop selected trucks it merely hides.
14. Repeat step 10 in a narrow mobile viewport and confirm the selection toolbar remains reachable
    and does not obscure the directory.
