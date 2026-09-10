# Feature Specification: Complete or Continue from Empty Return Confirmation

**Feature ID**: `GH-84`
**GitHub Issue**: [#84](https://github.com/whazzark/portflow-ai/issues/84)
**Parent Roadmap**: `specs/discharge-execution/rotation-execution-and-weighings/roadmap.md`
**Roadmap Entry**: `GH-84`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 5. Livrer l'exécution opérationnelle interactive
**Domain**: discharge-execution

## User Scenarios & Testing

### User Story 1 - Complete or Continue from Empty Return Confirmation (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Complete or Continue from Empty Return Confirmation" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Complete or Continue from Empty Return Confirmation".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Complete or Continue from Empty Return Confirmation" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-83: the empty return is confirmed after the deposit that follows a
  capacity-compliant loaded weighing, which that slice is what records.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Complete or Continue from Empty Return Confirmation" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the empty return confirmation, with the continuation that opens the next rotation, in `apps/api` and its entry in the shift workspace of `apps/web`. It absorbs the empty return part of the former frontend-only slice "Record Loaded Weighing and Confirm Empty Return in the Shift Workspace"; its loaded weighing part belongs to GH-83.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/84
- Parent roadmap: specs/discharge-execution/rotation-execution-and-weighings/roadmap.md
- Absorbed scope: the empty return part of "Record Loaded Weighing and Confirm Empty Return in the Shift Workspace", a frontend-only slice split between GH-83 and GH-84 on 2026-09-10 and deleted from GitHub.
- Related domain: discharge-execution
