# Quickstart: Validate Discharge Preparation Persistence and Seeds

## Prerequisites

- Node.js and pnpm installed according to the repository setup.
- Dependencies installed with `pnpm install`.
- Work from the feature branch for issue #236.

## Run the focused persistence and seed tests

From `apps/api`:

```bash
pnpm exec node --import tsx ace.js test unit --files='tests/unit/discharges/**/*.spec.ts'
pnpm exec node --import tsx ace.js test integration --files='tests/integration/database/discharge_preparation_seeders.spec.ts'
```

Expected result: the focused tests pass and cover the three lifecycle graphs, snapshots,
relationships, idempotent reruns, missing/ambiguous parents, and failed-scenario recovery.

## Run the complete API test suite

```bash
pnpm exec node --import tsx ace.js test
```

Expected result: existing site-reference lifecycle and usage-protection tests remain green, and
the new preparation tests pass against the in-memory SQLite database with foreign keys enabled.

## Validate migrations and deterministic initialization

```bash
pnpm exec node --import tsx ace.js migration:fresh --seed --drop-types
pnpm exec node --import tsx ace.js migration:fresh --seed --drop-types
```

Expected result: both runs complete, the managed Planned, Active, and Closed graphs have the same
logical identities and relationships after the second run, and Closed history does not reserve
resources needed by Planned or Active scenarios.

## Repository checks

From the repository root:

```bash
pnpm check
pnpm typecheck
pnpm test
```

No browser flow is required for this issue because the scope explicitly adds no interface or
mutation endpoint.

See [managed preparation initialization contract](contracts/managed-preparation-initialization.md)
and [data model](data-model.md) for the exact invariants under test.
