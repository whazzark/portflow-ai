# Roadmap: Invitation Administration

**GitHub Issue**: [#11](https://github.com/whazzark/portflow-ai/issues/11)
**Domain**: user-administration
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

The rows are ordered by execution order. Blockers are recorded as GitHub issue dependencies; the
`Blocked by` column repeats only the direct ones, since GitHub resolves the transitive ones.

| ID | Sub-feature | Blocked by | Status | Artifact |
|---|---|---|---|---|
| GH-12 | Cancel a Pending Invitation | GH-7 | planned | ./cancel-a-pending-invitation/ |
| GH-14 | Remove a Never-Activated User Permanently | GH-7 | planned | ./remove-a-never-activated-user-permanently/ |
| GH-13 | Restore a Cancelled Invitation with a New Activation Link | GH-9, GH-12 | planned | ./restore-a-cancelled-invitation-with-a-new-activation-link/ |

GH-12 and GH-14 are the only pair that can be delivered in parallel. Both act on the pending user
GH-7 creates, in the same workbench, but neither blocks the other.

## Cross-cutting context

Each slice is a vertical one: it owns its command in `apps/api` and the matching action in the user
workbench of `apps/web`, so that it stays independently deliverable as one issue, one feature
directory, one branch, and one PR. The roadmap previously carried a frontend-only slice, GH-15,
covering the whole invitation lifecycle at once. It was merged on 2026-09-10 and deleted from
GitHub, so the table below is the only remaining record of that split:

| Merged into | Absorbed frontend slice | Outcome |
|---|---|---|
| GH-12 | Manage Invitation Lifecycle From the Web Workbench (cancellation part) | Withdrawing access before activation |
| GH-13 | Manage Invitation Lifecycle From the Web Workbench (restoration part) | Making a cancelled invitation pending again |
| GH-14 | Manage Invitation Lifecycle From the Web Workbench (removal part) | Removing a never-activated user permanently |
| GH-9 | Manage Invitation Lifecycle From the Web Workbench (renewal part) | Replacing the activation link of a pending user |

GH-9 belongs to the GH-6 roadmap: the renewal action shares that slice's outcome rather than this
roadmap's, and its spec records the absorbed scope.

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/11
- Child issue relationships are read from GitHub sub-issues, and the blockers above from the
  GitHub issue dependencies of the same children.
- Each child owns an independently reviewable roadmap or feature spec.
