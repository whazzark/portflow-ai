# Specification Quality Checklist: Change Another Eligible User Role

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-10
**Feature**: [spec.md](../spec.md)
**Feature ID**: `GH-28`

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

## Source acceptance criteria

- [X] An organization admin changes another user's role among the four roles (FR-001, US1). — `unit/users/role_change` "changes the role of an eligible user whatever their access status"; `integration/users/role_change` "changes an eligible user role and returns the administration projection"; web `role-change/change.test.tsx`
- [X] Pending, active, and cancelled users are eligible; deactivated users are refused until reactivated (FR-002, FR-003, US1, US2). — unit "leaves the access status untouched" + "refuses a deactivated user"; integration "changes the role of a user in every eligible access status" + "refuses a deactivated target and names reactivation"
- [X] The change modifies the role and nothing else (FR-005, US1). — unit "moves nothing but the role" and "leaves a refused user completely untouched", both a full-row comparison
- [X] Only active organization admins may change a role; the API is the boundary (FR-007, FR-008, US3). — integration "denies every role but organization admin", "rejects an unauthenticated role change", "denies a viewer whose access status is not active"; web `role-change/permissions.test.tsx`
- [X] Refusals disclose nothing about users the caller may not consult (FR-009, US3). — integration "denies an unauthorized viewer identically whatever the id names", which compares the four responses byte for byte
- [X] The new role governs the target user's authorization immediately, without signing them out (FR-010, FR-011, US4). — integration "judges the target next request by their new role, without signing them out", "reports the new role on the target own session", "records no password renewal requirement on the target"; web `role-change/session.test.tsx`
- [X] Failures are distinguishable from refusals and are retryable (FR-015, US5). — web `role-change/recovery.test.tsx`, both tests
- [X] The change is applied in place, with no dated, attributed, or previous-role record kept (FR-016). — unit "records no trace of the change"; no migration in the diff
- [X] A pending user's activation link and invitation are untouched by the change (FR-017). — unit "moves nothing but the role" on an `invited` user; there is no activation-link column for this slice to touch
- [X] Self-role changes and the final-organization-admin protection stay out of scope and ship with GH-29. — absent by construction: no such refusal exists in `ChangeUserRoleUseCase` or `UserPolicy.changeRole`

## Verification

- [X] Each item maps to a test or reviewable behavior.
- [X] API and web seams are covered where applicable. — 26 Japa tests across `unit/users/role_change` and `integration/users/role_change`; 16 Vitest tests across `features/users/__tests__/role-change`
- [X] No requirement is implemented outside the approved spec.

## Notes

- Every item passes. The delivery verification items were satisfied by the implementation and name
  the test that covers each.
- Clarifications resolved on 2026-09-10: the role change is untraced (FR-016), and pending and
  cancelled users stay eligible with the activation link reissue deferred to the invitation slice
  that owns links (FR-017).
- Revised on 2026-09-11: the role change is offered in GH-24's `Edit` panel rather than a panel of
  its own (spec Clarifications, Session 2026-09-11). The web tests go through `Edit` → `Save
  changes`, and `role-change/change.test.tsx` also proves each seam receives only what changed.
- Delivery risk, still open and now carried into the PR: GH-29 must ship before this action is
  exposed to production users, since this slice alone lets an organization admin demote themselves
  or the last remaining organization admin.
