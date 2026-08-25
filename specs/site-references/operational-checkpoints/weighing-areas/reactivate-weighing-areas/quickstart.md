# Phase 1 Quickstart: Validate Reactivate Weighing Areas

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Contracts**: [weighing-area-reactivate-api.md](./contracts/weighing-area-reactivate-api.md),
[weighing-area-reactivate-ui-state.md](./contracts/weighing-area-reactivate-ui-state.md)

## Prerequisites

- A Node.js version compatible with the workspace dependencies and PNPM 10.28.1
- PostgreSQL configured for the API development environment
- Dependencies installed with `pnpm install`
- An active organization administrator account, an active operations administrator account, a
  second active account without weighing-area administration rights (e.g. an Observer), and one
  account whose access is not active
- At least five **archived** weighing-area fixtures for the bulk scenarios, one available weighing
  area, and one weighing area that was archived while carrying recorded weighings and a closed
  discharge's ended shift membership (so FR-012 can be checked against real historical references)
- Deployment-approved MapLibre style URLs configured
  (`VITE_MAP_STYLE_LIGHT_URL` / `VITE_MAP_STYLE_DARK_URL`) so the Checkpoints map renders

## Start the application

From the repository root:

```bash
pnpm --filter @portflow/api db:fresh
pnpm dev
```

Authenticate as an authorized administrator and open `/checkpoints?status=archived` (or set the
status filter to **Archived** or **All** in the map controls — archived weighing areas are hidden
under the default `available` filter).

## Automated checks

```bash
pnpm --filter @portflow/api test    # Japa — weighing-area lifecycle + new bulk-reactivate specs
pnpm --filter @portflow/web test    # Vitest — individual reactivate + bulk-reactivate select mode
pnpm typecheck && pnpm check
```

## End-to-end validation scenarios

Scenarios 1–16 validate this feature. Scenarios 17 and 18 are regression guards on flows #205 and
#201 delivered, which this feature's changes must not disturb.

### Individual reactivation

1. **Reactivate one archived weighing area** (FR-001, FR-006, FR-009, FR-013) — Open an archived
   weighing area's marker. The sheet footer shows `Reactivate weighing area` and **no** Edit
   button. Confirm without a comment. Expect: a `Weighing area reactivated` toast, the marker
   rendered as available, and the sheet showing an unchanged name, latitude, longitude, and created
   time, with a `Reactivated` timestamp filled in.

2. **Reactivate with a comment, archive context preserved** (FR-007, FR-010, US1 scenario 5) —
   Reactivate an archived weighing area that carries an archive comment, supplying
   `Back in service after calibration`. Expect: the sheet's Lifecycle section shows both the
   original `Archived` timestamp and `Archive comment` **and** the new `Reactivated` timestamp and
   `Reactivation comment`.

3. **Whitespace-only comment is no comment** (FR-007) — Reactivate with a comment of only spaces.
   Expect: success, and `Reactivation comment` renders as empty rather than as a blank string.

4. **Over-long comment is refused and recoverable** (FR-008, FR-034, US3 scenario 3) — Paste 1,001
   characters into the comment field. Expect: an error toast naming the field-level reason, the
   dialog **still open** with the typed comment intact, and the weighing area still archived.
   Shorten the comment, resubmit, and expect success without reopening the weighing area.

5. **Cancel changes nothing** (FR-014, US1 scenario 7) — Open the reactivation dialog, type a
   comment, then Cancel. Expect: the weighing area is still archived with its lifecycle context
   untouched.

6. **Returns to the operational selection** (FR-011) — After scenario 1, staff a shift or start a
   weighing that offers weighing areas. Expect: the reactivated weighing area is offered again.

7. **Historical references intact** (FR-012) — Using the fixture with recorded weighings and a
   closed discharge's ended shift membership, reactivate it and re-open those records. Expect: they
   still reference the same weighing area and are unchanged.

8. **Non-administrator sees no action** (FR-002, FR-018) — Sign in as the Observer account and open
   the same archived weighing area. Expect: no footer, no reactivate action. Repeat with the
   non-active account. Expect: denied, with nothing disclosed.

### Multiple reactivation

9. **Reactivate a homogeneous selection** (FR-020, FR-025, US2 scenarios 1–2) — Enter
   `Select weighing areas` mode with the status filter on Archived, check five archived weighing
   areas, supply one comment, and confirm. Expect: a `5 weighing areas reactivated` toast, all five
   available on the map without a manual reload, and all five carrying the same reactivation time,
   administrator, and comment when opened.

10. **Selection stays homogeneous** (FR-031, data-model "Selection Intent") — With the status
    filter on All, check one archived weighing area first. Expect: available weighing-area markers
    become uncheckable while the selection stands, and the toolbar reads `Reactivate selected`.
    Clear the selection and expect both statuses checkable again.

11. **Partial success on a mixed selection** (FR-023, FR-024, US2 scenarios 3–4) — Build a
    selection of archived weighing areas, then have a second administrator reactivate one of them
    before you submit. Expect: the rest are reactivated, that one is reported `already available`
    by name, and it keeps its original reactivation context. Repeat by calling the endpoint
    directly with a well-formed identifier for a deleted-from-view weighing area to see
    `not found`.

12. **All-blocked selection** (US2 scenario 5) — Submit a selection whose entries have all become
    available. Expect: a `0 weighing areas reactivated; N unchanged` toast listing each reason, and
    no lifecycle change anywhere — not an error.

13. **Invalid submissions are rejected whole** (FR-028) — Against the API directly, submit
    `{"ids": []}`, then a body repeating one identifier, then one carrying `not-a-uuid`. Expect:
    422 for each, and zero weighing areas changed in every case.

14. **Selection is cleared after a submission** (FR-030, research D5) — After scenario 11, expect
    the selection to be empty rather than retaining the blocked entries. Re-select the remaining
    archived weighing areas and resubmit. Expect: success, with the already-reactivated ones
    neither re-attempted nor re-reported.

15. **Scope and search behave differently** (FR-031, US2 scenario 8) — With entries checked, type a
    search term that hides one of them. Expect: it stays in the count. Then switch the status filter
    to Available or the resource-kind filter to Docks. Expect: the hidden-by-scope entries leave the
    selection.

16. **Ctrl/Cmd+A and permissions** (FR-030, FR-032) — With the status filter on Archived and only
    weighing areas visible, press Ctrl/Cmd+A outside a text field. Expect: every visible archived
    weighing area is checked and the toolbar reads `Reactivate selected`. Sign in as the Observer
    and expect no select mode, no toolbar, and no keyboard selection.

### Regression guards

17. **#205's bulk archive is unchanged** (FR-033) — With the status filter on Available, select
    several weighing areas and archive them. Expect: the destructive button variant, the archive
    wording, `IN_USE` blockers still reported, and blocked `IN_USE` entries **still kept checked**
    for retry — the archive path's behavior, not the reactivate path's.

18. **#201's dock bulk reactivate is unchanged** (FR-033) — Repeat scenarios 9 and 11 against
    docks. Expect: identical wording, identical outcome reporting, and identical selection
    clearing.

## Notes

- Scenarios 11 and 12 need a second browser session, or a direct API call, to create the staleness
  the map cannot produce on its own — a selection built on the map is homogeneous and current by
  construction, so mixed outcomes arise only from concurrency or direct requests.
- Scenario 4 is the one scenario that exercises a **change to already-shipped behavior**: an
  over-long reactivation comment is accepted today and refused after this slice (research D2). If
  plan review rejects that change, scenario 4 and the FR-008 individual row in the API contract's
  coverage table both drop out.
- The archived status filter is the only way to reach archived weighing areas on the map; there is
  no separate archived list page, and this feature adds none.
