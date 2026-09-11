---

description: "Task list for Invite a Pending User with a Confidential Activation Link"
---

# Tasks: Invite a Pending User with a Confidential Activation Link

**Input**: Design documents from
`/specs/user-administration/invitation-onboarding/invite-a-pending-user-with-a-confidential-activation-link/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IV makes RED → GREEN → REFACTOR binding, and D12 fixes
the verification seams: Japa unit tests for the invitation decisions and the link issuer, Japa
integration tests for the endpoint's authorization matrix, refusals, and once-only payload, and
Vitest feature tests rendering the real router with MSW for the workbench. `apps/web/e2e` does not
exist, so this slice adds no end-to-end journey.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and
demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task serves (US1–US5)
- Exact file paths are given in every description

## Path Conventions

Web application monorepo — `apps/api/` (AdonisJS 7) and `apps/web/` (TanStack Start), per plan.md's
Structure Decision. The API work is a new vertical slice under `app/users/invite`; the web work
extends the existing `src/features/users` module behind the same thin `/users` route.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the slice directories and make the configuration this feature depends on
fail-fast

- [X] T001 [P] Create the API slice and test directories `apps/api/app/users/invite/`, `apps/api/tests/unit/users/invitation/`, and `apps/api/tests/integration/users/invitation/`
- [X] T002 [P] Create the web directories `apps/web/src/features/users/mutations/` and `apps/web/src/features/users/__tests__/invitation/`
- [X] T003 Make `WEB_ORIGIN` required in `apps/api/start/env.ts` (`Env.schema.string({ format: 'url' })`), add it to `apps/api/.env.test` and to the job `env:` block of `.github/workflows/ci-checks.yml`, and confirm it is already present in `apps/api/.env.example` and `apps/api/.env.docker.example` (D3)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The invitation plumbing every story needs — the token table, its model and factory, the
domain helpers, the policy, and the transactional repository write. No endpoint and no screen is
exposed by this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create the migration `apps/api/database/migrations/<timestamp>_create_user_activation_tokens_table.ts` per [data-model.md](./data-model.md): `id` uuid primary key, `user_id` uuid not null referencing `users(id)` `ON DELETE CASCADE` and **unique**, `hash` string not null and **unique**, `expires_at` timestamp not null, `created_at` / `updated_at`; `down()` drops the table, which needs no SQLite rebuild dance since no column of `users` changes (D1)
- [X] T005 Run `node ace migration:run` from `apps/api` so `apps/api/database/schema.ts` regenerates with `UserActivationTokenSchema`, and confirm the generated `UserSchema` is byte-for-byte unchanged
- [X] T006 [P] Create `apps/api/app/models/user_activation_token.ts` extending the generated `UserActivationTokenSchema` from `#database/schema`, with `@belongsTo(() => User)` on `userId` and a `@beforeCreate` id hook mirroring `apps/api/app/models/user.ts` (depends on T005)
- [X] T007 [P] Declare `@hasOne(() => UserActivationToken)` as `activationToken` on `apps/api/app/models/user.ts`, leaving the five existing `belongsTo` lifecycle relations untouched (depends on T005)
- [X] T008 [P] Create `apps/api/app/users/shared/normalize_user.ts` exporting the trim helpers for a first name, a last name, and an email, mirroring `apps/api/app/customers/shared/normalize_customer.ts` and leaving the email's casing intact (D7)
- [X] T009 [P] Create `apps/api/app/users/shared/activation_link_issuer.ts`: an injectable class whose `issue()` returns `{ url, hash, expiresAt }` — 32 bytes from `randomBytes` base64url-encoded as the secret, its SHA-256 hex digest as `hash`, `now + 7 days` as `expiresAt`, and `<WEB_ORIGIN>/activate/<secret>` as `url` (D2, D3)
- [X] T010 [P] Add `invite(user)` to `apps/api/app/users/shared/user_policy.ts` granting only viewers whose `accessStatus` is `ACTIVE` and whose role is `ORGANIZATION_ADMIN`, leaving `list()` untouched (D5)
- [X] T011 [P] Add the `InviteUserCommand` type and the `invite()` abstract signature returning `{ kind: 'CREATED', user, activationToken } | { kind: 'DUPLICATE_EMAIL' }` to `apps/api/app/users/shared/repositories/user_repository.ts`, leaving `create()`, `findByEmail()`, `list()`, `listActive()`, and `renewPassword()` untouched (D8)
- [X] T012 Implement `invite()` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts`: one `User.transaction` writing the `PENDING` user with `invitedAt` / `invitedByUserId` and its `user_activation_tokens` row, returning `DUPLICATE_EMAIL` when `isUniqueViolation` catches the `users_email_unique` index, and letting nothing partial survive (D8, depends on T004, T006, T011)
- [X] T013 [P] Create `apps/api/database/factories/user_activation_token_factory.ts` with a default valid state and an `expired` state, and extend the `invited` state of `apps/api/database/factories/user_factory.ts` so a fixture can carry a responsible administrator (depends on T006)

**Checkpoint**: a pending user and its activation token can be written atomically in code, and the
policy can answer *may this viewer invite* — nothing is reachable over HTTP or in the browser yet

---

## Phase 3: User Story 1 - Invite a Person and Hand Out Their Activation Link (Priority: P1) 🎯 MVP

**Goal**: An organization admin submits an identity, an email, and a role, and receives the
confidential activation link once, while the organization gains a pending user carrying a dated,
attributed invitation event.

**Independent Test**: Sign in as an organization admin, invite a person who holds no access yet,
verify the link is presented once with its expiry, acknowledge it, and verify the new pending user
appears in the pending view with its invitation event attributed to you and no activation link
anywhere else.

### Tests for User Story 1 ⚠️

> Write these first and confirm they FAIL before implementing

- [X] T014 [P] [US1] Unit test in `apps/api/tests/unit/users/invitation/invite.spec.ts`: `InviteUserUseCase` creates a `PENDING` user with no password, records `invitedAt` and `invitedByUserId` from the authenticated admin, records no other lifecycle event, and returns the issued link — swapping `UserRepository` in the container as `tests/unit/users/consultation/list.spec.ts` does
- [X] T015 [P] [US1] Unit test in `apps/api/tests/unit/users/invitation/activation_link_issuer.spec.ts`: the issued `url` is `<WEB_ORIGIN>/activate/<secret>`, `expiresAt` is 7 days after issuance (FR-008), the persisted `hash` is the SHA-256 digest of the secret and never the secret itself, and two issuances never produce the same secret
- [X] T016 [US1] Integration test in `apps/api/tests/integration/users/invitation/invite.spec.ts`: `POST /api/v1/users` as an organization admin answers `201` with the `{ user, activationLink }` body of [post-users.md](./contracts/post-users.md), persists exactly one `user_activation_tokens` row for the new user, and a following `GET /api/v1/users` lists the pending user while carrying no activation link, no `hash`, and no password
- [X] T017 [US1] Feature test in `apps/web/src/features/users/__tests__/invitation/journey.test.tsx`: an organization admin opens the invitation entry point (`mode=create`), submits a valid invitation, sees the link with its expiry and a copy action, cannot dismiss the outcome by clicking outside or pressing `Escape`, and after acknowledging lands on the pending view with the new user highlighted and its access record closed (FR-005a, FR-020)

### Implementation for User Story 1

- [X] T018 [US1] Create `apps/api/app/users/invite/invite_user_validator.ts` with `vine.create({ firstName, lastName, email, role })` — required strings and the role restricted to `USER_ROLES` — leaving shape refinements to US4
- [X] T019 [US1] Create `apps/api/app/users/invite/invite_user_use_case.ts`: normalize through `normalize_user.ts`, call `UserRepository.invite()` with the issued digest and expiry from `ActivationLinkIssuer`, and return `{ user, activationLink }` (depends on T008, T009, T012, T018)
- [X] T020 [US1] Add `store()` to `apps/api/app/controllers/users_controller.ts` — `bouncer.with(UserPolicy).authorize('invite')`, `request.validateUsing(inviteUserValidator)`, `response.status(201)`, and `serialize({ user: UserTransformer.transform(user, { includeAccessHistory: true }).useVariant('toAdministration'), activationLink })` (D9) — and register `router.post('/', [controllers.Users, 'store']).as('store')` inside the existing `/users` group of `apps/api/start/routes.ts` (D4)
- [X] T021 [US1] Restart the API dev server so `.adonisjs/` regenerates, then add the invitation result type to `apps/web/src/features/users/types.ts` from `Route.Response<'users.store'>`, next to the existing `UserDto` (depends on T020)
- [X] T022 [P] [US1] Create `apps/web/src/features/users/mutations/use-user-mutations.ts` exposing `invite` from `tuyauQuery.users.store.mutationOptions()` and invalidating `userQueries.list()` on success, mirroring `apps/web/src/features/customers/mutations/use-customer-mutations.ts` (depends on T021)
- [X] T023 [US1] Extend the search schema of `apps/web/src/routes/_authenticated/users.tsx` with `mode: z.enum(['create']).optional()` and `invitedUserId: z.string().optional()`, and add the `transform` clearing `userId` under `mode=create`, per [invite-user-workbench.md](./contracts/invite-user-workbench.md) (D10)
- [X] T024 [P] [US1] Create `apps/web/src/features/users/ui/invite-user-form.tsx` with `useAppForm`, the registered `TextField` components for first name, last name, and email, a role select over the four roles, `FormError`, and `SubmitButton` with the pending label from `helpers/resource-copy`, mirroring `apps/web/src/features/customers/ui/customer-form.tsx`
- [X] T025 [P] [US1] Create `apps/web/src/features/users/ui/invite-user-panel.tsx` — the `Sheet` header and description hosting the form, built from the shared detail chrome at `size="lg"`
- [X] T026 [US1] Create `apps/web/src/features/users/ui/activation-link-dialog.tsx`: an `AlertDialog` — not the form's sheet — carrying the link in clear text, its expiry date, a copy action confirming success and leaving the link selectable on failure, the statement that it will not be shown again, and an acknowledgement that is the only way out (FR-005, FR-005a)
- [X] T027 [US1] Wire `apps/web/src/features/users/ui/users-page.tsx`: the invitation entry point above the collection and in the unfiltered empty state, the `mode=create` panel switch between form and outcome, and the acknowledgement navigation to `status=pending&invitedUserId=<id>` with `mode` cleared (depends on T022, T023, T024, T025, T026)
- [X] T028 [P] [US1] Highlight the row named by `invitedUserId` in `apps/web/src/features/users/ui/user-table.tsx`, as decoration only — no change to selection, counts, or filters (depends on T023)

**Checkpoint**: an organization admin can invite a person end to end and hand out the link; the
pending user is visible with its invitation event and the link is nowhere else

---

## Phase 4: User Story 2 - Keep Invitation Restricted to the Administrators Responsible for User Access (Priority: P1)

**Goal**: Only active organization admins can invite, enforced by the API whatever the interface
offers.

**Independent Test**: Attempt an invitation as each role, unauthenticated, and with a non-active
access status, and verify every outcome at the API seam; then verify the workbench offers no entry
point to a viewer the API would refuse, and that a hand-typed `?mode=create` creates nothing.

### Tests for User Story 2 ⚠️

- [X] T029 [P] [US2] Integration test in `apps/api/tests/integration/users/invitation/authorization.spec.ts`: the full matrix of [post-users.md](./contracts/post-users.md) — `401` unauthenticated, `403` for `OPERATIONS_ADMIN`, `OPERATIONS_LEAD`, and `OBSERVER`, `201` for `ORGANIZATION_ADMIN` — and no user and no token row created by any refused attempt
- [X] T030 [P] [US2] Feature test in `apps/web/src/features/users/__tests__/invitation/permissions.test.tsx`: an operations admin sees no invitation entry point on `/users`, and arriving with `?mode=create` opens no panel

### Implementation for User Story 2

- [X] T031 [US2] Confirm the controller authorizes before validating in `apps/api/app/controllers/users_controller.ts`, so an unauthorized viewer receives `403` rather than a validation error that would disclose the endpoint's shape (depends on T020)
- [X] T032 [US2] Gate the invitation entry point and the `mode` parameter on the viewer's role in `apps/web/src/features/users/ui/users-page.tsx` and the `transform` of `apps/web/src/routes/_authenticated/users.tsx`, using `useAuthenticatedUser()` as the collection's status views already do — the interface stays honest, the API stays authoritative (FR-011)

**Checkpoint**: the write seam is closed to every role but organization admin, on both seams —
**ship no further without this**

---

## Phase 5: User Story 3 - Refuse an Invitation That Conflicts with an Existing User (Priority: P2)

**Goal**: An email already held by any user is refused, the existing user is untouched, and the
administrator is told which action applies.

**Independent Test**: Invite an email held by a pending, an active, a deactivated, and a cancelled
user in turn, and verify each attempt is refused with that status, that no second user is created,
and that the existing user's status, role, identity, and lifecycle events are unchanged.

### Tests for User Story 3 ⚠️

- [X] T033 [P] [US3] Unit tests in `apps/api/tests/unit/users/invitation/invite.spec.ts`: the use case refuses when `findByEmail` returns a user in any of the four access statuses, refuses on the repository's `DUPLICATE_EMAIL` outcome with the same exception, and never implicitly restores or reactivates (FR-012)
- [X] T034 [P] [US3] Integration tests in `apps/api/tests/integration/users/invitation/conflicts.spec.ts`: `409` `E_USER_EMAIL_CONFLICT` with `meta.accessStatus` for each of the four statuses, for a space-padded and differently-cased email (FR-013), the existing user unchanged afterwards, and two concurrent invitations of one email resolving to exactly one `201` and one `409` (FR-019)

### Implementation for User Story 3

- [X] T035 [P] [US3] Create `apps/api/app/users/invite/invitation_exceptions.ts` with `EmailAlreadyInUseException` — `409`, `E_USER_EMAIL_CONFLICT`, carrying `meta: { accessStatus }`, which `apps/api/app/exceptions/handler.ts` already serializes (D6)
- [X] T036 [US3] Add the conflict decision to `apps/api/app/users/invite/invite_user_use_case.ts`: read `findByEmail` on the normalized email before writing, and map the repository's `DUPLICATE_EMAIL` outcome by re-reading the row so the raced attempt receives the same exception with the same status (depends on T019, T035)
- [X] T037 [P] [US3] Create `apps/web/src/features/users/helpers/user-invitation-copy.ts` mapping each access status to its next action — renew the activation link, restore the invitation, reactivate the user, or nothing for an active user — per the table in [post-users.md](./contracts/post-users.md)
- [X] T038 [US3] Render the conflict refusal in `apps/web/src/features/users/ui/invite-user-form.tsx` from `parseApiError`'s `meta.accessStatus`, keeping every entered value, and cover it in `apps/web/src/features/users/__tests__/invitation/refusals.test.tsx` (depends on T024, T037)

**Checkpoint**: no second access can be created for a person who already holds one, and the
administrator is pointed at the action that applies

---

## Phase 6: User Story 4 - Record a Trustworthy Identity and Role Before Access Exists (Priority: P2)

**Goal**: Identity, email, and role are validated and normalized before any access exists.

**Independent Test**: Submit invitations with missing, blank, malformed, over-long, and unknown
values, and with padded or mixed-case ones, and verify which are refused at field level, which are
normalized, and that no refused attempt creates a user.

### Tests for User Story 4 ⚠️

- [X] T039 [P] [US4] Unit tests in `apps/api/tests/unit/users/invitation/invite.spec.ts`: surrounding spaces are stripped from the first name, the last name, and the email before the conflict decision and the write (FR-016), the email's casing is preserved, and each of the four roles is accepted including `ORGANIZATION_ADMIN` (FR-017)
- [X] T040 [P] [US4] Integration tests in `apps/api/tests/integration/users/invitation/validation.spec.ts`: `422` `E_VALIDATION_ERROR` with field-level `details` for a missing, blank, malformed, or over-long field and for an unknown role, and no user and no token row created by any of them

### Implementation for User Story 4

- [X] T041 [US4] Extend `apps/api/app/users/invite/invite_user_validator.ts` with `nonBlank()` from `#shared/validators/lifecycle_validator`, `vine.string().email()`, and `maxLength(255)` on the identity and email fields, keeping meaning out of the validator (D7)
- [X] T042 [US4] Apply `normalize_user.ts` in `apps/api/app/users/invite/invite_user_use_case.ts` before the conflict read and before the write, so the padded and differently-cased email of FR-013 is recognized as the same person (depends on T008, T036)
- [X] T043 [US4] Mirror the rules in `apps/web/src/features/users/ui/invite-user-form.tsx` with a Zod schema and map the API's field-level `details` through `applyValidationError`, covering both in `apps/web/src/features/users/__tests__/invitation/validation.test.tsx` (depends on T024)

**Checkpoint**: the organization can no longer acquire a pending user nobody can activate

---

## Phase 7: User Story 5 - Recover From a Failed Invitation Without Leaving Half-Granted Access (Priority: P3)

**Goal**: A failed invitation leaves neither a user without a link nor a link without a user, and the
administrator can retry.

**Independent Test**: Make the invitation fail after submission, verify nothing was created, retry
once the problem is resolved, and verify exactly one pending user results.

### Tests for User Story 5 ⚠️

- [X] T044 [P] [US5] Integration test in `apps/api/tests/integration/users/invitation/recovery.spec.ts`: a failure raised while writing the activation token leaves no `users` row and no `user_activation_tokens` row for that email (FR-018), and a retry afterwards succeeds exactly once
- [X] T045 [P] [US5] Feature test in `apps/web/src/features/users/__tests__/invitation/recovery.test.tsx`: a server failure shows a retryable failure distinct from a validation refusal and keeps the typed values, resubmitting twice yields at most one pending user, and arriving at `mode=create&invitedUserId=<id>` with no link in memory — the reload case — shows the "no longer available" state naming the pending user (D11)

### Implementation for User Story 5

- [X] T046 [US5] Verify and, if needed, correct the transactional boundary of `invite()` in `apps/api/app/users/shared/repositories/lucid_user_repository.ts` so both rows commit together and a refusal records no lifecycle event at all (depends on T012, T044)
- [X] T047 [US5] Add the unavailable state to `apps/web/src/features/users/ui/activation-link-dialog.tsx`: name the pending user, state that the link cannot be shown again, and point to the activation link renewal (GH-9) rather than to a second invitation (depends on T026)

**Checkpoint**: every failure path leaves the organization's access trustworthy

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T048 [P] Run the manual pass of [quickstart.md](./quickstart.md) end to end — the API `curl` sequence and the ten workbench steps — and confirm SC-005 (an invitation completed and its link captured in under a minute) and SC-007
- [X] T049 [P] Confirm no seam other than the `201` response exposes the secret: grep the API for the issued secret reaching a log or a transformer, and confirm the web never writes `activationLink` to the query cache or to storage (FR-006, D11)
- [ ] T050 Run `pnpm check`, `pnpm typecheck`, and `pnpm test` from the repository root, then obtain a fresh read-only review of the final diff and resolve or justify every confirmed finding — *the three commands pass (1025 API tests, 1028 web tests); the fresh review is the remaining half, and it is triggered by a human*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependency — starts immediately
- **Foundational (Phase 2)**: depends on Setup; **blocks every user story**
- **US1 (Phase 3)**: depends on Foundational — the MVP
- **US2 (Phase 4)**: depends on US1's endpoint and page existing; ships with US1
- **US3 (Phase 5)**: depends on US1's use case; independent of US2 and US4
- **US4 (Phase 6)**: depends on US1's validator and use case; independent of US2 and US3
- **US5 (Phase 7)**: depends on US1 and on US3's refusal handling for the distinction it tests
- **Polish (Phase 8)**: depends on everything

### Within Each Story

- Tests first, confirmed failing, then implementation
- API before web: the endpoint and the regenerated Tuyau registry gate every web type
- Migration → model → repository → domain helpers → use case → controller → route
- Feature module before route wiring; the route stays thin

### Parallel Opportunities

- T001 and T002 run together
- T006, T007, T008, T009, T010, and T011 run together once T005 lands; T013 follows T006
- T014 and T015 run together; T024 and T025 run together; T022 and T028 run alongside them
- T029 and T030 run together; T033 and T034 run together; T039 and T040 run together
- T044 and T045 run together; T048 and T049 run together
- Once US1 lands, US3 and US4 can be built in parallel by different developers — they share
  `invite_user_use_case.ts` and `invite-user-form.tsx`, which must be coordinated

---

## Parallel Example: User Story 1

```bash
# The two API unit tests, written together and confirmed failing:
Task: "Unit test InviteUserUseCase in apps/api/tests/unit/users/invitation/invite.spec.ts"
Task: "Unit test ActivationLinkIssuer in apps/api/tests/unit/users/invitation/activation_link_issuer.spec.ts"

# The two panel shells, once the form contract is settled:
Task: "Create apps/web/src/features/users/ui/invite-user-form.tsx"
Task: "Create apps/web/src/features/users/ui/invite-user-panel.tsx"

# The mutation module and the row highlight, independent of both:
Task: "Create apps/web/src/features/users/mutations/use-user-mutations.ts"
Task: "Highlight the invited row in apps/web/src/features/users/ui/user-table.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — blocks everything
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: an organization admin invites a person, captures the link once, and finds
   the pending user in the workbench with its invitation event
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → a pending user and its link can be written atomically
2. US1 → access can be granted end to end (MVP)
3. US2 → the write seam is closed to every other role — **ship no further without this**
4. US3 → one person can never hold two accesses
5. US4 → no unusable pending user can be created
6. US5 → every failure path leaves the organization's access trustworthy

US1 and US2 are both P1 and together form the shippable write: US1 without US2 would let any
authenticated role grant access, so the two ship as one increment even though they are tested
independently.

### Parallel Team Strategy

1. Everyone lands Setup + Foundational
2. One developer takes US1 through US2 — they share the endpoint, the page, and the panel files
3. Once US1 lands, a second developer takes US3 and a third takes US4, coordinating on
   `invite_user_use_case.ts` and `invite-user-form.tsx`
4. US5 follows US3's refusal states and is a short finishing pair of tasks

---

## Notes

- The activation secret exists in exactly one place — the `201` response body. Nothing may log it,
  cache it, or return it a second time (FR-006, D11)
- The `users` table is not modified: GH-2 delivered every column this slice writes (data-model.md)
- `toObject()` is the session contract behind `/auth/me` and `/auth/login`, and `toAdministration()`
  is the collection contract behind `GET /api/v1/users`; neither changes here (D9)
- Making `WEB_ORIGIN` required (T003) is a deliberate boot-time failure: a link built from a guess is
  worse than a refusal to start (D3)
- `/activate/<secret>` is fixed by this slice as a contract; the screen behind it belongs to GH-8
- Commit after each task or logical group, with Conventional Commits on the feature branch
- Stop at any checkpoint to validate the story independently
