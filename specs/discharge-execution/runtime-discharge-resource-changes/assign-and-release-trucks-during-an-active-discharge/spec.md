# Feature Specification: Assign and Release Trucks During an Active Discharge

**Feature ID**: `GH-76`
**GitHub Issue**: [#76](https://github.com/whazzark/portflow-ai/issues/76)
**Parent Roadmap**: `specs/discharge-execution/runtime-discharge-resource-changes/roadmap.md`
**Roadmap Entry**: `GH-76`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 5. Livrer l'exécution opérationnelle interactive
**Domain**: discharge-execution

## User Scenarios & Testing

### User Story 1 - Assign and Release Trucks During an Active Discharge (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Assign and Release Trucks During an Active Discharge" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Assign and Release Trucks During an Active Discharge".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Assign and Release Trucks During an Active Discharge" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-65: assigning and releasing trucks at runtime presupposes an active discharge;
  the pool it draws from is the one GH-55 plans.
- Deliverable in parallel with GH-75, GH-77 and GH-78.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Assign and Release Trucks During an Active Discharge" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the assignment and release commands in `apps/api` and their panel in the discharge detail workbench of `apps/web`. It absorbs the truck pool part of the former frontend-only slice "Discharge Detail: Dock Reassignment, Truck Pool, and Door Assignment Changes".
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/76
- Parent roadmap: specs/discharge-execution/runtime-discharge-resource-changes/roadmap.md
- Absorbed scope: the truck pool part of "Discharge Detail: Dock Reassignment, Truck Pool, and Door Assignment Changes", a frontend-only slice split between GH-75, GH-76 and GH-77 on 2026-09-10 and deleted from GitHub.
- Related domain: discharge-execution
