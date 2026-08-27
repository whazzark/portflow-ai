# Phase 1 Quickstart: Validate Update a Warehouse Door

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) |
**Contracts**: [API](./contracts/warehouse-doors-update.openapi.yaml) · [UI state](./contracts/warehouse-door-update-ui-state.md)

## Prerequisites

- A Node.js version compatible with the workspace dependencies and PNPM 10.28.1
- PostgreSQL configured for the API development environment
- Dependencies installed with `pnpm install`
- An active organization or operations administrator account, and a second active account without
  warehouse management permission (e.g. an Observer)
- At least one **available** warehouse with a footprint containing **at least three doors**, so a
  rename can collide with a sibling and a reposition can land on another door's position
- At least one **archived door** under that available warehouse, to prove an archived door's name
  stays reserved, that the door itself is read-only, and that its row offers no action menu
- At least one **archived warehouse** with doors, to prove its doors are not editable
- A **second available warehouse** with a door whose name duplicates one in the first, to prove
  uniqueness is scoped to the containing warehouse
- One door referenced by a planned or active discharge — assigned to a product lot or planned into a
  shift — to prove usage does not block an update
- Deployment-approved MapLibre style URLs (`VITE_MAP_STYLE_LIGHT_URL` / `VITE_MAP_STYLE_DARK_URL`)
  so the warehouse map renders

No migration is needed: `warehouse_doors` already exists from #212 with its
`(warehouse_id, LOWER(name))` unique index, its coordinate CHECK constraints, and `updated_at`.

## Start the application

```bash
pnpm --filter @portflow/api db:migrate   # no-op unless the workspace is behind
pnpm dev
```

Authenticate as an authorized administrator and open `/warehouses`.

## End-to-end validation scenarios

1. **Entry point and permission gate.** Select an available warehouse and confirm each of its
   available door rows hosts an action menu (`Actions for <door name>`) containing `Edit` — and only
   `Edit`, with no `Archive` or `Reactivate` in this slice. Sign in as the Observer instead and
   confirm no menu is rendered at all, and that loading
   `/warehouses?edit=door&warehouseId=<id>&doorId=<id>` directly renders ordinary consultation with
   no panel and no draft marker. *(FR-001, FR-002, FR-005, FR-027)*
2. **Lifecycle gates in the interface.** Switch to the Archived door view and confirm those rows
   render **no menu at all** — not a menu with a dead item. Select a door of an **archived
   warehouse** and confirm the same, and that both deep links are inert. *(FR-015, FR-016)*
2b. **Editing without pre-selecting.** From a warehouse where no door is selected, open a door row's
   menu and choose `Edit`. Confirm that one gesture both selects that door and opens its session,
   with `warehouseId`, `doorId`, and `edit=door` all set. *(research R10)*
3. **Opening the session.** Activate `Edit` on an available door. Confirm the URL gains `edit=door`
   while keeping `warehouseId` and `doorId`, the panel opens titled "Edit door" pre-filled with the
   door's current name and coordinates, the containing warehouse is shown as fixed, and an explicit
   way to leave without saving is offered. *(FR-005)*
4. **The draft replaces the stored marker.** Confirm the door under edit is represented by a single
   labelled draft marker and that no second, stale marker for the same door remains on the map, while
   the warehouse's other doors stay rendered. *(research R7)*
5. **Repositioning by drag.** Drag the draft marker to another point inside the footprint and confirm
   the latitude and longitude fields follow it. *(FR-006)*
6. **Repositioning by coordinates.** Edit the latitude and longitude fields directly and confirm the
   draft marker moves to the typed position; complete a reposition with the keyboard alone.
   *(FR-006)*
7. **Restore original position.** After moving the draft, confirm "Position modified" appears and
   that "Restore original position" returns the marker to where the door stood when the session
   opened. *(FR-025, data-model)*
8. **Clicks select nothing.** With the session open, click empty map, another door's marker, and a
   warehouse polygon. Confirm none selects anything, opens anything, or moves the draft.
   *(FR-005a, research R7)*
9. **Anchoring.** Pan and zoom the map with the draft moved, and confirm it stays on its geographic
   position. *(spec edge case)*
10. **Rename only.** Save a new valid name without touching the position. Confirm a "Door updated"
    toast, the door listed and shown under its new name at its **unchanged** coordinates, and its
    Available status, containing warehouse, and creation time unchanged. *(FR-004, FR-014)*
11. **Reposition only.** Save a moved position without touching the name. Confirm the door is shown
    at its new coordinates under its unchanged name, with no manual reload. *(FR-004, FR-020)*
12. **Both together.** Change the name and the position in one submission and confirm both take
    effect. Then force a rejection on a combined submission (a duplicate name plus a valid move) and
    confirm **neither** change was applied. *(FR-004, FR-018)*
13. **No-op submission.** Save the door's current name and current position unchanged. Confirm it
    succeeds without a duplicate-name refusal and leaves the door as it was. *(FR-011, spec edge
    case)*
14. **Case-only correction.** Change only the letter casing of the door's own name and confirm it is
    accepted and stored with the new casing, not refused as a duplicate of itself. *(FR-011,
    research R4)*
15. **Whitespace trimming.** Save a name with leading and trailing spaces and confirm the stored name
    is trimmed while its casing is preserved. *(FR-009)*
16. **Blank and over-long names.** Submit a name of only whitespace, then one over 255 characters.
    Confirm each is rejected on the name field, the stored door is unchanged, and the draft position
    and entered name are preserved. *(FR-007, FR-008, FR-024)*
17. **Duplicate name in the same warehouse.** Submit the name of another door of that warehouse,
    differing only by case or surrounding whitespace. Confirm a conflict message on the name field
    and that neither door changed. *(FR-010)*
18. **Archived door names stay reserved.** Submit the name of the **archived** door of that
    warehouse. Confirm it is still refused as a duplicate. *(FR-010)*
19. **Same name in another warehouse.** Rename a door to a name already used by a door of the
    **other** warehouse. Confirm it succeeds and both doors remain listed under their own warehouse.
    *(FR-011a)*
20. **Outside the footprint.** Drag the draft outside the warehouse polygon, or type coordinates
    outside it. Confirm the save is blocked with a message about the footprint constraint and the
    stored position is unchanged. *(FR-013)*
21. **On the boundary, and onto another door.** Move the door exactly onto a footprint edge and save;
    then move it onto another door's exact position and save. Confirm both are accepted.
    *(spec edge cases)*
22. **Invalid coordinates.** Type a non-numeric coordinate and one outside the valid range. Confirm
    each is rejected on its field with the stored position unchanged. *(FR-012)*
23. **Cancel discards.** With a moved draft and an edited name, cancel — then dismiss the sheet in a
    second run. Confirm both leave the stored door untouched, return the marker to its stored
    coordinates, and return the map to consultation. *(FR-025)*
24. **Usage does not block, and references survive.** Update the door referenced by a planned or
    active discharge. Confirm the save succeeds and that the shift, product lot assignment, and any
    rotation still reference the same door, now under its corrected name and position. *(FR-021)*
25. **Failure and retry.** With the API stopped, save a valid change. Confirm a clear retryable
    failure message, the entered name and draft position preserved, and the stored door unchanged.
    Restart the API, retry, and confirm the correction was applied exactly once. *(FR-018)*
26. **Mode exclusivity.** With a session open, activate "Create door" and then "Create warehouse".
    Confirm the session ends without saving each time and that no draft leaks into the creation
    flow. *(FR-005b)*

### Direct API checks

```bash
# Rename only -> 200, position untouched, updatedAt advanced
curl -i -X PATCH http://localhost:3333/api/v1/warehouse-doors/<door-id> \
  -H 'content-type: application/json' -b cookies.txt \
  -d '{"name":"Door 4"}'

# Reposition only -> 200
curl -i -X PATCH http://localhost:3333/api/v1/warehouse-doors/<door-id> \
  -H 'content-type: application/json' -b cookies.txt \
  -d '{"latitude":49.4935,"longitude":0.1086}'

# A coordinate without its pair -> 422 E_VALIDATION_ERROR on the missing member
curl -i -X PATCH http://localhost:3333/api/v1/warehouse-doors/<door-id> \
  -H 'content-type: application/json' -b cookies.txt -d '{"latitude":49.4935}'

# An empty body -> 422 E_VALIDATION_ERROR
curl -i -X PATCH http://localhost:3333/api/v1/warehouse-doors/<door-id> \
  -H 'content-type: application/json' -b cookies.txt -d '{}'

# Archived door -> 409 E_WAREHOUSE_DOOR_ARCHIVED
# Door of an archived warehouse -> 409 E_WAREHOUSE_ARCHIVED
# Unknown or malformed door id -> 404 E_WAREHOUSE_DOOR_NOT_FOUND (never a 500)
curl -i -X PATCH http://localhost:3333/api/v1/warehouse-doors/not-a-uuid \
  -H 'content-type: application/json' -b cookies.txt -d '{"name":"Door 9"}'

# Outside the footprint -> 422 E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT
curl -i -X PATCH http://localhost:3333/api/v1/warehouse-doors/<door-id> \
  -H 'content-type: application/json' -b cookies.txt -d '{"latitude":0,"longitude":0}'

# Immutability: warehouseId, status, and createdAt in the body are ignored, never applied
curl -i -X PATCH http://localhost:3333/api/v1/warehouse-doors/<door-id> \
  -H 'content-type: application/json' -b cookies.txt \
  -d '{"name":"Door 5","warehouseId":"<other-warehouse-id>","status":"ARCHIVED"}'

# Concurrency: two doors of one warehouse renamed to the same name at once -> one 200, one 409
```

Also confirm that an unauthenticated request returns 401 and that an active non-administrator
returns 403, in both cases with no column written.

## Automated verification

```bash
pnpm check                                   # Biome format + lint
pnpm typecheck
pnpm --filter @portflow/api test             # Japa: warehouse-door update unit + integration
pnpm --filter @portflow/web test             # Vitest: warehouse-doors update/
pnpm test                                    # full fast suite
```

Expected new coverage, per [research.md](./research.md) and [data-model.md](./data-model.md):

- `apps/api/tests/unit/warehouse_doors/warehouse_door_policy.spec.ts` — the `update` ability per role
  and access status
- `apps/api/tests/unit/warehouse_doors/update/update.spec.ts` — name trimming and length, coordinate
  range, the containment predicate passed only when a position was submitted (research R3), and every
  repository result arm mapped to its exception
- `apps/api/tests/integration/warehouse_doors/update/update.spec.ts` — 200 for name-only,
  position-only, both, and a no-op, with `updatedAt` advanced and identity, `warehouseId`, `status`,
  and `createdAt` preserved; 401; 403; 404 for an unknown and a malformed door id; 409 archived door,
  409 archived warehouse, 409 duplicate (cross-case and against an archived door's name); 422 blank /
  too long / out-of-range / lonely coordinate / empty body / outside-footprint; a name reused across
  warehouses succeeding; a case-only self-rename succeeding; ignored `warehouseId` / `status` /
  `createdAt` members; and no column changed on any rejection
- `apps/web/src/features/warehouse-doors/__tests__/update/{entry,session,reposition,validation,permissions}.test.tsx`
  — the row menu's presence and absence per permission and lifecycle, and that it offers `Edit`
  alone; `Edit` selecting the door and opening the session in one step; session snapshotting and
  discard on selection change; drag and coordinate sync; restore-original-position; clicks selecting
  nothing; cancel leaving the door untouched; each rejection preserving the entered name and draft;
  and the corrected door staying selected after a save

## Regression guard

The existing warehouse-door and warehouse tests
(`warehouse-doors/__tests__/{consultation,feedback,markers}.test.tsx`,
`warehouse-doors/__tests__/create/*`,
`warehouses/__tests__/{consultation,warehouses-page,warehouse-map}.test.tsx`, and
`warehouses/__tests__/update/*`) must pass **unchanged in substance**. They are the proof that adding
a third map mode did not alter how warehouses and their doors are browsed, filtered, selected,
created, or reshaped — and that the embedded door shape under `warehouses.index` was not changed.

Three specific regressions to watch, because this slice touches their seams:

- **`warehouse_doors.available` and #213's 201** must still serialize correctly with `updatedAt`
  added to the transformer (research R5).
- **Door creation's armed map** must still place on click: `suppressesSelection` widens from
  `doorPlacement?.armed` to `doorPlacement !== undefined`, which must not disarm creation.
- **The trucks, customers, and transport-companies row menus** must be unaffected by
  `renderDialog` becoming optional on `ResourceRowActions` (research R10). Their existing tests
  (`trucks/__tests__/*`, `customers/__tests__/*`, `transport-companies/__tests__/*`) are the guard,
  and all three still pass the prop.

## Definition of done

- Every scenario above behaves as described
- All automated checks pass
- The affected browser flow is exercised manually per constitution principle VII
- A fresh read-only review assesses the final diff, with confirmed findings resolved or justified
