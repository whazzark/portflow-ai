# Quickstart: Validate the Transport resources V2

**Feature**: [spec.md](./spec.md)

## Automated checks

```bash
pnpm --filter @portflow/web test -- src/features/transport-resources
pnpm --filter @portflow/web test -- src/features/trucks src/features/transport-companies
pnpm check
pnpm typecheck
pnpm test
```

Expected: all green; `fleet-view.test.ts` covers the rules in [data-model.md](./data-model.md);
the story suites cover [contracts/ui-contract.md](./contracts/ui-contract.md).

## Manual walkthrough (side by side with the *Retenue* artboards)

Prerequisite: API and web running with seeded data (`pnpm dev`), sign in as an organization or
operations administrator, then as an operations lead (non-administrator).

| # | Steps | Expected (artboard) |
|---|---|---|
| 1 | Open `/transport-resources` | Grouped table, Available + Suspended pressed, counts (*Transport resources*) |
| 2 | Press only Suspended | Suspended trucks only (*Camions suspendus*) |
| 3 | Press only Archived | Archived companies and trucks, notice (*Archivés*) |
| 4 | Click a company name | Filter banner, one group (*Filtre par compagnie*) |
| 5 | Search `ZZ-999` | No-match state, Clear search, Include archived (*Aucun résultat*) |
| 6 | Open a truck menu / company menu | Menu items as drawn (*Menu ⋮ camion*, *Menu ⋮ compagnie*) |
| 7 | Click a suspended truck | Inline detail with History (*Détail camion*) |
| 8 | Company menu → View details | Inline company detail, Archive explained (*Détail compagnie*) |
| 9 | Create → Transport company; save | Inline row, then empty group (*Create transport company*) |
| 10 | Company menu → Add truck; save | Inline row "Added to …" (*Create truck*) |
| 11 | Truck menu → Edit; change model; save. Then change the company of a truck used by a planned discharge | Inline edit; refusal shown on the company field (*Edit truck*) |
| 12 | Suspend an available truck | Dialog, then toast "It stays in its current discharges." (*Suspend truck*, *Suspension confirmée*) |
| 13 | Return the suspended truck to service; archive an available truck | Dialogs as drawn (*Return to service*, *Archive truck*) |
| 14 | Reload on any of the above | Same view restored |
| 15 | Sign in as non-administrator | No create/edit/lifecycle controls; Archived shows companies only; no actor names on trucks (*Lecture seule*) |
| 16 | User menu → Light | Every state above legible in light (*Thème clair*) |
| 17 | Open `/transport-companies?status=archived` | Redirected with Archived pressed |
| 18 | Narrow the window to phone width | Table scrolls inside its frame, toolbar wraps |
