# Quickstart: Archive a Warehouse

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/](./contracts/)

How to run and validate this feature end to end. Implementation details belong in `tasks.md`.

## Prerequisites

```bash
pnpm install
docker compose -f docker/docker-compose.yml up -d     # PostgreSQL 17
pnpm --filter @portflow/api db:fresh                  # migrate + seed (dev/test fixtures)
```

`db:fresh` is required at least once after each migration of this slice, so
`apps/api/database/schema.ts` regenerates. (#216 later drops `archived_with_warehouse` again; on a
current checkout the column is simply absent.)

```bash
pnpm dev            # api on :3333, web on :3000
```

Sign in as an administrator: the seeded `operationsAdmin` or `organizationAdmin` from
`apps/api/database/fixtures/users.ts`. Any non-administrator active user is the negative case.

## The seeded warehouses are the acceptance matrix

`apps/api/database/fixtures/warehouses.ts` and `warehouse_doors.ts` already contain every case this
feature must handle. No new fixtures are needed to exercise the happy paths:

| Warehouse | Doors | Exercises |
|---|---|---|
| `socomac` | `Porte Quai` (available) | the plain cascade: one door archived with the warehouse |
| `sica` | `Porte Nord` (available), `Porte Historique` (archived) | mixed cascade — FR-011 on one door, FR-012 on the other |
| `froid` | `Porte Réfrigérée Est` (available), `…Ouest` (archived) | second mixed case, for the bulk matrix |
| `hangar7` | `Porte Principale` (available), `Porte de Service` (reactivated) | prior reactivation context must survive (FR-017) |
| `ancien` | `Porte Ancienne` (archived) | already-archived warehouse → `ALREADY_ARCHIVED` (FR-004) |
| `ancienHangar` | `Porte condamnée` (archived) | all-doors-archived warehouse is archivable (FR-009) |

The `IN_USE` case comes from `09_discharge_preparation_seeder.ts`, which creates
`warehouse_door_product_lot_assignments` against Planned/Active discharges. Identify the warehouse
owning an assignment with `effective_to IS NULL` — archiving it must be refused (FR-005), and closing
that discharge must make the same call succeed (US3 scenario 1).

A warehouse **with no doors at all** is the one case the fixtures do not cover; create one in the
test setup to prove FR-009's vacuous pass.

## Validate the API directly

```bash
# eligible → 200, warehouse ARCHIVED, its doors ARCHIVED with the same context
curl -sX POST localhost:3333/api/v1/warehouses/$SOCOMAC_ID/archive \
  -b cookies.txt -H 'content-type: application/json' \
  -d '{"comment":"Repurposed"}' | jq '{status:.data.status, doors:[.data.doors[]|{name,status,archivedAt}], archivedDoorCount}'

# already archived → 409 E_WAREHOUSE_ALREADY_ARCHIVED, nothing changed
curl -sX POST localhost:3333/api/v1/warehouses/$SOCOMAC_ID/archive -b cookies.txt -d '{}'

# a door in use → 409 E_WAREHOUSE_IN_USE, warehouse and every door untouched
curl -sX POST localhost:3333/api/v1/warehouses/$IN_USE_ID/archive -b cookies.txt -d '{}'

# bulk, mixed → 200 with partial success
curl -sX POST localhost:3333/api/v1/warehouses/archive \
  -b cookies.txt -H 'content-type: application/json' \
  -d "{\"ids\":[\"$SICA_ID\",\"$IN_USE_ID\",\"$ANCIEN_ID\",\"00000000-0000-4000-8000-000000000000\"]}" \
  | jq '{archived:[.updatedWarehouses[].name], blocked:.blockedWarehouses}'
```

The last call is the FR-035/FR-036 proof: exactly one archived, and three blocked with `IN_USE`,
`ALREADY_ARCHIVED`, and `NOT_FOUND` respectively.

See [contracts/warehouse-archive-api.md](./contracts/warehouse-archive-api.md) for the full
request/response shapes and the complete failure table.

## Validate in the browser

1. Open `http://localhost:3000/warehouses` as an administrator. The available view is selected.
2. **Single**: click a warehouse polygon → the details sheet opens → *Archive warehouse*. The
   confirmation names the warehouse and **how many of its available doors** will be archived with it.
   Confirm. The warehouse leaves the available view; switch to Archived and confirm its doors are
   archived under it with the same time, actor, and comment, and that a previously archived door kept
   its own.
3. **Abandon**: reopen the dialog on another warehouse and cancel — nothing changes (FR-024).
4. **Bulk**: press the *Select warehouses* map control (or shift-click a polygon). Check several,
   including one whose door is in use. *Archive selected* → the toast reports how many were archived
   and names each unchanged one with its reason. The selection narrows to the blocked ones so a retry
   needs no reselection (FR-042).
5. **Shortcuts**: Ctrl/Cmd+A checks every visible available warehouse; Escape clears without leaving
   select mode. Both must behave exactly as on `/checkpoints` (FR-045).
6. **Search does not prune**: with warehouses checked, type a search term that hides some. The
   selection count must not drop (FR-043).
7. **Non-administrator**: sign in as an active non-administrator. No select control, no archive
   button, and `/warehouses?selecting=warehouses` has no effect (FR-030, FR-044).

## Test commands

```bash
pnpm --filter @portflow/api test        # Japa: unit + integration
pnpm --filter @portflow/web test        # Vitest + Testing Library + MSW
pnpm test                               # both, via turbo
pnpm check && pnpm typecheck            # Biome + tsc
```

Follow RED → GREEN → REFACTOR (Constitution IV): write the failing observable test first.

### The regression net that matters most

The `#200`/`#205` suites are what prove the **D5** and **D7** extractions were behavior-preserving.
They must pass **unchanged** — if they need edits, the extraction changed delivered behavior:

```bash
pnpm --filter @portflow/web test -- checkpoints/__tests__/bulk-archive
pnpm --filter @portflow/web test -- checkpoints/__tests__/bulk-reactivate
pnpm --filter @portflow/web test -- checkpoints/__tests__/bulk-reactivate-weighing-areas
```

### New coverage this feature owns

| Level | Location | Proves |
|---|---|---|
| API unit | `tests/unit/warehouses/lifecycle/archive.spec.ts` | eligibility rules, exception mapping, comment trimming |
| API unit | `tests/unit/warehouses/lifecycle/door_cascade.spec.ts` | FR-011/FR-012/FR-013 — shared context, untouched archived doors, the provenance flag |
| API unit | `tests/unit/warehouses/lifecycle/bulk_archive.spec.ts` | partial success, per-warehouse reasons, shared context, all-or-nothing |
| API unit | `tests/unit/warehouses/warehouse_policy.spec.ts` | `archive` allows both admin roles only |
| API integration | `tests/integration/warehouses/lifecycle/archive.spec.ts` | 401/403/404/409/422 wiring, response shape |
| API integration | `tests/integration/warehouses/lifecycle/bulk_archive.spec.ts` | route order (`/archive` before `/:id/archive`), invalid selections rejected pre-change |
| Web unit | `features/warehouses/__tests__/` | the bulk-outcome adapter, selection scoping rules |
| Web feature | `features/warehouses/__tests__/` | select mode, checkable polygons, both dialogs, door count, outcome toasts, retry |
| E2E | `apps/web/e2e/` | the full journey including the cascade and its post-refresh state |

## Verification before the PR is ready

Constitution VII: `pnpm check`, `pnpm typecheck`, `pnpm test`, the browser flow above, and a fresh
read-only Codex review with every confirmed finding resolved.

**One documentation task is part of this delivery, not a follow-up**: amend the `Warehouse` entry in
`CONTEXT.md` (line 152), which still says a warehouse "cannot be archived while it still has
available warehouse doors" — the rule this feature replaces (research **D10**). Shipping without it
leaves the canonical domain vocabulary contradicting the delivered behavior.
