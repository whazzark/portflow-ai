# Quickstart: Validate Updating a Truck

## Prerequisites

- Node.js compatible with the repository toolchain
- PNPM 10.28.1
- Repository dependencies installed with `pnpm install`
- API and web environment files configured from their checked-in examples
- PostgreSQL available for the manual browser flow; automated API tests use in-memory SQLite

## 1. Prepare the dataset

```bash
pnpm --filter @portflow/api db:fresh
```

No migration accompanies this slice. This step only re-seeds the fixtures so the manual flow has
available and archived trucks, several transport companies, and at least one truck assigned to a
planned or active discharge through the discharge-preparation seeder.

Authoritative field rules, the repository contract, and the order in which refusals are reported are
defined in [data-model.md](./data-model.md); request and response shapes are defined in
[contracts/http-api.md](./contracts/http-api.md).

## 2. Run focused API verification

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/trucks/administration/update.spec.ts
pnpm --filter @portflow/api test integration \
  --files=tests/integration/trucks/administration/update.spec.ts
```

Expected outcomes:

- An unauthenticated request is refused with `401` and changes nothing.
- An active observer and an active operations lead are each refused with `403` and change nothing.
- Both administration roles update an available truck and receive the complete updated record.
- The response preserves `id`, `status`, `createdAt`, and every archive and reactivation field, and
  advances `updatedAt`.
- A registration and vehicle model with surrounding whitespace are stored trimmed, with display
  casing preserved.
- Sending `"vehicleModel": null` clears the model; omitting the key entirely is refused with `422`
  rather than silently clearing it.
- A blank registration, a 256-character registration, a whitespace-only vehicle model, a zero,
  negative, or non-numeric capacity, and a capacity with 4 decimal places are each refused with
  `422`, and the stored truck is unchanged.
- A 255-character registration and a capacity with exactly 3 decimal places are accepted.
- A registration already used by another truck — available or archived, differing only by letter
  case or surrounding whitespace — is refused with `409 E_TRUCK_REGISTRATION_CONFLICT`, and neither
  truck changes.
- Resubmitting the truck's own current registration succeeds and is not reported as a duplicate.
- Resubmitting all four current values succeeds as a no-op and advances `updatedAt`.
- Updating an archived truck is refused with `409 E_TRUCK_ARCHIVED`.
- Updating an unknown id is refused with `404 E_TRUCK_NOT_FOUND`.
- Reassigning an uncommitted available truck to another `AVAILABLE` company succeeds.
- Reassigning to an archived or nonexistent company is refused with
  `422 E_TRUCK_TRANSPORT_COMPANY_INVALID` and changes nothing.
- Using `createPersistedTruckUsageScenario`: reassigning a truck with an unreleased assignment on a
  `PLANNED` discharge, and again on an `ACTIVE` discharge, is refused with
  `409 E_TRUCK_TRANSPORT_COMPANY_LOCKED`, and none of the four fields is written.
- The same committed truck accepts a registration, vehicle model, and capacity update that keeps its
  current company.
- A truck whose only assignment is released, and a truck assigned only to a `CLOSED` discharge, can
  both be reassigned.
- After a reassignment, existing `discharge_truck_assignments` rows keep their
  `registration_snapshot`, `transport_company_id`, and `transport_company_name_snapshot`.
- An archived truck that had been reactivated keeps its retained archive context after a later
  update.

## 3. Run focused web verification

```bash
pnpm --dir apps/web exec vitest run src/features/trucks
```

Expected outcomes:

- **Edit truck** appears only for an administrator viewing an available truck.
- An observer sees no update affordance, and `?truckMode=edit` does not open a form for them.
- An administrator viewing an archived truck sees no update affordance, and `?truckMode=edit` does
  not open a form for it.
- The edit form opens in the detail pane in both the standalone and embedded layouts, pre-filled with
  the truck's registration, vehicle model, capacity, and current transport company, without leaving
  the directory.
- The company select offers the available companies plus the truck's own current company, with the
  current one selected.
- A successful save shows a confirmation, returns to `truckMode=view`, and the corrected truck is
  reflected in the directory list, its details, and its alphabetical position.
- A `422` response attaches messages to the corresponding fields; `409 E_TRUCK_REGISTRATION_CONFLICT`,
  `409 E_TRUCK_ARCHIVED`, `409 E_TRUCK_TRANSPORT_COMPANY_LOCKED`, and
  `422 E_TRUCK_TRANSPORT_COMPANY_INVALID` each surface as distinct error feedback.
- After a refusal the administrator can correct the value and resubmit without reopening the truck.
- Cancelling leaves the truck unchanged and returns to the details view.
- A background refetch during an open edit session does not discard the in-progress form.
- The existing consultation tests still pass: lifecycle tabs, counts, search, ordering, scale,
  details, creation, empty, and retry behavior are unaffected.

## 4. Run repository verification

```bash
pnpm check
pnpm typecheck
pnpm test
```

All commands must pass before the PR is marked ready. Because no Playwright suite is configured, also
complete the affected browser flow below.

## 5. Exercise the affected browser flow

```bash
pnpm dev
```

Validate in a desktop viewport and a narrow mobile viewport:

1. Sign in as an operations administrator and open **Site references → Transport resources**.
2. Select an available truck, confirm **Edit truck** is offered, and open it. Confirm the form is
   pre-filled with all four current values and the URL carries `truckMode=edit`.
3. Reload the page in edit mode and confirm the form is restored from the URL.
4. Change the registration and capacity and save. Confirm the confirmation appears, the panel returns
   to details, and the directory shows the new registration in its correct position.
5. Confirm the truck's identity, status, and archive or reactivation context are unchanged, and that
   **Last updated** has advanced.
6. Clear the vehicle model and save; confirm details show it as not specified. Set it again and
   confirm it is stored.
7. Submit a blank registration, a registration copied from another truck (including one differing
   only by letter case), and a capacity of `0` and of `1.2345`. Confirm each refusal is distinct and
   the truck is unchanged.
8. Correct the value in place and resubmit; confirm it succeeds without reopening the truck.
9. Submit a registration with leading and trailing spaces and confirm the stored value is trimmed
   with its casing preserved.
10. Resubmit all four current values and confirm it succeeds without a duplicate error.
11. Reassign an uncommitted truck to another available transport company. Confirm the details and the
    directory show the new provider, and that the previous company is otherwise unaffected.
12. Open a truck assigned to a planned or active discharge, attempt to change its transport company,
    and confirm the refusal names the discharge commitment and leaves every field unchanged. Then
    change only its registration and confirm that succeeds.
13. Open the discharge that reserved that truck and confirm its assignment still shows the
    registration and company captured at reservation time.
14. Open an archived truck and confirm no update affordance is offered; then request `?truckMode=edit`
    for it directly and confirm no form opens.
15. Repeat steps 2 and 4 from the embedded workspace layout, with a transport company selected as the
    directory scope, and confirm the edit panel behaves identically.
16. Sign in as an observer and confirm available trucks are readable with no update affordance
    anywhere.

Finally, repeat the API access check with an unauthenticated session and a non-active user; both must
be refused before any truck is modified.
