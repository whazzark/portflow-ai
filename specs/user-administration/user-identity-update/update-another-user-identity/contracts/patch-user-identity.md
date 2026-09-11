# Contract: `PATCH /api/v1/users/:id`

**Feature**: [spec.md](../spec.md) · **Route name**: `users.update` · **Date**: 2026-09-10

Corrects the identifying information of another user of the organization. The only write this
feature adds.

## Placement

Inside the existing authenticated group of `apps/api/start/routes.ts` — `.prefix('/api/v1')`,
`.use(middleware.auth())`, `.use(middleware.passwordRenewalCompleted())` — in the `/users` group next
to `users.index`:

```text
router.patch('/:id', [controllers.Users, 'update']).as('update')
```

An administrator who owes a password renewal reaches nothing but the renewal, so that middleware
already covers the "acting session must be usable" half of FR-005.

## Request

`Content-Type: application/json`

```jsonc
{
  "firstName": "Camille",
  "lastName": "Renard",
  "email": "camille.renard@example.com"
}
```

All three keys are **required**. A `PATCH` carrying the whole identity, rather than a sparse one:
`updateTruckValidator` records the same reasoning — an omitted key must fail validation rather than
silently clearing or preserving a stored value, so "leave the last name alone" is expressed by sending
it back unchanged. The workbench pre-fills the form with the current identity (FR-016), so the client
always has all three.

| Field | Rule |
|---|---|
| `firstName` | string, trimmed, non-blank, 1–255 |
| `lastName` | string, trimmed, non-blank, 1–255 |
| `email` | string, trimmed, well-formed address, ≤ 255 |

`:id` is the target user's UUID.

## Success — `200 OK`

The corrected user, in the same `toAdministration()` projection `GET /api/v1/users` returns, so the
web can seed its cache from the response and the shape stays one contract:

```jsonc
{
  "data": {
    "id": "…",
    "firstName": "Camille",
    "lastName": "Renard",
    "email": "camille.renard@example.com",
    "role": "OPERATIONS_LEAD",
    "accessStatus": "ACTIVE",
    "invitedAt": "…", "invitedBy": { "id": "…", "firstName": "…", "lastName": "…" },
    "activatedAt": "…", "activatedBy": { … },
    "cancelledAt": null, "cancelledBy": null,
    "deactivatedAt": null, "deactivatedBy": null,
    "reactivatedAt": null, "reactivatedBy": null,
    "identityChanges": [
      {
        "changedAt": "2026-09-10T14:12:03.000+02:00",
        "changedBy": { "id": "…", "firstName": "Inès", "lastName": "Faure" },
        "previous": { "firstName": "Camile", "lastName": "Renard", "email": "camile.renard@example.com" },
        "next": { "firstName": "Camille", "lastName": "Renard", "email": "camille.renard@example.com" }
      }
    ]
  }
}
```

The lifecycle block and `identityChanges` are present because only an organization admin can reach
this endpoint at all, and that is the viewer the access history is exposed to (FR-014).

A submission identical to the stored identity also returns `200` with the user unchanged and no new
entry in `identityChanges` (FR-013, D10).

## Failures

| Status | Code | When |
|---|---|---|
| `401` | `E_UNAUTHORIZED_ACCESS` | No session — and also a viewer whose access status is not `ACTIVE`: `middleware.auth()` re-reads the user and refuses a non-active one before any policy runs, so GH-3's rule that only an active user holds a session is what answers here. The consultation seam behaves the same way |
| `403` | `E_AUTHORIZATION_FAILURE` | Viewer is an active user whose role may not correct identities: operations admin, operations lead, or observer (FR-005). Produced by `UserPolicy.updateIdentity` through Bouncer |
| `403` | `E_USER_IDENTITY_SELF_UPDATE` | `:id` is the requesting administrator (FR-004). Message points at the self-service path, which GH-25 delivers |
| `404` | `E_USER_NOT_FOUND` | No such user — and, by ADR-0003, the same answer a user of another organization would get (FR-007, D9) |
| `409` | `E_USER_EMAIL_CONFLICT` | The address is held by another user, compared without regard to case or surrounding whitespace, whatever that user's access status (FR-010) |
| `409` | `E_USER_ACTIVATION_LINK_UNAVAILABLE` | The target is `PENDING` and the email actually changes, and no activation link can be issued. Until GH-7 ships, this is every such request (FR-015, D7) |
| `422` | `E_VALIDATION_ERROR` | Malformed body, blank or over-long name, malformed address. Names the field at fault (FR-012) |
| `422` | `E_USER_IDENTITY_INVALID` | A value that survives VineJS but fails the domain helper |

Every refusal changes nothing: the write and its history row commit together or not at all (FR-011),
and a refused activation-link issue rolls the whole correction back (FR-015).

## Authorization matrix

| Viewer | Target | Outcome |
|---|---|---|
| Active organization admin | Another user, any access status | `200` |
| Active organization admin | Themselves | `403 E_USER_IDENTITY_SELF_UPDATE` |
| Active organization admin | Unknown id | `404 E_USER_NOT_FOUND` |
| Operations admin | Anyone | `403` |
| Operations lead, observer | Anyone | `403` |
| Non-active user, any role | Anyone | `401` — the session is refused before the policy runs |
| Unauthenticated | Anyone | `401` |

## Contract stability

`users.index` is unchanged except for the added `identityChanges` key on its existing
`toAdministration()` projection — an addition, gated by the same `includeAccessHistory` flag, so the
operations admin's payload is byte-for-byte what it was. `toObject()` (the `/auth/me` and
`/auth/login` session contract) and `toSummary()` are untouched.

The Tuyau registry under `apps/api/.adonisjs/client/` regenerates from the route and controller, and
`apps/web` picks the new route up as `tuyauQuery.users.update` (ADR-0005).
