# Contract — The `Remove` access action in the `/users` workbench

**Feature**: [../spec.md](../spec.md) · **Seam**: [remove-user.md](./remove-user.md)

The workbench half of the slice. No route, no search parameter, and no screen is added: the action
joins the access actions the record footer and the row menu already offer.

## Where it is offered

`userAccessActions(viewer, user)` is the single rule, asked by both `UserAccessActions` (record
footer) and `UserRowActions` (row menu):

| Viewer | Target | Actions |
|---|---|---|
| Organization admin | `PENDING` or `CANCELLED`, not the viewer | `remove` |
| Organization admin | `ACTIVE`, not the viewer | `deactivate` (unchanged) |
| Organization admin | `DEACTIVATED`, or the viewer's own record | none |
| Anyone else | any | none |

An action that does not apply is absent, not disabled (FR-014, FR-016). An operations admin only
ever sees active users, so a pending or cancelled row never reaches them. In the row menu, `Remove`
comes last, after whatever else the row offers, with the `destructive` variant.

## Confirmation

Opened by `Remove` in either place; the same `UserAccessDialog`, with `action = 'remove'`.

| Element | Content |
|---|---|
| Title | `Remove user?` |
| Description | Names the user, says the removal is permanent and cannot be undone, that their activation link stops working, and that their email can be invited again. |
| Cancel | `Cancel` — closes with no request sent (FR-017) |
| Confirm | `Remove`; `Removing…` and disabled while in flight. Styled like every other confirmation's action — the destructive variant is on the button that opens it |

One confirmation, no typed value (FR-017).

## Outcomes

| Outcome | What the administrator sees | Requirement |
|---|---|---|
| `204` | The dialog closes; toast `User “Name” removed`; the collection refreshes, the user leaves the table and every count, and an open record closes because its user is no longer visible | FR-018 |
| 409 active | Toast `Unable to remove user “Name”` — "This user has activated their access, so they are kept. Deactivate them instead." The collection refreshes, so the user moves to the active view, and the record or row the dialog was opened from closes with it | FR-020 |
| 409 deactivated | Same title — "This user once held access, so they are kept." | FR-020 |
| 409 referenced | Same title — "This user is named in operational records, so they are kept." The dialog stays open over an unchanged user | FR-020 |
| 404 | Same title — "This user no longer exists." The refresh drops the row, and the record or row the dialog was opened from closes with it | US2 scenario 5 |
| Network failure or 5xx | Same title with the transport error; the dialog stays open, the user is still listed, and `Remove` can be pressed again | FR-019 |

The collection is refreshed on success **and** on every failure (`useUserMutations.remove`), so the
reason is always read against a workbench that agrees with the server.

## Copy

All in `helpers/user-access-copy.ts`, keyed by the new `'remove'` action, and built from the
`resource-copy` sentence shapes; the refusal reasons join `USER_ACCESS_REFUSAL_REASONS` under their
codes. `describeUserAccessEffect` starts using its `action` argument.
