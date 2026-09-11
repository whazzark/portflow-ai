---

description: "Task list for Renew a Pending User Activation Link (GH-9)"
---

# Tasks: Renew a Pending User Activation Link

**Input**: Design documents from `specs/user-administration/invitation-onboarding/renew-a-pending-user-activation-link/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [contracts/renewal-workbench.md](./contracts/renewal-workbench.md), [quickstart.md](./quickstart.md)

**Tests**: Test tasks are included and are **not optional here**. Constitution IV requires business
behavior to follow RED → GREEN → REFACTOR, and `AGENTS.md` repeats it as a delivery gate. Every
behavioral task below is preceded by a test that must fail first.

**Organization**: Tasks are grouped by user story. As in GH-17, this is one vertical slice — one
endpoint, one workbench action, one projection — so the stories are increments of the same seam
rather than separate deliverables. Each story is independently **testable**, and US1 is
independently **demonstrable** at the API. US2 and US3 harden the same endpoint and must not ship
without it. US4 and US5 are the workbench.

Two placement choices differ from the spec's story order:

- The workbench refusal messages serve US3's scenarios (US3-1, US3-3). They sit in the US4 phase
  because the dialog they live in is built there.
- `activationLinkExpiresAt` appears in the renewal response's contract but is built, with its test,
  in US5, the story it serves. The US1 contract test does not assert it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task serves (US1–US5)
- Every task names the exact file it touches

## Path Conventions

Monorepo per [plan.md](./plan.md): `apps/api/` (AdonisJS, Japa) and `apps/web/` (TanStack Start,
Vitest). All paths are repository-relative. API test ordering follows `apps/api/tests/README.md`:
narrative order for unit tests, request-flow order for integration tests.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean baseline before a TDD slice, so a red test is red for the right reason

- [X] T001 Install workspace dependencies from the repository root with `pnpm install`
- [X] T002 Apply the existing migrations with `pnpm --filter @portflow/api db:migrate` and confirm `apps/api/database/schema.ts` and `apps/api/.adonisjs/` show no diff
- [X] T003 Confirm the baseline is green with `pnpm check`, `pnpm typecheck`, and `pnpm test`

**Checkpoint**: Baseline green — any failure from here belongs to this feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistence, model, contracts, and authorization every story needs. No behavior is
delivered here, so no test precedes these tasks.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create `apps/api/database/migrations/1786000000000_add_user_activation_link_renewal.ts`, adding `activation_link_renewed_at` (nullable timestamp) and `activation_link_renewed_by_user_id` (nullable uuid FK to `users.id`, `ON DELETE SET NULL`) to `users`. Copy the structure of `apps/api/database/migrations/1785800000000_add_user_password_reset.ts` exactly — `static disableTransactions = true`, a Postgres branch, and a SQLite branch toggling `PRAGMA foreign_keys` around the rebuild in both `up()` and `down()` — and adapt its doc comment to this event per [research.md](./research.md) D7–D8
- [X] T005 Run `pnpm --filter @portflow/api db:migrate` to apply T004, which regenerates `apps/api/database/schema.ts` (generated — never hand-edited; without a local Postgres, run it with `NODE_ENV=test` against in-memory SQLite and revert the SQLite-only `decimal` → `number` drift it introduces on unrelated tables); confirm `UserSchema` gains `activationLinkRenewedAt` and `activationLinkRenewedByUserId`
- [X] T006 [P] Add `@belongsTo(() => User, { foreignKey: 'activationLinkRenewedByUserId' }) declare activationLinkRenewedBy: BelongsTo<typeof User>` to `apps/api/app/models/user.ts`, after `passwordResetBy`, with a one-line comment that — like the password reset — it is an event that changes no access status; update the `activationToken` relation's comment, which says "This slice only writes it", to name the renewal as its first reader
- [X] T007 [P] Create `apps/api/app/users/activation_link_renewal/activation_link_renewal_exceptions.ts` with `UserNotPendingException` (`static status = 409`, `static code = 'E_USER_NOT_PENDING'`, `static message = "Only a pending user's activation link can be renewed"`), whose constructor takes a `UserAccessStatus` and exposes `readonly meta: { accessStatus: UserAccessStatus }` — the shape of `EmailAlreadyInUseException` in `apps/api/app/users/invite/invitation_exceptions.ts`. Do not add a not-found exception: reuse `UserNotFoundException` from `apps/api/app/users/shared/user_exceptions.ts`
- [X] T008 [P] Create `apps/api/app/users/activation_link_renewal/renew_activation_link_validator.ts` exporting `renewActivationLinkValidator = vine.create({ params: vine.object({ id: vine.string().uuid() }) })`, with the same comment `reset_user_password_validator.ts` carries about `22P02`
- [X] T009 Declare, on the abstract `apps/api/app/users/shared/repositories/user_repository.ts`, `RenewActivationLinkCommand` (`targetUserId`, `renewedByUserId`, `renewedAt: DateTime`, `activationTokenHash`, `activationTokenExpiresAt: DateTime`), `RenewActivationLinkResult` (`{ kind: 'RENEWED'; user: User; activationToken: UserActivationToken } | { kind: 'NOT_FOUND' } | { kind: 'NOT_PENDING'; accessStatus: UserAccessStatus }`), and `abstract renewActivationLink(command): Promise<RenewActivationLinkResult>` with a doc comment summarizing [research.md](./research.md) D5. Add a throwing stub to `apps/api/app/users/shared/repositories/lucid_user_repository.ts` so the build stays green
- [X] T010 Add `renewActivationLink(user: User): AuthorizerResponse` to `apps/api/app/users/shared/user_policy.ts`, returning `user.accessStatus === 'ACTIVE' && user.role === 'ORGANIZATION_ADMIN'`, with a comment explaining that which target may be renewed is decided by the guarded write, per the `resetPassword` comment. It is foundational so no write endpoint is ever exposed unauthorized, even mid-branch

**Checkpoint**: Schema, model, exceptions, validator, repository contract, and policy in place — story work can begin

---

## Phase 3: User Story 1 - Replace a Lost or Expired Activation Link (Priority: P1) 🎯 MVP

**Goal**: An organization admin renews a pending user's link. A new link valid for 7 days replaces
the previous one in one transaction, the renewal is recorded with its date and administrator, and
the link is returned once.

**Independent Test**: As an organization admin, renew the link of a pending user holding a valid
link, an expired one, and none. Assert exactly one token row remains, with a new digest and an
expiry 7 days after the renewal; the previous digest no longer exists; the renewal is attributed;
identity, role, status, and invitation event are untouched; and the link appears in the `200` and
in no `GET /api/v1/users` response.

### Tests for User Story 1 ⚠️

> Write these first and watch them fail

- [X] T011 [P] [US1] Create `apps/api/tests/unit/users/activation_link_renewal/renew_activation_link_use_case.spec.ts` (resolving the use case through `app.container.make`, wrapping each test in `testUtils.db().wrapInGlobalTransaction()`, as in `apps/api/tests/unit/users/password_reset/reset_user_password_use_case.spec.ts`). Build pending users with `UserFactory.apply('invited')` and their links with `UserActivationTokenFactory.merge({ userId })` from `apps/api/database/factories/user_activation_token_factory.ts`. Assert:
  (a) renewing a user holding a valid link leaves exactly one `UserActivationToken` row for them, whose `hash` differs from the previous one; no row carries the previous hash; `sha256(<secret from the returned url>)` equals the stored hash; and `url` starts with `${WEB_ORIGIN}/activate/` (FR-002, FR-003).
  (b) the stored `expiresAt` and the returned `activationLink.expiresAt` are 7 days after the renewal, within a second (FR-004).
  (c) the same succeeds for a user whose token is `expired`, and for a pending user holding no token at all (FR-005).
  (d) `activationLinkRenewedAt` and `activationLinkRenewedByUserId` are recorded, while `accessStatus`, `firstName`, `lastName`, `email`, `role`, `invitedAt`, `invitedByUserId`, `password` (still null), and every other lifecycle column are unchanged (FR-008, FR-009).
  (e) a second renewal by another administrator overwrites the renewal date and actor and still leaves one token row, holding the second link's digest (FR-009, FR-015).
- [X] T012 [P] [US1] Create `apps/api/tests/integration/users/activation_link_renewal/renew.spec.ts` with a `renewalPathFor(id)` helper and an `organizationAdmin()` helper, modelled on `apps/api/tests/integration/users/administration/password_reset.spec.ts`. Assert the `200` contract of [contracts/http-api.md](./contracts/http-api.md#success--200-ok): `data.user` is the `toAdministration` projection with `accessStatus: 'PENDING'`, `activationLinkRenewedAt`, and `activationLinkRenewedBy` naming the caller; `data.activationLink` has `url` and `expiresAt`; the body carries no `hash` key. Then call `GET /api/v1/users` as the same admin and assert its serialized body contains neither the `url` nor the secret segment of it (FR-006, FR-007)

### Implementation for User Story 1

- [X] T013 [US1] Implement the `RENEWED` path of `renewActivationLink` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`, replacing the T009 stub. Inside `User.transaction`, it runs a guarded `UPDATE users … WHERE id = ? AND access_status = 'PENDING'` writing `activationLinkRenewedAt`, `activationLinkRenewedByUserId`, and `updatedAt` by hand (the query builder bypasses autoUpdate; use `toSQL({ includeOffset: false })` like `requirePasswordRenewal`). Then it deletes `UserActivationToken` rows `where('userId', …)` and creates the new row `{ userId, hash, expiresAt }` with `{ client: trx }`. Finally it reloads the user through `preloadAccessHistory` and returns `{ kind: 'RENEWED', user, activationToken }`. Document why the old row is deleted rather than updated ([research.md](./research.md) D5)
- [X] T014 [US1] Add `.preload('activationLinkRenewedBy')` to `preloadAccessHistory` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`, and update its comment ("all six actor relations" becomes seven)
- [X] T015 [US1] Create `apps/api/app/users/activation_link_renewal/renew_activation_link_use_case.ts`: `@inject()` with `UserRepository` and `ActivationLinkIssuer`, and `handle({ targetUserId, actorUserId, renewedAt })`. It calls `activationLinkIssuer.issue()` before the repository, so no crypto runs inside the transaction, passes `hash` and `expiresAt` to `renewActivationLink`, and returns `{ user, activationLink: { url, expiresAt } }` on `RENEWED`. Export the result type beside it, aligned with `UserInvitation` in `apps/api/app/users/invite/invite_user_use_case.ts`
- [X] T016 [US1] Add the `renewActivationLink` action to `apps/api/app/controllers/users_controller.ts`, injecting `RenewActivationLinkUseCase`. It authorizes with `bouncer.with(UserPolicy).authorize('renewActivationLink')` first, then validates with `renewActivationLinkValidator` (`{ data: { params } }`), passes `actorUserId: auth.use('web').getUserOrFail().id` and `renewedAt: DateTime.now()`, and returns `serialize({ user: UserTransformer.transform(user, { includeAccessHistory: true }).useVariant('toAdministration'), activationLink })` with the default `200`. Its doc comment says the secret travels in this response and nowhere else, as `store` does
- [X] T017 [US1] Declare `router.post('/:id/activation-link-renewal', [controllers.Users, 'renewActivationLink']).as('activation_link_renewal')` inside the existing `/users` group in `apps/api/start/routes.ts`, after `password_reset`, so it inherits `auth` and the password renewal middleware
- [X] T018 [US1] Extend `toAdministration()` in `apps/api/app/users/shared/transformers/user_transformer.ts` with `activationLinkRenewedAt` and `activationLinkRenewedBy` (through `toActor`), both gated on `includeAccessHistory` beside `passwordResetAt` / `passwordResetBy`
- [X] T019 [US1] Regenerate the Tuyau registry. Tuyau's `generateRegistry` hook in `apps/api/adonisrc.ts` fires on the dev server's `routesScanned` event only — not on `test`, `build`, or `migration:run` — so start `NODE_ENV=test PORT=3399 node --import tsx ace.js serve` in `apps/api` (in-memory SQLite, no Postgres needed) until it logs `tuyau: created api client registry`, then stop it. Confirm `apps/api/.adonisjs/client/registry/*` and `apps/api/.adonisjs/server/routes.d.ts` now carry `users.activation_link_renewal` and the new projection keys, then run `pnpm --filter @portflow/api test` until T011 and T012 are green

**Checkpoint**: The endpoint replaces the link and returns it once. US1 is demonstrable with `curl` per [quickstart.md](./quickstart.md#validate-the-api-directly).

---

## Phase 4: User Story 2 - Keep Renewal Restricted to Organization Admins and to Pending Users (Priority: P1)

**Goal**: Only an active organization admin may renew, and only a pending user may be renewed.
Every other combination is refused with its own status, and nothing is written.

**Independent Test**: Issue the renewal as each role, unauthenticated, from a non-active admin, and
from a session confined to its own renewal; and against an active, deactivated, cancelled, unknown,
and self target. Assert each status, code, and `meta`, and that the target's token row (same hash)
and `activation_link_renewed_*` are unchanged after every refusal.

### Tests for User Story 2 ⚠️

- [X] T020 [P] [US2] Extend `apps/api/tests/unit/users/activation_link_renewal/renew_activation_link_use_case.spec.ts` with the refusals: an unknown uuid raises `UserNotFoundException`; an `active`, a `deactivated`, and a `cancelled` target each raise `UserNotPendingException` whose `meta.accessStatus` names that status; the administrator's own id raises `UserNotPendingException` with `accessStatus: 'ACTIVE'` ([research.md](./research.md) D4). In every case no `UserActivationToken` row is created or deleted — a token given to the target beforehand still holds its original hash — and `activationLinkRenewedAt` stays null (FR-011, FR-012, FR-014)
- [X] T021 [US2] Extend `apps/api/tests/integration/users/activation_link_renewal/renew.spec.ts` with the refusal matrix in request-flow order ([contracts/http-api.md](./contracts/http-api.md#refusals)):
  - `401 E_UNAUTHORIZED_ACCESS` when unauthenticated.
  - `403 E_AUTHORIZATION_FAILURE` for an operations admin, an operations lead, and an observer. For the operations admin, also use a non-UUID id and assert `403`, not `422` — authorization runs before validation.
  - `403 E_PASSWORD_RENEWAL_REQUIRED` for an organization admin built with `UserFactory.apply('passwordRenewalRequired').merge({ role: 'ORGANIZATION_ADMIN' })`.
  - `422 E_VALIDATION_ERROR` for a non-UUID id.
  - `404 E_USER_NOT_FOUND`.
  - `409 E_USER_NOT_PENDING` with `error.meta.accessStatus` for an active, a deactivated, and a cancelled target.
  - After every refusal, the pending target's token hash is unchanged (FR-010, FR-013, FR-017).

### Implementation for User Story 2

- [X] T022 [US2] Classify the target in `renewActivationLink` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts` (depends on T013, same method). Before the guarded update, read `User.query({ client: trx }).where('id', …).forUpdate().first()` and return `NOT_FOUND` when absent and `{ kind: 'NOT_PENDING', accessStatus }` when not `PENDING`. On a zero-row update, re-read and classify the same way, with the SQLite comment `requirePasswordRenewal` already carries (knex emits no `FOR UPDATE` there)
- [X] T023 [US2] Raise the refusals in `apps/api/app/users/activation_link_renewal/renew_activation_link_use_case.ts` (depends on T015): `UserNotFoundException` on `NOT_FOUND`, and `new UserNotPendingException(result.accessStatus)` on `NOT_PENDING`. Add no self check, and record why in a comment ([research.md](./research.md) D4)

**Checkpoint**: The endpoint is safe to expose. Every refusal is distinct, names what applies instead, and writes nothing.

---

## Phase 5: User Story 3 - Recover From a Refused or Failed Renewal Without Losing the Working Link (Priority: P2)

**Goal**: A failed renewal leaves the previous link exactly as usable as it was. Repeated renewals
leave one live link — the last one issued. A renewal against a user who is no longer pending issues
nothing.

**Independent Test**: Force a failure after the renewal columns are written, renew twice in a row,
and renew a user who has become active since the view loaded. Assert the previous link survives the
failure untouched, exactly one token row exists after the double renewal (the second link's), and
the stale renewal is refused with nothing issued.

### Tests for User Story 3 ⚠️

- [X] T024 [P] [US3] Extend `apps/api/tests/unit/users/activation_link_renewal/renew_activation_link_use_case.spec.ts` with the rollback case (FR-014, US3-1, US3-2). Give another pending user a token with a known hash. Swap `ActivationLinkIssuer` in the container (`app.container.swap`, restored in cleanup) for one returning that same hash, so the token insert violates `user_activation_tokens.hash` unique after the update and the delete have run. Assert the call rejects, the target's previous token row is still present with its original hash and expiry, and `activationLinkRenewedAt` is still null. Then restore the issuer, retry, and assert exactly one new token results
- [X] T025 [P] [US3] Extend the same unit spec with the stale-target case (FR-016, US3-3, [research.md](./research.md) D6). Make a pending user holding a token active, by updating `accessStatus` and deleting their token as acceptance would. Assert the renewal raises `UserNotPendingException` with `accessStatus: 'ACTIVE'` and creates no token row
- [X] T026 [US3] Extend `apps/api/tests/integration/users/activation_link_renewal/renew.spec.ts` with back-to-back renewals of the same user, by the same admin and by two admins, modelled on the concurrency case in `apps/api/tests/integration/users/administration/password_reset.spec.ts` (FR-015, SC-005). Assert exactly one token row remains, its hash is `sha256` of the **last** response's secret, and `activationLinkRenewedBy` in `GET /api/v1/users` names the administrator of that last response

### Implementation for User Story 3

- [X] T027 [US3] Confirm T024–T026 pass on the T013/T022 transaction without a second mechanism. Then add to the doc comment of `renewActivationLink` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts` the serialization contract GH-8 and GH-12 must honour: lock this `users` row, or guard on `PENDING`, and re-read the token by digest under that lock ([research.md](./research.md) D6). Adjust the code only if a test proves it necessary, and say why in the same comment

**Checkpoint**: No renewal can break a working link without replacing it, or leave two working links.

---

## Phase 6: User Story 4 - Renew From the User Workbench (Priority: P2)

**Goal**: An organization admin renews from a pending user's record or row menu, confirms
knowingly, receives the new link in the once-only dialog, and returns to where they were. Refusals
and failures are explained in place.

**Independent Test**: As an organization admin, open a pending user's record, renew, cancel at the
confirmation (no request sent), renew again and confirm. Capture the link from the outcome, press
`Done`, and assert the record shows the renewal in its history without a reload. Repeat from the
row menu. Drive each refusal and a network failure, asserting the sentence and that the dialog stays
open. As an operations admin, and on non-pending users, assert the action is absent.

### Tests for User Story 4 ⚠️

- [X] T028 [P] [US4] Extend `apps/web/src/features/users/__tests__/support/fixtures.ts` with a `RENEWABLE_USER` (pending, `activationLinkExpiresAt` valid, no renewal yet) and a `RENEWED_USER` (pending, with `activationLinkRenewedAt` and `activationLinkRenewedBy: RESPONSIBLE_ADMIN`), plus a `USERS_WITH_PENDING_LINKS` collection. Create `apps/web/src/features/users/__tests__/activation-link-renewal/helpers.ts` with `mockRenewalSucceeds(user, administrator)` — returning `{ data: { user: { …user, activationLinkRenewedAt, activationLinkRenewedBy: administrator, activationLinkExpiresAt }, activationLink: { url, expiresAt } } }` from `POST ${API_BASE_URL}/api/v1/users/:id/activation-link-renewal` and recording calls — plus `mockRenewalRefused(code, message, status, meta?)` and `mockRenewalUnreachable()`, following `apps/web/src/features/users/__tests__/password-reset/helpers.ts`
- [X] T029 [P] [US4] Create `apps/web/src/features/users/__tests__/activation-link-renewal/permissions.test.tsx`, asserting `Renew activation link` is offered to an organization admin on a pending user's record footer and row menu, and is absent on active, deactivated, and cancelled users and for an operations admin (FR-013, FR-018, US2-8)
- [X] T030 [P] [US4] Create `apps/web/src/features/users/__tests__/activation-link-renewal/confirmation.test.tsx`, asserting the confirmation names the user and says any link already handed out will stop working and a new one will be shown once. `Cancel` sends no request and leaves the record as it was. While the request is pending the confirm button reads `Renewing…` and is disabled, and a second click sends nothing (FR-019, FR-020)
- [X] T031 [P] [US4] Create `apps/web/src/features/users/__tests__/activation-link-renewal/success.test.tsx` (FR-006, FR-007, FR-009, FR-021, US4-6). Assert:
  - From the record: after confirming, the outcome dialog shows the link (`getByTestId('activation-link')`), a copy button, *This link is shown once*, and the renewal description saying the previous link no longer works.
  - Escape does not close it.
  - `Done` closes it and leaves the record open, whose access history now lists `Activation link renewed` with the date and `by <admin>`.
  - After `Done` the link text is nowhere in the document.
  - The same flow from the row menu, where `Done` leaves the pending view with no record open.
- [X] T032 [P] [US4] Create `apps/web/src/features/users/__tests__/activation-link-renewal/refusals.test.tsx`, asserting the toast description for each row of the refusal table in [contracts/renewal-workbench.md](./contracts/renewal-workbench.md#step-1--confirmation-alertdialog). That covers `E_USER_NOT_PENDING` with `ACTIVE`, `DEACTIVATED`, and `CANCELLED`, plus `E_USER_NOT_FOUND`, `E_AUTHORIZATION_FAILURE`, and a network failure. The confirmation stays open while the user is still listed as pending, the collection is re-requested after a refusal, and an unmapped code falls back to the API's message (FR-011, FR-017, US3-1, US3-3)
- [X] T033 [P] [US4] Unit-test `canRenewActivationLink` in `apps/web/src/features/users/helpers/user-permissions.test.ts`: true only for an organization admin viewing a `PENDING` user. (Placed beside the helper rather than in `__tests__/permissions/permissions.test.tsx`, which is a router-level feature test of the collection; `apps/web/AGENTS.md` keeps unit tests free of React rendering.)

### Implementation for User Story 4

- [X] T034 [P] [US4] Add `canRenewActivationLink(viewer, user)` to `apps/web/src/features/users/helpers/user-permissions.ts`, returning `viewer.role === 'ORGANIZATION_ADMIN' && user.accessStatus === 'PENDING'`, with a doc comment in the style of `canResetPassword`: it mirrors `UserPolicy.renewActivationLink` plus the repository's pending guard, and is a courtesy, not a boundary
- [X] T035 [P] [US4] Add `renewActivationLink` to `apps/web/src/features/users/mutations/use-user-mutations.ts`, wrapping `tuyauQuery.users.activationLinkRenewal.mutationOptions`, calling `refreshUsers()` on success and on error as `deactivate` does, and returning it from the hook (depends on T019)
- [X] T036 [US4] Add an `origin?: 'invitation' | 'renewal'` prop (default `'invitation'`) to `apps/web/src/features/users/ui/activation-link-dialog.tsx`. For `'renewal'` the description reads `A new activation link for <name>. The previous link no longer works. Hand them this one so they can choose their password.` Keep the once-only alert, the copy action, and the `Done`-only dismissal shared, and leave the invitation path unchanged, so the existing `__tests__/invitation/*` stay green
- [X] T037 [US4] Create `apps/web/src/features/users/ui/renew-activation-link-dialog.tsx`, exporting `RenewActivationLinkDialog({ user, onClose })` (depends on T035, T036):
  - It holds `issued: ActivationLinkDto | undefined` in state.
  - While `issued` is undefined it renders an `AlertDialog` confirmation: title `Renew activation link`, a description naming `formatFullName(user)` and the consequence, `Cancel`, and a confirm action `Renew` / `Renewing…`. The action is disabled while pending and uses `event.preventDefault()` so a refusal keeps it open.
  - On success it stores `result.data.activationLink` and renders `<ActivationLinkDialog open origin="renewal" activationLink={issued} invitedUser={user} onAcknowledge={onClose} />`.
  - On failure it calls `parseApiError` and shows `toast.error(\`Unable to renew ${name}'s activation link\`, { description })`. The description comes from a `describeRenewalRefusal(error, user)` that maps `E_USER_NOT_PENDING` by `meta.accessStatus`, plus `E_USER_NOT_FOUND` and `E_AUTHORIZATION_FAILURE`, per [contracts/renewal-workbench.md](./contracts/renewal-workbench.md), and falls back to `error.message`.
  - The doc comment explains why the confirmation and the outcome are one component held in state and not in the URL ([research.md](./research.md) D12).
- [X] T038 [US4] Offer the renewal in the record footer: in `apps/web/src/features/users/ui/user-access-record.tsx`, compute `mayRenewActivationLink = canRenewActivationLink(viewer, user)`, include it in the footer condition, and pass it to `UserAccessActions`. In `apps/web/src/features/users/ui/user-access-actions.tsx`, render an outline `Renew activation link` button before the access actions, mounting `RenewActivationLinkDialog` while open, and update both components' doc comments (depends on T034, T037)
- [X] T039 [US4] Offer the renewal from the row menu in `apps/web/src/features/users/ui/user-row-actions.tsx`: a `Renew activation link` item after `Edit` and before the destructive items, gated by `canRenewActivationLink`, mounting the same `RenewActivationLinkDialog`, and included in the empty-menu guard (depends on T034, T037)
- [X] T040 [P] [US4] Add `{ key: 'activation-link-renewed', label: 'Activation link renewed', at: user.activationLinkRenewedAt, by: user.activationLinkRenewedBy }` to `recordedEvents` in `apps/web/src/features/users/ui/user-access-history.tsx`, read uncast off the DTO like the existing events, with a comment that — like the password reset — it changes no access status (depends on T019)

**Checkpoint**: The renewal is usable end to end from the workbench. US1–US4 are complete.

---

## Phase 7: User Story 5 - Spot the Pending Users Whose Link No Longer Works (Priority: P2)

**Goal**: The collection carries each pending user's link expiry. The record states *valid until*,
*expired*, or *not issued*, and the pending view marks users with no working link.

**Independent Test**: With pending users holding a valid, an expired, and no link, assert the API
projects `activationLinkExpiresAt` correctly (and withholds it from an operations admin), the
record states the right validity for each, the pending view marks only the expired and missing ones
in an `Activation link` column absent from every other view, and renewing the expired one clears its
mark without a reload.

### Tests for User Story 5 ⚠️

- [X] T041 [P] [US5] Extend `apps/api/tests/integration/users/consultation/list.spec.ts`, asserting that for an organization admin, `activationLinkExpiresAt` is the token's `expires_at` for a pending user holding a token, `null` for a pending user without one, and `null` for an active user even if a token row exists for them. For an operations admin, `activationLinkExpiresAt`, `activationLinkRenewedAt`, and `activationLinkRenewedBy` are absent from every row. No row contains a `hash` key (FR-022)
- [X] T042 [P] [US5] Extend `apps/api/tests/integration/users/activation_link_renewal/renew.spec.ts`, asserting `data.user.activationLinkExpiresAt === data.activationLink.expiresAt` in the `200` (FR-004, contract)
- [X] T043 [P] [US5] Create `apps/web/src/features/users/helpers/activation-link.test.ts`, unit-testing `activationLinkState(user, now)`: `undefined` for a non-pending user and when the key is absent, `'missing'` for `null`, `'valid'` one millisecond before expiry, and `'expired'` at and after expiry
- [X] T044 [P] [US5] Create `apps/web/src/features/users/__tests__/activation-link-renewal/validity.test.tsx`, rendering `USERS_WITH_PENDING_LINKS` (extend the T028 fixtures with an expired-link and a no-link pending user) and asserting (FR-022, US5):
  - The record's `Activation link` field reads `Valid until …`, `Expired …`, or `Not issued`.
  - The pending view's `Activation link` column shows `Expired` and `Not issued` and is blank for the valid link.
  - The column is absent from the active view, and the `Password` column is absent from the pending view.
  - After renewing the expired user through `mockRenewalSucceeds`, the refreshed collection clears their mark.

### Implementation for User Story 5

- [X] T045 [US5] Add `.preload('activationToken')` to `preloadAccessHistory` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts` (next to T014's line, noting that the transformer reads only `expiresAt`). Add `activationLinkExpiresAt: this.when(includeAccessHistory, () => this.resource.accessStatus === 'PENDING' ? (this.resource.activationToken?.expiresAt ?? null) : null)` to `toAdministration()` in `apps/api/app/users/shared/transformers/user_transformer.ts`. Its comment explains the choice of an expiry over a flag, and why non-pending users get `null` ([research.md](./research.md) D9). Then regenerate the registry through the dev server, as in T019
- [X] T046 [P] [US5] Create `apps/web/src/features/users/helpers/activation-link.ts`, exporting `type ActivationLinkState = 'valid' | 'expired' | 'missing'` and `activationLinkState(user: UserDto, now: number): ActivationLinkState | undefined` per [data-model.md](./data-model.md#web-derived-state), with a comment that validity is computed at render time on purpose (depends on T045)
- [X] T047 [US5] Add an `Activation link` field to the `dl` in `apps/web/src/features/users/ui/user-access-record.tsx`, rendered only when `activationLinkState(user, Date.now())` is defined: `StatusIndicator` `Valid until ${formatDateTime(…)}` (neutral), `Expired ${formatDateTime(…)}` (warning), or `Not issued` (warning) (depends on T046)
- [X] T048 [US5] Add an `activationLink` column (header `Activation link`, not sortable) to `apps/web/src/features/users/ui/user-table.tsx`, showing `Expired` or `Not issued` as a warning `StatusIndicator` and nothing for a valid link. In `UserTable`, set `columnVisibility` from `view` — `activationLink` visible only in `'pending'`, `password` hidden in `'pending'` — and render the empty-state cell's `colSpan` from `table.getVisibleLeafColumns().length`. Comment the column the way the Password column is commented ([research.md](./research.md) D13) (depends on T046)

**Checkpoint**: Administrators can see which invitations need a renewal. Every story is complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T049 [P] Update `apps/web/src/features/users/ui/user-access-record.tsx`'s component doc comment, which still says invitation-related actions "are still owned by their own slices and are not offered here", to name the activation link renewal among the offered actions
- [X] T050 [P] Confirm no log line can carry the secret: search `apps/api` for request or response body logging around `users` routes, and check that neither `ActivationLinkIssuer` nor the new use case logs its result. Record the finding in the PR description (FR-007)
- [X] T051 Run the full gate from the repository root: `pnpm check`, `pnpm typecheck`, `pnpm test`, and confirm the generated `apps/api/database/schema.ts` and `apps/api/.adonisjs/` changes are included in the diff — green: Biome clean (992 files), both apps typecheck, API 1181 passing, web 1215/1216 in the full run. The one failure was `__tests__/list/scale.perf.test.tsx` (2.4 s against a 2 s budget) measured under a host load average of ~85 from other worktrees; it passes in isolation and in the users suite, and the unchanged baseline ranged 1.0–4.0 s under the same load. `UserTable`'s visibility state was made identity-stable in response (TanStack keys its memos on it)
- [ ] T052 **API half done on PostgreSQL, browser half pending.** Against an isolated `portflow_gh9` database in `portflow-postgres`: the migration runs up, down, and up again; the Postgres-generated `schema.ts` is identical to the one in the diff; and the quickstart's "Validate the API directly" pass holds — 200 with one token row whose digest is the new secret's, the old digest gone, 7.000 days to expiry, the expiry projected (and `null` for an active user), 409/404/422/401/403 refusals leaving the token untouched, and neither secret nor digest in any response or in the server log. Eight concurrent renewals leave one token row, and the recorded renewal names the one response whose link survives. The browser pass below still needs a person (the Playwright MCP server was disconnected). Walk the manual pass in [quickstart.md](./quickstart.md#validate-by-hand) against `pnpm dev`, including the expired and missing link setup, the stale-view refusal, and the operations admin view. Note SC-007 (three interactions from the collection) and SC-009 (outcome under 2 seconds)
- [X] T053 Obtain a fresh read-only review of the final diff per constitution VII, and resolve or explicitly justify every confirmed finding before marking the PR ready

---

### Review outcome (T053)

A fresh, read-only review (a separate agent with no prior context) reported no significant API
defect and six findings, all resolved:

- **A (medium)** — the renewed link lived in the dialog, inside the record: a browser Back closed the
  record and lost the link. Moved to `IssuedActivationLinkProvider` at the page level (research D12,
  revised); covered by `success.test.tsx` › "keeps the new link on screen when the record is left by
  navigating back".
- **B (medium)** — Cancel and Escape stayed live while the renewal was in flight. Disabled once
  submitted; covered by `confirmation.test.tsx` › "cannot be dismissed while the renewal is in
  flight". The refresh is no longer awaited before the link is presented.
- **C (low)** — the secret stayed in the mutation cache. The mutation runs with `gcTime: 0`; covered by
  `success.test.tsx` › "keeps no copy of the link in the query client". (The invitation's mutation has
  the same exposure; left to GH-7's owner rather than widened here.)
- **D (low)** — `POST /api/v1/users` projected `activationLinkExpiresAt: null` and omitted
  `activationLinkRenewedAt` for the user it had just invited. Fixed in `invite_user_use_case.ts` and
  `LucidUserRepository.invite`; covered in `invite.spec.ts`.
- **E (low)** — the overlapping-renewals test cannot exercise the PostgreSQL row lock under SQLite's
  global transaction. Renamed to say what it proves; the lock itself was exercised on PostgreSQL by
  hand — eight concurrent renewals, one surviving link, its administrator and dates recorded.
- **F (low)** — a web test for the operations admin could only pass vacuously (the API never serves
  them a pending user). Removed; the rule is covered by `helpers/user-permissions.test.ts`.

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories.
- **US1 (Phase 3)** depends on Phase 2 and is the MVP.
- **US2 (Phase 4)** depends on US1: it extends the same repository method (T022 after T013) and the same use case (T023 after T015).
- **US3 (Phase 5)** depends on US2: its stale-target test expects the refusal T022/T023 produce.
- **US4 (Phase 6)** depends on US1 for the endpoint and the regenerated registry (T019). It does not need US2/US3 to render, but its refusal tests assume their codes, so run it after them.
- **US5 (Phase 7)** depends on US1 (T014's preload function, T019's registry) and on US4 for the renewal used in T044's last assertion. Its API half (T041, T042, T045) can start right after US1.
- **Polish (Phase 8)** follows every story.

### Within each story

Tests first, and seen failing. Then repository → use case → controller → route → projection on the
API, and helper → mutation → dialog → entry points on the web.

### Parallel opportunities

- Phase 2: T006, T007, and T008 touch different files.
- US1: T011 and T012 run together.
- US2: T020 alongside the start of T021.
- US3: T024 and T025 are in one file but independent cases; write them together.
- US4: T028–T033 are all separate test files; T034 and T035 are separate modules; T040 is independent of T036–T039.
- US5: T041, T042, T043, and T044 run together; its API work (T041, T042, T045) can run in parallel with US4's web work once T019 is done.

## Parallel Example: User Story 4

```text
# All workbench tests at once, after T028 lands the fixtures and helpers:
T029 permissions.test.tsx
T030 confirmation.test.tsx
T031 success.test.tsx
T032 refusals.test.tsx
T033 permissions unit coverage

# Then the two independent modules:
T034 helpers/user-permissions.ts
T035 mutations/use-user-mutations.ts
```

## Implementation Strategy

### MVP first

1. Phases 1–2.
2. Phase 3 (US1): the endpoint replaces the link and returns it once. Demonstrate it with `curl`.
3. **Stop and validate** against the Independent Test, but do not open the PR here: an endpoint
   without US2's refusals must not ship.

### Incremental delivery on one branch

1. US1 + US2 → the endpoint is safe.
2. US3 → it is robust to failure and repetition.
3. US4 → administrators can use it.
4. US5 → administrators can see when to use it.
5. Polish → gate, manual pass, fresh review, PR ready.

Commit at every checkpoint with Conventional Commits (`feat(users): …`, `test(users): …`), one PR
for the whole slice.
