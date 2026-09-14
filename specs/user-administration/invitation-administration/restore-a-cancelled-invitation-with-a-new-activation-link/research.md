# Research: Restore a Cancelled Invitation with a New Activation Link

**Feature**: `GH-13` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

The spec left no `NEEDS CLARIFICATION`: the 2026-09-11 session settled the comment, the fate of the
earlier cancellation, and the pending view's `Invited` column. What remained were design choices.
Each is recorded below with its rationale and the alternatives rejected.

Almost all the ground is already built. GH-12 shipped the `CANCELLED` transition, its comment rule,
and the deletion of the link at cancellation. GH-9 shipped `ActivationLinkIssuer` reuse for an
existing user, the `{ user, activationLink }` envelope, and the page-level
`IssuedActivationLinkProvider` that presents a link once. GH-8 shipped acceptance, which consumes
any live token of a pending user. This slice sits between those three and adds one command, three
columns, and one workbench action.

## D1 — Endpoint and route name

**Decision**: `POST /api/v1/users/:id/restore-invitation`, route name `users.restore_invitation`
(Tuyau: `tuyauQuery.users.restoreInvitation`), with an optional JSON body `{ comment }`. It answers
`200` with `{ user, activationLink }`.

**Rationale**: A command endpoint per transition is the shape every user access write uses. The path
mirrors its inverse, `/:id/cancel-invitation`, so the pair reads as one in `start/routes.ts` and in
the typed client. `200` rather than `201`: no user is created, as for the renewal.

**Alternatives considered**:
- `POST /:id/invitation-restoration`, the noun form of `activation-link-renewal` and
  `password-reset`. Equally valid. Rejected only because the one sibling this action undoes uses the
  verb form, and the pair is what a reader looks for.
- `PATCH /users/:id` with `{ accessStatus: 'PENDING' }`: a generic status write moves the choice of
  transition to the client and cannot carry the issued link. No user access write works that way.
- Re-inviting through `POST /users` with the cancelled email: GH-7 deliberately refuses it
  (`E_USER_EMAIL_CONFLICT`) and routes to restoration, and `CONTEXT.md` avoids "recreate
  invitation".

## D2 — Slice layout

**Decision**: A new workflow slice, `apps/api/app/users/restore_invitation/`, holding
`restore_user_invitation_use_case.ts`, `restore_user_invitation_validator.ts`, and
`invitation_restoration_exceptions.ts`. The repository operation joins the shared `UserRepository`,
and the policy ability joins `UserPolicy`. Tests go under `tests/{unit,integration}/users/
invitation_restoration/`, beside `invitation_cancellation/`.

**Rationale**: `apps/api/AGENTS.md` puts each workflow in its own slice and shared helpers under
`shared/`. The exception is slice-local because only this command refuses a target for not being
cancelled, which is how `activation_link_renewal_exceptions.ts` keeps `E_USER_NOT_PENDING`.

**Alternatives considered**: adding the command to `cancel_invitation/`. That slice owns withdrawing
access; restoring it is the opposite transition with a different side effect (issuing a secret), and
one slice owning both would outgrow its name.

## D3 — Refusal codes

**Decision**: One slice-local conflict code carrying the status the target actually holds, the shape
GH-9 set for the renewal:

| Target state | Status | Code | `meta` |
|---|---|---|---|
| unknown id | `404` | `E_USER_NOT_FOUND` | — (existing) |
| pending | `409` | `E_USER_NOT_CANCELLED` | `{ accessStatus: 'PENDING' }` — **new** |
| active (the requester included) | `409` | `E_USER_NOT_CANCELLED` | `{ accessStatus: 'ACTIVE' }` |
| deactivated | `409` | `E_USER_NOT_CANCELLED` | `{ accessStatus: 'DEACTIVATED' }` |

`UserNotCancelledException`: status `409`, code `E_USER_NOT_CANCELLED`, message "Only a cancelled
invitation can be restored". Authorization stays Bouncer's `403 E_AUTHORIZATION_FAILURE`, a session
owing its own password renewal stays the middleware's `403 E_PASSWORD_RENEWAL_REQUIRED`, and a
malformed id or an over-long comment stays VineJS's `422`.

**Rationale**: FR-011 needs each reason distinguishable and pointing to what applies instead. The
`accessStatus` in `meta` distinguishes them, and it is what the workbench keys its sentence on,
exactly as it already does for the renewal. The existing per-status codes would say the wrong thing:
`E_USER_PENDING_INVITATION`'s message says "cancel the invitation instead", and
`E_USER_ALREADY_ACTIVATED`'s says "deactivate them instead", neither of which answers a restoration.
Naming the status discloses nothing: only an organization admin gets past the policy, and they
consult every status anyway (FR-013 is about the viewers the policy stops).

**Alternatives considered**:
- Reusing `E_USER_PENDING_INVITATION`, `E_USER_ALREADY_ACTIVATED`, and `E_USER_ALREADY_DEACTIVATED`,
  as GH-12 did. Their API messages would point to cancellation and deactivation, which is wrong for
  any client that shows the API message, the workbench's own fallback included.
- Three new per-status exceptions, as GH-14 did. The same information in three times the surface,
  where GH-9 already set the one-code-plus-status convention for "this action needs status X".

## D4 — Authorization

**Decision**: A new `UserPolicy.restoreInvitation(user)` ability with the rule every user write
uses: `accessStatus === 'ACTIVE' && role === 'ORGANIZATION_ADMIN'`. The controller authorizes before
it validates or reads anything. The `passwordRenewalCompleted` middleware on the authenticated group
already confines a session owing its own renewal. There is no self-restoration rule.

**Rationale**: FR-012 and FR-013. Authorizing first is what makes a denied request identical
whether the id is malformed, unknown, or names a cancelled user. The requester is active by
construction, so naming themselves is simply a target that is not cancelled (the spec's first edge
case), refused by D3's code with `ACTIVE`.

**Alternatives considered**: reusing `cancelInvitation` or `renewActivationLink` as the ability. The
rules agree today, but `UserPolicy` keeps one method per action so that the day they diverge no
shared ability grows a parameter, the reason `remove` gives.

## D5 — The write: guarded status change and token replacement in one transaction

**Decision**: `LucidUserRepository.restoreCancelledInvitation(command)` runs one transaction:

1. `UPDATE users SET access_status = 'PENDING', invitation_restored_at, invitation_restored_by_user_id,
   invitation_restoration_comment, updated_at WHERE id = :id AND access_status = 'CANCELLED'`.
2. If zero rows: re-read the row only to name the reason, and return `NOT_FOUND` or
   `NOT_CANCELLED { accessStatus }`. Nothing else runs.
3. `DELETE FROM user_activation_tokens WHERE user_id = :id`.
4. `INSERT` the new token (digest and expiry issued by the use case before the transaction).
5. Reload the user through `preloadAccessHistory` and return `RESTORED { user, activationToken }`.

The use case calls `ActivationLinkIssuer.issue()` before the write, as the renewal does, so no
randomness or hashing runs inside the transaction and a refused restoration simply discards a secret
that was never stored.

**Rationale**:
- **Guard as eligibility and concurrency control** (FR-010, FR-020). This is `cancelPendingInvitation`
  with the statuses swapped. A single-row conditional `UPDATE` is atomic on PostgreSQL and SQLite:
  two racing restorations match one row between them, and the loser re-evaluates the `WHERE` after
  the winner commits, finds `PENDING`, and matches nothing, so it inserts no token. No `SELECT … FOR
  UPDATE` is needed: the renewal takes one because it changes no status and so has nothing to guard
  on, which is not the case here.
- **One transaction** (FR-007): the status change and the new link commit together or not at all.
  A failure after the `UPDATE` rolls it back, so the user is still cancelled and no token exists.
- **Delete before insert** (FR-006): GH-12 already leaves a cancelled user with no token, so the
  delete is normally a no-op. It makes "no link issued before the restoration survives it" hold
  unconditionally, whatever state a legacy or seeded row is in, and keeps the `user_id` unique index
  from turning such a row into a 500. The renewal deletes before inserting for the same reason.
- **Why this matters more than it looks**: GH-8 accepts a token whose user is `PENDING`. A token
  that survived a cancellation would come back to life the moment its user is pending again. The
  delete in step 3 is the second of two guarantees, after GH-12's own.

**Races with the other writes on the same row**, all serialized by the row lock the `UPDATE` takes:

| Other write | Its guard | Outcome |
|---|---|---|
| second restoration | `access_status = 'CANCELLED'` | the loser matches zero rows → `NOT_CANCELLED { PENDING }`, no token (US5-1) |
| removal (GH-14) | `DELETE … WHERE access_status IN ('PENDING','CANCELLED')` | restoration first: the removal then deletes a pending user, and the new token goes with it (`ON DELETE CASCADE`). Removal first: the restoration matches zero rows and the re-read finds nothing → `NOT_FOUND` (US5-5) |
| identity update (GH-24) | `findByIdForUpdate` row lock | serialized; a correction that lands first is the identity restored; one that lands after meets a pending user and GH-24's pending rules |
| role change (GH-28) | guarded `UPDATE` | serialized; both apply, since pending and cancelled users both accept a role |
| cancellation (GH-12) | `access_status = 'PENDING'` | cannot race a restoration of the same user: each needs the status the other produces. Cancel-after-restore simply deletes the new token, as for any pending user |
| acceptance (GH-8) | token digest + `access_status = 'PENDING'` | a cancelled user has no token to present; only the token this write inserts can be accepted, after it commits |

**Alternatives considered**:
- Lock-then-check (`forUpdate()` read, then write), the renewal shape. It works, but it adds a read
  whose only job is to name the refusal, which the guard's zero-row re-read already does. And a
  guarded status change needs no lock, as GH-12 documents.
- Updating the existing token row in place instead of delete-and-insert. There is normally no row to
  update, and `created_at` would stop meaning "when this link was issued".

## D6 — Recording the restoration: three columns on `users`

**Decision**: Three nullable columns beside the other lifecycle events:
`invitation_restored_at` (timestamp), `invitation_restored_by_user_id` (uuid → `users.id`,
`ON DELETE SET NULL`), and `invitation_restoration_comment` (text). Overwritten by every restoration
(latest only), and cleared by nothing: neither a later cancellation, nor an acceptance, nor a renewal
touches them. The restoration writes no other lifecycle column: `cancelled_*` and
`cancellation_comment` stay as they were (FR-002, clarification 2), and `invited_*` and
`activation_link_renewed_*` are untouched (FR-003).

**Rationale**: A restoration is an access status change (`CANCELLED → PENDING`), and the access
record keeps one dated, attributed slot per kind of change, latest only. That is the model of
`cancelled_*`, `deactivated_*`, and `reactivated_*` (research D6 of GH-12). The comment sits beside
the event it annotates, as `cancellation_comment` sits beside `cancelled_at` and site references keep
`reactivation_comment` beside `reactivated_at`. `text` rather than a bounded `string`, because the
1,000-character limit is enforced in the validator like every lifecycle comment.

**Naming**: `invitation_restored_*` rather than `restored_*`. On `users`, a bare `restored_at` reads
as "user restoration", the term `CONTEXT.md` lists to avoid (it means reactivation there). The
renewal set the precedent of naming the object the event acts on (`activation_link_renewed_*`).

**Known limit of the latest-only model**: after invite → cancel → restore → cancel, the record shows
Invited, Invitation restored, Cancelled. The first cancellation was replaced by the second, so the
restoration appears without the cancellation it reversed. The spec accepts this (no full access
history is introduced), and the dates still order correctly.

**Alternatives considered**:
- Rewriting `invited_at` / `invited_by_user_id` to the restoration: it would make the restoration a
  new invitation, which `CONTEXT.md` rules out, and the spec keeps the original invitation (FR-002,
  clarification 3).
- Clearing `cancelled_*` on restoration: rejected in clarification 2.
- An access history table: out of scope, as it was for GH-12.

## D7 — Migration and SQLite handling

**Decision**: `apps/api/database/migrations/1786100000000_add_user_invitation_restoration.ts`,
adding the three columns. It copies `1786000000000_add_user_activation_link_renewal.ts`: a dialect
branch in both `up()` and `down()`, `disableTransactions = true`, and `PRAGMA foreign_keys` toggled
around the SQLite rebuild. `apps/api/database/schema.ts` is regenerated by `db:migrate`.

**Rationale**: The actor column carries a `REFERENCES` clause, so on SQLite knex rebuilds `users`,
and the rebuild's `DROP TABLE` is refused while `users`' children enforce their references. That
migration documents the same case and its fix.

**Alternatives considered**: two migrations, one for the foreign-key column and one for the comment.
One event, one migration, as the renewal did for its two columns.

## D8 — The comment

**Decision**: The validator uses the shared `lifecycleComment()` rule (trimmed, at most 1,000
characters, nullable, optional). The use case turns a blank comment into `null`, as
`CancelUserInvitationUseCase` does. An over-long comment is VineJS's `422`, and the workbench shows
its field-level message while keeping the typed text.

**Rationale**: Clarification 1 requires the cancellation comment's rules. Reusing the validator rule
and the use case line is what makes them the same rules rather than a copy.

## D9 — Response and presentation of the link

**Decision**: The response is `{ user, activationLink }`, the envelope of `POST /users` and of the
renewal. `activationLink` is `{ url, expiresAt }`, returned in this `200` and nowhere else.
`user.activationLinkExpiresAt` equals `activationLink.expiresAt`, because the user is pending again
and the existing projection already reports a pending user's live token.

**Rationale**: FR-008 and FR-009. The web already types `ActivationLinkDto` from `users.store` and
presents it through `IssuedActivationLinkProvider`. The same envelope means no new DTO and one way of
handing out a link.

## D10 — Projection

**Decision**: `UserTransformer.toAdministration()` gains three keys gated by `includeAccessHistory`:
`invitationRestoredAt`, `invitationRestoredBy` (summary actor), and `invitationRestorationComment`.
`preloadAccessHistory` gains `.preload('invitationRestoredBy')`, and `User` gains the matching
`belongsTo`. `toObject()`, the session representation, is unchanged.

**Rationale**: FR-019 puts the restoration and its comment in the access record, visible to
organization admins only, which is what `includeAccessHistory` means. Withheld keys are absent
rather than null, as for every other event. `toObject()` stays frozen because the session
representation carries no renewal or comment either, and the auth contract does not need to change
for this slice.

## D11 — Web: a dedicated dialog, not a fourth `UserAccessAction`

**Decision**: The restoration is offered by a new `canRestoreInvitation(viewer, user)` helper
(organization admin, cancelled target) and opened as a new `RestoreInvitationDialog`, mounted by the
record footer (`UserAccessActions`) and the row menu (`UserRowActions`) beside the renewal. It is not
added to `userAccessActions` or `UserAccessDialog`.

**Rationale**: `UserAccessDialog` is built for status changes whose outcome is a toast. Its success
path closes and toasts, it lets the administrator dismiss while a request is in flight, and its
mutations keep their result in the cache. A restoration's outcome is a secret presented once, so it
needs what the renewal dialog already does: no dismissal once submitted (the answer may carry the
only working link), the link handed to the page before the dialog closes, and a mutation with
`gcTime: 0`. The renewal set this family apart for the same reason, and `UserAccessActions` already
documents why credential-issuing actions sit beside the status actions rather than among them.

**Placement and labels**: the record footer shows **Restore** as an outline button beside
the others. The row menu lists it after Edit and before **Remove**, which stays last because it is
destructive. The dialog title is **Restore invitation?**, the confirm button **Restore**
(**Restoring…** while in flight), the dismiss button **Cancel** (FR-015, FR-016). The label carries the
action alone: the record, the row, and the dialog title already say what is restored.

**Alternatives considered**: a fourth `UserAccessAction`, `'restore-invitation'`. It would give the
offer rule one home, but `UserAccessDialog` would need a second success path, a pending-lock on
dismissal, and a result-bearing mutation, all to serve one action out of four.

## D12 — The outcome survives the user leaving the view

**Decision**: `RestoreInvitationDialog` hands the result to `usePresentActivationLink()` and then
closes, exactly as `RenewActivationLinkDialog` does. `IssuedActivationLinkProvider` gains an
`origin: 'renewal' | 'restoration'` in what it holds, and `ActivationLinkDialog`'s `origin` gains
`'restoration'`, with its own sentence: "{name}'s invitation is pending again. Any link they were
given before still does not work. Hand them this one so they can choose their password."

**Rationale**: FR-008 and US4-8. Unlike the renewal, the restored user leaves the cancelled view as
soon as the collection refreshes, so the record closes (the view-membership rule `UsersPage` applies
to every access write) and the row disappears, taking the dialog with them. The provider sits above
both at page level, so the link does not go with them. The refresh is not awaited, so the link is
handed over before it lands. Then FR-018 holds by construction: the workbench stays on the cancelled
view, the user is gone from it and appears in the pending view with both counts updated, and nothing
navigates.

**No success toast**: the once-only outcome names the user and is itself the confirmation, as for
the renewal.

## D13 — Refusals and failures in the workbench

**Decision**: The dialog maps refusals to sentences addressed to the administrator, falling back to
the API message for anything unmapped:

| Refusal | Sentence |
|---|---|
| `E_USER_NOT_CANCELLED`, `PENDING` | "{name}'s invitation is already pending, so there is nothing to restore. Renew their activation link if they need a new one." |
| `E_USER_NOT_CANCELLED`, `ACTIVE` | "{name} has already activated their access. There is no invitation to restore." |
| `E_USER_NOT_CANCELLED`, `DEACTIVATED` | "{name}'s access was deactivated. Reactivate it instead." |
| `E_USER_NOT_FOUND` | "{name} no longer exists. Refresh to see the current users." |
| `E_AUTHORIZATION_FAILURE` | "You are not allowed to restore an invitation." |
| `422` on `comment` | the field-level message from `error.details[0]` |

A refusal keeps the dialog open with the typed comment (`event.preventDefault()` on confirm). The
mutation refreshes the collection on success and on error, so a stale record is corrected under the
toast. When the refusal is that the user moved on, the refresh drops them from the cancelled view and
the dialog unmounts with the record, as `UserAccessDialog` documents; the toast outlives it. A
network failure is a toast with the client's retryable message, and the dialog stays open for a
retry (FR-022).

## D14 — Access history, collection, and existing pointers

**Decision**:
- `user-access-history.tsx` gains an **Invitation restored** event carrying
  `invitationRestorationComment`, sorted by date with the others (FR-019, clarification 2).
- `user-table.tsx` needs no change: the pending view's `Invited` column reads `invitedAt` /
  `invitedBy` only (clarification 3), and the `Activation link` column reads
  `activationLinkExpiresAt`, which the restoration sets.
- The two existing pointers ("Restore it instead" in the renewal refusal and in the invitation
  conflict) keep their wording. They now lead to an action that exists (US4-10).

**Label**: "Invitation restored" rather than "Restored": the history lists every event of the
user, and "Restored" alone would read as a user restoration, the term `CONTEXT.md` avoids.

## D15 — Test strategy

**Decision**: RED → GREEN → REFACTOR at three seams, mirroring GH-12 and GH-9:

| Seam | File | Proves |
|---|---|---|
| Japa unit, SQLite | `tests/unit/users/invitation_restoration/restore.spec.ts` | use case: success shape, comment normalization, each refusal and its `meta`, nothing written on refusal, no link issued on refusal (US1, US3, FR-002–FR-006, FR-010, FR-011) |
| Japa unit, SQLite | `tests/unit/users/invitation_restoration/guarded_write.spec.ts` | repository: one token after restore, stale token deleted, cancellation event untouched, repeated restoration refused as `PENDING` with one token, restoration after removal is `NOT_FOUND`, rollback leaves the user cancelled with no token (FR-006, FR-007, FR-020, FR-021) |
| Japa integration | `tests/integration/users/invitation_restoration/restore.spec.ts` | endpoint: authorization matrix, `422` on id and comment, `404`/`409` bodies, the `200` envelope, and end to end through `POST /auth/invitation-acceptance`: the pre-cancellation link is unusable, the new one activates (US1-3, US1-4, US2, FR-012, FR-013, FR-023) |
| Japa integration | `tests/integration/users/consultation/list.spec.ts` (edit) | the three new keys are present for organization admins and absent for operations admins (FR-019, FR-024) |
| Vitest + MSW | `apps/web/src/features/users/__tests__/invitation-restoration/` | `permissions`, `confirmation`, `journey` (link presented, stays open while the row disappears, lands on the cancelled view, counts), `refusals`, `recovery` (retry after network failure, comment kept), `row-menu`, `history` |

PostgreSQL-only lock behaviour is argued in D5 and exercised by the guard on SQLite, as GH-12 and GH-9
do. There is no `apps/web/e2e` directory, so the browser flow is the [quickstart](./quickstart.md)
walkthrough.
