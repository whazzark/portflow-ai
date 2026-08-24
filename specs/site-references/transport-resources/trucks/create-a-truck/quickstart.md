# Quickstart: Validate Truck Creation

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

Confirm the seeders include at least one `AVAILABLE` and one `ARCHIVED` transport company, and at
least one existing truck registration to exercise duplicate rejection. The authoritative fields
and rules are defined in [data-model.md](./data-model.md); the request/response shape is defined
in [contracts/http-api.md](./contracts/http-api.md).

## 2. Run focused API verification

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/trucks/administration/create.spec.ts
pnpm --filter @portflow/api test integration \
  --files=tests/integration/trucks/administration/create.spec.ts
```

Expected outcomes:

- Unauthenticated users and active roles other than organization administrator and operations
  administrator receive `403`/`401` with no truck created and no existing registration disclosed.
- A valid submission from an organization administrator or operations administrator creates an
  `AVAILABLE` truck with no archive or reactivation context, and it is immediately returned by
  `GET /api/v1/trucks` and `GET /api/v1/trucks/available`.
- Omitting `vehicleModel` creates a truck with a `null` vehicle model; submitting a blank or
  whitespace-only `vehicleModel` is rejected.
- A registration that duplicates an existing truck's registration is rejected with `409`, matched
  case-insensitively and after trimming, and no truck is created.
- A capacity of zero, a negative value, or a value with more than three fractional digits is
  rejected with `422` and no truck is created.
- A `transportCompanyId` that does not exist, or that references an `ARCHIVED` company, is
  rejected with `422` and no truck is created.
- Two near-simultaneous creation requests with the same registration result in exactly one truck
  created; the second is rejected as a duplicate.
- Every rejected attempt leaves the dataset byte-for-byte unchanged (no partial truck row).

## 3. Run focused web verification

```bash
pnpm --dir apps/web exec vitest run \
  src/features/trucks \
  src/features/transport-resources
```

Expected outcomes:

- Only organization administrators and operations administrators see a create-truck control in
  the Trucks workspace; other active roles do not see or reach it.
- The transport-company picker in the create form offers only currently available companies.
- Submitting valid data closes the create panel, and the new truck appears in the workspace
  without a manual refresh.
- Field-level errors are shown for a blank registration, a non-positive or overly precise
  capacity, and a missing transport company; the panel remains open with the entered values intact.
- A duplicate-registration response surfaces a specific, actionable message tied to the
  registration field rather than a generic failure.
- A transient submission failure shows a distinct, retryable error, and retrying with the same
  input succeeds exactly once without creating a duplicate.

## 4. Run repository verification

```bash
pnpm check
pnpm typecheck
pnpm test
```

All commands must pass before the PR is marked ready. Because no Playwright suite/script is
currently configured, also complete the affected browser flow below.

## 5. Exercise the affected browser flow

Start both workspaces:

```bash
pnpm dev
```

Then validate in a desktop viewport and a narrow mobile viewport:

1. Sign in as an active observer and open **Site references → Transport resources → Trucks**;
   confirm no create-truck control is visible, and confirm a direct API call to
   `POST /api/v1/trucks` from this session returns `403` with no truck created.
2. Sign in as an active operations administrator and open the same workspace; confirm a
   create-truck control is visible.
3. Open the create form and submit a unique registration, a positive capacity, no vehicle model,
   and an available transport company; confirm the truck appears in the workspace immediately with
   an available status and no vehicle model shown.
4. Repeat with a vehicle model provided; confirm it is shown in the new truck's details.
5. Attempt to submit the same registration again (same or different casing/whitespace); confirm a
   duplicate-specific error is shown and no second truck appears.
6. Attempt to submit a zero, negative, or overly precise capacity; confirm a field-specific error
   is shown and no truck is created.
7. Attempt to select or submit an archived transport company; confirm it is unavailable in the
   picker, or, if submitted directly against the API, is rejected with a specific error.
8. Sign in as an active organization administrator and repeat step 3 to confirm the same
   capability is available to that role.
9. Sign in as an active operations lead and confirm no create-truck control is visible in the
   workspace.
