# Quickstart: Browse the Discharges List in the Web Workbench

How to run and validate this slice. Implementation belongs in `tasks.md`; this is the run and
verification guide. Field names come from [`contracts/discharges.openapi.yaml`](./contracts/discharges.openapi.yaml)
and screen behavior from [`contracts/ui-state.md`](./contracts/ui-state.md).

## Prerequisites

- PNPM workspace installed at the repository root: `pnpm install`
- PostgreSQL reachable with `apps/api/.env` configured
- A seeded database, which is what supplies the discharges to browse:

```bash
pnpm --filter @portflow/api db:fresh
```

The seed produces **27 discharges**: 1 Planned (`MV Atlantic Dawn`), 1 Active (`MV Ocean Cedar`),
1 Closed (`MV Loire Star`), and 24 historical Closed discharges spread over the previous twelve
months. That is enough to exercise all three tabs, the ordering rules, and the search without
writing any fixture.

## Run

```bash
pnpm dev                    # turbo runs apps/api and apps/web together
```

The API regenerates `.adonisjs/server/controllers.ts` and the Tuyau registry on boot, which is what
makes `tuyauQuery.discharges.index` exist for the web. If the web reports an unknown `discharges`
key, the API has not booted since the controller was added.

## Validate the API contract

```bash
# Signed in as any active user
curl -s -b cookies.txt http://localhost:3333/api/v1/discharges | jq '.data | length'          # 27
curl -s -b cookies.txt http://localhost:3333/api/v1/discharges | jq '[.data[].status] | group_by(.) | map({(.[0]): length}) | add'
# {"ACTIVE": 1, "CLOSED": 25, "PLANNED": 1}

# Unauthenticated
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3333/api/v1/discharges                # 401
```

Check the shape of one item: it must carry `dock.name`, a `productLots` array whose entries have
`customerName` and `productName`, and an integer `shiftCount` — and must **not** carry
`vesselComment`, `expectedQuantityTonnes`, `createdAt`, or `updatedAt`.

## Validate the screen

Sign in and open `/discharges` from `Operations → Discharges` in the sidebar.

| Check | Expected |
|---|---|
| Default tab | `Active` is selected, listing `MV Ocean Cedar` |
| Counts | All three tabs show a count; they sum to 27 |
| Counts under search | Type in the search: the rows narrow, **the counts do not change** |
| Planned order | Soonest expected start first |
| Closed order | Most recent expected start first |
| Search by vessel | `atlantic` on the Planned tab finds `MV Atlantic Dawn`, case-insensitively |
| Search by customer | A seeded customer name finds its discharges on the tab in view |
| Search by product | A seeded product name does the same |
| Whitespace-only search | Behaves as no search |
| Row is inert | Clicking a row does nothing: no panel, no navigation, no cursor change |
| Missing IMO | Renders a muted italic `Not specified`, never blank |
| URL state | Selecting a tab and typing puts both in the address; reload restores them |
| Invalid status | `/discharges?status=nope` falls back to the Active tab, no error page |
| Every role | Repeat as observer, operations lead, operations admin, organization admin — identical |

## Validate empty, no-match, and failure

- **Empty status**: temporarily point at a database with no discharge in one status, or clear that
  status' rows in a scratch database — the tab shows copy naming that status, with no create action.
- **No match**: search for `zzzz` — no-match copy appears, and it must not claim the status is empty.
- **Failure and retry**: stop the API and reload — the error state with a retry action appears;
  restart the API and use retry — the collection returns without a full page reload.

## Test suites

```bash
# API — unit and integration suites, including the new discharges slice
pnpm --filter @portflow/api test

# Web — the new feature
pnpm --filter @portflow/web test -- src/features/discharges

# Sidebar navigation regression, since the Discharges entry gains an href
pnpm --filter @portflow/web test -- src/components/layout
```

The API suites are named `unit`, `integration`, and `browser` in `apps/api/adonisrc.ts`; pass a
suite name to narrow the run while iterating.

The API integration suite must cover the four cases `apps/api/AGENTS.md` requires of a protected
endpoint: unauthenticated, non-active access, the success shape, and the authorization boundary —
here, that all four roles succeed, since none is excluded.

## Repository gates before the PR is ready

```bash
pnpm check          # biome format + lint
pnpm typecheck
pnpm test           # full fast suite, both apps
```

Then a fresh read-only review of the final diff, per Constitution VII, plus the browser pass over
the three tabs above.
