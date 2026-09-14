# Feature Specification: Protect Self-Role Changes and the Final Organization Admin

**Feature Branch**: `whazzark/protect-self-role-changes-and-the-final-organiza`

**Created**: 2026-07-09

**Last Updated**: 2026-09-11

**Status**: Draft

**Input**: User description: "https://github.com/whazzark/portflow-ai/issues/29"

**Feature ID**: `GH-29`

**GitHub Issue**: [#29](https://github.com/whazzark/portflow-ai/issues/29)

**Parent Roadmap**: `specs/user-administration/user-role-change/roadmap.md`

**Roadmap Entry**: `GH-29`

**Priority**: priority:P2

**Milestone**: 0. Sécuriser l'administration des utilisateurs

**Domain**: user-administration

## Revisions

### 2026-09-11 — during planning

User Story 3, FR-012, and SC-005 were rewritten. As first written, they kept a refused administrator
in the `Edit` panel and showed the target's role there. Planning showed that state cannot exist. The
final admin refusal only reaches an administrator who has just stopped being an active organization
admin in the same collision, so the workbench must follow them — to their demoted view, or to
sign-in — rather than keep them in the panel. See the last item of Assumptions and Clarifications,
and [research.md](./research.md) D8.

## User Scenarios & Testing *(mandatory)*

GH-28 lets an organization admin change the role of an eligible user, and deliberately left out the
two guards that stop that command from locking the organization out of its own user
administration. This slice adds them. The command, its eligibility rules, and the `Edit` panel in
which the workbench offers it are GH-28's and GH-24's, and are unchanged except where a refusal
below applies.

The two guards are closely related. An organization admin who cannot change their own role always
remains an organization admin once their request is applied, so a single request can never demote
the last one. The organization can only lose its last active organization admin when several
changes are applied at the same moment — two administrators demoting each other, or a demotion
racing a deactivation. The second guard exists for exactly that case: it holds the rule "the
organization always keeps at least one active organization admin" at the moment each change is
applied, rather than at the moment it was requested.

### User Story 1 - Refuse an Organization Admin Changing Their Own Role (Priority: P1)

An organization admin cannot change the role they hold themselves. Any change to their own
responsibility level must come from another organization admin, so that no administrator can
compromise their own access by accident, and no administrator's authority rests on their own say.

**Why this priority**: GH-28 already accepts a self-role change at the API. An administrator who
demotes themselves loses user administration on their next request and cannot undo it; if they were
the only organization admin, the organization loses it with them. The workbench does not offer the
action on the viewer's own record, so the API is where the gap is open today.

**Independent Test**: Sign in as an organization admin, submit a role change naming yourself at the
API with each of the four roles — including the one you hold — and with your identifier written in a
different letter case, and verify that each attempt is refused with its reason and that your role
and access are unchanged. Then verify the workbench offers no role change on your own record, even
when that record is opened directly.

**Acceptance Scenarios**:

1. **Given** an organization admin is signed in, **When** they submit a role change naming themselves with any role other than organization admin, **Then** the change is refused, their role is unchanged, and the refusal states that their role can only be changed by another organization admin.
2. **Given** an organization admin is signed in, **When** they submit a role change naming themselves with the organization admin role they already hold, **Then** the request is refused the same way rather than answered as an unchanged success.
3. **Given** an organization admin's identifier is written with a different letter case than the one stored, **When** they submit a role change naming themselves with it, **Then** the change is refused as a self-role change and nothing is modified.
4. **Given** two organization admins are active, **When** one of them changes the other's role, **Then** the change is applied as GH-28 delivers it; the refusal applies to the requester's own record only.
5. **Given** an operations admin, an operations lead, or an observer is signed in, **When** they submit a role change naming themselves, **Then** they receive the same denial as for any other user, not the self-role-change refusal.
6. **Given** an organization admin browses the user workbench, **When** they open their own record, including by reaching its `Edit` panel directly, **Then** no role change is offered to them.

---

### User Story 2 - Keep an Active Organization Admin Through Concurrent Changes (Priority: P1)

The system refuses any role change that would leave the organization without an active
organization admin, judged at the moment the change is applied, so that simultaneous changes cannot
together do what no single one of them is allowed to do.

**Why this priority**: An organization without an active organization admin can no longer invite,
deactivate, reactivate, or change the role of anyone, and nothing in the application can repair it.
Refusing it is the purpose of this slice, and the milestone ends with this protection.

**Independent Test**: With exactly two active organization admins, submit at the same moment a
role change from each demoting the other, repeat it many times, and verify that every run ends with
exactly one demotion applied, the other refused with its reason, and one active organization admin
left. Then deactivate one of the two and verify that a demotion of the survivor applied afterwards is
refused.

**Acceptance Scenarios**:

1. **Given** exactly two active organization admins, **When** each submits at the same moment a role change demoting the other, **Then** exactly one change is applied, the other is refused, and the organization keeps one active organization admin.
2. **Given** a role change demoting an active organization admin is in flight, **When** every other active organization admin has been demoted or deactivated before it is applied, **Then** it is refused, because it would leave no active organization admin, even though it was allowed when it was requested.
3. **Given** three active organization admins each demote another at the same moment, **When** the changes are applied, **Then** at least one active organization admin remains and every refused change leaves its target unchanged.
4. **Given** a role change is refused by this protection, **When** the refusal is returned, **Then** it states that the organization must keep at least one active organization admin, and no user is modified.
5. **Given** at least two active organization admins, **When** one of them demotes the other and nothing else is applied at the same moment, **Then** the change is applied as GH-28 delivers it.
6. **Given** a pending or cancelled user holds the organization admin role, **When** an organization admin assigns them another role, **Then** the change is applied, whatever the number of active organization admins, because that user is not an active organization admin.
7. **Given** any eligible user, **When** an organization admin assigns them the organization admin role, **Then** the change is applied; granting the role is never refused by this protection.

---

### User Story 3 - Understand a Refused Role Change in the Workbench (Priority: P2)

When the role change submitted from the `Edit` panel is refused because it would remove the last
active organization admin, the administrator sees why, sees the user as they stand, keeps what was
already saved, and finds the workbench already following their own new situation.

That last part is not optional. An administrator who is still an active organization admin counts
towards the protection, so their change can only be refused if they themselves stopped being one in
the same collision — demoted, or deactivated. The refusal always reaches someone who has just lost
the right to change roles.

**Why this priority**: The self-role change is not reachable from the workbench, and the final
admin refusal only occurs when changes collide, so this story is rare in use. It matters because the
refusal is the only signal that the organization's admin population moved under the
administrator's feet. Misread as a failure, it would invite a retry from a panel the administrator no
longer has the right to use.

**Independent Test**: In the workbench, open another active organization admin's record and demote
them, while their demotion of you is applied first. Verify that the refusal is reported with its
reason, distinctly from a failure and from a success, and stays readable once the panel is gone.
Verify that the target is shown as an organization admin, that any identity correction made in the
same save is kept, and that the workbench offers you only what your new role allows, without a new
sign-in. Repeat with your deactivation instead of your demotion, and verify you are sent to sign in.

**Acceptance Scenarios**:

1. **Given** an organization admin submits a role change from the `Edit` panel, **When** the change is refused by the final organization admin protection, **Then** the reason returned by the system is reported as a refusal, distinct from a failure and from a success, and remains readable after the panel closes.
2. **Given** a role change was refused by that protection, **When** the workbench refreshes, **Then** the target is shown wherever they appear with the role they hold now.
3. **Given** the same save corrected the user's identity and changed their role, **When** the identity correction is applied and the role change is refused, **Then** the identity correction stays applied and is shown as such.
4. **Given** the refusal came with the administrator's own demotion, **When** the workbench refreshes, **Then** the `Edit` panel gives way to the user's record as their new role presents it, and the navigation follows the new role, without a new sign-in.
5. **Given** the refusal came with the administrator's own deactivation, **When** the workbench refreshes, **Then** they are sent to sign in, as any user who is no longer active is.

### Edge Cases

- A self-role-change request is refused whatever role it submits, including the role the requester already holds: the self check comes before GH-28's "unchanged success" rule.
- The requester is recognized however their identifier is written, wherever the system treats two spellings as naming the same user; a difference in letter case MUST NOT bypass the self check.
- A viewer who may not change roles at all is denied as GH-28 defines, whatever user they name; the self-role-change refusal is only reachable by an organization admin.
- Only users who are both active and hold the organization admin role count towards the protection. Pending, cancelled, and deactivated organization admins cannot administer users and are not counted.
- A change that keeps the target an organization admin — submitting organization admin for a user who holds it — never reduces the count and is never refused by this protection.
- A deactivated target is refused by GH-28's deactivated rule, which this slice leaves unchanged; the final admin protection never needs to decide for it.
- A requester whose own role or access changed while their request was in flight is still bound by the protection: if their request would remove the last active organization admin once applied, it is refused.
- A role change applied after a deactivation is judged against the organization as that deactivation left it. The reverse — a deactivation applied after a role change — is decided by the deactivation guard of GH-21 (see Out of Scope).
- A refused role change is not recorded, exactly as an applied one is not (GH-28 FR-016).
- The organization is never shown, and never needs to be shown, how many active organization admins it has in order to understand a refusal; the refusal states the rule, not the count.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST refuse a role change in which the organization admin making the request is also the user it names, whatever role is submitted, including the role they already hold.
- **FR-002**: The self-role-change refusal MUST recognize the requester however their identifier is written, including a difference in letter case, wherever the system would treat both spellings as naming the same user.
- **FR-003**: The self-role-change refusal MUST state that a user's own role can only be changed by another organization admin, and MUST be presented as a refusal of this particular target rather than as a lack of permission to change roles.
- **FR-004**: The system MUST refuse a role change that would leave the organization without any user who is both active and holds the organization admin role.
- **FR-005**: The final organization admin protection MUST be decided at the moment the change is applied, against the organization's users as they stand then — including every role change and every deactivation applied since the request was received — and never against a state read before.
- **FR-006**: Role changes applied at the same moment MUST be judged one after the other for this protection: when several of them would together leave no active organization admin, those that still leave one are applied and the one that would remove the last is refused.
- **FR-007**: The final organization admin refusal MUST state that the organization must keep at least one active organization admin, and MUST NOT disclose the number or the identity of the remaining organization admins.
- **FR-008**: The final organization admin protection MUST NOT refuse any role change that leaves at least one active organization admin. Assigning the organization admin role, changing the role of a pending or cancelled user, changing the role of an active user who is not an organization admin, and demoting an active organization admin while another remains active MUST behave exactly as GH-28 delivers them.
- **FR-009**: A role change refused by either guard MUST leave the target, the requester, and every other user exactly as they were — role, access status, identity, credentials, lifecycle events, and password renewal requirement — and MUST NOT be recorded.
- **FR-010**: Both refusals MUST be enforced by the system whatever the workbench does. The workbench MUST NOT offer a role change on the viewer's own record, including when that record's `Edit` panel is reached directly.
- **FR-011**: Only viewers permitted to change roles MUST be able to reach either refusal; any other viewer MUST receive GH-28's denial, whatever user they name.
- **FR-012**: The workbench MUST report either refusal with the reason the system returned, distinctly from a failure and from a success, in a way that remains readable after the `Edit` panel closes. It MUST then show the target with the role they hold now, and MUST follow the administrator's own current role and access at once: an administrator who may still change roles stays in the panel, one who was demoted is offered only what their new role allows without signing in again, and one who was deactivated is sent to sign in.
- **FR-013**: When the identity correction of a save is applied and its role change is refused, the workbench MUST present the identity correction as applied, and any following save MUST send the role change alone.
- **FR-014**: This feature MUST NOT change GH-28's eligibility rules, the deactivated-user refusal, or the unchanged-success rule for any user other than the requester, and MUST NOT introduce the deactivation guard of GH-21, nor any other user administration action.

### Key Entities

- **User**: A person holding access to the operating organization, with a stable identity, exactly one role, and exactly one access status. This feature refuses some changes of a user's role and changes nothing else.
- **User Role**: The responsibility level held by a user — organization admin, operations admin, operations lead, or observer.
- **User Access Status**: Pending activation, active, deactivated, or cancelled before activation. Only an active user can administer users, and only an active organization admin counts towards the protection.
- **Active Organization Admin**: A user who is both active and holds the organization admin role. The organization MUST always keep at least one; it is the only kind of user able to administer the others.
- **User Role Change**: The action, delivered by GH-28, of changing the responsibility level assigned to a user. This feature adds two reasons to refuse it: the requester naming themselves, and the removal of the last active organization admin.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all tests, a role change naming the requester is refused and leaves them unchanged, for each of the four submitted roles and for every spelling of their identifier the system accepts.
- **SC-002**: Across at least 50 repeated runs of two active organization admins demoting each other at the same moment, every run ends with exactly one demotion applied and one active organization admin left.
- **SC-003**: In all tests, no sequence of role changes, whether applied one at a time or at the same moment, and whether or not deactivations are applied before them, leaves the organization without an active organization admin.
- **SC-004**: In all tests, every role change that leaves at least one active organization admin is applied exactly as before this feature: the protection refuses no promotion, no change to a pending or cancelled user, and no demotion while another active organization admin remains.
- **SC-005**: In the workbench, an administrator whose role change is refused reads the reason and sees the target's current role within 2 seconds under normal operating conditions in 95% of attempts, lands on a view their current role allows without signing in again unless they were deactivated, and never has to re-enter what was already saved.
- **SC-006**: In acceptance testing, zero role changes result in an organization that can no longer administer its users.

## Dependencies

- GH-28 — Change Another Eligible User Role (delivered): supplies the role change command both guards refuse, its eligibility rules, and the role control in the `Edit` panel that surfaces the refusals.
- GH-24 — Update Another User Identity (delivered): supplies the `Edit` panel and the rule that it is never offered on the viewer's own record.
- GH-20 — Reject Ineligible User Deactivation (delivered): supplies deactivation, whose effect on the active organization admin population this protection must take into account.
- GH-21 — Preserve the Last Active Organization Admin (open, not a blocker): guards the same rule on the deactivation command. Neither slice blocks the other, and the rule only holds in every combination of concurrent role changes and deactivations once both have shipped.

## Out of Scope

- Refusing a deactivation that would leave the organization without an active organization admin, including a deactivation applied after a concurrent role change. This belongs to GH-21. Until GH-21 ships, a demotion and a deactivation applied at the same moment can still together leave the organization without an active organization admin; this slice closes every path that goes through role changes alone.
- Re-checking, at the moment a change is applied, that the requester is still permitted to change roles. The requester's authorization is decided when their request is received, as for every other user administration action; the only in-flight consequence this slice protects against is the loss of the last active organization admin.
- A self-service path for a user to change their own role, or to ask for a change.
- Offering the role change on the viewer's own record in the workbench, or showing an administrator how many organization admins remain.
- Recovering an organization that has already lost every active organization admin, through the application or otherwise.
- Any history of role changes or of refused role changes (GH-28 FR-016).
- Invitation, invitation cancellation and restoration, activation link issuing and renewal, pending user removal, deactivation, reactivation, identity update, and password reset.

## Assumptions and Clarifications

- The application serves a single operating organization, so "the organization" is the whole user population; the protection counts every active organization admin in it.
- A self-role-change request is refused even when it submits the role already held. Refusing the target outright matches how the other user administration seams treat the requester — self-deactivation, self-identity-update through the administrator seam, and self-reset are refused whatever is submitted — and spares the refusal from depending on what was submitted.
- The self-role-change refusal is a refusal of one target, not a permission denial, for the reason GH-20 gave its self-deactivation refusal: an administrator who triggers it by mistake must not read it as having lost the right to change roles.
- Because the requester cannot change their own role and is an active organization admin when their request is received, the final organization admin protection can only be triggered by changes applied at the same moment. It is therefore not anticipated by the workbench: the `Edit` panel keeps offering the demotion of another active organization admin, and relies on the system's refusal when it applies.
- When it is triggered, the requester has necessarily stopped being an active organization admin in the same collision: had they still been one, they would have counted, and the target would not have been the last. This is why User Story 3 follows the administrator's own situation rather than keeping them in a panel they may no longer use.
- The final admin refusal states the rule and not what to do next: the requester who meets it has usually lost their own organization admin role or access in the same collision, so advice to promote someone first could not be followed.
- GH-21 guards the same rule on deactivation. The protection defined here is the one it is expected to share, so that once both have shipped, a role change and a deactivation are judged one after the other just as two role changes are.

## Source-derived decisions

- The rules come from the pre-migration user domain backlog entry "P2 - User Role Change": "a user cannot change their own role", "an Organization Admin cannot compromise their own access", and "the system must keep at least one active Organization Admin". GH-28 took the other rules of that entry; these three are this slice's. The second is met by the first: the only way an organization admin could compromise their own access through a role change is to change their own role.
- The milestone "0. Sécuriser l'administration des utilisateurs" ends with the atomic protection of the last organization admin. "Atomic" is read as FR-005 and FR-006: the rule is judged when a change is applied and holds when changes collide.
- The issue comment "Already delivered per .tracker/BACKLOG.md at migration time" does not hold against the current codebase: the role change command delivered by GH-28 refuses deactivated and unknown users only, and accepts a self-role change and the demotion of the last active organization admin.
- The case-insensitive recognition of the requester (FR-002) follows a defect found on the deactivation seam, where an identifier written in upper case would have walked past the self check because the system matches both spellings to the same user.

## Traceability

- Blockers: recorded as GitHub issue dependencies on the source issue.
- Source issue: https://github.com/whazzark/portflow-ai/issues/29
- Parent roadmap: specs/user-administration/user-role-change/roadmap.md
- Guarded slice: specs/user-administration/user-role-change/change-another-eligible-user-role/
- Sibling rule on deactivation: specs/user-administration/user-deactivation-hardening/preserve-the-last-active-organization-admin/ (GH-21)
- Source backlog: `docs/backlog-user-domain.md`, section "P2 - User Role Change", as of commit `da7839d9^`.
- Related domain: user-administration
