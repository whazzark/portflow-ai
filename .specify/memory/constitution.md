<!--
Sync Impact Report
- Version change: 2.0.0 → 3.0.0
- Modified principles:
  - I. Versioned intent is the contract → I. Selected feature intent is versioned
  - II. One coherent delivery unit per spec → II. One independently deliverable feature per spec
  - III. Risk-proportionate human gates protect product intent → III. Vanilla Spec Kit gates protect product intent
  - VIII. Secure, reversible automation → VIII. One workflow owner
- Removed sections:
  - Custom standard/high-assurance delivery workflow and artifact-hash approval rules
- Added sections:
  - Official Spec Kit lifecycle and incremental backlog adoption rules
- Templates:
  - ✅ .specify/templates/spec-template.md — vanilla template restored; compatible
  - ✅ .specify/templates/plan-template.md — vanilla Constitution Check consumes these principles
  - ✅ .specify/templates/tasks-template.md — vanilla task generation loads this constitution
  - ✅ .specify/templates/checklist-template.md — vanilla template restored; optional workflow remains compatible
- Runtime guidance:
  - ✅ AGENTS.md
  - ✅ docs/agents/spec-kit.md
  - ✅ docs/agents/issue-tracker.md
  - ✅ docs/agents/triage-labels.md
  - ✅ docs/architecture/ai-development-factory.md
  - ✅ README.md and .github/PULL_REQUEST_TEMPLATE.md
- Deferred items: none
-->

# Portflow Spec Constitution

## Core Principles

### I. Selected feature intent is versioned

GitHub Issues own intake, priority, dependencies, and discussion. A behavior-changing issue
receives a versioned feature specification under `specs/` only when it is selected for delivery.
The approved `spec.md` is the canonical behavioral contract; backlog issues MUST NOT be expanded
into speculative Spec Kit artifacts in bulk.

### II. One independently deliverable feature per spec

Each spec MUST define one primary business outcome that can be implemented, tested, reviewed, and
merged independently. Epics stay in GitHub and decompose into child feature issues. Implementation
steps belong in `tasks.md`; they become separate issues only when independently deliverable.

### III. Vanilla Spec Kit gates protect product intent

Portflow uses the upstream Spec Kit lifecycle and generated artifacts without a repository-owned
delivery state machine. A human MUST review the current spec before planning and the current plan
before task generation and implementation. Material ambiguity is clarified explicitly rather than
silently invented. Human product approval and merge remain mandatory.

### IV. Test-first observable behavior

Business behavior follows RED → GREEN → REFACTOR. Acceptance criteria map to observable unit,
feature, integration, or end-to-end verification. Tests prove public behavior and domain
invariants, not implementation trivia.

### V. Deep boundaries and explicit contracts

Use cases own business decisions, repositories own persistence mechanics, controllers own HTTP
adaptation, and UI adapters own transport-to-view translation. Cross-layer shortcuts require an
explicit plan decision and justification.

### VI. Durable knowledge has a home

Domain vocabulary belongs in `CONTEXT.md`; durable architectural decisions belong in ADRs;
feature intent and delivery artifacts belong in the feature directory. A canonical decision MUST
NOT be duplicated in a second hand-maintained document.

### VII. Verification is part of delivery

Before a PR is ready, formatting and lint checks, typechecking, affected tests, the full fast test
suite, and relevant browser flows MUST pass. A fresh read-only Codex review MUST assess the final
diff, with confirmed findings resolved or explicitly justified. Human review and merge remain
mandatory.

### VIII. One workflow owner

Spec Kit owns its artifact lifecycle and internal workflow state. GitHub Project owns operational
Kanban status; GitHub PRs own review and CI evidence. Portflow MUST NOT introduce another delivery
state machine, mirror every Spec Kit phase into Project fields, or require product deliveries to
test repository-owned orchestration that does not exist.

## Portflow Constraints

- Runtime stack: PNPM/Turbo, TypeScript, AdonisJS, TanStack Start, PostgreSQL, Japa/Vitest,
  Biome, and Playwright where configured.
- The API is the source of truth for business state and authorization.
- Existing vertical-slice architecture, domain terms, ADRs, and test seams are binding unless an
  approved plan changes them.
- Work MUST start from an issue on a branch, never directly on `master`, and commits MUST use
  Conventional Commits.
- Existing specs remain accessible and are revised only when their issue is selected; backlog
  restructuring proceeds one issue at a time.

## Delivery Workflow

The supported feature lifecycle is:

`speckit-specify → speckit-clarify (when material) → spec review → speckit-plan → plan review → speckit-tasks → speckit-implement → verification → fresh review → human merge`

Checklist, analysis, and convergence commands are optional tools used when their added assurance
is justified. GitHub Project uses only `Backlog`, `Ready`, `In Progress`, `Review`, `Blocked`, and
`Done`; detailed Spec Kit progress stays inside Spec Kit.

## Governance

This constitution governs Spec Kit use in Portflow. Changes to source-of-truth ownership, human
gates, test obligations, authorization boundaries, or feature-artifact meaning require an explicit
constitution amendment. The repository's `AGENTS.md` files provide operational guidance and MUST
remain consistent with this constitution. Constitution versions follow semantic versioning: MAJOR
for incompatible governance changes, MINOR for new principles or materially expanded obligations,
and PATCH for non-semantic clarification.

**Version**: 3.0.0 | **Ratified**: 2026-07-27 | **Last Amended**: 2026-07-31
