# Feature Specification: Preserve the Last Active Organization Admin

**Feature Branch**: `whazzark/preserve-the-last-active-organization-admin`

**Created**: 2026-07-09

**Last Updated**: 2026-09-11

**Status**: Draft

**Input**: User description: "https://github.com/whazzark/portflow-ai/issues/21"

**Feature ID**: `GH-21`

**GitHub Issue**: [#21](https://github.com/whazzark/portflow-ai/issues/21)

**Parent Roadmap**: `specs/user-administration/user-deactivation-hardening/roadmap.md`

**Roadmap Entry**: `GH-21`

**Priority**: priority:P2

**Milestone**: 0. Sécuriser l'administration des utilisateurs

**Domain**: user-administration

## Context

GH-20 delivered user deactivation and refuses an organization admin's attempt to deactivate their
own access. On its own, that refusal means one deactivation request can never leave the operating
organization without an active organization admin: the acting administrator is always someone
other than the target, and they stay active.

GH-20 checks that the actor is entitled when their request arrives, not when it takes effect. That
leaves one path to a lockout. The organization's only two active organization admins can
deactivate each other at the same moment. Each request passes its checks while the other
administrator is still active, both take effect, and no one is left who can administer users,
reactivate anyone, or invite a replacement. Recovering from that state takes intervention outside
the product.

This slice closes that path for deactivation. The rule it enforces is one sentence: **no
deactivation may leave the organization without an active organization admin.** GH-29 applies the
same rule to role changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Never Lock the Organization Out When Admins Deactivate Each Other (Priority: P1)

As the operating organization, I want at least one active organization admin to remain whenever
organization admins deactivate each other at nearly the same time. Someone must always be able to
administer users, reactivate a deactivated administrator, and invite a replacement.

**Why this priority**: This is the lockout the slice exists to prevent, and GH-20 names it as the
one gap it leaves open. No other deactivation path can strip the organization of its last active
organization admin.

**Independent Test**: With exactly two active organization admins, submit each one's deactivation
of the other at the same moment, and repeat the run many times. In every run, exactly one
deactivation takes effect, the other is refused, and one organization admin stays active and can
keep administering users.

**Acceptance Scenarios**:

1. **Given** exactly two active organization admins, A and B, **When** A deactivates B and B
   deactivates A at nearly the same moment, **Then** exactly one of the two deactivations takes
   effect, the other is refused, and the administrator who remains is still an active organization
   admin.
2. **Given** the run above, **When** the stored users are inspected afterwards, **Then** the
   deactivated administrator carries the date and the responsible administrator of the deactivation
   that took effect, and the refused deactivation left no trace on either administrator's access
   status or lifecycle metadata.
3. **Given** the run above, **When** the administrator whose deactivation was refused next uses
   their session, **Then** they are handled like any deactivated user: the session grants no
   access and they are returned to sign-in.
4. **Given** the run above, **When** the remaining administrator consults the workbench, **Then**
   they can use every user administration action, reactivation included once GH-32 delivers it, as
   before.
5. **Given** three or more active organization admins who each deactivate another one at nearly the
   same moment, in a cycle that would deactivate all of them, **When** the requests take effect,
   **Then** at least one organization admin stays active, and each deactivation that took effect was
   performed by an administrator who was still active at that moment.

---

### User Story 2 - Refuse a Deactivation Whose Actor Lost Organization Admin Access in Flight (Priority: P2)

As the operating organization, I want a deactivation to take effect only if the administrator who
submitted it is still an active organization admin at the moment it would take effect. Every
deactivation should come from someone still accountable for user administration, even when that
person's own access or role changes while their request is in flight.

**Why this priority**: Enforcing the rule of User Story 1 in general makes the protection hold in
situations beyond the two-administrator race. Those include a demotion through a role change at the
same moment, and cycles of any length. It covers rarer timings than User Story 1.

**Independent Test**: Start an organization admin's deactivation of another active user. Before it
takes effect, deactivate that administrator in one run and change their role to operations admin in
another. Verify that the deactivation is refused, the targeted user stays active, and no user
changed as a result of the refused request.

**Acceptance Scenarios**:

1. **Given** an organization admin has submitted the deactivation of an active user, **When** their
   own access is deactivated by another organization admin before their deactivation takes effect,
   **Then** it is refused, the targeted user stays active, and the refusal is the one GH-20 gives an
   administrator who is no longer entitled to deactivate.
2. **Given** an organization admin has submitted the deactivation of an active user, **When** their
   role is changed to operations admin, operations lead, or observer before their deactivation takes
   effect, **Then** it is refused in the same way and the targeted user stays active.
3. **Given** a deactivation refused because its actor was no longer entitled, **When** the target
   was in the meantime also pending, cancelled, already deactivated, or unknown, **Then** the lost
   entitlement is the refusal reported, and the refusal discloses nothing about the targeted user.
4. **Given** an organization admin who stays active and keeps their role for the whole request,
   **When** they deactivate an eligible active user, **Then** the deactivation succeeds exactly as
   GH-20 delivered it, even when the target is the only other active organization admin.

### Edge Cases

- An organization admin deactivates the only other active organization admin with no competing
  request: the deactivation succeeds, because the actor stays active. This slice refuses nothing
  that GH-20 accepts when no request competes with it.
- Two organization admins deactivate the same third administrator at nearly the same moment: GH-20
  already makes exactly one succeed and resolves the other as `ALREADY_DEACTIVATED`. This slice
  leaves that outcome unchanged, because both actors stay active.
- A deactivation of an administrator and a role change demoting its actor are submitted at nearly
  the same moment: if the demotion takes effect first, the deactivation is refused under User
  Story 2. If the deactivation takes effect first, whether the demotion that follows may still leave
  the organization without an active organization admin is decided by the role-change protection
  of GH-29, not by this slice.
- An organization admin carrying a password renewal requirement counts as an active organization
  admin, because the requirement changes neither their access status nor their role. A pending
  user invited as an organization admin does not count until they accept their invitation.
- An administrator's session is still open after a concurrent deactivation took their access: their
  next request is refused and returns them to sign-in, through the access-status checks already in
  place. The workbench refreshes once, at that point.
- A refused deactivation fails after submission or is retried: as in GH-20, the users are either
  fully changed or entirely unchanged, and a retry produces neither a second change nor a
  contradictory record. A retry by an administrator who has since lost their entitlement is refused
  like the first attempt.
- The organization already holds no active organization admin, for instance because of data
  prepared outside the product: no one is entitled to deactivate anyone, so this slice has nothing
  to protect. Restoring an administrator in that state is outside the product.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: No deactivation MUST ever leave the operating organization without at least one
  active organization admin, meaning a user whose access status is Active and whose role is
  organization admin. This MUST hold whatever the number, order, or timing of the deactivations
  submitted.
- **FR-002**: A deactivation MUST take effect only if its actor still has Active access and the
  organization admin role at the moment it takes effect. The check MUST see every deactivation and
  role change that took effect before that moment, not the state at submission or the state the
  actor was looking at.
- **FR-003**: A deactivation refused under FR-002 MUST leave every user unchanged. That includes
  the targeted user's access status, lifecycle metadata, and existing deactivation record, and the
  actor's own record.
- **FR-004**: A deactivation refused under FR-002 MUST give the same outcome GH-20 gives an
  administrator who is no longer entitled to deactivate. It MUST NOT disclose anything about the
  targeted user, and it MUST take precedence over the eligibility reasons `NOT_FOUND`,
  `PENDING_INVITATION`, `CANCELLED_INVITATION`, and `ALREADY_DEACTIVATED`.
- **FR-005**: When the only two active organization admins deactivate each other at nearly the same
  moment, exactly one of the two deactivations MUST take effect and the other MUST be refused under
  FR-002.
- **FR-006**: Only access status and role decide who counts as an active organization admin. A
  password renewal requirement MUST NOT remove a user from that count. Pending, cancelled, and
  deactivated users MUST NOT count, and neither do users holding any other role.
- **FR-007**: When no request competes with it, a deactivation MUST behave exactly as GH-20
  delivered it: the same entitlement check, eligibility rules, refusal reasons and their precedence,
  recorded date and responsible administrator, sign-in and session consequences, and workbench
  behavior.
- **FR-008**: The user workbench MUST show a deactivation refused under FR-002 through the same
  action and in the same way it shows GH-20's refusal for lost entitlement. This slice adds no new
  workbench element, reason, or message.
- **FR-009**: The protection MUST be enforced by the system itself, whatever the user experience
  offers, hides, or last displayed.
- **FR-010**: This slice MUST NOT change the role change command or refuse any role change, MUST NOT
  refuse a deactivation that GH-20 accepts when no request competes with it, and MUST NOT change
  sign-in, sessions, reactivation, invitation, or password reset behavior.

### Key Entities *(include if feature involves data)*

- **Active Organization Admin**: A user whose access status is Active and whose role is organization
  admin, whether or not they carry a password renewal requirement. The organization must keep at
  least one at all times, and a deactivation may only be performed by one.
- **User Deactivation**: The action delivered by GH-20. This slice changes when it may take effect,
  not what it records: a successful deactivation still records its date and its responsible
  administrator.
- **User Role Change**: The action delivered by GH-28. This slice does not change it, and a role
  change that takes effect before a deactivation counts against that deactivation's actor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across at least 50 repeated acceptance runs in which the only two active organization
  admins deactivate each other at the same moment, 100% of runs end with exactly one administrator
  deactivated and the other still an active organization admin.
- **SC-002**: Across repeated acceptance runs in which three or more organization admins deactivate
  each other in a cycle at the same moment, 100% of runs end with at least one active organization
  admin. Every deactivation that took effect is attributed to an administrator who was still active
  at the moment it took effect.
- **SC-003**: In acceptance testing, 100% of deactivations whose actor was deactivated or demoted
  before the deactivation took effect are refused with the lost-entitlement outcome, and zero users
  change as a result.
- **SC-004**: Across all acceptance datasets and concurrent runs in this slice, no deactivation ever
  leaves the organization without an active organization admin.
- **SC-005**: 100% of GH-20's acceptance scenarios still pass unchanged, and deactivations with no
  competing request stay visible in the workbench within the 2 seconds GH-20 set.

## Assumptions

- The refusal reuses GH-20's lost-entitlement outcome instead of adding a
  `LAST_ACTIVE_ORGANIZATION_ADMIN` reason. The actor cannot be the target, because GH-20 refuses
  `SELF`. So a deactivation could only leave no active organization admin if its actor had already
  lost that status by the moment it takes effect. An administrator who is still entitled could
  never see such a reason. The only person who could see it has, by definition, lost the
  entitlement, and GH-20 forbids disclosing anything to someone in that position.
- Requiring the actor to still be an active organization admin at the moment the deactivation takes
  effect also honours GH-20's principle that every deactivation leaves an accountable administrator
  behind. Its acceptance scenario of an administrator losing active access between opening the
  record and confirming now holds at every timing, not only when the loss happens before the
  request arrives.
- There is a single operating organization, so "the organization's active organization admins" are
  all users with Active access and the organization admin role.
- GH-20's session and sign-in checks already deny access to a deactivated user at their next
  request. No new session handling is introduced for the administrator whose deactivation lost the
  race.
- The protection exists for concurrent requests that are rare in practice, so it has no workbench
  indicator, warning, or count of remaining administrators. No new element is needed to explain it.

## Dependencies

- Blocked by GH-20, which is delivered. This slice guards the deactivation command GH-20 delivered
  and uses the lost-entitlement refusal that the same workbench action already shows.
- Relies on GH-28, which is delivered, only as a source of concurrent demotions that FR-002 must
  see. It does not change that command.
- Related to GH-29, which applies the same rule to role changes. The organization is fully protected
  against losing its last active organization admin only once both slices are delivered.

## Out of Scope

- Refusing a role change that would demote the last active organization admin, and refusing a user
  changing their own role, both owned by GH-29.
- Reactivating a deactivated administrator, owned by GH-32.
- Any new refusal reason, workbench indicator, or warning about the number of remaining
  organization admins.
- Recovering an organization that already has no active organization admin.
- Notifying anyone that a deactivation was refused or took effect.

## Source-derived decisions

- The source issue carries no requirement beyond its title and the milestone's goal: "the atomic
  protection of the last ORGANIZATION_ADMIN". The behavior above comes from the gap GH-20 records in
  its edge cases and assumptions, where two administrators deactivating each other at the same
  moment can still leave the organization without an active organization admin. It also follows
  GH-28's note that the last-admin rule is shared across user administration.
- As in the rest of the roadmap, the slice is vertical, but it needs no separate frontend work: the
  refusal is shown through the workbench action GH-20 delivered.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/21
- Parent roadmap: specs/user-administration/user-deactivation-hardening/roadmap.md
- Guarded slice: specs/user-administration/user-deactivation-hardening/reject-ineligible-user-deactivation/spec.md
- Sibling protection: specs/user-administration/user-role-change/protect-self-role-changes-and-the-final-organization-admin/spec.md
- Domain vocabulary: `CONTEXT.md`, entries Organization Admin, User Deactivation, User Access Status,
  User Access Status Change, User Role Change, and Password Renewal Requirement.
- Related domain: user-administration
