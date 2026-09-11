---

description: "Task list for Accept an Invitation and Open an Authenticated Session"
---

# Tasks: Accept an Invitation and Open an Authenticated Session

**Input**: Design documents from
`/specs/user-administration/invitation-onboarding/accept-an-invitation-and-open-an-authenticated-session/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV makes RED → GREEN → REFACTOR binding, and D13 fixes
the verification seams:

- Japa unit tests for the use-case decision order and for the repository's guarded write, against
  SQLite (ADR-0014).
- Japa integration tests for both endpoints, covering the unusable-link matrix, validation, the
  session-open refusal, concurrency, and the session-not-opened answer.
- Vitest feature tests that render the real route tree with MSW, covering the activation screen's
  states.

`apps/web/e2e` does not exist, so this slice adds no end-to-end journey.

**Organization**: Tasks are grouped by user story, so each story can be implemented, tested, and
demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task serves (US1–US5)
- Every description gives the exact file path

## Path Conventions

This is a web application monorepo: `apps/api/` (AdonisJS 7) and `apps/web/` (TanStack Start), per
plan.md's Structure Decision.

- **API**: a new vertical slice under `app/auth/invitation_acceptance`, whose persistence joins the
  existing `UserRepository`.
- **Web**: a new `_activation` pathless layout and route, whose screen lives in the existing
  `src/features/auth` module.
- **Schema**: no migration.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the slice and test directories

- [X] T001 [P] Create the API slice and test directories `apps/api/app/auth/invitation_acceptance/`, `apps/api/tests/unit/auth/invitation_acceptance/`, and `apps/api/tests/integration/auth/invitation_acceptance/`
- [X] T002 [P] Create the web directories `apps/web/src/routes/_activation/`, `apps/web/src/features/auth/helpers/`, `apps/web/src/features/auth/queries/`, and `apps/web/src/features/auth/__tests__/activation/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Every story needs the following, so this phase builds it:

- the two extractions (the open-session probe and the password rule), whose behavior is guarded by
  the existing suites;
- the shared digest;
- the exceptions and the preview projection;
- the repository's usable-link read and its guarded acceptance write;
- a test helper that issues a link with a known secret.

This phase exposes no endpoint and no screen.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Create `apps/api/app/auth/shared/new_password_rule.ts` exporting the `password` rule (`vine.string().minLength(12).maxLength(128).confirmed({ as: 'passwordConfirmation' })`, **no** `.trim()`) and the `passwordConfirmation` rule (`vine.string()`). Move the explanatory comment from `apps/api/app/auth/password_renewal/password_renewal_validator.ts`, and make `passwordRenewalValidator` compose the shared fields with no behavior change. Run `tests/integration/auth/password_renewal.spec.ts` and confirm it passes unchanged (D8).
- [X] T004 [P] Create `apps/web/src/features/auth/helpers/new-password-schema.ts` exporting the blur schema (12–128 characters with the existing messages, and a non-empty confirmation) and the submit schema (the `refine` reporting "Passwords do not match." on `passwordConfirmation`), both moved out of `apps/web/src/features/auth/ui/password-renewal-form.tsx`. Make that form import them with no behavior change, and confirm `apps/web/src/features/auth/__tests__/password-renewal/*.test.tsx` pass unchanged (D8).
- [X] T005 [P] Create `apps/api/app/auth/shared/open_session.ts` exporting `resolveOpenSessionUser(ctx: HttpContext): Promise<User | null>`, which holds three things moved out of `apps/api/app/middleware/auth_middleware.ts`:
  - the session guard check, including the restore from `remember_web` and the `REMEMBERED_CONNECTION_EXPIRES_AT_SESSION_KEY` bookkeeping;
  - the fixed-expiry check;
  - the `accessStatus === 'ACTIVE'` re-read.

  It returns `null` wherever the middleware used to throw. Make `AuthMiddleware.handle` call it and throw the same `E_UNAUTHORIZED_ACCESS('Invalid or expired user session', { guardDriverName: 'session' })` on `null`, with no behavior change. Run `tests/integration/auth/**` and `tests/integration/users/**`, and confirm they pass unchanged (D7).
- [X] T006 [P] Export `digestActivationSecret(secret: string): string` (SHA-256, hex) from `apps/api/app/users/shared/activation_link_issuer.ts`, make `issue()` use it, and confirm `apps/api/tests/unit/users/invitation/activation_link_issuer.spec.ts` passes unchanged (D3).
- [X] T007 [P] Create `apps/api/app/auth/invitation_acceptance/invitation_acceptance_exceptions.ts` with the three exceptions of [data-model.md](./data-model.md):
  - `ActivationLinkUnusableException`: `404`, `E_ACTIVATION_LINK_UNUSABLE`, "This activation link cannot be used".
  - `InvitationAcceptanceSessionOpenException`: `409`, `E_INVITATION_ACCEPTANCE_SESSION_OPEN`, "Log out before activating this access".
  - `InvitationAcceptedSessionNotOpenedException`: `500`, `E_INVITATION_ACCEPTED_SESSION_NOT_OPENED`, "Your access is active. Log in with your new password".

  None carries `meta`. Document on the first why the body is identical for every reason (clarification 3, D4), and on the third why it is reported (D9).
- [X] T008 [P] Add `toActivationPreview()` to `apps/api/app/users/shared/transformers/user_transformer.ts`, returning exactly `firstName`, `lastName`, `email` via `this.pick`. Leave `toObject()` and `toAdministration()` untouched.
- [X] T009 [P] Add to `apps/api/app/users/shared/repositories/user_repository.ts` the `AcceptInvitationCommand` type `{ tokenHash: string; hashedPassword: string; acceptedAt: DateTime }` and the `AcceptInvitationResult` type `{ kind: 'ACCEPTED'; user: User } | { kind: 'UNUSABLE' }`. Also add the abstract signatures `findPendingByActivationTokenHash(hash: string, now: DateTime): Promise<User | null>` and `acceptInvitation(command: AcceptInvitationCommand): Promise<AcceptInvitationResult>`, with doc comments stating the usability rule (D3) and that the guarded delete is the concurrency control (D5).
- [X] T010 [P] Create `apps/api/tests/support/activation_links.ts` exporting `issueActivationLink(user: User, options?: { expired?: boolean }): Promise<{ token: string }>`. It generates a known secret, then persists it through `UserActivationTokenFactory.merge({ userId: user.id, hash: digestActivationSecret(token) })`, applying the `expired` state when asked. That way every test can present a real link without the factory ever retaining a secret (depends on T006).
- [X] T011 Write the repository tests in `apps/api/tests/unit/auth/invitation_acceptance/accept_invitation_write.spec.ts`, against SQLite, and confirm they FAIL. Use `testUtils.db().wrapInGlobalTransaction()` and the T010 helper.
  - **Usable-link read.** `findPendingByActivationTokenHash` returns the pending user for a matching, unexpired token. It returns `null` for an unknown digest, an expired token, and a token whose user is `ACTIVE`, `CANCELLED`, or `DEACTIVATED`.
  - **Successful acceptance.** `acceptInvitation` deletes the token row. It sets `access_status = 'ACTIVE'`, the given password hash, `activated_at = acceptedAt`, and `activated_by_user_id` = the user's own id. It leaves `password_renewal_required_at` null, and identity, email, role, `invited_at`, and `invited_by_user_id` unchanged.
  - **Refusals.** It returns `UNUSABLE` for an unknown digest and for a token that expired before `acceptedAt`. For a token whose user is not `PENDING` it also returns `UNUSABLE`, and the token row **still exists** afterwards, proving the rollback.
  - **Race.** A second `acceptInvitation` with the same digest returns `UNUSABLE`.
- [X] T012 Implement `findPendingByActivationTokenHash` and `acceptInvitation` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts` (D5), until T011 passes (depends on T009, T011):
  - **The read** joins `user_activation_tokens` to `users` on `hash`, with `expires_at > now` and `access_status = 'PENDING'`.
  - **The write** is one `User.transaction`, in three steps:
    1. A guarded `DELETE FROM user_activation_tokens WHERE hash = ? AND expires_at > ?`. It must affect exactly one row; select the token's `user_id` first, inside the transaction.
    2. A guarded `UPDATE users … WHERE id = ? AND access_status = 'PENDING'`. It must also affect exactly one row, and writes `updatedAt` by hand as every guarded write in the file does.
    3. A re-read through `preloadAccessHistory`.
  - **Rollback.** Either zero-row outcome rolls back and returns `UNUSABLE`: throw a private sentinel inside the transaction and catch it outside.
  - **Doc comment.** Explain why the delete, not a lock, is the concurrency control on both dialects.

**Checkpoint**: A link can be recognized as usable and consumed atomically in code. The session probe
and the password rule have one home each. Nothing new is reachable over HTTP or in the browser yet.

---

## Phase 3: User Story 1 - Activate One's Access and Land in the Application Signed In (Priority: P1) 🎯 MVP

**Goal**: An invited person opens their link in a browser holding no session and sees whose access
it activates. They choose a valid password, become `ACTIVE` with a self-attributed activation event,
and land on the rotations view with a temporary session. The link is gone from their history.

**Independent Test**:

1. Invite a person and capture the link.
2. Open it in a browser with no session and choose a valid password.
3. Verify the landing as the invited user, the `ACTIVE` status with its activation event, and a
   successful login with the same password after logging out.

### Tests for User Story 1 ⚠️

> Write these first and confirm they FAIL before implementing

- [X] T013 [P] [US1] Unit test in `apps/api/tests/unit/auth/invitation_acceptance/accept_invitation.spec.ts`:
  - `PreviewInvitationUseCase` returns the pending user for a usable token.
  - `AcceptInvitationUseCase`, with `signedInUserId: null` and a usable token, returns the activated user: its `password` verifies against the submitted one through `hash.verify`, and its `activatedAt` equals the given `acceptedAt`.

  Build the use cases through `app.container.make`, as `tests/unit/auth/renew_password_use_case.spec.ts` does.
- [X] T014 [P] [US1] Integration test in `apps/api/tests/integration/auth/invitation_acceptance/accept.spec.ts`:
  - **Preview.** `POST /api/v1/auth/invitation-acceptance/preview` answers `200` with `data` holding exactly `firstName`, `lastName`, `email`. Calling it twice changes nothing: the user is still `PENDING` and the token row still exists.
  - **Acceptance.** `POST /api/v1/auth/invitation-acceptance` answers `200` with the `toObject()` projection: `accessStatus: 'ACTIVE'`, `activatedByUserId` equal to the user's id, `passwordRenewalRequired: false`, and no `password`. `assertSession('auth_web', user.id)` holds, `remember_web` is not set, and the token row is deleted.
  - **Login afterwards.** `POST /api/v1/auth/login` with the chosen password answers `200`.
  - **Workbench.** `GET /api/v1/users` as an organization admin lists the user as `ACTIVE`, with `activatedBy.id` equal to their own id and `invitedBy` unchanged.
  - **Reuse.** Presenting the same token again answers `404`.
  - **Confidentiality.** No response body of this file contains the token (`JSON.stringify(body)` does not include it).
- [X] T015 [P] [US1] Web test helpers in `apps/web/src/features/auth/__tests__/activation/helpers.ts`, mirroring `__tests__/password-renewal/helpers.ts`:
  - constants: `API_BASE_URL`, `ACTIVATION_TOKEN`, `PREVIEW` (Claire Martin), `ACTIVATED_USER` (a `toObject()`-shaped session user), `VALID_PASSWORD`;
  - `mockPreview(response)` and `mockAcceptance(response)` MSW handlers for the two endpoints;
  - `mockSession(state)` for `auth/me`;
  - `renderActivation()`, which calls `renderApp('/activate/' + ACTIVATION_TOKEN)`;
  - `submitActivation(password, confirmation?)`.
- [X] T016 [US1] Feature test in `apps/web/src/features/auth/__tests__/activation/success.test.tsx` (depends on T015). With no session and a `200` preview:
  - **Before submitting.** The screen shows "Claire Martin" and the email, a password field and a confirmation field, no "remember me", and no application navigation. `document.head` carries `<meta name="referrer" content="no-referrer">`.
  - **After submitting** a valid password: the acceptance request carries the token in its JSON body, and `router.state.location.pathname` becomes `/` with `section: 'rotations'`. The memory history no longer holds an `/activate/` entry to go back to, and the session query reflects `ACTIVATED_USER`.

### Implementation for User Story 1

- [X] T017 [US1] Create `apps/api/app/auth/invitation_acceptance/invitation_acceptance_validator.ts` with two validators (D4, D8):
  - `invitationPreviewValidator` holds `{ token: vine.string() }`: **no** length or format rule, with a comment explaining that one would make malformed links distinguishable.
  - `invitationAcceptanceValidator` holds `{ token: vine.string(), ...` the T003 shared fields `}`.
- [X] T018 [US1] Create `apps/api/app/auth/invitation_acceptance/preview_invitation_use_case.ts`. `PreviewInvitationUseCase.handle({ token, now })` digests the token with `digestActivationSecret`, calls `findPendingByActivationTokenHash`, and throws `ActivationLinkUnusableException` on `null` (D3).
- [X] T019 [US1] Create `apps/api/app/auth/invitation_acceptance/accept_invitation_use_case.ts`. `AcceptInvitationUseCase.handle(input: AcceptInvitationInput)` follows the decision order of [invitation-acceptance-api.md](./contracts/invitation-acceptance-api.md):
  1. Refuse a non-null `signedInUserId` with `InvitationAcceptanceSessionOpenException`.
  2. Digest the token, and refuse an unusable link early with `ActivationLinkUnusableException`.
  3. `hash.make(password)`, **outside** any transaction.
  4. `acceptInvitation`, mapping `UNUSABLE` to `ActivationLinkUnusableException`.
  5. Return the user.

  Use the `AcceptInvitationInput` type of [data-model.md](./data-model.md) (D5, D7, D9).
- [X] T020 [US1] Create `apps/api/app/controllers/invitation_acceptance_controller.ts` with two methods:
  - **`preview`** validates with `invitationPreviewValidator`, runs the use case with `now: DateTime.now()`, and serializes `toActivationPreview()`.
  - **`store`** runs these steps (D9):
    1. Validate with `invitationAcceptanceValidator`.
    2. Resolve `signedInUserId` through `resolveOpenSessionUser(ctx)`.
    3. Run the use case with `acceptedAt: DateTime.now()`.
    4. Call `await auth.use('web').login(user)` with **no** remember argument, wrapped in a `try/catch` that throws `InvitationAcceptedSessionNotOpenedException` on failure.
    5. Return `serialize(UserTransformer.transform(user))`.
- [X] T021 [US1] Declare the two routes in `apps/api/start/routes.ts`, directly below `auth.login` and **outside** the `middleware.auth()` group:
  - `router.post('/api/v1/auth/invitation-acceptance/preview', [controllers.InvitationAcceptance, 'preview']).as('auth.invitation_acceptance.preview')`
  - `router.post('/api/v1/auth/invitation-acceptance', [controllers.InvitationAcceptance, 'store']).as('auth.invitation_acceptance.store')`

  Then confirm T013 and T014 pass (depends on T017–T020).
- [X] T022 [US1] Regenerate the committed Tuyau registry by booting the API once (`node ace list:routes` from `apps/api`). Confirm `apps/api/.adonisjs/client/registry/` gains `auth.invitation_acceptance.preview` and `auth.invitation_acceptance.store`, and that `tuyauQuery.auth.invitationAcceptance` typechecks from `apps/web` (depends on T021).
- [X] T023 [P] [US1] Add `location ^~ /activate/ { access_log off; add_header Referrer-Policy "no-referrer" always; try_files $uri /index.html; }` to `apps/web/nginx.conf`, above `location /`, with a comment stating that the path *is* the secret (D10, FR-020).
- [X] T024 [P] [US1] Create `apps/web/src/features/auth/queries/use-activation-preview.ts`. `useActivationPreview(token)` wraps `useQuery` with a `queryFn` calling the typed `tuyau` client for `auth.invitation_acceptance.preview` with `{ body: { token } }`, and sets `retry: false`, `gcTime: 0`, and `staleTime: Infinity`. Add a comment tying each option to D12 (depends on T022).
- [X] T025 [P] [US1] Create `apps/web/src/features/auth/mutations/use-invitation-acceptance.ts`. `useInvitationAcceptance()` wraps `useMutation(tuyauQuery.auth.invitationAcceptance.store.mutationOptions({ onSuccess }))`, where `onSuccess` runs `resetSession(queryClient)` and then `router.navigate({ to: '/', search: { section: 'rotations' }, replace: true })`. Add a comment on why this is an explicit `replace` navigation and not login's `invalidate()` (D10, D11) (depends on T022).
- [X] T026 [US1] Create `apps/web/src/features/auth/ui/activation-form.tsx`:
  - `useAppForm` with the T004 schemas as `onBlur` and `onSubmit` validators;
  - `form.AppField` for `password` and `passwordConfirmation`, both with `autocomplete="new-password"`;
  - a read-only email input with `autocomplete="username"` (clarification 4);
  - `form.FormError`;
  - `form.SubmitButton` labelled "Activate", with pending label "Activating…".

  It submits `{ token, password, passwordConfirmation }` through `useInvitationAcceptance().mutateAsync({ body })` (depends on T004, T025).
- [X] T027 [US1] Create `apps/web/src/features/auth/ui/activation-screen.tsx` taking `token`. It renders the loading state, then the ready state: "This link activates the access of <first> <last>" with the email, followed by `ActivationForm` (contract states 1 and 5) (depends on T024, T026).
- [X] T028 [US1] Create the two routes:
  - `apps/web/src/routes/_activation.tsx`: `createFileRoute('/_activation')` with `component: GuestLayout`, `pendingComponent: () => null`, and `head: () => ({ meta: [{ name: 'referrer', content: 'no-referrer' }] })`. Its `beforeLoad` awaits `ensureSessionUser(queryClient)`, swallows `isUnauthorizedError`, rethrows anything else, and **never redirects**, with a comment contrasting `_guest` and `_password-renewal`.
  - `apps/web/src/routes/_activation/activate.$token.tsx`: a thin route rendering `<ActivationScreen token={Route.useParams().token} />`.

  Regenerate `src/routeTree.gen.ts` (`pnpm --filter @portflow/web generate`), then confirm T016 passes (depends on T027).

**Checkpoint**: An invited person can activate their access and land logged in (MVP). Opening an
unusable link or opening it while logged in is not handled yet.

---

## Phase 4: User Story 2 - Refuse an Activation Link That Can No Longer Be Used (Priority: P1)

**Goal**: Every unusable link gets the same refusal on both endpoints and on the screen. Nothing
changes, nothing is disclosed, and the refusal points both to login and to asking an organization
admin.

**Independent Test**: Open, then submit a password through, each of these in turn: a never-issued,
a malformed, an expired, a used, a replaced, and a no-longer-pending link. Verify one identical
outcome, no state change, and no name or email.

### Tests for User Story 2 ⚠️

- [X] T029 [P] [US2] Integration test in `apps/api/tests/integration/auth/invitation_acceptance/unusable_links.spec.ts`. On **both** endpoints, assert `404` with a body `deepEqual` to `{ error: { code: 'E_ACTIVATION_LINK_UNUSABLE', message: 'This activation link cannot be used' } }` for each of these links:
  - never issued;
  - malformed: `'nope'`, `''`, a 2,000-character string, non-base64url characters;
  - expired (T010 `expired: true`);
  - already used, by a prior successful acceptance;
  - replaced: the user's token row replaced by a new digest, then the old token presented;
  - a leftover token row whose user is `ACTIVE`, `CANCELLED`, or `DEACTIVATED`.

  For each, also assert:
  - the body contains no name, email, or token;
  - no password is recorded and the access status is unchanged;
  - an existing token row, including the expired one, still exists, so it stays renewable (FR-013).

  Also cover a link that expires between the preview and the submission: preview `200`, move `expires_at` into the past, accept `404`.
- [X] T030 [P] [US2] Unit test in `apps/api/tests/unit/auth/invitation_acceptance/unusable.spec.ts`: when the early read finds the link usable but `acceptInvitation` returns `UNUSABLE` (swap `UserRepository` in the container, as `tests/unit/users/consultation/list.spec.ts` does), `AcceptInvitationUseCase` throws `ActivationLinkUnusableException`.
- [X] T031 [P] [US2] Feature test in `apps/web/src/features/auth/__tests__/activation/unusable.test.tsx`:
  - **Preview `404`.** The screen shows "This activation link can't be used" and the body naming both next steps, links to `/login`, and renders no name, no email, and no form.
  - **Acceptance `404`** after a `200` preview reaches the same state.
  - **Acceptance `422`** whose `details` name `token` reaches the same state.

### Implementation for User Story 2

- [X] T032 [US2] Export `isActivationLinkUnusableError(error)` from `apps/web/src/features/auth/mutations/use-invitation-acceptance.ts`. It matches `parseApiError(error).code === 'E_ACTIVATION_LINK_UNUSABLE'`, or an `E_VALIDATION_ERROR` whose `details` name `token`.
- [X] T033 [US2] Add the unusable state (contract state 2) to `apps/web/src/features/auth/ui/activation-screen.tsx`, rendered from the preview's error or from the form's acceptance error. `ActivationForm` reports it through an `onUnusable` callback instead of placing it on a field. Confirm T029–T031 pass (depends on T032).

**Checkpoint**: No unusable link can set a password or reveal an identity, on either seam.

---

## Phase 5: User Story 3 - Choose a Trustworthy Initial Password (Priority: P2)

**Goal**: The initial password follows the password renewal rule exactly. Refusals are field-level,
keep the link usable, and can be corrected without reopening the link.

**Independent Test**: Submit an empty, an 11-character, a 129-character, a mismatched, and a
space-padded password. Verify the field-level refusals, the user still `PENDING`, the link still
usable, and a space-padded password that logs in as it would at any other entry point.

### Tests for User Story 3 ⚠️

- [X] T034 [P] [US3] Integration test in `apps/api/tests/integration/auth/invitation_acceptance/validation.spec.ts`:
  - **Length.** Empty, 11-character, and 129-character passwords answer `422` `E_VALIDATION_ERROR` with `details` on `password`.
  - **Mismatch.** A mismatched confirmation answers `422` with `details` on `passwordConfirmation`.
  - **After each refusal.** The user is `PENDING` with no password, the token row still exists, and a valid resubmission answers `200`.
  - **Spaces.** `'  correct-horse-battery-staple  '` is accepted, and login succeeds with or without the spaces, as everywhere else in the application (FR-005 as amended on 2026-09-11).
- [X] T035 [P] [US3] Feature test in `apps/web/src/features/auth/__tests__/activation/validation.test.tsx`:
  - blurring an 11-character password shows the minimum-length message;
  - submitting a mismatched confirmation shows "Passwords do not match." on the confirmation and sends no request;
  - an API `422` with `details` on `password` is placed on that field, and both values stay entered;
  - correcting and resubmitting succeeds without re-rendering the route.

### Implementation for User Story 3

- [X] T036 [US3] In `apps/web/src/features/auth/ui/activation-form.tsx`, route a refused submission through `applyValidationError(formApi, error)` after the T032 unusable check, keeping the entered values. Confirm T034 and T035 pass.

**Checkpoint**: No account starts with a password weaker than a renewed one.

---

## Phase 6: User Story 4 - Never Complete an Acceptance From Someone Else's Session (Priority: P2)

**Goal**: A browser holding a session cannot accept. The screen names the logged-in user and offers
"Log out" to continue on the same link. The API refuses a submission anyway, leaving the link and
the session untouched.

**Independent Test**:

1. Log in as an organization admin and open a usable link in that browser.
2. Verify that no form is shown, that the admin is named, and that a forced submission gets `409`
   while the link stays usable.
3. Log out from the screen and complete the activation.

### Tests for User Story 4 ⚠️

- [X] T037 [P] [US4] Integration test in `apps/api/tests/integration/auth/invitation_acceptance/session_open.spec.ts`:
  - **An open session is refused.** Acceptance with `.loginAs(activeUser)` answers `409` `E_INVITATION_ACCEPTANCE_SESSION_OPEN`. The invited user stays `PENDING`, the token row still exists, and `GET /api/v1/auth/me` with that same session still answers `200` as `activeUser`.
  - **A confined session is refused the same way.** `.loginAs` a `passwordRenewalRequired` user also answers `409`.
  - **The check runs first.** With an open session **and** an unusable token, the answer is `409`, not `404`.
  - **A stale session is replaced.** `.loginAs` a `DEACTIVATED` user answers `200`, and `assertSession('auth_web', invitedUser.id)` holds (D7).
  - **The preview ignores the session.** The preview with `.loginAs(activeUser)` answers `200`.
- [X] T038 [P] [US4] Unit test in `apps/api/tests/unit/auth/invitation_acceptance/session_open.spec.ts`: with a non-null `signedInUserId`, `AcceptInvitationUseCase` throws `InvitationAcceptanceSessionOpenException` for both a usable and an unusable token. For the usable one, the user is still `PENDING` and the token row still exists.
- [X] T039 [P] [US4] Feature test in `apps/web/src/features/auth/__tests__/activation/signed-in.test.tsx`:
  - **Signed-in state.** With `auth/me` answering an active admin and a `200` preview, the screen shows the invited identity and "You're logged in as <admin>", and no password field.
  - **Log out and continue.** Clicking "Log out" posts to `auth/logout`, and with `auth/me` now `401` the form appears on the same `/activate/<token>` URL.
  - **Confined session.** With `auth/me` answering a confined user (`passwordRenewalRequired: true`), the screen shows the same signed-in state, with no redirect to `/password-renewal`.
  - **`409` from the API.** When the acceptance answers `409` `E_INVITATION_ACCEPTANCE_SESSION_OPEN`, the screen re-reads `auth/me` and shows the signed-in state.

### Implementation for User Story 4

- [X] T040 [US4] Add the signed-in state (contract state 4) to `apps/web/src/features/auth/ui/activation-screen.tsx`. It reads the session through `useSession()`, and shows the invited identity, then "You're logged in as <first> <last>. Log out to continue with this activation." and a "Log out" button calling the existing `useLogout().mutate({}, { onError: toast })`. This state takes precedence over the form whenever the session is `authenticated`.
- [X] T041 [US4] In `apps/web/src/features/auth/mutations/use-invitation-acceptance.ts`, handle `E_INVITATION_ACCEPTANCE_SESSION_OPEN` in `onError` with `resetSession(queryClient)` then `router.invalidate()`, and export `isSessionOpenError(error)`. `ActivationForm` returns silently on it, as `password-renewal-form.tsx` does for `isAlreadyRenewedError`. Confirm T037–T039 pass (depends on T040).

**Checkpoint**: An administrator can no longer choose an invited person's password by mistake, and
no session ends without its owner's action.

---

## Phase 7: User Story 5 - Recover From a Failed Acceptance Without a Half-Activated Access (Priority: P3)

**Goal**: A failure leaves the user pending with a usable link, and a retry works. Racing
submissions record one acceptance. An activation whose session could not be opened is reported as
active, with a way to log in.

**Independent Test**:

1. Make an acceptance fail and verify nothing changed; retry and verify a single acceptance.
2. Race two submissions and verify exactly one succeeds.
3. Force the session opening to fail and verify the user is active and told to log in.

### Tests for User Story 5 ⚠️

- [X] T042 [P] [US5] Integration test in `apps/api/tests/integration/auth/invitation_acceptance/recovery.spec.ts`:
  - **Concurrency.** Two acceptances through one token with `Promise.all` give exactly one `200` and one `404`. Afterwards `activated_at` is set once and exactly one password verifies.
  - **Transient failure.** Patch `LucidUserRepository.prototype.acceptInvitation` to throw, then restore it in a `finally`, as `tests/integration/warehouses/update/update.spec.ts` patches its repository. The answer is `500`, the user stays `PENDING` with no password, the token row still exists, and after restoring, the same request answers `200`.
  - **Session not opened.** Patch `SessionGuard.prototype.login` from `@adonisjs/auth/session` to throw, restoring it in a `finally`. The answer is `500` with `E_INVITATION_ACCEPTED_SESSION_NOT_OPENED` and no `meta`. The user is `ACTIVE`, the token row is gone, `assertSessionMissing('auth_web')` holds, and a login with the chosen password answers `200`.
- [X] T043 [P] [US5] Feature test in `apps/web/src/features/auth/__tests__/activation/recovery.test.tsx`:
  - **Acceptance network error.** `FormError` shows "We couldn't activate your access. Try again.", both values stay entered, and a resubmission with a `200` succeeds.
  - **Session not opened.** An acceptance `500` with `E_INVITATION_ACCEPTED_SESSION_NOT_OPENED` shows "Your access is active. Log in with the password you just chose." with a link to `/login`, and no form.
  - **Preview network error.** The screen shows "We couldn't check this activation link." with a "Try again" button that refetches, and the ready state appears once the preview answers `200`.

### Implementation for User Story 5

- [X] T044 [US5] Add to `apps/web/src/features/auth/ui/activation-screen.tsx` the preview-failure state (contract state 3, "Try again" calling the query's `refetch`) and the session-not-opened state (contract state 6). Export `isSessionNotOpenedError(error)` from `use-invitation-acceptance.ts` and route it from `ActivationForm` through an `onActivatedWithoutSession` callback.
- [X] T045 [US5] In `apps/web/src/features/auth/ui/activation-form.tsx`, set any remaining acceptance failure as the form-level error "We couldn't activate your access. Try again." through `formApi.setErrorMap({ onSubmit: { form: … } })`, keeping the values and leaving the submit enabled (FR-021). Confirm T042 and T043 pass.

**Checkpoint**: Every failure path leaves the organization's access trustworthy.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T046 [P] Confidentiality audit (FR-020, SC-006):
  - grep `apps/api/app/auth/invitation_acceptance/` and the controller for any log call, and for any exception message or `meta` built from the token;
  - confirm the web writes the token to no storage and builds no URL from it, and that the preview query uses `gcTime: 0`;
  - confirm `apps/web/nginx.conf` serves `/activate/` without an access log.
- [X] T047 [P] Run the manual pass of [quickstart.md](./quickstart.md) end to end: the API `curl` sequence, the eight screen steps, and the Docker nginx check (`docker logs` shows no `/activate/` line, and the `Referrer-Policy: no-referrer` header is present). Confirm SC-005 (activation within a minute) and SC-008.
- [ ] T048 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the repository root. Then obtain a fresh read-only review of the final diff, and resolve or justify every confirmed finding (constitution VII). — *Status:*
  - *Passing: `pnpm check` and `pnpm typecheck`, and the full API suite (1203 tests).*
  - *Web: `features/auth` and `features/users` pass (222 tests). The unsharded full web run passed 1181 of 1191. Its 10 failures, and a sharded run killed for low memory, were timeouts under load in unrelated features; the failing set changed between runs, and every failing file passes in isolation. CI's sharded run is authoritative.*
  - *Remaining: the fresh review, which a human triggers.*

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends on |
|---|---|
| Setup (Phase 1) | Nothing; starts immediately. |
| Foundational (Phase 2) | Setup. It **blocks every user story**. |
| US1 (Phase 3) | Foundational. This is the MVP. |
| US2 (Phase 4) | US1's endpoints and screen. It ships with US1. |
| US3 (Phase 5) | US1's validator and form. Independent of US2 and US4. |
| US4 (Phase 6) | US1's controller and screen. Independent of US2 and US3. |
| US5 (Phase 7) | US1, and US2's unusable mapping for the race it tests. |
| Polish (Phase 8) | Everything. |

Within Phase 2:

- T003, T004, T005, T006, T007, T008, and T009 touch different files and run together.
- T010 follows T006.
- T011 follows T009 and T010.
- T012 follows T011.

### Within Each Story

- Write the tests first and confirm they fail, then implement.
- API before web: the endpoints and the regenerated Tuyau registry (T022) gate every web type.
- API order: validator → use cases → controller → routes. Web order: query and mutation → form →
  screen → route files.
- The route files stay thin; the screen owns the behavior.

### Parallel Opportunities

| Group | When |
|---|---|
| T001 and T002 | Together |
| T003–T009 | Together, all distinct files |
| T013, T014, and T015 | Together, then T016 |
| T023, T024, and T025 | Together once T022 lands |
| T029, T030, and T031 | Together |
| T034 and T035 | Together |
| T037, T038, and T039 | Together |
| T042 and T043 | Together |
| T046 and T047 | Together |

Once US1 lands, US3 and US4 can be built in parallel. They share `activation-form.tsx` and
`activation-screen.tsx`, so those two files must be coordinated.

---

## Parallel Example: User Story 1

```bash
# The tests, written together and confirmed failing:
Task: "Unit test the use cases in apps/api/tests/unit/auth/invitation_acceptance/accept_invitation.spec.ts"
Task: "Integration test both endpoints in apps/api/tests/integration/auth/invitation_acceptance/accept.spec.ts"
Task: "Web helpers in apps/web/src/features/auth/__tests__/activation/helpers.ts"

# Once the registry is regenerated (T022):
Task: "nginx location for /activate/ in apps/web/nginx.conf"
Task: "Preview query in apps/web/src/features/auth/queries/use-activation-preview.ts"
Task: "Acceptance mutation in apps/web/src/features/auth/mutations/use-invitation-acceptance.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational. It blocks everything, and the existing auth suites must stay
   green through the two extractions.
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: an invited person opens their link, chooses a password, and lands logged in.
   The admin's workbench shows them active.
5. Demo if ready.

### Incremental Delivery

1. Setup + Foundational: a link can be recognized and consumed atomically.
2. US1: invitations can be completed end to end (MVP).
3. US2: unusable links refuse uniformly. **Ship no further without this.**
4. US3: the initial password rule is enforced and correctable.
5. US4: no acceptance from someone else's session.
6. US5: every failure path is recoverable.

US1 and US2 are both P1 and ship together. Without US2, the screen would have no answer for a dead
link other than a generic error, and the uniform refusal is what clarification 3 decided.

### Parallel Team Strategy

1. Everyone lands Setup + Foundational.
2. One developer takes US1 through US2. They share the endpoints, the screen, and the route files.
3. Once US1 lands, a second developer takes US3 and a third takes US4, coordinating on
   `activation-form.tsx` and `activation-screen.tsx`.
4. US5 follows, a short finishing set on the same two files.

---

## Notes

- The secret must never appear in an API URL, a response, an exception, a log, a `Referer`, or the
  browser history after success (FR-020, D10). Every integration file asserts the response half of
  that.
- No schema change: GH-2 and GH-7 delivered every column and table this slice touches
  (data-model.md). `CONTEXT.md` gains no term.
- `toObject()` is the session contract behind `auth.login`, `auth.me`, and now
  `auth.invitation_acceptance.store`. It does not change (D9).
- T003, T004, and T005 are extractions with no behavior change. The existing suites are their
  regression net, and must pass untouched before any new code relies on them.
- Button labels carry the action only: "Activate", "Log out", "Try again".
- Commit after each task or logical group, with Conventional Commits on the feature branch.
- Stop at any checkpoint to validate the story independently.
