# Roadmap: Rotation Adjustments

**GitHub Issue**: [#92](https://github.com/whazzark/portflow-ai/issues/92)
**Domain**: reporting-and-audit
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

The rows are ordered by execution order. Blockers are recorded as GitHub issue dependencies; the
`Blocked by` column repeats only the direct ones, since GitHub resolves the transitive ones.

| ID | Sub-feature | Blocked by | Status | Artifact |
|---|---|---|---|---|
| GH-93 | Record and Inspect an Immutable Rotation Adjustment | GH-89 | planned | ./record-and-inspect-an-immutable-rotation-adjustment/ |
| GH-94 | Project Effective Rotation Values and Capacity Breaches | GH-93 | planned | ./project-effective-rotation-values-and-capacity-breaches/ |

The two slices are a chain: there is nothing to project before an adjustment exists, so nothing
here can be run in parallel.

## Cross-cutting context

Each slice is a vertical one: it owns its command or projection in `apps/api` and the matching
screen in `apps/web`, so that it stays independently deliverable as one issue, one feature
directory, one branch, and one PR. The roadmap previously split the adjustment outcome into a
backend slice and a frontend slice, GH-95. They were merged on 2026-09-10 and the absorbed issue
was closed on GitHub, so the table below is the only remaining record of that split:

| Merged into | Absorbed frontend slice | Outcome |
|---|---|---|
| GH-93 | Build the Rotation Adjustment Creation UI | Recording a commented, immutable post-validation correction |

The screens that host the creation form belong to GH-90 and GH-58; this roadmap only adds the form
and the effective values it produces.

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/92
- Child issue relationships are read from GitHub sub-issues, and the blockers above from the
  GitHub issue dependencies of the same children.
- Each child owns an independently reviewable roadmap or feature spec.
