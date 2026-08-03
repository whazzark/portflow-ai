# Quickstart: Validate Warehouse Door Consultation

## Prerequisites

- Checkout `feat/212-list-warehouse-doors`.
- Use Node.js compatible with the repository toolchain and PNPM 10.28.1.
- Install dependencies with `pnpm install`.
- Configure `apps/api/.env` and `apps/web/.env` from their checked-in examples.
- Make PostgreSQL available for the manual browser flow; automated API tests use in-memory SQLite.
- Prepare active users for every role plus a non-active user.
- Prepare available and archived warehouses with footprints and doors covering mixed lifecycle,
  available-only, archived-only, and empty cases.

The response shape is defined in
[contracts/warehouse-doors.openapi.yaml](./contracts/warehouse-doors.openapi.yaml), integrated route
behavior in [contracts/warehouse-door-ui-state.md](./contracts/warehouse-door-ui-state.md), and
persistence invariants in [data-model.md](./data-model.md).

## Prepare the Development Dataset

Apply migrations and seed a disposable local database:

```bash
pnpm --filter @portflow/api db:fresh
```

Confirm the seed data includes:

- at least one available warehouse with available and archived doors;
- an archived warehouse containing archived doors only;
- a warehouse with no doors;
- the same door name in two different warehouses;
- doors at the same or nearby coordinates inside one footprint;
- at least one point on a warehouse-footprint boundary.

## Automated Validation

Drive each behavior RED → GREEN → REFACTOR through the narrow suites:

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/warehouse_doors/consultation/available.spec.ts
pnpm --filter @portflow/api test integration \
  --files=tests/integration/warehouses/consultation/list.spec.ts \
  --files=tests/integration/warehouse_doors/consultation/available.spec.ts
pnpm --dir apps/web exec vitest run src/features/warehouse-doors src/features/warehouses
```

Before implementation is handed to review, run the repository gates:

```bash
pnpm check
pnpm typecheck
pnpm test
```

All commands must pass. This checkout has no configured Playwright suite or `e2e` script, so also
complete the affected browser journey below at desktop and narrow mobile widths.

## API Contract Scenarios

1. Request `GET /api/v1/warehouses` and `GET /api/v1/warehouse-doors/available` without a session;
   expect `401` and no warehouse or door data.
2. Repeat with a session whose persisted user is no longer active; expect `401` and no data.
3. Repeat as every active role, including observer; expect `200` from both contracts.
4. With mixed fixtures, verify each `GET /api/v1/warehouses` item retains `id`, `name`, `status`, and
   `footprint`, adds `doors`, and embeds each door exactly once with only `id`, `name`, `status`,
   `latitude`, and `longitude`.
5. Verify warehouses retain deterministic name/identity order and every nested `doors` array is
   ordered by case-insensitive name, display name, and stable door identity.
6. Verify available and archived doors from the same warehouse coexist in that warehouse's embedded
   `doors`, and no nested door repeats `warehouseId`.
7. Request `GET /api/v1/warehouse-doors/available`; verify every item includes `warehouseId`, every
   item has status `AVAILABLE`, and doors that are archived or belong to an archived warehouse are
   excluded. Verify its deterministic warehouse/name/identity order.
8. Verify two warehouses may each contain `Door 1`, while inserting `Door 1` and ` door 1 ` in the
   same warehouse cannot produce two persisted normalized identities across any lifecycle states.
9. Verify a nonexistent warehouse foreign key is rejected and deleting a warehouse that owns a door
   is restricted.
10. With warehouses but no door fixtures, expect `doors: []` on every warehouse and `{ "data": [] }`
    from the available-only endpoint; valid emptiness is not an error.

## Browser Consultation Journey

Start both workspaces:

```bash
pnpm dev
```

Then validate:

1. Sign in as an active observer and open **Site references → Warehouses**. Confirm one warehouse
   request loads the map and its embedded doors, no warehouse-door request is made by this screen,
   and the overview contains no door marker, door label, or door legend.
2. Select an available warehouse. Confirm the non-modal panel opens without an overlay, the map
   remains pointer- and keyboard-operable, and its embedded doors are immediately available from the
   resolved warehouse snapshot.
3. Confirm Available is the effective default for the available warehouse. Verify Available,
   Archived counts are scoped only to that warehouse and each tab shows the correct markers
   and accessible list entries. Confirm no door from another warehouse remains on the map.
4. Select an archived warehouse. Confirm Archived becomes the default, historical doors remain
   readable, and no door is represented as available for new work.
5. Switch between warehouses. Confirm door selection and explicit door status clear, the new
   warehouse's contextual default applies, and the cached warehouse snapshot is projected without a
   second request.
6. Confirm door markers are compact and have no persistent text labels. Hover and keyboard-focus a
   door marker and confirm its tooltip exposes name and lifecycle state. Activate it by pointer and
   keyboard, confirm the same exact door opens, and verify that only the selected marker receives
   strong emphasis while the other admitted markers remain visually quiet and operable. Confirm the
   matching list entry is selected and the door list remains visible.
7. Select an available and archived door from the list and from the map. Confirm the matching list
   entry and marker are emphasized, while name and lifecycle remain available without a detail view.
8. Confirm the selected warehouse polygon remains framed and its context stays present while door
   markers and selection are used. Confirm closing the warehouse panel clears all door state.
9. Validate doors with identical names in different warehouses and doors at identical or nearby
   coordinates. Each stable identity must remain independently selectable through both its offset
   marker and the panel list.
10. Open a URL containing valid `warehouseId`, `doorStatus`, and `doorId` values. Confirm reload and
    back/forward navigation restore the exact context. Invalid or wrong-warehouse door identities
    clear only the selection and never substitute another door.
11. Confirm lifecycle labels, active tabs, marker treatments, tooltip text, focus states, and the
    archived badge remain understandable without relying on color.
12. At a narrow viewport, confirm the bounded bottom panel leaves the map usable and every control
    and list entry remains keyboard reachable without the door overlay obscuring the footprint.

## Empty, Refresh, and Failure Journeys

1. Select a warehouse with no doors. Confirm the contextual lifecycle tab shows a specific empty
   message and Available and Archived remain reachable.
2. Select a populated warehouse, then choose a lifecycle state with no doors. Confirm this is a
   successful lifecycle-specific empty state, not a loading failure.
3. Make `GET /api/v1/warehouses` fail. Confirm the existing warehouse failure state offers
   **Try again** and no partial response is misrepresented as an empty door collection.
4. Restore the endpoint and retry without signing in again. Confirm the latest warehouses, embedded
   doors, counts, markers, list, and valid URL state replace the failure.
5. Change a selected door's name, coordinates, or lifecycle in the fixture, then refresh. Confirm the
   same stable identity updates without duplication and an excluded selection clears.
6. Make the basemap style fail while door data succeeds. Confirm map-specific feedback is distinct
   from source failure and the panel list and loaded selection remain usable.

## Authorization and Scope Regression

- Confirm every active role can consult doors but sees no create, edit, archive, reactivate, delete,
  assignment, or operational-selection control.
- Confirm unauthenticated and non-active users receive no warehouse-door data through direct API
  requests or navigation.
- Confirm the existing Warehouses route, search, lifecycle filters, footprint selection, empty
  states, and retry behavior remain intact when no door is selected.
