# Contract — `PATCH /api/v1/users/:id/role`

**Feature**: [../spec.md](../spec.md) · **Route name**: `users.change_role` · **Introduced by**: GH-28

Changes the responsibility level of one user. The only write this slice adds.

## Request

```http
PATCH /api/v1/users/:id/role
Content-Type: application/json

{ "role": "OPERATIONS_LEAD" }
```

| Part | Rule |
|---|---|
| `:id` | The target user's identifier. |
| `role` | Required. One of `ORGANIZATION_ADMIN`, `OPERATIONS_ADMIN`, `OPERATIONS_LEAD`, `OBSERVER` — validated against the `USER_ROLES` tuple in `#models/user`. |

No other field is accepted. The body carries no comment, no reason, and no expected current role:
FR-016 keeps no history, so there is nothing to annotate.

## Authorization

`UserPolicy.changeRole` — the session's user must have `accessStatus === 'ACTIVE'` and
`role === 'ORGANIZATION_ADMIN'`. Authorization runs **before** the target is read, so a viewer who
may not change roles receives the same 403 whatever the id names (FR-009).

## Success — `200 OK`

The updated user, in the `toAdministration` projection with `includeAccessHistory: true`: the same
shape `GET /api/v1/users` returns to an organization admin.

```json
{
  "data": {
    "id": "…",
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane.doe@example.com",
    "role": "OPERATIONS_LEAD",
    "accessStatus": "ACTIVE",
    "invitedAt": "…", "invitedBy": { "id": "…", "firstName": "…", "lastName": "…" },
    "activatedAt": "…", "activatedBy": null,
    "cancelledAt": null, "cancelledBy": null,
    "deactivatedAt": null, "deactivatedBy": null,
    "reactivatedAt": null, "reactivatedBy": null
  }
}
```

`accessStatus` and every lifecycle field come back exactly as they were (FR-005). Submitting the role
the user already holds is also a `200` with an unchanged row — not an error (FR-006).

## Failures

| Status | Code | When |
|---|---|---|
| 401 | — | No session, or a session whose user is not active. |
| 403 | — | The session's role is not organization admin. Returned before any target lookup. |
| 404 | `E_USER_NOT_FOUND` | No user with that id. Reachable only by an organization admin. |
| 409 | `E_USER_DEACTIVATED_CANNOT_CHANGE_ROLE` | The target is deactivated. The message names reactivation as the way forward (FR-003). |
| 422 | — | `role` missing, or outside the four values. |

Every failure leaves the target untouched (FR-005, SC-003).

## Concurrency

The write is a single guarded `UPDATE`. Two administrators changing the same user concurrently both
succeed, and the user ends holding one of the two submitted roles — never a partial state. An
administrator whose target is deactivated between opening the record and confirming is refused with
the 409, because the guard is evaluated at execution and not against the state that was displayed
(US2 scenario 4).

## Effect on the target user

Immediate and session-preserving (FR-010). Bouncer resolves policies against the user row on every
request, so the next request the target makes — on any browser — is judged by the new role. No
session is revoked, no password renewal is recorded, and `auth.me` reports the new role on its next
fetch (FR-011, already true of the existing `toObject()` projection).

## Out of this contract

No refusal for an administrator changing their own role, and no protection of the last active
organization admin. Both are GH-29's, and both will attach to this same endpoint without changing its
shape or its success payload.
