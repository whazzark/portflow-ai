# Quickstart: validate the planned discharge header and dock timeline

## Prerequisites

- `pnpm install` at the repository root
- Local PostgreSQL from `docker/` for the API integration tests and the manual journey
- Seeded data with a dock held by an active discharge and at least one planned discharge on it

## Automated checks

```bash
pnpm --filter @portflow/api test --files tests/integration/discharges/consultation/show.spec.ts
```

Expected: the `dockOccupations` scenarios of [the contract](./contracts/discharge-detail-dock-occupations.md) pass.

```bash
pnpm --filter @portflow/web test src/features/discharges
```

Expected: the unit tests (`dock-timeline`, `plannedPeriod`, `problemTabs`) and the feature tests
`planned-header`, `start-blockers`, `dock-timeline`, `preparation-summary`, `identity`, `tabs`, and
the existing `start/*` tests pass.

Before marking the PR ready:

```bash
pnpm check
pnpm typecheck
pnpm test
```

## Manual journey (browser)

1. Sign in as an operations lead; open a planned discharge whose dock is held by an active discharge,
   with a lot without a warehouse door and two shifts separated by a gap.
2. Header: vessel + Planned badge; Dock · Planned period · IMO · Expected tonnage; comment visible on
   Overview only; Edit and Start present. Switch tabs: the facts line stays identical.
3. Banner: "n problems block the start" with Review. Review opens the Start dialog listing the same n
   problems. Dots on Overview (dock held) and Product lots; none on Truck pool if it has no problem.
4. Assign a door to the lot from Product lots: the Product lots dot disappears and the count drops
   without a reload.
5. Overview: timeline titled with the dock; the active discharge drawn as an occupation (linking to
   its record) with an overlap stated in words; Now and Expected start markers; both shifts and the
   gap with its duration. Preparation card below: Dock (held by …), Product lots, Truck pool, Shifts,
   each link opening its tab.
6. Sign in as an observer: same header and timeline, no banner, no dots, no Edit/Start.
7. Open an active and a closed discharge: unchanged from today.
8. At phone width: header facts wrap; the timeline scrolls inside its card.
