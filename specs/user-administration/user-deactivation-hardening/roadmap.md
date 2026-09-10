# Roadmap: User Deactivation Hardening

**GitHub Issue**: [#19](https://github.com/whazzark/portflow-ai/issues/19)
**Domain**: user-administration
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

The rows are ordered by execution order. Blockers are recorded as GitHub issue dependencies; the
`Blocked by` column repeats only the direct ones, since GitHub resolves the transitive ones.

| ID | Sub-feature | Blocked by | Status | Artifact |
|---|---|---|---|---|
| GH-20 | Reject Ineligible User Deactivation | — | planned | ./reject-ineligible-user-deactivation/ |
| GH-21 | Preserve the Last Active Organization Admin | GH-20 | planned | ./preserve-the-last-active-organization-admin/ |

The two slices are a chain: GH-21 guards the command GH-20 delivers, so nothing here can be run
in parallel.

## Cross-cutting context

Each slice is a vertical one: it owns its command in `apps/api` and the matching action in the user
workbench of `apps/web`, so that it stays independently deliverable as one issue, one feature
directory, one branch, and one PR. The roadmap previously carried a frontend-only slice, GH-22,
covering the deactivation from the web side alone. It was merged on 2026-09-10 and closed on
GitHub, so the table below is the only remaining record of that split:

| Merged into | Absorbed frontend slice | Outcome |
|---|---|---|
| GH-20 | Deactivate a User From the Web Workbench | Deactivating a user and refusing an ineligible one |

The refusal GH-21 adds is surfaced by the same workbench action and needs no separate frontend
slice.

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/19
- Child issue relationships are read from GitHub sub-issues, and the blockers above from the
  GitHub issue dependencies of the same children.
- Each child owns an independently reviewable roadmap or feature spec.
