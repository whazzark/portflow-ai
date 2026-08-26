# Phase 1 Quickstart: Validate Create a Warehouse Door

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) |
**Contracts**: [API](./contracts/warehouse-doors-create.openapi.yaml) · [UI state](./contracts/warehouse-door-creation-ui-state.md)

## Prerequisites

- A Node.js version compatible with the workspace dependencies and PNPM 10.28.1
- PostgreSQL configured for the API development environment
- Dependencies installed with `pnpm install`
- An active organization or operations administrator account, and a second active account without
  warehouse management permission (e.g. an Observer)
- At least one **available** warehouse with a footprint, containing at least one existing door, and
  at least one **archived** warehouse
- At least one **archived door** under an available warehouse, to test that an archived door's name
  stays reserved
- Two available warehouses, to test that the same door name is accepted in each
- Deployment-approved MapLibre style URLs (`VITE_MAP_STYLE_LIGHT_URL` / `VITE_MAP_STYLE_DARK_URL`)
  so the warehouse map renders

No migration is needed: `warehouse_doors` already exists from #212, with its
`(warehouse_id, LOWER(name))` unique index and its coordinate CHECK constraints.

## Start the application

```bash
pnpm --filter @portflow/api db:migrate   # no-op unless the workspace is behind
pnpm dev
```

Authenticate as an authorized administrator and open `/warehouses`.

## End-to-end validation scenarios

1. **Entry point and permission gate.** Select an available warehouse and confirm its Doors panel
   header offers "Create door". Sign in as the Observer instead and confirm the action is absent and
   that loading `/warehouses?create=door&warehouseId=<id>` directly renders ordinary consultation
   with no panel and an unarmed map. *(FR-001, FR-002, FR-006)*
2. **Eligibility gate in the interface.** Select an **archived** warehouse and confirm no "Create
   door" action is offered — absent, not disabled — and that the same deep link for that warehouse
   is inert. *(FR-007)*
3. **Arming the mode.** Activate "Create door" on an available warehouse. Confirm the URL gains
   `create=door` while keeping `warehouseId`, the panel opens titled "Create door" and names the
   warehouse, the cursor becomes a crosshair, and no pending marker exists yet. *(FR-001, FR-003)*
4. **Placing the door.** Click a point inside the warehouse footprint. Confirm one pending marker
   appears at that point, labelled "New door", visually distinct from the warehouse's existing door
   markers, and that no door has been created. *(FR-003, FR-023)*
5. **Moving the pending point.** Click a different point inside the footprint and confirm the single
   pending marker moves rather than a second one appearing. Then drag it and confirm the coordinate
   fields follow. *(FR-004, edge case)*
6. **Coordinates drive the marker.** Edit the latitude and longitude fields directly and confirm the
   pending marker moves to the typed position; complete the flow with the keyboard alone. *(FR-004)*
7. **Anchoring.** Pan and zoom the map with a pending marker placed, and confirm it stays on its
   geographic position. *(edge case)*
8. **Clicks do not select.** With the mode armed, click on the warehouse polygon and on an existing
   door marker. Confirm neither opens details nor changes the selection, and that each click places
   or moves the pending point instead. *(FR-022)*
9. **Successful creation.** Submit a non-blank name unique in that warehouse. Confirm a "Door
   created" toast, the mode ending, the Available door view being shown with the new door listed and
   selected, and the door appearing on the map at the placed position — with no manual reload.
   *(FR-015, FR-016, FR-017)*
10. **Recorded values.** Consult the created door and confirm its name, containing warehouse,
    coordinates, and Available status match exactly what was submitted, and that its creation time
    was recorded. *(FR-016)*
11. **Reveal from the archived view.** Switch the Doors panel to Archived, then create a door.
    Confirm the Available view is shown with the new door visible and selected. *(FR-017)*
12. **Submit without a placement.** Activate the mode and attempt to submit with only a name.
    Confirm the submission is blocked with a message directing you to place the door, and that no
    door is created. *(FR-005)*
13. **Blank name.** Place a point and submit a name of only whitespace. Confirm a field-specific
    rejection, the pending marker still in place, and no door created. *(FR-009, FR-018)*
14. **Whitespace trimming.** Create a door with leading and trailing spaces around a valid name and
    confirm the stored name is trimmed while its letter casing is preserved. *(FR-010)*
15. **Duplicate name in the same warehouse.** Submit the name of an existing door of that warehouse,
    differing only by case or surrounding whitespace. Confirm a conflict message on the name field,
    the pending marker preserved, and no duplicate created. *(FR-011, FR-018)*
16. **Archived door names stay reserved.** Submit the name of an **archived** door of that
    warehouse. Confirm it is rejected as a duplicate. *(FR-011)*
17. **Same name in another warehouse.** Create a door in a second available warehouse using a name
    already used in the first. Confirm it succeeds and both doors remain listed under their own
    warehouse. *(FR-012)*
18. **Outside the footprint.** Drag the pending marker outside the warehouse polygon, or type
    coordinates outside it. Confirm the submission is blocked with a message about placing the door
    inside the footprint and that no door is created. *(FR-014)*
19. **On the boundary.** Place the door exactly on a footprint edge and confirm it is created.
    *(edge case)*
20. **Invalid coordinates.** Type a non-numeric coordinate and one outside the valid range. Confirm
    each is rejected on its field with no door created. *(FR-013)*
21. **Cancel discards.** With a pending marker and a typed name, cancel — then dismiss the sheet in
    a second run. Confirm both discard the pending marker, create no door, and return the map to
    consultation. *(FR-021)*
22. **Failure and retry.** With the API stopped, submit a valid door. Confirm a failure message, the
    name and pending marker preserved, and no door created. Restart the API, retry, and confirm
    exactly one door exists. *(FR-019)*

### Direct API checks

```bash
# Eligibility: archived warehouse -> 409 E_WAREHOUSE_ARCHIVED
curl -i -X POST http://localhost:3333/api/v1/warehouse-doors \
  -H 'content-type: application/json' -b cookies.txt \
  -d '{"warehouseId":"<archived-warehouse-id>","name":"Door X","latitude":49.4933,"longitude":0.1084}'

# Unknown or malformed warehouse -> 404 E_WAREHOUSE_NOT_FOUND (never a 500)
curl -i -X POST http://localhost:3333/api/v1/warehouse-doors \
  -H 'content-type: application/json' -b cookies.txt \
  -d '{"warehouseId":"not-a-uuid","name":"Door X","latitude":49.4933,"longitude":0.1084}'

# Outside the footprint -> 422 E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT
curl -i -X POST http://localhost:3333/api/v1/warehouse-doors \
  -H 'content-type: application/json' -b cookies.txt \
  -d '{"warehouseId":"<available-warehouse-id>","name":"Door Y","latitude":0,"longitude":0}'

# Concurrency: same name twice at once -> exactly one 201, one 409
```

Also confirm that an unauthenticated request returns 401 and that an active non-administrator
returns 403, in both cases with no row written.

## Automated verification

```bash
pnpm check                                   # Biome format + lint
pnpm typecheck
pnpm --filter @portflow/api test             # Japa: warehouse-door creation unit + integration
pnpm --filter @portflow/web test             # Vitest: warehouse-doors create/
pnpm test                                    # full fast suite
```

Expected new coverage, per [research.md](./research.md) R12:

- `apps/api/tests/unit/warehouse_doors/warehouse_door_policy.spec.ts` — `create` per role and access
  status
- `apps/api/tests/unit/warehouse_doors/creation/create.spec.ts` — name trimming and length,
  coordinate range, containment refusal, every repository result arm mapped to its exception,
  Available status and creation time on success
- `apps/api/tests/integration/warehouse_doors/creation/create.spec.ts` — 201 with the persisted row,
  401, 403, 404 (including a malformed id), 409 archived, 409 duplicate (cross-case and
  archived-door name), 422 blank / too long / out-of-range / outside-footprint, a name reused across
  warehouses succeeding, and no row left behind on any rejection
- `apps/web/src/features/warehouse-doors/__tests__/create/{placement,create,validation,permissions}.test.tsx`
  — arming, click-to-place and marker move, coordinate sync, cancel discarding, the reveal in the
  Available view, each rejection preserving the name and pending point, and the action's absence for
  non-administrators and archived warehouses

## Regression guard

The existing warehouse-door and warehouse consultation tests
(`warehouse-doors/__tests__/{consultation,feedback,markers}.test.tsx`,
`warehouses/__tests__/{consultation,warehouses-page,warehouse-map}.test.tsx`) must pass **unchanged
in substance**. They are the proof that adding a second, warehouse-scoped map mode did not alter how
warehouses and their doors are browsed, filtered, or selected — and that the embedded door shape
under `warehouses.index` was not changed.

## Definition of done

- Every scenario above behaves as described
- All automated checks pass
- The affected browser flow is exercised manually per constitution principle VII
- A fresh read-only review assesses the final diff, with confirmed findings resolved or justified
