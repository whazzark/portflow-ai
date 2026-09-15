# Specification Quality Checklist: Correct a Customer's Product Lots at Once

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-15
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

- The three clarifications (adding and removing lots, moving the group to another customer, keeping
  the single-lot correction) were answered on 2026-09-15 and recorded in the spec.
- Moving a group to a customer that already has lots joins them, with a product name clash refusing
  the change; recorded as an assumption, to confirm at spec review.
- The Assumptions section names the reuse of the existing customer-block editor: it is kept as a
  product-level assumption (same entry and feedback behavior as adding lots), not as an
  implementation choice.
- Implemented on 2026-09-15. Deviations from `tasks.md`, recorded there: the new web adapters and
  their tests live in their own files (`customer-lots-correction.ts`,
  `customer-product-lots-schema.test.ts`), and the US2 web assertions sit in
  `correct-customer-product-lots.test.tsx`, to stay clear of concurrent shift work on
  `discharge-detail-view.ts` and its tests. A name clash is shown on each clashing row, as the API
  reports it.
- Delivered under GH-55 on its branch, by decision of 2026-09-15, rather than under an issue of its
  own.
