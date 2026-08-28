# Phase 1 Quickstart: Validate Reactivate a Warehouse Door

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) |
**Contracts**: [API](./contracts/warehouse-doors-reactivate.openapi.yaml) · [UI state](./contracts/warehouse-door-reactivate-ui-state.md)

## Prerequisites

- A Node.js version compatible with the workspace dependencies and PNPM 10.28.1
- PostgreSQL configured for the API development environment
- Dependencies installed with `pnpm install`
- An active organization or operations administrator account, and a second active account without
  warehouse management permission (e.g. an Observer)
- At least one **available warehouse** holding:
  - at least one **archived** door — which under an available warehouse is exactly a door archived on
    its own, the only reactivatable shape and the input the success path needs
  - at least one **available** door, to prove the entry is not offered for it
- At least one **archived warehouse** holding at least one door — necessarily archived with it, since
  the archival takes every door
- Deployment-approved MapLibre style URLs (`VITE_MAP_STYLE_LIGHT_URL` / `VITE_MAP_STYLE_DARK_URL`)
  so the warehouse map renders

One migration is required, and it only **drops** a column: `archived_with_warehouse`, which the
clarification leaves with nothing to record. Run `pnpm --filter @portflow/api db:migrate` before
anything else, and regenerate `apps/api/database/schema.ts` with it. The columns this slice writes —
`status`, `reactivated_at`, `reactivated_by_user_id`, `reactivation_comment`, `updated_at` — have
existed since #210.

### Producing the fixtures

**#215 Archive a Warehouse Door is not delivered**, so there is no production gesture that archives a
door on its own. Until it lands, produce that state with the existing factory state:

```ts
// Under an AVAILABLE warehouse: archived on its own.
await WarehouseDoorFactory.merge({ warehouseId: availableWarehouse.id }).apply('archived').create()
// Under an ARCHIVED warehouse: archived with it.
await WarehouseDoorFactory.merge({ warehouseId: archivedWarehouse.id }).apply('archived').create()
```

Archiving a warehouse through the delivered `/warehouses/:id/archive` produces the second shape
directly — and now takes every door it holds, whatever their status.

## Start the application

```bash
pnpm --filter @portflow/api db:migrate   # no-op unless the workspace is behind
pnpm dev
```

Authenticate as an authorized administrator and open `/warehouses`.

## End-to-end validation scenarios

### The entry point

1. **The entry appears only where it may.** Select the available warehouse and open its Archived door
   view. Confirm the door archived on its own hosts an action menu (`Actions for <door name>`)
   containing `Reactivate`, and that the menu contains no `Edit` for it. Switch to the Available view
   and confirm those rows offer `Edit` and **no** `Reactivate`. *(FR-003, FR-021, FR-024)*
2. **No door of an archived warehouse offers anything.** Select the archived warehouse, open its
   Archived door view, and confirm every row — each marked `Archived with this warehouse`, a line
   derived from the warehouse's own status — renders **no menu at all**, not a menu with a dead item.
   *(FR-006, FR-007, UI contract)*
3. **The provenance line follows the warehouse.** On the available warehouse, confirm the archived
   door's row reads `Archived on its own`. Archive that warehouse, reopen its Archived door view, and
   confirm the same row now reads `Archived with this warehouse` — the line is derived from the
   containing warehouse's status, not from anything stored on the door. Reactivate the warehouse
   before continuing. *(FR-007, UI contract)*
4. **Permission gate.** Sign in as the Observer and confirm no door row renders an action menu at
   all, in either lifecycle view, on either warehouse. *(FR-002, SC-005)*

### The confirmation

5. **What it says.** Activate `Reactivate` on the door archived on its own. Confirm the dialog is
   titled `Reactivate warehouse door?`, states `“<door name>” becomes available again for new
   operations.`, offers a `Comment (optional)` field described as `maximum 1,000 characters`, and
   offers `Cancel` and `Reactivate`. Confirm the confirm button is **not** the destructive variant.
   *(FR-022)*
6. **Abandoning changes nothing.** Cancel, and with `Escape`, and by clicking outside. Confirm the
   door is still archived, the panel is unchanged, and focus returns to the row's menu trigger.
   *(FR-023, US1 scenario 9)*

### The success path

7. **Reactivate with a comment.** Reopen the confirmation, type a comment, and confirm. Verify: the
   dialog closes, a `Warehouse door reactivated` toast appears, the door disappears from the Archived
   view and appears in the Available view, **both tab counts move**, and no page reload was needed.
   *(FR-009, FR-020, SC-001)*
8. **The tab does not follow the door.** Confirm the panel stayed on the Archived view rather than
   switching to Available. *(research R11)*
9. **The row tells the new story.** Switch to the Available view and confirm the door's row shows
   `Reactivated · <date> · <comment>` and no longer shows any `Archived …` line — even though its
   archive timestamp is still stored. *(FR-020, research R10)*
10. **Nothing else moved.** Confirm the door kept its name, its coordinates, its marker position, and
    its containing warehouse, that its marker now uses the available styling, and that no other door
    of that warehouse changed status. *(FR-012, FR-014, US1 scenario 10)*
11. **Reactivate without a comment.** Repeat on a second door archived on its own, leaving the
    comment empty; then a third with whitespace only. Confirm both succeed and neither row shows a
    comment fragment. *(FR-010, SC-007)*
12. **The archive history survived.** Query the reactivated door and confirm `archived_at`,
    `archived_by_user_id`, and `archive_comment` are still populated alongside the new
    `reactivated_*` values, and that `updated_at` advanced to the reactivation time. *(FR-013,
    research R5)*
13. **Offered again for operations.** Call `GET /api/v1/warehouse-doors/available` and confirm the
    reactivated door is present. *(FR-017)*
14. **The cycle survives a warehouse round trip.** Archive a door on its own, then archive its
    warehouse: confirm the door's archive time, actor, and comment have been replaced by the
    building's. Reactivate the warehouse: confirm that door came back with every other. Archive it on
    its own again and confirm `Reactivate` is offered once more. *(FR-014, FR-015, SC-011)*

### The refusals

Run each through the API directly as well as through the interface, since the interface withholds
the entry for most of them.

15. **Already available.** `POST /api/v1/warehouse-doors/<available door id>/reactivate` → `409
    E_WAREHOUSE_DOOR_ALREADY_AVAILABLE`, nothing changed. *(FR-004)*
16. **Under an archived warehouse.** Same call on a door of the archived warehouse → `409
    E_WAREHOUSE_DOOR_ARCHIVED_WITH_WAREHOUSE`, and confirm the message says reactivating the
    warehouse brings **this door back with it** — never "reactivate the warehouse first", which would
    name a second step that does not exist. *(FR-006, FR-007, research R3)*
17. **And the remedy works.** `POST /api/v1/warehouses/<archived warehouse id>/reactivate` → 200,
    then confirm the door refused in scenario 16 is now `AVAILABLE` with the warehouse's own
    reactivation time, actor, and comment — one step, exactly as the refusal promised. *(FR-006,
    FR-007)*
18. **Not found, and malformed.** Same call with an unknown UUID and then with `not-a-uuid` → `404
    E_WAREHOUSE_DOOR_NOT_FOUND` both times, never a 500. *(FR-005)*
19. **Unauthorized.** Same call unauthenticated → 401; as the Observer → 403. Confirm no door
    changed in either case. *(FR-002, SC-005)*
20. **Over-long comment.** Same call with a 1,001-character comment → 422 naming the `comment`
    field, the door still archived; resubmit at 1,000 characters and confirm it succeeds. *(FR-011,
    SC-006)*
21. **A refusal keeps the dialog open.** In the interface, open the confirmation on a door archived
    on its own, then reactivate that same door from a second session before confirming. Confirm the
    submission is refused, **the dialog stays open with the typed comment intact**, the toast reads
    `Unable to reactivate warehouse door “<name>”`, and the panel behind it has already refreshed to
    show the door as available. *(FR-028, FR-030, UI contract)*
22. **Concurrency records exactly one.** Fire two simultaneous reactivations of the same archived
    door. Confirm exactly one `200`, one `409 E_WAREHOUSE_DOOR_ALREADY_AVAILABLE`, and a single
    stored `reactivated_at` / `reactivated_by_user_id` / `reactivation_comment` — the loser must not
    overwrite the winner's context. *(FR-028, SC-008)*

## Automated verification

```bash
pnpm check                                   # Biome format + lint
pnpm typecheck
pnpm --filter @portflow/api test             # Japa: policy, use case, integration
pnpm --filter @portflow/web test             # Vitest: entry, reactivate, refusals
pnpm test                                    # the full fast suite
```

Expected new coverage:

| Layer | File | Proves |
|---|---|---|
| API unit | `tests/unit/warehouse_doors/warehouse_door_policy.spec.ts` | `reactivate` allows the two admin roles and refuses every other |
| API unit | `tests/unit/warehouse_doors/lifecycle/reactivate.spec.ts` | comment trimming, and each result kind mapping to its exception |
| API integration | `tests/integration/warehouse_doors/lifecycle/reactivate.spec.ts` | 200, 401, 403, both 404s, all three 409s, 422, and the concurrency case |
| Web | `features/warehouse-doors/__tests__/reactivate/entry.test.tsx` | the menu gate matrix of the UI contract |
| Web | `features/warehouse-doors/__tests__/reactivate/reactivate.test.tsx` | dialog copy, success toast, refetch, row line, tab counts, tab not switching |
| Web | `features/warehouse-doors/__tests__/reactivate/refusals.test.tsx` | dialog stays open, comment preserved, error toast, refresh on the failure path |

## Manual browser flow

No Playwright suite is configured, so scenarios 1–14 and 21 are walked manually before the PR is
marked ready. Record the result in the PR description.

**Scenario 14 and the full archive→reactivate round trip through the interface are blocked on #215**:
until it ships, a door can only be archived on its own through a factory or a direct database write.
Every other scenario is reachable today.

## Definition of done

- All 22 scenarios pass, with the #215 caveat above recorded rather than silently skipped
- `pnpm check`, `pnpm typecheck`, and `pnpm test` are green
- `CONTEXT.md`'s **Warehouse Door** entry states that a door archived on its own is returned to
  service on its own, so both lifecycle directions live in the same home (plan, Principle VI)
- A fresh read-only review has assessed the final diff, with confirmed findings resolved or
  explicitly justified
