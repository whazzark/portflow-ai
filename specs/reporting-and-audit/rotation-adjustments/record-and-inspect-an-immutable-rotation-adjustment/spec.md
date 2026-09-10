# Feature Specification: Record and Inspect an Immutable Rotation Adjustment

**Feature ID**: `GH-93`
**GitHub Issue**: [#93](https://github.com/whazzark/portflow-ai/issues/93)
**Parent Roadmap**: `specs/reporting-and-audit/rotation-adjustments/roadmap.md`
**Roadmap Entry**: `GH-93`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 6. Finaliser l'exécution et livrer les rapports immuables
**Domain**: reporting-and-audit

## User Scenarios & Testing

### User Story 1 - Record and Inspect an Immutable Rotation Adjustment (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Record and Inspect an Immutable Rotation Adjustment" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Record and Inspect an Immutable Rotation Adjustment".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Record and Inspect an Immutable Rotation Adjustment" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-89: an adjustment is a post-validation correction, so it presupposes a validated
  rotation.
- It is the entry point of this roadmap's execution order: GH-94 depends on it.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Record and Inspect an Immutable Rotation Adjustment" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the adjustment command and its inspection in `apps/api` and the creation form in `apps/web`. It absorbs the former frontend-only slice "Build the Rotation Adjustment Creation UI", which described the same outcome from the web side alone.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/93
- Parent roadmap: specs/reporting-and-audit/rotation-adjustments/roadmap.md
- Absorbed scope: "Build the Rotation Adjustment Creation UI", a frontend-only slice merged here on 2026-09-10 and deleted from GitHub.
- Related domain: reporting-and-audit
