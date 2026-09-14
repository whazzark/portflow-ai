# Quickstart: Restore a Cancelled Invitation with a New Activation Link

**Feature**: `GH-13` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

How to run this feature and prove it works end to end. The shapes and the reasoning live in
[contracts/http-api.md](./contracts/http-api.md),
[contracts/restoration-workbench.md](./contracts/restoration-workbench.md),
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
   activation link as **link A**, then acknowledge the outcome.
2. Open that pending user and **Cancel invitation** with the comment `Start date postponed.`
   (GH-12). Switch to **Cancelled** and open the user.
3. The footer offers **Restore invitation**, and the row menu offers it between **Edit** and
   **Remove** (FR-015). Neither appears on a pending, active, or deactivated user.
4. Click it. The confirmation reads **Restore invitation?**, names the user, says the invitation
   will be pending again with a new link valid for 7 days shown once, says any earlier link stays
   unusable, and offers **Comment (optional)**. Its buttons are **Cancel** and **Restore invitation**
   (FR-016). Type a comment, click **Cancel**: nothing changes, and reopening shows an empty field
   (US4-4).
5. Reopen it, type `  Start date confirmed.  `, and confirm. The button reads **Restoring…** and
   neither button responds until the answer. Then the **Activation link** dialog opens: it says the
   invitation is pending again and any earlier link still does not work, shows **link B** with its
   expiry 7 days from now, and offers copy. Behind it, the record has already closed (US4-8). Copy
   link B.
6. Click **Done**. You are still on **Cancelled**; the user is gone from it; **Cancelled** is down by
   one and **Pending** up by one (FR-018).
7. Switch to **Pending**. The user's **Invited** cell shows the original invitation date and admin
   (clarification 3), and the **Activation link** cell carries no mark. Open the record: status
   Pending; **Activation link** valid until the new expiry; the history reads **Invited**, then
   **Cancelled** with `“Start date postponed.”`, then **Invitation restored** with today's date, you,
   and `“Start date confirmed.”` without the padding (FR-002, FR-003a, FR-019).
8. In a private window, open **link A**: the unusable-link page (FR-006, US1-4). Open **link B**:
   the activation screen; choose a password and land signed in as that user (US1-3).
9. As the admin again, restore a second cancelled user from the **row menu** without a comment:
   same outcome, and the history shows no comment line under **Invitation restored**.
10. **Race it**: cancel a third invitation, open that cancelled user in two tabs, restore in the
    first and click **Done**. In the second, confirm: the toast says the invitation is already
    pending and points to renewing the link, the collection refreshes, and no second link is shown
    (US5-1, US5-2).
11. Stop the API, try a restoration, and read a retryable failure with the comment kept. Start it
    again and confirm: one link is presented (US5-3, US5-4).
12. Sign in as an **operations admin**: no cancelled or pending users are visible and there is no
    restoration anywhere (US2).

## Validate at the API

```bash
# as an organization admin session, on a cancelled user
curl -i -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"comment":"Start date confirmed."}' \
  http://localhost:3333/api/v1/users/<id>/restore-invitation
# → 200 { data: { user: { accessStatus: "PENDING", invitationRestoredAt, … }, activationLink } }

# the same call again
# → 409 { error: { code: "E_USER_NOT_CANCELLED", meta: { accessStatus: "PENDING" } } }
```

```sql
SELECT count(*) FROM user_activation_tokens WHERE user_id = '<id>';  -- 1 after a restoration
SELECT access_status, cancelled_at, cancellation_comment,
       invitation_restored_at, invitation_restoration_comment
FROM users WHERE id = '<id>';  -- PENDING, cancellation kept, restoration recorded
```

## Automated checks

```bash
pnpm --filter @portflow/api test unit          # use case + guarded write against SQLite
pnpm --filter @portflow/api test integration   # endpoint contract, acceptance end to end, projection
pnpm --filter @portflow/web test               # workbench, including __tests__/invitation-restoration
```

Before the PR is ready (constitution VII):

```bash
pnpm check        # Biome format + lint
pnpm typecheck    # both apps
pnpm test         # both suites
```

Then the walkthrough above, and a fresh read-only review of the final diff.
