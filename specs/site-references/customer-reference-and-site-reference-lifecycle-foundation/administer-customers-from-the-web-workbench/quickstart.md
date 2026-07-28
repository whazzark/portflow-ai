# Quickstart: Validate Customer Administration

## Prerequisites

From the repository root, install dependencies with PNPM and ensure the API test database/configuration is available according to the repository test setup.

## API validation

Run the focused customer unit and integration suites:

```bash
pnpm --filter @portflow/api exec node --import tsx ace.js test \
  --files tests/unit/customers/administration/create.spec.ts \
  --files tests/unit/customers/administration/update.spec.ts \
  --files tests/unit/customers/consultation/list.spec.ts \
  --files tests/unit/customers/consultation/available.spec.ts \
  --files tests/unit/customers/lifecycle/archive.spec.ts \
  --files tests/unit/customers/lifecycle/reactivate.spec.ts \
  --files tests/unit/customers/lifecycle/bulk/archive.spec.ts \
  --files tests/unit/customers/lifecycle/bulk/reactivate.spec.ts \
  --files tests/integration/customers/administration/create.spec.ts \
  --files tests/integration/customers/administration/update.spec.ts \
  --files tests/integration/customers/consultation/list.spec.ts \
  --files tests/integration/customers/consultation/available.spec.ts \
  --files tests/integration/customers/lifecycle/archive.spec.ts \
  --files tests/integration/customers/lifecycle/reactivate.spec.ts \
  --files tests/integration/customers/lifecycle/bulk/archive.spec.ts \
  --files tests/integration/customers/lifecycle/bulk/reactivate.spec.ts
```

Verify that an active observer can list available and archived customers but receives `403` for mutations; an admin can create/update and perform individual and bulk lifecycle actions; archived updates fail; planned/active usage blocks archival; and a mixed bulk selection changes eligible customers while returning blocked customers with actionable reasons and leaving those blocked customers unchanged.

## Web validation

Run the customer feature suite:

```bash
pnpm --filter @portflow/web exec vitest run \
  src/features/customers/__tests__/bulk/archive.test.tsx \
  src/features/customers/__tests__/bulk/reactivation.test.tsx \
  src/features/customers/__tests__/bulk/filtered-archive.test.tsx \
  --pool=threads --maxWorkers=1
```

Verify list/status/search/sort behavior, URL-restored state, detail opening, create/update sheets, observer read-only behavior, individual archive/reactivate, filtered selection, bulk operations, structured blocker feedback, loading, and retryable errors. MSW must stand in for the API; do not mock the Tuyau client module.

## Acceptance measurements

- **SC-004**: Starting from the customer workbench, use keyboard or pointer input with a stopwatch to locate a known customer, open details, and begin the intended lifecycle action. Record the elapsed time; the scenario passes at 60 seconds or less.
- **SC-005**: In the normal test environment, start timing when an accepted lifecycle response is received and stop when the refreshed list/detail state and lifecycle metadata are visible. The scenario passes at 2 seconds or less and must not use a full-page reload.

## Repository gates

```bash
pnpm check
pnpm typecheck
pnpm test
```

Before delivery, run the relevant authenticated browser journey if configured, then run `$speckit-analyze` and `$speckit-converge` against this feature directory. Expected result: all GH-37 acceptance scenarios are observable, no clarification markers remain, and API authorization/lifecycle invariants hold under both individual and bulk actions.

No authenticated browser/e2e journey is currently configured in this repository; the customer feature suite remains the available automated web-level validation seam, while the acceptance measurements above require a manual authenticated workbench review.
