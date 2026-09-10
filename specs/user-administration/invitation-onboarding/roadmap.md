# Roadmap: Invitation Onboarding

**GitHub Issue**: [#6](https://github.com/whazzark/portflow-ai/issues/6)
**Domain**: user-administration
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

The rows are ordered by execution order. Blockers are recorded as GitHub issue dependencies; the
`Blocked by` column repeats only the direct ones, since GitHub resolves the transitive ones.

| ID | Sub-feature | Blocked by | Status | Artifact |
|---|---|---|---|---|
| GH-7 | Invite a Pending User with a Confidential Activation Link | — | planned | ./invite-a-pending-user-with-a-confidential-activation-link/ |
| GH-8 | Accept an Invitation and Open an Authenticated Session | GH-7 | planned | ./accept-an-invitation-and-open-an-authenticated-session/ |
| GH-9 | Renew a Pending User Activation Link | GH-7 | planned | ./renew-a-pending-user-activation-link/ |

GH-8 and GH-9 are the only pair that can be delivered in parallel. They share the pending user
GH-7 creates but neither blocks the other.

## Cross-cutting context

Each slice is a vertical one: it owns its command in `apps/api` and the matching screen in
`apps/web`, so that it stays independently deliverable as one issue, one feature directory, one
branch, and one PR. The roadmap previously carried a frontend-only slice covering two of these
outcomes at once. It was merged on 2026-09-10 and deleted from GitHub, so the table below is the
only remaining record of that split:

| Merged into | Absorbed frontend slice | Outcome |
|---|---|---|
| GH-7 | Invite and Accept an Invitation Through the Frontend (invitation half) | Inviting a pending user and handing out the confidential activation link |
| GH-8 | Invite and Accept an Invitation Through the Frontend (acceptance half) | Accepting the invitation and opening the authenticated session |

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/6
- Child issue relationships are read from GitHub sub-issues, and the blockers above from the
  GitHub issue dependencies of the same children.
- Each child owns an independently reviewable roadmap or feature spec.
