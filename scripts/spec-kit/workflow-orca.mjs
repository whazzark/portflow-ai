#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { WorkflowGitHub } from './workflow-github.mjs'
import { acquireWorkflowLock } from './workflow-lock.mjs'
import {
  branchName,
  featureDirectoryFromIssue,
  PHASES,
  parseArguments,
  parseIssueNumber,
  slugify,
  validateCodexPhase,
  validateFeatureDirectory,
  validateModelPolicy,
} from './workflow-model.mjs'

const usage = `Usage:
  pnpm spec:workflow:orca -- <issue-number>
  pnpm spec:workflow:orca -- run [--issue <number>] [--feature-dir <specs/path>] [--model-policy <economy|quality>] [--escalate-phase <phase>] [--dry-run]
  pnpm spec:workflow:orca -- resume --issue <number> [--escalate-phase <phase>]
  pnpm spec:workflow:orca -- status [--issue <number>]
  pnpm spec:workflow:orca -- focus --issue <number>
`

const terminalTitle = (issueNumber) => `Spec workflow #${issueNumber}`

export class OrcaClient {
  constructor({ root = process.cwd(), exec = execFileSync } = {}) {
    this.root = root
    this.exec = exec
  }

  call(args) {
    const output = this.exec('orca', [...args, '--json'], {
      cwd: this.root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    const response = JSON.parse(String(output))
    if (!response.ok) {
      throw new Error(response.error?.message ?? `Orca command failed: orca ${args.join(' ')}`)
    }
    return response.result
  }

  assertReady() {
    const status = this.call(['status'])
    if (!status.runtime?.reachable || status.runtime.state !== 'ready') {
      throw new Error('Orca is not ready. Start it with `orca open` and retry.')
    }
  }

  listWorktrees() {
    return (
      this.call(['worktree', 'list', '--repo', `path:${this.root}`, '--limit', '500']).worktrees ??
      []
    )
  }

  createWorktree({ name, issueNumber }) {
    return this.call([
      'worktree',
      'create',
      '--repo',
      `path:${this.root}`,
      '--name',
      name,
      '--base-branch',
      'origin/master',
      '--issue',
      String(issueNumber),
      '--no-parent',
      '--setup',
      'skip',
    ])
  }

  listTerminals(worktreeId) {
    return this.call(['terminal', 'list', '--worktree', `id:${worktreeId}`]).terminals ?? []
  }

  createTerminal({ worktreeId, title, command, focus = false }) {
    const args = [
      'terminal',
      'create',
      '--worktree',
      `id:${worktreeId}`,
      '--title',
      title,
      '--command',
      command,
    ]
    if (focus) {
      args.push('--focus')
    }
    return this.call(args)
  }

  focusTerminal(handle) {
    return this.call(['terminal', 'switch', '--terminal', handle])
  }
}

export class OrcaWorkflowLauncher {
  constructor({
    root = process.cwd(),
    input = process.stdin,
    output = process.stdout,
    github = new WorkflowGitHub({ root }),
    orca = new OrcaClient({ root }),
    acquireLock = acquireWorkflowLock,
  } = {}) {
    this.root = root
    this.output = output
    this.github = github
    this.orca = orca
    this.acquireLock = acquireLock
    this.terminal = createInterface({ input, output })
  }

  close() {
    this.terminal.close()
  }

  write(message = '') {
    this.output.write(`${message}\n`)
  }

  async prompt(message) {
    return (await this.terminal.question(message)).trim()
  }

  async run(options) {
    this.orca.assertReady()
    if (options.action === 'status') {
      this.showStatus(options.issue)
      return 0
    }

    const issueNumber = await this.resolveIssueNumber(options.issue)
    if (options.action === 'focus') {
      this.focus(issueNumber)
      return 0
    }

    if (options.dryRun) {
      const preflight = await this.resolvePreflight(options, issueNumber)
      this.write(JSON.stringify(this.dryRunPlan(options, preflight), null, 2))
      return 0
    }

    const lock = this.acquireLock({
      root: this.root,
      issueNumber,
      namespace: 'orca-launch',
    })
    try {
      return await this.launch(options, issueNumber)
    } finally {
      lock.release()
    }
  }

  async resolveIssueNumber(value) {
    if (value) {
      return value
    }
    return parseIssueNumber(await this.prompt('Numéro de l’issue GitHub : #'))
  }

  async resolvePreflight(options, issueNumber) {
    const issue = this.github.fetchIssue(issueNumber)
    const linkedDirectory = featureDirectoryFromIssue(issue)
    const recommendation = `specs/standalone/${slugify(issue.title)}`
    let featureDirectory = options.featureDirectory ?? linkedDirectory
    if (!featureDirectory) {
      featureDirectory = options.dryRun
        ? recommendation
        : (await this.prompt(
            `Répertoire canonique recommandé [${recommendation}] (Entrée pour accepter) : `,
          )) || recommendation
    }
    featureDirectory = validateFeatureDirectory(featureDirectory, this.root)
    assertNotHistorical(this.root, featureDirectory)
    return {
      issue,
      issueNumber,
      featureDirectory,
      branch: branchName(issue, featureDirectory),
    }
  }

  async launch(options, issueNumber) {
    const matches = this.issueWorktrees(issueNumber)
    if (matches.length > 1) {
      throw new Error(
        `Multiple Orca worktrees are linked to issue #${issueNumber}; resolve the duplicate before resuming.`,
      )
    }

    let worktree = matches[0] ?? null
    let state = worktree ? readWorkflowState(worktree.path, issueNumber) : null
    if (worktree) {
      const active = this.activeWorkflowTerminal(worktree, issueNumber)
      if (active) {
        this.write(`Le workflow de l’issue #${issueNumber} est déjà actif (${active.handle}).`)
        return 0
      }
      if (state?.completed) {
        this.write(`Le workflow de l’issue #${issueNumber} est déjà terminé.`)
        return 0
      }
      if (options.action === 'resume' && !state) {
        throw new Error(`No local workflow state exists for issue #${issueNumber}.`)
      }
    } else if (options.action === 'resume') {
      throw new Error(`No Orca worktree exists for issue #${issueNumber}.`)
    }

    const preflight = state
      ? preflightFromState(state)
      : await this.resolvePreflight(options, issueNumber)
    if (options.featureDirectory && options.featureDirectory !== preflight.featureDirectory) {
      throw new Error('The requested feature directory does not match the saved workflow state.')
    }

    if (!worktree) {
      const created = this.orca.createWorktree({
        name: preflight.branch,
        issueNumber,
      })
      worktree = created.worktree
      if (!worktree?.id || !worktree.path) {
        throw new Error('Orca did not return the created worktree identity.')
      }
      const createdBranch = normalizeBranch(worktree.branch)
      if (createdBranch !== preflight.branch) {
        throw new Error(
          `Orca created branch ${createdBranch || '(unknown)'}; expected ${preflight.branch}.`,
        )
      }
      state = null
    }

    const action = state ? 'resume' : 'run'
    const installDependencies = !fs.existsSync(path.join(worktree.path, 'node_modules'))
    const command = workflowCommand({
      action,
      issueNumber,
      featureDirectory: preflight.featureDirectory,
      modelPolicy: options.modelPolicy,
      escalatedPhases: options.escalatedPhases,
      installDependencies,
    })
    const handle = this.startWorkflowTerminal({
      worktree,
      issueNumber,
      command,
    })
    this.write(
      `Workflow Orca lancé pour l’issue #${issueNumber} dans ${worktree.path} (${handle}).`,
    )
    return 0
  }

  startWorkflowTerminal({ worktree, issueNumber, command }) {
    const title = terminalTitle(issueNumber)
    const created = this.orca.createTerminal({
      worktreeId: worktree.id,
      title,
      command,
    })
    const handle = terminalHandle(created)
    if (!handle) {
      throw new Error('Orca did not return the workflow terminal handle.')
    }
    return handle
  }

  showStatus(issueNumber = null) {
    const worktrees = this.orca
      .listWorktrees()
      .filter((worktree) => linkedIssueNumber(worktree.linkedIssue) !== null)
      .filter(
        (worktree) =>
          issueNumber === null || linkedIssueNumber(worktree.linkedIssue) === issueNumber,
      )

    if (worktrees.length === 0) {
      this.write('Aucun workflow Orca trouvé.')
      return
    }

    for (const worktree of worktrees) {
      const number = linkedIssueNumber(worktree.linkedIssue)
      const state = readWorkflowState(worktree.path, number)
      const phase = state?.completed
        ? 'terminé'
        : (PHASES[state?.phaseIndex]?.id ?? 'initialisation')
      const activity = this.activeWorkflowTerminal(worktree, number) ? 'actif' : 'en pause'
      this.write(
        `#${number} · ${phase} · ${activity} · ${normalizeBranch(worktree.branch)} · ${worktree.path}`,
      )
    }
  }

  focus(issueNumber) {
    const matches = this.issueWorktrees(issueNumber)
    if (matches.length !== 1) {
      throw new Error(
        matches.length === 0
          ? `No Orca worktree exists for issue #${issueNumber}.`
          : `Multiple Orca worktrees are linked to issue #${issueNumber}.`,
      )
    }
    const terminal = this.activeWorkflowTerminal(matches[0], issueNumber)
    if (!terminal) {
      throw new Error(
        `No active workflow terminal exists for issue #${issueNumber}; resume it first.`,
      )
    }
    this.orca.focusTerminal(terminal.handle)
    this.write(`Terminal du workflow #${issueNumber} affiché dans Orca.`)
  }

  issueWorktrees(issueNumber) {
    return this.orca
      .listWorktrees()
      .filter((worktree) => linkedIssueNumber(worktree.linkedIssue) === issueNumber)
  }

  activeWorkflowTerminal(worktree, issueNumber) {
    return this.orca
      .listTerminals(worktree.id)
      .find(
        (terminal) =>
          terminal.connected && !terminal.orphaned && terminal.title === terminalTitle(issueNumber),
      )
  }

  dryRunPlan(options, preflight) {
    return {
      issue: `#${preflight.issueNumber} ${preflight.issue.title}`,
      featureDirectory: preflight.featureDirectory,
      branch: preflight.branch,
      worktree: {
        baseBranch: 'origin/master',
        linkedIssue: preflight.issueNumber,
        independent: true,
        setup: 'skip',
      },
      command: workflowCommand({
        action: options.action === 'resume' ? 'resume' : 'run',
        issueNumber: preflight.issueNumber,
        featureDirectory: preflight.featureDirectory,
        modelPolicy: options.modelPolicy,
        escalatedPhases: options.escalatedPhases,
        installDependencies: true,
      }),
    }
  }
}

export function parseOrcaArguments(argv) {
  const args = argv[0] === '--' ? argv.slice(1) : [...argv]
  if (args[0] !== 'focus') {
    return parseArguments(args)
  }

  args.shift()
  let issue = null
  while (args.length > 0) {
    const argument = args.shift()
    if (argument === '--issue') {
      issue = parseIssueNumber(args.shift())
      continue
    }
    if (!issue && /^\d+$/.test(argument)) {
      issue = parseIssueNumber(argument)
      continue
    }
    throw new Error(`Unexpected argument: ${argument}`)
  }
  return {
    action: 'focus',
    issue,
    featureDirectory: null,
    dryRun: false,
    modelPolicy: null,
    escalatedPhases: [],
  }
}

export function workflowCommand({
  action,
  issueNumber,
  featureDirectory,
  modelPolicy = null,
  escalatedPhases = [],
  installDependencies = false,
}) {
  if (!['run', 'resume'].includes(action)) {
    throw new Error('The Orca terminal workflow action must be run or resume.')
  }
  const workflowArgs = [
    'pnpm',
    'spec:workflow',
    '--',
    action,
    '--issue',
    String(parseIssueNumber(issueNumber)),
    '--feature-dir',
    validateFeatureDirectory(featureDirectory),
  ]
  if (modelPolicy) {
    workflowArgs.push('--model-policy', validateModelPolicy(modelPolicy))
  }
  for (const phase of escalatedPhases) {
    workflowArgs.push('--escalate-phase', validateCodexPhase(phase))
  }
  const workflow = shellJoin(workflowArgs)
  const command = installDependencies
    ? `${shellJoin(['pnpm', 'install', '--frozen-lockfile'])} && ${workflow}`
    : workflow
  return `(${command}); portflow_workflow_status=$?; exit $portflow_workflow_status`
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const launcher = new OrcaWorkflowLauncher(dependencies)
  try {
    return await launcher.run(parseOrcaArguments(argv))
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage}`)
    return 1
  } finally {
    launcher.close()
  }
}

function preflightFromState(state) {
  return {
    issueNumber: state.issueNumber,
    featureDirectory: validateFeatureDirectory(state.featureDirectory),
    branch: state.branch,
  }
}

function assertNotHistorical(root, featureDirectory) {
  const specFile = path.join(root, featureDirectory, 'spec.md')
  if (
    fs.existsSync(specFile) &&
    /\*\*Status\*\*:\s*Done \(historical\)/i.test(fs.readFileSync(specFile, 'utf8'))
  ) {
    throw new Error(
      'Historical specs cannot start an implementation workflow. Create a new intake issue and feature directory.',
    )
  }
}

function readWorkflowState(root, issueNumber) {
  const statePath = path.join(root, '.specify', 'workflows', 'runs', `issue-${issueNumber}.json`)
  return fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : null
}

function linkedIssueNumber(linkedIssue) {
  if (Number.isSafeInteger(linkedIssue)) {
    return linkedIssue
  }
  return Number.isSafeInteger(linkedIssue?.number) ? linkedIssue.number : null
}

function normalizeBranch(branch) {
  return String(branch ?? '').replace(/^refs\/heads\//, '')
}

function terminalHandle(result) {
  return result?.terminal?.handle ?? result?.handle ?? result?.startupTerminal?.handle ?? null
}

function shellJoin(args) {
  return args.map(shellQuote).join(' ')
}

function shellQuote(value) {
  const text = String(value)
  return `'${text.replaceAll("'", "'\"'\"'")}'`
}

const isEntrypoint =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href ===
    pathToFileURL(fileURLToPath(import.meta.url)).href

if (isEntrypoint) {
  process.exitCode = await main()
}
