# Specification Quality Checklist: Reactivate a Transport Company

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-24
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
- **No blocking lifecycle rule.** The `CONTEXT.md` available-truck rule constrains archiving a
  transport company, not restoring one. FR-006 states the absence of an extra condition explicitly
  rather than leaving it implicit, and SC-005 makes it verifiable. This is the main asymmetry with
  the delivered archival slice (#220) and the reason its three-blocker outcome vocabulary reduces
  to two here (`already available`, `not found`).
- **Name uniqueness is not a refusal path.** A company's name stays reserved while it is archived,
  so reactivation cannot collide with another company's name. Recorded in the Assumptions so a
  reviewer can challenge the premise rather than discover a missing 409 during planning.
- **Trucks are untouched.** FR-015 and the edge cases state that reactivating a company does not
  reactivate its trucks, and that an available company temporarily providing no available truck is
  an accepted state. This is the consequence reviewers are most likely to want confirmed.
- **Lifecycle context semantics.** FR-011 and FR-012 record the two halves that the delivered
  site-reference lifecycle model already implies: a reactivation replaces any earlier reactivation
  context and preserves the most recent archival context as history.
- Bulk reactivation (US3, FR-021 to FR-033) is in scope, as anticipated by the archival slice's
  checklist note. It follows the same partial-success model as bulk archival, with one comment,
  actor, and time per request and no maximum selection size.
