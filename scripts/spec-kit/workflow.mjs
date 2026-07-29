#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { WorkflowCodex } from './workflow-codex.mjs'
import { WorkflowGitHub } from './workflow-github.mjs'
import {
  branchName,
  defaultCommitMessage,
  featureDirectoryFromIssue,
  KANBAN_STATUSES,
  nextPhaseIndex,
  PHASES,
  parseArguments,
  SPEC_STATUSES,
  slugify,
  validateCommitMessage,
  validateFeatureDirectory,
} from './workflow-model.mjs'

const usage = `Usage:
  pnpm spec:workflow
  pnpm spec:workflow -- <issue-number>
  pnpm spec:workflow -- run [--issue <number>] [--feature-dir <specs/path>] [--dry-run]
  pnpm spec:workflow -- resume [--issue <number>]
  pnpm spec:workflow -- status [--issue <number>]
`

export class TerminalWorkflow {
  constructor({
    root = process.cwd(),
    input = process.stdin,
    output = process.stdout,
    github = new WorkflowGitHub({ root }),
    codex = new WorkflowCodex({ root, output }),
  } = {}) {
    this.root = root
    this.output = output
    this.github = github
    this.codex = codex
    this.terminal = createInterface({ input, output })
  }

  close() {
    this.terminal.close()
  }

  async prompt(message) {
    return (await this.terminal.question(message)).trim()
  }

  write(message = '') {
    this.output.write(`${message}\n`)
  }

  stateDirectory() {
    return path.join(this.root, '.specify', 'workflows', 'runs')
  }

  statePath(issueNumber) {
    return path.join(this.stateDirectory(), `issue-${issueNumber}.json`)
  }

  loadState(issueNumber) {
    const statePath = this.statePath(issueNumber)
    return fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : null
  }

  saveState(state) {
    fs.mkdirSync(this.stateDirectory(), { recursive: true })
    fs.writeFileSync(
      this.statePath(state.issueNumber),
      `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    )
  }

  findStates() {
    if (!fs.existsSync(this.stateDirectory())) {
      return []
    }
    return fs
      .readdirSync(this.stateDirectory())
      .filter((file) => /^issue-\d+\.json$/.test(file))
      .map((file) => JSON.parse(fs.readFileSync(path.join(this.stateDirectory(), file), 'utf8')))
  }

  async resolveIssueNumber(options) {
    if (options.issue) {
      return options.issue
    }
    if (options.action === 'resume') {
      const active = this.findStates().filter((state) => !state.completed)
      if (active.length === 1) {
        return active[0].issueNumber
      }
    }
    const answer = await this.prompt('Numéro de l’issue GitHub : #')
    const number = Number(answer)
    if (!Number.isSafeInteger(number) || number < 1) {
      throw new Error('A valid GitHub issue number is required.')
    }
    return number
  }

  async resolveFeatureDirectory(options, issue) {
    const fromIssue = featureDirectoryFromIssue(issue)
    if (options.featureDirectory) {
      return validateFeatureDirectory(options.featureDirectory, this.root)
    }
    if (fromIssue) {
      return validateFeatureDirectory(fromIssue, this.root)
    }

    const recommendation = `specs/standalone/${slugify(issue.title)}`
    if (options.dryRun) {
      return validateFeatureDirectory(recommendation, this.root)
    }
    const answer = await this.prompt(
      `Répertoire canonique recommandé [${recommendation}] (Entrée pour accepter) : `,
    )
    return validateFeatureDirectory(answer || recommendation, this.root)
  }

  showStatus(issueNumber = null) {
    const states = issueNumber ? [this.loadState(issueNumber)].filter(Boolean) : this.findStates()
    if (states.length === 0) {
      this.write('Aucun workflow local trouvé.')
      return
    }
    for (const state of states) {
      const phase = PHASES[state.phaseIndex]?.id ?? 'terminé'
      this.write(
        `#${state.issueNumber} · ${state.completed ? 'terminé' : phase} · ${state.featureDirectory} · ${state.branch}`,
      )
    }
  }

  async run(options) {
    if (options.action === 'status') {
      this.showStatus(options.issue)
      return 0
    }

    const issueNumber = await this.resolveIssueNumber(options)
    const issue = this.github.fetchIssue(issueNumber)
    let state = this.loadState(issue.number)
    const featureDirectory = state
      ? validateFeatureDirectory(options.featureDirectory ?? state.featureDirectory, this.root)
      : await this.resolveFeatureDirectory(options, issue)
    const expectedBranch = state?.branch ?? branchName(issue, featureDirectory)
    const existingSpec = fs.existsSync(path.join(this.root, featureDirectory, 'spec.md'))
    assertNotHistorical(this.root, featureDirectory)

    if (options.dryRun) {
      this.write(
        JSON.stringify(
          {
            issue: `#${issue.number} ${issue.title}`,
            featureDirectory,
            branch: expectedBranch,
            startsAt: existingSpec ? 'clarify' : 'specify',
            phases: PHASES.map((phase) => phase.id),
          },
          null,
          2,
        ),
      )
      return 0
    }

    if (!state) {
      if (options.action === 'resume') {
        throw new Error(`No local workflow state exists for issue #${issue.number}.`)
      }
      this.github.assertCleanWorktree()
      this.github.prepareBranch(expectedBranch)
      state = {
        version: 2,
        issueNumber: issue.number,
        featureDirectory,
        branch: expectedBranch,
        phaseIndex: nextPhaseIndex({}, existingSpec),
        sessions: {},
        checkpoints: [],
        completed: false,
        checks: null,
      }
      this.saveState(state)
    } else {
      if (state.featureDirectory !== featureDirectory || state.branch !== expectedBranch) {
        throw new Error(
          'Local workflow state does not match the issue feature directory or branch.',
        )
      }
      if (this.github.currentBranch() !== state.branch) {
        throw new Error(`Resume this workflow from branch ${state.branch}.`)
      }
      if (state.completed) {
        this.write(`Le workflow de l’issue #${issue.number} est déjà terminé.`)
        return 0
      }
    }

    fs.mkdirSync(path.join(this.root, '.specify'), { recursive: true })
    fs.writeFileSync(
      path.join(this.root, '.specify', 'feature.json'),
      `${JSON.stringify({ featureDirectory, issue: issue.number }, null, 2)}\n`,
    )

    this.write(`\nIssue #${issue.number} — ${issue.title}`)
    this.write(`Branche : ${state.branch}`)
    this.write(`Spec : ${featureDirectory}/spec.md\n`)

    if (state.pendingPublish) {
      this.write('Reprise de la publication du dernier checkpoint approuvé…')
      this.publishPendingCheckpoint({ issue, state })
    }

    while (state.phaseIndex < PHASES.length) {
      const phase = PHASES[state.phaseIndex]
      this.write(`\n━━ ${phase.id} ━━`)
      this.github.updateProjectStatus(issue, {
        status: KANBAN_STATUSES[phase.id],
        specStatus: SPEC_STATUSES[phase.id],
      })

      let outcome = 'advance'
      if (phase.skill || phase.review) {
        outcome = await this.runCodexPhase({ phase, issue, state })
      } else if (phase.gate) {
        outcome = await this.runHumanGate({ phase, issue, state })
      } else if (phase.checks) {
        outcome = await this.runChecks({ issue, state })
      }

      if (outcome === 'pause') {
        this.saveState(state)
        this.write(
          `Workflow mis en pause. Reprendre avec : pnpm spec:workflow -- resume --issue ${issue.number}`,
        )
        return 0
      }
      if (outcome === 'retry') {
        this.saveState(state)
        continue
      }
      if (outcome === 'implement-again') {
        state.phaseIndex = PHASES.findIndex((candidate) => candidate.id === 'implement')
        this.saveState(state)
        continue
      }
      if (outcome === 'plan-again') {
        state.phaseIndex = PHASES.findIndex((candidate) => candidate.id === 'plan')
        this.saveState(state)
        continue
      }

      state.phaseIndex += 1
      this.saveState(state)
    }

    state.completed = true
    this.saveState(state)
    this.write(
      `\nWorkflow terminé pour l’issue #${issue.number}. La PR reste soumise à validation humaine.`,
    )
    return 0
  }

  async runCodexPhase({ phase, issue, state }) {
    let feedback = state.pendingFeedback ?? null
    delete state.pendingFeedback

    while (true) {
      this.write(`Codex exécute ${phase.review ? 'la revue fraîche' : `$${phase.skill}`}…`)
      const result = await this.codex.runPhase({
        phase: phase.id,
        skill: phase.skill,
        issue,
        featureDirectory: state.featureDirectory,
        sessionId: state.sessions[phase.id] ?? null,
        feedback,
      })
      state.sessions[phase.id] = result.sessionId
      this.saveState(state)
      feedback = null

      this.write(`\n${result.response.message}\n`)
      if (result.response.status === 'question') {
        const answer = await this.prompt('Votre réponse (ou /pause) : ')
        if (answer === '/pause') {
          return 'pause'
        }
        feedback = answer
        continue
      }
      if (result.response.status === 'blocked') {
        this.github.updateProjectStatus(issue, {
          status: 'Blocked',
          specStatus: 'Blocked',
        })
        const answer = await this.prompt('Blocage : donnez un retour, ou /pause : ')
        if (!answer || answer === '/pause') {
          return 'pause'
        }
        this.github.updateProjectStatus(issue, {
          status: KANBAN_STATUSES[phase.id],
          specStatus: SPEC_STATUSES[phase.id],
        })
        feedback = answer
        continue
      }
      if (phase.review && result.response.status === 'findings') {
        const decision = await this.prompt(
          '[c] Corriger les findings · [j] Accepter avec justification · [p] Pause : ',
        )
        if (decision.toLowerCase() === 'c') {
          state.pendingFeedback = `Resolve these fresh-review findings:\n${result.response.message}`
          delete state.sessions.review
          return 'implement-again'
        }
        if (decision.toLowerCase() === 'j') {
          const justification = await this.prompt('Justification à conserver dans la PR : ')
          this.github.syncPullRequest({
            branch: state.branch,
            issue,
            featureDirectory: state.featureDirectory,
            gate: 'Delivery Review',
            summary: workflowSummary(issue, phase.id),
            delivered: deliveredLines(
              state,
              `Fresh review findings explicitly accepted: ${justification}`,
            ),
          })
          return 'advance'
        }
        return 'pause'
      }
      if (phase.id === 'analyze' && result.response.status === 'findings') {
        const decision = await this.prompt(
          '[c] Corriger les artefacts depuis plan · [j] Accepter avec justification · [p] Pause : ',
        )
        if (decision.toLowerCase() === 'c') {
          state.pendingFeedback = `Resolve these cross-artifact analysis findings:\n${result.response.message}`
          resetSessionsFrom(state, 'plan')
          return 'plan-again'
        }
        if (decision.toLowerCase() !== 'j') {
          return 'pause'
        }
        const justification = await this.prompt('Justification : ')
        this.github.syncPullRequest({
          branch: state.branch,
          issue,
          featureDirectory: state.featureDirectory,
          gate: 'Plan Review',
          summary: workflowSummary(issue, phase.id),
          delivered: deliveredLines(
            state,
            `Analyze findings explicitly accepted: ${justification}`,
          ),
        })
      }

      if (phase.checkpoint) {
        const checkpoint = await this.checkpoint({
          phase,
          issue,
          state,
          response: result.response,
        })
        if (checkpoint === 'retry') {
          feedback = await this.prompt('Retour à appliquer par Codex (ou /pause) : ')
          if (feedback === '/pause') {
            return 'pause'
          }
          continue
        }
        if (checkpoint === 'pause') {
          return 'pause'
        }
        if (phase.id === 'implement' && result.response.status === 'checkpoint') {
          feedback =
            'The human approved and the orchestrator committed that focused checkpoint. Continue with the next coherent TDD checkpoint.'
          continue
        }
      }

      if (phase.id === 'converge' && hasUncheckedTasks(this.root, state.featureDirectory)) {
        this.write('Converge a ajouté du travail restant : retour à implement.')
        state.pendingFeedback =
          'Implement every unchecked task appended by converge, preserving TDD and the approved plan.'
        return 'implement-again'
      }
      if (phase.review) {
        this.github.syncPullRequest({
          branch: state.branch,
          issue,
          featureDirectory: state.featureDirectory,
          gate: 'Delivery Review',
          summary: workflowSummary(issue, phase.id),
          delivered: deliveredLines(state, `Fresh Codex review: ${result.response.message}`),
        })
      }
      return 'advance'
    }
  }

  async checkpoint({ phase, issue, state, response }) {
    const changedFiles = this.github.changedFiles()
    if (changedFiles.length === 0) {
      this.write('Aucun fichier modifié : aucun commit artificiel ne sera créé.')
      return 'advance'
    }

    this.write(`Fichiers du checkpoint :\n${changedFiles.map((file) => `  ${file}`).join('\n')}`)
    const diffStat = this.github.diffStat(changedFiles)
    if (diffStat) {
      this.write(diffStat)
    }
    let proposal = response.commit_message
    try {
      proposal = validateCommitMessage(proposal)
    } catch {
      proposal = validateCommitMessage(
        defaultCommitMessage(phase.id, issue, state.featureDirectory),
      )
    }

    while (true) {
      this.write(`\nCommit proposé : ${proposal}`)
      const decision = (
        await this.prompt('[a] Approuver · [e] Modifier · [r] Rejeter · [p] Pause : ')
      ).toLowerCase()
      if (decision === 'r') {
        return 'retry'
      }
      if (decision === 'p') {
        return 'pause'
      }
      if (decision === 'e') {
        try {
          proposal = validateCommitMessage(await this.prompt('Nouveau message exact : '))
        } catch (error) {
          this.write(error.message)
        }
        continue
      }
      if (decision !== 'a') {
        this.write('Choix invalide.')
        continue
      }

      const commit = this.github.commit(proposal, changedFiles)
      state.checkpoints ??= []
      state.checkpoints.push({
        phase: phase.id,
        commit,
        message: singleLine(response.message),
      })
      state.pendingPublish = { commit, phase: phase.id }
      this.saveState(state)
      this.publishPendingCheckpoint({ issue, state })
      return 'advance'
    }
  }

  publishPendingCheckpoint({ issue, state }) {
    const pending = state.pendingPublish
    if (!pending) {
      return
    }
    this.github.push(state.branch)
    const pullRequest = this.github.syncPullRequest({
      branch: state.branch,
      issue,
      featureDirectory: state.featureDirectory,
      gate: reviewGateForPhase(pending.phase),
      summary: workflowSummary(issue, pending.phase),
      delivered: deliveredLines(state),
    })
    delete state.pendingPublish
    this.saveState(state)
    this.write(`PR synchronisée : ${pullRequest.url}`)
  }

  async runHumanGate({ phase, issue, state }) {
    this.github.syncPullRequest({
      branch: state.branch,
      issue,
      featureDirectory: state.featureDirectory,
      gate: phase.gate,
      summary: workflowSummary(issue, phase.id),
    })
    const decision = (
      await this.prompt(`${phase.gate} — [a] Approuver · [r] Rejeter avec retour · [p] Pause : `)
    ).toLowerCase()
    if (decision === 'a') {
      return 'advance'
    }
    if (decision === 'r') {
      state.phaseIndex =
        phase.id === 'review-spec'
          ? PHASES.findIndex((candidate) => candidate.id === 'clarify')
          : phase.id === 'review-plan'
            ? PHASES.findIndex((candidate) => candidate.id === 'plan')
            : PHASES.findIndex((candidate) => candidate.id === 'implement')
      state.pendingFeedback = await this.prompt('Retour à appliquer : ')
      resetSessionsFrom(state, PHASES[state.phaseIndex].id)
      return 'retry'
    }
    return 'pause'
  }

  async runChecks({ issue, state }) {
    const commands = [
      ['pnpm', ['check']],
      ['pnpm', ['typecheck']],
      ['pnpm', ['test']],
      ['pnpm', ['test:spec-kit']],
    ]
    for (const [command, args] of commands) {
      this.write(`$ ${command} ${args.join(' ')}`)
      const result = spawnSync(command, args, {
        cwd: this.root,
        stdio: 'inherit',
        env: process.env,
      })
      if (result.status !== 0) {
        state.pendingFeedback = `Fix the failing verification command: ${command} ${args.join(' ')}`
        const decision = await this.prompt('[c] Demander à Codex de corriger · [p] Pause : ')
        return decision.toLowerCase() === 'c' ? 'implement-again' : 'pause'
      }
    }
    const webChanged = this.github
      .filesChangedFromBase()
      .some((file) => file.startsWith('apps/web/'))
    let browserEvidence = 'Not applicable (no apps/web changes)'
    if (webChanged) {
      browserEvidence = await this.prompt(
        'Preuve des parcours navigateur affectés (/pause pour suspendre) : ',
      )
      if (!browserEvidence || browserEvidence === '/pause') {
        return 'pause'
      }
    }
    state.checks = {
      passedAt: new Date().toISOString(),
      commands: commands.map(joinCommand),
      browserEvidence,
    }
    this.github.syncPullRequest({
      branch: state.branch,
      issue,
      featureDirectory: state.featureDirectory,
      gate: 'Delivery Review',
      summary: workflowSummary(issue, 'checks'),
      verification: `- Automated checks: \`${commands.map(joinCommand).join(' && ')}\` passed
- Browser journeys: ${browserEvidence}
- Other evidence: analyze and converge executed by the workflow`,
    })
    return 'advance'
  }
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const workflow = new TerminalWorkflow(dependencies)
  try {
    const options = parseArguments(argv)
    return await workflow.run(options)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage}`)
    return 1
  } finally {
    workflow.close()
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

function reviewGateForPhase(phase) {
  if (['specify', 'clarify'].includes(phase)) {
    return 'Spec Review'
  }
  if (['plan', 'checklist', 'tasks', 'analyze'].includes(phase)) {
    return 'Plan Review'
  }
  return 'Delivery Review'
}

function workflowSummary(issue, phase) {
  return `Delivers #${issue.number} (${issue.title}) through the Spec Kit workflow. Current checkpoint: ${phase}.`
}

function singleLine(value) {
  return String(value).replace(/\s+/g, ' ').trim()
}

function deliveredLines(state, extra = null) {
  const lines = (state.checkpoints ?? []).map(
    (checkpoint) => `- ${checkpoint.phase}: ${checkpoint.message}`,
  )
  if (extra) {
    lines.push(`- ${singleLine(extra)}`)
  }
  return lines.join('\n')
}

function resetSessionsFrom(state, phaseId) {
  const start = PHASES.findIndex((phase) => phase.id === phaseId)
  for (const phase of PHASES.slice(start)) {
    delete state.sessions[phase.id]
  }
}

function hasUncheckedTasks(root, featureDirectory) {
  const tasksFile = path.join(root, featureDirectory, 'tasks.md')
  return fs.existsSync(tasksFile) && /^- \[ \]/m.test(fs.readFileSync(tasksFile, 'utf8'))
}

function joinCommand([command, args]) {
  return `${command} ${args.join(' ')}`
}

const isEntrypoint =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href ===
    pathToFileURL(fileURLToPath(import.meta.url)).href

if (isEntrypoint) {
  process.exitCode = await main()
}
