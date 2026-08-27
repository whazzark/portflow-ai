# Phase 1 Quickstart: Validate Archive a Warehouse Door

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) |
**Contracts**: [API](./contracts/warehouse-doors-archive.openapi.yaml) · [UI state](./contracts/warehouse-door-archive-ui-state.md)

## Prerequisites

- A Node.js version compatible with the workspace dependencies and PNPM 10.28.1
- PostgreSQL configured for the API development environment
- Dependencies installed with `pnpm install`
- An active organization administrator, an active operations administrator, and a second active
  account without warehouse administration rights (e.g. an Observer)
- An **available warehouse with at least four available doors**, so a selection can mix eligible and
  blocked ones
- One of those doors **held by a Planned or Active Discharge** through a current product lot
  assignment, to prove the in-use refusal — and one door involved only through a **Closed** discharge
  or an **ended** assignment, to prove those do not block
- One door that belongs to a **planned or active shift but holds no current product lot assignment**,
  to prove shift membership alone does not block (FR-008)
- An **archived door** under that warehouse, archived **with its warehouse** (through #210) and then
  left archived, to prove a second archival is refused and its provenance is not rewritten
- A **second available warehouse with exactly one available door**, to prove archiving the last
  available door leaves the warehouse available
- An **archived warehouse** with doors, to prove none of its rows offers an archive action
- Deployment-approved MapLibre style URLs (`VITE_MAP_STYLE_LIGHT_URL` / `VITE_MAP_STYLE_DARK_URL`)
  so the warehouse map renders

No migration is needed: `warehouse_doors` already carries `status`, `archived_at`,
`archived_by_user_id`, `archive_comment`, and `archived_with_warehouse` from #212 and #210.

## Start the application

```bash
pnpm --filter @portflow/api db:migrate   # no-op unless the workspace is behind
pnpm dev
```

Authenticate as an authorized administrator and open `/warehouses`.

## End-to-end validation scenarios

### One door

1. **Entry point and permission gate.** Select an available warehouse and confirm each available door
   row's action menu (`Actions for <door name>`) now offers `Edit` **and** `Archive`, the latter
   styled as destructive. Sign in as the Observer and confirm no menu is rendered at all.
   *(FR-001, FR-002, FR-027)*
2. **Lifecycle gates in the interface.** Switch to the Archived door view and confirm those rows
   render **no menu at all** — not a menu with a dead `Archive`. Select the archived warehouse and
   confirm the same for every one of its doors. *(FR-004, FR-005, FR-027)*
3. **The confirmation.** Activate `Archive` on an eligible door. Confirm the dialog names the door,
   states it *remains readable but is no longer available for new operations*, offers
   `Comment (optional)` capped at 1,000 characters, and says **nothing about cascading** — a door
   archives nothing with it. *(FR-021)*
4. **Abandoning.** Cancel the dialog and confirm the door is untouched: still in the Available view,
   same count, no archive context. *(FR-022)*
5. **Archiving with a comment.** Confirm with a comment. Expect the toast `Door archived`, the door
   gone from the Available view without a manual reload, the Archived count incremented, and its row
   in the Archived view reading **`Archived on its own`**, the date, and the comment.
   *(FR-010, FR-011, FR-017, FR-026)*
6. **Archiving without a comment.** Repeat on another door with the comment left empty — and once
   with **whitespace only** — and confirm no comment is shown in either case. *(FR-012)*
7. **Preservation.** Confirm the archived door keeps its name, its coordinates, its position on the
   map (restyled as archived, not moved), its containing warehouse, and its creation time; and that
   the **containing warehouse is unchanged** — same status, same lifecycle context. *(FR-014, FR-015)*
8. **The last available door.** In the second warehouse, archive its only available door. Confirm the
   archival succeeds, the warehouse stays available, and the Available door view shows its empty
   state rather than an error. *(FR-015)*
9. **The name stays reserved.** Try to create a new door in the same warehouse under the archived
   door's name — and under a different casing of it. Both must be refused as duplicates. *(FR-019)*
10. **History intact.** Open the discharges, shifts, and rotations that referenced the archived door
    and confirm they still point at it and remain readable, including an unvalidated rotation that
    can still be corrected onto it. *(FR-016, FR-020)*
11. **In use.** Activate `Archive` on the door held by a Planned or Active Discharge. Expect a
    refusal naming the in-use reason, the dialog left open with the typed comment, and the door still
    available. Close that discharge (or end the assignment), retry, and confirm it now succeeds.
    *(FR-006, FR-007, FR-009)*
12. **Not blocked by the past, nor by a shift alone.** Archive the door involved only through a
    Closed discharge or an ended assignment, and the door that belongs to a shift without a current
    product lot assignment. Both must succeed. *(FR-008)*
13. **Already archived.** Activate `Archive` twice in quick succession on the same door (a second
    browser tab is enough). Expect exactly one archival recorded and the second attempt refused as
    already archived, with the first archive time, actor, and comment unchanged. *(FR-024, FR-025)*

### Several doors

14. **No mode to enter.** Select an available warehouse. Confirm checkboxes are already on every
    available door row with a `Select all` above them, the door markers are already checkable, and
    `Create door` and the row menus still work. Confirm no `Select doors` control exists and the URL
    gains nothing. *(FR-039, FR-040, research R7)*
15. **Scope of the selection.** Check two doors, then switch to the Archived view: the selection
    empties. Return to Available: it is **still** empty. Check two again, then select **another
    warehouse** and come back: empty again. Neither leaves a hidden door queued. *(FR-040)*
16. **Mode exclusivity.** With doors checked, activate `Create door`, then a door `Edit`, then
    `Select warehouses`. Each must empty the selection before its own mode opens — and **cancelling**
    the creation or the edit must not bring it back. *(FR-041)*
17. **Count and clear.** Check two doors and confirm the selection row reads `2 selected` beside
    `Archive selected`. Press `Clear selection`: every checkbox clears and the row goes quiet.
    *(FR-039, FR-042)*
18. **The row menu and the selection agree.** Check two doors in a warehouse that has a third, then
    archive one of the checked doors through **its own row menu**. Confirm the row leaves the
    Available list and the count drops to `1 selected`, so `Archive selected` cannot resubmit it.
    *(FR-040)*
19. **Map and list agree.** Check a door in the list and confirm its marker rings; click a marker and
    confirm it both checks the row and highlights the door. With nothing checked, confirm another
    warehouse's polygon is still clickable; with one door checked, confirm it is not. *(FR-039,
    research R7)*
20. **Keyboard.** Confirm the select-all and clear shortcuts still act on the **warehouses** on the
    map, whether or not doors are checked: doors carry no binding of their own. *(research R8)*
21. **Archiving a mixed selection.** Select four doors: two eligible, one in use, one already
    archived. Confirm the row reads `4 selected`, the confirmation counts four, and after submitting:
    the two eligible ones are archived, the toast reports `2 doors archived; 2 doors unchanged` with
    a reason per door, and the two blocked ones are untouched. *(FR-032, FR-033, FR-038)*
22. **Identical metadata.** Confirm both newly archived doors carry the **same** archive time, the
    same administrator, and the same comment, and that both read `Archived on its own`.
    *(FR-034, FR-011)*
23. **Retry path.** Confirm the in-use door is still checked after the submission and the
    already-archived one is not; release the blocking work and retry `Archive selected` without
    reselecting. *(FR-039, research R9)*
24. **All blocked.** Select only blocked doors and submit. Expect nothing archived, a message saying
    so, and one reason per door. *(FR-032, FR-033)*
25. **Unknown id.** Check doors and have one of them deleted server-side — or replay the request with
    an unknown uuid. Expect that id reported `not found` while the others are still archived.
    *(FR-033)*
26. **Door of an archived warehouse.** Only reachable by replaying the bulk request: craft a
    submission naming an available door whose warehouse is archived. Expect it reported
    `its warehouse is archived` while its eligible siblings are archived, matching the single path's
    `E_WAREHOUSE_ARCHIVED`. *(FR-033)*
27. **Authorization.** As the Observer, confirm no checkbox, no `Select all`, and no selection row is
    rendered on any warehouse. *(FR-002, FR-030)*

## Contract checks with curl

```bash
# Sign in and keep the session
curl -i -c cookies.txt -X POST http://localhost:3333/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"<admin-email>","password":"<password>"}'

# Archive one door
curl -i -X POST http://localhost:3333/api/v1/warehouse-doors/<door-id>/archive \
  -H 'content-type: application/json' -b cookies.txt \
  -d '{"comment":"Walled up during the 2026 works"}'

# Already archived -> 409 E_WAREHOUSE_DOOR_ALREADY_ARCHIVED, context unchanged
curl -i -X POST http://localhost:3333/api/v1/warehouse-doors/<door-id>/archive \
  -H 'content-type: application/json' -b cookies.txt -d '{}'

# In use -> 409 E_WAREHOUSE_DOOR_IN_USE
curl -i -X POST http://localhost:3333/api/v1/warehouse-doors/<in-use-door-id>/archive \
  -H 'content-type: application/json' -b cookies.txt -d '{}'

# Unknown and malformed ids -> 404 E_WAREHOUSE_DOOR_NOT_FOUND, never a 500
curl -i -X POST http://localhost:3333/api/v1/warehouse-doors/not-a-uuid/archive \
  -H 'content-type: application/json' -b cookies.txt -d '{}'

# Bulk: partial success -> 200 with updatedDoors and blockedDoors
curl -i -X POST http://localhost:3333/api/v1/warehouse-doors/archive \
  -H 'content-type: application/json' -b cookies.txt \
  -d '{"ids":["<eligible-id>","<in-use-id>","<archived-id>"],"comment":"Row condemned"}'

# Invalid submissions -> 422 before anything is read
curl -i -X POST http://localhost:3333/api/v1/warehouse-doors/archive \
  -H 'content-type: application/json' -b cookies.txt -d '{"ids":[]}'
curl -i -X POST http://localhost:3333/api/v1/warehouse-doors/archive \
  -H 'content-type: application/json' -b cookies.txt -d '{"ids":["<id>","<id>"]}'
curl -i -X POST http://localhost:3333/api/v1/warehouse-doors/archive \
  -H 'content-type: application/json' -b cookies.txt \
  -d '{"ids":["<id>"],"comment":"'"$(printf 'x%.0s' {1..1001})"'"}'

# Cross-warehouse submission is accepted; each door answers for its own warehouse (research R12)
curl -i -X POST http://localhost:3333/api/v1/warehouse-doors/archive \
  -H 'content-type: application/json' -b cookies.txt \
  -d '{"ids":["<door-of-warehouse-A>","<door-of-warehouse-B>"]}'
```

Also confirm that an unauthenticated request returns 401 and an active non-administrator returns 403,
in both cases with no column written.

## Automated verification

```bash
pnpm check                                   # Biome format + lint
pnpm typecheck
pnpm --filter @portflow/api test             # Japa: warehouse-door lifecycle unit + integration
pnpm --filter @portflow/web test             # Vitest: warehouse-doors archive/
pnpm test                                    # full fast suite
```

Expected new coverage, per [research.md](./research.md) and [data-model.md](./data-model.md):

- `apps/api/tests/unit/warehouse_doors/warehouse_door_policy.spec.ts` — the `archive` ability per
  role and access status
- `apps/api/tests/unit/warehouse_doors/lifecycle/archive.spec.ts` — comment trimming to `null`, and
  every repository result arm mapped to its exception (research R6)
- `apps/api/tests/unit/warehouse_doors/lifecycle/bulk_archive.spec.ts` — the blocker helper: each
  reason, submission order preserved in `updatedDoors`, and an all-blocked submission returning an
  empty `updatedDoors` rather than throwing
- `apps/api/tests/integration/warehouse_doors/lifecycle/archive.spec.ts` — 200 with and without a
  comment, `archivedWithWarehouse` written `false`, identity/name/position/`warehouseId`/`createdAt`
  and any prior reactivation context preserved, the containing warehouse untouched including on its
  last available door; 401; 403; 404 unknown and malformed id; 409 already archived (twice, and
  against a door archived *with* its warehouse, whose provenance must not flip), 409 in use, 409
  archived warehouse; 422 over-long comment; and no column written on any refusal
- `apps/api/tests/integration/warehouse_doors/lifecycle/bulk_archive.spec.ts` — partial success with
  one reason per blocked door, identical archive metadata across the submission, all-blocked,
  cross-warehouse submission, 422 for empty/duplicate/malformed ids, and roll-back on failure
- `apps/api/tests/integration/warehouses/lifecycle/archive.spec.ts` *(extended)* — a door archived on
  its own is left untouched by its warehouse's later archival, and is **not** restored by the
  warehouse's reactivation (SC-008, invariant I1)
- `apps/web/src/features/warehouse-doors/__tests__/archive/{entry,confirmation,selection,bulk,permissions}.test.tsx`
  — the row menu offering `Archive` and its absence per permission and lifecycle; the confirmation's
  copy, comment, cancel, success, and refusal-keeps-dialog-open behaviour; entering and leaving the
  select mode; scope rules on view and warehouse change; mode exclusivity; list/marker agreement;
  keyboard rebinding; partial-outcome reporting and the `IN_USE` retry narrowing

## Regression guard

The existing warehouse-door and warehouse tests
(`warehouse-doors/__tests__/{consultation,feedback,markers}.test.tsx`,
`warehouse-doors/__tests__/{create,update}/*`, and
`warehouses/__tests__/{consultation,warehouses-page,warehouse-map,select-mode,selection-scope,keyboard-shortcuts,bulk-archive}.test.tsx`)
must pass **unchanged in substance**. They are the proof that adding a fourth map mode did not alter
how warehouses and their doors are browsed, filtered, selected, created, reshaped, or bulk-archived.

Four specific regressions to watch, because this slice touches their seams:

- **`warehouse_doors.available` and #213's 201** must still serialize correctly with the four archive
  members added to the transformer (research R5).
- **The warehouse select mode** must still clear `warehouseId` on entry and keep its own keyboard
  shortcuts when no door selection is active (research R8).
- **Door creation and door update** must still arm and disarm exactly as before; the new mode only
  adds a fourth value to the same exclusivity rule (FR-041).
- **#210's cascade and #211's restore** must be unaffected: a door archived by a cascade still carries
  `archivedWithWarehouse: true` and still comes back on reactivation.

## Definition of done

- Every scenario above behaves as described
- All automated checks pass
- The affected browser flow is exercised manually per constitution principle VII
- A fresh read-only review assesses the final diff, with confirmed findings resolved or justified
