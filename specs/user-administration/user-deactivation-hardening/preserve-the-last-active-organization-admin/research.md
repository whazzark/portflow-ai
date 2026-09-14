# Research: Preserve the Last Active Organization Admin

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Each decision states what was chosen, why, and what was rejected. The Technical Context has no
open `NEEDS CLARIFICATION`. The only product-level choice, which refusal the losing request
receives, was settled in the spec (FR-004 and Assumptions), and D4 here only maps it onto the
existing envelope.

## D1 — The rule is "the actor is still entitled when the write lands", not a head count

**Decision**: The guarded write refuses a deactivation unless its actor, re-read inside the write's
transaction, is still `ACTIVE` with the `ORGANIZATION_ADMIN` role (FR-002). No query counts the
remaining organization admins.

**Rationale**: `DeactivateUserUseCase` already refuses `SELF`, so the actor is never the target. If
the actor is still an active organization admin at the moment the target's row changes, then at
least one active organization admin exists right after the change (FR-001). The rule is also
strictly more useful than a count. It refuses a deactivation from an administrator who was just
demoted or deactivated even when other admins remain. GH-20's user story 3, scenario 4 already asks
for that refusal, but today it only gets it when the loss happens before the request reaches
`UserPolicy.deactivate`.

**Alternatives considered**:

- *Count the active organization admins other than the target and refuse at zero.* This refuses
  exactly the same races, because the count reaches zero only when the actor has already lost the
  status. But it needs a set-wide read that has to be locked against every writer, and it answers a
  question that no entitled administrator can trigger (spec Assumptions).
- *Both checks.* The count adds nothing that the actor check does not already guarantee, and it adds
  a second failure mode to test.

## D2 — Concurrency control: lock the actor and target rows in id order

**Decision**: Inside the transaction `deactivateActive` already opens, first lock the two rows with
`SELECT … FROM users WHERE id IN (:actor, :target) ORDER BY id FOR NO KEY UPDATE`. Then decide from what
that read returns, and only then run the existing `UPDATE … WHERE access_status = 'ACTIVE'`.

**Rationale**: GH-20's guard alone lets the mutual race through. Two administrators deactivating
each other each update a *different* row, so neither `UPDATE` waits for the other. Under PostgreSQL's
default READ COMMITTED isolation, a check on the actor inside the `UPDATE`'s own `WHERE` would read a
snapshot in which the other administrator is still active. That is classic write skew. Locking both
rows forces the two transactions to meet on a common row. The second one to acquire the locks reads
the first one's committed result (READ COMMITTED returns the latest committed version to
a locking read) and finds its own actor deactivated.

Locking in id order is what prevents deadlocks. Two transactions that each lock their actor first
would each hold one row and wait for the other's: a guaranteed deadlock, surfacing as a 500 on one
side. Locking the same set in the same global order cannot form a cycle, and that holds for any
number of transactions, which covers the three-admin cycle of spec user story 1, scenario 5.
`LucidWarehouseRepository.lockWarehouses` uses the same rule ("locked by id so concurrent
submissions over overlapping sets always take the row locks in the same order and can never deadlock
each other"). PostgreSQL applies row locks after `ORDER BY`, which is what makes the order hold.

A concurrent role change is serialized by the same lock. `LucidUserRepository.changeRole` is a
single-row `UPDATE`, which conflicts with `FOR NO KEY UPDATE` on that row. A demotion committed before
our lock is seen, so the deactivation is refused (spec user story 2, scenario 2). A demotion waiting
behind our lock applies after we commit. Whether *that* demotion may leave no active organization
admin is GH-29's decision (spec edge cases), and GH-29 will need to take the same ordered lock over
its actor and target. That obligation is recorded in [contracts/deactivate-user.md](./contracts/deactivate-user.md).

**Lock strength: `FOR NO KEY UPDATE`, not `FOR UPDATE`.** This was changed after the implementation
review. `FOR NO KEY UPDATE` conflicts with itself and with every `UPDATE` of the row, which is all
the queueing needs. Unlike `FOR UPDATE`, it does not conflict with the `FOR KEY SHARE` that
PostgreSQL's foreign-key check takes on a referenced user.

`FOR UPDATE` introduced a deadlock that GH-20's plain `UPDATE` never had. Take administrator B
resetting administrator A's password (`requirePasswordRenewal`) while A deactivates B, with
`B.id < A.id`:

1. The reset locks A's row.
2. The deactivation locks B's row and waits for A's.
3. The reset then writes `password_reset_by_user_id = B`, whose foreign-key check waits for B's row.

This was reproduced deterministically in two `psql` sessions, where PostgreSQL reported
`deadlock detected` on the `FOR KEY SHARE` check. With `FOR NO KEY UPDATE` both transactions
commit. The same applies to `cancelled_by_user_id`, `activation_link_renewed_by_user_id`, and a
login inserting a `remember_me_tokens` row. Lucid wraps only `forUpdate()`, so the lock goes through
the underlying knex query.

Both locks are no-ops on SQLite, which serializes writers anyway. That is the precedent
`findByIdForUpdate` records.

**Alternatives considered**:

- *`SERIALIZABLE` isolation for the deactivation transaction.* PostgreSQL would detect the write
  skew, but it resolves it by aborting one transaction with a serialization failure. That needs a
  retry loop to become a clean refusal instead of a 500. Nothing else in the codebase uses it, and it
  gives no protection against writers that stay at READ COMMITTED.
- *A transaction-level advisory lock on a constant "organization admins" key.* This is correct and
  deadlock-free, but it is PostgreSQL-only with no SQLite equivalent in the test suite, it
  introduces a mechanism the codebase does not use yet, and it serializes every deactivation rather
  than only the ones that share a row.
- *A conditional `UPDATE` with an `EXISTS` subquery on the actor.* This is the write skew described
  above: the subquery takes no lock on the actor's row.
- *Touching the actor's row (a dummy `UPDATE`) to take its lock.* It deadlocks in the mutual case
  unless ordered, and it writes `updated_at` on a user nobody changed.

## D3 — Precedence: lost entitlement beats every target reason

**Decision**: The repository checks the actor before it looks at the target. When the actor is no
longer entitled, the result is `ACTOR_NOT_ENTITLED` whether the target is active, pending, cancelled,
deactivated, or missing (FR-004).

**Rationale**: This matches the order GH-20 already applies across layers: `UserPolicy.deactivate`
runs before any read of the target, so an unauthorized caller never learns whether an identifier
names a user. Reporting `NOT_FOUND` or `ALREADY_DEACTIVATED` to an actor who lost entitlement would
reopen that disclosure through the new path.

## D4 — The refusal is GH-20's `403 E_AUTHORIZATION_FAILURE`, byte for byte

**Decision**: `DeactivateUserUseCase` maps `ACTOR_NOT_ENTITLED` to a new
`DeactivationNoLongerAuthorizedException`, declared in `user_exceptions.ts` with status `403`, code
`E_AUTHORIZATION_FAILURE`, and message `Access denied`. Those are the three values Bouncer's
`AuthorizationException` renders through the application's exception handler. An integration test
compares the new path's response body with the one a policy denial returns, so the two cannot drift
apart.

**Rationale**: FR-004 and FR-008 require the same outcome that GH-20 gives an administrator who is
no longer entitled. From inside the request, "never authorized" (GH-20 user story 3, scenario 4)
means the policy's 403. The workbench already handles that code on this action. It shows the
refusal toast with the API's sentence and refreshes the collection. So the web needs no change.

The actor may have been *deactivated* rather than demoted. The deactivated actor gets a 403 rather
than the 401 that GH-20's session middleware would give, because their session was still valid
when this request passed that middleware. Their next request is refused as unauthenticated and the
route guard returns them to sign-in. That is the ordinary behavior for a deactivated user (spec user
story 1, scenario 3), and this slice adds nothing to it.

**Alternatives considered**:

- *Throw Bouncer's own `errors.E_AUTHORIZATION_FAILURE` from the use case.* The envelope is identical
  by construction, but a use case would then have to build a Bouncer `AuthorizationResponse`, which
  is policy-layer plumbing, and `user_exceptions.ts` already owns the user-administration outcomes.
  The drift risk is covered by the comparison test instead.
- *Split by cause: `401` for a deactivated actor, `403` for a demoted one.* This is marginally more
  faithful to what GH-20's middleware would say, but it needs the use case to impersonate the auth
  middleware's `E_UNAUTHORIZED_ACCESS`, and it gains nothing visible: the deactivated actor is sent to
  sign-in by their next request either way.
- *A dedicated `409 E_USER_LAST_ORGANIZATION_ADMIN`.* The spec rejects this (Assumptions): only an
  actor who has already lost entitlement could ever receive it.

## D5 — Who counts: access status and role, nothing else

**Decision**: The actor check reads only `access_status` and `role`. `password_renewal_required_at`
is ignored (FR-006).

**Rationale**: The password renewal requirement is "independent of the access status and of the role"
(`CONTEXT.md`). An administrator carrying one cannot reach this endpoint anyway, because GH-17's
session gate admits only the renewal. So the only case where it matters is a reset landing on the
actor while their deactivation is in flight. Refusing there would add a third entitlement input that
neither the policy nor the spec has.

## D6 — No web code change, one pinning test

**Decision**: `apps/web` is not modified. One Vitest case is added to
`__tests__/deactivate/refusals.test.tsx`: a `403 E_AUTHORIZATION_FAILURE` on the deactivation shows
the refusal toast titled "Unable to deactivate user “…”" and refreshes the collection.

**Rationale**: FR-008 says the refusal is shown "the same way GH-20 shows its refusal for lost
entitlement". Today that goes through the unmapped-code fallback of `describeUserAccessRefusal`,
which shows the API's "Access denied". The new test pins that path, because it is now reachable by a
race and not only by a stale policy.

**Noted for plan review**: the password reset and activation link renewal dialogs map
`E_AUTHORIZATION_FAILURE` to a sentence of their own ("You are not allowed to …"), and deactivation
does not. Aligning deactivation would be a one-line copy change, but it is a new message, which
FR-008 excludes. Leave it to a separate copy pass unless the plan review asks for it here.

## D7 — Proving a race on a single-connection test database

**Decision**: There are three layers, each proving what it can.

1. **Repository, sequential** (`unit/users/deactivation/guarded_write.spec.ts`). Every concurrent
   interleaving collapses to a commit order. The suite plays each order that matters: A deactivates
   B and then B deactivates A; the three-admin cycle; an actor deactivated first; an actor demoted to
   each of the three other roles first. It asserts the result union, the precedence, and that a
   refusal writes nothing.
2. **HTTP, the in-flight window** (`integration/users/deactivation/deactivate.spec.ts`). The test
   swaps `UserRepository` for a test-only subclass of `LucidUserRepository`. The subclass commits
   the competing change (deactivating or demoting the actor) and then delegates to the real
   `deactivateActive`. The request therefore passes `UserPolicy.deactivate` with an entitled actor
   and meets the lost entitlement only in the guarded write. This is exactly the window the slice
   closes, reproduced deterministically through the whole stack. This is not a fake in ADR-0014's
   sense: the real repository and database do all the work.
3. **PostgreSQL, real concurrency** ([quickstart.md](./quickstart.md)). The test suite runs on
   in-memory SQLite with a single pooled connection (ADR-0014), so it cannot run two transactions at
   once. SC-001 and SC-002 are verified manually against the development PostgreSQL instance, with a
   scripted loop that fires the two mutual deactivations simultaneously 50 times.

**Alternatives considered**: a PostgreSQL-backed automated suite. It would contradict ADR-0014's
choice of an infrastructure-free test run for the sake of one invariant, and it would need a second
CI service. If the lock is ever found wrong in practice, reconsider this through an ADR of its own.

## D8 — The invariant gets a home in `CONTEXT.md`

**Decision**: Add one sentence to the **Organization Admin** entry: the operating organization always
keeps at least one active organization admin.

**Rationale**: Constitution VI. This is a durable domain invariant shared by two slices (GH-21 for
deactivation, GH-29 for role changes), not a feature detail. With a single home, GH-29 cites it
instead of restating it. No ADR is needed: D2 follows a locking pattern the codebase already
documents.
