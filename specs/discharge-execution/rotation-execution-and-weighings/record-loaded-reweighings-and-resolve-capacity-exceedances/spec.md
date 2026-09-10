# Feature Specification: Record Loaded Reweighings and Resolve Capacity Exceedances

**Feature ID**: `GH-83`
**GitHub Issue**: [#83](https://github.com/whazzark/portflow-ai/issues/83)
**Parent Roadmap**: `specs/discharge-execution/rotation-execution-and-weighings/roadmap.md`
**Roadmap Entry**: `GH-83`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 5. Livrer l'exécution opérationnelle interactive
**Domain**: discharge-execution

## User Scenarios & Testing

### User Story 1 - Record Loaded Reweighings and Resolve Capacity Exceedances (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Record Loaded Reweighings and Resolve Capacity Exceedances" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Record Loaded Reweighings and Resolve Capacity Exceedances".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Record Loaded Reweighings and Resolve Capacity Exceedances" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-82: a loaded weighing is recorded against the rotation that slice opens, and its
  capacity check compares the result with the truck captured there.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Record Loaded Reweighings and Resolve Capacity Exceedances" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the loaded weighing and reweighing commands in `apps/api` and their entry in the shift workspace of `apps/web`. It absorbs the loaded weighing part of the former frontend-only slice "Record Loaded Weighing and Confirm Empty Return in the Shift Workspace"; its empty return part belongs to GH-84.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/83
- Parent roadmap: specs/discharge-execution/rotation-execution-and-weighings/roadmap.md
- Absorbed scope: the loaded weighing part of "Record Loaded Weighing and Confirm Empty Return in the Shift Workspace", a frontend-only slice split between GH-83 and GH-84 on 2026-09-10 and deleted from GitHub.
- Related domain: discharge-execution
