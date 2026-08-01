# Quickstart: Validate List Warehouses

## Prerequisites

- Checkout `feat/207-list-warehouses`.
- Install workspace dependencies with `pnpm install`.
- Configure `apps/api/.env` and `apps/web/.env` from their example files.
- Run API migrations against a disposable local PostgreSQL database.
- Prepare at least one active user for each role under test and warehouse fixtures covering mixed,
  available-only, archived-only, and fully empty collections.

The expected response is defined in [contracts/warehouses.openapi.yaml](./contracts/warehouses.openapi.yaml),
and persistence invariants are defined in [data-model.md](./data-model.md).

## Automated validation

Run the narrow suites during RED → GREEN → REFACTOR:

```bash
pnpm --filter @portflow/api test
pnpm --filter @portflow/web test
```

Before handing the plan's implementation to review, run the repository gates:

```bash
pnpm check
pnpm typecheck
pnpm test
```

All commands must pass. No Playwright suite is currently present in this checkout, so complete the
affected browser journey below manually in addition to the automated feature tests.

## API contract scenarios

1. Request `GET /api/v1/warehouses` without a session; expect `401` and no warehouse data.
2. Start a session, change that persisted user's access status away from `ACTIVE`, then request the
   endpoint; expect `401` and no warehouse data.
3. Repeat as each active role, including observer; expect `200`.
4. With mixed fixtures, verify every warehouse appears exactly once, ordered by name, with only
   `id`, `name`, `status`, and the complete ordered `footprint.points` projection.
5. Verify an archived item remains present and is marked `ARCHIVED`.
6. Verify every coordinate and its order match persistence, including an irregular footprint with
   many points.
7. With no fixtures, expect `200` and `{ "data": [] }`; do not turn valid emptiness into an error.

## Browser consultation journey

Start both applications:

```bash
pnpm dev
```

Then validate at desktop and mobile widths:

1. Sign in as an active observer and follow **Site references → Warehouses**.
2. Confirm **Available** is selected by default, only available records appear, and both lifecycle
   counts equal the current response.
3. Confirm the map exposes a name search field and Available/Archived status filters, with their
   state reflected in the URL.
4. Search for an available warehouse and confirm the visible map presentation filters without a
   second collection request.
5. Select an available warehouse polygon. Confirm its name, available status, and full polygon
   appear in one read-only detail view, with no create, edit, archive, reactivate, delete, door, or
   discharge action. Confirm the selected polygon is highlighted and the map frames every boundary
   edge without a stored center or clipping.
6. Hover and keyboard-focus a visible warehouse polygon. Confirm a tooltip exposes its name and
   current lifecycle status; clicking it opens the same detail view.
7. Confirm the map legend distinguishes available warehouses with a solid/high-emphasis symbol and
   archived warehouses with a muted/dashed symbol, without relying on color alone.
8. Switch to **Archived**. Confirm the prior selection closes, only archived records appear, and an
   archived warehouse's read-only footprint can be inspected.
9. Validate available-only, archived-only, and fully empty datasets. Each empty tab must name its
   lifecycle and leave the other tab reachable.
10. Open a URL containing `status=archived&search=yard&warehouseId=<archived-id>` and confirm the
   view restores.
11. While details are open, change the fixture's lifecycle and trigger a successful refresh. Confirm
   counts and lists update and the selection closes because it no longer belongs to the active tab.

## Failure and retry journey

1. Make `GET /api/v1/warehouses` fail while the route is loading.
2. Confirm the page shows **Unable to load warehouses**, not either empty state, and exposes a
   keyboard-accessible **Try again** action.
3. Restore the endpoint and activate **Try again** without signing in again.
4. Confirm the latest collection, counts, and footprints replace the failure state.

## Authorization regression

- Confirm every active role can open Warehouses and inspect both lifecycle sets.
- Confirm inactive users are rejected even if they retained an old session cookie.
- Confirm unauthenticated navigation follows the existing authenticated-layout behavior and the API
  never includes warehouse data in an error response.
