# Quickstart: Plan the Discharge Truck Pool and Shift Subsets

This guide explains how to run and validate the slice. The implementation itself belongs in
`tasks.md`.
- Field names: [`contracts/truck-pool.openapi.yaml`](./contracts/truck-pool.openapi.yaml).
- Screen behavior: [`contracts/ui-state.md`](./contracts/ui-state.md).
- Rules: [`data-model.md`](./data-model.md).

## Prerequisites

- The PNPM workspace is installed at the repository root: `pnpm install`
- PostgreSQL is reachable, and `apps/api/.env` is configured
- The database is seeded:

```bash
pnpm --filter @portflow/api db:fresh
```

Seeded accounts, which all sign in with `USER_FACTORY_PASSWORD` from
`apps/api/database/factories/user_factory.ts`:

| Account | Role | May plan trucks |
|---|---|---|
| `sophie.dubois@portflow.ai` | Operations lead | yes |
| `thomas.bernard@portflow.ai` | Operations admin | yes |
| `claire.martin@portflow.ai` | Organization admin | yes |
| `lucas.moreau@portflow.ai` | Observer | no |

Seeded discharges used below. Their shifts are placed around the moment the seed runs, so the
active one always has a shift under way:

| Discharge | Status | Truck pool | Shifts |
|---|---|---|---|
| `MV Atlantic Dawn` | Planned | 9 held trucks, `AA-101-PF` first, one suspended; most also held by other planned discharges | 5 planned; the first selects 7 trucks, `AA-101-PF` included |
| `MV Ocean Cedar` | Active | 9 held trucks, `BB-202-PF` first and held by no other discharge; `CC-303-PF` released | 14, one under way |
| `MV Loire Star` | Closed | 6 released trucks, `AA-101-PF` included | 4 completed |

The seed also holds other planned, active, and closed discharges with larger plans, among them
`MV Timeline Multi-Jours`, whose shifts cross midnight and leave breaks for the shift timeline.

## Run

```bash
pnpm dev                    # turbo runs apps/api and apps/web together
```

The API regenerates the Tuyau registry when it boots. That is what makes
`tuyauQuery.discharges.truckPool.*` and `discharges.shiftTrucks.update` exist for the web. Commit
the regenerated files under `apps/api/.adonisjs/`.

## Validate the API contract

Sign in as the operations lead and keep the cookie in `lead.txt`, and as the observer in
`observer.txt`.

```bash
API=http://localhost:3333/api/v1
DAWN=$(curl -s -b lead.txt $API/discharges | jq -r '.data[] | select(.vesselName=="MV Atlantic Dawn") | .id')
CEDAR=$(curl -s -b lead.txt $API/discharges | jq -r '.data[] | select(.vesselName=="MV Ocean Cedar") | .id')
SHIFT=$(curl -s -b lead.txt $API/discharges/$DAWN | jq -r '.data.shifts[0].id')
DAWN_TRUCK=$(curl -s -b lead.txt $API/discharges/$DAWN | jq -r '.data.truckPool[0].truckId')
CEDAR_TRUCK=$(curl -s -b lead.txt $API/discharges/$CEDAR | jq -r '.data.truckPool[0].truckId')
```

Expected outcomes:

```bash
# Candidates: Cedar's truck is offered to Dawn, with Cedar as an active holding; Dawn's own truck is not offered
curl -s -b lead.txt $API/discharges/$DAWN/truck-pool/candidates \
  | jq -c --arg c "$CEDAR_TRUCK" --arg d "$DAWN_TRUCK" '{cedar: (.data[] | select(.id==$c) | .otherHoldings), dawnOffered: ([.data[] | select(.id==$d)] | length)}'
# {"cedar":[{"dischargeId":"…","vesselName":"MV Ocean Cedar","status":"ACTIVE"}],"dawnOffered":0}

# Reserve Cedar's truck and one free truck for Dawn: 200; both pools now mark the shared truck
FREE=$(curl -s -b lead.txt $API/discharges/$DAWN/truck-pool/candidates | jq -r '[.data[] | select(.otherHoldings==[])][0].id')
curl -s -b lead.txt -H 'content-type: application/json' -d "{\"truckIds\":[\"$CEDAR_TRUCK\",\"$FREE\"]}" \
  $API/discharges/$DAWN/truck-pool | jq -c '[.data.truckPool[] | {registration, held: (.releasedAt==null), also: [.otherHoldings[].vesselName]}]'
curl -s -b lead.txt $API/discharges/$CEDAR | jq -c '.data.truckPool[0].otherHoldings'                       # [{"…","vesselName":"MV Atlantic Dawn","status":"PLANNED"}]

# Same reservation again: 200, pool unchanged (idempotent)
curl -s -b lead.txt -H 'content-type: application/json' -d "{\"truckIds\":[\"$FREE\"]}" \
  $API/discharges/$DAWN/truck-pool | jq '.data.truckPool | length'                                           # 11

# Shift selection: replace with the free truck only; the seeded trucks' selections are removed
curl -s -X PUT -b lead.txt -H 'content-type: application/json' -d "{\"truckIds\":[\"$FREE\"]}" \
  $API/discharges/$DAWN/shifts/$SHIFT/trucks | jq -c '[.data.shifts[0].trucks[] | select(.effectiveTo==null) | .truckId]'

# Selecting a truck Dawn does not hold: 422 heldTruck at truckIds.1
OTHER=$(curl -s -b lead.txt $API/discharges/$DAWN/truck-pool/candidates | jq -r '.data[0].id')
curl -s -X PUT -b lead.txt -H 'content-type: application/json' -d "{\"truckIds\":[\"$FREE\",\"$OTHER\"]}" \
  $API/discharges/$DAWN/shifts/$SHIFT/trucks | jq -c '.error | {code, issues: [.details[] | [.field, .rule]]}'
# {"code":"E_VALIDATION_ERROR","issues":[["truckIds.1","heldTruck"]]}

# Withdraw the free truck: gone from the pool (not released) and from the shift
curl -s -b lead.txt -H 'content-type: application/json' -d "{\"truckIds\":[\"$FREE\"]}" \
  $API/discharges/$DAWN/truck-pool/withdrawals \
  | jq -c --arg f "$FREE" '{inPool: ([.data.truckPool[] | select(.truckId==$f)] | length), inShift: ([.data.shifts[0].trucks[] | select(.truckId==$f)] | length)}'
# {"inPool":0,"inShift":0}

# Withdraw it again: 200, nothing changes
curl -s -o /dev/null -w '%{http_code}\n' -b lead.txt -H 'content-type: application/json' -d "{\"truckIds\":[\"$FREE\"]}" \
  $API/discharges/$DAWN/truck-pool/withdrawals                                                                  # 200

# Refusals
curl -s -b lead.txt $API/discharges/$CEDAR/truck-pool/candidates | jq -r .error.code                        # E_DISCHARGE_NOT_PLANNED
curl -s -b observer.txt -H 'content-type: application/json' -d "{\"truckIds\":[\"$FREE\"]}" \
  $API/discharges/$DAWN/truck-pool | jq -r .error.code                                                        # E_AUTHORIZATION_FAILURE
curl -s -X PUT -b lead.txt -H 'content-type: application/json' -d '{"truckIds":[]}' \
  $API/discharges/$DAWN/shifts/$(uuidgen | tr 'A-Z' 'a-z')/trucks | jq -r .error.code                         # E_SHIFT_NOT_FOUND
```

To check an archived or suspended truck, suspend `$FREE` through the trucks administration as the
organization admin, then reserve it for Dawn. The answer is `422` with rule `availableTruck` at
`truckIds.0`.

Hardened company change: while Dawn holds `$CEDAR_TRUCK`, changing that truck's transport company
is refused with `E_TRUCK_TRANSPORT_COMPANY_LOCKED`. This was already the rule, and it now also holds
under concurrency (research.md Decision 4).

## Validate the screens

Sign in to the web app as the operations lead, on a fresh seed:

0. Open `MV Atlantic Dawn`. The header shows the vessel, `Planned`, the dock, the expected start,
   and the tonnage. The tabs read `Overview`, `Product lots (6)`, `Truck pool (9)`, `Shifts (5)`.
   The Overview's `Preparation` card lists the three sections; follow its `Truck pool` link.
1. On the Truck pool tab, the card shows `Add trucks`, and a checkbox and `Withdraw` on each held
   truck. Trucks other planned discharges also hold carry their `Also held` badge.
2. Choose `Add trucks`. The sheet lists candidates. The Ocean Cedar truck carries
   `Also held · MV Ocean Cedar · Active`. Search by a company name. Select two trucks, including
   that one, clear the search, check that the count still says `2 selected`, and choose `Reserve`.
   The sheet closes, a toast says `2 trucks reserved`, and the pool shows both, the shared one with
   its badge.
3. Open `MV Ocean Cedar` (active). Its `BB-202-PF` shows `Also held · MV Atlantic Dawn · Planned`, and
   there is no checkbox or action.
4. Back on Dawn's Shifts tab, choose `Edit` in the first shift's Trucks group. The sheet has its seven
   seeded trucks checked. Check the two new trucks, uncheck the seeded ones, and save. The shift
   lists exactly the two new trucks.
5. On the Truck pool tab, select the two new trucks and choose `Withdraw (2)`. The confirmation names both
   trucks and lists the first shift's period. Confirm. The pool no longer lists them, not even as
   released, and the shift shows `None selected`.
6. Sign in as the observer. Dawn's Truck pool and Shifts tabs show the pool and shifts with no
   checkbox, `Add trucks`, `Withdraw`, or `Edit`; its Overview still shows the `Preparation` card.
7. Filter the list on `Planned`, open Dawn, open the Shifts tab, and reload: the Shifts tab is still
   open. Copy the address into another session: it opens on Shifts too. Choose
   `Back to discharges`: the list keeps `Planned` and its search, and its address has no `tab`.
   Open another discharge: it opens on its Overview.
8. At a 360px viewport, the tabs scroll sideways and the page itself does not.

**Stale refusal**: keep Dawn's `Shift trucks` sheet open in one browser with a truck checked. In
another session, withdraw that truck. Save in the first browser. The sheet stays open, the row
shows the API's `heldTruck` reason, and the summary alert `Some trucks can no longer be selected`
appears.

## Test suites

```bash
# API: unit and integration, including the new truck pool suites and the hardened truck update
pnpm --filter @portflow/api test

# Web: the discharges feature (detail regressions included) and the trucks feature
pnpm --dir apps/web exec vitest run src/features/discharges src/features/trucks
```

The API integration suites cover, for each of the four routes, the cases `apps/api/AGENTS.md`
requires of a protected endpoint:
- unauthenticated or non-active: 401;
- observer: 403;
- each preparing role succeeds;
- the endpoint's own failures: 404, 409, and every 422 rule of `data-model.md`, each asserting
  that neither the pool nor any selection changed.

They also pin:
- the idempotent replays;
- the reactivation of a released row;
- the cascade on withdrawal, which leaves other shifts and released rows untouched;
- `otherHoldings` on `discharges.show` for planned, active, and closed discharges.

Row locks are not exercised: the test database is SQLite, where Knex ignores them (research.md
Decision 4).

## Repository gates before the PR is ready

```bash
pnpm check          # biome format + lint
pnpm typecheck
pnpm test           # full fast suite, both apps
```

Then run the screen validation above in a browser, and obtain the fresh read-only review the
constitution requires.
