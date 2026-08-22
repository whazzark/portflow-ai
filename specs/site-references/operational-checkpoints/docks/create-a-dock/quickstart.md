# Phase 1 Quickstart: Validate Create a Dock

## Prerequisites

- A Node.js version compatible with the workspace dependencies and PNPM 10.28.1
- PostgreSQL configured for the API development environment
- Dependencies installed with `pnpm install`
- An active organization or operations administrator account, and a second active account without
  dock management permission (e.g. an Observer)
- At least one existing dock fixture (available or archived) to test the duplicate-name conflict
  against
- Deployment-approved MapLibre style URLs configured (`VITE_MAP_STYLE_LIGHT_URL` /
  `VITE_MAP_STYLE_DARK_URL`) so the checkpoints map renders

## Start the application

From the repository root:

```bash
pnpm --filter @portflow/api db:migrate
pnpm dev
```

Authenticate as an authorized administrator and open `/checkpoints`.

## End-to-end validation scenarios

1. As an administrator, confirm a "New dock" action is visible in the map's upper-left overlay.
   Sign in as the Observer account instead and confirm the action is not rendered.
2. Activate "New dock". Confirm the URL gains `create=dock`, the sheet opens titled "Create dock"
   with an empty name field and empty (but visible) latitude/longitude fields, a placement hint
   appears on the map, and existing dock/weighing-area markers are no longer clickable. Confirm the
   map remains clickable while the sheet is open (the sheet does not dim or block it).
3. Attempt to submit before clicking the map. Confirm submission is blocked with a clear message
   that a location must be placed, and no request is sent.
4. Click a point on the map. Confirm a distinguishable pending marker appears there, the sheet's
   latitude/longitude fields populate with matching values, and the placement hint disappears.
5. Drag the pending marker to a different point. Confirm the sheet's coordinate fields update to
   match the new position. Then edit a coordinate field directly. Confirm the pending marker moves
   to match the typed value.
6. Submit with the name blank (or whitespace-only). Confirm an inline error appears under the name
   field, the pending marker remains on the map, no navigation occurs, and no dock appears in the
   collection.
7. Edit a coordinate field to a value of `91` (or `-181`, or non-numeric). Confirm an inline error
   appears under the affected field and no dock is created.
8. Submit a name matching an existing fixture's name but with different case and surrounding
   whitespace (e.g. `  Existing Dock  ` when `Existing Dock` already exists, available or
   archived). Confirm an inline error appears under the name field, the pending marker remains, no
   duplicate dock is created, and the form retains all entered values.
9. Submit a unique name with the pending marker at a valid position. Confirm: a success toast
   appears; the sheet transitions to the read-only detail view for the new dock; the URL now reads
   `checkpoint=dock:<new id>` with `create` cleared; the placement marker and hint are gone and
   existing markers are clickable again; the new dock is visible on the map at the pending marker's
   final coordinates without a manual page reload; reopening its detail shows the exact submitted
   name, latitude, longitude, `Available` status, and a creation time.
10. Close the sheet (Escape or the explicit close button — clicking the map does not close it,
    since that places a marker instead) after placing a point but before submitting. Confirm
    `create` is cleared from the URL, the pending marker is removed, and no dock was created.
11. Directly request `POST /api/v1/docks` (e.g. via `curl`) without a session, and again as the
    Observer account. Confirm 401 and 403 respectively, with no dock created either way — this
    exercises the existing, unmodified authorization already covered by
    `apps/api/tests/integration/docks.spec.ts`.
12. Without touching the mouse, activate "New dock" via keyboard, tab to the name field and type a
    unique name, tab to the latitude field and type a valid value, tab to the longitude field and
    type a valid value, then activate the now-enabled "Create dock" button. Confirm the dock is
    created — this is the keyboard-only path with no map click at all.

The exact request/response and UI-state obligations are in
[`contracts/dock-create-api.md`](./contracts/dock-create-api.md) and
[`contracts/dock-creation-ui-state.md`](./contracts/dock-creation-ui-state.md).

## Targeted automated checks

```bash
pnpm --filter @portflow/api test -- docks
pnpm --filter @portflow/web test -- src/features/docks src/features/checkpoints src/components/resource-map
```

The API command should show existing, unmodified passing coverage (no new backend tests are
expected for this feature). The web command should show the new creation component/interaction
tests introduced by this slice passing alongside the existing checkpoints tests.

## Delivery verification

From the repository root:

```bash
pnpm check
pnpm typecheck
pnpm test
```

Run the affected browser journey for `/checkpoints` (create flow) in the configured browser suite.
Before marking the PR ready, obtain the constitution-required fresh read-only Codex review and
resolve or explicitly justify each confirmed finding.
