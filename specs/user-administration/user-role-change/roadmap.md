# Roadmap: User Role Change

**GitHub Issue**: [#27](https://github.com/whazzark/portflow-ai/issues/27)
**Domain**: user-administration
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

The rows are ordered by execution order. Blockers are recorded as GitHub issue dependencies; the
`Blocked by` column repeats only the direct ones, since GitHub resolves the transitive ones.

| ID | Sub-feature | Blocked by | Status | Artifact |
|---|---|---|---|---|
| GH-28 | Change Another Eligible User Role | — | planned | ./change-another-eligible-user-role/ |
| GH-29 | Protect Self-Role Changes and the Final Organization Admin | GH-28 | planned | ./protect-self-role-changes-and-the-final-organization-admin/ |

The two slices are a chain: GH-29 guards the command GH-28 delivers, so nothing here can be run
in parallel.

## Cross-cutting context

Each slice is a vertical one: it owns its command in `apps/api` and the matching action in the user
workbench of `apps/web`, so that it stays independently deliverable as one issue, one feature
directory, one branch, and one PR. The roadmap previously carried a frontend-only slice, GH-30,
covering the role change from the web side alone. It was merged on 2026-09-10 and closed on GitHub,
so the table below is the only remaining record of that split:

| Merged into | Absorbed frontend slice | Outcome |
|---|---|---|
| GH-28 | Change a User's Role From the Web Workbench | Changing the responsibility level of an eligible user |

The refusals GH-29 adds are surfaced by the same workbench action and need no separate frontend
slice.

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/27
- Child issue relationships are read from GitHub sub-issues, and the blockers above from the
  GitHub issue dependencies of the same children.
- Each child owns an independently reviewable roadmap or feature spec.
