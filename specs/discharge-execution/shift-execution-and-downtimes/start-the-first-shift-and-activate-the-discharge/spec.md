# Feature Specification: Start the First Shift and Activate the Discharge

**Feature ID**: `GH-65`
**GitHub Issue**: [#65](https://github.com/whazzark/portflow-ai/issues/65)
**Parent Roadmap**: `specs/discharge-execution/shift-execution-and-downtimes/roadmap.md`
**Roadmap Entry**: `GH-65`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 5. Livrer l'exécution opérationnelle interactive
**Domain**: discharge-execution

## User Scenarios & Testing

### User Story 1 - Start the First Shift and Activate the Discharge (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Start the First Shift and Activate the Discharge" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Start the First Shift and Activate the Discharge".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Start the First Shift and Activate the Discharge" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-63: starting the first shift requires a planned shift with its responsible and
  its resources.
- Blocked by GH-56: the discharge start confirmation is the same atomic activation seen from the
  preparation side, and its conflict taxonomy governs what may refuse this start.
- Deliverable in parallel with GH-64 and GH-66.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Start the First Shift and Activate the Discharge" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the activation command in `apps/api` and the shift workspace in `apps/web`, which is born with the first started shift. It absorbs the workspace and its start action from the former frontend-only slice "Shift Workspace: Start, Live View, and Completion"; the completion action belongs to GH-68.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/65
- Parent roadmap: specs/discharge-execution/shift-execution-and-downtimes/roadmap.md
- Absorbed scope: the workspace and its start action from "Shift Workspace: Start, Live View, and Completion", a frontend-only slice split between GH-65 and GH-68 on 2026-09-10 and deleted from GitHub.
- Related domain: discharge-execution
