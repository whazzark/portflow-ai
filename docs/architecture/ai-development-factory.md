# AI Development Factory

## Purpose

Portflow uses Codex-only Spec Kit workflows to turn human-approved intent into tested delivery artifacts and a Draft Pull Request. Product decisions, final validation, and merge remain human responsibilities.

## Source-of-truth model

```text
GitHub Issue / Project
        ↓ intake, priority, dependencies
Spec Kit roadmap or feature spec
        ↓ spec → plan → tasks
Codex workflow
        ↓ implementation and verification
Draft PR
        ↓ fresh Codex review + human approval
Merged delivery
```

- Issues are short intake/tracking records.
- `roadmap.md` decomposes large epics.
- `spec.md` defines behavior.
- `plan.md` defines the technical approach.
- `tasks.md` defines executable work.
- `CONTEXT.md` and ADRs preserve durable knowledge.

## Codex roles

- **Specifier**: writes and clarifies intent.
- **Planner**: maps intent to architecture, boundaries, tests, and rollout.
- **Implementer**: follows the approved tasks with TDD.
- **Reviewer**: uses a fresh context to check the diff against spec, plan, architecture, security, and tests.
- **Validator**: runs deterministic checks and relevant browser journeys.
- **Coordinator**: Orca may supervise independent issue workflows across Codex worktrees; it must not bypass Spec Kit gates.

## Workflow

`specify → clarify → spec review → plan → checklist → plan review → tasks → analyze → implement → checks → converge → fresh review → human merge`

The project workflows are `.specify/workflows/portflow-feature/workflow.yml` and `.specify/workflows/portflow-existing-feature/workflow.yml`. Before every workflow commit, a human gate displays and approves the exact deterministic Conventional Commit message. After the first spec artifact (or the clarification step for an existing spec), a fixed shell step publishes the branch, creates the Draft PR, and synchronizes it after subsequent artifacts, implementation, checks, and convergence. Workflow runs may pause and resume at human gates. Shell steps are repository-owned fixed commands; arbitrary agent output must never be interpolated into them.

Use the [Spec Kit operator guide](../agents/spec-kit.md) for the supported commands, feature-path guardrails, gate handling, and maintenance procedure.

## Automation boundaries

- Spec Kit owns artifact lifecycle, workflow state, and gates.
- Codex owns all AI work.
- Orca owns worktree/process supervision for parallel terminal workflows.
- GitHub Actions owns deterministic CI.
- GitHub Project owns delivery status.

No `tools/ai-orchestrator` package is required until a concrete coordination capability exceeds these boundaries.
