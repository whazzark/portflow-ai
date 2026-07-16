# Triage Labels

Every open non-PR issue has exactly one execution-state label. These labels are
mutually exclusive; priority, epic, Wayfinder, and work-type labels are
orthogonal and may coexist with one of them.

| Label | Meaning |
| --- | --- |
| `triage:needs-triage` | A maintainer must evaluate the issue before work starts. |
| `triage:needs-info` | The issue is waiting for information from its reporter or stakeholder. |
| `triage:ready-for-human` | The issue is specified but requires human implementation. |
| `agent:ready` | The issue is fully specified and explicitly eligible for local Orca execution. |

Only `agent:ready` authorizes `pnpm ai:run --issue <n>`. The launcher is a
label reader: it never creates, removes, translates, or assigns execution-state
labels. In particular, `agent:ready` is always an explicit human qualification.

Closed issues do not need an execution-state label. An issue that will not be
actioned is closed with GitHub's `not planned` reason.

## Verification

Run the following checks after changing labels or triage guidance:

```sh
gh label list --repo whazzark/portflow-ai --limit 100
gh api --paginate 'repos/whazzark/portflow-ai/issues?state=open&per_page=100' \
  --jq '.[] | select(.pull_request == null) | {number, labels: [.labels[].name]}'
```

Verify that all four labels exist, that `needs-triage` does not exist, and that
every open non-PR issue has exactly one label from the table above. Resolve zero
or multiple execution states through maintainer triage; never assign
`agent:ready` automatically.
