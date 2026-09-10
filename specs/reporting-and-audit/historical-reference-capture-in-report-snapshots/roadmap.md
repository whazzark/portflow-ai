# Roadmap: Historical Reference Capture in Report Snapshots

**GitHub Issue**: [#105](https://github.com/whazzark/portflow-ai/issues/105)
**Domain**: reporting-and-audit
**Status**: in-progress

The roadmap groups independently deliverable slices from the source issue.

## Delivery slices

The rows are ordered by execution order. Blockers are recorded as GitHub issue dependencies; the
`Blocked by` column repeats only the direct ones, since GitHub resolves the transitive ones.

| ID | Sub-feature | Blocked by | Status | Artifact |
|---|---|---|---|---|
| GH-106 | Build Deterministic Report Snapshot Payloads | GH-68, GH-94 | planned | ./build-deterministic-report-snapshot-payloads/ |
| GH-107 | Generate Immutable Report Snapshots Asynchronously | GH-106 | planned | ./generate-immutable-report-snapshots-asynchronously/ |
| GH-108 | List and Download Immutable Report Snapshots | GH-107 | planned | ./list-and-download-immutable-report-snapshots/ |

The three slices are a chain, from the payload to the stored snapshot to its listing, so nothing
here can be run in parallel.

## Cross-cutting context

Each slice is a vertical one: it owns its payload, command or query in `apps/api` and the matching
screen in `apps/web`, so that it stays independently deliverable as one issue, one feature
directory, one branch, and one PR. The roadmap previously carried a frontend-only slice, GH-109. It
was merged on 2026-09-10 and deleted from GitHub, so the table below is the only remaining record of
that split:

| Merged into | Absorbed frontend slice | Outcome |
|---|---|---|
| GH-108 | Build the Report Snapshots Screen | Listing and downloading the immutable snapshots of a discharge |

No report snapshot table has ever been migrated. GH-239, which was to persist and seed them, was
closed as not planned because it was a horizontal slice, and that persistence belongs to these
slices.

## Traceability

- Canonical issue: https://github.com/whazzark/portflow-ai/issues/105
- Child issue relationships are read from GitHub sub-issues, and the blockers above from the
  GitHub issue dependencies of the same children.
- Each child owns an independently reviewable roadmap or feature spec.
