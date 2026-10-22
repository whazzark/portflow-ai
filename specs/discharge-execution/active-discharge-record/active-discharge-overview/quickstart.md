# Quickstart: Validate the Active Discharge Overview

## Automated

```bash
pnpm --filter @portflow/web test -- src/features/discharges/__tests__/active-discharge-view.test.ts
pnpm --filter @portflow/web test -- src/features/discharges/__tests__/detail/active-overview.test.tsx
pnpm check
pnpm typecheck
pnpm test
```

If the dock occupancy read is implemented in this branch (research D2), also run its API tests
(see `apps/api` Japa conventions and the `api-test-runner-quirks` notes).

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
