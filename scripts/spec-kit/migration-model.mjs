import path from 'node:path'

export function buildArtifactModel(issues, hierarchy) {
  const issuesByNumber = new Map(issues.map((issue) => [issue.number, issue]))
  const hierarchyByNumber = new Map(hierarchy.map((entry) => [entry.number, entry]))
  const roadmapNumbers = new Set(
    issues
      .filter(
        (issue) =>
          hasLabel(issue, 'epic') ||
          (hierarchyByNumber.get(issue.number)?.children.length ?? 0) > 0,
      )
      .map((issue) => issue.number),
  )
  const parentByChild = new Map(
    hierarchy.filter((entry) => entry.parent !== null).map((entry) => [entry.number, entry.parent]),
  )
  const directoryByIssue = new Map()

  function directoryFor(issueNumber) {
    const cached = directoryByIssue.get(issueNumber)
    if (cached) {
      return cached
    }

    const issue = issuesByNumber.get(issueNumber)
    if (!issue) {
      throw new Error(`GitHub hierarchy references missing issue #${issueNumber}`)
    }

    const parentNumber = parentByChild.get(issueNumber)
    const parentDirectory =
      parentNumber && roadmapNumbers.has(parentNumber) ? directoryFor(parentNumber) : null
    const directory = parentDirectory
      ? path.posix.join(parentDirectory, slug(issue.title))
      : path.posix.join('specs', domainSlug(issue), slug(issue.title))

    directoryByIssue.set(issueNumber, directory)
    return directory
  }

  return issues
    .map((issue) => {
      const kind = roadmapNumbers.has(issue.number) ? 'roadmap' : 'feature'
      const directory = directoryFor(issue.number)
      return {
        issue: issue.number,
        kind,
        path: path.posix.join(directory, kind === 'roadmap' ? 'roadmap.md' : 'spec.md'),
        parent: parentByChild.get(issue.number) ?? null,
        targetSpecStatus: targetSpecStatus(issue),
      }
    })
    .sort((a, b) => a.issue - b.issue)
}

export function domainSlug(issue) {
  const milestone = issue?.milestone?.title ?? ''
  if (milestone.startsWith('0.')) {
    return 'user-administration'
  }
  if (milestone.startsWith('1.')) {
    return 'site-references'
  }
  if (milestone.startsWith('2.')) {
    return 'discharge-preparation'
  }
  if (milestone.startsWith('3.')) {
    return 'discharge-execution'
  }
  if (milestone.startsWith('4.')) {
    return 'reporting-and-audit'
  }
  if (milestone.startsWith('5.')) {
    return 'operations-dashboard'
  }
  if (milestone.toLowerCase().includes('authenticated shell')) {
    return 'authenticated-shell'
  }
  return 'standalone'
}

export function slug(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function targetSpecStatus(issue) {
  if (issue.state === 'closed' || issue.state === 'CLOSED') {
    return 'Done'
  }
  if (hasLabel(issue, 'speckit:intake') || hasLabel(issue, 'triage:needs-triage')) {
    return 'Intake'
  }
  if (hasLabel(issue, 'speckit:ready') || hasLabel(issue, 'agent:ready')) {
    return 'Ready'
  }
  return 'Spec Draft'
}

function hasLabel(issue, label) {
  return issue.labels?.some((candidate) => candidate.name === label)
}
