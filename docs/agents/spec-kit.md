# Vanilla Spec Kit Operator Guide

Portflow uses the upstream Spec Kit installation with the Claude Code integration. Spec Kit owns
feature artifacts and its internal workflow state. GitHub Issues and the Roadmap own intake,
priority, dependencies, and operational status; pull requests and CI own delivery evidence.

## Installation health

The repository currently targets the version recorded in `.specify/init-options.json`. Verify the
installed CLI and managed files before starting work:

```bash
specify --version
specify integration status
specify workflow list
```

`specify integration status` must report `claude` as the only installed integration and no
modified or missing managed files. To reinstall the vanilla Claude Code skills (`.claude/skills/`)
and shared assets for the installed CLI version:

```bash
specify integration upgrade claude
```

Do not edit managed templates or generated skills directly. Prefer an official preset or extension
when a repeated need is proven.

## Select work before specifying it

Backlog issues do not need feature directories. Before generating a spec:

1. Select one independently deliverable issue and resolve its blocking dependencies.
2. Split it into child issues if it contains several outcomes that can ship independently.
3. Move only the selected issue to `Ready`.
4. Start from an up-to-date `master` and create `<type>/<issue-number>-<slug>`.
5. Move the issue to `In Progress` when work begins.

Existing nested specs remain valid historical material. Do not bulk-migrate or regenerate them.

## Interactive lifecycle with Claude Code skills

Invoke the installed skills in order from a Claude Code session:

```text
/speckit-specify <feature description and GitHub issue URL>
/speckit-clarify
/speckit-plan
/speckit-tasks
/speckit-implement
```

`speckit-specify` creates one feature directory under `specs/` and records the active directory in
the ignored `.specify/feature.json` pointer. For an issue belonging to a roadmap, pass an explicit
`SPECIFY_FEATURE_DIRECTORY` such as
`specs/site-references/operational-checkpoints/docks/list-docks/` so related slices stay grouped by
domain and resource. Standalone features may use Spec Kit's sequential default. The feature
directory and git branch names are intentionally independent. Include the source issue URL in the
feature input for traceability.

Clarification is optional and is used only for material ambiguity. Review the current `spec.md`
before planning. Review `plan.md` and its generated design artifacts before generating tasks and
implementing them.

The following skills are optional:

- `/speckit-checklist`: validate requirements-writing quality for a targeted concern;
- `/speckit-analyze`: read-only consistency analysis after tasks are generated;
- `/speckit-converge`: append genuinely missing work after an implementation pass;
- `/speckit-taskstoissues`: use only when tasks are independently deliverable issues, never as the
  default task tracker.

## Automated upstream workflow

The bundled vanilla workflow runs specify, plan, tasks, and implement with spec and plan review
gates:

```bash
specify workflow run speckit \
  --input integration=claude \
  --input 'spec=<feature description and GitHub issue URL>'
```

Inspect and resume a paused run with the run identifier printed by the CLI:

```bash
specify workflow status
specify workflow resume <run-id>
```

Workflow run state under `.specify/workflows/runs/` is local and ignored. GitHub Project status is
updated deliberately by the operator; Spec Kit does not maintain a second Kanban.

## Verification and delivery

During implementation, follow RED → GREEN → REFACTOR for observable business behavior. Before a
PR is ready:

```bash
pnpm check
pnpm typecheck
pnpm test
```

Run affected browser journeys when `apps/web` changes. Then obtain a fresh read-only Claude Code
review of the final diff, either by running `/code-review` in a new Claude Code session on the
branch or by delegating the review to a read-only subagent that did not write the change. Resolve
or explicitly justify every confirmed finding. Human review and merge remain mandatory.

## Maintenance boundary

Vanilla Spec Kit does not own branch publishing, GitHub Project synchronization, PR-body mutation,
commits, CI, or merge. Do not add a repository-owned state machine around it. Improve the workflow
incrementally through upstream-supported configuration only after a concrete repeated problem has
been observed.
