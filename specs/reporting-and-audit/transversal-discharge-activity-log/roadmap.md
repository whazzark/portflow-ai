# Roadmap: Transversal Discharge Activity Log

**GitHub Issue**: [#101](https://github.com/whazzark/portflow-ai/issues/101)
**Domain**: reporting-and-audit
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

The rows are ordered by execution order. Blockers are recorded as GitHub issue dependencies; the
`Blocked by` column repeats only the direct ones, since GitHub resolves the transitive ones.

| ID | Sub-feature | Blocked by | Status | Artifact |
|---|---|---|---|---|
| GH-102 | Establish the Typed Activity Log Append Contract | GH-53 | planned | ./establish-the-typed-activity-log-append-contract/ |
| GH-103 | Browse a Filtered Discharge Activity Log | GH-102 | planned | ./browse-a-filtered-discharge-activity-log/ |

The two slices are a chain, so nothing here can be run in parallel. GH-102 is transversal: every
command of the backlog appends through it, so it is worth delivering as soon as GH-53 exists
rather than at the end, when the commands written meanwhile would have to be retrofitted.

## Cross-cutting context

Each slice is a vertical one: it owns its contract or query in `apps/api` and the matching tab in
the discharge detail workbench of `apps/web`, so that it stays independently deliverable as one
issue, one feature directory, one branch, and one PR. The roadmap previously carried a frontend-only
slice, GH-104. It was merged on 2026-09-10 and closed on GitHub, so the table below is the only
remaining record of that split:

| Merged into | Absorbed frontend slice | Outcome |
|---|---|---|
| GH-103 | Consult the Activity Log Tab in Discharge Detail | Browsing the history of one discharge by category |

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/101
- Child issue relationships are read from GitHub sub-issues, and the blockers above from the
  GitHub issue dependencies of the same children.
- Each child owns an independently reviewable roadmap or feature spec.
