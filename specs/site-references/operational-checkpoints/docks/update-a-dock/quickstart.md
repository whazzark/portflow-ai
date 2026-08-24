# Phase 1 Quickstart: Validate Update a Dock

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) |
**Contracts**: [dock-update-api.md](./contracts/dock-update-api.md),
[dock-edit-ui-state.md](./contracts/dock-edit-ui-state.md)

## Prerequisites

- A Node.js version compatible with the workspace dependencies and PNPM 10.28.1
- PostgreSQL configured for the API development environment
- Dependencies installed with `pnpm install`
- An active organization or operations administrator account, and a second active account without
  dock management permission (e.g. an Observer)
- At least three dock fixtures: the dock under test, a second **available** dock to collide names
  with, and one **archived** dock (to prove both the archived-name collision and the read-only rule)
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
pnpm --filter @portflow/api test        # Japa — dock integration + unit specs
pnpm --filter @portflow/web test        # Vitest — dock update component tests
pnpm typecheck && pnpm check
```

## End-to-end validation scenarios

Scenarios 1–13 validate this feature. Scenario 14 is a regression guard on the form
generalization — creation shares the component being changed, so it must be re-proved.

1. **Entry point visibility.** Select an available dock. Confirm the details sheet shows an
   "Edit dock" action. Sign in as the Observer instead: confirm the same dock's details render with
   no edit action. Select an **archived** dock as the administrator: confirm no edit action, and the
   header still explains the dock is archived. *(FR-006, US3 AC3/AC5)*

2. **Entering edit mode.** Activate "Edit dock". Confirm the URL gains `edit=dock` while
   `checkpoint=dock:<id>` is unchanged; the sheet is titled for editing with the name, latitude, and
   longitude fields **pre-filled** with the dock's current values; focus lands on the name field; the
   other markers are muted and non-clickable; the map stays clickable through the sheet.
   *(FR-006, US1 AC1)*

3. **The draft marker replaces the real one.** Confirm the edited dock appears on the map exactly
   once, as the pending-style draft marker labelled with the dock's own name — not as two markers,
   and not as the ordinary anchor marker. *(research D3)*

4. **Rename only.** Change the name, leave the position alone, save. Confirm a success
   confirmation, the sheet returns to the read-only details, the new name appears on the marker and
   in the collection without a manual refresh, the position is unchanged, and "Last updated" has
   advanced while "Created" has not. *(US1 AC2, AC6; FR-015, FR-017)*

5. **Reposition by drag.** Re-enter edit mode, drag the draft marker to a new point. Confirm the
   latitude/longitude fields update to match as you drag. Save, and confirm the dock is stored at the
   **final dragged** position. *(US1 AC3; SC-008)*

6. **Reposition by typing.** Re-enter edit mode and type new coordinate values directly. Confirm the
   draft marker moves to match. Confirm a decimal value with a trailing zero (e.g. `46.10`) can be
   typed without being rewritten mid-keystroke. *(US1 AC4; keyboard-only edge case)*

7. **Restore original position.** Drag the marker, and confirm a "position modified" indication
   appears with a restore control. Activate it: confirm the marker and both fields return to the
   dock's stored coordinates and the indication clears. Confirm a name already typed is **not**
   cleared by this. *(research D10)*

8. **Combined change.** Change the name and the position in one submission. Confirm both take
   effect together. *(US1 AC5; FR-004)*

9. **No-op save.** Enter edit mode and save immediately, changing nothing. Confirm the save button
   is **enabled**, the request succeeds, no duplicate-name error appears, and the dock is unchanged.
   *(US1 AC7; FR-011 — the arbitrage recorded in research D6)*

10. **Validation refusals.** For each of: blank name, whitespace-only name, a 256-character name,
    latitude `91`, longitude `-181`, and a non-numeric coordinate — confirm the save is refused with
    the message on the **offending field**, the stored dock is unchanged, and the values you entered
    plus the draft marker position all remain for correction. Then correct one and resubmit without
    closing the sheet: confirm it succeeds. *(US2 AC1, AC2, AC7, AC8; FR-021)*

11. **Duplicate refusals.** Submit (a) another available dock's exact name, (b) that name differing
    only by letter case, (c) that name with leading/trailing whitespace, and (d) the **archived**
    dock's name. Confirm all four are refused as duplicates with the message on the name field, and
    neither dock changes. Then submit a name with surrounding whitespace that is otherwise unused:
    confirm it saves **trimmed**. *(US2 AC3–AC6; FR-009, FR-010)*

12. **Boundary coordinates.** Save with latitude `90`, then `-90`, then longitude `180`, then
    `-180`. Confirm each is accepted. *(FR-012 edge case)*

13. **Lifecycle and authorization guards.** With an edit session open in one browser, archive the
    same dock from another administrator session, then save the first: confirm a refusal stating
    reactivation is required first, with the form still open and values intact. Separately, delete
    or use an unknown dock id and confirm a not-found refusal that leaves edit mode and clears the
    selection. Finally, confirm via the API contract that an unauthenticated `PATCH` returns 401 and
    an Observer's `PATCH` returns 403, with the dock unchanged in both cases.
    *(US3 AC1, AC2, AC4, AC6, AC7; FR-013, FR-014; edge cases)*

14. **Creation regression guard.** Re-run the full create flow from #198: activate "New dock",
    confirm the form opens **empty**, confirm submission is still blocked until a location is placed,
    place a point, name it, and create. Confirm the create-only hint text and the "Create dock"
    button label are unchanged. *(Guards the `dock-form.tsx` generalization — research D4)*

## Expected outcomes

- Scenarios 4–9, 12 and 14 succeed with the dock visible in its corrected state within ~2 seconds
  and no manual reload *(SC-001, SC-008)*.
- Scenarios 10, 11 and 13 all refuse with a **distinct** message, leave the stored dock byte-for-byte
  unchanged, and preserve the administrator's in-progress values *(SC-002, SC-003, SC-005, SC-006)*.
- Across the whole run, no two docks ever share a name case-insensitively, and every updated dock
  keeps its id, status, creation time, and lifecycle context *(SC-004, SC-007)*.

## API-only spot checks

The seven untested API behaviors listed in
[dock-update-api.md](./contracts/dock-update-api.md#requirement-to-test-mapping) are the backend
work of this slice. They are verified by the Japa suite rather than by hand, but the same paths can
be exercised directly while the app runs — for example, updating an archived dock should return
`409 E_DOCK_ARCHIVED`, and re-sending a dock's own current name should return `200`, not `409`.
