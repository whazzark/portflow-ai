export const KANBAN_STATUS_OPTIONS = [
  {
    name: 'Backlog',
    color: 'GRAY',
    description: 'Qualified work that is not ready to start yet.',
    previousName: 'Todo',
  },
  {
    name: 'Ready',
    color: 'BLUE',
    description: 'Approved work with no blocking dependency.',
  },
  {
    name: 'In Progress',
    color: 'YELLOW',
    description: 'Work that is actively being specified, planned, or implemented.',
  },
  {
    name: 'Review',
    color: 'PURPLE',
    description: 'Work awaiting human review, CI, convergence, or delivery approval.',
  },
  {
    name: 'Blocked',
    color: 'RED',
    description: 'Work waiting for an external decision or dependency.',
  },
  {
    name: 'Done',
    color: 'GREEN',
    description: 'Delivered or historical work represented by a closed issue.',
  },
]

export const IMPLEMENTATION_ORDER = [
  38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 102, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62,
  63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 81, 82, 83, 84, 85, 86, 87, 74, 75, 76, 77, 78, 79,
  80, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 103, 104, 105, 106, 107, 108, 109,
  110, 111, 112, 113, 114, 117, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 144, 147, 180, 118, 119, 120, 121, 122, 123, 124,
]

const implementationRank = new Map(
  IMPLEMENTATION_ORDER.map((issueNumber, index) => [issueNumber, index]),
)

export function targetKanbanStatus(issue, specStatus, currentStatus = null) {
  if (normalizeIssueState(issue.state) === 'closed') {
    return 'Done'
  }
  if (['Ready', 'In Progress', 'Review', 'Blocked'].includes(currentStatus)) {
    return currentStatus
  }
  const statuses = {
    Ready: 'Ready',
    'In Progress': 'In Progress',
    'Spec Review': 'Review',
    'Plan Review': 'Review',
    Review: 'Review',
    Blocked: 'Blocked',
  }
  return statuses[specStatus] ?? 'Backlog'
}

export function targetSpecStatus(issue, currentSpecStatus) {
  if (normalizeIssueState(issue.state) === 'closed') {
    return 'Done'
  }
  return currentSpecStatus ?? 'Intake'
}

export function orderedOpenIssues(issues) {
  return issues
    .filter((issue) => normalizeIssueState(issue.state) === 'open')
    .toSorted((left, right) => {
      const leftRank = implementationRank.get(left.number) ?? Number.MAX_SAFE_INTEGER
      const rightRank = implementationRank.get(right.number) ?? Number.MAX_SAFE_INTEGER
      return leftRank - rightRank || left.number - right.number
    })
}

export function unrankedOpenIssues(issues) {
  return orderedOpenIssues(issues).filter((issue) => !implementationRank.has(issue.number))
}

export function statusCounts(issues, projectItemsByNumber) {
  const counts = Object.fromEntries(KANBAN_STATUS_OPTIONS.map(({ name }) => [name, 0]))
  for (const issue of issues) {
    const item = projectItemsByNumber.get(issue.number)
    const target = targetKanbanStatus(issue, item?.specStatus ?? null, item?.status ?? null)
    counts[target] += 1
  }
  return counts
}

function normalizeIssueState(value) {
  return String(value).toLowerCase()
}
