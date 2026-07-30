# Delivery status

Delivery state is tracked in the Portflow Roadmap Project, not by mutually exclusive execution labels.

## Project `Status` values

| Status | Meaning |
| --- | --- |
| `Backlog` | Ordered work that is not ready to start. |
| `Ready` | Approved work with no blocking dependency. |
| `In Progress` | Work is active. |
| `Review` | Work is waiting at a review or delivery gate. |
| `Blocked` | An external decision or dependency prevents progress. |
| `Done` | The linked issue is closed. |

Detailed steps, implementation-slice progress, artifact-hash approvals, independent-review findings, and verification evidence are projected into the Draft PR. They are not a second editable Project field.

Priority, `epic`, milestone, Wayfinder, and work-type labels remain orthogonal metadata. Do not add a second execution-state label.

The stable `delivery:lite`, `delivery:standard`, and `delivery:high-assurance` labels select a risk profile; they do not represent workflow state. Apply at most one.

The old `triage:*`, `agent:ready`, `speckit:*`, and `speckit-*` labels are migration-only vocabulary. New automation updates only Project `Status` and the managed PR workflow block. The former `pnpm ai:run`, duplicate `Spec Status`, and mandatory full Spec Kit loop are retired.
