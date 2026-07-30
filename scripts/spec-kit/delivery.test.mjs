import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DeliveryGitHub,
  parseChecks,
  parseDeliveryApprovals,
  parseIndependentReview,
} from './delivery-github.mjs'
import {
  approvalFingerprint,
  approvalIsCurrent,
  assertDeliveryTransition,
  deriveDeliveryState,
  parseDeliveryArguments,
  parseImplementationSlices,
  resolveDeliveryProfile,
  validateDeliveryArtifacts,
} from './delivery-model.mjs'
import {
  readyMetadataErrors,
  renderDeliveryProgress,
  renderDeliveryPullRequestBody,
  updateDeliveryProgress,
} from './delivery-pr.mjs'

const spec = `# Feature

## Acceptance scenarios

1. Given a valid actor, when they act, then the result is observable.
`

const plan = `# Delivery plan

## Approach

Use the existing vertical slice.

## Implementation Slices

- [ ] \`api-test\` — Add the failing API behavior test
- [ ] \`api-implementation\` — Implement the API behavior
- [ ] \`web-test\` — Add the failing web behavior test
- [ ] \`web-implementation\` — Implement the web behavior
- [ ] \`browser-flow\` — Verify the browser journey

## Risks and rollback

No migration.
`

test('resolves standard by default and rejects ambiguous profile labels', () => {
  assert.equal(resolveDeliveryProfile().id, 'standard')
  assert.equal(resolveDeliveryProfile({ labels: ['delivery:lite'] }).id, 'lite')
  assert.throws(() =>
    resolveDeliveryProfile({
      labels: ['delivery:standard', 'delivery:high-assurance'],
    }),
  )
  assert.throws(() => resolveDeliveryProfile({ labels: ['delivery:fast'] }))
})

test('parses outcome-oriented implementation slices from plan.md', () => {
  assert.deepEqual(parseImplementationSlices(plan), [
    { id: 'api-test', title: 'Add the failing API behavior test', completed: false },
    {
      id: 'api-implementation',
      title: 'Implement the API behavior',
      completed: false,
    },
    { id: 'web-test', title: 'Add the failing web behavior test', completed: false },
    {
      id: 'web-implementation',
      title: 'Implement the web behavior',
      completed: false,
    },
    { id: 'browser-flow', title: 'Verify the browser journey', completed: false },
  ])
  assert.equal(
    parseImplementationSlices(`## Implementation Slices

- [ ] \`only\` — Slice at end of file`).length,
    1,
  )
})

test('keeps a build approval valid when only slice checkboxes change', () => {
  const artifacts = { spec, plan }
  const approval = {
    gate: 'ready-to-build',
    fingerprint: approvalFingerprint('ready-to-build', artifacts),
  }
  const progressed = {
    spec,
    plan: plan.replace('- [ ] `api-test`', '- [x] `api-test`'),
  }
  assert.equal(approvalIsCurrent(approval, 'ready-to-build', progressed), true)
  assert.equal(
    approvalIsCurrent(approval, 'ready-to-build', {
      ...progressed,
      plan: progressed.plan.replace('Use the existing vertical slice.', 'Introduce a new service.'),
    }),
    false,
  )
})

test('validates required artifacts, clarifications, and slice limits', () => {
  const profile = resolveDeliveryProfile({ requested: 'standard' })
  assert.equal(validateDeliveryArtifacts({ profile, artifacts: { spec, plan } }).valid, true)
  assert.deepEqual(
    validateDeliveryArtifacts({
      profile,
      artifacts: { spec: `${spec}\n[NEEDS CLARIFICATION: actor]`, plan },
    }).errors,
    ['The specification contains unresolved clarification markers.'],
  )
  assert.match(
    validateDeliveryArtifacts({
      profile,
      artifacts: {
        spec,
        plan: plan
          .replace(/^- \[ \] `web-test`.*$/m, '')
          .replace(/^- \[ \] `web-implementation`.*$/m, ''),
      },
    }).errors.join('\n'),
    /at least 5 or use lite/,
  )
})

test('starts lite delivery in implementation and moves to review after a PR exists', () => {
  assert.equal(
    deriveDeliveryState({ profile: 'lite', artifacts: {}, pullRequest: null }).stage,
    'implementing',
  )
  assert.equal(
    deriveDeliveryState({
      profile: 'lite',
      artifacts: {},
      pullRequest: { number: 12 },
    }).stage,
    'independent-review',
  )
})

test('derives the standard workflow from artifacts, approvals, review, and checks', () => {
  const artifacts = { spec, plan }
  const waiting = deriveDeliveryState({ profile: 'standard', artifacts })
  assert.equal(waiting.stage, 'waiting-for-build-approval')

  const approval = {
    gate: 'ready-to-build',
    fingerprint: approvalFingerprint('ready-to-build', artifacts),
  }
  const implementing = deriveDeliveryState({
    profile: 'standard',
    artifacts,
    approvals: [approval],
  })
  assert.equal(implementing.stage, 'implementing')

  const completedArtifacts = { spec, plan: plan.replaceAll('- [ ]', '- [x]') }
  const reviewing = deriveDeliveryState({
    profile: 'standard',
    artifacts: completedArtifacts,
    approvals: [approval],
  })
  assert.equal(reviewing.stage, 'independent-review')

  const verifying = deriveDeliveryState({
    profile: 'standard',
    artifacts: completedArtifacts,
    approvals: [approval],
    review: { completed: true, findings: [] },
  })
  assert.equal(verifying.stage, 'final-verification')

  const delivery = deriveDeliveryState({
    profile: 'standard',
    artifacts: completedArtifacts,
    approvals: [approval],
    review: { completed: true, findings: [] },
    checks: { passed: true, evidence: ['pnpm check: passed'] },
  })
  assert.equal(delivery.stage, 'delivery-review')
  assert.equal(delivery.kanbanStatus, 'Review')
})

test('returns only to implementation for open independent-review findings', () => {
  const artifacts = { spec, plan: plan.replaceAll('- [ ]', '- [x]') }
  const approval = {
    gate: 'ready-to-build',
    fingerprint: approvalFingerprint('ready-to-build', artifacts),
  }
  const state = deriveDeliveryState({
    profile: 'standard',
    artifacts,
    approvals: [approval],
    review: {
      completed: true,
      findings: [{ id: 'R001', status: 'open' }],
    },
  })
  assert.equal(state.stage, 'implementing')
})

test('keeps high-assurance planning behind separate spec and plan approvals', () => {
  const specOnly = { spec, plan: '' }
  const waitingForSpec = deriveDeliveryState({
    profile: 'high-assurance',
    artifacts: specOnly,
  })
  assert.equal(waitingForSpec.stage, 'waiting-for-spec-approval')

  const specApproval = {
    gate: 'spec-review',
    fingerprint: approvalFingerprint('spec-review', specOnly),
  }
  const planning = deriveDeliveryState({
    profile: 'high-assurance',
    artifacts: specOnly,
    approvals: [specApproval],
  })
  assert.equal(planning.stage, 'planning')

  const artifacts = { spec, plan }
  const waitingForPlan = deriveDeliveryState({
    profile: 'high-assurance',
    artifacts,
    approvals: [specApproval],
  })
  assert.equal(waitingForPlan.stage, 'waiting-for-plan-approval')

  const invalidPlan = {
    spec,
    plan: `## Implementation Slices

- [ ] \`only\` — Too coarse`,
  }
  assert.equal(
    deriveDeliveryState({
      profile: 'high-assurance',
      artifacts: invalidPlan,
      approvals: [specApproval],
    }).stage,
    'planning',
  )
})

test('enforces the small transition graph', () => {
  assert.equal(assertDeliveryTransition('implementing', 'independent-review'), true)
  assert.equal(assertDeliveryTransition('independent-review', 'implementing'), true)
  assert.throws(() => assertDeliveryTransition('independent-review', 'drafting'))
  assert.throws(() => assertDeliveryTransition('done', 'implementing'))
})

test('parses delivery CLI arguments', () => {
  assert.deepEqual(
    parseDeliveryArguments([
      'start',
      '123',
      '--profile',
      'standard',
      '--feature-dir',
      'specs/standalone/example',
      '--dry-run',
    ]),
    {
      action: 'start',
      issue: 123,
      profile: 'standard',
      featureDirectory: 'specs/standalone/example',
      gate: null,
      dryRun: true,
      json: false,
    },
  )
  assert.equal(parseDeliveryArguments(['start', '--', '123']).issue, 123)
  assert.equal(parseDeliveryArguments(['run', '--', '123']).action, 'run')
})

test('renders and idempotently updates one managed PR progress block', () => {
  const state = deriveDeliveryState({ profile: 'standard', artifacts: { spec, plan } })
  const block = renderDeliveryProgress(state)
  assert.match(block, /\*\*Current step\*\*: \*\*Ready to build\*\*/)
  assert.match(block, /Implementation slices \(0\/5\)/)

  const original = `## Summary\n\nReviewer-authored text.\n\n## Verification\n\nPending.\n`
  const once = updateDeliveryProgress(original, state)
  const twice = updateDeliveryProgress(once, state)
  assert.equal(once, twice)
  assert.match(once, /Reviewer-authored text/)
  assert.equal((once.match(/portflow:delivery-workflow:start/g) ?? []).length, 1)
})

test('renders a validator-compatible PR shape and keeps ready metadata human-owned', () => {
  const state = deriveDeliveryState({ profile: 'standard', artifacts: { spec, plan } })
  const body = renderDeliveryPullRequestBody({
    issue: { number: 123, title: 'Example delivery' },
    featureDirectory: 'specs/standalone/example',
    state,
  })
  assert.match(body, /^## Change type$/m)
  assert.match(body, /^Issue: #123$/m)
  assert.match(body, /^Profile: `standard`$/m)
  assert.match(body, /^Spec: `specs\/standalone\/example\/spec\.md`$/m)
  assert.deepEqual(readyMetadataErrors(body), [
    'Select exactly one assessed database option in the PR.',
    'Complete every item in the PR Ready-for-delivery checklist.',
  ])
  let readyBody = body
    .replace('- [x] Not assessed yet (Draft PR only)', '- [ ] Not assessed yet (Draft PR only)')
    .replace('- [ ] No migration', '- [x] No migration')
  readyBody = readyBody.replace(/## Ready-for-delivery checklist[\s\S]*$/, (checklist) =>
    checklist.replaceAll('- [ ] ', '- [x] '),
  )
  assert.deepEqual(readyMetadataErrors(readyBody), [])
})

test('reads durable approvals and reviews from PR comments', () => {
  const comments = [
    {
      url: 'https://example.test/approval',
      body: '<!-- portflow:delivery-approval {"gate":"ready-to-build","fingerprint":"abc","commit":"123"} -->',
    },
    {
      url: 'https://example.test/review',
      body: '<!-- portflow:independent-review {"completed":true,"commit":"123","findings":[{"id":"R1","status":"resolved"}]} -->',
    },
  ]
  assert.equal(parseDeliveryApprovals(comments)[0].gate, 'ready-to-build')
  assert.equal(parseIndependentReview(comments).findings[0].status, 'resolved')
})

test('requires local verification evidence and accepts green GitHub checks', () => {
  const comments = [
    {
      body: '<!-- portflow:delivery-verification {"passed":true,"commit":"abc","evidence":["pnpm check: passed"]} -->',
    },
  ]
  const checks = parseChecks(
    [
      {
        name: 'checks',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
      },
    ],
    comments,
  )
  assert.equal(checks.passed, true)
  assert.equal(checks.commit, 'abc')
  assert.match(checks.evidence.join('\n'), /pnpm check/)
})

test('prefers the open PR over old closed PRs for the same branch', () => {
  const github = new DeliveryGitHub()
  github.resolveRepository = () => 'portflow/repository'
  github.ghJson = () => [
    { number: 1, state: 'CLOSED', mergedAt: null },
    { number: 2, state: 'MERGED', mergedAt: '2026-01-01T00:00:00Z' },
    { number: 3, state: 'OPEN', mergedAt: null },
  ]
  assert.equal(github.findPullRequest('feat/123-example').number, 3)
})

test('accepts a successful inherited-stdio git command with no captured output', () => {
  const calls = []
  const github = new DeliveryGitHub({
    exec(command, args) {
      calls.push([command, args])
      if (args[0] === 'branch') {
        return 'master\n'
      }
      return null
    },
  })
  assert.equal(github.prepareBranch('feat/123-example'), 'feat/123-example')
  assert.deepEqual(calls.at(-1), ['git', ['switch', '-c', 'feat/123-example']])
})

test('adds a missing issue to the Project before updating its sole Status field', () => {
  const github = new DeliveryGitHub({ projectNumber: 1 })
  const calls = []
  let lookup = 0
  github.resolveProjectContext = () => ({
    owner: 'portflow',
    project: { id: 'PROJECT' },
    status: {
      id: 'STATUS',
      optionsByName: new Map([['In Progress', { id: 'IN_PROGRESS' }]]),
    },
  })
  github.fetchIssueProjectItem = () => {
    lookup += 1
    return lookup === 1 ? null : { id: 'ITEM', status: 'Ready' }
  }
  github.ghJson = (args) => {
    calls.push(args)
    return { id: 'ITEM' }
  }
  github.command = (command, args) => {
    calls.push([command, ...args])
    return ''
  }
  github.updateKanbanStatus({ number: 123, url: 'https://example.test/issues/123' }, 'In Progress')
  assert.equal(calls[0][1], 'item-add')
  assert.equal(calls[1][1], 'project')
  assert.equal(calls[1][2], 'item-edit')
  assert.equal(calls.flat().includes('Spec Status'), false)
})
