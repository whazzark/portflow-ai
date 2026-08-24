# Phase 1 Quickstart: Validate Update a Weighing Area

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) |
**Contracts**: [weighing-area-update-api.md](./contracts/weighing-area-update-api.md),
[checkpoint-edit-ui-state.md](./contracts/checkpoint-edit-ui-state.md)

## Prerequisites

- A Node.js version compatible with the workspace dependencies and PNPM 10.28.1
- PostgreSQL configured for the API development environment
- Dependencies installed with `pnpm install`
- An active organization or operations administrator account, and a second active account without
  weighing-area management permission (e.g. an Observer)
- At least three weighing-area fixtures: the area under test, a second **available** area to collide
  names with, and one **archived** area (to prove both the archived-name collision and the read-only
  rule)
- At least one dock fixture, so the cross-kind session rules in scenarios 14–16 can be exercised
- Deployment-approved MapLibre style URLs configured (`VITE_MAP_STYLE_LIGHT_URL` /
  `VITE_MAP_STYLE_DARK_URL`) so the checkpoints map renders

## Start the application

From the repository root:

```bash
pnpm --filter @portflow/api db:fresh
pnpm dev
```

Authenticate as an authorized administrator and open `/checkpoints`.

## Automated checks

```bash
pnpm --filter @portflow/api test        # Japa — weighing-area integration + unit specs
pnpm --filter @portflow/web test        # Vitest — weighing-area update tests + dock regression suite
pnpm typecheck && pnpm check
```

## End-to-end validation scenarios

Scenarios 1–13 validate this feature. Scenarios 14–16 are regression guards on the generalization —
the create flow, the dock edit flow, and the cross-kind session rules all share the code being
changed, so each must be re-proved.

1. **Entry point visibility.** Select an available weighing area. Confirm the details sheet shows an
   "Edit weighing area" action. Sign in as the Observer instead: confirm the same area's details
   render with no edit action. Select an **archived** area as the administrator: confirm no edit
   action, and the archived notice explaining reactivation is required. *(FR-006, US3 AC3/AC5)*
2. **Pre-filled form.** Activate the edit action. Confirm the name, latitude, and longitude fields
   carry the area's current stored values, focus lands on the name field, and the URL reads
   `?checkpoint=weighing-area:<id>&edit=weighing-area`. *(US1 AC1, FR-006)*
3. **Draft marker replaces the real one.** Confirm the map shows exactly one marker for the area
   being edited — the draft — and that the other checkpoint markers are muted and unselectable.
   *(research D6)*
4. **Rename only.** Change the name, save. Confirm a success confirmation, the corrected name on the
   map and in the details within ~2 seconds without a manual reload, and unchanged latitude,
   longitude, status, and creation time. *(US1 AC2, AC6, FR-015, FR-017, SC-001)*
5. **Reposition by dragging.** Re-open the edit form, drag the marker to a new point, save. Confirm
   the stored coordinates are the **final** dragged position, not an intermediate one, and that the
   marker is shown there without a reload. *(US1 AC3, SC-008)*
6. **Reposition by typing.** Re-open the edit form and type new coordinate values instead of
   dragging. Confirm the marker follows the typed values, and that saving stores exactly what was on
   screen at submission. *(US1 AC4, FR-005)*
7. **Restore original position.** Drag the marker, confirm the "Position modified" notice appears,
   then use "Restore original position". Confirm the marker returns to where it stood when the
   session opened. *(FR-022, research D7)*
8. **Both fields at once.** Change name and position in one submission. Confirm both take effect
   together. *(US1 AC5, FR-004)*
9. **No-op submission.** Re-open the edit form and save without changing anything. Confirm it
   succeeds, reports no duplicate, and leaves the area in its current state. *(US1 AC7, FR-011)*
10. **Validation refusals.** Attempt in turn: a blank name, a name over 255 characters, a latitude
    of 91, and a non-numeric longitude. Confirm each is refused with a message on the field
    concerned, the stored area unchanged, and the entered values still on screen. Then correct the
    value and resubmit **without** closing the sheet: confirm it succeeds. *(US2 AC1, AC2, AC7, AC8,
    FR-007, FR-008, FR-012, FR-021)*
11. **Duplicate refusals.** Submit the name of another available area; then the same name differing
    only by case and surrounding whitespace; then the name of an **archived** area. Confirm all
    three are refused as duplicates on the name field and that neither record is modified.
    *(US2 AC3, AC4, AC5, FR-010)*
12. **Whitespace trimming and boundary values.** Save a name with leading and trailing whitespace and
    confirm the trimmed form is stored. Save latitude 90 and longitude -180 and confirm the exact
    boundary values are accepted. *(US2 AC6, FR-009, edge cases)*
13. **Lifecycle and authorization refusals.** Archive the area from a second session while the edit
    form is open, then submit: confirm a read-only refusal naming reactivation. Then attempt an
    update against an identifier that does not exist: confirm a not-found refusal, the session
    closing, and a consistent view of the remaining checkpoints. Confirm neither attempt changed any
    stored data. *(US3 AC4, AC6, AC7, FR-013, FR-014, FR-016, edge cases)*
14. **Session scoping across kinds.** With a weighing-area edit open, change the status filter, then
    select a **dock** merely to view it. Confirm the dock's sheet opens in view mode with the map
    **not** armed to move it, and that `edit` has left the URL. Then confirm the map's "New dock" and
    "New weighing area" controls are hidden for the whole duration of an edit session.
    *(FR-023, SC-009)*
15. **Dock edit regression guard.** Re-run the #199 dock edit flow end to end: open, rename, drag,
    restore position, save, cancel. Confirm behavior is identical to before this slice.
    *(Guards the generalization — research D3)*
16. **Creation regression guard.** Re-run the create flow from #203: activate "New weighing area",
    confirm the form opens **empty**, confirm submission is blocked until a location is placed, place
    a point, name it, and create. Confirm the create-only hint text and the "Create weighing area"
    button label are unchanged. Repeat for "New dock". *(Guards the `weighing-area-form.tsx`
    generalization — research D4)*

## Expected outcomes

- Scenarios 4–9, 12, 15 and 16 succeed with the record visible in its corrected state within
  ~2 seconds and no manual reload *(SC-001, SC-008)*.
- Scenarios 1, 10, 11 and 13 all refuse with a **distinct** message, leave the stored weighing area
  byte-for-byte unchanged, and preserve the administrator's in-progress values *(SC-002, SC-003,
  SC-005, SC-006)*.
- Scenario 14 leaves no checkpoint armed for movement and discards no entered values silently
  *(SC-009)*.
- Across the whole run, no two weighing areas ever share a name case-insensitively, every updated
  area keeps its id, status, creation time, and lifecycle context, and every shift membership
  referencing it still resolves to the same area *(SC-004, SC-007)*.
- No filter is widened by a successful update — the `kinds` and `status` params are byte-identical
  before and after scenario 4 *(research D8)*.

## API-only spot checks

The ten untested API behaviors listed in
[weighing-area-update-api.md](./contracts/weighing-area-update-api.md#requirement-to-test-mapping)
are the backend work of this slice. They are verified by the Japa suite rather than by hand, but the
same paths can be exercised directly while the app runs — for example, updating an archived area
should return `409 E_WEIGHING_AREA_ARCHIVED`, re-sending an area's own current name should return
`200` rather than `409`, and an update by an Observer should return `403` while leaving the record
untouched.
