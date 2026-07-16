# AI Development Factory

## Purpose

This document captures the architectural vision for AI-assisted development in Portflow.

## Principles

- Product discovery and business decisions remain human.
- GitHub Issues are the functional source of truth.
- AI automates implementation, not product thinking.
- Every change ends as a Draft Pull Request.
- Final validation and merge remain human.

## High-level workflow

Issue GitHub -> Coordinator -> UX Review (optional) -> Implementer -> Checks -> Reviewer -> Validator -> Draft PR -> Human validation

## Agent responsibilities

### Coordinator
- Reads issues and dependencies.
- Chooses the execution workflow.
- Selects the required agents.
- Coordinates execution.

### Implementer
- Implements the issue.
- Uses TDD.
- Respects repository conventions.

### Reviewer
- Reviews the diff.
- Verifies specification, architecture, security and tests.

### Validator
- Runs smoke tests.
- Performs targeted regression checks.
- Validates acceptance criteria.

### UX/UI Reviewer
- Reviews mockups before implementation.
- Verifies accessibility, responsive behaviour and Design System consistency.

## Repository structure

```
.ai/
  agents/
  workflows/
  policies/
  templates/
```

`AGENTS.md` contains global rules.

`CLAUDE.md` files contain local development conventions.

## Automation

Eligible GitHub issue -> agent:ready -> Orca orchestration -> Draft Pull Request.

## Model routing

- Coordinator: Terra
- Implementer: Sol
- Reviewer: Sol
- Validator: Luna

Model selection depends on risk and task complexity.
