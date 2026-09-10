# Feature Specification: Accept an Invitation and Open an Authenticated Session

**Feature ID**: `GH-8`
**GitHub Issue**: [#8](https://github.com/whazzark/portflow-ai/issues/8)
**Parent Roadmap**: `specs/user-administration/invitation-onboarding/roadmap.md`
**Roadmap Entry**: `GH-8`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 0. Sécuriser l'administration des utilisateurs
**Domain**: user-administration

## User Scenarios & Testing

### User Story 1 - Accept an Invitation and Open an Authenticated Session (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Accept an Invitation and Open an Authenticated Session" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Accept an Invitation and Open an Authenticated Session".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Accept an Invitation and Open an Authenticated Session" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-7: accepting an invitation requires a pending user and the confidential
  activation link that slice issues.
- Deliverable in parallel with GH-9: neither blocks the other.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Accept an Invitation and Open an Authenticated Session" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the acceptance command in `apps/api` and the activation screen in `apps/web`. It absorbs the acceptance half of the former frontend-only slice "Invite and Accept an Invitation Through the Frontend"; its invitation half belongs to GH-7.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/8
- Parent roadmap: specs/user-administration/invitation-onboarding/roadmap.md
- Absorbed scope: the acceptance half of "Invite and Accept an Invitation Through the Frontend", a frontend-only slice split between GH-7 and GH-8 on 2026-09-10 and closed on GitHub.
- Related domain: user-administration
