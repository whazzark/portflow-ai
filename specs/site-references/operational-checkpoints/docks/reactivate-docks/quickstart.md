# Phase 1 Quickstart: Validate Reactivate Docks

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Contracts**: [dock-reactivate-api.md](./contracts/dock-reactivate-api.md),
[dock-reactivate-ui-state.md](./contracts/dock-reactivate-ui-state.md)

## Prerequisites

- A Node.js version compatible with the workspace dependencies and PNPM 10.28.1
- PostgreSQL configured for the API development environment
- Dependencies installed with `pnpm install`
- An active organization or operations administrator account, and a second active account without
  dock management permission (e.g. an Observer)
- At least five **archived** dock fixtures for the bulk scenarios, one available dock, and one dock
  that was archived and previously referenced by a closed discharge (so FR-015 can be checked
  against real historical references)
- Deployment-approved MapLibre style URLs configured
  (`VITE_MAP_STYLE_LIGHT_URL` / `VITE_MAP_STYLE_DARK_URL`) so the checkpoints map renders

## Start the application

From the repository root:

```bash
pnpm --filter @portflow/api db:fresh
pnpm dev
```

Authenticate as an authorized administrator and open `/checkpoints?status=all` (or set the status
filter to **All** or **Archived** in the map controls — archived docks are hidden under the default
`available` filter).

## Automated checks

```bash
pnpm --filter @portflow/api test        # Japa — dock lifecycle + bulk-reactivate specs
pnpm --filter @portflow/web test        # Vitest — dock reactivate + intent-scoped select-mode tests
pnpm typecheck && pnpm check
```

## End-to-end validation scenarios

Scenarios 1–15 validate this feature. Scenario 16 is a regression guard on the bulk-archive flow
#200 delivered, which the intent-scoped select mode must not disturb.

1. **Finding archived docks.** With the status filter on **Available**, confirm archived docks are
   hidden. Switch to **Archived**, then **All**: confirm archived dock markers appear with their
   dashed outline and archive badge, and are selectable. *(FR-020, US1)*

2. **Individual entry point visibility.** Select an archived dock. Confirm the details sheet shows a
   "Reactivate dock" action and **no** "Edit dock" action. Select an available dock: confirm
   "Edit dock" + "Archive dock" and no reactivate action. Sign in as the Observer: confirm no
   lifecycle action appears for any dock. *(FR-001, FR-003, US1, US3 AC3)*

3. **Individual reactivation, happy path.** Reactivate an archived dock with a comment, under the
   **All** status filter. Confirm a success confirmation, the marker switches to the available style
   within 2 seconds without a manual reload, and the details sheet shows the reactivation comment,
   the reactivating administrator, and the reactivation timestamp. *(US1 AC1–AC2, AC4; SC-001)*

4. **Archive history survives.** On the dock reactivated in scenario 3, confirm the details sheet
   still shows who archived it, when, and the archive comment, alongside the new reactivation
   record. Confirm its name, position, and creation time are unchanged. *(US1 AC5; FR-012, FR-013;
   SC-007)*

5. **Individual reactivation, no comment.** Reactivate an archived dock leaving the comment blank,
   and another with whitespace only. Confirm both succeed with no reactivation comment recorded.
   *(US1 AC3; FR-010; spec Edge Cases)*

6. **Individual blockers.** Attempt to reactivate an already available dock (send the request
   directly — the UI does not offer it): confirm a 409 `E_DOCK_ALREADY_AVAILABLE` and unchanged
   lifecycle metadata. Attempt an unknown id: confirm a 404 `E_DOCK_NOT_FOUND` disclosing nothing
   about other docks. *(US3 AC4–AC5; FR-007, FR-008, FR-019)*

7. **Select mode fixes the intent.** With the status filter on **All**, enter "Select docks" and
   check an archived dock. Confirm the action bar reads "Reactivate selected", and that available
   dock markers are no longer checkable. Clear the selection, check an available dock instead:
   confirm the bar reads "Archive selected" and archived markers become non-checkable.
   *(FR-002, FR-020; research D3)*

8. **Bulk reactivation, all eligible.** Check five archived docks, submit with one shared comment.
   Confirm all five become available in one action, each recording the same administrator,
   timestamp, and comment. *(US2 AC1–AC2, AC5; FR-002, FR-010, FR-011; SC-002)*

9. **Bulk reactivation, mixed selection.** Build a selection of archived docks, then submit a
   request (directly, bypassing the UI's homogeneity rule) that also contains an available dock id
   and an id that matches no dock. Confirm the archived docks are reactivated, and the other two are
   reported individually as `ALREADY_AVAILABLE` and `NOT_FOUND` with nothing changed for them.
   *(US2 AC3–AC4; FR-009, FR-017; SC-003)*

10. **Everything blocked is not an empty selection.** Submit a selection in which every dock is
    already available. Confirm a successful response with zero reactivated docks and every entry
    reported as blocked — not a validation error. *(spec Edge Cases; FR-009)*

11. **Invalid selections are rejected whole.** Submit an empty `ids`, a list containing a duplicate
    id (including in different letter case), and a list containing a malformed id. Confirm each is
    refused with 422 before any dock is evaluated, and that no dock's status or lifecycle metadata
    changed. *(US3 AC1–AC2, AC6; FR-004, FR-005; SC-004)*

12. **Authorization is server-side.** Send an individual and a bulk reactivation request as an
    unauthenticated visitor, as a non-active user, and as an active Observer. Confirm 401/401/403
    respectively, with no dock changed, and confirm the UI offers neither action to the Observer.
    *(US3 AC3; FR-003, FR-019; SC-005)*

13. **Concurrency.** Submit two overlapping selections containing the same archived dock at the same
    time. Confirm exactly one reactivates it and the other reports it `ALREADY_AVAILABLE`, with a
    single reactivation comment and a single reactivation timestamp stored. *(spec Edge Cases;
    FR-016; SC-006)*

14. **Historical references survive.** For the dock archived while referenced by a closed discharge,
    reactivate it and confirm that discharge still points at the same dock and its history is
    still readable. *(FR-015; SC-008)*

15. **Repeated cycles.** Archive a dock, reactivate it, archive it again, reactivate it again.
    Confirm each transition is recorded in turn, the latest one determines the current status, and
    the identity, name, position, and creation time never change. *(FR-021, FR-012)*

16. **Regression — bulk archive is unchanged.** Under the **Available** status filter, enter select
    mode, check several available docks including one used by a Planned or Active discharge, and
    archive them. Confirm the outcome is exactly what #200 delivered: eligible docks archived,
    the in-use dock reported `IN_USE`, and **that dock left checked** for a resubmission. Confirm
    Ctrl/Cmd+A and shift-click still behave as they did for available docks. *(#200 regression
    guard)*

## Notes

- Reactivating under the **Archived** status filter removes the dock from the filtered view, and the
  details sheet closes for the individual path. That is the intended, symmetric counterpart of
  archiving under the **Available** filter (research D6) — validate scenarios 3 and 8 under **All**
  when you want to watch the status change in place.
- The bulk endpoint returns 200 with per-dock outcomes even when nothing was reactivated; a non-200
  response means the request was refused outright (authorization or validation), and in that case
  no dock changed.
