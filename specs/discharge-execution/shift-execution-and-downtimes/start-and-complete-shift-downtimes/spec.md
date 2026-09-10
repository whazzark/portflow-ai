# Feature Specification: Start and Complete Shift Downtimes

**Feature ID**: `GH-67`
**GitHub Issue**: [#67](https://github.com/whazzark/portflow-ai/issues/67)
**Parent Roadmap**: `specs/discharge-execution/shift-execution-and-downtimes/roadmap.md`
**Roadmap Entry**: `GH-67`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 5. Livrer l'exécution opérationnelle interactive
**Domain**: discharge-execution

## User Scenarios & Testing

### User Story 1 - Start and Complete Shift Downtimes (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Start and Complete Shift Downtimes" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Start and Complete Shift Downtimes".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Start and Complete Shift Downtimes" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-65: a downtime is a timed event inside an active shift's actual period, and that
  slice is what makes a shift active.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Start and Complete Shift Downtimes" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the downtime lifecycle in `apps/api` and its recording in the shift workspace of `apps/web`. It absorbs the recording part of the former frontend-only slice "Downtime Recording and Shift/Downtime Corrections"; its correction parts belong to GH-70 and GH-71.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/67
- Parent roadmap: specs/discharge-execution/shift-execution-and-downtimes/roadmap.md
- Absorbed scope: the downtime recording part of "Downtime Recording and Shift/Downtime Corrections", a frontend-only slice split between GH-67, GH-70 and GH-71 on 2026-09-10 and closed on GitHub.
- Related domain: discharge-execution
