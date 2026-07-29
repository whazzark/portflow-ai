import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable, Writable } from 'node:stream'
import { test } from 'node:test'

import { writeFeatureContext } from './workflow.mjs'
import { acquireWorkflowLock } from './workflow-lock.mjs'
import {
  OrcaClient,
  OrcaWorkflowLauncher,
  parseOrcaArguments,
  workflowCommand,
} from './workflow-orca.mjs'

function terminalHarness() {
  let output = ''
  return {
    input: Readable.from([]),
    output: new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString()
        callback()
      },
    }),
    text: () => output,
  }
}

function noOpLock() {
  return { release() {} }
}

class FakeOrca {
  constructor(root) {
    this.root = root
    this.worktrees = []
    this.terminals = new Map()
    this.created = []
    this.sent = []
    this.focused = []
    this.nextTerminal = 1
  }

  assertReady() {}

  listWorktrees() {
    return this.worktrees
  }

  createWorktree({ name, issueNumber }) {
    const worktreePath = path.join(this.root, `issue-${issueNumber}`)
    fs.mkdirSync(worktreePath, { recursive: true })
    const worktree = {
      id: `repo::${worktreePath}`,
      path: worktreePath,
      branch: `refs/heads/${name}`,
      linkedIssue: issueNumber,
    }
    const startupTerminal = {
      handle: `term-${this.nextTerminal++}`,
    }
    this.created.push({ name, issueNumber, worktree })
    this.worktrees.push(worktree)
    this.terminals.set(worktree.id, [
      {
        ...startupTerminal,
        title: null,
        connected: true,
        orphaned: false,
      },
    ])
    return { worktree, startupTerminal }
  }

  listTerminals(worktreeId) {
    return this.terminals.get(worktreeId) ?? []
  }

  renameTerminal(handle, title) {
    const terminal = this.findTerminal(handle)
    terminal.title = title
  }

  sendTerminal(handle, command) {
    this.sent.push({ handle, command })
  }

  createTerminal({ worktreeId, title, command }) {
    const terminal = {
      handle: `term-${this.nextTerminal++}`,
      title,
      connected: true,
      orphaned: false,
    }
    this.terminals.set(worktreeId, [...this.listTerminals(worktreeId), terminal])
    this.sent.push({ handle: terminal.handle, command })
    return { terminal }
  }

  focusTerminal(handle) {
    this.focused.push(handle)
  }

  findTerminal(handle) {
    for (const terminals of this.terminals.values()) {
      const terminal = terminals.find((candidate) => candidate.handle === handle)
      if (terminal) {
        return terminal
      }
    }
    throw new Error(`Unknown fake terminal: ${handle}`)
  }
}

test('parses Orca run, resume, status, and focus commands', () => {
  assert.deepEqual(parseOrcaArguments(['--', '201']), {
    action: 'run',
    issue: 201,
    featureDirectory: null,
    dryRun: false,
    modelPolicy: null,
    escalatedPhases: [],
  })
  assert.equal(parseOrcaArguments(['resume', '--issue', '201']).action, 'resume')
  assert.equal(parseOrcaArguments(['status']).action, 'status')
  assert.deepEqual(parseOrcaArguments(['focus', '--issue', '201']), {
    action: 'focus',
    issue: 201,
    featureDirectory: null,
    dryRun: false,
    modelPolicy: null,
    escalatedPhases: [],
  })
})

test('builds a fixed, validated workflow command for the Orca terminal', () => {
  assert.equal(
    workflowCommand({
      action: 'run',
      issueNumber: 201,
      featureDirectory: 'specs/standalone/parallel-workflow',
      modelPolicy: 'quality',
      escalatedPhases: ['implement'],
      installDependencies: true,
    }),
    "('pnpm' 'install' '--frozen-lockfile' && 'pnpm' 'spec:workflow' '--' 'run' '--issue' '201' '--feature-dir' 'specs/standalone/parallel-workflow' '--model-policy' 'quality' '--escalate-phase' 'implement'); portflow_workflow_status=$?; exit $portflow_workflow_status",
  )
  assert.throws(
    () =>
      workflowCommand({
        action: 'run',
        issueNumber: 201,
        featureDirectory: 'specs/standalone/parallel-workflow; touch /tmp/injected',
      }),
    /feature directory/,
  )
  assert.throws(
    () =>
      workflowCommand({
        action: 'run',
        issueNumber: 201,
        featureDirectory: 'specs/standalone/parallel-workflow',
        modelPolicy: 'quality; touch /tmp/injected',
      }),
    /model policy/,
  )
})

test('calls Orca with argument arrays and an independent origin/master worktree', () => {
  const calls = []
  const client = new OrcaClient({
    root: '/repo',
    exec(command, args, options) {
      calls.push({ command, args, options })
      return JSON.stringify({
        ok: true,
        result: {
          worktree: {
            id: 'repo::/worktree',
            path: '/worktree',
            branch: 'refs/heads/feat/201-parallel-workflow',
          },
        },
      })
    },
  })

  client.createWorktree({
    name: 'feat/201-parallel-workflow',
    issueNumber: 201,
  })

  assert.deepEqual(calls[0].args, [
    'worktree',
    'create',
    '--repo',
    'path:/repo',
    '--name',
    'feat/201-parallel-workflow',
    '--base-branch',
    'origin/master',
    '--issue',
    '201',
    '--no-parent',
    '--setup',
    'skip',
    '--json',
  ])
  assert.equal(calls[0].command, 'orca')
  assert.equal(calls[0].options.shell, undefined)
})

test('launches independent issue workflows and reuses an active issue worktree', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portflow-orca-launch-'))
  const terminal = terminalHarness()
  const orca = new FakeOrca(root)
  const github = {
    fetchIssue(issueNumber) {
      return {
        number: issueNumber,
        title: `Parallel workflow ${issueNumber}`,
        body: `Artifact: specs/standalone/parallel-workflow-${issueNumber}/spec.md`,
        labels: [],
      }
    },
  }
  const launcher = new OrcaWorkflowLauncher({
    root,
    input: terminal.input,
    output: terminal.output,
    github,
    orca,
    acquireLock: noOpLock,
  })

  try {
    for (const issue of [201, 202]) {
      assert.equal(
        await launcher.run({
          action: 'run',
          issue,
          featureDirectory: null,
          dryRun: false,
          modelPolicy: 'economy',
          escalatedPhases: [],
        }),
        0,
      )
    }

    assert.equal(orca.created.length, 2)
    assert.deepEqual(
      orca.created.map(({ issueNumber }) => issueNumber),
      [201, 202],
    )
    assert.notEqual(orca.created[0].worktree.path, orca.created[1].worktree.path)
    assert.match(orca.sent[0].command, /'pnpm' 'install' '--frozen-lockfile'/)
    assert.match(orca.sent[0].command, /'run' '--issue' '201'/)
    assert.match(orca.sent[1].command, /'run' '--issue' '202'/)

    await launcher.run({
      action: 'run',
      issue: 201,
      featureDirectory: null,
      dryRun: false,
      modelPolicy: null,
      escalatedPhases: [],
    })
    assert.equal(orca.created.length, 2)
    assert.equal(orca.sent.length, 2)
    assert.match(terminal.text(), /issue #201 est déjà actif/)
  } finally {
    launcher.close()
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('resumes saved state in the existing issue worktree and aggregates status', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portflow-orca-resume-'))
  const terminal = terminalHarness()
  const orca = new FakeOrca(root)
  const created = orca.createWorktree({
    name: 'feat/201-parallel-workflow',
    issueNumber: 201,
  })
  orca.terminals.set(created.worktree.id, [])
  fs.mkdirSync(path.join(created.worktree.path, 'node_modules'), { recursive: true })
  const stateDirectory = path.join(created.worktree.path, '.specify', 'workflows', 'runs')
  fs.mkdirSync(stateDirectory, { recursive: true })
  fs.writeFileSync(
    path.join(stateDirectory, 'issue-201.json'),
    `${JSON.stringify({
      issueNumber: 201,
      featureDirectory: 'specs/standalone/parallel-workflow',
      branch: 'feat/201-parallel-workflow',
      phaseIndex: 3,
      completed: false,
    })}\n`,
  )
  const launcher = new OrcaWorkflowLauncher({
    root,
    input: terminal.input,
    output: terminal.output,
    github: {},
    orca,
    acquireLock: noOpLock,
  })

  try {
    assert.equal(
      await launcher.run({
        action: 'resume',
        issue: 201,
        featureDirectory: null,
        dryRun: false,
        modelPolicy: null,
        escalatedPhases: ['implement'],
      }),
      0,
    )
    assert.match(orca.sent.at(-1).command, /'resume' '--issue' '201'/)
    assert.doesNotMatch(orca.sent.at(-1).command, /'pnpm' 'install'/)

    launcher.showStatus()
    assert.match(terminal.text(), /#201 · plan · actif · feat\/201-parallel-workflow/)

    launcher.focus(201)
    assert.equal(orca.focused.length, 1)
  } finally {
    launcher.close()
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('uses an atomic issue lock shared through the Git common directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portflow-workflow-lock-'))
  const commonDirectory = path.join(root, 'common-git')
  const exec = () => `${commonDirectory}\n`
  const first = acquireWorkflowLock({
    root,
    issueNumber: 201,
    exec,
    processId: 1234,
    processAlive: () => true,
  })

  try {
    assert.throws(
      () =>
        acquireWorkflowLock({
          root,
          issueNumber: 201,
          exec,
          processId: 5678,
          processAlive: () => true,
        }),
      /already active in process 1234/,
    )
  } finally {
    first.release()
  }

  const second = acquireWorkflowLock({
    root,
    issueNumber: 201,
    exec,
    processId: 5678,
    processAlive: () => true,
  })
  second.release()
  fs.rmSync(root, { recursive: true, force: true })
})

test('writes the Spec Kit-compatible feature_directory key per worktree', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portflow-feature-context-'))
  try {
    writeFeatureContext(root, 'specs/standalone/parallel-workflow', 201)
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(root, '.specify', 'feature.json'), 'utf8')),
      {
        feature_directory: 'specs/standalone/parallel-workflow',
        issue: 201,
      },
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
