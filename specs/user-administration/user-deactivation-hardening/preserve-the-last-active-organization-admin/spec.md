# Feature Specification: Preserve the Last Active Organization Admin

**Feature ID**: `GH-21`
**GitHub Issue**: [#21](https://github.com/whazzark/portflow-ai/issues/21)
**Parent Roadmap**: `specs/user-administration/user-deactivation-hardening/roadmap.md`
**Roadmap Entry**: `GH-21`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P2
**Milestone**: 0. Sécuriser l'administration des utilisateurs
**Domain**: user-administration

## User Scenarios & Testing

### User Story 1 - Preserve the Last Active Organization Admin (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Preserve the Last Active Organization Admin" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Preserve the Last Active Organization Admin".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Preserve the Last Active Organization Admin" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-20: the last-admin guard extends the deactivation command and the refusal path
  that slice delivers, and surfaces in the same workbench action.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Preserve the Last Active Organization Admin" before plan approval.]

## Source-derived decisions

- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/21
- Parent roadmap: specs/user-administration/user-deactivation-hardening/roadmap.md
- Related domain: user-administration
