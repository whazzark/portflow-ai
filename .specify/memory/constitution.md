# Portflow Spec Constitution

## Core Principles

### I. Versioned intent is the contract

Every behavior-changing delivery starts with a versioned feature specification under `specs/`. GitHub Issues remain the intake and coordination surface, but the spec is the canonical contract reviewed with the implementation.

### II. One coherent delivery unit per spec

A spec must have one primary business objective, actor, main flow, and close technical surface. Large epics are shallow roadmaps that link to independently testable sub-specs. Do not hide unrelated stories in one feature.

### III. Risk-proportionate human gates protect product intent

Product decisions remain human. Standard deliveries require one Ready-to-build approval of the current spec and plan. High-assurance deliveries require separate Spec and Plan approvals. Approval evidence is tied to artifact hashes and becomes stale when approved intent changes. An ambiguous material requirement is recorded as an explicit clarification, never silently invented.

### IV. Test-first observable behavior

Business behavior follows RED → GREEN → REFACTOR. Acceptance criteria map to observable unit, feature, integration, or end-to-end verification. Tests prove public behavior and domain invariants, not implementation trivia.

### V. Deep boundaries and explicit contracts

Use cases own business decisions, repositories own persistence mechanics, controllers own HTTP adaptation, and UI adapters own transport-to-view translation. Cross-layer shortcuts require an explicit plan decision and justification.

### VI. Durable knowledge has a home

Domain vocabulary belongs in `CONTEXT.md`; durable architectural decisions belong in ADRs; feature intent and delivery artifacts belong in the feature directory. Do not duplicate a canonical decision in a second hand-maintained document.

### VII. Verification is part of delivery

Before a PR is ready, run formatting/lint checks, typechecking, affected tests, the full fast suite, and relevant browser flows. Obtain a fresh read-only Codex review and resolve or explicitly justify every confirmed finding. Checklist, analysis, and convergence are targeted high-assurance or recovery tools, not mandatory loops. Human approval and merge remain mandatory.

### VIII. Secure, reversible automation

Workflow shell steps use fixed repository-owned commands and do not interpolate uncontrolled agent output. Database changes are reversible, authorization is tested at the HTTP boundary, and automation stops at explicit human gates before material external mutations.

## Portflow constraints

- Runtime stack: PNPM/Turbo, TypeScript, AdonisJS, TanStack Start, PostgreSQL, Japa/Vitest, Biome, and Playwright where configured.
- The API is the source of truth for business state and authorization.
- Existing vertical-slice architecture, domain terms, ADRs, and test seams are binding unless the approved plan changes them.
- Branches use `<type>/<issue-number>-<slug>` and commits use Conventional Commits.
- Specs use stable domain-oriented paths. GitHub issue numbers are metadata and traceability anchors, not filesystem ordering.

## Delivery workflow

Standard: `draft spec and plan → Ready to build → implementation slices → fresh review → checks → human delivery review → merge`

High assurance: `spec → Spec Review → plan → Plan Review → implementation slices → fresh review → checks → human delivery review → merge`

The issue, branch, Draft PR, artifacts, approvals, reviews, and checks are the durable workflow record. `.specify/delivery.json` is an optional local cache. The Draft PR displays a managed workflow projection and preserves reviewer-authored content.

## Governance

This constitution governs all Spec Kit workflows in Portflow. A change requires an ADR or a constitution amendment when it changes source-of-truth rules, human gates, test obligations, authorization boundaries, or the meaning of feature artifacts. The repository's root and nested `AGENTS.md` files provide operational guidance; they must not contradict this constitution.

**Version**: 2.0.0 | **Ratified**: 2026-07-27 | **Last Amended**: 2026-07-29
