# Specification Quality Checklist: Update a Dock

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

- All checklist items pass on the first validation pass. No [NEEDS CLARIFICATION] markers were
  needed: the authorization model, the site-reference name rules (trim, max length, cross-status
  case-insensitive uniqueness), the coordinate ranges, and the archived-is-read-only rule all have
  established precedent from #197 (List Docks), #198 (Create a Dock), and the sibling
  `update-a-transport-company` slice, so reasonable defaults were used throughout and recorded in
  the Assumptions section.
- Map and marker interaction is described as observable user behavior — consistent with how
  `list-docks/spec.md` and `create-a-dock/spec.md` already describe map interactions — not as an
  implementation choice. How that interaction is built is a `plan.md` concern.
- Three judgment calls are worth a reviewer's explicit attention before planning, since each is an
  assumption rather than a stated requirement of the issue:
  1. **Scope of "mutable information"** is taken to be name + latitude + longitude, and explicitly
     not status (FR-003, FR-024); status transitions belong to #200/#201.
  2. **Concurrency** resolves as last-write-wins on the whole dock, with the saved result shown to
     the administrator — no optimistic-locking prompt in this slice.
  3. **Docks in use** by planned or in-progress discharges remain updatable, because discharges
     reference the dock by its stable identity (FR-018). If the product wants updates blocked while
     a dock is in operational use, that is a spec change, not a plan change.
