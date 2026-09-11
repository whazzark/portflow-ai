---

description: "Task list for Cancel a Pending Invitation (GH-12)"
---

# Tasks: Cancel a Pending Invitation

**Input**: Design documents from `specs/user-administration/invitation-administration/cancel-a-pending-invitation/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [contracts/cancel-invitation-workbench.md](./contracts/cancel-invitation-workbench.md), [quickstart.md](./quickstart.md)

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
D1–D14 from [research.md](./research.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean baseline before a TDD slice, so a red test is red for the right reason

- [X] T001 Install workspace dependencies from the repository root with `pnpm install`
- [X] T002 Apply the existing migrations and confirm `apps/api/database/schema.ts` is current with `pnpm --filter @portflow/api db:migrate` (the file must show no diff afterwards). Run against a throwaway `portflow_gh12_scratch` database on the local server rather than the shared `portflow` dev database; the file showed no diff.
- [X] T003 Confirm the baseline is green with `pnpm check`, `pnpm typecheck`, and `pnpm test`, and note the pass counts so later regressions are attributable. Baseline: Biome clean (976 files), both apps typecheck, API 1156 passing, web 1175/1176. The one web failure is timing-only and pre-existing: `users/__tests__/list/scale.perf.test.tsx` (SC-003, 2 s budget) measures 2.6–3.4 s on this machine even in isolation. A second timing failure, `customers/__tests__/list/list.test.tsx`, timed out under full-suite load and passes in isolation.

**Checkpoint**: The baseline is green, so any failure from here on belongs to this feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The persistence, factory, exception, contract, authorization, and validation
declarations every story needs. They deliver no behavior on their own, so no test precedes them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create `apps/api/database/migrations/1785900000000_add_user_cancellation_comment.ts`:
  - `up()` is a plain `alterTable('users')` adding `cancellation_comment` as a nullable `text`. It has no foreign key, so SQLite adds it in place.
  - `down()` drops the column with the PostgreSQL/SQLite branch, `static disableTransactions = true`, and the `withoutForeignKeys` helper copied from `apps/api/database/migrations/1785500000000_add_user_password_renewal.ts`, because dropping a column on SQLite rebuilds `users`.
  - The class docstring states why it holds the latest cancellation only (D6).
- [X] T005 Run `pnpm --filter @portflow/api db:migrate` to apply T004 and regenerate `apps/api/database/schema.ts`, which gains `cancellationComment: string | null` on `UserSchema`. It is a generated file and must never be hand-edited.
- [X] T006 [P] Add `cancellationComment: null` to `apps/api/database/factories/user_factory.ts` wherever that file already nulls `cancelledAt`/`cancelledByUserId`: the defaults, `active`, `passwordRenewalRequired`, and `passwordReset`. Leave the `cancelled` state writing `null`, so tests merge a comment explicitly.
- [X] T007 [P] Add `UserAlreadyActivatedException` (`409`, `E_USER_ALREADY_ACTIVATED`, message `User has already activated their access; deactivate them instead`) to `apps/api/app/users/shared/user_exceptions.ts`. Its docstring records why it lives in `shared/`: GH-13 and GH-14 refuse the same target (D2, D3).
- [X] T008 [P] Declare `CancelPendingInvitationCommand` (`id`, `cancelledByUserId`, `cancelledAt`, `comment: string | null`), `CancelPendingInvitationResult` (`CANCELLED` with `user` | `NOT_FOUND` | `NOT_PENDING` with `accessStatus`), and `abstract cancelPendingInvitation(command)` in `apps/api/app/users/shared/repositories/user_repository.ts`. Model the docstring on `DeactivateUserResult`'s, and state the guard, the token deletion, and the one transaction ([data-model.md](./data-model.md#repository-contract)).
- [X] T009 [P] Add `cancelInvitation(user)` to `apps/api/app/users/shared/user_policy.ts`, returning true only for an `ACTIVE` `ORGANIZATION_ADMIN`. It is foundational rather than story-scoped so that no write endpoint is ever exposed unauthorized, even mid-branch (D7).
- [X] T010 [P] Create `apps/api/app/users/cancel_invitation/cancel_user_invitation_validator.ts` exporting `cancelUserInvitationValidator = vine.create({ params: vine.object({ id: vine.string().uuid() }), comment: lifecycleComment() })`, with `lifecycleComment` from `#shared/validators/lifecycle_validator`. The docstring carries the `uuid`/`22P02` reason from `deactivate_user_validator.ts` and states that the body is optional.

**Checkpoint**: The schema, factory, exception, repository contract, policy, and validator are in place, so story work can begin

---

## Phase 3: User Story 1 - Withdraw an Invitation Before It Is Accepted (Priority: P1) 🎯 MVP

**Goal**: An organization admin cancels a pending user's invitation. The user becomes cancelled
with a dated, attributed event, the activation link stops existing, and the workbench shows the
user moving from Pending to Cancelled.

**Independent Test**: As an organization admin, cancel a pending user who holds an activation token,
through the API and then through the workbench. Assert the following:
- the status is `CANCELLED`, and `cancelledAt`/`cancelledBy` name the requester;
- identity, role, and the invitation event are unchanged;
- no token row remains, and sign-in with that email is refused;
- the workbench stays on Pending, closes the record, updates both counts, and lists the user under
  Cancelled.

### Tests for User Story 1 ⚠️

> Write these first and watch them fail

- [X] T011 [P] [US1] Create `apps/api/tests/unit/users/invitation_cancellation/guarded_write.spec.ts`, which exercises `cancelPendingInvitation` against SQLite (ADR-0014).
  - Setup: an `invited` user plus a `UserActivationTokenFactory` row.
  - Assert: one call returns `CANCELLED`; the row holds `CANCELLED`, `cancelledAt`, `cancelledByUserId`, and the given comment; `updatedAt` moved.
  - Assert: identity, role, `password` (null), `invitedAt`, and `invitedByUserId` are untouched.
  - Assert: the user's `user_activation_tokens` row is gone, and every access-history actor is preloaded on the returned user.
  - Model the group on `apps/api/tests/unit/users/deactivation/guarded_write.spec.ts` (FR-002, FR-003, FR-004, FR-005).
- [X] T012 [P] [US1] Create `apps/api/tests/unit/users/invitation_cancellation/cancel.spec.ts` for the happy path: `CancelUserInvitationUseCase.handle({ id, cancelledByUserId, cancelledAt, comment })` passes the actor, the instant, and the comment to the repository and returns the cancelled user (FR-001).
- [X] T013 [P] [US1] Create `apps/api/tests/integration/users/invitation_cancellation/cancel.spec.ts` with the success contract, in request-flow order per `apps/api/tests/README.md`:
  - An organization admin's `POST /api/v1/users/:id/cancel-invitation` returns `200` with the [contracts/http-api.md](./contracts/http-api.md#success--200) shape: `accessStatus: 'CANCELLED'`, `cancelledBy` the requester, `invitedAt`/`invitedBy` unchanged, `cancellationComment` present, and no activation link or credential in the body.
  - The token row is gone, and `POST /api/v1/auth/login` with that email is refused with the invalid-credentials outcome (FR-017).
  - An operations admin's `GET /api/v1/users` does not list the user (FR-018).
- [X] T014 [P] [US1] Add `cancellationComment: null` to every user fixture in `apps/web/src/features/users/__tests__/support/fixtures.ts`, give the existing `cancelled-1` fixture a comment, and add a second pending fixture for journey tests if `pending-1` is reused elsewhere with conflicting expectations. Leave the key absent from the `*_WITHOUT_LIFECYCLE` projections.
- [X] T015 [P] [US1] Create `apps/web/src/features/users/__tests__/cancel-invitation/journey.test.tsx`, rendered through the real router with an MSW handler for `POST /api/v1/users/:id/cancel-invitation`. From the pending view, open the pending user's record, click **Cancel invitation**, and confirm. Assert:
  - the toast `Invitation for “<name>” cancelled`;
  - the record is closed, and the Pending tab is still selected;
  - both counts are updated, and the user appears in Cancelled;
  - opening them there shows the **Cancelled** history entry with actor and date.

  This covers US1-1, US1-3, US1-4, and FR-013 per [the workbench contract](./contracts/cancel-invitation-workbench.md#outcomes).

### Implementation for User Story 1

- [X] T016 [US1] Implement `cancelPendingInvitation` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts` (D4):
  - Inside `User.transaction`, run a guarded `UPDATE … WHERE id = ? AND access_status = 'PENDING'` setting `accessStatus: 'CANCELLED'`, `cancelledAt`, `cancelledByUserId`, `cancellationComment`, and `updatedAt` by hand (the query builder bypasses the auto-update hook).
  - On one affected row, delete that user's `user_activation_tokens` row through `UserActivationToken.query({ client: trx })`, then reload through `preloadAccessHistory` and return `CANCELLED`.
  - The docstring explains the guard, the transaction, and why the token is deleted rather than flagged.
  - Depends on T008.
- [X] T017 [US1] Create `apps/api/app/users/cancel_invitation/cancel_user_invitation_use_case.ts` (`@inject()`, `CancelUserInvitationInput` of `{ id, cancelledByUserId, cancelledAt, comment?: string | null }`). It calls `userRepository.cancelPendingInvitation` and returns `result.user` on `CANCELLED`. Refusal mapping is US3's T034; until then, throw `UserNotFoundException` for any other outcome. Depends on T016.
- [X] T018 [US1] Add `cancelInvitation` to `apps/api/app/controllers/users_controller.ts`. Depends on T017.
  - Authorize first with `bouncer.with(UserPolicy).authorize('cancelInvitation')`, then validate with `request.validateUsing(cancelUserInvitationValidator, { data: { ...request.body(), params } })`.
  - Call the use case with `cancelledByUserId: viewer.id` and `cancelledAt: DateTime.now()`.
  - Serialize through `UserTransformer` with `includeAccessHistory: true` and the `toAdministration` variant.
  - Inject the use case in the constructor. The docstring says why authorization comes first (FR-009).
- [X] T019 [US1] Declare `router.post('/:id/cancel-invitation', [controllers.Users, 'cancelInvitation']).as('cancel_invitation')` inside the existing `/users` group in `apps/api/start/routes.ts`, beside `deactivate`. Then regenerate the typed client registry by running any `node ace` command (for example `pnpm --filter @portflow/api test unit`), so `apps/api/.adonisjs/client/` gains `users.cancel_invitation`. Commit the regenerated files. Depends on T018. (Done: neither `ace test` nor `ace build` runs Tuyau's `generateRegistry` init hook; it ran by starting `ace serve` briefly against the scratch database.)
- [X] T020 [US1] Add `cancellationComment: this.when(includeAccessHistory, () => this.resource.cancellationComment)` next to `cancelledBy` in `toAdministration()` in `apps/api/app/users/shared/transformers/user_transformer.ts`. Leave `toObject()` unchanged (D9).
- [X] T021 [P] [US1] Extend `apps/web/src/features/users/helpers/user-access-copy.ts` (D11):
  - `UserAccessAction = 'deactivate' | 'cancel-invitation'`.
  - Labels `Cancel invitation`, pending `Cancelling…`, and a new `USER_ACCESS_DISMISS_LABELS` (`deactivate: 'Cancel'`, `'cancel-invitation': 'Keep invitation'`).
  - `userAccessDialogTitle` per action (`Deactivate user?` unchanged, `Cancel invitation?`), and `describeUserAccessEffect` per action (the cancellation sentence of the workbench contract).
  - Success and failure shapes per action: `confirmationMessage('invitation for', name, 'cancelled')` and `refusalTitle('cancel', namedRecord('invitation for', name))`.
  - Update the header docstring.
- [X] T022 [P] [US1] Add `cancelInvitation` to `apps/web/src/features/users/mutations/use-user-mutations.ts`: `useMutation(tuyauQuery.users.cancelInvitation.mutationOptions({ onSuccess: () => refreshUsers(), onError: () => refreshUsers() }))`, returned alongside the others, with the `deactivate` docstring's reason for refreshing on error. Depends on T019.
- [X] T023 [US1] In `apps/web/src/features/users/user-access.tsx`, make `userAccessActions` return `['cancel-invitation']` for an `ORGANIZATION_ADMIN` viewer on a `PENDING` user, keeping the deactivation rule unchanged. Add `'cancel-invitation': 'destructive'` to `USER_ACCESS_ACTION_VARIANTS`, and update the docstring's list of conditions. Depends on T021.
- [X] T024 [US1] Make `UserAccessDialog` in `apps/web/src/features/users/user-access.tsx` action-aware: pick the mutation by action, the title, effect, confirm/pending labels, and dismiss label from T021, and the success toast per action. Keep deactivation rendering and behavior byte-identical, which its existing tests pin. Depends on T021, T022, T023.
- [X] T025 [US1] Update the component docstring of `apps/web/src/features/users/ui/user-access-record.tsx`, which still says cancellation "is not offered here". Confirm that `ui/user-access-actions.tsx` and `ui/user-row-actions.tsx` need no code change, because both render whatever `userAccessActions` returns.

**Checkpoint**: An organization admin can cancel a pending invitation from the record, and the API and the journey tests are green. US1 is demonstrable on its own.

---

## Phase 4: User Story 2 - Keep Cancellation Restricted to the Administrators Responsible for User Access (Priority: P1)

**Goal**: Only an active organization admin may cancel. Every other requester is refused before the
target is read, and the workbench offers the action only where the API would accept it.

**Independent Test**: Issue the cancellation unauthenticated, and as an operations admin, operations
lead, observer, and a non-active organization admin, against a pending, an unknown, and a malformed
id. Assert `401`/`403` in every case, with the same body regardless of target, and nothing written.
In the workbench, assert the action appears only for an organization admin on a pending user.

### Tests for User Story 2 ⚠️

- [X] T026 [P] [US2] Extend `apps/api/tests/integration/users/invitation_cancellation/cancel.spec.ts` with the authorization matrix, first in request-flow order:
  - `401 E_UNAUTHORIZED_ACCESS` without a session.
  - `403 E_AUTHORIZATION_FAILURE` for an operations admin, operations lead, and observer; an organization admin whose own status is not active holds no session (GH-3) and gets `401`, as the contract now states. Each targets a pending id, an unknown uuid, and a non-uuid id, and the three bodies must be identical.
  - The pending target's status and token must be unchanged after every attempt.
  - Covers FR-008, FR-009, and SC-001.
- [X] T027 [P] [US2] Create `apps/web/src/features/users/__tests__/cancel-invitation/permissions.test.tsx`:
  - An organization admin sees **Cancel invitation** in the record footer and the row menu of a pending user.
  - Absent on active, deactivated, and cancelled users.
  - Absent for an operations admin, who sees no pending user at all.
  - Covers FR-010, US2-3, and US2-4.

### Implementation for User Story 2

- [X] T028 [US2] Confirm that `cancelInvitation` in `apps/api/app/controllers/users_controller.ts` authorizes before validating and before any repository call, and that T026 passes without further change. The policy (T009) and the offer rule (T023) carry this story. If T026 exposes an ordering gap, fix it here and record why in the action's docstring. Depends on T018, T026.

**Checkpoint**: The endpoint is safe to expose, and the workbench never offers what the API refuses.

---

## Phase 5: User Story 3 - Refuse a Cancellation That Does Not Apply (Priority: P1)

**Goal**: Only a pending user can be cancelled. Active, deactivated, already cancelled, and unknown
targets are each refused with their own code and sentence, and nothing changes.

**Independent Test**: Cancel an active user (including the requester), a deactivated user, a cancelled
user carrying a first cancellation's comment, and an unknown uuid. Assert `409
E_USER_ALREADY_ACTIVATED`, `409 E_USER_ALREADY_DEACTIVATED`, `409 E_USER_CANCELLED_INVITATION`, and
`404 E_USER_NOT_FOUND` respectively. Assert that every targeted row, its event columns including the
first comment, and any token are unchanged, and that the workbench shows each refusal's sentence.

### Tests for User Story 3 ⚠️

- [X] T029 [P] [US3] Extend `apps/api/tests/unit/users/invitation_cancellation/guarded_write.spec.ts` with the refusal outcomes. Assert:
  - an unknown id returns `NOT_FOUND`;
  - `ACTIVE`, `DEACTIVATED`, and `CANCELLED` targets return `NOT_PENDING` with that status;
  - each refused row is unchanged (the prior `cancelledAt`/`cancelledByUserId`/`cancellationComment` of an already cancelled user included);
  - the token of a pending user is never touched by a refusal of another user.

  Covers FR-006 and US3-5.
- [X] T030 [P] [US3] Extend `apps/api/tests/unit/users/invitation_cancellation/cancel.spec.ts` with the mapping: `NOT_FOUND` → `UserNotFoundException`; `NOT_PENDING` + `ACTIVE` → `UserAlreadyActivatedException`; `+ DEACTIVATED` → `UserAlreadyDeactivatedException`; `+ CANCELLED` → `UserCancelledInvitationException` (FR-007).
- [X] T031 [P] [US3] Extend `apps/api/tests/integration/users/invitation_cancellation/cancel.spec.ts` with the `404` and the three `409`s of [contracts/http-api.md](./contracts/http-api.md#refusals). One case targets the requester's own id and expects `E_USER_ALREADY_ACTIVATED` (D8). Assert every row is unchanged afterwards.
- [X] T032 [P] [US3] Create `apps/web/src/features/users/__tests__/cancel-invitation/refusals.test.tsx`. Assert:
  - each of `E_USER_ALREADY_ACTIVATED`, `E_USER_ALREADY_DEACTIVATED`, `E_USER_CANCELLED_INVITATION`, and `E_USER_NOT_FOUND` shows the error title `Unable to cancel invitation for “<name>”` with its cancellation sentence from the workbench contract;
  - the collection is refetched after a refusal;
  - an unmapped code falls back to the API message.

### Implementation for User Story 3

- [X] T033 [US3] Extend `cancelPendingInvitation` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`: on a zero-row update, re-read the row inside the transaction and return `NOT_PENDING` with its `accessStatus` or `NOT_FOUND`, writing and deleting nothing. The comment notes that the re-read names the reason and never decides the outcome. Same method as T016.
- [X] T034 [US3] Replace T017's provisional refusal in `apps/api/app/users/cancel_invitation/cancel_user_invitation_use_case.ts` with the T030 mapping, ending in an exhaustive branch over the three `NOT_PENDING` statuses so a future status is a type error. Depends on T007, T033.
- [X] T035 [US3] In `apps/web/src/features/users/helpers/user-access-copy.ts`, key the refusal table by action (`Record<UserAccessAction, Record<string, string>>`) and change `describeUserAccessRefusal(action, code, message)`. The deactivation sentences stay unchanged; add the cancellation sentences of [the HTTP contract](./contracts/http-api.md#refusals). Update the one caller in `apps/web/src/features/users/user-access.tsx` (D11).

**Checkpoint**: The access status only moves `PENDING → CANCELLED`, and every other attempt is refused distinctly, with nothing written.

---

## Phase 6: User Story 4 - Confirm Before Withdrawing Access (Priority: P2)

**Goal**: The confirmation names the user, states the consequence, offers an optional comment of at
most 1,000 characters, and reads **Keep invitation** / **Cancel invitation**. Dismissing records
nothing, and the stored comment is trimmed, or `null` when blank.

**Independent Test**: Open the confirmation and assert its title, description, comment field, and
labels. Dismiss it after typing and assert that no request was sent and that the comment is empty on
reopening. Confirm with `  padded  `, with spaces only, and with nothing, and assert the stored
comment is `padded`, `null`, and `null`. Submit 1,001 characters directly to the API and assert
`422` with nothing written. Assert the Cancelled history entry shows the comment.

### Tests for User Story 4 ⚠️

- [X] T036 [P] [US4] Extend `apps/api/tests/unit/users/invitation_cancellation/cancel.spec.ts`: the use case passes `'padded'` for `'  padded  '`, and `null` for `'   '`, `''`, `null`, and an omitted comment (FR-003a).
- [X] T037 [P] [US4] Extend `apps/api/tests/integration/users/invitation_cancellation/cancel.spec.ts` with the comment contract:
  - a padded comment is stored and returned trimmed;
  - an omitted body is accepted with `cancellationComment: null`;
  - exactly 1,000 characters are accepted;
  - 1,001 characters are refused `422 E_VALIDATION_ERROR` on field `comment`, with the user still pending and the token intact.
- [X] T038 [P] [US4] Create `apps/web/src/features/users/__tests__/cancel-invitation/confirmation.test.tsx`. Assert:
  - the title `Cancel invitation?` and the description naming the user and stating the link stops working (FR-011);
  - a `Comment (optional)` field limited to 1,000 characters;
  - buttons `Keep invitation` and `Cancel invitation`, with no other button starting with "Cancel" (FR-011a);
  - `Keep invitation`, Escape, and the overlay each send no request and discard the typed comment (US4-2);
  - the confirm button reads `Cancelling…` and is disabled while the request is pending (US4-4);
  - the request body carries the typed comment, or `null` when the field is empty;
  - the deactivation confirmation still shows no comment field and a `Cancel` dismiss.
- [X] T039 [P] [US4] Extend `apps/web/src/features/users/__tests__/cancel-invitation/journey.test.tsx`: after a cancellation with a comment, the **Cancelled** history entry shows the comment line, and a cancellation without one shows no comment line (FR-014).

### Implementation for User Story 4

- [X] T040 [US4] Normalize the comment in `apps/api/app/users/cancel_invitation/cancel_user_invitation_use_case.ts` with `input.comment?.trim() || null` before the repository call, as `ArchiveCustomerUseCase` does (D6). Depends on T017.
- [X] T041 [US4] Add the comment field to `UserAccessDialog` in `apps/web/src/features/users/user-access.tsx`, only for actions that carry one. Declare that per action in `helpers/user-access-copy.ts`, true for `'cancel-invitation'` only.
  - Render a `Field` with `LIFECYCLE_COMMENT_LABEL`, a `Textarea` with `maxLength={1000}` and a `useId()` id, and `LIFECYCLE_COMMENT_DESCRIPTION`, all from `@/components/lifecycle/lifecycle-copy`.
  - The value is held in local state, discarded on close, and sent as `comment || null` in the mutation body.
  - Depends on T024.
- [X] T042 [P] [US4] Add the comment to the **Cancelled** event in `apps/web/src/features/users/ui/user-access-history.tsx`. Give `AccessEvent` an optional `comment`, read `user.cancellationComment` uncast off the DTO, and render it as a quoted line under the actor only when it is a non-empty string.

- [X] T053 [US4] Show the cancellation comment in place of the password column in the cancelled view (FR-014a, decided while testing), via the per-view column mapping in `apps/web/src/features/users/ui/user-table.tsx`. Covered by `apps/web/src/features/users/__tests__/cancel-invitation/collection.test.tsx`, written first and watched fail: the cancelled view shows `Comment` and no `Password`, the other three views keep `Password`, and a just-cancelled user appears with their comment.

- [X] T054 [US4] Show when and by whom each user was invited in place of the password column in the pending view (FR-014b, decided while testing), via `COLUMNS_BY_VIEW` in `apps/web/src/features/users/ui/user-table.tsx`, which replaces T053's `columnsFor`. Covered in `apps/web/src/features/users/__tests__/cancel-invitation/collection.test.tsx`, written first and watched fail: `Invited` and no `Password` in the pending view, the date and `by Yann Le Goff` on the pending row, and `Password` kept in the active and deactivated views.

**Checkpoint**: The confirmation is complete and deliberate, and the comment round-trips from the dialog to the access record.

---

## Phase 7: User Story 5 - Resolve Races and Failures Without Leaving Half-Withdrawn Access (Priority: P2)

**Goal**: Concurrent, stale, repeated, and failed cancellations each end in exactly one consistent
state, and the administrator can read what happened and retry.

**Independent Test**: Fire two cancellations of one pending user at once and assert one `200`, one
`409 E_USER_CANCELLED_INVITATION`, and the winner's event and comment stored. Cancel from a stale
workbench and assert the refusal and refresh. Fail the request at the network layer and assert that
the dialog and comment remain and that a retry succeeds. Repeat from the row menu.

### Tests for User Story 5 ⚠️

- [X] T043 [P] [US5] Extend `apps/api/tests/unit/users/invitation_cancellation/guarded_write.spec.ts`: a second `cancelPendingInvitation` on the same user returns `NOT_PENDING`/`CANCELLED` and leaves the first call's `cancelledAt`, `cancelledByUserId`, and `cancellationComment` in place (FR-015).
- [X] T044 [P] [US5] Extend `apps/api/tests/integration/users/invitation_cancellation/cancel.spec.ts` with two concurrent requests from two organization admins, via `Promise.all`, on one pending user. Assert exactly one `200` and one `409 E_USER_CANCELLED_INVITATION`, and that the stored actor and comment are the `200`'s (SC-004).
- [X] T045 [P] [US5] Create `apps/web/src/features/users/__tests__/cancel-invitation/recovery.test.tsx`:
  - a network error (MSW `HttpResponse.error()`) and a `500` keep the dialog open with the typed comment and the confirm button re-enabled;
  - a second click after the handler is restored succeeds with exactly one cancellation recorded (US5-3, US5-4, FR-016);
  - a `422` keeps the dialog and comment and shows the field-level message.
- [X] T046 [P] [US5] Create `apps/web/src/features/users/__tests__/cancel-invitation/row-menu.test.tsx`:
  - the row menu's **Cancel invitation** opens the same confirmation and produces the same outcome (FR-012);
  - on an `E_USER_CANCELLED_INVITATION` refusal, the row menu's dialog stays open with the reason while the collection refreshes (US5-2).

### Implementation for User Story 5

- [X] T047 [US5] Confirm that T043–T046 pass on the guard (T016, T033), the error-path refresh (T022), and the refusal-keeps-dialog behavior of `UserAccessDialog` (T024) with no second mechanism. If any case needed a change in `apps/web/src/features/users/user-access.tsx`, such as re-enabling the confirm button after a network failure, record why in the component docstring. Depends on T016, T022, T024, T033, T041.

**Checkpoint**: No outcome leaves a cancelled user with a live link or two events for one withdrawal, and every failure is readable and retryable.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T048 [P] Update the `GH-12` row in `specs/user-administration/invitation-administration/roadmap.md` from `planned` to its delivered status
- [X] T049 Run the full gate from the repository root, `pnpm check`, `pnpm typecheck`, and `pnpm test`, and record the pass counts against T003's baseline. Result: Biome clean (988 files), both apps typecheck, API 1186/1186 (+30), web 1207/1207 (+31) run on its own. The exhaustive key-set test in `tests/integration/users/consultation/list.spec.ts` was updated for `cancellationComment` on purpose. Running the web suite at the same time as the API suite produced 9 timing-only failures in unrelated features, all green when run alone.
- [X] T050 Walk the browser journey in [quickstart.md](./quickstart.md#validate-by-hand), steps 1–10, against a running API and web app with a seeded database. Done with Playwright against a throwaway `portflow_gh12_scratch` database, dropped afterwards. Steps 1–9 passed on the real app: invite, then the confirmation with its labels and comment; dismissal sends nothing and discards the comment; the toast; Pending stays selected while the record closes and the counts update; the Cancelled history shows the trimmed comment; the token is gone; the row-menu cancellation works without a comment; and a stale workbench gets the "already cancelled by someone else" refusal and then refreshes. Step 7 (login refused) and step 10 (operations admin sees no pending or cancelled users) were checked through the API in T051 rather than the browser. The walkthrough found one real gap: the invitation response omitted the new `cancellationComment` key, because `LucidUserRepository.invite()` writes every lifecycle column as an explicit null and the new column was missing from that list. It is fixed, and `tests/integration/users/invitation/invite.spec.ts` now asserts the key.
- [X] T051 Exercise the endpoint directly per [quickstart.md](./quickstart.md#validate-the-api-directly) as each unauthorized role and against each target status, confirming the workbench is never the only thing enforcing a rule (FR-010). Done with curl against the running API. Results: operations admin `403` with an identical body for a pending, an unknown, and a malformed id; unauthenticated `401`; over-long comment `422` on field `comment`; own access `409 E_USER_ALREADY_ACTIVATED`; unknown `404`; success `200` with a trimmed comment and no activation link in the body; a repeat `409 E_USER_CANCELLED_INVITATION`; login with the cancelled email `401 E_LOGIN_INVALID_CREDENTIALS`; the operations admin collection omits the user; the token row count is 0.
- [ ] T052 Obtain a fresh read-only review of the final diff, and resolve or explicitly justify every confirmed finding (constitution VII) — **still owed**: a human-triggered review that cannot be self-certified here.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: needs Setup, and blocks every story. T005 needs T004. T006 needs T005 (the factory writes the new column). T007–T010 are independent of each other.
- **US1 (Phase 3)**: needs Foundational. This is the MVP.
- **US2 (Phase 4)**: needs US1's controller (T018) and offer rule (T023). Its tests can be written as soon as T019 lands.
- **US3 (Phase 5)**: needs US1. T033 extends T016's method, and T034 replaces T017's provisional branch.
- **US4 (Phase 6)**: needs US1. T040 edits T017's use case, and T041 extends T024's dialog. It is independent of US2 and US3.
- **US5 (Phase 7)**: needs US1 and US3 (the `409` it asserts), plus US4's T041 for the comment kept on failure.
- **Polish (Phase 8)**: needs every story.

### Honest note on story independence

US2 to US5 harden the endpoint and dialog US1 creates, and they share its files. Most of them are
sequential on the API side. Two real parallel lanes exist once US1 lands:
- the **API lane**: US2 → US3 → US5 API tests;
- the **web lane**: US4's dialog and history work, then US3's refusal copy (T035) and US5's web tests.

### Within Each Story

- The failing test always comes first
- Repository before use case, use case before controller, controller before route
- The route and registry regeneration (T019) come before any web task that calls `tuyauQuery.users.cancelInvitation`
- The transformer key (T020) comes before any web task that reads `cancellationComment`

### Parallel Opportunities

- T006–T010 in Foundational (after T005 for T006)
- T011–T015 in US1 (five different test files)
- T021 and T022 in US1 (different web files, once T019 is in)
- T026 and T027 in US2 (different apps)
- T029–T032 in US3 (four different test files)
- T036–T039 in US4, and T042 with T040/T041
- T043–T046 in US5 (four different test files)

---

## Parallel Example: User Story 1

```bash
# The failing tests together:
Task: "guarded_write.spec.ts — status, event, comment written; token deleted"
Task: "cancel.spec.ts (unit) — use case happy path"
Task: "cancel.spec.ts (integration) — 200 shape, token gone, login refused"
Task: "fixtures.ts — cancellationComment on every fixture"
Task: "journey.test.tsx — toast, record closed, counts, Cancelled view"

# Then, once the route and registry exist (T019), the independent web files together:
Task: "user-access-copy.ts — cancel-invitation labels, title, effect, dismiss"
Task: "use-user-mutations.ts — cancelInvitation with refresh on success and error"
```

## Parallel Example: User Story 3

```bash
Task: "guarded_write.spec.ts — NOT_FOUND / NOT_PENDING outcomes, nothing written"
Task: "cancel.spec.ts (unit) — outcome → exception mapping"
Task: "cancel.spec.ts (integration) — 404 and the three 409s"
Task: "refusals.test.tsx — per-code cancellation sentences"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup), then Phase 2 (Foundational).
2. Phase 3 (US1): the endpoint cancels, the token disappears, and the workbench shows the move.
3. **Stop and validate** with quickstart steps 1–7. At this point a pending user can already be
   withdrawn, and the dialog has its final labels.
4. Do not ship yet. US2 (authorization) and US3 (refusals) are P1 and make the endpoint safe to
   expose.

### Incremental Delivery

1. Setup + Foundational → US1: demonstrable.
2. \+ US2 + US3: the complete P1 contract, which is the minimum mergeable increment.
3. \+ US4: the comment and the deliberate confirmation.
4. \+ US5: races, stale views, and failures proven.
5. Polish: the gate, the manual walkthrough, the direct API pass, the roadmap row, and the fresh
   review. The branch is then one PR.

### Out of Scope Reminders

- No edit to the GH-8, GH-9, or GH-13 specs. Their obligations are recorded in
  [contracts/http-api.md](./contracts/http-api.md#obligations-on-later-slices), and constitution
  principle I forbids revising a spec whose issue is not selected.
- No bulk cancellation, no notification to the invited person, and no change to deactivation
  behavior.
