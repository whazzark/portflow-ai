# Quickstart: List Discharges by Status

## Prerequisites

- `pnpm install` at the repository root, PostgreSQL running, `apps/api/.env` configured.
- Seeded data: `pnpm --filter @portflow/api db:fresh` (planned, active, and closed discharges from the
  discharge preparation fixtures).

## Automated checks

```bash
cd apps/api && PORT=3399 node --import tsx ace.js test --files="consultation/*"
```

Expect the new fields per status ([contract](contracts/discharges-index.md)) and the
`startProblemCount` / start-check parity test to pass.

```bash
cd apps/web && pnpm exec vitest run src/features/discharges/__tests__/list
```

Expect the per-tab columns, shift cell, preparation badge, customers « +N », and no-match Clear
search tests to pass.

Before review: `pnpm check`, `pnpm typecheck`, `pnpm test`.

## Manual validation (browser)

Start `pnpm dev`, sign in with a seeded user, open **Discharges**.

1. **Active** (default tab): each row shows vessel with IMO beneath, dock, Started, "Shift k / n"
   with its period and responsible, expected tonnage, and at most two customers then « +N ».
   A discharge between shifts reads "No shift in progress" with its next shift.
2. **Planned**: Expected start, a `Ready` or `n problems` badge, and "n lots · tonnage". Open a
   discharge with problems and its start dialog: the number of problems matches the badge.
3. **Closed**: Started, a muted placeholder under Closed, expected tonnage.
4. Hover or focus « +N »: every customer is listed.
5. Click anywhere on a row: the discharge opens; Back returns to the same tab and search.
6. Type `zzz`: no result counter appears, the tab counts do not change, the no-match state names
   `zzz` and offers **Clear search**, which empties the search and the address parameter.
