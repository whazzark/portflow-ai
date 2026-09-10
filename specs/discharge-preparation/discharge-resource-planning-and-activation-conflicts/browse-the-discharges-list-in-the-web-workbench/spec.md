# Feature Specification: Browse the Discharges List in the Web Workbench

**Feature ID**: `GH-61`
**GitHub Issue**: [#61](https://github.com/whazzark/portflow-ai/issues/61)
**Parent Roadmap**: `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md`
**Roadmap Entry**: `GH-61`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P0
**Milestone**: 3. Exploiter le modèle en lecture
**Domain**: discharge-preparation

## User Scenarios & Testing

### User Story 1 - Browse the Discharges List in the Web Workbench (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Browse the Discharges List in the Web Workbench" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Browse the Discharges List in the Web Workbench".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Browse the Discharges List in the Web Workbench" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- None. No open issue blocks this slice: the operational read model it queries was delivered by
  GH-236, and neither `apps/api` nor `apps/web` carries a discharge query or route yet, so this
  slice creates them.
- It is the entry point of the roadmap's execution order: GH-58 depends on it.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Browse the Discharges List in the Web Workbench" before plan approval.]

## Source-derived decisions

- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/61
- Parent roadmap: specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md
- Related domain: discharge-preparation
