# Specification Quality Checklist: Reactivate a User with Fresh Credentials

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-11
**Feature**: [spec.md](../spec.md) — `GH-32`

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

## Resolved clarifications

- **CLR-001** (resolved 2026-09-11): *Does the reactivation hand over a credential?* **No.** The
  reactivation records the access change and the renewal requirement and nothing else. The user
  signs in with the password they held before the deactivation and is taken to the renewal step.
  This mirrors `#17`'s CLR-001 and the `CONTEXT.md` definition of User Reactivation; "fresh
  credentials" in the title means the password the user chooses. Encoded in FR-012, FR-013,
  User Story 1 scenario 6, SC-008, the two residual-exposure edge cases (a known pre-deactivation
  password, a forgotten one), and the corresponding assumption.

## Notes

- The refusal reasons (`NOT_FOUND`, `PENDING_INVITATION`, `CANCELLED_INVITATION`,
  `ALREADY_ACTIVE`) are domain outcomes named the same way as `#20`'s deactivation blockers, not
  transport details.
- The mentions of `apps/api` and `apps/web` under "Source-derived decisions" record the slice's
  vertical scope, following the roadmap convention shared by every sibling spec. They prescribe no
  design.
- User Story 4 and FR-014 carry the one security decision that isn't inherited from `#17`: no
  session or remembered connection from before the reactivation grants anything after it.
  Deactivation already revokes remembered connections. Whether a session left over from before the
  deactivation needs an explicit measure is left to `/speckit-plan`, as the assumption states.
- The accepted residual exposures of CLR-001 are recorded as edge cases so that the plan inherits
  them as decisions rather than oversights.
