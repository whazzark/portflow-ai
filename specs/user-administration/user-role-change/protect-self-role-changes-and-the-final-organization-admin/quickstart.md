# Quickstart — Protect Self-Role Changes and the Final Organization Admin

**Feature**: [spec.md](./spec.md) · **Contracts**: [API](./contracts/change-user-role-guards.md) ·
[workbench](./contracts/role-change-refusals-workbench.md)

This guide covers running the feature and proving it does what the spec says. Run every command from
the repository root. The setup, the seeded accounts, and the curl session recipe are GH-28's — see
[its quickstart](../change-another-eligible-user-role/quickstart.md). Only what differs is repeated
here.

## Prerequisites

```bash
pnpm install
docker compose -f docker/docker-compose.yml up -d   # PostgreSQL, container portflow-postgres, port 5433
pnpm dev                                            # API and web together
```

The seed has exactly one organization admin, Claire Martin (`claire.martin@portflow.ai`). The
password for every seeded account is `Password!234`. Before any walkthrough below, sign in as Claire
and use the workbench to make Thomas Bernard (`thomas.bernard@portflow.ai`, an operations admin) an
organization admin as well. The rules only become observable with two.

`portflow-postgres` is shared with sibling worktrees. Do not run `db:fresh` against it without
checking with them first. Put back any role you change here when you are done.

## Automated verification

```bash
pnpm --filter api test --files "tests/unit/users/role_change/*"
pnpm --filter api test --files "tests/integration/users/role_change/*"
pnpm --filter web test src/features/users/__tests__/role-change
```

Before the PR is ready:

```bash
pnpm check
pnpm typecheck
pnpm test
```

The suites run on SQLite, where writers are serialized. There they prove the *outcome* of colliding
changes: the 50-round group always ends with one active organization admin. They do not prove the
*lock*.

## Proving the lock on PostgreSQL

Run the same two suites against a scratch database, then drop it. This is the pattern GH-9 and GH-14
used:

```bash
docker exec portflow-postgres psql -U postgres -c "CREATE DATABASE portflow_gh29_verify"
cd apps/api && DB_CONNECTION=postgres DB_PORT=5433 DB_DATABASE=portflow_gh29_verify \
  node --import tsx ace.js test \
    --files "tests/unit/users/role_change/*" --files "tests/integration/users/role_change/*"
docker exec portflow-postgres psql -U postgres -c "DROP DATABASE portflow_gh29_verify WITH (FORCE)"
```

Expected result: all green. On PostgreSQL the concurrency group runs without a global transaction,
over a connection pool, so its 50 rounds of mutual demotion really contend. Every round must end with
exactly one `200`, one `409 E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN` or `403`, and one active
organization admin (SC-002). A deadlock would show up as a `500` with `40P01` in the server log. There
must be none.

## Proving the refusals at the API

Get Claire's session cookie as in GH-28's quickstart, then:

```bash
# Own id → 409 E_USER_SELF_ROLE_CHANGE, whatever the role, the one already held included
curl -i -X PATCH "$API/api/v1/users/$CLAIRE_ID/role" \
  -H 'Content-Type: application/json' -b "$COOKIE" -d '{"role":"OBSERVER"}'
curl -i -X PATCH "$API/api/v1/users/$CLAIRE_ID/role" \
  -H 'Content-Type: application/json' -b "$COOKIE" -d '{"role":"ORGANIZATION_ADMIN"}'

# Own id in upper case → the same 409 (FR-002)
curl -i -X PATCH "$API/api/v1/users/$(echo "$CLAIRE_ID" | tr a-f A-F)/role" \
  -H 'Content-Type: application/json' -b "$COOKIE" -d '{"role":"OBSERVER"}'

# An operations lead naming themselves → 403, identical to naming anyone else (FR-011)
```

After each one, `GET /api/v1/users` shows Claire still an active organization admin.

A demotion of Thomas by Claire succeeds (`200`), because Claire remains an active admin. Promote him
back afterwards. The final admin refusal cannot be produced by requests made one after the other,
since the requester is always an active admin when authorized. It takes a collision, staged below.

## Staging the collision by hand (PostgreSQL)

A `psql` session holds a lock on Claire's row, so a request of hers waits after authorization. The
race then happens in slow motion.

1. In the browser, signed in as **Claire**, open Thomas's record, choose `Edit`, and set his role to
   `Observer`. Do not save yet.
2. In a terminal, hold Claire's row as another transaction would:

   ```bash
   docker exec -it portflow-postgres psql -U postgres -d portflow
   ```
   ```sql
   BEGIN;
   SELECT id FROM users WHERE email = 'claire.martin@portflow.ai' FOR NO KEY UPDATE;
   ```
3. In the browser, save. The request passes authorization and then waits: the panel stays pending.
4. In `psql`, demote Claire as a colliding request would, and release:

   ```sql
   UPDATE users SET role = 'OPERATIONS_ADMIN' WHERE email = 'claire.martin@portflow.ai';
   COMMIT;
   ```
5. In the browser, expect the following (US3, FR-012):
   - the request is refused with *The organization must keep at least one active organization
     admin*, shown in a toast;
   - the session is refetched, so Claire now navigates as an operations admin and the panel has
     fallen back to Thomas's record;
   - Thomas is still an organization admin, and the organization still has one.
6. Restore: `UPDATE users SET role = 'ORGANIZATION_ADMIN' WHERE email = 'claire.martin@portflow.ai';`

There is no variant in which Claire stays in the panel. A refused administrator has always just
stopped being an active organization admin; otherwise she would have counted, and Thomas would not
have been the last.

Two more runs complete the picture:

- Repeat with step 4 changed to `COMMIT;` alone. Nothing about Claire changes, so the save succeeds.
  The wait by itself refuses nothing.
- Repeat with the `UPDATE` setting `access_status = 'DEACTIVATED'` instead of the role. The refusal
  toast appears, and the refetched session sends Claire to sign-in. Restore with
  `access_status = 'ACTIVE'`.

Also check that the identity is kept when the role is refused (FR-013). Repeat steps 1–5, but also
correct Thomas's first name in step 1. After step 5, the record shows the corrected name, and his
role is unchanged.

## Proving the workbench offers nothing on one's own record

As Claire, open `/users?userId=<Claire's id>&mode=edit` by hand. The record opens, without the
`Edit user` heading and without a `Role` control (FR-010).

## Known limits, by design

- A demotion and a *deactivation* applied at the same moment can still leave no active organization
  admin until GH-21 ships. That slice refuses the deactivation half (spec, Out of Scope).
- A user promoted to organization admin while a demotion is waiting on its locks is not counted by
  that demotion. The demotion can then be refused where, a moment later, it would be allowed. It errs
  towards refusing, and a retry succeeds ([research D5](./research.md#d5--a-promotion-committed-while-waiting-is-not-seen-the-rule-errs-towards-refusing)).
- Neither a refused nor an applied role change is recorded (GH-28 FR-016).
