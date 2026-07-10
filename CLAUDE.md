# Agent Notes

## Coding style

- Prefer airy function bodies with clear visual separation between setup, decisions, and output.
- Write all enum members in uppercase.
- Add a blank line before a `return` statement when the function or method has setup, decisions, or side effects before the return.
- Do not add a blank line before `return` when the function body contains only that single return statement.
- Keep input transformations and normalization in use cases or domain helpers, not in validators, so every entry point applies the same behavior.

## Git

- Never commit or push directly to `master`; all delivery work goes through a branch and a pull request.
- Name branches `<type>/<issue-number>-<slug>`, for example `feat/42-truck-rotation-log`, using the same types as Conventional Commits.
- Use Conventional Commits for commit messages.
- Prefer the format `<type>(<domain>): <Description>`, for example `feat(users): Add active user password reset workflow`.
- Use scopes only for stable business or technical domains such as `auth`, `users`, `infra`, or `shared`.
- Do not use `api` as a scope; if a change is HTTP-only or cross-cutting, omit the scope.
- Use common types such as `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, and `ci`.

## Releases

- Generate changelogs from the Git history when preparing releases.
- Derive changelog entries from Conventional Commit messages since the previous release tag.
- Keep release notes grouped by meaningful commit types, especially `feat`, `fix`, and breaking changes.
- Version tags follow SemVer (`vMAJOR.MINOR.PATCH`); the project is currently in its `0.x` phase.
- Bump MINOR for each sprint delivery, PATCH for an out-of-cycle hotfix between sprints, and reserve MAJOR (`1.0.0`) for the day the app is declared stable for real usage — not a routine sprint boundary.
- Publishing a GitHub Release (tag `vX.Y.Z`) triggers `.github/workflows/deploy-production.yml`, which builds and pushes the production Docker images to ghcr.io (no automated deploy target yet).

## Agent workflow

### Issue tracker

Issues and specs are tracked in GitHub Issues, driven through the `gh` CLI. External PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

The tracker speaks the standard `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix` triage roles, expressed as GitHub labels and issue states. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository using root `CONTEXT.md` and `docs/adr/`. API-specific conventions and ADRs live under `apps/api/`. See `docs/agents/domain.md`.

### Agentic delivery workflow

1. **Pick up an issue.** When the user asks for the next issue to develop, propose using the `$tdd` skill for the implementation. Start from a fresh branch off `master` named after the issue (see the Git section); never work directly on `master`.
2. **Implement on the branch.** Run typechecking and the affected test files regularly, and the full suite (`pnpm typecheck && pnpm test`) once at the end. For `apps/web` changes, launch the app with `/run` and walk the golden path and edge cases in the browser before considering the feature done. Commit with Conventional Commit messages, proposing each message to the user before committing.
3. **Update the issue.** When the feature is finished, update the GitHub issue (`gh issue edit`): verify each acceptance criterion against the delivered result before checking it off, and only check criteria that are fully satisfied at that point. This is a first pass — the fresh-session review in the gate step re-verifies it independently. Do not close the issue by hand — the merge does it (see below).
4. **Open a pull request.** Push the branch and create the PR with `gh pr create`. Give it a Conventional Commit title (it becomes the squash commit on `master`) and put `Closes #N` in the body so the merge closes the issue automatically; sub-issue progress rolls up to its epic.
5. **Gate the PR.** CI (typecheck + tests + issue-link check) must be green. From a fresh session — not the one that implemented the change — run `/code-review --comment` for correctness and simplification, and `/review` for fidelity to the issue's acceptance criteria; both post as inline PR comments. For changes touching auth, sessions, or user access/roles, also run `/security-review`. Every CONFIRMED finding must be fixed (or explicitly justified as not applicable) before merge — a posted comment thread alone is not sufficient.
6. **Merge.** After the user approves, merge with `gh pr merge --squash --delete-branch`. Update the GitHub milestone descriptions or the project README only if the delivery changes a milestone, the delivery order, or the visible scope.
