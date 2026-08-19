# Quickstart: Validate Persisted Site-Reference Usage

## Prerequisites

- Work from `feat/240-enforce-persisted-site-reference-usage`.
- Install repository dependencies with `pnpm install`.
- Use the configured in-memory SQLite test connection for focused tests.
- Use only a disposable local database for migration reset commands.

See [data-model.md](data-model.md) for relationship predicates and
[contracts/persisted-site-reference-usage.md](contracts/persisted-site-reference-usage.md) for the
internal and HTTP compatibility contracts.

## 1. Run the Persisted Usage Matrix

From `apps/api`:

```bash
```

Expected result:

- Customer, Dock, Weighing Area, Warehouse Door, and Truck return as used for qualifying Planned
  and Active Discharges.
- Closed, ended-membership, ended-assignment, and released-reservation history does not return as
  used.
- Mixed current/history, duplicate, reordered, unknown, and empty inputs satisfy the deterministic
  Set contract.
- The production container resolves the persisted checker.

## 2. Run the Bulk Scale and Query-Bound Test

```bash
```

Expected result: for each of the five supported reference kinds, a non-empty 1,000-identifier
assessment completes within 2 seconds and performs one SELECT, while empty input performs zero
SELECTs.

## 3. Run Existing Archive Journeys Against Persisted State

```bash
pnpm exec node --import tsx ace.js test integration --files='tests/integration/customers/lifecycle/archive.spec.ts'
pnpm exec node --import tsx ace.js test integration --files='tests/integration/customers/lifecycle/bulk/archive.spec.ts'
pnpm exec node --import tsx ace.js test integration --files='tests/integration/docks.spec.ts'
pnpm exec node --import tsx ace.js test integration --files='tests/integration/weighing_areas.spec.ts'
```

Expected result:

- Current persisted usage produces the existing Customer, Dock, and Weighing Area conflict codes.
- Customer bulk archive reports `IN_USE` while archiving eligible records in the same request.
- Rejected references retain their original available state and lifecycle metadata.
- Closed or explicitly ended usage allows otherwise eligible archival.

## 4. Validate the Additive Index Migration

Against a disposable local API database only:

```bash
pnpm db:fresh
pnpm db:rollback
pnpm db:migrate
```

Expected result: the disposable rebuild, rollback, and re-application complete successfully; the
final schema contains the two usage indexes and no generated model field changes.

## 5. Run Repository Verification

From the repository root:

```bash
pnpm check
pnpm typecheck
pnpm test
```

Expected result: formatting/lint, TypeScript, focused behavior, scale, and all existing fast tests
pass. No browser flow is required because this feature changes no web files or user-facing route.
