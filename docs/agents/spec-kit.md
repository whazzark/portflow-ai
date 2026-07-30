# Lean Spec Kit Delivery Guide

Portflow uses Spec Kit artifacts as concise delivery contracts and one Draft PR as the human workflow interface. GitHub Issues own intake and priority, `spec.md` owns product intent, ADRs own durable architecture, and code plus tests own delivered behavior.

## Delivery profiles

Choose the smallest profile that protects the change:

| Profile | Use | Required artifacts | Build approval |
|---|---|---|---|
| `lite` | Local bug fix, refactor, workflow, docs, or tooling without new product intent | None | None |
| `standard` | Default behavior-changing delivery | `spec.md`, concise `plan.md` | One Ready-to-build approval |
| `high-assurance` | Security, destructive migration, concurrency, public contract, regulated behavior | `spec.md`, `plan.md`, targeted supporting artifact only when justified | Separate Spec and Plan approvals |

Set one stable issue label: `delivery:lite`, `delivery:standard`, or `delivery:high-assurance`. When no label or explicit option exists, the workflow defaults to `standard`.

## Start and inspect

Start from a clean `master` worktree:

```bash
pnpm delivery:start -- 123
pnpm delivery:start -- 123 --profile standard --dry-run
```

The command resolves the canonical feature directory, creates the required issue branch, pushes the first checkpoint, opens one Draft PR, and projects workflow progress into its managed block. Standard and high-assurance deliveries draft lean artifacts; lite deliveries implement one small focused checkpoint without creating Spec Kit artifacts.

Inspect without mutation:

```bash
pnpm delivery:status -- 123
pnpm delivery:validate -- 123
```

Run delivery commands from the issue branch so local artifacts and the PR head cannot diverge. `.specify/delivery.json` is an ignored convenience pointer. It is never authoritative. A fresh checkout can reconstruct state after fetching and checking out the issue branch from the issue, branch, PR, artifacts, approval comments, independent-review record, and checks.

## Standard workflow

```text
draft spec and plan
→ Ready to build
→ implementation slices
→ independent review
→ final verification
→ human delivery review
→ merge
```

The plan contains 5–15 outcome-oriented items under `## Implementation Slices`. Each slice follows RED → GREEN → REFACTOR internally. Do not create separate bookkeeping tasks for each TDD step.

Approve the current artifact hashes:

```bash
pnpm delivery:approve -- 123 --gate ready-to-build
```

Then advance one calculated action at a time:

```bash
pnpm delivery:continue -- 123
```

The command implements one slice, runs its focused observable test, marks that slice complete, creates a focused Conventional Commit, pushes it, and refreshes the PR. It pauses only for a material product decision, irreversible risk, authorization choice, or external blocker.

## High-assurance workflow

High-assurance work uses:

```bash
pnpm delivery:approve -- 123 --gate spec-review
pnpm delivery:continue -- 123
pnpm delivery:approve -- 123 --gate plan-review
```

Checklist, cross-artifact analysis, data-model notes, and explicit contracts are permitted only when targeted by the approved risk profile. They are not unconditional phases.

## Independent review and verification

Run a fresh read-only review explicitly or let `continue` select it:

```bash
pnpm delivery:review -- 123
```

Confirmed technical findings return only to implementation. After a correction commit, the prior review is stale and a fresh review is required. A finding that changes product intent returns to a human decision.

Final verification runs once after the branch has zero open finding:

```text
pnpm check
pnpm typecheck
pnpm test
pnpm test:spec-kit
affected browser journey when apps/web changed
```

The workflow records command evidence against the current commit. Green GitHub checks and local evidence are both required when CI checks exist. After verification, complete the PR's assessed database choice and Ready-for-delivery checklist. The next `continue` marks the PR ready only when this human-owned metadata is complete. Merge remains human.

## Pull request progress

The workflow owns only:

```text
<!-- portflow:delivery-workflow:start -->
...
<!-- portflow:delivery-workflow:end -->
```

The block shows profile, current step, evidence, and implementation-slice progress. Reviewer-authored text outside those markers is preserved. Editing the rendered table manually never creates an approval or state transition.

Approvals, independent reviews, and verification results are durable structured PR comments tied to the relevant artifact fingerprint or commit. A material change automatically invalidates stale evidence.

## Kanban

The Project has one editable workflow field:

| Status | Meaning |
|---|---|
| `Backlog` | Qualified but not startable |
| `Ready` | Startable with dependencies resolved |
| `In Progress` | Drafting or implementation active |
| `Review` | Awaiting build approval, independent review, checks, or delivery review |
| `Blocked` | Waiting for an external dependency or material decision |
| `Done` | Issue closed and delivery merged |

Detailed phases live in the PR. Do not recreate `Spec Status`.

## Adoption and compatibility

Adopt an existing open PR without changing its reviewer-authored content:

```bash
pnpm delivery:adopt -- 123 --dry-run
pnpm delivery:adopt -- 123
```

The previous orchestrator remains temporarily available:

```bash
pnpm spec:workflow:legacy -- status
```

Do not convert an active legacy run implicitly. Review its branch, artifacts, PR, and local state first.

## Administrative Project cutover

The Project simplification is deliberately separate from daily delivery:

```bash
pnpm project:simplify -- --dry-run
pnpm project:simplify -- --apply
```

The apply command creates a local backup of fields and Project items, verifies that `Status` has the canonical options, removes the `Spec Status` field, and leaves issue status values unchanged. Review the dry run before applying.

## Workflow development

All tests must be hermetic: temporary repositories and fake GitHub/Codex adapters only. A test must never read an active `.specify/workflows/runs/` or `.specify/delivery.json` from the developer checkout.

Before changing the workflow:

```bash
pnpm check
pnpm typecheck
pnpm test:spec-kit
```

Use `specify integration status` to review managed-template drift. Never force-upgrade intentionally customized templates without a dedicated review.
