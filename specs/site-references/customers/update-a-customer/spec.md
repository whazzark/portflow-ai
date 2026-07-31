# Feature Specification: Update a Customer

**Feature ID**: `GH-194`
**GitHub Issue**: [#194](https://github.com/whazzark/portflow-ai/issues/194)
**Parent Roadmap**: `specs/site-references/customers/roadmap.md`
**Status**: Done
**Domain**: site-references

## Scope

Update the mutable identity of an available customer.

## Acceptance

An authorized administrator can edit an available customer's identity while preserving its identity and lifecycle state; invalid or duplicate values are rejected without mutation.

## Boundaries

Archived customers remain read-only until reactivation. API authorization remains authoritative and permanent deletion is out of scope.

## Traceability

- Parent roadmap: `specs/site-references/customers/roadmap.md`
