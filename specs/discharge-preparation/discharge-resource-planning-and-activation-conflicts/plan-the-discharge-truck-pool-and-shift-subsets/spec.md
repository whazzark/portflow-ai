# Feature Specification: Plan the discharge truck pool and shift subsets

**Feature ID**: `GH-55`
**GitHub Issue**: [#55](https://github.com/whazzark/portflow-ai/issues/55)
**Parent Roadmap**: `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md`
**Roadmap Entry**: `GH-55`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P1
**Milestone**: 4. Livrer la préparation interactive d'une Discharge
**Domain**: discharge-preparation

## User Scenarios & Testing

### User Story 1 - Plan the discharge truck pool and shift subsets (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "Plan the discharge truck pool and shift subsets" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "Plan the discharge truck pool and shift subsets".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "Plan the discharge truck pool and shift subsets" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-53: the per-shift subsets of the truck pool are held per shift, so the planned
  shifts created by GH-53 must exist before this slice has anything to subset.
- Deliverable in parallel with GH-54: neither blocks the other, but both add a panel to the same
  discharge detail workbench.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "Plan the discharge truck pool and shift subsets" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the truck pool commands in `apps/api` and their planning screen in `apps/web`. It absorbs the truck pool half of the former frontend-only slice "Update Discharge Resource Planning From the Frontend"; its warehouse door and checkpoint half belongs to GH-54.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/55
- Parent roadmap: specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/roadmap.md
- Absorbed scope: the truck pool half of "Update Discharge Resource Planning From the Frontend", a frontend-only slice split between GH-54 and GH-55 on 2026-09-10 and deleted from GitHub.
- Related domain: discharge-preparation
