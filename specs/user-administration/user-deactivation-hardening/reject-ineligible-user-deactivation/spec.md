# Feature Specification: Reject Ineligible User Deactivation

**Feature ID**: `GH-20`
**GitHub Issue**: [#20](https://github.com/whazzark/portflow-ai/issues/20)
**Parent Roadmap**: `specs/user-administration/user-deactivation-hardening/roadmap.md`
**Roadmap Entry**: `GH-20`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P2
**Milestone**: 0. Sécuriser l'administration des utilisateurs
**Domain**: user-administration

## User Scenarios & Testing

### User Story 1 - Reject Ineligible User Deactivation (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Reject Ineligible User Deactivation" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Reject Ineligible User Deactivation".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Reject Ineligible User Deactivation" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- None. No open issue blocks this slice: the access statuses it changes and the user workbench
  that lists them are already delivered.
- It is the entry point of the roadmap's execution order: GH-21 depends on it.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Reject Ineligible User Deactivation" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the deactivation command with its eligibility rules in `apps/api` and its action in the user workbench of `apps/web`. It absorbs the former frontend-only slice "Deactivate a User From the Web Workbench", which described the same outcome from the web side alone.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/20
- Parent roadmap: specs/user-administration/user-deactivation-hardening/roadmap.md
- Absorbed scope: "Deactivate a User From the Web Workbench", a frontend-only slice merged here on 2026-09-10 and closed on GitHub.
- Related domain: user-administration
