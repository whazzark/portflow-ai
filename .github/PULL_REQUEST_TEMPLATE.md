## Summary

<!-- What this PR changes and why, in a couple of sentences. Keep this current as the PR progresses. -->

## Change type

- [ ] Spec-driven behavior change
- [ ] Bug fix, refactor, workflow, documentation, or tooling

## Delivery

<!-- Use the exact canonical spec path. Workflow/docs/tooling-only PRs use N/A. -->

Profile: `lite`, `standard`, or `high-assurance`

Spec: `specs/.../spec.md` or `N/A`

<!-- The delivery workflow inserts and owns its progress block below. -->

## Issue

Issue: #

<!-- Add `Closes #123` only when merging this PR fully resolves the issue. -->

## Reviewer focus

Review the current workflow step, its evidence, product intent, implementation quality, security, tests, and operational risk.

## Delivered changes

<!-- Bullet list of the notable changes. Delete this section for trivial PRs. -->

-

## Database

- [ ] Not assessed yet (Draft PR only)
- [ ] No migration in this PR
- [ ] Migration included and reversible (`down` mirrors `up`)

## Verification

<!-- Record concrete evidence. Before implementation or while Draft, state what has not run yet. -->

- Automated checks:
- Browser journeys:
- Other evidence:

## Screenshots

<!-- For `apps/web` changes: before/after screenshots or a short clip. Delete this section for API-only PRs. -->

## Ready-for-delivery checklist

- [ ] Exactly one change type is selected
- [ ] Current Ready-to-build or high-assurance approvals are recorded, when applicable
- [ ] Spec, plan slices, and implementation are aligned, when applicable
- [ ] Acceptance criteria verified one by one against the delivered result
- [ ] `pnpm check && pnpm typecheck && pnpm test && pnpm test:spec-kit` run locally and green
- [ ] For `apps/web` changes: golden path and edge cases exercised in the browser
- [ ] Fresh Codex session reviewed spec fidelity, architecture, security, and tests
- [ ] Every CONFIRMED finding from the fresh-session review resolved or explicitly justified
- [ ] New or changed domain terms reflected in `CONTEXT.md`, and relevant ADR added/updated under `docs/adr/`
