# Portflow Agent Instructions

## Source of truth

- Product intake, priority, milestones, parent/child relationships, discussion, and durable
  planning notes live in GitHub Issues and the Portflow Roadmap project.
- The Project `Status` field is the only operational Kanban (`Backlog`, `Ready`, `In Progress`,
  `Review`, `Blocked`, `Done`). Do not mirror Spec Kit phases into another Project field.
- A behavior-changing issue receives a feature directory under `specs/` only when selected for
  delivery. Its `spec.md` is then the canonical behavioral contract; the issue links to it rather
  than duplicating it.
- Durable domain vocabulary lives in `CONTEXT.md`. Durable architectural decisions live in
  `docs/adr/` or the relevant application ADR directory.
- Use one issue, one feature directory, one branch, and one PR per independently deliverable
  outcome. Epics stay in GitHub and decompose into independently deliverable child issues.
- Improve and adopt backlog issues one at a time. Do not generate or rewrite specs for the whole
  backlog in bulk.

## Vanilla Spec Kit lifecycle

Follow `docs/agents/spec-kit.md`. Portflow uses the upstream Spec Kit assets and Codex skills
without a repository-owned delivery orchestrator.

For a selected behavior-changing issue, use:

`speckit-specify → speckit-clarify (when material) → spec review → speckit-plan → plan review → speckit-tasks → speckit-implement`

The installed `speckit` workflow may automate that sequence with its two human review gates.
Checklist, analysis, and convergence are optional assurance tools, not mandatory phases. Keep
implementation tasks in `tasks.md`; do not convert them into GitHub issues unless they are truly
independently deliverable.

Bug fixes, refactors, documentation, and tooling without a new behavioral contract may proceed
from an issue directly to implementation and PR without creating Spec Kit feature artifacts.

## Delivery gates

- Never work directly on `master`; create a branch using `<type>/<issue-number>-<slug>`.
- Review the generated spec before planning and the generated plan before task generation and
  implementation.
- Use TDD for business behavior: failing observable test, minimal implementation, green tests,
  then refactor.
- Open a Draft PR once the initial reviewable artifacts or implementation are available.
- Before a PR is ready, obtain a fresh read-only Codex review, resolve every confirmed finding,
  run `pnpm check`, `pnpm typecheck`, `pnpm test`, and affected browser flows when relevant.
- Human product approval and merge remain mandatory.

## Git and commits

- Use Conventional Commits: `<type>(<domain>): <Description>`.
- Do not push or merge directly to `master`.
- Keep commits focused and explain any intentional deviation from the approved plan.

## Repository context

- This is a PNPM/Turbo monorepo with `apps/api` (AdonisJS) and `apps/web` (TanStack Start).
- The API is the source of truth for authorization and business state.
- Use the existing vertical-slice architecture, ADRs, domain vocabulary, and testing conventions.
