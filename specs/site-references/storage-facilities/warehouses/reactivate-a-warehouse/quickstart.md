# Quickstart: Reactivate a Warehouse

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/](./contracts/)

How to run and validate this feature end to end. Implementation details belong in `tasks.md`.

## Prerequisites

```bash
pnpm install
docker compose -f docker/docker-compose.yml up -d     # PostgreSQL 17
pnpm --filter @portflow/api db:fresh                  # migrate + seed
pnpm dev                                              # api on :3333, web on :3000
```

No migration ships with this slice (research **D13**), so `db:fresh` is only needed if your database
predates `#210`'s `archived_with_warehouse` column.

Sign in as an administrator: the seeded `operationsAdmin` or `organizationAdmin` from
`apps/api/database/fixtures/users.ts`. Any active non-administrator is the negative case.

## Read this before validating: the fixtures do not cover the main case

The seeded data contains archived warehouses (`ancien`, `ancienHangar`, and
`WAREHOUSE_FIXTURES[5]`) and archived doors — but **no seeded door carries
`archived_with_warehouse = true`**. The fixtures never set the column, so every seeded archived door
defaults to `false`, meaning "archived on its own".

The consequence is easy to trip over: **reactivating a seeded archived warehouse restores zero
doors.** That is correct behavior (FR-008 + FR-010), and it is a case worth checking — but it is not
the primary happy path, and mistaking it for one would hide a broken restore entirely.

To exercise a real restore, do a **round trip**: archive an available warehouse first, which sets the
marker on its available doors, then reactivate it.

| Warehouse | Seeded state | What reactivating it proves |
|---|---|---|
| `socomac` → archive it first | available, 1 available door | **the main path**: 1 door restored, marker cleared |
| `sica` → archive it first | available, 1 available + 1 archived door | mixed restore: `Porte Nord` returns, `Porte Historique` stays archived (FR-008) |
| `froid` → archive it first | available, 1 available + 1 archived door | second mixed case, for the bulk matrix |
| `hangar7` → archive it first | available, 1 available + 1 reactivated door | prior reactivation context must survive (FR-015) |
| `ancien` | **already archived**, 1 independently archived door | zero-restore success (FR-010); door untouched (FR-008) |
| `ancienHangar` | **already archived**, 1 independently archived door | second zero-restore case |
| any available warehouse | available | `ALREADY_AVAILABLE` refusal (FR-004) |

Unit and integration tests should construct the marker state directly rather than depending on a
prior archive call, so a restore test cannot pass because archival happened to work. The factory
state for it already exists — `WarehouseDoorFactory.apply('archivedWithWarehouse')`, added by `#210`
with the comment *"Reactivating the warehouse (#211) restores exactly these doors"* — beside the
plain `archived` state that leaves the marker `false`. Those two states are the whole test matrix
for FR-007 vs FR-008.

## Validate the API directly

```bash
# Round trip. Step 1: archive, which sets the cascade marker on the available doors.
curl -sX POST localhost:3333/api/v1/warehouses/$SOCOMAC_ID/archive \
  -b cookies.txt -H 'content-type: application/json' -d '{"comment":"Works"}' \
  | jq '{status:.data.warehouse.status, archivedDoorCount:.data.archivedDoorCount}'

# Step 2: reactivate → 200, warehouse AVAILABLE, the cascaded doors AVAILABLE with the same
# reactivation context, archivedWithWarehouse cleared, archive context preserved.
curl -sX POST localhost:3333/api/v1/warehouses/$SOCOMAC_ID/reactivate \
  -b cookies.txt -H 'content-type: application/json' -d '{"comment":"Zone reopened"}' \
  | jq '{status:.data.warehouse.status, reactivatedAt:.data.warehouse.reactivatedAt,
         archivedAt:.data.warehouse.archivedAt,
         doors:[.data.warehouse.doors[]|{name,status,archivedWithWarehouse,archivedAt,reactivatedAt}],
         reactivatedDoorCount:.data.reactivatedDoorCount}'
```

Check four things in that output: `status` is `AVAILABLE`; `archivedAt` is **still populated** on the
warehouse and on the restored door (FR-015); `archivedWithWarehouse` is now `false` (FR-009); and the
warehouse and its restored door share one `reactivatedAt` (FR-007).

```bash
# already available → 409 E_WAREHOUSE_ALREADY_AVAILABLE, nothing changed
curl -sX POST localhost:3333/api/v1/warehouses/$SOCOMAC_ID/reactivate -b cookies.txt -d '{}'

# unknown id → 404 E_WAREHOUSE_NOT_FOUND
curl -sX POST localhost:3333/api/v1/warehouses/00000000-0000-4000-8000-000000000000/reactivate \
  -b cookies.txt -d '{}'

# zero-restore success → 200, reactivatedDoorCount 0, its door still ARCHIVED
curl -sX POST localhost:3333/api/v1/warehouses/$ANCIEN_ID/reactivate -b cookies.txt -d '{}' \
  | jq '{reactivatedDoorCount, doors:[.data.warehouse.doors[]|{name,status}]}'

# comment over 1000 chars → 422, nothing changed
curl -sX POST localhost:3333/api/v1/warehouses/$ANCIEN_HANGAR_ID/reactivate \
  -b cookies.txt -H 'content-type: application/json' \
  -d "{\"comment\":\"$(head -c 1001 < /dev/zero | tr '\0' 'x')\"}"

# bulk, mixed → 200 with partial success
curl -sX POST localhost:3333/api/v1/warehouses/reactivate \
  -b cookies.txt -H 'content-type: application/json' \
  -d "{\"ids\":[\"$ANCIEN_ID\",\"$SICA_ID\",\"00000000-0000-4000-8000-000000000000\"]}" \
  | jq '{reactivated:[.updatedWarehouses[].name], blocked:.blockedWarehouses}'

# duplicated id → 422, rejected before anything is evaluated (distinct from NOT_FOUND)
curl -sX POST localhost:3333/api/v1/warehouses/reactivate \
  -b cookies.txt -H 'content-type: application/json' \
  -d "{\"ids\":[\"$ANCIEN_ID\",\"$ANCIEN_ID\"]}"
```

The mixed bulk call is the FR-030/FR-031 proof: one reactivated, and two blocked with
`ALREADY_AVAILABLE` (`sica`, still available) and `NOT_FOUND`.

Also confirm route order (`/reactivate` resolving before `/:id/reactivate`): the bulk call must not
return `404 E_WAREHOUSE_NOT_FOUND` for an id of `"reactivate"`.

See [contracts/warehouse-reactivate-api.md](./contracts/warehouse-reactivate-api.md) for the full
request/response shapes and the complete failure table.

## Validate in the browser

1. Open `http://localhost:3000/warehouses` as an administrator and switch the lifecycle filter to
   **Archived**.
2. **Single**: click an archived warehouse polygon → the details sheet opens → *Reactivate
   warehouse*. The confirmation names the warehouse and how many of its doors return to service with
   it. Confirm. The warehouse leaves the archived view; switch to Available and check its doors:
   restored doors show as available with **no stale "Archived with this warehouse" line**, while an
   independently archived door is still listed as archived under the Archived door filter.
3. **Lifecycle context**: the details sheet shows the archive time and comment *and* the new
   reactivation time and comment side by side (FR-015).
4. **Abandon**: reopen the dialog on another archived warehouse and cancel — nothing changes
   (FR-019).
5. **Bulk**: press the *Select warehouses* control (or shift-click a polygon) while the Archived view
   is active. Check several archived warehouses. The action bar must read **Reactivate**, not
   Archive. Submit → the toast reports how many were reactivated and names each unchanged one with
   its reason. The selection narrows to the blocked ones so a retry needs no reselection (FR-037).
6. **Homogeneous selection**: with an archived warehouse checked, switch to the **All** filter. The
   available warehouses must not become checkable — the selection's intent is fixed by what is
   already checked (contract: *Intent derivation*).
7. **Shortcuts**: Ctrl/Cmd+A checks every visible archived warehouse while the Archived filter is
   active; Escape clears without leaving select mode. Both must behave exactly as on `/checkpoints`
   (FR-040).
8. **Search does not prune**: with warehouses checked, type a search term that hides some. The
   selection count must not drop (FR-038).
9. **Non-administrator**: sign in as an active non-administrator. No select control, no reactivate
   button, and `/warehouses?selecting=warehouses` has no effect (FR-024, FR-039).

## Test commands

```bash
pnpm --filter @portflow/api test        # Japa: unit + integration
pnpm --filter @portflow/web test        # Vitest + Testing Library + MSW
pnpm test                               # both, via turbo
pnpm check && pnpm typecheck            # Biome + tsc
```

Follow RED → GREEN → REFACTOR (Constitution IV): write the failing observable test first.

### The regression net that matters most

The delivered `#210` suites must pass **unchanged**. This slice edits shared surfaces —
`WarehousePolicy`, `WarehouseRepository`, `warehouses_controller.ts`, `WarehouseDetails`, and
`warehouses-page.tsx` — so an archival regression is the realistic failure mode:

```bash
pnpm --filter @portflow/api test -- warehouses/lifecycle/archive
pnpm --filter @portflow/api test -- warehouses/lifecycle/bulk_archive
pnpm --filter @portflow/api test -- warehouses/lifecycle/door_cascade
pnpm --filter @portflow/web test -- warehouses/__tests__/archive
pnpm --filter @portflow/web test -- warehouses/__tests__/bulk-archive
pnpm --filter @portflow/web test -- warehouses/__tests__/selection-scope
```

`selection-scope` is the one most likely to legitimately need edits, since `checkableIds` gains
intent awareness. Any change there must add reactivation cases rather than relax an archival
assertion.

### New coverage this feature owns

| Level | Location | Proves |
|---|---|---|
| API unit | `tests/unit/warehouses/lifecycle/reactivate.spec.ts` | eligibility, exception mapping, comment trimming |
| API unit | `tests/unit/warehouses/lifecycle/door_restore.spec.ts` | FR-007/008/009/010 — restore set, untouched independent doors, marker cleared, zero-door success |
| API unit | `tests/unit/warehouses/lifecycle/bulk_reactivate.spec.ts` | partial success, `NOT_FOUND` / `ALREADY_AVAILABLE`, shared context, all-or-nothing |
| API unit | `tests/unit/warehouses/lifecycle/comment_validation.spec.ts` | 1,000-char limit and whitespace-only → `null`, both directions |
| API integration | `tests/integration/warehouses/lifecycle/reactivate.spec.ts` | 401/403/404/409/422 wiring, envelope shape, preserved archive context |
| API integration | `tests/integration/warehouses/lifecycle/bulk_reactivate.spec.ts` | route order, invalid selections rejected pre-change, submission-order output |
| Web unit | `__tests__/warehouse-lifecycle-adapter.test.ts` | restore-count helpers and their 0/1/n agreement |
| Web feature | `__tests__/reactivate.test.tsx` | dialog, advisory count, success toast with `reactivatedDoorCount`, cancel |
| Web feature | `__tests__/bulk-reactivate.test.tsx` | intent derivation, Reactivate wording, partial outcome, narrowing retry |
| Web feature | `__tests__/feedback-reactivate.test.tsx` | 404 / 409 / 422 messaging, dialog stays open |
| E2E | `apps/web/e2e/` | the archive → reactivate round trip including door restore and post-refresh state |

### The two tests that would catch the subtle bugs

- **The double-cycle test** (SC-012): archive W → reactivate W → archive one door on its own →
  archive W → reactivate W. The independently archived door must still be archived at the end. This
  is the only test that catches a missing `archived_with_warehouse = false` write (research **D2**),
  and every simpler test passes without it.
- **The concurrent archive/reactivate test**: overlapping submissions on the same warehouse must
  queue and leave a consistent pair, never a warehouse available under archived doors. This is what
  the fixed lock order buys (research **D3**).

## Verification before the PR is ready

Constitution VII: `pnpm check`, `pnpm typecheck`, `pnpm test`, the browser flow above, and a fresh
read-only Codex review with every confirmed finding resolved.

**One documentation task is part of this delivery, not a follow-up**: extend the `Warehouse` entry in
`CONTEXT.md` (line 152) to state that reactivating a warehouse restores exactly the doors archived
with it and clears that record (research **D12**). The entry currently documents the forward
direction only; shipping the reverse without it leaves the canonical vocabulary describing half a
lifecycle.
