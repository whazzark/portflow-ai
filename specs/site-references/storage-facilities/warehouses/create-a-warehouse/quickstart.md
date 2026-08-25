# Phase 1 Quickstart: Validate Create a Warehouse

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) |
**Contracts**: [API](./contracts/warehouses-create.openapi.yaml) · [UI state](./contracts/warehouse-creation-ui-state.md)

## Prerequisites

- A Node.js version compatible with the workspace dependencies and PNPM 10.28.1
- PostgreSQL configured for the API development environment
- Dependencies installed with `pnpm install`
- An active organization or operations administrator account, and a second active account without
  warehouse management permission (e.g. an Observer)
- At least one existing warehouse — available *or* archived — to test the duplicate-name conflict,
  and at least one existing **dock or weighing area** to test the cross-resource name case
- Deployment-approved MapLibre style URLs (`VITE_MAP_STYLE_LIGHT_URL` / `VITE_MAP_STYLE_DARK_URL`)
  so the warehouse map renders

No migration is needed: `warehouses` and `warehouse_footprint_points` already exist from #207.

## Start the application

```bash
pnpm --filter @portflow/api db:migrate   # no-op unless the workspace is behind
pnpm dev
```

Authenticate as an authorized administrator and open `/warehouses`.

## End-to-end validation scenarios

1. **Entry point and permission gate.** Confirm the map's control cluster now offers a create
   action. Sign in as the Observer instead and confirm the action is absent and that loading
   `/warehouses?create=warehouse` directly renders the ordinary consultation view with no panel and
   an unarmed map. *(FR-001, FR-006, FR-020)*
2. **Arming the mode.** Activate creation. Confirm the URL gains `create=warehouse`, the panel opens
   titled "Create warehouse", the cursor becomes a crosshair, and an explicit way to leave the mode
   is visible with no vertices placed. *(FR-001, FR-001a)*
3. **Mode replaces selection.** Open a warehouse's details first, then activate creation. Confirm the
   details close, `warehouseId` leaves the URL, and the first map click adds a vertex rather than
   reopening a detail view. *(FR-002b, edge case)*
4. **Drawing.** Click three points. Confirm each click adds a vertex marker, the outline updates
   after each one, it closes and fills at the third point, and no warehouse exists yet. *(FR-002, FR-003)*
5. **Clicks do not select.** Click on top of an existing warehouse's polygon while drawing. Confirm a
   vertex is added there and the existing warehouse's details do **not** open. *(FR-002a)*
6. **Adjusting.** Drag a vertex, remove the last point, add another, then open "Coordinates
   (advanced)" and edit one vertex's latitude. Confirm the map and the coordinate fields stay in
   sync in both directions, and that the panel shows the running point count rather than a fieldset
   per vertex. *(FR-003, FR-004, FR-004a)*
6b. **Finishing the outline.** With three points placed, click the first boundary point again.
    Confirm the outline is reported as finished, further map clicks add nothing, and the vertices
    are still draggable. Remove the last point and confirm the map accepts new points again.
    *(FR-002c, SC-009)*
7. **Pan and zoom.** Pan and zoom the map mid-draw. Confirm every vertex stays at its geographic
   position. *(Edge case)*
8. **Blocked below three points.** With two vertices placed, confirm submit is disabled and the panel
   states that at least three boundary points are required. *(FR-005)*
9. **Successful creation.** With a valid outline, submit a unique name. Confirm a 201, the warehouse
   appears on the map without a manual reload, it is selected, and its details show the name,
   Available status, and the exact drawn footprint. *(FR-013, FR-014, FR-015, FR-016)*
10. **Reveal past a hiding filter.** Repeat scenario 9 with the archived lifecycle view active and a
    non-matching search term. Confirm the new warehouse is still revealed and selected. *(FR-016)*
11. **Blank name.** Draw a valid outline, submit with a blank or whitespace-only name. Confirm a
    field-level rejection, no warehouse created, and the outline preserved. *(FR-007, FR-017)*
12. **Trimming.** Submit `"  South Shed  "`. Confirm the stored and displayed name is `South Shed`.
    *(FR-008)*
13. **Duplicate name.** Submit the name of an existing warehouse, varying its case and adding
    surrounding whitespace. Confirm a 409 `E_WAREHOUSE_NAME_CONFLICT` surfaced on the name field, no
    warehouse created, and the outline preserved. Repeat against an **archived** warehouse's name and
    confirm it is still rejected. *(FR-009, FR-017)*
14. **Cross-resource name.** Submit the name of an existing dock or weighing area. Confirm the
    warehouse **is** created. *(FR-010)*
15. **Out-of-range coordinate.** Type `91` into a vertex's latitude field. Confirm a message on that
    vertex and no warehouse created. *(FR-011)*
16. **Self-crossing outline.** Draw a bow-tie (four points where the closing edges cross). Confirm the
    rejection explains the outline must not cross itself and no warehouse is created. Repeat with two
    identical consecutive points. *(FR-012)*
17. **Cancellation.** With vertices placed, cancel. Confirm `create` leaves the URL, every vertex
    disappears, no warehouse is created, and map clicks select warehouses again. *(FR-019)*
18. **Interrupted submission.** Stop the API, submit a valid warehouse, and confirm a failure toast
    with the name and vertices intact. Restart the API, retry, and confirm exactly one warehouse
    exists with no orphaned footprint rows. *(FR-018, SC-008)*
19. **Keyboard-only path.** Without using a pointer, add three vertices by entering coordinates
    directly and create the warehouse. *(Edge case)*
20. **Concurrent duplicate.** Issue two near-simultaneous `POST /api/v1/warehouses` with the same new
    name. Confirm exactly one 201 and one 409. *(SC-005)*

```bash
# Scenario 20
NAME="Race Shed $(date +%s)"
BODY=$(printf '{"name":"%s","footprint":{"points":[{"latitude":49.4938,"longitude":0.1077},{"latitude":49.4938,"longitude":0.1092},{"latitude":49.4929,"longitude":0.1088}]}}' "$NAME")
for _ in 1 2; do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3333/api/v1/warehouses \
    -H 'Content-Type: application/json' -b cookies.txt -d "$BODY" &
done; wait
```

## Automated verification

```bash
pnpm check                                   # Biome format + lint
pnpm typecheck
pnpm --filter @portflow/api test             # Japa: warehouse creation unit + integration
pnpm --filter @portflow/web test             # Vitest: create/, geometry, polygon placement
pnpm test                                    # full fast suite
```

Expected new coverage, per [research.md](./research.md) R10:

- `apps/api/tests/unit/warehouses/creation/create.spec.ts` — policy per role, use case normalization,
  geometry rejection, duplicate-name mapping
- `apps/api/tests/unit/warehouses/creation/footprint_geometry.spec.ts` — triangles, concave shapes,
  bow-ties, duplicate consecutive points, closing-edge crossings
- `apps/api/tests/integration/warehouses/creation/create.spec.ts` — 201 with persisted point order,
  409, 422 (both codes), 401, 403, and no row left behind on rejection
- `apps/web/src/features/warehouses/__tests__/create/{drawing,create,validation,permissions}.test.tsx`
  — including the point-count summary, the folded coordinates disclosure, finishing the outline on a
  first-point click, and its reopening when a point is removed
- `apps/web/src/features/warehouses/__tests__/footprint-validation.test.ts`
- `apps/web/src/components/resource-map/__tests__/resource-map-polygon-placement.test.tsx`

## Regression guard

The existing consultation tests for warehouses (`consultation.test.tsx`, `warehouses-page.test.tsx`,
`warehouse-map.test.tsx`, `warehouse-polygon.test.tsx`) must pass **unchanged in substance**. They
are the proof that adding the first map mode to this page did not alter how warehouses are browsed,
searched, or selected.

## Definition of done

- Every scenario above behaves as described
- All automated checks pass
- The affected browser flow is exercised manually per constitution principle VII
- A fresh read-only review assesses the final diff, with confirmed findings resolved or justified
