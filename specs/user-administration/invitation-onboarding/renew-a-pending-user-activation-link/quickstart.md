# Quickstart: Renew a Pending User Activation Link

**Feature**: `GH-9` · **Date**: 2026-09-11 · **Spec**: [spec.md](./spec.md)

How to run this feature and prove it works end to end. Shapes and reasoning live in
[contracts/http-api.md](./contracts/http-api.md),
[contracts/renewal-workbench.md](./contracts/renewal-workbench.md),
[data-model.md](./data-model.md), and [research.md](./research.md). This file is the run guide.

## Prerequisites

- Node 22, `pnpm@10.28.1`, and a reachable PostgreSQL for `apps/api`. The tests use better-sqlite3
  and need nothing running.
- `pnpm install` at the repository root.
- This feature's migration applied, which also regenerates `apps/api/database/schema.ts`:

```bash
pnpm --filter @portflow/api db:migrate
```

Reseed from scratch when the fixture users drift:

```bash
pnpm --filter @portflow/api db:fresh
```

## Run it

```bash
pnpm dev                       # api on :3333, web on :3000
```

## Validate by hand

1. **Sign in as an organization admin**, open **Users**, and invite a person. Copy the link from
   the outcome and keep it (call it L₀). Acknowledge: you land on the **Pending** view.
2. In the Pending view the new user's **Activation link** cell is blank, because the link is valid.
   Open their record: **Activation link — Valid until <date>**, 7 days from now (FR-022).
3. From the record footer choose **Renew activation link**. The confirmation names the user and
   says any link already handed out will stop working. Click **Cancel**: nothing changes, and L₀
   is still the live link (FR-019).
4. Renew again and confirm. The outcome shows a new link L₁ once, with a copy action, the new
   expiry, and *the previous link no longer works*. Neither Escape nor an outside click closes it.
   Click **Done**: you are back on the record (FR-006, FR-021).
5. The record now shows **Activation link — Valid until <new date>**, and the access history gains
   **Activation link renewed**, dated and attributed to you. `Invited` is unchanged
   (FR-008, FR-009).
6. Close the record, open the same user's **row menu**, and renew from there. Same confirmation and
   same outcome, without opening the record. **Done** leaves you on the Pending view (FR-018).
7. Reload the page and look everywhere — record, row, network responses of `GET /api/v1/users`. No
   link appears anywhere (FR-007).
8. **Expired and missing links**: in a database console, move one pending user's
   `user_activation_tokens.expires_at` into the past, and delete another pending user's token row.
   Refresh: the Pending view marks them **Expired** and **Not issued**, and their records say
   **Expired <date>** / **Not issued**. Renew the expired one: the mark disappears without a manual
   reload (US5).
9. **Refusals**: open an active user's record. No renewal action is offered there, nor on
   deactivated or cancelled users, nor on your own record (FR-018). The Pending view is the only
   place the **Activation link** column appears.
10. **Stale view**: open a pending user's row menu in one tab, and in another tab make that user
    non-pending (for instance by accepting the invitation once GH-8 exists, or through a console).
    Confirm the renewal in the first tab: it is refused with a sentence naming the current status
    and the action that applies, and the collection refreshes (US3-3).
11. Sign in as an **operations admin** and open Users. No pending view, no renewal action, no
    activation link column, and no renewal in any history (FR-010, FR-013).

SC-007: steps 6 then 4 from the collection take three interactions — menu, item, confirm — plus the
copy, well under a minute. SC-009: the outcome appears within 2 seconds on a local stack.

## Validate the API directly

The workbench must never be the only thing enforcing a rule (FR-013). Exercise the endpoint with an
operations admin's session, an operations lead's, an unauthenticated client, and an administrator
who owes their own renewal. Try it against an active, a deactivated, a cancelled, and an unknown
user. Each must be refused with the status and code in
[contracts/http-api.md](./contracts/http-api.md#refusals), and each must leave the target's token
row and `activation_link_renewed_*` columns untouched.

```bash
curl -i -b cookies.txt -X POST http://localhost:3333/api/v1/users/<id>/activation-link-renewal
```

Then prove the replacement at the storage seam (FR-003, FR-015):

```sql
SELECT user_id, hash, expires_at, created_at FROM user_activation_tokens WHERE user_id = '<id>';
```

Exactly one row per renewed user, and its `hash` changes on every renewal.

## Automated verification

```bash
pnpm check                                                  # Biome format + lint
pnpm typecheck                                              # both apps
pnpm test                                                   # both suites
pnpm --filter @portflow/api test unit                       # use case + repository against SQLite
pnpm --filter @portflow/api test integration                # endpoint contract + collection projection
pnpm --filter @portflow/web test                            # workbench
```
