# Contract — Role Change Refusals in the User Workbench

**Feature**: [../spec.md](../spec.md) · **Surface**: `/users`, GH-24's `Edit` panel ·
**Builds on**: [GH-28's workbench contract](../../change-another-eligible-user-role/contracts/role-change-action.md)

No route, no search parameter, no control, and no copy is added. This slice changes two things in
the web. It changes what the workbench refetches when the API refuses a role change. It also makes
the authenticated frame send a viewer whose session was lost to sign-in, instead of rendering
nothing. Everything else below is existing behavior, restated because the spec's requirements rest
on it.

## Entry points — unchanged, restated because FR-010 depends on them

| Viewer | Own record | Another user's record |
|---|---|---|
| Organization admin | No `Edit` action, and a hand-typed `?userId=<own id>&mode=edit` falls back to the record: no role control is ever rendered (`mayEditUserIdentity`, `UserSheet`). | `Edit` panel with the role control, except on a deactivated user (GH-28). |
| Any other role | No `Edit` action (GH-24). | No `Edit` action (GH-24). |

So the self-role-change refusal is not reachable from the workbench. If it ever were, it would take
the generic refusal path below.

## Refusal handling in `EditUserForm` — unchanged code, new codes

`EditUserForm` needs no change. Every refusal that is not an email conflict already becomes a
form-level message plus a toast (`resourceFailureTitle('update', 'user', …)` with the API's message
as description). The toast is what FR-012 relies on, because it stays on screen when the panel
closes.

| API answer | Handled as |
|---|---|
| `409 E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN` | generic refusal — toast + form-level message; the panel then gives way (below) |
| `409 E_USER_SELF_ROLE_CHANGE` | generic refusal; not reachable from the workbench |
| `409 E_USER_DEACTIVATED_CANNOT_CHANGE_ROLE` | unchanged (GH-28) |
| Failure (network, 5xx) | unchanged (GH-28) — distinct from a refusal |

## What a refusal refreshes

`useUserMutations().changeRole`:

| Callback | Refreshes |
|---|---|
| `onSuccess` | the user collection, then `auth.me` (GH-28, unchanged) |
| `onError` | the user collection **and `auth.me`** (the latter is new) |

Why `auth.me` on a refusal: the final admin refusal only reaches a viewer who is no longer an active
organization admin. Had they been one, they would have counted, and the target would not have been
the last ([research D8](../research.md#d8--the-workbench-needs-one-invalidation-not-a-new-control)).
Their session is therefore always stale when this refusal arrives. Refetching it is what makes the
workbench follow them at once:

| What happened to the viewer | What the workbench does next |
|---|---|
| Demoted | `canEdit` turns false and `UserSheet` falls back to the record, which shows the target as an organization admin; the status tabs go, and the navigation follows the new role (GH-28 FR-011). The toast still carries the refusal. |
| Deactivated | `auth.me` answers 401 and `SessionProvider` reports the session as unauthenticated. `AuthenticatedLayout` then resets the session and invalidates the router, so `_authenticated`'s guard redirects to `/login`. This is new: until now the layout rendered a blank page (see below). |

## Losing the session mid-visit — `AuthenticatedLayout`

| Session status | Before | After |
|---|---|---|
| `authenticated` | frame rendered | unchanged |
| `loading`, `error` | `null` | unchanged |
| `unauthenticated` (a refetch answered 401) | `null` — a blank page, and the stale user stays cached, so the next navigation's guard still lets it through | `resetSession(queryClient)` then `router.invalidate()`, once — the sequence `useLogout` uses — ending on `/login` |
| `unauthenticated` with no user cached (a logout already cleared it) | `null` | unchanged — the logout re-runs the guards itself; stepping in would clear the session twice and cancel the guard's fetch |

This applies to every authenticated page, not only `/users`. Any viewer deactivated while signed in
now reaches sign-in rather than a blank frame.

## Save made of two parts

`saveUser` in `users-page.tsx` is unchanged: identity first, then the role, sequentially. When the
identity lands and the role is refused, the collection refreshed by the identity's `onSuccess`
already carries the correction. The toast names the user as they now stand, and the next save sends
the role alone, because the identity no longer differs from the stored one (FR-013).
