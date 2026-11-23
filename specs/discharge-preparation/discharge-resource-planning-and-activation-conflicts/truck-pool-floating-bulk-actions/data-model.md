# Data Model: Truck pool floating bulk actions

No persisted data changes. The feature reads two existing API payloads and derives view state from
them in pure helpers of `apps/web/src/features/discharges/truck-pool-selection.ts`.

## Sources (unchanged)

- **Discharge detail** (`DischargeDetailDto`): `status`, `vesselName`, `truckPool[]`
  (`truckId`, `registration`, `truckStatus` AVAILABLE | SUSPENDED | ARCHIVED, `transportCompany`,
  `reservedAt`, `releasedAt`, `otherHoldings[]` of `{ vesselName, status: PLANNED | ACTIVE }`), and
  `shifts[]` (`status`, `plannedStartAt`, `trucks[]` with `effectiveTo`).
- **Truck candidates** (`TruckCandidateDto[]`): `id`, `registration`, `transportCompany { id, name }`,
  `otherHoldings[]`.

## Derived view state

| Name | Shape | Rule |
|------|-------|------|
| Held entries | `PoolEntry[]` | Existing `heldPoolEntries`: none when CLOSED, else `releasedAt === null`. |
| Pool summary | `{ heldCount, suspendedCount, contested, contestedByActive }` | Over held entries only; `suspendedCount` counts `truckStatus === 'SUSPENDED'`; `contested` = some held entry has `otherHoldings`; `contestedByActive` = one of those holdings is ACTIVE. |
| Shift count by truck | `Map<truckId, number>` | Planned shifts whose current trucks (`effectiveTo === null`) include the truck. |
| Truck selection | `ReadonlySet<truckId>` | Transient (`useBulkSelection`); always a subset of held truck ids (`retainOnly` on refresh). Empty ⇒ bar hidden. |
| Candidate groups | `{ company: { id, name }, candidates, total, selected }[]` | Visible candidates grouped by company id, sorted by company name then registration; `selected` counts selected ids in the group. |

## State transitions of the floating bar

```text
hidden ──check a held truck──▶ shown(n)
shown(n) ──check/uncheck──▶ shown(n±1) │ hidden when n = 0
shown(n) ──Clear──▶ hidden
shown(n) ──Withdraw──▶ confirmation open (bar unchanged)
confirmation ──Cancel──▶ shown(n)
confirmation ──success──▶ hidden (selection cleared)
shown(n) ──pool refresh drops k selected trucks──▶ shown(n−k) │ hidden when 0
any ──tab change / leave discharge──▶ hidden (panel unmounted)
```
