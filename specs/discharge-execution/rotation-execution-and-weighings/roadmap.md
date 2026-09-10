# Roadmap: Rotation Execution and Weighings

**GitHub Issue**: [#81](https://github.com/whazzark/portflow-ai/issues/81)
**Domain**: discharge-execution
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

The rows are ordered by execution order. Blockers are recorded as GitHub issue dependencies; the
`Blocked by` column repeats only the direct ones, since GitHub resolves the transitive ones.

| ID | Sub-feature | Blocked by | Status | Artifact |
|---|---|---|---|---|
| GH-82 | Start and Inspect an In Progress Rotation | GH-65 | planned | ./start-and-inspect-an-in-progress-rotation/ |
| GH-83 | Record Loaded Reweighings and Resolve Capacity Exceedances | GH-82 | planned | ./record-loaded-reweighings-and-resolve-capacity-exceedances/ |
| GH-84 | Complete or Continue from Empty Return Confirmation | GH-83 | planned | ./complete-or-continue-from-empty-return-confirmation/ |
| GH-85 | Correct and Cancel Unvalidated Rotations | GH-84 | planned | ./correct-and-cancel-unvalidated-rotations/ |

The four slices follow the rotation itself, from its empty weighing to its empty return, so this
roadmap is a chain with nothing to run in parallel.

## Cross-cutting context

Each slice is a vertical one: it owns its command in `apps/api` and the matching entry in the shift
workspace of `apps/web`, so that it stays independently deliverable as one issue, one feature
directory, one branch, and one PR. The roadmap previously carried two frontend-only slices, GH-86
and GH-87. They were merged on 2026-09-10 and closed on GitHub, so the table below is the only
remaining record of that split:

| Merged into | Absorbed frontend slice | Outcome |
|---|---|---|
| GH-82 | Start a Rotation and Record the Empty Weighing in the Shift Workspace | Opening a rotation on its empty weighing |
| GH-83 | Record Loaded Weighing and Confirm Empty Return in the Workspace (loaded weighing part) | Weighing a loaded truck and resolving an exceedance |
| GH-84 | Record Loaded Weighing and Confirm Empty Return in the Workspace (empty return part) | Confirming the empty return, with or without continuation |

No rotation or weighing table has ever been migrated. GH-238, which was to persist and seed them,
was closed as not planned because it was a horizontal slice, and the persistence moved into these
slices. Its closing comment records the invariants that a shared data-model design pass must settle
before the first of them is specified.

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/81
- Child issue relationships are read from GitHub sub-issues, and the blockers above from the
  GitHub issue dependencies of the same children.
- Each child owns an independently reviewable roadmap or feature spec.
