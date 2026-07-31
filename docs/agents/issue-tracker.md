# Issue Tracker: GitHub Issues

GitHub Issues are Portflow's intake and coordination surface. They own the problem statement,
priority, milestone, parent/child relationships, dependencies, and discussion. A selected
behavior-changing issue links to its generated Spec Kit feature directory, whose `spec.md` becomes
the detailed behavioral contract.

## Work hierarchy

- An **epic** is a broad outcome represented by a parent issue. It does not enter the operational
  Kanban and does not receive a Spec Kit feature directory by default.
- A **feature issue** is independently implementable, testable, reviewable, and mergeable. It maps
  to one feature directory, branch, and PR.
- An **implementation task** stays in `tasks.md`. Create another GitHub issue only when that task
  can be delivered independently.

Split issues vertically by observable outcome, not horizontally into API, web, and test issues
that only become useful when merged together.

## Incremental backlog refinement

Do not generate specs for the whole backlog. Refine one candidate issue when it approaches
`Ready`:

1. Confirm one primary actor and outcome.
2. Add observable acceptance criteria and explicit exclusions.
3. Identify dependencies and parent/child relationships.
4. Split independently deliverable outcomes into child issues.
5. Move only the next unblocked feature issue to `Ready`.
6. Start its vanilla Spec Kit lifecycle from a dedicated branch.

Existing specs marked historical remain readable. Existing draft or unclear specs are reconsidered
only when their issue is selected; they are not bulk-rewritten.

## Canonical ownership

- GitHub Project: operational `Status`, ordering, priority, and milestone.
- GitHub issue: intake, relationships, dependencies, and product discussion.
- `spec.md`: detailed behavior and acceptance scenarios for a selected feature.
- `plan.md` and design artifacts: technical approach for that feature.
- `tasks.md`: implementation sequence.
- `CONTEXT.md`: ubiquitous domain language.
- ADRs: durable architectural decisions.

Avoid keeping editable copies of the same decision in multiple places.

## Continuous Kanban

| Status | Meaning |
| --- | --- |
| `Backlog` | Qualified and ordered, but not selected or still blocked. |
| `Ready` | Independently deliverable and free of blocking dependencies. |
| `In Progress` | Specification, planning, or implementation is active. |
| `Review` | Waiting for a human gate, PR review, or CI. |
| `Blocked` | An external dependency or material decision prevents progress. |
| `Done` | The issue is closed and its delivery is merged. |

Spec Kit phase progress stays in Spec Kit. Do not create a second Project workflow field.
