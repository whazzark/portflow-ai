# Roadmap: User Access Status Foundation

**GitHub Issue**: [#1](https://github.com/whazzark/portflow-ai/issues/1)
**Domain**: user-administration
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

| ID | Sub-feature | Status | Artifact |
|---|---|---|---|
| GH-2 | Persist User Access Status and Lifecycle Metadata | done (historical) | ./persist-user-access-status-and-lifecycle-metadata/ |
| GH-3 | Restrict Login to Active Users | done (historical) | ./restrict-login-to-active-users/ |
| GH-4 | Browse and Filter the User List (API + web) | in-progress | ./browse-and-filter-the-user-list/ |

## Cross-cutting context

The source issue did not provide additional cross-cutting context.

GH-5 ("Browse and Filter Users From the Web Workbench") was the web counterpart of GH-4 and has been merged into it: the API and web seams of the user list ship as a single slice, tracked by issue [#4](https://github.com/whazzark/portflow-ai/issues/4). Issue [#5](https://github.com/whazzark/portflow-ai/issues/5) is closed.

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/1
- Child issue relationships are read from GitHub sub-issues.
- Each child owns an independently reviewable roadmap or feature spec.
