# Quickstart: Validate the Active Discharge Overview

## Automated

```bash
cd apps/web && pnpm exec vitest run src/features/discharges/__tests__/active-discharge-view.test.ts \
  src/features/discharges/__tests__/dock-timeline.test.ts \
  src/features/discharges/__tests__/detail/active-header.test.tsx \
  src/features/discharges/__tests__/detail/active-overview.test.tsx \
  src/features/discharges/__tests__/detail/active-read-only.test.tsx && cd ../..
pnpm check
pnpm typecheck
pnpm test
```

The dock occupancy read is cherry-picked from #323 in this branch (research D2); run its API tests
from `apps/api` with `PORT=3398 node --import tsx ace.js test --files="consultation/dock_occupancy.spec.ts"`.

## Browser flow

1. Start the API and web app (`pnpm dev`), seed the database, sign in as an operations lead.
2. Open an active discharge from Discharges › Active (the seed's « Issue 236 active scenario »
   vessel, or start a planned one).
3. Check, against [contracts/active-record-ui.md](./contracts/active-record-ui.md):
   - header facts on every tab, no Edit / Start;
   - Overview order: vessel comment, Current shift, Dock timeline, Progress;
   - « Open in Shifts » opens the Shifts tab on the active shift, which is highlighted;
   - Product lots and Truck pool show no correction action; Shifts offers Add shift.
4. Sign in as an observer: same record, no Add shift.
5. Resize to 375 px: the Current shift card reads without horizontal scroll (SC-005).
6. Open a planned and a closed discharge: no Current shift or Progress card (FR-016).
