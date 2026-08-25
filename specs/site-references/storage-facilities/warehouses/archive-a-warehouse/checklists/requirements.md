# Specification Quality Checklist: Archive a Warehouse

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

- Validation performed 2026-08-25 against the issue #210 contract. Four user stories, 46 functional
  requirements, and 13 success criteria were reviewed; no failing items remained after the first
  pass.
- Two scope decisions were put to the product owner before drafting and are recorded in the spec's
  Clarifications section rather than left as `[NEEDS CLARIFICATION]` markers:
  1. **Single and multiple archival**, matching the five delivered sibling archive slices
     (`GH-195`, `GH-220`, `GH-225`, `GH-200`, `GH-205`).
  2. **Archival cascades to the warehouse's available doors** in the same action and with the same
     lifecycle context.

### Open item for plan review — `CONTEXT.md` conflict

- `CONTEXT.md:152` currently states that a warehouse "cannot be archived while it still has available
  warehouse doors". The cascade decision replaces that rule. The spec records the required amendment
  as an explicit assumption, but **the `Warehouse` entry in `CONTEXT.md` must be updated as part of
  this delivery** — constitution principle VI forbids leaving a canonical domain decision stated two
  different ways.
- The nearest delivered analogue, `archive-a-transport-company` (`GH-220` FR-003), enforces the
  non-cascading form of this rule for transport companies and their trucks. Warehouses will
  deliberately differ. `/speckit-plan` should confirm that divergence is intended before implementing.

### Inherited rather than redefined

- Door usage is the shared site-reference usage rule (`#240` FR-006): a current product lot
  assignment in a Planned or Active Discharge. The spec reuses it and adds no second definition.
- The 1,000-character comment limit and the partial-success model are carried from the delivered
  customer, transport-company, truck, dock, and weighing-area lifecycle slices.
- Archived-warehouse visibility follows List Warehouses (`#207`): readable by every active user, not
  administrators only. This differs from the weighing-area and truck archive slices and is stated as
  an assumption.

### Known interface gap

- Multiple archival needs a selection model on the warehouse map that `#207` did not deliver.
  `#200` and `#205` delivered that model for point markers on the Checkpoints map, which `#207`
  established as the shared consultation contract. FR-045 requires generalizing it to warehouse
  polygons rather than building a second model — this is the largest interface risk in the slice and
  should receive an explicit plan decision.
