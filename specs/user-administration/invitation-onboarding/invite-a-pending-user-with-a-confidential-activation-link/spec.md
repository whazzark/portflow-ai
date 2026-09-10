# Feature Specification: Invite a Pending User with a Confidential Activation Link

**Feature ID**: `GH-7`
**GitHub Issue**: [#7](https://github.com/whazzark/portflow-ai/issues/7)
**Parent Roadmap**: `specs/user-administration/invitation-onboarding/roadmap.md`
**Roadmap Entry**: `GH-7`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 0. Sécuriser l'administration des utilisateurs
**Domain**: user-administration

## User Scenarios & Testing

### User Story 1 - Invite a Pending User with a Confidential Activation Link (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Invite a Pending User with a Confidential Activation Link" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Invite a Pending User with a Confidential Activation Link".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Invite a Pending User with a Confidential Activation Link" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- None. No open issue blocks this slice: the users it invites, their roles, and their access
  statuses are already persisted, and the user workbench that hosts the invitation already exists.
- It is the entry point of the roadmap's execution order: GH-8 and GH-9 depend on it.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Invite a Pending User with a Confidential Activation Link" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the invitation command in `apps/api` and the invitation screen in `apps/web`. It absorbs the invitation half of the former frontend-only slice "Invite and Accept an Invitation Through the Frontend"; its acceptance half belongs to GH-8.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/7
- Parent roadmap: specs/user-administration/invitation-onboarding/roadmap.md
- Absorbed scope: the invitation half of "Invite and Accept an Invitation Through the Frontend", a frontend-only slice split between GH-7 and GH-8 on 2026-09-10 and deleted from GitHub.
- Related domain: user-administration
