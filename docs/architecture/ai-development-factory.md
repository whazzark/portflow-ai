# AI Development Workflow

## Purpose

Portflow uses upstream Spec Kit with Codex to turn one selected GitHub issue into reviewed feature
artifacts and tested code. Product decisions, final validation, and merge remain human
responsibilities.

## Ownership model

```text
GitHub Issue / Project
        ↓ intake, priority, dependencies
Vanilla Spec Kit
        ↓ spec → plan → tasks → implement
Code and tests
        ↓ deterministic CI + fresh Codex review
Draft PR
        ↓ human review and merge
Delivered feature
```

- Issues are created and refined before feature artifacts.
- `spec.md` defines observable behavior for one selected feature.
- `plan.md` and its supporting artifacts define the technical approach.
- `tasks.md` defines executable work grouped by independently testable user story.
- `CONTEXT.md` and ADRs preserve durable knowledge.

## Workflow

The upstream workflow is `specify → spec review → plan → plan review → tasks → implement`.
Clarification, checklist, analysis, and convergence are targeted optional skills. Verification,
fresh review, PR readiness, and merge follow implementation.

Use the [Spec Kit operator guide](../agents/spec-kit.md) for commands and maintenance.

## Automation boundaries

- Spec Kit owns feature artifacts and its internal workflow state.
- Codex owns AI-assisted specification, planning, implementation, and review work.
- GitHub Actions owns deterministic CI.
- GitHub Issues and Project own intake and operational status.
- GitHub pull requests own review and delivery evidence.

Portflow does not maintain a second delivery orchestrator or synchronize every Spec Kit phase into
GitHub.
