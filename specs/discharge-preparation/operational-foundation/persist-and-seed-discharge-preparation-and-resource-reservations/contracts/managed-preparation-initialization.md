# Contract: Managed Discharge Preparation Initialization

This contract describes the internal initialization behavior delivered by issue #236. It is not a
new HTTP endpoint and does not introduce a user-facing mutation workflow.

## Preconditions

- The site-reference foundation from issue #235 has completed successfully.
- The environment contains the managed lifecycle actor and eligible responsible Users.
- Managed reference keys resolve to exactly one existing parent.

## Initialization behavior

- Initialization creates or repairs exactly three managed graphs identified by stable scenario keys:
  Planned, Active, and Closed.
- Each graph contains a Discharge, Vessel Description, current Dock, Product Lots, Warehouse
  Door-to-Product-Lot assignments, Discharge Truck Assignments, planned/active Shift records,
  responsible Users, and explicit Shift resource memberships.
- Re-running initialization reuses managed identities and repairs managed drift without deleting or
  reassigning unrelated records.
- A missing or ambiguous required parent fails explicitly and does not silently create a partial
  relationship.
- A failed graph can be retried after its cause is corrected; previously completed independent graphs
  remain valid.

## Lifecycle and reservation behavior

- Planned and Active graphs retain current reservations for resources governed by the domain's
  conflict rules.
- Closed graphs retain historical assignments and snapshots but do not hold current reservations
  that block new Planned or Active use.
- Discharge Truck Assignments retain the Truck registration and Transport Company values captured at
  reservation time.
- Shift resources are explicit per Shift; no resource is inherited implicitly from another Shift.

## Integrity guarantees

- Product Lot ownership, Customer ownership, Door containment, Shift responsibility, and resource
  references remain valid.
- Product Lots are unique by their Discharge, Customer, and product identity.
- Planned Shift ranges are ordered and non-overlapping.
- Invalid reservation conflicts and incomplete graphs are rejected before they are accepted as a
  coherent managed scenario.
