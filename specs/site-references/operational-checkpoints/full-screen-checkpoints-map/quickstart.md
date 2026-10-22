# Quickstart: Full-screen Checkpoints map

**Feature**: [spec.md](./spec.md) | **Contract**: [contracts/ui-state.md](./contracts/ui-state.md)

## Prerequisites

- Branch `feat/320-full-screen-checkpoints-map`, dependencies installed (`pnpm install`).
- Local API and database running with the seeded site references (docks and weighing areas, some
  archived), and an administrator account from the seed.
- `apps/web/.env` with `VITE_MAP_STYLE_LIGHT_URL` and `VITE_MAP_STYLE_DARK_URL` set, so the basemap
  renders (without them the map-unavailable state is shown instead).

## Automated checks

```bash
pnpm check
```

```bash
pnpm typecheck
```

```bash
pnpm --filter @portflow/web test -- src/features/checkpoints src/components/resource-map src/components/lifecycle
```

```bash
pnpm test
```

Expected: all green. Feature tests under `apps/web/src/features/checkpoints/__tests__/` cover the
toolbar, search suggestions and no-match state, detail cards, placement, move edit, archive dialog
and View toast, archived view, and bulk select mode (see the contract for names and copy).

## Browser walkthrough (administrator)

Start the web app and API (`pnpm dev`), sign in as the seeded administrator, open `/checkpoints`.

1. **Map and toolbar** — the map fills the area under the header; toolbar shows Docks, Weighing
   areas, Available (on), Archived (off) with counts; legend and Zoom in / Zoom out / Fit all are
   visible. Toggle Weighing areas off and reload: the filter persists.
2. **Search** — type part of a name: suggestions list matches with highlight and kind, footer shows
   "<n> of <total> …". Arrow down + Enter on an option: the map centers and the card opens. Clear,
   type again, press Enter: the map fits all matches. Type a nonsense string: the no-match state
   offers Clear search and Include archived.
3. **Detail card** — select a dock: the card sits beside the marker, shows GPS location, Copy
   coordinates works, Updated/created line, Edit and Archive. Pan the marker toward an edge: the card
   stays fully visible. Escape closes it.
4. **Create** — Create → New dock: banner replaces the toolbar; click the map, drag the pin, enter a
   name, Create dock: the dock is selected and a toast confirms. Repeat with New weighing area and
   Cancel: nothing is created.
5. **Move edit** — on a dock card, Edit: banner "Drag the pin to move …", ghost previous position,
   drag and Save changes; then Edit again and Cancel: the pin returns.
6. **Archive / reactivate** — Archive on an available dock without an active discharge: dialog
   "Archive <name>?", confirm; toast "<name> archived" → View opens its archived card; Reactivate
   returns it to Available. Try archiving a dock serving an active discharge: dialog stays open with
   the refusal reason.
7. **Bulk** — Select → Select docks: banner and bulk bar; check several docks, Archive with a
   comment; a refused in-use dock stays checked. Done leaves select mode.
8. **Light theme** — switch the theme from the user menu and repeat steps 1, 3 and 6: light basemap,
   legible overlays.
9. **Narrow viewport** — at 390 px wide, the toolbar wraps and cards dock to the bottom of the map.

## Accessibility pass

Run the browser accessibility audit (axe, via the in-app browser or Playwright) on the map, an open
detail card, placement mode and the archive dialog in both themes: no serious or critical issue
(SC-006). Navigate the toolbar, suggestions, a marker and the card with the keyboard only.
