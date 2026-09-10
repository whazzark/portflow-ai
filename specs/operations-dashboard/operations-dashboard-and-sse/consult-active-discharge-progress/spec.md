# Feature Specification: Consult Active Discharge Progress

**Feature ID**: `GH-111`
**GitHub Issue**: [#111](https://github.com/whazzark/portflow-ai/issues/111)
**Parent Roadmap**: `specs/operations-dashboard/operations-dashboard-and-sse/roadmap.md`
**Roadmap Entry**: `GH-111`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P2
**Milestone**: 7. Finaliser la synchronisation et l'observabilité opérationnelle
**Domain**: operations-dashboard

## User Scenarios & Testing

### User Story 1 - Consult Active Discharge Progress (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Consult Active Discharge Progress" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Consult Active Discharge Progress".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Consult Active Discharge Progress" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-65: the dashboard shows active discharges with their active shift, and that slice
  is what activates both.
- Blocked by GH-84: realized tonnage and validation progress are computed from completed
  rotations, which that slice is what completes.
- The blockers it carried on GH-237 and GH-238 are void: both were closed as not planned, and the
  persistence they promised moved into the execution slices above.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Consult Active Discharge Progress" before plan approval.]

## Source-derived decisions

- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/111
- Parent roadmap: specs/operations-dashboard/operations-dashboard-and-sse/roadmap.md
- Related domain: operations-dashboard
