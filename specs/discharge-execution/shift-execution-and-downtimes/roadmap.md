# Roadmap: Shift Execution and Downtimes

**GitHub Issue**: [#62](https://github.com/whazzark/portflow-ai/issues/62)
**Domain**: discharge-execution
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

The rows are ordered by execution order. Blockers are recorded as GitHub issue dependencies; the
`Blocked by` column repeats only the direct ones, since GitHub resolves the transitive ones.

| ID | Sub-feature | Blocked by | Status | Artifact |
|---|---|---|---|---|
| GH-63 | Create and Inspect Planned Shifts | GH-53 | planned | ./create-and-inspect-planned-shifts/ |
| GH-64 | Replan, Order, and Remove Future Shifts | GH-63 | planned | ./replan-order-and-remove-future-shifts/ |
| GH-65 | Start the First Shift and Activate the Discharge | GH-56, GH-63 | planned | ./start-the-first-shift-and-activate-the-discharge/ |
| GH-66 | Protect and Reassign Shift Responsibility | GH-63 | planned | ./protect-and-reassign-shift-responsibility/ |
| GH-67 | Start and Complete Shift Downtimes | GH-65 | planned | ./start-and-complete-shift-downtimes/ |
| GH-68 | Complete Shifts Safely | GH-67 | planned | ./complete-shifts-safely/ |
| GH-69 | Start the Next Shift after Handover | GH-68 | planned | ./start-the-next-shift-after-handover/ |
| GH-70 | Correct Shift Actual Times | GH-68 | planned | ./correct-shift-actual-times/ |
| GH-71 | Correct and Cancel Shift Downtimes | GH-67 | planned | ./correct-and-cancel-shift-downtimes/ |

Three groups can be delivered in parallel: GH-64, GH-65 and GH-66 once GH-63 exists; GH-68 and
GH-71 once GH-67 exists; GH-69 and GH-70 once GH-68 exists. Every parallel group works on the
same shift workspace, so expect neighbouring files even where nothing blocks.

## Cross-cutting context

Each slice is a vertical one: it owns its command in `apps/api` and the matching screen or action in
the shift workspace of `apps/web`, so that it stays independently deliverable as one issue, one
feature directory, one branch, and one PR. The roadmap previously carried two frontend-only slices,
GH-72 and GH-73, each covering several outcomes at once. They were merged on 2026-09-10 and closed
on GitHub, so the table below is the only remaining record of that split:

| Merged into | Absorbed frontend slice | Outcome |
|---|---|---|
| GH-65 | Shift Workspace: Start, Live View, and Completion (workspace and start parts) | Starting the first shift and following it live |
| GH-68 | Shift Workspace: Start, Live View, and Completion (completion part) | Completing a shift safely |
| GH-67 | Downtime Recording and Shift/Downtime Corrections (recording part) | Starting and completing a downtime |
| GH-70 | Downtime Recording and Shift/Downtime Corrections (shift time correction part) | Correcting the actual times of a shift |
| GH-71 | Downtime Recording and Shift/Downtime Corrections (downtime correction part) | Correcting and cancelling a downtime |

GH-65 and GH-56 of the GH-52 roadmap describe the same atomic activation from two sides, the shift
and the discharge. They are kept as two issues for now, and GH-65 depends on GH-56.

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/62
- Child issue relationships are read from GitHub sub-issues, and the blockers above from the
  GitHub issue dependencies of the same children.
- Each child owns an independently reviewable roadmap or feature spec.
