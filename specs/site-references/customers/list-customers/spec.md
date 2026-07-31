# Feature Specification: List Customers

**Feature ID**: `GH-192`
**GitHub Issue**: [#192](https://github.com/whazzark/portflow-ai/issues/192)
**Parent Roadmap**: `specs/site-references/customers/roadmap.md`
**Status**: Done (historical)
**Domain**: site-references

## Historical scope

List the delivered customer collection, detail, available and archived states.

## Acceptance

An active user can consult customer records, distinguish available from archived records, inspect details, and recover from empty or retryable error states.

## Boundaries

Customer consultation remains available to active users while mutation controls remain restricted to authorized administrators. API authorization remains authoritative, permanent deletion is out of scope, and the behavior was delivered across the historical customer foundation issues #35, #36, and #37.

## Traceability

- Historical source issues: #35, #36, #37
- Parent roadmap: `specs/site-references/customers/roadmap.md`
