# Quickstart: Correct a Customer's Product Lots at Once

This guide explains how to run and validate the feature. The implementation itself belongs in
`tasks.md`.
- Field names and refusals: [`contracts/customer-product-lots.openapi.yaml`](./contracts/customer-product-lots.openapi.yaml).
- Screen behavior: [`contracts/ui-state.md`](./contracts/ui-state.md).
- Rules: [`data-model.md`](./data-model.md).

## Prerequisites

- The PNPM workspace is installed at the repository root: `pnpm install`
- PostgreSQL is reachable, and `apps/api/.env` is configured
- The database is seeded:

```bash
pnpm --filter @portflow/api db:fresh
```

Seeded accounts (password `USER_FACTORY_PASSWORD`, from `apps/api/database/factories/user_factory.ts`):

| Account | Role | May correct lots |
|---|---|---|
| `sophie.dubois@portflow.ai` | Operations lead | yes |
| `lucas.moreau@portflow.ai` | Observer | no |

Seeded discharges used below:
- `MV Atlantic Dawn` (planned): one lot for the first seeded customer, `Céréales PLANNED`, with a
  warehouse door assignment.
- `MV Ocean Cedar` (active).

## Run

```bash
pnpm dev                    # turbo runs apps/api and apps/web together
```

The API regenerates the Tuyau registry when it boots, which makes
`tuyauQuery.discharges.customerProductLots.update` exist. Commit the regenerated files under
`apps/api/.adonisjs/`.

## Validate the API contract

Sign in as the operations lead, and keep the cookie in `lead.txt`.

```bash
API=http://localhost:3333/api/v1
DAWN=$(curl -s -b lead.txt $API/discharges | jq -r '.data[] | select(.vesselName=="MV Atlantic Dawn") | .id')
C1=$(curl -s -b lead.txt $API/discharges/$DAWN | jq -r '.data.productLots[0].customer.id')
C2=$(curl -s -b lead.txt $API/customers/available | jq -r --arg c "$C1" '[.data[] | select(.id != $c)][0].id')
SEEDED=$(curl -s -b lead.txt $API/discharges/$DAWN | jq -r '.data.productLots[0].id')

# Setup through the existing add route: Blé and Orge for C1
curl -s -b lead.txt -X POST $API/discharges/$DAWN/product-lots -H 'content-type: application/json' \
  -d "{\"productLots\":[{\"customerId\":\"$C1\",\"productName\":\"Blé\",\"expectedQuantityTonnes\":\"100\",\"description\":null},{\"customerId\":\"$C1\",\"productName\":\"Orge\",\"expectedQuantityTonnes\":\"50\",\"description\":null}]}" >/dev/null
lot() { curl -s -b lead.txt $API/discharges/$DAWN | jq -r --arg n "$1" '.data.productLots[] | select(.productName==$n) | .id'; }
BLE=$(lot Blé); ORGE=$(lot Orge)
PATCH_URL=$API/discharges/$DAWN/customers/$C1/product-lots
```

Each step's expected outcome, with the request body:

| # | Request body (to `$PATCH_URL`) | Expected |
|---|---|---|
| 1 | Swap: `{"customerId":"$C1","productLots":[{"id":"$BLE","productName":"Orge",…"100"},{"id":"$ORGE","productName":"Blé",…"50"}],"removedProductLotIds":[]}` | 200; `$BLE` is now `Orge` at 100 t and `$ORGE` is `Blé` at 50 t; the ids are unchanged |
| 2 | Correct, add, and remove: correct `$BLE` to 120 t, add `Colza` 30 t, remove `$ORGE` | 200; C1 has the seeded lot, `Orge` 120 t, and `Colza` 30 t; the expected tonnage reflects them |
| 3 | Remove `$SEEDED` (door assigned) | 422 `removableProductLot` at `removedProductLotIds.0`; nothing changed |
| 4 | Clash: add `orge ` while `$BLE` is named `Orge` | 422 `productLotIdentityUnique` at `productLots.N.productName`; nothing changed |
| 5 | Move: `customerId` = `$C2`, listing every C1 lot | 200; all listed lots under C2; `$SEEDED` keeps its door assignment |
| 6 | Unknown id in `removedProductLotIds` (random uuid) | 404 `E_PRODUCT_LOT_NOT_FOUND` |
| 7 | Same request as step 2, as the observer | 403; nothing changed |
| 8 | Any request on `MV Ocean Cedar` | 409 `E_DISCHARGE_NOT_PLANNED` |

`409 E_DISCHARGE_LAST_PRODUCT_LOT` cannot be reached on the seeded data. Every remaining lot set
includes the door-assigned seeded lot, whose removal is refused first with `422`. The integration
suite covers it on a discharge without door assignments.

## Validate the screens

Sign in as the operations lead, open `MV Atlantic Dawn`, and go to the Product lots tab.
1. **Edit is offered.** The customer's header row shows `Edit`; sign in as the observer to see it
   absent, and open `MV Ocean Cedar` to see it absent there too.
2. **Prefill.** `Edit` opens `Edit product lots` with every lot of that customer, and only those.
3. **Swap.** Swap two product names, save: the toast `Product lots updated` appears, the sheet
   closes, and the rows show the swapped names.
4. **Removal blocks.** The door-assigned row's remove button is disabled; hovering or focusing it
   shows `This product lot has warehouse door assignments`.
5. **Mixed change.** Change a quantity, add a product, remove an undoored row, and save: the subtotal
   and expected total match.
6. **Move.** Choose another customer that already has lots: the description `Joins the N product lots
   of …` shows; a shared name raises the clash message before any request.
7. **Stale lot.** In another session, remove one of the opened lots, then save in the first: the
   toast `This customer's product lots changed` appears, the sheet closes, and the detail shows the
   current lots.

## Test suites

```bash
# API: unit (rules, use case with stubbed repositories) and integration (the new route)
pnpm --filter @portflow/api test

# Web: the discharges feature, including detail regressions
pnpm --dir apps/web exec vitest run src/features/discharges
```

The API integration suite `tests/integration/discharges/preparation/correct_customer_product_lots.spec.ts`
covers:
- 401, 403, and success for each preparing role;
- 404 for both codes, both 409 codes, and every 422 rule, each asserting that no lot changed;
- the swap, the move keeping door assignments, and an unlisted lot left untouched.

It runs on SQLite locally and on PostgreSQL in CI. The swap and the move must pass on both, since
both check the identity index row by row (research.md Decision 5).

## Repository gates before the PR is ready

```bash
pnpm check          # biome format + lint
pnpm typecheck
pnpm test           # full fast suite, both apps
```

Then run the screen validation above in a browser, and obtain the fresh read-only review the
constitution requires.
