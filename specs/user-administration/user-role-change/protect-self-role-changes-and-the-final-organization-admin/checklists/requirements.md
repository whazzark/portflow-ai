# Specification Quality Checklist: Protect Self-Role Changes and the Final Organization Admin

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-11
**Feature**: [spec.md](../spec.md)
**Feature ID**: `GH-29`

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

- [X] An organization admin cannot change their own role, whatever role is submitted and however their identifier is written (FR-001, FR-002, FR-003, US1). — unit `change_role.spec.ts` "refuses an administrator changing their own role, whatever the role", "refuses a self-role change whose identifier is upper-cased", "refuses a self-role change before reading anything"; integration `change_role.spec.ts` "refuses an organization admin changing their own role" (409, code, exact message, all four roles) and "refuses a self-role change named in upper case"
- [X] Only viewers permitted to change roles reach the self-role-change refusal; every other viewer gets GH-28's denial (FR-011, US1). — integration "denies a non-admin naming themselves exactly as naming anyone", which compares the two 403 bodies
- [X] No role change leaves the organization without an active organization admin, judged when the change is applied, including after concurrent role changes and prior deactivations (FR-004, FR-005, FR-006, US2). — unit `final_admin.spec.ts` "refuses demoting the only active organization admin", "no longer counts an admin deactivated before the change is applied", "no longer counts an admin demoted before the change is applied", "does not count pending or cancelled organization admins", "lets three admins lose two, never three"; integration `final_admin.spec.ts` "keeps exactly one active organization admin when two admins demote each other" (50 rounds)
- [X] The final admin refusal states the rule and discloses neither the number nor the identity of the remaining organization admins (FR-007, US2). — unit "refuses demoting the only active organization admin" asserts the exact message, status, and code; the integration collision asserts the same body whenever the loser is a 409
- [X] The protection refuses nothing that leaves an active organization admin: GH-28's behavior is otherwise unchanged (FR-008, FR-014, US2). — unit "demotes an organization admin while another remains active", "always lets a pending or cancelled organization admin be demoted", "never refuses the organization admin role to the only active admin", "never refuses a promotion to organization admin"; integration "still demotes an organization admin while the requester remains one"; every GH-28 role-change test unchanged and green
- [X] A refused role change modifies no user and is not recorded (FR-009). — unit "leaves every user untouched on a refusal" (full-row snapshot of the target and of the deactivated admin); GH-28's "records no trace of the change" still green
- [X] The workbench offers no role change on the viewer's own record, even when reached directly (FR-010, US1). — web `role-change/permissions.test.tsx` "offers no role control on the viewer’s own record, even when the mode is typed by hand"
- [X] A refusal is reported with its reason in a way that outlives the `Edit` panel, the target is shown as they stand, an already-applied identity correction is kept, and the workbench follows the administrator's own demotion or deactivation at once (FR-012, FR-013, US3). — web `role-change/final-admin.test.tsx` "follows a viewer demoted in the same collision", "sends a viewer deactivated in the same collision to sign-in", "keeps an identity correction that landed before the refusal"; `authenticated-layout/session-lost.test.tsx`

## Verification

- [X] Each item maps to a test or reviewable behavior.
- [X] API and web seams are covered where applicable, including a repeated concurrency test for SC-002. — 19 new Japa tests (US1: 4 unit, 3 integration; US2: 10 unit, 2 integration) and 5 new Vitest tests. On PostgreSQL (T027) all 50 rounds ended with one `200` and one `409 E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN`; with the locking clause removed, the first round let both demotions through
- [X] No requirement is implemented outside the approved spec. — the one change reaching beyond `/users` is the `AuthenticatedLayout` redirect on a lost session, which FR-012 requires and research D8 records; it applies to every authenticated page

## Notes

- Every quality item passes on the first validation pass; no clarification markers were needed.
- The spec replaces the placeholder generated at migration (2026-07-28), in place, at the path the
  issue names.
- Revised during planning (2026-09-11): US3, FR-012, and SC-005 no longer keep a refused
  administrator in the `Edit` panel, because the final admin refusal only reaches one who has just
  lost that role or their access (spec, Revisions). All quality items still pass.
- Open cross-slice risk, carried into planning: the rule holds against every combination of
  concurrent role changes and deactivations only once GH-21 has also shipped. Until then, a demotion
  and a deactivation applied at the same moment can still leave no active organization admin
  (spec, Out of Scope).
