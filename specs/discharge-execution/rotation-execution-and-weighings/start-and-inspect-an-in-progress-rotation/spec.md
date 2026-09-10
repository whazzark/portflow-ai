# Feature Specification: Start and Inspect an In Progress Rotation

**Feature ID**: `GH-82`
**GitHub Issue**: [#82](https://github.com/whazzark/portflow-ai/issues/82)
**Parent Roadmap**: `specs/discharge-execution/rotation-execution-and-weighings/roadmap.md`
**Roadmap Entry**: `GH-82`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 5. Livrer l'exécution opérationnelle interactive
**Domain**: discharge-execution

## User Scenarios & Testing

### User Story 1 - Start and Inspect an In Progress Rotation (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Start and Inspect an In Progress Rotation" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Start and Inspect an In Progress Rotation".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Start and Inspect an In Progress Rotation" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-65: a rotation is started from an active shift by a rotation-eligible truck, and
  that slice is what makes a shift active.
- It is the entry point of this roadmap's execution order: GH-83 depends on it.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Start and Inspect an In Progress Rotation" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the rotation start with its empty weighing in `apps/api` and its entry in the shift workspace of `apps/web`. It absorbs the former frontend-only slice "Start a Rotation and Record the Empty Weighing in the Shift Workspace", which described the same outcome from the web side alone.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/82
- Parent roadmap: specs/discharge-execution/rotation-execution-and-weighings/roadmap.md
- Absorbed scope: "Start a Rotation and Record the Empty Weighing in the Shift Workspace", a frontend-only slice merged here on 2026-09-10 and deleted from GitHub.
- Related domain: discharge-execution
