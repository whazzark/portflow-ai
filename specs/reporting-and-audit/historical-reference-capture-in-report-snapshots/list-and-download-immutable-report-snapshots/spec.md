# Feature Specification: List and Download Immutable Report Snapshots

**Feature ID**: `GH-108`
**GitHub Issue**: [#108](https://github.com/whazzark/portflow-ai/issues/108)
**Parent Roadmap**: `specs/reporting-and-audit/historical-reference-capture-in-report-snapshots/roadmap.md`
**Roadmap Entry**: `GH-108`
**Created**: 2026-07-09
**Status**: Needs Clarification
**Priority**: priority:P2
**Milestone**: 6. Finaliser l'exécution et livrer les rapports immuables
**Domain**: reporting-and-audit

## User Scenarios & Testing

### User Story 1 - List and Download Immutable Report Snapshots (Priority: P1)

[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "List and Download Immutable Report Snapshots" before planning.]

**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.

**Acceptance Scenarios**:

1. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "List and Download Immutable Report Snapshots".

## Edge Cases

- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "List and Download Immutable Report Snapshots" is explicit and reviewable.

## Success Criteria

- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.
- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.

## Dependencies

- Blocked by GH-107: there is nothing to list or download before snapshots are generated, and the
  outdated marker it displays is set by a later adjustment on those same snapshots.

## Out of Scope

- Scope cannot be finalized until the missing behavioral contract is clarified.

## Assumptions and Clarifications

- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "List and Download Immutable Report Snapshots" before plan approval.]

## Source-derived decisions

- This slice is end-to-end: it owns both the listing and download queries in `apps/api` and the report snapshots screen in `apps/web`. It absorbs the former frontend-only slice "Build the Report Snapshots Screen", which described the same outcome from the web side alone.
- No separate implementation or testing decisions were recorded in the source issue.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/108
- Parent roadmap: specs/reporting-and-audit/historical-reference-capture-in-report-snapshots/roadmap.md
- Absorbed scope: "Build the Report Snapshots Screen", a frontend-only slice merged here on 2026-09-10 and deleted from GitHub.
- Related domain: reporting-and-audit
