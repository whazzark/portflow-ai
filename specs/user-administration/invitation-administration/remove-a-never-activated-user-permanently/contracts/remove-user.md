# Contract — `DELETE /api/v1/users/:id`

**Feature**: [../spec.md](../spec.md) · **Route name**: `users.destroy` · **Introduced by**: GH-14

Permanently removes one user whose access was never activated. The only write this slice adds, and
the first `DELETE` route of the API.

## Request

```http
DELETE /api/v1/users/:id
```

| Part | Rule |
|---|---|
| `:id` | The target user's identifier. Must be a UUID, validated as `params.id` like `deactivate` does, so a malformed id is a 422 rather than a PostgreSQL `22P02` answered as a 500. |

No body, no query string. The request carries no reason and no confirmation token: the confirmation
is the workbench's (FR-017), and FR-012 records nothing a reason could annotate.

## Authorization

`UserPolicy.remove` — the session's user must have `accessStatus === 'ACTIVE'` and
`role === 'ORGANIZATION_ADMIN'`. Authorization runs **before** validation and before the target is
read, so a viewer who may not remove users receives the same 403 whatever the id names (FR-015).

## Success — `204 No Content`

Empty body. The user, their activation link digest, and any remembered connection they held are
gone; nothing about them is returned or kept (FR-006, FR-007, FR-012).

## Failures

| Status | Code | When |
|---|---|---|
| 401 | — | No session, or a session whose user is not active. |
| 403 | — | The session's role is not organization admin. Returned before any validation or lookup. |
| 404 | `E_USER_NOT_FOUND` | No user with that id — including a user already removed. Reachable only by an organization admin. |
| 409 | `E_USER_ACTIVE_CANNOT_BE_REMOVED` | The target is active, including the requester's own id. Message: only users who never activated their access can be removed; deactivate an active user instead (FR-002). |
| 409 | `E_USER_DEACTIVATED_CANNOT_BE_REMOVED` | The target is deactivated. Message: users who once held access are kept (FR-003). |
| 409 | `E_USER_REFERENCED_CANNOT_BE_REMOVED` | The target is named by an operational record that restricts its deletion — today, a shift's responsible user (FR-011). |
| 422 | `E_VALIDATION_ERROR` | `:id` is not a UUID. |

Every failure leaves the target, their activation link, and every other row exactly as they were
(FR-009).

Error bodies follow the house shape, `{ "error": { "code": "…", "message": "…" } }`.

## Concurrency

One guarded `DELETE … WHERE id = ? AND access_status IN ('PENDING', 'CANCELLED')`, in a transaction
of its own (a savepoint under the test suites' global transaction). Eligibility is
therefore judged at execution: a user activated between listing and confirming is refused with the
409, and of two concurrent removals one answers `204` and the other `404`. The interleaving relies on
PostgreSQL re-checking the `WHERE` clause once a blocked row lock is released; the SQLite suites
prove each ordering's outcome, not the interleaving. See [research.md](../research.md) D4.

## Effect on the rest of the system

- The email is free: `POST /api/v1/users` with it — any casing — creates a new pending user (FR-008).
- `GET /api/v1/users` no longer lists the user, in any view or count (FR-006).
- A presented activation link for the removed user matches no stored digest, which is how an unknown
  link behaves; GH-8 needs no special case (FR-007).

## Out of this contract

Removal of several users at once, restoration of a removed user, and any trace of removals.
