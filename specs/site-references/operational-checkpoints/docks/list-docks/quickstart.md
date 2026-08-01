# Phase 1 Quickstart: Validate List Docks

## Prerequisites

- A Node.js version compatible with the workspace dependencies and PNPM 10.28.1
- PostgreSQL configured for the API development environment
- Dependencies installed with `pnpm install`
- An active organization or operations administrator account
- Test fixtures containing at least one available and one archived dock with distinguishable GPS
  coordinates; include lifecycle comments for one record and null lifecycle facts for another
- Deployment-approved light and dark MapLibre style URLs configured as
  `VITE_MAP_STYLE_LIGHT_URL` and `VITE_MAP_STYLE_DARK_URL` for the web app; their sources must
  declare the required attribution

## Start the application

From the repository root:

```bash
pnpm --filter @portflow/api db:migrate
pnpm dev
```

Authenticate as an authorized administrator, follow **Site references → Checkpoints**, and confirm
the browser reaches `/checkpoints`.

## End-to-end validation scenarios

1. Open `/checkpoints` without search parameters. Confirm the All filter is selected and every available
   and archived fixture appears once as a dock marker at its coordinates.
2. Open the absolute status-filter control in the map's upper-left and select Available, then
   Archived. Confirm each choice hides the other status consistently from the map, the
   active choice is announced, and the URL restores the choice after navigation.
3. Enter a case- and diacritic-varied fragment of a dock name in the adjacent search input. Confirm
   matching markers are emphasized without color alone, nonmatches remain visible but
   muted, the map does not refit on each keystroke, and the URL is restored without history spam.
   Enter a zero-match query and confirm explicit no-match copy plus a working clear action; do not
   confuse this state with an empty status filter.
4. Hover and keyboard-focus a marker. Confirm its tooltip names the dock. Activate it with a click
   and with the keyboard. Confirm every path writes the exact `checkpoint=dock:<id>`
   and opens the same read-only sheet with name, coordinates, status, timestamps, and only recorded
   lifecycle facts. Confirm archived detail says it is unavailable for new operations.
5. Navigate directly to `/checkpoints?status=archived&checkpoint=dock:<unknown-id>`. Confirm no unrelated dock is
   displayed and the collection remains usable with detail closed/cleared.
   Open a valid dock, then select a status that excludes it and confirm the sheet and `checkpoint` clear.
6. Validate empty data (and then only-one-status data). Confirm each zero-record filter has distinct
   successful empty copy and never looks like a load failure.
7. Delay `GET /api/v1/docks`. Confirm progress feedback remains visible and no empty message is
   announced before success.
8. Make `GET /api/v1/docks` fail once. Confirm the failure message and **Try again** action; restore
   the response, retry, and confirm current data or the correct empty state replaces the error.
9. Attempt the endpoint and route without a session and as an active Observer. Confirm the API
   returns 401/403 with no dock data and the protected navigation does not expose the screen.
10. Make the configured MapLibre style unavailable while `GET /api/v1/docks` succeeds. Confirm map
   feedback is non-blocking and every dock marker remains selectable.
11. Request `GET /api/v1/docks/<known-id>`. Confirm the removed route is no longer exposed, while
    selecting that dock from the loaded collection still opens its details.

The exact server response and UI state obligations are in
[`contracts/docks.openapi.yaml`](./contracts/docks.openapi.yaml) and
[`contracts/ui-state.md`](./contracts/ui-state.md).

## Targeted automated checks

Run the API suite (including the dock contract regressions) and the web dock feature tests
introduced by this slice:

```bash
pnpm --filter @portflow/api test
pnpm --filter @portflow/web test -- src/features/checkpoints
```

## Delivery verification

From the repository root:

```bash
pnpm check
pnpm typecheck
pnpm test
```

Run the affected browser journey for `/checkpoints` in the configured browser suite. Before marking the
PR ready, obtain the constitution-required fresh read-only Codex review and resolve or explicitly
justify each confirmed finding.
