import crypto from 'node:crypto'

export const DELIVERY_PROFILES = {
  lite: {
    id: 'lite',
    label: 'delivery:lite',
    artifacts: [],
    gates: [],
    stages: ['implementing', 'independent-review', 'final-verification', 'delivery-review', 'done'],
  },
  standard: {
    id: 'standard',
    label: 'delivery:standard',
    artifacts: ['spec.md', 'plan.md'],
    gates: ['ready-to-build'],
    stages: [
      'drafting',
      'waiting-for-build-approval',
      'implementing',
      'independent-review',
      'final-verification',
      'delivery-review',
      'done',
    ],
  },
  'high-assurance': {
    id: 'high-assurance',
    label: 'delivery:high-assurance',
    artifacts: ['spec.md', 'plan.md'],
    gates: ['spec-review', 'plan-review'],
    stages: [
      'drafting',
      'waiting-for-spec-approval',
      'planning',
      'waiting-for-plan-approval',
      'implementing',
      'independent-review',
      'final-verification',
      'delivery-review',
      'done',
    ],
  },
}

export const DELIVERY_STAGE_LABELS = {
  drafting: 'Specification and plan',
  'waiting-for-spec-approval': 'Spec review',
  planning: 'Technical plan',
  'waiting-for-plan-approval': 'Plan review',
  'waiting-for-build-approval': 'Ready to build',
  implementing: 'Implementation',
  'independent-review': 'Independent review',
  'final-verification': 'Final verification',
  'delivery-review': 'Delivery review',
  'waiting-for-decision': 'Waiting for decision',
  blocked: 'Blocked',
  failed: 'Failed',
  done: 'Done',
}

export const DELIVERY_KANBAN_STATUS = {
  drafting: 'In Progress',
  planning: 'In Progress',
  'waiting-for-spec-approval': 'Review',
  'waiting-for-plan-approval': 'Review',
  'waiting-for-build-approval': 'Review',
  implementing: 'In Progress',
  'independent-review': 'Review',
  'final-verification': 'Review',
  'delivery-review': 'Review',
  'waiting-for-decision': 'Blocked',
  blocked: 'Blocked',
  failed: 'Blocked',
  done: 'Done',
}

export const DELIVERY_TRANSITIONS = {
  drafting: new Set([
    'waiting-for-build-approval',
    'waiting-for-spec-approval',
    'waiting-for-decision',
    'blocked',
  ]),
  'waiting-for-spec-approval': new Set(['planning', 'drafting', 'blocked']),
  planning: new Set(['waiting-for-plan-approval', 'waiting-for-decision', 'blocked']),
  'waiting-for-plan-approval': new Set(['implementing', 'planning', 'blocked']),
  'waiting-for-build-approval': new Set(['implementing', 'drafting', 'blocked']),
  implementing: new Set(['independent-review', 'waiting-for-decision', 'blocked']),
  'independent-review': new Set(['implementing', 'final-verification', 'blocked']),
  'final-verification': new Set(['implementing', 'delivery-review', 'blocked']),
  'delivery-review': new Set(['implementing', 'done', 'blocked']),
  'waiting-for-decision': new Set(['drafting', 'planning', 'implementing', 'blocked']),
  blocked: new Set(['drafting', 'planning', 'implementing']),
  failed: new Set(['drafting', 'planning', 'implementing']),
  done: new Set(),
}

export function resolveDeliveryProfile({ requested = null, labels = [] } = {}) {
  if (requested) {
    if (!DELIVERY_PROFILES[requested]) {
      throw new Error(`Unknown delivery profile: ${requested}`)
    }
    return DELIVERY_PROFILES[requested]
  }
  const names = labels.map((label) => (typeof label === 'string' ? label : label.name))
  const unknown = names.filter(
    (name) =>
      name.startsWith('delivery:') &&
      !Object.values(DELIVERY_PROFILES).some((profile) => profile.label === name),
  )
  if (unknown.length > 0) {
    throw new Error(`Unknown delivery profile label: ${unknown.join(', ')}`)
  }
  const matches = Object.values(DELIVERY_PROFILES).filter((profile) =>
    names.includes(profile.label),
  )
  if (matches.length > 1) {
    throw new Error('The issue has multiple delivery profile labels.')
  }
  return matches[0] ?? DELIVERY_PROFILES.standard
}

export function artifactHash(content) {
  return crypto
    .createHash('sha256')
    .update(String(content ?? ''))
    .digest('hex')
}

export function approvalFingerprint(gate, artifacts) {
  const selected =
    gate === 'spec-review'
      ? { spec: artifacts.spec ?? '' }
      : {
          spec: artifacts.spec ?? '',
          plan: normalizePlanForApproval(artifacts.plan ?? ''),
        }
  return artifactHash(JSON.stringify(selected))
}

export function approvalIsCurrent(approval, gate, artifacts) {
  return approval?.gate === gate && approval?.fingerprint === approvalFingerprint(gate, artifacts)
}

export function parseImplementationSlices(plan = '', tasks = '') {
  const fromPlan = markdownChecklistSection(plan, 'Implementation Slices')
  const source = fromPlan.length > 0 ? fromPlan : markdownChecklist(tasks)
  return source.map((item, index) => ({
    id: item.id ?? `slice-${String(index + 1).padStart(2, '0')}`,
    title: item.title,
    completed: item.completed,
  }))
}

export function validateDeliveryArtifacts({ profile, artifacts }) {
  const errors = []
  const warnings = []

  for (const file of profile.artifacts) {
    const key = file.replace(/\.md$/, '')
    if (!String(artifacts[key] ?? '').trim()) {
      errors.push(`Missing required artifact: ${file}`)
    }
  }

  if (/\[NEEDS CLARIFICATION(?::[^\]]*)?\]/i.test(artifacts.spec ?? '')) {
    errors.push('The specification contains unresolved clarification markers.')
  }

  const slices = parseImplementationSlices(artifacts.plan, artifacts.tasks)
  if (profile.id !== 'lite') {
    if (slices.length === 0) {
      errors.push('The plan must define an `## Implementation Slices` checklist.')
    } else if (slices.length < 5) {
      errors.push(`The delivery has ${slices.length} slices; define at least 5 or use lite.`)
    } else if (slices.length > 15) {
      errors.push(`The delivery has ${slices.length} slices; split it or reduce it to 15 or fewer.`)
    } else if (slices.length > 10) {
      warnings.push(`The delivery has ${slices.length} slices; consider a smaller delivery unit.`)
    }
  }

  return { valid: errors.length === 0, errors, warnings, slices }
}

export function deriveDeliveryState(context) {
  const profile = resolveDeliveryProfile({
    requested: context.profile,
    labels: context.issue?.labels ?? [],
  })
  const artifacts = context.artifacts ?? {}
  const validation = validateDeliveryArtifacts({ profile, artifacts })
  const approvals = context.approvals ?? []
  const pullRequest = context.pullRequest ?? null
  const review = context.review ?? null
  const checks = context.checks ?? { passed: false, evidence: [] }

  if (pullRequest?.merged) {
    return stateResult({ profile, stage: 'done', validation, approvals, review, checks })
  }
  if (context.blocker) {
    return stateResult({
      profile,
      stage: context.blocker.kind === 'decision' ? 'waiting-for-decision' : 'blocked',
      validation,
      approvals,
      review,
      checks,
      blockers: [context.blocker],
    })
  }
  if (profile.id === 'high-assurance') {
    const specReady =
      String(artifacts.spec ?? '').trim() &&
      !/\[NEEDS CLARIFICATION(?::[^\]]*)?\]/i.test(artifacts.spec ?? '')
    if (!specReady) {
      return stateResult({ profile, stage: 'drafting', validation, approvals, review, checks })
    }
    const specApproval = approvals.find((candidate) =>
      approvalIsCurrent(candidate, 'spec-review', artifacts),
    )
    if (!specApproval) {
      return stateResult({
        profile,
        stage: 'waiting-for-spec-approval',
        validation,
        approvals,
        review,
        checks,
      })
    }
    if (!String(artifacts.plan ?? '').trim() || !validation.valid) {
      return stateResult({
        profile,
        stage: 'planning',
        validation,
        approvals,
        review,
        checks,
      })
    }
    const planApproval = approvals.find((candidate) =>
      approvalIsCurrent(candidate, 'plan-review', artifacts),
    )
    if (!planApproval) {
      return stateResult({
        profile,
        stage: 'waiting-for-plan-approval',
        validation,
        approvals,
        review,
        checks,
      })
    }
  } else if (!validation.valid) {
    return stateResult({ profile, stage: 'drafting', validation, approvals, review, checks })
  } else if (profile.id === 'standard') {
    const approval = approvals.find((candidate) =>
      approvalIsCurrent(candidate, 'ready-to-build', artifacts),
    )
    if (!approval) {
      return stateResult({
        profile,
        stage: 'waiting-for-build-approval',
        validation,
        approvals,
        review,
        checks,
      })
    }
  }

  if (profile.id === 'lite' && !pullRequest) {
    return stateResult({
      profile,
      stage: 'implementing',
      validation,
      approvals,
      review,
      checks,
    })
  }

  if (validation.slices.some((slice) => !slice.completed)) {
    return stateResult({
      profile,
      stage: 'implementing',
      validation,
      approvals,
      review,
      checks,
    })
  }

  if (!review?.completed) {
    return stateResult({
      profile,
      stage: 'independent-review',
      validation,
      approvals,
      review,
      checks,
    })
  }
  if ((review.findings ?? []).some((finding) => finding.status === 'open')) {
    return stateResult({
      profile,
      stage: 'implementing',
      validation,
      approvals,
      review,
      checks,
    })
  }
  if (!checks.passed) {
    return stateResult({
      profile,
      stage: 'final-verification',
      validation,
      approvals,
      review,
      checks,
    })
  }
  return stateResult({
    profile,
    stage: 'delivery-review',
    validation,
    approvals,
    review,
    checks,
  })
}

export function assertDeliveryTransition(from, to) {
  if (from === to) {
    return true
  }
  if (!DELIVERY_TRANSITIONS[from]?.has(to)) {
    throw new Error(`Invalid delivery transition: ${from} → ${to}`)
  }
  return true
}

export function parseDeliveryArguments(argv) {
  const values = argv[0] === '--' ? argv.slice(1) : [...argv]
  const action = values[0] && !values[0].startsWith('-') ? values.shift() : 'status'
  const result = {
    action,
    issue: null,
    profile: null,
    featureDirectory: null,
    gate: null,
    dryRun: false,
    json: false,
  }
  while (values.length > 0) {
    const value = values.shift()
    if (value === '--') {
      continue
    }
    if (/^\d+$/.test(value) && !result.issue) {
      result.issue = Number(value)
    } else if (value === '--issue') {
      result.issue = positiveInteger(values.shift(), 'issue')
    } else if (value === '--profile') {
      result.profile = values.shift() ?? null
    } else if (value === '--feature-dir') {
      result.featureDirectory = values.shift() ?? null
    } else if (value === '--gate') {
      result.gate = values.shift() ?? null
    } else if (value === '--dry-run') {
      result.dryRun = true
    } else if (value === '--json') {
      result.json = true
    } else {
      throw new Error(`Unexpected argument: ${value}`)
    }
  }
  return result
}

function positiveInteger(value, label) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error(`${label} must be a positive integer.`)
  }
  return number
}

function stateResult({ profile, stage, validation, approvals, review, checks, blockers = [] }) {
  const slices = validation.slices
  return {
    profile: profile.id,
    stage,
    stageLabel: DELIVERY_STAGE_LABELS[stage],
    kanbanStatus: DELIVERY_KANBAN_STATUS[stage],
    validation,
    progress: {
      completed: slices.filter((slice) => slice.completed).length,
      total: slices.length,
      slices,
    },
    approvals,
    review,
    checks,
    blockers,
  }
}

function markdownChecklistSection(markdown, heading) {
  const match = String(markdown).match(
    new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'im'),
  )
  return match ? markdownChecklist(match[1]) : []
}

function markdownChecklist(markdown) {
  return [...String(markdown).matchAll(/^- \[([ xX])\]\s+(.+)$/gm)].map((match) => {
    const idMatch = match[2].match(/^`?([a-z0-9][a-z0-9-]+)`?\s*[—:-]\s*(.+)$/i)
    return {
      id: idMatch?.[1] ?? null,
      title: idMatch?.[2] ?? match[2],
      completed: match[1].toLowerCase() === 'x',
    }
  })
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizePlanForApproval(plan) {
  return String(plan).replace(
    /(^##\s+Implementation Slices\s*$[\s\S]*?)(?=^##\s|(?![\s\S]))/im,
    (section) => section.replace(/^- \[[xX]\]/gm, '- [ ]'),
  )
}
