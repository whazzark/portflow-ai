---

description: "Task list for Restore a Cancelled Invitation with a New Activation Link (GH-13)"
---

# Tasks: Restore a Cancelled Invitation with a New Activation Link

**Input**: Design documents from `specs/user-administration/invitation-administration/restore-a-cancelled-invitation-with-a-new-activation-link/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [contracts/restoration-workbench.md](./contracts/restoration-workbench.md), [quickstart.md](./quickstart.md)

**Tests**: Test tasks are included and are **not optional here**. Constitution IV requires business
behavior to follow RED → GREEN → REFACTOR, so every behavioral task below comes after the test that
must fail first.

**Organization**: Tasks are grouped by user story. This is one vertical slice, one endpoint and one
workbench action, so the five stories are increments of the same seam rather than five separable
deliverables. Each is independently **testable**, and US1 is independently **demonstrable**. US2 to
US5 harden the same endpoint and dialog and are not shipped without it. They stay separate phases
because each has its own failing test to write first and its own checkpoint to stop at.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task serves (US1–US5)
- Every task names the exact file it touches

## Path Conventions

This is the monorepo described in [plan.md](./plan.md): `apps/api/` (AdonisJS, Japa) and `apps/web/`
(TanStack Start, Vitest). All paths are repository-relative. The research decisions are cited as
D1–D15 from [research.md](./research.md). The closest precedents are GH-12
(`app/users/cancel_invitation/`, `tests/**/users/invitation_cancellation/`) for the guarded write and
the comment, and GH-9 (`app/users/activation_link_renewal/`, `ui/renew-activation-link-dialog.tsx`)
for issuing and presenting a link.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean baseline before a TDD slice, so a red test is red for the right reason

- [X] T001 Install workspace dependencies from the repository root with `pnpm install`
- [X] T002 Apply the existing migrations against a throwaway `portflow_gh13_scratch` database on the local PostgreSQL server (never the shared `portflow` dev database) with `pnpm --filter @portflow/api db:migrate`, and confirm `apps/api/database/schema.ts` shows no diff afterwards. Done on the `portflow-postgres` container (port 5433) through a gitignored worktree-local `apps/api/.env` pointing at the scratch database; no diff.
- [X] T003 Confirm the baseline is green with `pnpm check`, `pnpm typecheck`, and `pnpm test`, and record the pass counts in this task so later regressions are attributable. GH-12 recorded two timing-only web failures that pass in isolation (`users/__tests__/list/scale.perf.test.tsx`, `customers/__tests__/list/list.test.tsx`); note them again if they recur rather than chasing them. Baseline: Biome clean (1080 files), both apps typecheck, API 1316/1316. Web full suite 1339/1360 with 21 timing-only failures across unrelated features under full-suite load; a sample passes in isolation. `src/features/users` alone: 283/284, the one failure being the known `scale.perf.test.tsx` budget.

**Checkpoint**: The baseline is green, so any failure from here on belongs to this feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The persistence, model, factory, exception, contract, authorization, and validation
declarations every story needs. They deliver no behavior on their own, so no test precedes them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create `apps/api/database/migrations/1786100000000_add_user_invitation_restoration.ts` (D6, D7):
  - Add `invitation_restored_at` (nullable `timestamp`), `invitation_restored_by_user_id` (nullable `uuid`, `.references('id').inTable('users').onDelete('SET NULL')`), and `invitation_restoration_comment` (nullable `text`).
  - Copy the structure of `apps/api/database/migrations/1786000000000_add_user_activation_link_renewal.ts`: a `NEW_COLUMNS` constant, the PostgreSQL/SQLite branch in both `up()` and `down()`, `static disableTransactions = true`, and the `withoutForeignKeys` helper, because the foreign-key column makes SQLite rebuild `users`.
  - The class docstring states: event, not state; latest only, overwritten by every restoration and cleared by nothing; why `invitation_restored_*` rather than `restored_*` (`CONTEXT.md` avoids "user restoration"); and why the comment is `text` (the 1,000-character limit lives in the validator).
- [X] T005 Run `pnpm --filter @portflow/api db:migrate` against the scratch database to apply T004 and regenerate `apps/api/database/schema.ts`, which gains `invitationRestoredAt`, `invitationRestoredByUserId`, and `invitationRestorationComment` on `UserSchema`. It is a generated file and must never be hand-edited. Depends on T004
- [X] T006 [P] Add `@belongsTo(() => User, { foreignKey: 'invitationRestoredByUserId' }) declare invitationRestoredBy: BelongsTo<typeof User>` to `apps/api/app/models/user.ts`, after `cancelledBy`, with the `biome-ignore lint/security/noSecrets` comment the neighbouring long column names carry if Biome flags it. Depends on T005
- [X] T007 [P] Add `invitationRestoredAt: null`, `invitationRestoredByUserId: null`, and `invitationRestorationComment: null` to `apps/api/database/factories/user_factory.ts`: in the definition, and in every state that already nulls `cancelledAt`/`cancelledByUserId` (`active`, `passwordRenewalRequired`, `passwordReset`). Add no `restored` state (data-model, Factory). Depends on T005
- [X] T008 In `apps/api/app/users/shared/repositories/lucid_user_repository.ts`, make the two edits every new lifecycle event needs, both learned from GH-12's walkthrough:
  - `invite()` writes every lifecycle column as an explicit `null`; add the three new columns to that list, or the invitation response will omit their keys.
  - `preloadAccessHistory` gains `.preload('invitationRestoredBy')`, and its docstring's "all seven actor relations" becomes eight.
  - Depends on T006.
- [X] T009 [P] Create `apps/api/app/users/restore_invitation/invitation_restoration_exceptions.ts` exporting `UserNotCancelledException` (`static status = 409`, `static code = 'E_USER_NOT_CANCELLED'`, `static message = 'Only a cancelled invitation can be restored'`, `readonly meta: { accessStatus: UserAccessStatus }` set in the constructor). Copy the shape and docstring reasoning of `apps/api/app/users/activation_link_renewal/activation_link_renewal_exceptions.ts`, naming what each status points to: renewal for a pending user, nothing to restore for an active one, reactivation for a deactivated one (D3)
- [X] T010 [P] In `apps/api/app/users/shared/repositories/user_repository.ts`, declare `RestoreCancelledInvitationCommand`, `RestoreCancelledInvitationResult` (`RESTORED` with `user` and `activationToken` | `NOT_FOUND` | `NOT_CANCELLED` with `accessStatus`), and `abstract restoreCancelledInvitation(command)`, exactly as [data-model.md](./data-model.md#repository-contract) gives them. Model the docstrings on `CancelPendingInvitationResult` and `renewActivationLink`: the guard, the token replacement, and the one transaction
- [X] T011 [P] Add `restoreInvitation(user)` to `apps/api/app/users/shared/user_policy.ts`, returning true only for an `ACTIVE` `ORGANIZATION_ADMIN`, with a docstring in the shape of `renewActivationLink`'s: issuing a way into the application is an organization admin's alone, and *which* user may be restored is the guarded write's decision (D4). Foundational so the endpoint is never exposed unauthorized, even mid-branch
- [X] T012 [P] Create `apps/api/app/users/restore_invitation/restore_user_invitation_validator.ts` exporting `restoreUserInvitationValidator = vine.create({ params: vine.object({ id: vine.string().uuid() }), comment: lifecycleComment() })`, with `lifecycleComment` from `#shared/validators/lifecycle_validator`. Copy the docstring of `apps/api/app/users/cancel_invitation/cancel_user_invitation_validator.ts` (the `uuid`/`22P02` reason, the optional body, blank-to-null belonging to the use case)

**Checkpoint**: The schema, model, factory, invitation nulls, preload, exception, repository contract, policy, and validator are in place, so story work can begin

---

## Phase 3: User Story 1 - Bring a Cancelled Invitee Back with a New Link (Priority: P1) 🎯 MVP

**Goal**: An organization admin restores a cancelled user's invitation. The user becomes pending
with a dated, attributed restoration event, exactly one new link exists and is shown once, the link
from before the cancellation stays dead, and the new one lets the person activate their access.

**Independent Test**: As an organization admin, invite a person and keep link A, cancel them, then
restore them through the API and through the workbench record. Assert:
- the status is `PENDING`, and `invitationRestoredAt`/`invitationRestoredBy` name the requester;
- identity, role, the invitation event, and the cancellation event with its comment are unchanged;
- exactly one token row exists, and it matches link B from the response;
- link A is refused at `POST /api/v1/auth/invitation-acceptance`, and link B activates the user;
- the workbench presents link B once, keeps the outcome open while the record closes, and after
  **Done** lists the user under Pending with an **Invitation restored** history entry.

### Tests for User Story 1 ⚠️

> Write these first and watch them fail

- [X] T013 [P] [US1] Create `apps/api/tests/unit/users/invitation_restoration/guarded_write.spec.ts`, which exercises `restoreCancelledInvitation` against SQLite (ADR-0014). Model the group on `apps/api/tests/unit/users/invitation_cancellation/guarded_write.spec.ts`.
  - Setup: a `cancelled` user merged with `invitedAt`, `invitedByUserId`, `cancelledByUserId` (an admin), and `cancellationComment`, plus a stale `UserActivationTokenFactory` row for that user (the case D5's delete exists for).
  - Assert: one call returns `RESTORED`; the row holds `PENDING`, `invitationRestoredAt`, `invitationRestoredByUserId`, and the given comment; `updatedAt` moved.
  - Assert: identity, role, `password` (null), `invited*`, `cancelled*`, `cancellationComment`, and `activationLinkRenewed*` are untouched (FR-002, FR-003).
  - Assert: exactly one `user_activation_tokens` row exists for the user, holding the command's hash and expiry; the stale row's hash no longer exists (FR-004, FR-006).
  - Assert: the returned user has `invitationRestoredBy` and every other actor preloaded, and `activationToken` resolved.
- [X] T014 [P] [US1] Create `apps/api/tests/unit/users/invitation_restoration/restore.spec.ts` for the happy path, modelled on `apps/api/tests/unit/users/activation_link_renewal/renew_activation_link_use_case.spec.ts`: `RestoreUserInvitationUseCase.handle({ id, restoredByUserId, restoredAt, comment })` returns `{ user, activationLink }`; `activationLink.url` starts with `${WEB_ORIGIN}/activate/`; `activationLink.expiresAt` is 7 days out; the stored token hash equals `digestActivationSecret` of the URL's last segment; the actor and instant reach the row (FR-001, FR-004, FR-005)
- [X] T015 [P] [US1] Create `apps/api/tests/integration/users/invitation_restoration/restore.spec.ts` with the success contract, in request-flow order per `apps/api/tests/README.md`:
  - Arrange through the real endpoints: an organization admin invites with `POST /api/v1/users` (keep link A), then cancels with `POST /api/v1/users/:id/cancel-invitation` and a comment.
  - `POST /api/v1/users/:id/restore-invitation` returns `200` with the [contracts/http-api.md](./contracts/http-api.md#success--200-ok) shape: `accessStatus: 'PENDING'`, `invitationRestoredBy` the requester, `invitedAt`/`invitedBy`/`cancelledAt`/`cancelledBy`/`cancellationComment` unchanged, and `activationLink.expiresAt` equal to `user.activationLinkExpiresAt`.
  - Exactly one token row exists for the user.
  - `POST /api/v1/auth/login` with that email is refused with the invalid-credentials outcome (FR-023).
  - Link A presented to `POST /api/v1/auth/invitation-acceptance` is refused as unusable, and link B is accepted and opens a session, using the request shape of `apps/api/tests/integration/auth/invitation_acceptance/accept.spec.ts` (US1-3, US1-4, FR-006).
  - An operations admin's `GET /api/v1/users` does not list the restored user (FR-024).
- [X] T016 [P] [US1] In `apps/api/tests/integration/users/consultation/list.spec.ts`, add `invitationRestorationComment`, `invitationRestoredAt`, and `invitationRestoredBy` to the exact key set of "never exposes credentials or tokens", and add a test that an organization admin receives the three keys with values for a restored user while an operations admin's rows carry none of them (FR-019)
- [X] T017 [P] [US1] In `apps/api/tests/integration/users/invitation/invite.spec.ts`, assert that the invitation response carries `invitationRestoredAt`, `invitationRestoredBy`, and `invitationRestorationComment` as `null`, next to the existing `activationLinkRenewed*` assertions (guards T008's `invite()` nulls)
- [X] T018 [P] [US1] In `apps/web/src/features/users/__tests__/support/fixtures.ts`, add the three keys as `null` to `NO_LIFECYCLE` (and so to every fixture spreading it), leave them absent from the `*_WITHOUT_LIFECYCLE` projections, and add a `RESTORED_USER` fixture: pending, invited by `RESPONSIBLE_ADMIN`, cancelled with a comment, restored later by `RESPONSIBLE_ADMIN` with a comment, `activationLinkExpiresAt` far in the future. Export a `USERS_WITH_RESTORED` list if the default `USERS` must stay unchanged for other suites
- [X] T019 [P] [US1] Create `apps/web/src/features/users/__tests__/invitation-restoration/helpers.ts` in the shape of `__tests__/activation-link-renewal/helpers.ts`: `RESTORE_PATH` for `POST /api/v1/users/:id/restore-invitation`, `RESTORED_AT`, `NEW_EXPIRY`, `NEW_LINK`, `mockRestorationSucceeds(user, administrator)` (returns the user as `PENDING` with the restoration keys and the link, and records each call's id and body), `mockRestorationPending`, `mockRestorationRefused(code, message, status, meta?)`, `mockRestorationUnreachable`, `openCancelledRecordFor(user, name)` (table `Cancelled users`), and `openCancelledRowMenu(name)`
- [X] T020 [P] [US1] Create `apps/web/src/features/users/__tests__/invitation-restoration/journey.test.tsx`, rendered through the real router, with the collection handler answering the refreshed list after the restoration. From the Cancelled view, open the cancelled user's record, click **Restore invitation**, and confirm. Assert:
  - the **Activation link** dialog opens with the restoration sentence ("…'s invitation is pending again. Any link they were given before still does not work…") and the link;
  - behind it, the record has closed, and the dialog is still open (US4-8, D12);
  - after **Done**, the Cancelled tab is still selected, the user is gone from it, and both counts changed (FR-018);
  - in the Pending view, the user's record shows an **Invitation restored** history entry with actor and date after **Cancelled** (US1-6).

### Implementation for User Story 1

- [X] T021 [US1] Implement `restoreCancelledInvitation` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts` (D5). Depends on T008, T010.
  - Inside `User.transaction`, run a guarded `UPDATE … WHERE id = ? AND access_status = 'CANCELLED'` setting `accessStatus: 'PENDING'`, `invitationRestoredAt`, `invitationRestoredByUserId`, `invitationRestorationComment`, and `updatedAt` by hand (the query builder bypasses the auto-update hook). Write nothing else on `users`.
  - On one affected row: delete every `user_activation_tokens` row for the user, insert the new one with `UserActivationToken.create({ userId, hash, expiresAt }, { client: trx })`, reload through `preloadAccessHistory`, and return `RESTORED` with the user and the token.
  - Until US3's T040, return `NOT_FOUND` for a zero-row update.
  - The docstring explains the guard as eligibility and concurrency control, the single transaction (FR-007), why the token is deleted before the insert although GH-12 already deleted it (FR-006, GH-8 accepts any pending user's live token), and the removal race (`ON DELETE CASCADE`).
- [X] T022 [US1] Create `apps/api/app/users/restore_invitation/restore_user_invitation_use_case.ts` (`@inject()`, constructor takes `UserRepository` and `ActivationLinkIssuer`, input `{ id, restoredByUserId, restoredAt, comment?: string | null }`, result type `InvitationRestoration = { user: User; activationLink: { url: string; expiresAt: DateTime } }`). Issue the link before the write, as `RenewActivationLinkUseCase` does, pass its hash and expiry to `restoreCancelledInvitation`, and return `{ user, activationLink: { url, expiresAt } }` on `RESTORED`. Until US3's T041, throw `UserNotFoundException` for any other outcome; until US4's T049, pass the comment through as given. The docstring cites `CONTEXT.md`'s *User Invitation Restoration* and says it is neither a new invitation nor a renewal. Depends on T021
- [X] T023 [US1] Add `restoreInvitation` to `apps/api/app/controllers/users_controller.ts`, between `cancelInvitation` and `changeRole`. Depends on T022.
  - Authorize first with `bouncer.with(UserPolicy).authorize('restoreInvitation')`, then validate with `request.validateUsing(restoreUserInvitationValidator, { data: { ...request.body(), params } })`.
  - Call the use case with `restoredByUserId: viewer.id` and `restoredAt: DateTime.now()`.
  - Serialize `{ user: UserTransformer.transform(user, { includeAccessHistory: true }).useVariant('toAdministration'), activationLink }`, as `renewActivationLink` does.
  - Inject the use case in the constructor. The docstring says why authorization comes first (FR-013), that the link travels in this response only, and why `200` rather than `201`.
- [X] T024 [US1] Declare `router.post('/:id/restore-invitation', [controllers.Users, 'restoreInvitation']).as('restore_invitation')` inside the existing `/users` group in `apps/api/start/routes.ts`, right after `cancel_invitation`. Then regenerate the typed client registry so `apps/api/.adonisjs/client/` gains `users.restore_invitation`: neither `ace test` nor `ace build` runs Tuyau's `generateRegistry` hook, so start `node ace serve` briefly against the scratch database (GH-12 T019) and commit the regenerated files. Depends on T023
- [X] T025 [US1] Add `invitationRestoredAt`, `invitationRestoredBy` (through `toActor`), and `invitationRestorationComment` to `toAdministration()` in `apps/api/app/users/shared/transformers/user_transformer.ts`, each wrapped in `this.when(includeAccessHistory, …)`, placed after `cancellationComment` with a one-line comment. Leave `toObject()` unchanged (D10)
- [X] T026 [P] [US1] Add `canRestoreInvitation(viewer, user)` to `apps/web/src/features/users/helpers/user-permissions.ts`: `viewer.role === 'ORGANIZATION_ADMIN' && user.accessStatus === 'CANCELLED'`, with a docstring in the shape of `canRenewActivationLink`'s (mirrors the API; no self rule because a viewer is never cancelled)
- [X] T027 [P] [US1] Add `restoreInvitation` to `apps/web/src/features/users/mutations/use-user-mutations.ts`: `useMutation(tuyauQuery.users.restoreInvitation.mutationOptions({ gcTime: 0, onSuccess: () => void refreshUsers(), onError: () => void refreshUsers() }))`, returned with the others, with the `renewActivationLink` docstring's reasons (not awaited; `gcTime: 0` because the result carries a secret). Depends on T024
- [X] T028 [P] [US1] Let the page-level outcome carry its origin (D12):
  - `apps/web/src/features/users/ui/activation-link-dialog.tsx`: `origin` accepts `'invitation' | 'renewal' | 'restoration'`, and `describeOutcome` gains the restoration sentence `${name}'s invitation is pending again. Any link they were given before still does not work. Hand them this one so they can choose their password.`
  - `apps/web/src/features/users/ui/issued-activation-link.tsx`: `IssuedActivationLink` gains `origin: 'renewal' | 'restoration'`, and the provider passes `issued.origin` instead of the literal `"renewal"`. Update both docstrings, which say "renewed" link.
  - `apps/web/src/features/users/ui/renew-activation-link-dialog.tsx`: pass `origin: 'renewal'` to `presentActivationLink`.
  - The renewal suites under `__tests__/activation-link-renewal/` must stay green unchanged.
- [X] T029 [US1] Create `apps/web/src/features/users/ui/restore-invitation-dialog.tsx` exporting `RestoreInvitationDialog({ user, onClose })`, built on `ui/renew-activation-link-dialog.tsx` (D11). Depends on T026, T027, T028.
  - Title **Restore invitation?**, the description of [the workbench contract](./contracts/restoration-workbench.md#confirmation--uirestore-invitation-dialogtsx), **Cancel** and **Restore invitation** (**Restoring…** while in flight).
  - While the request is in flight, both buttons are disabled and `onOpenChange` ignores dismissal.
  - On success, call `usePresentActivationLink()` with `{ user: result.data.user, activationLink: result.data.activationLink, origin: 'restoration' }`, then `onClose()`. No toast.
  - On failure, `event.preventDefault()` keeps the dialog open, and a toast titled `Unable to restore ${name}'s invitation` carries the API message for now (US3's T042 adds the sentence table).
  - The docstring explains why it is not a `UserAccessAction`, and why the link goes to the page before the dialog closes: the restored user leaves the cancelled view and takes the record or row with them.
- [X] T030 [US1] Offer the restoration in the record footer. Depends on T029.
  - `apps/web/src/features/users/ui/user-access-record.tsx`: ask `canRestoreInvitation(viewer, user)`, include it in the footer's render condition, and pass `mayRestoreInvitation`.
  - `apps/web/src/features/users/ui/user-access-actions.tsx`: accept `mayRestoreInvitation`, render an outline **Restore invitation** button after **Renew activation link** and before the status actions, mount `RestoreInvitationDialog` only while open, include it in the early-return condition, and extend the docstring's paragraph on credential-issuing actions.
- [X] T031 [P] [US1] Add the `{ key: 'invitation-restored', label: 'Invitation restored', at: user.invitationRestoredAt, by: user.invitationRestoredBy, comment: user.invitationRestorationComment }` event to `recordedEvents` in `apps/web/src/features/users/ui/user-access-history.tsx`, read uncast off the DTO, with a comment saying it is an access status change whose comment sits beside it like the cancellation's (D14). Depends on T024

**Checkpoint**: An organization admin can restore a cancelled invitation from the record, the new link works and the old one does not, and the API and journey tests are green. US1 is demonstrable on its own.

---

## Phase 4: User Story 2 - Keep Restoration Restricted to the Administrators Responsible for User Access (Priority: P1)

**Goal**: Only an active organization admin may restore. Every other requester is refused before the
target is read, and the workbench offers the action only where the API would accept it.

**Independent Test**: Issue the restoration unauthenticated, as an operations admin, operations lead,
and observer, and as an organization admin owing their own password renewal, against a cancelled,
an unknown, and a malformed id. Assert `401`/`403` in every case with identical bodies across
targets, no token created, and the cancelled user unchanged. In the workbench, assert the action
appears only for an organization admin on a cancelled user.

### Tests for User Story 2 ⚠️

- [X] T032 [P] [US2] Extend `apps/api/tests/integration/users/invitation_restoration/restore.spec.ts` with the authorization matrix:
  - `401 E_UNAUTHORIZED_ACCESS` without a session.
  - `403 E_AUTHORIZATION_FAILURE` for an operations admin, operations lead, and observer, each against a cancelled id, an unknown uuid, and a non-uuid id; the three bodies must be identical (FR-013).
  - `403 E_PASSWORD_RENEWAL_REQUIRED` for an organization admin in the `passwordRenewalRequired` state (FR-012).
  - After every attempt the cancelled user is still `CANCELLED`, its restoration columns are `null`, and it holds no token.
  - Covers FR-012, FR-013, and SC-001.
- [X] T033 [P] [US2] Extend `apps/web/src/features/users/helpers/user-permissions.test.ts` with `canRestoreInvitation`: true for an organization admin on a `CANCELLED` user only; false for `PENDING`, `ACTIVE`, and `DEACTIVATED`; false for an operations admin on any status
- [X] T034 [P] [US2] Create `apps/web/src/features/users/__tests__/invitation-restoration/permissions.test.tsx`: an organization admin sees **Restore invitation** in a cancelled user's record footer; it is absent from pending, active, and deactivated records; an operations admin sees no cancelled user at all (US2-4, US2-5, FR-014). The row menu's offer is asserted in US4's T046

### Implementation for User Story 2

- [X] T035 [US2] Confirm that `restoreInvitation` in `apps/api/app/controllers/users_controller.ts` authorizes before validating and before any repository call, and that T032–T034 pass without further change. The policy (T011), the middleware already on the group, and the offer rule (T026) carry this story. If T032 exposes an ordering gap, fix it here and record why in the action's docstring. Depends on T023, T032

**Checkpoint**: The endpoint is safe to expose, and the workbench never offers what the API refuses.

---

## Phase 5: User Story 3 - Refuse a Restoration That Does Not Apply (Priority: P1)

**Goal**: Only a cancelled invitation can be restored. Pending, active, deactivated, and unknown
targets are refused with `404` or `409 E_USER_NOT_CANCELLED` naming the status, no link is issued,
and nothing changes.

**Independent Test**: Restore a pending user (keeping their link from the invitation), an active user
(including the requester), a deactivated user, and an unknown uuid. Assert `409` with
`meta.accessStatus` `PENDING`, `ACTIVE`, `ACTIVE`, `DEACTIVATED`, and `404`. Assert every targeted row
is unchanged, no token was created, the pending user's original link still activates them, and the
workbench shows each refusal's sentence.

### Tests for User Story 3 ⚠️

- [X] T036 [P] [US3] Extend `apps/api/tests/unit/users/invitation_restoration/guarded_write.spec.ts` with the refusal outcomes: an unknown id returns `NOT_FOUND`; `PENDING`, `ACTIVE`, and `DEACTIVATED` targets return `NOT_CANCELLED` with that status; every refused row is unchanged; a pending target's token keeps its hash and expiry; no token row is created for any refused target (FR-010, US3-5)
- [X] T037 [P] [US3] Extend `apps/api/tests/unit/users/invitation_restoration/restore.spec.ts` with the mapping: `NOT_FOUND` → `UserNotFoundException`; `NOT_CANCELLED` → `UserNotCancelledException` whose `meta.accessStatus` is the observed status, for each of `PENDING`, `ACTIVE`, `DEACTIVATED` (FR-011)
- [X] T038 [P] [US3] Extend `apps/api/tests/integration/users/invitation_restoration/restore.spec.ts` with the refusals of [contracts/http-api.md](./contracts/http-api.md#refusals):
  - `404 E_USER_NOT_FOUND` for an unknown uuid.
  - `409 E_USER_NOT_CANCELLED` with `meta.accessStatus` `PENDING`, `ACTIVE` (another user, and the requester's own id), and `DEACTIVATED`, and no `activationLink` in any body.
  - The pending user was invited through `POST /api/v1/users`; after the refused restoration, their original link is still accepted by `POST /api/v1/auth/invitation-acceptance` (US3-1).
- [X] T039 [P] [US3] Create `apps/web/src/features/users/__tests__/invitation-restoration/refusals.test.tsx`. Assert that each refusal shows the toast title `Unable to restore <name>'s invitation` with its sentence from research D13: `E_USER_NOT_CANCELLED` with `PENDING`, `ACTIVE`, and `DEACTIVATED`, `E_USER_NOT_FOUND`, and `E_AUTHORIZATION_FAILURE`; that the collection is refetched after a refusal; and that an unmapped code falls back to the API message

### Implementation for User Story 3

- [X] T040 [US3] Extend `restoreCancelledInvitation` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`: on a zero-row update, re-read the row inside the transaction and return `NOT_CANCELLED` with its `accessStatus`, or `NOT_FOUND`, deleting and inserting nothing. The comment says the re-read names the reason and never decides the outcome. Same method as T021
- [X] T041 [US3] Replace T022's provisional refusal in `apps/api/app/users/restore_invitation/restore_user_invitation_use_case.ts`: `NOT_FOUND` → `UserNotFoundException`, `NOT_CANCELLED` → `new UserNotCancelledException(result.accessStatus)`. A comment notes there is no self check, because the requester is active and so simply not cancelled (D4). Depends on T009, T040
- [X] T042 [US3] Add the refusal sentences to `apps/web/src/features/users/ui/restore-invitation-dialog.tsx`: an `INSTEAD_OF_RESTORATION` table keyed by `Exclude<UserAccessStatus, 'CANCELLED'>` read from `meta.accessStatus` for `E_USER_NOT_CANCELLED`, plus `E_USER_NOT_FOUND` and `E_AUTHORIZATION_FAILURE`, falling back to the API message, in the shape of `describeRenewalRefusal` in `ui/renew-activation-link-dialog.tsx`. Sentences are those of research D13. Depends on T029

**Checkpoint**: The access status only moves `CANCELLED → PENDING`, and every other attempt is refused distinctly, with no link issued.

---

## Phase 6: User Story 4 - Restore From the User Workbench (Priority: P2)

**Goal**: The restoration is offered on the record and in the row menu, its confirmation names the
user, states the consequence, offers an optional comment of at most 1,000 characters, and cannot be
dismissed in flight. The stored comment is trimmed, or `null` when blank, and the history shows it.

**Independent Test**: Open the confirmation from the record and from the row menu and assert its
title, description, comment field, and labels. Dismiss it after typing and assert no request and an
empty field on reopening. Confirm with `  padded  `, spaces only, and nothing, and assert the stored
comment is `padded`, `null`, and `null`. Submit 1,001 characters and assert `422` with the comment
kept and nothing written. Assert the history orders Invited, Cancelled, Invitation restored, each
with its comment, and that the existing "Restore it instead" pointers lead to an offered action.

### Tests for User Story 4 ⚠️

- [X] T043 [P] [US4] Extend `apps/api/tests/unit/users/invitation_restoration/restore.spec.ts`: the use case stores `'padded'` for `'  padded  '`, and `null` for `'   '`, `''`, `null`, and an omitted comment (FR-003a)
- [X] T044 [P] [US4] Extend `apps/api/tests/integration/users/invitation_restoration/restore.spec.ts` with the comment contract:
  - a padded comment is stored and returned trimmed; an omitted body is accepted with `invitationRestorationComment: null`; exactly 1,000 characters are accepted;
  - 1,001 characters are refused `422 E_VALIDATION_ERROR` on field `comment`, with the user still `CANCELLED`, the restoration columns `null`, and no token;
  - restore with a comment, cancel, then restore without one: `invitationRestorationComment` is `null` and `invitationRestoredAt` moved (latest only, FR-003), while `cancelledAt` and `cancellationComment` are the second cancellation's.
- [X] T045 [P] [US4] Create `apps/web/src/features/users/__tests__/invitation-restoration/confirmation.test.tsx`. Assert:
  - the title `Restore invitation?` and the description naming the user, the 7 days, the single showing, and that earlier links stay unusable (FR-016);
  - a `Comment (optional)` field limited to 1,000 characters;
  - buttons `Cancel` and `Restore invitation`;
  - `Cancel`, Escape, and the overlay each send no request and discard the typed comment (US4-4);
  - while the request is pending, the confirm button reads `Restoring…`, both buttons and the field are disabled, and Escape does not close the dialog (US4-5);
  - the request body carries the typed comment, or `null` when the field is empty;
  - a `422` shows the field-level message and keeps the typed comment (US4-7).
- [X] T046 [P] [US4] Create `apps/web/src/features/users/__tests__/invitation-restoration/row-menu.test.tsx`: on a cancelled row the menu reads View, Edit, Restore invitation, Remove in that order; the item opens the same confirmation; after success the outcome stays open while the row disappears from the Cancelled view, and **Done** leaves the user in Pending (US4-2, US4-8, FR-015). Also assert the item is absent from pending, active, and deactivated rows
- [X] T047 [P] [US4] Create `apps/web/src/features/users/__tests__/invitation-restoration/history.test.tsx` with `RESTORED_USER`: the history lists Invited, Cancelled with its quoted comment, and Invitation restored with its quoted comment, oldest first, and the **Activation link** field states the link is valid; a restored user without a restoration comment shows no comment line under Invitation restored (FR-019, clarification 2)
- [X] T048 [P] [US4] Extend `apps/web/src/features/users/__tests__/invitation-restoration/journey.test.tsx` with the pointers (US4-10): an invitation refused with `E_USER_EMAIL_CONFLICT` and `meta.accessStatus: 'CANCELLED'` shows "Restore it instead…", and the cancelled user it names offers **Restore invitation**; and the pending view's `Invited` cell of the restored user still shows the original invitation date and admin (clarification 3)

### Implementation for User Story 4

- [X] T049 [US4] Normalize the comment in `apps/api/app/users/restore_invitation/restore_user_invitation_use_case.ts` with `input.comment?.trim() || null` before the repository call, with the one-line comment `CancelUserInvitationUseCase` carries (D8). Depends on T022
- [X] T050 [US4] Add the comment field to `apps/web/src/features/users/ui/restore-invitation-dialog.tsx`, copying `UserAccessDialog`'s: a `Field` with `LIFECYCLE_COMMENT_LABEL`, a `Textarea` with `maxLength={1000}`, a `useId()` id, `disabled` while in flight, and `LIFECYCLE_COMMENT_DESCRIPTION`. Hold the value in local state, send `{ comment: comment || null }` in the mutation body, and show `error.details?.[0]?.message` as the toast description when present, so a `422` reads as the field's reason. Depends on T042
- [X] T051 [US4] Offer the restoration in the row menu in `apps/web/src/features/users/ui/user-row-actions.tsx`: ask `canRestoreInvitation`, include it in the empty-menu check, render **Restore invitation** after the renewal item and before the access actions so **Remove** stays last, and mount `RestoreInvitationDialog` only while open. Update the component docstring's list of actions and of shared answers. Depends on T029
- [X] T052 [US4] Confirm that T034's record-footer assertions and T046's row-menu assertions agree (both ask `canRestoreInvitation`), and that no change to `apps/web/src/features/users/ui/user-table.tsx` is needed for T048's `Invited` assertion (D14). If one is, record why in that file's column docstring. Depends on T046, T048, T051

**Checkpoint**: The restoration is deliberate and reachable from both entry points, and the comment round-trips from the dialog to the access record.

---

## Phase 7: User Story 5 - Resolve Races and Failures Without Leaving a Half-Restored Invitation (Priority: P2)

**Goal**: Concurrent, stale, repeated, racing, and failed restorations each end in exactly one
consistent state with at most one usable link, and the administrator can read what happened and
retry.

**Independent Test**: Fire two restorations of one cancelled user at once and assert one `200`, one
`409` with `PENDING`, one token, and the winner's actor and comment stored. Race a restoration with a
removal both ways. Make the write fail after the `UPDATE` and assert the user is still cancelled with
no token. In the workbench, fail the request at the network layer and assert the dialog and comment
remain and a retry presents one link.

### Tests for User Story 5 ⚠️

- [X] T053 [P] [US5] Extend `apps/api/tests/unit/users/invitation_restoration/guarded_write.spec.ts`:
  - a second `restoreCancelledInvitation` on the same user returns `NOT_CANCELLED`/`PENDING`, leaves exactly one token holding the first call's hash, and keeps the first call's restoration columns (FR-020);
  - `removeNeverActivated` then `restoreCancelledInvitation` returns `NOT_FOUND` and creates no token row;
  - `restoreCancelledInvitation` then `removeNeverActivated` leaves no token row for that id (US5-5, `ON DELETE CASCADE`);
  - a failure after the `UPDATE` rolls everything back: pre-insert a token with the command's hash for another user, so the insert hits the `hash` unique index; the call throws, and the target is still `CANCELLED` with `null` restoration columns and no token (FR-007, US5-3).
- [X] T054 [P] [US5] Extend `apps/api/tests/integration/users/invitation_restoration/restore.spec.ts` with two concurrent requests from two organization admins, via `Promise.all`, on one cancelled user, with different comments. Assert exactly one `200` and one `409 E_USER_NOT_CANCELLED` with `PENDING` and no `activationLink`, one token row matching the `200`'s link, and the stored actor and comment being the `200`'s (SC-005)
- [X] T055 [P] [US5] Create `apps/web/src/features/users/__tests__/invitation-restoration/recovery.test.tsx`:
  - a network error (`HttpResponse.error()`) and a `500` keep the dialog open with the typed comment and the confirm button re-enabled;
  - a second click after the handler is restored presents exactly one link (US5-3, US5-4, FR-022);
  - a stale `E_USER_NOT_CANCELLED` with `PENDING` from the row menu shows its toast while the refreshed collection drops the row and the dialog with it (US5-2).

### Implementation for User Story 5

- [X] T056 [US5] Confirm that T053–T055 pass on the guard and transaction (T021, T040), the error-path refresh (T027), and the refusal-keeps-dialog behavior (T029) with no second mechanism. If any case needed a change, such as re-enabling the confirm button after a network failure in `apps/web/src/features/users/ui/restore-invitation-dialog.tsx` or catching the unique violation in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`, record why in that code's docstring. Depends on T021, T027, T029, T040, T050

**Checkpoint**: No outcome leaves a pending user without a link, a cancelled user with one, or two usable links for one user, and every failure is readable and retryable.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T057 [P] Update the comments that anticipated this slice now that it exists: the `PENDING` branch comment in `apps/api/app/users/cancel_invitation/cancel_user_invitation_use_case.ts` ("only once restoration exists"), the `activationToken` docstring in `apps/api/app/models/user.ts`, and `userAccessActions`' docstring in `apps/web/src/features/users/user-access.tsx` if it describes what a cancelled user is offered. Comment-only changes. Also corrected `UserAlreadyActivatedException`'s docstring in `apps/api/app/users/shared/user_exceptions.ts`, which claimed the restoration would share it (D3 chose `E_USER_NOT_CANCELLED` instead), and the "five above" count in `user.ts`.
- [X] T058 [P] Update the `GH-13` row in `specs/user-administration/invitation-administration/roadmap.md` from `planned` to its delivered status. Leave the other rows to their own slices
- [X] T059 Run the full gate from the repository root, `pnpm check`, `pnpm typecheck`, and `pnpm test`, and record the pass counts here against T003's baseline, noting any timing-only failure that passes in isolation. Result: Biome clean (1096 files), both apps typecheck, API 1353/1353 (+37). Web full suite 1403/1404; the one failure, `trucks/__tests__/details/create.test.tsx`, is timing-only and passes in isolation (an earlier full run under heavier load showed 52 such failures across unrelated features). `src/features/users` alone: 327/328 (+44), the one failure being the known `scale.perf.test.tsx` budget.
- [X] T060 Walk the browser journey in [quickstart.md](./quickstart.md#validate-by-hand), steps 1–12, against a running API and web app on the scratch database (Playwright is available), and record the results here. Any gap it finds gets a failing test before its fix. Done with Playwright against the scratch database: invite (link A), cancel with a comment, row menu reads View, Edit, Restore invitation, Remove and the record footer offers Restore invitation; the confirmation's copy and labels; dismissing discards the typed comment; restoring shows the once-only outcome with the restoration sentence while the record closes and the Cancelled view empties behind it (screenshot taken); Done leaves the workbench on Cancelled (0) with Pending (1); the Invited cell keeps the original invitation; the history reads Invited, Cancelled with its comment, Invitation restored with its trimmed comment; a second cancel-and-restore cycle keeps only the latest of each. Links A and B were refused at the acceptance preview (404) and link C activated the user. A stale view restored behind the browser's back got the "already pending … Renew their activation link" toast, the refresh, and no second link, and the target held exactly one token. Steps 9 (row-menu restoration) and 11 (unreachable API) were covered by `row-menu.test.tsx` and `recovery.test.tsx` rather than by hand. No gap found
- [X] T061 Exercise the endpoint directly per [quickstart.md](./quickstart.md#validate-at-the-api) as each unauthorized role and against each target status, confirming the workbench is never the only thing enforcing a rule (FR-014), then drop the scratch database. Results with curl: unauthenticated `401`; operations admin `403 E_AUTHORIZATION_FAILURE` with an identical body for a cancelled, an unknown, and a malformed id; the operations admin collection lists `ACTIVE` users only and no restoration key; over-long comment `422` on `comment`; own access `409 E_USER_NOT_CANCELLED` with `ACTIVE`; unknown `404`; success `200` with a trimmed comment and a link; a repeat `409` with `PENDING`; one token row for the target. The scratch database was dropped and the worktree-local `apps/api/.env` removed
- [ ] T062 Obtain a fresh read-only review of the final diff, and resolve or explicitly justify every confirmed finding (constitution VII). A human-triggered review that cannot be self-certified — **still owed**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: needs Setup, and blocks every story. T005 needs T004. T006 and T007 need T005. T008 needs T006. T009–T012 are independent of each other and of T006–T008.
- **US1 (Phase 3)**: needs Foundational. This is the MVP.
- **US2 (Phase 4)**: needs US1's controller (T023) and offer rule (T026). Its tests can be written as soon as T024 lands.
- **US3 (Phase 5)**: needs US1. T040 extends T021's method, T041 replaces T022's provisional branch, and T042 extends T029's dialog.
- **US4 (Phase 6)**: needs US1 and US3's T042 (T050 edits the same dialog after it). T049 edits T022's use case; it is independent of US2.
- **US5 (Phase 7)**: needs US1 and US3 (the `409` it asserts), plus US4's T050 for the comment kept on failure.
- **Polish (Phase 8)**: needs every story.

### Honest note on story independence

US2 to US5 harden the endpoint and dialog US1 creates, and they share its files. Two real parallel
lanes exist once US1 lands:
- the **API lane**: US2 → US3 → US4 (T043, T044, T049) → US5 API tests;
- the **web lane**: US2's permission tests, US3's refusal copy (T042), then US4's comment field, row
  menu, and history tests, then US5's recovery test.

### Within Each Story

- The failing test always comes first
- Repository before use case, use case before controller, controller before route
- The route and registry regeneration (T024) come before any web task that calls `tuyauQuery.users.restoreInvitation` or reads the new DTO keys
- The transformer keys (T025) come before any web test that expects them from the collection

### Parallel Opportunities

- T006, T007, and T009–T012 in Foundational (T006/T007 after T005)
- T013–T020 in US1 (eight different test files)
- T026, T027, T028, and T031 in US1 (different web files, once T024 is in)
- T032–T034 in US2 (two apps)
- T036–T039 in US3 (four different test files)
- T043–T048 in US4 (T048 after T020, same file)
- T053–T055 in US5 (three different test files)
- T057 and T058 in Polish

---

## Parallel Example: User Story 1

```bash
# The failing tests together:
Task: "guarded_write.spec.ts — PENDING, restoration columns, cancellation kept, one token"
Task: "restore.spec.ts (unit) — link issued, digest stored, envelope returned"
Task: "restore.spec.ts (integration) — 200 shape, link A refused, link B accepted, login refused"
Task: "list.spec.ts — exact key set and gating of the three keys"
Task: "invite.spec.ts — the three keys null on an invitation"
Task: "fixtures.ts — NO_LIFECYCLE keys, RESTORED_USER"
Task: "helpers.ts — restoration MSW handlers and openers"
Task: "journey.test.tsx — outcome survives the record, lands on Cancelled, history entry"

# Then, once the route and registry exist (T024), the independent web files together:
Task: "user-permissions.ts — canRestoreInvitation"
Task: "use-user-mutations.ts — restoreInvitation, gcTime 0"
Task: "activation-link-dialog.tsx + issued-activation-link.tsx + renew dialog — origin"
Task: "user-access-history.tsx — Invitation restored event"
```

## Parallel Example: User Story 3

```bash
Task: "guarded_write.spec.ts — NOT_FOUND / NOT_CANCELLED outcomes, nothing written"
Task: "restore.spec.ts (unit) — outcome → exception mapping with meta"
Task: "restore.spec.ts (integration) — 404, the three 409s, pending link still works"
Task: "refusals.test.tsx — per-status restoration sentences"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup), then Phase 2 (Foundational).
2. Phase 3 (US1): the endpoint restores, the token is replaced, the new link activates, and the
   workbench presents it once from the record.
3. **Stop and validate** with quickstart steps 1–8. At this point a cancelled invitation can already
   be brought back and its link handed out.
4. Do not ship yet. US2 (authorization) and US3 (refusals) are P1 and make the endpoint safe to
   expose.

### Incremental Delivery

1. Setup + Foundational → US1: demonstrable.
2. \+ US2 + US3: the complete P1 contract, which is the minimum mergeable increment.
3. \+ US4: the comment, the row menu, and the deliberate confirmation.
4. \+ US5: races, stale views, rollbacks, and failures proven.
5. Polish: the comment sweep, the roadmap row, the gate, the manual walkthrough, the direct API
   pass, and the fresh review. The branch is then one PR.

### Out of Scope Reminders

- No edit to `CONTEXT.md`, the ADRs, or any other slice's spec (constitution I and VI).
- No change to `userAccessActions`, `UserAccessDialog`, `user-access-copy.ts`, `ui/user-table.tsx`,
  or the wording of the existing "Restore it instead" pointers (D11, D14).
- No bulk restoration, no notification to the invited person, no identity or role edit inside the
  restoration, and no change to cancellation, renewal, removal, or acceptance behavior.
