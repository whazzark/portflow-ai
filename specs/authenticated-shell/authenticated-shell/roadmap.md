# Roadmap: Authenticated Shell

**GitHub Issue**: [#114](https://github.com/whazzark/portflow-ai/issues/114)
**Domain**: authenticated-shell
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

| ID | Sub-feature | Status | Artifact |
|---|---|---|---|
| GH-115 | Authenticate the Web Shell Against the API Session | done (historical) | ./authenticate-the-web-shell-against-the-api-session/ |
| GH-116 | Expose the Protected Application Frame and Minimal Navigation | done (historical) | ./expose-the-protected-application-frame-and-minimal-navigation/ |
| GH-117 | Force a Password Change After Login | implemented | ./force-a-password-change-after-login/ |

## Cross-cutting context

The source issue did not provide additional cross-cutting context.

**GH-117 ships a gate with no producer.** It defines `users.password_renewal_required_at`, enforces
it, and clears it, but nothing in the product records it: that stays with Reset an Active User
Password (`#17`) and Reactivate a User with Fresh Credentials (`#32`), neither of which is
delivered. Until one of them ships, the requirement reaches a running system only through the seeded
`emma.leroy@portflow.ai` fixture.

Whoever picks up `#17` or `#32` should read
[GH-117's research D2](./force-a-password-change-after-login/research.md) before adding a
`password_renewal_required_by_user_id` actor column to `users`. GH-117's own migration deliberately
carries **no** foreign key, which is what lets it add its column with no dialect branch; an actor
column would carry one, and on SQLite knex implements that by rebuilding `users` — a table half the
schema references — so it needs the `PRAGMA foreign_keys` window and `disableTransactions` that
`1785400000000_add_truck_return_to_service.ts` documents. GH-117's `down()` already pays that price
for the plain `dropColumn`, and its header records why.

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/114
- Child issue relationships are read from GitHub sub-issues.
- Each child owns an independently reviewable roadmap or feature spec.
