# Quickstart: Preserve the Last Active Organization Admin

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contract**:
[deactivate-user.md](./contracts/deactivate-user.md) · **Model**: [data-model.md](./data-model.md)

How to prove this slice. It assumes the repository's usual setup, as in
[GH-20's quickstart](../reject-ineligible-user-deactivation/quickstart.md): `pnpm install`, the
PostgreSQL instance from `docker/docker-compose.yml`, and `apps/api/.env` pointing at it.

## 1. Automated seams

```bash
pnpm --filter @portflow/api test --suites=unit --files="tests/unit/users/deactivation/**"
pnpm --filter @portflow/api test --suites=integration --files="tests/integration/users/deactivation/**"
pnpm --filter @portflow/web test -- src/features/users/__tests__/deactivate
```

Expected:

| Scenario | Seam | Expected |
|---|---|---|
| A deactivates B, then B deactivates A | repository | first `DEACTIVATED`, second `ACTOR_NOT_ENTITLED`, A still an active organization admin |
| A→B, B→C, C→A in sequence | repository | at least one of A, B, C still an active organization admin, and every deactivation that took effect names an actor who was still active |
| Actor deactivated before the write | repository + HTTP | `ACTOR_NOT_ENTITLED` / `403 E_AUTHORIZATION_FAILURE`, target still `ACTIVE`, its tokens kept |
| Actor demoted to operations admin, operations lead, or observer before the write | repository + HTTP | same |
| Actor lost entitlement and target is pending, cancelled, deactivated, or unknown | repository | `ACTOR_NOT_ENTITLED`, never a target reason |
| Actor carries a password renewal requirement | repository | still entitled → `DEACTIVATED` |
| Organization admin deactivates the only other organization admin, with no competing request | HTTP | `200` (no regression) |
| `403` body from the write vs. the `403` body from the policy | HTTP | identical |
| Every GH-20 deactivation scenario | all | unchanged (SC-005) |
| `403 E_AUTHORIZATION_FAILURE` in the workbench | web | refusal toast "Unable to deactivate user “…”", collection refreshed |

Then the repository-wide gates: `pnpm check`, `pnpm typecheck`, `pnpm test`.

## 2. Real concurrency on PostgreSQL (SC-001)

The test suite runs on single-connection SQLite and cannot race two transactions (research D7). This
check is the only place the row lock is actually exercised.

Run it against a **throwaway database** in the same PostgreSQL container, not against the
development `portflow` database: the loop resets users on every run. Start the API with `ace serve`,
because plain `tsx` does not emit the decorator metadata the container needs to build controllers.

```bash
docker compose -f docker/docker-compose.yml up -d
docker exec portflow-postgres psql -U postgres -c 'CREATE DATABASE portflow_gh21_scratch'

cd apps/api
export TZ=UTC PORT=3334 HOST=localhost LOG_LEVEL=warn APP_KEY=local-only-insecure-app-key-0123456789 \
  NODE_ENV=development DB_CONNECTION=postgres DB_HOST=127.0.0.1 DB_PORT=5433 DB_USER=postgres \
  DB_PASSWORD=postgres DB_DATABASE=portflow_gh21_scratch SESSION_DRIVER=cookie \
  WEB_ORIGIN=http://localhost:3000
node --import reflect-metadata --import tsx ace.js migration:fresh --seed --drop-types
node --import tsx ace.js serve          # API on :3334, leave it running
```

The seed has one organization admin, Claire Martin, and four other users, all with the password
`Password!234`. Each run of the loop below does these things:

1. It resets the participants to `ACTIVE` and `ORGANIZATION_ADMIN` with SQL, and demotes every
   other organization admin first. A bystander admin would keep the organization-wide count at one
   and hide a lockout.
2. It opens a fresh session for each participant.
3. It fires one deactivation per participant at the next participant in the ring, all at the same
   moment.
4. It counts the active organization admins left.

```bash
API=http://localhost:3334/api/v1
sql() { docker exec -i portflow-postgres psql -U postgres -d portflow_gh21_scratch -tAq -c "$1"; }
EMAILS=(claire.martin@portflow.ai thomas.bernard@portflow.ai)     # add sophie.dubois@… for the cycle
IN=$(printf "'%s'," "${EMAILS[@]}"); IN=${IN%,}
IDS=(); for e in "${EMAILS[@]}"; do IDS+=("$(sql "select id from users where email = '$e'")"); done
sql "update users set role = 'OPERATIONS_LEAD' where role = 'ORGANIZATION_ADMIN' and email not in ($IN)"

for run in $(seq 1 50); do
  sql "update users set access_status = 'ACTIVE', role = 'ORGANIZATION_ADMIN', deactivated_at = null,
       deactivated_by_user_id = null where email in ($IN)"
  for i in "${!EMAILS[@]}"; do
    curl -s -c "$i.jar" -o /dev/null -X POST $API/auth/login -H 'content-type: application/json' \
      -d "{\"email\":\"${EMAILS[$i]}\",\"password\":\"Password!234\"}"
  done
  for i in "${!EMAILS[@]}"; do
    curl -s -b "$i.jar" -o "$i.out" -w '%{http_code} ' -X POST \
      "$API/users/${IDS[$(( (i + 1) % ${#EMAILS[@]} ))]}/deactivate" &
  done
  wait; echo "| admins left: $(sql "select count(*) from users
    where access_status = 'ACTIVE' and role = 'ORGANIZATION_ADMIN'")"
done

docker exec portflow-postgres psql -U postgres -c 'DROP DATABASE portflow_gh21_scratch'   # afterwards
```

Expected in **every** run:

- **Two admins (SC-001).** One `200` and one `403`, never two `200`s and never a `500`, and
  `admins left: 1`.
- **Three-admin cycle (SC-002).** Two `200`s and one `403`, and `admins left: 1`.
- **Every `403` body** is `{"error":{"code":"E_AUTHORIZATION_FAILURE","message":"Access denied"}}`.
- **The API log** contains no `deadlock`.

As a control, the same loop against the GH-20 code (lock and actor re-check removed) yields two
`200`s and `admins left: 0` in every run.

**Recorded on 2026-09-11 (PostgreSQL 17, 50 runs each):**

| Variant | Status codes | Runs left with no active organization admin |
|---|---|---|
| Two admins | `200 403` in all 50 | 0 |
| Three-admin cycle | `200 200 403` in all 50 | 0 |
| Two admins, with the fix removed (control) | `200 200` in all 50 | 50 |
| Admin A deactivates B while B resets A's password (`B.id < A.id`) | `200 200` in all 50 | 0 |

The API log showed no deadlock in any run. The final runs used the `FOR NO KEY UPDATE` lock adopted
after the implementation review. The deadlock the previous `FOR UPDATE` caused against a password
reset was reproduced in two `psql` sessions rather than through HTTP (research D2).

## 3. Workbench, by hand

There is nothing new to see when requests do not compete. That is the point of FR-007 and FR-008.
With two organization admins signed in on two browsers, confirm each one's deactivation of the other
as close together as you can. One browser shows the success toast. The other shows "Unable to
deactivate user “…”" with "Access denied", and it lands on sign-in at its next navigation.
