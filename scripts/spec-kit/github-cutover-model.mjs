const executionLabelPatterns = [/^agent:ready$/, /^triage:/, /^speckit:/, /^speckit-/]

export function planCutover({ manifest, issues, projectItems, repository, baseBranch }) {
  const issuesByNumber = new Map(issues.map((issue) => [issue.number, issue]))
  const projectByNumber = new Map(
    projectItems.filter((item) => item.number !== null).map((item) => [item.number, item]),
  )
  const statusByIssue = statusAssignments(manifest)

  return manifest.mappings.map((mapping) => {
    const issue = issuesByNumber.get(mapping.issue)
    if (!issue) {
      throw new Error(`Issue #${mapping.issue} is missing from GitHub`)
    }
    const targetSpecStatus = statusByIssue.get(mapping.issue)
    if (!targetSpecStatus) {
      throw new Error(`Issue #${mapping.issue} has no target Spec Status`)
    }

    const targetBody = buildIssueBody({
      mapping,
      repository,
      baseBranch,
    })
    const projectItem = projectByNumber.get(mapping.issue) ?? null
    const removeLabels = issue.labels
      .map((label) => (typeof label === 'string' ? label : label.name))
      .filter((label) => executionLabelPatterns.some((pattern) => pattern.test(label)))

    return {
      issue: mapping.issue,
      path: mapping.path,
      targetSpecStatus,
      body: {
        current: issue.body ?? '',
        target: targetBody,
        change: (issue.body ?? '') !== targetBody,
      },
      labels: {
        current: issue.labels.map((label) => (typeof label === 'string' ? label : label.name)),
        remove: removeLabels,
      },
      project: {
        itemId: projectItem?.id ?? null,
        currentSpecStatus: projectItem?.specStatus ?? null,
        operation: projectItem
          ? projectItem.specStatus === targetSpecStatus
            ? 'none'
            : 'update'
          : 'add',
        targetSpecStatus,
      },
    }
  })
}

export function changedActions(actions) {
  return actions.filter(
    (action) =>
      action.body.change || action.labels.remove.length > 0 || action.project.operation !== 'none',
  )
}

export function summarizeActions(actions) {
  return {
    issues: actions.length,
    changedIssues: changedActions(actions).length,
    bodyUpdates: actions.filter((action) => action.body.change).length,
    projectAdds: actions.filter((action) => action.project.operation === 'add').length,
    projectUpdates: actions.filter((action) => action.project.operation === 'update').length,
    labelRemovals: actions.reduce((total, action) => total + action.labels.remove.length, 0),
  }
}

export function buildIssueBody({ mapping, repository, baseBranch }) {
  const canonical = `https://github.com/${repository}/blob/${baseBranch}/${mapping.path}`
  const parent = mapping.parent ? `\n**Parent roadmap**: GH-${mapping.parent}` : ''

  return `## Spec Kit intake

This issue is tracked by the canonical Spec Kit artifact:

- **Artifact**: [${mapping.path}](${canonical})
- **Type**: ${mapping.kind === 'roadmap' ? 'Roadmap' : 'Feature specification'}${parent}

The detailed requirements, acceptance criteria, plan, tasks, and verification live in the artifact and its generated checklist. Keep this issue for intake, discussion, and delivery links.
`
}

function statusAssignments(manifest) {
  const assignments = new Map()
  for (const [status, issueNumbers] of Object.entries(manifest.targetSpecStatuses ?? {})) {
    for (const issueNumber of issueNumbers) {
      if (assignments.has(issueNumber)) {
        throw new Error(`Issue #${issueNumber} has multiple target Spec Status values`)
      }
      assignments.set(issueNumber, status)
    }
  }
  return assignments
}
