# Quickstart: validate the Customers V2 restyle

## Prerequisites

- Worktree on `feat/318-restyle-customers-workbench`, `pnpm install` done.
- Local API and database running with seed data (see the repository README), including at least:
  one administrator and one Observer account, several available customers (one reactivated with a
  comment), two archived customers, and one available customer used by a planned discharge.

## Automated checks

```bash
pnpm --filter @portflow/web test -- src/features/customers
pnpm check
pnpm typecheck
pnpm test
```

Expected: all green, including the untouched suites of checkpoints, docks, trucks, warehouses,
warehouse doors, weighing areas, transport companies and transport resources (they share the
lifecycle components and must not need edits).

## Browser walk-through (both themes)

Start the web and API dev servers, sign in, open `/customers`. Repeat the whole list in dark, then
switch to light from the user menu. Compare each state with the matching *Retenue* board on the
canvas page **Site references · Customers**, and with
[contracts/customers-workbench-ui.md](contracts/customers-workbench-ui.md) for copy and names.

As an administrator:

1. **Lists** — Available and Archived tabs with counts; columns per tab; lifecycle cells with
   actor chip and short date or "—"; sort a column and reload: sort survives.
2. **No match** — search a term that only matches an archived customer: no-match panel with the
   cross-tab count; "Show archived" switches tab and keeps the term; "Clear search" empties it.
   Search a lifecycle comment fragment: the customer is found.
3. **Row menu** — available row: View, Edit, separator, Archive; archived row: View, Reactivate.
4. **Detail** — open a reactivated customer: summary and History (Reactivated, then Archived);
   open an archived customer: Reactivate only; open `?customerId=unknown&mode=view`: unable to load.
5. **Create** — submit an existing code: field error "Already used by …", values kept; submit a
   new one: toast, sheet shows the new customer's detail; "Cancel" closes the sheet.
6. **Edit** — subtitle "{company} · {code}", code hint, "Save changes" returns to detail with a
   toast; "Cancel" returns to detail without saving.
7. **Archive / reactivate** — archive from the row menu with a comment: V2 dialog copy and
   placeholder, toast "Customer “…” archived", counts update; reactivate from the archived detail.
   Archive the customer used by a planned discharge: refusal toast, it stays available.
8. **Bulk** — select three available customers including the one in use: V2 bar ("3 selected",
   "Archive", "Clear"); dialog lists the three, confirm reads "Archive 3 customers"; result toast
   reports 2 archived and names the skipped one with its reason; selection narrows to it.
   Change tab: selection clears.

As the Observer:

9. **Read-only** — no Create, no checkboxes, no Actions column, detail without footer;
   `?mode=create` and `?customerId=…&mode=edit` open no form.

Also check at a narrow width (≈ 390px): toolbar stacks, table scrolls inside its frame, sheet is
full width, bulk bar fits.
