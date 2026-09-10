# Roadmap: Discharge Closure

**GitHub Issue**: [#96](https://github.com/whazzark/portflow-ai/issues/96)
**Domain**: reporting-and-audit
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

The rows are ordered by execution order. Blockers are recorded as GitHub issue dependencies; the
`Blocked by` column repeats only the direct ones, since GitHub resolves the transitive ones.

| ID | Sub-feature | Blocked by | Status | Artifact |
|---|---|---|---|---|
| GH-97 | Review Discharge Closure Readiness | GH-68, GH-84 | planned | ./review-discharge-closure-readiness/ |
| GH-98 | Close a Discharge and Release Its Resources | GH-97 | planned | ./close-a-discharge-and-release-its-resources/ |

The two slices are a chain: the closure GH-98 records is refused until the readiness GH-97
computes is met, so nothing here can be run in parallel.

## Cross-cutting context

Each slice is a vertical one: it owns its command or query in `apps/api` and the matching review or
action in the discharge detail workbench of `apps/web`, so that it stays independently deliverable
as one issue, one feature directory, one branch, and one PR. The roadmap previously split those two
outcomes into a backend slice and a frontend slice each. They were merged on 2026-09-10 and the
absorbed issues were closed on GitHub, so the table below is the only remaining record of that
split:

| Merged into | Absorbed frontend slice | Outcome |
|---|---|---|
| GH-97 | Review Discharge Closure Readiness From the Frontend | Seeing whether a discharge may be closed |
| GH-98 | Close a Discharge From the Frontend | Declaring the physical operation finished and releasing its resources |

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/96
- Child issue relationships are read from GitHub sub-issues, and the blockers above from the
  GitHub issue dependencies of the same children.
- Each child owns an independently reviewable roadmap or feature spec.
