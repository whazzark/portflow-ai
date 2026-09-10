# Feature Specification: Validate a Completed Rotation Irreversibly

**Feature ID**: `GH-89`
**GitHub Issue**: [#89](https://github.com/whazzark/portflow-ai/issues/89)
**Parent Roadmap**: `specs/reporting-and-audit/rotation-validation/roadmap.md`
**Roadmap Entry**: `GH-89`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 6. Finaliser l'exécution et livrer les rapports immuables
**Domain**: reporting-and-audit

## User Scenarios & Testing

### User Story 1 - Validate a Completed Rotation Irreversibly (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Validate a Completed Rotation Irreversibly" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Validate a Completed Rotation Irreversibly".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Validate a Completed Rotation Irreversibly" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-84: only a completed rotation can be validated, and that slice is what completes
  one.
- It is the entry point of this roadmap's execution order: GH-90 depends on it.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Validate a Completed Rotation Irreversibly" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the irreversible validation command in `apps/api` and its action in `apps/web`. It absorbs the validation action of the former frontend-only slice "Build the Rotation Validation Queue Screen"; the queue screen itself belongs to GH-90.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/89
- Parent roadmap: specs/reporting-and-audit/rotation-validation/roadmap.md
- Absorbed scope: the validation action of "Build the Rotation Validation Queue Screen", a frontend-only slice split between GH-89 and GH-90 on 2026-09-10 and closed on GitHub.
- Related domain: reporting-and-audit
