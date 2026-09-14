# Contract amendment: `POST /api/v1/users/:id/deactivate`

**Feature**: [spec.md](../spec.md) · **Base contract**:
[GH-20 deactivate-user.md](../../reject-ineligible-user-deactivation/contracts/deactivate-user.md)

This slice adds no endpoint, no request field, and no response field. The route, request,
authorization matrix, `200` payload, and client contract in GH-20's contract all still apply. This
document states only what changes.

## Authorization, now enforced twice

| Layer | When | Checks |
|---|---|---|
| `UserPolicy.deactivate` | Before anything is read (unchanged) | The viewer the session loaded is `ACTIVE` and `ORGANIZATION_ADMIN`. |
| `deactivateActive` guarded write | **New**: when the write takes effect, under the row lock | The same two conditions, re-read from the database. |

The second check is authoritative (FR-002 and FR-009). It sees every deactivation and role change
committed before the write, including changes made after the request passed the policy.

## Errors

There is one new cause for an existing status and code. The error table in GH-20's contract is
otherwise unchanged.

| Status | `error.code` | When |
|---|---|---|
| `403` | `E_AUTHORIZATION_FAILURE` | Authenticated and active, but not an organization admin (GH-20). **Or**: an organization admin when the request arrived, but deactivated or demoted by the time the deactivation would take effect (GH-21). |

The body is identical in both cases, and identical to the policy denial:

```json
{ "error": { "code": "E_AUTHORIZATION_FAILURE", "message": "Access denied" } }
```

### Precedence

In order:

1. `401` from the session middleware.
2. `403` from the policy.
3. `422` for a malformed `:id`.
4. `409 E_USER_SELF_DEACTIVATION`.
5. **`403` for lost entitlement at the write (new)**.
6. `404 E_USER_NOT_FOUND` and `409` for `E_USER_PENDING_INVITATION`, `E_USER_CANCELLED_INVITATION`,
   or `E_USER_ALREADY_DEACTIVATED`.

Step 5 takes precedence over every reason that describes the target, so an actor who lost
entitlement learns nothing about it (FR-004).

## Guarantees, amended

- **An organization admin always remains (new).** No sequence or interleaving of deactivations
  commits one whose actor is not an active organization admin at that moment. Together with the
  `SELF` refusal, deactivation can therefore never leave the organization without an active
  organization admin (FR-001).
- **The mutual race resolves to exactly one success (new).** When two organization admins deactivate
  each other at the same moment, one request returns `200` and the other `403 E_AUTHORIZATION_FAILURE`
  (FR-005). Neither returns a `500`: the rows are locked in id order, so the two transactions queue
  instead of deadlocking.
- **A refused call changes nothing (extended).** A `403` at the write leaves both the actor's and
  the target's rows and `remember_me_tokens` untouched (FR-003).
- **Exactly once, all or nothing, the immediate sign-in cut**: unchanged from GH-20.

## Obligation on other writers of `users.role` and `users.access_status`

Any command that can take the organization admin role or active access away from a user must
participate in the same serialization. Before deciding, it locks the rows it reads and writes in
`users.id` order with `FOR NO KEY UPDATE`. Otherwise it can interleave with a deactivation and leave the
organization without an active organization admin. Today this concerns **GH-29** (the role change
guard). Reactivation (GH-32) only grants access and is not concerned.

## Client contract

This is unchanged. `tuyauQuery.users.deactivate` keeps its types. The workbench already renders a
`403` on this action as a refusal toast carrying the API's message and refreshes the collection
(research D6).
