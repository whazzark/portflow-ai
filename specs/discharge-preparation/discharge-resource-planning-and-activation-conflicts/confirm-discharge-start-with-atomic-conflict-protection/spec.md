# Feature Specification: Confirm discharge start with conflict protection and handling

**Feature ID**: `GH-56`
**GitHub Issue**: [#56](https://github.com/whazzark/portflow-ai/issues/56)
**Parent Roadmap**: `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md`
**Roadmap Entry**: `GH-56`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 4. Livrer la préparation interactive d'une Discharge
**Domain**: discharge-preparation

## User Scenarios & Testing

### User Story 1 - Confirm discharge start with conflict protection and handling (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Confirm discharge start with conflict protection and handling" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Confirm discharge start with conflict protection and handling".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Confirm discharge start with conflict protection and handling" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-54 and GH-55: the confirmation checks that the required warehouse door assignments
  match the discharge, and activating the first shift requires it to hold at least one assigned
  truck, warehouse door, and weighing area. GH-53 blocks this slice transitively through both.
- Last slice of the roadmap's execution order.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Confirm discharge start with conflict protection and handling" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: the atomic reservation in `apps/api` and the way a conflict is shown and recovered from in `apps/web` are one business rule and share a single conflict taxonomy. It absorbs the former frontend-only slice "Confirm Discharge Start With Visible Conflict Handling".
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/56
- Parent roadmap: specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md
- Absorbed scope: "Confirm Discharge Start With Visible Conflict Handling", a frontend-only slice merged here on 2026-09-10 and deleted from GitHub.
- Related domain: discharge-preparation
