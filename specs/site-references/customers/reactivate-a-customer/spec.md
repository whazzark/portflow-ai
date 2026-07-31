# Feature Specification: Reactivate a Customer

**Feature ID**: `GH-196`
**GitHub Issue**: [#196](https://github.com/whazzark/portflow-ai/issues/196)
**Parent Roadmap**: `specs/site-references/customers/roadmap.md`
**Status**: Done (historical)
**Domain**: site-references

## Historical scope

Reactivate an archived customer while preserving its identity and history.

## Acceptance

An authorized administrator can reactivate an archived customer; it becomes available again without replacing its identity or historical references.

## Boundaries

Repeated or stale transitions are reported without falsely changing state. API authorization remains authoritative, permanent deletion is out of scope, and the behavior was delivered across the historical customer foundation issues #35, #36, and #37.

## Traceability

- Historical source issues: #35, #36, #37
- Parent roadmap: `specs/site-references/customers/roadmap.md`
