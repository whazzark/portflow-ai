# Feature Specification: Update a Customer

**Feature ID**: `GH-194`
**GitHub Issue**: [#194](https://github.com/whazzark/portflow-ai/issues/194)
**Parent Roadmap**: `specs/site-references/customers/roadmap.md`
**Status**: Done (historical)
**Domain**: site-references

## Historical scope

Update the mutable identity of an available customer.

## Acceptance

An authorized administrator can edit an available customer's identity while preserving its identity and lifecycle state; invalid or duplicate values are rejected without mutation.

## Boundaries

Archived customers remain read-only until reactivation. API authorization remains authoritative, permanent deletion is out of scope, and the behavior was delivered across the historical customer foundation issues #35, #36, and #37.

## Traceability

- Historical source issues: #35, #36, #37
- Parent roadmap: `specs/site-references/customers/roadmap.md`
