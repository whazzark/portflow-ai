# Specification Quality Checklist: Archive a Transport Company

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-24
**Last Updated**: 2026-08-24 — re-validated after bulk archival was added to scope
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
- The blocking lifecycle rule (a company still providing available trucks) is taken from the
  `CONTEXT.md` definition of Transport Company and is recorded explicitly in the Assumptions
  section; no separate transport-company usage check against planned or active discharges is
  specified because a reserved truck is necessarily available.
- Single-company archival with an optional comment follows the established customer, dock, and
  weighing-area archive journeys.
- **Scope change (2026-08-24)**: bulk archival is now in scope (US4, FR-023 to FR-035). The
  previous FR-023 excluding it has been replaced; the out-of-scope requirement is now FR-036.
  Bulk archival follows the partial-success model already delivered for customers — the request
  succeeds, eligible companies are archived, blocked ones are returned with an individual reason.
  Two consequences are recorded in the Assumptions rather than left implicit: one comment, actor,
  and time apply to the whole request, and no maximum selection size is imposed, matching the
  shared selection rule used by customer bulk lifecycle actions.
- Bulk reactivation remains outside this slice; it belongs to #221 alongside single reactivation.
