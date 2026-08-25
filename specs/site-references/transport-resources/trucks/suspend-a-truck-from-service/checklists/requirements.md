# Specification Quality Checklist: Suspend a Truck From Service

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-25
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

- Iteration 1 raised three [NEEDS CLARIFICATION] markers; all three were answered and folded into
  the spec, and iteration 2 passes every item.
  1. **Effect on existing operational involvement** — suspension gates new operational use only. It
     is never refused because the truck is assigned to a planned or active discharge, to an active
     shift, or holds an in-progress rotation, and it never unwinds that involvement (FR-017 to
     FR-020, User Story 2, SC-005, SC-006).
  2. **Reason capture** — an optional free-text comment, identical to the archive and reactivation
     comments, rather than a fixed reason list or an expected return date (FR-009, FR-010).
  3. **Batch action** — out of scope. Suspension is one truck per action, unlike the multiple
     archival and multiple reactivation already delivered (FR-026).
- Rules the issue settled on its own, needing no clarification: an archived truck must be
  reactivated before it can be suspended, and a suspended truck cannot be archived directly, both
  following from "Archiving and reactivation keep their own rules and are untouched here"; and the
  reverse transition is excluded, being issue `#253`.
- Two derived rules deserve attention at plan review, because neither is stated in the issue and
  both constrain existing delivered behaviour:
  - A continuation accompanying an empty return confirmation is refused for a suspended truck,
    since it opens the next rotation and a suspended truck is not rotation-eligible; completing the
    rotation without continuation still succeeds (FR-019, FR-020, User Story 2 scenario 4).
  - An active shift whose assigned trucks are all suspended keeps its assignments and therefore
    still satisfies the minimum-resource rule; it simply cannot start new rotations (FR-018,
    Assumptions).
- One reference to `apps/api/database/fixtures/trucks.ts` is retained in User Story 1 and in the
  Assumptions because the issue itself cites that file as the evidence of the workaround this slice
  replaces. It names an existing data defect, not an implementation choice.
- The spec notes that this slice delivers a lifecycle state a truck can enter but not leave through
  the product until Return a Truck to Service (`#253`) ships. That is the boundary the issue draws,
  and it is recorded explicitly rather than silently accepted.
