# Feature Specification: Close a Discharge and Release Its Resources

**Feature ID**: `GH-98`
**GitHub Issue**: [#98](https://github.com/whazzark/portflow-ai/issues/98)
**Parent Roadmap**: `specs/reporting-and-audit/discharge-closure/roadmap.md`
**Roadmap Entry**: `GH-98`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 6. Finaliser l'exécution et livrer les rapports immuables
**Domain**: reporting-and-audit

## User Scenarios & Testing

### User Story 1 - Close a Discharge and Release Its Resources (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Close a Discharge and Release Its Resources" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Close a Discharge and Release Its Resources".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Close a Discharge and Release Its Resources" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-97: closing a discharge is refused until the readiness that slice computes is
  met, and the review is where the closure is started from.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Close a Discharge and Release Its Resources" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the closure command in `apps/api` and its action in the discharge detail workbench of `apps/web`. It absorbs the former frontend-only slice "Close a Discharge From the Frontend", which described the same outcome from the web side alone.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/98
- Parent roadmap: specs/reporting-and-audit/discharge-closure/roadmap.md
- Absorbed scope: "Close a Discharge From the Frontend", a frontend-only slice merged here on 2026-09-10 and deleted from GitHub.
- Related domain: reporting-and-audit
