# Feature Specification: Remove a Never-Activated User Permanently

**Feature ID**: `GH-14`
**GitHub Issue**: [#14](https://github.com/whazzark/portflow-ai/issues/14)
**Parent Roadmap**: `specs/user-administration/invitation-administration/roadmap.md`
**Roadmap Entry**: `GH-14`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 0. Sécuriser l'administration des utilisateurs
**Domain**: user-administration

## User Scenarios & Testing

### User Story 1 - Remove a Never-Activated User Permanently (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Remove a Never-Activated User Permanently" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Remove a Never-Activated User Permanently".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Remove a Never-Activated User Permanently" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-7: removing a never-activated user requires a pending user to remove.
- Deliverable in parallel with GH-12: neither blocks the other.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Remove a Never-Activated User Permanently" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the removal command in `apps/api` and its action in the user workbench of `apps/web`. It absorbs the removal part of the former frontend-only slice "Manage Invitation Lifecycle From the Web Workbench".
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/14
- Parent roadmap: specs/user-administration/invitation-administration/roadmap.md
- Absorbed scope: the removal part of "Manage Invitation Lifecycle From the Web Workbench", a frontend-only slice split between GH-9, GH-12, GH-13 and GH-14 on 2026-09-10 and closed on GitHub.
- Related domain: user-administration
