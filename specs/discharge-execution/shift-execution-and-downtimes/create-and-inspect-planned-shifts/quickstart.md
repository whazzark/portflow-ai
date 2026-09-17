# Quickstart: Create and Inspect Planned Shifts

This guide explains how to run and validate the slice. The implementation itself belongs in
`tasks.md`. Field names come from
[`contracts/planned-shifts.openapi.yaml`](./contracts/planned-shifts.openapi.yaml), screen behavior
from [`contracts/ui-state.md`](./contracts/ui-state.md), and rules and refusal codes from
[`data-model.md`](./data-model.md).

## Prerequisites

- The PNPM workspace is installed at the repository root: `pnpm install`.
- PostgreSQL is reachable, and `apps/api/.env` exists. A fresh worktree has none: copy
  `.env.example` and generate `APP_KEY`.
- The database is migrated and seeded. This slice adds no migration and changes no seed:

```bash
pnpm --filter @portflow/api db:fresh
```

The seeded accounts are GH-53's: `sophie.dubois@portflow.ai` (operations lead) and
`lucas.moreau@portflow.ai` (observer). Each signs in with `USER_FACTORY_PASSWORD` from
`apps/api/database/factories/user_factory.ts`.

The seeded discharges used below are:
- `MV Atlantic Dawn`, planned, with held trucks, lots holding doors, and weighing areas;
- `MV Ocean Cedar`, active, with completed, active, and planned shifts over days −1 to 3;
- `MV Loire Star`, closed.

## Run

```bash
pnpm dev   # turbo runs apps/api and apps/web together
```

The API regenerates the Tuyau registry when it boots, which is what makes
`discharges.shifts.store` exist for the web. Commit the regenerated files under
`apps/api/.adonisjs/`. A test run alone regenerates only the controllers file.

## Validate the API contract

Sign in as the lead into `lead.txt` and as the observer into `observer.txt`, as in GH-53's quickstart.

```bash
API=http://localhost:3333/api/v1
id_of() { curl -s -b lead.txt $API/discharges | jq -r --arg v "$1" '.data[] | select(.vesselName==$v) | .id'; }
DAWN=$(id_of 'MV Atlantic Dawn'); CEDAR=$(id_of 'MV Ocean Cedar'); LOIRE=$(id_of 'MV Loire Star')
DETAIL() { curl -s -b lead.txt $API/discharges/$1; }
LEAD=$(DETAIL $DAWN | jq -r '.data.shifts[0].responsible.id')
TRUCK=$(DETAIL $DAWN | jq -r '[.data.truckPool[] | select(.releasedAt==null and .truckStatus=="AVAILABLE")][0].truckId')
DOOR=$(DETAIL $DAWN | jq -r '[.data.productLots[].doorAssignments[] | select(.effectiveTo==null)][0].warehouseDoor.id')
AREA=$(curl -s -b lead.txt $API/discharges/$DAWN/planning-options | jq -r '.data.weighingAreas[0].id')
LAST_END=$(DETAIL $DAWN | jq -r '.data.shifts[-1].plannedEndAt')
ADD() { curl -s -o /dev/stderr -w '%{http_code}\n' -X POST -b "${3:-lead.txt}" -H 'content-type: application/json' -d "$2" "$API/discharges/$1/shifts"; }
NEW=$(uuidgen | tr 'A-Z' 'a-z')
START=$(date -u -j -v+1d -f '%Y-%m-%dT%H:%M:%S' "${LAST_END%%.*}" '+%Y-%m-%dT%H:%M:%S.000Z')
END=$(date -u -j -v+1d -v+8H -f '%Y-%m-%dT%H:%M:%S' "${LAST_END%%.*}" '+%Y-%m-%dT%H:%M:%S.000Z')
BODY=$(jq -nc --arg id "$NEW" --arg s "$START" --arg e "$END" --arg r "$LEAD" --arg t "$TRUCK" --arg d "$DOOR" --arg a "$AREA" \
  '{id:$id, plannedStartAt:$s, plannedEndAt:$e, responsibleUserId:$r, truckIds:[$t], warehouseDoorIds:[$d], weighingAreaIds:[$a]}')
```

Expected outcomes:

```bash
# 1. Add to a planned discharge with resources: 201, the shift is last, planned, with no gap
ADD $DAWN "$BODY" 2>/dev/null                                   # 201
DETAIL $DAWN | jq -c --arg id "$NEW" '.data.shifts[] | select(.id==$id) | {status, readinessGaps, trucks: (.trucks|length), doors: (.warehouseDoors|length), areas: (.weighingAreas|length)}'
# {"status":"PLANNED","readinessGaps":[],"trucks":1,"doors":1,"areas":1}

# 2. Replay: 200, still one shift with that id
ADD $DAWN "$BODY" 2>/dev/null                                   # 200
DETAIL $DAWN | jq --arg id "$NEW" '[.data.shifts[] | select(.id==$id)] | length'   # 1

# 3. Overlap: 422 on plannedStartAt · shiftOverlap, nothing added
ADD $DAWN "$(echo "$BODY" | jq -c --arg id "$(uuidgen)" '.id=($id|ascii_downcase)')"
# 422 {"errors":[{"field":"plannedStartAt","rule":"shiftOverlap",...}]}

# 4. Active discharge, no resources, after its last shift: 201, no resources, three resource gaps
C_LAST=$(DETAIL $CEDAR | jq -r '.data.shifts[-1].plannedEndAt')
C_END=$(date -u -j -v+8H -f '%Y-%m-%dT%H:%M:%S' "${C_LAST%%.*}" '+%Y-%m-%dT%H:%M:%S.000Z')
C_BODY=$(jq -nc --arg id "$(uuidgen | tr A-Z a-z)" --arg s "$C_LAST" --arg e "$C_END" --arg r "$LEAD" \
  '{id:$id, plannedStartAt:$s, plannedEndAt:$e, responsibleUserId:$r}')
ADD $CEDAR "$C_BODY" 2>/dev/null                               # 201
DETAIL $CEDAR | jq -c '.data.shifts[-1] | {status, readinessGaps}'
# {"status":"PLANNED","readinessGaps":["NO_USABLE_TRUCK","NO_USABLE_WAREHOUSE_DOOR","NO_USABLE_WEIGHING_AREA"]}

# 5. Active discharge, before its active shift: 422 plannedStartAt · shiftAfterStartedShifts
ACTIVE_START=$(DETAIL $CEDAR | jq -r '[.data.shifts[] | select(.status=="ACTIVE")][0].plannedStartAt')
ADD $CEDAR "$(echo "$C_BODY" | jq -c --arg id "$(uuidgen | tr A-Z a-z)" --arg s "$ACTIVE_START" '.id=$id | .plannedStartAt=$s')"

# 6. Active discharge with resources: 409 E_DISCHARGE_NOT_PLANNED
ADD $CEDAR "$(echo "$C_BODY" | jq -c --arg id "$(uuidgen | tr A-Z a-z)" --arg a "$AREA" '.id=$id | .weighingAreaIds=[$a]')"

# 7. Closed discharge: 409 E_DISCHARGE_CLOSED
ADD $LOIRE "$(echo "$C_BODY" | jq -c --arg id "$(uuidgen | tr A-Z a-z)" '.id=$id')"

# 8. Observer: 403, nothing added
ADD $DAWN "$(echo "$BODY" | jq -c --arg id "$(uuidgen | tr A-Z a-z)" '.id=$id')" observer.txt

# 9. Started shifts carry no gaps
DETAIL $CEDAR | jq -c '[.data.shifts[] | select(.status!="PLANNED") | .readinessGaps] | unique'   # [null]
```

## Validate the workbench

Open `http://localhost:3000`, then run each check below.

1. **As the lead, on `MV Atlantic Dawn` › Shifts:**
   - `Add shift` is in the section header.
   - Add a shift between two existing ones, with a responsible and one of each resource.
   - The sheet closes, the new shift's panel opens, the calendar shows it in order, and the Shifts
     count grows by one.
2. **In the add sheet:**
   - An overlapping period shows the overlap error on Planned start, and every value stays in place.
   - An end before the start shows the error on Planned end.
3. **Readiness on `MV Atlantic Dawn`:**
   - Open the planned shift with no warehouse door (Thu 1 Oct, 06:00). Its Readiness block lists "No usable warehouse door"
     and offers `Edit`.
   - The same shift's calendar block shows the warning icon.
   - A shift with every resource shows "Nothing missing…".
4. **As the lead, on `MV Ocean Cedar` › Shifts:**
   - `Add shift` opens a form with no resource fields.
   - Adding after the last shift shows the three resource gaps with no `Edit` link.
   - A period before the active shift is refused inline.
5. **On `MV Loire Star`:** no `Add shift` action is shown.
6. **As the observer:** no `Add shift` action anywhere. Readiness blocks and calendar markers are the
   same as the lead sees, without `Edit` or `Go to truck pool`.
7. **Stale state, with two windows open as the lead on one planned discharge:**
   - In window A, open `Add shift` and select a weighing area.
   - In window B, add a shift overlapping A's intended period. Saving in A then refuses the overlap.
   - Seed or script a start in window B (GH-65 is not delivered), then save in A. Expected toast:
     "This discharge has started". The resource fields vanish, and the period and responsible stay.

## Automated checks

```bash
# API (avoid a busy 3333; --files matches trailing path segments)
cd apps/api
PORT=3399 node --import tsx ace.js test --files="shifts/*"
PORT=3399 node --import tsx ace.js test --files="consultation/*"
PORT=3399 node --import tsx ace.js test

# Web
pnpm --filter @portflow/web test -- src/features/discharges

# Workspace gates (constitution VII)
pnpm lint && pnpm typecheck && pnpm test
```
