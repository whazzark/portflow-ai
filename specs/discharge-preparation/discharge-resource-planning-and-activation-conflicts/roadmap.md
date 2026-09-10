# Roadmap: Discharge Resource Planning and Activation Conflicts

**GitHub Issue**: [#52](https://github.com/whazzark/portflow-ai/issues/52)
**Domain**: discharge-preparation
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

| ID | Sub-feature | Status | Artifact |
|---|---|---|---|
| GH-53 | Prepare a planned discharge with its product lots and shifts | planned | ./prepare-a-discharge-with-product-lots-and-shifts/ |
| GH-54 | Plan warehouse door and checkpoint assignments | planned | ./plan-warehouse-door-and-checkpoint-assignments/ |
| GH-55 | Plan the discharge truck pool and shift subsets | planned | ./plan-the-discharge-truck-pool-and-shift-subsets/ |
| GH-56 | Confirm discharge start with conflict protection and handling | planned | ./confirm-discharge-start-with-atomic-conflict-protection/ |
| GH-58 | Consult a Prepared Discharge in the Web Workbench | planned | ./consult-a-prepared-discharge-in-the-web-workbench/ |
| GH-61 | Browse the Discharges List in the Web Workbench | planned | ./browse-the-discharges-list-in-the-web-workbench/ |

## Cross-cutting context

Each slice is a vertical one: it owns its command or query in `apps/api` and the matching screen in
`apps/web`, so that it stays independently deliverable as one issue, one feature directory, one
branch, and one PR. The roadmap previously split the same outcomes into a backend slice and a
frontend slice. Those pairs were merged on 2026-09-10, and the absorbed frontend issues were
deleted from GitHub, so the table below is the only remaining record of that merge:

| Merged into | Absorbed frontend slice | Outcome |
|---|---|---|
| GH-53 | Create a Planned Discharge From the Frontend | Preparing a discharge, its product lots and its shifts |
| GH-54 | Update Discharge Resource Planning From the Frontend (warehouse door and checkpoint half) | Assigning warehouse doors and checkpoints |
| GH-55 | Update Discharge Resource Planning From the Frontend (truck pool half) | Planning the truck pool and its per-shift subsets |
| GH-56 | Confirm Discharge Start With Visible Conflict Handling | Confirming the start under a single conflict taxonomy |

GH-58 and GH-61 are read slices on the already delivered read model. They belong to milestone
`3. Exploiter le modèle en lecture`, have no backend counterpart in this roadmap, and were left
untouched.

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/52
- Child issue relationships are read from GitHub sub-issues. The three absorbed frontend issues
  listed above no longer exist on GitHub; their scope is recorded in the absorbing spec.
- Each child owns an independently reviewable roadmap or feature spec.
