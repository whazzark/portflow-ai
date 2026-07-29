import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable, Writable } from 'node:stream'
import { test } from 'node:test'
import { TerminalWorkflow } from './workflow.mjs'
import { codexExecArgs } from './workflow-codex.mjs'
import { formatUntrackedStat, parseStatusFiles, WorkflowGitHub } from './workflow-github.mjs'
import {
  applyPhaseEscalations,
  branchName,
  branchNameForFeature,
  configureModelPolicy,
  defaultCommitMessage,
  featureDirectoryFromIssue,
  KANBAN_STATUSES,
  normalizeAgentResponse,
  PHASES,
  parseArguments,
  renderPullRequestBody,
  SPEC_STATUSES,
  updateManagedPullRequestBody,
  validateCommitMessage,
  validateFeatureDirectory,
} from './workflow-model.mjs'

function terminalHarness(input = '') {
  let output = ''
  return {
    input: Readable.from([input]),
    output: new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString()
        callback()
      },
    }),
    text: () => output,
  }
}

test('accepts issue-first commands and keeps the zero-argument interactive form', () => {
  assert.deepEqual(parseArguments([]), {
    action: 'run',
    issue: null,
    featureDirectory: null,
    dryRun: false,
    modelPolicy: null,
    escalatedPhases: [],
  })
  assert.deepEqual(parseArguments(['--', '185']), {
    action: 'run',
    issue: 185,
    featureDirectory: null,
    dryRun: false,
    modelPolicy: null,
    escalatedPhases: [],
  })
  assert.deepEqual(parseArguments(['resume', '--issue', '185']), {
    action: 'resume',
    issue: 185,
    featureDirectory: null,
    dryRun: false,
    modelPolicy: null,
    escalatedPhases: [],
  })
})

test('accepts an explicit model policy and targeted phase escalations', () => {
  assert.deepEqual(
    parseArguments([
      'resume',
      '--issue',
      '185',
      '--model-policy',
      'quality',
      '--escalate-phase',
      'implement',
      '--escalate-phase',
      'review',
    ]),
    {
      action: 'resume',
      issue: 185,
      featureDirectory: null,
      dryRun: false,
      modelPolicy: 'quality',
      escalatedPhases: ['implement', 'review'],
    },
  )
  assert.throws(() => parseArguments(['--model-policy', 'expensive']), /model policy/)
  assert.throws(() => parseArguments(['--escalate-phase', 'checks']), /Codex phase/)
})

test('routes economy phases conservatively and keeps quality explicit', () => {
  assert.deepEqual(modelConfigForPhase('checklist', 'economy'), {
    model: 'gpt-5.6-luna',
    reasoningEffort: 'low',
  })
  assert.deepEqual(modelConfigForPhase('implement', 'economy'), {
    model: 'gpt-5.6-terra',
    reasoningEffort: 'medium',
  })
  assert.deepEqual(modelConfigForPhase('review', 'economy'), {
    model: 'gpt-5.6-sol',
    reasoningEffort: 'high',
  })
  assert.deepEqual(modelConfigForPhase('review', 'quality'), {
    model: 'gpt-5.6-sol',
    reasoningEffort: 'xhigh',
  })
})

test('snapshots phase models and changes them only through explicit escalation', () => {
  const state = {
    modelPolicy: 'economy',
    escalatedPhases: [],
    phaseModels: {},
  }

  assert.deepEqual(resolvePhaseModel(state, 'implement'), {
    model: 'gpt-5.6-terra',
    reasoningEffort: 'medium',
  })
  state.modelPolicy = 'quality'
  assert.deepEqual(resolvePhaseModel(state, 'implement'), {
    model: 'gpt-5.6-terra',
    reasoningEffort: 'medium',
  })

  applyPhaseEscalations(state, ['implement'])
  assert.deepEqual(resolvePhaseModel(state, 'implement'), {
    model: 'gpt-5.6-terra',
    reasoningEffort: 'high',
  })
  assert.deepEqual(state.escalatedPhases, ['implement'])
})

test('keeps a workflow model policy stable while allowing targeted escalation', () => {
  const state = configureModelPolicy({}, { modelPolicy: 'economy' })
  assert.equal(state.modelPolicy, 'economy')
  assert.throws(
    () => configureModelPolicy(state, { modelPolicy: 'quality' }),
    /already uses the economy model policy/,
  )

  configureModelPolicy(state, { escalatedPhases: ['review'] })
  assert.deepEqual(state.phaseModels.review, {
    model: 'gpt-5.6-sol',
    reasoningEffort: 'xhigh',
  })
})

test('passes the selected model and reasoning effort to new and resumed Codex phases', () => {
  const common = {
    root: '/repo',
    schema: '/repo/phase-response.schema.json',
    prompt: 'Run the phase',
    modelConfig: {
      model: 'gpt-5.6-terra',
      reasoningEffort: 'medium',
    },
  }

  assert.deepEqual(
    codexExecArgs({
      ...common,
      sessionId: null,
      readOnly: false,
    }),
    [
      'exec',
      '--model',
      'gpt-5.6-terra',
      '--config',
      'model_reasoning_effort="medium"',
      '--sandbox',
      'workspace-write',
      '--cd',
      '/repo',
      '--output-schema',
      '/repo/phase-response.schema.json',
      '--json',
      'Run the phase',
    ],
  )
  assert.deepEqual(
    codexExecArgs({
      ...common,
      sessionId: 'thread-123',
      readOnly: false,
    }),
    [
      'exec',
      'resume',
      '--model',
      'gpt-5.6-terra',
      '--config',
      'model_reasoning_effort="medium"',
      '--output-schema',
      '/repo/phase-response.schema.json',
      '--json',
      'thread-123',
      'Run the phase',
    ],
  )
})

test('accepts domain-oriented feature directories', () => {
  assert.equal(
    validateFeatureDirectory('specs/user-administration/invitation-onboarding/invite-user'),
    'specs/user-administration/invitation-onboarding/invite-user',
  )
  assert.equal(
    validateFeatureDirectory('specs/standalone/confirm-email'),
    'specs/standalone/confirm-email',
  )
})

test('derives a conventional issue-linked feature branch from an existing spec', () => {
  assert.equal(
    branchNameForFeature(
      'specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench',
      '**Feature ID**: `GH-41`',
      '',
      { labels: [{ name: 'bug' }] },
    ),
    'fix/41-administer-docks-and-weighing-areas-from-the-web-workbench',
  )
})

test('derives the issue-linked feature branch from the workflow description for new specs', () => {
  assert.equal(
    branchNameForFeature(
      'specs/standalone/customer-access',
      '',
      'GitHub issue #123: customer access',
      { labels: [{ name: 'documentation' }] },
    ),
    'docs/123-customer-access',
  )
})

test('requires an issue number before creating a workflow branch', () => {
  assert.throws(
    () => branchNameForFeature('specs/standalone/customer-access', '', 'customer access'),
    /Cannot determine the GitHub issue number/,
  )
})

test('derives the branch type from explicit and conventional issue labels', () => {
  const featureDirectory = 'specs/standalone/customer-access'
  const cases = [
    [['type:chore'], 'chore/123-customer-access'],
    [['refactor'], 'refactor/123-customer-access'],
    [['performance'], 'perf/123-customer-access'],
    [['bug'], 'fix/123-customer-access'],
    [['documentation'], 'docs/123-customer-access'],
    [['priority:P1'], 'feat/123-customer-access'],
  ]

  for (const [labels, expected] of cases) {
    assert.equal(
      branchName(
        {
          number: 123,
          title: 'Customer access',
          labels: labels.map((name) => ({ name })),
        },
        featureDirectory,
      ),
      expected,
    )
  }
})

test('rejects paths outside the canonical feature hierarchy', () => {
  for (const value of [
    '/tmp/specs/example',
    '../specs/example',
    'specs/../outside',
    'specs/Feature Name',
    'specs\\standalone\\feature',
    'other/domain/feature',
  ]) {
    assert.throws(() => validateFeatureDirectory(value))
  }
})

test('resolves the canonical feature directory from an issue artifact link', () => {
  assert.equal(
    featureDirectoryFromIssue({
      body: '- **Artifact**: [specs/operations/checkpoints/spec.md](https://github.com/whazzark/portflow-ai/blob/master/specs/operations/checkpoints/spec.md)',
    }),
    'specs/operations/checkpoints',
  )
})

test('derives the required branch name and precise fallback commits', () => {
  const issue = {
    number: 185,
    title: 'Make Spec Kit delivery issue-driven and terminal-interactive',
    labels: [{ name: 'priority:P0' }],
  }
  const featureDirectory = 'specs/developer-experience/spec-kit/interactive-workflow'
  assert.equal(
    branchName(issue, featureDirectory),
    'feat/185-make-spec-kit-delivery-issue-driven-and-terminal-interactive',
  )
  assert.equal(
    defaultCommitMessage('plan', issue, featureDirectory),
    'docs(interactive-workflow): Plan Spec Kit delivery issue-driven and terminal-interactive delivery',
  )
})

test('validates precise Conventional Commit messages and rejects generic sync commits', () => {
  assert.equal(
    validateCommitMessage('docs(site-references): Define checkpoint administration requirements'),
    'docs(site-references): Define checkpoint administration requirements',
  )
  assert.throws(() => validateCommitMessage('sync'))
  assert.throws(() => validateCommitMessage('chore(workflow): sync'))
  assert.throws(() => validateCommitMessage('chore(workflow): Sync'))
  assert.throws(() => validateCommitMessage('docs(Spec Kit): Update workflow'))
})

test('keeps implementation checkpoint responses distinct from phase completion', () => {
  assert.deepEqual(
    normalizeAgentResponse({
      status: 'checkpoint',
      message: 'The failing authorization test is ready.',
      commit_message: 'test(checkpoints): Cover unauthorized checkpoint creation',
    }),
    {
      status: 'checkpoint',
      message: 'The failing authorization test is ready.',
      commit_message: 'test(checkpoints): Cover unauthorized checkpoint creation',
      question: null,
    },
  )
})

test('preserves structured question options from Codex responses', () => {
  assert.deepEqual(
    normalizeAgentResponse({
      status: 'question',
      message: 'Choose the search behavior.',
      commit_message: null,
      question: {
        prompt: 'How should workbench search behave?',
        recommended_option: 'A',
        recommendation_reason: 'It keeps both resource lists independent.',
        options: [
          { id: 'A', description: 'Search each list independently.' },
          { id: 'B', description: 'Search one combined list.' },
        ],
        allow_custom_answer: false,
      },
    }),
    {
      status: 'question',
      message: 'Choose the search behavior.',
      commit_message: null,
      question: {
        prompt: 'How should workbench search behave?',
        recommended_option: 'A',
        recommendation_reason: 'It keeps both resource lists independent.',
        options: [
          { id: 'A', description: 'Search each list independently.' },
          { id: 'B', description: 'Search one combined list.' },
        ],
        allow_custom_answer: false,
      },
    },
  )
})

test('renders every option for a structured Codex question', async () => {
  const terminal = terminalHarness()
  const calls = []
  const responses = [
    {
      sessionId: 'clarify-session',
      response: {
        status: 'question',
        message: 'Choose the search behavior.',
        commit_message: null,
        question: {
          prompt: 'How should workbench search behave?',
          recommended_option: 'A',
          recommendation_reason: 'It keeps both resource lists independent.',
          options: [
            { id: 'A', description: 'Search each list by case-insensitive substring.' },
            { id: 'B', description: 'Search both resource types in one global list.' },
            { id: 'C', description: 'Search each list by exact name only.' },
          ],
          allow_custom_answer: true,
        },
      },
    },
    {
      sessionId: 'clarify-session',
      response: {
        status: 'completed',
        message: 'Clarification recorded.',
        commit_message: null,
        question: null,
      },
    },
  ]
  const workflow = new TerminalWorkflow({
    input: terminal.input,
    output: terminal.output,
    github: {},
    codex: {
      runPhase(payload) {
        calls.push(payload)
        return responses.shift()
      },
    },
  })
  workflow.saveState = () => {}
  workflow.prompt = (message) => {
    calls.push(message)
    return 'B'
  }

  try {
    const result = await workflow.runCodexPhase({
      phase: { id: 'clarify', skill: 'speckit-clarify' },
      issue: { number: 41, title: 'Administer checkpoints' },
      state: {
        featureDirectory: 'specs/site-references/checkpoints',
        sessions: {},
      },
    })

    assert.equal(result, 'advance')
    assert.match(terminal.text(), /Recommandée : A/)
    assert.match(terminal.text(), /A — Search each list by case-insensitive substring\./)
    assert.match(terminal.text(), /B — Search both resource types in one global list\./)
    assert.match(terminal.text(), /C — Search each list by exact name only\./)
    assert.match(terminal.text(), /Autre — Réponse libre/)
    assert.match(terminal.text(), /How should workbench search behave\?/)
    assert.match(terminal.text(), /Modèle : gpt-5\.6-terra · effort low/)
    assert.deepEqual(calls[0].modelConfig, {
      model: 'gpt-5.6-terra',
      reasoningEffort: 'low',
    })
    assert.equal(calls[1], 'Votre réponse (ou /pause) : ')
    assert.equal(calls[2].feedback, 'B')
  } finally {
    workflow.close()
  }
})

test('parses renamed checkpoint files without accidentally truncating the source path', () => {
  assert.deepEqual(
    parseStatusFiles('R  specs/new-name.md\0specs/old-name.md\0?? apps/api/new-file.ts\0'),
    ['specs/new-name.md', 'specs/old-name.md', 'apps/api/new-file.ts'],
  )
})

test('shows added-line statistics for untracked checkpoint files', () => {
  assert.equal(
    formatUntrackedStat('specs/checkpoint/spec.md', Buffer.from('# Spec\n\nRequirement\n')),
    ' specs/checkpoint/spec.md | 3 +++',
  )
})

test('stages only files shown in the approved checkpoint', () => {
  const calls = []
  const exec = (command, args) => {
    calls.push([command, args])
    if (args[0] === 'status') {
      return ' M specs/checkpoint/spec.md\0'
    }
    if (args[0] === 'diff' && args.includes('--cached')) {
      return 'specs/checkpoint/spec.md\n'
    }
    if (args[0] === 'rev-parse') {
      return 'abc123\n'
    }
    return ''
  }
  const github = new WorkflowGitHub({ root: '/repo', exec })

  assert.equal(
    github.commit('docs(checkpoint): Define checkpoint requirements', ['specs/checkpoint/spec.md']),
    'abc123',
  )
  assert.deepEqual(
    calls.find(([, args]) => args[0] === 'add'),
    ['git', ['add', '--all', '--', 'specs/checkpoint/spec.md']],
  )
})

test('maps every Spec Kit phase to both Kanban and specification state', () => {
  assert.deepEqual(
    PHASES.map(({ id }) => [id, KANBAN_STATUSES[id], SPEC_STATUSES[id]]),
    [
      ['specify', 'In Progress', 'Spec Draft'],
      ['clarify', 'In Progress', 'Spec Draft'],
      ['review-spec', 'Review', 'Spec Review'],
      ['plan', 'In Progress', 'Plan Review'],
      ['checklist', 'In Progress', 'Plan Review'],
      ['review-plan', 'Review', 'Plan Review'],
      ['tasks', 'In Progress', 'Ready'],
      ['analyze', 'In Progress', 'Ready'],
      ['implement', 'In Progress', 'In Progress'],
      ['checks', 'In Progress', 'In Progress'],
      ['converge', 'Review', 'Review'],
      ['review', 'Review', 'Review'],
      ['delivery', 'Review', 'Review'],
    ],
  )
})

test('updates Kanban Status and Spec Status without listing the entire Project', () => {
  const calls = []
  const exec = (command, args) => {
    calls.push([command, args])
    if (args[0] === 'repo') {
      return JSON.stringify({ nameWithOwner: 'whazzark/portflow-ai' })
    }
    if (args[0] === 'project' && args[1] === 'list') {
      return JSON.stringify({ projects: [{ id: 'PROJECT', number: 5 }] })
    }
    if (args[0] === 'project' && args[1] === 'field-list') {
      return JSON.stringify({
        fields: [
          {
            id: 'STATUS_FIELD',
            name: 'Status',
            options: [
              { id: 'BACKLOG', name: 'Backlog' },
              { id: 'PROGRESS', name: 'In Progress' },
            ],
          },
          {
            id: 'SPEC_FIELD',
            name: 'Spec Status',
            options: [
              { id: 'INTAKE', name: 'Intake' },
              { id: 'SPEC_DRAFT', name: 'Spec Draft' },
            ],
          },
        ],
      })
    }
    if (args[0] === 'api' && args[1] === 'graphql') {
      return JSON.stringify({
        data: {
          repository: {
            issue: {
              projectItems: {
                nodes: [
                  {
                    id: 'ITEM',
                    project: { id: 'PROJECT' },
                    fieldValues: {
                      nodes: [
                        { name: 'Backlog', field: { name: 'Status' } },
                        { name: 'Intake', field: { name: 'Spec Status' } },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      })
    }
    return ''
  }
  const github = new WorkflowGitHub({ root: '/repo', exec })

  github.updateProjectStatus(
    { number: 41, url: 'https://github.com/whazzark/portflow-ai/issues/41' },
    { status: 'In Progress', specStatus: 'Spec Draft' },
  )

  const edits = calls.filter(([, args]) => args[0] === 'project' && args[1] === 'item-edit')
  assert.equal(edits.length, 2)
  assert.equal(
    calls.some(([, args]) => args[0] === 'project' && args[1] === 'item-list'),
    false,
  )
  assert.match(edits[0][1].join(' '), /STATUS_FIELD .* PROGRESS/)
  assert.match(edits[1][1].join(' '), /SPEC_FIELD .* SPEC_DRAFT/)
})

test('refuses a commit when the worktree changed after human review', () => {
  const calls = []
  const github = new WorkflowGitHub({
    root: '/repo',
    exec(command, args) {
      calls.push([command, args])
      return ' M specs/checkpoint/spec.md\0?? unrelated.txt\0'
    },
  })

  assert.throws(
    () =>
      github.commit('docs(checkpoint): Define checkpoint requirements', [
        'specs/checkpoint/spec.md',
      ]),
    /worktree changed after checkpoint review/,
  )
  assert.equal(
    calls.some(([, args]) => args[0] === 'add'),
    false,
  )
})

test('moves a blocked Codex phase into both blocked Project states', async () => {
  const terminal = terminalHarness()
  const calls = []
  const github = {
    updateProjectStatus(_issue, values) {
      calls.push(values)
    },
  }
  const codex = {
    runPhase() {
      return Promise.resolve({
        sessionId: 'blocked-session',
        response: { status: 'blocked', message: 'Waiting for an external decision.' },
      })
    },
  }
  const workflow = new TerminalWorkflow({
    input: terminal.input,
    output: terminal.output,
    github,
    codex,
  })
  workflow.prompt = async () => '/pause'
  workflow.saveState = () => {}

  try {
    const result = await workflow.runCodexPhase({
      phase: { id: 'implement', skill: 'speckit-implement' },
      issue: { number: 41 },
      state: {
        featureDirectory: 'specs/site-references/checkpoints',
        sessions: {},
      },
    })
    assert.equal(result, 'pause')
    assert.deepEqual(calls, [{ status: 'Blocked', specStatus: 'Blocked' }])
  } finally {
    workflow.close()
  }
})

test('updates only managed PR sections and preserves reviewer text', () => {
  const issue = { number: 185, title: 'Interactive Spec Kit' }
  const initial = renderPullRequestBody({
    issue,
    featureDirectory: 'specs/standalone/interactive-spec-kit',
    gate: 'Spec Review',
    summary: 'Initial summary',
  }).replace(
    'Review the current gate first; workflow-generated updates never replace reviewer-authored text outside the managed markers.',
    'Reviewer-authored focus: inspect the retry semantics.',
  )

  const updated = updateManagedPullRequestBody(initial, {
    gate: 'Plan Review',
    summary: 'Planning is ready.',
    verification: '- Automated checks: pending',
  })

  assert.match(updated, /Reviewer-authored focus: inspect the retry semantics\./)
  assert.match(updated, /Planning is ready\./)
  assert.match(updated, /- \[x\] Plan Review/)
  assert.match(updated, /- \[ \] Spec Review/)
  assert.match(updated, /- Automated checks: pending/)
})

test('managed PR updates preserve dollar replacement tokens literally', () => {
  const initial = renderPullRequestBody({
    issue: { number: 185, title: 'Interactive Spec Kit' },
    featureDirectory: 'specs/standalone/interactive-spec-kit',
    summary: 'Initial summary',
  })
  const updated = updateManagedPullRequestBody(initial, {
    summary: "Keep $& and $` and $' as reviewer-visible text.",
  })

  assert.match(updated, /Keep \$& and \$` and \$' as reviewer-visible text\./)
})

test('renders first-checkpoint evidence when creating the Draft PR', () => {
  const body = renderPullRequestBody({
    issue: { number: 185, title: 'Interactive Spec Kit' },
    featureDirectory: 'specs/standalone/interactive-spec-kit',
    gate: 'Spec Review',
    summary: 'The initial spec is reviewable.',
    delivered: '- specify: Created the initial behavioral contract',
    verification: '- Automated checks: Spec structure validated',
  })

  assert.match(body, /- specify: Created the initial behavioral contract/)
  assert.match(body, /- Automated checks: Spec structure validated/)
  assert.doesNotMatch(body, /Specification workflow in progress/)
})

test('dry-run resolves an issue without mutating the branch or Project', async () => {
  const terminal = terminalHarness()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portflow-spec-kit-dry-run-'))
  const calls = []
  const github = {
    fetchIssue(number) {
      calls.push(['fetchIssue', number])
      return {
        number,
        title: 'Administer checkpoints',
        body: 'Artifact: specs/site-references/checkpoints/spec.md',
        state: 'OPEN',
        labels: [],
      }
    },
  }
  const workflow = new TerminalWorkflow({
    root,
    input: terminal.input,
    output: terminal.output,
    github,
    codex: {},
  })

  try {
    const result = await workflow.run({
      action: 'run',
      issue: 41,
      featureDirectory: null,
      dryRun: true,
    })
    assert.equal(result, 0)
    assert.deepEqual(calls, [['fetchIssue', 41]])
    assert.match(terminal.text(), /"featureDirectory": "specs\/site-references\/checkpoints"/)
    assert.match(terminal.text(), /"startsAt": "specify"/)
    assert.match(terminal.text(), /"modelPolicy": "economy"/)
    assert.match(terminal.text(), /"checklist": \{\s+"model": "gpt-5\.6-luna"/)
  } finally {
    workflow.close()
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('approved checkpoints use the exact message before commit, push, and PR sync', async () => {
  const terminal = terminalHarness('a\n')
  const calls = []
  const github = {
    changedFiles: () => ['specs/site-references/checkpoints/plan.md'],
    diffStat: (files) => {
      calls.push(['diffStat', files])
      return ' plan.md | 20 ++++++++++++++++++++'
    },
    commit(message, files) {
      calls.push(['commit', message, files])
    },
    push(branch) {
      calls.push(['push', branch])
    },
    syncPullRequest(payload) {
      calls.push(['syncPullRequest', payload.gate])
      return { url: 'https://github.com/whazzark/portflow-ai/pull/999' }
    },
  }
  const workflow = new TerminalWorkflow({
    input: terminal.input,
    output: terminal.output,
    github,
    codex: {},
  })
  workflow.saveState = () => {}
  const issue = { number: 41, title: 'Administer checkpoints' }
  const state = {
    branch: 'feat/41-administer-checkpoints',
    featureDirectory: 'specs/site-references/checkpoints',
  }

  try {
    const result = await workflow.checkpoint({
      phase: { id: 'plan' },
      issue,
      state,
      response: {
        commit_message: 'docs(checkpoints): Plan checkpoint administration delivery',
      },
    })
    assert.equal(result, 'advance')
    assert.deepEqual(calls, [
      ['diffStat', ['specs/site-references/checkpoints/plan.md']],
      [
        'commit',
        'docs(checkpoints): Plan checkpoint administration delivery',
        ['specs/site-references/checkpoints/plan.md'],
      ],
      ['push', 'feat/41-administer-checkpoints'],
      ['syncPullRequest', 'Plan Review'],
    ])
  } finally {
    workflow.close()
  }
})

test('keeps an approved checkpoint publishable when the first push fails', async () => {
  const terminal = terminalHarness('a\n')
  let pushFails = true
  const calls = []
  const github = {
    changedFiles: () => ['specs/site-references/checkpoints/spec.md'],
    diffStat: () => ' spec.md | 10 ++++++++++',
    commit: () => 'abc123',
    push() {
      calls.push('push')
      if (pushFails) {
        throw new Error('offline')
      }
    },
    syncPullRequest() {
      calls.push('syncPullRequest')
      return { url: 'https://github.com/whazzark/portflow-ai/pull/999' }
    },
  }
  const workflow = new TerminalWorkflow({
    input: terminal.input,
    output: terminal.output,
    github,
    codex: {},
  })
  const snapshots = []
  workflow.saveState = (state) => snapshots.push(structuredClone(state))
  const issue = { number: 41, title: 'Administer checkpoints' }
  const state = {
    issueNumber: 41,
    branch: 'feat/41-administer-checkpoints',
    featureDirectory: 'specs/site-references/checkpoints',
  }

  try {
    await assert.rejects(
      workflow.checkpoint({
        phase: { id: 'specify' },
        issue,
        state,
        response: {
          message: 'Defined the checkpoint administration contract.',
          commit_message: 'docs(checkpoints): Define checkpoint administration requirements',
        },
      }),
      /offline/,
    )
    assert.deepEqual(state.pendingPublish, { commit: 'abc123', phase: 'specify' })
    assert.equal(snapshots.at(-1).pendingPublish.commit, 'abc123')

    pushFails = false
    workflow.publishPendingCheckpoint({ issue, state })
    assert.equal(state.pendingPublish, undefined)
    assert.deepEqual(calls, ['push', 'push', 'syncPullRequest'])
  } finally {
    workflow.close()
  }
})

test('rejecting the plan gate records feedback and returns to a fresh plan phase', async () => {
  const terminal = terminalHarness()
  const github = {
    syncPullRequest: () => ({ url: 'https://github.com/whazzark/portflow-ai/pull/999' }),
  }
  const workflow = new TerminalWorkflow({
    input: terminal.input,
    output: terminal.output,
    github,
    codex: {},
  })
  const answers = ['r', 'Separate API and web rollout']
  workflow.prompt = async () => answers.shift()
  const state = {
    branch: 'feat/41-administer-checkpoints',
    featureDirectory: 'specs/site-references/checkpoints',
    phaseIndex: PHASES.findIndex((phase) => phase.id === 'review-plan'),
    sessions: { plan: 'old-plan-session' },
  }

  try {
    const result = await workflow.runHumanGate({
      phase: { id: 'review-plan', gate: 'Plan Review' },
      issue: { number: 41, title: 'Administer checkpoints' },
      state,
    })
    assert.equal(result, 'retry')
    assert.equal(
      state.phaseIndex,
      PHASES.findIndex((phase) => phase.id === 'plan'),
    )
    assert.equal(state.pendingFeedback, 'Separate API and web rollout')
    assert.equal(state.sessions.plan, undefined)
  } finally {
    workflow.close()
  }
})
