# Delivery Status and Labels

Delivery state is tracked in the Portflow Roadmap Project, not through execution labels.

## Project `Status`

| Status | Meaning |
| --- | --- |
| `Backlog` | Ordered work that is not selected or remains blocked. |
| `Ready` | One independently deliverable issue with resolved dependencies. |
| `In Progress` | Specification, planning, or implementation is active. |
| `Review` | Work is waiting at a human gate, PR review, or CI. |
| `Blocked` | An external decision or dependency prevents progress. |
| `Done` | The linked issue is closed and merged. |

Priority, `epic`, milestone, Wayfinder, domain, and work-type labels are orthogonal metadata. Spec
Kit does not read or update Project status or labels in the vanilla workflow.

The former `delivery:*`, `triage:*`, `agent:ready`, `speckit:*`, and `speckit-*` labels are legacy
workflow vocabulary. Do not apply them to new work. Detailed Spec Kit phases remain internal to the
active Spec Kit run and feature artifacts.
