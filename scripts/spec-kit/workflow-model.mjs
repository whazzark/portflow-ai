import path from 'node:path'

export const PROJECT_NUMBER = 5
export const SPEC_STATUSES = {
  clarify: 'Spec Draft',
  specify: 'Spec Draft',
  'review-spec': 'Spec Review',
  plan: 'Plan Review',
  checklist: 'Plan Review',
  'review-plan': 'Plan Review',
  tasks: 'Ready',
  analyze: 'Ready',
  implement: 'In Progress',
  checks: 'In Progress',
  converge: 'Review',
  review: 'Review',
  delivery: 'Review',
}

export const KANBAN_STATUSES = {
  clarify: 'In Progress',
  specify: 'In Progress',
  'review-spec': 'Review',
  plan: 'In Progress',
  checklist: 'In Progress',
  'review-plan': 'Review',
  tasks: 'In Progress',
  analyze: 'In Progress',
  implement: 'In Progress',
  checks: 'In Progress',
  converge: 'Review',
  review: 'Review',
  delivery: 'Review',
}

export const PHASES = [
  { id: 'specify', skill: 'speckit-specify', checkpoint: true },
  { id: 'clarify', skill: 'speckit-clarify', checkpoint: true },
  { id: 'review-spec', gate: 'Spec Review' },
  { id: 'plan', skill: 'speckit-plan', checkpoint: true },
  { id: 'checklist', skill: 'speckit-checklist', checkpoint: true },
  { id: 'review-plan', gate: 'Plan Review' },
  { id: 'tasks', skill: 'speckit-tasks', checkpoint: true },
  { id: 'analyze', skill: 'speckit-analyze', checkpoint: true },
  { id: 'implement', skill: 'speckit-implement', checkpoint: true },
  { id: 'checks', checks: true },
  { id: 'converge', skill: 'speckit-converge', checkpoint: true },
  { id: 'review', review: true },
  { id: 'delivery', gate: 'Delivery Review' },
]

export const DEFAULT_MODEL_POLICY = 'economy'
export const MODEL_POLICIES = {
  economy: {
    specify: { model: 'gpt-5.6-terra', reasoningEffort: 'medium' },
    clarify: { model: 'gpt-5.6-terra', reasoningEffort: 'low' },
    plan: { model: 'gpt-5.6-sol', reasoningEffort: 'medium' },
    checklist: { model: 'gpt-5.6-luna', reasoningEffort: 'low' },
    tasks: { model: 'gpt-5.6-luna', reasoningEffort: 'low' },
    analyze: { model: 'gpt-5.6-terra', reasoningEffort: 'medium' },
    implement: { model: 'gpt-5.6-terra', reasoningEffort: 'medium' },
    converge: { model: 'gpt-5.6-terra', reasoningEffort: 'medium' },
    review: { model: 'gpt-5.6-sol', reasoningEffort: 'high' },
  },
  quality: {
    specify: { model: 'gpt-5.6-sol', reasoningEffort: 'high' },
    clarify: { model: 'gpt-5.6-sol', reasoningEffort: 'high' },
    plan: { model: 'gpt-5.6-sol', reasoningEffort: 'high' },
    checklist: { model: 'gpt-5.6-luna', reasoningEffort: 'medium' },
    tasks: { model: 'gpt-5.6-terra', reasoningEffort: 'medium' },
    analyze: { model: 'gpt-5.6-sol', reasoningEffort: 'high' },
    implement: { model: 'gpt-5.6-terra', reasoningEffort: 'high' },
    converge: { model: 'gpt-5.6-sol', reasoningEffort: 'high' },
    review: { model: 'gpt-5.6-sol', reasoningEffort: 'xhigh' },
  },
}

const codexPhaseIds = new Set(
  PHASES.filter((phase) => phase.skill || phase.review).map(({ id }) => id),
)
const commitPattern =
  /^(feat|fix|docs|test|refactor|perf|build|ci|chore|revert)\([a-z0-9]+(?:-[a-z0-9]+)*\): [A-Z][^\n.]*[^.\s]$/
const conventionalBranchTypes = [
  ['fix', new Set(['bug', 'defect', 'regression'])],
  ['docs', new Set(['docs', 'documentation'])],
  ['refactor', new Set(['refactor', 'refactoring'])],
  ['perf', new Set(['perf', 'performance'])],
  ['test', new Set(['test', 'testing'])],
  ['build', new Set(['build'])],
  ['ci', new Set(['ci'])],
  ['chore', new Set(['chore', 'maintenance'])],
  ['revert', new Set(['revert'])],
  ['feat', new Set(['enhancement', 'feature'])],
]

export function parseArguments(argv) {
  const args = argv[0] === '--' ? argv.slice(1) : [...argv]
  const result = {
    action: 'run',
    issue: null,
    featureDirectory: null,
    dryRun: false,
    modelPolicy: null,
    escalatedPhases: [],
  }

  if (['run', 'resume', 'status'].includes(args[0])) {
    result.action = args.shift()
  }

  while (args.length > 0) {
    const argument = args.shift()
    if (argument === '--dry-run') {
      result.dryRun = true
      continue
    }
    if (argument === '--issue') {
      result.issue = parseIssueNumber(args.shift())
      continue
    }
    if (argument === '--feature-dir') {
      result.featureDirectory = args.shift() ?? null
      continue
    }
    if (argument === '--model-policy') {
      result.modelPolicy = validateModelPolicy(args.shift())
      continue
    }
    if (argument === '--escalate-phase') {
      result.escalatedPhases.push(validateCodexPhase(args.shift()))
      continue
    }
    if (!result.issue && /^\d+$/.test(argument)) {
      result.issue = parseIssueNumber(argument)
      continue
    }
    throw new Error(`Unexpected argument: ${argument}`)
  }

  return result
}

export function validateModelPolicy(value) {
  if (!Object.hasOwn(MODEL_POLICIES, value)) {
    throw new Error(`The model policy must be one of: ${Object.keys(MODEL_POLICIES).join(', ')}.`)
  }
  return value
}

export function validateCodexPhase(value) {
  if (!codexPhaseIds.has(value)) {
    throw new Error(`The escalated phase must be a Codex phase: ${[...codexPhaseIds].join(', ')}.`)
  }
  return value
}

export function modelConfigForPhase(phase, policy = DEFAULT_MODEL_POLICY) {
  const selectedPolicy = MODEL_POLICIES[validateModelPolicy(policy)]
  const config = selectedPolicy[validateCodexPhase(phase)]
  return { ...config }
}

export function resolvePhaseModel(state, phase) {
  state.modelPolicy ??= DEFAULT_MODEL_POLICY
  state.escalatedPhases ??= []
  state.phaseModels ??= {}
  if (!state.phaseModels[phase]) {
    const policy = state.escalatedPhases.includes(phase) ? 'quality' : state.modelPolicy
    state.phaseModels[phase] = modelConfigForPhase(phase, policy)
  }
  return { ...state.phaseModels[phase] }
}

export function applyPhaseEscalations(state, phases = []) {
  state.escalatedPhases ??= []
  state.phaseModels ??= {}
  for (const phase of phases) {
    validateCodexPhase(phase)
    if (!state.escalatedPhases.includes(phase)) {
      state.escalatedPhases.push(phase)
    }
    state.phaseModels[phase] = modelConfigForPhase(phase, 'quality')
  }
}

export function configureModelPolicy(state, { modelPolicy = null, escalatedPhases = [] } = {}) {
  if (state.modelPolicy && modelPolicy && state.modelPolicy !== modelPolicy) {
    throw new Error(
      `This workflow already uses the ${state.modelPolicy} model policy; use --escalate-phase for a targeted change.`,
    )
  }
  state.modelPolicy ??= modelPolicy ?? DEFAULT_MODEL_POLICY
  validateModelPolicy(state.modelPolicy)
  state.escalatedPhases ??= []
  state.phaseModels ??= {}
  applyPhaseEscalations(state, escalatedPhases)
  return state
}

export function parseIssueNumber(value) {
  const issue = Number(value)
  if (!Number.isSafeInteger(issue) || issue < 1) {
    throw new Error('The GitHub issue number must be a positive integer.')
  }
  return issue
}

export function validateFeatureDirectory(value, root = process.cwd()) {
  if (!value) {
    throw new Error('A canonical feature directory is required.')
  }
  if (path.isAbsolute(value) || value.includes('\\')) {
    throw new Error('The feature directory must be a POSIX path relative to the repository.')
  }

  const normalized = path.posix.normalize(value)
  const segments = normalized.split('/')
  if (
    normalized !== value ||
    segments[0] !== 'specs' ||
    segments.length < 3 ||
    segments.some((segment) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segment))
  ) {
    throw new Error(
      'The feature directory must match specs/<domain>/<feature> or specs/<domain>/<epic>/<feature> using lowercase slugs.',
    )
  }

  const absolute = path.resolve(root, normalized)
  const specsRoot = `${path.resolve(root, 'specs')}${path.sep}`
  if (!absolute.startsWith(specsRoot)) {
    throw new Error('The feature directory must resolve inside specs/.')
  }
  return normalized
}

export function featureDirectoryFromIssue(issue) {
  const matches = [
    ...String(issue.body ?? '').matchAll(
      /(?:https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/blob\/[^/\s]+\/)?(specs\/[a-z0-9/-]+)\/(spec|plan|tasks|roadmap)\.md/gi,
    ),
  ]
  const featureArtifact = matches.find((match) => match[2].toLowerCase() !== 'roadmap')
  if (featureArtifact) {
    return featureArtifact[1]
  }
  const roadmap = matches.find((match) => match[2].toLowerCase() === 'roadmap')
  return roadmap ? `${roadmap[1]}/${slugify(issue.title)}` : null
}

export function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function domainScope(featureDirectory) {
  const segments = featureDirectory.split('/')
  return slugify(segments.at(-1)) || slugify(segments[1]) || 'delivery'
}

export function branchType(issue) {
  const labels = (issue.labels ?? [])
    .map((label) => (typeof label === 'string' ? label : label.name))
    .filter(Boolean)
    .map((label) => label.toLowerCase())
  const explicitTypes = [
    ...new Set(
      labels
        .filter((label) => label.startsWith('type:'))
        .map((label) => label.slice('type:'.length))
        .filter((type) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(type)),
    ),
  ]

  if (explicitTypes.length > 1) {
    throw new Error(`Issue has conflicting branch type labels: ${explicitTypes.join(', ')}.`)
  }
  if (explicitTypes.length === 1) {
    return explicitTypes[0]
  }

  for (const [type, aliases] of conventionalBranchTypes) {
    if (labels.some((label) => aliases.has(label))) {
      return type
    }
  }
  return 'feat'
}

export function branchName(issue, featureDirectory) {
  const slug = slugify(issue.title || featureDirectory.split('/').at(-1))
  return `${branchType(issue)}/${issue.number}-${slug}`
}

export function branchNameForFeature(
  featureDirectory,
  spec = '',
  workflowDescription = '',
  issue = {},
) {
  const source = `${spec}\n${workflowDescription}`
  const issueNumber =
    source.match(/\bGH-(\d+)\b/i)?.[1] ??
    source.match(/\bGitHub\s+issue\s*#(\d+)\b/i)?.[1] ??
    source.match(/github\.com\/[^/\s]+\/[^/\s]+\/issues\/(\d+)\b/i)?.[1]

  if (!issueNumber) {
    throw new Error(
      `Cannot determine the GitHub issue number for feature directory ${featureDirectory}.`,
    )
  }

  const slug = slugify(validateFeatureDirectory(featureDirectory).split('/').at(-1))
  return `${branchType(issue)}/${issueNumber}-${slug}`
}

export function defaultCommitMessage(phase, issue, featureDirectory) {
  const scope = domainScope(featureDirectory)
  const feature = humanizeFeature(issue.title)
  const messages = {
    specify: `docs(${scope}): Define ${feature} requirements`,
    clarify: `docs(${scope}): Clarify ${feature} behavior`,
    plan: `docs(${scope}): Plan ${feature} delivery`,
    checklist: `docs(${scope}): Add ${feature} requirements checklist`,
    tasks: `docs(${scope}): Break down ${feature} delivery tasks`,
    analyze: `docs(${scope}): Align ${feature} delivery artifacts`,
    implement: `feat(${scope}): Implement ${feature}`,
    converge: `docs(${scope}): Add remaining ${feature} delivery tasks`,
    review: `fix(${scope}): Resolve ${feature} review findings`,
  }
  const message = messages[phase] ?? `chore(${scope}): Update ${feature} delivery`
  return message.length <= 100 ? message : `${message.slice(0, 100).trimEnd()}`
}

export function validateCommitMessage(message) {
  if (!commitPattern.test(message)) {
    throw new Error(
      // biome-ignore lint/security/noSecrets: This is a documented commit-message syntax, not a credential.
      'Use `<type>(<domain>): <Description>` with a supported Conventional Commit type, a kebab-case scope, an uppercase description, and no trailing period.',
    )
  }
  if (message.length > 100) {
    throw new Error('The commit message must not exceed 100 characters.')
  }
  if (/:\s*(sync|update files?|misc(?:ellaneous)? changes?)\s*$/i.test(message)) {
    throw new Error('The commit message must describe the concrete workflow checkpoint.')
  }
  return message
}

export function normalizeAgentResponse(value) {
  if (typeof value === 'string') {
    try {
      return normalizeAgentResponse(JSON.parse(value))
    } catch {
      return { status: 'completed', message: value, commit_message: null, question: null }
    }
  }
  const status = ['question', 'checkpoint', 'completed', 'blocked', 'findings'].includes(
    value?.status,
  )
    ? value.status
    : 'completed'
  const question =
    value?.question && typeof value.question === 'object'
      ? {
          prompt: String(value.question.prompt ?? ''),
          recommended_option: String(value.question.recommended_option ?? ''),
          recommendation_reason: String(value.question.recommendation_reason ?? ''),
          options: Array.isArray(value.question.options)
            ? value.question.options.map((option) => ({
                id: String(option?.id ?? ''),
                description: String(option?.description ?? ''),
              }))
            : [],
          allow_custom_answer: value.question.allow_custom_answer === true,
        }
      : null
  return {
    status,
    message: String(value?.message ?? ''),
    commit_message: value?.commit_message ? String(value.commit_message) : null,
    question,
  }
}

export function nextPhaseIndex(state, existingSpec = false) {
  if (Number.isInteger(state.phaseIndex)) {
    return state.phaseIndex
  }
  return existingSpec ? PHASES.findIndex((phase) => phase.id === 'clarify') : 0
}

export function renderPullRequestBody({
  issue,
  featureDirectory,
  gate = 'Spec Review',
  summary,
  delivered = '- Specification workflow in progress',
  verification = `- Automated checks: Not run yet
- Browser journeys: Not run yet
- Other evidence: Spec Kit workflow in progress`,
}) {
  const gates = ['Spec Review', 'Plan Review', 'Delivery Review']
  return `## Summary

<!-- portflow:summary:start -->
${summary}
<!-- portflow:summary:end -->

## Change type

- [x] Spec-driven behavior change
- [ ] Bug fix with existing spec updated
- [ ] Workflow, documentation, or tooling change

## Spec Kit

Spec: \`${featureDirectory}/spec.md\`

### Current review gate

<!-- portflow:gate:start -->
${gates.map((name) => `- [${name === gate ? 'x' : ' '}] ${name}`).join('\n')}
- [ ] Not applicable (\`Spec: N/A\`)
<!-- portflow:gate:end -->

## Issue

Issue: #${issue.number}

Closes #${issue.number}

## Reviewer focus

Review the current gate first; workflow-generated updates never replace reviewer-authored text outside the managed markers.

## Delivered changes

<!-- portflow:delivered:start -->
${delivered}
<!-- portflow:delivered:end -->

## Database

- [x] Not assessed yet (Draft PR only)
- [ ] No migration in this PR
- [ ] Migration included and reversible (\`down\` mirrors \`up\`)

## Verification

<!-- portflow:verification:start -->
${verification}
<!-- portflow:verification:end -->

## Screenshots

To be supplied for web changes; not assessed yet.

## Ready-for-delivery checklist

- [ ] Exactly one change type is selected
- [ ] Human approval of the spec and plan is recorded, when applicable
- [ ] Spec, plan, tasks, and implementation are aligned, when applicable
- [ ] Acceptance criteria verified one by one against the delivered result
- [ ] \`pnpm check && pnpm typecheck && pnpm test && pnpm test:spec-kit\` run locally and green
- [ ] For \`apps/web\` changes: golden path and edge cases exercised in the browser
- [ ] \`$speckit-analyze\` and \`$speckit-converge\` completed, when applicable
- [ ] Fresh Codex session reviewed spec fidelity, architecture, security, and tests
- [ ] Every CONFIRMED finding from the fresh-session review resolved or explicitly justified
- [ ] New or changed domain terms reflected in \`CONTEXT.md\`, and relevant ADR added/updated under \`docs/adr/\`
`
}

export function updateManagedPullRequestBody(body, { gate, summary, verification, delivered }) {
  let result = body
  if (summary) {
    result = replaceManaged(result, 'summary', summary)
  }
  if (gate) {
    const values = ['Spec Review', 'Plan Review', 'Delivery Review']
    result = replaceManaged(
      result,
      'gate',
      `${values.map((name) => `- [${name === gate ? 'x' : ' '}] ${name}`).join('\n')}
- [ ] Not applicable (\`Spec: N/A\`)`,
    )
  }
  if (verification) {
    result = replaceManaged(result, 'verification', verification)
  }
  if (delivered) {
    result = replaceManaged(result, 'delivered', delivered)
  }
  return result
}

function replaceManaged(body, name, content) {
  const pattern = new RegExp(
    `<!-- portflow:${name}:start -->[\\s\\S]*?<!-- portflow:${name}:end -->`,
  )
  if (!pattern.test(body)) {
    return body
  }
  return body.replace(
    pattern,
    () => `<!-- portflow:${name}:start -->\n${content}\n<!-- portflow:${name}:end -->`,
  )
}

function humanizeFeature(title) {
  const clean = String(title ?? '')
    .replace(/^(add|allow|build|create|enable|fix|implement|make|support|update)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) {
    return 'Feature'
  }
  return clean
}
