# Phase 0 Research: Invite a Pending User with a Confidential Activation Link

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-10

No `NEEDS CLARIFICATION` marker remained in the specification: the five open points were settled by
the 2026-09-10 clarification session and written into the spec. The research below records the
design decisions the plan rests on, each taken against the existing code and the repository's
conventions.

## D1 — The activation secret lives in its own table, not on `users`

**Decision**: Add `user_activation_tokens` — `id` (uuid), `user_id` (uuid, references `users`,
`ON DELETE CASCADE`, unique), `hash` (string, unique), `expires_at`, `created_at`. One live row per
pending user; issuing a new link replaces the row.

**Rationale**: It mirrors `remember_me_tokens`, the table this repository already uses for a
credential-bearing secret, so the shape is familiar and the review surface is small. It keeps the
secret off the `users` row that every read path loads and transforms, which is the cheap form of
defence in depth against a future `pick` leaking it. And it gives GH-9 (renewal), GH-12
(cancellation), and GH-13 (restoration) one row to replace or delete instead of three columns to
blank in the middle of the user record.

The `user_id` unique index is the invariant FR-004 needs — *exactly one* activation link per pending
user — enforced by the database rather than by a convention each future slice would have to repeat.

**Alternatives considered**:

- *Two nullable columns on `users` (`activation_token_hash`, `activation_token_expires_at`)*:
  rejected — cheaper to add, but it puts a secret on the most-loaded row in the schema, and the
  rollback is the SQLite table-rebuild dance `1785500000000_add_user_password_renewal.ts` documents
  at length, where dropping a standalone table is unconditional on both dialects.
- *An append-only table keeping every issued link*: rejected — nothing in this slice or its
  successors reads a superseded link, and keeping expired secrets' digests around is a liability
  with no reader. The dated lifecycle events on `users` already answer "when was this user invited".
- *`@adonisjs/auth`'s `DbAccessTokensProvider`*: rejected — it models API authentication tokens with
  abilities and guard integration; an activation link is neither a session nor an API credential,
  and adopting it would wire an authentication mechanism into a user-administration write.

## D2 — SHA-256 of a 256-bit random secret, issued behind an injected service

**Decision**: The secret is 32 bytes from `randomBytes`, base64url-encoded, and the stored `hash` is
its SHA-256 digest, hex-encoded. Both, plus the expiry, are produced by
`app/users/shared/activation_link_issuer.ts`, an injected class the use case depends on.

**Rationale**: scrypt at `cost: 16384` exists for low-entropy human passwords; a 256-bit random
secret needs a one-way function, not a slow one. It also has to be *found* by GH-8 on acceptance,
and a salted password hash cannot be looked up — a digest can, through the unique index on `hash`,
in one query. Keeping generation behind an injected service is what makes the expiry and the format
assertable in a unit test without freezing the clock globally, and it is the seam GH-9 will reuse
verbatim to reissue a link.

**Alternatives considered**:

- *Store the secret in clear*: rejected — FR-006 and FR-007 make the link a credential; a readable
  column is a second way to obtain it, which is exactly what "presented exactly once" forbids.
- *Hash with scrypt like a password*: rejected — unlookupable, and it would put a deliberately slow
  hash inside the invitation write, against SC-007 and the rule `renew_password_use_case.ts` already
  states in its own comment.
- *Sign a JWT instead of storing anything*: rejected — a stateless token cannot be revoked, and
  cancellation (GH-12) and renewal (GH-9) both depend on invalidating the previous link.

## D3 — The API composes the absolute link from `WEB_ORIGIN`, which becomes required

**Decision**: The activation link is `<WEB_ORIGIN>/activate/<secret>`, composed by the issuer.
`WEB_ORIGIN` moves from `Env.schema.string.optional()` to a required URL in `start/env.ts`, and is
added to `apps/api/.env.test` and to the `ci-checks.yml` job environment (it is already present in
`.env.example` and `.env.docker.example`).

**Rationale**: One owner for the link, one definition of the acceptance path. The standalone "Send
invitation emails" slice will need the same absolute URL with no browser to borrow an origin from,
so composing it in the API is what keeps the two producers from drifting. Making the variable
required turns a misconfiguration into a boot failure instead of an invitation that hands out a
broken link — the failure mode is loud, early, and identical in every environment.

**Consequence**: `/activate/<secret>` is fixed here, as a contract, even though the screen behind it
belongs to GH-8. The path parameter carries the secret rather than a query string, keeping it out of
the referrer header a query string would leak on any outbound link from the acceptance page.

**Alternatives considered**:

- *Return the path only and let the web prefix its own origin*: rejected — the email slice would
  then need a second, independent definition of the same URL, and the workbench would have to know
  the acceptance route GH-8 owns.
- *Keep `WEB_ORIGIN` optional with a `http://localhost:3000` fallback*: rejected — a silent default
  produces links that look right and point nowhere in production.

## D4 — One endpoint, `POST /api/v1/users`, named `users.store`

**Decision**: Add `router.post('/', [controllers.Users, 'store']).as('store')` to the existing
`/users` group, returning `201`.

**Rationale**: The invitation is the creation of a user; every other resource in `start/routes.ts`
spells that `POST /<collection>` with a `store` action, and the Tuyau registry exposes it to the web
as `tuyauQuery.users.store`. A verb-shaped route such as `/users/invite` would be the only one of its
kind in the file.

**Alternatives considered**: `POST /api/v1/users/invitations` — rejected: it invents a sub-resource
whose only member is the link, which the response already carries, and it would leave GH-9's renewal
without a natural place that this shape does not already offer (`/users/:id/activation-link`).

## D5 — `UserPolicy.invite` authorizes; the use case owns everything else

**Decision**: `UserPolicy.invite(user)` returns `accessStatus === 'ACTIVE' && role ===
'ORGANIZATION_ADMIN'`. `InviteUserUseCase` owns normalization, the conflict decision, the creation,
and the issuance.

**Rationale**: `apps/api/AGENTS.md` gives policies authorization and use cases business decisions,
and `UserPolicy.list` already splits exactly this way — *may this viewer act* in the policy, *what
happens* in the use case. Unlike consultation, invitation has a single permitted role, so the policy
answers it completely; nothing about the outcome depends on who the admin is beyond the attribution.

## D6 — The conflict is decided by a read, confirmed by the unique index, and carries the status

**Decision**: The use case calls `findByEmail` first and throws
`EmailAlreadyInUseException` (`409`, `E_USER_EMAIL_CONFLICT`) with
`meta: { accessStatus }` when a user exists. The repository write is still guarded: a unique-index
violation is caught, the row re-read, and the same exception thrown.

**Rationale**: FR-014 requires naming the existing access status, which only a read can supply, and
FR-019 requires that two concurrent invitations of the same email produce one pending user, which
only the `users_email_unique` index can guarantee. The read is for the message; the index is for the
invariant. `HttpExceptionHandler` already serializes an exception's `meta`, so the status reaches
the client inside the existing error envelope without a bespoke response shape.

**Alternatives considered**:

- *Rely on the index alone and return a generic conflict*: rejected — it satisfies FR-012 but not
  FR-014, and the administrator would be told "already in use" without being told which action
  applies.
- *A generic "email already in use" message with no status*: rejected in clarification — an
  organization admin already consults every access status through GH-4, so withholding it protects
  nothing and costs the administrator the next step.

## D7 — Normalization lives in a domain helper, not in the validator

**Decision**: `app/users/shared/normalize_user.ts` trims the first name, the last name, and the
email. The validator checks shape (presence, non-blank, email format, role membership, lengths); the
use case normalizes before deciding anything, and the lookup compares on `LOWER(email)`, which
`findByEmail` already does.

**Rationale**: `apps/api/AGENTS.md` states it outright — normalize in use cases or domain helpers,
not validators — and `normalize_customer.ts` is the existing shape. It also keeps the conflict
decision honest: the padded, differently-cased email of FR-013 must be recognized before the
duplicate check, not after it.

**Note**: the stored email keeps the casing the administrator typed, as the seeded users do; only
comparison is case-insensitive, through the existing `users_email_unique` functional index on
`LOWER(email)`.

## D8 — The repository writes both rows in one transaction and returns a typed outcome

**Decision**: `UserRepository.invite(command)` returns
`{ kind: 'CREATED', user, activationToken } | { kind: 'DUPLICATE_EMAIL' }` and writes the user and
its activation token inside a single `User.transaction`.

**Rationale**: FR-018 forbids a user without a link and a link without a user; two statements that
must not be separable are exactly what a transaction is for, and `lucid_user_repository.ts` already
argues this for the password renewal. The typed outcome keeps the repository free of HTTP-aware
exceptions, as `create_customer_use_case.ts` does with `DUPLICATE_CODE`.

**Consequence**: the existing `create()` stays for the seeder path; `invite()` is the write this
slice adds rather than a widening of `create()`, so no existing caller changes behavior.

## D9 — The response reuses `toAdministration`, with the link beside it

**Decision**: The controller returns
`serialize({ user: UserTransformer.transform(user, { includeAccessHistory: true }).useVariant('toAdministration'), activationLink: { url, expiresAt } })`.

**Rationale**: The inviting viewer is always an organization admin, the one viewer allowed the
lifecycle block, so the created user is projected exactly as `GET /api/v1/users` projects it — the
web reuses `UserDto` and the row it will render, with no second shape to keep in step. Composing two
keys in one `serialize` is the shape `customers_controller.ts` already uses for `archiveMany`.

**Alternatives considered**: a bespoke `InvitedUserDto` — rejected: it would duplicate the ten
lifecycle keys and drift from the collection projection the workbench renders next to it.

## D10 — Both invitation steps live in the URL, on the existing `/users` route

**Decision**: `/users` gains `mode` (`create`, cleared otherwise) and `invitedUserId`. The form step
is `mode=create`; the outcome step is `mode=create&invitedUserId=<id>`; acknowledging clears `mode`
and keeps `invitedUserId`, which selects the pending view and highlights the row. The route's
`transform` clears `userId` under `mode=create`, so a creation and an open record can never be armed
at once.

**Rationale**: `apps/web/AGENTS.md` requires that anything a user is halfway through survive a
reload and be shareable, names the parameter `mode` on a single-resource route, and requires the
`create` mode to clear its own `<resource>Id` in the transform. Keeping the outcome step under the
same `mode` avoids inventing a fourth mode value the convention does not define, and `invitedUserId`
is what the clarified FR-020 landing needs anyway: the pending view with the new user highlighted,
its access record left unopened.

**Alternatives considered**:

- *Hold the step and the link in `useState`*: rejected — it is the one thing the routing convention
  forbids outright, and the commit that wrote the convention down removed the last such case.
- *Reuse `userId` to mark the new row*: rejected — `userId` means "this record is open", and Q5
  settled that the record is not opened.

## D11 — A reload during the outcome step admits the link is gone

**Decision**: The secret lives only in the mutation result held by the page. On a reload with
`mode=create&invitedUserId=<id>` in the URL, the outcome dialog renders an explicit "this activation
link is no longer available" state naming the pending user and pointing to the activation link
renewal.

**Surface** (revised during implementation): the form stays a `Sheet` like every other creation, and
the outcome is an `AlertDialog` — the primitive this application already uses for a decision that
must be acknowledged (lifecycle confirmations, sign-out). A sheet is the surface one consults and
leaves, so suppressing its `Escape` and outside-click made it lie about what it was; the change of
surface between the form and the outcome also carries the fact that the moment changed.

**Rationale**: This is FR-006 observed rather than merely asserted: there is no seam that could
return the secret a second time, so the reload state is the proof. The spec's edge case — an outcome
its author never saw — resolves the same way, and the user it names is still consultable in the
pending view, which is why `invitedUserId` alone is enough to render the state.

## D12 — Verification seams

**Decision**:

| Requirement group | Seam |
|---|---|
| FR-001 to FR-004, FR-016, FR-017 — normalization, creation, attribution, issuance | `tests/unit/users/invitation/invite.spec.ts` |
| FR-008 — 7-day expiry, computed at issuance | unit, through the injected issuer |
| FR-010, FR-011 — authorization matrix | `tests/integration/users/invitation/invite.spec.ts` |
| FR-012 to FR-015, FR-018, FR-019 — refusals, conflict `meta`, no partial write | integration, plus a unit test per decision |
| FR-005, FR-006, FR-009 — the link appears once and nowhere else | integration: `201` carries it, `GET /api/v1/users` does not, no second read exists |
| FR-005a, FR-020, FR-021 — panel steps, landing, refusal states | `apps/web/src/features/users/__tests__/invitation/*.test.tsx` with MSW |
| SC-005, SC-007 | the manual pass in [quickstart.md](./quickstart.md) |

**Rationale**: It follows the split `apps/api/AGENTS.md` prescribes — unit for domain decisions,
integration for authentication, authorization, validation, response shape, and wiring — and the web
testing rules of `apps/web/AGENTS.md`: feature tests through the real router with MSW, never a
mocked Tuyau client. The repository tests run against SQLite per ADR-0014, which the unique indexes
this design leans on honour on both dialects.
