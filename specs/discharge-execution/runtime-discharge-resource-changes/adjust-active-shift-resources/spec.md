# Feature Specification: Adjust Active Shift Resources

**Feature ID**: `GH-78`
**GitHub Issue**: [#78](https://github.com/whazzark/portflow-ai/issues/78)
**Parent Roadmap**: `specs/discharge-execution/runtime-discharge-resource-changes/roadmap.md`
**Roadmap Entry**: `GH-78`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 5. Livrer l'exécution opérationnelle interactive
**Domain**: discharge-execution

## User Scenarios & Testing

### User Story 1 - Adjust Active Shift Resources (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Adjust Active Shift Resources" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Adjust Active Shift Resources".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Adjust Active Shift Resources" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-65: a shift adjustment acts on an active shift, and that slice is what starts one.
- Deliverable in parallel with GH-75, GH-76 and GH-77.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Adjust Active Shift Resources" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the adjustment commands in `apps/api` and their forms in the shift workspace of `apps/web`. It absorbs the former frontend-only slice "Shift Resource Adjustments in the Shift Workspace", which described the same outcome from the web side alone.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/78
- Parent roadmap: specs/discharge-execution/runtime-discharge-resource-changes/roadmap.md
- Absorbed scope: "Shift Resource Adjustments in the Shift Workspace", a frontend-only slice merged here on 2026-09-10 and deleted from GitHub.
- Related domain: discharge-execution
