#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { DeliveryCodex } from './delivery-codex.mjs'
import { DeliveryGitHub, readDeliveryArtifacts } from './delivery-github.mjs'
import {
  approvalFingerprint,
  deriveDeliveryState,
  parseDeliveryArguments,
  resolveDeliveryProfile,
} from './delivery-model.mjs'
import { readyMetadataErrors } from './delivery-pr.mjs'
import {
  branchName,
  domainScope,
  featureDirectoryFromIssue,
  slugify,
  validateCommitMessage,
  validateFeatureDirectory,
} from './workflow-model.mjs'

const ACTIONS = new Set(['start', 'status', 'approve', 'continue', 'review', 'validate', 'adopt'])

export class DeliveryWorkflow {
  constructor({
    root = process.cwd(),
    input = process.stdin,
    output = process.stdout,
    github = new DeliveryGitHub({ root }),
    codex = new DeliveryCodex({ root, output }),
    runCommand = spawnSync,
  } = {}) {
    this.root = root
    this.output = output
    this.github = github
    this.codex = codex
    this.runCommand = runCommand
    this.terminal = createInterface({ input, output })
  }

  close() {
    this.terminal.close()
  }

  write(value = '') {
    this.output.write(`${value}\n`)
  }

  async prompt(value) {
    return (await this.terminal.question(value)).trim()
  }

  async run(options) {
    if (!ACTIONS.has(options.action)) {
      throw new Error(`Unknown delivery action: ${options.action}`)
    }
    if (!options.issue) {
      const answer = await this.prompt('Numéro de l’issue GitHub : #')
      options.issue = Number(answer)
    }
    if (!Number.isSafeInteger(options.issue) || options.issue < 1) {
      throw new Error('A positive GitHub issue number is required.')
    }

    const issue = this.github.fetchIssue(options.issue)
    const resolved = this.resolveDelivery(issue, options)
    if (options.action === 'start') {
      return this.start({ issue, options, ...resolved })
    }
    if (options.action === 'status') {
      return this.status({ issue, options, ...resolved })
    }
    if (options.action === 'approve') {
      return this.approve({ issue, options, ...resolved })
    }
    if (options.action === 'continue') {
      return this.continue({ issue, options, ...resolved })
    }
    if (options.action === 'review') {
      return this.review({ issue, options, ...resolved })
    }
    if (options.action === 'validate') {
      return this.validate({ issue, options, ...resolved })
    }
    return this.adopt({ issue, options, ...resolved })
  }

  resolveDelivery(issue, options) {
    const pointer = this.readPointer(issue.number)
    const labels = (issue.labels ?? []).map((label) =>
      typeof label === 'string' ? label : label.name,
    )
    const issueSelectsProfile = labels.some((label) => label.startsWith('delivery:'))
    const profile = resolveDeliveryProfile({
      requested: options.profile ?? (issueSelectsProfile ? null : pointer?.profile),
      labels: issue.labels,
    })
    const featureDirectory = validateFeatureDirectory(
      options.featureDirectory ??
        featureDirectoryFromIssue(issue) ??
        pointer?.featureDirectory ??
        `specs/standalone/${slugify(issue.title)}`,
      this.root,
    )
    return {
      profile,
      featureDirectory,
      branch: branchName(issue, featureDirectory, profile.id),
    }
  }

  context({ issue, profile, featureDirectory, branch }) {
    const artifacts = readDeliveryArtifacts(this.root, featureDirectory)
    const github = this.github.pullRequestContext(branch)
    let review = github.review
    let checks = github.checks
    const head = github.pullRequest?.headRefOid ?? this.safeHeadSha()
    if (review?.commit && head && review.commit !== head) {
      review = null
    }
    if (checks?.commit && head && checks.commit !== head) {
      checks = { passed: false, evidence: [] }
    }
    const state = deriveDeliveryState({
      profile: profile.id,
      issue,
      artifacts,
      pullRequest: github.pullRequest,
      approvals: github.approvals,
      review,
      checks,
    })
    return { artifacts, ...github, review, checks, state }
  }

  async start({ issue, options, profile, featureDirectory, branch }) {
    const preview = {
      issue: issue.number,
      branch,
      featureDirectory,
      profile: profile.id,
      action: profile.id === 'lite' ? 'implement-lite' : 'draft',
    }
    if (options.dryRun) {
      this.print(preview, options)
      return 0
    }
    this.github.assertCleanWorktree()
    this.github.prepareBranch(branch)
    this.writePointer({ issue: issue.number, featureDirectory, profile: profile.id })
    fs.mkdirSync(path.join(this.root, featureDirectory), { recursive: true })

    const before = this.context({ issue, profile, featureDirectory, branch })
    if (before.pullRequest) {
      throw new Error(
        `Delivery already has PR #${before.pullRequest.number}. Use continue or adopt.`,
      )
    }
    const phase = profile.id === 'lite' ? 'implement-lite' : 'draft'
    const response = await this.runAgent({
      phase,
      issue,
      profile,
      featureDirectory,
      state: before.state,
    })
    await this.publishAgentCheckpoint({
      response,
      phase,
      issue,
      profile,
      featureDirectory,
      branch,
    })
    return 0
  }

  status({ issue, options, profile, featureDirectory, branch }) {
    this.ensureDeliveryBranch(branch)
    const context = this.context({ issue, profile, featureDirectory, branch })
    this.print(
      {
        issue: issue.number,
        pullRequest: context.pullRequest?.number ?? null,
        branch,
        featureDirectory,
        profile: context.state.profile,
        stage: context.state.stage,
        kanbanStatus: context.state.kanbanStatus,
        progress: context.state.progress,
        validation: context.state.validation,
      },
      options,
    )
    return 0
  }

  approve({ issue, options, profile, featureDirectory, branch }) {
    this.ensureDeliveryBranch(branch)
    const context = this.context({ issue, profile, featureDirectory, branch })
    if (!context.pullRequest) {
      throw new Error('No pull request exists for this delivery.')
    }
    const gate = options.gate ?? gateForStage(context.state.stage)
    if (!gate || !profile.gates.includes(gate)) {
      throw new Error(`Gate ${gate ?? '<none>'} is not expected for profile ${profile.id}.`)
    }
    const approval = {
      version: 1,
      gate,
      approvedBy: this.github.authenticatedUser(),
      approvedAt: new Date().toISOString(),
      fingerprint: approvalFingerprint(gate, context.artifacts),
      commit: context.pullRequest.headRefOid,
    }
    if (options.dryRun) {
      this.print(approval, options)
      return 0
    }
    this.github.assertCleanWorktree()
    if (this.github.headSha() !== context.pullRequest.headRefOid) {
      throw new Error(
        'Local HEAD differs from the pull request head; pull the branch before approval.',
      )
    }
    this.github.recordApproval({ pullRequest: context.pullRequest, approval })
    this.synchronize({ issue, profile, featureDirectory, branch })
    return 0
  }

  async continue({ issue, options, profile, featureDirectory, branch }) {
    this.ensureDeliveryBranch(branch)
    const context = this.context({ issue, profile, featureDirectory, branch })
    if (options.dryRun) {
      this.print({ stage: context.state.stage, nextAction: nextAction(context.state) }, options)
      return 0
    }
    if (
      [
        'waiting-for-build-approval',
        'waiting-for-spec-approval',
        'waiting-for-plan-approval',
      ].includes(context.state.stage)
    ) {
      throw new Error(`${context.state.stageLabel} requires a human approval before continuing.`)
    }
    if (context.state.stage === 'drafting' || context.state.stage === 'planning') {
      this.github.assertCleanWorktree()
      const response = await this.runAgent({
        phase: 'draft',
        issue,
        profile,
        featureDirectory,
        state: context.state,
      })
      await this.publishAgentCheckpoint({
        response,
        phase: 'draft',
        issue,
        profile,
        featureDirectory,
        branch,
      })
      return 0
    }
    if (context.state.stage === 'implementing') {
      this.github.assertCleanWorktree()
      const openFindings = context.review?.findings?.filter((finding) => finding.status === 'open')
      const phase = openFindings?.length
        ? 'fix'
        : profile.id === 'lite'
          ? 'implement-lite'
          : 'implement'
      const response = await this.runAgent({
        phase,
        issue,
        profile,
        featureDirectory,
        state: context.state,
        feedback: openFindings?.length ? JSON.stringify(openFindings, null, 2) : null,
      })
      await this.publishAgentCheckpoint({
        response,
        phase,
        issue,
        profile,
        featureDirectory,
        branch,
      })
      return 0
    }
    if (context.state.stage === 'independent-review') {
      return this.review({ issue, options, profile, featureDirectory, branch })
    }
    if (context.state.stage === 'final-verification') {
      if (context.checks.commit && context.checks.commit === context.pullRequest?.headRefOid) {
        this.synchronize({ issue, profile, featureDirectory, branch })
        this.write('Local verification is current; waiting for GitHub checks to finish.')
        return 0
      }
      return this.verify({ issue, profile, featureDirectory, branch })
    }
    if (context.state.stage === 'delivery-review') {
      const metadataErrors = readyMetadataErrors(context.pullRequest.body)
      if (metadataErrors.length > 0) {
        throw new Error(
          `Complete the human-owned PR metadata before marking it ready:\n- ${metadataErrors.join('\n- ')}`,
        )
      }
      this.synchronize({ issue, profile, featureDirectory, branch })
      this.github.markReady(context.pullRequest)
      this.write(`PR #${context.pullRequest.number} is ready for human delivery review.`)
      return 0
    }
    throw new Error(`Delivery cannot continue from ${context.state.stage}.`)
  }

  async review({ issue, options, profile, featureDirectory, branch }) {
    this.ensureDeliveryBranch(branch)
    const context = this.context({ issue, profile, featureDirectory, branch })
    if (options.dryRun) {
      this.print(
        { phase: 'review', commit: this.safeHeadSha(), state: context.state.stage },
        options,
      )
      return 0
    }
    if (!context.pullRequest) {
      throw new Error('No pull request exists for this delivery.')
    }
    if (context.state.stage !== 'independent-review') {
      throw new Error(`Independent review is not expected during ${context.state.stageLabel}.`)
    }
    this.github.assertCleanWorktree()
    const response = await this.runAgent({
      phase: 'review',
      issue,
      featureDirectory,
      profile,
      state: context.state,
    })
    const review = {
      version: 1,
      completed: true,
      commit: this.github.headSha(),
      reviewedAt: new Date().toISOString(),
      findings: response.findings,
    }
    this.github.recordIndependentReview({
      pullRequest: context.pullRequest,
      review,
      summary: response.summary,
    })
    this.synchronize({ issue, profile, featureDirectory, branch })
    return 0
  }

  validate({ issue, options, profile, featureDirectory, branch }) {
    this.ensureDeliveryBranch(branch)
    const context = this.context({ issue, profile, featureDirectory, branch })
    this.print(
      {
        valid: context.state.validation.valid,
        errors: context.state.validation.errors,
        warnings: context.state.validation.warnings,
        stage: context.state.stage,
      },
      options,
    )
    return context.state.validation.valid ? 0 : 1
  }

  adopt({ issue, options, profile, featureDirectory, branch }) {
    this.ensureDeliveryBranch(branch)
    const context = this.context({ issue, profile, featureDirectory, branch })
    if (!context.pullRequest) {
      throw new Error(`No pull request found for branch ${branch}.`)
    }
    if (options.dryRun) {
      this.print(
        {
          pullRequest: context.pullRequest.number,
          stage: context.state.stage,
          profile: profile.id,
          featureDirectory,
        },
        options,
      )
      return 0
    }
    this.writePointer({ issue: issue.number, featureDirectory, profile: profile.id })
    this.synchronize({ issue, profile, featureDirectory, branch })
    this.write(`Adopted PR #${context.pullRequest.number} into the lean delivery workflow.`)
    return 0
  }

  async verify({ issue, profile, featureDirectory, branch }) {
    const context = this.context({ issue, profile, featureDirectory, branch })
    if (context.state.stage !== 'final-verification') {
      throw new Error(`Final verification is not expected during ${context.state.stageLabel}.`)
    }
    this.github.assertCleanWorktree()
    const commands = [
      ['pnpm', ['check']],
      ['pnpm', ['typecheck']],
      ['pnpm', ['test']],
      ['pnpm', ['test:spec-kit']],
    ]
    const evidence = []
    for (const [command, args] of commands) {
      this.write(`$ ${command} ${args.join(' ')}`)
      const result = this.runCommand(command, args, {
        cwd: this.root,
        stdio: 'inherit',
        env: process.env,
      })
      if (result.status !== 0) {
        throw new Error(`Verification failed: ${command} ${args.join(' ')}`)
      }
      evidence.push(`${command} ${args.join(' ')}: passed`)
    }
    if (this.github.filesChangedFromBase().some((file) => file.startsWith('apps/web/'))) {
      const browser = await this.prompt('Preuve du parcours navigateur affecté : ')
      if (!browser) {
        throw new Error('Browser evidence is required for apps/web changes.')
      }
      evidence.push(`Browser: ${browser}`)
    }
    this.github.recordVerification({
      pullRequest: context.pullRequest,
      verification: {
        version: 1,
        passed: true,
        commit: this.github.headSha(),
        verifiedAt: new Date().toISOString(),
        evidence,
      },
    })
    this.synchronize({ issue, profile, featureDirectory, branch })
    return 0
  }

  async runAgent({ phase, issue, profile, featureDirectory, state, feedback = null }) {
    let response = await this.codex.run({
      phase,
      issue,
      featureDirectory,
      profile: profile.id,
      state,
      feedback,
    })
    while (response.outcome === 'needs_decision') {
      this.write(
        response.questions.map((question, index) => `${index + 1}. ${question}`).join('\n'),
      )
      const answer = await this.prompt('Réponse groupée, ou /pause : ')
      if (!answer || answer === '/pause') {
        throw new Error('Delivery paused while waiting for a human decision.')
      }
      response = await this.codex.run({
        phase,
        issue,
        featureDirectory,
        profile: profile.id,
        state,
        feedback: answer,
      })
    }
    if (response.outcome === 'blocked') {
      throw new Error(response.summary)
    }
    return response
  }

  publishAgentCheckpoint({ response, phase, issue, profile, featureDirectory, branch }) {
    const changedFiles = this.github.changedFiles()
    if (changedFiles.length === 0) {
      throw new Error(`Codex ${phase} phase completed without an observable file change.`)
    }
    const commitMessage = validOrDefaultMessage(
      response.commit_message,
      phase,
      issue,
      featureDirectory,
    )
    const commit = this.github.commitCheckpoint(commitMessage)
    if (commit) {
      this.github.push(branch)
    }
    const context = this.synchronize({ issue, profile, featureDirectory, branch })
    this.write(`${response.summary}\nStage: ${context.state.stageLabel}`)
  }

  synchronize({ issue, profile, featureDirectory, branch }) {
    let context = this.context({ issue, profile, featureDirectory, branch })
    const pullRequest = this.github.syncPullRequest({
      branch,
      issue,
      featureDirectory,
      state: context.state,
    })
    context = this.context({ issue, profile, featureDirectory, branch })
    this.github.updateKanbanStatus(issue, context.state.kanbanStatus)
    if (pullRequest) {
      this.write(`PR synchronized: ${pullRequest.url}`)
    }
    return context
  }

  ensureDeliveryBranch(branch) {
    if (this.github.currentBranch() === branch) {
      return
    }
    throw new Error(`Switch to ${branch} before continuing this delivery.`)
  }

  pointerPath() {
    return path.join(this.root, '.specify', 'delivery.json')
  }

  readPointer(issueNumber) {
    const file = this.pointerPath()
    if (!fs.existsSync(file)) {
      return null
    }
    const pointer = JSON.parse(fs.readFileSync(file, 'utf8'))
    return pointer.issue === issueNumber ? pointer : null
  }

  writePointer(pointer) {
    fs.mkdirSync(path.dirname(this.pointerPath()), { recursive: true })
    fs.writeFileSync(this.pointerPath(), `${JSON.stringify(pointer, null, 2)}\n`)
  }

  safeHeadSha() {
    try {
      return this.github.headSha()
    } catch {
      return null
    }
  }

  print(value, options) {
    if (options.json) {
      this.write(JSON.stringify(value))
      return
    }
    this.write(JSON.stringify(value, null, 2))
  }
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const workflow = new DeliveryWorkflow(dependencies)
  try {
    const options = parseDeliveryArguments(argv)
    return await workflow.run(options)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  } finally {
    workflow.close()
  }
}

function gateForStage(stage) {
  return {
    'waiting-for-build-approval': 'ready-to-build',
    'waiting-for-spec-approval': 'spec-review',
    'waiting-for-plan-approval': 'plan-review',
  }[stage]
}

function nextAction(state) {
  return {
    drafting: 'draft',
    planning: 'draft',
    'waiting-for-build-approval': 'approve-ready-to-build',
    'waiting-for-spec-approval': 'approve-spec',
    'waiting-for-plan-approval': 'approve-plan',
    implementing: 'implement-or-fix',
    'independent-review': 'review',
    'final-verification': 'verify',
    'delivery-review': 'mark-ready',
    done: 'none',
  }[state.stage]
}

function validOrDefaultMessage(message, phase, issue, featureDirectory) {
  try {
    return validateCommitMessage(message)
  } catch {
    const scope = domainScope(featureDirectory)
    const title = issue.title.replace(/[.\n]+/g, '').trim()
    const prefix =
      phase === 'draft'
        ? 'docs'
        : phase === 'implement'
          ? 'feat'
          : phase === 'implement-lite'
            ? 'chore'
            : 'fix'
    const action =
      phase === 'draft' ? 'Prepare' : phase.startsWith('implement') ? 'Implement' : 'Resolve'
    return validateCommitMessage(`${prefix}(${scope}): ${action} ${title}`.slice(0, 100).trim())
  }
}

const isEntrypoint =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href ===
    pathToFileURL(fileURLToPath(import.meta.url)).href

if (isEntrypoint) {
  process.exitCode = await main()
}
