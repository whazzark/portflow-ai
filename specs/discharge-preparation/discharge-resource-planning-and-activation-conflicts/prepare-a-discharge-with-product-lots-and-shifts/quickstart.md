# Quickstart: Prepare a Planned Discharge With Its Product Lots and Shifts

This guide explains how to run and validate the slice. The implementation itself belongs in
`tasks.md`. Field names come from
[`contracts/discharge-preparation.openapi.yaml`](./contracts/discharge-preparation.openapi.yaml),
screen behavior from [`contracts/ui-state.md`](./contracts/ui-state.md), and rules from
[`data-model.md`](./data-model.md).

## Prerequisites

- The PNPM workspace is installed at the repository root: `pnpm install`
- PostgreSQL is reachable, and `apps/api/.env` is configured
- The database is seeded:

```bash
pnpm --filter @portflow/api db:fresh
```

The seed provides one active user per role. The rows used below are:

| Account | Role | May prepare |
|---|---|---|
| `sophie.dubois@portflow.ai` | Operations lead | yes |
| `thomas.bernard@portflow.ai` | Operations admin | yes |
| `claire.martin@portflow.ai` | Organization admin | yes |
| `lucas.moreau@portflow.ai` | Observer | no |

Every seeded account signs in with `USER_FACTORY_PASSWORD` from `apps/api/database/factories/user_factory.ts`.

The seed also provides the planned discharge `MV Atlantic Dawn`, whose single lot has a door
assignment, and the active discharge `MV Ocean Cedar`. They exercise the removal refusal and the
not-planned refusal.

## Run

```bash
pnpm dev                    # turbo runs apps/api and apps/web together
```

The API regenerates the Tuyau registry and `#generated/controllers` when it boots. That is what
makes `tuyauQuery.discharges.store`, `discharges.productLots.*`, and
`users.eligibleShiftResponsibles` exist for the web. Commit the regenerated files under
`apps/api/.adonisjs/`.

## Validate the API contract

Sign in as the operations lead and keep the cookie in `lead.txt`, and as the observer in
`observer.txt`. The ids below come from the available collections.

```bash
API=http://localhost:3333/api/v1
DOCK=$(curl -s -b lead.txt $API/docks/available | jq -r '.data[0].id')
CUSTOMER_A=$(curl -s -b lead.txt $API/customers/available | jq -r '.data[0].id')
CUSTOMER_B=$(curl -s -b lead.txt $API/customers/available | jq -r '.data[1].id')
RESPONSIBLE=$(curl -s -b lead.txt $API/users/eligible-shift-responsibles | jq -r '.data[0].id')
ID=$(uuidgen | tr 'A-Z' 'a-z')

cat > body.json <<JSON
{
  "id": "$ID",
  "vesselName": "MV Quickstart",
  "vesselImo": "9321483",
  "vesselComment": null,
  "dockId": "$DOCK",
  "expectedStartAt": "2026-10-01T06:00:00.000+02:00",
  "productLots": [
    { "customerId": "$CUSTOMER_A", "productName": "Wheat", "expectedQuantityTonnes": "1200.5", "description": null },
    { "customerId": "$CUSTOMER_B", "productName": "Wheat", "expectedQuantityTonnes": "800", "description": "Second hold" }
  ],
  "shifts": [
    { "plannedStartAt": "2026-10-01T14:00:00.000+02:00", "plannedEndAt": "2026-10-01T22:00:00.000+02:00", "responsibleUserId": "$RESPONSIBLE" },
    { "plannedStartAt": "2026-10-01T06:00:00.000+02:00", "plannedEndAt": "2026-10-01T14:00:00.000+02:00", "responsibleUserId": "$RESPONSIBLE" }
  ]
}
JSON
```

Expected outcomes:

```bash
# Create: 201, planned, tonnage summed, shifts ordered by start (contiguous shifts accepted)
curl -s -w '\n%{http_code}\n' -b lead.txt -H 'content-type: application/json' -d @body.json $API/discharges \
  | jq -c '.data? | {status, expectedTonnage, lots: (.productLots|length), starts: [.shifts[].plannedStartAt]}'
# {"status":"PLANNED","expectedTonnage":"2000.500","lots":2,"starts":["…06:00…","…14:00…"]}   201

# Same body again: 200, same id, still exactly one discharge named MV Quickstart
curl -s -o /dev/null -w '%{http_code}\n' -b lead.txt -H 'content-type: application/json' -d @body.json $API/discharges   # 200
curl -s -b lead.txt $API/discharges | jq '[.data[] | select(.vesselName=="MV Quickstart")] | length'                    # 1

# Observer: 403, nothing created
jq ".id = \"$(uuidgen | tr 'A-Z' 'a-z')\"" body.json \
  | curl -s -b observer.txt -H 'content-type: application/json' -d @- $API/discharges | jq -r .error.code             # E_AUTHORIZATION_FAILURE

# Cross-item rules: duplicate lot (case and spaces ignored), overlapping shifts
jq ".id = \"$(uuidgen | tr 'A-Z' 'a-z')\" | .productLots[1].customerId = \"$CUSTOMER_A\" | .productLots[1].productName = \" wheat \" | .shifts[0].plannedStartAt = \"2026-10-01T13:00:00.000+02:00\"" body.json \
  | curl -s -b lead.txt -H 'content-type: application/json' -d @- $API/discharges | jq -c '.error | {code, issues: [.details[] | [.field, .rule]]}'
# {"code":"E_VALIDATION_ERROR","issues":[["productLots.0.productName","productLotIdentityUnique"],["productLots.1.productName","productLotIdentityUnique"],["shifts.0.plannedStartAt","shiftOverlap"],["shifts.1.plannedStartAt","shiftOverlap"]]}

# Observer may not list responsibles
curl -s -o /dev/null -w '%{http_code}\n' -b observer.txt $API/users/eligible-shift-responsibles                        # 403
```

Corrections, run on the discharge just created:

```bash
LOT=$(curl -s -b lead.txt $API/discharges/$ID | jq -r --arg c "$CUSTOMER_A" '.data.productLots[] | select(.customer.id == $c) | .id')

# Correct identity (all fields sent): 200, lots and shifts unchanged
curl -s -X PATCH -b lead.txt -H 'content-type: application/json' \
  -d "{\"vesselName\":\"MV Quickstart II\",\"vesselImo\":null,\"vesselComment\":\"Delayed\",\"dockId\":\"$DOCK\",\"expectedStartAt\":\"2026-10-02T06:00:00.000+02:00\"}" \
  $API/discharges/$ID | jq -c '.data | {vesselName, vesselImo, lots: (.productLots|length), shifts: (.shifts|length)}'

# Correct a lot's quantity: tonnage follows
curl -s -X PATCH -b lead.txt -H 'content-type: application/json' \
  -d "{\"customerId\":\"$CUSTOMER_A\",\"productName\":\"Wheat\",\"expectedQuantityTonnes\":\"1000\",\"description\":null}" \
  $API/discharges/$ID/product-lots/$LOT | jq -r .data.expectedTonnage                                                   # 1800.000

# Remove it, then try to remove the last one
curl -s -X DELETE -b lead.txt $API/discharges/$ID/product-lots/$LOT | jq '.data.productLots | length'                  # 1
LAST=$(curl -s -b lead.txt $API/discharges/$ID | jq -r '.data.productLots[0].id')
curl -s -X DELETE -b lead.txt $API/discharges/$ID/product-lots/$LAST | jq -r .error.code                              # E_DISCHARGE_LAST_PRODUCT_LOT

# Seeded refusals
DAWN=$(curl -s -b lead.txt $API/discharges | jq -r '.data[] | select(.vesselName=="MV Atlantic Dawn") | .id')
CEDAR=$(curl -s -b lead.txt $API/discharges | jq -r '.data[] | select(.vesselName=="MV Ocean Cedar") | .id')
DAWN_LOT=$(curl -s -b lead.txt $API/discharges/$DAWN | jq -r '.data.productLots[0].id')
curl -s -X POST -b lead.txt -H 'content-type: application/json' \
  -d "{\"customerId\":\"$CUSTOMER_B\",\"productName\":\"Barley\",\"expectedQuantityTonnes\":\"10\",\"description\":null}" \
  $API/discharges/$CEDAR/product-lots | jq -r .error.code                                                               # E_DISCHARGE_NOT_PLANNED
curl -s -X POST -b lead.txt -H 'content-type: application/json' \
  -d "{\"customerId\":\"$CUSTOMER_B\",\"productName\":\"Barley\",\"expectedQuantityTonnes\":\"10\",\"description\":null}" \
  $API/discharges/$DAWN/product-lots > /dev/null                                                                        # gives Dawn a second lot
curl -s -X DELETE -b lead.txt $API/discharges/$DAWN/product-lots/$DAWN_LOT | jq -r .error.code                        # E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS
```

Archive hardening: while `MV Quickstart II` is planned, archiving its dock or its remaining lot's
customer must be refused with `E_DOCK_IN_USE` or `E_CUSTOMER_IN_USE`, through both the single and
the bulk archive endpoints.

## Validate the screens

Sign in to the web app as the operations lead:

1. Open **Operations → Discharges**. `Create discharge` appears beside the search. Select a tab and
   type a search, then open it.
2. On `/discharges/new`, the page opens with one lot group and one shift group.
3. Submit the empty form. Every required field shows an error, and nothing is sent.
4. Enter a vessel, a dock, and an expected start. Add a second lot with the same customer and
   ` WHEAT ` against `Wheat`, and two shifts where the second overlaps the first. Submit. Both lots
   and both shifts are flagged, and every value is kept.
5. Fix the values and make the shifts contiguous. `Expected tonnage` updates as quantities are
   typed. Submit. The button reads `Creating…`, then the detail of the new planned discharge opens,
   showing the entered lots, the shifts in chronological order, and the success toast.
6. Go back. The list shows the **Planned** tab with the search you had, and the new discharge is
   in it.
7. On the new discharge's detail:
   - `Edit` on the Overview: change the dock and clear the IMO, then save. The card shows
     `Not specified` for the IMO.
   - `Add product lot`, then `Edit` a lot's quantity. `Expected tonnage` follows each change.
   - `Remove` a lot and confirm. With one lot left, `Remove` is disabled, with its tooltip.
8. Open `MV Ocean Cedar` (active). It shows no `Edit`, `Add product lot`, or `Remove`.
9. Sign in as the observer. The list has no `Create discharge`. Typing `/discharges/new` lands back
   on the list. A planned discharge's detail shows no action.

To check a refusal caused by stale data, keep a planned discharge's `Edit product lot` sheet open
in one browser. In another session, remove that lot. Save in the first browser: the sheet closes,
the detail refreshes, and the toast says the lot no longer exists.

## Test suites

```bash
# API: unit and integration, including the new creation, correction, lot, responsible, and archive suites
pnpm --filter @portflow/api test

# Web: the discharges feature (list regressions included), the forms library, date helpers
pnpm --dir apps/web exec vitest run src/features/discharges src/libraries/forms src/helpers
```

`pnpm --filter @portflow/web test -- <path>` does not narrow the run. Call vitest directly, as
above.

The API integration suites cover the cases `apps/api/AGENTS.md` requires of a protected endpoint,
for each of the six routes:
- unauthenticated or non-active: 401;
- observer: 403;
- each preparing role succeeds;
- the endpoint's own failures: 404, 409, and every 422 rule of `data-model.md`, each asserting
  that nothing was created or changed.

Row locks are not exercised: the test database is SQLite, where Knex ignores them (research.md
Decision 5).

The factories in `apps/api/database/factories/` build what the seed lacks:
- an archived dock and customer;
- a deactivated responsible, and an observer as responsible;
- a closed discharge;
- a lot with only an ended door assignment.

## Repository gates before the PR is ready

```bash
pnpm check          # biome format + lint
pnpm typecheck
pnpm test           # full fast suite, both apps
```

Then run the screen validation above in a browser, and obtain the fresh read-only review the
constitution requires.
