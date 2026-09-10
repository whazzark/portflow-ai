# Roadmap: Runtime Discharge Resource Changes

**GitHub Issue**: [#74](https://github.com/whazzark/portflow-ai/issues/74)
**Domain**: discharge-execution
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

The rows are ordered by execution order. Blockers are recorded as GitHub issue dependencies; the
`Blocked by` column repeats only the direct ones, since GitHub resolves the transitive ones.

| ID | Sub-feature | Blocked by | Status | Artifact |
|---|---|---|---|---|
| GH-75 | Reassign an Active Discharge Dock | GH-65 | planned | ./reassign-an-active-discharge-dock/ |
| GH-76 | Assign and Release Trucks During an Active Discharge | GH-65 | planned | ./assign-and-release-trucks-during-an-active-discharge/ |
| GH-77 | Change Effective Warehouse Door Assignments | GH-65 | planned | ./change-effective-warehouse-door-assignments/ |
| GH-78 | Adjust Active Shift Resources | GH-65 | planned | ./adjust-active-shift-resources/ |

The four slices share one blocker and none of them blocks another, so the whole roadmap can be
delivered in parallel once a discharge is active. GH-75, GH-76 and GH-77 each add a panel to the
discharge detail workbench, so expect neighbouring files there.

## Cross-cutting context

Each slice is a vertical one: it owns its command in `apps/api` and the matching panel in the
discharge detail workbench or the shift workspace of `apps/web`, so that it stays independently
deliverable as one issue, one feature directory, one branch, and one PR. The roadmap previously
carried two frontend-only slices, GH-79 and GH-80. They were merged on 2026-09-10 and closed on
GitHub, so the table below is the only remaining record of that split:

| Merged into | Absorbed frontend slice | Outcome |
|---|---|---|
| GH-75 | Discharge Detail: Dock, Truck Pool, and Door Changes (dock part) | Moving an active discharge to another dock |
| GH-76 | Discharge Detail: Dock, Truck Pool, and Door Changes (truck pool part) | Assigning and releasing trucks at runtime |
| GH-77 | Discharge Detail: Dock, Truck Pool, and Door Changes (door part) | Changing an effective warehouse door assignment |
| GH-78 | Shift Resource Adjustments in the Shift Workspace | Adjusting the resources of an active shift |

The discharge detail workbench itself belongs to GH-58 and the shift workspace to GH-65; these
slices only add their own panels to them.

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/74
- Child issue relationships are read from GitHub sub-issues, and the blockers above from the
  GitHub issue dependencies of the same children.
- Each child owns an independently reviewable roadmap or feature spec.
