# Phase 1 Quickstart: Validate Create a Weighing Area

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) |
**Contracts**: [API](./contracts/weighing-area-create-api.md) · [UI state](./contracts/weighing-area-creation-ui-state.md)

## Prerequisites

- A Node.js version compatible with the workspace dependencies and PNPM 10.28.1
- PostgreSQL configured for the API development environment
- Dependencies installed with `pnpm install`
- An active organization or operations administrator account, and a second active account without
  weighing-area management permission (e.g. an Observer)
- At least one existing weighing area (available *or* archived) to test the duplicate-name conflict
  against, and at least one existing **dock** to test the cross-resource name case (scenario 9)
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

1. **Entry point and permission gate.** As an administrator, open the map's create control and
   confirm it now offers both "New dock" and "New weighing area" (a dropdown, since there are two
   actions). Sign in as the Observer instead and confirm neither action is rendered, and that
   loading `/checkpoints?create=weighing-area` directly shows the ordinary consultation view with
   no panel. *(FR-001, FR-005, FR-018)*
2. **Arming.** Activate "New weighing area". Confirm the URL gains `create=weighing-area`, the
   sheet opens titled "Create weighing area" with an empty name field and empty but visible
   latitude/longitude fields, the map cursor becomes a crosshair, and existing checkpoint markers
   are no longer clickable. Confirm the map stays clickable while the sheet is open. *(FR-001, FR-002)*
3. **Submit before placing.** Attempt to submit. Confirm submission is blocked with a clear message
   that a location must be placed, and that no request is sent. *(FR-004)*
4. **Place.** Click a point on the map. Confirm one distinguishable pending marker appears there
   labeled "New weighing area", the coordinate fields populate to match, and the placement hint
   disappears. Click a *different* point and confirm the marker moves rather than a second marker
   appearing. *(FR-002)*
5. **Adjust both ways.** Drag the pending marker; confirm the coordinate fields follow. Then type a
   new latitude directly; confirm the marker moves to match. Type a decimal such as `48.10` and
   confirm the field does not rewrite what you are typing. *(FR-003)*
6. **Blank name.** With a placement in place, submit with an empty name. Confirm an inline error on
   the name field, that the pending marker stays put, and that nothing is created. *(FR-006, FR-014)*
7. **Duplicate name across statuses.** Submit a name matching an existing **available** weighing
   area, differing only by letter case and surrounding whitespace. Confirm a 409-driven inline
   conflict message on the name field and that the marker and typed name are preserved. Repeat
   against an **archived** weighing area's name and confirm the same rejection. *(FR-007, FR-008, FR-014)*
8. **Out-of-range and non-numeric coordinates.** Type `91` into latitude, then `abc`. Confirm each
   produces a clear field-specific message and that submission stays blocked. Then set the exact
   boundary values (latitude `90`, longitude `-180`) and confirm they are accepted. *(FR-010)*
9. **Dock name is not a conflict.** Submit a name that belongs to an existing dock. Confirm the
   weighing area is created successfully. *(FR-009)*
10. **Successful creation.** With a valid unique name and a placement, submit. Confirm: a success
    toast; the panel closes; `create` leaves the URL; `checkpoint=WEIGHING_AREA:<id>` appears; the
    new area is visible on the map at the placed coordinates within about 2 seconds without a
    reload; and its detail shows the trimmed name, the placed latitude/longitude, Available status,
    and a creation time. *(FR-011, FR-012, SC-001)*
11. **Filter widening.** Set the checkpoint-type filter to Docks only and the status filter to
    Archived, then create a weighing area. Confirm the new area is visible and selected rather than
    hidden by either filter. *(FR-013, SC-007)*
12. **Cancel and switch.** Activate "New weighing area", place a marker, then close the sheet.
    Confirm the marker is removed, `create` leaves the URL, and nothing was created. Repeat, but
    this time choose "New dock" while a weighing-area marker is pending; confirm the pending marker
    is discarded and only the dock creation flow is active. *(FR-016, FR-017)*
13. **Failure is not a partial create.** With the API stopped (or the network throttled to fail),
    submit a valid weighing area. Confirm an error toast, that the marker and name are preserved,
    and that after restoring the API a retry creates exactly one weighing area. *(FR-015)*

## Automated verification

```bash
# Frontend — the delivery surface for this feature
pnpm --filter @portflow/web test
pnpm --filter @portflow/web typecheck

# Backend — must stay green; this feature changes no backend behavior
pnpm --filter @portflow/api test

# Whole workspace, before opening the PR
pnpm check
pnpm typecheck
pnpm test
```

**Expected new/changed automated coverage** (the RED targets `/speckit-tasks` will order):

| Area | Location | Covers |
|---|---|---|
| Shared coordinate fields | `apps/web/src/components/resource-map/__tests__/resource-placement-fields.test.tsx` | Parsing, range and NaN messages, touched-gating, two-way sync with the pending placement, decimal typing (scenarios 5, 8) |
| Creation happy path | `apps/web/src/features/weighing-areas/__tests__/create/create.test.tsx` | Place → name → submit → selected detail, and filter widening (scenarios 4, 10, 11) |
| Validation and conflict | `.../create/validation.test.tsx` | Blank name, duplicate-name 409 on the name field, out-of-range coordinates, preserved marker and name, failure toast (scenarios 3, 6, 7, 8, 13) |
| Permissions | `.../create/permissions.test.tsx` | Action hidden for a non-administrator; `?create=weighing-area` inert (scenario 1) |
| Flow exclusivity | `apps/web/src/features/checkpoints/__tests__/` | Switching between the two creation flows discards the abandoned pending marker (scenario 12) |
| Dock regression guard | `apps/web/src/features/docks/__tests__/create/*.test.tsx` | Unchanged dock assertions still pass after the coordinate-field extraction and the test double's rename |
| API conflict contract *(recommended)* | `apps/api/tests/integration/weighing_areas.spec.ts` | Duplicate create → 409 `E_WEIGHING_AREA_NAME_CONFLICT` (scenario 7's server side) |

## Manual browser flow

Constitution principle VII requires the relevant browser flow to pass before the PR is ready.
Scenarios 2, 4, 5, 10, 11, and 12 are the ones that exercise real map interaction and cannot be
fully proven by the component tests, which run against a map test double — run those in a browser.
