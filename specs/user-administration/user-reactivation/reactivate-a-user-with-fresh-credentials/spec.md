# Feature Specification: Reactivate a User with Fresh Credentials

**Feature ID**: `GH-32`
**GitHub Issue**: [#32](https://github.com/whazzark/portflow-ai/issues/32)
**Parent Roadmap**: `specs/user-administration/user-reactivation/roadmap.md`
**Roadmap Entry**: `GH-32`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P2
**Milestone**: 0. Sécuriser l'administration des utilisateurs
**Domain**: user-administration

## User Scenarios & Testing

### User Story 1 - Reactivate a User with Fresh Credentials (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Reactivate a User with Fresh Credentials" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Reactivate a User with Fresh Credentials".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Reactivate a User with Fresh Credentials" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-20: reactivating a user requires a deactivated one, which the deactivation
  command that slice delivers is what produces.
- It is the roadmap's only slice.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Reactivate a User with Fresh Credentials" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the reactivation command in `apps/api` and its action in the user workbench of `apps/web`. It absorbs the former frontend-only slice "Reactivate a User From the Web Workbench", which described the same outcome from the web side alone.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/32
- Parent roadmap: specs/user-administration/user-reactivation/roadmap.md
- Absorbed scope: "Reactivate a User From the Web Workbench", a frontend-only slice merged here on 2026-09-10 and deleted from GitHub.
- Related domain: user-administration
