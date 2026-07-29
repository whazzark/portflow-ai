# Quickstart: Validate Dock and Weighing Area Administration

## Prerequisites

From the repository root, install dependencies with PNPM. The API test environment uses the configured in-memory SQLite database; browser-level validation, when available, requires the real API and PostgreSQL setup documented by the repository.

## API validation

Run the focused Dock and Weighing Area unit and integration suites:

```bash
pnpm --filter @portflow/api exec node --import tsx ace.js test \
  --files tests/unit/docks/dock_use_cases.spec.ts \
  --files tests/unit/docks/dock_concurrency.spec.ts \
  --files tests/unit/docks/dock_bulk_lifecycle.spec.ts \
  --files tests/unit/weighing_areas/weighing_area_use_cases.spec.ts \
  --files tests/unit/weighing_areas/weighing_area_concurrency.spec.ts \
  --files tests/unit/weighing_areas/weighing_area_bulk_lifecycle.spec.ts \
  --files tests/integration/docks.spec.ts \
  --files tests/integration/weighing_areas.spec.ts
```

Verify for each named resource:

- an active observer can list, search through the returned workbench data, and view available and archived records but receives `403` for every mutation;
- admins can create and update valid names and coordinates, while missing, blank, malformed, out-of-range, and case-variant duplicates fail without a change;
- a dock and weighing area may share the same normalized name;
- individual archive/reactivation records actor, server timestamp, optional trimmed comment, and one version increment;
- planned/active usage blocks archive, while reactivation restores the same identity;
- stale update/archive/reactivation returns the resource-specific `409`, requires a refetch before retry, and changes no field;
- mixed grouped actions update every eligible current-version item, retain each blocked item, and return stable request-ordered `NOT_FOUND`, `STALE_VERSION`, `IN_USE`, and `ALREADY_*` reasons;
- empty, duplicate, invalid-ID, invalid-version, or oversized-comment grouped requests return `422` before any item changes.

## Web validation

Run the router-level feature suite:

```bash
pnpm --filter @portflow/web exec vitest run \
  src/features/checkpoints/__tests__ \
  --pool=threads --maxWorkers=1
```

Verify that `/checkpoints`:

- restores independent search, status, and sorting state for docks and weighing areas;
- performs case-insensitive name substring search without losing the selected status;
- presents observer read-only behavior and administrator create/edit/lifecycle controls;
- validates GPS forms and preserves accessible error feedback;
- scopes grouped selection to the visible filtered list and reports every changed and unchanged resource in a mixed outcome;
- refreshes only the affected resource queries after mutation;
- rejects stale individual actions, prompts an explicit reload, and never retries with a substituted version;
- remains keyboard-operable and contained without page-level horizontal overflow at 375, 768, 1024, and 1440 px.
- renders the MapCN canvas with distinct Dock and Weighing Area marker contents in a browser, preserves CARTO attribution, and keeps the synchronized list usable when WebGL or tiles are unavailable.

MSW must intercept the real HTTP transport. Do not mock the Tuyau client module.
The jsdom suite validates filtering, selection, and the accessible fallback without requiring
WebGL; validate MapCN canvas initialization and remote tile behavior in a real browser.

## Discharge-usage delivery constraint

The current database has no durable discharge, Dock assignment, or Weighing Area assignment. Production therefore still binds `SiteReferenceUsageChecker` to `NoDischargeSiteReferenceUsageChecker`; focused tests swap the boundary to prove `IN_USE`. GH-53 must replace this binding in the same delivery that first persists planned or active references. A deployment containing durable references while the no-discharge adapter remains active is invalid.

## Migration validation

Run migrations against a disposable database, confirm existing Dock and Weighing Area rows receive version `1`, exercise one mutation to confirm version `2`, then roll back and re-run:

```bash
pnpm --filter @portflow/api db:migrate
pnpm --filter @portflow/api db:rollback
pnpm --filter @portflow/api db:migrate
```

The migration is reversible and must leave existing identities, names, coordinates, lifecycle metadata, and uniqueness indexes unchanged.

## Repository gates

```bash
pnpm check
pnpm typecheck
pnpm test
```

Before delivery, run the relevant authenticated Playwright journey if one is configured, then run `$speckit-analyze` and `$speckit-converge` against this feature directory. At planning time, no checkpoints-specific Playwright journey exists; the API integration and router-level web feature suites are the available automated acceptance seams.
