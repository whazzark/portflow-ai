# Feature Specification: Renew a Pending User Activation Link

**Feature Branch**: `whazzark/renew-a-pending-user-activation-link`

**Created**: 2026-07-09

**Last Updated**: 2026-09-11

**Status**: Draft

**Input**: User description: "Renew a Pending User Activation Link — https://github.com/whazzark/portflow-ai/issues/9"

**Feature ID**: `GH-9`

**GitHub Issue**: [#9](https://github.com/whazzark/portflow-ai/issues/9)

**Parent Roadmap**: `specs/user-administration/invitation-onboarding/roadmap.md`

**Roadmap Entry**: `GH-9`

**Priority**: priority:P1

**Milestone**: 0. Sécuriser l'administration des utilisateurs

**Domain**: user-administration

> Vertical slice: this specification owns both the link renewal command in `apps/api` and its
> action in the user workbench of `apps/web`. It absorbs the renewal part of the former
> frontend-only slice "Manage Invitation Lifecycle From the Web Workbench", which belonged to the
> GH-11 roadmap.

## Clarifications

### Session 2026-09-11

- Q: Should this slice show a pending user's current activation link validity, and where? → A: Yes, on the access record ("valid until" / "expired since") and in the pending view of the collection, which marks the pending users whose link no longer permits acceptance; the link itself is never exposed

## User Scenarios & Testing *(mandatory)*

`Invite a Pending User with a Confidential Activation Link` (GH-7) creates a pending user and
presents their activation link exactly once. It deliberately keeps no way to show that link again,
and lets it expire 7 days after its issuance, while leaving the pending user intact. Both choices
point here: a link that was never passed on, was lost, or has expired can only be replaced, and
until this slice exists the only way out is to cancel or remove the pending user and invite them
again. This slice lets an organization admin replace the activation link of a pending user without
creating, cancelling, or restoring an invitation, and makes the replaced link useless at once.

### User Story 1 - Replace a Lost or Expired Activation Link (Priority: P1)

An organization admin learns that an invited person cannot activate their access — the link never
reached them, they lost it, or it has expired. The admin renews the activation link from that
pending user, receives a new confidential link shown once, and passes it on. The previous link stops
working the moment the new one is issued.

**Why this priority**: It is the whole outcome of the slice, and the only recovery GH-7 leaves for
a link that was lost after its single presentation or that has expired.

**Independent Test**: Sign in as an organization admin, invite a person, then renew that pending
user's activation link. Verify a new link is presented once with a validity of 7 days from the
renewal, that the previous link no longer identifies the pending user, that the pending user is
otherwise unchanged, and that their access record states when and by whom the link was renewed.

**Acceptance Scenarios**:

1. **Given** a pending user whose activation link has expired, **When** an organization admin renews it, **Then** a new activation link is issued for that pending user, valid for 7 days from the renewal.
2. **Given** a pending user whose activation link is still valid, **When** an organization admin renews it, **Then** the renewal succeeds in the same way, and the previous link stops permitting acceptance at the moment the renewal is recorded.
3. **Given** a renewal succeeds, **When** the outcome is presented, **Then** a dedicated outcome shows the new activation link in clear text, offers a copy action, states that it will not be shown again and that the previous link no longer works, and stays open until the administrator acknowledges it explicitly.
4. **Given** a renewal succeeds, **When** the pending user is examined, **Then** they are still pending, hold no password, cannot sign in, and keep exactly the identity, email, role, and invitation event they held before.
5. **Given** a renewal succeeds, **When** the administrator consults the pending user's access record, **Then** it shows the renewal with its date and the administrator who performed it.
6. **Given** a pending user's link has been renewed several times, **When** the administrator consults their access record, **Then** it shows the most recent renewal, and only the most recently issued link permits acceptance.
7. **Given** the new activation link has been shown once, **When** the admin acknowledges the outcome and then reopens it, the user record, or the user collection, **Then** the new link is nowhere consultable again, and a further renewal is the only way to obtain another one.

---

### User Story 2 - Keep Renewal Restricted to Organization Admins and to Pending Users (Priority: P1)

Only organization admins may renew an activation link, and only for a pending user of their
operating organization, so that no other role can obtain a credential-bearing path into the
application and no renewal can reopen access the lifecycle has closed or already granted.

**Why this priority**: A renewal issues a new way into the application and silently disables the
previous one. A permissive renewal is both an access-granting defect and a way to sabotage a
colleague's invitation; the API must enforce the rule whatever the interface offers.

**Independent Test**: Attempt a renewal as an organization admin, an operations admin, an operations
lead, an observer, an unauthenticated visitor, a non-active user, and a session confined to its own
password renewal; and against a pending, an active, a deactivated, a cancelled, and an unknown
user. Verify each outcome at the API seam — including that a refused attempt leaves the previous
link usable — then verify the workbench never offers what the API would refuse.

**Acceptance Scenarios**:

1. **Given** an organization admin is signed in, **When** they renew a pending user's activation link, **Then** the renewal is allowed.
2. **Given** an operations admin, an operations lead, or an observer is signed in, **When** they attempt a renewal, **Then** it is denied, no link is issued, the previous link keeps working, and the refusal discloses nothing about the user.
3. **Given** a visitor is not authenticated, the requester's own access status is not active, or the requester's session is confined to its own password renewal, **When** a renewal is attempted, **Then** it is denied and no link is issued.
4. **Given** the target user is active, **When** an organization admin attempts a renewal, **Then** it is refused with a reason stating that the user has already activated their access, and pointing to a password reset if their credential needs replacing.
5. **Given** the target user is deactivated, **When** an organization admin attempts a renewal, **Then** it is refused with a reason pointing to user reactivation.
6. **Given** the target user is cancelled, **When** an organization admin attempts a renewal, **Then** it is refused with a reason pointing to invitation restoration, and the cancelled user stays cancelled.
7. **Given** an identifier naming no user of the operating organization, **When** a renewal is attempted, **Then** it is refused without revealing whether such a user exists elsewhere.
8. **Given** a viewer may not renew, or the user is not pending, **When** the workbench is browsed, **Then** no renewal action is presented for that user, and reaching the action directly still issues no link.

---

### User Story 3 - Recover From a Refused or Failed Renewal Without Losing the Working Link (Priority: P2)

An organization admin whose renewal cannot be completed receives a clear outcome and can retry, and
the pending user is never left with no working link because of a renewal that did not happen, nor
with two working links because of two renewals that did.

**Why this priority**: The previous link may already be in the invited person's hands. A renewal
that fails halfway would silently break it; two renewals that both survive would leave an unknown
number of doors open. It protects the primary outcome rather than creating it.

**Independent Test**: Make a renewal fail after submission, renew a user whose access status changed
since the workbench listed them, and submit two renewals for the same pending user concurrently.
Verify that a failed or refused renewal leaves the previous link exactly as it was, and that at no
point does more than one link permit acceptance.

**Acceptance Scenarios**:

1. **Given** a renewal cannot be completed because of a transient failure, **When** the failure is returned, **Then** no new link exists, the previous link is exactly as usable as it was before, nothing is recorded, and the failure is presented as retryable.
2. **Given** a retryable failure was shown, **When** the administrator retries after the problem is resolved, **Then** exactly one new link is issued and it is the only link permitting acceptance.
3. **Given** the pending user accepted their invitation, or had it cancelled, after the workbench listed them, **When** the administrator confirms the renewal, **Then** it is refused with a reason naming the current access status, no link is issued, and the displayed collection can be refreshed to the current state.
4. **Given** two renewals for the same pending user are processed concurrently, **When** both complete, **Then** exactly one link permits acceptance — the last one issued — and the renewal presented in the access record is the one that issued it.
5. **Given** a renewal and an acceptance of the previous link happen at almost the same moment, **When** both are processed, **Then** exactly one of them takes effect: either the user becomes active and the renewal is refused, or the renewal succeeds and the previous link no longer permits acceptance — never both.

---

### User Story 4 - Renew From the User Workbench (Priority: P2)

An organization admin renews the link from the pending user they are already consulting, confirms
it deliberately — knowing the link they may already have handed out will stop working — and sees
the outcome reflected without reloading the workbench.

**Why this priority**: The API seam makes the renewal possible; this is what makes it usable by the
administrator responsible for access, and what makes the workbench's existing pointers to "renew
the activation link" lead somewhere. It is P2 because the outcome is complete and testable at the
API first.

**Independent Test**: Open a pending user's access record, invoke the renewal, verify an explicit
confirmation naming the user and stating that the current link will stop working, confirm, capture
the new link from the outcome, acknowledge it, and verify the record and the collection reflect the
renewal without a manual reload; then repeat from the row menu and cancel at the confirmation,
verifying nothing was issued and the previous link still works.

**Acceptance Scenarios**:

1. **Given** a pending user's access record is open, **When** an organization admin looks for access actions, **Then** the activation link renewal is offered on that record.
2. **Given** a pending user is listed in the collection, **When** an organization admin opens that user's row menu, **Then** the renewal is offered there too, under the same rules and with the same confirmation as on the record, without opening the record.
3. **Given** the renewal is invoked, **When** the confirmation is presented, **Then** it names the user concerned and states plainly that any activation link already handed out to them will stop working, and that a new one will be shown once.
4. **Given** the confirmation is presented, **When** the administrator cancels it, **Then** no link is issued, nothing is recorded, and the previous link keeps working.
5. **Given** the renewal is being processed, **When** the administrator submits it again, **Then** the interface prevents a duplicate submission for the same user.
6. **Given** the renewal succeeded, **When** the administrator acknowledges the outcome, **Then** they return to where they renewed from — the open record or the collection — with the user still in the pending view and the renewal reflected in the access record, without a new sign-in or a manual reload.
7. **Given** the workbench tells an administrator to renew an activation link — after an invitation outcome whose link is no longer available, or when an invitation is refused because the email belongs to a pending user — **When** they look for that action on the pending user concerned, **Then** it is offered there.

---

### User Story 5 - Spot the Pending Users Whose Link No Longer Works (Priority: P2)

An organization admin reviewing the pending view sees at a glance which invited people can no
longer activate their access because their link has expired, and the pending user's record states
until when the current link works — so the admin can renew before the invited person has to ask.

**Why this priority**: The link's validity is shown once, in the outcome that presents it, and is
otherwise invisible. Without it, the renewal can only react to a complaint; with it, the admin can
act on the state the organization actually holds. It sharpens the primary outcome rather than
creating it.

**Independent Test**: Hold one pending user with a valid link, one whose link has expired, and one
with no link at all. Verify the pending view marks the expired and link-less users only, that each
access record states the right validity, that renewing the expired user clears their mark and
states the new expiry, and that no seam exposes a link.

**Acceptance Scenarios**:

1. **Given** a pending user's link is still valid, **When** an organization admin opens their access record, **Then** it states that the activation link is valid until its expiry date and time.
2. **Given** a pending user's link has expired, **When** an organization admin opens their access record, **Then** it states that the activation link expired, and since when.
3. **Given** a pending user holds no activation link at all, **When** an organization admin opens their access record, **Then** it states that no activation link has been issued.
4. **Given** the pending view lists users with valid, expired, and absent links, **When** an organization admin browses it, **Then** the users holding no link that still permits acceptance are marked as such, and the users holding a valid link are not.
5. **Given** a pending user was marked as holding no working link, **When** their link is renewed, **Then** the mark disappears and their access record states the new expiry, without a manual reload.
6. **Given** a link reaches its expiry while the collection is open, **When** the collection is next refreshed, **Then** that pending user is marked as holding no working link.
7. **Given** the validity is presented anywhere, **When** the response, the record, or the collection is examined, **Then** it carries the expiry only, and never the link or anything it could be derived from.

### Edge Cases

- A pending user holding no activation link at all — for instance one seeded before invitations existed — is renewed like any other: the renewal issues their only link.
- The renewal never extends or reuses the previous link: the new link is a new secret, bearing no relation to the previous one, and its 7 days start at the renewal whatever remained of the previous link's validity.
- The outcome of a renewal is never seen by its author — a closed window, a lost connection: the new link is live but unobtainable, the previous one already stopped working, and a further renewal is the recovery.
- The invited person is on the activation screen with the previous link at the moment it is renewed: completing acceptance with it is refused, and they need the new link.
- Two organization admins renew the same pending user at almost the same moment: each is shown a link, only the last one issued works, and the access record names the administrator who issued it so the other can tell their link was superseded. This is a known and accepted residual of keeping a single live link per pending user.
- A pending organization admin's link is renewed: it is allowed, because a pending user holds no access and no last-administrator invariant is at stake.
- An organization admin cannot renew their own link: a signed-in admin is active, so a renewal naming themselves is refused as not pending.
- The administrator who performed a renewal is deactivated or removed afterwards: the recorded renewal keeps its date and remains presented, with the responsible administrator handled exactly as every other departed actor in the access history.
- A renewal attempted against a user of another operating organization and one against an identifier that does not exist are refused identically.
- No activation link — new or previous — is exposed by the renewal refusal, the access record, the collection, application logs, or any consultation seam, and none is sent anywhere by this feature.
- A transient failure during the renewal is distinguishable, in the workbench, from a refusal on the target's access status and from an authorization refusal.
- A link's validity is a comparison with the current time, not a recorded state: a link that expires while nobody acts is presented as expired from then on, without any action needed to make it so.
- A pending user whose link expired is not otherwise affected by the mark: they stay pending, visible in the pending view, and renewable; the mark never cancels, removes, or hides them.
- The validity of a cancelled, active, or deactivated user's former link is not presented: a link matters only while its user is pending.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let an organization admin renew the activation link of a pending user of their operating organization.
- **FR-002**: A successful renewal MUST issue exactly one new activation link for that pending user. The new link MUST be unguessable, MUST identify exactly one pending user, and MUST NOT be derivable from the previous link or from anything the user collection exposes.
- **FR-003**: A successful renewal MUST make the previous activation link stop permitting acceptance at the moment the renewal is recorded. At any time, at most one activation link per pending user MUST permit acceptance.
- **FR-004**: The new activation link MUST expire 7 days after its renewal, independently of the invitation date and of the previous link's expiry.
- **FR-005**: The renewal MUST be allowed whether the previous link is still valid, has expired, or does not exist.
- **FR-006**: The new activation link MUST be presented to the renewing administrator exactly once, in a dedicated outcome that shows it in clear text, offers a copy action, states that it cannot be shown again, and states that the previous link no longer works. The outcome MUST require an explicit acknowledgement before it is dismissed, and MUST NOT close on its own, on a focus change, or on a navigation inside user administration.
- **FR-007**: The system MUST NOT allow the new activation link to be retrieved again after its outcome, through any consultation, export, or log seam; obtaining another one MUST require a further renewal.
- **FR-008**: A successful renewal MUST leave the pending user's access status, identity, email, role, invitation event, absence of password, and every other lifecycle event unchanged, and MUST NOT record an access status change.
- **FR-009**: A successful renewal MUST record its date and the organization admin who performed it. The access record MUST present the most recent renewal alongside the user's lifecycle events, to the viewers allowed to consult the access history, and a later renewal MUST replace it.
- **FR-010**: The system MUST restrict renewal to signed-in organization admins whose own access status is active, and MUST deny it to operations admins, operations leads, observers, unauthenticated visitors, non-active users, and sessions confined to their own password renewal.
- **FR-011**: The system MUST refuse a renewal whose target is not pending, with a reason naming the target's current access status and the action that applies instead — a password reset for an active user, a user reactivation for a deactivated one, an invitation restoration for a cancelled one.
- **FR-012**: The system MUST refuse a renewal targeting a user outside the requester's operating organization, or an identifier naming no user, identically and without revealing whether such a user exists.
- **FR-013**: The API MUST be the authoritative authorization boundary: the workbench MUST NOT offer, and MUST NOT appear to perform, a renewal the API would refuse to the same viewer.
- **FR-014**: A refused or failed renewal MUST issue no link, record nothing, and leave the previous link exactly as usable as it was before the attempt.
- **FR-015**: Repeated or concurrent renewals of the same pending user MUST leave exactly one link permitting acceptance — the last one issued — and a recorded renewal consistent with it.
- **FR-016**: A renewal processed concurrently with an acceptance or a cancellation of the same pending user MUST resolve to exactly one of them taking effect, and MUST NEVER report a renewal as successful for a user who is no longer pending.
- **FR-017**: The system MUST report authorization refusals, access-status refusals, unknown-target refusals, and transient failures with distinct, understandable, and actionable feedback.
- **FR-018**: The workbench MUST offer the renewal from a pending user's access record and from that user's row menu in the collection, under the same rules and with the same confirmation on both, and MUST NOT offer it on a user who is not pending.
- **FR-019**: The workbench MUST require an explicit confirmation that names the user concerned and states that any activation link already handed out to them will stop working, before the renewal is submitted; cancelling it MUST issue nothing and record nothing.
- **FR-020**: The workbench MUST prevent a duplicate submission of the same renewal while one is in flight.
- **FR-021**: Once the outcome is acknowledged, the workbench MUST return the administrator to where they renewed from, with the user still in the pending view and the renewal and the new link's validity reflected in the access record and the pending view, without a new sign-in or a manual reload.
- **FR-022**: The access record of a pending user MUST state the validity of their current activation link — valid until its expiry date, expired since its expiry date, or no link issued — and the pending view of the collection MUST let an organization admin tell, without opening a user, which pending users hold no link that still permits acceptance. The validity MUST be presented to the viewers allowed to consult the access history only, and presenting it MUST NOT expose the link itself or anything it could be derived from.
- **FR-023**: This feature MUST NOT deliver the activation link to the invited person, by email or otherwise; handing it out remains the renewing administrator's responsibility in this delivery.
- **FR-024**: This feature MUST NOT provide invitation, invitation acceptance, invitation cancellation or restoration, pending user removal, deactivation, reactivation, password reset, role change, or identity update, and MUST NOT change the invitation, acceptance, or sign-in behaviour beyond replacing the pending user's activation link and presenting its validity as FR-022 states.

### Key Entities *(include if feature involves data)*

- **Pending User**: A user whose access has been invited but not activated yet. Holds no password and cannot sign in. The only kind of user whose activation link may be renewed, and left otherwise unchanged by the renewal.
- **User Activation Link**: A confidential, unguessable, time-bounded link tied to exactly one pending user, allowing its holder to accept the invitation and choose an initial password. A pending user holds at most one that permits acceptance; it is presented once, at invitation or at renewal, and never consultable afterwards. Only its validity — valid until, or expired since, its expiry date — is presented after that.
- **User Activation Link Renewal**: The action of replacing a pending user's activation link without creating or restoring an invitation. It issues a new link valid for 7 days, ends the previous link's usefulness, and is recorded with its date and the organization admin who performed it.
- **Organization Admin**: The only role that may renew an activation link, and the actor recorded against the renewal.
- **Operating Organization**: The scope owning the pending users an administrator may renew; users of another organization are outside it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of renewals performed by an organization admin against a pending user issue exactly one new link valid for 7 days from the renewal, and 100% of the links they replace stop permitting acceptance at once.
- **SC-002**: In all authorization tests, organization admins renew successfully, and operations admins, operations leads, observers, unauthenticated visitors, non-active requesters, and confined sessions obtain no link and disclose no user information.
- **SC-003**: In acceptance testing, 100% of renewals targeting an active, deactivated, cancelled, unknown, or out-of-organization user are refused, with nothing issued, nothing recorded, and the target unchanged.
- **SC-004**: In acceptance testing, 100% of refused and failed renewals leave the previous link exactly as usable as it was, and each refusal produces distinct and accurate feedback.
- **SC-005**: In all repeated, concurrent, and racing-with-acceptance tests, no pending user ever holds more than one link permitting acceptance, and no renewal is reported successful for a user who is no longer pending.
- **SC-006**: In all activation link tests, the renewed link is presented exactly once and is unobtainable from every consultation, listing, record, and log seam afterwards.
- **SC-007**: An organization admin renews a link and captures it from the collection in no more than 3 interactions and under 1 minute, without leaving user administration.
- **SC-008**: In acceptance testing, 100% of renewals leave the pending user's access status, identity, email, role, and invitation event unchanged, and record exactly one dated, attributed renewal.
- **SC-009**: 95% of renewals return their outcome within 2 seconds under normal operating conditions.
- **SC-010**: In acceptance testing, 100% of pending users holding an expired link or no link are marked in the pending view and 0% of those holding a valid link are, every access record states the validity matching the link actually held, and nothing the record or the collection returns carries a link.

## Dependencies

- GH-7 — Invite a Pending User with a Confidential Activation Link (delivered): supplies the pending user, the activation link with its 7-day validity and its single live instance per user, and the once-only outcome this slice presents the renewed link in.
- GH-4 — Browse and Filter the User List (delivered): supplies the collection, the pending view, the access record and its history, and the row menu the renewal is offered from.
- GH-3 — Restrict Login to Active Users: guarantees the renewed pending user still cannot sign in.
- GH-8 — Accept an Invitation and Open an Authenticated Session: deliverable in parallel, neither blocks the other. GH-8 enforces a link's validity when it is used; this slice guarantees that only the most recently issued link can be recognized.
- GH-13 — Restore a Cancelled Invitation with a New Activation Link: blocked by this slice, because the restoration hands out a new activation link through the issuance and once-only presentation this slice establishes for an existing user.

## Out of Scope

- Accepting the invitation and choosing the initial password (GH-8), including how an expired or replaced link is presented to the invited person.
- Restoring a cancelled invitation with a new link (GH-13), cancelling a pending invitation (GH-12), and removing a never-activated user (GH-14).
- Delivering the activation link by email, which is the standalone "Send invitation emails" slice.
- Renewal requested by the invited person themselves, automatic renewal on expiry, and expiry reminders.
- Revoking a pending user's activation link without replacing it, which is what cancellation does.
- Bulk renewal over a selection of pending users.
- A history of every renewal beyond the most recent one, and any export of renewal activity.
- Changing the 7-day validity, and rate limiting or throttling of renewals: as for invitation, no dedicated limit is introduced here.

## Assumptions

- `User Activation Link Renewal` follows its `CONTEXT.md` definition: replacing an activation link for a pending user without creating or restoring an invitation. It is neither an invitation restoration nor a "resend", and no second invitation event is recorded.
- Only organization admins may renew, following `CONTEXT.md` and GH-7: they are the only role holding write access to the organization's users, and pending users are visible to them only.
- A renewal is not an access status change — the user stays pending — so it is recorded the way a password reset is: with its date and responsible administrator, presented in the access history next to the lifecycle events, and refreshed by the next occurrence rather than accumulated.
- The previous link must stop working at renewal rather than at its own expiry, because a renewal is often performed precisely because the previous link may have reached the wrong hands; GH-7 already anticipated this by keeping a single live link per pending user.
- Presenting a link's validity discloses no secret: the expiry date was already shown to the administrator in the once-only outcome, and it cannot be used to reconstruct or guess the link. It is restricted to the viewers allowed to consult the access history, like the renewal it accompanies, which in practice means organization admins, the only viewers of pending users.
- The same once-only outcome as the invitation is reused, so that administrators meet one way of handing out an activation link, whether it comes from an invitation or a renewal.
- A confirmation precedes the renewal because the renewal silently disables a link the invited person may already hold, which the administrator cannot observe from the workbench.
- The operating organization manages exactly one site, so the requester's organization determines which pending users are renewable without an organization or site picker.
- The workbench reuses the user administration patterns already established by GH-4, GH-7, and the password reset — the record footer and row menu actions, the explicit confirmation, the once-only activation link outcome, and the distinct refusal and retryable failure states.
- The invited person receives the renewed link out of band, consistently with this milestone excluding real email sending.

## Traceability

- Source issue: https://github.com/whazzark/portflow-ai/issues/9
- Parent roadmap: specs/user-administration/invitation-onboarding/roadmap.md (`#6`)
- Absorbed scope: the renewal part of "Manage Invitation Lifecycle From the Web Workbench", a frontend-only slice of the GH-11 roadmap split between GH-9, GH-12, GH-13 and GH-14 on 2026-09-10 and deleted from GitHub.
- Blockers: recorded as GitHub issue dependencies on the source issue.
- Domain vocabulary: CONTEXT.md (User Activation Link, User Activation Link Renewal, Pending User, User Invitation, User Invitation Acceptance, User Invitation Restoration, User Access Status, Organization Admin)
- Related slices: GH-7 (invitation, delivered), GH-8 (acceptance), GH-12 (cancellation), GH-13 (restoration, blocked by this slice), GH-14 (permanent removal), standalone "Send invitation emails".
