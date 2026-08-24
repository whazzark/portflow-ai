# Phase 1 Quickstart: Validate Archive Docks

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Contracts**: [dock-archive-api.md](./contracts/dock-archive-api.md),
[dock-archive-ui-state.md](./contracts/dock-archive-ui-state.md)

## Prerequisites

- A Node.js version compatible with the workspace dependencies and PNPM 10.28.1
- PostgreSQL configured for the API development environment
- Dependencies installed with `pnpm install`
- An active organization or operations administrator account, and a second active account without
  dock management permission (e.g. an Observer)
- At least five available dock fixtures for the bulk scenarios, one archived dock, and one dock
  referenced as the current dock of a Planned or Active discharge (`createPersistedDockUsageScenario`
  in `apps/api/tests/support/persisted_dock_usage.ts` already provides this)
- Deployment-approved MapLibre style URLs configured
  (`VITE_MAP_STYLE_LIGHT_URL` / `VITE_MAP_STYLE_DARK_URL`) so the checkpoints map renders

## Start the application

From the repository root:

```bash
pnpm --filter @portflow/api db:fresh
pnpm dev
```

Authenticate as an authorized administrator and open `/checkpoints`.

## Automated checks

```bash
pnpm --filter @portflow/api test        # Japa — dock lifecycle + bulk-archive specs
pnpm --filter @portflow/web test        # Vitest — dock archive + select-mode component tests
pnpm typecheck && pnpm check
```

## End-to-end validation scenarios

Scenarios 1–14 validate this feature. Scenario 15 is a regression guard on the checkpoints map's
existing single-selection view/edit flow, which the new `selecting` param must not disturb.

1. **Individual entry point visibility.** Select an available dock. Confirm the details sheet shows
   an "Archive dock" action. Select an **archived** dock: confirm no archive action (and no
   reactivate action — that's #201). Sign in as the Observer: confirm neither action appears for
   any dock. *(FR-001, FR-003, US1)*

2. **Individual archive, happy path.** Archive an eligible dock with a comment. Confirm a success
   confirmation, the marker switches to the archived (dashed, badged) style within 2 seconds without
   a manual reload, and the details sheet shows the comment, the archiving administrator, and the
   archive timestamp. *(US1 AC1–AC2, AC4; SC-001)*

3. **Individual archive, no comment.** Archive an eligible dock leaving the comment blank. Confirm
   it succeeds with no archive comment recorded. *(US1 AC3)*

4. **Individual archive, blocked outcomes.** Attempt to archive the discharge-referenced dock:
   confirm it is refused as in use and stays available. Attempt to archive the same dock a second
   time after it becomes eligible then gets archived by another session: confirm an already-archived
   refusal. Attempt an unknown dock id via the API contract directly: confirm a not-found refusal.
   *(US3 AC4–AC6; FR-007–FR-009)*

5. **Entering select mode.** Activate "Select docks". Confirm the URL gains `selecting=docks`, the
   create and edit entry points are hidden, and clicking a dock marker toggles a checked ring on it
   instead of opening its details sheet. Confirm clicking a weighing-area marker still opens its
   details sheet unchanged. *(research D4; contracts/dock-archive-ui-state.md)*

6. **Selecting and archiving an all-eligible batch.** In select mode, check five to ten available
   docks, activate "Archive selected", optionally add one shared comment, confirm. Confirm every
   checked dock switches to the archived style, the confirmation names the count, and — if a
   comment was given — every archived dock carries that same comment. *(US2 AC1, AC2, AC5; SC-002,
   SC-008)*

7. **Mixed selection, partial success.** Check a combination of: two eligible docks, the
   discharge-referenced dock, an already-archived dock (if archived docks are checkable — otherwise
   substitute a dock archived by another session between check and submit), and one identifier that
   does not exist (exercised via the API contract directly, since the map cannot produce an unknown
   id). Submit. Confirm the two eligible docks archive, and the outcome names each blocked dock
   individually with its exact reason (`NOT_FOUND` / `IN_USE` / `ALREADY_ARCHIVED`). *(US2 AC3, AC4;
   SC-003)*

8. **Resubmission after blockers.** From scenario 7's blocked state, confirm the selection bar keeps
   only the `IN_USE` dock checked, drop it, and resubmit with the remaining checked (now-eligible)
   docks. Confirm the resubmission succeeds and does not re-report or re-archive the docks already
   archived in scenario 7. *(US2 AC6; FR-018)*

9. **Invalid selection requests rejected outright.** Via the API contract directly: submit an empty
   `ids` array, a duplicate id (including one differing only by case), and a malformed (non-UUID)
   id. Confirm each is a 422 with zero docks changed — not a partial archive, not a silently
   de-duplicated request. *(US3 AC1, AC2; FR-004, FR-005; SC-004)*

10. **Authorization guards, individual and bulk.** As the Observer, attempt both the individual
    archive action and (via the API contract) the bulk endpoint. Confirm both are refused as
    unauthorized with no dock changed and neither action offered in the interface. Repeat
    unauthenticated against the API directly: confirm 401. *(US3 AC3; FR-003; SC-005)*

11. **Concurrency: overlapping bulk requests.** Submit two bulk archive requests for overlapping
    dock sets at nearly the same time (via two concurrent API calls). Confirm exactly one request
    archives the shared dock and the other reports it as `ALREADY_ARCHIVED`, never archiving it
    twice. *(FR-016; SC-006)*

12. **Selection filtering discipline.** In select mode, check a few docks, then change the search
    text or the status filter so one checked dock scrolls out of view. Confirm the selection bar's
    count drops to match what remains visible/eligible, mirroring the customer table's
    filtered-selection behavior. *(consistency with `customers-page.tsx`'s
    `visibleSelectedCustomerIds`)*

13. **History and references preserved.** After archiving a dock referenced by a Closed discharge
    (historical usage only), confirm the archive succeeds, the discharge's historical reference to
    the dock still resolves and displays the dock's name, and the dock's own detail history remains
    fully readable. *(FR-015; SC-007; edge case)*

14. **Scale check.** Via the API contract, submit a bulk archive of 100 distinct eligible dock ids.
    Confirm the request completes within 5 seconds and every one of the 100 ids appears in exactly
    one of `updatedDocks` or `blockedDocks`. *(SC-009)*

15. **Regression guard — existing map flows unaffected.** With `selecting` absent, re-run #197's
    view flow and #199's edit flow end to end: select a dock, confirm details open as before; edit
    its name/position, confirm the save still works exactly as #199 documented. Confirm neither flow
    ever shows a `selecting` param or select-mode styling. *(Guards the `checkpoint-marker.tsx` /
    `checkpoint-map.tsx` changes — research D4)*

## Expected outcomes

- Scenarios 2, 3, 6, and 8 succeed with archived docks visible in their new state within ~2 seconds
  and no manual reload *(SC-001)*.
- Scenarios 4, 7, 9, and 10 all refuse or partially apply with a **distinct**, per-dock reason where
  applicable, and leave every non-eligible dock byte-for-byte unchanged *(SC-003, SC-004, SC-005)*.
- Scenario 11 never produces two archives of the same dock, under any interleaving *(SC-006)*.
- Scenario 14 completes inside the stated performance budget *(SC-009)*.
- Scenario 15 proves the pre-existing single-selection map behavior is bit-for-bit unaffected by
  this feature's additions.

## API-only spot checks

The bulk-endpoint rows and the individual not-found row in
[dock-archive-api.md](./contracts/dock-archive-api.md#requirement-to-test-mapping) are this slice's
core backend work and are verified by the Japa suite rather than by hand, but can be exercised
directly while the app runs — for example, `POST /api/v1/docks/archive` with `{ "ids": [] }` should
return `422 E_VALIDATION_ERROR`, and a mixed-eligibility bulk request should return `200` with both
`updatedDocks` and `blockedDocks` populated, never a 4xx for the request as a whole.
