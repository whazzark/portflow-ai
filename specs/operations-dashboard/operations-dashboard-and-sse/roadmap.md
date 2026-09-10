# Roadmap: Operations Dashboard and SSE

**GitHub Issue**: [#110](https://github.com/whazzark/portflow-ai/issues/110)
**Domain**: operations-dashboard
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

The rows are ordered by execution order. Blockers are recorded as GitHub issue dependencies; the
`Blocked by` column repeats only the direct ones, since GitHub resolves the transitive ones.

| ID | Sub-feature | Blocked by | Status | Artifact |
|---|---|---|---|---|
| GH-111 | Consult Active Discharge Progress | GH-65, GH-84 | planned | ./consult-active-discharge-progress/ |
| GH-112 | Show Shift Context and Downtime Attention | GH-67, GH-111 | planned | ./show-shift-context-and-downtime-attention/ |
| GH-113 | Keep the Dashboard Synchronized through SSE | GH-112 | planned | ./keep-the-dashboard-synchronized-through-sse/ |

The three slices are a chain, so nothing here can be run in parallel.

## Cross-cutting context

Each slice is a vertical one: it owns its query in `apps/api` and the matching dashboard section in
`apps/web`, so that it stays independently deliverable as one issue, one feature directory, one
branch, and one PR. This roadmap never split its outcomes into backend and frontend halves, so it
has nothing to merge.

GH-111 was priority P0 in the milestone `3. Exploiter le modèle en lecture`, because it was meant to
read a seeded operational model. GH-237 and GH-238, which were to persist and seed that model, were
closed as not planned and their persistence moved into the execution slices, so the dashboard now
waits on real execution. Its priority and milestone were aligned with its two sisters on
2026-09-10.

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/110
- Child issue relationships are read from GitHub sub-issues, and the blockers above from the
  GitHub issue dependencies of the same children.
- Each child owns an independently reviewable roadmap or feature spec.
