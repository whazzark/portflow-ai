# Quickstart: Consult a Prepared Discharge in the Web Workbench

How to run and validate this slice. The implementation belongs in `tasks.md`; this is the run and
verification guide. Field names come from
[`contracts/discharge-detail.openapi.yaml`](./contracts/discharge-detail.openapi.yaml), and screen
behavior from [`contracts/ui-state.md`](./contracts/ui-state.md).

## Prerequisites

- PNPM workspace installed at the repository root: `pnpm install`
- PostgreSQL reachable, with `apps/api/.env` configured
- A seeded database:

```bash
pnpm --filter @portflow/api db:fresh
```

The seed has three managed discharges, each with one product lot, one door assignment, one pool
truck, and one shift carrying one truck, one door, and one weighing area:

| Vessel | Discharge | Shift | Pool truck |
|---|---|---|---|
| `MV Atlantic Dawn` | Planned | Planned | Held |
| `MV Ocean Cedar` | Active | Active | Held |
| `MV Loire Star` | Closed | Completed | Released |

The 24 historical Closed discharges add ended door and shift periods and released trucks. Archived
and suspended references, re-registered trucks, ended assignments on an active discharge, and
empty sections are not in the seed. The test factories build them, as described under Test suites
below.

## Run

```bash
pnpm dev                    # turbo runs apps/api and apps/web together
```

The API regenerates the Tuyau registry on boot, which is what makes `tuyauQuery.discharges.show`
exist for the web. If the web reports an unknown `show` key, the API has not booted since the
route was added.

## Validate the API contract

```bash
# Signed in as any active user; take an id from the list
ID=$(curl -s -b cookies.txt http://localhost:3333/api/v1/discharges \
  | jq -r '.data[] | select(.vesselName == "MV Ocean Cedar") | .id')

curl -s -b cookies.txt http://localhost:3333/api/v1/discharges/$ID | jq '.data | {status, expectedTonnage, lots: (.productLots | length), pool: (.truckPool | length), shifts: (.shifts | length)}'
# {"status":"ACTIVE","expectedTonnage":"<n>.<3 digits>","lots":1,"pool":1,"shifts":1}

# Unknown and malformed ids give the same outcome
curl -s -b cookies.txt http://localhost:3333/api/v1/discharges/00000000-0000-0000-0000-000000000000 | jq .error.code   # "E_DISCHARGE_NOT_FOUND"
curl -s -b cookies.txt http://localhost:3333/api/v1/discharges/not-a-uuid | jq .error.code                             # "E_DISCHARGE_NOT_FOUND"

# Unauthenticated
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3333/api/v1/discharges/$ID           # 401
```

Check the shape against the contract:
- Every reference has `id`, `name`, and `status`.
- Quantities are strings with exactly three decimals.
- `shifts[].responsible` carries only `id`, `firstName`, and `lastName`.
- Door assignments and memberships carry `effectiveFrom` and a nullable `effectiveTo`.
- Pool entries carry `registration`, `transportCompany.name`, `reservedAt`, and a nullable
  `releasedAt`.

## Validate the screen

Sign in, open `Operations → Discharges`, pick a tab, type a search, and select a discharge.

| Check | Expected |
|---|---|
| Row selection | Clicking a row, or tabbing to its vessel link and pressing Enter, opens `/discharges/<id>` |
| Heading | The vessel name is the visible heading, with the status badge beside it; the breadcrumb reads `Discharges › <vessel name>` |
| Identity | IMO, comment, dock, expected start, and expected tonnage are shown; a missing IMO or comment reads `Not specified` |
| Product lots | Each lot shows customer, product, three-decimal quantity, description, and its doors as `warehouse › door` with a period |
| Shifts | In planned-start order, each with period, status, responsible, and three resource groups |
| Truck pool | Captured registration and company, reservation time; `MV Loire Star` shows its truck as released |
| Closed history | A historical closed discharge (e.g. `MV Asteria 2024`) shows its door and shift periods as ended. `MV Loire Star` shows them as ended with `end not recorded`: its seeded periods have no end date, see Known data issue below |
| Back link | Returns to the list with the tab and search that were selected |
| Breadcrumb | `Discharges` in the header does the same |
| Reload | Reloading the detail shows the same discharge |
| Direct open | Pasting the detail address into a new session opens it, and the back link lands on the Active tab |
| Mismatched list state | `/discharges/<closed id>?status=active&search=zzz` still opens that discharge |
| Not found | `/discharges/00000000-0000-0000-0000-000000000000` and `/discharges/nope` show the not-found state with a way back and no retry |
| Every role | Repeat as observer, operations lead, operations admin, and organization admin: identical page, no action button anywhere |

## Validate loading, failure, and empty sections

- **Loading**: throttle the network in devtools; the pending state shows the section skeletons,
  never an empty page.
- **Failure and retry**: open a detail, stop the API, and reload. The error state and its retry
  action appear. Restart the API and use retry: the detail returns without a full page reload.
- **Empty sections**: covered by the feature tests, since no seeded discharge is empty. A planned
  discharge with no lot, shift, or pool truck shows one empty state per card.

## Test suites

```bash
# API: unit and integration suites, including the new show workflow
pnpm --filter @portflow/api test

# Web: the discharges feature, list regressions included
pnpm --dir apps/web exec vitest run src/features/discharges

# Shared header, since ancestor crumbs now keep the search
pnpm --dir apps/web exec vitest run src/components/layout
```

The API integration suite covers the cases `apps/api/AGENTS.md` requires of a protected endpoint:
- Unauthenticated: 401.
- Non-active user: 401.
- Every role succeeds: 200.
- Endpoint-specific failures: 404 for an unknown id and for a malformed id.

It also shows that an observer receives archived references with their labels.

The factories in `apps/api/database/factories/` build the cases the seed lacks:
- An archived dock, customer, warehouse, door, weighing area, and transport company.
- A suspended truck.
- A truck re-registered after reservation.
- A shift truck with no pool entry, to test the fallback.
- A lot with only ended assignments on an active discharge.
- A planned discharge with no lot, shift, or pool truck.

`pnpm --filter @portflow/web test -- <path>` does not narrow the run: the `--` reaches vitest as a
literal argument and the whole suite runs. Call vitest directly, as above.

## Known data issue

The managed seed scenario `MV Loire Star` is Closed and its pool truck is released, yet its warehouse
door assignment and its shift's truck, door, and weighing-area memberships are still open-ended
(`effective_to` null). The detail never presents a closed discharge as holding anything, so it shows
these periods as ended with `end not recorded` (research.md Decision 4). The 24 historical closed
discharges are consistent. Fixing it belongs to the GH-236 seed, or to the closure
slice that ends a closed discharge's periods, not to this read slice.

## Repository gates before the PR is ready

```bash
pnpm check          # biome format + lint
pnpm typecheck
pnpm test           # full fast suite, both apps
```

Then, per Constitution VII, a fresh read-only review of the final diff and the browser pass above.
