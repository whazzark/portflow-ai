# Quickstart: Validate the Full-Screen Warehouses Map

## Automated

```bash
pnpm --filter @portflow/web test -- src/features/warehouses src/features/warehouse-doors src/components/resource-map src/components/lifecycle
pnpm check
pnpm typecheck
pnpm test
```

Expected: the new unit tests (search, pills mapping, centre, edit history, copy) and the
per-story feature tests pass, and every pre-existing warehouse and door test still passes
(SC-004).

## Manual browser journeys

Prerequisites: API and database running with seeded warehouses (at least one archived, one with
archived and available doors, one whose door is used by a planned discharge),
`VITE_MAP_STYLE_LIGHT_URL` and `VITE_MAP_STYLE_DARK_URL` set, web dev server running. Sign in once
as an administrator and once as an operator.

Run each in the dark theme, then repeat 1, 2, 4, and 7 in the light theme and at 375 px width.

1. **Consult** — open `/warehouses`: map fills the content area; toolbar, pills with counts,
   legend, Zoom in/out/Fit all. Select a warehouse: card beside its outline with footprint
   summary, centre copy, doors, timestamps. Select a door: it is highlighted. Escape closes.
2. **Search** — type a door name: grouped results; Enter on the door opens its warehouse and
   highlights it. Type `zzz`: no-match panel; `Include archived` then `Clear search`.
3. **Draw** — `Create warehouse`: banner, `New warehouse` card; place 4 points, `Remove last
   point`, close the outline, name it, create. Repeat and `Cancel`.
4. **Edit outline** — `Edit`: handles, dashed previous outline; drag a point, add a midpoint,
   `Undo`, save. Try moving a point so a door falls outside: refused.
5. **Doors** — `Create door`: click inside, drag the pin, create; click outside: refused. Door
   menu: `Show on map`, `Copy coordinates`, `Edit` (drag pin, save), `Archive`, `Reactivate`.
6. **Archive** — `Archive` on the warehouse whose door is in use: refused. On another: dialog
   copy, confirm, toast, `View` → archived card with `Reactivate`; reactivate it.
7. **Operator** — as an operator: no Create/Edit/Archive/Reactivate anywhere; door menu offers
   only `Show on map` and `Copy coordinates`.

Compare each state with the matching *Retenue* board of the design reference (SC-006).
