# Quickstart: Validate List Weighing Areas

## Prerequisites

- Work on `feat/202-list-weighing-areas`, never `master`.
- Install the pinned workspace dependencies with `pnpm install` if needed.
- Configure the API and web development environments according to the repository README.
- Apply existing migrations and seed or create an active organization/operations administrator plus
  representative available and archived weighing areas.

The intended persistence, HTTP, and merged UI shapes are documented in
[data-model.md](./data-model.md),
[contracts/weighing-areas.openapi.yaml](./contracts/weighing-areas.openapi.yaml), and
[contracts/checkpoint-ui-state.md](./contracts/checkpoint-ui-state.md).

## Automated validation

Run the feature's API and web tests during RED → GREEN → REFACTOR, then run all required
delivery gates:

```bash
pnpm --filter @portflow/api test
pnpm --filter @portflow/web test
pnpm check
pnpm typecheck
pnpm test
```

Expected results:

- API tests prove unauthenticated and non-administrator collection denial, both administrator-role
  successes, available/archived inclusion, deterministic mixed-case ordering, empty collection,
  complete detail fields in the collection, and removal of the redundant show route.
- Web tests extend the existing Checkpoint router/providers and use MSW to prove combined Dock and
  Weighing Area markers, shared URL-backed status/search, typed weighing-area selection, legend and
  accessible marker semantics, resource-specific empty states, collection-backed coordinates and
  archived detail, stale-selection cleanup, source-specific collection retry that preserves Dock
  interaction, refreshed status without duplicates, and usable markers during basemap failure.
- Formatting/lint, typechecking, and the complete fast test suite pass.

## Manual affected browser flow

Start both workspaces:

```bash
pnpm dev
```

Then validate in a desktop and narrow mobile viewport:

1. Sign in as an organization administrator and open **Checkpoints**.
2. Confirm Dock and Weighing Area markers coexist on the full-area map, use distinct symbols, expose
   kind/status in accessible labels and tooltips, and appear together in the legend.
3. Switch among All, Available, and Archived; refresh and use browser back/forward to confirm the
   shared status URL state is restored for both resource kinds.
4. Search for a weighing-area name and confirm it is emphasized while nonmatches retain spatial
   context; clear the search and confirm every admitted checkpoint returns to normal emphasis.
5. Open an available weighing area and verify name, Available status, latitude, and longitude;
   repeat for an archived area and confirm Archived is explicit.
6. Copy a URL containing `checkpoint=weighing-area:<id>`, open it in another tab, and confirm the
   selected detail is restored without affecting Dock selection behavior.
7. Request a nonexistent or status-excluded weighing-area selection; confirm the sheet stays closed,
   `checkpoint` is removed from the URL, and no other resource is substituted.
8. With no weighing areas, then with no weighing areas in one selected status, confirm the
   resource-specific empty feedback remains visible even while docks keep the map populated.
9. Simulate a weighing-area collection failure, confirm Dock markers remain usable, choose **Try
   again**, and confirm current Weighing Area markers join the map. Separately fail the basemap and
   confirm both marker kinds and detail interactions remain usable.
10. Sign in as an observer or operations lead. Confirm Checkpoints navigation is absent and a direct
    collection URL is denied without rendering weighing-area data.

## Delivery review

After the automated and browser checks, obtain the constitution-required fresh read-only Codex
review of the final diff, resolve every confirmed finding, and leave human product approval and
merge to the repository's normal PR workflow.
