# Research: Renew a Pending User Activation Link

**Feature**: `GH-9` · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

The Technical Context carried no open unknown: the stack, the storage, the token shape, and the
workbench patterns are all already delivered by GH-7 (invitation) and GH-17 (password reset). What
follows are the decisions this slice has to take on top of them, each with what was rejected.

## D1 — The slice lives under `#users`, as `app/users/activation_link_renewal/`

**Decision**: A new vertical slice directory beside `invite/` and `password_reset/`, holding
`renew_activation_link_use_case.ts`, `renew_activation_link_validator.ts`, and
`activation_link_renewal_exceptions.ts`. The policy, the repository, the transformer, and the
`ActivationLinkIssuer` stay in `app/users/shared/`.

**Rationale**: It is administration of another person's access, exactly like the invitation it
recovers from. `ActivationLinkIssuer` already sits in `shared/` and says so in its own comment: "so
the renewal slice can reuse the issuance whole".

**Alternatives considered**: folding the renewal into `invite/` — rejected: the two share the
issuance, not the decision. The invitation decides on an email; the renewal decides on an existing
user's access status.

## D2 — One endpoint, `POST /api/v1/users/:id/activation-link-renewal`, named `users.activation_link_renewal`

**Decision**: `router.post('/:id/activation-link-renewal', [controllers.Users, 'renewActivationLink']).as('activation_link_renewal')`
in the existing `/users` group. There is no request body; the target is the path parameter and the
actor is the session. The web reaches it as `tuyauQuery.users.activationLinkRenewal`.

**Rationale**: It follows the shape `POST /users/:id/password-reset` already set for a bodiless
administrative command on one user, and names the action with the `CONTEXT.md` term — *User
Activation Link Renewal*. `POST`, because every call issues a new secret: it is neither safe nor
idempotent.

**Alternatives considered**:

- `PUT /users/:id/activation-link`: rejected — `PUT` promises idempotency, and two identical calls
  here produce two different links.
- `POST /users/:id/activation-link` (creating a link resource): rejected — no link resource is ever
  readable, so a resource path would advertise a `GET` that must never exist (FR-007).

## D3 — `UserPolicy.renewActivationLink` authorizes the viewer; the repository decides the target

**Decision**: A new policy method returning `accessStatus === 'ACTIVE' && role === 'ORGANIZATION_ADMIN'`,
checked first in the controller. Eligibility of the target — pending, existing — is decided by the
guarded write (D5) and turned into an exception by the use case.

**Rationale**: It is the split every user command already uses (`list`, `deactivate`,
`resetPassword`): a Bouncer denial surfaces as one `E_AUTHORIZATION_FAILURE`, so a target rule
expressed in the policy is one the administrator can never be told the reason for. Authorizing
before validating the path also keeps a refused viewer from learning whether an identifier names a
user. A session confined to its own password renewal is already refused `403` by
`PasswordRenewalMiddleware`, before the controller runs (FR-010).

## D4 — No self-renewal rule: the self case is a non-pending target

**Decision**: The use case adds no self check. An administrator naming themselves is refused as
`E_USER_NOT_PENDING` with `accessStatus: 'ACTIVE'`.

**Rationale**: The requester is necessarily active — the policy demands it — so they can never be a
pending target. The password reset needs `E_USER_PASSWORD_RESET_SELF` because an active admin *is*
an eligible reset target; here no such case exists, and a dedicated exception would be a rule with
nothing to guard (spec, Edge Cases).

## D5 — One transaction: lock the user, check pending, record the renewal, replace the token

**Decision**: `UserRepository.renewActivationLink(command)` runs, inside one transaction:

1. `SELECT … FROM users WHERE id = ? FOR UPDATE` — absent → `NOT_FOUND`; not `PENDING` →
   `NOT_PENDING` carrying the status it found.
2. A guarded `UPDATE users SET activation_link_renewed_at, activation_link_renewed_by_user_id,
   updated_at WHERE id = ? AND access_status = 'PENDING'`; zero rows → re-read and report
   `NOT_PENDING` / `NOT_FOUND`.
3. `DELETE FROM user_activation_tokens WHERE user_id = ?`, then insert the new row with the issued
   digest and expiry.
4. Reload the user with the access history preloaded, and return it with the new token.

It returns `{ kind: 'RENEWED', user, activationToken } | { kind: 'NOT_FOUND' } | { kind: 'NOT_PENDING', accessStatus }`.

**Rationale**:

- *One transaction* is what makes FR-014 true: the recorded renewal, the removal of the previous
  link, and the new link commit together or not at all, so a failure can never leave a pending user
  with no working link, or with a renewal recorded against a link that was never issued.
- *The row lock* is the same device `requirePasswordRenewal` uses, for the same reason: the refusal
  must name the current status (FR-011), which one guarded statement cannot distinguish from "no
  such row", and the decision must still hold when the write lands. On PostgreSQL the lock
  serializes two concurrent renewals, so the second one deletes the first one's token and exactly
  one link survives — the last issued (FR-015). The guarded `UPDATE` in step 2 is the SQLite
  backstop, where knex emits no `FOR UPDATE`; SQLite serializes writers anyway.
- *Delete then insert* rather than updating the token row in place: it treats a pending user with no
  row at all — a seeded one — exactly like any other (spec, Edge Cases), and it leaves `created_at`
  meaning "when this link was issued". The `user_id` unique index still guarantees one row.

**Alternatives considered**:

- *Update the token row in place*: rejected — it needs a second branch for a user holding no row,
  and it keeps a `created_at` that no longer describes the link.
- *Keep previous tokens and mark them revoked*: rejected — GH-7's schema makes "one live link" a
  property of the database (`user_id` unique); a revocation flag would move it back into code.
- *A compare-and-swap on the token hash instead of a lock*: rejected — the administrator never
  holds the previous hash, and the lock already exists for this exact shape.

## D6 — The `users` row lock is the serialization point with acceptance and cancellation

**Decision**: This slice takes the row lock on the target `users` row before touching its link, and
records here the contract GH-8 (acceptance) and GH-12 (cancellation) must honour for FR-016: any
write that consumes or retires a pending user's link locks the same `users` row — or guards on
`access_status = 'PENDING'` — and, for acceptance, re-reads the token by its digest *under* that
lock.

**Rationale**: With that contract, a renewal and an acceptance of the previous link resolve in lock
order. Renewal first: the previous digest no longer exists, and acceptance is refused. Acceptance
first: the user is no longer pending, and the renewal is refused `E_USER_NOT_PENDING` with
`accessStatus: 'ACTIVE'`. Never both. Neither GH-8 nor GH-12 exists yet, so this slice cannot test
the race end to end. It tests its own half — a renewal against a user who is no longer pending
issues nothing — and leaves the other half to the slices that own it.

## D7 — The renewal is an event on `users`: `activation_link_renewed_at` and `activation_link_renewed_by_user_id`

**Decision**: Two nullable columns on `users`, shaped exactly like `password_reset_at` /
`password_reset_by_user_id` — a timestamp, and an actor foreign key with `ON DELETE SET NULL`. Each
renewal overwrites them. They are never cleared, not even when the user later activates.

**Rationale**: The access history is column-per-event on `users`, and GH-17 already set the
precedent for an event that changes no access status. Overwriting is what the spec asks: the most
recent renewal, and a later renewal replacing it (FR-009). Keeping the columns after activation
lets the history still answer "who handed out the link this person activated with".
`ON DELETE SET NULL` keeps the renewal presented after its administrator departs (spec, Edge Cases).

**Alternatives considered**:

- *Columns on `user_activation_tokens`* (`renewed_by_user_id` on the token row): rejected — the
  token row is deleted when the link is consumed or the user removed, which would erase the history
  with it; and every access-history event already lives on `users`.
- *A `user_activation_link_renewals` table keeping every renewal*: rejected — a renewal history
  beyond the most recent one is out of scope, and one table per event would diverge from the
  column-per-event shape the transformer and the web history already read.

## D8 — The migration branches on dialect, like `1785800000000_add_user_password_reset.ts`

**Decision**: `1786000000000_add_user_activation_link_renewal.ts` adds the two columns. On SQLite it
toggles `PRAGMA foreign_keys` around the rebuild, with `disableTransactions = true`, in both `up()`
and `down()`.

**Rationale**: The actor column carries a `REFERENCES users` clause, and on SQLite knex implements
that by rebuilding `users` — a `DROP TABLE` that every child of `users` refuses while enforcement is
on. The previous migration documents the problem and its fix. Copying its shape is cheaper than
rediscovering it.

## D9 — The link's validity crosses the wire as one expiry, and the web derives the state

**Decision**: `toAdministration` gains `activationLinkExpiresAt`, gated by `includeAccessHistory`
like every other history key. Its value is the live token's `expires_at` for a pending user, and
`null` for a pending user holding no link and for every non-pending user. The web derives
`'valid' | 'expired' | 'missing'` with a pure helper that compares it to the current time. An absent
key means "not disclosed", and no state is derived from it.

To feed it, `preloadAccessHistory` also preloads `activationToken`. The transformer reads only
`expiresAt` from it, never `hash`.

**Rationale**:

- *Validity is a comparison with the current time* (spec, Edge Cases). Sending a server-computed
  `expired` boolean would freeze it at response time, and a collection left open across the expiry
  would keep saying "valid". Deriving it at render time from the expiry gives the right answer
  whenever the view re-renders. It is correct by the next refresh at the latest (US5-6).
- *Gated with the history* (FR-022): only an organization admin consults pending users at all, so
  this changes nothing for an operations admin, but the key follows the rule rather than relying on
  that coincidence.
- *`null` for non-pending users* (spec, Edge Cases): a link matters only while its user is pending.
  Deciding that server-side keeps a former link's expiry from leaking into any view.
- *The expiry discloses no secret*: it is issuance plus 7 days, already shown to the administrator
  in the once-only outcome, and it carries no bit of the 256-bit secret.
- *Preloading the relation* adds one query per collection read — `WHERE user_id IN (…)` over
  indexed `user_id` — well inside SC-009's and GH-4's budgets at ~200 users.

**Alternatives considered**:

- *A server-computed `activationLinkState` enum*: rejected — the staleness above, and it would need
  the server clock and the render clock to agree about an instant the client can compute itself.
- *A separate read seam for link validity*: rejected — the record and the table already read the
  collection, and a second request per pending row is the N+1 GH-4 was built to avoid.

## D10 — The response reuses the invitation's shape: `{ user, activationLink }`

**Decision**: `200` with `serialize({ user: UserTransformer…useVariant('toAdministration'),
activationLink: { url, expiresAt } })` — the exact envelope `users.store` returns, minus the `201`.

**Rationale**: The web then renders the renewal outcome with the invitation's `ActivationLinkDto`
and `ActivationLinkDialog`, which is FR-006's "one way of handing out a link" by construction. The
organization admin is the only caller, which is the audience the history projection exists for, so
`includeAccessHistory: true` is unconditional, as in `resetPassword`. `200` rather than `201`,
because no user is created. The link is a secret, not an addressable resource.

## D11 — Refusals: `404`, `409 E_USER_NOT_PENDING` with `meta.accessStatus`, `403`

**Decision**:

| Case | Status | Code | Extra |
|---|---|---|---|
| Viewer not an active organization admin | `403` | `E_AUTHORIZATION_FAILURE` | from Bouncer |
| Requester confined to their own renewal | `403` | existing middleware code | unchanged |
| Unauthenticated | `401` | existing | unchanged |
| Path id not a UUID | `422` | `E_VALIDATION_ERROR` | after authorization |
| No such user | `404` | `E_USER_NOT_FOUND` | shared `UserNotFoundException` |
| Target active, deactivated, or cancelled | `409` | `E_USER_NOT_PENDING` | `meta: { accessStatus }` |
| Anything else | `500` | — | retryable in the workbench |

**Rationale**: `409` is the lifecycle-conflict reading every user command uses: the request is well
formed, but the target's state refuses it. `meta.accessStatus` is what lets the workbench name the
action that applies instead (FR-011), which is the shape `EmailAlreadyInUseException` already uses
for the same purpose. Telling `404` from `409` discloses nothing, because only an organization admin
gets past the policy, and GH-4 already lets them consult every user in every status. Out-of-
organization targets do not exist under ADR 0003, so `404` is the only "not here" answer (FR-012).

**Alternatives considered**: one exception per status (`E_USER_ALREADY_ACTIVE`, …) — rejected: three
codes for one decision, and the web would have to map them back to the status anyway.

## D12 — The workbench: one dialog that confirms, then presents the link

**Decision**:

- `canRenewActivationLink(viewer, user)` in `helpers/user-permissions.ts`: organization admin and a
  `PENDING` target. It is asked by both the record footer and the row menu (FR-018).
- `ui/renew-activation-link-dialog.tsx`: mounted only while open, like `ResetPasswordDialog`. It
  starts as the confirmation, which names the user and states that any link already handed out
  will stop working (FR-019). On success it swaps to `ActivationLinkDialog` holding the issued link.
  Acknowledging closes it where it was opened (FR-021). A refusal keeps the confirmation open and
  explains itself in a toast. The confirm button is disabled while the mutation is pending (FR-020).
- `ActivationLinkDialog` gains an `origin: 'invitation' | 'renewal'` prop. It changes only the
  description: the renewal says the previous link no longer works (FR-006). The once-only warning,
  the copy action, and the explicit acknowledgement stay shared.
- The mutation `renewActivationLink` refreshes the collection on success *and* on failure, as
  `deactivate` does: a refusal usually means the user moved on.

**Revised during implementation (fresh review)**: the issued link no longer lives in the dialog.
A browser Back closes the record the dialog lives in, and with it the link — while the previous
link is already dead, which FR-006 forbids for any navigation inside user administration. The
dialog now hands the link to `IssuedActivationLinkProvider` (`ui/issued-activation-link.tsx`),
mounted by `UsersPage`, which presents it through `ActivationLinkDialog` and forgets it on
acknowledgement — the page level the invitation already keeps its outcome at. Three companions:
the confirmation cannot be cancelled or escaped once submitted (the server may already have retired
the previous link); the collection refresh is not awaited before presenting the link; and the
mutation runs with `gcTime: 0` so the secret does not linger in the mutation cache.
- The confirmation and the issued link stay in component state, not in the URL.

**Rationale**:

- *One component for both steps*: the modal blocks the page behind it, and the user stays pending
  after a successful renewal. So the row and the record that host the dialog stay mounted through
  the refresh, and the link survives until it is acknowledged. A refusal that removes the user from
  the pending view unmounts the record with its dialog. That is the behaviour `UserAccessDialog`
  already documents, and the toast carries the reason.
- *Not in the URL*: `apps/web/AGENTS.md` wants half-finished work in the URL, but GH-7 D10/D11
  already set the exception for this exact secret. The address bar is neither private nor
  ephemeral, and a link with no second read cannot survive a reload anyway. The reset and
  deactivation confirmations are already component state. A `renewUserId` search parameter was
  weighed and rejected: after a reload it could only render "no longer available", and the
  administrator would renew again, which is exactly what the dialog already offers.
- *Where the pointers lead* (US4-7): the invitation-conflict copy ("Renew their activation link
  instead…") and the reload state of `ActivationLinkDialog` already point here. Acknowledging the
  latter lands on the pending view, where the row menu now offers the renewal. No copy changes are
  needed.

## D13 — Presenting validity: a record field, and an "Activation link" column in the pending view

**Decision**:

- `helpers/activation-link.ts`: `activationLinkState(user, now)` returns `'valid' | 'expired' |
  'missing'` for a pending user whose key is disclosed, and `undefined` otherwise. It is a pure
  unit-tested adapter.
- The record: an **Activation link** field beside the access status, for pending users only.
  *Valid until <date>* in a neutral tone, *Expired <date>* in warning, *Not issued* in warning.
- The history: an **Activation link renewed** entry, dated and attributed, in the same list as the
  lifecycle events.
- The table: an `activationLink` column, visible in the pending view only. It shows *Expired* or
  *Not issued* and stays blank for a valid link, the way the Password column marks only the users
  who owe a renewal. The Password column is hidden in the pending view, because a pending user can
  never owe a password renewal. Column visibility is keyed on `view`.

**Rationale**: FR-022 asks for the record to state the validity and for the pending view to let the
admin spot links that no longer work "without opening a user". A blank cell for the common case
follows the Password column's "a column of negatives would bury the few that matter". Swapping
columns per view keeps the pending table as wide as the others, and removes a column that is always
empty there.

## D14 — Verification seams

| Requirement group | Seam |
|---|---|
| FR-001–FR-005, FR-008, FR-009, FR-011, FR-014, FR-015 — decision, replacement, event, refusals | `apps/api/tests/unit/users/activation_link_renewal/renew_activation_link_use_case.spec.ts` against SQLite (ADR 0014) |
| FR-004 — expiry 7 days from renewal | unit, through the injected issuer and a frozen clock |
| FR-003, FR-015 — previous digest gone, exactly one token row | unit, reading `user_activation_tokens` |
| FR-010, FR-012, FR-013 — authorization matrix, `404`, validation after authorization | `apps/api/tests/integration/users/activation_link_renewal/renew.spec.ts` |
| FR-006, FR-007 — link in the `200` only, never in `GET /users` | integration |
| FR-022 (API half) — `activationLinkExpiresAt` present, `null`, or withheld | `apps/api/tests/integration/users/consultation/list.spec.ts` (extended) |
| FR-016 — renewal against a user no longer pending issues nothing | unit (the other half belongs to GH-8 / GH-12, D6) |
| FR-006, FR-017–FR-021 — confirmation, outcome, refusals, duplicate guard, landing | `apps/web/src/features/users/__tests__/activation-link-renewal/*.test.tsx` with MSW |
| FR-022 (web half) — record field, pending column, state derivation | the same feature tests, plus a unit test of `activationLinkState` |
| SC-007, SC-009 | the manual pass in [quickstart.md](./quickstart.md) |

**Rationale**: It is the split `apps/api/AGENTS.md` and `apps/web/AGENTS.md` prescribe, and the one
GH-7 and GH-17 followed: unit tests for domain decisions, integration tests for HTTP wiring and
authorization, and feature tests through the real router with MSW. The Tuyau client is never
mocked.

## Deferred, deliberately

- **Correcting a pending user's email** (`E_USER_PENDING_EMAIL_LOCKED`): the identity slice refuses
  it because "this slice issues no replacement". A renewal now exists, so the lock could later be
  lifted by issuing a new link along with the correction. That is a change to the identity slice's
  contract, and FR-024 keeps identity update out of this one.
- **The acceptance half of the race** (D6): owned by GH-8.
