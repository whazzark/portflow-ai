# Portflow Agent Instructions

## Source of truth

- Product intake, priority, milestones, parent/child relationships, and discussion live in GitHub Issues and the Portflow Roadmap project.
- Detailed feature requirements live in `specs/`. A feature spec is the canonical contract for behavior; an issue links to it and does not duplicate it.
- Durable domain vocabulary lives in `CONTEXT.md`. Durable architectural decisions live in `docs/adr/` or the relevant application ADR directory.
- Use one feature spec per coherent delivery unit. Large epics use a `roadmap.md` that links to independently testable sub-specs.

## Spec Kit lifecycle

Follow the operator guide in `docs/agents/spec-kit.md` for exact commands, workflow gates, maintenance, and troubleshooting.

For a behavior-changing delivery, use the Codex skills in this order:

1. `$speckit-specify`
2. `$speckit-clarify` when requirements are ambiguous
3. `$speckit-plan`
4. `$speckit-checklist`
5. Human review of the spec and plan in the Draft PR
6. `$speckit-tasks`
7. `$speckit-analyze`
8. `$speckit-implement`
9. `pnpm check && pnpm typecheck && pnpm test`
10. `$speckit-converge`

Keep the active feature directory in `.specify/feature.json`. Feature directories use stable domain-oriented paths under `specs/`; the GitHub issue number belongs in the spec metadata, not in the directory ordering.

## Delivery gates

- Never work directly on `master`; create a branch using `<type>/<issue-number>-<slug>`.
- Open one Draft PR as soon as the migrated or generated `spec.md` is reviewable. The same PR receives `plan.md`, `tasks.md`, and implementation commits.
- A human must approve the spec before planning and the plan before implementation.
- Use TDD for business behavior: failing observable test, minimal implementation, green tests, refactor.
- Before a PR is ready, run `pnpm check`, `pnpm typecheck`, `pnpm test`, affected browser flows when relevant, `$speckit-analyze`, and `$speckit-converge`.
- A fresh Codex session reviews the implementation against the spec, architecture, security, and tests. Human approval and merge remain mandatory.

## Git and commits

- Use Conventional Commits: `<type>(<domain>): <Description>`.
- Do not push or merge directly to `master`.
- Keep commits focused and explain any intentional deviation from the approved plan.

## Repository context

- This is a PNPM/Turbo monorepo with `apps/api` (AdonisJS) and `apps/web` (TanStack Start).
- The API is the source of truth for authorization and business state.
- Use the existing vertical-slice architecture, ADRs, domain vocabulary, and testing conventions.
