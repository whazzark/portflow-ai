# Quickstart: Validate Product Lots Grouped by Customer

## Automated

```bash
pnpm --filter @portflow/web exec vitest run src/features/discharges/__tests__/discharge-detail-view.test.ts
pnpm --filter @portflow/web exec vitest run src/features/discharges/__tests__/detail/product-lots.test.tsx
pnpm --filter @portflow/web exec vitest run src/features/discharges/__tests__/detail/correct-product-lot.test.tsx
pnpm --filter @portflow/web exec vitest run src/features/discharges/__tests__/planning/lot-doors.test.tsx
pnpm check && pnpm typecheck && pnpm test
```

Expected: all green; existing add/correct/remove/door tests keep passing (SC-005).

## Manual (seeded data)

Start the API and web as usual and sign in as an administrator.

1. Open a **planned** discharge whose lots include one without a door and one whose door is assigned
   to an **active** discharge (the seed's Atlantic Dawn / Ocean Cedar pair, or assign a door of an
   active discharge to a planned lot).
2. Product lots tab: the summary shows the lot/customer/total line and the two problem counts; the
   lot without door shows « No door » with Assign doors; the held door reads « Held by <vessel> ».
3. Click Assign doors on the « No door » lot, add a door, Save: the indicator and count disappear
   without reload.
4. Open the lot menu's Edit on the held lot: the sheet lists its doors with « Held by … » and an
   Assign doors button that opens the dialog; the dialog explains the hold.
5. Sign in as an **observer** on the same discharge: « No door » shows, no « Held by … », no actions.
6. Open an **active** discharge: grouped lots, « Read-only while the discharge is active », no amber
   indicators, no actions.
7. Repeat 2 at phone width (375 px): no horizontal page scroll; the dialog shows tabs.
