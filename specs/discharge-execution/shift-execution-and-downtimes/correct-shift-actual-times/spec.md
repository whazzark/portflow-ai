# Feature Specification: Correct Shift Actual Times

**Feature ID**: `GH-70`
**GitHub Issue**: [#70](https://github.com/whazzark/portflow-ai/issues/70)
**Parent Roadmap**: `specs/discharge-execution/shift-execution-and-downtimes/roadmap.md`
**Roadmap Entry**: `GH-70`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 5. Livrer l'exécution opérationnelle interactive
**Domain**: discharge-execution

## User Scenarios & Testing

### User Story 1 - Correct Shift Actual Times (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Correct Shift Actual Times" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Correct Shift Actual Times".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Correct Shift Actual Times" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-68: correcting actual times covers the recorded start and end of a shift, which
  that slice is what records.
- Deliverable in parallel with GH-69.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Correct Shift Actual Times" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the time correction command in `apps/api` and its form in the shift workspace of `apps/web`. It absorbs the shift time correction part of the former frontend-only slice "Downtime Recording and Shift/Downtime Corrections".
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/70
- Parent roadmap: specs/discharge-execution/shift-execution-and-downtimes/roadmap.md
- Absorbed scope: the shift time correction part of "Downtime Recording and Shift/Downtime Corrections", a frontend-only slice split between GH-67, GH-70 and GH-71 on 2026-09-10 and deleted from GitHub.
- Related domain: discharge-execution
