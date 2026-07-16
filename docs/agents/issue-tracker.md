# Issue tracker: GitHub Issues

Issues and specs for this repo live in [GitHub Issues](https://github.com/whazzark/portflow-ai/issues). Planning state (status, priority, sprint) lives in the [Portflow Roadmap GitHub Project](https://github.com/users/whazzark/projects/5). This tracker is the canonical source for product delivery work; do not maintain specs or detailed backlogs as files in the repository. Interact with it through the `gh` CLI.

## Conventions

- One delivery unit per epic: an issue carrying the `epic` label whose body holds the full spec (problem statement, solution, user stories, implementation and testing decisions, out of scope).
- Implementation issues are sub-issues of their epic. Each body holds "What to build", acceptance criteria as a checklist, and its dependencies under "Blocked by" as `#N` references.
- Unspecified ideas are issues labeled `triage:needs-triage`, backed by short cards under `.tracker/ideas/<feature-slug>.md` linked from the issue body until they are promoted into an epic.
- Delivery priority is a `priority:P0`, `priority:P1`, or `priority:P2` label; an issue without one is unprioritized.
- Milestones group epics by roadmap objective; the project's `Sprint` field carries sprint sequencing.
- Every open non-PR issue has exactly one mutually exclusive execution-state label (see `triage-labels.md`); comments and conversation history live as issue comments.

An issue is delivered by checking off its acceptance criteria and closing it. An epic is done when all its sub-issues are closed; GitHub rolls sub-issue progress up automatically.

## Specs and backlog

- An epic owns its problem, solution, product decisions, testing decisions, status, and priority.
- Follow the [spec decoupling rule](./spec-decoupling-rule.md) when choosing its boundary.
- Keep unspecified ideas under `.tracker/ideas/` until they are promoted into an epic.
- Do not create hand-maintained backlog indexes or duplicate spec summaries under `docs/`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue with `gh issue create`, following the body conventions above. Attach it to its epic as a sub-issue, set an explicit `priority:*` label, and add it to the project.

## When a skill says "fetch the relevant ticket"

Read the issue with `gh issue view <number>`. The user will normally pass the issue number or URL directly.
