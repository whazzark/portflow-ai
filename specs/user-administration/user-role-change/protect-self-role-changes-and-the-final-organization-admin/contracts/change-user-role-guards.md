# Contract — Guards on `PATCH /api/v1/users/:id/role`

**Feature**: [../spec.md](../spec.md) · **Route name**: `users.change_role` · **Endpoint introduced
by**: GH-28 — [its contract](../../change-another-eligible-user-role/contracts/change-user-role.md)

This slice adds two refusals to the endpoint GH-28 delivered. The request, the authorization, the
success payload, and every existing failure are unchanged. This document covers only the delta.
GH-28's contract remains the reference for everything else, and its "Out of this contract" section is
what this one fills.

## Request — unchanged

```http
PATCH /api/v1/users/:id/role
Content-Type: application/json

{ "role": "OPERATIONS_LEAD" }
```

No new field. In particular, the body does not carry the requester: the API takes it from the
session.

## Failures — complete table after this slice

Returned in this order. The first matching row wins.

| Order | Status | Code | When | New |
|---|---|---|---|---|
| 1 | 401 | — | No session, or a session whose user is not active. | |
| 2 | 403 | — | The session's role is not organization admin. Returned before any target lookup, whatever the id names, **including the caller's own**. | |
| 3 | 422 | `E_VALIDATION_ERROR` | `role` missing or outside the four values, or `:id` not a UUID. | |
| 4 | 409 | `E_USER_SELF_ROLE_CHANGE` | `:id` names the caller, in any letter case, whatever `role` is submitted — the role already held included. | ✓ |
| 5 | 404 | `E_USER_NOT_FOUND` | No user with that id. | |
| 6 | 409 | `E_USER_DEACTIVATED_CANNOT_CHANGE_ROLE` | The target is deactivated. | |
| 7 | 409 | `E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN` | When the change is applied, the target is the organization's only active organization admin, and `role` is not `ORGANIZATION_ADMIN`. | ✓ |

Error bodies keep the envelope every refusal in this API uses:

```json
{ "error": { "code": "E_USER_SELF_ROLE_CHANGE", "message": "Your own role can only be changed by another organization admin" } }
```

```json
{ "error": { "code": "E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN", "message": "The organization must keep at least one active organization admin" } }
```

Neither message names another user or states how many organization admins remain (FR-007).

Every refusal leaves every user as it was: the target, the caller, and everyone else (FR-009).

## Success — unchanged, with one addition to what it guarantees

`200 OK` with the updated user in the `toAdministration` projection, as GH-28 defines it. In
addition, a `200` now guarantees that at least one active organization admin existed when the
transaction committed.

Still `200`, as before:

- promoting any eligible user to organization admin;
- submitting the role a user already holds — for any user other than the caller;
- demoting an active organization admin while another one remains active;
- changing the role of a pending or cancelled organization admin, whatever the count.

## Concurrency — replaces GH-28's section

The write is one transaction. It opens with a locking read of the target and of every active
organization admin, taken in id order ([research D3](../research.md#d3--one-locking-read-of-the-target-and-every-active-organization-admin-in-id-order)).

- **Two administrators demoting each other at the same moment**: exactly one `200`. The other request
  gets `409 E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN` when it had passed authorization before the
  winner committed, or `403` when its authorization ran after. In both cases one active organization
  admin remains.
- **A demotion applied after a deactivation** (GH-20) is judged against the organization as that
  deactivation left it. A deactivation applied after a demotion is judged by GH-21, not here.
- **Two administrators changing the same user's role** still resolve to one of the two submitted
  roles (GH-28), now by lock order rather than by the last `UPDATE`.
- **No deadlock** between role changes: every one of them locks the same kind of rows in the same
  order. The lock is `FOR NO KEY UPDATE`, so inserts elsewhere that reference an admin (foreign-key
  checks) neither wait for it nor deadlock with it.

## Out of this contract

The deactivation of the last active organization admin is refused by `POST /api/v1/users/:id/deactivate`
once GH-21 ships, reusing `E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN`. It is not part of this endpoint.
