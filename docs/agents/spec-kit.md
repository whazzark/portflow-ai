# Spec Kit Operator Guide

This guide is the operational entry point for running Portflow's Codex-only Spec Kit workflow. The project constitution defines the binding principles; `AGENTS.md` defines repository-wide agent rules; this document explains the commands an operator uses day to day.

## Prerequisites

- Node.js 22, PNPM 10, and the repository dependencies installed.
- GitHub CLI authenticated for issue and Project operations.
- `specify` 0.14.2 or a reviewed compatible version.
- Codex as the only installed and default Spec Kit integration.

Check the local installation without changing files:

```bash
specify --version
specify check
specify integration status
specify workflow info portflow-feature
```

`specify integration status` reports four locally modified managed templates. This is expected: the spec template adds GitHub and roadmap traceability, the plan template adds Portflow architecture and acceptance mapping, the tasks template enforces TDD and final verification, and the checklist template enforces domain, authorization, and application-boundary review. Do not force an integration upgrade without reviewing those changes.

## Source of truth and artifact layout

GitHub Issues hold intake, priority, discussion, and stable traceability. The GitHub Project holds delivery state. Versioned files under `specs/` are the canonical behavioral contract.

```text
specs/<domain>/<epic>/roadmap.md
specs/<domain>/<epic>/<feature>/spec.md
specs/<domain>/<epic>/<feature>/plan.md
specs/<domain>/<epic>/<feature>/tasks.md
specs/<domain>/<epic>/<feature>/checklists/
```

Standalone work uses `specs/standalone/<feature>/`. GitHub issue numbers belong in artifact metadata, not in directory names or ordering.

## Start or update a feature

1. Select or create the GitHub intake issue and assign its priority, milestone, parent, and Project item.
2. Create a branch named `<type>/<issue-number>-<slug>`.
3. Choose the stable feature directory from its domain and parent roadmap.
4. Start the Portflow workflow:

```bash
pnpm spec:workflow -- run \
  --feature-dir specs/<domain>/<epic>/<feature> \
  --description "GitHub issue #123: concise product intent"
```

The wrapper validates the directory and supplies `SPECIFY_FEATURE_DIRECTORY`, preventing Spec Kit from creating sequentially numbered directories. A new directory uses `portflow-feature`; an existing `spec.md` automatically uses `portflow-existing-feature`, which starts at clarification and never replaces the migrated spec with a blank template.

Use a dry run to inspect the resolved command without starting Codex:

```bash
pnpm spec:workflow -- run \
  --feature-dir specs/<domain>/<epic>/<feature> \
  --description "GitHub issue #123: concise product intent" \
  --dry-run
```

Do not use the full implementation workflow for an artifact marked `Done (historical)`. Historical specs record delivered intent; they are not implementation queues.

## Gates, status, and resume

The workflow is:

```text
specify → clarify → Spec Review → plan → checklist → Plan Review
→ tasks → analyze → implement → checks → converge → final review
```

The run pauses at human gates. Inspect and resume it with:

```bash
pnpm spec:workflow -- status
pnpm spec:workflow -- status <run-id>

pnpm spec:workflow -- resume <run-id> \
  --feature-dir specs/<domain>/<epic>/<feature>
```

`.specify/feature.json` records the active feature for local Codex sessions and is intentionally not committed. Workflow run state under `.specify/workflows/runs/` is also local.

Use the Project `Spec Status` field as follows:

| Workflow point | Spec Status |
| --- | --- |
| Product qualification required | `Intake` |
| Spec being written or clarified | `Spec Draft` |
| Draft PR awaiting spec approval | `Spec Review` |
| Plan awaiting approval | `Plan Review` |
| Spec, plan, and tasks approved | `Ready` |
| Implementation underway | `In Progress` |
| Convergence and review underway | `Review` |
| External decision or dependency required | `Blocked` |
| Delivery merged or historical work recorded | `Done` |

## Pull request contract

Open one Draft PR when `spec.md` is reviewable. Keep the same PR through plan, tasks, implementation, and verification.

- Put the exact `specs/.../spec.md` path in the PR template.
- Keep `Current review gate` synchronized with the workflow: use `Spec Review` or `Plan Review` at the matching Project status, then `Delivery Review` when the Project item moves to `Review`.
- Draft PRs may stop at the spec gate.
- Ready PRs require `plan.md`, `tasks.md`, no clarification markers, and no unchecked tasks.
- Run `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm test:spec-kit`, relevant browser journeys, `$speckit-analyze`, and `$speckit-converge`.
- Obtain a fresh Codex review and human approval before merge.

Workflow, documentation, and tooling-only PRs use `Spec: N/A`.

## Backlog migration and GitHub cutover

These are administrative commands, not daily feature commands:

```bash
node scripts/spec-kit/migrate-backlog.mjs --dry-run
node scripts/spec-kit/migrate-backlog.mjs
node scripts/spec-kit/validate-backlog.mjs
node scripts/spec-kit/validate-backlog.mjs --github
node scripts/spec-kit/cutover-github.mjs --dry-run
node scripts/spec-kit/cutover-github.mjs --dry-run --json
```

The local validator checks artifact structure and traceability. `--github` additionally compares every manifest parent with the live GitHub parent relationship.

Once `.migration-manifest.json` exists, `migrate-backlog.mjs` is audit-only by default. `--force-regenerate` is intentionally required to write again because GitHub issue bodies become tracking stubs after cutover and no longer contain the original specification source.

`cutover-github.mjs --apply` updates changed issue stubs, adds missing Project items, sets the target `Spec Status`, and removes legacy execution-state labels. The dry-run report inventories each obsolete label definition and every issue or PR that still uses it, including uses outside the frozen migration scope. Add `--delete-label-definitions` only after that inventory has been reviewed. Deletion is refused if any use remains after issue updates.

Every apply run first writes the current issue bodies, labels, Project item IDs, statuses, and label definitions to `.specify/migration-backup/`; rerunning the command resumes idempotently.

The current frozen migration covers 165 open and closed non-PR issues: 30 roadmaps and 135 feature specs. Closed deliveries produce artifacts marked `Done (historical)`. New issues created after the migration snapshot are not added to the manifest automatically.

## First workflow pilot

After the migration PR is merged, select one small real feature in `Spec Draft` with a clear parent roadmap and no external blocker. Start it through `pnpm spec:workflow -- run`, then verify each gate before using the workflow more broadly:

- no sequentially numbered directory is created;
- `.specify/feature.json` records the selected stable feature directory;
- the run pauses and resumes at Spec Review and Plan Review;
- one Draft PR receives the spec, plan, tasks, implementation, and verification;
- the Project `Spec Status` follows the workflow without adding an execution-state label;
- final analysis, convergence, fresh review, and human merge remain mandatory.

Record the pilot issue and PR in migration issue `#182`. Do not use a `Done (historical)` artifact for the pilot.

## Upgrade procedure

Upgrade Spec Kit only on a dedicated branch:

```bash
specify self check
specify self upgrade --dry-run
specify integration status
```

After upgrading the CLI, review the integration diff before accepting managed-file changes. Never run `specify integration upgrade --force` as an unattended step: Portflow intentionally modifies the constitution, templates, Codex skills, and workflow.

After any reviewed upgrade, run:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm test:spec-kit
node scripts/spec-kit/validate-backlog.mjs
```

## Troubleshooting

- **A sequential spec directory appeared**: stop the run and restart through `pnpm spec:workflow` with the intended domain path.
- **Feature directory not found**: pass the same `--feature-dir` used when the run started; do not hand-edit issue-number directories.
- **Workflow paused**: use `status <run-id>`, resolve the gate feedback in the artifacts, then use `resume`.
- **Integration status warns about modified files**: expected for Portflow customizations; review rather than forcing an upgrade.
- **PR validation fails**: read the emitted GitHub Actions errors and check the selected change type, spec path, plan/tasks presence, clarification markers, and incomplete tasks.
- **Historical spec needs new behavior**: create a new intake issue and delivery spec, then link the historical artifact as context.
