# Delivery status

Delivery state is tracked in the Portflow Roadmap Project, not by mutually exclusive execution labels.

## Project `Spec Status` values

| Status | Meaning |
| --- | --- |
| `Intake` | New request or product triage is still required. |
| `Spec Draft` | A spec is being authored or clarified. |
| `Spec Review` | The spec is in a Draft PR awaiting human approval. |
| `Plan Review` | The spec is approved and the plan awaits human approval. |
| `Ready` | Spec, plan, and tasks are approved for implementation. |
| `In Progress` | Codex is implementing the approved tasks. |
| `Review` | Implementation, convergence, and fresh review are in progress. |
| `Blocked` | Work cannot continue until an external decision or dependency changes. |
| `Done` | The PR is merged and the delivery is complete. |

Priority, `epic`, milestone, Wayfinder, and work-type labels remain orthogonal metadata. Do not add a second execution-state label.

The old `triage:*`, `agent:ready`, `speckit:*`, and `speckit-*` labels are migration-only vocabulary and are removed by the reviewed GitHub cutover. New automation must use the `Spec Status` field and explicit Spec Kit gates. The native Project `Status` field remains available for broad delivery state. The former `pnpm ai:run` launcher is retired.
