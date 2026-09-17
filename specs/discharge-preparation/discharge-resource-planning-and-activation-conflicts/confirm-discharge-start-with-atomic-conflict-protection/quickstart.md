# Quickstart: Confirm Discharge Start With Conflict Protection and Handling

This guide explains how to run and validate the slice. The implementation itself belongs in
`tasks.md`. Field names come from
[`contracts/discharge-start.openapi.yaml`](./contracts/discharge-start.openapi.yaml), screen
behavior from [`contracts/ui-state.md`](./contracts/ui-state.md), and rules from
[`data-model.md`](./data-model.md).

## Prerequisites

- The PNPM workspace is installed at the repository root: `pnpm install`
- PostgreSQL is reachable, and `apps/api/.env` is configured
- The database is migrated and seeded. This also proves the backfill and both partial unique indexes
  accept the seed (research.md Decisions 5 and 6):

```bash
pnpm --filter @portflow/api db:fresh
```

The seeded accounts are GH-53's: `sophie.dubois@portflow.ai` (operations lead),
`claire.martin@portflow.ai` (organization admin), and `lucas.moreau@portflow.ai` (observer). Each
signs in with `USER_FACTORY_PASSWORD` from `apps/api/database/factories/user_factory.ts`.

The seed provides the conflicts this guide uses:
- `MV Atlantic Dawn` (planned) shares the dock `Môle d'Escale Ouest` and the doors `Porte Nord` and
  `Porte Douane` with `MV Ocean Cedar` (active).
- `MV Sirocco` (planned) has an empty pool, lots without doors, and shifts without resources.
- `MV Nordic Breeze` (planned) shares the dock `Anse Saint-Marc 1` with `MV Iroise Trader` (active).

## Run

```bash
pnpm dev                    # turbo runs apps/api and apps/web together
```

The API regenerates the Tuyau registry when it boots, which creates `tuyauQuery.discharges.startCheck`
and `tuyauQuery.discharges.start` for the web. Commit the regenerated files under
`apps/api/.adonisjs/`.

## Validate the API contract

Sign in as the operations lead and keep the cookie in `lead.txt`, and as the observer in
`observer.txt`.

```bash
API=http://localhost:3333/api/v1
id_of() { curl -s -b lead.txt $API/discharges | jq -r --arg v "$1" '.data[] | select(.vesselName==$v) | .id'; }
DAWN=$(id_of 'MV Atlantic Dawn'); SIROCCO=$(id_of 'MV Sirocco'); CEDAR=$(id_of 'MV Ocean Cedar')
CHECK() { curl -s -b lead.txt "$API/discharges/$1/start-check"; }
START() { curl -s -w '\n%{http_code}\n' -X POST -b "${2:-lead.txt}" "$API/discharges/$1/start"; }
```

Expected outcomes:

```bash
# Observer: refused, nothing changes
START $DAWN observer.txt | tail -1                        # 403

# Incomplete preparation, all problems at once
CHECK $SIROCCO | jq -c '[.data.problems[] | .code] | unique'
# ["LOT_WITHOUT_WAREHOUSE_DOOR","SHIFT_WITHOUT_TRUCK","SHIFT_WITHOUT_WAREHOUSE_DOOR","SHIFT_WITHOUT_WEIGHING_AREA"]

# Conflicts with an active discharge name the holder
CHECK $DAWN | jq -c '[.data.problems[] | select(.family=="ACTIVE_DISCHARGE_CONFLICT") | {code, vessel: .holder.vesselName}] | unique'
# includes {"code":"DOCK_HELD","vessel":"MV Ocean Cedar"} and {"code":"WAREHOUSE_DOOR_HELD","vessel":"MV Ocean Cedar"}

# The command refuses with the same list and changes nothing
START $DAWN | head -1 | jq -c '{code: .error.code, n: (.error.meta.problems | length)}'
curl -s -b lead.txt $API/discharges/$DAWN | jq -r '.data.status'   # PLANNED

# Already active
START $CEDAR | tail -1                                     # 409 (E_DISCHARGE_NOT_PLANNED)
```

**Successful start**: `MV Sirocco` has no conflict, only an incomplete preparation, so it is the
quickest to make startable. Every seeded door is already current on an active discharge, and a door
is current on one lot at a time (GH-54), so first create one door per lot as the organization admin
(`POST $API/warehouse-doors`). Assign each lot its own new door (GH-54), and reserve one truck that
`truck-pool/candidates` lists without `ACTIVE` holdings, such as `AA-101-PF` (GH-55). Select that
truck, one of the new doors, and a weighing area for the earliest shift (`PUT …/shifts/:shiftId`).
Validate the screen's step 2 before this, since it needs Sirocco unprepared. Then, with
`ID=$SIROCCO`:

```bash
CHECK $ID | jq -c '.data | {shiftId, problems}'            # problems: []
START $ID | head -1 | jq -c '.data | {status, startedAt, startedBy: .startedBy.lastName, shift: (.shifts | map(select(.status=="ACTIVE")) | .[0] | {actualStartAt, startedBy: .startedBy.lastName})}'
# status ACTIVE, startedAt == shift.actualStartAt, both started by the lead; later shifts stay PLANNED
START $ID | tail -1                                        # 409, replay starts nothing
```

## Validate the race on PostgreSQL

SQLite tests prove the invariant, not the locks (research.md Decision 9). The quickest proof runs the
start suites, including the 20-round race, against an empty scratch PostgreSQL database; the process
environment overrides `.env.test`:

```bash
createdb portflow_race   # or CREATE DATABASE portflow_race
cd apps/api && DB_CONNECTION=postgres DB_DATABASE=portflow_race PORT=3398 node --import tsx ace.js test --files="start/*"
```

To see it by hand on PostgreSQL:
1. Prepare two planned discharges, `$A` and `$B`, that are each startable alone and hold the same
   truck.
2. Fire both starts at once, repeatedly re-preparing them between rounds:

```bash
( START $A lead.txt > a.out & START $B admin.txt > b.out & wait ); tail -1 a.out b.out
```

Expected: exactly one `200`. The other answers `409` with `E_DISCHARGE_START_REFUSED` and a
`TRUCK_HELD` problem naming the winner, never two `200`. Repeat with a shared door and with a shared
dock. For the dock, a second `200` is also impossible at the index level
(`discharges_active_dock_unique`).

## Validate the screen

Open `http://localhost:3000` and sign in.

1. **As the observer**, open `MV Atlantic Dawn`: no `Start` button.
2. **As the operations lead**, open `MV Sirocco` and choose `Start`:
   - The review lists its lots with `No warehouse door` and the earliest shift without resources.
   - The alert counts the problems, `Product lots` lists each lot without a door and `Shifts` the
     earliest shift, and `Start discharge` is disabled. The review is folded under
     `Preparation to start`.
   - Follow the shift's link: the dialog closes on the Shifts section with that shift open.
3. **Open `MV Atlantic Dawn`** and choose `Start`. `Dock` reads `… serves MV Ocean Cedar`, and
   `Product lots` names the doors held by it. The `MV Ocean Cedar` link opens its detail.
4. **Open the startable discharge** from the API scenario in a second tab and choose `Start`, then
   `Start discharge`:
   - A success toast appears, and the header shows `Active` and `Started … by Sophie Dubois`.
   - The shift shows `Active` with its start.
   - No planning action or preparation card remains.
5. **Stale start**: in the first tab, still showing that discharge as planned, choose `Start`, then
   `Start discharge`. The `This discharge has already started` toast appears, the dialog closes, and
   the detail refreshes to `Active`.

## Automated checks

```bash
pnpm --filter @portflow/api test -- --files="start/*"   # unit and integration start suites
pnpm --filter @portflow/web test -- src/features/discharges/__tests__/start src/features/discharges/__tests__/discharge-start-view.test.ts
pnpm check && pnpm typecheck && pnpm test
```

Japa's `--files` matches path segments from the end, and `*` is one segment: pass `start/*`, not a
full path or a partial name. If a suite hangs, look
for a missing import first. Stop any `pnpm dev` server using the API port before running the API
tests.

Finish with a fresh read-only review of the final diff, as the constitution's principle VII
requires.
