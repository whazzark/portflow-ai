# Roadmap: User Identity Update

**GitHub Issue**: [#23](https://github.com/whazzark/portflow-ai/issues/23)
**Domain**: user-administration
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

The rows are ordered by execution order. Blockers are recorded as GitHub issue dependencies; the
`Blocked by` column repeats only the direct ones, since GitHub resolves the transitive ones.

| ID | Sub-feature | Blocked by | Status | Artifact |
|---|---|---|---|---|
| GH-24 | Update Another User Identity | — | planned | ./update-another-user-identity/ |
| GH-25 | Let Active Users Update Their Identity | GH-24 | planned | ./let-active-users-update-their-identity/ |

The two slices are a chain: GH-25 reuses the identity rules GH-24 delivers under a different
authorization path, so nothing here can be run in parallel. GH-118, outside this roadmap,
depends on GH-25.

## Cross-cutting context

Each slice is a vertical one: it owns its command in `apps/api` and the matching screen in
`apps/web`, so that it stays independently deliverable as one issue, one feature directory, one
branch, and one PR. The roadmap previously carried a frontend-only slice, GH-26, covering both
outcomes at once. It was merged on 2026-09-10 and closed on GitHub, so the table below is the only
remaining record of that split:

| Merged into | Absorbed frontend slice | Outcome |
|---|---|---|
| GH-24 | Update User Identity From the Web Workbench (administrator half) | An organization admin correcting another user identity |
| GH-25 | Update User Identity From the Web Workbench (self-service half) | An active user updating their own identity |

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/23
- Child issue relationships are read from GitHub sub-issues, and the blockers above from the
  GitHub issue dependencies of the same children.
- Each child owns an independently reviewable roadmap or feature spec.
