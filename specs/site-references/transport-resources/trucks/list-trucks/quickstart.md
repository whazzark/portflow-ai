# Quickstart: Validate Truck Consultation

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

Confirm the seeders create representative available, archived, and previously reactivated trucks across available and archived transport companies. Include a truck with no vehicle model and lifecycle records with missing optional actor/comment data.

The authoritative fields and relationships are defined in [data-model.md](./data-model.md); the response shape is defined in [contracts/http-api.md](./contracts/http-api.md).

## 2. Run focused API verification

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/trucks/consultation/list.spec.ts
pnpm --filter @portflow/api test integration \
  --files=tests/integration/trucks/consultation/list.spec.ts
```

Expected outcomes:

- Unauthenticated and non-active users receive no truck or transport-company data.
- `GET /api/v1/trucks` returns available and archived trucks only to active organization administrators and operations administrators; other active roles receive `403` with no collection data.
- `GET /api/v1/trucks/available` returns only available trucks with their current company to every active role.
- Active operations leads and observers receive no archived truck, archived count, or archived lifecycle context from either endpoint they are authorized to use.
- Available and archived trucks are registration-ordered with UUID tie-breaking.
- Every truck includes the current transport-company ID and optional lifecycle actor summaries; company details are resolved from the transport-company collection.
- An archived truck related to an archived company remains readable with the two statuses kept distinct.
- Empty collections return a successful empty array.
- A new request after a persisted lifecycle or provider change returns the authoritative current state.
- Case-insensitive duplicate registrations, non-positive capacities, missing provider relationships, and archived rows without an archive time are rejected by persistence constraints.
- No item-detail route or operational-selection UI is exposed by this slice; the available endpoint is a lifecycle-filtered read contract.

## 3. Run focused web verification

```bash
pnpm --dir apps/web exec vitest run \
  src/features/trucks \
  src/features/transport-resources
```

Expected outcomes:

- Companies remains the default Transport resources view and its existing behavior does not regress.
- Every active role can see and load the Trucks resource view.
- Available trucks and their count are shown to every active role; only administrators see the Archived lifecycle control and archived count.
- Administrators load `trucks.index`; operations leads and observers load `trucks.available` and never receive the complete payload.
- A crafted non-admin archived-view URL returns to Available, and the server response contains no archived truck data.
- Search is trimmed and normalized across registration and current company name, and is scoped to the selected truck lifecycle.
- Each lifecycle is automatically registration-ordered with UUID tie-breaking.
- Details expose stable identity, registration, optional model, capacity in tonnes, current company name/status, truck status, and relevant lifecycle context.
- URL state restores the resource, lifecycle, search, and exact selected truck; stale identities are cleared without substitution.
- Empty, no-match, loading, failed-refresh, and retry states are distinct, and a successful retry replaces the stale snapshot.
- The interface contains no create, edit, archive, reactivate, assignment, import, synchronization, or permanent-delete controls.

## 4. Verify the 1,000-truck acceptance scale

Prepare a site dataset containing 1,000 trucks split across both lifecycle states and repeated transport companies. Use representative registration and company-name searches near the beginning, middle, and end of the collection.

Under normal local operating conditions, confirm that at least 95% of repeated route loads show the requested lifecycle collection or explicit empty state within 2 seconds. Confirm that query logging shows bounded relation loading rather than one company/actor query per truck, and that typing in search does not issue network requests.

## 5. Run repository verification

```bash
pnpm check
pnpm typecheck
pnpm test
```

All commands must pass before the PR is marked ready. Because no Playwright suite/script is currently configured, also complete the affected browser flow below.

## 6. Exercise the affected browser flow

Start both workspaces:

```bash
pnpm dev
```

Then validate in a desktop viewport and a narrow mobile viewport:

1. Sign in as an active observer and follow **Site references → Transport resources**.
2. Confirm Companies remains the default resource and the existing company collection is usable.
3. Choose **Trucks** and confirm Available is selected by default with its unfiltered count, without an Archived control or count.
4. Search with a partial registration using different casing and surrounding whitespace; confirm the expected rows remain and matching registration text is emphasized.
5. Search by partial company name, including a name with diacritics; confirm matching truck rows remain and company text is emphasized.
6. Confirm rows are ordered by registration, show the current company name, and remain independently selectable when companies or registrations are similar.
7. Open an available truck and verify UUID, registration, optional model behavior, formatted capacity, current company name/status, and latest reactivation context when present.
8. Restore a URL containing `resource=trucks&truckStatus=archived`; confirm the observer remains in Trucks, calls only `GET /api/v1/trucks/available`, is normalized to Available, and receives no archived data.
9. Reload a URL containing `resource=trucks`, available lifecycle/search state, and `truckId`; confirm the same valid context is restored.
10. Validate an empty lifecycle, a non-empty lifecycle with no search matches, a pending request, and a failed request followed by **Try again**.
11. Confirm there are no mutation or operational-selection controls anywhere in the truck workspace.
12. Repeat with an operations lead and confirm the same available-only behavior.
13. Repeat with an organization administrator and operations administrator. Confirm both call `GET /api/v1/trucks`, see the Archived lifecycle control/count, can open an archived truck whose company is also archived, and see both statuses plus archive context.
14. Confirm an active observer receives `403` from `GET /api/v1/trucks` but `200` with available rows only from `GET /api/v1/trucks/available`.
15. Repeat both protected endpoint checks with an unauthenticated session and a non-active administrator; neither receives truck or company data.
