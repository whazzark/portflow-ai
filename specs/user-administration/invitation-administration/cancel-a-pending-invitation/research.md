# Research: Cancel a Pending Invitation

**Feature**: `GH-12` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

The spec left no `NEEDS CLARIFICATION`: the 2026-09-11 session settled the comment, the landing, and
the labels. What remained were design choices. Each is recorded below with its rationale and the
alternatives rejected. The codebase already fixes most of the ground: GH-2 shipped the `CANCELLED`
status with `cancelled_at` and `cancelled_by_user_id`, GH-7 shipped the `user_activation_tokens`
table, and GH-20 and GH-17 shipped two guarded user access writes this slice mirrors.

## D1 — Endpoint and route name

**Decision**: `POST /api/v1/users/:id/cancel-invitation`, route name `users.cancel_invitation`
(Tuyau: `tuyauQuery.users.cancelInvitation`), with an optional JSON body `{ comment }`. It answers
`200` with the cancelled user in the `toAdministration` projection.

**Rationale**: A command endpoint per transition is the established shape for user access writes
(`/:id/deactivate`, `/:id/password-reset`) and for every site reference lifecycle write. It keeps
the transition's eligibility decision on the server, and the route name reads as the domain action
from `CONTEXT.md`, "User Invitation Cancellation".

**Alternatives considered**:
- `DELETE /users/:id/invitation` — reads as a deletion, which `CONTEXT.md` lists as a term to avoid
  ("invitation deletion"), and it would collide in meaning with GH-14's permanent removal.
- `PATCH /users/:id` with `{ accessStatus: 'CANCELLED' }` — a generic status write moves the choice
  of transition to the client and would need a per-target eligibility table inside a generic update.
  No user access write works that way.

## D2 — Slice layout

**Decision**: A new workflow slice, `apps/api/app/users/cancel_invitation/`, holding
`cancel_user_invitation_use_case.ts` and `cancel_user_invitation_validator.ts`. The one new
exception goes to `app/users/shared/user_exceptions.ts`, and the repository operation to the shared
`UserRepository`.

**Rationale**: `apps/api/AGENTS.md` puts each workflow in its own slice and shared helpers under
`shared/`. The new refusal, "already activated", belongs in `shared/` because GH-13 (restoration)
and GH-14 (removal) will refuse an activated user for the same reason. The deactivation slice keeps
its refusals in the same shared file for the same reason.

**Alternatives considered**: putting the command in `app/users/invite/`. That slice owns creating
access, not withdrawing it, and grouping them would make GH-13 and GH-14 extend a slice whose name
no longer describes it.

## D3 — Refusal codes

**Decision**: One code per reason, reusing those that already carry the right meaning:

| Target state | Status | Code | Origin |
|---|---|---|---|
| unknown id | `404` | `E_USER_NOT_FOUND` | existing |
| active | `409` | `E_USER_ALREADY_ACTIVATED` | **new** — `UserAlreadyActivatedException` |
| deactivated | `409` | `E_USER_ALREADY_DEACTIVATED` | existing |
| already cancelled | `409` | `E_USER_CANCELLED_INVITATION` | existing |

Authorization failures stay Bouncer's `403 E_AUTHORIZATION_FAILURE`, unauthenticated requests stay
`401`, and a malformed id or an over-long comment stays VineJS's `422`.

**Rationale**: FR-007 requires distinguishable reasons. Deactivation, the sibling transition,
already refuses by distinct codes, and the web maps each code to a sentence addressed to the
administrator. The two existing `409`s describe exactly the target states this command refuses, so
reusing them keeps one code per fact across both commands.

**Alternatives considered**: one `E_USER_NOT_PENDING` carrying the access status in `meta`, the
shape GH-7 uses for its email conflict. GH-7 needs `meta` because one refusal applies to four
statuses and the status *is* the message. Here each status carries a different next step, and a
single code would push the choice of sentence into a `meta` switch that the per-code copy table
already does better.

## D4 — The write: guard, token deletion, one transaction

**Decision**: A new repository operation, `cancelPendingInvitation(command)`, which returns a typed
outcome:

```text
{ kind: 'CANCELLED', user } | { kind: 'NOT_FOUND' } | { kind: 'NOT_PENDING', accessStatus }
```

Inside one transaction, it:

1. runs a guarded `UPDATE users … WHERE id = ? AND access_status = 'PENDING'`, which sets the
   status, `cancelled_at`, `cancelled_by_user_id`, `cancellation_comment`, and `updated_at`;
2. on zero affected rows, re-reads the row only to name the reason (`NOT_FOUND` or `NOT_PENDING`
   with the current status) and writes nothing;
3. otherwise deletes the `user_activation_tokens` row of that user;
4. reloads the user through `preloadAccessHistory` for the response.

**Rationale**: This is `deactivateActive` with the status and the side effect swapped. The guard is
both the eligibility rule and the concurrency control: two racing cancellations match one row
between them (FR-015), and a target that changed status after the workbench listed it matches none
(US5-2). The re-read never decides the outcome, so there is no check-then-act window. The
transaction makes the status change and the end of the link inseparable (FR-005). Neither a
cancelled user holding a live token nor a pending user whose token vanished can exist.

The token is **deleted**, not flagged. The `user_activation_tokens` migration was designed for this:
one live row per pending user, "one row to replace or delete". Deleting it means the acceptance
lookup by digest finds nothing, which is exactly the unknown-link response GH-8 must give (spec
assumption), and GH-13 inserts a fresh row on restoration. A `revoked_at` flag would force every
future reader of the table to filter on it, and would keep a credential digest nobody can use.

**Alternatives considered**:
- Read under `FOR UPDATE`, then an unguarded write, the `requirePasswordRenewal` shape. That works
  on PostgreSQL but needs a second guard for SQLite, where knex emits no `FOR UPDATE`. The guarded
  `UPDATE` is atomic on both dialects by itself.
- Deleting the token by `ON DELETE CASCADE`. That only fires on deleting the user, which is GH-14.

## D5 — Races with acceptance (GH-8) and renewal (GH-9)

**Decision**: This slice guarantees its own side. The status flip commits together with the token
deletion, under the row lock PostgreSQL's `UPDATE` takes on the `users` row. GH-8 and GH-9 must
guard their own writes on the same `users` row still being `PENDING`, with a conditional `UPDATE` or
a `FOR UPDATE` read inside the transaction that touches the token. This obligation is recorded in
[contracts/http-api.md](./contracts/http-api.md#obligations-on-later-slices), where those slices
will look for it.

**Rationale**: A token-only write does not serialize against this cancellation. Inserting or
replacing a `user_activation_tokens` row takes only a `KEY SHARE` lock on the parent `users` row,
which this command's non-key `UPDATE` (`FOR NO KEY UPDATE`) does not block. A renewal that touched
only the token table could therefore commit a fresh link for a user who had just been cancelled.
Touching the `users` row with a `PENDING` guard is what makes the second writer wait on this
command's commit and then match zero rows. Under READ COMMITTED, PostgreSQL re-evaluates the `WHERE`
against the committed row. This is the invariant stated in the spec's Edge Cases. Neither GH-8 nor
GH-9 exists yet, so it is testable end to end only once they land. Their specs should cite it.

**Alternatives considered**: taking an advisory lock or `SELECT … FOR UPDATE` on the token row here.
That does not help when no token row exists yet, which is exactly the renewal-inserts case, and it
would be a lock no other user write in the codebase uses.

## D6 — Storing the comment

**Decision**: One nullable `text` column, `users.cancellation_comment`, written by the same guarded
`UPDATE` and holding the latest cancellation only. The comment is optional and capped at 1,000
characters by the shared `lifecycleComment()` validator, which trims. The use case applies
`comment?.trim() || null`, so a blank comment becomes `null`, exactly as `ArchiveCustomerUseCase`
does.

**Rationale**: The access record keeps "the latest useful dates and actors on the user" (spec
assumption), so the comment sits beside `cancelled_at` and `cancelled_by_user_id`, the way customers
keep `archive_comment` beside `archived_at`. The 1,000-character limit, the trimming, and the
blank-to-null rule are the ones every lifecycle comment in the product already follows (FR-003a),
so the web can reuse `LIFECYCLE_COMMENT_LABEL` and the `Textarea` limit unchanged.

The migration adds a column with no foreign key, so `up()` is the plain `alterTable` of
`1785500000000_add_user_password_renewal.ts`. `down()` takes that migration's SQLite branch, because
dropping a column rebuilds `users`, and the rebuild is refused while its children enforce foreign
keys.

**Alternatives considered**:
- A generic access event table with a comment per event: that is the full access history the spec
  explicitly does not introduce, and every other access event lives on `users`.
- Storing the comment on the token row, which the cancellation deletes.

## D7 — Authorization

**Decision**: A new `UserPolicy.cancelInvitation(user)`, which requires an active organization admin,
exactly like `deactivate`. The controller authorizes before it validates the id or reads the target.

**Rationale**: FR-008 fixes the actor. Authorizing first is what FR-009 needs: an operations admin
receives the same `403` whether the id is malformed, unknown, pending, or cancelled, so the refusal
discloses nothing. `deactivate` and `resetPassword` document the same ordering for the same reason.

**Alternatives considered**: reusing `UserPolicy.deactivate`. The two rules are identical today, but
a separate ability keeps each command's authorization legible, and lets either change without
silently changing the other.

## D8 — No self-cancellation rule

**Decision**: No self check in the use case.

**Rationale**: The acting administrator is, by the policy, `ACTIVE`, so targeting themselves falls
into `NOT_PENDING` → `E_USER_ALREADY_ACTIVATED` (spec Edge Cases). Deactivation needs its own
case-insensitive self check because an active target is eligible there. Here the eligibility rule
already excludes the actor, and a second rule would be dead code.

## D9 — Projection

**Decision**: `UserTransformer.toAdministration()` gains `cancellationComment`, gated by
`includeAccessHistory` like every other access event field. `toObject()`, the session contract, is
unchanged. The endpoint responds with the `toAdministration` projection with the access history
included, like `deactivate`.

**Rationale**: The comment is part of the access record, which only organization admins may consult
(FR-014, FR-018). A withheld key is absent rather than `null`, the existing rule for the
operations-admin projection. A cancelled user can never hold a session, so `toObject()` has nothing
to gain.

## D10 — Web: a second user access action, not a second dialog

**Decision**: Extend the existing `UserAccessAction` union with `'cancel-invitation'`, and make
`UserAccessDialog` action-aware. Per action, it chooses the title, the effect sentence, the confirm
and dismiss labels, the mutation, the success message, the refusal table, and whether a comment
field is shown. `userAccessActions(viewer, user)` offers `'cancel-invitation'` to an organization
admin on a `PENDING` user. That one answer feeds both the record footer and the row menu (FR-012),
so the two cannot disagree.

**Rationale**: `helpers/user-access-copy.ts` was written expecting this ("Keyed by action because the
record gains reactivation next; a second action adds a key here, not a second dialog"). Reusing it
keeps one confirmation pattern for every change of access status, and the row menu and record
footer pick the action up with no change of their own.

The site reference `ResourceLifecycleDialog` is **not** reused: its copy is keyed to the
archive/reactivate vocabulary, which `user-access-copy.ts` deliberately stays out of, and its
dismiss button is a fixed `Cancel`, which is exactly what FR-011a rules out. What it has that this
action needs, the comment field, is copied in shape: the same `LIFECYCLE_COMMENT_LABEL`, the same
`Textarea maxLength={1000}`, and the same "a refusal keeps the typed comment" behavior.

**Alternatives considered**: a dedicated `CancelInvitationDialog` beside `ResetPasswordDialog`. The
password reset stands apart because it changes a credential rather than an access status (its own
docstring). A cancellation *is* an access status change, like deactivation.

## D11 — Web copy

**Decision** (the wording the contract fixes; the vocabulary comes from `CONTEXT.md` and
`helpers/resource-copy`):

| Element | Text |
|---|---|
| Action (footer, row menu, confirm button) | `Cancel invitation` |
| Pending label | `Cancelling…` |
| Dismiss button | `Keep invitation` |
| Title | `Cancel invitation?` |
| Effect | `“<name>” will no longer be able to activate their access. The activation link they were given stops working immediately.` |
| Comment field | `Comment (optional)` with the lifecycle description; at most 1,000 characters |
| Success toast | `Invitation for “<name>” cancelled` — `confirmationMessage('invitation for', name, 'cancelled')` |
| Failure title | `Unable to cancel invitation for “<name>”` — `refusalTitle('cancel', namedRecord('invitation for', name))` |

The refusal sentences are per action. The existing table becomes keyed by action, because
`E_USER_ALREADY_DEACTIVATED` means "someone else got there first" for a deactivation but "there is no
invitation left" for a cancellation:

| Code | Cancellation sentence |
|---|---|
| `E_USER_ALREADY_ACTIVATED` | This user has already activated their access. Deactivate them instead. |
| `E_USER_ALREADY_DEACTIVATED` | This user activated their access and has since been deactivated. There is no invitation left to cancel. |
| `E_USER_CANCELLED_INVITATION` | This invitation has already been cancelled by someone else. |
| `E_USER_NOT_FOUND` | This user no longer exists. |
| `E_VALIDATION_ERROR` | the field-level message (the comment limit) |

**Rationale**: FR-011a fixes the labels (clarification 3). The effect sentence carries the FR-011
consequence. The toast and failure title reuse the shared sentence shapes, as `apps/web/AGENTS.md`
requires. The dialog title is per action, because the current `${label} user?` would render
"Cancel invitation user?".

## D12 — Landing after success

**Decision**: No navigation. On success the dialog closes and a toast names the user, and the
mutation invalidates the collection. `UsersPage` already closes the record once its user leaves the
visible view, and the pending user does leave it.

**Rationale**: This is clarification 2, and it is what deactivation does through the same
mechanism. Staying on the pending view is the absence of any navigation (FR-013 "MUST NOT switch to
the cancelled view on its own").

## D13 — Failure handling in the workbench

**Decision**: The mutation refreshes the collection on success **and** on failure, as `deactivate`
does. Failures are handled three ways:

- **Refusal** (`404`, `409`): the dialog stays open with the reason as the toast description. When
  the reason is that the user already moved on, the refreshed collection retires the record and the
  footer's dialog with it, and the toast outlives both. This is the documented `UserAccessDialog`
  behavior, and the row menu keeps its dialog either way.
- **Validation** (`422`, only reachable around the browser limit): the dialog stays open with the
  typed comment, and the field-level message is the toast description.
- **Retryable** (network or `5xx`): the dialog stays open with the comment, and the confirm button
  is re-enabled so the administrator can retry (FR-016, US5-3/4).

The confirm button is disabled while the request is pending (US4-4).

## D14 — Verification seams

**Decision**:

- **API unit**: the use case, covering outcome selection, comment normalization, and each refusal.
  The repository write is tested against SQLite (ADR-0014): the status flip, the event and comment,
  the token deletion, a refusal leaving the row and token untouched, and a second call returning
  `NOT_PENDING`/`CANCELLED`.
- **API integration**: the endpoint contract: `401`, the `403` matrix (operations admin, operations
  lead, observer, non-active admin), `422` (malformed id, over-long comment), `404`, the three `409`s,
  success with its response shape, the token being gone, sign-in refused for the cancelled email, the
  operations-admin listing never showing the user, and two concurrent requests yielding one `200`
  and one `409`.
- **Web feature tests** through the real router and MSW: offer rules per role and status, the
  confirmation (labels, comment, dismissal), the journey (toast, record closed, counts, cancelled
  view, history with the comment), each refusal, retry, and the row menu.

No `apps/web/e2e` directory exists, so no end-to-end journey is added. The manual walkthrough in
[quickstart.md](./quickstart.md) covers the browser flow.
