# Portflow Agent Instructions

## Source of truth

- Product intake, priority, milestones, parent/child relationships, discussion, and durable planning notes live in GitHub Issues and the Portflow Roadmap project.
- The Project `Status` field is the only operational Kanban (`Backlog`, `Ready`, `In Progress`, `Review`, `Blocked`, `Done`). Detailed delivery progress is projected into the Draft PR. Do not create a second editable workflow field or sprint commitments.
- Detailed feature requirements live in `specs/`. A feature spec is the canonical contract for behavior; an issue links to it and does not duplicate it.
- Durable domain vocabulary lives in `CONTEXT.md`. Durable architectural decisions live in `docs/adr/` or the relevant application ADR directory.
- Use one feature spec per coherent delivery unit. Large epics use a `roadmap.md` that links to independently testable sub-specs.

## Spec Kit lifecycle

Follow the operator guide in `docs/agents/spec-kit.md` for exact commands, workflow gates, maintenance, and troubleshooting.

Choose the smallest delivery profile that protects the change:

- `lite`: bug fixes, refactors, workflow, documentation, and tooling without a new product contract;
- `standard`: the default behavior-changing delivery, with `spec.md`, a concise `plan.md`, and one Ready-to-build approval;
- `high-assurance`: security, destructive migrations, concurrency, public contracts, or regulated behavior, with separate Spec and Plan approvals.

Use `pnpm delivery:start -- <issue>` and continue with the commands documented in `docs/agents/spec-kit.md`. Clarification is conditional and limited to material product decisions. Checklist, analysis, and convergence are targeted tools, never mandatory loops.

Keep the optional local pointer in `.specify/delivery.json`. It is a cache only: the issue, branch, Draft PR, artifacts, approvals, reviews, and checks must be sufficient to reconstruct delivery state. Feature directories use stable domain-oriented paths under `specs/`; the GitHub issue number belongs in spec metadata, not directory ordering.

## Delivery gates

- Never work directly on `master`; create a branch using `<type>/<issue-number>-<slug>`.
- Open one Draft PR as soon as the initial delivery artifacts are reviewable. The same PR displays the complete workflow and receives implementation commits.
- Standard deliveries require one human Ready-to-build approval tied to the current spec and plan hashes. High-assurance deliveries require separate Spec and Plan approvals.
- Use TDD for business behavior: failing observable test, minimal implementation, green tests, refactor.
- Before a PR is ready, obtain a fresh read-only Codex review, resolve every confirmed finding, run `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm test:spec-kit`, and affected browser flows when relevant.
- Review corrections return only to implementation and review. They must not regenerate approved upstream artifacts. Human delivery approval and merge remain mandatory.

## Git and commits

- Use Conventional Commits: `<type>(<domain>): <Description>`.
- Do not push or merge directly to `master`.
- Keep commits focused and explain any intentional deviation from the approved plan.

## Repository context

- This is a PNPM/Turbo monorepo with `apps/api` (AdonisJS) and `apps/web` (TanStack Start).
- The API is the source of truth for authorization and business state.
- Use the existing vertical-slice architecture, ADRs, domain vocabulary, and testing conventions.
