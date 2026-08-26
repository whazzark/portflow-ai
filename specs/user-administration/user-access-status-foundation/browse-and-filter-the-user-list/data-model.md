# Phase 1 Data Model: Browse and Filter the User List

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

This feature is read-only: it adds no table, no column, and no migration. Everything below already
exists in `users` (delivered by GH-2) and is described here as the shape the read contract projects.

## User

Source: `apps/api/app/models/user.ts` over `UserSchema` (`apps/api/database/schema.ts`).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Stable identity, self-assigned on create. |
| `firstName` | string | Displayed identity. |
| `lastName` | string | Displayed identity. |
| `email` | string | Case-insensitive unique; the identifying contact information. |
| `role` | `UserRole` | Exactly one. |
| `accessStatus` | `UserAccessStatus` | Exactly one. |
| `password` | string \| null | `serializeAs: null`. Never leaves the API. |
| `invitedAt` / `invitedByUserId` | datetime \| null / uuid \| null | Invitation event. |
| `activatedAt` / `activatedByUserId` | datetime \| null / uuid \| null | Invitation acceptance. |
| `cancelledAt` / `cancelledByUserId` | datetime \| null / uuid \| null | Invitation cancellation. |
| `deactivatedAt` / `deactivatedByUserId` | datetime \| null / uuid \| null | Deactivation. |
| `reactivatedAt` / `reactivatedByUserId` | datetime \| null / uuid \| null | Reactivation. |

### Relations to declare

Five self-referential `belongsTo(() => User)` relations, each on its `*ByUserId` foreign key:
`invitedBy`, `activatedBy`, `cancelledBy`, `deactivatedBy`, `reactivatedBy`. They mirror
`Customer.archivedBy` / `Customer.reactivatedBy` and exist only to resolve the actor's name for the
access record. Every one is nullable: a lifecycle event may have been recorded without an actor.

## Enumerations

`USER_ACCESS_STATUSES = ['PENDING', 'ACTIVE', 'CANCELLED', 'DEACTIVATED']`

| Status | `CONTEXT.md` term | Consultable by |
|---|---|---|
| `PENDING` | Pending User — invited, not activated | Organization admin |
| `ACTIVE` | Active access — may sign in | Organization admin, operations admin |
| `DEACTIVATED` | Sign-in prevented, history preserved | Organization admin |
| `CANCELLED` | Invitation withdrawn before activation | Organization admin |

`USER_ROLES = ['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER']`

| Role | May consult | Sees |
|---|---|---|
| `ORGANIZATION_ADMIN` | yes | every user, every access status, with lifecycle events |
| `OPERATIONS_ADMIN` | yes | active users only, without lifecycle events |
| `OPERATIONS_LEAD` | no | — |
| `OBSERVER` | no | — |

A viewer whose `accessStatus` is not `ACTIVE` never consults, whatever their role — and GH-3 already
prevents them from holding a session.

## Read projections

### `UserTransformer.toSummary()` — unchanged

`id`, `firstName`, `lastName`. Embedded by every site reference as a lifecycle actor, and reused
here for the same purpose.

### `UserTransformer.toObject()` — unchanged

The session contract returned by `GET /auth/me` and `POST /auth/login`. Not touched by this feature.

### `UserTransformer.toAdministration()` — new

The collection projection. Identity block for every authorized viewer:

`id`, `firstName`, `lastName`, `email`, `role`, `accessStatus`.

Lifecycle block, added for organization admins only (FR-006b), each pair present only when the event
is recorded:

`invitedAt` + `invitedBy`, `activatedAt` + `activatedBy`, `cancelledAt` + `cancelledBy`,
`deactivatedAt` + `deactivatedBy`, `reactivatedAt` + `reactivatedBy` — where each `*By` is a
`toSummary()` projection or `null`.

## State transitions

None. Access status transitions belong to the later write slices; this feature reads the current
status and the dated events already recorded.

## Derived, client-side only

Computed in `apps/web/src/features/users/` from the retrieved collection, never requested from the
API (FR-006a, FR-010 to FR-013):

- per-access-status partitions and their counts;
- the case-insensitive fragment match over `firstName`, `lastName`, and `email`;
- the role filter;
- the sort over displayed identity and role;
- the open record, resolved by `userId` from the collection.
