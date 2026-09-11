# Specification Quality Checklist: Remove a Never-Activated User Permanently

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-11
**Feature**: [spec.md](../spec.md)
**Feature ID**: `GH-14`

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

- [X] An organization admin permanently removes a pending or a cancelled user (FR-001, FR-006, US1). — `unit/users/removal` "removes a pending and a cancelled user"; `integration/users/removal` "removes a pending and a cancelled user with an empty 204" and "no longer lists the removed user in the collection"; web `removal/journey.test.tsx` and `row-menu.test.tsx`
- [X] Active and deactivated users are refused, each with the reason and the action that applies (FR-002, FR-003, US2). — unit "refuses an active user and names deactivation", "refuses a deactivated user, who is kept"; integration the same two plus "refuses the requesting organization admin their own record"; web `removal/refusals.test.tsx` "reports %s with its own reason"
- [X] Eligibility is judged against the user's state at execution, and concurrent actions never leave a partial state (FR-005, FR-009, US2). — unit "refuses a user whose invitation became active after they were listed", "answers a second removal of the same user as naming no user", "reports the typed outcome the guarded delete observed"; integration "answers a second removal of the same user as naming no user". The suites prove each ordering's outcome; the interleaving rests on PostgreSQL's row-lock recheck (research D4)
- [X] Every activation link issued for a removed user permits nothing and reveals nothing (FR-007, US1). — unit "takes the activation link with the user, and no other"; integration "removes a pending and a cancelled user with an empty 204" asserts no token row remains
- [X] The removed user's email is free for a new invitation (FR-008, US1). — unit "frees the email for a new invitation, whatever its casing"; integration "frees the email for a new invitation, whatever its casing or padding"
- [X] No other user, lifecycle event, or record that must stay understandable is altered or broken (FR-010, FR-011). — unit "leaves every other user exactly as it was" (full-row comparison), "refuses a user a shift names as its responsible, and changes nothing"; integration "refuses a user an operational record names"; `unit/shared/is_foreign_key_violation.spec.ts` for both dialects' error codes
- [X] The removal is permanent and leaves no trace (FR-012). — unit "keeps no trace of the removal"; no migration in the diff; `DELETE` answers `204` with an empty body
- [X] Only active organization admins may remove a user; denials disclose nothing whatever the identifier names (FR-013, FR-014, FR-015, US3). — integration "rejects unauthenticated access", "denies every role but organization admin", "denies a viewer whose access status is not active", "denies an unauthorized viewer identically whatever the id names" (five ids, malformed included, compared byte for byte); web `removal/permissions.test.tsx` and the `user-access.test.ts` unit test of `userAccessActions`
- [X] The workbench offers the action only on removable users, behind a confirmation stating it is permanent (FR-016, FR-017, US1). — web `removal/row-menu.test.tsx` "ends a %s row menu with the removal"; `journey.test.tsx` "names the user and what the removal means before confirming", "leaves the user untouched when the confirmation is cancelled"; `permissions.test.tsx` "offers no removal on an %s user"
- [X] Outcomes, refusals, and failures are distinguishable, and failures are retryable (FR-018, FR-019, FR-020, US2, US4). — web `journey.test.tsx` "closes the record and drops the user from the view and its count without a reload"; `refusals.test.tsx` (four reasons, lost race, removed elsewhere, refresh on refusal); `journey.test.tsx` "shows the removal in flight and blocks a second submission"; `recovery.test.tsx` (unreachable, then retried once)

## Verification

- [X] Each item maps to a test or reviewable behavior.
- [X] API and web seams are covered where applicable. — 32 Japa tests across `unit/users/removal`, `integration/users/removal`, and `unit/shared/is_foreign_key_violation`, passing on SQLite and on PostgreSQL; 32 Vitest tests across `features/users/__tests__/removal` and `features/users/user-access.test.ts`
- [X] No requirement is implemented outside the approved spec.

## Notes

- Every specification quality item passes on the first validation pass. The source acceptance
  criteria and verification items are delivery evidence, checked once the implementation names the
  test covering each.
- Replaces the 2026-07-09 placeholder, whose only content was a request to define the actor, scope,
  behavior, and acceptance criteria. The rules come from the pre-migration backlog entry
  "P1 - Pending User Removal" (commit `da7839d9^`) and CONTEXT.md.
- Clarified on 2026-09-11: removal is untraced (FR-012) and confirmed with a single dialog (FR-017).
- Found during implementation: SQLite reports `ON DELETE RESTRICT` as `SQLITE_CONSTRAINT_TRIGGER`,
  not `SQLITE_CONSTRAINT_FOREIGNKEY`; the referenced-user tests caught it (research D6).
