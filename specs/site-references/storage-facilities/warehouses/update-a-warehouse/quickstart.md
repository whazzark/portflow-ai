# Phase 1 Quickstart: Validate Update a Warehouse

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) |
**Contracts**: [API](./contracts/warehouses-update.openapi.yaml) · [UI state](./contracts/warehouse-update-ui-state.md)

## Prerequisites

- A Node.js version compatible with the workspace dependencies and PNPM 10.28.1
- PostgreSQL configured for the API development environment
- Dependencies installed with `pnpm install`
- An active organization or operations administrator account, and a second active account without
  warehouse management permission (e.g. an Observer)
- Seeded or created data: at least **one available warehouse with doors** (the containment cases),
  **one available warehouse without doors** (the free-reshape cases), **one archived warehouse**, and
  a second warehouse whose name can be used for the duplicate case
- At least one existing **dock or weighing area** to test the cross-resource name case
- Deployment-approved MapLibre style URLs (`VITE_MAP_STYLE_LIGHT_URL` / `VITE_MAP_STYLE_DARK_URL`)
  so the warehouse map renders

No migration is needed: `warehouses`, `warehouse_footprint_points`, and `warehouse_doors` all exist.

## Start the application

```bash
pnpm --filter @portflow/api db:migrate   # no-op unless the workspace is behind
pnpm dev
```

Running the API dev server regenerates `apps/api/.adonisjs/client/registry/index.ts`, which is
committed — the `warehouses.update` entry must appear in the reviewed diff.

Authenticate as an authorized administrator and open `/warehouses`.

## End-to-end validation scenarios

1. **Entry point and permission gate.** Select an available warehouse and confirm its details offer
   an update action. Sign in as the Observer instead and confirm the action is absent and that
   `/warehouses?warehouseId=…&edit=warehouse` renders ordinary consultation with no panel and a
   non-editable ring. *(FR-002, FR-005, US3 scenario 3)*
2. **Archived warehouses are read-only.** Select an archived warehouse. Confirm the update action is
   absent or clearly unavailable, and that requesting `edit=warehouse` for it is inert. *(FR-018,
   US3 scenarios 4–5)*
3. **Arming the mode.** Activate the update on an available warehouse. Confirm the URL gains
   `edit=warehouse`, the panel opens pre-filled with the stored name and every boundary point, the
   editing state is clearly signalled, and an explicit way to leave without saving is visible.
   *(FR-005, FR-005a, US1 scenario 1)*
4. **Mode exclusivity.** With an update in progress, activate warehouse creation. Confirm the update
   ends without saving and no draft leaks into the creation footprint. Then reverse the order.
   *(FR-005b)*
5. **Clicks are inert.** While editing, click empty map, then click another warehouse's polygon.
   Confirm nothing is added to the outline, no other warehouse is selected, and no detail view
   opens. *(FR-005a, US1 scenario 6)*
6. **Move a vertex.** Drag a boundary point. Confirm the ring redraws, the count is unchanged, and
   the "modified" indicator appears with a way to restore the original outline. *(FR-006, US1
   scenario 3)*
7. **Insert on a designated edge.** Click the insert handle on one edge. Confirm a boundary point
   appears between that edge's two endpoints — not at the end of the order — the count increments,
   and the new point is immediately draggable. *(FR-006a, US1 scenario 4, SC-012)*
8. **Remove any vertex.** On an outline of more than three points, remove a point that is **not** the
   last one added. Confirm the ring closes over the gap and the remaining order is preserved.
   *(FR-006b, US1 scenario 5)*
9. **Three-point floor.** Reduce the outline to three points. Confirm every remove control is
   disabled with an explanation, while dragging and inserting stay available. *(FR-006b, US2
   scenario 6, SC-012)*
10. **No finishing step.** Confirm the panel offers no "finish the outline" control and that the
    first boundary point carries no special role. *(FR-006c)*
11. **Pan and zoom.** Pan and zoom mid-edit. Confirm every boundary point stays at its geographic
    position and the map does not re-fit on its own. *(Edge case, research R12)*
12. **Keyboard-only path.** Without using a pointer, open "Coordinates (advanced)", insert a point
    after a designated one (confirm it is pre-filled with the split edge's midpoint), edit a
    latitude, remove another point, and save. *(FR-006d, Edge case)*
13. **Rename only.** Change the name alone and save. Confirm a 200, the new name everywhere without a
    reload, and an unchanged footprint, identity, status, and creation time. *(FR-004, FR-017,
    FR-021, US1 scenario 2)*
14. **Reshape only.** Change the outline alone and save. Confirm the stored footprint matches the
    final outline point for point and in order, and that the name is untouched and no duplicate is
    reported against the warehouse's own name. *(FR-004, FR-015, Edge case)*
15. **Both together.** Change name and outline in one submission. Confirm both take effect together.
    *(FR-004, US1 scenario 8)*
16. **No-op submission.** Save without changing anything. Confirm success, no duplicate refusal, and
    the warehouse left in its current state. *(FR-011, US1 scenario 10)*
17. **Name refusals.** Submit in turn a blank name, a 256-character name, and an existing
    warehouse's name varying its case and surrounding whitespace — then an **archived** warehouse's
    name. Confirm a field-level refusal each time, the stored warehouse unchanged, and the draft
    outline preserved. Then submit `"  North Shed  "` and confirm the stored name is trimmed.
    *(FR-007 to FR-011, FR-025)*
18. **Cross-resource name.** Submit the name of an existing dock or weighing area. Confirm the update
    **succeeds**. *(FR-011a)*
19. **Geometry refusals.** Drag a vertex to make the outline cross itself, then onto a neighbour to
    make two consecutive points identical, then arrange three points in a line. Confirm each is
    refused with its own explanation and the stored footprint is unchanged. Type `91` into a
    latitude and confirm the message identifies that point. *(FR-012 to FR-014)*
20. **Doors outside the outline.** On the warehouse **with doors**, shrink the outline so a door
    falls outside and save. Confirm a 409 `E_WAREHOUSE_DOORS_OUTSIDE_FOOTPRINT`, the doors named in
    the message, and nothing changed — neither footprint nor doors. Repeat with the door exactly on
    an edge and confirm it **is** accepted. Repeat with an **archived** door outside and confirm it
    is still refused. *(FR-016, FR-016a, US2 scenario 9, SC-010)*
21. **Cancellation.** Reshape without saving, then cancel. Confirm `edit` leaves the URL, the polygon
    returns to its stored shape, the warehouse stays selected, and map clicks select warehouses
    again. *(FR-026, US1 scenario 11)*
22. **Concurrent archive.** Open the update mode, archive the same warehouse from another session,
    then save. Confirm a 409 `E_WAREHOUSE_ARCHIVED` stating reactivation is required first, with
    nothing changed. *(FR-018, Edge case)*
23. **Not found.** Open the update mode, delete the warehouse row directly, then save. Confirm a 404,
    the mode closed, and a consistent view of the remaining warehouses. *(FR-019, Edge case)*
24. **Interrupted submission.** Stop the API and save a valid change. Confirm a retryable failure
    message with the name and draft outline intact. Restart the API, retry, and confirm the change
    applied exactly once with no orphaned footprint rows and no partially replaced footprint.
    *(FR-020, SC-011)*
25. **Rename past a hiding search.** With a name search active, rename the warehouse to something
    that no longer matches it. Confirm the warehouse stays visible and selected rather than
    silently disappearing. *(FR-021, research R13)*
26. **Concurrent duplicate.** Issue two near-simultaneous `PATCH` requests giving two different
    warehouses the same new name. Confirm exactly one 200 and one 409. *(SC-004)*

```bash
# Scenario 26 — replace the two ids with real warehouse identities
NAME="Race Shed $(date +%s)"
for ID in "$FIRST_WAREHOUSE_ID" "$SECOND_WAREHOUSE_ID"; do
  curl -s -o /dev/null -w '%{http_code}\n' -X PATCH "http://localhost:3333/api/v1/warehouses/$ID" \
    -H 'Content-Type: application/json' -b cookies.txt -d "{\"name\":\"$NAME\"}" &
done; wait
```

```bash
# Scenario 14 — confirm the stored order round-trips and nothing is left behind
psql "$DATABASE_URL" -c \
  "SELECT position, latitude, longitude FROM warehouse_footprint_points
   WHERE warehouse_id = '$WAREHOUSE_ID' ORDER BY position;"
```

## Automated verification

```bash
pnpm check                                   # Biome format + lint
pnpm typecheck
pnpm --filter @portflow/api test             # Japa: warehouse update unit + integration
pnpm --filter @portflow/web test             # Vitest: update/, geometry, polygon editing layer
pnpm test                                    # full fast suite
```

Expected new coverage, per [research.md](./research.md) R14:

- `apps/api/tests/unit/warehouses/update/update.spec.ts` — policy per role, name normalization,
  geometry refusal, containment refusal, partial payloads, result-kind → exception mapping
- `apps/api/tests/unit/warehouses/update/footprint_containment.spec.ts` — inside, outside, on an
  edge, on a vertex, concave outlines
- `apps/api/tests/integration/warehouses/update/update.spec.ts` — 200 with persisted point order and
  unchanged doors, 404, 409 (three codes), 422 (two codes), 401, 403, atomicity on refusal, and the
  unchanged-resubmission case
- `apps/web/src/features/warehouses/__tests__/update/{session,reshape,validation,permissions}.test.tsx`
- `apps/web/src/features/warehouses/__tests__/footprint-containment.test.ts`
- `apps/web/src/components/resource-map/__tests__/resource-map-polygon-editing.test.tsx` — one insert
  handle per edge, insertion index, removal index, minimum-points floor, and that the layer never
  arms the map

Existing warehouse consultation and creation suites must pass unchanged in substance; the extraction
of the shared outline component must not alter what
`resource-map-polygon-placement.test.tsx` asserts.

## Before opening the PR

Per Constitution VII: checks, typecheck, affected tests, the full fast suite, and the browser flow
above must pass, and a fresh read-only review must assess the final diff with confirmed findings
resolved or explicitly justified.
