import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { renderDeliveryPullRequestBody, updateDeliveryProgress } from './delivery-pr.mjs'
import { parseStatusFiles } from './git-status.mjs'
import { PROJECT_NUMBER, validateCommitMessage } from './workflow-model.mjs'

const APPROVAL_PATTERN = /<!-- portflow:delivery-approval (\{[^\n]*\}) -->/
const REVIEW_PATTERN = /<!-- portflow:independent-review (\{[^\n]*\}) -->/
const VERIFICATION_PATTERN = /<!-- portflow:delivery-verification (\{[^\n]*\}) -->/

export class DeliveryGitHub {
  constructor({ root = process.cwd(), exec = execFileSync, projectNumber = PROJECT_NUMBER } = {}) {
    this.root = root
    this.exec = exec
    this.projectNumber = projectNumber
    this.repository = null
    this.projectContext = null
  }

  command(command, args, options = {}) {
    return this.exec(command, args, {
      cwd: this.root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      ...options,
    })
  }

  git(args, options = {}) {
    return this.command('git', args, options).trim()
  }

  ghJson(args) {
    return JSON.parse(this.command('gh', args))
  }

  resolveRepository() {
    this.repository ??= this.ghJson(['repo', 'view', '--json', 'nameWithOwner']).nameWithOwner
    return this.repository
  }

  authenticatedUser() {
    return this.ghJson(['api', 'user']).login
  }

  fetchIssue(issueNumber) {
    const issue = this.ghJson([
      'issue',
      'view',
      String(issueNumber),
      '--repo',
      this.resolveRepository(),
      '--json',
      'number,title,body,url,state,labels,milestone,projectItems',
    ])
    if (issue.state !== 'OPEN') {
      throw new Error(`Issue #${issueNumber} is ${issue.state.toLowerCase()}.`)
    }
    return issue
  }

  currentBranch() {
    return this.git(['branch', '--show-current'])
  }

  assertCleanWorktree() {
    if (this.changedFiles().length > 0) {
      throw new Error('Delivery commands require a clean worktree.')
    }
  }

  prepareBranch(branch) {
    const current = this.currentBranch()
    if (current === branch) {
      return branch
    }
    if (current !== 'master') {
      throw new Error(`Current branch is ${current}; expected master or ${branch}.`)
    }
    this.git(['switch', '-c', branch], { stdio: 'inherit' })
    return branch
  }

  changedFiles() {
    const output = this.command('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
    return parseStatusFiles(output).filter(
      (file) =>
        !file.startsWith('.specify/workflows/runs/') &&
        file !== '.specify/feature.json' &&
        file !== '.specify/delivery.json',
    )
  }

  filesChangedFromBase(base = 'origin/master') {
    const output = this.git(['diff', '--name-only', `${base}...HEAD`])
    return output ? output.split('\n') : []
  }

  commitCheckpoint(message) {
    const files = this.changedFiles()
    if (files.length === 0) {
      return null
    }
    validateCommitMessage(message)
    this.git(['add', '--all', '--', ...files])
    this.git(['commit', '-m', message], { stdio: 'inherit' })
    return this.git(['rev-parse', 'HEAD'])
  }

  push(branch) {
    this.git(['push', '--set-upstream', 'origin', branch], { stdio: 'inherit' })
  }

  headSha() {
    return this.git(['rev-parse', 'HEAD'])
  }

  findPullRequest(branch) {
    const pullRequests = this.ghJson([
      'pr',
      'list',
      '--repo',
      this.resolveRepository(),
      '--head',
      branch,
      '--state',
      'all',
      '--json',
      'number,url,title,body,isDraft,state,mergedAt,headRefOid',
    ])
    return (
      pullRequests.find((pullRequest) => pullRequest.state === 'OPEN') ??
      pullRequests.find((pullRequest) => pullRequest.mergedAt) ??
      null
    )
  }

  fetchPullRequest(number) {
    return this.ghJson([
      'pr',
      'view',
      String(number),
      '--repo',
      this.resolveRepository(),
      '--json',
      'number,url,title,body,isDraft,state,mergedAt,headRefOid,comments,reviews,statusCheckRollup',
    ])
  }

  pullRequestContext(branch) {
    const summary = this.findPullRequest(branch)
    if (!summary) {
      return {
        pullRequest: null,
        approvals: [],
        review: null,
        checks: { passed: false, evidence: [] },
      }
    }
    const pullRequest = this.fetchPullRequest(summary.number)
    return {
      pullRequest: {
        ...pullRequest,
        merged: Boolean(pullRequest.mergedAt),
      },
      approvals: parseDeliveryApprovals(pullRequest.comments),
      review: parseIndependentReview(pullRequest.comments),
      checks: parseChecks(pullRequest.statusCheckRollup, pullRequest.comments),
    }
  }

  syncPullRequest({ branch, issue, featureDirectory, state }) {
    const existing = this.findPullRequest(branch)
    if (!existing) {
      const body = renderDeliveryPullRequestBody({
        issue,
        featureDirectory,
        state,
      })
      this.command(
        'gh',
        [
          'pr',
          'create',
          '--repo',
          this.resolveRepository(),
          '--base',
          'master',
          '--head',
          branch,
          '--draft',
          '--title',
          issue.title,
          '--body',
          body,
        ],
        { stdio: 'inherit' },
      )
      return this.findPullRequest(branch)
    }
    const body = updateDeliveryProgress(existing.body, state)
    if (body !== existing.body) {
      this.command(
        'gh',
        ['pr', 'edit', String(existing.number), '--repo', this.resolveRepository(), '--body', body],
        { stdio: 'inherit' },
      )
    }
    return { ...existing, body }
  }

  recordApproval({ pullRequest, approval }) {
    const marker = `<!-- portflow:delivery-approval ${JSON.stringify(approval)} -->`
    const body = `${marker}\n✅ **${approval.gate}** approved by @${approval.approvedBy} on \`${String(approval.commit).slice(0, 7)}\`.`
    this.command(
      'gh',
      [
        'pr',
        'comment',
        String(pullRequest.number),
        '--repo',
        this.resolveRepository(),
        '--body',
        body,
      ],
      { stdio: 'inherit' },
    )
  }

  recordIndependentReview({ pullRequest, review, summary }) {
    const marker = `<!-- portflow:independent-review ${JSON.stringify(review)} -->`
    this.command(
      'gh',
      [
        'pr',
        'comment',
        String(pullRequest.number),
        '--repo',
        this.resolveRepository(),
        '--body',
        `${marker}\n${summary}`,
      ],
      { stdio: 'inherit' },
    )
  }

  recordVerification({ pullRequest, verification }) {
    const marker = `<!-- portflow:delivery-verification ${JSON.stringify(verification)} -->`
    const evidence = verification.evidence.map((item) => `- ${item}`).join('\n')
    this.command(
      'gh',
      [
        'pr',
        'comment',
        String(pullRequest.number),
        '--repo',
        this.resolveRepository(),
        '--body',
        `${marker}\n✅ Final verification completed on \`${String(verification.commit).slice(0, 7)}\`.\n\n${evidence}`,
      ],
      { stdio: 'inherit' },
    )
  }

  markReady(pullRequest) {
    if (!pullRequest.isDraft) {
      return
    }
    this.command(
      'gh',
      ['pr', 'ready', String(pullRequest.number), '--repo', this.resolveRepository()],
      { stdio: 'inherit' },
    )
  }

  updateKanbanStatus(issue, status) {
    const context = this.resolveProjectContext()
    let item = this.fetchIssueProjectItem(issue.number, context.project.id)
    if (!item) {
      this.ghJson([
        'project',
        'item-add',
        String(this.projectNumber),
        '--owner',
        context.owner,
        '--url',
        issue.url,
        '--format',
        'json',
      ])
      item = this.fetchIssueProjectItem(issue.number, context.project.id)
    }
    if (!item) {
      throw new Error(
        `Issue #${issue.number} could not be added to Project #${this.projectNumber}.`,
      )
    }
    if (item.status === status) {
      return
    }
    const option = context.status.optionsByName.get(status)
    if (!option) {
      throw new Error(`Project Status option is missing: ${status}`)
    }
    this.command(
      'gh',
      [
        'project',
        'item-edit',
        '--id',
        item.id,
        '--project-id',
        context.project.id,
        '--field-id',
        context.status.id,
        '--single-select-option-id',
        option.id,
      ],
      { stdio: 'inherit' },
    )
  }

  resolveProjectContext() {
    if (this.projectContext) {
      return this.projectContext
    }
    const owner = this.resolveRepository().split('/')[0]
    const projects = this.ghJson(['project', 'list', '--owner', owner, '--format', 'json'])
    const project = projects.projects.find((candidate) => candidate.number === this.projectNumber)
    if (!project) {
      throw new Error(`Project #${this.projectNumber} was not found.`)
    }
    const fields = this.ghJson([
      'project',
      'field-list',
      String(this.projectNumber),
      '--owner',
      owner,
      '--format',
      'json',
    ])
    const status = fields.fields.find((field) => field.name === 'Status')
    if (!status?.options) {
      throw new Error('Project Status single-select field is required.')
    }
    this.projectContext = {
      owner,
      project,
      status: {
        ...status,
        optionsByName: new Map(status.options.map((option) => [option.name, option])),
      },
    }
    return this.projectContext
  }

  fetchIssueProjectItem(issueNumber, projectId) {
    const [owner, name] = this.resolveRepository().split('/')
    const result = this.ghJson([
      'api',
      'graphql',
      '-F',
      `owner=${owner}`,
      '-F',
      `name=${name}`,
      '-F',
      `number=${issueNumber}`,
      '-f',
      `query=query($owner:String!,$name:String!,$number:Int!) {
        repository(owner:$owner,name:$name) {
          issue(number:$number) {
            projectItems(first:20) {
              nodes {
                id
                project { id }
                fieldValues(first:20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2SingleSelectField { name } }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
    ])
    const node = result.data.repository.issue.projectItems.nodes.find(
      (candidate) => candidate.project.id === projectId,
    )
    if (!node) {
      return null
    }
    const status = node.fieldValues.nodes.find((value) => value.field?.name === 'Status')
    return { id: node.id, status: status?.name ?? null }
  }
}

export function parseDeliveryApprovals(comments = []) {
  return comments.flatMap((comment) => {
    const match = String(comment.body ?? '').match(APPROVAL_PATTERN)
    if (!match) {
      return []
    }
    try {
      return [{ ...JSON.parse(match[1]), commentUrl: comment.url }]
    } catch {
      return []
    }
  })
}

export function parseIndependentReview(comments = []) {
  const reviews = comments.flatMap((comment) => {
    const match = String(comment.body ?? '').match(REVIEW_PATTERN)
    if (!match) {
      return []
    }
    try {
      return [{ ...JSON.parse(match[1]), commentUrl: comment.url }]
    } catch {
      return []
    }
  })
  return reviews.at(-1) ?? null
}

export function parseChecks(statusCheckRollup = [], comments = []) {
  const checks = statusCheckRollup.map((check) => ({
    name: check.name ?? check.context ?? 'check',
    status: check.status ?? check.state,
    conclusion: check.conclusion ?? check.state,
  }))
  const accepted = new Set(['SUCCESS', 'SKIPPED', 'NEUTRAL'])
  const local = comments
    .flatMap((comment) => {
      const match = String(comment.body ?? '').match(VERIFICATION_PATTERN)
      if (!match) {
        return []
      }
      try {
        return [JSON.parse(match[1])]
      } catch {
        return []
      }
    })
    .at(-1)
  const ciPassed =
    checks.length > 0 &&
    checks.every(
      (check) =>
        check.status === 'COMPLETED' && accepted.has(String(check.conclusion).toUpperCase()),
    )
  return {
    passed: Boolean(local?.passed) && (checks.length === 0 || ciPassed),
    commit: local?.commit ?? null,
    evidence: [
      ...(local?.evidence ?? []),
      ...checks.map((check) => `${check.name}: ${check.conclusion ?? check.status}`),
    ],
  }
}

export function readDeliveryArtifacts(root, featureDirectory) {
  if (!featureDirectory) {
    return { spec: '', plan: '', tasks: '' }
  }
  return Object.fromEntries(
    ['spec', 'plan', 'tasks'].map((name) => {
      const file = path.join(root, featureDirectory, `${name}.md`)
      return [name, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '']
    }),
  )
}
