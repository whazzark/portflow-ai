# Feature Specification: Create a Customer

**Feature ID**: `GH-193`
**GitHub Issue**: [#193](https://github.com/whazzark/portflow-ai/issues/193)
**Parent Roadmap**: `specs/site-references/customers/roadmap.md`
**Status**: Done (historical)
**Domain**: site-references

## Historical scope

Create a valid available customer with its required identity.

## Acceptance

An authorized administrator can create a customer with normalized, non-blank, unique identity values; invalid or duplicate values leave the dataset unchanged.

## Boundaries

Creation is individual and the new customer appears in the available collection. API authorization remains authoritative, permanent deletion is out of scope, and the behavior was delivered across the historical customer foundation issues #35, #36, and #37.

## Traceability

- Historical source issues: #35, #36, #37
- Parent roadmap: `specs/site-references/customers/roadmap.md`
