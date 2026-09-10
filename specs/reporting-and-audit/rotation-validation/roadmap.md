# Roadmap: Rotation Validation

**GitHub Issue**: [#88](https://github.com/whazzark/portflow-ai/issues/88)
**Domain**: reporting-and-audit
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

The rows are ordered by execution order. Blockers are recorded as GitHub issue dependencies; the
`Blocked by` column repeats only the direct ones, since GitHub resolves the transitive ones.

| ID | Sub-feature | Blocked by | Status | Artifact |
|---|---|---|---|---|
| GH-89 | Validate a Completed Rotation Irreversibly | GH-84 | planned | ./validate-a-completed-rotation-irreversibly/ |
| GH-90 | Browse the Rotation Validation Queue | GH-89 | planned | ./browse-the-rotation-validation-queue/ |

The two slices are a chain: the queue GH-90 browses has nothing to show before GH-89 makes a
rotation validatable, so nothing here can be run in parallel.

## Cross-cutting context

Each slice is a vertical one: it owns its command or query in `apps/api` and the matching screen or
action in `apps/web`, so that it stays independently deliverable as one issue, one feature
directory, one branch, and one PR. The roadmap previously carried a frontend-only slice, GH-91,
covering both outcomes at once. It was merged on 2026-09-10 and closed on GitHub, so the table below
is the only remaining record of that split:

| Merged into | Absorbed frontend slice | Outcome |
|---|---|---|
| GH-89 | Build the Rotation Validation Queue Screen (validation action) | Validating a completed rotation irreversibly |
| GH-90 | Build the Rotation Validation Queue Screen (queue screen) | Browsing what remains to validate |

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/88
- Child issue relationships are read from GitHub sub-issues, and the blockers above from the
  GitHub issue dependencies of the same children.
- Each child owns an independently reviewable roadmap or feature spec.
