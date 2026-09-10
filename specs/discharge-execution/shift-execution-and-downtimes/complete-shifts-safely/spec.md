# Feature Specification: Complete Shifts Safely

**Feature ID**: `GH-68`
**GitHub Issue**: [#68](https://github.com/whazzark/portflow-ai/issues/68)
**Parent Roadmap**: `specs/discharge-execution/shift-execution-and-downtimes/roadmap.md`
**Roadmap Entry**: `GH-68`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 5. Livrer l'exécution opérationnelle interactive
**Domain**: discharge-execution

## User Scenarios & Testing

### User Story 1 - Complete Shifts Safely (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Complete Shifts Safely" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Complete Shifts Safely".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Complete Shifts Safely" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-67: a shift cannot be completed while a downtime is ongoing, so completion needs
  the downtime lifecycle that slice delivers.
- Deliverable in parallel with GH-71.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Complete Shifts Safely" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the completion command in `apps/api` and the completion action of the shift workspace in `apps/web`. It absorbs the completion action from the former frontend-only slice "Shift Workspace: Start, Live View, and Completion"; the workspace itself belongs to GH-65.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/68
- Parent roadmap: specs/discharge-execution/shift-execution-and-downtimes/roadmap.md
- Absorbed scope: the completion action from "Shift Workspace: Start, Live View, and Completion", a frontend-only slice split between GH-65 and GH-68 on 2026-09-10 and closed on GitHub.
- Related domain: discharge-execution
