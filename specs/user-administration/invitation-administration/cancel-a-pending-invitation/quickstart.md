# Quickstart: Cancel a Pending Invitation

**Feature**: `GH-12` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

How to run this feature and prove it works end to end. The shapes and the reasoning live in
[contracts/http-api.md](./contracts/http-api.md),
[contracts/cancel-invitation-workbench.md](./contracts/cancel-invitation-workbench.md),
[data-model.md](./data-model.md), and [research.md](./research.md). This file is the run guide.

## Prerequisites

- Node 22, `pnpm@10.28.1`, and a reachable PostgreSQL for `apps/api`. The tests use better-sqlite3
  and need nothing running.
- `pnpm install` at the repository root.
- This feature's migration applied, which also regenerates `apps/api/database/schema.ts`:

```bash
pnpm --filter @portflow/api db:migrate
```

- The typed client registry under `apps/api/.adonisjs/client/` regenerated for the new route. The
  dev server does this on start, and the file is committed.

## Run it

```bash
pnpm dev                       # api on :3333, web on :3000
```

## Validate by hand

1. **Sign in as an organization admin**, open **Users**, and invite a person (GH-7). Copy the
   activation link, then acknowledge the outcome. You land on **Pending** with the new user
   highlighted.
2. Open that user's record. The footer offers **Cancel invitation** (FR-010). The row menu offers
   the same item.
3. Click it. The confirmation reads **Cancel invitation?**, names the user, says the link stops
   working immediately, and offers **Comment (optional)**. Its buttons are **Keep invitation** and
   **Cancel invitation** (FR-011, FR-011a). Type a comment, then click **Keep invitation**: nothing
   changes, and reopening shows an empty comment (US4-2).
4. Reopen it, type `  Hired elsewhere.  `, and confirm. A toast reads
   `Invitation for “<name>” cancelled`, the record closes, you are still on **Pending**, the user is
   gone from it, and both counts changed (FR-013).
5. Switch to **Cancelled** and open the user. Their status is Cancelled. The access history shows
   **Invited** with its original date and inviting admin, then **Cancelled** with today's date, you
   as the actor, and `“Hired elsewhere.”` without the padding (FR-002, FR-003, FR-003a, FR-014). The
   record offers no **Cancel invitation** (US3).
6. Paste the activation link from step 1 into another browser. Once GH-8 is delivered, it gets the
   invalid-or-expired page. Until then, confirm the token is gone:
   `SELECT count(*) FROM user_activation_tokens WHERE user_id = '<id>'` returns `0` (FR-004).
7. Try to sign in with that user's email and any password: the ordinary invalid-credentials message
   (FR-017).
8. Invite a second person, cancel their invitation from the **row menu** without a comment. Same
   outcome, and the history shows no comment line (FR-012).
9. **Race it**: invite a third person, open their record in two tabs, and cancel in the first. In the
   second, confirm: the toast reads "This invitation has already been cancelled by someone else.",
   and the workbench refreshes to the current state (US5-2, FR-015).
10. Sign in as an **operations admin**: no pending or cancelled users are visible, and there is no
    cancellation action anywhere (FR-018, US2).

## Validate the API directly

The workbench must never be the only thing enforcing a rule (FR-010), so call the endpoint on its
own with an organization admin's session, an operations admin's, an operations lead's, and none.
Target a pending, an active, a deactivated, a cancelled, and an unknown user. Each outcome must
match [contracts/http-api.md](./contracts/http-api.md#refusals), and every refusal must leave the
target and its token untouched.

```bash
curl -i -b cookies.txt -H 'Content-Type: application/json' \
  -X POST http://localhost:3333/api/v1/users/<id>/cancel-invitation \
  -d '{"comment":"Hired elsewhere."}'
```

## Automated verification

```bash
pnpm check                                    # Biome format + lint
pnpm typecheck                                # both apps
pnpm test                                     # both suites
pnpm --filter @portflow/api test unit         # use case and guarded write
pnpm --filter @portflow/api test integration  # endpoint contract
pnpm --filter @portflow/web test              # workbench
```

New test files, following `apps/api/tests/README.md`: unit tests in narrative order, integration
tests in request-flow order.

| File | Covers |
|---|---|
| `apps/api/tests/unit/users/invitation_cancellation/cancel.spec.ts` | the use case: outcome to exception mapping for each status, comment trimming and blank-to-null, the actor and instant passed through |
| `apps/api/tests/unit/users/invitation_cancellation/guarded_write.spec.ts` | the repository against SQLite: status, event, and comment written; token deleted; untouched identity, role, and invitation event; a refusal writing nothing and keeping the token; a repeated call returning `NOT_PENDING`/`CANCELLED` with the first event kept |
| `apps/api/tests/integration/users/invitation_cancellation/cancel.spec.ts` | `401`; `403` for operations admin, operations lead, observer, and non-active admin, with no target read; `422` malformed id and over-long comment; `404`; each `409`; `200` shape with no credential; token gone; sign-in refused; operations-admin listing never shows the user; two concurrent requests → one `200`, one `409` |
| `apps/web/src/features/users/__tests__/cancel-invitation/*.test.tsx` | see [the workbench contract's test seams](./contracts/cancel-invitation-workbench.md#test-seams) |

Fixtures: `UserFactory.apply('invited')` plus `UserActivationTokenFactory` for a pending user with a
live link; `apply('cancelled')`, `apply('deactivated')`, and `apply('active')` for the refusals. The
web fixtures in `__tests__/support/fixtures.ts` gain a pending user and a cancelled user carrying a
`cancellationComment`.
