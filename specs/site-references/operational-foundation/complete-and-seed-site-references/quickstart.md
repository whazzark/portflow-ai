# Quickstart: Validate the Operational Site-Reference Foundation

## Prerequisites

- Install dependencies with `pnpm install`.
- Configure the API environment and a disposable local PostgreSQL database.
- Do not run destructive fresh-database commands against a database containing valued data.

## Automated validation

Run the focused lifecycle and initialization tests created by the implementation, followed by the
existing consultation regression suites:

```bash
pnpm --filter @portflow/api test -- --files='unit/database/storage_reference_lifecycle.spec.ts'
pnpm --filter @portflow/api test -- --files='integration/database/site_reference_seeders.spec.ts'
pnpm --filter @portflow/api exec node --import tsx ace.js test integration
```

Expected outcome: the new tests prove persisted storage lifecycle context, all seven scenario sets,
parent/geographic integrity, exact rerun convergence and preservation of unrelated rows; every
existing consultation test remains green without contract changes.

## PostgreSQL clean-and-rerun scenario

On the disposable database only:

1. Run `pnpm --filter @portflow/api db:fresh` and capture each managed row's UUID, normalized key,
   lifecycle values, parent UUID and footprint point count.
2. Add one unrelated reference, then introduce repairable drift in a managed scalar/lifecycle value.
3. Run `pnpm --filter @portflow/api db:seed`.
4. Compare against the [initialization contract](./contracts/managed-reference-initialization.md).

Expected outcome: managed values converge, all UUIDs and declared parents are unchanged, fixed
occurrences do not move, no duplicate or footprint point accumulates, and the unrelated record is
untouched. The complete initialization stays below 60 seconds.

## Repository gates

```bash
pnpm check
pnpm typecheck
pnpm test
```

Expected outcome: all commands pass. No browser flow is required because this plan changes no web
code or public consultation behavior; existing API integration tests cover the affected read boundary.
