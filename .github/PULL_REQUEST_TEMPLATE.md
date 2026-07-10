## Summary

<!-- What changes and why, in a couple of sentences. -->

## Closes

Closes #

## Changes

<!-- Bullet list of the notable changes. Delete this section for trivial PRs. -->

-

## Database

- [ ] No migration in this PR
- [ ] Migration included and reversible (`down` mirrors `up`)

## Screenshots

<!-- For `apps/web` changes: before/after screenshots or a short clip. Delete this section for API-only PRs. -->

## Checklist

- [ ] Acceptance criteria verified one by one against the delivered result
- [ ] `pnpm check && pnpm typecheck && pnpm test` run locally and green
- [ ] For `apps/web` changes: golden path and edge cases exercised in the browser
- [ ] Fresh-session review completed (`/code-review --comment` + `/review` for spec fidelity; `/security-review` if this touches auth/sessions/user access)
- [ ] Every CONFIRMED finding from the fresh-session review resolved or explicitly justified
- [ ] New or changed domain terms reflected in `CONTEXT.md`, and relevant ADR added/updated under `docs/adr/`
