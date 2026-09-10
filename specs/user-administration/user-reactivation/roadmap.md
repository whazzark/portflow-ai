# Roadmap: User Reactivation

**GitHub Issue**: [#31](https://github.com/whazzark/portflow-ai/issues/31)
**Domain**: user-administration
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

Blockers are recorded as GitHub issue dependencies; the `Blocked by` column repeats only the
direct ones, since GitHub resolves the transitive ones.

| ID | Sub-feature | Blocked by | Status | Artifact |
|---|---|---|---|---|
| GH-32 | Reactivate a User with Fresh Credentials | GH-20 | planned | ./reactivate-a-user-with-fresh-credentials/ |

GH-32 is the only remaining slice of this roadmap. It waits on GH-20, in the GH-19 roadmap,
which is what produces a deactivated user to reactivate; the password renewal it records is
already delivered.

## Cross-cutting context

The slice is a vertical one: it owns its command in `apps/api` and the matching action in the user
workbench of `apps/web`, so that it stays independently deliverable as one issue, one feature
directory, one branch, and one PR. The roadmap previously split that single outcome into a backend
slice and a frontend slice. They were merged on 2026-09-10 and the absorbed issue was closed on
GitHub, so the table below is the only remaining record of that split:

| Merged into | Absorbed frontend slice | Outcome |
|---|---|---|
| GH-32 | Reactivate a User From the Web Workbench | Restoring sign-in access under a required password renewal |

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/31
- Child issue relationships are read from GitHub sub-issues, and the blockers above from the
  GitHub issue dependencies of the same children.
- Each child owns an independently reviewable roadmap or feature spec.
