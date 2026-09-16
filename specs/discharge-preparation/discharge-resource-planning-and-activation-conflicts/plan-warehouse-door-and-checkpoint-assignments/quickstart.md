# Quickstart: Plan Warehouse Door and Checkpoint Assignments

This guide explains how to run and validate the slice. The implementation itself belongs in
`tasks.md`. Field names come from
[`contracts/discharge-resource-planning.openapi.yaml`](./contracts/discharge-resource-planning.openapi.yaml),
screen behavior from [`contracts/ui-state.md`](./contracts/ui-state.md), and rules from
[`data-model.md`](./data-model.md).

## Prerequisites

- The PNPM workspace is installed at the repository root: `pnpm install`
- PostgreSQL is reachable, and `apps/api/.env` is configured
- The database is migrated and seeded. This also proves the new partial unique indexes accept the
  seed (research.md Decision 7):

```bash
pnpm --filter @portflow/api db:fresh
```

The seeded accounts are GH-53's: `sophie.dubois@portflow.ai` (operations lead),
`thomas.bernard@portflow.ai` (operations admin), `claire.martin@portflow.ai` (organization admin),
and `lucas.moreau@portflow.ai` (observer). Each signs in with `USER_FACTORY_PASSWORD` from
`apps/api/database/factories/user_factory.ts`.

The seed also provides:
- `MV Atlantic Dawn`, a planned discharge whose lot already has a door and whose planned shift
  already has that door and a weighing area;
- `MV Ocean Cedar`, an active discharge whose door assignment is current.

## Run

```bash
pnpm dev                    # turbo runs apps/api and apps/web together
```

The API regenerates the Tuyau registry when it boots. That is what makes
`tuyauQuery.discharges.planningOptions`, `discharges.productLots.warehouseDoors`, and
`discharges.shifts.checkpoints` exist for the web. Commit the regenerated files under
`apps/api/.adonisjs/`.

## Validate the API contract

Sign in as the operations lead and keep the cookie in `lead.txt`, and as the observer in
`observer.txt`. The scenario starts from a fresh planned discharge with two lots and one shift,
created as in GH-53's quickstart, whose id is `$ID`.

```bash
API=http://localhost:3333/api/v1
DETAIL() { curl -s -b lead.txt $API/discharges/$ID; }
LOT_A=$(DETAIL | jq -r '.data.productLots[0].id')
LOT_B=$(DETAIL | jq -r '.data.productLots[1].id')
SHIFT=$(DETAIL | jq -r '.data.shifts[0].id')
OPTIONS=$(curl -s -b lead.txt $API/discharges/$ID/planning-options)
CEDAR=$(curl -s -b lead.txt $API/discharges | jq -r '.data[] | select(.vesselName=="MV Ocean Cedar") | .id')
CEDAR_DOOR=$(curl -s -b lead.txt $API/discharges/$CEDAR | jq -r '[.data.productLots[].doorAssignments[] | select(.effectiveTo==null)][0].warehouseDoor.id')
# Two doors no other discharge uses, so the scenario never depends on seed order
FREE_DOORS=$(echo "$OPTIONS" | jq -r '[.data.warehouseDoors[] | select(.otherDischargeAssignments==[]) | .id]')
DOOR_1=$(echo "$FREE_DOORS" | jq -r '.[0]')
DOOR_2=$(echo "$FREE_DOORS" | jq -r '.[1]')
AREA=$(echo "$OPTIONS" | jq -r '.data.weighingAreas[0].id')
PATCH() { curl -s -X PATCH -b lead.txt -H 'content-type: application/json' -d "$2" "$API/discharges/$ID/$1"; }
```

Expected outcomes:

```bash
# Options: a door in use by MV Ocean Cedar names it
echo "$OPTIONS" | jq -c --arg d "$CEDAR_DOOR" '.data.warehouseDoors[] | select(.id==$d) | .otherDischargeAssignments[].discharge | {vesselName, status}'
# {"vesselName":"MV Ocean Cedar","status":"ACTIVE"}

# Assign two doors to lot A, including the door Cedar uses: 200, Cedar unchanged
PATCH product-lots/$LOT_A/warehouse-doors "{\"assign\":[\"$DOOR_1\",\"$CEDAR_DOOR\"],\"withdraw\":[]}" \
  | jq -c --arg l "$LOT_A" '[.data.productLots[] | select(.id==$l) | .doorAssignments[] | select(.effectiveTo==null) | .warehouseDoor.name] | length'   # 2

# Same body again: nothing started twice
PATCH product-lots/$LOT_A/warehouse-doors "{\"assign\":[\"$DOOR_1\",\"$CEDAR_DOOR\"],\"withdraw\":[]}" \
  | jq --arg l "$LOT_A" '[.data.productLots[] | select(.id==$l) | .doorAssignments[]] | length'                    # 2

# Move DOOR_1 to lot B: A's row ends at the instant B's starts
PATCH product-lots/$LOT_B/warehouse-doors "{\"assign\":[\"$DOOR_1\"],\"withdraw\":[]}" \
  | jq -c --arg d "$DOOR_1" '[.data.productLots[].doorAssignments[] | select(.warehouseDoor.id==$d) | [.effectiveFrom, .effectiveTo]]'
# [["t0","t1"],["t1",null]]

# Shift: add DOOR_1 (assigned to lot B) and a weighing area
PATCH shifts/$SHIFT/checkpoints "{\"warehouseDoors\":{\"add\":[\"$DOOR_1\"],\"remove\":[]},\"weighingAreas\":{\"add\":[\"$AREA\"],\"remove\":[]}}" \
  | jq -c '.data.shifts[0] | {doors: [.warehouseDoors[] | select(.effectiveTo==null)] | length, areas: [.weighingAreas[] | select(.effectiveTo==null)] | length}'
# {"doors":1,"areas":1}

# Shift: a door not assigned in this discharge is refused on its field
PATCH shifts/$SHIFT/checkpoints "{\"warehouseDoors\":{\"add\":[\"$DOOR_2\"],\"remove\":[]},\"weighingAreas\":{\"add\":[],\"remove\":[]}}" \
  | jq -c '.error | {code, issues: [.details[] | [.field, .rule]]}'
# {"code":"E_VALIDATION_ERROR","issues":[["warehouseDoors.add.0","assignedWarehouseDoor"]]}

# Lot B: withdrawing DOOR_1 while the planned shift selects it is refused
PATCH product-lots/$LOT_B/warehouse-doors "{\"assign\":[],\"withdraw\":[\"$DOOR_1\"]}" \
  | jq -c '[.error.details[] | [.field, .rule]]'                                                                   # [["withdraw.0","selectedByPlannedShift"]]

# Remove it from the shift, then withdraw: the ended rows stay readable
PATCH shifts/$SHIFT/checkpoints "{\"warehouseDoors\":{\"add\":[],\"remove\":[\"$DOOR_1\"]},\"weighingAreas\":{\"add\":[],\"remove\":[]}}" > /dev/null
PATCH product-lots/$LOT_B/warehouse-doors "{\"assign\":[],\"withdraw\":[\"$DOOR_1\"]}" \
  | jq -c --arg l "$LOT_B" '[.data.productLots[] | select(.id==$l) | .doorAssignments[] | .effectiveTo != null]'  # [true]

# Shape refusals: repeated identity, identity in both lists
PATCH product-lots/$LOT_A/warehouse-doors "{\"assign\":[\"$DOOR_2\",\"$DOOR_2\"],\"withdraw\":[\"$DOOR_2\"]}" | jq -r .error.code   # E_VALIDATION_ERROR

# State refusals
curl -s -X PATCH -b lead.txt -H 'content-type: application/json' -d '{"assign":[],"withdraw":[]}' \
  "$API/discharges/$CEDAR/product-lots/$(curl -s -b lead.txt $API/discharges/$CEDAR | jq -r '.data.productLots[0].id')/warehouse-doors" | jq -r .error.code   # E_DISCHARGE_NOT_PLANNED
PATCH shifts/00000000-0000-4000-8000-000000000000/checkpoints '{"warehouseDoors":{"add":[],"remove":[]},"weighingAreas":{"add":[],"remove":[]}}' | jq -r .error.code   # E_SHIFT_NOT_FOUND

# Observer: 403 (the two commands answer the same)
curl -s -o /dev/null -w '%{http_code}\n' -b observer.txt $API/discharges/$ID/planning-options                       # 403

# A lot assigned through the API cannot be removed (GH-53 rule, now reachable)
curl -s -X DELETE -b lead.txt $API/discharges/$ID/product-lots/$LOT_B | jq -r .error.code                         # E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS
```

Archive guards: while `$ID` is planned, archiving `$CEDAR_DOOR` (still assigned to lot A), its
warehouse, or `$AREA` (still selected for `$SHIFT`) must be refused with the existing in-use codes, through
both the single and the bulk archive endpoints.

## Validate the screens

Sign in to the web app as the operations lead, and open the planned discharge created above.

1. Each lot's `Warehouse doors` block shows `Edit`. Each shift's `Warehouse doors` and
   `Weighing areas` groups show `Edit`. `Trucks` has none.
2. Open a lot's `Edit`. Doors are grouped by warehouse and can be filtered. The door
   `MV Ocean Cedar` uses reads `Also assigned to MV Ocean Cedar (Active, expected …)`. Check two
   doors and save. The sheet closes, the toast reads `Warehouse doors updated`, and the lot lists
   both doors as current.
3. Open the other lot's `Edit`. A door of the first lot reads `Assigned to {customer} · {product}`.
   Check it and save. The toast adds `Taken from {customer} · {product}`, and the first lot shows
   that door's assignment as ended.
4. Open the shift's `Edit` from `Weighing areas`. The sheet scrolls to weighing areas. The doors
   section lists only doors assigned to the lots, each with its lot. Check one door and one area,
   then save. The shift shows both as current.
5. Reopen the second lot's doors. The door selected for the shift reads `Selected for shift …`.
   Uncheck it and save. The field says to remove the door from the shift first, and no request is
   sent.
6. Remove the area from the shift and save. The group shows the ended selection and
   `None currently selected`.
7. Open `MV Ocean Cedar` (active). No planning action appears.
8. Sign in as the observer. A planned discharge's detail shows no planning action.

To check a stale refusal, keep a lot's `Warehouse doors` sheet open in one browser. In another
session, remove that lot's door from the shift and withdraw it. Save a different change in the
first browser: the save applies only that change, and the detail shows both users' results. No
slice can start a discharge yet, so the refusal on a discharge started meanwhile is covered by the
`planning/stale-state` feature tests.

## Test suites

```bash
# API: unit and integration, including the planning, options, remove-lot, and weighing area archive suites
pnpm --filter @portflow/api test

# Web: the discharges feature (detail regressions included) and the forms library
pnpm --dir apps/web exec vitest run src/features/discharges src/libraries/forms
```

For each of the three routes, the API integration suites cover the cases `apps/api/AGENTS.md`
requires of a protected endpoint:
- unauthenticated or non-active: 401;
- observer: 403;
- each preparing role succeeds;
- the endpoint's own failures: 404, 409, and every 422 rule of `data-model.md`, each asserting that
  no assignment or selection row was started or ended.

Row locks are not exercised, because the test database is SQLite, where Knex ignores them
(research.md Decision 5). The partial unique indexes are exercised there: a test inserts a second
current row directly and asserts the database refuses it.

The factories build what the seed lacks: an archived door, a door under an archived warehouse, an
archived weighing area, a closed discharge, and a shift in the `ACTIVE` status inside a planned
discharge, for `E_SHIFT_NOT_PLANNED`.

## Repository gates before the PR is ready

```bash
pnpm check          # biome format + lint
pnpm typecheck
pnpm test           # full fast suite, both apps
```

Then run the screen validation above in a browser, and obtain the fresh read-only review the
constitution requires.
