# Quickstart: Wider Creation Wizard With a Shift Preview

This guide validates the feature end to end. Contracts are in [contracts/](./contracts/), and the
derivation rules are in [data-model.md](./data-model.md).

## Prerequisites

- Dependencies are installed (`pnpm install`), and the local PostgreSQL database is migrated and
  seeded as in the repository README.
- The seed holds an active or planned discharge on at least one dock. Note that dock and the latest
  planned shift end of the discharge on it.
- You are signed in as an operations lead.

## Automated checks

```bash
pnpm check
pnpm typecheck
pnpm test
```

These must pass. They include:
- `apps/api/tests/integration/discharges/consultation/dock_occupancy.spec.ts`;
- `apps/web/src/features/discharges/__tests__/shift-preview.test.ts`;
- `apps/web/src/features/discharges/__tests__/create/shift-preview.test.tsx`;
- the existing `__tests__/create/*` suites, unchanged in behavior (SC-005).

## API smoke check

While signed in, run `GET /api/v1/discharges/dock-occupancy?dockId=<that dock>`. It should answer
one item per planned or active discharge on the dock, matching
[the OpenAPI contract](./contracts/dock-occupancy.openapi.yaml). A malformed `dockId` answers 422.

## Browser walk (apps/web)

1. Open `/discharges/new` on a wide screen.
   - The header, stepper, card, and footer span the content width.
   - The stepper shows « 1 Vessel and dock », « 2 Product lots », and « 3 Planned shifts », with no
     « Step 1 of 3 ».
2. Choose the noted dock and an expected start two days after its occupancy ends. Complete the lots
   step, then continue to Planned shifts.
   - « Shift preview » is first.
   - The summary reads « <dock> · free from <end> · expected start <start> ».
   - The other discharge is drawn on the dock row up to its end, followed by « Dock free ».
   - The Expected start marker is drawn.
   - « Shift 1 · no period yet » shows.
3. Enter shift 1. Add a shift, and give it a start two hours after shift 1 ends.
   - Both blocks appear immediately, with a visible gap between them.
   - The row reads « 2 shifts · <h> h ».
   - The footer period matches.
4. Go Back to step 1, choose a dock with no discharge, and return to Planned shifts.
   - The dock row reads « Dock free » across the period.
   - The summary has no « free from ».
5. Add shifts until there are eight or more.
   - The page scrolls under the sticky footer.
   - The preview stays at the top of the step.
   - The last row and Add shift can be scrolled above the footer.
6. Confirm that nothing appears under the Planned shifts card or the preview besides Add shift.
   Confirm the description has no sentence about new shifts.
7. With the API stopped, open Planned shifts again.
   - The preview shows « Dock occupancy is unavailable. » with Retry, and still draws the expected
     start and the shifts.
   - Restart the API and press Retry: the occupancy appears.
8. Narrow the window to phone width.
   - The stepper shows numbers only.
   - The preview scrolls sideways inside its box.
   - The page does not scroll sideways.
9. Create the discharge. It opens its detail page as before.
